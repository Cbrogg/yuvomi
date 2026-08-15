<!-- version: 2.13.0 -->
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
A new Inventory module, and feed subscriptions everyone can manage.

Inventory keeps track of what your household owns: brand, model, serial number, where it is stored, what it cost, how long the warranty runs, and an optional photo. You can attach receipts and manuals from Documents, link a purchase or a repair from Budget, and it reminds you 30 days before a warranty expires. Custom dates per item - a service, an inspection, an insurance renewal - join the same reminders.

Inventory arrives switched off and each household turns it on. Not every family tracks belongings, and a module nobody wants should not take up a permanent place in the navigation. Switch it on under Settings, Navigation; if you leave it alone, nothing changes for you.

Everyone can now manage their own calendar feed subscription. Subscribing your phone to the family calendar used to be reachable by an administrator only, although the link itself has always been personal - in a household of five, four people had no way to set one up or withdraw it. Both feeds now sit under Settings, Personal, Feed subscriptions. Existing links keep working and nobody has to subscribe again.

There is nothing else to do after this update, and your data and settings are unchanged.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.13.0
