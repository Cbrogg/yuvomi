<!-- version: 2.16.1 -->
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

  HINWEIS ZU DIESER VERSION: ein einzelner gemeldeter Fehler im Belohnungs-
  Modul. Es gibt eine Migration (147), aber sie raeumt nur auf und verlangt
  vom Haushalt nichts - deshalb kein Pflicht-Absatz, sondern ein Halbsatz im
  zweiten Absatz, damit niemand die schon verdorbenen Praemien von Hand
  nachbessert. Draussen bleibt, was nur Entwickler angeht: null gegen
  undefined, die Nummer der Migration, die Testnamen.
-->
Editing a reward no longer replaces its icon with the word "null". Any reward you had created without an icon lost it the first time you changed anything else about it - the price, the name - and showed a stray piece of text in its place. Clearing the description of a reward did the same to the description.

Rewards that already carry that text are cleaned up while the app starts, including the copy kept in the redemption history, so there is nothing for you to correct by hand.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.16.1
