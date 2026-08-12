<!-- version: 2.7.0 -->
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
This update completes the two-way sync with CalDAV reminder lists. Until now a task that came from your server could be edited, completed or deleted and the change reached the server, but a task you created in Yuvomi stayed on this device and nothing said so. You can now pick a reminder list when creating a task, and it is uploaded like any other. Each member sets their own default list under Settings, Personal, Task defaults; a task without a list stays local exactly as before, so nothing changes unless you choose it.

Recorded medication doses can be corrected. Until now marking a dose as taken or skipped was final, which also meant a mistake stayed in the CSV export you might hand to a doctor. You can now change the time of a dose, take an entry back, and delete an entry that was not part of a schedule. A scheduled dose is taken back rather than deleted, because the plan would simply create it again. The dose log also tells the three states apart properly now: a dose still waiting for its time is no longer listed as taken.

The note field on a task is larger and understands Markdown, so a checklist or a heading in a task looks the same as it does in the Notes module.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.7.0
