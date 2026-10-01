# Plan: from watching to keeping

Playtests show the destructive verbs (zap, fire) answer loudest, so they're all players use. The fix is
not less destruction but faster-echoing bonds: things to care about, and care that answers within a
session. Destruction stays — with bonds in place it gains stakes, and in this sim destruction is
husbandry with a rough tool (fire renews, floods fertilize).

Principles:

- **The player shapes the stage, never the script.** No possessing animals, no overriding the ladder
  (danger > sleep > love > food > friends > wander). New player actions slot into it or around it.
- **Consequences over costs.** No currencies, shops, cooldown shops or punishments for absence. Tools
  are free; their effects are visible and remembered.
- **Attachment through witnessing, not permanence.** Rabbits live minutes; a name doesn't fight that,
  it notices it. Death of a named animal is content, not failure.
- **Encounters, not lists.** You name what you've found, followed or held — never from a roster.

Four milestones, each shippable on its own from `main`, in this order.

## M1 — Naming (no sim change)

- The inspector gets a rename affordance on any selected rabbit, fox, crow or owl. Selected = met.
- Bees are named at the hive level (the queen is already name+genes on the hive); a worker lives 3
  days, so no individual bee names.
- A named animal gets a small ring/tag mark drawn with its label (naturalist register — birders ring
  birds — not a heart). One fixed style; no colour choice.
- What naming changes: news priority, away-card billing, a "yours" list with tap-to-jump, and a
  headline death line with cause ("A fox took Hazel by the brook").
- The death line ends with a quiet link when kits live: *"her kit Blackberry is by the warren →"* —
  tap to mark her. Offered, never automatic. The name outlives the animal as a line.
- The away fast-forward must log named births/deaths so the card can tell them (it draws nothing but
  still runs — collect the lines there).
- Persistence: new creature fields default in `unpackWorld` (the `webCounts` pattern). **No
  `KEEP_VERSION` bump.**
- Guide: "name an animal" joins `TRIES`.
- Sound: a small chime on naming (sound.js style, no files).

## M2 — Plant a tree

- New tool (toolbar + ring): opens a small seed picker, like the weather ring. The kind is the
  strategy — oak is an owl hollow in 20 years, birch is fast, hawthorn guards its neighbours.
- Plants a **seedling** at smallest size with a `planted` flag (defaults in `unpackWorld`; no bump).
- Survival follows the same rules as wild seedlings: rabbits eat unguarded ones, shade waits, thorns
  protect. No cap — `TREE_ROOM` and grazing do the work.
- The inspector remembers forever: *"You planted this, spring of year 2."*
- balance.js: scripted run planting ~5 seedlings a year over several seeds; cycles must still boom and
  recover. Numbers in the commit message.
- Guide: "plant a tree" joins `TRIES`.

## M3 — Whistle

- Inspector button (mobile: bottom sheet) on a followed named animal: it comes to the cursor position
  at whistle time.
- Priority between `friends` and `wander`: danger, courtship, eating while starving and sleep all win.
- Refusal tell, or players think it's broken: it looks up, an ear-twitch bubble (🎵 or ❔), stays put.
- Simple cooldown. Habituation (answers less if whistled constantly) only if playtests show
  whistle-stunlocking.
- sound.js: a little two-note whistle.
- Whistle/held/clap state is transient — never packed.

## M4 — Clap (startle)

- One ring tool (👏): a radius startle at the point. Rabbits dash for burrows, crows `flapUp`, foxes
  just look up. A false alarm, not a command — skittish personalities react more.
- sound.js: a soft clap.
- Tree-shaking is deliberately **out**: quick-drag conflicts with camera pan. Revisit as a wiggle
  gesture or its own tool (drop windfalls early, flush the roost).

## Cross-cutting

- Everything works with touch (ring is already touch-native; whistle lives in the bottom sheet).
- Perf: no per-frame costs anywhere here; named animals are few. Still time `render` before/after per
  repo rule and put numbers in commit messages.
- All new packed fields default cleanly; old kept meadows load unchanged.

## The test this is aiming at

Self-play a week as a keeper first, noting every "I wish I could…". Then 3–5 players, alone, a week,
no watching over shoulders. Afterwards ask three questions: **What did you do? What do you remember?
Did you open it unprompted, and why?** Tell-tale of success: someone burns *around* their planted oak.

## Parked (discussed, not planned)

Warren/tree renaming; tree-shake gesture; whistle/clap habituation; sow a flower field; nest boxes and
bee skeps; kit rescue from floods; swarm nudging; lineage view; photo album; the almanac of firsts
with wishes ("No owl has ever nested here").

## Still open

- Mark style: ring/tag vs heart — pick when drawing the first sprite.
- Whistle hotkey (or inspector-only).
- Clap radius number — tune by eye in a busy meadow.
