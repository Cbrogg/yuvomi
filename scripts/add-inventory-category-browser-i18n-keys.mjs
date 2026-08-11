/**
 * Einmal-Skript: fuegt den neuen Zurueck-Link-Schluessel den 22
 * Nicht-Referenz-Locales hinzu, englischer Platzhaltertext wie in en.json.
 * Deutsch (de.json) und Englisch (en.json) sind bereits von Hand gepflegt
 * (Task 1) - dieses Skript fasst sie nicht an.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

const NEW_KEY_LINES = [
  '        "backToInventory": "Back to Inventory",',
];

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  // Two-step anchor: photoLabel is not unique (birthdays.js also defines a photoLabel key),
  // so we anchor first on the unique warrantyMonthsValue key (inventory-only), then find the
  // photoLabel that follows it. This ensures we target the inventory section's photoLabel,
  // not the one in the birthdays/people section.
  const warrantyIdx = lines.findIndex((line) => /^\s*"warrantyMonthsValue":/.test(line));
  if (warrantyIdx === -1) throw new Error('Anchor "warrantyMonthsValue" not found');

  // Find the photoLabel that comes after warrantyMonthsValue
  let photoIdx = -1;
  for (let i = warrantyIdx + 1; i < lines.length; i++) {
    if (/^\s*"photoLabel":/.test(lines[i])) {
      photoIdx = i;
      break;
    }
  }
  if (photoIdx === -1) throw new Error('photoLabel not found after warrantyMonthsValue');

  if (!lines[photoIdx].trimEnd().endsWith(',')) {
    lines[photoIdx] = `${lines[photoIdx]},`;
  }
  lines.splice(photoIdx + 1, 0, ...NEW_KEY_LINES);

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
