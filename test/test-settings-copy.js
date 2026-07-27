/**
 * Tests: Beschriftungswahrheit der Settings-Blätter (Critique 2026-07-27)
 * Zweck: Registry-Metadaten und Blatt-Inhalte sind unabhängig voneinander
 *        gewachsen. Vier Descriptions beschrieben Controls, die es auf dem
 *        Blatt nicht gibt ("Übersicht: Widgets und Aufbau anpassen" rendert
 *        Wetter und App-Name, null Widget-Controls). Nichts im Repo hat
 *        Label, Description und Inhalt nebeneinander gelesen.
 *
 * Prüft zwei Invarianten:
 *   1. Jedes Substantiv einer Leaf-Description kommt in den Strings vor, die
 *      dasselbe Blatt tatsächlich rendert.
 *   2. Jede Leaf-Description endet mit einem Satzschlusszeichen (sie stehen in
 *      der Domänen-Übersicht direkt untereinander).
 *
 * Grenze: Der Test prüft Vokabular, nicht Fähigkeit. Ein Blatt, das einen
 * Begriff nur read-only anzeigt, besteht ihn. Er fängt die stärkere Klasse:
 * Begriffe, die auf dem Blatt überhaupt nicht auftauchen.
 *
 * Ausführen: node test/test-settings-copy.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { SETTINGS_LEAVES } from '../public/settings/registry.js';

const de = JSON.parse(readFileSync(new URL('../public/locales/de.json', import.meta.url), 'utf8'));
const translate = (key) => key.split('.').reduce((value, segment) => value?.[segment], de);

/**
 * Blätter, deren Identität der IA-Umbau auflöst oder zusammenlegt. Ihre
 * Descriptions werden dort neu geschrieben, nicht hier. Die Liste darf nur
 * schrumpfen - jeder Eintrag ist offene Schuld, kein Dauerzustand.
 */
const PENDING_IA_REWRITE = new Set([
  'modules-dashboard',   // "Übersicht: Widgets und Aufbau anpassen" -> hat keine Widget-Controls
  'admin-system',        // Description verspricht "Admin-Optionen", Blatt ist read-only
  'modules-budget',      // "wiederkehrende Buchungen und Zahlungen" -> ein Toggle
  'modules-housekeeping', // "Personal und Vorräte" -> ein Toggle
]);

const SENTENCE_SPLIT = /[.!?]+\s+/;
// Deutsche Substantive sind großgeschrieben. Das erste Wort eines Satzes ist
// es qua Orthografie, also überspringen - sonst zählt jedes Satzanfangs-Verb
// als Substantiv.
const NOUN = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{4,}$/;
// Stamm statt Volltreffer: Deutsch flektiert ("Rollen" in der Description,
// "Rolle" im Blatt). Zwei Zeichen Nachsilbe fallen weg, Minimum fünf, damit
// kurze Wörter nicht zu Rauschen werden, Maximum acht, damit lange Komposita
// nicht faktisch auf Volltreffer hinauslaufen.
const stemOf = (word) => word
  .slice(0, Math.min(Math.max(5, word.length - 2), 8))
  .toLowerCase();

function leafSourcePath(leaf) {
  const match = String(leaf.loader).match(/\/settings\/(pages\/[\w-]+\.js)/);
  assert.ok(match, `${leaf.id}: Loader-Pfad nicht erkennbar`);
  return new URL(`../public/settings/${match[1]}`, import.meta.url);
}

/**
 * Alle statischen t('...')-Werte, die das Blatt rendert, plus sein eigener
 * Titel (die Shell rendert ihn als h1, er gehört zu dem, was der Nutzer sieht).
 */
function renderedVocabulary(leaf) {
  const source = readFileSync(leafSourcePath(leaf), 'utf8');
  const keys = [...source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)].map((m) => m[1]);
  const values = [leaf.labelKey, ...keys]
    .map(translate)
    .filter((value) => typeof value === 'string');
  return values.join(' ').toLowerCase();
}

function descriptionNouns(description) {
  return description
    .split(SENTENCE_SPLIT)
    // Erstes Wort je Satz raus: im Deutschen qua Orthografie großgeschrieben.
    .flatMap((sentence) => sentence.trim().split(/\s+/).slice(1))
    .map((word) => word.replace(/[.,;:!?()„“"»«]/g, ''))
    .filter((word) => NOUN.test(word))
    // Bindestrich-Komposita zerlegen: das Blatt nennt oft nur einen Teil
    // ("CalDAV" und "Kalender" statt "CalDAV-Kalender").
    .flatMap((word) => (word.includes('-') ? word.split('-') : [word]))
    .filter((part) => part.length >= 5);
}

test('jede Leaf-Description endet mit einem Satzschlusszeichen', () => {
  for (const leaf of SETTINGS_LEAVES) {
    const description = translate(leaf.descriptionKey);
    assert.equal(typeof description, 'string', `${leaf.id}: ${leaf.descriptionKey} fehlt in de.json`);
    assert.match(
      description,
      /[.!?]$/,
      `${leaf.id}: "${description}" endet ohne Satzschlusszeichen`,
    );
  }
});

test('jedes Substantiv einer Leaf-Description kommt im Blatt-Inhalt vor', () => {
  const failures = [];
  for (const leaf of SETTINGS_LEAVES) {
    if (PENDING_IA_REWRITE.has(leaf.id)) continue;
    const description = translate(leaf.descriptionKey);
    const vocabulary = renderedVocabulary(leaf);
    for (const noun of descriptionNouns(description)) {
      if (!vocabulary.includes(stemOf(noun))) {
        failures.push(`${leaf.id}: Description nennt "${noun}", das Blatt rendert es nicht`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('die IA-Ausnahmeliste enthält nur existierende Blätter', () => {
  // Verhindert, dass die Liste nach dem Umbau als toter Ballast überlebt.
  const ids = new Set(SETTINGS_LEAVES.map((leaf) => leaf.id));
  for (const id of PENDING_IA_REWRITE) {
    assert.ok(ids.has(id), `Ausnahmeliste nennt unbekanntes Blatt "${id}"`);
  }
});
