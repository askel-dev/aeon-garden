# Mobile heat & battery — implementation steps

Phones run the game hot and drain battery. The causes (found by reading the code):

1. The world canvas renders at full `devicePixelRatio` — 3× on most phones (~3 Mpx redrawn every frame). The ground layer is already capped (`GROUND_DPR = 2`); the world canvas is not.
2. No frame-rate cap: on 120Hz phones `requestAnimationFrame` fires 120×/s and every frame renders.
3. Rendering throttles only when *paused* (`resting`, 30 fps). Watching the meadow play at 1x renders at full rate.
4. The wake lock holds the screen on 10 min after the last touch (`WAKE_MS`).
5. Nothing adapts when the chip heats up and throttles.
6. Sound keeps playing from a hidden tab (the `AudioContext` is never suspended).

## The steps, in order

| Step | File | Depends on | Touches |
|---|---|---|---|
| 0 | `00-perf-overlay.md` | — | game.js |
| 1 | `01-dpr-cap.md` | 0 | game.js |
| 2 | `02-fps-cap.md` | 0 | game.js |
| 3 | `03-calm-mode.md` | 2 | game.js |
| 4 | `04-quality-governor.md` | 1, 2 | game.js |
| 5 | `05-battery-api.md` | 4 | game.js |
| 6 | `06-saver-toggle.md` | 4 | game.js, index.html |
| 7 | `07-wake-lock.md` | 6 | game.js |
| 8 | `08-audio-suspend.md` | — | sound.js, game.js |
| 9 | `09-measure-then-trim.md` | all above | game.js, sound.js |

Do them in order. Each is a self-contained task: hand the one file to whoever implements it,
plus this README. Steps 5–7 are small; they can be one session.

## Rules every step must follow (from CLAUDE.md)

- Read `CLAUDE.md` at the repo root first. Its performance rules are law: paint once and copy,
  no gradients/`shadowBlur`/`ctx.filter`/`getImageData`/`measureText`/new canvases per item per
  frame, no string-built keys in hot loops, no new objects or arrays in per-frame paths.
- Follow the file's existing style: `const`/`let`, semicolons, sentence-case header comments over
  each block, lowercase parenthetical asides `// (like this)`, British spelling in comments.
- A new feature must not slow the game down. These steps exist to make it faster; none may add
  per-frame work beyond a few comparisons.
- Keep it stupidly simple. No frameworks, no new files except where a step says so.
- Do not commit. Leave the working tree for review.
- If a step changes behaviour that `CLAUDE.md` describes (the frame loop, `resting`, DPR handling),
  update the matching paragraph there.

## Running and testing

```bash
python3 -m http.server 8765    # then open http://localhost:8765
```

- `?seed=123` replays a fixed meadow. `?perf` (after step 0) shows fps/render-ms/sim-ms live.
- `window.garden` in the console: `world`, `cam`, `ui`. `garden.ui.speed = 60` fast-forwards for
  stress testing; `garden.ui.speed = 1` is normal play, `0` paused.
- The worst case to test: zoomed out (pinch or `garden.cam.zoom = garden.cam.goal = 1`), storm or
  rain at night, a lit fire on screen, `garden.ui.speed = 60`.
- Emulate a phone in Chrome DevTools (device toolbar, iPhone/Pixel presets). DPR and coarse-pointer
  behaviour show up there; heat itself only shows on a real phone.
- Checking visuals headlessly: see "Checking visuals" in CLAUDE.md (Chrome over the DevTools
  protocol; `--headless=new --screenshot` captures only the first frame).

## Baseline numbers (fill in during step 0, compare after each later step)

On an emulated iPhone (DPR 3) and, if available, a real phone, at 1x unless said:

| Scenario | fps | render ms (p50) | sim ms | canvas px |
|---|---|---|---|---|
| Idle, zoomed in | 60 | 1.5 | 0.2 | 780×1688 |
| Walking | 60 | 1.4 | ~0 | 780×1688 |
| Zoomed out | 60 | 1.2 | ~0 | 780×1688 |
| Storm (opening storm, daytime, no fire), 60x | 60 | 1.1 | 0.6 | 780×1688 |

Measured 2026-10-18 in the Claude desktop browser pane, emulated 390×844 at DPR 2 (the pane's emulation gave 2, not 3), Mac GPU, seed 123, medians over 5 s samples. Night + fire not set up, so that row is the opening storm at 60x only. Real phone not measured.

After step 1 (DPR cap), 2026-10-18, headless Chrome over CDP, emulated 390×844 touch at DPR 3, seed 123, idle, medians over 5 s: canvas 780×1688 (was 1170×2532 uncapped), render 1.1 ms (uncapped 0.9 ms in the same run). Render ms is script time only (the draw calls queue to the GPU and aren't timed here), so it doesn't show the 2.25× pixel saving; that shows on a real phone.

After step 2 (FPS cap), 2026-10-18, headless Chrome over CDP, seed 123, idle at 1x, counts over 5 s (rAF beats 300, headless is 60Hz): desktop 300 draws, `perf.fps` 60.0, render 0.6 to 1.1 ms; emulated 390×844 touch DPR 3 (`renderGap` ≈ 14.5 ms) 300 draws, 60.0 fps, 1.1 ms (a 60Hz beat is past the gap, so unchanged); same with the gap forced to 33 ms (a 120Hz stand-in, run from a scratch copy) 150 draws of 300 beats, sim/rAF still 60.0; paused (speed 0) 150 draws of 300 (30 fps) in all three. Draws counted as rAF frames that called `drawImage` on the world canvas. A real 120Hz phone not measured.

After step 3 (calm mode), 2026-10-18, headless Chrome over CDP, emulated 390×844 touch DPR 3, seed 123, draws vs rAF beats over 3 s (storm mix forced to 0 from a test interval, since the opening gale holds above 0.2 until a fire is lit): speed 1 hands-off 90 of 180 (30 fps); speed 60 180 of 180; paused 100 of 180; first second after a tap 61 of 62, then back to 90 of 181 once 2 s have passed. With the opening storm left on, speed 1 draws 180 of 180. `perf.fps` still reads the rAF rate (60), not the draw rate.

After step 4 (quality governor), 2026-10-18, headless Chrome over CDP, emulated 390×844 touch DPR 3, seed 123: hands-off at rung 0 for 13 s, rung stayed 0 (render EMA 0.9 to 1.8 ms, canvas 780×1688). `garden.gov.rung = 3`: canvas 585×1266 (dpr 1.5), and at 60x with input each frame draws fell from 181 of 181 frames (rung 0) to 90 of 179 (rung 3, 30 fps); `rung = 0` back to 780 wide. Rung set during a held touch: canvas stayed 780 for the touch, went to 585 after the lift (`gov.hold`). Natural run: CPU throttled 20x at 60x speed, render EMA rose to 10 ms and the rung went 0 to 1 within 10 s (it never passed REN_OVER 12 for a second decision); unthrottled it climbed back to 0 after about 20 to 25 s of comfort. Real phone not measured.

After steps 5 to 7 (battery, saver toggle, wake lock), 2026-10-18, headless Chrome over CDP, seed 123, desktop and emulated 390×844 touch DPR 3: desktop boot `gov.floor` 0, no errors; ••• › Battery saver: label "on", `floor` 1, `rung` 1 (phone canvas 780 to 585 wide), reload keeps it (rung 1 at boot), off again gives `floor` 0 and the rung stays till the governor climbs; with saver on `rung = 3` still allowed. Battery stubbed (`getBattery` charging false, level 0.1, via a new-document script): fresh load starts at rung 1, floor 1, canvas 585. Wake lock (step 7) checked by reading only. Real Android and Safari not tested.
