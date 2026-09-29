# Nobody's Meadow

A cozy emoji meadow where rabbits, foxes and bees live their own lives and you watch what
emerges. It used to be called AEON Garden, and the repo and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings).
It's played at https://meadow.cryptoler.net: GitHub Pages from `main` under a custom domain (`CNAME`;
the DNS record is in Vercel, see the `askel-dev/cryptoler.net` README). The old github.io link redirects there. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

**Discuss before implementing.** When asked for a change, first talk it through (what you
found, the options, what you'd recommend) and wait for a go-ahead before editing code, unless
told to just do it.

- `sim.js`: the world. No drawing. Runs in the browser and under node. `packWorld` / `unpackWorld` turn a
  world into plain data and back, for keeping it between visits (the tables like `SPECIES` go by name, the
  random numbers as where they'd got to). A change a kept meadow can't take (a new field on the world, a
  creature, a hive or a tree that the code counts on) bumps `KEEP_VERSION`, and players' kept meadows start over.
- `game.js`: drawing, UI, news feed, the inspector, the optional Ollama diary. The inspector shows
  animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water): each
  kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows.
  The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second), and
  the news log dates each line with a season chip (`seasonChip`).
  A first visit (or `?intro`) gets a short welcome card, then the intro (`startIntro`, `introFrame`): an
  empty meadow (createWorld's `arrival` option, `planArrivals` in sim.js) where a family hops in at dawn,
  digs its burrow and turns in for the night, while the camera, the clock's pace and a caption at a time
  follow along in letterbox bars. It never steers the animals, it waits for them. Any key, click or scroll skips it.
  Left alone for a minute while it runs, with no card open (or on V, or ••• "Sit back and watch"), the meadow films
  itself (`startIdle`, `pickShot`, `idleFrame`): the intro's bars and lines, the cards faded away, shots that follow an
  animal or drift past a place, what just happened first (`idleNews`). A shot keeps one zoom and only pans, and the next
  comes after a dip to dark or a glide. Any key, click, scroll or mouse move hands it back, the camera staying put.
  The meadow is kept in the browser when the page is hidden or closed, and while it films itself (`keepMeadow`:
  IndexedDB, under its link, the last `KEEP_MEADOWS`), never on a timer while someone watches (a save is a few frames).
  The next visit opens it where it was (`resumeWorld`): the bare address the one watched last, a `?seed=` link its
  own. Back after `AWAY_MIN` it runs on a season, drawing nothing (days would flicker), behind a card that then says
  what happened (`startAway`, `awayFrame`). The ••• menu shares the link (a phone's share sheet) and takes ideas
  (the `#ask` card). Visits are counted by GoatCounter (`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the
  page `/meadow` whatever the seed, and a link posted with `?ref=reddit` says where they came from.
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). While the camera pans (following, dragging) it paints a margin round the screen (`PAD`)
  and slides the picture along (`Ground.view`) until the margin runs out. The picture is a canvas of its own
  under the meadow's (`#ground`), slid into place with a CSS transform, never copied onto a frame (only into
  the P photo, `groundIn`); so nothing drawn on the meadow can blend with the ground (a `'lighter'` glow lays a
  light over it instead of adding to it). The loop gives the sim at most `SIM_MS` a frame (a slow phone runs 60x a bit slower
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
- `trees.js`: the trees, painted in code. Each kind
  (`KINDS`: oak, hive oak, beech, maple, birch, apple, cherry, pine, willow, hawthorn) is sculpted as a little 3D
  model of spheres for the light (a skeleton swept in bark, leaf clumps at the twig ends), then painted over:
  leaves as flat leaf-shaped dabs from shade to light, bark as strokes along each branch. The 3D gives the volume, the
  brushwork keeps it from looking 3D (plain 3D leaflets looked like broccoli). The seed fixes a tree's shape and the
  season only its leaves. The hive oak carries the hive: a dome of straw rings in a split in its trunk.
  Painting is slow (a few hundredths of a second a tree, more on a phone), so the game has it done in two workers
  (`tree-worker.js`, `TREE_WORKERS`) and never on a frame; the painter's loop over every pixel makes no arrays, which Safari is slow at: each kind in 4 shapes (`TREE_SHAPES`, a tree picks one from where it stands), each shape in its
  season's looks, each look at a few sizes (`TREE_TIERS`), asked for only when on screen and kept within
  `TREE_BYTES` (game.js, `treePainting`). A tree turning crossfades between two looks (`treeStage`), with looks
  in between so the two are alike (`LOOKS` in trees.js: an oak bare in early spring, first leaves, half fallen);
  a bare crown shows only its branches, about half of the finest left out (`PRUNE`), so it stays simple. Each kind is drawn at its own height (`TREE_SCALE` in game.js, times
  the sim's `d.size`, which only says how grown a tree is): oaks and beeches big, apples smaller, the hive oak
  a giant, and a tree four to seven rabbits tall (`creaturePx`). The look is kept close to the emoji trees':
  big leaflets (`LOOK.leaflet`), their greens, one colour for a whole tree (from its seed, a few clumps another,
  so autumn is a patchwork of trees and not of leaves), the crown up off the trunk (`LOOK.lift`) and the
  branches not too wide (`LOOK.spread`), so you see trunks and ground between the trees. The willow (a fountain of strands over a dome) is painted but not planted for now. Snow is a layer of its own, laid on as thick as the snow lying. A painting is
  also of a tone (the sim's `d.tone`: one of three colours of its kind, or a copper beech), and of the grown or the
  young form (slimmer, its branches more upright; a seedling is one, small); a dead tree is the grey `dead` look (one a fire killed, `d.burnt`, the charred `burnt` look) with
  limbs broken off, a fallen one the `log` kind, and one lightning took the `stump` kind. The paintings go by number
  (`treeKey`), so a frame builds no names. Until its painting comes the same look at another size stands in, or a
  small painting of its kind in that look (`treeKin`: one of each, painted ahead at the start by `kinAhead` and kept
  for good, outside `TREE_BYTES`), or another look of itself (`treeAny`). With none of those yet (the first moment
  after the page loads) a tree isn't drawn, and fades in when its painting comes (`treeWaits`). Emoji trees are
  only for `?emoji` or a browser with no worker. Small paintings are sculpted coarser (`ss`), which is most of the saving.
  `tree-lab.html` shows every kind in every season, close and far, in any tone, young or grown, dead, as a log and
  as a stump, with sliders for `LOOK` and a "Copy as code".
- `balance.js`: headless check, `node balance.js [years] [seeds]`.
- `terrain-lab.js`: the terrain lab, `index.html?lab`. Sliders for every number in `TERRAIN` (sim.js),
  drawn by the game itself, plus hidden layers and a strip of other seeds. Its "Copy as code" gives
  back the `TERRAIN` block to paste over the one in sim.js. New terrain numbers belong in `TERRAIN`
  (one per line, with a comment) and get a slider in the lab's `GROUPS`. You can also draw water,
  rivers and woods there; the drawing is createWorld's `drawn` option (`readDrawn`), carved by the
  same code as generated water, and travels in the link after the `#` (`drawnToLink`: a server turns a long `?query` away).
  On a phone the three cards become one sheet with tabs (`place`, `openTab`: Draw, Tune, View, Seeds), folded to the
  seed and the tabs, and two fingers pinch the map whatever the pen.

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow).

Checking visuals: you may use Google Chrome on this laptop (`/Applications/Google Chrome.app`)
to look at the game yourself, headless or not. `--headless=new --screenshot` only captures the
first frame; to see the game running (animals moving, camera moved), drive Chrome over the
DevTools protocol (`--remote-debugging-port`) and use `Runtime.evaluate` / `Page.captureScreenshot`.
Shortcuts for that: set `localStorage['aeon-garden-welcomed'] = '1'` before load to skip the welcome
card; `window.garden` has `world`, `cam` (set `x`, `y`, `zoom`, `goal = null` to look somewhere) and
`ui` (`ui.speed = 0` pauses); the CSS `body > *:not(#world, #ground) { visibility: hidden }` hides every panel.
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
and the woods, golden up high, wet moss at the water's edge, with a faint painterly mottle. That colouring is only a look; the grass the animals eat is `w.grass`.
The woods' shade thins that grass (`SHADE_GRASS`, half that while the broadleaves are bare, `leafless`): once a day
`groundTick` works out how much grass each tile's soil holds under the shade on it (`w.shadedFert`, which `growGrass`
reads), so woods that creep out cost the rabbits grazing. And the ground remembers what lives and dies on it (`w.rich`,
`enrich`): a body left out in the open (`die`; not one in a burrow, not a bee), the latrines round a warren in use (a
day's droppings for each rabbit home at dawn) and a log rotting away feed the soil. The grass there grows back faster
and a little past the soil's cap (`RICH_GROW`, `RICH_SOIL`, never over 1), and it fades over about a season (`RICH_DAYS`).
Rabbits won't graze ground that rich (`fouled`: fresh droppings, or where a body lay), so a busy warren's latrines and
an old kill site stand out as lusher patches (the ground's colour follows `w.grass`) until they fade and get grazed.
Reeds and lily pads (`drawShore`) are a look too: a scatter `updateWater` works out along the shore whenever the water changes.
Shallow water is waded slowly; deep water blocks.
Each connected water body is named (`w.waters`, `w.body`). Population caps and starting
numbers scale with dry land (`w.room`).
Flower fields (`w.fields`, `placeFields`) are dense named patches of one flower (`FIELD_KINDS`), each
blooming in its own season (the first three: spring, summer, autumn, gathered within `fieldGather` so one hive can reach all three), with hardier flowers (`FIELD_GRASS`) and a tint on the ground while in bloom
(`fieldBloom`). They're the bees' main food; the few scattered flowers elsewhere are the rest. Butterflies loop over a field in
bloom by day, and fireflies blink by the water and the wood's edge on summer nights (`drawButterflies`, `drawFireflies`: a look only).

Every tree has a kind (`d.kind`: oak, beech, maple, birch, hawthorn, apple, cherry, pine), from where it stands
(`treeKind`, `TREE_MIX` in sim.js): mostly birches by the water (no willows for now), hawthorn scrub and old oaks out in the open, birches at the
wood's edge, beech, oak and maple deep in. The drawing, its autumn colour and the inspector all follow it.

Trees live slow lives of their own, loosely like real ones (`treesTick`, once a day; `TREES` in sim.js gives
each kind its pace, seed and hardiness). The pace is quick for a game: a birch comes and goes in about 10
years, an oak in about 24 (`life`). Early in autumn a tree old enough sheds its seed (`seedFall`): on the wind
(birch, pine, maple), buried by jays out in the open (oak, beech), dropped by birds under a perch, a thorn bush
likeliest (hawthorn, cherry), or fallen and carried a little way (apple). Oaks and beeches fruit together,
heavily in a mast year (`w.mast`) and little between, and the nuts are a windfall for the rabbits. In spring the
seed comes up where there's light enough for its kind (`sprout`, `shadeOver`; pines only in pine country,
`w.pineLand`), less often as the woods fill their room (`TREE_ROOM`). A seedling is a mouthful for a rabbit
unless a thorn bush guards it (`THORNS`), so grazing keeps the meadow open, and after the rabbits crash the
woods creep out. A tree grows through seedling, sapling, young, grown and old (`treeStage`, from `d.size`
and its age), a young one waiting in the shade if its kind bears shade. It dies (`treeDies`) of shade,
grazing, fire (as the fire reaches it, `burnTrees`, the odds from its bark, `burn`), flood, a storm or age, stands a while as a grey snag, falls as a log (`treeFalls`) and rots
away; a broadleaf struck by lightning grows again from its stump. Apple, cherry and hawthorn blossom for
the bees in spring (`w.blossoms`) and bear as much fruit as the bees visited (`setFruit`). A tree takes its
parent's tone (`d.tone`: which of its kind's colours; now and then a beech is a copper beech, `RARE_TONE`),
and a tree that grows old may get a name (`oldName`), which the inspector and the news use.

Apple trees (`w.orchard`) drop windfalls early in autumn (`windfallTick`, `d.apples`), a big meal that hungry rabbits
walk a way for (`windfall`), so the apple trees are where they gather in autumn, and where the foxes find them.

Voles live in the long grass, too many and too small to be creatures: `w.voles` is how many are on each tile
(`volesTick`, every `VOLE_EVERY` ticks). From spring to autumn they grow where the grass is long (`voleRoom`, up to
`VOLE_K` a tile), spill over next door and fade where it's grazed short, so the rabbits keep them off the warrens;
winter thins them, snow less. Floods and fire kill them, and they eat tree seedlings (`VOLE_SEEDS` in `treesTick`).
A hungry fox with no rabbit in sight goes mousing (`mouse`: it steps softly to where they're thickest, listens,
then pounces, `mode` 'mouse', 'pounce', 'gulp'); a vole is a snack (`VOLE_ENERGY`), so it takes several. A fox that
last caught a vole (`c.prey`) sees rabbits only at `MOUSE_EYES` of its sight: that search image is what keeps the
foxes the voles carry through a rabbit low from eating the last rabbits and dragging the low out. The drawing is a
look only: now and then a 🐁 pops up out of the grass where they're thick (`drawVoles`, a fixed pool), and a pounce
is a high arc (`hopOf`). The news tells of a vole year and the crash after it (`VOLE_BOOM`, `VOLE_BUST`), and the
stats chart has their meadow-wide count (`w.history.voles`).

Rocks are painted, not emoji (`rockInfo`, `rockSprite` in game.js): pebbles, stones and boulders by
size (`TERRAIN.rockSize`), flat stones at the fords, and two or three great rocks per meadow
(`TERRAIN.bigRocks`, `big: true`) that burrows keep clear of. Like a tree's, a rock's snow is a layer of its
own, painted once and faded in as thick as the snow lying, so the snow never repaints the rock.
Flowers are painted too (`flowerSprite`, one painter per kind in `FLOWER_ARTS`): a clump on stems in
one of `FLOWER_VARIANTS` looks, painted once per half-octave size. Which painting a flower gets comes from
its emoji and the season (`flowerArt`), so the sim and the inspector still speak emoji. Thought bubbles are
painted too: the bubble and an icon for the mood's emoji (`BUBBLE_ICONS`), one sprite; a mood without an icon
keeps its emoji. Trees are painted by trees.js (above); tufts, sprouts and fallen leaves are still emoji.

Rabbit coats: two letter-pair genes (`coat`, e.g. 'AaDd') give four colours, plus a sliding
`moult` gene that whitens the coat in winter. Foxes spot a still rabbit from further off when its
coat stands out from the ground under it (`visibility`); the ground colours (`GROUND`) live in the
sim and the drawing uses them too.

Bees: they live in hives (`w.hives`), each in an oak from `w.decor` (`h.tree`, `d.hive`, `moveIn`), which grows
into an old giant (`HIVE_TREE`) with a hollow low on its trunk (`drawBeeTree`). The first hive takes the best broadleaf,
which becomes an oak (`placeHive`). Sites (`hiveSites`, `siteScore`) are free oaks with fields in reach and open ground in front; lightning on a hive's tree sends its bees out as a swarm
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
- Chrome lets a frame draw from only about 30 MB of distinct pictures (width × height × 4, summed over every
  image or canvas `drawImage`d that frame). Past that it flushes mid-frame and every canvas call costs more,
  which a profile blames on whatever call comes next. So keep big pictures off the canvas (the ground is a
  layer of its own), paint sprites near the size they're drawn at, and don't draw many different large ones.
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
