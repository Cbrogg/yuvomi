<!-- version: 2.30.0 -->
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
This update adds a lock for individual tasks. A locked task can only be
rewritten, archived or deleted by the person who created it and by the
household's administrators - the title, the due date, the recurrence, the
points, and everything else that defines it. For everybody else it stays fully
usable: they can still look at it, tick it off, comment on it, set their own
reminder, and take the task on or hand it back. It is meant for households with
children, where tasks are meant to be shared but not redefined by everyone.
Existing tasks are not locked and behave exactly as before; the switch sits in
the edit dialog next to the visibility setting.

Archiving a task did not check whether you were allowed to see it in the first
place. A private task belonging to another member could be taken out of view
without it ever having been shown to you. That is fixed.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.30.0
