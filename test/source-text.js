/**
 * Modul: Test-Infrastruktur - Quelltext neutralisieren, bevor ein Guard ihn liest.
 * Zweck: Kommentare aus einer Quelle schneiden, ohne dabei eine Falle zu bauen.
 * Ausfuehren: keine eigene Suite - Helfer, importiert von den Guard-Suiten.
 *
 * WARUM UEBERHAUPT: ein Guard, der im Quelltext nach einem Muster sucht, findet
 * es auch in einem KOMMENTAR. Genau diese Falle hat in Etappe 4 einen Guard rot
 * gemacht, der inhaltlich recht hatte - der Kommentar nannte den alten Namen,
 * und `includes()` liest einen Kommentar als Regel.
 *
 * WARUM EIN FIXPUNKT UND KEIN EINFACHES `replace`: ein einzelner Durchlauf ueber
 * `<!--[\s\S]*?-->` kann das Trennzeichen STEHEN LASSEN. Bei `<!--a<!--b-->`
 * frisst der non-greedy Match von der ersten Klammer bis zum ersten `-->` und
 * laesst nichts uebrig; bei `<!--<!-- -->` bleibt dagegen ein `<!--` zurueck.
 * CodeQL nennt das `js/incomplete-multi-character-sanitization` und stuft es
 * hoch ein. Im Testbaum ist daraus keine Luecke abzuleiten - hier wird eine
 * Repo-Datei gelesen, nicht Fremdeingabe in HTML geschrieben -, aber der
 * SCHNITT ist trotzdem unvollstaendig, und ein Guard, der auf unvollstaendig
 * geschnittenem Text urteilt, urteilt auf einem Text, den es so nicht gibt.
 *
 * WARUM HIER UND NICHT DREIMAL: `test-budget-ui.js` hatte diese Schleife samt
 * Begruendung bereits, `test-frontend-audit.js` die Kette ohne sie. Zwei Kopien
 * desselben Musters haben in diesem Repo schon zweimal zwei verschiedene
 * Blindstellen ueberlebt (siehe den Kopf von `css-rules.js`) - deshalb steht der
 * Schnitt jetzt an einer Stelle. `css-rules.js` ist ausdruecklich nicht dieser
 * Ort: es ist der Regelscanner fuer STYLESHEETS und sagt das in seiner ersten
 * Zeile.
 */

/**
 * Schneidet HTML-Kommentare heraus, bis nichts mehr uebrig bleibt.
 * @param {string} src
 * @returns {string}
 */
export function withoutHtmlComments(src) {
  let out = src;
  let previous;
  do {
    previous = out;
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  } while (out !== previous);
  return out;
}

/**
 * Schneidet JS-Blockkommentare heraus, ebenfalls bis zum Fixpunkt.
 *
 * Erhaelt die Zeilenzahl NICHT - wer gemeldete Zeilennummern braucht, ersetzt
 * stattdessen durch Leerzeichen (so macht es `stripComments` in
 * `test-typography.js` fuer CSS, und aus genau diesem Grund steht es dort).
 * @param {string} src
 * @returns {string}
 */
export function withoutBlockComments(src) {
  let out = src;
  let previous;
  do {
    previous = out;
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  } while (out !== previous);
  return out;
}
