/**
 * Einmal-Skript: fuegt die 18 Buchungsverknuepfungs-Schluessel (Stufe 3) den
 * 22 Nicht-Referenz-Locales hinzu, englischer Platzhaltertext wie in en.json.
 * Deutsch (de.json) und Englisch (en.json) sind bereits von Hand gepflegt
 * (Task 3) - dieses Skript fasst sie nicht an.
 *
 * Extrahiert den literalen Zeilenblock aus en.json zwischen den beiden
 * Ankern (erste/letzte neue Zeile) und spleisst ihn unveraendert in jede
 * der 22 Dateien - keine Feld-fuer-Feld-Rekonstruktion, das riskiert Drift
 * von dem, was Task 3 tatsaechlich geschrieben hat.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

const enLines = readFileSync('public/locales/en.json', 'utf8').split('\n');
const startIdx = enLines.findIndex((line) => /^\s*"linkedBookingsLabel":/.test(line));
const endIdx = enLines.findIndex((line) => /^\s*"removeBookingAction":/.test(line));
if (startIdx === -1 || endIdx === -1) throw new Error('Could not locate the new key block in en.json');
const newBlockLines = enLines.slice(startIdx, endIdx + 1);

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

  insertAfterAnchor(lines, /^\s*"hasAttachmentsLabel":/, newBlockLines);

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
