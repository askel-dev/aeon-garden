# The journal as a journey: one Dry Year arc (plan, 2026-10-13)

A plan for when the visitors grow past the hedgehog and the heron. The three decisions below are settled
(Axel, 2026-10-13); the rest is a proposal to talk over before building, as CLAUDE.md asks. (A first draft read "one
year" as a real year and paced the journal by the real calendar; Axel meant one Dry Year arc. The real calendar is under
"Left for later".) Steps 1 and 2 of the order below were settled with Axel on 2026-10-13 and are being built; what's
built is marked there.

Built so far:
- **Step 1, the journal's shape** (game.js `CHAPTERS`, `BOOK`, `arcSeason`, `hinted`, `arcTally`). One chapter for each
  season of the arc, as Axel put it: seven, the Dry Year's spring and summer each a chapter of its own (the table below
  has them as one; "5 of 6 in the Dry Year" on the card adds the two up). A chapter with no pages yet isn't shown, so
  for now it's the first spring and the first summer. The tally on the cards counts the kinds seen in that meadow
  (sim.js `w.sighted`), so a second keeper meadow has a tally of its own while the journal keeps everything.
- **Step 2, places and the first visitors that pull against each other** (sim.js `placesDay`, `placeNeeds`, `visitDay`,
  `firstBlocked`; game.js `placeLines`). A pond's water, fish and a tree at its edge (`p.wet`, `p.fish`, `p.perch`), a
  strip's room in the open (`f.clear`), once a day. Dragonflies (the first summer: a pond on its own, no fish, reeds up, in
  summer), the kingfisher (the first summer: fish in it, so dug onto the river or a lake, and a tree at its edge; summer and
  autumn) and the skylark (the first spring: a strip with nothing standing within 8 tiles, spring and summer). Painted in
  fur.js, in the worker as the foxes are. A pond's, a strip's and a hedge's panel says what each visitor still lacks. Their
  first visit comes on 3 days in 4 once the place is ready in its season (`VISIT_SURE`, the hedgehog's and heron's stay at
  1 in 2), and at most one kind comes for the first time a day. Signs (tracks, a feather) are only the first two's still.
  `node balance.js 3 8 journal`, out of the 13 pages built: idle 8.0, keep 11.0, diligent 13.0 (there the diligent keeper
  also digs round a tree on the river's bank and sows a strip in the open). With the other 18 still to come, idle stays
  at about 8 to 10; keep and diligent are where the later steps' visitors come in.

## Why

Axel, on a first sketch of more visitors: "it's way too easy, when you start the game you almost get 5/10 immediately and
a lot of your visitors are coming from ponds, so building your first pond almost lets you get all visitors immediately."
What's wanted: "a journey to find all animals, not something you can do in 5 minutes, without making it boring."

How it goes now (game.js `PAGES`, sim.js `visitorsTick`):
- Half the book is free. The eight kinds that live here go in once you've looked at one up close for a moment
  (`lookAt`, `SPOT_LOOK_MS`), and five of them are about from the first minute.
- Each visitor needs one thing: a pond the frogs have found, or a hedge thick enough to hide in. Once it's there, the
  first visit is a coin flip each morning or dusk (`VISIT_FIRST`), so nothing is rare.
- A visitor's empty page names the tool and has a button that puts it in your hand. Right for the first two; a to-do
  list if every page does it.
- The next visitors first sketched (dragonflies, a kingfisher, starlings) all came to ponds too, so one pond would have
  drawn four.

## Decided (Axel, 2026-10-13)

1. **One Dry Year arc.** The journal fills over a keeper meadow's arc: from the first spring through the Dry Year to the
   came-through card at the start of the winter after (`dryThrough`). That's seven seasons, 35 meadow days: about 12
   minutes of meadow at 1× and 3 at 4×, a sitting or two with the building and the watching.
2. **Real-time gates are fine.** Here: a few shy visitors come only while you're away, so the arc wants a break in it.
3. **Places pull against each other.** What one visitor needs rules out what another needs, in the same spot. A full
   journal asks for a varied meadow.

## The idea

The journal becomes the arc's second scoreboard. Each season of the arc has its own few visitors, each asking for a
particular kind of place, and the last chapter, the Dry Year's, comes only to the places that kept water, flowers or green
through it. So the journal asks for the same work the Dry Year does (water, flowers and cover near where the animals
live), spread over more kinds of place than one pond. An idle keeper gets the kinds that live here and a few more; a
keeper who built varied places early and kept them through the Dry Year gets it all by the came-through card.

## What a visitor can ask for

1. **A kind of place**, not a tool, and kinds that pull against each other (below).
2. **A season of the arc**: its first spring, summer, autumn and winter, the Dry Year's spring and summer (once a meadow),
   and the autumn the rain comes back.
3. **Places together.** The turtle dove wants a tall hedge, a strip and water that lasts, all close: it nests in the
   hedge, feeds on the seed and the bare ground, and drinks at the pond (RSPB).
4. **Another visitor** found first: chains. The hobby hunts the dragonflies, the sparrowhawk the finches at your hedge.
   Viva Piñata works this way: a species appears at the edge of the garden, visits, stays and breeds, each step asking
   for more, often other species already in the garden.
5. **Being away.** The shy ones come only in the away run (`startAway`) and wait till you've looked.

Rare comes from asking for two or three of these at once, never from a low roll. Once a page's place is ready in its
season, its visitor comes within a day or two.

## Places that pull against each other

Each pair can live in one meadow, just not in one spot. Most are in the sim already:

- **Fish or none.** A pond dug on its own never gets fish: they only spread to the water next door (`fishTick`), and a
  dug pond starts with none. One dug onto the river or a lake fills with them, where its water lasts the year. Fish eat
  tadpoles (`TADPOLE_FISH`). So the dragonflies (and the hobby after them) want a pond on its own, the kingfisher one on
  the river.
- **Open or cover.** The skylark and the lapwing want nothing standing near; the hedgehog, the finches, the weasel and
  the turtle dove want a hedge. The kingfisher wants a tree at the water's edge (dig round one: it stays as an island).
- **Long grass or short.** The kestrel hunts long grass full of voles (`w.voles`), out in the open away from the warrens;
  the lapwing wants turf the rabbits keep short, by a warren, with a shallow pond beside it.
- **Wet or dry.** In the Dry summer the egret wants the last water, the hoopoe the baked ground beside the green.
- **Near the water or far.** Not a rule, a choice: a pond far from the water keeps the most green in the Dry Year
  (`dryGain`) and has no fish; one on the river keeps little green and has fish.

So a full journal wants two or three ponds (one on its own, one on the river, a shallow one by a warren), two strips (one
in the open, one by the hedge and the water) and a hedge or two (one running out from the wood): the `diligent` keeper's
meadow, more or less.

## The pages, a menu

31 pages: the eight that live here and 23 visitors. Each chapter is a season of the arc. A page sits in the first season
it can come in, and can come again in a later one where its place still holds.

| Chapter | Visitor | Asks for |
|---|---|---|
| The first spring | rabbit, fox, bee, crow, vole, frog, trout, otter | looking (the vole and the trout: watch a hunter catch one) |
| | heron | a pond the frogs have found (built) |
| | lapwing | a shallow pond on short turf by a warren, nothing standing near |
| | skylark | a strip out in the open, nothing standing within about 10 tiles |
| The first summer | hedgehog | a hedge thick enough to hide in (built) |
| | dragonflies | a pond on its own (no fish), with reeds |
| | kingfisher | a pond with fish, and a tree at its edge or in it |
| | kestrel | long grass thick with voles round a strip, away from the warrens |
| | badger | a hedge running out from the wood; only while you're away, at night |
| The first autumn | goldfinches | a strip that flowered all summer |
| | jays | oaks in acorn (more in a mast year) |
| | weasel | voles thick in a strip beside a hedge |
| The first winter | starlings | a pond with reeds, to roost in at dusk |
| | bullfinches | a thick hedge |
| | sparrowhawk | the finches at your hedge, found first |
| The Dry Year | whitethroat | your hedge's first blossom, in its spring |
| | bee-eaters | a strip still in flower (by the water, so it doesn't wilt) |
| | turtle dove | a grown hedge, a strip and water that lasts, all close |
| | egret | a pond still holding water, with frogs, in its summer |
| | hobby | the dragonflies, at a pond that lasts into its summer |
| | hoopoe | baked ground beside the green (a pond's ring, a hedge's lane), in its summer |
| The rain comes back | fieldfares and redwings | your hedge's first haws |
| | roe deer | a hedge from the wood to the water; only while you're away, at first light |
| | salmon | the river rising at a ford (a meadow with a river) |

- The timing holds for a keeper who starts in the first spring. The reeds come a season after the dig (`REED_DAYS`), so
  the dragonflies come in the first summer. A hedge planted then is young that summer (the hedgehog), blossoms in the Dry
  Year's spring (the whitethroat) and bears its first haws in the autumn after (the thrushes). A hedge planted later
  bears later.
- Bee-eaters nested in a Norfolk quarry in the hot summer of 2022 (BirdGuides), and salmon wait below a river kept low by
  a dry summer till the autumn rain raises it (Stanley Park Ecology): the Dry Year's two ends, both true.
- The owls are off (sim.js `OWLS`). A barn owl over the long grass would be the obvious one; left out while they are.
- `journal-mock.html` had six stand-ins (dragonfly, peacock butterfly, goldfinch, bullfinch, kingfisher, roe deer). The
  butterfly is left out: butterflies are a look over the fields already.

## The pace

- **The first spring:** about a quarter (the kinds that live here, the heron).
- **By the end of the first winter:** about two thirds, if you built varied places early.
- **The Dry Year and the rain coming back:** the last third, and the Dry Year's pages only for places that kept going.
- **At the came-through card:** most keepers about three quarters; one who got ready well, all of it; an idle one, a third.
- **Missed pages aren't gone.** A page from an ordinary season can come in the years after (the meadow runs on), and the
  Dry Year's in the next keeper meadow (the journal is the player's, and Start again keeps it).

## The journal

- **Chapters**, each a season of the arc with its own count, so the first minutes read "The first spring 6/11", not "6/31".
- **A frontier.** This season's and the next season's pages show their hints; later ones stay blank till their season is
  near. The Dry Year's chapter shows its hints from the start, so you can get ready for it (the HUD's ribbon already
  counts down to it).
- **Hints in three steps:** a riddle ("Something blue waits over still water where the fish are"); then, after a glimpse
  or once half of what it asks for is there, plainly ("A kingfisher: it wants fish, and a tree over the water"); and the
  inspector on a place says what it lacks ("No tree over this water for a kingfisher"). Only the first two visitors'
  pages put the tool in your hand.
- **On the came-through card** (and the loss card): this arc's finds, "📖 24 of 31, 5 of 6 in the Dry Year".

## Keeping it from being boring

- Each season of the arc has three to six visitors, and you can see what they are: there's always something to get
  ready for.
- Every need can be seen, in the meadow (reeds, haws, fish rings, the green) and in the inspector. No hidden rules.
- A season is five days, so no rare rolls in it: once the place is ready, the visitor comes within a day or two.
- At most one never-seen kind arrives a day, so a season's pages come one by one, not in a heap.
- A never-seen kind arriving slows the clock off 60× and points at it: the hard part is the place, not catching it.
- Nothing is lost by being away. A shy one that came in the away run waits till you've looked, as the away run already
  waits for the Dry Year.

## In the sim already, and new

Already there: fish only through joined water, fish eating tadpoles, voles in long grass, rabbits keeping the grass short
round the warrens, reeds after a season, the hedge's blossom and haws (`h.blossom`, `h.haws`), nuts and mast years, the
Dry Year's stages (`dryStage`), the ponds that last it (`p.dryLasting`), the green round them and the hedges' lanes
(`w.parched`, `hedgeLanes`), the flowers that wilt (`WILT`), the fords, the away run, and `w.visited`.

New:
- **Place qualities**, worked out once a day for each pond, hedge and strip (fish or not, what stands near, how short the
  grass round it is, its reeds, whether it still holds water or flowers, what else of yours is close), so what a visitor
  asks for is a lookup, never a scan in the creature loop.
- **The away run said so to the sim**, so a shy one can come only then and wait there till it's seen.
- **The salmon**, a look at the fords as the river rises in the autumn after: leaps in the white water `drawFlow` draws there.

Visitors stay as they are now: not creatures, their chances hashed from the day, nothing taken from the meadow, so
`balance.js` prints the same. Each is a few sprites, except a starling murmuration (a few hundred dots): measure `render`
for that one, as CLAUDE.md says. Paint them the way the animal-drawing performance work (another session, 2026-10-13)
settles on.

## Order

Each its own commit, `node balance.js 6 4 v` and `3 4 v plant` printing the same after each.

1. The journal's shape: the arc's chapters, the frontier, hints in steps, the Dry Year's hints from the start, the tally
   on the came-through card. No new visitors yet. **Built** (hints in two steps: a riddle, then plain after a glimpse;
   the inspector's third step comes with step 2).
2. Place qualities, and the first pair pulling against each other: the dragonflies (a pond on its own) and the
   kingfisher (fish, a tree at the edge); then the skylark (a strip in the open). **Built**, with the pacing check.
3. The Dry Year's chapter: it's what makes getting ready count.
4. The rest of the first year.
5. The shy ones and the rain coming back.

With step 2, a pacing check: `node balance.js 3 8 journal`, the `idle`, `keep` and `diligent` keepers, printing which
pages each could have had by the came-through card, and when. Aim: idle about 10, keep about 20, diligent nearly all.

## Open

- Missed Dry Year pages: wait for the next keeper meadow, or can a later heatwave stand in for some?
- 31 pages, or fewer and better painted?
- The journal and the visitors are `?keep` only. Keep it so?

## Left for later

Past one arc, if the journal ever wants a longer tail: migrants that follow the real calendar (Animal Crossing's fish and
bugs have their months, by hemisphere); pages only some meadows can give (pines, a fast stony brook, a lake); a star for
a visitor that settles and raises young; and two or three moments to fill each page (New Pokémon Snap's four photos a
Pokémon, one per star).

## Sources

- Viva Piñata's appear, visit, resident and romance: [TrueAchievements](https://www.trueachievements.com/game/Viva-Pinata-Trouble-In-Paradise/walkthrough/3),
  [Piñata Journal: Sweetooth](https://pinatajournal.wiki/wiki/Sweetooth).
- The turtle dove's hedge, seed and water: [RSPB, advice for farmers](https://rspb.org.uk/helping-nature/what-we-do/influence-government-and-business/farming/advice-for-farmers-helping-bird-species/turtle-dove-conservation-advice-for-farmers),
  [Operation Turtle Dove](https://www.operationturtledove.org/?p=1962).
- Bee-eaters at Trimingham, 2022: [BirdGuides](https://www.birdguides.com/news/bee-eater-flock-leaves-norfolk-after-chicks-fledge/).
- Salmon waiting for the autumn rain: [Stanley Park Ecology](https://stanleyparkecology.ca/2014/09/26/rainy-weather-fishy-pleasure/).
- For later: [Nintendo Life's Animal Crossing bug guide](https://www.nintendolife.com/guides/animal-crossing-new-horizons-bugs-complete-bug-list-times-locations-prices-how-to-catch-tips),
  [Bulbapedia, Photodex](https://bulbapedia.bulbagarden.net/wiki/Photodex).
