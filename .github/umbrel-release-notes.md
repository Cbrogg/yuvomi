<!-- version: 2.55.0 -->
Appointments you create in Yuvomi now carry a time zone when they are pushed to a CalDAV server. Until now they went out as a bare time - "ten o'clock", with nothing saying on whose clock. Apple's Calendar and eM Client fill in the device's own zone and land on the right hour, so most people never noticed; a Synology calendar accepts the same appointment, hands it back when asked, and simply never shows it in its own web interface, because it needs a point in time and was given none. If appointments have been missing from your calendar server's own view, this is why. They correct themselves the next time Yuvomi pushes them.

The currency setting is where you would look for it. It used to sit inside the "custom formats" card under Appearance, and that card only appears when your settings do not match a region preset - so on a normal installation the currency was invisible, and it became visible only after you had already changed it. It now sits directly under the region selector. Picking a region still fills it in; you can also just change the currency and leave your date and time formats alone.

Meals planned from one of your own recipes now have a button that opens it. The link was there in the data all along, but only an external web address ever got a button, so a recipe stored in Yuvomi could be attached to a meal and never opened from it.

Two security fixes round this off. Yuvomi follows redirects when it fetches calendar subscriptions, WebDAV storage or a document management system; a server could previously redirect it from an encrypted connection to an unencrypted one, or point it at a different host and receive the account credentials meant for the original. Both are now refused. And uploads - documents, photos, logos - are checked against the actual file rather than the type the browser claims, so a file filed as a PDF is one.

Nothing to do after the update - no migration, and no settings changed.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.55.0
