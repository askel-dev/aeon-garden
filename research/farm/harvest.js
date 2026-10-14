// What the meadow could spare a farmer: an experiment, never part of the game.
// node research/farm/harvest.js [years] [seeds] [share...] [keep] [careful]
// A farmer takes `share` of what the meadow makes each day it's there to take, and it prints, per share, what was
// taken in a year and what it did to the animals. Nothing in sim.js changes: the farmer reaches into the world
// between steps, the way balance.js's keeper does.
//  - honey: in summer and autumn, the share of each hive's honey (careful: only above WINTER_RESERVE a bee)
//  - apples and nuts: in autumn, the share of the windfalls lying under the trees, each day
//  - fish: each day, share/5 of the fish in the lasting water (so `share` of the stock a season, roughly)
//  - wood: every log as it falls (share of them, by size), so it never rots into the ground
const Sim = require('../../sim.js');
const args = process.argv.slice(2);
const years = +(args[0] || 3), seeds = +(args[1] || 6);
const shares = args.slice(2).filter(a => !isNaN(+a)).map(Number);
const keep = args.includes('keep'), careful = args.includes('careful');
const WINTER_RESERVE = 60;   // honey left for each bee when careful (WINTER_HONEY is 50)
const JAR = 100;             // honey in a jar
if (!shares.length) shares.push(0, 0.25, 0.5, 0.8);

function run(seed, share) {
  const w = Sim.createWorld(seed * 7919, keep ? { keep: true } : {});
  let pr = seed * 2654435761 % 4294967296;
  const rand = () => (pr = (pr * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const take = n => { const t = n * share; return Math.floor(t) + (rand() < t % 1 ? 1 : 0); };   // a whole number, fair on average
  const got = { honey: 0, apples: 0, nuts: 0, fish: 0, wood: 0 };
  const perYear = [];
  const seen = new Set();
  const pop = { rabbit: 0, fox: 0, bee: 0, otter: 0, crow: 0 }, mins = { rabbit: 1e9, bee: 1e9, fox: 1e9 };
  let days = 0, beeGone = 0, beeOut = false, hivesEnd = 0, honeyPeak = 0;
  const yearOf = () => Math.floor(w.tick / (Sim.YEAR_DAYS * Sim.TPD));
  for (let t = 0; t < years * Sim.YEAR_DAYS * Sim.TPD; t++) {
    Sim.step(w);
    if (w.tick % Sim.TPD !== Sim.TPD / 2) continue;          // the farmer goes round once a day, at noon
    const s = Sim.seasonOf(w.tick), y = yearOf();
    perYear[y] ??= { honey: 0, apples: 0, nuts: 0, fish: 0, wood: 0, honeyMade: 0 };
    days++;
    for (const k in pop) pop[k] += w.count[k] || 0;
    for (const k in mins) mins[k] = Math.min(mins[k], w.count[k] || 0);
    if (w.count.bee === 0 && !beeOut) { beeOut = true; beeGone++; } else if (w.count.bee > 0) beeOut = false;
    let honeyNow = 0;
    for (const h of w.hives) if (!h.cluster) honeyNow += h.honey;
    honeyPeak = Math.max(honeyPeak, honeyNow);
    if (share > 0) {
      if (s === 1 || s === 2) for (const h of w.hives) {
        if (h.cluster || !h.queen) continue;
        const spare = careful ? Math.max(0, h.honey - WINTER_RESERVE * Math.max(h.bees, 10)) : h.honey;
        const n = spare * share / Sim.SEASON_DAYS;           // a season's share, a day at a time
        h.honey -= n; got.honey += n; perYear[y].honey += n;
      }
      if (s === 2) for (const d of w.orchard) {
        if (!d.windfall) continue;
        const n = Math.min(d.windfall, take(d.windfall));
        d.windfall -= n; w.windfalls -= n;
        const k = d.kind === 'apple' ? 'apples' : 'nuts';
        got[k] += n; perYear[y][k] += n;
      }
      let f = 0;
      for (let i = 0; i < w.fish.length; i++) if (w.fish[i] > 0) { const n = w.fish[i] * share / Sim.SEASON_DAYS; w.fish[i] -= n; f += n; }
      w.fishCount -= f; got.fish += f; perYear[y].fish += f;
    }
    for (const d of w.decor) {                                // the logs: a share of them carried off as they fall
      if (!d.tree || !d.fallen || d.gone || seen.has(d)) continue;
      seen.add(d);
      if (share > 0 && rand() < share) { d.gone = true; w.treesMoved = true; got.wood += d.size; perYear[y].wood += d.size; }
      else perYear[y].left = (perYear[y].left || 0) + d.size;
    }
  }
  hivesEnd = w.hives.filter(h => !h.cluster && h.queen).length;
  const mean = k => Math.round(pop[k] / days);
  return { got, perYear, mean: Object.fromEntries(Object.keys(pop).map(k => [k, mean(k)])), mins, beeGone, hivesEnd, honeyPeak, beesEnd: w.count.bee, rabbitsEnd: w.count.rabbit };
}

const t0 = Date.now();
console.log(`${years} years, ${seeds} seeds, ${keep ? 'keeper meadows (the Dry Year in year 2)' : 'the meadow you watch'}, honey ${careful ? `careful (leaves ${WINTER_RESERVE} a bee)` : 'greedy'}`);
console.log('share  | a year: jars of honey  apples  nuts  fish  wood(log size) | means: rabbits foxes bees otters crows | bees died out (seeds) | hives at the end | lowest rabbits, bees');
for (const share of shares) {
  const rs = [];
  for (let s = 1; s <= seeds; s++) rs.push(run(s, share));
  const avg = f => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  const yr = k => (avg(r => r.got[k]) / years);
  const lowR = rs.map(r => r.mins.rabbit).join('/'), lowB = rs.map(r => r.mins.bee).join('/');
  console.log(`${share.toFixed(2)}   | ${(yr('honey') / JAR).toFixed(1).padStart(5)} ${yr('apples').toFixed(1).padStart(7)} ${yr('nuts').toFixed(1).padStart(5)} ${yr('fish').toFixed(0).padStart(5)} ${yr('wood').toFixed(1).padStart(6)}`
    + `        | ${['rabbit', 'fox', 'bee', 'otter', 'crow'].map(k => avg(r => r.mean[k]).toFixed(0).padStart(4)).join(' ')}`
    + `                  | ${rs.filter(r => r.beeGone).length}/${seeds} | ${avg(r => r.hivesEnd).toFixed(1)} | ${lowR}; ${lowB}`);
  if (args.includes('v')) for (const [i, r] of rs.entries()) console.log('     seed', i + 1, r.perYear.map((p, y) => `y${y + 1}: ${(p.honey / JAR).toFixed(0)}j ${p.apples}a ${p.nuts}n ${p.fish.toFixed(0)}f ${p.wood.toFixed(0)}w/${(p.left || 0).toFixed(0)}`).join('  '), 'peak honey', r.honeyPeak.toFixed(0));
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
