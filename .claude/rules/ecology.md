---
paths:
  - sim.js
  - balance.js
---

# The meadow's ecology

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
`enrich`): a body left out in the open (`leaveRemains`; not one in a burrow, not a bee), the latrines round a warren in use (a
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
(birch, pine, maple), left for the crows to bury out in the open (oak, beech: `d.nuts`, see the crows), dropped by birds under a perch, a thorn bush
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
The player plants trees too: the 🌳 Plant tool (T, or 🌳 in the ring) opens a ring of kinds where you clicked
(game.js `PLANT_KINDS`, `plantAt`), and `plantTree` (sim.js) sets down a seedling the smallest there is, with
`d.planted` (when; `by: 'you'`), where a wild seed could come up but with no luck or room roll. It lives by the
wild ones' rules from then on. The news tells how it does (events `plantlost` with its cause and the rabbit that
ate it, `plantgrew` past the rabbits' reach, `plantseeds` its first seed), the inspector says when you planted it,
and the Yours card lists the ones still standing. No `KEEP_VERSION` bump.

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
look only, and a vole (`voleAt`, the mousing bubble's) shows only when something is after it; a pounce
is a high arc (`hopOf`). The fox hears the rustle it'll leap at as it starts listening (`c.rustle`, `listen`), so you
see it coming: the grass there twitches in fits and the vole's back shows (`drawRustle`, a frog by the water), and as the
fox crouches (`crouchOf`) the vole looks up and freezes. Caught, it's in the fox's jaws while it gulps (`drawCatch`);
missed, it darts off from under it (`watchLeap`, `drawDashes`). The news tells of a vole year and the crash after it (`VOLE_BOOM`, `VOLE_BUST`), and the
stats chart has their meadow-wide count (`w.history.voles`).

Frogs are a field too, like the voles (`frogsTick`, every `FROG_EVERY` ticks): `w.frogs` on land, `w.spawn` (spawn,
then tadpoles) on shallow water. From spring to autumn frogs live in the damp long grass near the water (`frogRoom`: up
to `FROG_K` a tile, fewer the further from the water, `w.damp`, worked out at most once a day by `dampen`; grazed short
holds `FROG_BARE` of it; a heatwave shrinks the reach to `FROG_DRY`); they winter in the mud (`FROG_COLD`, twice that
under ice), and fire kills them. On a mild night early in spring (`SPAWN_FROM`, `SPAWN_ODDS`, a wet night always, by
`SPAWN_BY` anyway) the frogs within `SPAWN_REACH` of the shallows spawn (`spawnFrogs`, shared out with `boxSum` and
`shareOut`): still shallows best, a flood pool on the floodplain above all (`SPAWN_EDGE` for the lasting shallows, none by
the deep or the current, `SPAWN_DEEP`; rich water a little more). The tadpoles grow as one (`w.frogYear.grown`,
`TADPOLE_DAYS`, faster in the sun, `WARMTH`) and then leave for the grass about (`FROGLET_LEAVE`, `FROGLET_REACH`). That's
the gamble: the flood pools go when the water falls back in summer (or in a dry spell), and tadpoles in one that dries
out are stranded (`tadpolesTick`), so an early spawning in a warm spring makes a big frog year and a late cold one a
poor one. Only the tiles spawned in are looked at (`w.spawnTiles`). A mousing fox and an owl take frogs with the voles
(`smallAt`, `takeFrog`: whichever is thicker there, `FROG_ENERGY`, `OWL_FROG`), and a frog is small prey for the fox's
search image too (`c.prey` 'frog' sees rabbits at `MOUSE_EYES`; without that, rabbit lows dragged on). A hungry crow in
spring flies down to the thickest spawn (`w.spawnSpots`) and pecks it out at the water's edge (`tadpoles`, modes 'pool'
and 'tadpole'). game.js draws it all as a look, a fixed pool (`drawPond`): frogspawn clumps, then tadpoles, a painted
common frog (`frogAt`, also the 🐸 bubble; 🫧 is the frogspawn) hopping at the water's edge or up on a lily pad. The water
inspector says what's in it (`pondFacts`), the news tells of the spawning, a pool drying out with tadpoles in it,
froglets leaving and a big or poor frog year (`FROG_BOOM`, `FROG_POOR`, event 'frogyear'), the stats chart has
`w.history.frogs`, and a frog purrs now and then on spring nights while there's spawn about (sound.js `croak`).

Fish are a field too (`fishTick`, every `FISH_EVERY` ticks): `w.fish` on water. They live in the water that lasts the year
round (below `w.terrain.level`, so not the flood pools), deep water best (`fishRoom`: `FISH_K` a deep tile, `FISH_SHALLOW` of
that in the lasting shallows), breed from spring into summer and spill over next door, out onto the floodplain too while
it's flooded; there's no room for them there, and those still on it as it drains are stranded. Winter thins them a little
(`FISH_COLD`). They eat tadpoles: on top of `TADPOLE_LOSS`, a tile loses `TADPOLE_FISH` a day at `FISH_K` fish, so the
frogs' gamble is the flood pools (no fish, but they dry up) against the lasting shallows. The otters eat them (`takeFish`).
A meadow kept before them gets its fish when it opens (`unpackWorld`), no `KEEP_VERSION` bump; the history has `w.history.fish`.

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

Rabbits catch a sickness from each other (`sicknessTick`, every `SICK_EVERY` ticks): from a sick one sharing their
burrow (`BURROW_CATCH`), and from one within `CONTACT` tiles out in the open (`OPEN_CATCH`), both times how crowded
the meadow is (`crowding`: rabbits against `CROWDED` × `w.room`). A burrow holds only a few and most sleep out when
there are many, so in a crowded meadow most catch it outside. With nobody sick a first case turns up now and then,
likelier when crowded (`FIRST_CASE`). A sick rabbit (`c.sick`, the tick it ends) burns more (`SICK_BURN`), is slower
and sees less far (`fallIll` scales its traits, `getBetter` puts them back), doesn't court, and may die of it
(`SICK_DEATH`, twice as likely hungry or in winter; starving while sick counts too). A survivor can't catch it again
for a while (`c.immune`), nor can an immune mother's young kits (`KIT_IMMUNE`). The `resist` gene takes up to `RESIST`
off the odds of catching it and of dying of it, but costs a little energy (`RESIST_BURN`), so it rises after
outbreaks and slips back between them. The sickness and the foxes hold the rabbits now, and their cap (300) is
only a safety net. The news tells when an outbreak starts (`OUTBREAK` sick at once, by the nearest named place,
`placeNear`) and when it dies down (nobody sick), and the stats chart pins it. The inspector shows who is sick or
immune, and the sickness in a warren. A sick rabbit sits hunched, with a thermometer in its bubble.

A body left out in the open lies a few days as remains (`leaveRemains`, `w.carcasses`; a fox's catch leaves what it
didn't eat, `KILL_LEFT`), rotting away in `ROT_DAYS` by season (`carrionTick`), fast in summer. Crows eat them (`crowTick`):
a few birds that fly over everything (`flies: true`), painted in game.js (`paintCrow`: standing, pecking, two wingbeats,
and those with an acorn, the two steps of a walk, asleep on a branch; the 🐦‍⬛ emoji splits in two on older systems, so
it's only for text). By day they walk about pecking for grubs (`peck`, `grubs`: best on short grass and rich ground, little
in winter, none under snow): a few steps, a stop to peck, now and then a few hops (`t.stop`, `t.hop`; game.js picks the
step from where it is, `crowWalks`, `crowHop`), stepping away from one too close (`CROW_SPACE`), and fly down to
remains they see, or now and then see other crows at (`carrion`, `remainsNear`, `GATHER_SIGHT`, `GATHER_NOTICE`), a few at
a time: a crow claims a place there as it sets off (`k.seats`, `freeSeat`, `CARRION_SEATS`), and only really hungry take the
rabbits' windfalls (`CROW_HUNGRY`). In autumn one that isn't hungry fetches a few acorns or beechnuts from an oak or a
beech (`d.nuts`, which `seedFall` leaves for them) and buries them one by one out in the open (`cacheNut`, `seedSpot`),
each a seed in `w.seeds`. It remembers only its last few (`CACHE_MEMORY`) and digs those up if hungry in winter (`unbury`);
the rest come up as oaks and beeches, so the woods spread with the crows, and a sickness year that feeds them plants oaks.
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
the others with them (`flapUp`, `caw`), but one busy on the ground may not see it in time: a small meal for the fox
(`CROW_MEAL`) that changes neither its search image nor its haunt. Foxes don't eat remains (tried: it fed them through the
rabbits' lows). game.js paints a dead rabbit in its coat, or a dead fox (`paintBody`, `paintFox`; a fox `FOX_BODY` the
size, its white-tipped tail lasting longest), lying on its side with its eyes closed, in four stages as the meat goes
(`BODY_STAGES`): whole, opened with the ribs showing (where a fox's or an owl's catch starts), picked over to bones, and
a flat pelt that fades. A bird's remains are a few feathers (`drawRemains`). And game.js eases a
crow's height in sim time (`birdLift`, `crowHeight`), so it glides down to land and up to its perch. The news tells of crows arriving,
a gathering at remains in an outbreak (`GATHERING`), and the acorns they buried each autumn.

Tawny owls (`owlTick`): a pair or two (`SPECIES.owl.cap` × `w.room`), drawn as the 🦉 emoji. A female nests in a hollow oak
(`hollow`, `owlHollow`: no hive in it, not the crows' roost, `OWL_GAP` from the other owls' hollows) and marks it
(`d.owl`, her id; `owlsDay` frees it once she's gone); the bees' `hollowTree` skips it, as the owls skip a hive's, so the
two compete for the hollows. A male moves into his mate's (`mate`); one with no hollow roosts in any big tree and can't
breed. They sleep in their tree by day (`OWL_WAKE`, `OWL_BED`; `roostTree`, `c.perch`) and hunt from dusk to dawn
(`owlHunt`): sit on a branch by long grass with voles in (`perchSpot`), listen (`OWL_LISTEN`), drop on a vole
(`rustle`, then `takeVole`, which the fox's mousing uses too; game.js shows the vole there as it drops, like a fox's
rustle, and in its beak as it gulps) or now and then on a kit still out at dusk (`OWL_KIT`,
`KIT_CATCH`), and after a few tries with nothing stirring move on. So owls and foxes share the voles. In spring a pair
lays only in a year with voles about (`owlReady`, `OWL_BREED`), up to three owlets the more there are (`owlClutch`). The
owlets stay in the hollow till they fledge (`OWLET_FLEDGE`), keep near mum, and once grown a young female takes a free
hollow and a young male stays to find a mate while the meadow has room; otherwise it flies off out of the meadow
(`comeOfAge`, cause `'left'`, no remains). A dead owl leaves remains for the crows (barred brown feathers). By day a fed
crow that spots an owl asleep on a branch mobs it (`startMob`, `mob`, `MOB_ODDS`) and calls the others; the owl may
move off to a quieter tree (`owlShift`). A pair flies in in autumn when there are none (`migrate`). game.js eases an
owl's height like a crow's (`owlHeight`): on a branch, in the hollow, gliding, dropping to the grass. The news tells
of a hollow taken, owlets hatched and fledged, and a young owl leaving; the night hoot in sound.js only plays with owls about.

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
Colony-level things go in `hivesTick`.
