/**
 * Modul: Aufgaben-Erledigungen (Verlauf)
 * Zweck: Den Übergang einer Aufgabe nach 'done' als Ereignis festhalten und
 *        wieder abräumen, wenn er zurückgenommen wird - plus die beiden
 *        Lesepfade, die daraus einen Verlauf machen (#791).
 * Abhängigkeiten: better-sqlite3-Handle (synchron), wird vom Aufrufer übergeben;
 *        visibilityWhere aus services/visibility.js.
 *
 * WARUM DAS NEBEN rewards.js STEHT UND NICHT DARIN. Beide hängen am selben
 * Statuswechsel und sehen sich deshalb ähnlich, aber sie beantworten
 * verschiedene Fragen. Der Ledger bucht einen VERDIENST: er geht an die
 * Zuständigen, kann sich auf mehrere teilen, und er existiert nur, wenn die
 * Aufgabe Punkte trägt und das Modul an ist. Ein Verlaufseintrag hält einen
 * VORGANG fest: er passiert einmal, durch genau einen Klick, und er gilt für
 * jede Aufgabe. Eine gemeinsame Funktion müsste diese Unterschiede in Flags
 * ausdrücken, und das wäre die schlechtere Beschreibung von beidem.
 *
 * WAS HIER BEWUSST NICHT AUFGEZEICHNET WIRD: Teilaufgaben. Eine Unteraufgabe
 * ist ein Checklistenpunkt derselben Anweisung (siehe lockingTask in
 * routes/tasks.js) - "Zelt einpacken" neben "Bad geputzt" im selben Verlauf
 * würde die Frage aus #791 schlechter beantworten, nicht besser. Das Ereignis
 * der Serie ist das Abhaken der Hauptaufgabe.
 */

import { visibilityWhere } from './visibility.js';

/**
 * Die Wurzel der Wiederholungskette, in der diese Aufgabe steht - oder ihre
 * eigene ID, wenn sie keiner angehört.
 *
 * Eine wiederkehrende Aufgabe legt beim Abhaken eine Folgeinstanz an, die per
 * `recurrence_origin_id` auf ihren direkten Vorgänger zeigt (spawnRecurrenceFollowup
 * in routes/tasks.js). Die Kette wird also von hinten nach vorn gelesen. Sie
 * kann brechen: `recurrence_origin_id` ist ON DELETE SET NULL, ein gelöschtes
 * Zwischenglied macht seinen Nachfolger zum Anfang einer neuen Serie. Das ist
 * hingenommen und der Grund, warum das Ergebnis beim Schreiben festgehalten
 * wird statt bei jedem Lesen neu zu entstehen: schon geschriebene Einträge
 * bleiben zusammen, auch wenn die Kette später reißt.
 *
 * @param {object} d       better-sqlite3-Connection
 * @param {number} taskId
 * @returns {number} ID der Wurzel (= taskId, wenn die Aufgabe allein steht)
 */
export function seriesRootOf(d, taskId) {
  const row = d.prepare(`
    WITH RECURSIVE chain(id, origin, depth) AS (
      SELECT id, recurrence_origin_id, 0 FROM tasks WHERE id = ?
      UNION ALL
      SELECT t.id, t.recurrence_origin_id, c.depth + 1
        FROM tasks t JOIN chain c ON t.id = c.origin
       WHERE c.depth < 1000
    )
    SELECT id FROM chain ORDER BY depth DESC LIMIT 1
  `).get(taskId);
  return row?.id ?? taskId;
}

/**
 * Erledigung festhalten. Idempotent über den UNIQUE-Index auf `task_id`: trifft
 * derselbe Statuswechsel zweimal ein, bleibt es bei einem Eintrag mit dem
 * ersten Zeitpunkt.
 *
 * @param {object}      d             better-sqlite3-Connection
 * @param {number}      taskId
 * @param {number|null} actingUserId  wer abgehakt hat
 */
export function recordCompletion(d, taskId, actingUserId) {
  const task = d.prepare('SELECT id, parent_task_id FROM tasks WHERE id = ?').get(taskId);
  if (!task || task.parent_task_id) return;
  d.prepare(`
    INSERT OR IGNORE INTO task_completions (task_id, series_id, user_id)
    VALUES (?, ?, ?)
  `).run(taskId, seriesRootOf(d, taskId), actingUserId || null);
}

/**
 * Erledigung zurücknehmen. Löscht statt gegenzubuchen - ein Haken, der dreimal
 * hin und her geht, ist kein Verlauf, sondern Rauschen (dieselbe Entscheidung
 * wie reverseTaskEarnings).
 */
export function revokeCompletion(d, taskId) {
  d.prepare('DELETE FROM task_completions WHERE task_id = ?').run(taskId);
}

/**
 * Kopplung an den Aufgaben-Statuswechsel. Hält beim Übergang nach 'done' fest
 * und räumt beim Verlassen von 'done' ab; alles andere ist ein No-op.
 *
 * Aufzurufen an genau den Stellen, an denen auch `syncTaskRewards` steht - die
 * beiden Wege, auf denen eine Person eine Aufgabe abhakt (PUT /:id über das
 * Formular, PATCH /:id/status über Checkbox, Swipe und Sammelaktion). Das
 * Ablegen ist keiner davon: es ist kein Statuswechsel (#688). Und die
 * Zahlungsaufgabe der Haushaltshilfe, die routes/housekeeping.js direkt auf
 * 'done' setzt, ist es ebenso wenig - sie spiegelt einen Zahlungsstand, es hakt
 * dort niemand etwas ab.
 */
export function syncTaskCompletion(d, taskId, oldStatus, newStatus, actingUserId) {
  const wasDone = oldStatus === 'done';
  const isDone = newStatus === 'done';
  if (isDone && !wasDone) recordCompletion(d, taskId, actingUserId);
  else if (wasDone && !isDone) revokeCompletion(d, taskId);
}

/**
 * Die Sichtbarkeitsregel für den Verlauf - dieselbe, die jede Aufgabenliste
 * anwendet, und deshalb dieselbe Funktion.
 *
 * Sie kommt LIVE aus der Aufgabe, nicht aus dem Eintrag: wer eine Aufgabe
 * nachträglich auf privat stellt, hat sie versteckt, und der Verlauf darf sie
 * danach nicht weiter zeigen. Genau dafür trägt `task_completions` keine eigene
 * Kopie der Stufe.
 */
const VISIBLE_SQL = visibilityWhere('t', 'task_assignments', 'task_id', '@me');

/** Spalten, die beide Lesepfade teilen. */
const SELECT_SQL = `
  SELECT c.id, c.task_id, c.series_id, c.completed_at,
         c.user_id,
         u.display_name  AS user_name,
         u.avatar_color  AS user_color,
         u.avatar_data   AS user_avatar,
         t.title, t.category, t.points, t.is_recurring, t.visibility
    FROM task_completions c
    JOIN tasks t ON t.id = c.task_id
    LEFT JOIN users u ON u.id = c.user_id
`;

/**
 * Der Haushaltsverlauf, neueste zuerst.
 *
 * Geblättert wird über einen Zeit-Cursor statt über OFFSET: während jemand
 * blättert, kann vorn ein Eintrag dazukommen, und ein OFFSET würde dann eine
 * Zeile überspringen, die er nie gesehen hat. `(completed_at, id)` als Paar,
 * weil mehrere Erledigungen in derselben Sekunde landen können - eine
 * Sammelaktion tut genau das.
 *
 * Kein Datumsbereich: die Gruppierung nach Kalendertagen gehört in die
 * Anzeigezone (public/utils/timezone.js), und ein Server, der hier einen
 * `from`-Tag entgegennähme, müsste eine zweite Uhr dafür führen.
 *
 * @param {object} d
 * @param {object} opts
 * @param {number} opts.me       betrachtende Person (Sichtbarkeit)
 * @param {number} [opts.limit]  1..200
 * @param {number} [opts.userId] nur Erledigungen dieser Person
 * @param {string} [opts.beforeAt]  Cursor: `completed_at` des letzten Eintrags
 * @param {number} [opts.beforeId]  Cursor: `id` des letzten Eintrags
 */
export function completionFeed(d, { me, limit = 50, userId = null, beforeAt = null, beforeId = null }) {
  const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const where = [VISIBLE_SQL];
  const params = { me, size };

  if (userId != null) { where.push('c.user_id = @user_id'); params.user_id = userId; }
  if (beforeAt) {
    where.push('(c.completed_at < @before_at OR (c.completed_at = @before_at AND c.id < @before_id))');
    params.before_at = beforeAt;
    params.before_id = Number(beforeId) || 0;
  }

  // Eine Zeile mehr als angefragt: sie beantwortet "gibt es noch mehr", ohne
  // dafür ein zweites COUNT über dieselbe Bedingung zu fahren.
  const rows = d.prepare(`
    ${SELECT_SQL}
    WHERE ${where.join(' AND ')}
    ORDER BY c.completed_at DESC, c.id DESC
    LIMIT @size + 1
  `).all(params);

  const hasMore = rows.length > size;
  return { entries: hasMore ? rows.slice(0, size) : rows, hasMore };
}

/**
 * Die Erledigungen einer Serie, neueste zuerst - "wann war das zuletzt dran"
 * für eine wiederkehrende Aufgabe.
 *
 * Der Einstieg ist irgendeine Instanz der Kette; gefragt wird über ihre Wurzel,
 * damit auch die Instanzen davor mitkommen. Frisch berechnet und nicht aus dem
 * eigenen Eintrag gelesen, weil eine noch offene Aufgabe selbst keinen hat.
 */
export function seriesHistory(d, { me, taskId, limit = 20 }) {
  const size = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return d.prepare(`
    ${SELECT_SQL}
    WHERE c.series_id = @series AND ${VISIBLE_SQL}
    ORDER BY c.completed_at DESC, c.id DESC
    LIMIT @size
  `).all({ me, series: seriesRootOf(d, taskId), size });
}
