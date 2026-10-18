# Step 1 — Cap the world canvas at DPR 2 on touch devices

The world canvas (`#world`) is sized `vw * dpr` × `vh * dpr` with `dpr = pixelRatio()` — 3 on most
phones, i.e. ~9 device pixels per CSS pixel, fully redrawn every frame. The painted art style hides
a cap at 2 completely (the ground layer is already capped at `GROUND_DPR = 2`). On a DPR-3 phone
this alone cuts the pixel count ~2.25×.

## Where

All in `game.js`:

- `const canHover = matchMedia('(hover: hover)');` (~line 59, by `narrow()` and `short()`)
- `function pixelRatio()` (~line 64)
- `function resize()` (~line 102): the line `dpr = pixelRatio();`

## Changes

1. Next to `canHover`, add:
   ```js
   const coarsePtr = matchMedia('(pointer: coarse)');
   ```
2. In `resize()`, replace `dpr = pixelRatio();` with:
   ```js
   dpr = coarsePtr.matches ? Math.min(pixelRatio(), 2) : pixelRatio();   // a phone's 3x paints 2.25x the pixels of 2x for no visible gain
   ```
   Leave `pixelRatio()` itself unchanged (its Safari workarounds still apply).

That's the whole step. Everything downstream (sprite sizes, the forager's art cache `art.d === dpr`,
`plantKeysDpr`, the ground's own cap) already keys off `dpr` and repaints itself.

## Rules

- Do not change `GROUND_DPR` or the ground's DPR logic (already capped).
- Do not cap desktop/non-touch — leave `pixelRatio()`'s result alone there.

## Acceptance

- Chrome DevTools device emulation, iPhone (DPR 3): `garden.perf` shows `dpr 2`, and
  `canvas.width` ≤ 2× the CSS width. A desktop window still shows the uncapped DPR.
- The meadow looks the same at arm's length; sprites and the forager are still sharp.
- `?perf` render ms on an emulated phone is lower than the baseline from step 0; record it in the
  README table.
- Rotate the emulated phone (resize): no errors, canvas resizes correctly.
