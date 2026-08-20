<!-- version: 2.24.2 -->
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

  HINWEIS ZU DIESER VERSION: ein Thema, keine Migration, also kein
  Handlungs-Absatz. Alle drei Absaetze beschreiben denselben Fehler an drei
  Stellen - unter einer Liste war Platz reserviert, in dem nichts steht. Im
  Store zaehlt davon nur, was ein Haushalt sieht: es passt wieder mehr auf den
  Bildschirm, und nichts verschwindet mehr unter dem Installationshinweis.
  Der zweite Absatz steht getrennt, weil das der einzige der drei Faelle ist,
  in dem jemand tatsaechlich an etwas nicht herankam.

  Draussen bleibt die ganze Bauart: welche Regel wo stand, wie hoch eine Zeile
  vorher war, welcher Test es absichert.
-->
Listen, die innerhalb der Seite scrollen, zeigen wieder ihre volle Hoehe. Sobald in Einkauf, Vorrat oder Kontakten eine Auswahl getroffen war und die Leiste mit den Sammelaktionen erschien, blieb unter der Liste ein leerer Streifen stehen, der ungefaehr eine Zeile hoch war und sich nicht wegscrollen liess. Auf dem Einkaufszettel bedeutet das jetzt einen Artikel mehr im Blick, und zwar genau waehrend man abhakt. Erreichbar war ohnehin alles - der Platz war nur unnoetig belegt.

Der Hinweis, mit dem sich Yuvomi als App installieren laesst, verdeckt nicht mehr das Ende einer Liste. Auf den meisten Seiten hatte er schon Platz freigehalten, in Kueche, Budget, Kontakten, Notizen und Kalender aber nicht - dort lagen die letzten Eintraege darunter, ohne dass man weiter scrollen konnte. Das gilt jetzt ueberall gleich.

In der Terminliste des Kalenders war unterhalb des letzten Termins Platz fuer eine Schaltflaeche freigehalten, die auf einem Rechner an dieser Stelle gar nicht erscheint. Der Platz gehoert wieder den Terminen.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.24.2
