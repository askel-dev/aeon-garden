# Nobody's Meadow

A cozy emoji meadow where rabbits, foxes, bees, crows, owls and otters live their own lives and you watch what
emerges. The owls are switched off for now (sim.js `OWLS = false`): none start, fly in or can be released,
a kept meadow's fly off when it opens, and the page hides their tool, counters, graph and food-web node. All their
code stays; `true` brings them back. It used to be called AEON Garden, and the repo and the
`aeon-garden-*` localStorage keys keep that name (renaming the keys would lose players' settings).
It's played at https://meadow.cryptoler.net: GitHub Pages from `main` under a custom domain (`CNAME`;
the DNS record is in Vercel, see the `askel-dev/cryptoler.net` README). The old github.io link redirects there. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

**Discuss before implementing.** When asked for a change, first talk it through (what you
found, the options, what you'd recommend) and wait for a go-ahead before editing code, unless
told to just do it.

- `sim.js`: the world. No drawing. Runs in the browser and under node. `packWorld` / `unpackWorld` turn a
  world into plain data and back, for keeping it between visits (the tables like `SPECIES` go by name, the
  random numbers as where they'd got to). A change a kept meadow can't take (a new field on the world, a
  creature, a hive or a tree that the code counts on) bumps `KEEP_VERSION`, and players' kept meadows start over.
- `game.js`: drawing, UI, news feed, the inspector. The inspector shows
  animals and every other thing you click (hives, trees, rocks, remains, burrows, flowers, fields, water): each
  kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows.
  A tap on the name at the top of the inspector (`nameButton`) makes an animal yours (sim.js `nameCreature`, `c.mine`; a bee by its queen, `nameQueen`,
  `q.mine`): its news always comes and heads the away card (`involvesSelected`), its death gets a line of its own
  that offers a young one left behind to name (`goneLine`, `data-act="adopt"`), it wears a brass ring in its label
  and on the ground (`RING`, `drawRingUnder`), and ••• Yours lists everyone you named, gone or not (`#yours`,
  `renderYours`). The named are kept with the meadow for good (`remembered`). No `KEEP_VERSION` bump.
  With Look in hand, a press on an animal dragged (or a finger held on it) picks it up by the scruff (`pickUp`,
  `grabAt`: on its body as drawn, so a pan from near one stays a pan): it dangles from the hand as a pendulum the
  hand's speeding up swings (`heldFrame`, `drawHeld`), kicks in fits, and drops with a hop where you let go
  (`letGo`, `drawFalling`). In the sim (`lift`, `putDown`) a held one (`c.held`) skips its turn and is out of the
  grid, so nothing hunts it; its place is the ground under the hand, and it lands on the nearest dry footing.
  The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second), and
  the news log dates each line with a season chip (`seasonChip`).
  The rivers run (`drawFlow`, worked out once a meadow by `flowOf` from the sim's `w.current`): streaks of current, quicker
  down the middle, white water at the fords and where the brook comes in or the river leaves the lake, and things floating by,
  all placed by the flow's clock alone (`flowTick`: the sim's `riverPace`, faster in the spring flood and at speed, slower at
  the summer low). A frame only looks at the stretches of river on screen (`R.box`). What floats comes mostly from the trees
  on the bank (`floatSources`, once a day: blossom off one in flower, its leaves as `treeLook` draws them while they come
  down), and a little from upstream; a tree you plant by the river drops its leaves in.
  A first visit (or `?intro`) gets a short welcome card, then the intro (`startIntro`, `introFrame`): an
  empty meadow (createWorld's `arrival` option, `planArrivals` in sim.js) where a family hops in at dawn,
  digs its burrow and turns in for the night, while the camera, the clock's pace and a caption at a time
  follow along in letterbox bars. It never steers the animals, it waits for them. Any key, click or scroll skips it.
  Then the guide (`startGuide`, `guideTick`, a card bottom left with the news above it): three steps one at a time
  (follow an animal, run time faster, open the ring), each waiting till it's done, then a notebook of things to try
  (`TRIES`: lightning, fire, a fox, the weather, a tree, a year at 60×, the graphs) that tick off whenever they're done
  (`tried`), a tap on one putting its tool in hand. It keeps what's done under `aeon-garden-tried`, comes back on later
  visits till it's done or closed, and ••• "Things to try" opens it again.
  Left alone for a minute while it runs, with no card open (or on V, or ••• "Sit back and watch"), the meadow films
  itself (`startIdle`, `pickShot`, `idleFrame`): the intro's bars and lines, the cards faded away, shots that follow an
  animal or drift past a place, what just happened first (`idleNews`). A shot keeps one zoom and only pans, and the next
  comes after a dip to dark or a glide. Any key, click, scroll or mouse move hands it back, the camera staying put.
  The meadow is kept in the browser when the page is hidden or closed, and while it films itself (`keepMeadow`:
  IndexedDB, under its link, the last `KEEP_MEADOWS`), never on a timer while someone watches (a save is a few frames).
  The next visit opens it where it was (`resumeWorld`): the bare address the one watched last, a `?seed=` link its
  own. Back after `AWAY_MIN` it runs on a season, drawing nothing (days would flicker), behind a card that then says
  what happened (`startAway`, `awayFrame`). The ••• menu shares the link (a phone's share sheet) and takes ideas
  (the `#ask` card). The ••• menu and the stats page also open "Who ate whom" (`#web`, `toggleWeb`, `updateWeb`): the food
  web as an SVG made once (`WEB_NODES`, `WEB_LINKS`, placed by hand), each arrow from the eaten to the eater as thick as
  the log of what went along it, a thing gone now faded with its arrows, a sentence on a tap or hover. Its counts are
  sim.js `webCounts` (the old `w.stats` counters plus plain increments: `grazed`, `sips`, `blossomSips`, `grubs`, `apples`,
  `nuts`, `bodies`, `remains.crows`), minus the snapshot the sim keeps each season (`w.stats.web`, the last `WEB_KEEP`)
  for "this season" and "last year". Open, it updates once a second, writing only what changed; closed, nothing.
  A meadow kept before them gets the new counters at 0 (`unpackWorld`), no `KEEP_VERSION` bump. Visits are counted by GoatCounter (`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the
  page `/meadow` whatever the seed, and a link posted with `?ref=reddit` says where they came from.
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). In Safari (`WEBKIT`) it keeps to `GROUND_WEBKIT` pixels, never below 1x: Safari misses a frame
  on each repaint of a big ground. While the camera pans (following, dragging) it paints a margin round the screen (`PAD`)
  and slides the picture along (`Ground.view`) until the margin runs out. The picture is a canvas of its own
  under the meadow's (`#ground`), slid into place with a CSS transform, never copied onto a frame (only into
  the P photo, `groundIn`); so nothing drawn on the meadow can blend with the ground (a `'lighter'` glow lays a
  light over it instead of adding to it). The loop gives the sim at most `SIM_MS` a frame (a slow phone runs 60x a bit slower
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
  on their side (`short()`) it is a panel down the right. Either way it opens folded to one line (`stripHTML`):
  who, what they're up to, and the tummy. Tap it for the rest.
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

The meadow's ecology (terrain and water, grass and soil, voles, frogs, fish, rabbit coats, sickness, remains, crows,
owls, otters, bees, the trees' lives) is in `.claude/rules/ecology.md`, which loads when sim.js or balance.js is opened.
Species lists come from `KINDS` / `perKind`, so a new species needs no hand-written `{ rabbit, fox, bee }` lists.

Every animal uses one ladder: danger > sleep > love > food > friends > wander. Keep new
behaviour small and readable. If a rule needs a paragraph to explain, it's probably too big.

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
  the cache fills up and repaints all the time.
- Chrome lets a frame draw from only about 30 MB of distinct pictures (width × height × 4, summed over every
  image or canvas `drawImage`d that frame). Past that it flushes mid-frame and every canvas call costs more,
  which a profile blames on whatever call comes next. So keep big pictures off the canvas (the ground is a
  layer of its own), paint sprites near the size they're drawn at, and don't draw many different large ones.
- Draw only what's on screen (`visible`). A full-screen pass (a `wash`, an overlay, a composite mode)
  costs the most, so add one only when it's clearly worth it, and skip it while it wouldn't show.
- The sim can run 2000 ticks in one frame. In hot loops, don't make new objects or arrays, and don't
  scan every creature: use the neighbour grid. Recount things only after they change.
- The page (cards, inspector, news) updates a few times a second at most, and only rewrites what changed.
- Measure it. Before and after a drawing change, time `render` over a few seconds in a busy meadow,
  following an animal, zoomed out, at 60x. If it got slower, fix it before committing, and put the
  numbers in the commit message.

After touching the sim, run `balance.js` over several seeds. The goal is visible
boom-and-bust cycles that recover, not a flat line and not extinction.
