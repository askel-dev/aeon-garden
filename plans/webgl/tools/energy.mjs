// Energy bench: drives the scratch Chrome over CDP through scenarios, samples `top` CPU and POWER of its processes.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const PORT = +(process.env.CDP_PORT || 9447), URL = process.env.URL || 'http://localhost:8791/?seed=123', SECS = +(process.env.SECS || 25);
const only = process.argv.slice(2);
const PROFILE = process.env.PROFILE || 'scratchpad/prof';   // (a string in the scratch Chrome's command line: its --user-data-dir)
const sleep = ms => new Promise(r => setTimeout(r, ms));

const tabs = await (await fetch(`http://localhost:${PORT}/json`)).json();
const tab = tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr, gesture = false) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: gesture }); if (r.result?.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };

const pids = () => execSync(`ps -axo pid,command | grep "${PROFILE}" | grep -v grep`).toString().trim().split('\n').map(l => {
  const pid = +l.trim().split(/\s+/)[0]; const t = (l.match(/--type=([a-z-]+)/) || [, 'browser'])[1]; return { pid, t };
});
function sample(secs) {
  const ps = pids(), want = new Set(ps.map(p => p.pid));
  const out = execSync(`top -l ${secs + 1} -s 1 -stats pid,cpu,power`, { maxBuffer: 1e8 }).toString();
  const blocks = out.split(/^Processes:/m).slice(2);          // (the first sample's numbers are no good)
  const sum = { cpu: 0, power: 0 }, byType = {};
  for (const b of blocks) for (const line of b.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)/); if (!m || !want.has(+m[1])) continue;
    const t = ps.find(p => p.pid === +m[1]).t;
    sum.cpu += +m[2]; sum.power += +m[3];
    byType[t] = byType[t] || { cpu: 0, power: 0 }; byType[t].cpu += +m[2]; byType[t].power += +m[3];
  }
  const n = blocks.length, r = x => +(x / n).toFixed(1);
  const types = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { cpu: r(v.cpu), power: r(v.power) }]));
  return { cpu: r(sum.cpu), power: r(sum.power), gpu: types['gpu-process'], renderer: types.renderer };
}

await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cdp('Page.enable');
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `indexedDB.deleteDatabase('aeon-garden'); try { localStorage.clear(); } catch (e) {}` });

const key = async k => { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === 'Escape' ? 'Escape' : 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k === 'Escape' ? 27 : k.toUpperCase().charCodeAt(0) }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
async function load(extra = '') {
  await cdp('Page.navigate', { url: URL + extra }); await sleep(6000);
  // clear midday weather, no opening storm, 1x
  await ev(`(() => { const w = garden.world, S = Sim; w.weather.kind = 'clear'; w.weather.until = w.tick + 1e9;
    w.tick += ((0.4 - S.clock(w).phase + 1) % 1) * S.TPD | 0; garden.ui.speed = 1;
    return S.clock(w).phase; })()`);
  await key('x'); await sleep(800); await key('Escape'); await sleep(500); await key('Escape');
  await sleep(3000);
}
const walk = `window.__walk = setInterval(() => { const w = garden.world, f = w.forager; if (!f.walking) Sim.foragerTo(w, f.x + (window.__d = -(window.__d || 1)) * 7, f.y); }, 100); 1`;
const stats = () => ev(`({ fps: garden.perf.fps.toFixed(0), drawn: garden.perf.drawn?.toFixed(0), ren: garden.perf.ren.toFixed(2), sim: garden.perf.sim.toFixed(2), w: document.querySelector('#world').width, rung: garden.gov.rung })`);

const scenes = {
  blank: async () => { await cdp('Page.navigate', { url: 'about:blank' }); await sleep(3000); },
  paused: async () => { await load('&perf'); await ev('garden.ui.speed = 0'); await sleep(2000); },
  idle: async () => { await load('&perf'); await sleep(3000); },                     // (calm: 30 fps)
  walk: async () => { await load('&perf'); await ev(walk); await sleep(3000); },
  walk30: async () => { await load('&perf'); await ev(walk); await ev('garden.gov.rung = 2'); await sleep(3000); },
  walkNoDraw: async () => { await load('&perf'); await ev(walk); await ev(`(() => { const c = document.querySelector('#world'); c.width = 0; c.height = 0; })()`); await sleep(3000); },
  walkSound: async () => { await load('&perf'); await ev(walk); await key('m'); await sleep(500); await ev('garden.ui.sound'); await sleep(3000); },
  pausedSound: async () => { await load('&perf'); await key('m'); await sleep(500); await ev('garden.ui.sound'); await ev('garden.ui.speed = 0'); await sleep(3000); },
  pausedNoCss: async () => { await load('&perf'); await ev(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '#playing *, #me *, #v-food *, #v-stam * { animation: none !important; }' })); garden.ui.speed = 0`); await sleep(2000); },
  walkNoDrawNoCss: async () => { await load('&perf'); await ev(walk); await ev(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '#playing *, #me *, #v-food *, #v-stam * { animation: none !important; }' })); (() => { const c = document.querySelector('#world'); c.width = 0; c.height = 0; })()`); await sleep(3000); },
  walk60x: async () => { await load('&perf'); await ev(walk); await ev('garden.ui.speed = 60'); await sleep(3000); },
};
const res = {};
for (const [k, f] of Object.entries(scenes)) {
  if (only.length && !only.includes(k)) continue;
  await f();
  const st = k === 'blank' ? null : await stats();
  const s = sample(SECS);
  const st2 = k === 'blank' ? null : await stats();
  res[k] = { ...s, st: st2 };
  console.log(k, JSON.stringify(res[k]));
}
writeFileSync('energy-out-' + (only.join('-') || 'all') + '.json',JSON.stringify(res, null, 1));
ws.close();
