<!-- version: 2.23.1 -->
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

  HINWEIS ZU DIESER VERSION: ein Fehlerbehebungs-Release mit genau einer
  Sache, also ein Absatz. Keine Migration, kein Handlungs-Absatz. Der Text
  nennt, dass die Ursache in 2.23.0 entstanden ist - wer das Update von
  gestern gelesen hat, soll nicht raten muessen, ob hier etwas Neues kaputt
  ging. Welche Regel entfallen war und welcher Trenner jetzt steht, bleibt
  draussen: das ist Bauart.

  Draussen bleibt die ganze Bauart: welche Regel wo stand, welcher Container
  eine Scroll-Box war, welche Zahl gemessen wurde, welcher Test es absichert.
-->
The line under a birthday reads as separate facts again. Yesterday's update took a tinted capsule off the countdown, and with it the only thing that had been keeping the countdown apart from the date, the age and the note - "in 12 days 30.08.2026 turns 37 Linda's sister" ran together as one stretch of text. The parts are separated again, and the note no longer sits flush against the age either, which it had been doing for much longer than a day.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.23.1
