/**
 * Modul: Inventar-Garantiefristen-ICS-Export
 * Zweck: Eigenständiger, schreibgeschützter iCalendar-Feed aus den Garantie-
 *        Enddaten der Inventar-Gegenstände. Bewusst getrennt von
 *        server/services/ics-export.js (bestehender Haushaltskalender-Feed) -
 *        eigener Nutzerwunsch, kein gemeinsamer Feed. Wiederverwendet von dort
 *        nur die beiden reinen Text-Helfer (escapeICSText, foldLine); buildVEvent
 *        selbst ist auf calendar_events zugeschnitten (Wiederholungen, TZID) und
 *        für einen einmaligen Termin unnötig.
 *
 * Token liegt in sync_config statt auf einer users-Zeile: Inventar-Gegenstände
 * haben keinen Eigentümer, der Feed ist ein einzelnes Haushalts-Artefakt (analog
 * zu budget_mode/currency).
 */

import { randomBytes } from 'node:crypto';
import { createLogger } from '../logger.js';
import { resolveHouseholdFormats, translate } from '../utils/i18n.js';
import { escapeICSText, foldLine } from './ics-export.js';
import { warrantyEndDate } from './inventory-deadlines.js';

const log = createLogger('InventoryDeadlinesICS');
const TOKEN_KEY = 'inventory_deadlines_feed_token';

function pad(n) { return String(n).padStart(2, '0'); }

function formatUTCStamp(now) {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
         `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function formatDateValue(dateKey) {
  return dateKey.replace(/-/g, '');
}

function addDaysDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function buildVEvent(item, warrantyEnd, dtstamp, locale) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:inventory-warranty-${item.id}@yuvomi`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateValue(warrantyEnd)}`,
    // DTEND ist exklusiv (RFC 5545), wie server/services/ics-export.js#buildVEvent.
    `DTEND;VALUE=DATE:${addDaysDateKey(warrantyEnd, 1)}`,
    `SUMMARY:${escapeICSText(translate(locale, 'inventory.icsWarrantySummary', { name: item.name }))}`,
    'END:VEVENT',
  ];
  return lines.map(foldLine);
}

function buildTrackedDateVEvent(row, dtstamp, locale) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:inventory-tracked-date-${row.id}@yuvomi`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateValue(row.date)}`,
    `DTEND;VALUE=DATE:${addDaysDateKey(row.date, 1)}`,
    `SUMMARY:${escapeICSText(translate(locale, 'inventory.icsTrackedDateSummary', { label: row.label, name: row.item_name }))}`,
    'END:VEVENT',
  ];
  return lines.map(foldLine);
}

function buildInventoryDeadlinesFeed(conn, now = new Date()) {
  const rows = conn.prepare(`
    SELECT id, name, purchase_date, warranty_months
    FROM inventory_items
    WHERE purchase_date IS NOT NULL AND warranty_months IS NOT NULL
    ORDER BY id ASC
  `).all();

  const trackedDateRows = conn.prepare(`
    SELECT d.id, d.label, d.date, ii.name AS item_name
    FROM inventory_item_dates d
    JOIN inventory_items ii ON ii.id = d.item_id
    ORDER BY d.id ASC
  `).all();

  // Serverseitig erzeugter Kalendertext folgt der Datensprache des Haushalts,
  // genau wie die Geburtstags-Termine (server/services/birthdays.js): der
  // Abonnent sieht den Text roh aus dem Feed, es laeuft keine clientseitige
  // Uebersetzung mehr darueber.
  const { locale } = resolveHouseholdFormats(conn);

  const dtstamp = formatUTCStamp(now);
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yuvomi//Inventory Deadlines Feed//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(translate(locale, 'inventory.icsCalendarName'))}`,
  ];
  for (const item of rows) {
    // Ein einzelner unparsbarer Gegenstand darf nicht den ganzen Feed fuer alle
    // Abonnenten stilllegen. Solche Zeilen koennen aus der Zeit stammen, in der
    // die Datumsvalidierung nur die Form pruefte (server/middleware/validate.js
    // #date liess z. B. 2026-02-30 durch) - der Feed ueberspringt sie und
    // liefert alles andere weiter aus.
    let warrantyEnd;
    try {
      warrantyEnd = warrantyEndDate(item.purchase_date, item.warranty_months);
    } catch (err) {
      log.warn(`Skipping inventory item ${item.id} in the warranty feed: ${err?.message || err}`);
      continue;
    }
    out.push(...buildVEvent(item, warrantyEnd, dtstamp, locale));
  }
  for (const row of trackedDateRows) {
    out.push(...buildTrackedDateVEvent(row, dtstamp, locale));
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}

function getFeedToken(conn) {
  return conn.prepare('SELECT value FROM sync_config WHERE key = ?').get(TOKEN_KEY)?.value ?? null;
}

function regenerateFeedToken(conn) {
  const token = randomBytes(32).toString('base64url');
  conn.prepare(`
    INSERT INTO sync_config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(TOKEN_KEY, token);
  return token;
}

function clearFeedToken(conn) {
  conn.prepare('DELETE FROM sync_config WHERE key = ?').run(TOKEN_KEY);
}

function isValidFeedToken(conn, token) {
  if (!token) return false;
  return getFeedToken(conn) === token;
}

export {
  buildInventoryDeadlinesFeed, getFeedToken, regenerateFeedToken, clearFeedToken, isValidFeedToken,
};
