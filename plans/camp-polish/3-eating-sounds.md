# 3. Eating sounds: a different mouthfeel per dish

Read `sound.js` (`munch`, line ~954, `chime` table ~376, the header notes), `sound-lab.html`, `.claude/docs/cooking.md`.

`munch` exists (bite, chews a little softer each, swallow, tiny "mm") with `crisp` 0..1 and nothing else. Build the
set, all Web Audio synthesis, no files, in the lab's style:

1. **Textures:** crunch (apple, raw root, crisp fritter: filtered noise bursts with a click of high-passed transient),
   soft chew (bread, nuts), slurp (soup, syrup: a vocal-ish rising narrow-band sweep with bubbles), tear (bread, meat),
   a hot blow (breathy noise swell) before a hot first bite, a pleased "mm" at three sizes (like, love, meh), and a
   satisfied sigh when the tummy fills. Random detune per hit so no two bites match, but seeded per chime for tests.
2. **API:** `munch(t, o0, { group, crisp, n, hot, mood })` keeps working with the old arguments. group comes from
   prompt 2's table (spoon, hand, skewer, bowl, fruit); until that lands, map from `crisp` alone.
3. **Mix:** quiet and close, `always: true` stays, ducked under speech/music, a touch of the room (muffled under the
   lean-to roof if `underLean`). A friend eating in earshot is heard softly with the distance rolloff that other sounds use.
4. **Lab:** `sound-lab.html` gets a row per texture and a "play a meal" button.

Done = the lab plays each; describe what each sounds like; no clicks/pops (check the gain envelopes); the CPU cost
per chime is trivial (no per-frame nodes left running).
