# Cooking, vessels, the recipe book, eating

At the fire itself (branch `fire-cook`, 2026-10-21, a prototype; `?card` has the window back): no window. The camera eases in on
the real fire (`FIRE_COOK`, `measureCook`, `cookCam`) and the pot's canvas is drawn by the meadow itself where it draws the fire
(`drawPot`: last beat's picture, sorted at the fire's y as any pot over a fire), so the fire looks the same cooking or not: its
flames, bloom and embers, the meadow's dark. The canvas on the page is invisible and only takes the pointer (`potLaid`, `layNear`
keep it on the fire, written only when it moved); its own bed, vignette and flames are left out. Over the pot a ring for each of the vessel's slots (`#cook-slots`, `renderSlots`, plans/pot-panel step 1: "In the pot · 2 of 4";
making, one a piece), filled with a pop as a thing meets the water (`landedMask`), its brass × taking it out; an empty one tapped makes
what would go in glow (`cookPoint`). What it'll make and Cook sit under the stones (`.cook-under`), and the bar at the foot (`.cook-side`) has the Tools and the Satchel under small labels,
the stick, the book and the ✕ ("Step back" on a computer); on an upright phone a sheet of two rows, the satchel on top and under it the vessels it can use or make (locked ones left to the book), the stick, the book and the ✕; over the pot only the rings (no "In the pot" pill), what it'll make and Cook side by side, a making hint without its flavour line (`.flav`), and the thermometer steps away (2026-10-21: it was cluttered). On its side the same round the pot, the bar one row (the satchel's strip scrolls, the ✕ round), no side card (`sideCard` wants more than 500 px of height: it folds into the line), and the camera fits the rings, the pot and the line between the HUD's top row and the bar (`NEAR_HEAD`, `NEAR_RINGS`, `NEAR_UNDER`). Beside the fire on the right a side card (`#cook-card`, `cardHTML`, step 2; laid by `layNear` clear of the rings, written only when it changes): with the pot empty "You could make", the known dishes for this fire's vessels you have everything for (the last cooked on top, Put in) and those one thing short (Where?: `openFind`, the book on that Finds page), never one not yet made (`couldMake`); filled, "This will make" from `potWord`, the dish on a plate with its pips and Cook · its time. On an upright phone and under 600 px it folds into the line under the stones (the first suggestion as one button). While it cooks
(step 3) the rings, the card and the satchel's part of the bar go, leaving the stick and the ✕ (the fire must still be kept lit), and
a small card over the pot where the rings were (`#cook-timer`, `renderTimer`) says the dish's name ("Something new…" for one never
made, "Cooking…" for a mess), the seconds left in ember orange and a bar filling (`--cook-p`); rewritten only when the second
changes. The meadow's bar isn't drawn at the fire you're at (`drawCookBars`): walk off and it takes over. The first time, a toast
says it keeps cooking without you (`cook:bubbling`). Done, the card names the dish with its pips (or the mess) while it rises out,
a little higher so it's clear of it (`j.made`, `REVEAL_MS` and a bit), then the rings, the bar and "You could make" come back. The camera comes no closer than the meadow is painted for (`nearMost`: the forager's painting,
`furTop`, stretched at most `NEAR_STRETCH`, the most a phone already shows it at 64): at 240 the prototype blew the meadow up four
times past its paintings into a blur. So the pot is the meadow's size, about 90 px across on a computer, 150 on an upright phone (`NEAR_POT`).  The pot
and the bowl stand `POT_LIFT` up on three green sticks charred at their feet, the shadow close under on the coals (`kw.under`, a
painting each; the hanging stand of forked sticks and a crossbar is gone, 2026-10-21), and
`litByFire` lights its belly, lip and lugs from below, flickering (`kw.lit`). (When the canvas was shown over the meadow it had
its own dusk, small flames, sparks and glow to fake the fire it hid, and the fire looked different while cooking: 2026-10-21.)

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
`potPrune`) till cooked; a tap on one floating lifts it out with a drip and it flies back to its tile (`potTake`), and a small red cross at the pot's corner (`#cook-empty`, only with something in it) lifts them all out (`emptyPot`). The camp's basket is to hand at any fire standing in camp (`basketAtHand`: `S.inCamp` under the fire, so wherever in the ring the basket was set down it counts), and its things are a row of small tiles under the satchel's (`#cook-basket`, 40 px, 46 on a touch screen, 38 in a short window; it never grows the window: three rows then a scroll, on a phone on its side what the satchel leaves, upright one row scrolled sideways: `renderCookBasket`, `kw.bslots`, rewritten only when what's in it changes, hidden when it's empty or out of camp), each ringed as a satchel's is when it would go in the pot (or on the fire) and the rest let down. A tap takes one straight out of the basket (`potAddBasket`): into the pot, or a stick on the fire, the satchel out of it, so a full satchel is no reason a thing kept at camp can't cook. The pot remembers the store each thing came from (`ui.fire.src`), holds its tile back there (`potHeld`, `potPrune`) and spends it there at Cook (`spendPot`, `potStillThere`; sim.js `storesAt`, `storesPut` — the satchel first, then the basket while the fire stands in camp). Each change is sent (`sendBasket`), so a friend sees it leave. A fire lit outside the ring cooks without it: the row's gone. A vessel over a fire
when you're not cooking at it (left cooking, or the one last cooked in) is the cooking's very own painting, so the fire looks the
same cooking or not: `meadowVessels` paints `paintCookPot` and `VESSEL_PAINT` again a size apart from the window's (kw's fields
swapped out and back), in fire units, at sizes doubling (8 to 128 px of half-width, drawn scaled between), and `vesselOver` lays
its sticks, back, broth, things, front and the fire's light on it (as `litByFire`). What's in it sits down in it (`layThings`,
placed by `kw.at` as the window places them, `VSL_SINK`: its lower part hidden under the
broth or down in the bowl, the pot's seen dimly through the broth with a ring round it) and moves while it cooks: round the pot with
the stirring and bobbing, tumbled in the bowl, hopping on the griddle and the stone, turning on the spit. Under the pot what it will make (`potWord`: a
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
headline (`firstTime('dish:' + name)`, which `knownDish` reads with recipes.js `known`). Walking off, a click on the meadow,
✕, E, Esc or Back leave the
fire (`closeCook`, `cardAway`, `stepOut`) and the pot keeps cooking on the fire (sim.js `cookOn`, on the fire's clock, only while it's lit): the pot
stays on it, steaming (`drawAwayPots`), with a slim bar over it filling as it cooks (`drawCookBars`: ember orange, grey while the fire's
out, gold and pulsing once done), a hover saying the time left in the line over the satchel (`fireSaid`, `hoverSay`) and a "Ready" by it (event 'cooked'). A done dish waits in the
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
field journal (main at 1d79f03): a book laid open on the meadow over a soft scrim (`#book-scrim`, which doesn't take the
pointer: a tap on the meadow beside it puts the book away, and walks nowhere), the numbered tiles on the left
page in sections (`BOOK_SECTIONS`: savoury, sweet by whether a need is sweet or fruit; `BOOK_PAGES`, No. 1 to N), the page picked
on the right (`bookPageHTML`), turned with ‹ n/N ›, ← → (a capturing listener; the walking keys still walk the forager while
it's open), or a sideways swipe (`turnBook`), a 44 px brass ✕ top right. A page: the dish's picture big on a plate (`dishArt`:
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
The book has two more parts behind titles at the top that are its tabs (`BOOK_PARTS`, `bookTab`; the one open
big, a red dot on the others when they have news). Finds (2026-10-16): a page for every ingredient in recipes.js (`FIND_PAGES`, in `FIND_SECTIONS`:
mushrooms, greens & flowers, fruit nuts & honey, for a fire), found once it's been picked into the satchel ever (`foundIt`: the
firsts, as the first find's headline). Found, its satchel painting, its `text`, good raw or cook it first, how much it fills, where
to find it (recipes.js `where`), and what it goes into (`findUses`: the book's dishes that take it, a known one a tap to its page,
the rest a ?; the campfire for the sticks). Not found, the painting's shadow and "Where to look". A page is keyed `bookUi.pick`
(a dish's name, 'find:' + the id), and paging stays within its part (`pageBy`). A new find tags its tile "New" and stamps
"Found!" but doesn't make the book button glow (there are too many finds early on); shutting the book has seen the news of the
parts shown (`bookUi.shown`), and a book kept from before the finds counts what's been found as seen.
You, the third, is the forager's own sheet (the face, days, feeling, vitals, what's on and the skills) and a page for each
skill, from a tap on the face or I (`openYou`, `youSheetHTML`, `skillPageHTML`; `.claude/docs/forager-body.md`).
Finding it: near a lit fire with something to cook (`bagFood`) a small painted pot bobs
over it, with an E key where there's a keyboard (`drawCookPrompt`, `PROMPT_ART` painted once; a click on it is one on the fire,
`hintAt`); making camp the forager thinks "I could cook something on this fire" (`think`, `CAMP_COOK_LINE`), and now and then it
muses on a dish it doesn't know from what's in the satchel (`hintTick`: `HINT_EVERY`, `HINT_GAP`, never in the intro or the
opening storm or over another line), telling the book up to `hintMost` of it. The dishes are painted in dishes.js (`Dishes.paint`,
'dish:' + n in `ITEM_ART`, so into `itemSheet`; big on a book page once a size, `dishBig`), every one of them now; a new dish keeps its emoji till
it's painted. Eating: a tap on food in the satchel (`eatAsk`, `#eat`) shows its name with an Eat button, or why not
("It wants cooking", "I'm full"); `eatSlot` starts a meal (`startMeal`, `fg.meal`, run each frame by `mealTick`): the forager stops and eats it a mouthful at a time, by how it's eaten (recipes.js `eats` on a dish, else by its vessel, `EATS_BY_VESSEL`; picked things by their tags: `eatsOf`). The ways are a table built once (`EAT_WAYS`): spoon (dipped, then up to the mouth), hand (bitten), skewer (pulled off the stick, face turned), sip (the bowl to its lips in both hands) and fruit (quick small bites), each a few of fur.js's eat paintings (`FORAGER_EAT`: bite, chewA, chewB, sip, blow, dip, tug), with no painting per dish. The rest is held in the other mitten (`drawMeal`: the dish's own sprite, a bitten thing smaller a bite at a time); a hot dish from the hand is blown on first (`EAT_BLOW`, the steam pushed off), a crisp one (`crisp: true`, an apple, a nut) drops crumbs (`dropFly` with `CRUMB_RGB`). Each mouthful sounds sound.js `munch` (game.js `munch`), with `{ group, bite, n, crisp, last, hot, mood, full, under }`: the way it's eaten picks the mouthfeel (`MOUTHFEEL`: a crunch for an apple or a crisp fritter, a tear for bread and meat, a little slurp off the spoon, a long bubbling slurp for a sip, a juicy squish for berries), every bite and chew a little different; a hot dish's two puffs lead into its first mouthful (`hot`, the blow and the dip before it); after the last an "mm" by how it liked it (`mood`: love for a dish, like, a flat hm for raw greens) and a contented sigh if that filled the tummy (`full`); under the lean-to's roof it's closer and duller (`under`). It's all built from `ticks` (a buffer of tiny sharp breaks, `crackBuf`), a jaw `thud`, wet bands and bubbles, kept bright (open to 14 kHz) and nearly dry (`RULES.munch.verb`); the swallow is a "glk" (`gulp`) and the mm a hummed voice gliding note to note, not a tone. Playing together each mouthful goes out as a `'munch'` message and friends hear it where it stands, softer (`heardMunch`). The lab plays each, and whole meals. Only at the end is it swallowed (sim.js `feedForager` / `feedHand`), then a hum if it liked it, a flat face if not (raw greens and mushrooms, the mess). A step, a fall, or the thing gone before then ends the meal and the food is kept. On the seat log it eats sitting (`FORAGER_SIT_EAT`, the kneel view's 25 to 31, `SIT_EAT_OF`); kneeling by a fire with nothing on, it sits down on the ground to eat (`fg.meal.ground`); in the middle of a fire's work it keeps kneeling and only the sounds and the swallow go on. The tummy is the face's second dial (`#v-food`); "I'm getting hungry" and "I'm starving" are said over it (events 'hungry',
'starving'). The ideas card waits while it's at a fire (`askTick`).
Its button by the satchel wears the craft button's plate (parchment, a line-drawn book, the word Recipes; round on a touch screen); while a page has news (`.new`) it takes the craft button's warm ready fill and bloom, with the "New" badge. The painted leather book (`bookIcon`) is only the cooking bar's now.
The hands (2026-10-20, PLAN.md stage 9): a dish out of the pot goes into the forager's hand, not a satchel slot, if the hand is empty (`sim.js hand`, `holdDish`; a mess keeps its way, and with the hand full the dish goes where it did: satchel, basket, ground). It's carried out in front in both hands: a carry pose painted in fur.js for every view, stride and jog (`carryPose`, `carryArt`, kept after the emotes; one set of paintings whatever the dish, asked for only while the hand is full, `foragerAhead`, `keptPose`), its steps a little shorter (`CARRY_STRIDE`) and its bob halved so the dish rides steady, no idles while it holds one. The dish is its own painting from the sprite cache laid at the mittens (`drawHeldDish`, `dishAt`, `CARRY_SPOT` by view; from behind the body hides it). So it doesn't look pasted on (2026-10-21): it goes with the hands, moved by the pose's bob and lean (`CARRY_HOLD`, worked out once from fur.js `carryHold`) and laid as the figure is, squashed, shivering and tipped about the feet (`layHeld`, from what `drawFigure` keeps on `b.fs`, `b.fk`, `b.fr`), and sunk with it wading (`WADE_SINK`); the near mittens are painted again on their own over it (fur.js `MITT_ART`, one small painting: side on the near one, from the front both, on the bowl's sides, `CARRY_HANDS`); and it's painted finished as the forager is (`HELD_ARTS`, `paintHeldDish`: softer, muted a little, lit along its top and shaded underneath, the fur's grain and soft edge; the recipe book keeps the crisp `dish:` one). It rides on a little spring (`dishSpring`) that each foot down at a sprint knocks, so it bobs and tips; while there's some left to lose it slops a couple of drops (`slop`, `dropFly`: a ring of typed arrays, drawn over all that stands in `drawSpills`) and sloshes (sound.js `slosh`). The sim keeps how hot it still is and how much is left (sim.js `handHeat`, cold in a quarter day, not by a fire; `handFull`, `HAND_SLOP` a sprint tick down to `HAND_LEAST`): eaten it fills by what's left, and gone cold it no longer warms (`feedHand`). The steam over a warm one (`HAND_STEAM_ARTS`, painted once) fades with the heat. A stumble with it still hot (`HAND_HOT`) drops it (event `'spill'`; the forager stops): it tumbles ahead (`spills`, `SPILL_MS`), splashes, clatters (sound.js `spill`), lies tipped a moment and leaves a stain (`stainAt`, `drawStains`: one soft splash painted once, laid flat by the footprints, fading over `STAIN_MS` on their clock), and says so; friends see it fall (`'spill'` message). Without the carry painting (kneeling, a painting not in yet) the dish goes back to where the hand was (`HAND_UP`). A click on the forager (or H) opens the satchel's small Eat card over it (`eatAsk` with `HAND = -2`): Eat (sim.js `feedHand`), Put away into the satchel (`putHandAway`, flown to its tile; full says so), 🎁 Give and 🙏 Offer as the satchel's are (`giveSlot`, `offerSlot`, from the hand). Since it isn't in the satchel, the line over the satchel names it with nothing else to name (`handSay`: "in your hands · tap yourself", H on a keyboard), and a slot picked by hand (a tap, its number key) puts it away first (`pickSlot`), so picking the rod with a dish in hand gets you the rod. The basket's Put all in takes it too (`larderAll`). In the cooking window the dish's reveal flies to the forager (`kw.reveal.hand`); a collapse loses the hand with the satchel (`wakeForager`), and playing together it goes in the `'pos'` message as a dish index so friends draw it too.
The clay pot is a thing in the meadow (PLAN.md stage 12, steps 1 and 2, 2026-10-22: a placeholder look and feel, to be played
and tuned; the comments over game.js `POT_JOBS` and sim.js `POT_EVERY` have it all). It's made as before (the clay pot's craft
at a fire), and sits on that fire; from there it's carried in both hands (sim.js `f.hand` is `'pot'`, `takePot`; the carry pose
as a dish's, the pot's painting by its water at `POT_HELD` a dish's size: `potLook`, `drawHeldDish`'s `big`). Lift in the
cooking bar (`#cook-lift`, shown while the pot is on that fire with nothing cooking: `liftPot`), a tap on it where it stands
(`potAt`, `useAt` kind `'pot'`, `goPot`: from a dry spot beside it, else wading to it in the shallows, `wadeTo`; one the deep water came over washes up on the nearest dry ground, sim.js `potAshore`), or a tap on a cold fire it sits on with nothing to do to the fire, picks it up.
Carrying it (`potTap`, first in `click`): a tap on water walks to the bank or into the shallows (`scoopFrom`) and fills it
a scoop at a time (`fillFrame`: `SCOOPS` of `SCOOP_MS`, a plop and a slosh each, the placeholder for a glug; sim.js
`fillPot`, `POT_SCOOP` a third), a tap on a fire sets it on (`goPotFire`, sim.js `potOnFire`; E too, through `clickFire`),
a tap on the forager or H sets it down a step ahead (`potDown`, sim.js `setPot`). Each is a job at a spot as the fire's are
(`goFire` with its own `at`, kinds in `POT_JOBS`, the `'set'` kneel or the `'fill'` one: `potArrive`, `potSet`). Sprinting
with it slops water out (drops of `WATER_RGB` and a slosh, from `slop`), a stumble splashes some (`'potslop'`). Off a fire
it's one painting by how much water is in it (`POT_WATER`, 'vsl' parts `potF0` to `potF3`: dry, a third, two thirds, full,
`potStep`), steaming while it's hot (`drawGroundPot`, in render's sorted loop; it has a `fire` field, so it's dispatched
before the fires). Over a fire it's the cooking's own pot (`vesselOver`, `drawCookView`): `paintCookPot` paints its inside
once a level (`kw.backs`, the water lower by `kw.wdy` till it's a crescent at the foot of the mouth, a sooty floor dry),
and the water is drawn as hot as it is (`boilOf`: steaming, a simmer's few bubbles at the edge, a rolling boil's many and
its face broken pale: `potBoil`; steam as hot as it is), and bubbles in the sound by the nearest one (`potSound`). The
vessel row at a fire has the pot only while it's on that fire; elsewhere its tile says Away (`vesselMode` 'away', and
picking it says to carry it here). Cook in the pot wants `POT_LEAST` water in it; the dish then counts down only while
it simmers (the timer says "Coming to a simmer", `potWarming`), and taken out it was the water: the pot's dry. Its line
(`potState`): on the fire's (`fireSaid`), under the mouse, and while carrying it what a tap would do (`potLine`).
`garden.give('pot')` in dev puts one in its hands (made at the nearest fire if there's none). Friends don't see the pot
move yet (no `'pot'` messages).
sim.js: `w.pots` (in `LATER`; `potOf`, one shape: where, the fire it's on as an index, who holds it, water, heat, and the
blanks for the steps to come: things, boiled, chopped, stirred, burnt, dish). A pot for each fire that made one
(`potsOwed`, from `makeVessel`, `kitTick` and `unpackWorld`, so an old meadow gets its pot on that fire, empty; no
`KEEP_VERSION` bump). `potsTick` every `POT_EVERY`: on a fire it warms toward `fireHeat` (a full pot in `POT_WARM`, 30 s at
1x on a fed fire), off one it cools (`POT_COOL`); simmering it boils down (`POT_BOIL_OFF`, a rolling boil quickest), and dry
with a dish in it it catches (`burnt`, event `'potcatch'`; empty, `'potdry'`). `cookOn` with `inPot` puts the dish in the
pot (`dish`, `boiled` as hot as it was), `fireTick` counts it down only while it simmers (`potCooks`), `cookTake` empties
the water. `potCarried` slops a sprint's share (`POT_SLOP`) and a stumble's (`POT_TRIP`); `potFalls` sets it down where
the forager collapses, so it isn't lost with the satchel.
The chopping block (PLAN.md stage 12, step 3, 2026-10-22: a placeholder look and feel, to be played; the comment over game.js
`BLOCK_BUILD` and sim.js `BOARD_MOST` has it all). A camp build (recipes.js `BUILDS.block`: 4 sticks and a pebble), made from
the make strip as the lean-to is (`placeBlock`, sim.js `blockSpot`, `makeBlock`; friends see it set down, `'block'`), a sawn
round with a board and a flint knife on it (`paintBlock`, `BLOCK_ARTS`: with its board, without, the board alone). A tap on it
kneels the forager there (`clickBlock`, goFire `'chop'`, the `'chop'` stage, `chopping()`); then a tap on a satchel tile lays
that thing on the block (`chopLay`, sim.js `blockLay`: out of the satchel at once) and taps on the block, the forager, E or
the space bar chop it (`chopTap`, sim.js `blockChop`, sound.js `chop` by the way it's got ready), as many taps as recipes.js
`PREP` says by id or tag (`prepOf`: torn greens 3, crushed garlic 2, chopped nettles 4, sliced mushrooms 4, halved fruit 2,
cracked nuts 3; a fish or honey goes in whole). Done, it's on the board (the block's own `bag`/`bagN`, `BOARD_MOST` things, not
in `worldStores`), drawn as a few smaller copies of its satchel painting (`drawPieces`). With nothing on the block a tap lifts
the board into both hands (`liftBoard`, sim.js `takeBoard`, `f.hand` `'board'`, carried as a dish is: `boardLook`); a tap on the
fire the pot's on carries it there and tips its things into the pot's rings (`goBoardFire`, goFire `'cook'` with `tip`,
`tipBoard`), the board back on the block. They're held back on the board till Cook as the basket's are (`potHeld`, `spendPot`),
so stepping away leaves them there. A tap on the block carrying it puts it back; a fall puts it back too (sim.js `boardBack`).
What came off the board is the dish's `chopped` (cookStart, sim.js `cookOn`), for the grade in step 4. `garden.give('block')` in
dev sets one down in camp. Not done: a painting per cut, the knife moving, friends seeing what's chopped, the board's things
drawn while it's carried.

The board at the fire (PLAN.md stage 12, step 3 as it came back from `cooking-lab.html`, 2026-10-22; the comment over game.js
`BOARD_EMPTY` has it all). board.js is the cutting, shared with the lab (tune the feel there): a swipe cuts like Fruit Ninja, a
slow drag from a piece sweeps it, only a sweep takes a piece off the open right edge. In the game it's a scene of its own over
the whole screen, as in the lab (`#boarding`, over the HUD): cooking with the pot, a tap on a satchel or basket thing that wants
getting ready (recipes.js `prepOf`; `boardFor`) lays it on the board (`boardLay`) and the camera goes down onto it (`boardUp`, below): the board
on the camp's grass (board.js `paintBoard` on `paintGround`, one picture a screen size: `boardLayout`, the lab's layout), a
parchment strip at the foot of what else can go on it with how many are left (`boardStrip`: the satchel's, then the basket's),
a note up top that fades (`BOARD_NOTE_MS`), and the brass arrow on the pot's side back to it with the pot's count (`#board-back`).
The meadow isn't drawn while it's covered (`boardHides`). A slow drag from the board's back edge scrapes all of it at once (board.js `scrape`, `SCRAPE`; 2026-10-22, Axel wanted an easier way to sweep everything in). A piece swept off the edge goes into the pot (`boardOff`: the thing's
first piece takes it a ring, `j.cut` keeps its record) and is tossed on out of sight toward it (`boardToss`); once the board's
empty the camera goes back out by itself (`BOARD_EMPTY`), or by the arrow, Esc or Back (`boardShut`), and what went in flies
back in from that edge, one after another, each a picture of its own pieces painted once (`Board.picture`), in an arc down into
the pot (`brd.fly`, aimed where the camera has the pot each frame), falling in as a tapped thing does (`j.land`); in the pot
it's drawn where its satchel painting would be (and again while it cooks: `cutPics`).

The board is a thing in the meadow too (2026-10-22, Axel: the board had no link to the world; he wanted the camera to move in
and the things to fly into the pot). It's the camp's own, made at the make strip (2026-10-22, Axel: a kitchen board didn't
fit a camp in the wild; the player picks one of the two): a **cutting log** split from 6 sticks till there are logs and an axe
(recipes.js `BUILDS.cutlog`) or a **cutting stone**, a flat stone from the shore (`BUILDS.cutstone`; `slab`, a ground find
like pebbles, `place: 'stony'`, rare: `most: 2`). Either is sim.js `w.camp.block` with `kind` `'log'` or `'stone'` (one a camp,
a chopping block kept from before is a log), set down close by the camp's fire (`blockSpot`, `BLOCK_NEAR`; the ghost starts at
`cutSpot`, by the seat log's side of the fire). board.js paints both (`paintLog`, `paintStone`, tried in `board-lab.html`: split
fibre, bark along its sides, end grain; lichen, soot on the fire's side); in the meadow `drawCutter` draws it small and squashed
(`paintBlock` 3 and 4, `CUT_TILES` wide), mirrored right of the fire so its open end faces it. Cooking with the pot at a fire
it's close to (`cutterAt`), a tap on a thing that wants getting ready opens the scene on it; with none it goes in whole and
`boardNone` says once what would cut it. While the scene's on it the meadow draws it
(`drawBoardDown`, after `drawStains`: its picture painted once a size from the board's own and what's on it, `boardSmall`,
squashed by `BOARD_FLAT` to lie flat). Then the camera goes down onto it (`'in'`): a match cut. The meadow's canvases are made
bigger by the browser (CSS `scale` and `transform-origin`, `boardMeadow`: nothing's drawn again, so it's cheap and stretched
only on the way) about the one point that takes the board on the grass to the board on screen (`boardDown`); the board's
scene is drawn over it at the same place, as big and turned up as flat as it's got, fading in over the meadow's own in the
first `BOARD_SWAP` (so the meadow's dark and fog don't make it jump), and the grass fades in for the last of the way, when the
meadow stops being drawn. The board's open edge faces the pot: lying right of the fire the whole scene is mirrored
(`brd.flip`: drawn and read so, the arrow on the left; board.js turns its "3 cuts!" back round). Going out (`'out'`) the
camera rises the same way and leans over to the pot, the board shrinks back onto the grass, and the pot's rings and bar come
back at the end (`boardRest`). A tap while it moves gets it there at once (`brd.skip`). The board stays on the grass, with
what's left on it, till the forager leaves the fire or Cook (`boardReset`). Not done: the scene isn't darkened at night; on an
upright phone the scene's log is fatter (`CUT_TALL`) than the one on the grass, so it changes a little as the camera arrives.
Dragged onto the pot a thing still goes in whole. How many pieces a thing was cut into against `prepOf`'s cuts is the dish's
`chopped` (`choppedOf`, sim.js `cookOn`), for step 4's grade. The satchel's head says "click to cut, drag into the pot" (`bagWord`).
The chopping block build is `gone` (one already made becomes a cutting log).

Stirring, and the grade (PLAN.md stage 12, step 4, 2026-10-24; the comments over game.js `STIR_TURN` and sim.js `potStirs`,
`potGrade` have it all). A dish in the pot asks for a stir one to three times as it cooks (sim.js `stirsOf`, `potStirs`, in
`potsTick`, only while it cooks), each for `STIR_WAIT` ticks; the pot keeps `asks`, `stirs`, `ask` and its `stirred` share.
The spoon (drawCookView's) is still unless the hand takes it round: a drag in the pot's mouth on `kw.cv` (`roundPot`, the
angle about the mouth's middle squashed to a circle; a press starts it within the mouth, wider for a finger) or Space held
(`kw.keyStir`, `STIR_KEY`), both through `stirBy`: it swishes every `STIR_SWISH`, turns the broth (`kw.swirl`, coasting down
when the hand stops; the things go round with it either way, `dir`) and the forager's arm (the `'cooking'` kneel only while
the hand moved in `STIR_IDLE`), and while it asks, `STIR_TURN` meets it (sim.js `stirPot`). Asking: big bubbles welling at one
side (hashed from `asks`), the rim breathing cream, sound.js `blup`, and #cook-timer's `.ct-stirs` dots with `.ct-how` ("Stir
it now", and how till `firsts` has `stir:done`); met (`potstir`) a flash going out (`kw.metAt`) and `blup` met; missed
(`potmiss`) a dark puff low over the broth (`kw.missAt`, `MISS_MS`, `messArt`: low because the card hides what rises) and
`blup` caught. Another pot asking: its bar pulses (`drawCookBars`) and the blup is heard there. Out of the pot `cookDone`
reads `potGrade` and `potMarks` before `cookTake` forgets them: the dish is kept graded (recipes.js `graded`; `GRADES`,
`gradedName`, `plainOf`, `gradeIn`: a good one is its plain name, so every dish kept from before is good), into the hand or a
store as that id, and recipes.js `recipeOf`, `foodOf` (the name, fill and `warmth` by grade), `answers` and game.js
`DISH_IX`, `ITEM_ART`, `itemIx` all see the dish under its grade. The card names it with how each step went (`.ct-marks`,
`GRADED_MS` longer), a perfect one gold (sound.js `dish` with `grade`, two more bells; `PERFECT_PRACTICE`); `f.best` keeps the
best for the book (`bestChip`), and eating it says so ("Mm. Just right", "A bit smoky. Still good").

At the fire itself the forager kneels well to one side, under a corner of the HUD at this zoom: `measureCook` lowers the aim or
comes a little further out till its hat (`COOK_HAT`) clears the top row (`hudOver`). The side card on the left keeps clear of the
first things' note, short of the pot (`layNear`). The roasting stick, griddle, stone and bowl say where things go and what
they do in their own words (`VESSEL_INTO`, `VESSEL_BUSY`), not the pot's.
