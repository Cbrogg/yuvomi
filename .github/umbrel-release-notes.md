<!-- version: 2.23.0 -->
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

  HINWEIS ZU DIESER VERSION: eine optische Runde, die in vielen Modulen
  gleichzeitig sichtbar ist - deshalb ein Absatz ueber das, was ueberall
  passiert (farbige Etiketten tragen ihre Farbe klarer), und ein zweiter ueber
  die eine Stelle, an der jemand einen konkreten Unterschied bemerkt:
  Haushaltsmitglieder in der Geburtstagsliste. Keine Migration, keine neue
  Einstellung, also kein Handlungs-Absatz. Der Zielgroessen-Fix am
  Aufgaben-Etikett bleibt draussen - er ist eine Pixelgroesse und faellt unter
  "keine internen Details".

  Draussen bleibt die ganze Bauart: welche Regel wo stand, welcher Container
  eine Scroll-Box war, welche Zahl gemessen wurde, welcher Test es absichert.
-->
Coloured labels across the app are easier to tell apart. Where a task's priority, a pantry warning or the status of a stored item used to sit on a faint tinted background that said the same colour twice, it now shows that colour clearly and once - as a small filled dot beside the word, or in the lettering itself. The countdown next to a birthday gained back the middle step it had lost, so a birthday tomorrow no longer looks the same as one in forty days. A number of small badges that were tinted in the colour of the section they already sat in have gone quiet, which leaves more room for the ones that do carry meaning.

Household members now show their own colour in the birthday list. They already did on the overview, in the calendar and in contacts; here everybody sat on the same grey circle, which made a family member indistinguishable from a relative who has no account. Anyone linked to a household account now appears with their picture or their initials in the colour they picked.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.23.0
