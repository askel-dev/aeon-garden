# Painting a dish

How to paint a new dish in dishes.js so it sits with the others. Written so a model that has never seen the file can do
it: read this, then the one dish nearest the new one, copy its shape, and look at it in the dish lab.

## Where it shows, and what that asks of it

A dish is painted once into a canvas and copied after: into the satchel's sheet (`'dish:' + n`, 48 px on screen), the
book's tiles (about 128) and a book page (big, painted at the page's size). So it is drawn at 48 px most of the time, and
seen big now and then. It must read at a glance at 48 and still be lovely big.

- **The look:** storybook, soft-rendered (shaded with soft gradients, not flat vector), a few big shapes, warm. Like an
  emoji painted by hand: one clear thing, not a detailed still life. Axel prefers soft-rendered over flat, and not too
  detailed.
- **Lit from the top left.** Light faces up and left, shade down and right, every part of every dish.
- **In its vessel.** What it was made in tells how it was made: on a stick, on a hot stone, in the clay pan, in a bowl
  or cup. The food is built from its ingredients' own colours and shapes, cooked: browned edges, char on a roast, a glaze
  on the honeyed ones, a sheen on soup, herbs scattered on top, a wisp of steam on a warm one.
- **Sits on a soft shadow** near the bottom of the box (`sitShadow`), centred, about the same size as its neighbours.

## The box

`Dishes.paint` sets the canvas up so a painter draws in its own box: **x and y from -1 to 1, (0, 0) the middle, y down**,
`lineCap`/`lineJoin` round. Line widths are in the same units (0.02 is a fine line, 0.1 a thick stick). The box has a
margin round it already, so use about x -0.9..0.9, y -0.75..0.75; the shadow sits about y 0.6 to 0.75. The painter takes
just `g` (the 2D context) and paints the whole dish.

## The helpers (from fur.js, at the top of dishes.js)

Colours are `[r, g, b]` arrays; `rgba(rgb, a)` makes a CSS colour from one, `tone(rgb, k, add)` darkens (k < 1) or lightens
(k > 1, add > 0) it.

| Helper | What it does |
|---|---|
| `fillIn(g, colour, () => { path })` | fills a path in a CSS colour (`rgba(...)` or a `'rgba(...)'` string) |
| `strokeIn(g, colour, width, () => { path })` | strokes a path: outlines, stalks, grain, gleams |
| `ovalAt(g, x, y, rx, ry, rot)` | adds an oval to the path (use inside fillIn/strokeIn/softIn) |
| `softIn(g, rgb, y0, y1, () => { path }, lit, dim)` | **the main one**: fills a part shaded top to bottom, lit at y0 (`lit`, default 1.18), dark at y1 (`dim`, default 0.68). Give y0/y1 as the part's own top and bottom |
| `furGlow(g, rgb, a, x, y, rx, ry, rot, hard)` | a soft oval of colour fading to nothing: shade, glow, sheen, warmth |
| `sitShadow(g, x, y, rx, ry, a)` | the soft brown shadow a dish sits in |
| `lumpy(g, cx, cy, rx, ry, LUMPS)` | a stone's lumpy outline (a path; LUMPS an array of about 12 numbers near 1) |

## How a part is shaded (do every big part like this)

1. Its shape as a little path function: `const cap = () => { g.moveTo(...); g.bezierCurveTo(...); g.closePath(); };`
2. `softIn(g, COLOUR, top, bottom, cap)`: the base, lit top, dark bottom.
3. Clip to it and lay soft shade and light inside: `g.save(); g.beginPath(); cap(); g.clip();` then a `furGlow` of a dark
   tone on the lower right (the round of it), a light one upper left, browning or char where it cooked; `g.restore();`.
4. An edge where it needs one: `strokeIn(g, rgba(tone(COLOUR, 0.6), 0.6), 0.014, cap)`.
5. The gleams last: a curved `strokeIn` of near-white at 0.7 to 0.9 alpha on the lit side, and a few tiny white `ovalAt`
   dots. These are what make it look wet, glazed or glossy at 48 px.

Paint back to front: shadow, the vessel's back and hollow, what's in it, the vessel's front rim, then steam and gleams.

## The vessels already painted (reuse one, don't paint a new bowl)

recipes.js gives each dish a `vessel` (stick, stone, pan, pot, bowl). Painted so far:

| Vessel | Helper / where | Used by |
|---|---|---|
| a green stick, bark at the hand, charred tip | `greenStick(g, ax, ay, bx, by)` | Roast mushrooms, Roast wild garlic, Roast dandelion roots, Mushroom and garlic skewer |
| a hot flat stone | `lumpy` + `STONE`, `STONE_LUMPS` in `paintBakedApple` | Baked apple with honey |
| a slate | `lumpy` + `SLATE`, `SLATE_LUMPS` in `paintGarlicMushrooms` | Garlic mushrooms |
| the carved wooden bowl | `woodBowl(g, inside)`, rim at `BOWL` | Spring salad, Warm bramble compote, Toasted hazelnuts, Watercress soup, Hazelnut brittle |
| the clay bowl (pot dishes) | `clayBowl(g, inside)`, rim at `CLAY_BOWL` | Wilted greens, Nettle soup |
| the clay pan (griddle) | `clayPan(g, inside)`, rim at `CLAY_PAN` | Mushrooms with hazelnuts, Sorrel and mushrooms, Elderflower fritters, Chicken of the woods steak |
| a birch-bark cup | inline in `paintRosehipTea` | Rosehip tea |
| a broad green leaf, curled up | inline in `paintHoneyedCherries` | Honeyed cherries |
| a dry copper beech leaf | inline in `paintToastedBeechnuts` | Toasted beechnuts |
| a folded birch-bark bowl | inline in `paintStrawberriesHoney` | Strawberries and honey |
| a log slice | inline in `paintDandelionFritters` | Dandelion fritters |
| a clay jug | inline in `paintElderflowerCordial` | Elderflower cordial |
| a glazed stoneware crock | inline in `paintRosehipSyrup` | Rosehip syrup |

`woodBowl`, `clayBowl` and `clayPan` take an `inside` function: paint the contents in it, and it is clipped to the hollow
(only what's above the front of the rim shows) with the rim painted over it. The rim's inside is centred at `(0, cy)`, `IX`
wide by `IY` tall: put a soup's surface at about `ovalAt(g, 0, cy + 0.04, IX - 0.03, IY - 0.03)`; heap things up above
`cy` to show over the rim. Things may stick out over the rim (a spoon, a leaf): paint them after the vessel call.

Reading the vessel helpers themselves (`woodBowl`, `clayBowl`, `clayPan`, `greenStick`) and the colour constants they use
(`PAN`, `PAN_RIM`, `PAN_IN`, `JUS`, `BOWL`, `CLAY_BOWL`, `FRIED`, `STONE`, ...) is expected: they are the vessel, not
another dish. The "read only that section" rule below is about not copying another dish's food.

## Ingredient pieces already painted (reuse them)

`roastShroomAt`, `halfShroomAt` (a mushroom cut in half; its last arg is the cut's colour, `FRIED` for fried),
`capAt`, `leafAt(g, 's'|'d'|'g', ...)` (sorrel, dandelion, wild garlic leaves), `dandelionAt` (a flower head), `hipAt`
(rosehip), `cherryAt`, `berryAt` (blackberry), `nettlePath`, `nettleTopAt`, `beechnutAt`, `beechHuskAt`,
`hazelKernelAt`, `hazelShellAt`, `cookedFishAt` (a whole fish cooked, its look a `FISHC_*`), `fsoupFlakeAt` (a flake of
fish), `eelPieceAt`, `shardAt` (crushed hazelnut), `brittleNutAt`, `fritterAt`, `elderFritterAt`, `elderAt`
(elderflower head), `strawberryAt`, `cressAt` (watercress), `rootPieceAt`. Each has a comment above it in dishes.js
saying its arguments. Look one up with `grep -n "function cherryAt" -B2 dishes.js`.

items.js paints every raw ingredient (`Items.paint`): read its painting of an ingredient for its colours and shape, then
draw it cooked.

## Adding one, step by step

1. Find its recipe in recipes.js (`name`, `vessel`, `needs`, `text`, `warm`) or open `dish-lab.html?dish=Its name`
   (or `?dish=24`, its number in PAINTED), which shows the vessel, needs, warmth and text under the name. Its name in
   dishes.js must be exactly the same, capitals and all. If it isn't in recipes.js yet, add it there first, copying a
   block in RECIPES: `name`, `vessel`, `needs` (ingredient ids or tags), `text`, and `warm: true` if it steams. Put it
   ahead of any generic dish with the same needs in the same vessel: the first one listed wins. Then check the data:
   `node -e "const R=require('./recipes.js'); console.log(R.checkRecipes())"` (an empty list is good; if it names two
   same-vessel dishes made the same way, that is the ordering above, and the first still wins).
2. Pick the painted dish nearest it (same vessel, similar food) and read that section of dishes.js whole. It is your
   template: copy its structure, its proportions and its way of shading.
3. Write the new section **just above the `PAINTED` list at the end of dishes.js**, in the same form as the others:
   ```js
   // ------------------------------------------------------------------ acorn bread
   //
   // What it looks like, in a few plain sentences: the vessel, the food, how it's cooked, the little touches.
   const ACORN_CRUST = [120, 72, 36], ACORN_CRUMB = [176, 128, 78];
   function paintAcornBread(g) {
     sitShadow(g, 0, 0.66, 0.8, 0.13);
     ...
   }
   ```
   - Everything in dishes.js shares one scope. **Give every new `const` and `function` a name no other dish uses**
     (prefix it with the dish: `ACORN_...`, `acornLoafAt`), or the whole file fails to load and every dish vanishes.
     Before writing a name, `grep -n "NAME" dishes.js`.
   - Colours go in `const`s at the top of the section, as `[r, g, b]`.
   - Fixed numbers only, no `Math.random()`: it must paint the same every time. A row of things is a little table of
     `[x, y, size, turn]` like `SALAD_LEAVES` or `BEECHNUTS`, painted back to front.
   - Gradients are fine here (it is painted once). Do not change shared helpers or other dishes: `woodBowl` is in five.
4. Add it **at the end** of `PAINTED`: `['Acorn bread', paintAcornBread],`. Never reorder or remove: a dish's number is
   its place there.
5. Check it loads: `node --check dishes.js`.
6. Look at it: `tools/dish-shot.sh "Acorn bread" /tmp/acorn.png` (or `... 24`, its number; with neither it shows the
   newest), then open the png. It shows the dish at 48, 96, 128 and 256, its true 48 pixels enlarged four times, and
   every painted dish at 48 on the satchel's parchment and on dark with the current one ringed, so you can judge it at
   48 next to its neighbours. The recipe's vessel, needs, warmth and text sit under the name. An error shows in a red
   box at the top of the page.
7. Fix what it shows and look again, as often as it takes. Then check:
   - At 48 px, can you tell what it is? Is its vessel clear? If it's mush, use fewer, bigger shapes and more contrast.
   - Is it lit top left, with a soft shadow under it, about the size of its neighbours, centred?
   - Does it look cooked (browned, glazed, steaming if `warm`)?
   - Does it sit with the others in the 48 px strip, not brighter, darker, flatter or busier than they are?
8. Don't commit unless asked: other sessions work in this folder. Leave it for Axel to look at in the dish lab.

The game picks a new painting up on its own (game.js reads `Dishes.NAMES`), as do `recipes.html` and the recipe book.

Added 2026-10-23 with the water food (PLAN.md stage 14): `barkCup(g, inTea)` (rim at `BARK_CUP`), the birch-bark cup, shared by
Rosehip tea and Mint tea with honey; `musselAt` (an open mussel), `crayfishAt` (a boiled one, from above), `wmintSprigAt` and
`wmintLeafPath` (water mint), and `honeyEelAt` (a glaze over `eelPieceAt`'s rounds).
