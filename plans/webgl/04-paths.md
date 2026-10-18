# Stage 4: paths (Opus)

A new file `gl2d-paths.js`, loaded after `gl2d.js`. It replaces stage 1's path stubs with real drawing, through
`Gl2d.addPaths(proto, emit)` (README's interface). Nothing in game.js changes in this stage.

## What the meadow draws with paths each frame (from the render inventory)

| Where | What | Shape |
|---|---|---|
| `layShadows` | creature and forager shadows, up to 24 fills a frame | many `ellipse` subpaths in one `fill`, alpha < 1: **must not double-darken where they overlap** |
| `drawFlow` | river streaks | 8 buckets × hundreds of `quadraticCurveTo` arches or `lineTo`s, one `stroke` each, round caps and joins, alpha < 1 |
| `drawFlow` | foam flecks | 6 buckets × many `arc`s, one `fill` each |
| `drawFlow` | riffles | one stroked `quadraticCurveTo` path |
| `drawWaves` | squiggles | a 13-point `lineTo` polyline each, alpha per wave, tens to ~100 |
| `drawRain` | streaks | up to 150 `moveTo`/`lineTo` pairs, one `stroke` |
| `drawSnow` | flakes | up to 160 `arc`s, one `fill` |
| `drawBurrow` (zoomed in) | worn paths | `quadraticCurveTo` strokes |
| `drawBeeTree`, `drawSwarm`, `barkBee` | bees on bark, honey drips | small ellipses, `fillRect`s, `arc`s; drips are `quadraticCurveTo` + `arc` (concave) |
| rings everywhere (`drawRings`, splashes, ripples, heron, `drawPickedUnder`, floats' landing rings) | | single `ellipse` / `arc` strokes |
| `drawSelectionUnder`, `drawTrail`, `drawSelectionOver` | trails, sight circle | dashed polylines and dashed `arc`s (`setLineDash`, `lineDashOffset`) |
| `drawVisitorShadow`, `drawBody` drips, `drawDigging`, `drawBaskets` | | single ellipse / arc fills, some strokes |
| `drawKeyArrow` | | a small stroked path |
| `drawBubble` fallback | | `arc` + `lineTo`, filled and stroked (rare: only before its sprite is painted) |
| `drawLightning` | bolt | jagged `lineTo` strokes (its `shadowBlur` is replaced in stage 5) |

## How

**Recording.** `beginPath` starts a fresh path in preallocated `Float32Array`s: one for points, and one for subpath
starts and kinds. Each call adds to it:
- `moveTo` / `lineTo` add points.
- `quadraticCurveTo` / `bezierCurveTo` are flattened into points. The number of segments comes from the curve's size
  in device pixels: one per ~4 px of length, between 2 and 16.
- `arc` / `ellipse` are kept **as shapes** when a subpath is just that shape: centre, radii, rotation and angles, through
  the current transform. A partial arc, or an arc joined to lines in the same subpath (the bubble fallback, honey
  drips), is flattened into points instead.
- `rect` adds a closed quad.
- `closePath` closes the subpath.
- Points are stored in device pixels, already transformed, which is how Canvas does it.

**`fill()`**
1. Every subpath that is a whole ellipse or circle becomes a kind-2 instance (an ellipse fill). The quad covers the
   ellipse's box, one pixel bigger. The fragment shader works out the SDF of an ellipse in local space, with coverage
   from `fwidth` over about 1 px: antialiased.
2. Every other closed subpath is a polygon.
   - A convex one, which most are, becomes a triangle fan. The fan is written into a small second vertex buffer and
     drawn as non-instanced triangles in the same flush order, through a `polyDraw` list the batch walks.
   - A concave one (honey drips, the bubble) uses stencil-then-cover: draw the fan into the stencil with INVERT, then
     cover its box where the stencil isn't 0, and clear those bits.
3. **Overlap:** if the fill colour's alpha (times globalAlpha) is under 1 and the path has more than one piece, draw
   all its pieces with **stencil-once**:
   - `stencilFunc(NOTEQUAL, ref, 0xff)`, `stencilOp(KEEP, KEEP, REPLACE)`, with `ref` a counter from 1 to 255;
   - clear the stencil when the counter wraps, and once a frame;
   - each pixel takes the colour once, as Canvas's nonzero fill does.

   An opaque path, or one of a single piece, skips the stencil and goes straight into the batch with no flush.

**`stroke()`**
- Each line segment of each subpath becomes a kind-4 instance (a capsule).
  - The quad is the segment's box, grown by half the line width plus 1 px.
  - The shader works out the distance to the segment, with the same smooth edge. Round caps and round joins come free.
  - `lineCap` `'butt'` is needed only if game.js sets it (grep). If it does, add a flag that cuts the capsule at the
    ends.
- An ellipse or arc subpath kept as a shape becomes a kind-3 instance (a ring): the ellipse's SDF, `abs(d) - w / 2`.
  A partial arc is flattened and stroked as capsules.
- **Line width:** the width in device pixels is `lineWidth` times the transform's scale, √|det| of the 2×2. Canvas
  scales strokes non-uniformly under a squash; no stroke in the meadow is squashed enough for that to show.
- **Overlap:** a translucent multi-segment stroke uses stencil-once, as fills do. Without it, the joins would darken
  where capsules overlap. Opaque strokes don't need it.
- **Dashes:** `setLineDash(arr)` and `lineDashOffset` cut the flattened polyline into dashes before it becomes
  capsules. A dashed arc is flattened first.

**`clip()`**
- Support only an axis-aligned rect path under a transform with no rotation or skew (`b = c = 0`). It becomes a
  `gl.scissor` box in device pixels, saved and restored with `save`/`restore`. Changing it flushes.
- Any other clip: log once (`gl2d: clip not supported here`) and ignore it. Stage 5 changes those call sites.

**Instances and parameters.** Kinds 2, 3 and 4 use the 4-float parameter block that stage 1 left room for:
- kind 2: the ellipse's radii in local units;
- kind 3: the radii and the ring's width;
- kind 4: the segment's two ends in local quad space, and the width.

The colour is the premultiplied fill or stroke colour times `globalAlpha`. Keep everything in the one shader.

**Cost.** The river at zoom ≥ 12 can make a few thousand capsules a frame. That's fine for the GPU. In JS, flattening
and writing must not allocate: reuse the arrays, and grow them by doubling. Count the instances into `stats.pathInst`,
and stencil passes into `stats.stencilled`.

## Acceptance

Extend `gl2d-test.html` with a paths page, drawn in both a 2D canvas and Gl2d at 3x, then diffed. It draws:
1. 40 overlapping ellipses in one `fill` at alpha 0.3. The result must not darken where they overlap: check a pixel
   inside two of them against a pixel inside one.
2. 300 `quadraticCurveTo` arches in one `stroke`, `lineWidth` 1.5, round caps, alpha 0.4, overlapping.
3. 150 rain streaks.
4. 160 snow `arc`s.
5. A dashed polyline and a dashed circle, with `lineDashOffset` animated.
6. Single `ellipse` strokes of widths 0.75, 1 and 2, rotated.
7. A concave honey-drip shape: a `quadraticCurveTo` body plus an `arc`.
8. A rect clip around a sprite, and a rotated rect clip, which should log once and not crash.

Required:
- 1–7 within 1% of pixels off by 8/255. The rest is edge AA, which differs slightly; look at the diff picture.
- Overlap is darkened once in 1, 2 and 4.
- No allocations a frame: a flat heap over 10 s of the page redrawing every frame.
- Flushes for that page: as few as the stencil-once paths need (one each), plus the clip.
