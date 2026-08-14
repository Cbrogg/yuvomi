<!-- version: 2.8.1 -->
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
This update fixes five things that got in the way, and two of them could cost data.

If you sync a calendar over CalDAV, a repeating appointment kept its repetition only as long as you did not touch it. Editing anything about it - even just the person it is assigned to - dropped the repetition, and that loss was carried back into the calendar it came from. Repeating appointments from a synced calendar are now read correctly and left alone unless you change the repetition yourself.

Two things in the calendar settings happened at the wrong moment. Refreshing the calendar list of an account switched every calendar back on, including the ones you had deliberately unticked, which brought their appointments back with them; the same happened when you changed the account password. And the person that newly imported appointments are assigned to could only be chosen after the first sync had already run, so the first and usually largest batch arrived without one. Both now behave the way you would expect: your selection survives a refresh, and the default person can be set before anything is fetched, including while creating a subscription.

In the kitchen, a recipe with no meal ticked quietly became a recipe for all four. That made it impossible to keep something like a stock or a base sauce out of the weekly random pick. An empty selection is now kept and shown as such; you can still plan such a recipe by hand at any time.

Finally, "Cancel" works again when you open an entry and switch to editing it. It did nothing before, in tasks, shopping, the pantry, the household log and recipes.

There is nothing to do after this update, and your data and settings are unchanged.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.8.1
