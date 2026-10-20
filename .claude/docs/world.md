# The world: clock, terrain, water, saving

## sim.js

A cooking game's pantry: the meadow lives on its own, simply, so there's game, honey, fish, fruit and nuts to gather,
and none of it runs out for good.

The clock: a day is 12 minutes at 1x (`TPD` 21600 ticks, 30 a second), a season 7 days (`SEASON_DAYS`), a year 28.
Calendar and animal movement share it, so paces stay as they were (a rabbit ambles about a tile a second, a fox trots
one and a half). The meadow's numbers were tuned on a 600-tick day, and the rates split two ways: what happens in a
day (grass grown and eaten, fish and frogs taken, kits born, the old dying) stays as it was, so a rate a tick of that kind
is `SLOW` (36) times smaller; what you watch (a step, a sip, a dive, a chase, a dig) takes as many ticks as it did. Hunger
sits between: an animal you follow should get hungry a few times a day, so the grazers and fishers burn `HUNGER` (8) times
what the day's numbers say (`SPECIES[k].hunger`, `EAT`), their food fills them as much more (`GRASS_ENERGY`, `GRUB`,
`NECTAR`, `APPLE_ENERGY`...), and a bite takes `HUNGER` times less of the grass, the fish or the frogs (`BITE`, `TAKES`). A
fox keeps to the day (`hunger: 1 / SLOW`): its food comes one rabbit at a time, so it hunts every day or two. The nights are
long against that hunger, so a sleeper burns `SLEEP_BURN` of it, and a chick in the nest or a cub in the holt nothing (fed).
Periodic work runs about as often a day as before (`GRASS_EVERY`, `WATER_EVERY`, `FROG_EVERY`, `FISH_EVERY`, `HIVES_EVERY`,
`WINDFALL_EVERY`), and day-long things were stretched by 7/5 for the longer seasons (lives, maturity, snags and logs, the
frogs' spring).

Terrain: the ground has a height and water lies below `w.level`. A lake lies in a hollow or by the
edge, running off the map (`placeLake`), and the river runs through it, out of it or into it; often a
shallow brook joins the river (`brookPath`, `rv.brook`). Lakes and ponds are basins (`basin`): a bowl, stretched
and turned (a lake on the river lies along it, `shapeLake`), its rim pushed in and out by noise into bays and points.
`carveBasin` gives each a shelf of shallows, wide and reedy in places (gentle banks there, so the flood spreads) and a
steep drop in others, widest where the river comes in (`delta`). Some lakes have an island (`w.isle`: no burrows on it,
`canDig`), clear of the river's way through and of the spring flood. Ponds are mostly small, some all shallows, now and then a big deep one an otter family can live by, and some
meadows get a cluster of little pools in one low corner (`pools`) or none at all. The shores have random numbers of their
own (`wr` in `makeTerrain`), so tuning them leaves the rest of the meadow be. The lake keeps its name on its
tiles and shore (`w.lake.near`, `nearLake`). The land slopes down into a valley
around the river and lake (`TERRAIN.valley`, half as wide by a brook). The water line follows the seasons (`waterTick`): up in
spring, down in summer, a little with the rain, so the river spreads over its floodplain and back.
A flooded burrow is lost and kits too young to climb out drown (`floodBurrows`); grass under water
drowns and grows back fast in the silt (`w.silt`). Flooded water keeps the name of the water it spilled
from (`w.nearBody`). Snow lying in winter freezes it over (`iceTick`, `w.ice`, `w.frozen`): the ice takes any weight, so
foxes cross where they couldn't, and whoever is out on deep water when it thaws goes through (`breakUp`). The ground shader shades the slopes by the sun, and colours the grass by where it is: lusher by the water
and the woods, golden up high, wet moss at the water's edge, in watercolour washes with a paper grain. It reads the grass the rabbits leave in three states: long (a deeper wash, the pigment pooled along its edge, lit on the sun's side), short where it's grazed (paler, sunnier) and bare earth only where it's bitten right down. That colouring is only a look; the grass the animals eat is `w.grass`.
The woods' shade thins that grass (`SHADE_GRASS`, half that while the broadleaves are bare, `leafless`): once a day
`groundTick` works out how much grass each tile's soil holds under the shade on it (`w.shadedFert`, which `growGrass`
reads, `shadeSoil`), so woods that creep out cost the rabbits grazing. And the ground remembers what lives and dies on it
(`w.rich`, `enrich`): a body left out in the open (`leaveRemains`), the latrines round a warren in use (`groundTick`: a day's
droppings for each rabbit home at dawn), an otters' spraint by a holt (`holtsDay`) and a log rotting away (`treesTick`) feed the
soil. The grass there grows back faster and a little past the soil's cap (`RICH_GROW`, `RICH_SOIL`, never over 1), and it fades
over about a season (`RICH_DAYS`). Rabbits won't graze ground that rich (`fouled`: fresh droppings, or where a body lay), so a
busy warren's latrines and an old kill site stand out as lusher patches until they fade and get grazed. Rich ground has more
grubs for the crows (`grubs`) and rich shallows a little more frogspawn (`spawnFrogs`).
Reeds and lily pads (`drawShore`) are a look too: a scatter `updateWater` works out along the shore whenever the water changes.
Shallow water is waded slowly; deep water blocks.
The rivers run (`makeCurrent`, `w.current`: worked out when a meadow is made or opened, never kept). Each point of a river
knows which way it runs, how wide its channel is and its pace (quick in the narrows and over a ford, all but still in the lake
or a wide stretch); each tile of running water takes the way and pace of the nearest point, slower by the banks; and it all runs
faster in the spring flood and slower at the summer low (`riverPace`). It carries a swimmer along (`drift`, at most `CARRY` of
its own pace, so it can always swim against it): an otter eating its fish afloat drifts downstream. Otters leave the meadow with
the current and come up against it (`riverEnd` skips the edges where a river or brook runs in). game.js draws it (`drawFlow`).
Each connected water body is named (`w.waters`, `w.body`). Population caps and starting
numbers scale with dry land (`w.room`).
Flower fields (`w.fields`, `placeFields`) are dense named patches of one flower (`FIELD_KINDS`), each
blooming in its own season (the first three: spring, summer, autumn, gathered within `fieldGather` so one hive can reach all three), with hardier flowers (`FIELD_GRASS`) and a tint on the ground while in bloom
(`fieldBloom`). They're the bees' main food; the few scattered flowers elsewhere are the rest. Butterflies loop over a field in
bloom by day, and fireflies blink by the water and the wood's edge on summer nights (`drawButterflies`, `drawFireflies`: a look only).

## game.js

A new meadow opens close, over the open ground with the most animals (`homeView`, `HOME_TILES`).
The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second).
The rivers run (`drawFlow`, worked out once a meadow by `flowOf` from the sim's `w.current`): streaks of current, quicker
down the middle, white water at the fords and where the brook comes in or the river leaves the lake, and things floating by,
all placed by the flow's clock alone (`flowTick`: the sim's `riverPace`, faster in the spring flood and at speed, slower at
the summer low). A frame only looks at the stretches of river on screen (`R.box`). What floats comes mostly from the trees
on the bank (`floatSources`, once a day: blossom off one in flower, its leaves as `treeLook` draws them while they come
down), and a little from upstream.
In autumn a painted tree's leaves come down as its kind's own leaf, in its crown's colours (trees.js `leafSheet`, a sheet
a size from the tree workers, `LEAF_TIERS`): green ones only now and then from a crown still turning (`LEAF_GREEN`),
then its own autumn colour (an oak's last ones dry), a few in its kind's others (`LEAF_OTHER`). Each glides down swinging
from side to side and tipping into each swing, turns over now and then (the paler back), drifts on the wind, and lands
round the foot, where it lies flat a moment and fades. Nothing is kept: a leaf goes round its life on the clock (where it
is comes from the time and hash numbers). The trees dropping leaves are listed as the shadows go down (`treeLeaves`), and
drawn twice by `drawLeaves`: those lying then, under all that stands, those in the air at the end. Each leaf is a
transform and a draw of its own, so they're thinned on trees drawn small (`LEAF_MIN`, `LEAF_FULL`: zoomed out, a wood had
nearly 2000).

The meadow is kept in the browser when the page is hidden or closed (`keepMeadow`: IndexedDB, under its link, the last
`KEEP_MEADOWS`), and every `KEEP_EVERY` while it's played, in a quiet moment between frames (`keepTick`: a keep is about
8 ms on a laptop). A keep at `pagehide` alone never landed on a reload in Chrome (the page went before IndexedDB wrote it,
and the reload opened a new meadow, intro and all), so it's also kept at `beforeunload`. The next visit opens it where it was
(`resumeWorld`): the bare address the one watched last, a `?seed=` link its own. A kept meadow that won't open, or broke
the page the last time it opened (`OPENING`), is let go. The ••• menu shares the link (a phone's share sheet) and takes
ideas (the `#ask` card, also once by itself two minutes of play after the first dish is cooked: `askTick`). Visits are counted by GoatCounter
(`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the page `/meadow` whatever the seed, and a link posted with
`?ref=reddit` says where they came from.
