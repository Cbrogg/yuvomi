<!-- version: 2.8.0 -->
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
-->
This update is mostly about the lists you read every day. Tasks, shopping, the pantry, contacts, birthdays and the household log now share one row layout, so a list looks the same wherever you are and fits more on a screen. When you tick several items at once, the actions for them appear as a small bar above the navigation instead of a block that pushes the list down. On a computer, the button that creates something now sits in the page header with its name on it, rather than floating over the last row of the list.

The overview can show a row of small module tiles, each with a number and a shortcut, for the parts of Yuvomi that are otherwise only reachable through "More". It behaves like every other widget: you can move it, resize it or hide it, and it only shows what is not already somewhere else on the screen.

Several things that were hard or impossible to reach on a phone now work. The folder list in Documents unfolds in place instead of scrolling sideways, and a document can be opened at any window size. The "More" sheet fits on small screens and no longer covers the navigation bar. A medication dose keeps both of its buttons on screen, so it can still be skipped on a narrow phone. On a tablet, a reminder no longer sits on top of the navigation and swallows taps meant for it.

Some corrections are worth naming. In Persian, Filipino, Indonesian and Vietnamese, the confirmation for deleting several tasks or documents asked about contacts instead; it now names the right thing. Budget category bars are proportional again, so a small amount no longer looks like a large one, and long category names are no longer cut off on a phone. Household members with read-only access no longer see create buttons that could never have worked.

There is nothing to do after this update, and your data and settings are unchanged.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.8.0
