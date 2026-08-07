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
