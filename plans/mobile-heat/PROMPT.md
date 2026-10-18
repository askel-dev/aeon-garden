# Hand-off prompt template

Copy the block below, replace `<STEP FILE>` (e.g. `00-perf-overlay.md`), one session per step, in
the order in README.md. Everything the model needs is in the repo; the prompt just points and
constrains.

````
Implement one step of the mobile heat & battery work in this repo (Nobody's Meadow: a no-build,
vanilla-JS canvas game; game.js is the render loop, sim.js the world, sound.js Web Audio).

Read, in this order:
1. CLAUDE.md — the project's rules, above all the "Keep it smooth" section. They are law.
2. plans/mobile-heat/README.md — the plan, the order, and how to run and test.
3. plans/mobile-heat/<STEP FILE> — your task. Follow it exactly.

Rules:
- Implement only that step. If a step it depends on isn't in the tree yet, stop and say so —
  don't merge two steps' work.
- Minimal diffs, in the existing code style. No new dependencies, no new files unless the step
  says so. No per-frame allocations or new hot-loop work beyond what the step specifies.
- Do not commit, push, or otherwise touch git. Do not edit anything under .claude/worktrees/.
- Anchors in the step (function names, constants, line numbers) may have drifted: search for the
  name. If the code has genuinely changed shape, adapt minimally and note the deviation.
- If the step file and CLAUDE.md ever disagree, follow CLAUDE.md and flag it in your report.
- If you're blocked (an acceptance bullet you can't make pass), stop and report — don't improvise
  extra changes around it.

Verify:
- Serve the folder: python3 -m http.server 8765, then test at http://localhost:8765
  (?seed=123 for a repeatable meadow, ?perf for the live numbers, window.garden for the console
  hooks: world, cam, ui, perf).
- Work through every bullet in the step's "Acceptance" section. Where it asks for numbers,
  record real ones, and update the baseline table in plans/mobile-heat/README.md when asked.

Report back:
1. Files changed, and 2–3 sentences on what you did.
2. Each acceptance bullet: pass/fail, with the observed numbers.
3. Deviations from the step file, if any, and why.
4. Anything you noticed but deliberately left alone.
````

Example, for the first one: replace `<STEP FILE>` with `00-perf-overlay.md`.

Notes:
- Run the steps in order; the dependency column in README.md says what must have landed first.
- Review the diff after each session before starting the next — later steps quote code that
  earlier steps wrote.
- Steps 5–7 are small and can share one session: replace the step file line with
  `plans/mobile-heat/05-battery-api.md, 06-saver-toggle.md and 07-wake-lock.md — all three, in
  that order`.
