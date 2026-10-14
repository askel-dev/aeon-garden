/* Nobody's Meadow — everything you see and click. The simulation lives in sim.js. */
(() => {
'use strict';
const S = window.Sim;
const Fur = window.Fur;                 // the painted foxes and rabbits, and the drawing helpers every painting here uses
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, blurIn, softIn, furGlow, foxRGB, FOX_WHITE, FOX_SOCK, FOX_POSE, RABBIT_POSE, RABBIT_KINDS } = Fur;
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const TICKS_PER_SECOND = 30;           // at 1x

// ------------------------------------------------------------------ state

const params = new URLSearchParams(location.search);
const meadowLink = seed => '?seed=' + seed;   // the address of a meadow, and the name it's kept under

// How many people come, and from where, counted by GoatCounter (goatcounter.com: free, no cookies,
// nothing to agree to). Off until COUNTER holds the site's code: sign up there, pick a code, put it
// here. A link posted as meadow.cryptoler.net/?ref=reddit is counted as coming from "reddit". The
// counter looks at the address a moment after the game has made it ?seed=.., so it's told the page
// and where they came from here. Every visit is the one page, whichever meadow it opens: /meadow, as
// the one counter may count cryptoler.net's own pages too.
const COUNTER = 'cryptoler';               // cryptoler.goatcounter.com
if (COUNTER && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.goatcounter = { path: '/meadow', referrer: params.get('ref') || params.get('utm_source') || document.referrer };
  const js = document.createElement('script');
  js.async = true; js.src = 'https://gc.zgo.at/count.js';
  js.dataset.goatcounter = `https://${COUNTER}.goatcounter.com/count`;
  document.head.append(js);
}


let world;
const ui = {
  speed: 1, sound: false, selectedId: 0, picked: null, hoverId: 0, follow: false,
  trail: [], effects: [], allTraits: false, allStory: false, sheetUp: false,
  sky: { mix: {}, tick: 0, bolts: [], boom: -1e9, rainbow: -1e9, bowEnd: -1e9 },
};
const cam = { x: S.W / 2, y: S.H / 2, zoom: 10, goal: null };

// ------------------------------------------------------------------ canvas and camera

const canvas = $('#world');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0, dpr = 1, minZoom = 1, fitZoom = 1;
const FIT = 0.92;                                 // zoomed right out, how much of the window the meadow fills (it fades into mist, mistField)
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
  measureSheet();
}

// On a phone the inspector is a sheet over the bottom of the meadow, or on its side a panel down the
// right. The one you follow is kept in the middle of what's still showing, instead of under the panel.
function measureSheet() {
  const ins = $('#inspector').getBoundingClientRect();
  if (!ins.height) sheet = null;
  else if (narrow() && !short()) {
    const top = $('#hud-right .hud-top').getBoundingClientRect().bottom;
    sheet = { top, bottom: vh - ins.top, left: 0, right: 0 };
  } else sheet = short() ? { top: 0, bottom: 0, left: 0, right: $('#inspector').classList.contains('strip') ? 0 : vw - ins.left } : null;
}

// You may look out past the edges into the mist: the middle of the view goes as far as the mist is thick
// (MIST_FULL tiles out), at any zoom, so an edge can be looked at up close.
// A bit further where the inspector covers the screen, so nothing is ever stuck under it. This far past the bottom
// edge, in screen pixels.
const lookPast = () => (sheet ? sheet.bottom : 0);
function clampCam() {
  const left = (sheet ? sheet.left : 0) / cam.zoom, right = (sheet ? sheet.right : 0) / cam.zoom;
  cam.x = clamp(cam.x, -MIST_FULL - left, S.W + MIST_FULL + right);
  cam.y = clamp(cam.y, -MIST_FULL, S.H + MIST_FULL + lookPast() / cam.zoom);
}

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
const ZOOM_STRETCH = 1.4;           // while the zoom moves, a sprite painted within this of the size it's drawn at will do

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
// A fox or a rabbit changes pose as it goes, so each size it's drawn at takes a dozen paintings, and the young grow
// through sizes all the time: their sprites come in steps of about 19%, the size above, drawn a little smaller. Below
// the size they're painted at (shrunk) they're tiny and many, so one size an octave does, drawn up to half as big.
const poseStep = px => px < FUR_PAINTED / dpr ? 2 ** Math.ceil(Math.log2(px)) : Math.ceil(2 ** (Math.ceil(Math.log2(px) * 4) / 4));
const posed = art => isFur(art) || art.startsWith('hog:') || art.startsWith('heron:');
function sprite(emoji, want, tint, leaf, center) {
  want = Math.max(4, want);
  const px = posed(emoji) ? poseStep(want) : spriteStep(want), s = paintedSprite(emoji, px, tint, leaf, center);
  return want === px ? s : { canvas: s.canvas, size: s.size * want / px };
}
const lookKey = (emoji, tint, leaf, center) => emoji + '|' + (tint || '') + '|' + (leaf ? leaf.key : '') + (center ? '|c' : '');
// A plain sprite's look and its key at each size (no tint, leaf or centring: nearly all of them), kept, so finding one
// builds no names: building them and hashing them each time was most of what it cost to find a sprite.
const plainKeys = new Map(), leafKeys = new WeakMap();   // emoji -> { look, at: px -> key }; and the same for each leaf
function plainLook(emoji, leaf) {
  let keys = plainKeys;
  if (leaf) { keys = leafKeys.get(leaf); if (!keys) leafKeys.set(leaf, keys = new Map()); }   // (a leaf is kept as it is: SHORE_LOOKS, a tree's look)
  let k = keys.get(emoji);
  if (!k) keys.set(emoji, k = { look: lookKey(emoji, '', leaf, false), at: new Map() });
  return k;
}
function plainKey(k, px) {
  let key = k.at.get(px);
  if (key === undefined) { if (k.at.size > 64) k.at.clear(); k.at.set(px, key = px + '|' + k.look); }   // (zooming about makes sizes without end)
  return key;
}
// Whether drawEmoji would find this one painted already.
const spriteReady = (emoji, want, leaf) => spriteCache.has((posed(emoji) ? poseStep : spriteStep)(Math.max(4, want)) + '|' + lookKey(emoji, '', leaf));
function paintedSprite(emoji, px, tint, leaf, center) {
  const plain = !tint && !center && plainLook(emoji, leaf);
  const look = plain ? plain.look : lookKey(emoji, tint, leaf, center);
  const key = plain ? plainKey(plain, px) : px + '|' + look;
  let s = spriteCache.get(key);
  if (s) { s.used = spriteFrame; return s; }
  // Zooming asks for every tree on screen at a new size in the same frame. Past a few ms of
  // painting, the same look at another size stands in, stretched, and the rest are painted over
  // the next frames. While the zoom moves, one within ZOOM_STRETCH of the size stands in anyway, and it's painted
  // sharp once the zoom comes to rest (groundStill), as a rock is: zooming painted dozens of sprites a second.
  const near = standIns && latestLook.get(look);
  if (near && (paintedMs > PAINT_MS || groundStill < 2 && near.px > px / ZOOM_STRETCH && near.px < px * ZOOM_STRETCH)) {
    near.used = spriteFrame; return { canvas: near.canvas, size: near.size * px / near.px };
  }
  // A fox's or a rabbit's painting comes from the worker (furReady asks for it): meanwhile the same at another size
  // stands in, or one of its kin. Only the first of a look is painted here.
  if (furWorker && standIns && !tint && !leaf && !center && isFur(emoji) && !furReady(emoji, px)) {
    const kin = latestLook.get(look) || furKin(emoji);
    if (kin) { kin.used = spriteFrame; return { canvas: kin.canvas, size: kin.size * px / kin.px }; }
  }
  const t0 = performance.now();
  const size = Math.ceil(px * 1.3 * dpr);
  if (spriteCache.size > 2000 || spriteBytes + size * size * 4 > SPRITE_BYTES) dropSprites(size * size * 4);
  spriteBytes += size * size * 4;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // Repainting and centring read the pixels back: from a canvas on the GPU that waits for it, 5-30 ms a sprite.
  // Painted things ('reeds:0', 'lily:2', 'bubble:5': PAINTERS) are painted in their colours, never read back.
  const colon = emoji.indexOf(':'), art = colon > 0 && PAINTERS[emoji.slice(0, colon)];
  const g = c.getContext('2d', !art && (leaf || center) && { willReadFrequently: true });
  if (art) {
    const was = standIns;
    standIns = false;                                  // (what it's made from is never a stand-in)
    art(g, size, px * dpr, +emoji.slice(colon + 1), leaf);
    standIns = was;
  }
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
  const s = sprite(emoji, px, opts.tint, opts.leaf, opts.center);
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

// Rabbit coats (the genes are in the sim). Wild coats are agouti: each hair banded, so speckled. n: its paintings (paintRabbit).
const COAT = {
  wild: { key: 'wild', rgb: S.COATS.wild.rgb, speckle: 0.35, swatch: '#96724f', n: 0 },
  black: { key: 'black', rgb: S.COATS.black.rgb, speckle: 0, swatch: '#3e3838', n: 10 },
  sand: { key: 'sand', rgb: S.COATS.sand.rgb, speckle: 0.3, swatch: '#d4b280', n: 5 },
  blue: { key: 'blue', rgb: S.COATS.blue.rgb, speckle: 0, swatch: '#808696', n: 15 },
};
const coatLook = c => c.genes.coat ? COAT[S.coatOf(c.genes)] : undefined;
const furCoats = () => RABBIT_KINDS.map(k => ({ rgb: S.COATS[k].rgb, speckle: COAT[k].speckle }));   // for fur.js
Fur.setCoats(furCoats(), S.WINTER_COAT);
// In winter a coat pales toward white, in a few steps (0 to 4) to keep the sprite cache small.
const whiteStep = c => Math.round(S.whiteness(world, c) * 4);

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

// The animal for the inspector, painted as in the meadow, drawn once per look.
const portraits = new Map();
function portraitHTML(c) {
  const art = c.alive && (c.species === 'fox' ? foxArtOf(c.genes.fur, 'stand') : c.species === 'rabbit' ? rabbitArtOf(coatLook(c), 'sit', whiteStep(c))
    : { crow: CROW_ARTS[0], otter: OTTER_ARTS[3], bee: 'bee:2' }[c.species]);
  if (!art) return c.alive ? c.sp.emoji : '👻';
  if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
  return `<img src="${portraits.get(art)}" alt="${c.sp.emoji}">`;
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

const FLAT_WATER = [110, 175, 215];                // (no WebGL: the water's flat colour)
function paintTerrain() {
  const g = world.grass, water = world.water, [low, high] = groundColours(), damp = 1 - 0.12 * world.wet;
  shoreSand = low.map(v => v * 0.9 * damp);
  let sum = 0;
  const ok = Ground.ok, fieldAt = world.fieldAt, fields = world.fields, wood = world.wood, deep = S.DEEP;
  for (let i = 0; i < g.length; i++) {
    let v = water[i] ? 0 : clamp(g[i] / 0.85, 0, 1);
    v = v * (2 - v);
    const o = i * 4, fi = fieldAt[i], f = fi >= 0 ? fields[fi] : null;
    const bloom = f ? S.fieldBloom(world, f, i, v) : 0;
    tileData[o] = v; tileData[o + 1] = water[i] / deep; tileData[o + 3] = wood[i];
    for (let k = 0; k < 3; k++) bloomData[o + k] = bloom > 0 ? f.tint[k] / 255 * bloom : 0;   // premultiplied, so it blends smoothly between tiles
    bloomData[o + 3] = bloom;
    sum += v;
    if (!ok) {
      for (let k = 0; k < 3; k++) flatImg.data[o + k] = water[i] ? FLAT_WATER[k] : lerp(low[k], high[k], v) * damp;
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
// of the ground took most of them.
// Safari (and every browser on an iPhone: they're all WebKit) misses a frame each time it repaints a big
// ground, however cheap the shader: on a MacBook at 2x, five times a second at 1x speed. There the ground
// is kept to GROUND_WEBKIT pixels, but never below 1x. A phone's small screen stays at 2x.
const GROUND_DPR = 2, GROUND_WEBKIT = 1.5e6;
// At 15x and 60x the light, the mist's colour, the wet and the season move every frame, too little a frame to see: what
// only moves with them is painted at most every GROUND_HOLD ms (a full-screen shader, two frames in three at 60x).
const GROUND_HOLD_SPEED = 15, GROUND_HOLD = 100;
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\//.test(navigator.userAgent);
const groundLayer = Ground.ok ? Ground.canvas : null, laid = { w: 0, h: 0, x: 0, y: 0 };
if (groundLayer) { groundLayer.id = 'ground'; canvas.before(groundLayer); }
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
    light: goldLight(shownGold(ck.phase)),
    snow: world.snow, damp: 1 - 0.12 * world.wet, ice: iceOver(), cold: coldness(), lx: k * sn.lean, ly: k * 0.8,
    hold: ui.speed >= GROUND_HOLD_SPEED ? GROUND_HOLD : 0,   // (at speed the light and the colours may wait a moment: ground.js steady)
  });
  const g = Ground.canvas, cw = g.width / gd, ch = g.height / gd, x = shx - Ground.view.x / gd, y = shy - Ground.view.y / gd;
  if (cw !== laid.w || ch !== laid.h) { g.style.width = cw + 'px'; g.style.height = ch + 'px'; laid.w = cw; laid.h = ch; }
  if (x !== laid.x || y !== laid.y) { g.style.transform = `translate(${x}px, ${y}px)`; laid.x = x; laid.y = y; }
}

// Past its edges the meadow fades into a mist, thick by MIST_FULL tiles out. Where it starts wavers a long way in
// and out (MIST_WAVER), from MIST_IN tiles in, and its corners are round (MIST_ROUND), so the meadow never reads as
// a rectangle. How thick it is everywhere is worked out once, MIST_PX a tile (mist.field), and the ground shader
// paints the ground into it from that, in big pale clouds, while whatever stands in it is drawn that much
// see-through (fadeAt), so the trees and the animals fade into it too. Nothing is laid over the meadow for it.
// In the golden hour the mist takes a rose light, and at night it's painted lighter, so that under the dark it comes
// out a lavender light instead of a muddy grey (fogColour).
const MIST_RGB = [230, 231, 214], MIST_TINT = 0.12, MIST_SNOW = [238, 242, 246];   // and white over the snow
const MIST_DUSK = [240, 176, 160], MIST_NIGHT = [124, 118, 176];
const MIST_IN = 6, MIST_FULL = 4, MIST_OUT = 10, MIST_PX = 3, MIST_ROUND = 14;
const MIST_WAVER = 8;                             // tiles the edge wavers in and out, all told
const MIST_DEEP = MIST_IN + MIST_WAVER / 2 + 2;   // further in than this there's none, wherever a bank of it rolls in
const NIGHT_RGB = [12, 20, 90];   // the dark, washed over everything
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
// The mist's colour for the shader. In the golden hour and at night it's what, lit by the shader's light and washed
// over by the dark, comes out as the mist in the warm light with a rose glow (MIST_DUSK) in it, and a lavender light
// (MIST_NIGHT) over it at night.
const MIST_GLOW = 0.25;                           // how much rose in the golden hour's mist
const over = (c, rgb, a) => c.map((v, i) => v + (rgb[i] - v) * a);
function fogColour(high, phase) {
  const fog = MIST_RGB.map((v, i) => lerp(lerp(v, high[i], MIST_TINT), MIST_SNOW[i], Math.min(1, world.snow)));
  const d = shownDark(phase), k = shownGold(phase), lit = goldLight(k);
  if (d <= 0 && k <= 0) return fog.map(v => Math.round(v / 4) * 4);
  const seen = over(over(over(fog.map((v, i) => v * lit[i]), MIST_DUSK, MIST_GLOW * k), NIGHT_RGB, d), MIST_NIGHT, 0.7 * d);
  return seen.map((v, i) => Math.round(clamp((v - NIGHT_RGB[i] * d) / (1 - d) / lit[i], 0, 255) / 4) * 4);   // (each step paints the ground again)
}

// While fade is below 1, everything drawn is that much see-through, whatever alpha its drawing sets: a thing
// standing in the mist is faded into it (fadeAt), and unfade() puts it back.
// The canvas's own alpha is kept here too (alphaNow), so a set that wouldn't change it (most of the thousands a frame:
// back to 1 after a drawing, then 1 again before the next) never reaches the canvas. A restore() brings back an alpha
// of its own, a new canvas size (resize, the photo) starts it afresh (render reads it again), and the canvas ignores
// one outside 0..1, as this does.
let fade = 1;
const ALPHA = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
let alphaNow = ALPHA.get.call(ctx);
Object.defineProperty(ctx, 'globalAlpha', {
  get() { return alphaNow / fade; },
  set(v) { const a = v * fade; if (a !== alphaNow && a >= 0 && a <= 1) { alphaNow = a; ALPHA.set.call(ctx, a); } },
});
const RESTORE = ctx.restore;
ctx.restore = () => { RESTORE.call(ctx); alphaNow = ALPHA.get.call(ctx); };
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
  if (plantKeysWorld !== world || plantKeys.length !== world.plants.length) {   // (a new world)
    plantKeys = new Int32Array(world.plants.length); plantArt = new Int32Array(world.plants.length);
    plantKeysWorld = world; plantKeysTick = -2;          // (not -1: that's terrainTick while the ground waits to be painted again)
  }
  if (plantKeysTick === terrainTick && plantKeysZoom === z && plantKeysDpr === dpr) return;
  plantKeysTick = terrainTick; plantKeysZoom = z; plantKeysDpr = dpr;
  for (let i = 0; i < world.plants.length; i++) {
    const p = world.plants[i], l = plantLook(p, season, z);
    const art = l ? flowerArt(l.e, season) : -1;
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
// Flowers are painted like the rocks: a clump of a few on their stems, with leaves at the foot and
// a soft shadow under it, in a few variants of each kind so a field isn't one stamp over and over.
// Each look is painted once per size, in half-octave steps, and stretched to the size each plant is
// drawn at. The rest of the ground cover goes the same way: tufts, sprouts, fallen leaves, seed heads
// and frosted tufts in winter.

const FLOWER_ARTS = [paintTulips, paintBlossom, paintButtercups, paintSunflowers, paintBluebells, paintHeather, paintAsters,
  paintTuft, paintTuftAutumn, paintSprout, paintFallenLeaves, paintSeedHeads, paintTuftFrost];   // (7 to 12: the ground cover)
const FLOWER_VARIANTS = 5;
const FLOWER_BOX = [1.6, 1.8], FLOWER_FOOT = 0.82;   // a sprite in plant sizes, and where the ground is in it, from the top
const FLOWER_MAX_K = 15;                            // painted at most 2^7.5 = 181 px a plant, stretched past that
const flowerSprites = new Map();
let flowerBytes = 0;

// Which painting each plant the sim names gets (-1: none). The season tells the spring bluebells from
// the autumn heather, a spring blossom from an autumn aster, and a green tuft from a tawny one.
function flowerArt(e, season) {
  switch (e) {
    case '🌷': return 0;
    case '🌸': return season === 2 ? 6 : 1;
    case '🌼': return 2;
    case '🌻': return 3;
    case '🪻': return season === 2 ? 5 : 4;
    case '🌿': return season === 2 ? 8 : 7;
    case '🌱': return 9;
    case '🍂': return 10;
    case '🌾': return 11;
    case '❄️': return 12;
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

// The ground cover: grass blades shaded from a dark foot to a light tip (each one a gradient, fine as
// it's painted once a size), fallen leaves lying flat, seed heads nodding over.
const GRASS = [[[62, 112, 42], [128, 182, 70]], [[58, 106, 40], [116, 172, 62]], [[66, 118, 46], [140, 190, 78]], [[54, 100, 38], [108, 164, 58]], [[70, 120, 44], [134, 186, 74]]];
const GRASS_AUTUMN = [[[96, 100, 44], [190, 170, 86]], [[104, 96, 46], [200, 164, 84]], [[90, 102, 46], [176, 168, 90]], [[110, 100, 50], [206, 176, 98]], [[96, 96, 44], [184, 158, 80]]];
const GRASS_FROST = [[112, 92, 60], [196, 172, 120]], FROST = [248, 250, 255];
function grassBlade(g, x, len, lean, w, dark, light, tip) {
  const gr = g.createLinearGradient(0, 0, lean * 0.5, -len);
  gr.addColorStop(0, rockRGB(dark)); gr.addColorStop(tip ? 0.7 : 1, rockRGB(light));
  if (tip) gr.addColorStop(1, rockRGB(tip));
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, 0);
  g.quadraticCurveTo(x - w * 0.5 + lean * 0.2, -len * 0.55, x + lean, -len);
  g.quadraticCurveTo(x + w * 0.5 + lean * 0.5, -len * 0.5, x + w, 0); g.closePath(); g.fill();
}
// n blades fanned out from the foot, h tall in the middle and shorter to the sides, the ones behind darker.
function tuftAt(g, r, n, h, spread, cols, w, tip, seed = 0) {
  const blades = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) * 2 - 1;
    blades.push({ x: t * spread * 0.22 + (r(80 + i + seed) - 0.5) * 0.05, lean: t * spread + (r(90 + i + seed) - 0.5) * 0.14,
      len: h * (1 - 0.4 * t * t) * (0.72 + 0.28 * r(100 + i + seed)), back: r(110 + i + seed) });
  }
  blades.sort((a, b) => a.back - b.back);
  for (const b of blades) { const k = 0.78 + 0.32 * b.back; grassBlade(g, b.x, b.len, b.lean, w, tone(cols[0], k), tone(cols[1], k), tip); }
}
function paintTuft(g, r, v) { tuftAt(g, r, 7 + v % 3, 0.74, 0.46, GRASS[v], 0.055); }
function paintTuftAutumn(g, r, v) { tuftAt(g, r, 7 + v % 3, 0.68, 0.5, GRASS_AUTUMN[v], 0.052); }
function paintTuftFrost(g, r, v) {                   // dry and standing, white with frost at the tips, snow at its foot
  tuftAt(g, r, 6 + v % 3, 0.6, 0.34, GRASS_FROST, 0.05, FROST);
  softIn(g, [236, 242, 248], -0.1, 0.04, () => ovalAt(g, 0, -0.015, 0.2, 0.065), 1.05, 0.78);
}
// A seedling just up: two round seed leaves on a short stem, in the soil it broke (and a first true leaf, sometimes).
function paintSprout(g, r, v, bold, sw) {
  g.scale(1.6, 1.6); sw /= 1.6;
  softIn(g, [120, 86, 54], -0.06, 0.04, () => ovalAt(g, 0, 0, 0.17, 0.05), 1.15, 0.75);
  const x = (r(2) - 0.5) * 0.06, y = -0.2 - 0.06 * r(1);
  flowerStem(g, x, y, 0.01, Math.max(sw, 0.035), [112, 168, 64]);
  for (const s of [-1, 1]) {
    softIn(g, s < 0 ? [96, 160, 56] : [120, 182, 68], y - 0.08, y + 0.05, () => {
      g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.06, y - 0.12, x + s * 0.17, y - 0.07); g.quadraticCurveTo(x + s * 0.14, y + 0.02, x, y);
    }, 1.2, 0.8);
  }
  if (v > 2) softIn(g, [132, 190, 76], y - 0.14, y, () => ovalAt(g, x, y - 0.06, 0.03, 0.06), 1.2, 0.8);
}
const LEAF_FALL = [[212, 116, 38], [180, 72, 36], [206, 158, 56], [152, 96, 50], [226, 140, 44], [168, 120, 52]];
// A leaf lying in the grass, seen from a little above (squashed): pointed, or a maple's five lobes.
function lyingLeaf(g, x, y, s, a, rgb, maple) {
  g.save(); g.translate(x, y); g.scale(1, 0.55); g.rotate(a);
  const shape = () => {
    if (maple) for (let i = 0; i < 5; i++) {
      const b = -Math.PI / 2 + (i - 2) * 0.75;
      g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(b - 0.3) * s * 0.7, Math.sin(b - 0.3) * s * 0.7, Math.cos(b) * s, Math.sin(b) * s);
      g.quadraticCurveTo(Math.cos(b + 0.3) * s * 0.7, Math.sin(b + 0.3) * s * 0.7, 0, 0);
    }
    else { g.moveTo(-s, 0); g.quadraticCurveTo(-s * 0.2, -s * 0.55, s, 0); g.quadraticCurveTo(-s * 0.2, s * 0.55, -s, 0); }
  };
  fillIn(g, rockRGB(tone(rgb, 0.45), 0.35), () => { g.translate(0.01, 0.025); shape(); g.translate(-0.01, -0.025); });   // its shadow
  softIn(g, rgb, -s * 0.5, s * 0.5, shape, 1.2, 0.72);
  strokeIn(g, rockRGB(tone(rgb, 0.62)), 0.012 + s * 0.03, () => { if (maple) { g.moveTo(0, s * 0.25); g.lineTo(0, -s * 0.8); } else { g.moveTo(-s * 0.9, 0); g.lineTo(s * 0.9, 0); } });
  g.restore();
}
function paintFallenLeaves(g, r, v) {
  g.scale(1.35, 1.35);
  for (let i = 0, n = 4 + v % 2; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 0.6, y = (r(20 + i) - 0.5) * 0.16 - 0.03;
    lyingLeaf(g, x, y, 0.15 + 0.06 * r(30 + i), r(40 + i) * TAU, LEAF_FALL[(v + i * 2) % LEAF_FALL.length], (v + i) % 3 === 0);
  }
}
const STRAW = [[184, 156, 92], [204, 176, 104], [176, 150, 96], [196, 164, 90], [212, 186, 116]];
// Ripe grass: a few stems over a low tuft, each head arching over from the top of its stem with grains either
// side, smaller towards the tip.
function paintSeedHeads(g, r, v, bold, sw) {
  tuftAt(g, r, 5, 0.36, 0.42, GRASS_AUTUMN[v], 0.045, null, 7);
  const rgb = STRAW[v], stalk = rockRGB(tone(rgb, 0.78));
  for (const h of flowerHeads(r, 3 + v % 2, 0.2, 0.56, 0.78)) {
    const side = h.x < 0 ? -1 : 1, len = 0.3;
    flowerStem(g, h.x, h.y, h.bend, Math.max(sw * 1.4, 0.03), tone(rgb, 0.78));
    const at = t => [h.x + side * len * 0.55 * t, h.y - len * 0.25 * t + len * 0.75 * t * t];
    strokeIn(g, stalk, Math.max(sw, 0.02), () => { g.moveTo(h.x, h.y); for (let t = 0.1; t <= 1.001; t += 0.1) g.lineTo(...at(t)); });
    for (let j = 7; j >= 0; j--) {
      const t = 0.08 + j / 7 * 0.9, [x, y] = at(t), [x2, y2] = at(t + 0.05), a = Math.atan2(y2 - y, x2 - x), s = (1 - 0.45 * t) * bold;
      for (const e of [-1, 1]) {
        const gx = x + Math.cos(a + e * 1.3) * 0.03, gy = y + Math.sin(a + e * 1.3) * 0.03;
        softIn(g, tone(rgb, e < 0 ? 1.05 : 0.9), gy - 0.05, gy + 0.05, () => ovalAt(g, gx, gy, 0.05 * s, 0.028 * s, a + e * 0.5), 1.25, 0.72);
      }
    }
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
function arch(g, w, h, y0) {
  g.moveTo(-w, y0);
  g.bezierCurveTo(-w, y0 - h * 1.33, w, y0 - h * 1.33, w, y0);
  g.quadraticCurveTo(0, y0 + h * 0.2, -w, y0);
}

// The bank, the spilled earth and the way in are painted once (paintBurrow) and stretched to the zoom between its
// sizes, like a sprite: drawn by hand every frame they cost a few gradients and a dozen fills a burrow. How fresh its
// earth is, how long it's been left and how far it's dug go in BURROW_STEPS. The paths worn round it are drawn as ever.
const BURROW_STEPS = 16;
// At speed a burrow's earth fades, the grass takes it back and a dig goes on in steps a frame or two apart, each a painting of
// its own (at 60x a dozen a second a burrow): a step waits till its painting is BURROW_MS old. At 1x they're seconds apart.
const BURROW_MS = 250;
const burrowArt = new WeakMap();                // a burrow's painting: { shape, age, at, canvas, r, w, h } (its middle at w/2, h/2)
function drawBurrow(b, sx, sy, z, season, residents) {
  const rnd = k => burrowRand(b.id, k);
  const r = Math.max(5, z * 0.8) * (0.9 + 0.2 * rnd(0));
  const made = dugAt.get(b), done = b.dug >= 1;
  const fresh = !done ? 1 : made === undefined ? 0 : clamp(1 - (world.tick - made) / (FRESH_DAYS * S.TPD), 0, 1);
  const idle = b.count > 0 ? 0 : (world.tick - b.used) / (S.SEASON_DAYS * S.TPD);   // it falls in at 1
  const neglect = done ? clamp((idle - 0.4) / 0.6, 0, 1) : 0;
  const wear = clamp(residents / 3, 0, 1) * (1 - neglect);

  // Paths worn into the grass by the rabbits who live here.
  if (r >= 9 && wear > 0.05) {
    ctx.save();
    ctx.translate(sx, sy);
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
    ctx.restore();
  }

  const R = spriteStep(r), q = v => Math.round(v * BURROW_STEPS);
  const shape = ((R * 2 + (done ? 1 : 0)) * 4 + season) * 8 + Math.round(dpr * 2), age = (q(fresh) * 17 + q(neglect)) * 17 + q(done ? 1 : b.dug);
  let a = burrowArt.get(b);
  const t0 = performance.now();
  // (While the zoom moves, one only a size off, within ZOOM_STRETCH, will do too: shape's last 64 are all but its size.)
  const zoomed = a && groundStill < 2 && a.shape % 64 === shape % 64 && a.r > r / ZOOM_STRETCH && a.r < r * ZOOM_STRETCH;
  if (!a || (a.shape !== shape || a.age !== age && t0 - a.at >= BURROW_MS) && !(standIns && paintedMs > PAINT_MS) && !zoomed) {   // (painting a lot this frame: the last one stands in)
    if (a) freeImage(a.canvas);
    burrowArt.set(b, a = paintBurrow(b, R, q(fresh) / BURROW_STEPS, q(neglect) / BURROW_STEPS, done ? 1 : q(b.dug) / BURROW_STEPS, season, shape, age));
    a.at = t0;
    paintedMs += performance.now() - t0;
  }
  const k = r / a.r;
  ctx.drawImage(a.canvas, sx - a.w / 2 * k, sy - a.h / 2 * k, a.w * k, a.h * k);
}

// A burrow at r (its size on screen), as fresh, left and dug as that: the low bank the hole goes into, the earth spilled in
// front, and the way in, turned a little, into a canvas of its own.
function paintBurrow(b, r, fresh, neglect, dug, season, shape, age) {
  const rnd = k => burrowRand(b.id, k), done = dug >= 1;
  const pile = done ? 1 : 0.35 + 0.65 * Math.sqrt(dug);           // how much earth is out
  const open = clamp((dug - 0.35) / 0.65, 0, 1);                 // the hole shows once the scrape is deep
  const detail = r >= 9, flip = rnd(1) < 0.5 ? -1 : 1;
  const earth = [lerp(120, 158, fresh), lerp(92, 116, fresh), lerp(58, 70, fresh)];
  const rgba = (c, k, a) => `rgba(${c[0] * k | 0}, ${c[1] * k | 0}, ${c[2] * k | 0}, ${a})`;
  const W = 2.1 * r, H = 1.9 * r;                                // its reach from the middle, turned and all
  const c = document.createElement('canvas');
  c.width = Math.ceil(2 * W * dpr); c.height = Math.ceil(2 * H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, c.width / 2, c.height / 2);
  g.rotate((rnd(2) - 0.5) * 0.25);
  g.lineCap = 'round';

  // The low bank the hole goes into: light on top, a soft shadow along its foot.
  const mh = r * 0.8 * pile, mw = r * 1.3 * pile;
  const foot = g.createRadialGradient(mw * 0.1, 0, mw * 0.5, mw * 0.1, 0, mw * 1.15);
  foot.addColorStop(0, 'rgba(35, 45, 15, 0.3)'); foot.addColorStop(1, 'rgba(35, 45, 15, 0)');
  g.fillStyle = foot;
  g.beginPath(); g.ellipse(mw * 0.1, 0, mw * 1.15, mh * 0.8, 0, 0, TAU); g.fill();
  const lit = g.createRadialGradient(-mw * 0.2, -mh * 0.55, 0, -mw * 0.1, -mh * 0.3, mw * 0.95);
  lit.addColorStop(0, 'rgba(255, 250, 210, 0.42)'); lit.addColorStop(0.6, 'rgba(255, 250, 210, 0.12)');
  lit.addColorStop(1, 'rgba(255, 250, 210, 0)');
  g.fillStyle = lit;
  g.beginPath(); g.ellipse(0, -mh * 0.2, mw * 0.95, mh * 0.66, 0, 0, TAU); g.fill();

  // The spilled earth in front, soft at the edge. Grass takes it back once it's left alone.
  const ea = (done ? lerp(0.5, 0.9, fresh) : 0.9) * (1 - 0.85 * neglect);
  const spoil = s => {
    g.beginPath();
    g.ellipse(flip * r * 0.15, r * 0.55, r * 1.2 * s * pile, r * 0.5 * s * pile, 0, 0, TAU);
    g.ellipse(flip * r * 0.8, r * 0.7, r * 0.55 * s * pile, r * 0.32 * s * pile, 0, 0, TAU);
    g.ellipse(-flip * r * 0.7, r * 0.45, r * 0.45 * s * pile, r * 0.26 * s * pile, 0, 0, TAU);
  };
  g.fillStyle = rgba(earth, 1, ea * 0.35); spoil(1.25); g.fill();
  g.fillStyle = rgba(earth, 1, ea); spoil(1); g.fill();
  if (detail) {
    for (let i = 0; i < 8; i++) {                                    // clods and a pebble or two
      const a = rnd(20 + i) * TAU, d = Math.sqrt(rnd(30 + i)) * pile;
      const x = flip * r * 0.15 + Math.cos(a) * d * r * 1.3, y = r * 0.6 + Math.sin(a) * d * r * 0.55;
      const pebble = i < 2, s = r * (0.05 + 0.06 * rnd(40 + i));
      g.fillStyle = pebble ? `rgba(150, 146, 136, ${ea})` : rgba(earth, 0.7, ea);
      g.beginPath(); g.ellipse(x, y, s * 1.3, s, 0, 0, TAU); g.fill();
    }
  }

  // A half-dug burrow is only a scrape at first.
  if (!done) {
    g.fillStyle = rgba(earth, 0.55, 0.7);
    g.beginPath(); g.ellipse(0, r * 0.2, r * 0.6 * pile, r * 0.25 * pile, 0, 0, TAU); g.fill();
  }

  // The way in: an earth lip, then the dark tunnel, darkest at the back. It sinks as it falls in.
  if (open > 0) {
    const w = r * 0.62 * (0.5 + 0.5 * open), h = r * 0.72 * open * (1 - 0.35 * neglect), y0 = r * 0.28;
    g.fillStyle = rgba(earth, 0.78, 0.95 - 0.35 * neglect);
    g.beginPath(); arch(g, w * 1.25, h * 1.2, y0 + r * 0.06); g.fill();
    g.strokeStyle = `rgba(255, 235, 190, ${0.3 * (1 - 0.5 * neglect)})`;   // the sun on its rim
    g.lineWidth = Math.max(1, r * 0.06);
    g.beginPath(); g.moveTo(-w * 1.2, y0 - h * 0.35);
    g.bezierCurveTo(-w * 1.1, y0 - h * 1.5, w * 1.1, y0 - h * 1.5, w * 1.2, y0 - h * 0.35); g.stroke();
    const dark = g.createLinearGradient(0, y0 - h, 0, y0);
    dark.addColorStop(0, '#0d0906'); dark.addColorStop(0.6, '#1f160f'); dark.addColorStop(1, '#46331f');
    g.fillStyle = dark;
    g.beginPath(); arch(g, w, h, y0); g.fill();

    // Grass on the bank above, leaning out over the rim, more of it the longer it's been left.
    if (detail) {
      const gr = PALETTE[season][1], n = 4 + Math.round(6 * neglect), wl = w * 1.3;
      g.strokeStyle = rgba(gr, 0.66, 0.95); g.lineWidth = Math.max(1, r * 0.055);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * 1.7 + (rnd(50 + i) - 0.5) * 0.25;
        const x = t * wl, top = y0 - h * 1.25 * Math.sqrt(Math.max(0, 1 - t * t)) - r * 0.02;
        const len = r * (0.16 + 0.12 * rnd(60 + i)) * (1 + 0.8 * neglect), out = t * r * 0.25;
        g.moveTo(x, top); g.quadraticCurveTo(x + out * 0.3, top - len * 0.8, x + out, top - len * (0.6 - 0.9 * neglect));
      }
      g.stroke();
    }
  }
  const a = { shape, age, at: 0, canvas: c, r, w: c.width / dpr, h: c.height / dpr };
  asBitmap(c, bm => { if (burrowArt.get(b) === a) { a.canvas = bm; c.width = 0; } else bm.close(); });
  return a;
}

// ------------------------------------------------------------------ drawing

const MOVING = new Set(['wander', 'food', 'flee', 'chase', 'stalk', 'prowl', 'home', 'love', 'follow', 'friends', 'dig']);
const REMAINS_SIZE = 0.75;                // remains, next to a rabbit (drawRemains)
const HOLT_SIZE = 0.8;                    // the way into an otters' holt
const BODY_SIZE = 1;                      // a dead rabbit, lying on its side
const FOX_BODY = 1.4;                     // and a dead fox, next to that

function visible(sx, sy, pad) { return sx > -pad && sy > -pad && sx < vw + pad && sy < vh + pad; }

const DARK = 0.55;                        // how much of NIGHT_RGB the night lays over everything
function darkness(phase) {
  if (phase >= 0.72 || phase < 0.02) return DARK;
  if (phase >= 0.6) return DARK * (phase - 0.6) / 0.12;
  if (phase < 0.1) return DARK * (1 - (phase - 0.02) / 0.08);
  return 0;
}
// The golden hour: from mid-afternoon the light warms, fullest just before the dark comes in and gone as it deepens,
// so the two hardly lie on each other (a navy and an orange laid together cancel out into grey). The shader lights the
// ground with it (goldLight multiplies it, so the grass leans gold and stays as green), and what's drawn on it gets
// GOLD_RGB laid over just what's there (render), the nearest one fill comes to the same light.
const GOLD_LIGHT = [1.05, 0.95, 0.82], GOLD_RGB = [180, 70, 0], GOLD_A = 0.08;
const GOLD_STEPS = 10;                    // the ground is lit in this many steps: each one paints it again
const goldenHour = phase => smooth(0.45, 0.57, phase) * (1 - smooth(0.59, 0.67, phase));
const goldLight = k => GOLD_LIGHT.map(v => 1 + (v - 1) * k);

// At speed a night comes and goes in a blink (at 60x three a second), so the light keeps near the day's:
// the night still breathes, but nothing flashes. The dial in the time pill shows the days going by instead.
// lightSwing is how much of the swing is shown; it eases to the speed's (lightFrame) so a change never jumps.
const LIGHT_SWING = [[60, 0.12], [15, 0.5], [0, 1]];   // from this speed up: this much of the swing
const LIGHT_MID = 0.095;                               // the darkness it keeps near, a little dimmer than day
let lightSwing = 1;
function lightFrame(dt) {
  if (!ui.speed) return;
  const to = LIGHT_SWING.find(([s]) => ui.speed >= s)[1];
  lightSwing += (to - lightSwing) * (1 - Math.pow(0.02, dt));
}
const shownDark = phase => LIGHT_MID + (darkness(phase) - LIGHT_MID) * lightSwing;
const shownGold = phase => Math.round(goldenHour(phase) * lightSwing * GOLD_STEPS) / GOLD_STEPS;

// The things a frame draws (a tree or a rock d, a swarm h, a creature c, a visitor v), each a record of the
// one shape, kept from frame to frame: a few hundred new objects a frame, of five shapes, were felt in every loop over them.
const frameItems = [], itemPool = [];
function itemOf(items, y, sx, sy, f) {
  let it = itemPool[items.length];
  if (!it) itemPool.push(it = { y: -0, sx: -0, sy: -0, f: -0, px: -0, d: null, h: null, c: null, v: null });
  it.y = y; it.sx = sx; it.sy = sy; it.f = f; it.px = 0; it.d = it.h = it.c = it.v = null;
  items.push(it);
  return it;
}
// Puts the things in a frame back to front, by y (the same y: as they came). Sorting numbers is several times quicker than
// sorting the things with a comparison, so each one's sort key is a number: its y to a millionth of a tile, then its place.
let byY = new Float64Array(2048), bySorted = [];
function sortByY(items) {
  const n = items.length;
  if (byY.length < n) byY = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = Math.floor((items[i].y + 64) * 1048576) * 4096 + i;
    if (!(k >= 0) || n > 4096) { items.sort((a, b) => a.y - b.y); return; }   // (far off the map, or a crowd: the slow way)
    byY[i] = k;
  }
  const keys = byY.subarray(0, n).sort();
  bySorted.length = n;
  for (let i = 0; i < n; i++) bySorted[i] = items[i];
  for (let i = 0; i < n; i++) items[i] = bySorted[keys[i] % 4096];
  bySorted.length = 0;
}

let shakeX = 0, shakeY = 0;                          // the frame's own transform (render's), in device pixels: see drawPaintedTree
function render(now) {
  // Thunder rumbles the whole screen a little.
  const q = now - ui.sky.boom < 350 && ui.speed <= 4 ? 3 * (1 - (now - ui.sky.boom) / 350) : 0;
  const shx = q * Math.sin(now / 17), shy = q * Math.cos(now / 23);
  shakeX = shx * dpr; shakeY = shy * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  alphaNow = ALPHA.get.call(ctx);                    // (the canvas may have been made afresh: see fade)
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
  drawPond(now, z);

  // Burrows, drawn by hand: some browsers clip the 🕳️ glyph in half. Who lives where only shows close up (the paths, r >= 9).
  const residents = new Map();
  if (z * 0.8 * 1.1 >= 9) for (const c of world.creatures) if (c.alive && c.home) residents.set(c.home, (residents.get(c.home) || 0) + 1);
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
  const items = frameItems;
  items.length = 0;
  for (const d of world.decor) {                           // (a hive is in one of the trees)
    if (d.tree && d.size * z < SEEDLING_PX && !d.stump && !d.hedge) continue;   // a seedling too small to see from here (a hedge's whips always show)
    const [sx, sy] = toScreen(d.x, d.y), px = d.tree ? treePx(d) : d.size * z;
    if (visible(sx, sy, px)) { const it = itemOf(items, d.y, sx, sy, 1 - mistAt(d.x, d.y)); it.d = d; it.px = px; }
  }
  for (const h of world.hives) {                           // a swarm hanging in a tree
    if (!h.cluster) continue;
    const [sx, sy] = toScreen(h.x, h.y);
    if (visible(sx, sy, 3 * z)) itemOf(items, h.y, sx, sy, 1 - mistAt(h.x, h.y)).h = h;
  }
  const shown = [];
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const [sx, sy] = screenOf(c);
    if (!visible(sx, sy, 60)) continue;
    const it = itemOf(items, c.y + (c.mode === 'dance' ? DANCE_FRONT : 0), sx, sy, 1 - mistAt(c.x, c.y));
    it.c = c;
    if (c.species === 'crow' && crowSeat(c)) it.y -= (seat.y - seat.tree.y) * SEAT_SORT;   // up a tree: just after it, not after the trees just in front
    shown.push(it);
  }
  if (world.visitors) for (const v of world.visitors) {    // (?keep: a hedgehog at a hedge, a heron at a pond, ...)
    const d = drawnAt(v), [sx, sy] = toScreen(d.x, d.y);
    const sort = v.kind === 'kingfisher' && v.tree && v.mode !== 'in' && v.mode !== 'out' ? Math.max(d.y, v.tree.y + 0.02)   // (in front of its tree)
      : v.kind === 'skylark' && v.high > 0.3 ? S.H : d.y;                                                       // (singing high over all)
    if (visible(sx, sy, 40 + 2 * visitorPx(v) + visitorUp(v, visitorPx(v)))) itemOf(items, sort, sx, sy, 1 - mistAt(d.x, d.y)).v = v;
  }
  sortByY(items);
  // Shadows first, all together, so a tree's shadow never lands on a rabbit behind it.
  const sn = sun(ck);
  for (const it of items) {
    if (it.f < 0.02) continue;                             // lost in the mist
    fadeTo(it.f);
    if (it.d) { drawDecorShadow(it.d, it.sx, it.sy, sn, it.px); if (it.d.tree) treeLeaves(it.d, it.sx, it.sy, it.px, ck, it.f); }
    else if (it.c) {
      drawCreatureShadow(it.c, it.sx, it.sy, now, sn);
    } else if (it.v) drawVisitorShadow(it.v, it.sx, it.sy, sn);
  }
  drawLeaves(now, true);                                   // the leaves lying round the trees' feet, on the ground under all that stands
  for (const it of items) {
    if (it.f < 0.02) continue;
    fadeTo(it.f);
    if (it.d) it.d.hive ? drawBeeTree(it.d, it.sx, it.sy, now, ck) : drawDecor(it.d, it.sx, it.sy, now, ck, null, it.px);
    else if (it.h) drawSwarm(it.h, it.sx, it.sy);
    else if (it.v) drawVisitor(it.v, it.sx, it.sy, now, z);
    else drawCreature(it.c, it.sx, it.sy, now);
  }
  unfade();
  if (splashes.length) drawSplashes(now);
  drawFallingLeaves(now);                                  // (an emoji tree's)
  drawLeaves(now, false);                                  // and the painted trees' leaves coming down
  drawPollen(now);
  drawButterflies(now, ck);

  // The golden hour and the night. The ground is lit by the shader; what's drawn on it gets the warm light laid over
  // just what's there (source-atop), before the dark goes over everything.
  const dark = shownDark(ck.phase), gold = shownGold(ck.phase);
  if (gold > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    wash(`rgba(${GOLD_RGB}, ${GOLD_A * gold})`);
    ctx.globalCompositeOperation = 'source-over';
  }
  const glows = fireflyLight(dark) > 0.02;   // (drawn over the dark, under the weather)
  if (dark > 0 && glows) wash(`rgba(${NIGHT_RGB}, ${dark})`);
  drawFireflies(now, dark);
  drawWeather(now, ck, glows ? 0 : dark);                  // (else the dark is laid with the weather's washes, as one)

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

  // Pop-ups above the dark. Not in the intro: its lines tell the story.
  drawPops(shown, now);

  drawEffects(now);
  if (sel) drawSelectionOver(sel, now);
  if (ui.picked) drawPickedOver();
  const hov = world.byId.get(ui.hoverId);
  if (hov && hov.alive && !hov.hidden && hov.id !== ui.selectedId) {
    const [sx, sy] = screenOf(hov);
    drawLabel(`${hov.name} · ${S.mood(world, hov).text}`, sx, sy + creaturePx(hov) * 0.55 + 6);
  } else if (ui.hoverHive && ui.hoverHive !== ui.picked?.it) {
    const h = ui.hoverHive, [sx, sy] = toScreen(h.x, h.y);
    const where = h.patch && h.patch.field ? `the ${h.patch.field.name}` : 'flowers';
    const dance = S.patchFresh(world, h) ? ` · 💃 ${where} to the ${compass(h.patch.x - h.x, h.patch.y - h.y)}` : '';
    drawLabel(`🐝 ${h.queen ? `Queen ${h.queen.name}'s hive` : 'Empty hive'} · ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'} · ${Math.round(h.honey)} honey${dance}`, sx, sy + z * 0.5 + 6);
  }
  standIns = false;                                    // a portrait for the inspector is kept, so it's always painted
}

// Remains lying in the grass (sim.js leaveRemains). A rabbit or a fox lies whole, then opened, picked over and a
// pelt as the meat goes (BODY_STAGES; one a fox caught starts opened), and the pelt fades. A bird's are
// a few feathers, fading as they go. Painted once per look and size.
const BODY_STAGES = [0.7, 0.4, 0.15];     // meat left, of what there was, where each next stage begins
const remainsLooks = new WeakMap();
const remainsPx = z => Math.max(8, (8 + z) * REMAINS_SIZE);
const bodyPx = z => Math.max(8, (8 + z) * BODY_SIZE);
function remainsLook(c) {                 // a rabbit's coat (BODY_COATS) or a fox (FOX_LOOK), or a bird's feathers, an otter's fur (REMAINS_ARTS)
  if (c.species === 'fox') return FOX_LOOK;
  if (c.species !== 'rabbit') return c.species === 'otter' ? 2 : 0;
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
    const [open, picked, pelt] = BODY_STAGES, caught = k.c.cause === 'fox';
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
  bee: { size: 0.38, facesLeft: true, swatch: '#e8b83a', quiet: true },   // quiet: no pop-ups (drawPops)
  crow: { size: 0.95, facesLeft: true, swatch: '#4a4e5e' },               // painted (crowArt), not the emoji
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
  alder: [0.58, 1.26, 0.3, 0.39, 0.29, 0.21, 0.13],
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
const CROW_AIR = new Set(['flap', 'flock', 'love', 'follow', 'drive']);                               // flying
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
  return CROW_LANDS.has(c.mode) && c.target ? fly * near(c, c.target, 2) : 0;
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

// Where a creature is drawn in the meadow: up to SMOOTH_SPEED, between where it was a tick ago (keepLast) and where it
// is, as far along as the clock is to the next tick, so it glides rather than stepping 30 times a second. Quicker,
// held, or just put somewhere, where it is. (One shared answer: read it straight away.)
const SMOOTH_SPEED = 2;
const lastTick = new WeakMap(), drawnPos = { x: 0, y: 0 };
function keepLast() {
  for (const c of world.creatures) keepAt(c);
  if (world.visitors) for (const v of world.visitors) keepAt(v);   // (and a visitor, sim.js w.visitors)
}
function keepAt(c) {
  let p = lastTick.get(c);
  if (!p) lastTick.set(c, p = { x: 0, y: 0, tick: 0 });
  p.x = c.x; p.y = c.y; p.tick = world.tick + 1;
}
function drawnAt(c) {
  const p = ui.speed <= SMOOTH_SPEED && lastTick.get(c);
  if (!p || p.tick !== world.tick || Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) { drawnPos.x = c.x; drawnPos.y = c.y; return drawnPos; }
  const t = Math.min(acc, 1);
  drawnPos.x = p.x + (c.x - p.x) * t; drawnPos.y = p.y + (c.y - p.y) * t;
  return drawnPos;
}

// Where a creature is drawn on screen: where it is (drawnAt), plus a flier's weave. A dancer is drawn a
// little in front of her hive, where the tree doesn't hide her, and her eight a size bigger.
const DANCE_FRONT = 0.45, DANCE_SIZE = 1.8;
function screenOf(c) {
  const d = drawnAt(c), p = toScreen(d.x, d.y), z = cam.zoom;
  if (c.species === 'rabbit') { const s = hopSurge(c), g = gaitOf(c); p[0] += s * g.hx * z; p[1] += s * g.hy * z; }
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

// How high off the ground it's lifted, in screen pixels. A rabbit's hop (HOP), a galloping fox rising a little in the
// two moments it's in the air (run1, run3); a trotting fox keeps its back level. At the hole, a digger doesn't hop but
// scrabbles: a quick small bob.
const GALLOP_LIFT = 0.06;          // and a gallop's rise
function hopOf(c, px, now) {
  if (atHole(c)) return ui.speed > 0 ? Math.abs(Math.sin(now / 70 + c.id)) * px * 0.03 : 0;
  if (!STRIDE[c.species] || !onTheMove(c)) return 0;
  const u = gaitOf(c).step % 1;
  if (c.species === 'rabbit') { const f = fastGait(c) ? 1 : 0, A = HOP.air[f]; return u < A ? Math.sin(Math.PI * u / A) * px * HOP.high[f] : 0; }
  return fastGait(c) ? (1 + Math.cos(4 * Math.PI * (u - 0.125))) / 2 * px * GALLOP_LIFT : 0;
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

// ------------------------------------------------------------------ visitors
//
// A visitor (sim.js w.visitors) is no creature: a hedgehog the keeper's hedge drew in, or a heron at a pond the keeper
// dug. Each is painted like the animals. A hedgehog (paintHedgehog): its legs go round with the ground it covers, it
// snuffles with its nose down, and curled up asleep under the hedge by day it breathes, a 💤 over it close up. It fades
// in and out over the first and last VISIT_FADE tiles of its way, as if out of the long grass. A heron (paintHeron,
// drawHeron) fades in and out of the sky over HERON_FADE.
// Dragonflies (drawDragonflies), a kingfisher (drawKingfisher) and a skylark (drawSkylark) are painted by fur.js, in the
// worker as the foxes are, and fade in and out over their kind's fade.
// a: its name in a sentence; size: next to a rabbit (a hedgehog a little bigger than life, to be seen, a dragonfly much
// bigger); badge: its marker's picture; glyph: painted, with no emoji, so a line of text shows its portrait (visitorGlyph).
const VISITORS = {
  hedgehog: { name: 'hedgehog', a: 'a hedgehog', emoji: '🦔', badge: '🦔', art: 'hog:0', tint: '#a07c5a', for: 'the beetles under', home: 'hedge', size: 1, fade: S.VISIT_FADE },
  heron: { name: 'heron', a: 'a heron', emoji: '', badge: 'heron:1', art: 'heron:1', tint: '#a9b4bf', for: 'the frogs in', home: 'pond', size: 1.85, fade: S.HERON_FADE, glyph: true },
  dragonfly: { name: 'dragonflies', a: 'dragonflies', emoji: '', badge: 'dfly:2', art: 'dfly:2', tint: '#8fb3d6', for: 'the reeds and still water of', home: 'pond', size: 0.75, fade: S.VISIT_FADE, glyph: true },
  kingfisher: { name: 'kingfisher', a: 'a kingfisher', emoji: '', badge: 'kfisher:0', art: 'kfisher:0', tint: '#3d9cc6', for: 'the fish in', home: 'pond', size: 1.1, fade: S.KF_FADE, glyph: true },
  skylark: { name: 'skylark', a: 'a skylark', emoji: '', badge: 'lark:3', art: 'lark:3', tint: '#a8895f', for: 'the open ground of', home: 'strip', size: 1.1, fade: S.LARK_FADE, glyph: true },
};
const visitorFace = kind => {      // its painting, for the inspector
  const art = VISITORS[kind].art;
  if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
  return `<img src="${portraits.get(art)}" alt="${VISITORS[kind].name}"${VISITORS[kind].glyph ? ' style="width: 115%"' : ''}>`;   // (a painting has room round it)
};
// Where it came to: the hedge, the pond or the strip; and a link to it.
const visitorPlace = v => (v.hedge ? v.hedge.name : v.strip ? v.strip.name : world.waters[v.pond.id].name);
const placeLink = v => (v.hedge ? esc(v.hedge.name) : v.strip ? thingLink('field', v.strip.id, esc(v.strip.name))
  : thingLink('water', v.pond.id, esc(visitorPlace(v))));
const HOG_STEP = 0.16;             // tiles a step of its walk
const HERON_STEP = 0.2;            // and of a heron's stalk
const visitorPx = v => (8 + cam.zoom) * VISITORS[v.kind].size;
// Its feet are on the ground where a rabbit's would be, however big it's drawn: this far below the point it's drawn round.
const visitorFeet = () => 0.36 * (8 + cam.zoom);
// How high over the ground it's drawn (its feet, or a dragonfly's middle), in px.
function visitorUp(v, px) {
  switch (v.kind) {
    case 'heron': return heronLift(v, px);
    case 'kingfisher': return kfUp(v, px);
    case 'skylark': return larkUp(v);
    case 'dragonfly': return px * (v.mode === 'perch' || v.mode === 'roost' ? DRAGON_SIT : DRAGON_HANG);
  }
  return 0;
}
const visitorSteps = new WeakMap();     // how far it has walked, as drawn: { x, y, walked, at }
function visitorFade(v) {
  const f = VISITORS[v.kind].fade;
  if (v.mode === 'in') return clamp(Math.hypot(v.x - v.fx, v.y - v.fy) / f, 0, 1);
  if (v.mode === 'out') return clamp(Math.hypot(v.x - v.tx, v.y - v.ty) / f, 0, 1);
  return 1;
}
// Which of the two steps of its walk it's on: the next one each `step` tiles it has covered as drawn, so it stops when it stops.
function stepOf(v, step) {
  const d = drawnAt(v);
  let w = visitorSteps.get(v);
  if (!w) visitorSteps.set(v, w = { x: d.x, y: d.y, walked: 0, at: -1 });
  if (w.at !== spriteFrame) {
    const k = Math.hypot(d.x - w.x, d.y - w.y);
    if (k < 1) w.walked += k;
    w.x = d.x; w.y = d.y; w.at = spriteFrame;
  }
  return Math.floor(w.walked / step) & 1;
}
function visitorArt(v) {
  if (v.mode === 'sleep') return 'hog:3';
  if (v.mode === 'snuffle') return 'hog:2';
  const s = stepOf(v, HOG_STEP);
  return ui.speed > FEW_FRAMES ? 'hog:0' : 'hog:' + s;
}
function drawVisitor(v, sx, sy, now, z) {
  const px = visitorPx(v), a = visitorFade(v);
  if (a < 0.02) return;
  if (v.kind === 'heron') { drawHeron(v, sx, sy, now, z, px, a); return; }
  if (v.kind === 'dragonfly') { drawDragonflies(v, sx, sy, now, z, px, a); return; }
  if (v.kind === 'kingfisher') { drawKingfisher(v, sx, sy, now, z, px, a); return; }
  if (v.kind === 'skylark') { drawSkylark(v, sx, sy, now, z, px, a); return; }
  const asleep = v.mode === 'sleep', squash = 1 + (asleep && ui.speed > 0 ? Math.sin(now / 650 + v.id) * 0.035 : 0);
  drawEmoji(visitorArt(v), sx, sy + px * 0.4 * (1 - squash), px, { flip: v.facing > 0, squash, alpha: a < 1 ? a : undefined });
  if (asleep && z >= 8) drawEmoji('💤', sx + px * 0.3, sy - px * 0.55 + Math.sin(now / 600 + v.id) * 3, Math.max(11, z * 0.7), { alpha: 0.85 });
}
// A heron (sim.js heronTick) flies in high and glides down over its last HERON_GLIDE tiles, climbs as it goes, and
// crosses the pond in a low arc. It wades in the shallows to its shins, rings round its legs, and its stab ends in a
// splash. Watching, it's poised, now and then stretched up (by its watch's timer, so it keeps the sim's time); at night
// it sleeps on one leg, a 💤 over it close up.
const HERON_GLIDE = 2.5;           // tiles it glides down over, landing (and climbs over, taking off)
const HERON_HIGH = 1.1;            // how high it flies, in its size
const HERON_BEAT = 280;            // ms a wingbeat: slow and deep
function heronLift(v, px) {
  const d = drawnAt(v), x = d.x, y = d.y;
  if (v.mode === 'in') return px * HERON_HIGH * clamp(Math.hypot(v.tx - x, v.ty - y) / HERON_GLIDE, 0, 1);
  if (v.mode === 'out') return px * HERON_HIGH * clamp(Math.hypot(x - v.ox, y - v.oy) / HERON_GLIDE, 0, 1);
  if (v.mode !== 'hop') return 0;
  const all = Math.hypot(v.tx - v.ox, v.ty - v.oy);
  return all ? px * 0.45 * Math.sin(Math.PI * clamp(Math.hypot(x - v.ox, y - v.oy) / all, 0, 1)) : 0;
}
function heronArt(v, up, px, now) {
  if (v.mode === 'sleep') return 'heron:9';
  if (v.mode === 'in' || v.mode === 'out' || v.mode === 'hop') {
    if (up < px * 0.12) return 'heron:0';                   // (just down, or not yet up)
    return ui.speed > 0 && ui.speed <= FEW_FRAMES ? 'heron:' + (7 + ((now / HERON_BEAT + v.id) & 1)) : 'heron:7';
  }
  if (v.mode === 'stab') return 'heron:4';
  if (v.mode === 'gulp') return v.caught === 'fish' ? 'heron:6' : 'heron:5';
  if (v.mode === 'stalk') { const s = stepOf(v, HERON_STEP); return 'heron:' + (ui.speed > FEW_FRAMES ? 2 : 2 + s); }
  return v.timer % 100 >= 70 ? 'heron:0' : 'heron:1';
}
const wadingAt = v => !world.frozen && world.water[(v.y | 0) * S.W + (v.x | 0)] > 0;
function drawHeron(v, sx, sy, now, z, px, a) {
  const feet = sy + visitorFeet(), up = heronLift(v, px), art = heronArt(v, up, px, now), flip = v.facing > 0, alpha = a < 1 ? a : undefined;
  const y = feet - px * 0.36 - up;
  if (up > 1 || !wadingAt(v)) drawEmoji(art, sx, y, px, { flip, alpha });
  else {
    const line = feet - px * 0.04, legs = sx + (flip ? -1 : 1) * px * 0.1, rip = 1 + 0.12 * Math.sin(now / 300 + v.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx - px, line - px * 2, px * 2, px * 2); ctx.clip();
    drawEmoji(art, sx, y + px * 0.04, px, { flip, alpha });
    ctx.restore();
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.7)';
    ctx.lineWidth = Math.max(1, px * 0.025);
    ctx.beginPath(); ctx.ellipse(legs, line, px * 0.13 * rip, px * 0.035 * rip, 0, 0, TAU); ctx.stroke();
    const reach = (flip ? 1 : -1) * px * 0.36;
    if (v.mode === 'stab' && world.water[(v.y | 0) * S.W + ((v.x + reach / cam.zoom) | 0)] > 0) {   // the splash, ringing out from the bill
      const u = clamp((S.HERON_STAB - v.timer + acc) / S.HERON_STAB, 0, 1), bill = sx + reach;
      ctx.globalAlpha = 0.8 * (1 - u);
      ctx.beginPath(); ctx.ellipse(bill, line, px * (0.05 + 0.16 * u), px * (0.015 + 0.045 * u), 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (v.mode === 'sleep' && z >= 8) drawEmoji('💤', sx + px * 0.18, y - px * 0.22 + Math.sin(now / 600 + v.id) * 3, Math.max(11, z * 0.7), { alpha: 0.85 });
}
// Dragonflies (sim.js dragonflyTick) seen from above: one the sim moves, and DRAGON_MORE drawn about it (a look: each
// hangs over a spot of the pond's water a while, then darts to the next, by the meadow's clock), turned the way they go.
// In flight their wings beat between two paintings; settled on a reed they're still. Fade in and out with the visitor.
const DRAGON_MORE = 2;             // more about the pond than the one the sim moves
const DRAGON_HANG = 1.1;           // how high they hang over the water, in their size
const DRAGON_SIT = 0.5;            // and sit up a reed
const DRAGON_BEAT = 45;            // ms a wingbeat painting shows
const dragonWay = new WeakMap();   // the way the one the sim moves last went
function drawDragonflies(v, sx, sy, now, z, px, a) {
  const t = world.tick + acc, still = ui.speed === 0 || ui.speed > FEW_FRAMES, ground = sy + visitorFeet(), sat = v.mode === 'perch' || v.mode === 'roost';
  let way = dragonWay.get(v) ?? (v.facing > 0 ? 0 : Math.PI);
  if (!sat && (v.tx !== v.x || v.ty !== v.y)) way = Math.atan2(v.ty - v.y, v.tx - v.x);
  dragonWay.set(v, way);
  dragonfly(v, 0, sx, ground - visitorUp(v, px), px, way, sat, still, now, a);
  for (let k = 1; k <= DRAGON_MORE; k++) {                // the others, about the pond
    const list = sat ? v.edge : v.spots, n = list.length;
    if (!n) break;
    let x, y, w2 = way, sit = sat;
    if (v.mode === 'in' || v.mode === 'out') { x = v.x + Math.cos(k * 2.4) * 0.8; y = v.y + Math.sin(k * 2.4) * 0.5; }
    else {
      const span = 70 + 50 * hash2(v.id, k, 151), u = (t + span * hash2(v.id, k, 153)) / span, j = Math.floor(u), f = u - j;
      const p0 = list[Math.floor(hash2(j, k, v.id) * n)], p1 = list[Math.floor(hash2(j + 1, k, v.id) * n)], d = f < 0.7 ? 0 : (f - 0.7) / 0.3, e = d * d * (3 - 2 * d);
      x = p0.x + (p1.x - p0.x) * e; y = p0.y + (p1.y - p0.y) * e;
      if (!sat) { w2 = Math.atan2(p1.y - p0.y, p1.x - p0.x); sit = hash2(j, k, v.id + 7) < 0.3 && d === 0; }
    }
    const [ox, oy] = toScreen(x, y);
    dragonfly(v, k, ox, oy + visitorFeet() - px * (sit ? DRAGON_SIT : DRAGON_HANG), px * (k === 2 ? 0.85 : 1), w2, sit, still, now, a);
  }
}
// One of them: k 0 and 1 the blue chasers, 2 a red darter. (A wingbeat not painted yet: another stands in, paintedSprite.)
function dragonfly(v, k, x, y, px, way, sat, still, now, a) {
  const look = k === 2 ? 1 << 4 : 0, pose = sat ? 2 : still ? 0 : (now / DRAGON_BEAT + k + v.id) & 1;
  const s = sprite('dfly:' + (look + pose), px);
  ctx.save();
  if (a < 1) ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.rotate(way + Math.PI);          // (the painting faces left: the way it goes)
  ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
  ctx.restore();
}

// A kingfisher (sim.js kingfisherTick) sits on a low branch of the tree at the pond's edge (KF_SIT of the tree's height,
// drawn just in front of it), now and then peering down; drops in a dive to the water, is under a moment in a splash
// of rings, and flies back up, with a fish it beats on the branch. In flight its wings whirr. It comes in low and fast.
const KF_SIT = 0.3;                // how far up its tree's painting its branch is
const KF_FLY_UP = 0.9;             // how high it flies coming and going, in its size
const KF_WHIRR = 55;               // ms a wingbeat painting shows
const kfSit = (v, px) => (v.tree ? treePx(v.tree) * KF_SIT : px * 0.5);
function kfUp(v, px) {
  const sit = kfSit(v, px), d = drawnAt(v), part = (ax, ay, bx, by) => clamp(Math.hypot(d.x - ax, d.y - ay) / (Math.hypot(bx - ax, by - ay) || 1), 0, 1);
  switch (v.mode) {
    case 'in': return lerp(sit, px * KF_FLY_UP, clamp(Math.hypot(v.tx - d.x, v.ty - d.y) / 2, 0, 1));
    case 'out': return lerp(sit, px * KF_FLY_UP, clamp(Math.hypot(d.x - v.ox, d.y - v.oy) / 2, 0, 1));
    case 'dive': return sit * (1 - part(v.ox, v.oy, v.tx, v.ty));
    case 'under': return 0;
    case 'back': return sit * part(v.ox, v.oy, v.tx, v.ty);
  }
  return sit;
}
function kfArt(v, now) {
  switch (v.mode) {
    case 'in': case 'out': case 'back': return ui.speed > 0 && ui.speed <= FEW_FRAMES ? 'kfisher:' + (3 + ((now / KF_WHIRR + v.id) & 1)) : 'kfisher:3';
    case 'dive': return 'kfisher:2';
    case 'beat': return 'kfisher:5';
    case 'sleep': return 'kfisher:6';
  }
  return v.timer % 90 >= 60 ? 'kfisher:1' : 'kfisher:0';
}
function drawKingfisher(v, sx, sy, now, z, px, a) {
  const ground = sy + visitorFeet(), up = kfUp(v, px), alpha = a < 1 ? a : undefined;
  if (v.mode === 'under' || v.mode === 'back' && up < px * 0.3) {   // the splash, ringing out where it went in
    const u = v.mode === 'under' ? clamp((S.KF_UNDER - v.timer + acc) / S.KF_UNDER, 0, 1) : 1;
    const [rx, ry] = v.mode === 'under' ? [sx, ground] : toScreen(v.ox, v.oy);
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.8)'; ctx.lineWidth = Math.max(1, px * 0.04);
    ctx.globalAlpha = 0.9 * (1 - 0.6 * u);
    ctx.beginPath(); ctx.ellipse(rx, v.mode === 'under' ? ry : ry + visitorFeet(), px * (0.12 + 0.3 * u), px * (0.04 + 0.1 * u), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (v.mode === 'under') return;
  }
  drawEmoji(shownPose(v, kfArt(v, now), px), sx, ground - up - px * 0.21, px, { flip: v.facing > 0, alpha });
  if (v.mode === 'sleep' && z >= 8) drawEmoji('💤', sx + px * 0.25, ground - up - px * 0.6 + Math.sin(now / 600 + v.id) * 3, Math.max(11, z * 0.7), { alpha: 0.85 });
}

// A skylark (sim.js skylarkTick) walks the strip and pecks; rises singing (v.high, up to LARK_HIGH over it), hangs there
// fluttering with a note now and then drifting off it, and drops back down. It comes in and goes off high.
const LARK_HIGH = 3.6;             // how high it sings, in a rabbit's size (8 + the zoom)
const LARK_STEP = 0.1;             // tiles a step of its walk
const LARK_FLUTTER = 70;           // ms a wingbeat painting shows
function larkUp(v) {
  const high = LARK_HIGH * (8 + cam.zoom), d = drawnAt(v);
  if (v.mode === 'in') return high * 0.8 * clamp(Math.hypot(v.tx - d.x, v.ty - d.y) / 3, 0, 1);
  if (v.mode === 'out') return high * 0.8 * Math.max(v.high, clamp(Math.hypot(d.x - v.ox, d.y - v.oy) / 3, 0, 1));
  return high * v.high;
}
function larkArt(v, up, px, now) {
  if (v.mode === 'sleep') return 'lark:6';
  if (up > px * 0.15 || v.mode === 'rise') return ui.speed > 0 && ui.speed <= FEW_FRAMES ? 'lark:' + (4 + ((now / LARK_FLUTTER + v.id) & 1)) : 'lark:4';
  if (v.mode === 'peck') return v.timer % 40 < 22 ? 'lark:2' : 'lark:3';
  if (v.mode === 'walk') return 'lark:' + (ui.speed > FEW_FRAMES ? 0 : stepOf(v, LARK_STEP));
  return 'lark:0';
}
function drawSkylark(v, sx, sy, now, z, px, a) {
  const ground = sy + visitorFeet(), up = larkUp(v), y = ground - up - px * 0.36;
  drawEmoji(shownPose(v, larkArt(v, up, px, now), px), sx, y, px, { flip: v.facing > 0, alpha: a < 1 ? a : undefined });
  if ((v.mode === 'sing' || v.mode === 'rise') && z >= 6) {   // its song: a note drifting up off it now and then
    const u = (now / 1400 + v.id * 0.37) % 1;
    if (u < 0.8) drawEmoji('🎵', sx + (v.facing > 0 ? 1 : -1) * px * (0.3 + 0.4 * u), y - px * (0.2 + 0.9 * u), Math.max(9, px * 0.45), { alpha: 0.85 * (1 - u / 0.8) });
  }
  if (v.mode === 'sleep' && z >= 8) drawEmoji('💤', sx + px * 0.25, y - px * 0.4 + Math.sin(now / 600 + v.id) * 3, Math.max(11, z * 0.7), { alpha: 0.85 });
}
function drawVisitorShadow(v, sx, sy, sn) {
  const px = visitorPx(v), heron = v.kind === 'heron', up = visitorUp(v, px);
  if (heron && up <= 1 && wadingAt(v) || v.kind === 'kingfisher' && v.mode === 'under') return;   // (wading: the rings round its legs are its shadow)
  if (v.kind === 'dragonfly' && world.water[(v.y | 0) * S.W + (v.x | 0)]) return;                    // (over the water: none to speak of)
  const a = (0.14 + 0.16 * Math.max(0, sn.a)) * visitorFade(v) / (1 + 2 * up / px), off = Math.max(0, sn.a) * sn.lean * (px * 0.2 + up * 0.5);
  const rx = heron ? px * (up > 1 ? 0.4 : 0.2) : px * 0.38, ry = heron ? px * 0.05 : px * 0.1;
  ctx.fillStyle = `rgba(40, 50, 20, ${a})`;
  ctx.beginPath(); ctx.ellipse(sx + off, sy + visitorFeet(), rx + Math.abs(off) * 0.6, ry, 0, 0, TAU); ctx.fill();
}

function drawCreature(c, sx, sy, now) {
  if (c.species === 'otter') return drawOtter(c, sx, sy, now);
  const px = creaturePx(c);
  if (wading(c)) {
    const line = sy + px * 0.3, rip = 1 + 0.12 * Math.sin(now / 260 + c.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx - px, line - px * 2, px * 2, px * 2); ctx.clip();
    drawEmoji(walkerArt(c, px, now), sx, sy + px * 0.1, px, { flip: flipOf(c) });
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
  const squash = 1 + breathe;
  const y = sy - hop + px * 0.4 * (1 - squash);
  if (c.species === 'crow' && c.sleeping && crowSeat(c)) sx += treeSway(seat.tree, now) * hop;   // up a tree, it sways with it
  if (c.mode === 'dance') drawDance(c, sx, y, px);
  drawEmoji(c.species === 'crow' ? crowArt(c, hop, px, now) : walkerArt(c, px, now), sx, y, px, { flip: flipOf(c), squash });   // feet stay on the ground
  if (c.load && c.species === 'bee') drawBaskets(c, sx, y, px);
  if (c.mode === 'sip') drawSipping(c, sx, sy, px, now);
  if (px > 18 && ui.speed > 0 && ui.speed <= 4 && atHole(c)) drawDigging(c, sx, y, px, now);
}

// A forager packs pollen on her hind legs: two gold lumps that grow as she fills up.
const BASKET = { x: 0.08, y: 0.22, dx: 0.07, dy: -0.03 };  // the near hind leg, and the far one from it, in px (facing left)
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
const heartAt = (g, x, y, s) => {
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.6, y - s * 1.15, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.6, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
};
const pawAt = (g, x, y, s) => fillIn(g, '#8a5a3c', () => {
  ovalAt(g, x, y + s * 0.35, s * 0.5, s * 0.42);
  for (const [tx, ty] of [[-0.58, -0.2], [-0.21, -0.58], [0.21, -0.58], [0.58, -0.2]]) ovalAt(g, x + tx * s, y + ty * s, s * 0.19, s * 0.25, tx * 0.6);
});
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

// A honeybee, facing left, soft-shaded like the carcasses: a golden abdomen with dark bands, a fuzzy thorax, a dark
// head with a big shiny eye, see-through wings. 'bee:0' wings up and 'bee:1' wings down (in flight it buzzes between
// the two, beeArt), 'bee:2' sat with its wings folded back, on a flower. Its box -1 to 1 is the size asked for.
const BEE_GOLD = [240, 182, 46], BEE_THORAX = [190, 128, 44], BEE_BAND = [70, 44, 24], BEE_HEAD = [72, 50, 34];
function beeWing(g, x, y, len, wid, a, alpha) {
  g.save(); g.translate(x, y); g.rotate(a);
  const gr = g.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, `rgba(226,236,250,${alpha})`); gr.addColorStop(1, `rgba(250,252,255,${alpha * 0.8})`);
  g.fillStyle = gr; g.beginPath(); g.ellipse(len * 0.5, 0, len * 0.5, wid * 0.5, 0, 0, TAU); g.fill();
  g.strokeStyle = `rgba(120,130,150,${alpha * 0.7})`; g.lineWidth = 0.03; g.stroke();
  g.beginPath(); g.moveTo(0.02, 0); g.quadraticCurveTo(len * 0.45, -wid * 0.12, len * 0.85, wid * 0.05); g.stroke();   // a vein
  g.restore();
}
function paintBee(g, size, U, pose) {
  g.setTransform(U * 0.62, 0, 0, U * 0.62, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const sit = pose === 2, wingA = sit ? 0.18 : pose === 0 ? -1.05 : -0.28, wingL = sit ? 0.82 : 0.9, wingW = sit ? 0.3 : 0.42;
  beeWing(g, 0.02, -0.26, wingL * 0.9, wingW * 0.9, wingA - (sit ? 0.12 : 0.3), 0.5);          // the far wing
  strokeIn(g, rockRGB(BEE_BAND), 0.06, () => {                                                   // legs: hanging, or stood
    for (const [x0, x1] of [[-0.3, -0.42], [-0.14, -0.18], [0.02, 0.12]]) {
      g.moveTo(x0, 0.18); if (sit) g.lineTo(x1, 0.52); else g.quadraticCurveTo(x1, 0.34, x1 + 0.08, 0.46);
    }
  });
  const abdomen = () => ovalAt(g, 0.34, 0.06, 0.5, 0.35, 0.28);
  softIn(g, BEE_GOLD, -0.3, 0.42, abdomen, 1.12, 0.72);
  g.save(); g.beginPath(); abdomen(); g.clip();
  for (const x of [0.24, 0.48, 0.72]) softIn(g, BEE_BAND, -0.3, 0.42, () => ovalAt(g, x, 0.1, 0.075, 0.6, 0.28), 1.5, 0.8);
  softIn(g, BEE_BAND, -0.3, 0.42, () => ovalAt(g, 0.9, 0.2, 0.12, 0.3, 0.28), 1.5, 0.8);        // the tip
  g.restore();
  furGlow(g, [255, 236, 170], 0.45, 0.26, -0.12, 0.3, 0.12, 0.28);                              // a sheen along the top
  softIn(g, BEE_THORAX, -0.32, 0.26, () => discAt(g, -0.17, -0.02, 0.29), 1.2, 0.7);
  furGlow(g, [250, 210, 120], 0.5, -0.2, -0.14, 0.2, 0.12);
  softIn(g, BEE_HEAD, -0.2, 0.24, () => ovalAt(g, -0.5, 0.04, 0.2, 0.21), 1.3, 0.7);
  fillIn(g, '#1d1612', () => ovalAt(g, -0.53, 0, 0.1, 0.13, 0.2));
  fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, -0.56, -0.05, 0.04));
  strokeIn(g, rockRGB(BEE_HEAD), 0.045, () => {                                                 // antennae
    g.moveTo(-0.58, -0.13); g.quadraticCurveTo(-0.66, -0.36, -0.84, -0.42);
    g.moveTo(-0.5, -0.15); g.quadraticCurveTo(-0.52, -0.4, -0.68, -0.5);
  });
  beeWing(g, -0.04, -0.24, wingL, wingW, wingA, 0.62);                                          // the near wing
}
const BEE_BUZZ = 38;               // ms a wingbeat painting shows
const BEE_STILL = 10;              // px: smaller, the wings can't be seen beating, so they don't
const beeArt = (c, px, now) => c.mode === 'sip' || c.sleeping ? 'bee:2' : ui.speed === 0 || px < BEE_STILL ? 'bee:0' : ((now / BEE_BUZZ + c.id) & 1) ? 'bee:1' : 'bee:0';

// A hedgehog, facing left, soft-shaded like the carcasses: a round dome of spines, each dark at the root and pale at the
// tip, lying back over it and bristling at its edge; under it a brown face with a darker mask, a shiny black nose and a
// bead of an eye, a small round ear, little dark feet. 'hog:0' and 'hog:1' the two steps of a walk, 'hog:2' snuffling
// with its nose down, 'hog:3' curled up asleep on a few dry leaves. Box -1 to 1, feet on the ground at 0.72.
const HOG_SPINE = [92, 72, 56], HOG_FACE = [172, 134, 100], HOG_MASK = [92, 66, 46], HOG_FEET = '#4a372b';
const HOG_ROOTS = ['#46362a', '#33271f'], HOG_TIPS = ['#e9dcc0', '#c2b090'];
const HOG_LEAVES = [[176, 116, 56], [150, 98, 50], [194, 150, 74]];
// The spines: n of them, from points inside the dome (inside) lying along at(x, y), the ones lower down over the ones
// above and darker, with the light on the top. The same every time (its own random numbers, seed).
function hogSpines(g, n, inside, at, len, seed) {
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, list = [];
  for (let k = 0; k < n * 6 && list.length < n; k++) {
    const x = -1 + rnd() * 2, y = -1 + rnd() * 2;
    if (!inside(x, y)) continue;
    const a = at(x, y) + (rnd() - 0.5) * 0.45, l = len * (0.7 + rnd() * 0.6);
    list.push([x, y, Math.cos(a) * l, Math.sin(a) * l]);
  }
  list.sort((p, q) => p[1] - q[1]);
  for (const [x, y, dx, dy] of list) {
    const low = y > 0.18 ? 1 : 0;
    g.strokeStyle = HOG_ROOTS[low]; g.lineWidth = 0.034;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * 0.7, y + dy * 0.7); g.stroke();
    g.strokeStyle = HOG_TIPS[low]; g.lineWidth = 0.026;
    g.beginPath(); g.moveTo(x + dx * 0.62, y + dy * 0.62); g.lineTo(x + dx, y + dy); g.stroke();
  }
}
// A dry leaf: pointed at both ends, a darker midrib.
const hogLeaf = (g, x, y, l, a, rgb) => {
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -0.06, 0.06, () => { g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * 0.7, l, 0); g.quadraticCurveTo(0, l * 0.7, -l, 0); }, 1.15, 0.78);
  strokeIn(g, rockRGB(tone(rgb, 0.7)), 0.014, () => { g.moveTo(-l * 0.9, 0); g.lineTo(l * 0.9, 0); });
  g.restore();
};
function paintHedgehog(g, size, U, pose) {
  if (shrunk(g, size, U, 'hog:' + pose)) return;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  if (pose === 3) {                                                             // curled up asleep, on a few dry leaves
    hogLeaf(g, -0.42, 0.68, 0.17, -0.3, HOG_LEAVES[0]);
    hogLeaf(g, 0.44, 0.67, 0.18, 0.35, HOG_LEAVES[1]);
    hogLeaf(g, 0.06, 0.73, 0.17, 0.08, HOG_LEAVES[2]);
    const ball = () => ovalAt(g, 0.02, 0.36, 0.48, 0.36);
    softIn(g, HOG_SPINE, 0.0, 0.72, ball, 1.3, 0.55);
    softIn(g, HOG_FACE, 0.46, 0.72, () => ovalAt(g, -0.34, 0.58, 0.16, 0.1, 0.25), 1.12, 0.75);   // the face, tucked in
    fillIn(g, '#1c1512', () => ovalAt(g, -0.47, 0.62, 0.045, 0.04));
    strokeIn(g, '#3a2a20', 0.02, () => { g.moveTo(-0.38, 0.55); g.quadraticCurveTo(-0.34, 0.575, -0.29, 0.56); });   // its eye, shut
    hogSpines(g, 170, (x, y) => ((x - 0.02) / 0.45) ** 2 + ((y - 0.36) / 0.33) ** 2 < 1 && !(x < -0.16 && y > 0.48),
      (x, y) => Math.atan2(y - 0.36, x - 0.02) + 1.25, 0.18, 77);
    furGlow(g, [255, 242, 214], 0.26, -0.06, 0.12, 0.3, 0.12);                // the light on the top
    return;
  }
  const nose = pose === 2, step = pose === 1;
  const feet = near => fillIn(g, near ? HOG_FEET : '#33261e', () => {
    const f = near ? [nose ? -0.4 : step ? -0.24 : -0.4, step ? 0.42 : 0.26] : [nose ? -0.3 : step ? -0.34 : -0.18, step ? 0.5 : 0.34];
    for (const x of f) { ovalAt(g, x, 0.62, 0.05, 0.09); ovalAt(g, x - 0.04, 0.7, 0.07, 0.03); }
  });
  feet(false);
  softIn(g, HOG_FACE, 0.28, 0.64, () => ovalAt(g, 0.08, 0.48, 0.58, 0.15), 1.05, 0.7);   // the belly fur under the spines
  const mantle = () => {                                                        // the dome of spines
    g.moveTo(-0.44, 0.48);
    g.bezierCurveTo(-0.52, -0.06, -0.2, -0.34, 0.14, -0.34);
    g.bezierCurveTo(0.52, -0.34, 0.8, 0.02, 0.74, 0.46);
    g.bezierCurveTo(0.5, 0.56, -0.2, 0.56, -0.44, 0.48);
  };
  softIn(g, HOG_SPINE, -0.34, 0.56, mantle, 1.3, 0.55);
  // The head: a pointed snout, tipped down to the ground when it snuffles.
  g.save(); g.translate(-0.34, 0.34); g.rotate(nose ? 0.5 : 0); g.translate(0.34, -0.34);
  const head = () => {
    g.moveTo(-0.26, 0.04);
    g.bezierCurveTo(-0.48, 0.08, -0.7, 0.26, -0.84, 0.36);
    g.quadraticCurveTo(-0.91, 0.42, -0.82, 0.47);
    g.bezierCurveTo(-0.66, 0.55, -0.42, 0.6, -0.24, 0.56);
    g.closePath();
  };
  softIn(g, HOG_FACE, 0.04, 0.6, head, 1.2, 0.72);
  g.save(); g.beginPath(); head(); g.clip();
  furGlow(g, HOG_MASK, 0.7, -0.5, 0.3, 0.2, 0.12, -0.35);                       // the dark mask over the eye
  furGlow(g, [238, 218, 190], 0.65, -0.56, 0.5, 0.28, 0.08, -0.2);             // the pale cheek and chin
  g.restore();
  fillIn(g, rockRGB(tone(HOG_FACE, 0.78)), () => discAt(g, -0.3, 0.15, 0.065)); // the ear
  fillIn(g, rockRGB(tone(HOG_FACE, 0.5)), () => discAt(g, -0.3, 0.16, 0.035));
  fillIn(g, '#120d0a', () => ovalAt(g, -0.53, 0.3, 0.05, 0.045, -0.3));        // the eye, a black bead
  fillIn(g, 'rgba(255,255,255,0.85)', () => discAt(g, -0.545, 0.285, 0.016));
  fillIn(g, '#16100d', () => ovalAt(g, -0.85, 0.41, 0.055, 0.048, 0.4));      // the nose
  fillIn(g, 'rgba(255,255,255,0.5)', () => discAt(g, -0.86, 0.395, 0.014));
  g.restore();
  hogSpines(g, 190, (x, y) => ((x - 0.15) / 0.58) ** 2 + ((y - 0.12) / 0.44) ** 2 < 1 && y < 0.44 && x > -0.4,
    (x, y) => Math.atan2(y - 0.3, x - 0.15) + 1.15, 0.2, 91);
  furGlow(g, [255, 242, 214], 0.24, 0.1, -0.14, 0.42, 0.13);                   // the light along the top
  feet(true);
}

// A grey heron, facing left, soft-shaded like the hedgehog: a blue-grey back and folded wing with a black patch at its
// bend, long pale plumes drooping over the tail, a long white neck streaked black down the front, a white head with a
// black stripe back from the eye into a trailing crest, a yellow dagger of a bill, long yellowish legs. Box -1 to 1,
// feet on the ground at 0.72. Each pose: the body [x, y, rx, ry, tilt], the neck from its root to the head (a bezier's
// 4 points), the head [x, y, tilt] (the bill down for a tilt over 0), the legs far then near [hip, heel, foot] (null:
// tucked up out of sight), fly: the wings up (1) or down (2), and catch: a frog (1) or a fish (2) held up in the bill.
// 'heron:0' standing up, 1 poised (neck drawn back, looking down into the water), 2 and 3 the two steps of a stalk,
// 4 the stab, 5 and 6 a frog and a fish held up, 7 and 8 flying with the wings up and down, 9 asleep on one leg.
const HERON_BACK = [146, 156, 168], HERON_WING = [118, 128, 144], HERON_PALE = [230, 230, 224], HERON_INK = [40, 41, 48];
const HERON_BILL = [232, 176, 62], HERON_LEG = [176, 150, 96];
const HERON_POSES = [
  { body: [0.22, -0.02, 0.33, 0.165, 0.5], neck: [-0.04, -0.14, -0.26, -0.36, 0.02, -0.56, -0.12, -0.74], head: [-0.13, -0.76, 0],
    legs: [[0.26, 0.1, 0.27, 0.42, 0.26, 0.71], [0.16, 0.1, 0.16, 0.42, 0.13, 0.71]] },
  { body: [0.24, 0.06, 0.33, 0.165, 0.3], neck: [-0.02, -0.02, 0.06, -0.38, -0.3, -0.44, -0.34, -0.3], head: [-0.36, -0.28, 0.5],
    legs: [[0.28, 0.16, 0.34, 0.44, 0.27, 0.71], [0.18, 0.16, 0.24, 0.44, 0.14, 0.71]] },
  { body: [0.22, 0.0, 0.33, 0.165, 0.28], neck: [-0.04, -0.08, -0.22, -0.2, -0.26, -0.44, -0.4, -0.54], head: [-0.42, -0.55, 0.25],
    legs: [[0.26, 0.12, 0.38, 0.38, 0.22, 0.52], [0.16, 0.12, 0.18, 0.42, 0.08, 0.71]] },
  { body: [0.22, 0.0, 0.33, 0.165, 0.28], neck: [-0.04, -0.08, -0.24, -0.22, -0.28, -0.46, -0.42, -0.54], head: [-0.44, -0.55, 0.25],
    legs: [[0.26, 0.12, 0.28, 0.42, 0.32, 0.71], [0.16, 0.12, 0.28, 0.4, 0.08, 0.52]] },
  { body: [0.26, 0.06, 0.33, 0.165, 0.02], neck: [-0.04, 0.0, -0.22, 0.08, -0.36, 0.22, -0.46, 0.38], head: [-0.48, 0.4, 1.0],
    legs: [[0.3, 0.16, 0.36, 0.44, 0.32, 0.71], [0.2, 0.16, 0.24, 0.44, 0.12, 0.71]] },
  { body: [0.22, -0.02, 0.33, 0.165, 0.5], neck: [-0.04, -0.14, -0.22, -0.4, 0.04, -0.6, -0.08, -0.76], head: [-0.1, -0.78, -0.55],
    legs: [[0.26, 0.1, 0.27, 0.42, 0.26, 0.71], [0.16, 0.1, 0.16, 0.42, 0.13, 0.71]], catch: 1 },
  { body: [0.22, -0.02, 0.33, 0.165, 0.5], neck: [-0.04, -0.14, -0.22, -0.4, 0.04, -0.6, -0.08, -0.76], head: [-0.1, -0.78, -0.55],
    legs: [[0.26, 0.1, 0.27, 0.42, 0.26, 0.71], [0.16, 0.1, 0.16, 0.42, 0.13, 0.71]], catch: 2 },
  { body: [0.1, 0.0, 0.34, 0.13, 0.04], neck: [-0.16, 0.0, -0.3, 0.14, -0.44, 0.1, -0.42, -0.04], head: [-0.42, -0.05, 0.08], fly: 1 },
  { body: [0.1, 0.0, 0.34, 0.13, 0.04], neck: [-0.16, 0.0, -0.3, 0.14, -0.44, 0.1, -0.42, -0.04], head: [-0.42, -0.05, 0.08], fly: 2 },
  { body: [0.16, 0.06, 0.3, 0.2, 0.8], neck: [0.0, -0.14, -0.14, -0.18, -0.14, -0.34, -0.06, -0.4], head: [-0.06, -0.42, 0.65],
    legs: [null, [0.15, 0.24, 0.15, 0.46, 0.12, 0.71]], sleep: true },
];
// A point and the way along the neck's bezier n at t.
const bez = (n, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  const da = -3 * u * u, db = 3 * u * u - 6 * u * t, dc = 6 * u * t - 3 * t * t, dd = 3 * t * t;
  return [a * n[0] + b * n[2] + c * n[4] + d * n[6], a * n[1] + b * n[3] + c * n[5] + d * n[7],
    da * n[0] + db * n[2] + dc * n[4] + dd * n[6], da * n[1] + db * n[3] + dc * n[5] + dd * n[7]];
};
function heronLeg(g, leg, near) {
  if (!leg) return;
  const [hx, hy, kx, ky, fx, fy] = leg, rgb = near ? HERON_LEG : tone(HERON_LEG, 0.72), up = fy < 0.66;
  strokeIn(g, rockRGB(near ? HERON_BACK : tone(HERON_BACK, 0.8)), 0.075, () => { g.moveTo(hx, hy); g.lineTo(hx + (kx - hx) * 0.35, hy + (ky - hy) * 0.35); });   // the feathered thigh
  strokeIn(g, rockRGB(rgb), 0.034, () => { g.moveTo(hx + (kx - hx) * 0.2, hy + (ky - hy) * 0.2); g.lineTo(kx, ky); g.lineTo(fx, fy); });
  strokeIn(g, rockRGB(rgb), 0.022, () => {                                       // the toes: three forward, one back (curled, lifted)
    if (up) { g.moveTo(fx, fy); g.lineTo(fx - 0.04, fy + 0.07); g.moveTo(fx, fy); g.lineTo(fx - 0.08, fy + 0.05); return; }
    g.moveTo(fx + 0.05, fy + 0.005); g.lineTo(fx - 0.11, fy + 0.012);
    g.moveTo(fx, fy); g.lineTo(fx - 0.07, fy + 0.03);
  });
}
// A wing spread, side on: from its root along the back (r0 to r1) out to the wrist, bent forward, and on to the tip,
// swept back: broad and grey, darkening out along the hand of long flight feathers to a black fingered tip, the
// feathers along the trailing edge dark too. W: [r0x, r0y, r1x, r1y, wristx, wristy, tipx, tipy, trailx, traily]
// (trail: where the hand's fingers end on the trailing edge); far: the one behind, in shade.
const HERON_WINGS = {
  up: [-0.1, -0.03, 0.26, -0.03, -0.2, -0.46, 0.22, -0.86, 0.36, -0.5],
  down: [-0.1, 0.04, 0.26, 0.04, -0.16, 0.34, 0.26, 0.66, 0.36, 0.34],
};
function heronWing(g, W, far, dx = 0, dy = 0) {
  const [r0x, r0y, r1x, r1y, wx, wy, tx, ty, ex, ey] = W.map((v, i) => v + (i % 2 ? dy : dx)), k = far ? 0.74 : 1;
  const shape = () => {
    g.moveTo(r0x, r0y); g.quadraticCurveTo(r0x - 0.16, (r0y + wy) / 2, wx, wy);
    g.quadraticCurveTo(wx + 0.04, ty, tx, ty);
    for (let f = 1; f <= 4; f++) {                                             // the fingers, back along the end of the hand
      const u = f / 5, x = tx + (ex - tx) * u, y = ty + (ey - ty) * u;
      g.lineTo(x - 0.035, y - (ey - ty) * 0.08); g.lineTo(x, y);
    }
    g.quadraticCurveTo(ex + 0.02, (ey + r1y) / 2, r1x, r1y); g.closePath();
  };
  const mx = (r0x + r1x) / 2, my = (r0y + r1y) / 2, gr = g.createLinearGradient(mx, my, tx, ty);
  gr.addColorStop(0, rockRGB(tone(HERON_WING, k * 1.12, 8))); gr.addColorStop(0.42, rockRGB(tone(HERON_WING, k)));
  gr.addColorStop(0.62, rockRGB(tone(HERON_INK, k * 1.25))); gr.addColorStop(1, rockRGB(tone(HERON_INK, k)));
  g.fillStyle = gr; g.beginPath(); shape(); g.fill();
  g.save(); g.beginPath(); shape(); g.clip();
  strokeIn(g, rockRGB(tone(HERON_INK, k * 1.5), 0.55), 0.12, () => { g.moveTo(r1x + 0.05, r1y); g.quadraticCurveTo(ex + 0.07, (ey + r1y) / 2, ex + 0.05, ey); });   // the trailing edge
  strokeIn(g, rockRGB(tone(HERON_PALE, k * 0.95), 0.5), 0.035, () => { g.moveTo(r0x - 0.02, r0y); g.quadraticCurveTo(r0x - 0.16, (r0y + wy) / 2, wx, wy); });   // the leading edge, pale
  g.restore();
}
// What it holds up in its bill: a frog, legs dangling, or a silver fish, across the bill at (x, y).
function heronCatch(g, x, y, fish) {
  g.save(); g.translate(x, y);
  if (fish) {
    g.rotate(0.35);
    softIn(g, [196, 204, 206], -0.05, 0.05, () => { g.moveTo(-0.15, 0); g.quadraticCurveTo(0, -0.07, 0.12, 0); g.quadraticCurveTo(0, 0.07, -0.15, 0); }, 1.25, 0.65);
    fillIn(g, rockRGB([150, 160, 160]), () => { g.moveTo(0.1, 0); g.lineTo(0.2, -0.05); g.lineTo(0.19, 0.05); g.closePath(); });
    fillIn(g, '#1c1c1c', () => discAt(g, -0.1, -0.01, 0.012));
  } else {
    g.rotate(1.3); g.scale(0.2, 0.2);
    frogAt(g, true);
  }
  g.restore();
}
function paintHeron(g, size, U, pose) {
  if (shrunk(g, size, U, 'heron:' + pose)) return;
  const P = HERON_POSES[pose] || HERON_POSES[0], [bx, by, rx, ry, tilt] = P.body, n = P.neck, [hx, hy, ha] = P.head;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  if (P.fly) heronWing(g, P.fly === 1 ? HERON_WINGS.up : HERON_WINGS.down, true, 0.15, P.fly === 1 ? -0.1 : -0.04);   // the far wing
  if (P.legs) heronLeg(g, P.legs[0], false);
  if (P.fly) {                                                                    // the legs, trailing behind
    strokeIn(g, rockRGB(tone(HERON_LEG, 0.85)), 0.03, () => { g.moveTo(0.34, 0.04); g.lineTo(0.94, 0.02); g.moveTo(0.34, 0.08); g.lineTo(0.92, 0.07); });
  }
  const back = () => {                                                            // the body, and the plumes drooping over the tail
    g.save(); g.translate(bx, by); g.rotate(tilt); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.restore();
  };
  const ca = Math.cos(tilt), sa = Math.sin(tilt), at = (u, v) => [bx + u * ca - v * sa, by + u * sa + v * ca];   // a point in the body's own frame
  const [tx, ty] = at(rx * 0.95, ry * 0.2);
  softIn(g, HERON_BACK, by - ry - 0.1, by + ry + 0.1, () => {                     // the tail
    g.moveTo(...at(rx * 0.6, -ry * 0.6)); g.lineTo(tx + 0.12 * ca, ty + 0.12 * sa); g.lineTo(...at(rx * 0.6, ry * 0.8)); g.closePath();
  }, 1.1, 0.7);
  softIn(g, HERON_BACK, by - ry * 1.2, by + ry * 1.2, back, 1.2, 0.62);
  // The neck: a pale tube, lit along its front, the black streaks down it; its root sunk into the breast.
  const neckW = P.sleep ? 0.15 : P.fly ? 0.12 : 0.095;
  strokeIn(g, rockRGB(tone(HERON_PALE, 0.8)), neckW, () => { g.moveTo(n[0], n[1]); g.bezierCurveTo(n[2], n[3], n[4], n[5], n[6], n[7]); });
  strokeIn(g, rockRGB(HERON_PALE), neckW * 0.62, () => { g.moveTo(n[0] - 0.012, n[1] - 0.006); g.bezierCurveTo(n[2] - 0.016, n[3] - 0.006, n[4] - 0.016, n[5] - 0.006, n[6] - 0.012, n[7] - 0.004); });
  if (!P.sleep) {
    for (let t = 0.22; t < 0.86; t += 0.09) {                                     // the streaks down its front (the side the head faces)
      const [x, y, dx, dy] = bez(n, t), l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l, s = nx < 0 ? 1 : -1;
      fillIn(g, rockRGB(HERON_INK, 0.75), () => ovalAt(g, x + nx * s * neckW * 0.32, y + ny * s * neckW * 0.32, 0.018, 0.009, Math.atan2(dy, dx)));
    }
  }
  if (P.fly) softIn(g, HERON_PALE, n[1], n[1] + 0.2, () => ovalAt(g, n[0] - 0.12, n[1] + 0.07, 0.1, 0.07, 0.3), 1.05, 0.7);   // the neck, folded down under the head
  // The breast: pale plumes hanging over the front of the body.
  if (!P.fly) softIn(g, HERON_PALE, n[1] - 0.04, n[1] + 0.26, () => {
    const [px, py] = at(-rx * 0.82, 0);
    g.moveTo(n[0] + 0.06, n[1] - 0.02); g.quadraticCurveTo(px - 0.1, py - 0.02, px - 0.02, py + 0.16); g.lineTo(px + 0.08, py + 0.04); g.closePath();
  }, 1.05, 0.78);
  // The folded wing (or the near wing spread), the black patch at its bend, the grey plumes over the tail.
  if (P.fly) heronWing(g, P.fly === 1 ? HERON_WINGS.up : HERON_WINGS.down, false);
  else {
    const wing = () => { g.save(); g.translate(...at(rx * 0.12, -ry * 0.12)); g.rotate(tilt); g.ellipse(0, 0, rx * 0.8, ry * 0.7, 0, 0, TAU); g.restore(); };
    softIn(g, HERON_WING, by - ry, by + ry * 0.6, wing, 1.15, 0.7);
    fillIn(g, rockRGB(HERON_INK, 0.85), () => { const [x, y] = at(-rx * 0.62, -ry * 0.42); ovalAt(g, x, y, 0.06, 0.04, tilt); });
    const [p0x, p0y] = at(rx * 0.05, -ry * 0.8), [p1x, p1y] = at(rx * 1.5, ry * 0.55), [p2x, p2y] = at(rx * 0.35, ry * 0.25);
    softIn(g, tone(HERON_BACK, 1.1), by - ry, by + ry + 0.1, () => {          // the long grey plumes drooping off the back
      g.moveTo(p0x, p0y); g.quadraticCurveTo(...at(rx * 1.0, -ry * 0.9), p1x, p1y);
      g.quadraticCurveTo(...at(rx * 0.9, ry * 0.45), p2x, p2y); g.closePath();
    }, 1.12, 0.8);
    strokeIn(g, rockRGB(tone(HERON_BACK, 0.75), 0.55), 0.011, () => {
      for (const v of [-0.45, -0.05]) { const [x0, y0] = at(rx * 0.5, ry * v); g.moveTo(x0, y0); g.quadraticCurveTo(...at(rx * 1.1, ry * (v + 0.35)), p1x - 0.02, p1y - 0.005); }
    });
    if (!P.sleep) fillIn(g, rockRGB(HERON_INK, 0.6), () => { const [x, y] = at(-rx * 0.3, ry * 0.75); ovalAt(g, x, y, rx * 0.42, 0.018, tilt); });   // the dark band down its flank
  }
  heronLeg(g, P.legs?.[1], true);
  // The head: white, a black stripe back from the eye into a trailing crest, the bill a long yellow dagger.
  g.save(); g.translate(hx, hy); g.rotate(-ha);
  const bill = () => { g.moveTo(-0.06, -0.035); g.quadraticCurveTo(-0.24, -0.03, -0.42, 0.012); g.quadraticCurveTo(-0.24, 0.03, -0.06, 0.038); g.closePath(); };
  softIn(g, HERON_BILL, -0.04, 0.04, bill, 1.2, 0.72);
  strokeIn(g, rockRGB(tone(HERON_BILL, 0.6), 0.6), 0.008, () => { g.moveTo(-0.07, 0.004); g.lineTo(-0.38, 0.01); });
  softIn(g, HERON_PALE, -0.07, 0.07, () => ovalAt(g, 0, 0, 0.088, 0.066), 1.1, 0.78);
  fillIn(g, rockRGB(HERON_INK), () => { g.moveTo(-0.04, -0.03); g.quadraticCurveTo(0.04, -0.08, 0.09, -0.02); g.quadraticCurveTo(0.03, -0.02, -0.04, -0.012); g.closePath(); });
  strokeIn(g, rockRGB(HERON_INK), 0.016, () => { g.moveTo(0.06, -0.035); g.quadraticCurveTo(0.16, -0.05, 0.26, -0.02); g.moveTo(0.06, -0.025); g.quadraticCurveTo(0.14, -0.03, 0.22, 0.0); });
  if (P.sleep) strokeIn(g, rockRGB(HERON_INK, 0.8), 0.012, () => { g.moveTo(-0.055, -0.012); g.quadraticCurveTo(-0.035, -0.002, -0.015, -0.012); });
  else {
    fillIn(g, '#e8cf52', () => discAt(g, -0.035, -0.014, 0.017));
    fillIn(g, '#16130f', () => discAt(g, -0.038, -0.014, 0.009));
  }
  g.restore();
  if (P.catch) {
    const c = Math.cos(ha), s = Math.sin(ha);
    heronCatch(g, hx - 0.26 * c, hy + 0.26 * s + 0.01, P.catch === 2);
  }
  furGlow(g, [255, 255, 255], 0.16, bx - 0.04, by - ry * 0.7, rx * 0.6, ry * 0.4, tilt);   // the light along the back
}

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

// A bird's remains are a few feathers: a crow's ('remains:0'; 'remains:1', an owl's barred brown ones, from when there were owls). An otter's
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
const FOX_COAT = [206, 108, 58];   // (its white and socks: FOX_WHITE, FOX_SOCK, in fur.js)
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
// A living fox is painted (fur.js: FOX_POSES, paintFox), not the 🦊 emoji. 'fox:' + (fur step << 4) + pose.
const FOX_ARTS = Array.from({ length: 11 << 4 }, (_, n) => 'fox:' + n);   // (made once: a frame builds no names)
const foxArtOf = (fur, pose) => FOX_ARTS[(Math.round(fur * 10) << 4) + FOX_POSE[pose]];   // a few shades keep the sprite cache small

// Painting a fox takes a few times longer than the emoji did, and a dozen poses, cubs growing and zooming all ask
// for new sizes: so a painted animal (a fox, a rabbit) is painted only at doublings of its size (from FUR_PAINTED
// pixels up, so a phone's sharp screen doesn't paint three times over), and each size between is the painting the
// next size up, shrunk. True if it was.
const FUR_PAINTED = 64;
// The size a fox's or a rabbit's sprite px across is painted at: px itself at a doubling, else the doubling above.
const furPainted = px => 2 ** Math.ceil(Math.max(Math.log2(FUR_PAINTED / dpr), Math.log2(px) - 1e-6));   // (a power of two, as poseStep keeps it)
function shrunk(g, size, U, art) {
  const px = U / dpr, painted = furPainted(px);
  if (px >= painted - 0.5) return false;
  const m = sprite(art, painted);
  g.imageSmoothingQuality = 'high';                                             // (once, not every frame)
  g.drawImage(m.canvas, 0, 0, size, size);
  return true;
}
function paintFox(g, size, U, n) {
  if (!shrunk(g, size, U, 'fox:' + n)) Fur.paintFox(g, size, U, n);
}

// A painting is 3 to 10 ms, more close up, and each new pose or size of a fox or a rabbit wants one: in the meadow
// they're painted off the main thread, by fur-worker.js. Shrinking one for the sizes between, or mixing a part-white
// rabbit's brown and white, is quick, and done here once what it's made from has come.
const furKind = art => art.slice(0, art.indexOf(':'));
const FUR_STARTS = Object.keys(Fur.painters).map(k => k + ':');   // (sprite asks isFur of every picture it draws: no new strings)
const isFur = art => { for (let i = 0; i < FUR_STARTS.length; i++) if (art.startsWith(FUR_STARTS[i])) return true; return false; };
const furSent = new Map();                       // the paintings asked of the worker: key -> { px, dpr, look }
let furWorker = null;
if (window.Worker && window.OffscreenCanvas) {
  try {
    furWorker = new Worker('fur-worker.js');
    furWorker.postMessage({ coats: furCoats(), winter: S.WINTER_COAT });
    furWorker.onmessage = e => {
      const { key, image } = e.data, job = furSent.get(key);
      furSent.delete(key);
      if (!image) { furWorker = null; return; }  // it can't paint there: they're painted here, as before
      if (spriteCache.has(key)) { image.close(); return; }   // (painted here meanwhile)
      const bytes = image.width * image.height * 4;
      if (spriteCache.size > 2000 || spriteBytes + bytes > SPRITE_BYTES) dropSprites(bytes);
      spriteBytes += bytes;
      const s = { canvas: image, size: image.width / job.dpr, px: job.px, look: job.look, used: spriteFrame };
      spriteCache.set(key, s); latestLook.set(job.look, s);
    };
    furWorker.onerror = () => { furWorker = null; };
  } catch (e) { furWorker = null; }
}
// Whether this fox's or rabbit's sprite is there or can be made now from paintings that are; if not, the worker is
// asked for the ones it's made from.
function furReady(art, px) {
  if (spriteCache.has(px + '|' + art + '||')) return true;
  const P = furPainted(px), kind = furKind(art), n = +art.slice(kind.length + 1), white = kind === 'rabbit' ? (n >> 4) % 5 : 0;
  if (white % 4 === 0) return furHas(art, P);
  const brown = n - (white << 4), a = furHas(RABBIT_ARTS[brown], P), b = furHas(RABBIT_ARTS[brown + (4 << 4)], P);
  return a && b;
}
// A painting at P there, or asked for.
function furHas(art, P) {
  const key = P + '|' + art + '||';
  if (spriteCache.has(key)) return true;
  if (!furSent.has(key)) {
    const kind = furKind(art);
    furSent.set(key, { px: P, dpr, look: art + '||' });
    furWorker.postMessage({ key, kind, n: +art.slice(kind.length + 1), px: P, dpr });
  }
  return false;
}
// Each look of fox and rabbit about the screen (a fox's shade, a rabbit's coat and how white it's gone) is asked of the
// worker before the first of it is on screen, so there's kin to stand in while its poses come (furKin); otherwise that
// first one is painted here. One whose paintings were let go (dropSprites) is asked for again after FUR_AGAIN.
const furAsked = new Map(), FUR_AGAIN = 5000;    // look: when it was last asked for
function furAhead(now) {
  if (!furWorker) return;
  const reach = Math.max(vw, vh), seen = new Set();
  for (const c of world.creatures) {
    const fox = c.species === 'fox';
    if (!c.alive || !fox && c.species !== 'rabbit') continue;
    const coat = fox ? null : coatLook(c) || COAT.wild, white = fox ? 0 : whiteStep(c);
    const look = fox ? Math.round(c.genes.fur * 10) : 100 + coat.n + white;
    if (seen.has(look) || now - (furAsked.get(look) ?? -Infinity) < FUR_AGAIN) continue;
    const [sx, sy] = toScreen(c.x, c.y);
    if (!visible(sx, sy, reach)) continue;
    seen.add(look);
    const art = fox ? foxArtOf(c.genes.fur, 'stand') : rabbitArtOf(coat, 'sit', white);
    if (furKin(art)) continue;
    furAsked.set(look, now);
    furReady(art, poseStep(Math.max(4, creaturePx(c))));
  }
  if (world.visitors) for (const v of world.visitors) {    // (and a visitor fur.js paints: the dragonflies, the kingfisher, the skylark)
    const art = VISITORS[v.kind].art;
    if (!isFur(art) || furKin(art) || now - (furAsked.get(art) ?? -Infinity) < FUR_AGAIN) continue;
    furAsked.set(art, now);
    furReady(art, poseStep(Math.max(4, visitorPx(v))));
  }
}
// The same fox or rabbit (or visitor) in another pose, at any size: it stands in for one being painted. (A painting's
// look is its number past the last 16, its pose the rest.)
function furKin(art) {
  const kind = furKind(art), n = +art.slice(kind.length + 1) & ~15;
  for (let p = 0; p < 16; p++) {
    const s = latestLook.get(kind + ':' + (n + p) + '||');
    if (s) return s;
  }
  return null;
}

// How a fox or a rabbit is getting along, worked out once a frame from where it's drawn (drawnAt): the frames since it
// last moved (one stood still in a mode that moves just stands), which way it's going (hx, hy), and how far through
// its stride it is (step, in strides: the ground covered over STRIDE, at most GAIT_MAX a frame, so at speed the legs
// still read). Paused, it all holds, so one caught mid-stride stays that way.
const STRIDE = { rabbit: [0.75, 1.4], fox: [0.65, 1.3] };   // a hop or a trot, and a bound or a gallop, in its sizes
const GAIT_MAX = 0.11;
const gaits = new WeakMap();
const fastGait = c => c.mode === 'flee' || c.mode === 'chase';
const strideOf = c => STRIDE[c.species][fastGait(c) ? 1 : 0] * creaturePx(c) / cam.zoom;
function gaitOf(c) {
  let s = gaits.get(c);
  if (!s) gaits.set(c, s = { x: 0, y: 0, frames: 99, at: -1, hx: c.facing > 0 ? 1 : -1, hy: 0, step: c.id * 0.618 % 1 });
  if (s.at === spriteFrame) return s;
  const first = s.at < 0, p = drawnAt(c), dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
  s.at = spriteFrame; s.x = p.x; s.y = p.y;
  if (first || ui.speed <= 0) return s;
  if (d === 0) { s.frames++; return s; }
  s.frames = 0;
  if (d > 2) return s;                                            // put somewhere, not walked there
  s.step += Math.min(d / strideOf(c), GAIT_MAX);
  s.hx += (dx / d - s.hx) * 0.3; s.hy += (dy / d - s.hy) * 0.3;
  const h = Math.hypot(s.hx, s.hy) || 1; s.hx /= h; s.hy /= h;
  return s;
}
const movedLately = c => gaitOf(c).frames < 12;
const onTheMove = c => MOVING.has(c.mode) && movedLately(c);
// Above this speed it's a blur: the gaits keep to two of their paintings, so a quick meadow doesn't paint the rest.
const FEW_FRAMES = 4;

// A rabbit hops: in the air for HOP.air of each hop, covering HOP.ahead of the ground, and the rest while it's down,
// where it all but stops. The sim moves it evenly, so it's drawn a little ahead of or behind where it is, along its
// way (hopSurge, in tiles), the same on average. Up to SMOOTH_SPEED: quicker, it's just where it is.
const HOP = { air: [0.55, 0.65], ahead: [0.9, 0.85], high: [0.16, 0.2] };   // a hop, and a bound
function hopSurge(c) {
  if (ui.speed > SMOOTH_SPEED || !onTheMove(c)) return 0;
  const f = fastGait(c) ? 1 : 0, A = HOP.air[f], P = HOP.ahead[f], u = gaitOf(c).step % 1;
  const done = u < A ? P * u / A : P + (1 - P) * (u - A) / (1 - A), mean = A * P / 2 + (1 - A) * (1 + P) / 2;
  return (done - u - (mean - 0.5)) * strideOf(c);
}
const walkerArt = (c, px, now) => c.species === 'fox' ? shownPose(c, foxArt(c, px), px) : c.species === 'rabbit' ? shownPose(c, rabbitArt(c, now), px)
  : c.species === 'bee' ? beeArt(c, px, now) : c.sp.emoji;
// A pose not painted yet waits, as a tree's new colours do (shownLook): the fox or rabbit holds the pose it was last
// drawn in till the worker has painted it (it's not painted at any size yet), or without a worker, a frame longer
// once the frame has done its painting (PAINT_MS). A crowd all setting off at once wanted a dozen in one frame.
const poseShown = new WeakMap();                         // fox or rabbit: the painting it was last drawn in
function shownPose(c, art, px) {
  const was = poseShown.get(c);
  if (was !== undefined && was !== art && standIns && (furWorker
    ? !furReady(art, poseStep(Math.max(4, px))) && !latestLook.has(art + '||')
    : paintedMs > PAINT_MS && !spriteReady(art, px))) return was;
  poseShown.set(c, art);
  return art;
}

// Which painting, for what the fox is doing. On the move its legs go round with the ground it covers (gaitOf), a quarter
// stride a painting, so they stop when it stops; standing still a while in a mode that moves, it just stands.
function foxArt(c, px) {
  const art = pose => foxArtOf(c.genes.fur, pose);
  if (c.sleeping) return art('sleep');
  if (c.mode === 'eat') return art('feed');
  if (c.mode === 'rest' || c.mode === 'tired') return art('sit');
  if (onTheMove(c)) {
    let k = Math.floor(gaitOf(c).step % 1 * 4);
    if (ui.speed > FEW_FRAMES) k &= 2;
    return art((fastGait(c) ? 'run' : 'trot') + (k + 1));
  }
  return art('stand');
}

// ------------------------------------------------------------------ the rabbit
//
// Painted (fur.js: RABBIT_POSES, paintRabbit), not the 🐇 emoji. 'rabbit:' + (look << 4) + pose; look = coat * 5 + white step.
const RABBIT_ARTS = Array.from({ length: RABBIT_KINDS.length * 5 << 4 }, (_, n) => 'rabbit:' + n);
const rabbitArtOf = (look, pose, white = 0) => RABBIT_ARTS[((look.n + white) << 4) + RABBIT_POSE[pose]];

function paintRabbit(g, size, U, n) {
  if (shrunk(g, size, U, RABBIT_ARTS[n])) return;
  const step = (n >> 4) % 5;
  if (step % 4) {                    // part white: only brown and white are painted, the steps between are the two mixed
    const brown = n - (step << 4), px = U / dpr;
    g.drawImage(sprite(RABBIT_ARTS[brown], px).canvas, 0, 0, size, size);
    g.globalAlpha = step / 4;
    g.drawImage(sprite(RABBIT_ARTS[brown + (4 << 4)], px).canvas, 0, 0, size, size);
    g.globalAlpha = 1;
    return;
  }
  Fur.paintRabbit(g, size, U, n);
}

// Which painting, for what the rabbit is doing. On the move, where it is in its hop (HOP): down and gathered, then off
// its hind feet, stretched out in the air and down on its forefeet; fleeing, the same flat out with its ears back.
const RABBIT_GAIT = [['hop1', 'push', 'hop2', 'land'], ['run2', 'rpush', 'run1', 'rland']];
function rabbitArt(c, now) {
  const look = coatLook(c) || COAT.wild, white = whiteStep(c), art = pose => rabbitArtOf(look, pose, white);
  if (c.sleeping) return art('sleep');
  if (c.mode === 'alarm') return art('alarm');
  if (c.mode === 'graze' || c.mode === 'munch') return art('graze');
  if (c.mode === 'rest') return art('loaf');
  if (atHole(c)) return art('dig');
  if (!movedLately(c)) return art('sit');
  const f = fastGait(c) ? 1 : 0, A = HOP.air[f], u = gaitOf(c).step % 1, v = u / A, poses = RABBIT_GAIT[f];
  if (u >= A) return art(poses[0]);
  return art(ui.speed > FEW_FRAMES ? poses[2] : poses[v < 0.25 ? 1 : v < 0.75 ? 2 : 3]);
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
  ['🥺', g => {                                          // hungry: an empty bowl
    fillIn(g, '#b07a4a', () => { g.moveTo(-0.88, 0); g.ellipse(0, 0, 0.88, 0.7, 0, Math.PI, 0, true); g.closePath(); });
    fillIn(g, '#8a5a34', () => ovalAt(g, 0, 0, 0.88, 0.24));
    fillIn(g, '#5e3c22', () => ovalAt(g, 0, 0.02, 0.72, 0.16));
    fillIn(g, '#c99467', () => ovalAt(g, -0.45, 0.35, 0.16, 0.1, 0.3));
  }],
  ['🐸', g => frogAt(g)],                               // a frog (an otter after them)
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

// When an animal starts doing something worth seeing (POPS: it spots a fox, runs, gives chase, falls for someone), a
// little bubble with what it's thinking pops up over its head, stays a moment and fades. Nothing stays up, so nobody
// is covered; what each is up to is in the label on hover and in the inspector. Only for those on screen, and only up
// to POP_SPEED: quicker, moods change faster than they'd read. At most POP_LIVE up at once, so a pop still means
// something when a fox walks through a warren; and love only for the one you follow (in spring it's everyone).
const POPS = new Set(['alarm', 'flee', 'chase', 'stalk']);
const POP_MS = 1700, POP_IN = 160, POP_OUT = 450, POP_SPEED = 4, POP_LIVE = 3;
const pops = new WeakMap();          // { mode, emoji, at }: the mode it was last seen in, and its pop
const popsUp = [];                   // when the pops up now began (the one you follow's aren't counted)
function drawPops(shown, now) {
  while (popsUp.length && now - popsUp[0] >= POP_MS) popsUp.shift();
  for (const it of shown) {
    const c = it.c;
    if (LOOKS[c.species].quiet) continue;
    let p = pops.get(c);
    if (!p) { pops.set(c, { mode: c.mode, emoji: '', at: 0 }); continue; }
    if (p.mode !== c.mode) {
      p.mode = c.mode;
      const followed = c.id === ui.selectedId;
      if ((POPS.has(c.mode) || followed && c.mode === 'love') && ui.speed > 0 && ui.speed <= POP_SPEED && (followed || popsUp.length < POP_LIVE)) {
        p.emoji = S.mood(world, c).emoji; p.at = now;
        if (!followed) popsUp.push(now);
      }
    }
    const t = now - p.at;
    if (t >= POP_MS || !p.emoji) continue;
    const px = creaturePx(c), up = c.sp.flies ? liftOf(c, px, now) : hopOf(c, px, now);
    const grow = t < POP_IN ? Math.sin(t / POP_IN * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1;   // out a touch too far, and back
    ctx.globalAlpha = Math.min(1, (POP_MS - t) / POP_OUT);
    drawBubble(p.emoji, it.sx, it.sy - up, px, grow);
  }
  ctx.globalAlpha = 1;
}

function drawBubble(emoji, sx, sy, px, grow = 1) {
  const r = Math.max(8, px * 0.28), k = r * grow;
  const bx = sx + px * 0.3, by = sy - px * 0.7 - r * 0.6;
  const art = BUBBLE_ART.get(emoji);
  if (art) {
    const want = r / BUBBLE_R, s = sprite(art, want), size = s.size * grow;   // (painted at its full size, drawn smaller)
    ctx.drawImage(s.canvas, bx - BUBBLE_AT[0] * want * grow - size / 2, by - BUBBLE_AT[1] * want * grow - size / 2, size, size);
    return;
  }
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = 'rgba(80, 60, 30, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bx, by, k, 0, TAU);
  ctx.moveTo(bx - k * 0.5, by + k * 0.75);
  ctx.lineTo(bx - k * 0.9, by + k * 1.3);
  ctx.lineTo(bx - k * 0.05, by + k * 0.95);
  ctx.fill(); ctx.stroke();
  const e = sprite(emoji, r * 1.3, undefined, undefined, true), size = e.size * grow;
  ctx.drawImage(e.canvas, bx - size / 2, by - size / 2, size, size);
}


// A label (the name over the one followed, or under the mouse) is painted once a text and copied after, in whole pixels so
// it stays sharp: setting the font and measuring the text every frame was most of what drawing one cost.
const LABEL_FONT = '800 12px Nunito, ui-rounded, system-ui, sans-serif', labels = new Map();
function drawLabel(text, x, y) {
  let l = labels.get(text);
  if (!l || l.dpr !== dpr) {
    if (labels.size > 40) { for (const o of labels.values()) freeImage(o.c); labels.clear(); }
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = LABEL_FONT;
    const w = g.measureText(text).width + 16;
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(22 * dpr);
    g.scale(dpr, dpr);
    g.fillStyle = 'rgba(255, 250, 240, 0.95)';
    g.beginPath(); g.roundRect(0, 0, w, 22, 11); g.fill();
    g.font = LABEL_FONT; g.fillStyle = '#3b372f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, 11.5);
    labels.set(text, l = { c, w, dpr });
  }
  ctx.drawImage(l.c, Math.round((x - l.w / 2) * dpr) / dpr, Math.round(y * dpr) / dpr, l.c.width / dpr, l.c.height / dpr);
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
  if (!c.hidden) {
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
  const label = c.hidden ? `${c.name} is ${c.species === 'crow' ? 'in the nest' : c.species === 'otter' ? 'in the holt' : `inside the ${c.species === 'bee' ? 'hive' : 'burrow'}`}` : c.name;
  drawLabel(label, sx, sy + (c.hidden ? cam.zoom : creaturePx(c) * 0.55) + 6);
}

// Where the sun is: shadows lean west in the morning and east in the evening,
// and fade at night and under cloud.
function sun(ck) {
  const m = ui.sky.mix;
  const cover = clamp(0.5 * m.cloudy + 0.7 * m.rain + 0.9 * m.storm + 0.8 * m.fog + 0.5 * m.snow, 0, 0.85);
  return { lean: clamp((ck.phase - 0.36) / 0.34, -1, 1) * lightSwing, a: (1 - 1.6 * shownDark(ck.phase)) * (1 - cover) };
}

// Trees and rocks cast a soft shadow, a cool green-blue, painted once and stretched under each. On snow a shadow
// is lit by the sky: as the snow lies it turns a pale blue and lighter, in a few steps (shadeStep), each painted once.
const SHADE_RGB = [24, 48, 44], SNOW_SHADE = [92, 120, 178], SNOW_SHADE_A = 0.6;   // on deep snow: this blue, this much as strong
const SHADE_STEPS = 4;
const SOFT_SHADOWS = Array.from({ length: SHADE_STEPS + 1 }, (_, i) => {   // (each an ImageBitmap once it's ready: asBitmap)
  const k = i / SHADE_STEPS, rgb = SHADE_RGB.map((v, j) => Math.round(lerp(v, SNOW_SHADE[j], k))), a = lerp(1, SNOW_SHADE_A, k);
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${rgb}, ${a})`); r.addColorStop(0.5, `rgba(${rgb}, ${0.85 * a})`); r.addColorStop(1, `rgba(${rgb}, 0)`);
  g.scale(1, 0.5); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  asBitmap(c, b => { SOFT_SHADOWS[i] = b; });
  return c;
});
// How far the shadows have gone over to the snow's: as far as the ground shows snow (ground.js: snow × 1.4 − 0.2, at most 0.9).
const shadeStep = () => Math.round(clamp((world.snow * 1.4 - 0.2) / 0.9, 0, 1) * SHADE_STEPS);
// A tree also keeps a dark patch at its foot, day and night, so it stands on the ground.
function drawDecorShadow(d, sx, sy, sn, px = d.tree ? treePx(d) : d.size * cam.zoom) {   // (px: render has it already)
  if (treeWaits.get(d) === 0) return;                      // not drawn yet (drawPaintedTree)
  if (d.tree && d.size < S.SAPLING && !d.stump && (d.size < S.SEEDLING || d.size * cam.zoom < 20)) return;   // too small for one
  const shade = SOFT_SHADOWS[shadeStep()];
  if (d.fallen) {                                         // a log: along it
    const s = px;
    ctx.globalAlpha = 0.35 + 0.2 * Math.max(0, sn.a);
    ctx.drawImage(shade, sx - s * 0.5, sy - s * 0.05, s, s * 0.12);
    ctx.globalAlpha = 1;
    return;
  }
  const tree = d.tree && !d.stump, s = px * (d.stump ? 0.45 : d.dead ? 0.6 : 1);
  if (tree && s < PAIR_PX && sn.a > 0.02 && fade === 1) {   // (in the mist the two fade apart: drawn apart)
    const p = shadowPair(sn);
    if (p) { ctx.drawImage(p.image, sx + p.x * s, sy + p.y * s, p.w * s, p.h * s); return; }
  }
  if (tree) {
    const cw = s * 0.2, ch = s * 0.06;
    ctx.globalAlpha = 0.4 + 0.25 * Math.max(0, sn.a);
    ctx.drawImage(shade, sx - cw, sy - ch * 0.8, cw * 2, ch * 2);
  }
  if (sn.a <= 0.02) { ctx.globalAlpha = 1; return; }
  const w = s * (d.tree ? 0.34 : 0.42), h = s * 0.12, off = sn.lean * s * 0.22;
  const W = (w + Math.abs(off) * 0.6) * 2.5, H = h * 2.6;   // the soft edge takes a bit off, so a bit bigger
  ctx.globalAlpha = (tree ? 0.55 : 0.3) * sn.a;
  ctx.drawImage(shade, sx + off - W / 2, sy + h * 0.4 - H / 2, W, H);
  ctx.globalAlpha = 1;
}

// A tree's two shadows, the dark patch at its foot and the one the sun casts, are the same in a frame for every tree but
// for its size. So for a tree drawn small (PAIR_PX) they're painted together once, with the sun's lean and strength in
// steps too fine to see at that size, and drawn in one go: zoomed out, they were half of all the drawing. Till that
// picture is a bitmap, the two are drawn as before.
const PAIR_PX = 64, PAIR_LEAN = 32, PAIR_A = 32, PAIR_RES = 96, PAIR_KEEP = 256;   // (PAIR_RES: its pixels to a tree's size; PAIR_KEEP of them, ~20 kB each)
const shadowPairs = new Map();
function shadowPair(sn) {
  const step = shadeStep(), li = Math.round(sn.lean * PAIR_LEAN), ai = Math.round(clamp(sn.a, 0, 1) * PAIR_A);
  const key = (step * (2 * PAIR_LEAN + 1) + li + PAIR_LEAN) * (PAIR_A + 1) + ai;
  let p = shadowPairs.get(key);
  if (p) return p.image ? p : null;
  if (shadowPairs.size >= PAIR_KEEP) {                      // the oldest goes
    const [k, q] = shadowPairs.entries().next().value;
    if (q.image) freeImage(q.image);
    shadowPairs.delete(k);
  }
  const lean = li / PAIR_LEAN, a = ai / PAIR_A, shade = SOFT_SHADOWS[step];   // (drawDecorShadow's, a tree's size 1)
  const cw = 0.2, ch = 0.06, w = 0.34, h = 0.12, off = lean * 0.22, W = (w + Math.abs(off) * 0.6) * 2.5, H = h * 2.6;
  const x0 = Math.min(-cw, off - W / 2), x1 = Math.max(cw, off + W / 2), y0 = Math.min(-ch * 0.8, h * 0.4 - H / 2), y1 = Math.max(ch * 1.2, h * 0.4 + H / 2);
  const c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * PAIR_RES); c.height = Math.ceil((y1 - y0) * PAIR_RES);
  const g = c.getContext('2d');
  g.scale(PAIR_RES, PAIR_RES); g.translate(-x0, -y0);
  g.globalAlpha = 0.4 + 0.25 * a; g.drawImage(shade, -cw, -ch * 0.8, cw * 2, ch * 2);
  g.globalAlpha = 0.55 * a; g.drawImage(shade, off - W / 2, h * 0.4 - H / 2, W, H);
  p = { image: null, x: x0, y: y0, w: c.width / PAIR_RES, h: c.height / PAIR_RES };
  shadowPairs.set(key, p);
  asBitmap(c, b => { if (shadowPairs.get(key) === p) p.image = b; else b.close(); });
  return null;
}

// Animals lean their shadow with the sun like the trees do, and keep a faint one at their feet
// at night and under cloud so they never float. A hop lifts them off it and it shrinks, less for a
// pouncing fox than a flier, so the leap reads. On snow it goes the snow's pale blue, like the trees'.
const FEET_RGB = [40, 50, 20];
// (Its colour a style made once, its strength the alpha: a colour string made and read for every animal every frame cost.)
const FEET_SHADES = Array.from({ length: SHADE_STEPS + 1 }, (_, i) => `rgb(${FEET_RGB.map((v, j) => Math.round(lerp(v, SNOW_SHADE[j], i / SHADE_STEPS)))})`);
function drawCreatureShadow(c, sx, sy, now, sn) {
  if (wading(c)) return;
  const px = creaturePx(c), lift = 1 - Math.min(c.sp.flies ? 0.8 : 0.5, liftOf(c, px, now) / px);
  const n = shadeStep(), a = (0.14 + 0.16 * Math.max(0, sn.a)) * lerp(1, SNOW_SHADE_A, n / SHADE_STEPS), off = Math.max(0, sn.a) * sn.lean * px * 0.2;
  ctx.fillStyle = FEET_SHADES[n];
  ctx.globalAlpha = a * lift;
  ctx.beginPath();
  ctx.ellipse(sx + off, sy + px * 0.36, (px * 0.34 + Math.abs(off) * 0.6) * lift, px * 0.1 * lift, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Trees sway from the trunk. Gusts roll across the meadow, harder in rain and storms.
function treeSway(d, now) {
  const m = ui.sky.mix, wind = 0.018 + 0.01 * m.cloudy + 0.03 * m.rain + 0.07 * m.storm;
  return wind * (Math.sin(now / 900 - d.x * 0.15) + 0.35 * Math.sin(now / 340 + d.y));
}

// The trees follow real ones, loosely. Broadleaf 🌳: in autumn the green drains away and each
// tree shows its kind's colour (the sim says which kind, plantTrees): gold (birch), orange
// (beech), red (maple), russet (oak, hawthorn), or a dull olive (alder). Then the leaves drop and it stands bare, except the oaks, which hold on to their dry
// brown leaves all winter. In spring they leaf out lime green. Pines 🌲 stay green, but not
// quite the same green: old inner needles yellow in autumn, the whole tree bronzes a little in
// the cold, and new tips come in light at the end of spring. Snow settles on top of them all.
// Some broadleaf trees are fruit trees, mostly out in the open (sim.js, plantTrees). An apple tree flowers
// white in spring, hangs apples from high summer and drops windfalls in autumn. A cherry comes
// into leaf pink, a cloud of blossom that turns green and sheds petals, then cherries in early
// summer and red leaves in autumn. No two broadleaf trees are quite the same green, and half of
// all trees are drawn mirrored.
const AUTUMN = { birch: [238, 192, 56], alder: [112, 116, 50], beech: [240, 130, 40], maple: [200, 50, 42], oak: [176, 100, 52], hawthorn: [176, 100, 52] };
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

function treeLook(d, ck, full = true) {   // full: with the look and the bare look an emoji tree is drawn in (not a painted one)
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
      drop = leafDrop(sp, lag, oak);
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
  if (!full) return { look: undefined, fall, bare: undefined, drop, rgb, h, ground, flip: info.flip };
  const snow = step(world.snow * 1.6 - 0.1, 4), seed = h % 3;
  const look = m || fall || snow
    ? { rgb, m, where, fall, snow, seed, blossom, bloom, fruit,
        key: [rgb, m, where, fall, snow, seed, blossom && bloom, blossom, fruit ? fruit.e + fruit.n : ''].join('|') } : undefined;
  const bare = fall && { snow, seed, m: 0, fall: 0, key: `bare|${snow}` };
  return { look, fall, bare, drop, rgb, h, ground, flip: info.flip };
}

// What lies under a painted tree (treeLook's ground, but a painted cherry has its own petals): in autumn the sim's
// windfalls, apples under an apple tree, else acorns or beechnuts.
const FALL_APPLES = { e: '🍎', n: 0, size: 0.12 }, FALL_NUTS = { e: '🌰', n: 0, size: 0.07 };
function windfallsUnder(d, ck) {
  if (ck.season !== 2 || !d.windfall || d.emoji === '🌲') return null;
  const g = treeInfo(d).fruit === 'apple' ? FALL_APPLES : FALL_NUTS;
  g.n = d.windfall;
  return g;
}

// Windfalls lying in the grass, for the sprite cache: 'fall:0' an apple, 'fall:1' an acorn (or a beechnut).
function paintFall(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  softSpot(g, 0.05, 0.62, 0.8, 0.22, '30, 40, 14', 0.45);
  if (n === 0) {
    g.scale(1.12, 1.12);
    softIn(g, [196, 44, 36], -0.6, 0.65, () => { discAt(g, -0.22, 0.05, 0.56); discAt(g, 0.22, 0.05, 0.56); }, 1.25, 0.62);
    furGlow(g, [255, 200, 170], 0.55, -0.28, -0.2, 0.2, 0.14, -0.4);
    strokeIn(g, '#5a3a1c', 0.1, () => { g.moveTo(0, -0.42); g.quadraticCurveTo(0.04, -0.62, 0.14, -0.72); });
    fillIn(g, '#6aa84a', () => ovalAt(g, 0.36, -0.62, 0.24, 0.1, -0.5));
  } else {
    g.translate(0, 0.1); g.scale(1.4, 1.4);
    softIn(g, [176, 120, 54], -0.3, 0.7, () => ovalAt(g, 0, 0.18, 0.4, 0.5), 1.2, 0.65);
    furGlow(g, [255, 220, 160], 0.5, -0.12, 0, 0.12, 0.2);
    softIn(g, [112, 84, 48], -0.6, -0.05, () => {                                  // the cup
      g.moveTo(-0.5, -0.12); g.quadraticCurveTo(-0.48, -0.6, 0, -0.6); g.quadraticCurveTo(0.48, -0.6, 0.5, -0.12); g.quadraticCurveTo(0, 0, -0.5, -0.12);
    }, 1.2, 0.7);
    strokeIn(g, 'rgba(60,40,20,0.5)', 0.04, () => { for (const x of [-0.3, -0.1, 0.1, 0.3]) { g.moveTo(x, -0.5); g.lineTo(x * 1.2, -0.14); } });
    strokeIn(g, '#5a3a1c', 0.08, () => { g.moveTo(0, -0.6); g.lineTo(0.04, -0.76); });
  }
}
const FALL_ART = { '🍎': 'fall:0', '🌰': 'fall:1' };

// Windfalls and petals lying under a tree: those behind the trunk go down first, then the rest.
function drawUnderTree(bits, h, sx, sy, px, front) {
  const art = FALL_ART[bits.e] || bits.e;
  for (let k = 0; k < bits.n; k++) {
    const a = hash2(h, k, 21) * TAU, r = 0.2 + 0.3 * hash2(h, k, 22), y = sy + Math.sin(a) * r * px * 0.35;
    if ((y >= sy) !== front) continue;
    ctx.save(); ctx.translate(sx + Math.cos(a) * r * px, y); ctx.rotate((hash2(h, k, 23) - 0.5) * 1.5);
    drawEmoji(art, 0, 0, px * bits.size);
    ctx.restore();
  }
}

// An emoji tree's leaves let go in autumn and tumble down, drifting east with the wind. Trees queue them up
// as they are drawn, and they are drawn on top of everything once the trees are done. (A painted tree's: drawLeaves.)
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

// How fast a tree's leaves are coming down, sp into autumn: from when it's a third turned till it's bare, an oak
// (which keeps its dry leaves) a third as fast.
function leafDrop(sp, lag, oak) {
  const turn = clamp((sp - 0.05 - lag) / 0.4, 0, 1), fall = oak ? 0 : clamp((sp - 0.6 - lag) / 0.35, 0, 1);
  return clamp(turn * 1.5 - 0.4, 0, 1) * (1 - fall * fall) * (oak ? 0.3 : 1);
}

// A painted tree's leaves come down in autumn as its kind's own leaf (trees.js leafSheet, painted in the tree workers
// once in every colour its crown takes, on one sheet a size). A crown still turning drops green ones, then its autumn
// colour (an oak's last ones dry), and a few in its kind's other colours, as its crown has a few clumps another. Each
// glides down swinging from side to side and tipping into each swing, turns over now and then (its back is paler),
// drifts on the wind, and lands round the foot, where it lies a moment and fades. A leaf goes round and round its life
// on the clock, so nothing is kept: where it is comes from the time and a few hash numbers. The trees dropping leaves
// are listed as the shadows go down (treeLeaves) and their leaves drawn twice (drawLeaves): those lying then, over the
// shadows and under all that stands, and those in the air at the end, over everything.
const LEAF_TIERS = [8, 16, 32, 48];      // leaf lengths painted, in device pixels: a sheet each, asked for when one's wanted
const LEAF_LEN = 0.085;                  // a leaf's length, of its tree's px
const LEAF_SLOTS = 14;                   // leaves a tree has on the go at the height of its fall
const LEAF_MIN = 22, LEAF_FULL = 56;     // none from a tree drawn smaller than this many px, and fewer up to this (specks, further out:
                                         // each is a draw of its own, and a wood zoomed out had nearly 2000)
const LEAF_FALL_MS = 5400, LEAF_LIE_MS = 2600, LEAF_FADE_MS = 1400;   // a leaf's fall (give or take a fifth), then lying, fading at the end
const LEAF_SETTLE_MS = 300;              // landing, it lies down flat
const LEAF_OTHER = 0.15;                 // the share of a tree's autumn leaves in its kind's other colours
const LEAF_GREEN = 0.25;                 // and of those from a crown still green that are green: they fall when they've turned
const LEAF_FLAT = 0.6;                   // a leaf lying on the ground, as squashed as we see the meadow at a slant (ROCK_SQUASH)
const LEAF_GROUP = { summer: 0, spring: 0, bud: 0, autumn: 1, thin: 1, winter: 1, bare: 1 };   // the leaves a crown's look drops: green, or its autumn ones
const LEAF_KEY = -1000;                  // (the sheets' keys among the tree workers' jobs, below the stand-ins')
const leafSheets = [], leafWanted = [];  // by tier: { image, cell, cols }; the tiers to ask the workers for
let leafPick = null;                     // trees.js's pick: the colours a tree of each kind and tone drops
const leafTrees = [];                    // this frame's trees dropping leaves (records kept from frame to frame)
let leafN = 0;

// A tree on screen, as its shadow goes down: if its leaves are coming down, it's listed for drawLeaves.
function treeLeaves(d, sx, sy, px, ck, f) {
  if (ck.season !== 2 || px < LEAF_MIN || !treeWorker || !S.standing(d) || treeWaits.get(d) === 0) return;
  const kind = treeKind(d), oak = kind === 'oak' || kind === 'hive';
  if (kind === 'pine') return;
  const info = treeInfo(d), drop = leafDrop((ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS, (info.h % 5) * 0.04, oak);
  const n = Math.round(LEAF_SLOTS * drop * clamp((px - LEAF_MIN) / (LEAF_FULL - LEAF_MIN), 0.15, 1));
  if (!n) return;
  let tier = 0;
  while (tier < LEAF_TIERS.length - 1 && LEAF_TIERS[tier] < px * LEAF_LEN * dpr) tier++;
  if (!leafSheets[tier]) {                                 // asked for, and till it comes, the nearest size there is
    if (!leafWanted.includes(tier) && !treeSent.has(LEAF_KEY - tier)) { leafWanted.push(tier); askTrees(); }
    let near = -1;
    for (let i = 0; i < LEAF_TIERS.length; i++) if (leafSheets[i] && (near < 0 || Math.abs(i - tier) < Math.abs(near - tier))) near = i;
    if (near < 0) return;
    tier = near;
  }
  const [a, b, m] = treeStage(kind, d, ck);
  const r = leafTrees[leafN] || (leafTrees[leafN] = { sx: 0, sy: 0, px: 0, n: 0, h: 0, f: 0, tier: 0, pick: null, ga: 0, gb: 0, m: 0 });
  leafN++;
  r.sx = sx; r.sy = sy; r.px = px; r.n = n; r.h = info.h; r.f = f; r.tier = tier; r.pick = leafPick[oak ? 'oak' : kind][d.tone ?? 0];
  r.ga = oak && a === 'winter' ? 2 : LEAF_GROUP[a]; r.gb = b ? LEAF_GROUP[b] : r.ga; r.m = m;   // (an oak's winter look: its dry leaves)
}

// The listed trees' leaves lying round their feet (lying), or coming down. Each is one setTransform and one drawImage.
function drawLeaves(now, lying) {
  const sky = ui.sky.mix, wind = 0.4 + 0.6 * sky.cloudy + 1.5 * sky.rain + 3 * sky.storm;
  if (leafN) ctx.beginPath();   // Chrome carries the path along through every setTransform: what was drawn last would cost each leaf dear
  for (let i = 0; i < leafN; i++) {
    const r = leafTrees[i], sheet = leafSheets[r.tier], cell = sheet.cell, pick = r.pick, px = r.px, h = r.h;
    const k = px * LEAF_LEN / LEAF_TIERS[r.tier] * dpr;     // device pixels to a pixel of the sheet
    fadeTo(r.f);                                            // as its tree is, in the mist
    for (let j = 0; j < r.n; j++) {
      const fallMs = LEAF_FALL_MS * (0.8 + 0.4 * hash2(h, j, 1)), life = fallMs + LEAF_LIE_MS;
      const t = now / life + hash2(h, j, 2), c = Math.floor(t), q = (t - c) * life;
      if ((q >= fallMs) !== lying) continue;
      const g = h * 31 + j, at = Math.min(q, fallMs), u = at / fallMs;
      // From up in the crown down to the ground round the foot, swinging from side to side and hanging a moment at each
      // end, tipping into each swing, and turning over now and then.
      const x0 = (hash2(g, c, 3) - 0.5) * px * 0.7, y0 = -px * (0.8 - 0.35 * hash2(g, c, 4)), y1 = (hash2(g, c, 5) - 0.5) * px * 0.22;
      const swing = hash2(g, c, 6) * TAU + TAU * at / (1300 + 700 * hash2(g, c, 7)), sw = Math.sin(swing), reach = px * (0.04 + 0.05 * hash2(g, c, 8));
      const x = r.sx + x0 + reach * sw + wind * u * px * 0.25;
      const y = r.sy + y0 + (y1 - y0) * u - reach * 0.5 * sw * sw * Math.min(1, (1 - u) * 6);
      const turn = hash2(g, c, 9) * TAU + 0.5 * Math.cos(swing);
      let side = Math.cos(hash2(g, c, 10) * TAU + (hash2(g, c, 11) - 0.5) * 4.4 * at / 1000), flat = 1, alpha;
      side = side < 0 ? Math.min(side, -0.15) : Math.max(side, 0.15);   // (edge on, still a sliver)
      if (lying) {
        const lay = q - fallMs, w = smooth(0, LEAF_SETTLE_MS, lay);
        side += ((side < 0 ? -1 : 1) - side) * w; flat = 1 - (1 - LEAF_FLAT) * w;
        alpha = Math.min(1, (LEAF_LIE_MS - lay) / LEAF_FADE_MS);
      } else alpha = Math.min(1, q / 500);
      // Its colour, as its crown is: green or its own autumn colour, a few in its kind's others; lit or a little less.
      let group = hash2(g, c, 12) < r.m ? r.gb : r.ga;
      if (group === 0 && hash2(g, c, 16) > LEAF_GREEN) group = 1;
      let col = group === 0 ? pick[0] : group === 2 && pick[2] >= 0 ? pick[2] : pick[1];
      if (group === 1 && pick.length > 3 && hash2(g, c, 13) < LEAF_OTHER) col = pick[3 + Math.floor(hash2(g, c, 14) * (pick.length - 3))];
      const at4 = col * 4 + (hash2(g, c, 15) < 0.5 ? 0 : 2) + (side < 0 ? 1 : 0), cs = Math.cos(turn) * k, sn = Math.sin(turn) * k;
      ctx.globalAlpha = alpha;
      ctx.setTransform(cs * side, sn * side * flat, -sn, cs * flat, x * dpr + shakeX, y * dpr + shakeY);
      ctx.drawImage(sheet.image, (at4 % sheet.cols) * cell, ((at4 / sheet.cols) | 0) * cell, cell, cell, -cell / 2, -cell / 2, cell, cell);
    }
  }
  if (leafN) { ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY); ctx.globalAlpha = 1; unfade(); }
  if (!lying) leafN = 0;
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
const TREE_SCALE = { oak: 1.41, hive: 1, beech: 1.36, maple: 1.14, birch: 0.92, alder: 1.05, pine: 1.01, apple: 1.28, cherry: 1.72, hawthorn: 1.1, log: 1.2, stump: 1 };
const treePx = d => Math.max(d.hedge ? HEDGE_PX : 0, d.size * cam.zoom * (d.tree && treeWorker ? TREE_SCALE[d.fallen ? 'log' : d.stump ? 'stump' : treeKind(d)] || 1 : 1));
const HEDGE_PX = 12;                                     // ?keep: a hedge's whip is never drawn smaller than this, so a new one reads as a row from afar
const LOG_BARK = { beech: 'grey', birch: 'birch' };      // whose bark a log or a stump has (trees.js); the rest are brown
const YOUNG = new Set(['seedling', 'sapling', 'young']);
const SEEDLING_PX = 6;                                   // a seedling smaller than this on screen isn't drawn
// A bare tree looks the same whatever its tone, and a young one hardly shows its shape: fewer paintings to make.
const bareLook = (kind, look) => look === 'dead' || look === 'burnt' || (kind !== 'pine' && kind !== 'log' && (look === 'winter' || look === 'bare'));
const HIVE_DOOR = [1, -38];              // the hive's sill in the hive oak's painting, from its foot (trees.js hive)
// Paintings go by number, so a frame builds no names: the tree (kind, shape, tone, form), its look, the size (its
// place in TREE_TIERS) and the snow, packed together.
const ART_KINDS = { oak: 0, hive: 1, beech: 2, maple: 3, birch: 4, pine: 5, alder: 6, apple: 7, cherry: 8, hawthorn: 9, log: 10, stump: 11 };
const ART_LOOKS = { summer: 0, spring: 1, bud: 2, autumn: 3, thin: 4, winter: 5, bare: 6, dead: 7, burnt: 8 }, ART_LOOK_N = 9;
const ART_TONES = { 0: 0, 1: 1, 2: 2, 3: 3, bark: 4, grey: 5, birch: 6 };
const treeKey = (kind, shape, tone, form) => ((ART_KINDS[kind] * 4 + shape) * 8 + ART_TONES[tone]) * 2 + form;
// treeAny: a painting of each tree, in any look, till its own comes. treeKin: a small one of each kind in each
// look, with its snow, painted ahead and kept for good (outside TREE_BYTES: a few MB), so there's always one.
const treeArt = new Map(), treeAsked = new Map(), treeSent = new Map(), treeAny = new Map(), treeKin = new Map();
const BROAD = ['winter', 'bud', 'spring', 'summer', 'autumn', 'thin', 'dead'], OAK = ['bare', 'winter', 'bud', 'spring', 'summer', 'autumn', 'dead'];
const KIN_LOOKS = { oak: OAK, hive: OAK, beech: BROAD, maple: BROAD, birch: BROAD, alder: BROAD, apple: BROAD, cherry: BROAD, hawthorn: BROAD,
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
        if (job.leaves) {                                // the falling leaves' sheet at a size (drawLeaves)
          leafSheets[job.tier] = { image, cell: e.data.cell, cols: e.data.cols }; leafPick = e.data.pick;
          treeSent.delete(key); treeBusy--; tw.busy--; askTrees();
          return;
        }
        const p ={ image, snow, bx, by, scale: job.scale, used: spriteFrame, w: image.width, h: image.height, bytes: image.width * image.height * 4 * (snow ? 2 : 1) };   // (w, h: an image's own are slow to ask)
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
// Hands the workers the next painting wanted, two each at a time: a sheet of falling leaves first, then a stand-in
// while none is being painted (one at a time, so the rest go on), then the ones wanted this frame, small sizes before
// big so something shows soon. What hasn't been wanted for a while is forgotten.
function sendTree(key, job) {
  const tw = treeWorkers.reduce((a, b) => b.busy < a.busy ? b : a);
  treeSent.set(key, job); treeBusy++; tw.busy++;
  tw.worker.postMessage({ key, ...job });
}
function askTrees() {
  while (treeWorker && treeBusy < 2 * treeWorkers.length) {
    if (leafWanted.length) { const tier = leafWanted.shift(); sendTree(LEAF_KEY - tier, { leaves: LEAF_TIERS[tier], tier }); continue; }   // (quick, and many leaves wait on one)
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
function drawPaintedTree(d, sx, sy, now, ck, stage = S.treeStage(world, d), px = treePx(d)) {
  if (!treeWorker) return false;
  if (!kinAsked) kinAhead();
  const wood = stage === 'log' || stage === 'stump', kind = wood ? stage : treeKind(d), hx = Math.floor(d.x * 100), hy = Math.floor(d.y * 100);
  const form = YOUNG.has(stage) ? 1 : 0, shape = Math.floor(hash2(hx, hy, 46) * TREE_SHAPES) % (form ? 2 : TREE_SHAPES);
  const f = px / TREE_UNIT, want = f * dpr, tier = TREE_TIERS.find(t => t >= want * 0.9) || TREE_TIERS[TREE_TIERS.length - 1];
  const snow = step(world.snow * 1.6 - 0.1, 4), tone = wood ? LOG_BARK[d.kind] || 'bark' : d.tone ?? 0;
  const [a, b, m] = wood ? ['summer', null, 0] : stage === 'dead' ? ['dead', null, 0] : treeStage(kind, d, ck);
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
  // Swaying from the foot. A tree is only ever drawn in render's own transform, so it's set back as it was, with no
  // save and restore (turning it back by the inverse leaves it a hair off, and Chrome then draws what follows another way).
  if (!still) { const c = Math.cos(r) * dpr, s = Math.sin(r) * dpr; ctx.setTransform(c, s, -s, c, sx * dpr + shakeX, sy * dpr + shakeY); }
  if (A) putPainting(A, f, fade, snow, still ? sx : 0, still ? sy : 0);
  if (B) putPainting(B, f, (A ? m : 1) * fade, snow, still ? sx : 0, still ? sy : 0);
  if (!still) ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  return true;
}
function putPainting(p, f, alpha, snow, ox, oy) {
  const k = f / p.scale, x = ox - p.bx * k, y = oy - p.by * k, w = p.w * k, h = p.h * k;
  ctx.globalAlpha = alpha;
  ctx.drawImage(p.image, x, y, w, h);
  if (snow && p.snow) { ctx.globalAlpha = alpha * snow; ctx.drawImage(p.snow, x, y, w, h); }
  ctx.globalAlpha = 1;
}
// A visitor fur.js paints (Fur.painters: the dragonflies, the kingfisher, the skylark), at the doublings of its size and
// shrunk between (shrunk), as a fox is; in the meadow the worker paints it (furReady).
const furPaint = kind => (g, size, U, n) => { if (!shrunk(g, size, U, kind + ':' + n)) Fur.painters[kind](g, size, U, n); };
const PAINTERS = { fox: paintFox, rabbit: paintRabbit, hog: paintHedgehog, heron: paintHeron, reeds: paintReeds, lily: paintLilies, bubble: paintBubble, frog: paintFrog, crow: paintCrow, otter: paintOtter, holt: paintHolt, remains: paintRemains, body: paintBody, bee: paintBee, fall: paintFall,
  dfly: furPaint('dfly'), kfisher: furPaint('kfisher'), lark: furPaint('lark') };
function drawDecor(d, sx, sy, now, ck, clipLeaves, px = d.tree ? treePx(d) : d.size * cam.zoom) {   // (px: render has it already)
  if (d.emoji === '🪨') { drawRock(d, sx, sy); return; }
  if (!d.stump && !d.tree) { drawEmoji(d.emoji, sx, sy - px * 0.35, px); return; }
  const stage = d.tree && S.treeStage(world, d);
  if (stage === 'seedling' && !treeWorker) { if (px >= 3) drawEmoji('🌱', sx, sy - px * 0.3, px * 0.9); return; }   // (painted, it's a little young tree)
  if (stage === 'dead' || stage === 'log' || stage === 'stump') {   // grey and bare, fallen, or a stump till it sprouts again
    if (drawPaintedTree(d, sx, sy, now, ck, stage, px) || treeWorker) return;
    if (stage === 'dead') drawEmoji('🪾', sx, sy - px * 0.42, px * 1.15);
    else drawEmoji('🪵', sx, sy - px * (stage === 'log' ? 0.1 : 0.12), px * (stage === 'log' ? 0.5 : 0.45));
    return;
  }
  if (px < 20 && !clipLeaves && (drawPaintedTree(d, sx, sy, now, ck, stage, px) || treeWorker)) return;   // too small for anything under it or in it
  if (treeWorker && !clipLeaves) {                           // painted: of treeLook, only what lies under it
    const ground = windfallsUnder(d, ck), h = ground && treeInfo(d).h;
    if (ground) drawUnderTree(ground, h, sx, sy, px, false);
    if (drawPaintedTree(d, sx, sy, now, ck, stage, px) && ground) drawUnderTree(ground, h, sx, sy, px, true);
    return;                                                  // (its falling leaves: treeLeaves; none yet: it fades in when its painting comes)
  }
  const t = treeLook(d, ck, !treeWorker);
  const under = t.ground?.n && px >= 20 && !(treeWorker && t.ground.e === '🌸');   // a painted cherry has its own petals
  if (under) drawUnderTree(t.ground, t.h, sx, sy, px, false);
  if (!clipLeaves && drawPaintedTree(d, sx, sy, now, ck, stage, px)) {
    if (under) drawUnderTree(t.ground, t.h, sx, sy, px, true);
    return;                                                  // (its falling leaves: treeLeaves)
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
  // A dark line where the stones meet the ground, under them all. On the snow layer, the snow's pale blue over it
  // (each stone cuts its own shape out of that layer as it's painted, so only the ground round it goes pale).
  g.save(); g.scale(U, U); sg?.save(); sg?.scale(U, U);
  for (const p of t.stones) {
    if (t.kind === 'ford') {                              // a ring of lighter water round a wet stone
      g.strokeStyle = 'rgba(235,245,255,0.55)'; g.lineWidth = 0.035;
      rockPath(g, p, -0.01, 1.12); g.stroke();
    }
    softSpot(g, p.x, p.y + p.s * 0.08, p.s * 1.25, p.s * ROCK_SQUASH * 1.1, '30,34,16', 0.5);
    if (sg) softSpot(sg, p.x, p.y + p.s * 0.08, p.s * 1.25, p.s * ROCK_SQUASH * 1.1, '196,208,232', 0.7);
  }
  g.restore(); sg?.restore();
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
    const fall = treeLook(d, ck, false).fall;
    drawDecor(d, sx, sy, now, ck, clipFoot);
    const put = s => ctx.drawImage(s.canvas, sx - s.ox, sy - s.oy, s.W, s.H);
    if (fall < 1) { ctx.globalAlpha = 1 - fall; put(trunkSprite(px)); ctx.globalAlpha = 1; }
    put(trunkSprite(px, true));
    hx = sx + OLD_HOLE.x * px; sill = sy + (OLD_HOLE.y + OLD_HOLE.ry * 1.1) * px; rx = OLD_HOLE.rx;
  }
  // Bees on the sill, a few wandering on the bark; they shuffle while time runs.
  const ry = OLD_HOLE.ry;
  // A full hive has honey oozing over the sill.
  if (h.honey > 0.5 * S.HIVE_FULL) {
    const x = hx - rx * px * 0.85, y = sill - ry * px * 0.45, r = px * 0.011;
    const len = r * (1 + 1.5 * Math.min(1, 2 * h.honey / S.HIVE_FULL - 1));
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
  const W = S.W, H = S.H, out = new Float32Array(W * H), at = (x, y) => src[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    let n = 0;
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {      // (away from the edge, straight from the tiles: the same sum, in the same order)
      n = src[i - W - 1] + src[i - W] + src[i - W + 1] + src[i - 1] + src[i] + src[i + 1] + src[i + W - 1] + src[i + W] + src[i + W + 1];
    } else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += at(x + dx, y + dy);
    out[i] = n / 9;
  }
  return out;
}

// (?keep) The tiles within 2 of a pond the keeper dug that has no reeds yet (they come later), or null with none.
function reedsLater() {
  const young = world.ponds ? world.ponds.filter(p => !p.reeds) : [];
  if (!young.length) return null;
  const out = new Uint8Array(S.W * S.H);
  for (const p of young) {
    for (let y = p.box.y0; y <= p.box.y1; y++) {
      for (let x = p.box.x0; x <= p.box.x1; x++) {
        if (world.dug[y * S.W + x] !== p.id) continue;
        for (let ty = Math.max(0, y - 2); ty <= Math.min(S.H - 1, y + 2); ty++) out.fill(1, ty * S.W + Math.max(0, x - 2), ty * S.W + Math.min(S.W - 1, x + 2) + 1);
      }
    }
  }
  return out;
}

function updateWater() {
  const now = performance.now();
  if (pond && pond.world === world && (pond.version === world.waterVersion || now - pond.at < 1000)) return;
  const water = world.water, seed = world.seed, W = S.W, wet = new Float32Array(water.length), deep = new Float32Array(water.length);
  for (let i = 0; i < water.length; i++) { const v = water[i]; wet[i] = v ? 1 : 0; deep[i] = v === S.DEEP ? 1 : 0; }
  const f1 = blurred(wet), f2 = blurred(f1), f4 = blurred(blurred(f2)), d2 = blurred(blurred(deep));
  // Where little waves come and go: a scatter of spots well inside still water (the rivers have their current).
  const waves = [], running = flowOf().running;
  for (let i = 0; i < f2.length; i++) {
    if (f2[i] <= 0.9 || running[i]) continue;
    const x = i % W, y = (i / W) | 0, h = hash2(x, y, seed);
    if (h < 0.14) waves.push({ x: x + hash2(y, x, 7), y: y + hash2(x, y, 11), ph: h / 0.14 });
  }
  // Reeds in patches along the shore, and lily pads out on quiet shallows away from the deep (drawShore).
  const shore = [], later = reedsLater();
  for (let i = 0; i < f1.length; i++) {
    const wet = water[i];
    if (wet ? wet === S.DEEP : f1[i] <= 0.2) continue;   // (deep water, or dry land away from it: neither reeds nor lilies)
    const x = i % W, y = (i / W) | 0, h = hash2(x, y, seed + 5);
    const reed = hash2(x >> 2, y >> 2, seed + 6) < 0.55 && (wet ? f1[i] < 0.8 && h < 0.3 : h < 0.4);
    const lily = !reed && wet === S.SHALLOW && f4[i] > 0.6 && d2[i] < 0.35 && h > 0.88 && !running[i];   // in still water
    if (!reed && !lily) continue;
    if (later && later[i]) continue;      // (a new pond's come later)
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
const WAVE_X = Float64Array.from({ length: 13 }, (_, k) => 2 * (k / 12) - 1), WAVE_Y = Float64Array.from({ length: 13 }, (_, k) => Math.sin(k / 12 * 3 * Math.PI));
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
    for (let k = 0; k <= 12; k++) ctx.lineTo(sx + w * s * WAVE_X[k], sy - h * s * WAVE_Y[k]);   // a short ~ of a wave and a half
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
const ease = u => u * u * (3 - 2 * u);
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
// the rain hangs in the air and the waves on the water hold (drawWaves). (Lightning keeps to real time.)
let weatherClock = 0, weatherLast = 0;
function weatherTick(now) {
  if (ui.speed > 0) weatherClock += clamp(now - weatherLast, 0, 100);
  weatherLast = now;
  return weatherClock;
}

function drawWeather(now, ck, dark) {
  const m = ui.sky.mix, t = weatherTick(now);
  if (dark > 0) skyWash(NIGHT_RGB, dark);
  const shade = 0.12 * m.cloudy + 0.08 * m.rain + 0.10 * m.storm;
  if (shade > 0.01) skyLayer(SKY_CLOUDS, shade);
  const dim = 0.05 * m.cloudy + 0.09 * m.rain + 0.30 * m.storm + 0.04 * m.snow;
  if (dim > 0.005) skyWash(DIM_RGB, dim);
  if (m.heat > 0.01) skyWash(HEAT_RGB, 0.11 * m.heat);
  if (!ck.night && rainbowShows()) { laySky(t); drawRainbow(); }   // (over what's laid so far, under the fog)
  if (m.fog > 0.01) { skyWash(FOG_RGB, 0.30 * m.fog); skyLayer(SKY_FOG, m.fog); }
  laySky(t);
  const rain = m.rain + 1.8 * m.storm;
  if (rain > 0.02) drawRain(t, rain, m.storm);
  if (m.snow > 0.02) drawSnow(t, m.snow);
  drawLightning(now);
}

// The washes over the whole meadow, in order: the dark (render's), the cloud shadows, the weather's dim, the heat's glow and
// the fog. Each was a screen's worth of pixels for the GPU to blend, a dozen at worst. Washes laid one over another come to
// the same as one laid once, so they're gathered up (skyWash, skyLayer) and laid in one go (laySky): one fill if they're all
// even, else one small picture of them all, painted at SKY_RES of the screen (they're soft all through) and stretched over it.
const DIM_RGB = [50, 62, 92], HEAT_RGB = [255, 168, 60], FOG_RGB = [236, 240, 244];
const SKY_EVEN = 0, SKY_CLOUDS = 1, SKY_FOG = 2;          // a layer: one colour all over, the cloud shadows, the fog's banks
const SKY_RES = 0.125;                                     // the picture's pixels to a CSS pixel
const SKY_MS = 50;                                         // and its clouds and fog drift on in steps this long (a pixel or two: they're soft)
const sky = { n: 0, layers: Array.from({ length: 8 }, () => ({ kind: 0, rgb: null, a: 0 })), canvas: null, g: null,
  was: new Float64Array(64), now: new Float64Array(64) };   // what the picture was painted from, and what it's wanted from now

function skyLayer(kind, a, rgb = null) { const l = sky.layers[sky.n++]; l.kind = kind; l.a = a; l.rgb = rgb; }
const skyWash = (rgb, a) => skyLayer(SKY_EVEN, a, rgb);
function laySky(t) {
  const n = sky.n;
  if (!n) return;
  sky.n = 0;
  const L = sky.layers;
  let even = true;
  for (let i = 0; i < n; i++) if (L[i].kind !== SKY_EVEN) even = false;
  if (even) {                                              // one colour, what they come to over what's under
    if (n === 1) { wash(`rgba(${L[0].rgb}, ${L[0].a})`); return; }
    let r = 0, g = 0, b = 0, through = 1;                  // (premultiplied, and how much of what's under shows through)
    for (let i = 0; i < n; i++) {
      const { rgb, a } = L[i];
      r = rgb[0] * a + r * (1 - a); g = rgb[1] * a + g * (1 - a); b = rgb[2] * a + b * (1 - a); through *= 1 - a;
    }
    const a = 1 - through;
    wash(`rgba(${r / a}, ${g / a}, ${b / a}, ${a})`);
    return;
  }
  const k = SKY_RES, w = Math.ceil((vw + 20) * k), h = Math.ceil((vh + 20) * k);   // (as wash: 10 past the screen all round, for the thunder's shake)
  if (!sky.canvas) { sky.canvas = document.createElement('canvas'); sky.g = sky.canvas.getContext('2d'); }
  const c = sky.canvas, sg = sky.g;
  // Painted again only if what it shows has moved (paused, with the camera still, it hasn't: the weather's clock stands too).
  const f = sky.now;
  f[0] = n; f[1] = vw; f[2] = vh; f[3] = cam.x; f[4] = cam.y; f[5] = cam.zoom; f[6] = shakeX; f[7] = shakeY; f[8] = dpr; f[9] = t;
  for (let i = 0; i < n; i++) { const l = L[i], o = 10 + i * 5; f[o] = l.kind; f[o + 1] = l.a; f[o + 2] = l.rgb ? l.rgb[0] : -1; f[o + 3] = l.rgb ? l.rgb[1] : -1; f[o + 4] = l.rgb ? l.rgb[2] : -1; }
  let same = c.width === w && c.height === h;
  for (let i = 0, m = 10 + n * 5; same && i < m; i++) if (f[i] !== sky.was[i] && !(i === 9 && f[9] - sky.was[9] < SKY_MS)) same = false;
  if (same) { ctx.drawImage(c, -10, -10, w / k, h / k); return; }
  sky.was.set(f);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const { kind, rgb, a } = L[i];
    sg.setTransform(k, 0, 0, k, 10 * k, 10 * k);          // in CSS pixels, as the meadow's
    if (kind === SKY_CLOUDS) paintCloudShadows(sg, t, a);
    else if (kind === SKY_FOG) paintFogBanks(sg, t, a);
    else { sg.fillStyle = `rgba(${rgb}, ${a})`; sg.fillRect(-10, -10, vw + 20, vh + 20); }
  }
  ctx.drawImage(c, -10, -10, w / k, h / k);
}

// Soft shadows that pan and zoom with the meadow, drifting east. (On the sky's picture; they keep still in the thunder's shake.)
function paintCloudShadows(g, now, a) {
  const z = cam.zoom, span = S.W + 60, k = SKY_RES, ox = 10 - shakeX / dpr, oy = 10 - shakeY / dpr;
  for (const c of clouds) {
    const wx = ((c.x * span + now / 1000 * 0.5 * c.s) % span) - 30, wy = c.y * S.H;
    const [sx, sy] = toScreen(wx, wy), r = c.r * z;
    if (!visible(sx, sy, r * 1.6)) continue;
    const grad = g.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
    grad.addColorStop(0, `rgba(30, 40, 70, ${a * 1.6})`);
    grad.addColorStop(1, 'rgba(30, 40, 70, 0)');
    g.fillStyle = grad;
    g.setTransform(k * 1.6, 0, 0, k, k * (sx * (1 - 1.6) + ox), k * oy);   // stretch sideways
    g.beginPath(); g.arc(sx, sy, r * 1.6, 0, TAU); g.fill();
  }
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

function paintFogBanks(g, now, amount) {
  for (let i = 0; i < 6; i++) {                  // slow banks rolling past
    const x = ((i / 6 + now / 60000) % 1.4 - 0.2) * vw, y = vh * (0.15 + 0.14 * i), r = vw * 0.35;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(244, 246, 250, ${0.35 * amount})`);
    grad.addColorStop(1, 'rgba(244, 246, 250, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// A rainbow keeps to game time like the rest of the sky, lasting most of a day (14 s at 1x) and holding while it's
// paused. At BOW_FAST and up it would only flash, so none comes out; rain coming back washes one out (rainbowWet).
// It stands over the part of the meadow in view when it came out, sized to the window then, and stays there:
// panning and zooming move it like the ground. Painted once (bow), then copied; while it comes out it's copied
// in slices, from one foot.
const BOW_LIFE = 14 * TICKS_PER_SECOND, BOW_IN = 4 * TICKS_PER_SECOND, BOW_OUT = 5 * TICKS_PER_SECOND, BOW_FAST = 15;   // in ticks
const BOW_RES = 0.5, BOW_OUTER = 1.3, BOW_SLICES = 32;
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

const bowNow = () => world.tick + Math.min(acc, 1);   // in ticks, gliding between them
function rainbowOut() {
  if (ui.speed >= BOW_FAST || bowNow() < ui.sky.bowEnd) return;   // one still out stays
  ui.sky.rainbow = world.tick; ui.sky.bowEnd = world.tick + BOW_LIFE;
  return true;
}
function rainbowWet() { ui.sky.bowEnd = Math.min(ui.sky.bowEnd, world.tick + BOW_OUT); }   // the rain's back: it fades

const rainbowShows = () => bowNow() <= ui.sky.bowEnd;
function drawRainbow() {
  const t = bowNow(), age = t - ui.sky.rainbow;
  if (t > ui.sky.bowEnd) return;
  if (bow.t !== ui.sky.rainbow) {
    const R = Math.round(Math.min(vh * 0.74, vw * 0.7) / 8) * 8;    // its top a quarter down; a whole arch on a phone
    if (bow.R !== R) paintBow(R);
    const [x, y] = toWorld(vw * 0.55, Math.min(vh * 1.02, vh * 0.28 + R));
    Object.assign(bow, { t: ui.sky.rainbow, x, y, r: R / cam.zoom });
  }
  const [cx, cy] = toScreen(bow.x, bow.y), Ro = bow.r * cam.zoom * BOW_OUTER;
  if (cx + Ro < 0 || cx - Ro > vw || cy < 0 || cy - Ro > vh) return;
  const x0 = cx - Ro, y0 = cy - Ro, w = 2 * Ro, h = Ro;
  const fade = Math.min(1, (ui.sky.bowEnd - t) / BOW_OUT), peak = 0.85 * fade * fade * (3 - 2 * fade);
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
  if (now - ui.sky.boom < 250) return;   // one flash at a time is plenty
  const path = [[0, Math.random() - 0.5]];
  for (let f = 0.12; f < 1; f += 0.08 + Math.random() * 0.08) path.push([f, Math.random() - 0.5]);
  path.push([1, 0]);
  if (ui.sky.bolts.length < 30) ui.sky.bolts.push({ x: e.x, y: e.y, t0: now, path });
  ui.sky.boom = now;
}

function addEffect(emoji, x, y, rise = 1.2, dur = 1400) {
  if (ui.effects.length > 120) return;
  const [sx, sy] = toScreen(x, y);
  if (!visible(sx, sy, 50)) return;
  ui.effects.push({ emoji, x, y, rise, dur, t0: performance.now() });
}

// An effect swells to 1.1x and back as it rises: painted once at its biggest and drawn smaller, as each size it
// passed through would be a painting of its own (an emoji, 2 to 20 ms).
function drawEffects(now) {
  let n = 0;
  for (const e of ui.effects) if (now - e.t0 < e.dur) ui.effects[n++] = e;
  ui.effects.length = n;
  const px = Math.max(14, cam.zoom * 1.2);
  for (const e of ui.effects) {
    const a = (now - e.t0) / e.dur;
    const [sx, sy] = toScreen(e.x, e.y);
    const s = sprite(e.emoji, px * 1.1), size = s.size * (0.8 + 0.3 * Math.sin(a * Math.PI)) / 1.1;
    ctx.globalAlpha = 1 - a * a;
    ctx.drawImage(s.canvas, sx - size / 2, sy - px * 0.8 - e.rise * px * a - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ pond life
//
// The sim keeps frogs, and their spawn and tadpoles, as numbers on tiles (w.frogs, w.spawn).
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

// (The halo is laid over the dark ground, not added to it: so it's thicker.)
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
function fireflyLight(dark) {                     // how brightly they're out tonight: 0 when they aren't
  const [season, next, turn] = seasonTurn(), m = ui.sky.mix;
  const summer = season === 1 ? 1 - turn : next === 1 ? turn : 0;
  return summer * clamp((dark - 0.15) / 0.25, 0, 1) * clamp(1 - 1.5 * ((m.rain || 0) + (m.storm || 0)), 0, 1);
}
function drawFireflies(now, dark) {
  const a = fireflyLight(dark);
  if (a <= 0.02) return;
  const spots = fireflyHaunts(), z = cam.zoom, d = Math.max(12, z * 1.1), t = now / 1000;
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < spots.x.length; s++) {
    const x0 = spots.x[s], y0 = spots.y[s], i = (y0 | 0) * S.W + (x0 | 0);
    if (world.water[i] || world.grass[i] < 0.3) continue;
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

// ------------------------------------------------------------------ links in the inspector

// A word now and then (a link copied, an idea that couldn't go): one small line at the top, gone in a few seconds.
const TOAST_MS = 4000;
function toast(html) {
  const box = $('#news'), el = document.createElement('div');
  el.className = 'news-item';
  el.innerHTML = html;
  box.replaceChildren(el);
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 800); }, TOAST_MS);
}

const link = c => c ? `<a data-id="${c.id}">${esc(c.name)}</a>` : 'someone';
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ------------------------------------------------------------------ sound (see sound.js)

// Animal sounds only play when you can see them, or when they are about the animal you follow.
// They pan with where they happen on screen and get softer as you zoom out.
function hear(name, x, y, opts = {}, always = false) {
  if (!ui.sound) return;
  const [sx, sy] = toScreen(x, y), seen = visible(sx, sy, 40);
  if (!seen && !always) return;
  Sound.play(name, { pan: 0.8 * clamp(sx / vw * 2 - 1, -1, 1), near: seen ? clamp(cam.zoom / (3 * minZoom), 0.4, 1) : 0.2, seen, ...opts });
}
const chime = (name, opts) => { if (ui.sound) Sound.play(name, opts); };

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
  $('#sound-btn').textContent = on ? '🔊' : '🔇';
  $('#sound-btn').classList.toggle('on', on);
  $('#sound-item .e').textContent = on ? '🔊' : '🔇';
  $('#sound-item .l').textContent = on ? 'Sound is on' : 'Sound is off';
  try { localStorage.setItem('aeon-garden-sound', on ? '1' : '0'); } catch (e) { /* fine */ }
}

// The one you follow: its news always comes.
function involvesSelected(e) {
  const id = ui.selectedId;
  return !!id && [e.c, e.a, e.b, e.mum, e.dad, e.rabbit, e.fox, e.killer].some(x => x && x.id === id);
}



function handleEvent(e) {
  const mine = involvesSelected(e);
  switch (e.type) {
    case 'season':
      chime('season', { season: e.season });
      break;
    case 'weather':
      if (WET.has(e.kind) && !WET.has(e.prev)) { chime('rain'); rainbowWet(); }
      if (WET.has(e.prev) && (e.kind === 'clear' || e.kind === 'cloudy') && !S.isNight(world.tick) && rainbowOut()) chime('rainbow');
      break;
    case 'lightning':
      thunder(e);
      hear('thunder', e.x, e.y, {}, true);
      addEffect('💥', e.x, e.y, 0.2, 800);
      break;
    case 'love':
      addEffect('💕', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2);
      hear('love', e.a.x, e.a.y, { species: e.a.species }, mine);
      break;
    case 'birth':
      addEffect('✨', e.mum.x, e.mum.y, 0.8);
      hear('birth', e.mum.x, e.mum.y, { species: e.mum.species, kids: e.kids.length }, mine);
      break;
    case 'death': {
      const c = e.c;
      if (e.cause !== 'left') hear(e.cause === 'fox' ? 'catch' : e.cause === 'age' ? 'old' : 'starve', c.x, c.y, { species: c.species }, mine);   // (one flying off makes no sound)
      if (e.cause === 'fox') addEffect('🦴', c.x, c.y, 0.3, 1800);
      else if (e.cause !== 'left') addEffect('👻', c.x, c.y, 1.6, 2000);
      break;
    }
    case 'hatch':
      hear('birth', e.hive.x, e.hive.y, { species: 'bee', kids: e.kids.length });
      break;
    case 'queen':
      hear('queen', e.hive.x, e.hive.y, {}, true);
      break;
    case 'queenlost':
      hear('queenlost', e.hive.x, e.hive.y, {}, true);
      break;
    case 'swarm':
      addEffect('✨', e.swarm.x, e.swarm.y);
      hear('arrive', e.swarm.x, e.swarm.y, { species: 'bee' }, true);
      break;
    case 'settle':
      addEffect('✨', e.hive.x, e.hive.y);
      break;
    case 'flooded':
      addEffect('🌊', e.burrow.x, e.burrow.y, 0.8);
      break;
    case 'dug':
      dugAt.set(e.burrow, world.tick);
      addEffect('🕳️', e.burrow.x, e.burrow.y, 0.8);
      break;
    case 'escape':
      hear('escape', e.rabbit.x, e.rabbit.y, { how: e.how }, mine);
      break;
    case 'spotted':
      hear('thump', e.rabbit.x, e.rabbit.y, {}, mine);
      break;
    case 'extinct':
      chime('extinct');
      break;
    case 'pollinate':
      puffPollen(e.x, e.y);
      break;
    case 'arrive':
      for (const c of e.who) addEffect('✨', c.x, c.y);
      hear('arrive', e.who[0].x, e.who[0].y, { species: e.species }, true);
      break;
  }
}

// ------------------------------------------------------------------ traits, the tab, the watch

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

// Rewriting part of the page with what it already shows still costs the browser a layout and
// a repaint, and the card and inspector refresh four times a second. So only touch what changed.
const shownHTML = new WeakMap();
function setHTML(el, html) { if (shownHTML.get(el) !== html) { shownHTML.set(el, html); el.innerHTML = html; } }

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

// The watch at the top: a hand going round the day (day, dusk, night, dawn; noon at the top), and round it the
// year's days, the ones still to come pale and a dot on today. The hand and the dot turn every frame, each a
// transform on a layer of its own, so nothing is repainted; the pale part moves once a day, the plaque's words
// a few times a second (dialTitle).
const DIAL_NOON = 0.36;                                // the day's phase at the top of the dial (sun, lean 0)
const dial = { el: $('#dial'), box: $('#watch'), hand: $('#dial .hand'), mark: $('#dial .mark'), a: NaN, m: NaN, day: -1, title: '' };
function updateDial() {
  const t = world.tick + Math.min(acc, 1), p = (t % S.TPD) / S.TPD, day = Math.floor(t / S.TPD) % S.YEAR_DAYS;
  const a = Math.round(((p - DIAL_NOON + 1) % 1) * 1440) / 4, m = Math.round((day + p) / S.YEAR_DAYS * 1440) / 4;
  if (a !== dial.a) { dial.a = a; dial.hand.style.transform = `rotate(${a}deg)`; }
  if (m !== dial.m) { dial.m = m; dial.mark.style.transform = `rotate(${m}deg)`; }
  if (day !== dial.day) { dial.day = day; dial.el.style.setProperty('--done', `${(day + 1) / S.YEAR_DAYS * 360}deg`); }
}
function dialTitle(ck) {
  const part = ck.night ? 'night' : ck.phase < 0.1 ? 'sunrise' : ck.phase < 0.28 ? 'morning' : ck.phase < 0.44 ? 'midday'
    : ck.phase < 0.6 ? 'afternoon' : 'evening';
  const title = `${S.SEASONS[ck.season].name}, day ${ck.dayInSeason} of ${S.SEASON_DAYS} · year ${ck.year} · ${part}`;
  if (title === dial.title) return;
  dial.title = dial.box.title = title;
  dial.box.setAttribute('aria-label', title);
  setHTML($('#watch-day'), `${S.SEASONS[ck.season].name} · day ${ck.dayInSeason}<span> · year ${ck.year}</span>`);
}


// A few times a second: the watch's words, the tab's icon.
function updateClock() {
  const ck = S.clock(world);
  dialTitle(ck);
  updateFavicon(ck);
}

// ------------------------------------------------------------------ the inspector


function when(t) {
  t = Math.max(0, t);                    // (the intro's kits were born on the way here, before the meadow's first day)
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
    <button class="close" data-act="close" title="Close (Esc)" aria-label="Close">✕</button>
  </div>`;

const STORY_SHORT = 4;                    // life-story lines shown before "Show all"
function renderInspector() {
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
    setHTML(box, stripHTML(furCss(c), portraitHTML(c), `${esc(c.name)} <span class="sex">${sex}</span>`,
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
  if (c.fish) chips.push(`🐟 ${c.fish} fish caught`);
  if (c.frogs) chips.push(`🐸 ${c.frogs} ${c.frogs === 1 ? 'frog' : 'frogs'} caught`);
  if (c.escapes) chips.push(`💨 ${c.escapes} narrow ${c.escapes === 1 ? 'escape' : 'escapes'}`);
  if (c.visits) chips.push(`🌼 ${c.visits} ${c.visits === 1 ? 'flower' : 'flowers'} visited`);
  const mate = c.species === 'crow' && c.mate && world.byId.get(c.mate);
  if (mate) chips.push(mate.alive ? `💞 Paired with ${link(mate)}` : `🥀 Lost its mate ${link(mate)}`);
  if (c.species === 'crow' && c.home) chips.push(`${c.sex === 'F' ? '🪺 Nests in' : '🌳 Its patch is round'} ${thingLink('tree', c.home.id, c.home.name ? 'the ' + esc(c.home.name) : 'a tall ' + treeName(c.home).toLowerCase())}`);
  if (c.species === 'otter' && c.home) chips.push(`🕳️ ${c.home.holt === c.id ? 'Her holt is' : 'Lives in the holt'} ${holtPlace(c.home, '')}`);
  if (c.caches?.length && S.seasonOf(world.tick) >= 2) chips.push(`🌰 Remembers where ${c.caches.length === 1 ? 'one acorn is' : c.caches.length + ' acorns are'} buried`);
  const nemesis = world.byId.get(c.nemesisId);
  if (nemesis && nemesis.alive) chips.push(`😨 Afraid of ${link(nemesis)}`);
  const story = c.story.slice().reverse().slice(0, ui.allStory ? Infinity : STORY_SHORT).map(s =>
    `<li><span>${s.emoji}</span><span>${esc(s.text)}<div class="when">${when(s.t)}</div></span></li>`).join('');
  const living = c.alive ? '' : world.creatures.find(k => k.mumId === c.id || k.dadId === c.id);

  setHTML(box, `
    <button class="sheet-handle phone-only" data-act="sheet-down" aria-label="Show less"></button>
    <div class="ins-head">
      <div class="portrait" style="background:${furCss(c)}33">${portraitHTML(c)}</div>
      <div>
        <div class="ins-name">${esc(c.name)} <span style="color:var(--muted)">${sex}</span></div>
        <div class="ins-sub">${c.alive ? `${c.sp.name} · ${lifeStage(c)} · ${age} ${age === 1 ? 'day' : 'days'} old`
          : `${c.sp.name} · lived ${age} ${age === 1 ? 'day' : 'days'}`}</div>
      </div>
      <button class="close" data-act="close" title="Close (Esc)" aria-label="Close">✕</button>
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
// Where an otters' holt is: in the roots of a tree (a link to it), or under a boulder. bank: said after a tree with no name.
const holtPlace = (d, bank) => (d.tree ? `in the roots of ${thingLink('tree', d.id, d.name ? 'the ' + esc(d.name) : `a big ${treeName(d).toLowerCase()}${bank ? ' ' + bank : ''}`)}` : 'under a boulder on the bank');

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

const TREE_NAMES = { oak: 'Oak', beech: 'Beech', maple: 'Maple', birch: 'Birch', alder: 'Alder', hawthorn: 'Hawthorn',
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
    case 'dead': return `Dead ${low}`;
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
  if (s === 1) return info.fruit === 'apple' ? '🍏 Apples ripening' : info.fruit === 'cherry' ? '🍒 Hung with cherries' : '🌳 In full leaf';
  if (s === 2) return info.fruit === 'apple' ? '🍎 Dropping ripe apples' : k === 'hawthorn' ? '🔴 Red with haws' : k === 'alder' ? '🌳 Still green, dropping its leaves' : oak ? '🍂 Leaves turned brown' : '🍂 Leaves turning';
  if (k === 'hawthorn') return '🔴 Bare, a few red haws left';
  if (k === 'alder') return '🟤 Bare, hung with catkins and little cones';
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

// A visitor in the inspector: what it's up to, what drew it, what it has found, how long it stays.
function hogPanel(v, here) {
  const k = VISITORS.hedgehog, h = v.hedge, hedge = placeLink(v), face = visitorFace(v.kind);
  if (!here) return { emoji: face, tint: k.tint, name: 'Hedgehog', sub: 'A visitor · gone', status: `🌙 Gone back the way it came. One may come again to ${hedge}.` };
  const status = {
    in: `🌿 Making for your hedge ${hedge}`, out: '🌙 Off back the way it came',
    potter: `👃 Pottering along ${hedge}, after beetles`, snuffle: `🪲 Snuffling for beetles under ${hedge}`,
    home: `🍂 Off to its bed of leaves under ${hedge}`, sleep: `💤 Curled up asleep under ${hedge} till dusk`,
  }[v.mode];
  const facts = [['🌿', `Came for ${k.for} ${hedge}, the hedge you planted`],
    ['🪲', v.finds ? `${v.finds} beetles, slugs and worms found so far` : 'Nothing found yet'],
    ['🌙', 'Up from dusk till dawn; by day it sleeps in the leaves at the foot of the hedge']];
  if (v.mode !== 'out') facts.push(['🗓️', v.until - world.tick < S.TPD ? 'Off again at dusk' : `Here for ${days((v.until - world.tick) / S.TPD)} more`]);
  if (v.n > 1) facts.push(['🔁', `${v.n} visits to your hedges so far`]);
  return { emoji: face, tint: k.tint, name: 'Hedgehog', sub: `A visitor at ${h.name}`, status, facts };
}
// What a heron has caught: "3 frogs and a fish", or '' for nothing.
const heronCaught = v => [v.frogs && (v.frogs === 1 ? 'a frog' : `${v.frogs} frogs`), v.fish && (v.fish === 1 ? 'a fish' : `${v.fish} fish`)].filter(Boolean).join(' and ');
function heronPanel(v, here) {
  const k = VISITORS.heron, pond = placeLink(v), face = visitorFace(v.kind);
  if (!here) return { emoji: face, tint: k.tint, name: 'Grey heron', sub: 'A visitor · gone', status: `🌅 Flown off. One may come again to ${pond}.` };
  const status = {
    in: `🪶 Flying in to ${pond}`, out: '🌅 Flying off', hop: `🪶 Flying across ${pond}`,
    stalk: `🦶 Stalking slowly through the shallows of ${pond}`, watch: '👀 Stock still, watching the water',
    stab: '💦 A stab at the water!', gulp: v.caught === 'fish' ? '🐟 Got a fish! Down it goes' : '🐸 Got a frog! Down it goes',
    sleep: `💤 Asleep on one leg at ${pond}`,
  }[v.mode];
  const caught = heronCaught(v), off = (v.until - world.tick) / S.TPD;
  const facts = [['🐸', `Came for ${k.for} ${pond}, the pond you dug`],
    ['🎣', caught ? `${caught[0].toUpperCase() + caught.slice(1)} caught so far` : 'Nothing caught yet'],
    ['☀️', 'Fishes from dawn till dusk; at night it sleeps where it stands, on one leg']];
  if (v.mode !== 'out') facts.push(['🗓️', off < 0.5 ? 'Off again at dusk' : `Here for ${days(off + 0.6)} more`]);
  if (v.n > 1) facts.push(['🔁', `${v.n} visits to your ponds so far`]);
  return { emoji: face, tint: k.tint, name: 'Grey heron', sub: `A visitor at ${visitorPlace(v)}`, status, facts };
}

// The days a visitor has left, for its panel: off again at its time of day on its last, or here for so many more.
const staysFor = (v, when) => { const off = (v.until - world.tick) / S.TPD; return off < 0.5 ? `Off again ${when}` : `Here for ${days(off + 0.6)} more`; };
function dragonPanel(v, here) {
  const k = VISITORS.dragonfly, pond = placeLink(v), face = visitorFace(v.kind);
  if (!here) return { emoji: face, tint: k.tint, name: 'Dragonflies', sub: 'Visitors · gone', status: `💨 Gone. More may come to ${pond} another summer.` };
  const status = {
    in: `💨 Flying in to ${pond}`, out: '💨 Off over the meadow', dart: `💨 Darting over ${pond}, after midges`, hover: `👀 Hanging still over ${pond}`,
    perch: `🌾 Resting on a reed at the edge of ${pond}`, home: '🌾 Off to the reeds', roost: `🌾 Settled on the reeds of ${pond}, till the day warms`,
  }[v.mode];
  const facts = [['💧', `Came for ${k.for} ${pond}, the pond you dug`], ['🐟', 'No fish in it to eat their young, so they lay their eggs there'],
    ['☀️', 'Out from when the day warms till the evening; at night and in the rain, on the reeds']];
  if (v.mode !== 'out') facts.push(['🗓️', staysFor(v, 'this afternoon')]);
  if (v.n > 1) facts.push(['🔁', `${v.n} visits to your ponds so far`]);
  return { emoji: face, tint: k.tint, name: 'Dragonflies', sub: `Visitors at ${visitorPlace(v)}`, status, facts };
}
function kingPanel(v, here) {
  const k = VISITORS.kingfisher, pond = placeLink(v), face = visitorFace(v.kind);
  if (!here) return { emoji: face, tint: k.tint, name: 'Kingfisher', sub: 'A visitor · gone', status: `🪶 Flown off. One may come again to ${pond}.` };
  const tree = v.tree ? thingLink('tree', v.tree.id, treeName(v.tree).toLowerCase()) : 'bank';
  const status = {
    in: `🪶 Coming in low and fast over the water to ${pond}`, out: '🪶 Off low over the water', watch: `👀 On a low branch of the ${tree}, watching the water`,
    dive: '💦 Diving!', under: '💦 Under the water!', back: v.caught ? '🐟 Up with a fish!' : '🪶 Back up to its branch, with nothing',
    beat: '🐟 Beating its fish on the branch, then down it goes, head first', sleep: `💤 Asleep on its branch over ${pond}`,
  }[v.mode];
  const facts = [['🐟', `Came for ${k.for} ${pond}, the pond you dug onto the water`], ['🌳', `Fishes from the ${tree} at its edge`],
    ['🎣', v.fish ? `${v.fish === 1 ? 'A fish' : `${v.fish} fish`} caught so far` : 'Nothing caught yet']];
  if (v.mode !== 'out') facts.push(['🗓️', staysFor(v, 'this evening')]);
  if (v.n > 1) facts.push(['🔁', `${v.n} visits to your ponds so far`]);
  return { emoji: face, tint: k.tint, name: 'Kingfisher', sub: `A visitor at ${visitorPlace(v)}`, status, facts };
}
function larkPanel(v, here) {
  const k = VISITORS.skylark, strip = placeLink(v), face = visitorFace(v.kind);
  if (!here) return { emoji: face, tint: k.tint, name: 'Skylark', sub: 'A visitor · gone', status: `🎵 Flown off. One may come again to ${strip}.` };
  const status = {
    in: `🪶 Coming down to ${strip}`, out: '🪶 Off, high over the meadow', walk: `🌼 Walking among the flowers of ${strip}`, peck: '🌱 Pecking for seeds and beetles',
    rise: '🎵 Rising straight up, singing', sing: `🎵 Singing, high over ${strip}`, drop: `🪂 Dropping back down to ${strip}`, sleep: `💤 Asleep in the flowers of ${strip}`,
  }[v.mode];
  const facts = [['🌼', `Came for ${k.for} ${strip}, the strip you sowed`], ['🌳', `Nothing standing within ${Math.floor(v.strip.clear)} tiles of it: no tree, no hedge`],
    ['🎵', v.songs ? `Has sung over it ${v.songs === 1 ? 'once' : `${v.songs} times`}` : 'Hasn’t sung yet']];
  if (v.mode !== 'out') facts.push(['🗓️', staysFor(v, 'this evening')]);
  if (v.n > 1) facts.push(['🔁', `${v.n} visits to your strips so far`]);
  return { emoji: face, tint: k.tint, name: 'Skylark', sub: `A visitor at ${visitorPlace(v)}`, status, facts };
}

const VISITOR_PANELS = { hedgehog: (v, here) => hogPanel(v, here), heron: (v, here) => heronPanel(v, here), dragonfly: dragonPanel, kingfisher: kingPanel, skylark: larkPanel };
const THINGS = {
  visitor: {                                               // (?keep) a hedgehog at a hedge, a heron at a pond, ...: before the trees, as a hedgehog is at the foot of one
    at(sx, sy) {
      if (!world.visitors) return null;
      for (const v of world.visitors) {
        const d = drawnAt(v), [x, y] = toScreen(d.x, d.y), px = visitorPx(v);
        if (visitorFade(v) <= 0.3 || v.kind === 'kingfisher' && v.mode === 'under') continue;
        if (v.kind === 'hedgehog') { if (Math.abs(sx - x) < px * 0.5 && sy > y - px * 0.35 && sy < y + px * 0.45) return v; continue; }
        const up = visitorUp(v, px), feet = y + visitorFeet() - up;
        if (v.kind === 'heron') { if (Math.abs(sx - x) < px * (up > 1 ? 0.48 : 0.32) && sy > feet - px * 0.85 && sy < feet + px * 0.06) return v; continue; }
        const r = Math.max(fingerTap ? 24 : 16, px * 0.55), cy = feet - px * (v.kind === 'dragonfly' ? 0 : v.kind === 'kingfisher' ? 0.21 : 0.36);
        if ((sx - x) ** 2 + (sy - cy) ** 2 < r * r) return v;   // (a small one: a round target, big enough for a finger)
      }
      return null;
    },
    here: v => !v.gone && !!world.visitors?.includes(v),
    spot: v => { const d = drawnAt(v); return { x: d.x, y: d.y + 0.15, r: 0.5 }; },
    show(v) { return VISITOR_PANELS[v.kind](v, this.here(v)); },
  },

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
        ? fields.map(f => `${f.emoji[0]} ${thingLink('field', f.id, esc(f.name))} <span class="dim">· ${f.strip ? 'every season' : seasonName(f.season)} · to the ${compass(f.x - h.x, f.y - h.y)}</span>`).join('<br>')
        : 'No flower fields, only the flowers scattered about']);
      if (bees.length) sections.push(['Bees', linkList(bees)]);
      return {
        emoji: h.cluster ? '🐝' : '🌳', tint: '#e8b83a', name: h.cluster ? `Queen ${q.name}'s swarm` : q ? `Queen ${q.name}'s hive` : 'Empty hive',
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
 };
      const stage = S.treeStage(world, d), age = S.treeAge(world, d), k = S.TREES[d.kind], i = tileOf(d.x, d.y), wood = world.wood[i];
      const where = wood >= 0.95 ? 'deep in the wood' : wood >= 0.6 ? 'at the edge of the wood' : 'standing on its own';   // as plantTrees tells them
      const living = S.standing(d), young = YOUNG.has(stage);
      let status;
      if (d.stump) status = `⚡ Struck by lightning ${ago(d.stump)} ago. It will sprout again from the stump.`;
      else if (stage === 'log') status = `🪵 Down ${ago(d.fallen)}, rotting away. Beetles and fungi are at work.`;
      else if (stage === 'dead') status = `🪾 Died ${ago(d.dead)} ago. It stands grey and bare, and one day it will fall.`;
      else if (young && wood > k.shade) status = k.shade > 0.6 ? '🌑 Waiting in the shade for an old tree to fall' : '🌑 Too much shade: it is struggling';
      else if (young && d.size < S.SAPLING) status = d.hedge ? '🌿 A young whip: the thorns keep the rabbits off it, mostly' : thornGuard(d) ? '🌿 Safe among the thorns from hungry rabbits' : '🐇 Small enough for a rabbit to nibble';
      else status = treeSeason(d);
      const facts = [], parent = d.parent && world.decor.find(o => o.id === d.parent);
      const from = parent ? thingLink('tree', parent.id, treeTitle(parent).replace(/^The /, 'the ')) : `an old ${kind} long gone`;
      if (living || d.stump) facts.push(['🎂', `${age < 1 ? days(age * S.YEAR_DAYS) : `${Math.floor(age)} ${Math.floor(age) === 1 ? 'year' : 'years'}`} old`]);
      if (d.sprouted) facts.push(['🪵', 'Grew again from the stump of a tree lightning took']);
      else if (d.by === 'crow') facts.push(['🐦‍⬛', `Grew from ${k.mast === 'acorns' ? 'an acorn' : 'a beechnut'} a crow carried off from ${from}, buried, and forgot`]);
      else if (d.by === 'bird') facts.push(['🐦', `Grew from a stone a bird dropped, from ${d.kind === 'cherry' ? 'the cherries' : 'the haws'} of ${from}`]);
      else if (d.by === 'wind') facts.push(['🌬️', `Its seed blew in on the wind from ${from}`]);
      else if (d.by === 'water') facts.push(['🌊', `Its seed fell in the water from ${from}, floated off and washed up here`]);
      else if (d.by === 'drop') facts.push(k.mast ? ['🌰', `Grew from ${k.mast === 'acorns' ? 'an acorn' : 'a beechnut'} that fell from ${from}`] : ['🍎', `Grew from a pip of ${from}`]);
      if (d.hive) facts.push(['🐝', `${thingLink('hive', d.hive.id, d.hive.queen ? `Queen ${esc(d.hive.queen.name)}'s hive` : 'An empty hive')} is in its hollow`]);
      const otter = d.holt && world.byId.get(d.holt);
      if (otter && otter.alive) facts.push(['🦦', `${link(otter)} the otter has her holt in its roots, down by the water`]);
      else if (S.hollow(world, d)) facts.push(['🕳️', `Old enough to have gone hollow: bees could make a home in it`]);
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
      const otter = d.holt && world.byId.get(d.holt);
      if (otter && otter.alive) facts.push(['🦦', `${link(otter)} the otter has her holt under it, down by the water`]);
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
      const how = { fox: `caught by ${killer ? killer.name : 'a fox'}`, hunger: 'starved', age: 'old age',
        lightning: 'lightning' }[c.cause] || c.cause;
      const name = `The remains of ${c.name}`, sub = `${c.species === 'fox' ? 'A fox' : `A ${c.sp.name.toLowerCase()}`} (${how})`;
      if (!this.here(k)) return { emoji: '🌱', tint: '#9cc27a', name, sub, status: '🌱 Gone back into the ground. The grass will be lush here for a while.' };
      const crows = world.creatures.filter(o => o.alive && o.target === k && o.mode === 'carrion');
      const status = crows.length ? `🐦‍⬛ ${crows.length === 1 ? `${link(crows[0])} is` : `${crows.length} crows are`} pecking at them`
        : world.tick - k.fox < 150 ? '🦊 A fox was here: the crows keep off a while' : '🍂 Lying in the grass, going back to the earth';
      const ago = world.tick - c.died, facts = [['📖', `${link(c)} died ${ago < S.TPD ? hours(ago) : days(ago / S.TPD)} ago`]];
      const s = S.seasonOf(world.tick);
      facts.push(s === 1 ? ['☀️', 'In the summer heat they won\'t last long'] : s === 3 ? ['❄️', 'In the cold they keep a while'] : ['🍂', 'They\'ll be gone in a few days']);
      if (crows.length > 1) facts.push(['🐦‍⬛', linkList(crows, 6)]);
      return { emoji: c.species === 'crow' ? '🪶' : '🍂', tint: '#b8a47a', name, sub, status, facts, meters: [['Left', k.meat / k.full, '']] };
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
      let tiles = 0, grass = 0;
      for (let i = 0; i < world.fieldAt.length; i++) if (world.fieldAt[i] === f.id && !world.water[i]) { tiles++; grass += world.grass[i]; }
      const status = season === f.season ? (open ? `${f.emoji[0]} In bloom: ${open} of ${plants.length} flowers open`
        : '🐇 Grazed down: no flowers open')
        : `🌿 Resting: it blooms in ${seasonName(f.season)}`;
      const inField = c => world.fieldAt[tileOf(c.x, c.y)] === f.id;
      const now = world.creatures.filter(c => c.alive && !c.hidden && inField(c));
      const hives = world.hives.filter(h => !h.cluster && Math.hypot(f.x - h.x, f.y - h.y) < S.FORAGE_RANGE);
      const sections = [['Hives in reach', hives.length
        ? hives.map(h => `🐝 ${thingLink('hive', h.id, h.queen ? esc(`Queen ${h.queen.name}'s hive`) : 'Empty hive')}`).join('<br>')
        : 'None: only a bee from far off comes here']];
      if (now.length) sections.push(['Here now', linkList(now)]);
      return {
        emoji: f.emoji[0], tint: `rgb(${f.tint})`, name: f.name, sub: `A field of ${f.kind.names.join(' and ').toLowerCase()} · ${tiles} tiles`,
        status, sections, meters: [['Grass', tiles ? grass / tiles : 0, '']],
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
      facts.push(...pondFacts(i, world.body[i]));
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
function pondFacts(i, b = world.body[i]) {
  const out = [], y = world.frogYear;
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
  Object.assign(ui, { selectedId: 0, follow: false, trail: [], sheetUp: false, picked: { kind, it, at, name: '' } });
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
        <div class="ins-name">${esc(v.name)}</div>
        <div class="ins-sub">${esc(v.sub)}</div>
      </div>
      <button class="close" data-act="close" title="Close (Esc)" aria-label="Close">✕</button>
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
  flick.vx = flick.vy = 0;
  const close = narrow() ? 16 : 22;           // a phone keeps a little more of the meadow around it
  if (id && zoomIn && cam.zoom < close - 2) cam.goal = close;
  renderInspector();
}

// The sheet on an upright phone follows the finger: drag the folded line, the handle or the name, and it comes with you
// (pulled up off the line, it's the whole sheet, its top under the finger); let go and it settles open, folded or away by
// where it is and how fast it was going. A tap on the line opens it and on the handle folds it (the click handler).
let swipe = null, pressing = false;          // swipe: a finger on the sheet's grip; while one's down, it isn't rebuilt under it
let sheetQuiet = 0;
const slide = (el, frames, ms = 240, fill = 'none') => el.animate(frames, { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill });                          // (no tap on it just after a drag)
const SHEET_FLICK = 0.4;                     // px a ms: let go this fast and it goes the way it was going
$('#inspector').addEventListener('pointerdown', e => {
  pressing = true;
  if (!(sheet && sheet.bottom) || e.button || !e.target.closest('.sheet-handle, .ins-head, .strip-row') || e.target.closest('button:not(.sheet-handle), input')) return;
  const box = $('#inspector');
  box.getAnimations().forEach(a => a.cancel());
  swipe = { id: e.pointerId, y: e.clientY, ly: e.clientY, lt: e.timeStamp, v: 0, dy: 0, moved: false, strip: box.classList.contains('strip'), h: box.offsetHeight, lift: 0 };
});
addEventListener('pointermove', e => {
  const s = swipe;
  if (!s || e.pointerId !== s.id) return;
  const box = $('#inspector'), dy = e.clientY - s.y;
  if (!s.moved) {
    if (Math.abs(dy) < 8) return;
    s.moved = true;
    box.setPointerCapture(e.pointerId);
  }
  if (e.timeStamp > s.lt) { s.v = s.v * 0.4 + (e.clientY - s.ly) / (e.timeStamp - s.lt) * 0.6; s.ly = e.clientY; s.lt = e.timeStamp; }
  if (s.strip && dy < 0 && !s.lift) {        // up off the folded line: the whole sheet, standing this far above the line
    ui.sheetUp = true; box.scrollTop = 0; renderInspector();
    s.lift = Math.max(1, box.offsetHeight - s.h);
  }
  s.dy = dy;
  const y = s.lift ? s.lift + dy : dy;       // its top, down from where it rests
  box.style.transform = `translateY(${Math.round(y < 0 ? y * 0.2 : y)}px)`;   // (past open it only gives a little)
});
function sheetLetGo(e) {
  pressing = false;
  const s = swipe;
  if (!s || e.pointerId !== s.id) return;
  swipe = null;
  if (!s.moved) return;                      // a tap: the click handler has it
  sheetQuiet = performance.now() + 350;
  const box = $('#inspector'), y = s.lift ? s.lift + s.dy : s.dy, from = box.style.transform, v = e.type === 'pointercancel' ? 0 : s.v;
  box.style.transform = '';
  const settle = (start, ms = 220) => slide(box, [{ transform: start }, { transform: 'none' }], ms).finished.then(measureSheet, () => {});
  if (s.lift) {                              // pulled up off the line: open, or back down to it
    if (y < s.lift * 0.65 || v < -SHEET_FLICK) settle(from);
    else { ui.sheetUp = false; renderInspector(); settle(`translateY(${Math.min(0, Math.round(s.dy))}px)`); }
  } else if (s.strip) {                      // the line pushed down: away
    if (y > 28 || v > SHEET_FLICK) select(0);
    else settle(from, 160);
  } else if (y > s.h * 0.75) select(0);      // the open sheet dragged most of the way off: away
  else if (y > 70 || v > SHEET_FLICK) {      // down: folded to its line
    ui.sheetUp = false; box.scrollTop = 0; renderInspector();
    settle(`translateY(${Math.min(0, Math.round(y - (s.h - box.offsetHeight)))}px)`);
  } else settle(from, 160);
}
addEventListener('pointerup', sheetLetGo);   // (on the window: the finger may be anywhere by now)
addEventListener('pointercancel', e => { if (swipe) sheetLetGo(e); pressing = false; });
$('#inspector').addEventListener('click', e => { if (performance.now() < sheetQuiet) e.stopPropagation(); }, true);
// On its side the open panel folds to its line with a swipe to the right, the way it hangs (?keep has no handle there).
let sideSwipe = null;
$('#inspector').addEventListener('pointerdown', e => {
  sideSwipe = short() && e.pointerType !== 'mouse' && !$('#inspector').classList.contains('strip') ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
});
addEventListener('pointermove', e => {
  const s = sideSwipe;
  if (!s || e.pointerId !== s.id) return;
  const dx = e.clientX - s.x, dy = Math.abs(e.clientY - s.y);
  if (dy > 24 && dy > dx) sideSwipe = null;                      // a scroll
  else if (dx > 56 && dx > dy * 2) {
    sideSwipe = null; sheetQuiet = performance.now() + 350;
    ui.sheetUp = false; $('#inspector').scrollTop = 0; renderInspector();
  }
});
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, () => { sideSwipe = null; });

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

// Paused or running: the one button in the corner, and space.
function setSpeed(s) {
  ui.speed = s;
  Sound.update({ speed: s });
  const b = $('[data-act="pause"]');
  b.textContent = s ? '⏸' : '▶';
  b.title = s ? 'Pause (space)' : 'Carry on (space)';
}

// Two fingers pinch: the spot of meadow between them stays under them as they spread and move.
let drag = null, pinch = null, scrollRest = { x: 0, y: 0 };
let fingerTap = false;                    // the last press was a finger: taps may wobble a little and hit a little wider
// Let go of a pan while still moving and the meadow glides on a little (screen pixels a second).
const flick = { vx: 0, vy: 0 };
const fingers = new Map();

// A mouse, a trackpad or a finger sends its moves when it likes, not once a frame: Safari hands them over as they come,
// so one frame got two moves and the next none, and a drag, a two-finger scroll or a pinch went in jerks at a steady
// 60 fps (a quarter to a third of the frames in Safari, a few in Chrome). So the camera they move is drawn as it was a
// moment ago (handLag: a move's time and a bit), read off the moves at their own times, the same delay every frame, as
// phones resample a finger: it goes as evenly as the hand did. The camera itself (cam) is always where the last move
// left it; only the drawing waits (handShow, handBack). A move after a pause starts from where it stood a move before.
const HAND_N = 16, HAND_GAP = 60;         // moves kept; after a pause this long (ms) the next move starts afresh
const hand = { t: new Float64Array(HAND_N), x: new Float64Array(HAND_N), y: new Float64Array(HAND_N), z: new Float64Array(HAND_N),
  n: 0, every: 16, was: { x: 0, y: 0, zoom: 1 }, kept: { x: 0, y: 0, zoom: 1 } };   // every: ms between moves, learnt
const handLag = () => Math.min(40, 1.25 * hand.every + 2);
function handNote(t, c) {
  const i = hand.n++ % HAND_N;
  hand.t[i] = t; hand.x[i] = c.x; hand.y[i] = c.y; hand.z[i] = c.zoom;
}
// After a move has moved the camera: where it is now, at the move's own time (e.timeStamp).
function handMoved(t) {
  const h = hand, last = h.n ? h.t[(h.n - 1) % HAND_N] : -Infinity;
  if (t - last > HAND_GAP) { h.n = 0; handNote(t - h.every, h.was); }   // (h.was: where the last frame left it)
  else {
    if (t <= last) t = last + 0.01;                    // (two moves in the same whole ms: Safari's times)
    h.every += (clamp(t - last, 4, 40) - h.every) * 0.2;
  }
  handNote(t, cam);
}
// Before a frame draws: the camera put where the hand had it handLag() ago; true if it was (handBack puts it back).
function handShow(now) {
  const h = hand;
  if (!h.n) return false;
  const k = h.n - 1, last = k % HAND_N;
  if (cam.x !== h.x[last] || cam.y !== h.y[last] || cam.zoom !== h.z[last]) { h.n = 0; return false; }   // something else moved it since
  const T = now - handLag();
  if (T >= h.t[last]) { if (T - h.t[last] > HAND_GAP) h.n = 0; return false; }   // caught up with the hand
  let a = k;
  while (a > Math.max(0, h.n - HAND_N) && h.t[a % HAND_N] > T) a--;
  const i = a % HAND_N, j = (a + 1) % HAND_N, u = h.t[i] >= T ? 0 : (T - h.t[i]) / (h.t[j] - h.t[i]);
  h.kept.x = cam.x; h.kept.y = cam.y; h.kept.zoom = cam.zoom;
  cam.x = h.x[i] + (h.x[j] - h.x[i]) * u; cam.y = h.y[i] + (h.y[j] - h.y[i]) * u; cam.zoom = h.z[i] * (h.z[j] / h.z[i]) ** u;
  return true;
}
function handBack() { cam.x = hand.kept.x; cam.y = hand.kept.y; cam.zoom = hand.kept.zoom; }

// Zoom with one hand, with Look in hand, as Google's and Apple's maps do: a double tap zooms in on the spot, a double
// tap held and dragged zooms as it goes (down for closer, up for further off), and a tap of two fingers zooms out.
// A tap that would only put the inspector away waits to see if it's the first of two (tapAway), so a double tap
// next to the one you follow doesn't lose it.
const DOUBLE_MS = 300, DOUBLE_PX = 40;    // the second tap: this soon after the first, this near it
const ZOOM_DRAG = 0.009;                  // a double tap dragged: the zoom doubles every 77 px or so
let lastTap = null, zoomDrag = null;      // the last tap of a finger { t, x, y }; a double tap held { id, y, z, sx, sy, moved }
let zoomTo = null;                        // a zoom easing in or out on a spot { sx, sy, z } (frame)
let tapAway = 0;

function startPinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const [wx, wy] = toWorld(mx, my);
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: cam.zoom, wx, wy, mx, my, t0: performance.now(), moved: false };
  drag = null; zoomDrag = null; zoomTo = null; cam.goal = null; ui.follow = false;
}

function movePinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y);
  if (Math.abs(d - pinch.d) > 12 || Math.hypot(mx - pinch.mx, my - pinch.my) > 12) pinch.moved = true;
  cam.zoom = clamp(pinch.zoom * d / pinch.d, fitZoom, 64);
  cam.x = pinch.wx - (mx - vw / 2) / cam.zoom; cam.y = pinch.wy - (my - vh / 2) / cam.zoom;
  clampCam();
}

function liftFinger(e) {
  fingers.delete(e.pointerId);
  if (!pinch) return false;
  if (fingers.size >= 2) startPinch();
  else {                                  // one finger left: carry on as a plain drag, never a tap
    if (!pinch.moved && performance.now() - pinch.t0 < DOUBLE_MS) zoomTo = { sx: pinch.mx, sy: pinch.my, z: clamp(cam.zoom / 2, fitZoom, 64) };   // two fingers tapped: out
    pinch = null;
    const [f] = fingers.values();
    if (f) drag = { x: f.x, y: f.y, cx: cam.x, cy: cam.y, moved: true, t: e.timeStamp, lx: f.x, ly: f.y, vx: 0, vy: 0 };
  }
  return true;
}

canvas.addEventListener('pointerdown', e => {
  if (!world) return;                     // (a kept meadow still opening)
  if (e.button === 2 || (e.ctrlKey && e.pointerType === 'mouse')) return;
  canvas.setPointerCapture(e.pointerId);
  fingerTap = e.pointerType === 'touch';
  flick.vx = flick.vy = 0;
  zoomTo = null;
  if (fingerTap) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size >= 2) { startPinch(); return; }
  const tap = lastTap;
  lastTap = null;
  if (fingerTap && tap && e.timeStamp - tap.t < DOUBLE_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < DOUBLE_PX) {
    clearTimeout(tapAway); tapAway = 0;   // (the first tap put nothing away after all)
    const sel = ui.follow && world.byId.get(ui.selectedId), [sx, sy] = sel ? toScreen(drawnAt(sel).x, drawnAt(sel).y) : [e.clientX, e.clientY];
    zoomDrag = { id: e.pointerId, y: e.clientY, z: cam.zoom, sx, sy, moved: false };
    drag = null; cam.goal = null;
    return;
  }
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, t: e.timeStamp, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0, id: e.pointerId };
});
canvas.addEventListener('pointermove', e => {
  if (!world) return;
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); handMoved(e.timeStamp); return; }
  if (zoomDrag && e.pointerId === zoomDrag.id) {
    const dy = e.clientY - zoomDrag.y;
    if (zoomDrag.moved || Math.abs(dy) > 8) { zoomDrag.moved = true; zoomAt(zoomDrag.sx, zoomDrag.sy, zoomDrag.z * Math.exp(dy * ZOOM_DRAG)); handMoved(e.timeStamp); }
    return;
  }
  if (!drag) {
    const c = creatureAt(e.clientX, e.clientY);
    ui.hoverId = c ? c.id : 0;
    ui.hoverHive = c ? null : hiveAt(e.clientX, e.clientY);
    return;
  }
  let dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) > (e.pointerType === 'touch' ? 10 : 4)) {
    drag.moved = true;
    drag.x = e.clientX; drag.y = e.clientY; dx = dy = 0;   // start from here, no jump
  }
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
    handMoved(e.timeStamp);
  }
});
canvas.addEventListener('pointerup', e => {
  if (zoomDrag && e.pointerId === zoomDrag.id) {           // a double tap: in on the spot, unless it was dragged
    fingers.delete(e.pointerId);
    if (!zoomDrag.moved) zoomTo = { sx: zoomDrag.sx, sy: zoomDrag.sy, z: clamp(cam.zoom * 2, fitZoom, 64) };
    zoomDrag = null;
    return;
  }
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) {
    click(e.clientX, e.clientY);
    if (fingerTap) lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }
  else if (drag && e.pointerType === 'touch' && e.timeStamp - drag.t < 60 && Math.hypot(drag.vx, drag.vy) > 250) {
    flick.vx = drag.vx; flick.vy = drag.vy;
  }
  drag = null;
});
canvas.addEventListener('pointercancel', e => {
  if (zoomDrag && e.pointerId === zoomDrag.id) { fingers.delete(e.pointerId); zoomDrag = null; return; }
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  drag = null;
});
// Safari ignores the viewport's no-zoom, and a zoomed page makes the whole meadow blurry.
document.addEventListener('gesturestart', e => e.preventDefault());
// Safari on a phone shows a button pressed (:active) only where something listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true });
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ui.hoverId = 0; ui.hoverHive = null; } });   // a lifted finger leaves too
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? innerHeight : 1;   // Firefox's wheel counts lines (3 a notch, Chrome's 100 px)
  const ddx = e.deltaX * unit, ddy = e.deltaY * unit;
  const pixelPan = !e.ctrlKey && e.deltaMode === 0 && (ddx !== 0 || Math.abs(ddy) < 40);
  if (pixelPan) {                     // trackpad two-finger scroll: look around
    const dx = wholePx(scrollRest.x + ddx), dy = wholePx(scrollRest.y + ddy);
    scrollRest = { x: scrollRest.x + ddx - dx, y: scrollRest.y + ddy - dy };   // the rest comes next time
    cam.x += dx / cam.zoom; cam.y += dy / cam.zoom;
    ui.follow = false; clampCam();
  } else {                            // mouse wheel or pinch: zoom
    cam.goal = null; zoomTo = null;
    zoomAt(e.clientX, e.clientY, cam.zoom * Math.exp(-ddy * (e.ctrlKey ? 0.012 : 0.0018)));
  }
  handMoved(e.timeStamp);
}, { passive: false });

function click(sx, sy) {
  clearTimeout(tapAway); tapAway = 0;
  const c = creatureAt(sx, sy), t = !c && thingAt(sx, sy);
  if (t) pick(t.kind, t.it, toWorld(sx, sy));
  else if (!c && fingerTap && (ui.selectedId || ui.picked)) tapAway = setTimeout(() => { tapAway = 0; select(0); syncBack(); }, DOUBLE_MS);   // (unless it's a double tap)
  else select(c ? c.id : 0);
  ui.hoverHive = null;
}


// The ••• menu: things you do to the whole meadow, kept away from everyday buttons.
function toggleMore(open = $('#more-menu').classList.contains('hidden')) {
  $('#more-menu').classList.toggle('hidden', !open);
  $('[data-act="more"]').classList.toggle('on', open);
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
  if (!IDEAS_KEY || played < 0 || document.hidden) return;
  if ((played += ms) < ASK_MS) return;
  if (!$('#more-menu').classList.contains('hidden')) return;
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
    toast("💌 Couldn't send your idea just now. Your words are still in the box, try again in a moment.");
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
    () => toast('🔗 Link copied. Anyone who opens it gets this same meadow from the start.'),
    () => toast(`🔗 Couldn't copy. The link is ${esc(location.href)}`));
}


document.addEventListener('click', e => {
  const t = e.target.closest('[data-action],[data-act],a[data-id],a[data-thing]');
  if (!(t && t.dataset.act === 'more')) toggleMore(false);
  if (!t) return;
  if (t.closest('#hud-right .hud-top')) chime('click');
  if (t.dataset.action === 'new') { if (confirm('Start a brand-new meadow? This one will be gone.')) newWorld(randomSeed()); }
  else if (t.dataset.act === 'pause') setSpeed(ui.speed ? 0 : 1);
  else if (t.dataset.act === 'close') select(0);
  else if (t.dataset.act === 'sheet-up' || t.dataset.act === 'sheet-down') {
    ui.sheetUp = t.dataset.act === 'sheet-up';
    $('#inspector').scrollTop = 0;
    renderInspector();
  }
  else if (t.dataset.act === 'more') toggleMore();
  else if (t.dataset.act === 'copy-link') copyLink();
  else if (t.dataset.act === 'ideas') { played = -Infinity; askIdeas(true); }   // found it themselves: no need to ask
  else if (t.dataset.act === 'ask-later') askIdeas(false);
  else if (t.dataset.act === 'ask-send') sendIdea();
  else if (t.dataset.act === 'sound') toggleSound();
  else if (t.dataset.act === 'follow') { ui.follow = !ui.follow; renderInspector(); }
  else if (t.dataset.act === 'traits') { ui.allTraits = !ui.allTraits; renderInspector(); }
  else if (t.dataset.act === 'story') { ui.allStory = !ui.allStory; renderInspector(); }
  else if (t.dataset.thing) goToThing(t.dataset.thing);
  else if (t.dataset.id) {
    const c = world.byId.get(+t.dataset.id);
    if (c) select(c.id);
  }
});

// A thing a link names ('water:3', 'field:12', 'tree:40', 'hive:2'), shown in the inspector.
function goToThing(thing) {
  const [kind, id] = thing.split(':');
  if (kind === 'water') {
    const v = world.waters[+id];
    if (v) pick('water', { body: v, x: cam.x, y: cam.y });
    return;
  }
  const it = (kind === 'hive' ? world.hives : kind === 'tree' ? world.decor.filter(o => o.tree) : kind === 'visitor' ? world.visitors || [] : world.fields).find(o => o.id === +id);
  if (kind === 'visitor' && it) { select(0); ui.follow = false; cam.x = it.x; cam.y = it.y; clampCam(); }
  if (it) pick(kind, it);
}

document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea') || !world) return;
  if ((e.metaKey || e.ctrlKey || e.altKey) && /^[a-z]$/i.test(e.key)) return;   // ⌘C, Ctrl+Z…: the browser's
  if (e.key === ' ') { e.preventDefault(); setSpeed(ui.speed ? 0 : 1); }
  else if (e.key === 'Escape') stepOut();
  else if (e.key === 'f' && ui.selectedId) { ui.follow = !ui.follow; renderInspector(); }
  else if (e.key === 'm') toggleSound();
  else if (e.key === '+' || e.key === '=') zoomAt(vw / 2, vh / 2, cam.zoom * 1.25);
  else if (e.key === '-') zoomAt(vw / 2, vh / 2, cam.zoom / 1.25);
});

// ------------------------------------------------------------------ Back
//
// Back (Android's button, Safari's swipe from the edge) steps out of what's open, as Esc does, instead of leaving the
// meadow: a card or a menu shuts, the inspector's open sheet folds and then it shuts (stepOut).
// Each thing open holds a step of this page's in the browser's history (back.token). They're counted, not named
// (opened): after every tap or key, once everything else has had it, the history is brought level with what's open, a
// step pushed for each one opened and taken back for each one shut (one shut and another opened in the same tap leave
// it be). Safari skips a step a page adds outside a tap, so they're only ever added in one.
const back = { token: Math.random().toString(36).slice(2), depth: 0, going: false, timer: 0 };
const moreOpen = () => !$('#more-menu').classList.contains('hidden');
function opened() {
  const ins = $('#inspector').classList, sheetUp = ins.contains('open') && narrow() && !ins.contains('strip');
  return [askOpen(), moreOpen(), ins.contains('open'), sheetUp].filter(Boolean).length;
}
// The one on top shuts (Esc, and Back once for each step it takes).
function stepOut() {
  const ins = $('#inspector').classList;
  if (askOpen()) askIdeas(false);
  else if (moreOpen()) toggleMore(false);
  else if (ins.contains('open') && narrow() && !ins.contains('strip')) { ui.sheetUp = false; $('#inspector').scrollTop = 0; renderInspector(); }
  else if (ins.contains('open')) select(0);
  else return false;
  return true;
}
function syncBack() {
  if (back.going) return;
  const n = opened();
  while (back.depth < n) history.pushState({ meadow: back.token, n: ++back.depth }, '');
  if (n < back.depth && history.state?.meadow === back.token && history.state.n === back.depth) goBack(back.depth - n);
}
function goBack(k) {
  back.going = true;
  clearTimeout(back.timer); back.timer = setTimeout(() => { back.going = false; }, 800);   // (in case no popstate comes)
  history.go(-k);
}
for (const type of ['click', 'pointerup', 'keydown']) addEventListener(type, syncBack);
addEventListener('popstate', e => {
  const n = e.state?.meadow === back.token ? e.state.n : 0;
  if (location.search !== meadowLink(world.seed)) history.replaceState(history.state, '', meadowLink(world.seed));   // (a step taken before a new meadow)
  if (back.going) { back.going = false; back.depth = n; return; }   // ours, taking back steps for what was shut
  for (let i = 0; i < 16 && opened() > n; i++) if (!stepOut()) break;
  back.depth = n;
  const now = opened();
  if (now < n) goBack(n - now);                             // past steps for what shut by itself, or Forward into old ones
});

// ------------------------------------------------------------------ keeping the meadow
//
// The meadow is kept in the browser when the page is hidden or closed, and the next visit picks it up
// where it was (Sim.packWorld), with the camera and whoever you were following. A kept meadow
// is a few megabytes, too big for localStorage, so it goes in IndexedDB under its link, and localStorage
// keeps the list of links, the one watched last first. A few are kept, so a meadow a friend sent doesn't
// take the place of your own: the bare address opens the last one, a link its own.
// A kept meadow that won't open, or that broke the page the last time it opened (OPENING), is let go.
const KEEP_MEADOWS = 3;
const KEPT = 'aeon-garden-kept', OPENING = 'aeon-garden-opening';   // in localStorage
let keepOpen = null, keptTick = -1;
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

// Hiding the page or leaving it (below): a few hundredths of a second, so never while someone is watching.
function keepMeadow() {
  if (opening === 1) cleared();                       // never shown (a tab in the background): it can't have broken anything
  if (!world || world.tick === keptTick) return;
  let kept;
  try { kept = S.packWorld(world); } catch (e) { console.warn('Could not keep the meadow', e); return; }
  keptTick = world.tick;
  const link = meadowLink(world.seed), at = Date.now();
  const list = [{ link, at }, ...keptList().filter(k => k.link !== link)];
  if (!setKept(list.slice(0, KEEP_MEADOWS))) return;
  const rec = { link, at, kept, paused: ui.speed === 0,
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
    showWorld(w);
    S.step(world);                                    // a meadow that can't take a step is no good
    flushEvents();
  } catch (e) {
    console.warn('The kept meadow would not open', e);
    forgetMeadow(rec.link);
    return false;
  }
  opening = 1;
  if (rec.cam) { cam.zoom = Math.max(rec.cam.zoom, fitZoom); cam.x = rec.cam.x; cam.y = rec.cam.y; clampCam(); }
  const c = world.byId.get(rec.selectedId);
  if (c) { select(c.id, false); ui.follow = rec.follow; }
  history.replaceState(history.state, '', meadowLink(world.seed));
  return true;
}

document.addEventListener('visibilitychange', () => { if (document.hidden) keepMeadow(); });
addEventListener('pagehide', keepMeadow);

// ------------------------------------------------------------------ the loop

function flushEvents() {
  for (const e of world.events) handleEvent(e);
  world.events.length = 0;
}

function randomSeed() { return Math.floor(Math.random() * 1e6); }

function newWorld(seed) {
  showWorld(S.createWorld(seed));
  history.replaceState(history.state, '', meadowLink(seed));   // (the state: Back's step, if one's open)
  homeView();
}

// A new meadow opens close enough to see who lives there, HOME_TILES across the screen, over where most of them are:
// the square a screen across with the most animals in the open (under the trees they'd be hidden), counted on a coarse
// grid, once. All of it is a pinch away.
const HOME_TILES = [45, 24];              // tiles across: a computer, a phone
const HOME_CELL = 8;                      // tiles a cell of the count
function homeView() {
  const zoom = Math.max(minZoom, vw / HOME_TILES[narrow() ? 1 : 0]);
  const gw = Math.ceil(S.W / HOME_CELL), gh = Math.ceil(S.H / HOME_CELL), n = new Uint16Array(gw * gh);
  for (const c of world.creatures) {
    if (c.alive && c.species !== 'bee' && world.wood[Math.floor(c.y) * S.W + Math.floor(c.x)] < 0.4) n[Math.min(gh - 1, Math.floor(c.y / HOME_CELL)) * gw + Math.min(gw - 1, Math.floor(c.x / HOME_CELL))]++;
  }
  const rx = Math.max(1, Math.round(vw / zoom / HOME_CELL / 2)), ry = Math.max(1, Math.round(vh / zoom / HOME_CELL / 2));
  let best = -1, bx = S.W / 2, by = S.H / 2;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let sum = 0;
    for (let j = 1 - ry; j < ry; j++) for (let i = 1 - rx; i < rx; i++) {
      const a = x + i, b = y + j;
      if (a >= 0 && b >= 0 && a < gw && b < gh) sum += n[b * gw + a];
    }
    if (sum > best) { best = sum; bx = (x + 0.5) * HOME_CELL; by = (y + 0.5) * HOME_CELL; }
  }
  Object.assign(cam, { zoom, x: bx, y: by, goal: null });
  clampCam();
}

// Everything a meadow needs to be the one on screen, a new one or a kept one (resumeWorld).
function showWorld(w) {
  world = w;
  const seed = w.seed;
  groundSeed = [(seed % 97) * 3.7, (seed % 89) * 4.3];
  Object.assign(ui, { selectedId: 0, picked: null, hoverId: 0, follow: false, trail: [], effects: [] });
  pollen.until = 0; pollen.t0.fill(-1e9);
  const mix = Object.fromEntries(Object.keys(S.WEATHER).map(k => [k, k === world.weather.kind ? 1 : 0]));
  Object.assign(ui.sky, { mix, tick: world.tick, bolts: [], rainbow: -1e9, bowEnd: -1e9 });
  $('#news').innerHTML = '';
  cam.zoom = minZoom; cam.x = S.W / 2; cam.y = S.H / 2; cam.goal = null;
  clampCam();
  paintTerrain();
  renderInspector();
  updateClock();
}

let last = performance.now(), acc = 0, lastCard = 0;
const TERRAIN_MS = 250;                   // real time between hand-overs of the grass to the ground (painting grass skips the wait)
// The most real time the sim gets in a frame. A slow phone at 60x would rather run a little slower
// than drop frames: the ticks that don't fit are let go, and don't pile up for the next frame.
// How many fit is learnt as it goes (simFit, from tickMs: a tick's cost, a new day's aside), and each frame runs that
// many: ticks cut off wherever the time ran out made it 12 one frame and 30 the next, and the animals went in jerks.
// SIM_STOP only stops a frame that runs far over (a cost that jumped before simFit could learn it).
const SIM_MS = 6, SIM_STOP = 3 * SIM_MS;
let tickMs = 0.05, simFit = Math.floor(SIM_MS / tickMs);

// A frame's time. Safari gives it in whole ms (16, 17, 17, 16...): at 4x that ran one, two or three ticks a frame, and at
// 60x 28 or 31, so the animals went in jerks at a steady 60 fps. So a frame's time is one beat on from the last, the beat
// (the screen's refresh) learnt as it goes, kept within BEAT_SLACK ms of the browser's time; a frame off the beat (one
// missed, a stall) starts it again from the browser's time, and BEAT_RELEARN of them in a row learn a new beat (a
// phone saving power halves it).
const BEAT_SLACK = 2.5, BEAT_RELEARN = 30;
const beat = { at: 0, ms: 1000 / 60, off: 0 };
function onBeat(now) {
  const next = beat.at + beat.ms, off = now - next;
  if (beat.at && Math.abs(off) < BEAT_SLACK) {
    beat.ms += off * 0.02;                // (the refresh, learnt slowly)
    beat.at = next + off * 0.1;           // (crept toward the browser's time, so it never drifts away)
    beat.off = 0;
  } else {
    const ms = now - beat.at;
    if (++beat.off >= BEAT_RELEARN && ms > 4 && ms < 50) { beat.ms = ms; beat.off = 0; }
    beat.at = now;
  }
  return beat.at;
}

// Paused, the world stands still, but the water, the weather and the trees still move a little:
// 30 frames a second are plenty for that, unless you're looking around or something is happening.
const RESTING_MS = 30, WOKEN_MS = 500;
let lastDrawn = 0, lastInput = 0;

// A meadow is for watching, so on a phone or tablet the screen stays on while time runs, till nobody has touched it
// for WAKE_MS; then it dims and locks as it always would. Paused or hidden, it's let go (the Screen Wake Lock API;
// a browser without it does as it likes).
const WAKE_MS = 10 * 60 * 1000;
const wake = { lock: null, asking: false, retry: 0, touch: matchMedia('(pointer: coarse)') };
function wakeTick(now) {
  if (!navigator.wakeLock || !wake.touch.matches) return;
  const want = ui.speed > 0 && !document.hidden && now - lastInput < WAKE_MS;
  if (want && !wake.lock && !wake.asking && now > wake.retry) {
    wake.asking = true;
    navigator.wakeLock.request('screen').then(l => {
      wake.lock = l;
      l.addEventListener('release', () => { if (wake.lock === l) wake.lock = null; });   // (hidden, the browser lets it go itself)
    }, () => { wake.retry = now + 30000; }).finally(() => { wake.asking = false; });
  } else if (!want && wake.lock) { wake.lock.release().catch(() => {}); wake.lock = null; }
}
const camWas = { x: 0, y: 0, zoom: 0 };
for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize']) addEventListener(type, () => { lastInput = performance.now(); }, { passive: true });
function resting(now) {
  const still = cam.x === camWas.x && cam.y === camWas.y && cam.zoom === camWas.zoom;
  camWas.x = cam.x; camWas.y = cam.y; camWas.zoom = cam.zoom;
  return still && ui.speed === 0 && !ui.effects.length
    && now - lastInput > WOKEN_MS && now - ui.sky.boom > WOKEN_MS;
}

function frame(now) {
  if (opening === 1) opening = 2;
  now = onBeat(now);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (ui.speed > 0) {
    acc += dt * TICKS_PER_SECOND * ui.speed;
    const want = Math.min(Math.floor(acc), 2000), n = Math.min(want, simFit), t0 = performance.now();
    acc -= want;
    let ran = 0, days = 0, dayMs = 0;
    while (ran < n) {
      if (ui.speed <= SMOOTH_SPEED) keepLast();
      const day = (world.tick + 1) % S.TPD === 0, t1 = day ? performance.now() : 0;   // (a new day's tick is the heaviest by far)
      S.step(world);
      if (world.events.length) flushEvents();
      if (day) { days++; dayMs += performance.now() - t1; }
      ran++;
      if (performance.now() - t0 > SIM_STOP) break;
    }
    if (ran > days) {
      tickMs += ((performance.now() - t0 - dayMs) / (ran - days) - tickMs) * 0.05;
      simFit = Math.max(1, Math.floor(SIM_MS / tickMs));
    }
  }
  updateSky();
  lightFrame(dt);
  updateDial();

  const sel = world.byId.get(ui.selectedId);
  if (sel && sel.alive && !sel.hidden) {
    const lastPt = ui.trail[ui.trail.length - 1];
    if (!lastPt || Math.hypot(lastPt.x - sel.x, lastPt.y - sel.y) > 0.5) {
      ui.trail.push({ x: sel.x, y: sel.y });
      if (ui.trail.length > 160) ui.trail.shift();
    }
  }
  if (sel && ui.follow) {
    const k = 1 - Math.pow(0.001, dt), { x, y } = drawnAt(sel);
    const gx = sheet ? x + (sheet.right - sheet.left) / 2 / cam.zoom : x;
    const gy = sheet ? y + (sheet.bottom - sheet.top) / 2 / cam.zoom : y;
    cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k;
  }
  if (flick.vx || flick.vy) {             // a flicked pan glides to a stop
    cam.x -= flick.vx * dt / cam.zoom; cam.y -= flick.vy * dt / cam.zoom;
    const f = Math.pow(0.02, dt);
    flick.vx *= f; flick.vy *= f;
    if (Math.abs(flick.vx) + Math.abs(flick.vy) < 20) flick.vx = flick.vy = 0;
    if (hand.n) { clampCam(); handMoved(now); }   // (carrying on from the hand, still drawn a moment behind)
  }
  if (cam.goal) {
    const k = 1 - Math.pow(0.01, dt);
    cam.zoom += (cam.goal - cam.zoom) * k;
    if (Math.abs(cam.goal - cam.zoom) < 0.05) cam.goal = null;
    cam.zoom = Math.max(cam.zoom, fitZoom);
  }
  if (zoomTo) {                           // a double tap's zoom (or two fingers'), eased in or out on its spot
    const goal = clamp(zoomTo.z, fitZoom, 64), z = cam.zoom + (goal - cam.zoom) * (1 - Math.pow(0.0002, dt));
    zoomAt(zoomTo.sx, zoomTo.sy, Math.abs(goal - z) < goal * 0.01 ? goal : z);
    if (cam.zoom === goal || drag?.moved || pinch) zoomTo = null;
  }
  clampCam();

  const rest = resting(now) && now - lastDrawn < RESTING_MS;
  if (!rest && canvas.width && canvas.height) {   // (a hidden tab can have no size)
    lastDrawn = now;
    // Every 12 ticks, and no more than a few times a second: grass changes too slowly to see the difference.
    if (terrainTick < 0 || (world.tick - terrainTick >= 12 && now - terrainAt >= TERRAIN_MS)) paintTerrain();
    const steadied = handShow(now);        // (a drag, a pinch: drawn where the hand had it a moment ago)
    render(now);
    if (steadied) handBack();
  }
  hand.was.x = cam.x; hand.was.y = cam.y; hand.was.zoom = cam.zoom;

  if (now - lastCard > 250) {
    wakeTick(now);
    askTick(Math.min(now - lastCard, 1000));
    furAhead(now);
    lastCard = now;
    updateClock();
    if (ui.sound) {
      const ck = S.clock(world);
      const life = world.count.rabbit / (S.SPECIES.rabbit.cap * world.room);   // a meadow full of rabbits
      Sound.update({ phase: ck.phase, season: ck.season, speed: ui.speed, sky: ui.sky.mix, bees: beesOnScreen(), life,
        frogs: world.spawnCount > 0 && ck.season === 0 ? Math.min(1, world.spawnCount / 300) : 0 });
    }
    // Not under the mouse or a finger: a rebuilt button would swallow the click. (A finger leaves :hover stuck.)
    if ((ui.selectedId || ui.picked) && !pressing && !(canHover.matches && $('#inspector').matches(':hover'))) renderInspector();
  }
  if (opening > 1 && ++opening > 4) cleared();       // a kept meadow that opened fine
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start

window.addEventListener('resize', resize);
// Turning a phone, iOS fires 'resize' before the page is laid out again, so the canvas still has its
// old size and would be stretched to the new one. Watch the canvas itself for when it really changes.
new ResizeObserver(() => { if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) resize(); }).observe(canvas);
resize();
const seedParam = +params.get('seed');
// The kept meadow if there is one (keeping the meadow, above), else a new one.
function begin(rec) {
  if (!(rec && resumeWorld(rec))) newWorld(seedParam || randomSeed());
  requestAnimationFrame(frame);
}
keptMeadow(seedParam).then(begin);
keepDb().catch(() => { /* not kept, then */ });   // opened now, so keeping at the last moment needn't wait for it
if (canShare) $('[data-act="copy-link"] .l').innerHTML = 'Share<span class="x"> this meadow</span>';
if (!IDEAS_KEY) $('[data-act="ideas"]').remove();

// Sound stays off until you turn it on, and remembers your choice. Browsers only let a page
// make sound after a click or key press, so a remembered "on" waits for the first one.
try { if (localStorage.getItem('aeon-garden-sound') === '1') toggleSound(true); } catch (e) { /* fine */ }

for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (ui.sound) Sound.start(); }, { once: true });

window.garden = { get world() { return world; }, ui, cam,   // handy in the console
  get trees() { return { worker: !!treeWorker, workers: treeWorkers.length, art: treeArt, bytes: treeBytes, asked: treeAsked.size, busy: treeBusy }; } };
})();
