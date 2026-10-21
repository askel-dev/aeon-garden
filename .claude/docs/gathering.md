# Gathering, the satchel, finding things

## game.js

Gathering: a click or a tap on something to gather (`gatherAt`: a hive, a clump of mushrooms, a wild find, a bramble, nettles, a fruit or mast
tree, the garlic, looked for only near the point, the trees through the sim's grid) walks the forager to its near side a reach
away, in front of a tree, a hive or a bramble so it isn't hidden (`goGather`, `standPoint`, `gatherSpot`), and once it's there
(`gatherFrame`) it turns to it, stoops and reaches down (fur.js poses 3 and 4, `fg.pick`, `PICK_MS`), sim.js `gather` takes it, a
"+3 Chanterelles" with its icon floats up from the spot (`pickFloats`, `floatOf`: a pill painted once), it flies into its slot
(`flyToSlot`: one element, the browser's own animation) and the pick sound plays (sound.js `pick`). Hovered with a mouse, a thing
with something to give glows (`GLOW_ART`, painted once, under it; a hive's over its hollow, where the trunk would hide it) with
a hand for the pointer, and its name in the one line over the satchel (`#what`, `hoverSay`); one with nothing says why there
(sim.js `whatThere`), as a click on it does (`say`). The hover is looked up again only when the mouse moves, or every `AIM_MS` while
the camera glides (`hoverFrame`, `aim`). "Satchel's full" says so by the forager and leaves the thing be.
A click or a tap is looked up in one place (`useAt`, then `useIt`; the click, a held press let go, and what a press is on all ask it):
an animal, a fire, the basket or the old stone, or something to gather, as drawn; for a finger each target is at least `FINGER_R` round
(56 px across). Failing those, the nearest of them all within a snap goes (`snapTo` with `all`: `SNAP` px past its glow, `TAP_SNAP`
for a finger, more in reach; `useSpot` is the fire's, the basket's and the stone's), so a near miss isn't a walk past.
A finger has no hover, so standing still a moment (`USE_STILL`) within `USE_NEAR` of something to use (a fire, the basket, the stone,
or what E would pick: `nearPick`) shows it as a mouse's hover does, in `aim` with `aim.close` (`closeBy`): the paler ring round a fire's,
the basket's or the stone's foot (`drawGlow`, `RING_E_ART`) or a pick's glow; the line over the satchel says the name for a torch
("Torch · burning" while it burns well), the basket, the seat log or the nearest thing to pick (its ring says something is there,
not what), for `USE_SAY`, then fading (`USE_FADE`); a fire or the stone is left to its E disc.
A tap on the forager with something to pick there picks it (only one on nothing is the dance's tap, or with a dish in its hand the eat card: "the hands" in `cooking.md`), and a quick tap after a pick,
or onto something to pick, is a tap, never the double tap's zoom (`lastTap.on`): picking a cluster on a phone kept zooming. A press on
something to pick is a tap however long it's held (held past `HOLD_MS`, it runs there, `drag.rush`) and needs a bigger move to become
a drag; a held run let go on something picks it. Playtesters had found a slow tap turning into a sprint past the thing.
Everything drawn over a fire is the fire (2026-10-18: the hint discs and lines were traps — a tap on the breath disc walked the forager away from the fire it was blowing on). Each frame the drawing over a fire records the box it was drawn in (`hintBox`: `promptUi` the disc and its key, `hintLine` a "Needs a stick" line, `blowHint` the breath disc and its "Hold to blow" line, all with the fire they're over), and `hintAt` reads them back as that fire, a fingertip past the edge (`fingerTap`); a tap on one is `hintFire`: a breath if it's being blown on (`puff`), else whatever that disc means (`clickFire`: off to cook, to light, or to hear what the fire wants). Only a tap well off the fire (>3 tiles, in the pointerup that stops a blow) walks away from it.
The queue: while the forager is off to pick something or stooped over it, a click on more lines it up after (`queueGather`,
`ui.queue`, at most `QUEUE_MOST`, in click order), each with a small parchment number over it (`drawQueue`, `badgeArt`, painted
once a number); clicked again it comes off, a click on the ground or holding to run lets the queue go (`walkTo`). Each next one
waits till it's back up from the last (`ui.nextAt`, `nextGather`), and one gone or picked clean meanwhile is passed over.
E does the nearest thing to the forager, by the tiles between them, in one race (`eTarget`, `eLook`): the old stone, the camp's
basket or the seat log (within `USE_REACH`), a fire to cook at or light or a torch to relight (within `PROMPT_NEAR`), or
something to pick (`nearPick`, within `NEAR_REACH`); the camp's fire is in it from anywhere in the ring (`campFire`) when
nothing is nearer. The
same answer puts the disc over a fire in reach and over the stone, and the E in the line over the satchel on a keyboard, so
what's shown is what E does (2026-10-20: the fire used to win anywhere in camp, taking E from the basket and from what lay at the
forager's feet). Pressed again while it's busy picking, the next nearest lines up (`pickNear`); with nothing in reach it says so.
A fire's cooking card shuts with E, as a basket's card does, when one is open.
E walks to a lit fire within `PROMPT_NEAR` (`cookFire`) and opens its cooking card as a click on the fire does, and shuts it
again. The moment it takes
(`lit`, the kneel watching the flame catch) is no exception (`fireFree`): the flame with its E is already painted, and E there
opens the card at once — it used to fall through to the picking and say there was nothing in reach till the kneel was up. By a
fire that's burnt down or gone cold that the satchel can see to (`relightFire`, `fireKind`), E relights it as a click does (a
stick, tinder, a strike, then hold F to blow), and a little painted flame with an E bobs over it (`drawCookPrompt`,
`PROMPT_RELIGHT`; a click on it is one on the fire).
In reach: everything to pick within `NEAR_REACH` of the forager, the sticks, grass and bark for a fire too, has a soft honey ring
lying round its foot (`drawNear`, `RING_ART` painted once), steady, fading out over `NEAR_FADE` at the edge, brighter on what's
queued. That's what tells a dandelion from the other yellow flowers and dry grass from the tufts (playtesters couldn't).
One tell for what you can use, standing still (2026-10-18; the comment over `USE_RGB`): under the camp's basket, every fire, the
old stone and each hive oak lies the same faint cream ring of trodden earth (`drawUseRing`, `useRingArt`: `USE_FIRE`,
`USE_BASKET`, `USE_STONE`, `USE_HIVE` are its half widths, sized to just outside what's painted at that thing's foot), drawn in the same pass as the soft shadows and over them, so it reads as ground anywhere, and never in the ground layer
(`drawGround`), so snow can't bury it — through snow it warms and brightens instead (`USE_SNOW_RGB`). Painted once a size and
snow step (`useArt`, stretched to the size asked for), static and the same everywhere, no pulse and no glow: it has to be
world, not UI. It goes on from `itemOf`'s `it.ring`, which is 0 by default, so a ghost of a fire or a basket being placed
gets none, and the gatherables keep their glints alone — a ring always means "you can use this".
Finding things: what has something to give (sim.js `eachPickable`, listed every `PICKS_MS`: `picksFrame`) glints now and then
over its `gatherSpot`: a small honey bloom with a warm point of light and four fine rays, painted once (`GLINT_ART`), that comes up
quickly, fades slowly and turns a little as it goes, each thing on its own clock from a hash of where it is (`glintAt`,
`GLINT_EVERY`, `GLINT_MS`), so one or two on screen at a time; a picked clean tree or an unripe bramble isn't listed, so it
doesn't. Warm, not white, so it shows on snow and isn't taken for a snowflake. Standing still `SENSE_STILL` (not walking or off
to pick), the forager senses what's about: everything within `SENSE_REACH` glints once, `SENSE_BIG` bigger, as a wave reaches it
outward from the forager over `SENSE_SPREAD`, with a faint ring going out (`MARK_ART`) (`senseFrame`, in `drawGlints`). With
nothing to pick on screen for `ARROW_WAIT`, a small parchment disc sits at the screen's edge where the way from the forager to
the nearest leaves it, a brass point on it turned that way and the thing's satchel painting in it (`ARROW_ART`, `itemSheet`'s
bitmap, `drawPickArrow`), and fades as one comes into view. It was too easy to miss when small and still, so it pops in a
little bigger (`ARROW_POP`), nudges toward the thing, and sends a soft honey ring out every `ARROW_PING` (`RING_ART`). It keeps clear of the watch, the pill and the satchel by their places,
looked at once a second (`KEEP_CLEAR`). Once there's a camp, the same disc with a little campfire in it (`CAMPMARK_ART`) always
points home while the camp is off screen (`drawCampMark`, `campMark`), calm (a slow warm glow, no pop or rings). Playing together,
each friend off screen has one too (`drawFriendMarks`): its forager's face in it (its standing painting from the front at one size,
`FRIEND_FACE`: its cloak, sad when it's cold, eyes shut when it's down) and its name under it (over it on the foot). All find their
spot with `edgeAt` and slide along the edge out from under the ones laid before them (`edgeApart`: home, friends, then the pick
marker), and keep over the satchel and its bars. All drawn over the dark, a little dimmer at night. Cost: nothing you can measure (render
at the widest zoom, walking, summer and winter, against the meadow before them).

The satchel (`#satchel`, `renderSatchel`, rewritten only after a pick or a drop): `S.SLOTS` small parchment slots at the bottom in
the middle, a slim faint row while it's empty. Their paintings are one sheet painted once (`itemSheet`, `--items`): items.js's paintings of things
picked (`'ingr:'`: every ingredient so far, the fruit, honeycomb, nuts, flowers and what lies about for a fire too), over the
meadow's own painting of it (`ITEM_ART`), which a new ingredient keeps till items.js paints it; one with neither gets its
recipes.js emoji. Each is clipped to its own square in the sheet (`ITEM_FILL` scales one up). A tap on a slot opens nothing, but a full one can be dragged (`setupSatchel`): its painting follows the pointer (above a finger), let go on another slot it goes there (sim.js `moveSlot`: onto a stack of its kind, or the two swap), let go off the satchel it is dropped (sim.js `dropSlot`): it flies down to just in front of the forager and lands with a little bounce (`dropLand`), and lies there looking like something to pick (`drawDropped`, `dropPx`, `dropArt`: a find in the meadow's own painting at its size there, a little smaller, `DROP_FIND`; anything else in its satchel painting at about that size, `DROP_PX`), with the same warm ring in reach as a find (`drawNear`, `nearRing`) to be picked up again like a find (`'dropped'` in `gatherAt`, `gatherSpot`), fading over its last `DROP_FADE` till it's gone. On a touch screen each slot is 44 px or more, and upright the satchel steps aside while the
inspector's sheet is up.

## sim.js

Gathering (`whatThere`, `gather`) takes from the sim for real, with no random numbers: a clump of mushrooms picked is gone
(all its caps; only part if the satchel is nearly full), a patch of greens gives `GREEN_GIVES` (one more off a big patch) and
`GREEN_TAKE` of itself, growing back `GREEN_REGROW` a day (`g.pick`, in `greensTick`), a ripe bramble `BERRY_PICK` blackberries at
`BERRY_COST` each off `b.berries` (so fewer for the crows and foxes, who leave little by early autumn), a cherry tree `CHERRY_PICK`
from the start of summer to `CHERRY_TO` into it, `CHERRY_CROP` a summer (two fifths of that with no bees: `d.picked`, `d.pickYear`),
an apple, oak or beech up to `FALL_PICK` of its windfalls (`d.windfall`, the rabbits' too; `FALL_GIVES` each), a wild find all of it
(as a clump of mushrooms), and a hive `HONEY_GIVES` honey for `HONEY_TAKE` of its store, never taking it below `HONEY_KEEP` (by
season: low in spring, when the bees live on nectar, so a meadow's first hives, starting with `HIVE_HONEY` 50, give a few picks
each; from autumn more than a big colony eats in a winter). Taking every pick every hive in the meadow could spare, every game
hour, came to about 90 honey in the first week and 130–270 in its first year (10-21; it was 15 and 50, too hard to get), and over three
years starved no colony that wasn't one moving out in autumn with little honey (`hiveMoves`). `eachPickable` lists everything with something to give now (game.js's glints and arrow, and counting). `whatThere` also says gently why not ("Not ripe yet", "Picked clean"...). What's picked goes
in the satchel (`w.forager.bag`, `bagN`: `SLOTS` slots, `STACK` of a kind to one; `stow`, `roomFor`, `dropSlot`), kept with the meadow. What's dropped lies on the ground (`w.dropped`, `dropOf`; dropped on a pile of its kind it goes on it) for `DROP_DAYS` (three days, thirty-six minutes at 1x), or till deep water comes over it (`droppedTick`). A pick of greens, berries, cherries, windfalls or honey gives half to one and a half times `whatThere`'s n, more by the Gathering level (`yieldOf`, perk `yield`, hashed from place, tick and practice: no meadow random numbers); the meadow loses what that many cost (`takeFrom`'s `give`), and practice is `GATHER_PRACTICE` for each thing that goes in. Picking one's own back up takes no Gathering practice (`gather`): it was practised when it was first taken from the meadow, so a thing can't be set down and picked up again for a level.
No `KEEP_VERSION` bump: the new fields are in the blanks (`foragerOf`, `greenOf`, `blankTree`).
