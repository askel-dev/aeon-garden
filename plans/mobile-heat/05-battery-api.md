# Step 5 — Battery-aware starting rung

Chrome/Android exposes the battery. When the phone is low and unplugged, start the governor one
rung down instead of waiting for heat to build; relax again when it charges. iOS has no such API —
there, the frame-time governor from step 4 is the whole answer, and this step is a no-op.

## Where

All in `game.js`, next to the governor from step 4 (`gov`, `govApply`).

## Changes

1. After `govApply`, add:
   ```js
   // Low and unplugged (where the browser tells us: Chrome): start a rung down, before the heat
   // builds. iOS says nothing; the governor's frame times answer there instead.
   if (navigator.getBattery) navigator.getBattery().then(b => {
     const mind = () => {
       gov.battFloor = !b.charging && b.level < 0.2 ? 1 : 0;
       if (gov.battFloor > gov.floor) { gov.floor = gov.battFloor; if (gov.rung < gov.floor) { gov.rung = gov.floor; govApply(); } }
       else if (!gov.battFloor && !saverFloor()) gov.floor = 0;   // (charged again; step 6's saver may still hold a floor)
     };
     b.addEventListener('levelchange', mind); b.addEventListener('chargingchange', mind);
     mind();
   }).catch(() => {});
   ```
   Add `battFloor: 0` to the `gov` object in step 4, and for now a stub next to it:
   `const saverFloor = () => false;` — **step 6 replaces that stub** with the real check, so the
   two floors compose.
2. Nothing else. The governor keeps its normal behaviour; the floor only stops it climbing all
   the way back up while the battery is low.

## Rules

- Guard everything (`navigator.getBattery` is absent in Safari/Firefox — the feature simply does
  nothing there). No polling: events only.
- Do not surface this in the UI.

## Acceptance

- Desktop Chrome, DevTools console: no errors; `garden.gov` shows `floor: 0` (a laptop on charge).
- If testable on Android Chrome: with battery under 20% and unplugged, a fresh load starts at
  rung 1 (`garden.gov.rung === 1`); plugging in lets it climb back after the usual comfortable
  stretch. If no Android device is at hand, verify by stubbing:
  `navigator.getBattery = () => Promise.resolve({ charging: false, level: 0.1, addEventListener() {} })`
  in a throwaway copy of the page, or by trusting the guard and the code review.
- Safari: page loads, no errors, governor unaffected.
