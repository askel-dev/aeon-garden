# The meadow drawn with WebGL: the plan

**Goal:** the meadow (everything drawn on `#world` each frame) is drawn through WebGL2 in a few batched draw calls,
instead of ~400 Canvas 2D `drawImage` calls and ~30 path fills a frame. It must look the same: same sharpness (the
phone's own 3x, never lower), same colours, no jitter against the ground. It must cost less battery on a phone, which
we measure, not assume.

**How:** a small WebGL2 renderer, `gl2d.js`, that speaks **the same subset of the Canvas 2D API game.js already
uses** (`drawImage`, `setTransform`, `save`/`restore`, `globalAlpha`, `globalCompositeOperation`, `fillRect`, paths
made of `moveTo`/`lineTo`/`quadraticCurveTo`/`arc`/`ellipse`, `fill`, `stroke`...). game.js keeps drawing exactly as
it does; `ctx` becomes either the real 2D context or the WebGL one. That makes the move incremental and reversible:
`?gl=0` is the old path, and the same scene can be drawn both ways and compared pixel by pixel.

Read this file whole, then the stage you're doing. CLAUDE.md's rules still hold (above all "Keep it smooth").

---

## Why (the evidence, 2026-10-18)

### Mac, Chrome emulating a 3x phone (390×844), seed 123, midday, % of one core for all of Chrome's processes (`top`)

| Scene | total | page | GPU process |
|---|---|---|---|
| Walking, nothing drawn (`#world` 0×0) | 15–20 | 9–12 | 6–8 |
| Paused (draws at 30 fps) | 23–25 | 12 | 11–13 |
| Standing at 1x (calm: 30 fps) | 32 | 16 | 16 |
| Walking at 30 fps | 36 | 19 | 17 |
| **Walking at 60 fps** | **48** | 29 | 18 |
| Walking, sound on | 54–57 | 36 | 18 |

Drawing the world is about two thirds of the game's cost, and it goes with frames drawn. A walking frame on `#world`
makes about **394 `drawImage`, 124 `setTransform`, 35 `save`, 24 `fillRect`, 23 `beginPath`, 19 `fill`, 13 `stroke`**
(counted over 2 s). `render`'s own JS is only ~1.3 ms of that; most of the cost is the browser executing the canvas
calls (in Chrome and Safari, in a GPU process).

### iPhone 17 Pro, Safari 26.6, 1206×2142 at 3x (`plans/webgl/tools/draw-bench.html`)

Round 1, 48 game-like soft paintings with alpha, drawn small (0.375–0.75× of themselves), a WebGL ground under them:

| Sprites | Canvas 2D: JS ms/frame | WebGL instanced: JS ms/frame | fps (both) |
|---|---|---|---|
| 400 | 0.38 | 0.12 | 60 |
| 1000 | 0.96 | 0.18 | 60 |
| 2000 | 1.31 | 0.18–0.20 | 60 |
| ramp to the cap (5749) | still 60 | still 60 | |

**Read this honestly:** on Axel's iPhone 17 Pro, Canvas 2D is not throughput-bound at the game's ~400 draws; both
paths hold 60 fps far past it. The JS saving is real (3–7×) but small in ms. What JS can't see is the GPU process's
work per call, which is where the energy goes. So this whole plan has a **gate** (stage 2) where the energy is
measured on the phone before the expensive stages are built.

Round 2: where each path drops below 60 fps. It ramps the count up 15% a second until 3 frames in a second are late.
The two runs differ because of the phone's warmth.

| Sprites drawn at | Canvas 2D | WebGL instanced | WebGL / 2D |
|---|---|---|---|
| 0.375–0.75× of their painting (most of the meadow) | 14 236 / 18 827 | 24 899 / 28 634 | 1.5–1.75× |
| 0.75–1.5× (trees close up, big sprites) | 9 360 / 10 764 | 8 139 / 9 360 | 0.87× |

**What this says:**
- On this phone, Canvas 2D's cost per call is low. The game's ~400 draws are ~2–3% of what 2D can do in a frame.
- Big sprites are bound by pixels (fill and bandwidth), where WebGL is no better.
- So batching alone may save less battery on an iPhone 17 Pro than the Mac's numbers suggest.

**What the gate must find out:** whether the 2D path's per-call work in Safari's GPU process (invisible to JS, and not
throughput-limiting at 400) still costs measurable power. Real power measurement is the only way to know.

**Power on the phone (not yet measured).** Developer Mode is on (2026-10-18), and
`xcrun xctrace record --device <udid> --instrument 'Power Profiler' --all-processes` works. Learned along the way:
- It records only while the phone is unlocked and awake. Otherwise it fails with "Timed out waiting for device to boot".
  Safari doesn't keep the screen on, so ask Axel to set Auto-Lock to Never for the session, or to tap the screen now
  and then.
- The full Power Profiler template fails with `--all-processes` (its Location Energy Model instrument doesn't support
  it). Use `--instrument 'Power Profiler'` alone.
- `SystemPowerLevel` (% an hour) reads 0 while the phone charges from the Mac.
- In 5–8 s traces the per-process table `ProcessSubsystemPowerImpact` was empty. Check whether a 60 s trace fills it
  in. If it doesn't, use the phone's own trace recording, made untethered.
- The bench's `?power` mode (`plans/webgl/tools/draw-bench.html`) posts a wall-clock mark at each 30 s scene, for cutting
  a trace.

Older phones (an iPhone 12, a mid Android) are where per-call costs bite hardest; the plan's measurements should
include one if Axel can borrow one, but the gate is decided on his phone.

---

## Architecture

```
  #ground   WebGL2 (ground.js, unchanged until stage 9): painted rarely, slid by CSS transform
  #world-gl WebGL2 (gl2d.js): the meadow, drawn each frame through Gl2d, transparent where the ground shows
  #world    the 2D canvas, kept as the input surface (pointer events, cursor classes); 0×0 while GL draws,
            full size and drawn into again if GL is off or lost
```

### gl2d.js: the context

- `Gl2d.make(canvas)` returns an object `g` with the Canvas 2D subset below, or `null` when WebGL2 isn't there
  (then game.js keeps the 2D context). One file, one IIFE exporting `window.Gl2d`, no dependencies, like ground.js.
- **State** like a 2D context: the current transform (a, b, c, d, e, f), `globalAlpha`, `globalCompositeOperation`,
  `fillStyle`, `strokeStyle`, `lineWidth`, `lineCap`, `lineJoin`, the line dash, the clip; a `save`/`restore` stack
  of those, preallocated (no objects made per `save`).
- **Everything drawn becomes an instance** of one unit quad, written into one preallocated `Float32Array`:
  the quad's 2×3 matrix (the transform times the destination rect, so flips, squashes, skews and rotations are free),
  its texture rect, an atlas page, a premultiplied colour (the alpha and any tint), a kind (image, solid,
  ellipse fill, ellipse ring, capsule), and the kind's parameters. One shader draws all kinds, so images,
  rectangles and simple shapes interleave in **one draw call** until something forces a flush.
- **A flush** (one `bufferSubData` and one `drawArraysInstanced`) happens only when the blend mode changes, a
  stencilled path (below) needs drawing, the clip changes, more atlas pages are needed than are bound, or the frame
  ends (`g.flush()` from game.js after `render`).
- **Blend modes**, premultiplied alpha throughout:
  - `source-over` → (ONE, ONE_MINUS_SRC_ALPHA).
  - `lighter` → (ONE, ONE).
  - `source-atop` → colour (DST_ALPHA, ONE_MINUS_SRC_ALPHA), alpha (ZERO, ONE). It keeps today's meaning, tinting only
    what's already drawn on `#world`, because `#world-gl` is transparent where the ground shows.
  - `destination-out` → (ZERO, ONE_MINUS_SRC_ALPHA). Today only the sky canvas uses it, and that canvas stays 2D, but
    it costs nothing to have.
- **Images** go into **atlas pages** (`gl2d-atlas.js`): 2048² RGBA textures, shelf-packed, uploaded on first draw with
  `texSubImage2D` from the canvas or ImageBitmap itself (`UNPACK_PREMULTIPLY_ALPHA_WEBGL`), looked up with a
  `WeakMap` from the image object. The game's paintings stay where they are (the sprite cache, the fur and tree
  workers): the atlas is a copy on the GPU, not a new owner.
  - `g.forget(img)` frees an image's slot. `freeImage` calls it.
  - `g.touched(img)` marks an image whose pixels were repainted in place, so it's uploaded again on its next draw.
  - A frame's worth of images that don't fit evicts whole pages, least recently used first.
- **Paths** (`gl2d-paths.js`):
  - An `arc` or `ellipse` alone becomes one instance: an SDF disc or ring, antialiased in the shader.
  - A stroked polyline or curve (curves flattened in JS) becomes one capsule instance a segment, an SDF distance to the
    segment: round caps and joins come free, which is what the meadow uses (`lineCap = 'round'`).
  - A rectangle becomes a solid instance.
  - A fill or stroke whose colour isn't opaque and that has more than one piece (the shadows in `layShadows`, the river's
    streak buckets, foam, snow, rain) must darken each pixel once, as Canvas does. It's drawn with **stencil-once**:
    stencil func NOTEQUAL ref, op REPLACE, a fresh ref per call (1–255, the stencil cleared when it wraps).
  - Any other polygon (a concave fill: honey drips, the bubble fallback) uses stencil-then-cover. It isn't antialiased,
    which is invisible at 3x.
  - Dashes are cut in JS while flattening.
  - `clip()` is supported for an axis-aligned rect, as a scissor (the wading forager, animals, heron). Every other clip
    in the render path is changed at its call site (stage 5).
- **Pixel snapping:** an image drawn with a transform that has no rotation, skew or fractional scale has its
  destination rect snapped to whole device pixels, as Safari's 2D canvas does today. This keeps sprites sharp and in step
  with the ground (`pixelCam` stays).
- **Context loss** (iOS does it on memory pressure and sometimes on backgrounding):
  - `webglcontextlost` is `preventDefault`ed, and the atlas is marked empty.
  - On `webglcontextrestored` everything is re-uploaded lazily, from the sources, which still exist.
  - If no restore comes within 3 s, game.js switches `ctx` to the 2D context on `#world`, for the rest of the visit.

### game.js: what changes

- `const ctx` → `let ctx`. A `useGl(on)` function picks the backend and sizes the two canvases. The mist fade's
  `globalAlpha` wrapper (game.js ~555) and the `restore` patch are installed on whichever ctx is in use, through
  `Object.getPrototypeOf(ctx)`'s descriptor.
- `render` ends with `ctx.flush?.()`.
- The few call sites the WebGL context won't support are changed to things both backends draw the same (stage 5):
  - the circle clips (`drawFriendMarks`, `drawPickArrow`): a painted disc, cached;
  - lightning's `shadowBlur`: a wide, faint stroke under the bright one;
  - every canvas repainted in place: a `touched` call, or `forget` with a fresh canvas.
- `freeImage` also calls `ctx.forget?.(img)`.
- Nothing else in the drawing code changes. If a stage finds itself rewriting many call sites, it should stop and say
  so: it means the context is missing a feature.

### What stays as it is

- ground.js and `#ground`, until stage 9.
- The sky canvas (`laySky`'s 1/8-size picture, made with 2D gradients and `destination-out`): it stays a 2D canvas,
  drawn into `#world-gl` as an image, with a `touched` after each repaint. The same goes for the rainbow's canvas.
- `#cook-canvas`, `#me-face`, `#wd-look` and the inspector's portraits: plain 2D, untouched. `drawFlames` takes a
  `g` and works on either.
- The fur and tree workers, the sprite cache and its keys, budgets and stand-ins.
- The sim. Nothing in sim.js changes.

### Interface between the stages (fixed here, so stages can run in parallel)

```js
// gl2d.js (stage 1)
Gl2d.make(canvas) -> g | null          // g: the Canvas 2D subset + the following
g.flush()                              // end of frame: draw what's queued
g.forget(img)                          // an image freed by the game
g.touched(img)                         // an image repainted in place
g.stats -> { draws, flushes, uploads, uploadPx, pages, pathsStencilled }   // reset each frame
g.lost -> bool
// gl2d-atlas.js (stage 3): installs into Gl2d through
Gl2d.atlas = { slot(gl, img, frame) -> { page, u0, v0, u1, v1 } , forget(img), touched(img), pages, reset(gl) }
//   (stage 1 ships a stand-in with one texture per image, so stages 1, 3 and 4 don't wait on each other)
// gl2d-paths.js (stage 4): installs the path methods onto Gl2d's prototype
Gl2d.addPaths(proto, emit)             // emit(kind, matrix, params, colour): the batch's instance writer
```

---

## The stages

| # | File | Model | Depends on | Touches |
|---|---|---|---|---|
| 0 | `00-harness.md` | Sonnet | – | game.js (small hooks), `plans/webgl/tools/` |
| 1 | `01-core.md` | **Opus** | 0 | new `gl2d.js`, index.html (script tag) |
| 2 | `02-gate.md` | **Opus** | 1 | game.js (`useGl`, ctx swap, flush), measuring only |
| 3 | `03-atlas.md` | **Opus** | 1 | new `gl2d-atlas.js` |
| 4 | `04-paths.md` | **Opus** | 1 | new `gl2d-paths.js` |
| 5 | `05-call-sites.md` | Sonnet | 1 | game.js (listed call sites only) |
| 6 | `06-integrate.md` | **Opus** | 2, 3, 4, 5 | game.js, gl2d*.js, index.html |
| 7 | `07-parity.md` | **Opus** (fixes may go to Sonnet) | 6 | anything in the drawing |
| 8 | `08-measure-ship.md` | **Opus**, docs to Sonnet | 7 | CLAUDE.md, .claude/docs/, game.js (default) |
| 9 | `09-one-layer.md` (optional) | **Opus** | 8 | ground.js, gl2d.js, game.js |

- **Parallel:** after stage 1, stages 3, 4 and 5 can run at once. They touch different files, and the interface above
  is fixed. Stage 2 (the gate) runs while they're going, but **stages 6 to 9 wait for the gate's verdict**.
- **The gate** (stage 2) puts the stage-1 renderer behind `?gl` on the real game with paths drawn as nothing on both
  backends, and measures energy on the iPhone and the Mac.
  - If WebGL isn't clearly cheaper (below **15%** less power for the same scene), stop after stage 2. Keep the harness
    and the numbers, and go back to the cheaper options: the half-rate world, the quick wins.
  - If it is clearly cheaper, carry on.
- Every stage runs in its own worktree, on a branch off `main`. Other sessions edit the main checkout at the same time
  (CLAUDE.md, and the shared-checkout rule: never stash, never commit someone else's hunks). The overseer merges each
  stage's branch into an integration branch `webgl` after reviewing it, and `webgl` goes into `main` only after stage 8.
- **Effort:** every worker runs at **medium** effort. Sonnet 5.5 for the plain, fully specified edits (stages 0 and 5,
  the docs in 8). Opus 5.5 for the rest, where the work is design, measuring or judging how something looks.

## Rules for every stage

- CLAUDE.md first. The "Keep it smooth" list is law, and in the WebGL code it means:
  - no objects, arrays, closures or strings made per draw or per frame;
  - the instance buffer is preallocated and grows by doubling, rarely;
  - colour strings are parsed once into a cache, a `Map` cleared past 512 entries;
  - no `getError`, `readPixels` or `finish` in a frame, except under `?gldebug`.
- Code style is the repo's: `const`/`let`, semicolons, sentence-case comment headers, lower-case asides in
  parentheses, British spelling in comments, short names where the code around uses them. No build step, no
  libraries.
- `?gl=0` must keep working exactly as today at the end of every stage: the 2D path is the fallback for good.
- Don't commit to `main` or push. Commit on the stage's branch; the overseer merges.
- The anchors given (function names, line numbers) drift. Search for the name.
- If a step can't be done as written, stop and report. Don't improvise a different design.

## Testing and measuring (built in stage 0, used by every later stage)

- `python3 -m http.server 8765` in the worktree, then `http://localhost:8765/?seed=123`. Add `&gl=1` or `&gl=0` for the
  backend and `&perf` for the readout, which shows the backend and `g.stats` from stage 1 on.
- **`plans/webgl/tools/scenes.mjs`** draws a fixed list of scenes in headless Chrome over CDP, at one fixed time
  each, and saves PNGs. Then `pixdiff.mjs a/ b/` compares two runs and writes a diff picture and a number per scene.
  Stage 7's parity bar is set there.
- **`plans/webgl/tools/energy.mjs`** is the Mac energy rig the table above came from: a visible scratch Chrome over CDP,
  `top`'s CPU and POWER for its processes, over scenes. It has a Safari variant too: the page measures itself and posts
  to a small server.
- **iPhone, real power (Developer Mode on):**

  ```bash
  xcrun xctrace record --device <udid> --template 'Power Profiler' --time-limit 60s --output run.trace
  ```

  The phone is plugged in over USB-C, Safari is open on the scene, and the screen brightness is fixed. Read
  `xcrun xctrace export --input run.trace --toc` for the tables. The CPU, GPU and display power tracks are what count;
  compare scene against scene in the same session, with the phone at the same temperature.
- **iPhone, no Developer Mode:** Safari's Web Inspector over the cable (Develop › the phone › the page) has a CPU
  timeline that shows energy impact. Axel runs that by hand.
- **The phone reaches the Mac** at `http://<the Mac's LAN IP>:<port>/` (`ipconfig getifaddr en0`). Serve with
  `--bind 0.0.0.0` for that.

## Risks, and what's done about them

| Risk | Answer |
|---|---|
| The saving is small on a fast iPhone | The gate (stage 2) measures before most of the work is done |
| It doesn't look the same (alpha, filtering, AA) | Same premultiplied maths; pixel snapping like Safari's; pixdiff scenes with a bar (stage 7); Axel's eyes on the phone |
| Memory: a GPU copy of every painting on top of the ImageBitmaps | Atlas budget 8 pages (128 MB) with LRU page eviction; `g.stats.uploads` shows thrash; measured on the phone in stage 8 |
| Context loss on iOS | Restore from the sources; 2D fallback after 3 s |
| A painting repainted in place shows stale | Audit in stage 5 (`touched`/`forget`); pixdiff catches the rest |
| Upload spikes when a zoom settles (a burst of new paintings) | Already throttled by `PAINT_MS`; uploads per frame in `g.stats`; stage 8 caps them if they show |
| The 2D path rots | `?gl=0` in every stage's acceptance; the pixdiff tool compares the two |
