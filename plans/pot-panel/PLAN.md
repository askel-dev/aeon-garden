# The pot panel: cooking at the fire, as in the concept

The concept (`Pot Cooking Panel.html` at the repo root, four boards: the pot empty, things in it, cooking, the dish rising
out) redone in the UI we have: opaque parchment cards, brass, Fraunces and Nunito, no `backdrop-filter`, targets 44 px+.
Only its layout and wording are taken. The pot, the fire and the forager stay the meadow's own paintings (`drawPot`,
`vesselOver`); the mock's flat shapes are stand-ins.

It builds on the fire-cook prototype (`FIRE_COOK`, `.claude/docs/cooking.md`, first paragraph): the camera in on the real
fire, the pot's canvas laid over it and only taking the pointer (`layNear`, `potLaid`), what it'll make and Cook under the
stones (`.cook-under`), the vessels, satchel, book and ✕ in a strip at the foot (`.cook-side`). `?card` keeps the old window
as it is: nothing here touches it.

Decided (2026-10-21):
- Restyled in our UI, not copied.
- "Step back" is the round brass ✕, with the words beside it on a computer.
- No spoilers: only dishes already known are named or suggested. **Where?** opens the missing thing's Finds page.
- Sticks: the stick button and its fuel ring stay. A stick tile tapped in the satchel goes on the fire, as now.
- Upright phone: the slots over the pot; the side card folded into a short line under the stones; the bar at the foot.
- No Eat now / Keep for now: the dish goes to the hand (or the satchel, the basket, the ground) as it does now.
- While cooking at the fire: a card over the pot, closer to the concept. Walked off, the meadow's bar (`drawCookBars`,
  option A, parchment) as now.

**Before step 1:** the fire-cook work still uncommitted in `game.js`, `index.html` and the docs (sticks under the pot,
`litByFire`, the meadow drawing the pot) is committed first, so this starts from a clean tree. Other sessions share this
checkout: commit only this work's hunks, never stash.

---

## Step 1: the slots over the pot and the bar at the foot

Boards 1 and 2 without the side card.

**The slots** (`#cook-slots`, a new row in `.cook-pot`, so `layNear` carries it with the pot as it does `.cook-under`):
- A small dark pill over the pot, "In the pot · 2 of 4". The count is the vessel's (`Recipes.VESSELS[cookVessel].slots`:
  pot 4, griddle 3, stick 2), so it changes as the vessel does.
- Under it one ring per slot, about `--rx * 1.7` over the rim (clear of the steam and the spoon). Empty ones are dashed
  with a +; filled ones are parchment with the thing's satchel painting (`itemBg`) and a small round brass × on their
  corner. The × is 24 px to look at but 44 px to hit (a padded `::after`).
- A × (or a tap on a filled ring) does what a tap on the floating thing does (`potTake(i)`: lifts out with a drip and flies
  back to its tile). The floating things and their tap stay.
- An empty ring tapped makes the satchel tiles that would go in glow for a moment (`.want`, as making does). It's a pointer
  to them, nothing more.
- `#cook-empty`, the red cross, goes: the ×s do its job.
- A thing landing fills its ring with a small pop, at the moment it meets the water (`j.land`), not when it's tapped.
- In making mode (`cookMode()` 'make' or 'fire') the row says what the vessel takes ("Making a bark bowl · 1 of 2") with
  one ring per piece (`makeNeeds`), so the pips on Cook can go.
- Hidden while cooking (`.busy`) and while the dish rises out.
- Rewritten only when the pot, the vessel or the mode changes (a key in `cookUi`, as `cookUi.row`), never in a frame.

**The bar at the foot** (`.cook-side`, restyled, not rebuilt):
- Two labelled parts as in the concept: **Tools** (the vessels, `#cook-vessels`) and **Satchel · tap or drag into the pot**
  (`#cook-bag`), small caps labels in the bar's own brown, a thin rule between them.
- The stick button (`#cook-stick`, fuel ring, count) and the book (`#cook-book`) sit at the bar's right end. The ✕ is last,
  a 44 px round brass button, with "Step back" beside it on a computer (`.close` plus a `<span>` hidden under 760 px and on
  a touch screen).
- A stick tile keeps feeding the fire. Things that go neither in the pot nor on the fire stay let down, as now.
- The basket's row (`#cook-basket`) stays over the bar's left end.
- Upright phone: the bar is a sheet at the foot, the satchel's row on top, the tools and buttons under it, the ✕ in the
  middle of the foot (the house rule). The labels go; the safe area is kept.
- Phone on its side: one row, labels off, as now.

**Done when:**
- Filling, taking out and switching vessels all show in the rings.
- Nothing in the slots or the bar is written in a frame.
- Checked in Chrome at 1400×900, a 390×844 upright phone and an 844×390 phone on its side, by day and at night, and
  in camp with the basket (CLAUDE.md, Checking visuals; `garden.give` to stock the satchel). A before/after shot goes in
  `plans/pot-panel/`.

## Step 2: the side card, "You could make" and "This will make"

The card on the right of boards 1 and 2. It takes over from the line under the stones (`#cook-what`) and from Cook there.

**Where it sits:**
- On a computer: beside the fire on the right, laid by `layNear` with the pot, its left edge `--rx * 2.2` from the pot's
  middle and its top at the slots'. It's clamped on screen (it slides left to stay inside), written only when it moved.
  About 260 px wide.
- Upright phone and anything under 600 px wide: no card. Its content folds into the line under the stones: the dish's name
  and Cook (filled pot), or the first suggestion as one button (empty pot).
- The camera's aim (`kw.fx`, `COOK_AIM`) moves the fire a little left on a computer so the card doesn't cover the forager
  or the edge of the screen.

**Empty pot: "You could make"** (`couldMake()`, run only when the stores or the vessel change, not in a frame):
- Known fire dishes (`knownDish`, for vessels you own: `ownsVessel`), from the satchel plus the basket at camp
  (`haveAt(storesAt(...))`).
- First the ones you have everything for (`Recipes.thingsFor`), the last dish cooked (`lastDish`) at the top. The
  "again" button goes into this. Each one: its name, "Have everything" in green, and **Put in** (`fillPot(name, false)`,
  which picks its vessel too).
- Then near misses, short of one thing (`potLeft` against an empty pot, measured against what's to hand): its name,
  "1 short: dandelion flowers" in amber, and **Where?**.
- **Where?** opens the book on the Finds page of what's missing: `openBook(true, 'finds')` with `bookUi.pick = 'find:' +
  id`. When the need is a tag ("a mushroom") it opens the first found ingredient that answers it, or the first one if none
  has been found yet. A small helper (`openFind(id)`) does this, so the book's tabs keep working as they do.
- At most three rows, ready ones first. "Open the recipe book" is a link at the foot (`openBook`).
- With nothing known yet: "Drop things in and see what comes of it", and the book link. With nothing to hand to cook: the
  line it says now.
- Never a dish not yet known: no names, no silhouettes, no "1 short" for one.

**Filled pot: "This will make"** (from `potWord`, which already says all of it):
- `known`: the dish's painting in a round parchment plate (its `dish:` art, `itemBg(name)`), its name in Fraunces, Fills
  pips (`Recipes.fillOf` against `BOOK_FILL`, `BOOK_PIPS`, as the book draws them), and the big **Cook · 20 s**
  (`#cook-go` moved into the card; the time is `timeWord(Recipes.timeOf(dish))`, at 1x as the book says it).
- `new`: "Something new!" in gold, a ? on the plate, no pips, Cook with no time.
- `toward` / `maybe`: "Not a dish yet", the small "Add garlic for Nettle soup" line, and Cook in its mess look (`.mess`:
  said, not stopped).
- `mess` / `other`: as `potWord` says them now, Cook in its mess look.
- Making mode: `makeLine` in the card and no Cook (making finishes by itself).

**Rewriting:** the card's HTML is written only when its key changes (`cookUi.card`, as `cookUi.line`), through `setHTML`.
Its place is only written when `layNear` moves it.

**Done when:**
- A fresh meadow (nothing known), one with a few dishes known, a full camp basket, a mess, a new dish and making a bowl
  each read right on a computer and on an upright phone.
- **Where?** lands on the right Finds page, and Back / ✕ in the book come back to the fire.
- No dish you haven't made is ever named.
- Shots in `plans/pot-panel/`.

## Step 3: cooking, and the dish coming out

Boards 3 and 4 (without Eat now / Keep).

**While it cooks, at the fire:**
- The slots, the side card and the satchel's part of the bar go. Left at the foot: the ✕ and the stick button. The fire
  must still be kept lit, and the concept's empty foot would hide that.
- Over the pot, a small parchment card (`#cook-timer`, laid by `layNear` where the slots were): the dish's name in
  Fraunces (or "Something new…" for one never made, "Cooking…" for a mess), the time left in ember orange at the right
  ("12 s", `cookLeftText`, or seconds alone under a minute), and a bar under it filling (`--cook-p`, set already in
  `cookFrame`). Grey while the fire's out, gold once done, as option A's bar.
- Text is written only when the second changes (`j.shown`, as now); the bar is the CSS variable.
- `drawCookBars` skips the fire you're cooking at, so there's one bar, not two. Walk off and the meadow's A bar takes over
  where the card was.
- The first time: a small toast at the foot, "Bubbling away on the fire" (`toast`, `firstOnce('cook:bubbling')`), saying
  you can walk off and it keeps cooking. After that it says nothing.
- The concept's version and A side by side in a shot, at the fire and walked off. If the card looks better in the meadow
  too, painting it for `drawCookBars` (name and time in one picture, painted again only when the second changes) is a
  follow-up, measured, not part of this step.

**Done:**
- The dish rises out glowing as now (`kw.reveal`), and the card over the pot turns into a name card for `REVEAL_MS`:
  "Wilted greens" with its Fills pips, or "A forager's mess. Still food, mostly". The concept's board 4 without its two
  buttons.
- Then it goes to the hand as now (or the satchel, the basket, the ground).
- The slots, bar and "You could make" come back with the pot empty. The dish just made sits at the top as the one to cook
  again, if there's enough for it.
- A dish never made before keeps its gold headline (`firstTime`), and the guide's "Eat what you cooked" ticks as now.

**Playing together:** nothing new to send. A friend's pot (`friendPot`) shows the card with "Waiting for its cook".

**Done when:**
- Cooking a known dish, a new dish and a mess, walking off mid-cook and coming back, the fire going out mid-cook, a friend's
  pot and a full satchel each look right on a computer and an upright phone.
- `render` is timed over a few seconds in a busy meadow, with the timer card up next to the A bar alone, at 1x and the
  fastest speed. The card is DOM that changes once a second, so it should cost nothing; if it does, it gets fixed before
  committing, and the numbers go in the commit message.
- `.claude/docs/cooking.md`'s first paragraph says what the at-fire panel is now, in its own voice.

---

## Not in this

- Eat now / Keep (left for later).
- Painting the concept's card for the meadow's away bar (only if step 3's shots argue for it).
- The `?card` window.
