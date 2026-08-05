/**
 * Modul: Tasks-Recurrence-Test
 * Zweck: Aufholen übersprungener wiederkehrender Aufgaben (Discussion #405).
 *        Unit: nextOccurrenceAfter. Integration: PATCH /:id/status und PUT /:id
 *        erzeugen beim Erledigen genau eine Folgeinstanz mit Fälligkeitsdatum in
 *        der Zukunft - und nehmen sie beim Zurücknehmen wieder weg.
 * Ausführen: node --test test/test-tasks-recurrence.js
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import Database from 'better-sqlite3-multiple-ciphers';

process.env.DB_PATH = ':memory:';

const { nextOccurrence, nextOccurrenceAfter } = await import('../server/services/recurrence.js');
const { MIGRATIONS, _setTestDatabase } = await import('../server/db.js');
const { default: tasksRouter } = await import('../server/routes/tasks.js');

// --------------------------------------------------------
// Helfer
// --------------------------------------------------------
const DAY = 86400000;
const todayKey = () => new Date().toISOString().slice(0, 10);
const dayKey = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// --------------------------------------------------------
// Unit: nextOccurrenceAfter
// --------------------------------------------------------
test('nextOccurrenceAfter: pünktliches Abhaken springt genau ein Intervall (kein Aufholen)', () => {
  // due in 7 Tagen, Schwelle heute → erstes Vorkommen (due+7) liegt bereits in der Zukunft
  const due = dayKey(7);
  const expected = nextOccurrence(due, 'FREQ=WEEKLY');
  assert.equal(nextOccurrenceAfter(due, 'FREQ=WEEKLY', todayKey()), expected);
});

test('nextOccurrenceAfter: mehrere verpasste Wochen → erstes Vorkommen >= heute', () => {
  const due = dayKey(-21); // 3 Wochen überfällig
  const result = nextOccurrenceAfter(due, 'FREQ=WEEKLY', todayKey());
  assert.ok(result >= todayKey(), `Ergebnis ${result} muss >= heute sein`);
  // Es bleibt auf dem Serien-Raster (Wochentag von due)
  const naive = nextOccurrence(due, 'FREQ=WEEKLY');
  assert.ok(naive < todayKey(), 'naives nextOccurrence wäre noch überfällig');
});

test('nextOccurrenceAfter: DAILY holt auf morgen/heute auf', () => {
  const due = dayKey(-10);
  const result = nextOccurrenceAfter(due, 'FREQ=DAILY', todayKey());
  assert.ok(result >= todayKey());
});

test('nextOccurrenceAfter: MONTHLY holt mehrere Monate auf', () => {
  const due = dayKey(-95); // ~3 Monate überfällig
  const result = nextOccurrenceAfter(due, 'FREQ=MONTHLY', todayKey());
  assert.ok(result >= todayKey());
});

test('nextOccurrenceAfter: UNTIL endet vor heute → null', () => {
  const due = dayKey(-21);
  const untilStr = dayKey(-7).replace(/-/g, ''); // UNTIL=YYYYMMDD vor heute
  assert.equal(nextOccurrenceAfter(due, `FREQ=WEEKLY;UNTIL=${untilStr}`, todayKey()), null);
});

test('nextOccurrenceAfter: ohne Basisdatum → null', () => {
  assert.equal(nextOccurrenceAfter(null, 'FREQ=WEEKLY', todayKey()), null);
});

// --------------------------------------------------------
// Integration: PATCH /:id/status (done) gegen den Router
// --------------------------------------------------------
function buildTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`);
  for (const m of MIGRATIONS) {
    if (typeof m.up === 'function') m.up(db); else db.exec(m.up);
    if (typeof m.afterUp === 'function') m.afterUp(db);
    db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(m.version, m.description);
  }
  return db;
}

const db = buildTestDb();
_setTestDatabase(db);
const uid = db.prepare(`INSERT INTO users (username, display_name, password_hash, role)
  VALUES ('admin', 'Admin', '$2b$12$x', 'admin')`).run().lastInsertRowid;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authUserId = uid;
  req.session = { userId: uid, role: 'admin' };
  next();
});
app.use('/api/v1/tasks', tasksRouter);
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/api/v1/tasks`;

test.after(() => server.close());

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function insertTask(fields) {
  const cols = Object.keys(fields);
  const r = db.prepare(
    `INSERT INTO tasks (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  ).run(...cols.map((c) => fields[c]));
  return r.lastInsertRowid;
}

test('PATCH done: überfällige Wochen-Serie erzeugt genau eine Folgeinstanz in der Zukunft', async () => {
  const id = insertTask({
    title: 'Bad putzen', category: 'Haushalt', priority: 'medium', status: 'open',
    due_date: dayKey(-21), created_by: uid, is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  db.prepare('INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)').run(id, uid);

  const res = await call('PATCH', `/${id}/status`, { status: 'done' });
  assert.equal(res.status, 200);

  const followups = db.prepare(
    `SELECT * FROM tasks WHERE title = 'Bad putzen' AND status = 'open' AND parent_task_id IS NULL`,
  ).all();
  assert.equal(followups.length, 1, 'Es darf genau eine offene Folgeinstanz existieren');
  assert.ok(followups[0].due_date >= todayKey(), 'Folgeinstanz muss in der Zukunft fällig sein');
  assert.equal(followups[0].is_recurring, 1);
  // Assignments übernommen
  const assignees = db.prepare('SELECT user_id FROM task_assignments WHERE task_id = ?').all(followups[0].id);
  assert.deepEqual(assignees.map((a) => a.user_id), [uid]);
});

test('PATCH done: nicht-wiederkehrende Aufgabe erzeugt keine Folgeinstanz', async () => {
  const id = insertTask({
    title: 'Einmalig', status: 'open', due_date: dayKey(-3), created_by: uid,
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE title = 'Einmalig'`).get();
  assert.equal(rows.n, 1);
});

// --------------------------------------------------------
// Zurückgenommenes Abhaken (#650)
// --------------------------------------------------------
function openInstances(title) {
  return db.prepare(
    `SELECT * FROM tasks WHERE title = ? AND status = 'open' AND parent_task_id IS NULL
     ORDER BY due_date`,
  ).all(title);
}

async function completeRecurring(title, rule = 'FREQ=DAILY') {
  const id = insertTask({
    title, category: 'Haushalt', priority: 'medium', status: 'open',
    due_date: dayKey(0), created_by: uid, is_recurring: 1, recurrence_rule: rule,
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });
  return id;
}

test('PATCH open: zurückgenommenes Abhaken entfernt die erzeugte Folgeinstanz', async () => {
  const first = await completeRecurring('Müll rausbringen');
  const second = openInstances('Müll rausbringen')[0];
  assert.ok(second, 'Abhaken muss eine Folgeinstanz erzeugt haben');

  // Versehentlich auch die Folgeinstanz abgehakt → dritte Instanz entsteht
  await call('PATCH', `/${second.id}/status`, { status: 'done' });
  assert.equal(openInstances('Müll rausbringen').length, 1);

  // Zurücknehmen: die aus DIESEM Abhaken entstandene Instanz verschwindet wieder
  const res = await call('PATCH', `/${second.id}/status`, { status: 'open' });
  assert.equal(res.status, 200);

  const open = openInstances('Müll rausbringen');
  assert.equal(open.length, 1, 'Nach dem Zurücknehmen darf genau eine offene Instanz existieren');
  assert.equal(open[0].id, second.id, 'Und zwar die wieder geöffnete, nicht die Folgeinstanz');
  assert.equal(db.prepare('SELECT status FROM tasks WHERE id = ?').get(first).status, 'done');
});

test('PATCH done: erneutes Abhaken nach dem Zurücknehmen erzeugt wieder genau eine Folgeinstanz', async () => {
  await completeRecurring('Pflanzen gießen');
  const second = openInstances('Pflanzen gießen')[0];

  await call('PATCH', `/${second.id}/status`, { status: 'done' });
  await call('PATCH', `/${second.id}/status`, { status: 'open' });
  await call('PATCH', `/${second.id}/status`, { status: 'done' });

  assert.equal(openInstances('Pflanzen gießen').length, 1);
});

test('PATCH done: doppeltes done ohne Statuswechsel erzeugt keine zweite Folgeinstanz', async () => {
  const id = await completeRecurring('Katzenklo');
  await call('PATCH', `/${id}/status`, { status: 'done' });
  assert.equal(openInstances('Katzenklo').length, 1);
});

test('PATCH open: bearbeitete Folgeinstanz bleibt stehen', async () => {
  await completeRecurring('Wäsche waschen');
  const second = openInstances('Wäsche waschen')[0];
  await call('PATCH', `/${second.id}/status`, { status: 'done' });
  const third = openInstances('Wäsche waschen')[0];
  // Jemand hat der Folgeinstanz Arbeit hinzugefügt - die darf nicht wegfallen
  insertTask({ title: 'Buntwäsche', status: 'open', created_by: uid, parent_task_id: third.id });

  await call('PATCH', `/${second.id}/status`, { status: 'open' });
  const survivor = db.prepare('SELECT * FROM tasks WHERE id = ?').get(third.id);
  assert.ok(survivor, 'Folgeinstanz mit Unteraufgaben bleibt erhalten');
  assert.equal(openInstances('Wäsche waschen').length, 2);
});

test('PUT: Statuswechsel weg von done entfernt die Folgeinstanz ebenfalls', async () => {
  const id = await completeRecurring('Staubsaugen');
  const second = openInstances('Staubsaugen')[0];
  await call('PATCH', `/${second.id}/status`, { status: 'done' });

  const res = await call('PUT', `/${second.id}`, { title: 'Staubsaugen', status: 'open' });
  assert.equal(res.status, 200);
  assert.equal(openInstances('Staubsaugen').length, 1);
  assert.equal(db.prepare('SELECT status FROM tasks WHERE id = ?').get(id).status, 'done');
});

test('PUT done: Abhaken im Bearbeiten-Dialog erzeugt die Folgeinstanz genauso', async () => {
  const id = insertTask({
    title: 'Fenster putzen', category: 'Haushalt', priority: 'medium', status: 'open',
    due_date: dayKey(-21), created_by: uid, is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  db.prepare('INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)').run(id, uid);

  const res = await call('PUT', `/${id}`, { title: 'Fenster putzen', status: 'done' });
  assert.equal(res.status, 200);

  const open = openInstances('Fenster putzen');
  assert.equal(open.length, 1, 'Das Status-Dropdown muss die Serie weiterschreiben');
  assert.ok(open[0].due_date >= todayKey(), 'Folgeinstanz muss in der Zukunft fällig sein');
  assert.equal(open[0].is_recurring, 1);
  assert.equal(open[0].recurrence_origin_id, id);
  const assignees = db.prepare('SELECT user_id FROM task_assignments WHERE task_id = ?').all(open[0].id);
  assert.deepEqual(assignees.map((a) => a.user_id), [uid]);
});

test('PUT done: erneutes Speichern ohne Statuswechsel erzeugt keine zweite Folgeinstanz', async () => {
  const id = insertTask({
    title: 'Handtücher wechseln', status: 'open', due_date: dayKey(0), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=DAILY',
  });
  await call('PUT', `/${id}`, { title: 'Handtücher wechseln', status: 'done' });
  await call('PUT', `/${id}`, { title: 'Handtücher wechseln', status: 'done' });
  assert.equal(openInstances('Handtücher wechseln').length, 1);
});

test('PUT: Zurücknehmen entfernt die per PUT erzeugte Folgeinstanz wieder', async () => {
  const id = insertTask({
    title: 'Bettwäsche', status: 'open', due_date: dayKey(0), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=DAILY',
  });
  await call('PUT', `/${id}`, { title: 'Bettwäsche', status: 'done' });
  assert.equal(openInstances('Bettwäsche').length, 1);

  await call('PUT', `/${id}`, { title: 'Bettwäsche', status: 'open' });
  const open = openInstances('Bettwäsche');
  assert.equal(open.length, 1, 'Nach dem Zurücknehmen bleibt nur die wieder geöffnete Aufgabe');
  assert.equal(open[0].id, id);
});

test('PUT done: im selben Speichern geänderte Regel gilt schon für die Folgeinstanz', async () => {
  // Der Aufruf übergibt bewusst die frisch gelesene Zeile, nicht den Stand von
  // vorher. Wer im Bearbeiten-Dialog die Wiederholung umstellt und gleich abhakt,
  // bekommt sonst die nächste Instanz nach der alten Regel.
  const id = insertTask({
    title: 'Filter wechseln', status: 'open', due_date: dayKey(-1), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  const newDue = dayKey(-1);
  await call('PUT', `/${id}`, {
    title: 'Filter wechseln', status: 'done',
    recurrence_rule: 'FREQ=MONTHLY', due_date: newDue,
  });

  const open = openInstances('Filter wechseln');
  assert.equal(open.length, 1);
  assert.equal(open[0].recurrence_rule, 'FREQ=MONTHLY', 'Die neue Regel reist mit');
  assert.equal(
    open[0].due_date,
    nextOccurrenceAfter(newDue, 'FREQ=MONTHLY', todayKey()),
    'Fälligkeit liegt auf dem Monats-, nicht auf dem Wochenraster',
  );
});

test('PUT done: im selben Speichern abgeschaltete Wiederholung erzeugt keine Folgeinstanz', async () => {
  const id = insertTask({
    title: 'Filter entkalken', status: 'open', due_date: dayKey(-1), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PUT', `/${id}`, { title: 'Filter entkalken', status: 'done', is_recurring: 0 });

  const rows = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE title = 'Filter entkalken'`).get();
  assert.equal(rows.n, 1, 'Wer die Wiederholung abschaltet, beendet die Serie bewusst');
});

test('PUT done: Subtask einer Serie erzeugt keine Folgeinstanz', async () => {
  const parent = insertTask({
    title: 'Eltern-Serie PUT', status: 'open', due_date: dayKey(-7), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  const sub = insertTask({
    title: 'Sub PUT', status: 'open', due_date: dayKey(-7), created_by: uid,
    parent_task_id: parent, is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PUT', `/${sub}`, { title: 'Sub PUT', status: 'done' });
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE title = 'Sub PUT'`).get();
  assert.equal(rows.n, 1, 'Subtasks dürfen keine Folgeinstanz auslösen');
});

// --------------------------------------------------------
// Erledigen und Folgeinstanz sind eine Einheit
// --------------------------------------------------------

/**
 * Lässt genau den Spawn-INSERT scheitern (nur er setzt recurrence_origin_id)
 * und lässt alles andere in Ruhe.
 */
async function withFailingSpawn(fn) {
  db.exec(`CREATE TRIGGER spawn_boom BEFORE INSERT ON tasks
    WHEN NEW.recurrence_origin_id IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'spawn failed'); END`);
  try {
    await fn();
  } finally {
    db.exec('DROP TRIGGER spawn_boom');
  }
}

test('PATCH: scheitert der Spawn, bleibt die Aufgabe offen', async () => {
  await withFailingSpawn(async () => {
    const id = insertTask({
      title: 'Rauchmelder prüfen', status: 'open', due_date: dayKey(0), created_by: uid,
      is_recurring: 1, recurrence_rule: 'FREQ=MONTHLY',
    });
    const res = await call('PATCH', `/${id}/status`, { status: 'done' });
    assert.equal(res.status, 500);
    assert.equal(
      db.prepare('SELECT status FROM tasks WHERE id = ?').get(id).status, 'open',
      'Ohne Folgeinstanz darf die Aufgabe nicht erledigt zurückbleiben - die Serie endete sonst still',
    );
  });
});

test('PUT: scheitert der Spawn, rollt das ganze Speichern zurück', async () => {
  await withFailingSpawn(async () => {
    const id = insertTask({
      title: 'Sieb reinigen', status: 'open', due_date: dayKey(0), created_by: uid,
      priority: 'low', is_recurring: 1, recurrence_rule: 'FREQ=MONTHLY',
    });
    // Titel und Priorität ändern sich mit: die Transaktion deckt das ganze
    // UPDATE ab, nicht nur die Status-Spalte.
    const res = await call('PUT', `/${id}`, {
      title: 'Sieb reinigen NEU', status: 'done', priority: 'high',
    });
    assert.equal(res.status, 500);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    assert.equal(row.status, 'open', 'Auch das Bearbeiten-Formular rollt den Statuswechsel mit zurück');
    assert.equal(row.title, 'Sieb reinigen', 'Und den Rest des Speicherns gleich mit');
    assert.equal(row.priority, 'low');
  });
});

test('Folgeinstanz behält den Vorlauf zwischen Start- und Fälligkeitsdatum', async () => {
  const id = insertTask({
    title: 'Steuer vorbereiten', status: 'open',
    start_date: dayKey(-24), due_date: dayKey(-21), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });

  const next = openInstances('Steuer vorbereiten')[0];
  assert.ok(next.start_date, 'Das Startdatum darf nicht verlorengehen');
  const lead = (Date.parse(`${next.due_date}T00:00:00Z`) - Date.parse(`${next.start_date}T00:00:00Z`)) / DAY;
  assert.equal(lead, 3, 'Drei Tage Vorlauf wie beim Durchlauf davor');
});

test('Folgeinstanz ohne Startdatum bekommt auch keines', async () => {
  const id = insertTask({
    title: 'Backup prüfen', status: 'open', due_date: dayKey(-2), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });
  assert.equal(openInstances('Backup prüfen')[0].start_date, null);
});

test('PATCH done: Subtask einer Serie erzeugt keine Folgeinstanz', async () => {
  const parent = insertTask({
    title: 'Eltern-Serie', status: 'open', due_date: dayKey(-7), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  const sub = insertTask({
    title: 'Sub', status: 'open', due_date: dayKey(-7), created_by: uid,
    parent_task_id: parent, is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PATCH', `/${sub}/status`, { status: 'done' });
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE title = 'Sub'`).get();
  assert.equal(rows.n, 1, 'Subtasks dürfen keine Folgeinstanz auslösen');
});
