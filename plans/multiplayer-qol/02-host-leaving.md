# QoL 2 — don't split the party silently when the host leaves

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, change the host's "Leave" in a multiplayer meadow
so it warns when friends are actually there, and explains what happens to them. A guest already
gets a confirmation; the host does not.

Read `CLAUDE.md` first, then the multiplayer section of `game.js`: `leaveTogether()`,
`hostGone()`, `startTogether()`, and the comments above them. Also look at `netCard()` and the
••• `leave` menu item (`#leave-item`).

## Important working-tree rules

- The tree has uncommitted work by the owner. Do **not** run `git checkout`, `git stash`,
  `git reset`, `git commit`, or reformat. Do not revert unrelated changes.
- Touch only `game.js` (and a short docs note). Do not restructure the leave flow.
- No new dependencies. Keep the game's voice and comment style.
- A later task adds an "In the meadow" card whose Leave button calls `leaveTogether()`; keep the
  function's confirmation semantics intact so the card works with it.

## Current behaviour

```js
function leaveTogether() {
  if (!(Net && Net.on)) return;
  const guest = Net.guest;
  if (guest && !confirm('Leave your friend’s meadow and go home to your own?')) return;
  leftGuest = guest;
  Net.leave();
  ROOM = '';
  if (guest) { dropAwayBag(); location.replace(location.pathname); return; }
  peers.clear(); openChat(false);
  history.replaceState(history.state, '', pageLink(world.seed));
  friendsBeat();
  toast('🧺 Your meadow is your own again.');
}
```

A host leaving closes the room. Each guest receives `bye`, calls `hostGone()`, and keeps its own
copy of the meadow. With two or more guests, the party silently becomes separate meadows, and the
host never saw a warning. The host's peers are `peers.size` (the guests; the host's own forager is
not in `peers`).

## What to build

1. Before a host leaves, if `peers.size > 0`, show a `confirm()` that names the consequence:

   - one guest:
     `Close your meadow to your friend? They’ll keep their own copy, and you won’t be together any more.`
   - several:
     `Close your meadow to the ${n} friends here? Each keeps their own copy, and you won’t be together any more.`

   Use the typographic apostrophes the game uses (`friend’s`, `won’t`, `They’ll`). If the host
   cancels, nothing changes. If the host accepts, the existing flow runs untouched.
2. If there are no guests, the host leaves without a confirmation, as today (the meadow just
   becomes private again).
3. Leave the guest's confirmation exactly as it is.
4. Update the comments above `leaveTogether()` and anywhere the old behaviour is described (search
   for "keep the meadow", "This meadow is yours to keep", and the ••• Leave comment).
5. Keep the `hostGone()` toast accurate. It currently says:
   `🧺 ${who} has gone home. This meadow is yours to keep now.`
   If you can add one short, useful sentence without turning it into a paragraph, say that the
   meadow is now each guest's own; otherwise leave it alone. Do not add UI.
6. Do not implement host hand-off / migration in this task. That is a separate, riskier design; the
   goal here is an honest warning.

## Where the warning sits

Follow the existing use of `confirm()` in `game.js` (for example the guest's leave, starting a new
meadow, removing a friend). Do not build a custom dialog for this.

## Docs

Add 2–3 lines to `.claude/docs/tasks-stone-friends.md` in the existing voice: a host leaving with
friends in the meadow now warns that everyone keeps a copy and the party separates.

## Verify

1. A server is already running at http://localhost:8765 for this repo — reuse it; do not kill it. (If gone, start one.)
2. Open `http://localhost:8765/?room=qol2&local&seed=123` in two tabs (same Chrome profile). Let
   the second tab join as a guest; confirm the host's pill shows `🧺 2`.
3. In the host tab:
   - Stub `window.confirm = () => false` via the DevTools console, click ••• › Leave, and check
     that the meadow is still together (`Net.on === true`, pill still visible, guest still there).
   - Stub `window.confirm = () => true`, click Leave, and check the host's room closes
     (`Net.on === false`, pill hidden) and the guest receives the `hostGone()` toast and keeps the
     meadow.
   - With no guest (single tab), confirm Leave still closes the room without a prompt.
4. Verify the confirm text is correct in both singular and plural cases (inspect the string or add
   a third tab).
5. Check the console for errors. Do not kill the shared server.

Report files changed, what you tested, and anything not tested.
