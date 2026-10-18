# Stage 9 (optional): the ground in the same canvas (Opus)

Only if stage 8 shipped, and only if Axel wants more. Today the page composites two full-screen canvases every frame
the meadow draws: `#ground`, opaque and slid by a CSS transform, and `#world-gl`, transparent, over it. On a phone the
second full-screen layer costs memory bandwidth every frame. Drawing the ground into `#world-gl` makes it one opaque
layer, and puts the ground and the sprites on one pixel grid, so there's nothing left to jitter.

Measure first: is the composite worth it? In a scratch copy, hide `#ground` (`display: none`) during the `walk` scene
and record power on the phone, vs. shown. That's an upper bound on what this stage can save. **If it's under 5%, stop
here.**

## Design, if it goes ahead
- The ground shader renders into a texture (an FBO) instead of its own canvas, at `gd` with the `PAD` margin, exactly as
  it paints now: rarely, only when `steady` says it must. ground.js becomes a client of gl2d's context: it takes the
  `gl` from it and keeps its own program and textures.
- Each frame, gl2d draws that texture first, as one full-screen quad at the ground's slide offset (`Ground.view`, in
  ground pixels, scaled to device pixels). Then the meadow over it.
- **`source-atop` changes meaning on one canvas:** it would tint the ground too. Keep today's look, where the ground's
  golden light is the shader's and the wash tints only what stands:
  - Draw the ground quad with the colour mask's alpha off and the canvas cleared to alpha 0 first, so destination alpha
    stays 0 where only ground is.
  - Sprites write alpha as now. `source-atop` (DST_ALPHA) then tints only them.
  - At the end of the frame, set alpha to 1 everywhere: `colorMask(false, false, false, true)`, a clear to 1, then the
    mask back.
- The canvas is created with `alpha: false` if the above can work without destination alpha. It can't, as written,
  so keep `alpha: true` and make the final alpha 1, which the compositor can treat as opaque. Check that Safari does.
- The night's navy wash goes over the ground as now, as a fill over everything.
- Context loss now takes the ground with it. The 2D fallback must bring back `#ground` with its own context
  (ground.js today), so keep that path working.
- `pixelCam` and the jitter workarounds can go only once this is proven on the phone. Leave them in this stage.

## Acceptance
- Power on the phone: the walk scene, two-canvas vs one-canvas, 3 runs each. Ship only if it's better.
- Parity scenes under stage 7's bar; Axel's checklist again, items 1–3 at least.
- `?gl=0` still works, with the two-canvas 2D path.
