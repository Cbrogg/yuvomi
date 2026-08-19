<!-- version: 2.24.1 -->
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

  HINWEIS ZU DIESER VERSION: zwei Themen, keine Migration, also kein
  Handlungs-Absatz. Erstens der Wochenplan auf dem Telefon - das ist die
  Aenderung, die ein Haushalt sofort merkt, und sie gehoert zuerst. Zweitens
  die Markierung des heutigen Tages, die an zwei Stellen anders aussah als
  ueberall sonst; beim Zyklus-Kalender ist es mehr als Kosmetik, weil der Ring
  dort der Periodenfarbe zu nahe kam. Der Messwert dazu bleibt draussen - im
  Store zaehlt, dass die beiden jetzt auseinanderzuhalten sind, nicht um wie
  viel.

  Draussen bleibt die ganze Bauart: welche Regel wo stand, wie hoch eine Zeile
  vorher war, welcher Test es absichert.
-->
Der Wochenplan der Kueche ist auf dem Telefon endlich ueberschaubar. Eine geplante Mahlzeit stand bisher als hohe Kachel da - Titel, darunter ihre Schaltflaechen, darunter noch ein gestrichelter Streifen zum Hinzufuegen -, sodass zwei Gerichte den ganzen Bildschirm fuellten und eine Woche endlos zu scrollen war. Eine Mahlzeit ist jetzt eine Zeile mit ihren Aktionen am Ende, so wie Einkauf, Vorrat und Rezepte es schon immer gehalten haben; ein ganzer Tag passt damit auf einen Bildschirm. Verborgen wurde dabei nichts - alle Schaltflaechen bleiben sichtbar, sie kosten nur keine eigene Zeile mehr. Auf dem Telefon ist ausserdem der kleine Plus-Knopf in jedem belegten Feld entfallen: darunter steht bei jedem Tag bereits ein beschrifteter Knopf zum Hinzufuegen, und zwei Wege zur selben Handlung waren einer zu viel. Auf Tablet und Rechner, wo die freien Felder sichtbar sind, bleibt er.

Der heutige Tag ist ueberall gleich markiert. Im Wochenplan war er als eingefaerbte Schrift in der Kuechenfarbe hervorgehoben - eine dritte Schreibweise neben den zwei, die der Kalender ohnehin fuehrt; er traegt jetzt dieselbe Markierung wie dort. Im Zyklus-Kalender war es mehr als eine Frage der Einheitlichkeit: der Ring um heute hatte fast die Farbe, mit der die Periode eingetragen wird, und weil heute haeufig ein eingetragener Tag ist, trafen beide auf demselben Feld aufeinander. Sie sind jetzt klar zu unterscheiden.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.24.1
