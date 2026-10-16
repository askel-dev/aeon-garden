---
paths:
  - game.js
  - index.html
  - fur.js
  - fur-worker.js
---

# game.js

Drawing, the camera, the inspector. The world fills the screen; over it only a small pill top right
(pause, sound, •••), a toast line (`toast`, for a copied link or an idea that couldn't go) and the inspector. The old
watching game's cards, news feed, stats, journal, tools, intro and idle camera were cut on the `cooking` branch
(main at 1d79f03 has them); the pocket watch that told the day and the year went later (git history before its removal).

Headlines (`announce`, index.html `#announce`): big Fraunces italic words over the meadow with no card, under the toast,
fading in and out, clicks going through. The old watching game's daybreak lines brought back (cut in da8079b): each new
day at sunrise (`daybreakTick`, with `morningWord` when the morning is frosty or wet), a new season bigger with what it
brings (`SEASON_LINES`, hand-written: keep them true to sim.js's seasons), where we are a moment after a meadow opens, a
friend's meadow as you join, and the first of anything in gold between ✦s (`firstTime`, kept across meadows in
`aeon-garden-firsts`; a first find says its recipes.js `text`). One at a time: the rest wait, except a day's line, which
is dropped. None while a card is open or the forager is down. The first fire and the first dish go through `firstTime`.

The forager (sim.js `w.forager`; how it walks is in ecology.md) is painted in fur.js like a fox (`paintForager`,
`foragerPose`, `foragerParts`: a rust hood with a flopping point, a round face, a moss cloak, mittens, a satchel, boots), in
three views (side on, three-quarters from the front and the back, all facing left and mirrored going right) and eight
paintings a stride, eight more jogging for the sprint, plus standing, a fidget and a blink: 'forager:' + (outfit << 7) + (view << 5) + pose, painted by the worker
(`foragerAhead` asks for every one at the size it's drawn, so a walk never waits). Its feet are where it is. game.js
(`foragerFrame`, once a frame) turns the stride over with the ground it covers (a stride every `2 * FORAGER_REACH * 2` of its
half-size, so the planted foot doesn't slide; fur.js `FORAGER_REACH`), picks the view from the sim's heading with a margin
either side so it doesn't flicker, and standing lets it breathe, blink, turn to face you after `FORAGER_TURN_MS` and now
and then do something (`IDLES`, `idleOf`; the player's and each friend's): look up, glance to either side, peek in its satchel,
tap a foot, hum swaying with its eyes shut (`HUM_SWAY`, in `drawFigure`), and after `IDLE_LONG` stretch with a yawn or wave
at you. Those are fur.js `FORAGER_IDLE`, painted from the front only and kept as 'view' 3 of the key (`poseKey`). In the shallows it's cut off at its shins with a ring round its legs, and each step sends out
a ring (`fg.rings`). Out of the water each foot down leaves a footprint (`footprint`, `drawPrints`: a ring of `PRINTS` in typed
arrays, one soft sole painting turned along its way and laid flat, under everything that stands) that fades by the ground under it
(`PRINT_GROUND`: soon in grass, slowest in snow, blue there; none on ice), on a clock that stops while paused. Its shadow goes in with the animals' (`foragerShadow`). A tree standing in front of it (drawn after it, its painting's box over its body) fades to `SEE_A`, as in Project Zomboid, eased over `SEE_MS` (`seeThrough`, `fgBody`). What's drawn after all the trees (the fireflies, the leaves
coming down, pollen, butterflies, splashes, the effects, the burrows' 💤) hides behind a leafy crown standing in front of it
(`coverAt`): each crown drawn is kept as its kind's outline (`CROWNS`, `addCover`) in a coarse grid of the screen made once a
frame (`buildCover`), soft at the edge (`COVER_EDGE`), half for first leaves or half fallen, nothing bare, and as little as
it shows when faded (mist, the forager behind it). Pop-ups, labels and the selection stay on top. `forager-lab.html` paints them all side by side (`?o=` an outfit). Its outfit is a cloak and a hat
(fur.js `FORAGER_CLOAKS`: cloak, hood, rim; `FORAGER_HATS`: the hood's own point, a bobble, fox ears, a toadstool cap, a wanderer's
felt hat with a feather, a crown of flowers, melted cheese sliding down over the hood, painted in `foragerParts`' `hat`), painted as one outfit
(`FORAGER_OUTFITS`, `outfitOf`: hat * cloaks + cloak, so the key and what goes over the net are one number). Picked on the
wardrobe card (`wardrobe`, `#wardrobe`: the forager painted as it'll look, a row of painted heads in each hat, cloak swatches, a
die, and the name while playing together), tried on there and worn only on its button: before going into a friend's meadow
(`begin`: 'join', in the middle over a dimmed meadow, it takes a name and can't be put away; nothing's said to the room till
Set off), as you first open yours to friends ('host', from `together`), as a new meadow opens till one's been picked, and from
••• ('dress'). Up top on a touch screen, out of the keyboard's way. Kept in localStorage apart (`aeon-garden-outfit` the cloak,
`aeon-garden-hat`, `aeon-garden-name`), so a new cloak or hat goes at the end of its list.
Emotes (`emote`, the comment over `EMOTE`): the dance and the sneak. (They used to be asked for by 1 and 2 or the round button on
the satchel's other side from the fire's: `#emote`, `emoteMenu`, `emoteIcons`, `emoteShown`; button, keys and fan are gone, and
`emote` is left as the workings behind them.) Painted in fur.js (`FORAGER_EMOTE`, `emotePose`, kept after all its other paintings:
`emoteArt`), asked of the worker only while one is on, and kept in the cache only while one is on (`keptForager`). The dance is
NLE Choppa's as the Roblox emote does it (Axel's reference was a screen recording of it; two tries at his real-life dances,
front-on kicks and then a noodle bounce, didn't read): it turns on the spot a sixth of a turn a step (`DANCE_TURN`, through the
views and mirrored, so `b.view` and `b.flip` move while it dances), each beat a head-bang down into a deep hunch, eyes squeezed
shut, and a spring up onto one foot with the other heel kicked up behind, tongue out, the feet taking turns (`DANCE_SEQ`; fur.js
`dancePose`, painted from all three views). The spring hops (`b.lift`, `DANCE_HOP`, in `drawFigure`), a stomp sound at each hunch; it dances till it's sent somewhere. The
sneak is a devious walk side on (`sneakPose`): crouched, the cloak hitched up, tiptoeing with the near knee lifted over the cloak,
mittens out like little claws, a sly lid and brow and a smirk; slower (sim.js `f.sneaking`, `FORAGER_SNEAK`, stride
`SNEAK_STRIDE`); asked for standing it creeps `SNEAK_GO` tiles the way it faces, every walk after is a sneak till it sprints,
stands still `SNEAK_REST` or you ask again, and standing it lurks rubbing its mittens. Both on the page's clock (not faster at
speed), stopped while paused; a friend sees them (`sendPos`'s `em`, `et`).
Its body (sim.js `bodyTick`) shows on it first (`drawBody`, `shiverOf`, `drawFallen`): a shiver is a short sway of
its body about its planted feet, eased in and out, with a soft chatter (sound.js `shiver`): now and then chilly, more often
the colder (`SHIVER_EVERY`), freezing a faint tremble between (`SHIVER_STEADY`). From cold (`FORAGER_SAD`) it hugs itself,
standing and walking, sad (worried brows, a frown, a red nose: fur.js `FORAGER_COLD`, poses 5 to 7 and 24 to 31, asked for
ahead once it's chilly; the sprite cache keeps only the set in use, `keptForager`), and hunched (`HUNCH`); standing it sighs
now and then (sound.js `breath`). Freezing, frost at the screen's corners and edges (`#frost`,
CSS gradients only, shown only then) and a soft heartbeat (sound.js `heart`, `HEART_MS`); a stumble pitches it forward. In air under
`BREATH_AIR` its breath puffs from its mouth (`BREATH_AT`, by view, drifting the way it faces; `PUFF_ART`, painted once), soaked it drips off its hem, now and then a drop you hear (sound.js `hemdrip`). Out of breath it pants (`pantFrame`, sound.js `pant`, one a breath every `PANT_MS`: quick and hard when spent, slower and softer as it comes back, from `PANT_LOW` already while sprinting) till it has `PANT_DONE` back, then a phew (sound.js `phew`). Two slim bars over the satchel
(`#vitals`, `renderVitals`, in the 250 ms block, rewritten only on a change): warmth (amber to ice blue, a drop by it while wet) and
stamina (amber and pulsing while winded), each shown only while not full. Collapsed it tips over (`FALL_MS`) with its eyes shut (pose 7), the screen goes dark
(`#veil`, `DARK_AFTER`), and `bodyFrame` runs the sim `SKIP_MS` a frame till it wakes at home (`bodyWoke`: the camera there at
once, a toast, three soft notes: sound.js `wake`). Out of breath (`f.winded`) a press, Shift or a held run only walks it.
A new meadow opens like a film (`startIntro`, `#intro`): black bars top and bottom from the first frame, the rest of the page
away (`body.intro`), "Nobody's Meadow" and "Spring · late afternoon" fading in and out in the lower bar (`INTRO_NAME`), the
camera craning down onto the forager from `INTRO_WIDE` of its zoom and `INTRO_RISE` tiles up over `INTRO_CRANE` (`introLeft`,
in `leadCam`), then the bars slide off at `INTRO_MS` and the page fades back, the cloak's card after it if one's still to pick.
A key cuts it short and does nothing else (a capturing listener); a click or a tap does nothing at all, the bars go on their own clock; a kept meadow and a friend's (`heardWorld`)
open without it. The zoom moves through it, so the ground repaints those few seconds, with nothing else going on.
A new meadow opens in a storm late in the afternoon (sim.js `START_PHASE`) that holds till the first fire is lit, drawn
heavier than other storms (`GALE_LOOK`: the storm's share of the sky's mix goes over 1): a moment after it's on screen (`OPENING_MS`) the
forager says to itself what it needs, "It's freezing. I need a fire before dark." (`openingLine`, `OPENING_LINE`; in the intro at `INTRO_LINE`), in a bubble over
it as a line of chat is (`myChat`), in italics (`chatArt`'s `thought`; a `\n` in the game's own words breaks the line there). A
friend joining during the opening storm hears it too (`heardWorld`), and the storm blowing over brings the rainbow as any rain does.
The campfire (sim.js `w.fires`; its rules in ecology.md; the long comment over game.js's `FIRE_SIZE` has it all): a round fire
button by the satchel (`#build`, `renderBuild`; 50 px above the satchel on a touch screen) with a ring filling in as the satchel
holds what recipes.js `BUILDS.campfire` takes (6 pebbles, 5 sticks, 2 tinder); a tap or F picks a spot (`ui.place`, a faint fire
following the mouse, within `PLACE_REACH`; sim.js `fireSpot` says why not). The forager kneels side on (fur.js `FORAGER_KNEEL`,
`KNEEL_VIEW`), lays it a piece at a time (`LAY_STEPS`), strikes (`STRIKES`), and you hold (mouse, finger or F: `blowHeld`) to
blow till it catches (`blowFrame`, `BLOW_S`, longer in the wet); let go too soon and it only smokes. A click on a fire sees to it
(`clickFire`: a stick on, a stick and a blow on embers, tinder and a strike when cold), standing still by a lit one it kneels and
warms its mittens (`SIT_MS`; from the fire's side, `STAND_OFF`, stepping out to it first if it's standing nearer), and a hover
says how it is (`fireWord`). Drawn with the trees and animals (`drawFire`: `paintFire` once a look and size, `FIRE_ARTS`; flames
as `TONGUES` of one painting; smoke), its glow, embers and sparks over the dark
(`drawFireGlows`). Its light (`lightsFrame`, at most 4 fires, out to `LIGHT_TILES`, flickering in `FLICKER_MS` steps) is cut out of the night on the sky's
picture (`SKY_FIRE`, `paintFireLights`: so the sky repaints only on a flicker step) and laid warm over what stands near it
(`fireLight`, source-atop, kept soft so the forager by it isn't washed out). Nights are dark (`DARK` 0.88 of a deep navy
`NIGHT_RGB`, 2026-10-15) so the fire is the cosy place. Friends see fires laid, fed and lit (`sendFire`). Sounds: sound.js `clack`,
`stick`, `tinder`, `strike`, `blow`, `kindle` (`catch` is the fox's), `fizzle`, and a crackle near a burning one (`fire` in
`Sound.update`). Cost: none measurable (1440x813, zoomed out, a summer night in the rain, walking: about 1.0 ms of script a
frame with a fire and without, 60 fps).
Making camp (sim.js `w.camp`, event 'camp': the first fire lit) is a moment (`campMoment`, the comment over
`CAMP_FLARE`): the flames flare (`fireShown`), the light blooms out (`lightsFrame`) with a warm glow, two fountains of sparks,
twinkling stars, a wave of light out to the ring and motes rising off it (`campBurst`, in `drawFireGlows`; `CAMP_PARTY_MS`), a felt-piano flourish (sound.js `camp`), the camera eases in and leans to the fire and back
(`campCam`, in `leadCam`; a zoom of your own ends it), "Your camp" pops in, glowing between two twinkling ✦ (announce 'camp', which cuts in ahead of the others; index.html `camp-pop`)
and an Android phone buzzes (`CAMP_BUZZ`). Then a soft ring of trodden earth with a few stones lies round the fire (`drawCampRing`,
`CAMP_ART` painted once, stretched; under all that stands), coming in over `CAMP_RING_MS`. The fire's hover calls it "Your camp".
Cooking at the fire (PLAN.md stage 6 and its redesign; the long comment over `COOK_MS` has it all): a click on a lit fire (or E,
or the pot prompt) walks the forager there (`clickFire` 'cook', `goFire`), it kneels, the camera eases in and leans to the fire
(`cookCam`, in `leadCam`: `COOK_ZOOM`, `COOK_LEAN`), and a painted iron pot sits over the flames (`drawPot`, `paintPot`: 'pot:0'
the back and inside, 'pot:1' the belly, what's in it drawn between; drawn after all that stands, so nothing hides it). A tap on
a satchel slot or a slot dragged onto the pot (`overPot`) puts one in (`potAdd`; a stick goes on the fire): it flies there
(`flyToPot`) and drops in with a bounce and a puff (`j.land`, `LAND_MS`), held back in the satchel (`potHeld`, `potPrune`) till
cooked; a tap on it in the pot takes it out (`potThingAt`, `potTake`). Under the fire a small bar (`#cook`, `renderCook`, kept by
`placeCook`: under the fire, else over it, else beside it on a phone on its side): what the pot will make (`potWord`: a known
dish's name, "Something new!" for an exact dish never made, "Not a dish yet… as it is, a forager's mess" with what a known dish
it's near still wants, `potToward`, or "Only a forager's mess", `potPossible`), the stick wearing the fire's fuel as a ring
(`cookFuel`; F feeds it too, `buildPressed`), the recipe book, Cook, and a round brass ✕ 44 px on every screen. With the pot
empty the last dish comes back as a one-tap "again" (`lastDish`, `cookAgain`, `fillPot`). While it's up the satchel rings what
will go in and dims the rest (`.cooking`, `.cookable`, `.cook-dim`). Cook: `COOK_MS` of stirring with the things bobbing and
steam off the pot, then `cookDone`: the things out, the dish in (flying from the fire, or on the ground with the satchel full),
a mess a puff of dark smoke, a dish never made before its gold headline (`firstTime('dish:' + name)`, which `knownDish` reads
with recipes.js `known`). Walking off, ✕, Esc or Back leave the fire (`closeCook`, `stepOut`); nothing is lost mid-cook.
The recipe book (`#book`, `renderBook`, `#book-btn` by the satchel's right end, B, and on the cooking bar): the fire's dishes,
known ones with their painting and what goes in (what the satchel has ringed, `needsHad`), half-known ones a hint told
("Something with honey…", `hinted`, kept in `aeon-garden-hints`), the rest a row of blank plates; a known one tapped fills the pot
(`bookDish`, `fillPot`), or walks to a lit fire within `BOOK_REACH` and fills it there (`j.want`). On an upright phone a sheet from
the bottom with its brass ✕ at the foot. Finding it: near a lit fire with something to cook (`bagFood`) a small painted pot bobs
over it, with an E key where there's a keyboard (`drawCookPrompt`, `PROMPT_ART` painted once; a click on it is one on the fire,
`promptAt`); making camp the forager thinks "I could cook something on this fire" (`think`, `CAMP_COOK_LINE`), and now and then it
muses on a dish it doesn't know from what's in the satchel (`hintTick`: `HINT_EVERY`, `HINT_GAP`, never in the intro or the
opening storm or over another line), telling the book up to `hintMost` of it. Plain dish looks for now (the dishes' emoji in
`itemSheet`); the paintings, the scene and the sounds come next. Eating: a tap on food in the satchel (`eatAsk`, `#eat`) shows its name with an Eat button, or why not
("It wants cooking", "I'm full"); `eatSlot` feeds it (sim.js `feedForager`). The tummy is a third slim bar (`#v-food`), shown
once hungry and for `FED_SHOW` after eating; "I'm getting hungry" and "I'm starving" are said over it (events 'hungry',
'starving'). The ideas card waits while it's at a fire (`askTick`).
A click or a tap on an animal (on its body as drawn: `animalAt`, a little wider for a finger) opens its panel;
anywhere else walks the forager there (`walkTo`, sim.js `foragerTo`) and shuts the panel, with a
soft ring where it was sent (`drawMark`, `MARK_ART` painted once) that fades once it's there, and a faint dashed line to it
along what's left of its way (`drawTrail`: one stroke a frame, the dashes counted from the ring so they keep still on the ground,
fading in just after the ring pops up, `TRAIL_IN`, and marching on toward it while it sprints, `TRAIL_MARCH`); held
and steering, the ring glides after where it was sent (`MARK_GLIDE`) rather than jumping each `STEER_MS`. A press held still for
`HOLD_MS`, or dragged, runs toward the pointer while it's down (sim.js `f.running`, `FORAGER_RUN`; Shift held runs too, `holdShift`), the
way found again every `STEER_MS` (in `frame`), and on to where it's let go. WASD or the arrows (`keyWalk`) take over from a walk or a held press: the ring, the trail and the press itself are dropped, so letting go walks nowhere. Running, once up past `FORAGER_JOG` it jogs (`fg.jog`, fur.js poses 16 to 23: both feet off the ground a moment, heels
kicking up, elbows bent and pumping, leaning in) with a stride `FORAGER_JOG_STRIDE` longer. The camera always goes with it (`leadCam`): eased after it (`CAM_FOLLOW`), a little ahead the way it walks
(`CAM_AHEAD`, itself eased so setting off and stopping are soft), its feet a little below the middle (`CAM_FEET`). Nothing pans it:
the wheel, a pinch, a double tap and + - zoom about the forager (`zoomOn`), and a kept meadow opens on it at its kept zoom (`resumeWorld`: `showWorld` leaves the wide shot, so it's set back there).
Gathering: a click or a tap on something to gather (`gatherAt`: a hive, a clump of mushrooms, a wild find, a bramble, nettles, a fruit or mast
tree, the garlic, looked for only near the point, the trees through the sim's grid) walks the forager to its near side a reach
away, in front of a tree, a hive or a bramble so it isn't hidden (`goGather`, `standPoint`, `gatherSpot`), and once it's there
(`gatherFrame`) it turns to it, stoops and reaches down (fur.js poses 3 and 4, `fg.pick`, `PICK_MS`), sim.js `gather` takes it, a
"+3 Chanterelles" with its icon floats up from the spot (`pickFloats`, `floatOf`: a pill painted once), it flies into its slot
(`flyToSlot`: one element, the browser's own animation) and the pick sound plays (sound.js `pick`). Hovered with a mouse, a thing
with something to give glows (`GLOW_ART`, painted once, under it; a hive's over its hollow, where the trunk would hide it) with
its name by it and a hand for the pointer; one with nothing says why (sim.js `whatThere`), as a click on it does (`say`). The hover
is looked up again only when the mouse moves, or every `AIM_MS` while the camera glides (`hoverFrame`, `aim`). "Satchel's full"
says so by the forager and leaves the thing be.
A click a little off one still goes for it (`snapTo`: `SNAP` px past its glow, `SNAP_FINGER` for a finger, more in reach). A press on
something to pick is a tap however long it's held (held past `HOLD_MS`, it runs there, `drag.rush`) and needs a bigger move to become
a drag; a held run let go on something picks it. Playtesters had found a slow tap turning into a sprint past the thing.
The queue: while the forager is off to pick something or stooped over it, a click on more lines it up after (`queueGather`,
`ui.queue`, at most `QUEUE_MOST`, in click order), each with a small parchment number over it (`drawQueue`, `badgeArt`, painted
once a number); clicked again it comes off, a click on the ground or holding to run lets the queue go (`walkTo`). Each next one
waits till it's back up from the last (`ui.nextAt`, `nextGather`), and one gone or picked clean meanwhile is passed over.
E picks the nearest thing in reach (within `NEAR_REACH`, or lying where it was dropped) as a click on it would, and pressed
again while it's busy lines up the next nearest (`pickNear`); with nothing in reach it says so.
Near a lit fire (`cookFire`: the nearest within `PROMPT_NEAR`, as far as the pot shows over it; or anywhere inside the camp's ring, `campFire`) E walks there and opens its cooking card as a click on the fire does, and shuts it again; the picking is for everywhere else. By a fire that's burnt down or gone cold that the satchel can see to (`relightFire`, `fireKind`), E relights it as a click does (a stick, tinder, a strike, then hold F to blow), and a little painted flame with an E bobs over it (`drawCookPrompt`, `PROMPT_RELIGHT`; a click on it is one on the fire).
In reach: everything to pick within `NEAR_REACH` of the forager, the sticks, grass and bark for a fire too, has a soft honey ring
lying round its foot (`drawNear`, `RING_ART` painted once), steady, fading out over `NEAR_FADE` at the edge, brighter on what's
queued. That's what tells a dandelion from the other yellow flowers and dry grass from the tufts (playtesters couldn't).
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
Wild finds (sim.js `w.finds`) are painted once a look and size (`paintFind`, `FIND_ARTS`: 'find:' + kind * 4 + stage * 2 + look):
dandelions (`paintDandelion`: a toothed rosette, bright heads, now and then a clock), sorrel (a rosette of broad lime arrow-leaves
on red stalks, the front ones leaning out so it doesn't read as grass; rusty seed spikes), wild strawberries (trefoils, scarlet
berries), elderflower (one round shrub: a dome of leafy clumps, a few leaves at its rim, flat lacy plates of flowers on top),
hazelnuts (round nuts in frilly husks on yellow leaves), rosehips (an arching rose with scarlet hips, bare in winter: stage 1) and
watercress (sprigs of flat round glossy leaflets standing in the shallows, a pale ring of water round its foot, a rim of snowy ice while the water is frozen, stage 1: `cressSprig`, `findStage`). A
bit bigger and brighter than the meadow's own flowers and tufts (`FIND_PX`). What lies about for a fire is painted plainer
(Axel wants the sticks thin): a few thin crossed sticks (`paintSticks`, `twig`), rounded pebbles (`paintPebbles`), a pale gold
tuft of dry grass arching over (`paintDryGrass`) and thin rolled curls of white birch bark with dark dashes (`paintBark`). They
don't glint (sim.js `eachPickable` leaves them out), but a hover names them and a click picks them as any find. Drawn with the trees and animals (a frame item's `s`,
`drawFind`), they come up over `FIND_GROW` and fade over their last `FIND_OVER`. The satchel shows the same paintings.
The satchel (`#satchel`, `renderSatchel`, rewritten only after a pick or a drop): `S.SLOTS` small parchment slots at the bottom in
the middle, a slim faint row while it's empty. Their paintings are one sheet painted once (`itemSheet`, `--items`): the meadow's own
mushrooms, greens and windfalls (`ITEM_ART`) and `paintItem` for the blackberries, cherries, honeycomb, beechnuts, and the sticks,
pebbles and birch bark (lying flat they'd be thin in a slot, so a satchel painting of their own, bigger and in the middle); an
ingredient with no painting gets its recipes.js emoji. A tap on a slot opens nothing, but a full one can be dragged (`setupSatchel`): its painting follows the pointer (above a finger), let go on another slot it goes there (sim.js `moveSlot`: onto a stack of its kind, or the two swap), let go off the satchel it is dropped (sim.js `dropSlot`): it flies down to just in front of the forager and lands with a little bounce (`dropLand`), and lies there in its satchel painting (`drawDropped`, `dropPx`) to be picked up again like a find (`'dropped'` in `gatherAt`, `gatherSpot`), fading over its last `DROP_FADE` till it's gone. On a touch screen each slot is 44 px or more, and upright the satchel steps aside while the
inspector's sheet is up.

The inspector shows animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water,
visitors): each kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows. A tap
on an animal opens its panel (`select`); the camera never leaves the forager for it. Animals can't be named by the player. Every animal of a kind is alike
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
which keeps a dozen poses, growing young and zooming cheap. Close up it's painted at one size, `FUR_MOST` screen pixels,
and stretched past it (`furTop`): the forager's 57 paintings at the doubling above were more than the whole sprite cache,
and a full cache never lets go of the forager's set at the size it's drawn (`keptForager`), or its walk sticks after a zoom. In the meadow the paintings are made off the main thread
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
nearly 2000).

The meadow is kept in the browser when the page is hidden or closed (`keepMeadow`: IndexedDB, under its link, the last
`KEEP_MEADOWS`), and every `KEEP_EVERY` while it's played, in a quiet moment between frames (`keepTick`: a keep is about
8 ms on a laptop). A keep at `pagehide` alone never landed on a reload in Chrome (the page went before IndexedDB wrote it,
and the reload opened a new meadow, intro and all), so it's also kept at `beforeunload`. The next visit opens it where it was
(`resumeWorld`): the bare address the one watched last, a `?seed=` link its own. A kept meadow that won't open, or broke
the page the last time it opened (`OPENING`), is let go. The ••• menu shares the link (a phone's share sheet) and takes
ideas (the `#ask` card, also once by itself two minutes of play after the first dish is cooked: `askTick`). Visits are counted by GoatCounter
(`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the page `/meadow` whatever the seed, and a link posted with
`?ref=reddit` says where they came from.

On a phone (and Back anywhere): Back steps out of what's open as Esc does (`stepOut`: a card or menu shuts, the inspector's
open sheet folds and then shuts). Each thing open holds a step in the history, counted, not named (`opened`), and
`syncBack` levels the history with what's open after every tap or key: pushed only inside a tap, as Safari skips a step a
page adds outside one. The inspector's sheet follows the finger and settles open, folded or away by where and how fast
it's let go (`sheetLetGo`). A double tap zooms in, a double tap held and dragged zooms as it goes, and two
fingers tapped zoom out (`zoomTo`, `zoomDrag`, as Google's and Apple's maps do); a tap that would only put the inspector
away waits `DOUBLE_MS` in case it's the first of two (`tapAway`). On a touch screen the screen stays awake while time
runs, till nobody has touched it for `WAKE_MS` (`wakeTick`, the Screen Wake Lock API).
