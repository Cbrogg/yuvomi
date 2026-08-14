<!-- version: 2.11.0 -->
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
-->
Reminders can now go to any web address you choose, and the cycle tab can be hidden per person.

Alongside Gotify and ntfy, a household can add a webhook channel that sends reminders to any HTTP address, secured with an optional token. If the receiving service expects its own message format, as Discord and Slack do, you can enter that format once and Yuvomi fills in the reminder title, text, link and tag. Leaving it empty keeps the standard message, which suits Home Assistant and n8n.

In Health, the cycle tab used to be one switch for the whole household. Every member can now hide it just for themselves under Settings, Personal, Health, since not everyone in a household has a cycle. The household switch still decides whether it is available at all, and nothing changes unless someone turns it off.

Searching a connected Paperless document server for a plain number now finds documents that merely contain it. A number was previously treated only as an archive serial number, so a document called "1728 Pest receipt" could not be found by searching for 1728. Searching for asn:1728 still looks up that serial number exactly.

The Belarusian ruble is available as a currency.

There is nothing to do after this update, and your data and settings are unchanged.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.11.0
