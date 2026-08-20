<!-- version: 2.24.3 -->
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

  HINWEIS ZU DIESER VERSION: keine Migration, aber ein Handlungs-Absatz, und
  der steht bewusst zuerst. Umbrel setzt fuer die App keine Zeitzone, ein
  Container laeuft also auf UTC - und genau davon haengt ab, ob die
  Kalender-Korrektur bei diesem Haushalt ueberhaupt ankommt. Wer TZ nicht
  setzt, bekommt weiterhin verschobene Zeiten im abonnierten Kalender, nur
  jetzt ausdruecklich als UTC statt unbestimmt. Das ehrlich zu sagen ist mehr
  wert als die Korrektur zu bewerben.

  Draussen bleibt die ganze Bauart: Kalenderformat-Namen, welche Felder ein
  Termin traegt, wo der Fehlerstand gespeichert wird, welcher Test es
  absichert.
-->
Termine in einem abonnierten Kalender erscheinen wieder zur richtigen Zeit. Ein Termin, den du in Yuvomi anlegst, wurde im geteilten Kalender ohne Zeitzone weitergegeben - Google Kalender, Apple Kalender, Thunderbird, Outlook und Home Assistant lesen so etwas als UTC, ein Termin um 16 Uhr stand bei allen Abonnenten um 18 Uhr. Yuvomi gibt jetzt die Zeitzone deines Haushalts mit. Damit das bei dir wirkt, muss die App wissen, in welcher Zone du lebst: Umbrel startet sie ohne diese Angabe, sie laeuft dann auf UTC. Setze in den Einstellungen deiner Yuvomi-Installation die Variable TZ auf deine Zone, zum Beispiel Europe/Berlin. Ohne diese Angabe bleiben die Zeiten verschoben. Ein erneutes Abonnieren ist nicht noetig, die naechste Aktualisierung des Kalenders korrigiert die Termine von selbst.

Termine, die eine Kalenderverbindung mitgebracht hat, lassen sich wieder loswerden. Wer die Verbindung zu Google oder Apple getrennt hat, blieb bisher auf allen bereits uebernommenen Terminen sitzen: kein Abgleich fasste sie noch an, und beim erneuten Verbinden kamen sie ein zweites Mal herein - am deutlichsten bei wiederkehrenden Terminen. Sie einzeln zu loeschen war der einzige Weg. Beim Trennen fragt Yuvomi jetzt, ob sie mitgehen sollen, und nennt dabei ihre Anzahl; wer schon getrennt hat, findet den Weg in den Einstellungen unter Synchronisation. Deine eigenen Termine bleiben, und beim Anbieter aendert sich nichts - entfernt wird nur die Kopie in Yuvomi, ein erneutes Verbinden holt alles zurueck.

Ein fehlgeschlagener Kalenderabgleich sagt es dir. Bisher landete so ein Fehler nur im Serverprotokoll, ein abgelaufener Zugang sah von aussen aus wie ein Kalender, der einfach aufhoert sich zu aktualisieren - in einem gemeldeten Fall faellt das erst nach zwei Wochen auf. Der letzte Fehler steht jetzt in den Einstellungen unter Synchronisation, direkt unter dem Verbindungsstatus, und verschwindet von selbst, sobald ein Abgleich wieder durchlaeuft.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.24.3
