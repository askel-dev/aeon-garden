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

const W = 150, H = 100;         // map size in tiles
const ROOM_TILES = 9000;        // dry tiles the numbers below were tuned for; bigger meadows hold more
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

const GENES = ['speed', 'size', 'eyes', 'bravery', 'friendly'];
const RABBIT_GENES = [...GENES, 'moult'];   // moult: how white the coat turns for winter
const genesOf = species => (species === 'rabbit' ? RABBIT_GENES : GENES);

// Rabbit coats: two genes, each a pair of letters, one from each parent. A capital letter wins.
//   A wild (speckled brown) over a solid (black);  D full colour over d pale.
// So 'AaDD' looks wild brown but can pass on black. Foxes keep a simple sliding `fur` shade.
const COATS = {
  wild: { name: 'wild brown', rgb: [150, 114, 80] }, black: { name: 'black', rgb: [62, 56, 56] },
  sand: { name: 'sandy', rgb: [212, 178, 128] }, blue: { name: 'blue-grey', rgb: [128, 134, 150] },
};
const COAT_RARE = 0.3;          // founders: how often each recessive letter turns up
const COAT_FLIP = 0.002;        // per letter per birth: a new colour now and then
const WINTER_COAT = [236, 236, 230];
const MOULT_START = 0.5;        // founders: about half turn white in their first winter
const MOULT_WARM = 0.3;         // a white winter coat is a thick one: this much less burnt while snow lies
const MOULT_FROM = 0.3, MOULT_TO = 0.7;   // below this moult gene a coat stays; above, it turns fully white

const SPECIES = {
  rabbit: {
    key: 'rabbit', name: 'Rabbit', plural: 'Rabbits', emoji: '🐇',
    maxEnergy: 100, burn: 0.035, walk: 0.06, sprint: 0.155, sight: 10, mateRange: 24, wade: 0.45,
    matureDays: 4, lifeDays: 22, gestationDays: 1.5, litter: [2, 5], cooldownDays: 1.0,
    breedSeasons: [0, 1], breedEnergy: 0.55, birthCost: 10, cap: 200,
  },
  fox: {
    key: 'fox', name: 'Fox', plural: 'Foxes', emoji: '🦊',
    maxEnergy: 220, burn: 0.035, walk: 0.07, sprint: 0.21, sight: 18, mateRange: 45, wade: 0.6,
    matureDays: 8, lifeDays: 40, gestationDays: 2.5, litter: [2, 4], cooldownDays: 8,
    breedSeasons: [0, 1], breedEnergy: 0.65, birthCost: 25, cap: 60,
  },
  bee: {
    key: 'bee', name: 'Bee', plural: 'Bees', emoji: '🐝',
    maxEnergy: 30, burn: 0.02, walk: 0.2, sprint: 0.3, sight: 15, wade: 1, flies: true,
    matureDays: 1, lifeDays: 3, winterLifeDays: 10,   // summer bees wear out fast; autumn-born ones last the winter
    breedSeasons: [0, 1, 2], cap: 150,                // the queen lays (see hivesTick), no pairing up
  },
};
const KINDS = Object.keys(SPECIES);                        // 'rabbit', 'fox', 'bee'
const perKind = make => Object.fromEntries(KINDS.map(s => [s, make(s)]));   // { rabbit: .., fox: .., bee: .. }

const NAME_PARTS = {
  rabbit: {
    prefixes: ['Cott', 'Snow', 'Bramb', 'Wil', 'Truf', 'Hazel', 'Ac', 'Peb', 'Dan', 'Tans'],
    suffixes: ['tail', 'drop', 'le', 'low', 'flee', 'nut', 'orn', 'ble', 'delion', 'sy', 'foot', 'paws']
  },
  fox: {
    prefixes: ['Rus', 'Em', 'Scar', 'Cin', 'Fen', 'Marm', 'Ash', 'Kin', 'Am', 'Vix'],
    suffixes: ['ty', 'ber', 'let', 'der', 'nec', 'alade', 'ley', 'dle', 'ber', 'en', 'flame', 'spark']
  },
  bee: {
    prefixes: ['Buzz', 'Honey', 'Nectar', 'Pollen', 'Sting', 'Hive', 'Clover', 'Amber', 'Comb', 'Flower'],
    suffixes: ['bee', 'buzz', 'sting', 'hive', 'nectar', 'pollen', 'wing', 'comb', 'dew', 'flower', 'le', 'by', 'wick', 'ly', 'ina', 'drop', 'kin', 'ette', 'o']
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
const lerp = (a, b, t) => a + (b - a) * t;
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
//
// The ground has a height, and water lies wherever the ground is below the water level, so
// a wetter or drier season only has to move one number. Shallow water can be waded, slowly;
// deep water can't be crossed. Every meadow gets a river, a lake or both, and a few small
// ponds of its own, well away from the rest.

const SHALLOW = 1, DEEP = 2;       // w.water, per tile. 0 is dry land

// Every number that shapes a meadow, one per line. The terrain lab (index.html?lab) has a slider
// for each, and its "Copy as code" gives this block back with your changes, to paste over it.
// One meadow can override any of them: createWorld(seed, { terrain: { hillSize: 40 } }).
// Pairs are a range: each lake, pond or wood picks somewhere in between.
const TERRAIN = {
  hillSize: 28,                // tiles across a hill: bigger is broader and gentler
  hillDetail: 0.5,             // how much the smaller bumps show on the big hills
  hillFloor: 0.3,              // hill height where the hills give way to the low meadows
  hillRise: 1.2,               // how steeply the ground climbs with the hills
  lowGround: 0.08,             // how high the low meadows sit above the water, away from the river
  lowSlope: 0.25,              // how much of the hills' rise and fall the low meadows keep
  valley: 22,                  // tiles over which the land slopes down to the river or lake
  bank: 0.05,                  // how fast the ground rises away from the water, per tile
  level: 0,                    // the water line: higher floods the low meadows, lower drains them
  springFlood: 0.035,          // how far the water rises in spring
  summerLow: 0.03,             // and how far it drops in summer
  rainRise: 0.03,              // how much a soaked meadow adds to it (a dry one takes it away)
  deepAt: 0.3,                 // water at least this deep can't be waded
  layouts: { valley: 2, river: 1, lake: 1 },   // odds of each: a river through a lake, a river, a lake
  lakeEdge: 0.4,               // odds a lake lies by the edge of the meadow, running off it (else in a hollow)
  lakeBlobs: 6,                // circles a lake is made of
  lakeSpread: 13,              // how far they stray from its middle
  lakeSize: [6, 11],           // each circle's radius
  lakeDepth: 1,
  riverBends: 16,              // tiles between the river's big bends
  riverSway: 8,                // how far a bend swings sideways
  meander: 6,                  // the small wiggles on top of the bends
  meanderLength: 40,           // how drawn out the wiggles are
  riverWidth: [1.3, 2.5],      // half its width where it comes in, and where it leaves
  riverDepth: 0.9,
  brooks: 0.6,                 // odds a brook runs into the river
  brookWidth: [0.7, 1.2],      // its half width where it comes in, and where it joins the river
  brookDepth: 0.26,            // shallow enough to wade, except when the spring flood is in
  fords: [2, 3],               // stretches of river shallow enough to wade across
  fordDepth: 0.18,             // how deep a ford is in its middle
  fordLength: 14,
  ponds: [2, 4],
  pondSize: [2, 4],            // radius of each of a pond's four circles
  pondDepth: [0.25, 0.8],
  patches: 36,                 // fertile and poor patches of soil
  patchSize: [7, 20],
  patchRichness: [-0.45, 0.6], // from poor to rich
  wetBanks: 0.35,              // how much richer the soil is by the water
  forests: [['hills'], ['edge'], ['bank'], ['hills', 'bank'], ['edge', 'bank'], ['hills', 'edge']],   // one is picked
  hillWoods: 0.14,             // share of the highest ground that is wooded
  edgeWoods: [12, 18],         // how far a big wood along one side reaches in
  bankWoods: [22, 30],         // how far a wet wood stretches along the water
  treeSpacing: 2.3,            // tiles between trees where a wood is thick
  treeSize: [2.7, 5.2],        // smallest to biggest tree; most are small, a few are giants
  groves: 4,                   // small clumps of trees out in the meadow
  rocks: 22,
  flowers: 0.07,               // share of tiles with a flower or a tuft
  fields: [3, 5],              // flower fields, where the bees go
  fieldSize: [3, 6],           // radius of each of a field's circles
  fieldSpread: 5,              // how far a field's circles stray from its middle
  fieldFlowers: 0.45,          // share of a field's tiles with a flower
  fieldSoil: 0.25,             // how much richer the soil is in a field
  fieldGather: 60,             // the first three fields lie this close together, so one hive can reach all three
};

const idx = (x, y) => (y | 0) * W + (x | 0);
const inBounds = (x, y) => x >= 0.5 && y >= 0.5 && x < W - 0.5 && y < H - 0.5;
const isWater = (w, x, y) => w.water[idx(x, y)] > 0;
const walkable = (w, x, y) => inBounds(x, y) && w.water[idx(x, y)] !== DEEP;
const dry = (w, x, y) => inBounds(x, y) && !w.water[idx(x, y)];

const WATER_NAMES = {
  first: ['Willow', 'Heron', 'Otter', 'Alder', 'Mill', 'Reed', 'Kingfisher', 'Moss', 'Silver',
    'Bramble', 'Mirror', 'Moon', 'Lily', 'Newt', 'Mallow', 'Duck', 'Hazel', 'Frog'],
  river: ['Brook', 'Beck', 'River', 'Stream'], lake: ['Mere', 'Lake', 'Water'], pond: ['Pond', 'Pool'],
  brook: ['Brook', 'Beck', 'Burn', 'Rill'],
};

// Each flower field is one kind, blooming in its season: its flowers, its name, and the tint
// it gives the ground while in bloom (game.js paints it too).
const FIELD_KINDS = [
  { season: 0, emoji: ['🌷', '🌷', '🌷', '🌸'], names: ['Tulip'], tint: [226, 150, 170] },
  { season: 0, emoji: ['🪻'], names: ['Bluebell', 'Hyacinth'], tint: [160, 150, 214] },
  { season: 1, emoji: ['🌻'], names: ['Sunflower'], tint: [230, 200, 80] },
  { season: 1, emoji: ['🌼', '🌼', '🌼', '🌻'], names: ['Buttercup', 'Daisy'], tint: [232, 218, 120] },
  { season: 2, emoji: ['🪻', '🪻', '🌸'], names: ['Heather', 'Aster'], tint: [200, 130, 176] },   // the last food before winter
];
const FIELD_PLACES = ['Field', 'Meadow', 'Bank', 'Patch'];

// Smooth random hills: value noise in three layers, each finer and fainter by `detail`. About 0 to 1.
function makeNoise(r) {
  const cells = Float32Array.from({ length: 64 * 64 }, () => r.next());
  const at = (x, y) => cells[(y & 63) * 64 + (x & 63)];
  const one = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), u = x - x0, v = y - y0;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * su;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * su;
    return top + (bot - top) * sv;
  };
  return (x, y, detail = 0.5) => {
    const a = 4, b = 4 * detail, c = 4 * detail * detail;
    return (a * one(x, y) + b * one(2 * x + 17.3, 2 * y + 5.1) + c * one(4 * x + 3.7, 4 * y + 41.9)) / (a + b + c);
  };
}

// A few overlapping circles read as a lake or a pond, not as a disc.
const blobs = (r, cx, cy, n, spread, rMin, rMax) => Array.from({ length: n },
  () => ({ x: cx + r.range(-spread, spread), y: cy + r.range(-spread, spread) * 0.7, r: r.range(rMin, rMax) }));
function outside(shape, x, y) {    // tiles from the shape's edge; negative inside it
  let d = Infinity;
  for (const c of shape) d = Math.min(d, Math.hypot(x - c.x, y - c.y) - c.r);
  return d;
}

// The lake: in a hollow of the hills (the lowest of a few spots), or by the edge of the
// meadow, running off it. `side` says which edge.
function placeLake(r, T, hills) {
  if (r.next() < T.lakeEdge) {
    const side = r.pick(['w', 'e', 'n', 's']), off = r.range(2, 10);   // its middle just inside the edge
    return {
      side,
      x: side === 'w' ? off : side === 'e' ? W - off : r.range(30, W - 30),
      y: side === 'n' ? off : side === 's' ? H - off : r.range(25, H - 25),
    };
  }
  let best = null;
  for (let k = 0; k < 6; k++) {
    const x = r.range(25, W - 25), y = r.range(20, H - 20), h = hills(x / T.hillSize, y / T.hillSize, T.hillDetail);
    if (!best || h < best.h) best = { x, y, h };
  }
  return { x: best.x, y: best.y };
}

// The river: in at one edge and out at the far one, through the lake if there is one, bending
// on the way, and meandering in between. A lake by the edge takes the place of that end: the
// river runs out of it, or into it. Returned as points half a tile apart.
function riverPath(r, T, lake, wiggle) {
  const leftRight = lake?.side ? 'we'.includes(lake.side) : r.next() < 0.6, L = leftRight ? W : H, S = leftRight ? H : W;
  const at = (u, v) => leftRight ? { x: u, y: v } : { x: v, y: u };
  const ends = [at(-6, r.range(0.2, 0.8) * S), at(L + 6, r.range(0.2, 0.8) * S)];
  const route = !lake ? ends : !lake.side ? [ends[0], lake, ends[1]] : 'wn'.includes(lake.side) ? [lake, ends[1]] : [ends[0], lake];
  const along = p => leftRight ? p.x : p.y, across = p => leftRight ? p.y : p.x;
  // A bend every so often, pushed sideways, except where it goes through the lake.
  const ctrl = [route[0]];
  for (let k = 1; k < route.length; k++) {
    const a = route[k - 1], b = route[k], n = Math.max(1, Math.round((along(b) - along(a)) / T.riverBends));
    for (let j = 1; j < n; j++) {
      const u = lerp(along(a), along(b), j / n), v = lerp(across(a), across(b), j / n) + r.range(-T.riverSway, T.riverSway);
      ctrl.push(at(u, clamp(v, 12, S - 12)));
    }
    ctrl.push(b);
  }
  return smoothRiver(T, ctrl, lake, wiggle);
}

// A river through these bends: smoothed (Catmull-Rom), walked in half-tile steps, and
// meandering a little on top, calm near the lake.
function smoothRiver(T, ctrl, lake, wiggle) {
  const pts = [];
  for (let k = 0; k < ctrl.length - 1; k++) {
    const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
    const n = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2);
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  // Small meanders on top of the bends: each point nudged sideways, calm near the lake.
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, calm = lake ? clamp(Math.hypot(p.x - lake.x, p.y - lake.y) / 15 - 0.5, 0, 1) : 1;
    const off = T.meander * (wiggle(k / T.meanderLength, 3.3) - 0.5) * calm;
    return { x: p.x - (b.y - a.y) / d * off, y: p.y + (b.x - a.x) / d * off };
  });
}

// A brook: in from the edge on one side of the river, joining it at a slant, downstream.
// It keeps clear of the lake and of the river's other bends. Null if no good way was found.
function brookPath(r, T, river, lake, wiggle) {
  for (let tries = 0; tries < 12; tries++) {
    const k = Math.floor(river.length * r.range(0.25, 0.75)), join = river[k];
    if (!inBounds(join.x, join.y) || (lake && outside(lake.shape, join.x, join.y) < 8)) continue;
    const a = river[Math.max(0, k - 6)], b = river[Math.min(river.length - 1, k + 6)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, fx = (b.x - a.x) / d, fy = (b.y - a.y) / d;   // the way the river flows
    const side = r.next() < 0.5 ? 1 : -1;
    let ox = -fy * side - fx * 0.7, oy = fx * side - fy * 0.7;                   // out to one side, and back upstream
    const o = Math.hypot(ox, oy); ox /= o; oy /= o;
    let len = 0;
    while (inBounds(join.x + ox * len, join.y + oy * len)) len++;
    if (len < 25) continue;
    len += 6;
    // Bends along the way, pushed sideways, none at the join itself.
    const n = Math.max(2, Math.round(len / T.riverBends)), ctrl = [];
    for (let j = n; j > 0; j--) {
      const sway = j < n ? r.range(-T.riverSway, T.riverSway) * 0.7 : 0, u = len * j / n;
      ctrl.push({ x: join.x + ox * u - oy * sway, y: join.y + oy * u + ox * sway });
    }
    ctrl.push(join);
    const pts = smoothRiver(T, ctrl, join, wiggle);
    const clear = pts.every(p => Math.hypot(p.x - join.x, p.y - join.y) < 10 ||
      (!(lake && outside(lake.shape, p.x, p.y) < 4) && river.every(q => Math.abs(p.x - q.x) > 6 || Math.abs(p.y - q.y) > 6)));
    if (clear) return pts;
  }
  return null;
}

// Carves a river into the ground. It widens as it goes, and has a few fords: stretches shallow
// enough to wade across, never where it runs through a lake (`wet`). A brook is narrower and
// shallower, with one ford.
function carveRiver(w, T, pts, wet, carve, brook = false) {
  const [width, depth, nFords] = brook ? [T.brookWidth, T.brookDepth, 1] : [T.riverWidth, T.riverDepth, w.rng.int(...T.fords)];
  const r = w.rng, n = pts.length;
  const spots = r.shuffle(pts.map((p, k) => k).filter(k => {
    const p = pts[k];
    return p.x > 10 && p.x < W - 10 && p.y > 10 && p.y < H - 10 && !wet(p);
  }));
  const fords = [];
  for (const k of spots) {
    if (fords.length < nFords && fords.every(f => Math.abs(f - k) > 70)) fords.push(k);
  }
  pts.forEach((p, k) => {
    const t = k / n, half = lerp(...width, t);
    let ford = 0;
    for (const f of fords) ford = Math.max(ford, Math.exp(-(((k - f) / T.fordLength) ** 2)));
    const deep = depth - Math.max(0, depth - T.fordDepth) * ford, reach = half + 8;
    for (let y = Math.max(0, Math.floor(p.y - reach)); y <= Math.min(H - 1, p.y + reach); y++) {
      for (let x = Math.max(0, Math.floor(p.x - reach)); x <= Math.min(W - 1, p.x + reach); x++) {
        carve(y * W + x, Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) - half, deep, half);
      }
    }
  });
  for (const k of fords) w.fords.push({ x: pts[k].x, y: pts[k].y, k, river: w.rivers.length });
  w.rivers.push({ pts, brook });
}

// Water drawn in the terrain lab: circles, carved as one shape, so a lake deepens toward its
// middle however it was painted. Each circle says how deep the water under it gets.
function carveDrawnWater(w, circles, carve) {
  const N = W * H, inside = new Uint8Array(N), deep = new Float32Array(N);
  for (const c of circles) {
    for (let y = Math.max(0, Math.floor(c.y - c.r)); y <= Math.min(H - 1, c.y + c.r); y++) {
      for (let x = Math.max(0, Math.floor(c.x - c.r)); x <= Math.min(W - 1, c.x + c.r); x++) {
        const i = y * W + x;
        if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < c.r) { inside[i] = 1; deep[i] = Math.max(deep[i], c.deep); }
      }
    }
  }
  const out = distanceTo(inside), into = distanceTo(inside.map(v => 1 - v));
  for (let i = 0; i < N; i++) carve(i, inside[i] ? 0.5 - into[i] : out[i] - 0.5, deep[i], 4);
}

// What was drawn in the terrain lab, as createWorld's `drawn` option (numbers in tiles):
//   { empty: true,                  no river, lake, ponds or woods of the meadow's own
//     water: [[x, y, r, deep]],     circles of water
//     rivers: [[[x, y], ...]],      each river's bends
//     woods: [[x, y, r]] }          circles of forest
function readDrawn(d = {}) {
  return {
    empty: !!d.empty,
    water: (d.water || []).map(([x, y, r, deep]) => ({ x, y, r, deep })),
    rivers: (d.rivers || []).filter(p => p.length > 1).map(p => p.map(([x, y]) => ({ x, y }))),
    woods: (d.woods || []).map(([x, y, r]) => ({ x, y, r })),
  };
}

// Picks one of the keys of { name: odds }.
function pickOdds(r, odds) {
  const keys = Object.keys(odds);
  let u = r.next() * keys.reduce((sum, k) => sum + odds[k], 0);
  for (const k of keys) if ((u -= odds[k]) < 0) return k;
  return keys[keys.length - 1];
}

function makeTerrain(w) {
  const r = w.rng, N = W * H;
  const T = w.terrain = { ...TERRAIN, ...w.options.terrain };
  const drawn = w.drawn = readDrawn(w.options.drawn);
  const hills = makeNoise(r);
  const hill = new Float32Array(N);
  for (let i = 0; i < N; i++) hill[i] = hills((i % W) / T.hillSize, ((i / W) | 0) / T.hillSize, T.hillDetail);
  const each = fn => { for (let i = 0; i < N; i++) fn(i, (i % W) + 0.5, ((i / W) | 0) + 0.5); };

  // First where the water will go: the lake, the river, and whatever was drawn.
  const layout = drawn.empty ? 'none' : pickOdds(r, T.layouts);
  const lake = layout === 'river' || layout === 'none' ? null : placeLake(r, T, hills);
  if (lake) lake.shape = blobs(r, lake.x, lake.y, T.lakeBlobs, T.lakeSpread, ...T.lakeSize);
  const river = layout === 'valley' || layout === 'river' ? riverPath(r, T, lake, hills) : null;
  const brook = river && r.next() < T.brooks ? brookPath(r, T, river, lake, hills) : null;
  // A drawn river that nearly reaches the edge runs on off the map.
  const drawnRivers = drawn.rivers.map(bends => {
    const ends = [bends[0], bends[bends.length - 1]].map((p, k) => {
      const next = bends[k ? bends.length - 2 : 1], d = Math.hypot(p.x - next.x, p.y - next.y) || 1;
      const edge = Math.min(p.x, p.y, W - p.x, H - p.y);
      return edge < 4 ? { x: p.x + (p.x - next.x) / d * 8, y: p.y + (p.y - next.y) / d * 8 } : p;
    });
    return smoothRiver(T, [ends[0], ...bends.slice(1, -1), ends[1]], null, hills);
  });

  // Then the ground: the land slopes down into a valley around that water, so a rising water
  // level spreads out from the river first. A brook's valley is half as wide. Away from them the
  // hills rise from low meadows that still dip and swell a little, and no hilltop sits right by
  // the water.
  const valley = (shapes, lines, width) => {
    const planned = new Uint8Array(N);
    each((i, x, y) => { if (shapes.some(sh => outside(sh, x, y) < 0)) planned[i] = 1; });
    for (const pts of lines) for (const p of pts) if (inBounds(p.x, p.y)) planned[idx(p.x, p.y)] = 1;
    if (!planned.some(v => v)) return () => 1;
    const d = blurred(blurred(distanceTo(planned), 2), 2);             // blurred, or it shows its eight directions
    return i => 1 - (1 - clamp(d[i] / width, 0, 1)) ** 2;              // rises fast from the water, then levels off
  };
  const byRiver = valley([lake ? lake.shape : [], drawn.water], [river || [], ...drawnRivers], T.valley);
  const byBrook = valley([], [brook || []], T.valley / 2);
  const ground = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = Math.min(byRiver(i), byBrook(i));
    hill[i] = lerp(Math.min(hill[i], T.hillFloor), hill[i], v);
    const g = (hill[i] - T.hillFloor) * T.hillRise;
    ground[i] = v * Math.max(0.01, T.lowGround + (g > 0 ? g : g * T.lowSlope));
  }
  // Water is carved into the ground: the bed drops to `deep` over `edge` tiles from the shore,
  // and outside the shape the bank rises gently back up to the meadow.
  const carve = (i, sd, deep, edge) => {
    const h = sd >= 0 ? T.bank * sd : -deep * Math.min(1, -sd / edge);
    if (h < ground[i]) ground[i] = h;
  };
  if (lake) each((i, x, y) => carve(i, outside(lake.shape, x, y), T.lakeDepth, 6));
  const inLake = p => (lake && outside(lake.shape, p.x, p.y) < 6) || outside(drawn.water, p.x, p.y) < 3;
  w.rivers = []; w.fords = [];
  if (river) carveRiver(w, T, river, inLake, carve);
  if (brook) carveRiver(w, T, brook, p => inLake(p) || Math.hypot(p.x - brook.at(-1).x, p.y - brook.at(-1).y) < 12, carve, true);
  if (drawn.water.length) carveDrawnWater(w, drawn.water, carve);
  for (const pts of drawnRivers) carveRiver(w, T, pts, inLake, carve);

  // Small ponds, well away from the other water, each in the lowest of a few spots, so they
  // gather in the hollows.
  w.water = new Uint8Array(N);
  w.ground = ground; w.level = T.level;
  refreshWater(w);
  for (let p = drawn.empty ? 0 : r.int(...T.ponds), tries = 0; p > 0 && tries < 200; tries++) {
    let cx = 0, cy = 0, low = Infinity;
    for (let k = 0; k < 6; k++) {
      const x = r.range(14, W - 14), y = r.range(12, H - 12);
      if (ground[idx(x, y)] < low && !waterWithin(w, x, y, 14)) { cx = x; cy = y; low = ground[idx(x, y)]; }
    }
    if (low === Infinity) continue;
    const shape = blobs(r, cx, cy, 4, 3.5, ...T.pondSize), deep = r.range(...T.pondDepth);
    each((i, x, y) => { if (Math.abs(x - cx) < 20 && Math.abs(y - cy) < 16) carve(i, outside(shape, x, y), deep, 2.5); });
    refreshWater(w);
    p--;
  }
  const water = w.water;
  nameWaters(w, lake);

  // Fertile and poor patches, lush banks, and the low meadows a little richer than the hills.
  // Worked out under the water too, for the ground a falling water line leaves behind.
  const near = distanceToWater(w);
  const fert = new Float32Array(N);
  const patches = [];
  for (let i = 0; i < T.patches; i++) {
    patches.push({ x: r.range(0, W), y: r.range(0, H), r: r.range(...T.patchSize), a: r.range(...T.patchRichness) });
  }
  each((i, x, y) => {
    let v = 0.55;
    for (const b of patches) v += b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.r * b.r));
    v += T.wetBanks * Math.exp(-near[i] / 3);
    v += 0.2 * (0.5 - hill[i]);
    v += r.range(-0.06, 0.06);
    fert[i] = v;
  });
  // Every world should be livable: rescale so the average meadow is equally rich.
  let sum = 0, n = 0;
  for (let i = 0; i < N; i++) if (!water[i]) { sum += fert[i]; n++; }
  const k = 0.62 / (sum / n);
  for (let i = 0; i < N; i++) fert[i] = clamp(fert[i] * k, 0.12, 1);   // under water too, for when it drops
  w.fert = fert;
  w.land = n;
  w.room = n / ROOM_TILES;
  w.grass = new Float32Array(N);
  for (let i = 0; i < N; i++) w.grass[i] = water[i] ? 0 : fert[i] * r.range(0.5, 0.9);

  // A few old burrows to start with; the rabbits dig the rest themselves.
  w.burrows = []; w.nextBurrow = 1; w.decor = [];
  for (let tries = 0; w.burrows.length < Math.round(6 * w.room) && tries < 4000; tries++) {
    const x = r.range(6, W - 6), y = r.range(6, H - 6);
    if (canDig(w, x, y)) newBurrow(w, x, y, 1);
  }

  // Decoration only: the forest, some rocks, stepping stones at the fords, flower spots.
  plantTrees(w, hills, hill, near);
  placeFields(w, near);
  for (let k = 0; k < T.rocks; k++) {
    const x = r.range(3, W - 3), y = r.range(3, H - 3);
    if (dry(w, x, y)) w.decor.push({ x, y, emoji: '🪨', size: r.range(1.1, 1.8) });
  }
  for (const f of w.fords) {
    const p = w.rivers[f.river].pts, a = p[Math.min(p.length - 1, f.k + 1)], b = p[Math.max(0, f.k - 1)];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, nx = -(a.y - b.y) / d, ny = (a.x - b.x) / d;   // across the river
    for (let s = -2; s <= 2; s++) {
      const x = f.x + nx * s * 1.1 + r.range(-0.3, 0.3), y = f.y + ny * s * 1.1 + r.range(-0.3, 0.3);
      if (isWater(w, x, y)) w.decor.push({ x, y, emoji: '🪨', size: r.range(0.7, 1), stone: true });
    }
  }
  w.plants = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, f = w.fieldAt[i] >= 0 ? w.fields[w.fieldAt[i]] : null;
    if (water[i] || r.next() > (f ? T.fieldFlowers : T.flowers)) continue;
    w.plants.push({ x: x + r.next(), y: y + r.next(), i, kind: r.next(), field: f, n: w.plants.length });
  }
  // Plants never move, so they go into the spatial grid's cells once, for the bees looking for them.
  w.plantCells = Array.from({ length: GW * GH }, () => []);
  for (const p of w.plants) w.plantCells[clamp((p.y / CELL) | 0, 0, GH - 1) * GW + clamp((p.x / CELL) | 0, 0, GW - 1)].push(p);
  // Everything above was laid out at the usual water line; now the water stands where it
  // does this time of year.
  settleWater(w);
}

// A few flower fields out in the open meadow, on good soil, away from the woods, the water and
// each other. The first three bloom one each in spring, summer and autumn, close enough together
// that a hive between them has flowers all year. w.fieldAt says which field a tile
// is in (-1: none), w.fieldIn how far in (0 at the edge, 1 two tiles in).
function placeFields(w, near) {
  const r = w.rng, T = w.terrain, N = W * H;
  w.fields = []; w.fieldAt = new Int8Array(N).fill(-1); w.fieldIn = new Float32Array(N);
  const kinds = r.shuffle(FIELD_KINDS.slice()), places = r.shuffle(FIELD_PLACES.slice()), seasons = r.shuffle([0, 1, 2]);
  for (let n = w.drawn.empty ? 0 : r.int(...T.fields), tries = 0; w.fields.length < n && tries < 1000; tries++) {
    const cx = r.range(14, W - 14), cy = r.range(12, H - 12), reach = T.fieldSpread + T.fieldSize[1];
    if (!dry(w, cx, cy) || near[idx(cx, cy)] < reach * 0.6 || w.fert[idx(cx, cy)] < 0.5) continue;
    if (w.fields.some(f => Math.hypot(f.x - cx, f.y - cy) < reach * 2.5)) continue;
    if (w.fields.length < 3 && w.fields.some(f => Math.hypot(f.x - cx, f.y - cy) > T.fieldGather)) continue;
    if (w.decor.some(d => d.tree && Math.hypot(d.x - cx, d.y - cy) < reach)) continue;
    const season = seasons[w.fields.length % 3];
    const kind = kinds.find(k => k.season === season && !w.fields.some(f => f.kind === k)) || kinds.find(k => k.season === season);
    const id = w.fields.length, shape = blobs(r, cx, cy, 4, T.fieldSpread, ...T.fieldSize);
    const f = { id, kind, season, emoji: kind.emoji, tint: kind.tint, x: cx, y: cy, shape,
      name: `${r.pick(kind.names)} ${places[id % places.length]}` };
    w.fields.push(f);
    for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(H, cy + reach); y++) {
      for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(W, cx + reach); x++) {
        const i = y * W + x, d = outside(shape, x + 0.5, y + 0.5);
        if (d >= 0 || w.water[i]) continue;
        w.fieldAt[i] = id; w.fieldIn[i] = clamp(-d / 2, 0, 1);
        w.fert[i] = Math.min(1, w.fert[i] + T.fieldSoil * w.fieldIn[i]);
      }
    }
  }
}

// Every meadow has a forest, of one kind or two: woods on the hilltops, a big wood along one
// side, or a wet wood by the water (TERRAIN.forests). Two kinds together are each a little smaller.

function plantTrees(w, hills, hill, near) {
  const r = w.rng, N = W * H, T = w.terrain;
  const kinds = w.drawn.empty ? [] : r.pick(T.forests), small = kinds.length > 1;
  w.forest = kinds;
  const [small0, big] = T.treeSize;
  // Trees stand clear of the highest the water gets (waterGoal), and a wet wood follows that
  // high-water line rather than the everyday shore.
  const flood = T.level + T.springFlood + T.rainRise / 2;
  const nearFlood = distanceTo(w.ground.map(g => g < flood ? 1 : 0));
  const plant = (x, y, pine) => {
    if (inBounds(x, y) && w.ground[idx(x, y)] > flood && !w.burrows.some(b => Math.hypot(b.x - x, b.y - y) < 3)) {
      const size = small0 + (big - small0) * r.next() ** 2;           // squared: big trees are rare
      w.decor.push({ x, y, emoji: pine ? '🌲' : '🌳', size, tree: true, stump: 0 });
    }
  };
  const ragged = (x, y) => (hills(x / 9 + 31.7, y / 9 + 12.3) - 0.5) * 7;   // a few tiles in or out
  const ramp = sd => clamp(sd / 3, 0, 1);                                   // thick 3 tiles in from the edge

  // Each kind says how thick the wood is at a spot (0..1) and how likely a tree there is a pine.
  const woods = kinds.map(kind => {
    if (kind === 'hills') {
      // The highest ground is wooded: pines on the tops, broadleaf lower down.
      const hs = [];
      for (let i = 0; i < N; i++) if (!w.water[i]) hs.push(hill[i]);
      hs.sort((a, b) => a - b);
      const top = hs[Math.floor(hs.length * (1 - T.hillWoods * (small ? 5 / 7 : 1)))], peak = hs[hs.length - 1];
      const height = (x, y) => (hill[idx(x, y)] - top) / (peak - top);
      return {
        dense: (x, y) => clamp((hill[idx(x, y)] + ragged(x, y) * 0.006 - top) / 0.025, 0, 1),
        pine: (x, y) => 0.2 + 0.8 * clamp(height(x, y) * 1.6, 0, 1),
      };
    }
    if (kind === 'edge') {
      // The meadow runs up to a big wood along one side, the side with the least water.
      const sides = ['n', 's', 'w', 'e'].map(side => {
        let wet = 0;
        for (let i = 0; i < N; i++) {
          const x = i % W, y = (i / W) | 0;
          const d = side === 'n' ? y : side === 's' ? H - 1 - y : side === 'w' ? x : W - 1 - x;
          if (d < 20 && w.water[i]) wet++;
        }
        return { side, wet: wet + r.range(0, 40) };
      }).sort((a, b) => a.wet - b.wet);
      const side = sides[0].side, depth = r.range(...T.edgeWoods) * (small ? 0.7 : 1);
      const inward = (x, y) => side === 'n' ? y : side === 's' ? H - y : side === 'w' ? x : W - x;
      const along = (x, y) => side === 'n' || side === 's' ? x : y;
      return {
        dense: (x, y) => {
          const bay = (hills(along(x, y) / 14 + 5.5, 71.3) - 0.5) * 22;       // bays and tongues
          return ramp(depth + bay - inward(x, y) - ragged(x, y) * 0.5) * (near[idx(x, y)] < 2 ? 0 : 1);
        },
        pine: (x, y) => clamp(0.85 - inward(x, y) / depth * 0.6, 0.15, 0.85),
      };
    }
    // 'bank': a wet wood along one stretch of the river or a lakeshore, broadleaf, thick by the water.
    const shore = [];
    for (let i = 0; i < N; i++) {
      const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
      if (nearFlood[i] > 0 && nearFlood[i] < 1.5 && x > 15 && x < W - 15 && y > 12 && y < H - 12) shore.push({ x, y });
    }
    const c = shore.length ? r.pick(shore) : { x: W / 2, y: H / 2 }, reach = r.range(...T.bankWoods) * (small ? 0.7 : 1);
    return {
      dense: (x, y) => {
        const n = nearFlood[idx(x, y)];
        return n < 1 ? 0 : ramp(reach - Math.hypot(x - c.x, (y - c.y) * 1.2) - ragged(x, y)) * ramp(9 - n - ragged(x, y) * 0.6);
      },
      pine: () => 0.12,
    };
  });

  // Woods drawn in the terrain lab: pines up on the hills, broadleaf lower down.
  if (w.drawn.woods.length) {
    woods.push({
      dense: (x, y) => ramp(-outside(w.drawn.woods, x, y) - ragged(x, y) * 0.3),
      pine: (x, y) => clamp((hill[idx(x, y)] - 0.45) * 3, 0.1, 0.9),
    });
  }

  // One tree per cell where the wood is thick, fewer toward its edge.
  const s = T.treeSpacing;
  for (let gy = 0; gy < H; gy += s) for (let gx = 0; gx < W; gx += s) {
    const x = gx + r.range(0.2, s - 0.2), y = gy + r.range(0.2, s - 0.2);
    if (x < 1 || y < 1 || x > W - 1 || y > H - 1) continue;
    let best = null, d = 0;
    for (const wd of woods) { const v = wd.dense(x, y); if (v > d) { d = v; best = wd; } }
    if (best && r.next() < d) plant(x, y, r.next() < best.pine(x, y));
  }
  // And a few small groves out in the meadow.
  for (let g = 0; g < (w.drawn.empty ? 0 : T.groves); g++) {
    const gx = r.range(8, W - 8), gy = r.range(8, H - 8);
    for (let k = r.int(3, 7); k > 0; k--) plant(gx + r.range(-5, 5), gy + r.range(-4, 4), r.next() >= 0.6);
  }
  shadeWoods(w);
}

// How shaded each tile is, 0..1, from the trees around it. game.js darkens the ground there.
function shadeWoods(w) {
  const wood = new Float32Array(W * H);
  for (const d of w.decor) {
    if (!d.tree) continue;
    for (let y = Math.max(0, Math.floor(d.y - 3)); y <= Math.min(H - 1, d.y + 3); y++) {
      for (let x = Math.max(0, Math.floor(d.x - 3)); x <= Math.min(W - 1, d.x + 3); x++) {
        const q = ((x + 0.5 - d.x) ** 2 + (y + 0.5 - d.y) ** 2) / 3.2;
        if (q < 3) wood[y * W + x] += 0.45 * Math.exp(-q);
      }
    }
  }
  w.wood = wood.map(v => Math.min(1, v));
}

// Where the water is, from the ground and the water level. Says whether any of it changed.
// Water that spreads over the land belongs to the nearest named water (w.nearBody).
function refreshWater(w) {
  const g = w.ground, water = w.water;
  let changed = false;
  for (let i = 0; i < g.length; i++) {
    const d = w.level - g[i], v = d <= 0 ? 0 : d < w.terrain.deepAt ? SHALLOW : DEEP;
    if (v === water[i]) continue;
    water[i] = v; changed = true;
    if (w.body) w.body[i] = v ? w.nearBody[i] : -1;
  }
  return changed;
}

// ---------------------------------------------------------------- seasonal water
//
// The water rises in spring and drops in summer, a little higher when the ground is soaked
// and lower after a dry spell, and takes a day or so to get there. A burrow the water reaches
// is lost: everyone inside scrambles out, except kits too young to, who drown. Grass under
// water drowns too, and grows back fast in the silt once the water has gone.

const WATER_EVERY = 30;          // ticks between moves of the water line
const WATER_DAYS = 1;            // about how long the water takes to reach its level for the season
const DROWN_DAYS = 1;            // grass under water is gone in about this long
const SILT_DAYS = 3;             // how long the ground the water left grows fast
const KIT_DAYS = 1;              // kits younger than this can't get out of a flooding burrow

function waterGoal(w) {
  const T = w.terrain, s = seasonOf(w.tick);
  return T.level + (s === 0 ? T.springFlood : s === 1 ? -T.summerLow : 0) + T.rainRise * (w.wet - 0.5);
}

// Straight to this season's level, for a new meadow (or the terrain lab picking a season).
function settleWater(w) {
  w.level = waterGoal(w);
  refreshWater(w);
  floodBurrows(w);
  w.waterVersion = (w.waterVersion || 0) + 1;
}

function waterTick(w) {
  const was = w.level, T = w.terrain;
  w.level += (waterGoal(w) - w.level) * WATER_EVERY / (WATER_DAYS * TPD);
  // The news: the river has come up over its banks, or dropped low.
  const high = T.level + T.springFlood / 2, low = T.level - T.summerLow / 2;
  if (was < high && w.level >= high) emit(w, { type: 'water', rising: true });
  if (was > low && w.level <= low) emit(w, { type: 'water', rising: false });
  if (!refreshWater(w)) return;
  w.waterVersion++;
  floodBurrows(w);
}

function floodBurrows(w) {
  const flooded = new Set(w.burrows.filter(b => w.water[idx(b.x, b.y)]));
  if (!flooded.size) return;
  w.burrows = w.burrows.filter(b => !flooded.has(b));
  const out = new Map();                                     // burrow: { drowned, escaped }
  for (const c of w.creatures) {
    if (!c.alive) continue;
    if (flooded.has(c.home)) c.home = null;
    if (flooded.has(c.refuge)) c.refuge = null;
    if (flooded.has(c.dig)) { c.dig = null; c.mode = 'wander'; }
    const b = c.hidden && c.burrow;
    if (!flooded.has(b)) continue;
    if (!out.has(b)) out.set(b, { burrow: b, drowned: [], escaped: [] });
    if (ageDays(w, c) < KIT_DAYS) { die(w, c, 'flood'); out.get(b).drowned.push(c); }
    else { exitBurrow(w, c); out.get(b).escaped.push(c); }
  }
  for (const e of out.values()) emit(w, { type: 'flooded', ...e });
}

function waterWithin(w, x, y, radius) {
  for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(H - 1, y + radius); yy++) {
    for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(W - 1, x + radius); xx++) {
      if (w.water[yy * W + xx] && (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

// Tiles to the nearest water, roughly.
const distanceToWater = w => distanceTo(w.water);

// Tiles to the nearest tile that is set in `from` (two sweeps, straight steps 1 and diagonal 1.4).
function distanceTo(from) {
  const d = Float32Array.from(from, v => v ? 0 : 1e9);
  const sweep = (y0, y1, dy, x0, x1, dx) => {
    for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
      const i = y * W + x;
      for (const [ox, oy, c] of [[-dx, 0, 1], [0, -dy, 1], [-dx, -dy, 1.4], [dx, -dy, 1.4]]) {
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) d[i] = Math.min(d[i], d[ny * W + nx] + c);
      }
    }
  };
  sweep(0, H, 1, 0, W, 1);
  sweep(H - 1, -1, -1, W - 1, -1, -1);
  return d;
}

// Each tile the average of the square `reach` tiles around it.
function blurred(src, reach) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0, n = 0;
    for (let yy = Math.max(0, y - reach); yy <= Math.min(H - 1, y + reach); yy++) {
      for (let xx = Math.max(0, x - reach); xx <= Math.min(W - 1, x + reach); xx++) { sum += src[yy * W + xx]; n++; }
    }
    out[y * W + x] = sum / n;
  }
  return out;
}

// Each stretch of connected water gets a name, and w.body says which one a tile is in.
// A lake the river runs through shares its water but keeps a name of its own.
function nameWaters(w, lake) {
  const r = w.rng, body = new Int16Array(W * H).fill(-1);
  const river = new Uint8Array(W * H);
  for (const rv of w.rivers) for (const p of rv.pts) if (inBounds(p.x, p.y)) river[idx(p.x, p.y)] = 1;
  const firsts = r.shuffle(WATER_NAMES.first.slice());
  w.waters = [];
  for (let s = 0; s < W * H; s++) {
    if (!w.water[s] || body[s] >= 0) continue;
    const id = w.waters.length, stack = [s];
    let size = 0, sx = 0, sy = 0, flows = false;
    body[s] = id;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      size++; sx += x; sy += y; if (river[i]) flows = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (w.water[n] && body[n] < 0) { body[n] = id; stack.push(n); }
      }
    }
    const kind = flows ? 'river' : size > 250 ? 'lake' : 'pond';
    const name = `${firsts[id % firsts.length]} ${r.pick(WATER_NAMES[kind])}`;
    w.waters.push({ id, kind, name, size, x: sx / size + 0.5, y: sy / size + 0.5 });
  }
  w.body = body;
  // And on dry land, which water is nearest: a flood belongs to the water it spilled from.
  const near = Int16Array.from(body), queue = [];
  for (let i = 0; i < near.length; i++) if (near[i] >= 0) queue.push(i);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || near[ny * W + nx] >= 0) continue;
      near[ny * W + nx] = near[i]; queue.push(ny * W + nx);
    }
  }
  w.nearBody = near;
  w.lake = null;
  // The brook runs in the river's water, but has a name of its own too.
  for (const rv of w.rivers) if (rv.brook) rv.name = `${firsts[(w.waters.length + 1) % firsts.length]} ${r.pick(WATER_NAMES.brook)}`;
  if (lake) {
    const c = lake.shape.find(c => inBounds(c.x, c.y) && w.water[idx(c.x, c.y)]);   // a blob's middle is water, if it's on the map
    const home = c && w.waters[body[idx(c.x, c.y)]];
    if (home?.kind === 'lake') w.lake = home;
    else w.lake = { kind: 'lake', name: `${firsts[w.waters.length % firsts.length]} ${r.pick(WATER_NAMES.lake)}`, x: lake.x, y: lake.y };
    w.lake.shape = lake.shape;
  }
}

// The water a straight walk from one point to another would have to swim, if any.
function waterBetween(w, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let k = 1; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    if (!inBounds(x, y) || w.water[idx(x, y)] !== DEEP) continue;
    return w.lake && outside(w.lake.shape, x, y) < 2 ? w.lake : w.waters[w.body[idx(x, y)]];
  }
  return null;
}

function growGrass(w, dt) {
  const s = SEASONS[seasonOf(w.tick)], grow = sky(w).grow;
  const capK = s.cap * (w.weather.kind === 'heat' ? 0.8 : 1);   // a heatwave browns the grass
  const r = GRASS_RATE * s.growth * grow * dt / TPD;
  const seed = SEED_RATE * Math.max(s.growth, 0.05) * grow * dt / TPD;
  const die = DIEBACK * dt / TPD, ashFade = dt / (ASH_DAYS * TPD);
  const drown = dt / (DROWN_DAYS * TPD), siltFade = dt / (SILT_DAYS * TPD);
  const g = w.grass, f = w.fert, water = w.water, ash = w.ash, fire = w.fire, silt = w.silt;
  for (let i = 0; i < g.length; i++) {
    if (water[i]) { if (g[i] > 0) g[i] = Math.max(0, g[i] - drown); silt[i] = 1; continue; }
    if (fire[i]) continue;
    const cap = f[i] * capK;
    const a = 1 + 3 * ash[i] + 3 * silt[i];                  // new shoots love ash, and silt
    let v = g[i];
    if (v < cap) v += r * a * v * (1 - v / cap) + seed * a * cap;
    else v -= (v - cap) * die;
    g[i] = v;
    if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - ashFade);
    if (silt[i] > 0) silt[i] = Math.max(0, silt[i] - siltFade);
  }
}

// ---------------------------------------------------------------- weather
//
// The sky picks a weather from the season's odds. The ground remembers it: rain soaks it,
// sun dries it. Lightning on dry ground starts a fire, and fire spreads through tall dry
// grass, so a well-grazed meadow burns less than an overgrown one.

const sky = w => WEATHER[w.weather.kind];

// ---------------------------------------------------------------- camouflage
//
// A fox spots a still rabbit from further off when its coat stands out from the ground under
// it. The ground is judged in the colours the meadow is drawn with. At night it is shadow, where
// dark coats vanish and pale ones show, except where snow lies.

const GROUND = {
  seasons: [   // [bare ground, lush grass] per season
    [[214, 197, 150], [118, 196, 92]],
    [[226, 206, 142], [104, 178, 70]],
    [[216, 182, 128], [184, 170, 82]],
    [[228, 226, 218], [178, 200, 180]],
  ],
  ash: [74, 66, 60], snow: [246, 248, 252], night: [22, 30, 78],
};
const CAMO = [0.85, 1.5];        // a fox's spotting distance, from a perfect match to a clash
const CAMO_CLASH = 0.8;         // how much a colour difference (0 same, about 1 very unlike) adds

function groundRGB(w, x, y) {
  const i = idx(x, y), [bare, lush] = GROUND.seasons[seasonOf(w.tick)];
  let v = clamp(w.grass[i] / 0.85, 0, 1);
  v = v * (2 - v);
  const ash = w.ash[i] * (1 - v) * 0.85, snow = clamp(w.snow * 1.4 - 0.3, 0, 0.9);
  const f = w.fieldAt[i] >= 0 ? w.fields[w.fieldAt[i]] : null, bloom = fieldBloom(w, f, i, v);
  return bare.map((b, k) => {
    let c = lerp(b, lush[k], v);
    if (bloom > 0) c = lerp(c, f.tint[k], bloom);
    c = lerp(c, GROUND.ash[k], ash);
    c = lerp(c, GROUND.snow[k], snow);
    return isNight(w.tick) ? lerp(c, GROUND.night[k], 0.6 * (1 - snow)) : c;   // moonlit snow stays bright
  });
}

// How strongly a field tints the ground at tile i: only in its season, where the grass is lush.
const FIELD_TINT = 0.3;          // at most this much of the field's colour
const fieldBloom = (w, f, i, v) => (f && f.season === seasonOf(w.tick) ? FIELD_TINT * w.fieldIn[i] * v : 0);

// How far off a fox can pick this rabbit out, as a share of its sight.
function visibility(w, c) {
  if (c.mode === 'flee') return CAMO[1];       // running, it's seen whatever its coat
  const a = coatRGB(w, c), b = groundRGB(w, c.x, c.y);
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255;
  return clamp(CAMO[0] + CAMO_CLASH * d, CAMO[0], CAMO[1]);
}

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
  const all = w.grid;
  all.n.fill(0);
  for (const s in w.grids) w.grids[s].n.fill(0);
  for (const c of w.creatures) {
    if (!c.alive || c.hidden) continue;
    const k = clamp((c.y / CELL) | 0, 0, GH - 1) * GW + clamp((c.x / CELL) | 0, 0, GW - 1);
    const mine = w.grids[c.species];
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

// Every plant in the grid cells that reach within radius of x, y (some a little further off).
function forEachPlantNear(w, x, y, radius, fn) {
  const x0 = clamp(((x - radius) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + radius) / CELL) | 0, 0, GW - 1);
  const y0 = clamp(((y - radius) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + radius) / CELL) | 0, 0, GH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const p of w.plantCells[gy * GW + gx]) fn(p);
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

function founderGenes(w, species) {
  const r = w.rng, g = {};
  for (const k of genesOf(species)) g[k] = clamp((k === 'moult' ? MOULT_START : 0.5) + 0.12 * r.normal(), 0, 1);
  if (species === 'rabbit') g.coat = ['A', 'A', 'D', 'D'].map(L => r.next() < COAT_RARE ? L.toLowerCase() : L).join('');
  else g.fur = r.next();
  return g;
}

function childGenes(w, mum, dad) {
  const r = w.rng, g = {};
  for (const k of mum.coat ? RABBIT_GENES : GENES) {
    let v = r.next() < 0.5 ? mum[k] : dad[k];
    if (r.next() < 0.35) v += 0.045 * r.normal();
    g[k] = clamp(v, 0, 1);
  }
  if (mum.coat) {
    // One letter of each gene from mum, one from dad. Rarely a letter flips.
    const pick = (a, b) => [a[r.next() < 0.5 ? 0 : 1], b[r.next() < 0.5 ? 0 : 1]]
      .map(L => r.next() < COAT_FLIP ? (L === L.toUpperCase() ? L.toLowerCase() : L.toUpperCase()) : L).join('');
    g.coat = pick(mum.coat.slice(0, 2), dad.coat.slice(0, 2)) + pick(mum.coat.slice(2), dad.coat.slice(2));
  } else g.fur = clamp((mum.fur + dad.fur) / 2 + 0.05 * r.normal(), 0, 1);   // fox families share a coat
  return g;
}

// What a rabbit's coat looks like, and the colours it hides and can still pass on.
function coatOf(g) {
  const wild = g.coat.slice(0, 2).includes('A'), full = g.coat.slice(2).includes('D');
  return wild ? (full ? 'wild' : 'sand') : (full ? 'black' : 'blue');
}
// How white a rabbit has turned: it pales through late autumn and colours again early in spring.
function whiteness(w, c) {
  if (!c.genes.coat) return 0;
  const y = (w.tick / TPD % YEAR_DAYS) / SEASON_DAYS;       // 0 to 4 through the year, spring first
  const winter = y >= 3 ? 1 : y > 2.5 ? (y - 2.5) / 0.5 : y < 0.5 ? 1 - y / 0.5 : 0;
  const m = clamp((c.genes.moult - MOULT_FROM) / (MOULT_TO - MOULT_FROM), 0, 1);
  return m * m * (3 - 2 * m) * winter;
}
const coatRGB = (w, c) => COATS[coatOf(c.genes)].rgb.map((v, k) => lerp(v, WINTER_COAT[k], whiteness(w, c)));

function hiddenCoats(g) {
  const out = [];
  if (g.coat.slice(0, 2).includes('A') && g.coat.slice(0, 2).includes('a')) out.push('black');
  if (g.coat.slice(2).includes('D') && g.coat.slice(2).includes('d')) out.push('pale');
  return out;
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
    sex: species === 'bee' || r.next() < 0.5 ? 'F' : 'M',
    gen: parents ? Math.max(parents.mum.gen, parents.dadGen) + 1 : 1,
    mumId: parents ? parents.mum.id : 0, dadId: parents ? parents.dadId : 0,
    born: w.tick, lifespan: (sp.winterLifeDays && seasonOf(w.tick) >= 2 ? sp.winterLifeDays : sp.lifeDays) * TPD * r.range(0.8, 1.2),
    alive: true, died: 0, cause: '',
    energy: 0, stamina: 1, heading: r.range(0, Math.PI * 2), facing: 1, turnBias: 1,
    mode: 'wander', target: null, targetId: 0, timer: 0, moved: 0,
    sprinting: false, sleeping: false, hidden: false, burrow: null, home: null, refuge: null, dig: null,
    alert: 0, threatId: 0, chaseT: 0, fright: 0, frightX: 0, frightY: 0, frightWhat: '',
    wary: 0, waryX: 0, waryY: 0, detour: 0, detourX: 0, detourY: 0, nemesisId: 0, haunt: null,
    pregnantUntil: 0, cooldownUntil: 0, dadGenes: null, dadIdPending: 0, dadGenPending: 0,
    kids: 0, kills: 0, escapes: 0, visits: 0, load: 0, find: null, story: [],
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

function nearestBurrow(w, x, y, maxD, ok = b => b.dug >= 1) {
  let best = null, bd = maxD * maxD;
  for (const b of w.burrows) {
    if (!ok(b)) continue;
    const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (d2 < bd) { best = b; bd = d2; }
  }
  return best;
}

function addCreature(w, species, x, y, opts = {}) {
  if (!dry(w, x, y)) return null;
  const c = makeCreature(w, species, x, y, opts.genes || founderGenes(w, species), null);
  if (opts.sex && species !== 'bee') c.sex = opts.sex;          // bees out and about are all workers
  if (opts.age) c.born = w.tick - Math.min(opts.age * TPD, c.lifespan / 2);   // nobody arrives at death's door
  c.home = species === 'bee' ? nearestHive(w, x, y) : nearestBurrow(w, x, y, 40);
  if (species === 'bee' && !c.home.queen) newQueen(w, c.home);   // a swarm always brings its queen
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
// between pond lobes; turning left and right on the spot just jitters there. Shallow water
// counts as a way through, only slower.
const TURN_MAGS = [0.6, 1.2, 1.9, 2.6];
const HUG = [-0.3, 0, 0.35, 0.7, 1.1, 1.6, 2.2, 2.8, 3.4];   // leaning into the shore first
// Both lists for each way an animal can lean (c.turnBias 1 or -1), made once: straight first, then
// turning further and further, and hugging the shore.
const TURNS = [1, -1].map(bias => [0, ...TURN_MAGS.flatMap(m => [bias * m, -bias * m])]);
const HUGS = [1, -1].map(bias => HUG.map(o => o * bias));

function moveToward(w, c, tx, ty, v) {
  if (w.water[idx(c.x, c.y)]) v *= c.sp.wade;   // wading: rabbits hate it more than foxes
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  const stepLen = Math.min(v, d);
  if (c.detour > 0) {
    const jumped = (tx - c.detourX) ** 2 + (ty - c.detourY) ** 2 > 4;   // a new goal; a mate drifting is not
    c.detourX = tx; c.detourY = ty;
    if (--c.detour === 0 || jumped || clearPath(w, c.x, c.y, tx, ty)) c.detour = 0;
  }
  const lean = c.turnBias < 0 ? 1 : 0;
  const a = c.detour ? c.heading : Math.atan2(dy, dx), offs = c.detour ? HUGS[lean] : TURNS[lean];
  for (const off of offs) {
    const nx = c.x + Math.cos(a + off) * stepLen, ny = c.y + Math.sin(a + off) * stepLen;
    if (!walkable(w, nx, ny)) continue;
    if (!c.detour && off !== 0) {
      c.turnBias = off > 0 ? 1 : -1;
      c.detour = 500; c.detourX = tx; c.detourY = ty;
    }
    c.x = nx; c.y = ny; c.heading = a + off; c.moved = stepLen;
    const cx = Math.cos(c.heading);
    if (Math.abs(cx) > 0.4) c.facing = cx > 0 ? 1 : -1;   // going up or down a shore, it wobbles: keep facing
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
    } while (!(dry(w, tx, ty) && clearPath(w, c.x, c.y, tx, ty)) && ++tries < 8);   // paddling, but not for fun
    c.target = dry(w, tx, ty) && clearPath(w, c.x, c.y, tx, ty) ? { x: tx, y: ty } : { x: c.x, y: c.y };
    c.timer = 200;
  }
  c.mode = 'wander';
  moveToward(w, c, c.target.x, c.target.y, c.walk * pace * kidPace(w, c));
}

const kidPace = (w, c) => 0.6 + 0.4 * growth(w, c);

// Walk, or fly for those that can (see fly, with the bees).
const go = (w, c, tx, ty, v) => (c.sp.flies ? fly(c, tx, ty, v) : moveToward(w, c, tx, ty, v));

// ---------------------------------------------------------------- love

function readyToMate(w, c) {
  return c.alive && !c.hidden && isAdult(w, c) && c.pregnantUntil === 0
    && w.tick >= c.cooldownUntil && c.energy >= c.sp.breedEnergy * c.maxEnergy
    && c.sp.breedSeasons.includes(seasonOf(w.tick))
    && w.count[c.species] + w.expecting[c.species] < c.sp.cap * w.room;
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
  go(w, c, partner.x, partner.y, c.walk * 1.2);
  return true;
}

function mate(w, a, b) {
  const mum = a.sex === 'F' ? a : b, dad = a.sex === 'F' ? b : a;
  mum.pregnantUntil = w.tick + mum.sp.gestationDays * TPD;
  mum.cooldownUntil = mum.pregnantUntil + mum.sp.cooldownDays * TPD;
  mum.dadGenes = dad.genes; mum.dadIdPending = dad.id; mum.dadGenPending = dad.gen;
  w.recount = true;
  dad.cooldownUntil = w.tick + 0.4 * TPD;
  for (const c of [mum, dad]) { c.mode = 'wander'; c.target = null; c.targetId = 0; }
  note(w, mum, '💕', `Fell in love with ${dad.name}`);
  note(w, dad, '💕', `Fell in love with ${mum.name}`);
  emit(w, { type: 'love', a: mum, b: dad });
}

function giveBirth(w, mum) {
  const sp = mum.sp, r = w.rng;
  mum.pregnantUntil = 0; w.recount = true;
  const well = mum.energy / mum.maxEnergy;
  let n = r.int(sp.litter[0], sp.litter[1]);
  if (well < 0.4) n = Math.max(1, n - 1);
  const dad = w.byId.get(mum.dadIdPending);
  const kids = [], surprise = [];
  // A coat neither parent shows came from colours both of them were hiding.
  const shown = mum.genes.coat && [coatOf(mum.genes), coatOf(mum.dadGenes)];
  for (let k = 0; k < n; k++) {
    let x = mum.x + r.range(-1, 1), y = mum.y + r.range(-1, 1);
    if (!dry(w, x, y)) { x = mum.x; y = mum.y; }
    const kid = makeCreature(w, mum.species, x, y, childGenes(w, mum.genes, mum.dadGenes),
      { mum, dadId: mum.dadIdPending, dadGen: mum.dadGenPending });
    kid.home = mum.home || mum.burrow;
    if (mum.hidden && mum.burrow) { kid.hidden = true; kid.burrow = mum.burrow; kid.sleeping = true; kid.mode = 'sleep'; kid.timer = 60; mum.burrow.count++; }
    note(w, kid, '🐣', `Born to ${mum.name}` + (dad ? ` and ${dad.name}` : ''));
    if (shown && !shown.includes(coatOf(kid.genes))) {
      surprise.push(kid);
      note(w, kid, '🎨', `Born ${COATS[coatOf(kid.genes)].name}, unlike either parent`);
    }
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
  emit(w, { type: 'birth', mum, dad, kids, surprise });
}

// ---------------------------------------------------------------- burrows
//
// A burrow has room for ten. Kits born inside, or following mum in, squeeze in anyway.

const BURROW_ROOM = 10;
const hasRoom = b => b.count < BURROW_ROOM;
const roomy = b => b.dug >= 1 && hasRoom(b);

function enterBurrow(w, c, b, ticks, sleeping) {
  c.hidden = true; c.burrow = b; c.x = b.x; c.y = b.y;
  c.timer = ticks; c.sleeping = sleeping; c.mode = sleeping ? 'sleep' : 'hide';
  c.target = null; c.alert = 0;
  b.count++; b.used = w.tick;
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

// ---------------------------------------------------------------- digging
//
// A settled rabbit with no burrow near digs one where it stands, or helps finish a half-dug
// one close by. One burrow for every four rabbits is plenty. A burrow nobody has been inside
// for a season falls in, and so does a half-dug one left alone for a day.

const DIG_GAP = 14;        // tiles between burrows
const DIG_TICKS = 300;     // one rabbit digging on its own: half a day

function canDig(w, x, y) {
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (!dry(w, x + dx, y + dy)) return false;
  return !w.burrows.some(b => Math.hypot(b.x - x, b.y - y) < DIG_GAP)
    && !w.decor.some(d => !d.stone && Math.hypot(d.x - x, d.y - y) < 2)
    && !w.hives.some(h => Math.hypot(h.x - x, h.y - y) < 3);
}

function newBurrow(w, x, y, dug) {
  const b = { id: w.nextBurrow++, x, y, count: 0, dug, used: w.tick };
  w.burrows.push(b);
  return b;
}

function startDigging(w, c) {
  if (w.burrows.length * 4 > w.count.rabbit) return false;
  const near = nearestBurrow(w, c.x, c.y, DIG_GAP, () => true);
  if (near && near.dug >= 1) return false;
  if (!near && !canDig(w, c.x, c.y)) return false;
  c.dig = near || newBurrow(w, c.x, c.y, 0);
  c.mode = 'dig'; c.target = null;
  return true;
}

function dig(w, c) {
  const b = c.dig;
  if (!b || b.dug >= 1) { c.dig = null; c.mode = 'wander'; return false; }
  if (!moveToward(w, c, b.x + 0.7, b.y + 0.2, c.walk)) return true;
  b.dug += 1 / DIG_TICKS; b.used = w.tick;
  if (b.dug >= 1) {
    b.dug = 1; c.home = b; c.dig = null; c.mode = 'rest'; c.timer = 60;
    note(w, c, '🕳️', 'Dug a new burrow');
    emit(w, { type: 'dug', c, burrow: b });
  }
  return true;
}

function collapseBurrows(w) {
  const old = b => b.count === 0 && w.tick - b.used > (b.dug < 1 ? 1 : SEASON_DAYS) * TPD;
  if (!w.burrows.some(old)) return;
  const gone = new Set(w.burrows.filter(old));
  w.burrows = w.burrows.filter(b => !gone.has(b));
  for (const c of w.creatures) {
    if (gone.has(c.home)) c.home = null;
    if (gone.has(c.refuge)) c.refuge = null;
    if (gone.has(c.dig)) c.dig = null;
  }
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

  // 2. Babies stay near mum. Once it sets off after her, it goes all the way back.
  if (growth(w, c) < 0.5) {
    const mum = w.byId.get(c.mumId);
    if (mum && mum.alive) {
      if (mum.hidden && !night) { /* mum is inside: wait nearby */ }
      else if (mum.hidden) return goHome(w, c, mum.burrow);
      else if (dist2(c, mum) > (c.mode === 'follow' ? 1.5 : 3) ** 2) { c.mode = 'follow'; moveToward(w, c, mum.x, mum.y, c.walk * kidPace(w, c)); return; }
    }
  }

  // 3. Night: go home to sleep, unless hungry. One on its way home keeps going; one eating
  // eats its fill (half a tummy) first.
  const e = c.energy / c.maxEnergy;
  if (c.mode === 'sleep') {
    if (!night || e < 0.25) { c.sleeping = false; c.mode = 'wander'; } else return;
  }
  const bedtime = c.mode === 'home' ? 0.2 : c.mode === 'graze' || c.mode === 'food' ? 0.5 : 0.3;
  if (night && e > bedtime) {
    // Home full (or far)? The nearest burrow with room becomes home. None: sleep out.
    const b = c.home && hasRoom(c.home) && Math.hypot(c.home.x - c.x, c.home.y - c.y) < 35 ? c.home
      : nearestBurrow(w, c.x, c.y, 35, roomy);
    if (b) { c.home = b; return goHome(w, c, b); }
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
    if (c.mode !== 'food' || !c.target || w.grass[idx(c.target.x, c.target.y)] < 0.12) {   // stick with a patch till it's gone
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

  // 6. Fed and safe: dig, sit, find friends, or amble.
  if (c.mode === 'dig' && dig(w, c)) return;
  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; c.target = null; }
  if ((t + c.id) % 30 === 0) {
    if (isAdult(w, c) && startDigging(w, c)) return;
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
    c.mode = 'flee'; c.sleeping = false; c.threatId = fox.id; c.target = null;
    c.refuge = pickRefuge(w, c, fox);
    if (fox.id) thump(w, c, fox);
  }
  let tx, ty;
  if (c.refuge && !hasRoom(c.refuge)) c.refuge = pickRefuge(w, c, fox);   // filled up: try another
  const b = c.refuge;
  if (b) {
    tx = b.x; ty = b.y;
    if ((b.x - c.x) ** 2 + (b.y - c.y) ** 2 < 0.8) {
      enterBurrow(w, c, b, w.rng.int(150, 350), false);
      return;
    }
  } else {
    // Straight away from the fox, or as close to that as the ponds allow. It keeps to the way
    // it picked until it gets there or the fox comes round that side; picking afresh every
    // step, it dithers along the shore.
    const t = c.target;
    if (t && (t.x - c.x) ** 2 + (t.y - c.y) ** 2 > 1 && (t.x - c.x) * (c.x - fox.x) + (t.y - c.y) * (c.y - fox.y) > 0) {
      tx = t.x; ty = t.y;
    } else {
      const a = Math.atan2(c.y - fox.y, c.x - fox.x), b = c.turnBias || 1;
      for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
        tx = c.x + Math.cos(a + off * b) * 6; ty = c.y + Math.sin(a + off * b) * 6;
        if (clearPath(w, c.x, c.y, tx, ty)) break;
      }
      c.target = { x: tx, y: ty };
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
    if (d2 >= bd || !roomy(b) || !clearPath(w, c.x, c.y, b.x, b.y)) continue;
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
    if (mum && mum.alive && dist2(c, mum) > (c.mode === 'follow' ? 2 : 4) ** 2) {   // same as rabbit kits
      c.mode = 'follow'; c.targetId = 0;   // back to mum, and the hunt is off
      moveToward(w, c, mum.x, mum.y, c.walk * kidPace(w, c)); return;
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
  // Lost from view: a little further off than the furthest a fox spots one, or it'd flicker.
  if (prey && (!prey.alive || prey.hidden || dist2(c, prey) > (sight * CAMO[1] * 1.2) ** 2)) {
    if (prey.alive && c.mode === 'chase') escaped(w, prey, c, prey.hidden ? 'burrow' : 'outran');
    prey = null; c.targetId = 0; c.mode = 'wander';
  }
  // Foxes don't swim. A rabbit across deep water is out of reach, and one that gets deep water
  // between itself and the fox mid-chase has got away. Shallow water only slows them both.
  if (prey && (w.tick + c.id) % 5 === 0 && !clearPath(w, c.x, c.y, prey.x, prey.y)) {
    if (c.mode === 'chase') escaped(w, prey, c, 'pond', waterBetween(w, c.x, c.y, prey.x, prey.y));
    prey = null; c.targetId = 0; c.mode = 'wander';
  }
  if (!prey && (w.tick + c.id) % 5 === 0) {
    // Only a rabbit that isn't already watching this fox is worth sneaking up on.
    prey = nearest(w, c, sight * CAMO[1], 'rabbit', o => !(o.alert > 0 && o.threatId === c.id)
      && dist2(c, o) < (sight * visibility(w, o)) ** 2 && clearPath(w, c.x, c.y, o.x, o.y));
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

function escaped(w, rabbit, fox, how, water) {
  rabbit.escapes++;
  rabbit.nemesisId = fox.id;   // it won't forget this one
  missed(fox);
  note(w, rabbit, '💨', how === 'burrow' ? `Dived into a burrow to escape ${fox.name}`
    : how === 'pond' ? `Got away from ${fox.name} across ${water ? water.name : 'the water'}` : `Outran ${fox.name}`);
  note(w, fox, '😤', `${rabbit.name} got away`);
  emit(w, { type: 'escape', rabbit, fox, how, water });
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

// ---------------------------------------------------------------- bees
//
// Bees live in hives (w.hives). A hive is a spot on the map, a store of honey and a queen. Every
// bee belongs to one (c.home) and is one of the queen's daughters: bees don't pair up, the queen
// lays (hivesTick). In spring and summer they fly out to the flowers, sip, and bring honey back;
// from autumn to spring they stay in and live on it. Summer bees wear out in a few days, the
// ones raised in autumn last the winter, so a hive swells in summer and shrinks to a small
// cluster for the cold. Foragers carry nectar home a few flowers at a time, and one back from
// a rich patch dances so the others know where to go. A crowded hive swarms: the old queen
// takes half the bees off to a new hollow tree (swarm, settle). They fly, so water and woods don't stop them. Same ladder as
// everyone: danger > swarm > home > food > wander, one function per rung. New bee behaviour is
// a new rung, or a line in one.

const NECTAR = 0.4;             // energy per tick of sipping
const SIP_TICKS = 40;           // how long one flower takes
const REFILL = 150;             // ticks a sipped flower needs to fill with nectar again
const HONEY = 20;               // honey a bee brings home from each flower
const LOAD = 3;                 // flowers a forager visits before she flies home to unload
const RICH = 3;                 // fresh flowers left around her last one (within 8 tiles) that make a patch worth dancing for
const DANCE_TICKS = 40;         // how long she dances about it at the hive
const PATCH_DAYS = 0.5;         // how long the hive remembers a dance
const PATCH_SPREAD = 4;         // how far apart the bees following a dance scatter over the patch
const LEAVE = 0.05;             // chance each tick that a bee ready to go comes out, so the hive empties bit by bit
const HONEY_BITE = 0.2;         // honey a hungry bee eats per tick, in the hive
const FILL_UP = 0.9;            // how full a bee eats herself before flying out, if there's honey
const POLLEN = 0.05;            // how much a visited flower thickens the grass around it
const HIVE_HONEY = 200;         // what a new hive starts with
const HIVE_FULL = 1500;         // all the honey a hive can hold
const WINTER_HONEY = 30;         // honey put by for each bee before the hive raises young
const FORAGE_RANGE = 35;        // how far from its hive a bee roams
const FEW_FLOWERS = 40;         // fewer open than this in the whole meadow, and bees stay in
const QUEEN_LAYS = 2;           // most young bees a queen can raise per hive check (ten checks a day)
const NURSING = 0.06;           // young bees raised per check for each bee in the hive, up to QUEEN_LAYS
const BROOD_HONEY = 8;          // honey it takes to raise one young bee
const CLUSTER_WARM = 20;        // bees it takes to keep the winter cluster warm
const CLUSTER_COLD = 2;         // a lone bee in winter burns this much more on top (1 + this)
const HIVE_ROOM = 60;           // bees one hollow tree has room for; a crowded hive swarms
const SWARM_HONEY = 400;        // honey a hive needs before it can spare a swarm
const SWARM_CARRY = 5;          // honey each leaving bee takes along, in her belly
const SWARM_HANG = 0.5;         // days a swarm hangs in a tree while its scouts look around
const SWARM_RANGE = 45;         // how far off a swarm will look for a home
const HIVE_GAP = 20;            // a new hive keeps this far from the others
const HIVE_SHORE = 2;           // and this far from water, so the hollow tree isn't drawn over the pond
const OLD_COMB = 20;            // how much a swarm likes an empty hive with comb already in it
const MATING_FLIGHT = 0.5;      // days before a new queen, back from her wedding flight, starts to lay
const SCOUTS = 6;               // one bee in this many is a scout

// Bees stay in at night, in rain and storms, and while there's hardly a flower open.
const hiveTime = w => isNight(w.tick) || w.weather.kind === 'rain' || w.weather.kind === 'storm'
  || w.flowers < FEW_FLOWERS;

// Every little while: how many flowers are open, how many bees each hive has, and the queens lay.
function hivesTick(w) {
  w.flowers = 0;
  for (const p of w.plants) if (isFlower(w, p)) w.flowers++;
  for (const h of w.hives) { h.bees = 0; h.winterBees = 0; }
  for (const list of [w.creatures, w.newborn]) {
    for (const c of list) if (c.alive && c.species === 'bee') { c.home.bees++; if (seasonOf(c.born) >= 2) c.home.winterBees++; }
  }
  for (const h of [...w.hives]) {                         // a copy: swarms join and leave the list
    if (h.queen && !h.bees) {                             // nobody left to feed her
      h.queen.died = w.tick;
      emit(w, { type: 'queenlost', hive: h, queen: h.queen });
      h.queen = null;
      if (h.cluster) w.hives.splice(w.hives.indexOf(h), 1);
    }
    if (h.cluster) { if (w.tick >= h.settleAt) settle(w, h); continue; }
    if (h.queen) layEggs(w, h);
    if (h.queen && swarmTime(w, h)) swarm(w, h);
  }
}

// In spring and summer a hive raises young on whatever honey it has. In autumn only while it has
// honey put by for every winter bee so far (the summer bees won't live to see it): those young are
// the winter bees.
const broodTime = (w, h) => seasonOf(w.tick) !== 2 || h.honey > WINTER_HONEY * (h.winterBees + 1);

// The more bees at home to feed the brood, the more young, up to what the queen can lay. Never
// in winter, never before a new queen is back from her wedding flight, and never past the room
// in the hive.
function layEggs(w, h) {
  if (!SPECIES.bee.breedSeasons.includes(seasonOf(w.tick)) || !broodTime(w, h) || w.tick < h.queen.laysFrom) return;
  h.brood += Math.min(QUEEN_LAYS, NURSING * h.bees);
  const kids = [];
  for (; h.brood >= 1 && h.honey >= BROOD_HONEY; h.brood--) {
    if (h.bees + kids.length >= HIVE_ROOM || w.count.bee + w.newborn.length >= SPECIES.bee.cap * w.room) { h.brood = 0; break; }
    h.honey -= BROOD_HONEY;
    const q = h.queen;
    const kid = makeCreature(w, 'bee', h.x, h.y, childGenes(w, q.genes, q.drone), { mum: { id: 0, gen: q.gen }, dadId: 0, dadGen: q.gen });
    kid.home = h; kid.queen = q; kid.hidden = true; kid.mode = 'nurse';
    note(w, kid, '🐣', `Hatched in the hive, a daughter of Queen ${q.name}`);
    w.newborn.push(kid); w.byId.set(kid.id, kid); kids.push(kid);
    q.kids++;
  }
  if (!kids.length) return;
  w.stats.births.bee += kids.length;
  emit(w, { type: 'hatch', hive: h, kids });
}

// A new queen for an empty hive. She stays inside, so she's a name and genes on the hive, and
// she carries the genes of the drone she met on her wedding flight.
function newQueen(w, h) {
  h.queen = { name: pickName(w, 'bee'), genes: founderGenes(w, 'bee'), drone: founderGenes(w, 'bee'), gen: 1, since: w.tick, laysFrom: 0, kids: 0 };
  h.brood = 0;
  emit(w, { type: 'queen', hive: h, queen: h.queen });
}

// A queen raised in the hive. On her wedding flight she meets a drone from anywhere in the
// meadow: any bee will do for his genes.
function daughterQueen(w, mum) {
  const bees = w.creatures.filter(c => c.alive && c.species === 'bee');
  const drone = bees.length ? bees[w.rng.int(0, bees.length - 1)].genes : founderGenes(w, 'bee');
  return { name: pickName(w, 'bee'), genes: childGenes(w, mum.genes, mum.drone), drone, gen: mum.gen + 1,
    since: w.tick, laysFrom: w.tick + MATING_FLIGHT * TPD, kids: 0, mum: mum.name };
}

function makeHive(w, x, y) {
  const id = w.hives.reduce((m, o) => Math.max(m, o.id), 0) + 1;
  const h = { id, x, y, honey: HIVE_HONEY, bees: 0, queen: null, brood: 0, swarmed: -Infinity, cluster: false, patch: null };
  w.hives.push(h);
  return h;
}

// Crowded, well fed, spring or summer, a laying queen, and not swarmed already this year.
const swarmTime = (w, h) => seasonOf(w.tick) <= 1 && h.bees >= 0.8 * HIVE_ROOM && h.honey >= SWARM_HONEY
  && w.tick >= h.queen.laysFrom && w.tick - h.swarmed > YEAR_DAYS * TPD / 2;

// A crowded hive splits. The old queen and half the bees fill up on honey and leave, and hang
// in a tree nearby while scouts look over the hollow trees around. A daughter queen stays with
// the rest. No hollow tree free within reach, and they stay put.
function swarm(w, h) {
  const sites = hiveSites(w, h);
  if (!sites.length) return;
  let tree = null;
  for (const d of w.decor) {
    const d2 = (d.x - h.x) ** 2 + (d.y - h.y) ** 2;
    if (d.tree && !d.stump && d2 > 4 && d2 < 64 && (!tree || d2 < (tree.x - h.x) ** 2 + (tree.y - h.y) ** 2)) tree = d;
  }
  const s = makeHive(w, tree ? tree.x + 0.6 : h.x + 3, tree ? tree.y + 0.3 : h.y);
  const q = h.queen;
  s.cluster = true; s.queen = q; s.sites = sites.slice(0, 3); s.settleAt = w.tick + SWARM_HANG * TPD;
  h.queen = daughterQueen(w, q); h.swarmed = w.tick; h.brood = 0;
  const leaving = w.creatures.filter(c => c.alive && c.species === 'bee' && c.home === h && isAdult(w, c))
    .filter((c, k) => k % 2 === 0);
  for (const c of leaving) {
    c.home = s; c.hidden = false; c.sleeping = false; c.mode = 'swarm'; c.target = null;
    note(w, c, '🐝', `Left home with the swarm, following Queen ${q.name}`);
  }
  s.honey = Math.min(h.honey / 2, SWARM_CARRY * leaving.length);
  h.honey -= s.honey;
  s.bees = leaving.length; h.bees -= leaving.length;
  emit(w, { type: 'swarm', from: h, swarm: s, queen: q, heir: h.queen, who: leaving });
}

// The scouts have made up their minds: the swarm moves into the best of the sites they looked at.
// An empty hive may have been taken meanwhile; with nothing left they build right on the branch.
function settle(w, s) {
  const site = s.sites.find(o => !o.hive || !o.hive.queen);
  let home = s;
  if (site && site.hive) {
    home = site.hive;
    home.honey = Math.min(HIVE_FULL, home.honey + s.honey); home.queen = s.queen; home.brood = 0;
    w.hives.splice(w.hives.indexOf(s), 1);
  } else if (site) { s.x = site.x; s.y = site.y; }
  s.cluster = false; s.sites = null;
  for (const c of w.creatures) {
    if (c.home !== s) continue;
    c.home = home; c.mode = 'wander'; c.target = null;
    note(w, c, '🏡', `Moved into a new home with Queen ${home.queen.name}`);
  }
  home.bees = s.bees;
  emit(w, { type: 'settle', hive: home, queen: home.queen, reused: !!(site && site.hive) });
}

// How good a hollow tree is for a hive: plenty of flowers in reach, fields for more than one
// season, and room to be seen rather than deep in the wood.
const SEASON_FIELD = 150;       // what each season with a field in reach is worth to a hive site
function siteScore(w, x, y) {
  const seasons = new Set(w.fields.filter(f => Math.hypot(f.x - x, f.y - y) < FORAGE_RANGE).map(f => f.season)).size;
  let flowers = 0;
  forEachPlantNear(w, x, y, FORAGE_RANGE, p => {
    if ((p.field || (p.kind < 0.35 && w.fert[p.i] > 0.7)) && Math.hypot(p.x - x, p.y - y) < FORAGE_RANGE) flowers++;   // fields, or rich soil: they'll bloom
  });
  const crowd = w.decor.filter(o => o.tree && Math.hypot(o.x - x, o.y - y) < 4).length;
  return flowers + SEASON_FIELD * seasons - 5 * crowd;
}

// Dry ground all round, far enough out that the hollow tree stands clear of the water.
const hiveGround = (w, x, y) => dry(w, x, y) &&
  [0, 1, 2, 3, 4, 5, 6, 7].every(a => dry(w, x + HIVE_SHORE * Math.cos(a * Math.PI / 4), y + HIVE_SHORE * Math.sin(a * Math.PI / 4)));

// Where a swarm from hive h could live, best first: an empty hive, or a tree clear of the others.
function hiveSites(w, h) {
  const near = (x, y) => Math.hypot(x - h.x, y - h.y) < SWARM_RANGE;
  const sites = [];
  for (const o of w.hives) {
    if (!o.queen && !o.cluster && near(o.x, o.y)) sites.push({ x: o.x, y: o.y, hive: o, score: siteScore(w, o.x, o.y) + OLD_COMB });
  }
  for (const d of w.decor) {
    if (!d.tree || d.stump) continue;
    const x = d.x + 1.4, y = d.y + 0.4;
    if (!near(x, y) || !hiveGround(w, x, y) || w.hives.some(o => Math.hypot(o.x - x, o.y - y) < HIVE_GAP)) continue;
    sites.push({ x, y, hive: null, score: siteScore(w, x, y) });
  }
  return sites.sort((a, b) => b.score - a.score);
}

// Huddled together a winter cluster keeps warm; a handful of bees can't.
const clusterCold = (w, h) => (seasonOf(w.tick) === 3 ? 1 + CLUSTER_COLD * Math.max(0, 1 - h.bees / CLUSTER_WARM) : 1);

// The first hive: a hollow dead tree beside the tree with the most flowering plants in reach,
// at the edge of the wood rather than deep in it, so there's room to see it.
function placeHive(w) {
  let best = { x: W / 2, y: H / 2 }, bestScore = -Infinity;
  for (const d of w.decor) {
    if (!d.tree || d.stump) continue;
    const x = d.x + 1.4, y = d.y + 0.4;
    if (!hiveGround(w, x, y)) continue;
    const score = siteScore(w, x, y);
    if (score > bestScore) { best = { x, y }; bestScore = score; }
  }
  for (let rad = 0; !dry(w, best.x, best.y) && rad < W; rad++) {    // no trees at all: the nearest dry spot
    for (let a = 0; a < 16 && !dry(w, best.x, best.y); a++) {
      const x = W / 2 + rad * Math.cos(a * Math.PI / 8), y = H / 2 + rad * Math.sin(a * Math.PI / 8);
      if (dry(w, x, y)) best = { x, y };
    }
  }
  return makeHive(w, best.x, best.y);
}

function nearestHive(w, x, y) {
  let best = null;
  for (const h of w.hives) if (!best || Math.hypot(h.x - x, h.y - y) < Math.hypot(best.x - x, best.y - y)) best = h;
  return best;
}

function beeTick(w, c) {
  // 1. Danger: nothing hunts bees (yet).
  if (beeSwarm(w, c)) return;                                 // 2. hanging in a swarm, or scouting for it
  if (beeHome(w, c)) return;                                  // 3. home: sleep, shelter, honey, nursing
  if (beeForage(w, c)) return;                                // 4. food
  beeWander(w, c);                                            // 5. wander
}

// In a swarm: hang together in the tree, living on the honey they brought. The scouts fly out
// to the sites the swarm is weighing and back again.
function beeSwarm(w, c) {
  const h = c.home;
  if (!h.cluster) return false;
  if (c.energy < 0.5 * c.maxEnergy && h.honey > 0) { const bite = Math.min(h.honey, HONEY_BITE); h.honey -= bite; c.energy += bite; }
  const scout = c.id % SCOUTS === 0, near = Math.hypot(c.x - h.x, c.y - h.y) < 2;
  if (c.target && !fly(c, c.target.x, c.target.y, c.walk * (near && c.mode === 'swarm' ? 0.3 : 1))) return true;
  if (scout && c.mode === 'swarm' && c.target) {
    const site = h.sites[(c.id / SCOUTS) % h.sites.length];
    c.mode = 'scout'; c.target = { x: site.x, y: site.y };
  } else {
    c.mode = 'swarm'; c.target = { x: h.x + w.rng.range(-1.2, 1.2), y: h.y + w.rng.range(-0.8, 0.5) };
  }
  return true;
}

// In the hive: eat honey when hungry, and fill up before heading out to the far flowers; come
// out when it's time (young bees stay in and nurse till they're grown). Outside: fly home at hive time, or early when hungry and there's honey.
function beeHome(w, c) {
  const e = c.energy / c.maxEnergy, h = c.home;
  if (c.hidden) {
    const hungry = e < (hiveTime(w) ? 0.5 : FILL_UP) && h.honey > 0;
    if (hungry) { const bite = Math.min(h.honey, HONEY_BITE); h.honey -= bite; c.energy += bite; }
    if (hiveTime(w) || hungry || !isAdult(w, c) || w.rng.next() > LEAVE) return true;
    c.hidden = false; c.sleeping = false; c.mode = 'wander'; c.target = null;
    return false;
  }
  if (!hiveTime(w) && !(e < 0.3 && h.honey > 0)) return false;
  c.mode = 'home';
  if (fly(c, h.x, h.y, c.walk)) { unload(h, c); c.hidden = true; c.sleeping = true; c.mode = 'sleep'; c.target = null; }
  return true;
}

function unload(h, c) {
  h.honey = Math.min(HIVE_FULL, h.honey + c.load);
  c.load = 0;
}

// A dance is news for a while: the patch it points to, and how rich it was.
const patchFresh = (w, h) => h.patch && w.tick - h.patch.t < PATCH_DAYS * TPD;

// Off to the nearest fresh flower and sip, pollinating it. With a full load, home to unload,
// and if she found a rich patch she dances: the hive remembers it (h.patch), and bees setting
// out from the hive fly there. Out in the meadow each finds her own flowers.
function beeForage(w, c) {
  const h = c.home;
  if (c.mode === 'dance') {                       // a figure of eight on the doorstep
    const a = c.timer * 0.3;
    c.x = h.x + 0.35 * Math.sin(a); c.y = h.y - 0.2 + 0.18 * Math.sin(2 * a); c.facing = Math.cos(a) > 0 ? 1 : -1;
    if (--c.timer > 0) return true;
    c.mode = 'wander'; c.target = null;
  }
  if (c.mode === 'sip') {
    c.energy = Math.min(c.maxEnergy, c.energy + NECTAR);
    if (--c.timer > 0) return true;
    pollinate(w, c.target); c.target.sipped = w.tick;
    emit(w, { type: 'pollinate', x: c.target.x, y: c.target.y });
    c.load += HONEY; c.visits++;
    const rich = freshAround(w, c.target);
    if (rich >= RICH && (!c.find || rich > c.find.rich)) c.find = { x: c.target.x, y: c.target.y, rich, field: c.target.field };
    c.mode = 'wander'; c.target = null;
  }
  if (c.load >= LOAD * HONEY) {                   // full: home to unload, and tell the others
    c.mode = 'unload';
    if (!fly(c, h.x, h.y, c.walk)) return true;
    unload(h, c);
    if (c.find) {
      if (!patchFresh(w, h) || c.find.rich >= h.patch.rich) h.patch = { ...c.find, t: w.tick };
      c.find = null; c.mode = 'dance'; c.timer = DANCE_TICKS;
      return true;
    }
    c.mode = 'wander';
  }
  if (h.honey >= HIVE_FULL && c.energy >= 0.8 * c.maxEnergy) return false;   // workers gather all day, till the hive is full
  if (c.mode !== 'flower' && c.mode !== 'patch' && (w.tick + c.id) % 10 === 0) {   // look around now and then
    if (patchFresh(w, h) && Math.hypot(h.x - c.x, h.y - c.y) < 2) {
      const s = PATCH_SPREAD;
      c.mode = 'patch'; c.target = { x: clamp(h.patch.x + w.rng.range(-s, s), 1, W - 1), y: clamp(h.patch.y + w.rng.range(-s, s), 1, H - 1), field: h.patch.field };
    } else if (!pickFlower(w, c)) {               // nothing free in sight: off to a field she knows is in bloom
      const f = w.rng.pick(w.fields.filter(f => f.season === seasonOf(w.tick) && Math.hypot(f.x - h.x, f.y - h.y) < FORAGE_RANGE).concat([null]));
      const b = f && w.rng.pick(f.shape);
      if (b) { c.mode = 'patch'; c.target = { x: clamp(b.x + w.rng.range(-b.r, b.r) * 0.7, 1, W - 1), y: clamp(b.y + w.rng.range(-b.r, b.r) * 0.7, 1, H - 1), field: f }; }
    }
  }
  if (c.mode === 'patch') {                       // off where a dancer said
    if (!fly(c, c.target.x, c.target.y, c.walk)) return true;
    if (!pickFlower(w, c)) {                      // all sipped: that patch is done
      if (h.patch && Math.hypot(h.patch.x - c.x, h.patch.y - c.y) < PATCH_SPREAD) h.patch = null;
      c.mode = 'wander'; c.target = null;
      return false;
    }
  }
  if (c.mode !== 'flower') return false;
  if (fly(c, c.target.x, c.target.y, c.walk)) { c.mode = 'sip'; c.timer = SIP_TICKS; }
  return true;
}

// Buzz about, never too far from the hive.
function beeWander(w, c) {
  if (c.mode === 'wander' && c.target && !fly(c, c.target.x, c.target.y, c.walk * 0.6)) return;
  const h = c.home, r = FORAGE_RANGE;
  c.mode = 'wander';
  c.target = { x: clamp(h.x + w.rng.range(-r, r), 1, W - 1), y: clamp(h.y + w.rng.range(-r, r), 1, H - 1) };
}

// Flying: straight there, over water, trees and all. True once it's there.
function fly(c, tx, ty, v) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.05) c.facing = dx > 0 ? 1 : -1;
  if (d <= v) { c.x = tx; c.y = ty; c.moved = d; return true; }
  c.x += dx / d * v; c.y += dy / d * v; c.moved = v;
  return false;
}

// The flowers the meadow shows: spring and summer, where the grass is lush. A field's flowers
// bloom in the field's own season, and are hardier: rabbits have to graze it low to crop them.
const FIELD_GRASS = 0.35;
// (Same rule as plantEmoji in game.js. If you change one, change the other.)
function isFlower(w, p) {
  if (w.water[p.i]) return false;
  const s = seasonOf(w.tick);
  if (p.field) return s === p.field.season && w.grass[p.i] >= FIELD_GRASS;
  if (w.grass[p.i] < 0.55) return false;
  return (s === 0 && p.kind < 0.35) || (s === 1 && p.kind < 0.22);
}

// A flower no other bee is headed to or sipping from (p.bee), that has had time to fill again.
const taken = p => p.bee && p.bee.alive && p.bee.target === p;
const freshFlower = (w, p) => !taken(p) && (!p.sipped || w.tick - p.sipped > REFILL) && isFlower(w, p);

// The nearest fresh flower in sight, within reach of home.
function findFlower(w, c) {
  let best = null, bd = c.sight * c.sight;
  const h = c.home, reach = FORAGE_RANGE * FORAGE_RANGE;
  forEachPlantNear(w, c.x, c.y, c.sight, p => {
    const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    const closer = d2 < bd || (d2 === bd && best && p.n < best.n);   // a tie goes to the first plant, whichever cell it's in
    if (closer && (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < reach && freshFlower(w, p)) { best = p; bd = d2; }
  });
  return best;
}

// Head for the nearest fresh flower and claim it (p.bee), so the next bee picks another.
function pickFlower(w, c) {
  const p = findFlower(w, c);
  if (!p) return false;
  p.bee = c; c.mode = 'flower'; c.target = p;
  return true;
}

// How many fresh flowers are close around this one: how rich the patch is.
function freshAround(w, f) {
  let n = 0;
  forEachPlantNear(w, f.x, f.y, 8, p => { if ((p.x - f.x) ** 2 + (p.y - f.y) ** 2 < 64 && freshFlower(w, p)) n++; });
  return n;
}

// A visited flower spreads its seed: the grass around it grows back thicker. Good for rabbits.
function pollinate(w, p) {
  for (let y = (p.y | 0) - 2; y <= (p.y | 0) + 2; y++) {
    for (let x = (p.x | 0) - 2; x <= (p.x | 0) + 2; x++) {
      if (!dry(w, x, y)) continue;
      const i = idx(x, y);
      w.grass[i] = Math.min(w.fert[i], w.grass[i] + POLLEN);
    }
  }
}

function beeMood(w, c) {
  if (c.hidden && c.energy < 0.5 * c.maxEnergy && c.home.honey > 0) return { emoji: '🍯', text: 'Eating honey in the hive' };
  if (c.hidden && !isAdult(w, c)) return { emoji: '🐣', text: 'A young house bee, feeding the brood' };
  if (c.hidden) return clusterCold(w, c.home) > 1.5 ? { emoji: '🥶', text: 'Shivering in a small winter cluster' }
    : { emoji: '💤', text: w.flowers < FEW_FLOWERS ? 'Waiting in the hive for the flowers' : 'Asleep in the hive' };
  switch (c.mode) {
    case 'sip': return { emoji: '🌼', text: 'Sipping nectar' };
    case 'flower': return { emoji: '🌸', text: 'Off to a flower' };
    case 'home': return { emoji: '🏠', text: 'Flying home to the hive' };
    case 'unload': return { emoji: '🍯', text: 'Carrying nectar home' };
    case 'dance': return { emoji: '💃', text: 'Dancing to tell the others about a rich patch of flowers' };
    case 'patch': return { emoji: '🧭', text: c.target && c.target.field ? `Off to the ${c.target.field.name}` : 'Off to the flowers a dancer told of' };
    case 'swarm': return { emoji: '', text: 'Hanging in the swarm, waiting for the scouts' };
    case 'scout': return { emoji: '🔎', text: 'Scouting for a new home for the swarm' };
    case 'wander': return { emoji: '', text: 'Buzzing about' };
  }
  return null;
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
    cause === 'flood' ? 'Drowned when the burrow flooded' :
    `Died of old age, ${age} days old`;
  note(w, c, { fox: '🦊', hunger: '🥀', lightning: '⚡', fire: '🔥', flood: '🌊' }[cause] || '🌙', text);
  w.stats.deaths[c.species][cause] = (w.stats.deaths[c.species][cause] || 0) + 1;
  w.anyDied = w.recount = true;
  emit(w, { type: 'death', c, cause, killer });
}

function lifeTick(w, c) {
  const g = growth(w, c);
  let b = c.burnRate * (0.5 + 0.5 * g);
  if (c.sleeping) b *= 0.6;
  if (c.species === 'bee' && c.hidden) b *= 0.3 * clusterCold(w, c.home);   // huddled in the hive, barely burning
  if (c.pregnantUntil) b *= 1.25;
  const kind = w.weather.kind;
  if (kind === 'snow' && !c.hidden) b *= 1 + 0.5 * (1 - c.genes.size);   // small bodies feel the cold
  if (w.snow > 0.3 && !c.hidden) b *= 1 - MOULT_WARM * whiteness(w, c);
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
    grid: makeGrid(), grids: perKind(makeGrid),
    nameCounts: new Map(), anyDied: false,
    weather: { kind: 'clear', until: 0 }, skyLocked: false, wet: 0.3, snow: 0,
    fire: new Float32Array(W * H), ash: new Float32Array(W * H), silt: new Float32Array(W * H), burning: [], blaze: 0,
    count: perKind(() => 0), expecting: perKind(() => 0),
    stats: { births: perKind(() => 0), deaths: perKind(() => ({})) },
    history: { every: 60, t: [], grass: [], ...perKind(() => []), traits: perKind(() => []), marks: [] },
    goneSince: perKind(() => -1), hives: [],
    options: { migration: true, ...opts },
  };
  makeTerrain(w);
  placeHive(w);
  const n = { rabbit: opts.rabbits ?? Math.round(30 * w.room), fox: opts.foxes ?? Math.round(4 * w.room), bee: opts.bees ?? 12 };
  for (const species of KINDS) {
    for (let k = 0; k < n[species]; k++) {
      let x, y;
      do { x = w.rng.range(4, W - 4); y = w.rng.range(4, H - 4); } while (!dry(w, x, y));
      const age = species === 'bee' ? w.rng.range(1, 2) : w.rng.range(4, 10);   // summer bees only live a few days
      addCreature(w, species, x, y, { sex: k % 2 ? 'M' : 'F', age });
    }
  }
  flushNewborn(w);
  hivesTick(w);
  w.founderMeans = perKind(s => traitMeans(w, s));
  w.weather.until = w.tick + w.rng.range(0.3, 0.8) * TPD;
  record(w);
  return w;
}

// The newborn join everyone else, and the numbers are counted again when anything changed them:
// a birth, a death, or a pregnancy (w.recount).
function flushNewborn(w) {
  if (!w.newborn.length && !w.recount) return;
  w.recount = false;
  for (const k of w.newborn) w.creatures.push(k);
  w.newborn.length = 0;
  for (const s of KINDS) w.count[s] = w.expecting[s] = 0;
  for (const c of w.creatures) {
    if (!c.alive) continue;
    w.count[c.species]++;
    if (c.pregnantUntil) w.expecting[c.species] += (c.sp.litter[0] + c.sp.litter[1]) / 2;
  }
}

function traitMeans(w, species) {
  const m = {}; let n = 0;
  const genes = genesOf(species);
  for (const k of genes) m[k] = 0;
  for (const c of w.creatures) {
    if (!c.alive || c.species !== species) continue;
    for (const k of genes) m[k] += c.genes[k];
    n++;
  }
  if (!n) return null;
  for (const k of genes) m[k] /= n;
  return m;
}

function coatCounts(w) {
  const n = { wild: 0, black: 0, sand: 0, blue: 0 };
  for (const c of w.creatures) if (c.alive && c.genes.coat) n[coatOf(c.genes)]++;
  return n;
}

// How full the meadow is: 1 when every tile holds all the grass its soil allows.
function grassFullness(w) {
  let g = 0, f = 0;
  for (let i = 0; i < W * H; i++) if (!w.water[i]) { g += w.grass[i]; f += w.fert[i]; }
  return f ? g / f : 0;
}

// The whole story is kept. When it gets long, every other sample goes and sampling slows down.
const HISTORY_MAX = 4000;
function record(w) {
  const h = w.history;
  h.t.push(w.tick);
  h.grass.push(grassFullness(w));
  for (const s of KINDS) { h[s].push(w.count[s]); h.traits[s].push(traitMeans(w, s)); }
  if (h.t.length > HISTORY_MAX) {
    const half = a => a.filter((_, i) => i % 2 === 0);
    for (const k of ['t', 'grass', ...KINDS]) h[k] = half(h[k]);
    for (const s of KINDS) h.traits[s] = half(h.traits[s]);
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
  const wait = { rabbit: 1, fox: 3, bee: 2 }, arrive = { rabbit: 6, fox: 2, bee: 8 }, few = { rabbit: 4, fox: 3, bee: 4 };
  for (const s of KINDS) {
    if (w.count[s] >= few[s]) { w.goneSince[s] = -1; continue; }
    if (w.goneSince[s] < 0) { w.goneSince[s] = w.tick; if (w.count[s] === 0) emit(w, { type: 'extinct', species: s }); continue; }
    if (w.tick - w.goneSince[s] < wait[s] * TPD) continue;
    if (s === 'fox' && w.count.rabbit < 60 * w.room) continue;   // foxes only come where there is food
    if (s === 'bee' && w.flowers < FEW_FLOWERS) continue;         // a swarm comes when the flowers are out
    const side = w.rng.int(0, 3);
    const kids = [];
    for (let k = 0; k < arrive[s]; k++) {
      let x, y, tries = 0;
      do {
        const u = w.rng.range(4, (side % 2 ? H : W) - 4);
        [x, y] = side === 0 ? [u, 2] : side === 1 ? [W - 2, u] : side === 2 ? [u, H - 2] : [2, u];
        if (s === 'bee') { const h = w.hives[0]; x = h.x + w.rng.range(-2, 2); y = h.y + w.rng.range(-2, 2); }   // a swarm settles in the hive
      } while (!dry(w, x, y) && ++tries < 50);
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
  if (t % WATER_EVERY === 0) waterTick(w);
  if (t % 60 === 0) hivesTick(w);
  const list = w.creatures;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c.alive) continue;
    if (c.species === 'rabbit') rabbitTick(w, c);
    else if (c.species === 'fox') foxTick(w, c);
    else if (c.species === 'bee') beeTick(w, c);
    if (c.alive) lifeTick(w, c);
  }
  if (w.anyDied) { w.creatures = w.creatures.filter(c => c.alive); w.anyDied = false; }
  flushNewborn(w);
  if (t % w.history.every === 0) record(w);
  if (t % (TPD / 4) === 0) migrate(w);
  if (t % TPD === 0) { forgetTheLongDead(w); collapseBurrows(w); }
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
  if (c.species === 'bee') { const m = beeMood(w, c); if (m) return m; }
  switch (c.mode) {
    case 'flee':
      if (c.fright > 0) return c.frightWhat === 'fire' ? { emoji: '🔥', text: 'Running from the fire!' }
        : { emoji: '⚡', text: 'Spooked by thunder!' };
      return { emoji: '😱', text: `Running from ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'alarm': return { emoji: '‼️', text: `Spotted ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'dig': return { emoji: '🕳️', text: 'Digging a burrow' };
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
  W, H, TPD, SHALLOW, DEEP, SEASON_DAYS, YEAR_DAYS, SEASONS, SPECIES, GENES, COATS, GROUND, WEATHER,
  createWorld, step, clock, isNight, phaseOf, seasonOf, mood, ageDays, growth, isAdult, patchFresh,
  addCreature, paintGrass, setSky, lockSky, zap, traitMeans, walkable,
  coatOf, hiddenCoats, coatCounts, visibility, whiteness, WINTER_COAT, KINDS,
  TERRAIN, distanceToWater, fieldBloom, FIELD_GRASS, settleWater, LOAD, HONEY,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
