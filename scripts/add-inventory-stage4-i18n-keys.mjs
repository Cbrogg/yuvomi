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

const INVENTORY_LINES = [
  '        "warrantyStatusValid": "Under warranty until {{date}}",',
  '        "warrantyStatusExpiringSoon": "Warranty ends in {{days}} days",',
  '        "warrantyStatusExpired": "Warranty expired on {{date}}",',
  '        "warrantyAlertLabel": "Warranty ending soon or already expired",',
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

for (const locale of LOCALES) {
  const path = `public/locales/${locale}.json`;
  const lines = readFileSync(path, 'utf8').split('\n');

  insertAfterAnchor(lines, /^\s*"hasBookingsLabel":/, INVENTORY_LINES);
  insertAfterAnchor(lines, /^\s*"feedExportSaved":/, SETTINGS_LINES);

  writeFileSync(path, lines.join('\n'));
  console.log(`updated ${path}`);
}
