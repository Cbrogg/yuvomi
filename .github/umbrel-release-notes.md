<!-- version: 2.40.0 -->
If your household signs in through your own identity provider, single sign-on can now be the only way in. Until this release Yuvomi always kept a second door open: the login form stayed, password reset stayed, and every account still carried a password. Setting AUTH_ALLOW_PASSWORD_LOGIN to false closes all three together, so the sign-in page shows nothing but the button to your provider. It deliberately does nothing until your provider is fully configured and an administrator has actually signed in through it at least once, because a switch that takes hold any earlier would lock a household out of its own app. Existing passwords are left untouched, so turning it back on restores the old sign-in page unchanged.

A family member can also be given an account with no password at all, which is useful when they only ever sign in through your provider. Until now preparing such an account meant inventing a password that nobody would use and that nonetheless kept working. The new option sits next to the password field when you add or edit a member.

This release also closes a hole in password reset. An account created through single sign-on carries no password, and the reset flow did not know that: it would happily set a real, working one, and anyone who knew the email address stored in Contacts could trigger it. Such accounts are now left alone, whichever way the reset is requested. Nothing needs doing on your side, and the change is invisible to accounts that do have a password.

Nothing needs configuring and nothing changes about your data. Everything new here is optional and off until you turn it on, so an existing installation behaves exactly as it did before.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.40.0
