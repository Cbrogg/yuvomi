/**
 * Test: Beleg-Ordner der Gemeinsamen Ausgaben traegt den Modulnamen (Migration v146)
 * Zweck: EIN MODUL, EIN NAME - der Zielordner der Belege hiess in elf von
 *        vierundzwanzig Sprachen anders als das Modul selbst. Mit dem Rename
 *        des Locale-Werts allein bekaeme jeder Bestandshaushalt beim naechsten
 *        Beleg einen ZWEITEN Ordner, weil `ensureFolder`
 *        (server/routes/documents.js) den Ordner ueber seinen NAMEN sucht und
 *        sonst anlegt. Drei Faelle muessen stimmen:
 *        (1) Bestandsordner mit altem Namen wird umbenannt, seine Dokumente
 *            bleiben daran haengen (die Migration fasst `id` nicht an).
 *        (2) Existiert der Zielname bereits, wird NICHT umbenannt - zwei
 *            gleichnamige Ordner waeren schlimmer als ein alt benannter, weil
 *            `ensureFolder` den ersten Treffer nimmt und welcher das ist an der
 *            Zeilenreihenfolge haengt.
 *        (3) Der Fall, in dem sich alt und neu NUR in der Grossschreibung
 *            unterscheiden (id: "Pengeluaran bersama" -> "Pengeluaran
 *            Bersama"), wird trotzdem umbenannt. `COLLATE NOCASE` findet dort
 *            den Quellordner als seinen eigenen Konflikt; ohne den
 *            id-Vergleich in der Migration bliebe ausgerechnet der
 *            harmloseste Fall ungefixt.
 * Ausführen: node --experimental-sqlite --test test/test-split-folder-rename-migration.js
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const dbmod = await import('../server/db.js');
const migration146 = dbmod.MIGRATIONS.find((m) => m.version === 146);

/** Nur die eine Tabelle, die die Migration anfasst. */
function folders(rows = []) {
  const conn = new DatabaseSync(':memory:');
  conn.exec(`
    CREATE TABLE family_document_folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      created_by INTEGER
    );
  `);
  const insert = conn.prepare('INSERT INTO family_document_folders (name) VALUES (?)');
  for (const name of rows) insert.run(name);
  return conn;
}

const names = (conn) => conn.prepare('SELECT id, name FROM family_document_folders ORDER BY id').all();

test('ein Bestandsordner mit altem Namen wird umbenannt und behaelt seine id', () => {
  const conn = folders(['Belege', 'Geteilte Ausgaben', 'Inventar']);
  const before = names(conn).find((f) => f.name === 'Geteilte Ausgaben');

  migration146.up(conn);

  const after = names(conn);
  assert.deepEqual(after.map((f) => f.name), ['Belege', 'Gemeinsame Ausgaben', 'Inventar']);
  // Die id ist der Grund, warum ueberhaupt umbenannt und nicht neu angelegt
  // wird: `family_documents.folder_id` zeigt darauf. Ein neuer Ordner haette
  // die Belege zurueckgelassen.
  assert.equal(after.find((f) => f.name === 'Gemeinsame Ausgaben').id, before.id);
});

test('existiert der Zielname schon, bleibt der alte Ordner unberuehrt', () => {
  const conn = folders(['Geteilte Ausgaben', 'Gemeinsame Ausgaben']);

  migration146.up(conn);

  assert.deepEqual(names(conn).map((f) => f.name), ['Geteilte Ausgaben', 'Gemeinsame Ausgaben'],
    'zwei gleichnamige Ordner waeren schlimmer als einer mit altem Namen');
});

test('der Fall, der sich nur in der Grossschreibung unterscheidet, wird trotzdem umbenannt', () => {
  const conn = folders(['Pengeluaran bersama']);

  migration146.up(conn);

  assert.deepEqual(names(conn).map((f) => f.name), ['Pengeluaran Bersama'],
    'COLLATE NOCASE findet hier den Quellordner als seinen eigenen Konflikt - '
    + 'die Migration muss die eigene id ausschliessen');
});

test('eine Datenbank ohne passenden Ordner bleibt unveraendert', () => {
  const conn = folders(['Belege', 'Vertraege']);

  migration146.up(conn);

  assert.deepEqual(names(conn).map((f) => f.name), ['Belege', 'Vertraege']);
});

test('jede Sprache ist abgedeckt: die Migration kennt jeden Namen, den ein Ordner heute traegt', () => {
  // Reichweiten-Nachweis. Ohne ihn kann die Paarliste eine Sprache verlieren
  // (oder nie bekommen haben) und der Guard bliebe gruen, weil er nur die
  // Sprachen prueft, die er selbst aufzaehlt.
  const locales = readdirSync(new URL('../public/locales/', import.meta.url)).filter((f) => f.endsWith('.json'));
  assert.ok(locales.length >= 20, `nur ${locales.length} Locales gefunden - Pfad veraltet?`);

  const uncovered = [];
  for (const file of locales) {
    const data = JSON.parse(readFileSync(new URL(`../public/locales/${file}`, import.meta.url), 'utf8'));
    const title = data.splitExpenses?.title;
    assert.ok(title, `${file}: splitExpenses.title fehlt`);

    // Dass der Locale-Wert des Ordners dem Modulnamen GLEICHT, prueft
    // `test:i18n` ("der Beleg-Ordner der Gemeinsamen Ausgaben heisst wie das
    // Modul") - dort gehoert die Regel hin, weil sie fuer jede kuenftige
    // Uebersetzung gilt und nicht fuer diesen einen Migrationslauf.
    //
    // Hier zaehlt die andere Richtung: die Migration darf keinen Namen
    // anfassen, der heute schon kanonisch ist. Ein Paar, dessen linke Seite
    // versehentlich ein aktueller Titel waere, benaenne bei jedem Upgrade
    // fleissig etwas Richtiges in etwas Falsches um.
    const conn = folders([title]);
    migration146.up(conn);
    if (names(conn)[0].name !== title) uncovered.push(`${file}: ${title}`);
  }
  assert.deepEqual(uncovered, [], `Migration benennt einen bereits kanonischen Namen um:\n  ${uncovered.join('\n  ')}`);
});
