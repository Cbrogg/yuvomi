/**
 * Modul: Test-Isolation gegen streunende Datenbankdateien
 * Zweck: server/db.js ruft init() beim Import auf. Eine Suite, die das Modul
 *        (auch nur mittelbar) lädt, ohne DB_PATH zu setzen, öffnet damit die
 *        echte Datei im Repo-Wurzelverzeichnis: sie legt yuvomi.db an und
 *        nimmt in den nächsten Lauf mit, was der vorige hinterlassen hat.
 *        Dieser Test verfolgt die relativen Importe jeder Test-Suite und
 *        verlangt DB_PATH genau dort, wo db.js wirklich erreicht wird.
 * Ausführen: node --test test/test-db-isolation.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DB_MODULE = resolve(ROOT, 'server/db.js');

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

// Statische und dynamische Importe, jeweils nur die relativen: alles andere
// zeigt auf node_modules oder Node-Builtins und kann db.js nicht ziehen.
const IMPORT_PATTERNS = [
  /\bfrom\s+['"](\.[^'"]+)['"]/g,      // import x from './y.js'
  /\bimport\s*\(\s*['"](\.[^'"]+)['"]/g, // await import('./y.js')
];

/** Sammelt transitiv alle relativ importierten Dateien ab `entry`. */
function reachableFiles(entry) {
  const seen = new Set();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    const src = readFileSync(file, 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of src.matchAll(pattern)) {
        queue.push(resolve(dirname(file), match[1]));
      }
    }
  }
  return seen;
}

/**
 * Jeder einzelne Node-Aufruf einer Test-Datei in einem npm-Skript.
 * Das Sammelskript `test` verkettet Suiten mit &&, teils über `npm run`,
 * teils direkt als `node …/test-x.js` - beide Formen müssen geprüft werden,
 * denn das Env-Prefix gilt in einer Kette immer nur für seinen eigenen Befehl.
 */
function nodeInvocations(command) {
  return command
    .split('&&')
    .map((segment) => segment.trim())
    .filter((segment) => /(^|\s)node\s/.test(segment))
    .map((segment) => {
      const match = segment.match(/(test\/[\w.-]+\.m?js)/);
      return match ? { segment, entry: resolve(ROOT, match[1]) } : null;
    })
    .filter(Boolean);
}

test('jede Suite, die server/db.js lädt, setzt DB_PATH', () => {
  const offenders = [];

  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (name !== 'test' && !name.startsWith('test:')) continue;

    for (const { segment, entry } of nodeInvocations(command)) {
      if (!reachableFiles(entry).has(DB_MODULE)) continue;

      // Zwei gleichwertige Wege: als Env-Prefix vor dem Aufruf, oder in der
      // Suite selbst gesetzt, bevor sie db.js lädt (dann meist mit dynamischem
      // Import, weil ein statischer sonst vorher ausgeführt würde).
      if (/\bDB_PATH=/.test(segment)) continue;
      if (/process\.env\.DB_PATH\s*=/.test(readFileSync(entry, 'utf8'))) continue;

      offenders.push(`${name} → ${relative(ROOT, entry)}`);
    }
  }

  assert.deepStrictEqual(
    offenders, [],
    'Diese Suiten laden server/db.js ohne DB_PATH und legen dadurch eine echte '
    + `yuvomi.db im Repo an. Setze DB_PATH=:memory: davor:\n  ${offenders.join('\n  ')}`
  );
});

test('der Importverfolger erkennt db.js überhaupt', () => {
  // Schutz gegen einen Guard, der nur deshalb grün ist, weil er nichts findet:
  // eine Suite, die db.js nachweislich lädt, muss auch als solche erkannt werden.
  const known = resolve(ROOT, 'test/test-holidays.js');
  assert.ok(existsSync(known), 'Referenz-Suite fehlt');
  assert.ok(
    reachableFiles(known).has(DB_MODULE),
    'test-holidays.js importiert server/db.js, der Verfolger sieht es aber nicht'
  );
});
