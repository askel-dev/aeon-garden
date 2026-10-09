// Headless balance check: run several worlds for N years, print populations each season.
// `node balance.js 5 4 v` adds grass and lows; `arrival` anywhere starts them the way a first
// visit does, everyone moving in over the first days. `plant` has a player plant 5 trees a year, any kind,
// anywhere they'll go, and tells how they did.
// `keeper` plays the keeper game (PLAN.md, "The Field") through the keepers' one door (Sim.act), with a bot:
// `none` does nothing, `lazy` (the default) spends its hours and its seed on any tool, anywhere, a few times a day,
// `good` follows a careful player's script (goodBot). `node balance.js 7 8 keeper good`. It prints a line a year: the
// Surveyor's count that spring, the soil mended and the land grazed bare, the hours and what the bot did with them, the
// Almanac's trouble, the guests' comings and goings (sim.js guestsDay), who's settled and visiting, and the pouch; the
// run ends when the field is ploughed (or won), and the last line tallies how the runs ended. `endless` notes a missed
// count and plays on, to see how far a bot could get.
const Sim = require('./sim.js');
const years = +(process.argv[2] || 5), seeds = +(process.argv[3] || 4), verbose = process.argv[4] === 'v';
const arrival = process.argv.includes('arrival'), keeper = process.argv.includes('keeper');
const bot = keeper ? ['none', 'lazy', 'good'].find(b => process.argv.includes(b)) || 'lazy' : '';
const plant = process.argv.includes('plant'), endless = keeper && process.argv.includes('endless');
const PLANT_KINDS = ['oak', 'beech', 'maple', 'birch', 'alder', 'hawthorn', 'apple', 'cherry', 'pine'];
const perSeason = Sim.SEASON_DAYS * Sim.TPD;
const { W, H } = Sim, YEAR = Sim.YEAR_DAYS * Sim.TPD, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), FLOWERS = Sim.FIELD_KINDS.map(k => k.key);

// A good keeper (PLAN.md, A10): a script a careful player might follow, one order at a time through the day. Its plan
// is laid out from the old oak, along its stub of hedge (u) and across it (v): the flower patches in rows either side
// of the stub, each packet a patch of its own (each one that blooms gives a packet back), the thorns in hedges between
// the rows, the other trees on along the stub. A pond is dug off the brook by the bank boulder with most water about
// it (the frogs' still shallows, then deeper, fish enough for an otter's holt), with a patch beside it for the frogs'
// long grass, and the hours left over go into it. It reads the Almanac: on the first day of a storm season it mows a
// break round the oak and the hedges, and when the fox scouts are coming it lays a hedge by the warren they'll come to.
function goodBot(w) {
  const T = w.terrain, oak = w.decor.find(d => d.kind === 'oak'), stub = w.decor.filter(d => d.kind === 'hawthorn' && dist(d, oak) < 9);
  let ux = 0, uy = 0;
  for (const d of stub) { ux += (d.x - oak.x) / dist(d, oak); uy += (d.y - oak.y) / dist(d, oak); }
  const l = Math.hypot(ux, uy) || 1;
  ux /= l; uy /= l;
  const at = (u, v) => ({ x: oak.x + ux * u - uy * v, y: oak.y + uy * u + ux * v });
  const tile = p => Math.floor(p.y) * W + Math.floor(p.x);
  const ok = p => p.x > 4 && p.y > 4 && p.x < W - 4 && p.y < H - 4 && !w.water[tile(p)];
  const byNear = (list, o) => list.filter(ok).sort((a, b) => dist(a, o) - dist(b, o));
  const heart = at(5, 0), patches = [], rows = [], trees = [];
  for (let i = -16; i <= 16; i++) for (let j = -11; j <= 10; j++) patches.push(at(5 + 9 * i, 4.5 + 9 * j));
  for (let i = -3; i <= 3; i++) for (const v of [9, -9, 18, -18]) rows.push(at(-4 + 9 * i, v));
  for (let i = 1; i <= 8; i++) trees.push(at(7 + 2.5 * i, 0), at(-3 - 2.5 * i, 0));
  const slots = { patch: byNear(patches, heart), hedge: byNear(rows, heart), tree: byNear(trees, heart) };
  // The pond: by the boulder on the brook's bank (above the flood) with the most water about it.
  const brook = Sim.distanceTo(w.ground.map(g => (g <= T.level ? 1 : 0)));
  const rock = w.decor.filter(d => !d.tree && !d.stone && d.size >= Sim.HOLT_ROCK && w.ground[tile(d)] > T.level + T.springFlood && brook[tile(d)] <= Sim.HOLT_BANK)
    .sort((a, b) => Sim.fishNear(w, b) - Sim.fishNear(w, a))[0];
  const room = g => (g > T.level ? 0 : T.level - g >= T.deepAt ? 1 : 0.2);
  // Where a stroke of the spade adds most room for fish about the rock: on the bank, not in the brook (a still pond
  // beside it, for the frogs) and not under the rock.
  const stroke = () => {
    let best = null, most = 0.2;
    for (let y = rock.y - 13; y <= rock.y + 13; y += 1.5) for (let x = rock.x - 13; x <= rock.x + 13; x += 1.5) {
      const p = { x, y };
      if (dist(p, rock) < 4 || dist(p, rock) > 13 || x < 3 || y < 3 || x > W - 3 || y > H - 3 || brook[tile(p)] < 1) continue;
      let gain = 0;
      for (let ty = Math.floor(y - Sim.DIG_R); ty <= y + Sim.DIG_R; ty++) for (let tx = Math.floor(x - Sim.DIG_R); tx <= x + Sim.DIG_R; tx++) {
        const q = ((tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2) / Sim.DIG_R ** 2, g = w.ground[ty * W + tx];
        if (q < 1) gain += room(Math.max(Math.min(g, T.level + Sim.DIG_FLOOR), g - Sim.DIG * (1 - q) ** 2)) - room(g);
      }
      if (gain > most) { best = p; most = gain; }
    }
    return best;
  };
  // The frogs' patch: about 6 tiles from the pond's first stroke, as far from the brook as that goes. The pond's trees:
  // round the rock.
  let pondAt = null, frogPatch = null, banked = 0, strokes = 0;
  const pondPatch = () => {
    let best = null;
    for (let k = 0; k < 12; k++) {
      const s = { x: pondAt.x + 6 * Math.cos(k * Math.PI / 6), y: pondAt.y + 6 * Math.sin(k * Math.PI / 6) };
      if (ok(s) && (!best || brook[tile(s)] > brook[tile(best)])) best = s;
    }
    return best;
  };
  const pondTree = () => {
    const a = (banked++ % 8) * Math.PI / 4, s = { x: rock.x + 3 * Math.cos(a), y: rock.y + 3 * Math.sin(a) };
    return ok(s) ? s : null;
  };
  const done = new Set(), hedges = [];
  const lay = p => ({ kind: 'hedge', x: p.x, y: p.y, x1: p.x + ux * 7.5, y1: p.y + uy * 7.5 });
  const next = () => {
    const p = w.pouch, hours = Sim.hoursLeft(w, 0), a = w.almanac, year = Math.floor(w.tick / YEAR) + 1;
    const scouts = a.next?.trouble?.kind === 'foxes' && a.next.trouble;
    if (scouts && !done.has(`scouts ${year}`) && p.hawthorn >= 3) {   // a hedge by the warren the scouts will come to
      done.add(`scouts ${year}`);
      return lay({ x: scouts.x - 3 * uy, y: scouts.y + 3 * ux });
    }
    if (a.now.trouble?.kind === 'storms') {                  // a break mown round the oak and the hedges
      const spot = [oak, ...hedges].find(s => !done.has(`mow ${year} ${s.x}`));
      if (spot) { done.add(`mow ${year} ${spot.x}`); return { kind: 'mow', x: spot.x, y: spot.y }; }
    }
    if (rock && strokes < 3 && hours >= Sim.DIG_HOURS) return spade();   // first a still pool for the frogs, with a patch by it
    const packet = FLOWERS.find(k => p[k] > 0);
    if (packet) {
      const spot = pondAt && !frogPatch ? (frogPatch = pondPatch()) : slots.patch.shift();
      if (spot) return { kind: 'sow', flower: packet, x: spot.x, y: spot.y };
    }
    if (p.hawthorn >= (year > 1 ? 6 : 3)) {                    // (from the second year, three kept back for the scouts)
      const spot = slots.hedge.shift();
      if (spot) { hedges.push(spot); return lay(spot); }
    }
    const kind = Object.keys(p).find(k => Sim.TREES[k] && k !== 'hawthorn' && p[k] > 0);
    if (kind) {
      const spot = (kind === 'alder' || kind === 'birch') && rock ? pondTree() : null;
      const s = spot || slots.tree.shift();
      if (s) return { kind: 'plant', tree: kind, x: s.x, y: s.y };
    }
    if (rock && hours >= Sim.DIG_HOURS && Sim.fishNear(w, rock) < Sim.HOLT_FISH + 5) return spade();
    return null;
  };
  const spade = () => {
    const s = stroke();
    if (!s) return null;
    pondAt ||= s; strokes++;
    return { kind: 'dig', x: s.x, y: s.y };
  };
  return { turn() { const o = Sim.hoursLeft(w, 0) > 0 && next(); if (o) Sim.act(w, { t: w.tick + 1, by: 0, ...o }); }, rock };
}
const runs = [];                                            // how each keeper run ended: ploughed in spring 'Y3', 'won', or still 'on'
for (let s = 1; s <= seeds; s++) {
  const w = Sim.createWorld(s * 7919, { arrival, keeper });
  const t0 = Date.now();
  const rows = [];
  let pr = s * 2654435761 % 4294967296;                    // the planter's own random numbers, so the meadow's stay its own
  const rand = () => (pr = (pr * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const planted = { tried: 0, ok: 0, lost: {}, sapling: 0, seeded: 0 };
  // A lazy keeper: three times a day, while it has hours, one of the tools at random, anywhere, with seed it has.
  const pick = a => a[Math.floor(rand() * a.length)];
  // A keeper field's book, a page a year: what the keeper did and the hours it took, the guests' comings and goings,
  // the year's trouble, and the Surveyor's count that spring; at the year's end the soil, the pouch and who's here.
  const book = [], page = () => (book[Math.floor(w.tick / YEAR)] ||= { did: {}, hours: 0, news: [], trouble: [], count: '' });
  const good = bot === 'good' && goodBot(w);
  const lazyTurn = () => {
    const p = w.pouch, kinds = Object.keys(p).filter(k => p[k] > 0), trees = kinds.filter(k => Sim.TREES[k]), flowers = kinds.filter(k => !Sim.TREES[k]);
    const x = rand() * Sim.W, y = rand() * Sim.H, what = pick(['plant', 'hedge', 'sow', 'dig', 'mow']), a = rand() * Math.PI * 2;
    const o = what === 'plant' ? trees.length && { kind: 'plant', tree: pick(trees) } : what === 'hedge' ? p.hawthorn && { kind: 'hedge', x1: x + Math.cos(a) * 6, y1: y + Math.sin(a) * 6 }
      : what === 'sow' ? flowers.length && { kind: 'sow', flower: pick(flowers) } : { kind: what };
    if (o) Sim.act(w, { t: w.tick + 1, by: 0, x, y, ...o });
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
  for (let k = 0; k < years * 4 && !w.over; k++) {
    let minR = 1e9, minF = 1e9;
    for (let i = 0; i < perSeason; i++) {
      if (plant && rand() < 5 / (Sim.YEAR_DAYS * Sim.TPD)) {
        planted.tried++;
        for (let k = 0; k < 20; k++) if (typeof Sim.plantTree(w, rand() * Sim.W, rand() * Sim.H, PLANT_KINDS[Math.floor(rand() * PLANT_KINDS.length)]) !== 'string') { planted.ok++; break; }
      }
      if (bot === 'lazy' && w.tick % (Sim.TPD / 3) === 0 && !w.over && Sim.hoursLeft(w, 0) > 0) lazyTurn();
      if (good && w.tick % 20 === 0 && w.tick % Sim.TPD > 100 && w.tick % Sim.TPD < 500 && !w.over) good.turn();
      const hours = keeper && Sim.hoursLeft(w, 0);
      Sim.step(w);
      if (endless && w.over && !w.over.won) w.over = null;     // (the Surveyor's count noted, and on it goes)
      if (keeper && Sim.hoursLeft(w, 0) < hours) page().hours += hours - Sim.hoursLeft(w, 0);
      for (const e of w.events) {
        const when = Sim.SEASONS[Sim.seasonOf(w.tick)].name.slice(0, 2);
        if (e.type === 'acted') page().did[e.order.kind] = (page().did[e.order.kind] || 0) + 1;
        if (e.type === 'acted' && e.order.kind === 'plant') { planted.tried++; planted.ok++; }
        if (e.type === 'acted' && e.order.kind === 'hedge') { planted.tried += e.trees.length; planted.ok += e.trees.length; }
        if (e.type === 'survey') page().count = `${e.had}/${e.want}${e.won ? ' WON' : e.passed ? '' : ' PLOUGHED'}`;
        if (e.type === 'almanac' && e.now.trouble) page().trouble.push(`${when} ${e.now.trouble.kind}`);
        if (e.type === 'almanac' && e.lifeline) page().trouble.push('lifeline: next year gentle');
        if (e.type === 'trouble') page().trouble.push(`(${e.n} sick)`);
        if (e.type === 'arrive' && e.scouts) page().trouble.push(`(${e.who.length} scouts)`);
        if (e.type === 'plantlost') planted.lost[e.cause] = (planted.lost[e.cause] || 0) + 1;
        if (e.type === 'plantgrew') planted.sapling++;
        if (e.type === 'plantseeds') planted.seeded++;
        if (e.type === 'arrive' && !e.founding) arrivals[e.species]++;
        if (e.guest || ['settled', 'fret', 'leave'].includes(e.type)) page().news.push(`${when} ${{ arrive: '+', settled: '!', fret: '?', leave: e.dead ? 'x' : '-' }[e.type]}${e.species}`);
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
    frogs.push(Math.round(w.frogCount));
    fish.push(Math.round(w.fishCount));
    if (keeper && (k % 4 === 3 || w.over)) {
      const g = w.guests, here = st => Sim.GUESTS.filter(s => s !== 'crow' && g[s].state === st).join(',') || '-';
      Object.assign(book[Math.floor(k / 4)] ||= { did: {}, hours: 0, news: [], trouble: [], count: '' }, {
        soil: Math.round(100 * Sim.soilMended(w)) + '%', bare: Math.round(100 * w.bare.reduce((n, d) => n + (d > 2), 0) / w.land) + '%',
        pouch: Object.entries(w.pouch).filter(([, n]) => n).map(([k, n]) => k.slice(0, 4) + n).join(',') || 'empty',
        here: `settled ${here('settled')} visiting ${here('visiting')}` });
    }
    crows.push(w.count.crow);
    owls.push(`${w.count.owl}(${w.decor.filter(d => d.owl).length})`);
    otters.push(`${w.count.otter}(${w.decor.filter(d => d.holt).length})`);
    const grass = w.grass.reduce((a, b) => a + b, 0);
    rows.push(`${Sim.SEASONS[k % 4].name[0]}${Math.floor(k / 4) + 1}:${w.count.rabbit}/${w.count.fox}/${w.count.bee}` + (verbose ? `(g${grass.toFixed(0)} min${minR}/${minF})` : ''));
  }
  const d = w.stats.deaths;
  const hives = w.hives.filter(h => h.queen && !h.cluster).length;
  console.log(`seed ${s}  ${((Date.now() - t0) / 1000).toFixed(1)}s  max ${maxR}/${maxF}  arrivals r${arrivals.rabbit} f${arrivals.fox} b${arrivals.bee} c${arrivals.crow} o${arrivals.owl} ot${arrivals.otter}  kills ${kills} escapes ${escapes}  swarms ${swarms}  hives ${hives}/${w.hives.length}`);
  console.log(`  weather ${JSON.stringify(sky)}  strikes ${strikes}  fires ${fires} (biggest ${burned} tiles)`);
  console.log('  deaths rabbit', JSON.stringify(d.rabbit), 'fox', JSON.stringify(d.fox), 'bee', JSON.stringify(d.bee), 'crow', JSON.stringify(d.crow), 'owl', JSON.stringify(d.owl), 'otter', JSON.stringify(d.otter));
  const tm = Sim.traitMeans(w, 'rabbit'), fm = Sim.traitMeans(w, 'fox');
  const fmt = m => m ? Object.entries(m).map(([k, v]) => `${k}${v.toFixed(2)}`).join(' ') : '-';
  console.log('  rabbit genes', fmt(tm), '| fox genes', fmt(fm));
  console.log('  rabbit coats', JSON.stringify(Sim.coatCounts(w)), ' surprise litters', surprises);
  console.log(`  ground  at cap ${capDays.toFixed(0)}/${years * Sim.SPECIES.rabbit.breedSeasons.length * Sim.SEASON_DAYS} breeding days  crashes ${crashes} recovered ${recovered}  trees ${trees.join(' ')}  summer grass wood ${(shade.wood / shade.n).toFixed(2)} open ${(shade.open / shade.n).toFixed(2)}  rich ${rich.join(' ')}`);
  console.log(`  sickness  outbreaks ${outbreaks} (over ${over})  sick rabbit-days ${sickDays.toFixed(0)}  deaths ${d.rabbit.sickness || 0}  rabbits per burrow at peak ${perBurrow.toFixed(1)}  old cap: at it ${oldCapDays.toFixed(0)} days, crashes ${oldCrashes} recovered ${oldRecovered}  resist ${resist.map(v => v === undefined ? '-' : v.toFixed(2)).join(' ')}`);
  for (let i = 0; i < rows.length; i += 8) console.log('  ' + rows.slice(i, i + 8).join('  '));
  if (keeper) {                                              // (+ came, ! settled, ? restless, - left, x died out)
    book.forEach((b, y) => b.soil && console.log(`  Y${y + 1}  count ${b.count || '-'}  soil ${b.soil} bare ${b.bare}  ${b.hours}h ${Object.entries(b.did).map(([k, n]) => k + n).join(' ') || 'idle'}`
      + `  | ${b.trouble.join(' ') || 'calm'} | ${b.news.join(' ') || 'nobody'} | ${b.here} | pouch ${b.pouch}`));
    runs.push(w.over ? (w.over.won ? 'won' : `Y${w.over.year}`) : 'on');
  }
  const eaten = w.stats.voles;
  console.log(`  voles  ${voles.join(' ')}  eaten ${eaten} (${Math.round(100 * eaten / Math.max(1, eaten + kills))}% of fox meals)  fox hunger ${d.fox.hunger || 0}  vole years ${voleNews.boom} crashes ${voleNews.bust}`);
  const st = w.stats, rm = st.remains;
  const yrs = st.frogYears, pc = k => Math.round(100 * yrs.reduce((a, y) => a + y[k], 0) / Math.max(1, yrs.reduce((a, y) => a + y.laid, 0)));
  console.log(`  frogs  ${frogs.join(' ')}  news ${JSON.stringify(frogNews)}  froglets per spawner ${yrs.map(y => (y.left / Math.max(1, y.spawners)).toFixed(1)).join(' ')}` +
    `  spawn stranded ${pc('stranded')}% eaten by crows ${pc('eaten')}%  frogs eaten by foxes ${st.frogs} (${Math.round(100 * st.frogs / Math.max(1, st.frogs + eaten))}% of their mousing) by owls ${st.owlFrogs}`);
  console.log(`  fish  ${fish.join(' ')}`);
  console.log(`  crows  ${crows.join(' ')}  remains ${rm.left} (eaten up by crows ${rm.eaten}, rotted ${rm.rotted})  gatherings ${gatherings}` +
    `  acorns buried ${st.cached} dug up ${st.dugUp} came up ${st.planted}  oaks/beeches ${oaks0} -> ${oaks()}`);
  console.log(`  owls (hollows)  ${owls.join(' ')}  hollows taken ${owlNests}  owlets ${st.births.owl} fledged ${fledged} flew off ${leaving}` +
    `  voles eaten ${st.owlVoles} (foxes ${eaten})  kits taken ${d.rabbit.owl || 0}`);
  console.log(`  otters (holts)  ${otters.join(' ')}  holts made ${holts}  cubs ${st.births.otter} out ${cubsOut} left ${otterLeft}` +
    `  fish caught ${st.fish} frogs ${st.otterFrogs}`);
  if (plant || bot === 'lazy') {
    const up = w.decor.filter(t => t.planted && Sim.standing(t)), stages = {};
    for (const t of up) { const g = Sim.treeStage(w, t); stages[g] = (stages[g] || 0) + 1; }
    console.log(`  planted  ${planted.ok}/${planted.tried}  lost ${JSON.stringify(planted.lost)}  grew past the rabbits ${planted.sapling}  bore seed ${planted.seeded}  standing ${JSON.stringify(stages)}`);
  }
}
if (keeper) {
  const tally = {};
  for (const r of runs) tally[r] = (tally[r] || 0) + 1;
  console.log(`keeper ${bot}: ${runs.join(' ')}  (${Object.entries(tally).sort().map(([r, n]) => `${r} ×${n}`).join(', ')}: ploughed that spring, won, or still going)`);
}
