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
import { resolvePermissions } from '../permissions.js';
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
 *
 *   DAS IST EINE ECHTE LÜCKE, und sie wird hier bewusst nicht geschlossen: der
 *   Vorrat gehört dem Haushalt, eine Erinnerung aber immer einem Nutzer. Auf
 *   den gerade handelnden auszuweichen wäre die naheliegende Reparatur und
 *   verschöbe stillschweigend, wem die Meldung gehört - wer ein Glas
 *   nachfüllt, hat damit nicht dessen Fristen übernommen. Die richtige Antwort
 *   ist eine Erinnerung, die dem Haushalt gehört; die gibt es im Datenmodell
 *   nicht, und sie einzuführen ist eine Änderung an allen sechs Herkünften,
 *   nicht an dieser.
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
export function syncPantryExpiryReminder(database, item, now = new Date(), denied = null) {
  const drop = () => database.prepare(`
    DELETE FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?
  `).run(item.id);

  if (!item.expires_on || !item.created_by || Number(item.quantity) <= 0) {
    drop();
    return;
  }

  // DIE RECHTEFRAGE STEHT HIER, nicht nur im Voll-Sync. Sie stand dort zuerst,
  // und das war zu wenig an zwei Enden: eine bestehende Meldung überlebte den
  // Entzug, und wer einen Artikel speichert, den ein anderes Mitglied angelegt
  // hat, legte diesem eine neue an - an der Prüfung vorbei. Beide Auslöser
  // fragen jetzt dieselbe Stelle.
  //
  // `denied` ist der Batch-Weg: der Voll-Sync löst die Rechte einmal je Lauf
  // auf statt einmal je Glas. Ohne das Set fragt diese Funktion selbst.
  const blocked = denied ?? usersWithoutPantry(database);
  if (pantryDisabled(database) || blocked.has(item.created_by)) {
    drop();
    return;
  }

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
    drop();
    return;
  }

  // NUR ERSETZEN, WENN SICH DER TERMIN WIRKLICH ÄNDERT. Bedingungsloses
  // Löschen-und-neu-Anlegen sah nach der einfacheren Regel aus und war die
  // teurere: der ±-Stepper ist der häufigste Schreibweg dieses Moduls, und ein
  // Tap auf "einen weniger" hätte eine bereits zugestellte, noch offene Meldung
  // entfernt - endgültig, denn der Vorlauf ist dann verstrichen und niemand
  // legt sie wieder an. Wer eine Menge korrigiert oder einen Namen tippt,
  // ändert nichts an der Frage, wann dieses Glas abläuft.
  const existing = database.prepare(`
    SELECT id, remind_at FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?
  `).get(item.id);
  if (existing?.remind_at === remindAt) return;

  drop();
  // Ein verstrichener Termin wird nicht angelegt: sonst meldete der nächste
  // Lauf sofort, was gerade erst eingetragen wurde.
  if (reminderIsInThePast(remindAt, now)) return;

  database.prepare(`
    INSERT INTO reminders (entity_type, entity_id, remind_at, created_by)
    VALUES ('pantry_item', ?, ?, ?)
  `).run(item.id, remindAt, item.created_by);
}

/**
 * Ist der Vorrat haushaltweit abgeschaltet? Gleiche Lesart wie
 * server/services/countdowns.js#disabledModules - defensiv gegen fehlenden,
 * kaputten oder nicht-Array-Wert: "nichts abgeschaltet" ist die einzige sichere
 * Auslegung, die andere Richtung liesse ein Modul stumm verstummen.
 */
function pantryDisabled(database) {
  const row = database.prepare("SELECT value FROM sync_config WHERE key = 'disabled_modules'").get();
  if (!row?.value) return false;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) && parsed.includes('pantry');
  } catch {
    return false;
  }
}

/**
 * Empfänger, denen der Vorrat entzogen ist (`access_permissions`, #467) - die
 * zweite Achse neben der haushaltweiten Abschaltung, dieselbe Trennung wie in
 * getCountdowns(). Einmal je Lauf aufgelöst statt einmal je Artikel: ein
 * Haushalt hat eine Handvoll Mitglieder und womöglich hunderte Gläser.
 */
export function usersWithoutPantry(database) {
  const users = database.prepare('SELECT id, role, family_role FROM users').all();
  const denied = new Set();
  for (const user of users) {
    if (resolvePermissions(database, user).modules.pantry === 'none') denied.add(user.id);
  }
  return denied;
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
  // ZWEI ACHSEN, EINE ANTWORT (#467, gleiche Trennung wie getCountdowns).
  // `disabled_modules` schaltet den Vorrat für den GANZEN Haushalt ab,
  // `access_permissions` entzieht ihn einem einzelnen Mitglied. Der Router
  // braucht die Prüfung nicht - wer nicht speichern darf, löst keinen Sync aus.
  // Dieser Lauf umgeht den Pfad-Guard und muss sie deshalb selbst stellen,
  // sonst bekäme ein Haushalt Push-Meldungen für ein Modul, das es dort nicht
  // gibt. Eine Rechteregel darf nicht in einer Middleware WOHNEN.
  if (pantryDisabled(database)) {
    database.prepare("DELETE FROM reminders WHERE entity_type = 'pantry_item'").run();
    return;
  }
  const denied = usersWithoutPantry(database);
  // Die Empfänger-Achse gehört IN die Bedingung, nicht hinter sie: sonst
  // filterte sie nur, was neu entsteht, und eine Meldung überlebte den Entzug
  // ihrer Grundlage. Der haushaltweite Zweig oben räumt ab - diese Achse muss
  // dasselbe tun, sonst verhalten sich zwei Formen derselben Sperre verschieden.
  const deniedList = [...denied];
  const deniedPlaceholders = deniedList.map(() => '?').join(', ');
  const NOT_DENIED = deniedList.length ? `AND created_by NOT IN (${deniedPlaceholders})` : '';

  // `date(x) = x` ist die kalendarische Prüfung in SQL: SQLite normalisiert ein
  // '2027-02-30' zu '2027-03-02' und liefert für '2026-13-01' NULL, beides
  // ungleich der Eingabe. Bestandszeilen mit unmöglichem Datum fallen so hier
  // heraus, statt in jedem Lauf erneut in die Rechnung zu geraten und dieselbe
  // Warnung zu schreiben - bei einem Lauf je Minute wären das ~1440 Zeilen
  // Lograuschen am Tag, für einen Artikel, an dem sich nichts ändert.
  const QUALIFIES = `
    expires_on IS NOT NULL AND date(expires_on) = expires_on
    AND created_by IS NOT NULL AND quantity > 0
    ${NOT_DENIED}
  `;

  // GEGENSTANDSLOSES ZUERST: der Artikel ist weg, verbraucht oder hat sein
  // Datum verloren. Auch eine schon zugestellte Meldung geht dann - sie zeigt
  // auf etwas, das die Frage nicht mehr stellt.
  database.prepare(`
    DELETE FROM reminders
    WHERE entity_type = 'pantry_item'
      AND entity_id NOT IN (SELECT id FROM pantry_items WHERE ${QUALIFIES})
  `).run(...deniedList);

  // Fehlende ergänzen. Artikel mit bestehender Zeile stehen gar nicht erst in
  // der Ergebnismenge.
  //
  // UND NUR SOLCHE, DEREN VORLAUF NOCH BEVORSTEHT. Ein Glas, dessen Frist
  // verstrichen ist, erfüllt QUALIFIES für immer und lief sonst in JEDEM Lauf
  // erneut durch Löschen und Datumsrechnung, nur um am Vergangenheits-Riegel zu
  // scheitern - bei hundert Artikeln rund 144.000 sinnlose Statements am Tag.
  // Der Grobschnitt steht in SQL, der genaue Riegel (09:00 UTC) bleibt in JS:
  // der Vorlauf wird als Parameter gebunden, damit die Zahl nicht ein drittes
  // Mal im Baum steht.
  const missing = database.prepare(`
    SELECT id, quantity, expires_on, created_by FROM pantry_items
    WHERE ${QUALIFIES}
      AND date(expires_on, ?) >= date(?)
      AND id NOT IN (SELECT entity_id FROM reminders WHERE entity_type = 'pantry_item')
  `).all(...deniedList, `-${EXPIRY_REMINDER_OFFSET_DAYS} days`, iso(now).slice(0, 10));

  for (const item of missing) syncPantryExpiryReminder(database, item, now, denied);

  // UND EINEN VERALTETEN TERMIN GERADEZIEHEN, aber nur einen, der noch nichts
  // getan hat. Ein Wiederherstellen aus dem Backup oder ein Eingriff von Hand
  // kann `expires_on` ändern, ohne durch den Router zu gehen; dann meldete die
  // alte Zeile zu einem Zeitpunkt, den ihr eigener Text (er kommt beim
  // Zustellen frisch aus dem Artikel) nicht mehr trägt.
  //
  // `pushed_at IS NULL AND dismissed = 0` ist die Grenze: was zugestellt oder
  // weggewischt wurde, bleibt liegen. Es zu ersetzen hiesse, dieselbe Meldung
  // ein zweites Mal zu schicken oder ein Wegwischen zu widerrufen.
  const stale = database.prepare(`
    SELECT r.id, r.remind_at, p.expires_on
    FROM reminders r JOIN pantry_items p ON p.id = r.entity_id
    WHERE r.entity_type = 'pantry_item' AND r.pushed_at IS NULL AND r.dismissed = 0
  `).all();

  const retime = database.prepare('UPDATE reminders SET remind_at = ? WHERE id = ?');
  for (const row of stale) {
    let target;
    try {
      target = reminderDateBefore(row.expires_on, EXPIRY_REMINDER_OFFSET_DAYS);
    } catch {
      // Kann nach dem QUALIFIES-Filter nur eine Zeile sein, die zwischen den
      // beiden Abfragen geändert wurde. Der nächste Lauf räumt sie ab.
      continue;
    }
    if (target === row.remind_at) continue;
    // NIE AUF EINEN VERSTRICHENEN ZEITPUNKT. Dieselbe Regel, mit der
    // syncPantryExpiryReminder() eine solche Zeile gar nicht erst anlegt - hier
    // wiegt sie schwerer: die due-Abfrage kommt im selben Durchgang direkt
    // danach, die Meldung ginge also sofort raus. Und ein spaeter erhoehter
    // Vorlauf wuerde beim ersten Lauf nach dem Update JEDE offene
    // Vorrats-Erinnerung auf einmal ausloesen. Die alte Zeile bleibt dann
    // stehen; der Router zieht sie gerade, sobald jemand den Artikel anfasst.
    if (reminderIsInThePast(target, now)) continue;
    retime.run(target, row.id);
  }
}

/** ISO-Zeitstempel, gleiche Form wie in server/services/notifications.js. */
function iso(date) {
  return new Date(date).toISOString();
}
