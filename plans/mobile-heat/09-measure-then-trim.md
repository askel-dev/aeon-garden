# Step 9 — Measure, then trim (only what the numbers name)

Steps 0–8 are unconditional wins. This step is different: **do not implement anything here without
a measurement that names it.** Run the worst case on a real phone after steps 0–8, and only then
pick from the menu below.

## How to measure

1. Real phone (iPhone Safari and/or Android Chrome), `?perf&seed=123`:
   - zoomed out (`garden.cam.zoom = garden.cam.goal = 1`),
   - rain or storm at night if the meadow offers one, a lit fire on screen,
   - `garden.ui.speed = 60` for two minutes, watching `perf.ren` and `perf.sim`.
2. Note the rung the governor settles on. If the phone stays at rung ≤ 1 and cool-ish, stop here —
   the work is done.
3. If `perf.ren` stays over budget even at rung 3, find the cost with Chrome/Safari remote
   profiling (Performance panel), the forager walking, zoomed out, at speed.

## The menu (each independent, each small)

- **Sim budget under saver.** `const SIM_MS = 6, SIM_STOP = 3 * SIM_MS;` (~line 15633). Make it
  `let simMs = saverOn ? 4 : 6` used where `SIM_MS` is, with `SIM_STOP` derived. A slow phone at
  60x runs time a little slower instead of dropping frames — already the documented design.
- **Ambience source gating (sound.js).** The noise loops (rain, bees, leaves) run whether or not
  they're audible. In `tickAmbience` (the `setInterval` at 200 ms), stop a loop's source when its
  gain has been ~0 for ~30 s (bees at night, a dead fire), restart on demand. Modest win, only
  with sound on; skip if the profile doesn't show audio-thread cost.
- **Zoomed-out draw count.** If a profile shows thousands of `drawImage`s zoomed out after
  `lowFx`: in `drawPlants`, skip plants whose on-screen size is under ~3 px (they are sub-pixel
  specks); and raise the `zoomedOut`/`drawSmall` cutoff one step on coarse pointers. Follow the
  existing `visible()` culling pattern; do not add new passes.

## Rules

- One menu item per commit, with the before/after `?perf` numbers in the commit message (the
  project's rule for obviously costly changes).
- If a trim is visible at arm's length on a phone, it's too deep — back it out.
- Do not touch the sim's object layouts, the neighbour grid, or the sprite cache keying.

## Acceptance

- Whatever was implemented: the same scene measurably cheaper (`perf.ren` down on the same phone,
  same scenario), the meadow visibly unchanged, and the README table updated.
