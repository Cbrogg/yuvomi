<!-- version: 2.52.0 -->
Reminders on a shared event now reach the people it is shared with. Until now a reminder belonged only to whoever set it: you could create an appointment, assign it to your partner, set a reminder for the day before, and they would be told nothing - and when they opened the same event, the reminder field sat there empty, which reads as "none is set" rather than "yours is not set". A reminder set by the person who created the event is now created for everyone assigned to it, so it arrives as a notification and is visible when they open the event. Each person gets their own, which they can move or delete without affecting anyone else's; a reminder you set for yourself is never overwritten, and being removed from an event removes the inherited reminder with it.

Checklists inside a task's description can now be ticked off directly. The boxes written as `- [ ]` were already displayed but did nothing, so keeping a packing list or a set of steps up to date meant opening the editor and changing the raw text by hand. They work as real checkboxes now, the same way they already do in Notes. Two people ticking different items at the same moment both keep their tick.

The walkthrough shown to a new account is now remembered on the account instead of in the browser. Signing in on a second device, or in a private window, no longer shows it again.

Two smaller calendar corrections: in the week view, the day headings and the all-day row now line up with the hourly columns below them, which they had been sitting slightly beside.

This update applies a database migration on first start. It runs automatically; nothing needs to be done by hand.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.52.0
