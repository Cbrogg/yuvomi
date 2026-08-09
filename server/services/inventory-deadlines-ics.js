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
import { escapeICSText, foldLine } from './ics-export.js';
import { warrantyEndDate } from './inventory-deadlines.js';

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

function buildVEvent(item, warrantyEnd, dtstamp) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:inventory-warranty-${item.id}@yuvomi`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateValue(warrantyEnd)}`,
    // DTEND ist exklusiv (RFC 5545), wie server/services/ics-export.js#buildVEvent.
    `DTEND;VALUE=DATE:${addDaysDateKey(warrantyEnd, 1)}`,
    `SUMMARY:${escapeICSText(`Garantie endet: ${item.name}`)}`,
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

  const dtstamp = formatUTCStamp(now);
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yuvomi//Inventory Deadlines Feed//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Yuvomi Garantien',
  ];
  for (const item of rows) {
    const warrantyEnd = warrantyEndDate(item.purchase_date, item.warranty_months);
    out.push(...buildVEvent(item, warrantyEnd, dtstamp));
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
