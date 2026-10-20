# QoL 4 — unread chat without losing the lines

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, make chat lines that arrive while the chat card
is closed leave a small unread dot on the 💬 button and stay in the log until the card is opened.
Today lines fade after `CHAT_LOG_MS` (12 s) whether or not anyone read them, so a player who is
zoomed in or looking elsewhere misses them entirely.

Read `CLAUDE.md` first, then in `game.js`: the chat constants (`CHAT_MS`, `CHAT_PER`,
`CHAT_LONGEST`, `CHAT_LOG_MS`, `CHAT_KEEP`), `openChat`, `chatLine`, `sayLine`, `heardChat`,
`heardCall`, `netCard`, and the `#chat` markup/CSS in `index.html`.

## Important working-tree rules

- The tree has uncommitted work by the owner. Do **not** run `git checkout`, `git stash`,
  `git reset`, `git commit`, or reformat. Do not revert unrelated changes.
- Touch only `game.js`, `index.html`, and the docs note.
- No new dependencies. Keep the parchment look; the dot must be tiny and consistent with the
  existing green dot on ••• (`.hud-btn.more.friends-on::after`).
- No per-frame work: this is event-driven (a line arrives, the card opens).

## Current behaviour

```js
function chatLine(who, text, me) {
  const log = $('#chat-log'), el = document.createElement('div'), b = document.createElement('b');
  el.className = me ? 'chat-line me' : 'chat-line';
  b.textContent = who + ' ';
  el.append(b, text);
  log.append(el);
  while (log.childElementCount > CHAT_KEEP) log.firstElementChild.remove();
  log.scrollTop = 1e6;
  setTimeout(() => el.classList.add('old'), CHAT_LOG_MS);
}
```

CSS:

```css
#chat:not(.open) .chat-line.old { opacity: 0; }
```

So every line gets `.old` after 12 s and fades while the card is closed. `heardChat()` adds a
bubble over the speaker (`p.chat = chatFor(...)`), calls `chatLine(...)`, and plays `chime('click')`.
`openChat(true)` is refused unless `Net && Net.on`; it scrolls the log to the bottom. `#chat-btn`
is shown/hidden by `netCard`.

## What to build

### 1. Mark received lines as held while the card is closed

Change `chatLine(who, text, me)` so that a line from someone else, arriving while the chat card is
**closed** and the game is together, is marked as held and not scheduled to fade yet:

```js
const held = !me && !chatOpen() && !!(Net && Net.on);
if (held) el.classList.add('held');
else setTimeout(() => el.classList.add('old'), CHAT_LOG_MS);
```

Notes:

- Own lines (`sayLine`) are `me === true` and behave as now.
- Lines from the old stone (`chatLine(Stone.NAME, text, false)` around line 5928) are single-player;
  the `Net && Net.on` check keeps them out of this.
- A message that arrives while the card is open is read immediately and fades normally after
  closing, as today.
- Keep the `CHAT_KEEP` cap; 40 held lines is the most that can accumulate.
- Held lines need no new CSS: they simply never get `.old`, so they stay visible when the card is
  closed. (They still look like ordinary chat lines over the meadow; that is intended.)

### 2. The unread dot

- Add a state object near the chat code, e.g. `const chatUi = { unread: 0 };`
- When a held line arrives, increment `chatUi.unread` and show the dot.
- Add a small function:

  ```js
  function chatNew(on) {
    const b = $('#chat-btn');
    if (!b) return;
    b.classList.toggle('has-new', !!on);
    b.title = on ? 'New messages · Say something to your friends (Enter)' : 'Say something to your friends (Enter)';
  }
  ```

- CSS, next to the friends dot:

  ```css
  #chat-btn { position: relative; }
  #chat-btn.has-new::after { content: ''; position: absolute; top: 5px; right: 5px; width: 7px; height: 7px;
    border-radius: 50%; background: #5c9a3c; box-shadow: 0 0 0 1.5px var(--card); }
  ```

  Do not use `--accent` red; this is a friendly "there is something to read" dot, like the friends
  dot.

### 3. Reading clears it

In `openChat(true)`, after the panel is shown:

- find every `.held` line in `#chat-log`;
- remove `.held` and schedule `.old` after `CHAT_LOG_MS` so it will fade if the card is closed
  again and the line is no longer new;
- reset `chatUi.unread = 0` and call `chatNew(false)`.

Because `openChat(true)` is called only when together, no special case is needed.

Also clear the dot and the held flags when the multiplayer session ends (`netCard`'s `!on` branch):
`chatUi.unread = 0; chatNew(false);` and remove `.held` from the log. Do not necessarily delete the
log lines; they are already hidden when `#chat` is hidden. (If you choose to clear the log when
leaving a session, that is acceptable but keep it a separate, obvious one-liner.)

### 4. Edge cases

- A line received while the card is open, then the card is closed: no dot, fades after 12 s (as
  before). That is a line the player had on screen.
- A line received while the tab is hidden but the card is open: it is treated as read. Keep this
  simple; do not try to detect visibility here.
- Scrolling: held lines remain in the log, and `openChat` scrolls to the bottom, so the newest is
  visible. The cap removes the oldest lines first.
- The dot must not break the 44 px touch target or the pill layout. It is 7 px inside the button.
- Do not add a second indicator elsewhere; the dot and the title are enough.

## Docs

Add 3–4 lines to `.claude/docs/tasks-stone-friends.md` in the voice: chat lines that arrive while
the card is shut wait in the log and put a dot on 💬 until it is opened.

## Verify

1. A server is already running at http://localhost:8765 for this repo — reuse it; do not kill it. (If gone, start one.)
2. Open `http://localhost:8765/?room=qol4&local&seed=123` in two tabs of one Chrome profile; let
   the second join.
3. As the host, send a chat line with Enter. In the guest tab (chat closed), confirm the 💬 button
   shows the green dot and the console has no errors.
4. Wait more than 12 s, then open the guest's chat: the line must still be there, the dot must be
   gone. Close and wait 13 s: it should now fade like an old line.
5. Send another line while the guest's chat is open: no dot, the line appears immediately. Close
   and confirm it fades after 12 s.
6. Send two lines, open, read, close, send a third: the dot returns; opening shows all three (the
   first two may be faded/removed only by the normal rules).
7. Send a line as the guest too, and check the host's own line does not set a dot on the sender.
8. Simulate the session ending (Leave, or close the host tab): the dot clears and no errors occur.
9. Check a phone-width layout (390 px) that the dot sits inside the button and the title change
   doesn't shift the pill.

Do not kill the shared server. Report files changed, what you tested, and anything not tested.
