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

- Drag a line: a hawthorn every 1.5 tiles, one hedge (`w.hedges`), one news line and one row in Yours.
- Planted as two-year-old whips, big enough to see from the start, and never too small to draw. A line of
  turned earth under them.
- A hedge grows about 3 times as fast as a wild hawthorn: young within two seasons, blossom the next spring if
  planted by early summer, haws that autumn.
- Cover, as little as works: a rabbit running from a fox with no burrow nearer makes for a hedge, and the fox
  loses it there ("Juni dived into your hedge"). Only hedges do it, so the meadow you watch is as it was.

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

- **Step 2, the pressure:** drought, a long winter or farmland creeping in; six years to the Dry Year or three;
  whether a species leaving is loss enough, or someone has to say it. The ghost's "dries in summer" and the
  green by the water are already the drought's hooks.
- **Step 3, the first year:** a valley made by hand or a generated meadow; a keeper you can see, later or never;
  the owls; the game's name.
