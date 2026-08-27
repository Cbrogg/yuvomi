<!-- version: 2.50.0 -->
Colours you give an appointment now travel. Until this release they reached Google and stopped there: a Nextcloud or iCloud calendar never learned about them, even though Yuvomi went to the trouble of sending an update every time you recoloured something. Both now carry the colour, and clearing one clears it on the other side too. Because the calendar standard only permits colours by name, an appointment arrives at the server as the closest standard colour - a deep violet may land a shade beside where it started.

The other direction was worse, and it is the fix worth knowing about: if you renamed an appointment in Yuvomi, its colour froze there for good. Whoever coloured that same appointment in Nextcloud, iCloud or Google afterwards was talking to an app that had stopped listening. Editing an appointment no longer has that effect - only actually changing its colour does.

Yuvomi adds a column to its calendar for this, and the first start after the update does that on its own. Nothing to do by hand. Appointments whose colour is protected today stay protected: the update assumes an existing colour was chosen deliberately rather than guessing which ones were frozen by mistake.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.50.0
