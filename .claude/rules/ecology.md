---
paths:
  - sim.js
---

# The meadow's ecology

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

Every meadow has trees along its lasting water, as along any river or lake left to itself (`TERRAIN.fringe`, `fringeGaps`,
`fringeSpacing`, the end of `plantTrees`, with random numbers of their own): one here and there on the bank above the spring flood,
in stretches with open bank between. And a tree within `FLOAT_REACH` of lasting water drops some of its seed in it (`ON_WATER`,
`floatSeed`): it floats down the current (`w.current`) or about still water and comes up where it washes ashore above the flood
line (`by: 'water'`), so the bank trees seed the banks downstream; some float out of the meadow or sink in a lake. An alder drops
most of its seed in (`float`), and its seedlings come up only within `wet` tiles of the water (`w.damp`), so alders keep to the banks.

Every tree has a kind (`d.kind`: oak, beech, maple, birch, alder, hawthorn, apple, cherry, pine), from where it stands
(`treeKind`, `TREE_MIX` in sim.js): mostly alders by the water (dark green, still green in autumn when the rest turn), hawthorn scrub and old oaks out in the open, birches at the
wood's edge, beech, oak and maple deep in. The drawing, its autumn colour and the inspector all follow it.

Trees live slow lives of their own, loosely like real ones (`treesTick`, once a day; `TREES` in sim.js gives
each kind its pace, seed and hardiness). The pace is quick for a game: a birch comes and goes in about 10
years, an oak in about 24 (`life`). Early in autumn a tree old enough sheds its seed (`seedFall`): on the wind
(birch, pine, maple), left for the crows to bury out in the open (oak, beech: `d.nuts`, see the crows), dropped by birds under a perch, a thorn bush
likeliest (hawthorn, cherry), or fallen and carried a little way (apple). Oaks and beeches fruit together,
heavily in a mast year (`w.mast`) and little between, and the nuts are a windfall for the rabbits. In spring the
seed comes up where there's light enough for its kind (`sprout`, `shadeOver`; pines only in pine country,
`w.pineLand`), less often as the woods fill their room (`TREE_ROOM`). A seedling is a mouthful for a rabbit
unless a thorn bush guards it (`THORNS`), so grazing keeps the meadow open, and after the rabbits crash the
woods creep out. A tree grows through seedling, sapling, young, grown and old (`treeStage`, from `d.size`
and its age), a young one waiting in the shade if its kind bears shade. It dies (`treeDies`) of shade,
grazing, flood, a storm or age, stands a while as a grey snag, falls as a log (`treeFalls`) and rots
away; a broadleaf struck by lightning grows again from its stump. Apple, cherry and hawthorn blossom for
the bees in spring (`w.blossoms`) and bear as much fruit as the bees visited (`setFruit`). A tree takes its
parent's tone (`d.tone`: which of its kind's colours; now and then a beech is a copper beech, `RARE_TONE`),
and a tree that grows old may get a name (`oldName`), which the inspector uses.

Apple trees (`w.orchard`) drop windfalls early in autumn (`windfallTick`, `d.windfall`), a big meal that hungry rabbits
walk a way for (`windfall`), so the apple trees are where they gather in autumn, and where the foxes find them.

Rabbits and foxes are simple: every animal of a kind is alike (`SPECIES`, `computeTraits`), with no genes, and young don't
take after their parents; only a look differs (`c.scale`, and a fox's shade, `c.fur`, which its cubs share), and a rabbit's
winter coat. That one is passed on: `c.moult` (founders about `MOULT_START`, a kit one parent's, now and then a little changed,
`MOULT_DRIFT`; `mate` keeps the dad's, `c.dadMoult`) is how white it turns, paling through late autumn and colouring again early
in spring (`whiteness`). A white coat is a thick one (`MOULT_WARM` less burnt while snow lies). And a fox spots a still rabbit
as far off as its coat stands out from the ground under it (`visibility`, `groundRGB`, `GROUND`: the ground's colours as game.js
draws them, dark at night but where snow lies; `CAMO`, `CAMO_CLASH`; one running is seen at `CAMO[1]`), so a white rabbit is
hidden on snow and plain to see on bare ground or the first spring grass after an early thaw: over a winter the white ones are
caught about half as often as the brown, and in early spring about twice as often. Rabbits graze,
dig burrows (`DIG_TICKS`: two minutes for one alone) and go home at night, thump and run for a burrow when they spot a fox, and
breed in spring and summer up to their cap (`SPECIES.rabbit.cap` × `w.room`), which with the foxes holds them. In autumn
they walk a way for the windfalls, unless they're too hungry for the walk (`APPLE_HUNGRY`): then the grass at hand. A fox naps
through the middle of a fed day, and hungry it stalks the nearest rabbit it sees, charges from `POUNCE`, and keeps to where
it last caught one (`c.haunt`); a rabbit runs from it within `FLEE_DIST` of its sight. Rabbits boom through the summer and
thin over the winter, every year.
The gentle respawn (`migrate`, four times a day): with fewer than `FEW` of a kind (rabbits times `w.room`), once they've been
few for `COME_AFTER` days, `ARRIVE` more wander in from an edge, and again as long after while they're still few; foxes only
come with `FOX_FOOD` rabbits about, and otters come up the water to a free holt. So neither the foxes nor, later, the
player's hunting can empty the meadow, and a low still shows. Bees come as a wild swarm (see the bees).

Frogs are a field (`frogsTick`, every `FROG_EVERY` ticks): `w.frogs` on land, `w.spawn` (spawn,
then tadpoles) on shallow water. From spring to autumn frogs live in the damp long grass near the water (`frogRoom`: up
to `FROG_K` a tile, fewer the further from the water, `w.damp`, worked out at most once a day by `dampen`; grazed short
holds `FROG_BARE` of it; a heatwave shrinks the reach to `FROG_DRY`); they winter in the mud (`FROG_COLD`, twice that
under ice). On a mild night early in spring (`SPAWN_FROM`, `SPAWN_ODDS`, a wet night always, by
`SPAWN_BY` anyway) the frogs within `SPAWN_REACH` of the shallows spawn (`spawnFrogs`, shared out with `boxSum` and
`shareOut`): still shallows best, a flood pool on the floodplain above all (`SPAWN_EDGE` for the lasting shallows, none by
the deep or the current, `SPAWN_DEEP`). The tadpoles grow as one (`w.frogYear.grown`,
`TADPOLE_DAYS`, faster in the sun, `WARMTH`) and then leave for the grass about (`FROGLET_LEAVE`, `FROGLET_REACH`). That's
the gamble: the flood pools go when the water falls back in summer (or in a dry spell), and tadpoles in one that dries
out are stranded (`tadpolesTick`), so an early spawning in a warm spring makes a big frog year and a late cold one a
poor one. Only the tiles spawned in are looked at (`w.spawnTiles`). The otters root them out of the shallows and the mud
(`rooted`, `takeFrog`, `TAKES` of a frog a catch). A hungry crow in
spring flies down to the thickest spawn (`w.spawnSpots`) and pecks it out at the water's edge (`tadpoles`, modes 'pool'
and 'tadpole'). game.js draws it all as a look, a fixed pool (`drawPond`): frogspawn clumps, then tadpoles, a painted
common frog (`frogAt`, also the 🐸 bubble; 🫧 is the frogspawn) hopping at the water's edge or up on a lily pad. The water
inspector says what's in it (`pondFacts`), the sim emits a big or poor frog year (`FROG_BOOM`, `FROG_POOR`, event
'frogyear'), and a frog purrs now and then on spring nights while there's spawn about (sound.js `croak`).

Fish are a field too (`fishTick`, every `FISH_EVERY` ticks): `w.fish` on water. They live in the water that lasts the year
round (below `w.terrain.level`, so not the flood pools), deep water best (`fishRoom`: `FISH_K` a deep tile, `FISH_SHALLOW` of
that in the lasting shallows), breed from spring into summer and spill over next door, out onto the floodplain too while
it's flooded; there's no room for them there, and those still on it as it drains are stranded. Winter thins them a little
(`FISH_COLD`). They eat tadpoles: on top of `TADPOLE_LOSS`, a tile loses `TADPOLE_FISH` a day at `FISH_K` fish, so the
frogs' gamble is the flood pools (no fish, but they dry up) against the lasting shallows. They're there to be caught: the
otters take `TAKES` of a fish a catch (`takeFish`), and one day the player.

Otters (`otterTick`): a pair or two along the water, swimmers (`swims: true`: `moveToward` lets them through deep water, `wade`
makes them quicker in it, `roamable` keeps their wandering within `OTTER_SHORE` of the water). A female makes her holt in the
roots of a big tree on the bank of lasting water, or under a boulder there above the spring flood (`holtSite`, `HOLT_ROCK`, `holds`:
a tree's holt goes when it falls), where there's room for the most fish about, at least `HOLT_FISH` (`holtTree`, `holtFish`, worked
out once a place, `d.holtFish`), `HOLT_GAP` from the other holts, and marks it (`d.holt`, her id; `d.door`, the way in, on the bank side; `holtsDay`
frees it once she's gone). The trees along the water (`plantTrees`' fringe, and the seed they drop in the water, `floatSeed`)
give every meadow holt trees. A male moves in with his mate. They're
out from the evening to the middle of the morning (`OTTER_WAKE`, `OTTER_BED`) and sleep curled up at the holt (`bedOf`), or,
further from it than `HOLT_HOME` at bedtime or with none, on a bank close by, as otters lie up all along their water; a mum with
cubs in the holt (`nursing`: they mark her, `c.cubsIn`) always goes home, and a cub sleeps by mum. They go to bed at a lope
(`HOME_PACE`). They fish (`otterFood`): swim to where `w.fish` is thickest about them (round the holt once they've strayed past
`OTTER_RANGE`, `HOLT_REACH` for a nursing mum), dive (`DIVE_TICKS`) and come up with one as often as they're thick there (`surface`, `FISH_CATCH`, `FISH_HALF`),
eat it afloat, and dive again close by a few times before moving on (`tryAgain`). For `FROG_FEAST` days after the frogs spawn they
go after the frogs first, rooting along the shallows, and in winter they dig them out of the mud (`rooted`, `takeFrog`); only at
the water's edge (`mostNear`'s `shore`, `OTTER_SHORE`). Under the ice they still fish where it meets the bank (`atEdge`): mud
frogs alone starved them in long frozen winters. A fox up and
about close to one on the bank sends it into the water (`slip`), and it watches the fox from there (mode `'watch'`) till
it's `WARY_FAR` off or lies down, or `WATCH_TICKS` have gone, then pays foxes no mind for `CALM_TICKS` (`c.calm`). Asleep, it
doesn't mind a fox (no fox hunts otters; before, one passing woke the family and sent cubs in and out of the water all night).
A cub stays up while mum is (`mumUp`) and then sleeps by her; a bed is never in the water (`beside`).
Well fed (`PLAY_FED`), they play (`play`): a slide (`slideNear`, `c.slide`) from the highest of a few spots on the open
bank about (`SLIDE_BANK`, out from under the trees, `SLIDE_SHADE`) down to the nearest water (`waterWay`) and on into it, or out
over the ice; they bound up again (`PLAY_PACE`) and slide a few times (`PLAY_RUNS`), the others about joining in on the same
slide and taking turns at the top (`SLIDE_GAP`). Food still comes first: a game played on while hungry starved families in
hard winters. In spring a
female with a holt (`otterReady`) has two or three cubs, hidden in the holt till `CUB_OUT`, who follow mum till they're grown (a
cub busy with a catch finishes first) and get `CUB_SHARE` of every fish she catches. At a year (`otterGrown`, `atMums`) a young
female takes a free holt and a young male goes off along the water to find a mate, while the meadow has room; otherwise off down
the water out of the meadow (`riverEnd`, cause `'left'`). A pair comes up the water (`otterWay`: where the lasting water runs off
the edge, unless that's much further than the nearest edge) when there are none, or no holt is held (`migrate`, checked once a
day), and the female takes the holt they came for. game.js paints them (`paintOtter`, the prototype's painter:
one fur layer, `furLayer`, soft markings with `blurIn`; water poses sit in the water, `inWater`, `waterRing`), picks the pose from
the mode and the water (`otterArt`), draws a wake while it swims somewhere (`drawWake`), a splash where one slides or slips into the water (`drawSplashes`, at 4x
or slower), and only rings while it's under
(`drawUnder`), and the way into a holt (`paintHolt`).

The forager (`w.forager`, `foragerOf`: one layout, kept with the meadow; a meadow kept before it gets one when it opens,
no `KEEP_VERSION` bump) is the player: not a creature, so nothing hunts it and nothing it does touches the meadow's random
numbers. It starts at a pleasant dry spot near the water and the woods, above the spring flood, nothing standing on it, near
the middle (`startForager`). `foragerTo` finds its way: A* over the tiles (`tilePath`, its arrays made once; deep water
blocks unless frozen, the shallows cost `SHALLOW_COST`, ground by the deep `BRINK_COST` more, no squeezing past the deep's
corners), to the tile it can stand on nearest a click on the deep, or the nearest it can reach; then pulled tight into a few
straight legs (`taut`: `TAUT_CLEAR` off the deep, and no wading where the tiles' way didn't). Rocks are in its way, all but
pebbles and a ford's stones (`rockKind`, which game.js paints by too; `ROCK_SOLID` of its size, plus `FORAGER_GIRTH`): worked
out once a meadow (`rocksFor`: their circles, and the tiles whose middle is in one, which A* won't step on), a leg keeps out
of them (`pastRocks`), a click on one goes to its edge, and a step into one is put back at its edge, so it slides round
(`outOfRocks`; one it's already in, it can only leave). Trees and brambles are half in its way, as in Project Zomboid:
it pushes through, slowed and eased round the trunk. Each is a circle about its foot (`brushOf`: `BRUSH_TREE`, a hawthorn
`BRUSH_THORN`, a grown bramble `BRUSH_BRAMBLE`, by size, a sapling barely, a stump, log or seedling not at all) that slows it
by up to its `slow` (`brushAt`) and pushes it out by up to `BRUSH_PUSH` of its step (fading as it nears where it was sent,
so it can be sent into one). The way keeps out of them: A* pays `BRUSH_COST` more a tile by how much its middle slows it
(`brushTile`, `brushGrid`), and a leg isn't pulled tight through brush thicker than the tiles' way went through (`taut`'s
`thick`). Both are gathered at most once a game hour (`brushGrid` when a way is wanted, `brushAbout` the few near it once
it's gone a tile), so a tick looks at a handful. Through a wood it weaves and takes about a tenth longer. `foragerTick` walks them by
steering: it heads for a point `FORAGER_LOOK` along the way, turning at most `FORAGER_TURN` a tick (three times that from
standing), speeds up by `FORAGER_ACCEL`, slows to stop where it was sent (`FORAGER_BRAKE`) and into a sharp turn, wades at
`FORAGER_WADE` of `FORAGER_WALK`, and slides along the deep if a corner clips it. Sneaking (`f.sneaking`, game.js's sneak emote, in the blank: no `KEEP_VERSION` bump) it creeps at `FORAGER_SNEAK`; a sprint wins.
The river carries it too: standing in the shallows it drifts down the current each tick (`carryForager`, as a swimmer's drift, at most `CARRY` of a wade, along the shallows only, sliding round rocks and the deep). Walking, the current adds to or takes from its pace along its way (`currentAt`, never under `1 - CARRY` of it), so it goes down a river quickly and up one slowly (it's not pushed, so a walk into the current still ends at its goal).
Playing together, friends' foragers are in each other's way (`friendsAt`: game.js `friendsFrame` hands over where each is
drawn and whether it's standing still (`PEER_STILL_MS`), every frame; one collapsed isn't): a circle of `ELBOW_ROOM` about each it can't step into (`outOfFriends`), sliding round
it, met about head on (`FRIEND_HEAD_ON`) stepping to its right (`FRIEND_SIDESTEP`) so two walkers pass, and a way that ends in one ends at
its edge. Walking into one that's standing it doesn't step aside: it presses on, and the one standing is pushed (`makeRoom`) up to
`PUSH_STEP` a tick while the walker is within `PUSH_ROOM` (0.05 a tick against a walk's 0.085), so a friend can be pressed along out of
the way. A friend is shown a moment late, so the walker's stopped at `ELBOW_ROOM` and the standing one's screen sees it come near;
a walker already inside a circle is moved out of it by `ELBOW_SHUFFLE` a tick (`outOfFriends`). Two standing side by side settle
`PUSH_ROOM` apart on both screens; two on one spot (woken by the camp's fire) step off the
ways `friendSide` says, hashed from who each is. Not the sim's: nothing the meadow counts follows from it.
Gathering (`whatThere`, `gather`) takes from the sim for real, with no random numbers: a clump of mushrooms picked is gone
(all its caps; only part if the satchel is nearly full), a patch of greens gives `GREEN_GIVES` (one more off a big patch) and
`GREEN_TAKE` of itself, growing back `GREEN_REGROW` a day (`g.pick`, in `greensTick`), a ripe bramble `BERRY_PICK` blackberries at
`BERRY_COST` each off `b.berries` (so fewer for the crows and foxes, who leave little by early autumn), a cherry tree `CHERRY_PICK`
from the start of summer to `CHERRY_TO` into it, `CHERRY_CROP` a summer (two fifths of that with no bees: `d.picked`, `d.pickYear`),
an apple, oak or beech up to `FALL_PICK` of its windfalls (`d.windfall`, the rabbits' too; `FALL_GIVES` each), a wild find all of it
(as a clump of mushrooms), and a hive `HONEY_GIVES` honey for `HONEY_TAKE` of its store, never taking it below `HONEY_KEEP` (by
season: low in spring, when the bees live on nectar, so a meadow's first hives, starting with `HIVE_HONEY` 40, give a little; from
autumn more than a big colony eats in a winter): a greedy forager taking all it could for three years starved no more colonies
than none. `eachPickable` lists everything with something to give now (game.js's glints and arrow, and counting). `whatThere` also says gently why not ("Not ripe yet", "Picked clean"...). What's picked goes
in the satchel (`w.forager.bag`, `bagN`: `SLOTS` slots, `STACK` of a kind to one; `stow`, `roomFor`, `dropSlot`), kept with the meadow. What's dropped lies on the ground (`w.dropped`, `dropOf`; dropped on a pile of its kind it goes on it) for `DROP_DAYS` (half a day, six minutes at 1x), or till deep water comes over it (`droppedTick`).
No `KEEP_VERSION` bump: the new fields are in the blanks (`foragerOf`, `greenOf`, `blankTree`).
Its body (`bodyTick`, every tick, before it walks): the air's temperature (`airTemp`, degrees: the year's, `AIR_YEAR`, about
19 at midsummer and -1 at midwinter; the day's, `AIR_DAY`, coldest at sunrise, warmest at `AIR_WARMEST`; the weather's,
`AIR_WEATHER`; snow lying, `AIR_SNOW`). What it feels (`f.feel`) is that plus the sun out of the shade (`SUN`, `sunUp`), less
the wind (`WIND`) and being wet (`WET_CHILL`), plus moving (`ACTIVE`); the woods (`SHELTER_WOOD`) keep off wind, rain and sun.
Over `COMFY` its warmth (`f.warmth`, 1 cosy to 0) comes back at `WARM_K` a degree a day, under it goes at `COOL_K` (`WET_COLD`
times faster again soaked). Rain soaks it (`WET_RAIN`, less under trees), wading at once (`WET_WADE`), and it dries out of the
rain (`DRY`, faster warm, in sun, moving). Sprinting spends stamina (`SPRINT_TICKS`), walking and standing bring it back
(`REST_TICKS`, slower cold); spent it's `winded` till `WINDED_BACK`. Stages (`warmthStage`, `WARMTH_STAGES`): cosy, chilly, cold
(slower, `COLD_PACE`, `bodyPace`), freezing (slower, stumbles, `STUMBLE_*`, hashed from the tick, no random numbers), and at 0
it collapses (`f.down`, event 'collapse'), waking at `f.homeX`, `f.homeY` (where it started; the camp later) the next morning
(`WAKE_PHASE`, at least `DOWN_TICKS` on: `wakeForager`, event 'woke') chilly, dry, rested, the satchel empty. Standing still
from full warmth at dusk (4 seeds): a summer night ends cosy or chilly, a spring or autumn one anywhere from chilly to
collapsed (rain makes it worse), a winter one kills.
The opening (PLAN.md stage 3): a new meadow opens on day 4 of spring (`START_DAY`) late in the afternoon (`START_PHASE`, just
before the golden hour), in a storm that holds till the first fire is lit (its `until` is `OPENING_HOLD`, which `openingStorm`
looks for; a collapse doesn't end it, the forager wakes into it), then blows over (`lightFire`: `STORM_EASE`) into a clear spell
(`CLEAR_AFTER`, and at least till `CLEAR_END`, the morning after; `weatherTick`), then the season's odds again. It's a gale,
harsher than other storms (`GALE_*`: colder in `airTemp`, windier and wetter in `bodyTick`, twice the lightning, and a strike in the open round the forager about every 5 s at 1x, `GALE_NEAR`; game.js shows
it as more than a storm, `GALE_LOOK`). The forager arrives cold and wet (`foragerArrives`: `ARRIVE_WARMTH`, `ARRIVE_WET`), and so
does a friend's forager coming in while it lasts. In the open, walking about it collapses about dusk (0.71 of the day, about
3 min at 1x after it opens), standing still at 0.62 (4 seeds); under trees it lasts longer. A meadow kept from before the
storm held keeps its old end. No new fields, no `KEEP_VERSION` bump.
Fires (`w.fires`, one layout, `fireOf`; the long comment over `FIRE_STICK`): laid with sticks and tinder (`layFire`; what one takes
is recipes.js `BUILDS`, spent out of the satchel by game.js with `spend`), lit (`lightFire`), burning a stick in `FIRE_STICK` (faster
in the wet, `FIRE_WET`), never more than `FIRE_MOST` on (`feedFire`, `fireRoom`), then embers for `FIRE_EMBERS` (a stick and a blow
relight them), then cold. The spring flood over one puts it out. It warms the forager up to `FIRE_WARM` degrees within `FIRE_NEAR`,
none past `FIRE_REACH` (`fireWarmth`, by `fireHeat`), and dries it close up (`FIRE_DRY`), rain or not. No random numbers, and a
meadow kept before fires gets none (no `KEEP_VERSION` bump). Standing by one from dusk with warmth full (4 seeds): a new fire's 5
sticks burn about 8.5 game hours dry (7 in rain); spring nights end at 0.6 to 1 warmth, winter ones at 0.1 to 0.75 (snow worst),
and a fire kept fed keeps it at 1 all night; with none, the rainy spring nights and every winter night kill.
The meadow's first fire lit makes camp (`w.camp`, in `LATER`: where, the fire, the tick; `campAt` from `lightFire`, event 'camp'):
the forager's home (`homeX`, `homeY`) moves to where it knelt to light it (within `CAMP_KNEEL`; else the fire's clear side), so it
wakes there after a collapse. Its ring, `CAMP_R` tiles round the fire and `CAMP_FLAT` as deep as wide (`inCamp`), is where later
builds go. A meadow kept with a fire lit before camps makes camp at it as it opens. No random numbers, no `KEEP_VERSION` bump.
Its tummy (`f.tummy`, 1 full to 0; the comment over `TUMMY`): `TUMMY` of recipes.js's fill, emptying in about a day walking
(`TUMMY_BURN`), `TUMMY_STILL` of that standing, `TUMMY_RUN` sprinting, up to `TUMMY_COLD` more in the cold. Under `HUNGRY`
(`hungerOf`) stamina comes back slower (`HUNGRY_REST`) and the cold bites harder (`HUNGRY_COLD`), most of all empty; it never
collapses it on its own. `feedForager` (game.js, with the fill it reads from recipes.js: an apple 1, a dish 3 to 7) fills it, and a
warm dish puts `WARM_DISH` back and keeps it warm inside for `WARM_IN` (`f.warmIn`: cooling `WARM_IN_COOL` as fast). A new
forager starts at `START_TUMMY` (0.85: by the first fire it's still fed at dawn, hungry by mid-morning), wakes at least
`WAKE_TUMMY`. Events 'hungry', 'starving', 'ate'. A kept forager from before starts full; no `KEEP_VERSION` bump. (The rabbits
have an `eat` of their own: a second `function eat` in sim.js would take its place.)

Rocks are painted (`rockInfo`, `rockSprite` in game.js): pebbles, stones and boulders by
size (`TERRAIN.rockSize`), flat stones at the fords, and two or three great rocks per meadow
(`TERRAIN.bigRocks`, `big: true`) that burrows keep clear of. Like a tree's, a rock's snow is a layer of its
own, painted once and faded in as thick as the snow lying, so the snow never repaints the rock.
Flowers are painted too (`flowerSprite`, one painter per kind in `FLOWER_ARTS`): a clump on stems in
one of `FLOWER_VARIANTS` looks, painted once per half-octave size. Which painting a flower gets comes from
the sim's flower and the season (`flowerArt`). Thought bubbles are painted too: the bubble and an icon for the
mood (`BUBBLE_ICONS`), one sprite. Trees are painted by trees.js (above). The rest of the ground cover is more
`FLOWER_ARTS`: green tufts, tawny ones in autumn, sprouts, fallen leaves, nodding seed heads and winter's frosted
tufts (`paintTuft` … `paintTuftFrost`); the windfalls under a tree are `paintFall`.

A body left out in the open lies a few days as remains (`leaveRemains`, `w.carcasses`; not one in a burrow, a bee, or one
that left the meadow; a fox's catch leaves what it didn't eat, `KILL_LEFT`), rotting away in `ROT_DAYS` by season (`carrionTick`),
fast in summer. Foxes don't eat remains (tried: it fed them through the rabbits' lows). A dead rabbit lying there is what the
player's hunting will pick up, one day. Crows eat them (`crowTick`):
a few birds that fly over everything (`flies: true`), painted in game.js (`paintCrow`: standing, pecking, two wingbeats,
and those with an acorn, the two steps of a walk, asleep on a branch). By day they walk about pecking for grubs (`peck`, `grubs`: best on short grass
and rich ground, fewer in winter, `GRUB_SEASON`, and under snow, `GRUB_SNOW`; the remains carry them through the winter): a few steps, a stop to
peck, now and then a few hops (`t.stop`, `t.hop`; game.js picks the step from where it is, `crowWalks`, `crowHop`), stepping
away from one too close (`CROW_SPACE`), and fly down to remains they see, or now and then see other crows at (`carrion`,
`remainsNear`, `GATHER_SIGHT`, `GATHER_NOTICE`), a few at a time: a crow claims a place there as it sets off (`k.seats`, `freeSeat`,
`CARRION_SEATS`), and keeps off remains a fox is at (`FOX_NEAR`). A crow's bite fills it like its other food (`CROW_BITE`, times
`EAT`) and takes `HUNGER` times less of the remains, so a rabbit feeds the crows about as many days as it did on the old clock.
Only really hungry they take the rabbits' windfalls (`CROW_HUNGRY`). While the blackberries are ripe a hungry crow flies to
the nearest bramble with berries on it, and one that isn't goes now and then for a feast all the same (`berries`,
`BERRY_TREAT`, modes 'bramble' and 'berries'): it sits eating a while (`BERRY_TICKS`) from its own place along the front, taking
`BERRY_BITE` a tick off the bramble whether it's full or not. It swallows the pips (`c.pips`) and drops them `PIP_GUT` later
wherever it is (`dropPips`, `PIP_ODDS` of them any good, in `w.pips`), on its patch or under the roost, and in the first half of
spring a bramble comes up there where it suits. So the brambles spread with the crows, a fifth to three quarters of the berries go to them (more
while the brambles are few), and a few new patches come up each spring. In autumn one that isn't hungry fetches a few acorns or beechnuts from an oak or a
beech (`d.nuts`, which `seedFall` leaves for them) and buries them one by one out in the open (`cacheNut`, `seedSpot`),
each a seed in `w.seeds`. It remembers only its last few (`CACHE_MEMORY`) and digs those up if hungry in winter (`unbury`);
the rest come up as oaks and beeches, so the woods spread with the crows.
Each crow keeps its own clock (`ownClock`): it wakes, gathers and goes to roost a little earlier or later than the others.
They sleep through a storm too, but a hungry one (`CROW_HUNGRY`) goes out in one by day: mums sitting a storm out on their eggs
starved, a spring's worth of them at once.
Crows that mate stay a pair for life (`c.mate`, `mateOf`, `faithful`), and once they've nested the ground round their nest
tree is their patch (`patchOf`, `PATCH`): fed, they fly back to it, keep near each other (a crow with no mate flies over to
the nearest crow instead, `FRIEND_FAR`), and in spring drive other grown crows off it (`drive`). So by day paired crows are
spread over the meadow, and the young and the unpaired go about in a loose flock. Late in the afternoon they gather on open
ground by the roost (`gatherSpot`, `GATHER_AT`: setting off in time to get there, one busy with acorns seeing to them first),
and fly in at dusk. At the roost: a big tree in a grove with room for them (`w.roost`, `pickRoost`), each crow to a seat of
its own in it or the trees about it, a few to a tree by its size (`roostSeat`, `c.perch`, `PERCHES`, `CROW_SEATS`: side
and height in the crown), and at dawn each flies off to a spot of its own (`flyOut`). game.js knows where the crown is in
each kind's painting (`CROWNS`, measured off trees.js) and draws a crow on its seat there (`crowSeat`, `seatShift`),
swaying with the tree; one 💤 a tree, and mates side by side. In flight a crow swings about its way (game.js `weaveOf`).
In spring a mum sits on her eggs high in a tall tree, night and day (`nestTree`,
`c.home`) and the chicks stay hidden in the nest till they fledge (`FLEDGE`). A fox that comes close sends them flapping up,
the others with them (`flapUp`, `caw`), but one busy on the ground may not see a fox out hunting in time: a small meal
for it (`CROW_MEAL`) that doesn't change where it hunts. game.js paints a dead rabbit, or a dead fox (`paintBody`,
`paintDeadFox`; a fox `FOX_BODY` the size, its white-tipped tail lasting longest), lying on its side with its eyes closed, in four
stages as the meat goes (`BODY_STAGES`): whole, opened with the ribs showing (where a fox's catch starts), picked over to bones,
and a flat pelt that fades. A bird's remains are a few feathers, an otter's tufts of fur (`paintRemains`, `drawRemains`), and
remains have a panel of their own (`THINGS.remains`). And game.js eases a crow's height in sim time (`birdLift`, `crowHeight`), so it glides down to land and up to its perch.

Mushrooms come up for a few days after rain (`shroomsTick`, once an hour; `w.rainAt`, the last hour it rained: full odds for
the first day after, none by `SHROOM_AFTER[1]`), mostly in autumn (`SHROOM_SEASON`), none under snow: oyster mushrooms on a log,
chicken of the woods (a sulphur shelf) up a broadleaf snag (`shroomOnWood`, `SHROOM_WOOD` an hour each), ceps round a grown oak
or pine and chanterelles round a birch or beech (`shroomUnderTree`, `SHROOMS[k].trees`, `SHROOM_REACH` from the trunk, in front of
it or to a side), and field mushrooms on rich ground (`shroomOnRich`, `SHROOM_RICH`: a kill site, a warren's latrines, an otters'
spraint, where a log rotted away; not in a burrow's mouth), so they chain on from the remains and the rabbits. Each clump is one
object of one layout (`shroomOf`: kind, place, its tree, born and until, caps and look), in a short list (`w.shrooms`, at most
`SHROOM_MOST` times `w.room`), lasting `SHROOM_DAYS`; it goes early if its log rots away, its snag falls, the water rises over
it or snow lies. They come up only where the player can see them: not behind a tree, a log or a rock drawn in front (`inSight`,
`SHROOM_HIDE`, by how game.js draws them), which keeps most of them to the woods' edges and the open. They have random numbers of
their own (`w.shroomRng`), so the meadow plays out the same with them. An autumn has 10 to 20 clumps about on average, 15 to 30 at the
height of a flush and next to none in a dry spell; a summer a few after a storm. Nothing eats them yet: they're for the cook. game.js paints them (below, and game.md).

Spring greens (`greensTick`, once a day): wild garlic and nettles, so spring has something to pick. They're patches that live for
years (`w.greens`, one layout, `greenOf`), underground most of the year and coming up in the same spots each spring, a little
bigger each time (`g.size`, 0 to 2). What a patch shows comes from the season (`greenStage`, `GREEN_SEASONS`): garlic's leaves
from the start of spring, white flowers from its middle, dying back in the first fifth of summer; nettles' young tops in spring,
tall and flowering in summer, brown till the middle of autumn. Garlic grows in damp wood (`GARLIC_WOOD`, within `GARLIC_DAMP` tiles
of the water, `w.damp`, above the spring flood; `garlicAt`): a meadow starts with some (`startGreens`, `GARLIC_START`), a few more
come up each spring and patches seed one next door now and then (`GARLIC_SPREAD`); it doesn't come up a spring with the wood gone
over it. Nettles come up on rich ground (`NETTLE_RICH`, `nettleAt`), spring and summer, so they gather round the busy warrens and
kill sites, and die out a year after the ground stopped being rich (`g.fed`, `NETTLE_FED`). Both only where the player can see
them (`inSight`, as the mushrooms), at most `GREENS_MOST` of each times `w.room`, with random numbers of their own
(`w.greenRng`). A meadow has about 5 to 13 garlic carpets, and nettles build up to 10 to 25 patches over three years. Nothing eats
them: they're for the cook.

Wild finds (`findsTick`, every two hours): little things to pick in every season, so a view has a few most of the time.
Dandelions out in the open and sorrel in the damp grass in spring, wild strawberries at the woods' edges and elderflower by the
water or a wood's edge in summer, hazelnuts at the edges in autumn, rosehips in the scrub (by the thorns or a wood's edge) from
late autumn through the winter, and watercress in the shallows by the bank from the end of autumn into spring (`FINDS`: when,
`from`/`to` in seasons into the year; where, `findPlace`; how many at most, `most` times `w.room`; what a pick gives, `n`; `wet`:
watercress goes only when the water there turns deep). Each is a short-lived thing of one layout (`w.finds`, `findOf`), coming up
where it suits, in sight (`inSight`), mostly near another of its kind (`FIND_PATCHY` of the time, `FIND_PATCH` off one picked at
random, `oneFind`) till that patch has `FIND_CLUMP` (`clumpAt`), so they come in small patches with open meadow between, not an
even sprinkle or a long row; it lasts `FIND_DAYS`, never past its season, and the low ones go under snow (`FIND_SNOW`). A look
brings up a fifth of what's missing (`FIND_FILL`), so a season fills in a day or so and a picked one is soon made up somewhere. A
new meadow starts with most of what's in season, of all ages, `CAMP_FINDS` round the forager's camp within `CAMP_REACH` (the kinds
in season in turn, two of a kind, so one that won't grow there leaves room for the others) and a garlic carpet there if there's
damp wood thin enough for one (`startFinds`, `garlicAt`'s camp). Random numbers of their own (`w.findRng`). In a 45 by 28 tile
view anywhere in the meadow (8 seeds, a year) there are about 5 things to pick in spring, 5.5 in summer, 4.5 in autumn and in
winter, none in about one view in ten; round the camp a few more. A meadow kept before them gets them when it opens
(`unpackWorld`), no `KEEP_VERSION` bump. Nothing eats them: they're for the cook.
What lies on the ground for a fire is four more kinds in `FINDS`, marked `ground` (not food, so `eachPickable` leaves them out
and they never glint), there all year (`from: 0, to: 4`: no end of season, `addFind`), each lying its own `days`: sticks
under a crown or by a log (`inCrown`) or in the woods, the commonest, more in rain and a lot more in a storm (`STICK_WIND`, and a
storm brings them down faster); pebbles by the water's edge, at the fords and round the rocks (`stonyAt`); dry grass in long
open grass (`DRY_GRASS`), mostly in summer and autumn (`more`, its most by season), standing up out of the snow; birch bark
under a birch or by a fallen one. Their most go through `findsMost`. A new meadow lays `CAMP_GROUND` of each round the camp,
looking further out till it's found, so a first fire can always be made (4 to 6 seeds: sticks within about 5 to 19 tiles,
tinder within about 20). In a meadow over a year: about 25 to 50 sticks (50 in a storm), 14 pebbles, 14 dry grass in summer and
autumn and 4 to 7 in winter and spring, 3 to 8 birch bark.

Brambles (`bramblesTick`, once an hour for the berries and once a day for the rest): thorny mounds that live for years and
show all year (`w.brambles`, one layout, `brambleOf`). What a patch shows comes from the season (`brambleStage`): bare canes in
winter and early spring, leaves, flowers till `FLOWER_TO` into summer, berries ripening, then ripe from `RIPE_FROM` into summer
to `RIPE_TO` into autumn, and going over after that. A patch grows each spring (`b.size`, 0 to 2) and fruits from its second
summer: the hour its berries ripen it gets a crop (`b.crop`, `BERRY_CROP`, half on a patch a year old, less in the shade), and
what's left (`b.berries`) is gone when they go over. A meadow starts with some along the woods' edges (`BRAMBLE_EDGE`) and by
the thorn bushes (`startBrambles`, `BRAMBLE_START`, a few years old). A grown patch roots a cane tip next door now and then in
autumn (`BRAMBLE_ROOT`, `by: 'tip'`), a first-year one on grass grazed short is a rabbit's mouthful (`BRAMBLE_GRAZED`,
`BRAMBLE_NIBBLE`), so the warrens keep them back, and one dies the spring the wood over it is thicker than `BRAMBLE_SHADE`. New
ones come from the crows (`brambleAt`: dry ground above the spring flood, not a flower field or a burrow's mouth, in sight,
`BRAMBLE_GAP` from the others, at most `BRAMBLE_MOST` times `w.room`). Random numbers of their own (`w.brambleRng`). A meadow has
about 12 to 16, 20 to 30 by year three.
In flower a patch (size 1 or more) is `BRAMBLE_BLOOMS` spots of blossom for the bees (`brambleBlossoms`, in `w.blossoms` like a
tree's, `p.tree` the bramble, `b.blooms`; `isFlower` asks `brambleStage`), and its crop is `BRAMBLE_SELF` plus the rest by the
bees' visits (`b.visits`, `BRAMBLE_VISITS`), so a bramble by a hive bears best. A grown patch is a rabbit's refuge: `pickRefuge`
weighs it with the burrows, and a rabbit that reaches it sits tight in the thorns, visible, at its foot (`enterThicket`, mode
'thicket', `thicket`: `THICKET_TICKS`, longer while an awake fox is within `THICKET_FOX`, never past `THICKET_MOST` or once
hungry). No fox follows it in: `hunt` drops it and doesn't pick it (an escape, how 'bramble'). In the ripe weeks a fox fuller
than a hunt but under `FOX_BERRY_FED`, not a cub, goes to the nearest ripe bramble it smells (`foxBerries`, `FOX_BERRY_SIGHT`,
modes 'bramble' and 'berries'), eats `FOX_BITE` a tick for `FOX_BERRY_TICKS` (about a day's keep a trip) and drops the pips
like a crow (`dropPips`). The crows and the foxes share the berries; the rest are the cook's.

Bees live in hives (`w.hives`), each in an old hollow oak from `w.decor` (`h.tree`, `d.hive`, `moveIn`), a giant (`HIVE_TREE`)
with a hollow low on its trunk (`drawBeeTree`). A meadow starts with `HIVES` of them (times `w.room`), each in the best tree
left for one (`placeHive`, `hiveTree`, `siteScore`: fields in reach, open ground in front, `HIVE_GAP` from the others,
`HIVE_EDGE` from the misty edge), made an old oak (`oldOak`); with none, an oak stands alone near the middle, each with
`START_BEES` of all ages. Each colony has a queen (`h.queen`, `newQueen`: a name on the hive, she stays in) who raises bees
while there's honey (`hivesTick`, `raiseBees`, `QUEEN_LAYS` a day, `BROOD_HONEY` each): in spring and summer up to the room in
the hollow (`HIVE_ROOM`), in autumn only a winter cluster (`WINTER_BEES`, with `WINTER_HONEY` put by for each, `broodTime`).
Summer bees live `lifeDays` (5), autumn-born ones `winterLifeDays` (18), and a young house bee stays in till she's grown. The
hive feeds its bees: `BEE_EAT` honey a bee a winter day, more in a small cluster (`clusterCold`), and `HOME_EAT` of that the
rest of the year, when they live on nectar. Out of honey they starve, and a colony with no bees left is gone (event
`queenlost`); its hollow keeps the comb and what honey is left (`h.queen` null), and a swarm likes it best (`OLD_COMB`).
While the flowers are out (`w.flowers`, `FEW_FLOWERS`), by day and out of the rain, the
bees fly out (`flies: true`, `fly`), sip from the flowers the meadow shows (`isFlower`, same rule as `plantEmoji` in game.js)
within `FORAGE_RANGE`, and carry the nectar home a `LOAD` of flowers at a time, which fills the hive's honey (`HONEY` a
flower, up to `HIVE_FULL`, 100): a hive with fields in reach fills over the summer and goes into winter well stocked; one with
none in reach runs short and may starve. The honey is the colony's winter food and, later, the cook's. One back from a rich
patch dances (`h.patch`), and bees setting out fly there.
Swarms: in late spring and early summer (`SWARM_FROM`, `SWARM_TO` seasons into the year) a crowded colony (`SWARM_BEES`,
`SWARM_HONEY`, `swarmTime`, once a year) swarms now and then (`SWARM_ODDS` a check): the old queen and half the grown bees
leave with `SWARM_CARRY` honey each and hang in the nearest big tree (`hangSpot`, `hangOut`: a hive with `cluster: true`, its
tree `h.hang`) for a few hours (`SWARM_HANG`), while one bee in `SCOUTS` flies out to the best sites about and back (`hiveSites`:
an empty hive, or a tree a swarm can take, `siteTree`: a hollow oak, `hollow`, or a big broadleaf, which becomes one). A daughter
queen stays behind (`newQueen(w, mum)`, laying after her wedding flight, `MATING_FLIGHT`). Then it moves into the best site
still free (`settle`, event `settle`), or with the meadow holding `HIVES_MOST` colonies (times `w.room`) flies off over the trees
out of it (`swarmLeaves`, `h.leaving`, the bees mode 'away', cause 'left'). So most summers a meadow sees a swarm or two. A hive
whose tree falls or is struck swarms out the same way (`hiveMoves`, event `hivemoved`). With no colony left a wild swarm comes in
when the flowers are out (`swarmArrives` from `migrate`, after `COME_AFTER.bee` days). The cooking game's skep hooks into the
hanging swarm (`hangOut`): the player will shake it into a skep. The crows don't roost in a hive's tree (`perchable`).
game.js draws a hanging swarm as a seething clump under its branch (`drawSwarm`, `barkBee`; hit where it's drawn, `hiveAt`), and the
hive's panel shows its queen, how crowded it is, and a swarm's wait. game.js paints a bee (`paintBee`): it buzzes between wings up
and down in flight (`beeArt`, `BEE_BUZZ`; still when too small to see, `BEE_STILL`), sits with its wings folded on a flower,
and carries its pollen on its hind legs (`drawBaskets`). The honey is for the cook, later.

Visitors (`visitorsTick`): none comes now. They only ever came to the keeper's places (hedges, dug ponds, sown strips), and
the keeper is gone; they'll come back as the cooking game's NPCs, by a new way in. Their code is kept as it was: now and
then the keeper's work drew one in (and more below: dragonflies, a kingfisher,
a skylark). A hedgehog comes at dusk to the longest hedge
thick enough to hide in (`h.young`), spring to autumn (`hedgehogComes`: `VISIT_FIRST` the first time, then `VISIT_ODDS` an
evening after `VISIT_REST` days), walks in from `VISIT_FROM` tiles off, stays `VISIT_DAYS` (asleep at the foot of a whip by
day, pottering along the hedge at night and snuffling for beetles, `potter`, `snuffle`, `v.finds`) and goes back the way it
came at dusk, or at once from a hedge gone (`leave`). A visitor isn't a creature: nothing hunts it, it eats nothing
the meadow counts, and its chances are hashed from the day, not drawn from `w.rng`, so the rest of the meadow runs the same with it.
A heron comes of a morning to the dug pond with the most frogs about it (`heronComes`, `frogsAbout`), once frogs have found it
a day or more ago (`p.found`, `p.foundDay`), spring to autumn, on the same odds. It flies in from `HERON_FROM` tiles off, fishes
from dawn till dusk (`HERON_DAY`) among its spots (`heronSpots`: the pond's shallow tiles, or its bank if it's all deep, worked out
again each morning): it stands watching (`heronWatch`, facing the pond's middle), stalks to a spot close by (`heronStalk`; one
further off it flies to, `hop`), and stabs (`HERON_STABS`), now and then coming up with a frog, or a fish where `w.fish` is thick
(`HERON_CATCH`, `v.frogs`, `v.fish`, `gulp`). At night it sleeps where it stands. It flies off of an evening once its days are up,
or at once from the ice or the pond gone dry (`heronOff`). It takes nothing from `w.frogs` or `w.fish` (`FROG_DIE` has the herons in it).
One of a kind the player had never seen (game.js set `v.wait`; nothing does now) stays on past its days till it's seen, then two days more, but
leaves on the last day of autumn whatever happens (`waits`); the ice, a hedge or the pond gone still send it off.
A visit is foretold: its days are hashed (`hogDay`, `heronDay`) and where it'd come is worked out as things are now
(`hogPlace`, `heronPlace`), so each sunrise `visitorSigns` looks `SIGN_DAYS` ahead for the first day one would come and leaves
a sign there (`w.signs`, event `visitorsign`): a hedgehog's tracks along the way it'll come in, a heron's feather on the bank
(`bankOf`). It goes when the visitor comes (`dropSign`) or the sunrise after its day. `hedgehogComes` and `heronComes` use the
same functions, so the visits themselves come on the same days as before the signs.
`w.visitors` (the ones here), `w.visited` (how often each kind came, the day the last left); events `visitor`, `visitorleft`.
A meadow kept before them gets both empty (`unpackWorld`), no `KEEP_VERSION` bump.
The keeper's places had qualities, worked out once a day (`placesDay`, still run while `w.visitors` exists), so a visitor
asking for a kind of place looks it up: a pond's water now (`p.wet`), its fish (`p.fish`) and a tree at its edge or on an island
in it (`p.perch`, within `EDGE_REACH` of its water, `pondPlace`); a strip's room in the open (`f.clear`: tiles to the nearest tree
or hedge standing, `stripPlace`). `placeNeeds` says what a place lacks for a kind (the inspector shows it). They pull against
each other: fish come into a pond only through water joined to water that has them (`fishTick`), so a pond on its own has none
(`FISHLESS`) and one dug onto the river or a lake has them (`KF_FISH`). Dragonflies come to a pond on its own with its reeds up,
in summer (`dragonflyComes`: hawking over it in darts and stops, `DRAGON_DAY`, roosting on the reeds at night and in the rain);
a kingfisher to a pond with fish and a tree at its edge, in summer and autumn (`kingfisherComes`: on a low branch over the water,
diving, `KF_CATCH`, beating a fish on the branch); a skylark to a strip out in the open, nothing standing within `LARK_OPEN`, in
spring and summer (`skylarkComes`: walking and pecking, rising to sing high over it, `v.high`). Each kind's seasons are
`VISIT_SEASONS`, its days hashed by `visitDay` (as `hogDay`, but `VISIT_SURE` the first time: a season was five days then, and
the place is the hard part; on the last day of its seasons a visit of a day), and at most one kind comes for the first time a day
(`firstBlocked`, `w.visited[kind].first`; a sign foretelling another's first visit holds it back too). None takes anything
from the meadow.
