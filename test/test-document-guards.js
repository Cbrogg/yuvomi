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
