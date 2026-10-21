# Sprite sheets of the meadow

Three sheets, each painted by the game's own code, each with a JSON atlas next to it giving every frame's place on the
sheet (`x, y, w, h`) and where it stands on the ground in the frame (`footX, footY`). The backgrounds are transparent.
Rebuild all three with `./build.sh` (headless Chrome), or open a `make-*.html` page in a browser to look at one.

| Sheet | Page | What's on it |
|---|---|---|
| `summer-trees.png` | `make-sheet.html` | every tree kind in summer, three tones each; the hive oak; the blossoming ones |
| `stones-plants.png` | `make-stones-plants.html` | rocks, the old stone in its seven moods, flowers and ground cover, the plants you pick |
| `dishes.png` | `make-dishes.html` | all 27 painted dishes |

## Summer trees

`summer-trees.png` holds the meadow's trees in summer, painted by the game's own `trees.js`. The PNG has a transparent background and is 1023 × 2529 px, at scale 1 (a big tree is about 250 px tall).
Each row is one kind in its three tones: oak, beech (its third is the copper beech), maple, birch, apple, cherry,
alder, hawthorn and pine. Then come the hive oak and a blossom row. No tree flowers in summer in the game:
apple, cherry and hawthorn blossom in spring. So the last row is those three in their spring flower, while the summer
apples and cherries hang with fruit.

## The files

- `fur.js` (the shared drawing helpers), `dishes.js` and `items.js` are copies of the game's files. `meadow.js` is the
  rock, flower and old-stone painting lifted out of `game.js` unchanged, except that a rock is told how wooded its spot is
  rather than reading the live world.
- `sheet.js` packs rows of paintings into a sheet and its atlas, and `build.sh` runs the pages headless.
- `trees.js` is a copy of the game's painter (the original is at the repo root). It has no dependencies and runs in a page or a worker.
- `make-sheet.html` builds the sheet. Open it in a browser to see the sheet; it calls
  `Trees.paint(kind, { seed, season, tone, scale, ss })` for each tree and lines the trees up by the foot of the trunk.

## How a tree is drawn (trees.js)

1. **Sculpted in 3D out of spheres.** Each kind's function (`oak`, `beech`, `fruitTree`, `pine`…) grows a skeleton:
   `grow` sweeps a branch as a chain of bark spheres (`limb`) and forks it recursively. `roots` flares the foot.
   The seed fixes the shape; the season changes only the leaves.
2. **Leaf clumps at the twig ends.** `leafy` puts a clump of leaflet spheres (`clump`) on each tip. It picks one
   colour ramp for the whole tree from `CROWNS[kind][season]` and its tone, and gives a few clumps another.
3. **Things on top.** `dot` hangs apples, cherries and blossom over the clumps as a layer of their own (`MAT.fruit`).
   The cherry's spring crown is the `bloom` material, and `litter` drops petals round the foot.
4. **Lit per pixel, then painted over.** `Scene.paint` rasterises the spheres into a z-buffer and lights each pixel
   from the top left (`L`), with ambient occlusion deep in the crown. It uses that light only for the big shapes. The
   leaves then go on as flat leaf-shaped dabs from shade to light, and the bark as strokes along each branch. The
   3D gives the volume, and the brushwork keeps it from looking 3D. `LOOK` at the top holds the brush settings, and
   `tree-lab.html` in the repo has a slider for each.

Painting one tree takes a few hundredths of a second. The game therefore paints trees in two workers
(`tree-worker.js`), never during a frame, and keeps each painting as an ImageBitmap to `drawImage` afterwards.

## How the stones are drawn (meadow.js, from game.js)

- **Rocks** (`rockInfo`, `rockSprite`, `paintStone`). Where a rock lies picks everything about it, through a hash of its
  spot: its kind (pebbles, a stone, a boulder, a great rock with a slab leaning on it, or a flat stone at a ford), its
  stones, their outlines (`ROCK_SHAPES`), its colour (`ROCK_RGB`) and its moss (more in the woods). Each stone's outline is
  stacked from the ground up, narrowing towards the top, which gives the side. A radial gradient lit from the top left
  gives the top, and on top of that go flecks, a crack on the big ones, and soft spots of moss. The whole rock sits on a
  dark soft spot where it meets the ground, and the view is squashed (`ROCK_SQUASH`) because we look down at a slant.
- **The old stone** (`paintOldStone`) is drawn by hand with fur.js's soft shading. `softIn` fills a shape lit at its
  top and dark at its foot, and `furGlow` lays soft ovals for the shade, light and blush. Lichen, cracks, a moss
  comb-over and bushy moss brows go on top. The mood sets the eyes, lids, brows and mouth.

## How the plants are drawn

- **Meadow flowers and ground cover** (`FLOWER_ARTS` in meadow.js: tulips, blossom, buttercups, sunflowers, bluebells,
  heather, asters, then tufts, a sprout, fallen leaves, seed heads and a frosted tuft). Each one is a clump: two-tone
  leaves at the foot (`flowerLeaf`), bowed stems (`flowerStem`), heads placed by a seeded scatter (`flowerHeads`), and a
  soft shadow under it all. Each kind comes in five variants, so a field isn't one stamp repeated. When small, the heads
  are painted bolder so they still read.
- **Picked plants** (items.js): each is the thing held up to look at, in a little more detail than the meadow shows. A
  cep has a netted stem, a chanterelle forking ridges, a nettle its teeth. They use the same fur.js soft shading, lit
  from the top left and made to read at 48 px.

## How the dishes are drawn (dishes.js)

Each dish is a painter function that draws into a box from -1 to 1. A dish sits on a soft shadow (`sitShadow`), in the
vessel that says how it was made: a stick, a hot stone, a wooden or clay bowl, the clay pan or a birch-bark cup. Every
part is shaded with `softIn` (lit top, dark foot), clipped, then given `furGlow` shade, light, browning or char. Gleams of
near-white go on last, which make it look glazed or wet. The parts are painted back to front: shadow, the back of the
vessel, the food, the front rim, then steam. `.claude/docs/dish-painting.md` in the repo is the full guide.
