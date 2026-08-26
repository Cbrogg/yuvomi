/**
 * Tests: Zurueck schliesst, was oben liegt (#871)
 * Modul: /public/utils/overlay-history.js
 *
 * WARUM EIN VERHALTENSTEST UND KEIN QUELLTEXT-GUARD: die drei Wege aus einem
 * Dialog (Zurueck-Geste, X, abgelehntes Verwerfen) unterscheiden sich nicht im
 * Code, sondern in der REIHENFOLGE, in der History-Eintraege entstehen und
 * verschwinden. Genau dort steckt der Fehler, den man einbaut - ein doppeltes
 * `history.back()`, ein Marker, der liegen bleibt, ein `popstate`, das man fuer
 * eine Nutzergeste haelt, obwohl man es selbst ausgeloest hat. Ein Test auf
 * „ruft `pushState` auf" waere gruen und blind.
 *
 * Die History-Attrappe fuehrt deshalb einen echten Stapel und stellt
 * `popstate` genau so zu, wie der Browser es tut: `back()` wirkt nicht
 * synchron, sondern in einem spaeteren Tick.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --------------------------------------------------------
// History-Attrappe
// --------------------------------------------------------

function makeHistory() {
  const entries = [{ path: '/dashboard' }];
  let index = 0;
  // Was der Router tun WUERDE, wenn die Geste nicht fuer einen Dialog war.
  const navigations = [];
  let onPop = null;

  const fake = {
    get state() { return entries[index]; },
    get length() { return entries.length; },
    get depth() { return index; },
    pushState(state) {
      entries.splice(index + 1);
      entries.push(state);
      index = entries.length - 1;
    },
    replaceState(state) {
      entries[index] = state;
    },
    back() {
      // Der Browser feuert `popstate` NICHT synchron. Ein Test, der das
      // annimmt, verdeckt genau die Verschraenkung, die hier gefaehrlich ist.
      queueMicrotask(() => {
        if (index === 0) return;
        index -= 1;
        onPop?.(entries[index]);
      });
    },
    setPopHandler(fn) { onPop = fn; },
    navigations,
  };
  return fake;
}

/**
 * Frische Modulinstanz je Test - das Register ist Modulzustand, und ein
 * Test, der den eines anderen erbt, misst nicht mehr, was er behauptet.
 */
let instanceSeq = 0;

async function freshModule() {
  const history = makeHistory();
  globalThis.history = history;
  globalThis.location = { href: '/dashboard' };
  const mod = await import(`../public/utils/overlay-history.js?instance=${++instanceSeq}`);
  history.setPopHandler(async (state) => {
    const handled = await mod.handleBackNavigation();
    if (!handled) history.navigations.push(state?.path ?? null);
  });
  return { ...mod, history };
}

// Der Attrappen-`back()` laeuft in einem Microtask, `handleBackNavigation` ist
// async - zwei Runden reichen sicher, bis beides durch ist.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// --------------------------------------------------------

test('die Zurueck-Geste schliesst den Dialog, statt die Seite zu wechseln', async () => {
  const { pushOverlay, history } = await freshModule();

  let closed = 0;
  pushOverlay(() => { closed += 1; });
  assert.equal(history.depth, 1, 'der Dialog legt einen eigenen History-Eintrag an');

  history.back();
  await settle();

  assert.equal(closed, 1, 'der Dialog wurde geschlossen');
  assert.deepEqual(history.navigations, [],
    'der Router hat NICHT navigiert - genau das war der gemeldete Fehler (#871)');
  assert.equal(history.depth, 0, 'der Marker ist verbraucht');
});

test('eine zweite Zurueck-Geste wechselt dann die Seite', async () => {
  const { pushOverlay, history } = await freshModule();

  // Erst eine echte Seite, sonst hat der Stapel unter dem Dialog gar keinen
  // Vorgaenger - wie im Browser, der die App dann verlaesst.
  history.pushState({ path: '/calendar' });
  pushOverlay(() => {});

  history.back();
  await settle();
  assert.deepEqual(history.navigations, [], 'die erste Geste gehoert dem Dialog');

  history.back();
  await settle();
  assert.deepEqual(history.navigations, ['/dashboard'],
    'ohne offenen Dialog gehoert die Geste wieder dem Router');
});

test('das X gibt seinen Marker zurueck - die naechste Geste braucht keinen Leerlauf', async () => {
  const { pushOverlay, dropOverlay, history } = await freshModule();

  const token = pushOverlay(() => { throw new Error('darf nicht aufgerufen werden'); });
  dropOverlay(token);
  await settle();

  assert.equal(history.depth, 0, 'der Marker ist zurueckgegeben');
  assert.deepEqual(history.navigations, [],
    'das eigene back() darf nicht als Nutzergeste durchgehen - sonst navigiert '
    + 'der Router beim Schliessen per X');
});

test('zwei Overlays, die im selben Tick schliessen, verbrauchen beide Marker', async () => {
  // Der Grund fuer den ZAEHLER statt eines Booleans in `pendingSelfPops`.
  const { pushOverlay, dropOverlay, history } = await freshModule();

  const outer = pushOverlay(() => {});
  const inner = pushOverlay(() => {});
  assert.equal(history.depth, 2);

  dropOverlay(inner);
  dropOverlay(outer);
  await settle();

  assert.deepEqual(history.navigations, [],
    'beide back() stammen von uns; ein Boolean haette das zweite als Geste gewertet');
});

test('das obere Overlay geht zuerst zu, das untere bleibt', async () => {
  const { pushOverlay, history } = await freshModule();

  const order = [];
  pushOverlay(() => { order.push('unten'); });
  pushOverlay(() => { order.push('oben'); });

  history.back();
  await settle();
  assert.deepEqual(order, ['oben'], 'die Geste meint das oberste Overlay');

  history.back();
  await settle();
  assert.deepEqual(order, ['oben', 'unten']);
  assert.deepEqual(history.navigations, [], 'erst die dritte Geste gehoert dem Router');
});

test('ein abgelehntes Schliessen bekommt seinen Marker zurueck', async () => {
  // Ungespeicherte Aenderungen, „nicht verwerfen": der Dialog bleibt offen -
  // und muss die naechste Geste wieder abfangen, statt sie aus der Seite
  // hinauslaufen zu lassen.
  const { pushOverlay, history } = await freshModule();

  let allow = false;
  pushOverlay(() => (allow ? undefined : false));

  history.back();
  await settle();
  assert.equal(history.depth, 1, 'der Marker wurde neu gelegt');
  assert.deepEqual(history.navigations, [], 'die Geste ist verbraucht, nicht weitergereicht');

  allow = true;
  history.back();
  await settle();
  assert.equal(history.depth, 0);
  assert.deepEqual(history.navigations, [], 'auch der zweite Anlauf bleibt beim Dialog');
});

test('ein Overlay, das beim Navigieren schliesst, hinterlaesst keinen Zwischenschritt', async () => {
  // Das Mehr-Blatt und die Suche schliessen sich, WEIL gleich navigiert wird.
  // Ein `back()` liefe hier gegen das `pushState` der Navigation im selben
  // Tick; stattdessen tritt die neue Seite an die Stelle des toten Markers.
  const { pushOverlay, forgetOverlay, isStaleOverlayMarker, history } = await freshModule();

  const token = pushOverlay(() => {});
  forgetOverlay(token);

  assert.equal(isStaleOverlayMarker(), true,
    'der Eintrag traegt einen Marker, den das Register nicht mehr kennt');
  history.replaceState({ path: '/notes' });

  history.back();
  await settle();
  assert.deepEqual(history.navigations, ['/dashboard'],
    'EINE Geste fuehrt zurueck auf die Ausgangsseite, nicht auf einen leeren Zwischenschritt');
});

test('ein noch offener Dialog macht seinen Marker nicht zum Platzhalter', async () => {
  const { pushOverlay, isStaleOverlayMarker } = await freshModule();
  pushOverlay(() => {});
  assert.equal(isStaleOverlayMarker(), false,
    'sonst ersetzte eine Navigation den Marker eines Dialogs, der noch steht');
});

test('nach einem Sitzungsende legt dasselbe Overlay wieder einen Marker an', async () => {
  // modal.js haelt EINEN Marker ueber viele Dialoge hinweg. Ohne
  // `isOverlayOpen` bliebe sein Token nach dem Reset auf einem Wert stehen,
  // und die Zurueck-Geste waere ab dem naechsten Login still wieder kaputt.
  const { pushOverlay, isOverlayOpen, resetOverlayHistory } = await freshModule();

  const token = pushOverlay(() => {});
  assert.equal(isOverlayOpen(token), true);

  resetOverlayHistory();
  assert.equal(isOverlayOpen(token), false);
});

test('ein Overlay meldet sich ab, wenn sein Knoten aus dem Dokument faellt', async () => {
  // `attachOverlay` faengt nicht das Schliessen ab, sondern das Verschwinden -
  // der Grund: die modul-eigenen Overlays haben drei bis fuenf Schliesswege,
  // die alle einzeln `remove()` rufen.
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  globalThis.document = {};

  const { attachOverlay, history } = await freshModule();

  const el = { isConnected: true };
  attachOverlay(el, () => { throw new Error('darf nicht aufgerufen werden'); });
  assert.equal(history.depth, 1);

  // Irgendeiner der Schliesswege hat den Knoten entfernt.
  el.isConnected = false;
  observers[0].cb();
  await settle();

  assert.equal(history.depth, 0, 'der Marker ist zurueckgegeben');
  assert.equal(observers[0].disconnected, true, 'der Beobachter laeuft nicht weiter');
  assert.deepEqual(history.navigations, []);
});
