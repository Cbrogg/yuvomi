/**
 * Modul: Aufgaben-Gruppen und ihre stabilen Schlüssel (#812)
 * Zweck: Gruppenköpfe lassen sich zuklappen, und der Zustand wird gespeichert.
 *        Gespeichert werden darf dabei nur ein Schlüssel, der eine Übersetzung
 *        überlebt: das angezeigte Label wechselt mit der Sprache, „Heute" und
 *        „Today" wären sonst zwei verschiedene Gruppen und jeder Sprachwechsel
 *        klappte alles wieder auf.
 *
 *        Deckt ab:
 *          - groupBy liefert je Gruppe { id, label, tasks }
 *          - die id ist sprachunabhängig, das label übersetzt
 *          - der Speicher-Schlüssel trennt die beiden Gruppierungen
 *          - die Reihenfolge der Fälligkeits-Gruppen bleibt die fachliche
 * Ausführen: node --loader ./test/test-browser-loader.mjs --test test/test-task-groups.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// /pages/tasks.js zieht zwei Web Components mit (Kategorie- und Tag-Verwalter),
// die zur Ladezeit von HTMLElement ableiten. Node kennt das Global nicht; ein
// leerer Platzhalter reicht, weil hier nur reine Funktionen geprüft werden.
globalThis.HTMLElement = globalThis.HTMLElement ?? class {};
globalThis.customElements = globalThis.customElements ?? { define() {}, get() {} };

const { __test: tasks } = await import('../public/pages/tasks.js');

const task = (over = {}) => ({ id: 1, title: 'X', category: 'household', due_date: null, ...over });
// Kalendertag in der LOKALEN Zone. `groupBy` vergleicht gegen den lokalen Tag
// (ueber `todayKey()`), und aus `toISOString()` gebildet lag "heute" oestlich
// von UTC zwischen lokaler und UTC-Mitternacht einen Tag zurueck - die Gruppe
// "today" fiel dann weg und der Test kippte. Genau die Falle aus CLAUDE.md.
const dateKey = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const heute = () => dateKey(new Date());
const inTagen = (n) => dateKey(new Date(Date.now() + n * 86400000));

test('groupBy liefert Gruppen mit id, label und Aufgaben', () => {
  const groups = tasks.groupBy([task({ id: 1 }), task({ id: 2, category: 'school' })], 'category');
  assert.equal(groups.length, 2);
  for (const g of groups) {
    assert.ok(typeof g.id === 'string' && g.id.length > 0, 'jede Gruppe braucht eine id');
    assert.ok(typeof g.label === 'string', 'und ein Label');
    assert.ok(Array.isArray(g.tasks), 'und ihre Aufgaben');
  }
});

test('die id einer Kategorie ist ihr Schlüssel, nicht ihr übersetztes Label', () => {
  const [gruppe] = tasks.groupBy([task({ category: 'household' })], 'category');
  assert.equal(gruppe.id, 'household',
    'das Label kann "Haushalt" oder "Household" sein - gespeichert wird der Schlüssel');
});

test('die Fälligkeits-Gruppen tragen feste ids', () => {
  const groups = tasks.groupBy([
    task({ id: 1, due_date: inTagen(-3) }),
    task({ id: 2, due_date: heute() }),
    task({ id: 3, due_date: inTagen(30) }),
    task({ id: 4, due_date: null }),
  ], 'due');

  const ids = groups.map((g) => g.id);
  assert.deepEqual(ids, ['overdue', 'today', 'later', 'noDate'],
    'ids UND ihre fachliche Reihenfolge: überfällig zuerst, ohne Datum zuletzt');
  for (const g of groups) {
    assert.notEqual(g.id, g.label, 'wäre id === label, hinge der gespeicherte Zustand an der Sprache');
  }
});

// Wie /tasks/categories sie liefert: nach `sort_order`, Seed-Zeilen mit
// label_key und name = NULL. Die Reihenfolge hier ist BEWUSST nicht
// alphabetisch - weder nach Key noch nach Label -, sonst kann der Test die
// beiden Sortierungen nicht auseinanderhalten.
const CATEGORIES = [
  { key: 'household', name: null,     label_key: 'tasks.categoryHousehold', sort_order: 0 },
  { key: 'ca-rental', name: 'CA Rental', label_key: null,                   sort_order: 1 },
  { key: 'misc',      name: null,     label_key: 'tasks.categoryMisc',      sort_order: 2 },
  { key: 'finance',   name: 'Finance',   label_key: null,                   sort_order: 3 },
];

test('die Kategorie-Gruppen folgen der verwalteten Reihenfolge, nicht dem Alphabet', () => {
  // Genau der Fall aus #845: „Household" wurde im Verwalter nach oben gezogen,
  // stand auf der Aufgabenseite aber weiter hinter „CA Rental" und „Finance".
  const groups = tasks.groupBy([
    task({ id: 1, category: 'finance' }),
    task({ id: 2, category: 'household' }),
    task({ id: 3, category: 'ca-rental' }),
  ], 'category', CATEGORIES);

  assert.deepEqual(groups.map((g) => g.id), ['household', 'ca-rental', 'finance'],
    'die Reihenfolge kommt aus sort_order - alphabetisch stuende CA Rental zuerst');
});

test('eine Kategorie ohne Eintrag in der Liste steht hinten, nicht vorne', () => {
  // Eine gerade geloeschte oder noch nicht nachgeladene Kategorie darf die
  // verwaltete Reihenfolge nicht aufmischen: MAX_SAFE_INTEGER, nicht -1.
  const groups = tasks.groupBy([
    task({ id: 1, category: 'ghost' }),
    task({ id: 2, category: 'misc' }),
  ], 'category', CATEGORIES);

  assert.deepEqual(groups.map((g) => g.id), ['misc', 'ghost'],
    'ein unbekannter Key faellt ans Ende');
});

test('die Kategorie-Sortierung liest weder den rohen Key noch eine feste Sprache', () => {
  // Regel ueber die Quelle statt ueber ein Ergebnis: die Fassung vor #845
  // sortierte `a.localeCompare(b, 'de')` - also den internen Schluessel, in
  // fest verdrahtetem Deutsch. Beides bleibt gruen, solange die Testdaten
  // zufaellig passend heissen, deshalb hier die Regel selbst.
  const source = readFileSync(new URL('../public/pages/tasks.js', import.meta.url), 'utf8');
  const groupBySource = source
    .slice(source.indexOf('function groupBy(tasks, mode'), source.indexOf('// Render-Bausteine'))
    .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

  assert.ok(
    !/localeCompare\([^)]*'de'/.test(groupBySource),
    'die Gruppierung sortiert in fest verdrahtetem Deutsch statt in der aktiven Sprache',
  );
  assert.ok(
    groupBySource.includes('catSortIndex('),
    'die Gruppierung fragt nicht catSortIndex() - damit ignoriert sie sort_order (#845)',
  );
});

test('der Speicher-Schlüssel trennt die beiden Gruppierungen', () => {
  // Eine Kategorie darf „heute" heißen, ohne die Fälligkeits-Gruppe mitzuklappen.
  assert.notEqual(tasks.groupKey('category', 'today'), tasks.groupKey('due', 'today'));
  assert.equal(tasks.groupKey('due', 'overdue'), 'due:overdue');
});

test('die Faelligkeits-Rechnung vergleicht Kalendertage, keine Zeitpunkte', () => {
  // Der Fall oben faengt den Fehler NUR in Zonen ab +12 Stunden: dort rundet
  // ein halber Tag Differenz auf einen ganzen auf, und eine heute faellige
  // Aufgabe rutscht eine Gruppe weiter. In Berlin, UTC oder Los Angeles bleibt
  // er gruen, obwohl der Fehler dasteht - der Test ist also genau dort blind,
  // wo er entwickelt wird.
  //
  // Deshalb hier die Regel ueber die Quelle statt ueber ein Ergebnis:
  // `new Date('2026-08-24')` ist UTC-Mitternacht, `setHours(0, 0, 0, 0)` die
  // lokale. Wer die beiden voneinander abzieht, rechnet den Zonen-Offset mit.
  const source = readFileSync(new URL('../public/pages/tasks.js', import.meta.url), 'utf8');
  const groupBySource = source
    .slice(source.indexOf('function groupBy(tasks, mode'), source.indexOf('// Render-Bausteine'))
    // Ohne die Kommentare: der Kommentar an der Fundstelle ZITIERT die alte
    // Rechnung, um zu erklaeren, was daran falsch war. Ein Guard, der Prosa
    // liest, meldet dann genau die Stelle, die ihn befolgt.
    .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

  assert.ok(
    !/new Date\(task\.due_date\)/.test(groupBySource),
    'die Gruppierung parst ein Datum als Instant - `parseLocalDateKey()` liest es als Kalendertag',
  );
  assert.ok(
    !/setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(groupBySource),
    'die Gruppierung baut ihre Tagesgrenze aus der Wanduhr statt aus `todayKey()`',
  );
  assert.ok(
    groupBySource.includes('todayKey()'),
    'die Gruppierung fragt nicht `todayKey()` - damit folgt sie nicht der Haushaltszone (#829)',
  );
});
