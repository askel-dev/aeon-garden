# Bees and hives (sim.js)

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
