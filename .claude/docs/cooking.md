# Cooking, vessels, the recipe book, eating

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
