# Keeper-mode playtest (partial, stopped early)

2026-10-12, `?keep&dry=1`, seed 570037, headless Chrome 155 at 1440x900 (the page gets 1440x813: the
headless window frame takes 87 px). The run was cut short after the first look. Pond, strip and hedge
drags, the Dry Year at 60x, alerts, the loss/came-through card and the phone size (390x844) were **not** tested.
The served tree had another session's uncommitted sim.js change in it (`wildGreen`).

Screenshot: `research/playtest/01-desktop-first-look.png` (spring, day 1, year 1).

## What I saw

- **No welcome for a first-timer at ?keep.** `firstVisit` is `!LAB && !KEEP && …`, so a new player gets no card
  and no intro. TASKS appears 1.5 s later. Nothing says what the game is, or that you keep the meadow.
- **"DRY YEAR next season" with no meaning given.** The ribbon under the watch is the biggest new thing on screen,
  but nothing says what the Dry Year does or how to get ready. The three tasks (pond → frogs, flowers → bees,
  hedge → rabbit hides) never mention it, so the threat and the verbs look unrelated (Axel's own worry in PLAN.md).
- **A species reads 0 at the start.** The top bar's last entry (a brown icon, likely frogs or otters) shows 0 on
  day 1. To someone new that looks like something already lost, and the icon isn't clear at that size.
- **`dry=1` is dropped from the address.** The link becomes `?seed=570037&keep`, so a reload or a shared link
  doesn't say it was a fast-Dry-Year test (the kept world remembers it, a fresh open of that link doesn't).
- GREEN shows "80% / was 80%" on day 1: the "was" means nothing yet.
- Layout at desktop looked clean: TASKS top left, the news bottom left over the bar, the build bar centred, no overlaps.
- Console: no errors or warnings in the first ~5 s.

## Most valuable fixes so far (from a short look, not a full run)

1. Give ?keep a one-card welcome: what the meadow is, that a Dry Year is coming, what helps.
2. Explain the Dry Year where it's shown (a tap or hover on the ribbon: what happens, when, what helps).
3. Link the tasks to the Dry Year (e.g. "Dig a pond → green banks in the Dry Year").
4. Hide or soften a species at 0 on day 1 (or say "none yet") so it doesn't read as a loss.
5. Hide GREEN's "was" until there's a change to compare with.
6. Keep `&dry=N` in the rewritten link while testing.

## Still to do

Everything past the first screen: the three drags via real pointer events, 60x through the Dry Year, alerts,
the loss card, phone layout at 390x844, console errors over a long run. The CDP helpers are in this session's
scratchpad (`lib.mjs`, `open.mjs`) if the next run wants them.
