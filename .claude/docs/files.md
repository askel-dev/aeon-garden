# The files, in detail

What each file does and the features that live in it. CLAUDE.md has the short map.

- `sim.js`: the world. No drawing. Runs in the browser and under node. `packWorld` / `unpackWorld` turn a
  world into plain data and back, for keeping it between visits (the tables like `SPECIES` go by name, the
  random numbers as where they'd got to). A change a kept meadow can't take (a new field on the world, a
  creature, a hive or a tree that the code counts on) bumps `KEEP_VERSION`, and players' kept meadows start over.
- You play a little hooded forager (sim.js `w.forager`, fur.js `paintForager`, game.js `drawForager`): a click or a tap
  on the ground walks it there round the deep water (sim.js `foragerTo`), one on an animal opens its panel, a press held
  still sprints toward the pointer (so does a drag, or Shift), and the camera always stays on it (`leadCam`): there's no looking
  around, and a zoom (wheel, pinch, double tap) is about the forager, from `HOME_TILES` across out to `FAR_TILES`. On the winter
  ice it glides (sim.js `onIce`, `FORAGER_ICE_*`): a slow start, wide turns, and it carries on past where it was sent till it
  slows to a stop. A click
  or a tap on something the meadow gives (mushrooms, greens, a bramble, a fruit or mast tree, a hive) walks it there and
  picks it into the satchel, a row of slots at the bottom in the middle (sim.js `gather`, `w.forager.bag`; game.js
  `goGather`, `renderSatchel`). Every season has little wild finds to pick (sim.js `w.finds`), what has something to give
  glints now and then, standing still the forager senses what's about, and with nothing on screen a small marker at the
  edge shows the nearest and points to it (game.js `drawGlints`, `drawPickArrow`). Sticks, pebbles, dry grass and birch bark lie
about for a fire, picked the same way but with no glint (sim.js `FINDS` marked `ground`; recipes.js tags `fuel`, `stone`, `tinder`).
The forager feels the cold (stage 2 of PLAN.md): the air has a temperature (sim.js `airTemp`), and its warmth, wet and stamina
(`bodyTick`) show on it first (shivers, hunched, breath, drips, stumbles, frost at the edges, a heartbeat; game.js `drawBody`,
`bodyFrame`) and on its face top left (`#me`, `renderVitals`: painted in a mood, `faceMood`, fur.js `paintForagerFace`; health a ring round it, warmth and the tummy two dials under it; stamina a ring by the forager itself, `drawStamina`), and a health (`f.health`: it drops while freezing or starving, mends warm and fed, and at nothing it collapses like no warmth; `hurt(w, n)` is the hook for any other harm); at nothing it collapses and wakes at home the next
morning with the satchel lost (`wakeForager`). A new meadow opens in a storm late in the afternoon, the forager cold and wet and
saying it needs a fire before dark (stage 3: sim.js `START_PHASE`, `foragerArrives`; game.js `openingLine`); the storm, a gale
harsher than others, holds till the first fire is lit (`OPENING_HOLD`, `GALE_*`). A campfire (stage 4) is its warmth: built from the satchel by the craft button
by it or F (recipes.js `BUILDS`, game.js `renderBuild`), laid where you pick, struck, and blown on by holding till it catches;
it burns its sticks down to embers, then cold (sim.js `w.fires`, `fireTick`, `fireWarmth`), and at night lights a warm pool
cut out of a dark navy (game.js `lightsFrame`, `paintFireLights`). The first fire lit makes camp (stage 5: sim.js `w.camp`,
`campAt`; game.js `campMoment`): a big warm moment ("Your camp"), the forager wakes there from then on, and a soft ring of
trodden earth round it (`CAMP_R`, `inCamp`, game.js `drawCampRing`) is where later builds go: the first is a basket (`w.camp.basket`, game.js `openLarder`) that keeps what the satchel can't carry, and a collapse can't take. It has emotes (a dance and a sneak: game.js `emote`, fur.js `FORAGER_EMOTE`; the button by the satchel and the 1 and 2 keys are gone). Cooking at the fire (stage 6, built in steps: PLAN.md) has its workings: a click on a lit fire (or the little painted pot bobbing over one you stand by) cooks there: the camera eases in close
on the fire and a big window opens beside it, the pot close up with water in it that what you drag (or tap) from the satchel's big
tiles splashes into, and what the camp's basket keeps as a row of small tiles under them when the fire stands in camp (a tap: one straight out of the basket into the pot, `renderCookBasket`, `potAddBasket`), the fire under it, steam, a spoon stirring, and its sounds (game.js `renderCook`, `drawCookView`, `setupCookBag`;
sound.js `plop`, `stir`, `dish`, `mess`, the pot's simmer; recipes.js `cook`); a recipe book by the satchel (B: a book open on the meadow like the old field journal, numbered pages with each dish's
picture and what goes in, `renderBook`; a few dishes `known` from the start, the rest found by trying or half told by the forager's hints, `hintTick`; its other tab, Finds, has every ingredient found or still to find, with where to look: recipes.js `where`), and food is eaten from the satchel into a tummy (sim.js `f.tummy`, `feedForager`; game.js `eatAsk`). It gets better by doing, as in The Forest (the start of a levelling system, to build on): skills in sim.js `SKILLS`, each with practice `f.xp` and a level `f.lv` (0 to `SKILL_TOP`) whose perks are read where the thing is done (`perk`, `gainSkill`). Stamina is practised by sprinting (longer sprints, breath back sooner), Cooking by each dish out of the pot (quicker cooking, and each vessel past the stick is made only from a level: recipes.js CRAFTS `level`, game.js `makeLocked`), Gathering by each pick into the satchel (a quicker stoop and reach; what lies about for a fire counts a quarter, `GROUND_PRACTICE`, and what it dropped itself counts nothing, so a thing can't be set down and taken up again for practice); a level up is a toast (game.js `levelup`). A new skill is a block in `SKILLS` and a `gainSkill` where it's practised; a tap on the face (or I) opens the book at You (game.js `openYou`, `youSheetHTML`, `skillPageHTML`: a `SKILL_SAYS` line each says what its level gives, and the skill's road to opal), and the face's brass badge is the levels added up, with a level up glowing the book button and dotting the You tab till the book is opened on You. `forager-lab.html` shows all its paintings. Notes in `.claude/docs/forager-*.md`, `gathering.md`, `fire-camp.md`, `cooking.md`.
- `game.js`: drawing, UI, the inspector. Its features (and where new notes on them go) are in
  the topic notes in `.claude/docs/` (see CLAUDE.md).
- `ground.js`: the ground (grass, earth, shores, water) as a WebGL shader, painted from a
  few small textures of one texel a tile that game.js keeps up to date (`paintTerrain`, `updateWater`).
  It paints again only when a texture, the zoom or the light has moved (`steady`), and at most at 2x
  (`GROUND_DPR`). In Safari (`WEBKIT`) it keeps to
  `GROUND_WEBKIT` pixels, never below 1x: Safari misses a frame on each repaint of a big ground. While the camera pans
  (following, dragging) it paints a margin round the screen (`PAD`) and slides the picture along (`Ground.view`) until the margin runs out. The picture is a canvas of its own
  under the meadow's (`#ground`), slid into place with a CSS transform, never copied onto a frame; so nothing drawn on the meadow can blend with the ground (a `'lighter'` glow lays a
  light over it instead of adding to it). The golden hour lights it in the shader (`light`, game.js `goldLight`, in
  `GOLD_STEPS` so it repaints only on a step); what stands on it gets the same warmth as one `'source-atop'` fill, and
  the night is a navy `wash` over everything, and a lit campfire bares a ragged clearing in the snow round it when it lies
(`fire[]`/`fireN` in, game.js `snowMelt`). The loop gives the sim at most `SIM_MS` a frame (a slow phone runs fast time a bit slower
  instead of dropping frames), a paused meadow nobody is touching draws at 12 fps (`resting`), a calm one played at 1x with a still camera and no hands on it (`calm`) at 30, and a touch screen draws at most about 60 a second (`renderGap`, `FRAME_GAP`: a 120Hz phone paints every other beat, the sim still runs on all).
- `sound.js`: all the sounds, made with Web Audio (no files). Off until the 🔊 button or M.
  `sound-lab.html` plays each one on its own. The forager's footsteps (`step`) come from game.js `foragerFrame`, one for each
  foot down in the stride, with `pace` = its speed against `FORAGER_WALK`, so a sprint (just a faster `f.speed`) is quicker
  and a little firmer with no change here, and `ground` from `groundUnder` (grass, earth, shore, woods, snow, ice, water),
  each its own sound. They're kept soft and cozy (`STEP_SOFT`, all through a felt low-pass, `STEP_TOP`), the grass softest. Keep it minimal: one scale, few sounds. Every 5 to 10
  minutes a short felt-piano piece plays (off for now: `MUSIC`) (`TUNES`, written out note by note and played a little
  differently each time); the lab plays each piece on demand. Like C418's Minecraft music, the
  silence between pieces is part of it, and no piece is about the time of day (a day is 12 minutes, a
  piece 90 s): they fit any moment, lean towards a season at 1x, and the piano plays darker at night.
- `index.html`: layout and styles. The world fills the screen: on it only a small pill top right
  (pause, sound, ••• with a link, an idea and a new meadow; on a phone the sound waits in •••) with the sky dial left of it
  (the time of day, the season's hills and its days: game.js `updateDial`), a toast line top
  middle (`toast`), now and then a big headline under it (`announce`: a new day or season, a first find, a friend's
  meadow) and the inspector. Axel wants to see the meadow, not big cards: new UI stays small, temporary and
  close to the action. The cards are opaque parchment with a painted grain (`--paper`), never a `backdrop-filter`.
  Phones get slim bars (`narrow()`: up to 760px wide, or up to 500px tall on their side). Upright, the inspector is a
  bottom sheet; on their side (`short()`) it is a panel down the right. Either way it opens folded to one line (`stripHTML`):
  who, what they're up to, and the tummy. Tap it for the rest. On a touch screen every target is 44 px or more and a ✕ is
  a round brass button; on an upright phone a card is a sheet from the bottom with its ✕ at the foot in the
  middle, and Back shuts what's open (`stepOut`).
- `sw.js`: the offline shell. A service worker, registered by index.html, that keeps the page and all it runs
  (the eleven scripts, the workers' painters, the icons, the self-hosted fonts) in a Cache and serves them
  cache-first, refreshing behind it (stale-while-revalidate, so a new version lands on the next visit). Everything
  is same-origin: PeerJS, Supabase and the stone's function are the only things that still want the network, and
  they go straight through. So a meadow already visited opens with no signal, and Android Chrome offers to install
  it (its fetch handler is what the browser wants before the prompt). Bump `VERSION` for a forced clean start.
- `assets/fonts`: Fraunces and Nunito, self-hosted (index.html `@font-face`, no `<link>` to Google Fonts and no
  preconnect). The same variable Latin cuts Google served — Fraunces italic 450 and upright 600 to 680, Nunito 500
  to 900 — so the meadow asks no third party for anything on first load. Both are OFL (`OFL-Fraunces.txt`,
  `OFL-Nunito.txt`). Replaced only by dropping in new woff2s and, for the browser to notice, bumping sw.js `VERSION`.
- `fur.js`, `fur-worker.js`: the painted foxes and rabbits (their rigs, poses and `paintFur`), the visitors painted the
  same way (dragonflies, the kingfisher, the skylark: `Fur.painters`), and the few drawing helpers every painting in game.js
  uses (`fillIn`, `ovalAt`, `blurIn`, `softIn`, `furGlow`, `rockRGB`, `tone`...), which game.js takes from `Fur`. In the
  meadow the worker paints them off the main thread; notes in `.claude/docs/animals.md`.
- `recipes.js`, `recipes.html`: every ingredient, station and dish, as plain data Axel adds to by hand (copy a block).
  A word in a dish's `needs` is an ingredient, a tag or another dish; the pot must match exactly (`cook`). Keep the data at
  the top easy to read and its fields optional; `checkRecipes` (console on load, and the top of `recipes.html`) says what's
  wrong in plain words. The file is one block so its names don't clash with the game's; the game reads it as `Recipes`.
- `dishes.js`: the dishes, painted by hand in code, each in the vessel it's made in (`Dishes.paint`, `NAMES`; a new one goes
  at the end). Only fur.js's helpers, so `recipes.html` shows each by its recipe, big and at slot size; game.js puts them in the
  satchel's sheet and the book. A dish with no painting yet keeps its recipes.js emoji. How to paint one:
  `.claude/docs/dish-painting.md`; `dish-lab.html?dish=Name` shows one big, at 128 and 48, next to all the others (no server
  needed), and `tools/dish-shot.sh "Name" out.png` screenshots it headless.
- `tools/asset-shot.mjs`: a camp asset seen in the real game (summer, a camp by oaks, three zooms) to judge whether a new
  painting fits. Work on the painter in a plans/ sheet first (plans/lean-to: `build.sh` paints it beside the old one), then
  swap it into game.js and shoot. It hands the page `garden.S` (the sim) through a rewritten game.js, for the shot only. Its Chrome takes a free debug port (another session's
  headless Chrome often holds 9333). plans/drying-rack is the second worked example (`make-rack.html`, `build.sh`).
- `items.js`: what the meadow gives, painted picked and held up for the satchel (`Items.paint`, `NAMES`, ingredient ids; a new
  one goes at the end), on nothing but a faint touch of shade, so no ground shadow blown up in a slot. game.js puts them in
  the satchel's sheet as `'ingr:' + n`, every ingredient so far; a new one not painted here yet keeps the meadow's painting or its emoji.
- `friends.js`, `supabase/friends.sql`: friends (••• › Friends; game.js `openFriends`, `friendsChanged`, `friendInvited`). An anonymous
  Supabase player made the first time Friends opens (`aeon-garden-friends` says to start it from then on), a code to add each other by
  (or a `?friend=CODE` link), a beat every minute while in view, every 30 s while the list is open (`here()`: name and the room played together in) that brings the list back,
  and invites and knocks over Realtime. Your headshot (the corner's face in your hat and cloak, a small JPEG) goes with a beat
  when Friends comes on or the outfit changes (game.js `sendHead`), and the list shows each friend's (fetched only when new, `friend_snaps`). The tables' rules are the security: friends only see each other's room once accepted, and only
  the anon key is in the page (never the service_role one). A change to the SQL is pasted into the Supabase SQL editor by Axel.
  `?as=x` is a second player in the same browser, for trying it out. Playing together itself is still net.js.
- `stone.js`, `supabase/functions/stone`, `supabase/stone.sql`: the old stone (sim.js `w.stone`, `stoneOf`; game.js `paintOldStone`,
  `openStone`, `offerSlot`), a standing stone with a face a short walk from the start: a click or E by it talks to it (typed) and offers it what's in
  the satchel, and it rates it out of 10. Comical, pompous, a food critic. Playing together it's one stone for all: whoever talks
  to it asks the LLM, and the others see what was said, its answer and the score, and their stone remembers it (game.js `heardStone`, `t: 'stone'`). Its words come from free LLMs through the Edge Function
  (Gemini flash-lite, then Groq, then OpenRouter, whichever answers: their keys Supabase secrets `GEMINI_KEY`, `GROQ_KEY`,
  `OPENROUTER_KEY`, never in the page; the score kept in a range by what was offered, `SCORES`; daily limits in stone.sql), or from
  stone.js's hand-written lines when that can't be reached (`?stone-offline` forces them). Its name (`Old Mossbottom`) is a
  placeholder, in stone.js, the function's `NAME` and index.html.
- `updates.js`: the meadow's version (`Updates.VERSION`, `0.MINOR.PATCH`: MINOR a new thing to do, PATCH the same made better)
  and `UPDATES`, a block an update (a push to main: changes made before it's committed add to the top block), newest first: its version, date, title and a few plain notes, one short sentence a change. game.js (what's new: `updatesTick`, `openUpdates`) keeps the version last shown in `aeon-garden-version` and, a few
  seconds into a quiet moment, shows the card of every block newer than it (at most three; each shows its first three notes, the biggest, and "Show N more" opens the rest). Someone new only has the version
  noted; someone who played before there were versions (a kept meadow, a first done) gets the blocks back to the last x.y.0 (`lately`). ••• › What's new
  brings the card back. A bump with no new block shows nothing.
- `trees.js`, `tree-worker.js`, `tree-lab.html`: the trees, painted in code. How they're painted, cached and
  drawn is in `.claude/rules/trees.md`, which loads when one of those files is opened.

