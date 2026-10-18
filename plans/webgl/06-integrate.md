# Stage 6: putting it together (Opus)

Stages 2 to 5 have landed: the wiring (stage 2), the atlas, the paths and the call sites. This stage makes
`?gl=1` the whole meadow, with nothing missing, and robust: resizes, the battery saver's DPR, context loss, Safari on
the phone. **Start only after the gate's verdict was Go** (`plans/webgl/GATE.md`) and the overseer has merged stages
3, 4 and 5 into the `webgl` branch.

## 1. Load order and wiring
- index.html: `gl2d.js`, `gl2d-atlas.js`, then `gl2d-paths.js`, after `ground.js` and before `game.js`.
- `gl2d.js` calls `Gl2d.addPaths` itself when `gl2d-paths.js` has loaded, or `gl2d-paths.js` calls it on load. Pick
  one and say which in a comment.
- Take away `?nopaths` (stage 2's measuring switch), or keep it only behind `?bench`.

## 2. Sizing
- `resize()` (~107) sizes the drawing canvas, `#world-gl` or `#world`, at `vw * dpr` by `vh * dpr`, and calls
  `ctx.resize?.(w, h)`.
- `#world` stays the input surface. While GL draws, its backing store is 0×0 (`width = height = 0`); its CSS size is
  untouched, so pointer events and the cursor classes work.
- The battery saver's `SAVER_DPR` resize must keep working.
- `pixelCam` stays. With snapping in the WebGL context (stage 1), sprites land on whole device pixels as Safari's 2D
  canvas puts them.

## 3. Context loss
- `Gl2d` sets `lost`. In `frame()`, if `ctx.lost` has held for more than 3 s, `useGl(false)`: the 2D context, from the
  next frame, for the rest of the visit.
- Log `meadow: WebGL lost, drawing in 2D`.
- Restore before 3 s: the atlas `reset`s and re-uploads lazily. You'll see a frame or two of uploads in `stats`.
- Test it: `ctx.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` from the console.
  - With `restoreContext()` after 1 s, the meadow comes back in WebGL.
  - With none, it comes back in 2D after 3 s.
- Then send Safari on the phone to the background for a minute and come back. The meadow must be there (iOS drops
  WebGL contexts on memory pressure).

## 4. Composite modes, in the real game
Check these by eye against `?gl=0`, at their scenes:
- **Golden hour:** `source-atop`, so the warm wash tints only what stands on the ground. `#world-gl` is transparent
  where the ground shows, which is what makes this work. Compare the `golden` scene.
- **Fire light on what stands near it:** `fireLight`, also `source-atop`. Compare `night-fire`.
- **Glows:** `lighter`, in `drawFireGlows` and `drawFireflies`.
- **The sky picture:** drawn as an image, with `touched` after each repaint.
- **The navy dark:** a `fillRect` over everything, through `wash`.

## 5. Stand-ins and canvases that become bitmaps
The sprite cache draws a fresh canvas once, then swaps in its ImageBitmap (`asBitmap`), which uploads again. Check in
`stats` that a zoom ending doesn't make every picture upload twice over several frames. If it does, it's acceptable for
now (stage 8 measures it). Write the numbers down: uploads per frame for the 10 frames after a zoom settles.

## 6. What isn't supported, logged once
Run every scene in `scenes.mjs`, plus a few minutes of play (walking, lighting a fire, cooking, a storm, night, winter,
a selected animal, a friend if you can fake one), with the console open. The WebGL context logs each unsupported
thing once (`gl2d: ...`). Each log line is either fixed here, in gl2d, or listed for stage 7 with its scene.

## 7. The perf readout
- `?perf` shows the backend and, for gl:
  - draws, flushes, uploads (and px), atlas pages (and MB), stencilled paths, own-texture draws, overflow.
- `window.garden.gl` returns `ctx.stats`, or null.

## Acceptance
- `?gl=1` plays like `?gl=0` for 10 minutes on the Mac in Chrome and in Safari, and on the iPhone over the LAN:
  - no console errors;
  - no `gl2d:` warnings left that aren't listed for stage 7.
- `stats` at the default view, walking: flushes ≤ 8 a frame (source-over, a few stencilled paths, source-atop, lighter,
  sky); uploads 0 a frame once warm.
- The context-loss tests in section 3 pass.
- `?gl=0` still gives 0% against `shots/base` (or stage 5's shots where those differ).
