<!-- version: 2.22.0 -->
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

  HINWEIS ZU DIESER VERSION: eine neue Funktion und drei Verbesserungen am
  Aussehen, keine neue Pflicht-Einstellung. Die Datenbank-Migration bekommt
  KEINEN Handlungs-Absatz - sie laeuft beim Start von selbst und verlangt
  nichts vom Haushalt; stattdessen steht im Farb-Absatz ausdruecklich, dass
  bestehende Kategorien ihre Farben behalten, denn das ist die Frage, die sich
  jemand beim Update stellt. Erster Absatz ist die WAHLBARE Kategoriefarbe,
  weil sie das Einzige ist, das jemand aktiv benutzen kann.

  Draussen bleibt alles, was nur die Bauart beschreibt: warum eine Toenung
  keine Farbe tragen kann, welche Regel wo stand, welcher Endpunkt ein Feld
  dazubekommen hat. Der Vollton-Absatz nennt deshalb keine Regel, sondern das,
  was man sieht - Marken, die vorher blass waren und sich nicht unterscheiden
  liessen. Die Einstellungs- und Kalender-Absaetze sind bewusst kurz: sie sind
  Verfeinerungen, keine Neuigkeiten, und ein Absatz je Sache reicht.
-->
Contact categories can now have their own colour. Seven of them came with one, and every category you added yourself had none - in practice they all took on the module's colour and were impossible to tell apart. You can now pick a colour for each category in the "Manage categories" dialog, where every row shows its own mark and opens a palette when you tap it. Your existing categories keep exactly the colours they had, and one you leave without a colour stays deliberately plain.

Marks that name something now show their colour properly. Small round or square marks that tell you which module, category or person something belongs to used to be washed out, which in dark mode meant they barely showed a colour at all and in light mode made neighbouring categories look identical. They are now filled with their colour. The other way round applies too: a mark that names nothing in particular - a drop area, an empty preview tile - is plainly grey instead of faintly tinted.

A contact who is also a member of your household now shows that person's photo or initials in their own colour, the same one they carry on the overview, in the calendar and in tasks. Their own colour comes first, so you still recognise them inside a category that has one of its own.

Appointments look the same in every calendar view. The week and all-day rows already carried a coloured edge in their calendar's colour; the month and day views kept the old pale box, so the same appointment looked different depending on which view you had open. Both now show the edge.

The settings list shows which module a page belongs to. Pages about the kitchen, the calendar, tasks, health, contacts, documents or rewards carry that module's colour; the rest - your account, appearance, notifications, backup - stay plain, because they are not about a single module.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.22.0
