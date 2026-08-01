/**
 * Test: ausgehender CalDAV-VTODO-Sync (#617)
 * Zweck: Der VTODO-Spiegel war einseitig - eine hier abgehakte, umbenannte oder
 *        gelöschte Aufgabe blieb auf dem Server stehen, und der nächste Inbound
 *        machte die lokale Änderung wieder rückgängig. Diese Suite hält die
 *        Rückrichtung fest, und zwar an den Stellen, an denen sie brechen kann:
 *
 *          - Ein PUT ersetzt das ganze Kalenderobjekt. Der Patcher darf nur die
 *            gespiegelten Properties tauschen, sonst ist jede Bearbeitung ein
 *            Datenverlust auf dem Server (Alarme, Unterlisten, Kategorien).
 *          - Erledigt liest jeder Client woanders ab: STATUS, COMPLETED und
 *            PERCENT-COMPLETE müssen zusammen wandern - und COMPLETED beim
 *            Wiederöffnen verschwinden, sonst bleibt die Aufgabe erledigt.
 *          - Yuvomi kennt vier Prioritätsstufen und vier Status, VTODO drei
 *            Bänder und kein „in Arbeit". Der Inbound darf die feineren lokalen
 *            Angaben nicht bei jedem Lauf plattmachen.
 *          - Der Inbound darf weder eine noch nicht gepushte Bearbeitung
 *            überschreiben noch einen lokal gelöschten Eintrag wieder anlegen.
 *
 *        Netz-frei: der tsdav-Client ist eine Attrappe.
 * Ausführen: node --experimental-sqlite --test test/test-caldav-todo-outbound.js
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';

const dbmod = await import('../server/db.js');
const db = dbmod.get();
const {
  MODULES, dueField, priorityToVtodo, icsFieldsForTask, icsFieldsForShoppingItem,
  markTodoOutbound, queueTodoDeletion, queueTodoDeletions,
  pendingDeletions, pendingDeletionUids, pendingUpdateUids,
  processPendingDeletions, processPendingUpdates, flushOutbound,
} = await import('../server/services/caldav-todo-outbound.js');
const { patchICSTodo } = await import('../server/utils/ics-patch.js');
const { mapVtodoPriority, mapVtodoStatus, splitDue, sync } =
  await import('../server/services/caldav-reminders-sync.js');
const { parseVTODO } = await import('../server/services/ics-parser.js');
const { MAX_OUTBOUND_ATTEMPTS } = await import('../server/services/calendar-outbound.js');

db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('admin','Admin','x','admin')").run();

const LIST_URL = 'https://dav.example/dav/u/reminders/';
const OBJ_URL  = `${LIST_URL}todo-1.ics`;

// ── Fixtures ────────────────────────────────────────────────────────────────────

/** Realistisches Serverobjekt: VTODO mit Alarm und Apple-Eigenheiten. */
function serverTodo({ uid = 'todo-1@test', completed = false, extra = [] } = {}) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Inc.//iOS 18.0//EN',
    'BEGIN:VTODO',
    `UID:${uid}`,
    'DTSTAMP:20260701T080000Z',
    'SUMMARY:Milch kaufen',
    'X-APPLE-SORT-ORDER:12',
    'CATEGORIES:Haushalt',
    ...(completed
      ? ['STATUS:COMPLETED', 'COMPLETED:20260701T090000Z', 'PERCENT-COMPLETE:100']
      : ['STATUS:NEEDS-ACTION']),
    ...extra,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\r\n');
}

function reset() {
  db.prepare('DELETE FROM caldav_todo_pending_deletions').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM shopping_items').run();
  db.prepare('DELETE FROM shopping_lists').run();
  db.prepare('DELETE FROM caldav_reminder_selection').run();
  db.prepare('DELETE FROM caldav_accounts').run();
  const acc = db.prepare(`INSERT INTO caldav_accounts (name, caldav_url, username, password)
              VALUES ('Radicale', 'https://dav.example/', 'u', 'p')`).run();
  return Number(acc.lastInsertRowid);
}

function enableList(accountId, targetModule = 'tasks', targetListId = null) {
  db.prepare(`
    INSERT INTO caldav_reminder_selection (account_id, list_url, list_name, target_module, enabled, target_list_id)
    VALUES (?, ?, 'Erinnerungen', ?, 1, ?)
  `).run(accountId, LIST_URL, targetModule, targetListId);
}

function insertTask({
  accountId, uid = 'todo-1@test', objectUrl = OBJ_URL, source = 'caldav', ...fields
} = {}) {
  const f = {
    title: 'Milch kaufen', description: null, priority: 'none', status: 'open',
    due_date: null, due_time: null, ...fields,
  };
  const r = db.prepare(`
    INSERT INTO tasks (title, description, priority, status, due_date, due_time, created_by,
                       external_uid, external_source, external_account_id, external_object_url)
    VALUES (@title, @description, @priority, @status, @due_date, @due_time, 1,
            @uid, @source, @accountId, @objectUrl)
  `).run({ ...f, uid, source, accountId: accountId ?? null, objectUrl });
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(r.lastInsertRowid);
}

function insertShoppingItem({ accountId, uid = 'todo-1@test', objectUrl = OBJ_URL, ...fields } = {}) {
  const listId = db.prepare(
    "INSERT INTO shopping_lists (name, created_by) VALUES ('Einkauf', 1) RETURNING id"
  ).get().id;
  const f = { name: 'Milch', is_checked: 0, ...fields };
  const r = db.prepare(`
    INSERT INTO shopping_items (list_id, name, is_checked, external_uid, external_source,
                                external_account_id, external_object_url)
    VALUES (@listId, @name, @is_checked, @uid, 'caldav', @accountId, @objectUrl)
  `).run({ ...f, listId, uid, accountId, objectUrl });
  return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(r.lastInsertRowid);
}

function reloadTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

/** Attrappe: sammelt die Aufrufe und beantwortet sie nach Skript. */
function fakeClient({ objects = [], onUpdate = null, onDelete = null } = {}) {
  const calls = { updated: [], deleted: [], fetched: [] };
  return {
    calls,
    fetchCalendars: async () => [{ url: LIST_URL, displayName: 'Erinnerungen', components: ['VTODO'] }],
    fetchCalendarObjects: async (args) => { calls.fetched.push(args); return objects; },
    updateCalendarObject: async (args) => {
      calls.updated.push(args.calendarObject);
      if (onUpdate) return onUpdate(args);
      return {};
    },
    deleteCalendarObject: async (args) => {
      calls.deleted.push(args.calendarObject);
      if (onDelete) return onDelete(args);
      return {};
    },
  };
}

function indexOf(uid, data = serverTodo(), url = OBJ_URL, etag = 'etag-1') {
  return new Map([[uid, { url, etag, data }]]);
}

// ── Feld-Abbildung ──────────────────────────────────────────────────────────────

test('DUE ohne Uhrzeit ist ein reines Datum, mit Uhrzeit ein UTC-Zeitstempel', () => {
  assert.deepStrictEqual(dueField('2026-08-04', null), { value: '20260804', params: ';VALUE=DATE' });
  // due_time ist Wanduhrzeit im Haushalt (hier Europe/Berlin, Sommerzeit UTC+2).
  assert.deepStrictEqual(dueField('2026-08-04', '14:30'), { value: '20260804T123000Z', params: '' });
  // Im Winter greift derselbe Weg mit einem anderen Offset (UTC+1).
  assert.deepStrictEqual(dueField('2026-01-14', '14:30'), { value: '20260114T133000Z', params: '' });
  assert.strictEqual(dueField(null, '14:30'), null);
});

test('Eine Fälligkeit mit Uhrzeit überlebt den Roundtrip als derselbe Zeitpunkt', () => {
  // Der Weg, den eine Aufgabe wirklich geht: Serverobjekt → Parser → Anzeigefelder
  // → zurück ins Objekt. Vor dem Fix stand hier 12:30 statt 14:30, verschoben um
  // genau den Zonenoffset - und der Rückweg schrieb die Verschiebung fest.
  const [todo] = parseVTODO([
    'BEGIN:VCALENDAR', 'BEGIN:VTODO', 'UID:todo-1@test', 'SUMMARY:Milch kaufen',
    'DUE;TZID=Europe/Berlin:20260804T143000', 'END:VTODO', 'END:VCALENDAR',
  ].join('\r\n'));

  const { date, time } = splitDue(todo.due);
  assert.deepStrictEqual({ date, time }, { date: '2026-08-04', time: '14:30' },
    'Yuvomi zeigt die Uhrzeit, die auch der Server-Client zeigt');
  assert.deepStrictEqual(dueField(date, time), { value: '20260804T123000Z', params: '' });
  assert.strictEqual(
    new Date('20260804T123000Z'.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')).toISOString(),
    new Date(todo.due).toISOString(),
    'derselbe Instant wie im Serverobjekt'
  );
});

test('Eine Fälligkeit ohne Zonenangabe ist bereits Wanduhrzeit', () => {
  // Floating: der Server sagt „14:30", ohne zu sagen wo. Umrechnen wäre geraten.
  const [todo] = parseVTODO([
    'BEGIN:VCALENDAR', 'BEGIN:VTODO', 'UID:todo-1@test', 'SUMMARY:x',
    'DUE:20260804T143000', 'END:VTODO', 'END:VCALENDAR',
  ].join('\r\n'));
  assert.deepStrictEqual(splitDue(todo.due), { date: '2026-08-04', time: '14:30' });

  // Ganztägig bleibt ganztägig - eine Zone hat ein reines Datum nicht.
  assert.deepStrictEqual(splitDue('2026-08-04'), { date: '2026-08-04', time: null });
  assert.deepStrictEqual(splitDue(null), { date: null, time: null });
});

test('Priorität überlebt den Roundtrip bandtreu, urgent bleibt urgent', () => {
  assert.strictEqual(priorityToVtodo('urgent'), '1');
  assert.strictEqual(priorityToVtodo('high'),   '2');
  assert.strictEqual(priorityToVtodo('medium'), '5');
  assert.strictEqual(priorityToVtodo('low'),    '9');
  assert.strictEqual(priorityToVtodo('none'),   null);

  // Rückweg: dasselbe Band lässt die feinere lokale Angabe stehen.
  assert.strictEqual(mapVtodoPriority(1, 'urgent'), 'urgent');
  assert.strictEqual(mapVtodoPriority(2, 'urgent'), 'urgent');
  assert.strictEqual(mapVtodoPriority(1, 'high'),   'high');
  // Ein Bandwechsel auf dem Server gewinnt trotzdem.
  assert.strictEqual(mapVtodoPriority(5, 'urgent'), 'medium');
  assert.strictEqual(mapVtodoPriority(null, 'urgent'), 'none');
  // Ohne lokalen Stand unverändert zur bisherigen Abbildung.
  assert.strictEqual(mapVtodoPriority(1), 'high');
  assert.strictEqual(mapVtodoPriority(9), 'low');
});

test('Status: erledigt gewinnt, in Arbeit und archiviert überleben ein NEEDS-ACTION', () => {
  const open = { completed: false, status: 'needs-action' };
  assert.strictEqual(mapVtodoStatus({ completed: true, status: 'completed' }, 'open'), 'done');
  assert.strictEqual(mapVtodoStatus({ completed: false, status: 'in-process' }, 'open'), 'in_progress');
  assert.strictEqual(mapVtodoStatus(open, 'in_progress'), 'in_progress');
  assert.strictEqual(mapVtodoStatus(open, 'archived'), 'archived');
  assert.strictEqual(mapVtodoStatus(open, 'done'), 'open', 'Wiederöffnen auf dem Server gewinnt');
  assert.strictEqual(mapVtodoStatus(open), 'open');
});

test('Erledigt-Zustand wandert als STATUS, COMPLETED und PERCENT-COMPLETE', () => {
  const done = icsFieldsForTask({ title: 'x', status: 'done' }, false);
  assert.strictEqual(done.STATUS, 'COMPLETED');
  assert.strictEqual(done['PERCENT-COMPLETE'], '100');
  assert.match(done.COMPLETED, /^\d{8}T\d{6}Z$/);

  // Bereits erledigt: der ursprüngliche Zeitpunkt bleibt stehen.
  assert.ok(!('COMPLETED' in icsFieldsForTask({ title: 'x', status: 'done' }, true)));

  const open = icsFieldsForTask({ title: 'x', status: 'open' }, true);
  assert.strictEqual(open.STATUS, 'NEEDS-ACTION');
  assert.strictEqual(open.COMPLETED, null, 'null entfernt die Property');
  assert.strictEqual(open['PERCENT-COMPLETE'], null);

  assert.strictEqual(icsFieldsForTask({ title: 'x', status: 'in_progress' }).STATUS, 'IN-PROCESS');
  assert.strictEqual(icsFieldsForShoppingItem({ name: 'Milch', is_checked: 1 }).STATUS, 'COMPLETED');
  assert.strictEqual(icsFieldsForShoppingItem({ name: 'Milch', is_checked: 0 }).STATUS, 'NEEDS-ACTION');
});

// ── Patcher ─────────────────────────────────────────────────────────────────────

test('patchICSTodo tauscht nur die verwalteten Properties', () => {
  const out = patchICSTodo(serverTodo(), 'todo-1@test', icsFieldsForTask({
    title: 'Hafermilch kaufen', description: 'ohne Zucker', status: 'done',
    due_date: '2026-08-04', due_time: null, priority: 'urgent',
  }));

  assert.ok(out.includes('SUMMARY:Hafermilch kaufen'));
  assert.ok(out.includes('DESCRIPTION:ohne Zucker'));
  assert.ok(out.includes('DUE;VALUE=DATE:20260804'));
  assert.ok(out.includes('PRIORITY:1'));
  assert.ok(out.includes('STATUS:COMPLETED'));
  assert.ok(out.includes('PERCENT-COMPLETE:100'));
  assert.ok(/COMPLETED:\d{8}T\d{6}Z/.test(out));

  // Alles, was Yuvomi nicht kennt, bleibt Zeichen für Zeichen stehen.
  assert.ok(out.includes('X-APPLE-SORT-ORDER:12'), 'fremde Property bleibt');
  assert.ok(out.includes('CATEGORIES:Haushalt'), 'Kategorien bleiben');
  assert.ok(out.includes('BEGIN:VALARM') && out.includes('TRIGGER:-PT15M'), 'Alarm bleibt');
  assert.ok(out.includes('SEQUENCE:1'), 'SEQUENCE wird gesetzt, damit Clients die Kopie erneuern');
  assert.strictEqual(out.match(/BEGIN:VTODO/g).length, 1);
});

test('Wiederöffnen entfernt COMPLETED, sonst bliebe die Aufgabe erledigt', () => {
  const out = patchICSTodo(
    serverTodo({ completed: true }), 'todo-1@test',
    icsFieldsForTask({ title: 'Milch kaufen', status: 'open' }, true)
  );
  assert.ok(out.includes('STATUS:NEEDS-ACTION'));
  assert.ok(!/^COMPLETED[;:]/m.test(out), 'COMPLETED muss verschwinden');
  assert.ok(!/^PERCENT-COMPLETE[;:]/m.test(out), 'PERCENT-COMPLETE muss verschwinden');
});

test('Fällt die Fälligkeit weg, verschwindet auch DUE', () => {
  const withDue = patchICSTodo(serverTodo(), 'todo-1@test',
    icsFieldsForTask({ title: 'x', status: 'open', due_date: '2026-08-04', due_time: '14:30' }));
  assert.ok(withDue.includes('DUE:20260804T123000Z'));

  const withoutDue = patchICSTodo(withDue, 'todo-1@test',
    icsFieldsForTask({ title: 'x', status: 'open' }));
  assert.ok(!/^DUE[;:]/m.test(withoutDue));
});

test('Ein Objekt ohne passende UID wird nicht angefasst', () => {
  assert.strictEqual(patchICSTodo(serverTodo(), 'fremd@test', { SUMMARY: 'x' }), null);
  // Auch ein VEVENT-Objekt ist kein Ziel: sonst würde ein Termin als Aufgabe gepatcht.
  const vevent = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:todo-1@test\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert.strictEqual(patchICSTodo(vevent, 'todo-1@test', { SUMMARY: 'x' }), null);
});

// ── Vormerkung ──────────────────────────────────────────────────────────────────

test('Nur gespiegelte Einträge und nur gespiegelte Felder lösen einen Push aus', () => {
  const accountId = reset();
  const task = insertTask({ accountId });

  assert.strictEqual(markTodoOutbound('tasks', task, { ...task, title: 'Neu' }), true);
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 1);

  db.prepare('UPDATE tasks SET outbound_dirty = 0 WHERE id = ?').run(task.id);
  assert.strictEqual(
    markTodoOutbound('tasks', task, { ...task, category: 'misc', points: 5 }), false,
    'Kategorie und Punkte kennt VTODO nicht'
  );
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 0);

  const local = insertTask({ accountId: null, source: 'local', uid: null, objectUrl: null });
  assert.strictEqual(
    markTodoOutbound('tasks', local, { ...local, title: 'Neu' }), false,
    'eine rein lokale Aufgabe geht nirgendwohin'
  );
});

test('Ein Tombstone überlebt den gelöschten Eintrag und ist idempotent', () => {
  const accountId = reset();
  const task = insertTask({ accountId });

  assert.strictEqual(queueTodoDeletion('tasks', task), true);
  assert.strictEqual(queueTodoDeletion('tasks', task), true, 'zweimal vormerken ist erlaubt');
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

  const rows = pendingDeletions(accountId, 'tasks');
  assert.strictEqual(rows.length, 1, 'genau ein Tombstone');
  assert.strictEqual(rows[0].uid, 'todo-1@test');
  assert.strictEqual(rows[0].object_url, OBJ_URL);

  // Module teilen sich die Tabelle, aber nicht ihre UID-Räume.
  assert.deepStrictEqual([...pendingDeletionUids(accountId, 'shopping')], []);
});

test('Eine lokale Aufgabe hinterlässt keinen Tombstone', () => {
  const accountId = reset();
  const local = insertTask({ accountId: null, source: 'local', uid: null, objectUrl: null });
  assert.strictEqual(queueTodoDeletions('tasks', [local]), 0);
  assert.strictEqual(pendingDeletions(accountId, 'tasks').length, 0);
});

// ── Ausführung ──────────────────────────────────────────────────────────────────

test('Eine vorgemerkte Änderung landet als PUT auf der Objekt-URL', async () => {
  const accountId = reset();
  const task = insertTask({ accountId, title: 'Hafermilch kaufen', status: 'done' });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const client = fakeClient();
  const pushed = await processPendingUpdates(client, accountId, 'tasks', indexOf('todo-1@test'));

  assert.strictEqual(pushed, 1);
  assert.strictEqual(client.calls.updated.length, 1);
  assert.strictEqual(client.calls.updated[0].url, OBJ_URL);
  assert.strictEqual(client.calls.updated[0].etag, 'etag-1', 'etag mitschicken, sonst überschreibt der PUT blind');
  assert.ok(client.calls.updated[0].data.includes('SUMMARY:Hafermilch kaufen'));
  assert.ok(client.calls.updated[0].data.includes('STATUS:COMPLETED'));
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 0, 'erledigt, also nicht mehr vorgemerkt');
});

test('Ohne Originalobjekt wird nichts gepusht - ein Neubau verlöre den Rest', async () => {
  const accountId = reset();
  const task = insertTask({ accountId });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const client = fakeClient();
  const pushed = await processPendingUpdates(client, accountId, 'tasks', new Map());

  assert.strictEqual(pushed, 0);
  assert.strictEqual(client.calls.updated.length, 0);
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 1, 'bleibt für den nächsten Lauf vorgemerkt');
});

test('Ein Serverfehler zählt Versuche hoch und gibt erst am Limit auf', async () => {
  const accountId = reset();
  const task = insertTask({ accountId });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const boom = () => { const e = new Error('kaputt'); e.code = 503; throw e; };
  const client = fakeClient({ onUpdate: boom });

  for (let i = 1; i < MAX_OUTBOUND_ATTEMPTS; i++) {
    await processPendingUpdates(client, accountId, 'tasks', indexOf('todo-1@test'));
    const row = reloadTask(task.id);
    assert.strictEqual(row.outbound_attempts, i);
    assert.strictEqual(row.outbound_dirty, 1, 'noch nicht aufgegeben');
  }

  await processPendingUpdates(client, accountId, 'tasks', indexOf('todo-1@test'));
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 0, 'nach dem letzten Versuch aufgegeben');
});

test('Ein 404 gilt als erledigt: das Objekt ist auf dem Server ohnehin weg', async () => {
  const accountId = reset();
  const task = insertTask({ accountId });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const gone = () => { const e = new Error('not found'); e.code = 404; throw e; };
  await processPendingUpdates(fakeClient({ onUpdate: gone }), accountId, 'tasks', indexOf('todo-1@test'));

  assert.strictEqual(reloadTask(task.id).outbound_dirty, 0);
  assert.strictEqual(reloadTask(task.id).outbound_attempts, 0);
});

test('Eine vorgemerkte Löschung wird als DELETE ausgeführt', async () => {
  const accountId = reset();
  const task = insertTask({ accountId });
  queueTodoDeletion('tasks', task);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

  const client = fakeClient();
  const removed = await processPendingDeletions(client, accountId, 'tasks', indexOf('todo-1@test'));

  assert.strictEqual(removed, 1);
  assert.strictEqual(client.calls.deleted[0].url, OBJ_URL);
  assert.strictEqual(pendingDeletions(accountId, 'tasks').length, 0);
});

test('Ohne Objekt-URL bleibt der Tombstone liegen, bis ein voller Lauf ihn klärt', async () => {
  const accountId = reset();
  const task = insertTask({ accountId, objectUrl: null });
  queueTodoDeletion('tasks', task);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

  // Sofortversuch: nur einzelne Objekte geholt, "der Server führt es nicht mehr"
  // ist nicht belegbar.
  const client = fakeClient();
  assert.strictEqual(await processPendingDeletions(client, accountId, 'tasks', new Map(), false), 0);
  assert.strictEqual(pendingDeletions(accountId, 'tasks').length, 1);
  assert.strictEqual(client.calls.deleted.length, 0, 'kein DELETE ins Blaue');

  // Voller Lauf: die Liste wurde abgerufen und enthält das Objekt nicht mehr.
  assert.strictEqual(await processPendingDeletions(client, accountId, 'tasks', new Map(), true), 1);
  assert.strictEqual(pendingDeletions(accountId, 'tasks').length, 0);
});

test('Einkaufsposten laufen über dieselbe Maschinerie', async () => {
  const accountId = reset();
  const item = insertShoppingItem({ accountId, is_checked: 1 });
  db.prepare('UPDATE shopping_items SET outbound_dirty = 1 WHERE id = ?').run(item.id);

  const client = fakeClient();
  const pushed = await processPendingUpdates(client, accountId, 'shopping', indexOf('todo-1@test'));

  assert.strictEqual(pushed, 1);
  assert.ok(client.calls.updated[0].data.includes('STATUS:COMPLETED'));
  assert.strictEqual(
    db.prepare('SELECT outbound_dirty FROM shopping_items WHERE id = ?').get(item.id).outbound_dirty, 0
  );
});

test('Ein unbekanntes Modul kommt nie bis zum SQL-Statement', () => {
  assert.throws(() => queueTodoDeletion('notes', {}), /Unknown VTODO module/);
  assert.deepStrictEqual(Object.keys(MODULES).sort(), ['shopping', 'tasks']);
});

// ── Sofortversuch ───────────────────────────────────────────────────────────────

test('flushOutbound holt die Objekte aus der abgeleiteten Collection', async () => {
  const accountId = reset();
  const task = insertTask({ accountId, title: 'Hafermilch kaufen' });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const client = fakeClient({ objects: [{ url: OBJ_URL, etag: 'e9', data: serverTodo() }] });
  const result = await flushOutbound({ createClient: async () => client });

  assert.strictEqual(result.updated, 1);
  assert.strictEqual(client.calls.fetched[0].calendar.url, LIST_URL,
    'die Collection wird aus der Objekt-URL abgeleitet, denn die Aufgabe kennt nur diese');
  assert.deepStrictEqual(client.calls.fetched[0].objectUrls, [OBJ_URL]);
  assert.strictEqual(reloadTask(task.id).outbound_dirty, 0);
});

test('Ohne offene Arbeit baut flushOutbound keinen Client auf', async () => {
  reset();
  let built = 0;
  const result = await flushOutbound({ createClient: async () => { built++; return fakeClient(); } });
  assert.deepStrictEqual(result, { deleted: 0, updated: 0 });
  assert.strictEqual(built, 0);
});

// ── Abruf der Aufgabenliste ─────────────────────────────────────────────────────

test('Der Inbound fragt die Liste nach VTODO ab, nicht nach Terminen (#586)', async () => {
  const accountId = reset();
  enableList(accountId, 'tasks');

  // Attrappe eines regelkonformen Servers: der REPORT liefert nur, wonach der
  // comp-filter fragt. Ohne eigene Angabe filtert tsdav auf VEVENT - auf einer
  // Aufgabenliste blieb die Antwort damit leer, die Liste tauchte in den
  // Einstellungen auf und das Modul blieb trotzdem leer.
  const strict = fakeClient({ objects: [{ url: OBJ_URL, etag: 'e1', data: serverTodo() }] });
  const answer = strict.fetchCalendarObjects;
  strict.fetchCalendarObjects = async (args) => {
    const objects = await answer(args);
    return JSON.stringify(args.filters ?? []).includes('VTODO') ? objects : [];
  };

  await sync({ createClient: async () => strict });

  const task = db.prepare("SELECT * FROM tasks WHERE external_uid = 'todo-1@test'").get();
  assert.ok(task, 'die Aufgabe der Liste muss ankommen');
  assert.strictEqual(task.title, 'Milch kaufen');
});

// ── Zusammenspiel mit dem Inbound ───────────────────────────────────────────────

test('Der Inbound überschreibt keine Bearbeitung, die noch auf ihren Push wartet', async () => {
  const accountId = reset();
  enableList(accountId, 'tasks');
  const task = insertTask({ accountId, title: 'Hafermilch kaufen' });
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);

  const client = fakeClient({ objects: [{ url: OBJ_URL, etag: 'e1', data: serverTodo() }] });
  await sync({ createClient: async () => client });

  const after = reloadTask(task.id);
  assert.strictEqual(after.title, 'Hafermilch kaufen', 'der alte Serverstand darf nicht zurückschlagen');
  assert.strictEqual(after.outbound_dirty, 0, 'stattdessen wurde die Änderung im selben Lauf gepusht');
  assert.ok(client.calls.updated[0].data.includes('SUMMARY:Hafermilch kaufen'));
});

test('Der Inbound legt einen lokal gelöschten Eintrag nicht wieder an', async () => {
  const accountId = reset();
  enableList(accountId, 'tasks');
  const task = insertTask({ accountId });
  queueTodoDeletion('tasks', task);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

  // Der Server liefert die Aufgabe noch aus - das DELETE ist ja noch nicht raus.
  const client = fakeClient({ objects: [{ url: OBJ_URL, etag: 'e1', data: serverTodo() }] });
  await sync({ createClient: async () => client });

  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n, 0, 'kein Wiedergänger');
  assert.strictEqual(client.calls.deleted.length, 1, 'stattdessen geht die Löschung raus');
  assert.strictEqual(pendingDeletions(accountId, 'tasks').length, 0);
});

test('Der Inbound trägt die Objekt-URL nach, ohne sie je zu entwerten', async () => {
  const accountId = reset();
  enableList(accountId, 'tasks');
  const task = insertTask({ accountId, objectUrl: null });

  const client = fakeClient({ objects: [{ url: OBJ_URL, etag: 'e1', data: serverTodo() }] });
  await sync({ createClient: async () => client });
  assert.strictEqual(reloadTask(task.id).external_object_url, OBJ_URL);

  // Ein Abruf ohne URL darf den gespeicherten Wert nicht löschen.
  const blind = fakeClient({ objects: [{ etag: 'e1', data: serverTodo() }] });
  await sync({ createClient: async () => blind });
  assert.strictEqual(reloadTask(task.id).external_object_url, OBJ_URL);
});

test('pendingUpdateUids meldet genau die wartenden Bearbeitungen', () => {
  const accountId = reset();
  const task = insertTask({ accountId });
  assert.strictEqual(pendingUpdateUids(accountId, 'tasks').size, 0);
  db.prepare('UPDATE tasks SET outbound_dirty = 1 WHERE id = ?').run(task.id);
  assert.deepStrictEqual([...pendingUpdateUids(accountId, 'tasks')], ['todo-1@test']);
});

// ── Migration v113 gegen eine befüllte Bestands-DB ──────────────────────────────

test('v113 ist additiv und startet mit neutralen Markern', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { default: Database } = await import('better-sqlite3-multiple-ciphers');
  const { MIGRATIONS } = await import('../server/db.js');

  const apply = (conn, migration) => {
    if (typeof migration.up === 'function') migration.up(conn);
    else conn.exec(migration.up);
    migration.afterUp?.(conn);
  };

  const old = new Database(join(mkdtempSync(join(tmpdir(), 'yuvomi-todomig-')), 'db.sqlite'));
  for (const migration of MIGRATIONS.filter((m) => m.version <= 112)) apply(old, migration);

  // Bestand, wie ihn ein Nutzer mit VTODO-Spiegel mitbringt.
  old.prepare("INSERT INTO users (id, username, display_name, password_hash, role) VALUES (1,'admin','Admin','x','admin')").run();
  old.prepare(`INSERT INTO caldav_accounts (id, name, caldav_url, username, password)
               VALUES (1, 'Radicale', 'https://dav.example/', 'u', 'p')`).run();
  old.prepare(`INSERT INTO tasks (id, title, created_by, external_uid, external_source, external_account_id)
               VALUES (7, 'Milch kaufen', 1, 'todo-1@test', 'caldav', 1)`).run();
  old.prepare("INSERT INTO shopping_lists (id, name, created_by) VALUES (3, 'Einkauf', 1)").run();
  old.prepare(`INSERT INTO shopping_items (id, list_id, name, external_uid, external_source, external_account_id)
               VALUES (5, 3, 'Butter', 'todo-2@test', 'caldav', 1)`).run();

  const before = old.prepare('SELECT * FROM tasks WHERE id = 7').get();
  apply(old, MIGRATIONS.find((m) => m.version === 113));
  const after = old.prepare('SELECT * FROM tasks WHERE id = 7').get();

  for (const [key, value] of Object.entries(before)) {
    assert.deepStrictEqual(after[key], value, `Spalte ${key} darf sich nicht ändern`);
  }
  assert.strictEqual(after.external_object_url, null, 'kein Backfill, die URL trägt der nächste Inbound nach');
  assert.strictEqual(after.outbound_dirty, 0, 'der erste Sync nach dem Update pusht nichts');
  assert.strictEqual(after.outbound_attempts, 0);
  assert.strictEqual(old.prepare('SELECT outbound_dirty FROM shopping_items WHERE id = 5').get().outbound_dirty, 0);

  // Module teilen die Tombstone-Tabelle, aber nicht ihren UID-Raum.
  const insert = old.prepare(
    'INSERT INTO caldav_todo_pending_deletions (account_id, module, uid) VALUES (?, ?, ?)'
  );
  insert.run(1, 'tasks', 'todo-1@test');
  insert.run(1, 'shopping', 'todo-1@test');
  assert.throws(() => insert.run(1, 'tasks', 'todo-1@test'), /UNIQUE/);
  assert.throws(() => insert.run(1, 'notes', 'todo-1@test'), /CHECK/);

  // Fällt das Konto weg, sind seine offenen Löschungen gegenstandslos.
  old.prepare('PRAGMA foreign_keys = ON').run();
  old.prepare('DELETE FROM caldav_accounts WHERE id = 1').run();
  assert.strictEqual(old.prepare('SELECT COUNT(*) AS n FROM caldav_todo_pending_deletions').get().n, 0);

  old.close();
});
