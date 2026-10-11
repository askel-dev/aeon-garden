// Headless balance check: run several worlds for N years, print populations each season.
// `node balance.js 5 4 v` adds grass and lows; `arrival` anywhere starts them the way a first
// visit does, everyone moving in over the first days. `plant` has a player plant 5 trees a year, any kind,
// anywhere they'll go, and tells how they did. `keep` makes keeper meadows (?keep) where a keeper digs one pond early in
// the first spring, and tells who came to it: the crows to its turned earth, the frogs, the reeds, the spawn; and sows
// two flower strips near the hive, and tells when they flowered, when the bees found them and how much they sipped there;
// and plants a hedge by a burrow, and tells when it was young, blossomed and bore haws, its whips, and the rabbits that got
// away from a fox into it. `nohedge` leaves the hedge out, to compare the rabbits with and without it.
// A keeper meadow has its Dry Year in the summer of year 2: `keep` then runs each seed again with a keeper who does
// nothing, and prints the two side by side, season by season (the green share, the water, rabbits, bees and hives,
// frogs, foxes, and anything that died out). `idle` runs only the meadows where the keeper does nothing.
const Sim = require('./sim.js');
const years = +(process.argv[2] || 5), seeds = +(process.argv[3] || 4), verbose = process.argv[4] === 'v';
const arrival = process.argv.includes('arrival'), plant = process.argv.includes('plant'), nohedge = process.argv.includes('nohedge');
const idle = process.argv.includes('idle'), keep = process.argv.includes('keep') || idle;
const PLANT_KINDS = ['oak', 'beech', 'maple', 'birch', 'alder', 'hawthorn', 'apple', 'cherry', 'pine'];
const perSeason = Sim.SEASON_DAYS * Sim.TPD;
// One seed's meadow, run for the years (the keeper idle or not), printing through log; gives back its Dry Year rows.
function runSeed(s, idleRun, log) {
  const w = Sim.createWorld(s * 7919, keep ? { arrival, keep } : { arrival });
  const dryRows = [], extinct = [];                          // (keep) each season's end; what died out, and when
  const t0 = Date.now();
  const rows = [];
  let pr = s * 2654435761 % 4294967296;                    // the planter's own random numbers, so the meadow's stay its own
  const rand = () => (pr = (pr * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const planted = { tried: 0, ok: 0, lost: {}, sapling: 0, seeded: 0 };
  // The keeper's pond: dug on the first morning after DIG_DAY, the day the crows first came down to it, the frogs
  // found it (and from how far), the reeds came up, the spawn laid in it each spring, the frogs round it each season's end.
  // The keeper digs it with a short scribble of the spade (SCRIBBLE, tiles from where it starts), about 30 tiles.
  const DIG_DAY = 1, kept = { pond: null, tries: 0, tiles: 0, spot: null, crows: -1, frogs: -1, from: 0, reeds: -1, spawn: [], round: [] };
  const SCRIBBLE = [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0], [1.2, 0], [-1.2, 0.8], [1.2, 0.8]];
  // Then two strips, each a straight stroke 7 tiles long within 12 of the hive: the days from sowing to flowers and to the
  // first bee, and the sips on them each season.
  const strips = { list: [], tries: 0, hives: [], bloom: [], bees: [], sips: [], last: 0 };
  const sipped = () => strips.list.reduce((a, f) => a + f.sips, 0);
  // And a hedge: a straight stroke of about 12 whips (HEDGE_LONG tiles) across open grass (good grass, if it can) within 10
  // of one of the three busiest burrows, as a keeper would plant one to shelter a warren. The days
  // from planting to young, to its first blossom and its first haws, the whips standing at each year's end, and the rabbits
  // that got away from a fox into it each season; and the rabbits' most and mean, with it and without (nohedge).
  const HEDGE_LONG = 16.5, hedge = { h: null, tries: 0, young: '-', bloom: '-', haws: '-', standing: [], esc: [] };
  let sumR = 0, ticks = 0;
  const day = () => (w.tick / Sim.TPD).toFixed(1);
  const pondAround = field => {
    const p = kept.pond;
    let n = 0;
    for (let y = Math.max(0, p.box.y0 - 3); y <= Math.min(Sim.H - 1, p.box.y1 + 3); y++)
      for (let x = Math.max(0, p.box.x0 - 3); x <= Math.min(Sim.W - 1, p.box.x1 + 3); x++) n += field[y * Sim.W + x];
    return n;
  };
  let arrivals = Object.fromEntries(Sim.KINDS.map(k => [k, 0])), surprises = 0, kills = 0, escapes = 0, strikes = 0, fires = 0, burned = 0, swarms = 0;
  // The crows at each season's end, their gatherings at remains, and the oaks and beeches at the start and the end.
  const crows = [], oaks = () => ['oak', 'beech'].map(k => w.decor.filter(d => d.kind === k && Sim.standing(d) && d.size >= Sim.SEEDLING).length).join('/');
  const oaks0 = oaks();
  let gatherings = 0;
  // The owls at each season's end and their hollows, owlets fledged, the young that flew off, and the crows mobbing them.
  const owls = [];
  let fledged = 0, leaving = 0, owlNests = 0;
  // The otters at each season's end and their holts, holts made, cubs out of the holt, and the grown ones that left.
  const otters = [];
  let holts = 0, cubsOut = 0, otterLeft = 0;
  const sky = {};
  let maxR = 0, maxF = 0;
  // The ground: days the rabbits sat at their cap, crashes (under a quarter of it) and recoveries (back over
  // three quarters), the trees at the start and each winter's end, grass under the trees, rich ground.
  const capR = Sim.SPECIES.rabbit.cap * w.room, trees = [w.treeCount], rich = [], shade = { wood: 0, open: 0, n: 0 };
  let capDays = 0, crashes = 0, recovered = 0, low = null;
  const voles = [], voleNews = { boom: 0, bust: 0 };   // the meadow's voles at each season's end, and its vole years and crashes
  const frogs = [], frogNews = { spawn: 0, stranded: 0, froglets: 0, big: 0, poor: 0 };   // the frogs at each season's end, and the frog news
  const fish = [];                                       // the fish at each season's end
  // The sickness: outbreaks begun and over, rabbit-days of it, rabbits per burrow at the peak, the resist gene
  // each winter's end, and the cap's numbers again against the old cap (CROWDED), to compare with before it rose.
  const oldCap = Sim.CROWDED * w.room, resist = [Sim.traitMeans(w, 'rabbit')?.resist];
  let outbreaks = 0, over = 0, sickDays = 0, perBurrow = 0, oldCapDays = 0, oldCrashes = 0, oldRecovered = 0, oldLow = null;
  for (let k = 0; k < years * 4; k++) {
    let minR = 1e9, minF = 1e9;
    for (let i = 0; i < perSeason; i++) {
      if (plant && rand() < 5 / (Sim.YEAR_DAYS * Sim.TPD)) {
        planted.tried++;
        for (let k = 0; k < 20; k++) if (typeof Sim.plantTree(w, rand() * Sim.W, rand() * Sim.H, PLANT_KINDS[Math.floor(rand() * PLANT_KINDS.length)]) !== 'string') { planted.ok++; break; }
      }
      if (keep && !idleRun && !kept.pond && w.tick >= DIG_DAY * Sim.TPD) {
        for (; kept.tries < 4000 && !kept.pond; kept.tries++) {
          const x = Math.floor(rand() * Sim.W) + 0.5, y = Math.floor(rand() * Sim.H) + 0.5, pts = SCRIBBLE.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
          const p = Sim.pondPlan(w, pts);
          if (p.ok && p.lasting >= 6) { kept.pond = Sim.digPond(w, pts); kept.tiles = p.lasting + p.spring + p.dry; kept.spot = w.turned[w.turned.length - 1]; }
        }
        kept.dug = day();
        const h = w.hives.find(h => !h.cluster);
        for (; h && strips.tries < 4000 && strips.list.length < 2; strips.tries++) {
          const a = rand() * Math.PI * 2, d = rand() * 12, x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d, b = rand() * Math.PI;
          const pts = [{ x, y }, { x: x + Math.cos(b) * 7, y: y + Math.sin(b) * 7 }], p = Sim.stripPlan(w, pts);
          if (p.ok && p.sown >= 10) { strips.list.push(Sim.sowStrip(w, pts)); strips.hives.push(p.hives); }
        }
        const lives = b => w.creatures.filter(c => c.alive && c.home === b).length;
        const homes = w.burrows.filter(b => b.dug >= 1).sort((a, b) => lives(b) - lives(a)).slice(0, 3);
        for (; !nohedge && homes.length && hedge.tries < 4000 && !hedge.h; hedge.tries++) {
          const b = homes[Math.floor(rand() * homes.length)], a = rand() * Math.PI * 2, d = rand() * 10, x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d, c = rand() * Math.PI;
          const pts = [{ x, y }, { x: x + Math.cos(c) * HEDGE_LONG, y: y + Math.sin(c) * HEDGE_LONG }], p = Sim.hedgePlan(w, pts);
          const at = s => Math.floor(s.y) * Sim.W + Math.floor(s.x), ok = p.spots.filter(s => !s.blocker);
          if (p.ok && p.whips >= 10 && ok.every(s => w.wood[at(s)] < 0.3) && (hedge.tries > 2000 || ok.reduce((n, s) => n + w.fert[at(s)], 0) / ok.length > 0.4)) hedge.h = Sim.plantHedge(w, pts);
        }
      }
      Sim.step(w);
      if (kept.pond && kept.crows < 0) {
        const p = kept.spot;
        if (w.creatures.some(c => c.alive && c.species === 'crow' && (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < p.r * p.r)) kept.crows = day();
      }
      if (kept.pond && Sim.seasonOf(w.tick) === 0) {
        let n = 0;
        for (let i = 0; i < w.dug.length; i++) if (w.dug[i] === kept.pond.id) n += w.spawn[i];
        const y = Sim.clock(w).year - 1;
        kept.spawn[y] = Math.max(kept.spawn[y] || 0, n);
      }
      for (const e of w.events) {
        if (e.type === 'extinct') extinct.push(`${e.species} ${Sim.SEASONS[Sim.seasonOf(w.tick)].name[0]}${Sim.clock(w).year}`);
        if (e.type === 'frogsfound' && kept.frogs < 0) { kept.frogs = day(); kept.from = e.from; }
        if (e.type === 'pondgrew' && kept.reeds < 0) kept.reeds = day();
        if (e.type === 'stripbloom') strips.bloom[strips.list.indexOf(e.field)] = ((e.t - e.field.sown) / Sim.TPD).toFixed(1);
        if (e.type === 'beesfound') strips.bees[strips.list.indexOf(e.field)] = ((e.t - e.field.sown) / Sim.TPD).toFixed(1);
        if (e.type === 'hedgeyoung' || e.type === 'hedgebloom' || e.type === 'hedgehaws') hedge[e.type.slice(5)] = ((e.t - e.hedge.planted) / Sim.TPD).toFixed(1);
        if (e.type === 'escape' && e.how === 'hedge') hedge.esc[k] = (hedge.esc[k] || 0) + 1;
        if (e.type === 'plantlost') planted.lost[e.cause] = (planted.lost[e.cause] || 0) + 1;
        if (e.type === 'plantgrew') planted.sapling++;
        if (e.type === 'plantseeds') planted.seeded++;
        if (e.type === 'arrive' && !e.founding) arrivals[e.species]++;
        if (e.type === 'death' && e.cause === 'fox') kills++;
        if (e.type === 'escape') escapes++;
        if (e.type === 'birth' && e.surprise.length) surprises++;
        if (e.type === 'lightning') strikes++;
        if (e.type === 'swarm') swarms++;
        if (e.type === 'fireout') { fires++; burned = Math.max(burned, e.burned); }
        if (e.type === 'weather') sky[e.kind] = (sky[e.kind] || 0) + 1;
        if (e.type === 'voles') voleNews[e.boom ? 'boom' : 'bust']++;
        if (e.type === 'frogs') frogNews[e.what]++;
        if (e.type === 'frogyear' && (e.big || e.poor)) frogNews[e.big ? 'big' : 'poor']++;
        if (e.type === 'outbreak') outbreaks++;
        if (e.type === 'outbreakover') over++;
        if (e.type === 'gathering') gatherings++;
        if (e.type === 'fledge') fledged++;
        if (e.type === 'owlleaves') leaving++;
        if (e.type === 'owlnest') owlNests++;
        if (e.type === 'holt') holts++;
        if (e.type === 'cubsout') cubsOut++;
        if (e.type === 'otterleaves') otterLeft++;
      }
      w.events.length = 0;
      minR = Math.min(minR, w.count.rabbit); minF = Math.min(minF, w.count.fox);
      sumR += w.count.rabbit; ticks++;
      if (w.count.rabbit > maxR) perBurrow = w.count.rabbit / w.burrows.filter(b => b.dug >= 1).length;
      maxR = Math.max(maxR, w.count.rabbit); maxF = Math.max(maxF, w.count.fox);
      sickDays += w.sick / Sim.TPD;
      if (w.count.rabbit + w.expecting.rabbit >= oldCap && Sim.SPECIES.rabbit.breedSeasons.includes(Sim.seasonOf(w.tick))) oldCapDays += 1 / Sim.TPD;
      if (w.count.rabbit > 0.75 * oldCap) { if (oldLow) oldRecovered++; oldLow = false; }
      else if (oldLow === false && w.count.rabbit < 0.25 * oldCap) { oldLow = true; oldCrashes++; }
      if (w.count.rabbit + w.expecting.rabbit >= capR && Sim.SPECIES.rabbit.breedSeasons.includes(Sim.seasonOf(w.tick))) capDays += 1 / Sim.TPD;
      if (w.count.rabbit > 0.75 * capR) { if (low) recovered++; low = false; }  // (null till they first get there)
      else if (low === false && w.count.rabbit < 0.25 * capR) { low = true; crashes++; }
    }
    if (k % 4 === 3) { trees.push(w.treeCount); resist.push(Sim.traitMeans(w, 'rabbit')?.resist); }
    if (k % 4 === 3 && hedge.h) hedge.standing.push(w.decor.filter(d => d.hedge === hedge.h.id && Sim.standing(d)).length);
    if (k % 4 === 1) {                                       // end of summer: grass under the trees and out in the open
      let gw = 0, nw = 0, go = 0, no = 0, r = 0;
      for (let i = 0; i < w.grass.length; i++) {
        if (w.water[i]) continue;
        if (w.wood[i] > 0.6) { gw += w.grass[i]; nw++; } else if (w.wood[i] < 0.1) { go += w.grass[i]; no++; }
        if (w.rich && w.rich[i] > 0.2) r++;
      }
      shade.wood += nw ? gw / nw : 0; shade.open += no ? go / no : 0; shade.n++;
      rich.push(w.rich ? (100 * r / w.land).toFixed(1) + '%' : '-');
    }
    voles.push(Math.round(w.voleCount));
    if (kept.pond) kept.round.push(Math.round(pondAround(w.frogs)));
    if (strips.list.length) { strips.sips.push(sipped() - strips.last); strips.last = sipped(); }
    frogs.push(Math.round(w.frogCount));
    fish.push(Math.round(w.fishCount));
    crows.push(w.count.crow);
    owls.push(`${w.count.owl}(${w.decor.filter(d => d.owl).length})`);
    otters.push(`${w.count.otter}(${w.decor.filter(d => d.holt).length})`);
    const grass = w.grass.reduce((a, b) => a + b, 0);
    if (keep) {
      let water = 0;
      for (const v of w.water) if (v) water++;
      dryRows.push({ at: `${Sim.SEASONS[k % 4].name.slice(0, 2)}${Math.floor(k / 4) + 1}`, green: Math.round(100 * Sim.greenShare(w)), water, r: w.count.rabbit,
        b: w.count.bee, hives: w.hives.filter(h => h.queen && !h.cluster).length, frogs: Math.round(w.frogCount), f: w.count.fox });
    }
    rows.push(`${Sim.SEASONS[k % 4].name[0]}${Math.floor(k / 4) + 1}:${w.count.rabbit}/${w.count.fox}/${w.count.bee}` + (verbose ? `(g${grass.toFixed(0)} min${minR}/${minF})` : ''));
  }
  const d = w.stats.deaths;
  const hives = w.hives.filter(h => h.queen && !h.cluster).length;
  log(`seed ${s}  ${((Date.now() - t0) / 1000).toFixed(1)}s  max ${maxR}/${maxF}  arrivals r${arrivals.rabbit} f${arrivals.fox} b${arrivals.bee} c${arrivals.crow} o${arrivals.owl} ot${arrivals.otter}  kills ${kills} escapes ${escapes}  swarms ${swarms}  hives ${hives}/${w.hives.length}`);
  log(`  weather ${JSON.stringify(sky)}  strikes ${strikes}  fires ${fires} (biggest ${burned} tiles)`);
  log('  deaths rabbit', JSON.stringify(d.rabbit), 'fox', JSON.stringify(d.fox), 'bee', JSON.stringify(d.bee), 'crow', JSON.stringify(d.crow), 'owl', JSON.stringify(d.owl), 'otter', JSON.stringify(d.otter));
  const tm = Sim.traitMeans(w, 'rabbit'), fm = Sim.traitMeans(w, 'fox');
  const fmt = m => m ? Object.entries(m).map(([k, v]) => `${k}${v.toFixed(2)}`).join(' ') : '-';
  log('  rabbit genes', fmt(tm), '| fox genes', fmt(fm));
  log('  rabbit coats', JSON.stringify(Sim.coatCounts(w)), ' surprise litters', surprises);
  log(`  ground  at cap ${capDays.toFixed(0)}/${years * Sim.SPECIES.rabbit.breedSeasons.length * Sim.SEASON_DAYS} breeding days  crashes ${crashes} recovered ${recovered}  trees ${trees.join(' ')}  summer grass wood ${(shade.wood / shade.n).toFixed(2)} open ${(shade.open / shade.n).toFixed(2)}  rich ${rich.join(' ')}`);
  log(`  sickness  outbreaks ${outbreaks} (over ${over})  sick rabbit-days ${sickDays.toFixed(0)}  deaths ${d.rabbit.sickness || 0}  rabbits per burrow at peak ${perBurrow.toFixed(1)}  old cap: at it ${oldCapDays.toFixed(0)} days, crashes ${oldCrashes} recovered ${oldRecovered}  resist ${resist.map(v => v === undefined ? '-' : v.toFixed(2)).join(' ')}`);
  for (let i = 0; i < rows.length; i += 8) log('  ' + rows.slice(i, i + 8).join('  '));
  const eaten = w.stats.voles;
  log(`  voles  ${voles.join(' ')}  eaten ${eaten} (${Math.round(100 * eaten / Math.max(1, eaten + kills))}% of fox meals)  fox hunger ${d.fox.hunger || 0}  vole years ${voleNews.boom} crashes ${voleNews.bust}`);
  const st = w.stats, rm = st.remains;
  const yrs = st.frogYears, pc = k => Math.round(100 * yrs.reduce((a, y) => a + y[k], 0) / Math.max(1, yrs.reduce((a, y) => a + y.laid, 0)));
  log(`  frogs  ${frogs.join(' ')}  news ${JSON.stringify(frogNews)}  froglets per spawner ${yrs.map(y => (y.left / Math.max(1, y.spawners)).toFixed(1)).join(' ')}` +
    `  spawn stranded ${pc('stranded')}% eaten by crows ${pc('eaten')}%  frogs eaten by foxes ${st.frogs} (${Math.round(100 * st.frogs / Math.max(1, st.frogs + eaten))}% of their mousing) by owls ${st.owlFrogs}`);
  log(`  fish  ${fish.join(' ')}`);
  log(`  crows  ${crows.join(' ')}  remains ${rm.left} (eaten up by crows ${rm.eaten}, rotted ${rm.rotted})  gatherings ${gatherings}` +
    `  acorns buried ${st.cached} dug up ${st.dugUp} came up ${st.planted}  oaks/beeches ${oaks0} -> ${oaks()}`);
  log(`  owls (hollows)  ${owls.join(' ')}  hollows taken ${owlNests}  owlets ${st.births.owl} fledged ${fledged} flew off ${leaving}` +
    `  voles eaten ${st.owlVoles} (foxes ${eaten})  kits taken ${d.rabbit.owl || 0}`);
  log(`  otters (holts)  ${otters.join(' ')}  holts made ${holts}  cubs ${st.births.otter} out ${cubsOut} left ${otterLeft}` +
    `  fish caught ${st.fish} frogs ${st.otterFrogs}`);
  if (keep) {
    const p = kept.pond;
    log(p ? `  keeper  dug ${w.waters[p.id].name} day ${kept.dug} (${kept.tries} tries, ${kept.tiles} tiles: lasting ${p.lasting} spring ${p.spring} deep ${p.deep})`
      + `  crows day ${kept.crows}  frogs found it day ${kept.frogs} from ${kept.from} tiles  reeds day ${kept.reeds}`
      + `  spawn in it by spring ${kept.spawn.slice(0, years).map(n => (n || 0).toFixed(1)).join(' ')}  frogs round it ${kept.round.join(' ')}`
      : `  keeper  found nowhere to dig in ${kept.tries} tries`);
    const sl = strips.list;
    log(sl.length ? `  strips  sowed ${sl.map(f => f.name).join(' and ')} day ${kept.dug} (${strips.tries} tries, ${sl.map(f => w.plants.filter(p => p.field === f).length).join(', ')} flowers, `
      + `${strips.hives.join(', ')} hives in reach)  in flower after ${sl.map((f, k) => strips.bloom[k] ?? '-').join(' ')} days  bees after ${sl.map((f, k) => strips.bees[k] ?? '-').join(' ')} days`
      + `  sips on them by season ${strips.sips.join(' ')}` : `  strips  found nowhere to sow in ${strips.tries} tries`);
    const hd = hedge.h, esc = Array.from({ length: years * 4 }, (_, k) => hedge.esc[k] || 0);
    log((hd ? `  hedge  planted ${hd.name} day ${(hd.planted / Sim.TPD).toFixed(1)} (${hedge.tries} tries, ${hd.whips} whips)  young after ${hedge.young} days`
      + `  blossom after ${hedge.bloom}  haws after ${hedge.haws}  whips standing by year ${hedge.standing.join(' ')}  escapes into it by season ${esc.join(' ')} (${hd.escapes} in all)`
      : nohedge ? '  hedge  none (nohedge)' : `  hedge  found nowhere to plant in ${hedge.tries} tries`) + `  rabbits max ${maxR} mean ${(sumR / ticks).toFixed(1)}`);
  }
  if (plant) {
    const up = w.decor.filter(t => t.planted && Sim.standing(t)), stages = {};
    for (const t of up) { const g = Sim.treeStage(w, t); stages[g] = (stages[g] || 0) + 1; }
    log(`  planted  ${planted.ok}/${planted.tried}  lost ${JSON.stringify(planted.lost)}  grew past the rabbits ${planted.sapling}  bore seed ${planted.seeded}  standing ${JSON.stringify(stages)}`);
  }
  return { rows: dryRows, extinct, maxR, meanR: sumR / ticks };
}

// The Dry Year, season by season: the keeper's meadow (a) against the idle one (b), or just one.
const dryLine = r => `green ${String(r.green).padStart(2)}% water ${String(r.water).padStart(4)}  r${String(r.r).padStart(3)} b${String(r.b).padStart(3)}(${r.hives}) frogs ${String(r.frogs).padStart(4)} f${String(r.f).padStart(2)}`;
function printDry(a, b) {
  console.log(b ? '  dry year (summer of year 2)  keeper' + ' '.repeat(36) + '| idle' : '  dry year (summer of year 2)  idle');
  for (let k = 0; k < Math.min(12, a.rows.length); k++) console.log(`    ${a.rows[k].at}  ${dryLine(a.rows[k])}` + (b ? `  | ${dryLine(b.rows[k])}` : ''));
  console.log(`    died out  ${a.extinct.join(', ') || 'none'}` + (b ? `  | ${b.extinct.join(', ') || 'none'}` : '')
    + `   rabbits max ${a.maxR} mean ${a.meanR.toFixed(0)}` + (b ? ` | max ${b.maxR} mean ${b.meanR.toFixed(0)}` : ''));
}

for (let s = 1; s <= seeds; s++) {
  const a = runSeed(s, idle, console.log);
  if (keep) printDry(a, idle ? null : runSeed(s, true, () => {}));
}
