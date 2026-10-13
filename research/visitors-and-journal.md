# Visitors and the field journal: plan (2026-10-12)

More visitors, and the journal paced over a real year: `a-year-of-visitors.md` (2026-10-13).

The user agreed to this ("do both"). Part 1 (arrival captions) is built and committed. The hedgehog (2a and 2b, plus the
journal's store and the first-sighting moment from 2c) is built (2026-10-12), and naming and Yours are out (2d, same day);
the heron is built too (same day, painted: `paintHeron`); the journal's card is next. The journal's card goes in the ••• menu where Yours was. This note is for the session
that builds part 2. CLAUDE.md's "discuss before implementing" is already settled for what's below: build it, then
show the user. Anything beyond it gets discussed first.

## Why

The user's critique: Yours/naming is boring and unused ("like naming a human in Frostpunk"). Nothing makes the player
care. They chose direction A, Neko Atsume style: rare visitors drawn by the keeper's work, plus a journal to collect
them. Their two hard requirements:
- **It must be obvious.** "If a hedgehog appeared you wouldn't even see it." The markers (`spots`, `drawSpots`) and
  the arrival captions now handle being seen, and visitors must go through them.
- **It must feel rewarding.** The loop: prepare → surprise → arrival moment → keep it → return.

## What's already there to build on (game.js)

- **Markers.** `spotOf(e)` maps a sim event to `{ emoji, o | x,y, thing?, say }`. `spotNews` adds the marker and
  puts "Go see →" on the event's news line. `drawSpots` draws it on screen or at the screen's edge, and counts it seen
  after SPOT_LOOK_MS up close (SPOT_LOOK_GO if you tapped to go). `seeSpot` then shows the `say` caption (`sayArt`,
  painted once) with a ✨ and `chime('seen')`.
- **Sounds.** sound.js has `seen` (two notes, for an everyday sighting) and `named` (three notes, a bell and its
  answer). Once naming is removed, `named` is free to use for a **first sighting**.
- **The `?keep` tools** are on everywhere except `?watch` (game.js `KEEP`): ponds (`w.dug`, `w.ponds`, events
  `frogsfound` and `pondgrew`), strips (`w.fields`, `stripbloom`), and hedges (`w.hedges`, `hedgeyoung`,
  `hedgebloom`, `hedgehaws`).

## Part 2a: visitors (sim.js)

- **Start with two:**
  - 🦔 **hedgehog**: comes to a hedge that's `young` (thick), at dusk, spring to autumn (it hibernates in winter).
  - **heron**: comes to a dug pond that has frogs, by day, any season but winter. There's no heron emoji, so paint one
    (grey, standing on one leg, a few strokes, cached like the other sprites). Or start with 🦆 mallards at the pond
    and paint the heron later.
- **Keep it out of the food web.** A visitor isn't a creature: nothing hunts it and it eats nothing. Use something
  small like `w.visitors = [{ id, kind, x, y, home, until, ... }]`, moved by a few simple lines: walk in from the
  map's edge to its place, potter round it, and walk out when `until` comes. Give `unpackWorld` a `w.visitors ??= []`
  default so there's no `KEEP_VERSION` bump (the same as `webCounts`).
- **Chance and timing.** Once its condition holds, a visitor comes with some chance per day (an evening for the
  hedgehog), then a cooldown, so a meadow gets maybe one visit a season. It stays about 3–5 days, so at 1×–4× you
  can get there. Emit `{ type: 'visitor', v }` when it arrives and `'visitorleft'` when it goes.
- **Keep it cheap.** No new work in the creature loop; a visitor's step runs once a tick for at most 1–2 visitors.
- **Balance.** `balance.js` must be unchanged, since visitors don't touch the ecology. Run it anyway, with `plant`.

## Part 2b: seeing them (game.js)

- **News and marker.** The news line names the cause: "🦔 A hedgehog has come to your hedge Hawthorn Row, for the
  beetles under it." `spotOf` gets a `'visitor'` case that follows `v`. A visitor's marker should last longer than
  SPOT_S, since it's rare (until the visitor leaves).
- **The first sighting is bigger** than an everyday spot:
  - The caption says "First sighting: hedgehog".
  - It plays `chime('named')` (repurposed) instead of `seen`.
  - A journal stamp: a small ✓ or page icon flies to the ••• button.
- **Inspector.** Add a `THINGS` entry `visitor` so a tap opens its panel: what it is, why it came ("for the beetles
  under your hedge"), and roughly how long it'll stay.
- **Drawing.** Through the sprite cache. For a painted heron, paint once at doublings like the others. Mind the
  perf rules in CLAUDE.md.

## Part 2c: the field journal

- **Opening it.** It's a parchment card (`#journal`), opened from ••• in place of Yours, which is being removed.
- **Kept per player, not per meadow**, in localStorage `aeon-garden-journal`. Each seen visitor stores
  `{ kind: { first: date and season, seen: n } }`. A new meadow doesn't wipe the collection.
- **Layout.** One page per visitor kind:
  - Seen: the painting or emoji, its name, a short nature note, first seen (with a season chip), and times seen.
  - Unseen: a silhouette (CSS `filter: brightness(0); opacity: .25`) and a **hint** that points at keeper work:
    "Something snuffles under old hedges at dusk." / "Something tall stalks frogs in still water."
- **What counts.** Only sightings fill a page. Cubs, swarms and other everyday spots don't go in the journal.
- **Away card.** If a visitor came while you were away, it becomes the headline:
  - Still there: "A heron is at your pond", with "Go see".
  - Gone: "A heron came by your pond while you were away" (no page, but it tells you it happens).

## Part 2d: remove naming and Yours (same change)

- **game.js** has about 37 references: `nameButton`, `startNaming`, `ui.naming`, `renderYours`, `#yours`,
  `data-act="yours"`, `RING`, `RING_HTML`, `drawRingUnder`, `drawLabel`'s `ring` arg, `goneLine` with
  `data-act="adopt"`, `involvesSelected` (keep the selected part, drop `.mine`), and `chime('named')` at the naming site.
- **index.html** has the `.name-edit`, `.ring` and `#yours` styles and markup.
- **sim.js** has `nameCreature`, `nameQueen` and `NAME_MAX` (also in the `api` export line), `c.mine`, and the `.mine`
  in `remembered`. Kept meadows can keep their `mine` flags; dropping them in `unpackWorld` is optional.
  ⚠️ sim.js and CLAUDE.md had another session's uncommitted work on 10-12 (`wildGreen`, and the CLAUDE.md game.js
  section moved to `.claude/rules/game.md`). Commit only your own hunks; never stash.
- **Docs.** The game.js feature notes now live in `.claude/rules/game.md`. Update its naming/Yours paragraph and add
  visitors and the journal there.

## Order and checks

Build in this order: 2a → 2b → 2c → 2d. Test in the browser by forcing a visitor (a debug call, or by pushing the event).
Check:
- a phone layout (375×812)
- no console errors
- render time following an animal at 60× in a busy meadow (it must not get slower)

Ask the user before committing, because pushing main deploys.
