/**
 * Modul: Dokument-Guards (Guard-Ebene 4 des Redesigns)
 * Zweck: Invarianten pruefen, die nur das GERENDERTE Dokument kennt. Das
 *        Stylesheet zeigt sie nicht: ein Ueberlauf kann von
 *        `overflow-x: hidden` verdeckt sein, eine Zielgroesse misst keine
 *        Textsuche, und ein Kontrastverstoss kann erst durch die Komposition
 *        zweier Regeln entstehen, deren Token-Paare je fuer sich AA halten.
 * Ausfuehren: npm run test:document-guards   (braucht Browser + Serverprozess)
 *
 * NICHT in `npm test`: die uebrige Kette ist netzfrei und serverlos und soll
 * das bleiben. test-suite-chain.js kennt die Zweiteilung als Regel (eine Suite,
 * die `puppeteer` importiert, gehoert in die Browser-Kette), nicht als
 * Namensausnahme.
 *
 * Der Harness (test/document-guards-harness.js) faehrt Server und Browser hoch.
 * Waehrend der Entwicklung zeigt `DOCUMENT_GUARDS_BASE_URL` auf einen bereits
 * laufenden Preview-Server und spart Migration + Seed.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  ROUTES,
  startHarness,
  openPage,
  gotoRoute,
  parseColor,
  composite,
  contrastRatio,
  toHex,
} from './document-guards-harness.js';

const ROUTE_NAMES = Object.keys(ROUTES);
let harness;

before(async () => {
  harness = await startHarness();
});

after(async () => {
  await harness?.close();
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sonde 1: Kopf-Ueberlauf
 *
 * Der Modulkopf ist die einzige Komponente, die alle 17 Module teilen, und die
 * Stelle, an der ein Ueberlauf unsichtbar bleibt: `main.app-content` traegt
 * `overflow-x: hidden`, also wird abgeschnitten statt scrollbar. Gemessen im
 * Architektur-Audit: der Kopf der Haushaltshilfe ragte bei 375px 79px ueber die
 * rechte Kante, Titel und rechte Tabs waren teilweise unerreichbar.
 *
 * Die Regel prueft NACHFAHREN, nicht nur Kinder: eine Tab-Leiste im Kopf darf
 * ihre Tabs ueberlaufen lassen, WENN sie selbst scrollt oder clippt. Deshalb
 * wird jeder Nachfahre uebersprungen, dessen Weg zur Toolbar durch einen
 * Container mit nicht-sichtbarem overflow-x fuehrt - genau die Bauart, die die
 * Shell-Regel vorschreibt.
 *
 * Sprachen: `de` als Referenz, `uk` und `vi` als die beiden Locales mit den
 * laengsten Modulnamen. Ein Kopf, der in allen dreien passt, passt.
 * ──────────────────────────────────────────────────────────────────────────── */

const OVERFLOW_LOCALES = ['de', 'uk', 'vi'];

async function measureHeadOverflow(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    const selector = (el) => {
      const cls = [...el.classList].filter((c) => !c.startsWith('is-')).join('.');
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
    };
    for (const bar of document.querySelectorAll('.page-toolbar')) {
      const barRect = bar.getBoundingClientRect();
      if (!barRect.width || !barRect.height) continue;
      const walk = (el, clipped) => {
        for (const child of el.children) {
          const cs = getComputedStyle(child);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = child.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          if (!clipped) {
            const over = Math.round(Math.max(r.right - vw, -r.left));
            if (over > 1) {
              out.push({
                toolbar: selector(bar),
                el: selector(child),
                over,
                width: Math.round(r.width),
              });
            }
          }
          const clips = cs.overflowX !== 'visible';
          walk(child, clipped || clips);
        }
      };
      const barOver = Math.round(Math.max(barRect.right - vw, -barRect.left));
      if (barOver > 1) {
        out.push({ toolbar: selector(bar), el: '(die Leiste selbst)', over: barOver, width: Math.round(barRect.width) });
      }
      walk(bar, false);
    }
    return out;
  });
}

describe('Sonde 1 - kein Modulkopf laeuft bei 375px ueber die Viewport-Kante', () => {
  for (const locale of OVERFLOW_LOCALES) {
    test(`Locale ${locale}`, async () => {
      const page = await openPage(harness, { device: 'mobile', theme: 'light', locale });
      const findings = [];
      for (const name of ROUTE_NAMES) {
        await gotoRoute(page, ROUTES[name]);
        for (const f of await measureHeadOverflow(page)) {
          findings.push(`${name}/${locale}: ${f.el} in ${f.toolbar} ragt ${f.over}px hinaus (Breite ${f.width}px)`);
        }
      }
      await page.close();
      assert.deepEqual(
        findings,
        [],
        `Kopf-Ueberlauf bei 375px. Die Shell-Regel lautet: eine .page-toolbar bleibt in ` +
          `Zeilenrichtung, und eine Tab-Leiste im Kopf ist eine eigene, horizontal ` +
          `scrollende Zeile darunter (layout.css, Sektion "Tab-Leiste im Modulkopf").\n  ` +
          findings.join('\n  '),
      );
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sonde 2: komponierter Textkontrast
 *
 * Der bestehende Guard `Textfarbe auf vividen Fuellflaechen haelt WCAG AA in
 * beiden Themes` (test-frontend-audit.js) prueft TOKEN-PAARE. Er kann einen
 * Verstoss nicht sehen, der erst im Dokument entsteht - etwa wenn ein
 * Nachfahren-Selektor mit hoeherer Spezifitaet Sekundaertext in einen
 * gefuellten Knopf hineinschreibt (gemessen: 1.13:1 im Light, 1.29:1 im Dark,
 * seit Runde 1 live).
 *
 * Gemessen wird der EFFEKTIVE Hintergrund: die Kette der Vorfahren wird
 * komponiert, bis eine deckende Flaeche erreicht ist. Alpha und `color-mix`
 * zaehlen dabei mit - `color-mix()` rendert als `color(srgb …)` und nicht als
 * `rgba()`, ein naiver Parser meldet hier Fehltreffer.
 *
 * Verlaeufe zaehlen als Kandidaten (siehe evaluateSample); bliebe die Sonde an
 * ihnen stehen, hoerte sie bei `.app-shell` auf zu messen - dreissig Elemente
 * je Route. Deaktivierte Bedienelemente sind ausgenommen, die nimmt WCAG 1.4.3
 * aus. Nur ein echtes Bild bleibt unrechenbar, und die Zahl steht im
 * Fehlertext, damit ein Anstieg auffaellt.
 * ──────────────────────────────────────────────────────────────────────────── */

async function collectTextSamples(page) {
  return page.evaluate(() => {
    const out = [];
    const selector = (el) => {
      const cls = [...el.classList].filter((c) => !c.startsWith('is-')).join('.');
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el = walker.currentNode;
    while (el) {
      el = walker.nextNode();
      if (!el) break;
      if (el.closest('[aria-hidden="true"], .sr-only, yuvomi-install-prompt')) continue;
      if (el.matches(':disabled') || el.closest(':disabled, [aria-disabled="true"]')) continue;
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      if (!text) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      // Die VOLLE Untergrund-Kette bis zum Wurzelelement einsammeln, roh. Wo
      // sie deckend wird und ob ein Verlauf dazwischenliegt, entscheidet Node -
      // so existiert der Farbparser genau einmal (im Harness) statt zweimal in
      // zwei Sprachen.
      //
      // BEKANNTE GRENZE, gemessen statt vermutet: die Kette ist der BAUM. Eine
      // Flaeche, die unter dem Text liegt, ohne ihn zu enthalten - die absolut
      // positionierte Pille der Tab-Bar gleitet als GESCHWISTER des aktiven
      // Eintrags -, faellt heraus. Gegen den gerenderten Pixel geprueft: die
      // Sonde meldet dort 4.20:1, das Bild zeigt 3.41:1. Sie findet den Fall
      // also, urteilt aber zu milde. Ein Versuch ueber `elementsFromPoint`
      // machte es SCHLECHTER statt besser (die Pille traegt
      // `pointer-events: none` und faellt aus dem Stapel, dafuer verschwand der
      // Befund ganz) - der ehrliche naechste Schritt waere der gerenderte
      // Pixel, nicht der Elementstapel.
      const layers = [];
      let node = el;
      while (node) {
        const ncs = getComputedStyle(node);
        layers.push({ bg: ncs.backgroundColor, image: ncs.backgroundImage });
        node = node.parentElement;
      }
      out.push({
        selector: selector(el),
        text: text.slice(0, 40),
        color: cs.color,
        size: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        layers,
      });
    }
    return out;
  });
}

/**
 * Zerlegt einen `background-image`-Wert in seine Farbstops.
 * @returns {null|string[]} null, wenn ein echtes Bild im Spiel ist (dann ist
 *          der Untergrund nicht rechenbar), sonst die Stops eines Verlaufs.
 */
function gradientStops(image) {
  if (!image || image === 'none') return [];
  if (/url\(/i.test(image)) return null;
  return [...image.matchAll(/color\(srgb[^)]*\)|rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi)].map((m) => m[0]);
}

/**
 * Komponiert den effektiven Untergrund eines Textelements und liefert den
 * SCHLECHTESTEN Kontrast, den er dort haben kann.
 *
 * WARUM EIN SCHLECHTESTER FALL UND KEIN EINZELWERT: `.app-shell` trägt
 * radiale Verläufe über dem Seitengrund. Eine Sonde, die bei einem Verlauf
 * aufgibt, hört genau dort auf zu messen, wo die meisten Texte stehen - rund
 * dreissig Elemente je Route, also die Hälfte des Dokuments. Deshalb werden
 * die Farbstops als Kandidaten behandelt: jeder wird auf den bisherigen
 * Untergrund komponiert, und es zählt der ungünstigste. Das ist eine
 * NÄHERUNG (die Stops werden auf das Endergebnis statt auf ihre eigene Ebene
 * gerechnet), aber eine konservative - sie kann strenger urteilen als die
 * Wirklichkeit, nie milder.
 *
 * @returns {null|{ratio: number, min: number, bg: number[], fg: number[]}}
 *          null nur noch bei einem echten Bild (`url(...)`).
 */
function evaluateSample(sample, pageBase) {
  // Erste deckende Ebene suchen; alles darunter ist wirkungslos.
  let opaqueAt = sample.layers.length - 1;
  for (let i = 0; i < sample.layers.length; i += 1) {
    if (parseColor(sample.layers[i].bg)[3] >= 1) {
      opaqueAt = i;
      break;
    }
  }
  let bg = pageBase;
  const candidates = [];
  for (let i = opaqueAt; i >= 0; i -= 1) {
    const layer = parseColor(sample.layers[i].bg);
    if (layer[3] > 0) bg = composite(layer, bg);
    const stops = gradientStops(sample.layers[i].image);
    if (stops === null) return null;
    candidates.push(...stops);
  }

  const fgRaw = parseColor(sample.color);
  const large = sample.size >= 24 || (sample.size >= 18.66 && sample.weight >= 700);
  const min = large ? 3 : 4.5;

  let worst = { ratio: Infinity, bg, fg: composite(fgRaw, bg) };
  for (const variant of [null, ...candidates]) {
    const under = variant === null ? bg : composite(parseColor(variant), bg);
    const fg = composite(fgRaw, under);
    const ratio = contrastRatio(fg, under);
    if (ratio < worst.ratio) worst = { ratio, bg: under, fg };
  }
  return { ...worst, min };
}

describe('Sonde 2 - jeder sichtbare Text haelt WCAG AA auf seinem KOMPONIERTEN Untergrund', () => {
  for (const theme of ['light', 'dark']) {
    for (const device of ['mobile', 'desktop']) {
      test(`${theme} / ${device}`, async () => {
        const page = await openPage(harness, { device, theme, locale: 'de' });
        const base = parseColor(
          await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
        );
        const pageBase = base[3] > 0 ? composite(base, [255, 255, 255]) : [255, 255, 255];
        const findings = [];
        let unpainted = 0;
        for (const name of ROUTE_NAMES) {
          await gotoRoute(page, ROUTES[name]);
          for (const sample of await collectTextSamples(page)) {
            const result = evaluateSample(sample, pageBase);
            if (!result) {
              unpainted += 1;
              continue;
            }
            const { ratio, min, bg, fg } = result;
            if (ratio + 0.005 < min) {
              findings.push(
                `${name}/${theme}/${device}: ${ratio.toFixed(2)}:1 (soll ${min})  ` +
                  `${toHex(fg)} auf ${toHex(bg)}  ${sample.size}px/${sample.weight}  ` +
                  `${sample.selector}  "${sample.text}"`,
              );
            }
          }
        }
        await page.close();
        assert.deepEqual(
          findings,
          [],
          `Textkontrast unter AA im gerenderten Dokument (${unpainted} Elemente standen ` +
            `hinter einem echten Bild und waren nicht rechenbar):\n  ${findings.join('\n  ')}`,
        );
      });
    }
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sonde 3: Buttonform im gerenderten Dokument
 *
 * Es gibt EINE Buttonform: die Kapsel. Das Stylesheet kann diese Regel nur zur
 * Haelfte pruefen - dort steht weder Tag noch Rolle, und ein Knopf kann seine
 * Form von einer Regel bekommen, deren Selektor ihn gar nicht nennt. Was das
 * Stylesheet scharf sieht (gleiche Breite und Hoehe = umgrenztes Ziel), prueft
 * `ein quadratischer Icon-Knopf ist ein Kreis` auf Ebene 3. Hier steht der Rest.
 *
 * Die vier Ausnahme-KATEGORIEN stehen im Sektionskommentar von tokens.css:
 * Zustandsschalter, Drop-Ziele, Rasterzellen und ZEILEN einer Zeilenliste.
 * Unten stehen ihre Vertreter - jeder mit seiner Kategorie. Das ist die
 * Umkehrung einer Allowlist: gemessen wird JEDER Knopf des Dokuments, benannt
 * sind nur die begruendeten Ausnahmen, und alles Neue faellt durch.
 *
 * FORMLOS zaehlt nicht als zweite Form: ein Knopf ohne Radius, ohne Flaeche und
 * ohne Kante ist eine Textaktion, kein Kasten.
 * ──────────────────────────────────────────────────────────────────────────── */

// Klassenname -> Kategorie. Der Eintrag ist nur gueltig, wenn seine Kategorie
// eine der vier ist; wer eine fuenfte braucht, aendert erst tokens.css.
const SHAPE_EXEMPT = new Map([
  // 1. Zustandsschalter
  ['item-check', 'Zustandsschalter: Checkbox der Einkaufsliste'],
  ['group-toggle__btn', 'Zustandsschalter: Segment der Aufgaben-Gruppierung'],
  ['cal-toolbar__view-btn', 'Zustandsschalter: Segment der Kalender-Ansicht'],
  ['ydp__trigger', 'Griff: Feld-Oeffner des Datepickers, traegt Feldkante'],
  ['more-sheet__search', 'Griff: Suchfeld des More-Sheets, traegt Feldkante'],
  // 3. Zellen eines Rasters
  ['month-day', 'Rasterzelle: Tag im Kalender-Monat'],
  ['more-action', 'Rasterzelle: Kachel im More-Sheet-Raster'],
  ['health-metric-card', 'Rasterzelle: Kennzahlkachel der Gesundheit'],
  // 4. Zeilen einer Zeilenliste
  ['nav-item', 'Zeile: Eintrag der Sidebar-Navigation'],
  ['note-item', 'Zeile: Notiz im Dashboard-Widget'],
  ['rewards-widget-row', 'Zeile: Rang im Belohnungs-Widget'],
  ['rw-standing__id', 'Zeile: Oeffner einer Mitglieds-Zeile'],
  ['documents-folder-item__select', 'Zeile: Ordner in der Dokumentenliste'],
]);

test('Sonde 3 - es gibt EINE Buttonform, und die Ausnahmen sind Kategorien', async () => {
  const page = await openPage(harness, { device: 'desktop', theme: 'light', locale: 'de' });
  const found = new Map();
  const seen = new Set();

  for (const name of ROUTE_NAMES) {
    await gotoRoute(page, ROUTES[name]);
    const rows = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a.btn, [role="button"]')) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const style = getComputedStyle(el);
        const radius = parseFloat(style.borderTopLeftRadius);
        // Kapsel = Radius >= halbe Hoehe. So rendert --radius-full, und bei
        // gleicher Breite und Hoehe ist das genau der Kreis.
        const pill = radius >= rect.height / 2 - 1;
        // Formlos: kein Radius, keine Flaeche, kein KASTEN -> Textaktion oder
        // Zeile, keine zweite Buttonform.
        //
        // Eine Kante zaehlt nur RINGSUM als Kasten. Das Messwerkzeug fragte
        // `borderTopWidth` allein und stufte damit jede Zeile einer
        // Zeilenliste als Kasten ein - deren `X + X { border-top }` ist die
        // vorgeschriebene Trennung, also gerade das Merkmal einer ZEILE
        // (`.budget-entry` war der Fall, der es zeigte).
        const boxed = ['Top', 'Right', 'Bottom', 'Left']
          .every((side) => parseFloat(style[`border${side}Width`]) > 0);
        const flat = radius === 0
          && style.backgroundColor === 'rgba(0, 0, 0, 0)'
          && !boxed;
        // ALLE Knoepfe werden gemeldet, mit ihrem Urteil - sonst kann die
        // Pruefung unten nicht zwischen „Ausnahme entfaellt" und „Knopf haelt
        // die Regel jetzt" unterscheiden.
        const shaped = !pill && !flat;
        const key = [...el.classList].filter((cls) => !cls.startsWith('is-')).join('.')
          || `(klassenlos:${el.id || el.tagName})`;
        out.push({ key, radius, height: Math.round(rect.height), shaped });
      }
      return out;
    });
    for (const row of rows) {
      row.key.split('.').forEach((cls) => seen.add(cls));
      if (!row.shaped) continue;
      if (!found.has(row.key)) found.set(row.key, { ...row, pages: new Set() });
      found.get(row.key).pages.add(name);
    }
  }
  await page.close();

  // Eine Sonde, die nichts gemessen hat, darf nicht urteilen. Ohne diese
  // Zusicherung ist ein leeres Dokument (abgelaufene Sitzung, nicht
  // aufgebaute Route) von „alles in Ordnung" nicht zu unterscheiden - und die
  // Stale-Pruefung unten meldet dann ihre gesamte Liste als verschwunden.
  assert.ok(seen.size >= 20,
    `Nur ${seen.size} Knopf-Klassen im ganzen Dokument gesehen - die Sonde hat `
    + 'nichts gemessen, statt nichts gefunden. Seiten nicht aufgebaut?');

  const offenders = [];
  for (const [key, value] of found) {
    const classes = key.split('.');
    if (classes.some((cls) => SHAPE_EXEMPT.has(cls))) continue;
    offenders.push(
      `${key} (${value.radius}px auf h=${value.height}) auf ${[...value.pages].join(', ')}`,
    );
  }

  assert.deepEqual(offenders.sort(), [],
    'Knoepfe mit eigener Form ausserhalb der vier Ausnahme-Kategorien. Entweder '
    + 'die Kapsel tragen oder in SHAPE_EXEMPT stehen - mit der Kategorie, nicht '
    + 'mit dem Grund „gewachsen".');

  // Eine Ausnahme fuer einen Knopf, den es nicht mehr gibt, ist eine Allowlist,
  // die niemand mehr liest. Gemessen wird gegen das STYLESHEET, nicht gegen
  // das Dokument: ein Element, das nur unter bestimmten Daten erscheint, waere
  // sonst je nach Seed „verschwunden" - die Sonde pruefte dann Timing statt
  // Ehrlichkeit. Der Klassenname im CSS ist die stabile Quelle.
  const styles = new URL('../public/styles/', import.meta.url);
  const allCss = readdirSync(styles)
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => readFileSync(new URL(entry, styles), 'utf8'))
    .join('\n');
  const stale = [...SHAPE_EXEMPT.keys()].filter((cls) => !allCss.includes(`.${cls}`));
  assert.deepEqual(stale, [],
    'SHAPE_EXEMPT nennt Klassen, die in keinem Stylesheet mehr vorkommen.');
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sonde 4: Zielgroessen
 *
 * Die Regel steht im Sektionskommentar von tokens.css („Die Zielgroessen-
 * Regel"): eine REIHE traegt ihre Dichte gemeinsam, ein EINZELZIEL muss allein
 * treffbar sein.
 *
 *   freistehend  -> volle Zielgroesse in mindestens einer Achse, die andere
 *                   erfuellt WCAG 2.5.8
 *   in der Reihe -> allein WCAG 2.5.8 (24x24 oder Spacing-Ausnahme)
 *
 * WARUM DIESE EBENE UND KEINE ANDERE. Im Stylesheet steht weder, wer neben wem
 * liegt, noch was ein Pseudo-Element zur Flaeche beitraegt - beides entscheidet
 * hier ueber Verstoss oder nicht. Die zwei bisherigen Guards
 * (test-frontend-audit.js) pruefen benannte Selektoren und finden damit nur,
 * wer die Regel schon anerkennt; das ist die Allowlist-Signatur, die diese
 * Runde abschafft.
 *
 * DREI FALLEN, DIE BEIM BAU GEMESSEN WURDEN:
 *
 *   (1) DIE BOX IST NICHT DIE TREFFERFLAECHE. `.weather-widget__refresh` ist
 *       34x34 gross und dehnt sich per ::before auf --target-base aus. Eine
 *       Box-Messung meldet ihn als Verstoss, obwohl der Finger 44px findet -
 *       und haette damit ausgerechnet das Rezept fuer „kompakt aussehen, voll
 *       treffen" zum Fehler erklaert. Getastet wird deshalb mit
 *       elementFromPoint vom Zentrum nach aussen.
 *   (2) DAS TASTEN ENDET AN JEDER KANTE, AUCH AN DER FALSCHEN. Am unteren
 *       Viewport-Rand und an der Clip-Kante eines `overflow: hidden`-Moduls
 *       (Kueche, Budget) liefert elementFromPoint den Shell-Container - vier
 *       Ziele sahen dadurch aus, als waeren sie zu einem Drittel verdeckt.
 *       Deshalb gilt `max(Box, getastet)`: die Box ist die Untergrenze, das
 *       Tasten zaehlt nur, was sie ERWEITERT.
 *   (3) DIE ANZAHL IST NICHT DIE EINENGUNG. „Wie oft kommt die Klasse vor"
 *       misst den Seed: bei einer einzigen Aufgabe waere .task-card__title ein
 *       Einzelziel, bei zweien eine Reihe. Die Einengung steht im Layout.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Klassenname -> Begruendung. Die UMKEHRUNG einer Allowlist: gemessen wird
 * jedes Ziel des Dokuments, benannt sind nur die begruendeten Ausnahmen.
 *
 * Sie ist leer, und das ist das Ergebnis von Phase 3c: die Spacing-Ausnahme des
 * Standards deckt jeden bewusst dichten Fall mechanisch ab - Monatsraster-Chips
 * (Zentrumsabstand 31,5), Aufgaben-Tagfilter (29,3), Sidebar-Umschalter (31,5).
 * Wer hier etwas eintraegt, hat in Wahrheit ein Abstandsproblem.
 */
const TARGET_EXEMPT = new Map([]);

/** Ein Ziel gilt als eingeengt, wenn ein gleichartiges naeher steht als das. */
const CROWDING_GAP = 16;

async function measureTargets(page, min) {
  return page.evaluate(({ min, gap }) => {
    const SEL = 'button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const key = (el) => [...el.classList].filter((c) => !c.startsWith('is-')).join('.')
      || `(${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''})`;

    const els = [];
    for (const el of document.querySelectorAll(SEL)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      if (el.closest('.sr-only, [aria-hidden="true"], yuvomi-install-prompt')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      els.push(el);
    }
    const rects = els.map((el) => el.getBoundingClientRect());
    const classes = els.map((el) => new Set([...el.classList].filter((c) => !c.startsWith('is-'))));

    const out = [];
    els.forEach((el, i) => {
      const r = rects[i];
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      // Ein Ziel, dessen eigenes Zentrum es nicht selbst trifft, ist verdeckt
      // oder ausserhalb des Viewports - dort misst die Sonde nichts, statt
      // etwas Falsches zu messen.
      const mine = (x, y) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit));
      };
      if (!mine(cx, cy)) return;
      const reach = (dx, dy) => {
        let n = 0;
        while (n < min && mine(cx + dx * (n + 1), cy + dy * (n + 1))) n += 1;
        return n;
      };
      // max(Box, getastet): die Box ist die Untergrenze (Falle 2), das Tasten
      // zaehlt nur, was ein Pseudo-Element hinzufuegt (Falle 1).
      const w = Math.max(r.width, reach(-1, 0) + reach(1, 0) + 1);
      const h = Math.max(r.height, reach(0, -1) + reach(0, 1) + 1);

      // Eingeengt: ein Ziel, das mindestens eine Klasse teilt, steht naeher als
      // CROWDING_GAP. Nur DAS ist der Grund, aus dem ein Ziel dicht sein darf -
      // es kann nicht wachsen, ohne seinen Nachbarn zu verdraengen.
      let crowded = false;
      // Fuer die Spacing-Ausnahme (WCAG 2.5.8): naechstes Zielzentrum.
      let nearestCenter = Infinity;
      for (let j = 0; j < els.length && !(crowded && nearestCenter < 24); j += 1) {
        if (j === i || els[j].contains(el) || el.contains(els[j])) continue;
        const o = rects[j];
        const dEdge = Math.hypot(
          Math.max(o.left - r.right, r.left - o.right, 0),
          Math.max(o.top - r.bottom, r.top - o.bottom, 0),
        );
        if (dEdge < gap && [...classes[i]].some((c) => classes[j].has(c))) crowded = true;
        const dCenter = Math.hypot(
          o.left + o.width / 2 - cx,
          o.top + o.height / 2 - cy,
        );
        if (dCenter < nearestCenter) nearestCenter = dCenter;
      }

      // WCAG 2.5.8: 24x24, oder kein anderes Zielzentrum naeher als 24.
      const wcag = (w >= 24 && h >= 24) || nearestCenter >= 24;
      // Volle Zielgroesse in mindestens einer Achse - nur fuer freistehende.
      const full = w >= min || h >= min;
      // Das Urteil faellt NICHT hier: ob ein Bauteil in Reihen gebaut wird,
      // entscheidet sich ueber alle Routen zusammen (siehe unten).
      out.push({
        key: key(el),
        w: Math.round(w),
        h: Math.round(h),
        crowded,
        wcag,
        full,
        center: Math.round(nearestCenter),
      });
    });
    return out;
  }, { min, gap: CROWDING_GAP });
}

/**
 * Misst die Route an jeder Scrollposition und liefert die Messungen einzeln.
 *
 * Die App hat ZWEI Scrollport-Architekturen (Handoff §6): meist scrollt die
 * Seite, in Kueche und Budget ist der Modul-Root `overflow: hidden` und ein
 * Container darin scrollt. Gesucht wird deshalb der Container mit dem groessten
 * Ueberhang, nicht ein fester Knoten.
 */
async function measureScrolled(page, min, maxSteps = 6) {
  const pick = () => {
    const el = document.scrollingElement;
    let best = el;
    let bestOver = el.scrollHeight - el.clientHeight;
    for (const node of document.querySelectorAll('*')) {
      const cs = getComputedStyle(node);
      if (!/auto|scroll/.test(cs.overflowY)) continue;
      const over = node.scrollHeight - node.clientHeight;
      if (over > bestOver) { best = node; bestOver = over; }
    }
    return best;
  };
  const out = [];
  await page.evaluate(pick).catch(() => {});
  for (let step = 0; step < maxSteps; step += 1) {
    out.push(await measureTargets(page, min));
    const moved = await page.evaluate((pickSrc) => {
      // eslint-disable-next-line no-new-func
      const el = new Function(`return (${pickSrc})()`)();
      const before = el.scrollTop;
      // 70 % statt 100 %: was genau auf der Falz sitzt, wuerde sonst in keiner
      // der beiden Messungen vollstaendig im Bild stehen.
      el.scrollTop = before + el.clientHeight * 0.7;
      return el.scrollTop > before + 1;
    }, pick.toString());
    if (!moved) break;
    // Der kollabierende Kopf und die Sticky-Leisten brauchen einen Frame, sonst
    // misst die Sonde eine Zwischenposition.
    await new Promise((r) => { setTimeout(r, 250); });
  }
  return out;
}

describe('Sonde 4 - eine Reihe traegt ihre Dichte, ein Einzelziel ist allein treffbar', () => {
  // Beide Geraetewelten, denn --target-base schaltet ueber (hover: none): am
  // Zeiger 44px, am Finger 48px. Ein Guard, der nur eine Welt misst, prueft
  // genau die Haelfte einer Regel, deren Kern der Wechsel ist.
  for (const [device, min] of [['mobile', 48], ['desktop', 40]]) {
    test(`${device} (Minimum ${min}px)`, async () => {
      const page = await openPage(harness, { device, theme: 'light', locale: 'de' });
      const found = new Map();
      // DIE SONDE MUSS SCROLLEN. elementFromPoint kennt nur den Viewport - ein
      // Ziel unterhalb der Falz meldet sein eigenes Zentrum als verdeckt und
      // wird stillschweigend uebersprungen. Die Gegenprobe hat das aufgedeckt:
      // .ydp__trigger auf 40x40 zurueckgedreht liess den Guard GRUEN, weil er
      // auf /health unter der Falz liegt. Gemessen wird deshalb an jeder
      // Scrollposition, so wie ein Nutzer die Seite durchgeht.
      // Bauteile, die IRGENDWO in einer Reihe stehen. Siehe die Auswertung
      // darunter - erst mit dieser Menge ist das Urteil vollstaendig.
      const rowBuilt = new Set();
      let seen = 0;
      for (const name of ROUTE_NAMES) {
        await gotoRoute(page, ROUTES[name]);
        seen += await page.evaluate(
          () => document.querySelectorAll('button, a[href], [role="button"]').length,
        );
        for (const rows of await measureScrolled(page, min)) {
          for (const row of rows) {
            if (row.crowded) rowBuilt.add(row.key);
            if (row.wcag && row.full) continue;
            const id = `${row.key}|${row.w}x${row.h}`;
            if (!found.has(id)) found.set(id, { ...row, pages: new Set() });
            found.get(id).pages.add(name);
          }
        }
      }
      await page.close();

      // Eine Sonde, die nichts gemessen hat, darf nicht urteilen (dieselbe
      // Zusicherung wie bei Sonde 3).
      assert.ok(seen >= 200,
        `Nur ${seen} Ziele im ganzen Dokument gesehen - die Sonde hat nichts `
        + 'gemessen, statt nichts gefunden. Seiten nicht aufgebaut?');

      // DIE EINENGUNG IST EINE EIGENSCHAFT DES BAUTEILS, NICHT DER INSTANZ.
      // Die erste Fassung urteilte je Instanz und meldete prompt einen
      // .task-tag--filter, der als einziger Tag an seiner Aufgabe hing: ein
      // Reihen-Bauteil, das in dieser einen Zeile allein stand. Ob ein Bauteil
      // in Reihen gebaut wird, steht nicht in einer Zeile, sondern im Bauteil -
      // und ueber sechzehn Routen gemessen ist das eine stabile Aussage, waehrend
      // die einzelne Instanz den Seed misst.
      const offenders = [];
      for (const value of found.values()) {
        if (value.key.split('.').some((cls) => TARGET_EXEMPT.has(cls))) continue;
        if (value.wcag && rowBuilt.has(value.key)) continue;
        offenders.push(
          `${value.key}: ${value.w}x${value.h} - `
          + `${!value.wcag ? 'unter 24x24 ohne Spacing-Abstand' : 'freistehend und in KEINER Achse voll'}`
          + ` (naechstes Zielzentrum ${value.center}px) auf ${[...value.pages].join(', ')}`,
        );
      }

      assert.deepEqual(offenders.sort(), [],
        `Ziele unter der Zielgroesse bei ${device}. Die Regel steht in tokens.css `
        + '(„Die Zielgroessen-Regel"): ein freistehendes Ziel haelt die volle '
        + 'Zielgroesse in mindestens einer Achse, ein eingeengtes erfuellt WCAG '
        + '2.5.8. Wer kompakt aussehen und voll treffen will, dehnt seine Flaeche '
        + 'per ::before aus - .weather-widget__refresh ist der Musterfall.');
    });
  }
});

test('Sonde 4 - keine Zielgroessen-Ausnahme ueberlebt ihre Klasse', () => {
  // Gemessen gegen das STYLESHEET, nicht gegen das Dokument: ein Element, das
  // nur unter bestimmten Daten erscheint, waere sonst je nach Seed
  // „verschwunden" (dieselbe Begruendung wie bei Sonde 3).
  const styles = new URL('../public/styles/', import.meta.url);
  const allCss = readdirSync(styles)
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => readFileSync(new URL(entry, styles), 'utf8'))
    .join('\n');
  const stale = [...TARGET_EXEMPT.keys()].filter((cls) => !allCss.includes(`.${cls}`));
  assert.deepEqual(stale, [],
    'TARGET_EXEMPT nennt Klassen, die in keinem Stylesheet mehr vorkommen.');
});
