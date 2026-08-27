/**
 * Modul: Terminfarbe → Anzeigefarbe
 * Zweck: EINE Regel, wie ein Termin zu seiner Farbe kommt - an genau einer
 *        Stelle. Drei Quellen in fester Rangfolge: die eigene Farbe des Termins,
 *        die der ersten zugewiesenen Person, die des Kalenders.
 * Ausfuehren: node --experimental-sqlite --test test/test-calendar.js
 * Dependencies: keine.
 *
 * SIE STAND PRIVAT IN calendar.js, und das Dashboard hatte deshalb seine eigene
 * Fassung: `e.color || e.cal_color` - dieselbe Frage, aber ohne den Zweig fuer
 * die zugewiesene Person. Solange `calendar_events.color` NOT NULL war, ist der
 * Unterschied nicht aufgefallen, weil beide Fassungen immer beim ersten Glied
 * stehenblieben. Mit einer Terminfarbe, die fehlen DARF (#891), waeren daraus
 * zwei sichtbar verschiedene Antworten auf dieselbe Frage geworden: im Kalender
 * die Farbe der Person, auf der Uebersicht der App-Akzent.
 *
 * WARUM DIE EIGENE FARBE VORN STEHT (#815). Bis v2.35.0 schlug die Farbe der
 * zugewiesenen Person alles andere. Das warf zwei sehr verschiedene Dinge in
 * denselben Topf: `cal_color` ist GEERBT - jeder Termin des Kalenders traegt
 * sie, ueber diesen einen sagt sie nichts -, `color` dagegen ist an DIESEM
 * Termin ausdruecklich gesetzt, von Hand im Dialog oder als RFC-7986-`COLOR`
 * vom CalDAV-Server. Eine ausdrueckliche Angabe darf gegen eine abgeleitete
 * nicht verlieren.
 *
 * WARUM DER ZWEITE ZWEIG TROTZDEM ZAEHLT (#891). Die Umkehrung galt bis v2.48.0
 * unbesehen mit: weil die Spalte NOT NULL war und auch den Leerstring ablehnte,
 * trug JEDER Termin eine eigene Farbe - auch der, bei dem nie jemand eine
 * gewaehlt hat. Der Import schrieb die geerbte Kalenderfarbe hinein, der Dialog
 * den Palettenersten. Damit hat eine nie getroffene Wahl die Farbe der Person
 * verdraengt, und die Zweige zwei bis vier waren toter Code. Seit die Spalte
 * NULL sein darf, ist "dieser Termin hat keine eigene Farbe" ein Zustand - und
 * erst dadurch ist diese Rangfolge eine echte.
 */

/** Letzte Instanz, wenn keine der drei Quellen etwas hergibt. */
export const EVENT_FALLBACK_COLOR = '#8E8E93';

/**
 * Die Anzeigefarbe eines Termins.
 * Rangfolge: 1. eigene Farbe, 2. erste zugewiesene Person, 3. Kalender, 4. Grau.
 *
 * Wer der Termin ist, sagt weiterhin der Avatar-Stack daneben - das ist ohnehin
 * der Weg, auf dem MEHRERE Zugewiesene kommuniziert werden. Die Farbe war fuer
 * diese Auskunft nie die einzige Quelle.
 */
export function resolveEventColor(ev) {
  if (!ev) return EVENT_FALLBACK_COLOR;
  if (ev.color) return ev.color;
  const assignees = ev.assigned_users ?? [];
  if (assignees.length > 0) return assignees[0].color || EVENT_FALLBACK_COLOR;
  return ev.cal_color || EVENT_FALLBACK_COLOR;
}
