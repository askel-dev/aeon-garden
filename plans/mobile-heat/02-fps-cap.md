# Step 2 — Cap rendering at 60 fps on high-refresh phones

`frame(now)` renders on every `requestAnimationFrame`. On a 120Hz phone that is 120 full scene
renders a second for a meadow that reads perfectly at 60. The sim must still tick on *every* rAF
(its accumulator handles any dt) — only the drawing is capped.

## Where

All in `game.js`, in and around `function frame(now)` (~line 15687):

- The render gate:
  ```js
  const rest = resting(now) && now - lastDrawn < RESTING_MS;
  if (!rest && canvas.width && canvas.height) {   // (a hidden tab can have no size)
    lastDrawn = now;
    ...
  }
  ```
- `const RESTING_MS = 30, WOKEN_MS = 500;` and `let lastDrawn = 0, lastInput = 0;` (~line 15659)
- `coarsePtr` from step 1.

## Changes

1. Near `RESTING_MS`, add:
   ```js
   // The most frames worth painting a second. A 120Hz phone renders every other rAF instead of all
   // of them; the sim still runs on every beat. 0 paints every frame (a 60Hz screen is unaffected:
   // its beats are already past the gap).
   const FRAME_GAP = 1000 / 60 - 2.2;              // under a 60Hz beat, over half a 120Hz one
   let renderGap = coarsePtr.matches ? FRAME_GAP : 0;
   ```
2. Rewrite the render gate so one condition serves both caps:
   ```js
   const rest = resting(now);
   if (canvas.width && canvas.height && now - lastDrawn >= (rest ? RESTING_MS : renderGap)) {
     lastDrawn = now;
     ...                                          // unchanged body
   }
   ```
   Behaviour is identical to before when `renderGap` is 0 and identical to before when resting
   (`RESTING_MS` still governs the paused 30 fps).
3. Everything else in the render block (`paintTerrain`, `handShow`/`handBack`, `drawCookView`) and
   everything outside it (sim, `leadCam`, `hand.was` bookkeeping) stays exactly as it is. In
   particular the `hand.was.x = cam.x; ...` line after the block must keep running on every rAF.

## Rules

- Do not throttle the sim loop or input handling — only what is drawn.
- Do not touch `onBeat`; use the beat-adjusted `now` as the rest of `frame` does.

## Acceptance

- Desktop 60Hz: `garden.perf.fps` still ~60, motion identical to before this step.
- Emulate a high-refresh phone, or temporarily set `renderGap = 33` in the console: fps settles at
  ~half the rAF rate, animation stays smooth, and the camera still follows the forager evenly.
- Paused (`garden.ui.speed = 0`): after ~a second the fps drops to ~30 as before.
- Record numbers in the README table.
