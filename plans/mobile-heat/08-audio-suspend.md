# Step 8 — Suspend sound in a hidden tab

Once sound is on, the `AudioContext` (rain, bees, fire, the reverb) renders audio in real time for
as long as the page lives — including from a background tab, all day. Suspend it while the page is
hidden; bring it back on return if sound is on.

## Where

- `sound.js`: `let ac` and `function start()` (~line 47: `if (ac) { if (ac.state === 'suspended') ac.resume(); return; }`);
  the export `window.Sound = { start, play, update, setEnabled, setVolume, ... }` (~line 1654).
  Module state: `enabled`.
- `game.js`: the existing listener
  `document.addEventListener('visibilitychange', () => { if (document.hidden) keepMeadow(); else freshDb().catch(() => {}); });`
  (~line 15484).

## Changes

1. `sound.js`, before the export:
   ```js
   // Hidden, the meadow keeps silent and the audio thread stands down; back and wanted, it wakes.
   const suspend = () => { if (ac && ac.state === 'running') ac.suspend(); };
   const wakeUp = () => { if (ac && enabled && ac.state === 'suspended') ac.resume(); };
   ```
   Add both to the `window.Sound` literal.
2. `game.js`, extend the existing listener:
   ```js
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) { keepMeadow(); Sound.suspend?.(); }
     else { freshDb().catch(() => {}); Sound.wakeUp?.(); }
   });
   ```
   (`Sound` may not exist if sound.js failed to load, and `ac` is null until the first sound —
   both are guarded.)

## Rules

- Resume only when sound is enabled (`enabled` check inside `wakeUp`), and never create the
  context here — `start()` still owns that.
- Do not pause the sim or the clockwork on hide: rAF already stops, and the sim's capped
  accumulator handles the gap. Only audio changes.

## Acceptance

- Sound on, audible rain/fire; switch to another tab: within a moment the sound stops
  (`ac.state === 'suspended'` — checkable via a temporary console log or breakpoint).
- Back on the tab: sound resumes by itself.
- Sound off, hide and return: nothing happens, no errors.
- iOS Safari if available: same behaviour (its AudioContext supports suspend/resume).
