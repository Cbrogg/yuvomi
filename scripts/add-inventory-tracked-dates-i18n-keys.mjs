/**
 * Einmal-Skript: fuegt die zehn neuen "getrackte Fristen"-Schluessel
 * (inventory.trackedDates*, inventory.addTrackedDate, ...) den 22
 * Nicht-Referenz-Locales hinzu, englischer Platzhaltertext wie in en.json.
 * Aktualisiert ausserdem die *Werte* von fuenf bereits bestehenden
 * Schluesseln, deren englischer Text sich mit dieser Aenderung mitgeaendert
 * hat (inventoryFeedTitle/-Description/-Hint, warrantyAlertLabel,
 * icsCalendarName) - diese existieren in allen 22 Dateien schon als
 * Platzhalter aus Stufe 4 und muessen dem neuen en.json-Wortlaut folgen,
 * sonst driften sie von der Referenz ab.
 *
 * Deutsch (de.json) und Englisch (en.json) sind bereits von Hand gepflegt
 * (Task 4) - dieses Skript fasst sie nicht an.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

const NEW_KEY_LINES = [
  '        "trackedDatesLabel": "Tracked dates",',
  '        "trackedDatesHint": "Track any other date - TÜV, service, insurance renewal.",',
  '        "addTrackedDate": "Add date",',
  '        "trackedDateLabelPlaceholder": "Label (e.g. TÜV)",',
  '        "trackedDateRemindBeforeLabel": "Remind me (days before)",',
  '        "removeTrackedDateAction": "Remove tracked date",',
  '        "trackedDateInDays_one": "In {{count}} day",',
  '        "trackedDateInDays": "In {{count}} days",',
  '        "trackedDateOverdueDays_one": "{{count}} day overdue",',
  '        "trackedDateOverdueDays": "{{count}} days overdue",',
  '        "trackedDateDueToday": "Due today",',
];

const NEW_ICS_KEY_LINE = '        "icsTrackedDateSummary": "{{label}}: {{name}}",';

const VALUE_UPDATES = {
  warrantyAlertLabel: '"Upcoming or overdue deadline"',
  inventoryFeedTitle: '"Export deadlines"',
  inventoryFeedDescription: '"Subscribe to upcoming warranty end dates and any custom tracked dates (TÜV, service, ...) from your inventory read-only in Apple Calendar, Google Calendar, or Thunderbird."',
  inventoryFeedHint: '"Anyone who knows this link can see which of your items\' deadlines are coming up. Only share it with your own devices."',
  icsCalendarName: '"Yuvomi Inventory"',
};

function insertAfterAnchor(lines, anchorPattern, newLines) {
  const idx = lines.findIndex((line) => anchorPattern.test(line));
  if (idx === -1) throw new Error(`Anchor not found: ${anchorPattern}`);
  if (!lines[idx].trimEnd().endsWith(',')) {
    lines[idx] = `${lines[idx]},`;
  }
  lines.splice(idx + 1, 0, ...newLines);
}

function replaceValue(lines, key, newValueLiteral) {
  const idx = lines.findIndex((line) => new RegExp(`^\\s*"${key}":`).test(line));
  if (idx === -1) throw new Error(`Key not found for value replacement: ${key}`);
  const trailingComma = lines[idx].trimEnd().endsWith(',') ? ',' : '';
  const indent = lines[idx].match(/^(\s*)/)[1];
  lines[idx] = `${indent}"${key}": ${newValueLiteral}${trailingComma}`;
}

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  insertAfterAnchor(lines, /^\s*"warrantyAlertLabel":/, NEW_KEY_LINES);
  insertAfterAnchor(lines, /^\s*"icsWarrantySummary":/, [NEW_ICS_KEY_LINE]);
  for (const [key, value] of Object.entries(VALUE_UPDATES)) {
    replaceValue(lines, key, value);
  }

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
