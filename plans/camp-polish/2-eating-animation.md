# 2. Eating: poses and reactions per kind of dish

Read `.claude/docs/cooking.md`, `forager-look.md`, `forager-body.md`. Code: `EAT_SEQ`, `eatSlot`, `eatAsk`, `HAND` in game.js;
`EAT`/`IDLE` pose ids in fur.js.

Eating is one bite-chew-chew-hum sequence for everything. Give it variety without a pile of new painted frames:

1. **Group the dishes** (data in dishes.js/recipes.js, a `eats:` tag per dish or a lookup by vessel/kind): spoon (soups,
   stews, porridge), hand (bread, fritters, roots), skewer (kebabs), bowl-to-mouth (drinks, syrups, broths), fruit bite.
   Each group picks a pose ID sequence and a timing (`EAT_SEQ` becomes a table, built once).
2. **Posture.** Sitting on the seat log or by the lean-to (when "Ate a meal sitting on the seat log" applies) uses a
   sitting variant if the painter has one, else the existing kneel, but never snaps to standing mid-meal.
3. **Reactions.** A dish the forager likes (the game's rating, see `stone.js`/tummy code) gets a happy face and a hum
   (face already has emotes: reuse them); a so-so dish a flat face; a too-hot dish a blow before the first bite
   (puff effect, cheap).
4. **Crumbs, steam and a clean bowl.** A few crumb particles for crunchy dishes (pooled, no per-frame objects); the
   bowl shows less food each bite if cheap, else just empties at the end.
5. Interruptions (walk away, hunger already full) must cancel cleanly with the dish kept.

Done = screenshots mid-bite for each group and no new frames painted per dish. Hand the sound cues to prompt 3: expose
the group name and bite count as the event payload (`chime('munch', { group, n, crisp })`).
