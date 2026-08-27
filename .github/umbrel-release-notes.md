<!-- version: 2.49.0 -->
An appointment that nobody picked a colour for now takes the colour of the person it belongs to. That sounds small, but it had stopped working: every new appointment was quietly given the first colour of the palette, and every appointment arriving from a synced calendar was given that calendar's colour. Both looked exactly like a deliberate choice afterwards, so the colour of the family member always lost - even though their picture was sitting right next to the entry.

The event dialog now opens on a new first option, "colour of the assigned person", and that is where a new appointment starts. Choosing a colour still keeps it, in the calendar and across syncs, so nothing you have set by hand changes. Appointments you already have are left exactly as they are: a colour that was stored years ago cannot be told apart from one that was chosen on purpose, and this update would rather change nothing than throw away a real choice. Entries from a synced calendar sort themselves out on their own with the next sync; for the ones you created in Yuvomi, opening the appointment once and picking the new option is enough.

Two smaller things follow from the same change. Clearing a colour on an appointment that is mirrored to Google now clears it there too, instead of leaving the two sides showing different colours forever. And the countdown tile on the overview borrows the colour the same way, so the same appointment no longer looks one way in the calendar and another way on the tile beside it.

This version changes the shape of one database table so that "no colour of its own" can be stored at all. It happens automatically when the container starts; nothing needs to be done by hand, and no appointment, assignment or reminder is lost in the process.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.49.0
