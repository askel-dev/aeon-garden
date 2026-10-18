# Step 4 — Adaptive quality governor

When a phone's chip heats up, the OS throttles it and frame times climb — which keeps the heat up.
Break the loop: watch render cost, and when it stays over budget, step quality down a small ladder;
when it has been comfortable for a while, step back up. Silent, automatic, no UI (step 6 adds a
manual toggle on top of it).

## Where

All in `game.js`:

- `resize()` — step 1 added `dpr = coarsePtr.matches ? Math.min(pixelRatio(), 2) : pixelRatio();`
- `drawGround` (~line 461): `const gd = Math.min(dpr, GROUND_DPR, WEBKIT ? ... : Infinity);`
- `drawWeather` (~line 12155): the `skyLayer(SKY_CLOUDS, shade)` call, and `drawRain`/`drawSnow`
  drop counts (`Math.round(150 * amount)` / `Math.round(160 * amount)`).
- `drawFireflies` (~line 12631) and `drawPollen` (~line 12563).
- The render block in `frame` (steps 2–3), and `let renderGap` from step 2.
- `perf` from step 0 (the render-ms EMA is the governor's signal — step 0 must be in first).
- `window.garden` at the bottom.

## Changes

1. Replace step 1's fixed cap with governor-owned state (one new block before `function frame`):
   ```js
   // The quality governor. A hot phone throttles and frame times climb, which keeps it hot: so a
   // frame that stays costly steps the meadow down a rung until it cools, and long comfort steps
   // back up. Silent; the meadow looks the same in the common case.
   const GOV_MS = 4000, GOV_UP = 8;                // a decision this often; this many comfortable ones to climb back
   const REN_OVER = 12, REN_OK = 7;                // render ms, EMA: over budget / comfortable
   const gov = { rung: 0, floor: 0, top: 3, ema: 0, at: 0, ok: 0, hold: false };
   let dprCap = coarsePtr.matches ? 2 : 3, groundCap = GROUND_DPR, lowFx = false;
   ```
2. `resize()`: use `dprCap` in place of the literal `2` from step 1.
3. `drawGround`: `const gd = Math.min(dpr, groundCap, WEBKIT ? ... : Infinity);` (replace
   `GROUND_DPR` there only — keep the constant for the initial value).
4. `lowFx` gates, each a one-line change:
   - `drawWeather`: `if (shade > 0.01 && !lowFx) skyLayer(SKY_CLOUDS, shade);`
   - `drawRain`: `Math.round((lowFx ? 75 : 150) * amount)`
   - `drawSnow`: `Math.round((lowFx ? 80 : 160) * amount)`
   - `drawFireflies` and `drawPollen`: first line `if (lowFx) return;`
5. Applying a rung:
   ```js
   function govApply() {
     const r = gov.rung;
     const d = r >= 1 ? 1.5 : coarsePtr.matches ? 2 : 3, g = r >= 2 ? 1.5 : GROUND_DPR, fx = r >= 2, gap = r >= 3 ? 1000 / 30 - 2.2 : coarsePtr.matches ? FRAME_GAP : 0;
     if (d !== dprCap) { dprCap = d; if (!drag && !pinch) resize(); else gov.hold = true; }   // (not mid-gesture)
     groundCap = g;
     if (fx !== lowFx) lowFx = fx;
     renderGap = gap;
   }
   ```
   (The `dprCap` change repaints sprite caches once — a one-frame hitch, fine; `Ground.draw` sees
   the new `dpr` in its `EXACT` keys and repaints once too.)
6. Deciding, called at the end of `frame` (it already knows `now`). The measurement is step 0's
   `perf.ren` EMA, which updates on every render whether or not the `?perf` overlay is shown:
   ```js
   function govTick(now) {
     if (gov.hold && !drag && !pinch) { gov.hold = false; resize(); }
     if (now - gov.at < GOV_MS) return;
     gov.at = now;
     if (perf.ren > REN_OVER && gov.rung < gov.top) { gov.rung++; gov.ok = 0; govApply(); console.info(`meadow: hot, quality rung ${gov.rung}`); }
     else if (perf.ren < REN_OK && gov.rung > gov.floor && ++gov.ok >= GOV_UP) { gov.rung--; gov.ok = 0; govApply(); }
     else if (perf.ren >= REN_OK) gov.ok = 0;
   }
   ```
   Call it as the last thing in `frame`, before `requestAnimationFrame(frame)`.
7. `window.garden`: add a testing hook whose setter applies at once (setting the module `gov`
   object's `rung` directly would do nothing until a decision happened — that is the trap to avoid):
   ```js
   gov: { get rung() { return gov.rung; }, set rung(r) { gov.rung = clamp(r | 0, 0, gov.top); govApply(); }, get floor() { return gov.floor; }, get ema() { return perf.ren; } },
   ```

## Rules

- A decision at most every `GOV_MS`; a step up only after `GOV_UP` comfortable decisions (≈32 s).
  No oscillation.
- Never change DPR mid-drag/mid-pinch (`gov.hold` defers the `resize()`).
- No new per-frame allocations; the per-frame cost is one function call and a few comparisons.

## Acceptance

- Normal desktop play: rung stays 0, nothing changes visually.
- Console: `garden.gov.rung = 3` → DPR drops (`garden.perf` shows `dpr 1.5`), cloud shadows and
  fireflies vanish, rain thins, fps cap 30; `garden.gov.rung = 0` restores everything after a
  repaint. During a pinch-drag with rung set, the DPR change waits until the fingers lift.
- On a real phone in the README's worst-case scenario, the rung rises within seconds and the phone
  stays cooler; it climbs back after the storm/quiet returns.
- Record before/after numbers in the README table.
