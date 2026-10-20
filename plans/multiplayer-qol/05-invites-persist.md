# QoL 5 — a friend's ask stays until answered

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, stop friend invitations from evaporating. Today
`askOver()` hides the ask card after `FR_ASK_MS` (45 s), and `friends.js` deletes the invite row the
moment it is heard, so an ask that came while the player was looking at the meadow is gone forever.
Make asks wait until the player answers or dismisses them, queue several asks instead of
overwriting, and keep an unanswered invite in Supabase long enough that a reload within the
existing 10-minute freshness window brings it back.

Read `CLAUDE.md`, then `friends.js` (`heard`, `heardInvites`, `listen`, `Friends.invite/knock`),
the friends section of `game.js` (`FR_ASK_MS`, `fr`, `askedOver`, `friendInvited`, `askOver`,
`friendAsk`, `openFriends`, `stepOut`), and the invites policy/comments in
`supabase/friends.sql`.

## Important working-tree rules

- The tree has uncommitted work by the owner. Do **not** run `git checkout`, `git stash`,
  `git reset`, `git commit`, or reformat. Do not revert unrelated changes.
- Expected files: `game.js`, `friends.js`, `supabase/friends.sql` (comment only), and the docs note.
- No new dependencies. Keep the API comments at the top of `friends.js` accurate.
- Keep the small parchment ask card; no new modal and no notification system.
- Phone layout: `#friend-ask` already moves under the top pill on touch screens; don't break it.

## Current behaviour

`friends.js`:

```js
function heard(row) {
  if (told.has(row.id)) return;
  told.add(row.id);
  db.from('invites').delete().eq('id', row.id).then(() => {});
  if (Date.now() - Date.parse(row.created_at) > INVITE_FRESH) return;
  h.invited({ from: row.from_id, kind: row.kind, room: row.room });
}
```

The row is deleted before the freshness check; `game.js` then shows a single ask:

```js
const FR_ASK_MS = 45000;                   // a friend's ask waits up top this long
const fr = { shown: '', first: true, states: new Map(), ask: null, askTimer: 0, ... };
function askOver(text, yes, go) {
  fr.ask = go;
  $('#fa-text').innerHTML = text;
  $('#fa-yes').textContent = yes;
  $('#friend-ask').classList.remove('hidden');
  clearTimeout(fr.askTimer); fr.askTimer = setTimeout(() => friendAsk(false), FR_ASK_MS);
}
function friendAsk(yes) {
  const go = fr.ask;
  fr.ask = null; clearTimeout(fr.askTimer);
  $('#friend-ask').classList.add('hidden');
  if (yes && go) go();
}
```

`friendInvited({ from, kind, room })` calls `askOver(...)` for an invite or a knock.

## What to build

### 1. Keep the invite until it is answered

In `friends.js`:

- Change `heard(row)` so a **fresh** invite is announced and left in the table, not deleted:
  pass its `id` to the handler:

  ```js
  h.invited({ from: row.from_id, kind: row.kind, room: row.room, id: row.id });
  ```

- A **stale** invite (older than `INVITE_FRESH`) is deleted and not announced (same outcome as
  today).
- Add an API to clear one after the player answers or dismisses it:

  ```js
  // An invite answered (or waved away): gone for good.
  Friends.done = id => {
    if (!id) return;
    db.from('invites').delete().eq('id', id).then(() => {}, () => {});
  };
  ```

- Add `Friends.done(id)` to the API comment at the top of `friends.js`.
- `told` still dedupes the Realtime delivery and the catch-up read within a session. A reload
  within the freshness window re-announces an unanswered invite, which is the desired recovery.
- Update the comment in `supabase/friends.sql` that says invites are "Gone once read" to say they
  are gone once answered or when stale (schema unchanged; only the comment). The delete policy
  already allows the recipient to delete their own invite.

### 2. A queue of asks in `game.js`

Replace the single `fr.ask` / `fr.askTimer` with a queue:

```js
const fr = { shown: '', first: true, states: new Map(), asks: [], knocked: new Map(), failed: '' };
```

- `askOver(text, yes, go, id)` pushes `{ text, yes, go, id }` and shows the first one if the card
  is hidden. Keep the signature readable; passing `id` last is fine.
- `friendInvited({ from, kind, room, id })` passes `id` through to `askOver` for both kinds.
- `showAsk()` writes `#fa-text` (still `innerHTML`, because the game puts `<b>`? — check; it uses
  `esc` names and plain text today, so keep the existing call sites and escaping) and `#fa-yes`,
  toggles `#friend-ask`.
- `friendAsk(yes)` takes the first ask, hides the card, calls `friends.js` `done(id)` for it
  (before `go()` so a navigation still clears it), then runs `go()` if yes. Then shows the next ask
  if any, else leaves the card hidden.
- Dismissing with "Not now" or Esc/Back calls `friends.js` `done(id)` too, so it doesn't come back
  on the next beat/reload. (It was already heard; the row is now cleared.)
- Remove `FR_ASK_MS`, `fr.ask`, `fr.askTimer`, and the timeout. Update the comment above the
  friends section and anywhere it says the ask waits 45 s.
- Cap the queue at 4 to avoid a pile-up; if a fifth arrives while four are waiting, drop the
  newest silently (or the oldest — pick one and comment why). In practice four is more than enough.
- `askedOver()` stays `!$('#friend-ask').classList.contains('hidden')`, so `stepOut()` still
  dismisses the visible ask. Ensure `friendAsk(false)` now dismisses only the head of the queue and
  shows the next.
- If a "Let them in" ask opens the wardrobe and there is another queued ask, it is acceptable for
  the next ask to remain hidden while the wardrobe is open; when the wardrobe closes, the queue
  should not be stuck. The simplest robust approach is to show the next ask immediately; the
  wardrobe and ask card can coexist (the ask is z-index 11). Do not add new orchestration unless
  needed.
- Do not add a dot or badge; the visible card is the indicator now that it persists.

### 3. Clean-up paths

- If the friends connection fails or the page leaves the meadow, queued asks should still be
  answerable (they are independent of the room). Do not clear the queue on a beat.
- If the same invite is somehow delivered twice, `told` prevents it in the session; the queue
  shouldn't double-add. `done(id)` is idempotent.

## Docs

Add 3–5 lines to `.claude/docs/tasks-stone-friends.md` in the voice: an ask stays up until
answered; a reload within 10 minutes brings an unanswered one back; several queue. Update the
comments in `friends.js` and `supabase/friends.sql`.

## Verify

A full friends test needs Supabase. At minimum:

1. `python3 -m http.server 8765` and load the game; check the console for errors. `node --check
   friends.js` and `node --check game.js` (game.js is a classic script, so this only checks syntax).
2. Verify the ask queue logic without the network if you can: the functions are module-scoped, so
   either drive it through a real invite, or temporarily instrument in the DevTools console by
   calling the click handler after inserting a fake ask? Do **not** leave debug code in. If you
   cannot drive it, state clearly that the queue was reviewed but not exercised.
3. If Supabase test accounts are available (`?as=a` / `?as=b` with two tabs and two friend
   sessions), do the full check: A invites B; B's ask card stays up past 45 s; B reloads within
   10 minutes and still sees the ask; B dismisses; A's invite is gone on the next catch-up; two
   invites from different friends queue rather than replace each other.
4. Check the invite row counts before/after with the SQL editor only if you have access; do not
   modify production data beyond test invites to your own accounts.

Do not kill the shared server. Report exactly what was tested and what was only reviewed.
