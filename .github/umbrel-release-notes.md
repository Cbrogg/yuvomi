<!-- version: 2.14.5 -->
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

  HINWEIS ZU DIESER VERSION: zwei gemeldete Fehler in der App selbst, also
  diesmal wirklich relevant fuer den Store. Der Schluessel-Hinweis betrifft
  Umbrel ausdruecklich NICHT - `deploy/umbrel/docker-compose.yml` setzt
  `DB_ENCRYPTION_KEY=${APP_SEED}`, der Platzhalter aus `.env.example` kann hier
  also gar nicht ankommen. Er steht trotzdem drin, weil viele Haushalte Yuvomi
  zusaetzlich woanders betreiben - aber mit der Entwarnung in derselben Zeile.
  Die Doku- und Website-Arbeit dieses Releases bleibt draussen (deren Skill:
  "Omit ... docs-only").
-->
Two fixes you can see in the app. In Inventory, opening the form for a new item showed five blank entries where the categories should be: the categories that ship with Yuvomi lost their labels when they were made translatable. In Calendar, the weekend shading in the month view was tied to the last two columns of the grid rather than to the days themselves, so it sat on Friday and Saturday for anyone whose week starts on Sunday. Both are back to what you would expect, and there is nothing to do after updating.

One security note for anyone who also runs Yuvomi outside Umbrel, by hand with Docker: a fresh installation now refuses to start when the database encryption key is still the placeholder from the example file, because that value is printed in our repository and protects nothing. Your Umbrel installation is not affected - it has always been given its own key.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.14.5
