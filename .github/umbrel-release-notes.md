<!-- version: 2.38.0 -->
When something goes wrong on the server, Yuvomi no longer tells you your data is gone. Until now a failed load looked exactly like an empty page: the tasks list said "No tasks - all done?" and offered to create one, the budget said there were no entries this month, and the calendar showed an empty grid. In each case the information was still safely there, and the only button on screen was one that would have written something new. All three now say plainly that loading failed, show the error code, and offer to try again.

Four other screens had the opposite problem: they reported an error but gave you nothing to do about it, so the only way forward was to reload the browser. Subscriptions, Housekeeping, Rewards and the shared expenses inside Budget now all offer a retry, and the housekeeping page no longer shows an untranslated technical message in place of an explanation.

Every empty view in the app now looks and behaves the same way, whichever module you are in: the same layout, the same wording for "nothing here yet" versus "nothing matched your search", and the same kind of button to move on. Screen readers benefit most from this: search results that found nothing are now announced instead of passing silently, errors are announced as errors, and the heading on an otherwise empty page is a real heading again.

Nothing needs configuring and nothing changes about your data.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.38.0
