<!-- version: 2.27.0 -->
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

  HINWEIS ZU DIESER VERSION: drei Fehlerbehebungen und eine Funktion. Der
  Kalender-Absatz steht zuerst, weil er als einziger jemanden betrifft, der gar
  nichts eingerichtet hat - fehlende Termine in einer Ansicht sind das, was im
  Store zaehlt.

  Der Handlungs-Absatz ist der zur Anmeldung, wieder in der Form "noetig, falls
  du es willst": ohne Single Sign-on aendert sich nichts. Er nennt ausdruecklich,
  WO man es tut, weil genau dieser Weg bisher fehlte.

  Draussen bleibt die Bauart: Zeitzonenkuerzel, das Ladefenster des Kalenders,
  Zonen an Terminreihen, die Zielzuordnung der Einkaufsliste, Namen von
  Schnittstellen und Feldern. Kurz gehalten bleibt auch, warum ein gleicher
  Benutzername nicht verbindet - die Begruendung gehoert in die Anleitung, nicht
  in einen Update-Dialog.
-->
Die Tagesansicht des Kalenders zeigt wieder alle Termine. Wer westlich von Greenwich lebt, dem fehlten dort synchronisierte Termine am spaeten Nachmittag und Abend, waehrend Monat, Woche und Agenda dieselben Termine anzeigten - fuer den Abgleich gehoerte ein Abendtermin bereits zum naechsten Tag. Ausserdem behalten wiederkehrende Google-Termine ihre Uhrzeit jetzt ueber die Zeitumstellung hinweg; bisher verschoben sie sich ab dem Wechsel um eine Stunde.

Die Einkaufsliste laeuft nicht mehr auseinander, wenn sie mit einer Erinnerungsliste auf einem eigenen Kalenderserver abgeglichen wird. Umbenennen, Abhaken und Loeschen wurden schon immer uebertragen, ein in Yuvomi neu hinzugefuegter Artikel blieb aber liegen und tauchte auf dem Handy nie auf. Neue Artikel gehen jetzt ebenfalls hinaus, sofort und beim naechsten Abgleich.

Wer sich per Single Sign-on anmeldet, kann sein Anbieter-Konto nun selbst mit einem bestehenden Yuvomi-Konto verbinden. Bisher legte die erste Anmeldung ueber den Anbieter ein zweites Konto an, sobald Yuvomi die Person nicht sicher zuordnen konnte - die bisherigen Daten blieben dann im alten Konto liegen. Dafuer meldet man sich wie gewohnt in Yuvomi an und verbindet beide unter Einstellungen, Konto. Ein gleicher Benutzername verbindet weiterhin nicht von allein, denn er waere ein Weg, sich ein fremdes Konto zu nehmen.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.27.0
