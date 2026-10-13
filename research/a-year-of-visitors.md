# A year of visitors: the journal as a journey (plan, 2026-10-13)

Not built. A plan for when the visitors grow past the hedgehog and the heron. The three decisions below are settled
(Axel, 2026-10-13); the rest is a proposal to talk over before building, as CLAUDE.md asks.

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
- Waiting doesn't stretch it: anything that waits on the meadow's clock (a season for the reeds, a year for the haws)
  is seconds at 60×.
- The next visitors first sketched (dragonflies, a kingfisher, starlings) all came to ponds too, so one pond would have
  drawn four.

## Decided (Axel, 2026-10-13)

1. **About a year.** Filling the whole journal takes about a year of checking in now and then. (Taken as a real year:
   a meadow year is about seven minutes at 1×.)
2. **Real-time gates are fine.** The meadow's clock runs at up to 60×, so only the real calendar and coming back can
   stretch it that long.
3. **Places pull against each other.** What one visitor needs rules out what another needs, in the same spot. A full
   journal asks for a varied meadow.

## Two clocks

- **The meadow's clock** (a year in about seven minutes at 1×) paces the near game: places growing, visitors coming and
  going, the meadow's own good and bad years. As now.
- **The real calendar** paces the long game: which migrants are in the country this month, and on how many different days
  you've seen a visitor. It never changes the meadow (the meadow keeps its own time); it only decides who can come.

A migrant comes only when both say so: in the country by the real month, and at your place in the meadow's matching
season. Animal Crossing does this with its fish and bugs: each has its months, by the hemisphere the island is in, and
its part of the day. So its museum takes a real year, short of changing the console's clock.

## What a visitor can ask for

Each visitor asks for one or two of these. The rare ones are rare because they ask for two or three at once, not
because of a low roll.

1. **A kind of place**, not a tool, and better still kinds that pull against each other (below).
2. **Another visitor** that has come often enough: chains. Viva Piñata works this way. A species appears at the edge of
   the garden, then visits, then stays and breeds, each step asking for more: a share of some terrain, certain plants,
   often other species already in the garden.
3. **One of the meadow's years**: a vole year (about one summer in four, `VOLE_BOOM`), a mast year (every two or three,
   `MAST_ODDS`), a big frog year (`FROG_BOOM`), a winter that freezes the water (`w.frozen`), a heatwave or the Dry Year,
   a sickness year's remains. They come on the meadow's clock, the news already tells most of them, and the player can
   nudge the odds (long grass grows voles) but can't call one up.
4. **The real month**, for the migrants (the calendar, below).
5. **Coming back.** Some come only while you're away (the away run, `startAway`) and wait till you're back; and a visitor
   seen on three different days can settle (stars, below).
6. **A kind of meadow**: pines, a fast stony brook, a lake. The journal is the player's, not the meadow's, so a second
   meadow opens a few more pages. Keep these few, so one meadow can still get nearly all of it.

## Places that pull against each other

Each pair can live in one meadow, just not in one spot. Most are in the sim already:

- **Fish or none.** A pond dug on its own never gets fish: they only spread to the water next door (`fishTick`), and a
  dug pond starts with none. One dug onto the river or a lake fills with them, where its water lasts the year. And fish
  eat tadpoles (`TADPOLE_FISH`). So a pond on its own is for the frogs, the dragonflies and the grass snake, and a pond on
  the river is for the kingfisher (and the osprey, at a big one).
- **Open or cover.** The skylark and the lapwing want wide ground with nothing standing near; the hedgehog, the finches
  and the deer want hedges.
- **Long grass or short.** The kestrel and the harrier hunt long grass full of voles (`w.voles`), away from the warrens;
  the lapwing wants turf the rabbits keep short, by a warren, with a shallow scrape beside it.
- **New or old.** A pond's reeds come up after a season (`p.reeds`). A reedbed years old (reeds that spread: new) is for
  the reed warblers and the starlings.
- **Wet or dry.** The hoopoe comes only to baked ground in a heatwave, the Dry Year's above all.

## The visitors, a menu

37 pages, more than needed: pick from it. Months are the UK's, rounded (the wildlife trusts, the BTO), and six months
on for a player in the southern hemisphere. "Regulars": a visitor that has come three times.

| Chapter | Visitor | Asks for | When (the meadow's season, or real months) |
|---|---|---|---|
| Lives here | rabbit, fox, bee, crow, vole, frog, trout, otter | looking (the vole and the trout: watch a hunter catch one) | as now |
| First visitors | heron | a pond the frogs have found | built |
| | hedgehog | a hedge thick enough to hide in | built |
| Your places | dragonflies | a pond on its own (no fish) with reeds | summer |
| | kingfisher | water with fish, and a branch or a whip over it | any, not in ice |
| | skylark | a strip out in the open, nothing standing within about 10 tiles | spring |
| | lapwing | a shallow pond by a warren, the turf round it short, nothing standing near | spring |
| | kestrel | a strip in long grass away from the warrens, voles thick in it | by day, spring to autumn |
| | goldfinches | a strip that flowered all summer | autumn |
| | bullfinches | a hedge that bore haws | winter |
| Chains | hobby | dragonflies, regulars | May to September |
| | sparrowhawk | finches at your hedge, regulars | winter |
| | grass snake | a pond on its own, thick with frogs | summer |
| | cuckoo | reed warblers settled in your reeds | April to June |
| The meadow's years | jays | a mast year, oaks about | autumn |
| | hen harrier | a vole year, long open grass | October to March |
| | waxwings | a frozen winter and a hedge heavy with haws | November to March |
| | white stork | a big frog year | April to August |
| | hoopoe | a heatwave on bare ground (the Dry Year's) | summer |
| The calendar | swallows | a pond with open sky over it | April to September |
| | swifts | a summer evening | May to August |
| | reed warblers | a reedbed | April to September |
| | fieldfares | haws, or windfall apples | October to March |
| | starlings | a reedbed years old, to roost in | November to February |
| | osprey | a big water with fish | March to April, August to September |
| Shy ones | roe deer | a hedge from the wood to the water; comes only while you're away | first light |
| | badger | a hedge running out from the wood; only while you're away | night |
| Far meadows | red squirrel | pine country (`w.pineLand`) | any |
| | dipper | a fast stony brook | any |
| | great crested grebe | a lake | spring |

- A migrant that also wants the meadow's season (the swallows want its spring and summer) comes only then, while its
  months last. At 1× that's every seven minutes, so in its months it's easy; out of them it can't come.
- Every real season has three or more: spring (osprey, swallows, cuckoo, reed warblers, stork, swifts), summer (swallows,
  swifts, hobby, reed warblers, stork), autumn (osprey, the last swallows, fieldfares, harrier, starlings, waxwings),
  winter (fieldfares, starlings, harrier, waxwings).
- The waxwings ask for three things (a frozen meadow winter, a hedge in haws, the real winter): the rarest. Real
  waxwing winters come when Scandinavia's rowan berries fail; there were two big ones in 2008 and 2010 (BTO).
- The owls are off (sim.js `OWLS`). A short-eared owl over a vole year would be the obvious one; left out while they are.
- `journal-mock.html` had six stand-ins (dragonfly, peacock butterfly, goldfinch, bullfinch, kingfisher, roe deer). The
  butterfly is left out: butterflies are a look over the fields already.

## The pace

- **The first session:** about a quarter: the eight that live here, the hedgehog and the heron, maybe a migrant in season.
- **The first week or two:** about half: your places, the first chains.
- **The first three months:** about three quarters: the meadow's years, this season's migrants and the next's.
- **The rest of the year:** the other seasons' migrants, the rarest years, the stars.
- **Most visits find something:** a new page, a moment on one, or a hint coming into reach.

## The journal

- **Chapters**, each with its own count: Lives here, First visitors, Your places, Chains, The meadow's years, The
  calendar, Shy ones, Far meadows. Five found reads as "Lives here 5/8", not "5/10".
- **A frontier.** The next two or three pages show their hints; the rest stay blank till one before them is found. A
  chain's page opens once the visitor it asks for is found.
- **Hints in three steps:** a riddle ("Something blue waits over still water where the fish are"); then, after a
  glimpse or once half of what it asks for is there, plainly ("A kingfisher: it wants fish, and a branch over the
  water"); and the inspector on a place says what it lacks ("No branch over this water for a kingfisher"). Only the first
  two visitors' pages put the tool in your hand.
- **The calendar page:** who's in the country now, and who's leaving soon. A migrant out of its months says when it's back
  ("Back in April"), so the player knows it's the calendar, not them.
- **Moments.** A sighting starts a page; two or three moments fill it, from what the game already does: a fox's pounce on
  a vole, a rabbit in its white coat, cubs out of the holt (`cubsout`), a swarm (`swarm`), a heron with a fish, a hedgehog
  curled up asleep. A page with all its moments gets a mark. New Pokémon Snap does this: four photos a Pokémon, one for each
  star, the stars for how unusual the thing it's doing is, and a crown once all four are in.
- **Stars.** A visitor seen on three different days, at a place with all it needs to breed, settles there: hoglets under the
  hedge, a kingfisher's nest in a steep bank, reed warblers in the reeds. A star on its page.

## Keeping it from being boring

- Always two or three pages within reach, with their hints.
- Every need can be seen, in the meadow (reeds, haws, fish rings) and in the inspector. No hidden rules.
- No grind: nothing asks to be seen ten times. The three days for a star are any three days.
- A rare one gets likelier each day its place is ready and it hasn't come, so bad luck can't stall anyone for good.
- At most one never-seen kind arrives a meadow season, so even a perfect pond shows its visitors one by one.
- A never-seen kind arriving slows the clock off 60× and points at it: the hard part is the place, not catching it.
- Nothing is lost by being away. A shy one that came in the away run waits till you've looked, as the away run already
  waits for the Dry Year.
- The calendar never asks for a certain day: a migrant's months are two to six long, so any few visits in them do.

## In the sim already, and new

Already there: fish only through joined water, fish eating tadpoles, voles in long grass, rabbits keeping the grass short
round the warrens, reeds after a season (`REED_DAYS`), haws (`h.haws`), windfalls (`d.apples`), mast, vole and frog years,
freezing winters, heatwaves and the Dry Year, remains (`w.carcasses`), pines, brooks and fords, lakes, the away run, and
`w.visited` (how often each kind has come).

New:
- **Place qualities**, worked out once a day for each pond, hedge and strip (fish or not, what stands near, how short the
  grass round it is, how old its reeds are), so what a visitor asks for is a lookup, never a scan in the creature loop.
- **A reedbed that grows**: a pond's reeds spreading a little each year from `p.reeds`.
- **The real month and the hemisphere**, handed to the sim by game.js (a field in the world's blank, `LATER`; node gives
  a fixed month). It touches the visitors only, so `balance.js` prints the same.
- **The days a visitor was seen**, kept with its page (the player's, in `JOURNAL`), for the stars.
- **The away run said so to the sim**, so a shy one can come only then and wait there till it's seen.

Visitors stay as they are now: not creatures, their chances hashed from the day, nothing taken from the meadow. Each is a
few sprites, except a starling murmuration (a few hundred dots): measure `render` for that one, as CLAUDE.md says. Paint
them the way the animal-drawing performance work (another session, 2026-10-13) settles on.

## Order

Each its own commit, `node balance.js 6 4 v` and `3 4 v plant` printing the same after each.

1. The journal's shape: chapters, the frontier, hints in steps, the calendar page. No new visitors yet.
2. Place qualities, and a pair pulling against each other: the dragonflies and the kingfisher (a pond on its own against
   one on the river), and the skylark (open ground, against the hedges).
3. The real calendar, with a migrant for each half of the year: the swallows and the fieldfares.
4. Moments on the pages of the kinds that live here.
5. The meadow's years: the jays, the hen harrier, the waxwings.
6. Chains, the shy ones, stars, far meadows.

With step 2, a pacing check: `node balance.js 3 8 journal`, a diligent keeper over a few meadow years and a stepped real
calendar, printing the day each page could first be had. It should land near the pace above.

## Open

- The hemisphere: from the time zone, or asked once (as Animal Crossing does), with a switch on the calendar page?
- The journal and the visitors are `?keep` only. Keep it so, or bring them to `?watch`?
- 37 pages, or fewer and better painted?

## Sources

- Animal Crossing's months and hemispheres: [Nintendo Life's bug guide](https://www.nintendolife.com/guides/animal-crossing-new-horizons-bugs-complete-bug-list-times-locations-prices-how-to-catch-tips),
  [Gfinity](https://www.gfinityesports.com/article/animal-crossing-new-horizons-new-september-bugs-fish-sea-critters-guide-tutorial-prices-northern-southern-hemisphere-nintendo-switch).
- Viva Piñata's appear, visit, resident and romance: [TrueAchievements](https://www.trueachievements.com/game/Viva-Pinata-Trouble-In-Paradise/walkthrough/3),
  [Piñata Journal: Sweetooth](https://pinatajournal.wiki/wiki/Sweetooth), [Giant Bomb: Flutterscotch](https://giantbomb.com/wiki/Concepts/Flutterscotch).
- New Pokémon Snap's four photos a Pokémon: [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Photodex),
  [PokéJungle](https://pokejungle.net/new-pokemon-snap/rating-star-guide/).
- The migrants' months: [Cheshire Wildlife Trust](https://www.cheshirewildlifetrust.org.uk/node/2232),
  [RSPB, autumn arrivals](https://rspb.org.uk/birds-and-wildlife/autumn-arrivals) (redwings from October),
  [BTO, waxwing](https://www.bto.org/learn/about-birds/birdfacts/waxwing) (from late October, into early spring; big
  irruptions in 2008 and 2010).
