/**
 * ZURUECK SCHLIESST, WAS OBEN LIEGT (#871).
 *
 * Auf dem Telefon ist die Wischgeste von links der Zurueck-Knopf, und sie
 * bedeutet dort seit Jahren "eine Ebene raus". Wer einen Termin geoeffnet hat
 * und wischt, meint den Termin - nicht die Seite darunter. Die App tat
 * dagegen beides falsch herum: der Router navigierte im Hintergrund zurueck
 * auf die Uebersicht, und der Dialog blieb offen darueber stehen. Zurueck war
 * damit die einzige Geste, die den Zustand kaputt statt kleiner machte.
 *
 * ── WARUM EIN REGISTER UND NICHT EIN HANDLER JE DIALOG ────────────────────
 *
 * Diese App hat NICHT einen Dialog, sondern ein geteiltes Modal-System und
 * daneben ein Dutzend eigener Overlays (Bildpicker, Belegpicker, Buchungs-
 * picker, Suchblatt, Mehr-Blatt, Onboarding, Dokumentvorschau …). Ein
 * `popstate`-Handler je Overlay hiesse: dreizehn Stellen, die dieselbe
 * Geschichte mit der History fuehren, und die vierzehnte vergisst sie. Hier
 * steht sie einmal; ein Overlay schliesst sich in zwei Zeilen an.
 *
 * ── DER MARKER, UND WARUM ER EINEN EIGENEN EINTRAG BRAUCHT ────────────────
 *
 * `pushOverlay()` legt einen History-Eintrag AUF DERSELBEN Adresse ab. Er
 * aendert nichts an der URL - die Adresse eines Dialogs ist die Seite, auf der
 * er steht, und ein eigener Pfad je Dialog waere eine zweite Routen-Tabelle.
 * Er dient allein dazu, dass die naechste Zurueck-Geste bei UNS landet statt
 * beim Router.
 *
 * ── DIE DREI WEGE AUS EINEM DIALOG, UND DASS SIE SICH NICHT BEISSEN ───────
 *
 * 1. ZURUECK-GESTE: der Browser verlaesst unseren Eintrag und feuert
 *    `popstate`. `handleBackNavigation()` schliesst das oberste Overlay und
 *    meldet dem Router, dass die Geste verbraucht ist. KEIN `history.back()`
 *    von uns - der Eintrag ist schon weg.
 * 2. X / Escape / Speichern: das Overlay schliesst sich selbst und ruft
 *    `dropOverlay()`. Liegt unser Eintrag noch obenauf, muss er zurueck-
 *    gegeben werden, sonst braeuchte die naechste Zurueck-Geste zwei Anlaeufe
 *    - einen fuer den toten Marker, einen fuer die Seite. Dieses `back()`
 *    loest selbst ein `popstate` aus; `pendingSelfPops` faengt genau die ab.
 *    Ein ZAEHLER und kein Boolean: zwei Overlays koennen im selben Tick
 *    schliessen (Datepicker im Formular, beide per Speichern), und das zweite
 *    `back()` duerfte das erste nicht ueberschreiben.
 * 3. ABGELEHNTES SCHLIESSEN: `closeModal()` fragt bei ungespeicherten
 *    Aenderungen zurueck. Sagt der Nutzer "nicht verwerfen", bleibt der Dialog
 *    offen - und braucht seinen Marker zurueck, sonst faehrt die naechste
 *    Zurueck-Geste aus der Seite heraus. Deshalb gibt `handleBackNavigation()`
 *    die Antwort des Schliessers weiter und legt den Marker bei einem Nein neu
 *    an.
 *
 * ── EINE ANNAHME, AUSGESPROCHEN ───────────────────────────────────────────
 *
 * Overlays schliessen in umgekehrter Oeffnungsreihenfolge (LIFO) - was zuletzt
 * aufging, geht zuerst zu. Das ist bei Dialogen keine Vereinfachung, sondern
 * ihre Natur: das obere liegt ueber dem unteren und faengt jeden Klick ab.
 * Schliesst dennoch ein unteres Overlay zuerst, bleibt sein Marker liegen; die
 * naechste Zurueck-Geste findet dann nichts zu schliessen und wird an den
 * Router durchgereicht - eine Geste zu viel, kein falscher Zustand.
 */

// Was gerade offen ist, von unten nach oben. Jeder Eintrag kennt seinen
// Marker und den Weg hinaus.
const stack = [];

let seq = 0;

// Wie viele `popstate`-Ereignisse noch von unseren eigenen `back()`-Aufrufen
// stammen und deshalb nicht als Zurueck-Geste zaehlen.
let pendingSelfPops = 0;

function historyState() {
  return typeof history === 'undefined' ? null : history.state;
}

/**
 * Ein Overlay hat sich geoeffnet: Marker setzen, damit die naechste
 * Zurueck-Geste hier landet.
 *
 * @param {() => (boolean|void|Promise<boolean|void>)} close - schliesst dieses
 *   Overlay. Ein ausdrueckliches `false` heisst "abgelehnt, bleibt offen";
 *   alles andere gilt als geschlossen.
 * @returns {number} Marker fuer `dropOverlay()`.
 */
export function pushOverlay(close) {
  const token = ++seq;
  stack.push({ token, close });
  history.pushState({ ...(historyState() ?? {}), overlay: token }, '', location.href);
  return token;
}

/**
 * Der Anschluss fuer die MODUL-EIGENEN Overlays: ein Knoten, der per
 * `.remove()` verschwindet.
 *
 * Sie sind die Mehrheit (Icon-Picker, Belegvorschau, Buchungspicker,
 * Logopicker, Onboarding, Hilfe …), und sie haben alle dasselbe Muster: kein
 * Lebenszyklus, kein Zustand, nur ein Knoten - dafuer aber DREI bis FUENF
 * Schliesswege (X, Escape, Klick daneben, Auswahl getroffen, Abbrechen), von
 * denen jeder einzeln `remove()` ruft. Ein `dropOverlay()` an jeder dieser
 * Stellen waere fuenfmal dieselbe Zeile und einmal die vergessene.
 *
 * Deshalb wird hier nicht das SCHLIESSEN abgefangen, sondern das VERSCHWINDEN:
 * der Beobachter meldet den Knoten ab, sobald er aus dem Dokument faellt -
 * egal, welcher der fuenf Wege ihn entfernt hat.
 *
 * @param {Element} el - der Overlay-Knoten.
 * @param {() => (boolean|void|Promise<boolean|void>)} close - der EINE Weg
 *   hinaus, den die Zurueck-Geste benutzt.
 */
export function attachOverlay(el, close) {
  const token = pushOverlay(close);
  const entry = stack[stack.length - 1];
  const observer = new MutationObserver(() => {
    if (el.isConnected) return;
    dropOverlay(token);
  });
  observer.observe(document, { childList: true, subtree: true });
  entry.detach = () => observer.disconnect();
  return token;
}

/**
 * Ein Overlay hat sich auf eigenem Weg geschlossen (X, Escape, Speichern).
 * Nimmt es aus dem Register und gibt seinen History-Eintrag zurueck, falls er
 * noch obenauf liegt.
 */
export function dropOverlay(token) {
  const index = stack.findIndex((entry) => entry.token === token);
  if (index === -1) return;
  stack.splice(index, 1)[0].detach?.();

  if (historyState()?.overlay !== token) return;
  pendingSelfPops += 1;
  history.back();
}

/**
 * Der Router fragt bei jedem `popstate`: war das fuer einen Dialog gemeint?
 *
 * @returns {Promise<boolean>} true, wenn die Geste hier verbraucht wurde und
 *   der Router NICHT navigieren soll.
 */
export async function handleBackNavigation() {
  if (pendingSelfPops > 0) {
    pendingSelfPops -= 1;
    return true;
  }

  const entry = stack.pop();
  if (!entry) return false;

  const result = await entry.close();
  if (result !== false) entry.detach?.();
  if (result === false) {
    // Der Dialog bleibt offen (ungespeicherte Aenderungen, Abbruch). Sein
    // Marker ist mit der Geste verbraucht - also einen neuen legen, damit die
    // naechste Zurueck-Geste wieder hier ankommt und nicht aus der Seite
    // hinaus.
    stack.push(entry);
    history.pushState({ ...(historyState() ?? {}), overlay: entry.token }, '', location.href);
  }
  return true;
}

/**
 * Ein Overlay schliesst sich, WEIL gleich navigiert wird (Klick auf ein Ziel im
 * Mehr-Blatt). Nimmt es aus dem Register, ohne die History anzufassen.
 *
 * WARUM NICHT `dropOverlay()`: dessen `history.back()` liefe gegen das
 * `pushState()` der gleich folgenden Navigation - beides im selben Tick, und
 * welches zuerst wirkt, sichert keine Spezifikation zu. Der Marker bleibt
 * stattdessen als TOTER Eintrag liegen; `isStaleOverlayMarker()` erkennt ihn,
 * und die Navigation tritt an seine Stelle, statt sich darueber zu legen.
 */
export function forgetOverlay(token) {
  const index = stack.findIndex((entry) => entry.token === token);
  if (index !== -1) stack.splice(index, 1)[0].detach?.();
}

/**
 * Steht der aktuelle History-Eintrag fuer ein Overlay, das es nicht mehr gibt?
 *
 * Dann ist er ein Platzhalter ohne Inhalt, und die naechste Seite gehoert an
 * SEINE Stelle - sonst kostete ein Wechsel aus dem Mehr-Blatt heraus zwei
 * Zurueck-Gesten fuer einen sichtbaren Schritt.
 */
export function isStaleOverlayMarker() {
  const token = historyState()?.overlay;
  return token != null && !isOverlayOpen(token);
}

/**
 * Steht dieser Marker noch im Register?
 *
 * Ein Overlay, das seinen Marker ueber mehrere Oeffnungen haelt (das
 * Modal-System tut das, siehe `_overlayToken` in modal.js), muss das fragen
 * koennen: nach einem `resetOverlayHistory()` zeigt sein Token ins Leere, und
 * ohne diese Pruefung legte es nie wieder einen an - die Zurueck-Geste waere
 * ab dem naechsten Login still wieder kaputt.
 */
export function isOverlayOpen(token) {
  return stack.some((entry) => entry.token === token);
}

/**
 * Sitzungsende, Sprachwechsel, harter Neuaufbau: das Register vergessen, ohne
 * die History anzufassen. Ein Marker, den niemand mehr einloest, kostet eine
 * Zurueck-Geste - ein Register, das auf entfernte Knoten zeigt, kostet einen
 * Fehler bei jeder folgenden Geste.
 */
export function resetOverlayHistory() {
  for (const entry of stack) entry.detach?.();
  stack.length = 0;
  pendingSelfPops = 0;
}
