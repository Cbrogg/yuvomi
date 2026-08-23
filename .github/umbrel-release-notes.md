<!-- version: 2.36.0 -->
Times now read the same on every device in the household. The previous release gave the household a time zone of its own; with this one the app's display follows it too, so a phone that travels to another country shows the clock at home rather than the one where it happens to be. It also settles an inconsistency that was easy to see and hard to explain: an appointment you typed in yourself and one synced from Google, Apple or a CalDAV server are stored differently, and away from home the two used to show different times even when they were the same appointment. Nothing changes unless the household time zone is set under Settings, Personal, Appearance, Region; without it the display keeps following each device as before.

An appointment that carries its own colour now keeps it, even when the appointment is assigned to someone. Until now the colour of the assigned person came first, which hid colours that had arrived from a CalDAV calendar or been picked by hand. An appointment without its own colour still takes the colour of the person it belongs to, and who it belongs to is shown by the avatars beside it either way.

Writing a note has more room. The note window used to be as narrow as a form with a few short fields, which is the wrong shape for something that is mostly text; it now opens at the width used elsewhere for documents and contacts, for reading a note as well as writing one.

One smaller fix: the time zone setting introduced in the previous release showed "Automatic" again the next time the page was opened, although the choice had been saved correctly. It now shows what is actually set.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.36.0
