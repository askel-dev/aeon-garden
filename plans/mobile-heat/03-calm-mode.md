# Step 3 — Calm mode: 30 fps while just watching

`resting` already drops a paused, untouched meadow to 30 fps. The same idea applies while *playing*
at 1x with a still camera and no input: the meadow moves, but half the frame rate reads the same,
and the GPU cost halves. Any touch, pan, zoom, drag or storm snaps straight back to full rate.

## Where

All in `game.js`:

- `function resting(now)` (~line 15680): computes `still` from `camWas`, updates `camWas` each call.
- The render gate in `frame` from step 2:
  `if (canvas.width && canvas.height && now - lastDrawn >= (rest ? RESTING_MS : renderGap))`
- Module state available to read: `ui.speed`, `ui.effects`, `ui.sky.mix` (weather amounts,
  `.storm` is one), `lastInput`, `drag`, `pinch`, `zoomTo`, `cam.goal`, `cookUi.open`.

## Changes

1. Next to `RESTING_MS`, add:
   ```js
   // Watching the meadow play at 1x, camera still, hands off: 30 fps is plenty (what resting gets
   // when paused). Anything happening — a drag, a zoom, a storm, an effect — stays at full rate.
   const CALM_MS = 2000, CALM_GAP = 1000 / 30 - 2.2;
   ```
2. Have `resting()` remember the stillness it already computes, so `frame` can read it without
   calling `resting` twice (it mutates `camWas`):
   ```js
   let camStill = false;
   function resting(now) {
     const still = cam.x === camWas.x && cam.y === camWas.y && cam.zoom === camWas.zoom;
     camStill = still;                            // (for calm(), next)
     ...
   ```
3. Add:
   ```js
   const calm = now => ui.speed === 1 && camStill && !drag && !pinch && !zoomTo && !cam.goal
     && !ui.effects.length && !cookUi.open && ui.sky.mix.storm < 0.2 && now - lastInput > CALM_MS;
   ```
4. In `frame`, compute it after `const rest = resting(now);` and use it in the gate:
   ```js
   const rest = resting(now), easy = calm(now);
   if (canvas.width && canvas.height && now - lastDrawn >= (rest ? RESTING_MS : easy ? CALM_GAP : renderGap)) {
   ```
   (`resting` already covers paused-and-still; calm covers playing-at-1x. A sprint at 1x moves the
   camera, so `camStill` is false and full rate continues while walking.)

## Rules

- Do not call `resting(now)` twice in a frame — it consumes `camWas`.
- No timers, no listeners: just the two extra comparisons in the gate.

## Acceptance

- `?perf&seed=123`, speed 1, hands off, camera still: within ~2 s fps settles to ~30. Animals,
  water and weather still animate.
- Tap or drag: fps returns to full rate the same frame; no hitch.
- `garden.ui.speed = 60`: calm never engages (speed ≠ 1).
- Paused resting behaviour unchanged.
- Update the frame-loop description in `CLAUDE.md` (the ground.js bullet mentions the paused
  30 fps `resting`): add that a calm, watched meadow draws at 30 fps too.
