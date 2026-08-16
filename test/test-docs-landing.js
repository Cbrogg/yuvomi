/**
 * Modul: Doku-Seiten (GitHub Pages) - Struktur- und Drift-Guard
 * Zweck: Die vier Seiten unter `docs/` sind eigenständige Dateien ohne Build-Schritt
 *        und ohne Framework. Was sie behaupten, steht handgepflegt an mehreren
 *        Stellen gleichzeitig - und genau daran ist es wiederholt auseinander
 *        gelaufen. Diese Suite hält die fünf Kopplungen, die schon gerissen sind:
 *
 *        (1) Kein Quelltextkommentar rendert als sichtbarer Text.
 *            Der Sektionsumbau vom 2026-08-16 hat einen Kommentar in zwei
 *            Hälften geschnitten. Die Schlusszeile stand danach als Textknoten
 *            bei 32 % Scrolltiefe auf der Seite, der Kopf blieb unterminiert
 *            zurück und verschluckte die nächste Kommentar-Marke. Weder
 *            Kontrast- noch Überlauf- noch Konsolenprüfung sieht so etwas, und
 *            Sektions-Screenshots erst recht nicht: der Rest stand ZWISCHEN
 *            zwei Sektionen.
 *
 *        (2) Die Substitutionstabelle stimmt wörtlich mit der README überein.
 *            Die zehn Zeilen in `docs/index.html` sind aus der README-Tabelle
 *            übernommen. Nichts hielt sie zusammen.
 *
 *        (3) Die Modulzahl der Proof-Leiste ist die Summe dessen, was die Seite
 *            zeigt. "Die übrigen dreizehn" stand über vierzehn Karten, weil das
 *            achtzehnte Modul dazukam und die Zahl im Absatz darüber nicht.
 *
 *        (4) Jede referenzierte Aufnahme hat ihre zwei WebP-Ableitungen, in
 *            BEIDEN Sprachordnern. `onerror` greift nur bei FEHLENDEN Dateien,
 *            nicht bei veralteten - eine fehlende Ableitung fällt still auf das
 *            5-10x größere PNG zurück.
 *
 *        (5) Die Wörterbücher sind vollständig und deckungsgleich. Ein `data-t`
 *            ohne Eintrag rendert stumm den englischen Fallback, auch auf der
 *            deutschen Seite.
 *
 * Ausführen: node --test test/test-docs-landing.js   (bzw. npm run test:docs-landing)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'docs');
const SHOTS = resolve(DOCS, 'screenshots');
const PAGES = ['index.html', 'install.html', 'datenschutz.html', 'impressum.html'];

const read = (p) => readFileSync(resolve(DOCS, p), 'utf8');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;| /g, ' ');

// ── (1) Kein Kommentar rendert als Text ──────────────────────────────────────

/**
 * Kommentare entfernen und schauen, was an Kommentar-Syntax übrig bleibt.
 *
 * Bewusst so herum und nicht als Zählung von `<!--` gegen `-->`: die war beim
 * echten Schaden AUSGEGLICHEN. Der abgetrennte Rest hatte ein `-->` und der
 * unterminierte Kopf ein `<!--`, die Bilanz stimmte also, während beide Hälften
 * kaputt waren. Ein Guard, der Paare zählt, wäre hier grün gewesen.
 */
function commentDamage(html) {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  const strayClose = [...stripped.matchAll(/-->/g)].map((m) => ({
    line: stripped.slice(0, m.index).split('\n').length,
    context: stripped.slice(Math.max(0, m.index - 60), m.index + 3).replace(/\s+/g, ' ').trim(),
  }));
  const unterminated = (stripped.match(/<!--/g) || []).length;
  return { strayClose, unterminated };
}

for (const page of PAGES) {
  test(`${page}: kein Kommentarrest steht als sichtbarer Text im Dokument`, () => {
    const { strayClose, unterminated } = commentDamage(read(page));
    assert.equal(
      strayClose.length, 0,
      `Kommentar-Ende ausserhalb eines Kommentars (rendert als Text):\n` +
      strayClose.map((s) => `  Zeile ~${s.line}: …${s.context}`).join('\n')
    );
    assert.equal(unterminated, 0, 'nicht geschlossener <!-- Kommentar: verschluckt allen Text bis zum nächsten -->');
  });
}

test('der Kommentar-Guard erkennt den Schaden, gegen den er gebaut ist', () => {
  // Gegenprobe gegen den ECHTEN alten Stand: ein Kommentar, dessen Schlusszeile
  // abgetrennt wurde, plus der unterminierte Kopf. Die Paar-Bilanz ist hier
  // ausgeglichen (je ein <!-- und ein -->), der Schaden trotzdem da.
  const broken = [
    '</section>',
    '     with modules the reader has just been introduced to. -->',
    '<section class="handoff">',
    '</section>',
    '<!-- HANDOFFS - the payoff for the feature list above. Each row is one piece',
    '     of data crossing from the module that produces it to the module that',
    '<section class="longevity">',
  ].join('\n');

  assert.equal((broken.match(/<!--/g) || []).length, (broken.match(/-->/g) || []).length,
    'Vorbedingung: die Paar-Bilanz ist ausgeglichen, ein zaehlender Guard waere hier gruen');

  const { strayClose, unterminated } = commentDamage(broken);
  assert.equal(strayClose.length, 1, 'der abgetrennte Rest muss gefunden werden');
  assert.match(strayClose[0].context, /introduced to\. -->/);
  assert.equal(unterminated, 1, 'der unterminierte Kopf muss gefunden werden');
});

// ── (2) Substitutionstabelle == README ───────────────────────────────────────

/** Die zehn Zeilen aus der README-Tabelle "Instead of juggling… | Yuvomi gives you". */
function readmeSwapRows() {
  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  return readme.split('\n')
    .map((l) => l.match(/^\| (.+?) \| \*\*(.+?)\*\* - (.+?) \|$/))
    .filter(Boolean)
    .map((m) => [decode(m[1]).trim(), decode(m[2]).trim(), decode(m[3]).trim()]);
}

/** Dieselben Zeilen aus dem englischen Wörterbuch von index.html. */
function pageSwapRows(html) {
  const en = dictBlock(html, 'en');
  const rows = [];
  for (let i = 1; ; i++) {
    const a = en.match(new RegExp(`\\bswap_${i}_a:'((?:[^'\\\\]|\\\\.)*)'`));
    const b = en.match(new RegExp(`\\bswap_${i}_b:'<b>(.*?)</b> - ((?:[^'\\\\]|\\\\.)*)'`));
    if (!a || !b) break;
    rows.push([decode(a[1]).trim(), decode(b[1]).trim(), decode(b[2]).trim()]);
  }
  return rows;
}

test('die Substitutionszeilen stimmen woertlich mit der README-Tabelle ueberein', () => {
  const readme = readmeSwapRows();
  const page = pageSwapRows(read('index.html'));

  assert.ok(readme.length >= 5, `README-Tabelle nicht gefunden oder zu kurz (${readme.length} Zeilen)`);
  assert.equal(page.length, readme.length,
    `Die Seite zeigt ${page.length} Zeilen, die README hat ${readme.length}. ` +
    'Beide sind handgepflegt - wer eine aendert, aendert die andere mit.');

  for (let i = 0; i < readme.length; i++) {
    assert.deepEqual(page[i], readme[i],
      `Zeile ${i + 1} weicht ab.\n  README: ${JSON.stringify(readme[i])}\n  Seite : ${JSON.stringify(page[i])}`);
  }
});

// ── (3) Modulzahl == was die Seite zeigt ─────────────────────────────────────

test('die Modulzahl der Proof-Leiste ist die Summe aus Feature-Zeilen und Modulkarten', () => {
  const html = read('index.html');
  const claimed = Number(html.match(/<b>(\d+)<\/b>\s*<span data-t="proof_modules"/)?.[1]);
  const featureRows = (html.match(/class="feat-row/g) || []).length;
  const modCards = (html.match(/class="mod-card/g) || []).length;

  assert.ok(Number.isInteger(claimed), 'Modulzahl in der Proof-Leiste nicht gefunden');
  assert.equal(featureRows + modCards, claimed,
    `Die Proof-Leiste behauptet ${claimed} Module, die Seite zeigt ${featureRows} Feature-Zeilen ` +
    `plus ${modCards} Modulkarten = ${featureRows + modCards}.`);
});

test('der Absatz ueber dem Modulraster nennt die Zahl der Karten, nicht irgendeine', () => {
  const html = read('index.html');
  const modCards = (html.match(/class="mod-card/g) || []).length;
  const WORDS = {
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    zehn: 10, elf: 11, zwoelf: 12, zwölf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, fünfzehn: 15, sechzehn: 16,
  };
  for (const lang of ['en', 'de']) {
    const desc = dictBlock(html, lang).match(/\bmore_desc:'((?:[^'\\]|\\.)*)'/)?.[1];
    assert.ok(desc, `more_desc fehlt im ${lang}-Woerterbuch`);
    const hit = Object.entries(WORDS).find(([w]) => new RegExp(`\\b${w}\\b`, 'i').test(desc));
    assert.ok(hit, `more_desc (${lang}) nennt keine Zahl: "${desc}"`);
    assert.equal(hit[1], modCards,
      `more_desc (${lang}) sagt "${hit[0]}" (${hit[1]}), es sind aber ${modCards} Modulkarten.`);
  }
});

// ── (4) WebP-Ableitungen je referenzierter Aufnahme ──────────────────────────

/** Sprachordner unter docs/screenshots/ - am Namen erkannt, nicht am Inhalt. */
function localeDirs() {
  return ['', ...readdirSync(SHOTS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[a-z]{2}(-[a-z]{2})?$/.test(e.name))
    .map((e) => e.name)];
}

test('jede referenzierte Aufnahme hat beide WebP-Ableitungen in allen Sprachordnern', () => {
  const bases = new Set();
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/(?:src|data-light|data-dark|data-light-m|data-dark-m)="screenshots\/([^"]+\.png)"/g)) {
      bases.add(m[1]);
    }
  }
  assert.ok(bases.size > 0, 'keine referenzierten Screenshots gefunden - Regex veraltet?');

  const missing = [];
  for (const base of bases) {
    for (const dir of localeDirs()) {
      for (const suffix of ['.webp', '@1x.webp']) {
        const rel = (dir ? `${dir}/` : '') + base.replace(/\.png$/, suffix);
        if (!existsSync(resolve(SHOTS, rel))) missing.push(`screenshots/${rel}`);
      }
    }
  }
  assert.deepEqual(missing, [],
    'Fehlende WebP-Ableitungen. onerror faengt nur FEHLENDE Dateien ab, der Fallback landet also ' +
    'still auf dem 5-10x groesseren PNG:\n  ' + missing.join('\n  '));
});

// ── (5) Woerterbuecher vollstaendig und deckungsgleich ───────────────────────

/** Der Rumpf eines Wörterbuch-Blocks (`en: { … }` / `de: { … }`). */
function dictBlock(html, lang) {
  const m = html.match(new RegExp(`\\n\\s*${lang}: \\{\\n([\\s\\S]*?)\\n\\s*\\}`));
  return m ? m[1] : '';
}

/**
 * Schlüssel eines Blocks.
 *
 * Verlangt `key:'` oder `key:"` direkt hinter Zeilenanfang, Komma oder Klammer.
 * Ohne diese Verankerung liest das Muster Wörter INNERHALB von Werten als
 * Schlüssel (ein Satzteil wie "own: " in einem Fließtext) und meldet dann
 * Phantom-Einträge.
 */
function dictKeys(block) {
  return new Set([...block.matchAll(/(?:^|[{,]\s*)\s*([a-z][a-z0-9_]*)\s*:\s*['"]/gm)].map((m) => m[1]));
}

/** Alle über `data-t`/`data-alt-t`/`data-t-aria` verlangten Schlüssel im Markup. */
function usedKeys(html) {
  const body = html.split(/\n\s*(?:var |const )?(?:DICT|T)\s*=/)[0];
  const keys = new Set();
  for (const attr of ['data-t', 'data-alt-t', 'data-t-aria']) {
    for (const m of body.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) keys.add(m[1]);
  }
  return keys;
}

for (const page of ['index.html', 'install.html']) {
  test(`${page}: jeder benutzte Schluessel steht in beiden Woerterbuechern`, () => {
    const html = read(page);
    const used = usedKeys(html);
    assert.ok(used.size > 20, `nur ${used.size} data-t-Schluessel gefunden - Regex veraltet?`);

    for (const lang of ['en', 'de']) {
      const block = dictBlock(html, lang);
      assert.ok(block, `${lang}-Woerterbuch nicht gefunden`);
      const missing = [...used].filter((k) => !dictKeys(block).has(k)).sort();
      assert.deepEqual(missing, [],
        `Schluessel ohne Eintrag im ${lang}-Woerterbuch (rendert stumm den Markup-Fallback): ${missing.join(', ')}`);
    }
  });
}
