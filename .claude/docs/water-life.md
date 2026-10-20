# Frogs, fish, otters (sim.js)

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
it's `WARY_FAR` off or lies down, or `WATCH_TICKS` have gone, then pays foxes no mind for `CALM_TICKS` (`c.calm`). A
forager on the bank does the same (`foragerSign`, `FORAGER_THREAT`): in it goes, and watches you from the water. Asleep, it
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
