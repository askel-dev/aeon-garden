# QoL 1 — an "In the meadow" card on the 🧺 pill

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, implement one quality-of-life change in the
multiplayer UI: make the 🧺 pill (`#friends-btn`) open a small card about the meadow you're in,
instead of immediately re-sharing the link. The card shows who is here, who is hosting, and lets
you share the link again or leave.

Read `CLAUDE.md` first (the UI taste notes and the perf rules), then the multiplayer section of
`game.js` (search for `playing together`, `netCard`, `together`, `startTogether`, `leaveTogether`)
and the friends card in `index.html` / `game.js` (`openFriends`, `renderFriends`, `#friends`).

## Important working-tree rules

- The tree already has uncommitted work by the owner, including edits to `game.js`, `index.html`,
  `sim.js` and `sound.js`. Do **not** run `git checkout`, `git stash`, `git reset`, `git commit`,
  or reformat files. Do not revert anything you did not write.
- Touch only what this change needs (expected: `game.js`, `index.html`, the docs note).
- No new dependencies, no build step, no framework.
- Keep the game's UI small, parchment and close to the action. No `backdrop-filter`, no big modal,
  no permanent HUD. Phone targets are at least 44 px.
- Avoid per-frame DOM writes: render this card only when opened or when its content changes.

## Current behaviour (around these functions)

- `netCard(now)` in `game.js` runs a few times a second. It hides/shows `#friends-btn` and sets
  `b.textContent = '🧺 ' + n`; the names live only in `b.title` (a hover tooltip, useless on a
  phone).
- `#friends-btn` in `index.html` has `data-act="together"`, so tapping it calls `together()`,
  which opens a room if needed and immediately opens the share sheet/clipboard.
- `together(dressed)` also asks for a name/outfit before hosting, calls `openRoom()`, then shares
  `location.href`.
- `copyLink()` shares the meadow link (`location.href`).
- `leaveTogether()` leaves a friend's meadow or closes yours. It will be touched by a later task;
  call it, don't rewrite its confirmation logic.
- `opened()` and `stepOut()` (near the Back section) list every card/menu that Back and Esc close.
- `friendsOpen()` and `openFriends()` manage the friends card; `#friends` is the card style to
  follow.

## What to build

### 1. The card

Add a small dialog to `index.html`, after `#friends` and before `#friend-ask`:

```html
<div id="meadow-card" class="hidden" role="dialog" aria-labelledby="meadow-title">
  <h2 class="fr" id="meadow-title">In the meadow</h2>
  <p id="meadow-where"></p>
  <ul id="meadow-list"></ul>
  <p id="meadow-note"></p>
  <div class="btns">
    <button type="button" class="btn" data-act="meadow-share">Share the link</button>
    <button type="button" class="btn later" data-act="meadow-done">Done</button>
    <button type="button" class="btn later" data-act="meadow-leave" id="meadow-leave">Leave</button>
  </div>
</div>
```

Style it like `#friends` (same parchment card, radius, shadow, width `min(400px, calc(100% - 32px))`,
centred; on `(pointer: coarse)` it goes under the top pill as `#friends` does, with 44 px buttons).
Do not duplicate the whole rule block if a shared selector is clean: add `#meadow-card` alongside
`#friends` where it makes sense, but keep it readable.

Rows: reuse the feel of `.fr-row`, but this is not the friends list, so give them their own light
classes if that's cleaner. A row has:

- a round parchment disc on the left, with 🧺 for the host and 🌿 for a guest (a `<span>` in the
  disc; `.fr-pic` can be reused with `display:grid; place-items:center` for this card);
- the name in `<b>`: `myName` for yourself, the friend's name from its peer, else `a friend`;
- a muted sub-line: `host` / `guest`, plus `you` for yourself (e.g. `host · you`).

Order: the host first, then the other players (the host's `peers` iteration order, which is join
order), with yourself in the right place. For a guest, `net.hostId` identifies the host and
`peers.get(net.hostId)` has the host's name once its first position arrives; use `your friend` as a
fallback. A guest can see the other guests too (the host relays positions), so list them.

Copy, in the game's voice:

- Host, alone: `#meadow-where` = `Your meadow is open to friends.`
  `#meadow-note` = `Waiting for a friend to come. Send them the link.`
- Host, with others: `#meadow-where` = `Your meadow, with friends in it.` and
  `#meadow-note` = `3 foraging here.` (singular: `1 friend here.`)
- Guest: `#meadow-where` = `You’re in {host’s} meadow.` (fallback: `You’re in your friend’s meadow.`)
  `#meadow-note` = `The meadow runs on {host’s} clock.` If there are other guests, append
  ` 4 foraging here.` (not on a second line; keep it one sentence, e.g.
  `The meadow runs on Ana’s clock. 4 foraging here.`)
- Escape all names (`esc`), since they are player text. Do not put unescaped names into HTML.
- The pill's tooltip can stay the count/names, but update it to say what a click does, e.g.
  `Who’s here, and the link to share`.

The leave button's label: host → `Close the meadow`, guest → `Leave`. It calls `leaveTogether()`.
If `leaveTogether()` is cancelled (the confirm says no), the card must stay open; if the leave
happens, close the card. The cleanest is to close it at the end of a successful `leaveTogether()`
(one line, later task keeps it), or after calling it check `if (!(Net && Net.on)) openMeadow(false)`.

### 2. Wiring

- Change the pill's `data-act` from `together` to a new `meadow` action.
- In `openMeadow(open)`:
  - refuse to open unless `Net && Net.on`;
  - toggle `.hidden`;
  - when opening, close the friends card and the more menu (so two cards don't overlap), render it,
    and do not steal focus (there is no text field);
  - when closing, nothing special.
- When opening the friends card, close this card (`openFriends(true)` should call
  `openMeadow(false)`).
- In the global `data-act` switch:
  - `meadow` → `openMeadow(true)`;
  - `meadow-share` → share the current room link;
  - `meadow-done` → `openMeadow(false)`;
  - `meadow-leave` → `leaveTogether()`.
- Keep the ••• menu item `data-act="together"` ("Play together with a friend") working. If
  `Net && Net.on`, that item should open the meadow card instead of re-sharing immediately (the
  card has the share button). If not together, it keeps calling `together()`.
- Add `meadowOpen()` to `opened()` (so Back counts it) and a case in `stepOut()` that closes it,
  near `friendsOpen()`.
- `netCard()`: when the room is left or lost (`!on`), close the card. While the card is open,
  call a `renderMeadow()` that rewrites only when its content key changes (peers joining/leaving,
  names changing, host/guest role changing, `myName` changing). Keep it cheap; this runs a few
  times a second only while the card is open.
- The pill's count and names can remain as they are.

### 3. Sharing

Add `shareMeadowLink()`:

```js
function shareMeadowLink() {
  const url = location.href;
  if (canShare) {
    navigator.share({ title: "Nobody's Meadow", text: 'Come and forage with me.', url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url).then(
    () => toast('🧺 Link copied. Whoever opens it comes into this meadow with you.'),
    () => toast(`🧺 Send a friend this link: ${esc(url)}`));
}
```

Use it from both the card's Share button and `together()` (replace the duplicated share code in
`together()`), so the wording stays in one place. Sharing must use the current `location.href`,
which includes the room, not `meadowLink`.

### 4. Edge cases

- Host alone in a room: the card still opens, shows the share link, and its leave button closes the
  room (after the normal confirmation, if any).
- Guest: never offer to start a new meadow here, just Share/Leave.
- `Net.on` false while the card is open (host lost, leave, network): close it and clear its state
  so the next open shows fresh content.
- Re-rendering must not rebuild the card every 250 ms; keep a content key.
- The card must sit above the game but below a friend's ask (`#friend-ask` has z-index 11); use
  z-index 10, like `#friends`.

## Docs

Add a short note (3–5 lines) to `.claude/docs/tasks-stone-friends.md` in the existing voice,
describing the card: what the 🧺 pill opens, what it lists, and that the leave/share actions live
there. Update the comment above `netCard`/the new functions.

## Verify

1. An HTTP server for this repo is already running at http://localhost:8765 — reuse it; do not kill it. (If it is gone, `python3 -m http.server 8765` in the repo.)
2. Open `http://localhost:8765/?room=qol1&local&seed=123` in two tabs of the same Chrome profile.
   With `?local` they use BroadcastChannel: the first becomes host, the second a guest.
   Give at least one of them a name (••• › Change your name) to check names and escaping.
3. As host: tap 🧺 → card opens, shows `Your meadow…`, one row for you (host), and the guest row
   after they join. Check the pill no longer fires the share sheet. Check Back/Esc/Done close it.
4. As guest: tap 🧺 → card shows the host first, then you; `You’re in …’s meadow.` and the clock
   line. Join/leave a third tab and confirm the list updates without reopening.
5. Share: on a desktop profile the clipboard path should toast `Link copied…`; verify the copied
   URL is the room URL. (If clipboard is blocked in the harness, at least verify no exception and
   that the fallback toast appears.)
6. Leave from the card: the confirm appears, then the card closes; cancelling keeps it open.
7. Check the console for errors. On a narrow window (`--window-size=390,844` or device emulation)
   check the card fits and buttons are 44 px.

Do not kill the shared server. Report files changed, the diff summary, what you tested, and what you
could not test.
