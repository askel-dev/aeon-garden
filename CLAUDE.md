# Nobody's Meadow

A cozy cooking game in a painted meadow: you gather what the meadow gives (honey, fish, fruit, mushrooms, game),
build up a kitchen from a campfire, and cook. It grew out of an ecology sim you watched (rabbits, foxes, bees,
crows, otters...), and that sim is cut down to a pantry: animals that roam, graze, hunt and come back if they're
emptied out, hives that fill with honey, fish in the water. The old watching and keeper game is in git history
before the `cooking` branch (main at 1d79f03). A day is 12 minutes at 1x and a season 7 days (sim.js `TPD`, `SEASON_DAYS`;
how the rates follow, `SLOW` and `HUNGER`, is in `.claude/rules/ecology.md`). It used to be called AEON Garden, and the repo and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings).
It's played at https://meadow.cryptoler.net: GitHub Pages from `main` under a custom domain (`CNAME`;
the DNS record is in Vercel, see the `askel-dev/cryptoler.net` README). The old github.io link redirects there. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

- `sim.js`: the world. No drawing. Runs in the browser and under node. `packWorld` / `unpackWorld` turn a
  world into plain data and back, for keeping it between visits (the tables like `SPECIES` go by name, the
  random numbers as where they'd got to). A change a kept meadow can't take (a new field on the world, a
  creature, a hive or a tree that the code counts on) bumps `KEEP_VERSION`, and players' kept meadows start over.
- You play a little hooded forager (sim.js `w.forager`, fur.js `paintForager`, game.js `drawForager`): a click or a tap
  on the ground walks it there round the deep water (sim.js `foragerTo`), one on an animal opens its panel, a press held
  still sprints toward the pointer (so does a drag, or Shift), and the camera always stays on it (`leadCam`): there's no looking
  around, and a zoom (wheel, pinch, double tap) is about the forager, from `HOME_TILES` across out to `FAR_TILES`. A click
  or a tap on something the meadow gives (mushrooms, greens, a bramble, a fruit or mast tree, a hive) walks it there and
  picks it into the satchel, a row of slots at the bottom in the middle (sim.js `gather`, `w.forager.bag`; game.js
  `goGather`, `renderSatchel`). Every season has little wild finds to pick (sim.js `w.finds`), what has something to give
  glints now and then, standing still the forager senses what's about, and with nothing on screen a small marker at the
  edge shows the nearest and points to it (game.js `drawGlints`, `drawPickArrow`). Sticks, pebbles, dry grass and birch bark lie
about for a fire, picked the same way but with no glint (sim.js `FINDS` marked `ground`; recipes.js tags `fuel`, `stone`, `tinder`).
The forager feels the cold (stage 2 of PLAN.md): the air has a temperature (sim.js `airTemp`), and its warmth, wet and stamina
(`bodyTick`) show on it first (shivers, hunched, breath, drips, stumbles, frost at the edges, a heartbeat; game.js `drawBody`,
`bodyFrame`) and in two slim bars over the satchel (`renderVitals`); at nothing it collapses and wakes at home the next
morning with the satchel lost (`wakeForager`). The first fire comes next (PLAN.md). `forager-lab.html` shows all its paintings. Notes in game.md and ecology.md.
- `game.js`: drawing, UI, the inspector. Its features (and where new notes on them go) are in
  `.claude/rules/game.md`, which loads when game.js or index.html is opened.
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). In Safari (`WEBKIT`) it keeps to
  `GROUND_WEBKIT` pixels, never below 1x: Safari misses a frame on each repaint of a big ground. While the camera pans
  (following, dragging) it paints a margin round the screen (`PAD`) and slides the picture along (`Ground.view`) until the margin runs out. The picture is a canvas of its own
  under the meadow's (`#ground`), slid into place with a CSS transform, never copied onto a frame; so nothing drawn on the meadow can blend with the ground (a `'lighter'` glow lays a
  light over it instead of adding to it). The golden hour lights it in the shader (`light`, game.js `goldLight`, in
  `GOLD_STEPS` so it repaints only on a step); what stands on it gets the same warmth as one `'source-atop'` fill, and
  the night is a navy `wash` over everything. The loop gives the sim at most `SIM_MS` a frame (a slow phone runs fast time a bit slower
  instead of dropping frames), and a paused meadow nobody is touching draws at 30 fps (`resting`).
- `sound.js`: all the sounds, made with Web Audio (no files). Off until the 🔊 button or M.
  `sound-lab.html` plays each one on its own. The forager's footsteps (`step`) come from game.js `foragerFrame`, one for each
  foot down in the stride, with `pace` = its speed against `FORAGER_WALK`, so a sprint (just a faster `f.speed`) is quicker
  and a little firmer with no change here, and `ground` from `groundUnder` (grass, earth, shore, woods, snow, ice, water),
  each its own sound. They're kept soft and cozy (`STEP_SOFT`, all through a felt low-pass, `STEP_TOP`), the grass softest. Keep it minimal: one scale, few sounds. Every 5 to 10
  minutes a short felt-piano piece plays (`TUNES`, written out note by note and played a little
  differently each time); the lab plays each piece on demand. Like C418's Minecraft music, the
  silence between pieces is part of it, and no piece is about the time of day (a day is 12 minutes, a
  piece 90 s): they fit any moment, lean towards a season at 1x, and the piano plays darker at night.
- `index.html`: layout and styles. The world fills the screen: on it only a small pill top right
  (pause, sound, ••• with a link, an idea and a new meadow; on a phone the sound waits in •••), a toast line top
  middle (`toast`), now and then a big headline under it (`announce`: a new day or season, a first find, a friend's
  meadow) and the inspector. Axel wants to see the meadow, not big cards: new UI stays small, temporary and
  close to the action. The cards are opaque parchment with a painted grain (`--paper`), never a `backdrop-filter`.
  Phones get slim bars (`narrow()`: up to 760px wide, or up to 500px tall on their side). Upright, the inspector is a
  bottom sheet; on their side (`short()`) it is a panel down the right. Either way it opens folded to one line (`stripHTML`):
  who, what they're up to, and the tummy. Tap it for the rest. On a touch screen every target is 44 px or more and a ✕ is
  a round brass button; on an upright phone a card is a sheet from the bottom with its ✕ at the foot in the
  middle, and Back shuts what's open (`stepOut`).
- `fur.js`, `fur-worker.js`: the painted foxes and rabbits (their rigs, poses and `paintFur`), the visitors painted the
  same way (dragonflies, the kingfisher, the skylark: `Fur.painters`), and the few drawing helpers every painting in game.js
  uses (`fillIn`, `ovalAt`, `blurIn`, `softIn`, `furGlow`, `rockRGB`, `tone`...), which game.js takes from `Fur`. In the
  meadow the worker paints them off the main thread; notes in `.claude/rules/game.md`.
- `recipes.js`, `recipes.html`: every ingredient, station and dish, as plain data Axel adds to by hand (copy a block).
  A word in a dish's `needs` is an ingredient, a tag or another dish; the pot must match exactly (`cook`). Keep the data at
  the top easy to read and its fields optional; `checkRecipes` (console on load, and the top of `recipes.html`) says what's
  wrong in plain words. The file is one block so its names don't clash with the game's; the game reads it as `Recipes`.
- `trees.js`, `tree-worker.js`, `tree-lab.html`: the trees, painted in code. How they're painted, cached and
  drawn is in `.claude/rules/trees.md`, which loads when one of those files is opened.

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow).

Checking visuals: you may use Google Chrome on this laptop (`/Applications/Google Chrome.app`)
to look at the game yourself, headless or not. `--headless=new --screenshot` only captures the
first frame; to see the game running (animals moving, camera moved), drive Chrome over the
DevTools protocol (`--remote-debugging-port`) and use `Runtime.evaluate` / `Page.captureScreenshot`.
Shortcuts for that: `window.garden` has `world`, `cam` (set `x`, `y`, `zoom`, `goal = null` to look somewhere) and
`ui` (`ui.speed = 0` pauses); the CSS `body > *:not(#world, #ground) { visibility: hidden }` hides every panel.
In a cloud session with no Chrome, Playwright is installed globally (`npm root -g`) with Chromium.
You don't have to test everything: check what a change could plausibly break, and leave the rest.

The meadow's ecology (the clock and its rates, terrain and water, grass, rabbits and foxes, the respawn, frogs, fish,
crows, otters, bees and their hives, the trees' lives, the visitors) is in `.claude/rules/ecology.md`, which loads when
sim.js is opened.
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
