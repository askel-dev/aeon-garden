# QoL 3 — "Waiting for <name>" when the host's meadow stalls

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, add a small, quiet pill for guests when the
host's page stops sending positions (usually because the host's tab is in the background or the
phone screen went dark). Today the guest's meadow simply freezes with no explanation.

Read `CLAUDE.md` first, then the multiplayer section of `game.js`:
`POS_MS`, `netFrame`, `sendPos`, `heardPos`, `heardWorld`, `setClock`, `guestBehind`, `netCard`,
`reconnectShow`, and `#reconnect` in `index.html`.

## Important working-tree rules

- The tree has uncommitted work by the owner. Do **not** run `git checkout`, `git stash`,
  `git reset`, `git commit`, or reformat. Do not revert unrelated changes.
- Touch only `game.js`, `index.html`, and the docs note.
- No new dependencies. Keep the code comments in the game's prose voice.
- No per-frame DOM writes: the pill's state should be computed a few times a second and written
  only when it changes.

## Why this happens

The host sends a `pos` message every `POS_MS` (150 ms) while together, and the host's `pos` carries
`tick` (the host's clock). A guest runs the same sim but cannot run more than `AHEAD_MS` (500 ms
past the last host tick) ahead (`guestBehind`). When the host's tab is hidden, `requestAnimationFrame`
stops, so no positions arrive and the guest's world stops advancing. From the guest's side this
looks exactly like the game freezing. The existing `#reconnect` pill only covers `Net.reconnecting`
(a dropped line), not a live connection whose host is asleep.

The host still sends positions when the game is paused (`ui.speed = 0`), so a paused host must not
show the waiting pill.

## What to build

### State

- Add `hostAt: 0` to the `net` state object (next to `tick`, `base`, etc.).
- Add a constant near `POS_MS`:

  ```js
  const HOST_WAIT_MS = 1500;   // ms with no word from the host before a guest says it's waiting
  ```

  The host's `pos` comes every 150 ms, so 1.5 s is ten missed words: long enough not to flash on a
  single dropped message or a frame hitch, short enough to explain a freeze quickly.
- Set `net.hostAt = now` in:
  - `heardPos(m, now)` when `m.tick >= 0` (this is the host's own position; guests' positions have
    `tick: -1`);
  - `heardWorld(m, now)` after the host's world lands, so a guest that has just arrived doesn't
    immediately show the pill before the first `pos` (the world itself proves the host was there).
- Reset it to `0` when the host is gone or the guest leaves (`hostGone`, `leaveTogether`) so it
  can't flash on a later session.

### The pill

Add a second element in `index.html`, beside `#reconnect`:

```html
<div id="host-wait" role="status" aria-live="polite">🧺 Waiting for your friend…</div>
```

Reuse the `#reconnect` styling: add `#host-wait` to the same selector (the fixed top-centre pill,
faded in with `.on`, `pointer-events: none`). It should never be visible at the same time as
`#reconnect`: when `Net.reconnecting` is true, hide it.

### Showing it

Compute this in `netCard(now)` (it already runs a few times a second and owns the multiplayer pill
visibility):

```js
const waiting = !!(Net && Net.on && Net.guest && net.tick >= 0 && !Net.reconnecting
  && net.hostAt && now - net.hostAt > HOST_WAIT_MS);
```

Show it only while waiting. The text should name the host if we know it:

- host name known from `peers.get(net.hostId)?.name`:
  `🧺 Waiting for Ana…` (use `textContent`, not `innerHTML`; names are player text);
- otherwise `🧺 Waiting for your friend…`.

Keep a small `hostWait` state object (e.g. `{ on: false, text: '' }`) and only touch the DOM when
`on` or `text` changes. Do **not** show it when `net.tick < 0` (the guest is still walking over;
`startTogether` already toasts that), when not a guest, when the line is reconnecting, or when the
game isn't together.

It should disappear on the next host `pos` (which sets `net.hostAt = now` and makes `waiting` false
at the next `netCard` tick). No toast when it comes back; the pill vanishing is enough.

### Edge cases

- Host pauses the game: positions keep coming, so no pill (correct: the meadow isn't stalled for
  the guest).
- Host closes the tab: `bye` arrives and `hostGone()` runs; the guest becomes solo and the pill
  must hide. The reconnect path (`Net.reconnecting`) already has its own pill; hide this one.
- Guest changes tab and comes back: `Net.recheck()` may run; if the host is back, the pill clears
  on the next `pos`.
- A host that is slow for just one frame must not flash the pill (the 1.5 s threshold).
- Do not add a sound or a world pause; the world already waits by design.

## Docs

Add 3–4 lines to `.claude/docs/tasks-stone-friends.md` in the voice: a guest whose host tab sleeps
sees `Waiting for <name>…` after `HOST_WAIT_MS`, and it clears on the next word.

## Verify

1. A server is already running at http://localhost:8765 for this repo — reuse it; do not kill it. (If gone, start one.)
2. Open `http://localhost:8765/?room=qol3&local&seed=123` in two tabs of one Chrome profile. Wait
   for the guest to join.
3. In the host tab's console, stop only the heartbeat for ~2.5 s:

   ```js
   const send = Net.send;
   Net.send = m => { if (m.t !== 'pos') send(m); };
   setTimeout(() => { Net.send = send; }, 2500);
   ```

   Within ~1.5 s the guest tab should show `🧺 Waiting for <name>…` and the guest's world should
   freeze; after the original `Net.send` is restored, the pill should vanish and the world resume.
4. Set `garden.ui.speed = 0` in the host tab and confirm **no** waiting pill appears (positions
   still arrive).
5. Switch the host tab to the background (if your harness supports visibility changes) and confirm
   the pill appears; bring it back and confirm it clears. If you cannot change visibility, the
   `Net.send` stub above is enough.
6. Check that `#reconnect` and `#host-wait` never show at once (simulate a reconnect by closing
   the host tab and observe the reconnect pill, or reason through the condition).
7. Check console errors, and on a 390 px viewport that the pill fits.

Do not kill the shared server. Report files changed, tests performed, and anything not tested.
