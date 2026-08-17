<!-- version: 2.20.0 -->
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

  HINWEIS ZU DIESER VERSION: wieder eine visuelle Runde ohne Migration und
  ohne neue Pflicht-Einstellung, also kein Handlungs-Absatz. Beschrieben
  wird, was ein Haushalt SIEHT: die Modulfarben sind ueberall dieselben, das
  Menue auf dem Telefon zeigt sie zum ersten Mal, und jedes Modul fuehrt ein
  Zeichen statt zweier. Draussen bleiben die Messwerte (Kontrastzahlen), die
  Namen der Zeichen, die Zahl der Codestellen und alles, was die Farbe
  begruendet - das steht im CHANGELOG. Die Installer-Korrektur ist nicht
  erwaehnt: sie betrifft die Ersteinrichtung, nicht ein bestehendes
  Haushalts-Update, und ihr Anlassfall ist nur sichtbar, wenn ein Stylesheet
  gar nicht laedt.
-->
The module colors are now the same everywhere. Each of Yuvomi's areas - calendar, tasks, kitchen, budget and the rest - has its own color, and until now it appeared at full strength on the overview but washed out and pale everywhere else, so the same area could look like it belonged to a different app depending on where you saw it. Every one of those round marks now carries its color at full strength.

On phones, the navigation bar at the bottom shows those colors for the first time. On a computer the sidebar has been showing them for a while, which is what made the difference noticeable: the same app, two different languages, depending on the window. The bar now works the way the sidebar does - each icon in its area's color, and the one you are currently in taking the app's violet.

Each area also has exactly one icon again. Which symbol stood for which area had been written down in several places over time and they had grown apart, so Notes was a sticky note in the menu and a pushpin on the overview. There is one list now, and a few icons that had been borrowed from elsewhere were drawn in the app's own hand.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.20.0
