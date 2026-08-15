<!-- version: 2.14.3 -->
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

  HINWEIS ZU DIESER VERSION: sie aendert ausschliesslich den
  Einrichtungsassistenten fuer manuelle Docker-Installationen. Ueber den
  Umbrel-Store installiert man ohne diesen Assistenten, an der laufenden App
  aendert sich also nichts. Das steht auch so im Text - eine Notiz, die
  Relevanz behauptet, wo keine ist, kostet den Leser Zeit und Vertrauen.
-->
This release only changes the setup assistant used for manual Docker installations. Nothing about the app itself changes on Umbrel, and there is nothing to do after updating.

For anyone who also runs Yuvomi outside Umbrel: the assistant no longer overwrites parts of an existing configuration when it is run a second time, its default answer for how the app is reached no longer produces an installation you cannot sign in to, and the address used for password-reset and invitation links is now asked for rather than guessed. It also finishes by pointing at the next steps: inviting your family and choosing which modules to use.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.14.3
