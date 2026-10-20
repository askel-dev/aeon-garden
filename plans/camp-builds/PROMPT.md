# Session prompt — camp builds: the seat log, the drying rack, the lean-to

Implement step 4 of stage 7 in Nobody's Meadow (PLAN.md: "After that a new build is data plus a painting"). This is the
last step of the make button's work: three builds that go **inside the camp's ring**, each a block of `BUILDS` in
`recipes.js`, a painter shared by the make strip's tile and the thing in the meadow, and the small amount of code that
makes it do its one thing. It is not a new build system: the make button, the strip, `where`, `after`, `BUILD_ART`, the
generic set-down kneel and the camp's stores are already in the tree and are meant to carry this.

Read, in this order, before writing anything:

1. `CLAUDE.md` — the rules, above all "Keep it smooth" and "Paint once, copy after". They are law.
2. `PLAN.md` — "Stage 7: making things (one make button), and torches", especially "Building it" 4 and "The make button
   and strip built"; then "After that" 3 (camp builds) and 8 (winter).
3. `.claude/docs/fire-camp.md` — the campfire, make strip, basket and larder-card notes; they are
   the conventions the new builds should join.
4. the sim.js part of the same file — the camp and store notes.
5. The code, in this order: `recipes.js` `BUILDS` (and `checkRecipes`'s `BUILDS` loop), `sim.js`'s camp and store blocks
   (`inCamp`, `basketSpot`/`basketOf`/`makeBasket`, `worldStores`, `storesAt`, `stackOf`, `LATER`, `unpackWorld`'s camp
   branch), then `game.js`'s `buildHave`/`spendBuild`, `buildMade`/`makeList`/`buildFocus`, `renderBuild`, `BUILD_ART`,
   `renderMakeStrip`, `startBuild`, `placeBasket`/`placeTorch`/`placeAt`/`placeHere`, `goFire`/`fireFrame`/`fireStage`/
   `kneelNow`, the basket/larder block (`myBasket` … `basketNet`), `sitFrame`, `PAINTERS`, and the item list in the
   frame (`render`: the `world.torches` / `myBasket` entries and the long draw dispatch).

Anchors below (function names, line numbers) may drift: search for the name. If the code has genuinely changed shape,
adapt minimally and note the deviation.

## The three builds

All three are `where: 'camp'`, `after: 'camp'`, one of each (like the basket), and are paid for out of the stores to
hand — the satchel, the basket, and (once it exists) the new rack. Costs are data; Axel may retune them, but **do not
add new ingredients** in this session. Use what lies about already.

| id    | name        | needs                                   | what it does once placed |
|-------|-------------|-----------------------------------------|--------------------------|
| `seat`| Seat log    | `stick: 5`                              | A log to sit on by the fire. Standing still by it, the forager sits (the existing kneel-warm pose) facing the campfire; walking away stands it up. |
| `rack`| Drying rack | `stick: 8, drygrass: 3, birchbark: 1`   | A second camp store, for food: 12 slots, and each slot holds twice what a basket slot does (`kept: 2`) because what dries takes less room. It opens the basket's card, on the rack. |
| `lean`| Lean-to     | `stick: 10, drygrass: 5, birchbark: 2`  | Shelter: standing under it counts as sheltered in `bodyTick` (no rain or snow soak, less wind chill), and it becomes the forager's home, so a collapse wakes it under the roof. |

Put them in `BUILDS` after `torch`, in that order, so the strip's tiles read campfire, basket, torch, seat, rack, lean.
Each gets a one-line `text` for its hover/look, in the voice of the existing blocks ("A felled log...").

Palettes and rough sizes (the painters decide the rest; these are a starting point, not a spec):

- **Seat log** — 1.8–2 tiles wide. A felled log lying across the clearing, one side split flat for a seat, cut rings at
  the ends, bark furrowed and a little moss on the shaded side, two short round supports or stones under it, a soft
  shadow and a few chips of bark on the ground. Foot at about `0.52`; the flat top is what the forager sits against.
- **Drying rack** — 1.7–1.9 tiles wide. Four forked sticks pushed into the ground, two long crossbars, a mat of dry
  grass lashed across them, a strip or two of birch bark at the back as a little roof. Two looks: `rack:0` empty, and
  `rack:1` with food laid on the slats (a few mushroom caps, apple or root slices, a string of berries) chosen once the
  store holds anything, as the basket's shut/open looks are. Foot at about `0.6`.
- **Lean-to** — 2.2–2.5 tiles wide. A sloping roof of poles, thatch and birch-bark shingles leaning against the wind,
  a bed of dry grass and leaves under it, a couple of stones at the foot of the poles. Paint it with its mouth opening
  to the left; in the meadow it is mirrored when it stands to the right of the campfire, so it always opens toward the
  fire. Foot at about `0.68`.

## What to change, file by file

### `recipes.js`

- Add the three `BUILDS` blocks. No other fields: `name`, `needs`, `where: 'camp'`, `after: 'camp'`, `text`. The existing
  `checkRecipes` already checks the words, the whole-number costs, `where` and `after`; make sure it prints no new
  problems. `BUILD_KEYS` stays as it is.
- Nothing else in this file. The costs are meant to be readable and retunable by hand.

### `sim.js` — the things themselves and what they do

The camp is `w.camp`, in `LATER`, so new fields on it need no `KEEP_VERSION` bump: `campAt` makes them, and
`unpackWorld` gives an old kept camp `null` for each (as it does `basket`). No random numbers.

1. **One shared camp spot.** Write `campSpot(w, x, y, id)` (or three thin wrappers over it) that says `''` if `id` may
   go at `x, y`, else why not, in the basket's voice: not at camp / "Inside the camp", water, too near a fire, a rock,
   a trunk, brambles, a burrow, the basket, a torch, another camp build, and the forager's own kneel room is checked
   later by `standAt`. Use the basket's existing gaps and checks (`basketSpot` is the model; it may call the shared
   helper with its own gap, but its messages must not change). Keep the builds non-solid: they are scenery you can walk
   through, like the basket.
2. **The objects.**
   - `seatOf(x, y, made)`, `rackOf(x, y, made)`, `leanOf(x, y, made)` — one layout for life, with `x`, `y`, `made`, and
     the flag (`seat: true`, `rack: true`, `lean: true`). The rack also has `kept: RACK_KEEP` and its `bag`/`bagN` rows
     (`RACK_SLOTS`).
   - `makeSeat` / `makeRack` / `makeLean` (or one `makeCampBuild(w, id, x, y)` that dispatches) sets
     `w.camp[id]`, emits an event (the basket's `{ type: 'basket' }` is the model), and returns it. It does **not**
     spend anything: `game.js` spends, as it does for the basket. Each refuses if it is already there or the spot is
     not allowed.
   - `campAt`'s literal gains `seat: null, rack: null, lean: null`; `unpackWorld`'s `if (w.camp && !w.camp.basket)` branch
     gains the same three defaults and `asFractions` for the built ones' `x`/`y`.
3. **The rack as a store.** Add it to `worldStores` (after the basket), and give it 12 slots. For the keep rule, make
   `stackOf(id, S)` use the store's `kept` multiplicatively for every kind:
   `(keepFn(id) || stackFn(id)) * (S.kept || 1)`. The basket's `kept: 1` keeps its behaviour exactly. Setting the rack's
   `kept` to 2 means dried things take half the room. Test `storeRoom`, `storePut`, `storeTake`, `tidyStore` and the
   basket's card after the change.
4. **The lean's shelter.** `underLean(w, x, y)` (an ellipse like `inCamp`, a little wider than the painting) and one
   branch in `bodyTick`:
   `const shelter = w.camp && w.camp.lean && underLean(w, f.x, f.y) ? 1 : clamp(w.wood[i] / SHELTER_WOOD, 0, 1);`
   (or `Math.max` of the two). Building it also moves the forager's home under it: set `f.homeX`/`f.homeY` in
   `makeLean` if that spot is walkable. No new field on the forager.
5. **The seat's sit** is game.js-only (see below); the sim just holds the log and allows the spot.
6. Export what `game.js` needs (`campSpot`, the three makers, `RACK_SLOTS`, `underLean` if useful) in sim.js's export
   block, beside `basketSpot`/`makeBasket`.

### `game.js` — the make strip, placing it, and using it

**Data and the strip**

- Nothing to add to `BUILD_ART` but the three painters (below); the strip, the tile chips, the focus and the ring
  already read `BUILDS` and `BUILD_ART`.
- `buildMade` gains the three: `seat`, `rack`, `lean` are made when `world.camp[id]` exists. Keep the basket's rule.
- `canMake`: a guest still can't make the basket; extend the same rule to every `where: 'camp'` build
  (`Recipes.whereOf(Recipes.BUILDS[id]) === 'camp' && Net && Net.guest`), so a guest can't rearrange a friend's camp.
- `startBuild`'s whitelist (`id !== 'campfire' && id !== 'basket' && id !== TORCH_BUILD`) gets the three, and its
  dispatch goes to `placeSeat()` / `placeRack()` / `placeLean()`. The camp-ring check above it already says "It goes at
  camp, by the fire" when the forager is outside the ring; leave that.

**Picking a spot**

- One `placeCampBuild(id)` helper (or three small `placeSeat`/`placeRack`/`placeLean` wrappers, matching `placeBasket`)
  sets `ui.place = { x, y, ok: false, why: '', ghost: true, build: id, seat/rack/lean: true }`, calls `placeAt` in front
  of the forager, chimes `'click'`, and `renderBuild()`s.
- `placeAt`'s reason dispatch gains the three (`S.seatSpot`/`S.rackSpot`/`S.leanSpot`, or `S.campSpot(world, x, y, id)`).
  It must not fall through to `fireSpot`.
- `placeHere` dispatches `goFire`'s kind for the three.
- The faint picture while placing is drawn by each build's own draw function (as `drawTorch`/`drawBasket` do with
  `T.ghost`/`B.ghost`): alpha 0.6 where it can go, 0.3 where it can't. Add the three flags to the frame's draw
  dispatch near `it.s.torch ? drawTorch …`, before the final `drawShroom` fallthrough.

**Setting it down (the generic kneel)**

- `fireFrame`'s `'go'` branch: a new branch for the three kinds. It checks the spot, `spendBuild(id)`, calls the sim's
  maker, sends the build to friends, and goes to the existing `'set'` stage. On a failure, the existing "say the why,
  clear `ui.fire`, `renderBuild`" pattern.
- `'set'` already kneels (`kneelNow`: `KNEEL.lay` then `KNEEL.rest`, `TORCH_SET_MS` 900 ms). Let the same 900 ms cover
  these; at its end a torch still goes to `'strike'`, while a camp build clears `ui.fire`, `renderBuild`s and shows a
  `firstTime('build:' + id, 'you made', …)` in the basket's style. Rename nothing unless it reads better; if you do,
  keep the torch's timing.
- Friends: `sendFire` already sends `{ t: 'fire', a, x, y, n, tn, tick }`. Use the build id as `a` (`'seat'`,
  `'rack'`, `'lean'`), and in `fireNet` make that build on the other side (no spending there). Add the builds to
  `meadowSum` (presence and rounded position, as the torches' count is) so a missed word is caught and the meadow is
  asked for again.

**Drawing**

- Constants and paintings: `SEAT_ART = 'seat:0'`, `RACK_ARTS = ['rack:0', 'rack:1']`, `LEAN_ART = 'lean:0'`, made once.
  `SEAT_SIZE`/`SEAT_FOOT` etc. near `TORCH_SIZE`/`BASKET_FOOT`; `seatPx = z => firePx(z) * …` (the basket's size is the
  model). Add the painters to `PAINTERS` (the sprite cache's dispatch) and to `BUILD_ART` (the strip's icon), calling
  the same function. The strip icon uses the empty look (like the shut basket); the rack in the meadow uses
  `rackAny(store) ? 1 : 0`.
- The frame's item list gains the three camp builds (with a `ring` only for the rack, if it is clickable), sorted by
  `y` like everything else. The lean-to is drawn mirrored when `L.x > world.camp.x` (`drawEmoji`'s `flip` option), so
  its mouth opens toward the fire.
- Hover/labels: at least the rack's hover says "Drying rack · N things" (the basket's `basketWord` is the model); the
  seat and lean-to may use `b.text`. Do not add a hover system; reuse `drawHoverLine`/`look` where the basket's is.

**Using it**

- **Seat** — no click handler needed: `sitFrame` gains a seat branch. Standing still (`SIT_MS`) within a small radius of
  the log (a little larger than `SIT_NEAR`, or the same), the forager sits: `fireSit.seat = seat`, `fg.flip` toward the
  campfire, and `kneelNow` returns `KNEEL.warm` when `fireSit.seat` is set. Walking away or using anything else stands
  it up, exactly as the fire's sit does. The fire's own sit keeps working and wins if it is the nearer thing. Do not add
  a new pose or a new sim field.
- **Rack** — the basket's card, on the rack. Generalise the larder block minimally:
  - `larderUi = { open: false, store: null }`; a `larderStore()` helper (`larderUi.store`); `openLarder(on, store)`.
  - Every place the card uses `myBasket()` for its contents, title, slots, "Put all in", "Tidy", drag-and-drop and
    closing (`renderLarder`, `setupLarder`, `larderAll`, `larderTidy`, `larderFrame`, `flyMoves`, `takeSlot`,
    `putSlot`, the satchel's drag targets) uses `larderStore()` instead.
  - The title/aria/tooltips say "Drying rack" when the open store is the rack (the `#larder` `h2` needs its name
    changed dynamically; `index.html` may need a `<span>` around "Basket" or the code can set the first text node).
  - Clicking the rack, or E standing by it, walks there and opens the card (the basket's `basketAt`/`goBasket`/
    `basketByE` paths generalised to the nearest camp store; the basket keeps winning when it is nearer).
  - Friends: `sendBasket`/`basketNet` must know which store changed — add a `w` field (`'basket'`/`'rack'`) to the
    `'bk'` message, or (cleaner) a small all-camp-stores snapshot: `storesWas()` before, `sendStores(was)` after,
    diffing each `worldStores` entry. Every path that spends from or moves things between stores (`spendBuild`,
    `spendTag`, the card's moves) must tell the others; otherwise the rack's contents drift between two players, and
    `meadowSum` will keep asking for the meadow. `S.putAway(w)` also hardcodes the basket: give it an optional store
    (default the basket) so "Put all in" fills whichever card is open. Include the rack's slots in `meadowSum`, as the
    basket's are.
  - The cooking window's camp row (`basketAtHand`, `renderCookBasket`, `potAddBasket`) is **out of scope** this session:
    do not add the rack's tiles there. Note it as a later refinement if it would have been a handful of lines.
- **Lean-to** — passive. A click on it is an ordinary walk (the shelter does the work). If you want a line, a hover
  saying it keeps the rain off is enough.

**Painters**

- Same shape as `paintBasket`/`paintTorch`: `(g, size, U, n)`, `g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2)`,
  round caps/joins, the box −1…1 with the ground at the `*_FOOT` fraction, a soft shadow at the foot, light from the
  top left, shade on the right. Only the helpers the paintings already use (`fillIn`, `strokeIn`, `softIn`, `softSpot`,
  `furGlow`, `ovalAt`, `discAt`, `twig`, `rockRGB`, `tone`, `hash2`). No gradients, filters, text or emoji.
- Paint once: the same function is the sprite (through `PAINTERS`) and the strip icon (through `BUILD_ART`). Never repaint
  per frame; no key strings built per frame (use the `*_ART` constants).
- Keep the 44 px strip icon readable: a strong silhouette, no detail that only reads at 200 px.

## Not in this session

- No new generic build/placement/store/UI system, no new frameworks, no new ingredients or ground items, no `KEEP_VERSION`
  bump (the camp is in `LATER`), no spoilage, no sleeping or time skip, no new forager rig/pose, no sounds beyond the
  existing `'stick'`/`'clack'`/`'tink'` reused while setting down.
- No new camp build beyond these three. The spit, the lantern, the bedroll, the pot and the cellar are later.
- Do not touch the sim's population code, the ground shader, the net protocol beyond the camp-build messages, or anything
  under `.opencode/`.
- Do not commit or push; leave the diff for review.

## Acceptance — work through every line and record what you saw

1. `recipes.html` opens with no problems for the three blocks; the game's console has no `recipes.js:` warnings; the
   strip's tiles show the three with their paintings, names and have/need chips.
2. With a camp (`?seed=123`, light a fire, or start from a kept meadow), C opens the strip: campfire, basket, torch,
   seat, rack, lean. It wraps on a 386 px wide window and every tile is at least 44 px on a touch layout.
3. Outside the ring a ready tile says "It goes at camp, by the fire" and nothing is spent. Inside the ring, a blocked
   spot says why (water, fire, a rock, a tree, the basket, a torch, another build) and the ghost is fainter; a clear
   spot places it after the kneel, spends exactly its cost, and the tile is gone from the strip afterwards (one each).
4. Seat: standing still by the log sits the forager facing the campfire (the warm kneel); walking stands it. It does
   not fight the fire's own sit. A hover/line, if added, says the seat's `text`.
5. Rack: a click, or E standing by it, opens the card on the rack; a tap moves one thing in and out, a drag works,
   "Put all in" and "Tidy" work, walking off shuts it. It holds 12 slots and a slot takes twice a basket slot's stack.
   A collapse loses the satchel but not the rack.
6. Lean-to: in rain or snow, standing under it keeps `f.wet` from rising and warms more slowly than in the open; a step
   outside starts soaking again. It is mirrored so it opens toward the fire. After a collapse, the forager wakes under
   it (if the home move is in).
7. Kept meadow: build all three, reload (or `packWorld`/`unpackWorld` through `structuredClone` under node), and they
   are still there with their contents and positions. A kept meadow from before this change opens with `null`s and no
   errors.
8. Friends: two tabs of one headless Chrome (`?room=…&local`, or `?as=…`), one builds each; the other sees it at the
   same spot, the rack's slots move on both sides, and no console errors. If a build is placed while the other side is
   away, `meadowSum` catches it.
9. Node years: three seeds, a year or two each (`createWorld`, `step`), no population the cooking needs dies out; the
   lean's `bodyTick` branch cannot affect creatures (it only reads the forager and the camp). `packWorld` round-trips.
10. A frame in a busy camp with all three on screen draws only what is on screen; no new per-frame allocations or
    repaints. If anything looks slower, measure `render` before and after and put the numbers in the report.
11. Notes: a short "### The camp builds (date)" under stage 7 in `PLAN.md` (what was built, costs, the rack's keep rule,
    the lean's shelter, the friends' messages), the closing "step 4" line updated, one paragraph in
    the game.js part of `.claude/docs/fire-camp.md` and one in its sim.js part. Keep them short and in the existing voice.

## Report back

1. Files changed, with two or three sentences on the shape of the change.
2. Each acceptance line: pass/fail, and the numbers or screenshots you actually saw.
3. Deviations from this prompt (a cost, a pose, a store rule, a skipped integration) and why.
4. What you noticed and deliberately left alone (for example the cook window's camp row, if you left it).
