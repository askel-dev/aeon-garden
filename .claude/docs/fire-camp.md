# Fires, torches, camp, the make strip, the basket

## game.js

The campfire (sim.js `w.fires`; its rules under sim.js below; the long comment over game.js's `FIRE_SIZE` has it all): the round make
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
builds go. A meadow kept with a fire lit before camps makes camp at it as it opens. No random numbers, no `KEEP_VERSION` bump.
Torches (`w.torches`, in `LATER`, one layout each, `torchOf`: where it stands, when it was set down, the ticks of flame left and
how fast it's burning just now, `wet`): a stick wrapped in birch bark pushed into the ground anywhere but the deep water, or a
trunk, a rock, a burrow or another torch (`torchSpot`, like `fireSpot` but closer), lit at once (`placeTorch`; what one takes is
recipes.js `BUILDS.torch`, spent by game.js). It burns `TORCH_BURN` (half a day, 6 min at 1x), quicker in the wet as a fire's
blowing is (`TORCH_WET`, `BLOW_WET`'s table), then its charred stub stays `TORCH_STUB` (a day) before it's gone. At most
`TORCH_MAX` (20) burn at once: laying one past that gutters the oldest, its stub staying. It gives light, no warmth (game.js
draws its pool). `torchTick`, every `TORCH_EVERY` ticks, looks only at the torches; no random numbers. A meadow kept before them
gets none (`unpackWorld`), no `KEEP_VERSION` bump.
The camp's basket (`w.camp.basket`, `basketOf`, null till it's made: `makeBasket`, where `basketSpot` allows, inside the ring
and clear of the fire, rocks and trunks) keeps `BASKET_SLOTS` slots of `STACK`, laid out as the satchel's (`bag`, `bagN`), and
a collapse doesn't touch it. `moveBetween` and `moveInto` move a slot between any two of them, `putAway` the whole satchel in.
A camp kept before baskets gets none (`unpackWorld`), no `KEEP_VERSION` bump.
