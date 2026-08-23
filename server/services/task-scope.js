/**
 * Modul: Aufgaben-Auswahl (geteilte Abfrage-Logik)
 * Zweck: Welche Aufgaben überhaupt in eine Liste gehören - zentral, damit
 *        Aufgaben-Route und Dashboard exakt dieselbe Auswahl treffen.
 * Abhängigkeiten: keine
 *
 * WARUM ALS SERVICE: `GET /api/v1/tasks` und `GET /api/v1/dashboard` beantworten
 * dieselbe Frage („welche Aufgaben stehen an?") und hatten dafür zwei Kopien der
 * Regeln, die auseinandergelaufen sind. Das Modul schloss Unteraufgaben und noch
 * nicht begonnene Aufgaben aus, das Dashboard nicht - eine Unteraufgabe stand
 * dort als kontextlose eigene Zeile, und eine Aufgabe mit Startdatum nächste
 * Woche stand heute schon da (Discussion #825). Dieselbe Sorte Divergenz hat
 * schon #467 (Modulrechte) und #769 (Sichtbarkeit beim Ablegen) verursacht.
 * Vorbild ist `calendar-events.js`, das Kalender-Route und Dashboard seit jeher
 * teilen.
 *
 * WAS HIER NICHT HINEINGEHÖRT: die Filter, die nur eine Seite kennt - Status,
 * Priorität, Person, Kategorie, Tags und die Archiv-Achse (#688) mit ihrer
 * Verschränkung von `?archived` und `?status=archived`. Das sind Wünsche des
 * Betrachters an eine Liste, keine Aussage darüber, was eine Liste überhaupt
 * enthalten darf. Nur die zwei Regeln, die beide Seiten brauchen und über die
 * sie sich uneinig waren, stehen hier.
 *
 * Guards: test/test-task-scope.js
 */

/**
 * WHERE-Fragment für die Grundauswahl einer Aufgabenliste.
 *
 * Gebaut wie `visibilityWhere()`: ein Fragment ohne führendes AND, mit
 * konfigurierbarem Platzhalter. WER `includeFuture` NICHT SETZT, MUSS DEN
 * TAGESSCHLÜSSEL BINDEN - bei `bind: '?'` an genau der Stelle, an der das
 * Fragment in die Anweisung eingesetzt wird.
 *
 * Der Tag kommt bewusst als Parameter und nicht als `date('now')` aus SQLite:
 * das wäre der UTC-Tag, während `start_date` ein lokal eingegebener Kalendertag
 * ist. Westlich von UTC hätte eine Aufgabe damit am Abend vor ihrem Startdatum
 * schon angefangen, östlich davon am Morgen danach noch nicht. Die CI läuft in
 * UTC, wo beide Tage gleich sind - genau deshalb fällt so etwas dort nie auf
 * (CLAUDE.md führt diese Falle, `dashboard.js` erklärt sie an `todayLocalKey`).
 *
 * @param {string} alias  Tabellen-Alias der Aufgaben (z. B. 't')
 * @param {object} [opts]
 * @param {boolean} [opts.includeFuture]   true = auch Aufgaben, die erst später
 *                                         beginnen (kein Bind nötig)
 * @param {boolean} [opts.includeSubtasks] true = auch Unteraufgaben als eigene Zeilen
 * @param {string}  [opts.bind]            Platzhalter des lokalen Tagesschlüssels:
 *                                         '?' (positional) oder benannt wie '@today'
 * @returns {string} SQL-Fragment (ohne führendes AND), nie leer
 */
export function taskScopeWhere(alias, { includeFuture = false, includeSubtasks = false, bind = '?' } = {}) {
  const parts = [];

  // Eine Unteraufgabe ist ein Punkt ihrer Elternaufgabe, kein eigener
  // Listeneintrag: allein gezeigt fehlt ihr der Satz, zu dem sie gehört.
  if (!includeSubtasks) parts.push(`${alias}.parent_task_id IS NULL`);

  // `start_date` ist Yuvomis „ab wann taucht das auf" - eine Aufgabe ohne
  // Startdatum gilt als sofort begonnen.
  if (!includeFuture) parts.push(`(${alias}.start_date IS NULL OR ${alias}.start_date <= ${bind})`);

  // Beide Schalter zugleich gesetzt: das Fragment ist dann bedingungslos wahr.
  // Ein leerer String würde beim Aufrufer zu `AND ` und damit zu einem
  // Syntaxfehler - `1=1` hält die Verkettung an jeder Aufrufstelle gültig.
  return parts.length ? parts.join(' AND ') : '1=1';
}

/**
 * Braucht diese Konfiguration einen gebundenen Tagesschlüssel?
 * Für Aufrufer mit positionalen Platzhaltern, die ihre Parameterliste selbst
 * führen und sonst raten müssten, ob sie einen Wert nachschieben.
 *
 * @param {object} [opts] dieselben Optionen wie `taskScopeWhere`
 * @returns {boolean}
 */
export function taskScopeNeedsToday({ includeFuture = false } = {}) {
  return !includeFuture;
}
