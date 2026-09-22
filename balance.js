// Headless balance check: run several worlds for N years, print populations each season.
const Sim = require('./sim.js');
const years = +(process.argv[2] || 5), seeds = +(process.argv[3] || 4), verbose = process.argv[4] === 'v';
const perSeason = Sim.SEASON_DAYS * Sim.TPD;
for (let s = 1; s <= seeds; s++) {
  const w = Sim.createWorld(s * 7919);
  const t0 = Date.now();
  const rows = [];
  let arrivals = { rabbit: 0, fox: 0 }, kills = 0, escapes = 0;
  let maxR = 0, maxF = 0;
  for (let k = 0; k < years * 4; k++) {
    let minR = 1e9, minF = 1e9;
    for (let i = 0; i < perSeason; i++) {
      Sim.step(w);
      for (const e of w.events) {
        if (e.type === 'arrive') arrivals[e.species]++;
        if (e.type === 'death' && e.cause === 'fox') kills++;
        if (e.type === 'escape') escapes++;
      }
      w.events.length = 0;
      minR = Math.min(minR, w.count.rabbit); minF = Math.min(minF, w.count.fox);
      maxR = Math.max(maxR, w.count.rabbit); maxF = Math.max(maxF, w.count.fox);
    }
    const grass = w.grass.reduce((a, b) => a + b, 0);
    rows.push(`${Sim.SEASONS[k % 4].name[0]}${Math.floor(k / 4) + 1}:${w.count.rabbit}/${w.count.fox}` + (verbose ? `(g${grass.toFixed(0)} min${minR}/${minF})` : ''));
  }
  const d = w.stats.deaths;
  console.log(`seed ${s}  ${((Date.now() - t0) / 1000).toFixed(1)}s  max ${maxR}/${maxF}  arrivals r${arrivals.rabbit} f${arrivals.fox}  kills ${kills} escapes ${escapes}`);
  console.log('  deaths rabbit', JSON.stringify(d.rabbit), 'fox', JSON.stringify(d.fox));
  const tm = Sim.traitMeans(w, 'rabbit'), fm = Sim.traitMeans(w, 'fox');
  const fmt = m => m ? Object.entries(m).filter(([k]) => k !== 'fur').map(([k, v]) => `${k}${v.toFixed(2)}`).join(' ') : '-';
  console.log('  rabbit genes', fmt(tm), '| fox genes', fmt(fm));
  for (let i = 0; i < rows.length; i += 8) console.log('  ' + rows.slice(i, i + 8).join('  '));
}
