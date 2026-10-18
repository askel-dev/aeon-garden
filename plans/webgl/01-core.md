# Stage 1: gl2d.js, the core (Opus)

A new file `gl2d.js`, loaded by index.html before game.js: `<script src="gl2d.js"></script>` after `ground.js`. It
exports `window.Gl2d`. This stage builds the context, the state, the batch, images (one texture each, a stand-in
for the atlas), `fillRect`, the blend modes and context loss. Paths come in stage 4 and the atlas in stage 3. Read
README.md's Architecture section first; the interface there is fixed.

Nothing in game.js uses it yet (stage 2 wires it in), so test it with a page of its own,
`plans/webgl/tools/gl2d-test.html`, that draws the same things into a 2D canvas and a Gl2d canvas side by side and
diffs them (see Acceptance).

## The API to implement (what game.js's render path uses: README and the inventories)

**Properties.** Implement each as a plain field, or as an accessor where setting it must do work. The accessors live on
the prototype, so game.js's mist-fade wrapper can wrap `globalAlpha` through `Object.getPrototypeOf(g)`.
- `canvas`
- `globalAlpha` (accessor, on the prototype)
- `globalCompositeOperation`
- `fillStyle`, `strokeStyle`
- `lineWidth`, `lineCap`, `lineJoin`, `lineDashOffset`
- `imageSmoothingEnabled`, `imageSmoothingQuality`: accepted, ignored (always linear)
- `font`, `textAlign`, `textBaseline`: accepted, ignored (render draws no text per frame; text sprites are painted on 2D
  canvases)

**Transforms**
- `setTransform(a, b, c, d, e, f)`, and the form with no arguments (`resetTransform`)
- `transform(a, b, c, d, e, f)`
- `translate(x, y)`, `rotate(r)`, `scale(x, y)`
- `getTransform()`: only if game.js uses it (grep). If it does, return a reused object, not a new `DOMMatrix`.

**State**
- `save()`, `restore()`: a preallocated stack, 32 deep, of the transform, alpha, composite op, styles, line state, dash
  and clip.

**Drawing**
- `drawImage(img, dx, dy)`
- `drawImage(img, dx, dy, dw, dh)`
- `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`
- `img` is an `HTMLCanvasElement`, an `ImageBitmap`, an `OffscreenCanvas` or an `HTMLImageElement`. An image with no
  width or height draws nothing, as in 2D.
- `fillRect(x, y, w, h)` with the current `fillStyle` as a colour string. A gradient or pattern isn't used per frame,
  so log once and skip it.
- `clearRect(x, y, w, h)`: only the whole-canvas form is used (`clearRect(-8, -8, vw + 16, vh + 16)`), so clear the
  frame. Any other rect: log once.

**Paths.** These are stubs in this stage; stage 4 replaces them:
- `beginPath`, `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `arc`, `ellipse`, `rect`, `closePath`;
- `fill()`, `stroke()`, `clip()`;
- `setLineDash(arr)`, `getLineDash()`.

The stubs record nothing and draw nothing. That's what the gate (stage 2) measures: paths off on both backends.

**Extras**
- `flush()`
- `forget(img)`, `touched(img)`
- `stats`
- `lost`

## How it works

### Context
- Make it with `canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
  stencil: true, preserveDrawingBuffer: false, powerPreference: 'low-power' })`.
- The stencil is for stage 4. Ask for it now, so the context needn't be remade.
- `preserveDrawingBuffer: false`: every drawn frame redraws everything. A frame not drawn keeps the last picture on
  screen, as the compositor holds it.
- `g.resize(w, h)` sets `canvas.width/height` and the viewport, and the projection uniform: pixels → clip space, y down.

### The instance format
Each instance is 16 floats, written into one `Float32Array` (start at 4096 instances, double when full):

| Floats | What |
|---|---|
| 0–5 | `a b c d e f`: maps the unit quad (0..1)² to device pixels. It is the current transform times the destination rect: `[dw, 0, 0, dh, dx, dy]`. |
| 6–9 | `u0 v0 u1 v1` in the texture, normalised |
| 10–13 | premultiplied colour `r g b a`. For an image: `(α, α, α, α)`, with α = globalAlpha. For a solid: the fill colour times α. |
| 14 | kind: 0 image, 1 solid. Stage 4 adds 2 ellipse fill, 3 ellipse ring, 4 capsule. Leave room: one float. |
| 15 | texture unit (0–7) |

Stage 4 needs per-kind parameters (ellipse radii in local space, ring width, segment ends). Add them as a second
attribute block of 4 floats now, unused by kinds 0 and 1, so stage 4 doesn't change the layout. That makes the stride
20 floats.

### The shader
One program.
- **Vertex shader:** `pos = mat * corner` (with `corner` in (0..1)², from a 4-vertex strip), then to clip space. It
  passes the uv, the colour, the kind, the unit and the local coordinate (`corner`, for the SDF kinds later).
- **Fragment shader:** for kind 0, sample the texture unit and multiply by the colour; for kind 1, the colour. GLSL ES 3
  can't index a sampler array with a varying, so pick the unit with an `if` chain over 8 uniforms (`tex0`..`tex7`).
  Return premultiplied.
- **Pixel snapping:** in JS, when an image instance's matrix has `b = c = 0` and `a`, `d` positive or negative, round
  `e`, `f` and the far corner to whole device pixels, then recompute `a`, `d` from the rounded corners. This is the
  same thing Safari's 2D canvas does, which the meadow was tuned under. Leave rotated, skewed and solid instances as
  they are.

### Textures (stand-in for the atlas)
- A `WeakMap` from an image to `{ tex, w, h, frame }`. An image's first draw creates a texture and uploads it:
  `texImage2D(..., img)` with `UNPACK_PREMULTIPLY_ALPHA_WEBGL` true, LINEAR filtering, CLAMP_TO_EDGE, no mipmaps.
- `touched(img)` sets a flag, so the next draw re-uploads into the same texture.
- `forget(img)` deletes the texture.
- `Gl2d.atlas` is the hook stage 3 fills: when it is set, `slot()` comes from it instead. Code it so this stand-in is the
  default implementation of the same `slot / forget / touched / reset` interface.
- The batch binds up to 8 textures at once, one unit each. A draw whose texture isn't bound takes a free unit. When all
  8 are taken, flush and unbind them all. (With the atlas, that's 8 pages, so flushes become rare. With one texture
  per image this stand-in flushes a lot, which is fine: it's a stand-in.)
- An image that is still a canvas being painted this frame (the sprite cache draws a fresh canvas before its
  ImageBitmap arrives) is just another image: it's uploaded when drawn and forgotten when `freeImage` sets its width
  to 0. Don't treat it specially, except that a canvas whose width became 0 since upload draws nothing and frees its
  texture.

### Blend modes
Map `globalCompositeOperation` at each draw. If it differs from the batch's, flush first. Enable blending always:

| Mode | blendFuncSeparate |
|---|---|
| `source-over` | ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA |
| `lighter` | ONE, ONE, ONE, ONE |
| `source-atop` | DST_ALPHA, ONE_MINUS_SRC_ALPHA, ZERO, ONE |
| `destination-out` | ZERO, ONE_MINUS_SRC_ALPHA, ZERO, ONE_MINUS_SRC_ALPHA |
| `destination-in` | ZERO, SRC_ALPHA, ZERO, SRC_ALPHA |

Any other mode: log it once and treat it as `source-over`.

### Colours
Parse a CSS colour string (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`, the comma and space forms, plus the few named colours
game.js uses: grep for `fillStyle = '` and `strokeStyle = '`) into a cached `Float32Array(4)`. The cache is a `Map`
keyed by the string, cleared past 512 entries. Strings built per frame (`rgba(…, ${a})`) are why the cache needs the
cap.

### The frame
- `flush()` uploads the used part of the instance buffer with `bufferSubData` and draws `drawArraysInstanced(TRIANGLE_STRIP,
  0, 4, n)`.
- game.js calls `g.flush()` at the end of `render`. A flush also happens when the composite op changes or the textures
  run out.
- `stats` counts this frame's draws, flushes, uploads and uploaded pixels. Reset it at `clearRect`, which is the
  frame's start.

### Context loss
- `webglcontextlost`: `preventDefault()`, set `lost = true`, drop every texture handle (the WeakMap entries are now
  invalid: keep a generation number and check it in `slot()`).
- `webglcontextrestored`: rebuild the program and buffers, `lost = false`. Textures are re-uploaded lazily on the next
  draws.
- While `lost`, every call returns at once.
- game.js decides what to do after 3 s of lost (stage 6).

## Performance rules (the meadow's, applied here)
- `drawImage` must not allocate. No arrays from `arguments`, no rest parameters: write three code paths keyed on
  `arguments.length`, or give the function nine parameters and branch on whether `dw` is undefined. Do the transform
  multiply inline, and write straight into the Float32Array.
- `save` and `restore` copy numbers into preallocated slots.
- No `gl.getError()` or `gl.getParameter()` in a frame. A `?gldebug` flag may turn on a check after each flush.

## Acceptance

`plans/webgl/tools/gl2d-test.html` draws the same scene into a 2D canvas and a Gl2d canvas of the same size, at
devicePixelRatio. It then reads both back (`getImageData`, and `readPixels` straight after a flush), compares them and
prints the % of pixels off by more than 8/255. The scene:
- 300 sprites from 30 painted canvases turned into ImageBitmaps (soft blobs with alpha, 20–300 px);
- random positions, half with fractional positions;
- a third rotated, some flipped with `scale(-1, 1)`, some skewed with `transform(1, 0, 0.2, 1, 0, 0)`;
- alphas from 0.2 to 1, set through `globalAlpha` with `save`/`restore`;
- 20 `fillRect`s in rgba colours;
- a `source-atop` fill over all of it;
- 10 `lighter` sprites.

Required:
- Off by more than 8/255: under 0.5% of pixels. The differences should only be at edges, from filtering. Snapping
  matches what Safari does, but not Chrome's 2D, so test in Safari too: open the page in Safari on the Mac, and on the
  phone through the LAN address.
- `g.stats` for that scene: 1 upload per image on the first frame and 0 after.
- No allocations a frame: in Chrome's Performance panel (Memory), a 10 s run of the test page drawing 2000 sprites a
  frame shows a flat heap, with no sawtooth from gl2d.js.
- Context loss: `g.canvas.getContext('webgl2').getExtension('WEBGL_lose_context')`, then `loseContext()`. Drawing goes
  quiet. After `restoreContext()` the scene comes back with no errors in the console.
