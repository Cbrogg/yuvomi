<!-- version: 2.22.1 -->
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

  HINWEIS ZU DIESER VERSION: ein reiner Fehlerbehebungs-Release, eine Sache,
  ein Absatz. Keine Migration, keine neue Einstellung, also kein
  Handlungs-Absatz. Der Text nennt ausdruecklich, dass 2.21.1 dieselbe Sache
  schon einmal angekuendigt hat und was davon uebrig war - wer das Update von
  damals gelesen hat, wuerde sich sonst fragen, warum es noch einmal
  dasteht. Die Bedingung (breite Fenster, abgeschaltete Systemanimationen)
  gehoert hinein, weil sie erklaert, warum es die meisten nie getroffen hat.

  Draussen bleibt die ganze Bauart: welche Regel wo stand, welcher Container
  eine Scroll-Box war, welche Zahl gemessen wurde, welcher Test es absichert.
-->
Dialogs no longer slide out of view while you are filling them in. Opening the repeat interval in the new-task dialog could push the whole dialog upwards until its title and close button had left the screen, leaving Save and Cancel as the only way out of it. Version 2.21.1 announced this as fixed, and for most windows it was - what remained showed up only in wider browser windows and only with system animations switched off, a combination that is common on Windows. Dialogs now stay where they are at any window size, and their content scrolls the way it always did.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.22.1
