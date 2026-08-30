# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Third-party modules can declare capabilities in `module.json`** for dashboard widgets, household permissions (`ext:<module-id>`), and API token scopes - the same surfaces core modules use, without changing core application code.
- **The dashboard dynamically loads third-party widget entry points** (`renderWidget`) from protected module assets, with per-widget error isolation and an optional generic options dialog driven by `optionsSchema`.
- **Third-party modules can ship UI translations** in `locales/{locale}.json` with manifest `i18n.defaultLocale`, `labelKey` / `titleKey`, and the same 24 core languages as Yuvomi.
- **OpenAPI now documents extension module capabilities** and module i18n metadata.

### Changed

- **`GET /api/v1/modules` includes normalized `capabilities` and `i18n` metadata** (widgets, permission module metadata, API prefix, available locale files) for each installed extension module.
- **Dashboard widgets, navigation, route guards, and admin permissions merge extension entries at runtime** from enabled modules, so third-party widget ids (`<module-id>:<widget-id>`) and `ext:<module-id>` permission keys behave like core modules.
- **API token and MCP scope pickers include extension modules** from the live permissions catalog instead of a fixed core-only list.
- **Extension `capabilities.api.prefix` must be exactly `/api/extensions/<module-id>`** — any other prefix, including a core path such as `/api/tasks`, is rejected so an installed module cannot take over a core token scope.
- **Extension UI labels resolve through a locale fallback chain** (UI language, module default, `en`, `de`, then static manifest labels) in navigation, Settings, permissions admin, and the dashboard widget chrome.

### Fixed

- **A failed `GET /modules` no longer wipes the household's extension widget layout.** A network hiccup, a server restart, or the `/api/` rate limit used to empty the in-memory module list; the next dashboard save then persisted a config with every `ext` tile gone. On recovery the widget came back as a newcomer: default size, default position, options lost. A failed fetch now keeps the previous list, and stored `<module-id>:<widget-id>` entries survive normalize even while the module is disabled or the catalog is empty.
- **The extension permission catalog is scanned before the server accepts requests.** Starting the scan inside the `app.listen` callback left a window where stored `ext:<module-id> → none` rows were dropped and the deny-list treated a missing key as allow.
- **Extension locale lookup no longer throws for module ids that collide with `Object.prototype`.** `constructor` (and `toString`) pass the module-id regex; looking them up on a plain `{}` store made `t()` throw instead of returning the key.
- **The empty options dialog for a third-party widget no longer quotes the task-categories copy.** It has its own string.

## [2.56.0] - 2026-08-30

### Added

- **Reminders can be delivered by email.** Households without a native app fell back to keeping a
  browser tab open: reminders reached Web Push, Gotify, ntfy or a webhook, and nothing else (#944).
  Email is now a fourth channel type next to those three, configured the same way under
  Settings → Personal → Notifications.

  It deliberately brings no credentials of its own. The SMTP access already configured for password
  resets and invitations is the one it uses, so a mail server is set up once and not once per
  channel - a second copy would only be a second place to forget when the server changes. A channel
  therefore holds just a recipient address; a second recipient is a second channel, which keeps each
  one separately switchable and separately testable. Who gets a reminder is still decided by the
  channel's scope, exactly as for the other providers.

  Two details are worth knowing. Web Push splits a reminder across title and body, but an inbox
  shows only the subject line, so the mail puts both there - "Calendar: Dentist" rather than
  "Calendar". And the link back into the app needs `BASE_URL`; without it the mail arrives without a
  link rather than with a dead one. The provider list marks email as not ready while SMTP is
  unconfigured, so the settings page says so before a test send fails.

  A note for anyone tracking health data: an email channel carries reminder contents in the subject
  line, medication names included, and subject lines stay readable in transit and permanently in the
  recipient's mailbox. `docs/PRIVACY-FOR-SELFHOSTERS.md` covers what that means.

- **A shopping list can be sent to whoever is doing the run.** The second half of #944. An entry in
  the list's overflow menu mails its open items to one household member, grouped by aisle in the same
  order the screen shows them.

  It sends a snapshot, not an access route - no link, no token, nothing that outlives the message.
  A read-only share URL was the other obvious shape and was deliberately not built: it would have
  been the first unauthenticated view of household data in Yuvomi, and a leaked link stays leaked.
  Someone who needs the list continuously is a household member and already has the app. Because a
  snapshot goes stale the moment someone at home ticks an item off, the mail says which moment it
  captured rather than pretending to be live.

  The recipient is picked from the household, and only members with an address on their contact
  appear - the same source password reset mails use. The address is never taken from the request:
  accepting one would make the instance an open mail relay for anyone with a login. Sending to
  yourself works too, which is the "get the list onto my phone" case, and then the mail skips the
  "X sent you this list" line.

  Needs SMTP configured. Three refusals are told apart rather than collapsed into one failure: the
  member has no address, SMTP is not set up, or nothing on the list is still open.

  Only actual household members can be picked, and that is narrower than "has an account". Housekeeping
  staff and shared-expense guests both have logins and both have a contact with an address on it -
  guests especially are external people who are blocked from every other part of the app. The rule that
  decides this is written once and used by both the picker and the send route, so the two cannot drift
  apart. An address field holding a list rather than one address makes that member unreachable instead
  of reaching everyone on it.

### Fixed

- **The settings page works offline again.** Its shell loads `dirty-guard.js` - the part that asks
  before you discard unsaved edits - and that file was never in the service worker's precache list.
  Online nobody noticed, because the network filled the gap. Offline the import failed and took the
  whole settings shell with it. The file is precached now.

  The date picker was missing the same way, and it is loaded by the router itself - so a first
  offline visit could get the HTML fallback instead of the module, on every page with a date field.

  The reason both went unnoticed is the more useful half. A guard does check that every module
  reachable from a precached one is itself precached, and it stayed green throughout: it read only
  imports written as `from '/absolute/path'`. The settings shell writes `from './dirty-guard.js'`
  and the router writes `import '/components/datepicker.js'` - a relative specifier and a
  side-effect import, both loaded by the browser exactly like any other. The guard now resolves both
  forms, which is how these were found in the first place.

## [2.55.0] - 2026-08-30

### Added

- **A planned meal opens the recipe it was planned from.** A meal can be tied to one of the
  household's own recipes - the field is in the form, it is stored, and the shopping-list transfer
  reads it. The button on the meal card, though, only ever appeared for an external web address, so
  the internal link had no way out: you could create it and never use it, and anyone cooking from the
  week plan landed in the edit dialog instead (#936). Meal cards with a linked recipe now carry
  a second button that opens it, expanded and ready to read rather than open for editing - whoever
  comes from the meal plan wants to cook. It is a real link, so command-click and "copy link" work
  the way they should. A meal that has both a recipe and an external address shows the recipe,
  because that one stays inside the app.

### Fixed

- **Events pushed to a CalDAV server carry a time zone.** An event created in Yuvomi went out as
  `DTSTART:20260830T100000` - no zone, no UTC marker, no `VTIMEZONE`. That is "floating time": the
  standard allows it, and it means "ten o'clock on the clock of whoever reads it". Apple's Calendar
  and eM Client substitute the device's own zone and land on the right hour; a Synology with a
  DAViCal backend accepts the event, hands it back unchanged when asked, and never displays it in
  its own web interface, because its index needs a point in time and was given none (#938). Times now
  carry the household's zone, the same way the export feed has since v2.24.3, and a matching
  `VTIMEZONE` travels with them. Recurring series keep the zone they were imported with, so a weekly
  appointment does not shift by an hour across a daylight saving change. Events already on a server
  take the corrected value on their next push; where the household zone is UTC the value gets a plain
  `Z` instead.

- **The currency setting is where you look for it.** It sat inside the format card under Appearance
  → Region / Format, and that card is hidden whenever a region preset matches your settings exactly.
  Since the currency is one of the things a preset is matched on, the effect was circular: on a
  default installation the card stays shut and the field is invisible - but change the currency and
  no preset matches any more, the card opens, and the field appears. It only became visible once you
  had already found it, which nobody had. The note in Module options pointing at "Appearance →
  Region / Format" led to exactly the place where nothing was shown; the reporter searched both and
  came away empty both times (#934). The currency now sits in the region card, which is always
  visible. Picking a region still fills it in - that stays the quick way, it is just no longer the
  only one. A currency is not a format: dates and times say how a value is written and follow a
  place, while a household can keep German formats and an account in dollars.

### Security

- **A redirect can no longer strip TLS or take credentials with it.** Yuvomi's outgoing requests -
  calendar subscriptions, WebDAV storage, recipe mirrors, document management - carry an SSRF guard
  that validates every address they connect to, and it followed redirects correctly. Two things,
  though, are not properties of an address, and both were unchecked. A target server could redirect
  from `https:` to `http:`, and the follow-up request went out in the clear without the caller ever
  learning of it. And the request headers travelled unchanged to whatever host the redirect named -
  for CalDAV, WebDAV and DMS accounts those headers hold a plaintext password, so a hostile or
  taken-over server could collect a household's credentials with a single 302 to somewhere else.
  Redirects now have to stay on http/https and may not step down from https; the credential headers
  are dropped when the origin changes, and only then, so a server sending `/cal` to `/cal/` keeps
  working. Reported as part of a security audit (#937).

- **Uploads are checked against their content, not just their declaration.** Every upload arrives as
  a data URL, and the type in its prefix - `data:application/pdf;base64,...` - comes from the sender's
  browser and can be set to anything. Five paths took that word for it: documents, birthday photos,
  housekeeper pictures, quick-link icons and subscription logos, each with its own check and none of
  them looking at the file. Yuvomi now verifies the file's own signature for PDF, PNG, JPEG, WebP, GIF
  and the Office formats. Plain text and CSV keep passing unchecked - text has no header, and a rule
  that guessed would reject a spreadsheet whose first cell holds angle brackets. What is served to the
  browser was already protected against the execution side of this (fixed content type, `nosniff`, a
  narrow policy); the gain here is the quiet failure - a file filed as an insurance policy that is not
  one, noticed years later when whoever uploaded it is long gone. Reported as part of a security audit
  (#937).
