<!-- version: 2.21.0 -->
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

  HINWEIS ZU DIESER VERSION: eine visuelle Runde an genau EINER Kachel, ohne
  Migration und ohne neue Pflicht-Einstellung, also kein Handlungs-Absatz. Zwei
  Absaetze reichen, weil es zwei Dinge zu sehen gibt: die Kachel hat die Farbe
  ihrer Wetterlage bekommen und bewegt sich, und die Vorhersagezeile sagt jetzt
  etwas ueber die Woche. Draussen bleiben die Kontrastmesswerte, die Namen der
  Toene und Baender, die Bauart der Bewegungsschaltung und die beiden Fehler,
  die beim Bauen selbst gefunden und behoben wurden (ausgeliefert war keiner
  von beiden) - das alles steht im CHANGELOG. Der dritte Absatz nennt die
  Barrierefreiheits-Schalter, weil sie eine Antwort auf die naheliegende Sorge
  sind: eine Kachel, die sich von selbst bewegt, will man abschalten koennen.
-->
The weather tile now shows the weather instead of the app's own color. Clear skies, night, cloud, rain, snow and thunderstorms each have their own color, and the symbol carries it along with a soft glow behind it. It also moves the way the weather does: the sun turns slowly, clouds drift, rain and snow fall, and a thunderstorm lights up. The same color appears in the short weather line under the greeting and on the wall-tablet view, where every forecast day gets its own.

The forecast row tells you something about the week now. Under each weekday there used to be a high and a low and nothing else, so seeing which day will be the warmest meant comparing numbers. Each day now has a small bar: where it sits shows where the day falls in the week, its length shows how much the temperature swings, and its color says how warm it will get. The first column simply reads "Today".

If you would rather have less movement, your device's reduce-motion setting stops all of it and keeps the colors. The reduce-transparency and increase-contrast settings additionally switch off the glow behind the symbol.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.21.0
