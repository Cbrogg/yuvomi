<!-- version: 2.34.0 -->
Your household now has its own time zone, set under Settings, Personal, Appearance, Region. Until now the only way to tell Yuvomi where you live was the TZ variable in the container configuration, which is not something you can reach from Umbrel. Leave the new setting on "Automatic" and nothing changes; pick a zone and everything that has to know the time follows it.

Households west of UTC will notice several things stop going wrong. Appointments later in the day disappeared from the Overview from the early evening onwards, recurring shared expenses were booked the night before they were due, and a birthday on 31 December could jump a whole year ahead. All of these came from the server working out today's date in UTC rather than in your own time.

Appointments pushed to Outlook also arrive at the right time now. They were sent in Berlin time regardless of where you live, which shifted every one of them for anyone further away.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.34.0
