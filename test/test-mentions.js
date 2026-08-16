/**
 * Modul: Erwähnungen (@Name)
 * Zweck: Die geteilte Lesart eines Kommentartextes - dieselbe Funktion hebt im
 *        Browser hervor und benachrichtigt auf dem Server (#734). Weicht sie
 *        auseinander, stünde ein Name farbig da, ohne dass jemand erfährt, dass
 *        er gemeint war. DOM-frei.
 * Ausführen: npm run test:mentions
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { splitMentions, mentionedUserIds } = await import('../public/utils/mentions.js');

const USERS = [
  { id: 1, display_name: 'Anna' },
  { id: 2, display_name: 'Anna Maria' },
  { id: 3, display_name: 'Ben' },
];

test('ein einfacher Name wird als Erwähnung gelesen', () => {
  const segments = splitMentions('Kannst du das übernehmen, @Ben?', USERS);
  assert.deepEqual(segments.map((s) => s.type), ['text', 'mention', 'text']);
  assert.equal(segments[1].text, '@Ben');
  assert.equal(segments[1].user.id, 3);
  assert.equal(segments[2].text, '?');
});

test('der längste passende Name gewinnt', () => {
  // „Anna" passt auch auf den Anfang von „Anna Maria" - gemeint ist die zweite.
  const ids = mentionedUserIds('@Anna Maria bringt die Leiter mit', USERS);
  assert.deepEqual(ids, [2]);
});

test('ein Name mit Leerzeichen endet am Wort, nicht am Satz', () => {
  const segments = splitMentions('@Anna Maria, danke!', USERS);
  assert.equal(segments[0].type, 'mention');
  assert.equal(segments[0].text, '@Anna Maria');
  assert.equal(segments[1].text, ', danke!');
});

test('ein längerer Name als der bekannte trifft nicht', () => {
  // Es gibt keine „Bernd", also darf „@Bernd" nicht als „@Ben" gelesen werden.
  assert.deepEqual(mentionedUserIds('@Bernd kommt später', USERS), []);
});

test('eine Mailadresse ist keine Erwähnung', () => {
  assert.deepEqual(mentionedUserIds('Schreib an anna@Ben.example', USERS), []);
});

test('Groß- und Kleinschreibung spielt keine Rolle, der Text bleibt wie getippt', () => {
  const segments = splitMentions('@ANNA hat Zeit', USERS);
  assert.equal(segments[0].type, 'mention');
  assert.equal(segments[0].text, '@ANNA');
  assert.equal(segments[0].user.id, 1);
});

test('mehrfache Erwähnung derselben Person zählt einmal, in Textreihenfolge', () => {
  assert.deepEqual(mentionedUserIds('@Ben und @Anna, dann nochmal @Ben', USERS), [3, 1]);
});

test('ohne Erwähnung bleibt der Text ein Stück', () => {
  const segments = splitMentions('Nichts markiert hier.', USERS);
  assert.deepEqual(segments, [{ type: 'text', text: 'Nichts markiert hier.' }]);
});

test('leerer Text und leere Nutzerliste ergeben nichts', () => {
  assert.deepEqual(splitMentions('', USERS), []);
  assert.deepEqual(splitMentions(null, USERS), []);
  assert.deepEqual(mentionedUserIds('@Ben', []), []);
  assert.deepEqual(mentionedUserIds('@Ben', null), []);
});

test('ein Klammeraffe ohne Namen bleibt Text', () => {
  const segments = splitMentions('Preis @ 5 Euro', USERS);
  assert.deepEqual(segments, [{ type: 'text', text: 'Preis @ 5 Euro' }]);
});

test('eine Erwähnung am Zeilenanfang zählt, mitten im Wort nicht', () => {
  assert.deepEqual(mentionedUserIds('Erledigt.\n@Ben übernimmt', USERS), [3]);
  assert.deepEqual(mentionedUserIds('Kaffee4@Ben', USERS), []);
});
