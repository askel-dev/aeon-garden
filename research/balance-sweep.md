# Balance sweep after the bee larder (5fb305e) — INCOMPLETE

Status: stopped early by the coordinator. Only the setup and one smoke run are done; no sweep numbers yet.

## Done
- Copied HEAD `sim.js` / `balance.js` (5fb305e, via `git archive`) to the session scratchpad; nothing in the repo edited except this file.
- Instrumented scratch copy `bal.js`: `from=N` (seed offset, for parallel runs), `dry=N` (Dry Year year; `dry=99` = no Dry Year control),
  `quiet` (one `RESULT {json}` line per seed: loss day/why, every `extinct` event with its day, daily snapshots days 15–60 of
  green share, counts, frogs, total honey, hives, flowers).
- Timing: one seed, 3 years ≈ 3.3 s wall (5.2 s CPU); 32 seeds × 3 modes ≈ 1 min on 10 cores.
- Smoke run `balance.js 3 1 idle`: seed 1 lost to bees on day 29.3 (green low 7%).

## Findings from reading the code (no runs needed)
- `DANGER` is not a balance knob: sim.js only exports it for game.js alerts; it changes no outcome.
- Losses don't feed back into the sim (`dryLost` only sets `w.dryYear.lost` and emits). So `DRY_AFTER`, `BARREN` and
  `BARREN_DAYS` can be swept post hoc from ONE set of runs: run with a large `DRY_AFTER` (e.g. 15), record the first loss's
  day, and a run is lost under window X iff that day < 30 + X. Sim-changing knobs (`DRY_GRASS`, `DRY_FAR`, `HIVE_FULL`,
  `WINTER_HONEY`, `DRY_FEW`, `WILT`) need their own runs.
- The PLAN's case for `DRY_AFTER = 3` ("bees die out late in any autumn, 5 of 16 on days 33–34") predates the larder;
  it needs re-checking with a `dry=99` control before widening the window.

## Not done (incomplete)
- (a) PARTIAL, `balance.js 3 N` at HEAD, DRY_AFTER 3 (75 s cap hit):
  - idle: 32/32 seeds done. Lost 18/32 (bees 14, barren 4); seeds 1-16: 8/16 (matches the 8/16 noted). Seeds 17-32 lost 10/16.
  - keep: only 19/32 done. Lost 6/19 (barren 5, bees 1); seeds 1-16: 4/16 (matches).
  - diligent: 0/32 done. NOT RUN.
  - Raw per-seed JSON in the session scratchpad `base/out/<mode>-<seed>.txt`.
- (b) knob table: NOT RUN.
- (c) `node balance.js 6 4 v` watch-meadow check: NOT RUN.
- No recommendation yet.
