// Plays the meadow for a test, the way a player would: a Chrome of its own (a window you can watch it play in, or headless
// with --headless) on a server of its own, kept open between commands, so a session can play a step at a time and look at it. No packages:
// node's fetch and WebSocket talk to Chrome over the DevTools protocol.
//
//   node tools/play.mjs start [--phone] [--seed 123] [--out DIR]   a new meadow; prints where it stands
//   node tools/play.mjs seen                                       what there is to tap, nearest first
//   node tools/play.mjs use stick                                  tap the nearest of it (a player's tap: off to pick it)
//   node tools/play.mjs shot after-camp                            a screenshot; prints its path
//   node tools/play.mjs stop
//   node tools/play.mjs help                                       every command
//
// It serves the checkout it's in (a worktree plays its own code), never cached and with no service worker (sw.js serves
// the shell cache-first, so an edit wouldn't show), and blocks everything off this machine: the tally, the visit counter,
// Supabase, Web3Forms. A test shouldn't count as a visit, make a friend or send Axel an idea (--net lets it out). The
// browser shuts itself after --idle minutes with no command (30). --as NAME runs another one beside it.
// .claude/skills/playtest/SKILL.md says how to playtest with it.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, openSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(import.meta.url), ROOT = resolve(dirname(HERE), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = { desktop: [1280, 800, 1, false], laptop: [1440, 900, 1, false], phone: [390, 844, 3, true], tablet: [820, 1180, 2, true] };

// ------------------------------------------------------------------ the command line

const argv = process.argv.slice(2);
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2), v = argv[i + 1];
    if (v !== undefined && !v.startsWith('--') && !['phone', 'headless', 'net', 'sw', 'meadow', 'full', 'fresh', 'mouse', 'touch', 'notch', 'daemon', 'json'].includes(k)) { flags[k] = v; i++; }
    else flags[k] = true;
  } else pos.push(a);
}
const NAME = String(flags.as || 'meadow').replace(/[^\w-]/g, '');
const STATE = join(tmpdir(), `meadow-play-${NAME}.json`), LOG = join(tmpdir(), `meadow-play-${NAME}.log`);

const HELP = `node tools/play.mjs [--as NAME] <command>      (coordinates are CSS px of the page; x y in the meadow are tiles)

  start [--phone|--size phone|tablet|laptop|WxH] [--seed N] [--query 'keep&x=1'] [--headless] [--out DIR] [--net] [--sw] [--idle MIN]
                               (a window of its own to watch it play in, drawn on the GPU like the real thing; --headless:
                               none, the canvas painted in software, slower and no measure of speed)
  stop                         shut the browser and the server
  status                       the clock, the forager, what's open, fps, new errors
  open ['seed=5&keep']         load the page again with that query (a new meadow); reload [--fresh] keeps the query
                               (--fresh: the kept meadow and settings forgotten first)
  size phone|desktop|WxH [--dpr N] [--notch]     media reduce|dark|none: prefers-reduced-motion, the colour scheme
  back                         the browser's Back (a phone's): shuts what's open

  seen [N] [word]              what there is to tap on screen (garden.seen), nearest the forager first
  ui [word]                    the page's buttons and fields on screen: label, centre, size (< 44 px marked on touch)
  use WORD                     tap the nearest seen thing whose kind or name has WORD in it
  tap X Y | tap TEXT | tap '#css'   a tap (a finger on a phone size, else the mouse); --mouse / --touch to choose
  hold X Y MS                  press and hold
  drag X1 Y1 X2 Y2 [MS]        press, move, let go
  circle X Y R [TURNS] [MS]    round and round (stirring): TURNS 1.25, MS 1500
  go X Y | go camp | go water  walk there by tapping the meadow as a player would (toward the screen's edge while it's off it)
  key K [MS]                   a key (e, space, escape, enter, arrowleft, shift+e, 1...), held MS
  type TEXT                    text into what has the focus
  wheel DY [X Y]               the mouse wheel (negative: zoom in)

  wait MS | wait until 'EXPR' [SECS]
  eval 'EXPR'                  in the page (garden.world, garden.cam, garden.ui, garden.S...)
  look X Y [ZOOM]              the camera there; look forager: back on it
  speed N                      0 pauses; 1, 3, 10, 60...
  time dawn|noon|dusk|night|day|season|TICKS    the clock run on (garden.skip), waited for
  weather clear|cloudy|rain|storm|snow|fog...
  give ID [N]                  into the satchel (garden.give); give pot puts the clay pot in its hands
  scene day|camp|pot|fishing   a known moment set up (the intro and the storm over; see SCENES)

  shot [NAME] [--meadow] [--clip X,Y,W,H] [--full]    --meadow hides the page over it; --full at device pixels
  film N MS [NAME]             N frames MS apart on one sheet (an animation, a fade)
  fps [SECS]                   frames a second and render ms (headless paints in software: not for perf)
  errors                       page errors and warnings since the last look; log [N]: the last console lines
  run FILE.mjs                 export default async p => { await p.tap(...); p.say(...) }: every command as p.<name>(...args)
`;

// ------------------------------------------------------------------ the client: one command, then out

async function client() {
  const cmd = pos[0] || 'help';
  if (cmd === 'help') { console.log(HELP); return; }
  const st = alive();
  if (cmd === 'start') {
    if (st) { console.log(`already playing (--as ${NAME}); stop it first, or --as another name`); console.log(await send(st, 'status', [])); return; }
    const fd = openSync(LOG, 'w');
    const kid = spawn(process.execPath, [HERE, '--daemon', ...argv.filter(a => a !== 'start')], { detached: true, stdio: ['ignore', fd, fd], cwd: ROOT });
    kid.unref();
    for (let t = 0; t < 120; t++) {
      await sleep(250);
      const s = alive();
      if (s && s.ready) { console.log(await send(s, 'status', [])); return; }
      if (kid.exitCode !== null) break;
    }
    console.log('it never came up. Its log, ' + LOG + ':\n' + (existsSync(LOG) ? readFileSync(LOG, 'utf8').slice(-3000) : ''));
    process.exitCode = 1;
    return;
  }
  if (!st) { console.log(`nothing playing (--as ${NAME}): node tools/play.mjs start`); process.exitCode = 1; return; }
  const out = await send(st, cmd, pos.slice(1));
  console.log(out);
  if (/^(error|timed out)/m.test(out)) process.exitCode = 1;
}
function alive() {
  if (!existsSync(STATE)) return null;
  let s;
  try { s = JSON.parse(readFileSync(STATE, 'utf8')); } catch { return null; }
  try { process.kill(s.pid, 0); } catch { rmSync(STATE, { force: true }); ours(s.chrome) && process.kill(s.chrome); return null; }
  return s;
}
// Whether a pid is a Chrome this started (its profile's name in its command line): only that is ever killed.
function ours(pid) {
  if (!pid) return false;
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).includes('meadow-play-profile-'); } catch { return false; }
}
async function send(s, cmd, args) {
  try {
    const r = await fetch(`http://127.0.0.1:${s.port}/cmd`, { method: 'POST', body: JSON.stringify({ cmd, args, flags }) });
    return await r.text();
  } catch (e) { return 'error: the player didn\'t answer (' + e.message + '). Its log: ' + LOG; }
}

// ------------------------------------------------------------------ the daemon: the server, Chrome, and the commands

async function daemon() {
  const out = resolve(flags.out || join(tmpdir(), `meadow-play-${NAME}`));
  mkdirSync(out, { recursive: true });
  const game = await serve(ROOT, !!flags.sw);
  const profile = mkdtempSync(join(tmpdir(), 'meadow-play-profile-'));
  const [W0, H0] = sizeOf(flags.phone ? 'phone' : flags.size || 'desktop');
  const chrome = spawn(CHROME, [flags.headless ? '--headless=new' : '--app=about:blank', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
    // (a hidden or covered window would otherwise get no frames, or one a second, and a shot would show the first frame)
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
    `--window-size=${Math.max(W0, 420)},${H0 + (flags.headless ? 0 : 28)}`, '--window-position=40,40', flags.headless ? 'about:blank' : ''].filter(Boolean), { stdio: 'ignore' });
  let closing = false;
  const quit = async (why) => {
    if (closing) return;
    closing = true;
    console.log('stopping:', why);
    rmSync(STATE, { force: true });
    try { ws && ws.close(); } catch {}
    chrome.kill('SIGTERM');
    for (let i = 0; i < 30 && chrome.exitCode === null && chrome.signalCode === null; i++) await sleep(100);
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill('SIGKILL');
    game.close();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
    process.exit(0);
  };
  chrome.on('exit', () => quit('Chrome went'));
  process.on('SIGTERM', () => quit('SIGTERM'));
  process.on('SIGINT', () => quit('SIGINT'));
  process.on('uncaughtException', e => { console.log(e); quit('crashed: ' + e.message); });
  process.on('unhandledRejection', e => { console.log(e); quit('crashed: ' + (e && e.message)); });
  writeFileSync(STATE, JSON.stringify({ pid: process.pid, chrome: chrome.pid, ready: false }));   // (so a start that dies half way leaves no Chrome behind: alive)

  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = +readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {}
  }
  if (!port) return quit('no DevTools port');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  var ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  let id = 0;
  const wait = new Map(), on = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    else if (m.method && on.has(m.method)) on.get(m.method)(m.params);
  };
  ws.onclose = () => quit('DevTools socket closed');
  const cdp = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    wait.set(i, m => m.error ? j(new Error(method + ': ' + m.error.message)) : r(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  // What the page says: its errors (kept till looked at), and the last of everything for `log`.
  const errors = [], logs = [];
  const note = (line, bad) => { logs.push(line); if (logs.length > 300) logs.shift(); if (bad) errors.push(line); };
  on.set('Runtime.exceptionThrown', p => {
    const d = p.exceptionDetails, at = d.url ? ` (${d.url.split('/').pop()}:${d.lineNumber + 1})` : '';
    note('exception: ' + ((d.exception && d.exception.description) || d.text).split('\n').slice(0, 3).join(' | ') + at, true);
  });
  on.set('Runtime.consoleAPICalled', p => {
    const text = p.args.map(a => a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : a.description || a.type).join(' ');
    note(`${p.type}: ${text}`.slice(0, 500), p.type === 'error' || p.type === 'warning' || p.type === 'assert');
  });
  on.set('Page.javascriptDialogOpening', p => {     // (a confirm() would hang every command after it: said no to)
    note(`dialog (${p.type}) said no to: ${p.message}`, true);
    cdp('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
  });
  const reqs = new Map();
  on.set('Network.requestWillBeSent', p => { reqs.set(p.requestId, p.request.url); if (reqs.size > 500) reqs.delete(reqs.keys().next().value); });
  on.set('Network.loadingFailed', p => {
    const url = reqs.get(p.requestId) || '';
    if (p.blockedReason === 'inspector') { note('blocked (off this machine): ' + url.slice(0, 120)); return; }
    if (url.startsWith(`http://127.0.0.1:${game.port}/`) && !url.endsWith('/sw.js')) note(`failed to load: ${url.slice(0, 160)} (${p.errorText})`, true);
  });
  on.set('Network.responseReceived', p => {
    if (p.response.status >= 400 && !p.response.url.endsWith('/sw.js')) note(`HTTP ${p.response.status}: ${p.response.url.slice(0, 160)}`, true);
  });

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  if (!flags.net) await cdp('Network.setBlockedURLs', { urls: ['https://*', 'wss://*'] });   // (the game itself is plain http on 127.0.0.1)

  // ---------------------------------------------------------------- what the commands are made of

  const ev = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text).split('\n')[0]);
    return r.result.value;
  };
  const view = { w: W0, h: H0, dpr: 1, touch: false, query: '' };
  async function size(spec, dpr, notch) {
    const [w, h, d, touch] = sizeOf(spec);
    view.w = w; view.h = h; view.dpr = +dpr || d; view.touch = touch;
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: view.dpr, mobile: touch });
    await cdp('Emulation.setTouchEmulationEnabled', touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await cdp('Emulation.setEmitTouchEventsForMouse', { enabled: false });
    if (notch) await cdp('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, topMax: 59, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } }).catch(e => note('no safe-area override: ' + e.message));
    return `${w}x${h} @${view.dpr}${touch ? ', touch' : ''}`;
  }
  const url = q => `http://127.0.0.1:${game.port}/?${q}`;
  async function load(q, fresh) {
    if (fresh) {
      await cdp('Page.navigate', { url: 'about:blank' });
      await sleep(300);
      await cdp('Storage.clearDataForOrigin', { origin: `http://127.0.0.1:${game.port}`, storageTypes: 'all' });
    }
    view.query = q;
    await cdp('Page.navigate', { url: url(q) });
    await until('window.garden && garden.world && garden.world.tick > 0', 40);
    await sleep(400);
  }
  async function until(expr, secs = 20) {
    const t0 = Date.now();
    let v;
    while (Date.now() - t0 < secs * 1000) {
      try { v = await ev(expr); } catch (e) { v = 'error ' + e.message; }
      if (v && !(typeof v === 'string' && v.startsWith('error '))) return v;
      await sleep(100);
    }
    throw new Error(`timed out after ${secs}s waiting for ${expr} (last: ${JSON.stringify(v)})`);
  }

  // Input as the browser gets it from a hand: the mouse, or a finger at a touch size (Input.dispatch*: real pointer
  // events, so the game's own taps, holds and drags run). A finger on a button that hides itself in the tap can stick
  // headless Chrome's touch for good, so buttons and fields (tap TEXT, tap #css) are clicked with the mouse.
  const finger = o => o.touch ? true : o.mouse ? false : view.touch;
  const mouse = (type, x, y, buttons = 0, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse', ...extra });
  const touch = (type, pts) => cdp('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 })) });
  async function press(path, ms, useFinger) {
    const [x0, y0] = path[0], step = path.length > 1 ? ms / (path.length - 1) : ms;
    if (useFinger) {
      await touch('touchStart', [[x0, y0]]);
      if (path.length === 1) await sleep(ms);
      for (let i = 1; i < path.length; i++) { await sleep(step); await touch('touchMove', [path[i]]); }
      await touch('touchEnd', []);
    } else {
      await mouse('mouseMoved', x0, y0);
      await mouse('mousePressed', x0, y0, 1);
      if (path.length === 1) await sleep(ms);
      for (let i = 1; i < path.length; i++) { await sleep(step); await mouse('mouseMoved', path[i][0], path[i][1], 1); }
      const [x1, y1] = path[path.length - 1];
      await mouse('mouseReleased', x1, y1);
    }
  }
  const line = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);

  // Things on the page to press: buttons, links, fields, the game's [data-act]s, as laid out now. Each one's middle has to
  // be it on top (elementFromPoint), else it's marked covered.
  const UI = `(() => {
    const SEL = 'button, [role=button], a[href], input, select, textarea, summary, [data-act], .slot[data-k], [onclick]', out = [];
    for (const el of document.querySelectorAll(SEL)) {
      if (el.parentElement && el.parentElement.closest(SEL)) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2), top = document.elementFromPoint(x, y);
      const slot = el.dataset.k !== undefined && el.classList.contains('slot') ? 'slot ' + (+el.dataset.k + 1) + ': ' + (el.dataset.name ? el.dataset.name + (el.dataset.n > 1 ? ' x' + el.dataset.n : '') : 'empty') + (el.classList.contains('sel') ? ' (held)' : '') : '';
      const label = (slot || el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
      out.push({ label, id: el.id, cls: String(el.className || '').split(' ')[0], tag: el.tagName.toLowerCase(), x, y, w: Math.round(r.width), h: Math.round(r.height), covered: !!top && top !== el && !el.contains(top) });
    }
    return out;
  })()`;
  async function find(target) {
    if (/^[#.\[]/.test(target)) {
      const r = await ev(`(() => { const el = document.querySelector(${JSON.stringify(target)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: ${JSON.stringify(target)}, w: r.width }; })()`);
      if (!r || !r.w) throw new Error(`nothing shown at ${target}`);
      return r;
    }
    const plain = t => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');   // (the page's curly quotes, as typed)
    const want = plain(target.replace(/^text:/, '')), all = await ev(UI);
    const hits = all.filter(u => plain(u.label).includes(want) || u.id.toLowerCase() === want);
    if (!hits.length) throw new Error(`no button or field says "${want}". On screen: ${all.map(u => u.label || '#' + u.id).filter(Boolean).slice(0, 30).join(' · ')}`);
    hits.sort((a, b) => (plain(b.label) === want) - (plain(a.label) === want) || a.covered - b.covered || a.label.length - b.label.length);
    return hits[0];
  }
  // The camera eases after the forager for a moment after a walk, so a screen position read then is stale by the time it's
  // tapped: this waits till it rests (or 3 s).
  async function settle() {
    let last = null, still = 0;
    for (let i = 0; i < 30 && still < 2; i++) {
      const c = await ev('[garden.cam.x, garden.cam.y, garden.cam.zoom]');
      still = last && Math.abs(c[0] - last[0]) + Math.abs(c[1] - last[1]) < 0.003 && Math.abs(c[2] - last[2]) < 0.01 ? still + 1 : 0;
      last = c;
      await sleep(100);
    }
  }
  const SEEN = 'garden.seen()';
  // The nearest dry tile beside the water to the forager: where it stands to fill a pot or fish, and a spot out on the water.
  const BANK = `(() => { const w = garden.world, S = garden.S, f = w.forager; let best = null, bd = 1e9;
    for (let y = 1; y < S.H - 1; y++) for (let x = 1; x < S.W - 1; x++) {
      if (w.water[y * S.W + x]) continue;
      let wet = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.water[(y + dy) * S.W + x + dx]) { wet = [dx, dy]; break; }
      if (!wet) continue;
      const d = (x + 0.5 - f.x) ** 2 + (y + 0.5 - f.y) ** 2;
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5, wx: x + 0.5 + wet[0] * 2, wy: y + 0.5 + wet[1] * 2 }; }
    }
    if (best) { best.d = +Math.sqrt(bd).toFixed(1); [best.sx, best.sy] = garden.screen(best.wx, best.wy).map(Math.round); }
    return best; })()`;
  const thing = t => `${t.kind}${t.name && t.name !== t.kind ? ' ' + t.name : ''}${t.n ? ' x' + t.n : ''}${t.why ? ' (' + t.why + ')' : ''} at ${t.x},${t.y} → ${t.sx},${t.sy}, ${t.d} tiles`;

  const KEYS = { space: [' ', 'Space', 32], ' ': [' ', 'Space', 32], escape: ['Escape', 'Escape', 27], esc: ['Escape', 'Escape', 27], enter: ['Enter', 'Enter', 13],
    tab: ['Tab', 'Tab', 9], backspace: ['Backspace', 'Backspace', 8], shift: ['Shift', 'ShiftLeft', 16], arrowleft: ['ArrowLeft', 'ArrowLeft', 37],
    arrowup: ['ArrowUp', 'ArrowUp', 38], arrowright: ['ArrowRight', 'ArrowRight', 39], arrowdown: ['ArrowDown', 'ArrowDown', 40], '~': ['~', 'Backquote', 192] };
  async function key(spec, ms = 60) {
    const parts = String(spec).split('+'), k = parts.pop(), mods = parts.map(s => s.toLowerCase());
    const m = (mods.includes('alt') ? 1 : 0) | (mods.includes('ctrl') ? 2 : 0) | (mods.includes('meta') || mods.includes('cmd') ? 4 : 0) | (mods.includes('shift') ? 8 : 0);
    let [name, code, vk] = KEYS[k.toLowerCase()] || (/^[a-z]$/i.test(k) ? [m & 8 ? k.toUpperCase() : k.toLowerCase(), 'Key' + k.toUpperCase(), k.toUpperCase().charCodeAt(0)]
      : /^\d$/.test(k) ? [k, 'Digit' + k, 48 + +k] : [k, k, 0]);
    const text = name.length === 1 && !(m & 6) ? name : undefined;
    await cdp('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: name, code, windowsVirtualKeyCode: vk, modifiers: m, text });
    await sleep(+ms);
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk, modifiers: m });
  }

  let shots = 0;
  async function capture(scale, clip) {
    const vw = await ev('[innerWidth, innerHeight]');
    const c = clip || { x: 0, y: 0, width: vw[0], height: vw[1] };
    const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { ...c, scale } });
    return Buffer.from(r.data, 'base64');
  }
  const pngSize = b => [b.readUInt32BE(16), b.readUInt32BE(20)];
  const HIDE = `body > *:not(#world, #ground) { visibility: hidden !important }`;
  async function hideUi(on) {
    await ev(on ? `(() => { const s = document.createElement('style'); s.id = 'play-hide'; s.textContent = ${JSON.stringify(HIDE)}; document.head.append(s); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`
      : `document.getElementById('play-hide')?.remove()`);
  }
  const fileFor = (name, ext = 'png') => join(out, `${String(name || 'shot-' + String(++shots).padStart(2, '0')).replace(/[^\w.-]/g, '-')}.${ext}`);

  // ---------------------------------------------------------------- the commands

  const errorsNew = { at: 0 };
  const status = async () => {
    const s = await ev(`(() => { const g = garden, w = g.world, f = w.forager, S = g.S, c = S.clock(w), p = c.phase;
      const part = c.night ? 'night' : p < 0.15 ? 'morning' : p < 0.4 ? 'midday' : p < 0.6 ? 'afternoon' : 'evening';
      const always = ['world', 'ground', 'news', 'thermo', 'frost', 'veil', 'vitals', 'what', 'me-box', 'minimap', 'satchel', 'hud-right', 'sprint-btn', 'swing-btn', 'hug-btn', 'rope-btn', 'dev-give', g.intro ? '' : 'intro'];
      const open = [...document.body.children].filter(e => e.id && !always.includes(e.id) && e.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        && e.getBoundingClientRect().width > 0).map(e => '#' + e.id);
      const bag = f.bag.map((id, i) => id ? id + (f.bagN[i] > 1 ? ' x' + f.bagN[i] : '') : '').filter(Boolean);
      return { when: S.SEASONS[c.season].name + ' ' + c.dayInSeason + ', year ' + c.year + ', ' + part, weather: w.weather.kind + (S.openingStorm(w) ? ' (the opening storm)' : ''),
        intro: g.intro, speed: g.ui.speed, at: [+f.x.toFixed(1), +f.y.toFixed(1)], walking: f.walking, down: f.down >= 0,
        body: 'warmth ' + f.warmth.toFixed(2) + ', wet ' + f.wet.toFixed(2) + ', stamina ' + f.stamina.toFixed(2) + ', tummy ' + f.tummy.toFixed(2) + ', health ' + f.health.toFixed(2),
        hand: f.hand || '', bag, camp: w.camp ? 'camp at ' + w.camp.x.toFixed(1) + ',' + w.camp.y.toFixed(1) + ', cosy ' + w.camp.cosy : 'no camp', fires: w.fires.length, open,
        cam: [+g.cam.x.toFixed(1), +g.cam.y.toFixed(1), +g.cam.zoom.toFixed(1)] }; })()`);
    const fps = await ev('new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 500 ? requestAnimationFrame(f) : r(Math.round(n * 1000 / (performance.now() - t0))); }; requestAnimationFrame(f); })');
    return [`${url(view.query)}  ${view.w}x${view.h} @${view.dpr}${view.touch ? ' touch' : ''}  ${fps} fps${fps < 20 ? (flags.headless ? ' (low: headless paints in software)' : ' (low: is the Mac\'s screen asleep?)') : ''}`,
      `${s.when} · ${s.weather} · speed ${s.speed}${s.intro ? ' · THE INTRO IS ON (a key ends it)' : ''}`,
      `forager at ${s.at}${s.walking ? ' walking' : ''}${s.down ? ' DOWN' : ''} · ${s.body}${s.hand ? ' · in hand: ' + s.hand : ''}`,
      `satchel: ${s.bag.join(', ') || 'empty'} · ${s.camp}, ${s.fires} fire(s) · camera ${s.cam}`,
      `open: ${s.open.join(' ') || 'nothing over the meadow'}`,
      `shots go to ${out}`].join('\n');
  };

  const P = {
    status,
    async open(q) { await load(q || `seed=${flags.seed || 1}&${flags.query || ''}`.replace(/&$/, '')); return status(); },
    async reload() { await load(view.query, !!flags.fresh); return status(); },
    async size(spec, ...rest) { const r = await size(spec || 'desktop', flags.dpr || rest[0], !!flags.notch); return r + ' (what a page reads only at load, like a touch screen, wants a reload)'; },
    async seen(n, word) {
      if (n && isNaN(+n)) [n, word] = [word, n];
      await settle();
      let all = await ev(SEEN);
      if (word) all = all.filter(t => (t.kind + ' ' + t.name).toLowerCase().includes(word.toLowerCase()));
      const b = await ev(BANK), water = b ? `\nwater: the nearest bank ${b.x},${b.y}, ${b.d} tiles (go water); out on it ${b.wx},${b.wy} → ${b.sx},${b.sy}` : '';
      return (all.length ? all.slice(0, +n || 20).map(thing).join('\n') + (all.length > (+n || 20) ? `\n...and ${all.length - (+n || 20)} more` : '') : 'nothing to tap on screen' + (word ? ' that is ' + word : '')) + (word && !'water'.includes(word) ? '' : water);
    },
    async ui(word) {
      let all = await ev(UI);
      if (word) all = all.filter(u => (u.label + ' ' + u.id).toLowerCase().includes(word.toLowerCase()));
      return all.map(u => `${u.label || '(no label)'}${u.id ? ' #' + u.id : u.cls ? ' .' + u.cls : ''} at ${u.x},${u.y} ${u.w}x${u.h}${view.touch && (u.w < 44 || u.h < 44) ? ' SMALL' : ''}${u.covered ? ' covered' : ''}`).join('\n') || 'no buttons on screen';
    },
    async use(word) {
      await settle();
      const all = (await ev(SEEN)).filter(t => (t.kind + ' ' + t.name).toLowerCase().includes(String(word).toLowerCase()));
      if (!all.length) throw new Error(`nothing on screen is ${word} (off screen? go X Y, go camp or go water first). Seen: ${[...new Set((await ev(SEEN)).map(t => t.name || t.kind))].slice(0, 20).join(', ')}`);
      await press([[all[0].sx, all[0].sy]], 70, finger(flags));
      return 'tapped ' + thing(all[0]);
    },
    async tap(...a) {
      if (a.length === 2 && !isNaN(+a[0]) && !isNaN(+a[1])) { await press([[+a[0], +a[1]]], 70, finger(flags)); return `tapped ${a[0]},${a[1]}`; }
      const t = await find(a.join(' '));
      await press([[t.x, t.y]], 70, flags.touch ? true : false);
      return `tapped "${t.label}" at ${Math.round(t.x)},${Math.round(t.y)}`;
    },
    async hold(x, y, ms = 800) { await press([[+x, +y]], +ms, finger(flags)); return `held ${x},${y} for ${ms} ms`; },
    async drag(x0, y0, x1, y1, ms = 400) { const n = Math.max(4, Math.round(ms / 16)); await press(line(+x0, +y0, +x1, +y1, n), +ms, finger(flags)); return `dragged ${x0},${y0} → ${x1},${y1}`; },
    async circle(x, y, r, turns = 1.25, ms = 1500) {
      const n = Math.max(12, Math.round(ms / 16)), pts = [];
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * turns * 2 * Math.PI; pts.push([+x + Math.cos(a) * r, +y + Math.sin(a) * r]); }
      await press(pts, +ms, finger(flags));
      return `went round ${turns} times at ${x},${y}`;
    },
    async go(x, y) {
      if (x === 'water') {
        const b = await ev(BANK);
        if (!b) throw new Error('no water in this meadow');
        return (await P.go(b.x, b.y)) + `\nthe water is toward ${b.wx},${b.wy} (on screen ${(await ev(`garden.screen(${b.wx}, ${b.wy}).map(Math.round)`)).join(',')})`;
      }
      if (x === 'camp') {
        const c = await ev('garden.world.camp && [garden.world.camp.x, garden.world.camp.y + 1.2]');
        if (!c) throw new Error('no camp yet');
        [x, y] = c;
      }
      x = +x; y = +y;
      let was = null;
      for (let i = 0; i < 15; i++) {
        const s = await ev(`(() => { const f = garden.world.forager; return { d: Math.hypot(f.x - ${x}, f.y - ${y}), p: garden.screen(${x}, ${y}), q: garden.screen(f.x, f.y), w: innerWidth, h: innerHeight, at: [f.x, f.y] }; })()`);
        if (s.d < 1.5) { await settle(); return `there: ${s.at.map(v => v.toFixed(1))}`; }
        if (was && Math.hypot(s.at[0] - was[0], s.at[1] - was[1]) < 0.2) break;     // (a tap that took it nowhere: it won't get nearer)
        was = s.at;
        let [sx, sy] = s.p;
        const [qx, qy] = s.q, M = 50;
        if (sx < M || sy < M || sx > s.w - M || sy > s.h - M) {        // (off screen: as far as the screen goes toward it)
          let t = 1;
          for (const [d, lo, hi, o] of [[sx - qx, M, s.w - M, qx], [sy - qy, M, s.h - M, qy]]) if (d) t = Math.min(t, Math.max(((d > 0 ? hi : lo) - o) / d, 0));
          sx = qx + (sx - qx) * t; sy = qy + (sy - qy) * t;
        }
        await press([[sx, sy]], 70, finger(flags));
        await sleep(250);
        try { await until('!garden.world.forager.walking', 20); } catch {}
        await sleep(150);
      }
      await settle();
      const at = await ev('[garden.world.forager.x, garden.world.forager.y]');
      return `stopped short at ${at.map(v => v.toFixed(1))} (something in the way, or a tap that used something there)`;
    },
    async key(k, ms) { await key(k, ms || 60); return `pressed ${k}`; },
    async type(...words) { await cdp('Input.insertText', { text: words.join(' ') }); return 'typed'; },
    async wheel(dy, x, y) { const [w, h] = await ev('[innerWidth, innerHeight]'); await mouse('mouseWheel', +(x ?? w / 2), +(y ?? h / 2), 0, { deltaX: 0, deltaY: +dy }); await sleep(300); return 'zoom now ' + (await ev('garden.cam.zoom')).toFixed(1); },
    async wait(a, expr, secs) {
      if (a === 'until') { const v = await until(expr, +secs || 20); return 'done: ' + JSON.stringify(v).slice(0, 200); }
      await sleep(+a); return `waited ${a} ms`;
    },
    async eval(...src) { const v = await ev(src.join(' ')); return v === undefined ? 'undefined' : JSON.stringify(v, null, 1).slice(0, 6000); },
    async look(x, y, z) {
      if (x === 'forager' || x === undefined) { await ev('(() => { const f = garden.world.forager; garden.cam.goal = null; garden.cam.x = f.x; garden.cam.y = f.y; })()'); return 'on the forager'; }
      await ev(`(() => { const c = garden.cam; c.goal = null; c.x = ${+x}; c.y = ${+y}; ${z ? `c.zoom = ${+z};` : ''} })()`);
      return `looking at ${x},${y}`;
    },
    async back() {                     // (the browser's own Back, as a phone's: the game shuts what's open, stepOut; history.back() isn't the same)
      const h = await cdp('Page.getNavigationHistory');
      if (h.currentIndex < 1) return 'nothing to go back to';
      await cdp('Page.navigateToHistoryEntry', { entryId: h.entries[h.currentIndex - 1].id });
      await sleep(400);
      return 'went back';
    },
    async media(...features) {         // media reduce | dark | light | none: prefers-reduced-motion and prefers-color-scheme
      const f = [];
      for (const w of features) {
        if (w === 'reduce') f.push({ name: 'prefers-reduced-motion', value: 'reduce' });
        else if (w === 'dark' || w === 'light') f.push({ name: 'prefers-color-scheme', value: w });
      }
      await cdp('Emulation.setEmulatedMedia', { features: f });
      return f.length ? 'media: ' + features.join(', ') + ' (what the page reads at load wants a reload)' : 'media as the browser has it';
    },
    async speed(n) { await ev(`garden.ui.speed = ${+n}`); return `speed ${n}`; },
    async time(to) {
      const t0 = await ev('garden.world.tick'), n = await ev(`garden.skip(${JSON.stringify(isNaN(+to) ? to : +to)})`);
      if (!n) throw new Error(`can't skip to ${to}`);
      await until(`garden.world.tick >= ${t0 + n}`, 120);
      return 'now ' + (await status()).split('\n')[1];
    },
    async weather(k) { if (!await ev(`garden.weather(${JSON.stringify(k)})`)) throw new Error('no such weather: ' + k + ' (' + (await ev('Object.keys(garden.S.WEATHER)')).join(', ') + ')'); return 'weather ' + k; },
    async give(item, n) { const got = await ev(`garden.give(${JSON.stringify(item)}, ${+n || 0})`); if (!got) throw new Error(`couldn't give ${item}`); return `gave ${got} ${item}`; },
    async scene(name) {
      const sc = SCENES[name];
      if (!sc) throw new Error(`no scene ${name}: ${Object.keys(SCENES).join(', ')}`);
      const said = [];
      await sc({ ...P, ev, BANK, settle }, s => said.push(s));
      await settle();
      return [...said, (await status())].join('\n');
    },
    async shot(name) {
      const clip = typeof flags.clip === 'string' ? (([x, y, width, height]) => ({ x, y, width, height }))(flags.clip.split(',').map(Number)) : null;
      if (flags.meadow) await hideUi(true);
      const png = await capture(flags.full ? 1 : 1 / view.dpr, clip);
      if (flags.meadow) await hideUi(false);
      const f = fileFor(name);
      writeFileSync(f, png);
      return `${f}  (${pngSize(png).join('x')})`;
    },
    async film(n = 6, ms = 250, name) {
      const frames = [], t0 = Date.now(), k = Math.min(1, 640 / view.w) / view.dpr;
      for (let i = 0; i < +n; i++) {
        const due = t0 + i * ms;
        if (Date.now() < due) await sleep(due - Date.now());
        frames.push({ t: Date.now() - t0, png: (await capture(k)).toString('base64') });
      }
      const sheet = await ev(`(async () => {
        const F = ${JSON.stringify(frames)}, imgs = await Promise.all(F.map(f => fetch('data:image/png;base64,' + f.png).then(r => r.blob()).then(createImageBitmap)));
        const w = imgs[0].width, h = imgs[0].height, cols = Math.ceil(Math.sqrt(F.length)), rows = Math.ceil(F.length / cols);
        const c = new OffscreenCanvas(cols * w + (cols - 1) * 4, rows * h + (rows - 1) * 4), g = c.getContext('2d');
        g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.font = 'bold 14px sans-serif';
        imgs.forEach((im, i) => { const x = (i % cols) * (w + 4), y = (i / cols | 0) * (h + 4); g.drawImage(im, x, y);
          g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 64, 20); g.fillStyle = '#fff'; g.fillText((F[i].t / 1000).toFixed(2) + ' s', x + 5, y + 15); });
        const b = await c.convertToBlob({ type: 'image/png' }), a = new Uint8Array(await b.arrayBuffer());
        let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
        return btoa(s); })()`);
      const f = fileFor(name || 'film-' + String(++shots).padStart(2, '0'));
      writeFileSync(f, Buffer.from(sheet, 'base64'));
      return `${f}  (${n} frames over ${(frames[frames.length - 1].t / 1000).toFixed(2)} s)`;
    },
    async fps(secs = 3) {
      const r = await ev(`new Promise(res => { const p = garden.perf, gaps = []; let last = performance.now(), ren = 0, n = 0; const t0 = last;
        const f = now => { gaps.push(now - last); last = now; ren += p.ren; n++; now - t0 < ${secs * 1000} ? requestAnimationFrame(f) : res({ fps: Math.round(n * 1000 / (now - t0)), worst: Math.round(Math.max(...gaps)), slow: gaps.filter(g => g > 25).length, ren: +(ren / n).toFixed(2) }); };
        requestAnimationFrame(f); })`);
      return `${r.fps} fps, worst frame ${r.worst} ms, ${r.slow} over 25 ms, render ${r.ren} ms${flags.headless ? ' (headless: the canvas is painted in software, so these are no measure of the real thing)' : ''}`;
    },
    async errors() { const e = errors.splice(0); errorsNew.at = 0; return e.length ? e.join('\n') : 'no errors'; },
    async log(n = 40) { return logs.slice(-n).join('\n') || 'nothing logged'; },
    async run(file) {
      const said = [], api = { say: s => said.push(String(s)), ev, cdp, sleep, flags };
      for (const k of Object.keys(P)) if (!api[k]) api[k] = async (...a) => { const r = await P[k](...a.map(String)); said.push(`> ${k} ${a.join(' ')}\n${r}`); return r; };
      const mod = await import(pathToFileURL(resolve(String(file))).href + '?' + Date.now());
      try { await mod.default(api); } catch (e) { said.push('error: ' + e.message); }
      return said.join('\n');
    },
    async stop() { setTimeout(() => quit('asked to'), 50); return 'stopped'; },
  };

  // ---------------------------------------------------------------- the control server

  let idle = null;
  const idleMs = (+flags.idle || 30) * 60000;
  const poke = () => { clearTimeout(idle); idle = setTimeout(() => quit('idle'), idleMs); };
  const ctl = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    poke();
    let text;
    try {
      const { cmd, args, flags: f } = JSON.parse(body || '{}');
      for (const k in flags) if (!['as', 'out', 'idle', 'net', 'sw', 'headless'].includes(k)) delete flags[k];
      Object.assign(flags, f);
      if (!P[cmd]) throw new Error(`no command ${cmd}: node tools/play.mjs help`);
      text = String(await P[cmd](...args));
    } catch (e) { text = (e.message.startsWith('timed out') ? '' : 'error: ') + e.message; }
    const fresh = errors.length - errorsNew.at;
    if (fresh > 0) { text += `\n! ${fresh} new page error(s):\n` + errors.slice(errorsNew.at).slice(0, 8).join('\n'); errorsNew.at = errors.length; }
    res.end(text);
  });
  await new Promise(r => ctl.listen(0, '127.0.0.1', r));

  await size(flags.phone ? 'phone' : flags.size || 'desktop', flags.dpr, !!flags.notch);
  await load(`seed=${flags.seed || 1}${flags.query ? '&' + flags.query : ''}`);
  writeFileSync(STATE, JSON.stringify({ pid: process.pid, port: ctl.address().port, chrome: chrome.pid, game: game.port, out, ready: true }));
  poke();
  console.log('playing', url(view.query), 'control on', ctl.address().port);
}

// ------------------------------------------------------------------ scenes: a known moment, set up quickly

// Each gets the commands (p) and a way to say what it did. They start from wherever the meadow is, so they're kind to
// being run twice. The intro is cut with a key (as a player can), the outfit card shut, the opening storm cleared.
const SCENES = {
  async day(p, say) {
    if (await p.eval('garden.intro') === 'true') { await p.key('escape'); await sleep(400); say('cut the intro'); }
    await shutCards(p, say);
    if (await p.eval('garden.S.openingStorm(garden.world)') === 'true') { await p.weather('clear'); say('cleared the opening storm'); }
    if (await p.eval('garden.S.clock(garden.world).night') === 'true') { await p.time('dawn'); say('ran on to dawn'); }
    await p.eval('garden.well()');
    say('the forager made well');
  },
  async camp(p, say) {
    await SCENES.day(p, say);
    if (await p.eval('!!garden.world.camp') !== 'true') { await p.key('k'); await sleep(300); say('dropped a lit campfire beside it (K): camp made'); }
    await shutCards(p, say);
  },
  async pot(p, say) {
    await SCENES.camp(p, say);
    await p.eval('garden.home()');
    if (await p.eval("garden.world.forager.hand === 'pot'") !== 'true') { await p.give('pot'); say('the clay pot in its hands'); }
    await p.give('watercress', 4); await p.give('sorrel', 2);
    say('4 watercress and 2 sorrel in the satchel (watercress soup: 2 watercress and a green)');
    await shutCards(p, say);
  },
  async fishing(p, say) {
    await SCENES.day(p, say);
    const spot = await p.ev(p.BANK);
    if (!spot) throw new Error('no water in this meadow');
    await p.ev(`(() => { const w = garden.world, S = garden.S, f = w.forager;
      f.x = f.goalX = ${spot.x}; f.y = f.goalY = ${spot.y}; f.path.length = 0; f.walking = f.running = false; f.speed = 0;
      garden.cam.goal = null; garden.cam.x = f.x; garden.cam.y = f.y;
      if (!S.storeCount(f, 'rod')) { S.storePut(f, 'rod', 1); garden.satchel(); } })()`);
    await p.settle();
    const [sx, sy] = await p.ev(`garden.screen(${spot.wx}, ${spot.wy}).map(Math.round)`), slot = await p.ev("garden.world.forager.bag.indexOf('rod') + 1");
    say(`set down on the bank at ${spot.x},${spot.y} with a rod in slot ${slot} (key ${slot} holds it); the water is at ${spot.wx},${spot.wy}, on screen ${sx},${sy}: hold there and let go to cast`);
  },
};
async function shutCards(p, say) {     // (the outfit card a new meadow opens with, and anything else of the sort: shut as a player would)
  for (let i = 0; i < 3; i++) {
    const open = await p.ev(`(() => { const w = document.getElementById('wardrobe'); return !!w && w.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && w.getBoundingClientRect().width > 0; })()`);
    if (!open) return;
    await p.key('escape');
    await sleep(400);
    say('shut the outfit card (Esc)');
  }
}

// ------------------------------------------------------------------ the server: the checkout, uncached

function sizeOf(spec) {
  if (SIZES[spec]) return SIZES[spec];
  const m = /^(\d+)x(\d+)$/.exec(spec || '');
  if (!m) throw new Error(`no size ${spec}: phone, tablet, desktop, laptop or WxH`);
  return [+m[1], +m[2], 1, +m[1] < 900];
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.md': 'text/plain' };
function serve(root, sw) {
  return new Promise(r => {
    const s = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = resolve(root, '.' + p);
      if (!f.startsWith(root + sep) || (!sw && p === '/sw.js') || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => r({ port: s.address().port, close: () => s.close() }));
  });
}

if (flags.daemon) await daemon();   // (last: the tables above are set up by now)
else await client();
