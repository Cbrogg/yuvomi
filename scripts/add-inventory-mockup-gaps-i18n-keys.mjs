/**
 * Einmal-Skript: fuegt die drei neuen Schluessel (Filter-Gruppe, Foto-Label,
 * Foto-entfernen) den 22 Nicht-Referenz-Locales hinzu, englischer
 * Platzhaltertext wie in en.json. Deutsch (de.json) und Englisch (en.json)
 * sind bereits von Hand gepflegt (Task 2) - dieses Skript fasst sie nicht an.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

const NEW_KEY_LINES = [
  '        "filterGroupLabel": "Filter items",',
  '        "photoLabel": "Photo",',
  '        "removePhoto": "Remove photo",',
];

function insertAfterAnchor(lines, anchorPattern, newLines) {
  const idx = lines.findIndex((line) => anchorPattern.test(line));
  if (idx === -1) throw new Error(`Anchor not found: ${anchorPattern}`);
  if (!lines[idx].trimEnd().endsWith(',')) {
    lines[idx] = `${lines[idx]},`;
  }
  lines.splice(idx + 1, 0, ...newLines);
}

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  insertAfterAnchor(lines, /^\s*"warrantyMonthsValue":/, NEW_KEY_LINES);

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
