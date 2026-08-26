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

import {
  reminderDateBefore, reminderIsInThePast, REMINDER_TIME_SUFFIX, REMINDER_HOUR, REMINDER_MINUTE,
} from '../utils/reminder-schedule.js';
import { todayKey } from '../utils/timezone.js';
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
export function syncPantryExpiryReminder(database, item, now = new Date(), access = null, { clampToNextMorning = false } = {}) {
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
  const { disabled, denied } = access ?? { disabled: pantryDisabled(database), denied: null };
  if (disabled || creatorLacksPantry(database, item.created_by, denied)) {
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

  const existing = database.prepare(`
    SELECT id, remind_at FROM reminders WHERE entity_type = 'pantry_item' AND entity_id = ?
  `).get(item.id);

  const today = todayKey(database, now);

  // SCHON ABGELAUFEN: eine Vorwarnung auf etwas, das die Frist bereits gerissen
  // hat, ist keine Warnung mehr - das sagt der Chip "abgelaufen". Gilt für eine
  // bestehende Zeile genauso wie für eine neue, und steht deshalb VOR allem
  // anderen: nichts weiter unten darf eine solche Meldung retten.
  if (item.expires_on < today) {
    drop();
    return;
  }

  /* FRISCHWARE IST HIER DER HAUPTFALL, NICHT DER AUSREISSER.
   *
   * Das Inventar verwirft einen verstrichenen Termin ersatzlos, und dort ist
   * das richtig: er entsteht nur bei einem zurückdatierten Altgerät. Dieselbe
   * Regel im Vorrat kehrt ihre Wirkung um - Milch, Joghurt und Salat haben beim
   * Einkauf fast immer weniger als sieben Tage MHD. Der Chip färbte sich gelb,
   * und die Meldung, für die dieses Feature gebaut ist, kam für genau diese
   * Artikel nie.
   *
   * Der Termin wird deshalb GEKLEMMT statt verworfen: auf den nächsten 09:00,
   * die ohnehin die Tageszeit jeder Ablaufmeldung sind. Eine Ablaufwarnung ist
   * eine Morgenfrage ("was muss heute weg"), kein Sofortalarm - ohne die
   * Klemmung stünde die Meldung eine Minute nach dem Eintippen im Toast.
   *
   * ABER NUR AUF DIESEM WEG. Der Voll-Sync holt keine verstrichenen Vorläufe
   * nach, weil er nicht weiss, dass gerade jemand gehandelt hat - sonst bekäme
   * ein Haushalt am ersten Morgen nach dem Update jede bald ablaufende Zeile
   * seines Bestands auf einmal. Dieselbe Trennung wie bei "ersetzen vs.
   * ergänzen": der Router weiss um die Handlung, der Lauf nicht. */
  if (clampToNextMorning) {
    if (reminderIsInThePast(remindAt, now)) {
      const soonest = nextMorning(now);

      /* DIE BESTEHENDE ZEILE ZUERST, DANN ERST DIE ABLAUF-FRAGE.
       *
       * Umgekehrt war es ein Loch mit Ansage: ein Artikel, der HEUTE abläuft,
       * trägt seine Meldung auf heute 09:00. Jeder Schreibvorgang danach - ein
       * ±-Tap genügt - fand `nextMorning` auf morgen umgeklappt, verglich das
       * gegen `expires_on` und löschte die fällige, noch nicht zugestellte
       * Meldung. Gemessen: Zeile vorhanden um 09:00, weg nach einem PATCH um
       * 09:30, und `/reminders/pending` filtert nicht auf `pushed_at` - der
       * Toast verschwand ungesehen. Genau der "was muss heute weg"-Fall.
       *
       * `<=` statt `===`: die bestehende Zeile ist gut, solange sie nicht
       * SPÄTER meldet als der frühestmögliche Zeitpunkt. Sie ist genau dann
       * falsch, wenn ein vorgezogenes MHD sie überholt hat.
       *
       * UND SIE MUSS SELBST VOR DEM ABLAUF LIEGEN. Ohne diese zweite Hälfte
       * sprang der Kurzschluss über die Ablauf-Frage hinweg: ein auf morgen
       * geklemmter Termin blieb stehen, nachdem das MHD auf heute korrigiert
       * wurde. Dass daraus keine Meldung nach dem Ablauf wurde, lag allein am
       * DELETE des Voll-Syncs - eine Zusicherung, die diese Funktion oben
       * ausspricht und eine andere einhält, ist keine. */
      if (existing && existing.remind_at <= soonest
          && existing.remind_at.slice(0, 10) <= item.expires_on) return;

      // Eine NEUE Zeile käme dagegen nach dem Ablauf - das wäre keine Warnung.
      if (soonest.slice(0, 10) > item.expires_on) {
        drop();
        return;
      }
      remindAt = soonest;
    } else if (existing?.remind_at === remindAt) {
      // NICHTS ZU TUN. Der ±-Stepper ist der häufigste Schreibweg dieses
      // Moduls; bedingungsloses Löschen-und-neu-Anlegen hätte bei jedem Tap
      // eine bereits zugestellte, noch offene Meldung entfernt. Wer eine Menge
      // korrigiert oder einen Namen tippt, ändert nichts daran, wann dieses
      // Glas abläuft.
      return;
    }
  } else {
    /* DER LAUF SCHNEIDET NACH TAGEN, NICHT NACH DER UHRZEIT - und zwar genau
     * dort, wo der SQL-Grobschnitt der missing-Abfrage schneidet.
     *
     * Mit `reminderIsInThePast` liefen die beiden auseinander: der Grobschnitt
     * liess einen Artikel durch, dessen Vorlauf auf HEUTE fällt, und der Riegel
     * warf ihn ab 09:00 wieder weg. Am nächsten Tag siebte ihn der Grobschnitt
     * aus. Ergebnis: ein Bestandsartikel, dessen Vorwarntag zufällig der Tag
     * des ersten Laufs war, bekam nie eine Erinnerung - je nachdem, ob der Lauf
     * vor oder nach neun Uhr fiel.
     *
     * Ein Termin von heute 09:00 wird deshalb angelegt, auch wenn die Stunde
     * vorbei ist: er geht dann in diesem Durchgang raus, und das ist richtig -
     * die Aussage "läuft in sieben Tagen ab" gilt heute noch. Was WIRKLICH
     * zurückliegt (der Frischware-Fall), bleibt draussen. */
    if (remindAt.slice(0, 10) < today) return;
    if (existing?.remind_at === remindAt) return;
  }

  drop();
  database.prepare(`
    INSERT INTO reminders (entity_type, entity_id, remind_at, created_by)
    VALUES ('pantry_item', ?, ?, ?)
  `).run(item.id, remindAt, item.created_by);
}

/**
 * Der nächste 09:00, der noch bevorsteht - heute, wenn die Uhr ihn noch nicht
 * passiert hat, sonst morgen. In naiv-UTC wie jeder `remind_at`.
 */
function nextMorning(now) {
  const target = new Date(now);
  // Stunde und Minute kommen aus derselben Konstante wie das angestempelte
  // Suffix - sonst waeren es zwei Uhrzeiten, und die zweite entstuende erst
  // beim naechsten Aendern der ersten.
  target.setUTCHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return `${target.toISOString().slice(0, 10)}${REMINDER_TIME_SUFFIX}`;
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
/**
 * Fehlt AUSGERECHNET DIESEM Empfänger der Vorrat? Der Einzelweg fragte über
 * usersWithoutPantry() die Rechte aller Mitglieder auf, um eine einzige Antwort
 * zu bekommen - in einem Sechs-Personen-Haushalt ein Dutzend Abfragen je Tap
 * auf den ±-Stepper. `denied` ist weiterhin der Batch-Weg für den Voll-Sync und
 * den Einkaufs-Import, die die Frage ohnehin für viele Zeilen stellen.
 */
function creatorLacksPantry(database, userId, denied = null) {
  if (denied) return denied.has(userId);
  const user = database.prepare('SELECT id, role, family_role FROM users WHERE id = ?').get(userId);
  if (!user) return true;
  return resolvePermissions(database, user).modules.pantry === 'none';
}

/**
 * Der Zugriffs-Kontext in einem Rutsch, für Aufrufer, die die Frage für viele
 * Zeilen stellen (Voll-Sync, Einkaufs-Import). Ohne ihn beantwortet
 * syncPantryExpiryReminder() sie je Artikel neu - was für einen einzelnen
 * Schreibvorgang richtig ist und für vierzig Importzeilen vierzig identische
 * Abfragen wären.
 */
export function resolvePantryAccess(database) {
  const disabled = pantryDisabled(database);
  return { disabled, denied: disabled ? new Set() : usersWithoutPantry(database) };
}

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
  /* NICHTS ZU TUN HEISST NICHTS ZU FRAGEN. usersWithoutPantry() loest die
   * Rechte JEDES Mitglieds auf, zwei Abfragen je Person - in einem
   * Fuenf-Personen-Haushalt rund 16.000 Statements am Tag, auch wenn im Vorrat
   * kein einziger Artikel ein MHD traegt. Dieselbe Kostenklasse, gegen die die
   * SQL-Vorfilter weiter unten begruendet sind.
   *
   * Beide Seiten muessen leer sein: ohne Artikel mit Datum gibt es nichts
   * anzulegen, ohne bestehende Zeilen nichts abzuraeumen. */
  const anyCandidate = database.prepare(
    'SELECT 1 FROM pantry_items WHERE expires_on IS NOT NULL LIMIT 1'
  ).get();
  const anyReminder = database.prepare(
    "SELECT 1 FROM reminders WHERE entity_type = 'pantry_item' LIMIT 1"
  ).get();
  if (!anyCandidate && !anyReminder) return;

  const denied = usersWithoutPantry(database);
  // Der Zugriffs-Kontext EINMAL je Lauf: die haushaltweite Abschaltung steht
  // zwei Zeilen weiter oben schon fest, und ohne sie hier durchzureichen fragte
  // jeder einzelne Artikel dieselbe sync_config-Zeile erneut ab.
  const access = { disabled: false, denied };
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
  // `today` in der HAUSHALTSZONE, nicht in UTC: derselbe Bezugstag, mit dem
  // syncPantryExpiryReminder() rechnet. Mit `iso(now).slice(0,10)` liefen die
  // beiden westlich von UTC auseinander - ein Artikel, dessen Vorwarntag genau
  // der heutige Haushaltstag ist, fiel im einen Lauf am SQL-Schnitt und im
  // naechsten am JS-Riegel durch und bekam nie eine Erinnerung.
  const today = todayKey(database, now);

  /* "SCHON ABGELAUFEN" GEHOERT IN DIE BEDINGUNG, NICHT IN JEDEN ZWEIG EINZELN.
   *
   * Sie stand nur in syncPantryExpiryReminder(), und der stale-Block hatte sie
   * nicht: eine offene, nie zugestellte Meldung eines vor drei Tagen
   * abgelaufenen Artikels ueberlebte den Lauf und ging im selben Durchgang
   * raus. Hier gilt sie fuer beide Zweige - der DELETE unten raeumt solche
   * Zeilen ab, und in die missing-Menge kommen sie gar nicht erst. */
  const QUALIFIES = `
    expires_on IS NOT NULL AND date(expires_on) = expires_on AND expires_on >= ?
    AND created_by IS NOT NULL AND quantity > 0
    ${NOT_DENIED}
  `;
  const QUALIFIES_PARAMS = [today, ...deniedList];

  // GEGENSTANDSLOSES ZUERST: der Artikel ist weg, verbraucht oder hat sein
  // Datum verloren. Auch eine schon zugestellte Meldung geht dann - sie zeigt
  // auf etwas, das die Frage nicht mehr stellt.
  database.prepare(`
    DELETE FROM reminders
    WHERE entity_type = 'pantry_item'
      AND entity_id NOT IN (SELECT id FROM pantry_items WHERE ${QUALIFIES})
  `).run(...QUALIFIES_PARAMS);

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
  `).all(...QUALIFIES_PARAMS, `-${EXPIRY_REMINDER_OFFSET_DAYS} days`, today);

  for (const item of missing) syncPantryExpiryReminder(database, item, now, access);

  // UND EINEN VERALTETEN TERMIN GERADEZIEHEN, aber nur einen, der noch nichts
  // getan hat. Ein Wiederherstellen aus dem Backup oder ein Eingriff von Hand
  // kann `expires_on` ändern, ohne durch den Router zu gehen; dann meldete die
  // alte Zeile zu einem Zeitpunkt, den ihr eigener Text (er kommt beim
  // Zustellen frisch aus dem Artikel) nicht mehr trägt.
  //
  // `pushed_at IS NULL AND dismissed = 0` ist die Grenze: was zugestellt oder
  // weggewischt wurde, bleibt liegen. Es zu ersetzen hiesse, dieselbe Meldung
  // ein zweites Mal zu schicken oder ein Wegwischen zu widerrufen.
  // DER VERGLEICH STEHT IN SQL, aus demselben Grund wie der Grobschnitt oben:
  // sonst läse dieser Block minütlich jede offene Zeile und rechnete jedes
  // Datum in JS nach, um fast immer nichts zu tun - bei dreihundert Artikeln
  // eine knappe halbe Million Leerdurchläufe am Tag. Der Soll-Termin lässt sich
  // in SQL genauso bilden wie in reminderDateBefore(): Datum minus Vorlauf,
  // Tageszeit angehängt. Beide Bausteine kommen gebunden aus JS, damit weder
  // die Zahl noch die Uhrzeit ein zweites Mal im Baum steht.
  const stale = database.prepare(`
    SELECT r.id, r.remind_at, p.expires_on
    FROM reminders r JOIN pantry_items p ON p.id = r.entity_id
    WHERE r.entity_type = 'pantry_item' AND r.pushed_at IS NULL AND r.dismissed = 0
      AND date(p.expires_on, ?) || ? <> r.remind_at
  `).all(`-${EXPIRY_REMINDER_OFFSET_DAYS} days`, REMINDER_TIME_SUFFIX);

  const retime = database.prepare('UPDATE reminders SET remind_at = ? WHERE id = ?');
  const discard = database.prepare('DELETE FROM reminders WHERE id = ?');
  for (const row of stale) {
    let target;
    try {
      target = reminderDateBefore(row.expires_on, EXPIRY_REMINDER_OFFSET_DAYS);
    } catch {
      // Kann nach dem QUALIFIES-Filter nur eine Zeile sein, die zwischen den
      // beiden Abfragen geändert wurde. Der nächste Lauf räumt sie ab.
      continue;
    }
    // Die SQL-Bedingung hat das schon ausgeschlossen; der Vergleich bleibt als
    // Rückfallebene, falls SQLite und JS das Datum je verschieden formen.
    if (target === row.remind_at) continue;

    /* NIE AUF EINEN VERSTRICHENEN ZEITPUNKT: die due-Abfrage kommt im selben
     * Durchgang direkt danach, die Meldung ginge also sofort raus. Und ein
     * spaeter erhoehter Vorlauf wuerde beim ersten Lauf nach dem Update jede
     * offene Vorrats-Erinnerung auf einmal ausloesen.
     *
     * STEHENLASSEN IST TROTZDEM FALSCH, und das war der Fehler hier: die Zeile
     * ist ja nicht zufaellig anders, sie ist NACHWEISLICH ueberholt. Gemessen:
     * MHD am Router vorbei von Oktober auf September gezogen, `remind_at` blieb
     * auf dem Oktobertermin - die Vorwarnung waere drei Wochen NACH dem Ablauf
     * gekommen. Das ist keine Vorwarnung mehr.
     *
     * Also dieselbe Behandlung wie im Router, mit derselben Begruendung: so
     * frueh wie moeglich, solange das noch vor dem Ablauf liegt, und weg, wenn
     * nicht. Das ist keine Nachholung - die Zeile existiert bereits, korrigiert
     * wird nur ihr Zeitpunkt. Und sie ist nach der WHERE-Klausel weder
     * zugestellt noch weggewischt, ein Doppel-Push also ausgeschlossen. */
    if (reminderIsInThePast(target, now)) {
      const soonest = nextMorning(now);
      // BESTEHENDE ZEILE ZUERST, wie im Router: eine Meldung, die schon so
      // frueh wie moeglich steht, darf dieser Lauf nicht wegen der Ablauffrage
      // loeschen - sie ist genau die, die heute rausgehen soll. Dass der Artikel
      // ueberhaupt noch laeuft, hat der DELETE-Zweig oben schon sichergestellt.
      if (row.remind_at <= soonest && row.remind_at.slice(0, 10) <= row.expires_on) continue;
      if (soonest.slice(0, 10) > row.expires_on) { discard.run(row.id); continue; }
      retime.run(soonest, row.id);
      continue;
    }
    retime.run(target, row.id);
  }
}

