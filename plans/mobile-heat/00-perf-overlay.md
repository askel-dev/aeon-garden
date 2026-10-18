# Step 0 — `?perf` overlay

Every other step needs before/after numbers. Add a tiny live perf readout, on only when the URL
has `?perf`, and readable from the console for headless runs.

## Where

All in `game.js`. Useful anchors (search for the names; line numbers drift):

- `const params = new URLSearchParams(location.search);` (~line 15)
- `function frame(now)` — the rAF loop (~line 15687). Its first lines are
  `if (opening === 1) opening = 2;` and `now = onBeat(now);`
- The sim block inside `frame`: `const want = Math.min(Math.floor(acc), 2000), n = Math.min(want, simFit), t0 = performance.now();`
- The render block: `const rest = resting(now) && now - lastDrawn < RESTING_MS;` then
  `if (!rest && canvas.width && canvas.height) { lastDrawn = now; ... render(now); ... }`
- The quarter-second UI block: `if (now - lastCard > 250) { ... lastCard = now; ... }`
- `window.garden = { ... }` at the very bottom (~line 15847).

## Changes

1. Near `params`, add `const PERF = params.has('perf');`
2. Add module-level state:
   ```js
   const perf = { fps: 0, ms: 0, ren: 0, sim: 0 };   // fps and ms are EMAs over raw rAF gaps; ren: render ms; sim: sim ms last frame
   ```
3. In `frame(now)`, before `now = onBeat(now)`, keep the raw time and fold it into the EMAs:
   ```js
   const raw = now, dt0 = raw - (perf.at || raw); perf.at = raw;
   if (dt0 > 0 && dt0 < 250) { perf.fps += (1000 / dt0 - perf.fps) * 0.05; perf.ms += (dt0 - perf.ms) * 0.05; }
   ```
   Add `at: 0` to the `perf` object.
4. Wrap the render call: `const r0 = performance.now(); render(now); perf.ren += (performance.now() - r0 - perf.ren) * 0.1;`
5. In the sim block, after the `while (ran < n)` loop: `perf.sim = performance.now() - t0;`
6. The overlay element: create it lazily from the `lastCard` block (no index.html change):
   ```js
   if (PERF) {
     perf.el = perf.el || Object.assign(document.body.appendChild(document.createElement('div')), {
       style: 'position:fixed;left:4px;bottom:4px;z-index:30;padding:3px 7px;background:rgba(20,16,8,.72);color:#efe7d0;font:11px/1.5 ui-monospace,monospace;border-radius:6px;pointer-events:none;white-space:pre',
     });
     perf.el.textContent = `${perf.fps.toFixed(0)} fps · ${perf.ms.toFixed(1)} ms frame · ${perf.ren.toFixed(1)} ms render · ${perf.sim.toFixed(1)} ms sim\n`
       + `dpr ${dpr} · ${canvas.width}×${canvas.height}`;
   }
   ```
   Put it inside the existing `if (now - lastCard > 250)` block so it updates 4×/s at most.
7. Extend `window.garden` with `perf` so scripts can read it:
   `window.garden = { ..., perf }` (add one property to the existing literal).

## Rules

- No work when `PERF` is false beyond the EMA arithmetic (a few float ops per frame — fine).
- The overlay must not intercept touches (`pointer-events:none`) and must not use `innerHTML`.

## Acceptance

- `http://localhost:8765/?perf&seed=123` shows the readout, updating; without `?perf` there is no element.
- Numbers are plausible: ~60 fps on a 60Hz screen, render ms well under 16 on desktop.
- `garden.perf.fps` readable in the console.
- Baseline table in `plans/mobile-heat/README.md` filled in (emulated iPhone in DevTools; real phone if available).
