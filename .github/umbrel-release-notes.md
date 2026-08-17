<!-- version: 2.17.0 -->
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

  HINWEIS ZU DIESER VERSION: drei gewuenschte Funktionen aus den Discussions
  (#700, #733, #734), ein Absatz je Thema. Die Migrationen (148, 149) legen nur
  Spalten und eine Tabelle an und verlangen vom Haushalt nichts - also kein
  Pflicht-Absatz. Der Absatz zur Uhrzeit gehoert dennoch hinein: er beschreibt
  eine Korrektur an bereits erfassten Daten, die jemand sonst fuer einen neuen
  Fehler haelt. Draussen bleibt, was nur Entwickler angeht: der geteilte
  Baustein, die Nummern der Migrationen, die Suiten.
-->
Medication marked "as needed" can finally be taken. Until now the setting existed but nothing in the app let you record such a dose, because every button belonged to a schedule. The Medications tab and the Health overview now share an "As needed" section: one tap records the dose and deducts it from your stock. Give a medication a minimum interval and it also tells you the earliest time for the next one, counted from the dose you actually took, so it reads the same after a reload and on a second device. Taking one earlier is still possible; the app only asks first.

Two older problems with the medication log are fixed along the way. A dose recorded without a schedule used to disappear from its own day - missing from the intake history, from the adherence figure and from the CSV export you print for a doctor. And the time of a recorded dose is your clock's time again: doses taken outside UTC were stored shifted by your time zone, so an evening dose could appear hours earlier. New entries are correct from this version on.

Tasks can now hold documents and a conversation. Attach a file to a task by uploading it, dropping it onto the field, or picking something already in Documents; it is filed in a "Tasks" folder and stays linked, and photos show as previews inside the task. Attachments inherit the visibility of their task, so what hangs off a private task stays private. Every task also has comments, where you can mention a family member with @name - they get a notification, but only if they may see that task.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.17.0
