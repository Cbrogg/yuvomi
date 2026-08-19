<!-- version: 2.24.0 -->
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

  HINWEIS ZU DIESER VERSION: eine Runde am Erscheinungsbild, quer durch die
  App - keine Migration, also kein Handlungs-Absatz. Drei Themen statt einer
  Aufzaehlung von zehn Modulen: was man LIEST (Zahlen und Diagramme), was man
  NICHT SAH (verdeckte Zeilen, unsichtbare Marken im hellen Modus) und die
  Belohnungen, wo zwei verschiedene Dinge gleich aussahen. Der letzte Punkt
  steht eigenstaendig, weil er Kinder betrifft und der einzige ist, bei dem
  eine Auskunft schlicht falsch war.

  Draussen bleibt die ganze Bauart: welche Regel wo stand, welcher Container
  eine Scroll-Box war, welche Zahl gemessen wurde, welcher Test es absichert.
-->
Zahlen und Diagramme sind besser zu lesen. Die Kennzahlen oben auf einer Seite stehen jetzt in der Groesse, die ihnen zusteht - im Inventar waren Anzahl und Gesamtwert bislang so gross wie ihre Beschriftung und gingen darin unter. Der Verlauf im Budget beschriftet seine Werteachse jetzt im Diagramm selbst, statt daneben, und die Zahlen dort werden nicht mehr am linken Rand abgeschnitten. Die Balken der monatlichen Zahlungen in der Haushaltshilfe zeigen, wie voll sie sind, statt nur unterschiedlich hoch zu sein. Auf dem Telefon rutschen zu enge Kennzahlreihen in zwei Spalten, damit Woerter wie "Gegenstaende" nicht mitten im Wort umbrechen.

Zwei Dinge waren schlicht nicht zu sehen. Der Hinweis zum Installieren der App lag ueber dem Ende jeder Seite, ohne Platz dafuer freizuhalten - bei den Belohnungen blieb dadurch die unterste Zeile mit dem Punktestand eines Kindes unerreichbar, egal wie weit man scrollte. Und im hellen Modus fehlte den meisten Eintraegen in den Einstellungen ihr Symbolfeld, sodass zwoelf farbige Zeilen neben siebzehn scheinbar leeren standen; im dunklen Modus war es immer da.

In den Belohnungen ist wieder zu erkennen, woher Punkte stammen. Ein Punkt aus einer erledigten Aufgabe und ein vergebener Bonus wurden in derselben Farbe angezeigt, also gar nicht unterschieden - im Verlauf sagen das jetzt die Symbole, die es dafuer immer schon gab.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.24.0
