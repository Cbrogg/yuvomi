/**
 * Modul: Erwähnungen (@Name)
 * Zweck: Einen Freitext gegen die Mitgliederliste lesen - fürs Hervorheben im
 *        Browser und fürs Benachrichtigen auf dem Server. DOM- und i18n-frei,
 *        damit beide Seiten dieselbe Funktion benutzen (wie sync-target.js).
 *
 * Es gibt bewusst KEIN zweites Feld neben dem Text, in dem der Client die
 * gemeinten Personen mitschickt: dann wären Anzeige und Benachrichtigung zwei
 * Wahrheiten, die auseinanderlaufen können, sobald jemand den Namen von Hand
 * tippt statt ihn aus der Vorschlagsliste zu wählen. Der Text ist die Quelle.
 *
 * GRENZE, die daraus folgt: Anzeigenamen sind nicht eindeutig. Führt ein
 * Haushalt zwei Mitglieder mit demselben Namen, meint `@Name` beide gleich gut,
 * und getroffen wird das erste passende Konto - hervorgehoben wie benachrichtigt
 * dasselbe. Das aufzulösen hieße, die Kennung in den Text zu schreiben
 * (`@[Name](12)`), also den Kommentar zu einem Format zu machen, das man beim
 * Zitieren und beim Bearbeiten mitschleppt. Solange zwei gleiche Namen im selben
 * Haushalt der seltene Fall sind, ist die Verwechslung der kleinere Preis.
 */

// Vor dem @ darf kein Wortzeichen stehen - sonst würde in "info@example.org"
// der Teil hinter dem Klammeraffen als Erwähnung gelesen.
const BOUNDARY = /[\p{L}\p{N}_]/u;

/**
 * Zerlegt einen Text in Abschnitte aus reinem Text und Erwähnungen.
 *
 * Der längste passende Name gewinnt: heißen zwei Mitglieder „Anna" und
 * „Anna Maria", meint „@Anna Maria" die zweite. Groß-/Kleinschreibung spielt
 * keine Rolle, der Abschnitt trägt aber den Namen so, wie er getippt wurde.
 *
 * @param {string} text
 * @param {Array<{id:number, display_name:string}>} users
 * @returns {Array<{type:'text', text:string}|{type:'mention', text:string, user:object}>}
 */
export function splitMentions(text, users) {
  const raw = String(text ?? '');
  const list = (Array.isArray(users) ? users : [])
    .filter((u) => u && u.display_name)
    // Von lang nach kurz, damit der erste Treffer schon der längste ist.
    .sort((a, b) => String(b.display_name).length - String(a.display_name).length);

  const segments = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) segments.push({ type: 'text', text: plain });
    plain = '';
  };

  while (i < raw.length) {
    const isAt = raw[i] === '@';
    const boundaryOk = i === 0 || !BOUNDARY.test(raw[i - 1]);
    if (!isAt || !boundaryOk) {
      plain += raw[i];
      i += 1;
      continue;
    }

    const rest = raw.slice(i + 1);
    const hit = list.find((u) => {
      const name = String(u.display_name);
      if (rest.slice(0, name.length).toLowerCase() !== name.toLowerCase()) return false;
      // Hinter dem Namen darf kein Wortzeichen mehr folgen: sonst träfe
      // „@Anna" auch in „@Annabelle" zu, wenn es keine Annabelle gibt.
      const after = rest[name.length];
      return after === undefined || !BOUNDARY.test(after);
    });

    if (!hit) {
      plain += raw[i];
      i += 1;
      continue;
    }

    flush();
    const typed = raw.slice(i, i + 1 + String(hit.display_name).length);
    segments.push({ type: 'mention', text: typed, user: hit });
    i += typed.length;
  }

  flush();
  return segments;
}

/**
 * Die erwähnten Mitglieder, ohne Wiederholung und in der Reihenfolge des Textes.
 *
 * @param {string} text
 * @param {Array<{id:number, display_name:string}>} users
 * @returns {number[]}
 */
export function mentionedUserIds(text, users) {
  const ids = [];
  for (const segment of splitMentions(text, users)) {
    if (segment.type !== 'mention') continue;
    if (!ids.includes(segment.user.id)) ids.push(segment.user.id);
  }
  return ids;
}
