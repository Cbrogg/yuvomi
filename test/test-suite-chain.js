/**
 * Modul: Test-Infrastruktur - Suite-Registry-Guard
 * Zweck: Jede Suite läuft wirklich. Beim Docs-Audit 2026-08-05 lagen fünf
 *        Suiten mit test:-Script vor, hingen aber nicht in der npm-test-Kette
 *        und liefen damit monatelang weder lokal (npm test) noch in CI - eine
 *        davon war still verrottet. Dieser Guard schließt genau dieses Loch:
 *        (1) jedes test:*-Script hängt in der test-Kette, (2) jede
 *        test/test-*.js-Datei wird von einem Script referenziert.
 * Ausführen: node --test test/test-suite-chain.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const chain = pkg.scripts.test;
const suiteScripts = Object.keys(pkg.scripts).filter((k) => k.startsWith('test:'));

const suiteFile = (name) => pkg.scripts[name].match(/test\/[\w.-]+\.js/)?.[0];

/**
 * Eine Suite braucht einen Browser, wenn ihre Datei ihn importiert.
 *
 * DAS IST DAS KRITERIUM, NICHT DER NAME. `npm test` ist netzfrei und serverlos:
 * die Suiten importieren Route-Handler direkt gegen In-Memory-SQLite. Eine
 * Suite, die einen echten Browser gegen einen echten Serverprozess fährt,
 * gehört dort nicht hinein - und eine Namensausnahme („außer
 * test:document-guards") wäre wieder eine Allowlist, die beim zweiten Fall
 * fehlt. Geprüft wird deshalb die Bauart der Datei.
 */
function needsBrowser(name) {
  const file = suiteFile(name);
  if (!file) return false;
  const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  // Die IMPORT-KANTE, nicht ein Textvorkommen: eine Datei, die den Namen des
  // Browsertreibers nur in einem Kommentar oder einem Regex nennt, fährt
  // keinen Browser. Diese Datei hier ist der erste Beweis dafür - eine
  // Textsuche hielt sie für ihre eigene Ausnahme.
  const imports = [...src.matchAll(/^\s*import[^;]*from\s*'([^']+)'/gm)].map((m) => m[1]);
  return imports.some((spec) => spec === 'puppeteer' || spec.includes('document-guards-harness'));
}

const runsIn = (script, name) => {
  if (script.includes(`npm run ${name}`)) return true;
  const file = suiteFile(name);
  return Boolean(file && script.includes(file));
};

test('jedes test:*-Script hängt in genau einer Kette', () => {
  // Die Kette ruft Suiten entweder als `npm run test:x` oder inlined sie als
  // direktes node-Kommando - dann genügt der Testdatei-Pfad als Nachweis.
  const wrong = [];
  for (const name of suiteScripts) {
    if (name === 'test:document-guards') continue; // die Browser-Kette selbst
    const browser = needsBrowser(name);
    const inChain = runsIn(chain, name);
    if (browser && inChain) {
      wrong.push(`${name} fährt einen Browser und hängt trotzdem in npm test - dort ist kein Server`);
    }
    if (!browser && !inChain) {
      wrong.push(`${name} läuft nirgends - in die test-Kette einhängen (Schritt 3 in docs/test-suites.md)`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join('\n  '));
});

test('die Browser-Suiten laufen unter test:document-guards', () => {
  const browserSuites = suiteScripts.filter((n) => n !== 'test:document-guards' && needsBrowser(n));
  const entry = pkg.scripts['test:document-guards'];
  assert.ok(entry, 'test:document-guards fehlt - die Browser-Kette braucht einen Einstieg.');
  const missing = browserSuites.filter((n) => !runsIn(entry, n));
  assert.deepEqual(
    missing,
    [],
    `Browser-Suiten ohne Einstieg - an test:document-guards anhängen: ${missing.join(', ')}`,
  );
});

test('jede test/test-*.js-Datei hat ein npm-Script', () => {
  const referenced = new Set(
    Object.values(pkg.scripts).flatMap((v) => [...v.matchAll(/test\/[\w.-]+\.js/g)].map((m) => m[0])),
  );
  const orphans = readdirSync(new URL('../test', import.meta.url))
    .filter((f) => f.startsWith('test-') && f.endsWith('.js'))
    .filter((f) => !referenced.has(`test/${f}`));
  assert.deepEqual(
    orphans,
    [],
    `Testdateien ohne test:-Script - anlegen und in die Kette einhängen: ${orphans.join(', ')}`,
  );
});
