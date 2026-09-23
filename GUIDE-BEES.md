# Adding bees 🐝: a do-it-yourself guide

I (Claude) built this whole thing once in a throwaway copy and ran it, so the code below works:
bees fly out of a hive, drink from the flowers, bring honey home, sleep through autumn and winter,
and help the grass grow. Go one step at a time and **test after every step**.

## Before you start

1. **Save your current work**: `git add -A && git commit -m "burrow drawing"` (game.js has uncommitted changes).
   If you ever break everything: `git checkout sim.js` puts sim.js back to your last commit.
2. Run the game: `python3 -m http.server 8765`, open http://localhost:8765.
3. **Open the browser console** (Chrome: Cmd+Option+J). Red text there = an error, with a file and
   line number. Copy the red text into Gemini along with the code around that line.
4. Headless test: `node balance.js 4 4`. If it crashes, it prints the line that broke.

**JavaScript survival kit**
- `{ }` must always match. Every `(` needs a `)`. Most errors are a missing `,` `}` or `)`.
- In a list of things like `{ a: 1, b: 2 }`, every item except the last needs a comma after it.
- `c` is always "the creature we're thinking about". `w` is the world. `c.energy`, `c.x`, `c.mode`...
- `return` inside a tick function means "done for this tick, skip the rest".
- Cmd+F in your editor is your best friend. Every step says what text to search for.

---

## Step 1: tell the world bees exist (sim.js)

**1a.** Search `const SPECIES = {`. After the whole `fox: { ... },` block, add:

```js
  bee: {
    key: 'bee', name: 'Bee', plural: 'Bees', emoji: '🐝',
    maxEnergy: 40, burn: 0.02, walk: 0.1, sprint: 0.2, sight: 20, mateRange: 30, wade: 1,
    matureDays: 2, lifeDays: 20, gestationDays: 1, litter: [2, 4], cooldownDays: 2,
    breedSeasons: [0, 1], breedEnergy: 0.6, birthCost: 5, cap: 60,
  },
```

**1b.** Search `const NAME_PARTS = {`. After the fox block (put a comma after its closing `}`), add:

```js
  bee: {
    prefixes: ['Buzz', 'Honey', 'Clo', 'Pol', 'Nec', 'Bumb', 'Mel', 'Sun', 'Fuzz', 'Amb'],
    suffixes: ['le', 'by', 'wick', 'ly', 'ina', 'drop', 'kin', 'ette', 'o', 'bee']
  }
```

## Step 2: fix the places that only know about rabbits and foxes (sim.js)

This step is the boring one, but it matters. **Skipping any of these gives weird bugs, not errors**
(for example, rabbits running away from bees because the code thinks every non-rabbit is a fox).

**2a.** In `function buildGrid`, replace these two lines:
```js
  const all = w.grid, rabbit = w.grids.rabbit, fox = w.grids.fox;
  all.n.fill(0); rabbit.n.fill(0); fox.n.fill(0);
```
with
```js
  const all = w.grid;
  all.n.fill(0);
  for (const s in w.grids) w.grids[s].n.fill(0);
```
and further down replace `const mine = c.species === 'rabbit' ? rabbit : fox;` with
```js
    const mine = w.grids[c.species];
```

**2b.** In `function createWorld`, add `bee` to every per-species list:
```js
    grid: makeGrid(), grids: { rabbit: makeGrid(), fox: makeGrid(), bee: makeGrid() },
    count: { rabbit: 0, fox: 0, bee: 0 }, expecting: { rabbit: 0, fox: 0, bee: 0 },
    stats: { births: { rabbit: 0, fox: 0, bee: 0 }, deaths: { rabbit: {}, fox: {}, bee: {} } },
    goneSince: { rabbit: -1, fox: -1, bee: -1 },
```

**2c.** Still in `createWorld`, replace from `makeTerrain(w);` through `for (const species of ['rabbit', 'fox']) {` with:
```js
  makeTerrain(w);
  // One hive, hung in the tree nearest the middle. Bees sleep there, and sit out the winter inside.
  let tree = null;
  for (const d of w.decor) {
    if (d.tree && (!tree || Math.hypot(d.x - W / 2, d.y - H / 2) < Math.hypot(tree.x - W / 2, tree.y - H / 2))) tree = d;
  }
  w.hive = { x: tree.x + 0.5, y: tree.y + 0.2, honey: 200 };
  w.decor.push({ x: w.hive.x, y: w.hive.y, emoji: '🍯', size: 1.2 });
  const n = { rabbit: opts.rabbits ?? Math.round(30 * w.room), fox: opts.foxes ?? Math.round(4 * w.room), bee: 12 };
  for (const species of ['rabbit', 'fox', 'bee']) {
```
(The 🍯 is added as decoration, so game.js draws it for free.)

**2d.** In `function flushNewborn`, replace the `w.count.rabbit = w.count.fox = ...` line with:
```js
  w.count.rabbit = w.count.fox = w.count.bee = 0;
  w.expecting.rabbit = w.expecting.fox = w.expecting.bee = 0;
```
⚠️ Forget this one and the bee count grows forever, and bees stop breeding.

**2e.** In `function addCreature`, replace `c.home = nearestBurrow(w, x, y, 40);` with:
```js
  c.home = species === 'bee' ? w.hive : nearestBurrow(w, x, y, 40);
```

**2f.** In `function giveBirth`, find `if (mum.hidden) { kid.hidden` and make it `if (mum.hidden && mum.burrow) { kid.hidden`.
⚠️ **Without this the game crashes** the first time a bee gives birth inside the hive (hives aren't burrows).

**2g.** In `function step`, replace `if (c.species === 'rabbit') rabbitTick(w, c); else foxTick(w, c);` with:
```js
    if (c.species === 'rabbit') rabbitTick(w, c);
    else if (c.species === 'fox') foxTick(w, c);
    else if (c.species === 'bee') beeTick(w, c);
```

**2h.** In `function lifeTick`, right after `if (c.sleeping) b *= 0.6;` add:
```js
  if (c.species === 'bee' && c.hidden) b *= 0.3;   // huddled in the hive, barely burning
```

Don't test yet: `beeTick` doesn't exist until Step 3.

## Step 3: the bee brain (sim.js)

Paste this whole block just **above** the line `// ---------------------------------------------------------------- life and death`.
It follows the same ladder as everyone else: danger > sleep > love > food > wander.

```js
// ---------------------------------------------------------------- bees

const NECTAR = 0.4;             // energy per tick of sipping
const SIP_TICKS = 40;           // how long one flower takes
const HONEY = 3;                // honey a bee brings home from each flower

// Bees stay in the hive at night, in rain and storms, and from autumn to spring (no flowers).
const hiveTime = w => isNight(w.tick) || w.weather.kind === 'rain' || w.weather.kind === 'storm'
  || seasonOf(w.tick) >= 2;

function beeTick(w, c) {
  const e = c.energy / c.maxEnergy;

  // 1. Danger: nothing hunts bees (yet).

  // 2. Home: sleep in the hive, and eat honey there when hungry.
  if (c.hidden) {
    const hungry = e < 0.5 && c.home.honey > 0;
    if (hungry) { c.home.honey -= 0.2; c.energy += 0.2; }
    if (hiveTime(w) || hungry) return;
    c.hidden = false; c.sleeping = false; c.mode = 'wander';
  }
  if (hiveTime(w) || (e < 0.3 && c.home.honey > 0)) {
    c.mode = 'home';
    if (fly(c, c.home.x, c.home.y, c.walk)) { c.hidden = true; c.sleeping = true; c.mode = 'sleep'; }
    return;
  }

  // 3. Love.
  if (seekLove(w, c)) return;

  // 4. Food: fly to a flower, sip, and pollinate it.
  if (c.mode === 'sip') {
    c.energy = Math.min(c.maxEnergy, c.energy + NECTAR);
    if (--c.timer > 0) return;
    pollinate(w, c.target);
    c.home.honey += HONEY;
    c.mode = 'wander'; c.target = null;
  }
  if (e < 0.8) {
    if (c.mode !== 'flower') { c.target = findFlower(w, c); if (c.target) c.mode = 'flower'; }
    if (c.mode === 'flower') {
      if (fly(c, c.target.x, c.target.y, c.walk)) { c.mode = 'sip'; c.timer = SIP_TICKS; c.target.sipped = w.tick; }
      return;
    }
  }

  // 5. Wander: buzz about, never too far from the hive.
  if (c.mode !== 'wander' || !c.target || fly(c, c.target.x, c.target.y, c.walk * 0.6)) {
    c.mode = 'wander';
    c.target = { x: c.home.x + w.rng.range(-20, 20), y: c.home.y + w.rng.range(-20, 20) };
  }
}

// Bees fly straight over water, trees and all. True once it's there.
function fly(c, tx, ty, v) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.05) c.facing = dx > 0 ? 1 : -1;
  if (d <= v) { c.x = tx; c.y = ty; c.moved = d; return true; }
  c.x += dx / d * v; c.y += dy / d * v; c.moved = v;
  return false;
}

// The flowers the meadow shows: spring and summer, where the grass is lush.
// (Same rule as plantEmoji in game.js. If you change one, change the other.)
function isFlower(w, p) {
  const s = seasonOf(w.tick);
  if (w.grass[p.i] < 0.55) return false;
  return (s === 0 && p.kind < 0.35) || (s === 1 && p.kind < 0.22);
}

// The nearest flower in sight that nobody has sipped from in the last half day.
function findFlower(w, c) {
  let best = null, bd = c.sight * c.sight;
  for (const p of w.plants) {
    const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    const fresh = !p.sipped || w.tick - p.sipped > TPD / 2;
    if (d2 < bd && fresh && isFlower(w, p)) { best = p; bd = d2; }
  }
  return best;
}

// A visited flower spreads its seed: the grass around it grows back thicker. Good for rabbits.
function pollinate(w, p) {
  for (let y = (p.y | 0) - 2; y <= (p.y | 0) + 2; y++) {
    for (let x = (p.x | 0) - 2; x <= (p.x | 0) + 2; x++) {
      if (!dry(w, x, y)) continue;
      const i = idx(x, y);
      w.grass[i] = Math.min(w.fert[i], w.grass[i] + 0.1);
    }
  }
}
```

**Test now:** `node balance.js 3 2` should run without crashing. Then reload the browser: find the 🍯
in a tree near the middle, and bees buzzing around it (in spring and summer only).

## Step 4: a swarm moves in when bees die out (sim.js)

In `function migrate`, replace the first two lines with:
```js
  const wait = { rabbit: 1, fox: 3, bee: 2 }, arrive = { rabbit: 6, fox: 2, bee: 8 }, few = { rabbit: 4, fox: 3, bee: 4 };
  for (const s of ['rabbit', 'fox', 'bee']) {
```
and after the line with `// foxes only come where there is food` add:
```js
    if (s === 'bee' && seasonOf(w.tick) !== 1) continue;          // a swarm only comes in summer
```

## Step 5: nice words for the inspector (sim.js)

In `function mood`, right before `switch (c.mode) {` add:
```js
  if (c.species === 'bee' && c.hidden) return { emoji: '🍯', text: 'Snug in the hive' };
```
and right after `switch (c.mode) {` add:
```js
    case 'sip': return { emoji: '🌼', text: 'Sipping nectar' };
    case 'flower': return { emoji: '🌸', text: 'Off to a flower' };
```

That's bees! 🎉 Commit: `git add -A && git commit -m "Bees"`.

---

## Step 6: balancing (the fun part, and the part that still needs work)

Add a bee count to balance.js so you can see them. Search `rows.push(` and change
`${w.count.rabbit}/${w.count.fox}` to `${w.count.rabbit}/${w.count.fox}/${w.count.bee}`.
Then `node balance.js 6 4`. Rows now read `rabbits/foxes/bees`.

**What I found when testing (be honest with yourself about these numbers):**
- With `HONEY = 3` and the hive in a **random** tree: nice boom and bust. Bees crash in some winters
  and the swarm (Step 4) brings them back.
- With the hive in the **middle** tree (what Step 2c does) there are more flowers nearby, honey piles up,
  and bees sit flat at their cap (~90). That's boring. **Your first balancing job.** Ideas, try one at a time:
  - A honey limit. Add `const HONEY_MAX = 800;` next to `HONEY`, and change `c.home.honey += HONEY;` to
    `c.home.honey = Math.min(HONEY_MAX, c.home.honey + HONEY);`. A big colony then runs out in winter.
    Try 400, 800, 1200. (I didn't get to test this one.)
  - Lower `HONEY` to 2. (Careful: with the random tree, 2 wiped them out every time.)
  - Lower `cap: 60` in the bee species.
- Rabbits and foxes behaved about the same as before bees.

Other knobs: `NECTAR`, `SIP_TICKS`, `lifeDays`, `litter`, and `b *= 0.3` in lifeTick (winter burn).

## Small polish ideas (game.js), easy wins

- Bees get a faint orange fox tint. In `function furTint`, add as its first line:
  `if (c.species === 'bee') return undefined;`
- Bees should face where they fly: in `drawCreature`, both `flip: c.species === 'rabbit' && c.facing > 0`
  could become `flip: (c.species === 'rabbit' || c.species === 'bee') && c.facing > 0` (if they fly backwards, remove it again).
- Bees don't bob up and down: search `const MOVING = new Set([` and add `'flower'` to the list.
- The HUD counter (🐇 46 🦊 6) only shows rabbits and foxes: search `#mini-fox` in game.js and index.html,
  and copy what's there for `bee`. This one's a bit fiddly; save it for later.

## Bigger ideas for later

- **Bees sting foxes**: in `beeTick` step 1, if a fox is near the hive, fly at it and scare it (`frighten`).
- **Honey bears / birds** that eat bees (a real predator, like foxes for rabbits).
- **More hives**: a big colony splits in summer and half fly off to a new tree.
- Buzz sound: in sound.js; test it in sound-lab.html.

## Asking Gemini for help

Give it: (1) the red error text, (2) the function it points at, (3) one sentence on what you were
trying to do. Tell it "keep the change small, match the existing style". Don't let it rewrite whole files.

Tomorrow I'll read your changes, run the balance check, and fix whatever's off. Have fun 🐝
