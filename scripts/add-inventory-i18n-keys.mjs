#!/usr/bin/env node
/**
 * One-off migration script: propagates the new inventory-module i18n keys
 * (hand-authored in de.json/en.json in Task 8) into the other 22 locale
 * files, using the English text as a placeholder - CONTRIBUTING.md: "a
 * non-German value may start as the English text".
 *
 * Anchors purely on KEY NAMES, which are never translated, so the same
 * regexes work across every locale file regardless of language. Never
 * re-serializes a whole file (JSON.stringify would reformat every existing
 * line) - only the new lines are spliced in as text, verbatim from en.json.
 *
 * Key set for this task: nav.inventory, shortcuts.goInventory,
 * settings.apiTokenScopeModules.inventory, and the full top-level
 * "inventory" block. (Earlier, simpler builds of this feature also touched
 * budget.addToInventory* - that key does not exist in this build's Task 8
 * scope, so it is intentionally omitted here.)
 *
 * settings.apiTokenScopeModules has no "pantry" entry in ANY locale file (a
 * pre-existing upstream gap, predates this branch - Task 8 discovered this
 * and anchored after "search" instead when hand-authoring de.json/en.json).
 * This script anchors the same way. Verified unambiguous by checking, for
 * every target locale, that the 12-space-indent "search" line appears
 * exactly once in apiTokenScopeModules (it's the last key in that block; the
 * only other "search" occurrences in each file - nav.search, the top-level
 * "search" block, shortcuts.search - all sit at different indentation).
 *
 * nav.pantry (8-space indent) is likewise verified to be the FIRST 8-space
 * "pantry" line in every locale file (nav block comes before emptyHint.pantry,
 * the file's only other 8-space "pantry" occurrence), so insertAfterKeyLine's
 * first-match findIndex lands on the nav entry, not emptyHint's.
 *
 * Run once: node scripts/add-inventory-i18n-keys.mjs
 * Then verify: npm run test:i18n && npm run test:i18n-plural
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = fileURLToPath(new URL('../public/locales/', import.meta.url));
const OTHER_LOCALES = [
  'es', 'fr', 'it', 'sv', 'el', 'ru', 'tr', 'zh', 'ja', 'ar', 'hi',
  'pt', 'uk', 'pl', 'nl', 'cs', 'vi', 'hu', 'ko', 'id', 'fa', 'fil',
];

const enText = readFileSync(`${LOCALES_DIR}en.json`, 'utf8');
const enLines = enText.split('\n');

function lineIndex(lines, anchorRegex, { fromIndex = 0 } = {}) {
  const idx = lines.findIndex((l, i) => i >= fromIndex && anchorRegex.test(l));
  if (idx === -1) throw new Error(`anchor not found: ${anchorRegex}`);
  return idx;
}

/** Extracts en.json lines [startAnchor, endAnchor) - end line excluded. */
function extractBlock(startAnchorRegex, endAnchorRegex) {
  const start = lineIndex(enLines, startAnchorRegex);
  const end = lineIndex(enLines, endAnchorRegex, { fromIndex: start + 1 });
  return enLines.slice(start, end);
}

/** Extracts a single matching en.json line (kept verbatim, including its own indentation). */
function extractLine(anchorRegex) {
  return enLines[lineIndex(enLines, anchorRegex)];
}

// The whole new "inventory" top-level block, verbatim from en.json, including
// its own closing "    },". Extracted as literal text (not reconstructed
// field-by-field) so this script can never drift from what Task 8 actually
// wrote.
const inventoryBlock = extractBlock(/^    "inventory": \{$/, /^    "documentAttach": \{$/);

const navLine = extractLine(/^ {8}"inventory": "Inventory"$/);
const shortcutLine = extractLine(/^ {8}"goInventory": "Inventory"$/);
// settings.apiTokenScopeModules.inventory - 12-space indent, nested one
// level deeper than the top-level blocks above.
const scopeLine = extractLine(/^ {12}"inventory": "Inventory"$/);

function insertAfterKeyLine(text, anchorRegex, newLines) {
  const lines = text.split('\n');
  const idx = lineIndex(lines, anchorRegex);
  if (!lines[idx].trimEnd().endsWith(',')) lines[idx] = `${lines[idx]},`;
  lines.splice(idx + 1, 0, ...newLines);
  return lines.join('\n');
}

function insertBeforeLine(text, anchorRegex, newLines) {
  const lines = text.split('\n');
  const idx = lineIndex(lines, anchorRegex);
  lines.splice(idx, 0, ...newLines);
  return lines.join('\n');
}

for (const locale of OTHER_LOCALES) {
  const path = `${LOCALES_DIR}${locale}.json`;
  let text = readFileSync(path, 'utf8');

  // 1) nav.inventory - after nav.pantry (8-space indent, string value - the
  //    OTHER "pantry" key in emptyHint sits later in the file and is never
  //    matched first by insertAfterKeyLine's single findIndex, verified for
  //    all 22 locales before running).
  text = insertAfterKeyLine(text, /^ {8}"pantry": ".*",?$/, [navLine.replace(/,$/, '')]);

  // 2) shortcuts.goInventory - after shortcuts.goHealth
  text = insertAfterKeyLine(text, /^ {8}"goHealth": ".*",?$/, [shortcutLine.replace(/,$/, '')]);

  // 3) settings.apiTokenScopeModules.inventory - after its "search" entry.
  //    apiTokenScopeModules has no "pantry" key in any locale file
  //    (pre-existing upstream gap; see file header comment). "search" is the
  //    last key in that block (12-space indent) and is otherwise unique at
  //    that indentation in every target locale file (verified before
  //    running this script).
  text = insertAfterKeyLine(text, /^ {12}"search": ".*",?$/, [scopeLine.replace(/,$/, '')]);

  // 4) the whole new "inventory" top-level block, before "documentAttach"
  text = insertBeforeLine(text, /^    "documentAttach": \{$/, inventoryBlock);

  writeFileSync(path, text);
  console.log(`updated ${locale}.json`);
}
