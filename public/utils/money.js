/**
 * Geldbeträge im Budget-Modul: EINE Quelle für Format, Vorzeichen und Farbe.
 *
 * Vorher gab es drei Formatierer (budget.js, subscriptions.js, split-expenses.js)
 * und vier Vorzeichenkonventionen. Dieselbe Zahl konnte dadurch in zwei Untertabs
 * verschieden geschrieben sein - bei Geld ist das kein Stilproblem, sondern ein
 * Vertrauensproblem (Critique 2026-07-30, P0).
 *
 * Der Kern ist nicht der Formatierer, sondern das ROLLEN-Vokabular: jeder Betrag
 * im Modul gehört zu genau einer der vier Rollen, und die Rolle entscheidet
 * Vorzeichen und Farbe gemeinsam. Wer einen neuen Betrag rendert, wählt eine
 * Rolle - er erfindet keine fünfte Schreibweise.
 *
 * | Rolle       | Vorzeichen        | Farbe            | Wofür |
 * |-------------|-------------------|------------------|-------|
 * | `flow`      | immer (+ und -)   | nach Vorzeichen  | eine einzelne Kontobewegung: Buchung, Darlehensrate |
 * | `total`     | nie               | vom Aufrufer     | eine Summe, deren Richtung schon im Label steht („Ausgaben") |
 * | `balance`   | nur bei negativ   | nach Vorzeichen  | Saldo, Nettovermögen, „Du schuldest" |
 * | `plain`     | nie               | keine            | ein Rechnungsbetrag ohne Kontorichtung: Abo-Preis, Darlehenshöhe |
 *
 * Warum `plain` für geteilte Ausgaben und `flow` für Budget-Einträge: eine
 * geteilte Ausgabe ist ein Rechnungsposten der Gruppe, keine Bewegung auf dem
 * Konto des Betrachters - wer sie ausgelegt hat, hat eine Forderung, kein Minus.
 * Die Unterscheidung ist damit eine benannte Entscheidung statt eines Zufalls.
 */

import { getNumberFormat } from '/i18n.js';

/** Erlaubte Rollen. Wird vom Guard in test-budget-ui.js gegen die Aufrufe geprüft. */
export const MONEY_ROLES = ['flow', 'total', 'balance', 'plain'];

/**
 * Reiner Betrag ohne Rollenlogik. Nur benutzen, wenn wirklich kein Vorzeichen
 * und keine Farbe im Spiel sind (Achsenbeschriftung, Tooltip, CSV).
 */
export function formatMoney(amount, currency) {
  return getNumberFormat({ style: 'currency', currency }).format(Number(amount) || 0);
}

/**
 * Nachkommastellen einer Währung: EUR 2, JPY/HUF/VND 0, KWD/BHD 3.
 * Fällt bei fehlendem oder ungültigem ISO-Code auf zwei zurück.
 */
export function currencyFractionDigits(currency) {
  try {
    // Wirft bei fehlendem oder ungültigem ISO-Code; dann bleibt es bei zwei.
    return getNumberFormat({ style: 'currency', currency }).resolvedOptions().minimumFractionDigits;
  } catch {
    return 2;
  }
}

/**
 * Eingabe-Platzhalter für ein Betragsfeld: die Null im Zahlformat der
 * Format-Locale, mit den Nachkommastellen der Währung.
 * EUR/de -> "0,00", EUR/de-CH -> "0.00", JPY -> "0".
 *
 * Stand vorher als Locale-Key `budget.amountPlaceholder` in 23 JSON-Dateien und
 * war dort in cs, hu und vi schlicht falsch (Punkt statt Komma). Ein Locale-Key
 * kann das auch gar nicht leisten: das Dezimaltrennzeichen hängt an der Region
 * (getFormatLocale), nicht an der UI-Sprache, und die Nachkommastellen hängen an
 * der Währung - beides weiß eine Übersetzungsdatei nicht.
 */
export function amountPlaceholder(currency) {
  const digits = currencyFractionDigits(currency);
  return getNumberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(0);
}

/** Kleinster erfassbarer Betrag der Währung als Zahl: JPY 1, EUR 0.01, KWD 0.001. */
function smallestUnit(digits) {
  return digits === 0 ? 1 : 10 ** -digits;
}

/**
 * Schrittweite für ein Betragsfeld, passend zur Währung: "1" bei JPY, "0.01"
 * bei EUR, "0.001" bei KWD. Immer mit Punkt - `step` und `min` sind HTML-Syntax,
 * kein Anzeigeformat.
 *
 * `currentValue` ist der Bestandswert des Feldes. Passt er nicht ins Raster,
 * entfällt die Schrittprüfung ("any"): ein in EUR erfasster Betrag von 12,50
 * oder eine Split-Teilung (10/3) würde sonst vom Browser als ungültig markiert
 * und das Speichern stillschweigend blockieren.
 */
export function amountStep(currency, currentValue) {
  const digits = currencyFractionDigits(currency);
  const value = Number(currentValue);
  if (currentValue !== '' && currentValue != null && Number.isFinite(value)) {
    const scaled = value * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-9) return 'any';
  }
  return smallestUnit(digits).toFixed(digits);
}

/**
 * Untergrenze für ein Pflicht-Betragsfeld: eine Einheit, also der kleinste
 * erfassbare positive Betrag. Liegt der Bestandswert darunter (0,50 erfasst in
 * EUR, jetzt JPY mit Untergrenze 1), gilt er selbst - sonst liesse sich ein
 * vorhandener Eintrag nicht mehr speichern.
 */
export function amountMin(currency, currentValue) {
  const digits = currencyFractionDigits(currency);
  const smallest = smallestUnit(digits);
  const value = Math.abs(Number(currentValue));
  if (Number.isFinite(value) && value > 0 && value < smallest) return String(value);
  return smallest.toFixed(digits);
}

/**
 * Betrag nach Rolle. Liefert Text, Ton und die passende Modifier-Klasse
 * gemeinsam, damit Vorzeichen und Farbe nie auseinanderlaufen können.
 *
 * @param {number} amount
 * @param {object} options
 * @param {string} options.currency  ISO-Code, z. B. 'EUR'
 * @param {'flow'|'total'|'balance'|'plain'} options.role
 * @param {'positive'|'negative'|'neutral'} [options.tone]  nur bei role 'total':
 *        die Richtung steht dort im Label, nicht im Vorzeichen.
 * @param {string} [options.block]  BEM-Block für die Modifier-Klasse,
 *        z. B. 'budget-entry__amount' -> 'budget-entry__amount--income'
 * @returns {{ text: string, tone: 'positive'|'negative'|'neutral', className: string }}
 */
export function formatSignedAmount(amount, { currency, role, tone, block } = {}) {
  const value = Number(amount) || 0;

  // `exceptZero` statt manuellem '+'-Prefix: das Vorzeichen gehört ins
  // Zahlformat, sonst steht es in RTL-Locales auf der falschen Seite.
  const signDisplay = role === 'flow'
    ? 'exceptZero'
    : 'auto';

  const magnitude = (role === 'total' || role === 'plain') ? Math.abs(value) : value;
  const text = getNumberFormat({ style: 'currency', currency, signDisplay }).format(magnitude);

  const resolvedTone = resolveTone(value, role, tone);
  return { text, tone: resolvedTone, className: block ? `${block}--${resolvedTone}` : '' };
}

function resolveTone(value, role, tone) {
  if (role === 'plain') return 'neutral';
  if (role === 'total') return tone || 'neutral';
  // flow und balance: die Zahl selbst trägt die Richtung.
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}
