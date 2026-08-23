/**
 * Test: Systemordner werden über einen Schlüssel gefunden (Migration v157)
 * Zweck: Bis v157 war die IDENTITÄT eines Modul-Ordners sein übersetzter
 *        Anzeigename, und den schickte der Client mit. Daraus folgten drei
 *        Fehler derselben Sorte: zwei Sprachen im Haushalt ergaben zwei Ordner,
 *        jede Übersetzungskorrektur spaltete den Ordner erneut (v146 musste das
 *        einmal aufräumen), und ein Tippfehler im Anzeigetext war ein
 *        Daten-Fehler. `module_key` trägt die Identität, der Name ist Anzeige.
 *
 *        Geprüft wird beides: dass die Migration Bestandsordner richtig
 *        zuordnet, und dass `ensureModuleFolder` danach keinen zweiten Ordner
 *        mehr anlegt - egal in welcher Sprache gefragt wird.
 * Ausführen: npm run test:document-folder-keys
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const dbmod = await import('../server/db.js');
const migration157 = dbmod.MIGRATIONS.find((m) => m.version === 157);
const { ensureModuleFolder, MODULE_FOLDER_KEYS, isModuleFolderKey } =
  await import('../server/services/document-folders.js');

const ACTOR = 1;

/**
 * Die Tabelle so, wie die Migration sie vorfindet - MIT dem `UNIQUE` auf
 * `name` (Migration 60). Ohne das Constraint wäre die Suite grün, während ein
 * echter Haushalt beim Anlegen abbräche; genau diese Lücke hatte die erste
 * Fassung des v146-Tests (PR #788).
 */
function folders(rows = []) {
  const conn = new DatabaseSync(':memory:');
  conn.exec(`
    CREATE TABLE family_document_folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_by INTEGER
    );
  `);
  const insert = conn.prepare('INSERT INTO family_document_folders (name) VALUES (?)');
  for (const name of rows) insert.run(name);
  return conn;
}

const rows = (conn) => conn.prepare(
  'SELECT id, name, module_key FROM family_document_folders ORDER BY id',
).all();

// --------------------------------------------------------
// Migration
// --------------------------------------------------------

test('die Migration bindet Bestandsordner an ihren Schluessel', () => {
  const conn = folders(['Belege', 'Gemeinsame Ausgaben', 'Inventar', 'Urlaub 2026']);

  migration157.up(conn);

  const byName = Object.fromEntries(rows(conn).map((f) => [f.name, f.module_key]));
  assert.equal(byName['Belege'], 'budget');
  assert.equal(byName['Gemeinsame Ausgaben'], 'splitExpenses');
  assert.equal(byName['Inventar'], 'inventory');
  // Ein selbst angelegter Ordner bleibt einer: kein Schluessel, keine Regel.
  assert.equal(byName['Urlaub 2026'], null);
});

test('die Migration erkennt den Ordner in jeder Sprache', () => {
  // Der Haushalt hat auf Japanisch angefangen. Ohne die ausgeschriebene
  // Namensliste bliebe sein Beleg-Ordner ungebunden, und der naechste Upload
  // legte daneben einen zweiten an.
  const conn = folders(['領収書', 'Чеки']);

  migration157.up(conn);

  const claimed = rows(conn).filter((f) => f.module_key === 'budget');
  assert.equal(claimed.length, 1, 'genau ein Ordner darf den Schluessel tragen');
  assert.equal(claimed[0].name, '領収書', 'der aelteste Treffer bekommt ihn');
});

test('zwei Sprachordner nebeneinander: der aeltere bekommt den Schluessel, der andere bleibt stehen', () => {
  const conn = folders(['Receipts', 'Belege']);

  migration157.up(conn);

  const after = rows(conn);
  assert.deepEqual(after.map((f) => f.module_key), ['budget', null]);
  // Zusammenlegen waere eine Entscheidung ueber fremde Dokumente. Die trifft
  // eine Migration nicht - der zweite Ordner behaelt Namen und Inhalt.
  assert.deepEqual(after.map((f) => f.name), ['Receipts', 'Belege']);
});

test('der Schluessel ist eindeutig - ein zweiter Ordner kann ihn nicht bekommen', () => {
  const conn = folders(['Belege']);
  migration157.up(conn);

  conn.prepare('INSERT INTO family_document_folders (name) VALUES (?)').run('Kassenzettel');
  assert.throws(
    () => conn.prepare('UPDATE family_document_folders SET module_key = ? WHERE name = ?')
      .run('budget', 'Kassenzettel'),
    /UNIQUE/,
    'ohne den Index koennten zwei Ordner denselben Zweck beanspruchen',
  );
});

test('die Namensliste der Migration deckt jede ausgelieferte Uebersetzung ab', () => {
  // Reichweiten-Nachweis. Faellt eine Sprache aus der Liste, bleibt ihr
  // Bestandsordner ungebunden - und der Fehler zeigt sich erst Jahre spaeter
  // an einem doppelten Ordner, nie hier.
  const locales = readdirSync(new URL('../public/locales', import.meta.url))
    .filter((f) => f.endsWith('.json'));
  assert.ok(locales.length >= 20, `zu wenige Locales gefunden (${locales.length})`);

  const ungebunden = [];
  for (const file of locales) {
    const json = JSON.parse(readFileSync(new URL(`../public/locales/${file}`, import.meta.url), 'utf8'));
    for (const key of MODULE_FOLDER_KEYS) {
      const name = json.documents?.[`${key}Folder`];
      if (!name) { ungebunden.push(`${file}: documents.${key}Folder fehlt`); continue; }

      const conn = folders([name]);
      migration157.up(conn);
      const [row] = rows(conn);
      if (row.module_key !== key) {
        ungebunden.push(`${file}: ${JSON.stringify(name)} -> ${row.module_key ?? 'nichts'} statt ${key}`);
      }
      conn.close();
    }
  }
  assert.deepEqual(ungebunden, [],
    `Bestandsordner, die die Migration nicht findet:\n  ${ungebunden.join('\n  ')}`);
});

// --------------------------------------------------------
// Auflösung im Betrieb
// --------------------------------------------------------

function migrated(rows = []) {
  const conn = folders(rows);
  migration157.up(conn);
  return conn;
}

test('derselbe Schluessel in zwei Sprachen trifft denselben Ordner', () => {
  const conn = migrated(['Belege']);

  // Dieselbe Anfrage, wie sie von einer deutschen und einer englischen
  // Oberflaeche kaeme. Vor v157 waren das zwei Ordner mit je der Haelfte der
  // Belege - im mehrsprachigen Haushalt der Normalfall, nicht der Randfall.
  const a = ensureModuleFolder(conn, { key: 'budget', name: 'Belege' }, ACTOR);
  const b = ensureModuleFolder(conn, { key: 'budget', name: 'Receipts' }, ACTOR);

  assert.equal(a, b);
  assert.equal(rows(conn).length, 1);
});

test('eine umbenannte Uebersetzung spaltet den Ordner nicht mehr', () => {
  const conn = migrated(['Inventar']);

  // Der Fall, den v146 einmal von Hand aufraeumen musste.
  const id = ensureModuleFolder(conn, { key: 'inventory', name: 'Inventarverzeichnis' }, ACTOR);

  const after = rows(conn);
  assert.equal(after.length, 1, 'kein zweiter Ordner');
  assert.equal(after[0].id, id);
  assert.equal(after[0].name, 'Inventar', 'der Name des Bestandsordners bleibt, wie er ist');
});

test('ein noch unbekannter Schluessel legt den Ordner mit seiner Beschriftung an', () => {
  const conn = migrated([]);

  const id = ensureModuleFolder(conn, { key: 'tasks', name: 'Aufgaben' }, ACTOR);

  const after = rows(conn);
  assert.equal(after.length, 1);
  assert.equal(after[0].id, id);
  assert.equal(after[0].name, 'Aufgaben');
  assert.equal(after[0].module_key, 'tasks');
});

test('traegt ein selbst angelegter Ordner den Namen schon, wird er beansprucht statt verdoppelt', () => {
  // `name` hat ein UNIQUE (Migration 60): ohne diesen Zweig liefe das Anlegen
  // in eine Constraint-Verletzung statt in den richtigen Ordner.
  const conn = migrated([]);
  conn.prepare('INSERT INTO family_document_folders (name) VALUES (?)').run('Aufgaben');

  const id = ensureModuleFolder(conn, { key: 'tasks', name: 'Aufgaben' }, ACTOR);

  const after = rows(conn);
  assert.equal(after.length, 1);
  assert.equal(after[0].id, id);
  assert.equal(after[0].module_key, 'tasks');
});

test('ein fremder Schluessel wird nicht ueberschrieben', () => {
  const conn = migrated(['Belege']);

  // Konstruiert: der Ordner "Belege" gehoert schon dem Budget, ein anderes
  // Modul schlaegt denselben Namen vor. Den Schluessel zu ueberschreiben
  // verloere den Ordner des Budgets - dann lieber denselben mitbenutzen.
  const id = ensureModuleFolder(conn, { key: 'housekeeping', name: 'Belege' }, ACTOR);

  const after = rows(conn);
  assert.equal(after.length, 1);
  assert.equal(after[0].id, id);
  assert.equal(after[0].module_key, 'budget');
});

test('ein selbst umbenannter Systemordner bleibt der Systemordner', () => {
  const conn = migrated(['Belege']);

  // Was `PUT /folders/:id` tut: der Name aendert sich, der Schluessel bleibt.
  // Vor v157 war das ein Datenverlust auf Raten - der Ordner hiess jetzt
  // anders, der naechste Beleg legte den alten Namen neu an, und die
  // Umbenennung sah wie eine Verschiebung aus, die sie nie war.
  conn.prepare('UPDATE family_document_folders SET name = ? WHERE module_key = ?')
    .run('Kassenzettel 2026', 'budget');

  const id = ensureModuleFolder(conn, { key: 'budget', name: 'Belege' }, ACTOR);

  const after = rows(conn);
  assert.equal(after.length, 1, 'die Umbenennung darf keinen zweiten Ordner nach sich ziehen');
  assert.equal(after[0].id, id);
  assert.equal(after[0].name, 'Kassenzettel 2026', 'der selbst gewaehlte Name bleibt stehen');
});

test('ohne Schluessel bleibt es beim Suchen ueber den Namen', () => {
  // Der Weg fuer Ordner, die eine Person selbst angelegt hat, und fuer eine
  // aeltere App-Version, die den Schluessel noch nicht mitschickt.
  const conn = migrated(['Urlaub 2026']);

  const id = ensureModuleFolder(conn, { name: 'Urlaub 2026' }, ACTOR);

  assert.equal(rows(conn).length, 1);
  assert.equal(rows(conn)[0].id, id);
});

test('ein erfundener Schluessel wird nicht angenommen', () => {
  const conn = migrated([]);

  assert.equal(isModuleFolderKey('budget'), true);
  assert.equal(isModuleFolderKey('../../etc'), false);
  assert.equal(isModuleFolderKey(''), false);

  // Er faellt auf den Namen zurueck, statt einen freien Schluessel in die
  // Tabelle zu schreiben - sonst waere die Identitaet wieder etwas, das der
  // Client bestimmt.
  const id = ensureModuleFolder(conn, { key: 'erfunden', name: 'Sonstiges' }, ACTOR);
  assert.equal(rows(conn).find((f) => f.id === id).module_key, null);
});

test('jeder Schluessel der Liste hat eine Beschriftung in der Referenz-Locale', () => {
  const de = JSON.parse(readFileSync(new URL('../public/locales/de.json', import.meta.url), 'utf8'));
  const ohne = MODULE_FOLDER_KEYS.filter((key) => !de.documents?.[`${key}Folder`]);
  assert.deepEqual(ohne, [], `Schluessel ohne documents.<key>Folder: ${ohne.join(', ')}`);
});
