/**
 * Der FAB fährt beim Abwärtsscrollen weg.
 *
 * WARUM: Der FAB ist `position: fixed` in der unteren rechten Ecke. Listen,
 * deren Zeilen dort eine Bedienung tragen, verlieren sie unter ihm. Gemessen
 * (Critique 2026-07-30): 14 Überdeckungen über 4 Routen × 4 Viewports × 3
 * Scrollstände, Maximum 53.2% auf dem Löschen einer Rezeptzeile, 39.8% auf dem
 * Warenkorb einer Vorratszeile bei 320px.
 *
 * `--fab-clearance` polstert nur das Listen-ENDE und löst deshalb nur den Fall
 * „letzte Zeile". Die zweite bisherige Antwort war eine reservierte Gasse pro
 * Zeile (`--fab-lane`, 76px): kollisionsfrei, aber sie kostete bei 320px 24% der
 * Viewportbreite und kürzte Artikelnamen auf vier lesbare Zeichen. Das Modul
 * hatte damit zwei entgegengesetzte Antworten auf dasselbe Problem, und beide
 * waren falsch.
 *
 * DIE ENTSCHEIDUNG: kein horizontaler Platz, sondern Zeit. Wer nach unten
 * scrollt, sucht eine Zeile; solange er sucht, ist der FAB im Weg und
 * verschwindet.
 *
 * ZURÜCK KOMMT ER NICHT PER TIMER. Ein Idle-Timer wäre die naheliegende Wahl und
 * die falsche: nach dem Scrollen greift der Nutzer genau JETZT nach der
 * Zeilenaktion, und der FAB wäre in genau diesem Moment wieder da. Er kommt
 * deshalb nur zurück, wenn der Nutzer
 *
 *   - nach oben scrollt (er sucht nicht mehr, er navigiert),
 *   - am Listenanfang steht, oder
 *   - am Listenende steht (dort garantiert --fab-clearance denselben Freiraum).
 *
 * Damit gibt es immer einen deterministischen Weg zurück, ohne dass der Knopf
 * sich in die Bedienung drängt. Zusätzlich bleibt er per `n`-Shortcut erreichbar
 * (siehe router.js) - der Weg für Tastaturnutzer ist von dieser Mechanik
 * unberührt.
 *
 * WIDERLEGT (Critique 2026-07-30): Hier stand als Begründung für den Listenanfang
 * „dort liegt keine Zeile unter ihm". Das war falsch, und zwar messbar - bei
 * `scrollTop = 0` lagen auf 5 von 6 geprüften Route/Viewport-Kombinationen
 * Zeilenaktionen unter dem FAB, bis 80,6% (phoneSm /pantry, „Menge erhöhen:
 * Spaghetti"). 15 blockierende Überdeckungen über die geprüften Stände.
 *
 * SEITHER GELÖST, aber nicht hier: `--fab-safe-zone` verkürzt den Scrollport
 * (Marge an .app-content, layout.css), sodass unter dem FAB bei JEDEM
 * Scrollstand nichts Bedienbares mehr liegen kann. Nachgemessen über vier
 * Routen × fünf Scrollstände im Ruhezustand des FAB: 0 Überdeckungen.
 *
 * WAS DAS FÜR DIESE DATEI HEISST: Der Retract ist kein Kollisionsschutz mehr -
 * seine Begründung ist entfallen. Er bleibt vorerst als Sicht-Komfort beim
 * Scrollen (mehr Liste im Blick), aber das ist eine schwächere Rechtfertigung
 * als die ursprüngliche, und er kostet etwas: die Primäraktion verschwindet
 * beim Abwärtsscrollen, ohne dass sie noch im Weg wäre. Das Modul hatte schon
 * einmal zwei entgegengesetzte Antworten auf dasselbe Problem (Gasse und
 * Freiraum-Padding); wer hier aufräumt, kann diese Mechanik ersatzlos
 * entfernen - `.page-fab--retracted` in layout.css und den Aufruf in router.js
 * gleich mit.
 */

const RETRACTED = 'page-fab--retracted';

/** Kumulierte Abwärtsstrecke, bevor der FAB weicht. Unter diesem Wert bleibt er
 *  stehen, damit ein Wackeln am Trackpad ihn nicht flackern lässt. */
const DOWN_THRESHOLD = 24;

/** Toleranz für „am Ende": Sub-Pixel-Layouts treffen scrollHeight selten exakt. */
const BOTTOM_SLACK = 4;

let installed = false;
const lastTop = new WeakMap();
let downRun = 0;

function currentFab() {
  return document.querySelector('.page-fab');
}

/** Der FAB darf nicht wegfahren, während er benutzt wird. */
function isBusy(fab) {
  return document.activeElement === fab || fab.getAttribute('aria-expanded') === 'true';
}

function onScroll(event) {
  const el = event.target;
  // `document` feuert auch für das Dokument selbst; dort gibt es kein scrollTop.
  if (!el || el === document) return;

  const fab = currentFab();
  if (!fab) return;

  const top = el.scrollTop;
  const height = el.scrollHeight;
  const client = el.clientHeight;
  // Nicht scrollbare Container melden ebenfalls scroll (z. B. bei Fokus-Sprüngen).
  if (height <= client) return;

  const previous = lastTop.get(el);
  lastTop.set(el, top);
  if (previous === undefined) return;

  const delta = top - previous;
  const atTop = top <= 0;
  const atBottom = top + client >= height - BOTTOM_SLACK;

  if (atTop || atBottom || delta < 0) {
    downRun = 0;
    fab.classList.remove(RETRACTED);
    return;
  }

  if (delta > 0) {
    downRun += delta;
    if (downRun >= DOWN_THRESHOLD && !isBusy(fab)) {
      fab.classList.add(RETRACTED);
    }
  }
}

/**
 * Installiert den Mechanismus. Idempotent, also unschädlich bei jedem
 * Seitenwechsel aufrufbar.
 *
 * EIN Listener auf `document` in der Capture-Phase, nicht einer pro Scroller:
 * `scroll` steigt nicht auf, wird in der Capture-Phase aber durchgereicht. Jede
 * Seite hat einen anderen Scrollport (die Modul-Roots der Küche sind
 * `overflow: hidden`, die Liste darin scrollt), und ein Listener pro Seite würde
 * bei jeder Navigation neu verdrahtet werden müssen. So gibt es keinen
 * Lebenszyklus, der lecken kann.
 */
export function installFabRetract() {
  if (installed) return;
  installed = true;
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
}
