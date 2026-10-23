# Rabbits and foxes, the inspector

## game.js

The inspector shows animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water,
visitors): each kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows. A tap
on an animal opens its panel (`select`); the camera never leaves the forager for it. Animals can't be named by the player. Every animal of a kind is alike
(sim.js has no genes, only a rabbit's winter coat), so an animal's panel is its mood, tummy, family and life story (a rabbit's
with its coat and how well it hides where it sits, `coatLine`), and a hive's its honey (`honeyWord`), its queen
and the fields in reach; a hive goes by the field nearest it, a swarm by its queen (`hiveName`). A hanging swarm is drawn as a
seething clump under its branch (`drawSwarm`) and picked where it's drawn (`hiveAt`); remains have a panel too (`THINGS.remains`).

Foxes and rabbits are painted (fur.js: `paintFox`, `paintRabbit`): one rig posed for
what each is doing (`FOX_POSES`, `RABBIT_POSES`, picked by `foxArt`, `rabbitArt`), painted as one animal by `paintFur`
(one shading over it all, each part's form and the markings soft, a part in front casting a soft shadow, a softened
outline and a faint grain), so its parts don't read as separate shapes. Every rabbit wears the wild coat (`COAT`; fur.js can
still paint the sandy, black and blue-grey ones), and in winter whitens as far as its moult takes it (sim.js `whiteness`) in 5
steps (`whiteStep`): only the brown and the white are painted, the steps between are the two mixed (`paintRabbit`, `furReady`).
A fox wears its own shade (`c.fur`). A dead rabbit white for winter lies white (`remainsLook`, `BODY_COATS`). A painting
is costly (each pass through the scratch layer is a flush), so parts can share one (`joined`) and the parts behind are
just shaded (`flat`). It's painted only at doublings of its size (`FUR_PAINTED`) and shrunk for the sizes between,
which keeps a dozen poses, growing young and zooming cheap. Close up it's painted at one size, `FUR_MOST` screen pixels,
and stretched past it (`furTop`): the forager's 57 paintings at the doubling above were more than the whole sprite cache,
and a full cache never lets go of the paintings the forager asked for ahead for what it's doing now (`foragerKeep`, `foragerAhead`), nor a friend's on screen (`p.keep`): letting any of them go, or emptying the cache, had it stand stuck in a pose as each came back and filled the cache again (2026-10-23). Past them the cache would rather run a little over `SPRITE_BYTES` than paint what's on screen again. In the meadow the paintings are made off the main thread
(fur-worker.js, which loads fur.js; game.js `furReady` asks for them, and shrinking is done on the page once what it's
made from has come). Till a pose comes the animal holds the one it was last drawn in (`shownPose`), or the same at another size or one of its kin stands in (`furKin`), and each look about the
screen is asked for ahead (`furAhead`), so only the first of a look is painted on the page. Without a worker (no
OffscreenCanvas) they're painted on the page, a new pose waiting a frame once the frame has done its painting. The
inspector's portrait is always painted on the page.
On the move their legs go round with the ground they cover (`gaitOf`: a fox trots and gallops four paintings a stride,
its back level at a trot), a rabbit hops in bursts, drawn a little ahead of or behind the sim along its way and
stopping between hops (`hopSurge`), and up to 2x everything is drawn between the sim's last two ticks (`drawnAt`,
`keepLast`). No bubbles stay over the animals: when one starts something worth seeing (spots a fox, runs, chases,
courts) a little bubble pops up and fades (`drawPops`, `POPS`), at most 3 at once, love only for the one followed.

## sim.js

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
The forager is not a creature, but it is no ghost either: `foragerSign` says how much of it one has noticed, 0 to 1,
from its pace and stealth (sneaking is a creep), the ground it's on (wading splashes, ice rings, snow crunches, the woods
hide it), the weather's sight, the animal's own `SPECIES[..].spook`, shorter asleep or head down, and `c.trust`. A rabbit
that notices it stops to watch (`alarm`) and keeps off the spot (`wary`), but gets back to its grass after a look
(`WATCH_GAP`); one with it too close bolts: `frighten` sends it running as from a fox, and it thumps the warren on its way. A fox is bolder: coming near makes it leave a kill
(`sign` over 0.4) or give up a hunt, and only almost on top of it does it run. Crows on the ground fly up, otters slip
into the water and watch you from there; bees pay you no mind yet. `c.trust` (the inspector's `🫶 Getting used to you`)
grows while an animal has you in sight and calm, shrinks by a fifth when you startle it, and gives up to `TRUST_GIVE` of
its spook range: a day of quiet company makes one quite used to you. Nothing here draws the
meadow's random numbers; a walk about leaves its own chances as they were (only the animals' reactions do, as a fox's
would). A hunt begins with the same two numbers: creep close while it's tame and quiet, and an arrow that misses need only
startle it (`frighten` where it struck) for the flight.

The gentle respawn (`migrate`, four times a day): with fewer than `FEW` of a kind (rabbits times `w.room`), once they've been
few for `COME_AFTER` days, `ARRIVE` more wander in from an edge, and again as long after while they're still few; foxes only
come with `FOX_FOOD` rabbits about, and otters come up the water to a free holt. So neither the foxes nor, later, the
player's hunting can empty the meadow, and a low still shows. Bees come as a wild swarm (see the bees).
