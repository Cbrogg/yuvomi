<!-- version: 2.19.0 -->
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

  HINWEIS ZU DIESER VERSION: eine visuelle Runde ohne Migration und ohne
  neue Pflicht-Einstellung, also kein Handlungs-Absatz. Beschrieben wird,
  was ein Haushalt SIEHT (dunkles Design mit Tiefe, ruhigere Uebersicht,
  kraeftigere Termine, Familienfarben bei Geburtstagen) - keine Tokennamen,
  keine Messwerte, keine Selektoren; die stehen im CHANGELOG. Dazu die eine
  Fehlerbehebung, die Menschen mit Screenreader betrifft, in klaren Worten.
  Draussen bleiben die Detektor-/Guard-Interna der Design-Kampagne: reine
  Bauarbeit.
-->
This update is about how the app looks and reads, most of all in the dark theme. Cards now stand out from the background with real depth instead of sinking into a murky gray, the interface glass matches the app's warm tone, and colors are used more deliberately throughout: the overview drops the colored band behind every tile title and marks each tile with a single round module seal instead, which makes the board calmer in the light theme and clearly more readable in the dark one.

The calendar's week view draws appointments with a strong edge in their calendar color, so a full week is easier to scan at a glance. Birthdays of household members on the overview now appear in that member's own profile color, matching the family tile next to them, and the age badge says "turns 11" instead of showing a bare number.

One fix for households using a screen reader: the buttons on a meal card in the weekly plan (delete, shopping list, recipe) were folded into the card itself and are now announced as separate controls again. Mouse and touch behavior is unchanged, and this update requires nothing from you.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.19.0
