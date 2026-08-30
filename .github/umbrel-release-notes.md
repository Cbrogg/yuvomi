<!-- version: 2.56.0 -->
Reminders can now arrive by email. Until now they reached you through the app, through browser push, or through Gotify, ntfy and webhooks - all of which assume you have set one of those up. Email is a fourth option next to them, and for a household that mostly uses Yuvomi in a mobile browser it is often the only one that needs no extra service. Set it up under Settings, Personal, Notifications, the same place as the others.

A shopping list can be sent to whoever is doing the run. One entry in the list's menu mails its open items to a household member, grouped by aisle in the order the app shows them. It sends the list as it stands rather than a link that stays live, and it says so: the mail names the moment it was taken, because whoever is carrying it around the shop cannot see what is being ticked off at home. Only members who have an email address on their contact can be picked.

Both need an outgoing mail server. If you have already configured SMTP for the "forgot password" function, they work immediately; if not, the settings page will tell you so rather than let a send fail silently. There is one configuration for all of it, not one per channel.

Worth knowing if you track medication: a reminder sent by email carries its subject in the subject line, medication names included, and subject lines stay readable along the way and permanently in the recipient's mailbox. On your own mail server that stays with you. Through a third-party provider it does not.

The settings page also works offline again. One of its parts was missing from the offline cache, and while the network covered for it nobody could tell; without a connection the page failed to open at all.

Nothing to do after the update - no migration, and no settings changed.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.56.0
