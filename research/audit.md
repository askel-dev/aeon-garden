# Audit of the keeper work (43caa22..5fb305e): PARTIAL, stopped early

Read-only audit. I read the full cumulative diffs of sim.js and game.js since 43caa22 and PLAN.md.
I did NOT get to: running balance.js, pack/unpack scripts, reading packWorld/unpackWorld bodies, ground.js/index.html diffs, the
bee-larder commit in depth. So everything below is from reading the code, and **nothing is verified by a run** unless it says so.
Line refs are to the functions by name (sim.js / game.js at HEAD); grep for them.

The uncommitted sim.js hunk (`wildGreen`) is another session's work in progress and is not audited.

## Ranked findings

### 1. Possible crash: `atTurned` reads `c.target.turned` without a null check (sim.js `atTurned`, called from `crowTick`)
`const atTurned = (w, c) => !!w.turned?.length && (c.mode === 'forage' && !!c.target.turned || ...)`.
If a crow is ever in mode 'forage' with `c.target === null` while `w.turned` is non-empty and the evening gathering condition is
being checked, this throws a TypeError inside the sim step and kills the frame loop. Only at ?keep after a dig/sow/hedge (w.turned).
**Confidence: medium. Unverified**: I didn't check whether crow code ever leaves mode 'forage' with a null target (grep `mode = 'forage'`
and every `c.target = null` in the crow code). Fix if so: `c.target?.turned`.

### 2. A rabbit's `c.hedgeTo` is a reference to a decor object (sim.js `flee`, `inUnder`, `hedgeOf`)
Creatures now hold a live pointer to a hedge whip. If `packWorld` serializes creatures field by field / JSON-style, `hedgeTo` comes back
as a detached copy (or the pack drags a whole decor object into each creature). After a reload, `standing(d)` on the copy never sees the
whip die, and `inUnder` keeps steering the rabbit to the copy's x/y. `c.refuge` (a burrow) likely has special handling in pack/unpack;
`hedgeTo` probably doesn't. **Confidence: medium. Unverified**: check packWorld's creature handling; the fix is to store the whip's
id, or drop `hedgeTo` and `covered` on unpack (as `held` is dropped).

### 3. The ground's parched texture is never cleared (game.js `updateParch`)
`updateParch` returns early when `world.parched` is null, so when the Dry Year ends (parch sets it null), or a new/started-again world
opens without one, the last parched data stays on the GPU. Harmless only if ground.js multiplies it by the `drought` uniform (which
does go to 0). **Confidence: low-medium. Unverified**: check ground.js's use of the `parched` texture vs `drought`.

### 4. Extinctions in the Dry Year only count with migration on (sim.js `migrate` -> `dryGone`)
`dryGone` is called only inside `migrate`, which returns at once when `!w.options.migration`. With migration off, a species dying
out never loses the Dry Year (and the `extinct` news never comes, which was already so). **Confidence: high on the code path; low
impact** unless ?keep can turn migration off.

### 5. A strip sown during the Dry Year is unparched till dawn (sim.js `sowStrip`)
It writes `w.shadedFert[i] = fert * (1 - shade * wood)` directly, skipping `parch`, so a strip sown out in the straw holds green grass
for the rest of the day (and greenShare/greenSpots see it) until the next dawn's `shadeSoil`. `digPond` and `plantHedge` call
`shadeSoil` when `dryness > 0`; `sowStrip` doesn't. **Confidence: high, low severity.**

### 6. Keep made the default (b475906): old players' kept meadows (game.js `meadowLink`, `KEPT`, `resumeWorld`)
`meadowLink` now always adds `&keep` or `&watch`, and ?keep uses its own store key `aeon-garden-kept-keep`. A returning player's watched
meadow was kept under the old link (`?seed=N`, no `&watch`), so `?watch` may not find it and the bare address now opens a fresh keeper
meadow. **Confidence: low-medium. Unverified**: I didn't read `resumeWorld`/`keepMeadow` to see how links are matched.

### 7. Kept-before-the-Dry-Year meadows get `year: yearOf(w.tick) + 1` (sim.js `unpackWorld`)
The comment says "it comes next summer"; `dryStage` treats `year` as 1-based. If `yearOf` is 1-based this puts it in next year's
summer even when this year's summer hasn't come yet (up to ~1.75 years away); if 0-based, it's this year's. **Unverified**: check `yearOf`.

### 8. Perf, small (none measured)
- `greenSpot` (sim.js): up to 21x21 = 441 cells per call, for each hungry rabbit with no food every 10th tick, through the Dry summer.
  With a few hundred rabbits at 60x that's tens of thousands of ops per tick; PLAN.md says node showed it "too small to show", so
  likely fine, but it's the only new hot-loop cost.
- `moveLabel` (game.js): reads `offsetWidth/offsetHeight` on every pointermove with a placing tool in hand, right after `placeLabel` may
  have rewritten `innerHTML`: a forced layout per mouse move. Cheap but avoidable.
- `hedgeWhips` / `hedgeMiddle` / `hedgeLink` (game.js) scan all of `world.decor`; they run in news lines, Yours and the inspector
  (a few times a second while a whip is inspected). `dugFacts` runs `world.spawn.some(...)` over every tile per inspector refresh. Fine
  at today's sizes.
- `updatePlantLooks` (game.js): the tawny tufts (`dryness > 0.5`) only refresh when `terrainTick` changes, so they can lag the Dry
  Year's start/end by a while. Cosmetic.

## Checked and looked fine
- `dryStage` / `dryFrom` / `dryTo` / `dryness` season arithmetic agrees with `waterGoal`, `pickWeather` and the ribbon's pip index.
- `forecastTick`, `updateGreen`, `updateSpeciesMarks`, `alertsTick`, `tasksTick` write the DOM only on change and on the 250 ms beat.
- The ghost is one small canvas repainted only when the stroke reaches a new tile; `drawPlacing` is one drawImage.
- `parch`/`greenSpots`/`hedgeLanes`/`hedgesDay` are once a day; `greenShare` once a sim day (sim and HUD each).
- `pondPlan`/`hedgePlan` with strokes dragged off the meadow: bounds are clamped, no NaN path found.

## Not done (next steps)
Read `packWorld`/`unpackWorld` and run a scratch script: createWorld(seed, {keep:true, dry:1}), dig/sow/plant, step into the Dry summer,
pack -> JSON -> unpack, step both a day and compare counts and `w.parched`/`w.greenSpots`/`c.hedgeTo`. Run `node balance.js 6 4 v`
against the PLAN.md baseline. Grep crow code for 'forage' with a null target (finding 1).
