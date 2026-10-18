# Stage 2: the gate (Opus)

Wire stage 1's renderer into the real game behind `?gl=1`, and **measure on the phone whether it saves energy** before
anyone builds the atlas, the paths and the rest. This is the plan's decision point. The overseer brings the numbers to
Axel and doesn't start stage 6 until he says go.

## 1. The wiring (kept; stage 6 finishes it)

In game.js:

- Make `ctx` swappable:
  - `const ctx = canvas.getContext('2d')` (~line 53) becomes `const ctx2d = canvas.getContext('2d'); let ctx = ctx2d;`.
  - Grep for every `ctx` that is captured once and kept: a `const ALPHA = ...` read off `ctx`, `RESTORE = ctx.restore`,
    `Object.defineProperty(ctx, ...)`. Those must follow the swap.
- Put the mist fade's wrapping in one function, `wrapAlpha(c)`. It installs the `globalAlpha` accessor and the
  `restore` patch on `c`, using `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), 'globalAlpha')`. Call it
  for each ctx that is ever made current.
- `useGl(on)`:
  - **On:** create the WebGL canvas once (`#world-gl`): the same CSS as `#world`, `pointer-events: none`, inserted just
    before `#world` (so after `#ground`). Then `Gl2d.make` it, `wrapAlpha` it, and size it like `resize()` sizes
    `#world` (`vw * dpr` by `vh * dpr`). Set `#world`'s backing size to 0×0, so it's a clear input surface that costs
    nothing to composite.
  - **Off:** hide `#world-gl` and resize `#world` as today.
  - Set `alphaNow` afresh after either.
- `resize()` sizes whichever canvas is drawing. The frame's `canvas.width && canvas.height` check reads that canvas.
- At boot: `useGl(GL_ASK === '1' && !!window.Gl2d)`. The default stays 2D until stage 8.
- `render` ends with `ctx.flush?.()`.
- `freeImage` also calls `ctx.forget?.(img)`, and so does `dropTreeArt`'s `image.close()`.
- `?perf` shows `gl` or `2d`, and for gl: draws, flushes and uploads from `ctx.stats`.

## 2. Paths off, on both backends, for a fair test

The stage-1 context draws no paths, so the WebGL meadow has no river streaks, foam, waves, rain, snow, creature
shadows or rings. To compare like with like, add `?nopaths`: on the 2D backend, the same calls become no-ops. Do that by
wrapping `beginPath`, `fill`, `stroke` and `clip` on `ctx2d` with functions that return at once. It's for measuring only.

## 3. Measure

Use the same scene for every run:
- `?seed=123&nopaths`, midday, clear weather, default zoom;
- the forager walking to and fro, as `energy.mjs`'s `walk` scene does it, from a console snippet or a `?walk` flag
  added for this;
- 1x speed, sound off;
- on the phone, brightness fixed, and the phone not hot from a previous run (wait a few minutes between runs).

**iPhone, the deciding numbers.**
- Serve the worktree on the LAN: `python3 -m http.server 8765 --bind 0.0.0.0`.
- Open `http://<Mac IP>:8765/?seed=123&nopaths&walk&gl=0` on the phone, then `&gl=1`. Alternate the order over 3 runs
  each (2D, GL, GL, 2D, 2D, GL).
- During each run, record 60 s:

  ```bash
  xcrun xctrace record --device <udid> --instrument 'Power Profiler' --instrument 'Thermal State' --all-processes --time-limit 60s --output gl-<n>.trace
  ```

  The phone must be unlocked and awake; xctrace times out "waiting for device to boot" when it's asleep.
- Export the tables (`xcrun xctrace export --input X --toc`, then `--xpath` with the table's schema):
  - `ProcessSubsystemPowerImpact`: CPU and GPU impact per process. Sum Safari's processes: `MobileSafari`,
    `com.apple.WebKit.WebContent`, `com.apple.WebKit.GPU`.
  - `SystemPowerLevel`: % an hour. It reads 0 while the phone charges from the Mac's port. If it does, the per-process
    impacts are the numbers to use.
- If tethered traces carry no per-process numbers (they may not, while charging), use the phone's own recorder instead.
  Axel starts it on the phone: Settings › Developer › Performance Trace, or Control Centre's recording control, if this
  iOS has them. Then he AirDrops the trace to the Mac. Write down which route worked.

**Mac, supporting numbers:** `energy.mjs` scenes `walk` vs `walkGl`, `idle` vs `idleGl`, in Chrome. Run the Safari
variant too, since Safari is the iPhone's engine.

## 4. The verdict

Write `plans/webgl/GATE.md`:
- a table of every run;
- the medians;
- WebGL's saving in % on the phone (CPU, GPU and total for Safari's processes);
- `render`'s JS ms per frame on both backends, from `?perf`;
- what the phone's thermal state did.

Then one of three verdicts:
- **Go:** total saving of 15% or more on the phone.
- **Stop:** under 15%.
- **Unclear:** the noise is bigger than the difference; say what would settle it.

Don't round in WebGL's favour. If the 2D path's per-call cost isn't what's draining the battery on this phone, this
stage exists to find that out cheaply.

## Acceptance

- `?gl=1&nopaths` shows the meadow, minus its paths, the same as `?gl=0&nopaths`, by eye and by `pixdiff.mjs` over
  the 12 scenes. Images don't have to be exact yet: stage 7 does parity.
- `?gl=0` without `nopaths` is exactly as before: `pixdiff` against `shots/base` gives 0%.
- `GATE.md` is written, with the raw numbers.
