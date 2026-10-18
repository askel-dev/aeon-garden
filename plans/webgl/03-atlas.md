# Stage 3: the atlas (Opus)

A new file `gl2d-atlas.js`, loaded after `gl2d.js`. It sets `Gl2d.atlas` to an implementation of the interface in
README.md (`slot`, `forget`, `touched`, `reset`, `pages`), replacing stage 1's one-texture-per-image stand-in.
This stage doesn't touch game.js. With the atlas, a frame's ~400 image draws go into a handful of pages, so they share
one draw call.

## What it has to hold (from the inventory of game.js's pictures)

- **Sizes come in steps**, not continuously: sprites are `ceil(px·1.3·dpr)` squares in 6% steps, fur in powers of two,
  trees in five tiers. Labels and chat bubbles are the exception (their size follows the text).
- **Biggest:**
  - tree paintings at tier 2: up to 780×690, with a snow layer of the same size;
  - the old stone close up while cooking: up to ~1580²;
  - the fire close up: ~700²;
  - `CAMP_ART`: 512×410;
  - rocks: up to 461×384;
  - fur: 416²;
  - flowers: up to 290×326.
- **A frame draws ~30–60 MB of distinct pictures** on a 3x phone in a wood. Trees are most of it: 15–30 paintings at
  1.5–2 MB each.
- **Arrivals:** almost none a second at 1x once warm. 1–2 tree paintings a second at 60x, as seasons turn. A burst after
  a zoom settles (every visible look repainted, held to `PAINT_MS` = 3 ms of painting a frame).
- Burrows repaint in place up to 4 times a second (`BURROW_MS`). The sky canvas and rainbow repaint in place too. These
  call `touched` (stage 5).

## Design

- **Pages:** 2048×2048 RGBA8 textures (16 MB each), up to `ATLAS_PAGES` = 8 (128 MB). Allocate them lazily, one at a
  time. Bind them to texture units 0–7, page *i* on unit *i*, so a batch never has to flush for textures while
  everything is in pages.
- **Too big for a page:** anything over 1024 on either side gets a texture of its own, on unit 7 when it's drawn. Pages
  then use units 0–6. Each such draw is a flush boundary. They're rare: the stone and the fire close up, the camp art.
  Count them in `stats`.
- **Packing:** shelves.
  - A page is cut into horizontal shelves as images arrive. A shelf's height is the image's height rounded up to a
    multiple of 8, plus a 2 px gutter (for linear filtering).
  - An image goes on the first shelf of its height class with room. Otherwise a new shelf goes on the page with the most
    free height. Otherwise it's a new page, if the budget allows. Otherwise the least recently used page is evicted (see
    below).
  - Each shelf keeps a free list of the spans `forget` hands back, so a repainted sprite of the same size reuses its
    hole.
- **Gutters:** each image is uploaded at its spot. The gutter is filled with its edge pixels: four extra
  `texSubImage2D`s of 1 px strips cut from the image, or clear transparent if the image's edges are transparent, as
  sprites' are. Transparent is fine, and simpler; take it. The UVs are inset by half a texel.
- **Eviction:** each page records the last frame any of its images was drawn. When nothing fits, the page used least
  recently is emptied whole (`clearRect` is not a thing in GL: just reset its shelves and bump a generation counter, so
  every slot on it is stale). Its images re-upload on their next draw. A page used this frame is never evicted. If
  every page is in use this frame and nothing fits, put the image in a texture of its own for this frame and count it
  as `overflow` in `stats`. A frame wanting more than 128 MB of distinct pictures is a budget problem for stage 8, not
  a reason to thrash.
- **Uploads:** `texSubImage2D(TEXTURE_2D, 0, x, y, RGBA, UNSIGNED_BYTE, img)` with `UNPACK_PREMULTIPLY_ALPHA_WEBGL`.
  - Uploads happen during the frame, when an image is first drawn. Count bytes in `stats.uploadPx`.
  - Don't cap them per frame in this stage. The sprite cache's `PAINT_MS` already spreads new paintings out. Stage 8
    measures whether a cap is needed.
- **Lookups:**
  - A `WeakMap` from an image to its slot: `{ page, gen, x, y, w, h, u0, v0, u1, v1, dirty }`, made once per image and
    reused.
  - `slot(gl, img, frame)` returns it if `gen` matches its page's generation and it isn't dirty. Otherwise it places
    and uploads the image (again).
  - It must not allocate on the common path.
- **`forget(img)`:** returns the slot's span to its shelf's free list and deletes the WeakMap entry.
- **`touched(img)`:** if the image's size is unchanged, mark it dirty, so the next draw re-uploads in place. If its size
  changed, `forget` it and let it be placed afresh.
- **`reset(gl)`:** after a context restore, drop all pages and slots. They re-upload as they're drawn.

## Memory, to be measured in stage 8

The GPU now holds a copy of every picture drawn recently, on top of the ImageBitmaps the game keeps. Budgets:
- the sprite cache's `SPRITE_BYTES`, 96 MB;
- trees' `TREE_BYTES`, 48 MB;
- flowers, 32 MB.

The pages hold only what's drawn, at most 128 MB. Expose `Gl2d.atlas.pages` (count, and bytes used) for `?perf`.

## Acceptance

Extend `plans/webgl/tools/gl2d-test.html` with an atlas run. It has 120 distinct images:
- 40 sprite squares from 20 to 420 px;
- 20 tree-like 700×650;
- 5 of 1300×1300 (own textures);
- 30 small labels of odd sizes;
- 25 "burrows" repainted every 250 ms with `touched`.

They're drawn shuffled in one y-sorted pass, then a `lighter` group, then a `source-atop` wash.

Required:
- `stats.flushes`: 3 a frame (source-over, lighter, source-atop), plus one for each big own-texture image.
- Pixel diff against the same scene drawn by a 2D canvas: under 0.5% off by 8/255. Look at the diff picture for seams
  at image edges. There must be none: no bleeding from a neighbour in the atlas.
- Steady state: 0 uploads a frame, apart from the touched burrows.
- Thrash test: lower `ATLAS_PAGES` to 3 and draw a working set bigger than that. The frame still draws correctly, with
  `overflow` counted. Back at 8, it settles to 0 uploads.
- `forget` then the same size again: the hole is reused, and the page count doesn't grow. Check with 10 000 cycles.
