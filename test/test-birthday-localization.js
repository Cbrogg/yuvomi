/**
 * Test: Geburtstags-Lokalisierung im Kalender (Issues #524, #631, #632)
 *
 * Zwei Schichten, die zusammengehören:
 *
 * 1. Kalender-Read (#524): Der Read MUSS bei Geburtstags-Terminen birthday_name
 *    (+ birthday_date) über den LEFT JOIN auf birthdays mitliefern - und bei
 *    Nicht-Geburtstagen NICHT. Darauf sitzt die clientseitige Übersetzung in
 *    public/utils/birthday-event.js.
 *
 * 2. Gespeicherter Titel (#631, #632): Der Titel in calendar_events ist das, was
 *    REST-API, ICS-Feed, CalDAV-/Google-Outbound und der FTS-Index zu sehen
 *    bekommen - keiner dieser Kanäle durchläuft die Client-Übersetzung. Er wird
 *    deshalb in der Datensprache des Haushalts geschrieben (`language` in
 *    sync_config, ersatzweise aus `region` abgeleitet, sonst Englisch). Ein
 *    Wechsel der Sprache MUSS die Bestandstermine nachziehen, sonst steht in
 *    externen Kalendern noch monatelang die alte Fassung.
 *
 * Geprüft wird der echte Vertrag über Birthdays-, Kalender- und
 * Preferences-Router auf der migrierten DB, plus buildFeed() für den ICS-Export.
 * Ausführen: node --experimental-sqlite --test test/test-birthday-localization.js
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';

const dbmod = await import('../server/db.js');
const { default: birthdaysRouter } = await import('../server/routes/birthdays.js');
const { default: calendarRouter } = await import('../server/routes/calendar.js');
const { default: preferencesRouter } = await import('../server/routes/preferences.js');
const { buildFeed } = await import('../server/services/ics-export.js');
const db = dbmod.get();

const USER = db.prepare(
  `INSERT INTO users (username, display_name, password_hash, role) VALUES ('u','U','x','member')`
).run().lastInsertRowid;

const actor = { id: USER, role: 'member' };
const app = express();
app.use(express.json({ limit: '12mb' }));
app.use((req, _res, next) => {
  req.authUserId = actor.id;
  req.authRole = actor.role;
  req.session = { userId: actor.id, role: actor.role };
  next();
});
app.use('/birthdays', birthdaysRouter);
app.use('/calendar', calendarRouter);
app.use('/preferences', preferencesRouter);
const server = app.listen(0);
const baseUrl = await new Promise((r) =>
  server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));
test.after(() => server.close());

async function call(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204/leer */ }
  return { status: res.status, body: json };
}

test('GET /calendar liefert birthday_name+birthday_date für Geburtstags-Termine', async () => {
  const created = await call('POST', '/birthdays', { name: 'Lina Müller', birth_date: '1990-05-12' });
  assert.equal(created.status, 201);

  // Serie startet am Geburtsdatum; ein weites Fenster fängt die nächste Instanz.
  const res = await call('GET', '/calendar?from=1990-01-01&to=2100-12-31');
  assert.equal(res.status, 200);

  const bday = res.body.data.find((e) => e.birthday_name);
  assert.ok(bday, 'ein Event trägt birthday_name');
  assert.equal(bday.birthday_name, 'Lina Müller');
  assert.equal(bday.birthday_date, '1990-05-12');
  // Ohne gesetzte Datensprache und ohne Region bleibt es beim englischen
  // Bestandsverhalten - ein Update darf einem Haushalt die Titel nicht still
  // unter den Füßen wegziehen.
  assert.equal(bday.title, 'Birthday: Lina Müller');
});

test('Nicht-Geburtstags-Termine tragen KEIN birthday_name-Feld', async () => {
  db.prepare(`
    INSERT INTO calendar_events (title, start_datetime, all_day, created_by, external_source)
    VALUES ('Zahnarzt', '2026-07-20', 1, ?, 'local')
  `).run(USER);

  const res = await call('GET', '/calendar?from=2026-07-01&to=2026-07-31');
  assert.equal(res.status, 200);
  const plain = res.body.data.find((e) => e.title === 'Zahnarzt');
  assert.ok(plain, 'Nicht-Geburtstags-Termin ist enthalten');
  assert.ok(!('birthday_name' in plain), 'kein birthday_name-Schlüssel bei Nicht-Geburtstagen');
});

test('de-Referenz-Locale trägt alle neuen Keys mit {{name}}-Platzhalter', () => {
  const de = JSON.parse(readFileSync(new URL('../public/locales/de.json', import.meta.url)));
  assert.match(de.birthdays.calendarEventTitle, /\{\{name\}\}/);
  assert.match(de.birthdays.calendarEventDescription, /\{\{name\}\}/);
  assert.match(de.birthdays.calendarEventDescription, /\{\{date\}\}/);
  // Fallback ohne Datum: {{name}}, aber kein {{date}} (keine leere Klammer).
  assert.match(de.birthdays.calendarEventDescriptionNoDate, /\{\{name\}\}/);
  assert.doesNotMatch(de.birthdays.calendarEventDescriptionNoDate, /\{\{date\}\}/);
});

// ---------------------------------------------------------------------------
// Datensprache des Haushalts (#631, #632)
// ---------------------------------------------------------------------------

function storedEvent(birthdayId) {
  return db.prepare(`
    SELECT e.title, e.description
    FROM birthdays b JOIN calendar_events e ON e.id = b.calendar_event_id
    WHERE b.id = ?
  `).get(birthdayId);
}

function setConfig(key, value) {
  db.prepare(`
    INSERT INTO sync_config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

/** Führt einen Aufruf als Admin aus und stellt die Mitglieds-Rolle danach wieder her. */
async function asAdmin(fn) {
  actor.role = 'admin';
  try {
    return await fn();
  } finally {
    actor.role = 'member';
  }
}

test('gesetzte Datensprache bestimmt Titel und Beschreibung des Termins', async () => {
  setConfig('language', 'de');
  setConfig('date_format', 'dmy');

  const created = await call('POST', '/birthdays', { name: 'Jonas', birth_date: '1988-03-04' });
  assert.equal(created.status, 201);

  const event = storedEvent(created.body.data.id);
  assert.equal(event.title, 'Geburtstag: Jonas');
  // Das Datum in der Beschreibung folgt der Haushalts-Einstellung date_format,
  // damit ein exportierter Termin dasselbe Datum zeigt wie die Oberfläche.
  assert.equal(event.description, 'Geburtstagserinnerung für Jonas (04.03.1988).');
});

test('ohne gesetzte Sprache leitet die Region sie ab', async () => {
  db.prepare(`DELETE FROM sync_config WHERE key = 'language'`).run();
  setConfig('region', 'fr-FR');

  const created = await call('POST', '/birthdays', { name: 'Chloé', birth_date: '1995-11-20' });
  assert.equal(created.status, 201);
  assert.equal(storedEvent(created.body.data.id).title, 'Anniversaire : Chloé');
});

test('ohne Sprache und ohne Region gilt Englisch, nicht die Referenz-Locale', async () => {
  db.prepare(`DELETE FROM sync_config WHERE key IN ('language', 'region')`).run();

  const created = await call('POST', '/birthdays', { name: 'Sam', birth_date: '2001-01-09' });
  assert.equal(created.status, 201);
  assert.equal(storedEvent(created.body.data.id).title, 'Birthday: Sam');
});

test('PUT /preferences betitelt bestehende Geburtstags-Termine um', async () => {
  db.prepare(`DELETE FROM sync_config WHERE key IN ('language', 'region')`).run();
  const created = await call('POST', '/birthdays', { name: 'Nora', birth_date: '1992-06-30' });
  assert.equal(storedEvent(created.body.data.id).title, 'Birthday: Nora');

  const saved = await asAdmin(() => call('PUT', '/preferences', { language: 'de' }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.language, 'de');
  assert.equal(saved.body.data.language_effective, 'de');
  // Ohne Region fiele die Automatik auf Englisch - das Label der
  // Automatik-Option darf nicht die gerade gewählte Sprache versprechen.
  assert.equal(saved.body.data.language_auto, 'en');

  // Der Kern von #632: der Wechsel muss die bereits gespeicherten Zeilen
  // erreichen, nicht nur künftige Termine.
  assert.equal(storedEvent(created.body.data.id).title, 'Geburtstag: Nora');
  const first = db.prepare(`SELECT id FROM birthdays ORDER BY id ASC`).get().id;
  assert.equal(storedEvent(first).title, 'Geburtstag: Lina Müller');
});

test('ICS-Feed exportiert den lokalisierten Titel', async () => {
  // Vorbedingung selbst setzen statt sie vom vorigen Test zu erben: ein
  // eingeschobener Test würde sonst diese Zusicherung still verschieben.
  await asAdmin(() => call('PUT', '/preferences', { language: 'de' }));

  const feed = buildFeed(db, USER);
  assert.match(feed, /SUMMARY:Geburtstag: Nora/);
  assert.doesNotMatch(feed, /SUMMARY:Birthday: /);
});

test('Zurück auf automatisch stellt die abgeleitete Sprache wieder her', async () => {
  setConfig('region', 'en-GB');
  const saved = await asAdmin(() => call('PUT', '/preferences', { language: null }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.language, null);
  assert.equal(saved.body.data.language_effective, 'en');

  const first = db.prepare(`SELECT id FROM birthdays ORDER BY id ASC`).get().id;
  assert.equal(storedEvent(first).title, 'Birthday: Lina Müller');
});

test('PUT /preferences weist ungültige Sprachen ab und verlangt Admin', async () => {
  const invalid = await asAdmin(() => call('PUT', '/preferences', { language: 'klingon' }));
  assert.equal(invalid.status, 400);

  const forbidden = await call('PUT', '/preferences', { language: 'de' });
  assert.equal(forbidden.status, 403, 'Mitglieder ändern keine haushaltweite Datensprache');
});

// Die Datensprache lässt sich über drei Felder verschieben. Ein Guard nur auf
// `language` deckt die Beispiele ab, nicht die Regel: `region` und `date_format`
// führen genauso in den Backfill, und `region` ist der Weg, über den ein
// Mitglied das Admin-Gate sonst umginge.

test('region allein verschiebt die Sprache bestehender Termine', async () => {
  db.prepare(`DELETE FROM sync_config WHERE key = 'language'`).run();
  setConfig('region', 'en-GB');
  await asAdmin(() => call('PUT', '/preferences', { region: 'en-GB' }));

  const first = db.prepare(`SELECT id FROM birthdays ORDER BY id ASC`).get().id;
  assert.equal(storedEvent(first).title, 'Birthday: Lina Müller');

  const saved = await asAdmin(() => call('PUT', '/preferences', { region: 'it-IT' }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.language_effective, 'it');
  assert.equal(storedEvent(first).title, 'Compleanno: Lina Müller');
});

test('region ist Mitgliedern verwehrt, sonst wäre das Sprach-Gate umgehbar', async () => {
  const forbidden = await call('PUT', '/preferences', { region: 'de-DE' });
  assert.equal(forbidden.status, 403);
  assert.equal(
    db.prepare(`SELECT value FROM sync_config WHERE key = 'region'`).get()?.value,
    'it-IT',
    'die abgewiesene Anfrage darf die Region nicht verändert haben',
  );
});

test('date_format allein zieht die Beschreibung nach', async () => {
  const first = db.prepare(`SELECT id FROM birthdays ORDER BY id ASC`).get().id;

  await asAdmin(() => call('PUT', '/preferences', { date_format: 'ymd' }));
  assert.match(storedEvent(first).description, /1990-05-12/);

  await asAdmin(() => call('PUT', '/preferences', { date_format: 'dmy' }));
  assert.match(storedEvent(first).description, /12\.05\.1990/);
});

test('gespiegelte Termine werden für den Push vorgemerkt', async () => {
  // Ein Geburtstags-Termin, den der Apple-Sync bereits hochgeladen hat: er trägt
  // danach external_source='apple' und eine Kalender-Zuordnung. Ohne den Marker
  // holt pendingUpdates() ihn nie ab und iCloud behielte den alten Titel (#632).
  const first = db.prepare(`SELECT id, calendar_event_id FROM birthdays ORDER BY id ASC`).get();
  db.prepare(`
    UPDATE calendar_events
    SET external_source = 'apple', external_calendar_id = 'oikos-test@oikos.local',
        outbound_dirty = 0
    WHERE id = ?
  `).run(first.calendar_event_id);

  await asAdmin(() => call('PUT', '/preferences', { language: 'de' }));

  const row = db.prepare('SELECT title, outbound_dirty FROM calendar_events WHERE id = ?')
    .get(first.calendar_event_id);
  assert.equal(row.title, 'Geburtstag: Lina Müller');
  assert.equal(row.outbound_dirty, 1, 'der umbenannte Termin muss zum Provider nachgezogen werden');
});

test('ein rein lokaler Termin wird nicht für den Push vorgemerkt', async () => {
  const created = await call('POST', '/birthdays', { name: 'Timo', birth_date: '1999-02-02' });
  const eventId = db.prepare('SELECT calendar_event_id AS id FROM birthdays WHERE id = ?')
    .get(created.body.data.id).id;

  await asAdmin(() => call('PUT', '/preferences', { language: 'fr' }));

  const row = db.prepare('SELECT title, outbound_dirty FROM calendar_events WHERE id = ?').get(eventId);
  assert.equal(row.title, 'Anniversaire : Timo');
  assert.equal(row.outbound_dirty, 0, 'ohne Provider-Zuordnung gibt es nichts zu pushen');
});

test('ein unveränderter Termin wird nicht erneut geschrieben', async () => {
  const first = db.prepare(`SELECT calendar_event_id AS id FROM birthdays ORDER BY id ASC`).get();
  db.prepare('UPDATE calendar_events SET outbound_dirty = 0 WHERE id = ?').run(first.id);

  // Sprache bleibt fr: derselbe Titel, also kein Schreibvorgang und kein Marker.
  await asAdmin(() => call('PUT', '/preferences', { language: 'fr' }));

  assert.equal(
    db.prepare('SELECT outbound_dirty FROM calendar_events WHERE id = ?').get(first.id).outbound_dirty,
    0,
    'ein Lauf ohne Textänderung darf keinen Push auslösen',
  );
});

test('GET /preferences liefert die drei Sprachfelder', async () => {
  const res = await call('GET', '/preferences');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.language, 'fr', 'explizit gesetzt');
  assert.equal(res.body.data.language_effective, 'fr', 'was gilt');
  assert.equal(res.body.data.language_auto, 'it', 'was die Automatik aus der Region ergäbe');
});
