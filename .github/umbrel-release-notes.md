<!-- version: 2.16.0 -->
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

  HINWEIS ZU DIESER VERSION: zwei Faehigkeiten, die jedes Haushaltsmitglied
  einzeln betreffen - die eigene Uebersicht und die eigene Navigation. Keine
  Migration, kein Handlungsbedarf, also gibt es keinen Pflicht-Absatz. Der
  dritte Absatz nennt den neuen Ort des Modul-Schalters, weil eine Adminin ihn
  sonst sucht. Draussen bleibt, was nur Entwickler angeht: der Blatt-Split als
  solcher, die Kontrastwerte, die Guards, die drei Review-Runden.
-->
Everyone in the household now arranges their own overview. Which cards the start page shows, in what order and at what size used to be one setting for the whole household - taking the cycle card off your board took it off everyone's. From now on it is yours alone. Nothing changes when you update: everyone keeps seeing the board the household had, and the first change you make affects only you.

The same goes for the navigation. Under Settings, Personal, Navigation each row now has an eye button that removes that module from your own sidebar and your three phone favourites. It does not take the module away from anyone else, and it does not lock it: links and the search still open it. Modules you have hidden are exactly where they were, you just do not see them any more.

For admins, switching a module on or off for the whole household has moved to its own page, Settings, Modules, Active modules. It used to sit right beside the personal button, twelve pixels apart, and the two look nothing alike now because they do very different things.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.16.0
