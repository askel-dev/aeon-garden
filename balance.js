// Headless balance check: run several worlds for N years, print populations each season.
// `node balance.js 5 4 v` adds grass and lows; `arrival` anywhere starts them the way a first
// visit does, everyone moving in over the first days.
const Sim = require('./sim.js');
const years = +(process.argv[2] || 5), seeds = +(process.argv[3] || 4), verbose = process.argv[4] === 'v';
const arrival = process.argv.includes('arrival');
const perSeason = Sim.SEASON_DAYS * Sim.TPD;
for (let s = 1; s <= seeds; s++) {
  const w = Sim.createWorld(s * 7919, { arrival });
  const t0 = Date.now();
  const rows = [];
  let arrivals = Object.fromEntries(Sim.KINDS.map(k => [k, 0])), surprises = 0, kills = 0, escapes = 0, strikes = 0, fires = 0, burned = 0, swarms = 0;
  // The crows at each season's end, their gatherings at remains, and the oaks and beeches at the start and the end.
  const crows = [], oaks = () => ['oak', 'beech'].map(k => w.decor.filter(d => d.kind === k && Sim.standing(d) && d.size >= Sim.SEEDLING).length).join('/');
  const oaks0 = oaks();
  let gatherings = 0;
  // The owls at each season's end and their hollows, owlets fledged, the young that flew off, and the crows mobbing them.
  const owls = [];
  let fledged = 0, leaving = 0, owlNests = 0;
  const sky = {};
  let maxR = 0, maxF = 0;
  // The ground: days the rabbits sat at their cap, crashes (under a quarter of it) and recoveries (back over
  // three quarters), the trees at the start and each winter's end, grass under the trees, rich ground.
  const capR = Sim.SPECIES.rabbit.cap * w.room, trees = [w.treeCount], rich = [], shade = { wood: 0, open: 0, n: 0 };
  let capDays = 0, crashes = 0, recovered = 0, low = null;
  const voles = [], voleNews = { boom: 0, bust: 0 };   // the meadow's voles at each season's end, and its vole years and crashes
  // The sickness: outbreaks begun and over, rabbit-days of it, rabbits per burrow at the peak, the resist gene
  // each winter's end, and the cap's numbers again against the old cap (CROWDED), to compare with before it rose.
  const oldCap = Sim.CROWDED * w.room, resist = [Sim.traitMeans(w, 'rabbit')?.resist];
  let outbreaks = 0, over = 0, sickDays = 0, perBurrow = 0, oldCapDays = 0, oldCrashes = 0, oldRecovered = 0, oldLow = null;
  for (let k = 0; k < years * 4; k++) {
    let minR = 1e9, minF = 1e9;
    for (let i = 0; i < perSeason; i++) {
      Sim.step(w);
      for (const e of w.events) {
        if (e.type === 'arrive' && !e.founding) arrivals[e.species]++;
        if (e.type === 'death' && e.cause === 'fox') kills++;
        if (e.type === 'escape') escapes++;
        if (e.type === 'birth' && e.surprise.length) surprises++;
        if (e.type === 'lightning') strikes++;
        if (e.type === 'swarm') swarms++;
        if (e.type === 'fireout') { fires++; burned = Math.max(burned, e.burned); }
        if (e.type === 'weather') sky[e.kind] = (sky[e.kind] || 0) + 1;
        if (e.type === 'voles') voleNews[e.boom ? 'boom' : 'bust']++;
        if (e.type === 'outbreak') outbreaks++;
        if (e.type === 'outbreakover') over++;
        if (e.type === 'gathering') gatherings++;
        if (e.type === 'fledge') fledged++;
        if (e.type === 'owlleaves') leaving++;
        if (e.type === 'owlnest') owlNests++;
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
    crows.push(w.count.crow);
    owls.push(`${w.count.owl}(${w.decor.filter(d => d.owl).length})`);
    const grass = w.grass.reduce((a, b) => a + b, 0);
    rows.push(`${Sim.SEASONS[k % 4].name[0]}${Math.floor(k / 4) + 1}:${w.count.rabbit}/${w.count.fox}/${w.count.bee}` + (verbose ? `(g${grass.toFixed(0)} min${minR}/${minF})` : ''));
  }
  const d = w.stats.deaths;
  const hives = w.hives.filter(h => h.queen && !h.cluster).length;
  console.log(`seed ${s}  ${((Date.now() - t0) / 1000).toFixed(1)}s  max ${maxR}/${maxF}  arrivals r${arrivals.rabbit} f${arrivals.fox} b${arrivals.bee} c${arrivals.crow} o${arrivals.owl}  kills ${kills} escapes ${escapes}  swarms ${swarms}  hives ${hives}/${w.hives.length}`);
  console.log(`  weather ${JSON.stringify(sky)}  strikes ${strikes}  fires ${fires} (biggest ${burned} tiles)`);
  console.log('  deaths rabbit', JSON.stringify(d.rabbit), 'fox', JSON.stringify(d.fox), 'bee', JSON.stringify(d.bee), 'crow', JSON.stringify(d.crow), 'owl', JSON.stringify(d.owl));
  const tm = Sim.traitMeans(w, 'rabbit'), fm = Sim.traitMeans(w, 'fox');
  const fmt = m => m ? Object.entries(m).map(([k, v]) => `${k}${v.toFixed(2)}`).join(' ') : '-';
  console.log('  rabbit genes', fmt(tm), '| fox genes', fmt(fm));
  console.log('  rabbit coats', JSON.stringify(Sim.coatCounts(w)), ' surprise litters', surprises);
  console.log(`  ground  at cap ${capDays.toFixed(0)}/${years * Sim.SPECIES.rabbit.breedSeasons.length * Sim.SEASON_DAYS} breeding days  crashes ${crashes} recovered ${recovered}  trees ${trees.join(' ')}  summer grass wood ${(shade.wood / shade.n).toFixed(2)} open ${(shade.open / shade.n).toFixed(2)}  rich ${rich.join(' ')}`);
  console.log(`  sickness  outbreaks ${outbreaks} (over ${over})  sick rabbit-days ${sickDays.toFixed(0)}  deaths ${d.rabbit.sickness || 0}  rabbits per burrow at peak ${perBurrow.toFixed(1)}  old cap: at it ${oldCapDays.toFixed(0)} days, crashes ${oldCrashes} recovered ${oldRecovered}  resist ${resist.map(v => v === undefined ? '-' : v.toFixed(2)).join(' ')}`);
  for (let i = 0; i < rows.length; i += 8) console.log('  ' + rows.slice(i, i + 8).join('  '));
  const eaten = w.stats.voles;
  console.log(`  voles  ${voles.join(' ')}  eaten ${eaten} (${Math.round(100 * eaten / Math.max(1, eaten + kills))}% of fox meals)  fox hunger ${d.fox.hunger || 0}  vole years ${voleNews.boom} crashes ${voleNews.bust}`);
  const st = w.stats, rm = st.remains;
  console.log(`  crows  ${crows.join(' ')}  remains ${rm.left} (eaten up by crows ${rm.eaten}, rotted ${rm.rotted})  gatherings ${gatherings}` +
    `  acorns buried ${st.cached} dug up ${st.dugUp} came up ${st.planted}  oaks/beeches ${oaks0} -> ${oaks()}`);
  console.log(`  owls (hollows)  ${owls.join(' ')}  hollows taken ${owlNests}  owlets ${st.births.owl} fledged ${fledged} flew off ${leaving}` +
    `  voles eaten ${st.owlVoles} (foxes ${eaten})  kits taken ${d.rabbit.owl || 0}`);
}
