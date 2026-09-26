# Nobody's Meadow

A cozy emoji meadow where rabbits, foxes and bees live their own lives and you watch what
emerges. It used to be called AEON Garden, and the repo, the GitHub Pages URL and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings). **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

**Discuss before implementing.** When asked for a change, first talk it through (what you
found, the options, what you'd recommend) and wait for a go-ahead before editing code, unless
told to just do it.

- `sim.js`: the world. No drawing. Runs in the browser and under node.
- `game.js`: drawing, UI, news feed, the inspector, the optional Ollama diary. The inspector shows
  animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water): each
  kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows.
  The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second), and
  the news log dates each line with a season chip (`seasonChip`).
  A first visit (or `?intro`) gets a short welcome card, then the intro (`startIntro`, `introFrame`): an
  empty meadow (createWorld's `arrival` option, `planArrivals` in sim.js) where a family hops in at dawn,
  digs its burrow and turns in for the night, while the camera, the clock's pace and a caption at a time
  follow along in letterbox bars. It never steers the animals, it waits for them. Any key, click or scroll skips it.
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). While the camera pans (following, dragging) it paints a margin round the screen (`PAD`)
  and slides the picture along (`Ground.view`) until the margin runs out. The loop gives the sim at most `SIM_MS` a frame (a slow phone runs 60x a bit slower
  instead of dropping frames), and a paused meadow nobody is touching draws at 30 fps (`resting`).
- `sound.js`: all the sounds, made with Web Audio (no files). Off until the 🔊 button or M.
  `sound-lab.html` plays each one on its own. Keep it minimal: one scale, few sounds. Every 5 to 10
  minutes a short felt-piano piece plays (`TUNES`, written out note by note and played a little
  differently each time); the lab plays each piece on demand. Like C418's Minecraft music, the
  silence between pieces is part of it, and no piece is about the time of day (a day is 20 s, a
  piece 90 s): they fit any moment, lean towards a season at 1x, and the piano plays darker at night.
- `index.html`: layout and styles. The cards are opaque parchment with a painted grain (`--paper`), never a `backdrop-filter`. Phones get slim bars (`narrow()`: up to 760px wide, or up to 500px tall
  on their side). The tools fold into one round button in the bottom right showing the one in hand (`toggleTools`),
  and a finger held on the meadow opens the ring there (`HOLD_MS`). Upright, the inspector is a bottom sheet;
  on their side (`short()`) it is a panel down the right. Either way it opens folded to one line (`stripHTML`):
  who, what they're up to, and the tummy. Tap it for the rest.
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
DevTools protocol (`--remote-debugging-port`) and use `Runtime.evaluate` / `Page.captureScreenshot`.
Shortcuts for that: set `localStorage['aeon-garden-welcomed'] = '1'` before load to skip the welcome
card; `window.garden` has `world`, `cam` (set `x`, `y`, `zoom`, `goal = null` to look somewhere) and
`ui` (`ui.speed = 0` pauses); the CSS `body > *:not(#world) { visibility: hidden }` hides every panel.
In a cloud session with no Chrome, Playwright is installed globally (`npm root -g`) with Chromium. The diary button talks to Ollama on localhost:11434 (qwen3:8b, else qwen3:4b).

Terrain: the ground has a height and water lies below `w.level`. A lake lies in a hollow or by the
edge, running off the map (`placeLake`), and the river runs through it, out of it or into it; often a
shallow brook joins the river (`brookPath`, `rv.brook`). The land slopes down into a valley
around the river and lake (`TERRAIN.valley`, half as wide by a brook). The water line follows the seasons (`waterTick`): up in
spring, down in summer, a little with the rain, so the river spreads over its floodplain and back.
A flooded burrow is lost and kits too young to climb out drown (`floodBurrows`); grass under water
drowns and grows back fast in the silt (`w.silt`). Flooded water keeps the name of the water it spilled
from (`w.nearBody`). Snow lying in winter freezes it over (`iceTick`, `w.ice`, `w.frozen`): the ice takes any weight, so
foxes cross where they couldn't, and whoever is out on deep water when it thaws goes through (`breakUp`). The ground shader shades the slopes by the sun, and colours the grass by where it is: lusher by the water
and the woods, golden up high, wet moss at the water's edge, in big soft light and dark patches, and gives the water an earthy bank (dark and wet at the lip). That colouring is only a look; the grass the animals eat is `w.grass`.
Reeds and lily pads (`drawShore`) are a look too: a scatter `updateWater` works out along the shore whenever the water changes.
Shallow water is waded slowly; deep water blocks.
Each connected water body is named (`w.waters`, `w.body`). Population caps and starting
numbers scale with dry land (`w.room`).
Flower fields (`w.fields`, `placeFields`) are dense named patches of one flower (`FIELD_KINDS`), each
blooming in its own season (the first three: spring, summer, autumn, gathered within `fieldGather` so one hive can reach all three), with hardier flowers (`FIELD_GRASS`) and a tint on the ground while in bloom
(`fieldBloom`). They're the bees' main food; the few scattered flowers elsewhere are the rest. Butterflies loop over a field in
bloom by day, and fireflies blink by the water and the wood's edge on summer nights (`drawButterflies`, `drawFireflies`: a look only).

Apple trees (`w.orchard`) drop windfalls early in autumn (`windfallTick`, `d.apples`), a big meal that hungry rabbits
walk a way for (`windfall`), so the apple trees are where they gather in autumn, and where the foxes find them.

Rocks are painted, not emoji (`rockInfo`, `rockSprite` in game.js): pebbles, stones and boulders by
size (`TERRAIN.rockSize`), flat stones at the fords, and two or three great rocks per meadow
(`TERRAIN.bigRocks`, `big: true`) that burrows keep clear of.
Flowers are painted too (`flowerSprite`, one painter per kind in `FLOWER_ARTS`): a clump on stems in
one of `FLOWER_VARIANTS` looks, painted once per half-octave size. Which painting a flower gets comes from
its emoji and the season (`flowerArt`), so the sim and the inspector still speak emoji. Thought bubbles are
painted too: the bubble and an icon for the mood's emoji (`BUBBLE_ICONS`), one sprite; a mood without an icon
keeps its emoji. Trees, tufts, sprouts and fallen leaves are still emoji.

Rabbit coats: two letter-pair genes (`coat`, e.g. 'AaDd') give four colours, plus a sliding
`moult` gene that whitens the coat in winter. Foxes spot a still rabbit from further off when its
coat stands out from the ground under it (`visibility`); the ground colours (`GROUND`) live in the
sim and the drawing uses them too.

Bees: they live in hives (`w.hives`), each in a broadleaf tree from `w.decor` (`h.tree`, `d.hive`, `moveIn`), which grows
into an old giant (`HIVE_TREE`) with a hollow low on its trunk (`drawBeeTree`). Sites (`hiveSites`, `siteScore`) are free
non-fruit 🌳s with fields in reach and open ground in front; lightning on a hive's tree sends its bees out as a swarm
(`hiveStruck`). Bees fly (`flies: true` in `SPECIES`, see `go`/`fly`),
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

Keep it smooth. The game has to run without lag on a phone, zoomed out, at 60x, in rain at night.
A lot of work already went into this (the cached ground, the sprite cache, the neighbour grid). A
new feature must not slow it down. If it would, make it cheaper or leave it out.
- Paint once, copy after. Anything that looks the same from frame to frame goes into a canvas once and
  gets `drawImage`d: the sprite cache (`sprite`), `fireGlow`, `detailTexture`. Never do these per item per
  frame: gradients, `shadowBlur`, `ctx.filter`, `getImageData`/`putImageData`, `measureText`, new canvases.
- The ground is a cached layer (`drawGround`). It slides when the camera pans, and only changed tiles
  get repainted. Nothing painted into it may change every frame, or the whole ground repaints all the time.
  Moving things go on top. An overlay is one small canvas stretched over the meadow (like
  `drawHillLight`), rebuilt only when its key changes.
- Sprite keys take few values. Round sizes (`spriteStep`) and colours (`step`) into a few steps, or
  the cache fills up and repaints all the time.
- Draw only what's on screen (`visible`). A full-screen pass (a `wash`, an overlay, a composite mode)
  costs the most, so add one only when it's clearly worth it, and skip it while it wouldn't show.
- The sim can run 2000 ticks in one frame. In hot loops, don't make new objects or arrays, and don't
  scan every creature: use the neighbour grid. Recount things only after they change.
- The page (cards, inspector, news) updates a few times a second at most, and only rewrites what changed.
- Measure it. Before and after a drawing change, time `render` over a few seconds in a busy meadow,
  following an animal, zoomed out, at 60x. If it got slower, fix it before committing, and put the
  numbers in the commit message.

After touching the sim, run `balance.js` over several seeds. The goal is visible
boom-and-bust cycles that recover, not a flat line and not extinction.
