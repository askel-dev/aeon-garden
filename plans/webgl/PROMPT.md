# Prompts

## For the overseer (one Opus 5.5 session, medium effort)

Paste this into a fresh session in the aeon-garden repo:

````
You're the overseer of a multi-stage piece of work in this repo (Nobody's Meadow, a no-build vanilla-JS canvas game):
moving the meadow's per-frame drawing from Canvas 2D to a batched WebGL2 renderer. The plan is in plans/webgl/.
Read CLAUDE.md, then plans/webgl/README.md whole, then skim every stage file, before starting anything.

Your job:
- Run the stages in the order and with the dependencies in README.md's stage table, each by a worker agent. Use the
  Agent tool with subagent_type "general-purpose", isolation "worktree", effort "medium" (Axel's standing rule: never
  above medium), and model "sonnet" for the stages marked Sonnet, "opus" for the ones marked Opus.
  - Don't use the "meadow-worker" agent type. It's set to high effort and written for the food-web plan.
- Give each worker the worker prompt below with its stage file filled in. Run stages 3, 4 and 5 in parallel once stage 1
  has landed. Stage 2 can run beside them.
- Review each worker's diff yourself before merging its branch into the integration branch `webgl` (made off main at
  the start). Check its acceptance bullets against what it reports, and re-run the cheap checks yourself (pixdiff,
  ?gl=0 unchanged). Send it back with specifics if something's off. Don't merge red work.
- Stage 2 is a gate. When it's done, bring plans/webgl/GATE.md's verdict to Axel in a few plain lines, with the numbers,
  and wait for his go before starting stage 6. If the verdict is Stop, say so plainly and don't start more stages.
- Things only Axel can do, ask him for in plain words, one at a time, when they come up: open a link on his iPhone,
  keep it unlocked and awake for a power recording (xctrace times out "waiting for device to boot" when it's asleep),
  look at the meadow on his phone (stage 7's checklist), approve the merge into main.
- The main checkout is shared with other sessions: never stash, never commit there, never commit someone else's hunks.
  Work only in worktrees and the webgl branch. Never push or merge to main without Axel's yes.
- Keep a short log in plans/webgl/LOG.md on the webgl branch: stage, worker, verdict, the key numbers, what you sent
  back. Update README.md's evidence tables with real numbers as they come in.
- If a stage's design turns out wrong (not just a detail), stop and tell Axel what you found and what you'd change,
  before workers carry on building on it.
````

## For each worker

````
Implement one stage of the WebGL meadow work in this repo (Nobody's Meadow: a no-build, vanilla-JS canvas game;
game.js draws the meadow, sim.js is the world).

Read, in this order:
1. CLAUDE.md, the project's rules. Above all "Keep it smooth": they are law.
2. plans/webgl/README.md, the plan: the architecture, the fixed interface between stages, the rules, and how to test and
   measure.
3. plans/webgl/<STAGE FILE>, your task. Follow it.

Rules:
- Only this stage. If something it depends on isn't in your tree, stop and say so.
- Minimal diffs, in the code style around them. No libraries, no build step. No per-frame allocation in anything that
  runs each frame.
- ?gl=0 must look and play exactly as before when you're done.
- Commit on your worktree's branch with a clear message (what and why, plus any numbers). Don't push. Don't touch main.
- Anchors (function names, line numbers) drift; search for the name. If the code has changed shape, adapt minimally and
  say so.
- If the stage file and CLAUDE.md disagree, follow CLAUDE.md and flag it.
- If you're blocked, or a design point in the stage file turns out wrong, stop and report. Don't build around it.
- Measure what the stage asks to be measured, with real numbers. Never write a number you didn't measure.

Report back:
1. The files changed, and 2–3 sentences on what you did.
2. Each acceptance bullet: pass or fail, with what you observed (numbers, scene names).
3. Deviations from the stage file and why.
4. Anything you noticed and left alone on purpose.
````
