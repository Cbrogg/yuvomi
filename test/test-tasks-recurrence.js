/**
 * Modul: Tasks-Recurrence-Test
 * Zweck: Aufholen übersprungener wiederkehrender Aufgaben (Discussion #405) und
 *        die Wahl des Ankers: ab Fälligkeit oder ab Erledigungstag (#658).
 *        Unit: nextOccurrenceAfter, nextDueAfterCompletion. Integration:
 *        PATCH /:id/status erzeugt genau eine Folgeinstanz, deren Fälligkeit am
 *        gewählten Anker hängt.
 * Ausführen: node --test test/test-tasks-recurrence.js
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import Database from 'better-sqlite3-multiple-ciphers';

process.env.DB_PATH = ':memory:';
// Der Erledigungstag kommt aus der Haushaltszone (serverTimeZone lesend über
// process.env.TZ). Auf UTC festgenagelt, damit `todayKey()` hier und die
// Route dieselbe Vorstellung von "heute" haben - sonst hinge das Ergebnis an
// der Zone der ausführenden Maschine und wackelte über Mitternacht.
process.env.TZ = 'UTC';

const {
  nextOccurrence, nextOccurrenceAfter, nextDueAfterCompletion,
} = await import('../server/services/recurrence.js');
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
// Unit: nextDueAfterCompletion - Anker ab Erledigungstag (#658)
// --------------------------------------------------------
test('nextDueAfterCompletion: der Fall aus #658 - Samstag fällig, Montag erledigt, Montag+7', () => {
  // Fester Kalender statt "heute": die Aussage ist ein Datumsverhältnis, kein
  // Verhältnis zur Laufzeit des Tests.
  const next = nextDueAfterCompletion({
    anchorDate: '2026-08-01',   // Samstag
    rule: 'FREQ=WEEKLY',
    completedOn: '2026-08-03',  // Montag
    fromCompletion: true,
  });
  assert.equal(next, '2026-08-10', 'eine Woche ab dem Tag des Abhakens');
});

test('nextDueAfterCompletion: derselbe Fall fälligkeitsverankert bleibt auf dem Samstag', () => {
  const next = nextDueAfterCompletion({
    anchorDate: '2026-08-01',
    rule: 'FREQ=WEEKLY',
    completedOn: '2026-08-03',
    fromCompletion: false,
  });
  assert.equal(next, '2026-08-08', 'Vorgabe: das Raster der Serie verschiebt sich nicht');
});

test('nextDueAfterCompletion: frühes Abhaken zählt ebenfalls ab dem Erledigungstag', () => {
  // Nicht nur überfälliges Abhaken verschiebt: wer zwei Tage früher fertig ist,
  // beginnt das Intervall auch zwei Tage früher.
  const next = nextDueAfterCompletion({
    anchorDate: '2026-08-10',
    rule: 'FREQ=DAILY;INTERVAL=3',
    completedOn: '2026-08-08',
    fromCompletion: true,
  });
  assert.equal(next, '2026-08-11');
});

test('nextDueAfterCompletion: MONTHLY rechnet vom Erledigungstag, nicht vom Fälligkeitstag', () => {
  const next = nextDueAfterCompletion({
    anchorDate: '2026-01-31',
    rule: 'FREQ=MONTHLY',
    completedOn: '2026-02-05',
    fromCompletion: true,
  });
  assert.equal(next, '2026-03-05');
});

test('nextDueAfterCompletion: UNTIL beendet auch die erledigungsverankerte Serie', () => {
  const next = nextDueAfterCompletion({
    anchorDate: '2026-08-01',
    rule: 'FREQ=WEEKLY;UNTIL=20260805',
    completedOn: '2026-08-03',
    fromCompletion: true,
  });
  assert.equal(next, null);
});

test('nextDueAfterCompletion: ohne Erledigungstag → null', () => {
  assert.equal(nextDueAfterCompletion({
    anchorDate: '2026-08-01', rule: 'FREQ=WEEKLY', completedOn: null, fromCompletion: true,
  }), null);
});

test('nextDueAfterCompletion: ohne Fälligkeitsdatum trägt der Erledigungstag die Serie', () => {
  // Fälligkeitsverankert gäbe es hier nichts zu rechnen (und es entsteht keine
  // Folgeinstanz); mit dem Erledigungstag als Anker schon.
  assert.equal(nextDueAfterCompletion({
    anchorDate: null, rule: 'FREQ=WEEKLY', completedOn: '2026-08-03', fromCompletion: false,
  }), null);
  assert.equal(nextDueAfterCompletion({
    anchorDate: null, rule: 'FREQ=WEEKLY', completedOn: '2026-08-03', fromCompletion: true,
  }), '2026-08-10');
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

// --------------------------------------------------------
// Anker ab Erledigungstag gegen den Router (#658)
// --------------------------------------------------------
test('PATCH done: erledigungsverankerte Serie wird ab heute fällig, nicht ab dem alten Raster', async () => {
  const id = insertTask({
    title: 'Luftfilter reinigen', status: 'open', due_date: dayKey(-3), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY', recurrence_from_completion: 1,
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });

  const followup = openInstances('Luftfilter reinigen')[0];
  assert.ok(followup, 'Abhaken muss eine Folgeinstanz erzeugt haben');
  assert.equal(followup.due_date, dayKey(7), 'genau eine Woche ab heute');
  // Das fälligkeitsverankerte Ergebnis wäre der 4. Tag ab heute (due-3 + 7).
  assert.notEqual(followup.due_date, dayKey(4));
});

test('PATCH done: die Folgeinstanz erbt den Anker, sonst kippt die Serie ab dem zweiten Lauf', async () => {
  const id = insertTask({
    title: 'Pflanzen düngen', status: 'open', due_date: dayKey(-5), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY', recurrence_from_completion: 1,
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });
  const second = openInstances('Pflanzen düngen')[0];
  assert.equal(second.recurrence_from_completion, 1);

  // Zweiter Durchlauf: heute abgehakt, obwohl erst in einer Woche fällig →
  // wieder heute + 7 statt fällig + 7.
  await call('PATCH', `/${second.id}/status`, { status: 'done' });
  const third = openInstances('Pflanzen düngen')[0];
  assert.equal(third.due_date, dayKey(7));
});

test('POST/PUT: der Anker reist über die Route und lässt sich wieder abschalten', async () => {
  const created = await call('POST', '/', {
    title: 'Zahnbürstenkopf wechseln', is_recurring: 1,
    recurrence_rule: 'FREQ=MONTHLY', recurrence_from_completion: 1,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.recurrence_from_completion, 1);

  const updated = await call('PUT', `/${created.body.data.id}`, {
    title: 'Zahnbürstenkopf wechseln', recurrence_from_completion: 0,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.recurrence_from_completion, 0);
  // Und ohne das Feld im Body bleibt der gespeicherte Wert stehen.
  const untouched = await call('PUT', `/${created.body.data.id}`, { title: 'Zahnbürstenkopf wechseln' });
  assert.equal(untouched.body.data.recurrence_from_completion, 0);
});

test('PATCH done: ohne Anker bleibt es beim bisherigen Verhalten', async () => {
  const id = insertTask({
    title: 'Müllabfuhr', status: 'open', due_date: dayKey(-3), created_by: uid,
    is_recurring: 1, recurrence_rule: 'FREQ=WEEKLY',
  });
  await call('PATCH', `/${id}/status`, { status: 'done' });
  assert.equal(openInstances('Müllabfuhr')[0].due_date, dayKey(4));
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
