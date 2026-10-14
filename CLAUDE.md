# Nobody's Meadow

A cozy meadow where rabbits, foxes, bees, crows, owls and otters live their own lives and you watch what
emerges. The owls are switched off for now (sim.js `OWLS = false`): none start, fly in or can be released,
a kept meadow's fly off when it opens, and the page hides their tool, counters, graph and food-web node. All their
code stays; `true` brings them back. It used to be called AEON Garden, and the repo and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings).
It's played at https://meadow.cryptoler.net: GitHub Pages from `main` under a custom domain (`CNAME`;
the DNS record is in Vercel, see the `askel-dev/cryptoler.net` README). The old github.io link redirects there. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

- `sim.js`: the world. No drawing. Runs in the browser and under node. `packWorld` / `unpackWorld` turn a
  world into plain data and back, for keeping it between visits (the tables like `SPECIES` go by name, the
  random numbers as where they'd got to). A change a kept meadow can't take (a new field on the world, a
  creature, a hive or a tree that the code counts on) bumps `KEEP_VERSION`, and players' kept meadows start over.
- `game.js`: drawing, UI, news feed, the inspector. Its features (and where new notes on them go) are in
  `.claude/rules/game.md`, which loads when game.js or index.html is opened.
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). At 15x and 60x the light, the colours and the wet move a little every frame, so what only moves with
  them waits up to `GROUND_HOLD` ms (it had the ground painting two frames in three). In Safari (`WEBKIT`) it keeps to
  `GROUND_WEBKIT` pixels, never below 1x: Safari misses a frame on each repaint of a big ground. While the camera pans
  (following, dragging) it paints a margin round the screen (`PAD`) and slides the picture along (`Ground.view`) until the margin runs out. The picture is a canvas of its own
  under the meadow's (`#ground`), slid into place with a CSS transform, never copied onto a frame (only into
  the P photo, laid under the rest, `groundIn`); so nothing drawn on the meadow can blend with the ground (a `'lighter'` glow lays a
  light over it instead of adding to it). The golden hour lights it in the shader (`light`, game.js `goldLight`, in
  `GOLD_STEPS` so it repaints only on a step); what stands on it gets the same warmth as one `'source-atop'` fill, and
  the night is a navy `wash` over everything. The loop gives the sim at most `SIM_MS` a frame (a slow phone runs 60x a bit slower
  instead of dropping frames), and a paused meadow nobody is touching draws at 30 fps (`resting`).
- `sound.js`: all the sounds, made with Web Audio (no files). Off until the 🔊 button or M.
  `sound-lab.html` plays each one on its own. Keep it minimal: one scale, few sounds. Every 5 to 10
  minutes a short felt-piano piece plays (`TUNES`, written out note by note and played a little
  differently each time); the lab plays each piece on demand. Like C418's Minecraft music, the
  silence between pieces is part of it, and no piece is about the time of day (a day is 20 s, a
  piece 90 s): they fit any moment, lean towards a season at 1x, and the piano plays darker at night.
- `index.html`: layout and styles. The cards are opaque parchment with a painted grain (`--paper`), never a `backdrop-filter`. Phones get slim bars (`narrow()`: up to 760px wide, or up to 500px tall
  on their side). The tools fold into one round button in the bottom right showing the one in hand (`toggleTools`),
  and a finger held on the meadow opens the ring there (`HOLD_MS`). Upright, the inspector is a bottom sheet;
  on their side (`short()`) it is a panel down the right, and in `?keep` the bottom bar becomes a rail down the left (`rail()`), GREEN and the Dry Year's ribbon
  move into the top bar where they fit (`fitTopBar`), and the rail slides away while an animal's panel is open. Either way it opens folded to one line (`stripHTML`):
  who, what they're up to, and the tummy. Tap it for the rest. On a touch screen every target is 44 px or more and a ✕ is
  the journal's round brass button; on an upright phone a card is a sheet from the bottom with its ✕ at the foot in the
  middle (the journal, Who ate whom, the graphs' page), and Back shuts what's open (`stepOut`).
- `fur.js`, `fur-worker.js`: the painted foxes and rabbits (their rigs, poses and `paintFur`), the visitors painted the
  same way (dragonflies, the kingfisher, the skylark: `Fur.painters`), and the few drawing helpers every painting in game.js
  uses (`fillIn`, `ovalAt`, `blurIn`, `softIn`, `furGlow`, `rockRGB`, `tone`...), which game.js takes from `Fur`. In the
  meadow the worker paints them off the main thread; notes in `.claude/rules/game.md`.
- `trees.js`, `tree-worker.js`, `tree-lab.html`: the trees, painted in code. How they're painted, cached and
  drawn is in `.claude/rules/trees.md`, which loads when one of those files is opened.
- `balance.js`: headless check, `node balance.js [years] [seeds]` (add `plant` for a player planting 5 trees a year).
- `terrain-lab.js`: the terrain lab, `index.html?lab`. Sliders for every number in `TERRAIN` (sim.js),
  drawn by the game itself, plus hidden layers and a strip of other seeds. Its "Copy as code" gives
  back the `TERRAIN` block to paste over the one in sim.js. New terrain numbers belong in `TERRAIN`
  (one per line, with a comment) and get a slider in the lab's `GROUPS`. You can also draw water,
  rivers and woods there; the drawing is createWorld's `drawn` option (`readDrawn`), carved by the
  same code as generated water, and travels in the link after the `#` (`drawnToLink`: a server turns a long `?query` away).
  On a phone the three cards become one sheet with tabs (`place`, `openTab`: Draw, Tune, View, Seeds), folded to the
  seed and the tabs, and two fingers pinch the map whatever the pen.

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow).

Checking visuals: you may use Google Chrome on this laptop (`/Applications/Google Chrome.app`)
to look at the game yourself, headless or not. `--headless=new --screenshot` only captures the
first frame; to see the game running (animals moving, camera moved), drive Chrome over the
DevTools protocol (`--remote-debugging-port`) and use `Runtime.evaluate` / `Page.captureScreenshot`.
Shortcuts for that: set `localStorage['aeon-garden-welcomed'] = '1'` before load to skip the welcome
card; `window.garden` has `world`, `cam` (set `x`, `y`, `zoom`, `goal = null` to look somewhere) and
`ui` (`ui.speed = 0` pauses); the CSS `body > *:not(#world, #ground) { visibility: hidden }` hides every panel.
In a cloud session with no Chrome, Playwright is installed globally (`npm root -g`) with Chromium.
You don't have to test everything: check what a change could plausibly break, and leave the rest.

The meadow's ecology (terrain and water, grass and soil, voles, frogs, fish, rabbit coats, sickness, remains, crows,
owls, otters, bees, the trees' lives) is in `.claude/rules/ecology.md`, which loads when sim.js or balance.js is opened.
Species lists come from `KINDS` / `perKind`, so a new species needs no hand-written `{ rabbit, fox, bee }` lists.

Keep it smooth. The game has to run without lag on a phone, zoomed out, at 60x, in rain at night.
A lot of work already went into this (the cached ground, the sprite cache, the neighbour grid). A
new feature must not slow it down. If it would, make it cheaper or leave it out.
- Paint once, copy after. Anything that looks the same from frame to frame goes into a canvas once and
  gets `drawImage`d: the sprite cache (`sprite`), `fireGlow`, `detailTexture`. Never do these per item per
  frame: gradients, `shadowBlur`, `ctx.filter`, `getImageData`/`putImageData`, `measureText`, new canvases.
  Once painted, a picture that's drawn many times a frame is handed over as an ImageBitmap (`asBitmap`): Safari
  keeps a small canvas off the GPU and copies its pixels on every draw, which made a busy meadow stutter there.
- The ground is a cached layer (`drawGround`). It slides when the camera pans, and only changed tiles
  get repainted. Nothing painted into it may change every frame, or the whole ground repaints all the time.
  Moving things go on top. An overlay is one small canvas stretched over the meadow (like
  `drawHillLight`), rebuilt only when its key changes.
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
  (a small tree's two shadows: `shadowPair`).
- The sim can run 2000 ticks in one frame. In hot loops, don't make new objects or arrays, and don't
  scan every creature: use the neighbour grid. Recount things only after they change.
- The sim's objects keep one layout for life: every field a creature, a tree, a rock, a flower or the world will ever have is
  made with it (`blankCreature`, `blankTree`, `rockOf`, `plantOf`, the world's `LATER`), a field that ever holds a fraction starts
  as `-0`, and nothing is `delete`d (set it to its blank value). A field added mid-game, or a whole number turning a
  fraction, gives V8 a new layout: it then reads those objects the slow way for good and keeps rerunning stale compiled
  loops, which once halved the sim's speed. A new field goes into the blank.
- The page (cards, inspector, news) updates a few times a second at most, and only rewrites what changed.
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
  seconds in a busy meadow, following an animal, zoomed out, at 60x. If it got slower, fix it before
  committing, and put the numbers in the commit message. A caption, a card or a small drawing tweak doesn't need it.

After touching the sim, run `balance.js` over several seeds. The goal is visible
boom-and-bust cycles that recover, not a flat line and not extinction.
