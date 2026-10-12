// Shoot the ground variants over CDP in the scratch Chrome. One page load per meadow; every variant paints the same
// moment (Ground._gv switches the shader), so the columns differ only in the ground.
// node shoot2.mjs <outdir> <variants e.g. 0,1,2> <scenes e.g. summer:home,summer:far> [keep] [time]
import { writeFileSync } from 'node:fs';
import { connect, sleep } from './cdp.mjs';

const [OUT, VS, SC, ...flags] = process.argv.slice(2);
const VARIANTS = VS.split(',').map(Number);
const KEEP = flags.includes('keep'), TIME = flags.includes('time');
const BASE = process.env.BASE || 'http://127.0.0.1:8791/', SEED = 9091;
const TICKS = { spring: 1420, summer: 4420, night: 4790, autumn: 7420, winter: 10420, dry: 5620 };
const PHONE = flags.includes('phone');
const VIEWS = { far: [7.68, 75, 50], home: PHONE ? [16.25, 28, 84] : [22.76, 28, 84], close: [40, 52, 70], mid: [13, 40, 70], dryhome: [22.76, 75, 50] };
const scenes = SC.split(',').map(s => s.split(':')).sort((a, b) => TICKS[a[0]] - TICKS[b[0]]);   // the sim only steps forward
const c = await connect();
await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
await c.send('Network.setCacheDisabled', { cacheDisabled: true });
await c.send('Emulation.setDeviceMetricsOverride', PHONE ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
  : { width: 1024, height: 768, deviceScaleFactor: 2, mobile: false });
await c.send('Page.navigate', { url: BASE + 'blank.html' }); await sleep(1500);
await c.evaluate(`localStorage['aeon-garden-welcomed']='1'; localStorage['aeon-garden-keep-seen']='1';
  localStorage['aeon-garden-tried'] = localStorage['aeon-garden-tried'] || '{}';
  (async () => { for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }); return 1; })()`);
await c.send('Page.navigate', { url: `${BASE}?seed=${SEED}&${KEEP ? 'keep&dry=1' : 'watch'}` }); await sleep(4500);
await c.evaluate(`(() => {
  const st = document.createElement('style'); st.textContent = 'body > *:not(#world, #ground) { visibility: hidden !important }';
  document.head.append(st); garden.ui.speed = 0;
  const w = garden.world; w.skyLocked = true; w.weather = { kind: 'clear', until: 1e9 }; return w.tick; })()`);
for (const v of VARIANTS) {                     // compile them all first: a shader error stops here, with its log
  try { await c.evaluate(`Ground._gv ? Ground._gv(${v}) : 0`); } catch (e) { console.log('variant', v, 'failed:', e.message.slice(0, 1500)); process.exit(1); }
}
const raf2 = `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`;
const times = {};
let lastSeason = null;
for (const [season, view] of scenes) {
  if (season !== lastSeason) {
    const r = await c.evaluate(`(() => { const w = garden.world; while (w.tick < ${TICKS[season]}) { Sim.step(w); w.events.length = 0; }
      w.snow = ${season === 'winter' ? 0.45 : 0}; w.weather = { kind: 'clear', until: 1e9 };
      const mix = garden.ui.sky.mix; for (const k in mix) mix[k] = k === 'clear' ? 1 : 0; mix.clear = 1;   // the sky settled, clear
      return [w.tick, Sim.dryness ? Sim.dryness(w) : -1, JSON.stringify(mix)]; })()`);
    console.log('at', season, JSON.stringify(r));
    lastSeason = season;
  }
  const [zoom, x, y] = VIEWS[view];
  await c.evaluate(`(() => { const c = garden.cam; c.goal = null; c.x = ${x}; c.y = ${y}; c.zoom = ${zoom}; garden.ui.follow = false; return 1; })()`);
  await sleep(view === 'far' ? 4000 : 3000);    // the trees' paintings come from the workers
  for (const v of VARIANTS) {
    await c.evaluate(`Ground._gv ? Ground._gv(${v}) : 0`); await c.evaluate(raf2); await sleep(250); await c.evaluate(raf2);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/gv${v}-${season}-${view}${PHONE ? '-phone' : ''}.png`, Buffer.from(shot.result.data, 'base64'));
    if (TIME && season === 'summer' && view === 'home') {
      times[v] = await c.evaluate(`(async () => {
        const G = window.Ground, od = G.draw; let U = null;
        G.draw = u => { U = u; return od(u); };
        await ${raf2};
        G.draw = od;
        if (!U) return 'no draw';
        const gl = G.canvas.getContext('webgl2'), px = new Uint8Array(4), runs = [];
        const one = i => od({ ...U, lx: U.lx + (i % 2 ? 0.2 : -0.2) });
        for (let i = 0; i < 6; i++) one(i);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let r = 0; r < 3; r++) {
          const t0 = performance.now();
          for (let i = 0; i < 30; i++) one(i);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          runs.push((performance.now() - t0) / 30);
        }
        od(U);
        return { ms: runs.map(v => +v.toFixed(2)), mpx: +(G.canvas.width * G.canvas.height / 1e6).toFixed(2) };
      })()`);
      console.log('time', v, JSON.stringify(times[v]));
    }
  }
  console.log('shot', season, view);
}
if (TIME) writeFileSync(`${OUT}/times-${Date.now()}.json`, JSON.stringify(times, null, 1));
c.close();
