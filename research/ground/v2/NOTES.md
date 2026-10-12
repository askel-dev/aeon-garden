# The ground, second round (v2)

The opening view is now close (45 tiles across on a computer, 24 on a phone), so the ground fills the screen.
This round tried four looks for it in the ground shader, kept two as alternatives, dropped one, and recommends **B, the
meadow**. Every sheet shows the same seed (9091), the same camera and the very same frame for each column: the
variants were switched in place in one page (`Ground._gv`), so only the ground differs. Noon, clear sky.

## The sheets

| | |
|---|---|
| `1-seasons-opening-zoom.jpg` | spring, summer, autumn, winter (snow lying) at the opening zoom; today first |
| `2-far-mid-close.jpg` | the whole meadow (summer and autumn), in between (13 px a tile), close (40) |
| `3-detail-full-res.jpg` | crops at full resolution: the warren's lawn, the long grass, the pond's edge |
| `4-before-after.jpg` | today and B, big, at the opening zoom, with full-resolution strips (summer, autumn) |
| `5-dry-year-night.jpg` | the Dry Year at full bite (`?keep&dry=1`), close and whole; a summer night |
| `6-phone.jpg` | a phone at its opening zoom (390 x 844 at 3x) |
| `7-tried-and-dropped.jpg` | C, and B's first go |

## The directions

**B · The meadow (recommended).** A calm, saturated field of colour with big soft swells of light (lime on the rises,
a deeper, cooler green in the hollows), and on it cartoon tufts painted like the emoji: fans of broad curved blades,
deep at the foot and lime at the tip, the sun's side lighter, each on a soft shadow. They grow big in drifts and shrink
away between, so there's rest between the busy patches; in the longest grass a few have gone to seed, on short grass
in spring and summer there's clover, in autumn some go russet in patches, and in winter they stand frosted out of thin
snow. Far out, where tufts would be speckle, the long grass turns into a soft tussock texture instead.

**A · Painted tussocks.** The tree method on the ground: the long grass sculpted into soft lit mounds, then painted
over in leaf-shaped dabs from shade to light. Lush and painterly from afar (its whole-meadow view is nice), but at the
opening zoom it reads as camouflage or dappled shade, not as grass.

**D · Watercolour washes.** Calm washes with the pigment pooled dark along the long grass's edge, a little paper
grain and a few faint dabs. Cheapest and quietest; close to today with better colour, so probably too timid again.

**C · Combed by the wind (dropped).** Long grass as strands lying along a slow flow, with broad bands of sheen. The
bands read as contour lines on a map. Not worth fixing.

All four share a new base: the season's grass a little more saturated (`SATURATE`), light toward a near-pure lime
and shade toward a deep emerald (`LIME`, `EMERALD`; winter only lighter and darker), broad warm and cool washes, and
the grass in three readable states (below).

## Why B

- It's the one that reads as a meadow up close, in the spirit of the painted trees and animals: fewer, bigger, soft
  shaded shapes, saturated, a bit cartoonish, and it doesn't fight the trees (they stay darker and bigger).
- Grazing stays readable and gets prettier: **long grass** (deeper the longer it is, with tufts), **short grass**
  where it's grazed (paler, sunnier, more straw the shorter, no tufts, clover in spring and summer), and **bare
  earth** only where it's bitten right down. Where long grass meets short, its sunny edge is lit and its other edge
  shades the lawn, so a warren reads as a little mown clearing. From afar the short grass is paler still, so the
  grazed patches and the golden drifts still give the overview its variety (sheet 2).
- Everything else the ground says is kept: the Dry Year (straw, the lush ring, bare earth, the drawn-back mud),
  flower fields, burnt ground, snow, the seasons, the water and its moss edge. The water is today's, untouched.
- It costs the same as today (below).

## Cost

Measured in visible Chrome on this MacBook (M5), with the GPU's own timer (`EXT_disjoint_timer_query_webgl2`) around
30 repaints (alternating `lx` so `steady` fails), 7 to 9 interleaved passes after a warm-up, median per repaint.
Same frame for every variant. The ground is 2048 x 1536 at 2x (3.15 Mpx, no panning margin); the phone viewport is
390 x 844 at 3x, its ground at 2x (1.32 Mpx). The brief's method (30 repaints, then a 1-px readPixels) is noisier
and gives +8% at the opening zoom and -1% close. Tool: `tools/time.mjs`.

| zoom (px a tile) | today | **B** | A | D |
|---|---|---|---|---|
| opening, laptop (22.8) | 0.274 ms | **0.286 ms (+4%)** | 0.291 (+7%) | 0.266 (-3%) |
| close (40) | 0.247 | **0.247 (0%)** | 0.266 (+8%) | 0.242 (-2%) |
| in between (13) | 0.294 | **0.289 (-2%)** | 0.265 | 0.244 |
| whole meadow (7.7) | 0.222 | **0.215 (-3%)** | 0.211 | 0.210 |
| phone viewport (16.25), 1.32 Mpx | 0.202 | **0.218 (+8%)** | | |

Per Mpx at the opening zoom: today 0.087 ms, B 0.091 ms. On a phone (an iPhone 12 at about a fifth of the M5): a
full repaint of a phone's ground (1.32 Mpx) about 1.0 ms today and 1.1 ms with B; while panning with the 64 px margin
(about 2.0 Mpx) about 1.5 and 1.65 ms. With the old estimate of 0.8 ms a ground Mpx for today, B is about 0.85.
No new passes, textures or uniforms, nothing per frame outside the repaint; a still camera still costs nothing.

How it got there (B started at +53%): the old tufts (9 cells x 5 segments), the brush dabs and the pebbles are gone;
a tuft's size, not whether it's there, follows the drift, so the drift is one noise a pixel instead of one a cell;
tufts only stand up, so most pixels look at two rows of cells, not three; blades fan by a fixed turn, not a sine
each; cells out of reach skip their texture read; the long grass's edge light comes from `dFdx`/`dFdy` instead of a
second look at the grass; noises that only show somewhere (russet, the earth's unevenness) are skipped elsewhere;
the far tussocks are gone before a phone's opening zoom, so no zoom pays for both.

## Weak spots and risks

- **Not looked at in Safari or on an iPhone.** WebKit keeps the ground near 1x (`GROUND_WEBKIT`): tufts are drawn per
  pixel, so they'll be softer there, and the edge light (from `dFdx`/`dFdy`, per 2x2 pixels) may step a little at 1x.
  Check `?gv=5` in Safari before adopting.
- More saturated and busier than today. If it's too much: `SATURATE`, `TUFTS` (how many cells get one) and
  `TUFT_SIZE` are the knobs; the drifts already leave calm patches.
- Between 10 and 16 px a tile the tufts fade in by opacity, so at about 13 they're half see-through.
- There's no season uniform, so the shader reads the season from the palette: seed heads show in spring as well as
  summer and autumn; clover only while the grass's green is well over its red (spring, summer). A new palette in
  `GROUND.seasons` would need these thresholds checked.
- The drifts are noise, not sim data: a tuft's cell decides it from the sim's grass, but where the drifts lie means
  nothing. On the Dry Year's drawn-back mud some tufts stand on the mud (today's do too).
- Autumn is golden and olive with high contrast between long grass and grazed lawns; a few long-grass edges still
  read a little like torn paper.
- The sprite tufts game.js draws (`paintTuft` and kin, from the sim's plants) now sit among similar shader tufts. They
  look fine together in the shots, but they could be thinned if it's ever too much.
- Today's "odd pebble" is gone.
- Winter shots have snow forced to 0.45 for the look (the weather was locked clear); ice wasn't shown.

## How to adopt

- **Try it live first:** copy `ground-gv.js` over `ground.js` in a scratch checkout (not main) and open `?gv=5` (B),
  `?gv=1` (A), `?gv=4` (D), `?gv=0` (today). In the console `Ground._gv(n)` switches in place.
- **Adopt B:** `git apply research/ground/v2/ground.patch` (only `ground.js`, against HEAD 5267f3b), or copy
  `ground-variant.js` over `ground.js`. It's a clean replacement with no variant switch: game.js, the textures and the
  uniforms are unchanged, so nothing else needs to move. The constants are `#define`s with a comment each, next to the
  Dry Year's (`LONG`, `BITTEN`, `EDGE`, `TUFT_SHADOW`, `RUSSET`, `SATURATE`, `LIME`, `EMERALD`, `TUFT_CELL`, `TUFTS`,
  `CLOVER`, `TUFT_SIZE`, `SEEDS`). The header comment of `ground.js` already describes the new look.
- Then the line on the ground shader in `.claude/rules/ecology.md` ("with a faint painterly mottle") wants a word
  about the tufts and the three states of the grass.
- `tools/` has the CDP shooter and timer (Node 26, a visible scratch Chrome on port 9431, a copy of the game served on
  127.0.0.1:8791 with a `blank.html` beside it, and `ground-gv.js` as its `ground.js`). They delete every IndexedDB
  first, or the game reopens its last kept meadow.

## Not done, worth a thought

- Rabbit runs: trodden lines between burrows, water and feeding grounds would need the sim to keep where rabbits walk
  (a slowly fading count a tile, like `w.rich`); the shader could then wear the grass short and pale along them.
- Cheaper still: the slow fields (the golden drifts, the washes, the swells, the tuft drifts) could be worked out once
  a meadow into a texture of one texel a tile, which would put B well under today's cost.
- A season uniform would let seed heads keep to summer and autumn and give spring mornings a dew sparkle.
