/* AEON Garden — the simulation.
 *
 * Nothing in here draws. game.js reads the world and paints it; this file only decides
 * what happens. It also runs under node (`require('./sim.js')`) so balance can be checked
 * headless, years at a time.
 *
 * Every animal follows the same small ladder, ported from the old reflex brain:
 *   danger > sleep > love > food > friends > wander
 * Nothing else is scripted. Herds, arms races and boom-bust years come out of that.
 * The weather leans on the ladder: thunder and fire are danger, storms are for sleeping.
 */
(function (root) {
'use strict';

// ---------------------------------------------------------------- world constants

const W = 120, H = 80;          // map size in tiles
const TPD = 600;                // ticks per day (20 s at 1x)
const SEASON_DAYS = 5;
const YEAR_DAYS = SEASON_DAYS * 4;
const CELL = 8;                 // spatial grid cell, in tiles
const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);

const SEASONS = [
  { name: 'Spring', emoji: '🌸', growth: 1.00, cap: 1.00 },
  { name: 'Summer', emoji: '☀️', growth: 0.70, cap: 1.00 },
  { name: 'Autumn', emoji: '🍂', growth: 0.30, cap: 0.75 },
  { name: 'Winter', emoji: '❄️', growth: 0.03, cap: 0.40 },
];

// One weather at a time. grow: grass growth. sight: how far anyone can see.
// soak: how fast the ground gets wetter (+) or dries out (-), per day. days: how long it lasts.
const WEATHER = {
  clear:  { name: 'Clear skies',  emoji: '☀️', grow: 1.0, sight: 1.00, soak: -0.6, days: [0.4, 1.2] },
  cloudy: { name: 'Cloudy',       emoji: '☁️', grow: 1.0, sight: 1.00, soak: -0.3, days: [0.3, 0.8] },
  rain:   { name: 'Rain',         emoji: '🌧️', grow: 3.0, sight: 0.85, soak: 2.0, days: [0.3, 0.8] },
  storm:  { name: 'Thunderstorm', emoji: '⛈️', grow: 3.0, sight: 0.70, soak: 1.5, days: [0.25, 0.5] },
  fog:    { name: 'Fog',          emoji: '🌫️', grow: 1.0, sight: 0.45, soak: -0.1, days: [0.2, 0.5] },
  snow:   { name: 'Snow',         emoji: '🌨️', grow: 0.5, sight: 0.80, soak: 0.0, days: [0.4, 1.0] },
  heat:   { name: 'Heatwave',     emoji: '🥵', grow: 0.3, sight: 1.00, soak: -2.5, days: [1.0, 2.0] },
};
const WEATHER_ODDS = [             // per season
  { clear: 4, cloudy: 3, rain: 3, storm: 1, fog: 1 },
  { clear: 6, cloudy: 2, rain: 1, storm: 2, heat: 2 },
  { clear: 3, cloudy: 3, rain: 3, storm: 1, fog: 3 },
  { clear: 3, cloudy: 3, snow: 4, fog: 2 },
];
const FIRE_TICKS = 40;          // how long one patch burns
const ASH_DAYS = 3;             // ash feeds fresh shoots for this long

const GRASS_RATE = 0.4;         // logistic growth per day at full season
const SEED_RATE = 0.06;         // regrowth trickle on bare ground, per day
const DIEBACK = 0.35;           // per day, above the season's cap
const BITE = 0.012;             // grass eaten per tick of grazing
const GRASS_ENERGY = 40;        // energy per unit of grass
const MOVE_COST = 0.25;         // energy per tick = MOVE_COST * v^2 / walk

const GENES = ['speed', 'size', 'eyes', 'bravery', 'friendly', 'fur'];

const SPECIES = {
  rabbit: {
    key: 'rabbit', name: 'Rabbit', plural: 'Rabbits', emoji: '🐇',
    maxEnergy: 100, burn: 0.035, walk: 0.06, sprint: 0.155, sight: 10, mateRange: 24,
    matureDays: 4, lifeDays: 22, gestationDays: 1.5, litter: [2, 5], cooldownDays: 1.0,
    breedSeasons: [0, 1], breedEnergy: 0.55, birthCost: 10, cap: 320,
  },
  fox: {
    key: 'fox', name: 'Fox', plural: 'Foxes', emoji: '🦊',
    maxEnergy: 220, burn: 0.035, walk: 0.07, sprint: 0.21, sight: 18, mateRange: 45,
    matureDays: 8, lifeDays: 40, gestationDays: 2.5, litter: [2, 4], cooldownDays: 8,
    breedSeasons: [0, 1], breedEnergy: 0.65, birthCost: 25, cap: 60,
  },
};

const NAME_PARTS = {
  rabbit: {
    prefixes: ['Cott', 'Snow', 'Bramb', 'Wil', 'Truf', 'Hazel', 'Ac', 'Peb', 'Dan', 'Tans'],
    suffixes: ['tail', 'drop', 'le', 'low', 'flee', 'nut', 'orn', 'ble', 'delion', 'sy', 'foot', 'paws']
  },
  fox: {
    prefixes: ['Rus', 'Em', 'Scar', 'Cin', 'Fen', 'Marm', 'Ash', 'Kin', 'Am', 'Vix'],
    suffixes: ['ty', 'ber', 'let', 'der', 'nec', 'alade', 'ley', 'dle', 'ber', 'en', 'flame', 'spark']
  }
};

// ---------------------------------------------------------------- random

function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    normal: () => {
      let u = 0;
      while (u === 0) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle: arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// ---------------------------------------------------------------- clock

const dayOf = t => Math.floor(t / TPD);
const seasonOf = t => Math.floor(dayOf(t) / SEASON_DAYS) % 4;
const yearOf = t => Math.floor(dayOf(t) / YEAR_DAYS) + 1;
const phaseOf = t => (t % TPD) / TPD;               // 0 = sunrise
const isNight = t => { const p = phaseOf(t); return p >= 0.72 || p < 0.02; };

function clock(w) {
  const t = w.tick;
  return {
    day: dayOf(t) % YEAR_DAYS + 1, dayInSeason: dayOf(t) % SEASON_DAYS + 1,
    season: seasonOf(t), year: yearOf(t), phase: phaseOf(t), night: isNight(t),
  };
}

// ---------------------------------------------------------------- terrain

const idx = (x, y) => (y | 0) * W + (x | 0);
const inBounds = (x, y) => x >= 0.5 && y >= 0.5 && x < W - 0.5 && y < H - 0.5;
const isWater = (w, x, y) => w.water[idx(x, y)] === 1;
const walkable = (w, x, y) => inBounds(x, y) && !isWater(w, x, y);

function makeTerrain(w) {
  const r = w.rng;
  const fert = new Float32Array(W * H);
  const water = new Uint8Array(W * H);

  // Ponds: a few overlapping circles each, so they read as ponds and not as discs.
  const ponds = [];
  const nPonds = r.int(2, 3);
  for (let p = 0; p < nPonds; p++) {
    const cx = r.range(18, W - 18), cy = r.range(14, H - 14);
    for (let k = 0; k < 4; k++) {
      ponds.push({ x: cx + r.range(-4, 4), y: cy + r.range(-3, 3), r: r.range(2.5, 5) });
    }
  }
  // Fertile and poor patches.
  const blobs = [];
  for (let i = 0; i < 16; i++) {
    blobs.push({ x: r.range(0, W), y: r.range(0, H), r: r.range(7, 20), a: r.range(-0.45, 0.6) });
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let nearWater = 99;
      for (const p of ponds) {
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) - p.r;
        if (d < nearWater) nearWater = d;
      }
      if (nearWater < 0) { water[i] = 1; continue; }
      let v = 0.55;
      for (const b of blobs) {
        const d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
        v += b.a * Math.exp(-d2 / (2 * b.r * b.r));
      }
      v += 0.35 * Math.exp(-nearWater / 3);        // lush banks
      v += r.range(-0.06, 0.06);
      fert[i] = v;
    }
  }
  // Every world should be livable: rescale so the average meadow is equally rich.
  let sum = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (!water[i]) { sum += fert[i]; n++; }
  const k = 0.62 / (sum / n);
  for (let i = 0; i < W * H; i++) fert[i] = water[i] ? 0 : clamp(fert[i] * k, 0.12, 1);
  w.fert = fert;
  w.water = water;
  w.grass = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) w.grass[i] = water[i] ? 0 : fert[i] * r.range(0.5, 0.9);

  // Burrows: spread out, on dry land.
  w.burrows = [];
  for (let tries = 0; w.burrows.length < 18 && tries < 2000; tries++) {
    const x = r.range(6, W - 6), y = r.range(6, H - 6);
    if (!walkable(w, x, y)) continue;
    let ok = true;
    for (let dx = -2; dx <= 2 && ok; dx++) for (let dy = -2; dy <= 2 && ok; dy++) {
      if (!walkable(w, x + dx, y + dy)) ok = false;
    }
    if (!ok || w.burrows.some(b => Math.hypot(b.x - x, b.y - y) < 14)) continue;
    w.burrows.push({ id: w.burrows.length, x, y, count: 0 });
  }

  // Decoration only: trees in a few groves, some rocks, flower spots.
  w.decor = [];
  for (let g = 0; g < 4; g++) {
    const gx = r.range(8, W - 8), gy = r.range(8, H - 8);
    const n = r.int(3, 7);
    for (let k = 0; k < n; k++) {
      const x = gx + r.range(-5, 5), y = gy + r.range(-4, 4);
      if (walkable(w, x, y) && !w.burrows.some(b => Math.hypot(b.x - x, b.y - y) < 3)) {
        w.decor.push({ x, y, emoji: r.next() < 0.6 ? '🌳' : '🌲', size: r.range(2.4, 3.4), tree: true, stump: 0 });
      }
    }
  }
  for (let k = 0; k < 10; k++) {
    const x = r.range(3, W - 3), y = r.range(3, H - 3);
    if (walkable(w, x, y)) w.decor.push({ x, y, emoji: '🪨', size: r.range(1.1, 1.8) });
  }
  w.plants = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (water[y * W + x] || r.next() > 0.07) continue;
    w.plants.push({ x: x + r.next(), y: y + r.next(), i: y * W + x, kind: r.next() });
  }
}

function growGrass(w, dt) {
  const s = SEASONS[seasonOf(w.tick)], grow = sky(w).grow;
  const capK = s.cap * (w.weather.kind === 'heat' ? 0.8 : 1);   // a heatwave browns the grass
  const r = GRASS_RATE * s.growth * grow * dt / TPD;
  const seed = SEED_RATE * Math.max(s.growth, 0.05) * grow * dt / TPD;
  const die = DIEBACK * dt / TPD, ashFade = dt / (ASH_DAYS * TPD);
  const g = w.grass, f = w.fert, water = w.water, ash = w.ash, fire = w.fire;
  for (let i = 0; i < g.length; i++) {
    if (water[i] || fire[i]) continue;
    const cap = f[i] * capK;
    const a = ash[i] > 0 ? 1 + 3 * ash[i] : 1;               // new shoots love ash
    let v = g[i];
    if (v < cap) v += r * a * v * (1 - v / cap) + seed * a * cap;
    else v -= (v - cap) * die;
    g[i] = v;
    if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - ashFade);
  }
}

// ---------------------------------------------------------------- weather
//
// The sky picks a weather from the season's odds. The ground remembers it: rain soaks it,
// sun dries it. Lightning on dry ground starts a fire, and fire spreads through tall dry
// grass, so a well-grazed meadow burns less than an overgrown one.

const sky = w => WEATHER[w.weather.kind];

function setWeather(w, kind, ticks, player = false) {
  if (kind === w.weather.kind) { w.weather.until = Math.max(w.weather.until, w.tick + ticks); return; }
  const prev = w.weather.kind;
  w.weather = { kind, until: w.tick + ticks };
  emit(w, { type: 'weather', kind, prev, player });
}

function pickWeather(w) {
  const odds = WEATHER_ODDS[seasonOf(w.tick)];
  let roll = w.rng.next() * Object.values(odds).reduce((a, b) => a + b, 0), kind = 'clear';
  for (const k in odds) { roll -= odds[k]; if (roll < 0) { kind = k; break; } }
  const [a, b] = WEATHER[kind].days;
  setWeather(w, kind, w.rng.range(a, b) * TPD);
}

function weatherTick(w) {
  if (w.tick >= w.weather.until) {
    if (w.skyLocked) w.weather.until = w.tick + TPD / 2;     // the player pinned it: keep it going
    else pickWeather(w);
  }
  const kind = w.weather.kind;
  w.wet = clamp(w.wet + sky(w).soak / TPD, 0, 1);
  if (kind === 'snow') w.snow = Math.min(1, w.snow + 2 / TPD);
  else if (w.snow > 0) {                                     // melting snow soaks the ground
    const melt = Math.min(w.snow, (seasonOf(w.tick) === 3 ? 0.3 : 2) / TPD);
    w.snow -= melt; w.wet = Math.min(1, w.wet + melt);
  }
  // Storms bring lightning. Now and then a heatwave brings a dry strike, with no rain after it.
  if (w.rng.next() < (kind === 'storm' ? 1 / 80 : kind === 'heat' ? 1 / 900 : 0)) {
    let x, y;
    do { x = w.rng.range(1, W - 1); y = w.rng.range(1, H - 1); } while (isWater(w, x, y));
    strike(w, x, y);
  }
}

function strike(w, x, y) {
  // Lightning likes trees.
  const tree = w.decor.find(d => d.tree && !d.stump && (d.x - x) ** 2 + (d.y - y) ** 2 < 16);
  if (tree) { x = tree.x; y = tree.y; tree.stump = w.tick; }
  let victim = null;
  forEachNear(w, x, y, 1.2, o => { victim = o; });
  if (victim) die(w, victim, 'lightning');
  const i = idx(x, y);
  const fire = !w.water[i] && (tree ? w.wet < 0.5 : w.wet < 0.4 && w.grass[i] > 0.15) && ignite(w, i);
  // Thunder: every rabbit out in the open bolts for a burrow.
  forEachNear(w, x, y, 22, o => frighten(o, x, y, 'thunder'), 'rabbit');
  emit(w, { type: 'lightning', x, y, tree: !!tree, victim, fire });
}

function ignite(w, i) {
  if (w.fire[i] || w.water[i]) return false;
  if (!w.blaze) emit(w, { type: 'fire', x: i % W + 0.5, y: ((i / W) | 0) + 0.5 });
  w.fire[i] = FIRE_TICKS; w.burning.push(i); w.blaze++;
  return true;
}

function fireTick(w, dt) {
  if (!w.burning.length) return;
  const g = w.grass, spread = 0.1 * (1 - w.wet) ** 2 * (isNight(w.tick) ? 0.5 : 1);   // dew at night
  const lit = w.burning;
  w.burning = [];
  for (const i of lit) {
    g[i] *= 0.8;
    w.fire[i] -= dt;
    if (w.fire[i] <= 0 || w.wet > 0.7) { w.fire[i] = 0; g[i] = 0; w.ash[i] = 1; continue; }
    w.burning.push(i);
    const x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!w.fire[n] && w.rng.next() < spread * g[n]) ignite(w, n);
    }
  }
  for (const c of w.creatures) {                              // too slow, or asleep in the open
    if (c.alive && !c.hidden && w.fire[idx(c.x, c.y)]) die(w, c, 'fire');
  }
  if (!w.burning.length) { emit(w, { type: 'fireout', burned: w.blaze }); w.blaze = 0; }
}

function fireNear(w, x, y, r) {
  for (let yy = Math.max(0, (y - r) | 0); yy <= Math.min(H - 1, y + r); yy++) {
    for (let xx = Math.max(0, (x - r) | 0); xx <= Math.min(W - 1, x + r); xx++) {
      if (w.fire[yy * W + xx]) return { x: xx + 0.5, y: yy + 0.5 };
    }
  }
  return null;
}

function frighten(c, x, y, what) {
  c.fright = what === 'thunder' ? 90 : 40;
  c.frightX = x; c.frightY = y; c.frightWhat = what;
}

// Fire is danger for everyone. Checked every few ticks, and only while something burns.
function smellSmoke(w, c) {
  if (!w.burning.length || (w.tick + c.id) % 4 !== 0) return;
  const f = fireNear(w, c.x, c.y, 4);
  if (f) frighten(c, f.x, f.y, 'fire');
}

// ---------------------------------------------------------------- spatial grid

// One grid with everyone, and one per species: a rabbit looking out for foxes then only
// looks at foxes, not at the whole warren around it. Rebuilt every tick, so the cells are
// reused and only their counts reset (emptying an array makes it reallocate as it refills).
const makeGrid = () => ({ cells: Array.from({ length: GW * GH }, () => []), n: new Int32Array(GW * GH) });

function buildGrid(w) {
  const all = w.grid, rabbit = w.grids.rabbit, fox = w.grids.fox;
  all.n.fill(0); rabbit.n.fill(0); fox.n.fill(0);
  for (const c of w.creatures) {
    if (!c.alive || c.hidden) continue;
    const k = clamp((c.y / CELL) | 0, 0, GH - 1) * GW + clamp((c.x / CELL) | 0, 0, GW - 1);
    const mine = c.species === 'rabbit' ? rabbit : fox;
    all.cells[k][all.n[k]++] = c;
    mine.cells[k][mine.n[k]++] = c;
  }
}

function forEachNear(w, x, y, radius, fn, species) {
  const grid = species ? w.grids[species] : w.grid;
  const x0 = clamp(((x - radius) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + radius) / CELL) | 0, 0, GW - 1);
  const y0 = clamp(((y - radius) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + radius) / CELL) | 0, 0, GH - 1);
  const r2 = radius * radius;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const k = gy * GW + gx, cell = grid.cells[k];
    for (let j = 0, n = grid.n[k]; j < n; j++) {
      const o = cell[j];
      if (!o.alive || o.hidden) continue;
      const d2 = (o.x - x) ** 2 + (o.y - y) ** 2;
      if (d2 <= r2) fn(o, d2);
    }
  }
}

function nearest(w, c, radius, species, pred) {
  let best = null, bd = Infinity;
  forEachNear(w, c.x, c.y, radius, (o, d2) => {
    if (o === c || d2 >= bd) return;
    if (pred && !pred(o)) return;
    best = o; bd = d2;
  }, species);
  return best;
}

// ---------------------------------------------------------------- creatures

function roman(n) {
  const r = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, l] of r) while (n >= v) { s += l; n -= v; }
  return s;
}

// Names are a prefix and a suffix (Hazel + tail), dealt from a shuffled deck of every pairing
// so they rarely repeat. An empty deck is shuffled again, and a repeat gets a number: Hazeltail II.
function pickName(w, species) {
  w.namePools ??= {};
  let deck = w.namePools[species];
  if (!deck || !deck.length) {
    const { prefixes, suffixes } = NAME_PARTS[species];
    deck = w.namePools[species] = w.rng.shuffle(prefixes.flatMap(p => suffixes.map(s => p + s)));
  }
  const base = deck.pop();
  const key = species + ':' + base;
  const n = (w.nameCounts.get(key) || 0) + 1;
  w.nameCounts.set(key, n);
  return n === 1 ? base : base + ' ' + roman(n);
}

function founderGenes(w) {
  const g = {};
  for (const k of GENES) g[k] = clamp(0.5 + 0.12 * w.rng.normal(), 0, 1);
  g.fur = w.rng.next();
  return g;
}

function childGenes(w, mum, dad) {
  const r = w.rng, g = {};
  for (const k of GENES) {
    let v = r.next() < 0.5 ? mum[k] : dad[k];
    if (k === 'fur') v = (mum.fur + dad.fur) / 2 + 0.05 * r.normal();   // families share a coat
    else if (r.next() < 0.35) v += 0.045 * r.normal();
    g[k] = clamp(v, 0, 1);
  }
  return g;
}

function computeTraits(c) {
  const g = c.genes, sp = c.sp;
  const sizeF = 0.75 + 0.5 * g.size;
  const speedF = (0.75 + 0.5 * g.speed) * (1.1 - 0.2 * g.size);
  c.maxEnergy = sp.maxEnergy * sizeF;
  c.burnRate = sp.burn * Math.pow(sizeF, 0.75) * (0.9 + 0.2 * g.eyes);
  c.walk = sp.walk * speedF;
  c.sprint = sp.sprint * speedF;
  c.sight = sp.sight * (0.7 + 0.6 * g.eyes);
  c.fleeDist = c.sight * (0.95 - 0.5 * g.bravery);
  c.pounce = 3 + 5 * g.bravery;
  c.scale = 0.8 + 0.4 * g.size;
}

function makeCreature(w, species, x, y, genes, parents) {
  const sp = SPECIES[species];
  const r = w.rng;
  const c = {
    id: w.nextId++, species, sp, x, y, genes,
    name: pickName(w, species),
    sex: r.next() < 0.5 ? 'F' : 'M',
    gen: parents ? Math.max(parents.mum.gen, parents.dadGen) + 1 : 1,
    mumId: parents ? parents.mum.id : 0, dadId: parents ? parents.dadId : 0,
    born: w.tick, lifespan: sp.lifeDays * TPD * r.range(0.8, 1.2),
    alive: true, died: 0, cause: '',
    energy: 0, stamina: 1, heading: r.range(0, Math.PI * 2), facing: 1, turnBias: 1,
    mode: 'wander', target: null, targetId: 0, timer: 0, moved: 0,
    sprinting: false, sleeping: false, hidden: false, burrow: null, home: null,
    alert: 0, threatId: 0, chaseT: 0, fright: 0, frightX: 0, frightY: 0, frightWhat: '',
    wary: 0, waryX: 0, waryY: 0, detour: 0, detourX: 0, detourY: 0, nemesisId: 0, haunt: null,
    pregnantUntil: 0, cooldownUntil: 0, dadGenes: null, dadIdPending: 0, dadGenPending: 0,
    kids: 0, kills: 0, escapes: 0, story: [],
  };
  computeTraits(c);
  c.energy = c.maxEnergy * (parents ? 0.6 : 0.8);
  return c;
}

const ageDays = (w, c) => ((c.alive ? w.tick : c.died) - c.born) / TPD;
const growth = (w, c) => Math.min(1, ageDays(w, c) / c.sp.matureDays);
const isAdult = (w, c) => growth(w, c) >= 1;

function note(w, c, emoji, text) {
  c.story.push({ t: w.tick, emoji, text });
  if (c.story.length > 40) c.story.splice(1, 1);   // keep the birth line
}

const MARKED = new Set(['extinct', 'arrive', 'fire']);   // moments the stats chart pins on its timeline
function emit(w, e) {
  e.t = w.tick; w.events.push(e);
  if (MARKED.has(e.type)) w.history.marks.push({ t: e.t, type: e.type, species: e.species, kind: e.kind });
}

function nearestBurrow(w, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const b of w.burrows) {
    const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (d2 < bd) { best = b; bd = d2; }
  }
  return best;
}

function addCreature(w, species, x, y, opts = {}) {
  if (!walkable(w, x, y)) return null;
  const c = makeCreature(w, species, x, y, opts.genes || founderGenes(w), null);
  if (opts.sex) c.sex = opts.sex;
  if (opts.age) c.born = w.tick - opts.age * TPD;
  c.home = nearestBurrow(w, x, y, 40);
  note(w, c, '🌍', opts.arrived ? 'Wandered into the meadow' : 'Arrived in the meadow');
  w.newborn.push(c);
  w.byId.set(c.id, c);
  return c;
}

// ---------------------------------------------------------------- movement

// True when the straight walk from one point to another stays on land (checked every half tile).
function clearPath(w, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let k = 1; k <= n; k++) if (!walkable(w, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return false;
  return true;
}

// Straight at the target while the way is clear. When water (or the map edge) blocks the step,
// turn off it and then follow that shore, keeping it on the same side, until the straight line
// to the target is all land again. Hugging the shore is what gets an animal out of the bays
// between pond lobes; turning left and right on the spot just jitters there.
const TURN_MAGS = [0.6, 1.2, 1.9, 2.6];
const HUG = [-0.3, 0, 0.35, 0.7, 1.1, 1.6, 2.2, 2.8, 3.4];   // leaning into the shore first

function moveToward(w, c, tx, ty, v) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  const stepLen = Math.min(v, d);
  if (c.detour > 0) {
    const jumped = (tx - c.detourX) ** 2 + (ty - c.detourY) ** 2 > 4;   // a new goal; a mate drifting is not
    c.detourX = tx; c.detourY = ty;
    if (--c.detour === 0 || jumped || clearPath(w, c.x, c.y, tx, ty)) c.detour = 0;
  }
  const bias = c.turnBias || 1;
  let a, offs;
  if (c.detour) { a = c.heading; offs = HUG.map(o => o * bias); }
  else {
    a = Math.atan2(dy, dx); offs = [0];
    for (const m of TURN_MAGS) offs.push(bias * m, -bias * m);
  }
  for (const off of offs) {
    const nx = c.x + Math.cos(a + off) * stepLen, ny = c.y + Math.sin(a + off) * stepLen;
    if (!walkable(w, nx, ny)) continue;
    if (!c.detour && off !== 0) {
      c.turnBias = off > 0 ? 1 : -1;
      c.detour = 500; c.detourX = tx; c.detourY = ty;
    }
    c.x = nx; c.y = ny; c.heading = a + off; c.moved = stepLen;
    const cx = Math.cos(c.heading);
    if (Math.abs(cx) > 0.25) c.facing = cx > 0 ? 1 : -1;
    return d <= v;
  }
  c.target = null; c.detour = 0;   // boxed in: forget the target
  return false;
}

function wander(w, c, pace) {
  if (!c.target || c.timer-- <= 0 || (Math.abs(c.target.x - c.x) < 0.3 && Math.abs(c.target.y - c.y) < 0.3)) {
    let tx, ty, tries = 0;
    do {
      c.heading += 0.9 * w.rng.normal();
      const reach = w.rng.range(4, 11);
      tx = c.x + Math.cos(c.heading) * reach; ty = c.y + Math.sin(c.heading) * reach;
      if (!inBounds(tx, ty)) { c.heading += Math.PI; tx = clamp(tx, 2, W - 2); ty = clamp(ty, 2, H - 2); }
    } while (!clearPath(w, c.x, c.y, tx, ty) && ++tries < 8);
    c.target = clearPath(w, c.x, c.y, tx, ty) ? { x: tx, y: ty } : { x: c.x, y: c.y };
    c.timer = 200;
  }
  c.mode = 'wander';
  moveToward(w, c, c.target.x, c.target.y, c.walk * pace * kidPace(w, c));
}

const kidPace = (w, c) => 0.6 + 0.4 * growth(w, c);

// ---------------------------------------------------------------- love

function readyToMate(w, c) {
  return c.alive && !c.hidden && isAdult(w, c) && c.pregnantUntil === 0
    && w.tick >= c.cooldownUntil && c.energy >= c.sp.breedEnergy * c.maxEnergy
    && c.sp.breedSeasons.includes(seasonOf(w.tick))
    && w.count[c.species] + w.expecting[c.species] < c.sp.cap;
}

function seekLove(w, c) {
  if (!readyToMate(w, c)) { if (c.mode === 'love') c.mode = 'wander'; return false; }
  let partner = c.mode === 'love' ? w.byId.get(c.targetId) : null;
  if (partner && !readyToMate(w, partner)) partner = null;
  if (!partner && (w.tick + c.id) % 10 === 0) {
    // When a species is rare, the few left call louder: search the whole meadow.
    const range = w.count[c.species] < 30 ? 150 : c.sp.mateRange;
    partner = nearest(w, c, range, c.species, o => o.sex !== c.sex && readyToMate(w, o));
  }
  if (!partner) { if (c.mode === 'love') c.mode = 'wander'; return false; }
  c.mode = 'love'; c.targetId = partner.id;
  if (dist2(c, partner) < 1.2 * 1.2) { mate(w, c, partner); return true; }
  moveToward(w, c, partner.x, partner.y, c.walk * 1.2);
  return true;
}

function mate(w, a, b) {
  const mum = a.sex === 'F' ? a : b, dad = a.sex === 'F' ? b : a;
  mum.pregnantUntil = w.tick + mum.sp.gestationDays * TPD;
  mum.cooldownUntil = mum.pregnantUntil + mum.sp.cooldownDays * TPD;
  mum.dadGenes = dad.genes; mum.dadIdPending = dad.id; mum.dadGenPending = dad.gen;
  dad.cooldownUntil = w.tick + 0.4 * TPD;
  for (const c of [mum, dad]) { c.mode = 'wander'; c.target = null; c.targetId = 0; }
  note(w, mum, '💕', `Fell in love with ${dad.name}`);
  note(w, dad, '💕', `Fell in love with ${mum.name}`);
  emit(w, { type: 'love', a: mum, b: dad });
}

function giveBirth(w, mum) {
  const sp = mum.sp, r = w.rng;
  mum.pregnantUntil = 0;
  const well = mum.energy / mum.maxEnergy;
  let n = r.int(sp.litter[0], sp.litter[1]);
  if (well < 0.4) n = Math.max(1, n - 1);
  const dad = w.byId.get(mum.dadIdPending);
  const kids = [];
  for (let k = 0; k < n; k++) {
    let x = mum.x + r.range(-1, 1), y = mum.y + r.range(-1, 1);
    if (!walkable(w, x, y)) { x = mum.x; y = mum.y; }
    const kid = makeCreature(w, mum.species, x, y, childGenes(w, mum.genes, mum.dadGenes),
      { mum, dadId: mum.dadIdPending, dadGen: mum.dadGenPending });
    kid.home = mum.home || mum.burrow;
    if (mum.hidden) { kid.hidden = true; kid.burrow = mum.burrow; kid.sleeping = true; kid.mode = 'sleep'; kid.timer = 60; mum.burrow.count++; }
    note(w, kid, '🐣', `Born to ${mum.name}` + (dad ? ` and ${dad.name}` : ''));
    w.newborn.push(kid);
    w.byId.set(kid.id, kid);
    kids.push(kid);
  }
  mum.energy = Math.max(mum.energy - sp.birthCost * n, 1);
  mum.kids += n;
  if (dad) dad.kids += n;
  note(w, mum, '🍼', `Had ${n} ${n === 1 ? 'baby' : 'babies'}`);
  if (dad && dad.alive) note(w, dad, '🍼', `Became a dad to ${n} with ${mum.name}`);
  w.stats.births[mum.species] += n;
  emit(w, { type: 'birth', mum, dad, kids });
}

// ---------------------------------------------------------------- burrows

function enterBurrow(w, c, b, ticks, sleeping) {
  c.hidden = true; c.burrow = b; c.x = b.x; c.y = b.y;
  c.timer = ticks; c.sleeping = sleeping; c.mode = sleeping ? 'sleep' : 'hide';
  c.target = null; c.alert = 0;
  b.count++;
  if (sleeping) c.home = b;
}

function exitBurrow(w, c) {
  const b = c.burrow;
  b.count--;
  c.hidden = false; c.burrow = null; c.sleeping = false; c.mode = 'wander'; c.target = null;
  const a = w.rng.range(0, Math.PI * 2);
  const x = b.x + Math.cos(a) * 0.8, y = b.y + Math.sin(a) * 0.8;
  if (walkable(w, x, y)) { c.x = x; c.y = y; }
}

function burrowTick(w, c) {
  if (--c.timer > 0) return;
  const hungry = c.energy < 0.3 * c.maxEnergy;
  if (shelterTime(w) && !hungry) { c.timer = 30; c.sleeping = true; c.mode = 'sleep'; return; }
  if (w.burning.length && fireNear(w, c.x, c.y, 3)) { c.timer = 40; c.mode = 'hide'; return; }
  if (!hungry || c.energy < 0.12 * c.maxEnergy) {
    const fox = nearest(w, c, 6, 'fox');
    if (fox) { c.timer = 40; c.mode = 'hide'; return; }
  }
  if (c.sleeping && w.rng.next() < 0.6) { c.timer = w.rng.int(10, 60); return; }   // staggered waking
  exitBurrow(w, c);
}

// ---------------------------------------------------------------- rabbits

// Rabbits go home at night, and when it storms.
const shelterTime = w => isNight(w.tick) || w.weather.kind === 'storm';

function rabbitTick(w, c) {
  const t = w.tick;
  if (c.hidden) return burrowTick(w, c);
  const night = shelterTime(w);

  // 1. Danger. Grazing heads-down means a fox is not always noticed; a charging one is.
  // A close call leaves a rabbit jumpy for a while after, longer than the alarm itself lasts:
  // easier to spook, and off its food near wherever the fox was last seen.
  if (c.alert > 0) c.alert--;
  if (c.wary > 0) c.wary--;
  if ((t + c.id) % 2 === 0) {
    const fox = nearest(w, c, c.sight * sky(w).sight, 'fox');
    if (fox) {
      // A charging fox is seen quickly but not instantly: that beat is the pounce's window.
      const known = fox.id === c.threatId && c.alert > 0;
      const chance = fox.mode === 'chase' ? 0.12 + 0.2 * c.genes.eyes
        : (0.01 + 0.05 * c.genes.eyes) * (c.sleeping ? 0.3 : 1) * (night ? 0.5 : 1) * (c.wary > 0 ? 1.6 : 1)
          * (fox.id === c.nemesisId ? 2 : 1);   // the fox that nearly got it, it looks out for
      if (known || w.rng.next() < chance) {
        if (!known) spotted(w, c, fox);
        c.alert = 120; c.threatId = fox.id; c.wary = 900; c.waryX = fox.x; c.waryY = fox.y;
      }
    }
  }
  if (c.alert > 0) {
    const f = w.byId.get(c.threatId);
    const keep = c.mode === 'flee' ? 1.4 : 1;
    if (f && f.alive && dist2(c, f) < (c.fleeDist * keep) ** 2) {
      c.wary = 900; c.waryX = f.x; c.waryY = f.y;
      return flee(w, c, f);
    }
  }
  smellSmoke(w, c);
  if (c.fright > 0) { c.fright--; return flee(w, c, { id: 0, x: c.frightX, y: c.frightY }); }
  if (c.mode === 'flee') { c.mode = 'wander'; c.target = null; c.sleeping = false; }
  if (c.mode === 'alarm') { if (--c.timer > 0) return; c.mode = 'wander'; c.target = null; }

  // 2. Babies stay near mum.
  if (growth(w, c) < 0.5) {
    const mum = w.byId.get(c.mumId);
    if (mum && mum.alive) {
      if (mum.hidden && !night) { /* mum is inside: wait nearby */ }
      else if (mum.hidden) return goHome(w, c, mum.burrow);
      else if (dist2(c, mum) > 9) { c.mode = 'follow'; moveToward(w, c, mum.x, mum.y, c.walk * kidPace(w, c)); return; }
    }
  }

  // 3. Night: go home to sleep, unless hungry.
  const e = c.energy / c.maxEnergy;
  if (c.mode === 'sleep') {
    if (!night || e < 0.25) { c.sleeping = false; c.mode = 'wander'; } else return;
  }
  if (night && e > 0.3) {
    let b = c.home && Math.hypot(c.home.x - c.x, c.home.y - c.y) < 35 ? c.home : nearestBurrow(w, c.x, c.y, 35);
    if (b) return goHome(w, c, b);
    c.mode = 'sleep'; c.sleeping = true; return;
  }

  // 4. Love.
  if (seekLove(w, c)) return;

  // 5. Food.
  const satiation = seasonOf(t) === 2 ? 0.95 : 0.85;
  const i = idx(c.x, c.y);
  if (c.mode === 'graze') {
    if (w.grass[i] > 0.06 && e < 0.98) { eat(w, c, i); return; }
    c.mode = 'wander'; c.target = null;
  }
  if (e < satiation) {
    const skittish = c.wary > 0 && e > 0.4 && (c.x - c.waryX) ** 2 + (c.y - c.waryY) ** 2 < 36;
    if (w.grass[i] > 0.3 && !skittish) { c.mode = 'graze'; eat(w, c, i); return; }
    if (c.mode !== 'food' || !c.target || (t + c.id) % 20 === 0) {
      const spot = findFood(w, c);
      if (spot) { c.mode = 'food'; c.target = spot; }
    }
    if (c.mode === 'food' && c.target) {
      if (moveToward(w, c, c.target.x, c.target.y, c.walk * kidPace(w, c))) {
        c.mode = w.grass[idx(c.x, c.y)] > 0.12 ? 'graze' : 'wander';
        c.target = null;
      }
      return;
    }
    return wander(w, c, 1.0);   // nothing in sight: go looking
  }

  // 6. Fed and safe: sit, find friends, or amble.
  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; c.target = null; }
  if ((t + c.id) % 30 === 0) {
    if (w.rng.next() < c.genes.friendly) {
      let sx = 0, sy = 0, n = 0;
      forEachNear(w, c.x, c.y, c.sight, o => { if (o !== c) { sx += o.x; sy += o.y; n++; } }, 'rabbit');
      if (n > 0) {
        sx /= n; sy /= n;
        if ((sx - c.x) ** 2 + (sy - c.y) ** 2 > 9 && clearPath(w, c.x, c.y, sx, sy)) { c.mode = 'friends'; c.target = { x: sx, y: sy }; }
      }
    } else if (w.rng.next() < 0.4) { c.mode = 'rest'; c.timer = w.rng.int(60, 200); return; }
  }
  if (c.mode === 'friends' && c.target) {
    if (moveToward(w, c, c.target.x, c.target.y, c.walk * 0.7)) { c.mode = 'rest'; c.timer = w.rng.int(40, 150); }
    return;
  }
  wander(w, c, 0.5);
}

function goHome(w, c, b) {
  c.mode = 'home';
  if (moveToward(w, c, b.x, b.y, c.walk * kidPace(w, c))) enterBurrow(w, c, b, 30, true);
}

function eat(w, c, i) {
  const bite = Math.min(w.grass[i], BITE);
  w.grass[i] -= bite;
  c.energy = Math.min(c.maxEnergy, c.energy + bite * GRASS_ENERGY);
}

function findFood(w, c) {
  let best = null, bestScore = 0.15;
  for (let k = 0; k < 14; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(1, c.sight);
    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (!clearPath(w, c.x, c.y, x, y)) continue;   // grass across the pond doesn't count
    const score = w.grass[idx(x, y)] / (1 + 0.1 * r);
    if (score > bestScore) { bestScore = score; best = { x: (x | 0) + 0.5, y: (y | 0) + 0.5 }; }
  }
  return best;
}

// A fox seen before it is close: sit up, thump, stare it down. A stalking fox that has been
// seen mostly gives up, the surprise is gone; a starving one charges anyway.
function spotted(w, c, fox) {
  if (fox.id === c.nemesisId && c.wary <= 0) note(w, c, '😨', `${fox.name} is back`);
  if (dist2(c, fox) < c.fleeDist ** 2) return;          // too close to stand about: run instead
  c.mode = 'alarm'; c.timer = 40; c.sleeping = false; c.target = null;
  thump(w, c, fox);
  if (fox.targetId !== c.id || fox.mode !== 'stalk') return;
  if (fox.energy < 0.3 * fox.maxEnergy) { fox.mode = 'chase'; fox.chaseT = 0; return; }
  fox.targetId = 0; fox.mode = 'wander'; fox.target = null;
  missed(fox);
  note(w, c, '‼️', `Spotted ${fox.name} sneaking up`);
  note(w, fox, '👀', `${c.name} saw me coming`);
  emit(w, { type: 'spotted', rabbit: c, fox });
}

// Thump! Rabbits nearby look up, and know which fox it is.
function thump(w, c, fox) {
  forEachNear(w, c.x, c.y, 6, o => {
    if (o === c || o.alert > 0) return;
    o.alert = 80; o.threatId = fox.id; o.sleeping = false;
    if (o.mode !== 'flee') { o.mode = 'alarm'; o.timer = w.rng.int(15, 40); o.target = null; }
  }, 'rabbit');
}

// Runs from a fox, or from anything with an x and a y (thunder, fire).
function flee(w, c, fox) {
  if (c.mode !== 'flee') {
    c.mode = 'flee'; c.sleeping = false; c.threatId = fox.id;
    c.refuge = pickRefuge(w, c, fox);
    if (fox.id) thump(w, c, fox);
  }
  let tx, ty;
  const b = c.refuge;
  if (b) {
    tx = b.x; ty = b.y;
    if ((b.x - c.x) ** 2 + (b.y - c.y) ** 2 < 0.8) {
      enterBurrow(w, c, b, w.rng.int(150, 350), false);
      return;
    }
  } else {
    // Straight away from the fox, or as close to that as the ponds allow.
    const a = Math.atan2(c.y - fox.y, c.x - fox.x), b = c.turnBias || 1;
    for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      tx = c.x + Math.cos(a + off * b) * 6; ty = c.y + Math.sin(a + off * b) * 6;
      if (clearPath(w, c.x, c.y, tx, ty)) break;
    }
  }
  const sprinting = c.stamina > 0;
  moveToward(w, c, tx, ty, (sprinting ? c.sprint : c.walk) * kidPace(w, c));
  if (sprinting) { c.stamina -= 1 / 220; c.sprinting = true; }
}

function pickRefuge(w, c, fox) {
  const fx = fox.x - c.x, fy = fox.y - c.y, fd = Math.hypot(fx, fy) || 1;
  let best = null, bd = 8 * 8;
  for (const b of w.burrows) {
    const bx = b.x - c.x, by = b.y - c.y, d2 = bx * bx + by * by;
    if (d2 >= bd || !clearPath(w, c.x, c.y, b.x, b.y)) continue;
    const bdl = Math.sqrt(d2) || 1;
    const towardFox = (bx * fx + by * fy) / (bdl * fd);
    if (bdl < 2.5 || towardFox < 0.3) { best = b; bd = d2; }
  }
  return best;
}

// ---------------------------------------------------------------- foxes

function foxTick(w, c) {
  const t = w.tick, night = isNight(t), ph = phaseOf(t);
  const e = c.energy / c.maxEnergy;
  c.sleeping = false;

  smellSmoke(w, c);
  if (c.fright > 0) {
    c.fright--; c.mode = 'flee'; c.targetId = 0;
    const a = Math.atan2(c.y - c.frightY, c.x - c.frightX);
    moveToward(w, c, c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6, c.stamina > 0 ? c.sprint : c.walk);
    if (c.stamina > 0) { c.stamina -= 1 / 300; c.sprinting = true; }
    return;
  }
  if (c.mode === 'eat') { if (--c.timer <= 0) { c.mode = 'rest'; c.timer = 60; } return; }
  if (c.mode === 'tired') { if (c.stamina > 0.6) c.mode = 'wander'; return; }
  if (c.mode === 'sleep') {
    if (e < 0.6 || ph > 0.62) c.mode = 'wander';
    else { c.sleeping = true; return; }
  }

  const young = growth(w, c) < 0.5;
  if (young) {
    const mum = w.byId.get(c.mumId);
    if (mum && mum.alive && dist2(c, mum) > 16) {
      c.mode = 'follow'; moveToward(w, c, mum.x, mum.y, c.walk * kidPace(w, c)); return;
    }
  }

  // Foxes nap through the middle of the day when fed, longer in a heatwave. Storms they sit out.
  const napAt = w.weather.kind === 'heat' ? 0.6 : 0.8;
  if (!night && ph > 0.1 && ph < 0.6 && e > napAt && !young) { c.mode = 'sleep'; c.sleeping = true; return; }
  if (w.weather.kind === 'storm' && e > 0.45) { c.mode = 'shelter'; c.sleeping = true; return; }

  if (seekLove(w, c)) return;

  if (e < 0.75 && growth(w, c) > 0.3 && hunt(w, c)) return;

  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; }
  // Hungry, nothing in sight: back to where the last catch was. Arriving to nobody is a miss.
  if (e < 0.75 && c.haunt) {
    if (dist2(c, c.haunt) > 16) { c.mode = 'prowl'; moveToward(w, c, c.haunt.x, c.haunt.y, c.walk * 0.8); return; }
    if (c.mode === 'prowl') missed(c);
  }
  wander(w, c, 0.8);
}

function hunt(w, c) {
  let prey = c.targetId ? w.byId.get(c.targetId) : null;
  if (prey && prey.species !== 'rabbit') prey = null;
  const sight = c.sight * sky(w).sight;
  if (prey && (!prey.alive || prey.hidden || dist2(c, prey) > (sight * 1.3) ** 2)) {
    if (prey.alive && c.mode === 'chase') escaped(w, prey, c, prey.hidden ? 'burrow' : 'outran');
    prey = null; c.targetId = 0; c.mode = 'wander';
  }
  // Foxes don't swim. A rabbit across the water is out of reach, and one that gets water
  // between itself and the fox mid-chase has got away.
  if (prey && (w.tick + c.id) % 5 === 0 && !clearPath(w, c.x, c.y, prey.x, prey.y)) {
    if (c.mode === 'chase') escaped(w, prey, c, 'pond');
    prey = null; c.targetId = 0; c.mode = 'wander';
  }
  if (!prey && (w.tick + c.id) % 5 === 0) {
    // Only a rabbit that isn't already watching this fox is worth sneaking up on.
    prey = nearest(w, c, sight, 'rabbit', o => !(o.alert > 0 && o.threatId === c.id) && clearPath(w, c.x, c.y, o.x, o.y));
    if (prey) { c.targetId = prey.id; c.mode = 'stalk'; }
  }
  if (!prey) return false;

  const d = Math.sqrt(dist2(c, prey));
  if (c.mode === 'stalk') {
    if (d < c.pounce || prey.mode === 'flee') { c.mode = 'chase'; c.chaseT = 0; }
    else { moveToward(w, c, prey.x, prey.y, c.walk * 0.9); return true; }
  }
  if (d < 0.9) { catchPrey(w, c, prey); return true; }
  if (c.stamina <= 0) {
    c.mode = 'tired'; c.targetId = 0;
    escaped(w, prey, c, 'outran');
    return true;
  }
  const leap = c.chaseT++ < 30 ? 1.5 : 1;          // the pounce: a short burst, then a run
  moveToward(w, c, prey.x, prey.y, c.sprint * leap * kidPace(w, c));
  c.stamina -= 1 / 150; c.sprinting = true;
  return true;
}

function escaped(w, rabbit, fox, how) {
  rabbit.escapes++;
  rabbit.nemesisId = fox.id;   // it won't forget this one
  missed(fox);
  note(w, rabbit, '💨', how === 'burrow' ? `Dived into a burrow to escape ${fox.name}`
    : how === 'pond' ? `Got away from ${fox.name} across the pond` : `Outran ${fox.name}`);
  note(w, fox, '😤', `${rabbit.name} got away`);
  emit(w, { type: 'escape', rabbit, fox, how });
}

// A hunt that came to nothing. Three of those and the old hunting ground is forgotten.
function missed(fox) {
  if (fox.haunt && --fox.haunt.n <= 0) fox.haunt = null;
}

function catchPrey(w, fox, rabbit) {
  const gain = (40 + 0.4 * rabbit.energy) * (0.4 + 0.6 * growth(w, rabbit));
  fox.energy = Math.min(fox.maxEnergy, fox.energy + gain);
  fox.kills++;
  fox.mode = 'eat'; fox.timer = 80; fox.targetId = 0;
  fox.haunt = { x: rabbit.x, y: rabbit.y, n: 3 };   // good hunting here; worth a few more tries
  note(w, fox, '🍖', `Caught ${rabbit.name}`);
  // Share with own young cubs nearby.
  forEachNear(w, fox.x, fox.y, 8, o => {
    if (o.mumId === fox.id && growth(w, o) < 0.6) o.energy = Math.min(o.maxEnergy, o.energy + 30);
  }, 'fox');
  die(w, rabbit, 'fox', fox);
}

// ---------------------------------------------------------------- life and death

function die(w, c, cause, killer) {
  if (!c.alive) return;
  c.alive = false; c.died = w.tick; c.cause = cause;
  c.killerId = killer ? killer.id : 0;
  if (c.hidden && c.burrow) c.burrow.count--;
  c.hidden = false;
  const age = Math.floor(ageDays(w, c));
  const text = cause === 'fox' ? `Caught by ${killer.name}` :
    cause === 'hunger' ? (seasonOf(w.tick) === 3 ? 'Starved in the winter' : 'Starved') :
    cause === 'lightning' ? 'Struck by lightning' :
    cause === 'fire' ? 'Caught in a wildfire' :
    `Died of old age, ${age} days old`;
  note(w, c, { fox: '🦊', hunger: '🥀', lightning: '⚡', fire: '🔥' }[cause] || '🌙', text);
  w.stats.deaths[c.species][cause] = (w.stats.deaths[c.species][cause] || 0) + 1;
  w.anyDied = true;
  emit(w, { type: 'death', c, cause, killer });
}

function lifeTick(w, c) {
  const g = growth(w, c);
  let b = c.burnRate * (0.5 + 0.5 * g);
  if (c.sleeping) b *= 0.6;
  if (c.pregnantUntil) b *= 1.25;
  const kind = w.weather.kind;
  if (kind === 'snow' && !c.hidden) b *= 1 + 0.5 * (1 - c.genes.size);   // small bodies feel the cold
  b += MOVE_COST * c.moved * c.moved / c.sp.walk * (kind === 'heat' ? 1.5 : 1);
  c.energy -= b;
  if (!c.sprinting) c.stamina = Math.min(1, c.stamina + (c.sleeping || c.mode === 'tired' ? 1 / 150 : 1 / 400));
  c.sprinting = false;
  c.moved = 0;

  if (c.energy <= 0) return die(w, c, 'hunger');
  if (w.tick - c.born > c.lifespan) return die(w, c, 'age');
  if (c.pregnantUntil && w.tick >= c.pregnantUntil) giveBirth(w, c);
}

// ---------------------------------------------------------------- the world

function createWorld(seed, opts = {}) {
  const w = {
    seed, rng: makeRng(seed), tick: Math.floor(TPD * 0.04),
    nextId: 1, creatures: [], newborn: [], byId: new Map(), events: [],
    grid: makeGrid(), grids: { rabbit: makeGrid(), fox: makeGrid() },
    nameCounts: new Map(), anyDied: false,
    weather: { kind: 'clear', until: 0 }, skyLocked: false, wet: 0.3, snow: 0,
    fire: new Float32Array(W * H), ash: new Float32Array(W * H), burning: [], blaze: 0,
    count: { rabbit: 0, fox: 0 }, expecting: { rabbit: 0, fox: 0 },
    stats: { births: { rabbit: 0, fox: 0 }, deaths: { rabbit: {}, fox: {} } },
    history: { every: 60, t: [], rabbit: [], fox: [], grass: [], traits: { rabbit: [], fox: [] }, marks: [] },
    goneSince: { rabbit: -1, fox: -1 },
    options: { migration: true, ...opts },
  };
  makeTerrain(w);
  const n = { rabbit: opts.rabbits ?? 40, fox: opts.foxes ?? 4 };
  for (const species of ['rabbit', 'fox']) {
    for (let k = 0; k < n[species]; k++) {
      let x, y;
      do { x = w.rng.range(4, W - 4); y = w.rng.range(4, H - 4); } while (!walkable(w, x, y));
      addCreature(w, species, x, y, { sex: k % 2 ? 'M' : 'F', age: w.rng.range(4, 10) });
    }
  }
  w.founderMeans = { rabbit: null, fox: null };
  flushNewborn(w);
  for (const s of ['rabbit', 'fox']) w.founderMeans[s] = traitMeans(w, s);
  w.weather.until = w.tick + w.rng.range(0.3, 0.8) * TPD;
  record(w);
  return w;
}

function flushNewborn(w) {
  for (const k of w.newborn) w.creatures.push(k);
  w.newborn.length = 0;
  w.count.rabbit = w.count.fox = w.expecting.rabbit = w.expecting.fox = 0;
  for (const c of w.creatures) {
    if (!c.alive) continue;
    w.count[c.species]++;
    if (c.pregnantUntil) w.expecting[c.species] += (c.sp.litter[0] + c.sp.litter[1]) / 2;
  }
}

function traitMeans(w, species) {
  const m = {}; let n = 0;
  for (const k of GENES) m[k] = 0;
  for (const c of w.creatures) {
    if (!c.alive || c.species !== species) continue;
    for (const k of GENES) m[k] += c.genes[k];
    n++;
  }
  if (!n) return null;
  for (const k of GENES) m[k] /= n;
  return m;
}

// How full the meadow is: 1 when every tile holds all the grass its soil allows.
function grassFullness(w) {
  let g = 0, f = 0;
  for (let i = 0; i < W * H; i++) { g += w.grass[i]; f += w.fert[i]; }
  return f ? g / f : 0;
}

// The whole story is kept. When it gets long, every other sample goes and sampling slows down.
const HISTORY_MAX = 4000;
function record(w) {
  const h = w.history;
  h.t.push(w.tick);
  h.rabbit.push(w.count.rabbit);
  h.fox.push(w.count.fox);
  h.grass.push(grassFullness(w));
  for (const s of ['rabbit', 'fox']) h.traits[s].push(traitMeans(w, s));
  if (h.t.length > HISTORY_MAX) {
    const half = a => a.filter((_, i) => i % 2 === 0);
    for (const k of ['t', 'rabbit', 'fox', 'grass']) h[k] = half(h[k]);
    for (const s of ['rabbit', 'fox']) h.traits[s] = half(h.traits[s]);
    h.every *= 2;
  }
}

function newDay(w) {
  const d = dayOf(w.tick);
  if (d % SEASON_DAYS === 0) {
    const s = seasonOf(w.tick);
    emit(w, { type: 'season', season: s, year: yearOf(w.tick) });
    if (!w.skyLocked && !WEATHER_ODDS[s][w.weather.kind]) pickWeather(w);      // no snow in spring
    if (s === 0) {
      for (const c of w.creatures) {
        if (c.alive && c.born < w.tick - SEASON_DAYS * TPD) note(w, c, '🌸', 'Made it through the winter');
      }
    }
  }
  // A tree struck by lightning grows back from its stump in about a year.
  for (const d of w.decor) if (d.stump && w.tick - d.stump > YEAR_DAYS * TPD) d.stump = 0;
}

function migrate(w) {
  if (!w.options.migration) return;
  const wait = { rabbit: 1, fox: 3 }, arrive = { rabbit: 6, fox: 2 }, few = { rabbit: 4, fox: 1 };
  for (const s of ['rabbit', 'fox']) {
    if (w.count[s] >= few[s]) { w.goneSince[s] = -1; continue; }
    if (w.goneSince[s] < 0) { w.goneSince[s] = w.tick; if (w.count[s] === 0) emit(w, { type: 'extinct', species: s }); continue; }
    if (w.tick - w.goneSince[s] < wait[s] * TPD) continue;
    if (s === 'fox' && w.count.rabbit < 60) continue;   // foxes only come where there is food
    const side = w.rng.int(0, 3);
    const kids = [];
    for (let k = 0; k < arrive[s]; k++) {
      let x, y, tries = 0;
      do {
        const u = w.rng.range(4, (side % 2 ? H : W) - 4);
        [x, y] = side === 0 ? [u, 2] : side === 1 ? [W - 2, u] : side === 2 ? [u, H - 2] : [2, u];
      } while (!walkable(w, x, y) && ++tries < 50);
      const c = addCreature(w, s, x, y, { sex: k % 2 ? 'M' : 'F', age: SPECIES[s].matureDays + 1, arrived: true });
      if (c) kids.push(c);
    }
    w.goneSince[s] = -1;
    emit(w, { type: 'arrive', species: s, who: kids });
  }
}

function step(w) {
  const t = ++w.tick;
  if (t % TPD === 0) newDay(w);
  buildGrid(w);
  weatherTick(w);
  if (t % 4 === 0) { growGrass(w, 4); fireTick(w, 4); }
  const list = w.creatures;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c.alive) continue;
    if (c.species === 'rabbit') rabbitTick(w, c); else foxTick(w, c);
    if (c.alive) lifeTick(w, c);
  }
  if (w.anyDied) { w.creatures = w.creatures.filter(c => c.alive); w.anyDied = false; }
  flushNewborn(w);
  if (t % w.history.every === 0) record(w);
  if (t % (TPD / 4) === 0) migrate(w);
  if (t % TPD === 0) forgetTheLongDead(w);
}

function forgetTheLongDead(w) {
  // Keep the dead for a few in-game years so family links still resolve, then let go.
  const horizon = w.tick - 3 * YEAR_DAYS * TPD;
  for (const [id, c] of w.byId) if (!c.alive && c.died < horizon) w.byId.delete(id);
}

// ---------------------------------------------------------------- player powers

function paintGrass(w, x, y, radius) {
  const s = SEASONS[seasonOf(w.tick)];
  for (let yy = Math.floor(y - radius); yy <= y + radius; yy++) {
    for (let xx = Math.floor(x - radius); xx <= x + radius; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      if (w.water[i] || (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > radius * radius) continue;
      w.grass[i] = Math.max(w.grass[i], w.fert[i] * Math.max(s.cap, 0.8));
    }
  }
}

// The player picks the weather: it lasts about a day (storms burn out sooner).
function setSky(w, kind) {
  setWeather(w, kind, (kind === 'storm' ? 0.5 : 1) * TPD, true);
  w.history.marks.push({ t: w.tick, type: 'sky', kind });
}

// A locked sky keeps whatever weather it has until it is unlocked.
function lockSky(w, on) { w.skyLocked = on; }

function zap(w, x, y) { if (walkable(w, x, y)) strike(w, x, y); }

// ---------------------------------------------------------------- reading an animal

function mood(w, c) {
  if (!c.alive) return { emoji: '👻', text: c.story[c.story.length - 1].text };
  const other = w.byId.get(c.targetId) || w.byId.get(c.threatId);
  const e = c.energy / c.maxEnergy;
  const storm = w.weather.kind === 'storm' && !isNight(w.tick);
  switch (c.mode) {
    case 'flee':
      if (c.fright > 0) return c.frightWhat === 'fire' ? { emoji: '🔥', text: 'Running from the fire!' }
        : { emoji: '⚡', text: 'Spooked by thunder!' };
      return { emoji: '😱', text: `Running from ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'alarm': return { emoji: '‼️', text: `Spotted ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'hide': return { emoji: '🫣', text: 'Hiding in a burrow' };
    case 'sleep': return { emoji: '💤', text: c.hidden ? (storm ? 'Snug in the burrow, out of the storm' : 'Asleep in the burrow') : 'Napping' };
    case 'home': return { emoji: '🏠', text: storm ? 'Hurrying home out of the storm' : 'Heading home for the night' };
    case 'shelter': return { emoji: '🌧️', text: 'Curled up, waiting out the storm' };
    case 'love': return { emoji: '💕', text: other ? `Courting ${other.name}` : 'Looking for love' };
    case 'graze': return { emoji: '😋', text: 'Munching grass' };
    case 'food': return { emoji: '🌿', text: 'Off to find better grass' };
    case 'prowl': return { emoji: '🐾', text: 'Back to good hunting ground' };
    case 'stalk': return { emoji: '👀', text: other ? `Sneaking up on ${other.name}` : 'Sneaking' };
    case 'chase': return { emoji: '💨', text: other ? `Chasing ${other.name}!` : 'Chasing!' };
    case 'eat': return { emoji: '🍖', text: 'Eating' };
    case 'tired': return { emoji: '😮‍💨', text: 'Out of breath' };
    case 'follow': return { emoji: '🍼', text: 'Following mum' };
    case 'friends': return { emoji: '🤝', text: 'Joining friends' };
    case 'rest': return { emoji: '😌', text: 'Relaxing' };
    default:
      if (e < 0.3) return { emoji: '🥺', text: 'Hungry, searching' };
      return { emoji: '', text: 'Exploring' };
  }
}

const api = {
  W, H, TPD, SEASON_DAYS, YEAR_DAYS, SEASONS, SPECIES, GENES, WEATHER,
  createWorld, step, clock, isNight, phaseOf, seasonOf, mood, ageDays, growth, isAdult,
  addCreature, paintGrass, setSky, lockSky, zap, traitMeans, walkable,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
