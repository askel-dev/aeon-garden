# Multiplayer QoL — prompts and status

Six small quality-of-life changes for playing together, written as self-contained task prompts and
implemented one by one (2026-10-20).

| # | Prompt | What it does | Status |
|---|--------|--------------|--------|
| 1 | `01-meadow-card.md` | The 🧺 pill opens an “In the meadow” card: who is here, host/guest, Share link, Leave. | done |
| 2 | `02-host-leaving.md` | A host leaving with friends present is warned that everyone keeps a copy. | done |
| 3 | `03-waiting-for-host.md` | Guests see “Waiting for <name>…” when the host’s tab stops sending positions. | done |
| 4 | `04-unread-chat.md` | Lines that arrive while chat is shut are held, with a green dot on 💬 until read. | done |
| 5 | `05-invites-persist.md` | A friend’s ask stays until answered, queues several, and survives a reload within 10 min. | done |
| 6 | `06-guest-camp-builds.md` | Guests’ Craft strip names the camp builds only the keeper can make. | done |

## Files touched

- `game.js` — all six.
- `index.html` — the meadow card, the waiting pill, the chat dot, the make-strip note.
- `friends.js` — invites left in the table until `Friends.done(id)`; stale ones still cleaned.
- `supabase/friends.sql` — comment only (invites are answered-or-stale, not gone-on-read).
- `.claude/docs/tasks-stone-friends.md` — notes for each change.
- `sw.js` — `VERSION` 5 → 6.

## Verification

Each agent ran its own two-tab `?room=…&local` checks. The combined final state was re-checked over
CDP with two tabs: meadow card rows/copy, guest card, waiting pill show/clear, unread chat hold and
dot, host-leave cancel/accept, and no console errors.

Not exercised end-to-end: real PeerJS rooms (only BroadcastChannel `?local`), a real two-account
Supabase invite exchange (queue and `friends.js` paths were tested with stubs), real mobile Safari.
