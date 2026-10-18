# Step 7 — Shorter wake lock in battery saver

`wakeTick` holds the screen on for `WAKE_MS` (10 min) after the last touch while time runs. The
screen is the biggest battery drain on the device. Keep 10 minutes for normal play (the meadow is
meant to be watched), but cut it to 3 with battery saver on.

## Where

All in `game.js`:

- `const WAKE_MS = 10 * 60 * 1000;` and `function wakeTick(now)` (~line 15665–15677). The relevant
  line: `const want = ui.speed > 0 && !document.hidden && now - lastInput < WAKE_MS;`
- `saverOn` from step 6.

## Changes

1. Next to `WAKE_MS`, add `const WAKE_SAVER_MS = 3 * 60 * 1000;`
2. In `wakeTick`, use it:
   ```js
   const want = ui.speed > 0 && !document.hidden && now - lastInput < (saverOn ? WAKE_SAVER_MS : WAKE_MS);
   ```

Nothing else: the existing release path (`!want && wake.lock`) already lets the screen dim and
lock as usual once the window passes.

## Rules

- Do not change the default 10 minutes — only the saver path.
- `wakeTick` runs 4×/s from the `lastCard` block; keep it that cheap.

## Acceptance

- Code review: saver off → `WAKE_MS`, saver on → 3 min; the release path is untouched.
- Hard to observe directly in a desktop browser (wake lock needs a touch device); on Android
  Chrome with saver on, the screen dims ~3 min after the last touch while playing, vs ~10 min with
  it off. Verify the logic by reading it and by toggling `saverOn` in the console if no device is
  at hand.
