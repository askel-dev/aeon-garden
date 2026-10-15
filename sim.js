/* Nobody's Meadow — the simulation.
 *
 * Nothing in here draws. game.js reads the world and paints it; this file only decides
 * what happens. It also runs under node (`require('./sim.js')`) so balance can be checked
 * headless, years at a time.
 *
 * Every animal follows the same small ladder, ported from the old reflex brain:
 *   danger > sleep > love > food > friends > wander
 * Nothing else is scripted. Herds, arms races and boom-bust years come out of that.
 * The weather leans on the ladder: thunder is danger, storms are for sleeping.
 */
(function (root) {
'use strict';

// ---------------------------------------------------------------- world constants

const W = 150, H = 100;         // map size in tiles
const ROOM_TILES = 9000;        // dry tiles the numbers below were tuned for; bigger meadows hold more
const TPD = 21600;              // ticks per day: 12 minutes at 1x (30 ticks a second)
const SEASON_DAYS = 7;
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

// The clock. The meadow's numbers were first tuned on a 600-tick day (20 s). What happens in a day (grass grown and
// eaten, fish caught, kits born, the old dying) stays as it was then, so a rate a tick of that kind is SLOW times
// smaller now; what you watch (a step, a sip, a dive, a chase) takes as long as it did, in ticks. Hunger sits between:
// an animal you follow should get hungry a few times a day, not once in a few days, so most burn HUNGER times what the
// day's numbers say and their food fills them as much more, while a bite takes HUNGER times less of the grass, the
// fish or the frogs (BITE, TAKES). A fox is the one that keeps to the day: its food comes one rabbit at a time.
const SLOW = TPD / 600;
const HUNGER = 8;
const EAT = HUNGER / SLOW;      // a hungry kind's energy a tick, against the 600-tick day's
const GRASS_EVERY = 60;         // ticks between growing the grass (and the ice)
const SLEEP_BURN = 0.3;         // asleep, an animal burns this much: the nights are long against its hunger

const GRASS_RATE = 0.4;         // logistic growth per day at full season
const SEED_RATE = 0.06;         // regrowth trickle on bare ground, per day
const DIEBACK = 0.35;           // per day, above the season's cap
const BITE = 0.012 / SLOW;      // grass eaten per tick of grazing
const GRASS_ENERGY = 40 * HUNGER;   // energy per unit of grass
const MOVE_COST = 0.25;         // energy per tick = MOVE_COST * v^2 / walk, times its kind's hunger

// Every animal of a kind is alike (SPECIES): no genes, and young don't take after their parents. Only a look
// differs: a little bigger or smaller (c.scale), and a fox's shade (c.fur), which its cubs share. burn: energy a
// tick on the 600-tick day, and hunger: how much of that it burns a tick now (see HUNGER); walk and sprint: tiles a tick.
const SPECIES = {
  rabbit: {
    key: 'rabbit', name: 'Rabbit', plural: 'Rabbits', emoji: '🐇',
    maxEnergy: 100, burn: 0.035, hunger: EAT, walk: 0.06, sprint: 0.155, sight: 10, mateRange: 24, wade: 0.45,
    matureDays: 6, lifeDays: 30, gestationDays: 2, litter: [2, 5], cooldownDays: 2,
    breedSeasons: [0, 1], breedEnergy: 0.55, birthCost: 10, cap: 150,   // the cap holds them, with the foxes
  },
  fox: {
    key: 'fox', name: 'Fox', plural: 'Foxes', emoji: '🦊',
    maxEnergy: 220, burn: 0.035, hunger: 1 / SLOW, walk: 0.07, sprint: 0.21, sight: 18, mateRange: 45, wade: 0.6,
    matureDays: 11, lifeDays: 56, gestationDays: 3.5, litter: [2, 4], cooldownDays: 14,
    breedSeasons: [0, 1], breedEnergy: 0.65, birthCost: 25, cap: 12,
  },
  bee: {
    key: 'bee', name: 'Bee', plural: 'Bees', emoji: '🐝',
    maxEnergy: 30, burn: 0.02, hunger: EAT, walk: 0.2, sprint: 0.3, sight: 15, wade: 1, flies: true,
    matureDays: 0.3, lifeDays: 5, winterLifeDays: 18,   // summer bees wear out in days; autumn-born ones last the winter
    breedSeasons: [0, 1, 2], cap: 150,                  // the queen lays (hivesTick), no pairing up
  },
  crow: {
    key: 'crow', name: 'Crow', plural: 'Crows', emoji: '🐦‍⬛',   // (game.js paints them: older systems split this emoji in two)
    maxEnergy: 80, burn: 0.028, hunger: EAT, walk: 0.35, sprint: 0.45, sight: 30, mateRange: 60, wade: 1, flies: true, glide: 0.2,   // walk: its flying pace; glide: what flying costs, of walking
    matureDays: 8, lifeDays: 84, gestationDays: 3, litter: [1, 3], cooldownDays: 21,   // one brood a year, in a tall tree
    breedSeasons: [0], breedEnergy: 0.6, birthCost: 8, cap: 24,
  },
  otter: {
    key: 'otter', name: 'Otter', plural: 'Otters', emoji: '🦦',   // (game.js paints them: the emoji floats on its back, and differs from system to system)
    maxEnergy: 150, burn: 0.03, hunger: EAT, walk: 0.055, sprint: 0.15, sight: 12, mateRange: 150, wade: 1.6, swims: true, glide: 0.4,   // wade: in the water it's quicker; glide: what moving costs it
    matureDays: 14, lifeDays: 84, gestationDays: 3, litter: [2, 3], cooldownDays: 21,   // one litter a year, in the holt
    breedSeasons: [0], breedEnergy: 0.55, birthCost: 15, cap: 6,
  },
};
const KINDS = Object.keys(SPECIES);                        // 'rabbit', 'fox', 'bee', 'crow', 'otter'
const perKind = make => Object.fromEntries(KINDS.map(s => [s, make(s)]));   // { rabbit: .., fox: .., bee: .., crow: .., otter: .. }

const NAME_PARTS = {
  rabbit: {
    prefixes: ['Cott', 'Snow', 'Bramb', 'Wil', 'Truf', 'Hazel', 'Ac', 'Peb', 'Dan', 'Tans'],
    suffixes: ['tail', 'drop', 'le', 'low', 'flee', 'nut', 'orn', 'ble', 'delion', 'sy', 'foot', 'paws'],
    whole: ['Juni']
  },
  fox: {
    prefixes: ['Rus', 'Em', 'Scar', 'Cin', 'Fen', 'Marm', 'Ash', 'Kin', 'Am', 'Vix'],
    suffixes: ['ty', 'ber', 'let', 'der', 'nec', 'alade', 'ley', 'dle', 'ber', 'en', 'flame', 'spark']
  },
  bee: {
    prefixes: ['Buzz', 'Honey', 'Nectar', 'Pollen', 'Sting', 'Hive', 'Clover', 'Amber', 'Comb', 'Flower'],
    suffixes: ['bee', 'buzz', 'sting', 'hive', 'nectar', 'pollen', 'wing', 'comb', 'dew', 'flower', 'le', 'by', 'wick', 'ly', 'ina', 'drop', 'kin', 'ette', 'o']
  },
  crow: {
    prefixes: ['Soot', 'Ink', 'Char', 'Coal', 'Rook', 'Caw', 'Jet', 'Smudge', 'Crag', 'Pitch'],
    suffixes: ['wing', 'feather', 'beak', 'claw', 'caw', 'ley', 'by', 'ton', 'wick', 'o']
  },
  otter: {
    prefixes: ['Rip', 'Peb', 'Tum', 'Wil', 'Brook', 'Reed', 'Sil', 'Spl', 'Mudd', 'Bub'],
    suffixes: ['ple', 'ble', 'low', 'ash', 'kin', 'tail', 'ey', 'whisker', 'by', 'paws']
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
    state: () => s,                                  // makeRng(state) carries on from here (packWorld)
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
// Math.hypot of two numbers, worked out just as the browsers do (Chrome and Safari: the larger of the two, times the
// root of the sum of both squared over it), so it comes out the same to the last digit, without the builtin's cost:
// it was the sim's busiest call.
function hypot(x, y) {
  const a = Math.abs(x), b = Math.abs(y), m = a !== a ? b : b !== b || a > b ? a : b;
  if (m === Infinity) return Infinity;
  if (x !== x || y !== y) return NaN;
  if (m === 0) return 0;
  const p = a / m, q = b / m;
  return Math.sqrt(p * p + q * q) * m;
}
function hash2(x, y, seed) {                             // 0..1 from three whole numbers, the same every time
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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
// deep water can't be crossed. Every meadow gets a river, a lake or both, and most get a few
// ponds of their own, away from the rest: on their own, or a cluster of little pools.

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
  lakeReach: [11, 18],         // how far a lake reaches from its middle, across it
  lakeStretch: [1, 1.7],       // how much longer it is than wide
  riverLake: [1.4, 2.2],       // and a lake on the river, lying along it
  lakeShore: 0.6,              // how far its shore wanders in and out: bays and points
  lakeShelf: [0.5, 8],         // the shallows round it, from a steep drop to a wide reedy shelf
  shelfDepth: 0.18,            // how deep a shelf gets at its outer edge (under deepAt: wadeable)
  delta: 6,                    // how much wider the shallows are where the river comes in
  islands: 0.4,                // odds a lake has an island
  islandHeight: 0.07,          // how high an island's shore stands: clear of the spring flood
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
  ponds: [0, 4],               // ponds out on their own
  pondSize: [3, 7.5],          // how far one reaches from its middle; most are smallish, a big one deep enough for otters
  pondStretch: [1, 1.8],       // how much longer than wide
  pondShore: 0.4,              // how far its shore wanders in and out
  pondShelf: [0.3, 1.5],       // its shallows, from a steep drop to a wide shelf
  pondDepth: [0.12, 1],        // most are shallowish; one under deepAt is all shallows
  pools: 0.35,                 // odds of a cluster of little pools in one low corner
  poolCount: [3, 6],           // how many pools in it
  poolSize: [1.2, 2.6],        // and how far each reaches from its middle
  patches: 36,                 // fertile and poor patches of soil
  patchSize: [7, 20],
  patchRichness: [-0.45, 0.6], // from poor to rich
  wetBanks: 0.35,              // how much richer the soil is by the water
  forests: [['hills'], ['edge'], ['bank'], ['hills', 'bank'], ['edge', 'bank'], ['hills', 'edge']],   // one is picked
  hillWoods: 0.14,             // share of the highest ground that is wooded
  edgeWoods: [12, 18],         // how far a big wood along one side reaches in
  bankWoods: [22, 30],         // how far a wet wood stretches along the water
  treeSpacing: 2.3,            // tiles between trees where a wood is thick
  fringe: 0.5,                 // odds a spot on the bank of water that lasts (above the spring flood) has a tree, where the bank is treed
  fringeGaps: 0.45,            // and how much of the bank is open instead, in stretches (where the otters slide)
  fringeSpacing: 3,            // tiles between the trees along the bank
  treeSize: [2.7, 5.2],        // smallest to biggest tree; most are small, a few are giants
  groves: 4,                   // small clumps of trees out in the meadow
  rocks: 40,                   // scattered rocks, from pebbles to boulders
  rockSize: [0.7, 2.3],        // smallest to biggest; the bigger, the likelier a boulder
  bigRocks: [2, 3],            // great rocks: a rare landmark or two, out in the open
  bigRockSize: [3.4, 4.8],     // and how big they are
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
const walkable = (w, x, y) => inBounds(x, y) && (w.water[idx(x, y)] !== DEEP || w.frozen);   // ice takes any weight
const dry = (w, x, y) => inBounds(x, y) && !w.water[idx(x, y)];
const footing = (w, x, y) => inBounds(x, y) && (w.frozen || !w.water[idx(x, y)]);   // dry land, or the ice

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
  for (const c of shape) d = Math.min(d, hypot(x - c.x, y - c.y) - c.r);
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

// Marks in `out` the tiles joined to `from` (four ways) that pass `ok`, and returns them.
function spread(out, from, ok) {
  const stack = [from], all = [];
  out[from] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % W;
    all.push(i);
    for (const j of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < W * H && !out[j] && ok(j)) { out[j] = 1; stack.push(j); }
    }
  }
  return all;
}

// A hollow that holds water: a bowl reaching `size` tiles from its middle, `stretch` times that along
// `turn`, its rim pushed in and out by noise (`rough`) so the shore gets bays and points, and with `isle`
// ({ s, ok }) a hump about `s` tiles round that stands out of the water, well inside it, on a spot `ok(x, y)`
// likes. The tiles under water: the bowl below its rim joined to its lowest part, with any speck of land in it
// too small for an island let under. The island's tiles are mask.isles.
function basin(r, noise, cx, cy, size, stretch, turn, rough, isle) {
  const N = W * H, h = new Float32Array(N).fill(9), ca = Math.cos(turn), sa = Math.sin(turn);
  const ox = r.range(0, 60), oy = r.range(0, 60), lobe = Math.max(4, size * 0.8), reach = size * (stretch + rough) * 1.6 + 3;
  const x0 = Math.max(0, Math.floor(cx - reach)), x1 = Math.min(W - 1, cx + reach);
  const y0 = Math.max(0, Math.floor(cy - reach)), y1 = Math.min(H - 1, cy + reach);
  const box = fn => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(y * W + x, x + 0.5, y + 0.5); };
  box((i, px, py) => {
    const dx = px - cx + (noise(ox + px / lobe, oy + py / lobe) - 0.5) * 3 * rough * size;   // the rim pushed in and out
    const dy = py - cy + (noise(oy + py / lobe + 31, ox + px / lobe + 17) - 0.5) * 3 * rough * size;
    const u = (dx * ca + dy * sa) / stretch, v = dy * ca - dx * sa;
    h[i] = (u * u + v * v) / (size * size) + 0.5 * rough * (noise(ox + px / 3.5, oy + py / 3.5) - 0.5);   // and ragged
  });
  if (isle) {                                                     // on a spot with open water all round it
    const R = isle.s * 1.4 * r.range(1, 1.6), across = r.range(1, 1.6), it = r.range(0, Math.PI), spots = [];
    const open = (ix, iy) => {
      for (let y = Math.floor(iy - R - 2); y <= iy + R + 2; y++) for (let x = Math.floor(ix - R - 2); x <= ix + R + 2; x++) {
        if ((x + 0.5 - ix) ** 2 + (y + 0.5 - iy) ** 2 < (R + 1.5) ** 2 && (x < x0 || x > x1 || y < y0 || y > y1 || h[y * W + x] >= 0.9)) return false;
      }
      return true;
    };
    box((i, px, py) => { if (h[i] < 0.6 && isle.ok(px, py) && open(px, py)) spots.push(i); });
    if (spots.length) {
      const at = r.pick(spots), ix = at % W + 0.5, iy = ((at / W) | 0) + 0.5, ic = Math.cos(it), is = Math.sin(it);
      box((i, px, py) => {                                       // longer one way, and ragged
        const u = (px - ix) * ic + (py - iy) * is, v = ((py - iy) * ic - (px - ix) * is) * across, q = 1 - (u * u + v * v) / (R * R);
        if (q > 0) h[i] += 2 * q * q * (0.7 + 0.6 * noise(oy + px / 2.5, ox + py / 2.5));
      });
    }
  }
  let lo = Infinity, start = -1;
  box(i => { if (h[i] < lo) { lo = h[i]; start = i; } });
  const mask = new Uint8Array(N);
  mask.isles = [];
  if (lo >= 1) return mask;
  spread(mask, start, i => h[i] < 1);
  const open = new Uint8Array(N);                                // the land, from the edge of the map in
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !mask[i] && !open[i]) spread(open, i, j => !mask[j]);
  }
  for (let i = 0; i < N; i++) {                                   // and the land the water rings round
    if (mask[i] || open[i]) continue;
    const land = spread(open, i, j => !mask[j]);
    if (land.length < 6) for (const j of land) mask[j] = 1;
    else mask.isles.push(...land);
  }
  return mask;
}

// Carves a basin into the ground: a shelf of shallows, wide in some places and a steep drop in others
// (as the noise goes, at `scale` tiles), then down to `deep`; `wide` spreads the shelf out round one spot.
// Where a lake's shelf is wide its bank is gentle too, so the spring flood spreads out there. It eases into
// the ground about it (a soft min), so a hollow in a hill has no crease, and its islands stand clear of the flood.
function carveBasin(r, T, noise, mask, ground, deep, shelf, wide, scale = 14) {
  const into = blurred(distanceTo(mask.map(v => 1 - v)), 1), out = distanceTo(mask);
  const ox = r.range(0, 60), oy = r.range(0, 60), soft = 0.05;
  const vary = (x, y, s) => clamp((noise(ox + x / s, oy + y / s) - 0.38) / 0.24, 0, 1);
  for (let i = 0; i < W * H; i++) {
    if (out[i] > 14) continue;
    const x = i % W + 0.5, y = ((i / W) | 0) + 0.5, slow = vary(x, y, 14);
    let h;
    if (mask[i]) {
      let s = lerp(...shelf, scale === 14 ? slow : vary(x, y, scale));
      if (wide) s += wide.add * Math.exp(-((x - wide.x) ** 2 + (y - wide.y) ** 2) / 128);
      const d = into[i] - 0.5, top = Math.min(T.shelfDepth, deep);
      h = -(d < s ? top * (0.3 + 0.7 * d / s) : top + (deep - top) * Math.min(1, (d - s) / 3));
    } else h = T.bank * lerp(1.5, 0.4, slow) * (out[i] - 0.5);
    const gap = Math.max(0, soft - Math.abs(h - ground[i]));
    ground[i] = Math.min(h, ground[i]) - gap * gap / (4 * soft);
  }
  for (const i of mask.isles) ground[i] = T.islandHeight + T.bank * 0.5 * (out[i] - 1);
}

// The lake's shape: a basin round its middle, lying along the river if one runs through it, its shallows
// spreading out where the river comes in (lake.inflow). lake.out: tiles from the lake, 0 in it.
function shapeLake(r, T, noise, lake, river) {
  let turn = r.range(0, Math.PI), stretch = r.range(...T.lakeStretch);
  if (river) {
    let k = 0, best = Infinity;
    river.forEach((p, j) => { const d = dist2(p, lake); if (d < best) { best = d; k = j; } });
    const a = river[Math.max(0, k - 8)], b = river[Math.min(river.length - 1, k + 8)];
    turn = Math.atan2(b.y - a.y, b.x - a.x) + r.range(-0.3, 0.3); stretch = r.range(...T.riverLake);
  }
  Object.assign(lake, { reach: r.range(...T.lakeReach), turn, stretch });
  let isle = null;
  if (r.next() < T.islands) {                            // an island, well clear of the river's way through
    const s = r.range(2, 3.4) * Math.sqrt(lake.reach / 12), clear = (s * 1.3 + 3) ** 2;
    isle = { s, ok: (x, y) => !river || river.every(q => (x - q.x) ** 2 + (y - q.y) ** 2 > clear) };
  }
  lake.mask = basin(r, noise, lake.x, lake.y, lake.reach, stretch, turn, T.lakeShore, isle);
  lake.out = distanceTo(lake.mask);
  const k = river ? river.findIndex(p => inBounds(p.x, p.y) && lake.mask[idx(p.x, p.y)]) : -1;
  lake.inflow = k > 0 ? { x: river[k].x, y: river[k].y, add: T.delta } : null;
}
const lakeGap = (lake, x, y) => (inBounds(x, y) ? lake.out[idx(x, y)] : Infinity);

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
    const n = Math.ceil(hypot(p2.x - p1.x, p2.y - p1.y) * 2);
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
    const d = hypot(b.x - a.x, b.y - a.y) || 1, calm = lake ? clamp(hypot(p.x - lake.x, p.y - lake.y) / 15 - 0.5, 0, 1) : 1;
    const off = T.meander * (wiggle(k / T.meanderLength, 3.3) - 0.5) * calm;
    return { x: p.x - (b.y - a.y) / d * off, y: p.y + (b.x - a.x) / d * off };
  });
}

// A brook: in from the edge on one side of the river, joining it at a slant, downstream.
// It keeps clear of the lake and of the river's other bends. Null if no good way was found.
function brookPath(r, T, river, lake, wiggle) {
  for (let tries = 0; tries < 12; tries++) {
    const k = Math.floor(river.length * r.range(0.25, 0.75)), join = river[k];
    if (!inBounds(join.x, join.y) || (lake && lakeGap(lake, join.x, join.y) < 8)) continue;
    const a = river[Math.max(0, k - 6)], b = river[Math.min(river.length - 1, k + 6)];
    const d = hypot(b.x - a.x, b.y - a.y) || 1, fx = (b.x - a.x) / d, fy = (b.y - a.y) / d;   // the way the river flows
    const side = r.next() < 0.5 ? 1 : -1;
    let ox = -fy * side - fx * 0.7, oy = fx * side - fy * 0.7;                   // out to one side, and back upstream
    const o = hypot(ox, oy); ox /= o; oy /= o;
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
    const clear = pts.every(p => hypot(p.x - join.x, p.y - join.y) < 10 ||
      (!(lake && lakeGap(lake, p.x, p.y) < 4) && river.every(q => Math.abs(p.x - q.x) > 6 || Math.abs(p.y - q.y) > 6)));
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
        carve(y * W + x, hypot(x + 0.5 - p.x, y + 0.5 - p.y) - half, deep, half);
      }
    }
  });
  for (const k of fords) w.fords.push({ x: pts[k].x, y: pts[k].y, k, river: w.rivers.length });
  w.rivers.push({ pts, brook });
}

// Picks one of the keys of { name: odds }.
function pickOdds(r, odds) {
  const keys = Object.keys(odds);
  let u = r.next() * keys.reduce((sum, k) => sum + odds[k], 0);
  for (const k of keys) if ((u -= odds[k]) < 0) return k;
  return keys[keys.length - 1];
}

// A rock: a pebble, a stone or a boulder, a great rock (big) or a flat stone at a ford (stone). Every rock laid out
// alike (see blankCreature), with room for the fish about it should otters make their holt under it (holtFish).
const rockOf = (x, y, size, big = false, stone = false) => ({ x, y, emoji: '🪨', size, big, stone, holtFish: NaN });
// What a rock is, from where it lies and its size alone (game.js paints it so): a ford's flat stone, a great rock, or, the
// bigger the likelier the later, a few pebbles, a stone or a boulder.
function rockKind(d) {
  if (d.stone) return 'ford';
  if (d.big) return 'great';
  const h = hash2(Math.floor(d.x * 100), Math.floor(d.y * 100), 60), grown = clamp((d.size - 0.7) / 1.6, 0, 1);
  return h < 0.45 - 0.3 * grown ? 'pebbles' : h < 0.85 - 0.35 * grown ? 'stone' : 'boulder';
}
// A flower (w.plants), or a spot of blossom in a tree's crown (w.blossoms: its tree, and up, how high in it). The bees look
// at both, so both are laid out alike, with room for the bee headed to it and when it was last sipped (pickFlower).
const plantOf = (x, y, i, kind, field, n, tree = null, up = -0) => ({ x, y, i, kind, field, n, tree, up, bee: null, sipped: 0 });

function makeTerrain(w) {
  const r = w.rng, N = W * H;
  const T = w.terrain = { ...TERRAIN };
  const hills = makeNoise(r);
  // The lakes' and ponds' shores have random numbers of their own, so tuning them leaves the rest of the meadow be.
  const wr = makeRng(w.seed ^ 0x3a7e5), shores = makeNoise(wr);
  const hill = new Float32Array(N);
  for (let i = 0; i < N; i++) hill[i] = hills((i % W) / T.hillSize, ((i / W) | 0) / T.hillSize, T.hillDetail);
  const each = fn => { for (let i = 0; i < N; i++) fn(i, (i % W) + 0.5, ((i / W) | 0) + 0.5); };

  // First where the water will go: the lake and the river.
  const layout = pickOdds(r, T.layouts);
  const lake = layout === 'river' || layout === 'none' ? null : placeLake(r, T, hills);
  const river = layout === 'valley' || layout === 'river' ? riverPath(r, T, lake, hills) : null;
  if (lake) shapeLake(wr, T, shores, lake, river);
  const brook = river && r.next() < T.brooks ? brookPath(r, T, river, lake, hills) : null;
  // Then the ground: the land slopes down into a valley around that water, so a rising water
  // level spreads out from the river first. A brook's valley is half as wide. Away from them the
  // hills rise from low meadows that still dip and swell a little, and no hilltop sits right by
  // the water.
  const valley = (shapes, lines, width, mask) => {
    const planned = new Uint8Array(N);
    each((i, x, y) => { if ((mask && mask[i]) || shapes.some(sh => outside(sh, x, y) < 0)) planned[i] = 1; });
    for (const pts of lines) for (const p of pts) if (inBounds(p.x, p.y)) planned[idx(p.x, p.y)] = 1;
    if (!planned.some(v => v)) return () => 1;
    const d = blurred(blurred(distanceTo(planned), 2), 2);             // blurred, or it shows its eight directions
    return i => 1 - (1 - clamp(d[i] / width, 0, 1)) ** 2;              // rises fast from the water, then levels off
  };
  const byRiver = valley([], [river || []], T.valley, lake && lake.mask);
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
  w.isle = new Uint8Array(N);                                     // islands: no burrows on them (canDig)
  if (lake) {
    carveBasin(wr, T, shores, lake.mask, ground, T.lakeDepth, T.lakeShelf, lake.inflow);
    for (const i of lake.mask.isles) w.isle[i] = 1;
  }
  const inLake = p => lake && lakeGap(lake, p.x, p.y) < 6;
  w.rivers = []; w.fords = [];
  if (river) carveRiver(w, T, river, inLake, carve);
  if (brook) carveRiver(w, T, brook, p => inLake(p) || hypot(p.x - brook.at(-1).x, p.y - brook.at(-1).y) < 12, carve, true);

  // Ponds, each in the lowest of a few spots away from the other water, so they gather in the hollows:
  // a few out on their own, most of them small, and now and then a cluster of little pools in one low corner.
  w.water = new Uint8Array(N);
  w.ground = ground; w.level = T.level;
  refreshWater(w);
  const lowSpot = (x0, y0, x1, y1, gap) => {
    let best = null, low = Infinity;
    for (let k = 0; k < 6; k++) {
      const x = wr.range(Math.max(4, x0), Math.min(W - 4, x1)), y = wr.range(Math.max(4, y0), Math.min(H - 4, y1));
      if (ground[idx(x, y)] < low && !waterWithin(w, x, y, gap)) { best = { x, y }; low = ground[idx(x, y)]; }
    }
    return best;
  };
  const pond = (at, size) => {
    const mask = basin(wr, shores, at.x, at.y, size, wr.range(...T.pondStretch), wr.range(0, Math.PI), T.pondShore, null);
    carveBasin(wr, T, shores, mask, ground, lerp(...T.pondDepth, wr.next() ** 1.3), T.pondShelf, null, Math.max(2.5, size));
    for (const i of mask.isles) w.isle[i] = 1;
    refreshWater(w);
  };
  {
    for (let p = wr.int(...T.ponds), tries = 0; p > 0 && tries < 200; tries++) {
      const size = lerp(...T.pondSize, wr.next() ** 1.8), at = lowSpot(14, 12, W - 14, H - 12, size * 1.8 + 8);
      if (at) { pond(at, size); p--; }
    }
    const at = wr.next() < T.pools && lowSpot(16, 14, W - 16, H - 14, 18);
    for (let p = at ? wr.int(...T.poolCount) : 0, tries = 0; p > 0 && tries < 60; tries++) {
      const size = wr.range(...T.poolSize), spot = lowSpot(at.x - 9, at.y - 7, at.x + 9, at.y + 7, size * 1.6 + 2.5);
      if (spot) { pond(spot, size); p--; }
    }
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
    if (dry(w, x, y)) w.decor.push(rockOf(x, y, r.range(...T.rockSize)));
  }
  for (let n = r.int(...T.bigRocks), tries = 0; n > 0 && tries < 500; tries++) {   // away from the water, woods and burrows
    const x = r.range(8, W - 8), y = r.range(8, H - 8), size = r.range(...T.bigRockSize), i = idx(x, y);
    if (!dry(w, x, y) || near[i] < size + 2 || w.fieldAt[i] >= 0) continue;
    if (w.decor.some(d => hypot(d.x - x, d.y - y) < size + (d.tree ? 2 : 0))) continue;
    if (w.burrows.some(b => hypot(b.x - x, b.y - y) < size + 2)) continue;
    w.decor.push(rockOf(x, y, size, true));
    n--;
  }
  for (const f of w.fords) {
    const p = w.rivers[f.river].pts, a = p[Math.min(p.length - 1, f.k + 1)], b = p[Math.max(0, f.k - 1)];
    const d = hypot(a.x - b.x, a.y - b.y) || 1, nx = -(a.y - b.y) / d, ny = (a.x - b.x) / d;   // across the river
    for (let s = -2; s <= 2; s++) {
      const x = f.x + nx * s * 1.1 + r.range(-0.3, 0.3), y = f.y + ny * s * 1.1 + r.range(-0.3, 0.3);
      if (isWater(w, x, y)) w.decor.push(rockOf(x, y, r.range(0.7, 1), false, true));
    }
  }
  w.plants = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, f = w.fieldAt[i] >= 0 ? w.fields[w.fieldAt[i]] : null;
    if (water[i] || r.next() > (f ? T.fieldFlowers : T.flowers)) continue;
    w.plants.push(plantOf(x + r.next(), y + r.next(), i, r.next(), f, w.plants.length));
  }
  // Plants never move, so they go into the spatial grid's cells once, for the bees looking for them.
  w.plantCells = Array.from({ length: GW * GH }, () => []);
  for (const p of w.plants) w.plantCells[clamp((p.y / CELL) | 0, 0, GH - 1) * GW + clamp((p.x / CELL) | 0, 0, GW - 1)].push(p);
  makeCurrent(w);
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
  for (let n = r.int(...T.fields), tries = 0; w.fields.length < n && tries < 1000; tries++) {
    const cx = r.range(14, W - 14), cy = r.range(12, H - 12), reach = T.fieldSpread + T.fieldSize[1];
    if (!dry(w, cx, cy) || near[idx(cx, cy)] < reach * 0.6 || w.fert[idx(cx, cy)] < 0.5) continue;
    if (w.fields.some(f => hypot(f.x - cx, f.y - cy) < reach * 2.5)) continue;
    if (w.fields.length < 3 && w.fields.some(f => hypot(f.x - cx, f.y - cy) > T.fieldGather)) continue;
    if (w.decor.some(d => d.tree && hypot(d.x - cx, d.y - cy) < reach)) continue;
    const season = seasons[w.fields.length % 3];
    const kind = kinds.find(k => k.season === season && !w.fields.some(f => f.kind === k)) || kinds.find(k => k.season === season);
    const id = w.fields.length, shape = blobs(r, cx, cy, 4, T.fieldSpread, ...T.fieldSize);
    const f = { id, kind, season, emoji: kind.emoji, tint: kind.tint, x: cx, y: cy, shape,
      name: `${r.pick(kind.names)} ${places[id % places.length]}`, open: 0, all: 0, bloomed: 0 };   // (open, all: hivesTick)
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
  const kinds = r.pick(T.forests), small = kinds.length > 1;
  w.forest = kinds;
  const [small0, big] = T.treeSize;
  // Trees stand clear of the highest the water gets (waterGoal), and a wet wood follows that
  // high-water line rather than the everyday shore.
  const flood = T.level + T.springFlood + T.rainRise / 2;
  const nearFlood = distanceTo(w.ground.map(g => g < flood ? 1 : 0));
  const plant = (x, y, pine) => {
    if (inBounds(x, y) && w.ground[idx(x, y)] > flood && !w.burrows.some(b => hypot(b.x - x, b.y - y) < 3)) {
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
    // 'bank': a wet wood along one stretch of the river or a lakeshore (not a pond's), broadleaf, thick by the water.
    const shore = [];
    for (let i = 0; i < N; i++) {
      const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
      if (nearFlood[i] > 0 && nearFlood[i] < 1.5 && x > 15 && x < W - 15 && y > 12 && y < H - 12 && w.waters[w.nearBody[i]]?.kind !== 'pond') shore.push({ x, y });
    }
    const c = shore.length ? r.pick(shore) : { x: W / 2, y: H / 2 }, reach = r.range(...T.bankWoods) * (small ? 0.7 : 1);
    return {
      dense: (x, y) => {
        const n = nearFlood[idx(x, y)];
        return n < 1 ? 0 : ramp(reach - hypot(x - c.x, (y - c.y) * 1.2) - ragged(x, y)) * ramp(9 - n - ragged(x, y) * 0.6);
      },
      pine: () => 0.12,
    };
  });

  // One tree per cell where the wood is thick, fewer toward its edge.
  const s = T.treeSpacing;
  for (let gy = 0; gy < H; gy += s) for (let gx = 0; gx < W; gx += s) {
    const x = gx + r.range(0.2, s - 0.2), y = gy + r.range(0.2, s - 0.2);
    if (x < 1 || y < 1 || x > W - 1 || y > H - 1) continue;
    let best = null, d = 0;
    for (const wd of woods) { const v = wd.dense(x, y); if (v > d) { d = v; best = wd; } }
    if (best && r.next() < d) plant(x, y, r.next() < best.pine(x, y));
  }
  // Pine country: how likely a tree coming up here later is to do well as a pine (sprout).
  w.pineLand = new Float32Array(N).fill(0.4);
  for (let i = 0; i < N; i++) {
    const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
    let best = null, d = 0;
    for (const wd of woods) { const v = wd.dense(x, y); if (v > d) { d = v; best = wd; } }
    if (best) w.pineLand[i] = best.pine(x, y);
  }
  // And a few small groves out in the meadow.
  for (let g = 0; g < T.groves; g++) {
    const gx = r.range(8, W - 8), gy = r.range(8, H - 8);
    for (let k = r.int(3, 7); k > 0; k--) plant(gx + r.range(-5, 5), gy + r.range(-4, 4), r.next() >= 0.6);
  }
  // And trees along the water that lasts, as along any river or lake left to itself: one here and there on the bank
  // above the spring flood, in stretches with open bank between. They have random numbers of their own, so the rest
  // of the meadow comes out as before.
  const fr = makeRng(w.seed ^ 0xba4c5), high = T.level + T.springFlood, bank = nearLasting(w, HOLT_BANK);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, p = { x: x + fr.range(0.2, 0.8), y: y + fr.range(0.2, 0.8) };
    if (!bank[i] || w.ground[i] <= high || fr.next() > T.fringe || hills(x / 11 + 51.3, y / 11 + 7.9) < T.fringeGaps) continue;
    if (!waterWay(w, p, HOLT_BANK - 0.5, true) || w.burrows.some(b => dist2(b, p) < 9)) continue;
    if (w.decor.some(d => dist2(d, p) < T.fringeSpacing ** 2)) continue;
    w.decor.push({ x: p.x, y: p.y, emoji: '🌳', size: small0 + (big - small0) * fr.next() ** 2, tree: true, stump: 0 });
  }
  shadeWoods(w);
  // Some broadleaf trees are fruit trees, apple or cherry, mostly out in the open.
  for (let i = 0; i < w.decor.length; i++) {
    const d = w.decor[i];
    if (!d.tree) continue;
    const hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100), open = 1 - w.wood[idx(d.x, d.y)];
    const fruity = d.emoji === '🌳' && hash2(hx, hy, 41) < clamp(open * 1.1, 0.04, 0.5);
    d.fruit = fruity ? (hash2(hx, hy, 42) < 0.5 ? 'apple' : 'cherry') : '';
    d.kind = treeKind(d, w.wood[idx(d.x, d.y)], nearFlood[idx(d.x, d.y)]);
    w.decor[i] = foundTree(w, d);
  }
}

// Which kind of tree each is, by where it stands: alders by the water, hawthorn scrub and old
// oaks out in the open, birches at the wood's edge, beech, oak and maple in the wood. Each row
// gives the kinds and the share of each (from a hash, so the meadow's other randomness is untouched).
const TREE_MIX = {
  water: [['alder', 0.6], ['birch', 0.2], ['oak', 0.1], ['beech', 0.05], ['maple', 0.05]],  // within 3 tiles of high water
  open:  [['oak', 0.5], ['hawthorn', 0.3], ['birch', 0.2]],                 // on its own (only its own shade)
  edge:  [['birch', 0.4], ['oak', 0.25], ['hawthorn', 0.15], ['beech', 0.1], ['maple', 0.1]],
  wood:  [['beech', 0.35], ['oak', 0.3], ['maple', 0.2], ['birch', 0.15]],  // deep in, in full shade
};
function treeKind(d, wood, water) {
  if (d.emoji === '🌲') return 'pine';
  if (d.fruit) return d.fruit;
  let u = hash2(Math.floor(d.x * 100), Math.floor(d.y * 100), 47);
  const mix = TREE_MIX[water < 3 ? 'water' : wood < 0.6 ? 'open' : wood < 0.95 ? 'edge' : 'wood'];
  for (const [kind, share] of mix) if ((u -= share) < 0) return kind;
  return mix[0][0];
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

const WATER_EVERY = 300;         // ticks between moves of the water line
const WATER_DAYS = 1;            // about how long the water takes to reach its level for the season
const DROWN_DAYS = 1;            // grass under water is gone in about this long
const SILT_DAYS = 3;             // how long the ground the water left grows fast
const KIT_DAYS = 1.4;            // kits younger than this can't get out of a flooding burrow

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

// ---------------------------------------------------------------- the current
//
// The rivers run from where they come in to where they leave (w.rivers: points half a tile apart, from upstream
// down). For each point makeCurrent works out which way it runs, how wide the channel is at the usual water line
// (and how far its middle lies off the line), and how fast it runs against a usual river's middle (`pace`): quicker
// in the narrows and over a ford, all but still out in a lake or a wide stretch. A brook stops being its own where it
// runs into the river (`end`, `joins`). Each tile of running water takes the way and the pace of the nearest point,
// quickest down the middle and slower by the banks (w.current.x, .y: tiles a tick). It's worked out when a meadow is
// made or opened (it isn't kept), and runs faster in the spring flood and slower at the summer low (riverPace). It
// carries a swimmer along (drift), an otter leaves the meadow with it (riverEnd), and game.js draws it.
const CURRENT = 0.035;          // tiles a tick down the middle of a river about two tiles wide, at its usual level
const BANK_SLOW = 0.5;          // how much slower it runs by the banks than down the middle
const PACE_HIGH = 0.7;          // how much faster it runs in the spring flood
const PACE_LOW = 0.45;          // and how much slower at the summer low
const CARRY = 0.6;              // the most it carries a swimmer, of its own pace in the water: it can always swim against it

function makeCurrent(w) {
  const level = w.terrain.level, g = w.ground, lake = w.lake && w.lake.near, N = W * H;
  const tile = (x, y) => clamp(Math.floor(y), 0, H - 1) * W + clamp(Math.floor(x), 0, W - 1);   // (a river runs on off the map)
  const wetAt = (x, y) => g[tile(x, y)] < level;
  const ease = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const rivers = w.rivers.map((rv, ri) => {
    const pts = rv.pts, n = pts.length, F = () => new Float32Array(n);
    const R = { tx: F(), ty: F(), half: F(), mid: F(), still: F(), rif: F(), pace: F(), end: n - 1, joins: null };
    const l = F(), r = F(), inLake = F();
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 2)], b = pts[Math.min(n - 1, k + 2)], d = hypot(b.x - a.x, b.y - a.y) || 1;
      const tx = (b.x - a.x) / d, ty = (b.y - a.y) / d, p = pts[k];
      R.tx[k] = tx; R.ty[k] = ty;
      if (!wetAt(p.x, p.y)) continue;
      while (l[k] < 12 && wetAt(p.x + ty * (l[k] + 0.25), p.y - tx * (l[k] + 0.25))) l[k] += 0.25;   // across one way
      while (r[k] < 12 && wetAt(p.x - ty * (r[k] + 0.25), p.y + tx * (r[k] + 0.25))) r[k] += 0.25;   // and the other
      inLake[k] = lake && lake[tile(p.x, p.y)] ? 1 : 0;   // the lake (and its shore) is still water, however narrow
    }
    for (let k = 0; k < n; k++) {                     // evened out along the river, or every tile's edge shows
      let sl = 0, sr = 0, sk = 0, m = 0;
      for (let j = Math.max(0, k - 4); j <= Math.min(n - 1, k + 4); j++) { sl += l[j]; sr += r[j]; sk += inLake[j]; m++; }
      R.half[k] = (sl + sr) / m / 2; R.mid[k] = (sr - sl) / m / 2;
      R.still[k] = Math.max(ease(3.5, 7, R.half[k]), sk / m);
    }
    for (const f of w.fords) if (f.river === ri) for (let k = 0; k < n; k++) R.rif[k] = Math.max(R.rif[k], Math.exp(-(((k - f.k) / 9) ** 2)));
    for (let k = 0; k < n; k++) R.pace[k] = Math.sqrt(2 / clamp(R.half[k], 1.1, 8)) * (1 + 0.5 * R.rif[k]) * (1 - 0.92 * R.still[k]);
    return R;
  });
  // A brook ends where it runs into a river's channel.
  for (let b = 0; b < w.rivers.length; b++) {
    if (!w.rivers[b].brook) continue;
    const B = rivers[b], bp = w.rivers[b].pts;
    find: for (let k = 0; k < bp.length; k++) for (let r = 0; r < w.rivers.length; r++) {
      if (w.rivers[r].brook) continue;
      const half = rivers[r].half, rp = w.rivers[r].pts;
      for (let j = 0; j < rp.length; j++) {
        if ((rp[j].x - bp[k].x) ** 2 + (rp[j].y - bp[k].y) ** 2 < (half[j] - 0.2) ** 2) { B.end = k; B.joins = { river: r, k: j }; break find; }
      }
    }
  }
  // Each tile of running water: the way and the pace of the nearest point, quickest down the middle.
  const x = new Float32Array(N), y = new Float32Array(N), gap = new Float32Array(N).fill(Infinity);
  for (let ri = 0; ri < w.rivers.length; ri++) {
    const R = rivers[ri], pts = w.rivers[ri].pts;
    for (let k = 0; k <= R.end; k++) {
      const p = pts[k], half = R.half[k];
      if (half < 0.3) continue;
      const cx = p.x - R.ty[k] * R.mid[k], cy = p.y + R.tx[k] * R.mid[k], reach = half + 0.5;
      for (let py = Math.max(0, Math.floor(cy - reach)); py <= Math.min(H - 1, cy + reach); py++)
        for (let px = Math.max(0, Math.floor(cx - reach)); px <= Math.min(W - 1, cx + reach); px++) {
          const i = py * W + px, d2 = (px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2;
          if (d2 >= gap[i] || d2 > reach * reach || g[i] >= level || (lake && lake[i])) continue;
          const v = CURRENT * R.pace[k] * (1 - BANK_SLOW * Math.min(1, d2 / (half * half)));
          gap[i] = d2; x[i] = R.tx[k] * v; y[i] = R.ty[k] * v;
        }
    }
  }
  w.current = { rivers, x, y };
}

// How fast the water runs now, against its usual pace: quicker as it rises towards the spring flood, slower as it drops.
function riverPace(w) {
  const T = w.terrain, d = w.level - T.level;
  return d > 0 ? 1 + PACE_HIGH * Math.min(1, d / Math.max(1e-6, T.springFlood)) : 1 - PACE_LOW * Math.min(1, -d / Math.max(1e-6, T.summerLow));
}

// The current carries a swimmer along, whatever it's doing: an otter eating its fish afloat drifts downstream, and
// one swimming up against it gets there slower. Never out of the water, or out of the meadow.
function drift(w, c) {
  if (w.frozen || c.hidden) return;
  const i = idx(c.x, c.y), vx = w.current.x[i], vy = w.current.y[i];
  if ((!vx && !vy) || !w.water[i]) return;
  const v = hypot(vx, vy) * riverPace(w), k = Math.min(v, CARRY * c.walk * c.sp.wade) / hypot(vx, vy);
  const nx = c.x + vx * k, ny = c.y + vy * k;
  if (inBounds(nx, ny) && w.water[idx(nx, ny)]) { c.x = nx; c.y = ny; }
}

// ---------------------------------------------------------------- ice
//
// Snow lying in winter freezes the water over, and the ice takes any weight: a river that kept
// the rabbits safe from the foxes all year is a way across for a few days. It thaws when the snow
// goes. Whoever is out on deep water then goes through: a grown one scrambles out, soaked and
// chilled, and a youngster drowns.

const FREEZE_DAYS = 1;          // snow lying this long freezes the water over
const THAW_DAYS = 0.5;          // and the ice goes about this fast once it's gone
const THIN_ICE = 0.6;           // the ice holds until it has thawed below this
const SOAKED = 0.3;             // share of its energy a fall through the ice costs

function iceTick(w, dt) {
  const cold = seasonOf(w.tick) === 3 && w.snow > 0.3;
  w.ice = clamp(w.ice + (cold ? 1 / FREEZE_DAYS : -1 / THAW_DAYS) * dt / TPD, 0, 1);
  if (!w.frozen && w.ice >= 1) { w.frozen = true; emit(w, { type: 'ice', frozen: true }); }
  else if (w.frozen && w.ice < THIN_ICE) { w.frozen = false; breakUp(w); }
}

function breakUp(w) {
  const fell = [], drowned = [];
  for (const c of w.creatures) {
    if (!c.alive || c.hidden || c.sp.flies || c.sp.swims || w.water[idx(c.x, c.y)] !== DEEP) continue;
    if (growth(w, c) < 0.5) { die(w, c, 'ice'); drowned.push(c); continue; }
    const at = nearestFooting(w, c.x, c.y);
    c.x = at.x; c.y = at.y; c.target = null; c.detour = 0;
    c.energy -= SOAKED * c.maxEnergy;
    note(w, c, '🧊', 'Fell through the ice, and scrambled out soaked');
    fell.push(c);
  }
  emit(w, { type: 'ice', frozen: false, fell, drowned });
}

// The closest place to stand, looking further and further out.
function nearestFooting(w, x, y) {
  for (let r = 0.5; r < W; r += 0.5) {
    for (let a = 0; a < 16; a++) {
      const nx = x + r * Math.cos(a * Math.PI / 8), ny = y + r * Math.sin(a * Math.PI / 8);
      if (walkable(w, nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

// ---------------------------------------------------------------- trees
//
// Trees live slow lives of their own, loosely like real ones. Early in autumn a grown tree sheds
// its seed, and how far it gets depends on the kind (TREES): birch, pine and maple seed rides the
// wind, and an alder's mostly drops in the water and floats off down it (floatSeed); the crows carry acorns and beechnuts off and bury them out in the open by the wood's edge and
// the thorn bushes (cacheNut), and forget some; birds eat cherries and haws and drop the stones under the trees they perch
// in, a thorn bush likeliest; apples fall, and whoever eats one carries the pips off a way. In
// spring the seed comes up wherever there's light enough for its kind (and pines keep to pine
// country, w.pineLand). A seedling is a mouthful for a rabbit unless a thorn bush guards it, so
// where the rabbits graze the meadow stays open, and when they're few the woods creep out. Under
// the trees a young one waits in the shade (beech and maple can wait for years, birch and pine
// die) until an old one falls. Old trees die standing, fall, and rot away. Floods drown seedlings, storms blow over the big ones, and a broadleaf
// struck by lightning grows again from its stump. A hive lives in a hollow old oak (placeHive).
// Apple, cherry and hawthorn blossom for the bees, and bear as much fruit as the bees pollinated.
// All of it runs once a day (treesTick) or less.

const TREES = {
  // grow: how fast it grows up; life: years it lives, about; seedAge: years before it bears seed;
  // seeds: seedlings it tries for each year; shade: how much shade a young one bears (0 none, 1 deep
  // wood); taste: how much rabbits like it; by: how its seed gets about, far: and how far (tiles);
  // blossom: when in spring it flowers for the bees (share of the season);
  // wet: it comes up only this close to the water (tiles, w.damp), and drops its seed in it oftener (float)
  alder:    { grow: 1.1, life: 14, seedAge: 2, seeds: 4, shade: 0.3, taste: 0.5, by: 'wind', far: 6, wet: 4, float: 0.6 },
  birch:    { grow: 1.1, life: 10, seedAge: 2, seeds: 5, shade: 0.15, taste: 0.7, by: 'wind', far: 18 },
  pine:     { grow: 0.8, life: 18, seedAge: 3, seeds: 3, shade: 0.45, taste: 0.3, by: 'wind', far: 10 },
  maple:    { grow: 0.8, life: 18, seedAge: 3, seeds: 2, shade: 0.7, taste: 0.8, by: 'wind', far: 7 },
  beech:    { grow: 0.6, life: 20, seedAge: 4, seeds: 1, shade: 0.9, taste: 0.6, by: 'crow', far: 10, mast: 'beechnuts' },
  oak:      { grow: 0.6, life: 24, seedAge: 4, seeds: 1, shade: 0.4, taste: 0.9, by: 'crow', far: 25, mast: 'acorns' },
  hawthorn: { grow: 1.0, life: 16, seedAge: 2, seeds: 3, shade: 0.3, taste: 0.2, by: 'bird', far: 15, thorns: true, blossom: [0.35, 0.85] },
  apple:    { grow: 0.8, life: 16, seedAge: 3, seeds: 3, shade: 0.4, taste: 0.8, by: 'drop', far: 8, blossom: [0.3, 0.8] },
  cherry:   { grow: 1.0, life: 12, seedAge: 2, seeds: 3, shade: 0.35, taste: 0.7, by: 'bird', far: 15, blossom: [0.05, 0.5] },
};
const YEAR = YEAR_DAYS * TPD;   // ticks in a year
const SPROUT = 0.3;             // a new seedling's size
const SEEDLING = 0.8;           // below this it's a seedling: a mouthful for a rabbit
const SAPLING = 1.8;            // below this a rabbit can reach its shoots and nibble it back, and a flood kills it
const GROWN = 2.4;              // this big, and old enough (seedAge), it bears seed
const GROW_DAYS = SEASONS.reduce((n, s) => n + s.growth, 0) * SEASON_DAYS;   // a year's growing, in days of full growth
const THORNS = 1.8;             // a seedling this close to a grown hawthorn is safe from rabbits
const SPACE = 1.2;              // no seedling comes up this close to a trunk
const SPROUT_ODDS = 0.5;        // odds a seed that lands where it could grow comes up
const SILT_SPROUT = 1.5;        // how much likelier on fresh silt the flood left
const LEAN = 0.4, MAST = 4;     // an oak's or beech's seed in an ordinary year, and in a mast year, times its seeds
const MAST_ODDS = [0, 0.15, 0.35, 0.6, 0.9];   // chance of a mast year, by years since the last
const NUTS = 5;                 // acorns or beechnuts lying under one tree in a mast year, at most
const NUT_ENERGY = 12 * HUNGER;  // what one is worth to a rabbit
const NUT_CROP = 4;             // acorns or beechnuts for the crows to carry off, for each seedling it tries for (d.nuts)
const UNDER = 0.2;              // odds one just falls under its tree instead; the ones the crows leave, the mice eat
const SHADE_DEATH = 0.02;       // odds a day a young tree in more shade than it bears dies
const LOST = 0.004;             // odds a day a seedling dies anyway: slugs, drought, a hard frost
const SNAG_DAYS = [21, 49];     // a dead tree stands this long, bare and grey, then falls
const LOG_DAYS = [21, 42];      // and lies as a log this long, rotting away
const STUMP_DAYS = 14;          // a broadleaf struck by lightning sprouts again from its stump after this
const WINDTHROW = 0.1;          // odds, each tenth of a day in a storm, that it blows a big tree over
const BLOOMS = 5;               // flowers for the bees in a tree's crown
const VISITS = 10;              // bee visits to its blossom for a full crop
const SELF_SET = 0.2;           // the crop with no bees at all: a little from the wind and the flies
const TREE_ROOM = 1.4;          // the woods can grow to about this many times the trees the meadow started with
const RARE_TONE = 0.03;         // odds a founding beech is a copper beech (tone 3), and half its seedlings are
const OLD_NAMES = ['Old', 'Great', 'Crooked', 'Grey', 'Twisted', 'Lonely', 'Whispering', 'Mossy', 'Leaning',
  'Gnarled', 'Giant', 'Owl', 'Elder', 'Broad', 'Ancient', 'Split', 'Singing', 'Watching', 'Wishing', 'Sleeping'];
const KIND_NAMES = { oak: 'Oak', beech: 'Beech', maple: 'Maple', pine: 'Pine', birch: 'Birch', alder: 'Alder', apple: 'Apple', cherry: 'Cherry', hawthorn: 'Thorn' };

const treeAge = (w, d) => (w.tick - d.born) / YEAR;
const standing = d => d.tree && !d.stump && !d.dead && !d.fallen;
const bearing = (w, d) => standing(d) && d.size >= GROWN && treeAge(w, d) >= TREES[d.kind].seedAge;
const sizeAt = (k, max, years) => max / (1 + (max / SPROUT - 1) * Math.exp(-k.grow * years));
const yearsTo = (k, max, size) => Math.log((max / SPROUT - 1) / Math.max(1e-3, max / size - 1)) / k.grow;
const springPart = t => (dayOf(t) % SEASON_DAYS + phaseOf(t)) / SEASON_DAYS;   // how far into its season t is

// What a tree is now, for the drawing and the inspector.
function treeStage(w, d) {
  if (d.fallen) return 'log';
  if (d.dead) return 'dead';
  if (d.stump) return 'stump';
  if (d.size < SEEDLING) return 'seedling';
  if (d.size < SAPLING) return 'sapling';
  if (!bearing(w, d)) return 'young';
  return treeAge(w, d) > d.life * 0.7 ? 'old' : 'grown';
}

// Every field a tree ever has, in one order, so all trees are laid out alike (see blankCreature): newTree and
// foundTree fill it in, and unpackWorld a kept one. (-0: a fraction's zero; crop starts at 1, filled in.)
const blankTree = () => ({
  id: 0, x: -0, y: -0, emoji: '', tree: true, kind: '', fruit: '', size: -0, max: -0, born: -0, life: -0, tone: 0, parent: 0, by: '',
  stump: 0, dead: 0, fallen: 0, until: -0, windfall: 0, nuts: 0, crop: -0, visits: 0, blooms: false, name: '', named: false,
  picked: 0, pickYear: -1,   // cherries the forager has picked off it, and the year (gather)
  hedge: 0,         // the hedge it's a whip of (w.hedges: a visitor's place)
  hive: null, holt: 0, door: null, holtFish: NaN,    // a hive in its hollow; an otters' holt in its roots, the way in, the fish about it (NaN: not worked out)
  sprouted: false, gone: false,   // grown again from its stump; rotted away
});

// A tree comes up. o: what it inherits (tone, parent, how its seed got here).
function newTree(w, x, y, kind, o = {}) {
  const r = w.treeRng, T = w.terrain, k = TREES[kind];
  const d = blankTree();
  d.id = w.nextTree++; d.x = x; d.y = y; d.emoji = kind === 'pine' ? '🌲' : '🌳'; d.kind = kind;
  d.fruit = kind === 'apple' || kind === 'cherry' ? kind : ''; d.size = SPROUT;
  d.max = (T.treeSize[0] + (T.treeSize[1] - T.treeSize[0]) * r.next() ** 2) * (0.85 + 0.3 * w.fert[idx(x, y)]);   // most middling, a few giants, bigger on good soil
  d.born = w.tick; d.life = k.life * r.range(0.7, 1.3); d.tone = r.int(0, 2); d.crop = 1;
  Object.assign(d, o);
  w.decor.push(d); w.treesMoved = true;
  return d;
}

// A tree the meadow starts with: as old as its size says, give or take, and a few near their end. It's made afresh,
// to stand in for the first sketch of it (d): added a few at a time, the fields left the trees slow to read.
function foundTree(w, d) {
  const r = w.treeRng, k = TREES[d.kind], hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100);
  const t = blankTree();
  t.tone = d.kind === 'beech' && hash2(hx, hy, 49) < RARE_TONE ? 3 : Math.floor(hash2(hx, hy, 48) * 3);
  t.id = w.nextTree++; t.x = d.x; t.y = d.y; t.emoji = d.emoji; t.kind = d.kind; t.fruit = d.fruit; t.size = d.size; t.stump = d.stump;
  t.max = d.size * r.range(1.04, 1.3); t.life = k.life * r.range(0.7, 1.3); t.crop = 1;
  const grew = yearsTo(k, t.max, t.size), left = Math.max(0, t.life - grew);
  t.born = w.tick - Math.min(t.life * 0.97, grew + r.next() * left * (t.size > t.max * 0.9 ? 1 : 0.3)) * YEAR;
  return t;
}

// The meadow doesn't start out new: in and around the woods are young trees from the last few
// years' seed. (Out in the open the rabbits have had them.)
function startTrees(w) {
  const r = w.treeRng;
  treesTick(w, false);
  for (let years = 3; years >= 1; years--) {
    for (const d of [...w.decor]) {
      if (!bearing(w, d) || r.next() > 0.6) continue;
      const s = seedSpot(w, d, r), k = TREES[d.kind];
      if (!s || w.wood[idx(s.x, s.y)] < 0.05) continue;
      const t = sprout(w, { ...s, kind: d.kind, tone: childTone(w, d), parent: d.id, by: k.by });
      if (!t) continue;
      t.born -= years * YEAR;
      t.size = sizeAt(k, t.max, years * (1 - 0.8 * shadeOver(w, t)));
    }
    treesTick(w, false);
  }
}

const childTone = (w, d) => {
  const r = w.treeRng;
  if (d.tone === 3) return r.next() < 0.5 ? 3 : r.int(0, 2);
  return r.next() < 0.1 ? r.int(0, 2) : d.tone;            // colour runs in families, mostly
};

// Every decor thing (trees, rocks) in the grid cells that reach within radius of x, y. The grid
// is rebuilt when trees come or go (tidyTrees).
function forEachDecorNear(w, x, y, radius, fn) {
  const x0 = clamp(((x - radius) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + radius) / CELL) | 0, 0, GW - 1);
  const y0 = clamp(((y - radius) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + radius) / CELL) | 0, 0, GH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const d of w.decorCells[gy * GW + gx]) if (!d.gone) fn(d);
}
const cellOf = (cells, p) => cells[clamp((p.y / CELL) | 0, 0, GH - 1) * GW + clamp((p.x / CELL) | 0, 0, GW - 1)];

// Trees that died without a trace, or rotted away, leave; the grid is built again.
function tidyTrees(w) {
  if (!w.treesMoved) return;
  w.treesMoved = false;
  w.decor = w.decor.filter(d => !d.gone);
  w.decorCells = Array.from({ length: GW * GH }, () => []);
  for (const d of w.decor) cellOf(w.decorCells, d).push(d);
}

// How much shade falls on a tree from the taller ones about it: 0 in the open, 1 deep in a wood.
function shadeOver(w, d) {
  let s = 0;
  forEachDecorNear(w, d.x, d.y, 3, o => {
    if (o === d || !standing(o) || o.size <= d.size) return;
    const q = ((o.x - d.x) ** 2 + (o.y - d.y) ** 2) / 3.2;
    if (q < 3) s += 0.45 * shadeOf(o) * Math.exp(-q);
  });
  return Math.min(1, s);
}
const shadeOf = d => clamp((d.size - SEEDLING) / 2, 0, 1);    // a sapling casts hardly any

// Where one of a tree's seeds ends up, or null.
function seedSpot(w, d, r) {
  const k = TREES[d.kind];
  if (k.by === 'crow') {                // the best of a few spots out in the open, by a thorn bush or the wood's edge (cacheNut)
    let best = null, most = 0;
    for (let n = 0; n < 4; n++) {
      const a = r.range(0, Math.PI * 2), far = r.range(2, k.far), x = d.x + Math.cos(a) * far, y = d.y + Math.sin(a) * far;
      if (!dry(w, x, y)) continue;
      const shade = w.wood[idx(x, y)], v = (shade < 0.4 ? 1 : 0.2) + (shade > 0.05 && shade < 0.4 ? 1 : 0) + (thornNear(w, x, y, 2.5) ? 2 : 0) + r.next();
      if (v > most) { best = { x, y }; most = v; }
    }
    return best;
  }
  if (k.by === 'bird') {                // dropped under a tree a bird perched in, the sunniest of a few: likeliest a thorn bush
    let best = null, most = -1;
    for (let tries = 0; tries < 3; tries++) {
      let perch = null, sum = 0;
      forEachDecorNear(w, d.x, d.y, k.far, o => {
        if (o === d || !standing(o) || o.size < SAPLING || (o.x - d.x) ** 2 + (o.y - d.y) ** 2 > k.far * k.far) return;
        const like = o.kind === 'hawthorn' ? 3 : o.size >= GROWN ? 1 : 0;
        if (like && r.next() < like / (sum += like)) perch = o;
      });
      if (!perch) return null;
      const a = r.range(0, Math.PI * 2), far = r.range(perch.kind === 'hawthorn' ? 0.8 : 1.4, perch.kind === 'hawthorn' ? 1.6 : 2.6);   // under the edge of its crown
      const x = perch.x + Math.cos(a) * far, y = perch.y + Math.sin(a) * far * 0.7, sun = inBounds(x, y) ? 1 - w.wood[idx(x, y)] : 0;
      if (sun > most) { best = { x, y }; most = sun; }
    }
    return best;
  }
  const a = r.range(0, Math.PI * 2);    // the wind: most near, a few far; or it falls, and is carried off a little way
  const far = k.by === 'wind' ? k.far * Math.min(1, -Math.log(1 - r.next() * 0.95) / 3) + 0.8 : r.range(0.8, k.far);
  return { x: d.x + Math.cos(a) * far, y: d.y + Math.sin(a) * far };
}

const thornNear = (w, x, y, reach) => {
  let yes = false;
  forEachDecorNear(w, x, y, reach, o => { if (!yes && o.kind === 'hawthorn' && standing(o) && o.size >= SAPLING && (o.x - x) ** 2 + (o.y - y) ** 2 < reach * reach) yes = true; });
  return yes;
};

// A seed comes up, if the spot has room and light enough for its kind, and luck. The woods grow
// harder to come up in as they fill their room (w.treeRoom). Null if it doesn't.
function sprout(w, s) {
  const r = w.treeRng, k = TREES[s.kind];
  if (!inBounds(s.x, s.y)) return null;
  const i = idx(s.x, s.y);
  if (w.water[i] || w.fieldAt[i] >= 0 || w.wood[i] > k.shade) return null;
  if (w.burrows.some(b => (b.x - s.x) ** 2 + (b.y - s.y) ** 2 < 4) || w.hives.some(h => (h.x - s.x) ** 2 + (h.y - s.y) ** 2 < 4)) return null;
  let crowded = false;
  forEachDecorNear(w, s.x, s.y, 3, o => {
    if (!crowded && hypot(o.x - s.x, o.y - s.y) < (o.tree ? SPACE : o.size * 0.5 + 0.3)) crowded = true;
  });
  if (crowded) return null;
  const bare = w.silt[i] > 0 ? SILT_SPROUT : 1;
  const room = clamp((w.treeRoom - w.treeCount) / (w.treeRoom * 0.3), 0, 1), pine = w.pineLand[i];
  if (k.wet && w.damp[i] > k.wet) return null;                // an alder only by the water
  const suits = s.kind === 'pine' ? 0.4 + 0.8 * pine : 1.2 - 0.6 * pine;   // pines where the pinewoods are, broadleaf elsewhere
  if (r.next() > SPROUT_ODDS * bare * room * suits) return null;
  const d = newTree(w, s.x, s.y, s.kind, { tone: s.tone, parent: s.parent, by: s.by });
  w.sprouted++;
  return d;
}

// Early in autumn every tree old enough sheds its seed, to come up next spring. Oaks and beeches
// fruit all together, heavily one year in a few (a mast year) and little in between, and most of
// theirs is left for the crows to carry off (d.nuts, cacheNut); the rest falls under the tree.
const springAfter = t => (Math.floor(dayOf(t) / YEAR_DAYS) + 1) * YEAR;
const underTree = (d, r) => { const a = r.range(0, Math.PI * 2), far = r.range(0.8, 2.5); return { x: d.x + Math.cos(a) * far, y: d.y + Math.sin(a) * far * 0.7 }; };
function seedFall(w) {
  const r = w.treeRng, since = yearOf(w.tick) - w.mastYear;
  w.mast = r.next() < MAST_ODDS[Math.min(since, MAST_ODDS.length - 1)];
  if (w.mast) { w.mastYear = yearOf(w.tick); emit(w, { type: 'mast' }); }
  const spring = springAfter(w.tick);
  for (const d of w.decor) {
    if (!bearing(w, d)) continue;
    const k = TREES[d.kind];
    let n = k.seeds * (k.mast ? (w.mast ? MAST : LEAN) : 1) * (k.blossom ? 0.5 + 0.5 * d.crop : 1);
    d.nuts = 0;
    const way = waterWay(w, d, FLOAT_REACH, true);
    for (n = Math.floor(n) + (r.next() < n % 1 ? 1 : 0); n > 0; n--) {
      const wet = way && r.next() < (k.float ?? ON_WATER);
      if (k.by === 'crow' && !wet && r.next() > UNDER) { d.nuts += NUT_CROP; continue; }
      const s = wet ? floatSeed(w, d, way, r) : k.by === 'crow' ? underTree(d, r) : seedSpot(w, d, r);
      if (s) w.seeds.push({ x: s.x, y: s.y, kind: d.kind, tone: childTone(w, d), parent: d.id, by: wet ? 'water' : k.by === 'crow' ? 'drop' : k.by, at: spring + r.range(0, 0.5) * SEASON_DAYS * TPD });
    }
  }
  w.cached = 0;
}

// A tree by the water drops some of its seed in it, and it floats off: down the current where the water runs, about
// the lake or the pond where it's still, and comes up where it washes ashore, on the bank above the spring flood. So
// the trees along the water seed the banks downstream, and a wood by the river spreads along it. Some float out of
// the meadow, or sink.
const FLOAT_REACH = 4;          // tiles from water that lasts that a tree drops some of its seed in it
const ON_WATER = 0.3;           // and the odds each seed does
const FLOAT_FAR = [3, 40];      // tiles it floats
function floatSeed(w, d, way, r) {
  const T = w.terrain, high = T.level + T.springFlood, wet = (x, y) => w.ground[idx(x, y)] <= T.level;
  let x = d.x + Math.cos(way.a) * way.r, y = d.y + Math.sin(way.a) * way.r;
  if (!inBounds(x, y) || !wet(x, y)) return null;
  for (let far = r.range(...FLOAT_FAR); far > 0; far--) {
    const i = idx(x, y), cx = w.current.x[i], cy = w.current.y[i];
    const a = cx || cy ? Math.atan2(cy, cx) + r.range(-0.7, 0.7) : r.range(0, Math.PI * 2);   // (still water: any way)
    const nx = x + Math.cos(a), ny = y + Math.sin(a);
    if (!inBounds(nx, ny)) return null;                    // off down the river, out of the meadow
    if (wet(nx, ny)) { x = nx; y = ny; }                   // (or it bumps the bank)
  }
  for (let k = 0, a0 = r.range(0, Math.PI * 2); k < 8; k++) {   // ashore: out to the bank, and up it past the flood line
    const a = a0 + k * Math.PI / 4;
    for (let far = 0.5; far <= 6; far += 0.5) {
      const px = x + Math.cos(a) * far, py = y + Math.sin(a) * far;
      if (!inBounds(px, py)) break;
      if (w.ground[idx(px, py)] > high) return { x: px, y: py };
    }
  }
  return null;                                             // out in a lake: it sinks
}

// A tree dies. A seedling or a sapling is simply gone; a bigger one stands dead a while (a snag), then falls.
function treeDies(w, d, cause) {
  dropBlossoms(w, d);
  if (d.size < SAPLING && !d.hive) { d.gone = true; w.treesMoved = true; return; }
  d.dead = w.tick; d.until = w.tick + w.treeRng.range(...SNAG_DAYS) * TPD;
  if (cause === 'age' && (d.name || d.hive || d.size > 4.2)) emit(w, { type: 'treedied', tree: d, age: treeAge(w, d) });
}

// Down it comes: a log now, rotting away. The bees in it move to another tree.
function treeFalls(w, d) {
  d.fallen = w.tick; d.dead ||= w.tick; d.until = w.tick + w.treeRng.range(...LOG_DAYS) * TPD;
  dropBlossoms(w, d);
  if (d.hive) hiveMoves(w, d.hive, 'fell');
}

// Once a day: every tree grows, and some die. grow false: only the bookkeeping (the grid, the
// shade on the ground, which trees fruit), as when the meadow is made.
function treesTick(w, grow = true) {
  const r = w.treeRng, t = w.tick, s = seasonOf(t), g = SEASONS[s].growth / GROW_DAYS;
  if (grow) {
    if (s === 0 && w.seeds.length) {                    // the seed comes up through the first half of spring
      for (const sd of w.seeds) if (sd.at <= t) sprout(w, sd);
      w.seeds = w.seeds.filter(sd => sd.at > t);
      if (!w.seeds.length && w.sprouted) {
        emit(w, { type: 'sprouts', n: w.sprouted });
        w.sprouted = 0;
      }
    }
    for (const d of w.decor) {
      if (!d.tree || d.gone) continue;
      if (d.until && t >= d.until) {                     // a snag falls, a log rots away, a stump sprouts
        if (d.fallen) { d.gone = true; w.treesMoved = true; enrich(w, d.x, d.y, LOG_RICH, 1 + d.size / 2); }
        else if (d.dead) treeFalls(w, d);
        else { d.stump = 0; d.until = 0; d.size = SEEDLING; d.born = t; d.sprouted = true; }
        continue;
      }
      if (!standing(d)) continue;
      const k = TREES[d.kind], i = idx(d.x, d.y), young = d.size < GROWN, shade = young ? shadeOver(w, d) : 0;
      if (treeAge(w, d) > d.life) { treeDies(w, d, 'age'); continue; }
      if (d.size < SAPLING) {
        if (w.water[i] && r.next() < 0.5) { treeDies(w, d, 'flood'); continue; }
        if (w.burrows.some(b => (b.x - d.x) ** 2 + (b.y - d.y) ** 2 < 1)) { treeDies(w, d, 'dug'); continue; }
        if (w.bitten[i] && r.next() < k.taste * (thornNear(w, d.x, d.y, THORNS) ? 0.1 : 1)) {
          const c = w.byId.get(w.bitten[i]), what = `Nibbled a young ${KIND_NAMES[d.kind].toLowerCase()}`;
          if (c && c.alive && c.story[c.story.length - 1].text !== what) note(w, c, '🌱', what);
          if (d.size < SEEDLING) { treeDies(w, d, 'eaten'); continue; }
          d.size = Math.max(SEEDLING * 0.9, d.size - 0.3);          // nibbled back
        }
        if (d.size < SEEDLING && r.next() < LOST) { treeDies(w, d, 'lost'); continue; }
      }
      if (young && shade > k.shade && r.next() < SHADE_DEATH) { treeDies(w, d, 'shade'); continue; }
      if (d.size < d.max) d.size += k.grow * (d.sprouted ? 2 : 1) * (1 - shade) * g * d.size * (1 - d.size / d.max);
      if (!d.named && treeAge(w, d) > d.life * 0.7) {    // an old giant gets a name
        d.named = true;
        if (d.size > 4 && r.next() < 0.6) d.name = oldName(w, d);
      }
    }
    w.bitten.fill(0);
  }
  tidyTrees(w);
  // The shade on the ground (it thins the grass, see groundTick, and game.js darkens it), the trees with food to drop, how full the woods are.
  const wood = w.wood;
  wood.fill(0);
  let n = 0;
  for (const d of w.decor) {
    if (!standing(d)) continue;
    if (d.size >= SEEDLING) n++;
    if (TREES[d.kind].blossom && !d.blooms && bearing(w, d)) addBlossoms(w, d);
    const a = 0.45 * shadeOf(d);
    if (!a) continue;
    const { tiles, fall } = shadeSpots(d);
    for (let k = 0; k < tiles.length; k++) wood[tiles[k]] = Math.min(1, wood[tiles[k]] + a * fall[k]);
  }
  w.treeCount = n;
  w.orchard = w.decor.filter(d => bearing(w, d) && (d.kind === 'apple' || TREES[d.kind].mast));
}

// The tiles a tree shades, and how much of its shade falls on each (less further off): worked out once a tree, as a
// tree never moves; worked out afresh every day for every tree, it was most of a day's work.
const shadeSpotsOf = new WeakMap();
function shadeSpots(d) {
  let s = shadeSpotsOf.get(d);
  if (s) return s;
  const tiles = [], fall = [];
  for (let y = Math.max(0, Math.floor(d.y - 3)); y <= Math.min(H - 1, d.y + 3); y++) {
    for (let x = Math.max(0, Math.floor(d.x - 3)); x <= Math.min(W - 1, d.x + 3); x++) {
      const q = ((x + 0.5 - d.x) ** 2 + (y + 0.5 - d.y) ** 2) / 3.2;
      if (q < 3) { tiles.push(y * W + x); fall.push(Math.exp(-q)); }
    }
  }
  s = { tiles: Int32Array.from(tiles), fall: Float64Array.from(fall) };
  shadeSpotsOf.set(d, s);
  return s;
}

function oldName(w, d) {
  const taken = new Set(w.decor.map(o => o.name));
  for (let k = 0; k < 8; k++) {
    const name = `${w.treeRng.pick(OLD_NAMES)} ${KIND_NAMES[d.kind]}`;
    if (!taken.has(name)) return name;
  }
  return '';
}

// Late in spring the blossom is over, and a tree sets as much fruit as the bees pollinated.
function setFruit(w) {
  for (const d of w.decor) {
    if (!d.blooms) continue;
    d.crop = clamp(SELF_SET + (1 - SELF_SET) * d.visits / VISITS, 0, 1); d.visits = 0;
  }
}

// A tree in blossom is flowers for the bees: a few spots in its crown (w.blossoms, found like
// w.plants), open while it's in bloom. up: how high in the crown, as a share of the tree (game.js).
function addBlossoms(w, d) {
  d.blooms = true;
  for (let k = 0; k < BLOOMS; k++) {
    const a = (k + 0.5) / BLOOMS * Math.PI;
    const p = plantOf(clamp(d.x - Math.cos(a) * 0.7, 0.5, W - 0.5), clamp(d.y + 0.05 + Math.sin(a) * 0.15, 0.5, H - 0.5), idx(d.x, d.y),
      1, null, 1e6 + w.nextBloom++, d, 0.45 + 0.2 * Math.sin(a));
    w.blossoms.push(p); cellOf(w.blossomCells, p).push(p);
  }
}
function dropBlossoms(w, d) {
  if (!d.blooms) return;
  d.blooms = false;
  w.blossoms = w.blossoms.filter(p => p.tree !== d);
  for (let k = 0; k < w.blossomCells.length; k++) if (w.blossomCells[k].some(p => p.tree === d)) w.blossomCells[k] = w.blossomCells[k].filter(p => p.tree !== d);
}
const inBloom = (w, d) => {
  const b = TREES[d.kind].blossom, sp = springPart(w.tick);
  return d.blooms && seasonOf(w.tick) === 0 && sp >= b[0] && sp <= b[1] && standing(d);
};

// A storm now and then blows over a big tree, the old ones likeliest, or brings down a dead one.
function windthrow(w) {
  const r = w.treeRng;
  if (!w.decor.length || r.next() > WINDTHROW) return;
  for (let k = 0; k < 30; k++) {
    const d = w.decor[r.int(0, w.decor.length - 1)];
    if (!d.tree || d.fallen || d.stump || d.gone) continue;
    if (!d.dead && (d.size < 3.5 || r.next() > treeAge(w, d) / d.life)) continue;
    emit(w, { type: 'windthrow', tree: d, alive: !d.dead });
    treeFalls(w, d);
    return;
  }
}

// Lightning on a tree: a pine dies; a broadleaf loses its crown and grows again from the stump.
function struck(w, d) {
  if (d.kind === 'pine') { treeDies(w, d, 'lightning'); return; }
  dropBlossoms(w, d);
  d.stump = w.tick; d.until = w.tick + STUMP_DAYS * TPD;
}

// ---------------------------------------------------------------- windfalls
//
// Apple trees drop their apples early in autumn, and in a mast year the oaks and beeches drop
// acorns and beechnuts. Hungry rabbits come for them: a windfall is a good meal, so the apple
// trees are where everyone gathers, and where the foxes learn to look. What isn't eaten rots away
// as the leaves come down (game.js hangs and drops them to match). An apple tree drops as many
// as its blossom set (d.crop).

const WINDFALL_EVERY = TPD / 10;   // ticks between windfalls dropping and rotting (and a storm blowing a tree over)
const APPLES = 6;               // most windfalls lying under one tree
const APPLE_ENERGY = 30 * HUNGER;   // what one is worth to a rabbit: a meal
const APPLE_DROP = 0.35;        // odds a tree drops one, each time windfallTick runs, early in autumn
const APPLE_ROT = 0.3;          // odds one rots, each time, late in autumn
const APPLE_HUNGRY = 0.3;       // a rabbit hungrier than this eats the grass at hand rather than walk for a windfall
const APPLE_SMELL = 2;          // a rabbit finds apples this many times as far off as it sees a fox

function windfallTick(w) {
  const s = seasonOf(w.tick), sp = springPart(w.tick);
  w.windfalls = 0;
  for (const d of w.orchard) {
    const most = d.kind === 'apple' ? Math.round(APPLES * d.crop) : w.mast ? NUTS : 0;
    if (!standing(d) || s !== 2) d.windfall = 0;
    else if (sp < 0.4) { if (d.windfall < most && w.rng.next() < APPLE_DROP) d.windfall++; }
    else if (sp > 0.6 && d.windfall && w.rng.next() < APPLE_ROT) d.windfall--;
    w.windfalls += d.windfall;
  }
  if (w.windfalls && w.appleYear !== yearOf(w.tick)) { w.appleYear = yearOf(w.tick); emit(w, { type: 'windfall', mast: w.mast }); }
}

// Hungry, and windfalls lying under a tree not far off: go and sit under it, and munch one. (Rabbits,
// and the crows, who fly there.)
function windfall(w, c) {
  if (c.mode === 'munch') { if (--c.timer > 0) return true; c.mode = 'wander'; c.target = null; }
  let d = c.mode === 'apple' && c.target && c.target.tree;
  if (!d || !d.windfall) {
    d = null;
    if ((w.tick + c.id) % 10) return false;
    let best = (c.sight * APPLE_SMELL) ** 2;
    for (const o of w.orchard) {
      const dd = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
      if (o.windfall && dd < best && (c.sp.flies || clearPath(w, c.x, c.y, o.x, o.y + 0.3))) { d = o; best = dd; }
    }
    if (!d) return false;
    const a = (c.id % 7) / 7 * Math.PI * 2;               // everyone to their own side of the tree
    c.mode = 'apple'; c.target = { x: d.x + 0.9 * Math.cos(a), y: d.y + 0.3 + 0.5 * Math.sin(a), tree: d };
  }
  if (!go(w, c, c.target.x, c.target.y, c.walk * kidPace(w, c))) return true;
  d.windfall--; w.windfalls--;
  const apple = d.kind === 'apple', found = apple ? WINDFALL_NOTE : `Found ${TREES[d.kind].mast} under ${d.kind === 'oak' ? 'an oak' : 'a beech'}`;
  c.energy = Math.min(c.maxEnergy, c.energy + (apple ? APPLE_ENERGY : NUT_ENERGY));
  c.mode = 'munch'; c.timer = apple ? 90 : 45; c.target = null; c.snack = apple ? 'apple' : TREES[d.kind].mast;
  if (c.story[c.story.length - 1].text !== found) note(w, c, apple ? '🍎' : '🌰', found);
  return true;
}
const WINDFALL_NOTE = 'Found windfall apples under an apple tree';

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
// (Written out as dampen is, with no callbacks: game.js runs it each time the water line moves.)
function distanceTo(from) {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = from[i] ? 0 : 1e9;
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {      // from the tile behind, the row above and its corners
    let v = d[i];
    if (v === 0) continue;
    if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
    if (y > 0) {
      if (d[i - W] + 1 < v) v = d[i - W] + 1;
      if (x > 0 && d[i - W - 1] + 1.4 < v) v = d[i - W - 1] + 1.4;
      if (x < W - 1 && d[i - W + 1] + 1.4 < v) v = d[i - W + 1] + 1.4;
    }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1, i = y * W + x; x >= 0; x--, i--) {   // and back the other way
    let v = d[i];
    if (v === 0) continue;
    if (x < W - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
    if (y < H - 1) {
      if (d[i + W] + 1 < v) v = d[i + W] + 1;
      if (x < W - 1 && d[i + W + 1] + 1.4 < v) v = d[i + W + 1] + 1.4;
      if (x > 0 && d[i + W - 1] + 1.4 < v) v = d[i + W - 1] + 1.4;
    }
    d[i] = v;
  }
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
  fillNear(w, Int16Array.from(body));
  w.lake = null;
  // The brook runs in the river's water, but has a name of its own too.
  for (const rv of w.rivers) if (rv.brook) rv.name = `${firsts[(w.waters.length + 1) % firsts.length]} ${r.pick(WATER_NAMES.brook)}`;
  if (lake) {
    let deep = -1;                                                       // somewhere deep in it, for which water it is
    for (let i = 0; i < W * H && deep < 0; i++) if (lake.mask[i] && w.water[i] === DEEP) deep = i;
    const home = deep >= 0 && w.waters[body[deep]];
    if (home?.kind === 'lake') w.lake = home;
    else w.lake = { kind: 'lake', name: `${firsts[w.waters.length % firsts.length]} ${r.pick(WATER_NAMES.lake)}`, x: lake.x, y: lake.y };
    w.lake.near = Uint8Array.from(lake.out, d => (d < 2 ? 1 : 0));    // the lake, and its shore: where it keeps its name
    w.lake.middle = { x: lake.x, y: lake.y, reach: lake.reach, turn: lake.turn, stretch: lake.stretch };   // (for the terrain lab)
  }
}

// Which water each tile of dry land is nearest (w.nearBody), filled out from the tiles of `near` that have one
// (a water's id; -1 elsewhere), a step at a time. A flood belongs to the water it spilled from.
function fillNear(w, near) {
  const queue = [];
  for (let i = 0; i < near.length; i++) if (near[i] >= 0) queue.push(i);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || near[ny * W + nx] >= 0) continue;
      near[ny * W + nx] = near[i]; queue.push(ny * W + nx);
    }
  }
  w.nearBody = near;
}

// The named water at a spot: the lake keeps its own name where the river runs through it.
const nearLake = (w, x, y) => w.lake && inBounds(x, y) && w.lake.near[idx(x, y)] === 1;
const waterAt = (w, x, y) => nearLake(w, x, y) ? w.lake : w.waters[w.body[idx(x, y)]] || null;

// The water a straight walk from one point to another would have to swim, if any.
function waterBetween(w, x0, y0, x1, y1) {
  const n = Math.ceil(hypot(x1 - x0, y1 - y0) * 2);
  for (let k = 1; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    if (!inBounds(x, y) || w.water[idx(x, y)] !== DEEP) continue;
    return waterAt(w, x, y);
  }
  return null;
}

function growGrass(w, dt) {
  const s = SEASONS[seasonOf(w.tick)], grow = sky(w).grow;
  const capK = s.cap * (w.weather.kind === 'heat' ? 0.8 : 1);   // a heatwave browns the grass
  const r = GRASS_RATE * s.growth * grow * dt / TPD;
  const seed = SEED_RATE * Math.max(s.growth, 0.05) * grow * dt / TPD;
  const die = DIEBACK * dt / TPD;
  const drown = dt / (DROWN_DAYS * TPD), siltFade = dt / (SILT_DAYS * TPD);
  const g = w.grass, f = w.shadedFert, water = w.water, silt = w.silt;   // (the soil, less under the trees)
  const rich = w.rich, keep = 1 - dt / (RICH_DAYS * TPD);
  for (let i = 0; i < g.length; i++) {
    if (water[i]) { if (g[i] > 0) g[i] = Math.max(0, g[i] - drown); silt[i] = 1; continue; }
    let cap = f[i] * capK, a = 1;
    const silty = silt[i], k = rich[i];
    if (silty + k > 0) {                                     // new shoots love silt, and rich ground (most tiles have neither)
      a += 3 * silty + RICH_GROW * k;
      if (silty > 0) silt[i] = Math.max(0, silty - siltFade);
      if (k > 0) { cap = Math.min(1, cap + RICH_SOIL * k * capK); rich[i] = k < RICH_GONE ? 0 : k * keep; }
    }
    let v = g[i];
    if (v < cap) v += r * a * v * (1 - v / cap) + seed * a * cap;
    else v -= (v - cap) * die;
    g[i] = v;
  }
}

// ---------------------------------------------------------------- shade and rich ground
//
// The woods' shade thins the grass under them, less while the broadleaves are bare, so woods that
// spread out cost the rabbits grazing. And the ground remembers what lives and dies on it (w.rich):
// a body left out in the open, the latrines round a busy warren, an otters' spraint and a log rotting
// away feed the soil, and the grass there grows back faster and a little past what the soil alone would
// hold. Rabbits won't graze it while it's fresh, so it stands out as a lusher patch. It fades over a
// season or so.

const SHADE_GRASS = 0.5;        // how much of the grass deep shade takes
const BARE_SHADE = 0.5;         // and how much of that it still takes while the broadleaves are bare
const RICH_DAYS = 5;            // rich ground loses about two thirds of it in this long
const RICH_GONE = 0.01;         // and below this it's plain ground again
const RICH_SOIL = 0.3;          // fully rich ground holds as much grass as soil this much more fertile
const RICH_GROW = 2;            // and grows it back this many times faster, on top
const BODY_RICH = 0.8;          // remains left out in the open (leaveRemains), at the middle
const BODY_REACH = 1.5;         // out to this many tiles
const LATRINES = 5;             // dung heaps round a warren
const LATRINE_OUT = 3;          // this far out from the hole
const LATRINE_REACH = 1.3;      // each this wide
const LATRINE_RICH = 0.015;     // a day's droppings, for each rabbit living there
const LOG_RICH = 1;             // a log rotted away, at the middle, out to about half its size
const FOULED = 0.3;             // rabbits won't graze ground richer than this: fresh droppings, or where a body lay

// Rabbits won't graze fouled ground, so a busy warren's latrines and an old kill site stand out lush till it fades.
const fouled = (w, i) => w.rich[i] > FOULED;

// Winter and the first third of spring, when the broadleaves are bare (as game.js draws them).
const leafless = t => seasonOf(t) === 3 || (seasonOf(t) === 0 && springPart(t) < 0.35);

// The ground about (x, y) grows richer: by amount at the middle, less out to radius tiles. Not under water.
function enrich(w, x, y, amount, radius) {
  const rich = w.rich, r2 = radius * radius;
  for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(H - 1, y + radius); yy++) {
    for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(W - 1, x + radius); xx++) {
      const i = yy * W + xx, d = ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2) / r2;
      if (d < 1 && !w.water[i]) rich[i] = Math.min(1, rich[i] + amount * (1 - d));
    }
  }
}

// Once a day, at dawn when everyone is home: how much grass each tile's soil holds (shadeSoil), and each
// warren's latrines, a ring of dung heaps round the hole, get a day's droppings from the rabbits in it.
function groundTick(w) {
  shadeSoil(w);
  for (const b of w.burrows) {
    if (!b.count) continue;
    for (let k = 0; k < LATRINES; k++) {
      const a = (k + hash2(b.id, k, 53)) / LATRINES * Math.PI * 2;
      enrich(w, b.x + Math.cos(a) * LATRINE_OUT, b.y + Math.sin(a) * LATRINE_OUT, LATRINE_RICH * b.count, LATRINE_REACH);
    }
  }
}

// How much grass each tile's soil holds in the shade on it now (w.shadedFert, which growGrass reads).
function shadeSoil(w) {
  const shade = SHADE_GRASS * (leafless(w.tick) ? BARE_SHADE : 1);
  for (let i = 0; i < W * H; i++) w.shadedFert[i] = w.fert[i] * (1 - shade * w.wood[i]);
}

// ---------------------------------------------------------------- weather
//
// The sky picks a weather from the season's odds. The ground remembers it: rain soaks it,
// sun dries it.

const sky = w => WEATHER[w.weather.kind];

// ---------------------------------------------------------------- camouflage
//
// A fox spots a still rabbit from further off when its coat stands out from the ground under it. The
// ground is judged in the colours the meadow is drawn with (game.js PALETTE is GROUND.seasons). At night
// it is shadow, where a brown coat vanishes and a white one shows, except where snow lies.

const GROUND = {
  seasons: [   // [bare ground, lush grass] per season
    [[214, 197, 150], [128, 193, 107]],
    [[226, 206, 142], [113, 175, 87]],
    [[226, 214, 178], [184, 146, 72]],   // amber, so grazed ground shows paler
    [[226, 231, 238], [168, 196, 200]],  // frost-blue
  ],
  snow: [246, 248, 252], night: [22, 30, 78],
};
const CAMO = [0.7, 1.4];        // a fox's spotting distance, of its sight, from a perfect match to a clash
const CAMO_CLASH = 0.8;         // how much a colour difference (0 same, about 1 very unlike) adds
const groundAt = [0, 0, 0];     // (groundRGB's answer: it's asked often, so no new arrays)

// The ground's colour at x, y, into groundAt.
function groundRGB(w, x, y) {
  const i = idx(x, y), pal = GROUND.seasons[seasonOf(w.tick)], bare = pal[0], lush = pal[1];
  let v = clamp(w.grass[i] / 0.85, 0, 1);
  v = v * (2 - v);
  const snow = clamp(w.snow * 1.4 - 0.3, 0, 0.9), night = isNight(w.tick) ? 0.6 * (1 - snow) : 0;   // moonlit snow stays bright
  const f = w.fieldAt[i] >= 0 ? w.fields[w.fieldAt[i]] : null, bloom = fieldBloom(w, f, i, v);
  for (let k = 0; k < 3; k++) {
    let c = lerp(bare[k], lush[k], v);
    if (bloom > 0) c = lerp(c, f.tint[k], bloom);
    c = lerp(c, GROUND.snow[k], snow);
    groundAt[k] = lerp(c, GROUND.night[k], night);
  }
  return groundAt;
}

// How far off a fox can pick this rabbit out, as a share of its sight.
function visibility(w, c) {
  if (c.mode === 'flee') return CAMO[1];       // running, it's seen whatever its coat
  const b = groundRGB(w, c.x, c.y), q = whiteness(w, c);
  const d = Math.hypot(lerp(WILD_COAT[0], WINTER_COAT[0], q) - b[0], lerp(WILD_COAT[1], WINTER_COAT[1], q) - b[1],
    lerp(WILD_COAT[2], WINTER_COAT[2], q) - b[2]) / 255;
  return clamp(CAMO[0] + CAMO_CLASH * d, CAMO[0], CAMO[1]);
}

// How strongly a field tints the ground at tile i: only in its season, where the grass is lush.
const FIELD_TINT = 0.3;          // at most this much of the field's colour
const fieldBloom = (w, f, i, v) => (f && f.season === seasonOf(w.tick) ? FIELD_TINT * w.fieldIn[i] * v : 0);

function setWeather(w, kind, ticks) {
  if (kind === w.weather.kind) { w.weather.until = Math.max(w.weather.until, w.tick + ticks); return; }
  const prev = w.weather.kind;
  w.weather = { kind, until: w.tick + ticks };
  emit(w, { type: 'weather', kind, prev });
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
    if (w.weather.kind === 'storm' && w.tick < CLEAR_END) setWeather(w, 'clear', CLEAR_END - w.tick);   // (the opening storm blows over)
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
  if (w.rng.next() < (kind === 'storm' ? 1 / 80 : kind === 'heat' ? 1 / 900 : 0) / SLOW) {
    let x, y;
    do { x = w.rng.range(1, W - 1); y = w.rng.range(1, H - 1); } while (isWater(w, x, y));
    strike(w, x, y);
  }
}

function strike(w, x, y) {
  // Lightning likes trees, the tallest about.
  let tree = null;
  forEachDecorNear(w, x, y, 4, d => {
    if (standing(d) && d.size >= SAPLING && (d.x - x) ** 2 + (d.y - y) ** 2 < 16 && (!tree || d.size > tree.size)) tree = d;
  });
  if (tree) { x = tree.x; y = tree.y; if (tree.hive) hiveMoves(w, tree.hive, 'lightning'); struck(w, tree); }
  let victim = null;
  forEachNear(w, x, y, 1.2, o => { victim = o; });
  if (victim) die(w, victim, 'lightning');
  // Thunder: every rabbit out in the open bolts for a burrow.
  forEachNear(w, x, y, 22, o => frighten(o, x, y, 'thunder'), 'rabbit');
  emit(w, { type: 'lightning', x, y, tree: !!tree, victim });
}

function frighten(c, x, y, what) {
  c.fright = what === 'thunder' ? 90 : 40;
  c.frightX = x; c.frightY = y; c.frightWhat = what;
}

// ---------------------------------------------------------------- spatial grid

// One grid with everyone, and one per species: a rabbit looking out for foxes then only
// looks at foxes, not at the whole warren around it. Rebuilt every tick, so the cells are
// reused and only their counts reset (emptying an array makes it reallocate as it refills).
const makeGrid = () => ({ cells: Array.from({ length: GW * GH }, () => []), n: new Int32Array(GW * GH) });

// A species' own grid, the busiest lookup there is: by name, one after another (and any other the usual way). Looked
// up as w.grids[species], it went the slow way every time, the one spot meeting all six names.
function gridOf(w, s) {
  const g = w.grids;
  return s === 'rabbit' ? g.rabbit : s === 'fox' ? g.fox : s === 'bee' ? g.bee : s === 'crow' ? g.crow : s === 'otter' ? g.otter : g[s];
}

function buildGrid(w) {
  const all = w.grid, list = w.creatures;
  all.n.fill(0);
  for (const s of KINDS) w.grids[s].n.fill(0);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c.alive || c.hidden) continue;
    const k = clamp((c.y / CELL) | 0, 0, GH - 1) * GW + clamp((c.x / CELL) | 0, 0, GW - 1);
    const mine = gridOf(w, c.species);
    all.cells[k][all.n[k]++] = c;
    mine.cells[k][mine.n[k]++] = c;
  }
}

function forEachNear(w, x, y, radius, fn, species) {
  const grid = species ? gridOf(w, species) : w.grid;
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

// Every plant in the grid cells that reach within radius of x, y (some a little further off), and
// the blossom in the trees.
function forEachPlantNear(w, x, y, radius, fn) {
  const x0 = clamp(((x - radius) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + radius) / CELL) | 0, 0, GW - 1);
  const y0 = clamp(((y - radius) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + radius) / CELL) | 0, 0, GH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    for (const p of w.plantCells[gy * GW + gx]) fn(p);
    for (const p of w.blossomCells[gy * GW + gx]) fn(p);
  }
}

function nearest(w, c, radius, species, pred) {   // (forEachNear's walk, written out: it's the busiest)
  const grid = species ? gridOf(w, species) : w.grid, x = c.x, y = c.y;
  const x0 = clamp(((x - radius) / CELL) | 0, 0, GW - 1), x1 = clamp(((x + radius) / CELL) | 0, 0, GW - 1);
  const y0 = clamp(((y - radius) / CELL) | 0, 0, GH - 1), y1 = clamp(((y + radius) / CELL) | 0, 0, GH - 1);
  const r2 = radius * radius;
  let best = null, bd = Infinity;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const k = gy * GW + gx, cell = grid.cells[k];
    for (let j = 0, n = grid.n[k]; j < n; j++) {
      const o = cell[j];
      if (!o.alive || o.hidden) continue;
      const d2 = (o.x - x) ** 2 + (o.y - y) ** 2;
      if (d2 > r2 || o === c || d2 >= bd || pred && !pred(o)) continue;
      best = o; bd = d2;
    }
  }
  return best;
}

// ---------------------------------------------------------------- creatures

function roman(n) {
  const r = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, l] of r) while (n >= v) { s += l; n -= v; }
  return s;
}

// Names are a prefix and a suffix (Hazel + tail), dealt from a shuffled deck of every pairing
// so they rarely repeat. An empty deck is shuffled again, and a repeat gets a number: Hazeltail II.
function pickName(w, species) {
  const { prefixes, suffixes, whole } = NAME_PARTS[species];
  if (whole && w.rng.next() < 0.15) {
    const base = w.rng.pick(whole);
    const key = species + ':' + base;
    const n = (w.nameCounts.get(key) || 0) + 1;
    w.nameCounts.set(key, n);
    return n === 1 ? base : base + ' ' + roman(n);
  }
  w.namePools ??= {};
  let deck = w.namePools[species];
  if (!deck || !deck.length) {
    deck = w.namePools[species] = w.rng.shuffle(prefixes.flatMap(p => suffixes.map(s => p + s)));
  }
  const base = deck.pop();
  const key = species + ':' + base;
  const n = (w.nameCounts.get(key) || 0) + 1;
  w.nameCounts.set(key, n);
  return n === 1 ? base : base + ' ' + roman(n);
}

// Winter coats: a rabbit's moult (c.moult, 0 to 1) is how white it turns for winter. It pales through late autumn
// and colours again early in spring (whiteness). A kit takes one parent's, a little changed now and then, so over a
// winter or two the meadow's rabbits lean whiter after snowy winters (hidden on snow, and a white coat is a thick one)
// and browner after bare ones (a white rabbit on bare ground, or on spring grass after an early thaw, is easy to see).
const WILD_COAT = [150, 114, 80];       // every rabbit's own colour (game.js COAT)
const WINTER_COAT = [236, 236, 230];
const MOULT_START = 0.5;        // founders: about half turn white in their first winter
const MOULT_SPREAD = 0.12;      // and how far apart they are
const MOULT_DRIFT = 0.045;      // a kit's differs from its parent's by about this, now and then (MOULT_ODDS)
const MOULT_ODDS = 0.35;
const MOULT_WARM = 0.3;         // a white winter coat is a thick one: this much less burnt while snow lies
const MOULT_FROM = 0.3, MOULT_TO = 0.7;   // below this moult a coat stays; above, it turns fully white

// How white a rabbit has turned (0 to 1).
function whiteness(w, c) {
  if (c.species !== 'rabbit') return 0;
  const y = (w.tick / TPD % YEAR_DAYS) / SEASON_DAYS;       // 0 to 4 through the year, spring first
  const winter = y >= 3 ? 1 : y > 2.5 ? (y - 2.5) / 0.5 : y < 0.5 ? 1 - y / 0.5 : 0;
  if (winter === 0) return 0;
  const m = clamp((c.moult - MOULT_FROM) / (MOULT_TO - MOULT_FROM), 0, 1);
  return m * m * (3 - 2 * m) * winter;
}

const FLEE_DIST = 0.7;           // a rabbit runs from a fox this close, of how far it sees
const POUNCE = 5.5;             // tiles: a stalking fox this close charges
const FRIENDLY = 0.5;           // odds a check that a rabbit or a crow goes over to the others

function computeTraits(c) {
  const sp = c.sp;
  c.maxEnergy = sp.maxEnergy; c.burnRate = sp.burn * sp.hunger;
  c.walk = sp.walk; c.sprint = sp.sprint; c.sight = sp.sight;
  c.fleeDist = c.sight * FLEE_DIST; c.pounce = POUNCE;
}

// Every field a creature ever has, in one place: makeCreature fills it in, and so does unpackWorld for a kept one.
// So all creatures are laid out alike, and the browser keeps reading their fields fast: a field added later (or deleted),
// or one that first holds a whole number and later a fraction, gives the objects a new layout, and the code that has met
// more than a few layouts reads every field the slow way, for good. -0 is a zero that's kept like a fraction: the fields
// that ever hold one start as it.
const blankCreature = () => ({
  id: 0, species: '', sp: null, x: -0, y: -0, scale: -0, fur: -0, moult: -0,   // (moult: a rabbit's winter coat)
  name: '', sex: '', gen: 0, mumId: 0, dadId: 0,
  born: -0, lifespan: -0,
  alive: true, died: 0, cause: '',
  energy: -0, stamina: -0, heading: -0, facing: 1, turnBias: 1,
  mode: 'wander', target: null, targetId: 0, timer: 0, moved: -0,
  sprinting: false, sleeping: false, hidden: false, burrow: null, home: null, refuge: null, dig: null,
  alert: 0, threatId: 0, chaseT: 0, fright: 0, frightX: -0, frightY: -0, frightWhat: '',
  wary: 0, waryX: -0, waryY: -0, detour: 0, detourX: -0, detourY: -0, nemesisId: 0, haunt: null,
  pregnantUntil: 0, cooldownUntil: 0, dadIdPending: 0, dadGenPending: 0, dadMoult: -0,
  kids: 0, kills: 0, frogs: 0, fish: 0, escapes: 0, visits: 0, load: 0, find: null, story: null,
  caches: null,         // a crow's acorns and beechnuts buried this autumn (cacheNut)
  pips: 0,              // a crow's: when it first ate the blackberries in it, whose pips it'll drop (dropPips)
  mate: 0,              // a crow's mate, for life (by id; mateOf)
  perch: null,          // a crow's seat in the roost (roostSeat)
  maxEnergy: -0, burnRate: -0, walk: -0, sprint: -0, sight: -0, fleeDist: -0, pounce: -0,   // (computeTraits)
  snack: '',            // a rabbit's windfall: 'apple', or what a nut tree drops (windfall)
  queen: null,          // a bee's mother, the queen (layEggs)
  calm: 0, cubsIn: 0, slide: null,   // an otter's: paying foxes no mind till then; cubs still in the holt; its slide (otterTick)
  killerId: 0,          // who caught it (die)
});

function makeCreature(w, species, x, y, parents) {
  const sp = SPECIES[species];
  const r = w.rng;
  const c = blankCreature();
  c.id = w.nextId++; c.species = species; c.sp = sp; c.x = x; c.y = y;
  c.scale = r.range(0.9, 1.1); c.fur = parents ? parents.mum.fur : r.next();
  if (species === 'rabbit') {                                  // one parent's winter coat, now and then a little changed
    const m = parents ? (r.next() < 0.5 ? parents.mum.moult : parents.dadMoult) + (r.next() < MOULT_ODDS ? MOULT_DRIFT * r.normal() : 0)
      : MOULT_START + MOULT_SPREAD * r.normal();
    c.moult = clamp(m, 0, 1);
  }
  c.name = pickName(w, species);
  c.sex = species === 'bee' || r.next() < 0.5 ? 'F' : 'M';
  c.gen = parents ? Math.max(parents.mum.gen, parents.dadGen) + 1 : 1;
  c.mumId = parents ? parents.mum.id : 0; c.dadId = parents ? parents.dadId : 0;
  c.born = w.tick; c.lifespan = (sp.winterLifeDays && seasonOf(w.tick) >= 2 ? sp.winterLifeDays : sp.lifeDays) * TPD * r.range(0.8, 1.2);
  c.stamina = 1; c.heading = r.range(0, Math.PI * 2);
  c.story = [];
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

function emit(w, e) {
  e.t = w.tick; w.events.push(e);
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
  if (!(dry(w, x, y) || SPECIES[species].swims && inBounds(x, y))) return null;
  const c = makeCreature(w, species, x, y, null);
  if (opts.sex && species !== 'bee') c.sex = opts.sex;          // bees out and about are all workers
  if (opts.age) c.born = w.tick - Math.min(opts.age * TPD, c.lifespan / 2);   // nobody arrives at death's door
  c.home = species === 'bee' ? nearestHive(w, x, y) : species === 'rabbit' || species === 'fox' ? nearestBurrow(w, x, y, 40) : null;   // (a crow's is its nest, an owl's its hollow, an otter's its holt)
  note(w, c, '🌍', opts.note || (opts.arrived ? 'Wandered into the meadow' : 'Arrived in the meadow'));
  w.newborn.push(c);
  w.byId.set(c.id, c);
  return c;
}

// ---------------------------------------------------------------- movement

// True when the straight walk from one point to another stays on land (checked every half tile).
function clearPath(w, x0, y0, x1, y1) {
  const n = Math.ceil(hypot(x1 - x0, y1 - y0) * 2);
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
  if (w.water[idx(c.x, c.y)] && !w.frozen) v *= c.sp.wade;   // wading: rabbits hate it more than foxes
  const dx = tx - c.x, dy = ty - c.y, d = hypot(dx, dy);
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
    const h = a + off, cx = Math.cos(h), nx = c.x + cx * stepLen, ny = c.y + Math.sin(h) * stepLen;
    if (!(c.sp.swims ? inBounds(nx, ny) : walkable(w, nx, ny))) continue;   // (an otter swims the deep water)
    if (!c.detour && off !== 0) {
      c.turnBias = off > 0 ? 1 : -1;
      c.detour = 500; c.detourX = tx; c.detourY = ty;
    }
    c.x = nx; c.y = ny; c.heading = h; c.moved = stepLen;
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
    } while (!roamable(w, c, tx, ty) && ++tries < 8);   // paddling, but not for fun
    c.target = roamable(w, c, tx, ty) ? { x: tx, y: ty } : { x: c.x, y: c.y };
    c.timer = 200;
  }
  c.mode = 'wander';
  moveToward(w, c, c.target.x, c.target.y, c.walk * pace * kidPace(w, c));
}

const kidPace = (w, c) => 0.6 + 0.4 * growth(w, c);
// Somewhere to wander to: dry ground (or the ice) in a straight walk, or for an otter, the water and its banks.
const roamable = (w, c, x, y) => (c.sp.swims ? inBounds(x, y) && w.damp[idx(x, y)] <= OTTER_SHORE : footing(w, x, y) && clearPath(w, c.x, c.y, x, y));

// Walk, or fly for those that can (see fly, with the bees).
const go = (w, c, tx, ty, v) => (c.sp.flies ? fly(c, tx, ty, v) : moveToward(w, c, tx, ty, v));

// ---------------------------------------------------------------- love

function readyToMate(w, c) {
  return c.alive && !c.hidden && isAdult(w, c) && c.pregnantUntil === 0
    && w.tick >= c.cooldownUntil && c.energy >= c.sp.breedEnergy * c.maxEnergy
    && c.sp.breedSeasons.includes(seasonOf(w.tick))
    && w.count[c.species] + w.expecting[c.species] < c.sp.cap * w.room
    && (c.species !== 'otter' || otterReady(c));
}

function seekLove(w, c) {
  if (!readyToMate(w, c)) { if (c.mode === 'love') c.mode = 'wander'; return false; }
  let partner = c.mode === 'love' ? w.byId.get(c.targetId) : null;
  if (partner && !readyToMate(w, partner)) partner = null;
  if (!partner && (w.tick + c.id) % 10 === 0) {
    // When a species is rare, the few left call louder: search the whole meadow.
    const range = w.count[c.species] < 30 ? 150 : c.sp.mateRange;
    partner = nearest(w, c, range, c.species, o => o.sex !== c.sex && readyToMate(w, o) && (c.species !== 'crow' || faithful(w, c, o)));
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
  mum.dadIdPending = dad.id; mum.dadGenPending = dad.gen; mum.dadMoult = dad.moult;
  w.recount = true;
  dad.cooldownUntil = w.tick + 0.4 * TPD;
  for (const c of [mum, dad]) { c.mode = 'wander'; c.target = null; c.targetId = 0; }
  if (mum.species === 'otter' && mum.home) dad.home = mum.home;    // he moves into her holt
  if (mum.species === 'crow') { mum.mate = dad.id; dad.mate = mum.id; }   // crows pair for life
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
  const kids = [];
  for (let k = 0; k < n; k++) {
    let x = mum.x + r.range(-1, 1), y = mum.y + r.range(-1, 1);
    if (!dry(w, x, y)) { x = mum.x; y = mum.y; }
    const kid = makeCreature(w, mum.species, x, y, { mum, dadId: mum.dadIdPending, dadGen: mum.dadGenPending, dadMoult: mum.dadMoult });
    kid.home = mum.home || mum.burrow;
    if (mum.hidden && mum.burrow) { kid.hidden = true; kid.burrow = mum.burrow; kid.sleeping = true; kid.mode = 'sleep'; kid.timer = 60; mum.burrow.count++; }
    if (mum.species === 'crow' || mum.species === 'otter') {   // chicks, in the nest till they fledge (crowTick), cubs in the holt (otterTick)
      const nest = (mum.species === 'otter' ? holtOf(mum)?.door : mum.home) || mum;
      Object.assign(kid, { x: nest.x, y: nest.y, hidden: true, sleeping: true, mode: 'nest' });
    }
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
  emit(w, { type: 'birth', mum, dad, kids });
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
const DIG_TICKS = 3600;    // one rabbit digging on its own: two minutes

function canDig(w, x, y) {
  if (w.isle && w.isle[idx(x, y)]) return false;                 // (a kept meadow from before the islands has none)
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (!dry(w, x + dx, y + dy)) return false;
  return !w.burrows.some(b => hypot(b.x - x, b.y - y) < DIG_GAP)
    && !w.decor.some(d => !d.stone && !(standing(d) && d.size < SAPLING) && hypot(d.x - x, d.y - y) < (d.big ? d.size * 0.6 : 2))
    && !w.hives.some(h => hypot(h.x - x, h.y - y) < 3);
}

function newBurrow(w, x, y, dug) {
  const b = { id: w.nextBurrow++, x: -0, y: -0, count: 0, dug: -0, used: w.tick };   // (the fractions as -0: see blankCreature)
  b.x = x; b.y = y; b.dug = dug;
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

// Diggers work side by side, one on each side of the hole, facing it. One called away for a
// meal comes back to finish (c.dig stays).
function dig(w, c) {
  const b = c.dig;
  if (!b || b.dug >= 1) { c.dig = null; c.mode = 'wander'; return false; }
  c.mode = 'dig';
  const side = c.id % 2 ? 1 : -1;
  if (!moveToward(w, c, b.x + 0.7 * side, b.y + 0.2, c.walk)) return true;
  c.facing = -side;
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
  if (c.mode === 'thicket' && thicket(w, c)) return;
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
      const chance = fox.mode === 'chase' ? 0.22
        : 0.035 * (c.sleeping ? 0.3 : 1) * (night ? 0.5 : 1) * (c.wary > 0 ? 1.6 : 1)
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
    const b = c.home && hasRoom(c.home) && hypot(c.home.x - c.x, c.home.y - c.y) < 35 ? c.home
      : nearestBurrow(w, c.x, c.y, 35, roomy);
    if (b) { c.home = b; return goHome(w, c, b); }
    c.mode = 'sleep'; c.sleeping = true; return;
  }

  // 4. Love.
  if (seekLove(w, c)) return;

  // 5. Moving in: a newcomer makes for its spot first, unless it's hungry.

  // 6. Food. Windfalls first, in autumn, unless it's too hungry to walk for them: then the grass at hand (a crowd
  // milling about the orchard after the last apples, foxes among them, starved where the grass was all about).
  const satiation = seasonOf(t) === 2 ? 0.95 : 0.85;
  if ((c.mode === 'munch' || e < satiation && e > APPLE_HUNGRY) && w.windfalls && windfall(w, c)) return;
  if (c.mode === 'apple') { c.mode = 'wander'; c.target = null; }
  const i = idx(c.x, c.y);
  if (c.mode === 'graze') {
    if (w.grass[i] > 0.06 && e < 0.98) { eat(w, c, i); return; }
    c.mode = 'wander'; c.target = null;
  }
  if (e < satiation) {
    const skittish = c.wary > 0 && e > 0.4 && (c.x - c.waryX) ** 2 + (c.y - c.waryY) ** 2 < 36;
    if (w.grass[i] > 0.3 && !skittish && !fouled(w, i)) { c.mode = 'graze'; eat(w, c, i); return; }
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

  // 7. Fed and safe: dig, sit, find friends, or amble.
  if (c.dig && dig(w, c)) return;
  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; c.target = null; }
  if ((t + c.id) % 30 === 0) {
    if (isAdult(w, c) && startDigging(w, c)) return;
    if (w.rng.next() < FRIENDLY) {
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
  w.bitten[i] = c.id;                                       // any seedling here is in danger (treesTick)
  c.energy = Math.min(c.maxEnergy, c.energy + bite * GRASS_ENERGY);
}

function findFood(w, c) {
  let best = null, bestScore = 0.15;
  for (let k = 0; k < 14; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(1, c.sight);
    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    const j = idx(x, y), score = (fouled(w, j) ? 0 : w.grass[j]) / (1 + 0.1 * r);   // (off the map: no score, or no clear path)
    if (score > bestScore && clearPath(w, c.x, c.y, x, y)) { bestScore = score; best = { x: (x | 0) + 0.5, y: (y | 0) + 0.5 }; }   // grass across the pond doesn't count
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

// Runs from a fox, or from anything with an x and a y (thunder).
function flee(w, c, fox) {
  if (c.mode !== 'flee') {
    c.mode = 'flee'; c.sleeping = false; c.threatId = fox.id; c.target = null;
    c.refuge = pickRefuge(w, c, fox);
    if (fox.id) thump(w, c, fox);
  }
  let tx, ty;
  if (c.refuge && (c.refuge.bramble ? (w.tick + c.id) % 30 === 0 && !w.brambles.includes(c.refuge) : !hasRoom(c.refuge))) c.refuge = pickRefuge(w, c, fox);   // filled up, or gone: try another
  const b = c.refuge;
  if (b) {
    tx = b.x; ty = b.y;
    if ((b.x - c.x) ** 2 + (b.y - c.y) ** 2 < (b.bramble ? 0.3 + 0.2 * b.size : 0.8)) {
      if (b.bramble) enterThicket(w, c, b, fox); else enterBurrow(w, c, b, w.rng.int(150, 350), false);
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

// The nearest burrow with room, or grown bramble (thicket), that isn't towards the fox.
function pickRefuge(w, c, fox) {
  const fx = fox.x - c.x, fy = fox.y - c.y, fd = hypot(fx, fy) || 1;
  let best = null, bd = 8 * 8;
  const consider = b => {
    const bx = b.x - c.x, by = b.y - c.y, d2 = bx * bx + by * by;
    if (d2 >= bd || !clearPath(w, c.x, c.y, b.x, b.y)) return;
    const bdl = Math.sqrt(d2) || 1;
    const towardFox = (bx * fx + by * fy) / (bdl * fd);
    if (bdl < 2.5 || towardFox < 0.3) { best = b; bd = d2; }
  };
  for (const b of w.burrows) if (roomy(b)) consider(b);
  for (const b of w.brambles) if (b.size > 0) consider(b);
  return best;
}

// Into the thorns: it crouches deep in the bramble (c.refuge), its own spot by its id, and sits tight while the fox is
// about (thicket), counting down c.alert. No fox follows it in (hunt), so it's safe there, but in sight.
function enterThicket(w, c, b, fox) {
  const side = c.id % 2 ? 1 : -1, u = side * (0.3 + 0.1 * b.size + 0.1 * ((c.id * 0.618034) % 1));
  c.x = clamp(b.x + u, 0.5, W - 0.5); c.y = b.y + 0.03;           // (tucked in at its foot, under the arching canes)
  c.mode = 'thicket'; c.timer = w.rng.int(...THICKET_TICKS); c.alert = THICKET_MOST; c.target = null; c.sprinting = false;
  c.facing = fox.x > c.x ? 1 : -1;
  if (fox.id && fox.targetId === c.id) { escaped(w, c, fox, 'bramble'); fox.targetId = 0; fox.mode = 'wander'; }
}
function thicket(w, c) {
  const b = c.refuge;
  if (b && --c.alert > 0 && c.energy > 0.3 * c.maxEnergy && ((w.tick + c.id) % 30 || w.brambles.includes(b))) {
    if (--c.timer > 0) return true;
    if (nearest(w, c, THICKET_FOX, 'fox', o => !o.sleeping)) { c.timer = 40; return true; }
  }
  c.mode = 'wander'; c.refuge = null; c.alert = 0;
  return false;
}

// ---------------------------------------------------------------- foxes

function foxTick(w, c) {
  const t = w.tick, night = isNight(t), ph = phaseOf(t);
  const e = c.energy / c.maxEnergy;
  c.sleeping = false;

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
  if (c.pips && t - c.pips > PIP_GUT) dropPips(w, c);

  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; }
  if (e < FOX_BERRY_FED && !young && foxBerries(w, c)) return;
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
  if (prey && prey.mode === 'thicket') { prey = null; c.targetId = 0; c.mode = 'wander'; }   // (into the thorns: enterThicket)
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
    // And it spots one from as far off as its coat stands out from the ground under it (visibility).
    prey = nearest(w, c, sight * CAMO[1], 'rabbit', o => o.mode !== 'thicket' && !(o.alert > 0 && o.threatId === c.id)
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
  note(w, rabbit, '💨', how === 'burrow' ? `Dived into a burrow to escape ${fox.name}` : how === 'bramble' ? `Hid deep in a bramble from ${fox.name}`
    : how === 'pond' ? `Got away from ${fox.name} across ${water ? water.name : 'the water'}` : `Outran ${fox.name}`);
  note(w, fox, '😤', `${rabbit.name} got away`);
  emit(w, { type: 'escape', rabbit, fox, how, water });
}

// A hunt that came to nothing. Three of those and the old hunting ground is forgotten.
function missed(fox) {
  if (fox.haunt && --fox.haunt.n <= 0) fox.haunt = null;
}

// A rabbit, or now and then a crow off its guard (crowTick): a lucky catch and a small one, which changes
// neither the fox's search image (hunt) nor where it hunts. What the fox doesn't eat it leaves (die).
function catchPrey(w, fox, prey) {
  const gain = (40 + 0.4 * prey.energy) * (0.4 + 0.6 * growth(w, prey)) * (prey.species === 'crow' ? CROW_MEAL : 1);
  fox.energy = Math.min(fox.maxEnergy, fox.energy + gain);
  fox.kills++;
  fox.mode = 'eat'; fox.timer = 80; fox.targetId = 0;
  note(w, fox, '🍖', `Caught ${prey.name}`);
  if (prey.species === 'rabbit') {
    fox.haunt = { x: prey.x, y: prey.y, n: 3 };   // good hunting here; worth a few more tries
    // Share with own young cubs nearby.
    forEachNear(w, fox.x, fox.y, 8, o => {
      if (o.mumId === fox.id && growth(w, o) < 0.6) o.energy = Math.min(o.maxEnergy, o.energy + 30);
    }, 'fox');
  }
  die(w, prey, 'fox', fox);
}

// ---------------------------------------------------------------- frogs
//
// Common frogs, too many and too small to follow one by one: w.frogs is how many live on
// each tile of land, and w.spawn how much spawn, and then tadpoles, lies in each tile of shallow water.
// From spring to autumn the frogs live in the damp long grass near the water (frogRoom): grazed short it
// holds fewer, and in a heatwave only the shore stays damp. They winter in the mud, and a hard winter with
// ice lying thins them more. On a mild night early in spring, once the water is up, they spawn in the
// shallows about (spawnFrogs): still water, a flood pool out on the floodplain best (warm, and no fish),
// the lasting shallows less, by the river's current or the deep hardly at all. The tadpoles grow as one
// (w.frogYear.grown), faster in the sun, and leave the water as froglets for the grass about. But the
// flood pools go when the water falls back in summer (waterTick), or in a dry spell, and tadpoles still in
// one that dries out die: an early spawning and a warm spring beat the drop, a late cold one doesn't. That's
// what makes a frog year. The otters root them out of the shallows (rooted), and the crows pick the spawn and tadpoles out (tadpoles).

const FROG_EVERY = TPD / 10;     // ticks between counts
const FROG_K = 0.3;             // frogs a tile of damp long grass right by the water has room for
const FROG_REACH = 6;           // tiles from the water the grass is damp enough for them, fewer the further
const FROG_DRY = 3;             // and in a heatwave, only this close
const FROG_BARE = 0.3;          // grass grazed short (SHORT_GRASS) has room for this share of them, long (LONG_GRASS) for all
const SHORT_GRASS = 0.2, LONG_GRASS = 0.5;
const FROG_FADE = 0.3;          // share of those over a tile's room gone in a day
const FROG_DIE = 0.01;          // share gone each day from spring to autumn anyway: grass snakes, herons, old age
const FROG_COLD = 0.03;         // share gone each winter day, in the mud
const FROG_ICE = 2;             // times that while the ice lies
const FROG_SPREAD = 0.2;        // share that moves next door each count
const FROG_START = 0.3;         // a new meadow's frogs, as a share of the room
const DAMP_EVERY = TPD;         // ticks between workings-out of how far each tile is from the water (w.damp), at most
const SPAWN_FROM = 1.4;         // days into spring before they spawn: the water's up by then
const SPAWN_BY = 4.9;           // and by this many they have, mild night or not
const SPAWN_ODDS = 0.5;         // odds a night is mild enough (a wet night always is)
const SPAWN_REACH = 6;          // frogs this close to the shallows spawn in them
const EGGS = 8;                 // froglets one frog's spawn would come to, if nothing ate them and the water stayed
const SPAWN_EDGE = 0.5;         // how good the lasting shallows are, against a flood pool on the floodplain
const SPAWN_DEEP = 6;           // deep tiles within two that make shallows no good (the current, the fish)
const TADPOLE_DAYS = 4.5;       // days from spawn to froglet, at an ordinary warmth
const WARMTH = { clear: 1.25, heat: 1.4, cloudy: 1, fog: 0.8, rain: 0.85, storm: 0.85, snow: 0.5 };   // how fast they grow, by the weather
const TADPOLE_LOSS = 0.05;      // share gone a day anyway (beetles, newts)
const TADPOLE_FISH = 0.5;       // and more where there are fish (w.fish), this much more at FISH_K
const FROGLET_LEAVE = 2;        // share of the grown ones that leave the water a day
const FROGLET_REACH = 4;        // tiles from the water the froglets get
const SPAWN_BITE = 0.02 / SLOW;  // spawn a crow picks out a tick (twice the best grubs' worth)
const SPAWN_ENERGY = 10 * HUNGER;   // what each one is worth to it
const SPAWN_WORTH = 0.15;       // spawn on a tile worth flying down to
const SPAWN_SPOTS = 12;         // the best tiles of spawn, a few apart, for the crows to find (w.spawnSpots)
const SPAWN_RANGE = 30;         // how far off a crow flies for them
const FROG_BOOM = 4.4;          // froglets for each frog that spawned that make a big frog year (news)
const FROG_POOR = 0.7;          // and fewer than this, a poor one
const STRAND_NEWS = 0.08;       // share of the year's spawn stranded at once that makes the news

const frogCover = g => (g >= LONG_GRASS ? 1 : g <= SHORT_GRASS ? FROG_BARE : FROG_BARE + (1 - FROG_BARE) * (g - SHORT_GRASS) / (LONG_GRASS - SHORT_GRASS));
const NEXT_DOOR = [1, W, -1, -W];   // next door, one way each count (frogsTick, fishTick)
const frogRoom = (d, g, reach) => (d > reach ? 0 : FROG_K * (1 - (d - 1) / reach) * frogCover(g));   // d: tiles to the water (w.damp)

// Scratch maps for the counts (never kept, filled afresh each time).
const FROG_A = new Float32Array(W * H), FROG_B = new Float32Array(W * H), FROG_C = new Float32Array(W * H), FROG_D = new Float32Array(W * H), FROG_T = new Float32Array(W * H);

// dst: the sum of src over the square r tiles round each tile (tmp: a scratch map).
function boxSum(src, dst, r, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = 0; x < r; x++) s += src[o + x];
    for (let x = 0; x < W; x++) {
      if (x + r < W) s += src[o + x + r];
      tmp[o + x] = s;
      if (x >= r) s -= src[o + x - r];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = 0; y < r; y++) s += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      if (y + r < H) s += tmp[(y + r) * W + x];
      dst[y * W + x] = s;
      if (y >= r) s -= tmp[(y - r) * W + x];
    }
  }
}

// Shares `from` (on some tiles) out over the tiles r round each in proportion to `weight`, adding it to
// `to`; what has no weight within r stays in `back`. Says how much went. (Uses FROG_B, FROG_T; from is used up.)
function shareOut(from, weight, r, to, back) {
  const sum = FROG_B;
  boxSum(weight, sum, r, FROG_T);
  for (let i = 0; i < W * H; i++) {
    if (from[i] === 0) continue;
    if (sum[i] > 1e-6) from[i] /= sum[i];
    else { back[i] += from[i]; from[i] = 0; }
  }
  boxSum(from, sum, r, FROG_T);
  let went = 0;
  for (let i = 0; i < W * H; i++) {
    if (weight[i] === 0 || sum[i] <= 0) continue;
    const n = weight[i] * sum[i];
    to[i] += n; went += n;
  }
  return went;
}

// How far each tile is from the water (w.damp), as distanceTo but in place and only as far as a frog cares.
function dampen(w) {
  const d = w.damp, water = w.water, far = FROG_REACH + 1;
  for (let i = 0; i < W * H; i++) d[i] = water[i] ? 0 : far;
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {      // from the tile behind, the row above and its corners
    let v = d[i];
    if (v === 0) continue;
    if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
    if (y > 0) {
      if (d[i - W] + 1 < v) v = d[i - W] + 1;
      if (x > 0 && d[i - W - 1] + 1.4 < v) v = d[i - W - 1] + 1.4;
      if (x < W - 1 && d[i - W + 1] + 1.4 < v) v = d[i - W + 1] + 1.4;
    }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1, i = y * W + x; x >= 0; x--, i--) {   // and back the other way
    let v = d[i];
    if (v === 0) continue;
    if (x < W - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
    if (y < H - 1) {
      if (d[i + W] + 1 < v) v = d[i + W] + 1;
      if (x < W - 1 && d[i + W + 1] + 1.4 < v) v = d[i + W + 1] + 1.4;
      if (x > 0 && d[i + W - 1] + 1.4 < v) v = d[i + W - 1] + 1.4;
    }
    d[i] = v;
  }
  w.dampOf = w.waterVersion; w.dampAt = w.tick;
}

// A new meadow has frogs in the damp grass by its water.
function startFrogs(w) {
  dampen(w);
  let total = 0;
  for (let i = 0; i < W * H; i++) {
    if (w.water[i]) continue;
    w.frogs[i] = frogRoom(w.damp[i], w.grass[i], FROG_REACH) * FROG_START;
    total += w.frogs[i];
  }
  w.frogCount = total;
}

// Every FROG_EVERY ticks: the spring's spawning, the frogs on land (each tile spilling over one way, a
// different one each count, in the order that has counted that one already, so what moves doesn't move on), then the spawn and tadpoles in the water.
function frogsTick(w) {
  const s = seasonOf(w.tick), dt = FROG_EVERY / TPD, yr = w.frogYear;
  if (w.dampOf !== w.waterVersion && w.tick - w.dampAt >= DAMP_EVERY) dampen(w);
  w.frogsOut = s !== 3;
  if (s === 0 && yr.year !== yearOf(w.tick)) Object.assign(yr, { year: yearOf(w.tick), at: -1, grown: 0, laid: 0, spawners: 0, stranded: 0, eaten: 0, left: 0, told: 0, dryDay: -1 });
  if (s === 0 && yr.at < 0 && isNight(w.tick)) {
    const into = dayOf(w.tick) % SEASON_DAYS + phaseOf(w.tick), k = w.weather.kind;
    if (into >= SPAWN_FROM && (into >= SPAWN_BY || k === 'rain' || k === 'storm' || hash2(dayOf(w.tick), w.seed, 77) < SPAWN_ODDS)) spawnFrogs(w);
  }
  if (yr.at >= 0 && yr.grown < 1) yr.grown += dt / TADPOLE_DAYS * (WARMTH[w.weather.kind] ?? 1);

  const f = w.frogs, g = w.grass, water = w.water, damp = w.damp, winter = s === 3;
  const reach = w.weather.kind === 'heat' ? FROG_DRY : FROG_REACH, fade = FROG_FADE * dt;
  const keep = 1 - (winter ? FROG_COLD * (w.frozen ? FROG_ICE : 1) : FROG_DIE) * dt;
  const off = NEXT_DOOR[Math.floor(w.tick / FROG_EVERY) % 4], back = off > 0, by = back ? -1 : 1;
  const ex = off === 1 ? W - 1 : off === -1 ? 0 : -1, ey = off === W ? H - 1 : off === -W ? 0 : -1;
  let total = 0;
  for (let y = back ? H - 1 : 0; y >= 0 && y < H; y += by) {
    for (let x = back ? W - 1 : 0, i = y * W + x; x >= 0 && x < W; x += by, i += by) {
      let n = f[i];
      if (n === 0) continue;
      if (n < 1e-4) { f[i] = 0; continue; }
      n *= keep;
      total += n;
      if (water[i]) {                                  // flooded out: they swim for the bank
        if (x !== ex && y !== ey) { const m = water[i + off] ? n / 2 : n; f[i + off] += m; n -= m; }
      } else if (!winter) {
        const room = frogRoom(damp[i], g[i], reach);
        if (n > room) n -= (n - room) * fade;
        if (x !== ex && y !== ey && !water[i + off]) { const m = n * FROG_SPREAD; f[i + off] += m; n -= m; }
      }
      f[i] = n;
    }
  }
  w.frogCount = total;
  if (w.spawnCount > 0) tadpolesTick(w, s, dt);
}

// Spawning, one mild night: each frog near the shallows shares its spawn out over the good water round it.
function spawnFrogs(w) {
  const yr = w.frogYear, q = FROG_A, near = FROG_C, water = w.water, sp = w.spawn, base = w.terrain.level;
  yr.at = w.tick;
  for (let i = 0; i < W * H; i++) q[i] = water[i] === DEEP ? 1 : 0;
  boxSum(q, near, 2, FROG_T);
  for (let i = 0; i < W * H; i++) {                  // how good each tile is: shallow, still, a flood pool best, rich water a little better (algae)
    q[i] = water[i] !== SHALLOW ? 0 : Math.max(0, 1 - near[i] / SPAWN_DEEP) * (w.ground[i] > base ? 1 : SPAWN_EDGE) * (1 + w.rich[i]);
  }
  boxSum(q, near, SPAWN_REACH, FROG_T);
  const eggs = near;                                 // (in place: each tile reads only its own)
  let spawners = 0;
  for (let i = 0; i < W * H; i++) {
    const n = w.frogs[i] > 0 && near[i] > 1e-6 ? w.frogs[i] : 0;
    eggs[i] = n * EGGS; spawners += n;
  }
  const laid = shareOut(eggs, q, SPAWN_REACH, sp, sp);   // (none is left over: each had good water near)
  yr.spawners = spawners; yr.laid = laid;
  let total = 0, n = 0;
  for (let i = 0; i < W * H; i++) {
    FROG_A[i] = 0;                                 // (shareOut leaves its from, eggs, in FROG_C; tadpolesTick wants FROG_A clear)
    if (sp[i] > 0) { total += sp[i]; w.spawnTiles[n++] = i; }
  }
  w.spawnN = n; w.spawnCount = total;
  if (laid > 1) emit(w, { type: 'frogs', what: 'spawn', water: mostIn(w, sp, water), laid, spawners });
}

// The named water with the most of `field` in or about it (on the tiles where `on` is set).
function mostIn(w, field, on) {
  const sum = new Float64Array(w.waters.length), at = new Int32Array(w.waters.length);
  for (let i = 0; i < W * H; i++) {
    if (!field[i] || !on[i]) continue;
    const b = w.nearBody[i];
    if (b >= 0) { sum[b] += field[i]; at[b] = i; }
  }
  let best = -1;
  for (let b = 0; b < sum.length; b++) if (sum[b] > 0 && (best < 0 || sum[b] > sum[best])) best = b;
  if (best < 0) return null;
  const x = at[best] % W + 0.5, y = ((at[best] / W) | 0) + 0.5;
  return nearLake(w, x, y) ? w.lake : w.waters[best];   // (as waterAt, on dry ground too)
}

// The spawn and tadpoles: stranded where the water's gone, a few lost each day, and once grown, off onto land.
// Only the tiles spawned in are looked at (w.spawnTiles, the first w.spawnN of them); FROG_A and FROG_D are
// left all naught.
function tadpolesTick(w, s, dt) {
  const sp = w.spawn, water = w.water, yr = w.frogYear, spots = w.spawnSpots, list = w.spawnTiles, n0 = w.spawnN;
  const leave = yr.grown < 1 ? 0 : s >= 2 ? 1 : Math.min(1, FROGLET_LEAVE * dt), out = FROG_A, dried = FROG_D;
  const lose = TADPOLE_LOSS * dt, eaten = TADPOLE_FISH * dt / FISH_K, fish = w.fish;
  spots.fill(-1);
  let total = 0, strand = 0, leaving = 0;
  for (let k = 0; k < n0; k++) {
    const i = list[k];
    let n = sp[i];
    if (n === 0) continue;
    if (!water[i]) { strand += n; dried[i] = n; sp[i] = 0; continue; }
    const f = Math.min(1, eaten * fish[i]);
    n *= Math.max(0, 1 - lose - f);
    if (leave) { out[i] = n * leave; n -= out[i]; leaving += out[i]; }
    if (n < 1e-4) n = 0;
    sp[i] = n; total += n;
    if (n > SPAWN_WORTH) spotSpawn(spots, sp, i);
  }
  if (strand > 0) {
    yr.stranded += strand;
    const day = dayOf(w.tick);
    if (strand > STRAND_NEWS * yr.laid && yr.dryDay !== day && yr.told < 8) {
      yr.dryDay = day; yr.told += 4;
      emit(w, { type: 'frogs', what: 'stranded', water: mostIn(w, dried, dried), share: strand / yr.laid, grown: yr.grown });
    }
  }
  if (leaving > 0) {
    if (!(yr.told & 1)) { yr.told |= 1; emit(w, { type: 'frogs', what: 'froglets', water: mostIn(w, out, out) }); }
    const L = FROG_C;
    for (let i = 0; i < W * H; i++) L[i] = water[i] ? 0 : frogCover(w.grass[i]);
    const went = shareOut(out, L, FROGLET_REACH, w.frogs, sp);   // (what finds no grass near stays: those tiles are on the list)
    yr.left += went; total += leaving - went; w.frogCount += went;
  }
  let kept = 0;
  for (let k = 0; k < n0; k++) {
    const i = list[k];
    out[i] = 0; dried[i] = 0;
    if (sp[i] > 0) list[kept++] = i;
  }
  w.spawnN = kept;
  w.spawnCount = total;
  // The year's verdict, once the tadpoles are gone one way or another.
  if (!(yr.told & 2) && yr.laid > 1 && (total < 0.03 * yr.laid || s >= 2)) {
    yr.told |= 2;
    const per = yr.left / Math.max(1, yr.spawners);
    emit(w, { type: 'frogyear', big: per >= FROG_BOOM, poor: per < FROG_POOR, per, stranded: yr.stranded / yr.laid });
  }
  if (total < 1e-3) { for (let k = 0; k < kept; k++) sp[list[k]] = 0; w.spawnN = 0; w.spawnCount = 0; }
}

// Keeps the best tiles of spawn in `spots`, at most one within a few tiles of another.
function spotSpawn(spots, sp, i) {
  const x = i % W, y = (i / W) | 0;
  let slot = -1, low = sp[i];
  for (let k = 0; k < SPAWN_SPOTS; k++) {
    const j = spots[k];
    if (j >= 0 && Math.abs(j % W - x) <= 4 && Math.abs(((j / W) | 0) - y) <= 4) { if (sp[j] < sp[i]) spots[k] = i; return; }
    const v = j < 0 ? -1 : sp[j];
    if (v < low) { low = v; slot = k; }
  }
  if (slot >= 0) spots[slot] = i;
}

// n frogs fewer about the tile x0, y0 (x0, y0 two tiles in from the edge).
function takeFrog(w, x0, y0, n) {
  let near = 0;
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) near += w.frogs[y * W + x];
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) w.frogs[y * W + x] *= Math.max(0, 1 - n / near);
  w.frogCount = Math.max(0, w.frogCount - Math.min(n, near));
}

// A hungry crow in spring: down to the spawn in the shallows, standing at the water's edge by it, and
// picking it out till the patch is done or it's full (crowTick stops it then).
function tadpoles(w, c) {
  if (c.mode === 'pool' || c.mode === 'tadpole') {
    const t = c.target, sp = w.spawn;
    if (sp[t.i] < SPAWN_WORTH / 4) { c.mode = 'wander'; c.target = null; return false; }
    if (c.mode === 'pool') {
      if (go(w, c, t.x, t.y, c.walk)) { c.mode = 'tadpole'; c.facing = t.i % W + 0.5 > c.x ? 1 : -1; }
      return true;
    }
    const got = Math.min(sp[t.i], SPAWN_BITE);
    sp[t.i] -= got; w.spawnCount -= got; w.frogYear.eaten += got;
    c.energy = Math.min(c.maxEnergy, c.energy + got * SPAWN_ENERGY);
    return true;
  }
  if ((w.tick + c.id) % 10 || w.spawnCount < SPAWN_WORTH || grubs(w, c.x, c.y) >= SPAWN_BITE * SPAWN_ENERGY / 2) return false;   // (good pecking here: it stays)
  let best = -1, bd = SPAWN_RANGE ** 2;
  for (const i of w.spawnSpots) {
    if (i < 0 || w.spawn[i] < SPAWN_WORTH) continue;
    const d = (i % W + 0.5 - c.x) ** 2 + (((i / W) | 0) + 0.5 - c.y) ** 2;
    if (d < bd) { best = i; bd = d; }
  }
  if (best < 0) return false;
  // Where to stand: on the bank beside it if there's one, else out in the shallows.
  const x = best % W, y = (best / W) | 0;
  let tx = x + 0.5, ty = y + 0.5;
  for (let k = 0; k < 8; k++) {
    const dx = [1, -1, 0, 0, 1, -1, 1, -1][(k + c.id) % 8], dy = [0, 0, 1, -1, 1, 1, -1, -1][(k + c.id) % 8];
    if (dry(w, x + dx + 0.5, y + dy + 0.5)) { tx += dx * 0.55; ty += dy * 0.55; break; }
  }
  c.mode = 'pool'; c.target = { x: tx, y: ty, i: best };
  const what = w.frogYear.grown < 0.3 ? 'frogspawn' : 'tadpoles';
  if (!c.story[c.story.length - 1].text.endsWith(what)) note(w, c, '🫧', `Pecked at the ${what}`);
  return true;
}

// ---------------------------------------------------------------- fish
//
// Fish, like the frogs too many to follow one by one: w.fish is how many are in each tile of
// water. They live in the water that lasts the year round (below the meadow's own water line, w.terrain.level:
// not the flood pools), the deep water best (fishRoom), breed from spring into summer and spill over next
// door, out onto the floodplain too while it's flooded. There's no room for them out there, and the ones still
// on it as it drains are stranded. Winter thins them a little. They eat tadpoles (tadpolesTick: more are lost
// where there are more fish), and the otters eat them.

const FISH_EVERY = TPD / 10;     // ticks between counts
const FISH_K = 1;               // fish a tile of lasting deep water has room for
const FISH_SHALLOW = 0.2;       // and a tile of lasting shallows, this share of that
const FISH_BREED = 0.5;         // growth a day while there's room, in spring (less as the year goes on, SEASONS growth)
const FISH_FADE = 0.5;          // share of those over a tile's room gone in a day
const FISH_COLD = 0.02;         // share gone each winter day
const FISH_SPREAD = 0.1;        // share that moves next door each count
const FISH_START = 0.8;         // a new meadow's fish, as a share of the room

const fishRoom = (w, i) => (!w.water[i] || w.ground[i] > w.terrain.level ? 0 : w.water[i] === DEEP ? FISH_K : FISH_K * FISH_SHALLOW);

// A new meadow has fish in its lasting water.
function startFish(w) {
  let total = 0;
  for (let i = 0; i < W * H; i++) { w.fish[i] = fishRoom(w, i) * FISH_START; total += w.fish[i]; }
  w.fishCount = total;
}

// Every FISH_EVERY ticks, as frogsTick: each tile spills over one way, into the water next door.
function fishTick(w) {
  const f = w.fish, water = w.water, s = seasonOf(w.tick), dt = FISH_EVERY / TPD;
  const breed = FISH_BREED * SEASONS[s].growth * dt, fade = FISH_FADE * dt;
  const keep = s === 3 ? 1 - FISH_COLD * dt : 0;     // in winter only that, no breeding
  const off = NEXT_DOOR[Math.floor(w.tick / FISH_EVERY) % 4], back = off > 0, by = back ? -1 : 1;
  const ex = off === 1 ? W - 1 : off === -1 ? 0 : -1, ey = off === W ? H - 1 : off === -W ? 0 : -1;
  let total = 0;
  for (let y = back ? H - 1 : 0; y >= 0 && y < H; y += by) {
    for (let x = back ? W - 1 : 0, i = y * W + x; x >= 0 && x < W; x += by, i += by) {
      let n = f[i];
      if (n === 0) continue;
      if (!water[i] || n < 1e-4) { f[i] = 0; continue; }   // stranded where the water went
      if (keep) n *= keep;
      else {
        const room = fishRoom(w, i);
        n += n < room ? breed * n * (1 - n / room) : (room - n) * fade;
      }
      total += n;
      if (x !== ex && y !== ey && water[i + off]) { const m = n * FISH_SPREAD; f[i + off] += m; n -= m; }
      f[i] = n;
    }
  }
  w.fishCount = total;
}

// n fish fewer about the tile x0, y0 (x0, y0 two tiles in from the edge).
function takeFish(w, x0, y0, n) {
  let near = 0;
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) near += w.fish[y * W + x];
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) w.fish[y * W + x] *= Math.max(0, 1 - n / near);
  w.fishCount = Math.max(0, w.fishCount - Math.min(n, near));
}

// ---------------------------------------------------------------- bees
//
// Bees live in colonies (w.hives), each in a hollow oak (h.tree, d.hive) with a queen (h.queen, a name on the
// hive: she stays inside) and a store of honey (h.honey, up to HIVE_FULL): the colony's winter food and, one day,
// the cook's. The queen raises bees while there's honey (hivesTick, raiseBees): in spring and summer up to the
// room in the hollow, in autumn only while there's honey put by for the winter bees. Summer bees wear out in a
// few days and autumn-born ones last the winter, so a colony swells in summer and huddles through the cold as a
// small cluster, eating its honey (BEE_EAT a bee a day, more in a small cluster: clusterCold). A colony out of
// honey starves, and one with no bees left is gone; its hollow keeps the comb and what honey is left.
// While the flowers are out, by day and out of the rain, the bees fly out to them, sip, and carry the nectar
// home a LOAD at a time, which fills the hive. One back from a rich patch dances, so the others know where to
// go. In early summer a crowded colony swarms (swarm): the old queen and half the bees hang in a tree nearby
// for a few hours while scouts look over the hollows about, then move into the best (settle), or fly off over
// the trees when the meadow has all the colonies it holds. A daughter queen stays behind. A hive whose tree
// falls or is struck swarms out too. With no colony left, a wild swarm comes in when the flowers are out
// (swarmArrives). They fly, so water and woods don't stop them. Same ladder as everyone: danger > swarm >
// home > food > wander, one function per rung.

const NECTAR = 0.4 * EAT;       // energy per tick of sipping
const SIP_TICKS = 40;           // how long one flower takes
const REFILL = 150;             // ticks a sipped flower needs to fill with nectar again
const HONEY = 0.005;            // honey a flower's nectar makes, once home: a busy hive with flowers in reach fills in about two seasons
const LOAD = 3;                 // flowers a forager visits before she flies home to unload
const RICH = 3;                 // fresh flowers left around her last one (within 8 tiles) that make a patch worth dancing for
const DANCE_TICKS = 40;         // how long she dances about it at the hive
const PATCH_DAYS = 0.5;         // how long the hive remembers a dance
const PATCH_SPREAD = 4;         // how far apart the bees following a dance scatter over the patch
const LEAVE = 0.05;             // chance each tick that a bee ready to go comes out, so the hive empties bit by bit
const FILL_UP = 0.9;            // how full a bee eats herself in the hive before flying out
const HONEY_BITE = 0.2 * EAT;   // energy a tick a bee eats in the hive, while there's honey (the hive pays BEE_EAT for it)
const POLLEN = 0.002;           // how much a visited flower thickens the grass around it
const HIVE_HONEY = 40;          // what a new hive starts with (a meadow's first: enough for the bees' spring and a little for the cook)
const HIVE_FULL = 100;          // all the honey a hive can hold
const BEE_EAT = 0.2;            // honey each bee eats a winter day
const HOME_EAT = 0.25;          // and the rest of the year this share of that: out among the flowers they live on nectar
const CLUSTER_WARM = 10;        // bees it takes to keep the winter cluster warm
const CLUSTER_COLD = 2;         // a lone bee in winter eats and burns this much more on top (1 + this)
const START_BEES = 14;          // bees a meadow's colonies start with
const HIVE_ROOM = 20;           // bees one hollow has room for; a crowded colony swarms
const QUEEN_LAYS = 10;          // most bees a queen raises a day
const BROOD_HONEY = 0.25;       // honey it takes to raise one
const WINTER_HONEY = 3;         // honey put by for each winter bee before the colony raises another, in autumn
const WINTER_BEES = 10;         // and the most winter bees it raises: the cluster
const MATING_FLIGHT = 0.7;      // days before a new queen, back from her wedding flight, starts to lay
const SWARM_FROM = 0.6, SWARM_TO = 1.5;   // seasons into the year a crowded colony may swarm: late spring and early summer
const SWARM_BEES = 16;          // bees it takes to swarm
const SWARM_HONEY = 30;         // and honey
const SWARM_ODDS = 0.05;        // odds a hive check that a colony ready to swarms does
const SWARM_CARRY = 1;          // honey each leaving bee takes along
const SWARM_HANG = [0.15, 0.3]; // days a swarm hangs in a tree while its scouts look around: a few hours
const SWARM_RANGE = 45;         // how far off a swarm looks for a home
const SCOUTS = 6;               // one bee in this many is a scout
const OLD_COMB = 20;            // how much a swarm likes an empty hive with comb already in it
const HIVES = 2;                // colonies a meadow of the usual size starts with (w.room)
const HIVES_MOST = 3;           // and the most it holds; past that a swarm flies off
const FORAGE_RANGE = 35;        // how far from its hive a bee roams
const FEW_FLOWERS = 40;         // fewer open than this in the whole meadow, and bees stay in
const HIVE_GAP = 20;            // a hive keeps this far from the others
const HIVE_SHORE = 2;           // and this far from water, so the hollow tree isn't drawn over the pond
const HIVE_EDGE = 10;           // and this far from the meadow's edge, out of the mist
const HIVE_TREE = 8;            // a hollow tree is an old giant: the tree a hive moves into grows to this size
const CROWD = 30;               // what each tree within 4 tiles takes off a site: the giant needs room
const IN_FRONT = 60;            // and each tree in front of it (to the south), hiding the hollow
const HIVES_EVERY = 216;        // ticks between counting the flowers and the bees (a hundredth of a day)

// Bees stay in at night, in rain and storms, and while there's hardly a flower open.
const hiveTime = w => isNight(w.tick) || w.weather.kind === 'rain' || w.weather.kind === 'storm'
  || w.flowers < FEW_FLOWERS;

const BLOOM_NEWS = 0.3;          // share of a field's flowers out when the news says it's in bloom

// Every little while: how many flowers are open, how many bees each hive has, the hives eat, the queens
// lay, a crowded colony may swarm, and a hanging swarm settles once its time is up.
function hivesTick(w) {
  w.flowers = 0;
  for (const f of w.fields) f.open = f.all = 0;
  for (const p of w.plants) {
    if (p.field) p.field.all++;
    if (isFlower(w, p)) { w.flowers++; if (p.field) p.field.open++; }
  }
  for (const p of w.blossoms) if (isFlower(w, p)) w.flowers++;
  for (const f of w.fields) {                             // the news, once a year: a field has come out
    if (f.bloomed !== yearOf(w.tick) && f.open > BLOOM_NEWS * f.all) { f.bloomed = yearOf(w.tick); emit(w, { type: 'bloom', field: f }); }
  }
  for (const h of w.hives) { h.bees = 0; h.winterBees = 0; }
  for (const list of [w.creatures, w.newborn]) {
    for (const c of list) if (c.alive && c.species === 'bee') { c.home.bees++; if (seasonOf(c.born) >= 2) c.home.winterBees++; }
  }
  const dt = HIVES_EVERY / TPD;
  for (let k = w.hives.length - 1; k >= 0; k--) {          // (backwards: a swarm gone leaves the list)
    const h = w.hives[k];
    h.honey = Math.max(0, h.honey - BEE_EAT * h.bees * (seasonOf(w.tick) === 3 ? clusterCold(w, h) : HOME_EAT) * dt);
    if (h.queen && !h.bees) {                             // nobody left to feed her (or a swarm that flew off: gone)
      if (!h.leaving) { h.queen.died = w.tick; emit(w, { type: 'queenlost', hive: h, queen: h.queen }); }
      h.queen = null;
      if (h.cluster) { w.hives.splice(k, 1); continue; }
    }
    if (h.cluster) { if (w.tick >= h.settleAt) settle(w, h); continue; }
    if (h.queen) raiseBees(w, h, dt);
    if (h.queen && swarmTime(w, h) && w.rng.next() < SWARM_ODDS) swarm(w, h);
  }
}

// Huddled together a winter cluster keeps warm; a handful of bees can't.
const clusterCold = (w, h) => (seasonOf(w.tick) === 3 ? 1 + CLUSTER_COLD * Math.max(0, 1 - h.bees / CLUSTER_WARM) : 1);

// In spring and summer a colony raises young on whatever honey it has. In autumn only while it has honey put
// by for every winter bee so far (the summer bees won't see the winter): those young are the winter bees.
const broodTime = (w, h) => seasonOf(w.tick) !== 2 || h.winterBees < WINTER_BEES && h.honey > WINTER_HONEY * (h.winterBees + 1);

// The queen lays, up to QUEEN_LAYS a day, never in winter, never before a new queen is back from her wedding
// flight, and never past the room in the hollow.
function raiseBees(w, h, dt) {
  if (!SPECIES.bee.breedSeasons.includes(seasonOf(w.tick)) || !broodTime(w, h) || w.tick < h.queen.laysFrom) return;
  h.brood += QUEEN_LAYS * dt;
  let n = 0;
  for (; h.brood >= 1 && h.honey >= BROOD_HONEY; h.brood--) {
    if (h.bees >= HIVE_ROOM || w.count.bee + w.newborn.length >= SPECIES.bee.cap * w.room) { h.brood = 0; break; }
    h.honey -= BROOD_HONEY;
    const c = makeCreature(w, 'bee', h.x, h.y, null);
    c.home = h; c.queen = h.queen; c.hidden = c.sleeping = true; c.mode = 'sleep'; c.gen = h.queen.gen;
    note(w, c, '🐣', `Hatched in the hive, a daughter of Queen ${h.queen.name}`);
    w.newborn.push(c); w.byId.set(c.id, c);
    h.bees++; h.queen.kids++; n++;
  }
  if (n) emit(w, { type: 'hatch', hive: h, queen: h.queen, n });
}

// A queen: a new one for a swarm come in, or (mum) one raised in the hive, who mates on her wedding flight first.
// (Every field she'll have.)
function newQueen(w, mum = null) {
  return { name: pickName(w, 'bee'), gen: mum ? mum.gen + 1 : 1, since: w.tick, laysFrom: mum ? w.tick + MATING_FLIGHT * TPD : 0,
    kids: 0, mum: mum ? mum.name : '', died: 0 };
}

function makeHive(w, x, y) {
  const id = w.hives.reduce((m, o) => Math.max(m, o.id), 0) + 1;
  // (every field it'll have, the fractions as -0: see blankCreature) cluster: a swarm hanging in a tree (hang),
  // weighing sites till settleAt; swarmed: when it last swarmed
  const h = { id, x: -0, y: -0, tree: null, honey: -0, bees: 0, winterBees: 0, patch: null, queen: null, brood: -0,
    swarmed: -1e9, cluster: false, hang: null, sites: null, settleAt: 0, leaving: false };
  h.x = x; h.y = y; h.honey = HIVE_HONEY;
  w.hives.push(h);
  return h;
}

// Colonies with a queen, settled in a hollow (not hanging as a swarm).
const colonies = w => { let n = 0; for (const h of w.hives) if (h.queen && !h.cluster) n++; return n; };

// Crowded, well fed, late spring or early summer, a laying queen, and not swarmed already this year.
function swarmTime(w, h) {
  const y = (w.tick / TPD % YEAR_DAYS) / SEASON_DAYS;
  return y >= SWARM_FROM && y < SWARM_TO && h.bees >= SWARM_BEES && h.honey >= SWARM_HONEY
    && w.tick >= h.queen.laysFrom && w.tick - h.swarmed > YEAR_DAYS * TPD / 2;
}

// Where a swarm hangs: a branch of the nearest big tree a little way off, not another hive's.
function hangSpot(w, x, y) {
  let tree = null, bd = Infinity;
  for (const d of w.decor) {
    const d2 = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (standing(d) && d.size >= GROWN && !d.hive && d2 > 4 && d2 < 100 && d2 < bd) { tree = d; bd = d2; }
  }
  return tree ? { x: tree.x + 0.6, y: tree.y + 0.3, tree } : { x: clamp(x + 3, 2, W - 2), y, tree: null };
}

// The bees of hive h (or a swarm), flying out to hang in the tree at spot with their queen, weighing the sites
// about till settleAt. (The cooking game's skep hooks in here: a player who reaches a hanging swarm can shake it
// into a skep, and it settles there instead of in a tree.)
function hangOut(w, s, spot, bees, q, why) {
  s.x = spot.x; s.y = spot.y; s.hang = spot.tree; s.queen = q;
  s.cluster = true; s.sites = hiveSites(w, s).slice(0, 3); s.settleAt = w.tick + w.rng.range(...SWARM_HANG) * TPD;
  for (const c of bees) {
    c.home = s; c.hidden = false; c.sleeping = false; c.mode = 'swarm'; c.target = null;
    note(w, c, why[0], why[1]);
  }
  s.bees = bees.length;
}

// A crowded colony splits. The old queen and half the bees fill up on honey and leave, to hang in a tree nearby
// while scouts look over the hollows about. A daughter queen stays with the rest.
function swarm(w, h) {
  const q = h.queen, leaving = [];
  let k = 0;
  for (const c of w.creatures) if (c.alive && c.species === 'bee' && c.home === h && isAdult(w, c) && k++ % 2 === 0) leaving.push(c);
  if (!leaving.length) return;
  const s = makeHive(w, h.x, h.y);
  s.honey = Math.min(h.honey / 2, SWARM_CARRY * leaving.length);
  h.honey -= s.honey;
  h.queen = newQueen(w, q); h.swarmed = w.tick; h.brood = 0; h.bees -= leaving.length;
  hangOut(w, s, hangSpot(w, h.x, h.y), leaving, q, ['🐝', `Left home with the swarm, following Queen ${q.name}`]);
  emit(w, { type: 'swarm', from: h, swarm: s, queen: q, heir: h.queen, n: leaving.length });
}

// A hive's tree came down or was struck: an empty hive goes with it, and the bees fly out as a swarm with what
// honey they can carry, to hang in a tree nearby while their scouts look for a new home.
function hiveMoves(w, h, why) {
  const d = h.tree;
  d.hive = null; h.tree = null; h.patch = null; h.brood = 0;
  d.size = Math.min(d.size, w.terrain.treeSize[1]);        // it grows back an ordinary tree
  if (!h.queen) { w.hives.splice(w.hives.indexOf(h), 1); return; }
  const bees = [];
  for (const list of [w.creatures, w.newborn]) for (const c of list) if (c.alive && c.home === h) bees.push(c);
  h.honey = Math.min(h.honey, SWARM_CARRY * bees.length);
  hangOut(w, h, hangSpot(w, h.x, h.y), bees, h.queen, why === 'fell' ? ['🪵', `Fled when the old hive tree came down, with Queen ${h.queen.name}`]
    : ['⚡', `Fled the hive when lightning struck, with Queen ${h.queen.name}`]);
  emit(w, { type: 'hivemoved', hive: h, why });
}

// The scouts have made up their minds: the swarm moves into the best of the sites they looked at. One may have been
// taken meanwhile; with none of them left they look again, and with nowhere at all they hang on another while. With
// the meadow full of colonies, they fly off over the trees instead.
function settle(w, s) {
  if (colonies(w) >= Math.max(1, Math.round(HIVES_MOST * w.room))) { swarmLeaves(w, s); return; }
  const free = o => (o.hive ? !o.hive.queen && w.hives.includes(o.hive) : siteTree(w, o.tree));
  let site = s.sites.find(free);
  if (!site) { s.sites = hiveSites(w, s).slice(0, 3); site = s.sites[0]; }
  if (!site) { s.settleAt = w.tick + w.rng.range(...SWARM_HANG) * TPD; return; }
  let home = s;
  if (site.hive) {
    home = site.hive;
    home.honey = Math.min(HIVE_FULL, home.honey + s.honey); home.queen = s.queen; home.brood = 0; home.swarmed = w.tick;
    w.hives.splice(w.hives.indexOf(s), 1);
  } else { oldOak(w, site.tree); moveIn(w, s, site.tree); s.swarmed = w.tick; }
  s.cluster = false; s.sites = null; s.hang = null;
  for (const c of w.creatures) {
    if (c.home !== s) continue;
    c.home = home; c.mode = 'wander'; c.target = null;
    note(w, c, '🏡', `Moved into a new home with Queen ${home.queen.name}`);
  }
  home.bees = s.bees;
  emit(w, { type: 'settle', hive: home, queen: home.queen, reused: !!site.hive });
}

// No room in the meadow: the swarm flies off over the trees, out of it (swarmTick sees them off at the edge).
function swarmLeaves(w, s) {
  const a = Math.atan2(s.y - H / 2, s.x - W / 2);
  s.sites = null; s.settleAt = Infinity; s.leaving = true;
  s.x = clamp(W / 2 + Math.cos(a) * W, -2, W + 2); s.y = clamp(H / 2 + Math.sin(a) * H, -2, H + 2);   // (where they're off to)
  for (const c of w.creatures) if (c.home === s && c.alive) { c.mode = 'away'; c.target = null; }
  emit(w, { type: 'swarmleft', swarm: s, queen: s.queen });
}

// With no colony left (the last starved, or never were), a wild swarm comes in when the flowers are out: it hangs
// in a tree near the edge it came in at, and settles like any swarm.
const SWARM_IN = 10;            // bees in it
function swarmArrives(w) {
  const a = w.rng.range(0, Math.PI * 2), at = hangSpot(w, clamp(W / 2 + Math.cos(a) * W * 0.4, 12, W - 12), clamp(H / 2 + Math.sin(a) * H * 0.4, 12, H - 12));
  const s = makeHive(w, at.x, at.y), bees = [];
  for (let k = 0; k < SWARM_IN; k++) {
    const c = makeCreature(w, 'bee', at.x + w.rng.range(-1, 1), at.y + w.rng.range(-1, 1), null);
    c.born = w.tick - SPECIES.bee.matureDays * TPD;
    w.newborn.push(c); w.byId.set(c.id, c); bees.push(c);
  }
  s.honey = SWARM_CARRY * SWARM_IN;
  const q = newQueen(w);
  for (const c of bees) c.queen = q;
  hangOut(w, s, at, bees, q, ['🌍', `Came into the meadow with a wild swarm, following Queen ${q.name}`]);
  emit(w, { type: 'swarmin', swarm: s, queen: q });
}

// Where a swarm could live, best first: an empty hive with its old comb, or a hollow oak, within SWARM_RANGE.
function hiveSites(w, h) {
  const near = o => hypot(o.x - h.x, o.y - h.y) < SWARM_RANGE, sites = [];
  for (const o of w.hives) if (!o.queen && !o.cluster && o.tree && near(o)) sites.push({ x: o.x, y: o.y, hive: o, tree: o.tree, score: siteScore(w, o.tree) + OLD_COMB });
  for (const d of w.decor) if (near(d) && siteTree(w, d)) sites.push({ x: d.x, y: d.y, hive: null, tree: d, score: siteScore(w, d) });
  return sites.sort((a, b) => b.score - a.score);
}

// A hive lives in a tree (h.tree, d.hive), in a hollow low on the trunk. The tree is an old giant.
// The bees in the hive come along.
function moveIn(w, h, d) {
  h.tree = d; d.hive = h; h.x = d.x; h.y = d.y;
  d.size = Math.max(d.size, HIVE_TREE);
  for (const c of w.creatures) if (c.home === h && c.hidden) { c.x = h.x; c.y = h.y; }
}

// How good a tree is for a hive: fields in reach for more than one season, flowers scattered about
// (open most of the year, where a field is open for one season), and room to be seen: not deep in
// the wood, and open ground in front of it. An autumn field counts half: spring and summer ones fill
// the hive.
const SEASON_FIELD = 150;       // what each season with a field in reach is worth to a hive site
function siteScore(w, d) {
  const { x, y } = d;
  let seasons = 0;
  const near = w.fields.filter(f => hypot(f.x - x, f.y - y) < FORAGE_RANGE);
  for (const s of new Set(near.map(f => f.season))) seasons += s === 2 ? 0.5 : 1;
  let flowers = 0;
  forEachPlantNear(w, x, y, FORAGE_RANGE, p => {
    if (!p.field && p.kind < 0.35 && w.fert[p.i] > 0.7 && hypot(p.x - x, p.y - y) < FORAGE_RANGE) flowers++;   // rich soil: they'll bloom
  });
  let crowd = 0, front = 0;
  for (const o of w.decor) {
    if (!standing(o) || o.size < SAPLING || o === d) continue;
    if (hypot(o.x - x, o.y - y) < 4) crowd++;
    if (o.y > y && o.y - y < 5 && Math.abs(o.x - x) < 3) front++;
  }
  return flowers + SEASON_FIELD * seasons - CROWD * crowd - IN_FRONT * front;
}

const inMist = (x, y) => x < HIVE_EDGE || y < HIVE_EDGE || x > W - HIVE_EDGE || y > H - HIVE_EDGE;
// Dry ground all round, far enough out that the hollow tree stands clear of the water.
const hiveGround = (w, x, y) => dry(w, x, y) &&
  [0, 1, 2, 3, 4, 5, 6, 7].every(a => dry(w, x + HIVE_SHORE * Math.cos(a * Math.PI / 4), y + HIVE_SHORE * Math.sin(a * Math.PI / 4)));

// A tree a hive could move into: a big broadleaf standing, with nobody in it, clear of the water and of
// the other hives (placeHive makes it an old oak).
const hiveTree = (w, d) => d.emoji === '🌳' && !d.fruit && d.size >= GROWN && standing(d) && !d.hive && !d.holt && !inMist(d.x, d.y)
  && hiveGround(w, d.x, d.y) && !w.hives.some(o => o.tree && hypot(o.x - d.x, o.y - d.y) < HIVE_GAP);
// An oak old enough to have gone hollow.
const hollow = (w, d) => d.kind === 'oak' && standing(d) && d.size >= 3.5 && treeAge(w, d) >= d.life * 0.5;
// A tree a swarm could move into: a hollow oak, or a big broadleaf that'll do (it becomes one, oldOak).
const siteTree = (w, d) => hiveTree(w, d) && (hollow(w, d) || d.size >= 3);

// The tree a hive moves into becomes an old oak, hollow, with years in it yet (and no blossom).
function oldOak(w, d) {
  if (hollow(w, d)) return;
  const age = TREES.oak.life * w.treeRng.range(0.5, 0.6);
  Object.assign(d, { kind: 'oak', emoji: '🌳', fruit: '', born: w.tick - age * YEAR, life: age + w.treeRng.range(12, 18), max: HIVE_TREE, blooms: false });
  dropBlossoms(w, d);
}

// A meadow's first colonies: each in the best tree for one (siteScore), with flowers in reach and room to be
// seen, which becomes an old oak (oldOak). With no such tree, one standing alone at the dry spot nearest the middle.
function placeHive(w) {
  let best = null, bestScore = -Infinity;
  for (const d of w.decor) {
    if (!hiveTree(w, d)) continue;
    const score = siteScore(w, d);
    if (score > bestScore) { best = d; bestScore = score; }
  }
  if (!best) {
    let at = { x: W / 2, y: H / 2 };
    for (let rad = 0; !(dry(w, at.x, at.y) && !nearestHive(w, at.x, at.y, HIVE_GAP)) && rad < W; rad++) {
      for (let a = 0; a < 16; a++) {
        const x = W / 2 + rad * Math.cos(a * Math.PI / 8), y = H / 2 + rad * Math.sin(a * Math.PI / 8);
        if (hiveGround(w, x, y) && !nearestHive(w, x, y, HIVE_GAP)) { at = { x, y }; break; }
      }
    }
    best = newTree(w, at.x, at.y, 'oak');
    tidyTrees(w);
  }
  oldOak(w, best);
  const h = makeHive(w, best.x, best.y);
  h.queen = newQueen(w);
  moveIn(w, h, best);
  return h;
}

// The nearest hive, within reach if given (else any).
function nearestHive(w, x, y, reach = Infinity) {
  let best = null, bd = reach;
  for (const h of w.hives) { const d = hypot(h.x - x, h.y - y); if (d < bd) { best = h; bd = d; } }
  return best;
}

function beeTick(w, c) {
  // 1. Danger: nothing hunts bees (yet).
  if (beeSwarm(w, c)) return;                                 // 2. hanging in a swarm, or scouting for it
  if (beeHome(w, c)) return;                                  // 3. home: sleep, shelter, eat
  if (beeForage(w, c)) return;                                // 4. food
  beeWander(w, c);                                            // 5. wander
}

// In a swarm: hang together in the tree, living on the honey they brought. The scouts fly out to the sites the
// swarm is weighing and back again. A swarm leaving flies off out of the meadow.
function beeSwarm(w, c) {
  const h = c.home;
  if (!h.cluster) return false;
  if (c.energy < 0.5 * c.maxEnergy && h.honey > 0) c.energy += HONEY_BITE;
  if (c.mode === 'away') {
    if (fly(c, h.x + (c.id % 5 - 2) * 0.4, h.y + (c.id % 3 - 1) * 0.4, c.walk) || !inBounds(c.x, c.y)) die(w, c, 'left');
    return true;
  }
  const scout = c.id % SCOUTS === 0, near = hypot(c.x - h.x, c.y - h.y) < 2;
  if (c.target && !fly(c, c.target.x, c.target.y, c.walk * (near && c.mode === 'swarm' ? 0.3 : 1))) return true;
  if (scout && c.mode === 'swarm' && c.target && h.sites.length) {
    const site = h.sites[((c.id / SCOUTS) | 0) % h.sites.length];
    c.mode = 'scout'; c.target = { x: site.x, y: site.y };
  } else {
    c.mode = 'swarm'; c.target = { x: h.x + w.rng.range(-1.2, 1.2), y: h.y + w.rng.range(-0.8, 0.5) };
  }
  return true;
}

// In the hive: eat when hungry while there's honey, and fill up before heading out; come out when it's time
// (a young house bee stays in till she's grown). Outside: fly home at hive time, or when hungry.
function beeHome(w, c) {
  const e = c.energy / c.maxEnergy, h = c.home;
  if (c.hidden) {
    const hungry = e < FILL_UP && h.honey > 0;
    if (hungry) c.energy = Math.min(c.maxEnergy, c.energy + HONEY_BITE);
    if (hiveTime(w) || hungry || !isAdult(w, c) || w.rng.next() > LEAVE) return true;
    c.hidden = false; c.sleeping = false; c.mode = 'wander'; c.target = null;
    return false;
  }
  if (!hiveTime(w) && e >= 0.3) return false;
  c.mode = 'home';
  if (fly(c, h.x, h.y, c.walk)) { unload(h, c); c.hidden = true; c.sleeping = true; c.mode = 'sleep'; c.target = null; }
  return true;
}

function unload(h, c) {
  h.honey = Math.min(HIVE_FULL, h.honey + c.load * HONEY);
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
    c.load++; c.visits++;
    const rich = freshAround(w, c.target);
    if (rich >= RICH && (!c.find || rich > c.find.rich)) c.find = { x: c.target.x, y: c.target.y, rich, field: c.target.field };
    c.mode = 'wander'; c.target = null;
  }
  if (c.load >= LOAD) {                           // full: home to unload, and tell the others
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
    if (patchFresh(w, h) && hypot(h.x - c.x, h.y - c.y) < 2) {
      const s = PATCH_SPREAD;
      c.mode = 'patch'; c.target = { x: clamp(h.patch.x + w.rng.range(-s, s), 1, W - 1), y: clamp(h.patch.y + w.rng.range(-s, s), 1, H - 1), field: h.patch.field };
    } else if (!pickFlower(w, c)) {               // nothing free in sight: off to a field she knows is in bloom
      const f = w.rng.pick(w.fields.filter(f => f.season === seasonOf(w.tick) && hypot(f.x - h.x, f.y - h.y) < FORAGE_RANGE).concat([null]));
      const b = f && w.rng.pick(f.shape);
      if (b) { c.mode = 'patch'; c.target = { x: clamp(b.x + w.rng.range(-b.r, b.r) * 0.7, 1, W - 1), y: clamp(b.y + w.rng.range(-b.r, b.r) * 0.7, 1, H - 1), field: f }; }
    }
  }
  if (c.mode === 'patch') {                       // off where a dancer said
    if (!fly(c, c.target.x, c.target.y, c.walk)) return true;
    if (!pickFlower(w, c)) {                      // all sipped: that patch is done
      if (h.patch && hypot(h.patch.x - c.x, h.patch.y - c.y) < PATCH_SPREAD) h.patch = null;
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
  const dx = tx - c.x, dy = ty - c.y, d = hypot(dx, dy);
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
  if (p.tree) return p.tree.bramble ? brambleStage(w, p.tree) === 2 : inBloom(w, p.tree);   // blossom in a tree (addBlossoms), or on a bramble
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
// Blossom on a tree sets fruit instead (setFruit).
function pollinate(w, p) {
  if (p.tree) { p.tree.visits++; return; }                // (a tree's, or a bramble's)
  for (let y = (p.y | 0) - 2; y <= (p.y | 0) + 2; y++) {
    for (let x = (p.x | 0) - 2; x <= (p.x | 0) + 2; x++) {
      if (!dry(w, x, y)) continue;
      const i = idx(x, y);
      w.grass[i] = Math.min(w.fert[i], w.grass[i] + POLLEN);
    }
  }
}

function beeMood(w, c) {
  if (c.hidden && c.home.honey <= 0) return { emoji: '🥀', text: 'Hungry in the hive: the honey is gone' };
  if (c.hidden && !isAdult(w, c)) return { emoji: '🐣', text: 'A young house bee, feeding the brood' };
  if (c.hidden) return clusterCold(w, c.home) > 1.5 ? { emoji: '🥶', text: 'Shivering in a small winter cluster' }
    : { emoji: '💤', text: w.flowers < FEW_FLOWERS ? 'Waiting in the hive for the flowers' : 'Asleep in the hive' };
  switch (c.mode) {
    case 'sip': return { emoji: '🌼', text: c.target?.tree?.bramble ? 'Sipping nectar from a bramble flower' : 'Sipping nectar' };
    case 'flower': return { emoji: '🌸', text: c.target?.tree?.bramble ? 'Off to the bramble flowers' : 'Off to a flower' };
    case 'home': return { emoji: '🏠', text: 'Flying home to the hive' };
    case 'unload': return { emoji: '🍯', text: 'Carrying nectar home' };
    case 'dance': return { emoji: '💃', text: 'Dancing to tell the others about a rich patch of flowers' };
    case 'patch': return { emoji: '🧭', text: c.target && c.target.field ? `Off to the ${c.target.field.name}` : 'Off to the flowers a dancer told of' };
    case 'swarm': return { emoji: '', text: 'Hanging in the swarm, waiting for the scouts' };
    case 'scout': return { emoji: '🔎', text: 'Scouting for a new home for the swarm' };
    case 'away': return { emoji: '🪽', text: 'Flying off with the swarm, out of the meadow' };
    case 'wander': return { emoji: '', text: 'Buzzing about' };
  }
  return null;
}

// ---------------------------------------------------------------- remains
//
// A body left out in the open (not in a burrow, not a bee) lies a few days as remains (w.carcasses),
// on ground it makes rich (enrich) as it goes into it. The crows find it, or it rots away. A fox's
// catch leaves what the fox didn't eat. A crow sees remains from high up, and much further off where
// other crows are already at them, so a few gather at once. (Foxes don't eat remains: tried, and it
// fed them through the rabbits' lows and made those deeper.) A dead rabbit lying here is also what the
// player's hunting will pick up, one day.

const CARRION_EVERY = 30;       // ticks between rots
const ROT_DAYS = [4, 2, 4, 8];  // remains rot away in about this long, by season: fast in the heat, slow in the cold
const KILL_LEFT = 0.3;          // what a fox leaves of its catch
const CROW_BITE = 0.4 * EAT;    // what a crow gets of them a tick, and it takes HUNGER times less of them (as a rabbit's BITE)
const SCRAPS = 12;              // remains with less on them than this aren't worth flying to
const GATHER_SIGHT = 45;        // how far off a crow sees others at remains, and comes too
const FOX_NEAR = 150;           // ticks the crows keep off remains a fox was at, or put them up from

function leaveRemains(w, c, killed) {
  enrich(w, c.x, c.y, BODY_RICH, BODY_REACH);             // the ground round it at once: rabbits won't graze a kill site
  if (w.water[idx(c.x, c.y)]) return;                     // (in the water: gone)
  const meat = c.maxEnergy * (0.4 + 0.6 * growth(w, c)) * (killed ? KILL_LEFT : 1);
  // fed, fox: when a crow, a fox was last at them (a fox's catch: it's eating the rest right there); eaten: the crows had the last of them
  w.carcasses.push({ x: c.x, y: c.y, c, meat, full: meat, fed: -1e9, fox: killed ? w.tick : -1e9, eaten: false, seats: null });   // (seats: carrion)
}

// The remains rot away.
function carrionTick(w) {
  if (!w.carcasses.length) return;
  const rot = CARRION_EVERY / (ROT_DAYS[seasonOf(w.tick)] * TPD);
  let gone = false;
  for (const k of w.carcasses) {
    if (k.meat > 0) k.meat -= k.full * rot;
    if (k.meat <= 0) gone = true;
  }
  if (gone) w.carcasses = w.carcasses.filter(k => k.meat > 0);
}

// The nearest remains a crow can see, or (now and then, GATHER_NOTICE) further off where other crows are at
// them. Not where a fox is, nor the last scraps, nor where there's no room (freeSeat).
function remainsNear(w, c) {
  let best = null, bd = Infinity;
  const far = w.rng.next() < GATHER_NOTICE ? GATHER_SIGHT : 0, eyes = c.sight * sky(w).sight;
  for (const k of w.carcasses) {
    if (k.meat < SCRAPS || w.tick - k.fox < FOX_NEAR) continue;
    const d2 = (k.x - c.x) ** 2 + (k.y - c.y) ** 2;
    if (d2 < bd && d2 < Math.max(eyes, w.tick - k.fed < CARRION_EVERY ? far : 0) ** 2 && freeSeat(k) >= 0) { best = k; bd = d2; }
  }
  return best;
}

// A place free at remains k (k.seats: the crows flying to them or eating there, CARRION_SEATS of them), or -1.
// A place is free again once its crow is off doing something else.
function freeSeat(k) {
  for (let i = 0; i < CARRION_SEATS; i++) {
    const o = k.seats?.[i];
    if (!o || !o.alive || o.target !== k || (o.mode !== 'remains' && o.mode !== 'carrion')) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- mushrooms
//
// Mushrooms come up for a few days after rain, mostly in autumn: on the rotting logs (oyster mushrooms) and the
// grey snags (chicken of the woods, a sulphur shelf), on rich ground (field mushrooms: a kill site, a warren's
// latrines, an otters' spraint, where a log rotted away) and round their partner trees (ceps under oaks and pines,
// chanterelles under birches and beeches). They're for the cook to gather, one day. Each clump is a short-lived
// object (w.shrooms, at most SHROOM_MOST times w.room), all of one layout (shroomOf), looked at once an hour, with
// random numbers of their own (w.shroomRng), so the rest of the meadow plays out the same with them. Nothing eats them yet.

const SHROOM_EVERY = TPD / 24;          // ticks between looks (an hour)
const SHROOM_MOST = 40;                 // clumps at once, times w.room
const SHROOM_AFTER = [1, 2.5];          // days after the rain they come up, then fewer, then none
const SHROOM_SEASON = [0.02, 0.05, 0.4, 0]; // the odds they come up, by season (and less as the rain is longer ago)
const SHROOM_WOOD = 0.25;               // the chance an hour a log or a snag puts up a clump, times those odds
const SHROOM_TREES = 12;                // tries an hour at a partner tree, picked at random
const SHROOM_GROUND = 12;               // and at a tile, for rich ground
const SHROOM_RICH = 0.2;                // rich ground this rich grows field mushrooms
const SHROOM_DAYS = [2, 4];             // a clump lasts this long
const SHROOM_GAP = 1;                   // tiles between clumps on the ground
const SHROOM_REACH = [0.8, 2.2];        // a partner tree's come up this far from its trunk
// They come up only where the player can see them: not on ground hidden behind something drawn in front of it (game.js
// draws back to front), which reaches back about this far from its foot (in its size) and this far either side: a tree
// standing or dead, a log, a rock.
const SHROOM_HIDE = { tree: [1.4, 0.8], log: [0.4, 0.6], rock: [0.7, 0.6] };
// The kinds: where each grows (on: 'log', 'snag', 'rich' or a partner tree, trees), and the fewest caps in a clump
// (n: game.js paints three looks of each, with n, n + 1 and n + 2).
const SHROOMS = {
  cep:         { name: 'Ceps', one: 'Cep', on: 'tree', trees: ['oak', 'pine'], n: 1 },
  chanterelle: { name: 'Chanterelles', one: 'Chanterelle', on: 'tree', trees: ['birch', 'beech'], n: 4 },
  field:       { name: 'Field mushrooms', one: 'Field mushroom', on: 'rich', n: 2 },
  oyster:      { name: 'Oyster mushrooms', one: 'Oyster mushroom', on: 'log', n: 2 },
  sulphur:     { name: 'Chicken of the woods', one: 'Chicken of the woods', on: 'snag', n: 2 },
};
const SHROOM_KINDS = Object.keys(SHROOMS);

// Every field a clump ever has, in one order (see blankCreature). kind: a key of SHROOMS; tree: the log, snag or
// partner it's on or under (null on rich ground); born, until: ticks; n: caps in it; look: which of game.js's paintings (n's).
const shroomOf = (kind, x, y, tree, born, until, n, look) => ({ shroom: true, kind, x, y, tree, born, until, n, look });

// Once an hour: those past their days, under water or snow, or on a log that rotted away go. While it rains and for a few
// days after (w.rainAt), new ones may come up: on each log and snag, round partner trees, on rich ground.
function shroomsTick(w) {
  const list = w.shrooms;
  let n = 0;
  for (const m of list) {
    const d = m.tree, lost = d && (d.gone || (m.kind === 'oyster' ? !d.fallen : m.kind === 'sulphur' ? !d.dead || d.fallen : false));
    if (w.tick < m.until && !w.water[idx(m.x, m.y)] && w.snow < 0.3 && !lost) list[n++] = m;
  }
  list.length = n;
  const k = w.weather.kind;
  if (k === 'rain' || k === 'storm') w.rainAt = w.tick;
  const since = (w.tick - w.rainAt) / TPD, [full, none] = SHROOM_AFTER;
  const odds = SHROOM_SEASON[seasonOf(w.tick)] * clamp((none - since) / (none - full), 0, 1);
  if (odds <= 0 || w.snow > 0.2) return;
  const r = w.shroomRng, most = Math.round(SHROOM_MOST * w.room);
  for (const d of w.decor) {
    if (list.length >= most) return;
    if ((d.fallen || d.dead) && !d.gone && !d.stump && r.next() < odds * SHROOM_WOOD) shroomOnWood(w, r, d);
  }
  for (let k = 0; k < SHROOM_TREES && list.length < most; k++) if (r.next() < odds) shroomUnderTree(w, r);
  for (let k = 0; k < SHROOM_GROUND && list.length < most; k++) if (r.next() < odds) shroomOnRich(w, r);
}

// Oyster mushrooms on a log, a sulphur shelf on a broadleaf snag (up its trunk). One clump a tree at a time.
function shroomOnWood(w, r, d) {
  if (d.size < SAPLING || w.shrooms.some(m => m.tree === d)) return;
  if (d.fallen) {
    const x = clamp(d.x + r.range(-0.35, 0.35) * d.size, 0.5, W - 0.5);
    if (inSight(w, x, d.y - 0.1 * d.size, d)) addShroom(w, r, 'oyster', x, d.y + 0.05, d);
  } else if (d.kind !== 'pine' && inSight(w, d.x, d.y - 0.25 * d.size, d)) addShroom(w, r, 'sulphur', d.x, d.y + 0.03, d);
}

// Whether ground at x, y shows, or something in front of it hides it (SHROOM_HIDE). own: the tree it's on, which doesn't.
function inSight(w, x, y, own) {
  let seen = true;
  forEachDecorNear(w, x, y + 6, 8, d => {
    if (!seen || d === own || d.stump || d.tree && d.size < SAPLING) return;
    const [back, side] = SHROOM_HIDE[!d.tree ? 'rock' : d.fallen ? 'log' : 'tree'], dy = d.y - y;
    if (dy > 0 && dy < back * d.size && Math.abs(d.x - x) < side * d.size) seen = false;
  });
  return seen;
}

// A tree picked at random: ceps or chanterelles round it, if it's a grown partner tree. One clump a tree at a time.
function shroomUnderTree(w, r) {
  const d = w.decor[r.int(0, w.decor.length - 1)];
  if (!d || !standing(d) || d.size < GROWN || w.shrooms.some(m => m.tree === d)) return;
  const kind = SHROOM_KINDS.find(k => SHROOMS[k].trees?.includes(d.kind));
  if (!kind) return;
  const a = r.range(-0.3, Math.PI + 0.3), far = r.range(...SHROOM_REACH);   // (in front of the trunk or to a side, not hidden behind it)
  const x = d.x + Math.cos(a) * far, y = d.y + Math.sin(a) * far * 0.7;
  if (dry(w, x, y) && roomForShroom(w, x, y) && inSight(w, x, y, null)) addShroom(w, r, kind, x, y, d);
}

// A tile picked at random: field mushrooms if it's rich enough.
function shroomOnRich(w, r) {
  const x = r.range(1, W - 1), y = r.range(1, H - 1);
  if (w.rich[idx(x, y)] < SHROOM_RICH || !dry(w, x, y) || w.burrows.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < SHROOM_GAP * 2.25)) return;   // (not in a burrow's mouth)
  if (roomForShroom(w, x, y) && inSight(w, x, y, null)) addShroom(w, r, 'field', x, y, null);
}

const roomForShroom = (w, x, y) => !w.shrooms.some(m => !m.tree?.fallen && !m.tree?.dead && (m.x - x) ** 2 + (m.y - y) ** 2 < SHROOM_GAP * SHROOM_GAP);

function addShroom(w, r, kind, x, y, tree) {
  const look = r.int(0, 2), until = w.tick + Math.round(r.range(...SHROOM_DAYS) * TPD);
  w.shrooms.push(shroomOf(kind, x, y, tree, w.tick, until, SHROOMS[kind].n + look, look));
}

// ---------------------------------------------------------------- spring greens
//
// Spring's pickings. Wild garlic carpets the damp woods near the water (wood about, within GARLIC_DAMP tiles of it, above the
// spring flood): its leaves come up as spring starts, it flowers white from the middle of spring and dies back early in
// summer. Nettles stand on rich ground (a warren's latrines, a kill site, an otters' spraint): young tops in spring, tall and
// flowering in summer, brown in autumn. Both are patches that live for years (w.greens): underground the rest of the year,
// they come up in the same spots each spring, a little bigger (g.size), and garlic spreads to damp wood next door. Nettles
// die out a year after the ground stopped being rich (g.fed), garlic once a spring comes with the wood gone or the water came. Looked at
// once a day, with random numbers of their own (w.greenRng), so the meadow plays out the same with them.

const GREENS_EVERY = TPD;               // ticks between looks (a day)
const GARLIC_WOOD = 0.25;               // garlic wants wood about this thick
const GARLIC_DAMP = 6;                  // and the water within this many tiles (w.damp)
const GARLIC_START = 8;                 // patches a meadow starts with, times w.room
const GARLIC_TRIES = 30;                // tiles tried a spring day for a new patch
const GARLIC_ODDS = 0.3;                // and the odds each try goes ahead
const GARLIC_SPREAD = 0.1;              // the odds a spring day a patch seeds one next door
const NETTLE_RICH = 0.3;                // nettles come up on ground this rich (w.rich)
const NETTLE_FED = 0.05;                // and keep while it's at least this rich now and then
const NETTLE_TRIES = 100;               // tiles tried a spring or summer day
const NETTLE_ODDS = 0.5;
const GREENS_MOST = 24;                 // patches of each kind, times w.room
const GREEN_GAP = 2.5;                  // tiles between patches of a kind
// When each kind shows, by season and how far into it (springPart): from, to; game.js draws its stage by the same.
const GREEN_SEASONS = {
  garlic: [[0, 0], [1, 0.2]],           // spring to the first fifth of summer
  nettle: [[0, 0], [2, 0.5]],           // spring to the middle of autumn
};

// Every field a patch ever has, in one order (see blankCreature). born, fed: ticks; size: how many springs it's come up (0 to
// 2: the painting's size); look: which of game.js's paintings.
// pick: how much of it the forager has picked (0 to 1), growing back a little a day (gather, GREEN_REGROW).
const greenOf = (kind, x, y, born, look) => ({ green: true, kind, x, y, born, fed: born, size: 0, look, pick: -0 });

// What a patch shows now: null (underground), or 0, 1, 2: garlic's leaves, flowers, dying back; nettles' young tops,
// tall and flowering, brown.
function greenStage(w, g) {
  const s = seasonOf(w.tick), p = springPart(w.tick), [[s0, p0], [s1, p1]] = GREEN_SEASONS[g.kind];
  if (s < s0 || s > s1 || s === s0 && p < p0 || s === s1 && p >= p1) return null;
  if (g.kind === 'nettle') return s === 0 ? 0 : s === 1 ? 1 : 2;
  return s === 1 ? 2 : p < 0.4 ? 0 : 1;
}

function greensTick(w) {
  const r = w.greenRng, list = w.greens, s = seasonOf(w.tick), first = dayOf(w.tick) % SEASON_DAYS === 0;
  let n = 0;
  for (const g of list) {
    const i = idx(g.x, g.y);
    if (g.kind === 'nettle' && w.rich[i] >= NETTLE_FED) g.fed = w.tick;
    const lost = w.water[i] || (g.kind === 'garlic' ? s === 0 && first && w.wood[i] < GARLIC_WOOD / 2 : w.tick - g.fed > YEAR);   // (garlic: a spring with the wood gone over it, it doesn't come up)
    if (lost) continue;
    if (s === 0 && first && w.tick - g.born > YEAR / 2) g.size = Math.min(2, g.size + 1);   // (each spring it comes up a little bigger)
    if (g.pick > 0) g.pick = Math.max(0, g.pick - GREEN_REGROW);   // (picked: it grows back)
    list[n++] = g;
  }
  list.length = n;
  if (s === 0) {
    for (let k = 0; k < GARLIC_TRIES; k++) if (r.next() < GARLIC_ODDS) garlicAt(w, r, r.range(1, W - 1), r.range(1, H - 1));
    for (const g of list) if (g.kind === 'garlic' && r.next() < GARLIC_SPREAD) { const a = r.range(0, 2 * Math.PI), d = r.range(GREEN_GAP, 4); garlicAt(w, r, g.x + Math.cos(a) * d, g.y + Math.sin(a) * d); }
  }
  if (s <= 1) for (let k = 0; k < NETTLE_TRIES; k++) if (r.next() < NETTLE_ODDS) nettleAt(w, r, r.range(1, W - 1), r.range(1, H - 1));
}

const greensOf = (w, kind) => { let n = 0; for (const g of w.greens) if (g.kind === kind) n++; return n; };
const roomForGreen = (w, kind, x, y) => !w.greens.some(g => g.kind === kind && (g.x - x) ** 2 + (g.y - y) ** 2 < GREEN_GAP * GREEN_GAP);

// Wild garlic at x, y, if it's damp wood above the spring flood, in sight, with room. camp: the forager's camp's, which
// takes a thinner wood (just thick enough to keep it, greensTick) and the water a little further. Whether it came up.
function garlicAt(w, r, x, y, camp) {
  if (!inBounds(x, y) || !dry(w, x, y)) return false;
  const i = idx(x, y), T = w.terrain;
  if (w.wood[i] < (camp ? GARLIC_WOOD / 2 + 0.01 : GARLIC_WOOD) || w.damp[i] > (camp ? GARLIC_DAMP + 1 : GARLIC_DAMP) || w.ground[i] <= T.level + T.springFlood + T.rainRise / 2) return false;
  if (greensOf(w, 'garlic') >= Math.round(GREENS_MOST * w.room) || !roomForGreen(w, 'garlic', x, y) || !inSight(w, x, y, null)) return false;
  w.greens.push(greenOf('garlic', x, y, w.tick, r.int(0, 1)));
  return true;
}

// Nettles at x, y, if the ground is rich, in sight, not in a burrow's mouth, with room.
function nettleAt(w, r, x, y) {
  if (w.rich[idx(x, y)] < NETTLE_RICH || !dry(w, x, y) || w.burrows.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 2.25)) return;
  if (greensOf(w, 'nettle') < Math.round(GREENS_MOST * w.room) && roomForGreen(w, 'nettle', x, y) && inSight(w, x, y, null)) w.greens.push(greenOf('nettle', x, y, w.tick, r.int(0, 1)));
}

// A new meadow's garlic, already there: a few springs old.
function startGreens(w) {
  const r = w.greenRng;
  for (let k = 0; k < 4000 && greensOf(w, 'garlic') < Math.round(GARLIC_START * w.room); k++) garlicAt(w, r, r.range(1, W - 1), r.range(1, H - 1));
  for (const g of w.greens) { g.born -= YEAR * 2; g.size = r.int(0, 1); }
}

// ---------------------------------------------------------------- wild finds
//
// The little things a forager finds about, every season, so there's always something to pick: dandelions out in the
// open and sorrel in the damp grass in spring, wild strawberries along the woods' edges and elderflower by the water in
// summer, hazelnuts at the edges in autumn, rosehips in the scrub from late autumn through the winter, and watercress in
// the shallows at the water's edge through the cold into spring. Each is a short-lived thing (w.finds, one layout,
// findOf): it comes up in a place that suits it (findPlace), in sight, mostly a few tiles from another of its kind, so
// they come in patches with open meadow between; it lasts a few days (FIND_DAYS, never past its season) and is picked or
// wilts. Looked at every two hours, with random numbers of their own (w.findRng), so the rest of the meadow plays out the
// same with them. Nothing eats them: they're for the cook. Tuned so a home view has a few to pick most of the time
// (FINDS most, times w.room).

const FIND_EVERY = TPD / 12;            // ticks between looks (two hours)
const FIND_DAYS = [2, 5];               // one lasts this long, and never past its season
const FIND_GAP = 1.3;                   // tiles between finds
const FIND_PATCH = [1.4, 4.5];          // a new one comes up this far from another of its kind,
const FIND_PATCHY = 0.6;                // this often (else anywhere that suits),
const FIND_CLUMP = 5;                   // till there are this many in the patch
const FIND_FILL = 5;                    // a look brings up one in this many of those missing (so a season fills in a day or so)
const FIND_SNOW = 0.3;                  // snow this deep covers the low ones
// The kinds: when (from, to: seasons into the year, 0 spring to 4, wrapping into the next spring), where (findPlace),
// how many at most (times w.room), and how many a pick gives (n). low: snow covers it. wet: it stands in the shallows.
// The last four are what lies on the ground for a fire (ground: they don't glint, they're not food), there all year:
// days, how long one lies (else FIND_DAYS); more, its most by season (spring to winter). Sticks are the commonest, and
// more come down in rain and storms (STICK_WIND); dry grass is mostly a summer and autumn thing, a little all year (its
// stems stand up out of the snow, so there's always tinder for a first fire).
const FINDS = {
  dandelion:   { name: 'Dandelions',        from: 0,    to: 0.95, place: 'open',     most: 8,  n: 3, low: true },
  sorrel:      { name: 'Sorrel',            from: 0.15, to: 1.35, place: 'damp',     most: 6,  n: 3, low: true },
  strawberry:  { name: 'Wild strawberries', from: 1.1,  to: 1.95, place: 'edge',     most: 8,  n: 4, low: true },
  elderflower: { name: 'Elderflower',       from: 0.8,  to: 1.5,  place: 'elder',    most: 6,  n: 2, low: false },
  hazelnut:    { name: 'Hazelnuts',         from: 2,    to: 2.9,  place: 'edge',     most: 8,  n: 4, low: true },
  rosehip:     { name: 'Rosehips',          from: 2.4,  to: 4,    place: 'scrub',    most: 12, n: 4, low: false },
  watercress:  { name: 'Watercress',        from: 2.9,  to: 4.6,  place: 'shallows', most: 13, n: 3, low: false, wet: true },
  stick:       { name: 'Sticks',            from: 0,    to: 4,    place: 'sticks',   most: 16, n: 2, low: false, ground: true, days: [5, 10] },
  pebble:      { name: 'Pebbles',           from: 0,    to: 4,    place: 'stony',    most: 9,  n: 2, low: false, ground: true, days: [12, 24] },
  drygrass:    { name: 'Dry grass',         from: 0,    to: 4,    place: 'long',     most: 9,  n: 2, low: false, ground: true, days: [3, 6], more: [0.5, 1, 1, 0.5] },
  birchbark:   { name: 'Birch bark',        from: 0,    to: 4,    place: 'birch',    most: 5,  n: 1, low: false, ground: true, days: [5, 10] },
};
const STICK_WIND = { rain: 1.4, storm: 2.2 };   // sticks lie about this many times more in rain and storms, and come down faster
const DRY_GRASS = 0.5;                  // grass this long (w.grass) is long enough to have dry stems in it
const FIND_KINDS = Object.keys(FINDS);
// The most of a kind about now: its share of w.room, by season, more sticks in the wind.
const findsMost = (w, kind) => FINDS[kind].most * w.room * (FINDS[kind].more?.[seasonOf(w.tick)] ?? 1) * (kind === 'stick' ? STICK_WIND[w.weather.kind] ?? 1 : 1);

// Every field a find ever has, in one order (see blankCreature). kind: a key of FINDS; born, until: ticks; n: what a pick
// gives; look: which of game.js's paintings.
const findOf = (kind, x, y, born, until, n, look) => ({ find: true, kind, x, y, born, until, n, look });

// How far into its season a kind is now: 0..1, or -1 out of it. (yearPart: seasons into the year, 0..4)
const yearPart = t => seasonOf(t) + springPart(t);
function findSeason(kind, t) {
  const k = FINDS[kind], at = yearPart(t), u = at >= k.from && at < k.to ? at : at + 4 >= k.from && at + 4 < k.to ? at + 4 : -1;
  return u < 0 ? -1 : (u - k.from) / (k.to - k.from);
}

// Whether a kind suits the ground at x, y: dandelions out in the open grass, sorrel in the damp grass near the water,
// strawberries and hazelnuts along the woods' edges, elder by the water or at a wood's edge, roses in the scrub by the thorn
// bushes or the wood's edge, watercress in the shallows right by the bank. Sticks under the trees and in the woods, pebbles
// on the shore, at the fords and round the rocks, dry grass in long grass out in the open, birch bark under a birch or by a
// fallen one.
function findPlace(w, kind, x, y) {
  if (!inBounds(x, y)) return false;
  const i = idx(x, y), place = FINDS[kind].place;
  if (place === 'stony') return !w.water[i] && stonyAt(w, x, y);
  if (place === 'shallows') {
    if (w.water[i] !== SHALLOW) return false;
    const X = i % W, Y = (i / W) | 0;
    return (X > 0 && !w.water[i - 1]) || (X < W - 1 && !w.water[i + 1]) || (Y > 0 && !w.water[i - W]) || (Y < H - 1 && !w.water[i + W]);
  }
  if (w.water[i]) return false;
  const wood = w.wood[i], damp = w.damp[i];
  if (place === 'open') return wood < 0.08 && damp > 1.5;
  if (place === 'damp') return wood < 0.2 && damp >= 1 && damp <= 5;
  if (place === 'edge') return wood >= 0.08 && wood <= 0.4;
  if (place === 'elder') return damp <= 6 && wood >= 0.05 && wood <= 0.45;
  if (place === 'long') return wood < 0.15 && w.grass[i] >= DRY_GRASS;
  if (place === 'sticks') return wood >= 0.12 || inCrown(w, x, y, '');
  if (place === 'birch') return inCrown(w, x, y, 'birch');
  return wood < 0.3 && damp > 1 && (wood >= 0.06 || thornNear(w, x, y, 3));   // 'scrub'
}

// Whether x, y is under a tree's crown (or by a log), of a kind if kind isn't ''.
function inCrown(w, x, y, kind) {
  let under = false;
  forEachDecorNear(w, x, y, 6, d => {
    if (under || !d.tree || d.stump || d.size < SAPLING || kind && d.kind !== kind) return;
    const reach = 0.4 + d.size * (d.fallen ? 0.5 : 0.35);
    if ((d.x - x) ** 2 + ((d.y - y) * 1.3) ** 2 < reach * reach) under = true;
  });
  return under;
}
// Whether x, y is stony: by the water's edge, near a ford, or round a rock.
function stonyAt(w, x, y) {
  const X = x | 0, Y = y | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(X + dx, Y + dy) && w.water[(Y + dy) * W + X + dx]) return true;
  for (const f of w.fords) if ((f.x - x) ** 2 + (f.y - y) ** 2 < 16) return true;
  let rock = false;
  forEachDecorNear(w, x, y, 6, d => { if (!rock && !d.tree && (d.x - x) ** 2 + (d.y - y) ** 2 < (0.8 + d.size * 0.6) ** 2) rock = true; });
  return rock;
}

// Every two hours: those past their days, under snow (the low ones) or under water (deep water, for watercress) go, and a
// share of what's missing of each kind in season comes up.
function findsTick(w) {
  const list = w.finds;
  let n = 0;
  for (const f of list) {
    const k = FINDS[f.kind], v = w.water[idx(f.x, f.y)];
    if (w.tick < f.until && (k.wet ? v !== DEEP : !v) && !(k.low && w.snow > FIND_SNOW)) list[n++] = f;
  }
  list.length = n;
  const r = w.findRng;
  for (const kind of FIND_KINDS) {
    if (findSeason(kind, w.tick) < 0 || FINDS[kind].low && w.snow > FIND_SNOW) continue;
    const missing = Math.round(findsMost(w, kind)) - findsOf(w, kind), fill = kind === 'stick' && w.weather.kind === 'storm' ? 2 : FIND_FILL;
    for (let k = Math.ceil(missing / fill); k > 0; k--) findSpot(w, r, kind);
  }
}

const findsOf = (w, kind) => { let n = 0; for (const f of w.finds) if (f.kind === kind) n++; return n; };
const roomForFind = (w, x, y) => { for (const f of w.finds) if ((f.x - x) ** 2 + (f.y - y) ** 2 < FIND_GAP * FIND_GAP) return false; return true; };
// One of a kind picked at random, or null with none about.
function oneFind(w, r, kind) {
  const n = findsOf(w, kind);
  if (!n) return null;
  let k = r.int(0, n - 1);
  for (const f of w.finds) if (f.kind === kind && k-- === 0) return f;
  return null;
}

// One of a kind somewhere that suits it: mostly near another of its kind (a patch), else anywhere. A few tiles are tried.
function findSpot(w, r, kind, age = 0) {
  for (let tries = 0; tries < 30; tries++) {
    let near = r.next() < FIND_PATCHY ? oneFind(w, r, kind) : null;
    if (near && clumpAt(w, near) >= FIND_CLUMP) near = null;   // (a patch big enough: one somewhere else)
    let x, y;
    if (near) { const a = r.range(0, 2 * Math.PI), d = r.range(...FIND_PATCH); x = near.x + Math.cos(a) * d; y = near.y + Math.sin(a) * d * 0.8; }
    else { x = r.range(1, W - 1); y = r.range(1, H - 1); }
    if (addFind(w, r, kind, x, y, age)) return true;
  }
  return false;
}
// How many of its kind are in a find's patch (itself too).
function clumpAt(w, f) {
  let n = 0;
  for (const g of w.finds) if (g.kind === f.kind && (g.x - f.x) ** 2 + (g.y - f.y) ** 2 < (FIND_PATCH[1] * 1.5) ** 2) n++;
  return n;
}

// A find at x, y, if it suits it, with room, in sight, not in a burrow's mouth. Lasts FIND_DAYS, never past its season.
// age: ticks it's been up already (a new meadow's).
function addFind(w, r, kind, x, y, age = 0) {
  if (!findPlace(w, kind, x, y) || !roomForFind(w, x, y) || !inSight(w, x, y, null)) return false;
  for (const b of w.burrows) if ((b.x - x) ** 2 + (b.y - y) ** 2 < 2.25) return false;
  const k = FINDS[kind], left = k.to - k.from >= 4 ? Infinity : (1 - findSeason(kind, w.tick)) * (k.to - k.from) * SEASON_DAYS * TPD;
  const until = w.tick + Math.min(left, Math.round(r.range(...(k.days || FIND_DAYS)) * TPD) - age);
  if (until <= w.tick + TPD / 4) return false;
  w.finds.push(findOf(kind, x, y, w.tick - age, Math.round(until), k.n, r.int(0, 1)));
  return true;
}

// A new meadow's finds, already about (of all ages), and a few round the forager's camp: CAMP_FINDS of what's in season
// within CAMP_REACH (a few of a kind together, the kinds in turn, so one that won't grow there leaves room for the others),
// CAMP_GROUND of each thing for a fire (looked for further out till it's found, so a first fire can always be made), and a carpet of wild garlic if there's damp wood near enough for one.
// A meadow kept before the finds gets the same round wherever the forager is when it opens.
const CAMP_REACH = [2.5, 9];
const CAMP_FINDS = 6;
const CAMP_GROUND = { stick: 3, pebble: 3, drygrass: 2, birchbark: 1 };   // (a campfire: recipes.js BUILDS)
function startFinds(w) {
  const r = w.findRng, F = w.forager;
  for (const kind in CAMP_GROUND) for (let k = 0, n = 0; k < 300 && n < CAMP_GROUND[kind]; k++) {
    const a = r.range(0, 2 * Math.PI), d = r.range(1.5, CAMP_REACH[1] + k * 0.08);
    if (addFind(w, r, kind, F.x + Math.cos(a) * d, F.y + Math.sin(a) * d * 0.8, Math.round(r.range(0.3, 1) * TPD))) n++;
  }
  for (const kind of FIND_KINDS) {
    if (findSeason(kind, w.tick) < 0) continue;
    const most = Math.round(findsMost(w, kind) * 0.8);
    for (let k = 0; k < 150 && findsOf(w, kind) < most; k++) findSpot(w, r, kind, Math.round(r.range(0, 1.5) * TPD));
  }
  const kinds = FIND_KINDS.filter(k => !FINDS[k].ground && findSeason(k, w.tick) >= 0);
  let camp = 0;
  for (let k = 0; k < 2000 && camp < CAMP_FINDS && kinds.length; k++) {
    const kind = kinds[(camp >> 1) % kinds.length], a = r.range(0, 2 * Math.PI), d = r.range(...CAMP_REACH);
    if (addFind(w, r, kind, F.x + Math.cos(a) * d, F.y + Math.sin(a) * d * 0.8, Math.round(r.range(0.3, 1) * TPD))) camp++;
    else if (k % 200 === 199) kinds.push(kinds.shift());   // (a kind that won't come up here: on to the next)
  }
  if (!w.greens.some(g => g.kind === 'garlic' && (g.x - F.x) ** 2 + (g.y - F.y) ** 2 < CAMP_REACH[1] ** 2)) {
    for (let k = 0; k < 600; k++) {
      const a = r.range(0, 2 * Math.PI), d = r.range(...CAMP_REACH), x = F.x + Math.cos(a) * d, y = F.y + Math.sin(a) * d * 0.8;
      if (garlicAt(w, r, x, y, true)) { const g = w.greens[w.greens.length - 1]; g.born -= YEAR * 2; break; }
    }
  }
}

// ---------------------------------------------------------------- brambles
//
// Brambles: thorny mounds at the wood's edge that live for years and show all year (w.brambles). Bare red canes in winter,
// new leaves in spring, white flowers early in summer, then berries going green to red to black: ripe blackberries from
// late summer to the middle of autumn (after that, they say, the devil spits on them), and the leaves go red. A patch
// grows each spring (b.size), fruits from its second summer, and its arching canes root at the tip now and then, so a
// thicket creeps out along the edge. Where the rabbits graze, a young one is a mouthful (BRAMBLE_NIBBLE): the warrens
// keep them back, and they creep in after the rabbits crash. The crows eat the berries (crowTick, berries), swallow the
// pips and drop them a few hours later wherever they are then (dropPips, w.pips): where it suits, a bramble comes up
// there next spring. So brambles spring up under the roost and along the crows' patches. One dies once the wood closes
// over it. Looked at once an hour (the berries) and once a day (the rest), with random numbers of their own (w.brambleRng).
// In flower it's a few spots of blossom for the bees (w.blossoms, as a tree's: addBlossoms), and it sets as much of its
// crop as they visited (BRAMBLE_VISITS). A grown patch is a rabbit's refuge from a fox (pickRefuge, thicket: no fox goes
// into the thorns), and in its ripe weeks a fox not after a rabbit goes for the blackberries (foxBerries) and drops the
// pips about like a crow.

const BRAMBLE_EVERY = TPD / 24;         // ticks between looks (an hour)
const BRAMBLE_EDGE = [0.05, 0.4];       // a new meadow's brambles stand where the wood is this thick: its edge
const BRAMBLE_SHADE = 0.6;              // one under wood thicker than this dies back, a spring
const BRAMBLE_START = 10;               // patches a meadow starts with, times w.room
const BRAMBLE_MOST = 30;                // patches at most, times w.room
const BRAMBLE_GAP = 2;                  // tiles between patches
const BRAMBLE_ROOT = 0.04;              // the odds an autumn day a grown patch roots a cane tip next door
const BRAMBLE_GRAZED = 0.35;            // a first-year patch on grass grazed shorter than this is a rabbit's mouthful,
const BRAMBLE_NIBBLE = 0.15;            // at these odds a day
const FLOWER_TO = 0.35;                 // in flower till this far into summer,
const RIPE_FROM = 0.6;                  // ripe from this far into summer
const RIPE_TO = 0.5;                    // to this far into autumn
const BERRY_CROP = 400;                 // the berries on a grown patch in the sun, as a crow's food (a patch a year old has half)
const BERRY_SIGHT = 30;                 // how far off a crow sees a bramble with berries on it
const BERRY_WORTH = 20;                 // and what's worth flying to
const BERRY_TREAT = 0.007;              // the odds a check (every 10 ticks) that a crow that isn't hungry goes for them anyway
const BERRY_TICKS = [400, 900];         // ticks it sits eating them, a trip
const BERRY_BITE = 0.03 * EAT;          // what it eats of them a tick (it gorges: they go even once it's full)
const PIP_GUT = TPD / 12;               // ticks after a crow's first berries that it drops the pips
const PIP_ODDS = 0.1;                   // the odds a crow's pips are any good: the rest are eaten, or rot
const PIPS_MOST = 200;                  // pips waiting for spring
const BERRY_NOTE = 'Ate blackberries off a bramble';
const BRAMBLE_BLOOMS = 3;               // spots of blossom on a patch in flower, for the bees
const BRAMBLE_VISITS = 8;               // bee visits to them for a full crop
const BRAMBLE_SELF = 0.4;               // the crop with no bees: brambles set some on their own
const THICKET_TICKS = [200, 450];       // ticks a rabbit sits tight in the thorns after a fox, at least
const THICKET_FOX = 7;                  // and it stays while a fox is this close,
const THICKET_MOST = 1200;              // but this long at most, or till it's hungry
const FOX_BERRY_SIGHT = 25;             // how far off a fox smells a bramble with ripe berries on it
const FOX_BERRY_FED = 0.9;              // a fox fuller than this doesn't bother
const FOX_BERRY_TICKS = [400, 800];     // ticks it eats them, a trip
const FOX_BITE = 0.1;                   // berries (as BERRY_CROP counts them) it eats a tick,
const FOX_BERRY = 0.3;                  // and the energy each is to a fox: a trip is about a day's keep
const FOX_BERRY_NOTE = 'Ate blackberries off a bramble';

// Every field a patch ever has, in one order (see blankCreature). born: tick; by: how it came ('' a new meadow's,
// 'crow' from pips, 'tip' rooted from the patch next door); size: 0 to 2, how many springs it's grown; look: which of
// game.js's paintings; crop, berries: this year's berries as they ripened, and what's left on it; year: the crop's year.
// visits: the bees' to its flowers this summer; blooms: whether its blossom is out (w.blossoms).
const brambleOf = (x, y, born, by, look) => ({ bramble: true, x, y, born, by, size: 0, look, crop: -0, berries: -0, year: 0, visits: 0, blooms: false });

// What a patch shows now: 0 bare canes, 1 leaves, 2 in flower, 3 berries ripening, 4 ripe, 5 going over. A first-year
// patch (size 0) only has leaves.
function brambleStage(w, b) {
  const s = seasonOf(w.tick), p = springPart(w.tick);
  if (s === 3 || s === 0 && p < 0.15) return 0;
  if (s === 2 && p >= RIPE_TO) return 5;
  if (s === 0 || b.size === 0) return 1;
  if (s === 1 && p < FLOWER_TO) return 2;
  if (s === 1 && p < RIPE_FROM) return 3;
  return 4;
}

function bramblesTick(w) {
  const t = w.tick, r = w.brambleRng, list = w.brambles, year = yearOf(t);
  for (const b of list) {                              // the berries: ripe, and gone over
    if (brambleStage(w, b) === 4) {
      if (b.year !== year) {
        const set = clamp(BRAMBLE_SELF + (1 - BRAMBLE_SELF) * b.visits / BRAMBLE_VISITS, 0, 1);
        b.year = year; b.visits = 0; b.crop = b.berries = BERRY_CROP * set * (b.size === 1 ? 0.5 : 1) * clamp(1.2 - 1.5 * w.wood[idx(b.x, b.y)], 0.4, 1);
      }
    } else if (b.berries > 0) b.berries = 0;
  }
  if ((t % TPD) >= BRAMBLE_EVERY) return;              // once a day, the rest
  const s = seasonOf(t), first = dayOf(t) % SEASON_DAYS === 0;
  let n = 0;
  for (const b of list) {
    const i = idx(b.x, b.y);
    if (w.water[i] || s === 0 && first && w.wood[i] > BRAMBLE_SHADE) { b.berries = 0; dropBlossoms(w, b); continue; }   // (the wood closed over it)
    if (b.size === 0 && s < 3 && w.grass[i] < BRAMBLE_GRAZED && r.next() < BRAMBLE_NIBBLE) continue;   // (the rabbits had it)
    if (s === 0 && first && t - b.born > YEAR / 2) b.size = Math.min(2, b.size + 1);
    const flowering = brambleStage(w, b) === 2;
    if (flowering && !b.blooms) brambleBlossoms(w, b); else if (!flowering && b.blooms) dropBlossoms(w, b);
    list[n++] = b;
  }
  list.length = n;
  if (s === 2) for (let k = list.length - 1; k >= 0; k--) {   // a cane tip roots next door
    const b = list[k];
    if (b.size === 2 && r.next() < BRAMBLE_ROOT) { const a = r.range(0, 2 * Math.PI), d = r.range(BRAMBLE_GAP, 3.5); brambleAt(w, r, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.7, 'tip'); }
  }
  if (s === 0 && w.pips.length) {                      // the crows' pips come up through the first half of spring
    let m = 0;
    for (const p of w.pips) if (p.at > t) w.pips[m++] = p; else brambleAt(w, r, p.x, p.y, 'crow');
    w.pips.length = m;
  }
}

// A patch in flower is a few spots of blossom for the bees along its top (as a tree's crown: addBlossoms). up: how high
// on the mound, as a share of its painting (game.js liftOf).
function brambleBlossoms(w, b) {
  b.blooms = true;
  for (let k = 0; k < BRAMBLE_BLOOMS; k++) {
    const u = (k + 0.5) / BRAMBLE_BLOOMS * 2 - 1, reach = 0.45 + 0.15 * b.size;
    const p = plantOf(clamp(b.x + u * reach, 0.5, W - 0.5), clamp(b.y + 0.03, 0.5, H - 0.5), idx(b.x, b.y), 1, null, 1e6 + w.nextBloom++, b, 0.4 - 0.15 * Math.abs(u));
    w.blossoms.push(p); cellOf(w.blossomCells, p).push(p);
  }
}

// A bramble at x, y, if it's dry ground above the spring flood, not in deep wood, a flower field or a burrow's mouth,
// in sight, with room. by: as brambleOf's.
function brambleAt(w, r, x, y, by) {
  if (!dry(w, x, y)) return false;
  const i = idx(x, y), T = w.terrain;
  if (w.wood[i] > BRAMBLE_SHADE || w.fieldAt[i] >= 0 || w.ground[i] <= T.level + T.springFlood) return false;
  if (w.brambles.length >= Math.round(BRAMBLE_MOST * w.room) || w.brambles.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < BRAMBLE_GAP * BRAMBLE_GAP)) return false;
  if (w.burrows.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 4) || !inSight(w, x, y, null)) return false;
  w.brambles.push(brambleOf(x, y, w.tick, by, r.int(0, 1)));
  return true;
}

// A new meadow's brambles, a few years old, along the woods' edges and by the thorn bushes.
function startBrambles(w) {
  const r = w.brambleRng, most = Math.round(BRAMBLE_START * w.room);
  for (let k = 0; k < 4000 && w.brambles.length < most; k++) {
    const x = r.range(1, W - 1), y = r.range(1, H - 1), wood = inBounds(x, y) ? w.wood[idx(x, y)] : 0;
    if (wood >= BRAMBLE_EDGE[0] && wood <= BRAMBLE_EDGE[1] || thornNear(w, x, y, 2.5)) brambleAt(w, r, x, y, '');
  }
  for (const b of w.brambles) { b.born -= YEAR * 3; b.size = r.int(1, 2); }
}

// Late summer into autumn, a hungry crow flies to the nearest bramble it sees with berries on it, and one that isn't
// goes now and then for a feast all the same (BERRY_TREAT). It eats a while (c.timer) from its own place along the front
// (by its id), swallowing the pips (c.pips), and drops them a few hours later (dropPips).
function berries(w, c, hungry) {
  let b = (c.mode === 'bramble' || c.mode === 'berries') && c.target ? c.target.b : null;
  if (b && (b.berries <= 0 || c.mode === 'berries' && --c.timer <= 0)) { c.mode = 'wander'; c.target = null; return false; }
  if (!b) {
    if ((w.tick + c.id) % 10 || !hungry && w.rng.next() > BERRY_TREAT) return false;
    let best = BERRY_SIGHT * BERRY_SIGHT;
    for (const o of w.brambles) { const d = dist2(o, c); if (o.berries >= BERRY_WORTH && d < best) { b = o; best = d; } }
    if (!b) return false;
    const a = ((c.id * 0.618034) % 1 - 0.5) * 2.4, reach = 0.55 + 0.25 * b.size;
    c.mode = 'bramble'; c.target = { x: clamp(b.x + Math.sin(a) * reach, 0.5, W - 0.5), y: b.y + 0.04 + Math.cos(a) * 0.08, b };   // (into its foot)
  }
  if (c.mode === 'bramble') {
    if (!go(w, c, c.target.x, c.target.y, c.walk)) return true;
    c.mode = 'berries'; c.facing = b.x > c.x ? 1 : -1; c.timer = w.rng.int(...BERRY_TICKS);
    if (c.story[c.story.length - 1].text !== BERRY_NOTE) note(w, c, '🫐', BERRY_NOTE);
  }
  const bite = Math.min(b.berries, BERRY_BITE);
  b.berries -= bite; c.energy = Math.min(c.maxEnergy, c.energy + bite);
  if (!c.pips) c.pips = w.tick;
  return true;
}

// Late summer into autumn, a fox not after a rabbit (or too full for one) goes for the blackberries on the nearest
// bramble it smells, walks to its foot and eats a while, nosing them off the low canes (c.timer). It swallows the pips
// too, and drops them about like a crow (dropPips).
function foxBerries(w, c) {
  let b = (c.mode === 'bramble' || c.mode === 'berries') && c.target ? c.target.b : null;
  if (b && (b.berries <= 0 || c.mode === 'berries' && --c.timer <= 0)) { c.mode = 'rest'; c.timer = 60; c.target = null; return true; }
  if (!b) {
    if (c.mode === 'bramble' || c.mode === 'berries') c.mode = 'wander';   // (lost its way: moveToward)
    if ((w.tick + c.id) % 20) return false;
    let best = FOX_BERRY_SIGHT * FOX_BERRY_SIGHT;
    for (const o of w.brambles) { const d = dist2(o, c); if (o.berries >= BERRY_WORTH && d < best && clearPath(w, c.x, c.y, o.x, o.y)) { b = o; best = d; } }
    if (!b) return false;
    const side = c.x < b.x ? -1 : 1, reach = 0.6 + 0.25 * b.size;
    c.mode = 'bramble'; c.target = { x: clamp(b.x + side * reach, 0.5, W - 0.5), y: b.y + 0.15, b };
  }
  if (c.mode === 'bramble') {
    if (!moveToward(w, c, c.target.x, c.target.y, c.walk)) return true;
    c.mode = 'berries'; c.facing = b.x > c.x ? 1 : -1; c.timer = w.rng.int(...FOX_BERRY_TICKS);
    if (c.story[c.story.length - 1].text !== FOX_BERRY_NOTE) note(w, c, '🫐', FOX_BERRY_NOTE);
  }
  const bite = Math.min(b.berries, FOX_BITE);
  b.berries -= bite; c.energy = Math.min(c.maxEnergy, c.energy + bite * FOX_BERRY);
  if (!c.pips) c.pips = w.tick;
  return true;
}

// The pips a crow (or a fox) swallowed come out wherever it is: a spot for a bramble next spring, if they're any good.
function dropPips(w, c) {
  c.pips = 0;
  const r = w.brambleRng;
  if (w.pips.length < PIPS_MOST && r.next() < PIP_ODDS) w.pips.push({ x: c.x, y: c.y, at: springAfter(w.tick) + r.range(0, 0.5) * SEASON_DAYS * TPD });
}

// ---------------------------------------------------------------- crows
//
// A few crows live in the meadow, flying over all of it (flies: true, like the bees). By day they walk
// about pecking for grubs, best on short grass and on the rich ground round a warren (peck), and fly
// down to remains wherever they see them or see other crows at them (carrion), and when really hungry to the
// windfalls in autumn. A fed crow in autumn carries acorns and beechnuts off from the oaks and beeches and buries
// them out in the open (cacheNut). In winter a hungry one digs its own up again (unbury); the ones nobody
// digs up come up as oaks and beeches in spring. At night they sleep in the roost: a big tree (w.roost) and
// the ones about it, each crow on a branch of its own (c.perch, roostSeat), a few to a tree. In
// spring a pair nests in a tall tree near where they met; the chicks stay in the nest a few days, then
// follow mum about. A fox that comes close sends them flapping up, but one busy on the ground may not
// see it in time. Same ladder as everyone: danger > sleep > love > food > friends > wander.

const CROW_WARY = 4;            // tiles: a fox this close sends a crow up
const CROW_NOTICE = 0.5;        // odds a check (every 4 ticks) that one busy on the ground notices it
const FOX_REACH = 1;            // and one that doesn't, a hungry fox this close catches
const CROW_MEAL = 0.3;          // a crow is mostly feathers: this much of a rabbit's meal (catchPrey). More, and the crows
                                // feed the foxes through the rabbits' lows, and the foxes eat the last rabbits
const FLAP = 8;                 // tiles it flies off
const CAW = 8;                  // and the others on the ground this close go up with it
const CROW_PACE = 0.035;        // tiles a tick, walking about pecking: a few steps, then a stop (peck)
const CROW_HOP = 0.07;          // and hopping, now and then, over a longer way
const CROW_STOP = [15, 60];     // ticks it stops to peck between walks
const CROW_FULL = 0.85;         // a crow eats till its tummy is this full
const CROW_HUNGRY = 0.25;       // and only this hungry takes the rabbits' windfalls (more, and the rabbits go into winter thin)
const GRUB = 0.1 * EAT;         // energy a tick pecking on short grass, at best
const GRUB_SEASON = [1, 1, 0.85, 0.6];  // how many grubs there are, by season (in winter remains carry them too)
const GRUB_SNOW = 0.5;          // and under snow, this share of them
const GRUB_GRASS = 0.35;        // grass shorter than this is good pecking
const GRUB_LONG = 0.6;          // and longer grass this good
const GRUB_RANGE = 12;          // how far off a crow looks for better pecking
const CACHE_FED = 0.45;         // a crow this full buries acorns in autumn rather than eat
const CACHE_MEMORY = 2;         // and remembers where it put its last this many; the rest it forgets
const CACHE_RANGE = 80;         // how far off it flies for acorns to bury
const NUT_LOAD = 5;             // and how many it carries off at a time, in its throat
const BURY_TICKS = 15;          // burying one, or digging it up
const NEST_RANGE = 25;          // how far off a mum looks for a tall tree to nest in
const FLEDGE = 0.4;             // chicks leave the nest this grown
const ROOST_AT = 0.66;          // the time of day they fly to the roost (dusk is 0.72), each a little later by its own clock
const GATHER_AT = 0.55;         // before that they gather on open ground by the roost (gatherSpot), each by its own clock
const WAKE_AT = 0.01;           // and they wake from sunrise, each by its own clock
const OWN_CLOCK = 0.05;         // of a day: how far apart the crows' own clocks are (ownClock)
const GATHER_OUT = 8;           // tiles from the roost the gathering is, towards the middle of the meadow
const GATHER_NEAR = 6;          // a crow this far from it flies back to the others
const CROW_SPACE = 1;           // tiles: a crow pecking about steps away from another this close
const FRIEND_FAR = 6;           // a friendly one with no crow this close flies over to the nearest,
const FRIEND_GAP = [2, 4];      // and lands this far from it
const CARRION_SEATS = 4;        // crows at one lot of remains at once; more wait, pecking about, or go elsewhere
const GATHER_NOTICE = 0.3;      // odds a check that a crow far off notices others at remains
const PATCH = 12;               // tiles round its nest tree: a pair's own patch, where it forages when it isn't hungry
const DRIVE_SIGHT = 6;          // in spring a pair drives off another grown crow this close, on its patch,
const DRIVE_ODDS = 0.5;         // at these odds a check,
const DRIVE_TICKS = 90;         // chasing it this long at most
const ROOST_MIDDLE = 15;        // tiles from the middle of the meadow that take one off a roost tree's size
const ROOST_GROVE = 6;          // tiles round the roost tree: the trees the crows sleep in with it
const ROOST_ROOM = 24;          // seats in a grove past which more don't make it a better roost
const PERCHES = { oak: 1.6, beech: 1.4, maple: 1.2, birch: 1, alder: 1, pine: 1, apple: 1, cherry: 1, hawthorn: 0.7 };   // crows a tree has room for, a tree size
// The seats in a crown, the first ones spread over it: side (-1 left to 1 right) and height (0 the bottom of
// the crown to 1 the top). game.js knows where a crown is in each kind's painting; the sim only puts a crow
// under its seat, SEAT_REACH of the tree's size to the side.
const CROW_SEATS = [[0.1, 0.8], [-0.6, 0.55], [0.65, 0.4], [-0.3, 0.92], [0.45, 0.75], [-0.75, 0.25], [0.8, 0.2], [0, 0.4],
  [-0.5, 0.75], [0.55, 0.6], [0.25, 0.15], [-0.2, 0.12], [0.85, 0.55], [-0.85, 0.5]];
const SEAT_REACH = 0.4;
const WAKE_FLY = [3, 10];       // tiles it flies off from the roost at dawn, to a spot of its own
const PECKING = new Set(['peck', 'carrion', 'munch', 'bury', 'unbury', 'tadpole', 'berries']);   // busy on the ground, heads down

const grubs = (w, x, y) => {
  const i = idx(x, y);
  return w.water[i] ? 0 : GRUB * GRUB_SEASON[seasonOf(w.tick)] * (w.grass[i] < GRUB_GRASS ? 1 : GRUB_LONG) * (w.snow > 0.3 ? GRUB_SNOW : 1) * (1 + w.rich[i]);
};

function crowTick(w, c) {
  const t = w.tick, ph = phaseOf(t), e = c.energy / c.maxEnergy;
  if (c.hidden) {                                    // a chick in the nest
    if (growth(w, c) >= FLEDGE) { c.hidden = c.sleeping = false; c.mode = 'wander'; note(w, c, '🪶', 'Left the nest'); }
    return;
  }
  c.sleeping = false;
  if (c.pips && t - c.pips > PIP_GUT) dropPips(w, c);   // (wherever it is: on a branch at the roost too)

  // 1. Danger: a fright, or a fox close by. Busy on the ground, it may not look up in time.
  if (c.fright > 0) { c.fright = 0; c.threatId = 0; flapUp(w, c, c.frightX, c.frightY); }
  if ((t + c.id) % 4 === 0 && (c.mode === 'rest' || PECKING.has(c.mode))) {   // (in the air or up a tree, out of reach)
    const fox = nearest(w, c, CROW_WARY, 'fox');
    if (fox && (c.mode === 'rest' || w.rng.next() < CROW_NOTICE)) {
      if (c.mode === 'carrion') c.target.fox = w.tick;          // the others keep off a while too
      c.threatId = fox.id; flapUp(w, c, fox.x, fox.y); caw(w, c, fox);
    } else if (fox && dist2(c, fox) < FOX_REACH ** 2 && !fox.sleeping && fox.mode !== 'eat' && fox.energy < 0.75 * fox.maxEnergy && growth(w, fox) > 0.3) {   // (a fox out hunting)
      caw(w, c, fox); catchPrey(w, fox, c);
      return;
    }
  }
  if (c.mode === 'flap') {
    if (!go(w, c, c.target.x, c.target.y, c.sprint)) return;
    c.mode = 'wander'; c.target = null;
  }

  // 2. Sleep: from dusk to dawn, and through a storm, at the roost with the others, on a branch of its own; a
  // mum on her eggs in her nest. Each keeps its own clock (ownClock), and gathers with the others first. A hungry
  // one goes out in a storm by day all the same (mums sitting it out on their eggs starved, a spring's worth at once).
  const own = ownClock(c);
  if (ph > ROOST_AT + own || ph < WAKE_AT + own || w.weather.kind === 'storm' && e > CROW_HUNGRY) {
    if (c.pregnantUntil && c.home && standing(c.home)) {
      c.mode = 'nest';
      if (go(w, c, c.home.x, c.home.y + 0.1, c.walk)) c.sleeping = true;
      return;
    }
    if (c.mode !== 'sleep' || (c.perch && !perchable(c.perch.tree))) {
      if (c.mode !== 'roost' || (c.perch && !perchable(c.perch.tree))) { c.mode = 'roost'; c.perch = roostSeat(w, c); }
      const p = c.perch || c;
      if (!go(w, c, p.x, p.y, c.walk)) return;
      c.mode = 'sleep';
    }
    c.sleeping = true;
    return;
  }
  if (c.mode === 'sleep' || c.mode === 'roost') { c.perch = null; flyOut(w, c); }
  const g = w.roost && gatherSpot(w);                  // the gathering: pecking about by the roost (setting off in time to be there)
  if (g && ph > GATHER_AT + own - Math.sqrt(dist2(c, g)) / (c.walk * TPD) && growth(w, c) >= 0.6 && !c.pregnantUntil
    && c.mode !== 'fetch' && c.mode !== 'cache' && c.mode !== 'bury') {   // (one busy with acorns sees to them first)
    if (c.mode === 'gather' && !go(w, c, c.target.x, c.target.y, c.walk)) return;
    if (c.mode !== 'peck' || (t + c.id) % 10 === 0) {
      if (dist2(c, g) > GATHER_NEAR ** 2) {
        const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(0, GATHER_NEAR / 2), x = g.x + Math.cos(a) * r, y = g.y + Math.sin(a) * r;
        c.mode = 'gather'; c.target = dry(w, x, y) ? { x, y } : g;
        return;
      }
    }
    return peck(w, c, false);
  }

  // Fledglings keep close to mum.
  if (growth(w, c) < 0.6) {
    const mum = w.byId.get(c.mumId);
    if (mum && mum.alive && !mum.hidden && dist2(c, mum) > (c.mode === 'follow' ? 1.5 : 5) ** 2) { c.mode = 'follow'; go(w, c, mum.x, mum.y, c.walk); return; }
  }

  // 3. Love. Expecting, a mum sits in the nest (unless she's hungry): the tallest tree near where she is.
  if (c.pregnantUntil && e > 0.4) {
    if (!c.home || !standing(c.home)) { c.home = nestTree(w, c); const m = mateOf(w, c); if (m) m.home = c.home; }   // (their patch)
    if (c.home) {
      c.mode = 'nest';
      if (go(w, c, c.home.x, c.home.y + 0.1, c.walk)) c.sleeping = true;
      return;
    }
  }
  if (seekLove(w, c)) return;

  // 4. Food. In autumn, not hungry, it buries acorns for the winter (and one carrying some buries them
  // first). Otherwise remains first, then blackberries, then windfalls, then in winter its own buried acorns, then
  // grubs. One eating eats its fill.
  const eating = c.mode === 'carrion' || c.mode === 'munch' || c.mode === 'berries', caching = c.mode === 'cache' || c.mode === 'bury';
  if (!eating && e > (caching ? CACHE_FED / 2 : CACHE_FED) && cacheNut(w, c)) return;
  if (e < (eating ? 0.97 : CROW_FULL)) {
    if (carrion(w, c) || berries(w, c, true) || (w.windfalls && e < CROW_HUNGRY && windfall(w, c)) || unbury(w, c) || tadpoles(w, c)) return;
    return peck(w, c, true);
  }
  if (berries(w, c, false)) return;                    // (a feast, though it isn't hungry)
  if (eating || c.mode === 'remains' || c.mode === 'bramble' || c.mode === 'apple' || c.mode === 'unbury' || c.mode === 'pool' || c.mode === 'tadpole') { c.mode = 'wander'; c.target = null; }

  // 5. Fed: driving another crow off its patch in spring, back to its patch,
  // off to its mate (or with none, another crow) now and then, a rest, or pecking about.
  if (c.mode === 'drive' && drive(w, c)) return;
  if (c.mode === 'rest') { if (--c.timer > 0) return; c.mode = 'wander'; }
  if ((t + c.id) % 30 === 0) {
    const home = patchOf(c), m = mateOf(w, c);
    if (home && seasonOf(t) === 0 && w.rng.next() < DRIVE_ODDS) {
      const o = nearest(w, c, DRIVE_SIGHT, 'crow', o => o !== m && awake(o) && isAdult(w, o) && patchOf(o) !== home && dist2(o, home) < PATCH ** 2);
      if (o) { c.mode = 'drive'; c.targetId = o.id; c.timer = DRIVE_TICKS; return; }
    }
    if (home && dist2(c, home) > PATCH ** 2) {             // back to its patch
      const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(2, PATCH / 2), x = home.x + Math.cos(a) * r, y = home.y + Math.sin(a) * r;
      if (dry(w, x, y)) { c.mode = 'forage'; c.target = { x, y }; return; }
    }
    if (w.rng.next() < FRIENDLY) {   // over to its mate, or with none the nearest crow, if it isn't close by
      const o = m ? dist2(c, m) > FRIEND_FAR ** 2 && awake(m) && m : !nearest(w, c, FRIEND_FAR, 'crow', awake) && nearest(w, c, c.sight, 'crow', awake);
      if (o) {
        const a = Math.atan2(c.y - o.y, c.x - o.x) + w.rng.range(-1, 1), r = w.rng.range(FRIEND_GAP[0], FRIEND_GAP[1]);
        const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
        if (dry(w, x, y)) { c.mode = 'flock'; c.target = { x, y }; }
      }
    } else if (w.rng.next() < 0.3) { c.mode = 'rest'; c.timer = w.rng.int(60, 200); return; }
  }
  if (c.mode === 'flock') {
    if (!go(w, c, c.target.x, c.target.y, c.walk)) return;
    c.mode = 'wander'; c.target = null;
  }
  peck(w, c, false);
}

// A crow's mate, while it lives; and whether a and b may pair (neither has another).
const mateOf = (w, c) => { const m = c.mate && w.byId.get(c.mate); return m && m.alive ? m : null; };
const faithful = (w, a, b) => { const ma = mateOf(w, a), mb = mateOf(w, b); return (!ma || ma === b) && (!mb || mb === a); };
// Its patch: round its nest tree, once it has nested (or its mate has).
const patchOf = c => (c.home && standing(c.home) ? c.home : null);

// Spring: after another crow on its patch till it's close, and puts it up (flapUp). False once it's gone.
function drive(w, c) {
  const o = w.byId.get(c.targetId);
  if (!o || !o.alive || !awake(o) || --c.timer <= 0) { c.mode = 'wander'; return false; }
  if (dist2(c, o) > 1) { go(w, c, o.x, o.y, c.sprint); return true; }
  o.threatId = c.id; flapUp(w, o, c.x, c.y);
  c.mode = 'wander';
  return true;
}

// A crow out and about (for company), not asleep, in the nest, or flapping off.
const awake = o => !o.hidden && !o.sleeping && o.mode !== 'flap' && o.mode !== 'roost';

// Each crow's own clock: a share of OWN_CLOCK it wakes, gathers and goes to roost later than the earliest.
const ownClock = c => ((c.id * 0.618034) % 1) * OWN_CLOCK;

// Where they gather before the roost: open ground GATHER_OUT from it towards the middle of the meadow,
// or round it the other ways if that's water (or the roost itself). Worked out once a roost tree.
const gatherSpots = new WeakMap();
function gatherSpot(w) {
  const r = w.roost;
  let g = gatherSpots.get(r);
  if (g) return g;
  const a0 = Math.atan2(H / 2 - r.y, W / 2 - r.x);
  for (let k = 0; k < 8 && !g; k++) {
    const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 4;
    const x = clamp(r.x + Math.cos(a) * GATHER_OUT, 2, W - 2), y = clamp(r.y + Math.sin(a) * GATHER_OUT, 2, H - 2);
    if (dry(w, x, y)) g = { x, y };
  }
  gatherSpots.set(r, g ||= { x: r.x, y: r.y });
  return g;
}

// Up and away from a fox, or a fright, at x, y.
function flapUp(w, c, x, y) {
  const a = Math.atan2(c.y - y, c.x - x) + w.rng.range(-0.5, 0.5);
  c.mode = 'flap'; c.sleeping = false;
  c.target = { x: clamp(c.x + Math.cos(a) * FLAP, 2, W - 2), y: clamp(c.y + Math.sin(a) * FLAP, 2, H - 2) };
}

// Caw! The crows about on the ground flap up too.
function caw(w, c, fox) {
  forEachNear(w, c.x, c.y, CAW, o => {
    if (o !== c && (o.mode === 'rest' || PECKING.has(o.mode))) { o.threatId = fox.id; flapUp(w, o, fox.x, fox.y); }
  }, 'crow');
}

// Walking about pecking: a few steps, a stop to peck a while (t.stop), and on; over a longer way now and
// then in hops (t.hop). Hungry where the pecking is poor, it flies off to better.
function peck(w, c, hungry) {
  if (c.mode === 'forage' && !go(w, c, c.target.x, c.target.y, c.walk)) return;
  const t = c.mode === 'peck' && c.target;
  if (!t || (go(w, c, t.x, t.y, t.hop ? CROW_HOP : CROW_PACE) && !(--t.stop > 0))) {
    const better = hungry && grubs(w, c.x, c.y) < GRUB / 2 && grubSpot(w, c);
    if (better) { c.mode = 'forage'; c.target = better; return; }
    const o = nearest(w, c, CROW_SPACE, 'crow', awake);   // (another too close: away from it)
    const a = o ? Math.atan2(c.y - o.y, c.x - o.x) + w.rng.range(-0.8, 0.8) : w.rng.range(0, Math.PI * 2);
    const r = w.rng.range(0.3, 1.5), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r, ok = dry(w, x, y);
    c.mode = 'peck'; c.target = { x: ok ? x : c.x, y: ok ? y : c.y, hop: ok && r > 1.1 && w.rng.next() < 0.5, stop: w.rng.int(CROW_STOP[0], CROW_STOP[1]) };
  }
  const g = grubs(w, c.x, c.y);
  c.energy = Math.min(c.maxEnergy, c.energy + g);
}

// The best of a few spots about with more grubs than here, if any.
function grubSpot(w, c) {
  let best = null, most = grubs(w, c.x, c.y) * 1.5 + 1e-3;
  for (let k = 0; k < 6; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(3, GRUB_RANGE), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (!inBounds(x, y)) continue;
    const g = grubs(w, x, y);
    if (g > most) { best = { x, y }; most = g; }
  }
  return best;
}

// Remains it can see, or other crows at: down to a place round them of its own, and peck away.
function carrion(w, c) {
  let k = c.mode === 'remains' || c.mode === 'carrion' ? c.target : null;
  if (!k || k.meat <= 0 || w.tick - k.fox < FOX_NEAR) {          // (one flapping up puts them all up)
    if (k) { c.mode = 'wander'; c.target = null; }
    if ((w.tick + c.id) % 10 || !(k = remainsNear(w, c))) return false;
    (k.seats ??= [])[freeSeat(k)] = c;
    c.mode = 'remains'; c.target = k;
  }
  if (c.mode === 'remains') {
    const a = (k.seats.indexOf(c) + 0.5) * Math.PI / 2;   // (its place round them)
    if (!go(w, c, k.x + 0.7 * Math.cos(a), k.y + 0.35 * Math.sin(a), c.walk)) return true;
    c.mode = 'carrion'; c.facing = k.x > c.x ? 1 : -1;
    if (!c.story[c.story.length - 1].text.startsWith(REMAINS_NOTE)) note(w, c, '🍖', `${REMAINS_NOTE} ${k.c.name}`);
  }
  const bite = Math.min(k.meat * HUNGER, CROW_BITE, c.maxEnergy - c.energy);
  k.meat -= bite / HUNGER; c.energy += bite; k.fed = w.tick;
  if (k.meat <= 0) k.eaten = true;
  return true;
}

const REMAINS_NOTE = 'Found the remains of';   // (once in a row in its story)

// Autumn, and fed: fetch a few acorns or beechnuts from an oak or a beech (d.nuts, from seedFall; c.load),
// carry them off one by one to spots out in the open (seedSpot) and bury them. Seeds for spring, if
// nobody digs them up.
function cacheNut(w, c) {
  if (seasonOf(w.tick) !== 2) return false;
  if (c.mode === 'bury') {
    if (--c.timer > 0) return true;
    const d = c.target.tree;
    const s = { x: c.x, y: c.y, kind: d.kind, tone: childTone(w, d), parent: d.id, by: 'crow', at: springAfter(w.tick) + w.rng.range(0, 0.5) * SEASON_DAYS * TPD };
    w.seeds.push(s);
    if (!c.caches?.length || c.caches[0].at < w.tick) c.caches = [];   // (last year's are long come up)
    if (c.caches.push(s) > CACHE_MEMORY) c.caches.shift();
    w.cached++;
    c.mode = 'wander'; c.target = null;
    if (--c.load > 0) cacheSpot(w, c, d);
    return true;
  }
  if (c.mode === 'cache') {
    if (go(w, c, c.target.x, c.target.y, c.walk)) { c.mode = 'bury'; c.timer = BURY_TICKS; }
    return true;
  }
  if (c.mode === 'fetch') {
    const d = c.target.tree;
    if (!d.nuts || !standing(d)) { c.mode = 'wander'; c.target = null; return false; }
    if (!go(w, c, c.target.x, c.target.y, c.walk)) return true;
    c.load = Math.min(d.nuts, NUT_LOAD); d.nuts -= c.load;
    c.mode = 'wander'; c.target = null;
    cacheSpot(w, c, d);
    return true;
  }
  if ((w.tick + c.id) % 10) return false;
  let best = null, bd = CACHE_RANGE ** 2;
  for (const d of w.orchard) {
    const dd = (d.x - c.x) ** 2 + (d.y - c.y) ** 2;
    if (d.nuts && dd < bd) { best = d; bd = dd; }
  }
  if (!best) return false;
  const a = c.id * 2.4;
  c.mode = 'fetch'; c.target = { x: best.x + 0.9 * Math.cos(a), y: best.y + 0.3 + 0.4 * Math.sin(a), tree: best };
  return true;
}

// Where to bury the next one it carries: a spot out in the open from its tree (none good: it's dropped).
function cacheSpot(w, c, d) {
  const s = seedSpot(w, d, w.rng);
  if (s) { c.mode = 'cache'; c.target = { x: s.x, y: s.y, tree: d }; }
}

// Winter, hungry, nothing better about: dig up one it buried in the autumn.
function unbury(w, c) {
  const s = c.caches && c.caches[c.caches.length - 1];
  if (!s || seasonOf(w.tick) !== 3) return false;
  if (s.at < w.tick) { c.caches = null; return false; }      // last year's
  if (c.mode !== 'unbury') { c.mode = 'unbury'; c.target = s; c.timer = BURY_TICKS; }
  if (!go(w, c, s.x, s.y, c.walk) || --c.timer > 0) return true;
  c.caches.pop();
  const i = w.seeds.indexOf(s);
  if (i >= 0) { w.seeds.splice(i, 1); c.energy = Math.min(c.maxEnergy, c.energy + NUT_ENERGY); }
  c.mode = 'wander'; c.target = null;
  return true;
}

// The tallest grown tree about for a nest: not the bees' tree, nor the roost.
function nestTree(w, c) {
  let best = null;
  forEachDecorNear(w, c.x, c.y, NEST_RANGE, d => {
    if (standing(d) && d.size >= GROWN && !d.hive && d !== w.roost && (!best || d.size > best.size)) best = d;
  });
  return best;
}

// Awake: off the roost to a spot of its own a way off, not all down under the one tree.
function flyOut(w, c) {
  const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(WAKE_FLY[0], WAKE_FLY[1]);
  const x = clamp(c.x + Math.cos(a) * r, 2, W - 2), y = clamp(c.y + Math.sin(a) * r, 2, H - 2);
  if (dry(w, x, y)) { c.mode = 'forage'; c.target = { x, y }; } else { c.mode = 'wander'; c.target = null; }
}

// A tree crows sleep in, and how many it has room for.
const perchable = d => standing(d) && d.size >= GROWN && !d.hive;
const perches = d => Math.min(CROW_SEATS.length, Math.max(2, Math.floor(d.size * (PERCHES[d.kind] ?? 1))));
const seatAt = (d, k) => ({ x: d.x + CROW_SEATS[k][0] * (d.id % 2 ? -1 : 1) * d.size * SEAT_REACH, y: d.y + 0.15 + 0.02 * k, tree: d, k });

// A free seat at the roost: in the roost tree while it has room, then in the nearest of the trees about it
// (further out if the grove is full). None free anywhere: it squeezes in at the roost tree.
function roostSeat(w, c) {
  const r = w.roost;
  if (!r) return null;
  const taken = new Map();                               // tree: its seats taken, a bit each
  for (const o of w.creatures) {
    if (o !== c && o.alive && o.species === 'crow' && o.perch && (o.mode === 'roost' || o.mode === 'sleep')) taken.set(o.perch.tree, (taken.get(o.perch.tree) || 0) | 1 << o.perch.k);
  }
  const free = d => { const t = taken.get(d) || 0; for (let k = 0; k < perches(d); k++) if (!(t & 1 << k)) return k; return -1; };
  const m = mateOf(w, c), mt = m && m.perch && (m.mode === 'roost' || m.mode === 'sleep') && m.perch.tree;   // by its mate, if there's room
  if (mt && perchable(mt) && free(mt) >= 0) return seatAt(mt, free(mt));
  for (const reach of [ROOST_GROVE, 2 * ROOST_GROVE]) {
    let best = null, bd = Infinity, bk = -1;
    forEachDecorNear(w, r.x, r.y, reach, d => {
      const dd = d === r ? -1 : dist2(d, r);
      if (dd > reach * reach || !perchable(d)) return;
      const k = dd < bd ? free(d) : -1;
      if (k >= 0) { best = d; bd = dd; bk = k; }
    });
    if (best) return seatAt(best, bk);
  }
  return seatAt(r, (taken.size + c.id) % CROW_SEATS.length);
}

// The crows' roost: a big tree in a grove with room for them all, towards the middle of the meadow, not the
// bees'. Another when it falls (newDay).
function pickRoost(w) {
  let best = null, most = -Infinity;
  for (const d of w.decor) {
    if (!perchable(d)) continue;
    let room = 0;
    forEachDecorNear(w, d.x, d.y, ROOST_GROVE, o => { if (dist2(o, d) < ROOST_GROVE ** 2 && perchable(o)) room += perches(o); });
    const v = Math.min(room, ROOST_ROOM) + d.size - hypot(d.x - W / 2, d.y - H / 2) / ROOST_MIDDLE;
    if (v > most) { best = d; most = v; }
  }
  return best;
}

function crowMood(w, c) {
  const dead = (c.mode === 'remains' || c.mode === 'carrion') && c.target.c;
  const kind = c.target && (c.target.tree ? c.target.tree.kind : c.target.kind), one = kind === 'beech' ? 'a beechnut' : 'an acorn';
  switch (c.mode) {
    case 'nest': return { emoji: '🪺', text: c.hidden ? 'A chick in the nest, calling for food' : c.sleeping ? 'Sitting on her eggs in the nest' : 'Flying to her nest' };
    case 'sleep': return { emoji: '💤', text: c.perch ? 'Asleep at the roost with the other crows' : 'Asleep' };
    case 'roost': return { emoji: '🏠', text: 'Flying to the roost for the night' };
    case 'flap': return { emoji: '😱', text: c.threatId ? `Flapped up, away from ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` : 'Flapped up, away from the smoke!' };
    case 'remains': return { emoji: '👀', text: `Flying down to the remains of ${dead.name}` };
    case 'carrion': return { emoji: '🍖', text: `Pecking at the remains of ${dead.name}` };
    case 'peck': return { emoji: '🪱', text: 'Pecking for grubs' };
    case 'bramble': return { emoji: '🫐', text: 'Off to the blackberries on a bramble' };
    case 'berries': return { emoji: '🫐', text: 'Eating blackberries off a bramble' };
    case 'forage': return { emoji: '🪱', text: 'Off to better pecking' };
    case 'fetch': return { emoji: '🌰', text: `Off to the ${kind === 'beech' ? 'beeches for beechnuts' : 'oaks for acorns'} to bury` };
    case 'cache': return { emoji: '🌰', text: `Carrying ${one} off to bury` };
    case 'bury': return { emoji: '🌰', text: `Burying ${one} for the winter` };
    case 'unbury': return { emoji: '🌰', text: `Digging up ${one} it buried in the autumn` };
    case 'pool': return { emoji: '🫧', text: `Off to the ${w.frogYear.grown < 0.3 ? 'frogspawn' : 'tadpoles'} in the shallows` };
    case 'tadpole': return { emoji: '🫧', text: w.frogYear.grown < 0.3 ? 'Pecking at the frogspawn at the water\'s edge' : 'Picking tadpoles out of the shallows' };
    case 'flock': { const m = mateOf(w, c); return { emoji: '', text: m && hypot(c.target.x - m.x, c.target.y - m.y) < 5 ? `Flying over to its mate ${m.name}` : 'Flying over to another crow' }; }   // no bubble: 🤝 is painted as paws
    case 'drive': return { emoji: '‼️', text: `Chasing ${w.byId.get(c.targetId)?.name ?? 'another crow'} off its patch` };
    case 'gather': return { emoji: '', text: 'Off to the others, gathering by the roost for the night' };
    case 'follow': return { emoji: '🍼', text: 'Following mum, begging for food' };
    case 'rest': return { emoji: '😌', text: 'Preening' };
  }
  return null;
}

// ---------------------------------------------------------------- otters
//
// Otters: a pair or two along the water. A female makes her holt in the roots of a big tree on the bank of
// water that lasts (holtTree, HOLT_GAP from the other holts) and marks it (d.holt, her id; d.door, the way in;
// holtsDay frees it once she's gone). A male moves in with his
// mate (mate). They're out from the evening to the middle of the morning, and sleep through the middle of the
// day curled up at the holt (or on any bank, with none). They fish (w.fish): swim to where the fish are
// thickest, dive, and come up with one as often as they're thick there, and eat it afloat. While the frogs
// spawn they go after them along the shallows first, and in winter they dig them out of the mud by the water
// (w.frogs); under the ice they still fish where it meets the bank (atEdge). A fox near one on the bank
// sends it into the water. Fed, they play: up the bank, and sliding down it into the water. In spring a
// female with a holt has two or three cubs, who stay in the holt a while, follow mum about till they're
// grown, and at a year (otterGrown) a young female finds a holt of her own and a young male goes off along
// the water to find a mate, while the meadow has room for more; otherwise off down the water, out of the
// meadow. A pair comes up the water when there are none (migrate). Same ladder as everyone: danger > sleep >
// love > food > friends > wander.

const OTTER_WAKE = 0.6;         // the time of day an otter wakes (dusk is 0.72)
const OTTER_BED = 0.3;          // and goes to sleep, in the middle of the morning (sunrise is 0)
const OTTER_HUNGRY = 0.3;       // this hungry, it fishes through its sleep
const OTTER_FULL = 0.85;        // it fishes till its tummy is this full
const OTTER_WARY = 5;           // tiles: a fox this close to one on the bank sends it into the water
const WARY_FAR = 8;             // and it watches the fox from the water till it's this far off,
const WATCH_TICKS = 120;        // or it's seen enough of it,
const CALM_TICKS = 200;         // and then pays foxes no mind for a while
const OTTER_RANGE = 30;         // how far from its holt it fishes (a mum with cubs in the holt, HOLT_REACH)
const HOLT_HOME = 10;           // further from its holt than this at bedtime, it lies up on a bank where it is (not a mum with cubs in it)
const HOME_PACE = 1.6;          // off to bed at a brisk lope
const OTTER_SHORE = 2;          // tiles from the water it wanders, at most
const HOLT_BANK = 3;            // a holt's tree stands this close to water that lasts
const HOLT_GAP = 30;            // tiles between two holts: each has a stretch of water of its own
const HOLT_FISH = 40;           // and room for this many fish (fishRoom) within HOLT_REACH of it, to feed a family
const HOLT_REACH = 15;
const FISH_LOOK = 12;           // how far off it looks for the water with the most fish
const FISH_WORTH = 0.1;         // fish on a tile worth diving for
const DIVE_TICKS = [25, 50];    // under, looking
const DIVES = 3;                // dives in one place, coming up with nothing, before it moves on
const FISH_CATCH = 0.7;         // odds it comes up with one where they're thickest, about
const FISH_HALF = 0.3;          // fish on a tile where it comes up with one half as often as it could
const FISH_ENERGY = 30;         // a fish to an otter
const TAKES = 1 / HUNGER;       // of a fish (or a frog) in the water's stock one catch takes (see HUNGER)
const FISH_EAT = 60;            // ticks eating one, afloat
const CUB_SHARE = 15;           // what each cub close by gets of every fish mum catches, till it's grown
const FROG_FEAST = 2;           // days after the frogs spawn that the otters go after them first
const FROG_LOOK = 8;            // how far off it looks for the frogs
const ROOT_WORTH = 0.02;        // frogs on a tile worth rooting about for
const ROOT_TICKS = [30, 60];    // rooting along the shallows, or digging in the mud
const ROOT_CATCH = 0.6;         // odds it comes up with one where they're thickest, about
const ROOT_HALF = 0.05;         // frogs on a tile where it does half as often as it could
const OTTER_FROG = 12;          // a frog to an otter
const FROG_MUNCH = 30;          // ticks eating one
const CUB_OUT = 0.25;           // cubs come out of the holt this grown
const PLAY_ODDS = 0.3;          // odds a check (every 30 ticks) that a well fed otter plays, and the others about with it
const PLAY_FED = 0.92;          // well fed: room for a few slides before it's hungry again (OTTER_FULL)
const PLAY_RUNS = [2, 5];       // and how many times it slides down
const PLAY_PACE = 1.4;          // bounding up the bank again
const SLIDE_LOOK = 5;           // how far off it looks for the top of a slide: the highest bank about,
const SLIDE_BANK = [1.5, 4];    // this far from the water, out from under the trees (w.wood, so you see it),
const SLIDE_SHADE = 0.3;
const SLIDE_RUN = 0.8;          // and it slides on this far into the water,
const SLIDE_ICE = 2.5;          // or out over the ice
const SLIDE_GAP = 12;           // ticks between two setting off down the same slide: they take turns
const SPRAINT_RICH = 0.1;       // what the spraint by a holt feeds the bank, a day
const SPRAINT_REACH = 1.5;
const FISH_NOTE = 'Caught a fish', MUD_NOTE = 'Dug a frog out of the mud', SPAWN_NOTE = 'Caught a frog at the spawning';
const FEEDING = new Set(['dive', 'eat', 'root', 'munch']);   // busy with a catch: it finishes before anything but danger

const holds = d => !d.tree || standing(d);   // a holt in a tree's roots goes with the tree; one under a rock lasts
const holtOf = c => (c.home && c.home.holt && holds(c.home) ? c.home : null);
const otterReady = c => c.sex === 'M' || (c.home && c.home.holt === c.id && holds(c.home));
const swimming = (w, c) => !w.frozen && w.water[idx(c.x, c.y)] > 0;
// A mum with cubs still in the holt (each of them marks her every tick, c.cubsIn).
const nursing = (w, c) => c.cubsIn >= w.tick - 1;
// A cub stays up while mum's up, and then sleeps by her (bedOf).
const mumUp = (w, c) => { const m = growth(w, c) < 1 && w.byId.get(c.mumId); return !!(m && m.alive && !m.hidden && m.mode !== 'bed' && m.mode !== 'sleep'); };
// Still living at mum's holt, a cub or grown.
const atMums = (w, c) => { const m = c.mumId && w.byId.get(c.mumId); return !!(m && c.home && c.home === m.home); };

function otterTick(w, c) {
  const t = w.tick, ph = phaseOf(t), e = c.energy / c.maxEnergy;
  if (c.hidden) {                                    // a cub in the holt
    const mum = w.byId.get(c.mumId);
    if (mum) mum.cubsIn = t;
    if (growth(w, c) >= CUB_OUT) {
      c.hidden = c.sleeping = false; c.mode = 'wander';
      note(w, c, '🌿', 'Came out of the holt');
      emit(w, { type: 'cubsout', c, mum });
    }
    return;
  }
  c.sleeping = false;

  // 1. Danger: a fox up and about close by on the bank, or a fright: into the water, and it watches the fox from there
  // till it's gone off or lain down (then pays foxes no mind a while). Asleep, in the holt or a bed in the reeds, it doesn't mind one.
  // And one on its way out of the meadow goes on.
  if (c.fright > 0) { c.fright = 0; if (c.mode !== 'leave') slip(w, c, c.frightX, c.frightY, null); }
  if ((t + c.id) % 4 === 0 && c.mode !== 'slip' && c.mode !== 'leave' && c.mode !== 'sleep' && !(c.calm > t) && !swimming(w, c)) {
    const fox = nearest(w, c, OTTER_WARY, 'fox', awake);   // (a fox asleep is no bother)
    if (fox) slip(w, c, fox.x, fox.y, fox);
  }
  if (c.mode === 'slip' || c.mode === 'leave') {
    if (c.target && !moveToward(w, c, c.target.x, c.target.y, c.mode === 'slip' ? c.sprint : c.walk)) return;
    if (c.mode === 'leave') { die(w, c, 'left'); return; }
    c.target = null;
    if (c.threatId && swimming(w, c)) { c.mode = 'watch'; c.timer = WATCH_TICKS; return; }
    c.mode = 'wander';
  }
  if (c.mode === 'watch') {                          // treading water, eyes on the fox
    const fox = w.byId.get(c.threatId);
    if (fox && fox.alive && !fox.sleeping && --c.timer > 0 && dist2(c, fox) < WARY_FAR ** 2) { c.facing = fox.x > c.x ? 1 : -1; return; }
    c.mode = 'wander'; c.calm = t + CALM_TICKS;
  }

  // 2. Sleep: through the middle of the day, unless hungry, curled up at the holt, or on a bank if that's far. A
  // catch is eaten first, and a cub waits for mum.
  if (ph >= OTTER_BED && ph < OTTER_WAKE && e > OTTER_HUNGRY && !FEEDING.has(c.mode) && !mumUp(w, c)) {
    if (c.mode !== 'sleep') {
      if (c.mode !== 'bed' || !c.target || growth(w, c) < 1) { c.mode = 'bed'; c.target = bedOf(w, c); }   // (a cub keeps after mum)
      if (!moveToward(w, c, c.target.x, c.target.y, c.walk * HOME_PACE)) return;
      c.mode = 'sleep'; c.target = null;
    }
    c.sleeping = true;
    return;
  }
  if (c.mode === 'sleep' || c.mode === 'bed') { c.mode = 'wander'; c.target = null; }

  // Cubs keep near mum till they're grown; at a year they find a place of their own. A female finds a holt.
  if (growth(w, c) < 1 && !FEEDING.has(c.mode)) {
    const mum = w.byId.get(c.mumId);
    if (mum && mum.alive && dist2(c, mum) > (c.mode === 'follow' ? 1.5 : 4) ** 2) { c.mode = 'follow'; moveToward(w, c, mum.x, mum.y, c.walk * 1.2); return; }
  }
  const home = atMums(w, c);
  if (home && ageDays(w, c) >= YEAR_DAYS) { otterGrown(w, c); if (c.mode === 'leave') return; }
  else if (!home && c.sex === 'F' && isAdult(w, c) && !otterReady(c) && (t + c.id) % 120 === 0) {
    const d = holtTree(w);
    if (d) moveInHolt(w, c, d);
  }

  // 3. Love.
  if (seekLove(w, c)) return;

  // 4. Food.
  if ((e < OTTER_FULL || FEEDING.has(c.mode)) && otterFood(w, c)) return;

  // 5. Well fed: play, the others about joining in on the same slide.
  if (c.mode === 'play' || c.mode === 'slide') { if (play(w, c)) return; }
  else if (e >= PLAY_FED && (t + c.id) % 30 === 0 && w.rng.next() < PLAY_ODDS) {
    const s = startPlay(w, c, slideNear(w, c));
    if (s) forEachNear(w, c.x, c.y, 6, o => { if (o !== c && !o.sleeping && o.mode === 'wander' && o.energy >= PLAY_FED * o.maxEnergy) startPlay(w, o, s); }, 'otter');
    if (c.mode === 'play') return;
  }

  // 6. Along the water.
  wander(w, c, 0.6);
}

// Food: the fish, or the frogs while they spawn or the ice is on (and when there are no fish to be had). It swims
// to the water with the most fish about, close by or else anywhere in its range (round its holt: one that has
// strayed out of it looks there first; a mum with cubs in the holt keeps close to it), dives, and comes up with
// one or not; or roots along the water's edge where the frogs are, or digs in the mud there for them in winter.
// Coming up with nothing a few times, it moves on.
function otterFood(w, c) {
  switch (c.mode) {
    case 'eat': case 'munch':
      if (--c.timer <= 0) { c.mode = 'wander'; c.target = null; }
      return true;
    case 'dive': case 'root':
      if (--c.timer > 0) return true;
      return c.mode === 'dive' ? surface(w, c) : rooted(w, c);
    case 'fish': case 'frog':
      if (!c.target) break;
      if (moveToward(w, c, c.target.x, c.target.y, c.walk)) {
        if (c.mode === 'fish' && !w.water[idx(c.x, c.y)]) break;   // the water's gone from there
        c.mode = c.mode === 'fish' ? 'dive' : 'root'; c.timer = w.rng.int(...(c.mode === 'dive' ? DIVE_TICKS : ROOT_TICKS));
      }
      return true;
  }
  c.mode = 'wander'; c.target = null;
  if ((w.tick + c.id) % 10) return false;            // (looking about)
  const range = nursing(w, c) ? HOLT_REACH : OTTER_RANGE;
  const yr = w.frogYear, h = holtOf(c) || c, at = dist2(c, h) > range ** 2 ? h : c;
  const frogsFirst = w.frozen || seasonOf(w.tick) === 0 && yr.at >= 0 && w.tick - yr.at < FROG_FEAST * TPD;
  const edge = w.frozen ? atEdge : null;            // (under the ice, only where it meets the bank)
  const fish = () => mostNear(w, w.fish, at.x, at.y, FISH_LOOK, 8, FISH_WORTH, Infinity, edge) || mostNear(w, w.fish, h.x, h.y, range, 12, FISH_WORTH, Infinity, edge);
  const frogs = () => mostNear(w, w.frogs, at.x, at.y, FROG_LOOK, 8, ROOT_WORTH, OTTER_SHORE) || mostNear(w, w.frogs, h.x, h.y, range, 12, ROOT_WORTH, OTTER_SHORE);
  let spot = frogsFirst ? frogs() : fish();
  if (spot) c.mode = frogsFirst ? 'frog' : 'fish';
  else if ((spot = frogsFirst ? fish() : frogs())) c.mode = frogsFirst ? 'fish' : 'frog';
  if (!spot) return false;
  spot.tries = 0; c.target = spot;
  return true;
}

// Up from a dive, with a fish as often as they're thick there; then it eats it afloat, and mum's young cubs have
// some. With nothing, it dives again close by, a few times.
function surface(w, c) {
  const x0 = clamp(c.x | 0, 2, W - 3), y0 = clamp(c.y | 0, 2, H - 3), n = w.fish[y0 * W + x0];
  if (w.rng.next() < FISH_CATCH * n / (n + FISH_HALF)) {
    takeFish(w, x0, y0, TAKES);
    c.energy = Math.min(c.maxEnergy, c.energy + FISH_ENERGY);
    c.fish++;
    c.mode = 'eat'; c.timer = FISH_EAT; c.target = null;
    forEachNear(w, c.x, c.y, 6, o => { if (o.mumId === c.id && growth(w, o) < 1) o.energy = Math.min(o.maxEnergy, o.energy + CUB_SHARE); }, 'otter');
    if (c.story[c.story.length - 1].text !== FISH_NOTE) note(w, c, '🐟', FISH_NOTE);
    return true;
  }
  return tryAgain(w, c, 'fish');
}

// Up from rooting about, with a frog as often as they're thick there.
function rooted(w, c) {
  const x0 = clamp(c.x | 0, 2, W - 3), y0 = clamp(c.y | 0, 2, H - 3), n = w.frogs[y0 * W + x0];
  if (w.rng.next() < ROOT_CATCH * n / (n + ROOT_HALF)) {
    takeFrog(w, x0, y0, TAKES);
    c.energy = Math.min(c.maxEnergy, c.energy + OTTER_FROG);
    c.frogs++;
    c.mode = 'munch'; c.timer = FROG_MUNCH; c.target = null;
    const what = seasonOf(w.tick) === 3 ? MUD_NOTE : SPAWN_NOTE;
    if (c.story[c.story.length - 1].text !== what) note(w, c, '🐸', what);
    return true;
  }
  return tryAgain(w, c, 'frog');
}

// Nothing: again a little way off (for the frogs, still by the water), or after a few tries, off to look somewhere else.
function tryAgain(w, c, mode) {
  const tries = c.target ? c.target.tries + 1 : DIVES;
  const a = w.rng.range(0, Math.PI * 2), x = c.x + Math.cos(a), y = c.y + Math.sin(a);
  if (tries >= DIVES || !inBounds(x, y) || (w.water[idx(x, y)] > 0) !== (mode === 'fish') || w.damp[idx(x, y)] > OTTER_SHORE) { c.mode = 'wander'; c.target = null; return false; }
  c.mode = mode; c.target = { x, y, tries };
  return true;
}

// The tile with the most of `field` of a few tried within `far` of x, y, if any has more than `worth` (and, with
// `shore`, is no further than that from the water).
function mostNear(w, field, x, y, far, tries, worth, shore = Infinity, ok = null) {
  let best = null, most = worth;
  for (let k = 0; k < tries; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(0, far), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (!inBounds(px, py)) continue;
    const i = idx(px, py);
    if (field[i] > most && w.damp[i] <= shore && (!ok || ok(w, i))) { best = { x: px, y: py }; most = field[i]; }
  }
  return best;
}
// Water by the bank, where an otter can get under the ice (tile i one in from the map's edge at least).
const atEdge = (w, i) => w.water[i] > 0 && (!w.water[i + 1] || !w.water[i - 1] || !w.water[i + W] || !w.water[i - W]);

// Into the water from trouble on the bank: the nearest water, the side away from it best, deep better. On the
// ice, or with no water near, it just runs.
function slip(w, c, x, y, fox) {
  const ax = c.x - x, ay = c.y - y, ad = hypot(ax, ay) || 1;
  let best = null, low = Infinity;
  for (let r = 1; r <= 8 && !w.frozen; r++) {
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, px = c.x + Math.cos(a) * r, py = c.y + Math.sin(a) * r;
      if (!inBounds(px, py) || !w.water[idx(px, py)]) continue;
      const v = r - 2 * (Math.cos(a) * ax + Math.sin(a) * ay) / ad + (w.water[idx(px, py)] === DEEP ? 0 : 1);
      if (v < low) { low = v; best = { x: px, y: py }; }
    }
  }
  c.mode = 'slip'; c.sleeping = false; c.threatId = fox ? fox.id : 0;
  c.target = best || { x: clamp(c.x + ax / ad * 6, 1, W - 1), y: clamp(c.y + ay / ad * 6, 1, H - 1) };
  if (fox && best && c.story[c.story.length - 1].text !== 'Slipped into the water away from ' + fox.name) note(w, c, '💦', 'Slipped into the water away from ' + fox.name);
}

// Where it sleeps: curled up at the holt with the family, side by side. Further from it than HOLT_HOME (and not
// a mum with cubs in it), or with no holt, on a bank close by, as otters lie up all along their water; and a cub
// by mum, wherever she's gone to bed.
function bedOf(w, c) {
  const mum = growth(w, c) < 1 && w.byId.get(c.mumId), d = holtOf(c) || (mum && mum.alive ? holtOf(mum) : null), k = c.id % 4;
  if (mum && mum.alive && !mum.hidden) return beside(w, mum.mode === 'bed' && mum.target || mum, [0.4, -0.4, 0.3, -0.3][k], [0.15, 0.15, 0.35, 0.35][k]);
  let p = d && (nursing(w, c) || dist2(c, d) < HOLT_HOME ** 2) && d.door;
  if (p && w.water[idx(p.x, p.y)]) p = { x: d.x, y: d.y + 0.3 };   // the way in's flooded: up by the trunk
  if (!p) p = bankSpot(w, c, 3) || bankSpot(w, c, 8) || d && d.door || bankSpot(w, c, 16) || c;
  return beside(w, p, [0, 0.55, -0.55, 0.25][k], [0, 0.15, 0.15, 0.4][k]);
}
// A little way from p, side by side with the others, unless that's in the water.
const beside = (w, p, dx, dy) => (dry(w, p.x + dx, p.y + dy) ? { x: p.x + dx, y: p.y + dy } : { x: p.x, y: p.y });

// A spot within reach up on the bank, a tile or two from the water.
function bankSpot(w, c, reach) {
  for (let k = 0; k < 10; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(1, reach), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (!inBounds(x, y)) continue;
    const i = idx(x, y);
    if (!w.water[i] && w.damp[i] >= 1 && w.damp[i] <= 2.5) return { x, y };
  }
  return null;
}

// Playing: up the highest bank about and sliding down it into the water (or out over the ice), and again, a few
// times (c.timer, the slides left), the others about sharing the slide (c.slide: its top, its foot, and when the
// last one set off) and taking turns.
function startPlay(w, c, s) {
  if (!s) return null;
  c.mode = 'play'; c.slide = s; c.target = slideTop(c, s); c.timer = w.rng.int(...PLAY_RUNS);
  return s;
}
function play(w, c) {
  const s = c.slide;
  if (!s || !c.target) { c.mode = 'wander'; c.target = c.slide = null; return false; }
  if (!moveToward(w, c, c.target.x, c.target.y, c.mode === 'slide' ? c.sprint : c.walk * PLAY_PACE)) return true;
  if (c.mode === 'slide') {                                  // down: up again, or that's the game
    if (c.timer <= 0) { c.mode = 'wander'; c.target = c.slide = null; return false; }
    c.mode = 'play'; c.target = slideTop(c, s);
    return true;
  }
  if (w.tick - s.went < SLIDE_GAP) { c.facing = s.foot.x > c.x ? 1 : -1; return true; }   // at the top, its turn next
  s.went = w.tick; c.timer--; c.mode = 'slide'; c.target = { x: s.foot.x + c.target.x - s.top.x, y: s.foot.y + c.target.y - s.top.y };
  return true;
}
// Where it waits at the top, a little apart from the others.
const slideTop = (c, s) => ({ x: s.top.x + [0, 0.3, -0.3][c.id % 3], y: s.top.y + [0, 0.12, 0.12][c.id % 3] });

// A slide: the highest of a few spots on the open bank about, and the way down from it to the nearest water and
// on into it. Null with no bank about.
function slideNear(w, c) {
  let top = null, high = -Infinity;
  for (let k = 0; k < 10; k++) {
    const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(0, SLIDE_LOOK), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    if (!inBounds(x, y)) continue;
    const i = idx(x, y);
    if (!w.water[i] && w.damp[i] >= SLIDE_BANK[0] && w.damp[i] <= SLIDE_BANK[1] && w.wood[i] < SLIDE_SHADE && w.ground[i] > high) { top = { x, y }; high = w.ground[i]; }
  }
  const way = top && waterWay(w, top, SLIDE_BANK[1] + 1, false);
  if (!way) return null;
  let run = way.r + (w.frozen ? SLIDE_ICE : SLIDE_RUN), x = top.x + Math.cos(way.a) * run, y = top.y + Math.sin(way.a) * run;
  if (!inBounds(x, y) || !w.water[idx(x, y)]) { run = way.r + 0.3; x = top.x + Math.cos(way.a) * run; y = top.y + Math.sin(way.a) * run; }
  return { top, foot: { x, y }, went: -SLIDE_GAP };
}

// The place on the bank of water that lasts with the most fish about that's free for a holt, away from the other holts,
// with room for at least HOLT_FISH: the roots of a big tree, or under a boulder. (The fish about a holt go by the ground,
// so they're worked out once, d.holtFish.)
const HOLT_ROCK = 1.5;          // a rock this big on the bank can have a holt under it
const holtFish = (w, d) => (d.holtFish === d.holtFish ? d.holtFish : (d.holtFish = holtDoor(w, d) ? fishNear(w, d) : 0));   // (NaN: not worked out yet)
const holtSite = (w, d) => (d.tree ? standing(d) && d.size >= GROWN && !d.hive
  : d.size >= HOLT_ROCK && !d.stone && w.ground[idx(d.x, d.y)] > w.terrain.level + w.terrain.springFlood);   // (a rock above the spring flood)
function holtTree(w) {
  const held = w.decor.filter(d => d.holt && holds(d));
  let best = null, most = HOLT_FISH - 1;
  for (const d of w.decor) {
    if (d.holt || !holtSite(w, d) || holtFish(w, d) <= most) continue;
    if (!held.some(o => dist2(o, d) < HOLT_GAP ** 2)) { best = d; most = d.holtFish; }
  }
  return best;
}

// A kept meadow made before the trees along the water (plantTrees) may have no big tree on such a bank: it gets a
// short row of them, young for their size, along the stretch with the most fish, above the spring flood.
function nearLasting(w, reach) {
  const m = new Uint8Array(W * H), level = w.terrain.level;
  for (let i = 0; i < W * H; i++) {
    if (w.ground[i] > level) continue;
    const x0 = i % W, y0 = (i / W) | 0;
    for (let y = Math.max(0, y0 - reach); y <= Math.min(H - 1, y0 + reach); y++) for (let x = Math.max(0, x0 - reach); x <= Math.min(W - 1, x0 + reach); x++) m[y * W + x] = 1;
  }
  return m;
}

// How many fish the water that lasts has room for within HOLT_REACH of p (fishRoom at the meadow's own water line).
function fishNear(w, p) {
  const T = w.terrain;
  let n = 0;
  for (let y = Math.max(0, Math.floor(p.y - HOLT_REACH)); y <= Math.min(H - 1, p.y + HOLT_REACH); y++) {
    for (let x = Math.max(0, Math.floor(p.x - HOLT_REACH)); x <= Math.min(W - 1, p.x + HOLT_REACH); x++) {
      const g = w.ground[y * W + x];
      if (g <= T.level && (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2 < HOLT_REACH ** 2) n += T.level - g >= T.deepAt ? FISH_K : FISH_K * FISH_SHALLOW;
    }
  }
  return n;
}

// The way into a holt: between the tree's roots (or at the foot of the rock) and the nearest water that lasts, on the
// bank. Null if it isn't on a bank.
function holtDoor(w, d) {
  const way = waterWay(w, d, HOLT_BANK, true);
  if (!way) return null;
  const r = d.tree ? clamp(way.r - 0.6, 0.3, 0.9) : clamp(way.r - 0.3, 0.3, d.size * 0.45);   // (under a rock: at its foot)
  return { x: d.x + Math.cos(way.a) * r, y: d.y + Math.sin(way.a) * r };
}

// Which way the nearest water is from p, within far, and how far: { a, r }, or null. With lasting, only the water
// that lasts the year round (below the meadow's own water line).
function waterWay(w, p, far, lasting) {
  let at = -1, near = far + 1;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8;
    for (let r = 0.5; r <= far && r < near; r += 0.5) {
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!inBounds(x, y)) break;
      if (lasting ? w.ground[idx(x, y)] <= w.terrain.level : w.water[idx(x, y)]) { at = a; near = r; break; }
    }
  }
  return at < 0 ? null : { a: at, r: near };
}

function moveInHolt(w, c, d) {
  if (c.home && c.home.holt === c.id) c.home.holt = 0;
  c.home = d; d.holt = c.id; d.door = holtDoor(w, d);
  note(w, c, '🏡', d.tree ? `Made a holt in the roots of ${d.name ? 'the ' + d.name : 'a big ' + d.kind + ' on the bank'}` : 'Made a holt under a boulder on the bank');
  emit(w, { type: 'holt', c, tree: d });
}

// A year old, at mum's holt: a young female takes a free holt, a young male goes off along the water to find
// a mate, while the meadow has room for more otters. Otherwise off down the water and out of the meadow.
function otterGrown(w, c) {
  const room = w.count.otter <= c.sp.cap * w.room, d = room && c.sex === 'F' && holtTree(w);
  if (d) { moveInHolt(w, c, d); return; }
  c.home = null;
  if (room && c.sex === 'M') { note(w, c, '🌊', 'Grown, and off along the water to find a mate of his own'); return; }
  c.mode = 'leave'; c.target = riverEnd(w, c);
  emit(w, { type: 'otterleaves', c });
}

// Where otters come in to make a holt at p: up the water that runs off the edge of the meadow, unless that's
// much further than the nearest edge, overland.
function otterWay(w, p) {
  const water = riverEnd(w, p, true), edge = riverEnd(w, p, false);
  return water && dist2(water, p) < 4 * dist2(edge, p) ? water : edge;
}

// Where the water runs off the edge of the meadow nearest p (lasting water, and not where a river or a brook comes
// in: an otter leaves with the current and comes up against it), or else (or with wet false) the nearest edge. Null
// with wet true and no water running off.
function riverEnd(w, p, wet) {
  let best = null, bd = Infinity;
  for (let k = 0; k < 2 * (W + H) && wet !== false; k++) {
    const x = k < 2 * W ? k % W + 0.5 : k < 2 * W + H ? 0.7 : W - 0.7;
    const y = k < W ? 0.7 : k < 2 * W ? H - 0.7 : (k - 2 * W) % H + 0.5, i = idx(x, y);
    if (!w.water[i] || w.ground[i] > w.terrain.level) continue;
    const out = k < W ? -w.current.y[i] : k < 2 * W ? w.current.y[i] : k < 2 * W + H ? -w.current.x[i] : w.current.x[i];
    if (out < 0) continue;                               // (it runs in here)
    const d = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d < bd) { best = { x, y }; bd = d; }
  }
  if (best || wet) return best;
  const edges = [[p.x, 0.7, p.y], [W - p.x, W - 0.7, p.y], [p.y, p.x, 0.7], [H - p.y, p.x, H - 0.7]].sort((a, b) => a[0] - b[0]);
  return { x: edges[0][1], y: edges[0][2] };
}

// Once a day: a holt whose otter is gone, or whose tree fell, is free again. Those still lived in get the day's spraint.
function holtsDay(w) {
  for (const d of w.decor) {
    if (!d.holt) continue;
    const o = w.byId.get(d.holt);
    if (!o || !o.alive || o.home !== d || !holds(d)) { d.holt = 0; continue; }
    enrich(w, d.door.x, d.door.y, SPRAINT_RICH, SPRAINT_REACH);
  }
}

function otterMood(w, c) {
  const winter = seasonOf(w.tick) === 3, wet = swimming(w, c);
  switch (c.mode) {
    case 'nest': return { emoji: '', text: 'A cub in the holt, squeaking for milk' };
    case 'sleep': return { emoji: '💤', text: holtOf(c) && dist2(c, c.home) < 4 ? 'Curled up asleep at the holt' : 'Curled up asleep on the bank' };
    case 'bed': return { emoji: '🏠', text: holtOf(c) && c.target && dist2(c.target, c.home) < 4 ? 'Off home to the holt for the day' : 'Off to a quiet bank to sleep on' };
    case 'slip': return c.threatId ? { emoji: '💦', text: `Into the water, away from ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` } : { emoji: '🔥', text: 'Away from the smoke!' };
    case 'watch': return { emoji: '👀', text: `Watching ${w.byId.get(c.threatId)?.name ?? 'a fox'} from the water` };
    case 'leave': return { emoji: '🧳', text: 'Off down the water to find a stretch of its own' };
    case 'fish': return { emoji: '🐟', text: c.target && c.target.tries ? 'Coming up, and down again' : 'Swimming off to where the fish are' };
    case 'dive': return { emoji: '🐟', text: 'Diving for fish' };
    case 'eat': return { emoji: '🐟', text: 'Eating a fish, afloat' };
    case 'frog': return { emoji: '🐸', text: winter ? 'Off along the bank to dig for frogs' : 'After the frogs at the spawning' };
    case 'root': return { emoji: '🐸', text: winter ? 'Digging in the mud for frogs' : 'Rooting along the shallows for frogs' };
    case 'munch': return { emoji: '🐸', text: 'Eating a frog' };
    case 'play': return { emoji: '', text: c.slide && c.target && dist2(c, c.target) < 0.01 ? 'Waiting its turn at the top of the slide' : 'Playing, up the bank again' };
    case 'slide': return { emoji: '', text: w.frozen ? 'Sliding over the ice!' : 'Sliding down the bank into the water!' };
    case 'follow': return { emoji: '🍼', text: 'Following mum' };
    case 'wander': return wet ? { emoji: '', text: 'Swimming along' } : null;
  }
  return null;
}

// ---------------------------------------------------------------- life and death

function die(w, c, cause, killer) {
  if (!c.alive) return;
  if (!c.hidden && c.species !== 'bee' && cause !== 'left') leaveRemains(w, c, cause === 'fox');   // a body left out
  c.alive = false; c.died = w.tick; c.cause = cause;
  c.killerId = killer ? killer.id : 0;
  if (c.hidden && c.burrow) c.burrow.count--;
  c.hidden = false;
  const age = Math.floor(ageDays(w, c));
  const text = cause === 'fox' ? `Caught by ${killer.name}` :
    cause === 'left' ? (c.species === 'otter' ? 'Went off down the water to find a stretch of its own' : 'Flew off over the trees to find a wood of its own') :
    cause === 'hunger' ? (seasonOf(w.tick) === 3 ? 'Starved in the winter' : 'Starved') :
    cause === 'lightning' ? 'Struck by lightning' :
    cause === 'flood' ? 'Drowned when the burrow flooded' :
    cause === 'ice' ? 'Fell through the ice and drowned' :
    `Died of old age, ${age} days old`;
  note(w, c, { fox: '🦊', left: '🧳', hunger: '🥀', lightning: '⚡', flood: '🌊', ice: '🧊' }[cause] || '🌙', text);
  w.stats.deaths[c.species][cause] = (w.stats.deaths[c.species][cause] || 0) + 1;
  w.anyDied = w.recount = true;
  emit(w, { type: 'death', c, cause, killer });
}

function lifeTick(w, c) {
  const g = growth(w, c);
  let b = c.burnRate * (0.5 + 0.5 * g);
  if (c.sleeping) b *= SLEEP_BURN;
  if (c.hidden && c.mode === 'nest') b = 0;                              // a chick in the nest, a cub in the holt: fed
  if (c.species === 'bee' && c.hidden) b *= 0.3 * clusterCold(w, c.home);   // huddled in the hive, barely burning
  if (c.pregnantUntil) b *= 1.25;
  const kind = w.weather.kind;
  if (kind === 'snow' && !c.hidden) b *= 1.25;                            // the cold
  if (w.snow > 0.3 && c.species === 'rabbit' && !c.hidden) b *= 1 - MOULT_WARM * whiteness(w, c);   // a white coat is a thick one
  b += MOVE_COST * c.moved * c.moved / c.sp.walk * (kind === 'heat' ? 1.5 : 1) * (c.sp.glide || 1) * c.sp.hunger;
  c.energy -= b;
  if (!c.sprinting) c.stamina = Math.min(1, c.stamina + (c.sleeping || c.mode === 'tired' ? 1 / 150 : 1 / 400));
  c.sprinting = false;
  c.moved = 0;

  if (c.energy <= 0) return die(w, c, 'hunger');
  if (w.tick - c.born > c.lifespan) return die(w, c, 'age');
  if (c.pregnantUntil && w.tick >= c.pregnantUntil) giveBirth(w, c);
}

// ---------------------------------------------------------------- the forager
//
// The player: a little hooded forager (w.forager) you walk about by clicking. Not a creature: nothing hunts it and it
// eats nothing the meadow counts. A click asks foragerTo for a way there: A* over the tiles (deep water blocks unless
// it's frozen; the shallows cost more, so it wades only where that saves a good way round; ground by the deep costs a
// little more, so the way keeps off the brink), then pulled tight into a few straight legs (taut: each as long as it can
// be without coming within TAUT_CLEAR of the deep, or wading where the tiles' way didn't). It walks them by steering, not
// tile by tile: it heads for a point FORAGER_LOOK tiles further along the way, turning at most FORAGER_TURN a tick, so
// corners come round in curves; it speeds up gently (FORAGER_ACCEL), slows to stop just where it was sent (FORAGER_BRAKE),
// slows into a sharp turn, and wades at FORAGER_WADE of its pace. Sent running (f.running: game.js, Shift held or the
// spot tapped again) it sprints at FORAGER_RUN instead, while its stamina lasts (bodyTick); cold, it walks slower
// (bodyPace). It moves on the sim's ticks, so pausing pauses it, and game.js draws it between them.
const FORAGER_WALK = 0.085;             // tiles a tick at a walk (a rabbit ambles 0.06)
const FORAGER_RUN = 0.16;               // and at a sprint
const FORAGER_WADE = 0.5;               // of that, in the shallows
const FORAGER_ACCEL = 0.0058;           // tiles a tick it gains a tick, setting off (about half a second to a walk)
const FORAGER_BRAKE = 0.0035;           // and loses, stopping (it starts slowing about 0.7 tiles out)
const FORAGER_TURN = 0.16;              // radians a tick it can turn at most at a walk (three times that from standing)
const FORAGER_LOOK = 0.8;               // tiles ahead along its way it steers for
const SHALLOW_COST = 2.5;               // a step in the shallows costs this many on dry ground
const BRINK_COST = 0.8;                 // and one next to deep water this much more
const TAUT_CLEAR = 0.3;                 // a straightened leg keeps this far off the deep on either side
const FORAGER_GIRTH = 0.22;             // how near a rock's side it comes, middle to edge
// How far out from its middle a rock is in the way, in its sizes (its main stone as game.js paints it); pebbles and a
// ford's stones it walks over.
const ROCK_SOLID = { pebbles: 0, ford: 0, stone: 0.34, boulder: 0.6, great: 0.6 };
// Trees and brambles aren't in its way like a rock: it pushes through them, slower, and is eased round the trunk, as in
// Project Zomboid. Each is a circle about its foot (BRUSH_R plus BRUSH_GROW of its size, plus FORAGER_GIRTH) that slows
// it by up to its slow at the middle, less toward the edge, and pushes it out sideways by up to BRUSH_PUSH of its step.
const BRUSH_TREE = { r: 0.28, grow: 0.08, slow: 0.5 };      // a standing tree (or a snag), by its size
const BRUSH_THORN = { r: 0.3, grow: 0.1, slow: 0.6 };       // a hawthorn: a thorn bush, wider and thicker
const BRUSH_BRAMBLE = { r: 0.35, grow: 0.22, slow: 0.6 };   // a bramble patch, by its size (1 or 2)
const BRUSH_PUSH = 0.55;                // of a step, at a trunk's middle
const BRUSH_COST = 2;                   // a step through brush that slows it all the way costs this much more
const BRUSH_NEAR = 2.5;                 // tiles about it it looks for brush in, again once it's gone a tile

// Every field it ever has, in one order (see blankCreature). path: the way, as x, y pairs; leg: the pair it's heading
// for; speed, heading: tiles a tick, radians (0 east, pi / 2 down the screen); moved: how far it went last tick;
// goalX, goalY: where it was sent; running: sprinting there.
// bag, bagN: the satchel's slots, what's in each (an ingredient's id, recipes.js) and how many (gather, stow).
// warmth (1 cosy, 0 collapsed), wet (0 dry, 1 soaked), stamina (1 fresh, 0 spent), feel: how warm it feels about it
// now (in degrees, like airTemp), winded: spent, no sprint till it's got its breath back, down: the tick it collapsed
// (-1: on its feet), stumble: ticks left of a stumble, homeX, homeY: where it wakes (where it started; later the camp).
const SLOTS = 8, STACK = 10;            // the satchel's slots, and how many of a kind one holds
function foragerOf(x, y) {
  const f = { forager: true, x, y, path: [], leg: 0, speed: -0, heading: Math.PI / 2, moved: -0, walking: false, goalX: x, goalY: y,
    running: false, bag: new Array(SLOTS).fill(''), bagN: new Array(SLOTS).fill(0),
    warmth: -0, wet: -0, stamina: -0, feel: -0, winded: false, down: -1, stumble: 0, homeX: x, homeY: y };
  f.warmth = 1; f.stamina = 1;          // (after: they start as fractions, so the layout never changes)
  return f;
}

// Where it starts: a pleasant dry spot near the water and the woods, above the spring flood, nothing standing on it, not
// far from the middle.
function startForager(w) {
  const T = w.terrain, high = T.level + T.springFlood + T.rainRise / 2, M = 12;
  let best = -Infinity, bx = W / 2, by = H / 2;
  for (let y = M; y < H - M; y++) for (let x = M; x < W - M; x++) {
    const i = y * W + x;
    if (w.water[i] || w.ground[i] <= high || w.wood[i] > 0.12 || w.damp[i] < 3) continue;
    let wood = 0;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; wood += w.wood[idx(clamp(x + Math.cos(a) * 5, 0, W - 1), clamp(y + Math.sin(a) * 5, 0, H - 1))]; }
    const score = Math.min(wood / 8, 0.4) * 3 - Math.abs(w.damp[i] - 5) * 0.2 - Math.hypot(x - W / 2, y - H / 2) / 60;
    if (score <= best) continue;
    let clear = true;
    forEachDecorNear(w, x + 0.5, y + 0.5, 3, d => { if (Math.hypot(d.x - x - 0.5, d.y - y - 0.5) < (d.tree ? 1.5 : d.size * 0.6 + 0.6)) clear = false; });
    if (clear && !w.burrows.some(b => Math.hypot(b.x - x - 0.5, b.y - y - 0.5) < 2.5)) { best = score; bx = x + 0.5; by = y + 0.5; }
  }
  return foragerOf(bx, by);
}

// The rocks in its way, worked out once a meadow (rocks never come or go): x, y and how near it comes to the middle
// (solidR, as x, y, r threes), and the tiles whose middle is that near one, which it can't step on (solidTile).
let solidW = null, solidR = [], solidTile = null;
function rocksFor(w) {
  if (solidW === w) return;
  solidW = w; solidR = [];
  solidTile = new Uint8Array(W * H);
  for (const d of w.decor) {
    if (d.emoji !== '🪨' || !ROCK_SOLID[rockKind(d)]) continue;
    const r = d.size * ROCK_SOLID[rockKind(d)] + FORAGER_GIRTH;
    solidR.push(d.x, d.y, r);
    for (let ty = Math.max(0, Math.floor(d.y - r)); ty <= Math.min(H - 1, Math.floor(d.y + r)); ty++)
      for (let tx = Math.max(0, Math.floor(d.x - r)); tx <= Math.min(W - 1, Math.floor(d.x + r)); tx++)
        if (Math.hypot(tx + 0.5 - d.x, ty + 0.5 - d.y) < r) solidTile[ty * W + tx] = 1;
  }
}
// Whether the leg from x0, y0 to x1, y1 keeps clear of every rock.
function pastRocks(x0, y0, x1, y1) {
  for (let k = 0; k < solidR.length; k += 3) if (segDist(solidR[k], solidR[k + 1], x0, y0, x1, y1) < solidR[k + 2]) return false;
  return true;
}
// x, y moved out of any rock it's in, to its edge (or no further in than from, for one it's already in: a meadow kept
// before rocks were in its way). Into rockX, rockY.
let rockX = 0, rockY = 0;
function outOfRocks(x, y, fromX, fromY) {
  for (let k = 0; k < solidR.length; k += 3) {
    const cx = solidR[k], cy = solidR[k + 1], dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    const most = Math.min(solidR[k + 2], Math.hypot(fromX - cx, fromY - cy));
    if (d >= most) continue;
    const a = d > 1e-6 ? 1 / d : 0;
    x = cx + (a ? dx * a : 1) * most; y = cy + (a ? dy * a : 0) * most;
  }
  rockX = x; rockY = y;
}

// The brush about: each tree and bramble as x, y, r, slow (brushNear, for foragerTick, from what's within BRUSH_NEAR of
// where it looked last), and how much each tile's middle slows it (brushTile, for the way: A* and taut). Both gathered
// again at most once a game hour, as trees grow, fall and come up; the grid only when a way is wanted.
let brushW = null, brushHour = -1, brushNear = new Float32Array(64), brushN = 0, brushX = -1e9, brushY = -1e9, brushNearHour = -1;
let brushTile = null;
const hourOf = w => Math.floor(w.tick / (TPD / 24));
function brushOf(d) {                    // the brush a tree or bramble is, into brushR, brushS (0: none)
  brushR = 0; brushS = 0;
  if (d.bramble) { if (d.size > 0) { brushR = BRUSH_BRAMBLE.r + BRUSH_BRAMBLE.grow * d.size + FORAGER_GIRTH; brushS = BRUSH_BRAMBLE.slow; } return; }
  if (!d.tree || d.stump || d.fallen || d.gone || d.size < SEEDLING) return;
  const k = d.kind === 'hawthorn' ? BRUSH_THORN : BRUSH_TREE;
  brushR = k.r + k.grow * d.size + FORAGER_GIRTH; brushS = k.slow * clamp((d.size - SEEDLING) / 1.2, 0.3, 1);   // (a sapling barely)
}
let brushR = 0, brushS = 0;
const brushAt = (q, slow) => slow * q * (2 - q);  // how much it slows, q of the way in from the edge (firm soon in)
function brushGrid(w) {
  const hour = hourOf(w);
  if (brushW === w && brushHour === hour && brushTile) return;
  brushW = w; brushHour = hour; brushNearHour = -1;
  if (!brushTile) brushTile = new Float32Array(W * H);
  brushTile.fill(0);
  const stamp = d => {
    brushOf(d);
    if (!brushS) return;
    for (let ty = Math.max(0, Math.floor(d.y - brushR)); ty <= Math.min(H - 1, Math.floor(d.y + brushR)); ty++)
      for (let tx = Math.max(0, Math.floor(d.x - brushR)); tx <= Math.min(W - 1, Math.floor(d.x + brushR)); tx++) {
        const dd = Math.hypot(tx + 0.5 - d.x, ty + 0.5 - d.y);
        if (dd >= brushR) continue;
        const i = ty * W + tx, h = brushAt(1 - dd / brushR, brushS);
        brushTile[i] = 1 - (1 - brushTile[i]) * (1 - h);
      }
  };
  for (const d of w.decor) if (!d.gone) stamp(d);
  for (const b of w.brambles) stamp(b);
}
function brushAbout(w, x, y) {
  const hour = hourOf(w);
  if (brushW === w && brushNearHour === hour && Math.abs(x - brushX) < 1 && Math.abs(y - brushY) < 1) return;
  if (brushW !== w) { brushW = w; brushHour = -1; }
  brushNearHour = hour; brushX = x; brushY = y; brushN = 0;
  const add = d => {
    brushOf(d);
    if (!brushS || Math.abs(d.x - x) > BRUSH_NEAR + brushR || Math.abs(d.y - y) > BRUSH_NEAR + brushR) return;
    if (brushN * 4 >= brushNear.length) { const m = new Float32Array(brushNear.length * 2); m.set(brushNear); brushNear = m; }
    const k = brushN++ * 4;
    brushNear[k] = d.x; brushNear[k + 1] = d.y; brushNear[k + 2] = brushR; brushNear[k + 3] = brushS;
  };
  forEachDecorNear(w, x, y, BRUSH_NEAR + 1, add);
  for (const b of w.brambles) add(b);
}

// A step's cost onto tile i, or 0 where it can't go.
const canStand = (w, i) => (w.frozen || w.water[i] !== DEEP) && !solidTile[i];
function stepCost(w, i) {
  if (solidTile[i]) return 0;
  const brush = 1 + BRUSH_COST * brushTile[i];
  if (w.frozen) return brush;
  const v = w.water[i];
  if (v === DEEP) return 0;
  let c = v === SHALLOW ? SHALLOW_COST : brush;
  const x = i % W, y = (i / W) | 0;
  if ((x > 0 && w.water[i - 1] === DEEP) || (x < W - 1 && w.water[i + 1] === DEEP) || (y > 0 && w.water[i - W] === DEEP) || (y < H - 1 && w.water[i + W] === DEEP)) c += BRINK_COST;
  return c;
}

// A* over the tiles, from tile a to tile b (or, if b can't be reached, to the tile reached nearest it). Its arrays are
// made once and kept; a search is a few ms at most, once a click.
let starG = null, starF = null, starFrom = null, starSeen = null, starHeap = null, starN = 0, starRun = 0;
function heapPush(i) {
  let k = starN++;
  while (k > 0) { const p = (k - 1) >> 1; if (starF[starHeap[p]] <= starF[i]) break; starHeap[k] = starHeap[p]; k = p; }
  starHeap[k] = i;
}
function heapPop() {
  const top = starHeap[0], last = starHeap[--starN];
  if (starN > 0) {
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k, fm = starF[last];
      if (l < starN && starF[starHeap[l]] < fm) { m = l; fm = starF[starHeap[l]]; }
      if (r < starN && starF[starHeap[r]] < fm) m = r;
      if (m === k) break;
      starHeap[k] = starHeap[m]; k = m;
    }
    starHeap[k] = last;
  }
  return top;
}
function tilePath(w, a, b) {
  if (!starG) { starG = new Float32Array(W * H); starF = new Float32Array(W * H); starFrom = new Int32Array(W * H); starSeen = new Int32Array(W * H); starHeap = new Int32Array(W * H * 8); }
  const run = ++starRun, bx = b % W, by = (b / W) | 0;
  const h = i => { const dx = Math.abs(i % W - bx), dy = Math.abs(((i / W) | 0) - by); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  starN = 0;
  starSeen[a] = run; starG[a] = 0; starF[a] = h(a); starFrom[a] = -1; heapPush(a);
  let near = a, nearH = h(a);
  while (starN > 0) {
    const i = heapPop();
    if (starSeen[i] === -run) continue;                  // (closed already: a stale entry)
    starSeen[i] = -run;
    if (i === b) { near = b; break; }
    const hi = h(i);
    if (hi < nearH) { nearH = hi; near = i; }
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (starSeen[j] === -run) continue;
      const c = stepCost(w, j);
      if (!c || (dx && dy && (!canStand(w, y * W + nx) || !canStand(w, ny * W + x)))) continue;   // (no squeezing past the deep's corner)
      const g = starG[i] + c * (dx && dy ? Math.SQRT2 : 1);
      if (starSeen[j] === run && g >= starG[j]) continue;
      starSeen[j] = run; starG[j] = g; starF[j] = g + h(j) * 0.999; starFrom[j] = i;
      if (starN < starHeap.length) heapPush(j);
    }
  }
  const out = [];
  for (let i = near; i >= 0; i = starFrom[i]) out.push(i);
  return out.reverse();
}

// Whether the straight leg from x0, y0 to x1, y1 keeps clear of the rocks, TAUT_CLEAR off the deep, (dry: the tiles' way didn't wade)
// out of the shallows, and out of brush thicker than thick (the thickest the tiles' way went through), so it doesn't cut
// through the wood the way went round.
function taut(w, x0, y0, x1, y1, dry, thick) {
  if (!pastRocks(x0, y0, x1, y1)) return false;
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(d / 0.2));
  for (let k = 1; k < n; k++) if (brushTile[idx(x0 + dx * k / n, y0 + dy * k / n)] > thick + 0.05) return false;
  if (w.frozen) return true;
  const px = d ? -dy / d * TAUT_CLEAR : 0, py = d ? dx / d * TAUT_CLEAR : 0;
  for (let k = 0; k <= n; k++) {
    const x = x0 + dx * k / n, y = y0 + dy * k / n;
    for (let s = -1; s <= 1; s++) {
      const sx = x + px * s, sy = y + py * s;
      if (!inBounds(sx, sy)) return false;
      const v = w.water[idx(sx, sy)];
      if (v === DEEP || (dry && s === 0 && v === SHALLOW)) return false;
    }
  }
  return true;
}

// Sends it to x, y: the way there found and pulled tight. Returns where it'll stop (the nearest it can get, for a click
// on the deep or across it), or null if it's there already.
function foragerTo(w, x, y) {
  const f = w.forager;
  if (f.down >= 0) return null;                          // (collapsed: it goes nowhere till it wakes)
  rocksFor(w); brushGrid(w);
  x = clamp(x, 0.6, W - 0.6); y = clamp(y, 0.6, H - 0.6);
  outOfRocks(x, y, x, y + 1e9);                          // (sent onto a rock: to its edge, the side nearest the click)
  x = clamp(rockX, 0.6, W - 0.6); y = clamp(rockY, 0.6, H - 0.6);
  let goal = idx(x, y);
  if (!canStand(w, goal)) {                              // on the deep: the nearest tile it can stand on
    let best = -1, bd = Infinity;
    for (let r = 1; r < 16 && best < 0; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const tx = (x | 0) + i, ty = (y | 0) + j;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H || !canStand(w, ty * W + tx)) continue;
      const d = (tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2;
      if (d < bd) { bd = d; best = ty * W + tx; }
    }
    if (best < 0) return null;
    goal = best; x = best % W + 0.5; y = ((best / W) | 0) + 0.5;
  }
  const tiles = tilePath(w, idx(f.x, f.y), goal), last = tiles.length - 1;
  if (tiles[last] !== goal) { x = tiles[last] % W + 0.5; y = ((tiles[last] / W) | 0) + 0.5; }   // (cut off: as near as it gets)
  if (Math.hypot(x - f.x, y - f.y) < 0.15) return null;
  // Pulled tight: from each corner, straight on to the furthest tile along the way it can reach in a line.
  const wet = i => !w.frozen && w.water[i] === SHALLOW;
  const px = k => (k === last ? x : tiles[k] % W + 0.5), py = k => (k === last ? y : ((tiles[k] / W) | 0) + 0.5);
  const pts = [f.x, f.y];
  let ax = f.x, ay = f.y, a = 0;
  while (a < last) {
    let dry = !wet(tiles[a]), thick = brushTile[tiles[a]], ok = a + 1;
    for (let b = a + 1; b <= last; b++) {
      if (wet(tiles[b])) dry = false;
      thick = Math.max(thick, brushTile[tiles[b]]);
      if (taut(w, ax, ay, px(b), py(b), dry, thick)) ok = b;
      else if (b - ok > 4) break;                        // (well past where it lost sight)
    }
    a = ok; ax = px(a); ay = py(a);
    pts.push(ax, ay);
  }
  if (!last) pts.push(x, y);                             // (in its own tile: straight there, or the way had no leg)
  f.path.length = 0;
  for (const v of pts) f.path.push(v);
  f.leg = 1; f.walking = true; f.goalX = x; f.goalY = y;
  return { x, y };
}

// How far x, y is from the segment from a to b.
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(ax + dx * t - x, ay + dy * t - y);
}

// One tick of walking its way.
function foragerTick(w) {
  const f = w.forager, P = f.path;
  f.moved = 0;
  if (!f.walking) { f.speed = 0; return; }
  const n = P.length / 2;
  while (f.leg < n - 1) {                                // onto the next leg once near this one's end, past it, or nearer the next
    const k = f.leg * 2, bx = P[k], by = P[k + 1];
    const t = ((f.x - P[k - 2]) * (bx - P[k - 2]) + (f.y - P[k - 1]) * (by - P[k - 1])) / ((bx - P[k - 2]) ** 2 + (by - P[k - 1]) ** 2 || 1);
    if (t < 1 && Math.hypot(bx - f.x, by - f.y) > FORAGER_LOOK * 0.5
      && segDist(f.x, f.y, P[k - 2], P[k - 1], bx, by) <= segDist(f.x, f.y, bx, by, P[k + 2], P[k + 3])) break;
    f.leg++;
  }
  // Where it is along this leg, the point FORAGER_LOOK further along the way that it steers for, and how far it is to the end.
  const ax = P[f.leg * 2 - 2], ay = P[f.leg * 2 - 1], bx = P[f.leg * 2], by = P[f.leg * 2 + 1];
  const lx = bx - ax, ly = by - ay, ll = Math.hypot(lx, ly) || 1;
  const t = clamp(((f.x - ax) * lx + (f.y - ay) * ly) / (ll * ll), 0, 1);
  let rest = (1 - t) * ll, left = FORAGER_LOOK, along = Math.min(left, rest);
  let tx = ax + lx * t + lx / ll * along, ty = ay + ly * t + ly / ll * along;
  left -= along;
  for (let k = f.leg; k < n - 1; k++) {
    const cx = P[k * 2], cy = P[k * 2 + 1], dx = P[k * 2 + 2] - cx, dy = P[k * 2 + 3] - cy, dl = Math.hypot(dx, dy) || 1;
    rest += dl;
    if (left > 0) { along = Math.min(left, dl); tx = cx + dx / dl * along; ty = cy + dy / dl * along; left -= along; }
  }
  rest = Math.max(rest, Math.hypot(f.goalX - f.x, f.goalY - f.y) * (f.leg === n - 1 ? 1 : 0));
  // Turn toward it, at most FORAGER_TURN a tick, slowing into a sharp turn; up to speed gently, and down to stop at the end.
  const want = Math.atan2(ty - f.y, tx - f.x);
  let turn = want - f.heading;
  turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
  const most = FORAGER_TURN * (1 + 2 * clamp(1 - f.speed / FORAGER_WALK, 0, 1));   // (standing, it turns round quicker)
  f.heading += clamp(turn, -most, most);
  f.heading -= Math.round(f.heading / (2 * Math.PI)) * 2 * Math.PI;
  const wade = !w.frozen && w.water[idx(f.x, f.y)] === SHALLOW;
  // In brush: slowed, and pushed out from each trunk's middle (pushX, pushY, in its sizes), less as it nears where it's going.
  brushAbout(w, f.x, f.y);
  let free = 1, pushX = 0, pushY = 0;
  for (let k = 0; k < brushN * 4; k += 4) {
    const dx = f.x - brushNear[k], dy = f.y - brushNear[k + 1], r = brushNear[k + 2];
    if (dx > r || dx < -r || dy > r || dy < -r) continue;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    const q = 1 - d / r;
    free *= 1 - brushAt(q, brushNear[k + 3]);
    if (d > 1e-4) { pushX += dx / d * q; pushY += dy / d * q; }
  }
  const top = (f.running ? FORAGER_RUN : FORAGER_WALK) * (wade ? FORAGER_WADE : 1) * free * bodyPace(f) * clamp(Math.cos(turn) * 0.8 + 0.4, 0.15, 1);
  const v = Math.min(top, Math.sqrt(2 * FORAGER_BRAKE * rest)), s = f.speed;
  f.speed = v > s ? Math.min(v, s + FORAGER_ACCEL) : Math.max(v, s - FORAGER_BRAKE * 2);
  if (rest < 0.02 || (rest < 0.1 && f.speed < 0.008)) { f.walking = false; f.running = false; f.speed = 0; f.path.length = 0; return; }
  const step = Math.min(f.speed, rest);
  let nx = f.x + Math.cos(f.heading) * step, ny = f.y + Math.sin(f.heading) * step;
  if (pushX || pushY) { const p = BRUSH_PUSH * step * clamp(rest / 0.8, 0, 1); nx += pushX * p; ny += pushY * p; }
  rocksFor(w);
  outOfRocks(nx, ny, f.x, f.y); nx = rockX; ny = rockY;   // (a rock in the way: round it)
  if (!walkable(w, nx, ny)) {                            // (the water came up, or a corner clipped the deep: slide along it)
    if (walkable(w, nx, f.y)) ny = f.y;
    else if (walkable(w, f.x, ny)) nx = f.x;
    else { f.speed = 0; if (!foragerTo(w, f.goalX, f.goalY)) f.walking = false; return; }
  }
  f.moved = Math.hypot(nx - f.x, ny - f.y);
  f.x = nx; f.y = ny;
}

// ---------------------------------------------------------------- warmth, wet and stamina
//
// The air has a temperature (airTemp, in degrees): the year's (warmest at midsummer, AIR_YEAR), the day's (coldest at
// sunrise, just before the dawn, warmest in the middle of the afternoon, AIR_DAY, more on a clear day and less under
// cloud) and the weather's (AIR_WEATHER), less where snow lies (AIR_SNOW). What the forager feels (f.feel) is the air,
// plus the sun on it out of the shade (SUN), less the wind (WIND, half that in the woods) and being wet (WET_CHILL), plus
// moving (ACTIVE: walking warms, sprinting more, standing still in the cold chills). Over COMFY its warmth comes back
// (WARM_K a degree a day), under it the warmth goes (COOL_K a degree a day, WET_COLD times as fast again soaked). So a
// summer night is chilly, a spring or autumn night out is dangerous (most of the warmth gone by dawn, and wet it kills),
// and a winter night out kills. A fire will be the strongest warmth (stage 4); warm dishes, shelter and clothes later.
// Rain and wading wet it (WET_RAIN, WET_WADE; the trees keep off some rain), and it dries out of the rain, faster warm
// and in the sun (DRY). Sprinting spends its stamina (SPRINT_TICKS of it from fresh), and walking and standing bring it
// back (REST_TICKS), slower cold; spent, it can't sprint again till it has WINDED_BACK of it. Its stage (warmthStage):
// cosy, chilly, cold (it walks slower, COLD_PACE), freezing (slower still, and it stumbles now and then, STUMBLE_*), and at
// nothing it collapses (f.down). It wakes the next morning at home (WAKE_PHASE, wakeForager), with what was in the
// satchel lost; game.js runs the night by quickly behind a dark screen. Nothing here draws the meadow's random numbers.
const AIR_YEAR = [9, 10];               // degrees: the year's middle, and how far midsummer is over it (and midwinter under)
const AIR_DAY = 5;                      // how far the afternoon is over the day's middle, and the sunrise under it
const AIR_WARMEST = 0.45;               // of the day after sunrise (phaseOf): the warmest of it
// By the weather: degrees on or off, and the day's swing (times AIR_DAY).
const AIR_WEATHER = { clear: [0, 1.4], cloudy: [-0.5, 0.6], rain: [-2, 0.5], storm: [-4, 0.4], fog: [-1.5, 0.5], snow: [-2, 0.5], heat: [6, 1.2] };
const AIR_SNOW = 3;                     // degrees colder with snow lying deep
const SUN = { clear: 5, heat: 6, cloudy: 1.5, fog: 0.5 };   // degrees the sun warms it out of the shade at midday
const WIND = { clear: 1.5, cloudy: 2, rain: 2.5, storm: 4, fog: 0.5, snow: 2.5, heat: 0.5 };   // degrees the wind takes off in the open
const WET_CHILL = 3;                    // degrees colder soaked
const ACTIVE = { still: -1.5, walk: 2, run: 5 };   // degrees: moving keeps it warm
const COMFY = 10;                       // feeling this warm, it neither warms nor cools
const COOL_K = 0.16, WARM_K = 0.35;     // of its warmth a day, a degree under (over) COMFY
const WET_COLD = 1;                     // soaked, it loses warmth this much faster again
const WET_RAIN = { rain: 8, storm: 16, snow: 3 };    // a day: how fast it soaks (8: soaked in an eighth of a day, a minute and a half at 1x)
const WET_WADE = 100;                   // and wading
const DRY = 3;                          // a day: how fast it dries out of the rain at 14 degrees (faster warm, in the sun, moving)
const SHELTER_WOOD = 0.5;               // woods this thick keep off most rain and wind (and the sun)
const SPRINT_TICKS = 420;               // ticks of sprinting from fresh to spent (14 s at 1x)
const REST_TICKS = [240, 480];          // and back from spent to fresh, standing and walking (8 s, 16 s), warm
const WINDED_BACK = 0.35;               // spent, it sprints again once it has this much back
const WARMTH_STAGES = [0.7, 0.45, 0.22];   // over the first it's cosy, then chilly, cold, and freezing under the last
const COLD_PACE = [0.88, 0.72];         // its pace cold, and freezing
const STUMBLE_ODDS = 1 / 240, STUMBLE_TICKS = 28, STUMBLE_PACE = 0.15;   // freezing, walking: a stumble about every 8 s
const WAKE_PHASE = 0.04, DOWN_TICKS = TPD / 5, WAKE_WARMTH = 0.62;   // it wakes the next morning (at least DOWN_TICKS after: down at dawn, the one after), chilly

// 0 cosy, 1 chilly, 2 cold, 3 freezing, 4 collapsed.
const warmthStage = f => (f.down >= 0 ? 4 : f.warmth > WARMTH_STAGES[0] ? 0 : f.warmth > WARMTH_STAGES[1] ? 1 : f.warmth > WARMTH_STAGES[2] ? 2 : 3);
function airTemp(w) {
  const t = w.tick, p = phaseOf(t), k = AIR_WEATHER[w.weather.kind] || AIR_WEATHER.clear;
  const u = p < AIR_WARMEST ? p / AIR_WARMEST : 1 - (p - AIR_WARMEST) / (1 - AIR_WARMEST);   // 0 at sunrise, 1 the warmest
  return AIR_YEAR[0] + AIR_YEAR[1] * Math.cos(2 * Math.PI * (t / TPD / YEAR_DAYS - 0.375)) - AIR_DAY * k[1] * Math.cos(Math.PI * u) + k[0] - AIR_SNOW * w.snow;
}
// How high the sun is, 0 to 1 (0 at night).
const sunUp = t => { const p = phaseOf(t); return p < 0.02 || p > 0.72 ? 0 : Math.sin(Math.PI * (p - 0.02) / 0.7); };
// Its pace against a warm one's: slower cold, slowest in a stumble.
const bodyPace = f => (f.stumble > 0 ? STUMBLE_PACE : 1) * (f.warmth > WARMTH_STAGES[1] ? 1 : f.warmth > WARMTH_STAGES[2] ? COLD_PACE[0] : COLD_PACE[1]);

// One tick of its body: warmth, wet, stamina, and a collapse.
function bodyTick(w) {
  const f = w.forager;
  if (f.down >= 0) {                                    // down: it wakes the next morning, at home
    if (w.tick - f.down >= DOWN_TICKS && w.tick % TPD === Math.round(WAKE_PHASE * TPD)) wakeForager(w);
    return;
  }
  const kind = w.weather.kind, i = idx(f.x, f.y), air = airTemp(w);
  const shelter = clamp(w.wood[i] / SHELTER_WOOD, 0, 1);
  const moving = f.walking && f.moved > 0, sprint = moving && f.running && !f.winded;
  const wade = !w.frozen && w.water[i] === SHALLOW;
  const fire = w.fires.length ? fireWarmth(w, f.x, f.y) : 0, near = fire ? fireNear : 0;   // (a fire close by: the strongest warmth)
  const feel = air + (SUN[kind] || 0) * sunUp(w.tick) * (1 - shelter) - (WIND[kind] || 0) * (1 - 0.6 * shelter) - WET_CHILL * f.wet
    + (sprint ? ACTIVE.run : moving ? ACTIVE.walk : ACTIVE.still) + fire;
  f.feel = feel;
  const d = feel - COMFY;
  f.warmth = clamp(f.warmth + (d > 0 ? WARM_K * d : COOL_K * d * (1 + WET_COLD * f.wet)) / TPD, 0, 1);
  const soak = wade ? WET_WADE : (WET_RAIN[kind] || 0) * (1 - 0.7 * shelter);
  if (soak > 0) f.wet = Math.min(1, f.wet + soak / TPD);
  else if (f.wet > 0) f.wet = Math.max(0, f.wet - DRY * clamp(0.3 + air / 20, 0.15, 1.6) * (1 + sunUp(w.tick) * (SUN[kind] || 0) / 5) * (moving ? 1.2 : 1) / TPD);
  if (near > 0 && f.wet > 0 && !wade) f.wet = Math.max(0, f.wet - FIRE_DRY * near / TPD);   // (it dries by the fire, rain or not)
  if (sprint) f.stamina = Math.max(0, f.stamina - 1 / SPRINT_TICKS);
  else f.stamina = Math.min(1, f.stamina + clamp(0.35 + 0.65 * f.warmth / WARMTH_STAGES[0], 0.35, 1) / REST_TICKS[moving ? 1 : 0]);
  if (f.stamina <= 0) f.winded = true;
  else if (f.winded && f.stamina >= WINDED_BACK) f.winded = false;
  if (f.winded) f.running = false;
  if (f.stumble > 0) f.stumble--;
  else if (moving && f.warmth <= WARMTH_STAGES[2] && hash2(w.tick, 0x5707, w.seed) < STUMBLE_ODDS) f.stumble = STUMBLE_TICKS;
  if (f.warmth <= 0) {                                  // collapsed
    f.down = w.tick; f.walking = false; f.running = false; f.speed = 0; f.path.length = 0; f.stumble = 0;
    emit(w, { type: 'collapse' });
  }
}

// It wakes at home: warm enough to get going, dry, rested, and the satchel empty.
function wakeForager(w) {
  const f = w.forager;
  f.x = f.homeX; f.y = f.homeY; f.goalX = f.x; f.goalY = f.y; f.heading = Math.PI / 2;
  f.walking = false; f.running = false; f.speed = 0; f.path.length = 0;
  f.warmth = WAKE_WARMTH; f.wet = 0; f.stamina = 1; f.winded = false; f.stumble = 0; f.down = -1;
  f.bag.fill(''); f.bagN.fill(0);
  emit(w, { type: 'woke' });
}

// ---------------------------------------------------------------- fires
//
// A campfire (w.fires, one layout, fireOf): a ring of stones with sticks and tinder in it, laid where the forager kneels
// (layFire; what one takes is recipes.js's BUILDS, which game.js spends out of the satchel), and lit (lightFire: game.js
// has the forager strike its flint and steel and blow on the spark). Lit, it burns its sticks down (f.fuel, in ticks:
// FIRE_STICK a stick, faster in the wet, FIRE_WET), never more than FIRE_MOST of them on at once (feedFire puts more on).
// Burnt out, its embers glow on for FIRE_EMBERS (f.embers), and a stick on and a quick blow light it again (lightFire takes
// embers as it takes tinder); after that it's cold, and wants tinder and a strike. Water coming over it (the spring flood)
// puts it out. How well it burns (fireHeat, 0 to 1: low under FIRE_LOW, a glow as embers) is how warm it is by it
// (fireWarmth: FIRE_WARM degrees within FIRE_NEAR, falling off to none at FIRE_REACH), which bodyTick feels, and close up
// it dries the forager (FIRE_DRY), rain or not. It's the meadow's strongest warmth: a winter night by a fed fire is cosy,
// a night away from one still dangerous. Nothing here draws the meadow's random numbers. A meadow kept before fires has
// none (unpackWorld), no KEEP_VERSION bump.
const FIRE_STICK = TPD / 14;            // ticks a stick burns (51 s at 1x): a new fire's five, dusk to about dawn
const FIRE_MOST = 6 * FIRE_STICK;       // it takes no more on than this (a night, dry: rain and storms burn it faster)
const FIRE_LOW = 1.5 * FIRE_STICK;      // with less than this left it burns low: smaller and less warm
const FIRE_EMBERS = TPD / 10;           // ticks its embers glow once it's burnt out (a minute and a bit at 1x)
const FIRE_WET = { rain: 1.4, storm: 2, snow: 1.25 };   // it burns this much faster in the wet
const FIRE_WARM = 24;                   // degrees it warms the forager within FIRE_NEAR tiles, burning well
const FIRE_NEAR = 1, FIRE_REACH = 5;    // tiles: all of it within the first, falling off (squared) to none at the second
const FIRE_DRY = 8;                     // a day: how fast it dries the forager close up (soaked to dry in an eighth of a day)
const FIRE_GAP = 1.2;                   // tiles a fire keeps from another fire, a trunk, a rock or a burrow
const FIRE_LOOK = 30;                   // ticks between looks for water over a fire

// Every field a fire ever has (see blankCreature). fuel: ticks of burning in the sticks on it; lit: burning; embers: ticks
// its embers glow on, once burnt out; tinder: tinder in it, to catch a spark; litAt: the tick it was last lit; ash: how
// much it has burnt (0 new to 1), for its look.
const fireOf = (x, y, born) => ({ fire: true, x, y, born, fuel: -0, lit: false, embers: -0, tinder: false, litAt: -1, ash: -0 });

// Whether a fire can be laid at x, y: '' if it can, else why not, in a few words (game.js says it).
function fireSpot(w, x, y) {
  if (!inBounds(x, y) || x < 2 || y < 2 || x > W - 2 || y > H - 2) return 'Too near the edge';
  const i = idx(x, y);
  if (w.water[i] && !w.frozen) return 'Not in the water';
  if (w.water[i]) return 'Not on the ice';
  for (const F of w.fires) if (Math.hypot(F.x - x, F.y - y) < FIRE_GAP * 1.5) return 'There\'s a fire here';
  rocksFor(w);
  for (let k = 0; k < solidR.length; k += 3) if (Math.hypot(solidR[k] - x, solidR[k + 1] - y) < solidR[k + 2] + FIRE_GAP * 0.4) return 'A rock\'s in the way';
  let trunk = false;
  forEachDecorNear(w, x, y, 2, d => { if (standing(d) && d.size >= SEEDLING && Math.hypot(d.x - x, d.y - y) < FIRE_GAP * (0.5 + 0.15 * Math.min(d.size, 3))) trunk = true; });
  if (trunk) return 'Too close to the tree';
  for (const b of w.brambles) if (b.size > 0 && Math.hypot(b.x - x, b.y - y) < FIRE_GAP + 0.3 * b.size) return 'Too close to the brambles';
  for (const b of w.burrows) if (Math.hypot(b.x - x, b.y - y) < FIRE_GAP) return 'On a burrow';
  return '';
}
// Lays one at x, y with sticks and tinder in it (game.js has taken them out of the satchel), unlit. Returns it.
function layFire(w, x, y, sticks, tinder) {
  const F = fireOf(x, y, w.tick);
  F.fuel = Math.min(FIRE_MOST, sticks * FIRE_STICK); F.tinder = tinder > 0;
  w.fires.push(F);
  emit(w, { type: 'firelaid', fire: F });
  return F;
}
// How many more sticks it takes.
const fireRoom = F => Math.max(0, Math.ceil((FIRE_MOST - F.fuel) / FIRE_STICK - 0.25));
// Puts sticks on it (and tinder, which a cold one needs to light). Returns how many it took.
function feedFire(w, F, sticks, tinder) {
  const n = Math.min(sticks, fireRoom(F));
  F.fuel = Math.min(FIRE_MOST, F.fuel + n * FIRE_STICK);
  if (tinder) F.tinder = true;
  if (n || tinder) emit(w, { type: 'firefed', fire: F, n });
  return n;
}
// Whether a spark and a blow would light it: sticks on it, and tinder or embers to catch.
const lightable = F => !F.lit && F.fuel > 0 && (F.tinder || F.embers > 0);
// The forager blew on the spark, or the embers, till it caught (game.js): it burns.
function lightFire(w, F) {
  if (!lightable(F)) return false;
  F.lit = true; F.tinder = false; F.embers = 0; F.litAt = w.tick;
  emit(w, { type: 'firelit', fire: F });
  return true;
}
// Every tick: the lit ones burn their sticks down (faster in the wet), the embers of a burnt out one go grey, and water over
// one puts it out.
function fireTick(w) {
  const wet = FIRE_WET[w.weather.kind] || 1, look = w.tick % FIRE_LOOK === 0;
  for (const F of w.fires) {
    if (F.lit) {
      F.fuel -= wet;
      F.ash = Math.min(1, F.ash + wet / (6 * FIRE_STICK));
      if (F.fuel <= 0) { F.fuel = 0; F.lit = false; F.embers = FIRE_EMBERS; emit(w, { type: 'fireout', fire: F }); }
    } else if (F.embers > 0) {
      F.embers = Math.max(0, F.embers - wet);
      if (!F.embers) emit(w, { type: 'firecold', fire: F });
    }
    if (look && w.water[idx(F.x, F.y)] && !w.frozen && (F.lit || F.embers || F.tinder)) {   // (the flood over it)
      F.lit = false; F.embers = 0; F.tinder = false;
      emit(w, { type: 'firedoused', fire: F });
    }
  }
}
// How well it burns, 0 (cold) to 1: a fed fire 1, smaller as its last sticks go, embers a dull glow going grey.
const fireHeat = F => (F.lit ? 0.45 + 0.55 * clamp(F.fuel / FIRE_LOW, 0, 1) : F.embers > 0 ? 0.3 * F.embers / FIRE_EMBERS : 0);
// How many degrees the fires warm x, y (the nearest, warmest one), and how close to one it is (fireNear, 0 to 1).
let fireNear = 0;
function fireWarmth(w, x, y) {
  let warm = 0;
  fireNear = 0;
  for (const F of w.fires) {
    const h = fireHeat(F);
    if (!h) continue;
    const dx = F.x - x, dy = F.y - y;
    if (dx > FIRE_REACH || dx < -FIRE_REACH || dy > FIRE_REACH || dy < -FIRE_REACH) continue;
    const d = Math.hypot(dx, dy);
    if (d >= FIRE_REACH) continue;
    const k = d <= FIRE_NEAR ? 1 : 1 - (d - FIRE_NEAR) / (FIRE_REACH - FIRE_NEAR), v = FIRE_WARM * h * k * k;
    if (v > warm) { warm = v; fireNear = k * k * h; }
  }
  return warm;
}

// ---------------------------------------------------------------- gathering
//
// The forager picks what the meadow grows, for real: a clump of mushrooms picked is gone, a bramble has fewer berries
// left for the crows and the foxes, a patch of greens gives a little and grows back, a windfall picked up is one the
// rabbits don't get, and honey taken is out of the hive's store. game.js walks it there and calls gather once it's
// arrived; whatThere says beforehand what a thing would give (for the hover), or why not. Things: 'shroom' (a clump in
// w.shrooms), 'find' (w.finds), 'dropped' (w.dropped: what it let fall), 'green' (w.greens), 'bramble' (w.brambles), 'tree' (a cherry on it in summer, windfall apples, acorns or
// beechnuts under it in autumn) and 'hive'. What it gives goes in the satchel (w.forager.bag): ingredient ids as
// recipes.js has them, STACK of a kind to a slot.
const GREEN_TAKE = 0.34;                // of a patch of greens a pick takes (a third: three picks and it's picked for now)
const GREEN_GIVES = 3;                  // and the leaves it gives, one more off a big patch (g.size 2)
const GREEN_REGROW = 0.25;              // and grows back a day
// Whether a patch is picked for now: a pick more would take more than is there (a little over, so three picks fit).
const greenPicked = g => g.pick + GREEN_TAKE > 1.05;
const BERRY_PICK = 6;                   // blackberries a pick gives,
const BERRY_COST = 6;                   // each this much of a bramble's berries as the crows count them (BERRY_CROP)
const CHERRY_CROP = 24;                 // cherries a tree in full crop gives the forager in a summer (two fifths of it with no bees: d.crop)
const CHERRY_PICK = 6;                  // and a pick
const CHERRY_TO = 0.7;                  // ripe from the start of summer to this far into it (game.js hangs them so long)
const cherryCrop = d => Math.round(CHERRY_CROP * (0.4 + 0.6 * d.crop));
const cherryLeft = (w, d) => cherryCrop(d) - (d.pickYear === yearOf(w.tick) ? d.picked : 0);
// How many quarters of a full hang of cherries a tree shows (game.js paints them so): 4 untouched, fewer as the forager
// picks, 0 picked clean, and none while they aren't there to pick (out of season, past CHERRY_TO, too young to fruit).
function cherryShow(w, d) {
  if (seasonOf(w.tick) !== 1 || springPart(w.tick) >= CHERRY_TO || !bearing(w, d)) return 0;
  return Math.max(0, Math.ceil(4 * cherryLeft(w, d) / cherryCrop(d)));
}
const FALL_PICK = 2;                    // windfalls under a tree a pick takes up
const FALL_GIVES = { apple: 2, acorns: 4, beechnuts: 4 };   // and what each is in the satchel (a rabbit's windfall is a big meal)
const HONEY_TAKE = 8;                   // of a hive's honey (HIVE_FULL) a pick takes,
const HONEY_GIVES = 2;                  // the honey that is in the satchel,
const HONEY_KEEP = [24, 34, 40, 40];    // and it never takes the store below this, by season: in spring the bees bring nectar in and
                                        // eat little of the store; in summer they put by for winter; from autumn, more than a big colony eats in a winter
// The honey a hive could spare: what's over the store the bees keep (HONEY_KEEP), in picks (game.js oozes it over the sill).
const honeySpare = (w, h) => h.cluster ? 0 : Math.max(0, Math.floor((h.honey - HONEY_KEEP[seasonOf(w.tick)]) / HONEY_TAKE));

// What a thing has to give now: { id, n } (n > 0), or { why } saying gently why not. (No change to anything.)
const there = { id: '', n: 0, why: '', cost: -0 };
function whatThere(w, kind, it) {
  there.id = ''; there.n = 0; there.why = ''; there.cost = 0;
  const s = seasonOf(w.tick), p = springPart(w.tick);
  if (kind === 'shroom' || kind === 'find' || kind === 'dropped') {
    there.id = it.kind;
    if (!(kind === 'shroom' ? w.shrooms : kind === 'find' ? w.finds : w.dropped).includes(it)) there.why = 'Gone over';
    else there.n = it.n;
  } else if (kind === 'green') {
    const stage = greenStage(w, it);
    there.id = it.kind;
    if (stage === null) there.why = 'Nothing up yet';
    else if (stage === 2) there.why = it.kind === 'garlic' ? 'Dying back' : 'Gone brown and tough';
    else if (greenPicked(it)) there.why = 'Picked for now: it grows back';
    else { there.n = GREEN_GIVES + (it.size === 2 ? 1 : 0); there.cost = GREEN_TAKE; }
  } else if (kind === 'bramble') {
    const stage = brambleStage(w, it);
    there.id = 'blackberry';
    if (stage === 4) {
      const n = Math.min(BERRY_PICK, Math.floor(it.berries / BERRY_COST));
      if (n > 0) { there.n = n; there.cost = n * BERRY_COST; } else there.why = 'Picked clean';
    } else there.why = stage === 5 ? 'Gone over' : stage === 3 ? 'Not ripe yet' : it.size === 0 ? 'Too young to fruit' : stage === 2 ? 'In flower: berries late in summer' : 'No berries till late summer';
  } else if (kind === 'tree') {
    const d = it, mast = TREES[d.kind] && TREES[d.kind].mast;
    if (d.kind === 'cherry') {
      there.id = 'cherry';
      if (!bearing(w, d)) there.why = standing(d) ? 'Too young to fruit' : '';
      else if (s !== 1 || p >= CHERRY_TO) there.why = s === 0 ? 'Not ripe yet' : 'No cherries till next summer';
      else {
        const left = cherryLeft(w, d);
        if (left > 0) { there.n = Math.min(CHERRY_PICK, left); there.cost = there.n; } else there.why = 'Picked clean';
      }
    } else if (d.kind === 'apple' || mast) {
      there.id = d.kind === 'apple' ? 'apple' : mast;
      if (!bearing(w, d)) there.why = standing(d) ? 'Too young to fruit' : '';
      else if (d.windfall > 0) { there.cost = Math.min(FALL_PICK, d.windfall); there.n = there.cost * FALL_GIVES[there.id]; }
      else if (s === 2 && p < 0.4 && (d.kind === 'apple' || w.mast)) there.why = 'Nothing fallen yet';
      else if (s === 2 && (d.kind === 'apple' || w.mast)) there.why = 'Picked clean';
      else if (s === 2 && mast) there.why = 'Not a mast year: hardly any ' + mast;
      else there.why = d.kind === 'apple' ? (s === 1 ? 'Not ripe yet' : 'Windfalls come in autumn') : `${mast[0].toUpperCase() + mast.slice(1)} fall in autumn`;
    }
  } else if (kind === 'hive') {
    there.id = 'honey';
    if (it.cluster) there.why = 'A swarm: leave it be';
    else if (!honeySpare(w, it)) there.why = it.queen ? 'The bees need what\'s left' : 'Hardly any honey left';
    else { there.n = HONEY_GIVES; there.cost = HONEY_TAKE; }
  }
  return there;
}

// How many of id the satchel has room for.
function roomFor(f, id) {
  let n = 0;
  for (let k = 0; k < SLOTS; k++) n += f.bag[k] === id ? STACK - f.bagN[k] : f.bag[k] === '' ? STACK : 0;
  return n;
}
// Puts n of id in the satchel: onto its stacks first, then the first empty slots. Returns the slots it went in (for
// game.js to fly them to).
function stow(f, id, n) {
  const into = [];
  for (let pass = 0; pass < 2 && n > 0; pass++) for (let k = 0; k < SLOTS && n > 0; k++) {
    if (pass === 0 ? f.bag[k] !== id || f.bagN[k] >= STACK : f.bag[k] !== '') continue;
    const m = Math.min(n, STACK - f.bagN[k]);
    f.bag[k] = id; f.bagN[k] += m; n -= m; into.push(k);
  }
  return into;
}
// How many of id the satchel holds.
function bagCount(f, id) {
  let n = 0;
  for (let k = 0; k < SLOTS; k++) if (f.bag[k] === id) n += f.bagN[k];
  return n;
}
// Takes n of id out of the satchel (for a fire: game.js, by recipes.js's BUILDS), from its smallest stacks first, so the
// fewest slots are left part full. Returns how many it took.
function spend(f, id, n) {
  let took = 0;
  while (took < n) {
    let k = -1;
    for (let j = 0; j < SLOTS; j++) if (f.bag[j] === id && (k < 0 || f.bagN[j] < f.bagN[k])) k = j;
    if (k < 0) break;
    const m = Math.min(n - took, f.bagN[k]);
    f.bagN[k] -= m; took += m;
    if (!f.bagN[k]) f.bag[k] = '';
  }
  return took;
}
// Calls fn(kind, it) for everything that has something to give now (whatThere's n > 0): for game.js's glints and the
// edge arrow, a few times a second, and for counting. What lies on the ground for a fire (FINDS ground) isn't food and
// doesn't glint, so it's not here.
function eachPickable(w, fn) {
  for (const m of w.shrooms) fn('shroom', m);
  for (const f of w.finds) if (!FINDS[f.kind].ground) fn('find', f);
  for (const g of w.greens) if (whatThere(w, 'green', g).n) fn('green', g);
  for (const b of w.brambles) if (b.berries >= BERRY_COST && whatThere(w, 'bramble', b).n) fn('bramble', b);
  for (const d of w.decor) if (d.tree && (d.kind === 'cherry' || d.kind === 'apple' || TREES[d.kind]?.mast) && whatThere(w, 'tree', d).n) fn('tree', d);
  for (const h of w.hives) if (whatThere(w, 'hive', h).n) fn('hive', h);
}

// What the forager drops out of the satchel lies on the ground where it stood (w.dropped, one layout, dropOf), to be
// picked up again ('dropped' to whatThere and gather), and is gone after DROP_DAYS (sooner if the water comes over it).
// Dropped on a pile of its own kind it goes on the pile. kind: an ingredient id; born, until: ticks; n: how many.
const DROP_DAYS = 0.5;                  // a day is 12 minutes at 1x: six minutes
const DROP_EVERY = TPD / 720;           // ticks between looks for ones gone (two minutes; a second at 1x)
const DROP_PILE = 0.6;                  // tiles from a pile of its kind that one dropped goes on it
const dropOf = (kind, x, y, born, until, n) => ({ dropped: true, kind, x, y, born, until, n });
// Empties slot k onto the ground just in front of the forager, each one a little along from the last so they don't land on each other.
// Returns what's on the ground now (the pile it went on, or a new one), or null with nothing in the slot.
function dropSlot(w, k) {
  const f = w.forager, kind = f.bag[k], n = f.bagN[k];
  f.bag[k] = ''; f.bagN[k] = 0;
  if (!kind) return null;
  const until = w.tick + Math.round(DROP_DAYS * TPD);
  for (const d of w.dropped) if (d.kind === kind && (d.x - f.x) ** 2 + (d.y - f.y) ** 2 < DROP_PILE * DROP_PILE) {
    d.n += n; d.until = until;
    return d;
  }
  const a = Math.PI * (0.2 + 0.6 * ((w.dropped.length * 0.38) % 1));   // (in front of it, where it shows, the next one along from the last)
  let x = f.x + Math.cos(a) * 0.6, y = f.y + 0.15 + Math.sin(a) * 0.35;
  if (!walkable(w, x, y)) { x = f.x; y = f.y; }
  const d = dropOf(kind, x, y, w.tick, until, n);
  w.dropped.push(d);
  return d;
}
// What another forager dropped (game.js, playing together): on a pile of its kind there, or a new one, as dropSlot left it.
function dropAt(w, kind, x, y, n, born, until) {
  for (const d of w.dropped) if (d.kind === kind && (d.x - x) ** 2 + (d.y - y) ** 2 < 1e-4) { d.n += n; d.until = until; return d; }
  const d = dropOf(kind, x, y, born, until, n);
  w.dropped.push(d);
  return d;
}
// Every DROP_EVERY: those past their time, or under deep water, go.
function droppedTick(w) {
  const list = w.dropped;
  let n = 0;
  for (const d of list) if (w.tick < d.until && w.water[idx(d.x, d.y)] !== DEEP) list[n++] = d;
  list.length = n;
}
// Moves slot a's things to slot b: onto b's stack if it's the same kind (what doesn't fit stays in a), else the two swap.
function moveSlot(f, a, b) {
  if (a === b || !f.bag[a]) return;
  if (f.bag[b] === f.bag[a]) {
    const m = Math.min(f.bagN[a], STACK - f.bagN[b]);
    f.bagN[b] += m; f.bagN[a] -= m;
    if (!f.bagN[a]) f.bag[a] = '';
  } else {
    const id = f.bag[b], n = f.bagN[b];
    f.bag[b] = f.bag[a]; f.bagN[b] = f.bagN[a]; f.bag[a] = id; f.bagN[a] = n;
  }
}

// Picks it: takes from the sim and puts it in the satchel. Returns { id, n, into } (n 0 with why 'full' when the satchel
// has no room: then nothing is taken), or { why } as whatThere.
function gather(w, kind, it) {
  const f = w.forager, t = whatThere(w, kind, it);
  if (!t.n) return { id: t.id, n: 0, why: t.why, into: [] };
  const room = roomFor(f, t.id);
  if (!room) return { id: t.id, n: 0, why: 'full', into: [] };
  const id = t.id, n = takeFrom(w, kind, it, room);
  const into = stow(f, id, n);
  return { id, n, why: '', into };
}
// Takes up to most of what's there out of the sim, and says how many (gather; and another forager's pick, game.js).
// Only part of it taken costs that part, and the rest of a clump of mushrooms stays where it is.
function takeFrom(w, kind, it, most) {
  const t = whatThere(w, kind, it);
  if (!t.n) return 0;
  const n = Math.min(t.n, most), part = n / t.n, id = t.id;
  if (kind === 'shroom' || kind === 'find' || kind === 'dropped') {
    const list = kind === 'shroom' ? w.shrooms : kind === 'find' ? w.finds : w.dropped, k = list.indexOf(it);
    if (n < t.n) { it.n -= n; } else if (k >= 0) list.splice(k, 1);
  } else if (kind === 'green') it.pick += t.cost * part;
  else if (kind === 'bramble') it.berries = Math.max(0, it.berries - t.cost * part);
  else if (kind === 'tree' && it.kind === 'cherry') {
    if (it.pickYear !== yearOf(w.tick)) { it.pickYear = yearOf(w.tick); it.picked = 0; }
    it.picked += n;
  } else if (kind === 'tree') {
    const falls = Math.ceil(n / FALL_GIVES[id]);
    it.windfall -= falls; w.windfalls -= falls;
  } else if (kind === 'hive') it.honey -= t.cost * part;
  return n;
}

// ---------------------------------------------------------------- the world

// The world's fields that come later, or only to some meadows, all made at the start (createWorld, unpackWorld), so the
// world is laid out the same from its first tick to its last (see blankCreature: one added mid-game, or a whole number
// turning a fraction, left the sim's busiest code slow for good; snow, ice and the counts start as -0 for that).
const LATER = {
  appleYear: 0, namePools: null, recount: false,
  dug: null, ponds: null, hedges: null, visitors: null, visited: null, visitGone: false, visitId: 0,   // the places visitors come to, and who's come
  forager: null,                                                                                    // the player (startForager)
};
// A kept meadow's fractions come back as whole numbers where they were (0, 1): made fractions again, so they can't
// change the layout later (an object's field that holds a fraction once holds any number after).
function asFractions(o, keys) { for (const k of keys) { const v = o[k]; o[k] = 0.5; o[k] = v; } }

// A new meadow opens this many days into spring: the trees in leaf and blossom, the garlic up, cherries a few days off (its
// first dawn was bare trees and nothing to pick). It opens late in the afternoon (START_PHASE, of the day from sunrise), in a
// storm that blows over as the light goes (STORM_TO), into a clear cold night and the morning after (CLEAR_TO). The forager
// arrives cold and wet (ARRIVE_WARMTH, ARRIVE_WET, foragerArrives), with time to gather for a fire before dark and none to
// sightsee: walking about it's chilly by dusk and cold through the night, and collapses towards dawn if it's wet; standing
// still it's cold by dusk and collapses at dawn (4 seeds).
const START_DAY = 3;
const START_PHASE = 0.44, STORM_TO = 0.555, CLEAR_TO = 1.3;
const ARRIVE_WARMTH = 0.78, ARRIVE_WET = 0.75;
const STORM_END = Math.floor(TPD * (START_DAY + STORM_TO)), CLEAR_END = Math.floor(TPD * (START_DAY + CLEAR_TO));
// Whether the meadow is still in its opening storm.
const openingStorm = w => w.tick < STORM_END && w.weather.kind === 'storm';
// A forager coming into the meadow (a new one's, or a friend's joining it): cold and wet in the opening storm, else fresh.
function foragerArrives(w, f) {
  const storm = openingStorm(w);
  f.warmth = storm ? ARRIVE_WARMTH : 1; f.wet = storm ? ARRIVE_WET : 0;
  f.stamina = 1; f.winded = false; f.down = -1; f.stumble = 0;
}

function createWorld(seed, opts = {}) {
  const w = {
    seed, rng: makeRng(seed), tick: Math.floor(TPD * (START_DAY + START_PHASE)),
    nextId: 1, creatures: [], newborn: [], byId: new Map(), events: [],
    grid: makeGrid(), grids: perKind(makeGrid),
    nameCounts: new Map(), anyDied: false,
    weather: { kind: 'clear', until: 0 }, wet: 0.3, snow: -0, ice: -0, frozen: false, windfalls: 0,
    silt: new Float32Array(W * H),
    rich: new Float32Array(W * H), shadedFert: new Float32Array(W * H),   // (see groundTick)
    frogs: new Float32Array(W * H), spawn: new Float32Array(W * H), frogCount: -0, spawnCount: -0, frogsOut: true,   // (see frogsTick; damp: tiles to the water, as of the tick dampAt)
    damp: new Float32Array(W * H), dampOf: -1, dampAt: 0, spawnSpots: new Int32Array(SPAWN_SPOTS).fill(-1), spawnTiles: new Int32Array(W * H), spawnN: 0,
    frogYear: { year: 0, at: -1, grown: 0, laid: 0, spawners: 0, stranded: 0, eaten: 0, left: 0, told: 0, dryDay: -1 },   // this spring's spawn, and how it went
    fish: new Float32Array(W * H), fishCount: -0,                         // (see fishTick)
    carcasses: [], roost: null, cached: 0,                                // (see carrionTick and crowTick; cached: this autumn)
    shrooms: [], shroomRng: makeRng(seed ^ 0x5a2004), rainAt: -1e9,      // (see shroomsTick; rainAt: the last hour it rained)
    greens: [], greenRng: makeRng(seed ^ 0x9a271c),                       // (see greensTick)
    finds: [], findRng: makeRng(seed ^ 0xf1d5ea),                         // (see findsTick)
    dropped: [],                                                          // (see dropSlot)
    fires: [],                                                            // (see fireTick)
    brambles: [], pips: [], brambleRng: makeRng(seed ^ 0xb4a3b1),          // (see bramblesTick)
    count: perKind(() => 0), expecting: perKind(() => 0),
    stats: { deaths: perKind(() => ({})) },                                 // deaths by cause, of each kind
    goneSince: perKind(() => -1), diedOut: perKind(() => false), hives: [],
    // The trees (see treesTick). They have their own random numbers, so the rest of the meadow comes out as it did before they grew.
    treeRng: makeRng(seed ^ 0x5eed7ee), nextTree: 1, seeds: [], mast: false, mastYear: 0, orchard: [], treeCount: 0,
    blossoms: [], blossomCells: Array.from({ length: GW * GH }, () => []), nextBloom: 0, decorCells: [], treesMoved: true,
    bitten: new Int32Array(W * H), sprouted: 0,
    options: { migration: true, ...opts },
    ...LATER,
  };
  makeTerrain(w);
  for (let k = Math.max(1, Math.round(HIVES * w.room)); k > 0; k--) placeHive(w);
  w.treeRoom = TREE_ROOM * w.decor.filter(d => d.tree).length;
  startTrees(w);
  groundTick(w);
  startFrogs(w);
  startFish(w);
  startGreens(w);
  startBrambles(w);
  w.forager = startForager(w);
  startFinds(w);
  w.roost = pickRoost(w);
  const n = { rabbit: opts.rabbits ?? Math.round(30 * w.room), fox: opts.foxes ?? Math.round(4 * w.room), bee: 0, crow: opts.crows ?? Math.round(8 * w.room),
    otter: opts.otters ?? 0 };   // the otters come up the water (migrate), and each hive has its bees
  for (const h of w.hives) {                                  // each colony's bees, of all ages, so they don't all wear out at once
    for (let k = 0; k < START_BEES; k++) {
      const c = makeCreature(w, 'bee', h.x, h.y, null);
      c.home = h; c.queen = h.queen; c.hidden = c.sleeping = true; c.mode = 'sleep';
      c.born = w.tick - w.rng.range(SPECIES.bee.matureDays, 0.7 * SPECIES.bee.lifeDays) * TPD;
      note(w, c, '🐝', `One of Queen ${h.queen.name}'s bees`);
      w.newborn.push(c); w.byId.set(c.id, c);
    }
  }
  for (const species of KINDS) {
    for (let k = 0; k < n[species]; k++) {
      let x, y;
      do { x = w.rng.range(4, W - 4); y = w.rng.range(4, H - 4); } while (!dry(w, x, y));
      const age = SPECIES[species].matureDays * w.rng.range(1, 1.8);   // grown, all of them
      const c = addCreature(w, species, x, y, { sex: k % 2 ? 'M' : 'F', age });
      if (c && species === 'rabbit' && k === 0) { c.name = 'Juni'; w.nameCounts.set('rabbit:Juni', 1); }
    }
  }
  flushNewborn(w);
  for (const f of w.fields) if (f.season === seasonOf(w.tick)) f.bloomed = yearOf(w.tick);   // no news of what's out already
  hivesTick(w);
  w.weather = { kind: 'storm', until: STORM_END };            // (the opening storm)
  foragerArrives(w, w.forager);
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

function newDay(w) {
  const d = dayOf(w.tick);
  if (d % SEASON_DAYS === 0) {
    const s = seasonOf(w.tick);
    emit(w, { type: 'season', season: s, year: yearOf(w.tick) });
    if (!WEATHER_ODDS[s][w.weather.kind]) pickWeather(w);      // no snow in spring
    if (s === 0) {
      for (const c of w.creatures) {
        if (c.alive && c.born < w.tick - SEASON_DAYS * TPD) note(w, c, '🌸', 'Made it through the winter');
      }
    }
    if (s === 1) setFruit(w);
    if (s === 2) seedFall(w);
    if (s === 3 && w.cached) emit(w, { type: 'buried', n: w.cached });   // the crows' autumn
  }
  treesTick(w);
  groundTick(w);
  if (!w.roost || !perchable(w.roost)) w.roost = pickRoost(w);   // gone, or bees moved in
  holtsDay(w);
  if (w.visitors) placesDay(w);                              // (what each place a visitor comes to is like)
}

// ---------------------------------------------------------------- moving in

// The gentle respawn: with fewer than FEW of a kind (times w.room), a few more wander in once they've been few for
// COME_AFTER days, and a few more after as long again while they're still few. So neither the foxes nor, one day, the
// player's hunting can empty the meadow, and a low still shows. Bees come as a wild swarm once no colony is left
// (swarmArrives), after COME_AFTER.bee days, while the flowers are out.
const FEW = { rabbit: 15, fox: 2, crow: 4, otter: 2 };
const COME_AFTER = { rabbit: 1, fox: 3, crow: 3, otter: 3, bee: 2 };
const ARRIVE = { rabbit: 4, fox: 2, crow: 3, otter: 2 };
const FOX_FOOD = 30;            // foxes only come to a meadow with this many rabbits (times w.room)
function migrate(w) {
  // The last one gone is told once, however slowly they went (otters that never came aren't gone), and again if
  // they come back and die out again. Migration or none.
  for (const s of KINDS) {
    if (w.count[s] > 0) w.diedOut[s] = false;
    else if (!w.diedOut[s] && Object.keys(w.stats.deaths[s]).length) {
      w.diedOut[s] = true;
      emit(w, { type: 'extinct', species: s });
    }
  }
  if (!w.options.migration) return;
  for (const s of KINDS) {
    if (s === 'bee') {                                           // a wild swarm, when no colony is left and the flowers are out
      if (w.hives.some(h => h.queen)) { w.goneSince.bee = -1; continue; }
      if (w.goneSince.bee < 0) { w.goneSince.bee = w.tick; continue; }
      if (w.tick - w.goneSince.bee >= COME_AFTER.bee * TPD && w.flowers >= FEW_FLOWERS) { swarmArrives(w); w.goneSince.bee = -1; }
      continue;
    }
    const n = s === 'otter' && !w.decor.some(d => d.holt) ? 0 : w.count[s];   // (otters with no holt are only passing through)
    if (n >= (s === 'rabbit' ? FEW[s] * w.room : FEW[s])) { w.goneSince[s] = -1; continue; }
    if (w.goneSince[s] < 0) { w.goneSince[s] = w.tick; continue; }
    if (w.tick - w.goneSince[s] < COME_AFTER[s] * TPD) continue;
    if (s === 'fox' && w.count.rabbit < FOX_FOOD * w.room) continue;
    if (s === 'otter' && (w.frozen || w.tick % TPD)) continue;     // (looked into once a day)
    const holt = s === 'otter' && holtTree(w), up = holt && otterWay(w, holt);
    if (s === 'otter' && !up) continue;                           // and a pair of otters up the water, to a free holt
    const side = w.rng.int(0, 3);
    const kids = [];
    for (let k = 0; k < ARRIVE[s]; k++) {
      let x, y, tries = 0;
      do {
        const u = w.rng.range(4, (side % 2 ? H : W) - 4);
        [x, y] = side === 0 ? [u, 2] : side === 1 ? [W - 2, u] : side === 2 ? [u, H - 2] : [2, u];
        if (s === 'otter') { x = up.x; y = up.y; break; }                                        // the otters swim in
      } while (!dry(w, x, y) && ++tries < 50);
      const c = addCreature(w, s, x, y, { sex: k % 2 ? 'M' : 'F', age: SPECIES[s].matureDays + 1, arrived: true });
      if (c) kids.push(c);
      if (c && holt && c.sex === 'F') moveInHolt(w, c, holt);                                     // she came for it
    }
    w.goneSince[s] = -1;
    if (kids.length) emit(w, { type: 'arrive', species: s, who: kids });
  }
}

function step(w) {
  const t = ++w.tick;
  if (t % TPD === 0) newDay(w);
  buildGrid(w);
  weatherTick(w);
  if (w.fires.length) fireTick(w);
  bodyTick(w);
  foragerTick(w);
  if (t % GRASS_EVERY === 0) { growGrass(w, GRASS_EVERY); iceTick(w, GRASS_EVERY); }
  if (t % WATER_EVERY === 0) waterTick(w);
  if (t % FROG_EVERY === FROG_EVERY / 4) frogsTick(w);
  if (t % FISH_EVERY === FISH_EVERY * 3 / 4) fishTick(w);
  if (t % HIVES_EVERY === 0) hivesTick(w);
  if (t % CARRION_EVERY === 0) carrionTick(w);
  if (t % SHROOM_EVERY === SHROOM_EVERY / 2) shroomsTick(w);
  if (t % GREENS_EVERY === GREENS_EVERY / 8) greensTick(w);
  if (t % FIND_EVERY === FIND_EVERY / 3) findsTick(w);
  if (t % DROP_EVERY === 0 && w.dropped.length) droppedTick(w);
  if (t % BRAMBLE_EVERY === BRAMBLE_EVERY / 4) bramblesTick(w);
  if (t % WINDFALL_EVERY === 0) { windfallTick(w); if (w.weather.kind === 'storm') windthrow(w); }
  const list = w.creatures;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c.alive) continue;
    if (c.species === 'rabbit') rabbitTick(w, c);
    else if (c.species === 'fox') foxTick(w, c);
    else if (c.species === 'bee') beeTick(w, c);
    else if (c.species === 'crow') crowTick(w, c);
    else if (c.species === 'otter') otterTick(w, c);
    if (c.alive && c.sp.swims) drift(w, c);
    if (c.alive) lifeTick(w, c);
  }
  if (w.anyDied) { w.creatures = w.creatures.filter(c => c.alive); w.anyDied = false; }
  if (w.visitors) visitorsTick(w);                           // (?keep: a hedgehog at a hedge, a heron at a pond)
  flushNewborn(w);
  if (t % (TPD / 4) === 0) migrate(w);
  if (t % TPD === 0) { forgetTheLongDead(w); collapseBurrows(w); }
}

function forgetTheLongDead(w) {
  // Keep the dead for a few in-game years so family links still resolve, then let go.
  const horizon = w.tick - 3 * YEAR_DAYS * TPD;
  for (const [id, c] of w.byId) if (!c.alive && c.died < horizon) w.byId.delete(id);
}

// ---------------------------------------------------------------- keeping a meadow
//
// A meadow is kept between visits (game.js, keepMeadow): packWorld turns it into plain data the
// browser can store, unpackWorld brings it back. The world is a web of objects pointing at each
// other (a rabbit at its burrow, a hive at its tree), so each object goes once into a flat list and
// a pointer to it is {$: its place}. The tables in this file (SPECIES and the like) are pointed at by
// name, {$t: 'SPECIES.fox'}, so a kept meadow plays by the rules of the day. The random numbers go as
// where they'd got to. The neighbour grids and the events stay out, and are made again.
// A change a kept meadow can't take (a new field the code counts on, on the world, a creature, a hive
// or a tree) bumps KEEP_VERSION, and kept meadows start over.
const KEEP_VERSION = 10;                // 2: shade and rich ground (w.shadedFert, w.rich); 3: voles (w.voles); 4: the sickness (c.sick, c.immune, the resist gene);
                                        // 5: crows and remains (w.carcasses, w.roost, c.caches, d.nuts); 6: owls (d.owl, c.perch);
                                        // 7: frogs (w.frogs, w.spawn, w.frogYear, c.frogs); 8: the cooking cut (no keeper, owls, fire or player powers);
                                        // 9: the pantry (no voles, sickness, remains or genes; hives that fill; the 12-minute day);
                                        // 10: some ecology back (remains and rich ground again: w.carcasses, w.rich; winter coats: c.moult; bee colonies: h.queen, h.cluster...; mushrooms: w.shrooms, w.rainAt; spring greens: w.greens; brambles: w.brambles, w.pips, c.pips)
const TABLES = { SPECIES, FIELD_KINDS, TREE_MIX, TREES, SEASONS, WEATHER };
const UNKEPT = ['grid', 'grids', 'events', 'newborn', 'current'];   // on the world
let tableNames = null;                                     // object -> 'SPECIES.fox', made the first time
// Of the dead (w.byId keeps them a few years), a kept meadow keeps only those still spoken of: parents
// (the family in the inspector), foxes (a rabbit's nemesis) and the lately gone (the news).
const remembered = (w, c) => c.alive || c.kids || c.species === 'fox' || w.tick - c.died < SEASON_DAYS * TPD;

function nameTables() {
  tableNames = new Map();
  const walk = (o, path) => {
    if (!o || typeof o !== 'object' || tableNames.has(o)) return;
    tableNames.set(o, path);
    for (const k of Object.keys(o)) walk(o[k], path + '.' + k);
  };
  for (const k of Object.keys(TABLES)) walk(TABLES[k], k);
}

function packWorld(w) {
  if (!tableNames) nameTables();
  const list = [w], place = new Map([[w, 0]]);
  const pack = v => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'function') throw new Error('packWorld: a function');
      return v;
    }
    const t = tableNames.get(v);
    if (t) return { $t: t };
    if (typeof v.next === 'function' && v.state) return { $r: v.state() };
    let n = place.get(v);
    if (n === undefined) { n = list.length; place.set(v, n); list.push(v); }
    return { $: n };
  };
  const out = [];
  for (let i = 0; i < list.length; i++) {             // the list grows as pointers turn up
    const o = list[i];
    let e;
    if (Array.isArray(o)) { e = new Array(o.length); for (let k = 0; k < o.length; k++) e[k] = pack(o[k]); }
    else if (ArrayBuffer.isView(o)) e = o.slice();                   // a copy: the browser may store it a moment later
    else if (o instanceof Map) { e = { $map: [] }; for (const [k, v] of o) if (o !== w.byId || remembered(w, v)) e.$map.push(pack(k), pack(v)); }
    else if (o instanceof Set) { e = { $set: [] }; for (const v of o) e.$set.push(pack(v)); }
    else {
      if (Object.getPrototypeOf(o) !== Object.prototype) throw new Error('packWorld: not plain data');
      e = {};
      for (const k in o) if (!(i === 0 && UNKEPT.includes(k))) e[k] = pack(o[k]);
    }
    out.push(e);
  }
  return { version: KEEP_VERSION, list: out };
}

// Null for a meadow kept by another version.
function unpackWorld(kept) {
  if (!kept || kept.version !== KEEP_VERSION) return null;
  const list = kept.list;
  const made = list.map(e => (Array.isArray(e) ? new Array(e.length) : ArrayBuffer.isView(e) ? e
    : e.$map ? new Map() : e.$set ? new Set() : e.sp !== undefined && e.species !== undefined ? blankCreature()   // (laid out like new ones)
    : e.tree === true ? blankTree() : e.emoji === '🪨' ? rockOf(-0, -0, -0) : e.shroom === true ? shroomOf('', -0, -0, null, 0, 0, 0, 0)
    : e.forager === true ? foragerOf(-0, -0) : e.find === true ? findOf('', -0, -0, 0, 0, 0, 0) : e.dropped === true ? dropOf('', -0, -0, 0, 0, 0) : e.green === true ? greenOf('', -0, -0, 0, 0) : e.bramble === true ? brambleOf(-0, -0, 0, '', 0)
    : e.fire === true ? fireOf(-0, -0, 0)
    : e.n !== undefined && e.i !== undefined && e.kind !== undefined && e.field !== undefined ? plantOf(-0, -0, 0, -0, null, 0) : {}));   // (a flower or blossom)
  const table = path => path.split('.').reduce((o, k) => {
    if (!o || !(k in o)) throw new Error('unpackWorld: no table ' + path);
    return o[k];
  }, TABLES);
  const value = v => (v === null || typeof v !== 'object' ? v
    : v.$ !== undefined ? made[v.$] : v.$t ? table(v.$t) : makeRng(v.$r));
  for (let i = 0; i < list.length; i++) {
    const e = list[i], o = made[i];
    if (Array.isArray(e)) for (let k = 0; k < e.length; k++) o[k] = value(e[k]);
    else if (ArrayBuffer.isView(e)) continue;
    else if (e.$map) for (let k = 0; k < e.$map.length; k += 2) o.set(value(e.$map[k]), value(e.$map[k + 1]));
    else if (e.$set) for (const v of e.$set) o.add(value(v));
    else for (const k in e) o[k] = value(e[k]);
  }
  const w = made[0];
  for (const k in LATER) if (!(k in w)) w[k] = LATER[k];
  asFractions(w, ['wet', 'snow', 'ice', 'level', 'frogCount', 'spawnCount', 'fishCount']);
  for (const h of w.hives) asFractions(h, ['x', 'y', 'honey', 'brood']);
  for (const b of w.burrows) asFractions(b, ['x', 'y', 'dug']);
  for (const k of w.carcasses) asFractions(k, ['x', 'y', 'meat', 'full']);
  if (!w.shrooms) { w.shrooms = []; w.shroomRng = makeRng(w.seed ^ 0x5a2004); w.rainAt = -1e9; }   // (kept on the cooking branch before them)
  for (const m of w.shrooms) asFractions(m, ['x', 'y']);
  if (!w.greens) { w.greens = []; w.greenRng = makeRng(w.seed ^ 0x9a271c); }      // (kept on the cooking branch before them)
  for (const g of w.greens) asFractions(g, ['x', 'y', 'pick']);
  const noFinds = !w.finds;                             // (kept before them: a new meadow's come up, below)
  if (noFinds) { w.finds = []; w.findRng = makeRng(w.seed ^ 0xf1d5ea); }
  for (const f of w.finds) asFractions(f, ['x', 'y']);
  if (!w.dropped) w.dropped = [];                       // (kept before things could be dropped)
  for (const d of w.dropped) asFractions(d, ['x', 'y']);
  if (!w.fires) w.fires = [];                           // (kept before fires)
  for (const F of w.fires) asFractions(F, ['x', 'y', 'fuel', 'embers', 'ash']);
  const noBrambles = !w.brambles;                       // (kept on the cooking branch before them: a new meadow's come up, below)
  if (noBrambles) { w.brambles = []; w.pips = []; w.brambleRng = makeRng(w.seed ^ 0xb4a3b1); }
  for (const b of w.brambles) asFractions(b, ['x', 'y', 'crop', 'berries']);
  for (const p of w.pips) asFractions(p, ['x', 'y', 'at']);
  w.grid = makeGrid(); w.grids = perKind(makeGrid); w.events = []; w.newborn = [];
  makeCurrent(w);
  if (w.visitors) placesDay(w);
  buildGrid(w);
  if (noBrambles) startBrambles(w);
  if (!w.forager) w.forager = startForager(w);            // (kept before the forager: it starts afresh)
  const F = w.forager;
  if (!F.homeX && !F.homeY) { F.homeX = F.x; F.homeY = F.y; }   // (kept before it had a home: where it is)
  asFractions(F, ['x', 'y', 'speed', 'heading', 'moved', 'goalX', 'goalY', 'warmth', 'wet', 'stamina', 'feel', 'homeX', 'homeY']);
  if (noFinds) startFinds(w);
  return w;
}

// ---------------------------------------------------------------- visitors
//
// (?keep) Now and then the keeper's work draws a visitor. One is a hedgehog: once a hedge is thick enough to hide
// in (h.young), one may come to it at dusk, spring to autumn (it sleeps the winter away somewhere else). A visitor isn't
// a creature: nothing hunts it, it eats nothing the meadow counts, and its chances are hashed from the day, not drawn
// from w.rng, so the meadow plays out the same with it or without. It comes in from a little way off (VISIT_FROM), stays
// VISIT_DAYS, curled up asleep at the foot of the hedge by day and pottering along it at night, snuffling for beetles,
// and goes back the way it came at dusk. The other is a heron, at a dug pond (below). w.visitors are the ones here now
// (one of a kind), w.visited how often each kind has come and the day the last one left. Events: 'visitor' as one comes,
// 'visitorleft' as it goes. One whose kind the player has never seen (game.js sets v.wait) stays on past its days till
// they've seen it, but never into winter.
const VISIT_FIRST = 0.5;        // the chance an evening (a morning, for a heron) of the first visit, once there's somewhere to come to
const VISIT_ODDS = 0.15;        // and of each one after
const VISIT_REST = SEASON_DAYS; // days after one leaves before another can come
const VISIT_DAYS = [3, 5];      // days it stays
const VISIT_FROM = 5;           // tiles off it comes in from (game.js fades it in and out over VISIT_FADE of them)
const VISIT_FADE = 1.5;
const HOG_WALK = 0.04;          // tiles a tick (a rabbit walks 0.06)
const HOG_UP = [0.62, 0.03];    // it's up from dusk till dawn (phaseOf)
const HOG_SNUFFLE = [60, 150];  // ticks it snuffles about in one spot
const HOG_REACH = 1.6;          // how far from the foot of its hedge it potters
const HOG_NEXT = 3.5;           // and how far it goes on to the next spot, mostly
const HOG_FINDS = 0.6;          // the chance a snuffle turns up a beetle, a slug or a worm (or two or three)

const HOG_DUSK = Math.round(HOG_UP[0] * TPD);

function visitorsTick(w) {
  const t = w.tick % TPD;
  if (t === 0) visitorSigns(w);
  if (t === LARK_MORNING) skylarkMorning(w);
  if (t === HERON_MORNING) heronMorning(w);
  if (t === KF_MORNING) kingfisherMorning(w);
  if (t === DRAGON_WARM) dragonMorning(w);
  if (t === DRAGON_COOL) dragonEvening(w);
  if (t === HOG_DUSK) visitorsDusk(w);
  if (t === LARK_EVENING) skylarkEvening(w);
  if (t === KF_EVENING) kingfisherEvening(w);
  if (t === HERON_EVENING) heronEvening(w);
  const p = phaseOf(w.tick), up = p >= HOG_UP[0] || p < HOG_UP[1], day = p >= HERON_DAY[0] && p < HERON_DAY[1];
  for (let k = 0; k < w.visitors.length; k++) {
    const v = w.visitors[k];
    switch (v.kind) {
      case 'heron': heronTick(w, v, day); break;
      case 'hedgehog': hedgehogTick(w, v, up); break;
      case 'dragonfly': dragonflyTick(w, v); break;
      case 'kingfisher': kingfisherTick(w, v); break;
      case 'skylark': skylarkTick(w, v); break;
    }
  }
  if (w.visitGone) { w.visitors = w.visitors.filter(v => !v.gone); w.visitGone = false; }
}

// At dusk: which hedgehog is going, and whether one's coming.
function visitorsDusk(w) {
  for (const v of w.visitors) {
    if (v.kind !== 'hedgehog') continue;
    v.whips = v.whips.filter(standing);
    if (w.tick >= v.until && !waits(w, v) || !v.whips.length) leave(w, v);
  }
  if (w.hedges) hedgehogComes(w);
}

// Still waiting to be seen (v.wait), and not yet the last day of autumn.
const waits = (w, v) => v.wait && dayOf(w.tick) % YEAR_DAYS < 3 * SEASON_DAYS - 1;

// Gone off the map.
function visitorGone(w, v) {
  v.gone = true; w.visitGone = true; w.visited[v.kind].left = dayOf(w.tick);
  emit(w, { type: 'visitorleft', v });
}

// A hedgehog comes to the longest young hedge, if one has a chance tonight (force: one comes now, whatever the day).
function hedgehogComes(w, force = false) {
  const day = dayOf(w.tick);
  if (w.visitors.some(v => v.kind === 'hedgehog')) return null;
  const stay = force ? VISIT_DAYS[1] : firstBlocked(w, 'hedgehog', day) ? 0 : hogDay(w, day), at = stay && hogPlace(w, day, force);
  if (!at) return null;
  const { h, whips, nx, ny, fx, fy, a } = at;
  const v = { id: w.visitId = (w.visitId || 0) + 1, kind: 'hedgehog', hedge: h, whips, x: fx, y: fy, fx, fy, nx, ny,
    tx: nx, ty: ny, mode: 'in', came: w.tick, until: w.tick + stay * TPD, timer: 0, facing: Math.cos(a) > 0 ? -1 : 1, moved: 0, finds: 0, gone: false,
    seen: false, wait: false, n: visitedOne(w, 'hedgehog') };
  w.visitors.push(v);
  dropSign(w, 'hedgehog');
  emit(w, { type: 'visitor', v });
  return v;
}

// How many days a hedgehog that came at dusk on day d would stay, or 0 if none may come then: not in winter, not till
// VISIT_REST after the last one left, and only on a day the hash says (VISIT_FIRST the first time, then VISIT_ODDS).
function hogDay(w, d) {
  const last = w.visited.hedgehog, stay = Math.min(VISIT_DAYS[0] + Math.floor(hash2(d, 3, w.seed) * (VISIT_DAYS[1] - VISIT_DAYS[0] + 1)),
    3 * SEASON_DAYS - 1 - d % YEAR_DAYS);                    // (gone by the last dusk of autumn)
  return seasonOf(d * TPD) === 3 || stay < 2 || last && d < last.left + VISIT_REST
    || hash2(d, 1, w.seed) >= (last ? VISIT_ODDS : VISIT_FIRST) ? 0 : stay;
}

// Where one that came on day d would come to (its bed at the foot of a whip of the longest young hedge, force: any
// hedge) and in from (dry ground with a clear way to the hedge), as things are now; or null.
function hogPlace(w, d, force) {
  let h = null;
  for (const o of w.hedges) if ((o.young || force) && o.standing && (!h || o.standing > h.standing)) h = o;
  const whips = h ? w.decor.filter(o => o.hedge === h.id && standing(o)) : [];
  if (!whips.length) return null;
  const b = whips[Math.floor(hash2(d, 5, w.seed) * whips.length)], side = hash2(d, 6, w.seed) < 0.5 ? -1 : 1;
  const nx = b.x + 0.3 * side, ny = b.y + 0.35;             // its bed: at the foot of a whip, in front of it
  const a0 = hash2(d, 7, w.seed) * 2 * Math.PI;
  for (let k = 0; k < 12; k++) {
    const a = a0 + k * 2 * Math.PI / 12, fx = nx + Math.cos(a) * VISIT_FROM, fy = ny + Math.sin(a) * VISIT_FROM;
    if (footing(w, fx, fy) && clearPath(w, fx, fy, nx, ny)) return { h, whips, nx, ny, fx, fy, a };
  }
  return null;
}

// A day or two ahead, a visitor on its way leaves a sign where it'll come (w.signs, looked for each sunrise): a hedgehog
// its tracks in the dew, along the way it'll come in to the hedge; a heron a feather on the bank of the pond. Its
// days are hashed (hogDay, heronDay), so the first day within SIGN_DAYS that one would come is known, and where to as
// things are now (hogPlace, heronPlace). A sign goes when its visitor comes, or the sunrise after its day. A heron's
// sign is for a morning after this one (it comes just after sunrise). Event: 'visitorsign'.
const SIGN_DAYS = 2;
function visitorSigns(w) {
  const day = dayOf(w.tick);
  w.signs = (w.signs || []).filter(s => s.day >= day);
  const has = k => w.visitors.some(v => v.kind === k) || w.signs.some(s => s.kind === k);
  if (w.hedges && !has('hedgehog')) {
    for (let d = day; d <= day + SIGN_DAYS; d++) {
      if (!hogDay(w, d) || firstBlocked(w, 'hedgehog', d)) continue;
      const at = hogPlace(w, d);
      if (at) addSign(w, { kind: 'hedgehog', day: d, x: at.nx, y: at.ny, a: at.a, hedge: at.h });
      break;
    }
  }
  if (w.ponds && !has('heron')) {
    for (let d = day + 1; d <= day + SIGN_DAYS; d++) {
      if (!heronDay(w, d) || firstBlocked(w, 'heron', d)) continue;
      const at = heronPlace(w, d);
      if (at) addSign(w, { kind: 'heron', day: d, ...bankOf(w, at.p, at.s), a: hash2(d, 19, w.seed) * 2 * Math.PI, pond: at.p });
      break;
    }
  }
}
function addSign(w, s) { w.signs.push(s); emit(w, { type: 'visitorsign', s }); }
function dropSign(w, kind) { if (w.signs) w.signs = w.signs.filter(s => s.kind !== kind); }

// Dry ground at the edge of pond p, out from its spot s, for a heron's feather.
function bankOf(w, p, s) {
  const dx = s.x - p.x, dy = s.y - p.y, l = Math.hypot(dx, dy) || 1;
  for (let r = 0; r <= 5; r += 0.5) {
    const x = s.x + dx / l * r, y = s.y + dy / l * r;
    if (inBounds(x, y) && !w.water[idx(x, y)]) return { x, y };
  }
  return { x: s.x, y: s.y };
}

// Off back the way it came (at dusk when its days are up, or at once from a fire or a hedge gone).
function leave(w, v) {
  if (v.mode === 'out') return;
  v.mode = 'out'; v.tx = v.fx; v.ty = v.fy;
  if (!clearPath(w, v.x, v.y, v.fx, v.fy)) { v.tx = v.x; v.ty = v.y; }   // (the way's gone under water: it slips off where it is)
}

// A step towards (tx, ty), true there.
function visitorWalk(v, pace) {
  const dx = v.tx - v.x, dy = v.ty - v.y, d = hypot(dx, dy);
  if (d <= pace) { v.x = v.tx; v.y = v.ty; v.moved = d; return true; }
  v.x += dx / d * pace; v.y += dy / d * pace; v.moved = pace;
  if (Math.abs(dx) > d * 0.3) v.facing = dx > 0 ? 1 : -1;
  return false;
}

function hedgehogTick(w, v, up) {
  v.moved = 0;
  switch (v.mode) {
    case 'in': if (visitorWalk(v, HOG_WALK)) potter(w, v, up); return;
    case 'out':
      if (visitorWalk(v, HOG_WALK)) visitorGone(w, v);
      return;
    case 'potter': if (!up) { home(v); return; } if (visitorWalk(v, HOG_WALK * 0.7)) snuffle(w, v); return;
    case 'snuffle': if (!up) home(v); else if (--v.timer <= 0) potter(w, v, up); return;
    case 'home': if (visitorWalk(v, HOG_WALK)) v.mode = 'sleep'; return;
    case 'sleep': if (up && w.tick < v.until) potter(w, v, up); return;
  }
}

const home = v => { v.mode = 'home'; v.tx = v.nx; v.ty = v.ny; };
function snuffle(w, v) {
  v.mode = 'snuffle';
  const r = hash2(w.tick, v.id, 61);
  v.timer = HOG_SNUFFLE[0] + Math.floor(r * (HOG_SNUFFLE[1] - HOG_SNUFFLE[0]));
  if (hash2(w.tick, v.id, 67) < HOG_FINDS) v.finds += 1 + Math.floor(3 * hash2(w.tick, v.id, 69));
}

// Off along the hedge to a spot near the foot of one of its whips close by (now and then any), or a snuffle where it
// is if there's no clear way.
function potter(w, v, up) {
  if (!up) { home(v); return; }
  for (let k = 0; k < 6; k++) {
    const d = v.whips[Math.floor(hash2(w.tick, v.id * 6 + k, 71) * v.whips.length)];
    if (!d) break;
    if (k < 5 && (d.x - v.x) ** 2 + (d.y - v.y) ** 2 > HOG_NEXT * HOG_NEXT) continue;
    const a = hash2(w.tick, k, 73) * 2 * Math.PI, r = HOG_REACH * Math.sqrt(hash2(w.tick, k, 79));
    const x = d.x + Math.cos(a) * r, y = d.y + 0.2 + Math.sin(a) * r * 0.6;
    if (!dry(w, x, y) || !clearPath(w, v.x, v.y, x, y)) continue;
    v.mode = 'potter'; v.tx = x; v.ty = y;
    return;
  }
  snuffle(w, v);
}

// The heron: once frogs have found a dug pond (p.found, a day or more ago), a grey heron may fly in to it of a morning,
// spring to autumn, to the one with the most frogs about it. By day it stalks the shallows (heronSpots: the pond's shallow tiles, or its
// bank if it has none), stands stock still watching the water, and stabs; now and then it comes up with a frog, or a
// fish where there are fish, and holds it up before it goes down. A spot across the pond it flies to. At night it sleeps
// where it stands, on one leg. It flies off of an evening once its days are up, or at once from a fire, the ice or the
// pond gone dry. It takes nothing from w.frogs or w.fish: the herons are in FROG_DIE already.
const HERON_DAY = [0.05, 0.68]; // it fishes from just after sunrise till dusk (phaseOf), and comes and goes at the ends
const HERON_FROM = 24;          // tiles off it flies in from, and off to (game.js fades it in and out over HERON_FADE)
const HERON_FADE = 3;
const HERON_FLY = 0.12;         // tiles a tick on the wing
const HERON_WADE = 0.02;        // tiles a tick stalking through the shallows (a rabbit walks 0.06)
const HERON_NEXT = 2.5;         // how far it stalks to its next spot, mostly; further, it flies
const HERON_WATCH = [40, 130];  // ticks it stands stock still, watching the water
const HERON_STABS = 0.6;        // the chance a watch ends in a stab (else it stalks on)
const HERON_STAB = 12;          // ticks a stab takes
const HERON_CATCH = 0.5;        // the chance a stab comes up with something
const HERON_GULP = 50;          // ticks it holds it up, and down it goes
const HERON_FISH = 0.1;         // fish on its tile (w.fish) past which a catch is a fish half the time
const HERON_MORNING = Math.round(HERON_DAY[0] * TPD), HERON_EVENING = Math.round(HERON_DAY[1] * TPD);

// Of a morning: a heron here finds the water as it is today (and goes if there's none to fish), and one may come.
function heronMorning(w) {
  for (const v of w.visitors) {
    if (v.kind !== 'heron' || v.mode === 'out') continue;
    v.spots = heronSpots(w, v.pond);
    if (!v.spots.length) heronOff(w, v);
  }
  heronComes(w);
}

// Of an evening: off, once its days are up.
function heronEvening(w) {
  for (const v of w.visitors) if (v.kind === 'heron' && w.tick >= v.until && !waits(w, v)) heronOff(w, v);
}

// A heron comes to the dug pond with the most frogs about it, if one has a chance this morning (force: one comes now,
// whatever the day, to any pond with water).
function heronComes(w, force = false) {
  const day = dayOf(w.tick);
  if (!w.ponds || w.visitors.some(v => v.kind === 'heron')) return null;
  const stay = force ? VISIT_DAYS[1] : !w.frozen && !firstBlocked(w, 'heron', day) && heronDay(w, day), at = stay && heronPlace(w, day, force);
  if (!at) return null;
  const { p, spots, s, fx, fy } = at;
  const v = { id: w.visitId = (w.visitId || 0) + 1, kind: 'heron', pond: p, spots, x: fx, y: fy, fx, fy, ox: fx, oy: fy, tx: s.x, ty: s.y,
    mode: 'in', came: w.tick, until: w.tick + (stay - 1) * TPD, timer: 0, facing: s.x > fx ? 1 : -1, moved: 0,
    frogs: 0, fish: 0, caught: '', gone: false, seen: false, wait: false, n: visitedOne(w, 'heron') };
  w.visitors.push(v);
  dropSign(w, 'heron');
  emit(w, { type: 'visitor', v });
  return v;
}

// As hogDay, for a heron of a morning (the frozen pond aside, which only the morning itself knows).
function heronDay(w, d) {
  const last = w.visited.heron, stay = Math.min(VISIT_DAYS[0] + Math.floor(hash2(d, 13, w.seed) * (VISIT_DAYS[1] - VISIT_DAYS[0] + 1)),
    3 * SEASON_DAYS - d % YEAR_DAYS);                        // (gone by the last evening of autumn)
  return seasonOf(d * TPD) === 3 || stay < 2 || last && d < last.left + VISIT_REST
    || hash2(d, 11, w.seed) >= (last ? VISIT_ODDS : VISIT_FIRST) ? 0 : stay;
}

// The dug pond with the most frogs about it that frogs found before day d (force: any with water), and the spot it
// would come down at and the place it'd fly in from; or null.
function heronPlace(w, d, force) {
  let p = null, spots = null, most = -1;
  for (const o of w.ponds) {
    if (!force && (!o.found || o.foundDay >= d)) continue;
    const s = heronSpots(w, o), f = s.length ? frogsAbout(w, o) : -1;
    if (f > most) { p = o; spots = s; most = f; }
  }
  if (!p || !spots.length) return null;
  const s = spots[Math.floor(hash2(d, 15, w.seed) * spots.length)], a = hash2(d, 17, w.seed) * 2 * Math.PI;
  return { p, spots, s, fx: clamp(s.x + Math.cos(a) * HERON_FROM, 1, W - 1), fy: clamp(s.y + Math.sin(a) * HERON_FROM, 1, H - 1) };
}

// The frogs about a dug pond: on its tiles and within 3 of them.
function frogsAbout(w, p) {
  let n = 0;
  for (let y = Math.max(0, p.box.y0 - 3); y <= Math.min(H - 1, p.box.y1 + 3); y++) {
    for (let x = Math.max(0, p.box.x0 - 3), i = y * W + x; x <= Math.min(W - 1, p.box.x1 + 3); x++, i++) n += w.frogs[i];
  }
  return n;
}

// Where a heron fishes at pond p: its shallow tiles, each a little off the tile's middle (by hash), or with none (all
// deep) the dry ground next to its water. [] if it holds no water now.
function heronSpots(w, p) {
  const shallows = [], bank = [], b = p.box, its = j => w.dug[j] === p.id && w.water[j] > 0;
  for (let y = Math.max(1, b.y0 - 1); y <= Math.min(H - 2, b.y1 + 1); y++) {
    for (let x = Math.max(1, b.x0 - 1), i = y * W + x; x <= Math.min(W - 2, b.x1 + 1); x++, i++) {
      const list = w.dug[i] === p.id && w.water[i] === SHALLOW ? shallows
        : !shallows.length && !w.water[i] && (its(i - 1) || its(i + 1) || its(i - W) || its(i + W)) ? bank : null;
      if (list) list.push({ x: x + 0.25 + 0.5 * hash2(x, y, 83), y: y + 0.25 + 0.5 * hash2(y, x, 89) });
    }
  }
  return shallows.length ? shallows : bank;
}

// Off it flies, back the way it came.
function heronOff(w, v) {
  if (v.mode === 'out') return;
  v.mode = 'out'; v.ox = v.x; v.oy = v.y; v.tx = v.fx; v.ty = v.fy;
}

function heronTick(w, v, day) {
  v.moved = 0;
  if (v.mode !== 'out' && w.frozen) heronOff(w, v);
  switch (v.mode) {
    case 'in': if (visitorWalk(v, HERON_FLY)) heronWatch(w, v); return;
    case 'out': if (visitorWalk(v, HERON_FLY)) visitorGone(w, v); return;
    case 'hop': if (visitorWalk(v, HERON_FLY * 0.6)) heronWatch(w, v); return;
    case 'sleep': if (day) heronWatch(w, v); return;
    case 'stalk': if (!day) v.mode = 'sleep'; else if (visitorWalk(v, HERON_WADE)) heronWatch(w, v); return;
    case 'watch':
      if (!day) v.mode = 'sleep';
      else if (--v.timer <= 0) {
        if (hash2(w.tick, v.id, 91) < HERON_STABS) { v.mode = 'stab'; v.timer = HERON_STAB; } else heronStalk(w, v);
      }
      return;
    case 'stab':
      if (--v.timer > 0) return;
      if (hash2(w.tick, v.id, 93) >= HERON_CATCH) { heronWatch(w, v); return; }
      v.caught = w.fish[idx(v.x, v.y)] > HERON_FISH && hash2(w.tick, v.id, 95) < 0.5 ? 'fish' : 'frog';
      if (v.caught === 'fish') v.fish++; else v.frogs++;
      v.mode = 'gulp'; v.timer = HERON_GULP;
      return;
    case 'gulp': if (--v.timer <= 0) heronWatch(w, v); return;
  }
}

// Stock still, facing out over the pond, watching the water.
function heronWatch(w, v) {
  v.mode = 'watch';
  if (Math.abs(v.pond.x - v.x) > 0.5) v.facing = v.pond.x > v.x ? 1 : -1;
  v.timer = HERON_WATCH[0] + Math.floor(hash2(w.tick, v.id, 97) * (HERON_WATCH[1] - HERON_WATCH[0]));
}

// On through the shallows to another of its spots close by (now and then any: one further off it flies to), or stock
// still where it is if there's none.
function heronStalk(w, v) {
  for (let k = 0; k < 6; k++) {
    const s = v.spots[Math.floor(hash2(w.tick, v.id * 6 + k, 99) * v.spots.length)];
    if (!s) break;
    const d2 = (s.x - v.x) ** 2 + (s.y - v.y) ** 2;
    if (k < 5 && (d2 > HERON_NEXT * HERON_NEXT || d2 < 0.25)) continue;
    v.mode = d2 > HERON_NEXT * HERON_NEXT ? 'hop' : 'stalk'; v.ox = v.x; v.oy = v.y; v.tx = s.x; v.ty = s.y;
    return;
  }
  heronWatch(w, v);
}

// ---------------------------------------------------------------- the keeper's places
//
// What each of the keeper's ponds and strips is like (the ?keep mode that dug and sowed them is gone), worked out once a
// day (placesDay), so a visitor asking for a kind of place looks it up and never scans: a pond's water now (p.wet,
// tiles of it), the fish in it (p.fish) and a tree at its edge or on an island in it (p.perch: standing, SAPLING or
// bigger, within EDGE_REACH of its water, the nearest); a strip's room in the open (f.clear: tiles from its line to the
// nearest tree or hedge standing, up to OPEN_MOST). The places pull against each other. Fish come into a pond only
// through water joined to water that has them (fishTick: a pond dug on its own never gets any, one dug onto the river or
// a lake fills with them) and eat the dragonflies' young, so a pond has dragonflies or a kingfisher, never both; a strip
// out in the open has no hedge of yours or tree by the water near it. placeNeeds says what a place lacks for a kind.
const EDGE_REACH = 1.5;         // tiles from a pond's water a tree stands and still leans out over it
const OPEN_MOST = 12;           // f.clear counts no further
const FISHLESS = 0.5;           // fish in a pond under which there are none to speak of (pondFacts says "about 1" at 1)
const KF_FISH = 1;              // and the fish a kingfisher wants in it (a small pond of shallows on the river holds one or two)

function placesDay(w) {
  for (const p of w.ponds || []) pondPlace(w, p);
  for (const f of w.fields) if (f.strip) stripPlace(w, f);
}

function pondPlace(w, p) {
  const b = p.box;
  let wet = 0, fish = 0;
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0, i = y * W + x; x <= b.x1; x++, i++) if (w.dug[i] === p.id && w.water[i]) { wet++; fish += w.fish[i]; }
  }
  p.wet = wet; p.fish = fish; p.perch = null;
  if (!wet) return;
  let best = Infinity;
  forEachDecorNear(w, p.x, p.y, hypot(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) / 2 + EDGE_REACH + 1, d => {
    if (!standing(d) || d.size < SAPLING) return;
    const r = Math.ceil(EDGE_REACH);
    for (let y = Math.max(0, Math.floor(d.y) - r); y <= Math.min(H - 1, Math.floor(d.y) + r); y++) {
      for (let x = Math.max(0, Math.floor(d.x) - r), i = y * W + x; x <= Math.min(W - 1, Math.floor(d.x) + r); x++, i++) {
        if (w.dug[i] !== p.id || !w.water[i]) continue;
        const e = (x + 0.5 - d.x) ** 2 + (y + 0.5 - d.y) ** 2;
        if (e < EDGE_REACH * EDGE_REACH && e < best) { best = e; p.perch = d; }
      }
    }
  });
}

function stripPlace(w, f) {
  let near = OPEN_MOST;
  for (const s of f.shape) {
    forEachDecorNear(w, s.x, s.y, near, d => {
      if (!standing(d) || d.size < SAPLING && !d.hedge) return;   // (a hedge is a hedge from the day it's planted)
      const r = hypot(d.x - s.x, d.y - s.y);
      if (r < near) near = r;
    });
  }
  f.clear = near;
}

// What a place (a pond, or a strip) lacks for a visitor of a kind: a list, empty when it has it all. 'water' (none in
// it now), 'reeds' (not up yet), 'fish' (fish in it, for dragonflies) or 'nofish' (too few for a kingfisher), 'perch'
// (no tree at its edge), 'open' (something standing near the strip), 'flowers' (it hasn't flowered yet). Not the
// season: a kind's seasons are its own (VISIT_SEASONS).
function placeNeeds(w, kind, o) {
  const out = [];
  if (kind === 'dragonfly' || kind === 'kingfisher') {
    if (!o.wet) out.push('water');
    if (kind === 'dragonfly') { if (!o.reeds) out.push('reeds'); if (o.fish >= FISHLESS) out.push('fish'); }
    else { if (o.fish < KF_FISH) out.push('nofish'); if (!o.perch) out.push('perch'); }
  } else if (kind === 'skylark') {
    if (o.clear < LARK_OPEN) out.push('open');
    if (!o.flowered) out.push('flowers');
  }
  return out;
}

// ---------------------------------------------------------------- more visitors
//
// Each asks for a kind of place (placeNeeds) in its own seasons (VISIT_SEASONS), and comes as the hedgehog and the heron
// do: a day it may come is hashed (visitDay: VISIT_FIRST the first time, then VISIT_ODDS, VISIT_REST after the last one
// left), to the place that suits it best as things are that morning. Dragonflies come to a pond on its own (no fish)
// with its reeds up, in summer; a kingfisher to a pond with fish and a tree at its edge, in summer and autumn (the young
// ones out looking for water of their own); a skylark to a strip out in the open, in spring and summer. And at most one
// kind comes for the first time a day (firstBlocked), so a season's new pages come one by one.
const VISIT_SEASONS = { dragonfly: [1], kingfisher: [1, 2], skylark: [0, 1] };
const VISIT_SURE = 0.75;        // the chance a day of their first visit, once the place is ready in their seasons: a season is
                                // only five days, and the place, not the luck, is the hard part

// How many days one of kind that came on day d would stay, or 0 if none may come then (as hogDay): in its seasons, not
// till VISIT_REST after the last one left, on a day the hash says (VISIT_SURE the first time, then VISIT_ODDS), and gone by
// the end of its last season (so on its last day only for that day: one of a kind never seen waits for you anyway, waits).
function visitDay(w, kind, d, salt) {
  const seasons = VISIT_SEASONS[kind], s = seasonOf(d * TPD), last = w.visited[kind];
  if (!seasons.includes(s)) return 0;
  let end = (Math.floor(d / SEASON_DAYS) + 1) * SEASON_DAYS;  // (the end of this season, or of the run of its seasons)
  for (let k = s + 1; seasons.includes(k % 4) && k < s + 4; k++) end += SEASON_DAYS;
  const stay = Math.min(VISIT_DAYS[0] + Math.floor(hash2(d, salt + 2, w.seed) * (VISIT_DAYS[1] - VISIT_DAYS[0] + 1)), end - d);
  return stay < 1 || last && d < last.left + VISIT_REST || hash2(d, salt, w.seed) >= (last ? VISIT_ODDS : VISIT_SURE) ? 0 : stay;
}

// At most one kind comes for the first time a day: one that has never come here can't come on a day another came for
// the first time, or another's first coming is foretold for (its sign).
function firstBlocked(w, kind, d) {
  if (w.visited[kind]) return false;
  for (const k in w.visited) if (w.visited[k].first === d) return true;
  return !!w.signs?.some(s => s.kind !== kind && s.day === d && !w.visited[s.kind]);
}

// The record of a kind's visits (w.visited), one more.
function visitedOne(w, kind) {
  const seen = w.visited[kind] ??= { n: 0, left: -99, first: dayOf(w.tick) };
  return ++seen.n;
}

// Its wet tiles a little off their middles (by hash): all of them, or only those by its edge (where the reeds are).
function pondTiles(w, p, edge) {
  const out = [], b = p.box, its = j => w.dug[j] === p.id && w.water[j] > 0;
  for (let y = Math.max(1, b.y0); y <= Math.min(H - 2, b.y1); y++) {
    for (let x = Math.max(1, b.x0), i = y * W + x; x <= Math.min(W - 2, b.x1); x++, i++) {
      if (!its(i) || edge && its(i - 1) && its(i + 1) && its(i - W) && its(i + W)) continue;
      out.push({ x: x + 0.25 + 0.5 * hash2(x, y, 101), y: y + 0.25 + 0.5 * hash2(y, x, 103) });
    }
  }
  return out;
}

// A point off (x, y) at a hashed angle, `far` tiles away, in the meadow.
const offFrom = (w, x, y, far, a) => ({ x: clamp(x + Math.cos(a) * far, 1, W - 1), y: clamp(y + Math.sin(a) * far, 1, H - 1) });

// Dragonflies: a few at a pond, by day hawking over the water in quick darts and stops, now and then landing on the reeds
// by its edge; at night, and in the rain, roosting there. The sim moves one of them (the visitor); game.js draws the rest
// about it. They fly in when the day warms and off of an afternoon once their days are up, or at once if the pond goes dry
// or a fire comes.
const DRAGON_DAY = [0.2, 0.62]; // they're up from when the day warms till the evening (phaseOf)
const DRAGON_LEAVE = 0.55;      // and leave of an afternoon
const DRAGON_FROM = 14;         // tiles off they fly in from (game.js fades them in over VISIT_FADE)
const DRAGON_FLY = 0.12;        // tiles a tick, flying in
const DRAGON_DART = 0.09;       // and darting about over the water
const DRAGON_HOVER = [12, 50];  // ticks they hang still in the air between darts
const DRAGON_PERCH = [60, 200]; // ticks on a reed
const DRAGON_REACH = 3;         // how far one dart goes, at most
const DRAGON_LANDS = 0.25;      // the chance a dart ends on a reed
const DRAGON_WARM = Math.round(DRAGON_DAY[0] * TPD), DRAGON_COOL = Math.round(DRAGON_LEAVE * TPD);

function dragonflyComes(w, force = false) {
  const day = dayOf(w.tick);
  if (!w.ponds || w.visitors.some(v => v.kind === 'dragonfly')) return null;
  const stay = force ? VISIT_DAYS[1] : firstBlocked(w, 'dragonfly', day) ? 0 : visitDay(w, 'dragonfly', day, 21);
  const at = stay && dragonflyPlace(w, day, force);
  if (!at) return null;
  const { p, spots, edge, s } = at, from = offFrom(w, s.x, s.y, DRAGON_FROM, hash2(day, 24, w.seed) * 2 * Math.PI);
  const v = { id: w.visitId = (w.visitId || 0) + 1, kind: 'dragonfly', pond: p, spots, edge, x: from.x, y: from.y, fx: from.x, fy: from.y,
    ox: from.x, oy: from.y, tx: s.x, ty: s.y, mode: 'in', came: w.tick, until: w.tick + (stay - 1) * TPD, timer: 0, facing: s.x > from.x ? 1 : -1, moved: -0,
    gone: false, seen: false, wait: false, n: visitedOne(w, 'dragonfly') };
  w.visitors.push(v);
  emit(w, { type: 'visitor', v });
  return v;
}

// The pond with all a dragonfly needs and the most water (force: any with water), and where it comes down; or null.
function dragonflyPlace(w, d, force) {
  let p = null;
  for (const o of w.ponds) if (o.wet && (force || !placeNeeds(w, 'dragonfly', o).length) && (!p || o.wet > p.wet)) p = o;
  if (!p) return null;
  const spots = pondTiles(w, p), edge = pondTiles(w, p, true);
  if (!spots.length) return null;
  return { p, spots, edge: edge.length ? edge : spots, s: spots[Math.floor(hash2(d, 23, w.seed) * spots.length)] };
}

// When the day warms: the dragonflies at a pond see to it (off if it's gone dry or has fish now), and more may come.
function dragonMorning(w) {
  for (const v of w.visitors) {
    if (v.kind !== 'dragonfly' || v.mode === 'out') continue;
    v.spots = pondTiles(w, v.pond); v.edge = pondTiles(w, v.pond, true);
    if (!v.spots.length) visitorOff(w, v); else if (!v.edge.length) v.edge = v.spots;
  }
  dragonflyComes(w);
}
function dragonEvening(w) {
  for (const v of w.visitors) if (v.kind === 'dragonfly' && w.tick >= v.until && !waits(w, v)) visitorOff(w, v);
}

// Off they go, back the way they came (any visitor that flies).
function visitorOff(w, v) {
  if (v.mode === 'out') return;
  v.mode = 'out'; v.ox = v.x; v.oy = v.y; v.tx = v.fx; v.ty = v.fy;
}

function dragonflyTick(w, v) {
  v.moved = 0;
  const p = phaseOf(w.tick), up = p >= DRAGON_DAY[0] && p < DRAGON_DAY[1] && w.weather.kind !== 'rain' && w.weather.kind !== 'storm';
  switch (v.mode) {
    case 'in': if (visitorWalk(v, DRAGON_FLY)) dragonHover(w, v); return;
    case 'out': if (visitorWalk(v, DRAGON_FLY)) visitorGone(w, v); return;
    case 'dart':
      if (!up) { dragonRoost(w, v); return; }
      if (visitorWalk(v, DRAGON_DART)) { if (v.timer < 0) { v.mode = 'perch'; v.timer = between(w, v, DRAGON_PERCH, 105); } else dragonHover(w, v); }
      return;
    case 'hover': if (!up) dragonRoost(w, v); else if (--v.timer <= 0) dragonDart(w, v); return;
    case 'perch': if (!up) v.mode = 'roost'; else if (--v.timer <= 0) dragonDart(w, v); return;
    case 'roost': if (up) dragonDart(w, v); return;
    case 'home': if (visitorWalk(v, DRAGON_DART)) v.mode = 'roost'; return;
  }
}
// A whole number of ticks in a span, by hash.
const between = (w, v, span, salt) => span[0] + Math.floor(hash2(w.tick, v.id, salt) * (span[1] - span[0]));
function dragonHover(w, v) { v.mode = 'hover'; v.timer = between(w, v, DRAGON_HOVER, 107); }
// A dart to another spot over the water close by (now and then one by the edge, to land on a reed: timer -1).
function dragonDart(w, v) {
  const land = hash2(w.tick, v.id, 109) < DRAGON_LANDS, list = land ? v.edge : v.spots;
  for (let k = 0; k < 6; k++) {
    const s = list[Math.floor(hash2(w.tick, v.id * 6 + k, 111) * list.length)];
    if (!s) break;
    const d2 = (s.x - v.x) ** 2 + (s.y - v.y) ** 2;
    if (k < 5 && (d2 > DRAGON_REACH * DRAGON_REACH || d2 < 0.2)) continue;
    v.mode = 'dart'; v.tx = s.x; v.ty = s.y; v.timer = land ? -1 : 0;
    return;
  }
  dragonHover(w, v);
}
// To a reed for the night (or out of the rain).
function dragonRoost(w, v) {
  let best = null, bd = Infinity;
  for (const s of v.edge) { const d2 = (s.x - v.x) ** 2 + (s.y - v.y) ** 2; if (d2 < bd) { bd = d2; best = s; } }
  if (!best) { v.mode = 'roost'; return; }
  v.mode = 'home'; v.tx = best.x; v.ty = best.y;
}

// A kingfisher: it sits on a low branch of the tree at the pond's edge (p.perch) watching the water, now and then drops
// in a dive and comes up with a fish where they're thick (or nothing), back to its branch, where it beats the fish on the
// branch and swallows it head first. By night it sleeps there. It comes in fast and low over the water of a morning, and
// goes the same way of an evening once its days are up, or at once if its tree comes down or the pond goes dry or freezes.
// It takes nothing from w.fish: it's a look.
const KF_DAY = [0.06, 0.66];    // it fishes from just after sunrise till the evening, and comes and goes at the ends
const KF_FROM = 26;             // tiles off it flies in from, low and fast (game.js fades it in over KF_FADE)
const KF_FADE = 3;
const KF_FLY = 0.2;             // tiles a tick on the wing: a blue streak
const KF_WATCH = [50, 160];     // ticks it sits watching between dives
const KF_DIVES = 0.6;           // the chance a watch ends in a dive (else it watches on)
const KF_DIVE = 0.16;           // tiles a tick, dropping to the water
const KF_UNDER = 8;             // ticks under
const KF_CATCH = 0.5;           // the chance a dive comes up with a fish (more where they're thick, KF_THICK)
const KF_THICK = 0.3;           // fish on the tile past which a dive is twice as likely to
const KF_BEAT = 70;             // ticks it beats a fish on the branch and swallows it
const KF_MORNING = Math.round(KF_DAY[0] * TPD), KF_EVENING = Math.round(KF_DAY[1] * TPD);

function kingfisherComes(w, force = false) {
  const day = dayOf(w.tick);
  if (!w.ponds || w.frozen || w.visitors.some(v => v.kind === 'kingfisher')) return null;
  const stay = force ? VISIT_DAYS[1] : firstBlocked(w, 'kingfisher', day) ? 0 : visitDay(w, 'kingfisher', day, 31);
  const at = stay && kingfisherPlace(w, day, force);
  if (!at) return null;
  const { p, tree, sx, sy, dives } = at, from = offFrom(w, sx, sy, KF_FROM, hash2(day, 34, w.seed) * 2 * Math.PI);
  const v = { id: w.visitId = (w.visitId || 0) + 1, kind: 'kingfisher', pond: p, tree, sx, sy, dives, x: from.x, y: from.y, fx: from.x, fy: from.y,
    ox: from.x, oy: from.y, tx: sx, ty: sy, mode: 'in', came: w.tick, until: w.tick + (stay - 1) * TPD, timer: 0, facing: sx > from.x ? 1 : -1, moved: -0,
    fish: 0, caught: false, gone: false, seen: false, wait: false, n: visitedOne(w, 'kingfisher') };
  w.visitors.push(v);
  emit(w, { type: 'visitor', v });
  return v;
}

// The pond with all a kingfisher needs and the most fish (force: any with water and a tree at its edge, or any with
// water), its tree, the spot on the ground under its branch (out from the trunk towards the water) and the water it
// dives into from there; or null.
function kingfisherPlace(w, d, force) {
  let p = null;
  for (const o of w.ponds) if (o.wet && (force ? o.perch || !p : !placeNeeds(w, 'kingfisher', o).length) && (!p || !p.perch && o.perch || o.fish > p.fish)) p = o;
  if (!p) return null;
  const tree = p.perch, water = pondTiles(w, p);
  if (!water.length) return null;
  let near = water[0], nd = Infinity;
  const tx = tree ? tree.x : p.x, ty = tree ? tree.y : p.y;
  for (const s of water) { const e = (s.x - tx) ** 2 + (s.y - ty) ** 2; if (e < nd) { nd = e; near = s; } }
  const l = Math.sqrt(nd) || 1, out = tree ? Math.min(0.7, l * 0.5) : 0;   // its branch reaches out over the water
  const sx = tx + (near.x - tx) / l * out, sy = ty + (near.y - ty) / l * out;
  const dives = water.filter(s => (s.x - sx) ** 2 + (s.y - sy) ** 2 < 2.5 * 2.5);
  return { p, tree, sx, sy, dives: dives.length ? dives : [near] };
}

function kingfisherMorning(w) {
  for (const v of w.visitors) if (v.kind === 'kingfisher' && v.mode !== 'out' && !kingfisherStays(w, v)) visitorOff(w, v);
  kingfisherComes(w);
}
function kingfisherEvening(w) {
  for (const v of w.visitors) if (v.kind === 'kingfisher' && w.tick >= v.until && !waits(w, v)) visitorOff(w, v);
}
// Its tree still standing and its pond wet (looked at each morning, and in a dive).
const kingfisherStays = (w, v) => (!v.tree || standing(v.tree)) && v.pond.wet > 0;

function kingfisherTick(w, v) {
  v.moved = 0;
  const p = phaseOf(w.tick), day = p >= KF_DAY[0] && p < KF_DAY[1];
  if (v.mode !== 'out' && w.frozen) visitorOff(w, v);
  switch (v.mode) {
    case 'in': if (visitorWalk(v, KF_FLY)) kingfisherWatch(w, v); return;
    case 'out': if (visitorWalk(v, KF_FLY)) visitorGone(w, v); return;
    case 'watch':
      if (!day) { v.mode = 'sleep'; return; }
      if (--v.timer > 0) return;
      if (hash2(w.tick, v.id, 121) < KF_DIVES && v.dives.length) {
        const s = v.dives[Math.floor(hash2(w.tick, v.id, 123) * v.dives.length)];
        v.mode = 'dive'; v.ox = v.x; v.oy = v.y; v.tx = s.x; v.ty = s.y;
        if (Math.abs(s.x - v.x) > 0.1) v.facing = s.x > v.x ? 1 : -1;
      } else kingfisherWatch(w, v);
      return;
    case 'dive':
      if (!visitorWalk(v, KF_DIVE)) return;
      if (!w.water[idx(v.x, v.y)]) { v.mode = 'back'; v.tx = v.sx; v.ty = v.sy; return; }   // (the water fell back: up again)
      v.mode = 'under'; v.timer = KF_UNDER;
      return;
    case 'under': {
      if (--v.timer > 0) return;
      const odds = KF_CATCH * (w.fish[idx(v.x, v.y)] > KF_THICK ? 2 : 1);
      v.caught = hash2(w.tick, v.id, 125) < odds;
      if (v.caught) v.fish++;
      v.mode = 'back'; v.ox = v.x; v.oy = v.y; v.tx = v.sx; v.ty = v.sy;
      return;
    }
    case 'back':
      if (!visitorWalk(v, KF_DIVE)) return;
      if (v.caught) { v.mode = 'beat'; v.timer = KF_BEAT; } else kingfisherWatch(w, v);
      return;
    case 'beat': if (--v.timer <= 0) { v.caught = false; kingfisherWatch(w, v); } return;
    case 'sleep': if (day) kingfisherWatch(w, v); return;
  }
}
// Still on its branch, facing the water.
function kingfisherWatch(w, v) {
  v.mode = 'watch'; v.timer = between(w, v, KF_WATCH, 127);
  const s = v.dives[0];
  if (s && Math.abs(s.x - v.sx) > 0.1) v.facing = s.x > v.sx ? 1 : -1;
}

// A skylark: on a strip out in the open it walks about among the flowers, stopping to peck at seeds and beetles, and
// now and then rises straight up singing, hangs high over the strip singing for a while, and drops back down to it.
// By night it sleeps on the ground in the strip. It comes in high of a morning and goes the same way of an evening once
// its days are up, or at once from a fire, or something come up standing near the strip (in the morning's look).
const LARK_DAY = [0.03, 0.64];  // it's about from dawn (the first to sing) till the evening, and comes and goes at the ends
const LARK_OPEN = 8;            // tiles from the strip to the nearest tree or hedge standing: about nothing standing near
const LARK_FROM = 22;           // tiles off it flies in from, high (game.js fades it over LARK_FADE)
const LARK_FADE = 3;
const LARK_FLY = 0.14;          // tiles a tick on the wing
const LARK_WALK = 0.03;         // and walking (a rabbit walks 0.06)
const LARK_PECK = [30, 100];    // ticks it stops to peck
const LARK_SINGS = 0.3;         // the chance a stop ends in a song flight, by day (more in the morning)
const LARK_RISE = 60;           // ticks to climb to its height
const LARK_SONG = [180, 420];   // ticks it hangs up there singing
const LARK_DRIFT = 0.006;       // tiles a tick it drifts up there
const LARK_MORNING = Math.round(LARK_DAY[0] * TPD), LARK_EVENING = Math.round(LARK_DAY[1] * TPD);

function skylarkComes(w, force = false) {
  const day = dayOf(w.tick);
  if (w.visitors.some(v => v.kind === 'skylark')) return null;
  const stay = force ? VISIT_DAYS[1] : firstBlocked(w, 'skylark', day) ? 0 : visitDay(w, 'skylark', day, 41);
  const at = stay && skylarkPlace(w, day, force);
  if (!at) return null;
  const { f, s } = at, from = offFrom(w, s.x, s.y, LARK_FROM, hash2(day, 44, w.seed) * 2 * Math.PI);
  const v = { id: w.visitId = (w.visitId || 0) + 1, kind: 'skylark', strip: f, spots: at.spots, x: from.x, y: from.y, fx: from.x, fy: from.y,
    ox: from.x, oy: from.y, tx: s.x, ty: s.y, mode: 'in', came: w.tick, until: w.tick + (stay - 1) * TPD, timer: 0, facing: s.x > from.x ? 1 : -1,
    moved: -0, high: -0, songs: 0, gone: false, seen: false, wait: false, n: visitedOne(w, 'skylark') };
  w.visitors.push(v);
  emit(w, { type: 'visitor', v });
  return v;
}

// The strip most in the open of those with all a skylark needs (force: any), the dry tiles of it to walk about on, and
// where it comes down; or null.
function skylarkPlace(w, d, force) {
  let f = null;
  for (const o of w.fields) if (o.strip && (force || !placeNeeds(w, 'skylark', o).length) && (!f || o.clear > f.clear)) f = o;
  if (!f) return null;
  const spots = [];
  for (const c of f.shape) {
    for (let k = 0; k < 3; k++) {
      const x = c.x + (hash2(f.id * 16 + k, c.x * 8, 131) - 0.5) * c.r * 1.4, y = c.y + (hash2(f.id * 16 + k, c.y * 8, 133) - 0.5) * c.r * 1.4;
      if (dry(w, x, y)) spots.push({ x, y });
    }
  }
  if (!spots.length) return null;
  return { f, spots, s: spots[Math.floor(hash2(d, 43, w.seed) * spots.length)] };
}

function skylarkMorning(w) {
  for (const v of w.visitors) {
    if (v.kind === 'skylark' && v.mode !== 'out' && v.strip.clear < LARK_OPEN) visitorOff(w, v);
  }
  skylarkComes(w);
}
function skylarkEvening(w) {
  for (const v of w.visitors) if (v.kind === 'skylark' && w.tick >= v.until && !waits(w, v)) visitorOff(w, v);
}

function skylarkTick(w, v) {
  v.moved = 0;
  const p = phaseOf(w.tick), day = p >= LARK_DAY[0] && p < LARK_DAY[1];
  switch (v.mode) {
    case 'in':
      if (visitorWalk(v, LARK_FLY)) { v.high = 0; larkPeck(w, v); }
      return;
    case 'out': if (visitorWalk(v, LARK_FLY)) visitorGone(w, v); return;
    case 'walk':
      if (!day) { v.mode = 'sleep'; return; }
      if (visitorWalk(v, LARK_WALK)) larkPeck(w, v);
      return;
    case 'peck':
      if (!day) { v.mode = 'sleep'; return; }
      if (--v.timer > 0) return;
      if (hash2(w.tick, v.id, 141) < LARK_SINGS * (p < 0.3 ? 1.5 : 1)) { v.mode = 'rise'; v.timer = LARK_RISE; v.songs++; }
      else larkWalk(w, v);
      return;
    case 'rise':
      v.high = Math.min(1, v.high + 1 / LARK_RISE);
      if (--v.timer <= 0) { v.mode = 'sing'; v.timer = between(w, v, LARK_SONG, 143); }
      return;
    case 'sing': {
      if (--v.timer <= 0 || !day) { v.mode = 'drop'; return; }
      const a = hash2(Math.floor(w.tick / 60), v.id, 145) * 2 * Math.PI;  // (a slow wander, a new way each minute of meadow time)
      const x = v.x + Math.cos(a) * LARK_DRIFT, y = v.y + Math.sin(a) * LARK_DRIFT;
      if (hypot(x - v.strip.x, y - v.strip.y) < 4) { v.x = x; v.y = y; v.moved = LARK_DRIFT; }
      return;
    }
    case 'drop':
      v.high = Math.max(0, v.high - 1.5 / LARK_RISE);
      if (v.high > 0) return;
      if (!dry(w, v.x, v.y)) { const s = v.spots[0]; v.x = s.x; v.y = s.y; }   // (come down on the strip, not in water)
      larkPeck(w, v);
      return;
    case 'sleep': if (day) larkPeck(w, v); return;
  }
}
function larkPeck(w, v) { v.mode = 'peck'; v.timer = between(w, v, LARK_PECK, 147); }
function larkWalk(w, v) {
  for (let k = 0; k < 6; k++) {
    const s = v.spots[Math.floor(hash2(w.tick, v.id * 6 + k, 149) * v.spots.length)];
    if (!s) break;
    if (k < 5 && (s.x - v.x) ** 2 + (s.y - v.y) ** 2 > 9) continue;
    v.mode = 'walk'; v.tx = s.x; v.ty = s.y;
    return;
  }
  larkPeck(w, v);
}

// ---------------------------------------------------------------- reading an animal

function mood(w, c) {
  if (!c.alive) return { emoji: '👻', text: c.story[c.story.length - 1].text };
  const other = w.byId.get(c.targetId) || w.byId.get(c.threatId);
  const e = c.energy / c.maxEnergy;
  const storm = w.weather.kind === 'storm' && !isNight(w.tick);
  if (c.species === 'bee') { const m = beeMood(w, c); if (m) return m; }
  if (c.species === 'crow') { const m = crowMood(w, c); if (m) return m; }
  if (c.species === 'otter') { const m = otterMood(w, c); if (m) return m; }
  switch (c.mode) {
    case 'flee':
      if (c.fright > 0) return { emoji: '⚡', text: 'Spooked by thunder!' };
      return { emoji: '😱', text: `Running from ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'alarm': return { emoji: '‼️', text: `Spotted ${w.byId.get(c.threatId)?.name ?? 'a fox'}!` };
    case 'dig': return { emoji: '🕳️', text: 'Digging a burrow' };
    case 'hide': return { emoji: '🫣', text: 'Hiding in a burrow' };
    case 'thicket': return { emoji: '🫣', text: `Hiding deep in a bramble from ${w.byId.get(c.threatId)?.name ?? 'a fox'}` };
    case 'bramble': return { emoji: '🫐', text: 'Off to a bramble for the blackberries' };
    case 'berries': return { emoji: '🫐', text: 'Eating blackberries off a bramble' };
    case 'sleep': return { emoji: '💤', text: c.hidden ? (storm ? 'Snug in the burrow, out of the storm' : 'Asleep in the burrow') : 'Napping' };
    case 'home': return { emoji: '🏠', text: storm ? 'Hurrying home out of the storm' : 'Heading home for the night' };
    case 'shelter': return { emoji: '🌧️', text: 'Curled up, waiting out the storm' };
    case 'love': return { emoji: '💕', text: other ? `Courting ${other.name}` : 'Looking for love' };
    case 'graze': return { emoji: '😋', text: 'Munching grass' };
    case 'food': return { emoji: '🌿', text: 'Off to find better grass' };
    case 'apple': return c.target?.tree?.kind === 'apple' ? { emoji: '🍎', text: 'Off to the apple tree for a windfall' }
      : { emoji: '🌰', text: `Off to the ${c.target?.tree?.kind === 'beech' ? 'beeches for beechnuts' : 'oaks for acorns'}` };
    case 'munch': return c.snack === 'apple' ? { emoji: '🍎', text: 'Munching a windfall apple' } : { emoji: '🌰', text: `Nibbling ${c.snack}` };
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
  W, H, TPD, SHALLOW, DEEP, SEASON_DAYS, YEAR_DAYS, SEASONS, SPECIES, WEATHER,
  createWorld, step, clock, isNight, phaseOf, seasonOf, springPart, mood, ageDays, growth, isAdult, patchFresh,
  hedgehogComes, heronComes, dragonflyComes, kingfisherComes, skylarkComes, placeNeeds, VISIT_SEASONS, VISIT_FADE, HERON_FADE, HERON_STAB,
  DRAGON_FROM, KF_FADE, KF_UNDER, KF_BEAT, LARK_FADE, LARK_OPEN, LARK_RISE, EDGE_REACH, OPEN_MOST,
  walkable, packWorld, unpackWorld, GROUND, foragerTo, foragerArrives, openingStorm, FORAGER_WALK, FORAGER_RUN, airTemp, warmthStage, WARMTH_STAGES, STUMBLE_TICKS, wakeForager, rockKind, whatThere, cherryShow, honeySpare, gather, takeFrom, dropSlot, dropAt, DROP_DAYS, moveSlot, roomFor, forEachDecorNear, SLOTS, STACK,
  KINDS, FEW, whiteness, visibility, WINTER_COAT, WILD_COAT,
  TERRAIN, distanceToWater, distanceTo, fieldBloom, FIELD_GRASS, settleWater, riverPace, LOAD, HONEY,
  isFlower, waterAt, FORAGE_RANGE, HIVE_ROOM, HIVE_FULL, REFILL, HIVE_TREE, hollow,
  TREES, treeStage, treeAge, standing, bearing, inBloom, SEEDLING, SAPLING, GROWN, KIND_NAMES,
  FROG_K, SPAWN_WORTH, FISH_K, FISH_EAT, CROW_SEATS, SHROOMS, SHROOM_KINDS, FINDS, FIND_KINDS, findSeason, eachPickable, greenStage, greenPicked, GREEN_SEASONS, brambleStage, RIPE_FROM, RIPE_TO,
  bagCount, spend, stow, fireSpot, layFire, feedFire, fireRoom, lightable, lightFire, fireHeat, fireWarmth,
  FIRE_STICK, FIRE_MOST, FIRE_LOW, FIRE_EMBERS, FIRE_NEAR, FIRE_REACH, FIRE_GAP, FIRE_WET,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
