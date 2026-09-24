# AEON Garden

A cozy emoji meadow where rabbits, foxes and bees live their own lives and you watch what
emerges. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

**Discuss before implementing.** When asked for a change, first talk it through (what you
found, the options, what you'd recommend) and wait for a go-ahead before editing code, unless
told to just do it.

- `sim.js`: the world. No drawing. Runs in the browser and under node.
- `game.js`: drawing, UI, news feed, the inspector, the optional Ollama diary.
- `sound.js`: all the sounds, made with Web Audio (no files). Off until the 🔊 button or M.
  `sound-lab.html` plays each one on its own. Keep it minimal: one scale, few sounds.
- `index.html`: layout and styles.
- `balance.js`: headless check, `node balance.js [years] [seeds]`.
- `terrain-lab.js`: the terrain lab, `index.html?lab`. Sliders for every number in `TERRAIN` (sim.js),
  drawn by the game itself, plus hidden layers and a strip of other seeds. Its "Copy as code" gives
  back the `TERRAIN` block to paste over the one in sim.js. New terrain numbers belong in `TERRAIN`
  (one per line, with a comment) and get a slider in the lab's `GROUPS`. You can also draw water,
  rivers and woods there; the drawing is createWorld's `drawn` option (`readDrawn`), carved by the
  same code as generated water, and travels in the link (`?drawn=`).

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow).

Checking visuals: you may use Google Chrome on this laptop (`/Applications/Google Chrome.app`)
to look at the game yourself, headless or not. `--headless=new --screenshot` only captures the
first frame; to see the game running (animals moving, camera moved), drive Chrome over the
DevTools protocol (`--remote-debugging-port`) and use `Runtime.evaluate` / `Page.captureScreenshot`. The diary button talks to Ollama on localhost:11434 (qwen3:8b, else qwen3:4b).

Terrain: the ground has a height and water lies below `w.level`. A lake lies in a hollow or by the
edge, running off the map (`placeLake`), and the river runs through it, out of it or into it; often a
shallow brook joins the river (`brookPath`, `rv.brook`). The land slopes down into a valley
around the river and lake (`TERRAIN.valley`, half as wide by a brook). The water line follows the seasons (`waterTick`): up in
spring, down in summer, a little with the rain, so the river spreads over its floodplain and back.
A flooded burrow is lost and kits too young to climb out drown (`floodBurrows`); grass under water
drowns and grows back fast in the silt (`w.silt`). Flooded water keeps the name of the water it spilled
from (`w.nearBody`). The game shades the slopes by the sun (`hillLight`).
Shallow water is waded slowly; deep water blocks.
Each connected water body is named (`w.waters`, `w.body`). Population caps and starting
numbers scale with dry land (`w.room`).
Flower fields (`w.fields`, `placeFields`) are dense named patches of one flower (`FIELD_KINDS`), each
blooming in its own season (the first three: spring, summer, autumn, gathered within `fieldGather` so one hive can reach all three), with hardier flowers (`FIELD_GRASS`) and a tint on the ground while in bloom
(`fieldBloom`). They're the bees' main food; the few scattered flowers elsewhere are the rest.

Rabbit coats: two letter-pair genes (`coat`, e.g. 'AaDd') give four colours, plus a sliding
`moult` gene that whitens the coat in winter. Foxes spot a still rabbit from further off when its
coat stands out from the ground under it (`visibility`); the ground colours (`GROUND`) live in the
sim and the drawing uses them too.

Bees: they live in hives (`w.hives`, drawn as a hollow dead tree, see `snagSprite`), fly (`flies: true` in `SPECIES`, see `go`/`fly`),
sip from the flowers the meadow shows (`isFlower`, same rule as `plantEmoji` in game.js) within `FORAGE_RANGE`
of home, and carry it back a `LOAD` at a time. One back from a rich patch dances (`h.patch`), and bees setting out
from the hive fly there; the hive label says which way.
They stay in while few flowers are open (`w.flowers`) and live on honey. Bees don't pair up: each hive has a
queen (`h.queen`, just a name and genes on the hive) who lays in `layEggs`, in spring and summer on whatever
honey there is, in autumn only once there's honey put by for every bee (`broodTime`). Summer bees live a few
days, autumn-born ones last the winter (`winterLifeDays`), and a small winter cluster burns more (`clusterCold`).
A crowded hive (`HIVE_ROOM`) swarms in spring or summer (`swarm`): the old queen takes half the bees to hang in
a tree (a hive with `cluster: true`, drawn by `drawSwarm`) while scouts fly to the sites from `hiveSites`, then
`settle` moves them into the best hollow tree or empty hive; a daughter queen stays behind.
Colony-level things go in `hivesTick`. Species lists come from
`KINDS` / `perKind`, so a new species needs no hand-written `{ rabbit, fox, bee }` lists.

Every animal uses one ladder: danger > sleep > love > food > friends > wander. Keep new
behaviour small and readable. If a rule needs a paragraph to explain, it's probably too big.

After touching the sim, run `balance.js` over several seeds. The goal is visible
boom-and-bust cycles that recover, not a flat line and not extinction.
