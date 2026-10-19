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
The sky dial (2026-10-19; the comment over `DIAL_W`) is what came back in its place, small, left of the pill (`#sky`,
`updateDial`, `dialWords`): an arched brass window like a grandfather clock's moon dial, the sky of the hour in it
(`SKY_KEYS`, dark as `darkness`, grey with the weather's mix), the sun and then the moon with its stars going over on a
wheel (a CSS transform; the sun rises at `DIAL_RISE`, sets at `DIAL_SET`), the season's hills in front with a rabbit's ears
over Nobody's hill (`DIAL_HILLS`, a painting by day and one by night a season, all painted once), and under it a pip a day
of the season. A new season fades its hills in and glints over the brass (`.turn`); a hover or a tap says the day, the
part of it, and the dark, the light or the next season coming. The edge markers keep clear of it (`KEEP_CLEAR`).

Headlines (`announce`, index.html `#announce`): big Fraunces italic words over the meadow with no card, under the toast,
fading in and out, clicks going through. The old watching game's daybreak lines brought back (cut in da8079b): each new
day at sunrise (`daybreakTick`, with `morningWord` when the morning is frosty or wet), a new season bigger with what it
brings (`SEASON_LINES`, hand-written: keep them true to sim.js's seasons), where we are a moment after a meadow opens, a
friend's meadow as you join, and the first of anything in gold between ✦s (`firstTime`, kept across meadows in
`aeon-garden-firsts`; a first find says its recipes.js `text`). One at a time: the rest wait, except a day's line, which
is dropped. None while a card is open or the forager is down. The first fire and the first dish go through `firstTime`.
A skill up a level is one too (`levelUp`, announce 'level', `LEVEL_WAIT` after what did it): it rises from below, a coin
with the level flipping in on a ring of light and rays, the skill's name in its `SKILL_INK` tracking in, its `SKILL_SAYS`
under it, and sound.js `level` (the one sound with a real cadence: up an A7, home on D). The coin's metal is the level's own
(`LEVEL_COIN`: copper, bronze, brass and gold, then jade, verdigris, sapphire, amethyst and rose), and the top one is extra:
a pale opal of every colour (`.max`, index.html) with a turning sheen, sparks and a wider rainbow halo of rays. With a card
open it's a toast.

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
`dancePose`, painted from all three views). The spring hops (`b.lift`, `DANCE_HOP`, in `drawFigure`), a stomp sound at each hunch; it dances till it's sent somewhere. It keeps to the song's beat (132 bpm, one move a beat, `DANCE_BEAT`): while the song plays its clock is eased toward the song's (`PARTY_BEAT0`, the first beat; a new song needs its bpm and first beat measured, e.g. folding the low band's onsets over the beat with ffmpeg and numpy). The
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
`BREATH_AIR` its breath puffs from its mouth (`BREATH_AT`, by view, drifting the way it faces; `PUFF_ART`, painted once), soaked it drips off its hem, now and then a drop you hear (sound.js `hemdrip`). Out of breath it pants (`pantFrame`, sound.js `pant`, one a breath every `PANT_MS`: quick and hard when spent, slower and softer as it comes back, from `PANT_LOW` already while sprinting) till it has `PANT_DONE` back, then a phew (sound.js `phew`). Its face is top left
(`#me`, `renderVitals`, in the 250 ms block, rewritten only on a change; 2026-10-17): its head painted from the front in its outfit and snow,
in a mood (`faceMood`, held `MOOD_HOLD` before it changes; fur.js `FACE_MOODS`, `paintForagerFace`: well, cosy by a fire, happy after eating or
a level up, cold, hungry, hurt or down, winded), each painted once and kept (`faces`); frost round it while freezing. Health is a ring round
it, warmth (amber to ice blue, a drop while wet) and the tummy two small dials under it, dimmed while full. No browser tooltips on them:
a parchment tag slides out beside the one hovered, or for a moment after a tap (`#me-tip`, `showTip`, `tipSaid`: what it is, how it is,
and what helps). Stamina is a slim bar centered over the
satchel (`#vitals`, `#v-stam`, in `renderVitals`) shown while it isn't full, ember-red pulsing while winded. A tap on
the face or I opens the skills (`#me-card`, `openMe`, `renderMe`: level, a bar to the next, what it gives, what practises it; a sheet with its ✕
at the foot on an upright phone); its brass badge is the levels added up and glints after a level up till they're looked at.
The air's temperature (sim.js `airTemp`, the weather's, not what the forager feels) is a small parchment pill top middle (`#thermo`,
`renderThermo`, in the 250 ms block, rewritten only when the whole degree changes; 2026-10-18): a thermometer whose mercury rises over
`THERMO_RANGE` and goes ice blue to amber to hot red (`THERMO_INK`), the degrees and a word (`THERMO_WORDS`). Cold it ices over (`--ice`, 0 at `THERMO_ICE`'s first degree to 1 at its second; 2026-10-19):
frost ferns in from its ends, a pale glaze and rime under the words, and icicles hanging from its foot that grow longer the colder (index.html
`#thermo::before`, `::after`: CSS and small inline SVGs only). The toast and the headlines
sit under it. On an upright phone it's just the degrees, and while playing together (the pill then reaching past the middle) it sits beside the face.
Practice earned floats up over its head as in Project Zomboid (`xpFrame`, `drawXpFloats`, 2026-10-17): "+4 Gathering" in the
skill's ink (`SKILL_INK`, lightened) as plain words with a faint dark edge, no pill, painted once (`xpFloatOf`), gathered till it stops
gaining for `XP_QUIET_MS` (a pick, a dish) or `XP_MOST`; stamina only now and then, every `XP_EVERY` seconds of sprinting gathered over
sprints. Shown as practice times `XP_SHOWN`, a newer one pushing the older up. A new skill shows at 1x.
Collapsed it tips over (`FALL_MS`) with its eyes shut (pose 7), the screen goes dark
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
The campfire (sim.js `w.fires`; its rules in ecology.md; the long comment over game.js's `FIRE_SIZE` has it all): the round make
button by the satchel (`#build`, `renderBuild`; above the satchel on an upright touch screen, beside it with the basket and the book on a phone on its side) shows the build most worth doing (`buildFocus`) with a ring filling in as the satchel
holds what that takes. Before there's a camp that's the campfire alone (recipes.js `BUILDS.campfire`: 6 pebbles, 5 sticks, 2 tinder), so a tap does what the fire button always did; with more, a tap opens the make strip (below). F stays the quick campfire wherever. A tap on a ready one picks a spot (`ui.place`, a faint fire
following the mouse, within `PLACE_REACH`; sim.js `fireSpot` says why not). The forager kneels side on (fur.js `FORAGER_KNEEL`,
`KNEEL_VIEW`), lays it a piece at a time (`LAY_STEPS`), strikes (`STRIKES`), and you hold (mouse, finger or F: `blowHeld`) to
blow till it catches (`blowFrame`, `BLOW_S`, longer in the wet); let go too soon and it only smokes. A quick tap while it blows
is one breath more (`puff`, `BLOW_PUFF`, as one held breath; it never walks the forager away), and a tap well off the fire
still walks away (that's how you leave it). A click on a fire sees to it
(`clickFire`: a stick on, a stick and a blow on embers, tinder and a strike when cold), standing still by a lit one it kneels and
warms its mittens (`SIT_MS`; from the fire's side, `STAND_OFF`, stepping out to it first if it's standing nearer), and a hover
says what it wants (`fireWord`), nothing at all while it burns well (so a fire that's fine doesn't nag over the camp). Drawn with the trees and animals (`drawFire`: `paintFire` once a look and size, `FIRE_ARTS`; flames
as `TONGUES` of one painting, smaller as its sticks burn down, `fireFlame`; smoke), its glow, embers and sparks over the dark
(`drawFireGlows`); near the forager a lit one has a row of pips under it, one a stick it can take, lit for what's still burning, red and breathing when low (`drawFireGauges`, `FUEL_NEAR`), and the hover note sits under the row (`hoverLine`)—the pips are over the dark, so any the forager's body or a tree in front stands over are cut out. Cold, the forager has a slim thermometer by its side (`drawChill`, from `CHILL_SHOW`). Its light (`lightsFrame`, at most 4 fires, out to `LIGHT_TILES`, flickering in `FLICKER_MS` steps) is cut out of the night on the sky's
picture (`SKY_FIRE`, `paintFireLights`: so the sky repaints only on a flicker step) and laid warm over what stands near it
(`fireLight`, source-atop, kept soft so the forager by it isn't washed out). Readable by firelight at night (2026-10-18):
the forager's top edge takes a faint warm rim where a fire's pool falls and no further (`drawForagerRim`, `foragerRim` a rim
sprite cut out of the pose's own picture, drawn after the washes so the navy doesn't eat it, gated by `fireReach` — the
pool's own falloff, `lightFall`), and the camp's basket and cold fire pit get a
little of the dark taken back over their footprint (`liftsFrame`, `paintCampLift`, `SKY_LIFT` — same sky pass as the fires,
painted once, so the lit fire's pool stays the only strong light). Nights are dark (`DARK` 0.88 of a deep navy
`NIGHT_RGB`, 2026-10-15) so the fire is the cosy place. A lit fire also melts the snow back round it (`snowMelt`: the
ground shader takes up to four fires and bares a soft, ragged clearing — `fire[]`, `fireN` in ground.js — coming in over
`SNOW_MELT_TICKS` from `F.litAt` so it thaws rather than pops, wider the hotter it burns; the ground it bares goes wet).
Friends see fires laid, fed and lit (`sendFire`). Sounds: sound.js `clack`,
`stick`, `tinder`, `strike`, `blow`, `kindle` (`catch` is the fox's), `fizzle`, and a crackle near a burning one (`fire` in
`Sound.update`). Cost: none measurable (1440x813, zoomed out, a summer night in the rain, walking: about 1.0 ms of script a
frame with a fire and without, 60 fps).
Torches (PLAN.md stage 7; the comment over `paintTorch`): a stick of birch bark set down anywhere from the make strip
(recipes.js `BUILDS.torch`: 1 stick, 1 birch bark). A tap on its tile picks a spot (`placeTorch`, `ui.place.torch`,
`placeAt` asking `sim.js torchSpot`), a faint burning torch follows the pointer (never a fire's bright ghost), and its
"why not" is the label `drawFireHint` already draws by a faint one (a torch's click doesn't say it twice). The forager walks
to its side, kneels (`fireFrame` 'torch' → 'set', `TORCH_SET_MS`) pushing it in, spends it, and strikes once, which is
when `S.placeTorch` sets it lit; then it watches the flame (`lit`). `drawTorch` draws the real ones with the trees and
animals: `paintTorch`'s three looks (`TORCH_ARTS`: burning, guttering over its last fifth, then the stub) and the
sharper flame set (`TORCH_FLAME_ART`, centred on the crown). Still to come, in step 3: its glow and pool cut out of the
night (so it reads at night), the crackle, and the fire message that shows it to friends.
Making camp (sim.js `w.camp`, event 'camp': the first fire lit) is a moment (`campMoment`, the comment over
`CAMP_FLARE`): the flames flare (`fireShown`), the light blooms out (`lightsFrame`) with a warm glow, two fountains of sparks,
twinkling stars, a wave of light out to the ring and motes rising off it (`campBurst`, in `drawFireGlows`; `CAMP_PARTY_MS`), a felt-piano flourish (sound.js `camp`), the camera eases in and leans to the fire and back
(`campCam`, in `leadCam`; a zoom of your own ends it), "Your camp" pops in, glowing between two twinkling ✦ (announce 'camp', which cuts in ahead of the others; index.html `camp-pop`)
and an Android phone buzzes (`CAMP_BUZZ`). Then a soft ring of trodden earth with a few stones lies round the fire (`drawCampRing`,
`CAMP_ART` painted once, stretched; under all that stands), coming in over `CAMP_RING_MS` (`campFade`). The brown earth inside it is in the ground shader
(ground.js `camp`, `campA`: an ellipse of ragged, mottled dirt over the grass, repainting the ground only while it fades in). The fire's hover calls it "Your camp" when it wants something.
The make strip (PLAN.md stage 7; `#make`, `openMake`, `renderMakeStrip`: `stripUi` is it, not the vessels' `makeUi`): with more
than one build on offer, a tap on the make button (or C) opens it just over the satchel, a tile a build (`makeList`: `after`
passed, the basket not twice, and a guest's basket left out) with its painting (`BUILD_ART`, painted once and kept as a blob's
address, as `vesselIcon`'s), its name, and what it takes as little item chips, have/need (`2/5`), bright when met. Ready tiles
are bright, the rest faded with a ring (`--k`); a tap on a ready one shuts it and starts placing (`startBuild`: `placeFire` or
`placeBasket`), one not ready (or one that goes at camp, from outside it) says what's missing and the strip stays open. ✕, Esc,
Back, C, a tap anywhere else, or walking off shut it (`makeFrame`; it rewrites only when what it shows changes). F stays the
quick campfire (`campfirePressed`), and still blows at a fire.
The camp's basket (2026-10-17; the comment over `WEAVE_MS`): once there's a camp the make button's build is it until it's made
(`buildFocus`), and the make strip offers it (recipes.js `BUILDS.basket`: 8 sticks, 4 dry grass, `where: 'camp'`,
`after: 'camp'`). A tap on its ready tile in camp picks a spot inside the ring (`ui.place` with `basket: true`, sim.js
`basketSpot`); the forager kneels and weaves it (`fireFrame`'s 'weave', `WEAVE_MS`), the basket growing up out of the ground.
Its round button left of the make button (`#basket-btn`, `renderBasketBtn`, also looked at in the 250 ms block) shows once it's
made, in camp, and only opens it; with nothing the make button takes in the satchel (or one already laid) the make button hides, and the
basket's steps into its place by the satchel (`index.html`'s `#satchel:has(#build.hidden) #basket-btn`) rather than hanging out
where the make button's would have been.
Painted once (`paintBasket`, 'basket:' 0 shut, 1 open with apples, a cep and leaves heaped in it once it holds anything), drawn
with the trees and animals (`drawBasket`), a hover saying how much is in it (`basketWord`). In camp its button, or a click on
the basket, or E standing by it (`basketByE`: nearer it than to a fire E would cook at or light), walks over and opens its card just over the satchel (`#larder`, `openLarder`, `renderLarder`, `setupLarder`): 24
slots as the satchel's; a tap moves a slot across either way, a drag puts it in the slot it's let go on (sim.js `moveBetween`,
`moveInto`), "Put all in" empties the satchel into it (`putAway`). Whatever moves either way flies as a small painting from its slot to the one that took it (`flyMoves`: paired by what it is, at most `FLY_MOST`, `FLY_GAP` ms apart; the landing slot's own painting waits hidden, `.incoming`, and bumps as it lands). Walking off `LARDER_NEAR`, going to a fire, ✕, E, Esc or Back shut
it (`larderFrame`, `stepOut`). Playing together it's shared: the host makes it (a friend sees it set down: `sendFire` 'basket') and anyone in camp can open it; each move sends the slots it changed (`sendBasket`, `'bk'`, applied at its tick in `basketNet`), so two moving different things at once both land, and the basket is in `meadowSum`, so a guest who drifts off gets it again. It's also to hand while cooking at a fire in camp: its things are then a row of small tiles in the cooking window, a tap taking one out (below, `#cook-basket`).
Cooking at the fire (PLAN.md stage 6, its redesign, and the cooking window of 2026-10-16; the long comments over `COOK_TPS` and
`DROPS` have it all): a click on a lit fire (or E, or the pot prompt) walks the forager there (`clickFire` 'cook', `goFire`), it
kneels, and the camera eases in close on the fire (`cookCam`, in `leadCam`: to `kw.zoom`, about `COOK_TILES` across what the
window leaves, past the 64 you can zoom yourself up to `COOK_MOST`), the fire and the forager in the middle of the meadow left
beside the window (`kw.fx`, `kw.fy`, `COOK_AIM`, `COOK_UP`), and eases back out as you leave. A big parchment window opens
(`#cook`, `renderCook`, `measureCook`; brass-ringed, opaque): on a computer to the right with the fire on the left, on an upright
phone a sheet from the foot with the fire over it and its ✕ at the foot in the middle, on a phone on its side the pot and the
satchel side by side down the right, under the pill. The satchel at the foot and its bars step away while it's up. In it:
the pot close up on a small canvas of its own (`#cook-canvas`, `drawCookView`, drawn only while it's open): on the fire's own coals
and stones (`paintCookBed`: `paintFire` as the fire is now) in a warm dark vignette with grass at its edges, the fire's flames
licking up round its belly (`drawFlames` drawn into that canvas) and their glow flickering on the ground and the iron; water in
it, shimmering. The satchel's things are big tiles (`#cook-bag`, 80 px, 64 on its side: `renderCookBag`, `setupCookBag`), ringed if
they go in the pot or on the fire, the rest let down: one dragged (pointer events: mouse and finger, its painting hanging from the
pointer by its top edge as a pendulum the hand's speeding up swings, as the animals did when they were picked up) and let go over the pot falls in from there (the rim glows while it's over it, `kw.hover`); one tapped (or Enter on it)
flies in an arc to over the pot's mouth (`flyToPot`, `flyBig`) and falls in. Meeting the water it splashes (`splash`: droplets up
and back down, rings going out, `potRing`; a pool each of typed arrays), dips under, bobs back up and floats, its lower part dim
through the water with a ring round it (`drawPotThing`), and plops (sound.js `plop`, by `plopOf`: heavier for a mushroom, an apple
or one day a fish, lighter for a leaf or a berry, honey a gloop). What's in the pot is held back in the satchel (`potHeld`,
`potPrune`) till cooked; a tap on one floating lifts it out with a drip and it flies back to its tile (`potTake`), and a small red cross at the pot's corner (`#cook-empty`, only with something in it) lifts them all out (`emptyPot`). The camp's basket is to hand at any fire standing in camp (`basketAtHand`: `S.inCamp` under the fire, so wherever in the ring the basket was set down it counts), and its things are a row of small tiles under the satchel's (`#cook-basket`, 40 px, 46 on a touch screen, 38 in a short window; it never grows the window: three rows then a scroll, on a phone on its side what the satchel leaves, upright one row scrolled sideways: `renderCookBasket`, `kw.bslots`, rewritten only when what's in it changes, hidden when it's empty or out of camp), each ringed as a satchel's is when it would go in the pot (or on the fire) and the rest let down. A tap takes one straight out of the basket (`potAddBasket`): into the pot, or a stick on the fire, the satchel out of it, so a full satchel is no reason a thing kept at camp can't cook. The pot remembers the store each thing came from (`ui.fire.src`), holds its tile back there (`potHeld`, `potPrune`) and spends it there at Cook (`spendPot`, `potStillThere`; sim.js `storesAt`, `storesPut` — the satchel first, then the basket while the fire stands in camp). Each change is sent (`sendBasket`), so a friend sees it leave. A fire lit outside the ring cooks without it: the row's gone. The meadow keeps
its own little pot over the fire too (`drawPot`, `paintPot`), which the forager stirs. Under the pot what it will make (`potWord`: a
known dish's name, "Something new!" for an exact dish never made, "Not a dish yet… as it is, a forager's mess" with what a known
dish it's near still wants, `potToward`, or "Only a forager's mess", `potPossible`); by the tiles the stick wearing the fire's
fuel as a ring (`cookFuel`; F feeds it too, `buildPressed`), the recipe book (`openBook`, beside the window: `pairBook`), Cook, and a round brass
✕. With the pot empty the last dish comes back as a one-tap "again" (`lastDish`, `cookAgain`, `fillPot`). Cook: the dish's own time
(recipes.js `time`, seconds at 1x: 15 to 90) of stirring, the things spent at once (Cook filling as it goes, `--cook-p`), the water turning to broth (`brothOf`: green for greens, purple for berries,
murky for a mess), bubbling, steaming, a wooden spoon going round in it (a swish each time round, sound.js `stir`), the pot boiling
(`Sound.update`'s `pot`: a simmer while the window's open, a boil as it cooks); then `cookDone`: the dish out, rising out
of the pot glowing with sparks round it, or a mess in a puff of dark smoke (sound.js `dish`, `mess`), and after `REVEAL_MS` flying
to its tile (`kw.reveal`, `kw.incoming`; into the basket at camp with the satchel full, `kw.reveal.bk`, and on the ground by
the fire only with no room anywhere); a dish never made before gets its gold
headline (`firstTime('dish:' + name)`, which `knownDish` reads with recipes.js `known`). Walking off, ✕, E, Esc or Back leave the
fire (`closeCook`, `stepOut`) and the pot keeps cooking on the fire (sim.js `cookOn`, on the fire's clock, only while it's lit): the pot
stays on it, steaming (`drawAwayPots`), with a slim bar over it filling as it cooks (`drawCookBars`: ember orange, grey while the fire's
out, gold and pulsing once done), a hover saying the time left (`fireWord`) and a "Ready" by it (event 'cooked'). A done dish waits in the
pot, for a click on the fire or E (the pot prompt shows over it); the window opened on a pot going finds it as it was and on a done one
takes the dish out as before (`cookSync`). Playing together the pot is the fire's, so friends see it cook: a pot set going and a dish taken
out go over (`fire` messages 'cook', with the cook's own time after its Cooking skill, and 'take': `fireNet`), and a friend's done dish waits
`FRIEND_POT_MS` for its cook before anyone else at the pot takes it (`friendPot`). Skills are the player's, not the meadow's: kept in
localStorage as the page is left (`keepSkills`), brought into a friend's meadow (`arrive`) and home again (`bringSkills`). The recipe book says how long each takes (⏲). Cost: the window's canvas only while it's open (painted once a size:
`paintCookPot`; a frame is twenty-odd draws), and the meadow zoomed in that close draws less than walking about (1400x900, Chrome:
1.0 ms of script a frame cooking against 1.7 walking, 60 fps).
Making vessels (2026-10-17; the comment over game.js `cookVessel`): every vessel is made first (recipes.js `CRAFTS`: a roasting
stick from a stick, a hearth stone from a pebble, a bark bowl from 2 birch bark, all at once; the clay griddle and pot from clay,
then fired). The cooking window's vessel row has them all, each its meadow painting fitted to a small picture (`vesselIcon`), the ones not made dashed with "Make"; picked, the window makes it
(`cookMode` 'make'): its outline breathes over the fire with what it takes bobbing over it, the satchel tiles it takes glow
(`.want`), each piece dragged or tapped onto the fire falls in with a puff and builds the vessel up from the bottom (`drawMakeView`,
`makeArt`, pips under it), and once the last lands (`makeDone`) it's yours (sim.js `makeVessel`) or, clay, shaped and hardening in
that fire (`cookMode` 'fire': raw clay darkening as it goes, its % in the row), with a bloom and sparkles (`drawMadeBurst`). One clay
thing in the fire at a time (`makeBlocked`). The line under the canvas guides it all (`makeLine`: what to drag, how far, what's
missing and where to find it). With nothing made the window opens making the first it has things for. There's no clay button
(taken out 10-17: the window's vessel row does it); a book page whose vessel isn't made has "First make a …" (`book-make`), which
walks to a lit fire to make it there (`makeOne`, `makeNext`), and something newly within reach is told once (`renderMake`). The bowl is painted as folded, laced birch bark now.
The recipe book (`#book`, `renderBook`, `#book-btn` by the satchel's right end, B, and on the cooking bar), modelled on the old
field journal (main at 1d79f03): a book laid open on the meadow over a soft scrim (`#book-scrim`), the numbered tiles on the left
page in sections (`BOOK_SECTIONS`: savoury, sweet by whether a need is sweet or fruit; `BOOK_PAGES`, No. 1 to N), the page picked
on the right (`bookPageHTML`), turned with ‹ n/N ›, ← → (a capturing listener that also keeps the walking keys off the forager
while it's open) or a sideways swipe (`turnBook`), a 44 px brass ✕ top right. A page: the dish's picture big on a plate (`dishArt`:
its painting from dishes.js, painted at the page's size, `dishBig`; its recipes.js emoji while it has none), its name, its `text`,
"✦ Warms you" (`warm`), how much it fills (`BOOK_PIPS` against the most filling), what goes in marked against the satchel
(`needsHad`), and a button: "Put its things in the pot" at the pot (`bookDish`, `fillPot`), else "Cook it at the fire" (walks to a
lit fire within `BOOK_REACH` and fills it there, `j.want`). Half-known (a hint told some: "Something with honey…", `hinted`, kept
in `aeon-garden-hints`) a half silhouette, what's been told and a ? row for each thing missing; not found a faint silhouette with
a gentle hint (sweet or savoury, how many things). News: a page whose dish was learned (cooked, or a hint told more) since it was
last looked at (`pageLevel` against `aeon-garden-book`, `bookFresh`; with nothing kept, what's known counts as seen) gives the
book button a glow and a "New" tag (`bookNews`, from `renderBook`, which every satchel change and hint calls) and its tile a "New";
shown the first time, a stamp thumps onto the page ("Learned!", "A hint"); the book opens on the newest; shutting it has seen them
all. On an upright phone a sheet from the bottom, ✕ at the foot in the middle, handle to drag it down; a page is a layer over the
tiles with ‹ ✕ › (`bookUi.depth` 2, `bookBack`), and Back steps out of the page, then the book (`opened` counts `bookReading`,
`stepOut`). On its side the two panes fill the screen. Open with the cooking window (either first), the two share the screen
(`pairBook`, `.paired`): the book centred in the meadow left beside the window, no scrim, its tiles over its page where that's
narrow (`.slim`, under 600 px); a known dish tapped there fills the pot and the book stays open. Not on a phone (`narrow()`): there
the book opens over the window as it does anywhere (squeezed beside it, it was a strip upright and 200 px on its side, 10-18), and
a dish put in the pot shuts it. Rewritten only when what it shows changes (`bookUi.key`, `setHTML`).
The book has a second part, Finds (2026-10-16), behind two titles at the top that are its tabs (`BOOK_PARTS`, `bookTab`; the one open
big, a red dot on the other when it has news): a page for every ingredient in recipes.js (`FIND_PAGES`, in `FIND_SECTIONS`:
mushrooms, greens & flowers, fruit nuts & honey, for a fire), found once it's been picked into the satchel ever (`foundIt`: the
firsts, as the first find's headline). Found, its satchel painting, its `text`, good raw or cook it first, how much it fills, where
to find it (recipes.js `where`), and what it goes into (`findUses`: the book's dishes that take it, a known one a tap to its page,
the rest a ?; the campfire for the sticks). Not found, the painting's shadow and "Where to look". A page is keyed `bookUi.pick`
(a dish's name, 'find:' + the id), and paging stays within its part (`pageBy`). A new find tags its tile "New" and stamps
"Found!" but doesn't make the book button glow (there are too many finds early on); shutting the book has seen the news of the
parts shown (`bookUi.shown`), and a book kept from before the finds counts what's been found as seen.
Finding it: near a lit fire with something to cook (`bagFood`) a small painted pot bobs
over it, with an E key where there's a keyboard (`drawCookPrompt`, `PROMPT_ART` painted once; a click on it is one on the fire,
`hintAt`); making camp the forager thinks "I could cook something on this fire" (`think`, `CAMP_COOK_LINE`), and now and then it
muses on a dish it doesn't know from what's in the satchel (`hintTick`: `HINT_EVERY`, `HINT_GAP`, never in the intro or the
opening storm or over another line), telling the book up to `hintMost` of it. The dishes are painted in dishes.js (`Dishes.paint`,
'dish:' + n in `ITEM_ART`, so into `itemSheet`; big on a book page once a size, `dishBig`), two so far; the rest are their emoji till
they're painted. Eating: a tap on food in the satchel (`eatAsk`, `#eat`) shows its name with an Eat button, or why not
("It wants cooking", "I'm full"); `eatSlot` feeds it (sim.js `feedForager`). The tummy is the face's second dial (`#v-food`); "I'm getting hungry" and "I'm starving" are said over it (events 'hungry',
'starving'). The ideas card waits while it's at a fire (`askTick`).
First things (2026-10-17; the comment over game.js `TASKS`): a new player's guide, a small parchment note under the face
(`#tasks`, `renderTasks`, in the 250 ms block, rewritten only on a change) of what to do first, a chapter at a time: a fire before
dark (sticks, pebbles, tinder with counts from recipes.js `BUILDS.campfire`, build, light), the first night (a stick on, see the sun
come up), something to eat (pick food, the book, a roasting stick, cook, eat it), a home at camp (the basket). Each line ticks itself
off from the meadow and the satchel (`got`/`n`, `done`; a stick fed and a dish eaten are heard as events, `taskUi.fed`, `taskUi.ate`),
and stays ticked per player (`aeon-garden-tasks`), so it's for the first meadow or so; on load what's already true ticks quietly. A
line ticked pops its circle with a click; the line worked on says how (`how`); a chapter done is a toast and `found`, stays ticked
`TASK_TURN_MS`, then the next pops in; the last is a gold headline ("Settled in") and the note is gone for good. A tap on its head
folds it to the one line (`aeon-garden-tasks-fold`). Away while the skills, the book, the wardrobe
or the old stone are open or the forager is down. Not shown on a phone at all (index.html's `narrow()` media query hides `#tasks`).
The old stone (2026-10-17; the comment over `STONE_MOODS`): sim.js `w.stone`, painted once a face (`paintOldStone`, `STONE_ARTS`:
seven moods, each with its mouth shut and open; moss hair and brows, asleep and drooling left alone `STONE_DOZE_MS`), drawn with the
trees and animals (`drawStone`), solid in the forager's way like a rock. A click on it walks over (`goStone`, `goFire` 'stone', standing
`STONE_STAND` further out than at a fire) and opens a slim line to talk on over the satchel (`#stone-talk`, `openStone`; up top on a
touch screen, out of the keyboard's way, the face hidden under it and the camera keeping the stone and its bubble below it and above the
satchel or the keyboard: `measureSheet`, `STONE_ROOM`). E standing by it does the same (`stoneByE`), with a little disc of its face and
an E bobbing over it while it would (`drawStonePrompt`; a tap on the disc opens it too). Woken, it says hello. What's typed is the forager's bubble (`myChat`), its answer a bubble
over the stone (`stoneUi.chat`, in `drawPeerNames`) with its mouth going (`STONE_MOUTH_MS`). A tap on anything in the satchel there has
🙏 Offer by Eat (`eatAsk`, `offerSlot`): it flies into the stone, which rates it (a "★★★ 7 / 10" pill over it and a sound by the
score; the pill stays up as long as its bubble's words, `stoneSays`, and goes when the stone is asked or offered something
else, `stoneDropScore`, so the rating and its number are always on screen together).
Words from stone.js (`stoneAsk`, `stoneCtx` tells it the season, time, weather and how the forager is). Walking off `STONE_NEAR`, ✕,
Esc or Back shut it (`stoneFrame`, `stepOut`).
Gifts, playing together: with a friend's forager within `GIVE_REACH` (`giftFriend`), a tap on anything in the satchel offers
it (a green 🎁 button with their name, by Eat in `eatAsk`); `giveSlot` takes one out and flies it over to them, and `heardGive`
puts it in their satchel with a toast, or at their feet as a drop when it's full. Sent `to` that friend alone (net.js passes a
guest's word to another guest through the host).
Hugs, playing together (2026-10-19): G, or the round heart button above the swing's while a friend stands within
`HUG_REACH` (`#hug-btn`, `hugFrame`), stops the forager and turns it to the nearest friend (`hugLocal`): both open
their arms and hug for `HUG_MS`, squeezing every `HUG_SQUEEZE` (fur.js `FORAGER_EMOTE` `hugA`, `hugB`, `hugPose`), with
little hearts (drawEffects) and sound.js `hug`; the first hug ever is a gold headline (`firstTime('hug', …)`). Sent `to`
that friend alone (`'hug'`, as a gift is): they hug back and
send where they stand, so everyone sees both (sendPos's `em`). A friend at a fire, cooking, placing something or on the
ground isn't pulled away: they hear the hug and get a toast, and the hearts still rise over the one who hugged them.
A click or a tap on an animal (on its body as drawn: `animalAt`, a little wider for a finger) opens its panel;
anywhere else walks the forager there (`walkTo`, sim.js `foragerTo`) and shuts the panel, with a
soft ring where it was sent (`drawMark`, `MARK_ART` painted once) that fades once it's there, and a faint dashed line to it
along what's left of its way (`drawTrail`: one stroke a frame, the dashes counted from the ring so they keep still on the ground,
fading in just after the ring pops up, `TRAIL_IN`, and marching on toward it while it sprints, `TRAIL_MARCH`); held
and steering, the ring glides after where it was sent (`MARK_GLIDE`) rather than jumping each `STEER_MS`. A press held still for
`HOLD_MS`, or dragged, runs toward the pointer while it's down (sim.js `f.running`, `FORAGER_RUN`; Shift held runs too, `holdShift`), the
way found again every `STEER_MS` (in `frame`), and on to where it's let go. WASD or the arrows (`keyWalk`) take over from a walk or a held press: the ring, the trail and the press itself are dropped, so letting go walks nowhere. Running, once up past `FORAGER_JOG` it jogs (`fg.jog`, fur.js poses 16 to 23: both feet off the ground a moment, heels
kicking up, elbows bent and pumping, leaning in) with a stride `FORAGER_JOG_STRIDE` longer. On the ice it can't dig in (sim.js `onIce`, `FORAGER_ICE_*`): it gets going slowly, turns in long wide arcs, and isn't stopped where it was sent but carries on past, gliding (no stride, standing) till it comes to rest or reaches dry ground. The camera always goes with it (`leadCam`): eased after it (`CAM_FOLLOW`), a little ahead the way it walks
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
A click or a tap is looked up in one place (`useAt`, then `useIt`; the click, a held press let go, and what a press is on all ask it):
an animal, a fire, the basket or the old stone, or something to gather, as drawn; for a finger each target is at least `FINGER_R` round
(56 px across). Failing those, the nearest of them all within a snap goes (`snapTo` with `all`: `SNAP` px past its glow, `TAP_SNAP`
for a finger, more in reach; `useSpot` is the fire's, the basket's and the stone's), so a near miss isn't a walk past.
A finger has no hover, so standing still a moment (`USE_STILL`) within `USE_NEAR` of something to use (a fire, the basket, the stone,
or what E would pick: `nearPick`) shows it as a mouse's hover does, in `aim` with `aim.close` (`closeBy`): the paler ring round a fire's,
the basket's or the stone's foot (`drawGlow`, `RING_E_ART`) or a pick's glow, and its name by it for `USE_SAY`, then fading (`USE_FADE`).
A tap on the forager with something to pick there picks it (only one on nothing is the dance's tap), and a quick tap after a pick,
or onto something to pick, is a tap, never the double tap's zoom (`lastTap.on`): picking a cluster on a phone kept zooming. A press on
something to pick is a tap however long it's held (held past `HOLD_MS`, it runs there, `drag.rush`) and needs a bigger move to become
a drag; a held run let go on something picks it. Playtesters had found a slow tap turning into a sprint past the thing.
Everything drawn over a fire is the fire (2026-10-18: the hint discs and lines were traps — a tap on the breath disc walked the forager away from the fire it was blowing on). Each frame the drawing over a fire records the box it was drawn in (`hintBox`: `promptUi` the disc and its key, `hintLine` a "Needs a stick" line, `blowHint` the breath disc and its "Hold to blow" line, all with the fire they're over), and `hintAt` reads them back as that fire, a fingertip past the edge (`fingerTap`); a tap on one is `hintFire`: a breath if it's being blown on (`puff`), else whatever that disc means (`clickFire`: off to cook, to light, or to hear what the fire wants). Only a tap well off the fire (>3 tiles, in the pointerup that stops a blow) walks away from it.
The queue: while the forager is off to pick something or stooped over it, a click on more lines it up after (`queueGather`,
`ui.queue`, at most `QUEUE_MOST`, in click order), each with a small parchment number over it (`drawQueue`, `badgeArt`, painted
once a number); clicked again it comes off, a click on the ground or holding to run lets the queue go (`walkTo`). Each next one
waits till it's back up from the last (`ui.nextAt`, `nextGather`), and one gone or picked clean meanwhile is passed over.
E picks the nearest thing in reach (within `NEAR_REACH`, or lying where it was dropped) as a click on it would, and pressed
again while it's busy lines up the next nearest (`pickNear`); with nothing in reach it says so.
Near a lit fire (`cookFire`: the nearest within `PROMPT_NEAR`, as far as the pot shows over it; or anywhere inside the camp's ring, `campFire`) E walks there and opens its cooking card as a click on the fire does, and shuts it again; the picking is for everywhere else. The moment it takes (`lit`, the kneel watching the flame catch) is no exception (`fireFree`): the flame with its E is already painted, and E there opens the card at once — it used to fall through to the picking and say there was nothing in reach till the kneel was up. By a fire that's burnt down or gone cold that the satchel can see to (`relightFire`, `fireKind`), E relights it as a click does (a stick, tinder, a strike, then hold F to blow), and a little painted flame with an E bobs over it (`drawCookPrompt`, `PROMPT_RELIGHT`; a click on it is one on the fire).
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
the middle, a slim faint row while it's empty. Their paintings are one sheet painted once (`itemSheet`, `--items`): items.js's paintings of things
picked (`'ingr:'`: every ingredient so far, the fruit, honeycomb, nuts, flowers and what lies about for a fire too), over the
meadow's own painting of it (`ITEM_ART`), which a new ingredient keeps till items.js paints it; one with neither gets its
recipes.js emoji. Each is clipped to its own square in the sheet (`ITEM_FILL` scales one up). A tap on a slot opens nothing, but a full one can be dragged (`setupSatchel`): its painting follows the pointer (above a finger), let go on another slot it goes there (sim.js `moveSlot`: onto a stack of its kind, or the two swap), let go off the satchel it is dropped (sim.js `dropSlot`): it flies down to just in front of the forager and lands with a little bounce (`dropLand`), and lies there looking like something to pick (`drawDropped`, `dropPx`, `dropArt`: a find in the meadow's own painting at its size there, a little smaller, `DROP_FIND`; anything else in its satchel painting at about that size, `DROP_PX`), with the same warm ring in reach as a find (`drawNear`, `nearRing`) to be picked up again like a find (`'dropped'` in `gatherAt`, `gatherSpot`), fading over its last `DROP_FADE` till it's gone. On a touch screen each slot is 44 px or more, and upright the satchel steps aside while the
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
