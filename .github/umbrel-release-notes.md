<!-- version: 2.21.1 -->
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

  HINWEIS ZU DIESER VERSION: drei Fehlerbehebungen, alle rein im Verhalten,
  keine Migration und keine neue Pflicht-Einstellung - also kein
  Handlungs-Absatz. Ein Absatz je Fehler, jeweils aus der Sicht dessen, der ihn
  bemerkt: ein Termin stand an einem Tag, an dem er nicht ist; die Uebersicht
  zeigte nachts das Essen von gestern; ein Dialog liess sich nicht mehr
  schliessen. Draussen bleibt alles, was die Ursache beschreibt (wie das
  Enddatum gezaehlt wurde, UTC gegen lokale Zeitzone, wie der Browser ein
  Auswahlfeld behandelt) - das steht im CHANGELOG. Beim Kalender wird
  ausdruecklich erwaehnt, dass echte ueber Mitternacht laufende Termine
  unveraendert bleiben: wer den Fehler kannte, soll wissen, dass nichts
  anderes mitverschoben wurde. Beim Zeitzonen-Fehler ist die Tageszeit genannt,
  weil sie erklaert, warum ihn die meisten nie gesehen haben.
-->
An appointment that ends at midnight now stays on the day it belongs to. An event running from nine in the evening until midnight also appeared on the following day, and there it was shown as an all-day event: in the month grid it filled two days, in the week and day views it sat in the all-day row, and the agenda listed it under the next day as well. Appointments that genuinely run past midnight are unchanged, and so are all-day events spanning several days.

The overview now reads "today" from your own clock. Parts of it went by UTC instead, while a meal's date or a task's due date is the calendar day you typed in. If your time zone is ahead of UTC, the overview showed yesterday's meals during the early hours of the morning - in central Europe between midnight and two - and on the first of a month it could still show the previous month's budget. If your zone is behind UTC, the same drift landed on the next day late in the evening.

Dialogs no longer move while you are filling them in. In the new-task dialog, opening the repeat interval under "More settings" pushed the whole window upwards until its title and close button were off the screen, with no way to bring them back - the dialog could only be left through Save or Cancel. Dialogs now stay put; only their contents scroll, as before.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.21.1
