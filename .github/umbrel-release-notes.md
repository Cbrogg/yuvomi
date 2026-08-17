<!-- version: 2.18.1 -->
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

  HINWEIS ZU DIESER VERSION: reine Fehlerbehebungen, und der erste ist ein
  Datenschutz-Fall - der gehoert nach vorn und in klare Worte, weil er
  betrifft, wer in den Einstellungen Rechte vergeben hat. Beschrieben wird,
  WAS ein Mitglied bekam (Termintitel, Beschreibungen, Zahlen), nicht wo im
  Code es lag: die Endpunktnamen, der Guard und die Tabellen gehen einen
  Haushalt nichts an. Migration 151 raeumt beim Update Dubletten weg und
  verlangt niemandem etwas ab, also kein Pflicht-Absatz - der halbe Satz "beim
  Update aufgeraeumt" reicht, weil er erklaert, warum die Suche danach anders
  aussieht. Draussen bleibt der Diagnose-Schalter im Review-Workflow: reine
  Bauarbeit.
-->
If you have set per-role or per-member module access, this update closes a gap worth knowing about. A member locked out of a module could still receive its content through the overview and the global search: appointment titles with their descriptions and locations, task and budget figures, notes, shopping items, birthdays and health entries. None of it was visible on screen, because the app hides those tiles and search results - but it was in the data your browser received, and anything that reaches the browser can be read there. The overview and the search now leave a locked module out entirely, before anything is looked up. Read-only access is unchanged: it still shows everything, it only takes away editing.

Search also finds your shopping items again. Every item was recorded twice the moment it was created, and search shows at most five results per kind, so a search that should have listed five items listed two or three - and looked complete while doing it. The duplicates only ever affected freshly added items that nobody had touched since, which is exactly what people search for. They are cleaned up while the app updates; you do not need to do anything.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.18.1
