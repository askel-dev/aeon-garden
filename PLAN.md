# Plan: from watching to keeping, step 1 (three verbs, no goal)

Agreed 2026-10-10, from the doc "Nobody's Meadow: from watching to keeping". Replaces "make a home, see who
moves in" (2026-10-05, never built). The Field (a keeper game for two, 6167231..974fa94) was reverted as not
fun; its plumbing may be reread, its design stays out (no hours, no Surveyor, no worn soil, no needs check).

The meadow is to become a management game on Frostpunk's frame: a pressure on a timeline (the pitch is a
drought), a few means the meadow gives back, and hard calls. Before any of that, one question: **is shaping
this land fun on its own?** The last attempt never got past it. Its tools had no impact you could see, and
what they did took too long to show.

So step 1 is three verbs on the meadow as it is, the god tools gone, and a small seed pouch. No goal yet.
Every verb keeps four rules:

1. **The picture changes the instant you act.** A pond is water at once, a hedge a row of young plants.
2. **Then it grows along a path you can see.** A ghost of what it will become while you place it, and the
   next stage when you look at it.
3. **The land moves on the clock you decide on.** A planting matters within two or three seasons.
4. **You can work while it's paused.**

Settled: the verbs are pond, hedge and flower strip; time runs, with pause; the player is an unseen hand
(nothing walks over to do the work, so it happens at once); and it all lives at `?keep` until it plays
well. The bare address stays the meadow you watch, with every tool it has now.

## Why it failed before, in the code

- A planted tree starts as a sprout too small to draw at the wide shot (game.js `SEEDLING_PX`). All you saw
  was a 🌱 puff.
- A sown flower patch waited for its season to come round, up to a year.
- Frogs spread a tile at a time, and only near water, so a pond dug away from the river never got any.
- Crows look for better grubs only when hungry, so turned earth drew nobody.

## What the research said

From the doc's brief (Terra Nil, Timberborn, Against the Storm), 2026-10-10:

- Every placement changes a patch of ground at once, with a sound of its own; the slow growth comes on top
  of that, never instead of it (Terra Nil).
- Say what a placement will bring while you place it (Terra Nil's number before you commit).
- Something alive turns up within minutes: the animals coming back is what players remember.
- Mistakes are cheap: an undo (Terra Nil), free moves (Against the Storm).
- Green by the water and brown elsewhere is a goal nobody has to say (Timberborn). The ground shader already
  greens the grass by the water, so a dug pond greens its banks on the spot.
- Kept for later steps: the first drought gentle and the next ones harder (Timberborn), the water dropping
  before the drought proper, a clock with a face (Against the Storm's Queen), and a tutorial that teaches
  one cause and its effect at a time.

## The stages

Each its own commit. Before the first, keep `node balance.js 6 4 v` and `node balance.js 3 4 v plant`: after
every stage they must print the same, seed for seed, since everything new is for `?keep` only.
`node balance.js 3 4 keep` grows with each verb.

### K1. `?keep`

- `createWorld(seed, { keep: true })` sets `w.options.keep`. A keeper meadow is the full generated one, never
  the empty arrival, with no welcome, intro, guide or things to try: one small card says what you can do.
- Its link has `&keep`, so it's kept apart: the bare address never opens a keeper meadow, nor the other way,
  and each keeps its own few (`KEEP_MEADOWS`).
- Gone at `?keep` (hidden, not deleted): releasing animals, 🌱 Grass, 🌳 Plant, ⚡ Zap, 🔥 Fire, picking the
  weather or locking it (the sky button just shows it), picking animals up, the meadow filming itself, and
  their keys. A key with Ctrl or Cmd held never picks a tool.
- Kept: Look, the inspector, naming and Yours, the news, the graphs, the food web, the sound, the away card.

### K2. The pond, and the hand that places things

- Every verb is a drag: a ghost shows what you'll get, letting go makes it, Esc calls it off. It happens at
  once, paused or not, and the ground and the water show it in that frame. One finger places, two pan and
  pinch; with a mouse you pan with Look in hand.
- Draw a pond (K2b, after Axel's "would be nice if you could just drag the cursor and draw the water"): a drag
  paints water along the way like a brush (`POND_BRUSH`, about 1.8 tiles, up to `POND_TILES` a stroke), and a tap
  digs a small round one. The ghost shades each tile by what it will be: water all year, a spring pool that dries
  in summer (the frogs' favourite, and a gamble), or too high for water. Grown trees, a hive's tree, rocks,
  burrows and flower fields under the brush are red, and stay as islands: a pond never drowns anything you didn't
  see coming. A line says what it will bring ("Frogs 14 tiles off"). A stroke that touches a pond you dug makes
  it bigger.
- `digPond` digs each tile deeper the further it lies inside the stroke's edge, so how high it stood and the
  shape decide what it becomes. A thin stroke is all shallows (the frogs want no deep water near); a wide blob gets
  a deep middle, where a rabbit escapes a fox.
- Bigger ponds dig deeper (D1): past `POND_SLOPE` (3 tiles in, 0.45 down) a tile goes on deepening, by up to
  `POND_MIDDLE` (0.5) more at `POND_WIDE` (6) tiles in, still never below `POND_FLOOR`. So a blob of 100 to 160 tiles, or
  a pond grown by a few strokes, holds water in its middle on high ground: a 120-tile blob 12+ tiles from any water lasts
  the year (and the Dry Year's low) in 88 to 100% of the open spots on seeds 31, 314, 1000, 9001 and 123, against 65 to
  100% before. `edgeIn` looks out a ring at a time and stops early, so the deeper reach costs no more per tile of a drag.
- A pond of its own: it gets a name and a body in `w.waters` (picked by its own hash, never `w.rng`), and
  `nearBody` is filled again round it (the fill split out of `nameWaters`, which reshuffles every name).
- Its banks are turned earth: bare, and rich for a few days. Crows come down to them (`turned`, like the
  crows' `tadpoles`), the way crows follow a plough. The grass comes back in two or three days.
- Frogs find it: from spring to autumn, frogs within `FIND_REACH` of a dug pond with few about it send a few
  over, and the first time is news ("Frogs found Kingcup Pond"). They spawn there the next spring.
- Reeds and lilies come after its first spring. The inspector says when it was dug, whether it lasts the
  summer, and what comes next.
- The spade is free; the ground limits it. If people dig everywhere, it joins the pouch.

Then a quick look: five minutes of digging ponds, before anything else is built.

### K3. The flower strip

- Drawn like the pond: a stroke sows a strip about 2 tiles wide along the drag, up to `STRIP_TILES` (30) tiles,
  a field like the made ones (`w.fields`, `strip: true`), with a few blobs along the line as its shape so the
  bees fly to it as to any field. Water, trees, burrows, rocks and fields under it are skipped.
- It's a meadow mix: at each season's start it turns to that season's flower (winter waits for spring's),
  so it always blooms within a season.
- Sown, it's bare earth at once (rich, for the crows), with sprouts, and the soil is dug over to at least
  `STRIP_SOIL`; it blooms when the grass is back past `FIELD_GRASS`: within a day in spring, two to four in
  summer, and sown after autumn's first day it waits for spring. Bees, butterflies and voles find it.
- At most 127 fields (`fieldAt` is an Int8Array). Fields that spread and die wait for after this step.

### K4. The hedge

- Drawn like the pond and the strip (🌿, H): a drag plants a hawthorn whip every `HEDGE_GAP` (1.5) tiles along the
  line, up to `HEDGE_MOST` (20) a stroke, and a tap plants one. The ghost is a dot at each whip, red where it's skipped:
  water (a dug pond too), ground the spring flood reaches (the whips drowned there), a flower field, within 2 of a
  burrow or a hive, or too close to a trunk or a rock. The label says how many whips, when it hides a rabbit and when
  it blossoms (`hedgeForecast`), and when it goes on with one of yours: a stroke that starts or ends within 2 of a whip
  of a hedge makes that hedge longer.
- One hedge (`w.hedges`, made on the first, its name by hash), one news line and one row in Yours. Each whip is a tree
  of `w.decor` with `d.hedge`, living by `treesTick`: planted two years old at about 1.1 (`HEDGE_WHIP`, so the age gate
  for bearing is met), growing to about 3 (`HEDGE_MAX`, a hedge and not a row of trees), `HEDGE_GROW` (3) times as fast
  as a wild hawthorn, guarded by its own thorns, and never shading out its neighbours. It's never too small to draw
  (game.js `HEDGE_PX`, 12 px), and under it is a line of turned earth (the grass gone, the ground rich, the crows come).
- Measured (a year is 20 days): planted on spring's day 1 it's young (hides a rabbit) at the start of summer, 4 days
  on; planted early in summer, early in autumn; planted mid-summer or in autumn, at the start of spring. Planted any
  time up to the end of autumn it blossoms the next spring (its day 2 to 4) and bears haws that autumn; planted in
  winter it waits a year for both (faster than planned for a spring or early-summer planting). The news
  tells each once (`hedgeyoung`, `hedgebloom`, `hedgehaws`: the haws only after the blossom, and once they show red).
- Cover, as little as works: a rabbit running from a fox with no burrow nearer makes for a young whip within 8 by the
  burrow's rules (`hedgeRefuge`, through the decor grid), and within 0.8 it's in the hedge: it creeps in behind the
  stems, crouched, and sits tight while the fox is close (`c.covered`, `inUnder`). The fox loses it there and passes
  it by (`hunt`): "🌿 Juni dived into your hedge, Thorn Row, and Marmdle lost it" (the first into each hedge always
  told). Only hedges do it, so the meadow you watch is as it was: `node balance.js 6 4 v` and `3 4 v plant` print the same.
- `node balance.js 3 4 keep` plants one by a busy warren on day 1 (`nohedge` leaves it out): 5 to 58 rabbits get away
  into it in three years, in bursts while a fox hunts that warren, and over 10 seeds the rabbits' most is 440 with it
  and 435 without, their mean 244 and 220 (seed by seed it goes both ways, -101 to +141): no boom.

### K5. The pouch

- `w.pouch`: whips and seed packets, about 12 and 4 to start. The counts show on the tools, and the ghost
  dims what you can't afford, so nothing is turned down after you let go.
- Each autumn: two packets from each strip that bloomed, a whip from each hedge plant past young, a little from
  the wild flowers and thorns, each up to a cap. The harvest is news and heads the away card in autumn.

### K6. Undo

- ↩ or Ctrl/Cmd+Z takes back the last thing you placed, that same day, and gives back what it cost.

### K7. The test

Play `?keep` for 15 minutes, mostly at 1× and 4×. Note every "I wish I could…" and every stretch with
nothing to watch. It passes if you want more: say, if digging a pond and watching the frogs find it is good
on its own. Then one or two people who've never seen it. If it fails, the notes say which rule broke.

## After this step (settle first)

- **Step 2, the pressure (pulled forward, 2026-10-11).** K1 to K4 were built and played. Axel: "I'm just worried
  the things you do just look random with no purpose." In Frostpunk the cold is everywhere and the generator's heat
  circle shows what to do at once; here the meadow gets by without you, so the verbs answer needs nobody can see.
  So the pouch (K5) waits, and the pressure comes next. Settled:
  - **A drought, the Dry Year, on a clock:** ordinary years round it, and a warning a season or more ahead (the
    water dropping first), so the years before have a reason.
  - **Losing is the meadow going barren and species going extinct.**
  - The picture first: a mock of the Dry Year (straw away from the water, green rings round it) next to a summer
    now, and a pond dug in it, to see if it says "dig here" before any sim is built.
  - Open: how many years to the Dry Year; the one number on screen (the share still green?); what the hedge does
    in a drought; the result at summer's end.
- **Step 3, the first year:** a valley made by hand or a generated meadow; a keeper you can see, later or never;
  the owls; the game's name.
