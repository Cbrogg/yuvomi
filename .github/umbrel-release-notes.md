<!-- version: 2.15.0 -->
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

  HINWEIS ZU DIESER VERSION: eine sichtbare Aenderung in der App (der Ordner,
  in dem die Belege der Gemeinsamen Ausgaben liegen, heisst jetzt wie das Modul)
  und die dazugehoerige Migration, die einen bestehenden Ordner mitnimmt - genau
  der Absatz, den deren Skill als wichtigsten benennt, wenn es einen gibt. Die
  Korrektur der Aussage zu ausgehenden Verbindungen steht drin, weil sie eine
  Datenschutzzusage praezisiert und nicht bloss Doku umraeumt; das Verhalten
  selbst ist unveraendert. Der ganze README- und Website-Umbau bleibt draussen
  (deren Skill: "Omit ... docs-only").
-->
The module for shared costs now goes by one name throughout. It answered to several at once: one wording as the page heading, another on the folder your receipts are filed into, and a third in a place the app never showed you. The heading is the name everywhere now, in all twenty-four languages. If you have filed receipts before, the folder holding them is renamed for you while updating and everything inside stays where it is; there is nothing to do.

One clarification about what leaves your server, in case you read the old wording as a promise. Yuvomi asks GitHub once for its list of releases, on first load and every six hours after, so it can tell you a newer version exists. That is the only request it makes on its own, and it has always made it. Everything else - weather, calendar sync, cloud backup - still stays off until you enter credentials.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.15.0
