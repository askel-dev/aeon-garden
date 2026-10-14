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
`shadeSoil` works out how much grass each tile's soil holds under the shade on it (`w.shadedFert`, which `growGrass`
reads, `shadeSoil`), so woods that creep out cost the rabbits grazing.
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
take after their parents; only a look differs (`c.scale`, and a fox's shade, `c.fur`, which its cubs share). Rabbits graze,
dig burrows (`DIG_TICKS`: two minutes for one alone) and go home at night, thump and run for a burrow when they spot a fox, and
breed in spring and summer up to their cap (`SPECIES.rabbit.cap` × `w.room`), which with the foxes holds them. A fox naps
through the middle of a fed day, and hungry it stalks the nearest rabbit it sees, charges from `POUNCE`, and keeps to where
it last caught one (`c.haunt`); a rabbit runs from it within `FLEE_DIST` of its sight. Rabbits boom through the summer and
thin over the winter, every year.
The gentle respawn (`migrate`, four times a day): with fewer than `FEW` of a kind (rabbits times `w.room`), once they've been
few for `COME_AFTER` days, `ARRIVE` more wander in from an edge, and again as long after while they're still few; foxes only
come with `FOX_FOOD` rabbits about, and otters come up the water to a free holt. So neither the foxes nor, later, the
player's hunting can empty the meadow, and a low still shows. Bees don't come this way: a hive raises its own.

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

Nothing is left lying when an animal dies: no remains, no carrion. Crows (`crowTick`) are
a few birds that fly over everything (`flies: true`), painted in game.js (`paintCrow`: standing, pecking, two wingbeats,
and those with an acorn, the two steps of a walk, asleep on a branch). By day they walk about pecking for grubs (`peck`, `grubs`: best on short grass,
fewer in winter, `GRUB_SEASON`, and under snow, `GRUB_SNOW`, but enough to live on with no carrion): a few steps, a stop to
peck, now and then a few hops (`t.stop`, `t.hop`; game.js picks the step from where it is, `crowWalks`, `crowHop`), stepping
away from one too close (`CROW_SPACE`). Only really hungry they take the rabbits' windfalls (`CROW_HUNGRY`). In autumn one that isn't hungry fetches a few acorns or beechnuts from an oak or a
beech (`d.nuts`, which `seedFall` leaves for them) and buries them one by one out in the open (`cacheNut`, `seedSpot`),
each a seed in `w.seeds`. It remembers only its last few (`CACHE_MEMORY`) and digs those up if hungry in winter (`unbury`);
the rest come up as oaks and beeches, so the woods spread with the crows.
Each crow keeps its own clock (`ownClock`): it wakes, gathers and goes to roost a little earlier or later than the others.
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
for it (`CROW_MEAL`) that doesn't change where it hunts. And game.js eases a crow's height in sim time (`birdLift`, `crowHeight`), so it glides down to land and up to its perch.

Bees live in hives (`w.hives`), each in an old hollow oak from `w.decor` (`h.tree`, `d.hive`, `moveIn`), a giant (`HIVE_TREE`)
with a hollow low on its trunk (`drawBeeTree`). A meadow starts with `HIVES` of them (times `w.room`), each in the best tree
left for one (`placeHive`, `hiveTree`, `siteScore`: fields in reach, open ground in front, `HIVE_GAP` from the others,
`HIVE_EDGE` from the misty edge), made an old oak; with none, an oak stands alone near the middle. A hive keeps its bees:
`HIVE_BEES` of them, and one lost (old age, lightning) is raised again in about `RAISE_DAYS` (`hivesTick`, `raiseBee`). No
queens, eggs, winter bees or swarms. While the flowers are out (`w.flowers`, `FEW_FLOWERS`), by day and out of the rain, the
bees fly out (`flies: true`, `fly`), sip from the flowers the meadow shows (`isFlower`, same rule as `plantEmoji` in game.js)
within `FORAGE_RANGE`, and carry the nectar home a `LOAD` of flowers at a time, which fills the hive's honey (`HONEY` a
flower, up to `HIVE_FULL`, 100): a hive with fields in reach fills in about two seasons. In winter it eats `WINTER_EAT` a
day. One back from a rich patch dances (`h.patch`), and bees setting out fly there. A hive whose tree falls or is struck
moves to the next best (`hiveMoves`, event `hivemoved`). game.js paints a bee (`paintBee`): it buzzes between wings up
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
