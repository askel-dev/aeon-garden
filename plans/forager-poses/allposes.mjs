// node plans/forager-poses/allposes.mjs [dir] [port] (a server on port, 8765 by default): every forager painting large, one png per group, labelled
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dbg = 9900 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), 'pose-'));
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=' + dbg, '--user-data-dir=' + prof, '--window-size=400,300', '--hide-scrollbars', `http://localhost:${process.argv[3] || 8765}/forager-lab.html`], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch {} await wait(200); }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const d = JSON.parse(m.data); if (pend[d.id]) { pend[d.id](d.result); delete pend[d.id]; } };
const cmd = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
await wait(2500);
const r = await cmd('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const F = Fur, G = [], r = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const v = (view, ps) => ps.map(p => [view + ':' + p, (view << 5) + p]);
  G.push(['side-stand', v(0, r(0, 8))], ['side-walk', v(0, r(8, 16))], ['side-jog', v(0, r(16, 24))], ['side-cold', v(0, r(24, 32))]);
  G.push(['front-stand', v(1, r(0, 8))], ['front-walk', v(1, r(8, 16))], ['front-jog', v(1, r(16, 24))], ['front-cold', v(1, r(24, 32))]);
  G.push(['back-stand', v(2, r(0, 8))], ['back-walk', v(2, r(8, 16))], ['back-jog', v(2, r(16, 24))]);
  G.push(['idle-eat', v(3, r(0, 16))], ['kneel-sit', v(3, r(16, 32))]);
  G.push(['emotes', F.FORAGER_EMOTES.map(p => ['e' + p, F.emoteArt(0, 0, p)])]);
  G.push(['carry', [0, 1, 2].flatMap(view => [0, 8, 10, 12, 16, 18].map(p => ['c' + view + ':' + p, F.carryArt(0, 0, (view << 5) + p)]))]);
  const S = 230, U = S * 1.15, out = {};
  for (const [name, list] of G) {
    const cols = 8, rows = Math.ceil(list.length / cols), c = document.createElement('canvas'); c.width = cols * S; c.height = rows * (S + 20);
    const o = c.getContext('2d'); o.fillStyle = '#86a95c'; o.fillRect(0, 0, c.width, c.height); o.font = '16px sans-serif';
    list.forEach(([lab, n], i) => { const s = document.createElement('canvas'); s.width = s.height = S;
      F.paintForager(s.getContext('2d'), S, U, n); const x = (i % cols) * S, y = Math.floor(i / cols) * (S + 20);
      o.drawImage(s, x, y); o.fillStyle = '#000'; o.fillText(lab, x + 6, y + S + 15); });
    out[name] = c.toDataURL();
  }
  return out; })()` });
const dir = process.argv[2] || 'poses'; mkdirSync(dir, { recursive: true });
for (const [k, d] of Object.entries(r.result.value)) writeFileSync(join(dir, k + '.png'), Buffer.from(d.split(',')[1], 'base64'));
ch.kill(); process.exit(0);
