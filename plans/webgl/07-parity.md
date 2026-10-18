# Stage 7: looking the same (Opus; fixes may go to Sonnet)

`?gl=1` must look like `?gl=0`. Axel judges by eye on his iPhone, and he's particular: he saw the 2x canvas as soft,
and a 2 px jitter of sprites against the ground. This stage finds every difference and fixes it, or shows it to Axel
and lets him decide.

## 1. The numbers
- Run `scenes.mjs` twice (`gl=0` into `shots/p-2d`, `gl=1` into `shots/p-gl`), then `pixdiff.mjs`.
- Headless Chrome's WebGL runs on SwiftShader, a software renderer. That's fine for pictures; don't time anything with
  it.
- **The bar for each scene:** under 1% of pixels off by more than 8/255, and no region of more than 4×4 px off by more
  than 32/255. A region that is should be named, explained and either fixed or shown to Axel.

## 2. Look where the differences are
Open each diff picture. The usual causes, and what to do about each:

| Looks like | Usually | Do |
|---|---|---|
| Thin fringes at every sprite's edge | filtering, or premultiply, or the atlas's half-texel inset | Check `UNPACK_PREMULTIPLY_ALPHA_WEBGL` and that the shader doesn't premultiply twice. A fringe of 1/255 is fine. |
| Sprites a pixel off | snapping differs from Chrome's 2D. Chrome doesn't snap, Safari does. | Compare in Safari, not Chrome. If Safari agrees with gl, it's fine. |
| Shadows darker where they overlap | stencil-once not applied | Fix in gl2d-paths. |
| Strokes thinner or thicker | line width under scale; AA width | Match the 2D look at 3x; the phone is what counts. |
| A thing missing | an unsupported call (check the `gl2d:` log), or a canvas repainted without `touched` | Fix the call site (stage 5's pattern) or gl2d. |
| Colours a touch off everywhere | colour space | Check that `drawingBufferColorSpace` is `'srgb'`, the default, and the 2D canvas's too. |
| The golden hour or fire light tints the ground | `source-atop` blend state, or alpha not written right by an earlier draw | Fix the blend state; check that every kind writes correct premultiplied alpha. |

## 3. On the phone, with Axel
Serve the `webgl` branch on the LAN. Give Axel two links, `?gl=0` and `?gl=1`, same seed, and a checklist. He
answers yes, no or worse for each:
1. Sharpness: the forager, rabbits and a tree close up (zoom right in).
2. Walking: does anything wobble against the grass? (The stone and rocks are the tell.)
3. Zooming in and out, and a moment after the zoom stops.
4. The river close up: streaks, foam, curls.
5. Shadows under animals in a group.
6. Night by a fire: the warm pool, the glow, fireflies.
7. Golden hour.
8. Rain, then snow.
9. Autumn leaves lying and falling.
10. Wading at the shore.
11. A selected animal's trail and rings.
12. Cooking at the fire (the pot over it in the meadow; the cooking window is 2D and unchanged).

For any "worse", get a screen recording or a screenshot from Axel if he can (AirDrop), find the cause, fix it and ask
again.

## 4. Speed check, not the energy measurement yet
On the iPhone with `?perf`, at the default view walking, write down the JS ms of `render` for both backends. Also the
frame drops at 60x zoomed out (the `?bench` run). If gl is slower anywhere, find out why before stage 8. The usual
causes are a flush per draw from a state change, uploads repeating, or stencil passes for opaque paths.

## Acceptance
- Every scene under the bar, or each exception named and OKed by Axel.
- Axel's checklist: no "worse".
- `?gl=0` unchanged.
