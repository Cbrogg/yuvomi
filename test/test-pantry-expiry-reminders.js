/**
 * Test: Vorrat-Ablauferinnerungen (#811)
 * Zweck: End-to-End über den echten Pantry-Router - Erinnerungs-Lebenszyklus
 *        (löschen+neu anlegen bei jedem Schreibvorgang, wie
 *        server/routes/inventory/items.js#syncReminder):
 *          - genau eine Erinnerung, Ersteller = created_by, wenn ein MHD
 *            gesetzt ist und der Termin noch nicht fällig wäre
 *          - der Vorlauf ist EXPIRY_SOON_DAYS, dieselbe Zahl, die den Chip
 *            "läuft bald ab" auslöst
 *          - kein MHD -> keine Erinnerung (das Datum ist der Schalter)
 *          - Menge 0 -> keine Erinnerung: verbraucht ist nichts mehr zu retten,
 *            und der ±-Stepper (PATCH) räumt sie deshalb ab und legt sie beim
 *            Auffüllen wieder an
 *          - Termin in der Vergangenheit -> keine Erinnerung (kein Nachtrags-
 *            Nagging bei kurz vor dem Ablauf nachgetragenem Bestand)
 *          - PUT/PATCH ersetzen die Erinnerung vollständig
 *          - DELETE /:itemId räumt sie explizit ab (reminders hat keinen FK)
 *          - der Import aus der Einkaufsliste legt sie für beide Wege an
 *            (neue Zeile UND aufgefüllte Charge)
 *          - GET /reminders/pending löst den Titel über den Join auf
 * Ausführen: node --experimental-sqlite --test test/test-pantry-expiry-reminders.js
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const dbmod = await import('../server/db.js');
const { default: pantryRouter } = await import('../server/routes/pantry.js');
const { default: remindersRouter } = await import('../server/routes/reminders.js');
const { syncAllPantryExpiryReminders } = await import('../server/services/pantry-reminders.js');
const db = dbmod.get();

/**
 * Der Vorlauf steht hier als Zahl, nicht als Import: public/utils/pantry-status.js
 * importiert `/utils/date.js` als Browser-Wurzelpfad und laesst sich in Node
 * nicht laden. Diese Suite prueft deshalb den konkreten Wert; dass Client und
 * Server DIESELBE Zahl meinen, haelt der Guard in test/test-frontend-audit.js
 * ("der Vorlauf der Ablauferinnerung ist die Schwelle des Chips") zusammen.
 */
const EXPIRY_SOON_DAYS = 7;

const A = db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('a','A','x','member')").run().lastInsertRowid;

let actor = { id: A };
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.authUserId = actor.id; req.session = { userId: actor.id }; next(); });
app.use('/pantry', pantryRouter);
app.use('/reminders', remindersRouter);
const server = app.listen(0);
const baseUrl = await new Promise((r) => server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));
test.after(() => server.close());

async function call(method, path, { as = { id: A }, body } = {}) {
  actor = as;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204/leer */ }
  return { status: res.status, body: json };
}

function reminderFor(itemId) {
  return db.prepare(
    "SELECT * FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?"
  ).get(itemId);
}

function countReminders(itemId) {
  return db.prepare(
    "SELECT COUNT(*) AS c FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?"
  ).get(itemId).c;
}

/**
 * Bezugstag EINMAL festhalten, nicht je Aufruf neu: ein Lauf, der ueber
 * Mitternacht UTC faellt, bekaeme sonst zwei verschiedene "heute" und die
 * Terminzusage waere um einen Tag daneben.
 *
 * Und bewusst in UTC: `reminderDateBefore()` rechnet rein arithmetisch auf dem
 * Datumsschluessel, ohne je nach "heute" zu fragen - der Test spiegelt genau
 * diese Rechnung. Der einzige zeitabhaengige Teil ist "liegt der Termin schon
 * hinter uns", und dafuer sind die Abstaende hier weit genug gewaehlt, dass
 * keine Zeitzone sie kippen kann.
 */
const TODAY_UTC = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; })();

/** Tagesschlüssel `days` Tage nach dem Bezugstag. */
function dateKeyInDays(days) {
  const d = new Date(TODAY_UTC);
  d.setUTCDate(d.getUTCDate() + days);
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')].join('-');
}

// Weit genug in der Zukunft, dass der Erinnerungstermin (MHD minus Vorlauf)
// sicher noch bevorsteht.
const FUTURE_EXPIRY = dateKeyInDays(EXPIRY_SOON_DAYS + 30);

test('POST mit MHD legt genau eine Erinnerung an, mit dem Vorlauf des Chips', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Joghurt', quantity: 2, expires_on: FUTURE_EXPIRY } });
  assert.equal(res.status, 201);

  const reminder = reminderFor(res.body.data.id);
  assert.ok(reminder, 'ohne Erinnerung meldet das MHD nie etwas');
  assert.equal(reminder.created_by, A, 'die Meldung gehört dem, der den Artikel eingetragen hat');
  assert.equal(countReminders(res.body.data.id), 1);

  // Der Vorlauf ist die Zahl aus public/utils/pantry-status.js, nicht irgendeine.
  assert.equal(reminder.remind_at, `${dateKeyInDays(30)}T09:00`,
    `der Termin muss ${EXPIRY_SOON_DAYS} Tage vor dem MHD liegen`);
  // Naiv-UTC, kein Zeitzonen-Suffix - sonst rechnet public/utils/reminder-offset.js
  // einen zweiten Offset obendrauf.
  assert.doesNotMatch(reminder.remind_at, /[zZ]|[+-]\d{2}:?\d{2}$/);
});

test('POST ohne MHD legt keine Erinnerung an - das Datum ist der Schalter', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Salz', quantity: 1 } });
  assert.equal(res.status, 201);
  assert.equal(countReminders(res.body.data.id), 0);
});

test('ein MHD, dessen Vorlauf schon verstrichen ist, meldet nicht nachträglich', async () => {
  // Morgen ablaufend: der Termin (7 Tage davor) liegt hinter uns.
  const res = await call('POST', '/pantry', { body: { name: 'Milch', quantity: 1, expires_on: dateKeyInDays(1) } });
  assert.equal(res.status, 201);
  assert.equal(countReminders(res.body.data.id), 0,
    'sonst meldet der nächste Push-Lauf sofort, was der Nutzer gerade eingetragen hat');
});

test('Menge 0 bekommt keine Erinnerung, das Auffüllen holt sie zurück', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Butter', quantity: 0, expires_on: FUTURE_EXPIRY } });
  assert.equal(res.status, 201);
  const id = res.body.data.id;
  assert.equal(countReminders(id), 0, 'eine leere Packung hat nichts mehr zu retten');

  const refilled = await call('PATCH', `/pantry/${id}`, { body: { quantity: 3 } });
  assert.equal(refilled.status, 200);
  assert.equal(countReminders(id), 1, 'aufgefüllt ist das MHD wieder relevant');
});

test('der ±-Stepper auf 0 räumt die Erinnerung ab', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Sahne', quantity: 1, expires_on: FUTURE_EXPIRY } });
  const id = res.body.data.id;
  assert.equal(countReminders(id), 1);

  await call('PATCH', `/pantry/${id}`, { body: { quantity: 0 } });
  assert.equal(countReminders(id), 0);
});

test('PUT ersetzt die Erinnerung vollständig statt sie zu verdoppeln', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Käse', quantity: 1, expires_on: FUTURE_EXPIRY } });
  const id = res.body.data.id;
  const before = reminderFor(id);

  const later = dateKeyInDays(EXPIRY_SOON_DAYS + 60);
  const put = await call('PUT', `/pantry/${id}`, { body: { name: 'Käse', quantity: 1, expires_on: later } });
  assert.equal(put.status, 200);

  assert.equal(countReminders(id), 1, 'kein Diffing, kein Duplikat');
  const after = reminderFor(id);
  assert.notEqual(after.remind_at, before.remind_at);
  assert.equal(after.remind_at, `${dateKeyInDays(60)}T09:00`);
});

test('PUT das das MHD entfernt räumt die Erinnerung ab', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Quark', quantity: 1, expires_on: FUTURE_EXPIRY } });
  const id = res.body.data.id;
  assert.equal(countReminders(id), 1);

  await call('PUT', `/pantry/${id}`, { body: { name: 'Quark', quantity: 1, expires_on: null } });
  assert.equal(countReminders(id), 0);
});

test('DELETE /:itemId räumt die Erinnerung mit ab', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Skyr', quantity: 1, expires_on: FUTURE_EXPIRY } });
  const id = res.body.data.id;
  assert.equal(countReminders(id), 1);

  const del = await call('DELETE', `/pantry/${id}`);
  assert.equal(del.status, 204);
  // reminders hat keinen FK auf pantry_items (entity_id ist polymorph) - ohne
  // das explizite Aufräumen bliebe eine Meldung ohne Artikel zurück.
  assert.equal(countReminders(id), 0);
});

test('der Import aus der Einkaufsliste legt für beide Wege eine Erinnerung an', async () => {
  const listId = db.prepare("INSERT INTO shopping_lists (name, created_by) VALUES ('Woche', ?)").run(A).lastInsertRowid;
  const mkChecked = (name) => db.prepare(
    "INSERT INTO shopping_items (list_id, name, category, is_checked) VALUES (?, ?, 'Sonstiges', 1)"
  ).run(listId, name).lastInsertRowid;

  // Weg 1: neue Zeile.
  const fresh = mkChecked('Frischkäse');
  const first = await call('POST', '/pantry/import-shopping', {
    body: { list_id: listId, items: [{ shopping_item_id: fresh, quantity: 1, expires_on: FUTURE_EXPIRY }] },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.added, 1);
  const created = db.prepare('SELECT id FROM pantry_items WHERE name = ?').get('Frischkäse');
  assert.equal(countReminders(created.id), 1, 'ein importierter Artikel meldet wie ein von Hand angelegter');

  // Weg 2: dieselbe Charge auffüllen, nachdem sie ausgebucht wurde.
  await call('PATCH', `/pantry/${created.id}`, { body: { quantity: 0 } });
  assert.equal(countReminders(created.id), 0);

  const again = mkChecked('Frischkäse');
  const second = await call('POST', '/pantry/import-shopping', {
    body: { list_id: listId, items: [{ shopping_item_id: again, quantity: 2, expires_on: FUTURE_EXPIRY }] },
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.data.merged, 1, 'gleiches MHD = dieselbe Charge');
  assert.equal(countReminders(created.id), 1, 'die aufgefüllte Charge meldet wieder');
});

test('GET /reminders/pending löst den Titel für pantry_item über den Join auf', async () => {
  const res = await call('POST', '/pantry', { body: { name: 'Hafermilch', quantity: 1, expires_on: FUTURE_EXPIRY } });
  const id = res.body.data.id;
  // Fällig stellen, ohne auf die Uhr zu warten.
  db.prepare("UPDATE reminders SET remind_at = '2000-01-01T09:00' WHERE entity_type = 'pantry_item' AND entity_id = ?").run(id);

  const pending = await call('GET', '/reminders/pending');
  assert.equal(pending.status, 200);
  const match = pending.body.data.find((r) => r.entity_type === 'pantry_item' && r.entity_id === id);
  assert.ok(match, 'die fällige Erinnerung fehlt in /pending');
  assert.equal(match.entity_title, 'Hafermilch',
    'ohne den pantry_item-Zweig im CASE käme entity_title als NULL an und der Toast zeigte den Ersatztext');
});

test('POST /reminders akzeptiert pantry_item als entity_type', async () => {
  const item = await call('POST', '/pantry', { body: { name: 'Pesto', quantity: 1 } });
  const res = await call('POST', '/reminders', {
    body: { entity_type: 'pantry_item', entity_id: item.body.data.id, remind_at: '2099-01-01T09:00' },
  });
  assert.equal(res.status, 201, 'ohne den Eintrag in VALID_ENTITY_TYPES antwortet die Route 400');
});

// --------------------------------------------------------------------------
// DER BESTAND, DEN NIEMAND MEHR ANFASST
//
// Der Router legt die Erinnerung beim Speichern an. Ein Vorrat, der schon vor
// diesem Feature im Regal stand, wird nie gespeichert - ohne den Voll-Sync
// haette genau das unberuehrte Glas hinten im Regal nie gemeldet, also der
// Fall, fuer den #811 ueberhaupt gestellt wurde.
// --------------------------------------------------------------------------
test('der Voll-Sync holt Bestandsartikel nach, die nie durch den Router liefen', () => {
  // Direkt in die Tabelle geschrieben - genau die Lage nach einem Update.
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Marmelade', 2, 'jar', 'Sonstiges', ?, ?)"
  ).run(FUTURE_EXPIRY, A).lastInsertRowid;
  assert.equal(countReminders(id), 0, 'ein direkter INSERT laeuft an syncReminder vorbei - das ist der Ausgangspunkt');

  syncAllPantryExpiryReminders(db);
  assert.equal(countReminders(id), 1, 'nach dem Lauf meldet auch der Altbestand');
  assert.equal(reminderFor(id).remind_at, `${dateKeyInDays(30)}T09:00`);
});

test('der Voll-Sync fasst eine bereits zugestellte Erinnerung nicht an', () => {
  // DER FEHLER, DEN DIESER TEST FESTHAELT: der erste Wurf des Voll-Syncs loeschte
  // und legte neu an, wie es der Router tut. Damit fiel bei JEDEM Durchgang
  // `pushed_at` auf NULL zurueck - dieselbe Meldung waere im Minutentakt wieder
  // rausgegangen, und ein Wegwischen haette bis zum naechsten Lauf gehalten.
  //
  // Der Router darf ersetzen, weil er weiss, dass sich der Artikel geaendert
  // hat. Dieser Lauf weiss das nicht und ergaenzt deshalb nur.
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Reis', 1, 'pkg', 'Sonstiges', ?, ?)"
  ).run(FUTURE_EXPIRY, A).lastInsertRowid;
  syncAllPantryExpiryReminders(db);

  const before = reminderFor(id);
  db.prepare("UPDATE reminders SET pushed_at = '2026-08-01T09:00:00Z', dismissed = 1 WHERE id = ?").run(before.id);

  syncAllPantryExpiryReminders(db);

  const after = reminderFor(id);
  assert.equal(after.id, before.id, 'die Zeile wurde ersetzt statt in Ruhe gelassen');
  assert.equal(after.pushed_at, '2026-08-01T09:00:00Z', 'zurueckgesetztes pushed_at = dieselbe Meldung nochmal');
  assert.equal(after.dismissed, 1, 'zurueckgesetztes dismissed = das Wegwischen haelt nicht');
});

test('der Voll-Sync ist idempotent - zweimal laufen heisst nicht zwei Meldungen', () => {
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Honig', 1, 'jar', 'Sonstiges', ?, ?)"
  ).run(FUTURE_EXPIRY, A).lastInsertRowid;

  syncAllPantryExpiryReminders(db);
  syncAllPantryExpiryReminders(db);
  assert.equal(countReminders(id), 1);
});

test('der Voll-Sync raeumt ab, was die Bedingungen nicht mehr erfuellt', () => {
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Senf', 1, 'jar', 'Sonstiges', ?, ?)"
  ).run(FUTURE_EXPIRY, A).lastInsertRowid;
  syncAllPantryExpiryReminders(db);
  assert.equal(countReminders(id), 1);

  // Menge am Router vorbei auf 0 gesetzt: die Erinnerung muss trotzdem gehen.
  db.prepare('UPDATE pantry_items SET quantity = 0 WHERE id = ?').run(id);
  syncAllPantryExpiryReminders(db);
  assert.equal(countReminders(id), 0);
});

test('ein Artikel ohne Ersteller bekommt keine Erinnerung - es gaebe keinen Empfaenger', () => {
  // created_by ist seit Migration v109 nullable: wer ein Mitglied loescht,
  // verliert nicht den Haushaltsvorrat. reminders.created_by ist NOT NULL.
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Kapern', 1, 'jar', 'Sonstiges', ?, NULL)"
  ).run(FUTURE_EXPIRY).lastInsertRowid;
  syncAllPantryExpiryReminders(db);
  assert.equal(countReminders(id), 0);
});

// --------------------------------------------------------------------------
// EIN KAPUTTES DATUM DARF DEN SPEICHERVORGANG NICHT SPRENGEN
// --------------------------------------------------------------------------
test('ein kalendarisch unmoegliches MHD verhindert nur die Meldung, nicht das Speichern', async () => {
  // '2027-02-30' passiert die Form, nicht den Kalender. Bestandszeilen aus der
  // Zeit vor der kalendarischen Pruefung im Import koennen so aussehen.
  const id = db.prepare(
    "INSERT INTO pantry_items (name, quantity, unit, category, expires_on, created_by) VALUES ('Altbestand', 1, 'pcs', 'Sonstiges', '2027-02-30', ?)"
  ).run(A).lastInsertRowid;

  // Ohne den Auffangzweig wirft die Rechnung mitten in der Transaktion: der
  // Artikel bliebe dauerhaft unbearbeitbar.
  const res = await call('PATCH', `/pantry/${id}`, { body: { quantity: 5 } });
  assert.equal(res.status, 200, 'ein alter Datensatz darf nicht unbearbeitbar werden');
  assert.equal(res.body.data.quantity, 5);
  assert.equal(countReminders(id), 0);

  // Und der Voll-Sync stirbt nicht an dieser Zeile.
  assert.doesNotThrow(() => syncAllPantryExpiryReminders(db));
});

test('der Import uebergeht ein kalendarisch unmoegliches MHD, statt alles zurueckzurollen', async () => {
  const listId = db.prepare("INSERT INTO shopping_lists (name, created_by) VALUES ('Import', ?)").run(A).lastInsertRowid;
  const mk = (name) => db.prepare(
    "INSERT INTO shopping_items (list_id, name, category, is_checked) VALUES (?, ?, 'Sonstiges', 1)"
  ).run(listId, name).lastInsertRowid;

  const bad = mk('Schlechtes Datum');
  const good = mk('Gutes Datum');
  const res = await call('POST', '/pantry/import-shopping', {
    body: {
      list_id: listId,
      items: [
        { shopping_item_id: bad, quantity: 1, expires_on: '2027-02-30' },
        { shopping_item_id: good, quantity: 1, expires_on: FUTURE_EXPIRY },
      ],
    },
  });

  // Vor der kalendarischen Pruefung riss die erste Zeile die zweite mit: 500,
  // Transaktion zurueckgerollt, auch der gueltige Artikel weg.
  assert.equal(res.status, 200);
  assert.equal(res.body.data.added, 2, 'beide Artikel landen im Vorrat');

  const badRow = db.prepare('SELECT * FROM pantry_items WHERE name = ?').get('Schlechtes Datum');
  assert.equal(badRow.expires_on, null, 'das unmoegliche Datum wird nicht gespeichert');
  assert.equal(countReminders(badRow.id), 0);

  const goodRow = db.prepare('SELECT * FROM pantry_items WHERE name = ?').get('Gutes Datum');
  assert.equal(goodRow.expires_on, FUTURE_EXPIRY);
  assert.equal(countReminders(goodRow.id), 1);
});
