# Stats: what the meadow's visitors' board could do

Our own Umami since 2026-10-23: a fork (`askel-dev/umami`) on Vercel at https://stats.cryptoler.net, with a Supabase
project of its own (`DATABASE_URL` the transaction pooler, `DIRECT_DATABASE_URL` the session pooler for the build's
migrations; the session pooler alone ran out of its 15 clients). The tracker goes by `meadow.js`
(`TRACKER_SCRIPT_NAME`) so blockers pass it by. No cap on events, but keep them few: once a visit, a day or a deed, never
once a pick. Nothing personal: no room codes, friends' names or chat.

## Learning from it (built first)

- **Errors** from devices we don't own: `window.onerror` / `unhandledrejection`, the message cut short and where.
- **Frame times**: once a visit after a minute of play, the median and slow frames in buckets, with phone or desktop,
  the browser and how far zoomed out. Is it smooth on other people's phones?
- **Where newcomers stop**: the firsts make a funnel (a pick, the fire, a dish, a fish). Umami's Funnels report.
- **Balance**: which dishes get cooked (and which recipes nobody finds), fishing (perfect, landed, lost), collapses and
  why (cold, hunger, wet).
- **How long people stay**: the day a meadow reaches, sent at dawn (day 3, a season, a year).
- **Updates**: the version on every event; whether What's new gets opened.

## Bringing it back into the game (built 2026-10-23, waiting on the deploy below)

Built: the rarity chips, the dawn line, the autumn feast (Harvest fish, 2,000 fish: recipes.js
`festival`, tune `of` once we see the numbers) and the week's best-loved, all on the book's Everyone page rather than a
board at camp (a board in the meadow could come later). Not deployed yet:

1. In Umami's Supabase project: run `supabase/tally.sql` (a read-only role; put in a password of your own).
2. In the game's project (cecvgnhq...): secrets `UMAMI_DB` (that role through the transaction pooler, port 6543, user
   `meadow_tally.<umami project ref>`) and `UMAMI_SITE` (the website id), then deploy `supabase/functions/tally`.

Until then tally.js gets nothing and the game shows none of it (the Everyone tab stays hidden). The SQL was tried on a
copy of Umami's tables (PGlite), not on the real database: the first call's log says if a column is named otherwise.


These read numbers back through a Supabase Edge Function (like the stone's) holding an Umami API key as a secret,
cached an hour, so the page sees only the totals.

- **Rarity in the recipe book**: "found by 6% of foragers" under each Find, from the `first` events (a browser sends
  each first once ever) over the visitors.
- **Not nobody's meadow after all**: a quiet line at dawn, "214 foragers walked a meadow today" (and "in 19 countries").
- **The stone gossips** (built, then taken out 2026-10-23: not wanted): the week's most-cooked dish and catch fed to the stone. "Everyone's been frying trout this
  week. Bold of you to bring me soup."
- **A goal for all meadows together**: "foragers caught 8,400 / 10,000 fish this autumn", and a festival dish or a
  camp thing when it's reached. Counts can be faked; for a cosy game that's fine.
- **The week's best-loved**: the top three dishes everyone cooked, on a board at camp, in the dish paintings.
- **A private dashboard of our own** if Umami's charts aren't enough.
