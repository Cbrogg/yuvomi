<!-- version: 2.18.0 -->
<!--
  Die `releaseNotes` fuer den Umbrel-App-Store, von Hand fuer JEDEN Release
  geschrieben. `umbrel-publish.yml` nimmt den Text unter diesem Kommentar
  woertlich und verweigert den Lauf, wenn die Versionsmarke oben nicht zur
  veroeffentlichten Version passt - eine veraltete Notiz ist schlimmer als keine.

  WARUM VON HAND. Bis v2.6.0 hat der Workflow den GitHub-Release-Body
  umgeformt: Ueberschriften weg, Aufzaehlungszeichen weg, Rest als Prosa. Unser
  CHANGELOG ist aber fuer Entwickler geschrieben - Messwerte, Tokennamen,
  Selektoren, Guard-Namen - und im Store steht dieser Text im
  Update-Dialog eines Haushalts. Umbrels Maintainer hat ihn deshalb vor dem
  Merge von v2.6.0 umgeschrieben und darum gebeten, kuenftig ihre `AGENTS.md`
  zu befolgen (getumbrel/umbrel-apps, Kommentar an PR #5980):
  `.claude/skills/umbrel-update-app/` verlangt "concise Umbrel-user
  releaseNotes ... Omit upstream CI, docs-only, build, and internal dependency
  churn" plus einen Link auf die vollen Notizen.

  REGELN FUER DEN TEXT (aus deren Skill, nicht erfunden):
    - Fuer jemanden, der eine BESTEHENDE Installation aktualisiert.
    - Thematische Absaetze, keine Bullet-Liste, kein Markdown.
    - Nutzersichtbare Funktionen, Fehlerbehebungen, Sicherheitshinweise.
    - Migrationen und Breaking Changes ausdruecklich als Handlung benennen
      (z.B. eine neue Pflicht-Env-Variable) - das ist der wichtigste Absatz,
      wenn es einen gibt.
    - Keine internen Details: keine CSS-Klassen, keine Pixelwerte, keine
      Tokennamen, keine Testnamen.
    - Letzter Absatz ist der Link auf die vollen Release Notes.
    - Leerzeile zwischen den Absaetzen: der Store rendert ein gefaltetes
      YAML-Blockskalar, dort ist die Leerzeile der Absatzumbruch.

  HINWEIS ZU DIESER VERSION: eine einzige gewuenschte Funktion (#647), also
  zwei Absaetze - was sie tut, und wie man sie einschaltet. Migration 150 legt
  nur eine Spalte an zwei Tabellen an und verlangt vom Haushalt nichts, also
  kein Pflicht-Absatz. Draussen bleibt alles, was nur Entwickler angeht: die
  Nummer der Migration, die Suite, der serverseitige Filter, die Farbregeln.
  Der Satz zum abgeschalteten Modul steht NICHT drin - er beschreibt einen
  Fehler, den in dieser Version noch niemand haben konnte.
-->
Anything with a date can now count down to it. Mark a calendar event or a task with "count down on the overview" and a new Key dates tile shows them together, sorted by how near they are - the holiday and the driving licence in one list, each row leading back to where it came from. The wording stays coarse while the date is far off and turns exact once it is near, so "about 3 years" becomes plain days from a month out. Colour tells you how soon rather than where the entry came from, and a date that has just passed stays for another week instead of disappearing on the morning the consequence begins.

The tile only appears once something is marked, so nothing changes for a household that does not use it. On a task the mark needs a due date and survives the reset of a repeating task, which is the point for anything that comes round again on a duration - a licence every few years, a filter a set number of days after the last change. On an event the mark stays on your server: it is not sent to Google or CalDAV and a sync run does not overwrite it.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.18.0
