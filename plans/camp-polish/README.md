# Camp polish prompts (2026-10-20)

Six session prompts, one file each. Shared rules every one of them follows:

- Read `/CLAUDE.md` first, then the `.claude/docs/` note for the area (named in each prompt). Performance rules there are
  law: paint once and copy, few sprite keys, no per-frame gradients or new objects, nothing the sim counts on added mid-game
  (new sim fields go in the blank, `KEEP_VERSION` bumped if a kept meadow can't take it).
- Work in your own worktree. Other sessions edit the main checkout at once: never stash, commit only your own hunks.
- Look at it in a browser before you call it done (`python3 -m http.server <port>`, `?dev&seed=123`, `garden.give(id, n)`,
  `garden.world.forager.hand = 'Nettle soup'`, `garden.cam`). Unregister the service worker to see edits. Lighting the
  first fire headless is easiest by holding a pointer down on the breath disc for ~7 s with the weather set clear.
  Judge sizes and heights by eye, not by numbers. One game tab at a time (WebGL contexts).
- Games first: fun and warmth beat realism. Small, close to the action, no big cards.
- Report the branch, what changed, screenshot paths, and what you did not verify. Do not push.

Order that avoids collisions: 1 and 3 touch `drawForager`/`sound.js` (do 3 after 1 only if both edit `EAT_SEQ`);
2 is `game.js` eating code; 4 and 5 are camp builds; 6 is the rules for what builds change. Run 1+3+5 in parallel;
2 after 1; 4 and 6 after the painting pass on the rack and lean-to lands.
