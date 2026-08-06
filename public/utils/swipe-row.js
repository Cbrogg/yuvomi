/**
 * Modul: Swipe-Zeilen (geteilt)
 * Zweck: Wischgesten auf Listenzeilen - die Geste selbst, das Reveal-Panel
 *        darunter und der einmalige Nudge-Hinweis.
 * Abhängigkeiten: utils/ux.js (vibrate)
 *
 * WARUM GETEILT (Redesign Runde 4, C-2): dieselbe Gestenlogik stand zweimal
 * fast wortgleich in `pages/tasks.js` und `pages/shopping.js` - inklusive der
 * Schwellwerte, der Dämpfung jenseits der Schwelle, der Scroll-Erkennung und
 * des Haptik-Impulses. Zwei Kopien heissen zwei Orte, an denen eine Korrektur
 * vergessen werden kann; die Ausnahme für den Sortiergriff (#678) stand
 * folgerichtig auch nur in einer davon.
 *
 * Das CSS-Vokabular (`.swipe-row`, `.swipe-reveal`, der Chevron-Hint) liegt
 * seit jeher geteilt in layout.css - nur der JS-Teil fehlte.
 */

import { vibrate } from '/utils/ux.js';

export const SWIPE_THRESHOLD = 80;   // px - Mindestweg für Aktion
export const SWIPE_MAX_VERT  = 12;   // px - vertikaler Toleranzbereich
export const SWIPE_LOCK_VERT = 30;   // px - ab diesem Weg gilt es als Scroll

const SWIPE_HINT_KEY = 'yuvomi:swipeHintSeen';
const SWIPE_HINT_MAX = 3;

/**
 * Verdrahtet alle `.swipe-row` unterhalb von `listEl`.
 *
 * Jede Richtung ist optional; fehlt sie, läuft ein Wisch dorthin ins Leere und
 * die Karte federt zurück. `run` bekommt die Zeile und darf asynchron sein.
 *
 * @param {HTMLElement} listEl                  - Container der Zeilen
 * @param {Object} opts
 * @param {string} opts.card                    - Selektor der Karte IN der Zeile
 * @param {string} [opts.ignore]                - Selektor, an dem die Geste einem
 *                                                anderen Zweck gehört (Sortiergriff)
 * @param {Object} [opts.left]                  - Wisch nach links
 * @param {string} opts.left.reveal             - Selektor des Reveal-Panels
 * @param {boolean} [opts.left.flyOut=false]    - Karte fliegt hinaus, statt zurückzufedern
 * @param {(row: HTMLElement) => any} opts.left.run
 * @param {Object} [opts.right]                 - Wisch nach rechts, gleiche Form
 */
export function wireSwipeRows(listEl, { card, ignore = null, left = null, right = null } = {}) {
  if (!listEl || !card) return;

  const panels = [left?.reveal, right?.reveal].filter(Boolean);

  listEl.querySelectorAll('.swipe-row').forEach((row) => {
    const cardEl = row.querySelector(card);
    if (!cardEl) return;

    let startX = 0, startY = 0;
    let dx = 0;
    let locked = false;       // false = unentschieden, 'swipe' | 'scroll'
    let thresholdHit = false; // Haptik am Schwellwert nur einmal

    const revealEl = (sel) => (sel ? row.querySelector(sel) : null);

    function resetCard(animate = true) {
      cardEl.style.transition = animate ? 'transform 0.25s ease' : '';
      cardEl.style.transform = '';
      row.classList.remove('swipe-row--swiping');
      for (const sel of panels) {
        const el = revealEl(sel);
        if (el) el.style.opacity = '0';
      }
    }

    row.addEventListener('touchstart', (e) => {
      // Geste ignorieren, solange ein Modal offen ist.
      if (document.getElementById('shared-modal-overlay')) return;
      // Am Sortiergriff gehört die Geste dem Ziehen (#678). Ohne diese Ausnahme
      // liefe beim Hochziehen einer Zeile das seitliche Wackeln als Wischweg mit
      // und die Karte rutschte unter dem Finger in ihre Aktion.
      if (ignore && e.target.closest?.(ignore)) { locked = 'scroll'; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0;
      locked = false;
      thresholdHit = false;
      cardEl.style.transition = '';
    }, { passive: true });

    row.addEventListener('touchmove', (e) => {
      if (locked === 'scroll') return;

      dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);

      // Scroll-Richtung früh erkennen
      if (locked === false) {
        if (dy > SWIPE_MAX_VERT && Math.abs(dx) < dy) {
          locked = 'scroll';
          resetCard(false);
          return;
        }
        if (Math.abs(dx) > SWIPE_MAX_VERT) locked = 'swipe';
      }
      if (locked !== 'swipe') return;

      // Vertikalen Scroll unterbinden, sobald der Wisch erkannt ist
      if (dy < SWIPE_LOCK_VERT) e.preventDefault();

      // Karte verschieben, jenseits der Schwelle gedämpft
      const dampened = dx > 0
        ? Math.min(dx, SWIPE_THRESHOLD + (dx - SWIPE_THRESHOLD) * 0.2)
        : Math.max(dx, -(SWIPE_THRESHOLD + (-dx - SWIPE_THRESHOLD) * 0.2));
      cardEl.style.transform = `translateX(${dampened}px)`;
      row.classList.add('swipe-row--swiping');

      // Reveal-Panels einblenden (0 → 1 über den Schwellwert)
      const progress = String(Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1));
      const shown = dx < 0 ? left?.reveal : right?.reveal;
      for (const sel of panels) {
        const el = revealEl(sel);
        if (el) el.style.opacity = sel === shown ? progress : '0';
      }

      if (!thresholdHit && Math.abs(dx) >= SWIPE_THRESHOLD) {
        thresholdHit = true;
        vibrate(15);
      }
    }, { passive: false });

    row.addEventListener('touchend', async () => {
      if (locked !== 'swipe') { resetCard(false); return; }

      const dir = dx < -SWIPE_THRESHOLD ? left : dx > SWIPE_THRESHOLD ? right : null;
      if (!dir) { resetCard(true); return; }

      if (dir.flyOut) {
        // Die Karte verlässt das Bild, die Aktion läuft danach - so sieht man
        // das Ergebnis der Geste, bevor die Liste sich neu aufbaut.
        cardEl.style.transition = 'transform 0.2s ease';
        cardEl.style.transform = `translateX(${dx < 0 ? '-' : ''}110%)`;
        vibrate(40);
        setTimeout(async () => {
          resetCard(false);
          await dir.run(row);
        }, 200);
        return;
      }

      resetCard(true);
      vibrate(20);
      await dir.run(row);
    }, { passive: true });
  });
}

/**
 * Nudge-Hinweis auf der ersten Zeile, höchstens SWIPE_HINT_MAX mal insgesamt.
 * Auf Zeigergeräten entfällt er - dort gibt es keine Wischgeste, und die
 * Zeilenaktionen stehen ohnehin sichtbar in der Zeile.
 *
 * Der Zähler ist bewusst app-weit und nicht pro Modul: gelernt wird die GESTE,
 * nicht die Liste.
 */
export function maybeShowSwipeHint(container) {
  if (window.innerWidth >= 1024) return;
  const count = parseInt(localStorage.getItem(SWIPE_HINT_KEY) ?? '0', 10);
  if (count >= SWIPE_HINT_MAX) return;

  const firstRow = container.querySelector('.swipe-row');
  if (!firstRow) return;

  firstRow.classList.add('swipe-row--hint');
  firstRow.addEventListener('animationend', () => {
    firstRow.classList.remove('swipe-row--hint');
  }, { once: true });

  localStorage.setItem(SWIPE_HINT_KEY, String(count + 1));
}
