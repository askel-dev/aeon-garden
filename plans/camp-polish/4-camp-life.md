# 4. Camp life: drying food, rain on the roof, sleeping under the lean-to

Wait for the painting pass on the rack and lean-to to land. Read `.claude/docs/fire-camp.md`, `world.md`, `forager-body.md`,
`gathering.md`. Code: `makeRack`, `makeLean`, `underLean`, `RACK_ARTS`, `worldStores` in sim.js/game.js.

1. **The rack dries food.** Food kept on the rack (`kept: 2`) slowly turns into its dried form over a day or two (data:
   `dries: 'dried mushrooms'` per ingredient in recipes.js, the new ingredients painted in items.js like the others).
   Dry weather only: rain or fog stops it, a lit fire nearby speeds it. A subtle look change on the rack itself
   (`rack:1` already shows food; a few shrivelled shapes via a third art or the stack's tint, cheap) and a "done drying"
   tick the player can see on hover. All sim fields go in the blank.
2. **Rain and wind on the roof.** Under `underLean` the rain sound is muffled and a soft patter (a filtered noise
   layer) plays; drops visibly run off the roof edge (cheap particles only while it rains and the lean is on screen).
3. **Sleep and rest.** Standing or sitting a while under the lean at night makes the forager curl up (a rest pose),
   warmth recovers faster, and waking there is the collapse home already specified. Keep it to a short pose + zzz.
4. **Hover texts and deeds** match: the rack's text names what is drying, the lean's says how dry it is. A small deed
   or two in the cosy list if natural ("Dried your first mushrooms").

Done = a screenshot per state (rack empty, rack full, rack drying, roof in the rain, curled up), the sim headless
over a few seeds still round-trips `packWorld`/`unpackWorld`, nothing the cooking needs dies out.
