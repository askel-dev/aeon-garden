---
paths:
  - game.js
  - index.html
  - fur.js
  - fur-worker.js
---

# game.js

Drawing, the camera, the inspector. The world fills the screen; over it only the watch, a small pill top right
(pause, sound, •••), a toast line (`toast`, for a copied link or an idea that couldn't go) and the inspector. The old
watching game's cards, news feed, stats, journal, tools, intro and idle camera were cut on the `cooking` branch
(main at 1d79f03 has them).

The forager (sim.js `w.forager`; how it walks is in ecology.md) is painted in fur.js like a fox (`paintForager`,
`foragerPose`, `foragerParts`: a rust hood with a flopping point, a round face, a moss cloak, mittens, a satchel, boots), in
three views (side on, three-quarters from the front and the back, all facing left and mirrored going right) and eight
paintings a stride, plus standing, a fidget and a blink: 'forager:' + (view << 4) + pose, painted by the worker
(`foragerAhead` asks for every one at the size it's drawn, so a walk never waits). Its feet are where it is. game.js
(`foragerFrame`, once a frame) turns the stride over with the ground it covers (a stride every `2 * FORAGER_REACH * 2` of its
half-size, so the planted foot doesn't slide; fur.js `FORAGER_REACH`), picks the view from the sim's heading with a margin
either side so it doesn't flicker, and standing lets it breathe, blink, turn to face you after `FORAGER_TURN_MS` and fidget
now and then (`FORAGER_FIDGET`). In the shallows it's cut off at its shins with a ring round its legs, and each step sends out
a ring (`fg.rings`). Its shadow goes in with the animals' (`foragerShadow`). `forager-lab.html` paints them all side by side.
A click or a tap on an animal (on its body as drawn: `animalAt`, a little wider for a finger) opens its panel and follows it;
anywhere else walks the forager there (`walkTo`, sim.js `foragerTo`), shuts the panel and puts the camera back on it, with a
soft ring where it was sent (`drawMark`, `MARK_ART` painted once) that fades once it's there. A press held still for
`HOLD_MS` runs toward the pointer while it's down (sim.js `f.running`, `FORAGER_RUN`; Shift held runs too, `holdShift`), the
way found again every `STEER_MS` (in `frame`), and on to where it's let go. Running, its stride is `FORAGER_RUN_STRIDE` longer. The camera goes with it (`ui.lead`, `leadCam`): eased after it (`CAM_FOLLOW`), a little ahead the way it walks
(`CAM_AHEAD`, itself eased so setting off and stopping are soft), its feet a little below the middle (`CAM_FEET`). A drag or
a pan lets it go, F or the next walk takes it back; the wheel zooms about the forager while the camera's with it. A kept
meadow keeps where it is and whether the camera was with it (`rec.lead`).
Gathering: a click or a tap on something to gather (`gatherAt`: a hive, a clump of mushrooms, a bramble, nettles, a fruit or mast
tree, the garlic, looked for only near the point, the trees through the sim's grid) walks the forager to its near side a reach
away, in front of a tree, a hive or a bramble so it isn't hidden (`goGather`, `standPoint`, `gatherSpot`), and once it's there
(`gatherFrame`) it turns to it, stoops and reaches down (fur.js poses 3 and 4, `fg.pick`, `PICK_MS`), sim.js `gather` takes it, a
"+3 Chanterelles" with its icon floats up from the spot (`pickFloats`, `floatOf`: a pill painted once), it flies into its slot
(`flyToSlot`: one element, the browser's own animation) and the pick sound plays (sound.js `pick`). Hovered with a mouse, a thing
with something to give glows (`GLOW_ART`, painted once, under it; a hive's over its hollow, where the trunk would hide it) with
its name by it and a hand for the pointer; one with nothing says why (sim.js `whatThere`), as a click on it does (`say`). The hover
is looked up again only when the mouse moves, or every `AIM_MS` while the camera glides (`hoverFrame`, `aim`). "Satchel's full"
says so by the forager and leaves the thing be.
The satchel (`#satchel`, `renderSatchel`, rewritten only after a pick or a drop): `S.SLOTS` small parchment slots at the bottom in
the middle, a slim faint row while it's empty. Their paintings are one sheet painted once (`itemSheet`, `--items`): the meadow's own
mushrooms, greens and windfalls (`ITEM_ART`) and `paintItem` for the blackberries, cherries, honeycomb and beechnuts; an
ingredient with no painting gets its recipes.js emoji. A tap on a slot shows its name with Drop over it (`openSlot`, `#slot-tip`),
and Esc or Back shuts it (`stepOut`). On a touch screen each slot is 44 px or more, and upright the satchel steps aside while the
inspector's sheet is up.

The inspector shows animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water,
visitors): each kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows. A tap
on an animal follows it (`select`, `ui.follow`). Animals can't be named by the player. Every animal of a kind is alike
(sim.js has no genes, only a rabbit's winter coat), so an animal's panel is its mood, tummy, family and life story (a rabbit's
with its coat and how well it hides where it sits, `coatLine`), and a hive's its honey (`honeyWord`), its queen
and the fields in reach; a hive goes by the field nearest it, a swarm by its queen (`hiveName`). A hanging swarm is drawn as a
seething clump under its branch (`drawSwarm`) and picked where it's drawn (`hiveAt`); remains have a panel too (`THINGS.remains`).

Mushrooms (sim.js `w.shrooms`) are painted once a look and size (`paintShroom`, `SHROOM_ARTS`: five kinds, three looks each,
a look being how many caps): ceps, chanterelles and field mushrooms in a clump on the ground, oyster mushrooms and chicken of the
woods as lobed brackets in tiers (`paintShelves`), out of a log's side and up a snag's trunk (`placeShroom`, `SHROOM_LOG`,
`SHROOM_SNAG`). They're drawn with the trees and animals, back to front (a frame item's `s`), come up in three steps over
`SHROOM_GROW` of a day and fade as they go over (`SHROOM_OVER`). Their panel (`THINGS.shroom`, before the trees so one at a
tree's foot is picked first) has the painting for a portrait (`shroomFace`: the 🍄 emoji is a fly agaric), where it grows and
why (`richWhy`: remains, a warren, a holt), what the cook would make of it (`SHROOM_COOK`) and how fresh it is; a tree's panel says
when there are mushrooms under it or on it.

Spring greens (sim.js `w.greens`) are painted once a look and size too (`paintGreen`, `GREEN_ARTS`: kind, stage from sim.js
`greenStage`, and two looks): wild garlic a carpet of broad leaves (`paintGarlic`), white starry heads in flower, yellowing as it
dies back, drawn flat under all that stands (`drawGarlic`, after the remains); nettles a stand of stems with toothed leaves
(`paintNettles`), young tops reaching up, drooping and strung with flowers in summer, brown in autumn, drawn with the trees and
animals (a frame item's `s`, like the mushrooms). They fade in as they come up and out as they go (`greenFade`), and a patch
grows with `g.size`. Their panel (`THINGS.green`, after the trees and rocks, since the garlic lies under them) has the painting
for a portrait (`greenFace`), when to pick them, why they grow there and what the cook would make of them.

Brambles (sim.js `w.brambles`) are painted once a look and size too (`paintBramble`, `BRAMBLE_ARTS`: eight stages and two
looks): a low mound of leaves of three or five toothed leaflets (`brambleLeaf`) over the shade inside it, with purple canes
arching out of it to the ground at its sides and a couple over the top; in winter only the tangle of canes and a few dark
leaves. Pale flowers early in summer, then berries (`brambleBerry`): green and red, ripe and black in three paintings by what's
left on it (`brambleArt`: more than 0.6 of its crop, more than a quarter, fewer), and shrivelled among red leaves as it goes over.
Drawn with the trees and animals (a frame item's `s`), bigger each spring (`b.size`). A crow eating from one is in `CROW_PECKS`.
Its panel (`THINGS.bramble`, before the trees) has the painting for a portrait (`brambleFace`), the stage, a berries meter while
they're ripe, how it came there (a crow's pips, a cane rooted, the wood's edge), what the cook would make of them, the crows
and foxes eating off it, a rabbit hiding in it, and the bees at its flowers. A bee on its blossom sits on the mound (`liftOf`,
`bramblePx` times the spot's `up`); a fox at the berries has its 'feed' pose, a rabbit in the thorns its 'alarm' one.

Foxes and rabbits are painted (fur.js: `paintFox`, `paintRabbit`): one rig posed for
what each is doing (`FOX_POSES`, `RABBIT_POSES`, picked by `foxArt`, `rabbitArt`), painted as one animal by `paintFur`
(one shading over it all, each part's form and the markings soft, a part in front casting a soft shadow, a softened
outline and a faint grain), so its parts don't read as separate shapes. Every rabbit wears the wild coat (`COAT`; fur.js can
still paint the sandy, black and blue-grey ones), and in winter whitens as far as its moult takes it (sim.js `whiteness`) in 5
steps (`whiteStep`): only the brown and the white are painted, the steps between are the two mixed (`paintRabbit`, `furReady`).
A fox wears its own shade (`c.fur`). A dead rabbit white for winter lies white (`remainsLook`, `BODY_COATS`). A painting
is costly (each pass through the scratch layer is a flush), so parts can share one (`joined`) and the parts behind are
just shaded (`flat`). It's painted only at doublings of its size (`FUR_PAINTED`) and shrunk for the sizes between,
which keeps a dozen poses, growing young and zooming cheap. In the meadow the paintings are made off the main thread
(fur-worker.js, which loads fur.js; game.js `furReady` asks for them, and shrinking is done on the page once what it's
made from has come). Till a pose comes the animal holds the one it was last drawn in (`shownPose`,
as a tree's new colours do), or the same at another size or one of its kin stands in (`furKin`), and each look about the
screen is asked for ahead (`furAhead`), so only the first of a look is painted on the page. Without a worker (no
OffscreenCanvas) they're painted on the page, a new pose waiting a frame once the frame has done its painting. The
inspector's portrait is always painted on the page.
On the move their legs go round with the ground they cover (`gaitOf`: a fox trots and gallops four paintings a stride,
its back level at a trot), a rabbit hops in bursts, drawn a little ahead of or behind the sim along its way and
stopping between hops (`hopSurge`), and up to 2x everything is drawn between the sim's last two ticks (`drawnAt`,
`keepLast`). No bubbles stay over the animals: when one starts something worth seeing (spots a fox, runs, chases,
courts) a little bubble pops up and fades (`drawPops`, `POPS`), at most 3 at once, love only for the one followed.

Visitors (sim.js `w.visitors`: a hedgehog, a heron, dragonflies, a kingfisher, a skylark) are drawn in with the trees and
animals, painted like them, and the inspector has them (`THINGS.visitor`, `VISITOR_PANELS`). None arrives now: they only
came to the keeper's places, and they'll come back as the cooking game's NPCs. The hedgehog (`paintHedgehog`: walking,
snuffling, curled up asleep; `visitorArt`, `drawVisitor`) fades in and out at the ends of its way (`visitorFade`). The
heron (`paintHeron`, `HERON_POSES`; `heronArt`, `drawHeron`) flies in high and glides down (`heronLift`), wades with rings
round its legs, and splashes where it stabs. Dragonflies, the kingfisher and the skylark are painted in fur.js
(`Fur.painters`: `paintDragonfly`, `paintKingfisher`, `paintSkylark`), at doublings of their size and shrunk between
(`furPaint`, `shrunk`), and in the meadow by the worker as a fox is (`isFur`, `furReady`, `furKin`, `furAhead`). How high
each is drawn is `visitorUp`.

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
nearly 2000). An emoji tree keeps the old tumbling ovals (`drawFallingLeaves`).

The meadow is kept in the browser when the page is hidden or closed (`keepMeadow`: IndexedDB, under its link, the last
`KEEP_MEADOWS`), never on a timer while someone watches (a save is a few frames). The next visit opens it where it was
(`resumeWorld`): the bare address the one watched last, a `?seed=` link its own. A kept meadow that won't open, or broke
the page the last time it opened (`OPENING`), is let go. The ••• menu shares the link (a phone's share sheet) and takes
ideas (the `#ask` card, also once by itself after two minutes of play: `askTick`). Visits are counted by GoatCounter
(`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the page `/meadow` whatever the seed, and a link posted with
`?ref=reddit` says where they came from.

On a phone (and Back anywhere): Back steps out of what's open as Esc does (`stepOut`: a card or menu shuts, the inspector's
open sheet folds and then shuts). Each thing open holds a step in the history, counted, not named (`opened`), and
`syncBack` levels the history with what's open after every tap or key: pushed only inside a tap, as Safari skips a step a
page adds outside one. The inspector's sheet follows the finger and settles open, folded or away by where and how fast
it's let go (`sheetLetGo`). A double tap zooms in on the spot, a double tap held and dragged zooms as it goes, and two
fingers tapped zoom out (`zoomTo`, `zoomDrag`, as Google's and Apple's maps do); a tap that would only put the inspector
away waits `DOUBLE_MS` in case it's the first of two (`tapAway`). On a touch screen the screen stays awake while time
runs, till nobody has touched it for `WAKE_MS` (`wakeTick`, the Screen Wake Lock API).
