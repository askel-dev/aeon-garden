# Step 6 — "Battery saver" toggle in the ••• menu

Some players will happily trade shimmer for battery whenever they play on a phone. Give them a
manual switch that pins the governor to at least rung 1, remembered between visits.

## Where

- `index.html` ~line 1263–1274: the `•••` menu's items, e.g.
  `<button class="menu-item phone-only" data-act="sound" id="sound-item"><span class="e">🔇</span> <span class="l">Sound is off</span></button>`
- `game.js`: the delegated click handler (~line 15112, the long `else if (t.dataset.act === ...)`
  chain); the governor from step 4; localStorage precedent: `localStorage.getItem('aeon-garden-sound')`
  (~line 15843).

## Changes

1. `index.html`: add one item after the sound item (a leaf, in keeping with the meadow):
   ```html
   <button class="menu-item" data-act="saver" id="saver-item"><span class="e">🍃</span> <span class="l">Battery saver is off</span></button>
   ```
2. `game.js`, near the governor. **If step 5 is in**, replace its `const saverFloor = () => false;`
   stub with the first line below; if step 5 hasn't been done, just add everything:
   ```js
   // Battery saver (••• menu): pins the governor at least a rung down, remembered like the sound choice.
   const saverFloor = () => saverOn ? 1 : 0;
   let saverOn = false;
   function toggleSaver(on = !saverOn) {
     saverOn = on;
     try { localStorage.setItem('aeon-garden-saver', on ? '1' : '0'); } catch (e) {}
     gov.floor = Math.max(gov.battFloor || 0, saverFloor());
     if (gov.rung < gov.floor) { gov.rung = gov.floor; govApply(); }
     const l = $('#saver-item .l'); if (l) l.textContent = `Battery saver is ${on ? 'on' : 'off'}`;
   }
   ```
   (Turning the saver off never *lowers* the rung by itself — the governor climbs back on its own
   after its usual comfortable stretch. `gov.battFloor` is step 5's; the `|| 0` covers its absence.)
3. In the click chain, add beside the other menu acts:
   `else if (t.dataset.act === 'saver') { toggleSaver(); toast(saverOn ? '🍃 Battery saver on — the meadow takes it easy' : '🍃 Battery saver off'); }`
4. On boot, next to the sound restore (~line 15843):
   ```js
   try { if (localStorage.getItem('aeon-garden-saver') === '1') toggleSaver(true); } catch (e) { /* fine */ }
   ```
   This must run after the governor exists (it does — the boot lines are at the file's end).

## Rules

- One menu line, updated in place like the sound item; no new panels, no settings page.
- The key name keeps the `aeon-garden-` prefix (renaming old keys loses settings; a new key is fine).
- Menu closes after the tap: that already happens for any act that isn't `more`
  (`toggleMore(false)` at the top of the handler).

## Acceptance

- ••• → 🍃 Battery saver: label flips, toast shows, `garden.gov.floor === 1`, and quality drops a
  rung (DPR cap 1.5). Tap again: restored.
- Reload the page: the choice persists.
- With saver on, the governor may still step *up* rungs under load; it just never returns to 0.
- `CLAUDE.md`: add the new `aeon-garden-saver` key to the localStorage mention in the header
  paragraph if you touch that paragraph anyway — optional here.
