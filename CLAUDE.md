# Nobody's Meadow

A cozy cooking game in a painted meadow: you gather what the meadow gives (honey, fish, fruit, mushrooms, game),
build up a kitchen from a campfire, and cook. It grew out of an ecology sim you watched (rabbits, foxes, bees,
crows, otters...), and that sim is cut down to a pantry: animals that roam, graze, hunt and come back if they're
emptied out, hives that fill with honey, fish in the water. The old watching and keeper game is in git history
before the `cooking` branch (main at 1d79f03). A day is 12 minutes at 1x and a season 7 days (sim.js `TPD`, `SEASON_DAYS`;
how the rates follow, `SLOW` and `HUNGER`, is in `.claude/docs/world.md`). It used to be called AEON Garden, and the repo and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings).
It's played at https://meadow.cryptoler.net: GitHub Pages from `main` under a custom domain (`CNAME`;
the DNS record is in Vercel, see the `askel-dev/cryptoler.net` README). The old github.io link redirects there. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

The files (each in more detail, with its features, in `.claude/docs/files.md`):

- `sim.js`: the world, no drawing; runs in the browser and under node. `packWorld` / `unpackWorld` keep a meadow
  between visits; a change a kept meadow can't take (a new field the code counts on) bumps `KEEP_VERSION`.
- `game.js`: drawing, UI, input, the camera, the inspector. `index.html`: layout and styles (Axel wants to see the
  meadow, not big cards: new UI stays small, temporary and close to the action; opaque parchment cards, never a
  `backdrop-filter`; on a touch screen targets are 44 px+, a ✕ is a round brass button, at the foot on an upright phone).
- `ground.js`: the ground as a WebGL shader on a canvas of its own (`#ground`) under the meadow's.
- `fur.js`, `fur-worker.js`: the painted animals, the forager and the drawing helpers; painted off the main thread.
- `trees.js`, `tree-worker.js`, `tree-lab.html`: the trees (`.claude/rules/trees.md` loads with them).
- `sound.js`: every sound, Web Audio, no files. `sound-lab.html` plays each.
- `recipes.js` (+ `recipes.html`): ingredients, builds, crafts and dishes as plain data; `checkRecipes` checks it.
  `dishes.js`, `items.js`: the dishes and the picked things, painted in code.
- `friends.js`, `net.js`, `supabase/`: friends and playing together. `stone.js`: the old stone (an LLM food critic
  through a Supabase Edge Function; keys are Supabase secrets, never in the page).
- `updates.js`: the version (`0.MINOR.PATCH`) and what each update brought, shown once after an update (What's new, game.js).
  One block a push to `main`, not a change: while the top block isn't committed yet, add notes to it (the rule is atop the file).
- `sw.js`: the offline shell (bump `VERSION` for a clean start). `assets/fonts`: self-hosted Fraunces and Nunito.

Notes on each part of the game are in `.claude/docs/`. They don't load on their own: read the one for what you're
working on (each has the game.js side and the sim.js side), and add new notes there in the same voice.

- `world.md`: the clock and its rates (`SLOW`, `HUNGER`), terrain, water and rivers, flower fields; keeping the meadow, favicon, leaves falling
- `trees-life.md`: the trees' lives in the sim (how they're painted is `.claude/rules/trees.md`)
- `hud.md`: the sky dial, headlines, level-up coins
- `forager-look.md`: the forager's painting, poses, outfits and wardrobe, emotes
- `forager-body.md`: warmth, wet, stamina, tummy, health; its face, vitals, thermometer, xp floats, collapse; the intro and opening storm
- `walking-camera.md`: clicks and taps, walking and pathfinding, sprinting, ice, the camera, friends bumping, phone Back and zoom
- `gathering.md`: picking, the satchel, hover and use rings, the queue, E, glints and edge markers
- `fire-camp.md`: the campfire, torches, making camp, the make strip, the basket
- `cooking.md`: the cooking window, vessels, the recipe book and Finds, hints, eating
- `dish-painting.md`: how to paint a new dish in dishes.js (the box, the helpers, the vessels, the steps); `dish-lab.html` and `tools/dish-shot.sh` to look at one
- `tasks-stone-friends.md`: the first-things guide, the old stone, gifts, hugs
- `plants.md`: mushrooms, greens, wild finds, brambles, rocks and flowers
- `animals.md`: rabbits and foxes (sim and painting), the inspector
- `water-life.md`: frogs, fish, otters
- `fishing.md`: the rod, casting, the bite, the bar that brings a fish in, `FISH`
- `crows-remains.md`: remains and crows
- `bees.md`: bees, hives, swarms
- `visitors.md`: the visitors (none come now)
- `files.md`: the long version of the file list above

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow). On localhost (or with `?dev`) `~` opens a barebones dev panel that puts a stack of any
ingredient in the satchel, and the satchel carries 999 of a kind; `garden.give(id, n)` in the console
does the same (`DEV`, game.js). Nothing of it runs on the site unless `?dev` is asked for.

Checking visuals and play: `tools/play.mjs` plays the game in a Chrome window of its own that Axel can watch
(`--headless` for none), a command at a time: `start`, `seen`, `use stick`, `go water`, `shot`, `film`, `stop`. The
`playtest` skill (`.claude/skills/playtest/SKILL.md`) says how, and what to look for. For what it doesn't cover, drive
Google Chrome (`/Applications/Google Chrome.app`) over the DevTools protocol yourself (`--headless=new --screenshot`
only captures the first frame). Shortcuts in the page: `window.garden` has `world`, `cam` (set `x`, `y`, `zoom`,
`goal = null` to look somewhere), `ui` (`ui.speed = 0` pauses), `pace` (`garden.pace = 2` walks and runs the forager
twice as quick), and in dev `S` (the sim) and `seen()` (what there is to tap); the CSS
`body > *:not(#world, #ground) { visibility: hidden }` hides every panel.
In a cloud session with no Chrome, Playwright is installed globally (`npm root -g`) with Chromium.
You don't have to test everything: check what a change could plausibly break, and leave the rest.


Species lists come from `KINDS` / `perKind`, so a new species needs no hand-written `{ rabbit, fox, bee }` lists.

Keep it smooth. The game has to run without lag on a phone, zoomed out, at speed, in rain at night.
A lot of work already went into this (the cached ground, the sprite cache, the neighbour grid). A
new feature must not slow it down. If it would, make it cheaper or leave it out.
- Paint once, copy after. Anything that looks the same from frame to frame goes into a canvas once and
  gets `drawImage`d: the sprite cache (`sprite`), the soft shadows (`SOFT_SHADOWS`). Never do these per item per
  frame: gradients, `shadowBlur`, `ctx.filter`, `getImageData`/`putImageData`, `measureText`, new canvases.
  Once painted, a picture that's drawn many times a frame is handed over as an ImageBitmap (`asBitmap`): Safari
  keeps a small canvas off the GPU and copies its pixels on every draw, which made a busy meadow stutter there.
- The ground is a cached layer (`drawGround`). It slides when the camera pans, and only changed tiles
  get repainted. Nothing painted into it may change every frame, or the whole ground repaints all the time.
  Moving things go on top. An overlay is one small canvas stretched over the meadow (like the sky's
  `skyLayer`), rebuilt only when its key changes.
- Sprite keys take few values. Round sizes (`spriteStep`) and colours (`step`) into a few steps, or
  the cache fills up and repaints all the time. And a frame builds no names to look one up: a key joined from strings is
  hashed afresh on every lookup (`plainKey`, the `*_ARTS` tables of names made once).
- A painting whose look moves on in small steps is painted again at most every so often at speed, where the steps
  come a frame or two apart (a burrow's: `BURROW_MS`).
- Chrome lets a frame draw from only about 30 MB of distinct pictures (width × height × 4, summed over every
  image or canvas `drawImage`d that frame). Past that it flushes mid-frame and every canvas call costs more,
  which a profile blames on whatever call comes next. So keep big pictures off the canvas (the ground is a
  layer of its own), paint sprites near the size they're drawn at, and don't draw many different large ones.
- Draw only what's on screen (`visible`). A full-screen pass (a `wash`, an overlay, a composite mode)
  costs the most, so add one only when it's clearly worth it, and skip it while it wouldn't show. The washes over the
  whole meadow (the dark, the clouds' shadows, the weather's dim, the fog) are gathered and laid in one pass (`skyWash`,
  `skyLayer`, `laySky`): one fill if they're all even, else one small picture of them all (`SKY_RES`). A new one goes in
  with them, not as a fill of its own.
- Many small draws cost by the call (each `drawImage` a microsecond or two, whatever its size): zoomed out a frame
  makes well over a thousand. Draws that are the same for every thing but its size go in one picture drawn once a thing
  (a small tree's two shadows: `shadowPair`). The animals cost by the head: their shadows are gathered and filled a
  few paths a frame (`layShadows`), zoomed far out each is one plain draw (`zoomedOut`, `drawSmall`), and one well off
  screen is passed by before working out where it's drawn.
- The sim can run 2000 ticks in one frame. In hot loops, don't make new objects or arrays, and don't
  scan every creature: use the neighbour grid. Recount things only after they change.
- The sim's objects keep one layout for life: every field a creature, a tree, a rock, a flower or the world will ever have is
  made with it (`blankCreature`, `blankTree`, `rockOf`, `plantOf`, the world's `LATER`), a field that ever holds a fraction starts
  as `-0`, and nothing is `delete`d (set it to its blank value). A field added mid-game, or a whole number turning a
  fraction, gives V8 a new layout: it then reads those objects the slow way for good and keeps rerunning stale compiled
  loops, which once halved the sim's speed. A new field goes into the blank.
- The page (the inspector) updates a few times a second at most, and only rewrites what changed.
- A picture the page's CSS uses goes in as a blob's address, never a data URL in a custom property: every element using the
  variable reads the whole string again in each style pass (the satchel's 750 KB `--items` made opening the cooking window
  cost 30 ms of style).
- Smooth is also even. Input comes when it likes (Safari hands a drag's moves over unaligned with the frames: two in one,
  none in the next), so whatever moves the camera from input calls `handMoved(e.timeStamp)` after it, and the frame
  draws the camera as the hand had it a moment ago (`handShow`). A frame's time is `onBeat`'s, not the browser's (Safari's
  is whole ms), and the sim runs a steady `simFit` ticks a frame, not as many as fit before the time ran out.
- While the zoom moves, a painting within `ZOOM_STRETCH` of the size wanted is stretched (sprites, burrows, rocks), and
  painted sharp once it rests (`groundStill`).
- In Safari a worker's canvas on the GPU paints in the GPU process the page's frames come from, so a heavy painting in a
  worker can still drop the page's frames: the fur worker paints on the CPU (`willReadFrequently`). The tree workers
  tried the same and got worse (they then fight the page for the CPU).
- Measure it, but only when a change will obviously cost something you could notice: a new full-screen
  pass, much more drawn each frame, new work in a hot loop. Then time `render` before and after over a few
  seconds in a busy meadow, the forager walking, zoomed out, at the fastest speed there is. If it got slower, fix it before
  committing, and put the numbers in the commit message. A caption, a card or a small drawing tweak doesn't need it.

After touching the sim, run a few years of it over several seeds headless (node: `createWorld`, `step`, read `w.count`,
`w.hives`, `w.fishCount`, `w.frogCount`; a year is about 8 s): nothing that the cooking needs may die out, and
`packWorld` / `unpackWorld` (through `structuredClone`, as IndexedDB keeps it) must round-trip.
