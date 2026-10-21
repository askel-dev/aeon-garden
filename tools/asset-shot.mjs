// Shoots a camp asset in the real game, headless Chrome over CDP, at three zooms (close, mid, far), 2x.
// node tools/asset-shot.mjs <out dir> [port]   (serve the repo first: python3 -m http.server <port>, default 8813)
// SETUP below: summer noon, a lit camp by oaks (seed 319876), the lean-to beside it. Change it to put down another asset.
// For a before/after: shoot, change the painter, shoot again into another dir, and paste the crops side by side.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
const OUT = process.argv[2], PORT = process.argv[3] || 8813;
const PROFILE = mkdtempSync('/tmp/asset-shot-');   // (its own Chrome on a port it picks: another session's may hold any fixed one)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0',
  '--user-data-dir=' + PROFILE, '--window-size=1400,1000', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(2000);
const DEBUG = readFileSync(PROFILE + '/DevToolsActivePort', 'utf8').split('\n')[0];
const tabs = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const wait = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
const SETUP = `(() => { const g = garden, w = g.world, S = g.S;
  w.tick = 21600 * 7 + 21600 * 0.45 | 0; if (w.weather) w.weather.until = 0;
  const F = S.layFire(w, 98.3, 61.5, 3, 1); S.lightFire(w, F); for (const [dx, dy] of [[2.6, -0.3],[2.6, 0.6],[-2.6, -0.3],[3, 1],[0, -2.5],[0, 2.5]]) if (S.makeLean(w, 98.3 + dx, 61.5 + dy)) break; if (!w.camp.lean) w.camp.lean = { lean: true, x: 0, y: 0, made: w.tick };
  const L = w.camp.lean; F.x = 97.2; F.y = 60; w.camp.x = F.x; w.camp.y = F.y; L.x = 99.9; L.y = 58.8;
  const f = w.forager; f.x = 96.4; f.y = 60.8; f.homeX = f.x; f.homeY = f.y;
  const h = document.createElement('style'); h.textContent = 'body > *:not(#world, #ground) { visibility: hidden }'; document.head.append(h);
  return !!L; })()`;
const shots = [];
await cdp('Fetch.enable', { patterns: [{ urlPattern: '*game.js*', requestStage: 'Response' }] });
ws.addEventListener('message', async e => { const m = JSON.parse(e.data); if (m.method !== 'Fetch.requestPaused') return;
  const b = await cdp('Fetch.getResponseBody', { requestId: m.params.requestId });
  let src = b.result.base64Encoded ? Buffer.from(b.result.body, 'base64').toString() : b.result.body;
  src = src.replace('window.garden = { get world()', 'window.garden = { S, get world()');   // (a test hook only: the sim, to set the camp up)
  cdp('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(src).toString('base64') }); });
for (const [name, q] of [['repo', '']]) {
  await cdp('Page.navigate', { url: `http://localhost:${PORT}/?seed=319876&dev${q}` });
  await sleep(6000);
  console.log(name, 'lean made', await ev(SETUP));
  for (const [tag, x, y, z] of [['close', 98.8, 57.6, 80], ['mid', 98.5, 58, 45], ['far', 98.5, 58.5, 24]]) {
    await ev(`Object.assign(garden.cam, { x: ${x}, y: ${y}, zoom: ${z}, goal: null }); garden.ui.speed = 1; 1`);
    await sleep(4000);
    const r = await cdp('Page.captureScreenshot', { format: 'png' });
    const file = `${OUT}/${name}-${tag}.png`; writeFileSync(file, Buffer.from(r.result.data, 'base64')); shots.push(file);
  }
}
console.log(shots.join('\n'));
ws.close(); chrome.kill();
