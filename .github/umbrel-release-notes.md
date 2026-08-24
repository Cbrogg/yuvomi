<!-- version: 2.39.0 -->
Dragging your task categories into the order you want now actually changes the order you see. Until this release the tasks page ignored it and sorted the groups alphabetically instead, so a category you had pulled to the top stayed wherever the alphabet put it. The order you set in "Manage categories" is now the order the groups appear in, in every language.

If you sign in to Yuvomi through your own identity provider, you can now decide whether it may create accounts. Until now anyone who could sign in at your provider got a Yuvomi account on their first attempt, which is fine when you run that provider for this household alone and rather less so when you do not. Setting OIDC_ALLOW_SIGNUP to false turns that off: people who already have an account still sign in as before, and an account you created by hand is still matched up on their first sign-in, but an unfamiliar login is turned away with a message saying so instead of quietly becoming a new member of your household.

Nothing needs configuring and nothing changes about your data. The new setting only takes effect if you set it yourself, so an existing installation behaves exactly as it did before.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.39.0
