# Remains and crows (sim.js)

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
