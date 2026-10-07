/* Nobody's Meadow — everything you see and click. The simulation lives in sim.js. */
(() => {
'use strict';
const S = window.Sim;
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const TICKS_PER_SECOND = 30;           // at 1x
const perKind = make => Object.fromEntries(S.KINDS.map(s => [s, make(s)]));   // { rabbit: .., fox: .., bee: .. }

// ------------------------------------------------------------------ state

// ?terrain={...} overrides some of the meadow's settings (Sim.TERRAIN) and #water=.. adds what was
// drawn on it (Sim.drawnToLink; older links have it as ?drawn={...}), as the terrain lab hands them
// over. ?lab opens that lab: the meadow without animals, and terrain-lab.js on top.
const params = new URLSearchParams(location.search), LAB = params.has('lab');
const fromUrl = key => { try { return JSON.parse(params.get(key) || '{}'); } catch (e) { return {}; } };   // a broken link: the usual meadow
let terrain = fromUrl('terrain'), drawn = location.hash.length > 1 ? S.drawnFromLink(location.hash) : fromUrl('drawn');
const terrainQuery = () => (Object.keys(terrain).length ? '&terrain=' + encodeURIComponent(JSON.stringify(terrain)) : '')
  + (S.drawnToLink(drawn) ? '#' + S.drawnToLink(drawn) : '');
const meadowLink = seed => '?seed=' + seed + terrainQuery();   // the address of a meadow, and the name it's kept under

// How many people come, and from where, counted by GoatCounter (goatcounter.com: free, no cookies,
// nothing to agree to). Off until COUNTER holds the site's code: sign up there, pick a code, put it
// here. A link posted as meadow.cryptoler.net/?ref=reddit is counted as coming from "reddit". The
// counter looks at the address a moment after the game has made it ?seed=.., so it's told the page
// and where they came from here. Every visit is the one page, whichever meadow it opens: /meadow, as
// the one counter may count cryptoler.net's own pages too.
const COUNTER = 'cryptoler';               // cryptoler.goatcounter.com
if (COUNTER && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.goatcounter = { path: LAB ? '/meadow/lab' : '/meadow', referrer: params.get('ref') || params.get('utm_source') || document.referrer };
  const js = document.createElement('script');
  js.async = true; js.src = 'https://gc.zgo.at/count.js';
  js.dataset.goatcounter = `https://${COUNTER}.goatcounter.com/count`;
  document.head.append(js);
}

let world;
const ui = {
  speed: 1, sound: false, tool: 'look', selectedId: 0, picked: null, hoverId: 0, follow: false,
  trail: [], effects: [], zaps: [], zapNext: 0, allTraits: false, allStory: false,
  lastNews: {}, newsLog: [], newsOpen: false, records: perKind(() => 0), crashSaid: perKind(() => -1), seenHistory: 0,
  releaseSex: perKind(() => 'F'), group: perKind(() => 1), mini: false, ring: null, sheetUp: false, naming: 0,
  stats: { open: false, show: 'rabbit', range: 'five', hover: null },
  sky: { mix: {}, tick: 0, bolts: [], boom: -1e9, rainbow: 0, menu: false },
};
const cam = { x: S.W / 2, y: S.H / 2, zoom: 10, goal: null };

// ------------------------------------------------------------------ canvas and camera

const canvas = $('#world');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0, dpr = 1, minZoom = 1, fitZoom = 1;
const FIT = 0.92;                                 // zoomed right out, how much of the window the meadow fills (it fades into mist, mistField)
let barPad = 0;                                   // screen pixels the toolbar covers at the bottom (on a phone, its button in the corner)
let sheet = null;                                 // the edges of the meadow the inspector and the bars hide, while it's open
// A phone upright or on its side: slim bars, and the tools fold into a button. On its side (a short screen)
// the inspector is a panel down the right.
const narrow = () => matchMedia('(max-width: 760px), (max-height: 500px)').matches;
const short = () => matchMedia('(max-height: 500px)').matches;
const canHover = matchMedia('(hover: hover)');

// Safari's fingerprinting protection (iOS 26, private tabs) can report a ratio of 1 on a
// retina phone, which leaves the meadow blurry. Ask the media queries too, and failing that,
// trust that a touch screen is sharp.
function pixelRatio() {
  const r = window.devicePixelRatio || 1;
  if (r >= 2) return r;
  for (const n of [3, 2]) if (matchMedia(`(min-resolution: ${n}dppx)`).matches) return n;
  if (matchMedia('(pointer: coarse)').matches) return Math.min(innerWidth, innerHeight) < 600 ? 3 : 2;
  return r;
}

// On the home screen iOS 26 takes the clock's strip off the window's height, and nothing can paint
// below that (WebKit bug 301108). The page then already ends above the home bar, so the bars
// needn't keep clear of it too.
function shortOfScreen() {
  if (!navigator.standalone) return false;
  const tall = innerHeight > innerWidth, screenH = tall ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return screenH - innerHeight > 20;
}

// The cards are parchment: a faint grain of fibres and flecks, painted once and tiled by the CSS (--paper).
(() => {
  const c = document.createElement('canvas'), N = 160;
  c.width = c.height = N;
  const g = c.getContext('2d');
  for (let i = 0; i < 260; i++) {                          // fibres, drawn three times over so they tile
    const x = hash2(i, 1, 90) * N, y = hash2(i, 2, 90) * N, a = hash2(i, 3, 90) * TAU, l = 3 + hash2(i, 4, 90) * 9;
    g.strokeStyle = `rgba(120, 90, 40, ${0.035 + 0.05 * hash2(i, 5, 90)})`; g.lineWidth = 0.6 + hash2(i, 6, 90) * 0.6;
    for (const [ox, oy] of [[0, 0], [-N, 0], [0, -N], [-N, -N]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a + 0.6) * l * 0.6, y + oy + Math.sin(a + 0.6) * l * 0.6, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      g.stroke();
    }
  }
  for (let i = 0; i < 500; i++) {                          // flecks
    g.fillStyle = hash2(i, 7, 90) < 0.7 ? `rgba(110, 80, 30, ${0.05 + 0.07 * hash2(i, 8, 90)})` : 'rgba(255, 252, 240, 0.5)';
    g.fillRect(hash2(i, 9, 90) * N, hash2(i, 10, 90) * N, 1, 1);
  }
  document.documentElement.style.setProperty('--paper', `url(${c.toDataURL()})`);
})();

function resize() {
  if (shortOfScreen()) document.documentElement.style.setProperty('--home-bar', '0px');
  else document.documentElement.style.removeProperty('--home-bar');
  dpr = pixelRatio();
  // The CSS sizes the canvas: in Safari on a phone it reaches under the clock and the address bar, past innerHeight.
  vw = canvas.clientWidth || innerWidth; vh = canvas.clientHeight || innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  minZoom = Math.max(vw / S.W, vh / S.H);        // the meadow fills the window: the wide shot
  fitZoom = Math.min(vw / S.W, vh / S.H) * FIT;  // and you may look further out, at all of it
  cam.zoom = Math.max(cam.zoom, fitZoom);
  clampCam();
  for (const s of S.KINDS) {
    const c = $('#spark-' + s);
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
  }
  measureSheet();
}

// On a phone the inspector is a sheet over the bottom of the meadow, or on its side a panel down the
// right. The one you follow is kept in the middle of what's still showing, instead of under the panel.
function measureSheet() {
  const ins = $('#inspector').getBoundingClientRect();
  if (!ins.height) sheet = null;
  else if (narrow() && !short()) {
    const top = Math.max($('#meadow').getBoundingClientRect().bottom, $('#hud-right .hud-top').getBoundingClientRect().bottom);
    sheet = { top, bottom: vh - ins.top, left: 0, right: 0 };
  } else sheet = short() ? { top: 0, bottom: 0, left: 0, right: $('#inspector').classList.contains('strip') ? 0 : vw - ins.left } : null;
}

// You may look out past the edges into the mist: the middle of the view goes as far as the mist is thick
// (MIST_FULL tiles out), at any zoom, so an edge can be looked at up close.
// A bit further where the toolbar or the inspector covers the screen, so nothing is ever stuck under them.
// Not while they're away for the intro (hush). This far past the bottom edge, in screen pixels:
// In the lab, its own sheet on a phone (lab.cover).
const lookPast = () => Math.max(ui.hush ? 0 : barPad, sheet ? sheet.bottom : 0, LAB ? lab.cover.bottom : 0);
function clampCam() {
  const left = (sheet ? sheet.left : 0) / cam.zoom, right = Math.max(sheet ? sheet.right : 0, LAB ? lab.cover.right : 0) / cam.zoom;
  cam.x = clamp(cam.x, -MIST_FULL - left, S.W + MIST_FULL + right);
  cam.y = clamp(cam.y, -MIST_FULL, S.H + MIST_FULL + lookPast() / cam.zoom);
}

new ResizeObserver(() => {
  barPad = $('#toolbar').offsetHeight + 16;
  document.documentElement.style.setProperty('--bar', barPad + 'px');
}).observe($('#toolbar'));
new ResizeObserver(() => {            // on a phone the time pill sits under the meadow card
  document.documentElement.style.setProperty('--meadow-h', $('#meadow').offsetHeight + 'px');
}).observe($('#meadow'));
new ResizeObserver(measureSheet).observe($('#inspector'));

const toScreen = (x, y) => [(x - cam.x) * cam.zoom + vw / 2, (y - cam.y) * cam.zoom + vh / 2];
const toWorld = (sx, sy) => [(sx - vw / 2) / cam.zoom + cam.x, (sy - vh / 2) / cam.zoom + cam.y];
// Drags and scrolls move the view by whole screen pixels, so the ground's tiles can slide along.
const wholePx = v => Math.round(v * dpr) / dpr;

function zoomAt(sx, sy, z) {
  const [wx, wy] = toWorld(sx, sy);
  cam.zoom = clamp(z, fitZoom, 64);
  const [nx, ny] = toWorld(sx, sy);
  cam.x += wx - nx; cam.y += wy - ny;
  clampCam();
}

// ------------------------------------------------------------------ emoji sprites

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const spriteCache = new Map(), latestLook = new Map();   // latestLook: each look's newest sprite, at any size
let spriteBytes = 0, spriteFrame = 0;   // render counts the frames, so a full cache knows what's still drawn
let paintedMs = 0, standIns = false;    // spent painting sprites this frame; only render takes stand-ins
const SPRITE_BYTES = 96e6;          // phones cap canvas memory in total, so mind the pixels, not the count
const PAINT_MS = 3;                 // past this much painting in a frame, sprites wait for the next one

// Safari keeps a small canvas off the GPU and copies its pixels out every time it's drawn: with a meadow full of
// rabbits that took most of its frame, and it stuttered. An ImageBitmap stays on the GPU, in every browser. So a
// picture drawn over and over is handed over as one once it's painted, and drawn from that (a sprite's canvas,
// then, is an ImageBitmap).
function asBitmap(c, use) {
  if (window.createImageBitmap) createImageBitmap(c).then(use, () => { /* it's drawn from the canvas, then */ });
}
const freeImage = img => { if (img.close) img.close(); else img.width = 0; };   // hands the memory back right away
function dataURL(img) {                     // for an <img>: an ImageBitmap goes through a canvas
  if (img.toDataURL) return img.toDataURL();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL();
}

// Past small sizes a sprite is painted in steps of about 6% and stretched to the size asked for,
// so zooming reuses a few sizes instead of painting (and recolouring) every tree at every pixel.
const spriteStep = px => px < 16 ? Math.round(px) : Math.round(2 ** (Math.round(Math.log2(px) * 12) / 12));
// A fox changes pose as it goes, so each size it's drawn at takes a dozen paintings, and cubs grow through sizes all
// the time: its sprites come in steps of about 19%, the size above, drawn a little smaller.
const poseStep = px => Math.ceil(2 ** (Math.ceil(Math.log2(px) * 4) / 4));
function sprite(emoji, want, tint, leaf, center, coat) {
  want = Math.max(4, want);
  const px = emoji.startsWith('fox:') ? poseStep(want) : spriteStep(want), s = paintedSprite(emoji, px, tint, leaf, center, coat);
  return want === px ? s : { canvas: s.canvas, size: s.size * want / px };
}
const lookKey = (emoji, tint, leaf, center, coat) =>
  emoji + '|' + (tint || '') + '|' + (leaf ? leaf.key : '') + (center ? '|c' : '') + (coat ? '|' + coat.key : '');
// Whether drawEmoji would find this one painted already.
const spriteReady = (emoji, want, leaf) => spriteCache.has(spriteStep(Math.max(4, want)) + '|' + lookKey(emoji, '', leaf));
function paintedSprite(emoji, px, tint, leaf, center, coat) {
  const look = lookKey(emoji, tint, leaf, center, coat);
  const key = px + '|' + look;
  let s = spriteCache.get(key);
  if (s) { s.used = spriteFrame; return s; }
  // Zooming asks for every tree on screen at a new size in the same frame. Past a few ms of
  // painting, the same look at another size stands in, stretched, and the rest are painted over
  // the next frames.
  const near = standIns && paintedMs > PAINT_MS && latestLook.get(look);
  if (near) { near.used = spriteFrame; return { canvas: near.canvas, size: near.size * px / near.px }; }
  const t0 = performance.now();
  const size = Math.ceil(px * 1.3 * dpr);
  if (spriteCache.size > 2000 || spriteBytes + size * size * 4 > SPRITE_BYTES) dropSprites(size * size * 4);
  spriteBytes += size * size * 4;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // Repainting and centring read the pixels back: from a canvas on the GPU that waits for it, 5-30 ms a sprite.
  // Painted things ('reeds:0', 'lily:2', 'bubble:5': PAINTERS) are painted in their colours, never read back.
  const colon = emoji.indexOf(':'), art = colon > 0 && PAINTERS[emoji.slice(0, colon)];
  const g = c.getContext('2d', !art && (leaf || coat || center) && { willReadFrequently: true });
  if (art) art(g, size, px * dpr, +emoji.slice(colon + 1), leaf);
  else {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${px * dpr}px ${EMOJI_FONT}`;
    g.fillText(emoji, size / 2, size / 2 + px * dpr * 0.06);
    // Each emoji sits a bit differently in its box (‼️, 👀 and 🤝 most of all). Where it has to
    // sit dead centre, as in a bubble, find its visible pixels and move them to the middle.
    if (center) {
      const d = g.getImageData(0, 0, size, size).data;
      let x0 = size, x1 = -1, y0 = size, y1 = -1;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (d[(y * size + x) * 4 + 3] < 24) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 >= 0) {
        g.clearRect(0, 0, size, size);
        g.fillText(emoji, size - (x0 + x1 + 1) / 2, size / 2 + px * dpr * 0.06 + size / 2 - (y0 + y1 + 1) / 2);
      }
    }
    if (tint) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint;
      g.fillRect(0, 0, size, size);
    }
    if (leaf) restyleTree(g, size, leaf);
    if (coat) recolourCoat(g, size, coat, px * dpr);
  }
  s = { canvas: c, size: size / dpr, px, look, used: spriteFrame };
  spriteCache.set(key, s); latestLook.set(look, s);
  asBitmap(c, b => { if (spriteCache.get(key) === s) { s.canvas = b; c.width = 0; } else b.close(); });
  paintedMs += performance.now() - t0;
  return s;
}
// A full cache lets go of the sprites not drawn in the last few frames (other zooms, looks gone
// by), so the ones on screen aren't all painted again at once. Only if that isn't enough does it
// start again from empty.
function dropSprites(need) {
  for (const [key, s] of spriteCache) {
    if (spriteFrame - s.used < 3) continue;
    spriteBytes -= s.canvas.width * s.canvas.height * 4;
    freeImage(s.canvas);
    spriteCache.delete(key);
    if (latestLook.get(s.look) === s) latestLook.delete(s.look);
  }
  if (spriteCache.size <= 2000 && spriteBytes + need <= SPRITE_BYTES) return;
  for (const s of spriteCache.values()) freeImage(s.canvas);
  spriteCache.clear(); latestLook.clear(); spriteBytes = 0;
}

// Trees wear the seasons by repainting their emoji (once per look; the sprite cache keeps it).
// Leaf pixels are the ones clearly greener than they are red or blue. They take the new colour
// but keep their shading, so the canopy keeps its light and shadow and the trunk stays brown.
//   rgb, m   the new leaf colour, and how much of it
//   where    'dark': only the shaded leaves (a pine's old inner needles), 'light': only the
//            lit ones (fresh tips), otherwise all of them
//   fall     how many leaves have dropped, in soft blotches; the trunk fades with them
//   snow     how much snow lies along the tops
//   blossom  how much blossom is out, in little clusters over the leaves, of colour bloom
//   fruit    an emoji to hang in the tree (hangFruit)
const SNOW_RGB = [244, 248, 252];
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function blotches(x, y, seed) {                          // smooth value noise, 0..1
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy, seed), hash2(ix + 1, iy, seed), u),
              lerp(hash2(ix, iy + 1, seed), hash2(ix + 1, iy + 1, seed), u), v);
}
function flowerAt(x, y, amount) {                      // round clusters, more of them as more are out
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const X = cx + i, Y = cy + j;
    if (hash2(X, Y, 7) > amount * 0.55) continue;
    const r = 0.3 + 0.25 * hash2(X, Y, 10);
    if ((x - X - hash2(X, Y, 8)) ** 2 + (y - Y - hash2(X, Y, 9)) ** 2 < r * r) return true;
  }
  return false;
}
function restyleTree(g, size, look) {
  const img = g.getImageData(0, 0, size, size), d = img.data;
  const alpha = new Uint8Array(size * size);
  for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
  const cap = Math.max(2, Math.round(size * 0.06)), cell = size / 9;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = y * size + x, i = p * 4;
    if (!alpha[p]) continue;
    const leaf = clamp((d[i + 1] - Math.max(d[i], d[i + 2])) / 40, 0, 1), shade = d[i + 1] / 160;
    if (look.m && leaf) {
      const w = look.where === 'dark' ? clamp((0.9 - shade) * 3, 0, 1)
              : look.where === 'light' ? clamp((shade - 0.75) * 3, 0, 1) : 1;
      const lit = look.where === 'dark' ? Math.max(shade, 0.62) : shade;
      const a = leaf * w * look.m;
      for (let k = 0; k < 3; k++) d[i + k] = lerp(d[i + k], Math.min(255, look.rgb[k] * lit), a);
    }
    if (look.blossom && leaf && flowerAt(x / (size / 18), y / (size / 18), look.blossom)) {
      const lit = clamp(0.8 + shade * 0.25, 0, 1.08);
      for (let k = 0; k < 3; k++) d[i + k] = lerp(d[i + k], Math.min(255, look.bloom[k] * lit), leaf * 0.95);
    }
    if (look.snow) {
      const top = y < cap || alpha[p - cap * size] < 60;
      const a = look.snow * (top ? 0.95 : 0.7 * leaf * clamp((shade - 0.45) * 2, 0, 1));
      for (let k = 0; k < 3; k++) d[i + k] = lerp(d[i + k], SNOW_RGB[k], a);
    }
    if (look.fall) {
      const keep = clamp((blotches(x / cell, y / cell, look.seed) - look.fall) * 5 + 0.5, 0, 1);
      d[i + 3] *= lerp(1 - look.fall, keep, leaf);
    }
  }
  g.putImageData(img, 0, 0);
  if (look.fruit) hangFruit(g, size, look);
}

// Fruit hangs in the gaps between the leaf clumps, lower in the tree and not on its rim, each on
// a stalk and in the shade of the leaves above, with a few bits of the tree laid back over its top.
function hangFruit(g, size, look) {
  const d = g.getImageData(0, 0, size, size).data;
  const leafAt = (x, y) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= size || y >= size) return 0;
    const i = (y * size + x) * 4;
    return d[i + 3] > 200 && d[i + 1] - Math.max(d[i], d[i + 2]) > 15 ? d[i + 1] / 160 : 0;
  };
  let top = size, bot = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x += 3) if (leafAt(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
  const r = size * 0.05, step = Math.max(1, Math.round(size / 100)), spots = [];
  for (let y = top; y < bot; y += step) for (let x = 0; x < size; x += step) {
    const lit = leafAt(x, y);
    if (!lit || !leafAt(x - r * 1.6, y) || !leafAt(x + r * 1.6, y) || !leafAt(x, y - r * 1.6) || !leafAt(x, y + r * 1.4)) continue;
    const around = (leafAt(x - r, y - r) + leafAt(x + r, y - r) + leafAt(x, y - r * 1.5)) / 3;   // a gap is darker
    spots.push({ x, y, lit, score: (around - lit) * 2 + (y - top) / (bot - top) * 0.8 + hash2(x, y, look.seed) * 0.5 });
  }
  spots.sort((a, b) => b.score - a.score);
  const hung = [];
  for (const q of spots) {
    if (hung.length >= look.fruit.n) break;
    if (hung.every(p => Math.hypot(p.x - q.x, p.y - q.y) > r * 3.2)) hung.push(q);
  }
  const layer = (c => (c.width = c.height = size, c))(document.createElement('canvas'));
  const over = (c => (c.width = c.height = size, c))(document.createElement('canvas'));
  const f = layer.getContext('2d'), o = over.getContext('2d');
  f.textAlign = 'center'; f.textBaseline = 'middle';
  f.strokeStyle = '#5a3a1c'; f.lineWidth = Math.max(1, r * 0.14);
  for (const [k, p] of hung.entries()) {
    const rr = r * (0.85 + 0.3 * hash2(k, look.seed, 8));
    f.beginPath(); f.moveTo(p.x, p.y - rr * 0.3); f.lineTo(p.x + rr * 0.15, p.y - rr * 1.5); f.stroke();
    f.save(); f.translate(p.x, p.y + rr * 0.35); f.rotate((hash2(k, look.seed, 9) - 0.5) * 0.5);
    f.font = `${rr * 2.3}px ${EMOJI_FONT}`; f.fillText(look.fruit.e, 0, 0);
    f.restore();
    for (let j = 0; j < 3; j++) {
      o.beginPath();
      o.arc(p.x + (hash2(k, j, 11) - 0.5) * rr * 1.6, p.y - rr * (0.55 + 0.35 * hash2(k, j, 12)), rr * (0.45 + 0.3 * hash2(k, j, 13)), 0, TAU);
      o.fill();
    }
  }
  f.globalCompositeOperation = 'source-atop';
  for (const p of hung) {
    const sh = f.createLinearGradient(0, p.y - r * 1.2, 0, p.y + r * 1.6);
    sh.addColorStop(0, 'rgba(20,40,10,0.55)');
    sh.addColorStop(0.45, `rgba(20,40,10,${0.35 * (1 - clamp(p.lit, 0, 1))})`);
    sh.addColorStop(1, 'rgba(20,40,10,0)');
    f.fillStyle = sh; f.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);
  }
  o.globalCompositeOperation = 'source-in'; o.drawImage(g.canvas, 0, 0);     // the tree, only where the blobs are
  g.drawImage(layer, 0, 0);
  g.drawImage(over, 0, 0);
  layer.width = over.width = 0;
}

function drawEmoji(emoji, x, y, px, opts = {}) {
  const s = sprite(emoji, px, opts.tint, opts.leaf, opts.center, opts.coat);
  if (!opts.flip && !opts.squash && opts.alpha === undefined) {
    ctx.drawImage(s.canvas, x - s.size / 2, y - s.size / 2, s.size, s.size);
    return;
  }
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.translate(x, y);
  ctx.scale(opts.flip ? -1 : 1, opts.squash || 1);
  ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
  ctx.restore();
}

// Rabbit coats (the genes are in the sim). Wild coats are agouti: each hair banded, so speckled.
const COAT = {
  wild: { key: 'wild', rgb: S.COATS.wild.rgb, speckle: 0.35, swatch: '#96724f' },
  black: { key: 'black', rgb: S.COATS.black.rgb, speckle: 0, swatch: '#3e3838' },
  sand: { key: 'sand', rgb: S.COATS.sand.rgb, speckle: 0.3, swatch: '#d4b280' },
  blue: { key: 'blue', rgb: S.COATS.blue.rgb, speckle: 0, swatch: '#808696' },
};
// In winter a coat pales toward white. A few steps of white keep the sprite cache small.
const moulted = new Map();
function coatLook(c) {
  if (!c.genes.coat) return undefined;
  const k = S.coatOf(c.genes), q = Math.round(S.whiteness(world, c) * 4) / 4, base = COAT[k];
  if (!q) return base;
  let look = moulted.get(k + q);
  if (!look) moulted.set(k + q, look = { key: k + q, rgb: base.rgb.map((v, i) => lerp(v, S.WINTER_COAT[i], q)),
    speckle: base.speckle * (1 - q), swatch: base.swatch });
  return look;
}

// The rabbit emoji is a white albino. Its fur takes the coat colour but keeps its light and
// shadow; the pink of the ears stays, and the red eye turns dark.
// The speckles are laid out on the glyph itself (from its centre, in font sizes), so they
// stay in place on the body at every zoom.
const SPECKS = 30;              // speckles across one font size
function recolourCoat(g, size, coat, em) {
  const img = g.getImageData(0, 0, size, size), d = img.data, cell = em / SPECKS;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (!d[i + 3]) continue;
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    const hi = Math.max(r, gr, b), sat = (hi - Math.min(r, gr, b)) / 255, lum = (r + gr + b) / 765;
    if (r > gr + 70 && lum < 0.45) { d[i] = 44; d[i + 1] = 32; d[i + 2] = 28; continue; }   // the eye
    const fur = clamp(1 - (sat - 0.08) * 6, 0, 1);
    if (!fur) continue;
    const speck = 1 + coat.speckle * (hash2(Math.floor((x - size / 2) / cell), Math.floor((y - size / 2) / cell), 7) - 0.5);
    const shade = (1 + (lum - 0.82) * 1.6) * speck;
    for (let k = 0; k < 3; k++) d[i + k] = lerp(d[i + k], Math.min(255, coat.rgb[k] * shade), fur);
  }
  g.putImageData(img, 0, 0);
}

// Fox fur: one sliding shade that families share. The grey is warm, so the shades between stay fox-coloured.
const FOX_FUR = [[245, 150, 60], [214, 92, 42], [176, 98, 62], [186, 176, 162], [250, 248, 244]];
function foxRGB(f) {
  const p = clamp(f, 0, 0.999) * (FOX_FUR.length - 1);
  const i = Math.floor(p), t = p - i, a = FOX_FUR[i], b = FOX_FUR[i + 1];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
}
const furCss = c => c.genes.coat ? coatLook(c).swatch
  : c.species === 'fox' ? `rgb(${foxRGB(c.genes.fur).join(',')})` : LOOKS[c.species].swatch;

// "Wild brown coat, carries black": the colours it hides can still turn up in its kits.
// Then how well it hides where it sits, as a fox would see it.
function coatLine(c) {
  const hid = S.hiddenCoats(c.genes), white = S.whiteness(world, c);
  const name = S.COATS[S.coatOf(c.genes)].name, v = c.alive && !c.hidden ? S.visibility(world, c) : 1;
  return `🎨 ${name[0].toUpperCase() + name.slice(1)} coat${white > 0.5 ? ', white for winter' : ''}` +
    `${hid.length ? `, carries ${hid.join(' and ')}` : ''}` +
    (v < 1.05 ? ' · 🫥 blends in here' : v > 1.3 ? ' · 👁️ stands out here' : '');
}

// A coloured rabbit for the inspector: the recoloured sprite, drawn once per coat.
const portraits = new Map();
function portraitHTML(c) {
  const art = c.alive && (c.species === 'fox' ? foxArtOf(c.genes.fur, 'stand') : { crow: CROW_ARTS[0], otter: OTTER_ARTS[3] }[c.species]);
  if (art) {                                               // painted, as in the meadow (the crow emoji splits on older systems)
    if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
    return `<img src="${portraits.get(art)}" alt="${c.sp.emoji}">`;
  }
  if (!c.alive || !c.genes.coat) return c.alive ? c.sp.emoji : '👻';
  const look = coatLook(c);
  if (!portraits.has(look.key)) portraits.set(look.key, dataURL(sprite(c.sp.emoji, 38, undefined, null, true, look).canvas));
  return `<img src="${portraits.get(look.key)}" alt="${c.sp.emoji}">`;
}

// ------------------------------------------------------------------ terrain
//
// The ground (grass, earth, shores and water) is painted by a shader, see ground.js, from a few
// small textures of one texel a tile. This part keeps them up to date: the grass and what lies
// on it a few times a second (paintTerrain), the lie of the land and the water when the water
// moves (updateWater).

const PALETTE = S.GROUND.seasons;   // [bare ground, lush grass] per season; camouflage uses it too
const tileData = new Float32Array(S.W * S.H * 4), bloomData = new Float32Array(S.W * S.H * 4);
let terrainTick = -1, terrainAt = 0;   // when the grass was last handed over, in ticks and real time
let groundSeed = [0, 0];               // moves the shader's noise, so each meadow has its own
let shoreSand = [200, 180, 130];
let lastZoom = 0, groundStill = 0;      // frames the zoom has held still, so sprites know when to repaint sharp
// Without WebGL the ground is only its colours, a pixel a tile, stretched.
const flat = document.createElement('canvas');
flat.width = S.W; flat.height = S.H;
const flatImg = new ImageData(S.W, S.H);

// This moment's [bare ground, lush grass]: the season's, turning into the next over its last fifth.
// The season now, the next, and how far the ground has turned toward the next (over a season's last fifth).
function seasonTurn() {
  const ck = S.clock(world), sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS;
  return [ck.season, (ck.season + 1) % 4, sp > 0.8 ? (sp - 0.8) / 0.2 : 0];
}

function groundColours() {
  const [now, next, t] = seasonTurn(), a = PALETTE[now], b = PALETTE[next];
  return [0, 1].map(k => a[k].map((v, i) => lerp(v, b[k][i], t)));
}

// How far the water has gone winter slate.
function coldness() {
  const [now, next, t] = seasonTurn();
  return 0.6 * lerp(now === 3 ? 1 : 0, next === 3 ? 1 : 0, t);
}

function paintTerrain() {
  const g = world.grass, water = world.water, [low, high] = groundColours(), damp = 1 - 0.12 * world.wet;
  shoreSand = low.map(v => v * 0.9 * damp);
  let sum = 0;
  for (let i = 0; i < g.length; i++) {
    let v = water[i] ? 0 : clamp(g[i] / 0.85, 0, 1);
    v = v * (2 - v);
    const o = i * 4, fi = world.fieldAt[i], f = fi >= 0 ? world.fields[fi] : null;
    const bloom = f ? S.fieldBloom(world, f, i, v) : 0;
    tileData[o] = v; tileData[o + 1] = water[i] / S.DEEP; tileData[o + 2] = world.ash[i]; tileData[o + 3] = world.wood[i];
    for (let k = 0; k < 3; k++) bloomData[o + k] = bloom > 0 ? f.tint[k] / 255 * bloom : 0;   // premultiplied, so it blends smoothly between tiles
    bloomData[o + 3] = bloom;
    sum += v;
    if (!Ground.ok) {
      for (let k = 0; k < 3; k++) flatImg.data[o + k] = water[i] ? [110, 175, 215][k] : lerp(low[k], high[k], v) * damp;
      flatImg.data[o + 3] = 255;
    }
  }
  terrainTick = world.tick; terrainAt = performance.now();
  // The shader's grass averages a little deeper than the palette's (greener by the water, see ground.js).
  const v = sum / g.length;
  edgeColour(...low.map((c, k) => lerp(c, high[k] * 0.96, v) * damp));
  if (Ground.ok) { Ground.set('tile', tileData); Ground.set('bloom', bloomData); }
  else flat.getContext('2d').putImageData(flatImg, 0, 0);
}

// Where the browser won't let the meadow reach (the clock, Safari's bars) it shows the page behind,
// so that takes the meadow's average colour and the seam disappears.
const themeMeta = $('meta[name="theme-color"]');
function edgeColour(r, g, b) {
  const css = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  if (themeMeta.content === css) return;
  themeMeta.content = css;
  document.documentElement.style.background = document.body.style.background = css;
}

// The ground; the shader paints it again only when it would look different.
// The sun shows the hills most when it is low: it comes up in the east, stands in the north at midday
// (the shadows fall south) and sets in the west. At night and under cloud they go flat, like the shadows.
// On a screen sharper than 2x the ground is painted at 2x and stretched: soft grass doesn't show the
// difference, and the shader has half the pixels to work out.
// It is a canvas of its own under the meadow's (#ground), slid into place, not copied onto every frame:
// Chrome lets a frame draw only so many pictures' bytes before it pays extra on every call, and a copy
// of the ground took most of them. The photo still draws it in (groundIn).
// Safari (and every browser on an iPhone: they're all WebKit) misses a frame each time it repaints a big
// ground, however cheap the shader: on a MacBook at 2x, five times a second at 1x speed. There the ground
// is kept to GROUND_WEBKIT pixels, but never below 1x. A phone's small screen stays at 2x.
const GROUND_DPR = 2, GROUND_WEBKIT = 1.5e6;
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\//.test(navigator.userAgent);
const groundLayer = Ground.ok ? Ground.canvas : null, laid = { w: 0, h: 0, x: 0, y: 0 };
if (groundLayer) { groundLayer.id = 'ground'; canvas.before(groundLayer); }
let groundIn = false;
function drawGround(z, ox, oy, shx, shy) {
  groundStill = z === lastZoom ? groundStill + 1 : 0; lastZoom = z;
  updateWater();
  if (!Ground.ok) {
    if (groundLayer) groundLayer.style.display = 'none';
    ctx.drawImage(flat, ox, oy, S.W * z, S.H * z); return;
  }
  const [low, high] = groundColours(), ck = S.clock(world), sn = sun(ck), k = 2.5 * Math.max(0, sn.a) * (0.6 + 0.4 * Math.abs(sn.lean));
  if (!mist.field) { mistField(); Ground.mist(mist.field, MIST_W, MIST_H, MIST_OUT); }
  const gd = Math.min(dpr, GROUND_DPR, WEBKIT ? Math.max(1, Math.sqrt(GROUND_WEBKIT / (vw * vh))) : Infinity);
  const w = Math.round(vw * gd), h = Math.round(vh * gd);
  Ground.draw({
    width: w, height: h, zoom: z, ox, oy, dpr: gd, seed: groundSeed, low, high, sand: shoreSand, fog: fogColour(high, ck.phase),
    snow: world.snow, damp: 1 - 0.12 * world.wet, ice: iceOver(), cold: coldness(), lx: k * sn.lean, ly: k * 0.8,
  });
  if (groundIn) { ctx.drawImage(Ground.canvas, Ground.view.x, Ground.view.y, w, h, 0, 0, vw, vh); return; }
  const g = Ground.canvas, cw = g.width / gd, ch = g.height / gd, x = shx - Ground.view.x / gd, y = shy - Ground.view.y / gd;
  if (cw !== laid.w || ch !== laid.h) { g.style.width = cw + 'px'; g.style.height = ch + 'px'; laid.w = cw; laid.h = ch; }
  if (x !== laid.x || y !== laid.y) { g.style.transform = `translate(${x}px, ${y}px)`; laid.x = x; laid.y = y; }
}

// Past its edges the meadow fades into a mist, thick by MIST_FULL tiles out. Where it starts wavers a long way in
// and out (MIST_WAVER), from MIST_IN tiles in, and its corners are round (MIST_ROUND), so the meadow never reads as
// a rectangle. How thick it is everywhere is worked out once, MIST_PX a tile (mist.field), and the ground shader
// paints the ground into it from that, in big pale clouds, while whatever stands in it is drawn that much
// see-through (fadeAt), so the trees and the animals fade into it too. Nothing is laid over the meadow for it.
// At dusk and at night the mist is painted lighter, so that under the dark it comes out a rose or lavender light
// instead of a muddy grey (fogColour).
const MIST_RGB = [230, 231, 214], MIST_TINT = 0.12, MIST_SNOW = [238, 242, 246];   // and white over the snow
const MIST_DUSK = [240, 176, 160], MIST_NIGHT = [124, 118, 176];
const MIST_IN = 6, MIST_FULL = 4, MIST_OUT = 10, MIST_PX = 3, MIST_ROUND = 14;
const MIST_WAVER = 8;                             // tiles the edge wavers in and out, all told
const MIST_DEEP = MIST_IN + MIST_WAVER / 2 + 2;   // further in than this there's none, wherever a bank of it rolls in
const NIGHT_RGB = [22, 30, 78], DUSK_RGB = [255, 140, 60];   // the dark and the dusk glow, washed over everything
const MIST_W = (S.W + 2 * MIST_OUT) * MIST_PX, MIST_H = (S.H + 2 * MIST_OUT) * MIST_PX;
const mist = { field: null };
function mistField() {
  const R = MIST_ROUND, f = mist.field = new Uint8Array(MIST_W * MIST_H);
  for (let j = 0; j < MIST_H; j++) for (let i = 0; i < MIST_W; i++) {
    const x = (i + 0.5) / MIST_PX - MIST_OUT, y = (j + 0.5) / MIST_PX - MIST_OUT;
    const qx = Math.abs(x - S.W / 2) - S.W / 2 + R, qy = Math.abs(y - S.H / 2) - S.H / 2 + R;
    const past = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
    const roll = MIST_WAVER * (blotches(x * 0.04, y * 0.04, 73) - 0.5) + 3 * (blotches(x * 0.25, y * 0.25, 72) - 0.5);   // banks of it rolling in
    const t = clamp((past + roll + MIST_IN) / (MIST_FULL + MIST_IN), 0, 1) * clamp(past + MIST_DEEP, 0, 1);
    f[j * MIST_W + i] = Math.round(255 * t * t * (3 - 2 * t));
  }
}
function mistAt(x, y) {                           // how thick the mist is here, 0..1
  if (x > MIST_DEEP && y > MIST_DEEP && x < S.W - MIST_DEEP && y < S.H - MIST_DEEP) return 0;
  if (!mist.field) mistField();
  const i = clamp(Math.floor((x + MIST_OUT) * MIST_PX), 0, MIST_W - 1), j = clamp(Math.floor((y + MIST_OUT) * MIST_PX), 0, MIST_H - 1);
  return mist.field[j * MIST_W + i] / 255;
}
// The mist's colour for the shader. At dusk and at night it's what, washed over by the dark and the dusk glow,
// comes out as the mist with a lavender (MIST_NIGHT) and a rose light (MIST_DUSK) laid over it.
const over = (c, rgb, a) => c.map((v, i) => v + (rgb[i] - v) * a);
function fogColour(high, phase) {
  const fog = MIST_RGB.map((v, i) => lerp(lerp(v, high[i], MIST_TINT), MIST_SNOW[i], Math.min(1, world.snow)));
  const d = darkness(phase), k = duskGlow(phase);
  if (d <= 0 && k <= 0) return fog.map(v => Math.round(v / 4) * 4);
  const seen = over(over(over(over(fog, NIGHT_RGB, d), DUSK_RGB, k), MIST_NIGHT, 0.7 * d), MIST_DUSK, 2.2 * k);
  return seen.map((v, i) => Math.round(clamp(((v - DUSK_RGB[i] * k) / (1 - k) - NIGHT_RGB[i] * d) / (1 - d), 0, 255) / 4) * 4);   // (each step paints the ground again)
}

// While fade is below 1, everything drawn is that much see-through, whatever alpha its drawing sets: a thing
// standing in the mist is faded into it (fadeAt), and unfade() puts it back.
let fade = 1;
const ALPHA = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
Object.defineProperty(ctx, 'globalAlpha', { get() { return ALPHA.get.call(ctx) / fade; }, set(v) { ALPHA.set.call(ctx, v * fade); } });
function fadeTo(f) {
  if (f === fade) return;
  const a = ctx.globalAlpha;
  fade = f; ctx.globalAlpha = a;
}
function fadeAt(x, y) {                           // false: it's lost in the mist, don't draw it
  const f = 1 - mistAt(x, y);
  if (f < 0.02) return false;
  fadeTo(f);
  return true;
}
const unfade = () => fadeTo(1);

function plantEmoji(season, p, g) {
  const kind = p.kind, f = p.field;
  if (f && season === f.season) return g >= S.FIELD_GRASS ? f.emoji[Math.floor(kind * f.emoji.length)] : '🌱';
  if (f && season < 2) return g > 0.4 ? '🌿' : null;      // a field out of bloom is just grass
  switch (season) {
    case 0: if (g > 0.55 && kind < 0.35) return kind < 0.12 ? '🌷' : kind < 0.24 ? '🌼' : '🌸';
      return g > 0.4 ? '🌿' : kind < 0.3 ? '🌱' : null;
    case 1: if (g > 0.55 && kind < 0.22) return kind < 0.06 ? '🌻' : '🌼';
      return g > 0.4 ? '🌿' : null;
    case 2: if (kind < 0.25) return '🍂';
      return g > 0.35 ? (kind < 0.5 ? '🌾' : '🌿') : null;
    default: return kind < 0.07 ? '❄️' : null;
  }
}

// Flowers and tufts only change with the grass and the season, so how each looks is worked out
// when the grass is handed to the ground (every 12 ticks) or the zoom changes, not every frame.
// Anything that changes how one looks belongs in plantLook.
const PLANT_EMOJI = ['🌷', '🌼', '🌸', '🌿', '🌱', '🌻', '🍂', '🌾', '❄️', '🪻'];
function plantLook(p, season, z) {
  const plantPx = z * 0.95;
  if (plantPx < 7) return null;
  if (world.water[p.i]) return null;                    // under the flood
  const g = world.grass[p.i], e = plantEmoji(season, p, g);
  return e && { e, px: Math.max(4, Math.round(plantPx * (0.55 + 0.45 * Math.min(1, g)))) };   // as the sprite rounds it
}

// How each plant looks, as px * 16 + which emoji (0: nothing), and when that was. plantArt is the
// flower's painting (flowerSprite's code + 1; 0: it's drawn as its emoji).
let plantKeys = null, plantArt = null, plantKeysWorld = null, plantKeysTick = -1, plantKeysZoom = 0, plantKeysDpr = 0;
function updatePlantLooks(z, season) {
  if (plantKeysWorld !== world) {
    plantKeys = new Int32Array(world.plants.length); plantArt = new Int32Array(world.plants.length);
    plantKeysWorld = world; plantKeysTick = -1;
  }
  if (plantKeysTick === terrainTick && plantKeysZoom === z && plantKeysDpr === dpr) return;
  plantKeysTick = terrainTick; plantKeysZoom = z; plantKeysDpr = dpr;
  for (let i = 0; i < world.plants.length; i++) {
    const p = world.plants[i], l = plantLook(p, season, z), art = l ? flowerArt(l.e, season) : -1;
    plantKeys[i] = l ? l.px * 16 + PLANT_EMOJI.indexOf(l.e) + 1 : 0;
    plantArt[i] = art < 0 ? 0 : flowerCode(art, Math.imul(p.n + 1, 2654435761) >>> 0, l.px) + 1;
  }
}

function drawPlants(z, ox, oy, season) {
  if (z * 0.95 < 7) return;
  updatePlantLooks(z, season);
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < world.plants.length; i++) {
    const key = plantKeys[i];
    if (!key) continue;
    const p = world.plants[i], art = plantArt[i];
    if (!fadeAt(p.x, p.y)) continue;
    if (art) {                                       // its foot a little below its spot, so the clump stands on it
      const px = key >> 4, w = FLOWER_BOX[0] * px, h = FLOWER_BOX[1] * px;
      const x = ox + p.x * z - w / 2, y = oy + p.y * z + px * 0.35 - h * FLOWER_FOOT;
      if (x + w < 0 || y + h < 0 || x > vw || y > vh) continue;
      ctx.drawImage(flowerSprite(art - 1), x, y, w, h);
      continue;
    }
    const s = sprite(PLANT_EMOJI[(key & 15) - 1], key >> 4);
    const x = ox + p.x * z - s.size / 2, y = oy + p.y * z - s.size / 2;
    if (x + s.size < 0 || y + s.size < 0 || x > vw || y > vh) continue;
    ctx.drawImage(s.canvas, x, y, s.size, s.size);
  }
  unfade();
  ctx.restore();
}

// ------------------------------------------------------------------ flowers
//
// Flowers are painted, not emoji, like the rocks: a clump of a few on their stems, with leaves at
// the foot and a soft shadow under it, in a few variants of each kind so a field isn't one stamp
// over and over. Each look is painted once per size, in half-octave steps, and stretched to the
// size each plant is drawn at. Tufts, sprouts and fallen leaves stay emoji.

const FLOWER_ARTS = [paintTulips, paintBlossom, paintButtercups, paintSunflowers, paintBluebells, paintHeather, paintAsters];
const FLOWER_VARIANTS = 5;
const FLOWER_BOX = [1.6, 1.8], FLOWER_FOOT = 0.82;   // a sprite in plant sizes, and where the ground is in it, from the top
const FLOWER_MAX_K = 15;                            // painted at most 2^7.5 = 181 px a plant, stretched past that
const flowerSprites = new Map();
let flowerBytes = 0;

// Which painting an emoji gets (-1: it stays an emoji). The season tells the spring bluebells from
// the autumn heather, and a spring blossom from an autumn aster.
function flowerArt(e, season) {
  switch (e) {
    case '🌷': return 0;
    case '🌸': return season === 2 ? 6 : 1;
    case '🌼': return 2;
    case '🌻': return 3;
    case '🪻': return season === 2 ? 5 : 4;
    default: return -1;
  }
}
// A sprite's code: which painting, which variant (from a hash of the plant), and k, the size it's
// painted at: 2^(k/2) device pixels a plant.
const flowerCode = (art, hash, px) =>
  (art * 8 + hash % FLOWER_VARIANTS) * 64 + Math.min(FLOWER_MAX_K, Math.max(0, Math.round(2 * Math.log2(px * dpr))));

function flowerSprite(code) {
  let c = flowerSprites.get(code);
  if (c) return c;
  const k = code & 63, v = (code >> 6) & 7, art = code >> 9, U = 2 ** (k / 2);
  if (flowerBytes > 32e6) { for (const o of flowerSprites.values()) freeImage(o); flowerSprites.clear(); flowerBytes = 0; }
  c = document.createElement('canvas');
  c.width = Math.ceil(U * FLOWER_BOX[0]); c.height = Math.ceil(U * FLOWER_BOX[1]);
  flowerBytes += c.width * c.height * 4;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height * FLOWER_FOOT); g.scale(U, U);
  g.lineCap = 'round'; g.lineJoin = 'round';
  softSpot(g, 0, 0.02, 0.34, 0.11, '34, 44, 14', 0.35);
  // Small, the heads are painted bigger and the stems no thinner than a pixel, so they still read.
  const r = n => hash2(art * 8 + v, 29, n), bold = 1 + 0.4 * clamp((36 - U) / 28, 0, 1);
  FLOWER_ARTS[art](g, r, v, bold, Math.max(0.022, 1 / U));
  flowerSprites.set(code, c);
  asBitmap(c, b => { if (flowerSprites.get(code) === c) { flowerSprites.set(code, b); c.width = 0; } else b.close(); });
  return c;
}

const LEAF_DARK = [64, 110, 46], LEAF_LIGHT = [104, 154, 66], STEM = [84, 132, 56];
const tone = (c, k, add = 0) => [c[0] * k + add, c[1] * k + add, c[2] * k + add];

// A leaf standing from the foot at x, len long, its tip leaning out by lean; lit down one side.
function flowerLeaf(g, x, len, lean, w) {
  for (const [rgb, dx, k] of [[LEAF_DARK, 0, 1], [LEAF_LIGHT, -w * 0.35, 0.55]]) {
    const x0 = x + dx, ww = w * k;
    g.fillStyle = rockRGB(rgb);
    g.beginPath(); g.moveTo(x0 - ww, 0);
    g.quadraticCurveTo(x0 - ww * 0.6 + lean * 0.2, -len * 0.6, x0 + lean, -len * (k === 1 ? 1 : 0.92));
    g.quadraticCurveTo(x0 + ww + lean * 0.5, -len * 0.45, x0 + ww, 0);
    g.closePath(); g.fill();
  }
}
// A stem from the foot up to (x, y), bowed a little.
function flowerStem(g, x, y, bend, w, rgb = STEM) {
  g.strokeStyle = rockRGB(rgb); g.lineWidth = w;
  g.beginPath(); g.moveTo(x * 0.3, 0); g.quadraticCurveTo(x * 0.3 + bend, y * 0.55, x, y); g.stroke();
}
// n heads spread over the clump, the tallest first (they stand behind), each { x, y } its top.
function flowerHeads(r, n, spread, lo, hi) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread) + (r(10 + i) - 0.5) * spread * 0.5;
    out.push({ x, y: -lerp(lo, hi, r(20 + i)), bend: (r(30 + i) - 0.5) * 0.12, turn: r(40 + i) * TAU });
  }
  return out.sort((a, b) => a.y - b.y);
}
// A ring of n petals round (x, y), each len long and wid wide, seen from a little above.
function petalRing(g, x, y, n, len, wid, turn, rgb, squash = 0.8) {
  g.save(); g.translate(x, y); g.scale(1, squash);
  g.fillStyle = rockRGB(rgb);
  for (let i = 0; i < n; i++) {
    const a = turn + i / n * TAU;
    g.beginPath(); g.ellipse(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, len * 0.5, wid * 0.5, a, 0, TAU); g.fill();
  }
  g.restore();
}
function dot(g, x, y, rx, ry, rgb, a = 1) {
  g.fillStyle = rockRGB(rgb, a); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
}
// Five round petals and a heart, a little darker round the edge.
function roundFlower(g, x, y, s, turn, rgb, heart) {
  petalRing(g, x, y, 5, s * 1.25, s * 1.05, turn, tone(rgb, 0.8));
  petalRing(g, x, y, 5, s * 1.1, s * 0.92, turn, rgb);
  dot(g, x - s * 0.25, y - s * 0.3, s * 0.3, s * 0.2, tone(rgb, 1, 40), 0.6);
  dot(g, x, y, s * 0.3, s * 0.25, heart);
}
// Thin rays round a disc, like a daisy's or an aster's.
function rayFlower(g, x, y, s, turn, n, rgb, disc) {
  petalRing(g, x, y, n, s * 1.9, s * 0.42, turn, tone(rgb, 0.78));
  petalRing(g, x, y, n, s * 1.7, s * 0.34, turn + Math.PI / n, rgb);
  dot(g, x, y, s * 0.36, s * 0.3, disc);
  dot(g, x - s * 0.1, y - s * 0.08, s * 0.16, s * 0.12, tone(disc, 1, 40));
}

const TULIPS = [[214, 58, 62], [232, 112, 146], [242, 168, 188], [244, 190, 70], [224, 84, 110]];
function paintTulips(g, r, v, bold, sw) {
  flowerLeaf(g, -0.08, 0.4, -0.22, 0.09); flowerLeaf(g, 0.07, 0.34, 0.22, 0.085);
  const rgb = TULIPS[v], dark = tone(rgb, 0.76), s = 0.15 * bold;
  for (const h of flowerHeads(r, r(1) < 0.5 ? 2 : 3, 0.2, 0.4, 0.66)) {
    flowerStem(g, h.x, h.y, h.bend, sw * 1.4);
    const { x, y } = h;                               // a cup of three petals, the middle one to the front
    g.fillStyle = rockRGB(dark);
    g.beginPath(); g.moveTo(x - s, y - s * 1.9);
    g.quadraticCurveTo(x - s * 1.1, y - s * 0.1, x, y); g.quadraticCurveTo(x + s * 1.1, y - s * 0.1, x + s, y - s * 1.9);
    g.lineTo(x + s * 0.45, y - s * 1.45); g.lineTo(x, y - s * 2.15); g.lineTo(x - s * 0.45, y - s * 1.45);
    g.closePath(); g.fill();
    g.fillStyle = rockRGB(rgb);
    g.beginPath(); g.moveTo(x - s * 0.62, y - s * 1.5);
    g.quadraticCurveTo(x - s * 0.7, y - s * 0.25, x, y - s * 0.08); g.quadraticCurveTo(x + s * 0.7, y - s * 0.25, x + s * 0.62, y - s * 1.5);
    g.lineTo(x, y - s * 2.15); g.closePath(); g.fill();
    g.strokeStyle = rockRGB(tone(rgb, 1.05, 40), 0.7); g.lineWidth = s * 0.2;
    g.beginPath(); g.moveTo(x - s * 0.3, y - s * 1.4); g.quadraticCurveTo(x - s * 0.38, y - s * 0.6, x - s * 0.05, y - s * 0.35); g.stroke();
  }
}

const BLOSSOMS = [[244, 176, 200], [236, 150, 184], [250, 204, 218], [232, 160, 198], [246, 188, 208]];
function paintBlossom(g, r, v, bold, sw) {
  flowerLeaf(g, -0.1, 0.24, -0.2, 0.07); flowerLeaf(g, 0.09, 0.22, 0.2, 0.07); flowerLeaf(g, 0, 0.26, 0.02, 0.06);
  for (const h of flowerHeads(r, 3, 0.22, 0.2, 0.42)) {
    flowerStem(g, h.x, h.y, h.bend, sw);
    roundFlower(g, h.x, h.y, 0.13 * bold, h.turn, BLOSSOMS[v], [246, 206, 96]);
  }
}

const BUTTERCUPS = [[246, 208, 60], [250, 220, 84], [242, 196, 50], [248, 212, 70]];
function paintButtercups(g, r, v, bold, sw) {
  flowerLeaf(g, -0.09, 0.24, -0.22, 0.07); flowerLeaf(g, 0.09, 0.21, 0.22, 0.07);
  const daisy = v === 4;                             // one in five is a daisy
  for (const h of flowerHeads(r, r(1) < 0.5 ? 3 : 4, 0.24, 0.22, 0.52)) {
    flowerStem(g, h.x, h.y, h.bend, sw);
    if (daisy) rayFlower(g, h.x, h.y, 0.085 * bold, h.turn, 12, [252, 250, 240], [240, 196, 50]);
    else roundFlower(g, h.x, h.y, 0.11 * bold, h.turn, BUTTERCUPS[v], [214, 164, 36]);
  }
}

function paintSunflowers(g, r, v, bold, sw) {
  flowerLeaf(g, -0.07, 0.26, -0.2, 0.08); flowerLeaf(g, 0.07, 0.24, 0.2, 0.08);
  const s = 0.24 * Math.min(bold, 1.2);
  for (const h of flowerHeads(r, v < 3 ? 1 : 2, 0.2, 0.72, 0.9)) {
    flowerStem(g, h.x, h.y, h.bend, sw * 2.2);
    for (const side of [-1, 1]) {                   // two big leaves on the stalk
      const ly = h.y * (side < 0 ? 0.42 : 0.58), lx = h.x * 0.6 + h.bend * 0.3;
      g.save(); g.translate(lx, ly); g.rotate(side * 0.9);
      dot(g, side * 0.1, 0, 0.12, 0.065, LEAF_DARK); dot(g, side * 0.095, -0.018, 0.08, 0.035, LEAF_LIGHT);
      g.restore();
    }
    const x = h.x, y = h.y - s * 0.3;
    petalRing(g, x, y, 16, s * 1.25, s * 0.42, h.turn, [212, 150, 28], 0.88);
    petalRing(g, x, y, 16, s * 1.1, s * 0.36, h.turn + Math.PI / 16, [248, 198, 44], 0.88);
    dot(g, x, y, s * 0.52, s * 0.46, [104, 66, 30]);
    dot(g, x + s * 0.05, y + s * 0.05, s * 0.34, s * 0.3, [76, 48, 22]);
    dot(g, x - s * 0.18, y - s * 0.16, s * 0.14, s * 0.1, [150, 104, 50], 0.8);
  }
}

// A spike of little bells up the top of a stem, smaller towards the tip.
function bellSpike(g, x, y, len, s, rgb) {
  const n = 7;
  for (let j = n - 1; j >= 0; j--) {
    const t = j / (n - 1), by = y + t * len, bx = x + (j % 2 ? 1 : -1) * s * (0.4 + 0.5 * t), bs = s * (0.55 + 0.45 * t);
    dot(g, bx, by, bs, bs * 1.1, tone(rgb, 0.72));
    dot(g, bx - bs * 0.15, by - bs * 0.2, bs * 0.78, bs * 0.8, rgb);
  }
  dot(g, x, y - s * 0.4, s * 0.45, s * 0.5, tone(rgb, 0.9, 20));   // the bud at the tip
}

const BLUEBELLS = [[112, 104, 206], [128, 112, 214], [100, 96, 196], [142, 122, 222], [118, 108, 210]];
function paintBluebells(g, r, v, bold, sw) {
  flowerLeaf(g, -0.07, 0.38, -0.26, 0.05); flowerLeaf(g, 0.06, 0.34, 0.28, 0.05); flowerLeaf(g, 0, 0.3, 0.04, 0.045);
  for (const h of flowerHeads(r, r(1) < 0.5 ? 2 : 3, 0.2, 0.62, 0.82)) {
    flowerStem(g, h.x, h.y, h.bend, sw * 1.2);
    bellSpike(g, h.x, h.y, 0.4, 0.058 * bold, BLUEBELLS[v]);
  }
}

// Low and bushy: woody sprigs fanning out from the foot, thick with tiny bells.
const HEATHERS = [[196, 112, 172], [184, 100, 164], [210, 132, 188], [176, 96, 160], [202, 122, 182]];
function paintHeather(g, r, v, bold, sw) {
  dot(g, 0, -0.05, 0.3, 0.12, [74, 104, 58]);
  const rgb = HEATHERS[v], n = 6;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + (r(50 + i) - 0.5) * 0.3, len = 0.42 + 0.2 * r(60 + i);
    const tx = Math.cos(a) * len, ty = Math.sin(a) * len * 0.9;
    flowerStem(g, tx, ty, (r(70 + i) - 0.5) * 0.08, sw, [112, 92, 70]);
    for (let j = 3; j <= 10; j++) {
      const t = j / 10, s = 0.045 * bold * (1.15 - 0.4 * t), side = j % 2 ? 1 : -1;
      const bx = tx * t + side * s * 0.8 * Math.sin(a), by = ty * t - side * s * 0.8 * Math.cos(a);
      dot(g, bx, by, s, s, tone(rgb, 0.75 + 0.3 * hash2(i, j, v)));
    }
  }
}

const ASTERS = [[170, 140, 220], [190, 150, 226], [160, 130, 210], [204, 160, 230], [180, 146, 224]];
function paintAsters(g, r, v, bold, sw) {
  flowerLeaf(g, -0.09, 0.24, -0.2, 0.06); flowerLeaf(g, 0.08, 0.26, 0.2, 0.06);
  for (const h of flowerHeads(r, r(1) < 0.5 ? 3 : 4, 0.24, 0.26, 0.52)) {
    flowerStem(g, h.x, h.y, h.bend, sw);
    rayFlower(g, h.x, h.y, 0.1 * bold, h.turn, 14, ASTERS[v], [238, 192, 60]);
  }
}

// ------------------------------------------------------------------ burrows
//
// A burrow is a hole dug into a low bank, with the earth that came out of it spilled in front.
// It shows its story: a half-dug one is a scrape and a pile of raw soil, a new one keeps its
// bright earth for a few days, a busy one wears paths into the grass, and one nobody visits
// grows over and starts to fall in before it collapses.

const dugAt = new WeakMap();        // when each burrow was finished, from the 'dug' news
const FRESH_DAYS = 3;
const burrowRand = (id, k) => { const s = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

// A flat-bottomed arch standing on y0, w to each side and h tall.
function arch(w, h, y0) {
  ctx.moveTo(-w, y0);
  ctx.bezierCurveTo(-w, y0 - h * 1.33, w, y0 - h * 1.33, w, y0);
  ctx.quadraticCurveTo(0, y0 + h * 0.2, -w, y0);
}

function drawBurrow(b, sx, sy, z, season, residents) {
  const rnd = k => burrowRand(b.id, k);
  const r = Math.max(5, z * 0.8) * (0.9 + 0.2 * rnd(0));
  const made = dugAt.get(b), done = b.dug >= 1;
  const fresh = !done ? 1 : made === undefined ? 0 : clamp(1 - (world.tick - made) / (FRESH_DAYS * S.TPD), 0, 1);
  const idle = b.count > 0 ? 0 : (world.tick - b.used) / (S.SEASON_DAYS * S.TPD);   // it falls in at 1
  const neglect = done ? clamp((idle - 0.4) / 0.6, 0, 1) : 0;
  const wear = clamp(residents / 3, 0, 1) * (1 - neglect);
  const pile = done ? 1 : 0.35 + 0.65 * Math.sqrt(b.dug);          // how much earth is out
  const open = clamp((b.dug - 0.35) / 0.65, 0, 1);                 // the hole shows once the scrape is deep
  const detail = r >= 9, flip = rnd(1) < 0.5 ? -1 : 1;
  const earth = [lerp(120, 158, fresh), lerp(92, 116, fresh), lerp(58, 70, fresh)];
  const rgba = (c, k, a) => `rgba(${c[0] * k | 0}, ${c[1] * k | 0}, ${c[2] * k | 0}, ${a})`;

  ctx.save();
  ctx.translate(sx, sy);

  // Paths worn into the grass by the rabbits who live here.
  if (detail && wear > 0.05) {
    ctx.lineCap = 'round';
    const n = rnd(3) < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 1.4 + (rnd(4 + i) - 0.5) * 0.7, len = r * (3 + 2.5 * rnd(8 + i));
      const bend = (rnd(12 + i) - 0.5) * r * 2, ca = Math.cos(a), sa = Math.sin(a) * 0.6;
      ctx.beginPath();
      ctx.moveTo(ca * r * 0.6, sa * r * 0.6 + r * 0.3);
      ctx.quadraticCurveTo(ca * len / 2 - sa * bend, sa * len / 2 + ca * bend + r * 0.3, ca * len, sa * len + r * 0.3);
      for (const [lw, al] of [[0.55, 0.12], [0.28, 0.18]]) {
        ctx.strokeStyle = `rgba(214, 198, 140, ${al * wear})`; ctx.lineWidth = r * lw; ctx.stroke();
      }
    }
  }

  ctx.rotate((rnd(2) - 0.5) * 0.25);

  // The low bank the hole goes into: light on top, a soft shadow along its foot.
  const mh = r * 0.8 * pile, mw = r * 1.3 * pile;
  const foot = ctx.createRadialGradient(mw * 0.1, 0, mw * 0.5, mw * 0.1, 0, mw * 1.15);
  foot.addColorStop(0, 'rgba(35, 45, 15, 0.3)'); foot.addColorStop(1, 'rgba(35, 45, 15, 0)');
  ctx.fillStyle = foot;
  ctx.beginPath(); ctx.ellipse(mw * 0.1, 0, mw * 1.15, mh * 0.8, 0, 0, TAU); ctx.fill();
  const lit = ctx.createRadialGradient(-mw * 0.2, -mh * 0.55, 0, -mw * 0.1, -mh * 0.3, mw * 0.95);
  lit.addColorStop(0, 'rgba(255, 250, 210, 0.42)'); lit.addColorStop(0.6, 'rgba(255, 250, 210, 0.12)');
  lit.addColorStop(1, 'rgba(255, 250, 210, 0)');
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.ellipse(0, -mh * 0.2, mw * 0.95, mh * 0.66, 0, 0, TAU); ctx.fill();

  // The spilled earth in front, soft at the edge. Grass takes it back once it's left alone.
  const ea = (done ? lerp(0.5, 0.9, fresh) : 0.9) * (1 - 0.85 * neglect);
  const spoil = s => {
    ctx.beginPath();
    ctx.ellipse(flip * r * 0.15, r * 0.55, r * 1.2 * s * pile, r * 0.5 * s * pile, 0, 0, TAU);
    ctx.ellipse(flip * r * 0.8, r * 0.7, r * 0.55 * s * pile, r * 0.32 * s * pile, 0, 0, TAU);
    ctx.ellipse(-flip * r * 0.7, r * 0.45, r * 0.45 * s * pile, r * 0.26 * s * pile, 0, 0, TAU);
  };
  ctx.fillStyle = rgba(earth, 1, ea * 0.35); spoil(1.25); ctx.fill();
  ctx.fillStyle = rgba(earth, 1, ea); spoil(1); ctx.fill();
  if (detail) {
    for (let i = 0; i < 8; i++) {                                    // clods and a pebble or two
      const a = rnd(20 + i) * TAU, d = Math.sqrt(rnd(30 + i)) * pile;
      const x = flip * r * 0.15 + Math.cos(a) * d * r * 1.3, y = r * 0.6 + Math.sin(a) * d * r * 0.55;
      const pebble = i < 2, s = r * (0.05 + 0.06 * rnd(40 + i));
      ctx.fillStyle = pebble ? `rgba(150, 146, 136, ${ea})` : rgba(earth, 0.7, ea);
      ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s, 0, 0, TAU); ctx.fill();
    }
  }

  // A half-dug burrow is only a scrape at first.
  if (!done) {
    ctx.fillStyle = rgba(earth, 0.55, 0.7);
    ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.6 * pile, r * 0.25 * pile, 0, 0, TAU); ctx.fill();
  }

  // The way in: an earth lip, then the dark tunnel, darkest at the back. It sinks as it falls in.
  if (open > 0) {
    const w = r * 0.62 * (0.5 + 0.5 * open), h = r * 0.72 * open * (1 - 0.35 * neglect), y0 = r * 0.28;
    ctx.fillStyle = rgba(earth, 0.78, 0.95 - 0.35 * neglect);
    ctx.beginPath(); arch(w * 1.25, h * 1.2, y0 + r * 0.06); ctx.fill();
    ctx.strokeStyle = `rgba(255, 235, 190, ${0.3 * (1 - 0.5 * neglect)})`;   // the sun on its rim
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath(); ctx.moveTo(-w * 1.2, y0 - h * 0.35);
    ctx.bezierCurveTo(-w * 1.1, y0 - h * 1.5, w * 1.1, y0 - h * 1.5, w * 1.2, y0 - h * 0.35); ctx.stroke();
    const dark = ctx.createLinearGradient(0, y0 - h, 0, y0);
    dark.addColorStop(0, '#0d0906'); dark.addColorStop(0.6, '#1f160f'); dark.addColorStop(1, '#46331f');
    ctx.fillStyle = dark;
    ctx.beginPath(); arch(w, h, y0); ctx.fill();

    // Grass on the bank above, leaning out over the rim, more of it the longer it's been left.
    if (detail) {
      const g = PALETTE[season][1], n = 4 + Math.round(6 * neglect), wl = w * 1.3;
      ctx.strokeStyle = rgba(g, 0.66, 0.95); ctx.lineWidth = Math.max(1, r * 0.055); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * 1.7 + (rnd(50 + i) - 0.5) * 0.25;
        const x = t * wl, top = y0 - h * 1.25 * Math.sqrt(Math.max(0, 1 - t * t)) - r * 0.02;
        const len = r * (0.16 + 0.12 * rnd(60 + i)) * (1 + 0.8 * neglect), out = t * r * 0.25;
        ctx.moveTo(x, top); ctx.quadraticCurveTo(x + out * 0.3, top - len * 0.8, x + out, top - len * (0.6 - 0.9 * neglect));
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ drawing

const MOVING = new Set(['wander', 'food', 'flee', 'chase', 'stalk', 'prowl', 'home', 'love', 'follow', 'friends', 'dig', 'arrive']);
const REMAINS_SIZE = 0.75;                // remains, next to a rabbit (drawRemains)
const HOLT_SIZE = 0.8;                    // the way into an otters' holt
const BODY_SIZE = 1;                      // a dead rabbit, lying on its side
const FOX_BODY = 1.4;                     // and a dead fox, next to that
const ALWAYS_BUBBLE = new Set(['flee', 'alarm', 'chase', 'love']);

function visible(sx, sy, pad) { return sx > -pad && sy > -pad && sx < vw + pad && sy < vh + pad; }

function darkness(phase) {
  if (phase >= 0.72 || phase < 0.02) return 0.45;
  if (phase >= 0.6) return 0.45 * (phase - 0.6) / 0.12;
  if (phase < 0.1) return 0.45 * (1 - (phase - 0.02) / 0.08);
  return 0;
}
const duskGlow = phase => phase > 0.58 && phase < 0.74 ? 0.10 * Math.sin(Math.PI * (phase - 0.58) / 0.16) : 0;

function render(now) {
  // Thunder rumbles the whole screen a little.
  const q = now - ui.sky.boom < 350 && ui.speed <= 4 ? 3 * (1 - (now - ui.sky.boom) / 350) : 0;
  const shx = q * Math.sin(now / 17), shy = q * Math.cos(now / 23);
  ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
  ctx.imageSmoothingEnabled = true;
  // Sprites are painted near the size they're drawn at, so 'high' looks the same, but Chrome pays
  // for it on every draw, GPU or not: with it, a wood on screen dropped frames.
  ctx.imageSmoothingQuality = 'low';
  spriteFrame++; paintedMs = 0; standIns = true; turned = 0;
  ctx.clearRect(-8, -8, vw + 16, vh + 16);          // past the meadow's edge the page shows through
  const [ox, oy] = toScreen(0, 0);
  const z = cam.zoom, ck = S.clock(world);
  drawGround(z, ox, oy, shx, shy);
  drawWaves(weatherClock);   // (the wind's, so they still while it's paused)
  drawFlow(now, ck);
  drawShore(z, ox, oy, ck.season);
  drawPlants(z, ox, oy, ck.season);                  // over the waves, which can pass a flower by the water
  if (z >= 6) drawDashes(now, z);                    // voles a fox or an owl missed
  drawPond(now, z);

  // Burrows, drawn by hand: some browsers clip the 🕳️ glyph in half.
  const residents = new Map();
  for (const c of world.creatures) if (c.alive && c.home) residents.set(c.home, (residents.get(c.home) || 0) + 1);
  for (const b of world.burrows) {
    const [sx, sy] = toScreen(b.x, b.y);
    if (visible(sx, sy, z * 5) && fadeAt(b.x, b.y)) drawBurrow(b, sx, sy, z, ck.season, residents.get(b) || 0);
  }
  for (const d of world.decor) {                            // and the otters' holts, in the roots of a tree on the bank
    if (!d.holt || !d.door) continue;
    const [sx, sy] = toScreen(d.door.x, d.door.y), px = Math.max(6, (8 + z) * HOLT_SIZE);
    if (visible(sx, sy, px) && fadeAt(d.door.x, d.door.y)) drawEmoji('holt:0', sx, sy, px);
  }
  unfade();
  drawRemains(z);

  const sel = world.byId.get(ui.selectedId);
  if (sel) drawSelectionUnder(sel, now);
  if (ui.picked) drawPickedUnder(now);

  // Trees, rocks and animals, back to front.
  const items = [];
  for (const d of world.decor) {                           // (a hive is in one of the trees)
    if (d.tree && d.size * z < SEEDLING_PX && !d.stump) continue;   // a seedling too small to see from here
    const [sx, sy] = toScreen(d.x, d.y);
    if (visible(sx, sy, d.tree ? treePx(d) : d.size * z)) items.push({ y: d.y, d, sx, sy, f: 1 - mistAt(d.x, d.y) });
  }
  for (const h of world.hives) {                           // a swarm hanging in a tree
    if (!h.cluster) continue;
    const [sx, sy] = toScreen(h.x, h.y);
    if (visible(sx, sy, 3 * z)) items.push({ y: h.y, h, sx, sy, f: 1 - mistAt(h.x, h.y) });
  }
  const shown = [];
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    if (c.species === 'fox' || c.species === 'owl') {      // hunting voles: the rustle it's after
      watchLeap(c, now);
      const to = rustleOf(c);
      if (to) { const [rx, ry] = toScreen(to.x, to.y); if (visible(rx, ry, 30)) items.push({ y: to.y, rustle: c, to, sx: rx, sy: ry, f: 1 - mistAt(to.x, to.y) }); }
    }
    const [sx, sy] = screenOf(c);
    if (!visible(sx, sy, 60)) continue;
    const it = { y: c.y + (c.mode === 'dance' ? DANCE_FRONT : c.species === 'owl' && c.mode !== 'gulp' ? OWL_FRONT : 0), c, sx, sy, f: c.held ? 1 : 1 - mistAt(c.x, c.y) };
    if (c.species === 'crow' && crowSeat(c)) it.y -= (seat.y - seat.tree.y) * SEAT_SORT;   // up a tree: just after it, not after the trees just in front
    items.push(it);
    if (!c.held) shown.push(it);                           // (one held up has its shadow here, and is drawn last, in the hand)
  }
  items.sort((a, b) => a.y - b.y);
  // Shadows first, all together, so a tree's shadow never lands on a rabbit behind it.
  const sn = sun(ck);
  for (const it of items) {
    if (it.f < 0.02) continue;                             // lost in the mist
    fadeTo(it.f);
    if (it.d) drawDecorShadow(it.d, it.sx, it.sy, sn);
    else if (it.c) {
      drawCreatureShadow(it.c, it.sx, it.sy, now, sn);
      if (it.c.mine && !it.c.held && it.c.id !== ui.selectedId) drawRingUnder(it.c, it.sx, it.sy);
    }
  }
  for (const it of items) {
    if (it.f < 0.02) continue;
    fadeTo(it.f);
    if (it.d) (it.d.hive ? drawBeeTree : drawDecor)(it.d, it.sx, it.sy, now, ck);
    else if (it.h) drawSwarm(it.h, it.sx, it.sy);
    else if (it.rustle) drawRustle(it.rustle, it.to, it.sx, it.sy, z);
    else if (it.c.held) continue;
    else if (falls.size && falls.has(it.c)) drawFalling(it.c, falls.get(it.c), it.sx, it.sy, now);
    else drawCreature(it.c, it.sx, it.sy, now);
  }
  unfade();
  if (splashes.length) drawSplashes(now);
  drawFallingLeaves(now);
  drawPollen(now);
  drawButterflies(now, ck);

  // Dusk and night.
  const dark = darkness(ck.phase), dusk = duskGlow(ck.phase);
  if (dark > 0) wash(`rgba(${NIGHT_RGB}, ${dark})`);
  drawFireflies(now, dark);
  if (dusk > 0) wash(`rgba(${DUSK_RGB}, ${dusk})`);
  drawFire(now);
  drawWeather(now, ck);

  // Burrow snores at night.
  if (ck.night && z >= 8) {
    for (const b of world.burrows) {
      if (b.count <= 0) continue;
      const [sx, sy] = toScreen(b.x, b.y);
      if (!visible(sx, sy, 40)) continue;
      const bob = Math.sin(now / 600 + b.id) * 3;
      drawEmoji('💤', sx + z * 0.8, sy - z * 1.1 + bob, Math.max(11, z * 0.8), { alpha: 0.85 });
    }
    for (const h of world.hives) {
      if (!h.bees || h.cluster) continue;
      const [sx, sy] = toScreen(h.x, h.y);
      const px = z * h.tree.size;
      if (visible(sx, sy, 40)) drawEmoji('💤', sx + px * 0.12, sy - px * 0.2 + Math.sin(now / 600 + h.id) * 3, Math.max(11, z * 0.8), { alpha: 0.85 });
    }
  }

  // Thought bubbles above the dark. Not in the intro: its lines tell the story.
  if (!intro.on) for (const it of shown) {
    const c = it.c;
    if (LOOKS[c.species].quiet) continue;
    if (c.species === 'crow' && c.mode === 'sleep' && c.perch?.k && c.id !== ui.selectedId && c.id !== ui.hoverId) continue;   // one 💤 a tree at the roost
    if (c.species === 'otter' && c.sleeping && c.home?.holt && c.home.holt !== c.id && c.id !== ui.selectedId && c.id !== ui.hoverId) continue;   // and a holt
    const important = ALWAYS_BUBBLE.has(c.mode);
    if (!(important || c.id === ui.selectedId || c.id === ui.hoverId || z >= 20)) continue;
    const m = S.mood(world, c);
    const px = creaturePx(c), up = c.sp.flies ? liftOf(c, px, now) : 0;
    if (m.emoji) drawBubble(m.emoji, it.sx, it.sy - up, px, important);
  }

  drawEffects(now);
  drawZaps(now);
  if (held) drawHeld(now);
  if (sel) drawSelectionOver(sel, now);
  if (ui.picked) drawPickedOver();
  const hov = world.byId.get(ui.hoverId);
  if (hov && hov.alive && !hov.hidden && hov.id !== ui.selectedId) {
    const [sx, sy] = screenOf(hov);
    drawLabel(`${hov.name} · ${S.mood(world, hov).text}`, sx, sy + creaturePx(hov) * 0.55 + 6, hov.mine);
  } else if (ui.hoverHive && ui.hoverHive !== ui.picked?.it) {
    const h = ui.hoverHive, [sx, sy] = toScreen(h.x, h.y);
    const where = h.patch && h.patch.field ? `the ${h.patch.field.name}` : 'flowers';
    const dance = S.patchFresh(world, h) ? ` · 💃 ${where} to the ${compass(h.patch.x - h.x, h.patch.y - h.y)}` : '';
    drawLabel(`🐝 ${h.queen ? `Queen ${h.queen.name}'s hive` : 'Empty hive'} · ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'} · ${Math.round(h.honey)} honey${dance}`, sx, sy + z * 0.5 + 6);
  }
  standIns = false;                                    // a portrait for the inspector is kept, so it's always painted
}

// Remains lying in the grass (sim.js leaveRemains). A rabbit or a fox lies whole, then opened, picked over and a
// pelt as the meat goes (BODY_STAGES; one a fox or an owl caught starts opened), and the pelt fades. A bird's are
// a few feathers, fading as they go. Painted once per look and size.
const BODY_STAGES = [0.7, 0.4, 0.15];     // meat left, of what there was, where each next stage begins
const remainsLooks = new WeakMap();
const remainsPx = z => Math.max(8, (8 + z) * REMAINS_SIZE);
const bodyPx = z => Math.max(8, (8 + z) * BODY_SIZE);
function remainsLook(c) {                 // a rabbit's coat (BODY_COATS) or a fox (FOX_LOOK), or a bird's feathers, an otter's fur (REMAINS_ARTS)
  if (c.species === 'fox') return FOX_LOOK;
  if (c.species !== 'rabbit') return c.species === 'owl' ? 1 : c.species === 'otter' ? 2 : 0;
  return S.whiteness(world, c) > 0.5 ? 4 : BODY_COAT_OF[S.coatOf(c.genes)];
}
function drawRemains(z) {
  if (!world.carcasses.length) return;
  const rpx = remainsPx(z), bpx = bodyPx(z);
  for (const k of world.carcasses) {
    if (k.meat <= 0) continue;
    const fox = k.c.species === 'fox', body = fox || k.c.species === 'rabbit', px = fox ? bpx * FOX_BODY : body ? bpx : rpx;
    const sx = (k.x - cam.x) * z + vw / 2, sy = (k.y - cam.y) * z + vh / 2;   // (toScreen, without an array)
    if (!visible(sx, sy, px) || !fadeAt(k.x, k.y)) continue;
    let look = remainsLooks.get(k);
    if (look === undefined) remainsLooks.set(k, look = remainsLook(k.c));
    const m = k.meat / k.full, flip = k.c.id % 2 === 1;
    if (!body) { drawEmoji(REMAINS_ARTS[look], sx, sy, px, { alpha: 0.45 + 0.55 * m, flip }); continue; }
    const [open, picked, pelt] = BODY_STAGES, caught = k.c.cause === 'fox' || k.c.cause === 'owl';
    const stage = m > open && !caught ? 0 : m > picked ? 1 : m > pelt ? 2 : 3;
    drawEmoji(BODY_ARTS[look * 4 + stage], sx, sy, px, { alpha: stage === 3 ? 0.4 + 0.6 * m / pelt : undefined, flip });
  }
  unfade();
}

// How each kind is drawn: its size next to a rabbit, and whether its emoji faces left (then it
// is mirrored to face where it's going). Animals that fly (c.sp.flies) hover above their shadow.
const LOOKS = {
  rabbit: { size: 1, facesLeft: true },
  fox: { size: 1.4, facesLeft: true },         // painted (paintFox), not the emoji
  bee: { size: 0.38, facesLeft: true, swatch: '#e8b83a', quiet: true },   // quiet: no thought bubbles
  crow: { size: 0.95, facesLeft: true, swatch: '#4a4e5e' },               // painted (crowArt), not the emoji
  owl: { size: 0.85, facesLeft: false, swatch: '#9a6a3e' },               // a face: it does not care
  otter: { size: 1.5, facesLeft: true, swatch: '#7c5232' },               // painted (paintOtter), not the emoji
};

// Grows with zoom, but never shrinks to a speck when you look at the whole meadow. A tree is four
// to seven rabbits tall.
const creaturePx = c => (8 + cam.zoom) * LOOKS[c.species].size * c.scale * (0.55 + 0.45 * S.growth(world, c));
const flipOf = c => LOOKS[c.species].facesLeft && c.facing > 0;

// How full a forager's load is, 0..1.
const loadOf = c => c.load ? Math.min(1, c.load / (S.LOAD * S.HONEY)) : 0;

// How high off the ground it is drawn: a hop, or a flier's hover. A sipping bee sits on the flower,
// and a laden one flies lower.
function liftOf(c, px, now) {
  if (c.species === 'otter') return 0;                // (it lopes: drawOtter)
  if (!c.sp.flies) return hopOf(c, px, now);
  if (c.species === 'crow') return birdLift(c, crowHeight(c, px), c.sleeping) + crowHop(c, px);
  if (c.species === 'owl') return birdLift(c, owlHeight(c, px));
  const bob = ui.speed > 0 ? Math.sin(now / 90 + c.id) * px * 0.08 : 0, fly = px * (0.9 - 0.3 * loadOf(c)), tree = c.target?.tree;
  if (tree && (c.mode === 'sip' || c.mode === 'flower')) {   // blossom in a tree (sim.js addBlossoms): up in its crown
    const crown = treePx(tree) * (tree.kind === 'hawthorn' ? 0.9 : 1.25) * c.target.up;
    return lerp(fly, crown, c.mode === 'sip' ? 1 : clamp(1.5 - Math.hypot(c.target.x - c.x, c.target.y - c.y) / 2, 0, 1)) + bob;
  }
  return (c.mode === 'sip' ? px * 0.15 : fly) + bob;
}

// A crow is on the ground pecking, up in the air, or up a tree on its seat at the roost or its nest (sim.js
// crowTick). It glides between them: the height eases in sim time, so it lands and takes off and stops with the clock.
const CROW_FLY = 1.5;              // how high a crow flies, in its size
const CROW_EASE = 12;              // ticks to get most of the way to a new height
const CROW_HOP_LEN = 0.35;         // tiles a hop, hopping about on the ground
// Where the crown is in each kind's painting, in the tree's size (treePx), measured off trees.js: its bottom
// and top, and how far it reaches to each side at five heights from the bottom up. (emoji: the emoji trees.)
const CROWNS = {
  oak: [0.33, 0.8, 0.4, 0.44, 0.42, 0.33, 0.2], beech: [0.42, 0.88, 0.33, 0.38, 0.37, 0.3, 0.16],
  maple: [0.5, 0.95, 0.26, 0.33, 0.34, 0.3, 0.18], birch: [0.62, 1.28, 0.3, 0.4, 0.42, 0.4, 0.28],
  apple: [0.22, 0.62, 0.3, 0.36, 0.36, 0.32, 0.2], cherry: [0.22, 0.62, 0.3, 0.36, 0.36, 0.32, 0.2],
  pine: [0.3, 1.05, 0.36, 0.31, 0.25, 0.18, 0.12], hawthorn: [0.2, 0.5, 0.3, 0.33, 0.32, 0.28, 0.18],
  emoji: [0.3, 0.75, 0.35, 0.42, 0.42, 0.36, 0.22],
};
const SEAT_OUT = 0.9;              // how far out along the crown's reach a seat on the side is
const NEST_SEAT = [0.12, 0.85];    // the nest: a little to the side, high in the crown
const SEAT_SORT = 0.95;            // how much of the way from its seat (just in front of the tree) to the tree a crow up it is drawn at
// A crow's seat up its tree (sim.js CROW_SEATS: side and height in the crown), on screen: how far across from the
// trunk and how high up, in px. Null when it isn't at the roost or its nest. (One object, filled in again each time.)
const seat = { tree: null, x: 0, y: 0, dx: 0, up: 0 };
function crowSeat(c) {
  let d, s, t;
  if ((c.mode === 'sleep' || c.mode === 'roost') && c.perch) { d = c.perch.tree; s = S.CROW_SEATS[c.perch.k][0] * (d.id % 2 ? -1 : 1); t = S.CROW_SEATS[c.perch.k][1]; seat.x = c.perch.x; seat.y = c.perch.y; }
  else if (c.mode === 'nest' && c.home) { d = c.home; s = NEST_SEAT[0]; t = NEST_SEAT[1]; seat.x = d.x; seat.y = d.y + 0.1; }
  else return null;
  const k = treeWorker ? CROWNS[treeKind(d)] || CROWNS.oak : CROWNS.emoji, px = treePx(d), i = t * 4, j = Math.min(3, i | 0);
  seat.tree = d; seat.dx = s * SEAT_OUT * lerp(k[2 + j], k[3 + j], i - j) * px; seat.up = lerp(k[0], k[1], t) * px;
  return seat;
}
// How far across a crow is drawn from where the sim has it: onto its seat, as it comes in to land there.
const seatShift = c => { const st = crowSeat(c); return st ? (st.dx - (st.x - st.tree.x) * cam.zoom) * (1 - near(c, st, 4)) : 0; };
const CROW_AIR = new Set(['flap', 'flock', 'love', 'follow', 'drive']);                               // flying (and 'mob': round an owl)
const CROW_LANDS = new Set(['remains', 'forage', 'fetch', 'cache', 'apple', 'unbury', 'pool', 'gather']); // flying there, and down
const CROW_WEAVES = new Set(['flap', 'flock', 'remains', 'forage', 'fetch', 'cache', 'apple', 'pool', 'gather', 'roost']);   // on the wing, going somewhere
const CROW_PECKS = new Set(['peck', 'carrion', 'munch', 'bury', 'unbury', 'tadpole']);       // heads down
const birdLifts = new WeakMap();
const near = (c, p, far) => clamp(Math.hypot(p.x - c.x, p.y - c.y) / far, 0, 1);
function crowHeight(c, px) {
  const fly = px * CROW_FLY, st = crowSeat(c);
  if (st) return lerp(st.up, fly, near(c, st, 4));
  if (c.mode === 'roost') return fly;
  if (CROW_AIR.has(c.mode)) return fly;
  if (c.mode === 'mob') { const o = world.byId.get(c.targetId); return Math.max(fly, owlSits(o) + px * 0.6); }   // round the owl in its tree
  return CROW_LANDS.has(c.mode) && c.target ? fly * near(c, c.target, 2) : 0;
}
// An owl sits up a tree: asleep on a branch by day, on its perch hunting, or in its hollow on her eggs. It glides
// from tree to tree and drops to the grass on a vole (sim.js owlTick). Its height eases like a crow's.
const OWL_FLY = 1.3;               // how high an owl flies, in its size
const OWL_PERCH = 0.45;            // how far up a tree's painting it sits on a branch
const OWL_HOLLOW = 0.3;            // and in the hollow
const OWL_FRONT = S.H;             // up in a tree or gliding over, it's drawn over the trees (the ones in front would hide it); down on a vole, among them
const OWL_SITS = new Set(['sleep', 'perch', 'hoot']);                   // sitting in its tree (c.perch)
const OWL_LANDS = new Set(['roost', 'hunt', 'home', 'shift']);          // flying there, and up into it
const owlSits = o => (o && o.perch && o.perch.tree && Math.hypot(o.perch.x - o.x, o.perch.y - o.y) < 0.5 ? treePx(o.perch.tree) * OWL_PERCH : 0);
function owlHeight(c, px) {
  const fly = px * OWL_FLY;
  if (c.mode === 'nest') return c.home ? lerp(treePx(c.home) * OWL_HOLLOW, fly, near(c, c.home, 3)) : 0;
  if (OWL_SITS.has(c.mode)) return owlSits(c);
  if (OWL_LANDS.has(c.mode)) {
    const to = c.mode === 'hunt' ? c.target : c.perch;
    return to && to.tree ? lerp(treePx(to.tree) * OWL_PERCH, fly, near(c, to, 3)) : fly;
  }
  if (c.mode === 'swoop') {                        // down from its perch
    const to = world.byId.get(c.targetId) || c.target;
    return to ? (c.perch && c.perch.tree ? treePx(c.perch.tree) * OWL_PERCH : fly) * near(c, to, 4) : 0;
  }
  return c.mode === 'gulp' ? 0 : fly;
}
// A sitting bird (sit) is at its height at once: its tree grows with the zoom and its easing wouldn't.
function birdLift(c, want, sit) {
  const t = world.tick + acc;
  let s = birdLifts.get(c);
  if (!s) birdLifts.set(c, s = { h: want, t, z: cam.zoom });
  if (sit) { s.h = want; s.t = t; s.z = cam.zoom; return want; }
  if (s.z !== cam.zoom) { s.h *= (8 + cam.zoom) / (8 + s.z); s.z = cam.zoom; }   // (both grow with the zoom, about)
  if (s.t !== t) { s.h += (want - s.h) * Math.min(1, Math.abs(t - s.t) / CROW_EASE); s.t = t; }
  return s.h;
}
// Walking about on the ground (sim.js peck): on its way, not yet stopped where it's going to peck.
const crowWalks = c => c.mode === 'peck' && c.target && (c.x !== c.target.x || c.y !== c.target.y);
// Hopping there (t.hop): an arc each CROW_HOP_LEN, down on its feet as it gets there.
function crowHop(c, px) {
  const t = c.target;
  if (!crowWalks(c) || !t.hop) return 0;
  const u = Math.hypot(t.x - c.x, t.y - c.y) / CROW_HOP_LEN;
  return Math.sin(Math.PI * (u - Math.floor(u))) * px * 0.14;
}
// Its painting: asleep on a branch (or sitting on her eggs), wingbeats in the air (with an acorn in its beak,
// carrying one), a step each CROW_STRIDE of its length walking, and a peck now and then when it stops.
const CROW_BEAT = 120;             // ms a wingbeat
const CROW_STRIDE = 0.18;          // of its length, a step
function crowArt(c, up, px, now) {
  if (c.sleeping) return CROW_ARTS[8];
  if (up > px * 0.3) return CROW_ARTS[(c.mode === 'cache' ? 4 : 2) + (ui.speed > 0 ? ((now / CROW_BEAT + c.id) | 0) & 1 : 0)];
  if (ui.speed > 0 && crowWalks(c)) {   // (the step goes by where it is, so it stops when it stops)
    if (c.target?.hop) return CROW_ARTS[0];
    const k = cam.zoom / (px * CROW_STRIDE);
    return CROW_ARTS[(Math.floor(c.x * k) + Math.floor(c.y * k)) & 1 ? 6 : 7];
  }
  return CROW_PECKS.has(c.mode) && ui.speed > 0 && Math.sin(now / 170 + c.id * 1.7) > 0.3 ? CROW_ARTS[1] : CROW_ARTS[0];
}

// Fliers don't fly straight: they weave a loose figure of eight about their way, half as much
// when laden, and a crow in slow wide swings, only on the wing. Only in the drawing. It keeps sim time, so it
// stops with the clock, and its size eases in and out (in c's entry in weaves), so a bee never jumps when she
// picks a new target.
const WEAVE = 0.3, WEAVE_TICKS = 45;               // tiles to each side; ticks per loop
const CROW_SWING = 2.5;                            // times as slow a loop, for a crow
const weaves = new WeakMap();
function weaveOf(c) {
  const t = world.tick + acc, crow = c.species === 'crow', goal = crow ? CROW_WEAVES.has(c.mode) ? c.mode === 'roost' ? c.perch : c.target : null
    : c.mode === 'home' || c.mode === 'unload' ? c.home : c.mode === 'sip' || c.mode === 'dance' ? null : c.target;
  const want = goal ? Math.min(1, Math.hypot(goal.x - c.x, goal.y - c.y) / 1.5) * (1 - 0.5 * loadOf(c)) : 0;
  let s = weaves.get(c);
  if (!s) weaves.set(c, s = { amp: want, t, x: 0, y: 0 });
  if (s.t !== t) {
    s.amp += (want - s.amp) * Math.min(1, (t - s.t) / 8);
    s.t = t;
    const ph = t / (crow ? WEAVE_TICKS * CROW_SWING : WEAVE_TICKS) * TAU + c.id;
    s.x = WEAVE * s.amp * Math.sin(ph); s.y = WEAVE * 0.6 * s.amp * Math.sin(2 * ph + c.id);
  }
  return s;
}

// Where a creature is drawn on screen: where it is, plus a flier's weave. A dancer is drawn a
// little in front of her hive, where the tree doesn't hide her, and her eight a size bigger.
const DANCE_FRONT = 0.45, DANCE_SIZE = 1.8;
function screenOf(c) {
  const p = toScreen(c.x, c.y), z = cam.zoom;
  if ((c.species === 'bee' || c.species === 'crow') && !c.hidden) { const s = weaveOf(c); p[0] += s.x * z; p[1] += s.y * z; }
  if (c.species === 'crow') p[0] += seatShift(c);                  // up a tree: onto its seat in the crown
  if (c.mode === 'dance') {
    const [x, y] = danceAt(c.timer + 1);
    p[0] += x * (DANCE_SIZE - 1) * z; p[1] += (y * (DANCE_SIZE - 1) + DANCE_FRONT) * z;
  }
  return p;
}

// The waggle dance: the figure of eight she has just traced glows behind her, and specks run
// out from it the way the patch lies. Her path is the sim's (beeForage): where she is at timer
// + 1, as the sim counts it down after moving her.
const danceAt = timer => { const a = timer * 0.3; return [0.35 * Math.sin(a), 0.18 * Math.sin(2 * a)]; };
function drawDance(c, bx, by, px) {
  const h = c.home, z = cam.zoom * DANCE_SIZE, [x0, y0] = danceAt(c.timer + 1);
  const cx = bx - x0 * z, cy = by - y0 * z;                // the middle of the eight, at her height
  const d = 2 * Math.max(1.8, px * 0.1);
  for (let k = 1; k <= 12; k++) {
    const [x, y] = danceAt(c.timer + 1 + k * 0.6), f = 1 - k / 13;
    ctx.globalAlpha = 0.8 * f;
    ctx.drawImage(POLLEN_DOTS[1], cx + x * z - d * f / 2, cy + y * z - d * f / 2, d * f, d * f);
  }
  if (S.patchFresh(world, h)) {
    const dx = h.patch.x - h.x, dy = h.patch.y - h.y, n = Math.hypot(dx, dy) || 1, t = world.tick + acc;
    for (let k = 0; k < 5; k++) {
      const u = (t / 30 + k / 5) % 1, r = cam.zoom * (0.5 + 1.6 * u), e = d * 1.2;
      ctx.globalAlpha = 0.9 * Math.sin(Math.PI * u);
      ctx.drawImage(POLLEN_DOTS[0], cx + dx / n * r - e / 2, cy + dy / n * r - e / 2, e, e);
    }
  }
  ctx.globalAlpha = 1;
}

// How high off the ground a hop has lifted it, in screen pixels. At the hole, a digger doesn't hop
// but scrabbles: a quick small bob. A mousing fox's pounce is the high arc up and over onto the vole,
// in sim time (sim.js mouse), so a paused one hangs in the air.
const POUNCE_HIGH = 0.9;           // how high the pounce goes, in the fox's size
function hopOf(c, px, now) {
  if (c.mode === 'pounce') return Math.sin(Math.PI * clamp((S.POUNCE_TICKS - c.timer + acc) / S.POUNCE_TICKS, 0, 1)) * px * POUNCE_HIGH;
  if (ui.speed <= 0) return 0;
  if (atHole(c)) return Math.abs(Math.sin(now / 70 + c.id)) * px * 0.03;
  const fast = c.mode === 'flee' || c.mode === 'chase';
  return MOVING.has(c.mode) || (c.mode === 'mouse' && c.target) ? Math.abs(Math.sin(now / (fast ? 55 : 120) + c.id)) * px * (fast ? 0.16 : 0.1) : 0;
}

// Digging, at its side of the hole (see dig in sim.js).
const atHole = c => {
  const b = c.mode === 'dig' && c.dig;
  return !!b && Math.abs(c.y - b.y - 0.2) < 0.05 && Math.abs(Math.abs(c.x - b.x) - 0.7) < 0.05;
};

// Earth flicked out behind a digger: three clods on their way up and over, never more. (back: which way that is.)
function drawDigging(c, sx, y, px, now, back = c.x > c.dig.x ? 1 : -1) {
  const r = Math.max(1, px * 0.035);
  ctx.fillStyle = 'rgb(122, 90, 54)';
  for (let k = 0; k < 3; k++) {
    const u = (now / 480 + k / 3 + c.id * 0.37) % 1;
    ctx.globalAlpha = 1 - u * u;
    ctx.beginPath();
    ctx.arc(sx + back * px * (0.2 + 0.6 * u), y + px * 0.3 - Math.sin(Math.PI * u) * px * 0.4, r * (1 - 0.3 * u), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// In shallow water an animal sits lower, its legs hidden below a little ring of ripples. Fliers fly over.
const wading = c => !c.hidden && !c.sp.flies && !world.frozen && world.water[(c.y | 0) * S.W + (c.x | 0)] > 0;

function drawCreature(c, sx, sy, now) {
  if (c.species === 'otter') return drawOtter(c, sx, sy, now);
  const px = creaturePx(c);
  if (wading(c)) {
    const line = sy + px * 0.3, rip = 1 + 0.12 * Math.sin(now / 260 + c.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx - px, line - px * 2, px * 2, px * 2); ctx.clip();
    drawEmoji(c.species === 'fox' ? foxArt(c, px) : c.sp.emoji, sx, sy + px * 0.1, px, { coat: coatLook(c), flip: flipOf(c) });
    ctx.restore();
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.7)';
    ctx.lineWidth = Math.max(1, px * 0.05);
    ctx.beginPath(); ctx.ellipse(sx, line, px * 0.36 * rip, px * 0.09 * rip, 0, 0, TAU); ctx.stroke();
    return;
  }
  const hop = liftOf(c, px, now);
  // Standing still, everyone breathes: slow and deep asleep, quick and shallow awake.
  const breathe = !hop && ui.speed > 0
    ? Math.sin(now / (c.sleeping ? 650 : 330) + c.id) * (c.sleeping ? 0.035 : 0.02) : 0;
  const squash = (c.sleeping ? c.species === 'crow' || c.species === 'fox' ? 1 : 0.82 : c.sick ? 0.9 : 1) + breathe;   // a sick one sits hunched (a crow's and a fox's sleeping paintings are curled up already)
  const y = sy - hop + px * 0.4 * (1 - squash);
  if (c.species === 'crow' && c.sleeping && crowSeat(c)) sx += treeSway(seat.tree, now) * hop;   // up a tree, it sways with it
  if (c.mode === 'dance') drawDance(c, sx, y, px);
  drawEmoji(c.species === 'crow' ? crowArt(c, hop, px, now) : c.species === 'fox' ? foxArt(c, px) : c.sp.emoji, sx, y, px, {   // feet stay on the ground
    coat: coatLook(c), flip: flipOf(c), squash,
  });
  if (c.mode === 'gulp' && (c.species === 'fox' || c.species === 'owl' && c.prey !== 'rabbit')) drawCatch(c, sx, y, px);
  if (c.load && c.species === 'bee') drawBaskets(c, sx, y, px);
  if (c.mode === 'sip') drawSipping(c, sx, sy, px, now);
  if (px > 18 && ui.speed > 0 && ui.speed <= 4 && atHole(c)) drawDigging(c, sx, y, px, now);
}

// A forager packs pollen on her hind legs: two gold lumps that grow as she fills up.
const BASKET = { x: 0.04, y: 0.37, dx: 0.08, dy: -0.03 };  // the near hind leg, and the far one from it, in px (facing left)
function drawBaskets(c, sx, y, px) {
  const f = loadOf(c), r = px * (0.04 + 0.05 * f), side = flipOf(c) ? -1 : 1;
  const x1 = sx + side * px * BASKET.x, y1 = y + px * BASKET.y;
  const x2 = x1 + side * px * BASKET.dx, y2 = y1 + px * BASKET.dy;
  ctx.fillStyle = '#ffcc33';
  ctx.strokeStyle = 'rgba(120, 70, 0, 0.55)';
  ctx.lineWidth = Math.max(0.6, px * 0.012);
  ctx.beginPath();
  ctx.moveTo(x2 + r * 0.85, y2); ctx.arc(x2, y2, r * 0.85, 0, TAU);    // the far one, behind
  ctx.moveTo(x1 + r, y1); ctx.arc(x1, y1, r, 0, TAU);
  ctx.fill(); ctx.stroke();
}

// Thought bubbles: a cream bubble, two little puffs trailing down to the animal, and a painted icon for
// what it's up to (BUBBLE_ICONS; a mood without one keeps its emoji). Bubble and icon are one sprite.
const BUBBLE_R = 0.36, BUBBLE_AT = [0.06, -0.08];     // the bubble in its sprite, in sprite sizes from the middle
function paintBubble(g, size, U, i) {
  g.setTransform(U, 0, 0, U, size / 2, size / 2);
  const [x, y] = BUBBLE_AT, r = BUBBLE_R;
  const bubble = (dx, dy) => {
    g.beginPath();
    g.moveTo(x + dx + r, y + dy); g.arc(x + dx, y + dy, r, 0, TAU);
    g.moveTo(x + dx - 0.24, y + dy + 0.33); g.arc(x + dx - 0.3, y + dy + 0.33, 0.06, 0, TAU);
    g.moveTo(x + dx - 0.385, y + dy + 0.47); g.arc(x + dx - 0.42, y + dy + 0.47, 0.035, 0, TAU);
  };
  g.fillStyle = 'rgba(60, 45, 20, 0.16)'; bubble(0.015, 0.025); g.fill();
  g.fillStyle = '#fffaf0'; bubble(0, 0); g.fill();
  g.strokeStyle = 'rgba(90, 70, 40, 0.35)'; g.lineWidth = 0.018; g.stroke();
  g.translate(x, y); g.scale(r * 0.64, r * 0.64);
  g.lineCap = g.lineJoin = 'round';
  BUBBLE_ICONS[i][1](g);
}

// The icons, each in a box from -1 to 1, flat colours with a lighter or darker side.
const fillIn = (g, colour, path) => { g.fillStyle = colour; g.beginPath(); path(); g.fill(); };
const strokeIn = (g, colour, w, path) => { g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); path(); g.stroke(); };
const discAt = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
const ovalAt = (g, x, y, rx, ry, a = 0) => { g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx); g.ellipse(x, y, rx, ry, a, 0, TAU); };
const heartAt = (g, x, y, s) => {
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.6, y - s * 1.15, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.6, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
};
const pawAt = (g, x, y, s) => fillIn(g, '#8a5a3c', () => {
  ovalAt(g, x, y + s * 0.35, s * 0.5, s * 0.42);
  for (const [tx, ty] of [[-0.58, -0.2], [-0.21, -0.58], [0.21, -0.58], [0.58, -0.2]]) ovalAt(g, x + tx * s, y + ty * s, s * 0.19, s * 0.25, tx * 0.6);
});
// A field vole, round and brown and short-tailed, facing left: the mousing bubble's, and the one a fox
// or an owl is after (paintVole, drawRustle).
const voleAt = g => {
  strokeIn(g, '#7a5a42', 0.08, () => { g.moveTo(0.6, 0.45); g.quadraticCurveTo(0.95, 0.5, 0.9, 0.8); });
  fillIn(g, '#8a6a4e', () => { ovalAt(g, 0.08, 0.25, 0.6, 0.42); ovalAt(g, -0.5, 0.12, 0.34, 0.3, -0.3); });
  fillIn(g, '#a8876a', () => ovalAt(g, 0.12, 0.08, 0.36, 0.18));
  fillIn(g, '#9c7b5e', () => discAt(g, -0.38, -0.22, 0.17));
  fillIn(g, '#e3a8a0', () => { discAt(g, -0.38, -0.22, 0.08); discAt(g, -0.84, 0.18, 0.06); });
  fillIn(g, '#2d261e', () => discAt(g, -0.6, 0.04, 0.06));
};
// The vole on its own, for the sprite cache ('vole:0'): its box -1 to 1 is the size asked for, like an emoji.
function paintVole(g, size, U) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  voleAt(g);
}
// A common frog, facing left, olive-brown with darker blotches and the dark patch behind its eye: sitting
// (the frog bubble's, and the ones by the water, drawPond) or leaping with its hind legs out behind.
const FROG_SKIN = '#7f7c46', FROG_DARK = '#5c5a31', FROG_BELLY = '#c2b784', FROG_MASK = '#3f3421';
const frogAt = (g, leap = false) => {
  if (leap) {
    strokeIn(g, FROG_DARK, 0.13, () => { g.moveTo(0.35, 0.2); g.lineTo(0.72, 0.32); g.lineTo(0.95, 0.5); g.moveTo(0.3, 0.26); g.lineTo(0.62, 0.46); g.lineTo(0.9, 0.6); });
    strokeIn(g, FROG_DARK, 0.09, () => { g.moveTo(-0.45, 0.28); g.lineTo(-0.72, 0.5); });
    fillIn(g, FROG_SKIN, () => { ovalAt(g, 0.02, 0.14, 0.5, 0.24, 0.12); ovalAt(g, -0.52, 0.02, 0.26, 0.19, -0.05); });
    fillIn(g, FROG_BELLY, () => ovalAt(g, -0.05, 0.27, 0.36, 0.1, 0.1));
    fillIn(g, FROG_DARK, () => { discAt(g, 0.12, 0.02, 0.07); discAt(g, 0.32, 0.1, 0.06); });
    fillIn(g, FROG_MASK, () => ovalAt(g, -0.4, 0.02, 0.12, 0.06, 0.2));
    fillIn(g, '#c9a54a', () => discAt(g, -0.54, -0.1, 0.075));
    fillIn(g, '#221c12', () => discAt(g, -0.55, -0.1, 0.04));
    return;
  }
  fillIn(g, FROG_DARK, () => { ovalAt(g, 0.36, 0.4, 0.34, 0.25, -0.35); ovalAt(g, 0.1, 0.67, 0.34, 0.07); });   // the hind leg, folded, and its long foot
  fillIn(g, FROG_SKIN, () => { ovalAt(g, 0.08, 0.2, 0.55, 0.34, -0.4); ovalAt(g, -0.44, -0.08, 0.3, 0.22, -0.2); discAt(g, -0.42, -0.26, 0.12); });
  fillIn(g, FROG_BELLY, () => ovalAt(g, -0.1, 0.38, 0.36, 0.13, -0.35));
  fillIn(g, FROG_DARK, () => { discAt(g, 0.12, -0.02, 0.08); discAt(g, 0.36, 0.14, 0.07); discAt(g, 0.28, 0.4, 0.06); });
  fillIn(g, FROG_MASK, () => ovalAt(g, -0.27, -0.16, 0.13, 0.08, 0.6));
  strokeIn(g, FROG_DARK, 0.09, () => { g.moveTo(-0.34, 0.2); g.lineTo(-0.4, 0.64); g.lineTo(-0.52, 0.68); });   // a front leg
  fillIn(g, '#c9a54a', () => discAt(g, -0.43, -0.27, 0.08));
  fillIn(g, '#221c12', () => discAt(g, -0.44, -0.27, 0.045));
};
// Frogspawn: a clump of clear jelly, a black dot in each egg (the frogspawn bubble's, and in the shallows).
const spawnAt = g => {
  const eggs = [[-0.5, 0.1], [-0.2, -0.15], [0.12, -0.2], [0.42, -0.02], [-0.3, 0.32], [0.02, 0.1], [0.3, 0.3], [0.6, 0.28], [-0.62, -0.18], [0.05, 0.42]];
  fillIn(g, 'rgba(214,226,210,0.55)', () => { for (const [x, y] of eggs) discAt(g, x, y, 0.2); });
  fillIn(g, 'rgba(240,246,236,0.7)', () => { for (const [x, y] of eggs) discAt(g, x - 0.05, y - 0.06, 0.07); });
  fillIn(g, '#26241e', () => { for (const [x, y] of eggs) discAt(g, x + 0.02, y + 0.02, 0.055); });
};
// A few tadpoles, black commas wriggling every way (in the shallows).
const tadpolesAt = g => {
  for (const [x, y, a] of [[-0.45, -0.1, 0.4], [0.1, -0.3, 2.5], [0.4, 0.2, -1.2], [-0.15, 0.35, 3.6], [0.55, -0.35, 1.3]]) {
    strokeIn(g, '#2e2b22', 0.06, () => { g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 0.2 - Math.sin(a) * 0.08, y + Math.sin(a) * 0.2 + Math.cos(a) * 0.08, x + Math.cos(a) * 0.34, y + Math.sin(a) * 0.34); });
    fillIn(g, '#26241e', () => ovalAt(g, x, y, 0.09, 0.07, a));
  }
};
// On their own, for the sprite cache: 'frog:0' sitting, 'frog:1' leaping, 'frog:2' spawn, 'frog:3' tadpoles.
function paintFrog(g, size, U, pose) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  if (pose === 2) spawnAt(g); else if (pose === 3) tadpolesAt(g); else frogAt(g, pose === 1);
}
// A crow, facing left, blue-black with a sheen (sim.js crowTick): standing, pecking, flying with its wings up
// and down, those two again with an acorn in its beak, the two steps of a walk, and asleep on a branch ('crow:0'
// to 'crow:8'). Its box -1 to 1 is the size asked for, feet on the ground at 0.72 like an animal's.
const CROW_INK = '#2a2c35', CROW_DARK = '#1b1c23', CROW_SHEEN = '#56617e', CROW_BEAK = '#3a3a42';
// On its feet: each leg's hip, knee (null: straight) and foot, the near one first, and how far the head is
// moved, for standing (and pecking) and the two steps of a walk: legs apart with the head forward, then one
// leg lifted past the other with the head back.
const CROW_FEET = {
  0: [[-0.02, 0.32, null, -0.07, 0.71], [0.16, 0.3, null, 0.16, 0.71], 0, 0],
  6: [[-0.02, 0.32, null, -0.22, 0.71], [0.16, 0.3, null, 0.32, 0.71], -0.07, 0.05],
  7: [[0.05, 0.31, null, 0.04, 0.71], [0.14, 0.3, [0.2, 0.48], -0.06, 0.58], 0.02, -0.02],
};
function paintCrow(g, size, U, pose) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  if (pose === 8) {                                  // asleep on a branch: fluffed round, head sunk in, tail hanging, toes round the twig
    strokeIn(g, CROW_DARK, 0.045, () => { g.moveTo(-0.14, 0.66); g.lineTo(0.06, 0.66); g.moveTo(0.1, 0.66); g.lineTo(0.28, 0.66); });
    fillIn(g, CROW_INK, () => { g.moveTo(0.36, 0.3); g.lineTo(0.64, 0.8); g.lineTo(0.5, 0.86); g.lineTo(0.24, 0.42); });
    fillIn(g, CROW_INK, () => { ovalAt(g, 0.06, 0.24, 0.44, 0.4, 0.2); discAt(g, -0.26, -0.1, 0.24); });
    fillIn(g, CROW_DARK, () => ovalAt(g, 0.17, 0.26, 0.31, 0.23, 0.35));   // the wing
    strokeIn(g, CROW_SHEEN, 0.05, () => { g.moveTo(-0.06, 0.02); g.quadraticCurveTo(0.2, -0.02, 0.38, 0.18); });
    fillIn(g, CROW_BEAK, () => { g.moveTo(-0.44, -0.14); g.quadraticCurveTo(-0.6, -0.08, -0.67, 0.02); g.lineTo(-0.42, -0.02); });   // tucked down
    strokeIn(g, '#7a84a0', 0.03, () => { g.moveTo(-0.4, -0.2); g.quadraticCurveTo(-0.34, -0.15, -0.28, -0.19); });   // its eye shut
    return;
  }
  const fly = pose >= 2 && pose <= 5, down = pose === 3 || pose === 5;
  if (!fly) {
    const peck = pose === 1, [nearLeg, farLeg, hdx, hdy] = CROW_FEET[peck ? 0 : pose];
    strokeIn(g, CROW_DARK, 0.06, () => { for (const [x0, y0, knee, x1, y1] of [farLeg, nearLeg]) { g.moveTo(x0, y0); if (knee) g.lineTo(knee[0], knee[1]); g.lineTo(x1, y1); } });
    strokeIn(g, CROW_DARK, 0.045, () => { for (const [, , knee, x, y] of [farLeg, nearLeg]) { g.moveTo(x - (knee ? 0.08 : 0.15), y + (knee ? 0.02 : 0.01)); g.lineTo(x + (knee ? 0.04 : 0.1), y + (knee ? 0.02 : 0.01)); } });
    fillIn(g, CROW_INK, () => peck   // the tail, up when it pecks
      ? (g.moveTo(0.44, 0.06), g.lineTo(0.9, -0.2), g.lineTo(0.92, -0.06), g.lineTo(0.48, 0.2))
      : (g.moveTo(0.4, 0.14), g.lineTo(0.86, 0.46 - hdy), g.lineTo(0.78, 0.56 - hdy), g.lineTo(0.34, 0.3)));
    fillIn(g, CROW_INK, () => ovalAt(g, 0.1, peck ? 0.12 : 0.04, 0.46, peck ? 0.27 : 0.3, peck ? -0.25 : 0.5 - hdy));
    const [hx, hy] = peck ? [-0.38, 0.3] : [-0.33 + hdx, -0.36 + hdy];
    fillIn(g, CROW_INK, () => { ovalAt(g, (hx + 0.1) / 2, (hy + 0.05) / 2, 0.2, 0.22, 0.4); discAt(g, hx, hy, 0.2); });
    fillIn(g, CROW_DARK, () => ovalAt(g, 0.18, peck ? 0.06 : 0.0, 0.32, 0.17, peck ? -0.25 : 0.5 - hdy));   // the wing
    strokeIn(g, CROW_SHEEN, 0.05, () => peck
      ? (g.moveTo(-0.1, -0.05), g.quadraticCurveTo(0.2, -0.12, 0.44, -0.02))
      : (g.moveTo(-0.08 + hdx / 2, -0.18 + hdy / 2), g.quadraticCurveTo(0.2, -0.1, 0.4, 0.12)));
    fillIn(g, CROW_BEAK, () => peck
      ? (g.moveTo(-0.5, 0.26), g.quadraticCurveTo(-0.6, 0.45, -0.64, 0.68), g.lineTo(-0.4, 0.44))
      : (g.moveTo(hx - 0.17, hy - 0.09), g.quadraticCurveTo(hx - 0.39, hy - 0.08, hx - 0.54, hy + 0.03), g.lineTo(hx - 0.19, hy + 0.09)));
    fillIn(g, '#0e0e12', () => discAt(g, hx - 0.07, hy - 0.05, 0.045));
    fillIn(g, '#e8e8f0', () => discAt(g, hx - 0.08, hy - 0.065, 0.016));
    return;
  }
  const wing = (x0, x1, tipX, tipY, colour) => fillIn(g, colour, () => {   // broad, swept back, fingered at the tip
    g.moveTo(x0, 0); g.quadraticCurveTo(x0 - 0.08, tipY * 0.7, tipX, tipY);
    for (let k = 1; k <= 4; k++) { g.lineTo(tipX + 0.07 * k - 0.02, tipY * (0.98 - 0.07 * k) + 0.02 * Math.sign(tipY)); g.lineTo(tipX + 0.07 * k, tipY * (1 - 0.07 * k)); }
    g.quadraticCurveTo(x1 + 0.04, tipY * 0.35, x1, 0); g.closePath();
  });
  wing(0.06, 0.4, 0.2, down ? 0.62 : -0.84, CROW_DARK);                            // the far wing
  fillIn(g, CROW_INK, () => { g.moveTo(0.38, -0.05); g.lineTo(0.84, -0.16); g.lineTo(0.88, 0.1); g.lineTo(0.38, 0.1); });
  fillIn(g, CROW_INK, () => { ovalAt(g, 0.02, 0.02, 0.44, 0.17); discAt(g, -0.45, -0.06, 0.16); });
  fillIn(g, CROW_BEAK, () => { g.moveTo(-0.57, -0.11); g.quadraticCurveTo(-0.74, -0.1, -0.86, -0.02); g.lineTo(-0.58, 0.02); });
  fillIn(g, '#0e0e12', () => discAt(g, -0.5, -0.1, 0.035));
  wing(-0.2, 0.26, -0.06, down ? 0.8 : -0.9, CROW_INK);                            // the near wing
  strokeIn(g, CROW_SHEEN, 0.045, () => { g.moveTo(-0.1, down ? 0.06 : -0.04); g.quadraticCurveTo(-0.14, down ? 0.4 : -0.45, -0.02, down ? 0.7 : -0.78); });
  if (pose >= 4) {                                                                  // an acorn in its beak
    fillIn(g, '#b8843e', () => ovalAt(g, -0.88, 0.06, 0.07, 0.09));
    fillIn(g, '#6e5230', () => ovalAt(g, -0.88, -0.02, 0.08, 0.045));
  }
}
const CROW_ARTS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => 'crow:' + k);

// Otters are painted, not the 🦦 emoji: it floats on its back, and differs from system to system.
// A Eurasian otter, facing left: warm brown, a pale chin and throat, a broad flat head with small low ears,
// a long low body, short legs and a thick tail. Box -1 to 1, feet on the ground at 0.72.
// It's painted as one animal: every part of the fur is filled with the one shading (fur), on a layer of its own,
// and the pale throat, the light on the back and the shade underneath are soft glows laid only on that fur.
const OTTER = [124, 82, 50], OTTER_WET = [96, 66, 44], OTTER_PALE = [230, 210, 176];
const OTTER_NOSE = '#2a1e18', OTTER_EYE = '#120d0a', OTTER_LIGHT = [255, 238, 214], OTTER_SHADE = [44, 26, 14];

// The fur's shading, lit from above, from the top of the animal (y0) to its underside (y1).
function furShade(g, rgb, y0, y1) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, rockRGB(tone(rgb, 1.22, 12)));
  gr.addColorStop(0.45, rockRGB(rgb));
  gr.addColorStop(1, rockRGB(tone(rgb, 0.62)));
  return gr;
}
// A part of it: its shape (made under tf, if any), filled or stroked with the fur's shading in the pose's own space,
// so the parts run into each other with no seam.
function furPart(g, style, path, tf, w) {
  g.save(); if (tf) tf(g); g.beginPath(); path(g); g.restore();
  if (w) { g.strokeStyle = style; g.lineWidth = w; g.stroke(); } else { g.fillStyle = style; g.fill(); }
}
// A soft glow or shade: an oval of colour fading out to nothing past hard (a share of its size).
function furGlow(g, rgb, a, x, y, rx, ry, rot = 0, hard = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, rockRGB(rgb, a)); gr.addColorStop(hard, rockRGB(rgb, a)); gr.addColorStop(1, rockRGB(rgb, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
}

const OTTER_EDGE = 0.5;                  // how soft the markings' edges are (round 4 was 1)
// A soft-edged shape that follows the body: filled far off to the side, so only its blurred shadow falls here.
function blurIn(g, rgb, a, blur, path, tf) {
  const m = g.getTransform(), off = g.canvas.width * 2;
  g.save();
  g.setTransform(m.a, m.b, m.c, m.d, m.e - off, m.f);
  if (tf) tf(g);
  g.shadowColor = rockRGB(rgb, a); g.shadowBlur = blur * OTTER_EDGE * Math.hypot(m.a, m.b); g.shadowOffsetX = off;
  g.fillStyle = '#000'; g.beginPath(); path(g); g.fill();
  g.restore();
}

// The head, in its own space: nose to the left at -0.35, the back of the skull at 0.28. h places it.
const headAt = h => g => { g.translate(h.x, h.y); g.rotate(h.a || 0); g.scale(h.flip ? -h.s : h.s, h.s); };
function headShape(g) {
  headOutline(g);
  ovalAt(g, 0.14, -0.155, 0.065, 0.06);                        // the ear, small and low
}
function headOutline(g) {
  g.moveTo(0.26, 0.1);
  g.bezierCurveTo(0.1, 0.16, -0.14, 0.15, -0.24, 0.09);       // under the chin
  g.bezierCurveTo(-0.31, 0.06, -0.36, 0.02, -0.36, -0.02);     // the lip, up to the nose
  g.bezierCurveTo(-0.36, -0.07, -0.31, -0.1, -0.24, -0.11);    // over the nose
  g.bezierCurveTo(-0.15, -0.13, -0.08, -0.19, 0.04, -0.19);    // the brow
  g.bezierCurveTo(0.17, -0.19, 0.28, -0.12, 0.3, -0.02);       // the flat crown, down the back of the head
  g.bezierCurveTo(0.31, 0.04, 0.29, 0.08, 0.26, 0.1);
  g.closePath();
}
function headGlow(g, h, wet) {                                  // on the fur: the pale lip and chin, the crown's light
  g.save(); headAt(h)(g);
  furGlow(g, OTTER_SHADE, 0.55, 0.145, -0.15, 0.03, 0.026);              // in the ear
  g.beginPath(); headOutline(g); g.clip();                      // the rest only on the head
  blurIn(g, OTTER_PALE, wet ? 0.85 : 0.95, 0.05, g => {        // the pale lip and chin, below the line of the mouth (the throat's is the pose's)
    g.moveTo(-0.5, -0.02); g.lineTo(-0.33, -0.005); g.quadraticCurveTo(-0.2, 0.0, -0.06, 0.035);
    g.lineTo(-0.02, 0.4); g.lineTo(-0.5, 0.4); g.closePath();
  });
  furGlow(g, OTTER_LIGHT, wet ? 0.45 : 0.32, -0.02, -0.13, 0.18, 0.045, -0.08);
  g.restore();
}
function headFace(g, h, o = {}) {                               // the nose, the eye, the mouth and whiskers
  g.save(); headAt(h)(g);
  fillIn(g, OTTER_NOSE, () => { g.moveTo(-0.37, -0.05); g.quadraticCurveTo(-0.37, -0.09, -0.31, -0.085); g.quadraticCurveTo(-0.26, -0.08, -0.28, -0.035); g.quadraticCurveTo(-0.31, -0.005, -0.35, -0.015); g.closePath(); });
  fillIn(g, 'rgba(255,255,255,0.35)', () => ovalAt(g, -0.33, -0.07, 0.018, 0.01, -0.2));
  strokeIn(g, 'rgba(60,36,24,0.45)', 0.012, () => { g.moveTo(-0.33, 0.01); g.quadraticCurveTo(-0.28, 0.05, -0.2, 0.05); });
  if (o.shut) strokeIn(g, OTTER_EYE, 0.024, () => { g.moveTo(-0.16, -0.075); g.quadraticCurveTo(-0.11, -0.05, -0.06, -0.075); });
  else {
    fillIn(g, OTTER_EYE, () => ovalAt(g, -0.11, -0.085, 0.038, 0.036));
    fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, -0.122, -0.099, 0.012));
  }
  strokeIn(g, 'rgba(250,244,228,0.7)', 0.01, () => {
    for (const [dx, dy] of [[-0.17, -0.065], [-0.19, -0.015], [-0.16, 0.04]]) { g.moveTo(-0.25, 0.0); g.quadraticCurveTo(-0.25 + dx * 0.6, dy * 0.35, -0.25 + dx, dy); }
  });
  g.restore();
}

// The fur is painted on this, then laid on the sprite. One canvas, grown when a bigger otter needs it.
let furCanvas = null;
function furLayer(g, size, U) {
  if (!furCanvas) furCanvas = document.createElement('canvas');
  if (furCanvas.width < size || furCanvas.height < size) furCanvas.width = furCanvas.height = size;   // (a new one is 300 by 150)
  const L = furCanvas.getContext('2d');
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, size, size);
  L.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  L.lineCap = L.lineJoin = 'round';
  return L;
}
function layDown(g, L) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.canvas, 0, 0); g.restore(); }
const atop = (L, glows) => { L.globalCompositeOperation = 'source-atop'; glows(); L.globalCompositeOperation = 'source-over'; };

// A leg: from the hip down to the foot, and the foot, broad and a little forward.
const legShape = (x0, y0, x1, y1) => g => { g.moveTo(x0, y0); g.lineTo(x1, y1); };
const pawShape = (x, y, r = 0.075) => g => ovalAt(g, x - r * 0.35, y, r, r * 0.48);
const toesAt = (g, x, y, r) => strokeIn(g, 'rgba(40,24,14,0.55)', r * 0.16, () => {   // the toes, at the front of the foot
  for (const k of [-0.75, -0.25]) { g.moveTo(x + k * r - r * 0.35, y - r * 0.12); g.lineTo(x + k * r - r * 0.42, y + r * 0.32); }
});
// A near leg on top of the fur: a soft shade on the body behind it, then the leg in its own light, its foot and toes.
function nearLeg(L, F, x0, y0, x1, y1, w = 0.15, r = 0.085) {
  atop(L, () => furGlow(L, OTTER_SHADE, 0.35, (x0 + x1) / 2 + w * 0.55, (y0 + y1) / 2, w * 0.6, (y1 - y0) * 0.75));
  furPart(L, F, legShape(x0, y0 + 0.02, x1, y1), null, w);
  furPart(L, F, pawShape(x1, y1 + 0.02, r));
  atop(L, () => { furGlow(L, OTTER_LIGHT, 0.22, x0 - w * 0.2, (y0 + y1) / 2, w * 0.25, (y1 - y0) * 0.5); furGlow(L, OTTER_SHADE, 0.4, x1 - 0.02, y1 + 0.035, r * 1.1, r * 0.55); });
  toesAt(L, x1, y1 + 0.02, r);
}

// A tail: its middle runs from the root p0 by p1 and p2 to the tip p3, r thick at the root and tapering all the way
// to a rounded tip, so it grows out of the body instead of being stuck on.
function tailShape(p0, p1, p2, p3, r, tip = 0.016) {
  return g => {
    const N = 32, a = [], b = [];
    let end = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
      const x = k0 * p0[0] + k1 * p1[0] + k2 * p2[0] + k3 * p3[0], y = k0 * p0[1] + k1 * p1[1] + k2 * p2[1] + k3 * p3[1];
      const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
      const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
      const l = Math.hypot(dx, dy) || 1, w = tip + (r - tip) * Math.pow(u, 0.8);
      a.push([x - dy / l * w, y + dx / l * w]); b.push([x + dy / l * w, y - dx / l * w]);
      end = Math.atan2(dy, dx);
    }
    g.moveTo(a[0][0], a[0][1]); for (const [x, y] of a) g.lineTo(x, y);
    g.arc(p3[0], p3[1], tip, end + Math.PI / 2, end - Math.PI / 2, true);
    for (let i = N; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
    g.closePath();
  };
}

// In the water. Below the surface (y) the fur takes the water's colour and fades out as it goes down, so the animal
// swims in the water rather than lying on it. On the fur layer, after everything else is painted on it.
const OTTER_SURFACE = 0.62, OTTER_WATER = [56, 108, 140];
function inWater(L, y = OTTER_SURFACE, deep = 0.22) {
  const ramp = (c, a0, a1) => {
    const gr = L.createLinearGradient(0, y - 0.004, 0, y + deep);
    gr.addColorStop(0, rockRGB(c, 0)); gr.addColorStop(0.04, rockRGB(c, a0)); gr.addColorStop(1, rockRGB(c, a1));
    return gr;
  };
  L.save();
  L.globalCompositeOperation = 'source-atop'; L.fillStyle = ramp(OTTER_WATER, 0.45, 0.7); L.fillRect(-2, y - 0.004, 4, 3);
  L.globalCompositeOperation = 'destination-out'; L.fillStyle = ramp([0, 0, 0], 0.55, 1); L.fillRect(-2, y - 0.004, 4, 3);
  L.restore();
}
// The ring of water round it where it comes up through the surface: the far side (back) before the animal, so the
// body hides it, the near side after, in a few broken pieces, and a fainter ripple a little further out.
function waterRing(g, x, y, rx, ry, back) {
  const arc = (a, w, a0, a1, k = 1, dy = 0) => strokeIn(g, `rgba(240,250,255,${a})`, w, () => g.ellipse(x, y + dy, rx * k, ry * k, 0, a0, a1));
  if (back) { arc(0.4, 0.024, Math.PI * 1.05, Math.PI * 1.95); return; }
  arc(0.85, 0.034, 0.2, 1.38); arc(0.75, 0.03, 1.6, 2.94);
  arc(0.28, 0.02, 1.95, 2.6, 1.22, ry * 0.6);
}

const OTTER_WARM = [112, 68, 34];   // shade on the pale fur: a warm brown, never grey

// On its feet, the long back humped as it lopes. step: 0 standing, 1 and 2 the two steps of the lope.
function otterLoping(g, L, step) {
  const hump = step === 1 ? 0.06 : step === 2 ? -0.03 : 0, dx = 0.05;
  const legs = [
    [[-0.3, 0.5, -0.34, 0.68], [0.36, 0.5, 0.4, 0.68], [-0.4, 0.5, -0.44, 0.68], [0.5, 0.5, 0.52, 0.68]],
    [[-0.28, 0.5, -0.5, 0.67], [0.36, 0.48, 0.2, 0.68], [-0.38, 0.5, -0.3, 0.68], [0.5, 0.48, 0.64, 0.67]],   // gathered under, back up
    [[-0.3, 0.5, -0.16, 0.68], [0.36, 0.5, 0.6, 0.67], [-0.4, 0.5, -0.6, 0.66], [0.5, 0.5, 0.38, 0.68]],      // stretched out
  ][step].map(([a, b, c, d]) => [a + dx, b, c + dx, d]);
  const h = { x: -0.62 + dx, y: 0.2 - hump * 0.3, a: 0.06, s: 1.3 };
  g.save(); g.lineCap = 'round';
  const far = furShade(g, tone(OTTER, 0.7), 0.3, 0.74);
  for (const [x0, y0, x1, y1] of legs.slice(0, 2)) { furPart(g, far, legShape(x0, y0, x1, y1), null, 0.13); furPart(g, far, pawShape(x1, y1 + 0.02)); }
  g.restore();
  const F = furShade(L, OTTER, -0.02 - hump, 0.72);
  furPart(L, F, tailShape([0.46 + dx, 0.36 - hump * 0.6], [0.72 + dx, 0.38 - hump * 0.3], [0.9 + dx, 0.62], [1.1 + dx, 0.6], 0.17));   // thick at the root, drooping, the tip lifted
  furPart(L, F, g => {
    g.moveTo(-0.5 + dx, 0.16);                                   // the neck
    g.bezierCurveTo(-0.3 + dx, 0.02 - hump, 0.25 + dx, -0.02 - hump * 1.4, 0.5 + dx, 0.18 - hump);   // over the back
    g.bezierCurveTo(0.68 + dx, 0.28, 0.7 + dx, 0.52, 0.54 + dx, 0.6);   // the rump
    g.bezierCurveTo(0.2 + dx, 0.68, -0.2 + dx, 0.66, -0.44 + dx, 0.6);  // the belly
    g.bezierCurveTo(-0.66 + dx, 0.54, -0.72 + dx, 0.32, -0.5 + dx, 0.16);   // the chest and throat
  });
  furPart(L, F, headShape, headAt(h));
  furPart(L, F, g => ovalAt(g, 0.44 + dx, 0.44, 0.18, 0.16, 0.3));    // the near haunch
  atop(L, () => {
    blurIn(L, OTTER_PALE, 0.95, 0.04, g => {                                  // the pale throat, down to the chest
      g.moveTo(-0.95 + dx, 0.3); g.lineTo(-0.56 + dx, 0.27 - hump * 0.3); g.quadraticCurveTo(-0.44 + dx, 0.36, -0.44 + dx, 0.5);
      g.quadraticCurveTo(-0.46 + dx, 0.6, -0.54 + dx, 0.66); g.lineTo(-0.9 + dx, 0.7); g.closePath();
    });
    blurIn(L, OTTER_LIGHT, 0.34, 0.07, g => {                                       // light along the back, thin at the neck, on down the tail
      g.moveTo(-0.46 + dx, 0.1); g.bezierCurveTo(-0.24 + dx, -0.08 - hump, 0.28 + dx, -0.14 - hump * 1.4, 0.6 + dx, 0.12 - hump);
      g.bezierCurveTo(0.8 + dx, 0.26, 0.96 + dx, 0.5, 1.14 + dx, 0.54); g.lineTo(1.08 + dx, 0.58);
      g.bezierCurveTo(0.92 + dx, 0.54, 0.76 + dx, 0.42, 0.58 + dx, 0.26 - hump);
      g.bezierCurveTo(0.26 + dx, 0.07 - hump * 1.4, -0.24 + dx, 0.09 - hump, -0.44 + dx, 0.16); g.closePath();
    });
    furGlow(L, OTTER_LIGHT, 0.16, 0.42 + dx, 0.34, 0.16, 0.08, 0.3);                    // and on the haunch
    blurIn(L, OTTER_SHADE, 0.38, 0.07, g => {                                       // shade along the belly and under the tail
      g.moveTo(-0.46 + dx, 0.54); g.bezierCurveTo(-0.2 + dx, 0.6, 0.2 + dx, 0.62, 0.56 + dx, 0.52);
      g.bezierCurveTo(0.76 + dx, 0.5, 0.92 + dx, 0.6, 1.1 + dx, 0.62); g.lineTo(1.1 + dx, 0.8); g.lineTo(-0.5 + dx, 0.8); g.closePath();
    });
    furGlow(L, OTTER_SHADE, 0.22, 0.32 + dx, 0.48, 0.1, 0.14, 0.4);                    // where the haunch meets the body
    headGlow(L, h);
  });
  for (const [x0, y0, x1, y1] of legs.slice(2)) nearLeg(L, F, x0, y0, x1, y1);
  headFace(L, h);
  layDown(g, L);
}

// Up on its haunches, looking about: the body upright, front paws held at the chest, the tail on the ground behind.
function otterSitting(g, L) {
  const h = { x: -0.22, y: -0.4, a: -0.04, s: 1.3 };
  const far = furShade(g, tone(OTTER, 0.6), 0.3, 0.74);
  furPart(g, far, pawShape(0.08, 0.7, 0.08));
  const F = furShade(L, OTTER, -0.62, 0.74);
  furPart(L, F, tailShape([0.14, 0.6], [0.4, 0.66], [0.64, 0.72], [0.94, 0.67], 0.12));   // the tail, along the ground behind
  furPart(L, F, g => {
    g.moveTo(0.02, -0.4);                                        // the back of the neck
    g.bezierCurveTo(0.2, -0.26, 0.28, 0.0, 0.32, 0.3);           // the back
    g.bezierCurveTo(0.38, 0.58, 0.28, 0.73, 0.0, 0.73);          // the haunch
    g.bezierCurveTo(-0.26, 0.73, -0.3, 0.5, -0.28, 0.24);        // the belly
    g.bezierCurveTo(-0.28, 0.0, -0.38, -0.2, -0.34, -0.36);      // the chest and throat
  });
  furPart(L, F, headShape, headAt(h));
  furPart(L, F, g => ovalAt(g, 0.12, 0.56, 0.2, 0.17, -0.4));         // the near haunch
  atop(L, () => {
    blurIn(L, OTTER_PALE, 0.95, 0.035, g => {                                 // the pale throat and chest, narrowing down the belly
      g.moveTo(-0.7, -0.42); g.lineTo(-0.3, -0.36);
      g.bezierCurveTo(-0.06, -0.33, -0.04, -0.16, -0.1, 0.02);
      g.bezierCurveTo(-0.14, 0.16, -0.2, 0.3, -0.29, 0.42); g.lineTo(-0.7, 0.42); g.closePath();
    });
    blurIn(L, OTTER_LIGHT, 0.36, 0.07, g => {                                       // light down the back
      g.moveTo(0.1, -0.5); g.bezierCurveTo(0.3, -0.3, 0.42, 0.0, 0.44, 0.3); g.lineTo(0.28, 0.3); g.bezierCurveTo(0.24, 0.0, 0.14, -0.22, -0.02, -0.34); g.closePath();
    });
    blurIn(L, OTTER_LIGHT, 0.12, 0.08, g => {                                       // and round the top of the haunch
      g.moveTo(-0.1, 0.46); g.bezierCurveTo(-0.02, 0.36, 0.2, 0.34, 0.3, 0.42); g.lineTo(0.26, 0.48); g.bezierCurveTo(0.16, 0.42, 0.0, 0.44, -0.06, 0.5); g.closePath();
    });
    blurIn(L, OTTER_WARM, 0.3, 0.05, g => {                                   // the crease in front of the haunch
      g.moveTo(-0.12, 0.42); g.bezierCurveTo(-0.14, 0.52, -0.12, 0.62, -0.06, 0.7); g.lineTo(-0.02, 0.68); g.bezierCurveTo(-0.07, 0.6, -0.08, 0.52, -0.06, 0.44); g.closePath();
    });
    furGlow(L, OTTER_SHADE, 0.3, 0.0, 0.72, 0.36, 0.07);
    headGlow(L, h);
  });
  furPart(L, F, pawShape(-0.06, 0.7, 0.095));                         // its hind foot
  atop(L, () => furGlow(L, OTTER_SHADE, 0.4, -0.08, 0.725, 0.1, 0.045));
  toesAt(L, -0.06, 0.7, 0.095);
  // its forepaws held up against its chest, the far one behind and a shade darker
  const arm = furShade(L, OTTER, -0.1, 0.34), farArm = furShade(L, tone(OTTER, 0.78), -0.1, 0.34);
  furPart(L, farArm, g => { g.moveTo(-0.14, 0.0); g.quadraticCurveTo(-0.24, 0.02, -0.28, 0.12); }, null, 0.085);
  furPart(L, farArm, g => ovalAt(g, -0.28, 0.16, 0.05, 0.044, 0.3));
  atop(L, () => furGlow(L, OTTER_WARM, 0.3, -0.26, 0.26, 0.08, 0.05));      // the near paw's shadow on the chest, warm
  furPart(L, arm, g => { g.moveTo(-0.18, 0.04); g.quadraticCurveTo(-0.34, 0.06, -0.37, 0.18); }, null, 0.1);
  furPart(L, arm, g => ovalAt(g, -0.37, 0.215, 0.058, 0.05, 0.3));
  atop(L, () => { furGlow(L, OTTER_LIGHT, 0.3, -0.27, 0.05, 0.06, 0.025, -0.3); furGlow(L, OTTER_SHADE, 0.3, -0.36, 0.245, 0.045, 0.025); });
  strokeIn(L, 'rgba(40,24,14,0.45)', 0.011, () => { for (const k of [-0.022, 0.012]) { L.moveTo(-0.37 + k, 0.225); L.lineTo(-0.37 + k * 1.2, 0.25); } });
  headFace(L, h);
  layDown(g, L);
}

// Swimming low: the head and a line of back out of the water, the rest of it under, dim. fish: one in its jaws.
function otterSwimming(g, L, fish) {
  const h = { x: -0.46, y: 0.38, a: fish ? -0.16 : 0, s: 1.5 };
  const F = furShade(L, OTTER_WET, 0.2, 0.9);
  furPart(L, F, tailShape([0.36, 0.74], [0.66, 0.76], [0.9, 0.72], [1.1, 0.67], 0.14));   // trailing behind, just under the surface
  furPart(L, F, g => {
    g.moveTo(-0.54, 0.5); g.bezierCurveTo(-0.3, 0.44, 0.2, 0.5, 0.5, 0.6);   // the back, just out of the water
    g.bezierCurveTo(0.66, 0.66, 0.66, 0.84, 0.46, 0.86);                       // the hips, under it
    g.bezierCurveTo(0.1, 0.9, -0.36, 0.9, -0.5, 0.82);                         // the belly
    g.bezierCurveTo(-0.62, 0.74, -0.64, 0.56, -0.54, 0.5); g.closePath();
  });
  furPart(L, F, g => { g.moveTo(-0.5, 0.74); g.quadraticCurveTo(-0.66, 0.8, -0.72, 0.9); }, null, 0.09);   // a forepaw paddling
  furPart(L, F, headShape, headAt(h));
  atop(L, () => {
    furGlow(L, OTTER_LIGHT, 0.5, -0.04, 0.5, 0.36, 0.03, 0.1, 0.3);       // wet fur shines along the back
    headGlow(L, h, true);
  });
  headFace(L, h);
  inWater(L);
  waterRing(g, -0.2, OTTER_SURFACE, 0.68, 0.055, true);
  layDown(g, L);
  if (fish) {                                                    // a fish in its jaws, the half in the water dimmed
    g.save(); g.beginPath(); g.rect(-2, -2, 4, 2.63); g.clip(); troutAt(g, -0.86, 0.44, 0.56, 0.95); g.restore();
    g.save(); g.globalAlpha = 0.35; g.beginPath(); g.rect(-2, 0.63, 4, 2); g.clip(); troutAt(g, -0.86, 0.44, 0.56, 0.95); g.restore();
  }
  waterRing(g, -0.2, OTTER_SURFACE, 0.68, 0.055);
}

// Diving: the head and shoulders gone under, the back rolling over after them and the tail curling up last.
function otterDiving(g, L) {
  const F = furShade(L, OTTER_WET, 0.2, 0.9);
  furPart(L, F, g => {
    g.moveTo(-0.86, 0.94); g.bezierCurveTo(-0.74, 0.54, -0.42, 0.28, -0.14, 0.28);   // up from under the water, over the back
    g.bezierCurveTo(0.12, 0.28, 0.3, 0.48, 0.32, 0.7);
    g.bezierCurveTo(0.2, 0.82, -0.2, 0.86, -0.52, 1.0); g.closePath();
  });
  furPart(L, F, tailShape([0.14, 0.66], [0.26, 0.42], [0.38, 0.2], [0.6, 0.22], 0.12));   // the tail, its tip curling over
  atop(L, () => {
    blurIn(L, OTTER_LIGHT, 0.32, 0.06, g => { g.moveTo(-0.64, 0.56); g.bezierCurveTo(-0.5, 0.2, 0.1, 0.16, 0.22, 0.42); g.bezierCurveTo(0.0, 0.36, -0.4, 0.38, -0.54, 0.6); g.closePath(); });   // wet fur shines
    furGlow(L, OTTER_LIGHT, 0.3, 0.42, 0.28, 0.03, 0.1, 0.9);
  });
  inWater(L);
  waterRing(g, -0.2, OTTER_SURFACE, 0.56, 0.055, true);
  layDown(g, L);
  waterRing(g, -0.2, OTTER_SURFACE, 0.56, 0.055);
}

// A webbed hind foot held up, its sole to us: broad across the toes. Its heel at the origin, toes up.
function webbedFoot(g) {
  g.moveTo(-0.045, 0.0);
  g.bezierCurveTo(-0.08, -0.03, -0.11, -0.08, -0.105, -0.125);
  g.quadraticCurveTo(-0.098, -0.168, -0.055, -0.16); g.quadraticCurveTo(-0.03, -0.184, 0.0, -0.17);
  g.quadraticCurveTo(0.03, -0.184, 0.055, -0.16); g.quadraticCurveTo(0.098, -0.168, 0.105, -0.125);
  g.bezierCurveTo(0.11, -0.08, 0.08, -0.03, 0.045, 0.0); g.closePath();
}
const footAt = (x, y, a) => g => { g.translate(x, y); g.rotate(a); };
function soleOf(L, x, y, a) {                                    // the sole's pad and the lines of the toes
  L.save(); footAt(x, y, a)(L);
  furGlow(L, OTTER_SHADE, 0.45, 0, -0.06, 0.06, 0.05);
  strokeIn(L, 'rgba(40,24,14,0.3)', 0.01, () => { for (const k of [-0.055, 0, 0.055]) { L.moveTo(k * 0.8, -0.13); L.lineTo(k, -0.162); } });
  L.restore();
}
// A forepaw: a round little hand, two toe lines.
function handAt(L, style, x, y, a) {
  furPart(L, style, g => ovalAt(g, x, y, 0.06, 0.048, a));
  strokeIn(L, 'rgba(40,24,14,0.45)', 0.011, () => { for (const k of [-0.018, 0.018]) { L.moveTo(x + k, y - 0.03); L.lineTo(x + k * 1.2, y - 0.045); } });
}

// Floating on its back with a fish on its chest: its shoulders and head held up at the left end, looking down
// itself at the fish; the webbed hind feet up at the other end, the tail out behind; its back under the water.
function otterFloating(g, L) {
  const h = { x: -0.5, y: 0.25, a: 0.32, s: 1.12, flip: true };
  const F = furShade(L, OTTER_WET, 0.04, 0.86);
  furPart(L, F, tailShape([0.44, 0.66], [0.66, 0.68], [0.84, 0.64], [1.04, 0.58], 0.11));   // out behind, the tip on the surface
  furPart(L, F, g => {
    g.moveTo(-0.82, 0.86);
    g.bezierCurveTo(-0.88, 0.62, -0.82, 0.4, -0.66, 0.3);         // up the back of the neck
    g.lineTo(-0.36, 0.34);
    g.bezierCurveTo(-0.1, 0.35, 0.18, 0.37, 0.38, 0.42);          // the chest and belly, up
    g.bezierCurveTo(0.56, 0.48, 0.64, 0.6, 0.6, 0.76);            // the hips
    g.bezierCurveTo(0.3, 0.86, -0.4, 0.9, -0.82, 0.86); g.closePath();   // the back, under the water
  });
  furPart(L, F, legShape(0.36, 0.52, 0.4, 0.4), null, 0.12);        // the hind legs, up
  furPart(L, F, legShape(0.5, 0.54, 0.57, 0.42), null, 0.12);
  furPart(L, F, webbedFoot, footAt(0.4, 0.42, -0.3));
  furPart(L, F, webbedFoot, footAt(0.58, 0.44, 0.35));
  atop(L, () => {
    blurIn(L, OTTER_PALE, 0.95, 0.04, g => {                     // the pale chest and belly, up
      g.moveTo(-0.7, 0.2); g.lineTo(0.1, 0.22); g.bezierCurveTo(0.3, 0.26, 0.4, 0.42, 0.3, 0.48); g.bezierCurveTo(0.1, 0.47, -0.2, 0.46, -0.5, 0.5); g.closePath();
    });
    blurIn(L, OTTER_LIGHT, 0.36, 0.06, g => { g.moveTo(-0.92, 0.62); g.bezierCurveTo(-0.94, 0.42, -0.86, 0.26, -0.66, 0.2); g.lineTo(-0.64, 0.3); g.bezierCurveTo(-0.78, 0.36, -0.82, 0.48, -0.8, 0.62); g.closePath(); });   // wet light down the back of the neck
  });
  soleOf(L, 0.4, 0.42, -0.3); soleOf(L, 0.58, 0.44, 0.35);
  furPart(L, F, headShape, headAt(h));
  atop(L, () => {
    furGlow(L, OTTER_WARM, 0.35, -0.46, 0.43, 0.14, 0.045, 0.3);     // under the chin, on the chest
    furGlow(L, OTTER_SHADE, 0.3, -0.7, 0.36, 0.06, 0.1, 0.3);              // where the head meets the shoulders
    headGlow(L, h, true);
  });
  headFace(L, h);
  inWater(L, OTTER_SURFACE + 0.02);
  waterRing(g, -0.1, OTTER_SURFACE + 0.02, 0.8, 0.055, true);
  layDown(g, L);
  const paws = furShade(g, OTTER_WET, 0.06, 0.66), farPaws = furShade(g, tone(OTTER_WET, 0.8), 0.06, 0.66);
  g.save(); g.lineCap = 'round';
  furPart(g, farPaws, g => { g.moveTo(0.12, 0.45); g.quadraticCurveTo(0.2, 0.42, 0.24, 0.34); }, null, 0.08);   // the far forepaw, behind the fish
  handAt(g, farPaws, 0.25, 0.32, 0.5);
  troutAt(g, -0.08, 0.36, 0.5, -0.04);
  furPart(g, paws, g => { g.moveTo(-0.08, 0.46); g.quadraticCurveTo(0.02, 0.44, 0.05, 0.37); }, null, 0.09);   // the near one over it
  handAt(g, paws, 0.05, 0.34, -0.5);
  g.restore();
  waterRing(g, -0.1, OTTER_SURFACE + 0.02, 0.8, 0.055);
}

// Eating on the bank: lying on its front, a fish (or a frog) held in its forepaws, head down to it.
function otterEating(g, L, frog) {
  const h = { x: -0.58, y: 0.48, a: 0.5, s: 1.3 };
  const F = furShade(L, OTTER, 0.22, 0.73);
  furPart(L, F, tailShape([0.46, 0.56], [0.68, 0.6], [0.86, 0.7], [1.06, 0.67], 0.14));
  furPart(L, F, g => {
    g.moveTo(-0.46, 0.5); g.bezierCurveTo(-0.3, 0.2, 0.3, 0.18, 0.56, 0.42);
    g.bezierCurveTo(0.7, 0.56, 0.64, 0.72, 0.46, 0.73); g.lineTo(-0.36, 0.73); g.bezierCurveTo(-0.54, 0.7, -0.56, 0.58, -0.46, 0.5);
  });
  furPart(L, F, headShape, headAt(h));
  furPart(L, F, g => ovalAt(g, 0.4, 0.56, 0.2, 0.15, 0.2));
  atop(L, () => {
    furGlow(L, OTTER_LIGHT, 0.3, 0.1, 0.33, 0.36, 0.06, 0.05);
    furGlow(L, OTTER_LIGHT, 0.2, 0.8, 0.6, 0.2, 0.03, 0.4);                 // on the top of the tail
    furGlow(L, OTTER_LIGHT, 0.14, 0.4, 0.46, 0.14, 0.06, 0.2);
    furGlow(L, OTTER_SHADE, 0.32, 0.05, 0.72, 0.5, 0.06);
    furGlow(L, OTTER_PALE, 0.9, -0.44, 0.6, 0.1, 0.1, 0.4, 0.35);
    headGlow(L, h);
  });
  headFace(L, h);
  layDown(g, L);
  if (frog) { g.save(); g.translate(-0.86, 0.6); g.scale(0.34, 0.34); frogAt(g); g.restore(); } else troutAt(g, -0.92, 0.66, 0.6, 0.06);
  const paws = furShade(g, OTTER, 0.22, 0.73);
  g.save(); g.lineCap = 'round';
  furPart(g, paws, g => { g.moveTo(-0.34, 0.6); g.lineTo(-0.52, 0.66); }, null, 0.12);   // a forepaw on the fish
  furPart(g, paws, g => ovalAt(g, -0.56, 0.67, 0.07, 0.04));
  g.restore();
}

// Sliding down a bank on its belly, the forelegs laid back, flat out.
function otterSliding(g, L) {
  const tilt = -0.2, h = { x: -0.62, y: 0.47, a: 0.04 + tilt, s: 1.3 };
  const F = furShade(L, OTTER, 0.18, 0.7);
  const tf = g => { g.translate(0, 0.44); g.rotate(tilt); };
  furPart(L, F, tailShape([0.42, 0.04], [0.64, 0.05], [0.84, 0.07], [1.06, 0.04], 0.11), tf);
  furPart(L, F, g => { g.moveTo(-0.5, 0.04); g.bezierCurveTo(-0.3, -0.16, 0.4, -0.16, 0.6, 0.02); g.bezierCurveTo(0.64, 0.16, 0.3, 0.2, -0.3, 0.2); g.bezierCurveTo(-0.5, 0.2, -0.62, 0.12, -0.5, 0.04); }, tf);
  furPart(L, F, headShape, headAt(h));
  atop(L, () => {
    blurIn(L, OTTER_LIGHT, 0.4, 0.07, g => { g.moveTo(-0.5, -0.06); g.bezierCurveTo(-0.3, -0.26, 0.4, -0.26, 0.64, -0.08); g.bezierCurveTo(0.8, -0.04, 0.96, -0.02, 1.08, 0.0); g.lineTo(1.04, 0.04); g.bezierCurveTo(0.9, 0.02, 0.74, 0.0, 0.6, 0.0); g.bezierCurveTo(0.4, -0.08, -0.3, -0.08, -0.48, 0.06); g.closePath(); }, tf);
    blurIn(L, OTTER_SHADE, 0.36, 0.06, g => { g.moveTo(-0.4, 0.14); g.bezierCurveTo(-0.1, 0.12, 0.3, 0.12, 0.6, 0.08); g.lineTo(1.1, 0.08); g.lineTo(1.1, 0.3); g.lineTo(-0.4, 0.3); g.closePath(); }, tf);
    blurIn(L, OTTER_PALE, 0.9, 0.05, g => { g.moveTo(-0.9, 0.06); g.lineTo(-0.5, 0.08); g.quadraticCurveTo(-0.36, 0.12, -0.3, 0.3); g.lineTo(-0.9, 0.3); g.closePath(); }, tf);
    headGlow(L, h);
  });
  headFace(L, h);
  layDown(g, L);
}

// Asleep, curled up: the back arched, the hind leg folded under, the tail brought round its front and its chin
// laid on the tail, nose tucked down.
function otterAsleep(g, L) {
  const h = { x: -0.36, y: 0.5, a: -0.28, s: 1.1 };
  const F = furShade(L, OTTER, 0.14, 0.78);
  furPart(L, F, g => {
    g.moveTo(-0.34, 0.44);
    g.bezierCurveTo(-0.26, 0.2, 0.16, 0.1, 0.42, 0.26);          // over the shoulders and the arched back
    g.bezierCurveTo(0.64, 0.38, 0.64, 0.66, 0.46, 0.74);         // round the rump
    g.lineTo(-0.3, 0.75);
    g.bezierCurveTo(-0.42, 0.68, -0.42, 0.54, -0.34, 0.44); g.closePath();
  });
  furPart(L, F, g => ovalAt(g, 0.3, 0.54, 0.22, 0.19, -0.3));      // the haunch, the hind leg folded under it
  atop(L, () => {
    blurIn(L, OTTER_LIGHT, 0.4, 0.07, g => {                           // light along the arched back
      g.moveTo(-0.36, 0.36); g.bezierCurveTo(-0.26, 0.06, 0.24, 0.0, 0.56, 0.26); g.lineTo(0.46, 0.34);
      g.bezierCurveTo(0.2, 0.2, -0.14, 0.22, -0.26, 0.42); g.closePath();
    });
    blurIn(L, OTTER_LIGHT, 0.13, 0.08, g => {                          // and round the top of the haunch
      g.moveTo(0.1, 0.44); g.bezierCurveTo(0.18, 0.34, 0.4, 0.32, 0.5, 0.42); g.lineTo(0.46, 0.46); g.bezierCurveTo(0.36, 0.4, 0.2, 0.42, 0.14, 0.5); g.closePath();
    });
    blurIn(L, OTTER_SHADE, 0.28, 0.05, g => {                          // the crease in front of the haunch
      g.moveTo(0.08, 0.46); g.bezierCurveTo(0.04, 0.54, 0.06, 0.64, 0.12, 0.72); g.lineTo(0.17, 0.7); g.bezierCurveTo(0.11, 0.62, 0.1, 0.54, 0.13, 0.47); g.closePath();
    });
    blurIn(L, OTTER_SHADE, 0.4, 0.06, g => { g.moveTo(-0.5, 0.66); g.bezierCurveTo(-0.1, 0.62, 0.3, 0.64, 0.7, 0.6); g.lineTo(0.7, 0.9); g.lineTo(-0.5, 0.9); g.closePath(); });
  });
  furPart(L, F, tailShape([0.44, 0.62], [0.42, 0.78], [-0.16, 0.8], [-0.62, 0.7], 0.12));   // the tail, round its front to its nose
  atop(L, () => blurIn(L, OTTER_LIGHT, 0.2, 0.06, g => { g.moveTo(0.46, 0.66); g.bezierCurveTo(0.3, 0.72, -0.2, 0.7, -0.62, 0.66); g.lineTo(-0.6, 0.7); g.bezierCurveTo(-0.2, 0.74, 0.3, 0.76, 0.46, 0.7); g.closePath(); }));
  furPart(L, F, headShape, headAt(h));                              // its chin on its tail
  atop(L, () => {
    furGlow(L, OTTER_SHADE, 0.3, -0.18, 0.44, 0.06, 0.12, 0.3);           // where the head lies against the shoulder
    headGlow(L, h);
  });
  headFace(L, h, { shut: true });
  layDown(g, L);
}

// A fish: a brown trout, olive above and silver below, spotted. Its head at x, y, l long, at angle a.
function troutAt(g, x, y, l, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(l, l);
  fillIn(g, '#76703f', () => { g.moveTo(0.8, 0); g.lineTo(1.05, -0.16); g.quadraticCurveTo(0.98, 0, 1.05, 0.16); g.closePath(); });   // the tail fin
  softIn(g, [168, 162, 104], -0.15, 0.15, () => { g.moveTo(0, 0); g.bezierCurveTo(0.14, -0.19, 0.6, -0.17, 0.86, 0); g.bezierCurveTo(0.6, 0.15, 0.14, 0.17, 0, 0); });
  fillIn(g, 'rgba(240,236,214,0.75)', () => ovalAt(g, 0.42, 0.07, 0.3, 0.045));
  fillIn(g, '#3e3a24', () => { for (const [sx, sy] of [[0.3, -0.07], [0.46, -0.09], [0.6, -0.06], [0.38, -0.01], [0.53, -0.02]]) discAt(g, sx, sy, 0.024); });
  fillIn(g, '#c0503e', () => discAt(g, 0.68, 0.02, 0.02));
  fillIn(g, '#1a1712', () => discAt(g, 0.1, -0.035, 0.028));
  g.restore();
}

// The V it leaves swimming: a few short arcs spreading back from its chin, fading (drawn on the water, under it).
function drawWake(ctx, x, y, px, dir, now) {
  ctx.lineWidth = Math.max(1, px * 0.035);
  for (let k = 0; k < 3; k++) {
    const back = px * (0.2 + 0.28 * k), open = px * (0.08 + 0.13 * k);
    ctx.strokeStyle = `rgba(235, 246, 255, ${0.6 - 0.17 * k})`;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const ex = x - dir * px * 0.42 + dir * back, ey = y + px * 0.27 + side * open;
      ctx.moveTo(ex - dir * px * 0.12, ey - side * px * 0.05); ctx.quadraticCurveTo(ex, ey - side * px * 0.01, ex + dir * px * 0.06, ey + side * px * 0.04);
    }
    ctx.stroke();
  }
}

// The otters' paintings for the sprite cache ('otter:' + pose): 0 standing, 1 and 2 the two steps of the lope,
// 3 sitting up, 4 swimming, 5 swimming with a fish in its jaws, 6 diving, 7 afloat on its back eating a fish,
// 8 eating one on the bank, 9 sliding, 10 asleep, 11 eating a frog on the bank.
const OTTER_ARTS = Array.from({ length: 12 }, (_, k) => 'otter:' + k);
function paintOtter(g, size, U, pose) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const L = furLayer(g, size, U);
  if (pose <= 2) otterLoping(g, L, pose);
  else if (pose === 3) otterSitting(g, L);
  else if (pose <= 5) otterSwimming(g, L, pose === 5);
  else if (pose === 6) otterDiving(g, L);
  else if (pose === 7) otterFloating(g, L);
  else if (pose === 8 || pose === 11) otterEating(g, L, pose === 11);
  else if (pose === 9) otterSliding(g, L);
  else otterAsleep(g, L);
}
// The way into a holt, among the roots of its tree on the bank ('holt:0'): a dark hollow under an arching root.
function paintHolt(g, size, U) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  fillIn(g, 'rgba(40, 50, 20, 0.25)', () => ovalAt(g, 0, 0.56, 0.86, 0.2));                     // the trodden bank
  fillIn(g, '#7a5a3a', () => { g.moveTo(-0.62, 0.62); g.ellipse(0, 0.62, 0.62, 0.62, 0, Math.PI, TAU); g.closePath(); });   // the earth
  fillIn(g, '#241810', () => { g.moveTo(-0.4, 0.62); g.ellipse(0, 0.62, 0.4, 0.42, 0, Math.PI, TAU); g.closePath(); });     // the way in
  strokeIn(g, '#5e4128', 0.15, () => { g.moveTo(-0.78, 0.66); g.bezierCurveTo(-0.66, 0.04, 0.5, -0.06, 0.72, 0.6); });         // a root over it
  strokeIn(g, '#8a6a46', 0.05, () => { g.moveTo(-0.66, 0.42); g.bezierCurveTo(-0.5, 0.06, 0.34, 0.0, 0.56, 0.34); });
  strokeIn(g, '#5e4128', 0.09, () => { g.moveTo(0.3, 0.2); g.quadraticCurveTo(0.62, 0.3, 0.9, 0.64); });                       // and another, thinner
}

// An otter on screen (sim.js otterTick): in the water it swims (a V of wake behind it on its way somewhere), goes
// under (seen going, then only the rings where it went), and eats its fish afloat; on land it lopes, sits up,
// roots for frogs, slides down the bank, and sleeps curled up.
const OTTER_STRIDE = 0.22;         // of its length, a step of the lope
const OTTER_UNDER = 12;            // ticks it's seen going under, then only the rings
const OTTER_FISH = 15;             // ticks it's seen with the fish in its jaws, coming up, before it rolls on its back to eat
const OTTER_GOES = new Set(['fish', 'frog', 'bed', 'slip', 'leave', 'play', 'slide', 'wander']);   // on its way somewhere (c.target)
const otterSwims = c => !world.frozen && world.water[(c.y | 0) * S.W + (c.x | 0)] > 0;
function otterGoes(c) {
  if (c.mode === 'follow') { const m = world.byId.get(c.mumId); return !!m && Math.abs(m.x - c.x) + Math.abs(m.y - c.y) > 1.5; }
  const t = c.target;
  return OTTER_GOES.has(c.mode) && !!t && Math.abs(t.x - c.x) + Math.abs(t.y - c.y) > 0.05;
}
// Ticks since it went under (a dive's timer only counts down, so a bigger one is a new dive).
const dives = new WeakMap();
function underFor(c) {
  let d = dives.get(c);
  if (!d || c.timer > d.timer) dives.set(c, d = { t0: world.tick, timer: c.timer });
  d.timer = c.timer;
  return world.tick + acc - d.t0;
}
// Its painting, or null while it's under the water.
function otterArt(c, px, wet) {
  if (c.sleeping) return OTTER_ARTS[10];
  if (c.mode === 'dive' && wet) return underFor(c) < OTTER_UNDER ? OTTER_ARTS[6] : null;
  if (c.mode === 'eat') return OTTER_ARTS[!wet ? 8 : c.timer > S.FISH_EAT - OTTER_FISH ? 5 : 7];
  if (wet) return OTTER_ARTS[4];
  if (c.mode === 'munch') return OTTER_ARTS[11];
  const goes = otterGoes(c);
  if (c.mode === 'slide' && goes) return OTTER_ARTS[9];
  if (goes && ui.speed > 0) {                        // (the step goes by where it is, so it stops when it stops)
    const k = cam.zoom / (px * OTTER_STRIDE);
    return OTTER_ARTS[(Math.floor(c.x * k) + Math.floor(c.y * k)) & 1 ? 1 : 2];
  }
  return OTTER_ARTS[c.mode === 'wander' || c.mode === 'play' ? 3 : 0];
}
function drawOtter(c, sx, sy, now) {
  const px = creaturePx(c), wet = otterSwims(c), art = otterArt(c, px, wet), flip = c.facing > 0;
  if (wet && wasWet.get(c) === false && (c.mode === 'slide' || c.mode === 'slip') && ui.speed > 0 && ui.speed <= 4 && splashes.length < 12) {
    splashes.push({ x: c.x, y: c.y, size: px / cam.zoom, t0: now });   // into the water: a splash
  }
  wasWet.set(c, wet);
  if (!art) { drawUnder(sx, sy + px * 0.31, px, now, c.id); return; }
  if (wet && otterGoes(c)) drawWake(ctx, sx, sy, px, flip ? -1 : 1, now);
  const breathe = c.sleeping && ui.speed > 0 ? Math.sin(now / 650 + c.id) * 0.035 : 0;
  drawEmoji(art, sx, sy - px * 0.4 * breathe, px, { flip, squash: 1 + breathe });   // feet stay on the ground
  if (c.mode === 'root' && px > 18 && ui.speed > 0 && ui.speed <= 4) drawDigging(c, sx, sy, px, now, flip ? -1 : 1);
}
// Where one slid (or slipped) into the water: drops thrown up and out, and a ring spreading. Seen at 4x or slower.
const SPLASH_MS = 650;
const SPLASH_DROPS = [[-0.55, 0.3, 0.035], [-0.35, 0.5, 0.045], [-0.15, 0.62, 0.04], [0.05, 0.55, 0.05], [0.25, 0.6, 0.04],
  [0.42, 0.45, 0.045], [0.6, 0.28, 0.035], [-0.05, 0.35, 0.03], [0.15, 0.3, 0.03]];   // out, up, size, of its size
const splashes = [], wasWet = new WeakMap();
function drawSplashes(now) {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i], u = (now - s.t0) / SPLASH_MS;
    if (u >= 1 || u < 0) { splashes.splice(i, 1); continue; }
    const [sx, y0] = toScreen(s.x, s.y), px = s.size * cam.zoom, sy = y0 + px * 0.31;
    if (!visible(sx, sy, px)) continue;
    ctx.lineWidth = Math.max(1, px * 0.03);
    ctx.strokeStyle = `rgba(240, 250, 255, ${0.7 * (1 - u)})`;
    ctx.beginPath(); ctx.ellipse(sx, sy, px * (0.18 + 0.5 * u), px * (0.06 + 0.15 * u), 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(245, 252, 255, ${0.9 * (1 - u * u)})`;
    ctx.beginPath();
    for (const [out, up, r] of SPLASH_DROPS) {
      const x = sx + out * px * u, y = sy - up * px * 4 * u * (1 - u), rr = Math.max(0.8, r * px * (1 - 0.5 * u));
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU);
    }
    ctx.fill();
  }
}

// Where an otter went under: rings spreading on the water.
function drawUnder(sx, y, px, now, id) {
  ctx.lineWidth = Math.max(1, px * 0.03);
  for (let k = 0; k < 2; k++) {
    const u = (now / 1400 + k / 2 + id * 0.31) % 1;
    ctx.strokeStyle = `rgba(240, 250, 255, ${0.55 * (1 - u)})`;
    ctx.beginPath(); ctx.ellipse(sx, y, px * (0.12 + 0.4 * u), px * (0.04 + 0.12 * u), 0, 0, TAU); ctx.stroke();
  }
}

// A bird's remains are a few feathers: a crow's ('remains:0') or an owl's barred brown ones ('remains:1'). An otter's
// ('remains:2') are tufts of its brown fur and a bone or two. A rabbit's and a fox's are painted below (paintBody).
function paintRemains(g, size, U, look) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  fillIn(g, 'rgba(40, 50, 20, 0.2)', () => ovalAt(g, 0.02, 0.64, 0.86, 0.16));   // pressed into the grass
  if (look === 2) {
    for (const [x, y, a] of [[-0.4, 0.52, -0.3], [0.3, 0.58, 0.4], [0.0, 0.42, 0.1], [0.5, 0.42, -0.6]]) {
      g.save(); g.translate(x, y); g.rotate(a);
      softIn(g, OTTER, -0.12, 0.12, () => ovalAt(g, 0, 0, 0.2, 0.1));
      strokeIn(g, rockRGB(tone(OTTER, 1.25, 10)), 0.025, () => { for (const k of [-0.1, 0, 0.1]) { g.moveTo(k - 0.12, k * 0.3); g.quadraticCurveTo(k, -0.08 + k * 0.2, k + 0.16, k * 0.4); } });
      g.restore();
    }
    boneAt(g, -0.1, 0.66, 0.24, 0.2); boneAt(g, 0.36, 0.72, 0.18, -0.4, 0.8);
    return;
  }
  const ink = look ? '#8a5c36' : CROW_INK, sheen = look ? '#d0a878' : CROW_SHEEN;
  for (const [x, y, a, s] of [[-0.36, 0.5, -0.3, 1.5], [0.34, 0.56, 0.5, 1.2], [0.02, 0.4, 0.1, 1.1]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s * 0.7);
    fillIn(g, ink, () => { g.moveTo(-0.34, 0); g.quadraticCurveTo(0, -0.16, 0.32, 0); g.quadraticCurveTo(0, 0.12, -0.34, 0); });
    strokeIn(g, sheen, 0.04, () => { g.moveTo(-0.2, -0.05); g.quadraticCurveTo(0, -0.1, 0.2, -0.04); });
    strokeIn(g, '#9a9eac', 0.03, () => { g.moveTo(-0.4, 0.01); g.lineTo(0.28, 0); });
    g.restore();
  }
}
const REMAINS_ARTS = [0, 1, 2].map(k => 'remains:' + k);

// A dead rabbit, lying on its side facing left, in four stages ('body:' + coat * 4 + stage): 0 whole, its eyes
// closed; 1 opened, the ribs showing; 2 picked over, bones and scraps; 3 a flat pelt, a bone or two. Soft shapes in
// the emoji rabbit's proportions, no red. Coats: wild, sandy, black, blue-grey, a winter white (drawRemains). A fox
// is painted after them (paintDeadFox).
const BODY_COATS = [S.COATS.wild.rgb, S.COATS.sand.rgb, S.COATS.black.rgb, S.COATS.blue.rgb, S.WINTER_COAT];
const BODY_COAT_OF = { wild: 0, sand: 1, black: 2, blue: 3 };
const BONE = '#ece2cc', BONE_DARK = '#b3a283', GUT = '#6a3a2e', GUT_DARK = '#3a221c';
// A part, shaded soft from its lit top to its dark underside (painted once, so a gradient is fine).
function softIn(g, rgb, y0, y1, path, lit = 1.18, dim = 0.68) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, rockRGB(tone(rgb, lit, 12)));
  gr.addColorStop(0.5, rockRGB(rgb));
  gr.addColorStop(1, rockRGB(tone(rgb, dim)));
  g.fillStyle = gr; g.beginPath(); path(); g.fill();
}
// A little bone: a shaft with two knobs at each end, a darker copy under it for shade.
const boneAt = (g, x, y, l, a, s = 1) => {
  const dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2, nx = -Math.sin(a) * 0.028 * s, ny = Math.cos(a) * 0.028 * s;
  const shape = off => { g.moveTo(x - dx, y - dy + off); g.lineTo(x + dx, y + dy + off); };
  const knobs = (off, r) => { for (const e of [-1, 1]) { discAt(g, x + e * dx + nx, y + e * dy + ny + off, r); discAt(g, x + e * dx - nx, y + e * dy - ny + off, r); } };
  strokeIn(g, BONE_DARK, 0.055 * s, () => shape(0.014));
  fillIn(g, BONE_DARK, () => knobs(0.014, 0.036 * s));
  strokeIn(g, BONE, 0.045 * s, () => shape(0));
  fillIn(g, BONE, () => knobs(0, 0.032 * s));
};
// Ribs seen from the side: arcs hanging from the spine and curving back.
const ribsAt = (g, x0, y, n, gap, h, w = 0.042) => {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, hh = h * (1 - 0.18 * i);
    strokeIn(g, BONE_DARK, w * 1.35, () => { g.moveTo(x, y); g.bezierCurveTo(x - 0.1, y + hh * 0.2, x - 0.1, y + hh * 0.8, x + 0.02, y + hh); });
    strokeIn(g, BONE, w, () => { g.moveTo(x - 0.008, y - 0.006); g.bezierCurveTo(x - 0.105, y + hh * 0.2, x - 0.105, y + hh * 0.78, x + 0.012, y + hh - 0.008); });
  }
};
const tailAt = (g, x, y) => {                  // the white scut
  fillIn(g, '#d9d3c6', () => { discAt(g, x + 0.02, y + 0.03, 0.1); });
  fillIn(g, '#f6f3ec', () => { discAt(g, x, y, 0.085); discAt(g, x + 0.05, y + 0.04, 0.06); });
};

// The head, lying on the grass: a closed eye, its ear laid back.
function bodyHead(g, rgb, cream) {
  softIn(g, rgb, 0.12, 0.66, () => { g.ellipse(-0.52, 0.42, 0.28, 0.22, 0.1, 0, TAU); g.moveTo(-0.62, 0.5); g.ellipse(-0.74, 0.5, 0.13, 0.12, 0, 0, TAU); });
  fillIn(g, rockRGB(cream, 0.9), () => { ovalAt(g, -0.7, 0.52, 0.13, 0.09, 0.2); });
  fillIn(g, '#c98a86', () => discAt(g, -0.86, 0.47, 0.03));
  strokeIn(g, rockRGB(tone(rgb, 0.35)), 0.032, () => { g.moveTo(-0.6, 0.38); g.quadraticCurveTo(-0.54, 0.43, -0.47, 0.39); });   // the closed eye
  softIn(g, rgb, 0.14, 0.34, () => { g.ellipse(-0.22, 0.25, 0.32, 0.09, -0.2, 0, TAU); });   // the ear, laid back
  fillIn(g, 'rgba(214,150,146,0.75)', () => ovalAt(g, -0.19, 0.255, 0.23, 0.038, -0.2));
}
// The body on its side: haunch, back, belly; the hind leg stretched out, a front paw.
function bodyLying(g, rgb, cream, dark) {
  softIn(g, dark, 0.5, 0.7, () => { g.ellipse(-0.24, 0.62, 0.14, 0.045, 0.1, 0, TAU); g.moveTo(0.62, 0.64); g.ellipse(0.5, 0.64, 0.16, 0.045, 0, 0, TAU); });   // the far legs
  softIn(g, rgb, 0.46, 0.68, () => { g.ellipse(0.62, 0.58, 0.3, 0.085, 0.14, 0, TAU); });              // the hind leg, stretched out
  softIn(g, rgb, 0.04, 0.66, () => { g.ellipse(0.02, 0.38, 0.5, 0.28, -0.05, 0, TAU); g.moveTo(0.64, 0.36); g.arc(0.34, 0.36, 0.3, 0, TAU); });   // body and haunch
  fillIn(g, rockRGB(cream, 0.8), () => ovalAt(g, -0.02, 0.57, 0.38, 0.075, -0.03));                   // belly
  fillIn(g, rockRGB(tone(rgb, 1.25, 20), 0.35), () => { ovalAt(g, -0.05, 0.2, 0.3, 0.06, -0.1); ovalAt(g, 0.32, 0.16, 0.16, 0.05, 0.1); });   // light on the back
  softIn(g, rgb, 0.52, 0.66, () => { g.ellipse(-0.34, 0.6, 0.18, 0.055, 0.15, 0, TAU); });             // a front paw
}

function paintBody(g, size, U, look, leaf, up = 0) {     // up: raised in its box (lying low, it sits under the middle)
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2 - up * U / 2);
  g.lineCap = g.lineJoin = 'round';
  const kind = Math.floor(look / 4), stage = look % 4;
  fillIn(g, 'rgba(40, 50, 20, 0.22)', () => ovalAt(g, 0, 0.62, 0.95, 0.14));   // pressed into the grass
  if (kind === FOX_LOOK) { paintDeadFox(g, stage); return; }
  const rgb = tone(BODY_COATS[kind], 0.92, 8), cream = tone(rgb, 0.4, 150), dark = tone(rgb, 0.62);
  if (stage <= 1) {
    bodyLying(g, rgb, cream, dark);
    tailAt(g, 0.64, 0.24);
    if (stage === 1) {                                                          // opened up: a hole in the side, the ribs over it
      fillIn(g, rockRGB(tone(rgb, 0.55)), () => ovalAt(g, 0.15, 0.36, 0.27, 0.17, -0.06));          // torn edge
      fillIn(g, GUT, () => ovalAt(g, 0.15, 0.37, 0.24, 0.14, -0.06));
      fillIn(g, GUT_DARK, () => ovalAt(g, 0.17, 0.41, 0.17, 0.08, -0.06));
      ribsAt(g, 0.0, 0.25, 4, 0.1, 0.24, 0.036);
      strokeIn(g, BONE_DARK, 0.06, () => { g.moveTo(-0.06, 0.25); g.quadraticCurveTo(0.14, 0.2, 0.36, 0.26); });   // a bit of spine
      strokeIn(g, BONE, 0.045, () => { g.moveTo(-0.06, 0.24); g.quadraticCurveTo(0.14, 0.19, 0.36, 0.25); });
    }
    bodyHead(g, rgb, cream);
    return;
  }
  if (stage === 2) {                                                            // picked over: the hind half, the spine and ribs, bones about
    softIn(g, rgb, 0.3, 0.68, () => { g.ellipse(0.42, 0.5, 0.26, 0.15, 0.1, 0, TAU); g.moveTo(0.92, 0.6); g.ellipse(0.7, 0.6, 0.22, 0.065, 0.15, 0, TAU); });
    softIn(g, rgb, 0.4, 0.66, () => { g.ellipse(-0.5, 0.56, 0.2, 0.09, -0.15, 0, TAU); });              // a scrap of the front
    tailAt(g, 0.66, 0.4);
    strokeIn(g, BONE_DARK, 0.075, () => { g.moveTo(-0.4, 0.44); g.quadraticCurveTo(-0.05, 0.3, 0.26, 0.42); });   // the spine
    fillIn(g, BONE, () => { for (let i = 0; i <= 7; i++) { const t = i / 7, u = 1 - t; discAt(g, u * u * -0.4 + 2 * u * t * -0.05 + t * t * 0.26, u * u * 0.44 + 2 * u * t * 0.3 + t * t * 0.42 - 0.012, 0.034); } });
    ribsAt(g, -0.22, 0.37, 4, 0.1, 0.24, 0.038);
    boneAt(g, -0.66, 0.74, 0.22, -0.35); boneAt(g, 0.2, 0.74, 0.2, 0.15); boneAt(g, -0.1, 0.16, 0.16, 0.5, 0.8);
    return;
  }
  // a flat pelt, going back to the earth, a bone or two on it
  const pelt = tone(rgb, 0.85);
  softIn(g, pelt, 0.3, 0.7, () => {
    g.moveTo(-0.7, 0.52);
    g.quadraticCurveTo(-0.62, 0.36, -0.36, 0.38); g.quadraticCurveTo(0, 0.3, 0.46, 0.36);
    g.quadraticCurveTo(0.7, 0.36, 0.74, 0.46); g.lineTo(0.9, 0.5); g.lineTo(0.72, 0.56); g.quadraticCurveTo(0.6, 0.66, 0.36, 0.64);
    g.lineTo(0.3, 0.74); g.lineTo(0.18, 0.65); g.quadraticCurveTo(-0.1, 0.7, -0.32, 0.66); g.lineTo(-0.44, 0.76); g.lineTo(-0.48, 0.64); g.quadraticCurveTo(-0.66, 0.62, -0.7, 0.52);
  }, 1.1, 0.75);
  fillIn(g, rockRGB(tone(pelt, 0.72), 0.5), () => { ovalAt(g, -0.24, 0.52, 0.18, 0.06, 0.1); ovalAt(g, 0.3, 0.5, 0.22, 0.07, -0.1); });   // it's gone dark in places
  fillIn(g, rockRGB(tone(pelt, 1.2, 14), 0.4), () => { ovalAt(g, 0.02, 0.42, 0.26, 0.04, -0.05); });   // a little light along it
  boneAt(g, -0.3, 0.5, 0.3, 0.2); boneAt(g, 0.22, 0.54, 0.24, -0.25, 0.9); boneAt(g, 0.62, 0.78, 0.18, 0.3, 0.8);
}
// A dead fox, lying on its side facing left like the rabbit ('body:20' to 'body:23'): long and slim, a pointed
// snout, a white chest and chin, dark stockings, and the bushy white-tipped tail, which lasts the longest.
const FOX_COAT = [206, 108, 58], FOX_WHITE = [240, 234, 222], FOX_SOCK = [74, 54, 46];
const foxTail = (g, rgb, x, y, a = 0.12) => {      // from the rump at x, y out to the right
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -0.12, 0.12, () => { g.moveTo(0, -0.04); g.bezierCurveTo(0.14, -0.14, 0.4, -0.12, 0.54, -0.02); g.bezierCurveTo(0.56, 0.06, 0.4, 0.12, 0.2, 0.09); g.bezierCurveTo(0.08, 0.08, 0, 0.05, 0, -0.04); });
  softIn(g, FOX_WHITE, -0.08, 0.1, () => { g.moveTo(0.44, -0.07); g.bezierCurveTo(0.54, -0.06, 0.62, 0, 0.56, 0.05); g.bezierCurveTo(0.5, 0.08, 0.44, 0.06, 0.42, 0.02); g.closePath(); }, 1.05, 0.85);
  g.restore();
};
function foxHead(g, rgb) {
  softIn(g, rgb, 0.22, 0.6, () => { g.ellipse(-0.55, 0.42, 0.21, 0.17, 0.1, 0, TAU); g.moveTo(-0.68, 0.36); g.quadraticCurveTo(-0.8, 0.4, -0.88, 0.47); g.quadraticCurveTo(-0.8, 0.54, -0.62, 0.55); g.closePath(); });   // head and snout
  softIn(g, FOX_WHITE, 0.44, 0.6, () => { g.moveTo(-0.86, 0.49); g.quadraticCurveTo(-0.76, 0.44, -0.56, 0.46); g.quadraticCurveTo(-0.42, 0.5, -0.44, 0.55); g.quadraticCurveTo(-0.64, 0.6, -0.86, 0.49); }, 1.05, 0.85);   // the pale cheek and chin
  fillIn(g, '#2a211d', () => discAt(g, -0.878, 0.468, 0.03));                                      // nose
  strokeIn(g, '#3a2a22', 0.03, () => { g.moveTo(-0.65, 0.38); g.quadraticCurveTo(-0.6, 0.415, -0.54, 0.385); });   // the closed eye
  softIn(g, rgb, 0.16, 0.34, () => { g.moveTo(-0.58, 0.29); g.quadraticCurveTo(-0.44, 0.19, -0.28, 0.19); g.quadraticCurveTo(-0.36, 0.29, -0.45, 0.33); g.closePath(); });   // the ear, laid back
  fillIn(g, rockRGB(FOX_SOCK), () => { g.moveTo(-0.35, 0.2); g.quadraticCurveTo(-0.32, 0.19, -0.28, 0.19); g.quadraticCurveTo(-0.31, 0.24, -0.36, 0.26); g.closePath(); });
}
function foxLying(g, rgb) {
  const sock = rockRGB(FOX_SOCK);
  strokeIn(g, rockRGB(tone(FOX_SOCK, 0.8)), 0.07, () => { g.moveTo(-0.28, 0.54); g.lineTo(-0.5, 0.64); g.moveTo(0.34, 0.54); g.lineTo(0.56, 0.66); });   // the far legs
  foxTail(g, rgb, 0.34, 0.4);
  softIn(g, rgb, 0.5, 0.64, () => { g.ellipse(0.4, 0.56, 0.18, 0.06, 0.35, 0, TAU); });              // the hind leg, stretched out
  strokeIn(g, sock, 0.07, () => { g.moveTo(0.52, 0.61); g.lineTo(0.62, 0.64); });
  softIn(g, rgb, 0.18, 0.62, () => { g.ellipse(-0.04, 0.41, 0.4, 0.17, -0.02, 0, TAU); g.moveTo(0.46, 0.4); g.arc(0.26, 0.4, 0.2, 0, TAU); });   // body and haunch
  fillIn(g, rockRGB(tone(rgb, 1.2, 20), 0.35), () => ovalAt(g, -0.04, 0.3, 0.28, 0.045, -0.04));    // light on the back
  softIn(g, FOX_WHITE, 0.46, 0.62, () => { g.ellipse(-0.36, 0.54, 0.11, 0.06, 0.1, 0, TAU); }, 1.05, 0.85);   // the white chest
  softIn(g, rgb, 0.52, 0.66, () => { g.ellipse(-0.46, 0.58, 0.14, 0.045, 0.3, 0, TAU); });           // a front leg
  strokeIn(g, sock, 0.065, () => { g.moveTo(-0.56, 0.61); g.lineTo(-0.66, 0.64); });
}
function paintDeadFox(g, stage) {
  const rgb = FOX_COAT, pelt = tone(rgb, 0.85);
  if (stage <= 1) {
    foxLying(g, rgb);
    if (stage === 1) {                                                          // opened up, as the rabbit
      fillIn(g, rockRGB(tone(rgb, 0.55)), () => ovalAt(g, 0.02, 0.4, 0.22, 0.13, -0.04));
      fillIn(g, GUT, () => ovalAt(g, 0.02, 0.41, 0.19, 0.11, -0.04));
      fillIn(g, GUT_DARK, () => ovalAt(g, 0.04, 0.44, 0.13, 0.06, -0.04));
      ribsAt(g, -0.1, 0.31, 4, 0.08, 0.19, 0.032);
      strokeIn(g, BONE_DARK, 0.05, () => { g.moveTo(-0.16, 0.31); g.quadraticCurveTo(0.02, 0.27, 0.2, 0.31); });   // a bit of spine
      strokeIn(g, BONE, 0.038, () => { g.moveTo(-0.16, 0.3); g.quadraticCurveTo(0.02, 0.26, 0.2, 0.3); });
    }
    foxHead(g, rgb);
    return;
  }
  if (stage === 2) {                                                            // picked over: the tail and hind half, spine and ribs, bones
    foxTail(g, rgb, 0.36, 0.46);
    softIn(g, rgb, 0.36, 0.64, () => { g.ellipse(0.3, 0.5, 0.18, 0.1, 0.1, 0, TAU); g.moveTo(0.58, 0.6); g.ellipse(0.46, 0.6, 0.13, 0.045, 0.3, 0, TAU); });
    strokeIn(g, rockRGB(FOX_SOCK), 0.055, () => { g.moveTo(0.56, 0.63); g.lineTo(0.66, 0.66); });
    softIn(g, rgb, 0.44, 0.64, () => { g.ellipse(-0.56, 0.56, 0.17, 0.07, -0.1, 0, TAU); });           // a scrap of the front
    strokeIn(g, BONE_DARK, 0.07, () => { g.moveTo(-0.46, 0.47); g.quadraticCurveTo(-0.12, 0.34, 0.16, 0.45); });   // the spine
    fillIn(g, BONE, () => { for (let i = 0; i <= 7; i++) { const t = i / 7, u = 1 - t; discAt(g, u * u * -0.46 + 2 * u * t * -0.12 + t * t * 0.16, u * u * 0.47 + 2 * u * t * 0.34 + t * t * 0.45 - 0.012, 0.032); } });
    ribsAt(g, -0.3, 0.4, 4, 0.09, 0.22, 0.036);
    boneAt(g, -0.72, 0.74, 0.22, -0.35); boneAt(g, 0.1, 0.74, 0.22, 0.15); boneAt(g, -0.2, 0.2, 0.16, 0.5, 0.8);
    return;
  }
  // a flat pelt, the tail still to it, a bone or two on it
  foxTail(g, pelt, 0.4, 0.5, 0.18);
  softIn(g, pelt, 0.32, 0.7, () => {
    g.moveTo(-0.74, 0.54);
    g.quadraticCurveTo(-0.66, 0.4, -0.4, 0.42); g.quadraticCurveTo(0, 0.34, 0.36, 0.4); g.quadraticCurveTo(0.5, 0.44, 0.46, 0.54);
    g.lineTo(0.62, 0.64); g.lineTo(0.38, 0.62); g.lineTo(0.28, 0.72); g.lineTo(0.16, 0.64); g.quadraticCurveTo(-0.1, 0.7, -0.34, 0.66);
    g.lineTo(-0.5, 0.76); g.lineTo(-0.5, 0.64); g.quadraticCurveTo(-0.68, 0.64, -0.74, 0.54);
  }, 1.1, 0.75);
  fillIn(g, rockRGB(tone(pelt, 0.72), 0.5), () => { ovalAt(g, -0.3, 0.54, 0.16, 0.05, 0.1); ovalAt(g, 0.16, 0.5, 0.18, 0.06, -0.1); });   // it's gone dark in places
  fillIn(g, rockRGB(FOX_WHITE, 0.55), () => ovalAt(g, -0.56, 0.58, 0.1, 0.05, 0.2));             // what's left of the white chest
  boneAt(g, -0.28, 0.52, 0.28, 0.2); boneAt(g, 0.14, 0.56, 0.22, -0.25, 0.9); boneAt(g, 0.02, 0.8, 0.18, 0.1, 0.8);
}
const FOX_LOOK = BODY_COATS.length;          // the fox's looks come after the rabbits' coats
const BODY_ARTS = Array.from({ length: (FOX_LOOK + 1) * 4 }, (_, k) => 'body:' + k);

// ------------------------------------------------------------------ the fox
//
// A living fox is painted like its carcass, not the 🦊 emoji (that's only a face). One rig, posed for what it's
// doing (FOX_POSES): the chest, the hip and the head placed, each paw set down and its leg bent to reach it (jointAt),
// the brush along a curve. It's painted as one animal: one shading runs over the whole fox, so where its parts
// overlap nothing starts again; each part gets its form from soft shade and light inside its own outline, a part in
// front casts a soft shadow on the one behind, and the white, the socks and the ear tips have soft edges, as fur
// does. The outline is softened a little and a faint grain laid over it, so it sits in the painted meadow.
// Facing left, box -1 to 1, feet on the ground at 0.72. 'fox:' + (fur step << 4) + pose.
const FOX_SHADE = [70, 30, 12], FOX_LIGHT = [255, 236, 205];
const FOX_STAND = {
  chest: [-0.22, 0.2], hip: [0.28, 0.19], arch: 0,             // arch: the back raised between them
  head: [-0.5, -0.02, 0], ear: 0, eye: 'open',                 // head: where the skull is, and its tilt (minus: nose down); ear: laid back (+)
  tail: { base: [0.42, 0.1], c1: [0.64, 0.16], c2: [0.84, 0.3], tip: [1.0, 0.42], w: 1 },
  fore: { near: [-0.27, 0.71], far: [-0.2, 0.71] }, foreBend: 1,   // the paws; foreBend 1: the wrist bends forward, -1: the elbow back
  hind: { near: [0.32, 0.71], far: [0.39, 0.71] },
};
const FOX_TROT_TAIL = { base: [0.42, 0.1], c1: [0.64, 0.14], c2: [0.86, 0.22], tip: [1.04, 0.3], w: 1 };
const FOX_POSES = {
  stand: FOX_STAND,
  trot1: { ...FOX_STAND, head: [-0.52, 0.01, -0.05], tail: FOX_TROT_TAIL,             // one diagonal pair up, the other down
    fore: { near: [-0.3, 0.6], far: [-0.08, 0.71] }, hind: { near: [0.46, 0.71], far: [0.3, 0.62] } },
  trot2: { ...FOX_STAND, head: [-0.52, 0.01, -0.05], tail: FOX_TROT_TAIL,
    fore: { near: [-0.42, 0.71], far: [-0.26, 0.6] }, hind: { near: [0.3, 0.62], far: [0.18, 0.71] } },
  run1: { ...FOX_STAND, chest: [-0.26, 0.18], hip: [0.3, 0.17], head: [-0.6, 0.06, -0.12], ear: 0.35,   // a gallop, stretched out
    tail: { base: [0.44, 0.08], c1: [0.64, 0.07], c2: [0.84, 0.1], tip: [1.06, 0.14], w: 1 },
    fore: { near: [-0.68, 0.54], far: [-0.6, 0.6] }, hind: { near: [0.72, 0.5], far: [0.66, 0.56] } },
  run2: { ...FOX_STAND, chest: [-0.18, 0.22], hip: [0.2, 0.16], arch: 0.02, head: [-0.5, 0.06, -0.1], ear: 0.35,   // and gathered
    tail: { base: [0.34, 0.08], c1: [0.54, 0.1], c2: [0.74, 0.2], tip: [0.94, 0.28], w: 1 },
    fore: { near: [0.02, 0.66], far: [0.08, 0.62] }, hind: { near: [-0.1, 0.68], far: [-0.04, 0.7] } },
  sit: { ...FOX_STAND, chest: [-0.12, 0.2], hip: [0.1, 0.5], head: [-0.3, -0.15, -0.05],
    tail: { base: [0.26, 0.58], c1: [0.44, 0.8], c2: [0.02, 0.86], tip: [-0.36, 0.75], w: 0.95, front: [0, 0.55, 0, 0.67] },
    fore: { near: [-0.24, 0.71], far: [-0.18, 0.71] }, hind: { near: [-0.06, 0.71], far: [0, 0.71] } },
  crouch: { ...FOX_STAND, chest: [-0.22, 0.36], hip: [0.26, 0.3], head: [-0.52, 0.24, -0.3], ear: -0.2,   // mousing, about to leap
    tail: { base: [0.4, 0.24], c1: [0.6, 0.28], c2: [0.8, 0.36], tip: [0.98, 0.42], w: 1 },
    fore: { near: [-0.34, 0.71], far: [-0.28, 0.71] }, foreBend: -1, hind: { near: [0.34, 0.71], far: [0.4, 0.71] } },
  pounce: { ...FOX_STAND, chest: [-0.2, 0.3], hip: [0.18, 0.02], arch: 0.025, head: [-0.42, 0.44, -0.8], ear: 0.45,
    tail: { base: [0.32, -0.02], c1: [0.48, -0.14], c2: [0.64, -0.3], tip: [0.78, -0.46], w: 1 },
    fore: { near: [-0.46, 0.72], far: [-0.4, 0.7] }, hind: { near: [0.52, 0.02], far: [0.48, 0.08] } },
  gulp: { ...FOX_STAND, head: [-0.5, 0.02, -0.2] },
  feed: { ...FOX_STAND, chest: [-0.22, 0.24], head: [-0.58, 0.4, -0.65], ear: 0.45,
    tail: { base: [0.42, 0.12], c1: [0.62, 0.2], c2: [0.8, 0.36], tip: [0.96, 0.5], w: 1 },
    fore: { near: [-0.3, 0.71], far: [-0.22, 0.71] } },
  sleep: { ...FOX_STAND, sleep: true, head: [-0.27, 0.45, -0.32], ear: 0.45, eye: 'shut',          // curled up, the brush round over the nose
    tail: { base: [0.36, 0.5], c1: [0.56, 0.86], c2: [-0.1, 0.9], tip: [-0.58, 0.6], w: 1.05, sink: 0, front: [0.36, 0, 0.16, 0] } },
  hang: { ...FOX_STAND, chest: [-0.01, -0.22], hip: [0.09, 0.28], head: [-0.21, -0.5, -0.25], ear: 0.3,   // by the scruff, which is at 0, -0.4
    tail: { base: [0.15, 0.42], c1: [0.21, 0.62], c2: [0.21, 0.8], tip: [0.15, 0.96], w: 0.95 },
    fore: { near: [-0.17, 0.16], far: [-0.11, 0.2] }, hind: { near: [0.07, 0.75], far: [0.13, 0.77] } },
};
// (tail.sink: how far its root is buried toward the hip; tail.front: wrapped round in front, it's painted again over the
// legs, faded in from the first point to the second, so its root stays behind.)
const FOX_POSE_NAMES = Object.keys(FOX_POSES), FOX_POSE = Object.fromEntries(FOX_POSE_NAMES.map((p, i) => [p, i]));
const foxArtOf = (fur, pose) => 'fox:' + ((Math.round(fur * 10) << 4) + FOX_POSE[pose]);   // a few shades keep the sprite cache small

// The outline round two circles (a tapering limb), added to the path.
function limbAt(g, x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d <= Math.abs(r0 - r1)) { discAt(g, x0, y0, Math.max(r0, r1)); return; }
  const a = Math.atan2(dy, dx), b = Math.acos((r0 - r1) / d);
  g.moveTo(x0 + Math.cos(a + b) * r0, y0 + Math.sin(a + b) * r0);
  g.arc(x0, y0, r0, a + b, a - b + TAU);
  g.arc(x1, y1, r1, a - b, a + b);
  g.closePath();
}
// A leg of two bones, l1 and l2 long, from its top to the paw: where the joint is, bent to side (1: forward). Too far
// for it, it stretches rather than leave the paw in the air.
function jointAt(ax, ay, px, py, l1, l2, side) {
  const dx = px - ax, dy = py - ay, reach = Math.hypot(dx, dy);
  if (reach > (l1 + l2) * 0.999) { const k = reach / (l1 + l2) * 1.001; l1 *= k; l2 *= k; }
  const d = clamp(reach, 1e-4, l1 + l2 - 1e-4), a = Math.atan2(dy, dx) + side * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [ax + Math.cos(a) * l1, ay + Math.sin(a) * l1];
}
const sockAt = (g, x0, y0, kx, ky, paw) => {      // a dark stocking, from partway down the leg to the paw
  limbAt(g, x0, y0, 0.05, kx, ky, 0.046); limbAt(g, kx, ky, 0.046, paw[0], paw[1] - 0.02, 0.04); ovalAt(g, paw[0] - 0.025, paw[1] - 0.012, 0.06, 0.035);
};
const foxPawAt = (g, kx, ky, r, paw) => { limbAt(g, kx, ky, r, paw[0], paw[1] - 0.02, 0.033); ovalAt(g, paw[0] - 0.025, paw[1] - 0.012, 0.05, 0.027); };

// The fox's parts for a pose, back to front. Each: its outline, its markings ([colour, alpha, blur, outline]), and
// casts (a soft shadow on what's behind), far (in the shade, behind), leg (the line above which it melts into the
// body), plain (no form of its own), fade (painted again in front, faded in along that line).
function foxParts(P) {
  const parts = [], add = (path, o = {}) => parts.push({ path, ...o });
  const [hdx, hdy, hda] = P.head, hc = Math.cos(hda) * 1.08, hn = Math.sin(hda) * 1.08;
  const onHead = (x, y) => [hdx + x * hc - y * hn, hdy + x * hn + y * hc];
  const inHead = draw => g => { g.save(); g.translate(hdx, hdy); g.rotate(hda); g.scale(1.08, 1.08); draw(g); g.restore(); };
  const ear = (dx, dy, far) => {                     // grown from behind the crown, so the head covers its root
    const at = draw => inHead(g => { g.translate(dx, dy); g.rotate(P.ear); draw(g); });
    const marks = [[FOX_SOCK, 1, 0.03, at(g => { g.moveTo(-0.2, -0.21); g.lineTo(0.2, -0.25); g.lineTo(0.2, -0.5); g.lineTo(-0.2, -0.5); g.closePath(); })]];
    if (!far) marks.push([FOX_WHITE, 0.75, 0.03, at(g => { g.moveTo(-0.07, -0.06); g.quadraticCurveTo(-0.05, -0.18, -0.025, -0.24); g.quadraticCurveTo(0, -0.16, 0.02, -0.07); g.closePath(); })]);
    add(at(g => { g.moveTo(-0.085, 0); g.quadraticCurveTo(-0.065, -0.24, 0, -0.36); g.quadraticCurveTo(0.085, -0.23, 0.115, 0); g.closePath(); }), { far, marks });
  };
  const ears = () => { ear(0.1, 0.03, true); ear(-0.01, 0, false); };
  const head = () => add(inHead(g => {
    ovalAt(g, 0, 0, 0.17, 0.145);
    g.moveTo(-0.04, 0.13); g.quadraticCurveTo(-0.2, 0.1, -0.33, 0.075); g.quadraticCurveTo(-0.37, 0.055, -0.335, 0.025); g.quadraticCurveTo(-0.22, -0.07, -0.06, -0.09); g.closePath();   // the snout
    ovalAt(g, 0.05, 0.06, 0.14, 0.11, 0.2);                                          // the cheek ruff
  }), { casts: true, marks: [[FOX_WHITE, 1, 0.04, inHead(g => {                    // the white chin and cheek, below the line of the mouth
    g.moveTo(-0.42, 0.05); g.quadraticCurveTo(-0.22, 0.055, -0.1, 0.03); g.quadraticCurveTo(0.06, 0, 0.2, 0.08); g.lineTo(0.22, 0.4); g.lineTo(-0.42, 0.4); g.closePath();
  })]] });
  // the brush: thick at the root, buried in the rump, white at the tip
  const T = P.tail, sink = T.sink ?? 0.4, x0 = lerp(T.base[0], P.hip[0], sink), y0 = lerp(T.base[1], P.hip[1], sink);
  const [x1, y1] = T.c1, [x2, y2] = T.c2, [x3, y3] = T.tip;
  const along = t => { const u = 1 - t; return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]; };
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, [x, y] = along(t), [xa, ya] = along(Math.max(0, t - 0.01)), [xb, yb] = along(Math.min(1, t + 0.01));
    const w = T.w * (t < 0.5 ? lerp(0.085, 0.135, Math.sin(t * Math.PI)) : lerp(0.135, 0.028, ((t - 0.5) / 0.5) ** 1.7)), nl = Math.hypot(yb - ya, xb - xa) || 1;
    top.push([x - (yb - ya) / nl * w, y + (xb - xa) / nl * w]); bot.push([x + (yb - ya) / nl * w, y - (xb - xa) / nl * w]);
  }
  const brush = g => {
    g.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i <= 24; i++) g.lineTo(top[i][0], top[i][1]);
    const [ex, ey] = along(1), [px, py] = along(0.97);
    g.quadraticCurveTo(ex + (ex - px) * 2.5, ey + (ey - py) * 2.5, bot[24][0], bot[24][1]);
    for (let i = 23; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath();
  };
  const [tx, ty] = along(0.84), ta = Math.atan2(y3 - ty, x3 - tx);
  const brushMarks = [[FOX_WHITE, 1, 0.04, g => { g.moveTo(tx, ty); g.ellipse(tx + Math.cos(ta) * 0.2, ty + Math.sin(ta) * 0.2, 0.2, 0.24, ta, Math.PI, Math.PI * 3); }]];
  const behind = () => add(brush, { marks: brushMarks }), wrapped = () => add(brush, { marks: brushMarks, casts: true, fade: T.front });
  if (P.sleep) {
    behind();
    add(g => { ovalAt(g, 0.08, 0.5, 0.42, 0.22); discAt(g, 0.3, 0.45, 0.2); }, { casts: true, marks: [[FOX_SOCK, 1, 0.03, g => ovalAt(g, 0.42, 0.69, 0.07, 0.03)]] });
    ears(); head(); wrapped();
    return { parts, inHead };
  }
  const fore = (paw, far) => {
    const sx = P.chest[0] - 0.02 + (far ? 0.05 : 0), sy = P.chest[1] + 0.04, [kx, ky] = jointAt(sx, sy, paw[0], paw[1], 0.27, 0.22, P.foreBend);
    add(g => { limbAt(g, sx, sy, 0.085, kx, ky, 0.042); foxPawAt(g, kx, ky, 0.042, paw); },
      { far, casts: !far, leg: sy + 0.06, marks: [[FOX_SOCK, 1, 0.035, g => sockAt(g, lerp(sx, kx, 0.5), lerp(sy, ky, 0.5), kx, ky, paw)]] });
  };
  const hind = (paw, far) => {
    const hx = P.hip[0] + (far ? 0.05 : 0), hy = P.hip[1], sx = hx - 0.06, sy = hy + 0.2, [kx, ky] = jointAt(sx, sy, paw[0], paw[1], 0.2, 0.15, -1);   // the stifle forward, the hock back
    add(g => { ovalAt(g, hx - 0.02, hy + 0.08, 0.15, 0.17, 0.25); limbAt(g, sx + 0.02, sy - 0.03, 0.08, kx, ky, 0.04); foxPawAt(g, kx, ky, 0.04, paw); },
      { far, casts: !far, leg: hy + 0.1, marks: [[FOX_SOCK, 1, 0.035, g => sockAt(g, lerp(sx, kx, 0.6), lerp(sy, ky, 0.6), kx, ky, paw)]] });
  };
  const [cx, cy] = P.chest, [hx, hy] = P.hip, len = Math.hypot(hx - cx, hy - cy);
  const ux = (hx - cx) / len, uy = (hy - cy) / len, ang = Math.atan2(uy, ux);   // along the body; (uy, -ux) is up off its back
  fore(P.fore.far, true); hind(P.hind.far, true); behind();
  add(g => {
    ovalAt(g, cx, cy, 0.2, 0.18, ang - 0.1);
    limbAt(g, cx + ux * 0.04, cy + uy * 0.04, 0.165, hx - ux * 0.04, hy - uy * 0.04, 0.15);
    discAt(g, hx, hy - 0.01, 0.17);
    if (P.arch) discAt(g, (cx + hx) / 2 + uy * P.arch, (cy + hy) / 2 - ux * P.arch, 0.15);
  }, { casts: true, marks: [[FOX_WHITE, 1, 0.05, g => ovalAt(g, cx - ux * 0.14 - uy * 0.04, cy - uy * 0.14 + ux * 0.04, 0.09, 0.12, ang + 0.3)]] });   // the white chest
  hind(P.hind.near, false); fore(P.fore.near, false);
  if (T.front) wrapped();
  const [ax, ay] = onHead(0.06, 0.05), [wx, wy] = onHead(-0.04, 0.12);
  add(g => limbAt(g, cx - 0.02, cy - 0.02, 0.16, ax, ay, 0.12),                 // the neck, and its white throat
    { plain: true, marks: [[FOX_WHITE, 1, 0.05, g => limbAt(g, wx, wy, 0.075, lerp(wx, cx - 0.14, 0.7), lerp(wy, cy + 0.03, 0.7), 0.06)]] });
  ears(); head();
  return { parts, inHead };
}

// Scratch canvases for painting one: the fox, a part's shade or light, a part painted apart, the soft outline.
const foxLayers = [];
function foxLayer(i, size, m) {
  const c = foxLayers[i] || (foxLayers[i] = document.createElement('canvas'));
  if (c.width < size || c.height < size) c.width = c.height = Math.max(size, c.width);   // (a new one is 300 by 150)
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, size, size);
  g.setTransform(m); g.lineCap = g.lineJoin = 'round';
  return g;
}
// A soft-edged shape (blurIn), moved by dx, dy.
const softFill = (g, rgb, a, blur, path, dx = 0, dy = 0) => blurIn(g, rgb, a, blur / OTTER_EDGE, path, dx || dy ? g => g.translate(dx, dy) : null);
// Fades what's there along a line, from nothing at its first point to all of it at its second.
function foxFade(g, op, [x0, y0, x1, y1]) {
  const m = g.createLinearGradient(x0, y0, x1, y1);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, '#000');
  g.globalCompositeOperation = op; g.fillStyle = m; g.fillRect(-2, -2, 4, 4);
}

// Painting a fox takes a few times longer than the emoji did, and a dozen poses, cubs growing and zooming all ask
// for new sizes: so it's painted only at doublings of its size (from FOX_PAINTED up), and each size between is the
// painting the next size up, shrunk.
const FOX_PAINTED = 64;
function paintFox(g, size, U, n) {
  const px = U / dpr, painted = Math.max(FOX_PAINTED, 2 ** Math.ceil(Math.log2(px) - 1e-6));
  if (px < painted - 0.5) {
    const m = sprite('fox:' + n, painted);
    g.imageSmoothingQuality = 'high';                                           // (once, not every frame)
    g.drawImage(m.canvas, 0, 0, size, size);
    return;
  }
  const P = FOX_POSES[FOX_POSE_NAMES[n & 15]] || FOX_STAND, coat = foxRGB((n >> 4) / 10);
  const m = new DOMMatrix([U / 2, 0, 0, U / 2, size / 2, size / 2]), { parts, inHead } = foxParts(P);
  const L = foxLayer(0, size, m), T = foxLayer(1, size, m);
  const onto = (from, to) => { to.save(); to.setTransform(1, 0, 0, 1, 0, 0); to.drawImage(from.canvas, 0, 0); to.restore(); };
  const fresh = () => { T.setTransform(1, 0, 0, 1, 0, 0); T.globalCompositeOperation = 'source-over'; T.clearRect(0, 0, size, size); T.setTransform(m); };
  const fur = L.createLinearGradient(0, P.sleep ? 0.26 : Math.min(P.chest[1], P.hip[1]) - 0.2, 0, 0.74);   // one shading, over the whole fox
  fur.addColorStop(0, rockRGB(tone(coat, 1.16, 12))); fur.addColorStop(0.5, rockRGB(coat)); fur.addColorStop(1, rockRGB(tone(coat, 0.72)));
  for (const p of parts) {
    if (p.casts) {                                                              // its soft shadow on what's behind
      fresh();
      softFill(T, FOX_SHADE, 0.32, 0.07, p.path, 0.025, 0.02);
      if (p.leg !== undefined) foxFade(T, 'destination-out', [0, p.leg + 0.12, 0, p.leg - 0.02]);   // a leg's only below the body: above, it rings the leg's top
      if (p.fade) foxFade(T, 'destination-in', p.fade);
      L.save(); L.globalCompositeOperation = 'source-atop'; onto(T, L); L.restore();
    }
    const D = p.fade ? foxLayer(2, size, m) : L;                                 // one that's faded in is painted apart first
    D.fillStyle = fur; D.beginPath(); p.path(D); D.fill();
    D.save(); D.beginPath(); p.path(D); D.clip();
    for (const [rgb, a, b, path] of p.marks || []) { softFill(D, rgb, a, b * 0.5, path); softFill(D, rgb, a, b * 0.3, path); }   // twice: solid, soft only at the rim
    D.restore();
    if (!p.plain) {                                                             // its form, inside its outline: shade along the underside...
      fresh();
      T.fillStyle = rockRGB(FOX_SHADE, p.far ? 0.55 : 0.32); T.beginPath(); p.path(T); T.fill();
      T.globalCompositeOperation = 'destination-out';
      softFill(T, [0, 0, 0], 1, 0.09, p.path, -0.015, -0.05);
      if (p.leg !== undefined) foxFade(T, 'destination-out', [0, p.leg + 0.14, 0, p.leg - 0.04]);   // (a leg's top melts into the body)
      onto(T, D);
      if (!p.far && p.leg === undefined) {                                      // ...and light along the top
        fresh();
        T.fillStyle = rockRGB(FOX_LIGHT, 0.32); T.beginPath(); p.path(T); T.fill();
        T.globalCompositeOperation = 'destination-out';
        softFill(T, [0, 0, 0], 1, 0.08, p.path, 0.01, 0.045);
        onto(T, D);
      }
    }
    if (p.fade) { foxFade(D, 'destination-in', p.fade); onto(D, L); }
  }
  inHead(g => {                                                                 // the face, crisp
    fillIn(g, '#2a211d', () => discAt(g, -0.34, 0.045, 0.03));
    fillIn(g, 'rgba(255,255,255,0.35)', () => ovalAt(g, -0.345, 0.033, 0.012, 0.007));
    if (P.eye === 'shut') strokeIn(g, '#3a2a22', 0.03, () => { g.moveTo(-0.15, -0.02); g.quadraticCurveTo(-0.1, 0.015, -0.04, -0.015); });
    else {
      fillIn(g, '#241a16', () => ovalAt(g, -0.1, -0.025, 0.036, 0.03, -0.2));
      fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, -0.112, -0.038, 0.011));
    }
    strokeIn(g, rockRGB(tone(coat, 0.55), 0.6), 0.016, () => { g.moveTo(-0.32, 0.075); g.quadraticCurveTo(-0.25, 0.085, -0.19, 0.07); });   // the mouth
  })(L);
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-atop';   // a faint grain of fur
  const r = Math.max(0.7, size / 220);
  let seed = 12345;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (const ink of ['rgba(60,25,10,0.035)', 'rgba(255,240,215,0.035)']) {
    L.strokeStyle = ink; L.lineWidth = r; L.beginPath();
    for (let i = size * size / 180; i > 0; i--) { const x = rnd() * size, y = rnd() * size; L.moveTo(x, y); L.lineTo(x + r * 6, y + r * 1.2); }
    L.stroke();
  }
  L.restore();
  const S = foxLayer(3, size, new DOMMatrix());                                 // onto the sprite, its outline a little soft:
  S.drawImage(L.canvas, 0, 0, size, size, 0, 0, size / 2, size / 2);           // a half-size copy, stretched back, under it
  S.globalCompositeOperation = 'copy';
  S.drawImage(S.canvas, 0, 0, size / 2, size / 2, 0, 0, size, size);
  S.globalCompositeOperation = 'source-atop';
  S.drawImage(L.canvas, 0, 0, size, size, 0, 0, size, size);
  g.drawImage(S.canvas, 0, 0, size, size, 0, 0, size, size);
}

// Which painting, for what the fox is doing. On the move its legs step by where it is (like the otter's), so they
// stop when it stops; standing still a while in a mode that moves, it just stands.
const FOX_STRIDE = 0.2;              // of its size, a step of the trot (a gallop's is longer)
const foxStill = new WeakMap();      // { x, y, frames } since it last moved
function foxArt(c, px) {
  const art = pose => foxArtOf(c.genes.fur, pose);
  if (c.sleeping) return art('sleep');
  if (c.mode === 'pounce' || c.mode === 'gulp') return art(c.mode);
  if (c.mode === 'eat') return art('feed');
  if (c.mode === 'rest' || c.mode === 'tired') return art('sit');
  if (crouching(c)) return art('crouch');                                       // mousing: it crouches to leap
  let s = foxStill.get(c);
  if (!s) foxStill.set(c, s = { x: c.x, y: c.y, frames: 99 });
  if (s.x !== c.x || s.y !== c.y) { s.x = c.x; s.y = c.y; s.frames = 0; } else s.frames++;
  if (ui.speed > 0 && s.frames < 12 && (MOVING.has(c.mode) || c.mode === 'mouse')) {
    const fast = c.mode === 'chase' || c.mode === 'flee', k = cam.zoom / (px * FOX_STRIDE * (fast ? 1.6 : 1));
    const step = (Math.floor(c.x * k) + Math.floor(c.y * k)) & 1;
    return art(fast ? (step ? 'run1' : 'run2') : (step ? 'trot1' : 'trot2'));
  }
  return art('stand');
}

const moundAt = (g, hole) => {
  fillIn(g, '#a7784c', () => { g.moveTo(-0.95, 0.55); g.ellipse(0, 0.55, 0.95, 0.8, 0, Math.PI, TAU); g.closePath(); });
  fillIn(g, '#c09063', () => { g.moveTo(-0.7, 0.1); g.quadraticCurveTo(-0.4, -0.25, 0, -0.25); g.quadraticCurveTo(-0.45, -0.05, -0.55, 0.3); g.closePath(); });
  if (hole) fillIn(g, '#3a2616', () => { g.moveTo(-0.42, 0.55); g.ellipse(0, 0.55, 0.42, 0.34, 0, Math.PI, TAU); g.closePath(); });
};
const BUBBLE_ICONS = [
  ['💕', g => { fillIn(g, '#e8506e', () => heartAt(g, -0.18, 0.12, 0.62)); fillIn(g, '#f58aa2', () => heartAt(g, 0.52, -0.45, 0.32)); }],
  ['😋', g => {                                          // grazing: a leaf
    g.rotate(-0.6);
    fillIn(g, '#5f9e3c', () => { g.moveTo(0, -1); g.quadraticCurveTo(0.85, -0.2, 0, 1); g.quadraticCurveTo(-0.85, -0.2, 0, -1); });
    fillIn(g, '#86c057', () => { g.moveTo(0, -1); g.quadraticCurveTo(-0.85, -0.2, 0, 1); g.closePath(); });
    strokeIn(g, '#3f7a2a', 0.09, () => { g.moveTo(0, -0.75); g.lineTo(0, 1.15); });
  }],
  ['🌿', g => {                                          // off to better grass: a tuft
    for (const [a, c, l] of [[-0.5, '#6aa84a', 1.3], [0.45, '#5f9e3c', 1.2], [0, '#86c057', 1.6]]) {
      strokeIn(g, c, 0.26, () => { g.moveTo(0, 0.9); g.quadraticCurveTo(a * 0.3, 0.9 - l * 0.6, a * 1.3, 0.9 - l); });
    }
  }],
  ['🍎', g => {
    fillIn(g, '#c92e26', () => { discAt(g, -0.28, 0.15, 0.62); discAt(g, 0.28, 0.15, 0.62); });
    fillIn(g, '#ec6a5a', () => ovalAt(g, -0.38, -0.08, 0.2, 0.26, 0.4));
    strokeIn(g, '#6b4226', 0.12, () => { g.moveTo(0, -0.38); g.lineTo(0.08, -0.85); });
    fillIn(g, '#6aa84a', () => ovalAt(g, 0.36, -0.72, 0.28, 0.13, -0.45));
  }],
  ['🐾', g => pawAt(g, 0, 0.05, 1)],
  ['🐟', g => troutAt(g, -0.95, 0.12, 1.9, -0.18)],   // an otter's fish
  ['🤝', g => { pawAt(g, -0.42, 0.25, 0.62); pawAt(g, 0.45, -0.2, 0.55); }],   // with friends: two paws
  ['👀', g => {
    for (const x of [-0.4, 0.4]) {
      fillIn(g, '#ffffff', () => ovalAt(g, x, 0, 0.34, 0.46));
      strokeIn(g, '#3b372f', 0.08, () => ovalAt(g, x, 0, 0.34, 0.46));
      fillIn(g, '#2d261e', () => discAt(g, x + 0.13, 0.06, 0.16));
    }
  }],
  ['💨', g => {
    for (const [y, l, x0] of [[-0.5, 1.2, -0.6], [0, 1.7, -0.95], [0.5, 1.1, -0.45]]) {
      strokeIn(g, '#8fa9bf', 0.17, () => { g.moveTo(x0, y); g.quadraticCurveTo(x0 + l * 0.6, y - 0.12, x0 + l, y + 0.05); });
    }
  }],
  ['🍖', g => {
    strokeIn(g, '#efe4cf', 0.24, () => { g.moveTo(0.2, -0.2); g.lineTo(0.7, -0.7); });
    fillIn(g, '#efe4cf', () => { discAt(g, 0.64, -0.86, 0.16); discAt(g, 0.86, -0.64, 0.16); });
    fillIn(g, '#a9552a', () => ovalAt(g, -0.18, 0.22, 0.66, 0.47, -Math.PI / 4));
    fillIn(g, '#d17d48', () => ovalAt(g, -0.3, 0.08, 0.34, 0.2, -Math.PI / 4));
  }],
  ['💤', g => {
    strokeIn(g, '#6a8fc7', 0.17, () => { g.moveTo(-0.7, -0.05); g.lineTo(0.05, -0.05); g.lineTo(-0.7, 0.7); g.lineTo(0.05, 0.7); });
    strokeIn(g, '#8fb0dc', 0.13, () => { g.moveTo(0.25, -0.8); g.lineTo(0.72, -0.8); g.lineTo(0.25, -0.3); g.lineTo(0.72, -0.3); });
  }],
  ['🏠', g => {                                          // heading home: the burrow
    moundAt(g, true);
    strokeIn(g, '#6aa84a', 0.1, () => { for (const x of [-0.5, -0.35, 0.45, 0.6]) { g.moveTo(x, -0.05 - Math.abs(x) * 0.1); g.lineTo(x + 0.08, -0.35); } });
  }],
  ['🕳️', g => {                                          // digging: a hole, earth flying
    fillIn(g, '#a7784c', () => ovalAt(g, 0, 0.5, 0.8, 0.36));
    fillIn(g, '#3a2616', () => ovalAt(g, 0, 0.52, 0.55, 0.24));
    fillIn(g, '#8a6038', () => { for (const [x, y, r] of [[-0.55, -0.15, 0.12], [-0.12, -0.55, 0.14], [0.35, -0.3, 0.11], [0.62, -0.72, 0.09]]) discAt(g, x, y, r); });
  }],
  ['🫣', g => {                                          // hiding: ears out of the hole
    moundAt(g, false);
    fillIn(g, '#3a2616', () => ovalAt(g, 0, -0.12, 0.4, 0.15));
    fillIn(g, '#c9a27e', () => { ovalAt(g, -0.16, -0.5, 0.11, 0.4, -0.15); ovalAt(g, 0.16, -0.5, 0.11, 0.4, 0.15); });
    fillIn(g, '#e9b8b0', () => { ovalAt(g, -0.16, -0.52, 0.05, 0.26, -0.15); ovalAt(g, 0.16, -0.52, 0.05, 0.26, 0.15); });
  }],
  ['🌧️', g => {
    fillIn(g, '#aebccb', () => { discAt(g, -0.42, -0.05, 0.36); discAt(g, 0.02, -0.3, 0.46); discAt(g, 0.44, -0.05, 0.36); g.rect(-0.42, -0.05, 0.86, 0.36); });
    fillIn(g, '#c9d4de', () => { discAt(g, -0.05, -0.38, 0.3); discAt(g, -0.45, -0.1, 0.22); });
    fillIn(g, '#5c9bd6', () => { for (const [x, y] of [[-0.4, 0.6], [0.05, 0.78], [0.45, 0.58]]) ovalAt(g, x, y, 0.08, 0.16, 0.3); });
  }],
  ['‼️', g => {
    for (const x of [-0.3, 0.3]) {
      strokeIn(g, '#d9372b', 0.28, () => { g.moveTo(x, -0.75); g.lineTo(x, 0.22); });
      fillIn(g, '#d9372b', () => discAt(g, x, 0.66, 0.16));
    }
  }],
  ['😱', g => {                                          // running from a fox: the fox
    fillIn(g, '#e2702f', () => {
      g.moveTo(-0.85, -0.4); g.lineTo(-0.7, -1); g.lineTo(-0.3, -0.55); g.lineTo(0.3, -0.55); g.lineTo(0.7, -1); g.lineTo(0.85, -0.4);
      g.quadraticCurveTo(0.7, 0.3, 0, 0.85); g.quadraticCurveTo(-0.7, 0.3, -0.85, -0.4);
    });
    fillIn(g, '#fbf3e6', () => { g.moveTo(-0.62, 0.05); g.quadraticCurveTo(-0.2, 0.05, 0, 0.85); g.quadraticCurveTo(0.2, 0.05, 0.62, 0.05); g.quadraticCurveTo(0.5, 0.45, 0, 0.85); g.quadraticCurveTo(-0.5, 0.45, -0.62, 0.05); });
    fillIn(g, '#2d261e', () => { discAt(g, 0, 0.78, 0.1); ovalAt(g, -0.3, -0.15, 0.08, 0.11); ovalAt(g, 0.3, -0.15, 0.08, 0.11); });
  }],
  ['🔥', g => {
    const flame = (s, dy) => { g.moveTo(0, -1 * s + dy); g.bezierCurveTo(0.35 * s, -0.45 * s + dy, 0.8 * s, -0.1 * s + dy, 0.7 * s, 0.35 * s + dy);
      g.bezierCurveTo(0.6 * s, 0.85 * s + dy, -0.6 * s, 0.85 * s + dy, -0.7 * s, 0.35 * s + dy); g.bezierCurveTo(-0.8 * s, -0.1 * s + dy, -0.2 * s, -0.3 * s + dy, 0, -1 * s + dy); };
    fillIn(g, '#e8602c', () => flame(1, 0.05));
    fillIn(g, '#f6b93b', () => flame(0.58, 0.38));
  }],
  ['⚡', g => {
    const bolt = () => { g.moveTo(0.2, -1); g.lineTo(-0.5, 0.15); g.lineTo(-0.02, 0.15); g.lineTo(-0.25, 1); g.lineTo(0.55, -0.25); g.lineTo(0.08, -0.25); g.lineTo(0.35, -1); g.closePath(); };
    fillIn(g, '#c9951a', () => { g.translate(0.05, 0.05); bolt(); g.translate(-0.05, -0.05); });
    fillIn(g, '#f2c230', bolt);
  }],
  ['🧳', g => {                                          // moving in: a bundle on a stick
    strokeIn(g, '#7a5232', 0.12, () => { g.moveTo(-0.85, 0.85); g.lineTo(0.55, -0.6); });
    fillIn(g, '#d9483b', () => discAt(g, 0.35, -0.3, 0.45));
    fillIn(g, '#fbe9e2', () => { for (const [x, y] of [[0.2, -0.45], [0.5, -0.2], [0.25, -0.05], [0.55, -0.55]]) discAt(g, x, y, 0.07); });
    fillIn(g, '#b8352b', () => { ovalAt(g, 0.55, -0.75, 0.13, 0.22, 0.6); ovalAt(g, 0.72, -0.62, 0.13, 0.2, 1.3); });
  }],
  ['😮‍💨', g => {                                          // out of breath: a puff and a drop
    fillIn(g, '#dfe6ec', () => { discAt(g, 0.15, 0.25, 0.32); discAt(g, 0.5, 0.05, 0.26); discAt(g, 0.78, 0.3, 0.2); });
    fillIn(g, '#6db0e0', () => { g.moveTo(-0.45, -0.8); g.quadraticCurveTo(-0.15, -0.3, -0.15, -0.1); g.arc(-0.45, -0.1, 0.3, 0, Math.PI); g.quadraticCurveTo(-0.75, -0.3, -0.45, -0.8); });
  }],
  ['🍼', g => {                                          // following mum: milk
    fillIn(g, '#e8a25a', () => { g.moveTo(-0.2, -0.45); g.quadraticCurveTo(-0.2, -0.95, 0, -0.95); g.quadraticCurveTo(0.2, -0.95, 0.2, -0.45); });
    fillIn(g, '#fdfaf3', () => g.roundRect(-0.36, -0.38, 0.72, 1.28, 0.2));
    strokeIn(g, '#9aa7b4', 0.07, () => g.roundRect(-0.36, -0.38, 0.72, 1.28, 0.2));
    fillIn(g, '#7fb3d9', () => g.rect(-0.42, -0.5, 0.84, 0.16));
    strokeIn(g, '#9aa7b4', 0.06, () => { for (const y of [0.1, 0.35, 0.6]) { g.moveTo(0.1, y); g.lineTo(0.3, y); } });
  }],
  ['😌', g => {                                          // relaxing
    fillIn(g, '#f4c64e', () => discAt(g, 0, 0, 0.88));
    fillIn(g, '#f19a7e', () => { ovalAt(g, -0.5, 0.2, 0.16, 0.1); ovalAt(g, 0.5, 0.2, 0.16, 0.1); });
    strokeIn(g, '#6b4a1e', 0.1, () => { g.arc(-0.32, -0.12, 0.17, 0.15, Math.PI - 0.15); g.moveTo(0.49, -0.1); g.arc(0.32, -0.12, 0.17, 0.15, Math.PI - 0.15); g.moveTo(0.28, 0.32); g.arc(0, 0.2, 0.3, 0.4, Math.PI - 0.4); });
  }],
  ['🤒', g => {                                          // sick: a thermometer, running hot
    g.rotate(0.45);
    const glass = e => { g.roundRect(-0.21 - e, -0.95 - e, 0.42 + 2 * e, 1.45 + e, 0.21 + e); discAt(g, 0, 0.55, 0.33 + e); };
    fillIn(g, '#8d8a84', () => glass(0.08));
    fillIn(g, '#fbf8f1', () => glass(0));
    fillIn(g, '#d9372b', () => { discAt(g, 0, 0.55, 0.22); g.rect(-0.08, -0.5, 0.16, 1.05); });
    strokeIn(g, '#8d8a84', 0.06, () => { for (const y of [-0.72, -0.48, -0.24, 0]) { g.moveTo(0.21, y); g.lineTo(0.1, y); } });
  }],
  ['🥺', g => {                                          // hungry: an empty bowl
    fillIn(g, '#b07a4a', () => { g.moveTo(-0.88, 0); g.ellipse(0, 0, 0.88, 0.7, 0, Math.PI, 0, true); g.closePath(); });
    fillIn(g, '#8a5a34', () => ovalAt(g, 0, 0, 0.88, 0.24));
    fillIn(g, '#5e3c22', () => ovalAt(g, 0, 0.02, 0.72, 0.16));
    fillIn(g, '#c99467', () => ovalAt(g, -0.45, 0.35, 0.16, 0.1, 0.3));
  }],
  ['🐁', voleAt],                                       // mousing: a vole
  ['🐸', g => frogAt(g)],                               // a frog (a fox or an owl after them)
  ['🫧', spawnAt],                                      // frogspawn (a crow at it)
  ['🪱', g => {                                          // a crow pecking for grubs: a worm
    strokeIn(g, '#d88a86', 0.32, () => { g.moveTo(-0.72, 0.42); g.bezierCurveTo(-0.45, -0.35, -0.05, 0.75, 0.3, 0.02); g.quadraticCurveTo(0.48, -0.36, 0.74, -0.3); });
    strokeIn(g, '#e8a8a2', 0.3, () => { g.moveTo(-0.18, 0.3); g.lineTo(-0.02, 0.36); });
    fillIn(g, '#3a2a26', () => discAt(g, 0.66, -0.36, 0.05));
  }],
  ['🌰', g => {                                          // an acorn (a crow's, a rabbit's)
    fillIn(g, '#b8843e', () => ovalAt(g, 0, 0.2, 0.5, 0.62));
    fillIn(g, '#d4a45e', () => ovalAt(g, -0.18, 0.28, 0.12, 0.3, 0.2));
    fillIn(g, '#7a5a32', () => { g.moveTo(-0.64, -0.12); g.quadraticCurveTo(0, -0.78, 0.64, -0.12); g.quadraticCurveTo(0, 0.02, -0.64, -0.12); });
    strokeIn(g, '#5e4222', 0.12, () => { g.moveTo(0, -0.42); g.lineTo(0.1, -0.78); });
  }],
  ['🪺', g => {                                          // the nest
    fillIn(g, '#8fc4c0', () => { ovalAt(g, -0.3, -0.08, 0.2, 0.26, -0.2); ovalAt(g, 0.08, -0.14, 0.2, 0.26); ovalAt(g, 0.4, -0.04, 0.18, 0.24, 0.3); });
    fillIn(g, '#8a6a42', () => { g.moveTo(-0.85, 0); g.quadraticCurveTo(0, 0.2, 0.85, 0); g.quadraticCurveTo(0.7, 0.7, 0, 0.72); g.quadraticCurveTo(-0.7, 0.7, -0.85, 0); });
    strokeIn(g, '#6a4e2c', 0.07, () => { for (const y of [0.18, 0.36, 0.52]) { g.moveTo(-0.72, y); g.quadraticCurveTo(0, y + 0.14, 0.72, y); } });
  }],
];
const BUBBLE_ART = new Map(BUBBLE_ICONS.map(([e], i) => [e, 'bubble:' + i]));

function drawBubble(emoji, sx, sy, px, important) {
  const r = Math.max(9, px * 0.4);                       // a bit big for the animal, so it reads
  const bx = sx + px * 0.38, by = sy - px * 0.62 - r * 0.4;
  const art = BUBBLE_ART.get(emoji);
  if (art) {
    const want = r / BUBBLE_R, s = sprite(art, want);
    if (!important) ctx.globalAlpha = 0.92;
    ctx.drawImage(s.canvas, bx - BUBBLE_AT[0] * want - s.size / 2, by - BUBBLE_AT[1] * want - s.size / 2, s.size, s.size);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = important ? '#fffaf0' : 'rgba(255, 250, 240, 0.9)';
  ctx.strokeStyle = 'rgba(80, 60, 30, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, TAU);
  ctx.moveTo(bx - r * 0.5, by + r * 0.75);
  ctx.lineTo(bx - r * 0.9, by + r * 1.3);
  ctx.lineTo(bx - r * 0.05, by + r * 0.95);
  ctx.fill(); ctx.stroke();
  drawEmoji(emoji, bx, by, r * 1.3, { center: true });
}

function drawLabel(text, x, y, ring = false) {
  ctx.font = '800 12px Nunito, ui-rounded, system-ui, sans-serif';
  const tw = ctx.measureText(text).width, w = tw + 16 + (ring ? 15 : 0);
  ctx.fillStyle = 'rgba(255, 250, 240, 0.95)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 22, 11); ctx.fill();
  if (ring) ctx.drawImage(RING, x - w / 2 + 7, y + 4, 14, 14);
  ctx.fillStyle = '#3b372f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (ring ? 7.5 : 0), y + 11.5);
}

// Yours wear a little brass ring, like a ringed bird: in their label, and as a thin band on the ground
// under them, so you can pick them out of a crowd. Painted once.
const RING = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 28;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(14, 14, 9, 0, TAU);
  g.lineWidth = 6; g.strokeStyle = '#7a5a1e'; g.stroke();
  g.lineWidth = 3.5; g.strokeStyle = '#d9a640'; g.stroke();
  g.beginPath(); g.arc(14, 14, 9, -2.7, -1.3);
  g.lineWidth = 1.5; g.strokeStyle = '#fff1c2'; g.stroke();
  return c;
})();
function drawRingUnder(c, sx, sy) {
  const px = creaturePx(c);
  if (px < 10) return;
  const r = Math.max(7, px * 0.38), lw = Math.max(1.5, px * 0.05);
  ctx.beginPath(); ctx.ellipse(sx, sy + px * 0.3, r, r * 0.4, 0, 0, TAU);
  ctx.lineWidth = lw + 2; ctx.strokeStyle = 'rgba(92, 66, 20, 0.7)'; ctx.stroke();
  ctx.lineWidth = lw; ctx.strokeStyle = '#e0ad45'; ctx.stroke();
}

function drawSelectionUnder(c, now) {
  if (!c.alive) return;
  const [sx, sy] = screenOf(c);
  const z = cam.zoom;
  // Where it has been.
  if (ui.trail.length > 1) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < ui.trail.length; i++) {
      const a = toScreen(ui.trail[i - 1].x, ui.trail[i - 1].y), b = toScreen(ui.trail[i].x, ui.trail[i].y);
      ctx.strokeStyle = `rgba(255, 250, 235, ${0.65 * i / ui.trail.length})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
  }
  // How far it can see.
  if (!c.hidden && !c.held) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, c.sight * z, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const pulse = 1 + 0.08 * Math.sin(now / 250);
  const r = Math.max(12, creaturePx(c) * 0.55) * pulse;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(sx, sy + creaturePx(c) * 0.3, r, r * 0.4, 0, 0, TAU); ctx.stroke();
}

function drawSelectionOver(c, now) {
  if (!c.alive) return;
  const [sx, sy] = screenOf(c);
  const other = world.byId.get(c.mode === 'flee' || c.mode === 'alarm' ? c.threatId : c.targetId);
  if (other && other.alive && ['flee', 'alarm', 'chase', 'stalk', 'love'].includes(c.mode)) {
    const [ox, oy] = toScreen(other.x, other.y);
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = c.mode === 'love' ? '#ff7aa8' : c.mode === 'flee' || c.mode === 'alarm' ? '#ff5a4a' : '#ffb13b';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.restore();
  }
  if (c.held && held) { const [hx, hy] = heldAt(held, now); drawLabel(c.name, hx, hy + creaturePx(c) * 0.55 + 6, c.mine); return; }
  const label = c.hidden ? `${c.name} is ${c.species === 'crow' ? 'in the nest' : c.species === 'owl' ? 'in the hollow' : c.species === 'otter' ? 'in the holt' : `inside the ${c.species === 'bee' ? 'hive' : 'burrow'}`}` : c.name;
  drawLabel(label, sx, sy + (c.hidden ? cam.zoom : creaturePx(c) * 0.55) + 6, c.mine);
}

// Where the sun is: shadows lean west in the morning and east in the evening,
// and fade at night and under cloud.
function sun(ck) {
  const m = ui.sky.mix;
  const cover = clamp(0.5 * m.cloudy + 0.7 * m.rain + 0.9 * m.storm + 0.8 * m.fog + 0.5 * m.snow, 0, 0.85);
  return { lean: clamp((ck.phase - 0.36) / 0.34, -1, 1), a: (1 - 1.6 * darkness(ck.phase)) * (1 - cover) };
}

// Trees and rocks cast a soft shadow, a cool green-blue, painted once and stretched under each.
let SOFT_SHADOW = (() => {                // (an ImageBitmap once it's ready: asBitmap)
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(24, 48, 44, 1)'); r.addColorStop(0.5, 'rgba(24, 48, 44, 0.85)'); r.addColorStop(1, 'rgba(24, 48, 44, 0)');
  g.scale(1, 0.5); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
})();
asBitmap(SOFT_SHADOW, b => { SOFT_SHADOW = b; });
// A tree also keeps a dark patch at its foot, day and night, so it stands on the ground.
function drawDecorShadow(d, sx, sy, sn) {
  if (treeWaits.get(d) === 0) return;                      // not drawn yet (drawPaintedTree)
  if (d.tree && d.size < S.SAPLING && !d.stump && (d.size < S.SEEDLING || d.size * cam.zoom < 20)) return;   // too small for one
  if (d.fallen) {                                         // a log: along it
    const s = treePx(d);
    ctx.globalAlpha = 0.35 + 0.2 * Math.max(0, sn.a);
    ctx.drawImage(SOFT_SHADOW, sx - s * 0.5, sy - s * 0.05, s, s * 0.12);
    ctx.globalAlpha = 1;
    return;
  }
  const tree = d.tree && !d.stump, s = (d.tree ? treePx(d) : d.size * cam.zoom) * (d.stump ? 0.45 : d.dead ? 0.6 : 1);
  if (tree) {
    const cw = s * 0.2, ch = s * 0.06;
    ctx.globalAlpha = 0.4 + 0.25 * Math.max(0, sn.a);
    ctx.drawImage(SOFT_SHADOW, sx - cw, sy - ch * 0.8, cw * 2, ch * 2);
    ctx.globalAlpha = 1;
  }
  if (sn.a <= 0.02) return;
  const w = s * (d.tree ? 0.34 : 0.42), h = s * 0.12, off = sn.lean * s * 0.22;
  const W = (w + Math.abs(off) * 0.6) * 2.5, H = h * 2.6;   // the soft edge takes a bit off, so a bit bigger
  ctx.globalAlpha = (tree ? 0.55 : 0.3) * sn.a;
  ctx.drawImage(SOFT_SHADOW, sx + off - W / 2, sy + h * 0.4 - H / 2, W, H);
  ctx.globalAlpha = 1;
}

// Animals lean their shadow with the sun like the trees do, and keep a faint one at their feet
// at night and under cloud so they never float. A hop lifts them off it and it shrinks, less for a
// pouncing fox than a flier, so the leap reads.
function drawCreatureShadow(c, sx, sy, now, sn) {
  if (wading(c)) return;
  const px = creaturePx(c), lift = c.held ? 0.55 : 1 - Math.min(c.sp.flies ? 0.8 : 0.5, liftOf(c, px, now) / px);
  const a = 0.14 + 0.16 * Math.max(0, sn.a), off = Math.max(0, sn.a) * sn.lean * px * 0.2;
  ctx.fillStyle = `rgba(40, 50, 20, ${a * lift})`;
  ctx.beginPath();
  ctx.ellipse(sx + off, sy + px * 0.36, (px * 0.34 + Math.abs(off) * 0.6) * lift, px * 0.1 * lift, 0, 0, TAU);
  ctx.fill();
}

// Trees sway from the trunk. Gusts roll across the meadow, harder in rain and storms.
function treeSway(d, now) {
  const m = ui.sky.mix, wind = 0.018 + 0.01 * m.cloudy + 0.03 * m.rain + 0.07 * m.storm;
  return wind * (Math.sin(now / 900 - d.x * 0.15) + 0.35 * Math.sin(now / 340 + d.y));
}

// The trees follow real ones, loosely. Broadleaf 🌳: in autumn the green drains away and each
// tree shows its kind's colour (the sim says which kind, plantTrees): gold (birch, willow), orange
// (beech), red (maple) or russet (oak, hawthorn). Then the leaves drop and it stands bare, except the oaks, which hold on to their dry
// brown leaves all winter. In spring they leaf out lime green. Pines 🌲 stay green, but not
// quite the same green: old inner needles yellow in autumn, the whole tree bronzes a little in
// the cold, and new tips come in light at the end of spring. Snow settles on top of them all.
// Some broadleaf trees are fruit trees, mostly out in the open (sim.js, plantTrees). An apple tree flowers
// white in spring, hangs apples from high summer and drops windfalls in autumn. A cherry comes
// into leaf pink, a cloud of blossom that turns green and sheds petals, then cherries in early
// summer and red leaves in autumn. No two broadleaf trees are quite the same green, and half of
// all trees are drawn mirrored.
const AUTUMN = { birch: [238, 192, 56], willow: [238, 192, 56], beech: [240, 130, 40], maple: [200, 50, 42], oak: [176, 100, 52], hawthorn: [176, 100, 52] };
const DRY = [160, 120, 80], SPRING = [156, 214, 84];
const OLD_NEEDLES = [214, 180, 64], BRONZE = [128, 118, 62], CANDLES = [176, 226, 100];
const GREEN = [88, 152, 60], APPLE_WHITE = [255, 240, 244], CHERRY_PINK = [255, 176, 206];
const FRUIT = {
  apple: { e: '🍎', autumn: [196, 176, 64] },
  cherry: { e: '🍒', autumn: [214, 70, 48] },
};
// Older systems have no 🪾; there every broadleaf keeps its dry leaves through winter, like an oak.
const HAS_BARE = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = `28px ${EMOJI_FONT}`; g.textBaseline = 'middle'; g.fillText('🪾', 2, 16);
  const d = g.getImageData(0, 0, 32, 32).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] - d[i + 2] > 30) n++;
  return n > 20;                                         // brown bark, not a blank box
})();
const step = (v, n) => Math.round(clamp(v, 0, 1) * n) / n;   // a few steps keep the sprite cache small
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// What a tree is, worked out once from where it stands.
const treeInfos = new WeakMap();
function treeInfo(d) {
  let t = treeInfos.get(d);
  if (t) return t;
  const hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100);
  t = {
    h: Math.abs(Math.floor(d.x * 7.3 + d.y * 13.1)),
    fruit: d.fruit || '',                                 // the sim says which (plantTrees)
    kind: d.kind || (d.emoji === '🌲' ? 'pine' : 'oak'),
    flip: hash2(hx, hy, 43) < 0.5,
    green: GREEN.map((v, k) => v + Math.round((hash2(hx, hy, 44) - 0.5) * 4) * [7, 4, -4][k]),
  };
  treeInfos.set(d, t);
  return t;
}

function treeLook(d, ck) {
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS, s = ck.season;
  const info = treeInfo(d), h = info.h, lag = (h % 5) * 0.04;
  let rgb = SPRING, m = 0, where = '', fall = 0, drop = 0, blossom = 0, bloom = APPLE_WHITE, fruit = null, ground = null;
  if (d.emoji === '🌲') {
    const a = 0.6 + 0.2 * (h % 3);                       // some pines turn more than others
    if (s === 2) { rgb = OLD_NEEDLES; m = 0.7 * a * Math.sin(Math.PI * sp); where = 'dark'; }
    else if (s === 3 || (s === 0 && sp < 0.4)) { rgb = BRONZE; m = 0.45 * a * (s === 3 ? clamp(sp / 0.25, 0, 1) : 1 - sp / 0.4); }
    else { rgb = CANDLES; m = 0.6 * (s === 0 ? clamp((sp - 0.4) / 0.4, 0, 1) : 1 - clamp(sp / 0.5, 0, 1)); where = 'light'; }
  } else {
    // Broadleaf leaves are always repainted, from the tree's own green.
    const kind = FRUIT[info.fruit], green = info.green, n = Math.round(clamp(d.size * cam.zoom / 11, 2, 9));
    const hue = kind ? kind.autumn : AUTUMN[info.kind], oak = info.kind === 'oak' || !HAS_BARE;
    m = 1;
    if (s === 2) {
      const turn = clamp((sp - 0.05 - lag) / 0.4, 0, 1);
      rgb = mix(mix(green, hue, turn), DRY, clamp((sp - 0.65 - lag) / 0.35, 0, 1) * (oak ? 1 : 0.5));
      fall = oak ? 0 : clamp((sp - 0.6 - lag) / 0.35, 0, 1);
      drop = clamp(turn * 1.5 - 0.4, 0, 1) * (1 - fall * fall) * (oak ? 0.3 : 1);
      if (info.fruit === 'apple') {
        if (sp < 0.4) fruit = { e: kind.e, n: Math.ceil(n * (1 - sp / 0.4)) };
        ground = { e: kind.e, n: d.windfall, size: 0.12 };        // the sim's windfalls (windfallTick)
      } else if (d.windfall) ground = { e: '🌰', n: d.windfall, size: 0.07 };   // acorns or beechnuts, in a mast year
    } else if (s === 3) { rgb = DRY; fall = oak ? 0 : 1; }
    else if (s === 0) {
      rgb = mix(oak ? mix(DRY, SPRING, clamp(sp / 0.3, 0, 1)) : SPRING, green, clamp((sp - 0.35) / 0.45, 0, 1));
      fall = oak ? 0 : 1 - clamp((sp - lag) / 0.35, 0, 1);
      if (info.fruit === 'cherry') {                     // all pink, then the pink breaks up over green
        if (sp < 0.5 + lag) rgb = CHERRY_PINK;
        else { blossom = 1 - clamp((sp - 0.5 - lag) / 0.3, 0, 1); bloom = CHERRY_PINK; }
        if (sp > 0.4) ground = { e: '🌸', n: Math.round(6 * Math.sin(Math.PI * clamp((sp - 0.4) / 0.45, 0, 1))), size: 0.08 };
      }
      if (info.fruit === 'apple') blossom = Math.sin(Math.PI * clamp((sp - 0.3 - lag) / 0.5, 0, 1));
    } else {
      rgb = green;
      if (info.fruit === 'apple' && sp > 0.3) fruit = { e: kind.e, n: Math.ceil(n * clamp((sp - 0.3) / 0.2, 0, 1)) };
      if (info.fruit === 'cherry' && sp < 0.7) fruit = { e: kind.e, n: Math.ceil(n * clamp((0.7 - sp) / 0.2, 0, 1)) };
    }
    if (d.size * cam.zoom < 18) fruit = null;            // too small to see
  }
  rgb = rgb.map(v => Math.round(v / 8) * 8);
  m = step(m, 8); fall = step(fall, 10); blossom = step(blossom, 4);
  const snow = step(world.snow * 1.6 - 0.1, 4), seed = h % 3;
  const look = m || fall || snow
    ? { rgb, m, where, fall, snow, seed, blossom, bloom, fruit,
        key: [rgb, m, where, fall, snow, seed, blossom && bloom, blossom, fruit ? fruit.e + fruit.n : ''].join('|') } : undefined;
  const bare = fall && { snow, seed, m: 0, fall: 0, key: `bare|${snow}` };
  return { look, fall, bare, drop, rgb, h, ground, flip: info.flip };
}

// Windfalls and petals lying under a tree: those behind the trunk go down first, then the rest.
function drawUnderTree(bits, h, sx, sy, px, front) {
  for (let k = 0; k < bits.n; k++) {
    const a = hash2(h, k, 21) * TAU, r = 0.2 + 0.3 * hash2(h, k, 22), y = sy + Math.sin(a) * r * px * 0.35;
    if ((y >= sy) !== front) continue;
    ctx.save(); ctx.translate(sx + Math.cos(a) * r * px, y); ctx.rotate((hash2(h, k, 23) - 0.5) * 1.5);
    drawEmoji(bits.e, 0, 0, px * bits.size);
    ctx.restore();
  }
}

// Leaves let go in autumn and tumble down, drifting east with the wind. Trees queue them up
// as they are drawn, and they are drawn on top of everything once the trees are done.
const leafFall = [];
function drawFallingLeaves(now) {
  const m = ui.sky.mix, wind = 0.4 + 0.6 * m.cloudy + 1.5 * m.rain + 3 * m.storm;
  ctx.save();
  for (const f of leafFall) {
    fadeTo(f.fade);                                     // as its tree is, in the mist
    const px = f.px, n = Math.round(12 * f.drop);
    for (let k = 0; k < n; k++) {
      const r1 = hash2(f.h, k, 1), life = 4500 + 2500 * r1, t = now / life + hash2(f.h, k, 2);
      const p = t % 1, r2 = hash2(f.h * 31 + k, Math.floor(t), 3), r3 = hash2(f.h * 31 + k, Math.floor(t), 4);
      const x = f.sx + (r2 - 0.5) * px * 0.7 + Math.sin(p * 9 + k) * px * 0.06 + wind * p * px * 0.25;
      const y = f.sy - px * (0.75 - 0.3 * r3) + p * px * (0.8 + 0.2 * r1);
      const s = Math.max(1.5, px * 0.06), shade = 0.8 + 0.35 * r3;
      ctx.globalAlpha = Math.min(1, p * 8, (1 - p) * 5);
      ctx.fillStyle = `rgb(${f.rgb.map(v => Math.min(255, Math.round(v * shade))).join(',')})`;
      ctx.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr);
      ctx.rotate(Math.sin(p * 7 + k) * 1.3);
      ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p * 11 + k)));        // tumbling
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); ctx.fill();
    }
  }
  unfade();
  ctx.restore();
  leafFall.length = 0;
}

// A tree turning colour is painted afresh at every step, and at 15x or 60x the seasons go by so fast
// that every tree on screen would want a new sprite every few frames. So at most TURNS a frame get their
// new colours; the rest keep the one they're showing a moment longer, and skip the steps they missed.
const TURNS = 1;
const treeShown = new WeakMap();                           // tree: the look it was last drawn with
let turned = 0;                                            // trees given a new look this frame
function shownLook(d, look, px) {
  const was = treeShown.get(d);
  if (was !== undefined && (was && was.key) !== (look && look.key) && !spriteReady(d.emoji, px, look)) {
    if (turned >= TURNS) return was;
    turned++;
  }
  treeShown.set(d, look);
  return look;
}

const rgbOf = (rgb, k, add) => rockRGB(tone(rgb, k, add));

// Reeds by the water: a clump of blades, fresh in spring, green in summer, tawny in autumn, straw in
// winter, and in summer and autumn a few bulrushes, brown heads on long stems.
const REED_RGB = [[128, 184, 84], [94, 152, 72], [190, 162, 90], [200, 184, 146]];   // by season
function paintReeds(g, size, U, shape, look) {
  g.setTransform(U, 0, 0, U, size / 2, size / 2 + 0.35 * U);
  const rgb = REED_RGB[look.season], n = 10 + shape * 3, tips = [];
  g.lineCap = 'round'; g.lineWidth = 0.035;
  for (let i = 0; i < n; i++) {
    const h = k => hash2(i, shape, 80 + k), x = (h(0) - 0.5) * 0.42, tall = 0.42 + 0.4 * h(1), lean = (h(2) - 0.5) * 0.35 + x * 0.6;
    g.strokeStyle = rgbOf(rgb, 0.72 + 0.45 * h(3));
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + lean * 0.3, -tall * 0.6, x + lean, -tall); g.stroke();
    tips.push(x + lean, -tall);
  }
  if (look.season === 1 || look.season === 2) {
    for (let k = 0; k <= shape; k++) {
      const x = (hash2(k, shape, 86) - 0.3) * 0.2, top = -0.7 - 0.2 * hash2(k, shape, 87);
      g.strokeStyle = rgbOf(rgb, 0.8); g.lineWidth = 0.02;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 0.04, top - 0.1); g.stroke();
      g.fillStyle = '#6b4226'; g.beginPath(); g.ellipse(x + 0.03, top + 0.02, 0.035, 0.1, 0.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255, 220, 170, 0.35)'; g.beginPath(); g.ellipse(x + 0.02, top, 0.012, 0.06, 0.1, 0, TAU); g.fill();
    }
  }
  if (look.snow) {
    g.fillStyle = `rgba(244,248,252,${0.9 * look.snow})`; g.beginPath();
    for (let i = 0; i < tips.length; i += 4) { g.moveTo(tips[i] + 0.03, tips[i + 1] + 0.02); g.ellipse(tips[i], tips[i + 1] + 0.02, 0.03, 0.02, 0, 0, TAU); }
    g.moveTo(0.18, 0); g.ellipse(0, 0, 0.18, 0.05, 0, 0, TAU);
    g.fill();
  }
}

// Lily pads lying flat on quiet water, round with a notch, yellowing in autumn, gone in winter; a
// water lily open on one of them in summer.
function paintLilies(g, size, U, shape, look) {
  g.setTransform(U, 0, 0, U, size / 2, size / 2 + 0.35 * U);
  const rgb = look.season === 2 ? [150, 150, 70] : [84, 142, 64];
  for (let k = 0, n = 2 + shape % 2; k < n; k++) {
    const h = j => hash2(k, shape, 90 + j), x = (h(0) - 0.5) * 0.5, y = (h(1) - 0.5) * 0.2, r = 0.14 + 0.1 * h(2), notch = h(3) * TAU;
    g.save(); g.translate(x, y); g.scale(1, 0.55);
    g.fillStyle = rgbOf(rgb, 0.6); g.beginPath(); g.arc(0.012, 0.03, r, 0, TAU); g.fill();   // its shade on the water
    g.fillStyle = rgbOf(rgb, 1); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, notch + 0.35, notch - 0.35 + TAU); g.closePath(); g.fill();
    g.strokeStyle = rgbOf(rgb, 1.25, 10); g.lineWidth = 0.01; g.beginPath();
    for (let j = 1; j < 5; j++) { const a = notch + j * TAU / 5; g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); }
    g.stroke();
    g.restore();
  }
  if (look.season === 1) {                                 // a water lily
    const x = (hash2(0, shape, 90) - 0.5) * 0.5, y = (hash2(0, shape, 91) - 0.5) * 0.2 - 0.03;
    const petal = shape === 1 ? '#fbe8f0' : '#f6a8c4';
    g.fillStyle = petal;
    for (let j = 0; j < 7; j++) { const a = j * TAU / 7; g.beginPath(); g.ellipse(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.022, 0.04, 0.018, a, 0, TAU); g.fill(); }
    g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(x, y - 0.005, 0.018, 0, TAU); g.fill();
  }
}
const REED_ARTS = ['reeds:0', 'reeds:1', 'reeds:2'], LILY_ARTS = ['lily:0', 'lily:1', 'lily:2'];
const SHORE_LOOKS = [0, 1, 2, 3].flatMap(season => [0, 0.25, 0.5, 0.75, 1].map(snow => ({ season, snow, key: season + '|' + snow })));

// Reeds and lily pads, from the scatter updateWater keeps; lily pads not under ice nor in winter.
function drawShore(z, ox, oy, season) {
  if (z < 9 || !pond) return;
  const look = SHORE_LOOKS[season * 5 + Math.round(step(world.snow * 1.6 - 0.1, 4) * 4)], iced = iceOver() > 0.3;
  for (const s of pond.shore) {
    if (s.lily && (iced || season === 3)) continue;
    const px = s.size * z, x = ox + s.x * z, y = oy + s.y * z;
    if (x + px < 0 || x - px > vw || y + px * 0.3 < 0 || y - px > vh || !fadeAt(s.x, s.y)) continue;
    const sp = sprite(s.art, px, '', look);
    ctx.drawImage(sp.canvas, x - sp.size / 2, y - px * 0.35 - sp.size / 2, sp.size, sp.size);
  }
  unfade();
}
// ------------------------------------------------------------------ painted trees
//
// Trees are painted by trees.js: sculpted as a little 3D model for the light, then brushed over.
// A paint takes a few hundredths of a second, so it's done in workers (tree-worker.js, two where there are
// the cores) and never holds up a frame. Each kind comes in a few shapes, a tree picking one from where it stands; each
// shape in its season's looks, in its tone (sim.js d.tone) and form (young, or grown); each look at a
// few sizes (TREE_TIERS). A dead tree has one look, grey and bare, a fallen one is a log, and one lightning
// took is a stump. Only what's on screen is asked for, and until it comes the nearest size stands in, or
// a small painting of its kind in that look (treeKin: painted ahead, one of each, kept for good), or
// another look of the same tree. A tree with none of these yet isn't drawn, and fades in when its
// painting comes. A tree turning crossfades from one look to the next (treeStage), and the snow is a
// layer of its own, laid on as thick as the snow lying. Where there's no worker (or with ?emoji),
// trees are emoji.
const TREE_SHAPES = 4;
const TREE_UNIT = 200;                   // painted px (at scale 1) to one tree size: an oak's crown is about that wide
const TREE_TIERS = [0.125, 0.25, 0.5, 1, 2];   // the scales each look is painted at
const TREE_BYTES = 48e6;                 // the paintings kept, in memory
// How much bigger each kind is drawn than its d.size (the sim's, which says how grown it is). The
// paintings differ (an oak's is short and wide, a birch's tall), so these give each kind its own
// height: oak, beech and pine big, birch and maple a little less, apple smaller, a cherry a big pink
// cloud in spring, hawthorn a thicket. Kept small enough that you see between trees. The hive oak is
// an old giant already (HIVE_TREE). Emoji trees keep their size.
const TREE_SCALE = { oak: 1.41, hive: 1, beech: 1.36, maple: 1.14, birch: 0.92, pine: 1.01, willow: 1.03, apple: 1.28, cherry: 1.72, hawthorn: 1.1, log: 1.2, stump: 1 };
const treePx = d => d.size * cam.zoom * (d.tree && treeWorker ? TREE_SCALE[d.fallen ? 'log' : d.stump ? 'stump' : treeKind(d)] || 1 : 1);
const LOG_BARK = { beech: 'grey', birch: 'birch' };      // whose bark a log or a stump has (trees.js); the rest are brown
const YOUNG = new Set(['seedling', 'sapling', 'young']);
const SEEDLING_PX = 6;                                   // a seedling smaller than this on screen isn't drawn
// A bare tree looks the same whatever its tone, and a young one hardly shows its shape: fewer paintings to make.
const bareLook = (kind, look) => look === 'dead' || look === 'burnt' || (kind !== 'pine' && kind !== 'log' && (look === 'winter' || look === 'bare'));
const HIVE_DOOR = [1, -38];              // the hive's sill in the hive oak's painting, from its foot (trees.js hive)
// Paintings go by number, so a frame builds no names: the tree (kind, shape, tone, form), its look, the size (its
// place in TREE_TIERS) and the snow, packed together.
const ART_KINDS = { oak: 0, hive: 1, beech: 2, maple: 3, birch: 4, pine: 5, willow: 6, apple: 7, cherry: 8, hawthorn: 9, log: 10, stump: 11 };
const ART_LOOKS = { summer: 0, spring: 1, bud: 2, autumn: 3, thin: 4, winter: 5, bare: 6, dead: 7, burnt: 8 }, ART_LOOK_N = 9;
const ART_TONES = { 0: 0, 1: 1, 2: 2, 3: 3, bark: 4, grey: 5, birch: 6 };
const treeKey = (kind, shape, tone, form) => ((ART_KINDS[kind] * 4 + shape) * 8 + ART_TONES[tone]) * 2 + form;
// treeAny: a painting of each tree, in any look, till its own comes. treeKin: a small one of each kind in each
// look, with its snow, painted ahead and kept for good (outside TREE_BYTES: a few MB), so there's always one.
const treeArt = new Map(), treeAsked = new Map(), treeSent = new Map(), treeAny = new Map(), treeKin = new Map();
const BROAD = ['winter', 'bud', 'spring', 'summer', 'autumn', 'thin', 'dead'], OAK = ['bare', 'winter', 'bud', 'spring', 'summer', 'autumn', 'dead'];
const KIN_LOOKS = { oak: OAK, hive: OAK, beech: BROAD, maple: BROAD, birch: BROAD, apple: BROAD, cherry: BROAD, hawthorn: BROAD,
  pine: ['summer', 'spring', 'dead'], log: ['summer'], stump: ['summer'] };   // the looks each kind goes through (treeStage)
const KIN_TIER = 0.25;
const kinWanted = [];                    // stand-ins still to paint, one wanted on screen first
// Two workers where there are the cores for it (a phone has them to spare), each handed two paintings at a time.
// treeWorker is the first, and says whether trees are painted at all.
const TREE_WORKERS = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
const treeWorkers = [];                  // { worker, busy }
let treeWorker = null, treeBusy = 0, treeBytes = 0, kinBusy = false, kinAsked = false;
if (!params.has('emoji') && window.Worker && window.OffscreenCanvas) {
  try {
    for (let n = 0; n < TREE_WORKERS; n++) {
      const tw = { worker: new Worker('tree-worker.js'), busy: 0 };
      tw.worker.onmessage = e => {
        const { key, bx, by, image, snow } = e.data, job = treeSent.get(key);
        const p = { image, snow, bx, by, scale: job.scale, used: spriteFrame, bytes: image.width * image.height * 4 * (snow ? 2 : 1) };
        treeSent.delete(key); treeBusy--; tw.busy--;
        if (job.kin !== undefined) { treeKin.set(job.kin, p); kinBusy = false; }
        else {
          treeArt.set(key, p); treeAny.set(job.tree, p); treeBytes += p.bytes;
          if (treeBytes > TREE_BYTES) dropTreeArt();
        }
        askTrees();
      };
      tw.worker.onerror = () => { treeWorker = null; };   // no OffscreenCanvas in workers here: emoji trees
      treeWorkers.push(tw);
    }
    treeWorker = treeWorkers[0].worker;
  } catch (e) { treeWorker = null; }
}
// Let go of the paintings not drawn for a while, oldest first, down to three quarters full.
function dropTreeArt() {
  const old = [...treeArt].filter(([, p]) => spriteFrame - p.used > 60).sort((a, b) => a[1].used - b[1].used);
  for (const [key, p] of old) {
    if (treeBytes < TREE_BYTES * 0.75) break;
    p.image.close(); if (p.snow) p.snow.close();
    treeArt.delete(key); treeBytes -= p.bytes;
    for (const [k, q] of treeAny) if (q === p) treeAny.delete(k);
  }
}
// A stand-in of this kind in this look (treeKin) is painted, or will be: now, first thing, when a tree on
// screen has nothing else to show.
function wantKin(kind, look, now) {
  const kin = ART_KINDS[kind] * ART_LOOK_N + ART_LOOKS[look];
  if (treeKin.has(kin) || treeSent.has(-1 - kin)) return;
  const i = kinWanted.findIndex(j => j.kin === kin);
  if (i < 0) {
    const job = { kind, seed: 1, season: look, scale: KIN_TIER, ss: KIN_TIER * 3, snow: true, kin, ...(kind === 'log' || kind === 'stump' ? { bark: 'bark' } : { tone: 0 }) };
    if (now) kinWanted.unshift(job); else kinWanted.push(job);
  } else if (now && i > 0) kinWanted.unshift(kinWanted.splice(i, 1)[0]);
  askTrees();
}
// All the stand-ins, asked for once at the start: this season's looks first, then the year's on from it.
function kinAhead() {
  kinAsked = true;
  const s = S.clock(world).season, looks = new Set();
  for (let k = 0; k < 4; k++) for (const l of [['bare', 'bud', 'spring'], ['summer'], ['autumn', 'thin'], ['winter']][(s + k) % 4]) looks.add(l);
  for (const look of [...looks, 'dead']) for (const kind in KIN_LOOKS) if (KIN_LOOKS[kind].includes(look)) wantKin(kind, look, false);
}
// Hands the workers the next painting wanted, two each at a time: a stand-in while none is being painted
// (one at a time, so the rest go on), then the ones wanted this frame, small sizes before big so something
// shows soon. What hasn't been wanted for a while is forgotten.
function sendTree(key, job) {
  const tw = treeWorkers.reduce((a, b) => b.busy < a.busy ? b : a);
  treeSent.set(key, job); treeBusy++; tw.busy++;
  tw.worker.postMessage({ key, ...job });
}
function askTrees() {
  while (treeWorker && treeBusy < 2 * treeWorkers.length) {
    if (kinWanted.length && !kinBusy) {
      const job = kinWanted.shift();
      kinBusy = true; sendTree(-1 - job.kin, job);               // (its own keys, below the others)
      continue;
    }
    let best = null;
    for (const [key, a] of treeAsked) {
      if (spriteFrame - a.frame > 30) { treeAsked.delete(key); continue; }
      if (!best || a.frame > best[1].frame || (a.frame === best[1].frame && a.job.scale < best[1].job.scale)) best = [key, a];
    }
    if (!best) return;
    treeAsked.delete(best[0]); sendTree(best[0], best[1].job);
  }
}
// A painting of this tree's look near this size: the one asked for if it's there (else it's asked
// for), or the same look at the nearest size, or none. tone: the tree's (a log's or a stump's: its bark); form: 1 young, 0 grown.
function treePainting(kind, shape, tone, form, look, tier, snow) {
  const tree = treeKey(kind, shape, tone, form), lk = tree * ART_LOOK_N + ART_LOOKS[look], i = TREE_TIERS.indexOf(tier), key = (lk * 8 + i) * 2 + (snow ? 1 : 0);
  const p = treeArt.get(key);
  if (p) { p.used = spriteFrame; return p; }
  if (!treeSent.has(key)) {
    const a = treeAsked.get(key);
    if (a) a.frame = spriteFrame;
    else treeAsked.set(key, { frame: spriteFrame, job: { kind, seed: shape + 1, season: look, scale: tier, ss: clamp(tier * 3, 0.4, 2), snow,   // sculpted about 3x as fine as shown
      tree, ...(typeof tone === 'string' ? { bark: tone } : { tone, young: form === 1 }) } });
    askTrees();
  }
  for (let k = 0; k < TREE_TIERS.length; k++) {           // this size without the snow, then one up, one down, ...
    for (const j of k ? [i + k, i - k] : [i]) {
      const q = j >= 0 && j < TREE_TIERS.length && (snow && treeArt.get((lk * 8 + j) * 2 + 1) || treeArt.get((lk * 8 + j) * 2));
      if (q) { q.used = spriteFrame; return q; }
    }
  }
  return null;
}
const treeKind = d => d.hive ? 'hive' : treeInfo(d).kind;
// Which looks a tree is between, and how far from the first to the second (about the timings of
// treeLook). The leafier look goes second, fading in or out over the other. A broadleaf buds, then
// comes into leaf; an oak first drops last year's dry leaves. In autumn the others thin, then stand bare.
function treeStage(kind, d, ck) {
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS, s = ck.season, lag = (treeInfo(d).h % 5) * 0.04;
  const oak = kind === 'oak' || kind === 'hive', bare = oak ? 'bare' : 'winter';   // an oak's winter look keeps its dry leaves
  const quick = m => { m = clamp((m - 0.2) / 0.6, 0, 1); return m * m * (3 - 2 * m); };   // leaves on a bare tree look ghostly half faded: keep that short
  if (kind === 'pine') {
    if (s === 0) return ['summer', 'spring', clamp((sp - 0.4) / 0.4, 0, 1)];
    return s === 1 ? ['spring', 'summer', clamp(sp / 0.5, 0, 1)] : ['summer', null, 0];
  }
  if (s === 0) {
    const t = sp - lag - (oak ? 0.1 : 0), shed = clamp((sp - lag) / 0.1, 0, 1);
    const bud = clamp(t / 0.15, 0, 1), out = clamp((t - 0.15) / 0.2, 0, 1), green = clamp((sp - 0.45 - lag) / 0.4, 0, 1);
    if (oak && shed < 1) return ['bare', 'winter', quick(1 - shed)];
    return green > 0 ? ['spring', 'summer', green] : out > 0 ? ['bud', 'spring', out] : [bare, 'bud', quick(bud)];
  }
  if (s === 1) return ['summer', null, 0];
  if (s === 2) {
    const turn = clamp((sp - 0.05 - lag) / 0.4, 0, 1), fall = clamp((sp - (oak ? 0.65 : 0.6) - lag) / 0.35, 0, 1);
    if (oak) return fall > 0 ? ['winter', 'autumn', 1 - fall] : ['summer', 'autumn', turn];
    return fall > 0.5 ? ['winter', 'thin', quick(2 - fall * 2)] : fall > 0 ? ['thin', 'autumn', quick(1 - fall * 2)] : ['summer', 'autumn', turn];
  }
  return ['winter', null, 0];
}
// Draws a tree from its paintings, swaying from the foot; false if it has none yet. stage: sim.js treeStage.
// Trees that had nothing to show: 0 while they wait, then when their painting came, to fade them in.
const treeWaits = new WeakMap(), FADE_MS = 300;
function drawPaintedTree(d, sx, sy, now, ck, stage = S.treeStage(world, d)) {
  if (!treeWorker) return false;
  if (!kinAsked) kinAhead();
  const wood = stage === 'log' || stage === 'stump', kind = wood ? stage : treeKind(d), hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100);
  const form = YOUNG.has(stage) ? 1 : 0, shape = Math.floor(hash2(hx, hy, 46) * TREE_SHAPES) % (form ? 2 : TREE_SHAPES);
  const px = treePx(d), f = px / TREE_UNIT, want = f * dpr, tier = TREE_TIERS.find(t => t >= want * 0.9) || TREE_TIERS[TREE_TIERS.length - 1];
  const snow = step(world.snow * 1.6 - 0.1, 4), tone = wood ? LOG_BARK[d.kind] || 'bark' : d.tone ?? 0;
  const [a, b, m] = wood ? ['summer', null, 0] : stage === 'dead' ? [d.burnt ? 'burnt' : 'dead', null, 0] : treeStage(kind, d, ck);
  let A = m < 1 ? treePainting(kind, shape, bareLook(kind, a) ? 0 : tone, form, a, tier, snow > 0) : null;
  let B = b && m > 0 ? treePainting(kind, shape, bareLook(kind, b) ? 0 : tone, form, b, tier, snow > 0) : null;
  if (!A && !B) {                                            // till this one comes: its kind in this look, or another look of it
    const look = m > 0.5 ? b : a;
    A = treeKin.get(ART_KINDS[kind] * ART_LOOK_N + ART_LOOKS[look]) || treeAny.get(treeKey(kind, shape, tone, form));
    if (!A) { wantKin(kind, look, true); if (!treeWaits.has(d)) treeWaits.set(d, 0); return false; }
  }
  let fade = 1;
  const t0 = treeWaits.get(d);
  if (t0 !== undefined) {
    if (!t0) treeWaits.set(d, now);
    fade = t0 ? Math.min(1, (now - t0) / FADE_MS) : 0;
    if (fade >= 1) treeWaits.delete(d);
  }
  const r = wood ? 0 : treeSway(d, now) * (stage === 'dead' ? 0.4 : 1), still = Math.abs(r) * px < 0.5;   // a sway too small to see isn't drawn
  if (!still) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(r); }   // swaying from the foot
  if (A) putPainting(A, f, fade, snow, still ? sx : 0, still ? sy : 0);
  if (B) putPainting(B, f, (A ? m : 1) * fade, snow, still ? sx : 0, still ? sy : 0);
  if (!still) ctx.restore();
  return true;
}
function putPainting(p, f, alpha, snow, ox, oy) {
  const k = f / p.scale, x = ox - p.bx * k, y = oy - p.by * k, w = p.image.width * k, h = p.image.height * k;
  ctx.globalAlpha = alpha;
  ctx.drawImage(p.image, x, y, w, h);
  if (snow && p.snow) { ctx.globalAlpha = alpha * snow; ctx.drawImage(p.snow, x, y, w, h); }
  ctx.globalAlpha = 1;
}
const PAINTERS = { fox: paintFox, reeds: paintReeds, lily: paintLilies, bubble: paintBubble, vole: paintVole, frog: paintFrog, crow: paintCrow, otter: paintOtter, holt: paintHolt, remains: paintRemains, body: paintBody };
function drawDecor(d, sx, sy, now, ck, clipLeaves) {
  const z = cam.zoom, px = d.tree ? treePx(d) : d.size * z;
  if (d.emoji === '🪨') { drawRock(d, sx, sy); return; }
  if (!d.stump && !d.tree) { drawEmoji(d.emoji, sx, sy - px * 0.35, px); return; }
  const stage = d.tree && S.treeStage(world, d);
  if (stage === 'seedling' && !treeWorker) { if (px >= 3) drawEmoji('🌱', sx, sy - px * 0.3, px * 0.9); return; }   // (painted, it's a little young tree)
  if (stage === 'dead' || stage === 'log' || stage === 'stump') {   // grey and bare, fallen, or a stump till it sprouts again
    if (drawPaintedTree(d, sx, sy, now, ck, stage) || treeWorker) return;
    if (stage === 'dead') drawEmoji('🪾', sx, sy - px * 0.42, px * 1.15);
    else drawEmoji('🪵', sx, sy - px * (stage === 'log' ? 0.1 : 0.12), px * (stage === 'log' ? 0.5 : 0.45));
    return;
  }
  if (px < 20 && !clipLeaves && (drawPaintedTree(d, sx, sy, now, ck, stage) || treeWorker)) return;   // too small for anything under it or in it
  const t = treeLook(d, ck);
  const under = t.ground?.n && px >= 20 && !(treeWorker && t.ground.e === '🌸');   // a painted cherry has its own petals
  if (under) drawUnderTree(t.ground, t.h, sx, sy, px, false);
  if (!clipLeaves && drawPaintedTree(d, sx, sy, now, ck, stage)) {
    if (under) drawUnderTree(t.ground, t.h, sx, sy, px, true);
    if (t.drop && px >= 22) leafFall.push({ sx, sy, px, drop: t.drop, rgb: t.rgb, h: t.h, fade });
    return;
  }
  if (treeWorker) return;                                    // nothing to show yet: it fades in when its painting comes
  t.look = shownLook(d, t.look, px);
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(treeSway(d, now));
  if (t.bare) drawEmoji('🪾', 0, -px * 0.42, px * 1.15, { alpha: t.fall, leaf: t.bare, flip: t.flip });   // it draws small
  if (clipLeaves) clipLeaves(px);                      // (the bee tree)
  if (t.fall < 1) drawEmoji(d.emoji, 0, -px * 0.35, px, { leaf: t.look, flip: t.flip });
  ctx.restore();
  if (under) drawUnderTree(t.ground, t.h, sx, sy, px, true);
  if (t.drop && px >= 22) leafFall.push({ sx, sy, px, drop: t.drop, rgb: t.rgb, h: t.h, fade });
}

// ------------------------------------------------------------------ rocks
//
// Rocks are painted, not emoji. Each is one to a few stones from a handful of hand-made
// outlines, turned and mirrored, in a few colours of stone: a darker side, a lighter top lit
// from the top left, a dark line where it meets the ground, and moss on some, more in the
// woods. What a rock looks like comes from where it lies (rockInfo); it's painted into a
// sprite, painted again when the zoom settles at a new size or the snow changes.

const ROCK_SHAPES = [   // an outline's reach at ten steps round, starting at the right, going down
  [1, 0.95, 0.8, 0.85, 0.98, 1.05, 0.9, 0.72, 0.78, 0.92],
  [1.12, 0.9, 0.7, 0.74, 0.9, 1.02, 1.08, 0.84, 0.7, 0.9],
  [0.95, 1, 1, 0.8, 0.68, 0.86, 1, 0.95, 0.7, 0.8],
  [1.15, 1.04, 0.72, 0.62, 0.8, 1.1, 0.94, 0.68, 0.76, 1],
  [0.9, 0.84, 0.96, 1.05, 0.8, 0.74, 0.9, 1, 1.06, 0.8],
];
const ROCK_RGB = [[184, 174, 156], [160, 166, 166], [206, 178, 128], [190, 168, 150], [184, 174, 156], [146, 144, 130]];
const MOSS_RGB = [108, 146, 52];
const ROCK_SQUASH = 0.62;                                  // we look down at the meadow at a slant
const ROCK_FOOT = 0.66;                                    // where the ground is in a rock's sprite, from the top
const ROCK_MAX_PX = 256;                                   // each rock keeps its sprite, so mind the memory; past this it's a little soft
const rockInfos = new WeakMap();
let rockLayer = null;                                      // scratch canvas, one stone at a time

// The stones of a rock, in rock units (1 is d.size), (0, 0) where it meets the ground.
function rockInfo(d) {
  let t = rockInfos.get(d);
  if (t) return t;
  const hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100), h = k => hash2(hx, hy, 60 + k);
  const wood = world.wood[Math.floor(d.y) * S.W + Math.floor(d.x)];
  const grown = clamp((d.size - 0.7) / 1.6, 0, 1);         // the bigger the rock, the likelier a boulder
  const kind = d.stone ? 'ford' : d.big ? 'great' : h(0) < 0.45 - 0.3 * grown ? 'pebbles' : h(0) < 0.85 - 0.35 * grown ? 'stone' : 'boulder';
  let k = 1;
  const stone = (x, y, s, tall, round) => ({ x, y, s, tall, round, shape: Math.floor(h(k++) * 5), turn: h(k++) * TAU, flip: h(k++) < 0.5 ? -1 : 1 });
  const stones = [];
  if (kind === 'pebbles') {
    for (let n = 3 + Math.floor(h(90) * 3), i = 0; i < n; i++) {
      const a = h(k++) * TAU, r = i ? 0.12 + h(k++) * 0.2 : 0;
      stones.push(stone(Math.cos(a) * r, Math.sin(a) * r * ROCK_SQUASH, 0.09 + h(k++) * 0.08, 0.55, 0.5));
    }
  } else if (kind === 'ford') {
    stones.push(stone(0, 0, 0.46, 0.2, 0.42));
  } else if (kind === 'great') {                          // a big one, a slab leaning on it, stones at its foot
    const side = h(92) < 0.5 ? -1 : 1;
    stones.push(stone(0, 0, 0.5, 0.75, 0.2), stone(side * 0.44, 0.1, 0.24, 0.7, 0.24));
    for (let n = 2 + Math.floor(h(93) * 3), i = 0; i < n; i++) {
      const a = h(k++) * TAU;
      stones.push(stone(Math.cos(a) * 0.62, 0.12 + Math.abs(Math.sin(a)) * 0.2, 0.04 + h(k++) * 0.06, 0.55, 0.45));
    }
  } else {
    const big = kind === 'boulder';
    stones.push(stone(0, 0, big ? 0.6 : 0.36, big ? 0.8 : 0.6, big ? 0.22 : 0.32));
    if (big || h(91) < 0.5) {                               // a smaller one or two at its foot
      const side = h(92) < 0.5 ? -1 : 1;
      stones.push(stone(side * (big ? 0.56 : 0.34), 0.06, big ? 0.17 : 0.1, 0.6, 0.4));
      if (big && h(93) < 0.6) stones.push(stone(-side * 0.42, 0.16, 0.09, 0.5, 0.5));
    }
  }
  stones.sort((a, b) => a.y - b.y);
  t = {
    stones, kind,
    rgb: ROCK_RGB[Math.floor(h(94) * ROCK_RGB.length)].map(v => v * (0.94 + 0.12 * h(95))),
    moss: kind === 'ford' ? 0 : clamp(h(96) * 1.4 - (kind === 'great' ? 0.5 : 0.9) + wood * 1.2, 0, 1),
    sprite: null, px: 0, snow: null,                     // snow: its snow, a layer of its own like a tree's
  };
  rockInfos.set(d, t);
  return t;
}

// A stone's outline, lifted by lift and grown by k, with its corners rounded by its round.
function rockPath(g, p, lift, k) {
  const R = ROCK_SHAPES[p.shape], n = R.length, pts = [];
  for (let i = 0; i < n; i++) {
    const a = p.turn + i / n * TAU, r = R[i] * p.s * k;
    pts.push([p.x + p.flip * Math.cos(a) * r, p.y - lift + Math.sin(a) * r * ROCK_SQUASH]);
  }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], c = p.round;
    const p0 = [lerp(v[0], a[0], c), lerp(v[1], a[1], c)], p1 = [lerp(v[0], b[0], c), lerp(v[1], b[1], c)];
    g[i ? 'lineTo' : 'moveTo'](p0[0], p0[1]);
    g.quadraticCurveTo(v[0], v[1], p1[0], p1[1]);
  }
  g.closePath();
}

const rockRGB = (c, a = 1) => `rgba(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')},${a})`;

function paintStone(g, p, t, U, sg) {
  const L = rockLayer, lg = L.getContext('2d'), h = p.s * p.tall;
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.clearRect(0, 0, L.width, L.height);
  lg.setTransform(U, 0, 0, U, L.width / 2, L.height * ROCK_FOOT);
  const base = t.rgb, wet = t.kind === 'ford';
  const side = base.map(v => v * (wet ? 0.66 : 0.84)), top = base.map(v => v * (wet ? 0.96 : 1.06) + 14);
  // The body: the outline stacked from the ground up, drawing in towards the top.
  lg.fillStyle = rockRGB(side);
  for (let s = 0; s <= 8; s++) { const f = s / 8; rockPath(lg, p, h * f, 1 - 0.28 * f * f); lg.fill(); }
  lg.globalCompositeOperation = 'source-atop';
  let gr = lg.createLinearGradient(0, p.y - h, 0, p.y + p.s * ROCK_SQUASH);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(46,44,24,0.35)');
  lg.fillStyle = gr; lg.fillRect(-2, -2, 4, 4);
  gr = lg.createLinearGradient(p.x - p.s, 0, p.x + p.s, 0);
  gr.addColorStop(0, 'rgba(255,250,235,0.12)'); gr.addColorStop(1, 'rgba(40,42,24,0.25)');
  lg.fillStyle = gr; lg.fillRect(-2, -2, 4, 4);
  // The top, lit from the top left.
  lg.globalCompositeOperation = 'source-over';
  rockPath(lg, p, h * 0.98, 0.74);
  gr = lg.createRadialGradient(p.x - p.s * 0.35, p.y - h - p.s * 0.25, 0, p.x - p.s * 0.2, p.y - h, p.s * 1.1);
  gr.addColorStop(0, rockRGB(top.map(v => v + 14))); gr.addColorStop(0.6, rockRGB(top)); gr.addColorStop(1, rockRGB(base.map(v => v * 0.9)));
  lg.fillStyle = gr; lg.fill();
  lg.globalCompositeOperation = 'source-atop';
  // Grain: a few flecks, light and dark, and a crack on the big ones.
  for (let i = 0; i < 10; i++) {
    const a = hash2(p.shape * 31 + i, Math.floor(p.turn * 100), 71) * TAU, r = Math.sqrt(hash2(i, Math.floor(p.turn * 100), 72)) * p.s * 0.9;
    lg.fillStyle = i % 2 ? 'rgba(40,36,30,0.18)' : 'rgba(255,252,240,0.2)';
    lg.beginPath(); lg.arc(p.x + Math.cos(a) * r, p.y - h * 0.6 + Math.sin(a) * r * ROCK_SQUASH, Math.min(p.s * 0.035, 0.01), 0, TAU); lg.fill();
  }
  if (p.s > 0.3) {
    lg.strokeStyle = rockRGB(side.map(v => v * 0.75), 0.45); lg.lineWidth = 0.01; lg.lineCap = 'round';
    const c = Math.cos(p.turn), s = Math.sin(p.turn);
    lg.beginPath(); lg.moveTo(p.x + c * p.s * 0.1, p.y - h - s * p.s * 0.1);
    lg.lineTo(p.x + c * p.s * 0.35 + 0.02, p.y - h * 0.9 + p.s * 0.08); lg.lineTo(p.x + c * p.s * 0.5, p.y - h * 0.35); lg.stroke();
  }
  // Moss towards the back of the top, then snow over it.
  if (t.moss > 0.05) {
    for (let i = 0; i < 7; i++) {
      const u = hash2(i, p.shape + Math.floor(p.turn * 100), 73), v = hash2(i, p.shape, 74);
      const x = p.x + (u - 0.5) * p.s * 1.5, y = p.y - h - p.s * ROCK_SQUASH * (0.2 + 0.5 * v);
      softSpot(lg, x, y, p.s * (0.25 + 0.25 * v) * (0.5 + t.moss), p.s * 0.2 * (0.5 + t.moss), MOSS_RGB.map(c => c + (u - 0.5) * 30).join(','), 0.55 + 0.45 * t.moss);
    }
  }
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(L, -L.width / 2, -L.height * ROCK_FOOT);
  if (!sg) return;
  // Its snow cap goes on the snow layer, over the snow on the stones behind, which it hides.
  sg.globalCompositeOperation = 'destination-out'; sg.drawImage(L, -L.width / 2, -L.height * ROCK_FOOT);
  sg.globalCompositeOperation = 'source-over';
  sg.save(); sg.scale(U, U); rockPath(sg, p, h, 0.72); sg.restore();
  sg.fillStyle = rockRGB(SNOW_RGB, 0.9); sg.fill();
}

function rockSprite(t, U, snowy) {
  const t0 = performance.now(), c = t.sprite || document.createElement('canvas');
  c.width = Math.ceil(U * 1.8); c.height = Math.ceil(U * 1.5);
  const sc = snowy ? t.snow || document.createElement('canvas') : null;
  if (sc) { sc.width = c.width; sc.height = c.height; }
  const sg = sc && sc.getContext('2d');
  sg?.translate(c.width / 2, c.height * ROCK_FOOT);
  if (!rockLayer) rockLayer = document.createElement('canvas');
  if (rockLayer.width < c.width || rockLayer.height < c.height) { rockLayer.width = c.width; rockLayer.height = c.height; }
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height * ROCK_FOOT);
  // A dark line where the stones meet the ground, under them all.
  g.save(); g.scale(U, U);
  for (const p of t.stones) {
    if (t.kind === 'ford') {                              // a ring of lighter water round a wet stone
      g.strokeStyle = 'rgba(235,245,255,0.55)'; g.lineWidth = 0.035;
      rockPath(g, p, -0.01, 1.12); g.stroke();
    }
    softSpot(g, p.x, p.y + p.s * 0.08, p.s * 1.25, p.s * ROCK_SQUASH * 1.1, '30,34,16', 0.5);
  }
  g.restore();
  for (const p of t.stones) paintStone(g, p, t, U, sg);
  Object.assign(t, { sprite: c, px: U, snow: sc });
  paintedMs += performance.now() - t0;
  return c;
}

// While the zoom moves, a rock painted at about this size is stretched rather than painted again;
// it's painted sharp once the zoom comes to rest (groundStill). Its snow is painted once, the first
// time it snows, and fades in and out on top, so the snow coming and going never repaints it.
function drawRock(d, sx, sy) {
  const t = rockInfo(d), px = d.size * cam.zoom, snow = t.kind === 'ford' ? 0 : clamp(world.snow * 1.6 - 0.2, 0, 1);
  const want = Math.min(ROCK_MAX_PX, spriteStep(px * dpr)), off = t.sprite ? want / t.px : 0;
  const keep = (t.snow || !snow) && (want === t.px || (groundStill < 2 && off > 0.7 && off < 1.4));
  const wait = !keep && t.sprite && standIns && paintedMs > PAINT_MS;   // past the frame's painting, it waits a frame
  const s = keep || wait ? t.sprite : rockSprite(t, want, snow > 0);
  const w = s.width * px / t.px, h = s.height * px / t.px, x = sx - w / 2, y = sy - h * ROCK_FOOT;
  ctx.drawImage(s, x, y, w, h);
  if (snow && t.snow) { ctx.globalAlpha = snow; ctx.drawImage(t.snow, x, y, w, h); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------------ hives
//
// A wild colony lives in a hollow in an old tree: a giant broadleaf, bigger than any in the wood,
// with a thick trunk flaring into its roots and a hole low down where the bees go in, its rim dark
// with their resin. The trunk is painted into a sprite that fades out at the top, laid over the
// emoji's own, so it grows up into the crown whatever the emoji font. The bees on the sill are
// drawn each frame, more of them the bigger the colony.

// A bee on the bark, seen from above: gold with dark bands and a glint of wing. Too small, a dot.
function barkBee(x, y, s, a) {
  if (s < 1.3) { ctx.fillStyle = '#3a2610'; ctx.fillRect(x - 0.6, y - 0.6, 1.3, 1.3); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(240, 245, 255, 0.6)';
  ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.5, s * 0.5, s * 0.28, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d99a22'; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.58, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2e1d0b';
  ctx.fillRect(-s * 0.45, -s * 0.55, s * 0.22, s * 1.1); ctx.fillRect(s * 0.05, -s * 0.55, s * 0.22, s * 1.1);
  ctx.beginPath(); ctx.arc(s * 0.85, 0, s * 0.38, 0, TAU); ctx.fill();
  ctx.restore();
}

// Which way, in words, like a waggle dance tells it. North is up the map.
const compass = (dx, dy) => ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][
  (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];

const OLD_HOLE = { x: 0.015, y: -0.075, rx: 0.042, ry: 0.066 };   // in tree sizes, from its foot
const OLD_FADE = [-0.15, -0.27];                           // the trunk fades into the crown between these
const trunkSprites = new Map();

function softSpot(g, x, y, rx, ry, rgb, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb}, ${a})`); r.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
}

function trunkPath(g) {                                    // in tree sizes, from its foot
  g.beginPath();
  g.moveTo(-0.095, -0.34);
  g.bezierCurveTo(-0.105, -0.2, -0.115, -0.1, -0.13, -0.035);
  g.quadraticCurveTo(-0.155, 0.008, -0.26, 0.028);                     // a root, left
  g.quadraticCurveTo(-0.15, 0.048, -0.075, 0.032);
  g.quadraticCurveTo(0.01, 0.052, 0.08, 0.034);
  g.quadraticCurveTo(0.14, 0.052, 0.235, 0.022);                       // and right
  g.quadraticCurveTo(0.15, 0.004, 0.14, -0.05);
  g.bezierCurveTo(0.13, -0.12, 0.12, -0.22, 0.115, -0.34);
  g.closePath();
}

// Old bark, lit from the top left, with deep ridges fanning out into the roots, fading out at the top.
function paintTrunk(g, P, px) {
  trunkPath(g);
  const bark = g.createLinearGradient(-0.13, 0, 0.15, 0);
  bark.addColorStop(0, '#9c7b5f'); bark.addColorStop(0.45, '#6f4f3b'); bark.addColorStop(1, '#3d2a1d');
  g.fillStyle = bark; g.fill();
  g.save(); g.clip();
  if (P > 60) {
    for (let k = 0; k < 10; k++) {
      const f = (k + 0.5) / 10 - 0.5;
      g.beginPath();
      for (let n = 0, y = -0.34; y <= 0.05; n++, y += 0.02) {
        const spread = y > -0.05 ? 1 + (y + 0.05) * 14 : 1;
        g[n ? 'lineTo' : 'moveTo'](0.01 + f * 0.24 * spread + (hash2(k, n, 5) - 0.5) * 0.008, y);
      }
      g.lineWidth = Math.max(px, 0.007); g.strokeStyle = 'rgba(35, 20, 10, 0.3)'; g.stroke();
      g.translate(-0.004, 0); g.lineWidth = Math.max(px, 0.003); g.strokeStyle = 'rgba(255, 225, 185, 0.1)'; g.stroke(); g.translate(0.004, 0);
    }
  }
  softSpot(g, 0.09, 0.012, 0.09, 0.03, '96, 120, 40', 0.55);          // moss at the foot, on the shaded side
  softSpot(g, 0.1, -0.12, 0.03, 0.07, '96, 120, 40', 0.35);
  g.restore();
  // The top fades out, so the tree's own trunk and crown take over (a hollow, painted later, doesn't).
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, OLD_FADE[0], 0, OLD_FADE[1]);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)'); fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  g.fillStyle = fade; g.fillRect(-0.5, -0.5, 1, 0.5 + OLD_FADE[0]);
  g.globalCompositeOperation = 'source-over';
}

function trunkSprite(P, hole) {                          // the painted trunk, or (hole) the hollow in it
  P = Math.round(P);
  let s = trunkSprites.get(P + (hole ? 'h' : 't'));
  if (s) return s;
  if (trunkSprites.size > 40) trunkSprites.clear();
  const W = P * 0.56, H = P * 0.42, ox = P * 0.28, oy = P * 0.36;
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
  const g = c.getContext('2d'), px = 1 / P;
  g.setTransform(dpr * P, 0, 0, dpr * P, ox * dpr, oy * dpr);
  s = { canvas: c, W, H, ox, oy };
  trunkSprites.set(P + (hole ? 'h' : 't'), s);
  if (!hole) { paintTrunk(g, P, px); return s; }
  // The hollow: a resin-dark rim, a lip of bark, black inside, comb glinting at the bottom.
  const { x, y, rx, ry } = OLD_HOLE;
  softSpot(g, x, y + ry * 0.2, rx * 1.9, ry * 1.6, '40, 22, 8', 0.6);
  const lip = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  lip.addColorStop(0, '#b88a5c'); lip.addColorStop(0.5, '#6a4526'); lip.addColorStop(1, '#2e1b0c');
  g.fillStyle = lip; g.beginPath(); g.ellipse(x, y, rx * 1.22, ry * 1.15, 0, 0, TAU); g.fill();
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.clip();
  g.fillStyle = '#0a0503'; g.fillRect(x - rx, y - ry, 2 * rx, 2 * ry);
  const comb = g.createRadialGradient(x - rx * 0.2, y + ry * 0.55, 0, x, y + ry * 0.7, rx * 1.2);
  comb.addColorStop(0, '#e9c070'); comb.addColorStop(0.5, '#b87a26'); comb.addColorStop(1, 'rgba(60, 32, 6, 0)');
  g.fillStyle = comb; g.beginPath(); g.ellipse(x, y + ry * 0.75, rx * 1.1, ry * 0.5, 0, 0, TAU); g.fill();
  const lid = g.createLinearGradient(0, y - ry, 0, y + ry * 0.2);
  lid.addColorStop(0, 'rgba(4, 2, 1, 0.95)'); lid.addColorStop(1, 'rgba(4, 2, 1, 0)');
  g.fillStyle = lid; g.fillRect(x - rx, y - ry, 2 * rx, ry * 1.2);
  g.restore();
  return s;
}

// The 🌳 is drawn all but the foot of its own trunk, which the painted trunk stands in for.
function clipFoot(px) {
  ctx.beginPath();
  ctx.rect(-px, -px * 2, px * 2, px * 1.94);
  ctx.rect(-px, -px * 0.1, px * 0.84, px * 0.6);
  ctx.rect(px * 0.16, -px * 0.1, px * 0.84, px * 0.6);
  ctx.clip();
}

// The hive's tree. In leaf, a painted old trunk stands in for the 🌳's own. As the leaves drop the
// 🪾 comes through, an old trunk already, and the painted one fades with the leaves; the hollow
// stays put through it all.
function drawBeeTree(d, sx, sy, now, ck) {
  const h = d.hive, px = d.size * cam.zoom;
  let hx, sill, rx;
  if (drawPaintedTree(d, sx, sy, now, ck)) {                 // the hive oak, the hive in its trunk
    const f = px / TREE_UNIT, a = treeSway(d, now);         // (the door sways with the tree)
    hx = sx + HIVE_DOOR[0] * f - HIVE_DOOR[1] * f * Math.sin(a); sill = sy + HIVE_DOOR[1] * f; rx = 0.02;
  } else {
    if (treeWorker) return;                                  // nothing to show yet: it fades in when its painting comes
    const fall = treeLook(d, ck).fall;
    drawDecor(d, sx, sy, now, ck, clipFoot);
    const put = s => ctx.drawImage(s.canvas, sx - s.ox, sy - s.oy, s.W, s.H);
    if (fall < 1) { ctx.globalAlpha = 1 - fall; put(trunkSprite(px)); ctx.globalAlpha = 1; }
    put(trunkSprite(px, true));
    hx = sx + OLD_HOLE.x * px; sill = sy + (OLD_HOLE.y + OLD_HOLE.ry * 1.1) * px; rx = OLD_HOLE.rx;
  }
  // Bees on the sill, a few wandering on the bark; they shuffle while time runs.
  const ry = OLD_HOLE.ry;
  // A full hive has honey oozing over the sill.
  if (h.honey > 800) {
    const x = hx - rx * px * 0.85, y = sill - ry * px * 0.45, r = px * 0.011;
    const len = r * (1 + 1.5 * Math.min(1, (h.honey - 800) / 700));
    const g = ctx.createLinearGradient(x - r, y, x + r, y + len);
    g.addColorStop(0, 'rgba(255, 205, 90, 0.95)'); g.addColorStop(1, 'rgba(205, 125, 15, 0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y);
    ctx.quadraticCurveTo(x - r * 0.5, y + len - r, x - r, y + len); ctx.arc(x, y + len, r, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + r * 0.5, y + len - r, x + r * 0.5, y); ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 225, 0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y + len - r * 0.2, r * 0.3, 0, TAU); ctx.fill();
  }
  const n = Math.min(16, 3 + h.bees), b = cam.zoom * 0.045, t = ui.speed > 0 ? performance.now() / 700 : 0;
  for (let i = 0; i < n; i++) {
    const far = i >= n * 0.7;
    const bx = hx + (hash2(1, i, h.id) - 0.5) * px * (far ? 0.12 : 0.06) + Math.sin(t + i) * b * 0.4;
    const by = sill + (far ? hash2(i, 1, h.id) * 0.05 : hash2(i, 1, h.id) * 0.01) * px + Math.cos(t * 0.8 + i) * b * 0.3;
    barkBee(bx, by, b, Math.PI / 2 + (hash2(i, 2, h.id) - 0.5) * 2.5);
  }
}

// A swarm hanging from a branch: a drooping clump of bees, widest near the bottom, bigger the
// more bees there are, and seething while time runs.
function drawSwarm(h, sx, sy) {
  const z = cam.zoom, n = Math.min(80, 12 + 4 * h.bees), b = z * 0.09, t = ui.speed > 0 ? performance.now() / 500 : 0;
  const top = sy - z * 1.6, len = z * (0.5 + 0.04 * Math.min(h.bees, 30)), wide = len * 0.4;
  for (let i = 0; i < n; i++) {
    const v = hash2(i, 3, h.id), u = hash2(3, i, h.id) - 0.5;
    const bx = sx + u * 2 * wide * Math.sin(Math.PI * Math.pow(v, 0.6)) + Math.sin(t + i) * b * 0.3;
    const by = top + v * len + Math.cos(t * 0.7 + i) * b * 0.3;
    barkBee(bx, by, b, Math.PI / 2 + (hash2(i, 4, h.id) - 0.5) * 2);
  }
}

// The trunk, from its foot up to where the crown begins, and never smaller than a fingertip.
// (Above that is the tree: THINGS.tree.)
function hiveAt(sx, sy, swarms = false) {
  return world.hives.find(h => {
    if (h.cluster && !swarms) return false;
    const P = cam.zoom * (h.tree ? h.tree.size : S.HIVE_TREE), reach = Math.max(22, P * 0.12);
    const [hx, hy] = toScreen(h.x, h.y);
    return Math.abs(sx - hx) < reach && sy > hy - P * 0.3 - reach / 2 && sy < hy + reach / 2;
  }) || null;
}

// The water, for the ground's shader: the water map softened by a few box blurs, which it turns
// into soft layers (sand fading into the grass, a little shade under the bank, shallows,
// and a darker blue where it gets too deep to wade, so the fords show as pale stretches of river),
// and the lie of the land around it. Handed over again when the water rises or drops, at most
// once a second.
let pond = null;
const waterData = new Float32Array(S.W * S.H * 4), shapeData = new Float32Array(S.W * S.H * 4);
function blurred(src) {
  const out = new Float32Array(S.W * S.H), at = (x, y) => src[clamp(y, 0, S.H - 1) * S.W + clamp(x, 0, S.W - 1)];
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += at(x + dx, y + dy);
    out[y * S.W + x] = n / 9;
  }
  return out;
}

function updateWater() {
  const now = performance.now();
  if (pond && pond.world === world && (pond.version === world.waterVersion || now - pond.at < 1000)) return;
  const wet = Float32Array.from(world.water, v => v ? 1 : 0), deep = Float32Array.from(world.water, v => v === S.DEEP ? 1 : 0);
  const f1 = blurred(wet), f2 = blurred(f1), f4 = blurred(blurred(f2)), d2 = blurred(blurred(deep));
  // Where little waves come and go: a scatter of spots well inside still water (the rivers have their current).
  const waves = [], running = flowOf().running;
  for (let i = 0; i < f2.length; i++) {
    const x = i % S.W, y = (i / S.W) | 0, h = hash2(x, y, world.seed);
    if (f2[i] > 0.9 && h < 0.14 && !running[i]) waves.push({ x: x + hash2(y, x, 7), y: y + hash2(x, y, 11), ph: h / 0.14 });
  }
  // Reeds in patches along the shore, and lily pads out on quiet shallows away from the deep (drawShore).
  const shore = [];
  for (let i = 0; i < f1.length; i++) {
    const x = i % S.W, y = (i / S.W) | 0, h = hash2(x, y, world.seed + 5), wet = world.water[i];
    const reed = hash2(x >> 2, y >> 2, world.seed + 6) < 0.55 && (wet ? wet !== S.DEEP && f1[i] < 0.8 && h < 0.3 : f1[i] > 0.2 && h < 0.4);
    const lily = !reed && wet === S.SHALLOW && f4[i] > 0.6 && d2[i] < 0.35 && h > 0.88 && !running[i];   // in still water
    if (!reed && !lily) continue;
    const px = x + 0.2 + 0.6 * hash2(y, x, 8), py = y + 0.2 + 0.6 * hash2(y, x, 9);
    if (reed && world.burrows.some(b => Math.abs(b.x - px) < 1.5 && Math.abs(b.y - py) < 1.5)) continue;
    const shape = Math.floor(hash2(x, y, 10) * 3);
    shore.push({ x: px, y: py, art: (reed ? REED_ARTS : LILY_ARTS)[shape], lily, size: (reed ? 1.1 : 1.3) + 0.6 * hash2(x, y, 12) });
  }
  const woods = pond && pond.world === world ? pond.woods : S.distanceTo(Uint8Array.from(world.wood, v => v > 0.25 ? 1 : 0));
  pond = { world, version: world.waterVersion, at: now, waves, woods, shore, wet: f1 };
  if (!Ground.ok) return;
  const toWater = S.distanceToWater(world);
  for (let i = 0; i < f1.length; i++) {
    const o = i * 4;
    waterData[o] = f1[i]; waterData[o + 1] = f2[i]; waterData[o + 2] = f4[i]; waterData[o + 3] = d2[i];
    shapeData[o] = (world.ground[i] - world.level) / 0.6;     // about 0 at the water to 1 on the hilltops
    shapeData[o + 1] = Math.min(toWater[i], 50); shapeData[o + 2] = Math.min(woods[i], 50);
  }
  Ground.set('water', waterData); Ground.set('shape', shapeData);
}

const iceOver = () => world.ice * 0.72;   // frozen over (the sim's w.ice: it holds once it's all the way)

// Little waves on open water: a small ~ that rises, drifts downwind and settles again.
// The wind makes more of them show and bigger; ice stills the water.
function drawWaves(now) {
  const m = ui.sky.mix, wind = 0.4 * m.cloudy + 0.7 * m.rain + m.storm;
  const z = cam.zoom, a = (0.45 + 0.3 * Math.min(1, wind)) * (1 - iceOver() / 0.72) * clamp((z - 9) / 5, 0, 1);   // from afar they'd only be speckle
  if (a <= 0.05) return;
  const big = 1 + 0.4 * Math.min(1, wind), w = z * 0.34 * big, h = w * 0.22;
  ctx.save();
  ctx.strokeStyle = '#f4fbff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, z * 0.07);
  for (const p of pond.waves) {
    const life = (now / (5200 - 2000 * Math.min(1, wind)) + p.ph) % 1;
    const b = Math.sin(Math.PI * life);
    if (b < 0.08) continue;
    const [sx, sy] = toScreen(p.x + (life - 0.5) * 0.7, p.y);
    if (!visible(sx, sy, w * 2) || !fadeAt(p.x, p.y)) continue;
    const s = 0.6 + 0.4 * b;                                     // rises, then settles
    ctx.globalAlpha = a * b;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {                             // a short ~ of a wave and a half
      const u = k / 12;
      ctx.lineTo(sx + w * s * (2 * u - 1), sy - h * s * Math.sin(u * 3 * Math.PI));
    }
    ctx.stroke();
  }
  unfade();
  ctx.restore();
}

// ------------------------------------------------------------------ the rivers running
//
// The rivers run (sim.js w.rivers: points half a tile apart, from upstream down), and four things show it:
// pale streaks of current riding down the channel, quicker down the middle than by the banks; white water
// where it breaks (over a ford, round the stepping stones, where the brook comes in, where the river leaves
// the lake); riffles round the stepping stones; and in their season leaves and petals floating by. Each is
// placed by the flow's clock alone, from where it set off and how long it has been going, so nothing is kept
// from frame to frame. The clock runs faster while the water is high and slower while it's low, and a little
// faster at 4x and up, so the river doesn't doze while the sun races (flowTick).
//
// Which way each river runs, how wide and how fast, comes from the sim (w.current, makeCurrent). Worked out from
// that once a meadow (flowOf): when water that set off from the river's start gets to each point (`at`), and how
// white it is there (`foam`). Streaks set off from a few slots at each point, and the river is cut into stretches
// (`box`: what its streaks can reach), so a frame only looks at the stretches on screen.
const FLOW_SPEED = 2.6;            // tiles a second down the middle of a river about two tiles wide (the sim's pace 1)
const FLOW_BANK = 0.5;             // how much slower it runs at the banks than down the middle (as the sim's BANK_SLOW)
const FLOW_STREAKS = 0.45;         // streaks of current to a square tile of running water
const FLOW_SLOTS = 2;              // where a streak can set off, at each point
const STREAK_LIFE = [2, 1.6];      // how long a streak lasts on the flow's clock: at least, and up to this much more
const FLOW_FOAM = 2;               // flecks of white water, at most, to a point where it's all white
const FLOW_CHUNK = 16;             // points (8 tiles) of river looked at together
const FLOW_FLOATS = 0.5;           // things floating in from upstream, at most, to a tile of river (by season: FLOAT_SHARE)
const FLOAT_SHARE = [0.7, 0.4, 1, 0.3];
const smooth = (a, b, x) => ease(clamp((x - a) / (b - a), 0, 1));
let flow = null;
function flowOf() {
  if (flow && flow.world === world) return flow;
  const level = world.terrain.level, g = world.ground;
  const idx = (x, y) => clamp(Math.floor(y), 0, S.H - 1) * S.W + clamp(Math.floor(x), 0, S.W - 1);
  const wetAt = (x, y) => g[idx(x, y)] < level, lake = world.lake && world.lake.near;
  const rivers = world.rivers.map((rv, ri) => {
    const C = world.current.rivers[ri], pts = rv.pts, n = pts.length, F = () => new Float32Array(n);
    const R = { pts, n, ri, brook: rv.brook, tx: C.tx, ty: C.ty, half: C.half, mid: C.mid, still: C.still, rif: C.rif, end: C.end,
      v: F(), at: F(), foam: F() };
    for (let k = 0; k < n; k++) R.v[k] = FLOW_SPEED * C.pace[k];
    for (let k = 1; k < n; k++) {
      const a = pts[k - 1], b = pts[k];
      R.at[k] = R.at[k - 1] + Math.hypot(b.x - a.x, b.y - a.y) / Math.max(0.02, (R.v[k - 1] + R.v[k]) / 2);
    }
    // White water: over a ford, and where still water picks up again (out of the lake, out of a wide stretch).
    for (let k = 0; k < n; k++) {
      let drop = 0;
      for (let j = Math.max(0, k - 10); j < k; j++) drop = Math.max(drop, R.still[j] - R.still[k]);
      R.foam[k] = Math.max(0.8 * R.rif[k], clamp(1.5 * drop, 0, 0.8));
    }
    return R;
  });
  // Where a brook runs into the river: a rush of white water there and a little way down.
  for (const B of rivers) {
    const j = world.current.rivers[B.ri].joins, into = j && rivers[j.river];
    if (!j) continue;
    for (let k = Math.max(0, B.end - 8); k <= B.end; k++) B.foam[k] = Math.max(B.foam[k], 0.7 * (1 - (B.end - k) / 9));
    for (let k = Math.max(0, j.k - 2); k < Math.min(into.n, j.k + 16); k++) into.foam[k] = Math.max(into.foam[k], 0.8 * Math.exp(-(((k - j.k - 3) / 6) ** 2)));
  }
  // Where the current runs (no lake waves or lilies there), how thick the streaks set off at each point, and the stretches.
  const running = new Uint8Array(S.W * S.H);
  for (const R of rivers) {
    R.dens = new Float32Array(R.n); R.life = new Float32Array(R.n * FLOW_SLOTS); R.ph = new Float32Array(R.n * FLOW_SLOTS);
    R.flife = new Float32Array(R.n * FLOW_FOAM); R.fph = new Float32Array(R.n * FLOW_FOAM);
    let length = 0;
    for (let k = 0; k < R.end; k++) {
      const go = 1 - R.still[k], p = R.pts[k];
      length += go * 0.5;
      for (let s = 0; s < FLOW_SLOTS; s++) {
        const j = k * FLOW_SLOTS + s;
        R.life[j] = STREAK_LIFE[0] + STREAK_LIFE[1] * hash2(j, R.ri, 41); R.ph[j] = hash2(j, R.ri, 42);
      }
      for (let s = 0; s < FLOW_FOAM; s++) {
        const j = k * FLOW_FOAM + s;
        R.flife[j] = 0.7 + 0.6 * hash2(j, R.ri, 51); R.fph[j] = hash2(j, R.ri, 52);
      }
      if (go < 0.08 || R.half[k] < 0.3 || !wetAt(p.x, p.y)) { R.foam[k] = 0; continue; }
      R.dens[k] = Math.min(1, FLOW_STREAKS * Math.min(3, R.half[k]) * go / FLOW_SLOTS);   // (half a tile along, twice the half across)
      if (go < 0.5) continue;
      const cx = p.x - R.ty[k] * R.mid[k], cy = p.y + R.tx[k] * R.mid[k], reach = R.half[k] + 0.7;
      for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(S.H - 1, cy + reach); y++)
        for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(S.W - 1, cx + reach); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 < reach * reach && !(lake && lake[y * S.W + x])) running[y * S.W + x] = 1;
    }
    R.foam[R.end] = 0;
    R.trickle = Math.round(length * FLOW_FLOATS); R.src = [];
    // Each stretch's box: its own points and as far down as a streak setting off from them gets, and the river's width.
    const chunks = Math.ceil(R.end / FLOW_CHUNK), last = STREAK_LIFE[0] + STREAK_LIFE[1] + 0.5;
    R.box = new Float32Array(chunks * 4); R.seen = new Uint8Array(chunks);
    for (let c = 0; c < chunks; c++) {
      const k0 = c * FLOW_CHUNK, k1 = Math.min(R.end - 1, k0 + FLOW_CHUNK - 1);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = k0; k <= R.end && (k <= k1 || R.at[k] - R.at[k1] < last); k++) {
        const p = R.pts[k], m = Math.abs(R.mid[k]) + R.half[k] + 3;   // (and a streak's tail upstream)
        x0 = Math.min(x0, p.x - m); y0 = Math.min(y0, p.y - m); x1 = Math.max(x1, p.x + m); y1 = Math.max(y1, p.y + m);
      }
      R.box.set([x0, y0, x1, y1], c * 4);
    }
    R.stones = [];
  }
  for (const f of world.fords) {                     // the stepping stones in the water, for the riffles
    const R = rivers[f.river];
    if (!R) continue;
    for (const d of world.decor) if (d.stone && Math.hypot(d.x - f.x, d.y - f.y) < 4) R.stones.push({ d, k: Math.min(f.k, R.end - 1) });
  }
  // Which point of which river each tile by the running water lies over: a tree there drops things in (floatSources).
  const bank = new Int32Array(S.W * S.H).fill(-1), gap = new Float32Array(S.W * S.H).fill(Infinity);
  for (const R of rivers) for (let k = 0; k < R.end; k++) {
    if (!R.dens[k]) continue;
    const p = R.pts[k], cx = p.x - R.ty[k] * R.mid[k], cy = p.y + R.tx[k] * R.mid[k], reach = R.half[k] + BANK_REACH;
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(S.H - 1, cy + reach); y++)
      for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(S.W - 1, cx + reach); x++) {
        const i = y * S.W + x, d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d2 < reach * reach && d2 < gap[i]) { gap[i] = d2; bank[i] = R.ri << 16 | k; }
      }
  }
  flow = { world, rivers, running, bank, day: -1 };
  return flow;
}
// Where on its river a thing is that set off from point k0 (fractional, before the end) `age` seconds of the
// flow's clock ago: a point, and how far on to the next. -1 once it's past the end.
function flowFind(R, k0, age) {
  const at = R.at, i = k0 | 0, t = at[i] + (at[i + 1] - at[i]) * (k0 - i) + age;
  if (t >= at[R.end]) return -1;
  let lo = i, hi = R.end;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (at[m] <= t) lo = m; else hi = m; }
  return lo + (t - at[lo]) / Math.max(1e-6, at[lo + 1] - at[lo]);
}
// The same for a streak or a fleck, which don't get far: a walk down from where it set off.
function flowNear(R, k0, age) {
  const at = R.at, i = k0 | 0, t = at[i] + (at[i + 1] - at[i]) * (k0 - i) + age;
  if (t >= at[R.end]) return -1;
  let k = i;
  while (at[k + 1] <= t) k++;
  return k + (t - at[k]) / Math.max(1e-6, at[k + 1] - at[k]);
}
// The spot `lane` (-1..1, one bank to the other) across the river at point kf (fractional): into flowAt. The way
// it runs, the width and the middle are blended between the points, or a thing hops sideways at each one.
const flowAt = { x: 0, y: 0 };
function flowSpot(R, kf, lane) {
  const k = Math.min(R.n - 2, Math.max(0, Math.floor(kf))), f = kf - k, g = 1 - f, j = k + 1, a = R.pts[k], b = R.pts[j];
  const off = g * (R.mid[k] + lane * R.half[k]) + f * (R.mid[j] + lane * R.half[j]);
  const tx = g * R.tx[k] + f * R.tx[j], ty = g * R.ty[k] + f * R.ty[j];
  flowAt.x = a.x + (b.x - a.x) * f - ty * off;
  flowAt.y = a.y + (b.y - a.y) * f + tx * off;
  return flowAt;
}
const flowLerp = (A, kf) => { const k = kf | 0, f = kf - k; return f ? A[k] + (A[k + 1] - A[k]) * f : A[k]; };   // A at point kf
const wetTile = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H && world.water[(y | 0) * S.W + (x | 0)] !== 0;
// How much water there is at (x, y) as the ground draws it (pond.wet, the shader's water field): its edge is at 0.47.
function wetness(x, y) {
  const f = pond.wet, qx = clamp(x - 0.5, 0, S.W - 1.001), qy = clamp(y - 0.5, 0, S.H - 1.001);
  const i = qx | 0, j = qy | 0, u = qx - i, v = qy - j, o = j * S.W + i;
  return (f[o] + (f[o + 1] - f[o]) * u) * (1 - v) + (f[o + S.W] + (f[o + S.W + 1] - f[o + S.W]) * u) * v;
}
const laneSpeed = lane => 1 - FLOW_BANK * lane * lane;   // quickest down the middle

// The flow's clock, in seconds; it stops while the game is paused. Returns how fast the water runs now against its
// usual pace (the sim's riverPace).
let flowClock = 0, flowLast = 0;
function flowTick(now) {
  const dt = clamp((now - flowLast) / 1000, 0, 0.1), water = S.riverPace(world);
  flowLast = now;
  flowClock += dt * water * (ui.speed > 1 ? ui.speed ** 0.17 : ui.speed > 0 ? 1 : 0);
  return water;
}

// What a frame draws, gathered first and drawn in one go per shade: each streak its head, tail and how far its
// curls swing out (0: a plain stroke), and each fleck of foam where and how big.
// Enough shades that one fading in or out doesn't visibly step.
const SHADES = 8, FLECK_SHADES = 6;
const STREAK_MAX = 1500, streakBuf = Array.from({ length: SHADES + 1 }, () => new Float32Array(STREAK_MAX * 5)), streakN = new Int32Array(SHADES + 1);
const FLECK_MAX = 1500, fleckBuf = Array.from({ length: FLECK_SHADES + 1 }, () => new Float32Array(FLECK_MAX * 3)), fleckN = new Int32Array(FLECK_SHADES + 1);
const FLECKS = [0, 0, 1, -0.24, 0.08, 0.8, -0.42, -0.06, 0.65];   // a fleck of foam: a few blobs, each along, across, size
function drawFlow(now, ck) {
  const water = flowTick(now);
  if (!world.rivers.length) return;
  const z = cam.zoom, open = 1 - iceOver() / 0.72;
  if (open <= 0.05 || z < 5) return;
  const F = flowOf(), T = flowClock, dens = Math.sqrt(water);
  const ox = vw / 2 - cam.x * z, oy = vh / 2 - cam.y * z;
  const curl = z >= 12, foamy = z >= 8;              // further out the ~ would be under a pixel: a plain stroke
  const few = 0.75 + 0.25 * smooth(6, 16, z);           // and fewer of them: from afar a river full of lines looks busy
  streakN.fill(0); fleckN.fill(0);
  // The current: a pale streak sets off, rides downstream and fades. The faster the water, the longer and
  // brighter; over a ford the riffle streaks join in, short ones, any way across.
  // `there`: how much of it there is (it fades in and out as the water rises and falls, rather than popping).
  const streak = (R, k0, u, life, lane, bright, there) => {
    const ls = laneSpeed(lane), kf = flowNear(R, k0, u * life * ls);
    if (kf < 0) return;
    const b = Math.sin(Math.PI * u), vk = flowLerp(R.v, kf) * ls * water, rif = flowLerp(R.rif, kf);   // tiles a second, as it looks
    let a = there * b * (1 - flowLerp(R.still, kf)) * Math.min(1, (bright || clamp(0.4 + 0.13 * vk, 0.5, 0.9)) + 0.5 * rif);
    if (a * SHADES < 0.5) return;
    const head = flowSpot(R, kf, lane), x = head.x, y = head.y, hx = ox + x * z, hy = oy + y * z;
    if (!visible(hx, hy, z * 2.5) || mistAt(x, y) > 0.4) return;
    const s = 0.6 + 0.4 * b, len = clamp(0.45 * vk, 0.6, 2.4) * (bright ? 0.5 : 1) * s;   // tiles
    const tail = flowSpot(R, Math.max(0, kf - 2 * len), lane), tx = tail.x, ty = tail.y;
    a *= smooth(0.5, 0.62, Math.min(wetness(x, y), wetness(tx, ty)));   // it fades as it nears the bank, head or tail
    const shade = Math.round(a * SHADES);
    if (shade < 1 || streakN[shade] >= STREAK_MAX) return;
    const o = streakN[shade]++ * 5, buf = streakBuf[shade];
    buf[o] = hx; buf[o + 1] = hy; buf[o + 2] = ox + tx * z; buf[o + 3] = oy + ty * z;
    buf[o + 4] = curl ? 0.15 * s * z / (1 + 0.4 * len) : 0;   // (a curve's control point lies twice as far out as its top)
  };
  // White water: flecks that bob up, race down a little way and go.
  const fleck = (R, k, j, a) => {
    const life = R.flife[j], t = T / life + R.fph[j], c = Math.floor(t), u = t - c;
    if (hash2(j, c, 53) >= a) return;
    const lane = (hash2(j, c, 54) * 2 - 1) * 0.8, ls = laneSpeed(lane), kf = flowNear(R, k + hash2(j, c, 55), u * life * ls);
    if (kf < 0) return;
    const p = flowSpot(R, kf, lane), x = p.x, y = p.y, sx = ox + x * z, sy = oy + y * z;
    if (!visible(sx, sy, z) || mistAt(x, y) > 0.4) return;
    const shade = Math.round(Math.sin(Math.PI * u) * smooth(0.52, 0.65, wetness(x, y)) * FLECK_SHADES);
    if (shade < 1 || fleckN[shade] >= FLECK_MAX - 3) return;
    const tx = flowLerp(R.tx, kf), ty = flowLerp(R.ty, kf);
    const r = z * (0.06 + 0.03 * hash2(j, c, 56)) * (1 - 0.4 * u), spread = 1 + 0.6 * u, buf = fleckBuf[shade];
    for (let i = 0; i < FLECKS.length; i += 3) {
      const o = fleckN[shade]++ * 3, a = FLECKS[i] * spread * z, b = FLECKS[i + 1] * spread * z;
      buf[o] = sx + tx * a - ty * b; buf[o + 1] = sy + ty * a + tx * b; buf[o + 2] = Math.max(0.7, r * FLECKS[i + 2]);
    }
  };
  for (const R of F.rivers) {
    const box = R.box;
    for (let c = 0, chunks = box.length / 4; c < chunks; c++) {
      R.seen[c] = ox + box[c * 4 + 2] * z > 0 && oy + box[c * 4 + 3] * z > 0 && ox + box[c * 4] * z < vw && oy + box[c * 4 + 1] * z < vh ? 1 : 0;
      if (!R.seen[c]) continue;
      for (let k = c * FLOW_CHUNK, k1 = Math.min(R.end, k + FLOW_CHUNK); k < k1; k++) {
        const p = R.dens[k] * dens * few;
        if (p > 0) for (let s = 0; s < FLOW_SLOTS; s++) {
          const j = k * FLOW_SLOTS + s, life = R.life[j], t = T / life + R.ph[j], cy = Math.floor(t), h = hash2(j, cy, 43 + R.ri);
          if (h < p) streak(R, k + hash2(j, cy, 45), t - cy, life, (hash2(j, cy, 44) * 2 - 1) * 0.85, 0, Math.min(1, 4 * (p - h) / p));
        }
        if (foamy && R.foam[k] > 0.03) for (let s = 0; s < FLOW_FOAM; s++) fleck(R, k, k * FLOW_FOAM + s, R.foam[k] * dens);
      }
    }
    for (const s of R.stones) {                       // riffles: below each stone, quick and short
      const [sx, sy] = toScreen(s.d.x, s.d.y);
      if (!visible(sx, sy, z * 6)) continue;
      for (let j = 0; j < 5; j++) {
        const life = 0.7 + 0.5 * hash2(j, s.d.x * 7 | 0, 45), t = T / life + hash2(j, s.d.y * 7 | 0, 46), c = Math.floor(t);
        const k0 = clamp(s.k + Math.round((hash2(j, c, 47) - 0.5) * 6), 0, R.end - 1);
        streak(R, k0, t - c, life, (hash2(j, c, 48) * 2 - 1) * 0.95, 1, 1);
      }
    }
  }
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Under a pixel wide a line is still drawn a pixel wide, so it's fainter instead (by a bit less, or it'd be lost).
  const A = 0.75 * open * smooth(4, 9, z) * Math.sqrt(Math.min(1, z * 0.08));
  ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = Math.max(1, z * 0.08);
  for (let shade = 1; shade <= SHADES && A > 0.02; shade++) {
    const n = streakN[shade], buf = streakBuf[shade];
    if (!n) continue;
    ctx.globalAlpha = A * shade / SHADES;
    ctx.beginPath();
    for (let i = 0; i < n * 5; i += 5) {
      const hx = buf[i], hy = buf[i + 1], dx = buf[i + 2] - hx, dy = buf[i + 3] - hy, amp = buf[i + 4];
      ctx.moveTo(hx, hy);
      if (!amp) { ctx.lineTo(hx + dx, hy + dy); continue; }
      const d = Math.hypot(dx, dy) || 1, nx = -dy / d * amp, ny = dx / d * amp;   // a wave and a half: three arches
      for (let q = 1; q <= 3; q++) {
        const f = q & 1 ? 1 : -1;
        ctx.quadraticCurveTo(hx + dx * (q - 0.5) / 3 + nx * f, hy + dy * (q - 0.5) / 3 + ny * f, hx + dx * q / 3, hy + dy * q / 3);
      }
    }
    ctx.stroke();
  }
  const FA = 0.8 * open * smooth(8, 12, z);
  ctx.fillStyle = '#fbfeff';
  for (let shade = 1; shade <= FLECK_SHADES && FA > 0.02; shade++) {
    const n = fleckN[shade], buf = fleckBuf[shade];
    if (!n) continue;
    ctx.globalAlpha = FA * shade / FLECK_SHADES;
    ctx.beginPath();
    for (let i = 0; i < n * 3; i += 3) { ctx.moveTo(buf[i] + buf[i + 2], buf[i + 1]); ctx.arc(buf[i], buf[i + 1], buf[i + 2], 0, TAU); }
    ctx.fill();
  }
  // Riffles: the water parts round each stepping stone in a little V that trails downstream, and won't keep still.
  const rv = 0.8 * open * smooth(9, 13, z);
  if (rv > 0.02) {
    ctx.beginPath();
    for (const R of F.rivers) for (const s of R.stones) {
      const d = s.d, [sx, sy] = toScreen(d.x, d.y);
      if (!visible(sx, sy, z * 3) || !wetTile(d.x, d.y)) continue;
      const k = s.k, tx = R.tx[k], ty = R.ty[k], w = d.size * z * 0.42, ph = hash2(d.x * 9 | 0, d.y * 9 | 0, 49) * TAU;
      for (let side = -1; side <= 1; side += 2) {
        const len = d.size * z * (0.6 + 0.15 * Math.sin(T * 2.6 + ph + side) + 0.08 * Math.sin(T * 4.1 + 2 * ph)) * Math.min(1.4, water);
        const ax = sx - ty * w * side, ay = sy + tx * w * side - z * 0.05;
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(ax + tx * len * 0.5, ay + ty * len * 0.5, ax + tx * len - ty * len * 0.35 * side, ay + ty * len + tx * len * 0.35 * side);
      }
    }
    ctx.strokeStyle = '#f8fdff'; ctx.lineWidth = Math.max(1, z * 0.08);
    ctx.globalAlpha = rv;
    ctx.stroke();
  }
  ctx.restore();
  drawFloats(T, z, open, ck, ox, oy);
}

// Things floating down: petals and leaves, a feather, a twig. Most fall in from the trees on the bank, each dropping
// what it has in its season on its side of the river: blossom off a cherry, an apple or a thorn in flower, in autumn
// leaves coloured by its kind, now and then a green one in summer and a brown one or a twig in winter. A few float in
// from upstream or drop from the sky (FLOAT_LOOKS). Each lands with a ring, floats down turning slowly, and after a
// while sinks, or once it's out on still water (or they'd line up along the river's way through the lake). Each look
// is painted once (floatSprite) and drawn turned, its shadow under it on the water.
const FLOAT_LOOKS = [                                 // from upstream, by season, picked evenly: [shape, colour]
  [[1, [248, 190, 208]], [1, [252, 236, 240]], [0, [126, 180, 72]], [0, [140, 190, 84]], [0, [126, 180, 72]]],     // spring: a petal, a fresh leaf
  [[0, [104, 154, 64]], [0, [86, 136, 58]], [0, [118, 160, 70]], [2, [236, 236, 230]], [3, [246, 246, 242]]],     // summer: leaves, a feather, a seed's fluff
  [[0, [222, 132, 44]], [0, [196, 72, 42]], [0, [228, 182, 60]], [0, [150, 98, 52]], [0, [206, 104, 40]]],        // autumn
  [[0, [146, 108, 72]], [0, [122, 92, 64]], [4, [110, 84, 60]], [0, [134, 100, 66]], [4, [96, 74, 54]]],          // winter: brown leaves, twigs
];
const FLOAT_SIZE = [0.5, 0.4, 0.5, 0.26, 0.75];        // tiles: leaf, blossom, feather, fluff, twig
const FLOAT_BOX = 1.5;                                // a sprite, in its lengths
const BANK_REACH = 5;                                 // tiles from the water's edge a tree drops things in, on the wind
const TREE_FLOATS = [4, 1, 5, 1];                     // things a grown tree on the bank drops in at a time, by season (a young one
                                                      // half; in autumn as fast as its leaves are coming down, treeLook's drop)
const PETALS = { cherry: [248, 190, 208], apple: [252, 236, 240], hawthorn: [250, 248, 244] };
const FLOAT_ART = [], floatArt = new Map();          // every look a float has had: [shape, colour]
function lookOf(shape, rgb) {
  rgb = rgb.map(v => Math.min(255, Math.round(v / 16) * 16));   // (a few colours, or the sprites pile up)
  const key = shape + ':' + rgb;
  let i = floatArt.get(key);
  if (i === undefined) { i = FLOAT_ART.length; FLOAT_ART.push([shape, rgb]); floatArt.set(key, i); }
  return i;
}
const FLOAT_IDS = FLOAT_LOOKS.map(looks => looks.map(([shape, rgb]) => lookOf(shape, rgb)));
const scaled = (rgb, k) => rgb.map(v => Math.min(255, Math.round(v * k)));
// What a tree on the bank drops in now, and how many at a time: blossom while it's in flower, its leaves as they're
// drawn (treeLook: green in summer, turning in autumn, as fast as they're coming down), brown ones and twigs in winter.
function treeFloats(d, ck) {
  const s = ck.season, n = TREE_FLOATS[s] * (d.size >= S.GROWN ? 1 : 0.5);
  if (d.kind === 'pine') return null;
  if (s === 0) { const c = PETALS[d.kind]; return c && S.inBloom(world, d) ? { looks: [lookOf(1, c), lookOf(1, scaled(c, 0.95))], n } : null; }
  if (s === 3) return { looks: [lookOf(0, [134, 100, 66]), lookOf(4, [110, 84, 60])], n };
  const t = treeLook(d, ck), c = t.rgb, k = Math.round(s === 2 ? n * t.drop : n);
  return k ? { looks: [lookOf(0, c), lookOf(0, scaled(c, 0.85)), lookOf(0, scaled(c, 1.1))], n: k } : null;
}
// The trees on the bank and what they drop in, worked out again each day: each has a few floats of its own (kept
// by its id, so one coming or going leaves the others be), landing under it on its side of the river.
function floatSources(ck) {
  const day = Math.floor(world.tick / S.TPD);
  if (flow.day === day) return;
  flow.day = day;
  for (const R of flow.rivers) R.src.length = 0;
  for (const d of world.decor) {
    if (!d.tree || d.size < S.SAPLING || !S.standing(d)) continue;
    const b = flow.bank[tileOf(d.x, d.y)], drops = b >= 0 && treeFloats(d, ck);
    if (!drops) continue;
    const R = flow.rivers[b >> 16], k = b & 0xffff, p = R.pts[k];
    const across = (d.y - p.y) * R.tx[k] - (d.x - p.x) * R.ty[k] - R.mid[k];   // its side of the river
    R.src.push({ id: d.id, k, lane: clamp(across / Math.max(0.5, R.half[k]), -0.75, 0.75), looks: drops.looks, n: Math.round(drops.n) });
  }
}
function flowPick(R, u) {                             // a point on the running water, by u in 0..1
  if (!R.pick) {
    R.pick = new Float32Array(R.end);
    for (let k = 0, sum = 0; k < R.end; k++) R.pick[k] = sum += R.dens[k] ? (1 - R.still[k]) * Math.min(3, R.half[k]) : 0;
  }
  const pick = R.pick, want = u * pick[R.end - 1];
  let lo = 0, hi = R.end - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pick[m] < want) lo = m + 1; else hi = m; }
  return lo;
}
function drawFloats(T, z, open, ck, ox, oy) {
  const fz = smooth(8.5, 11, z) * open;               // further out, a speck
  if (fz < 0.02) return;
  floatSources(ck);
  const share = FLOAT_SHARE[ck.season], m = ctx.getTransform(), ex = m.e, ey = m.f;   // (the thunder's shake)
  ctx.save();
  ctx.beginPath();          // Chrome carries the path along through every setTransform: the foam's would cost each float dear
  // One float: a, b say which (from upstream: its number and the river; from a tree: the tree and its number). It
  // lands at point k (or anywhere, k < 0) in lane `lane`, looking like one of `looks`, as much there as `there` says.
  const one = (R, a, b, k, lane, looks, there) => {
    const life = 20 + 15 * hash2(a, b, 62), t = T / life + hash2(a, b, 63), c = Math.floor(t), age = (t - c) * life, h = a * 31 + b;
    const k0 = k < 0 ? flowPick(R, hash2(h, c, 64)) : clamp(k + (hash2(h, c, 64) - 0.5) * 4, 0, R.end - 1.01);
    // It keeps the pace of its own lane and only sways across: were the sway to change its pace, a float that
    // had come a long way would surge and stall (where it is goes by how long it has been going).
    const l0 = lane + (hash2(h, c, 65) - 0.5) * (k < 0 ? 1 : 0.3), ln = clamp(l0 + 0.12 * Math.sin(age * 0.23 + a), -0.85, 0.85);
    const kf = flowFind(R, k0, age * laneSpeed(l0));
    const sink = kf < 0 ? 0 : 1 - smooth(0.3, 0.75, flowLerp(R.still, kf));
    if (sink <= 0 || !R.seen[(kf / FLOW_CHUNK) | 0]) return;   // (its stretch is off screen)
    const p = flowSpot(R, kf, ln), sx = ox + p.x * z, sy = oy + p.y * z, wet = smooth(0.5, 0.62, wetness(p.x, p.y));
    if (!visible(sx, sy, z) || !wet || !fadeAt(p.x, p.y)) return;
    const look = looks[Math.floor(hash2(h, c, 66) * looks.length)], kind = FLOAT_ART[look][0];
    const al = fz * sink * wet * there * Math.min(1, age / 1.5, (life - age) / 4);
    if (age < 1.6) {                                  // where it landed: a ring spreading
      const u = age / 1.6;
      ctx.globalAlpha = 0.75 * fz * there * (1 - u); ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = Math.max(1, z * 0.04);
      ctx.setTransform(dpr, 0, 0, dpr, ex, ey);
      ctx.beginPath(); ctx.ellipse(sx, sy, z * (0.2 + 0.6 * u), z * (0.1 + 0.36 * u), 0, 0, TAU); ctx.stroke();
    }
    const size = z * FLOAT_SIZE[kind] * (0.85 + 0.3 * hash2(h, c, 68)), w = size * FLOAT_BOX;
    const turn = hash2(h, c, 69) * TAU + 0.5 * Math.sin(age * 0.4 + a) + age * (hash2(h, c, 70) - 0.5) * 0.3;
    const cos = Math.cos(turn) * dpr, sin = Math.sin(turn) * dpr;
    if (size > 9) {                                   // its shadow on the water (too small to see, further out), then the thing
      ctx.globalAlpha = 0.25 * al;
      ctx.setTransform(cos, sin, -sin, cos, (sx + size * 0.08) * dpr + ex, (sy + size * 0.16) * dpr + ey);
      ctx.drawImage(floatSprite(-1 - kind, size * dpr), -w / 2, -w / 2, w, w);
    }
    ctx.globalAlpha = al;
    ctx.setTransform(cos, sin, -sin, cos, sx * dpr + ex, sy * dpr + ey);
    ctx.drawImage(floatSprite(look, size * dpr), -w / 2, -w / 2, w, w);
  };
  for (const R of flow.rivers) {
    for (let j = 0; j < R.trickle; j++) {             // from upstream, fewer out of season
      const hj = hash2(j, R.ri, 61);
      if (hj < share) one(R, j, R.ri + 1, -1, 0, FLOAT_IDS[ck.season], clamp((share - hj) * 10, 0, 1));
    }
    for (const s of R.src) for (let m = 0; m < s.n; m++) one(R, s.id, 100 + m, s.k, s.lane, s.looks, 1);
  }
  unfade();
  ctx.restore();
}
// A float's sprite, `want` device pixels a length, painted in steps of about a quarter. look: its place in FLOAT_ART,
// or -1 - shape for a shape's shadow.
const floatSprites = new Map();
function floatSprite(look, want) {
  const step = Math.round(3 * Math.log2(Math.max(4, want))), key = look * 64 + step;
  let img = floatSprites.get(key);
  if (img) return img;
  if (floatSprites.size > 400) { for (const o of floatSprites.values()) freeImage(o); floatSprites.clear(); }
  const U = 2 ** (step / 3), n = Math.ceil(U * FLOAT_BOX), c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = c.height = n;
  g.translate(n / 2, n / 2); g.scale(U, U);
  if (look < 0) { g.fillStyle = '#1c3a58'; floatShape(g, -1 - look, true); }
  else { const [kind, rgb] = FLOAT_ART[look]; floatPaint(g, kind, rgb, dpr / U); }
  floatSprites.set(key, c);
  asBitmap(c, b => { if (floatSprites.get(key) === c) { floatSprites.set(key, b); c.width = 0; } else b.close(); });
  return c;
}
const rgbStr = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
function floatShape(g, kind, fill) {                  // its outline, a unit long
  g.beginPath();
  if (kind === 0) { g.moveTo(-0.5, 0); g.quadraticCurveTo(-0.05, -0.38, 0.5, 0); g.quadraticCurveTo(-0.05, 0.38, -0.5, 0); }
  else if (kind === 1) for (let i = 0; i < 5; i++) {   // five petals round a middle
    const a = i * TAU / 5, x = 0.24 * Math.cos(a), y = 0.24 * Math.sin(a);
    g.moveTo(x + 0.26 * Math.cos(a), y + 0.26 * Math.sin(a)); g.ellipse(x, y, 0.26, 0.19, a, 0, TAU);
  }
  else if (kind === 2) { g.moveTo(-0.5, 0); g.quadraticCurveTo(0, -0.2, 0.5, -0.02); g.quadraticCurveTo(0, 0.14, -0.5, 0); }
  else if (kind === 3) g.arc(0, 0, 0.5, 0, TAU);
  else { g.rect(-0.5, -0.04, 1, 0.08); g.rect(0.05, -0.03, 0.3, 0.06); }
  if (fill) g.fill();
}
// The thing itself, a shade darker round the edge so it shows against the water. px: a screen pixel, in its units.
function floatPaint(g, kind, rgb, px) {
  g.fillStyle = rgbStr(rgb, 0.92);
  floatShape(g, kind, true);
  g.strokeStyle = rgbStr(rgb, 0.62); g.lineWidth = px;
  if (kind !== 3) g.stroke();
  if (kind === 0) {                                   // the lit half, and the midrib
    g.fillStyle = rgbStr(rgb, 1.12);
    g.beginPath(); g.moveTo(-0.5, 0); g.quadraticCurveTo(-0.05, -0.38, 0.5, 0); g.closePath(); g.fill();
    g.strokeStyle = rgbStr(rgb, 0.68); g.lineWidth = Math.max(0.05, px);
    g.beginPath(); g.moveTo(-0.62, 0.02); g.lineTo(0.42, 0); g.stroke();
  } else if (kind === 1) {                            // a warm middle
    g.fillStyle = '#f2c55c';
    g.beginPath(); g.arc(0, 0, 0.11, 0, TAU); g.fill();
  } else if (kind === 2) {
    g.strokeStyle = rgbStr(rgb, 0.7); g.lineWidth = Math.max(0.03, 0.8 * px);
    g.beginPath(); g.moveTo(-0.55, 0.01); g.quadraticCurveTo(0, -0.04, 0.5, -0.02); g.stroke();
  }
}

// Paints over the whole view, with a margin for the thunder shake.
function wash(color) { ctx.fillStyle = color; ctx.fillRect(-10, -10, vw + 20, vh + 20); }

// ------------------------------------------------------------------ weather

const WET = new Set(['rain', 'storm']);
const WEATHER_HINT = {
  clear: 'Nothing special. The ground slowly dries out',
  cloudy: 'Cloud shadows drift over the meadow',
  rain: 'Grass grows three times as fast and the ground soaks up the water',
  storm: 'Grass grows fast. Thunder sends rabbits running home, foxes curl up and wait. Lightning can start a fire on dry ground',
  fog: 'Nobody can see very far: foxes find fewer rabbits, and rabbits spot foxes later',
  snow: 'Grass barely grows and small animals burn extra energy to keep warm',
  heat: 'The grass browns, running is tiring and the ground dries out fast. Careful with lightning',
};

// How much of each weather is showing, so one fades into the next. Follows game time.
function updateSky() {
  const d = world.tick - ui.sky.tick;
  ui.sky.tick = world.tick;
  if (d === 0) return;
  const k = d < 0 ? 1 : 1 - Math.exp(-d / 50);
  for (const kind in S.WEATHER) {
    const m = ui.sky.mix[kind] || 0;
    ui.sky.mix[kind] = m + ((kind === world.weather.kind ? 1 : 0) - m) * k;
  }
}

const drops = Array.from({ length: 300 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
const clouds = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), r: 9 + Math.random() * 12, s: 0.7 + Math.random() * 0.6 }));

// The weather's clock, in ms: real time while the game runs, whatever the speed, and still while it's paused, so
// the rain hangs in the air and the waves on the water hold (drawWaves). (The rainbow and lightning keep to real time.)
let weatherClock = 0, weatherLast = 0;
function weatherTick(now) {
  if (ui.speed > 0) weatherClock += clamp(now - weatherLast, 0, 100);
  weatherLast = now;
  return weatherClock;
}

function drawWeather(now, ck) {
  const m = ui.sky.mix, t = weatherTick(now);
  const shade = 0.12 * m.cloudy + 0.08 * m.rain + 0.10 * m.storm;
  if (shade > 0.01) drawCloudShadows(t, shade);
  const dim = 0.05 * m.cloudy + 0.09 * m.rain + 0.30 * m.storm + 0.04 * m.snow;
  if (dim > 0.005) wash(`rgba(50, 62, 92, ${dim})`);
  if (m.heat > 0.01) wash(`rgba(255, 168, 60, ${0.11 * m.heat})`);
  if (!ck.night) drawRainbow(now);
  if (m.fog > 0.01) drawFog(t, m.fog);
  const rain = m.rain + 1.8 * m.storm;
  if (rain > 0.02) drawRain(t, rain, m.storm);
  if (m.snow > 0.02) drawSnow(t, m.snow);
  drawLightning(now);
}

// Soft shadows that pan and zoom with the meadow, drifting east.
function drawCloudShadows(now, a) {
  const z = cam.zoom, span = S.W + 60;
  ctx.save();
  for (const c of clouds) {
    const wx = ((c.x * span + now / 1000 * 0.5 * c.s) % span) - 30, wy = c.y * S.H;
    const [sx, sy] = toScreen(wx, wy), r = c.r * z;
    if (!visible(sx, sy, r * 1.6)) continue;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
    grad.addColorStop(0, `rgba(30, 40, 70, ${a * 1.6})`);
    grad.addColorStop(1, 'rgba(30, 40, 70, 0)');
    ctx.fillStyle = grad;
    ctx.setTransform(dpr * 1.6, 0, 0, dpr, sx * dpr * (1 - 1.6), 0);   // stretch sideways
    ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, TAU); ctx.fill();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.restore();
}

function drawRain(now, amount, storm) {
  const n = Math.min(drops.length, Math.round(150 * amount)), slant = 3 + 6 * storm;
  ctx.save();
  ctx.strokeStyle = `rgba(210, 230, 255, ${0.45 + 0.15 * storm})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const d = drops[i];
    const y = ((d.y + now / (1400 - 500 * storm) * d.s) % 1) * vh, x = ((d.x - now / 9000) % 1 + 1) % 1 * vw;
    ctx.moveTo(x, y); ctx.lineTo(x - slant, y + 12 * d.s);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSnow(now, amount) {
  const n = Math.round(160 * amount);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const d = drops[i];
    const y = ((d.y + now / 9000 * d.s) % 1) * vh;
    const x = (((d.x + Math.sin(now / 1300 + i) * 0.01) % 1 + 1) % 1) * vw;
    const r = 1.2 + 1.6 * d.s;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
}

function drawFog(now, amount) {
  wash(`rgba(236, 240, 244, ${0.30 * amount})`);
  ctx.save();
  for (let i = 0; i < 6; i++) {                  // slow banks rolling past
    const x = ((i / 6 + now / 60000) % 1.4 - 0.2) * vw, y = vh * (0.15 + 0.14 * i), r = vw * 0.35;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(244, 246, 250, ${0.35 * amount})`);
    grad.addColorStop(1, 'rgba(244, 246, 250, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// Just for looks, so it keeps to real time: a rainbow should last a moment even at 60x.
// It stands over the part of the meadow in view when it came out, sized to the window then, and stays there:
// panning and zooming move it like the ground. Painted once (bow), then copied; while it comes out it's copied
// in slices, from one foot.
const BOW_MS = 14000, BOW_IN = 4000, BOW_OUT = 5000, BOW_RES = 0.5, BOW_OUTER = 1.3, BOW_SLICES = 32;
const BOW_HUES = [[160, 105, 225], [95, 105, 240], [60, 160, 250], [80, 205, 125], [250, 228, 85], [255, 160, 60], [240, 75, 70]];
const bow = { t: 0, x: 0, y: 0, r: 0, R: 0, c: null };   // x, y, r: its centre and radius in the meadow

// One radial gradient, worked out ring by ring: the brighter sky inside, the bow (violet in, red out) with soft
// edges, a slightly darker band, and a faint second bow with its colours the other way round. The feet fade out.
function paintBow(R) {
  const Ro = R * BOW_OUTER, s = BOW_RES, c = bow.c || document.createElement('canvas');
  c.width = Math.ceil(2 * Ro * s); c.height = Math.ceil(Ro * s);
  const g = c.getContext('2d'), cx = c.width / 2, cy = c.height;
  const hue = t => {                                     // t 0 violet .. 1 red
    const f = clamp(t, 0, 1) * (BOW_HUES.length - 1), i = Math.min(BOW_HUES.length - 2, f | 0), k = f - i;
    return BOW_HUES[i].map((v, j) => v + (BOW_HUES[i + 1][j] - v) * k);
  };
  const soft = t => (t <= 0 || t >= 1 ? 0 : Math.pow(Math.sin(Math.PI * t), 0.8));
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Ro * s);
  for (let f = 0.5; f <= 1.0001; f += 0.004) {
    const u = f * BOW_OUTER, t1 = (u - 0.95) / 0.1, t2 = (u - 1.15) / 0.08;
    let col = [255, 255, 248], a = 0.08 * Math.pow(clamp((u - 0.62) / 0.35, 0, 1), 2) * clamp((1 - u) / 0.05, 0, 1);   // the sky inside
    if (u > 1.03 && u < 1.17) { col = [40, 48, 80]; a = 0.05 * soft((u - 1.03) / 0.14); }                 // the dark band
    const layer = (c2, a2) => {                          // a2 over what's there
      const out = a2 + a * (1 - a2);
      if (out > 0) col = col.map((v, j) => (c2[j] * a2 + v * a * (1 - a2)) / out);
      a = out;
    };
    if (t1 > 0 && t1 < 1) layer(hue(t1), 0.8 * soft(t1));
    if (t2 > 0 && t2 < 1) layer(hue(1 - t2), 0.28 * soft(t2));
    grad.addColorStop(Math.min(f, 1), `rgba(${col.map(Math.round).join(',')},${a.toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const feet = g.createLinearGradient(0, cy, 0, cy - R * s * 0.6);
  feet.addColorStop(0, 'rgba(0,0,0,0)');
  feet.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = feet;
  g.fillRect(0, 0, c.width, c.height);
  bow.c = c; bow.R = R;
}

function drawRainbow(now) {
  const age = now - ui.sky.rainbow;
  if (!ui.sky.rainbow || age > BOW_MS) return;
  if (bow.t !== ui.sky.rainbow) {
    const R = Math.round(Math.min(vh * 0.74, vw * 0.7) / 8) * 8;    // its top a quarter down; a whole arch on a phone
    if (bow.R !== R) paintBow(R);
    const [x, y] = toWorld(vw * 0.55, Math.min(vh * 1.02, vh * 0.28 + R));
    Object.assign(bow, { t: ui.sky.rainbow, x, y, r: R / cam.zoom });
  }
  const [cx, cy] = toScreen(bow.x, bow.y), Ro = bow.r * cam.zoom * BOW_OUTER;
  if (cx + Ro < 0 || cx - Ro > vw || cy < 0 || cy - Ro > vh) return;
  const x0 = cx - Ro, y0 = cy - Ro, w = 2 * Ro, h = Ro;
  const fade = Math.min(1, (BOW_MS - age) / BOW_OUT), peak = 0.85 * fade * fade * (3 - 2 * fade);
  ctx.save();
  if (age >= BOW_IN) {
    ctx.globalAlpha = peak;
    ctx.drawImage(bow.c, x0, y0, w, h);
  } else {                                     // coming out from the left foot: a soft front sweeps across
    const p = age / BOW_IN, front = p * p * (3 - 2 * p) * 1.4, sw = bow.c.width / BOW_SLICES;
    let left = Math.round(x0 * dpr) / dpr;
    for (let i = 0; i < BOW_SLICES; i++) {
      const right = Math.round((x0 + w * (i + 1) / BOW_SLICES) * dpr) / dpr;
      const k = clamp((front - (i + 0.5) / BOW_SLICES) / 0.4, 0, 1);
      if (k > 0) {
        ctx.globalAlpha = peak * k * k * (3 - 2 * k);
        ctx.drawImage(bow.c, i * sw, 0, sw, bow.c.height, left, y0, right - left, h);
      }
      left = right;
    }
  }
  ctx.restore();
}

// A white flash, and a jagged bolt for each strike on screen. Several at once share one flash.
function drawLightning(now) {
  const bolts = ui.sky.bolts;
  if (!bolts.length) return;
  while (bolts.length && now - bolts[0].t0 > 450) bolts.shift();
  if (!bolts.length) return;
  const fade = 1 - (now - bolts[bolts.length - 1].t0) / 450;
  wash(`rgba(255, 255, 255, ${0.45 * fade * fade})`);
  for (const b of bolts) {
    const age = now - b.t0, [sx, sy] = toScreen(b.x, b.y);
    if (!visible(sx, sy, 20) || age > 250) continue;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 240, ${1 - age / 450})`;
    ctx.shadowColor = '#bcd4ff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    b.path.forEach(([f, dx], i) => {
      const x = sx + dx * vw * 0.06 * (1 - f), y = -10 + (sy + 10) * f;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}

function thunder(e) {
  const now = performance.now();
  if (now - ui.sky.boom < 250 && !zapping) return;   // at 60x, one flash at a time is plenty (but your own storm shows every bolt)
  const path = [[0, Math.random() - 0.5]];
  for (let f = 0.12; f < 1; f += 0.08 + Math.random() * 0.08) path.push([f, Math.random() - 0.5]);
  path.push([1, 0]);
  if (ui.sky.bolts.length < 30) ui.sky.bolts.push({ x: e.x, y: e.y, t0: now, path });
  ui.sky.boom = now;
}

// Flames glow, so they go on top of the night. The glow is painted once and stretched to size.
// It can't add light to the ground (a layer of its own, under the canvas), so it lays a pale warm
// light over it, which reads the same: the glows add up to it where many flames burn.
let fireGlow = (() => {                   // (an ImageBitmap once it's ready: asBitmap)
  const c = document.createElement('canvas'), n = 128, g = c.getContext('2d');
  c.width = c.height = n;
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, 'rgba(255, 225, 110, 0.42)');
  grad.addColorStop(1, 'rgba(255, 190, 90, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, n, n);
  return c;
})();
asBitmap(fireGlow, b => { fireGlow = b; });
function drawFire(now) {
  if (!world.burning.length) return;
  const z = cam.zoom, px = Math.max(8, z * 1.15);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const i of world.burning) {
    const [sx, sy] = toScreen(i % S.W + 0.5, Math.floor(i / S.W) + 0.5);
    if (!visible(sx, sy, px * 2)) continue;
    ctx.drawImage(fireGlow, sx - px * 1.6, sy - px * 1.6, px * 3.2, px * 3.2);
  }
  ctx.restore();
  for (const i of world.burning) {
    const [sx, sy] = toScreen(i % S.W + 0.5, Math.floor(i / S.W) + 0.5);
    if (!visible(sx, sy, px)) continue;
    const flick = Math.round(px * (0.85 + 0.15 * Math.sin(now / 90 + i * 1.7)));
    drawEmoji('🔥', sx, sy - flick * 0.3, flick);
  }
}

function addEffect(emoji, x, y, rise = 1.2, dur = 1400) {
  if (ui.effects.length > 120) return;
  const [sx, sy] = toScreen(x, y);
  if (!visible(sx, sy, 50)) return;
  ui.effects.push({ emoji, x, y, rise, dur, t0: performance.now() });
}

function drawEffects(now) {
  ui.effects = ui.effects.filter(e => now - e.t0 < e.dur);
  for (const e of ui.effects) {
    const a = (now - e.t0) / e.dur;
    const [sx, sy] = toScreen(e.x, e.y);
    const px = Math.max(14, cam.zoom * 1.2);
    drawEmoji(e.emoji, sx, sy - px * 0.8 - e.rise * px * a, px * (0.8 + 0.3 * Math.sin(a * Math.PI)), { alpha: 1 - a * a });
  }
}

// ------------------------------------------------------------------ voles
//
// The sim keeps voles as a number on each tile (w.voles), too many and too small to follow, so a vole only
// shows when something's after it: a fox listening or leaping, an owl dropping on it (drawRustle below).
// The vole (the painted one of the mousing bubble, voleAt) comes from the sprite cache, its top part only,
// rising out of the grass line.
const PEEP_FOOT = 0.76, PEEP_BODY = 0.41;   // in the sprite, from the top: where its feet are, and how tall it is

// A vole (or a frog) up out of the grass, up of the way, its feet on the grass line at sx, sy.
function peepAt(s, sx, sy, up, flip) {
  const size = s.size, shown = PEEP_FOOT * size - (1 - up) * PEEP_BODY * size;
  if (shown <= 0 || !visible(sx, sy, size)) return;
  ctx.globalAlpha = Math.min(1, 3 * up);
  const h = s.canvas.height * shown / size;
  if (!flip) ctx.drawImage(s.canvas, 0, 0, s.canvas.width, h, sx - size / 2, sy - shown, size, shown);
  else {
    ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1);
    ctx.drawImage(s.canvas, 0, 0, s.canvas.width, h, -size / 2, sy - shown, size, shown);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ a fox mousing, an owl hunting
//
// The sim says where a mousing fox heard the rustle it'll leap at (c.rustle while it listens, c.target in
// the air, sim.js mouse), and where an owl drops on one (c.target as it swoops, sim.js owlHunt). There the
// grass twitches in fits, and as the fox crouches to leap, or the owl comes down, the vole looks up out of
// the grass and freezes (a frog, where there are more frogs). Caught, it's in the fox's jaws or the owl's
// beak while it's gulped down (drawCatch); missed, it darts off through the grass. Only a look, from
// sprites in the cache, and a fixed pool for the ones darting off.
const CROUCH = 6;                  // ticks before the leap that it crouches, and the vole looks up
const RUSTLE_SIZE = 0.5;           // the twitching tuft, of a rabbit
const RUSTLE_PREY = 0.6;           // the vole (or frog) there, of a rabbit
const RUSTLE_PEEK = 0.35;          // how far up it shows while the grass twitches most
const OWL_SEEN = 3;                // tiles off: the vole sees the owl coming and looks up
const DASH_MS = 700;               // a vole the fox missed darting off
const DASH_LEN = 2;                // tiles, out from under the fox
const DASHES = 4;
const dashes = { x: new Float32Array(DASHES), y: new Float32Array(DASHES), dx: new Float32Array(DASHES), dy: new Float32Array(DASHES),
  t0: new Float64Array(DASHES).fill(-1e9), frog: new Uint8Array(DASHES), next: 0 };
const leaps = new WeakMap();       // a fox in the air: where it'll land, to see if it missed once it's down

// A fox leaping on a vole, or an owl dropping on one (not on a kit).
const leaping = c => (c.species === 'fox' ? c.mode === 'pounce' : c.mode === 'swoop' && !c.targetId);
// Where a mousing fox heard its rustle, or a fox or an owl is coming down (null: it isn't).
const rustleOf = c => leaping(c) ? c.target : c.species === 'fox' && c.mode === 'mouse' && !c.target ? c.rustle || null : null;
const frogThere = p => { const i = (p.y | 0) * S.W + (p.x | 0); return world.frogs[i] > world.voles[i]; };
const crouching = c => c.species === 'fox' && c.mode === 'mouse' && !c.target && !!c.rustle && c.timer - acc < CROUCH;

// Every frame, for each fox and owl: down from a leap that didn't end in a gulp, the vole darts off from under it.
function watchLeap(c, now) {
  if (leaping(c)) { if (c.target) leaps.set(c, c.target); return; }
  const to = leaps.get(c);
  if (!to) return;
  leaps.delete(c);
  if (c.mode === 'gulp' || ui.speed > 4 || world.snow >= 0.3) return;   // caught it, or too quick to see
  const k = dashes.next, a = c.heading + (Math.random() - 0.5) * 2;       // on ahead, about
  dashes.x[k] = to.x; dashes.y[k] = to.y; dashes.dx[k] = Math.cos(a) * DASH_LEN; dashes.dy[k] = Math.sin(a) * DASH_LEN * 0.6;
  dashes.t0[k] = now; dashes.frog[k] = frogThere(to) ? 1 : 0; dashes.next = (k + 1) % DASHES;
}

function drawDashes(now, z) {
  for (let k = 0; k < DASHES; k++) {
    const a = (now - dashes.t0[k]) / DASH_MS;
    if (a >= 1) continue;
    const go = 1 - (1 - a) * (1 - a), frog = dashes.frog[k];               // quick off, slowing into the grass
    const sx = (dashes.x[k] + dashes.dx[k] * go - cam.x) * z + vw / 2, sy = (dashes.y[k] + dashes.dy[k] * go - cam.y) * z + vh / 2;
    if (!fadeAt(dashes.x[k], dashes.y[k])) continue;
    const s = sprite(frog ? 'frog:1' : 'vole:0', Math.max(9, (8 + z) * RUSTLE_PREY));
    peepAt(s, sx, sy - (frog ? Math.sin(Math.PI * a) * s.size * 0.4 : 0), a < 0.7 ? 0.75 : 0.75 * (1 - a) / 0.3, dashes.dx[k] > 0);
  }
  unfade();
}

// The rustle a fox is listening to or leaping at, or an owl dropping on: the grass there twitching, and the vole looking up.
function drawRustle(c, to, sx, sy, z) {
  if (world.snow >= 0.3 || z < 6) return;              // (under the snow, nothing shows)
  const t = world.tick + acc, px = 8 + z;
  const tuft = sprite('🌿', px * RUSTLE_SIZE), fit = Math.max(0, Math.sin(t * 0.4 + c.id));
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(sx + side * tuft.size * 0.3, sy);
    ctx.rotate(fit * fit * 0.4 * Math.sin(t * 2.3 + side * 1.7));       // twitching in fits, at the foot
    ctx.drawImage(tuft.canvas, -tuft.size / 2, -tuft.size * 0.8, tuft.size, tuft.size);
    ctx.restore();
  }
  const look = c.species === 'owl' ? clamp(1 - Math.hypot(c.x - to.x, c.y - to.y) / OWL_SEEN, 0, 1)
    : c.mode === 'pounce' ? 1 : clamp(1 - (c.timer - acc) / CROUCH, 0, 1);
  const up = Math.max(look, fit > 0.8 ? RUSTLE_PEEK : 0);   // its back now and then, then up it looks
  if (up > 0) peepAt(sprite(frogThere(to) ? 'frog:0' : 'vole:0', Math.max(9, px * RUSTLE_PREY)), sx, sy, up, c.x < to.x);
}

// Caught: the vole (or frog) crosswise in the fox's jaws or the owl's beak while it's gulped down, gone at the last.
// Where in its painting (facing left), of its size, how big, and turned how far: crosswise in a fox's jaws (FOX_POSES.gulp),
// head first into an owl's beak.
const MOUTH = { fox: [-0.38, 0.08, 0.3, -0.3], owl: [0.06, -0.09, 0.42, 1.35] };
function drawCatch(c, sx, y, px) {
  const [mx, my, mz, turn] = MOUTH[c.species], s = sprite(c.prey === 'frog' ? 'frog:0' : 'vole:0', px * mz), side = flipOf(c) ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = clamp((c.timer - acc) / 6, 0, 1);
  ctx.translate(sx + side * px * mx, y + px * my);
  ctx.rotate(side * turn);
  ctx.scale(side, 1);
  ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
  ctx.restore();
}

// ------------------------------------------------------------------ pond life
//
// The sim keeps frogs, and their spawn and tadpoles, as numbers on tiles (w.frogs, w.spawn), like the voles.
// So the look is a fixed pool of spots, one tried a frame at a random place on screen, likelier to take the
// more there are: a clump of frogspawn in the shallows early in spring, then a few tadpoles wriggling; a frog
// that sits at the water's edge, hops once, and sits again; now and then one on a lily pad. Nothing kept.
const POND_SPOTS = 14;             // most shown at once
const POND_ODDS = 0.06;            // odds a try where they're thickest shows one
const POND_TRIES = 3;              // tries a frame
const SPAWN_MS = [7000, 3500];     // how long a clump of spawn, or some tadpoles, shows
const HOP_MS = 2600;               // a frog: it sits, hops, sits
const LILY_MS = 6000;              // and one on a lily pad sits a while
const FROG_SIZE = 0.5;             // of a rabbit
const HOP_OFF = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const pondLife = { x: new Float32Array(POND_SPOTS), y: new Float32Array(POND_SPOTS), dx: new Float32Array(POND_SPOTS), dy: new Float32Array(POND_SPOTS),
  t0: new Float64Array(POND_SPOTS).fill(-1e9), ms: new Float32Array(POND_SPOTS), kind: new Uint8Array(POND_SPOTS), next: 0 };
const frogsAround = i => Math.max(world.frogs[i], world.frogs[i - 1] || 0, world.frogs[i + 1] || 0, world.frogs[i - S.W] || 0, world.frogs[i + S.W] || 0);

function pondSpot(now, kind, x, y, ms, dx = 0, dy = 0) {
  const P = pondLife, k = P.next;
  if (now - P.t0[k] < P.ms[k]) return;               // (the oldest is still showing: wait)
  P.x[k] = x; P.y[k] = y; P.dx[k] = dx; P.dy[k] = dy; P.t0[k] = now; P.ms[k] = ms; P.kind[k] = kind; P.next = (k + 1) % POND_SPOTS;
}

function drawPond(now, z) {
  if (z < 10) return;
  const season = S.seasonOf(world.tick), frogsOut = world.frogsOut && iceOver() < 0.3;
  if (ui.speed > 0 && (world.spawnCount > 0 || frogsOut)) for (let t = 0; t < POND_TRIES; t++) {
    const x = cam.x + (Math.random() - 0.5) * vw / z, y = cam.y + (Math.random() - 0.5) * vh / z;
    if (x >= 1 && y >= 1 && x < S.W - 1 && y < S.H - 1) {
      const i = (y | 0) * S.W + (x | 0);
      if (world.water[i]) {
        const n = world.spawn[i] / (4 * S.SPAWN_WORTH);
        if (n > 0 && Math.random() < POND_ODDS * 4 * n) { const tad = world.frogYear.grown >= 0.35 ? 1 : 0; pondSpot(now, tad, x, y, SPAWN_MS[tad]); }
      } else if (frogsOut) {
        const n = world.frogs[i] / S.FROG_K;
        if (Math.random() < POND_ODDS * n) {             // a hop, towards the water if it's near
          let dx = Math.random() < 0.5 ? 0.8 : -0.8, dy = 0;
          for (const [ox, oy] of HOP_OFF) if (world.water[i + ox + oy * S.W]) { dx = ox * 0.8; dy = oy * 0.5; break; }
          pondSpot(now, 2, x, y, HOP_MS, dx, dy);
        }
      }
    }
  }
  if (ui.speed > 0) {
    if (frogsOut && season < 3 && pond && pond.shore.length && Math.random() < 0.05) {   // a frog up on a lily pad
      const s = pond.shore[(Math.random() * pond.shore.length) | 0];
      const n = s.lily ? frogsAround((s.y | 0) * S.W + (s.x | 0)) / S.FROG_K : 0;
      if (n > 0 && Math.random() < 3 * POND_ODDS * n) pondSpot(now, 3, s.x, s.y + 0.05, LILY_MS);
    }
  }
  const P = pondLife, px = Math.max(8, (8 + z) * FROG_SIZE);
  for (let k = 0; k < POND_SPOTS; k++) {
    const a = (now - P.t0[k]) / P.ms[k];
    if (a >= 1 || a < 0) continue;
    const kind = P.kind[k];
    if (kind < 2 && !world.spawn[(P.y[k] | 0) * S.W + (P.x[k] | 0)]) continue;   // eaten, or dried out
    let x = P.x[k], y = P.y[k], lift = 0, art = 'frog:0';
    if (kind === 0 || kind === 1) {
      art = kind === 0 ? 'frog:2' : 'frog:3';
      if (kind === 1) { x += 0.15 * Math.sin(now / 400 + k); y += 0.08 * Math.cos(now / 530 + k); }
    } else if (kind === 2) {
      const h = (a - 0.35) / 0.2;                        // sit, hop (a fifth of the time), sit
      const u = h <= 0 ? 0 : h >= 1 ? 1 : h;
      x += P.dx[k] * u; y += P.dy[k] * u;
      if (h > 0 && h < 1) { lift = Math.sin(Math.PI * h) * 0.5; art = 'frog:1'; }
      else if (h >= 1 && world.water[(y | 0) * S.W + (x | 0)]) continue;   // plop: into the water
    }
    const sx = (x - cam.x) * z + vw / 2, sy = (y - cam.y) * z + vh / 2 - lift * z;   // (toScreen, without an array)
    const size = kind === 0 ? px * 2 : kind === 1 ? px * 1.6 : px;
    if (!visible(sx, sy, size)) continue;
    const s = sprite(art, size);
    ctx.globalAlpha = Math.min(1, 6 * a, 6 * (1 - a)) * (kind === 0 ? 0.85 : 1);
    if (kind >= 2 && P.dx[k] > 0) {                     // (painted facing left)
      ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1);
      ctx.drawImage(s.canvas, -s.size / 2, sy - s.size * 0.76, s.size, s.size);
      ctx.restore();
    } else ctx.drawImage(s.canvas, sx - s.size / 2, sy - s.size * (kind < 2 ? 0.5 : 0.76), s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ pollen
//
// A sipping bee kicks up a few specks of pollen, and when she's done with a flower a little puff
// bursts off it. Only at 1x and 4x, and only zoomed in far enough to see the flowers: faster, a
// sip lasts a frame and it would just fizz. Specks are dots in a fixed pool, oldest reused first,
// so nothing is made or thrown away per speck; the sipping ones aren't stored at all.
const POLLEN_MAX = 300, POLLEN_MS = 800, PUFF = 10;
// Two soft dots, gold and pale, painted once and stamped for every speck.
const POLLEN_DOTS = ['255, 206, 60', '255, 236, 150'].map(rgb => {
  const c = document.createElement('canvas'), g = c.getContext('2d'), r = 16;
  c.width = c.height = 2 * r;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${rgb}, 1)`); grad.addColorStop(0.45, `rgba(${rgb}, 0.9)`); grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 2 * r, 2 * r);
  return c;
});
POLLEN_DOTS.forEach((c, i) => asBitmap(c, b => { POLLEN_DOTS[i] = b; }));
const pollen = {
  x: new Float32Array(POLLEN_MAX), y: new Float32Array(POLLEN_MAX),       // where it burst, in tiles
  vx: new Float32Array(POLLEN_MAX), vy: new Float32Array(POLLEN_MAX),     // how far it flies, in tiles
  t0: new Float64Array(POLLEN_MAX).fill(-1e9), next: 0, until: 0,
};
const pollenShows = () => ui.speed > 0 && ui.speed <= 4 && cam.zoom * 0.95 >= 7;   // as drawPlants

function puffPollen(x, y) {
  if (!pollenShows()) return;
  const [sx, sy] = toScreen(x, y);
  if (!visible(sx, sy, 30)) return;
  const now = performance.now(), turn = Math.random() * TAU;
  for (let k = 0; k <= PUFF; k++) {                     // the last one is the twinkle, standing still
    const i = pollen.next, a = turn + k * TAU / PUFF + Math.random() * 0.5, r = k < PUFF ? 0.45 + Math.random() * 0.45 : 0;
    pollen.x[i] = x; pollen.y[i] = y - 0.15;
    pollen.vx[i] = Math.cos(a) * r; pollen.vy[i] = Math.sin(a) * r * 0.7 - (k < PUFF ? 0.15 : 0);
    pollen.t0[i] = now;
    pollen.next = (i + 1) % POLLEN_MAX;
  }
  pollen.until = now + POLLEN_MS;
}

function drawPollen(now) {
  if (now > pollen.until) return;                       // nothing in the air
  const z = cam.zoom, s = Math.max(2.2, z * 0.09);
  for (let i = 0; i < POLLEN_MAX; i++) {
    const a = (now - pollen.t0[i]) / POLLEN_MS;
    if (a >= 1) continue;
    const t = Math.max(0, a), out = t * (2 - t);        // quick out, slowing down
    const sx = (pollen.x[i] + pollen.vx[i] * out - cam.x) * z + vw / 2;          // (toScreen, without an array per speck)
    const sy = (pollen.y[i] + pollen.vy[i] * out + 0.25 * t * t - cam.y) * z + vh / 2;
    if (pollen.vx[i] === 0 && pollen.vy[i] === 0) {      // the twinkle: a little cross that shrinks
      const r = s * 4 * (1 - t) * Math.min(1, t * 8);    // pops open, then shrinks away
      ctx.globalAlpha = 0.95 * (1 - t);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(sx - r, sy - s * 0.35, r * 2, s * 0.7);
      ctx.fillRect(sx - s * 0.35, sy - r, s * 0.7, r * 2);
      continue;
    }
    const d = 2 * s * (1 - 0.4 * t);                    // (the dot's soft edge is half of it)
    ctx.globalAlpha = 1 - t * t;
    ctx.drawImage(POLLEN_DOTS[i & 1], sx - d / 2, sy - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ summer nights, summer days
//
// Fireflies over the grass by the water and along the edge of the woods on summer nights, and
// butterflies over a flower field in bloom. Only a look: each one is worked out from a hash and
// the clock, so there is nothing to keep, and they are drawn from one small glow and the 🦋 sprite.

// (The halo is laid over the dark ground, not added to it, like the fire's glow: so it's thicker.)
let FIREFLY_GLOW = (() => {               // (an ImageBitmap once it's ready: asBitmap)
  const c = document.createElement('canvas'), n = 32, g = c.getContext('2d');
  c.width = c.height = n;
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
  grad.addColorStop(0.12, 'rgba(250, 255, 170, 1)');
  grad.addColorStop(0.3, 'rgba(210, 255, 110, 0.75)');
  grad.addColorStop(0.65, 'rgba(180, 255, 80, 0.17)');
  grad.addColorStop(1, 'rgba(180, 255, 80, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, n, n);
  return c;
})();
asBitmap(FIREFLY_GLOW, b => { FIREFLY_GLOW = b; });
const FIREFLIES = 3;               // to each spot

// Where the fireflies are: a scatter of spots by the water and at the edge of the woods, chosen
// once for each meadow.
let fireflySpots = null;
function fireflyHaunts() {
  if (fireflySpots && fireflySpots.world === world) return fireflySpots;
  const near = S.distanceToWater(world), xs = [], ys = [];
  for (let y = 2; y < S.H - 2; y++) for (let x = 2; x < S.W - 2; x++) {
    const i = y * S.W + x, wood = world.wood[i];
    const by = world.water[i] ? 0 : near[i] <= 4 ? 1 : wood > 0.2 && wood < 0.7 ? 0.6 : 0;
    if (by && hash2(x, y, 61) < 0.04 * by) { xs.push(x + hash2(x, y, 62)); ys.push(y + hash2(x, y, 63)); }
  }
  return fireflySpots = { world, x: xs, y: ys };
}

// Summer, dark, and not raining: each firefly drifts about its spot and flashes every few seconds.
function drawFireflies(now, dark) {
  const [season, next, turn] = seasonTurn(), m = ui.sky.mix;
  const summer = season === 1 ? 1 - turn : next === 1 ? turn : 0;
  const a = summer * clamp((dark - 0.15) / 0.25, 0, 1) * clamp(1 - 1.5 * ((m.rain || 0) + (m.storm || 0)), 0, 1);
  if (a <= 0.02) return;
  const spots = fireflyHaunts(), z = cam.zoom, d = Math.max(12, z * 1.1), t = now / 1000;
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < spots.x.length; s++) {
    const x0 = spots.x[s], y0 = spots.y[s], i = (y0 | 0) * S.W + (x0 | 0);
    if (world.water[i] || world.grass[i] < 0.3 || world.fire[i] > 0) continue;
    const bx = (x0 - cam.x) * z + vw / 2, by = (y0 - cam.y) * z + vh / 2;     // (toScreen, without an array)
    if (!visible(bx, by, z * 2)) continue;
    for (let k = 0; k < FIREFLIES; k++) {
      const h = hash2(s, k, 64), cycle = 2.2 + 2 * hash2(s, k, 65), p = (t / cycle + h) % 1;
      if (p > 0.4) continue;                                  // dark between flashes
      const glow = Math.sin(Math.PI * p / 0.4);
      const sx = bx + z * 1.4 * Math.sin(t * (0.25 + 0.2 * h) + h * 40);
      const sy = by - z * (0.5 + 0.35 * Math.sin(t * (0.37 + 0.2 * h) + h * 70));
      ctx.globalAlpha = a * glow;
      ctx.drawImage(FIREFLY_GLOW, sx - d / 2, sy - d / 2, d, d);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// By day, over each field in bloom, a butterfly or two for every sixth of it that is out: each
// loops over one of the field's circles, flapping, washed in the field's colour.
const BUTTERFLIES = 6;             // over a field in full bloom
function drawButterflies(now, ck) {
  const m = ui.sky.mix, calm = 1 - (m.rain || 0) - (m.storm || 0) - 0.6 * (m.fog || 0) - 0.4 * (m.snow || 0);
  if (darkness(ck.phase) > 0.15 || calm < 0.5) return;       // they settle for the night at dusk
  const z = cam.zoom, px = Math.max(9, z * 0.75), t = now / 1000;
  for (const f of world.fields) {
    if (f.season !== ck.season || !f.all) continue;
    const n = Math.round(BUTTERFLIES * f.open / f.all);
    if (!n) continue;
    const tint = `rgba(${f.tint[0]}, ${f.tint[1]}, ${f.tint[2]}, 0.3)`;
    for (let k = 0; k < n; k++) {
      const c = f.shape[k % f.shape.length], h = hash2(f.id, k, 71), r = c.r * 0.75;
      const x = c.x + r * Math.sin(t * (0.13 + 0.08 * h) + h * 30) + 0.3 * Math.sin(t * 1.7 + h * 9);
      const y = c.y + r * 0.7 * Math.sin(t * (0.19 + 0.06 * h) + h * 50);
      const sx = (x - cam.x) * z + vw / 2, sy = (y - cam.y) * z + vh / 2 - px * (0.9 + 0.3 * Math.abs(Math.sin(t * 2.3 + h * 7)));
      if (!visible(sx, sy, px) || !fadeAt(x, y)) continue;
      const s = sprite('🦋', px, tint), flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 13 + h * 20));
      ctx.drawImage(s.canvas, sx - s.size * flap / 2, sy - s.size / 2, s.size * flap, s.size);
    }
  }
  unfade();
}

// While she sips, a few specks drift up off the flower, from a hash of her id and the time.
function drawSipping(c, sx, sy, px, now) {
  if (!pollenShows()) return;
  const d = 2 * Math.max(1.6, cam.zoom * 0.055);
  for (let k = 0; k < 3; k++) {
    const t = now / 900 + hash2(c.id, k, 5), p = t % 1, n = Math.floor(t);
    const x = sx + (hash2(c.id * 3 + k, n, 6) - 0.5) * px * 1.1 + Math.sin(p * 6 + k) * px * 0.08;
    const y = sy - px * 0.1 - p * px * 0.9;
    ctx.globalAlpha = 0.9 * Math.min(1, p * 6, (1 - p) * 2.5);
    ctx.drawImage(POLLEN_DOTS[k & 1], x - d / 2, y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ news

const NEWS_TOASTS = 3, NEWS_TOAST_MS = 7000, NEWS_LOG_MAX = 80;
function addNews(html, category, minGapMs = 0) {
  const now = performance.now();
  if (category && minGapMs && ui.lastNews[category] && now - ui.lastNews[category] < minGapMs) return;
  if (category) ui.lastNews[category] = now;
  ui.newsLog.unshift({ html, tick: world.tick });
  ui.newsLog.length = Math.min(ui.newsLog.length, NEWS_LOG_MAX);
  if (away.on) { awayNews(html); ui.newsStale = true; return; }   // catching up: the log, and the card if it's big
  if (ui.newsOpen) { ui.newsStale = true; return; }   // the frame rebuilds it, once however much happened
  const box = $('#news');
  const el = document.createElement('div');
  el.className = 'news-item';
  el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > (narrow() ? 1 : NEWS_TOASTS)) box.lastChild.remove();   // a phone has room for one
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 800); }, NEWS_TOAST_MS);
}

function renderNewsLog() {
  ui.newsStale = false;
  const year = S.clock(world).year;
  $('#news-log ol').innerHTML = ui.newsLog.map(n => `<li>${seasonChip(n.tick, year)}${n.html}</li>`).join('');
}

function toggleNewsLog() {
  ui.newsOpen = !ui.newsOpen;
  $('#news-log').classList.toggle('hidden', !ui.newsOpen);
  $('.news-toggle').classList.toggle('on', ui.newsOpen);
  $('#news').innerHTML = '';                        // it's all in the log now
  if (ui.newsOpen) renderNewsLog();
}

const link = c => c ? `<a data-id="${c.id}">${esc(c.name)}</a>` : 'someone';

// One of yours gone: a line of its own, what took it and where. If it leaves young, one of them is offered
// (never named for you): a tap on it opens the inspector to name it.
const YOUNG_ONE = { rabbit: 'kit', fox: 'cub', crow: 'chick', owl: 'owlet', otter: 'cub' };
const GONE_EMOJI = { fox: '🦊', owl: '🦉', left: '🧳', hunger: '🥀', lightning: '⚡', fire: '🔥', flood: '🌊', ice: '🧊', sickness: '🤒' };
function goneLine(c, cause, killer) {
  const at = cause === 'left' ? '' : placeNear(c.x, c.y), who = link(c);
  const how = {
    fox: `${link(killer)} the fox took ${who}`, owl: `${link(killer)} the owl took ${who}`,
    left: `${who} flew off over the trees, to find a wood of its own`, hunger: `${who} starved`,
    lightning: `Lightning struck ${who}`, fire: `The fire took ${who}`, flood: `${who} drowned in the flooded burrow`,
    ice: `${who} went through the ice`, sickness: `The sickness took ${who}`,
  }[cause] || `${who} died of old age`;
  let t = `${GONE_EMOJI[cause] || '🌙'} <b>${how}</b>${at ? ' ' + at : ''}, ${days(S.ageDays(world, c))} old.`;
  let kit = null, kd = Infinity;
  for (const k of world.creatures) {
    if (!k.alive || k.mine || k.mumId !== c.id && k.dadId !== c.id || S.growth(world, k) >= 1) continue;
    const d = (k.x - c.x) ** 2 + (k.y - c.y) ** 2;
    if (d < kd) { kit = k; kd = d; }
  }
  if (kit) {
    const where = kit.hidden ? (kit.species === 'crow' ? 'in the nest' : kit.species === 'owl' ? 'in the hollow' : kit.species === 'otter' ? 'in the holt' : 'in the burrow') : placeNear(kit.x, kit.y) || 'not far off';
    t += ` <a class="adopt" data-act="adopt" data-id="${kit.id}">${c.sex === 'F' ? 'Her' : 'His'} ${YOUNG_ONE[kit.species] || 'young one'} ${esc(kit.name)} is ${where} →</a>`;
  }
  return t;
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const SEASON_NEWS = [
  '🌸 <b>Spring!</b> The grass is growing and love is in the air.',
  '☀️ <b>Summer.</b> Long days and plenty to eat.',
  '🍂 <b>Autumn.</b> Grass is slowing down. Time to fatten up.',
  '❄️ <b>Winter.</b> The grass has stopped growing. Lean times ahead.',
];

const WEATHER_NEWS = {
  clear: '☀️ The clouds part. Clear skies.',
  cloudy: '☁️ Clouds drift in over the meadow.',
  rain: '🌧️ <b>Rain.</b> The grass drinks it up and grows three times as fast.',
  storm: '⛈️ <b>A thunderstorm!</b> Rabbits dash for their burrows and foxes curl up to wait it out.',
  fog: '🌫️ <b>Fog.</b> Nobody can see very far. The foxes will have to stumble onto their dinner.',
  snow: '🌨️ <b>Snow is falling.</b> The little ones feel the cold most.',
  heat: '🥵 <b>A heatwave.</b> The grass is drying out. One spark and it could burn.',
};

// ------------------------------------------------------------------ sound (see sound.js)

// Animal sounds only play when you can see them, or when they are about the animal you follow.
// They pan with where they happen on screen and get softer as you zoom out.
function hear(name, x, y, opts = {}, always = false) {
  if (!ui.sound || away.on) return;
  const [sx, sy] = toScreen(x, y), seen = visible(sx, sy, 40);
  if (!seen && !always) return;
  Sound.play(name, { pan: 0.8 * clamp(sx / vw * 2 - 1, -1, 1), near: seen ? clamp(cam.zoom / (3 * minZoom), 0.4, 1) : 0.2, seen, ...opts });
}
const chime = (name, opts) => { if (ui.sound && !away.on) Sound.play(name, opts); };

// Bees out flying where you're looking: the hive hum follows them.
function beesOnScreen() {
  let n = 0;
  for (const c of world.creatures) {
    if (c.species !== 'bee' || !c.alive || c.hidden) continue;
    const [sx, sy] = toScreen(c.x, c.y);
    if (visible(sx, sy, 0)) n++;
  }
  return n;
}

function toggleSound(on = !ui.sound) {
  ui.sound = on;
  if (on && navigator.userActivation?.hasBeenActive !== false) Sound.start();   // else the first click will
  Sound.setEnabled(on);
  $('#sound-btn').textContent = $('#card-sound').textContent = on ? '🔊' : '🔇';
  $('#card-sound').setAttribute('aria-pressed', on);
  $('#sound-btn').classList.toggle('on', on);
  $('#sound-item .e').textContent = on ? '🔊' : '🔇';
  $('#sound-item .l').textContent = on ? 'Sound is on' : 'Sound is off';
  try { localStorage.setItem('aeon-garden-sound', on ? '1' : '0'); } catch (e) { /* fine */ }
}

// The one you follow, or one of yours (you named it, or its hive's queen): its news always comes.
function involvesSelected(e) {
  const id = ui.selectedId;
  return !!e.queen?.mine || [e.c, e.a, e.b, e.mum, e.dad, e.rabbit, e.fox, e.killer].some(x => x && (x.mine || id && x.id === id));
}

// Where something happened, by the nearest thing with a name: a flower field, an old tree or the water. '' with none near.
function placeNear(x, y) {
  let name = '', bd = 20 * 20;
  const near = (px, py, n) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; name = n; } };
  for (const f of world.fields) near(f.x, f.y, f.name);
  for (const d of world.decor) if (d.name && S.standing(d)) near(d.x, d.y, d.name);
  for (let ty = Math.max(0, Math.floor(y - 20)); ty < Math.min(S.H, y + 20); ty++) {
    for (let tx = Math.max(0, Math.floor(x - 20)); tx < Math.min(S.W, x + 20); tx++) {
      const water = world.water[ty * S.W + tx] && S.waterAt(world, tx, ty);
      if (water) near(tx + 0.5, ty + 0.5, water.name);
    }
  }
  return name ? `by the ${esc(name)}` : '';
}

function handleEvent(e) {
  const mine = involvesSelected(e);
  if (idle.on) idleNews(e);
  if (away.on) { away.type = e.type; away.mine = mine; }
  switch (e.type) {
    case 'season':
      addNews(SEASON_NEWS[e.season] + (e.season === 0 ? ` Year ${e.year} begins.` : ''));
      chime('season', { season: e.season });
      break;
    case 'weather': {
      if (WET.has(e.kind) && !WET.has(e.prev)) chime('rain');
      const text = WEATHER_NEWS[e.kind];
      if (e.player) { addNews(text); tried('sky', SKY_SAID[e.kind]); }
      else if (e.kind === 'clear' || e.kind === 'cloudy') addNews(text, 'sky-calm', 40000);
      else addNews(text, 'sky', 12000);
      if (WET.has(e.prev) && (e.kind === 'clear' || e.kind === 'cloudy') && !S.isNight(world.tick)) {
        ui.sky.rainbow = performance.now();
        chime('rainbow');
        addNews('🌈 A rainbow over the meadow.', 'rainbow', 60000);
      }
      break;
    }
    case 'lightning':
      thunder(e);
      hear('thunder', e.x, e.y, {}, true);
      addEffect('💥', e.x, e.y, 0.2, 800);
      if (e.tree && !e.fire) addNews('⚡ Lightning split a tree in two!', 'tree', 30000);
      if (zapping) tried('zap', e.tree ? 'Crack! Lightning goes for the tallest tree about.' : 'Lightning likes trees. Try it by one.');
      break;
    case 'hivestruck':
      addNews(e.fell ? `🪵 <b>Queen ${esc(e.queen.name)}'s old tree has come down!</b> Her ${e.who.length} bees swarm out and hang in a tree nearby while scouts look for a new home.`
        : `⚡ <b>Lightning struck Queen ${esc(e.queen.name)}'s tree!</b> Her ${e.who.length} bees swarm out and hang in a tree nearby while scouts look for a new home.`);
      break;
    case 'mast':
      addNews('🌰 <b>A mast year!</b> The oaks and beeches are heavy with acorns and beechnuts. Rabbits will feast, jays will bury them, and next spring the woods will be full of seedlings.');
      break;
    case 'sprouts': {
      const few = world.count.rabbit < 60 * world.room, burn = e.burnt >= Math.max(5, e.n / 4);
      addNews(`🌱 ${e.n} tree seedlings have come up this spring${burn ? ', many on the ground the fire burned' : ''}.`
        + (few ? ' With so few rabbits about, many may make it.' : ' The rabbits will get most of the ones out in the open.'), 'sprouts', 60000);
      break;
    }
    case 'plantlost': {
      const d = e.tree, k = treeName(d).toLowerCase(), kind = k.replace(/ tree$/, ''), small = d.size < S.SEEDLING ? `${kind} seedling` : d.size < S.SAPLING ? `${kind} sapling` : k;
      addNews({
        eaten: `🐇 ${e.c ? link(e.c) : 'A rabbit'} ate the ${small} you planted.`,
        lost: `🥀 The ${small} you planted withered away: voles, slugs or a dry spell.`,
        fire: `🔥 The fire took the ${small} you planted.`, flood: `🌊 The ${small} you planted drowned in the flood.`,
        shade: `🌑 The ${small} you planted died in the shade of the trees about it.`, dug: `🕳️ Rabbits dug a burrow right where your ${small} stood.`,
      }[e.cause] || `🍂 The ${k} you planted in the ${plantedWhen(d)} has died of old age.`);
      break;
    }
    case 'plantgrew':
      addNews(`🌿 The ${plantedLink(e.tree)} you planted is a sapling now, out of the rabbits' reach.`);
      break;
    case 'plantseeds':
      addNews(`🌰 The ${plantedLink(e.tree)} you planted in the ${plantedWhen(e.tree)} is bearing its first seed.`);
      break;
    case 'treedied': {
      const d = e.tree, t = thingLink('tree', d.id, esc(treeTitle(d).replace(/^Dead /, 'The old ')));
      addNews(`🍂 ${t} has died, ${Math.floor(e.age)} years old.` + (d.hive ? ' Its bees stay on in the dead trunk, for now.' : ' It will stand a while yet, grey and bare.'), 'treedied', 30000);
      break;
    }
    case 'windthrow': {
      const d = e.tree, t = thingLink('tree', d.id, esc(e.alive ? (d.name ? `the ${d.name}` : `a big ${treeName(d).toLowerCase()}`) : `a dead ${treeName(d).toLowerCase()}`));
      addNews(`🌬️ The storm brought down ${t}.`, 'windthrow', 20000);
      break;
    }
    case 'fire':
      if (e.set) break;                 // the player's own: burnAt tells of it
      addNews('🔥 <b>Wildfire!</b> Lightning set the dry grass alight. Everyone is running.');
      hear('fire', e.x, e.y, {}, true);
      break;
    case 'fireout': {
      const pct = e.burned / world.water.reduce((n, v) => n + (v ? 0 : 1), 0) * 100;
      if (e.burned >= 25) chime('fireout');
      const trees = e.trees === 1 ? ' and one tree' : e.trees ? ` and ${e.trees} trees` : '';
      if (e.burned >= 25) addNews(`🌱 The fire is out after burning ${pct < 1 ? 'a corner' : Math.round(pct) + '%'} of the meadow${trees}. The ash will feed fresh shoots.`);
      else if (e.trees) addNews(`💨 The fire fizzled out, but it took ${e.trees === 1 ? 'a tree' : e.trees + ' trees'} with it.`);
      else addNews('💨 The fire fizzled out.', 'fizzle', 30000);
      break;
    }
    case 'love':
      addEffect('💕', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2);
      hear('love', e.a.x, e.a.y, { species: e.a.species }, mine);
      if (mine) addNews(`💕 ${link(e.a)} and ${link(e.b)} fell in love.`);
      break;
    case 'birth': {
      addEffect('✨', e.mum.x, e.mum.y, 0.8);
      const n = e.kids.length, fox = e.mum.species === 'fox';
      hear('birth', e.mum.x, e.mum.y, { species: e.mum.species, kids: n }, mine);
      const crow = e.mum.species === 'crow', owl = e.mum.species === 'owl', otter = e.mum.species === 'otter';
      const what = fox || otter ? (n === 1 ? 'cub' : 'cubs') : e.mum.species === 'bee' ? (n === 1 ? 'young bee' : 'young bees') : crow ? (n === 1 ? 'chick' : 'chicks')
        : owl ? (n === 1 ? 'owlet' : 'owlets') : (n === 1 ? 'baby' : 'babies');
      const text = `${fox ? '🦊' : crow ? '🪺' : owl ? '🦉' : otter ? '🦦' : '🍼'} ${link(e.mum)} had ${n} ${what}` + (e.dad ? ` with ${link(e.dad)}` : '')
        + (crow ? ', up in the nest.' : owl ? `, in the hollow of the old oak. ${n === 1 ? 'Few voles about this spring: only the one.' : n === 3 ? 'Voles aplenty to feed them.' : ''}`
          : otter ? ', down in the holt. They\'ll be out in a few days.' : '.');
      if (mine || fox || owl || otter) addNews(text);
      else addNews(text, 'birth', 9000);
      if (e.surprise.length) {
        const n = {};
        for (const k of e.surprise) { const c = S.coatOf(k.genes); n[c] = (n[c] || 0) + 1; }
        const what = Object.entries(n).map(([c, m]) => `${m === 1 ? 'a' : m} ${S.COATS[c].name} ${m === 1 ? 'baby' : 'babies'}`).join(' and ');
        const t = `🎨 Surprise! ${link(e.mum)}` + (e.dad ? ` and ${link(e.dad)}` : '') + ` had ${what}.`;
        if (mine) addNews(t); else addNews(t, 'surprise', 20000);
      }
      break;
    }
    case 'death': {
      const c = e.c;
      if (c.mine) addNews(goneLine(c, e.cause, e.killer));
      if (e.cause !== 'left') hear(e.cause === 'fox' || e.cause === 'owl' ? 'catch' : e.cause === 'age' ? 'old' : 'starve', c.x, c.y, { species: c.species }, mine);   // (one flying off makes no sound)
      if (e.cause === 'fox' || e.cause === 'owl') addEffect('🦴', c.x, c.y, 0.3, 1800);
      else if (e.cause !== 'left') addEffect('👻', c.x, c.y, 1.6, 2000);
      if (c.mine) break;
      if (e.cause === 'fox') {
        const t = `🦊 ${link(e.killer)} caught ${link(c)}${c.species === 'crow' ? ' the crow, off its guard' : ''}.`;
        if (mine) addNews(t); else addNews(t, 'catch', 7000);
      } else if (e.cause === 'owl') {
        const t = `🦉 ${link(e.killer)} the owl dropped silently out of the dusk and took ${link(c)}, a young rabbit still out.`;
        if (mine) addNews(t); else addNews(t, 'owlcatch', 20000);
      } else if (e.cause === 'left') {
        if (mine) addNews(c.species === 'otter' ? `🦦 ${link(c)} has gone off down the water to find a stretch of its own.`
          : `🦉 ${link(c)} has flown off over the trees to find a wood of its own.`);   // the rest: the 'owlleaves' and 'otterleaves' news
      } else if (e.cause === 'hunger') {
        const t = c.species === 'fox' ? `🥀 ${link(c)} the fox starved. There weren't enough rabbits or voles.`
          : c.species === 'bee' ? `🥀 ${link(c)} the bee starved. The hive ran out of honey.`
          : c.species === 'crow' ? `🥀 ${link(c)} the crow starved.`
          : c.species === 'owl' ? `🥀 ${link(c)} the owl starved. There weren't enough voles in the long grass.`
          : c.species === 'otter' ? `🥀 ${link(c)} the otter starved${world.frozen ? ', shut out of the water by the ice' : ''}.`
          : `🥀 ${link(c)} starved.`;
        if (mine || c.species === 'fox' || c.species === 'owl' || c.species === 'otter') addNews(t); else addNews(t, 'starve', 12000);
      } else if (e.cause === 'lightning') {
        addNews(`⚡ ${link(c)} was struck by lightning.`);
      } else if (e.cause === 'fire') {
        const t = `🔥 ${link(c)} was caught in the wildfire.`;
        if (mine) addNews(t); else addNews(t, 'burn', 6000);
      } else if (e.cause === 'flood') {
        if (mine) addNews(`🌊 ${link(c)} drowned when the burrow flooded.`);   // the rest are in the 'flooded' news
      } else if (e.cause === 'ice') {
        if (mine) addNews(`🧊 ${link(c)} went through the ice and drowned.`);   // the rest are in the 'ice' news
      } else if (e.cause === 'sickness') {
        if (mine) addNews(`🤒 ${link(c)} died of the sickness.`);            // the rest are in the 'outbreak' news
      } else {
        const age = Math.floor(S.ageDays(world, c));
        const fam = c.kids ? `, leaving ${c.kids} ${c.kids === 1 ? 'child' : 'children'}` : '';
        const t = `🌙 Old ${link(c)} died peacefully at ${age} days${fam}.`;
        if (mine || c.kids >= 10) addNews(t); else addNews(t, 'old', 15000);
      }
      break;
    }
    case 'hatch': {
      hear('birth', e.hive.x, e.hive.y, { species: 'bee', kids: e.kids.length });
      const t = `🐣 Young bees are hatching in Queen ${esc(e.queen.name)}'s hive.`;
      addNews(t, 'hatch', 60000);
      break;
    }
    case 'queen':
      hear('queen', e.hive.x, e.hive.y, {}, true);
      addNews(`👑 <b>Queen ${esc(e.queen.name)}</b> has settled in the hive.`);
      break;
    case 'queenlost':
      hear('queenlost', e.hive.x, e.hive.y, {}, true);
      addNews(e.hive.cluster ? `🥀 Queen ${esc(e.queen.name)}'s swarm never found a home.`
        : `🥀 Queen ${esc(e.queen.name)} died in the empty hive, after raising ${e.queen.kids} ${e.queen.kids === 1 ? 'bee' : 'bees'}.`);
      break;
    case 'swarm':
      addEffect('✨', e.swarm.x, e.swarm.y);
      hear('arrive', e.swarm.x, e.swarm.y, { species: 'bee' }, true);
      addNews(`🐝 <b>A swarm!</b> Queen ${esc(e.queen.name)} has left her crowded hive with ${e.who.length} bees. They hang in a tree while scouts look for a new home. Her daughter, Queen ${esc(e.heir.name)}, stays behind.`);
      break;
    case 'settle':
      addEffect('✨', e.hive.x, e.hive.y);
      addNews(`🏡 Queen ${esc(e.queen.name)}'s swarm has moved into ${e.reused ? 'an empty hive, old comb and all' : 'a hollow tree'}.`);
      break;
    case 'water': {
      const river = world.waters.find(b => b.kind === 'river') || world.lake || world.waters[0];
      const name = river ? river.name : 'The water';
      addNews(e.rising ? `🌊 ${esc(name)} has risen over its banks. The low meadows are under water.`
        : `☀️ ${esc(name)} has dropped low for the summer. There are more places to wade across.`);
      break;
    }
    case 'ice': {
      const river = world.waters.find(b => b.kind === 'river') || world.lake || world.waters[0];
      const name = river ? esc(river.name) : 'The water';
      if (e.frozen) { addNews(`🧊 <b>${name} has frozen over.</b> The ice will hold anyone now, foxes too.`); break; }
      const { fell, drowned } = e, who = fell.slice(0, 3).map(link).join(', ') + (fell.length > 3 ? ` and ${fell.length - 3} more` : '');
      let t = `💧 The ice is breaking up on ${name}.`;
      if (fell.length) t += ` ${who} went through and scrambled out, soaked.`;
      if (drowned.length) t += ` ${drowned.length === 1 ? 'A youngster' : drowned.length + ' youngsters'} out on the ice drowned.`;
      addNews(t);
      break;
    }
    case 'outbreak': {
      const where = placeNear(e.x, e.y);
      addNews(`🤒 <b>A sickness is going round the warren${where ? ' ' + where : ''}.</b> In a crowded meadow it spreads fast.`);
      break;
    }
    case 'outbreakover':
      addNews(`🌤️ The sickness has died down after ${days(e.days)}.` + (e.dead
        ? ` It took ${e.dead} ${e.dead === 1 ? 'rabbit' : 'rabbits'}. Those who pulled through won't catch it again for a while.` : ' Nobody died of it.'));
      break;
    case 'gathering': {
      const where = placeNear(e.remains.x, e.remains.y);
      addNews(`🐦‍⬛ <b>${e.n} crows</b> have gathered at the remains of ${link(e.remains.c)}${where ? ' ' + where : ''}. With the sickness going round, the crows are eating well.`);
      break;
    }
    case 'owlnest': {
      const d = e.tree;
      addNews(`🦉 ${link(e.c)} the owl has taken the hollow of ${thingLink('tree', d.id, d.name ? 'the ' + esc(d.name) : 'an old oak')} to nest in. Listen for the hoots at night.`, 'owlnest', 20000);
      break;
    }
    case 'fledge':
      addNews(`🪶 ${link(e.c)} the owlet has left the hollow${e.mum ? ` and follows ${link(e.mum)} about in the dark` : ''}, a fluffy grey thing on a branch.`, 'fledge', 30000);
      break;
    case 'owlleaves':
      addNews(`🦉 ${link(e.c)}, grown now, found no hollow free and is flying off to find a wood of its own.`, 'owlleaves', 30000);
      break;
    case 'holt': {
      const d = e.tree;
      addNews(`🦦 ${link(e.c)} the otter has made a holt in the roots of ${thingLink('tree', d.id, d.name ? 'the ' + esc(d.name) : `a big ${treeName(d).toLowerCase()} on the bank`)}.`, 'holt', 20000);
      break;
    }
    case 'cubsout':
      addNews(`🦦 ${link(e.c)} the otter cub has come out of the holt${e.mum ? ` and swims after ${link(e.mum)}` : ''}.`, 'cubsout', 30000);
      break;
    case 'otterleaves':
      addNews(`🦦 ${link(e.c)}, a year old now, ${e.c.sex === 'F' ? 'found no holt free' : 'found no room here'} and is off down the water to find a stretch of its own.`, 'otterleaves', 30000);
      break;
    case 'buried':
      addNews(`🌰 The crows buried ${e.n} ${e.n === 1 ? 'acorn' : 'acorns and beechnuts'} this autumn. The ones they forget will come up as oaks and beeches in the spring.`);
      break;
    case 'frogs': {
      const at = e.water ? `the ${e.water.name}` : 'the shallows';
      if (e.what === 'spawn') addNews(`🫧 <b>The frogs are spawning</b> in ${at}: a night of croaking, and clumps of frogspawn in the warm shallows.`, 'frogspawn', 30000);
      else if (e.what === 'stranded') addNews(`🫧 The water is falling back from the pools by ${at}, and the tadpoles in them are stranded in the mud${e.grown < 0.9 ? ', not grown yet' : ''}.`, 'tadpoles', 30000);
      else if (e.what === 'froglets') addNews(`🐸 <b>Froglets!</b> Tiny frogs are leaving ${at} for the long grass, and the foxes${S.OWLS ? ' and owls' : ''} are finding them.`, 'froglets', 30000);
      break;
    }
    case 'frogyear':
      if (e.big) addNews('🐸 <b>A big frog year!</b> The spring was kind and the tadpoles got out in time: the wet grass by the water is hopping with frogs.');
      else if (e.poor) addNews(`🐸 <b>A poor year for frogs.</b> ${e.stranded > 0.5 ? 'The water fell back before the tadpoles were grown, and hardly a froglet got out.' : 'Hardly a froglet made it out of the water this spring.'}`);
      break;
    case 'voles':
      addNews(e.boom ? '🐁 <b>A vole year!</b> The long grass is alive with voles, and the foxes are out mousing, leaping high to pounce.'
        : '🐁 <b>The voles have crashed.</b> The long grass has gone quiet, and the foxes are back to hunting rabbits.');
      break;
    case 'windfall':
      addNews(e.mast ? '🍂 <b>Windfalls!</b> Apples, acorns and beechnuts are dropping. Hungry rabbits are gathering under the trees.'
        : '🍎 <b>The apples are falling.</b> Hungry rabbits are gathering under the apple trees.');
      break;
    case 'bloom':
      addNews(`${e.field.emoji[0]} ${esc(e.field.name)} is in bloom.${e.field.season === 2 ? ' The last flowers before winter.' : ''}`);
      break;
    case 'flooded': {
      const { burrow: b, drowned, escaped } = e, who = escaped.slice(0, 3).map(link).join(', ') + (escaped.length > 3 ? ` and ${escaped.length - 3} more` : '');
      addEffect('🌊', b.x, b.y, 0.8);
      let t = escaped.length ? `🌊 The water reached a burrow. ${who} scrambled out` : '🌊 The water reached a burrow';
      if (drowned.length) t += `${escaped.length ? ', but' : '.'} ${drowned.length === 1 ? 'a kit' : drowned.length + ' kits'} too small to climb out drowned.`;
      else t += '.';
      if (drowned.length || e.escaped.some(c => c.id === ui.selectedId)) addNews(t); else addNews(t, 'flooded', 20000);
      break;
    }
    case 'dug': {
      dugAt.set(e.burrow, world.tick);
      addEffect('🕳️', e.burrow.x, e.burrow.y, 0.8);
      const t = `🕳️ ${link(e.c)} dug a new burrow.`;
      if (mine) addNews(t); else addNews(t, 'dug', 30000);
      break;
    }
    case 'escape': {
      hear('escape', e.rabbit.x, e.rabbit.y, { how: e.how }, mine);
      const t = e.how === 'burrow' ? `💨 ${link(e.rabbit)} dived into a burrow just before ${link(e.fox)} could pounce!`
        : e.how === 'pond' ? `🌊 ${link(e.rabbit)} put ${e.water ? e.water.name : 'the water'} between itself and ${link(e.fox)}, and got away!`
        : `💨 ${link(e.rabbit)} outran ${link(e.fox)}!`;
      if (mine) addNews(t); else addNews(t, 'escape', 11000);
      break;
    }
    case 'spotted': {
      hear('thump', e.rabbit.x, e.rabbit.y, {}, mine);
      const t = `‼️ ${link(e.rabbit)} spotted ${link(e.fox)} sneaking up and thumped the alarm.`;
      if (mine) addNews(t); else addNews(t, 'spotted', 20000);
      break;
    }
    case 'extinct':
      chime('extinct');
      addNews({
        rabbit: '😢 <b>The last rabbit is gone.</b>',
        fox: '😢 <b>The last fox is gone.</b> The rabbits can relax, for now.',
        bee: '😢 <b>The hive has gone quiet.</b> The last bee is gone.',
        crow: '😢 <b>The last crow is gone.</b> The remains lie longer now, and the acorns lie where they fall.',
        owl: '😢 <b>The last owl is gone.</b> The nights are quiet, and the hollow oaks stand empty.',
        otter: '😢 <b>The last otter is gone.</b> The fish have the water to themselves.',
      }[e.species]);
      break;
    case 'pollinate':
      puffPollen(e.x, e.y);
      break;
    case 'arrive': {
      if (e.family) intro.family = e.who;
      if (e.family) addNews(`🧳 ${link(e.who[0])} and ${link(e.who[1])} moved into the meadow, with their kits ${link(e.who[2])} and ${link(e.who[3])}.`);
      if (e.founding && e.species === 'rabbit') break;   // the rest come in quietly, a few at a time all day
      const names = e.who.map(link).join(', ');
      addNews({
        rabbit: `🧳 A family of rabbits hopped in from the next valley: ${names}.`,
        fox: `🧳 Foxes have wandered in, drawn by all the rabbits: ${names}.`,
        bee: `🐝 A swarm has found the empty hive and moved in: ${names}.`,
        crow: `🐦‍⬛ Crows have flown in over the trees: ${names}.`,
        owl: `🦉 ${e.who.length === 2 ? 'A pair of tawny owls has' : 'Tawny owls have'} flown in over the trees, looking for hollow oaks: ${names}.`,
        otter: `🦦 ${e.who.length === 2 ? 'A pair of otters has' : 'Otters have'} come up the water, looking for a bank to make a holt in: ${names}.`,
      }[e.species]);
      for (const c of e.who) addEffect('✨', c.x, c.y);
      hear('arrive', e.who[0].x, e.who[0].y, { species: e.species }, true);
      break;
    }
  }
}

// How many make a record worth telling, and how big a peak has to be before its crash is news.
const NEWSWORTHY = { rabbit: { record: 20, crash: 80 }, fox: { record: 8, crash: 10 }, bee: { record: 20, crash: 40 }, crow: { record: 25, crash: 15 }, owl: { record: 8, crash: 99 },
  otter: { record: 8, crash: 99 } };

function checkPopulationNews() {
  const h = world.history, n = h.rabbit.length;
  const from = Math.max(0, Math.min(ui.seenHistory, n - 1));   // every sample since last look, even at 60x
  ui.seenHistory = n;
  for (const s of S.KINDS) {
    const now = world.count[s], name = S.SPECIES[s].plural.toLowerCase(), big = NEWSWORTHY[s];
    const fresh = Math.max(...h[s].slice(from));
    if (world.tick < S.TPD * S.SEASON_DAYS) {                 // the first spring is not news
      ui.records[s] = Math.max(ui.records[s], fresh);
    } else if (fresh > ui.records[s]) {
      if (fresh >= Math.max(big.record, Math.ceil(ui.records[s] * 1.12))) {
        addNews(`📈 <b>${fresh} ${name}</b>, the most this meadow has ever had!`, 'record-' + s, 20000);
      }
      ui.records[s] = fresh;
    }
    const recent = h[s].slice(since(world.tick - S.YEAR_DAYS * S.TPD));
    const peak = Math.max(...recent);
    const season = S.seasonOf(world.tick) + 4 * S.clock(world).year;
    if (peak >= big.crash && now <= peak * 0.3 && ui.crashSaid[s] !== season && now > 0) {
      ui.crashSaid[s] = season;
      addNews(`📉 <b>The ${name} are crashing</b>: ${now} left, down from ${peak}.`);
    }
  }
}

// ------------------------------------------------------------------ the meadow card

// Index of the first history sample at or after tick t.
function since(t) {
  const a = world.history.t;
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < t) lo = m + 1; else hi = m; }
  return lo;
}

// The last two years as a small chart: a zero line, a dashed line at the peak, and both numbers
// in a narrow gutter on the right so you can read the scale.
function sparkline(canvas, data, color) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const pts = data.slice(since(world.tick - 2 * S.YEAR_DAYS * S.TPD));
  if (pts.length < 2) return;
  const peak = Math.max(...pts), max = Math.max(4, peak);
  const gut = 30 * dpr, pad = 6 * dpr, cw = w - gut, top = 6 * dpr, base = h - 6 * dpr;
  const x = i => (i / (pts.length - 1)) * cw, y = v => base - (v / max) * (base - top);
  g.font = `800 ${10 * dpr}px Nunito, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = MUTED;
  g.strokeStyle = '#e2d4ba'; g.lineWidth = dpr;
  g.beginPath(); g.moveTo(0, base + 0.5 * dpr); g.lineTo(cw, base + 0.5 * dpr); g.stroke();
  g.fillText('0', w - pad, base);
  if (peak > 0) {
    g.setLineDash([3 * dpr, 3 * dpr]);
    g.beginPath(); g.moveTo(0, y(peak)); g.lineTo(cw, y(peak)); g.stroke();
    g.setLineDash([]);
    g.fillText(Math.round(peak), w - pad, y(peak));
  }
  g.beginPath();
  g.moveTo(0, base);
  pts.forEach((v, i) => g.lineTo(x(i), y(v)));
  g.lineTo(cw, base);
  g.closePath();
  g.fillStyle = color + '2e';
  g.fill();
  g.beginPath();
  pts.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
  g.strokeStyle = color; g.lineWidth = 2 * dpr; g.lineJoin = 'round';
  g.stroke();
}

const TRAITS = [
  { k: 'speed', e: '⚡', name: 'Speed', words: ['sluggish', 'slow', 'average', 'quick', 'lightning fast'],
    up: 'faster', down: 'slower', tip: 'Runs faster, but moving costs more energy' },
  { k: 'size', e: '📏', name: 'Size', words: ['tiny', 'small', 'medium', 'big', 'huge'],
    up: 'bigger', down: 'smaller', tip: 'Holds more energy, but needs more food and runs a little slower' },
  { k: 'eyes', e: '👀', name: 'Eyesight', words: ['short-sighted', 'so-so eyes', 'good eyes', 'sharp eyes', 'eagle-eyed'],
    up: 'sharper-eyed', down: 'blurrier-eyed', tip: 'Sees further and spots danger sooner; costs a little energy' },
  { k: 'bravery', e: '🦁', name: 'Bravery', words: ['timid', 'cautious', 'steady', 'bold', 'fearless'],
    up: 'bolder', down: 'shyer', tip: 'Rabbits let foxes get closer before running. Foxes pounce from further away' },
  { k: 'friendly', e: '🤝', name: 'Friendly', words: ['a loner', 'independent', 'easygoing', 'friendly', 'super social'],
    up: 'friendlier', down: 'more solitary', tip: 'Likes to stay close to others' },
  { k: 'moult', e: '❄️', name: 'Winter coat', only: 'rabbit', words: ['keeps its colour', 'keeps its colour', 'pales a little', 'pales in winter', 'snow-white'],
    up: 'whiter in winter', down: 'less white in winter', tip: 'Turns white for winter: hidden on snow, easy to see on bare ground' },
  { k: 'resist', e: '🛡️', name: 'Resistance', only: 'rabbit', words: ['catches anything', 'delicate', 'fairly hardy', 'hardy', 'tough as old boots'],
    up: 'hardier', down: 'more delicate', tip: 'Less likely to catch the sickness or die of it, but burns a little more energy' },
];
const traitsOf = species => TRAITS.filter(t => !t.only || t.only === species);
const band = v => v < 0.3 ? 0 : v < 0.45 ? 1 : v < 0.55 ? 2 : v < 0.7 ? 3 : 4;   // 2, the middle, is "medium", "steady"…
const word = (t, v) => t.words[band(v)];

// Returns just the quiet words when there is nothing to show, so both species can share one line.
function evolutionLine(species) {
  const base = world.founderMeans[species], now = S.traitMeans(world, species);
  if (!base || !now) return 'none alive';
  const shifts = traitsOf(species).map(t => ({ t, d: (now[t.k] - base[t.k]) / base[t.k] }))
    .filter(s => Math.abs(s.d) >= 0.05)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2);
  if (!shifts.length) return 'no big changes yet';
  return shifts.map(s => {
    const up = s.d > 0;
    return `${s.t.e} ${up ? s.t.up : s.t.down} <span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.round(Math.abs(s.d) * 100)}%</span>`;
  }).join(' · ');
}

// Rewriting part of the page with what it already shows still costs the browser a layout and
// a repaint, and the card and inspector refresh four times a second. So only touch what changed.
const shownHTML = new WeakMap();
function setHTML(el, html) { if (shownHTML.get(el) !== html) { shownHTML.set(el, html); el.innerHTML = html; } }
function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

// The tab's icon keeps the meadow's time: the hill takes the season's colour and the sky the
// part of the day. It's the small mark from assets/favicon.svg, one of 16 made once each. It only
// changes when the season or the part of day does, at most once a second, and from 15x on the
// days fly by too fast to follow, so it stays noon and only the seasons turn.
const MARK_SKY = ['#F5E6CC', '#F1DDB0', '#F0CFA0', '#34405F'];   // morning, noon, evening, night
const MARK_HILL = [                                                // by season: day, night
  ['#6DAA50', '#3F6A3A'], ['#5F9346', '#3A5A38'], ['#A5823F', '#6B5A36'], ['#7C8CA6', '#6F7E99'],
];
const markIcons = new Map();
let markKey = -1, markAt = 0;
function markIcon(season, part) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 0 104 120"><rect x="50" y="10" width="20" height="16" rx="4" fill="#C08A38"/>'
    + '<circle cx="60" cy="70" r="48" fill="#D9A441"/><clipPath id="c"><circle cx="60" cy="70" r="37"/></clipPath><g clip-path="url(#c)">'
    + `<rect x="20" y="30" width="80" height="80" fill="${MARK_SKY[part]}"/>`
    + '<ellipse transform="rotate(-13 52 80)" cx="52" cy="80" rx="6.5" ry="14" fill="#FFFFFF"/><ellipse transform="rotate(10 66 79)" cx="66" cy="79" rx="6.5" ry="14.5" fill="#FFFFFF"/>'
    + `<path d="M20 98 C 40 86, 76 86, 100 96 L100 112 L20 112Z" fill="${MARK_HILL[season][part === 3 ? 1 : 0]}"/></g></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function updateFavicon(ck) {
  const part = ui.speed >= 15 ? 1 : ck.night ? 3 : ck.phase > 0.6 ? 2 : ck.phase < 0.1 ? 0 : 1;
  const key = ck.season * 4 + part, now = performance.now();
  if (key === markKey || now - markAt < 1000) return;
  markKey = key; markAt = now;
  if (!markIcons.has(key)) markIcons.set(key, markIcon(ck.season, part));
  $('#favicon').href = markIcons.get(key);
}

function updateMeadowCard() {
  const ck = S.clock(world);
  setText($('#season-emoji'), S.SEASONS[ck.season].emoji);
  setText($('#season-name'), S.SEASONS[ck.season].name);
  setText($('#clock-rest'), `· day ${ck.dayInSeason} · year ${ck.year}`);
  const kind = world.weather.kind, wx = S.WEATHER[kind];
  // One icon for the sky: clear weather shows the time of day instead of a plain sun.
  const icon = kind !== 'clear' ? wx.emoji : ck.night ? '🌙' : ck.phase > 0.6 ? '🌇' : ck.phase < 0.1 ? '🌅' : wx.emoji;
  const ground = world.burning.length ? '<span class="fire">🔥 wildfire!</span>'
    : world.snow > 0.3 ? 'snow on the ground' : world.wet > 0.7 ? 'soaked ground'
    : world.wet > 0.35 ? 'damp ground' : 'dry ground';
  const clearNight = kind === 'clear' && ck.night;
  const lock = world.skyLocked ? ' <span class="lock">🔒</span>' : '';
  setHTML($('#sky'), `${icon} <b>${clearNight ? 'Clear night' : wx.name}</b>${lock} · ${ground}`);
  $('#sky').title = WEATHER_HINT[kind] + (world.skyLocked ? '. Locked: it stays until you unlock it (K)' : '');
  setText($('#sky-btn'), wx.emoji);
  setHTML($('#mini-sky'), `<span id="mini-season">${S.SEASONS[ck.season].emoji}</span>${icon}`);   // phones hide the season
  updateFavicon(ck);
  for (const s of S.KINDS) {
    if (!SERIES[s]) continue;                              // (the owls, while they're off: sim.js OWLS)
    setText($('#mini-' + s), String(world.count[s]));
    setText($('#n-' + s), String(world.count[s]));
    sparkline($('#spark-' + s), world.history[s], SERIES[s].color);
  }
  // In the first year the averages wobble with every litter: that is luck, not evolution.
  const r = world.tick < S.YEAR_DAYS * S.TPD ? 'wait' : evolutionLine('rabbit'), f = r === 'wait' ? 'wait' : evolutionLine('fox');
  const quiet = v => !v.includes('<');
  if (r === f) {
    setHTML($('#evo-rabbit'), `<span class="quiet">${r === 'wait' ? 'Too early to tell. The animals start to drift after a year or two.' : '🐇 🦊 ' + r}</span>`);
    setHTML($('#evo-fox'), '');
  } else {
    setHTML($('#evo-rabbit'), '🐇 ' + (quiet(r) ? `<span class="quiet">${r}</span>` : r));
    setHTML($('#evo-fox'), '🦊 ' + (quiet(f) ? `<span class="quiet">${f}</span>` : f));
  }
}

// ------------------------------------------------------------------ the stats page

const SERIES = {
  rabbit: { emoji: '🐇', name: 'Rabbits', title: 'Rabbits alive', color: '#a07850', fmt: v => Math.round(v) },
  fox: { emoji: '🦊', name: 'Foxes', title: 'Foxes alive', color: '#e2702f', fmt: v => Math.round(v) },
  bee: { emoji: '🐝', name: 'Bees', title: 'Bees alive', color: '#d9a21b', fmt: v => Math.round(v) },
  crow: { emoji: '🐦‍⬛', name: 'Crows', title: 'Crows alive', color: '#4a4e5e', fmt: v => Math.round(v) },
  owl: { emoji: '🦉', name: 'Owls', title: 'Owls alive', color: '#9a6a3e', fmt: v => Math.round(v) },
  otter: { emoji: '🦦', name: 'Otters', title: 'Otters alive', color: '#7c5232', fmt: v => Math.round(v) },
  voles: { emoji: '🐁', name: 'Voles', title: 'Voles in the long grass', color: '#8a6a4e', fmt: v => Math.round(v) },
  frogs: { emoji: '🐸', name: 'Frogs', title: 'Frogs by the water', color: '#6f8f3e', fmt: v => Math.round(v) },
  fish: { emoji: '🐟', name: 'Fish', title: 'Fish in the water', color: '#5a8aa6', fmt: v => Math.round(v) },
  grass: { emoji: '🌱', name: 'Grass', title: 'How lush the meadow is', color: '#5f9e43', fmt: v => Math.round(v * 100) + '%' },
};
const SEASON_TINT = ['#f6dde5', '#f7ecb8', '#f4d6b6', '#dfe8f0'];
const RANGES = { year: S.YEAR_DAYS * S.TPD, five: 5 * S.YEAR_DAYS * S.TPD, all: Infinity };
const RANGE_WORDS = { year: 'the last year', five: 'the last 5 years', all: 'the whole story' };
const MARK_EMOJI = { extinct: '😢', arrive: '🧳', fire: '🔥', outbreak: '🤒' };
const CAUSES = [['fox', '🦊', 'Caught by a fox'], ['hunger', '🥀', 'Starved'], ['age', '🌙', 'Old age'],
  ['sickness', '🤒', 'Sickness'], ['lightning', '⚡', 'Lightning'], ['fire', '🔥', 'Wildfire'], ['flood', '🌊', 'Drowned in a flood'],
  ['ice', '🧊', 'Fell through the ice'], ['owl', '🦉', 'Taken by an owl'], ['left', '🧳', 'Left to find a home of its own']];
const INK = '#3b372f', MUTED = '#6f6657';

if (!S.OWLS) delete SERIES.owl;
const shownKeys = () => ui.stats.show === 'all' ? Object.keys(SERIES) : [ui.stats.show];

function toggleStats(open = !ui.stats.open) {
  ui.stats.open = open;
  ui.stats.hover = null;
  $('#stats').classList.toggle('hidden', !open);
  $('[data-act="stats"]').classList.toggle('on', open);
  if (open) { renderStats(); $('#stats').scrollTop = 0; }
}

function statsWindow() {
  const h = world.history, i0 = since(world.tick - RANGES[ui.stats.range]);
  const t0 = Math.max(world.tick - RANGES[ui.stats.range], h.t[0]);
  return { h, i0, t0, t1: Math.max(world.tick, t0 + S.TPD) };
}

function niceStep(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map(m => m * p).find(s => s >= v);
}

function fitCanvas(c, cssH) {
  const w = c.clientWidth;
  c.style.height = cssH + 'px';
  c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [g, w];
}

// The big chart: one panel per series, all sharing a time axis striped by season.
function drawStatsChart() {
  const c = $('#stats-chart'), keys = shownKeys();
  const TOP = 24, AXIS = 26, L = 48, R = 20;
  const panelH = keys.length > 1 ? 150 : Math.max(260, Math.min(420, window.innerHeight * 0.45));
  const [g, w] = fitCanvas(c, keys.length * (panelH + TOP) + AXIS);
  const { h, i0, t0, t1 } = statsWindow();
  const X = t => L + (t - t0) / (t1 - t0) * (w - L - R);
  const seasonT = S.SEASON_DAYS * S.TPD, yearT = S.YEAR_DAYS * S.TPD;
  const bottom = keys.length * (panelH + TOP);
  g.textBaseline = 'middle';

  // the hovered sample, snapped to the nearest one
  let hi = -1;
  if (ui.stats.hover !== null && h.t.length > i0) {
    const t = t0 + (ui.stats.hover - L) / (w - L - R) * (t1 - t0);
    hi = clamp(since(t), i0, h.t.length - 1);
    if (hi > i0 && t - h.t[hi - 1] < h.t[hi] - t) hi--;
  }

  keys.forEach((k, p) => {
    const top = p * (panelH + TOP) + TOP, bot = top + panelH, sr = SERIES[k];
    const data = h[k];

    // seasons, with their emoji above the first panel when there is room
    for (let s = Math.floor(t0 / seasonT) * seasonT; s < t1; s += seasonT) {
      const a = X(Math.max(s, t0)), b = X(Math.min(s + seasonT, t1)), si = S.seasonOf(s);
      g.fillStyle = SEASON_TINT[si];
      g.fillRect(a, top, b - a, panelH);
      if (p === 0 && b - a > 24) {
        g.font = '13px ' + EMOJI_FONT; g.textAlign = 'center'; g.fillStyle = INK;
        const label = b - a > 110 ? '' : S.SEASONS[si].emoji;
        if (label) g.fillText(label, (a + b) / 2, top - 11);
        else {
          g.font = '800 12px Nunito, sans-serif'; g.fillStyle = MUTED;
          g.fillText(S.SEASONS[si].emoji + ' ' + S.SEASONS[si].name, (a + b) / 2, top - 11);
        }
      }
    }

    // y axis: a few round numbers
    let max = 1, step = 0.25;
    if (k !== 'grass') {
      let m = 4;
      for (let i = i0; i < data.length; i++) m = Math.max(m, data[i]);
      step = niceStep(m / 4); max = Math.ceil(m * 1.05 / step) * step;
    }
    const Y = v => bot - (v / max) * (panelH - 8);
    g.font = '700 11px Nunito, sans-serif'; g.textAlign = 'right';
    for (let v = 0; v <= max + 1e-9; v += step) {
      g.fillStyle = 'rgba(59,55,47,0.10)'; g.fillRect(L, Math.round(Y(v)), w - L - R, 1);
      g.fillStyle = MUTED; g.fillText(sr.fmt(v), L - 8, Y(v));
    }

    // the line, with a soft fill under it
    if (data.length - i0 >= 2) {
      g.beginPath();
      g.moveTo(X(h.t[i0]), bot);
      for (let i = i0; i < data.length; i++) g.lineTo(X(h.t[i]), Y(data[i]));
      g.lineTo(X(h.t[data.length - 1]), bot);
      g.closePath();
      g.fillStyle = sr.color + '30'; g.fill();
      g.beginPath();
      for (let i = i0; i < data.length; i++) i > i0 ? g.lineTo(X(h.t[i]), Y(data[i])) : g.moveTo(X(h.t[i]), Y(data[i]));
      g.strokeStyle = sr.color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    }

    // big moments: extinctions and newcomers for animals, fires and your weather for the grass
    for (const m of h.marks) {
      const onGrass = m.type === 'sky' || m.type === 'fire';
      if (m.t < t0 || (onGrass ? k !== 'grass' : m.species !== k)) continue;
      const x = X(m.t);
      g.save(); g.setLineDash([3, 3]); g.strokeStyle = 'rgba(59,55,47,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, top + 18); g.lineTo(x, bot); g.stroke(); g.restore();
      g.font = '13px ' + EMOJI_FONT; g.textAlign = 'center'; g.fillStyle = INK;
      g.fillText(m.type === 'sky' ? S.WEATHER[m.kind].emoji : MARK_EMOJI[m.type], x, top + 10);
    }

    // which panel is which, when there are several
    if (keys.length > 1) {
      g.font = '800 12px Nunito, sans-serif';
      const label = sr.emoji + ' ' + sr.name, tw = g.measureText(label).width + 16;
      g.fillStyle = 'rgba(255,250,240,0.9)';
      g.beginPath(); g.roundRect(L + 6, top + 6, tw, 20, 10); g.fill();
      g.fillStyle = INK; g.textAlign = 'left'; g.fillText(label, L + 14, top + 16);
    }

    // today's value, labelled at the end of the line
    if (data.length > i0) {
      const x = X(h.t[data.length - 1]), y = Y(data[data.length - 1]);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
      g.fillStyle = sr.color; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
      g.font = '900 13px Nunito, sans-serif'; g.fillStyle = INK; g.textAlign = 'right';
      g.fillText(sr.fmt(data[data.length - 1]), x - 9, y < top + 20 ? y + 14 : y - 12);
    }
    if (hi >= 0) {
      const x = X(h.t[hi]), y = Y(data[hi]);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
      g.fillStyle = sr.color; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
    }
  });

  // years: a line where each one begins, labelled along the bottom
  const pxPerYear = yearT / (t1 - t0) * (w - L - R), every = Math.max(1, Math.ceil(56 / pxPerYear));
  g.font = '800 11px Nunito, sans-serif'; g.textAlign = 'center';
  for (let y = Math.ceil(t0 / yearT) * yearT; y <= t1; y += yearT) {
    const x = Math.round(X(y)), n = y / yearT + 1;
    g.fillStyle = 'rgba(59,55,47,0.28)'; g.fillRect(x, TOP, 1, bottom - TOP);
    if ((n - 1) % every === 0) { g.fillStyle = MUTED; g.fillText('Year ' + n, x, bottom + 13); }
  }

  // hover: a hairline and one readout for every panel
  const tip = $('#stats-tip');
  if (hi < 0) { tip.classList.add('hidden'); return; }
  const x = X(h.t[hi]);
  g.fillStyle = 'rgba(59,55,47,0.55)'; g.fillRect(Math.round(x), TOP, 1, bottom - TOP);
  const rows = Object.keys(SERIES).map(k =>
    `<div class="tip-row${keys.includes(k) ? '' : ' dim'}"><i style="background:${SERIES[k].color}"></i><b>${SERIES[k].fmt(h[k][hi])}</b> ${SERIES[k].name.toLowerCase()}</div>`);
  tip.innerHTML = `<div class="tip-when">${S.SEASONS[S.seasonOf(h.t[hi])].emoji} ${when(h.t[hi])}</div>` + rows.join('');
  tip.classList.remove('hidden');
  const tw = tip.offsetWidth;
  tip.style.left = (x + 14 + tw > w ? x - 14 - tw : x + 14) + 'px';
}

function seasonBars(k, i0) {
  const h = world.history, sum = [0, 0, 0, 0], n = [0, 0, 0, 0], sr = SERIES[k];
  for (let i = i0; i < h.t.length; i++) { const s = S.seasonOf(h.t[i]); sum[s] += h[k][i]; n[s]++; }
  const avg = sum.map((v, s) => n[s] ? v / n[s] : null);
  const max = Math.max(1e-9, ...avg.filter(v => v !== null));
  return `<div class="sbars"><div class="st-name">${sr.emoji} ${sr.name}</div><div class="sb-row">` + avg.map((v, s) =>
    `<div class="sb" title="${S.SEASONS[s].name}"><div class="sb-val">${v === null ? '–' : sr.fmt(v)}</div>` +
    `<div class="sb-bar"><span style="height:${v === null ? 0 : Math.max(2, v / max * 100)}%;background:${sr.color}"></span></div>` +
    `<div class="sb-lbl">${S.SEASONS[s].emoji}</div></div>`).join('') + '</div></div>';
}

function recordRows(k, i0) {
  const h = world.history, a = h[k], sr = SERIES[k];
  if (a.length <= i0) return '';
  let hi = i0, lo = i0, sum = 0;
  for (let i = i0; i < a.length; i++) { if (a[i] > a[hi]) hi = i; if (a[i] < a[lo]) lo = i; sum += a[i]; }
  const rows = [
    ['Now', sr.fmt(a[a.length - 1]), ''],
    ['Most', sr.fmt(a[hi]), when(h.t[hi])],
    ['Fewest', sr.fmt(a[lo]), when(h.t[lo])],
    ['Average', sr.fmt(sum / (a.length - i0)), ''],
  ];
  if (k === 'grass') { rows[1][0] = 'Lushest'; rows[2][0] = 'Barest'; }
  else {
    const alive = world.creatures.filter(c => c.alive && c.species === k);
    const oldest = alive.reduce((b, c) => (!b || c.born < b.born ? c : b), null);
    const parent = alive.reduce((b, c) => (!b || c.kids > b.kids ? c : b), null);
    if (oldest) rows.push(['Oldest alive', link(oldest), `${Math.floor(S.ageDays(world, oldest))} days`]);
    if (parent && parent.kids) rows.push(['Biggest family', link(parent), `${parent.kids} ${parent.kids === 1 ? 'child' : 'children'}`]);
  }
  return `<div class="st-name">${sr.emoji} ${sr.name}</div><table class="rec">` +
    rows.map(([a, b, c]) => `<tr><td>${a}</td><td><b>${b}</b></td><td>${c}</td></tr>`).join('') + '</table>';
}

function deathRows(k) {
  const d = world.stats.deaths[k], sr = SERIES[k];
  const total = CAUSES.reduce((n, [c]) => n + (d[c] || 0), 0);
  const head = `<div class="st-name">${sr.emoji} ${sr.name} <span class="st-sub">${world.stats.births[k]} born here · ${total} died</span></div>`;
  if (!total) return head + '<div class="st-sub">Nobody has died yet.</div>';
  return head + CAUSES.filter(([c]) => d[c]).map(([c, e, text]) => {
    const pct = d[c] / total * 100;
    return `<div class="dbar"><span class="dl">${e} ${text}</span><span class="dt"><span style="width:${pct}%;background:${sr.color}"></span></span>` +
      `<span class="dn"><b>${Math.round(pct)}%</b> ${d[c]}</span></div>`;
  }).join('');
}

function evoBlock(k) {
  const base = world.founderMeans[k], now = S.traitMeans(world, k), sr = SERIES[k];
  return `<div class="st-name">${sr.emoji} ${sr.name} <span class="st-sub">average of everyone alive · dashed line is where the first ones started</span></div><div class="evo-grid">` +
    traitsOf(k).map(t => {
      const d = base && now ? (now[t.k] - base[t.k]) / base[t.k] : 0;
      const chip = Math.abs(d) >= 0.02 ? `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.round(Math.abs(d) * 100)}%</span>` : '';
      return `<div class="evo-mini" title="${t.tip}"><div class="em-head">${t.e} ${t.name} ${chip}</div>` +
        `<div class="em-word">${now ? word(t, now[t.k]) : 'none alive'}</div><canvas data-evo="${k}|${t.k}"></canvas></div>`;
    }).join('') + '</div>' + (k === 'rabbit' ? coatTally() : '');
}

function coatTally() {
  const n = S.coatCounts(world), total = Object.values(n).reduce((a, b) => a + b, 0);
  if (!total) return '';
  return `<div class="coats"><b>🎨 Coats</b>` + Object.keys(COAT).filter(c => n[c]).map(c =>
    `<span><i style="background:${COAT[c].swatch}"></i>${S.COATS[c].name} <b>${Math.round(n[c] / total * 100)}%</b></span>`).join('') + '</div>';
}

function drawTrait(c, k, gene, i0) {
  const [g, w] = fitCanvas(c, 54);
  const h = world.history, tr = h.traits[k], base = world.founderMeans[k]?.[gene];
  const { t0, t1 } = statsWindow();
  let lo = base ?? 0.5, hi = lo;
  for (let i = i0; i < tr.length; i++) if (tr[i]) { lo = Math.min(lo, tr[i][gene]); hi = Math.max(hi, tr[i][gene]); }
  const mid = (lo + hi) / 2, half = Math.max(0.06, (hi - lo) / 2 * 1.15);
  const X = t => 2 + (t - t0) / (t1 - t0) * (w - 4), Y = v => 27 - (v - mid) / half * 23;
  if (base !== undefined) {
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(59,55,47,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, Y(base)); g.lineTo(w, Y(base)); g.stroke(); g.setLineDash([]);
  }
  g.beginPath();
  let pen = false;
  for (let i = i0; i < tr.length; i++) {
    if (!tr[i]) { pen = false; continue; }                 // nobody alive: a gap in the line
    const x = X(h.t[i]), y = Y(tr[i][gene]);
    pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true;
  }
  g.strokeStyle = SERIES[k].color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
}

function renderStatsCards() {
  const keys = shownKeys(), animals = keys.filter(k => S.KINDS.includes(k)), { i0 } = statsWindow();   // (voles aren't creatures: no deaths or genes to show)
  $('#stats-records').innerHTML = keys.map(k => recordRows(k, i0)).join('');
  $('#stats-seasons').innerHTML = keys.map(k => seasonBars(k, i0)).join('');
  $('#stats-deaths').innerHTML = animals.map(deathRows).join('');
  $('#stats-evo').innerHTML = animals.map(evoBlock).join('');
  $('#stats-deaths').parentElement.classList.toggle('hidden', !animals.length);
  $('#stats-evo').parentElement.classList.toggle('hidden', !animals.length);
  document.querySelectorAll('canvas[data-evo]').forEach(c => { const [k, gene] = c.dataset.evo.split('|'); drawTrait(c, k, gene, i0); });
}

function renderStats() {
  const keys = shownKeys();
  $('#stats-title').textContent = keys.length > 1 ? 'Rabbits, foxes, bees, voles, frogs and grass' : SERIES[keys[0]].emoji + ' ' + SERIES[keys[0]].title;
  $('#stats-range-note').textContent = 'over ' + RANGE_WORDS[ui.stats.range];
  $('#stats-clock').textContent = `${S.SEASONS[S.seasonOf(world.tick)].emoji} ${when(world.tick)}`;
  document.querySelectorAll('[data-show]').forEach(b => b.classList.toggle('on', b.dataset.show === ui.stats.show));
  document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('on', b.dataset.range === ui.stats.range));
  drawStatsChart();
  renderStatsCards();
}

$('#stats-chart').addEventListener('pointermove', e => { ui.stats.hover = e.offsetX; drawStatsChart(); });
$('#stats-chart').addEventListener('pointerleave', () => { ui.stats.hover = null; drawStatsChart(); });

// ------------------------------------------------------------------ who ate whom
//
// The meadow's food web as it ran (sim.js webCounts): the hunters on top, the plant-eaters under them, the
// plants at the bottom, and down the right the remains and the rich ground closing the loop. An arrow runs
// from the eaten to the eater, as thick as how much went along it, by the log (a million mouthfuls of grass
// and forty young rabbits both have to show). A thing gone just now fades, and its arrows with it. It's an
// SVG in a card of its own, made once. While it's open, once a second, only the attributes that changed are
// written; closed, it costs nothing.
const WEB_W = 400, WEB_H = 454, WEB_R = 19;
const WEB_NODES = {
  fox: { x: 110, y: 78, art: foxArtOf(0.2, 'stand'), name: 'Foxes', color: '#e2702f' },
  owl: { x: 196, y: 78, art: '🦉', name: 'Owls', color: '#9a6a3e' },
  otter: { x: 282, y: 78, art: 'otter:3', name: 'Otters', color: '#7c5232' },
  remains: { x: 368, y: 78, art: 'body:1', name: 'Remains', color: '#857565' },
  bee: { x: 36, y: 200, art: '🐝', name: 'Bees', color: '#d9a21b' },
  rabbit: { x: 108, y: 200, art: '🐇', name: 'Rabbits', color: '#a07850' },
  vole: { x: 180, y: 200, art: 'vole:0', name: 'Voles', color: '#8a6a4e' },
  frog: { x: 252, y: 200, art: 'frog:0', name: 'Frogs', color: '#6f8f3e' },
  fish: { x: 316, y: 200, art: 'icon:🐟', name: 'Fish', color: '#5a8aa6' },
  crow: { x: 376, y: 200, art: 'crow:0', name: 'Crows', color: '#4a4e5e' },
  flowers: { x: 36, y: 340, art: 'flower', name: 'Flowers', color: '#c0609a' },
  fruit: { x: 108, y: 340, art: 'icon:🍎', name: 'Fruit trees', color: '#c94a3a' },
  grass: { x: 180, y: 340, art: 'icon:🌿', name: 'Grass', color: '#5f9e43' },
  seedlings: { x: 252, y: 340, art: '🌱', name: 'Seedlings', color: '#7aa64a' },
  nuts: { x: 324, y: 340, art: 'icon:🌰', name: 'Acorns', color: '#9a7040' },
  soil: { x: 368, y: 412, art: 'icon:🪱', name: 'Rich soil', color: '#7a5a3a' },
};
// n: the count along it (a key of webCounts, or a function of v, the period's counts), none for a link that's
// real but not counted (a thin line). kind: 'body' for the dead left lying, 'grow' for what feeds the ground
// and the woods; bend: how far the curve bows out, to its left.
const WEB_LINKS = [
  { from: 'grass', to: 'rabbit', n: 'grazed', say: n => `Rabbits took ${many(n, 'mouthful')} of grass.` },
  { from: 'grass', to: 'vole', say: () => 'Voles live on the long grass. The rabbits keep it short round their warrens, and the voles off it.' },
  { from: 'seedlings', to: 'rabbit', n: 'seedlingsEaten', say: n => `Rabbits nibbled ${many(n, 'tree seedling')} to nothing.` },
  { from: 'seedlings', to: 'vole', n: 'seedlingsLost', say: n => `${upper(many(n, 'tree seedling'))} went in the grass, most to the voles.` },
  { from: 'fruit', to: 'rabbit', n: 'apples:rabbit', say: n => `Rabbits ate ${many(n, 'windfall apple')}.`, bend: -14 },
  { from: 'fruit', to: 'crow', n: 'apples:crow', say: n => `Crows ate ${many(n, 'windfall apple')}.`, bend: 30 },
  { from: 'fruit', to: 'bee', n: 'blossomSips', say: n => `Bees sipped ${many(n, 'blossom')} on the fruit trees, and the blossom they visit sets fruit.` },
  { from: 'flowers', to: 'bee', n: v => v('sips') - v('blossomSips'), say: n => `Bees sipped ${many(n, 'flower')}.` },
  { from: 'nuts', to: 'rabbit', n: 'nuts:rabbit', say: n => `Rabbits ate ${many(n, 'fallen nut')}, acorns and beechnuts.`, bend: -40 },
  { from: 'nuts', to: 'crow', n: v => v('cached') + v('nuts:crow'), bend: 12,
    say: (n, v) => `Crows carried off ${many(v('cached'), 'acorn')} to bury, and dug ${many(v('dugUp'), 'acorn')} up again${v('nuts:crow') ? `, and ate ${big(v('nuts:crow'))} where they fell` : ''}.` },
  { from: 'crow', to: 'nuts', kind: 'grow', n: 'planted', say: n => `${upper(many(n, 'acorn'))} the crows forgot came up as trees.`, bend: 12 },
  { from: 'rabbit', to: 'fox', n: 'died:rabbit:fox', say: n => `Foxes caught ${many(n, 'rabbit')}.` },
  { from: 'rabbit', to: 'owl', n: 'died:rabbit:owl', say: n => `Owls took ${many(n, 'young rabbit')}.`, bend: 10 },
  { from: 'vole', to: 'fox', n: 'voles', say: n => `Foxes caught ${many(n, 'vole')}, mousing in the long grass.`, bend: 10 },
  { from: 'vole', to: 'owl', n: 'owlVoles', say: n => `Owls caught ${many(n, 'vole')}.`, bend: -10 },
  { from: 'frog', to: 'fox', n: 'frogs', say: n => `Foxes caught ${many(n, 'frog')}.`, bend: -10 },
  { from: 'frog', to: 'owl', n: 'owlFrogs', say: n => `Owls caught ${many(n, 'frog')}.` },
  { from: 'frog', to: 'crow', n: 'crowSpawn', say: n => `Crows ate frogspawn and tadpoles, as many as would have made ${many(n, 'frog')}.`, bend: -16 },
  { from: 'frog', to: 'fish', n: 'fishSpawn', say: n => `Fish ate tadpoles, as many as would have made ${many(n, 'frog')}. The flood pools have none.` },
  { from: 'fish', to: 'otter', n: 'fish', say: n => `Otters caught ${many(n, 'fish')}, diving.` },
  { from: 'frog', to: 'otter', n: 'otterFrogs', say: n => `Otters caught ${many(n, 'frog')}, at the spawning and dug out of the winter mud.`, bend: 10 },
  { from: 'soil', to: 'crow', n: 'grubs', say: n => `Crows pecked ${many(n, 'grub')} out of the short grass and the rich ground.`, bend: 20 },
  { from: 'remains', to: 'crow', n: 'remainsCrows', say: n => `Crows fed at the remains of ${many(n, 'animal')}.`, bend: 14 },
  { from: 'remains', to: 'soil', kind: 'grow', n: 'remainsRotted', say: n => `${upper(many(n, 'body'))} rotted away where they lay, into the ground.`, bend: -26 },
  { from: 'soil', to: 'grass', kind: 'grow', say: () => 'Rich ground grows lusher grass. What dies on it, the droppings round the warrens and old logs all feed it.', bend: -60 },
  { from: 'rabbit', to: 'remains', kind: 'body', n: 'bodies:rabbit', say: n => `${upper(many(n, 'rabbit'))} were left lying, caught or dead out in the open.`, bend: 34 },
  { from: 'fox', to: 'remains', kind: 'body', n: 'bodies:fox', say: n => `${upper(many(n, 'fox'))} died out in the open and were left lying.`, bend: 34 },
  { from: 'owl', to: 'remains', kind: 'body', n: 'bodies:owl', say: n => `${upper(many(n, 'owl'))} died out in the open and were left lying.`, bend: 12 },
  { from: 'otter', to: 'remains', kind: 'body', n: 'bodies:otter', say: n => `${upper(many(n, 'otter'))} died out on the bank and were left lying.`, bend: 12 },
  { from: 'crow', to: 'remains', kind: 'body', n: 'bodies:crow', say: n => `${upper(many(n, 'crow'))} died out in the open and were left lying.`, bend: -14 },
];
if (!S.OWLS) {                                             // (owls are off for now: sim.js OWLS)
  delete WEB_NODES.owl; WEB_NODES.fox.x = 150; WEB_NODES.otter.x = 260;
  for (let i = WEB_LINKS.length - 1; i >= 0; i--) if (WEB_LINKS[i].from === 'owl' || WEB_LINKS[i].to === 'owl') WEB_LINKS.splice(i, 1);
}
const WEB_WHEN = { season: null, year: 'Last year', all: 'Since the start' };
const web = { open: false, when: 'year', at: 0, hover: null, pin: null, v: null, live: null, built: false };
const webOpen = () => web.open;

const PLURALS = { body: 'bodies', fox: 'foxes', fish: 'fish' };
const big = n => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million` : Math.round(n).toLocaleString('en-US'));
const many = (n, one) => { n = Math.round(n); return n <= 0 ? `no ${PLURALS[one] || one + 's'}` : n === 1 ? `one ${one}` : `${big(n)} ${PLURALS[one] || one + 's'}`; };
const upper = s => s[0].toUpperCase() + s.slice(1);
const andList = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

// A node's picture, painted once into a little canvas of its own (not the sprite cache, which lets go):
// the meadow's own painted animals and bubble icons where there are some, else the emoji.
const webIcons = new Map();
function webIcon(art) {
  let url = webIcons.get(art);
  if (url) return url;
  const px = 34 * 3, size = Math.ceil(px * 1.3), c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), colon = art.indexOf(':');
  if (art.startsWith('icon:')) {
    const i = BUBBLE_ICONS.findIndex(([e]) => e === art.slice(5));
    g.setTransform(px / 2, 0, 0, px / 2, size / 2, size / 2); g.lineCap = g.lineJoin = 'round';
    BUBBLE_ICONS[i][1](g);
  } else if (art === 'flower') {
    const f = flowerSprite((2 * 8) * 64 + Math.min(FLOWER_MAX_K, Math.round(2 * Math.log2(px * 0.9))));   // daisies
    const k = 1.5 * Math.min(size / f.width, size / f.height);   // (the clump is small in its box)
    g.drawImage(f, (size - f.width * k) / 2, (size - f.height * k) / 2, f.width * k, f.height * k);
  } else if (art.startsWith('body:')) paintBody(g, size, px * 1.3, +art.slice(5), null, 0.4);   // bigger, and in the middle
  else if (colon > 0 && PAINTERS[art.slice(0, colon)]) PAINTERS[art.slice(0, colon)](g, size, px, +art.slice(colon + 1));
  else {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${px}px ${EMOJI_FONT}`;
    g.fillText(art, size / 2, size / 2 + px * 0.06);
  }
  webIcons.set(art, url = c.toDataURL());
  return url;
}

const svgEl = (tag, attrs, parent) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
// Set only what changed.
const setAttr = (e, k, v) => { v = String(v); if (e.getAttribute(k) !== v) e.setAttribute(k, v); };

// Where a link runs: a curve bowing out by its bend, from the edge of one node to the tip of its arrowhead
// at the other; w its width.
function webGeometry(l, w) {
  const a = WEB_NODES[l.from], b = WEB_NODES[l.to], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const cx = (a.x + b.x) / 2 - dy / d * (l.bend || 0), cy = (a.y + b.y) / 2 + dx / d * (l.bend || 0);
  const unit = (x, y, tx, ty) => { const k = Math.hypot(tx - x, ty - y); return [(tx - x) / k, (ty - y) / k]; };
  const [sx, sy] = unit(a.x, a.y, cx, cy), [ex, ey] = unit(b.x, b.y, cx, cy);
  const head = 5 + w * 0.9, half = 3.5 + w * 0.7;
  const x0 = a.x + sx * (WEB_R + 3), y0 = a.y + sy * (WEB_R + 3);
  const tx = b.x + ex * (WEB_R + 3), ty = b.y + ey * (WEB_R + 3);               // the arrow's tip
  const bx = tx + ex * head, by = ty + ey * head;                              // the middle of its base
  const f = n => n.toFixed(1);
  return {
    line: `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(tx + ex * head * 0.8)} ${f(ty + ey * head * 0.8)}`,
    head: `M${f(tx)} ${f(ty)}L${f(bx - ey * half)} ${f(by + ex * half)}L${f(bx + ey * half)} ${f(by - ex * half)}Z`,
  };
}

function buildWeb() {
  const svg = $('#web-svg');
  svg.setAttribute('viewBox', `0 0 ${WEB_W} ${WEB_H}`);
  for (const [y, t] of [[140, 'the hunters'], [270, 'the foragers'], [404, 'what grows']]) {
    svgEl('text', { x: 8, y, class: 'web-row' }, svg).textContent = t;
  }
  const links = svgEl('g', {}, svg), nodes = svgEl('g', {}, svg);
  WEB_LINKS.forEach((l, i) => {
    const n = WEB_NODES[l.from];
    const g = l.el = svgEl('g', { class: 'web-link' + (l.kind ? ' ' + l.kind : ''), 'data-pick': 'link:' + i, fill: n.color, stroke: n.color }, links);
    l.hit = svgEl('path', { class: 'hit', fill: 'none' }, g);
    l.line = svgEl('path', { class: 'ln', fill: 'none' }, g);
    l.head = svgEl('path', { class: 'hd', stroke: 'none' }, g);
  });
  for (const k in WEB_NODES) {
    const n = WEB_NODES[k], g = n.el = svgEl('g', { class: 'web-node', 'data-pick': 'node:' + k }, nodes);
    svgEl('circle', { cx: n.x, cy: n.y, r: WEB_R, class: 'disc', stroke: n.color }, g);
    svgEl('image', { href: webIcon(n.art), x: n.x - 15, y: n.y - 15, width: 30, height: 30 }, g);
    const up = n.y < 100;                                   // the top row's names above, clear of the arrows coming up
    svgEl('text', { x: n.x, y: up ? n.y - WEB_R - 19 : n.y + WEB_R + 13, class: 'name' }, g).textContent = n.name;
    n.now = svgEl('text', { x: n.x, y: up ? n.y - WEB_R - 7 : n.y + WEB_R + 25, class: 'now' }, g);
  }
  svg.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest('[data-pick]');
    web.hover = t ? t.dataset.pick : null; sayWeb();
  });
  svg.addEventListener('pointerleave', () => { web.hover = null; sayWeb(); });
  svg.addEventListener('click', e => {
    const t = e.target.closest('[data-pick]'), k = t ? t.dataset.pick : null;
    web.pin = k && k !== web.pin ? k : null; sayWeb();
  });
  $('#web').addEventListener('click', e => {
    const b = e.target.closest('[data-web]');
    if (b) { web.when = b.dataset.web; updateWeb(); }
  });
  web.built = true;
}

// The counts for the period, from the snapshot the sim took at its start (none: since the meadow began).
function webPeriod() {
  const snaps = world.stats.web || [];
  if (web.when === 'all' || !snaps.length) return null;
  if (web.when === 'season') return snaps[snaps.length - 1];
  const from = world.tick - S.YEAR_DAYS * S.TPD;
  return snaps.find(s => s.t >= from) || null;
}

// What's there now, for the second line under each node and for fading the ones gone.
function webLive() {
  const w = world, trees = { fruit: 0, nuts: 0, seedlings: 0 };
  for (const d of w.decor) {
    if (!d.tree || !S.standing(d)) continue;
    if (d.size < S.SAPLING) trees.seedlings++;
    else if (d.kind === 'apple' || d.kind === 'cherry' || d.kind === 'hawthorn') trees.fruit++;
    else if (d.kind === 'oak' || d.kind === 'beech') trees.nuts++;
  }
  const g = w.history.grass;
  return {
    ...Object.fromEntries(S.KINDS.map(s => [s, w.count[s]])), ...trees,
    vole: Math.round(w.voleCount), frog: Math.round(w.frogCount), spawn: w.spawnCount >= 0.5, fish: Math.round(w.fishCount), flowers: w.flowers,
    remains: w.carcasses.length, grass: g.length ? g[g.length - 1] : 1, hives: w.hives.filter(h => h.bees > 0 && !h.cluster).length,
    sick: w.sick, mast: w.mast, voleYear: w.voleYear, holts: w.decor.filter(d => d.holt).length,
  };
}
const webGone = (k, live) => (k in live ? (k === 'grass' ? false : k === 'frog' ? !live.frog && !live.spawn : !live[k]) : false);
function webNow(k, L) {
  switch (k) {
    case 'grass': return Math.round(L.grass * 100) + '% grown';
    case 'soil': return '';
    case 'vole': case 'frog': case 'fish': return L[k] ? '~' + big(L[k]) : k === 'frog' && L.spawn ? 'spawn' : 'none now';
    case 'flowers': return L.flowers ? big(L.flowers) + ' open' : 'none open';
    case 'remains': return L.remains ? L.remains + ' lying' : 'none lying';
    case 'fruit': case 'nuts': return L[k] ? L[k] + (L[k] === 1 ? ' tree' : ' trees') : 'none now';
    default: return L[k] ? big(L[k]) : 'none now';
  }
}

// A deaths-and-births line for an animal over the period: "120 born; 80 caught by foxes and 12 starved."
const WEB_DIED = { fox: 'caught by foxes', owl: 'taken by owls', sickness: 'died of the sickness', hunger: 'starved', age: 'died of old age', left: 'left the meadow' };
function lifeLine(s, v, cur) {
  const parts = [], rest = {};
  for (const key in cur) {
    if (!key.startsWith('died:' + s + ':')) continue;
    const c = key.slice(6 + s.length), n = v(key);
    if (n <= 0) continue;
    if (WEB_DIED[c]) parts.push([n, `${big(n)} ${WEB_DIED[c]}`]); else rest[c] = n;
  }
  const other = Object.values(rest).reduce((a, b) => a + b, 0);
  if (other) parts.push([other, `${big(other)} lost to ${andList(Object.keys(rest).map(c => ({ fire: 'fire', flood: 'floods', ice: 'the ice', lightning: 'lightning' })[c] || c))}`]);
  parts.sort((a, b) => b[0] - a[0]);
  const born = v('born:' + s);
  return `${born ? big(born) : 'None'} born${parts.length ? '; ' + andList(parts.map(p => p[1])) : ''}.`;
}

function webNodeSay(k, v, L, cur) {
  const n = WEB_NODES[k], count = L[k];
  const head = count ? `${big(count)} ${n.name.toLowerCase()} now` : `No ${n.name.toLowerCase()} now`;
  switch (k) {
    case 'rabbit': return `${head}${L.sick ? `, ${L.sick} of them sick` : ''}. ${lifeLine(k, v, cur)}`;
    case 'fox': return `${head}. They caught ${andList([many(v('died:rabbit:fox'), 'rabbit'), many(v('voles'), 'vole'), many(v('frogs'), 'frog')])}. ${lifeLine(k, v, cur)}`;
    case 'owl': return `${head}. They caught ${andList([many(v('owlVoles'), 'vole'), many(v('owlFrogs'), 'frog'), many(v('died:rabbit:owl'), 'young rabbit')])}. ${lifeLine(k, v, cur)}`;
    case 'otter': return `${head}${L.holts ? `, ${L.holts === 1 ? 'one holt' : L.holts + ' holts'} on the banks` : ''}. They caught ${andList([many(v('fish'), 'fish'), many(v('otterFrogs'), 'frog')])}, and their spraint feeds the bank by the holt. ${lifeLine(k, v, cur)}`;
    case 'fish': return `${count ? `About ${big(count)} fish in the water that lasts the year round` : 'No fish in the water now'}. They ate tadpoles, as many as would have made ${many(v('fishSpawn'), 'frog')}, and the otters caught ${big(v('fish'))}.`;
    case 'crow': return `${head}. They pecked ${many(v('grubs'), 'grub')}, fed at ${many(v('remainsCrows'), 'body')}, ate spawn worth ${many(v('crowSpawn'), 'frog')} and ${many(v('apples:crow'), 'windfall')}, and buried ${many(v('cached'), 'acorn')}. ${lifeLine(k, v, cur)}`;
    case 'bee': return `${head}${count ? `, in ${L.hives === 1 ? 'one hive' : L.hives + ' hives'}` : ''}. They sipped ${many(v('sips') - v('blossomSips'), 'flower')} and ${many(v('blossomSips'), 'blossom')}. ${lifeLine(k, v, cur)}`;
    case 'vole': return `${count ? `About ${big(count)} voles in the long grass now${L.voleYear ? ', a vole year' : ''}` : 'No voles in the grass now'}. Foxes caught ${big(v('voles'))}${S.OWLS ? ` and owls ${big(v('owlVoles'))}` : ''}.`;
    case 'frog': return `${count ? `About ${big(count)} frogs by the water now` : L.spawn ? 'No frogs out now, but spawn in the pools' : 'No frogs now'}. Foxes caught ${big(v('frogs'))}, ${S.OWLS ? `owls ${big(v('owlFrogs'))}, ` : ''}otters ${big(v('otterFrogs'))}, crows ate spawn worth ${many(v('crowSpawn'), 'frog')} and fish tadpoles worth ${big(v('fishSpawn'))}.`;
    case 'grass': return `The meadow's grass is ${Math.round(L.grass * 100)}% grown. Rabbits took ${many(v('grazed'), 'mouthful')} of it, and voles live in the long grass.`;
    case 'flowers': return `${L.flowers ? `${big(L.flowers)} flowers open now` : 'No flowers open now'}. Bees sipped ${many(v('sips') - v('blossomSips'), 'flower')}.`;
    case 'fruit': return `${L.fruit ? `${big(L.fruit)} apple, cherry and hawthorn trees` : 'No fruit trees now'}. They blossom for the bees in spring (${many(v('blossomSips'), 'visit')}) and bear as much as the bees visited: rabbits ate ${many(v('apples:rabbit'), 'windfall')}, crows ${big(v('apples:crow'))}.`;
    case 'nuts': return `${L.nuts ? `${big(L.nuts)} oaks and beeches${L.mast ? ', and a mast year' : ''}` : 'No oaks or beeches now'}. Rabbits ate ${many(v('nuts:rabbit'), 'fallen nut')}, crows buried ${many(v('cached'), 'acorn')}, and ${many(v('planted'), 'forgotten one')} came up as trees.`;
    case 'seedlings': return `${L.seedlings ? `${big(L.seedlings)} seedlings coming up now` : 'No seedlings coming up now'}. Rabbits nibbled ${many(v('seedlingsEaten'), 'seedling')} to nothing, and ${big(v('seedlingsLost'))} more went in the grass, most to the voles.`;
    case 'remains': return `${L.remains ? `${big(L.remains)} remains lying now` : 'No remains lying now'}. ${upper(many(v('remainsLeft'), 'body'))} left lying; the crows fed at ${big(v('remainsCrows'))}, and ${big(v('remainsRotted'))} rotted away.`;
    case 'soil': return 'The ground remembers what lived and died on it. Remains, the droppings round the warrens and old logs feed it, the grass grows back lusher there, and the crows peck grubs out of it.';
  }
  return '';
}

function sayWeb() {
  if (!web.v) return;
  const pick = web.hover || web.pin, svg = $('#web-svg');
  let text = '';
  const hot = new Set();
  if (pick) {
    const [kind, id] = pick.split(':');
    if (kind === 'link') { const l = WEB_LINKS[+id]; text = l.say(l.value, web.v); hot.add(l.el); hot.add(WEB_NODES[l.from].el); hot.add(WEB_NODES[l.to].el); }
    else {
      text = webNodeSay(id, web.v, web.live, web.cur); hot.add(WEB_NODES[id].el);
      for (const l of WEB_LINKS) if (l.from === id || l.to === id) { hot.add(l.el); hot.add(WEB_NODES[l.from].el); hot.add(WEB_NODES[l.to].el); }
    }
  } else {
    const gone = ['fox', 'owl', 'otter', 'crow', 'bee', 'rabbit', 'vole', 'frog', 'fish'].filter(k => WEB_NODES[k] && webGone(k, web.live)).map(k => WEB_NODES[k].name.toLowerCase());
    text = (gone.length ? `No ${andList(gone)} now. ` : '') + (canHover.matches ? 'Point at' : 'Tap') + ' an animal or an arrow to see who ate whom.';
  }
  svg.classList.toggle('picking', !!pick);
  for (const e of svg.querySelectorAll('.web-node, .web-link')) e.classList.toggle('hot', hot.has(e));
  setHTML($('#web-say'), text);
}

function updateWeb() {
  if (!web.built) buildWeb();
  const cur = S.webCounts(world), base = webPeriod(), b = base ? base.n : null;
  const v = key => Math.max(0, (cur[key] || 0) - (b ? b[key] || 0 : 0));
  const L = webLive();
  web.v = v; web.cur = cur; web.live = L;
  for (const k in WEB_NODES) {
    const n = WEB_NODES[k], gone = webGone(k, L);
    n.el.classList.toggle('gone', gone);
    const now = webNow(k, L);
    if (n.now.textContent !== now) n.now.textContent = now;
  }
  for (const l of WEB_LINKS) {
    l.value = !l.n ? null : typeof l.n === 'function' ? Math.max(0, l.n(v)) : v(l.n);
    const w = l.value === null ? 1.4 : l.value > 0 ? Math.min(9, 1.2 + 1.3 * Math.log10(1 + l.value)) * (l.kind === 'body' ? 0.6 : 1) : 1;
    const wr = Math.round(w * 2) / 2;                        // a few widths: small changes don't show, nor get written
    if (l.w !== wr) {
      l.w = wr;
      const geo = webGeometry(l, wr);
      setAttr(l.line, 'd', geo.line); setAttr(l.hit, 'd', geo.line); setAttr(l.head, 'd', geo.head);
      setAttr(l.line, 'stroke-width', wr);
    }
    l.el.classList.toggle('none', l.value === 0);
    l.el.classList.toggle('uncounted', l.value === null);
    l.el.classList.toggle('gone', webGone(l.from, L) || webGone(l.to, L));
  }
  const season = S.SEASONS[S.seasonOf(world.tick)].name.toLowerCase();
  const seasonBtn = $('[data-web="season"]');
  if (seasonBtn.textContent !== 'This ' + season) seasonBtn.textContent = 'This ' + season;
  document.querySelectorAll('[data-web]').forEach(e => e.classList.toggle('on', e.dataset.web === web.when));
  sayWeb();
}

function toggleWeb(open = !web.open) {
  web.open = open;
  if (open && ui.stats.open) toggleStats(false);
  $('#web').classList.toggle('hidden', !open);
  if (open) { web.pin = web.hover = null; updateWeb(); web.at = performance.now(); }
}

// ------------------------------------------------------------------ the inspector

// "Spring · day 3" in the season's colours, and the year when it isn't this one.
function seasonChip(t, year) {
  const s = S.seasonOf(t), day = Math.floor(t / S.TPD), y = Math.floor(day / S.YEAR_DAYS) + 1;
  return `<span class="chip fr s${s}">${S.SEASONS[s].name} · day ${day % S.SEASON_DAYS + 1}</span>`
    + (y !== year ? `<span class="yr">year ${y}</span>` : '') + '<br>';
}

function when(t) {
  const s = S.seasonOf(t), day = Math.floor(t / S.TPD);
  return `${S.SEASONS[s].name} ${day % S.SEASON_DAYS + 1}, Y${Math.floor(day / S.YEAR_DAYS) + 1}`;
}

function lifeStage(c) {
  const age = S.ageDays(world, c), g = S.growth(world, c);
  if (g < 0.5) return 'baby';
  if (g < 1) return 'youngster';
  if (age > c.lifespan / S.TPD * 0.8) return 'elder';
  return 'adult';
}

// The three traits that stand out most, as "⚡ sluggish · 🛡️ catches anything". The middle words say nothing,
// so they're left out. A tap on the line shows them all (traitRows).
function traitLine(species, genes) {
  const odd = traitsOf(species).filter(t => band(genes[t.k]) !== 2)
    .sort((a, b) => Math.abs(genes[b.k] - 0.5) - Math.abs(genes[a.k] - 0.5)).slice(0, 3);
  return odd.length ? odd.map(t => `${t.e} ${word(t, genes[t.k])}`).join('<span class="sep">·</span>') : 'Middling in everything';
}

const traitRows = (species, genes) => traitsOf(species).map(t => `<div class="trait" title="${t.tip}"><span>${t.e}</span><span>${t.name}</span>
  <div class="meter"><span style="width:${Math.round(genes[t.k] * 100)}%"></span></div>
  <span class="word">${word(t, genes[t.k])}</span></div>`).join('');
const traitsHTML = (species, genes) => `<button class="traits ${ui.allTraits ? 'open' : ''}" data-act="traits" title="${ui.allTraits ? 'Fewer traits' : 'All the traits'}">
    <span>${traitLine(species, genes)}</span><span class="more" aria-hidden="true">›</span></button>
  ${ui.allTraits ? `<div class="trait-table">${traitRows(species, genes)}</div>` : ''}`;

// On a phone the inspector opens folded to one line: who, what they're up to, and the tummy (or a
// thing's first meter) as a thin line under that. Tap it for the rest.
const stripHTML = (tint, face, name, line, meter) => `
  <div class="strip-row" data-act="sheet-up" title="Show more">
    <div class="portrait" style="background:${tint}33">${face}</div>
    <div class="strip-text"><div class="strip-name">${name}</div><div class="strip-line">${line}</div>
      ${meter ? `<div class="meter strip-meter ${meter[1]}"><span style="width:${Math.round(clamp(meter[0], 0, 1) * 100)}%"></span></div>` : ''}</div>
    <span class="strip-more" aria-hidden="true">︿</span>
    <button class="close" data-act="close" title="Close (Esc)">✕</button>
  </div>`;

const STORY_SHORT = 4;                    // life-story lines shown before "Show all"
const RING_HTML = '<span class="ring" title="Yours: you named it"></span>';
// The name at the top of the inspector, when you can name it: a tap turns it into a field (startNaming).
const nameButton = (html, title) => `<button class="name-edit" data-act="name" title="${title}">${html}<span class="pen" aria-hidden="true">✏️</span></button>`;
function renderInspector() {
  if (ui.naming && document.activeElement?.id === 'name-input') return;   // not under your typing
  const box = $('#inspector');
  const c = world.byId.get(ui.selectedId), thing = !c && ui.picked;
  const strip = !!(c || thing) && !ui.sheetUp && narrow();
  document.body.classList.toggle('inspecting', !!(c || thing));
  document.body.classList.toggle('ins-strip', strip);
  if (!c && !thing) { box.classList.remove('open'); setHTML(box, ''); return; }
  box.classList.add('open');
  box.classList.toggle('strip', strip);
  if (thing) { renderThing(box, strip); return; }
  const age = Math.floor(S.ageDays(world, c));
  const sex = c.sex === 'F' ? '♀' : '♂';
  const mood = S.mood(world, c);
  const e = c.energy / c.maxEnergy;
  if (strip) {
    setHTML(box, stripHTML(furCss(c), portraitHTML(c), `${esc(c.name)}${c.mine ? RING_HTML : ''} <span class="sex">${sex}</span>`,
      `${mood.emoji || '🙂'} ${esc(mood.text)}`, c.alive && [e, e < 0.3 ? 'low' : '']));
    return;
  }
  const mum = world.byId.get(c.mumId), dad = world.byId.get(c.dadId);
  const parent = (p, label) => p ? `${label} ${link(p)}${p.alive ? '' : ' 🪦'}` : '';
  const parents = [parent(mum, 'Mum'), parent(dad, 'Dad')].filter(Boolean).join(' · ');
  const kidsAlive = c.kids && world.creatures.filter(k => k.mumId === c.id || k.dadId === c.id).length;
  const chips = [];
  if (c.alive && c.pregnantUntil) chips.push(c.species === 'fox' ? '🍼 Expecting cubs' : '🍼 Expecting babies');
  if (c.kills) chips.push(`🍖 ${c.kills} ${c.kills === 1 ? 'catch' : 'catches'}`);
  if (c.voles) chips.push(`🐁 ${c.voles} ${c.voles === 1 ? 'vole' : 'voles'} caught`);
  if (c.fish) chips.push(`🐟 ${c.fish} fish caught`);
  if (c.frogs) chips.push(`🐸 ${c.frogs} ${c.frogs === 1 ? 'frog' : 'frogs'} caught`);
  if (c.escapes) chips.push(`💨 ${c.escapes} narrow ${c.escapes === 1 ? 'escape' : 'escapes'}`);
  if (c.visits) chips.push(`🌼 ${c.visits} ${c.visits === 1 ? 'flower' : 'flowers'} visited`);
  const mate = c.species === 'crow' && c.mate && world.byId.get(c.mate);
  if (mate) chips.push(mate.alive ? `💞 Paired with ${link(mate)}` : `🥀 Lost its mate ${link(mate)}`);
  if (c.species === 'crow' && c.home) chips.push(`${c.sex === 'F' ? '🪺 Nests in' : '🌳 Its patch is round'} ${thingLink('tree', c.home.id, c.home.name ? 'the ' + esc(c.home.name) : 'a tall ' + treeName(c.home).toLowerCase())}`);
  if (c.species === 'owl' && c.home && c.home.owl === c.id) chips.push(`🕳️ Nests in the hollow of ${thingLink('tree', c.home.id, c.home.name ? 'the ' + esc(c.home.name) : 'an old oak')}`);
  else if (c.species === 'owl' && c.home) chips.push(`🌳 Lives in the wood round ${thingLink('tree', c.home.id, c.home.name ? 'the ' + esc(c.home.name) : 'an old oak')}`);
  if (c.species === 'otter' && c.home) chips.push(`🕳️ ${c.home.holt === c.id ? 'Her holt is' : 'Lives in the holt'} in the roots of ${thingLink('tree', c.home.id, c.home.name ? 'the ' + esc(c.home.name) : 'a big ' + treeName(c.home).toLowerCase())}`);
  if (c.caches?.length && S.seasonOf(world.tick) >= 2) chips.push(`🌰 Remembers where ${c.caches.length === 1 ? 'one acorn is' : c.caches.length + ' acorns are'} buried`);
  const nemesis = world.byId.get(c.nemesisId);
  if (nemesis && nemesis.alive) chips.push(`😨 Afraid of ${link(nemesis)}`);
  if (c.alive && c.sick) chips.push('🤒 Sick');
  else if (c.alive && c.immune > world.tick) chips.push(`🛡️ Immune to the sickness for ${days((c.immune - world.tick) / S.TPD)}`);
  const story = c.story.slice().reverse().slice(0, ui.allStory ? Infinity : STORY_SHORT).map(s =>
    `<li><span>${s.emoji}</span><span>${esc(s.text)}<div class="when">${when(s.t)}</div></span></li>`).join('');
  const nameable = c.alive && c.species !== 'bee', named = esc(c.name) + (c.mine ? RING_HTML : '');
  const living = c.alive ? '' : world.creatures.find(k => k.mumId === c.id || k.dadId === c.id);

  setHTML(box, `
    <button class="sheet-handle phone-only" data-act="sheet-down" aria-label="Show less"></button>
    <div class="ins-head">
      <div class="portrait" style="background:${furCss(c)}33">${portraitHTML(c)}</div>
      <div>
        <div class="ins-name">${ui.naming === c.id ? nameInput(c.name) : nameable
          ? nameButton(named, c.mine ? 'Rename it' : "Give it a name of your own: you'll hear how its life goes") : named} <span style="color:var(--muted)">${sex}</span></div>
        <div class="ins-sub">${c.alive ? `${c.sp.name} · ${lifeStage(c)} · ${age} ${age === 1 ? 'day' : 'days'} old`
          : `${c.sp.name} · lived ${age} ${age === 1 ? 'day' : 'days'}`}</div>
      </div>
      <button class="close" data-act="close" title="Close (Esc)">✕</button>
    </div>
    <div class="mood">${mood.emoji || '🙂'} ${esc(mood.text)}</div>
    ${c.alive ? `<div class="meters">
      <div class="meter-row">Tummy <div class="meter ${e < 0.3 ? 'low' : ''}"><span style="width:${Math.round(e * 100)}%"></span></div></div>
      ${c.stamina < 1 ? `<div class="meter-row">Breath <div class="meter stamina"><span style="width:${Math.round(c.stamina * 100)}%"></span></div></div>` : ''}
    </div>` : ''}
    ${chips.length ? `<div class="chips">${chips.map(x => `<span class="chip">${x}</span>`).join('')}</div>` : ''}
    ${traitsHTML(c.species, c.genes)}
    <div class="family">
      ${c.genes.coat ? `${coatLine(c)}<br>` : ''}
      ${c.queen ? `A daughter of 👑 Queen ${esc(c.queen.name)}${c.queen.died ? ' 🪦' : ''}, who has raised ${c.queen.kids} bees`
        : c.gen === 1 ? 'One of the first arrivals' : parents ? `${parents} <span class="dim">· generation ${c.gen}</span>` : `Generation ${c.gen}`}
      ${c.kids ? `<br>${c.kids} ${c.kids === 1 ? 'child' : 'children'}${kidsAlive ? `, ${kidsAlive} still alive` : ''}` : ''}
    </div>
    <h4>Life story</h4>
    <ul class="story">${story}</ul>
    ${c.story.length > STORY_SHORT ? `<button class="story-more" data-act="story">${ui.allStory ? 'Show less' : `Show all ${c.story.length}`}</button>` : ''}
    <div class="ins-actions">
      ${c.alive ? `<button class="btn ${ui.follow ? 'on' : ''}" data-act="follow">${ui.follow ? '📍 Following' : '📍 Follow'}</button>`
        : living ? `<button class="btn" data-act="child" data-id="${living.id}">🐣 Follow ${esc(living.name)}</button>` : ''}
    </div>`);
}

// ------------------------------------------------------------------ things: everything else you can click
//
// A click that finds no animal looks for a thing under it, in the order of THINGS (what's on top
// first): a hive, a tree or rock, remains, a burrow, a flower, a flower field, water. Bare ground finds
// nothing and closes the inspector. Each kind says how to find one on the screen (at), whether it
// is still there (here), where to ring it (spot, in tiles; fields and water are too big and get
// only a label) and what the inspector shows (show):
//   { emoji, tint, name, sub, status, meters: [[label, 0..1, class]], chips, facts: [[emoji, text]],
//     sections: [[title, html]] }
// Names from the sim go through esc; status, facts and sections are html.

const days = n => { n = Math.max(0, Math.round(n)); return `${n} ${n === 1 ? 'day' : 'days'}`; };
const hours = t => { const n = Math.max(1, Math.round(t / S.TPD * 24)); return `${n} ${n === 1 ? 'hour' : 'hours'}`; };
const ago = t => days((world.tick - t) / S.TPD);
const tileOf = (x, y) => clamp(Math.floor(y), 0, S.H - 1) * S.W + clamp(Math.floor(x), 0, S.W - 1);
const seasonName = s => S.SEASONS[s].name.toLowerCase();
const thingLink = (kind, id, text) => `<a data-thing="${kind}:${id}">${text}</a>`;

// Who is about near a spot, as "🐇 2 · 🦊 1".
function whoNear(x, y, r, keep = () => true) {
  const n = {};
  for (const c of world.creatures) {
    if (c.alive && !c.hidden && (c.x - x) ** 2 + (c.y - y) ** 2 < r * r && keep(c)) n[c.sp.emoji] = (n[c.sp.emoji] || 0) + 1;
  }
  return Object.entries(n).map(([e, k]) => `${e} ${k}`).join(' · ');
}

const linkList = (list, most = 12) => list.slice(0, most).map(link).join(', ') + (list.length > most ? ` and ${list.length - most} more` : '');

// The tree or rock drawn under a spot on the screen; the one in front if they overlap.
function decorAt(sx, sy) {
  const z = cam.zoom;
  let best = null;
  for (const d of world.decor) {
    const [dx, dy] = toScreen(d.x, d.y), px = (d.tree ? treePx(d) : d.size * z) * (d.stump ? 0.45 : 1);
    const half = Math.max(6, px * (d.fallen ? 0.55 : d.tree ? 0.36 : 0.5)), top = Math.max(10, px * (d.fallen ? 0.3 : d.tree ? 0.85 : 0.6));
    if (Math.abs(sx - dx) < half && sy > dy - top && sy < dy + Math.max(4, px * 0.12) && (!best || d.y > best.y)) best = d;
  }
  return best;
}

const TREE_NAMES = { oak: 'Oak', beech: 'Beech', maple: 'Maple', birch: 'Birch', willow: 'Willow', hawthorn: 'Hawthorn',
  apple: 'Apple tree', cherry: 'Cherry tree', pine: 'Pine' };
const treeName = d => d.kind === 'beech' && d.tone === 3 ? 'Copper beech' : TREE_NAMES[treeInfo(d).kind];
// What the inspector and the news call a tree: its name if it's an old giant with one (sim.js oldName), else what it is now.
function treeTitle(d) {
  if (d.name) return `The ${d.name}`;
  const kind = treeName(d), low = kind.toLowerCase(), short = (d.tone === 3 && d.kind === 'beech' ? 'copper beech' : S.KIND_NAMES[d.kind].toLowerCase());
  switch (S.treeStage(world, d)) {
    case 'seedling': return `${short[0].toUpperCase() + short.slice(1)} seedling`;
    case 'sapling': return `${short[0].toUpperCase() + short.slice(1)} sapling`;
    case 'young': return `Young ${low}`;
    case 'old': return `Old ${low}`;
    case 'dead': return `${d.burnt ? 'Burnt' : 'Dead'} ${low}`;
    case 'log': return `Fallen ${low}`;
    case 'stump': return `${kind} stump`;
    default: return kind;
  }
}
// Is a grown hawthorn close enough to keep rabbits off this one (sim.js THORNS)? False for a hawthorn itself.
const thornGuard = d => d.kind !== 'hawthorn' && world.decor.some(o => o !== d && o.kind === 'hawthorn' && S.standing(o) && o.size >= S.SAPLING && Math.hypot(o.x - d.x, o.y - d.y) < 1.8);

function treeSeason(d) {
  const s = S.seasonOf(world.tick), info = treeInfo(d), k = info.kind, oak = k === 'oak' || !HAS_BARE;
  if (k === 'pine') return s === 3 ? '🌲 Evergreen, dark against the snow' : '🌲 Evergreen';
  if (s === 0) return info.fruit ? `🌸 In ${info.fruit} blossom` : k === 'hawthorn' ? '🤍 White with may blossom' : '🌱 Coming into leaf';
  if (s === 1) return info.fruit === 'apple' ? '🍏 Apples ripening' : info.fruit === 'cherry' ? '🍒 Hung with cherries' : k === 'willow' ? '🌿 Trailing its long green curtains' : '🌳 In full leaf';
  if (s === 2) return info.fruit === 'apple' ? '🍎 Dropping ripe apples' : k === 'hawthorn' ? '🔴 Red with haws' : oak ? '🍂 Leaves turned brown' : '🍂 Leaves turning';
  if (k === 'hawthorn') return '🔴 Bare, a few red haws left';
  if (k === 'willow') return '🌾 Bare golden withies';
  return oak ? '🍂 Holding on to its dry leaves' : '🪾 Bare for the winter';    // (oak when there's no 🪾)
}

const ROCK_NAMES = { pebbles: 'Pebbles', stone: 'Stone', boulder: 'Boulder', great: 'Great rock', ford: 'Stepping stone' };
const ROCK_SAYS = {
  pebbles: '🪨 A scatter of pebbles', stone: '🪨 A lone stone', boulder: '🪨 A boulder, half sunk in the ground',
  great: '⛰️ One of the great rocks of the meadow', ford: '🦶 A stepping stone at the ford',
};
const PLANT_NAMES = { '🌷': 'Tulip', '🌼': 'Daisy', '🌸': 'Blossom', '🌻': 'Sunflower', '🪻': 'Bluebell', '🌿': 'Tuft of grass',
  '🌱': 'Green shoot', '🍂': 'Fallen leaves', '🌾': 'Seed heads', '❄️': 'Frost' };
const WATER_LOOKS = { river: '🏞️', lake: '🌊', pond: '💧', brook: '💦' };

// The water line against the usual one, as the sim's news tells it (waterTick).
function waterLine() {
  const T = world.terrain, d = world.level - T.level;
  if (d > T.springFlood / 2) return ['⬆️', 'The water is high, out over the low meadows'];
  if (d < -T.summerLow / 2) return ['⬇️', 'The water is low, the banks showing'];
  return ['〰️', 'The water is at its usual line'];
}

const THINGS = {
  hive: {
    at: (sx, sy) => hiveAt(sx, sy, true),
    here: h => world.hives.includes(h),
    spot: h => ({ x: h.x, y: h.y, r: 1.1 }),
    show(h) {
      if (!this.here(h)) {
        if (h.queen) return { emoji: '🐝', name: 'A swarm', sub: 'Moved on', status: '🏡 The swarm has moved into its new home.' };
        if (h.cluster) return { emoji: '🐝', name: 'A swarm', sub: 'Gone', status: '🥀 The swarm never found a home.' };
        return { emoji: '🪵', name: 'Empty hive', sub: 'Gone', status: '⚡ Lightning took its tree.' };
      }
      const q = h.queen, ck = S.clock(world), s = ck.season;
      const bees = world.creatures.filter(c => c.alive && c.home === h), out = bees.filter(c => !c.hidden).length;
      let status;
      if (h.cluster) status = `🐝 Hanging in a tree while scouts look for a home. They move in ${hours(h.settleAt - world.tick)}.`;
      else if (!q) status = '🕸️ Empty. The old comb waits for a swarm.';
      else if (world.tick < q.laysFrom) status = '💒 The new queen is away on her wedding flight';
      else if (S.patchFresh(world, h)) status = `💃 Dancing about ${h.patch.field ? esc(`the ${h.patch.field.name}`) : 'flowers'} to the ${compass(h.patch.x - h.x, h.patch.y - h.y)}`;
      else if (out) status = `🌼 ${out} out among the flowers`;
      else status = ck.night ? '💤 Asleep for the night' : s === 3 ? '❄️ Huddled up for the winter, living on honey'
        : ['rain', 'storm'].includes(world.weather.kind) ? '🌧️ Waiting out the rain' : '🏠 Everyone is in';
      const chips = [`🍯 ${Math.round(h.honey)} honey`, `🐝 ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'}`];
      if (s >= 2 && h.winterBees) chips.push(`❄️ ${h.winterBees} winter ${h.winterBees === 1 ? 'bee' : 'bees'}`);
      if (h.swarmed > 0) chips.push(`🪽 Swarmed ${ago(h.swarmed)} ago`);
      const facts = [];
      if (h.bees >= S.HIVE_ROOM * 0.8 && !h.cluster) facts.push(['🏘️', 'Crowded: ready to swarm come spring or summer']);
      if (q && s >= 2) facts.push(['🍯', `${Math.round(h.honey / Math.max(1, h.bees))} honey put by for each bee`]);
      const fields = world.fields.filter(f => Math.hypot(f.x - h.x, f.y - h.y) < S.FORAGE_RANGE);
      const sections = [];
      if (q) sections.push([`👑 Queen ${esc(q.name)}`, `<div class="family">Generation ${q.gen} · queen for ${ago(q.since)} · has raised ${q.kids} ${q.kids === 1 ? 'bee' : 'bees'}${q.mum ? `<br>A daughter of Queen ${esc(q.mum)}` : ''}</div>${traitsHTML('bee', q.genes)}`]);
      sections.push(['Flowers in reach', fields.length
        ? fields.map(f => `${f.emoji[0]} ${thingLink('field', f.id, esc(f.name))} <span class="dim">· ${seasonName(f.season)} · to the ${compass(f.x - h.x, f.y - h.y)}</span>`).join('<br>')
        : 'No flower fields, only the flowers scattered about']);
      if (bees.length) sections.push(['Bees', linkList(bees)]);
      return {
        emoji: h.cluster ? '🐝' : '🌳', tint: '#e8b83a', name: h.cluster ? `Queen ${q.name}'s swarm` : q ? `Queen ${q.name}'s hive` : 'Empty hive',
        queen: q && { key: 'hive:' + h.id, name: q.name, mine: q.mine, what: h.cluster ? 'swarm' : 'hive' },
        sub: h.cluster ? 'A swarm looking for a home' : `A hollow in an old ${treeName(h.tree).toLowerCase()}`, status, chips, facts, sections,
        meters: [['Honey', h.honey / S.HIVE_FULL, 'honey'], ['Room', h.bees / S.HIVE_ROOM, h.bees >= S.HIVE_ROOM * 0.8 ? 'low' : '']],
      };
    },
  },

  tree: {
    at: (sx, sy) => { const d = decorAt(sx, sy); return d && d.tree ? d : null; },
    here: d => world.decor.includes(d),
    spot: d => ({ x: d.x, y: d.y, r: treePx(d) / cam.zoom * (d.stump ? 0.2 : d.fallen ? 0.5 : 0.3) }),
    show(d) {
      const name = treeTitle(d), kind = treeName(d).toLowerCase();
      if (!this.here(d)) return { emoji: '🍂', tint: '#b8a47a', name, sub: 'Gone', status: (d.size < S.SAPLING ? '🍂 It didn\'t make it.' : '🍂 It has rotted away into the ground.')
        + (d.planted ? ` You planted it in the ${plantedWhen(d)}.` : '') };
      const stage = S.treeStage(world, d), age = S.treeAge(world, d), k = S.TREES[d.kind], i = tileOf(d.x, d.y), wood = world.wood[i];
      const where = wood >= 0.95 ? 'deep in the wood' : wood >= 0.6 ? 'at the edge of the wood' : 'standing on its own';   // as plantTrees tells them
      const living = S.standing(d), young = YOUNG.has(stage);
      let status;
      if (world.fire[i] > 0) status = '🔥 On fire!';
      else if (d.stump) status = `⚡ Struck by lightning ${ago(d.stump)} ago. It will sprout again from the stump.`;
      else if (stage === 'log') status = `🪵 Down ${ago(d.fallen)}, rotting away. Beetles and fungi are at work.`;
      else if (stage === 'dead') status = d.burnt ? `🔥 Killed by a fire ${ago(d.dead)} ago. It stands black and bare, and one day it will fall.`
        : `🪾 Died ${ago(d.dead)} ago. It stands grey and bare, and one day it will fall.`;
      else if (young && world.fire[i] === 0 && wood > k.shade) status = k.shade > 0.6 ? '🌑 Waiting in the shade for an old tree to fall' : '🌑 Too much shade: it is struggling';
      else if (young && d.size < S.SAPLING) status = thornGuard(d) ? '🌿 Safe among the thorns from hungry rabbits' : '🐇 Small enough for a rabbit to nibble';
      else status = treeSeason(d);
      const facts = [], parent = d.parent && world.decor.find(o => o.id === d.parent);
      const from = parent ? thingLink('tree', parent.id, treeTitle(parent).replace(/^The /, 'the ')) : `an old ${kind} long gone`;
      if (d.planted) facts.push(['🤲', `You planted this in the ${plantedWhen(d)}`]);
      if (living || d.stump) facts.push(['🎂', `${age < 1 ? days(age * S.YEAR_DAYS) : `${Math.floor(age)} ${Math.floor(age) === 1 ? 'year' : 'years'}`} old`]);
      if (d.sprouted) facts.push(['🪵', 'Grew again from the stump of a tree lightning took']);
      else if (d.by === 'crow') facts.push(['🐦‍⬛', `Grew from ${k.mast === 'acorns' ? 'an acorn' : 'a beechnut'} a crow carried off from ${from}, buried, and forgot`]);
      else if (d.by === 'bird') facts.push(['🐦', `Grew from a stone a bird dropped, from ${d.kind === 'cherry' ? 'the cherries' : 'the haws'} of ${from}`]);
      else if (d.by === 'wind') facts.push(['🌬️', `Its seed blew in on the wind from ${from}`]);
      else if (d.by === 'drop') facts.push(k.mast ? ['🌰', `Grew from ${k.mast === 'acorns' ? 'an acorn' : 'a beechnut'} that fell from ${from}`] : ['🍎', `Grew from a pip of ${from}`]);
      const owl = d.owl && world.byId.get(d.owl);
      if (d.hive) facts.push(['🐝', `${thingLink('hive', d.hive.id, d.hive.queen ? `Queen ${esc(d.hive.queen.name)}'s hive` : 'An empty hive')} is in its hollow`]);
      else if (owl && owl.alive) facts.push(['🦉', `${link(owl)} the owl nests in its hollow`]);
      const otter = d.holt && world.byId.get(d.holt);
      if (otter && otter.alive) facts.push(['🦦', `${link(otter)} the otter has her holt in its roots, down by the water`]);
      else if (S.hollow(world, d)) facts.push(['🕳️', `Old enough to have gone hollow: bees${S.OWLS ? ' or owls' : ''} could make a home in it`]);
      if (living && S.bearing(world, d)) {
        const bear = { wind: '🌬️ Sheds its seed on the wind each autumn', crow: `🌰 Its ${k.mast} are a feast in a mast year, and the crows bury them far and wide`,
          bird: `🐦 Birds carry off its ${d.kind === 'cherry' ? 'cherries' : 'haws'} and drop the stones far and wide`, drop: '🍎 Drops its apples for whoever comes by' }[k.by];
        facts.push([bear.slice(0, 2), bear.slice(3)]);
      }
      if (living && k.blossom && d.blooms) {
        if (S.inBloom(world, d)) facts.push(['🐝', `In blossom: the bees have been ${d.visits ? `${d.visits} ${d.visits === 1 ? 'time' : 'times'}` : 'yet to come'}`]);
        else if (S.seasonOf(world.tick) > 0) facts.push(['🐝', d.crop > 0.8 ? 'The bees came to its blossom: a full crop this year' : d.crop > 0.4 ? 'Some bees came to its blossom: a fair crop this year' : 'Few bees came to its blossom: a poor crop this year']);
      }
      if (living && !young && k.thorns) facts.push(['🌿', 'Its thorns keep rabbits off the seedlings under it']);
      const kids = world.decor.filter(o => o.parent === d.id && S.standing(o)).length;
      if (kids) facts.push(['🌱', `${kids} of its young ${kids === 1 ? 'grows' : 'grow'} in the meadow`]);
      if (d === world.roost) facts.push(['🐦‍⬛', 'The crows\' roost: they all sleep here at night']);
      if (world.creatures.some(c => c.alive && c.species === 'crow' && c.home === d)) facts.push(['🪺', 'A crows\' nest is up in it']);
      if (d.nuts && S.seasonOf(world.tick) === 2) facts.push(['🌰', `${d.nuts} ${d.nuts === 1 ? k.mast.slice(0, -1) : k.mast} left for the crows to carry off and bury`]);
      if (world.snow > 0.3 && !d.stump) facts.push(['❄️', d.fallen ? 'Snow on it' : 'Snow on the branches']);
      if (d.windfall) facts.push([d.kind === 'apple' ? '🍎' : '🌰', `${d.windfall === 1 ? `A windfall ${d.kind === 'apple' ? 'apple lies' : k.mast.slice(0, -1) + ' lies'}` : `${d.windfall} windfall ${d.kind === 'apple' ? 'apples' : k.mast} lie`} under it, for any hungry rabbit`]);
      if (living && !young && world.wet < 0.5) facts.push(['⚡', 'Dry: a lightning strike would set it alight']);   // as strike does
      const shade = whoNear(d.x, d.y, Math.max(1.5, treePx(d) / cam.zoom * 0.4));
      if (shade) facts.push([d.fallen ? '🪵' : '🌳', `${d.fallen ? 'By it' : 'Under it'}: ${shade}`]);
      const swarm = world.hives.find(h => h.cluster && Math.hypot(h.x - d.x, h.y - d.y) < 2);
      if (swarm) facts.push(['🐝', `${thingLink('hive', swarm.id, 'A swarm')} is hanging in it`]);
      const STAGES = { seedling: 'Seedling', sapling: 'Sapling', young: 'Young', grown: 'Grown', old: 'Old', dead: 'Dead', log: 'Fallen', stump: 'Stump' };
      return {
        emoji: d.stump || d.fallen ? '🪵' : d.dead ? '🪾' : stage === 'seedling' ? '🌱' : d.emoji, tint: d.dead ? '#b8a47a' : '#7fb24a', name,
        sub: `${STAGES[stage]} · ${where}`, status, facts,
        meters: living ? [['Grown', d.size / Math.max(d.max, d.size), ''], ['Age', age / d.life, age > d.life * 0.85 ? 'low' : '']] : null,
      };
    },
  },

  rock: {
    at: (sx, sy) => { const d = decorAt(sx, sy); return d && !d.tree ? d : null; },
    here: () => true,
    spot: d => ({ x: d.x, y: d.y, r: d.size * 0.45 }),
    show(d) {
      const t = rockInfo(d), wood = world.wood[tileOf(d.x, d.y)], water = S.waterAt(world, d.x, d.y);
      const where = t.kind === 'ford' ? (water ? `across the ${water.name}` : 'at an old ford')
        : wood > 0.3 ? 'in the wood' : water && Math.hypot(water.x - d.x, water.y - d.y) < 12 ? `by the ${water.name}` : 'out in the meadow';
      const facts = [];
      if (t.kind === 'great') facts.push(['🕳️', 'Rabbits never dig close to it']);
      if (t.kind === 'ford') facts.push(['🦶', world.water[tileOf(d.x, d.y)] === S.DEEP ? 'Under deep water just now' : 'Animals wade across the river here']);
      if (t.moss > 0.3) facts.push(['🌿', t.moss > 0.7 ? 'Thick with moss' : 'Mossy']);
      if (t.kind !== 'ford' && world.snow > 0.3) facts.push(['❄️', 'Capped with snow']);
      const who = whoNear(d.x, d.y, Math.max(1.5, d.size * 0.6));
      if (who) facts.push(['👀', `Near it: ${who}`]);
      const T = world.terrain, big = T.bigRockSize[1];
      return { emoji: '🪨', tint: '#b8ae9c', name: ROCK_NAMES[t.kind], sub: where, status: ROCK_SAYS[t.kind], facts, meters: [['Size', d.size / big, '']] };
    },
  },

  remains: {
    at(sx, sy) {
      const r = Math.max(8, bodyPx(cam.zoom) * 0.5);
      let best = null, bd = r * r;
      for (const k of world.carcasses) {
        const [x, y] = toScreen(k.x, k.y), d = (x - sx) ** 2 + (y + r * 0.4 - sy) ** 2;
        if (k.meat > 0 && d < bd) { best = k; bd = d; }
      }
      return best;
    },
    here: k => k.meat > 0 && world.carcasses.includes(k),
    spot: k => ({ x: k.x, y: k.y + 0.3, r: 0.6 }),
    show(k) {
      const c = k.c, killer = world.byId.get(c.killerId);
      const how = { fox: `caught by ${killer ? killer.name : 'a fox'}`, owl: `caught by ${killer ? killer.name : 'an owl'} the owl`, hunger: 'starved', sickness: 'the sickness', age: 'old age',
        lightning: 'lightning', fire: 'the wildfire' }[c.cause] || c.cause;
      const name = `The remains of ${c.name}`, sub = `${c.species === 'fox' ? 'A fox' : `A ${c.sp.name.toLowerCase()}`} (${how})`;
      if (!this.here(k)) return { emoji: '🌱', tint: '#9cc27a', name, sub, status: '🌱 Gone back into the ground. The grass will be lush here for a while.' };
      const crows = world.creatures.filter(o => o.alive && o.target === k && o.mode === 'carrion');
      const status = crows.length ? `🐦‍⬛ ${crows.length === 1 ? `${link(crows[0])} is` : `${crows.length} crows are`} pecking at them`
        : world.tick - k.fox < 150 ? '🦊 A fox was here: the crows keep off a while' : '🍂 Lying in the grass, going back to the earth';
      const ago = world.tick - c.died, facts = [['📖', `${link(c)} died ${ago < S.TPD ? hours(ago) : days(ago / S.TPD)} ago`]];
      const s = S.seasonOf(world.tick);
      facts.push(s === 1 ? ['☀️', 'In the summer heat they won\'t last long'] : s === 3 ? ['❄️', 'In the cold they keep a while'] : ['🍂', 'They\'ll be gone in a few days']);
      if (crows.length > 1) facts.push(['🐦‍⬛', linkList(crows, 6)]);
      return { emoji: c.species === 'crow' || c.species === 'owl' ? '🪶' : '🍂', tint: '#b8a47a', name, sub, status, facts, meters: [['Left', k.meat / k.full, '']] };
    },
  },

  burrow: {
    at(sx, sy) {
      const z = cam.zoom, r = Math.max(5, z * 0.8), reach = Math.max(10, r * 1.4);
      let best = null, bd = reach * reach;
      for (const b of world.burrows) {
        const [bx, by] = toScreen(b.x, b.y), d = (bx - sx) ** 2 + (by - r * 0.3 - sy) ** 2;
        if (d < bd) { best = b; bd = d; }
      }
      return best;
    },
    here: b => world.burrows.includes(b),
    spot: b => ({ x: b.x, y: b.y, r: 1 }),
    show(b) {
      if (!this.here(b)) {
        return { emoji: '🕳️', name: 'Burrow', sub: 'Gone', status: world.water[tileOf(b.x, b.y)] ? '🌊 Flooded and lost' : '🌾 Fallen in: nobody came back to it' };
      }
      const T = world.terrain, made = dugAt.get(b), idle = (world.tick - b.used) / S.TPD;
      const home = world.creatures.filter(c => c.alive && c.home === b), inside = world.creatures.filter(c => c.alive && c.hidden && c.burrow === b);
      let status;
      if (b.dug < 1) status = `⛏️ Being dug: ${Math.round(b.dug * 100)}% done`;
      else if (inside.length) status = `💤 ${inside.length} inside: ${linkList(inside, 6)}`;
      else if (idle > S.SEASON_DAYS * 0.4) status = `🌾 Growing over: it falls in within ${days(S.SEASON_DAYS - idle)} unless someone comes back`;
      else status = '🕳️ Empty for now';
      const facts = [];
      const high = T.level + T.springFlood + T.rainRise / 2;       // the highest the water gets, about (as plantTrees)
      facts.push(world.ground[tileOf(b.x, b.y)] < high ? ['🌊', 'Low ground: a spring flood could reach it'] : ['⛰️', 'High and dry, safe from floods']);
      if (b.dug >= 1) facts.push(['🐾', `Last used ${idle < 1 ? 'today' : `${days(idle)} ago`}`]);
      let rich = 0;                                              // its latrines (sim.js groundTick), fouled past 0.3 (FOULED)
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) rich = Math.max(rich, world.rich[tileOf(b.x + dx, b.y + dy)]);
      if (rich > 0.3) facts.push(['🌿', 'Lush grass round its latrines, which the rabbits won\'t graze']);
      const foxes = whoNear(b.x, b.y, 10, c => c.species === 'fox');
      if (foxes) facts.push(['⚠️', `A fox is prowling nearby`]);
      let sick = 0, immune = 0;                                  // (sim.js sicknessTick)
      for (const c of new Set([...home, ...inside])) { if (c.sick) sick++; else if (c.immune > world.tick) immune++; }
      if (sick) facts.push(['🤒', `Sickness in this warren: ${sick} sick${immune ? `, ${immune} immune` : ''}`]);
      else if (immune) facts.push(['🛡️', `${immune} here can't catch the sickness for now`]);
      return {
        emoji: '🕳️', tint: '#b89868', name: 'Burrow',
        sub: b.dug < 1 ? 'Being dug' : made !== undefined ? `Dug ${ago(made)} ago` : 'An old burrow, here before anyone',
        status, facts, sections: [['Home to', home.length ? linkList(home) : 'Nobody calls it home']],
      };
    },
  },

  flower: {
    at(sx, sy) {
      const z = cam.zoom, season = S.seasonOf(world.tick);
      let best = null, bd = Infinity;
      for (const p of world.plants) {
        const [px, py] = toScreen(p.x, p.y), d = (px - sx) ** 2 + (py - sy) ** 2;
        if (d > Math.max(8, z * 0.6) ** 2 || d >= bd) continue;
        const l = plantLook(p, season, z);                   // a field's leaves out of bloom are the field
        if (l && (!p.field || p.field.emoji.includes(l.e))) { best = p; bd = d; }
      }
      return best;
    },
    here: () => true,
    spot: p => ({ x: p.x, y: p.y, r: 0.45 }),
    show(p) {
      const season = S.seasonOf(world.tick), g = world.grass[p.i], e = plantEmoji(season, p, g) || '🌱', f = p.field;
      const open = S.isFlower(world, p), inBloom = f && e === f.emoji[Math.floor(p.kind * f.emoji.length)];
      let status;
      if (world.water[p.i]) status = '🌊 Under the flood';
      else if (open) status = p.sipped && world.tick - p.sipped < S.REFILL ? '🐝 Sipped dry, filling up with nectar again' : '🍯 Open and full of nectar';
      else if (f && season === f.season) status = '🐇 Nibbled down: it blooms once the grass grows back';
      else if (f) status = `🌿 Just leaves: it blooms in ${seasonName(f.season)}`;
      else status = '🌿 Not in flower';
      const sections = f ? [['Part of', `${f.emoji[0]} ${thingLink('field', f.id, esc(f.name))}`]] : [];
      return {
        emoji: e, tint: f ? `rgb(${f.tint})` : '#9cc65a', name: inBloom ? f.name.split(' ')[0] : PLANT_NAMES[e] || 'Plant',
        sub: f ? `In the ${f.name}` : 'Growing wild', status, sections,
        meters: [['Grass', g, g < 0.3 ? 'low' : '']],
      };
    },
  },

  field: {
    at(sx, sy) { const [wx, wy] = toWorld(sx, sy), i = tileOf(wx, wy); return !world.water[i] && world.fieldAt[i] >= 0 ? world.fields[world.fieldAt[i]] : null; },
    here: () => true,
    show(f) {
      const season = S.seasonOf(world.tick), plants = world.plants.filter(p => p.field === f), open = plants.filter(p => S.isFlower(world, p)).length;
      let tiles = 0, grass = 0, voles = 0;
      for (let i = 0; i < world.fieldAt.length; i++) if (world.fieldAt[i] === f.id && !world.water[i]) { tiles++; grass += world.grass[i]; voles += world.voles[i]; }
      const status = season === f.season ? (open ? `${f.emoji[0]} In bloom: ${open} of ${plants.length} flowers open` : '🐇 Grazed down: no flowers open')
        : `🌿 Resting: it blooms in ${seasonName(f.season)}`;
      const inField = c => world.fieldAt[tileOf(c.x, c.y)] === f.id;
      const now = world.creatures.filter(c => c.alive && !c.hidden && inField(c));
      const hives = world.hives.filter(h => !h.cluster && Math.hypot(f.x - h.x, f.y - h.y) < S.FORAGE_RANGE);
      const sections = [['Hives in reach', hives.length
        ? hives.map(h => `🐝 ${thingLink('hive', h.id, h.queen ? esc(`Queen ${h.queen.name}'s hive`) : 'Empty hive')}`).join('<br>')
        : 'None: only a bee from far off comes here']];
      if (now.length) sections.push(['Here now', linkList(now)]);
      const thick = tiles ? voles / tiles / S.VOLE_K : 0;         // (sim.js volesTick)
      const facts = thick > 0.15 ? [['🐁', thick > 0.5 ? 'Voles run all through the long grass here, and the foxes come mousing' : 'A few voles run in the long grass here']] : [];
      return {
        emoji: f.emoji[0], tint: `rgb(${f.tint})`, name: f.name, sub: `A field of ${f.kind.names.join(' and ').toLowerCase()} · ${tiles} tiles`,
        status, sections, facts, meters: [['Grass', tiles ? grass / tiles : 0, '']],
      };
    },
  },

  water: {
    at(sx, sy) {
      const [wx, wy] = toWorld(sx, sy);
      if (wx < 0 || wy < 0 || wx >= S.W || wy >= S.H || !world.water[tileOf(wx, wy)]) return null;
      const brook = world.rivers.find(rv => rv.brook && rv.pts.some(p => (p.x - wx) ** 2 + (p.y - wy) ** 2 < 6));
      const body = brook ? { kind: 'brook', name: brook.name, size: 0 } : S.waterAt(world, wx, wy);
      return body && { body, x: wx, y: wy };
    },
    here: () => true,
    show({ body, x, y }) {
      const i = tileOf(x, y), T = world.terrain, deep = world.water[i] === S.DEEP;
      const facts = world.frozen ? [['🧊', 'Frozen over: anyone can walk across, till it thaws']]
        : [[deep ? '🌊' : '🦶', deep ? 'Too deep to wade: animals go round' : 'Shallow: animals wade across, slowly']];
      if (world.ground[i] > T.level) facts.push(['🌧️', 'Flood water: this is dry land most of the year']);
      facts.push(waterLine());
      if (world.fords.some(f => Math.hypot(f.x - x, f.y - y) < 4)) facts.push(['🪨', 'A ford: stepping stones cross here']);
      facts.push(...pondFacts(i));
      const who = whoNear(x, y, 4, c => world.water[tileOf(c.x, c.y)] && !c.sp.flies);
      if (who) facts.push(world.frozen ? ['⛸️', `On the ice: ${who}`] : ['🏊', `In the water: ${who}`]);
      const kind = body.kind[0].toUpperCase() + body.kind.slice(1);
      return {
        emoji: WATER_LOOKS[body.kind] || '💧', tint: '#6aa6d8', name: body.name,
        sub: body.size ? `${kind} · ${body.size} tiles` : kind, facts,
        status: world.frozen ? '🧊 Frozen over' : deep ? '🌊 Deep water' : '💧 Shallow water',
      };
    },
  },
};

// What lives in the water at tile i and round its shore (sim.js frogsTick): spawn or tadpoles, and frogs.
function pondFacts(i) {
  const b = world.body[i], out = [], y = world.frogYear;
  let spawn = 0, frogs = 0, fish = 0;
  for (let j = 0; j < world.body.length; j++) {
    if (world.water[j]) { if (world.body[j] === b) { spawn += world.spawn[j]; fish += world.fish[j]; } }
    else if (world.nearBody[j] === b) frogs += world.frogs[j];
  }
  if (spawn > 0.5) {
    out.push(['🫧', y.grown < 0.35 ? 'Clumps of frogspawn in the shallows' : y.grown < 1 ? `Tadpoles in the shallows, ${y.grown < 0.75 ? 'growing legs' : 'nearly froglets'}` : 'The last tadpoles, turning into froglets']);
    if (world.spawn[i] > 0 && world.ground[i] > world.terrain.level) out.push(['⏳', 'A flood pool: the tadpoles have to be grown before the water falls back in summer']);
  }
  if (frogs >= 1) out.push(['🐸', world.frogsOut ? `About ${Math.round(frogs)} frogs in the wet grass round it` : `About ${Math.round(frogs)} frogs asleep in the mud round it till spring`]);
  if (fish >= 1) out.push(['🐟', `About ${Math.round(fish)} fish in it`]);
  return out;
}

// What a click lands on, if not an animal: { kind, it } or null for bare ground.
function thingAt(sx, sy) {
  for (const kind in THINGS) {
    const it = THINGS[kind].at(sx, sy);
    if (it) return { kind, it };
  }
  return null;
}

function pick(kind, it, at) {
  Object.assign(ui, { selectedId: 0, follow: false, trail: [], sheetUp: false, naming: 0, picked: { kind, it, at, name: '' } });
  renderInspector();
}

function renderThing(box, strip) {
  const p = ui.picked, v = THINGS[p.kind].show(p.it);
  p.name = v.name;
  if (strip) {
    const m = v.meters?.[0];
    setHTML(box, stripHTML(v.tint || '#d9c9a8', v.emoji, esc(v.name), v.status, m && [m[1], m[2]]));
    return;
  }
  setHTML(box, `
    <button class="sheet-handle phone-only" data-act="sheet-down" aria-label="Show less"></button>
    <div class="ins-head">
      <div class="portrait" style="background:${v.tint || '#d9c9a8'}33">${v.emoji}</div>
      <div>
        <div class="ins-name">${!v.queen ? esc(v.name) : ui.naming === v.queen.key ? `Queen ${nameInput(v.queen.name)}`
          : nameButton(esc(v.name) + (v.queen.mine ? RING_HTML : ''), v.queen.mine ? 'Rename the queen' : "Name the queen: her hive is yours, and you'll hear how it goes")}</div>
        <div class="ins-sub">${esc(v.sub)}</div>
      </div>
      <button class="close" data-act="close" title="Close (Esc)">✕</button>
    </div>
    <div class="mood">${v.status}</div>
    ${v.meters ? `<div class="meters">${v.meters.map(([label, k, cls]) =>
      `<div class="meter-row">${label} <div class="meter ${cls}"><span style="width:${Math.round(clamp(k, 0, 1) * 100)}%"></span></div></div>`).join('')}</div>` : ''}
    ${v.chips?.length ? `<div class="chips">${v.chips.map(x => `<span class="chip">${x}</span>`).join('')}</div>` : ''}
    ${v.facts?.length ? `<ul class="story facts">${v.facts.map(([e, t]) => `<li><span>${e}</span><span>${t}</span></li>`).join('')}</ul>` : ''}
    ${(v.sections || []).map(([title, html]) => `<h4>${title}</h4><div class="family">${html}</div>`).join('')}`);
}

// A ring round the picked thing, under it; its name over everything.
function drawPickedUnder(now) {
  const p = ui.picked, T = THINGS[p.kind];
  if (!T.spot || !T.here(p.it)) return;
  const s = T.spot(p.it), [sx, sy] = toScreen(s.x, s.y), r = Math.max(10, s.r * cam.zoom) * (1 + 0.06 * Math.sin(now / 250));
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, TAU); ctx.stroke();
}

function drawPickedOver() {
  const p = ui.picked, T = THINGS[p.kind];
  if (!p.name || !T.here(p.it)) return;
  const at = p.at || [p.it.x, p.it.y], s = T.spot ? T.spot(p.it) : { x: at[0], y: at[1], r: 0 }, [sx, sy] = toScreen(s.x, s.y);
  drawLabel(p.name, sx, sy + Math.max(4, s.r * cam.zoom * 0.4) + 6);
}

// ------------------------------------------------------------------ selection and input

function select(id, zoomIn = true) {
  ui.selectedId = id;
  ui.picked = null;
  ui.trail = [];
  ui.follow = !!id;
  ui.sheetUp = false;
  ui.naming = 0;
  flick.vx = flick.vy = 0;
  const close = narrow() ? 16 : 22;           // a phone keeps a little more of the meadow around it
  if (id && zoomIn && cam.zoom < close - 2) cam.goal = close;
  renderInspector();
}

// ------------------------------------------------------------------ naming
//
// A tap on the name at the top of the inspector (nameButton) turns it into a field: Enter or a tap away keeps it,
// Esc lets it be. A named animal is yours (sim.js nameCreature): its news comes first and on the away card, its death
// gets a line of its own (goneLine), it wears a ring (RING), and it's in the Yours card, gone or not. A bee is named
// at its hive: the queen.
const nameInput = name => `<input id="name-input" class="name-input" maxlength="${S.NAME_MAX}" value="${esc(name)}" aria-label="Its name" enterkeyhint="done" autocomplete="off" spellcheck="false">`;
function startNaming() {
  const key = ui.picked ? ui.picked.kind === 'hive' && ui.picked.it.queen && 'hive:' + ui.picked.it.id : ui.selectedId;
  if (!key) return;
  ui.naming = key; ui.sheetUp = true;
  renderInspector();
  const el = $('#name-input');
  if (el) { el.focus(); el.select(); }
}
function endNaming(keep) {
  const el = $('#name-input'), key = ui.naming;
  if (!key) return;
  ui.naming = 0;
  if (keep && el) {
    if (typeof key === 'number') {
      const c = world.byId.get(key), was = c?.mine;
      if (c && c.alive && S.nameCreature(world, c, el.value)) named(link(c), was, c.sex === 'F' ? 'her' : 'him');
    } else {
      const h = world.hives.find(o => 'hive:' + o.id === key), was = h?.queen?.mine;
      if (h && S.nameQueen(world, h, el.value)) named(`Queen ${esc(h.queen.name)}`, was, 'her hive');
    }
  }
  renderInspector();
  if (yoursOpen()) renderYours();
}
function named(who, was, them) {
  chime('named');
  tried('name');
  addNews(was ? `🏷️ Renamed ${who}.` : `🏷️ <b>${who}</b> is yours now. You'll hear how it goes for ${them}.`);
}
document.addEventListener('keydown', e => {
  if (e.target.id !== 'name-input') return;
  if (e.key === 'Enter') { e.preventDefault(); endNaming(true); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endNaming(false); }
}, true);
document.addEventListener('focusout', e => { if (e.target.id === 'name-input') endNaming(true); });

// The Yours card (••• Yours): everyone you named, the living first, each a tap away. While open, it updates
// once a second.
const yours = { at: 0 };
const yoursOpen = () => !$('#yours').classList.contains('hidden');
function toggleYours(open = !yoursOpen()) {
  $('#yours').classList.toggle('hidden', !open);
  if (open) { renderYours(); yours.at = performance.now(); }
}
const GONE_SAY = { fox: 'taken by a fox', owl: 'taken by an owl', left: 'flew off to a wood of its own', hunger: 'starved', lightning: 'struck by lightning',
  fire: 'caught in a fire', flood: 'drowned in the burrow', ice: 'went through the ice', sickness: 'died of the sickness', age: 'died of old age' };
function renderYours() {
  const mine = [...world.byId.values()].filter(c => c.mine);
  const living = mine.filter(c => c.alive).sort((a, b) => a.born - b.born), gone = mine.filter(c => !c.alive).sort((a, b) => b.died - a.died);
  const rows = [];
  for (const h of world.hives) if (h.queen?.mine) rows.push(`<li><span>👑</span><span>${thingLink('hive', h.id, `Queen ${esc(h.queen.name)}`)} · ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'}, ${Math.round(h.honey)} honey</span></li>`);
  for (const c of living) {
    const m = S.mood(world, c);
    rows.push(`<li><span>${c.sp.emoji}</span><span>${link(c)} · ${esc(m.text.toLowerCase())}<div class="when">${lifeStage(c)}, ${days(S.ageDays(world, c))} old</div></span></li>`);
  }
  for (const d of world.decor) if (d.planted) rows.push(`<li><span>🌳</span><span>${thingLink('tree', d.id, esc(treeTitle(d)))}<div class="when">planted in the ${plantedWhen(d)}</div></span></li>`);
  for (const c of gone) rows.push(`<li class="gone"><span>🪦</span><span>${link(c)} · ${GONE_SAY[c.cause] || 'gone'}<div class="when">${when(c.died)}, ${days(S.ageDays(world, c))} old</div></span></li>`);
  setHTML($('#yours-list'), rows.join('') || `<li class="none">Nobody yet. Click an animal and tap its name to give it one of your own: you'll hear how its life goes. A bee is named at its hive, by its queen. The trees you plant are here too.</li>`);
}

// The sheet on a phone: tap the folded line for more and the handle for less (the click handler), or
// swipe the line, the handle or the name, up for more and down for less. Swiping the line down puts it away.
let swipe = null, pressing = false;          // while a finger is down on it, it isn't rebuilt under the tap
addEventListener('pointercancel', () => { pressing = false; swipe = null; });
$('#inspector').addEventListener('pointerdown', e => {
  pressing = true;
  if (sheet && sheet.bottom && e.target.closest('.sheet-handle, .ins-head, .strip-row') && !e.target.closest('button:not(.sheet-handle), input')) swipe = { y: e.clientY };
});
addEventListener('pointerup', e => {         // on the window: a swipe up soon leaves the folded line
  pressing = false;
  if (!swipe) return;
  const dy = e.clientY - swipe.y;
  swipe = null;
  if (dy < -24) ui.sheetUp = true;
  else if (dy > 24) { if (ui.sheetUp) ui.sheetUp = false; else { select(0); return; } }
  else return;
  $('#inspector').scrollTop = 0;
  renderInspector();
});

function creatureAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const reach = Math.max(1.4, (fingerTap ? 28 : 20) / cam.zoom);   // a fingertip is bigger than a pointer
  let best = null, bd = reach * reach;
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const d = (c.x - wx) ** 2 + (c.y - (wy + 0.2)) ** 2;
    if (d < bd) { best = c; bd = d; }
  }
  return best;
}

// Tap an animal tool already in your hand and it releases more at a time: ×1, ×2, ×5, ×10.
const GROUPS = [1, 2, 5, 10];
function setTool(tool) {
  if (tool === ui.tool && S.KINDS.includes(tool)) {
    ui.group[tool] = GROUPS[(GROUPS.indexOf(ui.group[tool]) + 1) % GROUPS.length];
    try { localStorage.setItem('aeon-garden-group', JSON.stringify(ui.group)); } catch (e) { /* fine */ }
    showGroup();
    return;                               // the tools stay open, so a phone can tap again
  }
  ui.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  canvas.className = 'tool-' + tool;
  const hand = $('#toolbar .hand');
  hand.textContent = $(`[data-tool="${tool}"] .e`).textContent;
  hand.classList.toggle('on', tool !== 'look');
  showGroup();
  toggleTools(false);
  updateBar();
}

// The group size shows as a badge on each animal tool, and on the folded tools button while one is in hand.
function showGroup() {
  for (const k of S.KINDS) {
    const b = $(`[data-tool="${k}"]`), n = ui.group[k];
    if (!b) continue;                                       // (otters come up the water: no tool)
    if (n > 1) b.dataset.n = '×' + n; else delete b.dataset.n;
    b.title = `Click the meadow to release ${n > 1 ? n + ' ' + S.SPECIES[k].plural.toLowerCase() : 'a ' + S.SPECIES[k].name.toLowerCase()}`
      + `${k === 'bee' ? '. They move into the nearest hive' : ''}. Tap again for more at a time`;
  }
  const hand = $('#toolbar .hand'), n = ui.group[ui.tool];
  if (n > 1) hand.dataset.n = '×' + n; else delete hand.dataset.n;
}

// On a phone the tools fold into one button in the corner; tap it and they rise above it.
function toggleTools(open = !$('#toolbar').classList.contains('open')) {
  $('#toolbar').classList.toggle('open', open);
  $('#toolbar .hand').setAttribute('aria-expanded', open);
}
addEventListener('pointerdown', e => { if (!e.target.closest('#toolbar')) toggleTools(false); });

// The toolbar slides away while you just watch and comes back as soon as the mouse enters the spot
// where it lives, so you stop on the buttons instead of running into the screen edge and back.
// It stays up while a tool other than Look is in your hand.
// Touch screens have no hover, so there the CSS keeps it up for good.
let barNear = true, barTimer = 0;
function updateBar() {
  clearTimeout(barTimer);
  if (barNear || ui.tool !== 'look') document.body.classList.remove('bar-away');
  else barTimer = setTimeout(() => document.body.classList.add('bar-away'), 200);
}
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const bar = $('#toolbar').getBoundingClientRect(), up = !document.body.classList.contains('bar-away');
  const pad = up ? 12 : 0;                     // once it's up, a little slack so it doesn't flicker at the rim
  const over = e.clientX > bar.left - pad && e.clientX < bar.right + pad;
  const near = (over && e.clientY > vh - barPad - pad) || !!e.target.closest('#toolbar');
  if (near !== barNear) { barNear = near; updateBar(); }
});
document.documentElement.addEventListener('mouseleave', () => { barNear = false; updateBar(); });

function toggleMini(on = !ui.mini) {
  ui.mini = on;
  $('#meadow').classList.toggle('mini', on);
  resize();                              // the sparklines need their real size again
  try { localStorage.setItem('aeon-garden-mini', on ? '1' : '0'); } catch (e) { /* fine */ }
}

// A phone has no room for four speed buttons: one steps through them instead, and pause toggles.
const SPEEDS = [1, 4, 15, 60];
let lastSpeed = 1;
function setSpeed(s) {
  ui.speed = s;
  if (s) lastSpeed = s;
  Sound.update({ speed: s });            // right away, so the first frame at 60x is already quiet
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
  const step = $('[data-act="cycle"]');
  step.textContent = lastSpeed + '×';
  step.classList.toggle('on', s > 0);
}

// Two fingers pinch: the spot of meadow between them stays under them as they spread and move.
let drag = null, pinch = null, scrollRest = { x: 0, y: 0 };
let fingerTap = false;                    // the last press was a finger: taps may wobble a little and hit a little wider
// Let go of a pan while still moving and the meadow glides on a little (screen pixels a second).
const flick = { vx: 0, vy: 0 };
const fingers = new Map();

function startPinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const [wx, wy] = toWorld(mx, my);
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: cam.zoom, wx, wy };
  drag = null; cam.goal = null; ui.follow = false;
}

function movePinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  cam.zoom = clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, fitZoom, 64);
  cam.x = pinch.wx - (mx - vw / 2) / cam.zoom; cam.y = pinch.wy - (my - vh / 2) / cam.zoom;
  clampCam();
}

function liftFinger(e) {
  fingers.delete(e.pointerId);
  if (!pinch) return false;
  if (fingers.size >= 2) startPinch();
  else {                                  // one finger left: carry on as a plain drag, never a tap
    pinch = null;
    const [f] = fingers.values();
    if (f) drag = { x: f.x, y: f.y, cx: cam.x, cy: cam.y, moved: true, paint: false, t: e.timeStamp, lx: f.x, ly: f.y, vx: 0, vy: 0 };
  }
  return true;
}

// A finger held still on the meadow opens the ring there, as a right-click does (iPhones never send one).
const HOLD_MS = 450;
let holdTimer = 0;

canvas.addEventListener('pointerdown', e => {
  if (intro.on) { endIntro(true); return; }
  if (ui.ring) { closeRing(); return; }
  if ($('#toolbar').classList.contains('open')) { toggleTools(false); return; }   // that tap only folds the tools away
  if (e.button === 2 || (e.ctrlKey && e.pointerType === 'mouse')) return;   // that's the ring menu
  if (held) return;                       // another finger, while one holds an animal up
  canvas.setPointerCapture(e.pointerId);
  fingerTap = e.pointerType === 'touch';
  flick.vx = flick.vy = 0;
  clearTimeout(holdTimer);
  if (fingerTap) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size >= 2) { startPinch(); return; }
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, paint: (ui.tool === 'grass' || ui.tool === 'fire') && e.button === 0,
    t: e.timeStamp, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0, id: e.pointerId,
    grab: ui.tool === 'look' && e.button === 0 && !LAB ? grabAt(e.clientX, e.clientY) : null };   // dragged, it's picked up
  if (drag.paint) paintAt(e.clientX, e.clientY);
  else if (fingerTap && !LAB) {
    const d = drag;
    holdTimer = setTimeout(() => {
      if (drag !== d || d.moved || fingers.size !== 1) return;
      drag = null;                        // lifting the finger now is no tap
      if (d.grab && d.grab.alive && !d.grab.hidden) pickUp(d.grab, d.x, d.y, d.id);   // held on an animal: up it comes
      else openRing(d.x, d.y);
    }, HOLD_MS);
  }
});
canvas.addEventListener('pointermove', e => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); return; }
  if (intro.on) return;
  if (held) { if (e.pointerId === held.id) { held.sx = e.clientX; held.sy = e.clientY; } return; }
  if (!drag) {
    const c = creatureAt(e.clientX, e.clientY);
    ui.hoverId = c ? c.id : 0;
    ui.hoverHive = c ? null : hiveAt(e.clientX, e.clientY);
    return;
  }
  let dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) > (e.pointerType === 'touch' ? 10 : 4)) {
    if (drag.grab && drag.grab.alive && !drag.grab.hidden) { pickUp(drag.grab, e.clientX, e.clientY, e.pointerId); drag = null; return; }
    drag.moved = true;
    if (!drag.paint) { drag.x = e.clientX; drag.y = e.clientY; dx = dy = 0; }   // start from here, no jump
  }
  if (drag.paint) { paintAt(e.clientX, e.clientY); return; }
  const ms = e.timeStamp - drag.t;
  if (ms > 0) {                           // how fast the finger moves, smoothed over the last few moves
    const a = Math.min(1, ms / 40);
    drag.vx += ((e.clientX - drag.lx) * 1000 / ms - drag.vx) * a;
    drag.vy += ((e.clientY - drag.ly) * 1000 / ms - drag.vy) * a;
    drag.t = e.timeStamp; drag.lx = e.clientX; drag.ly = e.clientY;
  }
  if (drag.moved) {
    canvas.classList.add('dragging');
    ui.follow = false;
    cam.x = drag.cx - wholePx(dx) / cam.zoom; cam.y = drag.cy - wholePx(dy) / cam.zoom;
    clampCam();
  }
});
canvas.addEventListener('pointerup', e => {
  if (held && e.pointerId === held.id) { fingers.delete(e.pointerId); letGo(); return; }
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) click(e.clientX, e.clientY);
  else if (drag && !drag.paint && e.pointerType === 'touch' && e.timeStamp - drag.t < 60 && Math.hypot(drag.vx, drag.vy) > 250) {
    flick.vx = drag.vx; flick.vy = drag.vy;
  }
  drag = null;
});
canvas.addEventListener('pointercancel', e => {
  if (held && e.pointerId === held.id) { fingers.delete(e.pointerId); letGo(); return; }
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  drag = null;
});
// Safari ignores the viewport's no-zoom, and a zoomed page makes the whole meadow blurry.
document.addEventListener('gesturestart', e => e.preventDefault());
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ui.hoverId = 0; ui.hoverHive = null; } });   // a lifted finger leaves too
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!LAB && !ui.ring) openRing(e.clientX, e.clientY); });   // Android's long-press sends one too
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (intro.on) { endIntro(true); return; }
  closeRing();
  const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? innerHeight : 1;   // Firefox's wheel counts lines (3 a notch, Chrome's 100 px)
  const ddx = e.deltaX * unit, ddy = e.deltaY * unit;
  const pixelPan = !e.ctrlKey && e.deltaMode === 0 && (ddx !== 0 || Math.abs(ddy) < 40);
  if (pixelPan) {                     // trackpad two-finger scroll: look around
    const dx = wholePx(scrollRest.x + ddx), dy = wholePx(scrollRest.y + ddy);
    scrollRest = { x: scrollRest.x + ddx - dx, y: scrollRest.y + ddy - dy };   // the rest comes next time
    cam.x += dx / cam.zoom; cam.y += dy / cam.zoom;
    ui.follow = false; clampCam();
  } else {                            // mouse wheel or pinch: zoom
    cam.goal = null;
    zoomAt(e.clientX, e.clientY, cam.zoom * Math.exp(-ddy * (e.ctrlKey ? 0.012 : 0.0018)));
  }
}, { passive: false });

// ------------------------------------------------------------------ picking an animal up
//
// With Look in hand, press on an animal and drag (or hold a finger on it) and it's picked up by the scruff:
// it dangles under the hand, swings as the hand moves, kicks now and then, and drops where you let go (sim.js
// lift, putDown). Its place in the sim is the ground under it, so the camera, its trail and its kits go along.
const HELD_UP = 1.6;                 // its spot on the ground is this far below the hand, in its size
const HANG = 0.42;                   // and the middle of it this far, from the scruff
const FOX_HANG = 0.2;                // (a fox's, painted hanging: FOX_POSES.hang)
const hangOf = c => c.species === 'fox' ? FOX_HANG : HANG;
const SWING = (TAU / 0.8) ** 2;      // a swing every 0.8 s or so
const SWING_DAMP = 2.4;              // how fast a swing dies down
const SWING_MAX = 1.1;               // radians: it never swings up over the hand
const LIFT_MS = 150, FALL_MS = 280;  // up into the hand, and down again (a flier glides down, twice as slow)
const BOUNCE = 0.35;                 // a landing hop, as a share of the fall's time
let held = null;                     // { c, id (the pointer), sx, sy (the hand), lx, ly, vx, vy, a (its swing), va, t0, from, follow }
const falls = new Map();             // just let go: { t0, dx, h (tiles off its landing spot), a (its swing) }

// The animal under a press: on its body as drawn, not the wider reach of a click, so a pan from near one stays a pan.
function grabAt(sx, sy) {
  let best = null, bd = Infinity;
  const now = performance.now();
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const [x, y] = screenOf(c), px = creaturePx(c), r = Math.max(fingerTap ? 16 : 10, px * 0.5);
    const d = (x - sx) ** 2 + (y - liftOf(c, px, now) - sy) ** 2;
    if (d < r * r && d < bd) { best = c; bd = d; }
  }
  return best;
}

function pickUp(c, sx, sy, id) {
  const now = performance.now(), px = creaturePx(c), [x, y] = screenOf(c);
  held = { c, id, sx, sy, lx: sx, ly: sy, vx: 0, vy: 0, a: 0, va: 0, t0: now, from: [x, y - liftOf(c, px, now)],
    follow: ui.follow && ui.selectedId === c.id };
  ui.follow = false;                         // the camera stays put while you carry it about
  ui.hoverId = 0; ui.hoverHive = null;
  falls.delete(c);
  S.lift(world, c);
  canvas.classList.add('dragging');
  clearTimeout(holdTimer);
  hear('release', c.x, c.y, { species: c.species });
  tried('carry');
}

function letGo() {
  const h = held, c = h.c;
  held = null;
  canvas.classList.remove('dragging');
  if (!c.alive) return;
  const [x, y] = heldAt(h, performance.now()), wx = c.x, wy = c.y;
  const at = S.putDown(world, c, wx, wy), [lx, ly] = toScreen(at.x, at.y);
  falls.set(c, { t0: performance.now(), dx: (x - lx) / cam.zoom, h: (ly - y) / cam.zoom, a: h.a });
  if (h.follow && ui.selectedId === c.id) ui.follow = true;
  renderInspector();
}

// Where the middle of a held animal is on screen, and the scruff it hangs from.
function heldAt(h, now) {
  const px = creaturePx(h.c), u = clamp((now - h.t0) / LIFT_MS, 0, 1), e = 1 - (1 - u) ** 3;
  const hang = px * hangOf(h.c), hx = lerp(h.from[0], h.sx, e), hy = lerp(h.from[1] - hang, h.sy, e);
  return [hx - Math.sin(h.a) * hang, hy + Math.cos(h.a) * hang, hx, hy];
}

// Each frame: the hand's speed, and the swing it gives. It hangs like a pendulum from the hand, pushed the other way
// as the hand speeds up, and its spot in the sim is the ground below it.
function heldFrame(dt) {
  const h = held, c = h.c;
  if (!c.alive) { held = null; canvas.classList.remove('dragging'); return; }
  if (dt > 0) {
    const k = Math.min(1, dt * 25), vx = h.vx, vy = h.vy;
    h.vx += ((h.sx - h.lx) / dt - h.vx) * k; h.vy += ((h.sy - h.ly) / dt - h.vy) * k;
    h.lx = h.sx; h.ly = h.sy;
    const ax = (h.vx - vx) / dt, L = Math.max(24, creaturePx(c) * hangOf(c));
    h.ay = (h.vy - vy) / dt;
    for (let n = Math.ceil(dt * 240), i = 0; i < n; i++) {
      const s = dt / n;
      h.va += (-SWING * Math.sin(h.a) + ax / L * 0.35 * Math.cos(h.a) - SWING_DAMP * h.va) * s;
      h.a = clamp(h.a + h.va * s, -SWING_MAX, SWING_MAX);
    }
  }
  const [wx, wy] = toWorld(h.sx, h.sy + creaturePx(c) * HELD_UP);
  c.x = clamp(wx, 0.5, S.W - 0.5); c.y = clamp(wy, 0.5, S.H - 0.5);
  if (Math.abs(h.vx) > 30) c.facing = h.vx > 0 ? 1 : -1;     // it looks the way it's carried
}

// Kicking its legs, a few times a second in fits; a bee buzzes, a bird flaps.
function kickOf(c, now) {
  if (c.species === 'bee') return Math.sin(now / 18) * 0.06;
  const fit = Math.max(0, Math.sin(now / 520 + c.id * 1.3)) ** 3;
  return Math.sin(now / 55 + c.id) * 0.12 * fit;
}

function drawHeld(now) {
  const h = held, c = h.c, px = creaturePx(c), [, , hx, hy] = heldAt(h, now);
  const stretch = 1.06 + clamp(-(h.ay || 0) * 0.00002, -0.1, 0.14);   // hanging, it stretches; jerked up, more
  const art = c.species === 'crow' ? CROW_ARTS[2 + (((now / CROW_BEAT) | 0) & 1)] : c.species === 'fox' ? foxArtOf(c.genes.fur, 'hang') : c.sp.emoji;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(h.a + kickOf(c, now));
  drawEmoji(art, 0, px * hangOf(c), px, { coat: coatLook(c), flip: flipOf(c), squash: stretch });
  ctx.restore();
}

// Let go, it drops to its spot and hops once as it lands, coming upright on the way. A flier glides down.
function drawFalling(c, f, sx, sy, now) {
  const ms = c.sp.flies ? FALL_MS * 2 : FALL_MS, u = (now - f.t0) / ms, z = cam.zoom;
  if (u >= 1 + (c.sp.flies ? 0 : BOUNCE)) { falls.delete(c); drawCreature(c, sx, sy, now); return; }
  const k = u < 1 ? (c.sp.flies ? 1 - (1 - u) ** 2 : u * u) : 1;
  const hop = u < 1 ? f.h * z * (1 - k) : Math.sin(Math.PI * (u - 1) / BOUNCE) * Math.min(f.h * z * 0.15, creaturePx(c) * 0.25);
  ctx.save();
  ctx.translate(sx + f.dx * z * (1 - k), sy - hop);
  ctx.rotate(f.a * (1 - k));
  drawCreature(c, 0, 0, now);
  ctx.restore();
  if (u >= 1 && !f.landed) { f.landed = true; chime('click'); }
}

function click(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  if (ui.tool === 'look') {
    const c = creatureAt(sx, sy), t = !c && thingAt(sx, sy);
    if (t) pick(t.kind, t.it, [wx, wy]); else select(c ? c.id : 0);
    ui.hoverHive = null;
  } else if (S.KINDS.includes(ui.tool)) release(ui.tool, wx, wy);
  else if (ui.tool === 'zap') zapAt(wx, wy);
  else if (ui.tool === 'plant') openRing(sx, sy, 'plant');
}

// ------------------------------------------------------------------ planting a tree
//
// The Plant tool (or 🌳 in the ring) opens a ring of kinds where you clicked: the kind is the plan. It comes up
// as a seedling (sim.js plantTree) and lives by the wild ones' rules; the news tells how it does (plantlost,
// plantgrew, plantseeds), and the inspector remembers you planted it.
const PLANT_KINDS = [['oak', '🌰', S.OWLS ? 'Oak: an owl’s hollow one day' : 'Oak: a hive’s hollow one day'], ['birch', '🌿', 'Birch: quick to grow'], ['hawthorn', '🌹', 'Hawthorn: guards its neighbours'],
  ['apple', '🍎', 'Apple: windfalls in autumn'], ['cherry', '🍒', 'Cherry: blossom for the bees'], ['beech', '🍂', 'Beech: bears the shade'],
  ['maple', '🍁', 'Maple: red in autumn'], ['pine', '🌲', 'Pine: green all winter']];
const PLANT_SAY = {
  oak: 'Oaks are slow: in twenty years or so it could hold ' + (S.OWLS ? 'an owl, or a hive.' : 'a hive in its hollow.'),
  birch: 'Birches grow fast and don’t live long.',
  hawthorn: 'Once it’s grown, its thorns keep the rabbits off the seedlings round it.',
  apple: 'In a few years it drops apples in autumn, and the rabbits come for them.',
  cherry: 'Its blossom feeds the bees in early spring.',
  beech: 'Beeches can wait in the shade of other trees for their turn.',
  maple: 'Maples turn red in autumn.',
  pine: 'Pines keep their needles all winter.',
};
const NO_PLANT = { water: '💧 Trees don’t grow in the water.', field: '🌼 That’s a flower field: the bees need it open.',
  burrow: '🕳️ Too close to a burrow or a hive for a tree.', crowded: '🌳 Too close to another tree or a rock.' };
const an = w => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;
const plantedWhen = d => { const day = Math.floor(d.planted / S.TPD); return `${seasonName(S.seasonOf(d.planted))} of year ${Math.floor(day / S.YEAR_DAYS) + 1}`; };
function plantAt(kind, wx, wy) {
  const d = S.plantTree(world, wx, wy, kind);
  if (typeof d === 'string') { addNews(NO_PLANT[d], 'noplant', 3000); return; }
  hear('grass', wx, wy);
  addEffect('🌱', wx, wy, 0.8, 1400);
  tried('plant');
  addNews(`🌱 You planted ${thingLink('tree', d.id, an(TREE_NAMES[kind].toLowerCase()))}. ${PLANT_SAY[kind]}`);
}
// What the news calls one: a link while it stands.
const plantedLink = d => { const k = treeName(d).toLowerCase(); return world.decor.includes(d) ? thingLink('tree', d.id, k) : k; };

// Paused, a bolt waits over its spot (drawZaps), like a released rabbit waits to move. When time runs
// again they strike one after another, ZAP_GAP apart, a storm of your own.
const ZAP_GAP = 70;
function zapAt(wx, wy) {
  if (ui.speed > 0) { zapping = true; S.zap(world, wx, wy); flushEvents(); zapping = false; return; }
  if (!S.walkable(world, wx, wy) || ui.zaps.length >= 60) return;
  ui.zaps.push({ x: wx, y: wy, t0: performance.now() });
  chime('click');
}

let zapping = false;
function strikeZaps(now) {
  if (!ui.zaps.length || now < ui.zapNext) return;
  const z = ui.zaps.shift();
  zapping = true; S.zap(world, z.x, z.y); flushEvents(); zapping = false;
  ui.zapNext = now + ZAP_GAP * (0.7 + 0.6 * Math.random());
}

// A waiting bolt hangs over its spot and sways a little.
function drawZaps(now) {
  const px = Math.max(16, cam.zoom * 1.5);
  for (const z of ui.zaps) {
    const [sx, sy] = toScreen(z.x, z.y);
    if (!visible(sx, sy, px)) continue;
    const t = (now - z.t0) / 1000, grow = Math.min(1, t * 5);
    drawEmoji('⚡', sx, sy - px * (0.9 + 0.12 * Math.sin(t * 3 + z.x)), px * grow, { alpha: 0.9 });
  }
}

// A group lands in a loose scatter around the spot, on dry ground, the sexes taking turns so two make a pair.
function release(species, wx, wy) {
  const n = ui.group[species], spread = n > 1 ? 0.8 + Math.sqrt(n) * 0.7 : 0, out = [];
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const a = world.rng.range(0, TAU), r = i && spread * Math.sqrt(world.rng.range(0, 1));
      const x = wx + Math.cos(a) * r, y = wy + Math.sin(a) * r;
      const sex = ui.releaseSex[species];
      const c = S.addCreature(world, species, x, y, { sex, age: world.rng.range(5, 9) });
      if (!c) continue;
      ui.releaseSex[species] = sex === 'F' ? 'M' : 'F';
      addEffect('✨', x, y);
      out.push(c);
      break;
    }
  }
  if (!out.length) return;
  const c = out[0];
  hear('release', wx, wy, { species });
  if (species === 'fox' && tried('fox') && guide.on) select(c.id);   // the first one: go along and see
  addNews(out.length === 1
    ? `👋 You released ${link(c)}, a ${species === 'bee' ? 'worker' : c.sex === 'F' ? 'female' : 'male'} ${c.sp.name.toLowerCase()}.`
    : `👋 You released ${out.length} ${c.sp.plural.toLowerCase()}: ${linkList(out)}.`);
}

// ------------------------------------------------------------------ the ring: right-click the meadow

const RING_TOOLS = [['rabbit', '🐇', 'Release a rabbit'], ['fox', '🦊', 'Release a fox'], ['bee', '🐝', 'Release a bee'], ['crow', '🐦‍⬛', 'Release a crow'], ['owl', '🦉', 'Release an owl'], ['grass', '🌱', 'Grow grass'],
  ['plant', '🌳', 'Plant a tree'], ['zap', '⚡', 'Strike lightning'], ['fire', '🔥', 'Wall of fire'], ['sky', '🌦️', 'Weather']].filter(([k]) => k !== 'owl' || S.OWLS);
// Owls off for now (sim.js OWLS): their tool, counters and graph button stay in the page, hidden.
if (!S.OWLS) for (const e of document.querySelectorAll('[data-tool="owl"], [data-show="owl"], #mini-owl, #n-owl')) (e.closest('.mini-pop, .pop') || e).classList.add('hidden');

// which: '' the tools, 'sky' the weather, 'plant' the kinds of tree.
function openRing(sx, sy, which = '') {
  const items = which === 'sky'
    ? [...Object.entries(S.WEATHER).map(([k, wx]) => ['sky:' + k, wx.emoji, wx.name]), ['lock', world.skyLocked ? '🔒' : '🔓', world.skyLocked ? 'Unlock the weather' : 'Keep this weather']]
    : which === 'plant' ? PLANT_KINDS.map(([k, e, label]) => ['plant:' + k, e, label]) : RING_TOOLS;
  if (!ui.ring) { ui.ring = { at: toWorld(sx, sy) }; chime('click'); }
  ui.ring.t0 = performance.now();
  const r = Math.max(which ? 80 : 72, items.length * 56 / TAU);   // room for every 50 px button; near an edge the ring moves in, but still acts where you clicked
  sx = clamp(sx, r + 34, vw - r - 34); sy = clamp(sy, r + 34, vh - r - 34);
  const ring = $('#ring');
  ring.style.left = sx + 'px'; ring.style.top = sy + 'px';
  ring.innerHTML = `<div class="ring-hub">${which === 'plant' ? 'Which tree?' : ''}</div>` + items.map(([k, e, label], i) => {
    const a = -Math.PI / 2 + i / items.length * TAU;
    const on = k === 'sky:' + world.weather.kind || (k === 'lock' && world.skyLocked);
    return `<button class="ring-item${on ? ' on' : ''}" data-ring="${k}" data-label="${label}" aria-label="${label}"
      style="--dx:${(Math.cos(a) * r).toFixed(1)}px;--dy:${(Math.sin(a) * r).toFixed(1)}px;animation-delay:${i * 18}ms">${e}</button>`;
  }).join('');
  ring.classList.remove('hidden');
}

function closeRing() {
  if (!ui.ring) return;
  ui.ring = null;
  $('#ring').classList.add('hidden');
}

function ringPick(k) {
  const [wx, wy] = ui.ring.at;
  if (k === 'sky' || k === 'plant') { const [sx, sy] = toScreen(wx, wy); openRing(sx, sy, k); return; }
  closeRing();
  if (S.KINDS.includes(k)) release(k, wx, wy);
  else if (k === 'zap') zapAt(wx, wy);
  else if (k === 'fire') { setFire(wx, wy); S.burnLine(world, wx - 3, wy, wx + 3, wy); flushEvents(); }   // a short wall across the spot
  else if (k === 'grass') {
    S.paintGrass(world, wx, wy, 5);
    hear('grass', wx, wy);
    for (let i = 0; i < 6; i++) addEffect('🌱', wx + (Math.random() - 0.5) * 7, wy + (Math.random() - 0.5) * 7, 0.6, 900);
    terrainTick = -1;
  } else if (k === 'lock') toggleSkyLock();
  else if (k.startsWith('plant:')) plantAt(k.slice(6), wx, wy);
  else if (k.startsWith('sky:')) { S.setSky(world, k.slice(4)); flushEvents(); showSkyLock(); updateMeadowCard(); }
}

$('#ring').addEventListener('pointerover', e => {
  if (performance.now() - ui.ring.t0 < 300) return;     // the buttons fly out from under the mouse
  const b = e.target.closest('[data-ring]');
  $('.ring-hub').textContent = b ? b.dataset.label : '';
});
$('#ring').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', e => { if (ui.ring && !e.target.closest('#ring,#world')) closeRing(); });

function toggleSkyMenu(open = !ui.sky.menu) {
  ui.sky.menu = open;
  $('#sky-menu').classList.toggle('hidden', !open);
  $('[data-act="sky"]').classList.toggle('on', open);
  if (open) toggleMore(false);
  showSkyLock();
}

// The ••• menu: things you do to the whole meadow, kept away from everyday buttons.
function toggleMore(open = $('#more-menu').classList.contains('hidden')) {
  $('#more-menu').classList.toggle('hidden', !open);
  $('[data-act="more"]').classList.toggle('on', open);
  if (open && ui.sky.menu) toggleSkyMenu(false);
}

// ------------------------------------------------------------------ on the home screen
// Added to the home screen, the meadow opens full screen with no browser bars (manifest.webmanifest).
// Chrome and friends have an install dialog we can open; Safari has none, so a card shows the steps.
const installed = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
let installPrompt = null;
function showHomeItem() {
  $('#home-item').classList.toggle('hidden', installed() || !(installPrompt || matchMedia('(pointer: coarse)').matches));
}
// Kept for the ••• menu rather than let Chrome drop its own bar over the toolbar.
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; showHomeItem(); });
addEventListener('appinstalled', () => { installPrompt = null; showHomeItem(); addNews('📱 The meadow is on your home screen now.'); });

const wantsHome = () => !installed() && matchMedia('(pointer: coarse)').matches;
let afterHome = null;                                   // what waits for the card to close

// A tap on the menu item opens Chrome's install dialog straight away. The card showing by itself
// can't: a page may only open that dialog from a tap, so the card gets an Install button.
function homeGuide(open = true, byItself = false) {
  if (open && installPrompt && !byItself) { install(); return; }
  const card = $('#home-guide');
  card.dataset.os = installPrompt ? 'prompt' : iOS ? 'ios' : 'other';
  card.classList.toggle('hidden', !open);
  if (!open && afterHome) { const then = afterHome; afterHome = null; then(); }
}
function install() {
  installPrompt?.prompt();                              // each one opens once
  installPrompt = null;
  showHomeItem();
  homeGuide(false);
}
const homeOpen = () => !$('#home-guide').classList.contains('hidden');
$('#home-guide').addEventListener('click', e => { if (e.target.id === 'home-guide') homeGuide(false); });

// Once ever, on a phone or tablet that hasn't added it yet.
function homeTip(ms) {
  if (!wantsHome()) return;
  try { if (localStorage.getItem('aeon-garden-hometip') === '1') return; } catch (e) { return; }
  setTimeout(() => {
    if (installed()) return;
    addNews('📱 <b>Tip:</b> put the meadow on your home screen and it opens full screen, like an app. <a data-act="home">Show me how</a>, or find it in ••• later.');
    try { localStorage.setItem('aeon-garden-hometip', '1'); } catch (e) { /* fine */ }
  }, ms);
}

// Once ever, after two minutes of play: are you enjoying it, and any ideas? The idea goes to Web3Forms,
// which emails it on. The key is theirs to give out (it can only send to that one inbox). With no key
// the card never shows.
const IDEAS_KEY = '74821b79-dd35-4f02-a7a4-24ebb7c7ebff';   // the access key from web3forms.com
const ASK_MS = 120000;                  // play this long first (the tab showing, past the welcome and intro)
let played = 0;
try { if (localStorage.getItem('aeon-garden-asked') === '1') played = -Infinity; } catch (e) { played = -Infinity; }
const askOpen = () => !$('#ask').classList.contains('hidden');
const canShare = !!navigator.share && matchMedia('(pointer: coarse)').matches;   // a phone or tablet: its share sheet

// Counted a few times a second. It waits for a quiet moment: nothing else open, not filming itself.
function askTick(ms) {
  if (!IDEAS_KEY || LAB || played < 0 || document.hidden || intro.on || !$('#welcome').classList.contains('hidden')) return;
  if ((played += ms) < ASK_MS) return;
  if (idle.on || ui.hush || ui.ring || (guide.on && guide.step < GUIDE_STEPS) || ui.stats.open || webOpen() || ui.newsOpen || homeOpen() || awayOpen() || !$('#more-menu').classList.contains('hidden')) return;
  played = -Infinity;
  try { localStorage.setItem('aeon-garden-asked', '1'); } catch (e) { /* fine */ }
  askIdeas(true);
}
function askIdeas(open) {
  if (open && $('#ask').classList.contains('sent')) {   // another idea, after one went off (from the ••• menu)
    $('#ask').classList.remove('sent');
    $('#ask-text').value = '';
    $('#ask-send').disabled = false;
  }
  $('#ask').classList.toggle('hidden', !open);
  if (open && !narrow()) $('#ask-text').focus({ preventScroll: true });   // (on a phone the keyboard would jump up)
}
function sendIdea() {
  const text = $('#ask-text').value.trim();
  if (!text) { $('#ask-text').focus(); return; }
  $('#ask-send').disabled = true;
  fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: IDEAS_KEY, subject: "An idea for Nobody's Meadow", from_name: "Nobody's Meadow", message: text }),
  }).then(r => r.json()).then(r => {
    if (!r.success) throw r;
    $('#ask').classList.add('sent');
    setTimeout(() => askIdeas(false), 2500);
  }).catch(() => {
    $('#ask-send').disabled = false;
    addNews("💌 Couldn't send your idea just now. Your words are still in the box, try again in a moment.");
  });
}
$('#ask').addEventListener('keydown', e => { if (e.key === 'Escape') askIdeas(false); });

// On a phone the share sheet (messages, chats), elsewhere the clipboard.
function copyLink() {
  if (canShare) {
    navigator.share({ title: "Nobody's Meadow", text: 'Rabbits, foxes and bees living their own lives, in a meadow that keeps its own time.', url: location.href })
      .catch(() => { /* they changed their mind */ });
    return;
  }
  navigator.clipboard?.writeText(location.href).then(
    () => addNews('🔗 Link copied. Anyone who opens it gets this same meadow from the start.'),
    () => addNews(`🔗 Couldn't copy. The link is ${esc(location.href)}`));
}

// The terrain lab on this meadow's map. In a tab of its own, so the meadow keeps going; on the home
// screen a new tab would drop out of the app, so it goes in place, and nothing keeps this meadow.
function openLab() {
  const url = './?lab&seed=' + world.seed + terrainQuery();
  if (!installed()) open(url, '_blank');
  else if (confirm('Open the terrain lab? This meadow will be gone: coming back starts its map over from the beginning.')) location.href = url;
}

// Everything that shows the weather lock: the menu's toggle and the badge on the toolbar.
function showSkyLock() {
  const locked = world.skyLocked;
  document.querySelectorAll('[data-sky]').forEach(b => b.classList.toggle('on', b.dataset.sky === world.weather.kind));
  const btn = $('[data-act="sky-lock"]');
  btn.classList.toggle('on', locked);
  btn.innerHTML = `<span class="e">${locked ? '🔒' : '🔓'}</span><span class="l">${locked ? 'Locked' : 'Lock'}</span>`;
  $('[data-act="sky"]').classList.toggle('locked', locked);
}

function toggleSkyLock() {
  S.lockSky(world, !world.skyLocked);
  addNews(world.skyLocked
    ? `🔒 <b>Weather locked</b> on ${S.WEATHER[world.weather.kind].emoji} ${S.WEATHER[world.weather.kind].name.toLowerCase()} until you unlock it.`
    : '🔓 The weather is free to change again.');
  showSkyLock();
  updateMeadowCard();
}

$('#sky-menu').innerHTML = Object.entries(S.WEATHER).map(([k, wx]) =>
  `<button class="tool" data-sky="${k}" title="${WEATHER_HINT[k]}"><span class="e">${wx.emoji}</span><span class="l">${wx.name.split(' ')[0]}</span></button>`).join('') +
  '<span class="sep"></span><button class="tool" data-act="sky-lock" title="Keep this weather until you unlock it (K)"></button>';

function paintAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  if (ui.tool === 'fire') { burnAt(wx, wy); return; }
  S.paintGrass(world, wx, wy, 3.5);
  hear('grass', wx, wy);
  if (Math.random() < 0.3) addEffect('🌱', wx + (Math.random() - 0.5) * 3, wy + (Math.random() - 0.5) * 3, 0.6, 900);
  terrainTick = -1;
}

// Fire is drawn from where the pointer last was, so a quick stroke leaves no gaps.
function burnAt(wx, wy) {
  const [fx, fy] = drag.burn || [wx, wy];
  if (!drag.burn) setFire(wx, wy);
  S.burnLine(world, fx, fy, wx, wy);
  drag.burn = [wx, wy];
  flushEvents();
}

function setFire(wx, wy) {
  hear('fire', wx, wy, {}, true);
  tried('fire', world.wet > 0.7 ? 'Too wet to burn. Try it after a heatwave.' : '');
  addNews(world.wet > 0.7 ? '🔥 You drew a wall of fire, but the ground is too wet to burn.'
    : '🔥 <b>You drew a wall of fire.</b> Everyone near it runs. On dry grass it could spread.', 'firewall', 8000);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tool],[data-speed],[data-action],[data-act],[data-show],[data-range],[data-sky],[data-ring],a[data-id],a[data-thing]');
  if (ui.sky.menu && !(t && (t.dataset.sky || t.dataset.act === 'sky' || t.dataset.act === 'sky-lock'))) toggleSkyMenu(false);
  if (!(t && t.dataset.act === 'more')) toggleMore(false);
  if (!t) return;
  if (t.closest('#toolbar,#hud-right .hud-top,#ring')) chime('click');
  if (t.dataset.ring) ringPick(t.dataset.ring);
  else if (t.dataset.tool) setTool(t.dataset.tool);
  else if (t.dataset.speed !== undefined) setSpeed(+t.dataset.speed || (ui.speed ? 0 : lastSpeed));
  else if (t.dataset.act === 'cycle') setSpeed(ui.speed ? SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length] : lastSpeed);
  else if (t.dataset.sky) { S.setSky(world, t.dataset.sky); flushEvents(); toggleSkyMenu(false); updateMeadowCard(); }
  else if (t.dataset.act === 'sky') toggleSkyMenu();
  else if (t.dataset.act === 'tools') toggleTools();
  else if (t.dataset.act === 'sky-lock') toggleSkyLock();
  else if (t.dataset.action === 'new') { if (confirm('Start a brand-new meadow? This one will be gone.')) newWorld(randomSeed()); }
  else if (t.dataset.act === 'close') select(0);
  else if (t.dataset.act === 'sheet-up' || t.dataset.act === 'sheet-down') {
    ui.sheetUp = t.dataset.act === 'sheet-up';
    $('#inspector').scrollTop = 0;
    renderInspector();
  }
  else if (t.dataset.act === 'news') toggleNewsLog();
  else if (t.dataset.act === 'mini') toggleMini();
  else if (t.dataset.act === 'more') toggleMore();
  else if (t.dataset.act === 'copy-link') copyLink();
  else if (t.dataset.act === 'ideas') { played = -Infinity; askIdeas(true); }   // found it themselves: no need to ask
  else if (t.dataset.act === 'lab') openLab();
  else if (t.dataset.act === 'watch') startIdle();
  else if (t.dataset.act === 'guide') { openGuide(); guideTick(performance.now()); }
  else if (t.dataset.act === 'guide-shut') { shutGuide(); guideTick(performance.now()); }
  else if (t.dataset.act === 'guide-skip') { Object.assign(guide, { step: GUIDE_STEPS, wait: 0 }); saveGuide(); guideTick(performance.now()); }
  else if (t.dataset.act === 'guide-fold') { guide.fold = !guide.fold; guide.fresh = ''; saveGuide(); guideTick(performance.now()); }
  else if (t.dataset.act?.startsWith('try:')) tryThing(t.dataset.act.slice(4));
  else if (t.dataset.act === 'home') homeGuide();
  else if (t.dataset.act === 'home-done') homeGuide(false);
  else if (t.dataset.act === 'home-install') install();
  else if (t.dataset.act === 'ask-later') askIdeas(false);
  else if (t.dataset.act === 'away-ok') closeAway();
  else if (t.dataset.act === 'ask-send') sendIdea();
  else if (t.dataset.act === 'sound') toggleSound();
  else if (t.dataset.act === 'stats') toggleStats();
  else if (t.dataset.act === 'web') toggleWeb();
  else if (t.dataset.show) { ui.stats.show = t.dataset.show; renderStats(); }
  else if (t.dataset.range) { ui.stats.range = t.dataset.range; renderStats(); }
  else if (t.dataset.act === 'follow') { ui.follow = !ui.follow; renderInspector(); }
  else if (t.dataset.act === 'name') startNaming();
  else if (t.dataset.act === 'traits') { ui.allTraits = !ui.allTraits; renderInspector(); }
  else if (t.dataset.act === 'story') { ui.allStory = !ui.allStory; renderInspector(); }
  else if (t.dataset.act === 'yours') toggleYours();
  else if (t.dataset.act === 'adopt') {
    const c = world.byId.get(+t.dataset.id);
    if (ui.stats.open) toggleStats(false);
    if (yoursOpen()) toggleYours(false);
    if (c && c.alive) { select(c.id); startNaming(); }
  }
  else if (t.dataset.thing) {
    const [kind, id] = t.dataset.thing.split(':'), it = (kind === 'hive' ? world.hives : kind === 'tree' ? world.decor.filter(o => o.tree) : world.fields).find(o => o.id === +id);
    if (t.closest('#yours')) toggleYours(false);
    if (it) pick(kind, it);
  }
  else if (t.dataset.id) {
    if (ui.stats.open) toggleStats(false);
    if (yoursOpen()) toggleYours(false);
    const c = world.byId.get(+t.dataset.id);
    if (c) select(c.id);
  }
});

// P copies a picture of the whole meadow, SHOT pixels a tile, as the game draws it. The camera
// looks at all of it for one frame and is put straight back, so the screen never shows it.
const SHOT = 32;
function copyMeadow() {
  const keep = { x: cam.x, y: cam.y, zoom: cam.zoom, vw, vh, dpr }, now = performance.now();
  vw = S.W * SHOT; vh = S.H * SHOT; dpr = 1;
  Object.assign(cam, { x: S.W / 2, y: S.H / 2, zoom: SHOT });
  canvas.width = vw; canvas.height = vh;
  groundIn = true; render(now); groundIn = false;   // the ground drawn in, as it's a layer of its own on screen
  if (lab?.draw) lab.draw(ctx, dpr, true);
  const png = new Promise(ok => canvas.toBlob(ok, 'image/png'));   // takes the picture now, encodes it later
  ({ vw, vh, dpr } = keep);
  Object.assign(cam, { x: keep.x, y: keep.y, zoom: keep.zoom });
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  render(now);
  if (lab?.draw) lab.draw(ctx, dpr);
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(() => [S.W * SHOT, S.H * SHOT]);
}

document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (intro.on) {                                      // any key skips the intro
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== 'Shift' && e.key !== 'Tab') { e.preventDefault(); endIntro(true); }
    return;
  }
  if (LAB && !'+=-'.includes(e.key)) return;            // the lab has keys of its own
  if (e.key === ' ') {
    e.preventDefault();
    setSpeed(ui.speed ? 0 : lastSpeed);
  } else if ('1234'.includes(e.key) && e.key.length === 1) setSpeed([1, 4, 15, 60][+e.key - 1]);
  else if (e.key === 'Escape') {
    const more = !$('#more-menu').classList.contains('hidden');
    awayOpen() ? closeAway() : homeOpen() ? homeGuide(false) : webOpen() ? toggleWeb(false) : yoursOpen() ? toggleYours(false) : ui.ring ? closeRing() : $('#toolbar').classList.contains('open') ? toggleTools(false) : ui.sky.menu ? toggleSkyMenu(false) : more ? toggleMore(false) : ui.stats.open ? toggleStats(false)
      : ui.tool !== 'look' ? setTool('look') : select(0);
  }
  else if (e.key === 's') toggleStats();
  else if (e.key === 'f' && ui.selectedId) { ui.follow = !ui.follow; renderInspector(); }
  else if (e.key === 'l') setTool('look');
  else if (e.key === 'z') setTool('zap');
  else if (e.key === 'b') setTool('fire');
  else if (e.key === 't') setTool('plant');
  else if (e.key === 'w') toggleSkyMenu();
  else if (e.key === 'k') toggleSkyLock();
  else if (e.key === 'n') toggleNewsLog();
  else if (e.key === 'c') toggleMini();
  else if (e.key === 'm') toggleSound();
  else if (e.key === 'v') startIdle();
  else if (e.key === 'p') copyMeadow().then(([w, h]) => addNews(`📋 Copied the meadow, ${w} × ${h}`), () => addNews('📋 The browser would not let me copy the meadow.'));
  else if (e.key === '+' || e.key === '=') zoomAt(vw / 2, vh / 2, cam.zoom * 1.25);
  else if (e.key === '-') zoomAt(vw / 2, vh / 2, cam.zoom / 1.25);
});

// ------------------------------------------------------------------ the intro
//
// A first visit starts on an empty meadow (Sim.createWorld's arrival option) and watches it fill,
// with bars top and bottom and a line of story at a time. At dawn a family hops in and digs its
// home; the camera stays till they're tucked in for the night, pulls back over the whole meadow
// while the night passes, and hands it over as the sun comes up. The intro only moves the camera,
// sets the clock's pace and writes the lines. The animals do the rest themselves, so each beat
// waits for them to do their part. Any key, click or scroll skips it.

const intro = { on: false, beat: '', since: 0, start: 0, family: [], home: null, from: null, lines: [], lineAt: 0, lineTimer: 0 };
const INTRO_REVEAL = 6.5;                       // seconds the camera takes to pull back
const INTRO_DAWN = Math.round(1.06 * S.TPD);    // it pulls back till the second sunrise
const INTRO_STUCK = 16;                         // seconds a beat may wait on the animals before it moves on
const INTRO_MAX = 50;                           // and the whole intro, before it hands over anyway
const LINE_MS = 3400;                           // a line stays up at least this long
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // then no intro: no camera flights
const ease = u => u * u * (3 - 2 * u);

// Close: the view can't go past the meadow's edge, so near enough that their burrow sits about a
// third of the way in. A narrow phone can't be that close: there it just has to fit, a little way
// to spare, and a good few tiles show between the bars.
function introZoom() {
  const f = world.family, walk = Math.abs(f.spot.x - f.entry.x), band = vh - 2 * clamp(vh * 0.09, 36, 84);
  return clamp(Math.min(Math.max(vw / (walk * 3), 26), vw / (walk + 4.5), band / 9, 60), minZoom * 1.5, 64);
}

// The first shot, behind the welcome card: the edge they'll come in at, at first light.
function introShot() {
  Object.assign(cam, { zoom: introZoom() * 0.9, x: world.family.entry.x, y: world.family.spot.y, goal: null });
  clampCam();
}

function startIntro() {
  Object.assign(intro, { on: true, start: performance.now(), home: null, lines: [], lineAt: 0 });
  document.body.classList.add('intro');
  introBeat('dawn');
  introLine('Spring, day one. Nobody lives here yet.', 2400);
  setIntroSpeed(1);
  if (ui.sound) Sound.playTune('clover');
}

function introBeat(beat, line) {
  intro.beat = beat; intro.since = performance.now();
  if (line) introLine(line);
}

// One line at a time, each up long enough to read: they wait their turn, and the old one fades
// out before the new one fades in.
function introLine(text, ms = LINE_MS) { intro.lines.push({ text, ms }); }
function introCaptions(now) {
  if (!intro.lines.length || now < intro.lineAt) return;
  const el = $('#intro-line'), { text, ms } = intro.lines.shift(), fade = el.classList.contains('on') ? 800 : 0;
  el.classList.remove('on');
  intro.lineAt = now + fade + ms;
  clearTimeout(intro.lineTimer);
  intro.lineTimer = setTimeout(() => { el.textContent = text; el.classList.add('on'); }, fade);
}

function setIntroSpeed(v) {
  if (v === ui.speed) return;
  ui.speed = v;
  Sound.update({ speed: v });
}

function introFrame(now, dt) {
  const fam = intro.family, t = (now - intro.since) / 1000, all = (now - intro.start) / 1000;
  const home = intro.home || (intro.home = fam.find(c => c.dig)?.dig || null);
  const stuck = t > INTRO_STUCK;
  let speed = 1;
  switch (intro.beat) {
    case 'dawn':                          // the empty meadow at first light, then they come
      if (fam.length && t > 2.2) introBeat('walk', `Here come ${fam[0].name} and ${fam[1].name}, with two little ones in tow.`);
      break;
    case 'walk':
      if (home) introBeat('dig', 'This looks like a good spot.');
      else if (stuck) introReveal();
      break;
    case 'dig':
      if (home.dug >= 1) introBeat('home', 'A home of their own.');
      else if (stuck) introReveal();
      break;
    case 'home':                          // an evening by the new burrow, a little quicker, then in they go
      if (t > 2.5) speed = 2;
      if (fam.every(c => !c.alive || c.hidden)) introBeat('night', 'Their first night in the meadow.');
      else if (stuck) introReveal();
      break;
    case 'night':
      if (t > 2.4) introReveal();
      break;
    case 'reveal': {                      // the night passes as the camera pulls back
      const left = INTRO_REVEAL - t;
      speed = world.tick >= INTRO_DAWN ? 1 : clamp((INTRO_DAWN - world.tick) / (Math.max(left, 0.3) * TICKS_PER_SECOND), 0.5, 4);
      if (left <= 0 && world.tick >= INTRO_DAWN) introBeat('morning', 'From now on the meadow is theirs. You’re only visiting.');
      break;
    }
    case 'morning':                       // once the last line has been read
      if (!intro.lines.length && now > intro.lineAt) return endIntro();
      break;
  }
  if (all > INTRO_MAX) return endIntro();
  setIntroSpeed(speed);
  introCaptions(now);

  if (intro.beat === 'morning') return;
  if (intro.beat === 'reveal') {
    const u = ease(clamp(t / INTRO_REVEAL, 0, 1)), f = intro.from;
    cam.zoom = Math.exp(lerp(Math.log(f.z), Math.log(minZoom), u));
    cam.x = lerp(f.x, S.W / 2, u); cam.y = lerp(f.y, S.H / 2, u);
    return;
  }
  // Close up: a slow push in all along, and the camera drifts after the family, or their burrow.
  const dir = world.family.side ? -1 : 1;
  let x = world.family.entry.x, y = world.family.spot.y;
  if (home) { x = home.x + dir * 1.5; y = home.y; }
  else {
    const out = fam.filter(c => c.alive && !c.hidden);
    if (out.length) { x = out.reduce((a, c) => a + c.x, 0) / out.length + dir * 2; y = lerp(y, out.reduce((a, c) => a + c.y, 0) / out.length, 0.5); }
  }
  const k = 1 - Math.pow(0.3, dt);
  cam.x += (x - cam.x) * k; cam.y += (y - cam.y) * k;
  cam.zoom = introZoom() * (0.9 + 0.18 * ease(clamp(all / 22, 0, 1)));
}

function introReveal() {
  intro.from = { x: cam.x, y: cam.y, z: cam.zoom };
  introBeat('reveal');
}

function endIntro(skipped = false) {
  if (!intro.on) return;
  intro.on = false;
  clearTimeout(intro.lineTimer);
  $('#intro-line').classList.remove('on');
  document.body.classList.remove('intro'); hush(false);
  document.body.classList.add('ui-in');
  setTimeout(() => document.body.classList.remove('ui-in'), 1100);
  $('#news').innerHTML = '';              // what happened meanwhile is in the log
  setSpeed(1);
  if (skipped) cam.goal = minZoom;
  welcomeTips();
}
$('#intro-skip').addEventListener('click', () => endIntro(true));

// From the welcome card to the end of the intro, the cards and bars are away.
function hush(on) {
  ui.hush = on;
  document.body.classList.toggle('hush', on);
}

// A few tips in the news, one at a time, once the meadow is theirs to watch. On a phone or tablet the
// home screen card comes first, and the tips wait for it to close.
function welcomeTips() {
  if (wantsHome()) {
    try { localStorage.setItem('aeon-garden-hometip', '1'); } catch (e) { /* fine */ }
    afterHome = firstSteps;
    setTimeout(() => homeGuide(true, true), 1200);      // once the bars are back
  } else firstSteps();
}
function firstSteps() {
  setTimeout(startGuide, 1200);
  setTimeout(() => { if (!ui.sound) addNews(narrow() ? '🔊 <b>Tip:</b> the meadow has quiet sounds. Turn them on in ••• at the top.'
    : '🔊 <b>Tip:</b> the meadow has quiet sounds. Turn them on with 🔇 at the top right (M).'); }, 40000);
}

// ------------------------------------------------------------------ things to try
//
// After the intro, three steps, one at a time: follow an animal, run time faster, open the ring. Then a
// notebook of things to try, gentle and not, that tick off as they're done, and a tap on one puts its tool
// in your hand. It only points: the meadow does the rest. What's done is kept (aeon-garden-tried), it comes
// back on the next visit till it's done or closed, and ••• opens it again.

const TRIES = [                          // what to try, a hint, and what it says once done
  { k: 'zap', e: '⚡', text: 'Strike lightning on a tree', hint: 'On a dry day it starts a fire.' },
  { k: 'fire', e: '🔥', text: 'Draw a wall of fire', hint: 'Drag it across the grass and see who runs.', said: 'The ash will feed fresh shoots.' },
  { k: 'fox', e: '🦊', text: 'Let a fox loose by the rabbits', hint: 'They know what to do.', said: 'Run, rabbits!' },
  { k: 'sky', e: '🌦️', text: 'Change the weather', hint: 'A heatwave dries the grass out for a fire.' },
  { k: 'look', e: '🌳', text: 'Click a tree, a hive or a burrow', hint: 'Everything here has a story.', said: 'Rocks, flowers and water have theirs too.' },
  { k: 'name', e: '🏷️', text: 'Give an animal a name', hint: 'Click one, then tap its name.', said: 'It’s yours now: you’ll hear how it goes.' },
  { k: 'plant', e: '🌳', text: 'Plant a tree', hint: 'Pick the kind: an oak is slow, a birch quick, a hawthorn guards its neighbours.', said: 'Mind the rabbits: a seedling is a mouthful.' },
  { k: 'carry', e: '🫳', text: 'Pick up an animal and carry it', hint: 'Press on it and drag. On a phone, hold a finger on it.', said: 'Mind where you put it down.' },
  { k: 'fast', e: '⏩', text: 'Watch a year go by at 60×', hint: 'The rabbits boom and crash.', said: 'The meadow keeps going while you’re away, too.' },
  { k: 'stats', e: '📊', text: 'Look at the graphs', hint: 'Every birth, death and fire is counted.', said: 'The records keep the meadow’s oldest and biggest.' },
];
const SKY_SAID = {
  clear: 'Lock it (🔒) and it stays.', cloudy: 'Lock it (🔒) and it stays.',
  rain: 'Rain grows the grass three times as fast.', storm: 'A storm brings lightning of its own.',
  fog: 'In fog a fox can’t see far.', heat: 'The grass dries out. A fire now would spread.',
  snow: 'In winter snow freezes the water over, and foxes walk across.',
};
const GUIDE_STEPS = 3, GUIDE_BYE = 4000, GUIDE_KEY = 'aeon-garden-tried';   // the last tick shows this long before the goodbye
const guide = { on: false, step: 0, tried: [], said: {}, fresh: '', shut: false, fold: false, auto: false, wait: 0, fast: 0, tickWas: 0, html: '', doneAt: 0 };
try { Object.assign(guide, JSON.parse(localStorage.getItem(GUIDE_KEY) || '{}')); } catch (e) { /* fine */ }
const guideDone = () => TRIES.every(t => guide.tried.includes(t.k));

function saveGuide() {
  const { step, tried, shut, fold, auto } = guide;
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify({ step, tried, shut, fold, auto })); } catch (e) { /* fine */ }
}

// A first visit starts it from the top; a later one only brings back what was left open.
function startGuide(fresh = true) {
  if (LAB) return;
  if (fresh) Object.assign(guide, { step: 0, tried: [], said: {}, fresh: '', shut: false, fold: false, auto: true, wait: 0, fast: 0, doneAt: 0 });
  else if (!guide.auto || guide.shut || guideDone()) return;
  guide.on = true; guide.tickWas = world.tick;
  saveGuide();
}

// From the ••• menu: the notebook, open.
function openGuide() {
  Object.assign(guide, { on: true, step: GUIDE_STEPS, shut: false, fold: false, doneAt: 0, tickWas: world.tick });
  saveGuide();
}

function shutGuide() {
  Object.assign(guide, { on: false, shut: true });
  saveGuide();
}

// Something on the list was done. It counts whenever it's done, even with the notebook closed.
function tried(k, said) {
  if (guide.tried.includes(k) || intro.on || away.on || idle.on) return false;
  guide.tried.push(k);
  guide.said[k] = said || TRIES.find(t => t.k === k).said || '';
  saveGuide();
  if (guide.on && guide.step >= GUIDE_STEPS) {
    guide.fresh = k;
    chime('tick');
    if (narrow()) { guide.fold = false; guide.freshAt = 0; }       // a phone opens it to show the tick, and folds it again below
    if (guideDone()) guide.doneAt = performance.now();
  }
  return true;
}

// A tap on a line puts that thing in your hand.
function tryThing(k) {
  if (k === 'zap' || k === 'fire' || k === 'fox' || k === 'plant') { if (ui.tool !== k) setTool(k); }
  else if (k === 'look' || k === 'carry' || k === 'name') setTool('look');
  else if (k === 'sky') toggleSkyMenu(true);
  else if (k === 'fast') setSpeed(60);
  else if (k === 'stats') toggleStats(true);
  if (narrow() && k !== 'sky') { guide.fold = true; saveGuide(); }   // out of the way of the meadow
  guideTick(performance.now());
}

// A few times a second (the cards' beat): the steps wait for what they ask, and a few things on the list
// are easier to see done than to catch.
function guideTick(now) {
  const show = guide.on && !intro.on && !away.on;
  if ($('#guide').classList.contains('hidden') === show) $('#guide').classList.toggle('hidden', !show);
  if (!show || idle.on) { guide.tickWas = world.tick; return; }
  if (ui.picked) tried('look');
  if (ui.stats.open) tried('stats');
  const ran = world.tick - guide.tickWas;
  guide.tickWas = world.tick;
  if (ui.speed === 60 && ran > 0 && (guide.fast += ran) >= S.YEAR_DAYS * S.TPD) tried('fast');

  if (guide.step < GUIDE_STEPS) {
    const done = [() => world.byId.has(ui.selectedId), () => ui.speed >= 4, () => !!ui.ring || ui.tool !== 'look'][guide.step]();
    if (done && !guide.wait) guide.wait = now + (guide.step < GUIDE_STEPS - 1 ? 1600 : 400);
    if (guide.wait && now >= guide.wait) {
      guide.wait = 0; guide.step++;
      saveGuide();
      chime('tick');
    }
  }
  if (guide.doneAt && now - guide.doneAt > GUIDE_BYE + 12000) { shutGuide(); guideTick(now); return; }
  if (guide.fresh && narrow() && !guide.fold && now - (guide.freshAt ||= now) > 5000) { guide.fold = true; guide.fresh = ''; guide.freshAt = 0; saveGuide(); }
  renderGuide(now);
}

function renderGuide(now) {
  const box = $('#guide'), touch = matchMedia('(pointer: coarse)').matches;
  let html;
  if (guide.step < GUIDE_STEPS) {
    const mum = intro.family[0], click = touch ? 'Tap' : 'Click';
    const steps = [
      [mum && mum.alive ? `${click} ${link(mum)} to follow her.` : `${click} any animal to follow their life.`,
        touch ? 'Pinch to zoom, drag to look around.' : 'Scroll to zoom, drag to look around.'],
      [touch ? 'Time can run faster. Tap <b>1×</b> at the top.' : 'Time can run faster. Press <kbd>3</kbd>, or pick <b>15×</b> at the top.',
        touch ? '⏸ stops it.' : 'Space stops it.'],
      [touch ? 'Now hold a finger on the meadow.' : 'Now right-click anywhere on the meadow.', 'That’s where you change things.'],
    ];
    const [line, hint] = steps[guide.step];
    html = `<div class="g-top"><span class="g-step">${guide.step + 1} of ${GUIDE_STEPS}</span><button class="g-skip" data-act="guide-skip">Skip</button></div>
      <p class="g-line${guide.wait ? ' done' : ''}" data-step="${guide.step}">${line}</p><p class="g-hint">${hint}</p>`;
  } else if (guide.doneAt && now - guide.doneAt > GUIDE_BYE) {
    html = `<div class="g-top"><b class="g-title fr">📓 That’s all of them</b><button class="g-x" data-act="guide-shut" aria-label="Close">✕</button></div>
      <p class="g-hint">Now sit back. The meadow gets on with it, whether you watch or not.</p>`;
  } else {
    const n = guide.tried.length;
    html = `<div class="g-top"><button class="g-head" data-act="guide-fold" aria-expanded="${!guide.fold}"><b class="g-title fr">📓 Things to try</b>
        <span class="g-count">${n} of ${TRIES.length}</span><span class="win-btn${guide.fold ? ' grow' : ''}" aria-hidden="true"></span></button>
        <button class="g-x" data-act="guide-shut" aria-label="Close" title="Close. ••• opens it again">✕</button></div>
      ${n ? '' : '<p class="g-hint g-sub">Your turn. The meadow can take it.</p>'}
      <ul class="g-list">${TRIES.map(t => {
        const done = guide.tried.includes(t.k), said = done && guide.said[t.k];
        const text = t.k === 'look' && touch ? t.text.replace('Click', 'Tap') : t.text;
        return `<li><button class="${done ? 'done' : ''}${guide.fresh === t.k ? ' fresh' : ''}" data-act="try:${t.k}"><span class="e">${t.e}</span>
          <span><b>${text}</b>${done ? (said ? `<small>${said}</small>` : '') : `<small>${t.hint}</small>`}</span><span class="tick">${done ? '✓' : ''}</span></button></li>`;
      }).join('')}</ul>`;
  }
  box.classList.toggle('fold', guide.fold && guide.step >= GUIDE_STEPS && !(guide.doneAt && now - guide.doneAt > GUIDE_BYE));
  if (html !== guide.html) { box.innerHTML = html; guide.html = html; }
}

// The news toasts sit above it, however tall it is.
new ResizeObserver(() => {
  const h = $('#guide').offsetHeight;
  document.body.style.setProperty('--guide-h', h ? h + 8 + 'px' : '0px');
}).observe($('#guide'));

// ------------------------------------------------------------------ the idle camera
//
// Leave the meadow be for a minute and it films itself, like a nature film: the intro's bars come
// in, the cards fade away, and the camera goes from shot to shot. It follows a fox on the hunt, a
// kit after its mum or a courting pair, or drifts past a hive, a field in bloom, an old tree or the
// lake, and now and then over the whole meadow. What just happened comes first: a fire, a swarm, a
// storm felling a tree. A shot keeps one zoom and only pans (a new zoom paints the ground again),
// and the next comes after a dip to dark, or with a glide when it's near. At 15x and 60x only
// places: animals would dart about. Not while paused, or while a card is open (you're reading).
// V or ••• starts it now. Any key, click, scroll or move of the mouse hands the meadow back, the
// camera staying where it is.

const IDLE_MS = 60000;                  // no touch this long and it starts
const SHOT_S = [8, 14];                 // seconds a shot lasts
const DIP_MS = 400;                     // each way, the dip to dark between shots (as #intro .dip in index.html)
const GLIDE_S = 2.5;                    // seconds a glide to a shot nearby takes
const DRIFT_PX = 14;                    // screen pixels a second a place drifts past
const SWEEP_PX = 40;                    // and the most the whole meadow does
const NEWS_S = 12;                      // seconds something that happened stays worth filming
const idle = { on: false, since: 0, shot: null, next: null, dipAt: 0, news: null, lastKind: '', lastKey: null, px: 0, py: 0, lineTimer: 0 };
const between = (a, b) => a + Math.random() * (b - a);
const anyOf = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;

const idleMayStart = now => !idle.on && !held && now - lastInput > IDLE_MS && ui.speed > 0 && !ui.hush && !LAB && !calm && !document.hidden
  && !askOpen() && !awayOpen() && !ui.selectedId && !ui.picked && !ui.ring && !ui.stats.open && !webOpen() && !ui.newsOpen && !ui.sky.menu
  && $('#more-menu').classList.contains('hidden') && !homeOpen() && !$('#toolbar').classList.contains('open');

function startIdle(now = performance.now()) {
  if (idle.on || ui.hush || LAB) return;
  closeRing(); toggleTools(false); toggleSkyMenu(false); toggleMore(false);
  if (homeOpen()) homeGuide(false);
  if (ui.stats.open) toggleStats(false);
  if (webOpen()) toggleWeb(false);
  if (ui.newsOpen) toggleNewsLog();
  if (ui.selectedId || ui.picked) select(0);
  if (!ui.speed) setSpeed(lastSpeed);
  Object.assign(idle, { on: true, since: now, next: null, dipAt: 0, news: null, lastKind: '', lastKey: null,
    shot: { kind: 'hold', until: now + 1200 } });       // the cards fade out and the bars come in first
  Object.assign(ui, { hush: true, hoverId: 0, hoverHive: null });   // (hush: nothing to keep clear of at the bottom)
  cam.goal = null; flick.vx = flick.vy = 0;
  document.body.classList.add('idle');
}

function wakeIdle() {
  if (!idle.on) return;
  idle.on = false; idle.shot = idle.next = null; idle.dipAt = 0;
  lastInput = performance.now();
  clearTimeout(idle.lineTimer);
  $('#intro-line').classList.remove('on');
  $('#intro .dip').classList.remove('on');
  ui.hush = false;
  document.body.classList.remove('idle');
  document.body.classList.add('ui-in');
  setTimeout(() => document.body.classList.remove('ui-in'), 1100);
}

// The press that wakes it does nothing else. It goes to the window first (capture), before the meadow sees it.
addEventListener('pointerdown', e => {
  if (!idle.on) return;
  e.stopPropagation();
  if (ui.sound) Sound.start();
  wakeIdle();
}, true);
addEventListener('keydown', e => {
  if (!idle.on) return;
  if (ui.sound) Sound.start();
  wakeIdle();
  if (!e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); }   // the browser's own keys still work
}, true);
addEventListener('wheel', e => {
  if (!idle.on) return;
  e.preventDefault(); e.stopPropagation();
  wakeIdle();
}, { capture: true, passive: false });
// A nudged desk isn't a hand on the mouse: it takes a real move. Not the one just after starting it from the menu.
addEventListener('pointermove', e => {
  if (!idle.on || performance.now() - idle.since < 800) { idle.px = e.clientX; idle.py = e.clientY; }
  else if (Math.hypot(e.clientX - idle.px, e.clientY - idle.py) > 24) wakeIdle();
}, { passive: true });
addEventListener('resize', () => wakeIdle());
// Back from another tab or window counts as a touch: it shouldn't greet you with a film.
for (const [on, type] of [[window, 'focus'], [document, 'visibilitychange']]) on.addEventListener(type, () => { lastInput = performance.now(); });

// What just happened, for the next shot. Big things cut the shot on screen short.
function idleNews(e) {
  const at = performance.now();
  let n = null;
  switch (e.type) {
    case 'birth':
      if (e.mum.species !== 'bee') n = { c: e.mum, w: 3, line: `${e.mum.name} and her new ${e.mum.species === 'fox' || e.mum.species === 'otter' ? 'cubs' : e.mum.species === 'crow' ? 'chicks' : e.mum.species === 'owl' ? 'owlets' : 'babies'}` };
      break;
    case 'death': if (e.cause === 'fox' && e.killer) n = { c: e.killer, w: 5 }; break;
    case 'lightning': if (e.tree) n = { x: e.x, y: e.y, w: 8, line: 'Struck by lightning', big: true }; break;
    case 'windthrow': n = { x: e.tree.x, y: e.tree.y, w: 8, line: 'Brought down by the storm', big: true }; break;
    case 'swarm': n = { x: e.swarm.x, y: e.swarm.y, w: 8, line: `Queen ${e.queen.name}'s swarm, looking for a home`, big: true }; break;
    case 'settle': n = { x: e.hive.x, y: e.hive.y, w: 6, line: `Queen ${e.queen.name}'s swarm moves in` }; break;
    case 'fire': n = { big: true }; break;          // the fire is filmed anyway, first of all
    case 'outbreak': n = { x: e.x, y: e.y, w: 6, line: 'A sickness is going round the warren' }; break;
    case 'gathering': n = { x: e.remains.x, y: e.remains.y, w: 6, line: `Crows at the remains of ${e.remains.c.name}` }; break;
    case 'fledge': n = { c: e.c, w: 4, line: `${e.c.name}, an owlet out of the hollow` }; break;
    case 'cubsout': n = { c: e.c, w: 4, line: `${e.c.name}, an otter cub out of the holt` }; break;
    case 'holt': n = { c: e.c, w: 4, line: `${e.c.name}'s new holt on the bank` }; break;
  }
  if (!n) return;
  if (n.c || n.x !== undefined) idle.news = Object.assign(n, { at });
  const s = idle.shot;
  if (n.big && s && s.kind !== 'hold' && at - s.t0 > 3000) s.until = Math.min(s.until, at);
}

const lowerFirst = s => s[0].toLowerCase() + s.slice(1);
const animalLine = c => `${c.name} the ${c.sp.name.toLowerCase()}, ${lowerFirst(S.mood(world, c).text)}`;
const treeLift = d => d ? treePx(d) / cam.zoom * 0.3 : 0;   // up a tree from its foot (in tiles, whatever the zoom)

// What to film next: at most one of each kind of subject there is, then one of them by weight. Never
// the same subject twice running, and the same kind again only now and then.
function pickShot(now) {
  const fast = ui.speed > 4, ck = S.clock(world), season = ck.season, z = narrow() ? 0.75 : 1, opts = [];
  const add = (w, kind, s) => {
    if (w > 0 && s.key !== idle.lastKey) opts.push([kind === idle.lastKind ? w / 4 : w, Object.assign(s, { kind })]);
  };
  const who = (w, kind, c, other = null, line = '') => {
    if (c && c.alive && !c.hidden) add(w, kind, { c, other, x: c.x, y: c.y, zoom: between(20, 26) * z, key: c, line: line || animalLine(c) });
  };
  const at = (w, kind, key, x, y, zoom, line = '') => add(w, kind, { x, y, zoom: zoom * z, key, line });

  const n = idle.news;
  if (n && now - n.at < NEWS_S * 1000) {
    if (n.c) { if (!fast) who(n.w, 'news', n.c, null, n.line); }
    else at(n.w, 'news', n, n.x, n.y, 16, n.line);
  }
  if (world.burning.length) { const i = anyOf(world.burning); at(12, 'fire', 'fire', i % S.W + 0.5, Math.floor(i / S.W) + 0.5, 13, 'Wildfire!'); }

  if (!fast) {
    const hunt = [], young = [], love = [], busy = [], out = [];
    for (const c of world.creatures) {
      if (!c.alive || c.hidden || c.species === 'bee') continue;     // a bee is too small and quick to follow: the hive shots have them
      const m = c.mode;
      if (m === 'stalk' || m === 'chase' || (m === 'flee' && c.threatId)) hunt.push(c);
      else if (m === 'follow') young.push(c);
      else if (m === 'love') love.push(c);
      else if (m === 'dig' || m === 'munch' || m === 'apple' || m === 'alarm') busy.push(c);
      else if (m !== 'sleep' && m !== 'shelter' && m !== 'rest') out.push(c);
    }
    const h = anyOf(hunt), y = anyOf(young), l = anyOf(love);
    who(6, 'hunt', h, h && world.byId.get(h.species === 'fox' ? h.targetId : h.threatId));
    who(2, 'young', y, y && world.byId.get(y.mumId));
    who(1.5, 'love', l, l && world.byId.get(l.targetId));
    who(2, 'busy', anyOf(busy));
    who(2, 'out', anyOf(out));
  }

  const swarm = anyOf(world.hives.filter(h => h.cluster)), hive = anyOf(world.hives.filter(h => !h.cluster));
  if (swarm) at(5, 'swarm', swarm, swarm.x, swarm.y, 18, swarm.queen ? `Queen ${swarm.queen.name}'s swarm, looking for a home` : 'A swarm, looking for a home');
  if (hive) at(ck.night || season === 3 ? 0.4 : 2, 'hive', hive, hive.x, hive.y - treeLift(hive.tree), 16, hive.queen ? `Queen ${hive.queen.name}'s hive` : 'An empty hive');
  const field = anyOf(world.fields.filter(f => f.season === season));
  if (field) at(ck.night ? 0.3 : 2, 'field', field, field.x, field.y, 12, field.name);
  const old = anyOf(world.decor.filter(d => d.tree && d.name && !d.fallen));
  if (old) at(1.2, 'tree', old, old.x, old.y - treeLift(old), 17, treeTitle(old));
  const bloom = season === 0 && anyOf(world.blossoms)?.tree;
  if (bloom) at(1.5, 'tree', bloom, bloom.x, bloom.y - treeLift(bloom), 18, `${treeTitle(bloom)} in blossom`);
  const rock = anyOf(world.decor.filter(d => d.big));
  if (rock) at(0.6, 'rock', rock, rock.x, rock.y, 18);
  const wet = world.lake ? [world.lake] : [];
  for (const rv of world.rivers) {
    const p = anyOf(rv.pts);
    if (p) wet.push({ name: rv.name, x: clamp(p.x, 4, S.W - 4), y: clamp(p.y, 4, S.H - 4) });
  }
  const water = anyOf(wet);
  if (water) at(ck.night && season === 1 ? 2.5 : world.frozen ? 2 : 1.2, 'water', water.name, water.x, water.y, 11,   // fireflies on a summer night
    world.frozen ? `${water.name}, frozen over` : water.name);
  const wide = { x: S.W / 2, y: S.H / 2, zoom: minZoom * 1.25, key: 'wide', line: `${S.SEASONS[season].name}, year ${ck.year}` };
  add(fast ? 3 : 1.2, 'wide', wide);

  let r = Math.random() * opts.reduce((a, [w]) => a + w, 0);
  const s = opts.length ? (opts.find(([w]) => (r -= w) <= 0) || opts[opts.length - 1])[1] : Object.assign(wide, { kind: 'wide' });   // nothing else: the meadow again
  if (s.kind !== 'wide') s.zoom = clamp(s.zoom, minZoom * 1.15, 40);
  return s;
}

// Glide there if it's near and about as close up (the zoom stays: see above), else dip to dark and cut.
function changeShot(now) {
  const cur = idle.shot, s = pickShot(now);
  idle.lastKind = s.kind; idle.lastKey = s.key;
  const near = cur.kind !== 'hold' && cur.kind !== 'wide' && s.kind !== 'wide' && Math.abs(Math.log(cam.zoom / s.zoom)) < 0.35
    && Math.hypot(s.x - cam.x, s.y - cam.y) * cam.zoom < vw * 0.8;
  if (near) { s.zoom = cam.zoom; beginShot(s, now, true); return; }
  idle.shot = null; idle.next = s; idle.dipAt = now;
  $('#intro .dip').classList.add('on');
  idleLine('');
}

function beginShot(s, now, glide) {
  idle.shot = s;
  s.t0 = now; s.until = now + between(...SHOT_S) * 1000;
  s.from = glide ? { x: cam.x, y: cam.y } : null;
  cam.zoom = s.zoom;
  if (s.c) {                              // with room ahead of where they face
    s.lead = s.c.facing * vw / 7 / cam.zoom;
    s.sx = s.x + s.lead; s.sy = s.y;
  } else {                                // a place drifts past, its subject in the middle halfway through
    const dur = (s.until - now) / 1000, dir = () => Math.random() < 0.5 ? -1 : 1;
    if (s.kind === 'wide') {              // the whole meadow, from one side towards the other
      s.vx = dir() * Math.min(Math.max(0, S.W - vw / cam.zoom) * 0.8 / dur, SWEEP_PX / cam.zoom);
      s.vy = dir() * Math.min(Math.max(0, S.H - vh / cam.zoom) * 0.4 / dur, SWEEP_PX / cam.zoom);
    } else {
      const a = Math.random() * TAU, v = DRIFT_PX / cam.zoom;
      s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v * 0.6;
    }
    s.x0 = s.x - s.vx * dur / 2; s.y0 = s.y - s.vy * dur / 2;
  }
  idleLine(s.line);
}

// The shot's line, a moment after it starts, and gone again well before it ends.
function idleLine(text) {
  const el = $('#intro-line');
  clearTimeout(idle.lineTimer);
  el.classList.remove('on');
  if (!text) return;
  idle.lineTimer = setTimeout(() => {
    el.textContent = text; el.classList.add('on');
    idle.lineTimer = setTimeout(() => el.classList.remove('on'), 5000);
  }, 900);
}

function idleFrame(now, dt) {
  if (idle.dipAt) {                       // dark: cut to the next shot, then light again
    if (now - idle.dipAt < DIP_MS) return;
    idle.dipAt = 0;
    beginShot(idle.next, now, false);
    $('#intro .dip').classList.remove('on');
  }
  let s = idle.shot;
  if (now > s.until) { changeShot(now); if (!(s = idle.shot)) return; }
  if (s.kind === 'hold') return;
  const t = (now - s.t0) / 1000;
  let x, y;
  if (s.c) {                              // after them, or both of a pair in the picture
    const c = s.c, o = s.other;
    if (c.alive && !c.hidden) {
      const pair = o && o.alive && !o.hidden && Math.abs(o.x - c.x) * cam.zoom < vw * 0.5 && Math.abs(o.y - c.y) * cam.zoom < vh * 0.4;
      s.lead += ((pair ? 0 : c.facing * vw / 7 / cam.zoom) - s.lead) * (1 - Math.pow(0.4, dt));   // turning round, it swings over slowly
      const k = 1 - Math.pow(0.05, dt);
      s.sx += ((pair ? (c.x + o.x) / 2 : c.x) + s.lead - s.sx) * k;
      s.sy += ((pair ? (c.y + o.y) / 2 : c.y) - s.sy) * k;
    } else if (!s.gone) { s.gone = true; s.until = Math.min(s.until, now + 2500); }   // into a burrow, or caught: a moment on the spot
    x = s.sx; y = s.sy;
  } else { x = s.x0 + s.vx * t; y = s.y0 + s.vy * t; }
  if (s.from && t < GLIDE_S) { const u = ease(t / GLIDE_S); x = lerp(s.from.x, x, u); y = lerp(s.from.y, y, u); }
  cam.x = x; cam.y = y;
}

// ------------------------------------------------------------------ keeping the meadow
//
// The meadow is kept in the browser when the page is hidden or closed, and the next visit picks it up
// where it was (Sim.packWorld), with the news, the camera and whoever you were following. A kept meadow
// is a few megabytes, too big for localStorage, so it goes in IndexedDB under its link, and localStorage
// keeps the list of links, the one watched last first. A few are kept, so a meadow a friend sent doesn't
// take the place of your own: the bare address opens the last one, a link its own. Not in the lab.
// A kept meadow that won't open, or that broke the page the last time it opened (OPENING), is let go.
const KEEP_MEADOWS = 3;
const KEEP_IDLE_MS = 10 * 60e3;            // and while it films itself (nobody at the keys to see the hitch), this often
const KEPT = 'aeon-garden-kept', OPENING = 'aeon-garden-opening';   // in localStorage
let keepOpen = null, keptTick = -1, keptWhen = Date.now();
let opening = 0;                           // a kept meadow just opened: 1 until a frame starts, then counts frames that got to the end

function keepDb() {
  return keepOpen ??= new Promise((ok, fail) => {
    const r = indexedDB.open('aeon-garden', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('meadows');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
function keptList() {
  try { return JSON.parse(localStorage.getItem(KEPT) || '[]'); } catch (e) { return []; }
}
function setKept(list) {
  try { localStorage.setItem(KEPT, JSON.stringify(list)); return true; } catch (e) { return false; }
}

// Hiding the page or leaving it (below), or now and then while it films itself: a few hundredths of a
// second, so never while someone is watching.
function keepMeadow() {
  if (opening === 1) cleared();                       // never shown (a tab in the background): it can't have broken anything
  if (LAB || !world || world.tick === keptTick || !$('#welcome').classList.contains('hidden')) return;
  let kept;
  try { kept = S.packWorld(world); } catch (e) { console.warn('Could not keep the meadow', e); return; }
  keptTick = world.tick; keptWhen = Date.now();
  const link = meadowLink(world.seed), at = Date.now();
  const list = [{ link, at }, ...keptList().filter(k => k.link !== link)];
  if (!setKept(list.slice(0, KEEP_MEADOWS))) return;
  const rec = { link, at, kept, paused: ui.speed === 0, news: ui.newsLog, records: ui.records, crashSaid: ui.crashSaid,
    cam: { x: cam.x, y: cam.y, zoom: cam.zoom }, selectedId: ui.selectedId, follow: ui.follow };
  keepDb().then(db => {
    const tx = db.transaction('meadows', 'readwrite'), store = tx.objectStore('meadows');
    store.put(rec, link);
    for (const k of list.slice(KEEP_MEADOWS)) store.delete(k.link);
    tx.commit?.();                                     // now, not when the page gets round to it
  }).catch(e => console.warn('Could not keep the meadow', e));
}

// The kept meadow to open: this seed's, or with none, the one watched last. Null if there's none, or
// no IndexedDB, or it takes too long to say (a new meadow then).
function keptMeadow(seed) {
  const list = keptList(), link = seed ? meadowLink(seed) : list[0]?.link;
  if (!link || !list.some(k => k.link === link)) return Promise.resolve(null);
  let broke = false;
  try { broke = localStorage.getItem(OPENING) === link; } catch (e) { /* fine */ }
  if (broke) { forgetMeadow(link); return Promise.resolve(null); }
  const read = keepDb().then(db => new Promise(ok => {
    const r = db.transaction('meadows').objectStore('meadows').get(link);
    r.onsuccess = () => ok(r.result || null);
    r.onerror = () => ok(null);
  }));
  return Promise.race([read, new Promise(ok => setTimeout(ok, 3000, null))]).catch(() => null);
}

function cleared() {
  opening = 0;
  try { localStorage.removeItem(OPENING); } catch (e) { /* fine */ }
}
function forgetMeadow(link) {
  setKept(keptList().filter(k => k.link !== link));
  cleared();
  keepDb().then(db => db.transaction('meadows', 'readwrite').objectStore('meadows').delete(link)).catch(() => {});
}

// A kept meadow back on screen. False if it won't open, and then it's let go.
function resumeWorld(rec) {
  try {
    localStorage.setItem(OPENING, rec.link);          // cleared once it has run a few frames (frame)
    const w = S.unpackWorld(rec.kept);
    if (!w) throw new Error('kept by another version');
    terrain = w.options.terrain || {}; drawn = w.options.drawn || {};
    showWorld(w);
    S.step(world);                                    // a meadow that can't take a step is no good
    flushEvents();
  } catch (e) {
    console.warn('The kept meadow would not open', e);
    forgetMeadow(rec.link);
    return false;
  }
  opening = 1;
  Object.assign(ui, { newsLog: rec.news || [], records: rec.records || ui.records, crashSaid: rec.crashSaid || ui.crashSaid });
  renderNewsLog();
  if (rec.cam) { cam.zoom = Math.max(rec.cam.zoom, fitZoom); cam.x = rec.cam.x; cam.y = rec.cam.y; clampCam(); }
  const c = world.byId.get(rec.selectedId);
  if (c) { select(c.id, false); ui.follow = rec.follow; }
  history.replaceState(null, '', meadowLink(world.seed));
  return true;
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); keepMeadow(); }
  else if (hiddenAt && Date.now() - hiddenAt > AWAY_MIN && world && ui.speed > 0 && (!ui.hush || idle.on) && !LAB && !away.on) startAway();
});
addEventListener('pagehide', keepMeadow);

// ------------------------------------------------------------------ while you were away
//
// The meadow keeps its own time. Back after a while (the page closed, or hidden), it runs on by a
// season while a card says so, then the card says what happened. Nothing is drawn meanwhile: days
// flashing by would flicker. Paused, it waited for you.
const AWAY_MIN = 5 * 60e3;                 // gone at least this long, in real time
const AWAY_TICKS = S.SEASON_DAYS * S.TPD;  // and it moves on a season, however long it was
const AWAY_MS = 40;                        // of each frame the catching up gets
const AWAY_BIG = ['extinct', 'swarm', 'settle', 'hivestruck', 'queenlost', 'fire', 'outbreak', 'outbreakover', 'mast', 'voles', 'frogyear', 'treedied', 'windthrow'];   // news for the card, the first told first
const away = { on: false, frames: 0, left: 0, from: 0, day: -1, births: null, deaths: null, news: [], type: '', mine: false };
const awayOpen = () => !$('#away').classList.contains('hidden');
const deathsOf = s => Object.values(world.stats.deaths[s]).reduce((a, b) => a + b, 0);

function startAway() {
  if (idle.on) wakeIdle();
  Object.assign(away, { on: true, frames: 0, left: AWAY_TICKS, from: world.tick, day: -1, news: [],
    births: perKind(s => world.stats.births[s]), deaths: perKind(deathsOf) });
  $('#away').classList.remove('hidden', 'done');
  awayProgress();
}

// The first frame only draws the meadow as it was; after that each one runs it on, and draws nothing.
function awayFrame() {
  if (!away.frames++) return;
  const t0 = performance.now();
  do {
    for (let i = 0; i < 16 && away.left > 0; i++, away.left--) {
      S.step(world);
      if (world.events.length) flushEvents();
    }
  } while (away.left > 0 && performance.now() - t0 < AWAY_MS);
  if (away.left > 0) awayProgress(); else awayDone();
}

function awayProgress() {
  const day = Math.floor(world.tick / S.TPD);
  if (day === away.day) return;
  away.day = day;
  $('#away-text').textContent = `The meadow kept its own time. ${S.SEASONS[S.seasonOf(world.tick)].emoji} ${when(world.tick)}…`;
}

// Called by addNews while catching up: yours, or big news, goes on the card.
function awayNews(html) {
  const rank = away.mine ? -1 : AWAY_BIG.indexOf(away.type);
  if ((away.mine || rank >= 0) && !away.news.some(n => n.html === html)) away.news.push({ html, rank });
}

function awayDone() {
  away.on = false;
  ui.effects.length = ui.zaps.length = ui.trail.length = 0;   // what they showed is long over
  const from = S.SEASONS[S.seasonOf(away.from)], to = S.SEASONS[S.seasonOf(world.tick)];
  const and = parts => (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0]);
  const tally = (was, now) => and(S.KINDS.filter(s => now(s) > was[s])
    .map(s => { const n = now(s) - was[s]; return `${n} ${(n === 1 ? S.SPECIES[s].name : S.SPECIES[s].plural).toLowerCase()}`; }));
  const born = tally(away.births, s => world.stats.births[s]), died = tally(away.deaths, deathsOf);
  $('#away-text').textContent = `${from.emoji} ${from.name} turned to ${to.name.toLowerCase()}.`
    + (to === S.SEASONS[0] ? ` Year ${S.clock(world).year} has begun.` : '');
  $('#away-life').textContent = [born && `🐣 Born: ${born}.`, died && `🥀 Gone: ${died}.`].filter(Boolean).join('\n') || 'A quiet season.';
  const own = away.news.filter(n => n.rank < 0).length;   // yours first, and a few more of them
  const top = away.news.sort((a, b) => a.rank - b.rank).slice(0, clamp(own, 3, 5));
  $('#away-news').innerHTML = top.map(n => `<li>${n.html}</li>`).join('');
  away.news = [];
  $('#away').classList.add('done');
}

function closeAway() {
  if (!away.on) $('#away').classList.add('hidden');
}
$('#away').addEventListener('click', e => { if (e.target.closest('a[data-id], a[data-thing]')) closeAway(); });   // off to see who it was

// ------------------------------------------------------------------ the loop

function flushEvents() {
  for (const e of world.events) handleEvent(e);
  world.events.length = 0;
}

function randomSeed() { return Math.floor(Math.random() * 1e6); }

function newWorld(seed, arrival = false) {
  showWorld(S.createWorld(seed, LAB ? { terrain, drawn, rabbits: 0, foxes: 0, bees: 0 } : { terrain, drawn, arrival }));
  const big = [world.waters.find(v => v.kind === 'river'), world.lake].filter(Boolean).map(v => `<b>${v.name}</b>`);
  const by = big.length ? ' by ' + big.join(' and ') : '';
  addNews(arrival ? `🌱 A new meadow${by}. Nobody lives here yet.`
    : `🌱 A new meadow${by}. <b>${world.count.rabbit} rabbits</b> and <b>${world.count.fox} foxes</b> have just moved in.`);
  if (!LAB) history.replaceState(null, '', meadowLink(seed));
}

// Everything a meadow needs to be the one on screen, a new one or a kept one (resumeWorld).
function showWorld(w) {
  world = w;
  const seed = w.seed;
  intro.family = [];
  groundSeed = [(seed % 97) * 3.7, (seed % 89) * 4.3];
  Object.assign(ui, { selectedId: 0, picked: null, hoverId: 0, follow: false, trail: [], effects: [], zaps: [], lastNews: {}, newsLog: [], naming: 0 });
  pollen.until = 0; pollen.t0.fill(-1e9);
  ui.records = perKind(s => world.count[s]);
  ui.crashSaid = perKind(() => -1);
  ui.seenHistory = 0;
  const mix = Object.fromEntries(Object.keys(S.WEATHER).map(k => [k, k === world.weather.kind ? 1 : 0]));
  Object.assign(ui.sky, { mix, tick: world.tick, bolts: [], rainbow: 0 });
  showSkyLock();
  $('#news').innerHTML = '';
  renderNewsLog();
  cam.zoom = minZoom; cam.x = S.W / 2; cam.y = S.H / 2; cam.goal = null;
  clampCam();
  paintTerrain();
  renderInspector();
  updateMeadowCard();
  if (ui.stats.open) renderStats();
  if (webOpen()) updateWeb();
  if (yoursOpen()) renderYours();
}

let last = performance.now(), acc = 0, lastCard = 0, lastRecord = 0, lastStatsCards = 0;
const TERRAIN_MS = 250;                   // real time between hand-overs of the grass to the ground (painting grass skips the wait)
// The most real time the sim gets in a frame. A slow phone at 60x would rather run a little slower
// than drop frames: the ticks that don't fit are let go, and don't pile up for the next frame.
const SIM_MS = 6;

// Paused, the world stands still, but the water, the weather and the trees still move a little:
// 30 frames a second are plenty for that, unless you're looking around or something is happening.
const RESTING_MS = 30, WOKEN_MS = 500;
let lastDrawn = 0, lastInput = 0;
const camWas = { x: 0, y: 0, zoom: 0 };
for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize']) addEventListener(type, () => { lastInput = performance.now(); }, { passive: true });
function resting(now) {
  const still = cam.x === camWas.x && cam.y === camWas.y && cam.zoom === camWas.zoom;
  camWas.x = cam.x; camWas.y = cam.y; camWas.zoom = cam.zoom;
  return still && ui.speed === 0 && !intro.on && !LAB && !ui.effects.length && !held && !falls.size
    && now - lastInput > WOKEN_MS && now - ui.sky.boom > WOKEN_MS;
}

function frame(now) {
  if (opening === 1) opening = 2;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (intro.on) introFrame(now, dt);

  if (away.on) awayFrame();
  else if (ui.speed > 0) {
    strikeZaps(now);
    acc += dt * TICKS_PER_SECOND * ui.speed;
    const n = Math.min(Math.floor(acc), 2000), t0 = performance.now();
    acc -= n;
    for (let i = 0; i < n; i++) {
      S.step(world);
      if (world.events.length) flushEvents();
      if ((i & 7) === 7 && performance.now() - t0 > SIM_MS) break;
    }
  }
  if (ui.newsStale && ui.newsOpen) renderNewsLog();
  updateSky();

  const sel = world.byId.get(ui.selectedId);
  if (sel && sel.alive && !sel.hidden) {
    const lastPt = ui.trail[ui.trail.length - 1];
    if (!lastPt || Math.hypot(lastPt.x - sel.x, lastPt.y - sel.y) > 0.5) {
      ui.trail.push({ x: sel.x, y: sel.y });
      if (ui.trail.length > 160) ui.trail.shift();
    }
  }
  if (held) heldFrame(dt);
  if (sel && ui.follow) {
    const k = 1 - Math.pow(0.001, dt);
    const gx = sheet ? sel.x + (sheet.right - sheet.left) / 2 / cam.zoom : sel.x;
    const gy = sheet ? sel.y + (sheet.bottom - sheet.top) / 2 / cam.zoom : sel.y;
    cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k;
  }
  if (idle.on) idleFrame(now, dt);
  if (flick.vx || flick.vy) {             // a flicked pan glides to a stop
    cam.x -= flick.vx * dt / cam.zoom; cam.y -= flick.vy * dt / cam.zoom;
    const f = Math.pow(0.02, dt);
    flick.vx *= f; flick.vy *= f;
    if (Math.abs(flick.vx) + Math.abs(flick.vy) < 20) flick.vx = flick.vy = 0;
  }
  if (cam.goal) {
    const k = 1 - Math.pow(0.01, dt);
    cam.zoom += (cam.goal - cam.zoom) * k;
    if (Math.abs(cam.goal - cam.zoom) < 0.05) cam.goal = null;
    cam.zoom = Math.max(cam.zoom, fitZoom);
  }
  clampCam();

  const rest = resting(now) && now - lastDrawn < RESTING_MS;
  if (!rest && !(away.on && away.frames > 1) && !ui.stats.open && canvas.width && canvas.height) {   // the stats page covers the meadow; a hidden tab can have no size
    lastDrawn = now;
    // Every 12 ticks, and no more than a few times a second: grass changes too slowly to see the difference.
    if (terrainTick < 0 || (world.tick - terrainTick >= 12 && now - terrainAt >= TERRAIN_MS)) paintTerrain();
    render(now);
    if (lab?.draw) lab.draw(ctx, dpr);
  }

  if (now - lastCard > 250) {
    askTick(Math.min(now - lastCard, 1000));
    guideTick(now);
    lastCard = now;
    if (idleMayStart(now)) startIdle(now);
    if (idle.on && Date.now() - keptWhen > KEEP_IDLE_MS) keepMeadow();
    updateMeadowCard();
    if (ui.sound) {
      const ck = S.clock(world);
      const life = world.count.rabbit / (S.CROWDED * world.room);   // a crowded meadow, not the cap (only a safety net now)
      Sound.update({ phase: ck.phase, season: ck.season, speed: ui.speed, sky: ui.sky.mix, fire: world.burning.length, bees: beesOnScreen(), life, owls: world.count.owl || 0,
        frogs: world.spawnCount > 0 && ck.season === 0 ? Math.min(1, world.spawnCount / 300) : 0 });
    }
    // Not under the mouse or a finger: a rebuilt button would swallow the click. (A finger leaves :hover stuck.)
    if ((ui.selectedId || ui.picked) && !pressing && !(canHover.matches && $('#inspector').matches(':hover'))) renderInspector();
    if (ui.stats.open) { $('#stats-clock').textContent = `${S.SEASONS[S.seasonOf(world.tick)].emoji} ${when(world.tick)}`; drawStatsChart(); }
  }
  if (ui.stats.open && now - lastStatsCards > 1000 && !$('#stats-cards').matches(':hover')) {
    lastStatsCards = now;                // not while hovering: a rebuilt link would swallow the click
    renderStatsCards();
  }
  if (webOpen() && now - web.at > 1000) { web.at = now; updateWeb(); }
  if (yoursOpen() && now - yours.at > 1000) { yours.at = now; renderYours(); }
  if (world.history.t.length !== lastRecord) { lastRecord = world.history.t.length; checkPopulationNews(); }
  if (opening > 1 && ++opening > 4) cleared();       // a kept meadow that opened fine
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ the terrain lab
//
// What terrain-lab.js needs from the game: swap in a meadow without the fuss of a new game
// (same camera, same grain, no news), show it in any season, and draw over it every frame.
const lab = LAB ? {
  meadow(seed, t, d) {
    terrain = t; drawn = d;
    world = S.createWorld(seed, { terrain, drawn, rabbits: 0, foxes: 0, bees: 0 });
    paintTerrain();
  },
  season(s) {                                          // midday, halfway through it; snow in winter
    world.tick = Math.round((s * S.SEASON_DAYS + 2 + 0.3) * S.TPD);
    world.snow = s === 3 ? 0.75 : 0; world.ice = s === 3 ? 1 : 0;
    S.settleWater(world);                              // and the water where it stands then
    pond = null;
    paintTerrain();
  },
  toScreen, toWorld, clampCam,
  get minZoom() { return minZoom; },
  cover: { bottom: 0, right: 0 },                      // screen pixels the lab's panel hides, so you can look past them
  shot: copyMeadow,
  draw: null,                                          // (ctx, dpr, shot): drawn over the meadow; no pen in a shot
} : null;

// ------------------------------------------------------------------ start

const refit = () => { resize(); if (ui.stats.open) renderStats(); };
window.addEventListener('resize', refit);
// Turning a phone, iOS fires 'resize' before the page is laid out again, so the canvas still has its
// old size and would be stretched to the new one. Watch the canvas itself for when it really changes.
new ResizeObserver(() => { if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) refit(); }).observe(canvas);
resize();
const seedParam = +params.get('seed');
let seen = false;
try { seen = localStorage.getItem('aeon-garden-welcomed') === '1'; } catch (e) { /* private window */ }
const firstVisit = !LAB && (!seen || params.has('intro'));   // ?intro plays it again
// The kept meadow if there is one (keeping the meadow, above), else a new one. The rest below doesn't wait for it.
function begin(rec) {
  const back = rec && resumeWorld(rec);
  if (!back) newWorld(seedParam || randomSeed(), firstVisit);
  if (rec && !back) addNews("🌱 Your meadow couldn't come along into this version of the game, so here is a new one.");

  if (LAB) {
    document.body.classList.add('lab');
    setSpeed(0);
    const js = document.createElement('script');
    js.src = 'terrain-lab.js';
    document.body.append(js);
  } else if (firstVisit) {
    $('#welcome').classList.remove('hidden');
    hush(true);                                         // nothing to count yet: the bars and cards wait
    setSpeed(0);
    if (world.family && !calm) introShot();
  } else { homeTip(30000); setTimeout(() => startGuide(false), 2500); }
  if (back && !rec.paused && Date.now() - rec.at > AWAY_MIN) startAway();
  requestAnimationFrame(frame);
}
(firstVisit || LAB ? Promise.resolve(null) : keptMeadow(seedParam)).then(begin);
if (!LAB) keepDb().catch(() => { /* not kept, then */ });   // opened now, so keeping at the last moment needn't wait for it
showHomeItem();
if (canShare) $('[data-act="copy-link"] .l').innerHTML = 'Share<span class="x"> this meadow</span>';
if (!IDEAS_KEY) $('[data-act="ideas"]').remove();
$('#go').addEventListener('click', () => {
  const card = $('#welcome');
  card.classList.add('leaving');
  setTimeout(() => card.classList.add('hidden'), 700);
  try { localStorage.setItem('aeon-garden-welcomed', '1'); } catch (e) { /* fine */ }
  if (world.family && !calm) startIntro();
  else { hush(false); setSpeed(1); welcomeTips(); }
});

// Sound stays off until you turn it on, and remembers your choice. Browsers only let a page
// make sound after a click or key press, so a remembered "on" waits for the first one.
try { if (localStorage.getItem('aeon-garden-sound') === '1') toggleSound(true); } catch (e) { /* fine */ }

// The card remembers being small. A phone starts it small, there's not much room up there.
let mini = narrow();
try { const m = localStorage.getItem('aeon-garden-mini'); if (m) mini = m === '1'; } catch (e) { /* fine */ }
if (mini) toggleMini(true);

// The animal tools remember how many they release at a time.
try {
  const g = JSON.parse(localStorage.getItem('aeon-garden-group') || '{}');
  for (const k of S.KINDS) if (GROUPS.includes(g[k])) ui.group[k] = g[k];
} catch (e) { /* fine */ }
showGroup();
setTimeout(() => { barNear = false; updateBar(); }, 4000);   // show the toolbar for a moment, then let the meadow breathe
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (ui.sound) Sound.start(); }, { once: true });

window.garden = { get world() { return world; }, ui, cam, lab, installed,   // handy in the console
  get trees() { return { worker: !!treeWorker, workers: treeWorkers.length, art: treeArt, bytes: treeBytes, asked: treeAsked.size, busy: treeBusy }; } };
})();
