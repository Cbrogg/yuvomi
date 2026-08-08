/**
 * Einmal-Skript: fuegt die sechs Inventar-Dokumentverknuepfungs-Schluessel
 * (Stufe 2) den 22 Nicht-Referenz-Locales hinzu, englischer Platzhaltertext
 * wie in en.json. Deutsch (de.json) und Englisch (en.json) sind bereits von
 * Hand gepflegt (Task 5) - dieses Skript fasst sie nicht an.
 *
 * Anker strikt auf Schluesselnamen (nie uebersetzt), nie eine ganze Datei neu
 * serialisieren - Einrueckung/Formatierung der restlichen Datei bleibt exakt
 * erhalten.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

const DOCUMENTS_FOLDER_LINE = '        "inventoryFolder": "Inventory"';
const INVENTORY_LINES = [
  '        "attachmentsLabel": "Documents",',
  '        "attachmentsHint": "Attach a receipt, warranty card, or manual.",',
  '        "attachmentCategoryLabel": "Document category",',
  '        "attachmentDocumentName": "{{name}} – attachment",',
  '        "hasAttachmentsLabel": "Has attachments"',
];

function insertAfterAnchor(lines, anchorPattern, newLines) {
  const idx = lines.findIndex((line) => anchorPattern.test(line));
  if (idx === -1) throw new Error(`Anchor not found: ${anchorPattern}`);
  // Anker-Zeile bekommt ein Komma, falls sie noch keins hat (war zuvor die
  // letzte Zeile im Block).
  if (!lines[idx].trimEnd().endsWith(',')) {
    lines[idx] = `${lines[idx]},`;
  }
  lines.splice(idx + 1, 0, ...newLines);
}

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  insertAfterAnchor(lines, /^\s*"splitExpensesFolder":/, [DOCUMENTS_FOLDER_LINE]);
  insertAfterAnchor(lines, /^\s*"categoryOtherNotDeletable":/, INVENTORY_LINES);

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
