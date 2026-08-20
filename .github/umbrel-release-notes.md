<!-- version: 2.25.0 -->
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

  HINWEIS ZU DIESER VERSION: kein Handlungs-Absatz. Die Datenbank bekommt eine
  neue Tabelle, die beim ersten Start von selbst angelegt wird - das ist keine
  Handlung fuer den Haushalt und gehoert deshalb nicht in den Text.

  Der Bedienfehler steht zuerst, weil ihn jeder Haushalt taeglich trifft: er
  war app-weit und betraf nur die Maus. Das gehoert dazu, sonst liest sich der
  Absatz wie eine Korrektur an etwas, das der Leser nie kaputt erlebt hat -
  wer Yuvomi am Telefon bedient, hat den Knopf immer funktionieren sehen.

  Die Schnittstellen-Neuerung steht danach und ausdruecklich mit ihrem
  Adressaten davor ("wer Yuvomi ueber seine Schnittstelle ansteuert"), damit
  niemand nach einer Einstellung sucht, die es fuer ihn nicht gibt.

  Draussen bleibt die ganze Bauart: wie der Klick abhanden kam, wie der
  Schluessel gebildet wird, welche Antwortcodes es gibt, wie lange gespeichert
  wird, welcher Test es absichert.
-->
Der Knopf Rueckgaengig in den kurzen Meldungen am unteren Bildschirmrand funktioniert wieder. Wer eine Notiz, eine Aufgabe, einen Einkaufsposten oder einen Eintrag in einem anderen Modul geloescht hat, bekam die Meldung mitsamt Knopf angeboten - ein Klick darauf tat aber nichts, und die Loeschung blieb bestehen. Betroffen war nur die Bedienung mit der Maus: per Tastatur und am Telefon liess sich eine Loeschung immer zuruecknehmen, weshalb der Fehler lange unbemerkt blieb. Zwei kleinere Fehler an derselben Stelle gehen mit: die Meldung rutschte zur Seite und wurde unsichtbar, sobald der Mauszeiger sie nur beruehrte, und am Telefon liess sie sich nie wegwischen.

Wer Yuvomi ueber seine Schnittstelle ansteuert - eigene Skripte, Home Assistant, KI-Assistenten -, kann Schreibzugriffe jetzt gefahrlos wiederholen. Bricht die Verbindung ab, nachdem eine Aufgabe angelegt wurde, aber bevor die Bestaetigung ankommt, war bisher nicht zu erkennen, ob sie entstanden ist; ein zweiter Versuch legte sie moeglicherweise ein zweites Mal an. Wird beim Aufruf ein selbst gewaehlter Schluessel mitgeschickt, liefert die Wiederholung dieselbe Antwort wie beim ersten Mal, statt einen weiteren Eintrag zu erzeugen. Wer die Schnittstelle nicht nutzt, merkt davon nichts, und an bestehenden Aufrufen aendert sich nichts.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.25.0
