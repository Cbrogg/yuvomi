/**
 * Einmal-Skript: fuegt die vier Garantie-Status-Schluessel (inventory.*) und die
 * fuenfzehn Feed-Export-Schluessel (settings.inventoryFeed*) den 22
 * Nicht-Referenz-Locales hinzu, englischer Platzhaltertext wie in en.json.
 * Deutsch (de.json) und Englisch (en.json) sind bereits von Hand gepflegt
 * (Task 4) - dieses Skript fasst sie nicht an.
 *
 * Anker strikt auf Schluesselnamen (nie uebersetzt), nie eine ganze Datei neu
 * serialisieren - Einrueckung/Formatierung der restlichen Datei bleibt exakt
 * erhalten.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const LOCALES = ['es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi', 'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil'];

// Der Zaehl-String braucht Pluralvarianten und muss dafuer `count` heissen -
// public/i18n.js waehlt _one/_other ausschliesslich ueber einen numerischen
// `count`-Parameter. Mit dem urspruenglichen `{{days}}` stand dort "in 1 days"
// (#534, gleiche Fehlerklasse).
const WARRANTY_EXPIRING_LINES = [
  '        "warrantyStatusExpiringSoon_one": "Warranty ends in {{count}} day",',
  '        "warrantyStatusExpiringSoon": "Warranty ends in {{count}} days",',
];

const INVENTORY_LINES = [
  '        "warrantyStatusValid": "Under warranty until {{date}}",',
  ...WARRANTY_EXPIRING_LINES,
  '        "warrantyStatusExpired": "Warranty expired on {{date}}",',
  '        "warrantyAlertLabel": "Warranty ending soon or already expired",',
];

// Nachtrag aus dem Abschluss-Review: der ICS-Feed erzeugte SUMMARY und
// X-WR-CALNAME fest auf Deutsch, unabhaengig von der Haushaltssprache. Beide
// Texte laufen jetzt ueber server/utils/i18n.js#translate.
const INVENTORY_ICS_LINES = [
  '        "icsWarrantySummary": "Warranty ends: {{name}}",',
  '        "icsCalendarName": "Yuvomi Warranties",',
];

const SETTINGS_LINES = [
  '        "inventoryFeedTitle": "Export warranty deadlines",',
  '        "inventoryFeedDescription": "Subscribe to upcoming warranty end dates from your inventory read-only in Apple Calendar, Google Calendar, or Thunderbird.",',
  '        "inventoryFeedInactive": "The export feed is disabled.",',
  '        "inventoryFeedActivate": "Activate feed",',
  '        "inventoryFeedUrlLabel": "Feed address",',
  '        "inventoryFeedCopy": "Copy address",',
  '        "inventoryFeedCopied": "Address copied",',
  '        "inventoryFeedSubscribe": "Subscribe in calendar app",',
  '        "inventoryFeedRegenerate": "Generate new link",',
  '        "inventoryFeedDisable": "Disable feed",',
  '        "inventoryFeedRegenerateConfirm": "Generate a new link? The old link will stop working.",',
  '        "inventoryFeedRegenerateConfirmDetail": "Devices and services using the old link stop receiving updates and, depending on the app, either keep showing their last state or show nothing until the new address is entered there.",',
  '        "inventoryFeedDisableConfirm": "Disable the feed? Existing subscriptions will no longer receive updates.",',
  '        "inventoryFeedDisableConfirmDetail": "The link stops delivering anything immediately. Turning it back on later creates a new address that every subscriber has to enter by hand.",',
  '        "inventoryFeedHint": "Anyone who knows this link can see which of your items\' warranties are ending. Only share it with your own devices.",',
];

function insertAfterAnchor(lines, anchorPattern, newLines) {
  const idx = lines.findIndex((line) => anchorPattern.test(line));
  if (idx === -1) throw new Error(`Anchor not found: ${anchorPattern}`);
  if (!lines[idx].trimEnd().endsWith(',')) {
    lines[idx] = `${lines[idx]},`;
  }
  lines.splice(idx + 1, 0, ...newLines);
}

/**
 * Idempotenz-Wache: das Skript wurde nachtraeglich um weitere Bloecke ergaenzt
 * (Abschluss-Review). Ohne diese Pruefung wuerde ein zweiter Lauf die bereits
 * eingefuegten Bloecke ein zweites Mal einspielen und doppelte Schluessel
 * hinterlassen.
 */
function insertBlockOnce(lines, anchorPattern, newLines) {
  const firstKey = newLines[0].trim().split('"')[1];
  if (lines.some((line) => new RegExp(`^\\s*"${firstKey}":`).test(line))) return false;
  insertAfterAnchor(lines, anchorPattern, newLines);
  return true;
}

/**
 * Ersetzt die alte, nicht pluralisierbare `{{days}}`-Zeile durch das
 * _one/-Basis-Paar. Betrifft nur Dateien aus dem ersten Lauf dieses Skripts;
 * frisch eingefuegte Bloecke tragen die neue Form bereits.
 */
function replacePluralizedWarrantyLine(lines) {
  const idx = lines.findIndex((line) => /^\s*"warrantyStatusExpiringSoon":\s*".*\{\{days\}\}/.test(line));
  if (idx === -1) return false;
  lines.splice(idx, 1, ...WARRANTY_EXPIRING_LINES);
  return true;
}

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  let changed = false;
  changed = insertBlockOnce(lines, /^\s*"hasBookingsLabel":/, INVENTORY_LINES) || changed;
  changed = replacePluralizedWarrantyLine(lines) || changed;
  changed = insertBlockOnce(lines, /^\s*"warrantyAlertLabel":/, INVENTORY_ICS_LINES) || changed;
  changed = insertBlockOnce(lines, /^\s*"feedExportSaved":/, SETTINGS_LINES) || changed;

  if (!changed) {
    console.log(`unchanged ${path}`);
    continue;
  }
  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
