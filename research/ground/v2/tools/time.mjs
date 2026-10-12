// Time the ground shader per variant, the same moment and camera for each, interleaved so drift cancels out.
// Two ways: the brief's (30 repaints, alternating lx so `steady` fails, then a 1-px readPixels; 3 rounds) and the
// GPU's own clock (EXT_disjoint_timer_query_webgl2 around 30 repaints; 5 rounds). node time.mjs <variants> [views]
import { connect, sleep } from './cdp.mjs';
const VARIANTS = process.argv[2].split(',').map(Number), VIEWS = (process.argv[3] || 'home,close,far').split(',');
const BASE = 'http://127.0.0.1:8791/';
const CAM = { far: [7.68, 75, 50], mid: [13, 40, 70], home: [22.76, 28, 84], close: [40, 52, 70], phone: [16.25, 28, 84] };
const c = await connect();
await c.send('Page.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
await c.send('Emulation.setDeviceMetricsOverride', process.env.PHONE ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
  : { width: 1024, height: 768, deviceScaleFactor: 2, mobile: false });
await c.send('Page.navigate', { url: BASE + 'blank.html' }); await sleep(1500);
await c.evaluate(`(async () => { for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }); return 1; })()`);
await c.send('Page.navigate', { url: `${BASE}?seed=9091&watch` }); await sleep(4500);
await c.evaluate(`(() => { garden.ui.speed = 0; const w = garden.world; w.skyLocked = true; w.weather = { kind: 'clear', until: 1e9 };
  while (w.tick < 4420) { Sim.step(w); w.events.length = 0; } return 1; })()`);
const out = {};
for (const view of VIEWS) {
  const [zoom, x, y] = CAM[view];
  await c.evaluate(`(() => { const c = garden.cam; c.goal = null; c.x = ${x}; c.y = ${y}; c.zoom = ${zoom}; garden.ui.follow = false; return 1; })()`);
  await sleep(1500);
  const all = {}, allRp = {};
  const PASSES = +(process.env.PASSES || 6);
  for (let pass = 0; pass < PASSES; pass++) for (const v of VARIANTS) {
    const r = await c.evaluate(`(async () => {
      Ground._gv(${v});
      const G = window.Ground, od = G.draw; let U = null;
      G.draw = u => { U = u; return od(u); };
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      G.draw = od;
      const gl = G.canvas.getContext('webgl2'), px = new Uint8Array(4), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const one = i => od({ ...U, lx: U.lx + (i % 2 ? 0.2 : -0.2) });
      for (let i = 0; i < ${pass === 0 ? 200 : 10}; i++) one(i);   // (the first time round: warm the GPU up)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const rp = [];
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        for (let i = 0; i < 30; i++) one(i);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        rp.push((performance.now() - t0) / 30);
      }
      const gpu = [];
      for (let r = 0; r < 5; r++) {
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        for (let i = 0; i < 30; i++) one(i);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let k = 0; k < 100 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise(r => setTimeout(r, 10));
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / 30);
        gl.deleteQuery(q);
      }
      od(U);
      // what was painted: the viewport (the canvas less any margin not in use)
      const vp = gl.getParameter(gl.VIEWPORT);
      return { rp, gpu, mpx: vp[2] * vp[3] / 1e6 };
    })()`);
    if (pass > 0) { (all[v] ||= []).push(...r.gpu); (allRp[v] ||= []).push(...r.rp); all.mpx = r.mpx; }
  }
  const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const v of VARIANTS) {
    out[`${view}:${v}`] = { gpuMedian: +med(all[v]).toFixed(3), gpuMin: +Math.min(...all[v]).toFixed(3), readPixelsMedian: +med(allRp[v]).toFixed(3),
      vsToday: +(med(all[v]) / med(all[VARIANTS[0]])).toFixed(2), mpx: +all.mpx.toFixed(2) };
    console.log(view, v, JSON.stringify(out[`${view}:${v}`]));
  }
}
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
c.close();
