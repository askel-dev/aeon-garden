# Fires, torches, camp, the make strip, the basket

## game.js

While the forager sees to a fire (laying it, a stick on, the flint, blowing, watching it take: `TEND_STAGES`) the camera eases onto the fire, as cooking does but no closer, and back onto the forager when it's done (`tendCam`, in `leadCam`; 2026-10-21).

The campfire (sim.js `w.fires`; its rules under sim.js below; the long comment over game.js's `FIRE_SIZE` has it all): the round make
button by the satchel (`#build`, `renderBuild`; above the satchel on an upright touch screen, beside it with the basket and the book on a phone on its side) shows the build most worth doing (`buildFocus`) with a ring filling in as the satchel
holds what that takes. Before there's a camp that's the campfire alone (recipes.js `BUILDS.campfire`: 6 pebbles, 5 sticks, 2 tinder), so a tap does what the fire button always did; with more, a tap opens the make strip (below). F stays the quick campfire wherever. A tap on a ready one picks a spot (`ui.place`, a faint fire
following the mouse, within `PLACE_REACH`; sim.js `fireSpot` says why not). Picking a spot works the same for every build: a mouse
moves the faint one and a click lays it; a finger's tap or drag only moves it, and lifting never builds. While a spot is picked
a small bar of round brass buttons sits over the satchel (`#place-bar`, `renderPlaceBar`; over the make button and the vitals on
an upright touch screen): ✕ not now, ✓ put it here (dimmed, `.no`, while it can't go there, a tap still says why), ↻ turn it,
shown only for a build with a facing (`PLACE_TURNS`: the seat log's four facings). R and Shift + wheel turn it too (`turnPlace`,
`ui.place.turn`, an index), a right click, Esc or Back put it away, Enter lays it. The forager kneels side on (fur.js `FORAGER_KNEEL`,
`KNEEL_VIEW`), lays it a piece at a time (`LAY_STEPS`), strikes (`STRIKES`), and you hold (mouse, finger or F: `blowHeld`) to
blow till it catches (`blowFrame`, `BLOW_S`, longer in the wet); let go too soon and it only smokes. A quick tap while it blows
is one breath more (`puff`, `BLOW_PUFF`, as one held breath; it never walks the forager away), and a tap well off the fire
still walks away (that's how you leave it). A click on a fire sees to it
(`clickFire`: a stick on, a stick and a blow on embers, tinder and a strike when cold), standing still by a lit one it kneels and
warms its mittens (`SIT_MS`; from the fire's side, `STAND_OFF`, stepping out to it first if it's standing nearer), and a hover
says what it wants in the line over the satchel (`fireSaid`, `hoverSay`), no more than its name while it burns well (so a fire
that's fine doesn't nag over the camp). Drawn with the trees and animals (`drawFire`: `paintFire` once a look and size, `FIRE_ARTS`; flames
as `TONGUES` of one painting, smaller as its sticks burn down, `fireFlame`; smoke), its glow, embers and sparks over the dark
(`drawFireGlows`); near the forager a lit one has a row of pips under it, one a stick it can take, lit for what's still burning, red and breathing when low (`drawFireGauges`, `FUEL_NEAR`)—the pips are over the dark, so any the forager's body or a tree in front stands over are cut out. Cold, the forager has a slim thermometer by its side (`drawChill`, from `CHILL_SHOW`). Its light (`lightsFrame`, at most 4 fires, out to `LIGHT_TILES`, flickering in `FLICKER_MS` steps) is cut out of the night on the sky's
picture (`SKY_FIRE`, `paintFireLights`: so the sky repaints only on a flicker step) and laid warm over what stands near it
(`fireLight`, source-atop, kept soft so the forager by it isn't washed out). The pool isn't a plain hole in the night (that showed the day's greens and a lit oval pasted over trees): it falls off fast from the flame with a long faint tail, is washed a dusky amber with a warm glow close in, and is an egg reaching `POOL_UP` further up the screen behind the light than in front, so a tree standing in it is lit to its crown and one in front of it stays dark (`eggArt`, `paintFireLights`, 2026-10-20). A fire behind the old stone doesn't shine through it (2026-10-21): its glow, embers and pips are hidden where the stone stands in front (`stoneOver`, like `coverAt` for crowns), and its pool leaves the stone's outline mostly out (`stoneOut`, `STONE_BACKLIT` of it), so the stone stands dim against the lit ground instead of lit on the face turned away. Readable by firelight at night (2026-10-18):
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
"why not" is the label `drawFireHint` already draws by a faint one (a torch's click doesn't say it twice). While a spot is
picked, the light it would cast lies on the ground round the faint one (`drawTorchReach`: `torchReach` tiles out, the pool
warm and faint with a thin ring at its edge, fainter where it can't go, drawn with the camp's ghost ring under all that
stands), and at night `lightsFrame` puts the ghost among the lights, so the dark is cut away out to it for real: a torch's
place is picked by what it would light rather than guessed at. The forager walks to its side, kneels (`fireFrame` 'torch' →
'set', `TORCH_SET_MS`) pushing it in, spends it, and strikes once, which is
when `S.placeTorch` sets it lit; then it watches the flame (`lit`). `drawTorch` draws the real ones with the trees and
animals: `paintTorch`'s three looks (`TORCH_ARTS`: burning, guttering over its last fifth, then the stub) and the
sharper flame set (`TORCH_FLAME_ART`, centred on the crown). Its light is `lightsFrame`'s (a lantern's pool, `TORCH_LIGHT` of a fire's, dimmer guttering, none from the stub): the lattice's `t` marks it, so it takes `lightFallT` and `torchCutArt` rather than a fire's falloff — the same soft shape, a touch fuller at every step of the reach (0.86, 0.50, 0.20 against a fire's 0.82, 0.42, 0.14), so a line of them at five tiles closes into one lit path without a flat-topped disc with a drawn rim. Its cut alpha is 0.82 burning, 0.62 guttering (0.72 was a pip in the dark). It crackles
near (`torchSound`), and friends see it set down (`sendFire('torch')`). A torch's line over the satchel names it: "Torch · burning"
while it burns well, and one guttering or burnt out (`torchLow`: its last fifth, drawTorch's look, or the stub) wants bark, so
the line says what it wants (`torchSaid`, `hoverSay`). A click, a tap, or E when it's the nearest thing to use and the satchel has
bark (`barkTorch`, through `eTarget`) walks over and lights it again (`clickTorch`,
`goFire` kind 'relight': the generic 'set' kneel, one birch bark spent through `spendBuild`'s `RELIGHT` table, one strike,
`S.relightTorch`, then a `firstTime`). Without bark it says what's missing where it stands and doesn't walk. `torchAt` (a
click's) only finds the ones that want bark, so a click on one burning well is a walk there; a hover's `torchAt(..., true)` names
a fine one too. Friends get `sendFire('torchre')`, and
`meadowSum` counts which torches burn as well as how many.
Making camp (sim.js `w.camp`, event 'camp': the first fire lit) is a moment (`campMoment`, the comment over
`CAMP_FLARE`): the flames flare (`fireShown`), the light blooms out (`lightsFrame`) with a warm glow, two fountains of sparks,
twinkling stars, a wave of light out to the ring and motes rising off it (`campBurst`, in `drawFireGlows`; `CAMP_PARTY_MS`), a felt-piano flourish (sound.js `camp`), the camera eases in and leans to the fire and back
(`campCam`, in `leadCam`; a zoom of your own ends it), "Your camp" pops in, glowing between two twinkling ✦ (announce 'camp', which cuts in ahead of the others; index.html `camp-pop`)
and an Android phone buzzes (`CAMP_BUZZ`). Then a soft ring of trodden earth with a few stones lies round the fire (`drawCampRing`,
`CAMP_ART` painted once, stretched; under all that stands), coming in over `CAMP_RING_MS` (`campFade`). The brown earth inside it is in the ground shader
(ground.js `camp`, `campA`: an ellipse of ragged, mottled dirt over the grass, repainting the ground only while it fades in). The fire's line over the satchel calls the camp's fire "Your camp".
The craft button (2026-10-20; `#build`, `renderBuild`, from `craft-button-lab.html`): a brass plate with a pot and the word
Craft left of the satchel (round, the plate alone, over its left end on a touch screen), in place of the old round make and
basket buttons. It shows once the satchel holds any of what something on offer takes, sits in quiet parchment, and turns to
the warm clay fill with a slow bloom (`.ready`) while any build can be made. A tap always opens the make strip.
The make strip (PLAN.md stage 7; `#make`, `openMake`, `renderMakeStrip`: `stripUi` is it, not the vessels' `makeUi`): a tap
on the craft button (or C) opens it just over the satchel, a tile a build (`makeList`: `after`
passed, the basket not twice, and a guest's basket left out) with its painting (`BUILD_ART`, painted once and kept as a blob's
address, as `vesselIcon`'s), its name, and what it takes as little item chips, have/need (`2/5`), bright when met. Ready tiles
are bright, the rest faded with a ring (`--k`); a tap on a ready one shuts it and starts placing (`startBuild`: `placeFire` or
`placeBasket`), one not ready (or one that goes at camp, from outside it) says what's missing and the strip stays open. ✕, Esc,
Back, C, or a tap on another card or button shut it; walking (the keys, a click or a drag on the meadow, the minimap) leaves it
open, its chips following the forager in and out of camp (`makeFrame`; it rewrites only when what it shows changes). F stays the
quick campfire (`campfirePressed`), and still blows at a fire. A build with `makes` (the rope, while friends are here) is made at once into the satchel
(`makeThing`) instead of picking a spot, and the strip stays open; see tasks-stone-friends.md.
The camp's basket (2026-10-17; the comment over `WEAVE_MS`): once there's a camp the make strip offers it (recipes.js `BUILDS.basket`: 8 sticks, 4 dry grass, `where: 'camp'`,
`after: 'camp'`). A tap on its ready tile in camp picks a spot inside the ring (`ui.place` with `basket: true`, sim.js
`basketSpot`); the forager kneels and weaves it (`fireFrame`'s 'weave', `WEAVE_MS`), the basket growing up out of the ground.
Once made it opens from the meadow: a click on it, or E by it (`goBasket`); it no longer has a button by the satchel.
Painted once (`paintBasket`, 'basket:' 0 shut, 1 open with apples, a cep and leaves heaped in it once it holds anything), drawn
with the trees and animals (`drawBasket`), a hover saying in the line over the satchel how much is in it (`basketSaid`, `hoverSay`). In camp a click on
the basket, or E when it's the nearest thing to use (`eTarget`: the same race as every other E target, by distance), walks over and opens its card just over the satchel (`#larder`, `openLarder`, `renderLarder`, `setupLarder`): 24
slots as the satchel's; a tap moves a slot across either way, a drag puts it in the slot it's let go on (sim.js `moveBetween`,
`moveInto`), "Put all in" empties the satchel into it (`putAway`). Whatever moves either way flies as a small painting from its slot to the one that took it (`flyMoves`: paired by what it is, at most `FLY_MOST`, `FLY_GAP` ms apart; the landing slot's own painting waits hidden, `.incoming`, and bumps as it lands). Walking off `LARDER_NEAR`, going to a fire, a click on the meadow, ✕, E, Esc or Back shut
it (`larderFrame`, `cardAway`, `stepOut`). Playing together it's shared: the host makes it (a friend sees it set down: `sendFire` 'basket') and anyone in camp can open it; each move sends the slots it changed (`sendBasket`, `'bk'`, applied at its tick in `basketNet`), so two moving different things at once both land, and the basket is in `meadowSum`, so a guest who drifts off gets it again. It's also to hand while cooking at a fire in camp: its things are then a row of small tiles in the cooking window, a tap taking one out (below, `#cook-basket`).

The seat log (`BUILDS.seat`, five sticks; 2026-10-22: as many as you like, anywhere, before a camp too: `w.seats`, an array like `w.racks`, a kept camp's one `camp.seat` moves into it in `unpackWorld`; `nearestSeat`, `seatAt`, `goSeat(Q)`; a lit fire within `SEAT_WARM` of one outside camp warms the sitter) goes down the basket's way: `placeSeat` (`ui.place` with `seat: true`,
`S.seatSpot` for the why), `goFire` kind `'seat'`, the generic `'set'` kneel (`TORCH_SET_MS`), which for a seat ends the job
instead of striking, then a `firstTime`. It faces one of four ways (2026-10-23, `seatFace`: you, left, away, right, `S.SEAT_FACES`; it turned in 15° steps before, which looked wrong from our view), each a painting of its own as the forager has a front, side and back (`paintSeat`, `SEAT_ARTS`, `seatArt`): lying across (facing you, and away, the same painting with the sitter behind it) or running up the meadow (left and right), the same three-quarter view turned, its near sawn end down and to the left and its far end up and to the right, as `S.seatEnds` lays its line (`SEAT_LEAN`, `SEAT_ALONG`), its flowers out at its sides; `SEAT_TURN0` for the strip's tile. A bench: a log split lengthwise, flat side up (grain, two knots, a split at the far end), on two
short stumps, in a three-quarter view (`SEAT_KX`, `SEAT_KY`) and soft-shaded with no outline, about two foragers long; drawn by `drawSeat`. It's solid. A click on it (`seatAt`) or E when it's the nearest thing to use (`eTarget`) walks
the forager to just in front (`goSeat`, `S.SEAT_OUT`), and standing still there `SEAT_MS` (`sitFrame`, `fireSit.seat`) it sits
on it: fur.js `sitPose` (`KNEEL.sit`, `KNEEL.sitWarm` with a fire lit at camp: eyes shut, smiling; `P.sit`: the cloak spread over
the log, round knees out from under it, short shins and dangling boots, the elbows bent and the mittens in its lap, as its
arms are short), facing the way the log faces: facing you `sitPose`, else fur.js `sitViewPose` (`sitArt`, `FORAGER_SIT`: side on, its knees out ahead and its boots dangling, `sideWarm` by a fire; or from behind, its legs over the far side; facing right the side-on pose flipped (`sitKind`; fur.js's `far`, `farWarm`, legs out of sight, aren't used now: in this view a log running up the meadow shows both its sides alike); `SEAT_VIEW` for its hop up), and eating it turns to you (the front sit-eats). Side on its mittens rest on its knees (`P.carry`, so the side arms take `hands`) and from behind they're forward in its lap (`lapArms`). It's drawn just after its log (`sitSort`, a friend's too), and on a log running up the meadow it sits at the edge it faces (`seatLift`, `SEAT_EDGE`) so its boots hang down that side, and the log's near part is drawn again over it (`drawSeatFront`: a painting of its own, `paintSeat`'s n 2, the log from `SEAT_NEAR` to its near end), so its legs hang behind the near end and not over it. Not a screen clip: what's nearer can't be told from where it is on screen (the near end and a shin can be at the same spot), so the near part is cut in the log's own shape. Look at all four facings after a change there; lifted onto the
log by `seatLift` (as a dance's hop is, `fg.lift`; a friend's from its `kn`), with no shadow of its own. `seatLift` puts its hips on the log's top as `paintSeat` draws it for its facing (`SEAT_SIT` of the way back from the sitter's side lying across, the middle running up the meadow), across as well as up (`seatDx`, `fg.sitDx`, added to its x in `drawForager` and `drawPeer`). `seatUnder` is the log whose sitting place it's in (`sitFrame`, a friend's), not just the nearest one. A hover, or a finger
standing by it, says "Seat log · sit down" in the line over the satchel (`hoverSay`; "sitting" once it's up there), with E on a
keyboard when E would go to it. Friends get `sendFire('seat')`, and `meadowSum` counts it.

The drying rack and the lean-to (`BUILDS.rack`, 8 sticks, 3 dry grass and 1 birch bark; `BUILDS.lean`, 10 sticks, 5 dry grass and 2 birch bark) go down the seat log's way: `placeRack`/`placeLean` (`ui.place` with `rack`/`lean`, `S.campSpot` for the why), `goFire` kinds `'rack'`/`'lean'`, the generic `'set'` kneel, then a `firstTime`. Painted once (`paintRack`, `RACK_ART`: two crossed-pole A-frames, a bar and six hooks; `paintLean`, `LEAN_ART`), shared by the meadow and the strip's tiles. The rack is a store: a click on it, or E by it, walks the forager there and opens the same card as the basket (`larderUi.store`, `larderStore`), titled "Drying rack", 6 slots that each hold four times a basket slot's stack, a slot to a hook: `drawRack` hangs each slot's item (its satchel painting, `ITEM_ART`) under its hook (`RACK_HOOKS`, staggered) every frame, so what hangs is what it holds (a second row of hooks, more slots, can come later); the lean-to is passive, and is drawn mirrored when it stands right of the fire so its mouth opens toward it. Friends get them by `sendFire('rack'/'lean')`, and every camp-store move goes as a diffed snapshot (`storesWas`/`sendStores`), so the rack's slots agree on both sides.
Camp life (2026-10-21): what hangs drying shrinks toward its dried size as it goes (`drawRack`, `RACK_SHRINK`: the same sprite drawn smaller from the same hook, no new painting), and once dry it's its own satchel painting (items.js: dried mushrooms as cep slices on a cord, apple rings, a heap of dried berries). The rack's line (`basketSaid`, `rackSaid`) names the first thing drying and how far (`DRY_WORDS`, "Cep half dry (+3)"), or why it isn't ("waiting out the rain"), and "✓ Dried mushrooms" for what's done; one drying says "✓ Cep" over the rack as it turns, with a pick sound, and the first ever is a `firstTime`. The lean-to has a line of its own (`leanSaid`, under the mouse `leanAt`, standing still under it `closeBy`): how dry it is under there, "drying off, the rain on the roof", and at night "stay a while to sleep". In rain, drops gather along its near eave and fall to the ground in a little splash (`leanDrips`, `LEAN_DRIPS`, from `drawLean`: two strokes a frame, only while it rains with it on screen and over 40 px), and under it the rain outside is muffled while the thatch patters overhead (sound.js `amb.roof`, `state.roof`, eave drips by your ear). Standing still under it at night it curls up (sim.js `curledUp`): the warm sitting pose (`KNEEL.sitWarm`, eyes shut) laid on its side, feet in under the roof and head out of the mouth on the spilled straw (`drawCurled`, `CURL_MS`, breathing slow), a 💤 over its head drawn after the dark (`drawCurledZ`, beside the rim). A step, a dish in its hands or the dawn gets it up.

## sim.js

Fires (`w.fires`, one layout, `fireOf`; the long comment over `FIRE_STICK`): laid with sticks and tinder (`layFire`; what one takes
is recipes.js `BUILDS`, spent out of the satchel by game.js with `spend`), lit (`lightFire`), burning a stick in `FIRE_STICK` (faster
in the wet, `FIRE_WET`), never more than `FIRE_MOST` on (`feedFire`, `fireRoom`), then embers for `FIRE_EMBERS` (a stick and a blow
relight them), then cold. The spring flood over one puts it out. It warms the forager up to `FIRE_WARM` degrees within `FIRE_NEAR`,
none past `FIRE_REACH` (`fireWarmth`, by `fireHeat`), and dries it close up (`FIRE_DRY`), rain or not. No random numbers, and a
meadow kept before fires gets none (no `KEEP_VERSION` bump). Standing by one from dusk with warmth full (4 seeds): a new fire's 5
sticks burn about a game day dry (17 game hours in rain, 12 in a storm); spring nights end at 0.6 to 1 warmth, winter ones at 0.1 to 0.75 (snow worst),
and a fire kept fed keeps it at 1 all night; with none, the rainy spring nights and every winter night kill.
A fire has one pot (`cookDish`, `cookItems`, `cookLeft`, `cookTotal`; `cookOn`, `cookTake`, `cookReady`, `cookProgress`): game.js takes
the things out of the satchel and sets a dish going for its recipes.js `time` (seconds at 1x, `cookTicks`), and `fireTick` counts it
down one a tick, only while the fire is lit (a fire that goes out waits, the pot still on it), emitting 'cooked' at nought. A done dish
stays in the pot till `cookTake`. A kept fire from before pots gets the fields in `unpackWorld` (no `KEEP_VERSION` bump). Not sent to friends.
The meadow's first fire lit makes camp (`w.camp`, in `LATER`: where, the fire, the tick; `campAt` from `lightFire`, event 'camp'):
the forager's home (`homeX`, `homeY`) moves to where it knelt to light it (within `CAMP_KNEEL`; else the fire's clear side), so it
wakes there after a collapse. Its ring, `CAMP_R` tiles round the fire and `CAMP_FLAT` as deep as wide (`inCamp`), is where later
builds go. What stands in the ring is cleared for it as it's made (`clearCamp`): trees and rocks, brambles and burrows, and the
mushrooms, greens, finds, seeds and flowers under it; a rabbit in a burrow that goes comes out, the bees in a felled hollow swarm
out (`hiveMoves`), and the crows pick a new roost. What the forager dropped itself stays. A meadow kept with a fire lit before
camps makes camp at it as it opens. No random numbers, no `KEEP_VERSION` bump.
Torches (`w.torches`, in `LATER`, one layout each, `torchOf`: where it stands, when it was set down, the ticks of flame left and
how fast it's burning just now, `wet`): a stick wrapped in birch bark pushed into the ground anywhere but the deep water, or a
trunk, a rock, a burrow or another torch (`torchSpot`, like `fireSpot` but closer), lit at once (`placeTorch`; what one takes is
recipes.js `BUILDS.torch`, spent by game.js). It burns `TORCH_BURN` (ten days, 2 h at 1x: a fixture for a session or two, not a
thing you keep feeding), quicker in the wet as a fire's
blowing is (`TORCH_WET`, `BLOW_WET`'s table), then its charred stub stays for good (fresh bark relights it). At most
`TORCH_MAX` (64) burn at once: laying one past that gutters the oldest, its stub staying. The cap is on how many stand lit,
not on the painting: game.js keeps only the nearest `LIGHT_MAX` (24) a frame, so a meadow can hold a real spread of them
(64 was 20, which the birch bark's own supply could never keep up anyway). It gives light, no warmth (game.js
draws its pool). `relightTorch` lights one guttering or out again (game.js has spent the bark): a fresh `TORCH_BURN`,
`born` moved to now so it isn't the next one guttered, and the same `TORCH_MAX`. The water coming up over one puts it out
(`torchUnder`: deep and not frozen, so the spring flood over the shallows it stood in, or the thaw under one on the ice; looked
at in `torchTick`), and one under the water won't relight. Shallows don't touch it. `torchTick`, every `TORCH_EVERY` ticks, looks only at the torches; no random numbers. A meadow kept before them
gets none (`unpackWorld`), no `KEEP_VERSION` bump.
The camp's basket (`w.camp.basket`, `basketOf`, null till it's made: `makeBasket`, where `basketSpot` allows, inside the ring
and clear of the fire, rocks and trunks) keeps `BASKET_SLOTS` slots of `STACK`, laid out as the satchel's (`bag`, `bagN`), and
a collapse doesn't touch it. `moveBetween` and `moveInto` move a slot between any two of them, `putAway` the whole satchel in.
A camp kept before baskets gets none (`unpackWorld`), no `KEEP_VERSION` bump.
The seat log (`w.camp.seat`, `seatOf`, null till `makeSeat`) is scenery with no store, `SEAT_HALF` either side of its middle
and turned its own `turn` (radians, one of `SEAT_FACES`; `seatFaceOf` snaps a kept or a friend's older turn to the nearest, and those within 45° of across face you: `seatOf`, `unpackWorld`; friends get it as the fire word's `r`). Facing left or right its line runs up the meadow, leaning as it's drawn and half as long (`seatEnds`: `SEAT_LEAN`, `SEAT_ALONG`). It's solid: `rocksFor` puts a row of `SEAT_SOLID` circles along it into `solidR` (`makeSeat` clears
`solidW` so they're added). `seatSpot` measures to its line (`seatEnds`): the fire, basket, torches, rocks, trunks, brambles
and burrows; `seatNear` is how far a point is from it, which keeps the fire, torch and basket spots clear. A camp kept before
it gets `seat: null` (`unpackWorld`), no `KEEP_VERSION` bump.

## Cosy and the camp's level

Cosy is a list of deeds, each earned once and never lost (recipes.js `DEEDS`: `{ name, points, from, build?, friend? }`, and
`CAMP_LEVELS` for the five levels and their keystones; `checkDeeds` says what's wrong, and that every gate II–IV has 8 points
of slack from the deeds open below it whose build is written or absent). `w.camp.deeds` keeps the ids in the order they were
earned and `w.camp.cosy` is their points summed in `countCosy`, the one place they are added up; `campLevel(w)` is
`1 + w.camp.raised`, and the ring follows it (`campR`: `CAMP_R` + 0.5 a level, `CAMP_R` the floor, used by `inCamp`, `campWet`
and game.js's ring, motes and ground shader). `earnDeed(w, id)` pushes a new one and recounts cosy: `campAt` earns `camp`,
`makeBasket` `basket`, `makeSeat` `seat`, `placeTorch` `torch` (inside the ring only), and game.js `cookDone` `dish-1`, `dish-5`
and `dish-12` as `w.camp.dishes` (distinct dish names cooked at a fire in the ring) passes them; `eatSlot` earns `seat-meal`
while `fireSit.seat` is set. The rest are the hourly `deedCheck` (`DEED_EVERY` ticks): a season's fire while the camp's fire
burns, the fire lit at dusk (`duskLit`) till dawn (`night-fire`), lit through a storm (`stormLit`, `storm-fire`), 16 filled
basket slots (`basket-half`) and one of every food in it (`basket-all`). Game.js says each new one over the forager ("✦ Wove
the basket · +3 cosy", `deedEarned`, chime `found`): game-side earns say it at once, sim-side ones are picked up a few times a
second by comparing `world.camp.deeds.length` (`deedFrame`). A camp kept before cosy gets the six blanks and earns only what
it can see it did (camp, basket, seat, a torch in the ring) in `unpackWorld`, no `KEEP_VERSION` bump. In dev,
`garden.cosy(n)` earns deeds in table order (friends left out) till cosy reaches n and `garden.raise(n)` raises the level (0–4),
both only with a camp.

The drying rack (`w.camp.rack`, `rackOf`, null till `makeRack`) is a second camp store: `RACK_SLOTS` (6) slots, one to a hook, and each holds `RACK_KEEP` (4) times the stack a basket slot does, because what dries takes less room (`stackOf` scales a store's keep by its `kept`). It's in `worldStores` after the basket and in `meadowSum`; the basket's `kept: 1` keeps it exactly as it was. The lean-to (`w.camp.lean`, `leanOf`, null till `makeLean`) shelters: `underLean` is an ellipse under its roof, and `bodyTick` takes `shelter` as all of it there (no rain soak, little wind), and `makeLean` moves the forager's home under the roof. Both are placed by `campSpot` (the basket's spot generalised), are scenery you walk through, and a camp kept before them gets `rack: null`/`lean: null` (`unpackWorld`), no `KEEP_VERSION` bump. A rack kept with 12 slots is folded into its 6 there (same kind together, else an empty slot, else the basket).
The rack dries (`rackTick`, every `RACK_EVERY` ticks): a slot holding something with a recipes.js `dries` turns, whole stack at once, into that dried ingredient (`dried: true`, bigger stacks, the same tags so the recipes take it) over about `DRY_DAYS` of clear weather by day (`DRY_WEATHER`: cloudy slower, a heatwave quicker, none in rain, a storm, fog or snow; `DRY_NIGHT` half at night, `DRY_FIRE` twice with a lit fire within `DRY_FIRE_R`), event 'dried', the deed 'dried'. Its progress is `K.dry` per slot, kept with what it was for (`dryOf`, `dryN`): another kind starts again, more of the same sets it back by its share, taking some leaves it be; so a move (yours or a friend's: `sendStores`) needs no hook into it. With a fire kept lit it took 0.8 of a day (two seeds); with none, about twice that. A rack kept before drying gets the blank arrays in `unpackWorld`, no `KEEP_VERSION` bump. The lean-to's home spot is in its mouth, which opens toward the fire (it was a step behind it).

Placing a campfire (2026-10-24): a spot refused (a trunk, a rock, the water near for a camp) moves the ghost to the nearest
spot within `FIRE_SNAP` that takes one (`snapFire`, in `placeAt`), so the woods don't refuse every click; the ghost that can go is
stronger (0.9). The first fires in a new meadow: bark lies under the birches nearest the start (sim.js `startFinds`, `CAMP_BIRCH`).
