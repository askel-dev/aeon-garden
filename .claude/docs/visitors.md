# Visitors (none come now)

## game.js

Visitors (sim.js `w.visitors`: a hedgehog, a heron, dragonflies, a kingfisher, a skylark) are drawn in with the trees and
animals, painted like them, and the inspector has them (`THINGS.visitor`, `VISITOR_PANELS`). None arrives now: they only
came to the keeper's places, and they'll come back as the cooking game's NPCs. The hedgehog (`paintHedgehog`: walking,
snuffling, curled up asleep; `visitorArt`, `drawVisitor`) fades in and out at the ends of its way (`visitorFade`). The
heron (`paintHeron`, `HERON_POSES`; `heronArt`, `drawHeron`) flies in high and glides down (`heronLift`), wades with rings
round its legs, and splashes where it stabs. Dragonflies, the kingfisher and the skylark are painted in fur.js
(`Fur.painters`: `paintDragonfly`, `paintKingfisher`, `paintSkylark`), at doublings of their size and shrunk between
(`furPaint`, `shrunk`), and in the meadow by the worker as a fox is (`isFur`, `furReady`, `furKin`, `furAhead`). How high
each is drawn is `visitorUp`.

## sim.js

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
