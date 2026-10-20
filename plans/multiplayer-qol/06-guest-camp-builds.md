# QoL 6 — tell guests why camp builds are missing

## Task

In `/Users/axel/Desktop/programming/aeon-garden`, make the make strip explain to a guest in a
friend's meadow why the camp-only builds (basket, seat log) are absent. Today `canMake()` silently
removes them, so a guest with a full satchel sees a shorter strip and no reason.

Read `CLAUDE.md` first, then in `game.js`: `buildUi`, `buildAfter`, `buildMade`, `canMake`,
`makeList`, `buildFocus`, `renderBuild`, `renderMakeStrip`, `openMake`, `makeFrame`; and
`Recipes.BUILDS` / `Recipes.whereOf` in `recipes.js`; and `#make` / `.mk` styles in `index.html`.

## Important working-tree rules

- The tree has uncommitted work by the owner. Do **not** run `git checkout`, `git stash`,
  `git reset`, `git commit`, or reformat. Do not revert unrelated changes.
- Touch only `game.js`, `index.html`, and the docs note.
- No new dependencies. Keep the strip small, parchment and readable on a phone.
- No per-frame DOM writes; the strip is already keyed.

## Current behaviour

```js
const canMake = id => buildAfter(id) && !buildMade(id)
  && !(Recipes.whereOf(Recipes.BUILDS[id]) === 'camp' && Net && Net.guest);
const makeList = () => buildOrder.filter(canMake);
```

`renderMakeStrip()` builds a tile per `makeList()` entry. `renderBuild()` decides whether the
Craft button shows:

```js
const show = list.some(x => buildHave(x).any) || !!ui.place;
```

So a guest may not even see a tile for a camp build they have materials for, and no line explains
it. `Recipes.BUILDS` currently has `basket` and `seat` with `where: 'camp'`; new camp builds must
work automatically.

## What to build

### 1. A helper for what a guest can't make at camp

Near `canMake`:

```js
// Camp builds a guest can't make in a friend's meadow (the keeper's).
const guestCamp = () => !(Net && Net.guest) ? [] : buildOrder.filter(id =>
  Recipes.whereOf(Recipes.BUILDS[id]) === 'camp' && buildAfter(id) && !buildMade(id));
```

Refactor `canMake` to use a small `campOnly`/`guestLocked` predicate if that reads cleanly, but keep
its behaviour identical for non-guests and for builds already made.

`guestCamp()` returns in `buildOrder` order, so the basket comes before the seat; do not sort
alphabetically.

### 2. A quiet footnote in the make strip

In `renderMakeStrip()`, when `guestCamp()` is non-empty, add a line after the tiles and before the
close button:

```html
<p class="mk-note">Only the meadow’s keeper builds at camp: basket, seat log.</p>
```

- Use each build's `name` lowercased, joined with commas and a final `and` for natural prose:
  `basket, seat log`; for three: `basket, seat log and cairn`.
- Escape any names (they come from data, but use `esc` consistently).
- If the host's name is known (`peers.get(net.hostId)?.name`), you may say
  `Only Ana builds at camp: basket, seat log.` instead of "the meadow's keeper". Do **not** put
  player text unescaped into HTML. If the name is empty, use the keeper wording.
- The note should be small and muted, centred, and wrap within the strip:
  `#make .mk-note { margin: 7px 4px 1px; font-size: 12.5px; line-height: 1.35; color: var(--muted); text-align: center; }`
  (adjust to match the surrounding CSS conventions).
- Include `guestCamp()` in the strip's `key` (`stripUi.key`) so the note updates when the camp is
  built/made or the role changes. Keep it cheap: the list is tiny.
- If the tiles list is empty but there are locked camp builds the guest has materials for, the
  note is the whole strip; that's fine and is the point. Make sure the strip's layout still looks
  intentional with an empty `.mk-tiles` (e.g. the note has its own margin; close button remains).

### 3. Make the Craft button show when it has something to explain

Change `renderBuild()`'s `show` to include camp builds the guest has materials for:

```js
const show = list.some(x => buildHave(x).any)
  || guestCamp().some(x => buildHave(x).any)
  || !!ui.place;
```

Do **not** mark those as ready: `ready` stays `list.some(...)`, so the button doesn't glow for
something the guest can't make. The `title` can keep using `buildFocus`/`buildTip`; optionally add a
short `At camp, the meadow’s keeper builds.` to the title when the guest has only locked options,
but keep it simple and don't make the title a paragraph.

### 4. Edge cases

- Host: no note, no change to the strip or the Craft button.
- Guest with all camp builds already made: `guestCamp()` is empty, so no note and no extra button.
- Guest with other builds available: note appears alongside them.
- Guest in a meadow without a camp: `buildAfter('basket')` is false, so no note.
- The build strip is keyed; adding/removing the note must not force a rebuild every frame. It is
  rebuilt only when `stripUi.key` changes, as now.
- Do not change what a guest can actually build. This is explanation only.

## Docs

Add 2–4 lines to `.claude/docs/tasks-stone-friends.md` in the voice: guests see a quiet line in the
Craft strip naming the camp builds the keeper makes.

## Verify

1. A server is already running at http://localhost:8765 for this repo — reuse it; do not kill it. (If gone, start one.)
2. Open `http://localhost:8765/?room=qol6&local&seed=123` in two tabs of one Chrome profile.
3. Get a camp set up in the host's meadow (the fastest way is `?dev` in both URLs: `garden.give`
   can fill the satchel with pebbles, sticks and tinder; build a campfire with F/C, light it, then
   the camp exists). Let the guest join.
4. As the guest, open the Craft strip (C or the button). Confirm:
   - the basket/seat log are not offered as buildable tiles;
   - the note names them and says the keeper builds at camp;
   - the note is readable on a 390 px viewport and doesn't overflow the strip;
   - the Craft button appears if the guest has materials for a locked build, but doesn't glow as
     "ready".
5. As the host, confirm there is no note and the basket/seat log are offered as before (once the
   camp and level allow).
6. Confirm the note updates when the host builds the basket/seat (it should stop listing them) and
   disappears for the host.
7. Check console errors.

Do not kill the shared server. Report files changed, what you tested, and anything not tested.
