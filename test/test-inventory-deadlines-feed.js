/**
 * Test: Inventar-Garantiefristen-Feed (Stufe 4)
 * Zweck: (1) Reine ICS-Erzeugung aus server/services/inventory-deadlines-ics.js -
 *        nur Gegenstände mit vollständigen Garantiedaten, ein VEVENT je
 *        Gegenstand, RFC-5545-Escaping über den bestehenden ics-export.js-Helfer.
 *        (2) Token-Lebenszyklus (get/regenerate/clear) gegen sync_config.
 *        (3) Der Verwaltungs-Router (/inventory/deadlines-feed) end-to-end.
 * Ausführen: node --experimental-sqlite --test test/test-inventory-deadlines-feed.js
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const dbmod = await import('../server/db.js');
const deadlinesIcs = await import('../server/services/inventory-deadlines-ics.js');
const { default: deadlinesFeedRouter } = await import('../server/routes/inventory/deadlines-feed.js');
const db = dbmod.get();

// Der ICS-Text folgt der Datensprache des Haushalts (sync_config.language),
// genau wie die Geburtstags-Termine - nicht mehr fest Deutsch.
function setHouseholdLanguage(language) {
  db.prepare("INSERT INTO sync_config (key, value) VALUES ('language', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(language);
}

function insertItem(fields = {}) {
  const f = { name: 'Espressomaschine', purchase_date: null, warranty_months: null, ...fields };
  return db.prepare(`
    INSERT INTO inventory_items (name, purchase_date, warranty_months)
    VALUES (@name, @purchase_date, @warranty_months)
  `).run(f).lastInsertRowid;
}

// --------------------------------------------------------
// buildInventoryDeadlinesFeed
// --------------------------------------------------------

test('buildInventoryDeadlinesFeed enthält nur Gegenstände mit vollständigen Garantiedaten', () => {
  insertItem({ name: 'Mit Garantie', purchase_date: '2026-01-01', warranty_months: 12 });
  insertItem({ name: 'Ohne Kaufdatum', warranty_months: 12 });
  insertItem({ name: 'Ohne Garantiemonate', purchase_date: '2026-01-01' });

  setHouseholdLanguage('de');
  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  assert.equal(veventCount, 1);
  assert.match(ics, /SUMMARY:Garantie endet: Mit Garantie/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270101/);
});

test('buildInventoryDeadlinesFeed escaped Sonderzeichen im Namen', () => {
  db.exec('DELETE FROM inventory_items');
  insertItem({ name: 'Kaffee; Maschine, Pro', purchase_date: '2026-06-15', warranty_months: 6 });

  setHouseholdLanguage('de');
  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  assert.match(ics, /SUMMARY:Garantie endet: Kaffee\\; Maschine\\, Pro/);
});

test('buildInventoryDeadlinesFeed überspringt unparsbare Kaufdaten statt den Feed zu sprengen', () => {
  db.exec('DELETE FROM inventory_items');
  // Kalendarisch unmögliches Datum - so etwas kam frueher durch die reine
  // Formatpruefung in server/middleware/validate.js#date. Eine einzige solche
  // Zeile darf den Feed nicht fuer alle Abonnenten stilllegen.
  insertItem({ name: 'Kaputtes Datum', purchase_date: '2026-02-30', warranty_months: 12 });
  insertItem({ name: 'Heiles Datum', purchase_date: '2026-01-01', warranty_months: 12 });

  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /Heiles Datum/);
  assert.doesNotMatch(ics, /Kaputtes Datum/);
});

test('buildInventoryDeadlinesFeed liefert ein valides VCALENDAR-Gerüst auch ohne Gegenstände', () => {
  db.exec('DELETE FROM inventory_items');
  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('buildInventoryDeadlinesFeed enthält ein VEVENT je getrackter Frist zusätzlich zu Garantien', () => {
  db.exec('DELETE FROM inventory_items');
  const itemId = insertItem({ name: 'Auto', purchase_date: '2026-01-01', warranty_months: 12 });
  db.prepare("INSERT INTO inventory_item_dates (item_id, label, date) VALUES (?, 'TÜV', '2027-03-01')").run(itemId);

  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  assert.equal(veventCount, 2, 'ein Garantie- und ein Fristen-VEVENT');
  assert.match(ics, /SUMMARY:Garantie endet: Auto/);
  assert.match(ics, /SUMMARY:TÜV: Auto/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270301/);
});

test('buildInventoryDeadlinesFeed erzeugt für einen Gegenstand ohne Garantie nur die Fristen-VEVENTs', () => {
  db.exec('DELETE FROM inventory_items');
  const itemId = insertItem({ name: 'Fahrrad' });
  db.prepare("INSERT INTO inventory_item_dates (item_id, label, date) VALUES (?, 'Wartung', '2027-05-01')").run(itemId);

  const ics = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  assert.equal(veventCount, 1);
  assert.match(ics, /SUMMARY:Wartung: Fahrrad/);
});

// --------------------------------------------------------
// Token-Lebenszyklus (sync_config)
// --------------------------------------------------------

test('Token-Lebenszyklus: null ohne Token, regenerate erzeugt, clear entfernt', () => {
  assert.equal(deadlinesIcs.getFeedToken(db), null);

  const token = deadlinesIcs.regenerateFeedToken(db);
  assert.ok(token && token.length > 20);
  assert.equal(deadlinesIcs.getFeedToken(db), token);
  assert.ok(deadlinesIcs.isValidFeedToken(db, token));
  assert.ok(!deadlinesIcs.isValidFeedToken(db, 'wrong-token'));

  const token2 = deadlinesIcs.regenerateFeedToken(db);
  assert.notEqual(token2, token);
  assert.ok(!deadlinesIcs.isValidFeedToken(db, token), 'alter Token muss ungültig werden');

  deadlinesIcs.clearFeedToken(db);
  assert.equal(deadlinesIcs.getFeedToken(db), null);
  assert.ok(!deadlinesIcs.isValidFeedToken(db, token2));
});

// --------------------------------------------------------
// Verwaltungs-Router
// --------------------------------------------------------

let actorRole = 'admin';
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.authRole = actorRole; next(); });
app.use('/inventory/deadlines-feed', deadlinesFeedRouter);
const server = app.listen(0);
const baseUrl = await new Promise((r) => server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));
test.after(() => server.close());

async function call(method, path, { as = 'admin' } = {}) {
  actorRole = as;
  const res = await fetch(`${baseUrl}${path}`, { method });
  let json = null;
  try { json = await res.json(); } catch { /* leer */ }
  return { status: res.status, body: json };
}

test('GET /deadlines-feed liefert null ohne aktiven Feed', async () => {
  deadlinesIcs.clearFeedToken(db);
  const r = await call('GET', '/inventory/deadlines-feed');
  assert.equal(r.status, 200);
  assert.equal(r.body.data, null);
});

test('POST /deadlines-feed/regenerate aktiviert den Feed, GET liefert ihn danach', async () => {
  const r = await call('POST', '/inventory/deadlines-feed/regenerate');
  assert.equal(r.status, 200);
  assert.ok(r.body.data.token);
  assert.match(r.body.data.url, /\/feed\/inventory-deadlines\/.+\.ics$/);

  const get = await call('GET', '/inventory/deadlines-feed');
  assert.equal(get.body.data.token, r.body.data.token);
});

test('DELETE /deadlines-feed deaktiviert den Feed', async () => {
  await call('POST', '/inventory/deadlines-feed/regenerate');
  const del = await call('DELETE', '/inventory/deadlines-feed');
  assert.equal(del.status, 200);
  assert.equal(del.body.data.token, null);

  const get = await call('GET', '/inventory/deadlines-feed');
  assert.equal(get.body.data, null);
});

test('Nicht-Admins duerfen den Feed weder lesen noch rotieren noch abschalten', async () => {
  // Das Token ist ein haushaltweites Artefakt, seine Oberflaeche ist admin-only
  // registriert - die rohe API muss dieselbe Grenze ziehen.
  await call('POST', '/inventory/deadlines-feed/regenerate');
  for (const [method, path] of [
    ['GET', '/inventory/deadlines-feed'],
    ['POST', '/inventory/deadlines-feed/regenerate'],
    ['DELETE', '/inventory/deadlines-feed'],
  ]) {
    const r = await call(method, path, { as: 'member' });
    assert.equal(r.status, 403, `${method} ${path} sollte 403 liefern`);
  }
  // Der Feed muss die abgewiesenen Zugriffe unveraendert ueberstehen.
  const get = await call('GET', '/inventory/deadlines-feed');
  assert.ok(get.body.data.token);
});

test('Feed-Texte folgen der Haushaltssprache statt fest deutsch zu sein', () => {
  db.exec('DELETE FROM inventory_items');
  insertItem({ name: 'Espressomaschine', purchase_date: '2026-01-01', warranty_months: 12 });

  setHouseholdLanguage('de');
  const de = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  assert.match(de, /X-WR-CALNAME:Yuvomi Inventar/);
  assert.match(de, /SUMMARY:Garantie endet: Espressomaschine/);

  setHouseholdLanguage('en');
  const en = deadlinesIcs.buildInventoryDeadlinesFeed(db);
  assert.match(en, /X-WR-CALNAME:Yuvomi Inventory/);
  assert.match(en, /SUMMARY:Warranty ends: Espressomaschine/);
});
