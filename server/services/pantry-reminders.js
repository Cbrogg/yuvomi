/**
 * Modul: Vorrat-Ablauferinnerungen (#811)
 * Zweck: Soll-Zustand der `pantry_item`-Erinnerungen herstellen - für einen
 *        Artikel (nach jedem Schreibvorgang) oder für den ganzen Bestand
 *        (einmal je Push-Lauf).
 * Abhängigkeiten: server/utils/reminder-schedule.js, server/logger.js
 *
 * ZWEI AUSLÖSER, EINE REGEL. Der Router ruft die Ein-Artikel-Fassung, damit ein
 * gerade gespeichertes MHD sofort in `/reminders/pending` steht. Der Push-Lauf
 * ruft die Alle-Fassung, und das ist nicht bloß ein Netz für vergessene
 * Schreibpfade: ohne sie hätte nach dem Update KEIN Bestandsartikel eine
 * Erinnerung. Sie entstünde erst beim nächsten Anfassen - und das unberührte
 * Glas hinten im Regal ist genau der Fall, für den #811 gestellt wurde.
 *
 * WARUM KEIN BACKFILL IN DER MIGRATION: dort müsste der Vorlauf ein drittes Mal
 * stehen, als SQL-Ausdruck, wo kein Guard ihn sieht. Der Voll-Sync rechnet mit
 * derselben Konstante wie der Router und bleibt zudem richtig, wenn später ein
 * Wiederherstellen aus dem Backup oder ein Eingriff von Hand den Bestand ändert.
 */

import { reminderDateBefore, reminderIsInThePast } from '../utils/reminder-schedule.js';
import { createLogger } from '../logger.js';

const log = createLogger('PantryReminders');

/**
 * Vorlauf der Ablauf-Erinnerung in Tagen.
 *
 * BEWUSST DIESELBE ZAHL wie `EXPIRY_SOON_DAYS` in public/utils/pantry-status.js,
 * die den Chip "läuft bald ab" gelb färbt: die Meldung kündigt genau diesen
 * Zustandswechsel an. Zwei Zahlen dafür wären zwei Wahrheiten - der Haushalt
 * bekäme die Nachricht an einem anderen Tag, als die Liste den Artikel
 * markiert, und keiner der beiden Tage wäre erklärbar. Ein Guard in
 * test/test-frontend-audit.js hält die Definitionen zusammen; dasselbe Muster
 * wie WARRANTY_ALERT_DAYS im Inventar.
 */
export const EXPIRY_REMINDER_OFFSET_DAYS = 7;

/**
 * Erinnerungs-Lebenszyklus, identisches Muster wie
 * server/routes/inventory/items.js#syncReminder: erst löschen, dann - falls die
 * Bedingungen greifen - neu anlegen. Kein Diffing, keine Sonderfälle für "nur
 * ein Feld hat sich geändert".
 *
 * VIER BEDINGUNGEN, und die vierte ist die einzige, die vom Inventar abweicht:
 *
 * - kein MHD, keine Meldung. Das Datum IST der Schalter, so wie Kaufdatum plus
 *   Garantiemonate am Gegenstand. Salz und Reis bleiben still, ohne dass
 *   jemand dafür etwas abwählen muss.
 * - kein `created_by` (das Mitglied wurde gelöscht, Migration v109 setzt die
 *   Spalte auf NULL statt den Bestand mitzureißen): es gibt niemanden, dem die
 *   Meldung gehört. `reminders.created_by` ist NOT NULL.
 * - der Termin liegt schon hinter uns: ein nachgetragener Artikel, dessen MHD
 *   in drei Tagen abläuft, würde sonst im nächsten Push-Lauf sofort melden -
 *   dieselbe Regel wie im Inventar für zurückdatierte Altgeräte.
 * - MENGE 0: verbraucht. Der Chip zeigt "läuft bald ab" auch bei leerem
 *   Bestand, und das ist dort richtig, weil eine Liste passiv ist - man sieht
 *   sie, wenn man hinsieht. Eine Push-Meldung unterbricht. Für eine leere
 *   Packung gibt es nichts mehr zu retten, also ist sie nur Lärm. Das
 *   Wiederauffüllen legt die Erinnerung wieder an, weil jeder Schreibpfad
 *   durch diese Funktion geht.
 *
 * @param {object} database
 * @param {object} item - Zeile aus `pantry_items`
 * @param {Date} [now]
 */
export function syncPantryExpiryReminder(database, item, now = new Date()) {
  database.prepare(`
    DELETE FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?
  `).run(item.id);

  if (!item.expires_on || !item.created_by) return;
  if (Number(item.quantity) <= 0) return;

  // EIN KAPUTTES DATUM DARF DEN SPEICHERVORGANG NICHT SPRENGEN. `expires_on`
  // wird beim Schreiben kalendarisch geprüft, aber Bestandszeilen aus der Zeit
  // vor dieser Prüfung können ein '2027-02-30' tragen - und dann würfe die
  // Rechnung mitten in einer Transaktion. Die Erinnerung ist eine Nebenwirkung
  // des Speicherns, nicht sein Zweck; dieselbe Haltung wie warrantyBody() in
  // server/services/notifications.js, das lieber den nackten Namen schickt als
  // die Zustellung zu verlieren.
  let remindAt;
  try {
    remindAt = reminderDateBefore(item.expires_on, EXPIRY_REMINDER_OFFSET_DAYS);
  } catch {
    log.warn(`Pantry item ${item.id} has an unusable best-before date (${item.expires_on}) - no reminder.`);
    return;
  }
  if (reminderIsInThePast(remindAt, now)) return;

  database.prepare(`
    INSERT INTO reminders (entity_type, entity_id, remind_at, created_by)
    VALUES ('pantry_item', ?, ?, ?)
  `).run(item.id, remindAt, item.created_by);
}

/**
 * Fehlende Erinnerungen für den ganzen Bestand ergänzen und gegenstandslose
 * abräumen. Läuft einmal je Push-Durchgang, gleiche Stelle wie der
 * Geburtstags-Sync.
 *
 * ERGÄNZEN UND AUFRÄUMEN, NIEMALS ERSETZEN - und das ist der Unterschied zur
 * Funktion darüber, nicht eine zweite Meinung über dieselbe Frage. Der Router
 * WEISS, dass sich der Artikel gerade geändert hat; die alte Meldung ist dann
 * ungültig und wird ausgetauscht. Dieser Lauf weiss nichts dergleichen. Würde
 * er trotzdem löschen und neu anlegen, setzte er bei jedem Durchgang `pushed_at`
 * und `dismissed` zurück - dieselbe Meldung käme im Minutentakt wieder, und ein
 * Wegwischen hielte bis zum nächsten Lauf. Dieselbe Vorsicht wie
 * retitleBirthdayEvents(), das outbound_dirty aus genau diesem Grund nicht
 * zurücksetzt.
 *
 * Eine bestehende Zeile bleibt deshalb unangetastet, auch eine bereits
 * zugestellte oder weggewischte: dass sie existiert, ist die Antwort.
 *
 * @param {object} database
 * @param {Date} [now]
 */
export function syncAllPantryExpiryReminders(database, now = new Date()) {
  const QUALIFIES = `
    expires_on IS NOT NULL AND created_by IS NOT NULL AND quantity > 0
  `;

  // GEGENSTANDSLOSES ZUERST: der Artikel ist weg, verbraucht oder hat sein
  // Datum verloren. Auch eine schon zugestellte Meldung geht dann - sie zeigt
  // auf etwas, das die Frage nicht mehr stellt.
  database.prepare(`
    DELETE FROM reminders
    WHERE entity_type = 'pantry_item'
      AND entity_id NOT IN (SELECT id FROM pantry_items WHERE ${QUALIFIES})
  `).run();

  // Und dann nur die Lücken. Artikel mit bestehender Zeile stehen gar nicht
  // erst in der Ergebnismenge.
  const missing = database.prepare(`
    SELECT id, quantity, expires_on, created_by FROM pantry_items
    WHERE ${QUALIFIES}
      AND id NOT IN (SELECT entity_id FROM reminders WHERE entity_type = 'pantry_item')
  `).all();

  for (const item of missing) syncPantryExpiryReminder(database, item, now);
}
