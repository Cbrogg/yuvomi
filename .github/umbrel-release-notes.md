<!-- version: 2.33.0 -->
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
    - Ein Absatz ist EINE Zeile, egal wie lang. Innerhalb eines Absatzes darf
      kein Zeilenumbruch stehen: der Store rendert ein gefaltetes
      YAML-Blockskalar (`>-`), das jeden einzelnen Umbruch zu einem Leerzeichen
      faltet - der Text liest sich dann anders zurueck, als er geschrieben
      wurde, und der Round-Trip-Guard im Workflow bricht den Lauf ab. Genau
      daran ist der erste v2.30.0-Versuch gescheitert. Den Zeilenumbruch fuer
      die Lesbarkeit macht der Workflow selbst beim Schreiben.
    - Leerzeile zwischen den Absaetzen: dort, und nur dort, ist der
      Absatzumbruch.
    - ENGLISCH. Der Store-Eintrag ist durchgehend englisch (`tagline`,
      `description` daneben), und diese Notiz steht im Update-Dialog eines
      Haushalts irgendwo auf der Welt. Der Kommentar hier ist deutsch, weil er
      an uns geht - der Text darunter nie. Von v2.24.0 bis v2.30.0 war er
      trotzdem deutsch: der Kommentar ging im v2.29.0-Lauf verloren, und wer
      danach die Datei oeffnete, sah nur noch deutschen Vorgaengertext und
      schrieb deutsch weiter. Umbrels Maintainer hat das bis dahin still vor
      dem Merge uebersetzt - genau die Handarbeit, die er sich mit seiner
      Bitte ersparen wollte.
-->
The changelog no longer needs a connection to GitHub. Until now Yuvomi fetched its release history live, so an instance without outbound network, or one behind a busy shared IP, saw nothing but an error. The history that ships with your installation is used instead when GitHub does not answer, and the view tells you that is what you are reading. It reports the newest available version as unknown in that case rather than claiming you are up to date, because a bundled file cannot know about anything newer than itself.

Documents filed by a module now land in one folder regardless of who uploads them. The folder was previously identified by its translated name, so two people using Yuvomi in different languages ended up with two folders and half the receipts in each. Existing folders keep their name and contents, and renaming one no longer causes a second to appear the next time something is filed.

Filipino has been revised throughout by a native speaker, and the housekeeping folder is now named after the module it belongs to in every language.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.33.0
