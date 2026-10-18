# Stage 0: the harness (Sonnet)

Before anything is built, make it possible to (a) draw the same frame twice and compare, and (b) measure energy the same
way every time. Every later stage leans on this.

## 1. `?gl` and a still frame, in game.js

- Near `const PERF = ...` (game.js ~17), add:
  ```js
  const GL_ASK = params.get('gl');              // '1' or '0': the meadow's backend, asked for (stage 2 reads it; default for now 0)
  ```
  It does nothing yet. Stage 2 uses it.
- In `window.garden` (the bottom of game.js), add `still(now)`: draws one frame with the world paused at a given
  `now`, without the sim or the loop moving anything, so two runs are comparable:
  ```js
  still(now) { const s = ui.speed; ui.speed = 0; pixelCam(); render(now); ctx.flush?.(); ui.speed = s; },
  ```
  Check that `pixelCam` is safe to call there; it is in `frame()`. If `render` needs `cam` put back afterwards, the way
  `frame()` does it (`const cx = cam.x, cy = cam.y ... cam.x = cx`), do the same.
- Also add `get backend() { return ctx.flush ? 'gl' : '2d'; }` to `window.garden`.

That's the whole game.js change. Keep it to these lines.

## 2. `plans/webgl/tools/scenes.mjs`: the scene shooter

A node script (Node 26 has `fetch` and `WebSocket` built in, so it needs no packages) that drives a visible scratch Chrome
over CDP. Copy the setup from `plans/webgl/tools/energy.mjs`.

- Launch: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir=<scratch> --remote-debugging-port=<odd port, checked free with lsof> --no-first-run --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling`.
  - Never kill Chrome by name. Kill only the PIDs whose command line has the scratch profile dir.
  - Headless Chrome draws canvas in software; that's fine for comparing pictures, not for timing.
- Emulate a phone: `Emulation.setDeviceMetricsOverride` 390×844, deviceScaleFactor 3, mobile, plus touch emulation.
- Before each scene, delete IndexedDB `aeon-garden` and clear localStorage in a new-document script, so no kept meadow
  opens.
- Usage: `node scenes.mjs <out dir> <base url>`, e.g.
  `node scenes.mjs shots/2d 'http://localhost:8765/?seed=123&gl=0'`.
- **The scenes.** Each one is set up by evaluating JS on `garden.world`, `Sim` and `garden.cam`, then
  `garden.still(T)` with a fixed `T`, then `Page.captureScreenshot`. End the intro the way `energy.mjs` does (an `x`
  key, then Escape twice). Make these, each a named function in the script:
  1. `day`: midday, clear, default zoom, the forager at the start.
  2. `wood`: zoomed in on the thickest trees near the start (find the decor tree with the most trees within 6 tiles).
  3. `river`: the camera on running water at zoom 14 (the flow's curls and foam show at zoom ≥ 12).
  4. `autumn`: stepped into autumn (`Sim.step` until `Sim.clock(w).season === 2`, plus half a season), so leaves lie
     and fall.
  5. `night-fire`: evening (phase 0.8), a fire lit next to the forager (copy `benchStart`'s fire lighting), zoom
     default.
  6. `storm`: storm weather (`w.weather.kind = 'storm'`), rain.
  7. `winter`: stepped to winter, snow on the ground and trees.
  8. `far`: zoomed right out (`cam.zoom = cam.goal = fitZoom`: read it as `garden.cam.zoom` after setting a very low
     value; `clampCam` holds it).
  9. `wading`: the forager put in shallow water (find a water tile next to land, put `w.forager.x/y` there).
  10. `selected`: a rabbit selected (`garden.ui.selectedId = <a rabbit's id>`), so the trail and rings draw.
  11. `golden`: phase 0.7 (the golden hour).
  12. `camp`: after the first fire (`w.camp` made), the basket built if it can be (`w.camp.basket`).
- For each scene, hide the page's panels before the shot with CSS:
  `body > *:not(#world, #world-gl, #ground) { visibility: hidden }`.
  Save `<out>/<scene>.png`, plus `<out>/scenes.json` with the backend and `ctx.stats` if there are any.

## 3. `plans/webgl/tools/pixdiff.mjs`

- `node pixdiff.mjs <dir a> <dir b> <out dir>`. For each PNG in both: decode, compare, write a diff PNG (differences in
  red over a greyed copy of a). Print a table: scene, % of pixels off by more than 8/255 on any channel, the worst
  channel difference, mean absolute difference.
- PNG decoding with no packages: use `zlib.inflateSync` and the PNG format directly. CDP screenshots are 8-bit RGBA or RGB,
  non-interlaced, so a small decoder that handles colour types 2 and 6 and the five filter types is enough. Or drive
  Chrome to do it: load both PNGs into a page with a canvas, `getImageData`, and return the numbers. Either is fine;
  pick the simpler one.

## 4. `plans/webgl/tools/energy.mjs`, `draw-bench.html`, `bench-server.mjs`

They're already in `plans/webgl/tools/`, as the session that wrote this plan used them:

- **`energy.mjs`** drives a visible scratch Chrome, already running with `--remote-debugging-port`, through scenes.
  - It is set up by environment variables: `CDP_PORT`, `URL` (the game's), `PROFILE` (a string from the scratch
    Chrome's `--user-data-dir`, used to find its processes), and `SECS` per scene.
  - It samples `top -stats pid,cpu,power` for those processes.
  - `node energy.mjs walk idle` runs just those scenes.
- **`draw-bench.html` + `bench-server.mjs`** are the iPhone micro-bench.
  - Run `node bench-server.mjs` (it serves on `0.0.0.0:8799`), then open `http://<Mac IP>:8799/` on the phone and tap.
  - `?power` runs fixed 30 s scenes and posts each scene's wall-clock start to `bench-marks.jsonl`, for cutting a
    Power Profiler trace.
  - Results go to `bench-results.jsonl`.

Then:

- Give `energy.mjs` the scenes `paused`, `idle`, `walk`, `walk30`, `walkNoDraw`, `walk60x`, and `walkGl` / `idleGl`
  (the same with `&gl=1`, used from stage 2 on). Make it print a markdown table row per scene.
- Write a short `plans/webgl/tools/README.md`: one paragraph and the command line for each tool.

## 5. Baseline

Run `scenes.mjs` on today's code with `gl=0` into `plans/webgl/shots/base/`. Don't commit the PNGs: add
`plans/webgl/shots/` to `.gitignore`. Run `energy.mjs` for the table in README.md, and check the numbers land near it.

## Acceptance

- `garden.still(1000)` twice in a row gives identical screenshots.
- `scenes.mjs` produces the 12 PNGs.
- `pixdiff.mjs base base` reports 0% for every scene.
- `energy.mjs` runs and prints the table.
- `?gl=0` and no `gl` look and play exactly as before. The only change is the hooks.
