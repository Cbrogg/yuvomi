<!-- version: 2.25.1 -->
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

  HINWEIS ZU DIESER VERSION: kein Handlungs-Absatz im engen Sinn - keine neue
  Env-Variable, keine Migration, die jemand anstossen muesste. Der zweite
  Absatz nennt trotzdem eine Handlung, weil es fuer einen Teil der Leser eine
  gibt: wer die Schnittstelle wegen genau dieses Fehlers von normalen Konten
  ferngehalten hat, kann sie jetzt wieder freigeben.

  Der Text nennt zuerst, WEN es betrifft, und erst dann, was passiert war. Ein
  Haushalt ohne eingeschraenkte Mitglieder und ohne Schnittstellen-Zugang ist
  gar nicht betroffen, und das muss er nach einem Satz wissen, statt sich durch
  eine Sicherheitsmeldung zu lesen, die ihn nichts angeht.

  Draussen bleibt die ganze Bauart: dass es zwei Zugangswege mit getrennten
  Pruefungen waren, wo die Regel stand und wohin sie gewandert ist, wie die
  Werkzeugliste gefiltert wird, welche Pruefschicht welchen Weg deckt. Ebenso
  draussen bleibt das Kuerzel MCP: im Store liest das ein Haushalt, und
  "Schnittstelle fuer KI-Assistenten" sagt ihm dasselbe.
-->
Wer einzelnen Mitgliedern oder Familienrollen den Zugriff auf Module eingeschraenkt hat und zugleich einen Zugang fuer Skripte oder KI-Assistenten vergibt, sollte dieses Update einspielen. Ein Mitglied, dem zum Beispiel die Aufgaben entzogen waren, bekam sie in der App korrekt verweigert - ueber die Schnittstelle fuer KI-Assistenten wurden sie ihm aber trotzdem herausgegeben, lesend wie schreibend. Beide Wege halten sich jetzt an dieselben Rechte, und dasselbe gilt fuer Gastkonten der geteilten Ausgaben, die ausserhalb ihres Bereichs nichts mehr erreichen.

Einzustellen ist dafuer nichts: die vergebenen Rechte gelten ab dem Update auch dort, und Haushalte ohne eingeschraenkte Mitglieder merken keinen Unterschied. Wer diesen Zugang bisher bewusst nur Verwaltungskonten gegeben hat, weil ein normales Mitglied darueber zu viel sehen konnte, kann ihn jetzt wieder freigeben.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.25.1
