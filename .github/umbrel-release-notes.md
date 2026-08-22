<!-- version: 2.26.0 -->
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

  HINWEIS ZU DIESER VERSION: ein neues Feature, das NIEMAND ungefragt bekommt -
  ohne eigene Zugangsdaten passiert gar nichts. Der Handlungs-Absatz ist
  deshalb nicht "das musst du tun, sonst bricht etwas", sondern "das ist noetig,
  falls du es willst". Er steht trotzdem an zweiter Stelle, weil die eigene
  App-Registrierung bei Microsoft die Huerde ist, an der es sonst scheitert.

  Der dritte Absatz ist der wichtigste und darf nicht wegredigiert werden: es
  ist die erste Stelle, an der Yuvomi fremde Eingaben aktiv ueberschreibt. Wer
  seine Termine bisher in Outlook gepflegt hat und das hier einschaltet,
  verliert diese Aenderungen beim naechsten Abgleich. Das gehoert vor die
  Entscheidung, nicht in eine Fehlermeldung danach.

  Draussen bleibt die Bauart: Microsoft Graph als Name der Schnittstelle, die
  Erkennung ueber gespeicherte Aenderungsmarken, der Ausschluss bereits
  synchronisierter Termine, die Zahl der Anfragen pro Lauf. Ebenso draussen
  bleibt die halbe Version an Verbesserungen der Projektwebsite - die sieht im
  Store niemand, der ein Update einspielt.
-->
Yuvomi kann Termine jetzt nach Outlook.com schicken. Wer ein privates Microsoft-Konto nutzt, sieht seine Yuvomi-Termine damit auch im Outlook-Kalender auf dem Handy, in der Uhr und ueberall dort, wo dieses Konto eingerichtet ist. Mehrere Konten lassen sich verbinden, jedes bekommt einen eigenen Zielkalender, und wer im Haushalt zu einem Termin eingeteilt ist, steht im Titel dahinter. Das schliesst eine Luecke, die es sonst nicht zu schliessen gab: Outlook.com bietet keinen der ueblichen Kalenderwege mehr an, und ein abonnierter Kalender wird dort erst nach Stunden aktualisiert.

Wer das nutzen moechte, legt einmalig eine kostenlose eigene App-Registrierung bei Microsoft an und traegt die drei Zugangsdaten daraus in den Einstellungen ein; der Installationsassistent fragt sie auf Wunsch gleich mit ab. Ohne diese Angaben aendert sich nichts, und niemand muss etwas tun, der Outlook nicht verwendet.

Wichtig fuer die Entscheidung: der Abgleich laeuft nur in eine Richtung. Yuvomi gibt den Stand vor, und was in Outlook von Hand an einem uebertragenen Termin geaendert oder geloescht wird, wird beim naechsten Abgleich wieder auf den Yuvomi-Stand gesetzt. Wer seine Termine bisher in Outlook gepflegt hat, sollte dafuer deshalb einen eigenen, leeren Kalender anlegen und nicht den, in dem er bisher gearbeitet hat. Termine, die schon ueber Google, CalDAV oder ein Abo synchronisiert werden, bleibt der Abgleich fern, damit sie nicht doppelt erscheinen.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.26.0
