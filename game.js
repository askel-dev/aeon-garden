/* Nobody's Meadow — everything you see and click. The simulation lives in sim.js. */
(() => {
'use strict';
const S = window.Sim;
const Fur = window.Fur;                 // the painted foxes and rabbits, and the drawing helpers every painting here uses
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, blurIn, softIn, furGlow, foxRGB, FOX_WHITE, FOX_SOCK, FOX_POSE, RABBIT_POSE } = Fur;
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const TICKS_PER_SECOND = 30;           // at 1x

// ------------------------------------------------------------------ state

const params = new URLSearchParams(location.search);
const meadowLink = seed => '?seed=' + seed;   // the address of a meadow, and the name it's kept under
let ROOM = params.get('room') || '';          // playing together (net.js): the room in the address
const Net = window.Net || null;               // (net.js)
const pageLink = seed => meadowLink(seed) + (ROOM ? '&room=' + encodeURIComponent(ROOM) + (params.has('local') ? '&local' : '') : '');   // the page's address

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
  speed: 1, sound: false, selectedId: 0, picked: null, hoverId: 0, mark: null,   // mark: where the forager was sent
  gather: null,                             // what the forager is off to pick { kind, it } (gatherFrame)
  queue: [], nextAt: 0,                     // what it picks after that, in turn (queueGather), and not before nextAt (the stoop done)
  fire: null, place: null,                  // seeing to a fire (fireFrame), and picking a spot for one (placeFire)
  trail: [], effects: [], allStory: false, sheetUp: false,
  sky: { mix: {}, tick: 0, bolts: [], boom: -1e9, rainbow: -1e9, bowEnd: -1e9 },
};
const cam = { x: S.W / 2, y: S.H / 2, zoom: 10, goal: null };

// ------------------------------------------------------------------ canvas and camera

const canvas = $('#world');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0, dpr = 1, minZoom = 1, fitZoom = 1;
const FIT = 0.92;                                 // zoomed right out, how much of the window the meadow fills (it fades into mist, mistField)
let sheet = null;                                 // the edges of the meadow the inspector and the bars hide, while it's open (or the chat and the keyboard)
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
  // and as far out as you may zoom: FAR_TILES across, or all of it on a small meadow
  fitZoom = Math.max(Math.min(vw / S.W, vh / S.H) * FIT, vw / FAR_TILES[narrow() ? 1 : 0]);
  cam.zoom = Math.max(cam.zoom, fitZoom);
  clampCam();
  measureSheet();
}

// On a phone the inspector is a sheet over the bottom of the meadow, or on its side a panel down the
// right. The one you follow is kept in the middle of what's still showing, instead of under the panel; and while you type
// to friends, between the chat up top and the keyboard (keyboardUp).
function measureSheet() {
  const ins = $('#inspector').getBoundingClientRect(), chat = $('#chat');
  if (chat.classList.contains('kb')) {
    const v = window.visualViewport, top = $('#hud-right .hud-top').getBoundingClientRect().bottom;
    sheet = { top: Math.max(top, chat.getBoundingClientRect().bottom), bottom: v ? vh - v.offsetTop - v.height : 0, left: 0, right: 0 };
  } else if (!ins.height) sheet = null;
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
// The same in one shared pair, for the loops over every animal, tree and burrow a frame: read it straight away.
const SCR = [0, 0];
const onScreen = (x, y) => { SCR[0] = (x - cam.x) * cam.zoom + vw / 2; SCR[1] = (y - cam.y) * cam.zoom + vh / 2; return SCR; };
const toWorld = (sx, sy) => [(sx - vw / 2) / cam.zoom + cam.x, (sy - vh / 2) / cam.zoom + cam.y];

// The camera stays on the forager, so every zoom is about it, wherever it was asked for.
function zoomAt(sx, sy, z) {
  if (world?.forager) [sx, sy] = toScreen(world.forager.x, world.forager.y);
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
// Close up, they're painted at one size, FUR_MOST screen pixels at most, and stretched a little past it: the forager's
// 57 paintings at the doubling above (256 px on a sharp screen, 1.8 MB each) were more than the whole cache (SPRITE_BYTES),
// so its walk was let go and painted again over and over, and it stuck in a pose.
const FUR_MOST = 320;
const furTop = () => Math.floor(FUR_MOST / dpr);
const poseStep = px => px > furTop() / ZOOM_STRETCH ? furTop()
  : px < FUR_PAINTED / dpr ? 2 ** Math.ceil(Math.log2(px)) : Math.ceil(2 ** (Math.ceil(Math.log2(px) * 4) / 4));
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
  // Centring reads the pixels back: from a canvas on the GPU that waits for it, 5-30 ms a sprite.
  // Painted things ('reeds:0', 'lily:2', 'bubble:5': PAINTERS) are painted in their colours, never read back.
  const colon = emoji.indexOf(':'), art = colon > 0 && PAINTERS[emoji.slice(0, colon)];
  const g = c.getContext('2d', !art && center && { willReadFrequently: true });
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
  }
  s = { canvas: c, size: size / dpr, px, look, used: spriteFrame };
  spriteCache.set(key, s); latestLook.set(look, s);
  asBitmap(c, b => { if (spriteCache.get(key) === s) { s.canvas = b; c.width = 0; } else b.close(); });
  paintedMs += performance.now() - t0;
  return s;
}
// A full cache lets go of the sprites not drawn in the last few frames (other zooms, looks gone
// by), so the ones on screen aren't all painted again at once. The forager's paintings at the size it's drawn stay too
// (keptForager): they're its walk, a frame or two from being drawn, and let go after a zoom they came back one by one
// as it walked, and it stuck in a pose till each had. Only if that isn't enough does it start again from empty.
// Only the set in use is kept: warm, or cold (fur.js FORAGER_COLD), so the cold paintings don't double what's held.
const keptForager = s => s.look.startsWith('forager:') && (s.px === fg.sized || s.px === furPainted(fg.sized))
  && !(fg.cold ? WARM_ONLY : COLD_ONLY)[parseInt(s.look.slice(8)) & 127] && Math.floor(parseInt(s.look.slice(8)) / Fur.FORAGER_SNOW_ARTS) === fg.snowArt;
function dropSprites(need) {
  for (const [key, s] of spriteCache) {
    if (spriteFrame - s.used < 3 || keptForager(s)) continue;
    spriteBytes -= s.canvas.width * s.canvas.height * 4;
    freeImage(s.canvas);
    spriteCache.delete(key);
    if (latestLook.get(s.look) === s) latestLook.delete(s.look);
  }
  if (spriteCache.size <= 2000 && spriteBytes + need <= SPRITE_BYTES) return;
  for (const s of spriteCache.values()) freeImage(s.canvas);
  spriteCache.clear(); latestLook.clear(); spriteBytes = 0;
}

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

// Every rabbit wears the wild coat: agouti, each hair banded, so speckled. fur.js can paint others (RABBIT_KINDS);
// this is the first of them. In winter it pales toward white as far as its moult takes it (sim.js whiteness), in a
// few steps (0 to 4) to keep the sprite cache small.
const COAT = { rgb: S.WILD_COAT, speckle: 0.35, swatch: '#96724f', n: 0 };
const furCoats = () => [{ rgb: COAT.rgb, speckle: COAT.speckle }];   // for fur.js
Fur.setCoats(furCoats(), S.WINTER_COAT);
const whiteStep = c => Math.round(S.whiteness(world, c) * 4);

// "Brown, white for winter · blends in here": how its moult goes, then how well it hides where it sits, as a fox sees it.
function coatLine(c) {
  const white = S.whiteness(world, c), v = c.alive && !c.hidden ? S.visibility(world, c) : 1;
  const winter = c.moult > 0.6 ? 'turns white in winter' : c.moult > 0.4 ? 'pales in winter' : 'stays brown all winter';
  return `🎨 ${white > 0.6 ? 'White for winter' : white > 0.15 ? 'Turning white for winter' : `Wild brown, ${winter}`}` +
    (v < 0.95 ? ' · 🫥 blends in here' : v > 1.2 ? ' · 👁️ stands out here' : '');
}

const furCss = c => c.species === 'rabbit' ? COAT.swatch
  : c.species === 'fox' ? `rgb(${foxRGB(c.fur).join(',')})` : LOOKS[c.species].swatch;

// The animal for the inspector, painted as in the meadow, drawn once per look.
const portraits = new Map();
function portraitHTML(c) {
  const art = c.alive && (c.species === 'fox' ? foxArtOf(c.fur, 'stand') : c.species === 'rabbit' ? rabbitArtOf(COAT, 'sit', whiteStep(c))
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

const PALETTE = [   // [bare ground, lush grass] per season
  [[214, 197, 150], [128, 193, 107]],
  [[226, 206, 142], [113, 175, 87]],
  [[226, 214, 178], [184, 146, 72]],   // amber, so grazed ground shows paler
  [[226, 231, 238], [168, 196, 200]],  // frost-blue
];
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
const NIGHT_RGB = [6, 10, 50];    // the dark, washed over everything
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
// flower's painting (flowerSprite's code + 1; 0: nothing).
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
    const art = plantArt[i];
    if (!art) continue;
    const p = world.plants[i];
    if (!fadeAt(p.x, p.y)) continue;
    const px = key >> 4, w = FLOWER_BOX[0] * px, h = FLOWER_BOX[1] * px;   // its foot a little below its spot, so the clump stands on it
    const x = ox + p.x * z - w / 2, y = oy + p.y * z + px * 0.35 - h * FLOWER_FOOT;
    if (x + w < 0 || y + h < 0 || x > vw || y > vh) continue;
    ctx.drawImage(flowerSprite(art - 1), x, y, w, h);
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
// A burrow's earth fades, the grass takes it back and a dig goes on in steps, each a painting of its own: a step waits
// till its painting is BURROW_MS old (they came a frame or two apart when the meadow could run at 60x).
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

const DARK = 0.88;                        // how much of NIGHT_RGB the night lays over everything (dark, so a fire's the cosy place)
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

const shownDark = darkness;
const shownGold = phase => Math.round(goldenHour(phase) * GOLD_STEPS) / GOLD_STEPS;

// The things a frame draws (a tree or a rock d, a swarm h, a creature c, a visitor v, mushrooms, nettles or a bramble s), each a record of the
// one shape, kept from frame to frame: a few hundred new objects a frame, of five shapes, were felt in every loop over them.
const frameItems = [], itemPool = [];
function itemOf(items, y, sx, sy, f) {
  let it = itemPool[items.length];
  if (!it) itemPool.push(it = { y: -0, sx: -0, sy: -0, f: -0, px: -0, d: null, h: null, c: null, v: null, s: null, p: null, q: null });
  it.y = y; it.sx = sx; it.sy = sy; it.f = f; it.px = 0; it.d = it.h = it.c = it.v = it.s = it.p = it.q = null;
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
  const q = now - ui.sky.boom < 350 ? 3 * (1 - (now - ui.sky.boom) / 350) : 0;
  const shx = q * Math.sin(now / 17), shy = q * Math.cos(now / 23);
  shakeX = shx * dpr; shakeY = shy * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  alphaNow = ALPHA.get.call(ctx);                    // (the canvas may have been made afresh: see fade)
  ctx.imageSmoothingEnabled = true;
  // Sprites are painted near the size they're drawn at, so 'high' looks the same, but Chrome pays
  // for it on every draw, GPU or not: with it, a wood on screen dropped frames.
  ctx.imageSmoothingQuality = 'low';
  spriteFrame++; paintedMs = 0; standIns = true;
  ctx.clearRect(-8, -8, vw + 16, vh + 16);          // past the meadow's edge the page shows through
  const [ox, oy] = toScreen(0, 0);
  const z = cam.zoom, ck = S.clock(world);
  hoverFrame();
  lightsFrame(now);                                  // (the fires' light, for the warm light and the pool cut out of the dark)
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
    const [sx, sy] = onScreen(b.x, b.y);
    if (visible(sx, sy, z * 5) && fadeAt(b.x, b.y)) drawBurrow(b, sx, sy, z, ck.season, residents.get(b) || 0);
  }
  for (const d of world.decor) {                            // and the otters' holts, in the roots of a tree on the bank
    if (!d.holt || !d.door) continue;
    const [sx, sy] = toScreen(d.door.x, d.door.y), px = Math.max(6, (8 + z) * HOLT_SIZE);
    if (visible(sx, sy, px) && fadeAt(d.door.x, d.door.y)) drawEmoji('holt:0', sx, sy, px);
  }
  unfade();
  drawRemains(z);
  drawGarlic(z);
  drawCampRing(z, now);
  if (ui.mark) drawMark(now);

  const sel = world.byId.get(ui.selectedId);
  if (sel) drawSelectionUnder(sel, now);
  if (ui.picked) drawPickedUnder(now);

  // Trees, rocks and animals, back to front.
  const items = frameItems;
  items.length = 0;
  cover.n = 0; cover.built = false;                        // (the crowns drawn: coverAt)
  for (const d of world.decor) {                           // (a hive is in one of the trees)
    if (d.tree && d.size * z < SEEDLING_PX && !d.stump && !d.hedge) continue;   // a seedling too small to see from here (a hedge's whips always show)
    const [sx, sy] = onScreen(d.x, d.y), px = d.tree ? treePx(d) : d.size * z;
    if (visible(sx, sy, px)) { const it = itemOf(items, d.y, sx, sy, 1 - mistAt(d.x, d.y)); it.d = d; it.px = px; }
  }
  for (const h of world.hives) {                           // a swarm hanging in a tree
    if (!h.cluster || h.leaving) continue;
    const [sx, sy] = onScreen(h.x, h.y);
    if (visible(sx, sy, 3 * z)) itemOf(items, h.y, sx, sy, 1 - mistAt(h.x, h.y)).h = h;
  }
  for (const m of world.shrooms) {                         // mushrooms: on a log or a snag, just in front of it
    const sx = (m.x - cam.x) * z + vw / 2, sy = (m.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, m.tree && !S.standing(m.tree) ? Math.max(m.y, m.tree.y + 0.01) : m.y, sx, sy, 1 - mistAt(m.x, m.y)).s = m;
  }
  for (const g of world.greens) {                          // nettles (the garlic lies flat: drawGarlic)
    if (g.kind !== 'nettle' || S.greenStage(world, g) === null) continue;
    const sx = (g.x - cam.x) * z + vw / 2, sy = (g.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, g.y, sx, sy, 1 - mistAt(g.x, g.y)).s = g;
  }
  for (const b of world.brambles) {
    const sx = (b.x - cam.x) * z + vw / 2, sy = (b.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 3 * z + 20)) itemOf(items, b.y, sx, sy, 1 - mistAt(b.x, b.y)).s = b;
  }
  for (const f of world.finds) {                           // the little wild finds
    const sx = (f.x - cam.x) * z + vw / 2, sy = (f.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, f.y, sx, sy, 1 - mistAt(f.x, f.y)).s = f;
  }
  for (const d of world.dropped) {                         // what the forager let fall
    const sx = (d.x - cam.x) * z + vw / 2, sy = (d.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, d.y, sx, sy, 1 - mistAt(d.x, d.y)).s = d;
  }
  for (const F of world.fires) {                           // the campfires, and where one would go (ui.place: drawFire)
    const sx = (F.x - cam.x) * z + vw / 2, sy = (F.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, F.y, sx, sy, 1 - mistAt(F.x, F.y)).s = F;
  }
  if (ui.place) {
    const P = ui.place, sx = (P.x - cam.x) * z + vw / 2, sy = (P.y - cam.y) * z + vh / 2;
    if (visible(sx, sy, 2 * z + 20)) itemOf(items, P.y, sx, sy, 1).s = P;
  }
  const shown = [];
  const far = 60 + OFF_SIZES * (8 + z);                    // (a crow up a tree is drawn out on its seat: always worked out)
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    if (c.species !== 'crow' && !visible((c.x - cam.x) * z + vw / 2, (c.y - cam.y) * z + vh / 2, far)) continue;
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
  {                                                        // the forager
    const F = world.forager, d = drawnAt(F), sx = (d.x - cam.x) * z + vw / 2, sy = (d.y - cam.y) * z + vh / 2;
    foragerFrame(now, d);
    const px = forPx();
    fgBody.on = visible(sx, sy, 2 * px); fgBody.x = sx; fgBody.y = sy - px * 0.3; fgBody.w = px * 0.14; fgBody.h = px * 0.28; fgBody.wy = d.y;
    seeDt = Math.min(100, now - seeLast); seeLast = now;
    if (fgBody.on) itemOf(items, d.y, sx, sy, 1).p = F;
  }
  if (peers.size) peerItems(items, now, z);               // friends playing along (net.js)
  sortByY(items);
  drawPrints();                                            // the forager's footprints, on the ground under all
  // Shadows first, all together, so a tree's shadow never lands on a rabbit behind it.
  const sn = sun(ck);
  for (const it of items) {
    if (it.f < 0.02) continue;                             // lost in the mist
    fadeTo(it.f);
    if (it.d) { drawDecorShadow(it.d, it.sx, it.sy, sn, it.px); if (it.d.tree) treeLeaves(it.d, it.sx, it.sy, it.px, ck, it.f); }
    else if (it.c) {
      drawCreatureShadow(it.c, it.sx, it.sy, now, sn, it.f);
    } else if (it.v) drawVisitorShadow(it.v, it.sx, it.sy, sn);
    else if (it.p) foragerShadow(it.sx, it.sy, sn, fg.wet);
    else if (it.q) foragerShadow(it.sx, it.sy, sn, it.q.wet);
  }
  layShadows();
  drawLeaves(now, true);                                   // the leaves lying round the trees' feet, on the ground under all that stands
  drawNear(now, false);                                    // (under what's in reach: it shows round it)
  drawGlow(now, false);                                    // (under what the mouse is on: it shows round it)
  for (const it of items) {
    if (it.f < 0.02) continue;
    fadeTo(it.f);
    if (it.d) it.d.hive ? drawBeeTree(it.d, it.sx, it.sy, now, ck) : drawDecor(it.d, it.sx, it.sy, now, ck, it.px);
    else if (it.h) drawSwarm(it.h, it.sx, it.sy);
    else if (it.s) it.s.fire ? drawFire(it.s, z, now) : it.s.green ? drawNettles(it.s, z) : it.s.bramble ? drawBramble(it.s, z) : it.s.find ? drawFind(it.s, z) : it.s.dropped ? drawDropped(it.s, z, now) : drawShroom(it.s, z);
    else if (it.v) drawVisitor(it.v, it.sx, it.sy, now, z);
    else if (it.p) drawForager(it.sx, it.sy, now);
    else if (it.q) drawPeer(it.q, it.sx, it.sy, now);
    else drawCreature(it.c, it.sx, it.sy, now);
  }
  unfade();
  drawNear(now, true);
  drawGlow(now, true);
  if (splashes.length) drawSplashes(now);
  drawLeaves(now, false);                                  // the trees' leaves coming down
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
  fireLight(dark);                                         // (and a fire's warm light on what stands about it)
  // The fireflies are drawn over the dark, under the weather: the dark laid first, on its own. But a fire's light is cut
  // out of the dark (laySky), so while one shines the dark goes with the weather's washes, and the fireflies over them.
  const lit = lights.n > 0 && dark > 0.02, glows = !lit && fireflyLight(dark) > 0.02;
  if (dark > 0 && glows) wash(`rgba(${NIGHT_RGB}, ${dark})`);
  if (!lit) drawFireflies(now, dark);
  drawWeather(now, ck, glows ? 0 : dark);                  // (else the dark is laid with the weather's washes, as one)
  if (lit) drawFireflies(now, dark);
  drawFireGlows(now, dark);                                // (the fires' glow, embers and sparks, over the dark)

  // Burrow snores at night.
  if (ck.night && z >= 8) {
    for (const b of world.burrows) {
      if (b.count <= 0) continue;
      const [sx, sy] = toScreen(b.x, b.y);
      if (!visible(sx, sy, 40)) continue;
      const bob = Math.sin(now / 600 + b.id) * 3, hid = coverAt(sx + z * 0.8, sy - z * 1.1, b.y);
      if (hid < 0.98) drawEmoji('💤', sx + z * 0.8, sy - z * 1.1 + bob, Math.max(11, z * 0.8), { alpha: 0.85 * (1 - hid) });
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
  if (peers.size || myChat) drawPeerNames(now);
  drawGlints(now, dark);
  drawHoverLine(now);
  drawFireHint(now);
  drawQueue();
  if (pickFloats.length) drawPickFloats(now);

  drawEffects(now);
  if (sel) drawSelectionOver(sel, now);
  if (ui.picked) drawPickedOver();
  const hov = world.byId.get(ui.hoverId);
  if (hov && hov.alive && !hov.hidden && hov.id !== ui.selectedId) {
    const [sx, sy] = screenOf(hov);
    drawLabel(`${hov.name} · ${S.mood(world, hov).text}`, sx, sy + creaturePx(hov) * 0.55 + 6);
  }
  drawCampMark(now);
  if (peers.size) drawFriendMarks(now);
  drawPickArrow(now);
  standIns = false;                                    // a portrait for the inspector is kept, so it's always painted
}

// Remains lying in the grass (sim.js leaveRemains). A rabbit or a fox lies whole, then opened, picked over and a
// pelt as the meat goes (BODY_STAGES; one a fox caught starts opened), and the pelt fades. A bird's are
// a few feathers, fading as they go. Painted once per look and size.
const BODY_STAGES = [0.7, 0.4, 0.15];     // meat left, of what there was, where each next stage begins
const remainsLooks = new WeakMap();
const remainsPx = z => Math.max(8, (8 + z) * REMAINS_SIZE);
const bodyPx = z => Math.max(8, (8 + z) * BODY_SIZE);
function remainsLook(c) {                 // a rabbit (BODY_COATS) or a fox (FOX_LOOK), or a bird's feathers, an otter's fur (REMAINS_ARTS)
  if (c.species === 'fox') return FOX_LOOK;
  if (c.species !== 'rabbit') return c.species === 'otter' ? 2 : 0;
  return S.whiteness(world, c) > 0.5 ? 1 : 0;
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
const loadOf = c => c.load ? Math.min(1, c.load / S.LOAD) : 0;

// How high off the ground it is drawn: a hop, or a flier's hover. A sipping bee sits on the flower,
// and a laden one flies lower.
function liftOf(c, px, now) {
  if (c.species === 'otter') return 0;                // (it lopes: drawOtter)
  if (!c.sp.flies) return hopOf(c, px, now);
  if (c.species === 'crow') return birdLift(c, crowHeight(c, px), c.sleeping) + crowHop(c, px);
  const bob = ui.speed > 0 ? Math.sin(now / 90 + c.id) * px * 0.08 : 0, fly = px * (0.9 - 0.3 * loadOf(c)), tree = c.target?.tree;
  if (tree && (c.mode === 'sip' || c.mode === 'flower')) {   // blossom in a tree (sim.js addBlossoms): up in its crown, or on a bramble
    const crown = (tree.bramble ? bramblePx(tree, cam.zoom) : treePx(tree) * (tree.kind === 'hawthorn' ? 0.9 : 1.25)) * c.target.up;
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
// and top, and how far it reaches to each side at five heights from the bottom up.
const CROWNS = {
  oak: [0.33, 0.8, 0.4, 0.44, 0.42, 0.33, 0.2], beech: [0.42, 0.88, 0.33, 0.38, 0.37, 0.3, 0.16],
  maple: [0.5, 0.95, 0.26, 0.33, 0.34, 0.3, 0.18], birch: [0.62, 1.28, 0.3, 0.4, 0.42, 0.4, 0.28],
  alder: [0.58, 1.26, 0.3, 0.39, 0.29, 0.21, 0.13],
  apple: [0.22, 0.62, 0.3, 0.36, 0.36, 0.32, 0.2], cherry: [0.22, 0.62, 0.3, 0.36, 0.36, 0.32, 0.2],
  pine: [0.3, 1.05, 0.36, 0.31, 0.25, 0.18, 0.12], hawthorn: [0.2, 0.5, 0.3, 0.33, 0.32, 0.28, 0.18],
  hive: [0.4, 1.48, 0.55, 0.68, 0.7, 0.5, 0.3],    // (the giant: no crow sits in it, sim.js perchable, but it hides what's behind: coverAt)
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
  const k = CROWNS[treeKind(d)] || CROWNS.oak, px = treePx(d), i = t * 4, j = Math.min(3, i | 0);
  seat.tree = d; seat.dx = s * SEAT_OUT * lerp(k[2 + j], k[3 + j], i - j) * px; seat.up = lerp(k[0], k[1], t) * px;
  return seat;
}
// How far across a crow is drawn from where the sim has it: onto its seat, as it comes in to land there.
const seatShift = c => { const st = crowSeat(c); return st ? (st.dx - (st.x - st.tree.x) * cam.zoom) * (1 - near(c, st, 4)) : 0; };
const CROW_AIR = new Set(['flap', 'flock', 'love', 'follow', 'drive']);                               // flying
const CROW_LANDS = new Set(['remains', 'forage', 'fetch', 'cache', 'apple', 'unbury', 'pool', 'gather']); // flying there, and down
const CROW_WEAVES = new Set(['flap', 'flock', 'remains', 'forage', 'fetch', 'cache', 'apple', 'pool', 'gather', 'roost']);   // on the wing, going somewhere
const CROW_PECKS = new Set(['peck', 'carrion', 'munch', 'bury', 'unbury', 'tadpole', 'berries']);       // heads down
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

// Where a creature is drawn in the meadow: between where it was a tick ago (keepLast) and where it is, as far along as
// the clock is to the next tick, so it glides rather than stepping 30 times a second. Held, or just put somewhere,
// where it is. (One shared answer: read it straight away.)
const lastTick = new WeakMap(), drawnPos = { x: 0, y: 0 };
function keepLast() {
  for (const c of world.creatures) keepAt(c);
  keepAt(world.forager);
  if (world.visitors) for (const v of world.visitors) keepAt(v);   // (and a visitor, sim.js w.visitors)
}
function keepAt(c) {
  let p = lastTick.get(c);
  if (!p) lastTick.set(c, p = { x: 0, y: 0, tick: 0 });
  p.x = c.x; p.y = c.y; p.tick = world.tick + 1;
}
function drawnAt(c) {
  const p = lastTick.get(c);
  if (!p || p.tick !== world.tick || Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) { drawnPos.x = c.x; drawnPos.y = c.y; return drawnPos; }
  const t = Math.min(acc, 1);
  drawnPos.x = p.x + (c.x - p.x) * t; drawnPos.y = p.y + (c.y - p.y) * t;
  return drawnPos;
}

// Where a creature is drawn on screen: where it is (drawnAt), plus a flier's weave. A dancer is drawn a
// little in front of her hive, where the tree doesn't hide her, and her eight a size bigger.
const DANCE_FRONT = 0.45, DANCE_SIZE = 1.8;
const OFF_SIZES = 3;                       // screenOf never draws one further than this many of its sizes from where it is (a hop's surge, a weave, a dance)
function screenOf(c) {                    // (onScreen's shared pair: read it straight away)
  const d = drawnAt(c), p = onScreen(d.x, d.y), z = cam.zoom;
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
  return 'hog:' + s;
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
    return ui.speed > 0 ? 'heron:' + (7 + ((now / HERON_BEAT + v.id) & 1)) : 'heron:7';
  }
  if (v.mode === 'stab') return 'heron:4';
  if (v.mode === 'gulp') return v.caught === 'fish' ? 'heron:6' : 'heron:5';
  if (v.mode === 'stalk') { const s = stepOf(v, HERON_STEP); return 'heron:' + (2 + s); }
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
  const t = world.tick + acc, still = ui.speed === 0, ground = sy + visitorFeet(), sat = v.mode === 'perch' || v.mode === 'roost';
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
    case 'in': case 'out': case 'back': return ui.speed > 0 ? 'kfisher:' + (3 + ((now / KF_WHIRR + v.id) & 1)) : 'kfisher:3';
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
  if (up > px * 0.15 || v.mode === 'rise') return ui.speed > 0 ? 'lark:' + (4 + ((now / LARK_FLUTTER + v.id) & 1)) : 'lark:4';
  if (v.mode === 'peck') return v.timer % 40 < 22 ? 'lark:2' : 'lark:3';
  if (v.mode === 'walk') return 'lark:' + stepOf(v, LARK_STEP);
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
  const hop = liftOf(c, px, now), small = zoomedOut();
  // Standing still, everyone breathes: slow and deep asleep, quick and shallow awake. (Zoomed far out, too little to see.)
  const breathe = !small && !hop && ui.speed > 0
    ? Math.sin(now / (c.sleeping ? 650 : 330) + c.id) * (c.sleeping ? 0.035 : 0.02) : 0;
  const squash = 1 + breathe;
  const y = sy - hop + px * 0.4 * (1 - squash);
  if (c.species === 'crow' && c.sleeping && crowSeat(c)) sx += treeSway(seat.tree, now) * hop;   // up a tree, it sways with it
  if (c.mode === 'dance') drawDance(c, sx, y, px);
  const art = c.species === 'crow' ? crowArt(c, hop, px, now) : walkerArt(c, px, now);
  if (small) drawSmall(art, sx, y, px, flipOf(c));
  else drawEmoji(art, sx, y, px, { flip: flipOf(c), squash });   // feet stay on the ground
  if (c.load && c.species === 'bee') drawBaskets(c, sx, y, px);
  if (c.mode === 'sip') drawSipping(c, sx, sy, px, now);
  if (px > 18 && ui.speed > 0 && atHole(c)) drawDigging(c, sx, y, px, now);
}

// ------------------------------------------------------------------ the forager
//
// The player (sim.js w.forager), painted in fur.js (paintForager) in three views and a stride of eight paintings, by the
// worker as a fox is, and a stride of eight more jogging for the sprint. Its feet are where it is (a fox's middle is). Its
// legs go round with the ground it covers, a stride for every 2 * FORAGER_REACH * 2 of its half-size it moves (jogging,
// FORAGER_JOG_STRIDE times that), so the foot on the ground stays put; the view comes
// from its heading, held a little either side of a change so it doesn't flicker (side on, three-quarters from the front
// or the back, mirrored going right). Standing it breathes, blinks now and then, after a moment turns to face you, and
// now and then does something (IDLES). In the shallows it's cut off at the water line with a ring round its legs, and
// each step sends out a ring (fg.rings). Its outfit (Fur.FORAGER_OUTFITS) is the player's, picked as the first meadow opens
// (pickOutfit; later from •••) and kept in localStorage for every meadow after.
const FORAGER_SIZE = 2.5;                  // its painting's box, next to a rabbit's
const FORAGER_ARTS = Array.from({ length: Fur.FORAGER_SNOWS * Fur.FORAGER_SNOW_ARTS }, (_, n) => 'forager:' + n);   // (made once: a frame builds no names)
const OUTFIT = 'aeon-garden-outfit';       // in localStorage
const FORAGER_POSES = [0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const FORAGER_CHILLY = [...FORAGER_POSES, ...Fur.FORAGER_COLD];   // (chilly, the cold ones are asked for ahead too)
const WARM_ONLY = new Uint8Array(128), COLD_ONLY = new Uint8Array(128);   // paintings the other set never uses (keptForager), by (view << 5) + pose
for (let v = 0; v < 3; v++) {
  for (const p of [0, 1, 2, 8, 9, 10, 11, 12, 13, 14, 15]) WARM_ONLY[(v << 5) + p] = 1;
  for (const p of Fur.FORAGER_COLD) COLD_ONLY[(v << 5) + p] = 1;
}
for (const p of Fur.FORAGER_IDLES) WARM_ONLY[96 + p] = 1;
const FORAGER_SAD = 2;                     // from this stage (sim.js warmthStage: cold) it hugs itself, sad (fur.js FORAGER_COLD)
const FORAGER_TURN_MS = 1100;              // standing this long, it turns to face you
const FORAGER_JOG = [0.1, 0.11];           // sent running, it jogs once up past this pace (tiles a tick) and walks again under
const FORAGER_STILL_MS = 70;               // no nearer than this to the last move, it's standing (it's drawn between ticks)
const forPx = () => (8 + cam.zoom) * FORAGER_SIZE;
const fg = { at: -1, x: 0, y: 0, step: 0, stillMs: 1e4, view: 1, flip: false, art: FORAGER_ARTS[32], blinkAt: -1e9, blinkIn: 3000,
  idle: -1, idleLast: -1, idleAt: -0, idleIn: 1e4 + 5000, hum: -0, lastHalf: 0, jog: false, rings: [], wet: false, lx: -0, ly: -0, sized: 0, outfit: 0, picked: false, pick: -1e9, pickK: 1, printMs: -0,
  puffs: [], puffAt: 0, drips: [], dripAt: 0, shiverAt: -1e9, shiverNext: 0, heartAt: 0, pantAt: 0, panting: false, downAt: 0, dark: false, cold: false, sizedSet: 0,   // (the body: drawBody, bodyFrame)
  snow: -1, snowTick: -0, snowArt: 0, sizedSnow: 0,   // (the snow on it: snowOnForager)
  kneel: -1, knelt: -1e9, sizedKneel: false };          // (at a fire: its kneeling pose, fur.js FORAGER_KNEEL, or -1; when it last knelt)
try {
  const o = localStorage.getItem(OUTFIT);
  fg.picked = o !== null;
  fg.outfit = Math.min(Fur.FORAGER_OUTFITS.length - 1, Math.max(0, +o | 0));
} catch (e) { /* fine */ }
// What's under the forager's feet, for its footsteps (sound.js step): the shallows, ice, snow, the wood's floor, the damp
// sand along the water, earth bitten bare, or grass.
const STEP_SNOW = 0.35, STEP_WOODS = 0.45, STEP_SHORE = 1.5, STEP_BARE = 0.12;
function groundUnder(x, y) {
  const w = world, i = (y | 0) * S.W + (x | 0);
  if (w.water[i]) return w.frozen ? 'ice' : 'water';
  if (w.snow > STEP_SNOW) return 'snow';
  if (w.wood[i] > STEP_WOODS) return 'woods';
  if (w.damp[i] <= STEP_SHORE) return 'shore';
  return w.grass[i] < STEP_BARE ? 'earth' : 'grass';
}

// Standing a while, now and then it does something: looks up with a hand on its strap, glances to either side, peeks in
// its satchel, taps a foot, hums swaying with its eyes shut happy; once it has stood a good while (IDLE_LONG) it may also
// stretch with a yawn or wave at you. Each is a few paintings in a row (pose, ms, pose, ms...), an idle pose 32 + fur.js
// FORAGER_IDLE, painted from the front ('view' 3 of the key: poseKey). Never the same twice running, none in the cold
// (it hugs itself). The player's and each friend's, each its own (b: fg or one of peers; idle, idleAt, idleIn, hum).
const IDLE = Fur.FORAGER_IDLE, ID = i => 32 + i;
const IDLES = [
  { seq: [1, 1500] },
  { seq: [ID(IDLE.lookL), 900, 2, 120, ID(IDLE.lookR), 900] },
  { seq: [ID(IDLE.peek), 1500] },
  { seq: [ID(IDLE.tap), 170, 0, 170, ID(IDLE.tap), 170, 0, 170, ID(IDLE.tap), 170] },
  { seq: [ID(IDLE.hum), 2800], hum: true },
  { seq: [ID(IDLE.reach), 280, ID(IDLE.stretch), 1500, ID(IDLE.reach), 280], long: true },
  { seq: [ID(IDLE.waveA), 220, ID(IDLE.waveB), 220, ID(IDLE.waveA), 220, ID(IDLE.waveB), 220, ID(IDLE.waveA), 220], long: true },
];
const IDLE_FIRST = [4000, 7000], IDLE_EVERY = [6000, 12000];   // ms standing till the first, then between them, about
const IDLE_LONG = 20000;                   // ms standing before it stretches or waves
const HUM_SWAY = 0.05, HUM_MS = 1400;      // humming, it sways about its feet (drawFigure): how far, and a sway's ms
const poseKey = (view, pose) => pose < 32 ? (view << 5) + pose : 64 + pose;
function idleStop(b, every) {
  b.idle = -1; b.hum = 0;
  const [a, z] = every ? IDLE_EVERY : IDLE_FIRST;
  b.idleIn = b.stillMs + a + Math.random() * (z - a);
}
// What one standing still shows: one of IDLES once it's due, else the pose it would.
function idleOf(b, now, pose) {
  if (b.idle < 0) {
    if (b.view !== 1 || b.stillMs < b.idleIn) return pose;
    let k;
    do k = Math.random() * IDLES.length | 0; while (k === b.idleLast || IDLES[k].long && b.stillMs < IDLE_LONG);
    b.idle = b.idleLast = k; b.idleAt = now;
  }
  const it = IDLES[b.idle], seq = it.seq, t0 = now - b.idleAt;
  for (let i = 0, t = t0; i < seq.length; i += 2, t -= seq[i - 1]) {
    if (t >= seq[i + 1]) continue;
    if (it.hum) b.hum = HUM_SWAY * Math.sin(Math.PI * t0 / seq[1]) * Math.sin(TAU * t0 / HUM_MS);
    return seq[i];
  }
  idleStop(b, true);
  return pose;
}
function foragerFrame(now, d) {
  const f = world.forager, px = forPx();
  if (fg.at < 0) { fg.x = d.x; fg.y = d.y; fg.at = now; }
  const dx = d.x - fg.x, dy = d.y - fg.y, moved = Math.hypot(dx, dy), ms = now - fg.at;
  fg.x = d.x; fg.y = d.y; fg.at = now;
  fg.jog = f.running && f.speed > FORAGER_JOG[fg.jog ? 0 : 1];   // (its legs don't spin: the jog's stride is longer)
  if (moved > 1e-5 && moved < 2) {
    fg.step += moved / (2 * Fur.FORAGER_REACH * px / cam.zoom * (fg.jog ? Fur.FORAGER_JOG_STRIDE : 1));
    fg.stillMs = 0;
  } else if (ui.speed > 0) fg.stillMs += ms;            // (paused mid-stride, it holds the stride)
  fg.wet = !world.frozen && world.water[(d.y | 0) * S.W + (d.x | 0)] > 0;
  const walking = fg.stillMs < FORAGER_STILL_MS, stage = S.warmthStage(f), cold = fg.cold = stage >= FORAGER_SAD;
  const kneel = fg.kneel = stage < 4 ? kneelNow(now) : -1;   // (at a fire: kneeling, side on to it)
  if (kneel >= 0) { fg.view = 0; fg.knelt = now; }
  let pose = 0;
  if (walking) {
    const sy = Math.sin(f.heading), sx = Math.cos(f.heading), v = fg.view;
    fg.view = sy > (v === 1 ? 0.45 : 0.62) ? 1 : sy < (v === 2 ? -0.45 : -0.62) ? 2 : 0;
    if (sx > 0.18) fg.flip = true; else if (sx < -0.18) fg.flip = false;
    pose = (fg.jog ? 16 : cold ? 24 : 8) + Math.floor(fg.step % 1 * 8);   // (cold, it walks hugging itself)
    const half = Math.floor(fg.step * 2);                 // a foot comes down: in the shallows, a ring
    if (half !== fg.lastHalf && fg.wet && ui.speed > 0) fg.rings.push({ x: d.x, y: d.y, t: now });
    if (half !== fg.lastHalf && ui.speed > 0 && !fg.wet) footprint(d.x, d.y, f.heading, half & 1);
    if (half !== fg.lastHalf && ui.speed > 0) hear('step', d.x, d.y, { pace: f.speed / S.FORAGER_WALK, foot: half & 1, ground: groundUnder(d.x, d.y) }, true);   // (each foot down; the quicker it goes, the quicker and crisper they come)
    fg.lastHalf = half;
    idleStop(fg);
  } else {
    fg.step = Math.round(fg.step * 2) / 2;                // (it sets off again on the next foot)
    if (kneel >= 0) idleStop(fg);                       // (kneeling it neither does things nor turns, and up again it turns a moment after)
    else if (fg.stillMs > FORAGER_TURN_MS && now - fg.knelt > FORAGER_TURN_MS && fg.view !== 1) { fg.view = 1; fg.blinkAt = now; }   // turned to you, with a blink
    if (now - fg.blinkAt > fg.blinkIn) { fg.blinkAt = now; fg.blinkIn = 2200 + Math.random() * 3500; }
    pose = cold ? (now - fg.blinkAt < 150 ? 6 : 5) : idleOf(fg, now, now - fg.blinkAt < 150 ? 2 : 0);
    const p = (now - fg.pick) / fg.pickK;                 // picking (gatherFrame): stooped, reaching down, back up
    if (p < PICK_MS[2]) { pose = p < PICK_MS[0] || p > PICK_MS[1] ? 3 : 4; fg.stillMs = FORAGER_STILL_MS + 1; idleStop(fg); }
    else if (cold) idleStop(fg);
  }
  if (stage === 4) { pose = 7; idleStop(fg); }          // (down: eyes shut, no blinking)
  if (ui.speed > 0) fg.printMs += ms;                   // (prints fade only while the meadow goes on)
  if (fg.rings.length && now - fg.rings[0].t > 900) fg.rings.shift();
  snowOnForager();
  const at = fg.snowArt * Fur.FORAGER_SNOW_ARTS + (fg.outfit << 7);
  fg.art = shownPose(f, FORAGER_ARTS[at + (kneel >= 0 ? KNEEL_AT + kneel : poseKey(fg.view, pose))], px);
}
// Its footprints: one at each foot down, a little to that foot's side, fading as the ground takes them back: soon in
// grass, slower in earth and the damp sand, slowest in snow. A ring of PRINTS kept in typed arrays (nothing made a step),
// each drawn as one small painting (PRINT_ART), turned along the way it went and laid flat on the ground.
const PRINTS = 160, PRINT_FADE = 0.5;      // (the last half of its life it fades)
const PRINT_GROUND = { grass: [12000, 0.26, 0], woods: [16000, 0.3, 0], earth: [22000, 0.36, 0], shore: [28000, 0.4, 0], snow: [45000, 0.55, 1] };
const pr = { x: new Float32Array(PRINTS), y: new Float32Array(PRINTS), h: new Float32Array(PRINTS), t: new Float64Array(PRINTS),
  life: new Float32Array(PRINTS), a: new Float32Array(PRINTS), art: new Uint8Array(PRINTS), next: 0, n: 0 };
let PRINT_ART = null;
function printArt() {                      // a sole, toe up: soft, earth-brown and snow-blue
  const W = 24, H = 48;
  PRINT_ART = ['rgb(62, 44, 28)', 'rgb(96, 116, 150)'].map(col => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.filter = 'blur(1.5px)'; g.fillStyle = col;
    g.beginPath(); g.ellipse(W / 2, H * 0.34, W * 0.3, H * 0.22, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(W / 2, H * 0.74, W * 0.24, H * 0.14, 0, 0, TAU); g.fill();
    const art = { img: c };
    asBitmap(c, b => { art.img = b; });
    return art;
  });
  return PRINT_ART;
}
function footprint(x, y, heading, foot) {
  const kind = groundUnder(x, y), g = PRINT_GROUND[kind];
  if (!g) return;                          // (none on ice or in the water)
  const side = (foot ? 1 : -1) * 0.055 * forPx() / cam.zoom, i = pr.next;
  pr.x[i] = x - Math.sin(heading) * side; pr.y[i] = y + Math.cos(heading) * side; pr.h[i] = heading;
  pr.t[i] = fg.printMs; pr.life[i] = g[0]; pr.a[i] = g[1]; pr.art[i] = g[2];
  pr.next = (i + 1) % PRINTS; if (pr.n < PRINTS) pr.n++;
}
function drawPrints() {
  if (!pr.n || zoomedOut()) return;
  const arts = PRINT_ART || printArt(), z = cam.zoom, len = forPx() * 0.15, k = len / 48 * dpr, flat = 0.6;
  let drawn = false;
  for (let j = 0; j < pr.n; j++) {
    const age = fg.printMs - pr.t[j], life = pr.life[j];
    if (age >= life) continue;
    const sx = (pr.x[j] - cam.x) * z + vw / 2, sy = (pr.y[j] - cam.y) * z + vh / 2;
    if (!visible(sx, sy, len)) continue;
    const cs = Math.cos(pr.h[j]) * k, sn = Math.sin(pr.h[j]) * k;
    ctx.globalAlpha = pr.a[j] * Math.min(1, (life - age) / (life * PRINT_FADE)) * Math.min(1, age / 150);
    ctx.setTransform(-sn, cs * flat, -cs, -sn * flat, sx * dpr + shakeX, sy * dpr + shakeY);
    ctx.drawImage(arts[pr.art[j]].img, -12, -24);
    drawn = true;
  }
  if (drawn) { ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY); ctx.globalAlpha = 1; }
}
function drawForager(sx, sy, now) {
  const px = forPx(), art = fg.art, f = world.forager, stage = S.warmthStage(f);
  drawRings(fg.rings, now, px);
  if (zoomedOut()) { drawSmall(art, sx, sy - px * 0.36, px, fg.flip); return; }
  if (stage === 4) { drawFallen(art, sx, sy, px, fg.flip, clamp((now - fg.downAt) / FALL_MS, 0, 1)); return; }
  const trip = f.stumble > 0 ? Math.sin(Math.PI * (1 - f.stumble / S.STUMBLE_TICKS)) : 0;   // (a stumble: it pitches forward and catches itself)
  drawFigure(fg, art, sx, sy, px, now, stage, trip, fg.stillMs > FORAGER_STILL_MS, true);
  const d = drawnAt(f);
  drawBody(fg, d.x, d.y, f.wet, fg.stillMs < FORAGER_STILL_MS, f.running, stage, px, now, true);
}
// A forager on its feet, this one or a friend's (b: fg, or one of peers): in the shallows cut off at the water line with a
// ring round its legs; else breathing while it stands, hunched with the cold (HUNCH), shivering (shiverOf), stumbling.
function drawFigure(b, art, sx, sy, px, now, stage, trip, still, me) {
  const flip = b.flip, top = sy - px * 0.36;            // (its painting's middle: the feet are at 0.72 of its half-size)
  if (b.wet) {
    const line = sy - px * 0.02, rip = 1 + 0.08 * Math.sin(now / 280);   // (in to its shins)
    ctx.save();
    ctx.beginPath(); ctx.rect(sx - px, line - px * 2, px * 2, px * 2); ctx.clip();
    drawEmoji(art, sx, top + px * 0.1, px, { flip });
    ctx.restore();
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.7)';
    ctx.lineWidth = Math.max(1, px * 0.025);
    ctx.beginPath(); ctx.ellipse(sx, line, px * 0.17 * rip, px * 0.045 * rip, 0, 0, TAU); ctx.stroke();
    return;
  }
  const breathe = still && ui.speed > 0 ? Math.sin(now / 620) * 0.012 : 0;
  const squash = (1 + breathe) * HUNCH[stage] * (b.view === 1 ? 1 - 0.1 * trip : 1), shake = shiverOf(b, stage, now, me) + b.hum;   // (humming, a sway)
  if (trip && b.view !== 1 || shake) {                  // (a shiver sways it about its feet: the head most, the feet not at all)
    ctx.save(); ctx.translate(sx, sy);
    if (shake) ctx.transform(1, 0, -shake / 0.6, 1, 0, 0);
    if (trip && b.view !== 1) ctx.rotate((flip ? 1 : -1) * 0.24 * trip);
    drawEmoji(art, 0, -px * 0.36 * squash, px, { flip, squash });
    ctx.restore();
  } else drawEmoji(art, sx, top + px * 0.36 * (1 - squash), px, { flip, squash });   // (feet stay on the ground)
}
// The rings its steps send out in the shallows.
function drawRings(rings, now, px) {
  for (const r of rings) {
    const [rx, ry] = onScreen(r.x, r.y), u = (now - r.t) / 900;
    ctx.strokeStyle = `rgba(240, 250, 255, ${0.6 * (1 - u)})`;
    ctx.lineWidth = Math.max(1, px * 0.025);
    ctx.beginPath(); ctx.ellipse(rx, ry, px * (0.12 + 0.3 * u), px * (0.04 + 0.1 * u), 0, 0, TAU); ctx.stroke();
  }
}
function foragerShadow(sx, sy, sn, wet) {
  if (zoomedOut() || wet) return;
  const px = forPx(), n = shadeStep(), a = (0.16 + 0.18 * Math.max(0, sn.a)) * lerp(1, SNOW_SHADE_A, n / SHADE_STEPS), off = Math.max(0, sn.a) * sn.lean * px * 0.12;
  const k = Math.round(clamp(a / SHADOW_MOST, 0, 1) * SHADOW_STEPS), at = shadowAt[k], i = shadowN[k]++ * 4;
  at[i] = sx + off; at[i + 1] = sy - px * 0.01; at[i + 2] = px * 0.13 + Math.abs(off) * 0.5; at[i + 3] = px * 0.042;
}
// Each of its paintings at the size it's drawn, asked of the worker ahead, so the walk never waits for one. Its kneeling
// ones too once there's a fire about, or what one takes is in the satchel.
function foragerAhead() {
  const P = poseStep(Math.max(4, forPx())), set = S.warmthStage(world.forager) >= 1 ? 2 : 1;   // (chilly: the cold ones too)
  const kneel = world.fires.length > 0 || !!ui.fire || !!ui.place || buildUi.ready;
  if (!furWorker || P === fg.sized && set === fg.sizedSet && fg.snowArt === fg.sizedSnow && kneel === fg.sizedKneel) return;
  fg.sized = P; fg.sizedSet = set; fg.sizedSnow = fg.snowArt; fg.sizedKneel = kneel;
  const at = fg.snowArt * Fur.FORAGER_SNOW_ARTS + (fg.outfit << 7);
  for (let v = 0; v < 3; v++) for (const p of set === 2 ? FORAGER_CHILLY : FORAGER_POSES) furReady(FORAGER_ARTS[at + (v << 5) + p], P);
  for (const p of Fur.FORAGER_IDLES) furReady(FORAGER_ARTS[at + 96 + p], P);
  if (kneel) for (const p of KNEEL_POSES) furReady(FORAGER_ARTS[at + KNEEL_AT + p], P);
}
// Out while it snows, snow gathers on it (on the hood, the shoulders: fur.js FORAGER_SNOWS), less under the trees; once
// it stops it melts off, soon above freezing, slowly under, quicker on the move. Kept by sim time, so it goes with the
// meadow's speed; only how it looks, so it isn't kept between visits (a meadow opened in the snow starts it snowy).
const SNOW_GATHER = 6;                     // a day: covered in a sixth of a day in the open (two minutes at 1x)
const SNOW_MELT = [0.8, 5];                // a day: how fast it goes under freezing, and at 5 degrees (faster warmer)
const SNOW_STEPS = [0.22, 0.6];            // a dusting from here, covered from here (a little less on the way down)
function snowOnForager() {
  const w = world, f = w.forager, snowing = w.weather.kind === 'snow';
  if (fg.snow < 0) { fg.snow = snowing ? Math.min(1, w.snow * 1.5) : 0; fg.snowTick = w.tick; }
  const days = clamp((w.tick - fg.snowTick) / S.TPD, 0, 1);
  fg.snowTick = w.tick;
  if (days > 0 && (snowing || fg.snow > 0)) {
    if (snowing) {
      const shelter = clamp(w.wood[(f.y | 0) * S.W + (f.x | 0)] / 0.5, 0, 1);
      fg.snow = Math.min(1, fg.snow + SNOW_GATHER * (1 - 0.8 * shelter) * days);
    } else {
      const air = S.airTemp(w), melt = air < 0 ? SNOW_MELT[0] : SNOW_MELT[0] + (SNOW_MELT[1] - SNOW_MELT[0]) * air / 5;
      fg.snow = Math.max(0, fg.snow - melt * (f.walking ? f.running ? 2 : 1.3 : 1) * days);
    }
  }
  const a = fg.snowArt, up = fg.snow > SNOW_STEPS[1] ? 2 : fg.snow > SNOW_STEPS[0] ? 1 : 0;
  const down = fg.snow > SNOW_STEPS[1] - 0.08 ? 2 : fg.snow > SNOW_STEPS[0] - 0.08 ? 1 : 0;
  fg.snowArt = up > a ? up : down < a ? down : a;
}

// ------------------------------------------------------------------ warmth, wet and stamina
//
// What the forager's body is up to (sim.js bodyTick) shows on it first. Chilly it shivers now and then, cold all the time
// and hunched (HUNCH), freezing harder, stumbling (sim.js f.stumble), with frost creeping in at the screen's edges (#frost)
// and a slow soft heartbeat (sound.js heart). At nothing it collapses: it tips over (drawFallen), the screen goes dark
// (#veil), the night runs by behind it (bodyFrame: the sim run quickly, SKIP_MS a frame) and it wakes at home in the
// morning, the satchel empty (sim.js wakeForager). In cold air its breath shows (BREATH_AIR, a puff painted once,
// PUFF_ART), and soaked it drips. Two slim bars above the satchel (#vitals: warmth, stamina) show only when not full,
// a drop by the warmth while it's wet (renderVitals, with the frost, a few times a second).
const BREATH_AIR = 8;                      // degrees: air colder than this shows its breath
const BREATH_MS = [2700, 1500];            // ms between puffs, standing and walking (sprinting, half that)
const PUFF_MS = 1500;                      // a puff's life
const BREATH_AT = [[0.14, -0.4, 0.2], [0.05, -0.38, 0.1], [0.12, -0.47, 0.12]];   // by view: from its mouth (x ahead, y), drifting ahead
const BREATH_KNEEL = [0.2, -0.27, 0.15];   // and kneeling at a fire (fur.js FORAGER_KNEEL), side on
const SHIVER = [0.01, 0.012, 0.012];       // how far its head sways in a shiver (of its size): chilly, cold, freezing
const SHIVER_EVERY = [7500, 4000, 3000];   // a shiver about this often (ms), by stage
const SHIVER_MS = 600;                     // a shiver's length, eased in and out
const SHIVER_STEADY = 0.3;                 // freezing, a faint tremble between them (of a shiver)
const HUNCH = [1, 1, 0.965, 0.94, 1];      // its height by stage (sim.js warmthStage)
const DRIP_MS = 260;                       // soaked through, a drip this often (less wet, less often)
const HEART_MS = 1250;                     // freezing: a heartbeat this often
const FALL_MS = 650;                       // collapsing: how long it takes to go over
const DARK_AFTER = 2200, DARK_MS = 1300;   // down this long, the screen goes dark over this long; then the night runs by
const SKIP_MS = 30;                        // ms of sim a frame while it does
let PUFF_ART = null;
function puffArt() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(250, 252, 255, 0.9)'); gr.addColorStop(0.5, 'rgba(240, 246, 252, 0.45)'); gr.addColorStop(1, 'rgba(240, 246, 252, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  PUFF_ART = { img: c };
  asBitmap(c, b => { PUFF_ART.img = b; });
  return PUFF_ART;
}
// How far its head sways this frame (of its size): a short shiver now and then ("brr", sound.js shiver), more often the
// colder, eased in and out; freezing, a faint tremble between.
function shiverOf(b, stage, now, me) {
  if (!stage || stage > 3 || ui.speed === 0) return 0;
  if (now > b.shiverNext) {
    if (b.shiverNext) { b.shiverAt = now; if (me) chime('shiver', { v: stage / 3 }); }
    b.shiverNext = now + SHIVER_EVERY[stage - 1] * (0.6 + 0.8 * Math.random());
  }
  const u = (now - b.shiverAt) / SHIVER_MS, a = Math.max(u < 1 ? Math.sin(Math.PI * u) : 0, stage === 3 ? SHIVER_STEADY : 0);
  return a ? a * SHIVER[stage - 1] * Math.sin(now / 21) : 0;
}
// Its breath and its drips (this forager's or a friend's, b, at x, y; soak: how wet it is, sim.js f.wet): each where it was
// when it came, the breath rising and spreading from its face, a drip falling from its hem to its feet.
function drawBody(b, x, y, soak, going, running, stage, px, now, me) {
  if (ui.speed > 0 && now > b.puffAt) {
    b.puffAt = now + BREATH_MS[going ? 1 : 0] * (running ? 0.5 : 1) * (0.85 + 0.3 * Math.random());
    if (S.airTemp(world) < BREATH_AIR && b.puffs.length < 6) {
      const ahead = b.flip ? 1 : -1, v = b.view, m = b.kneel >= 0 ? BREATH_KNEEL : BREATH_AT[v];   // (its mouth, of its size from its feet: side on, three-quarters, from the back)
      b.puffs.push({ x, y, ox: ahead * m[0], oy: m[1], dx: ahead * m[2], back: v === 2 && b.kneel < 0, t: now });
      if (me && stage >= FORAGER_SAD && !going && Math.random() < 0.3) chime('breath');   // now and then a shaky cold sigh
    }
  }
  if (ui.speed > 0 && now > b.dripAt) {
    b.dripAt = now + DRIP_MS / Math.max(0.05, soak) * (0.6 + 0.8 * Math.random());
    if (soak > 0.25 && !b.wet && b.drips.length < 8) {
      b.drips.push({ x, y, ox: (Math.random() - 0.5) * 0.42, oy: -0.3 - Math.random() * 0.12, t: now });   // (off its hem)
      if (me && Math.random() < 0.25) chime('hemdrip', { v: soak });   // (now and then one you hear)
    }
  }
  while (b.puffs.length && now - b.puffs[0].t > PUFF_MS) b.puffs.shift();
  while (b.drips.length && now - b.drips[0].t > 320) b.drips.shift();
  if (b.puffs.length) {
    const art = PUFF_ART || puffArt();
    for (const p of b.puffs) {
      const u = (now - p.t) / PUFF_MS, [x, y] = onScreen(p.x, p.y), r = px * (0.07 + 0.2 * Math.sqrt(u));
      ctx.globalAlpha = (p.back ? 0.35 : 0.65) * Math.min(1, u * 8) * (1 - u) * (1 - u);
      ctx.drawImage(art.img, x + (p.ox + p.dx * u) * px - r, y + (p.oy - 0.1 * u) * px - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  if (b.drips.length) {
    ctx.fillStyle = 'rgba(214, 232, 248, 0.85)';
    for (const p of b.drips) {
      const u = (now - p.t) / 320, [x, y] = onScreen(p.x, p.y), r = Math.max(1, px * 0.012);
      ctx.beginPath(); ctx.ellipse(x + p.ox * px, y + p.oy * px * (1 - u * u), r, r * 1.5, 0, 0, TAU); ctx.fill();
    }
  }
}
// Collapsed: it tips over sideways (toward where it was facing) and lies there.
function drawFallen(art, sx, sy, px, flip, u) {
  const e = u * u * (3 - 2 * u), side = flip ? 1 : -1;
  ctx.save();
  ctx.translate(sx + side * px * 0.05 * e, sy - px * 0.04 * e); ctx.rotate(side * 1.42 * e);
  drawEmoji(art, 0, -px * 0.36, px, { flip });
  ctx.restore();
}
// Once a frame: the heartbeat, the dark and the night running by. Whether the sim should run the night by now.
function bodyFrame(now) {
  const f = world.forager, stage = S.warmthStage(f);
  if (stage === 3 && ui.speed > 0 && now - fg.heartAt > HEART_MS * (0.85 + 0.6 * f.warmth / S.WARMTH_STAGES[2])) {
    fg.heartAt = now;
    chime('heart', { v: 1 - 0.5 * f.warmth / S.WARMTH_STAGES[2] });
  }
  if (f.down < 0) { if (ui.speed > 0) pantFrame(f, now); return false; }
  if (!fg.downAt) fg.downAt = now - DARK_AFTER;          // (a meadow kept while it was down: dark at once)
  if (!fg.dark && now - fg.downAt > DARK_AFTER) { fg.dark = true; $('#veil').classList.add('dark'); }
  return now - fg.downAt > DARK_AFTER + DARK_MS;
}
// Out of breath it pants (sound.js pant), a breath every PANT_MS: spent, quick and hard; as its breath comes back, slower
// and softer, till it has PANT_DONE of it and lets out a phew. Sprinting low on breath, it starts panting softly before it's spent.
const PANT_MS = [420, 1100];               // a breath this often, spent and nearly got back
const PANT_LOW = 0.3;                      // sprinting with less stamina than this, it's breathing hard
const PANT_DONE = 0.5;                     // got this much back after it was spent, the panting stops
function pantFrame(f, now) {
  if (f.winded) fg.panting = true;
  let v = 0;
  if (fg.panting) {
    if (f.stamina >= PANT_DONE) {                       // (after the last breath, and not after a night or a new meadow)
      if (now < fg.pantAt) return;
      fg.panting = false; if (now - fg.pantAt < 3000) chime('phew'); return;
    }
    v = 1 - 0.85 * f.stamina / PANT_DONE;
  } else if (f.running && f.walking && f.stamina < PANT_LOW) v = 0.45 * (1 - f.stamina / PANT_LOW);
  if (v < 0.05 || now < fg.pantAt) return;
  chime('pant', { v });
  fg.pantAt = now + (PANT_MS[1] - (PANT_MS[1] - PANT_MS[0]) * v) * (0.9 + 0.2 * Math.random());
}
// Woken (sim.js wakeForager): the dark lifts with it at home, the camera already there.
function bodyWoke() {
  const f = world.forager;
  fg.downAt = 0; fg.dark = false; fg.puffs.length = 0; fg.drips.length = 0; fg.snow = 0;
  $('#veil').classList.remove('dark');
  chime('wake');
  cam.x = f.x; cam.y = f.y - CAM_FEET * forPx() / cam.zoom; fg.lx = fg.ly = 0; fg.at = -1;
  ui.mark = null; ui.gather = null; ui.queue.length = 0; ui.fire = null; ui.place = null;
  renderSatchel();
  setTimeout(() => toast('You wake at home, stiff with cold. The satchel is empty.'), 900);
}
const VITAL_FULL = 0.985;
const vit = { warm: -1, wet: -1, stam: -1, winded: null, frost: -1 };
function renderVitals() {
  const f = world.forager, box = $('#vitals');
  if (!box) return;
  const warm = Math.round(f.warmth * 100), wet = Math.round(f.wet * 10), stam = Math.round(f.stamina * 100);
  if (warm !== vit.warm || wet !== vit.wet) {
    const el = $('#v-warm'), k = clamp(f.warmth, 0, 1);
    el.classList.toggle('show', f.warmth < VITAL_FULL || f.wet > 0.05);
    el.style.setProperty('--c', `rgb(${Math.round(lerp(120, 222, k))}, ${Math.round(lerp(168, 128, k))}, ${Math.round(lerp(222, 58, k))})`);
    el.querySelector('i').style.width = warm + '%';
    el.querySelector('.drop').style.opacity = f.wet > 0.05 ? (0.35 + 0.65 * f.wet).toFixed(2) : '0';
    el.title = ['Cosy', 'Chilly', 'Cold', 'Freezing', 'Too cold'][S.warmthStage(f)] + (f.wet > 0.6 ? ', soaked' : f.wet > 0.05 ? ', damp' : '');
    vit.warm = warm; vit.wet = wet;
  }
  if (stam !== vit.stam || f.winded !== vit.winded) {
    const el = $('#v-stam');
    el.classList.toggle('show', f.stamina < VITAL_FULL);
    el.classList.toggle('winded', f.winded);
    el.querySelector('i').style.width = stam + '%';
    el.title = f.winded ? 'Out of breath' : 'Stamina';
    vit.stam = stam; vit.winded = f.winded;
  }
  const frost = S.warmthStage(f) === 3 ? Math.round((0.45 + 0.55 * (1 - f.warmth / S.WARMTH_STAGES[2])) * 20) / 20 : 0;
  if (frost !== vit.frost) {
    const el = $('#frost');
    el.classList.toggle('on', frost > 0);
    el.style.opacity = frost;
    vit.frost = frost;
  }
}

// Picking an outfit: a small card at the foot of the screen, under the forager, with it painted in each (front on,
// standing) to tap. It opens as a new meadow does till one has been picked (newWorld), and from the ••• menu; the meadow
// goes on behind it.
function pickOutfit(open) {
  const card = $('#outfit');
  card.classList.toggle('hidden', !open);
  if (!open) return;
  const row = $('#outfit-row');
  if (!row.children.length) Fur.FORAGER_OUTFITS.forEach((o, i) => {
    const b = document.createElement('button'), c = document.createElement('canvas'), px = 84, size = Math.ceil(px * 1.3 * dpr);
    c.width = c.height = size;
    Fur.paintForager(c.getContext('2d'), size, px * dpr, (i << 7) + (1 << 5));
    b.className = 'outfit-pick'; b.dataset.act = 'outfit'; b.dataset.o = i; b.title = o.name;
    b.append(c, Object.assign(document.createElement('span'), { textContent: o.name }));
    row.append(b);
  });
  for (const b of row.children) b.classList.toggle('on', +b.dataset.o === fg.outfit);
}
const outfitOpen = () => !$('#outfit').classList.contains('hidden');
function wearOutfit(o) {
  fg.outfit = o; fg.sized = 0; fg.picked = true;   // (foragerAhead asks for its new paintings)
  try { localStorage.setItem(OUTFIT, String(o)); } catch (e) { /* fine */ }
  pickOutfit(false);
}

// Where it was sent: a soft ring on the ground that comes in with a little bounce, breathes while it walks there and
// fades once it's arrived. Painted once (MARK_ART), then only drawn. Held and steering, where it was sent moves on every
// STEER_MS: the ring glides after it (MARK_GLIDE), and the trail with it, rather than jumping.
const MARK_MS = [220, 500];                // coming in, fading out
const MARK_GLIDE = 150;                   // ms: how quickly the ring catches up with where it was sent (a time constant)
let MARK_ART = null;
function markArt() {
  const W = 128, H = 64, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.translate(W / 2, H / 2); g.scale(1, 0.5);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, W / 2);
  gr.addColorStop(0, 'rgba(255, 250, 230, 0.35)'); gr.addColorStop(0.45, 'rgba(255, 250, 230, 0.12)');
  gr.addColorStop(0.68, 'rgba(255, 252, 240, 0.95)'); gr.addColorStop(0.8, 'rgba(255, 248, 225, 0.5)'); gr.addColorStop(1, 'rgba(255, 248, 225, 0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, W / 2, 0, TAU); g.fill();
  MARK_ART = { img: c };
  asBitmap(c, b => { MARK_ART.img = b; });
  return MARK_ART;
}
function drawMark(now) {
  const m = ui.mark, f = world.forager;
  if (!m.end && !f.walking) m.end = now;
  const t = now - m.t0, fade = m.end ? 1 - (now - m.end) / MARK_MS[1] : 1;
  if (fade <= 0) { ui.mark = null; return; }
  const g = m.at ? 1 - Math.exp(-Math.min(100, now - m.at) / MARK_GLIDE) : 1;
  m.at = now; m.sx += (m.x - m.sx) * g; m.sy += (m.y - m.sy) * g;
  const pop = t < MARK_MS[0] ? 1 + 0.35 * Math.sin(Math.PI * t / MARK_MS[0]) * (1 - t / MARK_MS[0]) : 1;
  const r = Math.max(10, (8 + cam.zoom) * 0.42) * pop * (1 + 0.05 * Math.sin(now / 260)) * (m.end ? 1 + 0.25 * (1 - fade) : 1);
  const [sx, sy] = onScreen(m.sx, m.sy), art = MARK_ART || markArt(), a = Math.min(1, t / 120) * fade;
  const k = clamp((t - TRAIL_IN[0]) / TRAIL_IN[1], 0, 1);
  drawTrail(sx, sy, r, k * k * (3 - 2 * k) * fade, now);   // (it comes in eased, just after the ring)
  ctx.globalAlpha = a * 0.9;
  ctx.drawImage(art.img, sx - r, sy - r / 2, r * 2, r);
  ctx.globalAlpha = 1;
}
// And the way there: a faint dashed line from the ring back along what's left of its path (sim.js f.path, pulled tight
// round the deep) to just short of its feet. The dashes are counted from the ring's middle, so they keep still on the
// ground and it walks over them. It fades in once the ring has popped up. Sprinting, the dashes march on toward the ring
// (TRAIL_MARCH), the pace eased up and down as it sets off and slows (TRAIL_EASE), and still while time is paused.
const TRAIL_A = 0.6;
const TRAIL_IN = [80, 450];               // ms after the ring it starts fading in, and how long that takes
const TRAIL_MARCH = 2.2;                  // dashes a second they march on by, sprinting
const TRAIL_EASE = 250;                   // ms the march takes to get up to pace or settle
const TRAIL = [], TRAIL_DASH = [0, 0];
let trailMarch = 0, trailPace = 0, trailAt = 0;   // how far they've marched (in dashes), how fast now, and when that was
function drawTrail(sx, sy, r, a, now) {
  const f = world.forager, P = f.path, dt = Math.min(100, now - trailAt);
  trailAt = now;
  trailPace += ((f.walking && f.running && ui.speed > 0 ? 1 : 0) - trailPace) * Math.min(1, dt / TRAIL_EASE);
  trailMarch = (trailMarch + trailPace * TRAIL_MARCH * dt / 1000) % 1;
  if (!f.walking || P.length < 4 || a < 0.02) return;
  let n = 0;
  TRAIL[n++] = sx; TRAIL[n++] = sy;
  for (let k = P.length - 4; k >= f.leg * 2; k -= 2) { const p = onScreen(P[k], P[k + 1]); TRAIL[n++] = p[0]; TRAIL[n++] = p[1]; }
  const d = drawnAt(f), p = onScreen(d.x, d.y);
  TRAIL[n++] = p[0]; TRAIL[n++] = p[1];
  let len = 0;
  for (let i = 0; i + 3 < n; i += 2) len += Math.hypot(TRAIL[i + 2] - TRAIL[i], TRAIL[i + 3] - TRAIL[i + 1]);
  // From the ring's edge (an oval r wide and half that tall, so how far depends on the way it leaves) to short of its feet.
  const ux = (TRAIL[2] - sx) / (Math.hypot(TRAIL[2] - sx, TRAIL[3] - sy) || 1), uy = (TRAIL[3] - sy) / (Math.hypot(TRAIL[2] - sx, TRAIL[3] - sy) || 1);
  const from = 0.85 * r / Math.hypot(ux, 2 * uy), to = len - forPx() * 0.3, dash = clamp(cam.zoom * 0.2, 4, 11);
  if (to - from < dash) return;
  ctx.save();
  TRAIL_DASH[0] = dash; TRAIL_DASH[1] = dash * 1.2;
  ctx.setLineDash(TRAIL_DASH); ctx.lineDashOffset = from + trailMarch * dash * 2.2;   // (a whole dash and gap a step)
  ctx.lineWidth = clamp(cam.zoom * 0.065, 2, 3.25); ctx.lineCap = 'round';
  ctx.strokeStyle = '#fffaea'; ctx.globalAlpha = a * TRAIL_A;
  ctx.beginPath();
  let s = 0, on = false;
  for (let i = 0; i + 3 < n; i += 2) {
    const ax = TRAIL[i], ay = TRAIL[i + 1], bx = TRAIL[i + 2], by = TRAIL[i + 3], l = Math.hypot(bx - ax, by - ay);
    if (!l) continue;
    if (!on && s + l > from) { const k = (from - s) / l; ctx.moveTo(ax + (bx - ax) * k, ay + (by - ay) * k); on = true; }
    if (on && s + l >= to) { const k = (to - s) / l; ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); break; }
    if (on) ctx.lineTo(bx, by);
    s += l;
  }
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ gathering
//
// A click or a tap on something the meadow gives (gatherAt: a clump of mushrooms, a wild find, a patch of greens, a bramble, a fruit
// or mast tree, a hive) walks the forager to its near side, a reach away (standPoint), and once it's there (gatherFrame)
// it stoops and picks (fur.js poses 3 and 4, fg.pick): sim.js gather takes it from the meadow and puts it in the satchel,
// a "+3 Chanterelles" floats up from the spot (pickFloats), the thing flies into its slot (flyToSlot) and the pick sound plays.
// Hovered with a mouse, a thing that has something to give glows softly (GLOW_ART, under it, painted once) with its name
// by it, and the pointer is a hand; one with nothing says why in a small line ("Not ripe yet", "Picked clean", sim.js
// whatThere), as a click on it does. The hover is looked up only when the pointer or the camera moved (hoverFrame), and
// only among the things near the pointer (the trees through the sim's grid).
const PICK_MS = [140, 520, 680];          // the pick's stoop, reach and back up (ms)
const PICK_QUICK = 0.6;                   // with more lined up, it picks this much quicker, and sets off as it comes back up
const FLOAT_MS = 1400, SAY_MS = 1900;     // a "+3 Chanterelles" floating up, and a line saying why not
const FROM_FRONT = { tree: 1, hive: 1, bramble: 1 };   // (comes at these from in front, where it shows, not hidden behind them)
let GLOW_ART = null;
const pickFloats = [];                    // { img, w, h, x, y (world), t0, ms }
const aim = { x: 0, y: 0, in: false, moved: false, cx: 0, cy: 0, cz: 0, at: 0, t: null, id: '', n: 0, why: '', fire: null };   // what the mouse is on (hoverFrame): a thing to gather, or a fire
const AIM_MS = 150;

// The thing to gather under a point: { kind, it } or null. Hives first (in their tree), then what grows at a tree's foot,
// the trees with fruit or mast, and the garlic lying flat under all.
function gatherAt(sx, sy) {
  const z = cam.zoom, [wx, wy] = toWorld(sx, sy), f = fingerTap ? 1.6 : 1;
  const h = hiveAt(sx, sy);
  if (h) return { kind: 'hive', it: h };
  let best = null, bd = Infinity;
  for (const d of world.dropped) {                     // (lying on top of all: first)
    if (Math.abs(d.x - wx) > 3 || Math.abs(d.y - wy) > 3) continue;
    const px = dropPx(d, z), x = (d.x - cam.x) * z + vw / 2, y = (d.y - cam.y) * z + vh / 2 - px * 0.3;
    const r = Math.max(14 * f, px * 0.55), e = ((x - sx) ** 2 + (y - sy) ** 2) / (r * r);
    if (e < 1 && e < bd) { best = d; bd = e; }
  }
  if (best) return { kind: 'dropped', it: best };
  for (const m of world.shrooms) {
    if (Math.abs(m.x - wx) > 3 || Math.abs(m.y - wy) > 4) continue;
    placeShroom(m, z);
    const r = Math.max(12 * f, shroomAt.px * 0.55), d = ((shroomAt.x - sx) ** 2 + (shroomAt.y - sy) ** 2) / (r * r);
    if (d < 1 && d < bd) { best = m; bd = d; }
  }
  for (const m of world.finds) {                       // (as near as a mushroom: whichever the point is nearer)
    if (Math.abs(m.x - wx) > 4 || Math.abs(m.y - wy) > 4) continue;
    const px = findPx(m, z), x = (m.x - cam.x) * z + vw / 2, y = (m.y - cam.y) * z + vh / 2 - px * 0.31;
    const r = Math.max(14 * f, px * 0.5), d = ((x - sx) ** 2 + (y - sy) ** 2) / (r * r);
    if (d < 1 && d < bd) { best = m; bd = d; }
  }
  if (best) return { kind: best.find ? 'find' : 'shroom', it: best };
  for (const b of world.brambles) {
    if (Math.abs(b.x - wx) > 4 || Math.abs(b.y - wy) > 4) continue;
    const px = bramblePx(b, z), x = (b.x - cam.x) * z + vw / 2, y = (b.y - cam.y) * z + vh / 2 - px * 0.18;
    const d = ((sx - x) / Math.max(10 * f, px * 0.5)) ** 2 + ((sy - y) / Math.max(8 * f, px * 0.26)) ** 2;
    if (d < 1 && d < bd) { best = b; bd = d; }
  }
  if (best) return { kind: 'bramble', it: best };
  for (const g of world.greens) {
    if (g.kind !== 'nettle' || Math.abs(g.x - wx) > 3 || Math.abs(g.y - wy) > 4 || S.greenStage(world, g) === null) continue;
    const px = nettlePx(g, z), x = (g.x - cam.x) * z + vw / 2, y = (g.y - cam.y) * z + vh / 2 - px * 0.3, r = Math.max(12 * f, px * 0.4);
    const d = ((sx - x) ** 2 + (sy - y) ** 2) / (r * r);
    if (d < 1 && d < bd) { best = g; bd = d; }
  }
  if (best) return { kind: 'green', it: best };
  S.forEachDecorNear(world, wx, wy + 3, 10, d => {        // a tree with fruit or mast: on it as it's drawn, the one in front
    if (!d.tree || d.stump || !(d.kind === 'apple' || d.kind === 'cherry' || d.kind === 'oak' || d.kind === 'beech')) return;
    const [dx, dy] = toScreen(d.x, d.y), px = treePx(d), half = Math.max(8, px * 0.36), top = Math.max(12, px * 0.85);
    if (Math.abs(sx - dx) < half && sy > dy - top && sy < dy + Math.max(6, px * 0.14) && (!best || d.y > best.y)) best = d;
  });
  if (best) return { kind: 'tree', it: best };
  for (const g of world.greens) {
    if (g.kind !== 'garlic' || Math.abs(g.x - wx) > 4 || Math.abs(g.y - wy) > 3 || S.greenStage(world, g) === null) continue;
    const px = garlicPx(g, z), x = (g.x - cam.x) * z + vw / 2, y = (g.y - cam.y) * z + vh / 2;
    const d = ((sx - x) / (px * 0.5)) ** 2 + ((sy - y + px * 0.1) / (px * 0.22)) ** 2;
    if (d < 1 && d < bd) { best = g; bd = d; }
  }
  return best ? { kind: 'green', it: best } : snapTo(sx, sy);
}
// Near enough is on it: a click or a tap a little off something with something to give (SNAP px past its glow, more for a
// finger, and it's in reach of the forager more still) goes for it, so a moving meadow doesn't make you miss.
const SNAP = 14, SNAP_FINGER = 26, SNAP_NEAR = 1.5;
function snapTo(sx, sy) {
  const F = world.forager, pad = fingerTap ? SNAP_FINGER : SNAP;
  let best = -1, bd = 1;
  for (let i = 0; i < picks.it.length; i++) {
    const it = picks.it[i], s = gatherSpot(picks.kind[i], it);
    const r = Math.max(s.rx, s.ry) * 0.7 + pad * (Math.hypot(it.x - F.x, it.y - F.y) < NEAR_REACH ? SNAP_NEAR : 1);
    const d = Math.hypot(sx - s.gx, sy - s.gy) / r;
    if (d < bd) { bd = d; best = i; }
  }
  return best < 0 ? null : { kind: picks.kind[best], it: picks.it[best] };
}

// Where it is (world), how far off the forager stands to pick it, and its glow on screen (x, y, rx, ry).
const gspot = { x: 0, y: 0, reach: 0, gx: 0, gy: 0, rx: 0, ry: 0 };
function gatherSpot(kind, it) {
  const z = cam.zoom, sx = (it.x - cam.x) * z + vw / 2, sy = (it.y - cam.y) * z + vh / 2;
  gspot.x = it.x; gspot.y = it.y; gspot.gx = sx; gspot.gy = sy;
  if (kind === 'shroom') {
    placeShroom(it, z);
    gspot.reach = 0.45; gspot.gx = shroomAt.x; gspot.gy = shroomAt.y; gspot.rx = gspot.ry = Math.max(10, shroomAt.px * 0.62);
  } else if (kind === 'dropped') {
    const px = dropPx(it, z);
    gspot.reach = 0.35; gspot.gy = sy - px * 0.3; gspot.rx = Math.max(10, px * 0.5); gspot.ry = Math.max(10, px * 0.45);
  } else if (kind === 'find') {
    const px = findPx(it, z);
    gspot.reach = 0.35 + FIND_PX[it.kind] * 0.2; gspot.gy = sy - px * 0.31; gspot.rx = Math.max(10, px * 0.5); gspot.ry = Math.max(10, px * 0.42);
  } else if (kind === 'green') {
    const px = it.kind === 'garlic' ? garlicPx(it, z) : nettlePx(it, z);
    gspot.reach = it.kind === 'garlic' ? 0.7 + 0.15 * it.size : 0.55;
    if (it.kind === 'garlic') { gspot.gy = sy - px * 0.08; gspot.rx = px * 0.58; gspot.ry = px * 0.26; }
    else { gspot.gy = sy - px * 0.3; gspot.rx = px * 0.5; gspot.ry = px * 0.5; }
  } else if (kind === 'bramble') {
    const px = bramblePx(it, z);
    gspot.reach = 0.55 + 0.25 * it.size; gspot.gy = sy - px * 0.2; gspot.rx = px * 0.6; gspot.ry = px * 0.36;
  } else if (kind === 'tree') {
    const px = treePx(it);
    gspot.reach = 1;
    if (it.kind === 'cherry') { gspot.gy = sy - px * 0.55; gspot.rx = px * 0.5; gspot.ry = px * 0.42; }   // (round the crown, where they hang)
    else { gspot.gy = sy + px * 0.02; gspot.rx = px * 0.42; gspot.ry = px * 0.16; }                      // (round its foot, where they lie)
  } else {                                                // a hive: its hollow, low on the trunk
    const P = z * (it.tree ? it.tree.size : S.HIVE_TREE);
    gspot.reach = 0.75; gspot.gy = sy - P * 0.15; gspot.rx = gspot.ry = Math.max(14, P * 0.14);
  }
  return gspot;
}

// Where the forager stands to pick it: on the side it's coming from, a reach away (in front of a tree or a hive, where it shows).
function standPoint(kind, it) {
  const s = gatherSpot(kind, it), F = world.forager;
  let dx = F.x - s.x, dy = F.y - s.y;
  if (FROM_FRONT[kind]) dy = Math.max(dy, 0.6 * Math.abs(dx) + 0.3);
  const d = Math.hypot(dx, dy) || 1;
  return [s.x + dx / d * s.reach, s.y + dy / d * s.reach];
}

// A click or a tap on it: off the forager goes. One with nothing to give says why now, and is only walked to.
function goGather(t, run = false) {
  if (world.forager.down >= 0) return;
  const [x, y] = standPoint(t.kind, t.it), w = S.whatThere(world, t.kind, t.it);
  walkTo(...toScreen(x, y), false, true);
  if (run && world.forager.walking && !world.forager.winded) world.forager.running = true;
  if (w.n) ui.gather = { kind: t.kind, it: t.it };
  else if (w.why) { const s = gatherSpot(t.kind, t.it); say(w.why, s.x, s.y); }
}

// What the hand sounds like taking it (sound.js pluck): the ingredient's first tag.
const pickSound = id => { const g = Recipes.INGREDIENTS[id]; return g && g.tags[0] || ''; };

// Once a frame: there, it picks; stopped short (it couldn't get there), it says so.
function gatherFrame(now) {
  const g = ui.gather, F = world.forager;
  if (F.down >= 0) return;                              // (collapsed)
  if (!g && ui.queue.length && !F.walking && now >= ui.nextAt) nextGather();
  if (!g || F.walking) return;
  ui.gather = null;
  const s = gatherSpot(g.kind, g.it);
  if (Math.hypot(F.x - s.x, F.y - s.y) > s.reach + 0.9) { say('Can\'t reach it', s.x, s.y); return; }
  const r = S.gather(world, g.kind, g.it);
  picks.at = -1e9;                                      // (what's left to pick, listed again at once)
  if (!r.n) { if (r.why === 'full') say('Satchel\'s full', F.x, F.y - 1.6); else if (r.why) say(r.why, s.x, s.y); return; }
  aim.moved = true;                                     // (what the mouse is on may be gone now: look again)
  const dx = s.x - F.x, dy = s.y - F.y;                 // it turns to it, and stoops
  fg.view = Math.abs(dy) > Math.abs(dx) * 0.8 ? (dy > 0 ? 1 : 2) : 0;
  if (Math.abs(dx) > 0.05) fg.flip = dx > 0;
  fg.pick = now; fg.pickK = ui.queue.length ? PICK_QUICK : 1;
  if (Net && Net.on) Net.send({ t: 'pick', kind: g.kind, id: r.id, x: g.it.x, y: g.it.y, n: r.n, tick: world.tick,   // (gone for everyone,
    fx: F.x, fy: F.y, k: fg.pickK, v: fg.view, fl: fg.flip });                                                     // and they see it picked)
  ui.nextAt = now + (ui.queue.length ? PICK_MS[1] : PICK_MS[2]) * fg.pickK;   // (the next in the queue once it's back up)
  $('#satchel').classList.remove('empty');
  const lands = PICK_MS[0] * fg.pickK + 90, [gx, gy] = [s.gx, s.gy], at = now + lands;
  setTimeout(() => {
    if (!world) return;
    pickFloats.push(floatOf(r.id, r.n, s.x, s.y, at));
    flyToSlot(r.id, gx, gy, r.into[r.into.length - 1], () => chime('pick', { n: r.n }));   // (the plop as it lands)
    chime('pluck', { what: pickSound(r.id) });
    firstFind(r.id);
  }, lands);
}

// The queue: while the forager is off to pick something (or stooped picking it), a click or a tap on more to pick lines it up
// after, in the order clicked, with a small numbered badge on each (drawQueue); clicked again, it comes off. A click on
// the ground, or holding to run, lets the whole queue go (walkTo). Something gone or picked clean meanwhile is passed over.
const QUEUE_MOST = 9;
function queueGather(t) {
  const busy = ui.gather || ui.queue.length || performance.now() < ui.nextAt;
  if (!busy) return false;
  if (ui.gather && ui.gather.it === t.it) return true;   // (already off to it)
  const k = ui.queue.findIndex(q => q.it === t.it);
  if (k >= 0) { ui.queue.splice(k, 1); chime('click'); return true; }
  const w = S.whatThere(world, t.kind, t.it);
  if (!w.n) { if (w.why) { const s = gatherSpot(t.kind, t.it); say(w.why, s.x, s.y); } return true; }
  if (ui.queue.length >= QUEUE_MOST) return true;
  ui.queue.push({ kind: t.kind, it: t.it });
  chime('click');
  return true;
}
// E: the nearest thing to pick in reach (lit by drawNear) or lying where it was dropped, as a click on it would. Pressed again
// while it's off picking, the next nearest lines up after.
function pickNear() {
  const F = world.forager, busy = ui.gather || ui.queue.length || performance.now() < ui.nextAt;
  let best = null, bd = NEAR_REACH * NEAR_REACH;
  const look = (kind, it) => {
    const d = (it.x - F.x) ** 2 + (it.y - F.y) ** 2;
    if (d >= bd || (busy && ((ui.gather && ui.gather.it === it) || ui.queue.some(q => q.it === it)))) return;
    if (!S.whatThere(world, kind, it).n) return;
    best = { kind, it }; bd = d;
  };
  for (let i = 0; i < picks.it.length; i++) look(picks.kind[i], picks.it[i]);
  for (const d of world.dropped) look('dropped', d);
  if (!best) { if (!busy) say('Nothing in reach', F.x, F.y - 1.6); return; }
  if (!queueGather(best)) goGather(best);
}
function nextGather() {
  while (ui.queue.length) {
    const t = ui.queue.shift();
    if (S.whatThere(world, t.kind, t.it).n) { goGather(t); return; }
  }
}
// A number on each in the queue (the one it's off to is 1), painted once a number, over everything by its light.
const BADGES = [];
function badgeArt(n) {
  if (BADGES[n]) return BADGES[n];
  const P = 44, c = document.createElement('canvas'), g = c.getContext('2d'), m = P / 2;
  c.width = c.height = P;
  g.fillStyle = 'rgba(60, 40, 10, 0.25)'; g.beginPath(); g.arc(m, m + 1.5, m - 3, 0, TAU); g.fill();
  g.fillStyle = 'rgb(251, 244, 224)'; g.beginPath(); g.arc(m, m, m - 4, 0, TAU); g.fill();
  g.strokeStyle = 'rgb(176, 132, 58)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#5a4526'; g.font = `800 ${Math.round(P * 0.5)}px Nunito, ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), m, m + 1.5);
  BADGES[n] = { img: c };
  asBitmap(c, b => { BADGES[n].img = b; });
  return BADGES[n];
}
function drawQueue() {
  if (!ui.queue.length) return;
  const r = narrow() ? 11 : 10;
  for (let k = -1; k < ui.queue.length; k++) {
    const t = k < 0 ? ui.gather : ui.queue[k];
    if (!t) continue;
    const s = gatherSpot(t.kind, t.it), x = s.gx, y = s.gy - s.ry - r * 0.6;   // (just over it)
    if (!visible(x, y, r)) continue;
    ctx.drawImage(badgeArt(k + (ui.gather ? 2 : 1)).img, x - r, y - r, r * 2, r * 2);
  }
}

// A line by a thing (world x, y): why not, or the satchel full.
function say(text, x, y) {
  pickFloats.push(floatOf('', 0, x, y, performance.now(), text));
}

// What a thing is called, n of them: recipes.js's name, made plural for more than one (an apple, two apples; honey stays honey).
const MASS = { honey: 1, drygrass: 1, birchbark: 1, garlic: 1, nettle: 1, sorrel: 1, watercress: 1, elderflower: 1, sulphur: 1, chanterelle: 1, cherry: 1, blackberry: 1, acorns: 1, beechnuts: 1 };
function itemName(id, n) {
  const name = Recipes.INGREDIENTS[id]?.name || id;
  return n > 1 && !MASS[id] && !name.endsWith('s') ? name + 's' : name;
}
// "+3 Chanterelles" with its icon on a parchment pill (or a plain line), painted once, then only drawn.
function floatOf(id, n, x, y, t0, text) {
  const icon = id ? 20 : 0, label = text || `+${n} ${itemName(id, n)}`;
  const c = document.createElement('canvas'), g = c.getContext('2d'), k = 2;
  g.font = LABEL_FONT;
  const w = Math.ceil(g.measureText(label).width + 18 + (icon ? icon + 2 : 0)), h = 24;
  c.width = w * k; c.height = h * k;
  g.scale(k, k);
  g.fillStyle = text ? 'rgba(255, 250, 240, 0.92)' : 'rgba(255, 248, 228, 0.96)';
  g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, 12); g.fill();
  g.strokeStyle = 'rgba(150, 115, 60, 0.35)'; g.lineWidth = 1; g.stroke();
  if (icon) { const sh = itemSheet(), i = ITEM_IDS.indexOf(id); if (i >= 0) g.drawImage(sh.canvas, i * ITEM_PX, 0, ITEM_PX, ITEM_PX, 6, 2, icon, icon); }
  g.font = LABEL_FONT; g.fillStyle = text ? '#6f6657' : '#3b372f'; g.textBaseline = 'middle';
  g.fillText(label, 9 + (icon ? icon + 2 : 0), h / 2 + 0.5);
  while (pickFloats.length > 4) pickFloats.shift();
  return { img: c, w, h, x, y, t0, ms: text ? SAY_MS : FLOAT_MS, rise: text ? 10 : 34 };
}
function drawPickFloats(now) {
  for (let k = pickFloats.length - 1; k >= 0; k--) {
    const f = pickFloats[k], u = (now - f.t0) / f.ms;
    if (u >= 1) { pickFloats.splice(k, 1); continue; }
    if (u < 0) continue;
    const [sx, sy] = onScreen(f.x, f.y), e = 1 - (1 - u) ** 3;
    ctx.globalAlpha = Math.min(1, u * 8) * (u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1);
    ctx.drawImage(f.img, Math.round(sx - f.w / 2), Math.round(sy - 18 - Math.max(16, cam.zoom * 0.9) - f.rise * e), f.w, f.h);
  }
  ctx.globalAlpha = 1;
}

// The glow under what the mouse is on: a soft warm light, painted once, stretched to the thing.
function glowArt() {
  const W = 128, c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  gr.addColorStop(0, 'rgba(255, 246, 214, 0.55)'); gr.addColorStop(0.55, 'rgba(255, 240, 196, 0.38)'); gr.addColorStop(1, 'rgba(255, 236, 190, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, W);
  GLOW_ART = { img: c };
  asBitmap(c, b => { GLOW_ART.img = b; });
  return GLOW_ART;
}

// What the mouse is on, looked up again only when it or the camera moved; what it has to give, every frame (cheap).
function hoverFrame() {
  if (!aim.in || fingerTap || drag || ui.place) { if (aim.t || aim.fire) { aim.t = null; aim.fire = null; canvas.classList.remove('on-animal'); } return; }
  const now = performance.now();                        // (the camera gliding after the forager: a look every AIM_MS will do)
  if (aim.moved || (aim.cx !== cam.x || aim.cy !== cam.y || aim.cz !== cam.zoom) && now - aim.at > AIM_MS) {
    aim.moved = false; aim.cx = cam.x; aim.cy = cam.y; aim.cz = cam.zoom; aim.at = now;
    aim.fire = ui.hoverId ? null : fireAt(aim.x, aim.y);   // (a fire first, as a click: over what lies by it)
    aim.t = ui.hoverId || aim.fire ? null : gatherAt(aim.x, aim.y);
  }
  if (aim.t) {
    const w = S.whatThere(world, aim.t.kind, aim.t.it);
    aim.id = w.id; aim.n = w.n; aim.why = w.why;
    if (!w.n && !w.why) aim.t = null;                     // (a dead tree: nothing to say)
  }
  canvas.classList.toggle('on-animal', !!ui.hoverId || !!(aim.t && aim.n) || !!aim.fire);
}
function drawGlow(now, over) {
  if (!aim.t || !aim.n || (aim.t.kind === 'hive') !== over) return;   // (a hive's goes over its hollow: under, the trunk hid it)
  const s = gatherSpot(aim.t.kind, aim.t.it), art = GLOW_ART || glowArt(), k = 1 + 0.06 * Math.sin(now / 300);
  ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now / 300);
  ctx.drawImage(art.img, s.gx - s.rx * 1.25 * k, s.gy - s.ry * 1.25 * k, s.rx * 2.5 * k, s.ry * 2.5 * k);
  ctx.globalAlpha = 1;
}
function drawHoverLine(now) {
  if (aim.fire && !ui.fire && !pickFloats.length) {      // a fire: how it is, and what it wants (fireWord)
    const F = aim.fire, z = cam.zoom;
    drawLabel(fireWord(F), (F.x - cam.x) * z + vw / 2, (F.y - cam.y) * z + vh / 2 + firePx(z) * 0.15 + 4);
    return;
  }
  if (!aim.t || ui.gather || pickFloats.length) return;   // (not over a "+3" floating up, or a line saying why not)
  const s = gatherSpot(aim.t.kind, aim.t.it);
  drawLabel(aim.n ? Recipes.INGREDIENTS[aim.id]?.name || aim.id : aim.why, s.gx, s.gy + s.ry * 0.9 + 4);
}

// ------------------------------------------------------------------ the campfire
//
// A fire (sim.js w.fires) is built from what's in the satchel (recipes.js BUILDS.campfire: pebbles, sticks and tinder). The
// fire button by the satchel (#build, renderBuild) has a little campfire in it and a ring round it filling in as the
// satchel holds more of what one takes; with it all there, a tap (or F) picks a spot near the forager (ui.place: a faint
// fire there, following the mouse, or where a finger taps or drags, within PLACE_REACH; one where it can't go says why,
// sim.js fireSpot). The forager walks there, kneels at its side (fur.js's kneeling, view 3, side on to it, STAND_OFF off)
// and lays it a piece at a time (LAY_MS each: the stones, the sticks, the tinder; 'fire:' 32 + the step), strikes its
// flint and steel (STRIKES: a soft chk, sparks) till a spark takes in the tinder, and then you hold (the mouse or a finger
// anywhere, or F) to blow: it bends right down and blows, a breath at a time (BLOW_BREATH), the spark glows brighter and
// smoke curls up off it; once it's caught little flames lick up, and let go the flame takes (sim.js lightFire). Let go too
// soon and it only smokes, and the spark cools a little: blow again. The wet makes it longer (BLOW_WET). A click or a tap on
// a fire walks it there to see to it (clickFire): sticks on one burning, a stick on the embers and a quick blow, tinder and
// a strike for a cold one. Standing still by a lit one it kneels and holds its mittens out to it (SIT_MS). All of it is
// ui.fire (fireFrame), let go by a walk anywhere else.
// Drawn with the trees and animals (a frame item's s): its painting as it is (fireArt: 'fire:' + bed * 8 + pile * 2 + tinder,
// paintFire, painted once a look and size), its flames (TONGUES of FLAME_ART, painted once, each swaying and flickering on its
// own clock) and its smoke; over the dark its glow, the embers drifting up off it and the sparks (drawFireGlows). At night
// its light is cut out of the dark (lights, laySky's SKY_FIRE: the pool it lights, flickering in FLICKER_MS steps, so the
// sky's picture is painted again only on a step or a move), and what stands about it, the forager too, is lit warm on the
// side toward it (LIGHT_ART, laid source-atop over what's drawn: nearer is warmer).
const FIRE_SIZE = 1.55;                  // a fire's painting, next to a rabbit's
const FIRE_FOOT = 0.25;                  // where the ground under its middle is in its painting's box (-1 to 1)
const FIRE_ARTS = Array.from({ length: 48 }, (_, i) => 'fire:' + i);   // (made once: a frame builds no names)
const BUILD = 'campfire';                // recipes.js BUILDS: what the fire button builds
const PLACE_REACH = 5;                   // tiles from the forager a fire can be laid
const STAND_OFF = 0.78;                  // tiles to its side the forager kneels at it
const LAY_STEPS = 12, LAY_MS = 190;      // six stones, five sticks and the tinder, this long each
const STRIKE_MS = 440, STRIKE_UP = 0.6;  // a strike of the flint and steel, and how much of it is the swing up
const STRIKES = 2;                       // strikes till a spark takes (one more in the wet)
const BLOW_S = 2.2;                      // s of blowing it takes to light the tinder, dry (BLOW_WET times that in the wet)
const BLOW_WET = { rain: 1.5, storm: 2, snow: 1.3 };
const BLOW_EMBERS = 0.6;                 // blowing on embers starts this far along
const BLOW_BREATH = 1000, BLOW_OUT = 0.72;   // ms a breath takes, and how much of it is blowing out (the rest, a breath in)
const BLOW_COOL = 0.3, BLOW_FLOOR = 0.12;    // how fast the spark cools between blows (a second), and how far it goes
const CATCH_HOLD = 900;                  // ms it can be held once it's caught before the flame takes anyway
const TAKE_MS = 1300;                    // ms the flames take to grow, once lit
const LIT_MS = 1100;                     // ms it stays kneeling, watching it take, before it stands
const FEED_MS = 520, FEED_AT = 0.5;      // ms putting a stick on takes, and how far into that it goes on
const SIT_MS = 1600, SIT_NEAR = 1.7;     // standing still this long this near a lit fire, it kneels to warm its hands
const FLAME_H = 0.62;                    // a fed fire's flames, in its size
const LIGHT_TILES = 8;                   // how far a fed fire's light reaches at night
const LIGHT_FLAT = 0.72;                 // the light lies on the ground: an oval this much as tall as wide
const FLICKER_MS = 90;                   // the light in the dark flickers in steps this long
const SMOKES = 7, EMBERS_UP = 9;         // smoke puffs and embers drifting up off a fire at once, at most
const KNEEL = Fur.FORAGER_KNEEL, KNEEL_AT = Fur.KNEEL_VIEW << 5;
const KNEEL_POSES = Object.values(KNEEL);

// The fire's painting. n under 32: bed * 8 + pile * 2 + tinder; bed 0 new (scraped earth), 1 burning (red coals), 2 embers
// (glowing), 3 cold (grey ash); pile 0 to 3, the sticks on it (charred while it burns); tinder, a pale tuft of it in the
// middle. 32 + step: being laid, step pieces down (the stones, then the sticks, then the tinder).
const FIRE_RING = [0.6, 0.26];           // the ring of stones in its painting: half its width and height
const FIRE_STONES = [[-2.75, 0.165], [-1.65, 0.15], [-0.6, 0.16], [0.5, 0.17], [1.55, 0.175], [2.6, 0.16]];   // round the ring: angle, size (laid in this order)
const FIRE_STICKS = [[-2.25, 1], [-0.85, 0.95], [0.4, 1.05], [1.95, 0.9], [-1.55, 0.85]];   // round the middle: angle, length (laid in this order)
const STONE_GREYS = [[168, 162, 150], [140, 136, 128], [184, 172, 152], [128, 128, 124], [196, 186, 168], [152, 146, 134]];
function paintFire(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const laying = n >= 32, step = n - 32;
  const bed = laying ? 0 : n >> 3, pile = laying ? 0 : (n >> 1) & 3, tinder = laying ? step >= LAY_STEPS : !!(n & 1);
  const stones = laying ? Math.min(6, step) : 6, sticks = laying ? clamp(step - 6, 0, 5) : [0, 2, 3, 5][pile];
  const F0 = FIRE_FOOT, [rx, ry] = FIRE_RING, h = k => hash2(n & 7, k, 917), burning = bed === 1, glowing = bed === 1 || bed === 2;
  softSpot(g, 0, F0 + 0.03, rx + 0.22, ry + 0.12, '34, 26, 16', 0.3);           // where it sits: its shadow, the trodden ground
  const bedPath = () => ovalAt(g, 0, F0, rx * 0.74, ry * 0.7);
  if (bed === 0) softIn(g, [104, 82, 58], F0 - ry, F0 + ry, bedPath, 1.1, 0.7);   // the earth scraped bare for it
  else if (bed === 3) {                                                            // grey ash, a few black bits in it
    softIn(g, [156, 150, 142], F0 - ry, F0 + ry, bedPath, 1.15, 0.72);
    for (let i = 0; i < 9; i++) fillIn(g, 'rgba(40, 34, 30, 0.75)', () => ovalAt(g, (h(i) - 0.5) * rx * 1.1, F0 + (h(10 + i) - 0.5) * ry * 0.9, 0.025 + 0.02 * h(20 + i), 0.015));
  } else {                                                                         // coals: dark, glowing red, brightest in the middle
    softIn(g, [72, 36, 24], F0 - ry, F0 + ry, bedPath, 1.1, 0.7);
    furGlow(g, burning ? [255, 128, 44] : [236, 92, 34], 0.95, 0, F0, rx * 0.55, ry * 0.48);
    for (let i = 0; i < 10; i++) {                                                 // the lumps of charcoal, rimmed with the glow
      const x = (h(30 + i) - 0.5) * rx * 1.15, y = F0 + (h(40 + i) - 0.5) * ry * 0.85, r = 0.035 + 0.025 * h(50 + i);
      fillIn(g, 'rgba(255, 150, 60, 0.85)', () => ovalAt(g, x, y + 0.004, r * 1.25, r * 0.78));
      fillIn(g, 'rgb(44, 30, 26)', () => ovalAt(g, x, y - 0.004, r, r * 0.6));
    }
  }
  const stone = k => {
    const [a, r] = FIRE_STONES[k], x = Math.cos(a) * rx, y = F0 + Math.sin(a) * ry, sx = r * (1.05 + 0.2 * h(60 + k)), sy = r * 0.66;
    const rgb = tone(STONE_GREYS[k], bed ? 0.86 + 0.14 * h(70 + k) : 0.92 + 0.16 * h(70 + k));
    fillIn(g, 'rgba(30, 26, 20, 0.35)', () => ovalAt(g, x + sx * 0.06, y + sy * 0.55, sx * 0.95, sy * 0.5));   // where it sits
    softIn(g, rgb, y - sy, y + sy, () => ovalAt(g, x, y, sx, sy, (h(80 + k) - 0.5) * 0.4), 1.3, 0.62);
    furGlow(g, [255, 252, 240], 0.42, x - sx * 0.3, y - sy * 0.42, sx * 0.4, sy * 0.25, -0.3);
    if (bed) fillIn(g, 'rgba(36, 28, 22, 0.28)', () => ovalAt(g, x * 0.86, y - (y - F0) * 0.2, sx * 0.55, sy * 0.55));   // blackened on its inside
    if (glowing) furGlow(g, [255, 150, 70], burning ? 0.6 : 0.4, x * 0.8, y - sy * 0.15 - (y - F0) * 0.25, sx * 0.55, sy * 0.45);   // lit from the fire's side
  };
  const top = F0 - 0.62 * (sticks >= 5 ? 1 : sticks >= 3 ? 0.85 : 0.62);           // the tepee's top
  const stick = i => {
    const [a, len] = FIRE_STICKS[i], bx = Math.cos(a) * rx * 0.52, by = F0 + Math.sin(a) * ry * 0.5;
    const tx = bx * 0.1 + 0.015, ty = top + (1 - len) * 0.12, rgb = burning ? tone([62, 44, 34], 0.85 + 0.3 * h(90 + i)) : tone([124, 90, 58], 0.85 + 0.3 * h(90 + i));
    twig(g, bx, by, tx, ty, (h(100 + i) - 0.5) * 0.06, 0.036 - 0.003 * i, rgb);
    if (burning) strokeIn(g, 'rgba(255, 136, 52, 0.75)', 0.022, () => { g.moveTo(bx, by); g.lineTo(bx + (tx - bx) * 0.32, by + (ty - by) * 0.32); });   // glowing at the foot
  };
  const stub = (x0, y0, x1, y1, i) => {                                            // a stick burnt down, lying in the ashes
    twig(g, x0, F0 + y0, x1, F0 + y1, 0.01, 0.034, tone([40, 30, 26], 0.9 + 0.2 * h(110 + i)));
    if (glowing) strokeIn(g, 'rgba(255, 120, 40, 0.8)', 0.016, () => { g.moveTo(x0 + (x1 - x0) * 0.6, F0 + y0 + (y1 - y0) * 0.6); g.lineTo(x1, F0 + y1); });
  };
  const behind = [], before = [];
  for (let k = 0; k < stones; k++) (Math.sin(FIRE_STONES[k][0]) < 0 ? behind : before).push(k);
  for (const k of behind) stone(k);
  if (!sticks && bed >= 2) { stub(-0.3, -0.03, 0.18, 0.05, 0); stub(0.26, -0.06, -0.12, 0.06, 1); }
  for (let i = 0; i < sticks; i++) if (Math.sin(FIRE_STICKS[i][0]) < 0) stick(i);
  if (tinder) {                                                                    // a tuft of tinder in the middle, pale gold
    for (let i = 0; i < 16; i++) {
      const t = i / 15, x0 = (t - 0.5) * 0.16, lean = (t - 0.5) * 2.2 + (h(120 + i) - 0.5) * 0.6, tall = 0.12 + 0.12 * h(130 + i);
      const x1 = x0 + lean * 0.1, y1 = F0 - tall * (1 - 0.3 * Math.abs(lean));
      strokeIn(g, rockRGB(tone(i % 3 ? [222, 196, 122] : [196, 156, 94], 0.82 + 0.3 * h(140 + i))), 0.018, () => { g.moveTo(x0, F0 + 0.01); g.quadraticCurveTo(x0 + lean * 0.03, (F0 + y1) / 2 - 0.03, x1, y1); });
    }
    furGlow(g, [255, 244, 200], 0.3, 0, F0 - 0.08, 0.12, 0.08);
  }
  for (let i = 0; i < sticks; i++) if (Math.sin(FIRE_STICKS[i][0]) >= 0) stick(i);
  for (const k of before) stone(k);
}
const firePx = z => Math.max(10, (8 + z) * FIRE_SIZE);
const fireLay = new Map();                // a fire being laid: when it began (ms), for its painting a piece at a time
function fireArt(F, now) {
  const t0 = fireLay.get(F);
  if (t0 !== undefined) {
    const step = Math.floor((now - t0) / LAY_MS);
    if (step < LAY_STEPS) return FIRE_ARTS[32 + Math.max(0, step)];
    fireLay.delete(F);
  }
  const sticks = F.fuel / S.FIRE_STICK, pile = F.fuel <= 0 ? 0 : sticks < 1.2 ? 1 : sticks < 3 ? 2 : 3;
  const bed = F.lit ? 1 : F.embers > 0 ? 2 : F.ash > 0.01 ? 3 : 0;
  return FIRE_ARTS[bed * 8 + pile * 2 + (F.tinder ? 1 : 0)];
}

// The flames: a few tongues of fire (TONGUES: where along its middle, how tall and wide of the whole, outer red, orange or
// the pale core), each painted once (FLAME_ART) and drawn stretched, swaying and flickering on a clock of its own.
const TONGUES = [[-0.62, 0.6, 0.78, 0], [0.6, 0.64, 0.8, 0], [0.05, 1, 1.1, 0], [-0.25, 0.66, 0.74, 1], [0.3, 0.58, 0.7, 1], [0.02, 0.4, 0.5, 2]];
let FLAME_ART = null;
function flameArt() {
  const W = 64, H = 128;
  FLAME_ART = [[[248, 110, 36], [214, 58, 24]], [[255, 184, 64], [250, 128, 40]], [[255, 246, 196], [255, 214, 120]]].map(([mid, edge], i) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.filter = 'blur(2px)';
    g.translate(W / 2, H - 8); g.scale(W * 0.42, H - 16);                // its foot at 0, 0, its tip at 0, -1, a half-width 1
    const gr = g.createLinearGradient(0, 0.05, 0, -1);
    gr.addColorStop(0, `rgba(${edge}, ${i ? 0.9 : 0.75})`); gr.addColorStop(0.22, `rgba(${mid}, 0.97)`);
    gr.addColorStop(0.7, `rgba(${mid}, ${i === 2 ? 0.9 : 0.85})`); gr.addColorStop(1, `rgba(${edge}, 0.25)`);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -1);
    g.bezierCurveTo(0.22, -0.66, 1, -0.44, 0.86, -0.15); g.bezierCurveTo(0.76, 0.03, 0.32, 0.07, 0, 0.07);
    g.bezierCurveTo(-0.32, 0.07, -0.76, 0.03, -0.86, -0.15); g.bezierCurveTo(-1, -0.44, -0.22, -0.66, 0, -1);
    g.fill();
    const art = { img: c, w: W, h: H, fx: W / 2, fy: H - 8, hw: W * 0.42, hh: H - 16 };
    asBitmap(c, b => { art.img = b; });
    return art;
  });
  return FLAME_ART;
}
// Its flames at sx, sy (the ground under its middle), px its size, heat 0 to 1 how big; seed: its own flicker.
function drawFlames(sx, sy, px, heat, now, seed) {
  const arts = FLAME_ART || flameArt(), t = now / 1000, H = px * FLAME_H * (0.3 + 0.7 * heat), W = px * 0.19 * (0.5 + 0.5 * heat);
  const fy = sy - px * 0.03, wind = fireWind() * 0.12;
  for (let i = 0; i < TONGUES.length; i++) {
    const [at, hk, wk, kind] = TONGUES[i], a = arts[kind];
    const fl = 0.8 + 0.2 * Math.sin(t * (6.1 + 0.9 * i) + seed + 2.1 * i) * Math.cos(t * (2.7 + 0.5 * i) + i);
    const h = H * hk * fl, w = W * wk * (0.92 + 0.08 * fl), sway = wind + 0.16 * Math.sin(t * (1.9 + 0.35 * i) + 1.3 * i + seed) + 0.06 * Math.sin(t * 7.3 + i);
    const bx = sx + at * W, ka = w / a.hw, kd = h / a.hh, kc = -sway * h / a.hh;   // (art pixels to screen: across, up, and the lean)
    ctx.setTransform(ka * dpr, 0, kc * dpr, kd * dpr, (bx - a.fx * ka - a.fy * kc) * dpr + shakeX, (fy - a.fy * kd) * dpr + shakeY);
    ctx.drawImage(a.img, 0, 0);
  }
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
}
// Which way the wind leans the flames and the smoke (-1 to 1), and how hard: a gentle drift east, harder in a storm.
const fireWind = () => { const m = ui.sky.mix; return 0.25 + 0.5 * (m.cloudy || 0) + 0.8 * (m.storm || 0) + 0.4 * (m.rain || 0) + 0.3 * (m.snow || 0); };

// Soft puffs: the smoke (grey, painted once) and a warm glow (the bloom over the flames, the embers, the sparks).
let SMOKE_ART = null, BLOOM_ART = null, LIGHT_ART = null, EMBER_ART = null;
function glowArt2(n, stops) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = c.height = n;
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (const [at, col] of stops) gr.addColorStop(at, col);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  const art = { img: c };
  asBitmap(c, b => { art.img = b; });
  return art;
}
const smokeArt = () => SMOKE_ART || (SMOKE_ART = glowArt2(64, [[0, 'rgba(206, 204, 202, 0.75)'], [0.5, 'rgba(196, 194, 194, 0.38)'], [1, 'rgba(190, 190, 192, 0)']]));
const bloomArt = () => BLOOM_ART || (BLOOM_ART = glowArt2(64, [[0, 'rgba(255, 214, 140, 0.9)'], [0.3, 'rgba(255, 150, 60, 0.45)'], [0.7, 'rgba(255, 110, 40, 0.12)'], [1, 'rgba(255, 100, 30, 0)']]));
const lightArt = () => LIGHT_ART || (LIGHT_ART = glowArt2(256, [[0, 'rgba(255, 176, 96, 1)'], [0.25, 'rgba(255, 158, 76, 0.8)'], [0.55, 'rgba(255, 138, 60, 0.35)'], [0.8, 'rgba(255, 128, 56, 0.1)'], [1, 'rgba(255, 128, 56, 0)']]));
const emberArt = () => EMBER_ART || (EMBER_ART = glowArt2(16, [[0, 'rgba(255, 246, 200, 1)'], [0.25, 'rgba(255, 190, 90, 0.95)'], [0.55, 'rgba(255, 120, 40, 0.4)'], [1, 'rgba(255, 90, 30, 0)']]));

// Its smoke: puffs coming up off it, spreading and drifting with the wind, each on its own clock (from a hash: nothing
// kept). amount 0 to 1: a fed fire a thin wisp, one burning low or smouldering more, the tinder being blown on most.
function drawSmoke(sx, sy, px, amount, now, seed) {
  if (amount < 0.02) return;
  const art = smokeArt(), t = now / 1000, wind = fireWind();
  for (let k = 0; k < SMOKES; k++) {
    const life = 2.4 + 1.2 * hash2(k, seed, 81), p = (t / life + hash2(k, seed, 82)) % 1, rise = p * px * (0.9 + 0.5 * hash2(k, seed, 83));
    const x = sx + px * (0.08 * Math.sin(p * 5 + k * 2) + wind * 0.55 * p * p), y = sy - px * 0.32 - rise, r = px * (0.07 + 0.26 * p);
    ctx.globalAlpha = Math.min(1, amount) * 0.42 * Math.sin(Math.PI * Math.min(1, p * 1.25)) * (1 - 0.4 * p);
    ctx.drawImage(art.img, x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

// What's drawn of it this frame: the flames' heat (the sim's, grown in as it takes, flaring as a stick goes on, and the
// little flames licking up once the spark has caught), the smoke, and the spark in the tinder while it's blown on.
const fireFlare = new Map();              // a fire lit or fed just now: when (ms), to grow in or flare
function fireShown(F, now) {
  const j = ui.fire, mine = j && j.F === F;
  let heat = S.fireHeat(F), smoke = 0, spark = 0;
  if (F.lit) {
    const t = fireFlare.get(F);
    if (t !== undefined) {
      const u = (now - t) / TAKE_MS;
      if (u >= 1.6) fireFlare.delete(F);
      else heat *= u < 1 ? 0.25 + 0.75 * u * u * (3 - 2 * u) + 0.25 * Math.sin(Math.PI * u) : 1 + 0.15 * Math.sin(Math.PI * (u - 1) / 0.6);
    }
    if (F === campShow.F) heat *= 1 + CAMP_FLARE * campCurve(now, CAMP_FLARE_MS);   // (making camp: it flares up)
    smoke = 0.25 + 0.6 * (1 - clamp(F.fuel / S.FIRE_LOW, 0, 1));
  } else {
    heat = 0;
    if (F.embers > 0) smoke = 0.35 * F.embers / S.FIRE_EMBERS;
  }
  if (mine && j.stage === 'blow') {
    spark = j.heat;
    smoke = Math.max(smoke, j.blowing ? 0.35 + 0.65 * j.heat : 0.2 * j.heat + j.puff);
    if (j.caught) heat = Math.max(heat, 0.16 + 0.06 * Math.sin(now / 90));
  }
  fireNow.heat = heat; fireNow.smoke = smoke; fireNow.spark = spark;
  return fireNow;
}
const fireNow = { heat: 0, smoke: 0, spark: 0 };
function drawFire(F, z, now) {
  const px = firePx(z), sx = (F.x - cam.x) * z + vw / 2, sy = (F.y - cam.y) * z + vh / 2;
  if (F.ghost) {                                           // where one would go (ui.place)
    ctx.globalAlpha = F.ok ? 0.6 : 0.3;
    drawEmoji(FIRE_ARTS[7], sx, sy - FIRE_FOOT * px / 2, px);
    ctx.globalAlpha = 1;
    return;
  }
  drawEmoji(fireArt(F, now), sx, sy - FIRE_FOOT * px / 2, px);
  const s = fireShown(F, now);
  if (s.heat > 0.02) drawFlames(sx, sy, px, s.heat, now, F.born % 97);
  if (s.smoke > 0.02) drawSmoke(sx, sy - (s.heat > 0.1 ? px * FLAME_H * 0.5 * s.heat : 0), px, s.smoke, now, F.born % 89);
}

// Over the dark: each fire's glow (the bloom over its flames, its embers glowing, the spark in the tinder), the embers
// drifting up off it and the sparks off the flint. Added on ('lighter'), dimmer by day.
const sparks = [];                        // a strike's sparks: { x, y (world), t0, dir }
function drawFireGlows(now, dark) {
  if (!world.fires.length && !sparks.length) return;
  const z = cam.zoom, px = firePx(z), night = 0.35 + 0.65 * clamp(dark / DARK, 0, 1), t = now / 1000;
  ctx.globalCompositeOperation = 'lighter';
  for (const F of world.fires) {
    const sx = (F.x - cam.x) * z + vw / 2, sy = (F.y - cam.y) * z + vh / 2;
    if (!visible(sx, sy, px * 2)) continue;
    const s = fireShown(F, now), hid = coverAt(sx, sy - px * 0.2, F.y);
    if (hid > 0.98) continue;
    const seen = 1 - hid;
    if (F === campShow.F && now - campShow.t0 < CAMP_PARTY_MS) campBurst(sx, sy, px, z, now, night, seen);
    if (s.heat > 0.02) {                                   // the bloom over the flames
      const r = px * (0.45 + 0.55 * s.heat) * (1 + 0.04 * Math.sin(t * 9 + F.born)), a = (0.32 + 0.4 * night) * Math.min(1, s.heat * 1.4) * seen;
      ctx.globalAlpha = a;
      ctx.drawImage(bloomArt().img, sx - r, sy - px * 0.18 * (0.5 + s.heat) - r, r * 2, r * 2);
      const e = emberArt().img, n = Math.round(EMBERS_UP * s.heat);   // the embers drifting up
      for (let k = 0; k < n; k++) {
        const life = 1.4 + 1.1 * hash2(k, F.born, 91), p = (t / life + hash2(k, F.born, 92)) % 1;
        const x = sx + px * ((hash2(k, F.born, 93) - 0.5) * 0.35 + 0.12 * Math.sin(p * 6 + k) + fireWind() * 0.3 * p);
        const y = sy - px * (0.12 + p * (0.9 + 0.5 * hash2(k, F.born, 94))), d = Math.max(2, px * 0.045) * (1 - 0.5 * p);
        ctx.globalAlpha = seen * (0.55 + 0.45 * night) * (1 - p) * Math.min(1, p * 6) * (0.6 + 0.4 * Math.sin(t * 11 + k));
        ctx.drawImage(e, x - d, y - d, d * 2, d * 2);
      }
    } else if (F.embers > 0) {                             // the embers glowing in the ashes, breathing
      const a = (0.25 + 0.5 * night) * Math.min(1, 0.4 + F.embers / S.FIRE_EMBERS) * (0.75 + 0.25 * Math.sin(t * 1.7 + F.born)) * seen, r = px * 0.32;
      ctx.globalAlpha = a;
      ctx.drawImage(bloomArt().img, sx - r, sy - r * 0.75, r * 2, r * 1.3);
    }
    if (s.spark > 0) {                                     // the spark in the tinder, brighter as it's blown on
      const r = px * (0.06 + 0.12 * s.spark) * (ui.fire.blowing ? 1 + 0.15 * Math.sin(t * 14) : 1);
      ctx.globalAlpha = (0.55 + 0.45 * s.spark) * seen;
      ctx.drawImage(bloomArt().img, sx - r * 2, sy - px * 0.07 - r * 2, r * 4, r * 4);
      ctx.drawImage(emberArt().img, sx - r, sy - px * 0.07 - r, r * 2, r * 2);
    }
  }
  if (sparks.length) {                                     // a strike's sparks: quick bright specks flying out and falling
    const e = emberArt().img;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i], u = (now - sp.t0) / 380;
      if (u >= 1) { sparks.splice(i, 1); continue; }
      const sx = (sp.x - cam.x) * z + vw / 2, sy = (sp.y - cam.y) * z + vh / 2;
      for (let k = 0; k < 7; k++) {
        const a = sp.dir + (hash2(k, sp.t0 | 0, 95) - 0.5) * 2.2, v = px * (0.25 + 0.35 * hash2(k, sp.t0 | 0, 96)), q = u * (0.6 + 0.4 * hash2(k, sp.t0 | 0, 97));
        const x = sx + Math.cos(a) * v * q, y = sy - Math.sin(a) * v * q * 0.6 + px * 0.5 * q * q, d = Math.max(1.5, px * 0.03) * (1 - q);
        ctx.globalAlpha = (1 - q) * 0.95;
        ctx.drawImage(e, x - d, y - d, d * 2, d * 2);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// The light the fires cast this frame: where, how far and how bright (on screen), for the warm light laid over what stands
// about them (fireLight) and the pool cut out of the dark (laySky, SKY_FIRE). In the dark it flickers in steps
// (FLICKER_MS), so the sky's picture is painted again only on a step, or when the camera moves.
const lights = { n: 0, x: new Float64Array(4), y: new Float64Array(4), r: new Float64Array(4), a: new Float64Array(4) };
function lightsFrame(now) {
  lights.n = 0;
  if (!world.fires.length) return;
  const z = cam.zoom, step = Math.floor(now / FLICKER_MS);
  for (const F of world.fires) {
    const s = fireShown(F, now), glow = Math.max(s.heat, F.lit ? 0 : F.embers > 0 ? 0.22 * F.embers / S.FIRE_EMBERS : 0, s.spark * 0.25);
    if (glow < 0.02 || lights.n >= 4) continue;
    const r = LIGHT_TILES * z * Math.sqrt(Math.min(1.15, glow)) * (0.6 + 0.4 * Math.min(1.15, glow)) * (F === campShow.F ? 1 + CAMP_BLOOM * campCurve(now, CAMP_BLOOM_MS) : 1);
    const sx = (F.x - cam.x) * z + vw / 2, sy = (F.y - cam.y) * z + vh / 2;
    if (!visible(sx, sy, r)) continue;
    const fl = 0.5 + 0.3 * Math.sin(step * 1.7 + F.born) + 0.2 * Math.sin(step * 0.53 + 2 * F.born), i = lights.n++;
    lights.x[i] = sx; lights.y[i] = sy - firePx(z) * 0.12; lights.r[i] = r * (0.95 + 0.05 * fl); lights.a[i] = Math.min(1, glow) * (0.9 + 0.1 * fl);
  }
}
// The warm light laid over what's drawn about each fire (source-atop: only over what's there, so the trees, the animals and
// the forager are lit warm, more on the side toward it), stronger in the dark.
function fireLight(dark) {
  if (!lights.n) return;
  const art = lightArt(), night = clamp(dark / DARK, 0, 1);
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < lights.n; i++) {
    const r = lights.r[i] * 0.85, x = lights.x[i], y = lights.y[i];
    ctx.globalAlpha = lights.a[i] * (0.06 + 0.24 * night);
    ctx.drawImage(art.img, x - r, y - r * LIGHT_FLAT, r * 2, r * 2 * LIGHT_FLAT);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
// Cut out of the dark on the sky's picture (laySky): the dark goes, and a warm glow comes in its place, by the fire. Both
// are pictures painted once (CUT_ART, lightArt), laid flat on the ground (LIGHT_FLAT).
let CUT_ART = null;
const cutArt = () => CUT_ART || (CUT_ART = glowArt2(128, [[0, 'rgba(0, 0, 0, 1)'], [0.35, 'rgba(0, 0, 0, 0.82)'], [0.7, 'rgba(0, 0, 0, 0.42)'], [0.88, 'rgba(0, 0, 0, 0.14)'], [1, 'rgba(0, 0, 0, 0)']]));
function paintFireLights(g) {
  const cut = cutArt().img, warm = lightArt().img;
  for (let i = 0; i < lights.n; i++) {
    const x = lights.x[i], y = lights.y[i], r = lights.r[i], a = lights.a[i];
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.85 * a;
    g.drawImage(cut, x - r, y - r * LIGHT_FLAT, r * 2, r * 2 * LIGHT_FLAT);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.26 * a;
    g.drawImage(warm, x - r * 0.8, y - r * 0.8 * LIGHT_FLAT, r * 1.6, r * 1.6 * LIGHT_FLAT);
  }
  g.globalAlpha = 1;
}

// ---- making camp (PLAN.md stage 5)
//
// Lighting the meadow's first fire makes camp (sim.js campAt, event 'camp'), and it's a big moment (campMoment): the flame
// flares (fireShown), its light blooms out over the clearing (lightsFrame, and a warm bloom laid over it by day as by night,
// campBurst) with a burst of sparks, twinkles, a wave of light and rising motes (campBurst), a warm flourish on the felt piano (sound.js camp), the
// camera eases in a little and leans to the fire (campCam, in leadCam), "Your camp" fades in and out over the meadow (announce
// 'camp'), and a phone that can buzzes (navigator.vibrate: Android; an iPhone's web page can't). From then on a soft ring of
// trodden earth lies round the fire, sim.js CAMP_R out (drawCampRing, CAMP_ART painted once), where later builds will go.
const CAMP_FLARE = 0.55, CAMP_FLARE_MS = 2800;      // the flames flare this much bigger, and back over this long
const CAMP_BLOOM = 0.45, CAMP_BLOOM_MS = 4500;      // its light reaches this much further, and back over this long
const CAMP_SPARKS = 48;                            // sparks and embers in the first whoosh of the burst
const CAMP_ZOOM = 0.16, CAMP_LEAN = 0.6;           // the camera eases this much closer, and this far over to the fire
const CAMP_IN = 1500, CAMP_HOLD = 3800, CAMP_OUT = 2600;   // ms: easing in, holding, easing back
const CAMP_NEAR = 10;                              // tiles: a friend's first fire further off than this only gets the words
const CAMP_WORDS_MS = 650;                         // "Your camp" this long after the flare
const CAMP_RING_IN = 1600, CAMP_RING_MS = 3200;    // the ring comes in this long after, over this long
const CAMP_BUZZ = [35, 70, 35, 70, 110];           // ms buzzing and not
const campShow = { F: null, t0: -1e9, z0: 0, z: 0 };
// Up quickly to 1, then easing back to 0 over ms.
function campCurve(now, ms) {
  const u = (now - campShow.t0) / ms;
  return u <= 0 || u >= 1 ? 0 : u < 0.12 ? ease(u / 0.12) : (1 - (u - 0.12) / 0.88) ** 2;
}
function campMoment(F) {
  const now = performance.now(), f = world.forager, mine = !!(ui.fire && ui.fire.F === F), near = mine || Math.hypot(F.x - f.x, F.y - f.y) < CAMP_NEAR;
  campShow.F = F; campShow.t0 = now;
  campShow.z0 = near && f.down < 0 ? cam.zoom : 0; campShow.z = cam.zoom;
  if (!mine && near) fireFlare.set(F, now);
  chime('camp');
  if (mine) try { navigator.vibrate?.(CAMP_BUZZ); } catch (e) { /* fine */ }
  setTimeout(() => {
    if (!(world.camp && world.camp.fire === F) || world.forager.down >= 0) return;
    announce('camp', `<small>${mine ? 'the first fire' : 'a friend lit the first fire'}</small><b class="fr">Your camp</b>`, 'You’ll wake here, by the fire.');
  }, CAMP_WORDS_MS);
}
// How far the camera has eased in (0 to 1), setting the zoom: in, held, back to where it was. A zoom of your own meanwhile
// ends it there.
function campCam(now) {
  const c = campShow;
  if (!c.z0) return 0;
  const u = now - c.t0;
  if (cam.zoom !== c.z || u >= CAMP_IN + CAMP_HOLD + CAMP_OUT) { if (cam.zoom === c.z) cam.zoom = c.z0; c.z0 = 0; return 0; }
  const k = u < CAMP_IN ? smooth(0, CAMP_IN, u) : 1 - smooth(CAMP_IN + CAMP_HOLD, CAMP_IN + CAMP_HOLD + CAMP_OUT, u);
  cam.zoom = c.z = Math.min(64, c.z0 * (1 + CAMP_ZOOM * k));
  return k;
}
// The burst as camp is made, all over the dark and added on ('lighter': drawFireGlows), each piece on its own course (hashed,
// nothing kept): a warm bloom over the clearing; a whoosh of sparks and embers flung up out of the flames, then a second
// fountain of them higher still, slowing, drifting on the wind and going out; little four-pointed stars twinkling in the air
// over the fire; a wave of light running out over the ground to where the ring will lie; and as the ring comes in, golden
// motes rising off all round it like fireflies. About a hundred and sixty small draws a frame, for a few seconds, once.
const CAMP_PARTY_MS = 7600;                        // it's all done by this long after
const CAMP_POP = 36, CAMP_POP_AT = 650;            // the second fountain's sparks, and when it goes up (ms)
const CAMP_STARS = 26, CAMP_MOTES = 56;            // twinkles over the fire; motes rising off the ring
const CAMP_WAVE_AT = 250, CAMP_WAVE_MS = 1700;     // the wave of light along the ground: when, and how long it takes to run out
let STAR_ART = null, WAVE_ART = null;
function starArt() {                               // a soft four-pointed twinkle, painted once
  if (STAR_ART) return STAR_ART;
  const n = 64, c = document.createElement('canvas'), g = c.getContext('2d'), dot = glowArt2(32, [[0, 'rgba(255, 250, 225, 1)'], [0.35, 'rgba(255, 214, 130, 0.7)'], [1, 'rgba(255, 170, 70, 0)']]).img;
  c.width = c.height = n;
  g.drawImage(dot, n / 2 - 3, 0, 6, n); g.drawImage(dot, 0, n / 2 - 3, n, 6);
  g.drawImage(dot, n / 2 - 12, n / 2 - 12, 24, 24);
  STAR_ART = { img: c };
  asBitmap(c, b => { STAR_ART.img = b; });
  return STAR_ART;
}
function waveArt() {                               // a soft band of light round in a circle (drawn flattened), painted once
  if (WAVE_ART) return WAVE_ART;
  WAVE_ART = glowArt2(256, [[0, 'rgba(255, 170, 80, 0)'], [0.62, 'rgba(255, 170, 80, 0)'], [0.84, 'rgba(255, 200, 120, 0.85)'], [0.93, 'rgba(255, 160, 70, 0.3)'], [1, 'rgba(255, 140, 60, 0)']]);
  return WAVE_ART;
}
function campBurst(sx, sy, px, z, now, night, seen) {
  const ms = now - campShow.t0, u = ms / CAMP_BLOOM_MS, R = LIGHT_TILES * z * (0.5 + 0.7 * ease(Math.min(1, u * 2.2)));
  if (u < 1) {
    ctx.globalAlpha = seen * (0.1 + 0.12 * night) * Math.min(1, u * 10) * (1 - u) ** 1.6;
    ctx.drawImage(lightArt().img, sx - R, sy - R * LIGHT_FLAT, R * 2, R * 2 * LIGHT_FLAT);
  }
  const wq = (ms - CAMP_WAVE_AT) / CAMP_WAVE_MS;   // the wave running out over the ground
  if (wq > 0 && wq < 1) {
    const r = S.CAMP_R * z * 1.08 * (1 - (1 - wq) ** 2.2);
    ctx.globalAlpha = seen * (0.7 + 0.3 * night) * Math.min(1, wq * 6) * (1 - wq) ** 1.1;
    ctx.drawImage(waveArt().img, sx - r, sy - r * S.CAMP_FLAT, r * 2, r * 2 * S.CAMP_FLAT);
  }
  const e = emberArt().img, wind = fireWind(), seed = campShow.t0 | 0, bright = 0.75 + 0.25 * night;
  for (let k = 0; k < CAMP_SPARKS + CAMP_POP; k++) {   // the sparks: the whoosh, then the second fountain higher
    const pop = k >= CAMP_SPARKS, life = (pop ? 1500 : 900) + 1700 * hash2(k, seed, 61), q = (ms - (pop ? CAMP_POP_AT : 0) - 120 * hash2(k, seed, 62)) / life;
    if (q <= 0 || q >= 1) continue;
    const a = -Math.PI / 2 + (hash2(k, seed, 63) - 0.5) * (pop ? 1.5 : 2.6), v = (pop ? 1.8 : 0.9) + (pop ? 1.4 : 1.8) * hash2(k, seed, 64), out = 1 - (1 - q) ** 3;
    const x = sx + px * (Math.cos(a) * v * out * 0.8 + wind * 0.5 * q * q + 0.08 * Math.sin(q * 9 + k));
    const y = sy - px * 0.3 + px * (Math.sin(a) * v * out + (pop ? 0.9 : 0.35) * q * q - (pop ? 0 : 0.35 * q));
    const d = Math.max(2, px * (k % 3 ? 0.06 : 0.1)) * (1 - 0.5 * q);
    ctx.globalAlpha = seen * bright * (1 - q) ** 1.3 * (0.7 + 0.3 * Math.sin(now / 45 + k * 1.7));
    ctx.drawImage(e, x - d, y - d, d * 2, d * 2);
  }
  const st = starArt().img;                        // the twinkles over the fire, each coming and going once or twice
  for (let k = 0; k < CAMP_STARS; k++) {
    const t0 = 300 + 2600 * hash2(k, seed, 71), life = 700 + 700 * hash2(k, seed, 72), q = (ms - t0) / life;
    if (q <= 0 || q >= 1) continue;
    const a = hash2(k, seed, 73) * Math.PI * 2, r = 0.4 + 1.6 * Math.sqrt(hash2(k, seed, 74));
    const x = sx + px * Math.cos(a) * r * 1.2, y = sy - px * (1.1 + 0.9 * hash2(k, seed, 75)) + px * Math.sin(a) * r * 0.6 - px * 0.25 * q;
    const d = px * (0.22 + 0.2 * hash2(k, seed, 76)) * Math.sin(q * Math.PI) * (0.8 + 0.2 * Math.sin(now / 70 + k));
    ctx.globalAlpha = seen * Math.sin(q * Math.PI);
    ctx.drawImage(st, x - d, y - d, d * 2, d * 2);
  }
  const rx = S.CAMP_R * z, ry = rx * S.CAMP_FLAT;   // the motes rising off the ring as it comes in, swaying, twinkling
  for (let k = 0; k < CAMP_MOTES; k++) {
    const t0 = CAMP_RING_IN + 2400 * hash2(k, seed, 81), life = 2200 + 1800 * hash2(k, seed, 82), q = (ms - t0) / life;
    if (q <= 0 || q >= 1) continue;
    const a = (k + hash2(k, seed, 83)) / CAMP_MOTES * Math.PI * 2, rise = z * (1 + 1.4 * hash2(k, seed, 84)) * (1 - (1 - q) ** 1.6);
    const x = sx + Math.cos(a) * rx + z * 0.25 * Math.sin(q * 5 + k * 2.3) + wind * z * 0.4 * q;
    const y = sy + Math.sin(a) * ry - rise;
    const d = Math.max(2.5, z * 0.15) * (0.8 + 0.4 * hash2(k, seed, 85));
    ctx.globalAlpha = seen * Math.min(1, q * 5) * (1 - q * q) * (0.6 + 0.4 * Math.sin(now / 160 + k * 2.1));
    ctx.drawImage(e, x - d, y - d, d * 2, d * 2);
  }
}
// The camp's ring: a soft band of trodden earth round the fire, worn unevenly, a few small stones along it. Painted once,
// big (it's soft, so it stretches), drawn flat on the ground under all that stands; it comes in a moment after camp is made.
let CAMP_ART = null;
const CAMP_PX = 512, CAMP_MID = 0.84;    // the painting's width, and the ring's middle in it (of its half-width)
function campArt() {
  const c = document.createElement('canvas'), W = CAMP_PX, H = Math.round(CAMP_PX * S.CAMP_FLAT), g = c.getContext('2d');
  c.width = W; c.height = H;
  const R = W / 2 * CAMP_MID, k = R / S.CAMP_R;           // (k: px a tile)
  const dot = document.createElement('canvas');            // one soft dab of earth
  dot.width = dot.height = 32;
  const dg = dot.getContext('2d'), gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(92, 70, 46, 1)'); gr.addColorStop(0.5, 'rgba(92, 70, 46, 0.5)'); gr.addColorStop(1, 'rgba(92, 70, 46, 0)');
  dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 420; i++) {                          // the worn band, heavier in some stretches than others
    const a = i / 420 * Math.PI * 2 + (hash2(i, 3, 711) - 0.5) * 0.03, wear = 0.55 + 0.45 * Math.sin(a * 3 + 1.1) * Math.sin(a * 5 + 0.4);
    const r = R + (hash2(i, 4, 711) - 0.5) * k * 0.3, d = k * (0.16 + 0.14 * hash2(i, 5, 711));
    g.globalAlpha = (0.05 + 0.07 * wear) * (0.6 + 0.4 * hash2(i, 6, 711));
    g.drawImage(dot, W / 2 + Math.cos(a) * r - d, H / 2 + Math.sin(a) * r * S.CAMP_FLAT - d * S.CAMP_FLAT, d * 2, d * 2 * S.CAMP_FLAT);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {                           // small stones along it, here and there
    const a = (i + hash2(i, 7, 711) * 0.7) / 16 * Math.PI * 2, r = R + (hash2(i, 8, 711) - 0.5) * k * 0.28;
    const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * S.CAMP_FLAT, sz = k * (0.045 + 0.04 * hash2(i, 9, 711));
    const rgb = tone(STONE_GREYS[i % STONE_GREYS.length], 0.9 + 0.2 * hash2(i, 10, 711));
    g.fillStyle = 'rgba(40, 30, 20, 0.3)'; g.beginPath(); g.ellipse(x + sz * 0.15, y + sz * 0.35, sz * 1.1, sz * 0.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.ellipse(x, y, sz, sz * 0.68, hash2(i, 11, 711) - 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255, 252, 240, 0.35)'; g.beginPath(); g.ellipse(x - sz * 0.3, y - sz * 0.25, sz * 0.4, sz * 0.22, -0.3, 0, Math.PI * 2); g.fill();
  }
  CAMP_ART = { img: c, w: W, h: H };
  asBitmap(c, b => { CAMP_ART.img = b; });
  return CAMP_ART;
}
function drawCampRing(z, now) {
  const C = world.camp;
  if (!C) return;
  const a = C.fire === campShow.F ? smooth(campShow.t0 + CAMP_RING_IN, campShow.t0 + CAMP_RING_IN + CAMP_RING_MS, now) : 1;
  const art = CAMP_ART || campArt(), w = S.CAMP_R * z / CAMP_MID * 2, h = w * art.h / art.w, sx = (C.x - cam.x) * z + vw / 2, sy = (C.y - cam.y) * z + vh / 2;
  if (a <= 0 || !visible(sx, sy, w / 2)) return;
  ctx.globalAlpha = a;
  ctx.drawImage(art.img, sx - w / 2, sy - h / 2, w, h);
  ctx.globalAlpha = 1;
}

// ---- building and tending it

// How much of a build's needs the satchel holds: each need (word, n) and how many of it there are (have), and the share of
// it all, 0 to 1 (renderBuild's ring).
function buildHave(id) {
  const b = Recipes.BUILDS[id], F = world.forager, out = { all: 0, got: 0, ready: true, any: false, missing: [] };
  for (const [word, n] of Object.entries(b.needs)) {
    let have = 0;
    for (const ing of Recipes.takes(word)) have += S.bagCount(F, ing);
    out.all += n; out.got += Math.min(n, have);
    if (have) out.any = true;
    if (have < n) { out.ready = false; out.missing.push([word, n - have]); }
  }
  return out;
}
// "3 more pebbles and 1 more tinder": what's missing, in words.
function missingWords(missing) {
  const words = missing.map(([word, n]) => `${n} more ${Recipes.INGREDIENTS[word] ? itemName(word, n).toLowerCase() : word}`);
  return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0];
}
// Takes what a build needs out of the satchel: { fuel, tinder } (how many sticks and how much tinder went in), or null.
function spendBuild(id) {
  const b = Recipes.BUILDS[id], F = world.forager;
  if (!buildHave(id).ready) return null;
  const got = { fuel: 0, tinder: 0 };
  for (const [word, n] of Object.entries(b.needs)) {
    let left = n;
    for (const ing of Recipes.takes(word)) {
      const took = S.spend(F, ing, left);
      left -= took;
      const tags = Recipes.INGREDIENTS[ing].tags;
      if (tags.includes('fuel')) got.fuel += took;
      if (tags.includes('tinder')) got.tinder += took;
    }
  }
  renderSatchel();
  return got;
}
// One of a tag out of the satchel (a tinder, a stick for the fire), or false.
function spendTag(tag) {
  for (const ing of Recipes.takes(tag)) if (S.spend(world.forager, ing, 1)) { renderSatchel(); return true; }
  return false;
}
const hasTag = tag => Recipes.takes(tag).some(ing => S.bagCount(world.forager, ing) > 0);

// The fire button, by the satchel: shown once the satchel holds any of what a fire takes (or while placing one), with a
// ring round it filling in as it holds more; all there, it glows. Its words say what's still wanting.
const buildUi = { shown: false, ready: false, got: -1 };
function renderBuild() {
  const el = $('#build');
  if (!el || !world) return;
  const have = buildHave(BUILD), show = have.any || !!ui.place, k = have.all ? have.got / have.all : 0;
  if (show !== buildUi.shown) { el.classList.toggle('hidden', !show); buildUi.shown = show; }
  if (have.ready !== buildUi.ready) { el.classList.toggle('ready', have.ready); buildUi.ready = have.ready; }
  el.classList.toggle('on', !!ui.place);
  if (have.got !== buildUi.got) {
    buildUi.got = have.got;
    el.style.setProperty('--k', k.toFixed(3));
    const b = Recipes.BUILDS[BUILD], needs = Object.entries(b.needs).map(([w, n]) => `${n} ${Recipes.INGREDIENTS[w] ? itemName(w, n).toLowerCase() : w}`).join(', ');
    el.title = have.ready ? `Make a campfire (F)` : `A campfire takes ${needs}: still ${missingWords(have.missing)}`;
    el.setAttribute('aria-label', el.title);
  }
}
// The fire button's painting: a laid campfire, painted once.
function buildIcon() {
  const el = $('#build i');
  if (!el || el.dataset.done) return;
  const c = document.createElement('canvas'), px = 44, size = Math.ceil(px * 1.3 * dpr);
  c.width = c.height = size;
  paintFire(c.getContext('2d'), size, px * dpr, 7);
  el.style.backgroundImage = `url(${c.toDataURL()})`;
  el.dataset.done = '1';
}
// Pressed: ready, it picks a spot for one (pressed again, it lets it be); not yet, it says what's still wanting.
function buildPressed() {
  if (!world || world.forager.down >= 0) return;
  if (ui.place) { placeFire(false); return; }
  const have = buildHave(BUILD), F = world.forager;
  if (!have.ready) { say(`A campfire needs ${missingWords(have.missing)}`, F.x, F.y - 1.6); chime('click'); return; }
  placeFire(true);
}

// Picking where: a faint fire in front of the forager (a mouse moves it about; a finger taps or drags it where it's
// wanted) within PLACE_REACH, and a click or a tap lays it there. One where it can't go is fainter, and a click there
// says why.
function placeFire(open) {
  if (!open) { ui.place = null; renderBuild(); return; }
  const F = world.forager, a = F.heading;
  ui.place = { x: F.x, y: F.y, ok: false, why: '', ghost: true, fire: true };
  placeAt(F.x + Math.cos(a) * 1.4, F.y + Math.sin(a) * 1.4 * 0.9 + 0.2);
  chime('click');
  renderBuild();
}
function placeAt(x, y) {
  const P = ui.place, F = world.forager, d = Math.hypot(x - F.x, y - F.y);
  if (d > PLACE_REACH) { x = F.x + (x - F.x) * PLACE_REACH / d; y = F.y + (y - F.y) * PLACE_REACH / d; }
  P.x = x; P.y = y; P.why = S.fireSpot(world, x, y);
  if (!P.why && !standAt(x, y, F.x)) P.why = 'No room to kneel by it';
  P.ok = !P.why;
}
function placeHere(sx, sy) {
  const P = ui.place;
  if (sx !== undefined) placeAt(...toWorld(sx, sy));
  if (!P.ok) { say(P.why, P.x, P.y); chime('click'); return; }
  ui.place = null;
  goFire({ kind: 'build', F: null, x: P.x, y: P.y });
  renderBuild();
}
// Where the forager kneels to see to a fire at x, y: at its side, the one toward from (its x), or the other if that's
// in the water; null with neither.
const standPt = [0, 0];
function standAt(x, y, from) {
  for (const s of from <= x ? [-1, 1] : [1, -1]) {
    const sx = x + s * STAND_OFF, sy = y + 0.06;
    if (S.walkable(world, sx, sy) && !world.water[(sy | 0) * S.W + (sx | 0)]) { standPt[0] = sx; standPt[1] = sy; return standPt; }
  }
  return null;
}

// Off to see to a fire (or lay one): it walks to its side, and fireFrame takes it from there. t: { kind, F, x, y }.
function goFire(t) {
  const f = world.forager;
  if (f.down >= 0) return;
  const at = standAt(t.x, t.y, f.x);
  if (!at) { say('No room to kneel by it', t.x, t.y); return; }
  const [x, y] = at;
  walkTo(...toScreen(x, y));
  ui.fire = { kind: t.kind, F: t.F, x: t.x, y: t.y, sx: x, sy: y, stage: 'go', t0: performance.now(), step: -1, heat: 0, blowing: false, caught: 0,
    puff: 0, breath: 0, blownAt: 0, held: 0 };
}
// The fire under a point on screen (its ring as drawn, a little wider for a finger), or null.
function fireAt(sx, sy) {
  const z = cam.zoom, px = firePx(z), f = fingerTap ? 1.5 : 1;
  let best = null, bd = 1;
  for (const F of world.fires) {
    const x = (F.x - cam.x) * z + vw / 2, y = (F.y - cam.y) * z + vh / 2 - px * 0.12;
    const d = ((sx - x) / Math.max(14 * f, px * 0.48)) ** 2 + ((sy - y) / Math.max(12 * f, px * 0.32)) ** 2;
    if (d < bd) { best = F; bd = d; }
  }
  return best;
}
// How a fire is and what it wants, in a few words: its hover line (drawHoverLine).
function fireWord(F) {
  const n = world.camp && world.camp.fire === F ? 'Your camp' : 'Campfire';
  if (F.lit) return F.fuel < S.FIRE_LOW ? `${n} · burning low: it wants sticks` : S.fireRoom(F) ? `${n} · burning well` : `${n} · burning well, full`;
  if (F.embers > 0) return F.fuel > 0 ? `${n} · embers: blow on them` : `${n} · embers: a stick on, and a blow`;
  if (S.lightable(F)) return `${n} · laid, ready to light`;
  return F.fuel > 0 ? `${n} · cold: it wants tinder` : `${n} · cold: it wants tinder and sticks`;
}
// A fire burnt down, gone cold or put out (sim.js events): a line by it, if it's in sight.
const FIRE_TELLS = { fireout: 'Burnt down to embers', firecold: 'The embers have gone cold', firedoused: 'The water put it out' };
function fireTell(e) {
  const F = e.fire, [sx, sy] = toScreen(F.x, F.y);
  if (!visible(sx, sy, 0)) return;
  say(FIRE_TELLS[e.type], F.x, F.y - 0.4);
  if (e.type !== 'firecold') hear('fizzle', F.x, F.y);
}
// A click or a tap on a fire: off to see to it, if there's something to do with what the satchel holds; else why not.
function clickFire(F) {
  const sticks = hasTag('fuel'), tinder = hasTag('tinder');
  let kind = '';
  if (F.lit) kind = sticks && S.fireRoom(F) ? 'feed' : '';
  else if (F.embers > 0) kind = F.fuel > 0 ? 'blow' : sticks ? 'feed' : '';
  else if (S.lightable(F)) kind = 'light';
  else if (tinder && (F.fuel > 0 || sticks)) kind = 'relay';
  if (!kind) {
    const why = F.lit ? (S.fireRoom(F) ? 'No sticks in the satchel' : 'Burning well: it\'s full')
      : F.embers > 0 ? 'Embers: it needs a stick' : F.fuel > 0 ? 'It needs tinder to light' : !tinder && !sticks ? 'It needs tinder and sticks' : !tinder ? 'It needs tinder to light' : 'It needs sticks';
    const [sx, sy] = toScreen(F.x, F.y), near = Math.hypot(F.x - world.forager.x, F.y - world.forager.y) < 2.5;
    say(why, F.x, F.y - 0.4);
    if (!near) walkTo(sx + (world.forager.x < F.x ? -1 : 1) * STAND_OFF * cam.zoom, sy);
    return;
  }
  goFire({ kind, F, x: F.x, y: F.y });
}

// Once a frame: the job at the fire, ui.fire. 'go': walking there; then 'lay' (a new one, a piece at a time), 'feed' (a
// stick on), 'strike' (the flint and steel), 'blow' (held: bent down blowing on the spark), 'lit' (watching it take).
function fireFrame(now, dt) {
  const j = ui.fire, f = world.forager;
  if (!j) { sitFrame(now); return; }
  if (f.down >= 0) { ui.fire = null; return; }
  if (j.stage === 'go') {
    if (f.walking) return;
    if (Math.hypot(f.x - j.sx, f.y - j.sy) > 0.6) { say('Can\'t get there', j.x, j.y); ui.fire = null; return; }
    if (j.F && !world.fires.includes(j.F)) { ui.fire = null; return; }
    fg.flip = j.x > f.x;                                  // it turns to the fire, and kneels
    if (j.kind === 'build') {
      const why = S.fireSpot(world, j.x, j.y), got = !why && spendBuild(BUILD);
      if (!got) { say(why || 'Something\'s missing', j.x, j.y); ui.fire = null; renderBuild(); return; }
      j.F = S.layFire(world, j.x, j.y, got.fuel, got.tinder);
      fireLay.set(j.F, now);
      sendFire('lay', j.F, got.fuel, got.tinder);
      renderBuild();
      fireStage(j, 'lay', now);
    } else if (j.kind === 'relay') {                      // a cold one: tinder in, and sticks if it has none
      const sticks = j.F.fuel > 0 ? 0 : Math.min(2, Recipes.takes('fuel').reduce((n, ing) => n + S.bagCount(f, ing), 0));
      if (!spendTag('tinder')) { ui.fire = null; return; }
      for (let k = 0; k < sticks; k++) spendTag('fuel');
      S.feedFire(world, j.F, sticks, 1);
      sendFire('feed', j.F, sticks, 1);
      fireStage(j, 'feed', now);
    } else if (j.kind === 'feed') fireStage(j, 'feed', now);
    else if (j.kind === 'light') fireStage(j, 'strike', now);
    else fireStage(j, 'blow', now);
    return;
  }
  const u = now - j.t0;
  if (j.stage === 'lay') {
    const step = Math.floor(u / LAY_MS);
    if (step !== j.step && step < LAY_STEPS) { j.step = step; chime(step < 6 ? 'clack' : step < 11 ? 'stick' : 'tinder'); }
    if (step >= LAY_STEPS) fireStage(j, 'strike', now);
  } else if (j.stage === 'feed') {
    if (j.step < 0 && u > FEED_MS * FEED_AT) {
      j.step = 0;
      if (j.kind === 'feed' && spendTag('fuel')) { const n = S.feedFire(world, j.F, 1, 0); sendFire('feed', j.F, n, 0); }
      fireFlare.set(j.F, j.F.lit ? now - TAKE_MS : now);    // (lit, a flare)
      chime('stick');
    }
    if (u > FEED_MS) {
      if (j.F.lit) { ui.fire = null; return; }
      fireStage(j, S.lightable(j.F) ? (j.F.embers > 0 ? 'blow' : 'strike') : 'done', now);
      if (j.stage === 'done') ui.fire = null;
    }
  } else if (j.stage === 'strike') {
    const k = Math.floor(u / STRIKE_MS), most = STRIKES + (S.FIRE_WET[world.weather.kind] ? 1 : 0);
    if (k >= most) { fireStage(j, 'blow', now); return; }
    if (u - k * STRIKE_MS > STRIKE_MS * STRIKE_UP && j.step !== k) {   // struck: sparks off it, into the tinder
      j.step = k;
      sparks.push({ x: j.x + (j.sx < j.x ? -0.12 : 0.12), y: j.y - 0.05, t0: now, dir: j.sx < j.x ? 0.6 : Math.PI - 0.6 });
      hear('strike', j.x, j.y, { n: k }, true);
    }
  } else if (j.stage === 'blow') blowFrame(j, now, dt);
  else if (j.stage === 'lit') { if (u > LIT_MS) ui.fire = null; }
}
function fireStage(j, stage, now) {
  j.stage = stage; j.t0 = now; j.step = -1;
  if (stage === 'blow') { j.heat = j.F && j.F.embers > 0 ? BLOW_EMBERS : BLOW_FLOOR; j.caught = 0; j.blowing = blowHeld(); j.breath = now; j.blownAt = -1; j.puff = 0; }
}
// Held to blow: a breath at a time, the spark warming while it blows out, and cooling between blows; caught, let go (or
// held on a moment) and the flame takes. Let go before it's caught, it only smokes.
function blowFrame(j, now, dt) {
  const F = j.F;
  if (!F || !world.fires.includes(F) || F.lit) { ui.fire = null; return; }
  const wet = BLOW_WET[world.weather.kind] || 1;
  j.puff = Math.max(0, j.puff - dt * 0.8);
  if (j.blowing) {
    const p = ((now - j.breath) % BLOW_BREATH) / BLOW_BREATH;
    if (p < BLOW_OUT) j.heat = Math.min(1.2, j.heat + dt / (BLOW_S * wet * BLOW_OUT));
    const n = Math.floor((now - j.breath) / BLOW_BREATH);
    if (n !== j.blownAt) { j.blownAt = n; chime('blow', { v: 0.5 + 0.5 * Math.min(1, j.heat) }); }
    if (j.heat >= 1 && !j.caught) { j.caught = now; chime('kindle', { v: 0.4 }); }
    if (j.caught && now - j.caught > CATCH_HOLD) takeFlame(j, now);
  } else j.heat = Math.max(BLOW_FLOOR, j.heat - dt * BLOW_COOL);
}
function blowOn(on) {
  const j = ui.fire;
  if (!j || j.stage !== 'blow' || on === j.blowing) return;
  const now = performance.now();
  j.blowing = on;
  if (on) { j.breath = now; j.blownAt = -1; j.held = now; return; }
  if (j.caught) { takeFlame(j, now); return; }
  if (now - j.held > 250) {                               // let go too soon: it only smokes
    j.puff = 0.9;
    chime('fizzle');
    if (!fireTold.smoked) { fireTold.smoked = true; say('Only smoke: blow a little longer', j.x, j.y - 0.3); }
  }
}
let fireKey = false;                      // F held down, at a fire (keys)
const blowHeld = () => !!(drag && drag.blow) || fireKey;
// Kneeling at a fire laying it, feeding it, striking or blowing: a press anywhere (or F) is a breath on it, not a walk.
const atFire = () => !!ui.fire && (ui.fire.stage === 'lay' || ui.fire.stage === 'feed' || ui.fire.stage === 'strike' || ui.fire.stage === 'blow');
function takeFlame(j, now) {
  if (!S.lightFire(world, j.F)) { ui.fire = null; return; }
  fireFlare.set(j.F, now);
  sendFire('light', j.F, 0, 0);
  chime('kindle', { v: 1 });
  j.blowing = false;
  fireStage(j, 'lit', now);
  if (!fireTold.lit) { fireTold.lit = true; try { localStorage.setItem(FIRE_TOLD, '1'); } catch (e) { /* fine */ } }
}
const FIRE_TOLD = 'aeon-garden-fire';     // in localStorage: a fire has been lit (the hint to hold, after that, waits a moment)
const fireTold = { lit: false, smoked: false };
try { fireTold.lit = localStorage.getItem(FIRE_TOLD) === '1'; } catch (e) { /* fine */ }

// Standing still by a lit fire, it kneels and holds its mittens out to it; moving on, it gets up.
const fireSit = { F: null };
function sitFrame(now) {
  const f = world.forager;
  fireSit.F = null;
  if (f.walking || f.down >= 0 || fg.stillMs < SIT_MS || ui.gather || ui.place) return;
  for (const F of world.fires) if (F.lit && Math.abs(F.x - f.x) < SIT_NEAR && Math.abs(F.y - f.y) < SIT_NEAR * 0.7 && Math.abs(F.x - f.x) > 0.3) { fireSit.F = F; break; }
  if (fireSit.F) fg.flip = fireSit.F.x > f.x;
}
// The kneeling pose this frame (fur.js FORAGER_KNEEL), or -1 on its feet.
function kneelNow(now) {
  const j = ui.fire;
  if (!j) return fireSit.F ? KNEEL.warm : -1;
  const u = now - j.t0;
  switch (j.stage) {
    case 'go': return -1;
    case 'lay': return (u % LAY_MS) / LAY_MS < 0.62 ? KNEEL.lay : KNEEL.rest;
    case 'feed': return u < FEED_MS * 0.8 ? KNEEL.lay : KNEEL.rest;
    case 'strike': return (u % STRIKE_MS) / STRIKE_MS < STRIKE_UP ? KNEEL.strikeUp : KNEEL.strikeDown;
    case 'blow': return j.blowing ? (((now - j.breath) % BLOW_BREATH) / BLOW_BREATH < BLOW_OUT ? KNEEL.blow : KNEEL.breathe) : KNEEL.rest;
    case 'lit': return u < LIT_MS * 0.5 ? KNEEL.rest : KNEEL.warm;
  }
  return -1;
}
// While it waits to be blown on: "Hold to blow" over the fire (after the first fire, only once it's waited a moment). And
// picking a spot, why one can't go where the faint fire is.
let HOLD_ART = null;
function drawFireHint(now) {
  const P = ui.place;
  if (P && !P.ok && P.why) { const [sx, sy] = onScreen(P.x, P.y); drawLabel(P.why, sx, sy + 8); }
  const j = ui.fire;
  if (!j || j.stage !== 'blow' || j.blowing || j.caught) return;
  const wait = now - j.t0;
  if (fireTold.lit && wait < 1800) return;
  if (!HOLD_ART) HOLD_ART = floatOf('', 0, 0, 0, 0, fingerTap || matchMedia('(pointer: coarse)').matches ? 'Hold to blow' : 'Hold to blow (or F)');
  const [sx, sy] = onScreen(j.x, j.y), a = Math.min(1, (wait - (fireTold.lit ? 1800 : 300)) / 400) * (0.82 + 0.18 * Math.sin(now / 320));
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.drawImage(HOLD_ART.img, Math.round(sx - HOLD_ART.w / 2), Math.round(sy - firePx(cam.zoom) * 0.95 - HOLD_ART.h), HOLD_ART.w, HOLD_ART.h);
  ctx.globalAlpha = 1;
}

// Playing together: a fire laid, fed or lit goes to the others, with the tick it was on (applyNet does it there).
function sendFire(a, F, n, tinder) {
  if (Net && Net.on) Net.send({ t: 'fire', a, x: F.x, y: F.y, n, tn: tinder, tick: world.tick });
}
function fireNet(m) {
  let F = null;
  for (const o of world.fires) if (Math.abs(o.x - m.x) < 1e-3 && Math.abs(o.y - m.y) < 1e-3) F = o;
  if (m.a === 'lay') { if (!F) S.layFire(world, m.x, m.y, m.n, m.tn); }
  else if (!F) return;
  else if (m.a === 'feed') S.feedFire(world, F, m.n, m.tn);
  else if (m.a === 'light') S.lightFire(world, F);   // (handleEvent's firelit flares it)
}

// How loud the fire's crackle is (sound.js): the nearest lit one to the middle of the screen, by how well it burns.
function fireSound() {
  let v = 0;
  const z = cam.zoom;
  for (const F of world.fires) {
    if (!F.lit && !(F.embers > 0)) continue;
    const [sx, sy] = toScreen(F.x, F.y), d = Math.hypot(sx - vw / 2, sy - vh / 2) / Math.max(1, Math.min(vw, vh));
    v = Math.max(v, S.fireHeat(F) * clamp(1.2 - d * 1.6, 0, 1) * clamp(z / 16, 0.4, 1));
  }
  return v;
}

// ------------------------------------------------------------------ glints and the forager's sense
//
// What has something to give glints now and then, so it reads as "pick me" without a hover: a small soft sparkle (GLINT_ART,
// painted once) over it, each thing on its own clock (glintAt: GLINT_EVERY, a hash of where it is), so only one or two on
// screen glint at once. What there is to pick is listed a few times a second (picksFrame, sim.js eachPickable), so a picked
// clean tree or an unripe bramble never glints. When the forager has stood still SENSE_STILL, everything within SENSE_REACH
// glints once together, in a wave outward from it (sense), with a faint ring going out. And when nothing to pick is on
// screen, a brass marker at the screen's edge points to the nearest (drawPickArrow), fading out as one comes into view: it
// pops in, nudges that way and sends out a soft honey ring now and then, so it's seen from the corner of an eye.
const GLINT_EVERY = 6000, GLINT_MS = 1300;  // ms between a thing's glints, and one glint (in quick, out slow)
const PICKS_MS = 400;                       // how often what there is to pick is listed again
const SENSE_STILL = 1000, SENSE_REACH = 15, SENSE_SPREAD = 1100;   // ms standing still; tiles; ms the wave takes to get there
const SENSE_BIG = 1.3;                      // how much bigger a glint the sense brings out is
const ARROW_WAIT = 1500;                    // ms with nothing on screen before the arrow shows
const ARROW_PING = 2200, ARROW_POP = 450;   // ms between the marker's rings; ms its pop as it shows
const picks = { kind: [], it: [], food: 0, at: -1e9, near: null, nearKind: '', seen: 0, none: 0, arrow: 0, arrowAt: 0, shownAt: -1e9, wanted: 0, topAt: -1e9, itemOf: null, item: -1 };
const sense = { still: 0, done: true, t0: -1e9, x: 0, y: 0 };
let GLINT_ART = null, ARROW_ART = null;
const addPick = (kind, it) => { picks.kind.push(kind); picks.it.push(it); };
function picksFrame(now) {
  if (now - picks.at < PICKS_MS) return;
  picks.at = now; picks.kind.length = picks.it.length = 0;
  S.eachPickable(world, addPick);
  picks.food = picks.it.length;                         // (after them, what lies about for a fire: it doesn't glint, but it's in reach)
  for (const f of world.finds) if (S.FINDS[f.kind].ground) addPick('find', f);
}
// In reach: everything to pick within NEAR_REACH of the forager has a soft warm light under it, steady, fading out toward the
// edge of that, so what can be picked stands apart from what's only the meadow (a dandelion from the other yellow flowers,
// dry grass from the tufts). The hovered one has its brighter glow (drawGlow), the one it's off to pick a little more.
const NEAR_REACH = 6.5, NEAR_FADE = 2, NEAR_A = 0.75;  // tiles; tiles it fades over at the edge; how strong
let RING_ART = null;
// The light under it, painted once: a soft honey ring lying on the ground with a faint warmth inside, stretched to the thing.
function ringArt() {
  const W = 128, c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  gr.addColorStop(0, 'rgba(255, 236, 178, 0.16)'); gr.addColorStop(0.6, 'rgba(255, 232, 170, 0.24)');
  gr.addColorStop(0.78, 'rgba(255, 220, 128, 0.85)'); gr.addColorStop(0.9, 'rgba(255, 214, 120, 0.35)'); gr.addColorStop(1, 'rgba(255, 214, 120, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, W);
  RING_ART = { img: c };
  asBitmap(c, b => { RING_ART.img = b; });
  return RING_ART;
}
function drawNear(now, over) {
  const F = world.forager, art = RING_ART || ringArt(), k = 0.9 + 0.1 * Math.sin(now / 900), g = ui.gather;
  for (let i = 0; i < picks.it.length; i++) {
    const it = picks.it[i], kind = picks.kind[i];
    if ((kind === 'hive') !== over || (aim.t && aim.t.it === it && aim.n)) continue;
    const d = Math.hypot(it.x - F.x, it.y - F.y), lined = (g && g.it === it) || ui.queue.some(q => q.it === it);
    if (d > NEAR_REACH && !lined) continue;
    const s = gatherSpot(kind, it);
    if (!visible(s.gx, s.gy, s.rx * 2)) continue;
    ctx.globalAlpha = Math.min(1, NEAR_A * k * (lined ? 1.35 : Math.min(1, (NEAR_REACH - d) / NEAR_FADE)));
    const rx = s.rx * 1.1, ry = Math.min(s.ry, s.rx * 0.55) * 1.1, y = s.gy + s.ry - ry * 0.9;   // (lying flat round its foot)
    ctx.drawImage(art.img, s.gx - rx, y - ry, rx * 2, ry * 2);
  }
  ctx.globalAlpha = 1;
}
// A glint, painted once: a soft honey bloom, a little warm light in it and four fine rays, the upright pair longer, like
// sun catching on something wet. Drawn small, so the bloom does most of the work.
function glintArt() {
  const P = 64, c = document.createElement('canvas'), g = c.getContext('2d'), m = P / 2;
  c.width = c.height = P;
  const gr = g.createRadialGradient(m, m, 0, m, m, m * 0.8);
  gr.addColorStop(0, 'rgba(255, 228, 160, 0.9)'); gr.addColorStop(0.3, 'rgba(250, 200, 100, 0.42)'); gr.addColorStop(1, 'rgba(240, 180, 80, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, P, P);
  g.translate(m, m);
  for (const [l, w, a] of [[0.48, 0.05, 1], [0.34, 0.045, 0.85]]) {   // the rays: long up and down, shorter across
    const ray = g.createLinearGradient(0, -l * P, 0, l * P);
    ray.addColorStop(0, 'rgba(255, 224, 150, 0)'); ray.addColorStop(0.5, `rgba(255, 242, 200, ${a})`); ray.addColorStop(1, 'rgba(255, 224, 150, 0)');
    g.fillStyle = ray;
    g.beginPath(); g.moveTo(0, -l * P); g.quadraticCurveTo(w * P, 0, 0, l * P); g.quadraticCurveTo(-w * P, 0, 0, -l * P); g.fill();
    g.rotate(Math.PI / 2);
  }
  const core = g.createRadialGradient(0, 0, 0, 0, 0, P * 0.1);
  core.addColorStop(0, 'rgba(255, 252, 238, 1)'); core.addColorStop(1, 'rgba(255, 236, 180, 0)');
  g.fillStyle = core; g.fillRect(-P * 0.1, -P * 0.1, P * 0.2, P * 0.2);
  GLINT_ART = { img: c };
  asBitmap(c, b => { GLINT_ART.img = b; });
  return GLINT_ART;
}
// The edge marker, painted once: a small parchment disc with a brass rim and a brass point on its right (drawn turned to
// where it points; the disc is round, so only the point turns). What's that way is drawn into the disc (drawPickArrow).
const ARROW_DISC = 0.3;                     // the disc's radius in the painting's size
function arrowArt() {
  const P = 96, c = document.createElement('canvas'), g = c.getContext('2d'), m = P / 2, R = ARROW_DISC * P;
  c.width = c.height = P;
  const sh = g.createRadialGradient(m, m + 2, R * 0.8, m, m + 2, R * 1.35);
  sh.addColorStop(0, 'rgba(60, 40, 10, 0.28)'); sh.addColorStop(1, 'rgba(60, 40, 10, 0)');
  g.fillStyle = sh; g.fillRect(0, 0, P, P);
  g.fillStyle = 'rgb(160, 116, 44)'; g.strokeStyle = 'rgb(126, 88, 30)'; g.lineWidth = P * 0.012; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(m + R * 0.7, m - R * 0.55); g.quadraticCurveTo(m + R * 1.3, m - R * 0.12, m + R * 1.52, m);
  g.quadraticCurveTo(m + R * 1.3, m + R * 0.12, m + R * 0.7, m + R * 0.55); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgb(251, 244, 224)'; g.beginPath(); g.arc(m, m, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgb(176, 132, 58)'; g.lineWidth = P * 0.03; g.stroke();
  ARROW_ART = { img: c };
  asBitmap(c, b => { ARROW_ART.img = b; });
  return ARROW_ART;
}
// Where in its clock a thing's glint is: 0..1 while it glints, else -1.
function glintAt(it, now) {
  const h = Math.abs(Math.sin(it.x * 12.9898 + it.y * 78.233) * 43758.5453) % 1, t = (now + h * GLINT_EVERY) % GLINT_EVERY;
  return t < GLINT_MS ? t / GLINT_MS : -1;
}
// The forager's sense: standing still a moment, it notices what's about.
function senseFrame(now) {
  const F = world.forager;
  if (F.walking || ui.gather) { sense.still = now; sense.done = false; return; }
  if (!sense.done && now - sense.still > SENSE_STILL) { sense.done = true; sense.t0 = now; sense.x = F.x; sense.y = F.y; }
}
function drawGlints(now, dark) {
  picksFrame(now);
  senseFrame(now);
  const z = cam.zoom, art = GLINT_ART || glintArt(), base = Math.max(11, (8 + z) * 0.42), F = world.forager;
  const sensing = now - sense.t0 < SENSE_SPREAD + GLINT_MS;
  let seen = 0, near = null, nearKind = '', nd = Infinity;
  if (sensing) {                                          // the wave: a faint ring going out
    const u = (now - sense.t0) / (SENSE_SPREAD + GLINT_MS * 0.5), r = SENSE_REACH * z * Math.min(1, u), [sx, sy] = onScreen(sense.x, sense.y);
    if (u < 1) { ctx.globalAlpha = 0.3 * (1 - u) * Math.min(1, u * 6); ctx.drawImage((MARK_ART || markArt()).img, sx - r, sy - r * 0.5, r * 2, r); }
  }
  for (let i = 0; i < picks.food; i++) {
    const it = picks.it[i], kind = picks.kind[i], sx = (it.x - cam.x) * z + vw / 2, sy = (it.y - cam.y) * z + vh / 2;
    const dx = it.x - F.x, dy = it.y - F.y, d2 = dx * dx + dy * dy;
    if (d2 < nd) { nd = d2; near = it; nearKind = kind; }
    if (!visible(sx, sy, 0)) continue;
    seen++;
    let u = glintAt(it, now), k = 1;
    if (sensing && d2 < SENSE_REACH * SENSE_REACH) {      // (the sense's glint: bigger, as the wave reaches it)
      const t = (now - sense.t0 - Math.sqrt(d2) / SENSE_REACH * SENSE_SPREAD) / GLINT_MS;
      if (t >= 0 && t < 1) { u = t; k = SENSE_BIG; }
    }
    if (u < 0) continue;
    // a twinkle: up quickly, then fading slowly, turning a little as it goes
    const e = u < 0.25 ? Math.sin(u / 0.25 * Math.PI / 2) : (1 - (u - 0.25) / 0.75) ** 1.6, r = base * k * (0.55 + 0.45 * e);
    const s = gatherSpot(kind, it), x = s.gx + s.rx * 0.3, y = s.gy - s.ry * 0.5, a = 0.5 * u - 0.15, c = Math.cos(a) * dpr, sn = Math.sin(a) * dpr;
    ctx.globalAlpha = e * (1 - 0.3 * dark);
    ctx.setTransform(c, sn, -sn, c, x * dpr + shakeX, y * dpr + shakeY);
    ctx.drawImage(art.img, -r, -r, r * 2, r * 2);
  }
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  ctx.globalAlpha = 1;
  picks.seen = seen; picks.near = near; picks.nearKind = nearKind;
}
// The marker at the screen's edge, toward the nearest thing to pick while none is on screen, with that thing's painting in
// it (the satchel's: itemSheet). Out of the way of the watch and the pill at the top and the satchel and the bars over it at
// the foot (their places looked at once a second, KEEP_CLEAR).
const KEEP_CLEAR = ['#watch', '#hud-right .hud-top', '#satchel', '#vitals .vital.show'];
const clearOf = KEEP_CLEAR.map(() => ({ l: 0, t: 0, r: 0, b: 0 }));
// Where the way from the forager to a spot in the meadow leaves the screen, kept r + 10 in from its edges, over the satchel and
// out from under the watch and the pill (edge: x, y and the way, cx, cy); false if it doesn't.
const edge = { x: 0, y: 0, cx: 0, cy: 0 };
function edgeAt(tx, ty, r) {
  const F = world.forager, z = cam.zoom, fx = (F.x - cam.x) * z + vw / 2, fy = (F.y - cam.y) * z + vh / 2;
  const a = Math.atan2((ty - F.y) * z, (tx - F.x) * z), cx = Math.cos(a), cy = Math.sin(a);
  const m = r + 10, sat = clearOf[2], bars = clearOf[3];
  const x0 = m, x1 = vw - m, y0 = m, y1 = Math.min(vh - m, sat.b ? sat.t - r - 6 : vh - m, bars.b ? bars.t - r - 4 : vh - m);
  let t = Infinity;                                     // where the way from the forager leaves the box
  if (cx > 0) t = Math.min(t, (x1 - fx) / cx); else if (cx < 0) t = Math.min(t, (x0 - fx) / cx);
  if (cy > 0) t = Math.min(t, (y1 - fy) / cy); else if (cy < 0) t = Math.min(t, (y0 - fy) / cy);
  if (!(t > 0) || t === Infinity) return false;
  let x = fx + cx * t, y = fy + cy * t;
  for (let k = 0; k < 2; k++) {                         // (pushed down out from under the watch or the pill)
    const o = clearOf[k];
    if (o.b && x > o.l - r - 4 && x < o.r + r + 4 && y < o.b + r + 4) y = o.b + r + 6;
  }
  edge.x = x; edge.y = y; edge.cx = cx; edge.cy = cy;
  return true;
}
// The markers already at the edge this frame, laid in order (home, then friends, then the pick marker): each next one
// slides along the edge out from under them (edgeApart). Four numbers a marker: where it is, half its width, and how far
// it reaches below its middle (a friend's name hangs under its disc).
const edgeMarks = { at: [], n: 0, frame: -1 };
function edgeApart(r, half, below) {
  if (edgeMarks.frame !== spriteFrame) { edgeMarks.frame = spriteFrame; edgeMarks.n = 0; }
  const at = edgeMarks.at, along = Math.abs(edge.cx * vw) > Math.abs(edge.cy * vh) ? 0 : 1;   // (1: on the top or the foot, so it slides sideways)
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < edgeMarks.n; i += 4) {
      const dx = edge.x - at[i], dy = edge.y - at[i + 1];
      const needX = half + at[i + 2] + 4, needY = (dy > 0 ? r + at[i + 3] : below + r) + 4;
      if (Math.abs(dx) >= needX || Math.abs(dy) >= needY) continue;
      if (along) edge.x = at[i] + (dx < 0 ? -needX : needX);
      else edge.y = at[i + 1] + (dy < 0 ? -needY : needY);
      moved = true;
    }
    if (!moved) break;
  }
  const n = edgeMarks.n;
  at[n] = edge.x; at[n + 1] = edge.y; at[n + 2] = half; at[n + 3] = below; edgeMarks.n = n + 4;
}
function keepClear(now) {                               // (the watch's, the pill's and the satchel's places, once a second)
  if (now - picks.topAt < 1000) return;
  picks.topAt = now;
  KEEP_CLEAR.forEach((q, k) => {
    const el = $(q), r = el && el.getBoundingClientRect(), o = clearOf[k];
    if (r && r.height && getComputedStyle(el).opacity !== '0') { o.l = r.left; o.t = r.top; o.r = r.right; o.b = r.bottom; } else o.l = o.t = o.r = o.b = 0;
  });
}
function drawPickArrow(now) {
  const dt = Math.min(100, now - picks.arrowAt);
  picks.arrowAt = now;
  if (picks.seen || !picks.near) picks.none = now;
  const want = now - picks.none > ARROW_WAIT ? 1 : 0;
  if (want && !picks.wanted && picks.arrow < 0.3) picks.shownAt = now;
  picks.wanted = want;
  picks.arrow += (want - picks.arrow) * Math.min(1, dt / (want ? 500 : 250));
  if (picks.arrow < 0.02 || !picks.near) return;
  keepClear(now);
  if (picks.near !== picks.itemOf) { picks.itemOf = picks.near; picks.item = ITEM_IDS.indexOf(S.whatThere(world, picks.nearKind, picks.near).id); }
  const it = picks.near, r = narrow() ? 18 : 19;
  if (!edgeAt(it.x, it.y, r)) return;
  edgeApart(r, r * 1.15, r);                            // (slid along the edge out from under home's and friends' markers)
  const cx = edge.cx, cy = edge.cy;
  let x = edge.x, y = edge.y;
  const nudge = Math.sin(now / 300), bob = 3.5 * nudge * Math.abs(nudge), art = ARROW_ART || arrowArt(), i = picks.item;
  x += cx * bob; y += cy * bob;
  const ping = ((now - picks.shownAt) % ARROW_PING) / ARROW_PING, ringR = r * (1.1 + 1.4 * ping);   // a ring going out
  ctx.globalAlpha = 0.8 * (1 - ping) * Math.min(1, ping * 8) * picks.arrow;
  ctx.drawImage((RING_ART || ringArt()).img, x - ringR, y - ringR, ringR * 2, ringR * 2);
  const p = (now - picks.shownAt) / ARROW_POP, rr = p < 1 ? r * (1 + 0.35 * Math.sin(p * Math.PI)) : r, size = rr / ARROW_DISC;
  ctx.globalAlpha = 0.96 * picks.arrow;
  ctx.setTransform(cx * dpr, cy * dpr, -cy * dpr, cx * dpr, x * dpr + shakeX, y * dpr + shakeY);
  ctx.drawImage(art.img, -size / 2, -size / 2, size, size);
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  if (i >= 0) {                                         // (kept inside the disc: some paintings fill more than their slot)
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.clip();
    ctx.drawImage(itemSheet().img, i * ITEM_PX, 0, ITEM_PX, ITEM_PX, x - rr * 0.85, y - rr * 0.85, rr * 1.7, rr * 1.7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// The way home: once there's a camp, whenever its fire is off screen the same parchment disc sits at the screen's edge where
// the way from the forager to it leaves, its point turned that way and a little campfire in it (CAMPMARK_ART, painted once).
// Always there, so it's calm: no pop or rings, only a slow warm breath. Drawn first: friends' markers and the pick marker
// slide along the edge out from under it (edgeApart). Fades in and out as the camp goes off and comes on screen.
const campMark = { a: 0, at: 0 };
let CAMPMARK_ART = null;
function campMarkArt() {                                 // two crossed logs and a flame, in the middle of a P box
  const P = 96, c = document.createElement('canvas'), g = c.getContext('2d'), m = P / 2;
  c.width = c.height = P;
  g.lineCap = 'round';
  for (const [s, col] of [[1, 'rgb(112, 74, 44)'], [-1, 'rgb(134, 92, 56)']]) {
    g.strokeStyle = col; g.lineWidth = P * 0.1;
    g.beginPath(); g.moveTo(m - s * P * 0.3, m + P * 0.3); g.lineTo(m + s * P * 0.3, m + P * 0.14); g.stroke();
  }
  const flame = (h, w, col) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(m, m + P * 0.2 - h);
    g.bezierCurveTo(m + w * 0.9, m - h * 0.25, m + w, m + P * 0.2, m, m + P * 0.22);
    g.bezierCurveTo(m - w, m + P * 0.2, m - w * 0.9, m - h * 0.25, m, m + P * 0.2 - h); g.fill();
  };
  flame(P * 0.62, P * 0.24, 'rgb(214, 84, 40)'); flame(P * 0.44, P * 0.16, 'rgb(244, 150, 52)'); flame(P * 0.26, P * 0.09, 'rgb(255, 222, 130)');
  CAMPMARK_ART = { img: c };
  asBitmap(c, b => { CAMPMARK_ART.img = b; });
  return CAMPMARK_ART;
}
function drawCampMark(now) {
  const C = world.camp, dt = Math.min(100, now - campMark.at);
  campMark.at = now;
  let want = 0;
  if (C && world.forager.down < 0) {
    const z = cam.zoom, sx = (C.x - cam.x) * z + vw / 2, sy = (C.y - cam.y) * z + vh / 2;
    want = sx > -z && sx < vw + z && sy > -z && sy < vh + z ? 0 : 1;   // (on screen, or nearly: the camp shows for itself)
  }
  campMark.a += (want - campMark.a) * Math.min(1, dt / (want ? 500 : 250));
  if (campMark.a < 0.02 || !C) { campMark.a = Math.max(0, campMark.a); return; }
  keepClear(now);
  const r = narrow() ? 18 : 19;
  if (!edgeAt(C.x, C.y, r)) { campMark.a = 0; return; }
  edgeApart(r, r * 1.15, r);
  const { x, y, cx, cy } = edge, size = r / ARROW_DISC, breath = 0.5 + 0.5 * Math.sin(now / 900);
  const gr = r * (1.25 + 0.15 * breath);                // a soft warm glow round it
  ctx.globalAlpha = (0.35 + 0.2 * breath) * campMark.a;
  ctx.drawImage((RING_ART || ringArt()).img, x - gr, y - gr, gr * 2, gr * 2);
  ctx.globalAlpha = 0.96 * campMark.a;
  ctx.setTransform(cx * dpr, cy * dpr, -cy * dpr, cx * dpr, x * dpr + shakeX, y * dpr + shakeY);
  ctx.drawImage((ARROW_ART || arrowArt()).img, -size / 2, -size / 2, size, size);
  ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  const ir = r * 0.8;
  ctx.drawImage((CAMPMARK_ART || campMarkArt()).img, x - ir, y - ir, ir * 2, ir * 2);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ the satchel
//
// A row of SLOTS small parchment slots at the bottom in the middle (#satchel), faint and slim while it's empty. Each shows
// what's in it, painted in the meadow's style (itemSheet: the mushrooms, greens and windfalls as the meadow paints them,
// and paintItem for the rest, all once into one sheet), and how many. It's sim.js's w.forager.bag, so it's kept with the meadow.
const ITEM_IDS = Object.keys(Recipes.INGREDIENTS), ITEM_PX = 96;   // (two device pixels a CSS pixel at 48)
const ITEM_ART = { apple: 'fall:0', acorns: 'fall:1', blackberry: 'item:0', cherry: 'item:1', honey: 'item:2', beechnuts: 'item:3', garlic: 'green:0', nettle: 'green:6' };
S.SHROOM_KINDS.forEach((k, i) => { ITEM_ART[k] = 'shroom:' + i * 3; });   // (SHROOM_ARTS: the fewest caps)
S.FIND_KINDS.forEach((k, i) => { ITEM_ART[k] = 'find:' + i * 4; });     // (FIND_ARTS: the first look)
Object.assign(ITEM_ART, { stick: 'item:4', pebble: 'item:5', birchbark: 'item:6' });   // (lying flat they'd be thin in a slot)
const ITEM_FILL = { stick: 0.95, pebble: 1.0, drygrass: 1.25, birchbark: 0.95, dandelion: 1.15, sorrel: 1.2, strawberry: 1.2, elderflower: 1.0, hazelnut: 1.35, rosehip: 1.05, watercress: 1.2, garlic: 1.5, nettle: 1.25, cep: 1.6, chanterelle: 1.5, field: 1.6, oyster: 1.35, sulphur: 1.3, apple: 0.85, acorns: 0.8 };   // how much of the slot each painting fills
let ITEM_SHEET = null;
function itemSheet() {
  if (ITEM_SHEET) return ITEM_SHEET;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = ITEM_PX * ITEM_IDS.length; c.height = ITEM_PX;
  const was = standIns; standIns = false;
  ITEM_IDS.forEach((id, i) => {
    const art = ITEM_ART[id];
    if (!art) {                                          // (not painted yet: its emoji stands in)
      g.font = `${ITEM_PX * 0.7}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(Recipes.INGREDIENTS[id].icon || '?', (i + 0.5) * ITEM_PX, ITEM_PX * 0.54);
      return;
    }
    const want = ITEM_PX / dpr * (ITEM_FILL[id] || 1), s = sprite(art, want), d = s.size * dpr;
    g.drawImage(s.canvas, (i + 0.5) * ITEM_PX - d / 2, ITEM_PX / 2 - d / 2, d, d);
  });
  standIns = was;
  ITEM_SHEET = { canvas: c, img: c, url: c.toDataURL() };
  asBitmap(c, b => { ITEM_SHEET.img = b; });   // (the edge marker draws from it)
  document.documentElement.style.setProperty('--items', `url(${ITEM_SHEET.url})`);
  document.documentElement.style.setProperty('--item-n', ITEM_IDS.length);
  return ITEM_SHEET;
}
const itemBg = id => { const i = ITEM_IDS.indexOf(id); return `${ITEM_IDS.length > 1 ? i / (ITEM_IDS.length - 1) * 100 : 0}% 0`; };

// The things painted only for the satchel, as the windfalls are: 'item:0' blackberries, 1 cherries, 2 a piece of honeycomb,
// 3 beechnuts, 4 a few sticks, 5 pebbles, 6 a curl of birch bark (what lies flat on the ground, held up to look at). Box -1 to 1.
function paintItem(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const h = k => hash2(n, k, 63);
  if (n === 4) {
    twig(g, -0.72, 0.5, 0.7, -0.5, 0.06, 0.1, [124, 88, 56]);
    twig(g, -0.66, -0.2, 0.74, 0.36, -0.05, 0.085, [104, 74, 48]);
    twig(g, -0.5, 0.62, 0.6, 0.1, 0.04, 0.075, [138, 100, 64]);
    return;
  }
  if (n === 5) { g.translate(0, -0.5); g.scale(1.25, 1.25); paintPebbles(g, h, 0); return; }
  if (n === 6) {
    g.rotate(-0.5);
    softIn(g, [236, 230, 216], -0.24, 0.24, () => { g.moveTo(-0.62, -0.24); g.lineTo(0.62, -0.24); g.ellipse(0.62, 0, 0.11, 0.24, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(-0.62, 0.24); g.closePath(); }, 1.1, 0.72);
    strokeIn(g, 'rgba(40, 34, 30, 0.75)', 0.035, () => { for (let k = 0; k < 5; k++) { const x = -0.45 + k * 0.24, y = (h(k) - 0.5) * 0.3; g.moveTo(x - 0.07, y); g.lineTo(x + 0.06, y); } });
    fillIn(g, 'rgb(246, 242, 232)', () => ovalAt(g, -0.62, 0, 0.11, 0.24));
    fillIn(g, 'rgb(196, 132, 88)', () => ovalAt(g, -0.62, 0, 0.075, 0.17));
    furGlow(g, [255, 255, 250], 0.5, -0.1, -0.12, 0.4, 0.06);
    return;
  }
  if (n === 0) {
    fillIn(g, '#5f8a3c', () => ovalAt(g, 0.3, -0.42, 0.3, 0.13, -0.6));
    g.save(); g.scale(7, 7);
    for (const [x, y] of [[-0.05, -0.01], [0.055, 0.0], [0.0, 0.07]]) brambleBerry(g, x, y, 3);
    g.restore();
  } else if (n === 1) {
    strokeIn(g, '#5a7a2c', 0.07, () => { g.moveTo(-0.3, 0.05); g.quadraticCurveTo(-0.2, -0.45, 0.08, -0.7); g.moveTo(0.32, 0.12); g.quadraticCurveTo(0.3, -0.35, 0.08, -0.7); });
    fillIn(g, '#6aa84a', () => ovalAt(g, 0.3, -0.66, 0.24, 0.1, -0.3));
    for (const [x, y] of [[-0.32, 0.3], [0.32, 0.36]]) {
      softIn(g, [176, 22, 40], y - 0.36, y + 0.36, () => discAt(g, x, y, 0.33), 1.3, 0.6);
      furGlow(g, [255, 190, 190], 0.6, x - 0.12, y - 0.13, 0.1, 0.07, -0.5);
    }
  } else if (n === 2) {
    softIn(g, [226, 156, 36], -0.55, 0.6, () => { g.moveTo(-0.7, -0.35); g.quadraticCurveTo(0, -0.62, 0.7, -0.35); g.lineTo(0.62, 0.42); g.quadraticCurveTo(0, 0.62, -0.62, 0.42); g.closePath(); }, 1.25, 0.65);
    strokeIn(g, 'rgba(150, 86, 14, 0.55)', 0.035, () => {    // the cells
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        const x = -0.45 + col * 0.3 + (row % 2) * 0.15, y = -0.25 + row * 0.22, r = 0.12;
        if (x > 0.55) continue;
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; k ? g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
      }
    });
    softIn(g, [236, 170, 40], 0.3, 0.85, () => { g.moveTo(0.12, 0.45); g.quadraticCurveTo(0.2, 0.7, 0.16, 0.78); g.arc(0.12, 0.78, 0.06, 0, Math.PI); g.quadraticCurveTo(0.06, 0.6, 0.08, 0.45); g.closePath(); });   // a drip
    furGlow(g, [255, 240, 190], 0.55, -0.28, -0.22, 0.3, 0.12, -0.2);
  } else {
    for (const [x, y, a] of [[-0.24, 0.12, -0.35], [0.24, 0.16, 0.3]]) {
      g.save(); g.translate(x, y); g.rotate(a);
      softIn(g, [150, 92, 50], -0.45, 0.4, () => { g.moveTo(0, -0.45); g.quadraticCurveTo(0.34, 0.1, 0.24, 0.38); g.quadraticCurveTo(0, 0.46, -0.24, 0.38); g.quadraticCurveTo(-0.34, 0.1, 0, -0.45); }, 1.3, 0.6);
      strokeIn(g, 'rgba(70, 40, 20, 0.5)', 0.03, () => { g.moveTo(0, -0.4); g.lineTo(0, 0.38); });
      furGlow(g, [255, 220, 180], 0.45, -0.1, -0.05, 0.08, 0.16);
      g.restore();
    }
  }
}

function renderSatchel() {
  const box = $('#satchel'), F = world && world.forager;
  if (!box || !F) return;
  itemSheet();
  const slots = box.querySelectorAll('.slot');
  let any = false;
  for (let k = 0; k < S.SLOTS; k++) {
    const id = F.bag[k], n = F.bagN[k], el = slots[k];
    any = any || !!id;
    if (el.dataset.id === id && +el.dataset.n === n) continue;
    el.dataset.id = id; el.dataset.n = n;
    el.querySelector('i').style.backgroundPosition = id ? itemBg(id) : '';
    el.querySelector('i').classList.toggle('on', !!id);
    el.querySelector('b').textContent = n > 1 ? n : '';
    el.setAttribute('aria-label', id ? `${Recipes.INGREDIENTS[id]?.name || id}: ${n}` : 'Empty');
    el.dataset.name = id ? Recipes.INGREDIENTS[id]?.name || id : '';
  }
  box.classList.toggle('empty', !any);
  renderBuild();                                          // (the fire button by it: what a fire takes, how much of it's here)
}

// The thing flies from where it was picked (sx, sy) into its slot, and the slot bumps as it lands. One small element, a
// few hundred ms, the browser's own animation.
function flyToSlot(id, sx, sy, k, landed) {
  const el = $('#satchel').querySelectorAll('.slot')[k ?? 0];
  if (!el) { renderSatchel(); if (landed) landed(); return; }
  const r = el.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const fly = document.createElement('div');
  fly.className = 'fly'; fly.style.backgroundPosition = itemBg(id);
  document.body.appendChild(fly);
  const mx = (sx + tx) / 2, my = Math.min(sy, ty) - 60;
  const a = fly.animate([{ transform: `translate(${sx - 16}px, ${sy - 16}px) scale(0.7)`, opacity: 0.4 },
    { transform: `translate(${mx - 16}px, ${my - 16}px) scale(1.1)`, opacity: 1, offset: 0.4 },
    { transform: `translate(${tx - 16}px, ${ty - 16}px) scale(0.8)`, opacity: 1 }], { duration: 560, easing: 'ease-in' });
  a.onfinish = () => { fly.remove(); renderSatchel(); if (landed) landed(); el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); };
}

function setupSatchel() {
  const box = $('#satchel'), row = box.querySelector('.slots');
  row.innerHTML = Array.from({ length: S.SLOTS }, (_, k) => `<div class="slot" data-k="${k}" data-name="" aria-label="Empty"><i></i><b></b></div>`).join('');
  buildIcon();                                            // (the fire button's campfire)
  // Hovered (or tapped) a full slot says what's in it, a small label over it (CSS, data-name).
  // A full slot can be dragged: once the press has moved HOLD_FROM px its painting follows the pointer (above a finger, so
  // it shows), and let go over another slot it goes there (S.moveSlot: onto a stack of its kind, or the two swap), off the
  // satchel it's dropped (S.dropSlot): it flies down to the forager's feet and lies there to be picked up again, for a while; anywhere else it goes back.
  const HOLD_FROM = 6, slotAt = (x, y) => document.elementFromPoint(x, y)?.closest('#satchel .slot');
  let held = null;                          // { k, id, pid, x, y, fly, over, touch }
  const place = (h, x, y) => { h.fly.style.transform = `translate(${x - 20}px, ${y - (h.touch ? 58 : 20)}px)`; };
  row.addEventListener('pointerdown', e => {
    const el = e.target.closest('.slot'), F = world && world.forager;
    if (held || !el || !F || e.button > 0 || !F.bag[+el.dataset.k]) return;
    held = { k: +el.dataset.k, id: F.bag[+el.dataset.k], pid: e.pointerId, x: e.clientX, y: e.clientY, fly: null, over: null, touch: e.pointerType !== 'mouse' };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  row.addEventListener('pointermove', e => {
    const h = held;
    if (!h || e.pointerId !== h.pid) return;
    if (!h.fly) {
      if (Math.hypot(e.clientX - h.x, e.clientY - h.y) < HOLD_FROM) return;
      h.fly = document.createElement('div');
      h.fly.className = 'fly held'; h.fly.style.backgroundPosition = itemBg(h.id);
      document.body.appendChild(h.fly);
      row.children[h.k].classList.add('lifted');
      box.classList.add('dragging');
    }
    place(h, e.clientX, e.clientY);
    const over = slotAt(e.clientX, h.touch ? e.clientY - 38 : e.clientY) || null;
    if (over !== h.over) { h.over?.classList.remove('over'); h.over = over; over?.classList.add('over'); }
    const out = !over && !document.elementFromPoint(e.clientX, e.clientY)?.closest('#satchel');
    h.fly.classList.toggle('out', out);
  });
  const letGo = e => {
    const h = held;
    if (!h || e.pointerId !== h.pid) return;
    held = null;
    if (!h.fly) {                                         // (a tap: its name for a moment, as a mouse's hover shows it)
      if (e.type === 'pointerup' && h.touch) { const el = row.children[h.k]; el.classList.add('named'); clearTimeout(el.unname); el.unname = setTimeout(() => el.classList.remove('named'), 1400); }
      return;
    }
    const F = world.forager, lifted = row.children[h.k], out = e.type === 'pointerup' && h.fly.classList.contains('out');
    h.over?.classList.remove('over');
    box.classList.remove('dragging');
    if (e.type === 'pointerup' && h.over && +h.over.dataset.k !== h.k && F.bag[h.k] === h.id) S.moveSlot(F, h.k, +h.over.dataset.k);
    else if (out && F.bag[h.k] === h.id) {                // (it flies down to the forager's feet, and lands there)
      const n = F.bagN[h.k], d = S.dropSlot(world, h.k), [tx, ty] = toScreen(d.x, d.y), px = dropPx(d, cam.zoom), from = h.fly.style.transform;
      if (Net && Net.on) Net.send({ t: 'drop', kind: d.kind, x: d.x, y: d.y, n, born: d.born, until: d.until, tick: world.tick });
      const to = `translate(${tx - 20}px, ${ty - px * 0.3 - 20}px)`, k = clamp(px / 40, 0.3, 1.2);
      dropLand.set(d, performance.now() + DROP_FLY);
      h.fly.animate([{ transform: `${from} scale(1)`, opacity: 1 }, { transform: `${to} scale(${k})`, opacity: 0.9 }], { duration: DROP_FLY, easing: 'ease-in' })
        .onfinish = () => h.fly.remove();
      lifted.classList.remove('lifted'); renderSatchel();
      return;
    }
    h.fly.remove(); lifted.classList.remove('lifted'); renderSatchel();
  };
  row.addEventListener('pointerup', letGo);
  row.addEventListener('pointercancel', letGo);
}

// Zoomed out further than the meadow fills the screen, a grown rabbit is under SMALL_PX and hundreds of animals can be
// on screen: each is one plain draw, with no save, turn and restore. One facing the other way is drawn from a mirrored
// copy of its painting, made the first time it's wanted (mirrored).
const SMALL_PX = 14;
const zoomedOut = () => 8 + cam.zoom < SMALL_PX;
const mirrors = new WeakMap();
function drawSmall(art, x, y, px, flip) {
  const s = sprite(art, px), img = flip ? mirrored(s.canvas) : s.canvas;
  ctx.drawImage(img, x - s.size / 2, y - s.size / 2, s.size, s.size);
}
function mirrored(img) {
  let m = mirrors.get(img);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.setTransform(-1, 0, 0, 1, img.width, 0);
    g.drawImage(img, 0, 0);
    mirrors.set(img, m = { img: c });
    asBitmap(c, b => { m.img = b; c.width = 0; });
  }
  return m.img;
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
  if (wet && wasWet.get(c) === false && (c.mode === 'slide' || c.mode === 'slip') && ui.speed > 0 && splashes.length < 12) {
    splashes.push({ x: c.x, y: c.y, size: px / cam.zoom, t0: now });   // into the water: a splash
  }
  wasWet.set(c, wet);
  if (!art) { drawUnder(sx, sy + px * 0.31, px, now, c.id); return; }
  if (wet && otterGoes(c)) drawWake(ctx, sx, sy, px, flip ? -1 : 1, now);
  const breathe = c.sleeping && ui.speed > 0 ? Math.sin(now / 650 + c.id) * 0.035 : 0;
  drawEmoji(art, sx, sy - px * 0.4 * breathe, px, { flip, squash: 1 + breathe });   // feet stay on the ground
  if (c.mode === 'root' && px > 18 && ui.speed > 0) drawDigging(c, sx, sy, px, now, flip ? -1 : 1);
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
    const hid = coverAt(sx, sy - px * 0.4, s.y);            // (behind a tree on the bank)
    if (hid > 0.98) continue;
    ctx.globalAlpha = 1 - hid;
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
  ctx.globalAlpha = 1;
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

// ------------------------------------------------------------------ mushrooms
//
// A clump of mushrooms (sim.js w.shrooms) is painted once a look and size ('shroom:' + kind * 3 + look, SHROOM_ARTS; a
// look is how many caps, sim.js SHROOMS n and up): ceps (a fat pale stem, a brown bun of a cap), chanterelles (little
// golden trumpets), field mushrooms (white domes, the gills dark under the rim), oyster mushrooms (pale fans in a tier
// out of a log's side) and chicken of the woods (sulphur shelves up a snag's trunk). It comes up over a few hours, in
// steps, and fades as it goes over (drawShroom).
const SHROOM_SIZE = 0.6;                  // a clump, next to a rabbit
const SHROOM_GROW = 0.25;                 // days it takes to come up
const SHROOM_OVER = 0.4;                  // its last days, going over, it fades
const SHROOM_ARTS = S.SHROOM_KINDS.flatMap((k, i) => [0, 1, 2].map(v => 'shroom:' + (i * 3 + v)));
const SHROOM_RGB = { cep: [140, 88, 46], chanterelle: [240, 172, 44], field: [242, 236, 224], oyster: [120, 110, 102], sulphur: [240, 140, 34] };
const SHROOM_STEM = [236, 226, 204];
const SHROOM_FILL = 1.8;                  // a clump's units, of the painting's box
function paintShroom(g, size, U, look) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const kind = S.SHROOM_KINDS[Math.floor(look / 3)], n = S.SHROOMS[kind].n + look % 3, h = k => hash2(look, k, 41), rgb = SHROOM_RGB[kind];
  if (kind === 'oyster' || kind === 'sulphur') { g.scale(SHROOM_FILL, SHROOM_FILL); paintShelves(g, kind, n, h, rgb); return; }
  g.translate(0, 0.62); g.scale(SHROOM_FILL, SHROOM_FILL); g.translate(0, -0.62);   // (drawn in a clump's units, from its foot)
  softSpot(g, 0, 0.62, 0.8, 0.18, '30, 40, 14', 0.4);   // pressed into the grass
  const caps = [];                                      // spread across, the ones behind a little higher and smaller
  for (let i = 0; i < n; i++) {
    const back = n === 1 ? 0 : h(i) * 0.14;
    caps.push({ x: n === 1 ? 0 : -0.5 + (i + 0.2 + 0.6 * h(10 + i)) / n, y: 0.62 - back, s: (1 - back * 2) * (0.8 + 0.25 * h(20 + i)) * (kind === 'chanterelle' ? 0.95 : 1), tilt: (h(30 + i) - 0.5) * 0.4 });
  }
  caps.sort((a, b) => a.y - b.y);
  for (const c of caps) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.tilt * 0.4); g.scale(c.s, c.s);
    if (kind === 'cep') {
      softIn(g, SHROOM_STEM, -0.4, 0.02, () => { g.moveTo(-0.12, 0); g.bezierCurveTo(-0.22, -0.08, -0.16, -0.3, -0.1, -0.38); g.lineTo(0.1, -0.38); g.bezierCurveTo(0.16, -0.3, 0.22, -0.08, 0.12, 0); g.closePath(); }, 1.1, 0.78);
      fillIn(g, 'rgba(226, 206, 140, 0.9)', () => ovalAt(g, 0, -0.39, 0.3, 0.06));     // the pale pores under the cap
      softIn(g, rgb, -0.62, -0.36, () => { g.ellipse(0, -0.4, 0.34, 0.24, 0, Math.PI, TAU); g.ellipse(0, -0.4, 0.34, 0.06, 0, 0, Math.PI); }, 1.3, 0.7);
      furGlow(g, [255, 220, 170], 0.4, -0.1, -0.54, 0.14, 0.06, -0.2);
    } else if (kind === 'field') {
      softIn(g, SHROOM_STEM, -0.26, 0.02, () => { g.moveTo(-0.06, 0); g.lineTo(-0.05, -0.26); g.lineTo(0.05, -0.26); g.lineTo(0.07, 0); g.closePath(); }, 1.1, 0.8);
      fillIn(g, 'rgb(128, 84, 74)', () => ovalAt(g, 0, -0.27, 0.24, 0.05));          // the gills, dark under the rim
      softIn(g, rgb, -0.46, -0.26, () => { g.ellipse(0, -0.28, 0.26, 0.19, 0, Math.PI, TAU); g.ellipse(0, -0.28, 0.26, 0.04, 0, 0, Math.PI); }, 1.05, 0.78);
      furGlow(g, [255, 255, 250], 0.6, -0.07, -0.4, 0.1, 0.05);
    } else {                                            // a chanterelle: a trumpet, its wavy rim turned up
      const edge = () => { g.moveTo(-0.27, -0.44); g.quadraticCurveTo(-0.14, -0.53, 0, -0.48); g.quadraticCurveTo(0.14, -0.54, 0.27, -0.44); };
      softIn(g, rgb, -0.48, 0.02, () => { g.moveTo(-0.045, 0); g.quadraticCurveTo(-0.07, -0.24, -0.27, -0.44); g.quadraticCurveTo(0, -0.36, 0.27, -0.44); g.quadraticCurveTo(0.07, -0.24, 0.045, 0); g.closePath(); }, 1.12, 0.74);
      strokeIn(g, rockRGB(tone(rgb, 0.78), 0.7), 0.016, () => { for (const k of [-0.7, -0.25, 0.25, 0.7]) { g.moveTo(k * 0.04, -0.02); g.quadraticCurveTo(k * 0.08, -0.24, k * 0.26, -0.41); } });   // its ridges
      fillIn(g, rockRGB(tone(rgb, 0.84)), () => { edge(); g.quadraticCurveTo(0, -0.37, -0.27, -0.44); });   // the hollow of its cap
      strokeIn(g, rockRGB(tone(rgb, 1.12, 22)), 0.03, edge);
    }
    g.restore();
  }
}
// Brackets: lobed fans in tiers, seen from a little above: the wood at the back, the top of each shelf in front of it and
// the thickness of its rim under that (an oyster's pale gills, a sulphur shelf's yellow underside). Oyster mushrooms spread
// along a log, chicken of the woods climbs a trunk. (0, 0) is where the middle of it grows out of the wood.
function paintShelves(g, kind, n, h, rgb) {
  const up = kind === 'sulphur', shelves = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    shelves.push(up ? { x: (h(i) - 0.5) * 0.18, y: 0.28 - t * 0.5, s: 1 - t * 0.25, k: i }
      : { x: -0.42 + t * 0.84 + (h(i) - 0.5) * 0.1, y: (h(10 + i) - 0.5) * 0.14, s: 0.85 + 0.25 * h(20 + i), k: i });
  }
  shelves.sort((a, b) => a.y - b.y);
  const under = up ? [250, 214, 70] : [218, 208, 190], rim = up ? [252, 222, 90] : tone(rgb, 1.15, 16);
  for (const f of shelves) {
    g.save(); g.translate(f.x, f.y); g.scale(f.s, f.s);
    const rx = up ? 0.34 : 0.28, ry = up ? 0.2 : 0.24, ph = h(40 + f.k) * TAU;
    const fan = (dy, k = 1) => {                       // the front edge in lobes, then the back edge along the wood
      g.moveTo(-rx * k, dy);
      for (let i = 1; i <= 24; i++) {
        const a = Math.PI - i / 24 * Math.PI, r = 1 + 0.07 * Math.sin(a * 6 + ph);
        g.lineTo(Math.cos(a) * rx * r * k, dy + Math.sin(a) * ry * r * k);
      }
      g.quadraticCurveTo(0, dy - ry * 0.45 * k, -rx * k, dy);
    };
    fillIn(g, 'rgba(40, 30, 20, 0.3)', () => fan(0.07));                     // its shadow on the wood
    fillIn(g, rockRGB(tone(under, 0.9)), () => fan(0.045));                   // the underside, showing under the rim
    softIn(g, rgb, -ry * 0.4, ry, () => fan(0), 0.82, 1.12);                   // the top, darker where it grows out of the wood
    strokeIn(g, rockRGB(rim, 0.85), 0.035, () => {                              // the rim, lit
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI - i / 24 * Math.PI, r = 1 + 0.07 * Math.sin(a * 6 + ph), x = Math.cos(a) * rx * r * 0.93, y = Math.sin(a) * ry * r * 0.88;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    });
    strokeIn(g, rockRGB(tone(rgb, 0.8), 0.35), 0.012, () => { for (let k = 1; k <= 3; k++) g.ellipse(0, 0, rx * k / 4, ry * k / 4, 0, 0.15, Math.PI - 0.15); });   // growth rings
    g.restore();
  }
}

// ------------------------------------------------------------------ spring greens
//
// Wild garlic and nettles (sim.js w.greens), painted once a look and size ('green:' + ((kind * 3 + stage) * 2 + look),
// GREEN_ARTS; stage from sim.js greenStage). Garlic is a carpet of broad bright leaves on the woodland floor, white starry
// heads on stalks when it flowers, yellowing and flopping as it dies back; it's drawn flat under all that stands
// (drawGarlic). Nettles are a stand of upright stems with pairs of toothed leaves: fresh short tops in spring, tall with
// hanging flower strings in summer, brown in autumn; drawn with the trees and animals, back to front. Both fade in as they
// come up and out as they go (greenFade), and a patch is bigger each spring it has come up (g.size). What the forager has
// picked shows (greenCut, 12 paintings a step): garlic clumps cut down to stubs, nettles with their tops pinched off, more
// with each pick, till a patch picked for now (sim.js greenPicked) is mostly stubs; they grow back as it does.
const GREEN_KINDS = ['garlic', 'nettle'];
const GREEN_ARTS = Array.from({ length: 48 }, (_, i) => 'green:' + i);
const GREEN_CUT = [0, 0.35, 0.65, 0.9];   // of its clumps or stems picked, at each step
const greenCut = g => S.greenPicked(g) ? 3 : g.pick > 0.5 ? 2 : g.pick > 0.12 ? 1 : 0;
const greenArt = (g, stage) => GREEN_ARTS[greenCut(g) * 12 + ((GREEN_KINDS.indexOf(g.kind) * 3 + stage) * 2) + g.look];
const GARLIC_PX = 2.4, NETTLE_PX = 1.7;   // a patch's painting, next to a rabbit
const GARLIC_RGB = [[92, 160, 58], [86, 150, 54], [178, 168, 84]];   // its leaves: up, in flower, dying back
const NETTLE_RGB = [[112, 170, 70], [64, 112, 46], [146, 110, 62]];  // young tops, summer, autumn
function paintGreen(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const look = n % 12, cut = GREEN_CUT[Math.floor(n / 12)], kind = GREEN_KINDS[Math.floor(look / 6)], stage = Math.floor(look / 2) % 3;
  const h = k => hash2(look, k, 77);                    // (picked or not, the same patch)
  if (kind === 'garlic') paintGarlic(g, stage, h, cut); else paintNettles(g, stage, h, cut);
}
// A cut stalk: a short stub from x, y leaning a, its pale cut end showing.
function greenStub(g, x, y, a, len, wide, rgb) {
  const tx = x + Math.sin(a) * len, ty = y - Math.cos(a) * len;
  strokeIn(g, rockRGB(tone(rgb, 0.85)), wide, () => { g.moveTo(x, y); g.lineTo(tx, ty); });
  fillIn(g, rockRGB(tone(rgb, 1.5, 50)), () => ovalAt(g, tx, ty, wide * 0.6, wide * 0.35, a));
}
// A broad leaf on a stalk from (x, y), leaning a, len long.
function garlicLeaf(g, x, y, a, len, wide, rgb) {
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -len, 0, () => { g.moveTo(0, 0); g.quadraticCurveTo(wide * 1.3, -len * 0.55, 0, -len); g.quadraticCurveTo(-wide * 1.3, -len * 0.55, 0, 0); }, 1.18, 0.78);
  strokeIn(g, rockRGB(tone(rgb, 1.25, 18), 0.6), 0.012, () => { g.moveTo(0, -len * 0.08); g.lineTo(0, -len * 0.9); });
  g.restore();
}
function paintGarlic(g, stage, h, cut) {
  softSpot(g, 0, 0.5, 1.15, 0.3, '30, 50, 14', 0.25);
  const rgb = GARLIC_RGB[stage], clumps = [];
  for (let i = 0; i < 18; i++) { const a = h(i) * TAU, r = Math.sqrt(h(20 + i)); clumps.push({ x: Math.cos(a) * r * 1.0, y: 0.42 + Math.sin(a) * r * 0.26, k: i }); }
  clumps.sort((a, b) => a.y - b.y);
  for (const c of clumps) {
    const s = 0.75 + 0.25 * (c.y - 0.18) / 0.48, droop = stage === 2 ? 0.7 : 0;   // (further back, smaller)
    if (h(120 + c.k) < cut) {                           // picked: its leaves cut down to stubs
      for (let j = 0; j < 3; j++) greenStub(g, c.x + (j - 1) * 0.03 * s, c.y, (j - 1) * 0.35 + (h(40 + c.k * 4 + j) - 0.5) * 0.3, (0.05 + 0.03 * h(60 + c.k * 4 + j)) * s, 0.024 * s, rgb);
      continue;
    }
    for (let j = 0; j < 4; j++) {
      const a = (j - 1.5) * (0.45 + droop * 0.5) + (h(40 + c.k * 4 + j) - 0.5) * 0.3;
      garlicLeaf(g, c.x, c.y, a, (0.3 + 0.12 * h(60 + c.k * 4 + j)) * s * (1 - droop * 0.35), 0.09 * s, j % 2 ? rgb : tone(rgb, 0.9));
    }
    if (stage === 1 && c.k % 3 !== 2) {                 // a flower head on its stalk, a loose star of white
      const top = c.y - 0.45 * s, x = c.x + (h(80 + c.k) - 0.5) * 0.06;
      strokeIn(g, rockRGB(tone(rgb, 0.85)), 0.018, () => { g.moveTo(c.x, c.y); g.quadraticCurveTo(c.x, top + 0.2, x, top); });
      for (let f = 0; f < 7; f++) { const fa = f / 7 * TAU + h(90 + c.k), fr = 0.06 * s; fillIn(g, '#f8f6ee', () => discAt(g, x + Math.cos(fa) * fr, top + Math.sin(fa) * fr * 0.7, 0.026 * s)); }
      fillIn(g, '#fffef8', () => discAt(g, x, top - 0.01, 0.03 * s));
    }
  }
}
// A nettle leaf: a pointed heart, toothed all round.
function nettleLeaf(g, x, y, a, len, rgb) {
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -len * 0.4, len * 0.4, () => {
    for (let i = 0; i <= 16; i++) {
      const t = i / 16 * TAU, r = i % 2 ? 0.86 : 1, px = Math.sin(t) * len * 0.36 * r * (t < Math.PI ? 1 : 1), py = -Math.cos(t) * len * 0.5 * r + len * 0.5;
      const tip = (1 - Math.cos(t)) / 2;                // narrows to the tip, away from the stem
      i ? g.lineTo(px * (1.1 - 0.5 * tip), py) : g.moveTo(px, py);
    }
  }, 1.15, 0.75);
  strokeIn(g, rockRGB(tone(rgb, 1.3, 16), 0.5), 0.01, () => { g.moveTo(0, len * 0.05); g.lineTo(0, len * 0.9); });
  g.restore();
}
function paintNettles(g, stage, h, cut) {
  softSpot(g, 0, 0.62, 0.7, 0.18, '30, 40, 14', 0.35);
  const rgb = NETTLE_RGB[stage], stems = [], tall = stage === 0 ? 0.6 : 1.1;
  for (let i = 0; i < 5; i++) stems.push({ x: (i / 4 - 0.5) * 1.0 + (h(i) - 0.5) * 0.14, y: 0.62 - h(10 + i) * 0.14, k: i });
  stems.sort((a, b) => a.y - b.y);
  for (const st of stems) {
    const picked = h(120 + st.k) < cut, short = picked ? 0.45 : 1;   // (picked: its top pinched off, a bare stalk left)
    const top = st.y - tall * short * (0.65 + 0.5 * h(20 + st.k)) * (1 - (0.62 - st.y)), lean = (h(30 + st.k) - 0.5) * 0.12 + (stage === 2 ? 0.08 : 0);
    const at = t => [st.x + lean * t * t, st.y + (top - st.y) * t];
    strokeIn(g, rockRGB(tone(rgb, stage === 2 ? 0.9 : 0.72)), 0.022, () => { g.moveTo(st.x, st.y); for (let t = 0.1; t <= 1.001; t += 0.1) g.lineTo(...at(t)); });
    if (picked) { const [x, y] = at(1); fillIn(g, rockRGB(tone(rgb, 1.5, 50)), () => ovalAt(g, x, y, 0.016, 0.01)); }
    const pairs = picked ? 1 : stage === 0 ? 2 : 4;
    for (let p = 0; p < pairs; p++) {
      const t = 0.28 + 0.72 * p / pairs, [x, y] = at(t), len = (0.36 - 0.14 * t) * (stage === 0 ? 1.1 : 1), spread = stage === 0 ? 2.3 + 0.3 * t : stage === 2 ? 0.7 : 1.15 + 0.25 * t;   // (young ones reach up, in summer they droop)
      if (stage === 2 && h(40 + st.k * 8 + p) < 0.45) continue;   // (autumn: some gone)
      for (const e of [-1, 1]) nettleLeaf(g, x, y, e * spread, len, e < 0 ? rgb : tone(rgb, 0.9));
      if (stage === 1 && p > 0) for (const e of [-1, 1]) strokeIn(g, 'rgba(150, 150, 92, 0.85)', 0.014, () => { g.moveTo(x, y); g.quadraticCurveTo(x + e * 0.1, y + 0.02, x + e * 0.13, y + 0.16); });   // the hanging flower strings
    }
    if (stage === 0 && !picked) { const [x, y] = at(1); for (const e of [-1, 1]) nettleLeaf(g, x, y, e * 2.8, 0.16, tone(rgb, 1.15, 20)); }   // the fresh tip, its first leaves still folded up
  }
}

// How far a patch has come up or gone over: 0..1 (sim.js GREEN_SEASONS).
function greenFade(g, stage) {
  const p = S.springPart(world.tick), s = S.seasonOf(world.tick);
  if (s === 0 && p < 0.08) return 0.2 + 0.8 * p / 0.08;
  if (stage === 2) { const end = S.GREEN_SEASONS[g.kind][1][1]; return clamp(1 - 0.75 * p / end, 0.25, 1); }
  return 1;
}
// Its portrait in the inspector: its painting as it is now.
function greenFace(g, stage) {
  const art = greenArt(g, stage);
  if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
  return `<img src="${portraits.get(art)}" alt="${g.kind === 'garlic' ? 'Wild garlic' : 'Nettles'}" style="width: 125%">`;
}
const garlicPx = (g, z) => Math.max(10, (8 + z) * GARLIC_PX * (0.75 + 0.15 * g.size));
const nettlePx = (g, z) => Math.max(6, (8 + z) * NETTLE_PX * (0.75 + 0.15 * g.size));
// The garlic, flat on the woodland floor, under all that stands.
function drawGarlic(z) {
  for (const g of world.greens) {
    if (g.kind !== 'garlic') continue;
    const stage = S.greenStage(world, g);
    if (stage === null) continue;
    const px = garlicPx(g, z), sx = (g.x - cam.x) * z + vw / 2, sy = (g.y - cam.y) * z + vh / 2;
    if (!visible(sx, sy, px) || !fadeAt(g.x, g.y)) continue;
    const f = greenFade(g, stage);
    drawEmoji(greenArt(g, stage), sx, sy - px * 0.2, px, { alpha: f < 1 ? f : undefined, flip: g.look === 1 && g.born % 2 === 0 });
  }
  unfade();
}
function drawNettles(g, z) {
  const stage = S.greenStage(world, g), px = nettlePx(g, z), f = greenFade(g, stage);
  drawEmoji(greenArt(g, stage), (g.x - cam.x) * z + vw / 2, (g.y - cam.y) * z + vh / 2 - px * 0.31, px, { alpha: f < 1 ? f : undefined, flip: g.born % 2 === 1 });
}

// ------------------------------------------------------------------ brambles
//
// Brambles (sim.js w.brambles) are painted once a look and size ('bramble:' + (stage * 2 + look), BRAMBLE_ARTS): a mound
// of arching purple canes with leaves of three or five toothed leaflets. Bare canes and a few dark leaves in winter,
// fresh green in spring, pale pink-white flowers early in summer, berries green and red, then ripe and black (three
// paintings, by how many the crows have left, bramblePicked), and red leaves with a few shrivelled berries as they go
// over. Drawn with the trees and animals, back to front (a frame item's s); a patch is bigger each spring (b.size).
const BRAMBLE_ARTS = Array.from({ length: 16 }, (_, i) => 'bramble:' + i);
const BRAMBLE_PX = 2.4;                    // a grown patch's painting, next to a rabbit
const CANE_RGB = [118, 48, 64];
const BRAMBLE_LEAF = [[58, 82, 50], [92, 150, 58], [70, 128, 52], [70, 124, 50], [62, 112, 46], [62, 112, 46], [66, 108, 46], [150, 60, 58]];
const BRAMBLE_BERRIES = [0, 0, 0, 14, 22, 11, 4, 4];   // berries painted at each stage
// Its painting now: sim.js brambleStage, the ripe stage split by what's left on it. Ripe before its crop is in (the
// hour sim.js sets it) still shows ripening.
function brambleArt(b) {
  let st = S.brambleStage(world, b);
  if (st === 4) {
    const year = Math.floor(world.tick / S.TPD / S.YEAR_DAYS) + 1, left = b.crop > 0 ? b.berries / b.crop : 0;
    st = b.year !== year ? 3 : left > 0.6 ? 4 : left > 0.25 ? 5 : 6;
  } else if (st === 5) st = 7;
  return st;
}
function paintBramble(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const st = n >> 1, look = n & 1, h = k => hash2(look, k, 53), leaf = BRAMBLE_LEAF[st], foot = 0.62, bare = st === 0;
  const top = x => foot - 0.78 * Math.sqrt(Math.max(0, 1 - (x / 0.95) ** 2)) * (1 + 0.12 * Math.sin(x * 3 + look * 2));   // the mound's top at x
  softSpot(g, 0, foot, 1.2, 0.26, '28, 34, 14', 0.45);
  // The canes, arching up out of the mound and down to the ground past its sides: from, the arch's pull, the tip.
  const canes = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1, x0 = side * (0.15 + 0.5 * h(i)), reach = 0.35 + 0.35 * h(10 + i);
    canes.push({ x0, y0: top(x0) + 0.15, cx: x0 + side * reach * (0.6 + 0.4 * h(25 + i)), cy: top(x0) - 0.08 - 0.22 * h(20 + i), x1: clamp(x0 + side * reach * 1.7, -1.25, 1.25), y1: foot - 0.02 - 0.16 * h(30 + i), k: i });
  }
  const cane = c => strokeIn(g, rockRGB(tone(CANE_RGB, 0.75 + 0.3 * h(40 + c.k))), 0.024, () => { g.moveTo(c.x0, c.y0); g.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1); });
  if (bare) {                                           // winter: a tangle of canes, a few dark leaves hanging on
    const dull = [100, 54, 62];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, x0 = (h(55 + i) - 0.5) * 0.7, x1 = clamp(x0 + side * (0.4 + 0.7 * h(45 + i)), -1.2, 1.2), cy = foot - 0.6 - 0.5 * h(65 + i);
      strokeIn(g, rockRGB(tone(dull, 0.6 + 0.4 * h(50 + i))), 0.026, () => { g.moveTo(x0, foot); g.quadraticCurveTo(x0 + (x1 - x0) * (0.2 + 0.5 * h(85 + i)), cy, x1, foot - 0.03 - 0.12 * h(75 + i)); });
    }
    for (let i = 0; i < 14; i++) { const x = (h(90 + i) - 0.5) * 1.5, y = foot - 0.05 - 0.45 * h(95 + i) * (1 - Math.abs(x) / 1.2); brambleLeaf(g, x, y, (h(70 + i) - 0.5) * 2, 0.15, tone(i % 3 ? leaf : [92, 52, 64], 0.75 + 0.35 * h(80 + i)), 3); }
    return;
  }
  for (const c of canes) cane(c);                       // (behind the leaves: only their arches and tips show)
  softIn(g, tone(leaf, 0.55), foot - 0.85, foot, () => { g.moveTo(-0.8, foot - 0.02); for (let x = -0.9; x <= 0.901; x += 0.05) g.lineTo(x, Math.min(foot - 0.06, top(x) + 0.1)); g.lineTo(0.8, foot - 0.02); g.quadraticCurveTo(0, foot + 0.04, -0.8, foot - 0.02); }, 1.1, 0.7);   // the shade in the mound
  const spots = [];                                     // leaves all over the mound, and flowers and berries among them
  const leaves = st === 7 ? 56 : 72;
  for (let i = 0; i < leaves; i++) { const x = (h(100 + i) * 2 - 1) * 0.95, y = foot - (foot - top(x) - 0.04) * h(200 + i) ** 0.8; spots.push({ x, y, k: i, leaf: true }); }
  const flowers = st === 2 ? 16 : 0, berries = BRAMBLE_BERRIES[st];
  for (let i = 0; i < flowers + berries; i++) { const x = (h(300 + i) * 2 - 1) * 0.82, y = foot - 0.12 - (foot - 0.12 - top(x) - 0.02) * (0.25 + 0.75 * h(400 + i)); spots.push({ x, y: y + 0.001, k: i, flower: i < flowers }); }
  spots.sort((a, b) => a.y - b.y);
  for (const p of spots) {
    if (p.leaf) {
      const lit = 1 - (p.y - top(p.x)) / Math.max(0.1, foot - top(p.x));   // (lit on top, shaded low down)
      const rgb = st === 7 ? tone([[150, 60, 58], [122, 48, 70], [176, 118, 58], [96, 104, 50]][p.k % 4], 0.8 + 0.3 * lit) : tone(leaf, 0.72 + 0.42 * lit + 0.1 * h(500 + p.k));
      brambleLeaf(g, p.x, p.y + 0.06, (h(600 + p.k) - 0.5) * 2.2, 0.15 + 0.05 * h(700 + p.k), rgb, p.k % 3 ? 3 : 5);
    } else if (p.flower) {
      for (let f = 0; f < 5; f++) { const a = f / 5 * TAU + h(800 + p.k), r = 0.05; fillIn(g, '#f8eaf0', () => discAt(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.85, 0.038)); }
      fillIn(g, '#e6cc6a', () => discAt(g, p.x, p.y, 0.024));
    } else brambleBerry(g, p.x, p.y, st === 3 ? [0, 1, 1, 0, 2][p.k % 5] : st === 7 ? 4 : st === 4 && p.k % 6 === 5 ? 1 : st === 4 && p.k % 6 === 2 ? 2 : 3);
  }
  for (let i = 0; i < 2; i++) { const c = canes[(i * 3 + look) % canes.length]; g.save(); g.beginPath(); g.rect(-1.3, -1.3, 2.6, 1.3 + top(c.x0) + 0.02); g.clip(); cane(c); g.restore(); }   // (a few arching over the top)
}
// A leaf: n toothed leaflets fanned out from the stalk at x, y, turned a.
function brambleLeaf(g, x, y, a, len, rgb, n) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (n === 3 ? 1.5 : 2.2), l = len * (i === (n - 1) / 2 ? 1 : 0.8);
    g.save(); g.rotate(t);
    softIn(g, rgb, -l, 0, () => {
      g.moveTo(0, 0);
      for (let k = 1; k <= 6; k++) { const v = k / 6, wv = Math.sin(v * Math.PI) * l * 0.36 * (k % 2 ? 1 : 0.86); g.lineTo(wv, -v * l); }
      for (let k = 5; k >= 0; k--) { const v = k / 6, wv = Math.sin(v * Math.PI) * l * 0.36 * (k % 2 ? 1 : 0.86); g.lineTo(-wv, -v * l); }
    }, 1.15, 0.72);
    g.restore();
  }
  g.restore();
}
// A berry: a cluster of drupelets. ripe: 0 green, 1 red, 2 going dark, 3 black, 4 shrivelled.
const BERRY_RGB = [[150, 176, 84], [196, 44, 52], [104, 26, 50], [42, 20, 40], [70, 46, 48]];
function brambleBerry(g, x, y, ripe) {
  const rgb = BERRY_RGB[ripe], r = ripe === 4 ? 0.026 : 0.036;
  fillIn(g, rockRGB(tone(rgb, 0.7)), () => ovalAt(g, x, y, r * 1.9, r * 2.2));
  for (const [dx, dy] of [[-1, -1], [1, -1], [0, -0.3], [-1, 0.6], [1, 0.6], [0, 1.3]]) fillIn(g, rockRGB(rgb), () => discAt(g, x + dx * r * 0.9, y + dy * r, r * 0.8));
  if (ripe !== 4) fillIn(g, 'rgba(255, 255, 255, 0.55)', () => discAt(g, x - r * 0.6, y - r * 0.9, r * 0.35));   // (a shine)
}
// Its size on screen, and its painting in the inspector.
const bramblePx = (b, z) => Math.max(8, (8 + z) * BRAMBLE_PX * (0.6 + 0.2 * b.size));
function brambleFace(b) {
  const art = BRAMBLE_ARTS[brambleArt(b) * 2 + b.look];
  if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
  return `<img src="${portraits.get(art)}" alt="A bramble" style="width: 125%">`;
}
function drawBramble(b, z) {
  const px = bramblePx(b, z);
  drawEmoji(BRAMBLE_ARTS[brambleArt(b) * 2 + b.look], (b.x - cam.x) * z + vw / 2, (b.y - cam.y) * z + vh / 2 - px * 0.31, px, { flip: b.born % 2 === 1 });
}

// ------------------------------------------------------------------ wild finds
//
// The little things to pick about the meadow (sim.js w.finds), painted once a look and size ('find:' + (kind * 4 + stage *
// 2 + look), FIND_ARTS): dandelions (a rosette of toothed leaves, bright yellow heads), sorrel (broad lime arrow-leaves on
// red stalks), wild strawberries (trefoil leaves, small scarlet berries), elderflower (a round shrub with cream plates of
// flowers), hazelnuts (nuts in frilly husks on fallen leaves), rosehips (an arching rose, scarlet hips; bare in winter,
// stage 1) and watercress (sprigs of round glossy leaflets in the shallows; in the ice, stage 1: findStage). A stage is the
// same plant, painted again (its hash numbers don't change). A bit bigger and brighter than the meadow's own flowers and tufts, so
// they read as something to pick. Drawn with the trees and animals, back to front (a frame item's s), they come up over a
// few hours and fade as they go (drawFind).
const FIND_KINDS = S.FIND_KINDS;
const FIND_ARTS = Array.from({ length: FIND_KINDS.length * 4 }, (_, i) => 'find:' + i);
const FIND_PX = { dandelion: 1.9, sorrel: 1.8, strawberry: 2.1, elderflower: 2.5, hazelnut: 1.8, rosehip: 2.5, watercress: 2.0,   // next to a rabbit
  stick: 1.9, pebble: 1.35, drygrass: 1.8, birchbark: 1.5 };
const FIND_GROW = 0.2, FIND_OVER = 0.4;   // days it takes to come up, and its last days, fading
const findStage = f => (f.kind === 'rosehip' ? S.seasonOf(world.tick) === 3 : f.kind === 'watercress' && world.frozen) ? 1 : 0;   // (bare; in the ice)
const findArt = f => FIND_ARTS[FIND_KINDS.indexOf(f.kind) * 4 + findStage(f) * 2 + f.look];
const findPx = (f, z) => Math.max(7, (8 + z) * FIND_PX[f.kind] * (0.55 + 0.45 * clamp((world.tick - f.born) / (FIND_GROW * S.TPD), 0, 1)));
function drawFind(f, z) {
  const px = findPx(f, z), left = (f.until - world.tick) / S.TPD;
  drawEmoji(findArt(f), (f.x - cam.x) * z + vw / 2, (f.y - cam.y) * z + vh / 2 - px * 0.31, px,
    { alpha: left < FIND_OVER ? 0.3 + 0.7 * left / FIND_OVER : undefined, flip: f.born % 2 === 1 });
}

// What the forager dropped (sim.js w.dropped): its satchel painting, lying on the ground at about a find's size, a pile
// a little bigger. It lands as the one flying down from the satchel gets there (dropLand), with a little bounce, and
// fades over its last DROP_FADE of DROP_DAYS (then it's gone).
const DROP_FLY = 340, DROP_BOUNCE = 220, DROP_FADE = 0.25;   // ms the fall takes, ms of the bounce, the share of its time it fades over
const dropLand = new Map();                                 // a drop still flying down: when it lands (ms)
const dropPx = (d, z) => Math.max(8, (8 + z) * 0.6 * (ITEM_FILL[d.kind] || 1) * (d.n > 4 ? 1.15 : 1));   // (about a quarter of the forager)
function drawDropped(d, z, now) {
  let px = dropPx(d, z), lift = 0;
  const lands = dropLand.get(d);
  if (lands !== undefined) {
    if (now < lands) return;
    const t = (now - lands) / DROP_BOUNCE;
    if (t >= 1) dropLand.delete(d);
    else { lift = Math.sin(t * Math.PI) * px * 0.25 * (1 - t); px *= 1 + 0.12 * Math.sin(t * Math.PI); }
  }
  const left = (d.until - world.tick) / (S.DROP_DAYS * S.TPD);
  if (left <= 0) return;                                    // (gone: sim.js takes it off the list within a second)
  drawEmoji(ITEM_ART[d.kind] || Recipes.INGREDIENTS[d.kind]?.icon || '❔', (d.x - cam.x) * z + vw / 2, (d.y - cam.y) * z + vh / 2 - px * 0.3 - lift, px,
    { alpha: left < DROP_FADE ? 0.25 + 0.75 * left / DROP_FADE : undefined });
}

function paintFind(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const kind = FIND_KINDS[n >> 2], stage = (n >> 1) & 1, look = n & 1, h = k => hash2(look, k, 61 + (n >> 2));   // (a stage is the same plant)
  ({ dandelion: paintDandelion, sorrel: paintSorrel, strawberry: paintStrawberry, elderflower: paintElder, hazelnut: paintHazel,
    rosehip: paintRose, watercress: paintCress, stick: paintSticks, pebble: paintPebbles, drygrass: paintDryGrass, birchbark: paintBark })[kind](g, h, look, stage);
}
const FIND_FOOT = 0.62;                        // where the ground is in a painting's box
// A long leaf with jagged teeth, lying out from x, y at angle a.
function toothedLeaf(g, x, y, a, len, wide, rgb, teeth = 4) {
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -wide, wide, () => {
    g.moveTo(0, 0);
    for (let k = 1; k <= teeth * 2; k++) { const t = k / (teeth * 2), wv = wide * Math.sin(t * Math.PI) ** 0.7 * (k % 2 ? 1 : 0.45); g.lineTo(t * len - (k % 2 ? len * 0.04 : 0), -wv); }
    for (let k = teeth * 2 - 1; k >= 0; k--) { const t = k / (teeth * 2), wv = wide * Math.sin(t * Math.PI) ** 0.7 * (k % 2 ? 1 : 0.45); g.lineTo(t * len - (k % 2 ? len * 0.04 : 0), wv); }
  }, 1.2, 0.72);
  strokeIn(g, rockRGB(tone(rgb, 1.3, 20), 0.55), 0.014, () => { g.moveTo(0, 0); g.lineTo(len * 0.9, 0); });
  g.restore();
}
function paintDandelion(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.85, 0.2, '30, 50, 14', 0.35);
  const leaf = [70, 142, 46];
  for (let i = 0; i < 9; i++) {                         // the rosette, flat on the ground
    const a = (i / 9) * TAU + h(i) * 0.4, len = 0.5 + 0.2 * h(10 + i);
    g.save(); g.translate(0, FIND_FOOT - 0.04); g.scale(1, 0.42);
    toothedLeaf(g, 0, 0, a, len, 0.11, i % 2 ? leaf : tone(leaf, 0.86));
    g.restore();
  }
  const heads = [];
  for (let i = 0; i < 3; i++) heads.push({ x: (i - 1) * 0.36 + (h(20 + i) - 0.5) * 0.14, y: FIND_FOOT - 0.42 - 0.22 * h(30 + i) + (i === 1 ? -0.12 : 0), k: i });
  for (const p of heads) {
    strokeIn(g, 'rgb(118, 160, 70)', 0.035, () => { g.moveTo(p.x * 0.4, FIND_FOOT - 0.05); g.quadraticCurveTo(p.x * 0.8, (FIND_FOOT + p.y) / 2, p.x, p.y + 0.06); });
    if (look === 1 && p.k === 2) {                      // a clock gone to seed
      fillIn(g, 'rgba(255, 255, 255, 0.35)', () => discAt(g, p.x, p.y, 0.17));
      strokeIn(g, 'rgba(255, 255, 255, 0.85)', 0.012, () => { for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(a) * 0.16, p.y + Math.sin(a) * 0.16); } });
      fillIn(g, '#f4f0e0', () => discAt(g, p.x, p.y, 0.035));
      continue;
    }
    fillIn(g, 'rgb(96, 128, 52)', () => ovalAt(g, p.x, p.y + 0.06, 0.08, 0.05));   // the green cup under the head
    for (let ring = 0; ring < 3; ring++) {              // rays, in rings from the rim in
      const r = 0.19 - ring * 0.055, n = 16 - ring * 4, rgb = ring === 0 ? [250, 200, 24] : ring === 1 ? [255, 214, 40] : [255, 226, 70];
      strokeIn(g, rockRGB(rgb), 0.05 - ring * 0.008, () => { for (let k = 0; k < n; k++) { const a = (k + ring * 0.5) / n * TAU; g.moveTo(p.x + Math.cos(a) * r * 0.25, p.y + Math.sin(a) * r * 0.2); g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.82); } });
    }
    fillIn(g, 'rgb(236, 160, 20)', () => ovalAt(g, p.x, p.y, 0.045, 0.036));
    furGlow(g, [255, 250, 200], 0.5, p.x - 0.05, p.y - 0.05, 0.08, 0.05);
  }
}
// An arrow-head leaf: a broad spear with two lobes pointing back past its stalk, lying out from x, y at angle a. flat:
// how much it's foreshortened, leaning toward you.
function sorrelLeaf(g, x, y, a, len, rgb, flat) {
  const w = len * 0.3;
  g.save(); g.translate(x, y); g.rotate(a); g.scale(1, flat);
  softIn(g, rgb, -len, len * 0.1, () => {
    g.moveTo(0, 0);
    g.quadraticCurveTo(-w * 0.4, len * 0.02, -w * 0.8, len * 0.14);            // the left lobe, back past the stalk
    g.quadraticCurveTo(-w * 1.05, -len * 0.12, -w * 0.92, -len * 0.36);
    g.quadraticCurveTo(-w * 0.62, -len * 0.78, 0, -len);
    g.quadraticCurveTo(w * 0.62, -len * 0.78, w * 0.92, -len * 0.36);
    g.quadraticCurveTo(w * 1.05, -len * 0.12, w * 0.8, len * 0.14);
    g.quadraticCurveTo(w * 0.4, len * 0.02, 0, 0);
  }, 1.22, 0.78);
  furGlow(g, [176, 70, 52], 0.45, 0, -len * 0.04, w * 0.45, len * 0.14);      // a blush of red where the stalk comes in
  strokeIn(g, rockRGB(tone(rgb, 1.25, 30), 0.6), 0.016, () => { g.moveTo(0, -len * 0.02); g.quadraticCurveTo(w * 0.05, -len * 0.5, 0, -len * 0.92); });
  g.restore();
}
// Sorrel: a loose rosette of broad lime arrow-leaves on red stalks, the back ones standing, the front ones leaning out to
// you (so it doesn't read as a tuft of grass); look 1 has gone to seed, with branched spikes of rusty seed.
function paintSorrel(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.75, 0.2, '30, 50, 14', 0.35);
  const fy = FIND_FOOT - 0.03, leaves = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1, k = i >> 1, back = k < 2;
    leaves.push({ a: side * (0.2 + 0.36 * k + 0.15 * h(i)), len: (back ? 0.52 : 0.42) + 0.1 * h(10 + i), stalk: 0.14 + 0.1 * h(20 + i),
      flat: back ? 1 : 0.78, rgb: i % 3 ? [126, 186, 64] : [104, 166, 52] });
  }
  leaves.sort((p, q) => Math.abs(p.a) - Math.abs(q.a));  // (the upright ones behind)
  for (const L of leaves) {
    const sx = Math.sin(L.a) * L.stalk, sy = fy - Math.cos(L.a) * L.stalk * L.flat;
    strokeIn(g, 'rgb(172, 70, 56)', 0.022, () => { g.moveTo(0, fy); g.quadraticCurveTo(sx * 0.4, fy - L.stalk * 0.6, sx, sy); });   // the red stalk
    sorrelLeaf(g, sx, sy, L.a, L.len, L.rgb, L.flat);
  }
  if (look === 1) [[-0.05, 1], [0.18, 0.78]].forEach(([x, tall], j) => {   // the spikes of seed, up out of the middle
    const top = fy - (1.0 + 0.15 * h(40 + j)) * tall, mid = fy - 0.25;
    strokeIn(g, 'rgb(150, 74, 56)', 0.022, () => {
      g.moveTo(x * 0.3, mid); g.lineTo(x, top);
      for (const t of [0.25, 0.45]) { const y = top + (mid - top) * t; g.moveTo(x, y + 0.08); g.lineTo(x + (t < 0.3 ? 0.09 : -0.08), y - 0.04); }
    });
    for (let k = 0; k < 18; k++) {
      const t = (k >> 1) / 9, bx = k % 4 === 3 ? (t < 0.3 ? 0.07 : -0.06) : k % 2 ? 0.022 : -0.022;
      fillIn(g, rockRGB(tone([190, 70, 52], 0.8 + 0.35 * h(50 + j * 20 + k))), () => discAt(g, x + bx, top + 0.02 + t * (mid - top) * 0.6, 0.024));
    }
  });
}
// A trefoil: three round toothed leaflets.
function trefoil(g, x, y, a, r, rgb) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (const t of [-0.75, 0, 0.75]) {
    g.save(); g.rotate(t);
    softIn(g, rgb, -r * 2, 0, () => { g.moveTo(0, 0); for (let k = 0; k <= 12; k++) { const v = k / 12 * TAU, rr = r * (k % 2 ? 0.92 : 1); g.lineTo(Math.sin(v) * rr * 0.8, -r - Math.cos(v) * rr); } g.closePath(); }, 1.2, 0.72);
    strokeIn(g, rockRGB(tone(rgb, 1.3, 20), 0.45), 0.01, () => { g.moveTo(0, 0); g.lineTo(0, -r * 1.8); });
    g.restore();
  }
  g.restore();
}
function paintStrawberry(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.8, 0.2, '30, 50, 14', 0.35);
  const leaf = [62, 128, 46];
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * 1.1 + (h(i) - 0.5) * 0.1, y = FIND_FOOT - 0.12 - 0.22 * h(10 + i);
    strokeIn(g, 'rgb(110, 120, 60)', 0.018, () => { g.moveTo(x * 0.4, FIND_FOOT - 0.02); g.lineTo(x, y); });
    trefoil(g, x, y, (h(20 + i) - 0.5) * 0.8, 0.13, i % 2 ? leaf : tone(leaf, 0.85));
  }
  if (look === 0) {                                     // a last flower, white with a yellow eye
    const x = 0.28, y = FIND_FOOT - 0.5;
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; fillIn(g, '#fbfaf4', () => discAt(g, x + Math.cos(a) * 0.055, y + Math.sin(a) * 0.05, 0.05)); }
    fillIn(g, '#efc838', () => discAt(g, x, y, 0.035));
  }
  for (let i = 0; i < 6; i++) {                         // the berries, hanging on thin stalks in front
    const x = (i / 5 - 0.5) * 0.95 + (h(30 + i) - 0.5) * 0.12, y = FIND_FOOT - 0.12 - 0.1 * h(40 + i), r = 0.075 + 0.025 * h(50 + i), ripe = i !== 2 || look === 1;
    strokeIn(g, 'rgb(100, 128, 56)', 0.014, () => { g.moveTo(x * 0.6, y - 0.22); g.quadraticCurveTo(x, y - 0.2, x, y - r); });
    const rgb = ripe ? [226, 34, 44] : [236, 200, 150];
    softIn(g, rgb, y - r, y + r * 1.3, () => { g.moveTo(x - r, y - r * 0.4); g.quadraticCurveTo(x - r, y + r * 0.9, x, y + r * 1.35); g.quadraticCurveTo(x + r, y + r * 0.9, x + r, y - r * 0.4); g.quadraticCurveTo(x, y - r * 1.1, x - r, y - r * 0.4); }, 1.15, 0.7);
    for (let k = 0; k < 6; k++) fillIn(g, 'rgba(255, 226, 120, 0.9)', () => discAt(g, x + (h(60 + i * 6 + k) - 0.5) * r * 1.3, y + (h(70 + i * 6 + k) - 0.3) * r * 1.4, 0.008));
    fillIn(g, 'rgb(84, 140, 52)', () => { for (let k = 0; k < 5; k++) { const a = Math.PI + k / 4 * Math.PI; g.moveTo(x, y - r * 0.5); g.lineTo(x + Math.cos(a) * r * 0.9, y - r * 0.5 + Math.sin(a) * r * 0.5); } g.lineTo(x, y - r * 0.5); });
    if (ripe) furGlow(g, [255, 210, 210], 0.6, x - r * 0.35, y - r * 0.1, r * 0.3, r * 0.22);
  }
}
// A leaf of an elder or a rose: leaflets in pairs along a stalk, one at the tip.
function pinnate(g, x, y, a, len, rgb, pairs, w = 0.32) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let p = 0; p <= pairs; p++) {
    const t = p === pairs ? 1 : 0.25 + 0.6 * p / pairs, l = len * (p === pairs ? 0.42 : 0.36);
    for (const e of p === pairs ? [0] : [-1, 1]) {
      g.save(); g.translate(0, -len * t); g.rotate(e * 1.0);
      softIn(g, rgb, -l, 0, () => { g.moveTo(0, 0); g.quadraticCurveTo(l * w, -l * 0.5, 0, -l); g.quadraticCurveTo(-l * w, -l * 0.5, 0, 0); }, 1.18, 0.75);
      g.restore();
    }
  }
  g.restore();
}
// An elder: one round shrub, a dome of leafy clumps lit from above with the odd leaf of five leaflets standing out at its rim,
// a few short stems at its foot, and the flat cream plates of flowers on top, lacy with tiny florets.
function paintElder(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.95, 0.22, '28, 40, 14', 0.45);
  const leaf = [68, 118, 50], R = 0.82, T = 0.98, top = x => FIND_FOOT - 0.06 - T * Math.sqrt(Math.max(0, 1 - (x / R) ** 2));
  strokeIn(g, 'rgb(112, 98, 78)', 0.045, () => { for (const x of [-0.3, -0.05, 0.22]) { g.moveTo(x * 0.4, FIND_FOOT); g.lineTo(x, FIND_FOOT - 0.3); } });
  softSpot(g, 0, FIND_FOOT - 0.45, 0.7, 0.4, '30, 56, 24', 0.9);               // the shade inside it
  for (let i = 0; i < 11; i++) {                        // leaves peeping out round the rim
    const a = Math.PI * (1.04 + 0.92 * i / 10) + (h(300 + i) - 0.5) * 0.15;
    pinnate(g, Math.cos(a) * R * 0.8, FIND_FOOT - 0.16 + Math.sin(a) * T * 0.78, a + Math.PI / 2, 0.3, tone(leaf, 0.7 + 0.3 * h(320 + i)), 2, 0.34);
  }
  const clumps = [];
  for (let i = 0; i < 20; i++) {                        // the leafy clumps that make the dome
    const x = (h(i) * 2 - 1) * R * 0.86, y = top(x) + 0.13 + (FIND_FOOT - 0.18 - top(x) - 0.13) * h(40 + i) ** 1.3;
    clumps.push({ x, y, r: 0.19 + 0.08 * h(80 + i), k: i });
  }
  clumps.sort((a, b) => a.y - b.y);
  for (const c of clumps) {
    const lit = clamp(1 - (c.y - (FIND_FOOT - 0.06 - T)) / T, 0, 1), rgb = tone(leaf, 0.68 + 0.5 * lit);
    softIn(g, rgb, c.y - c.r, c.y + c.r, () => {
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + h(120 + c.k), rr = c.r * 0.55; discAt(g, c.x + Math.cos(a) * rr * 0.6, c.y + Math.sin(a) * rr * 0.5, rr); }
    }, 1.22, 0.72);
  }
  const plates = look ? [[-0.42, 0.2], [0.0, 0.08], [0.4, 0.18], [-0.16, 0.42], [0.24, 0.44]] : [[-0.32, 0.12], [0.22, 0.1], [0.52, 0.32], [-0.55, 0.34], [0.0, 0.36], [0.3, 0.55]];
  plates.forEach(([x, py], j) => {                      // the flat plates of flowers, cream and lacy
    const y = top(x) + py, r = 0.19;
    fillIn(g, 'rgba(40, 60, 30, 0.22)', () => ovalAt(g, x, y + 0.03, r * 1.02, r * 0.34));
    fillIn(g, 'rgb(234, 228, 196)', () => ovalAt(g, x, y, r * 0.94, r * 0.3));
    for (let k = 0; k < 36; k++) {
      const a = h(400 + j * 40 + k) * TAU, rr = Math.sqrt(h(700 + j * 40 + k)) * r * 0.95;
      fillIn(g, k % 4 ? '#fdf9ea' : '#efe4b8', () => discAt(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.32 - 0.02 * (1 - rr / r), 0.018));
    }
    furGlow(g, [255, 252, 232], 0.35, x - 0.04, y - 0.02, r * 0.6, r * 0.18);
  });
}
function paintHazel(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.8, 0.2, '40, 34, 14', 0.35);
  for (let i = 0; i < 5; i++) {                         // a few fallen hazel leaves, round and toothed, gone yellow
    const x = (h(i) - 0.5) * 1.3, y = FIND_FOOT - 0.05 - 0.12 * h(10 + i), a = h(20 + i) * TAU, rgb = tone([210, 170, 70], 0.8 + 0.3 * h(30 + i));
    g.save(); g.translate(x, y); g.scale(1, 0.5); g.rotate(a);
    softIn(g, rgb, -0.2, 0.2, () => { for (let k = 0; k <= 16; k++) { const v = k / 16 * TAU, r = 0.2 * (k % 2 ? 0.92 : 1); k ? g.lineTo(Math.sin(v) * r * 0.85, -Math.cos(v) * r) : g.moveTo(0, -r); } g.closePath(); }, 1.15, 0.8);
    g.restore();
  }
  const nuts = look ? [[-0.3, 0.02, 1], [0.05, -0.1, 0], [0.32, 0.04, 1], [0.0, 0.12, 0]] : [[-0.34, 0.06, 0], [-0.04, -0.06, 1], [0.28, -0.02, 1], [0.12, 0.14, 0]];
  nuts.sort((a, b) => a[1] - b[1]);
  for (const [nx, ny, husk] of nuts) {
    const x = nx * 1.2, y = FIND_FOOT - 0.26 + ny * 1.2, r = 0.19;
    softIn(g, [176, 112, 54], y - r, y + r, () => { g.moveTo(x, y - r * 1.1); g.bezierCurveTo(x + r * 1.3, y - r * 1.05, x + r * 1.3, y + r * 0.95, x, y + r); g.bezierCurveTo(x - r * 1.3, y + r * 0.95, x - r * 1.3, y - r * 1.05, x, y - r * 1.1); }, 1.25, 0.65);
    strokeIn(g, 'rgba(90, 50, 20, 0.35)', 0.01, () => { for (const e of [-0.4, 0, 0.4]) { g.moveTo(x + e * r, y - r * 0.9); g.quadraticCurveTo(x + e * r * 1.3, y, x + e * r, y + r * 0.8); } });
    fillIn(g, 'rgb(222, 196, 140)', () => ovalAt(g, x, y + r * 0.72, r * 0.62, r * 0.3));   // its pale base
    furGlow(g, [255, 236, 200], 0.65, x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.2, -0.4);
    if (husk) for (let k = 0; k < 9; k++) {             // the frilly green husk cupping its foot
      const a = Math.PI * (0.02 + 0.96 * k / 8), hx = x + Math.cos(a) * r * 1.05, hy = y + r * 0.5 + Math.sin(a) * r * 0.3;
      softIn(g, tone([150, 172, 70], 0.85 + 0.25 * h(60 + k)), hy - r * 0.8, hy + 0.05, () => { g.moveTo(hx - r * 0.3, hy + 0.04); g.lineTo(hx - Math.cos(a) * r * 0.2, hy - r * 0.8); g.lineTo(hx + r * 0.3, hy + 0.04); g.closePath(); }, 1.2, 0.8);
    }
  }
}
// What lies about for a fire (sim.js FINDS ground), in the same soft paint but plainer than the finds, and no glint.
// A stick lying from x0, y0 to x1, y1, bowed by bend, wide at its thick end and thinner at the tip, lit along its top.
function twig(g, x0, y0, x1, y1, bend, wide, rgb) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  const cx = (x0 + x1) / 2 + nx * bend, cy = (y0 + y1) / 2 + ny * bend;
  const at = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const side = s => { for (let k = 0; k <= 8; k++) { const t = s > 0 ? k / 8 : 1 - k / 8, [x, y] = at(t), r = wide * (1 - 0.55 * t); g.lineTo(x + nx * r * s, y + ny * r * s); } };
  const top = Math.min(y0, y1) - wide, foot = Math.max(y0, y1) + wide;
  softIn(g, rgb, top, foot, () => { g.moveTo(...at(0)); side(1); side(-1); g.closePath(); }, 1.25, 0.6);
  strokeIn(g, rockRGB(tone(rgb, 1.35, 24), 0.7), wide * 0.35, () => { for (let k = 0; k <= 8; k++) { const t = k / 8, [x, y] = at(t), r = wide * (1 - 0.55 * t) * 0.45, sgn = ny < 0 ? 1 : -1; k ? g.lineTo(x + nx * r * sgn, y + ny * r * sgn) : g.moveTo(x + nx * r * sgn, y + ny * r * sgn); } });
  fillIn(g, rockRGB(tone(rgb, 1.6, 40)), () => ovalAt(g, x0, y0, wide * 0.55, wide * 0.95, Math.atan2(dy, dx)));   // the pale snapped end
  return at;
}
function paintSticks(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.9, 0.18, '34, 26, 14', 0.35);
  const sticks = look ? [[-0.75, 0.05, 0.7, -0.12, 0.06], [-0.5, -0.2, 0.55, 0.12, -0.05], [-0.2, 0.16, 0.6, 0.02, 0.04]]
                      : [[-0.8, -0.1, 0.75, 0.06, -0.06], [-0.6, 0.14, 0.5, -0.16, 0.05], [0.0, -0.18, 0.7, 0.16, 0.03]];
  sticks.forEach(([x0, y0, x1, y1, bend], i) => {
    const rgb = tone([118, 84, 54], 0.8 + 0.35 * h(i)), at = twig(g, x0, FIND_FOOT - 0.12 + y0 * 0.6, x1, FIND_FOOT - 0.12 + y1 * 0.6, bend, 0.042 - i * 0.006, rgb);
    if (i < 2) {                                        // a side twig off it
      const [x, y] = at(0.45 + 0.2 * h(10 + i)), up = i ? -1 : 1;
      strokeIn(g, rockRGB(tone(rgb, 1.05)), 0.016, () => { g.moveTo(x, y); g.quadraticCurveTo(x + 0.12, y - 0.1 * up, x + 0.24, y - 0.12 * up); });
    }
  });
}
function paintPebbles(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.8, 0.18, '30, 30, 26', 0.3);
  const stones = look ? [[-0.42, 0.0, 0.24], [0.02, -0.08, 0.2], [0.38, 0.04, 0.26], [-0.12, 0.14, 0.16], [0.2, 0.18, 0.13]]
                      : [[-0.38, -0.04, 0.27], [0.08, 0.02, 0.22], [0.42, -0.06, 0.17], [-0.06, 0.18, 0.15], [-0.62, 0.16, 0.12]];
  const greys = [[168, 162, 150], [140, 136, 128], [182, 168, 146], [122, 124, 122], [196, 186, 168]];
  stones.sort((a, b) => a[1] - b[1]);
  stones.forEach(([sx, sy, r], i) => {
    const x = sx, y = FIND_FOOT - 0.1 + sy, rx = r * (1.05 + 0.25 * h(i)), ry = r * (0.62 + 0.12 * h(10 + i)), rgb = tone(greys[(i + look * 2) % greys.length], 0.9 + 0.2 * h(20 + i));
    fillIn(g, 'rgba(30, 28, 24, 0.35)', () => ovalAt(g, x + rx * 0.08, y + ry * 0.55, rx * 0.95, ry * 0.5));   // where it sits
    softIn(g, rgb, y - ry, y + ry, () => ovalAt(g, x, y, rx, ry, (h(30 + i) - 0.5) * 0.5), 1.3, 0.62);
    furGlow(g, [255, 252, 240], 0.5, x - rx * 0.3, y - ry * 0.4, rx * 0.4, ry * 0.25, -0.3);
  });
}
function paintDryGrass(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.7, 0.16, '40, 34, 14', 0.3);
  const straw = [214, 186, 112];
  for (let i = 0; i < 26; i++) {                        // a tuft of dry blades, arching over, pale gold against the green
    const t = i / 25, x0 = (t - 0.5) * 0.36 + (h(i) - 0.5) * 0.08, lean = (t - 0.5) * 2 + (h(10 + i) - 0.5) * 0.8 + (look ? 0.3 : -0.3);
    const tall = 0.75 + 0.5 * h(20 + i), x1 = x0 + lean * 0.5, y1 = FIND_FOOT - tall * (1 - 0.35 * Math.abs(lean));
    const rgb = tone(i % 3 ? straw : [190, 150, 90], 0.78 + 0.35 * h(30 + i));
    strokeIn(g, rockRGB(rgb), 0.022 + 0.012 * h(40 + i), () => { g.moveTo(x0, FIND_FOOT); g.quadraticCurveTo(x0 + lean * 0.12, (FIND_FOOT + y1) / 2 - 0.1, x1, y1); });
    if (i % 5 === 2) fillIn(g, rockRGB(tone(rgb, 0.85)), () => ovalAt(g, x1, y1, 0.02, 0.06, Math.atan2(y1 - FIND_FOOT, x1 - x0) + Math.PI / 2));   // a seed head
  }
  furGlow(g, [255, 240, 190], 0.25, 0, FIND_FOOT - 0.45, 0.35, 0.3);
}
function paintBark(g, h, look) {
  softSpot(g, 0, FIND_FOOT, 0.8, 0.18, '30, 28, 20', 0.32);
  const curls = look ? [[-0.3, -0.05, 0.42, 0.08, -0.15], [0.3, 0.1, 0.34, 0.065, 0.2]] : [[-0.25, 0.08, 0.48, 0.085, 0.1], [0.32, -0.08, 0.3, 0.06, -0.25]];
  curls.forEach(([cx, cy, len, r, a], i) => {           // a rolled curl of papery white bark, its brown inside showing at the end
    g.save(); g.translate(cx, FIND_FOOT - 0.12 + cy); g.rotate(a);
    fillIn(g, 'rgba(30, 26, 20, 0.3)', () => ovalAt(g, 0.02, r * 0.85, len * 0.95, r * 0.4));
    softIn(g, [236, 230, 216], -r, r, () => { g.moveTo(-len, -r); g.lineTo(len, -r); g.ellipse(len, 0, r * 0.45, r, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(-len, r); g.closePath(); }, 1.1, 0.72);
    strokeIn(g, 'rgba(40, 34, 30, 0.75)', 0.016, () => {   // the dark dashes across it
      for (let k = 0; k < 6; k++) { const x = -len * 0.8 + k * len * 0.3 + (h(10 * i + k) - 0.5) * 0.08, y = (h(20 * i + k) - 0.5) * r * 1.2; g.moveTo(x - 0.05, y); g.lineTo(x + 0.04 + 0.04 * h(30 + k), y); }
    });
    fillIn(g, 'rgb(246, 242, 232)', () => ovalAt(g, -len, 0, r * 0.45, r));
    fillIn(g, 'rgb(196, 132, 88)', () => ovalAt(g, -len, 0, r * 0.3, r * 0.72));
    strokeIn(g, 'rgba(246, 240, 228, 0.9)', 0.016, () => { g.moveTo(-len, -r * 0.4); g.ellipse(-len, 0, r * 0.16, r * 0.4, 0, -Math.PI / 2, Math.PI); });   // its roll
    g.restore();
  });
}
function paintRose(g, h, look, bare) {
  softSpot(g, 0, FIND_FOOT, 0.95, 0.22, '30, 34, 14', 0.4);
  const canes = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, x0 = side * 0.1 * h(i), reach = 0.45 + 0.45 * h(10 + i), up = 0.7 + 0.5 * h(20 + i);
    canes.push({ x0, cx: x0 + side * reach * 0.5, cy: FIND_FOOT - up * 1.2, x1: x0 + side * reach, y1: FIND_FOOT - up * 0.45, k: i });
  }
  const along = (c, t) => [(1 - t) ** 2 * c.x0 + 2 * (1 - t) * t * c.cx + t * t * c.x1, (1 - t) ** 2 * FIND_FOOT + 2 * (1 - t) * t * c.cy + t * t * c.y1];
  for (const c of canes) {
    strokeIn(g, rockRGB(tone([132, 64, 50], 0.8 + 0.3 * h(30 + c.k))), 0.028, () => { g.moveTo(c.x0, FIND_FOOT); g.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1); });
    strokeIn(g, 'rgba(110, 50, 40, 0.9)', 0.012, () => { for (let t = 0.15; t < 0.95; t += 0.14) { const [x, y] = along(c, t); g.moveTo(x, y); g.lineTo(x + 0.03, y - 0.035); } });   // thorns
  }
  if (!bare) for (let i = 0; i < 18; i++) {             // a few autumn leaves left on it
    const c = canes[i % canes.length], [x, y] = along(c, 0.3 + 0.6 * h(40 + i)), rgb = [[196, 150, 60], [176, 110, 50], [120, 130, 56]][i % 3];
    pinnate(g, x, y, (h(50 + i) - 0.5) * 2.4, 0.2, tone(rgb, 0.8 + 0.3 * h(60 + i)), 2, 0.45);
  }
  for (let i = 0; i < 9; i++) {                         // the hips, glossy scarlet, along the canes and at their tips
    const c = canes[(i + look) % canes.length], [x, y] = along(c, i < canes.length ? 1 : 0.45 + 0.4 * h(70 + i)), r = 0.07 + 0.02 * h(80 + i), a = (h(90 + i) - 0.5) * 0.8;
    g.save(); g.translate(x, y + r * 0.6); g.rotate(a);
    softIn(g, bare ? [196, 36, 30] : [222, 50, 30], -r * 1.2, r * 1.2, () => ovalAt(g, 0, 0, r * 0.8, r * 1.15), 1.2, 0.62);
    strokeIn(g, 'rgb(60, 40, 30)', 0.014, () => { for (const e of [-1, 0, 1]) { g.moveTo(0, r * 1.1); g.lineTo(e * r * 0.4, r * 1.45); } });   // the dry sepals at its tip
    furGlow(g, [255, 220, 200], 0.65, -r * 0.3, -r * 0.4, r * 0.25, r * 0.35);
    g.restore();
  }
}
// A sprig of watercress: round glossy leaflets in pairs up a short stalk, the one at the tip the biggest.
function cressSprig(g, x, y, a, len, rgb) {
  g.save(); g.translate(x, y); g.rotate(a);
  strokeIn(g, 'rgb(96, 140, 70)', 0.016, () => { g.moveTo(0, 0); g.lineTo(0, -len); });
  for (let p = 0; p < 3; p++) {
    const t = p === 2 ? 1 : 0.4 + 0.3 * p, r = len * (p === 2 ? 0.3 : 0.2);
    for (const e of p === 2 ? [0] : [-1, 1]) {
      const lx = e * r * 0.95, ly = -len * t - (e ? 0 : r * 0.6);
      softIn(g, rgb, ly - r, ly + r, () => ovalAt(g, lx, ly, r, r * 0.7, e * 0.3), 1.14, 0.84);
      strokeIn(g, rockRGB(tone(rgb, 0.72), 0.5), 0.008, () => { g.moveTo(lx - e * r * 0.7, ly + r * 0.1); g.lineTo(lx + e * r * 0.3, ly - r * 0.1); });
      fillIn(g, 'rgba(255, 255, 255, 0.32)', () => ovalAt(g, lx - r * 0.3, ly - r * 0.35, r * 0.38, r * 0.18, -0.3));   // wet and glossy
    }
  }
  g.restore();
}
// Watercress: a cushion of sprigs standing in the shallows at the water's edge, the water lapping round its foot (a pale
// ring, the lowest leaves darker under it); look 1 has a few tiny white flowers. Stage 1 is with the water frozen: a rim
// of snowy ice round its foot instead.
function paintCress(g, h, look, iced) {
  softSpot(g, 0, FIND_FOOT, 0.8, 0.2, '20, 60, 70', 0.3);
  const sprigs = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * 2.3 + (h(i) - 0.5) * 0.3;
    sprigs.push({ x: Math.sin(a) * 0.32 + (h(10 + i) - 0.5) * 0.12, a, len: 0.32 + 0.16 * h(20 + i) * (1 - Math.abs(a) * 0.3), k: i });
  }
  sprigs.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  for (const s of sprigs) {
    const lit = 1 - Math.abs(s.a) / 1.4;
    cressSprig(g, s.x, FIND_FOOT - 0.02, s.a, s.len, tone([58, 138, 58], (iced ? 0.7 : 0.78) + 0.35 * lit + 0.08 * h(30 + s.k)));
  }
  if (iced) {
    softSpot(g, 0, FIND_FOOT + 0.01, 0.72, 0.12, '250, 252, 255', 0.9);       // the ice and snow it stands up out of
    fillIn(g, 'rgba(255, 255, 255, 0.7)', () => ovalAt(g, -0.1, FIND_FOOT - 0.01, 0.42, 0.05));
  } else {
    furGlow(g, [40, 90, 100], 0.4, 0, FIND_FOOT - 0.02, 0.62, 0.1);               // under the water
    strokeIn(g, 'rgba(240, 250, 255, 0.55)', 0.022, () => {                       // the ring of water round its foot
      g.ellipse(0, FIND_FOOT, 0.7, 0.13, 0, Math.PI * 0.08, Math.PI * 0.92);
      g.moveTo(0.7 * Math.cos(Math.PI * 1.12), FIND_FOOT + 0.13 * Math.sin(Math.PI * 1.12)); g.ellipse(0, FIND_FOOT, 0.7, 0.13, 0, Math.PI * 1.12, Math.PI * 1.3);
    });
  }
  if (look === 1) for (let i = 0; i < 5; i++) {         // a few tiny white flowers
    const x = (h(80 + i) - 0.5) * 0.9, y = FIND_FOOT - 0.42 - 0.14 * h(85 + i);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; fillIn(g, '#fbfbf4', () => discAt(g, x + Math.cos(a) * 0.028, y + Math.sin(a) * 0.024, 0.026)); }
    fillIn(g, '#e8dc8c', () => discAt(g, x, y, 0.012));
  }
}

// Where a clump is drawn (into shroomAt): its size, and its middle on screen, over a log's side or up a snag's trunk.
const shroomAt = { px: 0, x: 0, y: 0 };
function placeShroom(m, z) {
  const d = m.tree, sx = (m.x - cam.x) * z + vw / 2, sy = (m.y - cam.y) * z + vh / 2;   // (toScreen, without an array)
  const grown = clamp((world.tick - m.born) / (SHROOM_GROW * S.TPD), 0, 1), step = Math.max(1, Math.ceil(grown * 3)) / 3;
  const px = Math.max(6, (8 + z) * SHROOM_SIZE * (m.kind === 'sulphur' ? 1.2 : m.kind === 'oyster' ? 1.7 : 1) * (0.4 + 0.6 * step));
  shroomAt.px = px; shroomAt.x = sx;
  shroomAt.y = m.kind === 'oyster' ? sy - treePx(d) * SHROOM_LOG : m.kind === 'sulphur' ? sy - treePx(d) * SHROOM_SNAG : sy - px * 0.31;
}
const SHROOM_LOG = 0.05, SHROOM_SNAG = 0.16;   // how high on a log's side and up a snag's trunk, in the tree's size
// Its portrait in the inspector: its painting (the 🍄 emoji is a fly agaric, which no cook would pick).
function shroomFace(m) {
  const art = SHROOM_ARTS[S.SHROOM_KINDS.indexOf(m.kind) * 3 + m.look];
  if (!portraits.has(art)) portraits.set(art, dataURL(sprite(art, 38).canvas));
  return `<img src="${portraits.get(art)}" alt="${S.SHROOMS[m.kind].name}" style="width: 125%">`;
}
const SHROOM_TINT = { cep: '#8c582e', chanterelle: '#eeaa36', field: '#c8bca8', oyster: '#b8ae9c', sulphur: '#f6a828' };
const SHROOM_COOK = {
  cep: ['🍳', 'Firm and nutty: the cook\'s favourite, fried in butter or dried for winter'],
  chanterelle: ['🍳', 'Golden, and smells faintly of apricots: lovely with eggs'],
  field: ['🍳', 'The everyday mushroom: on toast, or in a stew'],
  oyster: ['🍳', 'Soft and mild: torn up and fried'],
  sulphur: ['🍳', 'Tastes like chicken, they say, while it\'s young and tender'],
};
// Why the ground under field mushrooms is rich (sim.js enrich): remains lying there, a warren's latrines, an otters' holt, or
// something long gone (a body, a log rotted away).
function richWhy(m) {
  const near = (x, y, r) => (x - m.x) ** 2 + (y - m.y) ** 2 < r * r;
  const k = world.carcasses.find(k => near(k.x, k.y, 2));
  if (k) return ['🦴', `The ground is rich where the remains of ${link(k.c)} lie`];
  if (world.burrows.some(b => b.count && near(b.x, b.y, 4.5))) return ['🐇', 'The ground is rich round a busy warren, where the rabbits leave their droppings'];
  if (world.decor.some(d => d.holt && near(d.x, d.y, 4))) return ['🦦', 'The ground is rich by an otters\' holt, where they leave their spraint'];
  return ['🌱', 'The ground is rich here: something lay and went back into it, a body or an old log'];
}
function drawShroom(m, z) {
  placeShroom(m, z);
  const left = (m.until - world.tick) / S.TPD;
  drawEmoji(SHROOM_ARTS[S.SHROOM_KINDS.indexOf(m.kind) * 3 + m.look], shroomAt.x, shroomAt.y, shroomAt.px,
    { alpha: left < SHROOM_OVER ? 0.3 + 0.7 * left / SHROOM_OVER : undefined, flip: m.born % 2 === 1 });
}

// A dead rabbit, lying on its side facing left, in four stages ('body:' + coat * 4 + stage): 0 whole, its eyes
// closed; 1 opened, the ribs showing; 2 picked over, bones and scraps; 3 a flat pelt, a bone or two. Soft shapes in
// the emoji rabbit's proportions, no red, in the wild coat or, white for winter, in white (BODY_COATS). A fox
// is painted after them (paintDeadFox).
const BODY_COATS = [COAT.rgb, S.WINTER_COAT];
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
const furPainted = px => Math.min(furTop(), 2 ** Math.ceil(Math.max(Math.log2(FUR_PAINTED / dpr), Math.log2(px) - 1e-6)));   // (a power of two, as poseStep keeps it, or its biggest)
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
function paintForager(g, size, U, n) {
  if (!shrunk(g, size, U, FORAGER_ARTS[n])) Fur.paintForager(g, size, U, n);
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
// Each look of fox and rabbit about the screen (a fox's shade, how white a rabbit's coat has gone) is asked of the
// worker before the first of it is on screen, so there's kin to stand in while its poses come (furKin); otherwise that
// first one is painted here. One whose paintings were let go (dropSprites) is asked for again after FUR_AGAIN.
const furAsked = new Map(), FUR_AGAIN = 5000;    // look: when it was last asked for
function furAhead(now) {
  if (!furWorker) return;
  foragerAhead();
  const reach = Math.max(vw, vh), seen = new Set();
  for (const c of world.creatures) {
    const fox = c.species === 'fox';
    if (!c.alive || !fox && c.species !== 'rabbit') continue;
    const white = fox ? 0 : whiteStep(c), look = fox ? Math.round(c.fur * 10) : 100 + white;
    if (seen.has(look) || now - (furAsked.get(look) ?? -Infinity) < FUR_AGAIN) continue;
    const [sx, sy] = toScreen(c.x, c.y);
    if (!visible(sx, sy, reach)) continue;
    seen.add(look);
    const art = fox ? foxArtOf(c.fur, 'stand') : rabbitArtOf(COAT, 'sit', white);
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

// A rabbit hops: in the air for HOP.air of each hop, covering HOP.ahead of the ground, and the rest while it's down,
// where it all but stops. The sim moves it evenly, so it's drawn a little ahead of or behind where it is, along its
// way (hopSurge, in tiles), the same on average.
const HOP = { air: [0.55, 0.65], ahead: [0.9, 0.85], high: [0.16, 0.2] };   // a hop, and a bound
function hopSurge(c) {
  if (!onTheMove(c)) return 0;
  const f = fastGait(c) ? 1 : 0, A = HOP.air[f], P = HOP.ahead[f], u = gaitOf(c).step % 1;
  const done = u < A ? P * u / A : P + (1 - P) * (u - A) / (1 - A), mean = A * P / 2 + (1 - A) * (1 + P) / 2;
  return (done - u - (mean - 0.5)) * strideOf(c);
}
const walkerArt = (c, px, now) => c.species === 'fox' ? shownPose(c, foxArt(c, px), px) : c.species === 'rabbit' ? shownPose(c, rabbitArt(c, now), px)
  : c.species === 'bee' ? beeArt(c, px, now) : c.sp.emoji;
// A pose not painted yet waits: the fox or rabbit holds the pose it was last
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
  const art = pose => foxArtOf(c.fur, pose);
  if (c.sleeping) return art('sleep');
  if (c.mode === 'eat' || c.mode === 'berries') return art('feed');
  if (c.mode === 'rest' || c.mode === 'tired') return art('sit');
  if (onTheMove(c)) {
    let k = Math.floor(gaitOf(c).step % 1 * 4);
    return art((fastGait(c) ? 'run' : 'trot') + (k + 1));
  }
  return art('stand');
}

// ------------------------------------------------------------------ the rabbit
//
// Painted (fur.js: RABBIT_POSES, paintRabbit), not the 🐇 emoji. 'rabbit:' + (look << 4) + pose; look = coat * 5 + white step.
const RABBIT_ARTS = Array.from({ length: 5 << 4 }, (_, n) => 'rabbit:' + n);
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
  const white = whiteStep(c), art = pose => rabbitArtOf(COAT, pose, white);
  if (c.sleeping) return art('sleep');
  if (c.mode === 'alarm') return art('alarm');
  if (c.mode === 'graze' || c.mode === 'munch') return art('graze');
  if (c.mode === 'rest') return art('loaf');
  if (c.mode === 'thicket') return art('alarm');        // (sitting tight in the thorns, ears up: sim.js enterThicket)
  if (atHole(c)) return art('dig');
  if (!movedLately(c)) return art('sit');
  const f = fastGait(c) ? 1 : 0, A = HOP.air[f], u = gaitOf(c).step % 1, v = u / A, poses = RABBIT_GAIT[f];
  if (u >= A) return art(poses[0]);
  return art(poses[v < 0.25 ? 1 : v < 0.75 ? 2 : 3]);
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
// is covered; what each is up to is in the label on hover and in the inspector. Only for those on screen, and only
// while time runs. At most POP_LIVE up at once, so a pop still means
// something when a fox walks through a warren; and love only for the one you follow (in spring it's everyone).
const POPS = new Set(['alarm', 'flee', 'chase', 'stalk']);
const POP_MS = 1700, POP_IN = 160, POP_OUT = 450, POP_LIVE = 3;
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
      if ((POPS.has(c.mode) || followed && c.mode === 'love') && ui.speed > 0 && (followed || popsUp.length < POP_LIVE)) {
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
  return { lean: clamp((ck.phase - 0.36) / 0.34, -1, 1), a: (1 - 1.6 * shownDark(ck.phase)) * (1 - cover) };
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
// The animals' shadows aren't filled one by one: each is put with those as dark (SHADOW_STEPS of SHADOW_MOST), and
// layShadows fills each lot as one path once they're all in, a few fills a frame for hundreds of animals. Two that
// overlap make one shadow. Zoomed far out (zoomedOut) there are none: they'd be smudges a pixel or two high.
const SHADOW_STEPS = 24, SHADOW_MOST = 0.4;
const shadowAt = Array.from({ length: SHADOW_STEPS + 1 }, () => []), shadowN = new Int32Array(SHADOW_STEPS + 1);
function drawCreatureShadow(c, sx, sy, now, sn, f) {
  if (zoomedOut() || wading(c)) return;
  const px = creaturePx(c), lift = 1 - Math.min(c.sp.flies ? 0.8 : 0.5, liftOf(c, px, now) / px);
  const n = shadeStep(), a = (0.14 + 0.16 * Math.max(0, sn.a)) * lerp(1, SNOW_SHADE_A, n / SHADE_STEPS), off = Math.max(0, sn.a) * sn.lean * px * 0.2;
  const k = Math.round(clamp(a * lift * f / SHADOW_MOST, 0, 1) * SHADOW_STEPS), at = shadowAt[k], i = shadowN[k]++ * 4;
  at[i] = sx + off; at[i + 1] = sy + px * 0.36; at[i + 2] = (px * 0.34 + Math.abs(off) * 0.6) * lift; at[i + 3] = px * 0.1 * lift;
}
function layShadows() {
  const was = fade;
  fadeTo(1);                                             // (the mist is in each one's step already)
  ctx.fillStyle = FEET_SHADES[shadeStep()];
  for (let k = 1; k <= SHADOW_STEPS; k++) {
    const n = shadowN[k] * 4, at = shadowAt[k];
    if (!n) continue;
    ctx.globalAlpha = k / SHADOW_STEPS * SHADOW_MOST;
    ctx.beginPath();
    for (let i = 0; i < n; i += 4) { ctx.moveTo(at[i] + at[i + 2], at[i + 1]); ctx.ellipse(at[i], at[i + 1], at[i + 2], at[i + 3], 0, 0, TAU); }
    ctx.fill();
  }
  shadowN.fill(0);
  ctx.globalAlpha = 1;
  fadeTo(was);
}

// Trees sway from the trunk. Gusts roll across the meadow, harder in rain and storms.
function treeSway(d, now) {
  const m = ui.sky.mix, wind = 0.018 + 0.01 * m.cloudy + 0.03 * m.rain + 0.07 * m.storm;
  return wind * (Math.sin(now / 900 - d.x * 0.15) + 0.35 * Math.sin(now / 340 + d.y));
}

// The colour of a broadleaf tree's leaves in summer and autumn, for the leaves it drops in the river (treeFloats).
// No two are quite the same green. In autumn the green drains away to its kind's colour (the sim says which kind,
// plantTrees), then to a dry brown, which an oak holds on to.
const AUTUMN = { birch: [238, 192, 56], alder: [112, 116, 50], beech: [240, 130, 40], maple: [200, 50, 42], oak: [176, 100, 52], hawthorn: [176, 100, 52],
  apple: [196, 176, 64], cherry: [214, 70, 48] };
const DRY = [160, 120, 80], GREEN = [88, 152, 60];
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
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS, info = treeInfo(d), lag = (info.h % 5) * 0.04, oak = info.kind === 'oak';
  let rgb = info.green, drop = 0;
  if (ck.season === 2) {
    const turn = clamp((sp - 0.05 - lag) / 0.4, 0, 1);
    rgb = mix(mix(rgb, AUTUMN[info.fruit] || AUTUMN[info.kind] || AUTUMN.oak, turn), DRY, clamp((sp - 0.65 - lag) / 0.35, 0, 1) * (oak ? 1 : 0.5));
    drop = leafDrop(sp, lag, oak);
  }
  return { rgb: rgb.map(v => Math.round(v / 8) * 8), drop };
}

// What lies under a tree: in autumn the sim's
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
  const r = leafTrees[leafN] || (leafTrees[leafN] = { sx: 0, sy: 0, wy: 0, px: 0, n: 0, h: 0, f: 0, tier: 0, pick: null, ga: 0, gb: 0, m: 0 });
  leafN++;
  r.sx = sx; r.sy = sy; r.wy = d.y; r.px = px; r.n = n; r.h = info.h; r.f = f; r.tier = tier; r.pick = leafPick[oak ? 'oak' : kind][d.tone ?? 0];
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
      } else {                                              // (in the air: hidden by the crowns in front of its tree)
        const hid = coverAt(x, y, r.wy);
        if (hid > 0.98) continue;
        alpha = Math.min(1, q / 500) * (1 - hid);
      }
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
// an old giant already (HIVE_TREE).
const TREE_SCALE = { oak: 1.41, hive: 1, beech: 1.36, maple: 1.14, birch: 0.92, alder: 1.05, pine: 1.01, apple: 1.28, cherry: 1.72, hawthorn: 1.1, log: 1.2, stump: 1 };
const treePx = d => Math.max(d.hedge ? HEDGE_PX : 0, d.size * cam.zoom * (d.tree ? TREE_SCALE[d.fallen ? 'log' : d.stump ? 'stump' : treeKind(d)] || 1 : 1));
const HEDGE_PX = 12;                                     // ?keep: a hedge's whip is never drawn smaller than this, so a new one reads as a row from afar
const LOG_BARK = { beech: 'grey', birch: 'birch' };      // whose bark a log or a stump has (trees.js); the rest are brown
const YOUNG = new Set(['seedling', 'sapling', 'young']);
const SEEDLING_PX = 6;                                   // a seedling smaller than this on screen isn't drawn
// A bare tree looks the same whatever its tone, and a young one hardly shows its shape: fewer paintings to make.
const bareLook = (kind, look) => look === 'dead' || (kind !== 'pine' && kind !== 'log' && (look === 'winter' || look === 'bare'));
const HIVE_DOOR = [1, -38];              // the hive's sill in the hive oak's painting, from its foot (trees.js hive)
// Paintings go by number, so a frame builds no names: the tree (kind, shape, tone, form), its look, the size (its
// place in TREE_TIERS) and the snow, packed together.
const ART_KINDS = { oak: 0, hive: 1, beech: 2, maple: 3, birch: 4, pine: 5, alder: 6, apple: 7, cherry: 8, hawthorn: 9, log: 10, stump: 11 };
const ART_LOOKS = { summer: 0, spring: 1, bud: 2, autumn: 3, thin: 4, winter: 5, bare: 6, dead: 7, crop3: 8, crop2: 9, crop1: 10, crop0: 11 }, ART_LOOK_N = 12;
// A cherry's summer look as it's picked (S.cherryShow: quarters of its cherries left; trees.js LOOKS), so a pick
// paints it afresh once, never a frame. Its stand-in (treeKin) is its full summer look.
const CROP_LOOKS = ['crop0', 'crop1', 'crop2', 'crop3', 'summer'];
const kinLook = look => look.startsWith('crop') ? 'summer' : look;
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
// treeWorker is the first, and says whether trees are painted at all (without OffscreenCanvas in a worker, none are).
const TREE_WORKERS = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
const treeWorkers = [];                  // { worker, busy }
let treeWorker = null, treeBusy = 0, treeBytes = 0, kinBusy = false, kinAsked = false;
if (window.Worker && window.OffscreenCanvas) {
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
      tw.worker.onerror = () => { treeWorker = null; };   // no OffscreenCanvas in workers here: no trees
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
  let [a, b, m] = wood ? ['summer', null, 0] : stage === 'dead' ? ['dead', null, 0] : treeStage(kind, d, ck);
  if (kind === 'cherry' && (a === 'summer' || b === 'summer')) { const crop = CROP_LOOKS[S.cherryShow(world, d)]; if (a === 'summer') a = crop; else b = crop; }
  let A = m < 1 ? treePainting(kind, shape, bareLook(kind, a) ? 0 : tone, form, a, tier, snow > 0) : null;
  let B = b && m > 0 ? treePainting(kind, shape, bareLook(kind, b) ? 0 : tone, form, b, tier, snow > 0) : null;
  if (!A && !B) {                                            // till this one comes: its kind in this look, or another look of it
    const want = m > 0.5 ? b : a, look = kinLook(want), own = treeAny.get(treeKey(kind, shape, tone, form)), kin = treeKin.get(ART_KINDS[kind] * ART_LOOK_N + ART_LOOKS[look]);
    A = kind === 'cherry' && CROP_LOOKS.includes(want) ? own || kin : kin || own;   // (a cherry picked, or ripe, keeps its own painting till the new one comes)
    if (!A) { wantKin(kind, look, true); if (!treeWaits.has(d)) treeWaits.set(d, 0); return false; }
  }
  let show = 1;
  const t0 = treeWaits.get(d);
  if (t0 !== undefined) {
    if (!t0) treeWaits.set(d, now);
    show = t0 ? Math.min(1, (now - t0) / FADE_MS) : 0;
    if (show >= 1) treeWaits.delete(d);
  }
  show *= 1 - (1 - SEE_A) * seeThrough(d, A || B, f, sx, sy);
  if (!wood && stage !== 'dead') addCover(d, kind, sx, sy, px, form, a, b, m, show * fade);   // (fade: the mist's)
  const r = wood ? 0 : treeSway(d, now) * (stage === 'dead' ? 0.4 : 1), still = Math.abs(r) * px < 0.5;   // a sway too small to see isn't drawn
  // Swaying from the foot. A tree is only ever drawn in render's own transform, so it's set back as it was, with no
  // save and restore (turning it back by the inverse leaves it a hair off, and Chrome then draws what follows another way).
  if (!still) { const c = Math.cos(r) * dpr, s = Math.sin(r) * dpr; ctx.setTransform(c, s, -s, c, sx * dpr + shakeX, sy * dpr + shakeY); }
  if (A) putPainting(A, f, show, snow, still ? sx : 0, still ? sy : 0);
  if (B) putPainting(B, f, (A ? m : 1) * show, snow, still ? sx : 0, still ? sy : 0);
  if (!still) ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
  return true;
}
// A tree standing in front of the forager fades to SEE_A, as in Project Zomboid, so it's never lost in a wood. Only
// the trees that are or were in front of it are kept (seeing), each eased in and out over SEE_MS.
const SEE_A = 0.35, SEE_MS = 220;
const seeing = new Map();                  // tree: how far it's faded, 0..1
const fgBody = { on: false, x: -0, y: -0, w: -0, h: -0, wy: -0 };   // the forager's body on screen this frame (render), and its y in the meadow
let seeDt = -0, seeLast = -0;
function seeThrough(d, p, f, sx, sy) {
  const v = seeing.get(d) || 0;
  let want = 0;
  if (fgBody.on && d.y > fgBody.wy) {                      // drawn after it: over it, if their boxes meet (the painting's margins left out)
    const k = f / p.scale, l = sx - p.bx * k, t = sy - p.by * k, w = p.w * k, h = p.h * k;
    if (fgBody.x + fgBody.w > l + w * 0.15 && fgBody.x - fgBody.w < l + w * 0.85 && fgBody.y + fgBody.h > t + h * 0.1 && fgBody.y - fgBody.h < sy) want = 1;
  }
  if (v === want) return v;
  const u = want ? Math.min(1, v + seeDt / SEE_MS) : Math.max(0, v - seeDt / SEE_MS);
  if (u) seeing.set(d, u); else seeing.delete(d);
  return u * u * (3 - 2 * u);
}
// What the leafy crowns drawn this frame hide (coverAt, 0..1). Whatever is drawn after all the trees (the fireflies, the
// leaves coming down, pollen, butterflies, splashes, the effects, the snores) would else show through a crown standing in
// front of it. Each crown is its kind's outline (CROWNS) where it's drawn (addCover), kept in a coarse grid of the screen
// (COVER_CELL), made at the first test of a frame, so a test looks only at the few crowns about it. The edge hides less
// (COVER_EDGE), as a crown thins out there; a crown in first leaves or half fallen hides half (COVER_LOOK), a bare one
// nothing, and one faded (in the mist, in front of the forager, coming in) as little as it shows.
const COVER_CELL = 64;                     // px
const COVER_EDGE = 0.3;                    // of its reach, and of its height top and bottom: where a crown hides only partly
const COVER_MIN = 24;                      // px: a tree drawn smaller hides nothing
const COVER_LOOK = { bud: 0.5, thin: 0.5 };
const cover = { n: 0, max: 0, x: null, y: null, px: null, wy: null, f: null, w: null, k: [], built: false, cols: 0, rows: 0, start: null, list: null };
function addCover(d, kind, sx, sy, px, young, a, b, m, show) {
  if (px < COVER_MIN || show < 0.05) return;
  const dense = (1 - m) * (bareLook(kind, a) ? 0 : COVER_LOOK[a] ?? 1) + (b ? m * (bareLook(kind, b) ? 0 : COVER_LOOK[b] ?? 1) : 0);
  if (dense * show < 0.05) return;
  const C = cover;
  if (C.n === C.max) {                     // (grown now and then, never shrunk)
    const max = Math.max(256, C.max * 2), grow = (old, T) => { const t = new T(max); if (old) t.set(old); return t; };
    C.x = grow(C.x, Float32Array); C.y = grow(C.y, Float32Array); C.px = grow(C.px, Float32Array); C.wy = grow(C.wy, Float32Array);
    C.f = grow(C.f, Float32Array); C.w = grow(C.w, Float32Array); C.max = max;
  }
  const i = C.n++;
  C.x[i] = sx; C.y[i] = sy; C.px[i] = px; C.wy[i] = d.y; C.f[i] = dense * show; C.w[i] = young ? 0.75 : 1; C.k[i] = CROWNS[kind] || CROWNS.oak;
  C.built = false;
}
// The cells each crown's box covers, counted, then filled (a counting sort: no arrays made, but when the screen grows).
function coverCells(i, fn) {
  const C = cover, k = C.k[i], px = C.px[i], r = Math.max(k[2], k[3], k[4], k[5], k[6]) * px * C.w[i];
  const x0 = Math.max(0, ((C.x[i] - r) / COVER_CELL) | 0), x1 = Math.min(C.cols - 1, ((C.x[i] + r) / COVER_CELL) | 0);
  const y0 = Math.max(0, ((C.y[i] - k[1] * px) / COVER_CELL) | 0), y1 = Math.min(C.rows - 1, ((C.y[i] - k[0] * px) / COVER_CELL) | 0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(y * C.cols + x, i);
}
let coverFill = 0;
const coverCount = c => { cover.start[c + 1]++; coverFill++; };
const coverPut = (c, i) => { cover.list[cover.start[c]++] = i; };
function buildCover() {
  const C = cover;
  C.cols = Math.ceil(vw / COVER_CELL) + 1; C.rows = Math.ceil(vh / COVER_CELL) + 1;
  const cells = C.cols * C.rows;
  if (!C.start || C.start.length < cells + 1) C.start = new Int32Array(cells + 1);
  C.start.fill(0, 0, cells + 1); coverFill = 0;
  for (let i = 0; i < C.n; i++) coverCells(i, coverCount);
  for (let c = 0; c < cells; c++) C.start[c + 1] += C.start[c];
  if (!C.list || C.list.length < coverFill) C.list = new Int32Array(coverFill * 2);
  for (let i = 0; i < C.n; i++) coverCells(i, coverPut);            // (each start runs on to the next's: shifted back below)
  for (let c = cells; c > 0; c--) C.start[c] = C.start[c - 1];
  C.start[0] = 0;
  C.built = true;
}
// How much of what's drawn at (sx, sy) on screen, standing at wy in the meadow, the crowns in front of it hide.
function coverAt(sx, sy, wy) {
  const C = cover;
  if (!C.n || sx < 0 || sy < 0 || sx >= vw || sy >= vh) return 0;
  if (!C.built) buildCover();
  const c = ((sy / COVER_CELL) | 0) * C.cols + ((sx / COVER_CELL) | 0);
  let most = 0;
  for (let j = C.start[c], e = C.start[c + 1]; j < e; j++) {
    const i = C.list[j];
    if (C.wy[i] <= wy || C.f[i] <= most) continue;                 // (behind it, or hides no more than one already found)
    const k = C.k[i], px = C.px[i], t = ((C.y[i] - sy) / px - k[0]) / (k[1] - k[0]);
    if (t <= 0 || t >= 1) continue;
    const s = t * 4, n = Math.min(3, s | 0), reach = (k[2 + n] + (k[3 + n] - k[2 + n]) * (s - n)) * px * C.w[i];
    const out = Math.abs(sx - C.x[i]) / reach;
    if (out >= 1) continue;
    const h = C.f[i] * Math.min(1, (1 - out) / COVER_EDGE, t / COVER_EDGE, (1 - t) / COVER_EDGE);
    if (h > most) { most = h; if (most > 0.98) return 1; }
  }
  return most;
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
const PAINTERS = { fox: paintFox, rabbit: paintRabbit, forager: paintForager, hog: paintHedgehog, heron: paintHeron, reeds: paintReeds, lily: paintLilies, bubble: paintBubble, frog: paintFrog, crow: paintCrow, otter: paintOtter, holt: paintHolt, remains: paintRemains, body: paintBody, bee: paintBee, fall: paintFall, shroom: paintShroom, green: paintGreen, bramble: paintBramble, find: paintFind, item: paintItem, fire: paintFire,
  dfly: furPaint('dfly'), kfisher: furPaint('kfisher'), lark: furPaint('lark') };
function drawDecor(d, sx, sy, now, ck, px = d.tree ? treePx(d) : d.size * cam.zoom) {   // (px: render has it already)
  if (d.emoji === '🪨') { drawRock(d, sx, sy); return; }
  const stage = S.treeStage(world, d), bare = stage === 'dead' || stage === 'log' || stage === 'stump';
  const ground = px >= 20 && !bare && windfallsUnder(d, ck), h = ground && treeInfo(d).h;   // (too small: nothing under it)
  if (ground) drawUnderTree(ground, h, sx, sy, px, false);
  if (drawPaintedTree(d, sx, sy, now, ck, stage, px) && ground) drawUnderTree(ground, h, sx, sy, px, true);
  // (its falling leaves: treeLeaves; none yet: it fades in when its painting comes)
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
  const kind = S.rockKind(d);                              // (the sim knows too: the forager walks round all but pebbles)
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
// with a thick trunk flaring into its roots and a hole low down where the bees go in (trees.js paints
// it, the hive oak). The bees on the sill are drawn each frame, more of them the bigger the colony.

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

function softSpot(g, x, y, rx, ry, rgb, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb}, ${a})`); r.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
}

// The hive's tree: the hive oak, the hive in its trunk.
const HONEY_DRIPS = [[-0.4, 1, 2.6], [0.45, 4, 1.6]];   // the honey over the sill: where (of the door's half-width), from how many picks spare, how long
function drawBeeTree(d, sx, sy, now, ck) {
  const h = d.hive, px = d.size * cam.zoom;
  if (!drawPaintedTree(d, sx, sy, now, ck)) return;          // nothing to show yet: it fades in when its painting comes
  const f = px / TREE_UNIT, a = treeSway(d, now);           // (the door sways with the tree)
  const hx = sx + HIVE_DOOR[0] * f - HIVE_DOOR[1] * f * Math.sin(a), sill = sy + HIVE_DOOR[1] * f, rx = 0.02;
  // Bees on the sill, a few wandering on the bark; they shuffle while time runs.
  // A hive with honey to spare has it dripping off the sill (S.honeySpare: picks of it), a deep amber that shows on the
  // straw: a drip longer the more there is, and a second while there's plenty (HONEY_DRIPS). One taken down to what the
  // bees keep has none.
  const spare = S.honeySpare(world, h);
  for (let j = 0; j < HONEY_DRIPS.length && spare >= HONEY_DRIPS[j][1]; j++) {
    const [at, from, long] = HONEY_DRIPS[j], x = hx + at * rx * px, r = px * 0.011, y = sill - r * 0.6;
    const len = r * (1 + long * Math.min(1, (spare - from) / 4));
    ctx.fillStyle = 'rgb(206, 118, 16)';
    ctx.beginPath(); ctx.moveTo(x - r * 0.55, y);
    ctx.quadraticCurveTo(x - r * 0.55, y + len - r, x - r, y + len); ctx.arc(x, y + len, r, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + r * 0.55, y + len - r, x + r * 0.55, y); ctx.fill();
    ctx.fillStyle = 'rgba(255, 236, 190, 0.9)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y + len - r * 0.2, r * 0.32, 0, TAU); ctx.fill();
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
  const z = cam.zoom, n = Math.min(48, 10 + 2 * h.bees), b = z * 0.09, t = ui.speed > 0 ? performance.now() / 500 : 0;
  const top = sy - z * 1.6, len = z * (0.5 + 0.04 * Math.min(h.bees, 30)), wide = len * 0.4;
  for (let i = 0; i < n; i++) {
    const v = hash2(i, 3, h.id), u = hash2(3, i, h.id) - 0.5;
    const bx = sx + u * 2 * wide * Math.sin(Math.PI * Math.pow(v, 0.6)) + Math.sin(t + i) * b * 0.3;
    const by = top + v * len + Math.cos(t * 0.7 + i) * b * 0.3;
    barkBee(bx, by, b, Math.PI / 2 + (hash2(i, 4, h.id) - 0.5) * 2);
  }
}

// A hive goes by the flower field nearest it, or by its tree (a swarm by its queen); and how full of honey it is.
function hiveName(h) {
  if (h.cluster) return `Queen ${h.queen ? h.queen.name : ''}'s swarm`;
  let best = null, bd = Infinity;
  for (const f of world.fields) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < bd) { best = f; bd = d; } }
  return best && bd < S.FORAGE_RANGE ? `The hive by the ${best.name}` : h.tree?.name ? `The hive in the ${h.tree.name}` : 'The bee tree';
}
const honeyWord = h => { const q = h.honey / S.HIVE_FULL; return q >= 0.98 ? 'full of honey' : q < 0.05 ? 'hardly any honey' : `${Math.round(q * 100)}% full of honey`; };

// The trunk, from its foot up to where the crown begins, and never smaller than a fingertip.
// (Above that is the tree: THINGS.tree.)
function hiveAt(sx, sy, swarms = false) {
  return world.hives.find(h => {
    if (h.cluster && (!swarms || h.leaving)) return false;
    if (h.cluster) {                                       // the clump, hanging from its branch (drawSwarm)
      const z = cam.zoom, [hx, hy] = toScreen(h.x, h.y);
      return Math.abs(sx - hx) < Math.max(16, z * 0.5) && sy > hy - z * 1.7 && sy < hy - z * 0.8;
    }
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
  flowClock += dt * water * (ui.speed > 0 ? 1 : 0);
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

// How much of each weather is showing, so one fades into the next. Follows game time. The opening storm (sim.js
// openingStorm) shows as more than a storm (GALE_LOOK): darker, heavier rain slanting harder, the trees and the fire
// leaning further, the rain and the gusts louder.
const GALE_LOOK = 1.35;
function updateSky() {
  const d = world.tick - ui.sky.tick;
  ui.sky.tick = world.tick;
  if (d === 0) return;
  const k = d < 0 ? 1 : 1 - Math.exp(-d / 50), now = world.weather.kind, full = S.openingStorm(world) ? GALE_LOOK : 1;
  for (const kind in S.WEATHER) {
    const m = ui.sky.mix[kind] || 0;
    ui.sky.mix[kind] = m + ((kind === now ? full : 0) - m) * k;
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
  if (lights.n && dark > 0.02) skyLayer(SKY_FIRE, 1);      // (a fire's light, cut out of all that: lightsFrame)
  if (!ck.night && rainbowShows()) { laySky(t); drawRainbow(); }   // (over what's laid so far, under the fog)
  if (m.fog > 0.01) { skyWash(FOG_RGB, 0.30 * m.fog); skyLayer(SKY_FOG, m.fog); }
  laySky(t);
  const rain = m.rain + 1.8 * m.storm;
  if (rain > 0.02) drawRain(t, rain, m.storm);
  if (m.snow > 0.02) drawSnow(t, m.snow);
  drawLightning(now);
}

// The washes over the whole meadow, in order: the dark (render's), the cloud shadows, the weather's dim, the heat's glow, a
// fire's light cut out of them, and the fog. Each was a screen's worth of pixels for the GPU to blend, a dozen at worst. Washes laid one over another come to
// the same as one laid once, so they're gathered up (skyWash, skyLayer) and laid in one go (laySky): one fill if they're all
// even, else one small picture of them all, painted at SKY_RES of the screen (they're soft all through) and stretched over it.
const DIM_RGB = [50, 62, 92], HEAT_RGB = [255, 168, 60], FOG_RGB = [236, 240, 244];
const SKY_EVEN = 0, SKY_CLOUDS = 1, SKY_FOG = 2, SKY_FIRE = 3;   // a layer: one colour all over, the cloud shadows, the fog's banks, the fires' light (paintFireLights)
const SKY_RES = 0.125;                                     // the picture's pixels to a CSS pixel
const SKY_MS = 50;                                         // and its clouds and fog drift on in steps this long (a pixel or two: they're soft)
const sky = { n: 0, layers: Array.from({ length: 8 }, () => ({ kind: 0, rgb: null, a: 0 })), canvas: null, g: null,
  was: new Float64Array(96), now: new Float64Array(96) };   // what the picture was painted from, and what it's wanted from now

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
  let m = 10 + n * 5, fire = false;
  for (let i = 0; i < n; i++) { const l = L[i], o = 10 + i * 5; f[o] = l.kind; f[o + 1] = l.a; f[o + 2] = l.rgb ? l.rgb[0] : -1; f[o + 3] = l.rgb ? l.rgb[1] : -1; f[o + 4] = l.rgb ? l.rgb[2] : -1; if (l.kind === SKY_FIRE) fire = true; }
  if (fire) { f[m++] = lights.n; for (let i = 0; i < lights.n; i++) { f[m++] = lights.x[i]; f[m++] = lights.y[i]; f[m++] = lights.r[i]; f[m++] = lights.a[i]; } }   // (it flickers in steps: lightsFrame)
  let same = c.width === w && c.height === h;
  for (let i = 0; same && i < m; i++) if (f[i] !== sky.was[i] && !(i === 9 && f[9] - sky.was[9] < SKY_MS)) same = false;
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
    else if (kind === SKY_FIRE) paintFireLights(sg);
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
// paused. Rain coming back washes one out (rainbowWet).
// It stands over the part of the meadow in view when it came out, sized to the window then, and stays there:
// panning and zooming move it like the ground. Painted once (bow), then copied; while it comes out it's copied
// in slices, from one foot.
const BOW_LIFE = 14 * TICKS_PER_SECOND, BOW_IN = 4 * TICKS_PER_SECOND, BOW_OUT = 5 * TICKS_PER_SECOND;   // in ticks
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
  if (bowNow() < ui.sky.bowEnd) return;   // one still out stays
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
    const [sx, y0] = toScreen(e.x, e.y), sy = y0 - px * 0.8 - e.rise * px * a;
    if (!visible(sx, sy, px)) continue;
    const hid = coverAt(sx, sy, e.y);
    if (hid > 0.98) continue;
    const s = sprite(e.emoji, px * 1.1), size = s.size * (0.8 + 0.3 * Math.sin(a * Math.PI)) / 1.1;
    ctx.globalAlpha = (1 - a * a) * (1 - hid);
    ctx.drawImage(s.canvas, sx - size / 2, sy - size / 2, size, size);
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
const pollenShows = () => ui.speed > 0 && cam.zoom * 0.95 >= 7;   // as drawPlants

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
    const hid = coverAt(sx, sy, pollen.y[i] + 0.15);    // (it burst at the flower, a little up off it)
    if (hid > 0.98) continue;
    if (pollen.vx[i] === 0 && pollen.vy[i] === 0) {      // the twinkle: a little cross that shrinks
      const r = s * 4 * (1 - t) * Math.min(1, t * 8);    // pops open, then shrinks away
      ctx.globalAlpha = 0.95 * (1 - t) * (1 - hid);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(sx - r, sy - s * 0.35, r * 2, s * 0.7);
      ctx.fillRect(sx - s * 0.35, sy - r, s * 0.7, r * 2);
      continue;
    }
    const d = 2 * s * (1 - 0.4 * t);                    // (the dot's soft edge is half of it)
    ctx.globalAlpha = (1 - t * t) * (1 - hid);
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
      const hid = coverAt(sx, sy, y0);                       // behind the leaves of a tree in front
      if (hid > 0.98) continue;
      ctx.globalAlpha = a * glow * (1 - hid);
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
      if (!visible(sx, sy, px)) continue;
      const hid = coverAt(sx, sy, y);
      if (hid > 0.98 || !fadeAt(x, y)) continue;
      const s = sprite('🦋', px, tint), flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 13 + h * 20));
      ctx.globalAlpha = 1 - hid;
      ctx.drawImage(s.canvas, sx - s.size * flap / 2, sy - s.size / 2, s.size * flap, s.size);
    }
  }
  ctx.globalAlpha = 1;
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

// A headline now and then: big italic words over the meadow with no card (index.html #announce). Each new day at sunrise
// ("Spring, day 3", with a word on the morning when it's frosty or wet), a new season bigger with what it brings, the first
// of anything in the satchel in gold (firstTime), and a friend's meadow as you come in. One at a time: one that comes while
// another is up waits its turn, but a day's line isn't worth waiting for. None while a card is open or the forager is down.
const ANNOUNCE_MS = { day: 5500, season: 6500, first: 6000, join: 6000, camp: 6000 };
const ANNOUNCE_SOUND = { day: 'dawn', season: 'season', first: 'found', join: 'welcome' };   // (sound.js; making camp has its own, campMoment)
const ANNOUNCE_FADE = 1000;                             // (index.html: it fades out in 0.9 s)
const SEASON_LINES = [
  'Wild garlic and nettles are up, and dandelions in the grass.',
  'Cherries on the trees, strawberries at the wood\'s edge, elderflower by the water.',
  'Blackberries on the brambles, apples falling, nuts and mushrooms in the woods.',
  'Rosehips in the scrub and watercress in the shallows. Keep warm.',
];
const announcing = { el: $('#announce'), timer: 0, until: 0, wait: [], day: -1, openAt: 0 };
function announce(kind, head, line = '') {
  const a = announcing, now = performance.now();
  if (now < a.until && kind !== 'camp') { if (kind !== 'day' && a.wait.length < 4) a.wait.push([kind, head, line]); return; }   // (camp cuts in)
  a.el.className = `on ${kind}`;
  a.el.innerHTML = head + (line ? `<p>${line}</p>` : '');
  if (ANNOUNCE_SOUND[kind]) chime(ANNOUNCE_SOUND[kind], { season: world ? S.clock(world).season : 0 });
  a.until = now + ANNOUNCE_MS[kind] + ANNOUNCE_FADE;
  clearTimeout(a.timer);
  a.timer = setTimeout(() => {
    a.el.classList.remove('on');
    a.timer = setTimeout(() => { const n = a.wait.shift(); if (n) announce(...n); }, ANNOUNCE_FADE);
  }, ANNOUNCE_MS[kind]);
}
const canAnnounce = () => !document.hidden && world.forager.down < 0 && !outfitOpen() && !nameOpen() && !askOpen();

// A few times a second: a new day's line at sunrise (S.phaseOf: a day starts there), and where we are as a meadow opens.
function daybreakTick(now) {
  const a = announcing, day = Math.floor(world.tick / S.TPD), last = a.day, ck = S.clock(world), name = S.SEASONS[ck.season].name;
  a.day = day;
  if (a.openAt && now >= a.openAt && !intro.on) {        // (not over a new meadow's opening: it comes once the bars are off)
    a.openAt = 0;
    if (canAnnounce()) announce('day', `<b class="fr">${name}, day ${ck.dayInSeason}</b><small>year ${ck.year}</small>`, SEASON_LINES[ck.season]);
  }
  if (last < 0 || day !== last + 1 || !canAnnounce()) return;   // (no line for days skipped: a meadow opened, a friend's)
  if (ck.dayInSeason > 1) { announce('day', `<b class="fr">${name}, day ${ck.dayInSeason}</b>`, morningWord()); return; }
  announce('season', `<b class="fr">${name}</b><small>year ${ck.year}</small>`, SEASON_LINES[ck.season]);
}
function morningWord() {
  const k = world.weather.kind;
  if (k === 'snow') return 'Snow falling.';
  if (world.snow > 0.3) return 'Snow on the ground.';
  if (world.frozen) return 'The water is frozen over.';
  if (k === 'storm') return 'A storm blowing.';
  if (k === 'rain') return 'Rain this morning.';
  if (k === 'fog') return 'Fog over the meadow.';
  if (S.airTemp(world) < 0) return 'Frost on the grass.';
  if (k === 'heat') return 'It\'ll be a hot one.';
  return '';
}

// The first of anything, ever: kept in the browser across meadows (what's in the satchel as a meadow opens counts as found
// already, so a meadow from before this came doesn't greet you with old friends). The first fire and the first dish come
// through here too.
const firsts = new Set();
try { for (const k of JSON.parse(localStorage.getItem('aeon-garden-firsts') || '[]')) firsts.add(k); } catch (e) { /* fine */ }
function firstTime(key, small, head, line = '') {
  if (firsts.has(key)) return;
  firsts.add(key);
  try { localStorage.setItem('aeon-garden-firsts', JSON.stringify([...firsts])); } catch (e) { /* fine */ }
  announce('first', `<small>${small}</small><b class="fr">${head}</b>`, line);
}
const firstFind = id => { const g = Recipes.INGREDIENTS[id]; if (g) firstTime(id, 'first find', esc(g.name), esc(g.text || '')); };

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

// How much of the screen is under leafy crowns, 0..1, for the leaves' rustle (pines' needles hardly).
function leavesOnScreen() {
  let a = 0;
  const z = cam.zoom;
  for (const d of world.decor) {
    if (!d.tree || d.stump || d.dead || d.fallen || d.gone || d.hedge) continue;
    const [sx, sy] = toScreen(d.x, d.y), px = d.size * z;
    if (visible(sx, sy, px)) a += px * px * (d.kind === 'pine' ? 0.3 : 1);
  }
  return Math.min(1, 3 * a / (vw * vh));
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
    case 'collapse':
      fg.downAt = performance.now();
      ui.fire = null; ui.place = null; renderBuild();       // (whatever it was doing at a fire, it isn't)
      chime('collapse');
      break;
    case 'woke':
      bodyWoke();
      break;
    case 'firelaid':                                        // (a friend's, laid a piece at a time as the forager's is)
      if (!fireLay.has(e.fire) && !(ui.fire && ui.fire.F === e.fire)) fireLay.set(e.fire, performance.now());
      break;
    case 'firelit':                                         // (a friend's: the forager's own flares in takeFlame)
      if (!(ui.fire && ui.fire.F === e.fire)) { fireFlare.set(e.fire, performance.now()); hear('kindle', e.fire.x, e.fire.y, { v: 0.7 }); }
      break;
    case 'camp':
      campMoment(e.fire);
      break;
    case 'firefed':
      if (e.fire.lit && e.n && !(ui.fire && ui.fire.F === e.fire)) { fireFlare.set(e.fire, performance.now() - TAKE_MS); hear('stick', e.fire.x, e.fire.y); }
      break;
    case 'fireout': case 'firecold': case 'firedoused':
      fireTell(e);
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
      hear('birth', e.hive.x, e.hive.y, { species: 'bee', kids: e.n });
      break;
    case 'queenlost':
      hear('queenlost', e.hive.x, e.hive.y, {}, true);
      break;
    case 'swarm': case 'hivemoved': case 'swarmin': {
      const s = e.swarm || e.hive;
      addEffect('✨', s.x, s.y);
      hear('arrive', s.x, s.y, { species: 'bee' }, true);
      break;
    }
    case 'settle':
      addEffect('✨', e.hive.x, e.hive.y);
      hear('queen', e.hive.x, e.hive.y, {}, true);
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

// ------------------------------------------------------------------ the tab

// Rewriting part of the page with what it already shows still costs the browser a layout and
// a repaint, and the card and inspector refresh four times a second. So only touch what changed.
const shownHTML = new WeakMap();
function setHTML(el, html) { if (shownHTML.get(el) !== html) { shownHTML.set(el, html); el.innerHTML = html; } }

// The tab's icon keeps the meadow's time: the hill takes the season's colour and the sky the
// part of the day. It's the small mark from assets/favicon.svg, one of 16 made once each. It only
// changes when the season or the part of day does, at most once a second.
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
  const part = ck.night ? 3 : ck.phase > 0.6 ? 2 : ck.phase < 0.1 ? 0 : 1;
  const key = ck.season * 4 + part, now = performance.now();
  if (key === markKey || now - markAt < 1000) return;
  markKey = key; markAt = now;
  if (!markIcons.has(key)) markIcons.set(key, markIcon(ck.season, part));
  $('#favicon').href = markIcons.get(key);
}

// A few times a second: the tab's icon.
function updateClock() {
  updateFavicon(S.clock(world));
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
    <div class="family">
      ${c.species === 'rabbit' ? `${coatLine(c)}<br>` : ''}
      ${c.species === 'bee' ? `A worker of ${c.home ? hiveName(c.home).replace(/^The/, 'the') : 'a hive'}${c.queen ? `, a daughter of 👑 Queen ${esc(c.queen.name)}${c.queen.died ? ' 🪦' : ''}` : ''}`
        : c.gen === 1 ? 'One of the first arrivals' : parents ? `${parents} <span class="dim">· generation ${c.gen}</span>` : `Generation ${c.gen}`}
      ${c.kids ? `<br>${c.kids} ${c.kids === 1 ? 'child' : 'children'}${kidsAlive ? `, ${kidsAlive} still alive` : ''}` : ''}
    </div>
    <h4>Life story</h4>
    <ul class="story">${story}</ul>
    ${c.story.length > STORY_SHORT ? `<button class="story-more" data-act="story">${ui.allStory ? 'Show less' : `Show all ${c.story.length}`}</button>` : ''}
    <div class="ins-actions">
      ${!c.alive && living ? `<button class="btn" data-act="child" data-id="${living.id}">🐣 See ${esc(living.name)}</button>` : ''}
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
const anA = s => `${/^[aeiou]/.test(s) ? 'an' : 'a'} ${s}`;
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
  const s = S.seasonOf(world.tick), info = treeInfo(d), k = info.kind, oak = k === 'oak';
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
    here: h => world.hives.includes(h) && !h.leaving,
    spot: h => ({ x: h.x, y: h.y, r: 1.1 }),
    show(h) {
      if (!this.here(h)) {
        if (h.leaving) return { emoji: '🐝', name: hiveName(h), sub: 'Gone', status: '🪽 The swarm flew off over the trees: the meadow had no room for another colony.' };
        if (h.queen) return { emoji: '🐝', name: hiveName(h), sub: 'Moved on', status: '🏡 The swarm has moved into its new home.' };
        if (h.cluster) return { emoji: '🐝', name: 'A swarm', sub: 'Gone', status: '🥀 The swarm never found a home.' };
        return { emoji: '🪵', name: 'Empty hive', sub: 'Gone', status: '🪵 Its tree is gone.' };
      }
      const q = h.queen, ck = S.clock(world), s = ck.season;
      const bees = world.creatures.filter(c => c.alive && c.home === h), out = bees.filter(c => !c.hidden).length;
      let status;
      if (h.cluster) status = `🐝 Hanging in a tree while scouts look for a home. They move in ${hours(h.settleAt - world.tick)} or so.`;
      else if (!q) status = '🕸️ Empty. The old comb waits for a swarm.';
      else if (world.tick < q.laysFrom) status = '💒 The new queen is away on her wedding flight';
      else if (S.patchFresh(world, h)) status = `💃 Dancing about ${h.patch.field ? esc(`the ${h.patch.field.name}`) : 'flowers'} to the ${compass(h.patch.x - h.x, h.patch.y - h.y)}`;
      else if (out) status = `🌼 ${out} out among the flowers`;
      else status = ck.night ? '💤 Asleep for the night' : s === 3 ? '❄️ Huddled up for the winter, living on honey'
        : ['rain', 'storm'].includes(world.weather.kind) ? '🌧️ Waiting out the rain' : '🏠 Everyone is in';
      const chips = [`🍯 ${honeyWord(h)}`, `🐝 ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'}`];
      if (h.swarmed > 0 && !h.cluster) chips.push(`🪽 Swarmed ${ago(h.swarmed)} ago`);
      const facts = [];
      if (q && !h.cluster && h.bees >= S.HIVE_ROOM * 0.8) facts.push(['🏘️', 'Crowded: ready to swarm come early summer']);
      if (q && !h.cluster && s === 3 && h.honey < 2 * h.bees) facts.push(['🥀', 'Running short of honey for the winter']);
      const sections = [];
      if (q) sections.push([`👑 Queen ${esc(q.name)}`, `<div class="family">Generation ${q.gen} · queen for ${ago(q.since)} · has raised ${q.kids} ${q.kids === 1 ? 'bee' : 'bees'}${q.mum ? `<br>A daughter of Queen ${esc(q.mum)}` : ''}</div>`]);
      if (!h.cluster) {
        const fields = world.fields.filter(f => Math.hypot(f.x - h.x, f.y - h.y) < S.FORAGE_RANGE);
        sections.push(['Flowers in reach', fields.length
          ? fields.map(f => `${f.emoji[0]} ${thingLink('field', f.id, esc(f.name))} <span class="dim">· ${f.strip ? 'every season' : seasonName(f.season)} · to the ${compass(f.x - h.x, f.y - h.y)}</span>`).join('<br>')
          : 'No flower fields, only the flowers scattered about']);
      }
      if (bees.length) sections.push(['Bees', linkList(bees)]);
      return {
        emoji: h.cluster ? '🐝' : '🌳', tint: '#e8b83a', name: hiveName(h),
        sub: h.cluster ? `A swarm looking for a home, in ${h.hang ? anA(treeName(h.hang).toLowerCase()) : 'a tree'}` : `A hollow in an old ${treeName(h.tree).toLowerCase()}`,
        status, chips, facts, sections,
        meters: [['Honey', h.honey / S.HIVE_FULL, 'honey'], ['Room', h.bees / S.HIVE_ROOM, h.bees >= S.HIVE_ROOM * 0.8 ? 'low' : '']],
      };
    },
  },

  shroom: {                                                // (before the trees: they grow at the foot of one, or on it)
    at(sx, sy) {
      let best = null, bd = Infinity;
      for (const m of world.shrooms) {
        placeShroom(m, cam.zoom);
        const r = Math.max(fingerTap ? 22 : 12, shroomAt.px * 0.55), d = (shroomAt.x - sx) ** 2 + (shroomAt.y - sy) ** 2;
        if (d < r * r && d < bd) { best = m; bd = d; }
      }
      return best;
    },
    here: m => world.shrooms.includes(m),
    spot: m => ({ x: m.x, y: m.y + (m.tree && !S.standing(m.tree) ? 0.2 : 0), r: 0.5 }),
    show(m) {
      const k = S.SHROOMS[m.kind], name = m.n === 1 ? `A ${k.one.toLowerCase()}` : k.name, d = m.tree, tint = SHROOM_TINT[m.kind];
      const kind = d && treeName(d).toLowerCase(), a = d && /^[aeiou]/.test(kind) ? 'an' : 'a';
      const tree = d && thingLink('tree', d.id, d.name ? 'the ' + esc(d.name) : `${m.kind === 'oyster' ? 'a fallen' : m.kind === 'sulphur' ? 'a dead' : a} ${kind}`);
      const sub = m.kind === 'oyster' ? `On a fallen ${kind}` : m.kind === 'sulphur' ? `On a dead ${kind}` : d ? `Under ${a} ${kind}` : 'On rich ground';
      if (!this.here(m)) return { emoji: shroomFace(m), tint, name, sub: 'Gone', status: '🍂 Gone over, back into the ground. More will come up after the next rain.' };
      const age = (world.tick - m.born) / S.TPD, left = (m.until - world.tick) / S.TPD, life = (m.until - m.born) / S.TPD;
      const status = age < SHROOM_GROW ? '🌧️ Just pushing up after the rain' : left < SHROOM_OVER ? '🍂 Going over: soft, and the slugs have found it' : '🧺 Fresh: just right for picking';
      const why = m.kind === 'oyster' || m.kind === 'sulphur' ? ['🪵', `The fungus is rotting ${tree} away from the inside, and puts these out of the wood after rain`]
        : d ? ['🌳', `The fungus lives on the roots of ${tree}, and puts these up round it after rain, mostly in autumn`] : richWhy(m);
      const facts = [why, SHROOM_COOK[m.kind], ['🧺', `${m.n} ${m.n === 1 ? 'cap' : 'caps'} to pick`],
        ['⏳', left < 1 ? `Gone in about ${hours(left * S.TPD)}` : `Good for about ${days(left)} more`]];
      return { emoji: shroomFace(m), tint, name, sub, status, facts, meters: [['Fresh', clamp(1 - age / life, 0, 1), left < SHROOM_OVER ? 'low' : '']] };
    },
  },

  bramble: {                                               // (before the trees: it grows at the foot of one)
    at(sx, sy) {
      const z = cam.zoom;
      let best = null, bd = Infinity;
      for (const b of world.brambles) {
        const px = bramblePx(b, z), x = (b.x - cam.x) * z + vw / 2, y = (b.y - cam.y) * z + vh / 2 - px * 0.18;
        const d = ((sx - x) / Math.max(fingerTap ? 22 : 10, px * 0.5)) ** 2 + ((sy - y) / Math.max(fingerTap ? 22 : 8, px * 0.24)) ** 2;
        if (d < 1 && d < bd) { best = b; bd = d; }
      }
      return best;
    },
    here: b => world.brambles.includes(b),
    spot: b => ({ x: b.x, y: b.y - 0.15, r: bramblePx(b, cam.zoom) / cam.zoom * 0.45 }),
    show(b) {
      const name = 'Bramble', tint = '#5e3048', face = brambleFace(b);
      const sub = b.by === 'crow' ? 'Sown by a crow' : b.by === 'tip' ? 'Rooted from the next one' : 'At the wood\'s edge';
      if (!this.here(b)) return { emoji: face, tint, name, sub, status: '🌳 Gone: the wood closed over it, or the rabbits had it young' };
      const art = brambleArt(b), left = b.crop > 0 ? b.berries / b.crop : 0;
      const status = [
        '❄️ Bare canes: nothing on it till summer', '🌿 In leaf', '🌸 In flower: blackberries late in the summer',
        '🟢 Berries ripening, green and red', '🫐 Ripe blackberries: pick them', '🫐 Ripe blackberries, the crows have had some',
        '🐦‍⬛ Nearly picked clean: the crows have had them', '🍂 Going over: they say the devil spits on them now'][art];
      const crows = world.creatures.filter(c => c.alive && c.species === 'crow' && c.mode === 'berries' && c.target && c.target.b === b);
      const foxes = world.creatures.filter(c => c.alive && c.species === 'fox' && c.mode === 'berries' && c.target && c.target.b === b);
      const hiding = world.creatures.filter(c => c.alive && c.mode === 'thicket' && c.refuge === b);
      const bees = world.creatures.filter(c => c.alive && c.species === 'bee' && c.mode === 'sip' && c.target && c.target.tree === b).length;
      const why = b.by === 'crow' ? ['🐦‍⬛', 'A crow ate blackberries off another bramble and dropped the pips here'] : b.by === 'tip' ? ['🌿', 'A cane of the bramble next door arched over and rooted at its tip'] : ['🌳', 'Brambles like the sun at the wood\'s edge, and the thorn bushes'];
      const years = Math.floor((world.tick - b.born) / S.YEAR_DAYS / S.TPD);
      const facts = [why, ['🍳', 'Blackberry crumble with the windfall apples, jam, or a cordial for the winter'],
        ['📅', b.size === 0 ? 'Young: it fruits from its second summer' : years < 1 ? 'Came up here last year' : `Has grown here for ${years === 1 ? 'a year' : `${years} years`}`]];
      if (crows.length) facts.push(['🐦‍⬛', crows.length === 1 ? `${link(crows[0])} is eating the berries` : `${crows.length} crows are eating the berries`]);
      if (foxes.length) facts.push(['🦊', foxes.length === 1 ? `${link(foxes[0])} is nosing blackberries off the low canes` : `${foxes.length} foxes are eating the berries`]);
      if (hiding.length) facts.push(['🫣', hiding.length === 1 ? `${link(hiding[0])} is hiding deep in the thorns, safe from the foxes` : `${hiding.length} rabbits are hiding deep in the thorns, safe from the foxes`]);
      else if (b.size > 0) facts.push(['🐇', 'Thorny enough to hide a rabbit: no fox follows one in']);
      if (art === 2) facts.push(['🐝', bees ? `${bees === 1 ? 'A bee is' : `${bees} bees are`} at the flowers: ${b.visits} ${b.visits === 1 ? 'visit' : 'visits'} so far` : b.visits ? `The bees have been ${b.visits} ${b.visits === 1 ? 'time' : 'times'}: the more, the more berries` : 'No bees yet: the more they come, the more berries']);
      return { emoji: face, tint, name, sub, status, facts, meters: art >= 4 && art <= 6 ? [['Berries', clamp(left, 0, 1), left < 0.25 ? 'low' : '']] : undefined };
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
      if (d.hive) facts.push(['🐝', `${thingLink('hive', d.hive.id, hiveName(d.hive))} is in its hollow${d.hive.queen ? '' : ': an empty one'}`]);
      else if (S.hollow(world, d)) facts.push(['🕳️', 'Old enough to have gone hollow: a swarm could make a home in it']);
      const swarm = world.hives.find(h => h.cluster && !h.leaving && h.hang === d);
      if (swarm) facts.push(['🐝', `${thingLink('hive', swarm.id, hiveName(swarm))} is hanging in it`]);
      const otter = d.holt && world.byId.get(d.holt);
      if (otter && otter.alive) facts.push(['🦦', `${link(otter)} the otter has her holt in its roots, down by the water`]);
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
      const shroom = world.shrooms.find(m => m.tree === d);
      if (shroom) facts.push(['🍄', `${S.SHROOMS[shroom.kind].name} ${living ? 'under it' : 'on it'}`]);
      if (d === world.roost) facts.push(['🐦‍⬛', 'The crows\' roost: they all sleep here at night']);
      if (world.creatures.some(c => c.alive && c.species === 'crow' && c.home === d)) facts.push(['🪺', 'A crows\' nest is up in it']);
      if (d.nuts && S.seasonOf(world.tick) === 2) facts.push(['🌰', `${d.nuts} ${d.nuts === 1 ? k.mast.slice(0, -1) : k.mast} left for the crows to carry off and bury`]);
      if (world.snow > 0.3 && !d.stump) facts.push(['❄️', d.fallen ? 'Snow on it' : 'Snow on the branches']);
      if (d.windfall) facts.push([d.kind === 'apple' ? '🍎' : '🌰', `${d.windfall === 1 ? `A windfall ${d.kind === 'apple' ? 'apple lies' : k.mast.slice(0, -1) + ' lies'}` : `${d.windfall} windfall ${d.kind === 'apple' ? 'apples' : k.mast} lie`} under it, for any hungry rabbit`]);
      if (living && !young && world.wet < 0.5) facts.push(['⚡', 'Dry: a lightning strike would set it alight']);   // as strike does
      const shade = whoNear(d.x, d.y, Math.max(1.5, treePx(d) / cam.zoom * 0.4));
      if (shade) facts.push([d.fallen ? '🪵' : '🌳', `${d.fallen ? 'By it' : 'Under it'}: ${shade}`]);
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

  green: {                                                 // (after the trees and rocks: the garlic lies under them)
    at(sx, sy) {
      const z = cam.zoom;
      let best = null, bd = Infinity;
      for (const g of world.greens) {
        if (S.greenStage(world, g) === null) continue;
        const x = (g.x - cam.x) * z + vw / 2, y = (g.y - cam.y) * z + vh / 2;
        let d;
        if (g.kind === 'garlic') { const px = garlicPx(g, z); d = ((sx - x) / (px * 0.5)) ** 2 + ((sy - y + px * 0.1) / (px * 0.2)) ** 2; if (d > 1) continue; }
        else { const px = nettlePx(g, z), r = Math.max(fingerTap ? 22 : 12, px * 0.4); d = ((sx - x) ** 2 + (sy - y + px * 0.3) ** 2) / (r * r); if (d > 1) continue; d -= 1; }   // (nettles first: they stand)
        if (d < bd) { best = g; bd = d; }
      }
      return best;
    },
    here: g => world.greens.includes(g) && S.greenStage(world, g) !== null,
    spot: g => ({ x: g.x, y: g.y, r: g.kind === 'garlic' ? garlicPx(g, cam.zoom) / cam.zoom * 0.45 : 0.6 }),
    show(g) {
      const garlic = g.kind === 'garlic', name = garlic ? 'Wild garlic' : 'Nettles', stage = S.greenStage(world, g);
      const water = S.waterAt(world, g.x, g.y), sub = garlic ? `In the damp wood${water ? ` by the ${water.name}` : ''}` : 'On rich ground';   // (it's always near water)
      const face = greenFace(g, stage ?? 0), tint = garlic ? '#5ca03a' : '#40702e';
      if (!this.here(g)) return { emoji: face, tint, name, sub, status: '🌱 Gone under the ground till next spring' };
      const status = stage < 2 && S.greenPicked(g) ? '✂️ Picked for now: it grows back in a few days' : garlic ? ['🌿 Leaves up: pick them young, before it flowers', '🌸 In flower: the leaves are still good, and the flowers too', '🍂 Dying back till next spring'][stage]
        : ['🧤 Young tops: pick them, with gloves', '🌾 Tall and in flower: too tough to eat now', '🍂 Dying back till next spring'][stage];
      const why = garlic ? ['💧', 'It likes damp shade, and the wood here is close to the water: it spreads a little each spring'] : richWhy(g);
      const cook = garlic ? ['🍳', 'Smells of garlic from yards off: wilted into butter, a soup or a green sauce'] : ['🍳', 'Nettle soup, or wilted like spinach: cooking takes the sting out'];
      const years = Math.floor((world.tick - g.born) / S.YEAR_DAYS / S.TPD);
      const facts = [why, cook, ['📅', years < 1 ? 'Came up here this year' : `Has come up here every spring for ${years === 1 ? 'a year' : `${years} years`}`]];
      return { emoji: face, tint, name, sub, status, facts };
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
      const hives = world.hives.filter(h => !h.cluster && h.queen && Math.hypot(f.x - h.x, f.y - h.y) < S.FORAGE_RANGE);
      const sections = [['Hives in reach', hives.length
        ? hives.map(h => `🐝 ${thingLink('hive', h.id, hiveName(h))}`).join('<br>')
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

// What's at a spot, if not an animal: { kind, it } or null for bare ground. (A click there walks the forager now, so
// nothing asks; kept for when it gathers.)
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

function select(id) {
  ui.selectedId = id;
  ui.picked = null;
  ui.trail = [];
  ui.sheetUp = false;
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

// Paused or running: the one button in the corner, and space.
function setSpeed(s, heard) {
  if (Net && Net.guest && !heard) { Net.send({ t: 'speed', s }); return; }   // (the host keeps everyone's clock: a guest asks it)
  ui.speed = s;
  if (Net && Net.host) sendPos(performance.now());       // (the guests keep to it at once)
  Sound.update({ speed: s });
  const b = $('[data-act="pause"]');
  b.textContent = s ? '⏸' : '▶';
  b.title = s ? 'Pause (space)' : 'Carry on (space)';
}

// The camera stays with the forager (leadCam): nothing pans it. Two fingers pinch, the wheel, a double tap and + - zoom it
// about the forager (zoomOn).
let drag = null, pinch = null;
let fingerTap = false;                    // the last press was a finger: taps may wobble a little and hit a little wider
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
let zoomTo = null;                        // a zoom easing in or out about the forager { z } (frame)
let tapAway = 0;
const HOLD_MS = 280, STEER_MS = 120;      // a press held this still this long runs toward the pointer, the way found again this often
let holdTimer = 0;

function zoomOn(z) { const [sx, sy] = toScreen(fg.x, fg.y); zoomAt(sx, sy, z); }

function startPinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: cam.zoom, mx, my, t0: performance.now(), moved: false };
  if (drag?.blow) blowOn(false);
  drag = null; zoomDrag = null; zoomTo = null; cam.goal = null;
  clearTimeout(holdTimer);
}

function movePinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y);
  if (Math.abs(d - pinch.d) > 12 || Math.hypot(mx - pinch.mx, my - pinch.my) > 12) pinch.moved = true;
  zoomOn(pinch.zoom * d / pinch.d);
}

function liftFinger(e) {
  fingers.delete(e.pointerId);
  if (!pinch) return false;
  if (fingers.size >= 2) startPinch();
  else {                                  // one finger left: it does nothing till it's lifted, never a tap
    if (!pinch.moved && performance.now() - pinch.t0 < DOUBLE_MS) zoomTo = { z: clamp(cam.zoom / 2, fitZoom, 64) };   // two fingers tapped: out
    pinch = null;
  }
  return true;
}

canvas.addEventListener('pointerdown', e => {
  if (!world) return;                     // (a kept meadow still opening)
  if (e.button === 2 || (e.ctrlKey && e.pointerType === 'mouse')) return;
  if (chatOpen() && chatAway(e)) return;
  canvas.setPointerCapture(e.pointerId);
  fingerTap = e.pointerType === 'touch';
  zoomTo = null;
  if (fingerTap) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size >= 2) { startPinch(); return; }
  if (atFire()) {                                       // at a fire: a press anywhere blows on it while it's held (pointerup)
    lastTap = null; clearTimeout(holdTimer);
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, steer: false, px: e.clientX, py: e.clientY, at: 0, on: false, rush: false, blow: true, t0: e.timeStamp };
    blowOn(true);
    return;
  }
  const tap = lastTap;
  lastTap = null;
  if (fingerTap && tap && e.timeStamp - tap.t < DOUBLE_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < DOUBLE_PX) {
    clearTimeout(tapAway); tapAway = 0;   // (the first tap put nothing away after all)
    zoomDrag = { id: e.pointerId, y: e.clientY, z: cam.zoom, moved: false };
    drag = null; cam.goal = null;
    return;
  }
  if (ui.place && fingerTap) placeAt(...toWorld(e.clientX, e.clientY));   // (picking a spot for a fire: the faint one under the finger)
  // (pressed on something to pick, or a fire, it's a tap however long it's held, and a wobble more doesn't make it a drag: held, it runs there)
  const on = !animalAt(e.clientX, e.clientY) && (!!fireAt(e.clientX, e.clientY) || !!gatherAt(e.clientX, e.clientY));
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, steer: false, px: e.clientX, py: e.clientY, at: 0, on, rush: false, blow: false, t0: e.timeStamp };
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {                        // held still on the ground: it runs toward the pointer while it's down
    if (!drag || drag.moved || pinch || zoomDrag || fingers.size > 1 || ui.place || animalAt(drag.x, drag.y)) return;
    if (drag.on) { drag.rush = true; return; }
    drag.steer = true; drag.at = performance.now();
    walkTo(drag.px, drag.py, true);
  }, HOLD_MS);
});
canvas.addEventListener('pointermove', e => {
  if (!world) return;
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); handMoved(e.timeStamp); return; }
  if (zoomDrag && e.pointerId === zoomDrag.id) {
    const dy = e.clientY - zoomDrag.y;
    if (zoomDrag.moved || Math.abs(dy) > 8) { zoomDrag.moved = true; zoomOn(zoomDrag.z * Math.exp(dy * ZOOM_DRAG)); handMoved(e.timeStamp); }
    return;
  }
  if (drag?.blow) return;                                 // (blowing on a fire: held anywhere, it doesn't steer)
  if (ui.place && (drag || e.pointerType === 'mouse')) {  // (picking a spot for a fire: the faint one follows the pointer)
    placeAt(...toWorld(e.clientX, e.clientY));
    if (drag && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 10) drag.moved = true;
    return;
  }
  if (drag?.steer) { drag.px = e.clientX; drag.py = e.clientY; return; }   // (holding: it runs toward the pointer, frame)
  if (!drag) {
    const c = e.pointerType === 'mouse' ? animalAt(e.clientX, e.clientY) : null;
    ui.hoverId = c ? c.id : 0;
    aim.in = e.pointerType === 'mouse'; aim.x = e.clientX; aim.y = e.clientY; aim.moved = true;   // (what's to gather under it: hoverFrame)
    canvas.classList.toggle('on-animal', !!c);
    return;
  }
  // Moved off where it was pressed: a drag steers the forager as a press held still does, running toward the pointer.
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > (e.pointerType === 'touch' ? 10 : 4) * (drag.on ? 2.5 : 1)) {
    clearTimeout(holdTimer);
    drag.moved = drag.steer = true; drag.at = performance.now(); drag.px = e.clientX; drag.py = e.clientY;
    walkTo(drag.px, drag.py, true);
  }
});
canvas.addEventListener('pointerup', e => {
  if (zoomDrag && e.pointerId === zoomDrag.id) {           // a double tap: in on the spot, unless it was dragged
    fingers.delete(e.pointerId);
    if (!zoomDrag.moved) zoomTo = { z: clamp(cam.zoom * 2, fitZoom, 64) };
    zoomDrag = null;
    return;
  }
  clearTimeout(holdTimer);
  if (liftFinger(e)) return;
  if (drag?.blow) {                                     // (at a fire: let go, it stops blowing; a quick tap well off the fire walks away)
    blowOn(false);
    const j = ui.fire, [wx, wy] = toWorld(e.clientX, e.clientY);
    if (j && e.timeStamp - drag.t0 < 250 && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12 && Math.hypot(wx - j.x, wy - j.y) > 3) click(e.clientX, e.clientY);
    drag = null;
    return;
  }
  if (ui.place && drag) { placeHere(e.clientX, e.clientY); drag = null; return; }   // (picking a spot for a fire: there)
  if (drag?.steer) {                                    // (held: it runs on to where it was let go, and picks what it was let go on)
    const c = animalAt(e.clientX, e.clientY), F = !c && fireAt(e.clientX, e.clientY), t = !c && !F && gatherAt(e.clientX, e.clientY);
    if (F) clickFire(F); else if (t) goGather(t, true); else walkTo(e.clientX, e.clientY, true);
  } else if (drag && !drag.moved) {
    click(e.clientX, e.clientY, drag.rush);
    if (fingerTap) lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }
  drag = null;
});
canvas.addEventListener('pointercancel', e => {
  clearTimeout(holdTimer);
  if (zoomDrag && e.pointerId === zoomDrag.id) { fingers.delete(e.pointerId); zoomDrag = null; return; }
  if (liftFinger(e)) return;
  if (drag?.blow) blowOn(false);
  drag = null;
});
// Safari ignores the viewport's no-zoom, and a zoomed page makes the whole meadow blurry.
document.addEventListener('gesturestart', e => e.preventDefault());
// Safari on a phone shows a button pressed (:active) only where something listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true });
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ui.hoverId = 0; aim.in = false; } });   // a lifted finger leaves too
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? innerHeight : 1;   // Firefox's wheel counts lines (3 a notch, Chrome's 100 px)
  cam.goal = null; zoomTo = null;   // a mouse wheel, a trackpad's pinch or its two-finger scroll up and down: zoom
  zoomOn(cam.zoom * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.012 : 0.0018)));
  handMoved(e.timeStamp);
}, { passive: false });

// A click or a tap on an animal (on it as it's drawn: animalAt) opens its panel; on something to gather, the forager
// goes and picks it (goGather); anywhere else, the forager walks there and the panel shuts (walkTo).
function click(sx, sy, run = false) {
  clearTimeout(tapAway); tapAway = 0;
  if (ui.place) { placeHere(sx, sy); return; }            // (picking a spot for a fire: there)
  const c = animalAt(sx, sy), F = !c && fireAt(sx, sy), t = !c && !F && gatherAt(sx, sy);
  if (c) select(c.id);
  else if (F) clickFire(F);                               // (a fire: off to see to it)
  else if (t) { if (!queueGather(t)) goGather(t, run); }
  else walkTo(sx, sy);
}
// A tap walks it there; held (steering) or with Shift down, it runs.
function walkTo(sx, sy, steering = false, keepQueue = false) {
  const [wx, wy] = toWorld(sx, sy), g = S.foragerTo(world, wx, wy);
  if (g) world.forager.running = (steering || shiftHeld) && !world.forager.winded;   // (out of breath, it walks)
  ui.gather = null; ui.fire = null;                     // (a new walk: whatever it was going to pick, or do at a fire, it isn't)
  if (!keepQueue) ui.queue.length = 0;
  if (ui.selectedId || ui.picked) select(0);
  if (!g) return;
  if (steering && ui.mark && !ui.mark.end) { ui.mark.x = g.x; ui.mark.y = g.y; }
  else ui.mark = { x: g.x, y: g.y, t0: performance.now(), end: 0, sx: g.x, sy: g.y, at: 0 };   // (sx, sy: where it's shown, drawMark)
}
// The animal drawn under a point: within its painting's body (a fingertip reaches a little further), the nearest.
// Tighter than creatureAt, so a click on the grass beside a rabbit walks there.
function animalAt(sx, sy) {
  let best = null, bd = Infinity;
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const [x, y] = screenOf(c), px = creaturePx(c), r = Math.max(12, px * 0.42) + (fingerTap ? 8 : 0);
    const d = Math.hypot(x - sx, y - sy);
    if (d < r && d / r < bd) { best = c; bd = d / r; }
  }
  return best;
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

// ------------------------------------------------------------------ playing together
//
// net.js finds the others (?room=..: the first one in is the host); here is what goes over and what's done with it. The
// host's meadow is everyone's: a guest is sent it as it is (worldMsg) and from then on runs the same sim to the host's
// clock (guestBehind), with its own forager in it, which the sim doesn't count on (nothing it does draws the meadow's
// random numbers). So only the foragers go over (where each is, every POS_MS) and what they pick and drop, with the tick
// it happened on: one from ahead waits for its tick (net.later), so the host's picks land on a guest at the same tick.
// A guest's own pick lands on the host a little late, so now and then (CHECK_TICKS) both sum the meadow up (meadowSum),
// and a guest off from the host twice running asks for the meadow again (netCheck). A friend is drawn as the forager is,
// in its own cloak (peerItems, drawPeer), slid between where it last said it was, with its name over it (drawPeerNames).
// Its body goes along with where it is (how cold, wet and snowy), so it hunches, shivers, drips, breathes in the cold and
// leaves footprints and rings as the forager does (drawFigure, drawBody), and each pick it sends shows on it: it turns
// and stoops, and its "+3 Chanterelles" floats up there (peerPicked).
// A guest who loses the host keeps the meadow as its own. The name is asked once, on a small card at the foot as the
// cloak's is (askName), the first time you play together, and kept in localStorage; ••• has it while together.
// The chat: Enter, T or 💬 on the pill opens a small card bottom left (openChat): a few things to say with one tap
// (CHAT_QUICK) and a line to type on. On a touch screen it opens up top, out of the keyboard's way, the keyboard waits for a
// tap on the line, and while it's up the forager is kept in view between them (keyboardUp). What's said goes to everyone (t: 'say'), pops up as a bubble over the forager who said it for a while
// (chatArt, painted once a line, drawn with the names; laid out together so two side by side don't hide each other,
// layChats) and as a line in the log over the card, which fades after CHAT_LOG_MS (all of it back while the card is open).
const POS_MS = 150;                        // ms between a forager's "here I am"
const PEER_SLIDE = 1.3;                    // a friend glides to where it said over this many POS_MS (so it's still going when the next comes)
const PEER_STILL_MS = 250;                 // a friend that hasn't moved this long is standing
const PEER_GONE = 8000;                    // ms with no word from a friend before it's taken for gone
const CHECK_TICKS = 300;                   // ticks between sums of the meadow
const ASK_AGAIN_MS = 20000;                // a guest asks for the meadow again at most this often
const AHEAD_MS = 500;                      // a guest runs on at most this far past the last tick it heard (the host's tab may have stopped)
const ROOM_WORDS = ['acorn', 'bramble', 'hazel', 'sorrel', 'fern', 'thistle', 'willow', 'clover', 'moss', 'heather', 'rowan', 'elder'];
const NAME = 'aeon-garden-name';           // in localStorage: the name friends know you by
const NAME_MOST = 16;                      // letters in a name, at most
const NAME_UP = 0.64;                      // a friend's name sits this many of its forager's sizes over its feet (just over its hood)
const CHAT_MOST = 120;                      // letters in a line of chat, at most
const CHAT_MS = 3500, CHAT_PER = 70, CHAT_LONGEST = 10000;   // a bubble stays CHAT_MS, and CHAT_PER more a letter, up to CHAT_LONGEST
const CHAT_WIDE = 200;                      // px a bubble is at most, before its words wrap
const CHAT_LOG_MS = 12000;                 // a line in the log fades after this
const CHAT_KEEP = 40;                      // lines the log keeps
const CHAT_QUICK = ['👋 Hello!', 'Over here!', 'Come and see!', 'Thank you!', 'Wait for me!', '😊', '❤️'];   // said with one tap
const CHAT_TAIL = 7;                       // px from a bubble's foot down to the tip of its tail
const CHAT_TAIL_IN = 16;                   // px from a bubble's side its tail may come, at most (so a bubble slid aside still points down to who said it)
const CHAT_GAP = 6;                        // px kept between two bubbles
const CHAT_SLIDE = 120;                    // ms a bubble takes to slide aside for another
let myName = '', nameAsked = false, nameThen = null, nameOutfit = false, myChat = null;
try { myName = cleanName(localStorage.getItem(NAME)); } catch (e) { /* none, then */ }
const net = { tick: -1, base: 0, rate: 0, sentAt: 0, hostId: '', later: [], hostSums: new Map(), mySums: new Map(), off: 0, askedAt: -1e9, shown: '' };
const peers = new Map();                   // friends' foragers, by id

function startTogether() {
  if (!Net) return;
  Net.start(ROOM, params.has('local'), {
    ready(role) {
      if (!myName && !nameAsked) askName(true);
      if (role === 'host') toast(`🧺 Your meadow is open to friends. Send them the link (••• › Play together).`);
      else toast('🧺 Walking over to your friend’s meadow…');
    },
    joined(id) { Net.send(worldMsg(id)); },
    message: heardNet,
    lost() { hostGone(); },
    failed(why) { toast(`🧺 Couldn't open the meadow to friends (${esc(why)}).`); },
  });
}

// ••• › Play together: opens this meadow to friends (a room of its own in the address), and shares the link.
function together() {
  if (!Net) return;
  if (!myName && !nameAsked) { askName(true, together); return; }   // (shared once it's said, or put away)
  if (!ROOM) {
    ROOM = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)] + '-' + (100 + Math.floor(Math.random() * 900));
    history.replaceState(history.state, '', pageLink(world.seed));
    startTogether();
  }
  const url = location.href;
  if (canShare) { navigator.share({ title: "Nobody's Meadow", text: 'Come and forage with me.', url }).catch(() => {}); return; }
  navigator.clipboard?.writeText(url).then(
    () => toast('🧺 Link copied. Whoever opens it comes into this meadow with you.'),
    () => toast(`🧺 Send a friend this link: ${esc(url)}`));
}

const worldMsg = to => ({ t: 'world', to, kept: S.packWorld(world), tick: world.tick, s: ui.speed, n: myName });

// The name friends know you by: a small card at the foot, the meadow going on behind it. Put away unsaid, you're "a friend".
function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MOST); }
function askName(open, then) {
  const card = $('#name-card');
  if (open) {
    nameAsked = true; nameThen = then || null;
    if (outfitOpen()) { pickOutfit(false); nameOutfit = true; }   // (one card at the foot at a time: the cloak's comes back after)
    $('#name-text').value = myName;
    card.classList.remove('hidden');
    if (!narrow()) $('#name-text').focus({ preventScroll: true });   // (on a phone the keyboard would jump up)
    return;
  }
  if (card.classList.contains('hidden')) return;
  card.classList.add('hidden');
  $('#name-text').blur();
  const go = nameThen;
  nameThen = null;
  if (nameOutfit) { nameOutfit = false; if (!fg.picked) pickOutfit(true); }
  if (go) go();
}
const nameOpen = () => !$('#name-card').classList.contains('hidden');
$('#name-form').addEventListener('submit', e => {
  e.preventDefault();
  myName = cleanName($('#name-text').value);
  try { if (myName) localStorage.setItem(NAME, myName); else localStorage.removeItem(NAME); } catch (err) { /* fine */ }
  askName(false);
  if (Net && Net.on) sendPos(performance.now());          // (they see it at once)
});
$('#name-card').addEventListener('keydown', e => { if (e.key === 'Escape') askName(false); });

// A friend's name, painted once (a parchment pill), drawn over it at one size whatever the zoom.
const NAME_ARTS = new Map();
function nameArt(name) {
  let a = NAME_ARTS.get(name);
  if (a) return a;
  if (NAME_ARTS.size > 32) NAME_ARTS.clear();
  const k = Math.max(1, dpr), F = 13 * k, c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `800 ${F}px Nunito, ui-rounded, system-ui, sans-serif`;
  g.font = font;
  const h = Math.round(F * 1.6), w = Math.ceil(g.measureText(name).width) + Math.round(F * 1.1), r = h / 2, sh = Math.round(1.5 * k);
  c.width = w + 2; c.height = h + sh + 2;
  const pill = (y) => { g.beginPath(); g.arc(1 + r, 1 + y + r, r, Math.PI / 2, Math.PI * 1.5); g.arc(1 + w - r, 1 + y + r, r, -Math.PI / 2, Math.PI / 2); g.closePath(); };
  g.fillStyle = 'rgba(60, 40, 10, 0.25)'; pill(sh); g.fill();
  g.fillStyle = 'rgba(251, 244, 224, 0.94)'; pill(0); g.fill();
  g.strokeStyle = 'rgba(176, 132, 58, 0.8)'; g.lineWidth = k; g.stroke();
  g.font = font; g.fillStyle = '#5a4526'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 1 + w / 2, 1 + r + k * 0.5);
  a = { img: c, w: c.width / k, h: c.height / k };
  asBitmap(c, b => { a.img = b; });
  NAME_ARTS.set(name, a);
  return a;
}
const friendName = p => p && p.name ? esc(p.name) : '';

function heardNet(m) {
  const now = performance.now();
  if (m.t === 'pos') heardPos(m, now);
  else if (m.t === 'world') { if (Net.guest) heardWorld(m, now); }
  else if (m.t === 'pick' || m.t === 'drop' || m.t === 'fire') {
    if (Net.guest && net.tick < 0) return;              // (the meadow's on its way, with this in it)
    if (m.t === 'pick') peerPicked(m, now);
    if (m.tick > world.tick) { net.later.push(m); net.later.sort((a, b) => a.tick - b.tick); }
    else applyNet(m);
  }
  else if (m.t === 'speed') { if (Net.host) setSpeed(m.s, true); }
  else if (m.t === 'sum') { if (Net.guest) { net.hostSums.set(m.tick, m.sum); compareSum(m.tick); } }
  else if (m.t === 'again') { if (Net.host) Net.send(worldMsg(m.from)); }
  else if (m.t === 'bye') { if (Net.guest && m.from === net.hostId) hostGone(); else friendGone(m.from); }
  else if (m.t === 'say') heardChat(m, now);
}

// The host's meadow, as a guest comes (to it alone), as the host starts a new one (to all), or again after drifting off.
function heardWorld(m, now) {
  const w = S.unpackWorld(m.kept);
  if (!w) { toast('🧺 Your friend’s meadow is from another version of the game. Reload both pages.'); return; }
  const again = net.tick >= 0 && m.to, mine = again ? world.forager : null, zoom = cam.zoom;
  showWorld(w);
  endIntro(true);                                        // (a friend's meadow: no opening of our own over it)
  if (mine) w.forager = mine;                            // (the same meadow again: its own forager stays as it was)
  else { arrive(w.forager); pr.n = 0; pr.next = 0; }
  renderSatchel();                                       // (showWorld drew the host's satchel, as it came)
  cam.zoom = zoom; cam.x = world.forager.x; cam.y = world.forager.y - CAM_FEET * forPx() / cam.zoom; clampCam();
  history.replaceState(history.state, '', pageLink(w.seed));
  net.hostId = m.from; net.later.length = 0; net.hostSums.clear(); net.mySums.clear(); net.off = 0;
  setClock(m.tick, m.s, now, true);
  const host = cleanName(m.n);
  if (!again) { announce('join', `<small>you’re in</small><b class="fr">${host ? esc(host) + '’s' : 'your friend’s'} meadow</b>`, 'Forage together!'); openingLine(); }
}
// A guest's forager comes in beside the host's (it's the host's, unpacked): with an empty satchel, fresh, or cold and wet
// in the meadow's opening storm (sim.js foragerArrives).
function arrive(f) {
  f.bag.fill(''); f.bagN.fill(0);
  S.foragerArrives(world, f);
  f.walking = false; f.running = false; f.speed = 0; f.path.length = 0;
  for (const [dx, dy] of [[0.9, 0.3], [-0.9, 0.3], [0, 0.9], [0.9, -0.5], [-0.9, -0.5]]) {
    if (S.walkable(world, f.x + dx, f.y + dy)) { f.x += dx; f.y += dy; break; }
  }
  f.goalX = f.x; f.goalY = f.y; f.heading = Math.PI / 2;
}

// The host's clock, as the guest has it: the tick it's at now is base + now * rate. Of the times heard, the one that makes
// it furthest on is the truest (it waited least on the way), so a later one only pulls it back slowly.
function setClock(tick, speed, now, fresh) {
  const rate = TICKS_PER_SECOND * speed / 1000, base = tick - now * rate;
  if (fresh || rate !== net.rate || base > net.base) net.base = base;
  else net.base += (base - net.base) * 0.05;
  net.rate = rate; net.tick = tick;
  if (speed !== ui.speed) setSpeed(speed, true);
}
// How many ticks the guest is behind the host's clock.
function guestBehind(now) { return Math.max(0, Math.min(net.base + now * net.rate, net.tick + AHEAD_MS * net.rate) - world.tick); }

// Every tick while together: what was waiting for this tick, and now and then a sum of the meadow.
function netTick() {
  while (net.later.length && net.later[0].tick <= world.tick) applyNet(net.later.shift());
  if (world.tick % CHECK_TICKS === 0 && (Net.host || net.tick >= 0)) netCheck();
}
function applyNet(m) {
  if (m.t === 'fire') { fireNet(m); return; }            // (a fire laid, fed or lit)
  if (m.t === 'pick') {
    const it = thingAt(m.kind, m.id, m.x, m.y);
    if (it) S.takeFrom(world, m.kind, it, m.n);
  } else S.dropAt(world, m.kind, m.x, m.y, m.n, m.born, m.until);
  picks.at = -1e9; aim.moved = true;                    // (what's left to pick, listed again)
}
function thingAt(kind, id, x, y) {
  const w = world, list = kind === 'shroom' ? w.shrooms : kind === 'find' ? w.finds : kind === 'dropped' ? w.dropped : kind === 'green' ? w.greens
    : kind === 'bramble' ? w.brambles : kind === 'tree' ? w.decor : kind === 'hive' ? w.hives : null;
  if (list) for (const it of list) {
    if (Math.abs(it.x - x) < 1e-3 && Math.abs(it.y - y) < 1e-3 && (kind === 'tree' || kind === 'hive' || kind === 'bramble' || it.kind === id)) return it;
  }
  return null;
}
// A sum of what the foragers can change and what follows from it: what's to pick, the hives, where every animal is.
function meadowSum(w) {
  let h = w.creatures.length * 7 + w.finds.length * 13 + w.shrooms.length * 17 + w.dropped.length * 19 + w.windfalls * 23;
  for (const c of w.creatures) h = (h * 31 + Math.round(c.x * 64) * 3 + Math.round(c.y * 64)) | 0;
  for (const f of w.finds) h = (h * 31 + f.n) | 0;
  for (const d of w.dropped) h = (h * 31 + d.n) | 0;
  for (const v of w.hives) h = (h * 31 + Math.round(v.honey * 64)) | 0;
  for (const F of w.fires) h = (h * 31 + (F.lit ? 2 : 1)) | 0;   // (the fires, and which burn: not their sticks, which a late word shifts a little)
  return h;
}
function netCheck() {
  const sum = meadowSum(world);
  if (Net.host) { Net.send({ t: 'sum', tick: world.tick, sum }); return; }
  net.mySums.set(world.tick, sum);
  compareSum(world.tick);
}
function compareSum(tick) {
  const a = net.hostSums.get(tick), b = net.mySums.get(tick);
  if (a === undefined || b === undefined) {
    for (const k of net.hostSums.keys()) if (k < tick - 10 * CHECK_TICKS) net.hostSums.delete(k);
    for (const k of net.mySums.keys()) if (k < tick - 10 * CHECK_TICKS) net.mySums.delete(k);
    return;
  }
  net.hostSums.delete(tick); net.mySums.delete(tick);
  net.off = a === b ? 0 : net.off + 1;
  const now = performance.now();
  if (net.off >= 2 && now - net.askedAt > ASK_AGAIN_MS) {
    net.askedAt = now; net.off = 0;
    console.info('Together: drifted from the host’s meadow at tick', tick, ', asking for it again');
    Net.send({ t: 'again', to: net.hostId });
  }
}

// Once a frame: say where this forager is, every POS_MS (the host with its clock).
function netFrame(now) {
  if (!Net || !Net.on || now - net.sentAt < POS_MS || Net.guest && net.tick < 0) return;
  sendPos(now);
}
function sendPos(now) {
  net.sentAt = now;
  const f = world.forager;
  Net.send({ t: 'pos', x: f.x, y: f.y, h: f.heading, j: fg.jog, st: S.warmthStage(f), wt: Math.round(f.wet * 20) / 20, sn: fg.snowArt, o: fg.outfit,
    kn: fg.kneel, fl: fg.flip, tick: Net.host ? world.tick : -1, s: ui.speed, n: myName });   // (kn: kneeling at a fire, and which way)
}
function heardPos(m, now) {
  if (m.tick >= 0 && Net.guest && net.tick >= 0) setClock(m.tick, m.s, now, false);
  let p = peers.get(m.from);
  if (!p) {
    p = { id: m.from, x: m.x, y: m.y, fx: m.x, fy: m.y, tx: m.x, ty: m.y, at: now, last: now, seen: now, heading: m.h, jog: false, stage: 0,
      pickAt: -1e9, pickK: -0, outfit: 0, wet: false, soak: -0, snowArt: 0, step: -0, lastHalf: 0, view: 1, flip: false, stillMs: 1e4, blinkAt: -1e9, downAt: 0, fall: -0,
      idle: -1, idleLast: -1, idleAt: -0, idleIn: 1e4 + 5000, hum: -0,   // (standing a while: idleOf)
      rings: [], puffs: [], puffAt: 0, drips: [], dripAt: 0, shiverAt: -1e9, shiverNext: 0,   // (its body, as fg's: drawBody, drawRings, shiverOf)
      art: FORAGER_ARTS[0], sized: 0, sizedSet: 0, sizedSnow: 0, name: '', nameArt: null, sx: -0, sy: -0, shown: false, chat: null, kneel: -1,
      mark: -0 };                                          // (how far its marker at the screen's edge has faded in: drawFriendMarks)
    peers.set(m.from, p);
    p.name = cleanName(m.n);
    if (Net.host || m.tick < 0) toast(`🧺 ${friendName(p) || 'A friend'} has come into the meadow`);   // (a guest knows the host is there)
  }
  const name = cleanName(m.n);
  if (name !== p.name) {                                   // (said after coming, or changed)
    p.name = name;
    if (name) toast(`🧺 Your friend is ${esc(name)}`);
  }
  if (p.name && (!p.nameArt || p.nameArt !== NAME_ARTS.get(p.name))) p.nameArt = nameArt(p.name);
  else if (!p.name) p.nameArt = null;
  const far = Math.hypot(m.x - p.x, m.y - p.y) > 3;        // (woken at home, or a new meadow: there at once)
  p.fx = far ? m.x : p.x; p.fy = far ? m.y : p.y; p.tx = m.x; p.ty = m.y; p.at = now; p.seen = now;
  p.heading = m.h; p.jog = m.j; p.stage = m.st; p.soak = +m.wt || 0; p.snowArt = m.sn | 0;
  p.kneel = m.kn >= 0 ? m.kn | 0 : -1;                    // (kneeling at a fire, turned to it)
  if (p.kneel >= 0) { p.flip = !!m.fl; p.view = 0; }
  if (m.o !== p.outfit) { p.outfit = m.o; p.sized = 0; }
  if (m.st === 4 && !p.downAt) p.downAt = now; else if (m.st !== 4) p.downAt = 0;
}
// A friend picked something: it stoops where it stood, turned to it, and its "+3 Chanterelles" floats up from it (as
// gatherFrame), with the pick's sound if it's on the screen.
function peerPicked(m, now) {
  const p = peers.get(m.from);
  if (!p || m.fx === undefined) return;
  const it = thingAt(m.kind, m.id, m.x, m.y), s = it && gatherSpot(m.kind, it), x = s ? s.x : m.x, y = s ? s.y : m.y, seen = s && visible(s.gx, s.gy, 60);
  p.fx = p.x; p.fy = p.y; p.tx = m.fx; p.ty = m.fy; p.at = now;
  p.pickAt = now; p.pickK = m.k || 1; p.view = m.v; p.flip = m.fl;
  if (!seen) return;
  const lands = PICK_MS[0] * p.pickK + 90, at = now + lands;
  setTimeout(() => {
    if (!world) return;
    pickFloats.push(floatOf(m.id, m.n, x, y, at));
    hear('pluck', x, y, { what: pickSound(m.id) });
    hear('pick', x, y, { n: m.n, own: false });
  }, lands);
}
function friendGone(id) {
  const p = peers.get(id);
  if (peers.delete(id)) toast(`🧺 ${friendName(p) || 'Your friend'} has gone home`);
}
// A guest whose host has gone: the meadow is its own now, kept and running on its own clock.
function hostGone() {
  const who = friendName(peers.get(net.hostId)) || 'Your friend';
  Net.on = false; Net.guest = false; Net.peers = 0;
  peers.clear(); net.tick = -1; net.later.length = 0;
  setSpeed(ui.speed || 1, true);
  toast(`🧺 ${who} has gone home. This meadow is yours to keep now.`);
}

// ••• › Leave: a guest goes home to its own meadow (the last one kept, as on a fresh visit); a host closes the meadow to
// friends and plays on in it alone, and its guests keep it as their own (hostGone).
function leaveTogether() {
  if (!(Net && Net.on)) return;
  const guest = Net.guest;
  if (guest && !confirm('Leave your friend’s meadow and go home to your own?')) return;
  Net.leave();
  ROOM = '';
  if (guest) { location.replace(location.pathname); return; }
  peers.clear(); openChat(false);
  history.replaceState(history.state, '', pageLink(world.seed));
  toast('🧺 Your meadow is your own again.');
}

// Each friend's forager in this frame's items: where it is, slid between what it said, and its pose (as foragerFrame).
function peerItems(items, now, z) {
  const px = forPx(), P = poseStep(Math.max(4, px));
  for (const p of peers.values()) {
    if (now - p.seen > PEER_GONE) { friendGone(p.id); continue; }
    const u = clamp((now - p.at) / (POS_MS * PEER_SLIDE), 0, 1), x = p.fx + (p.tx - p.fx) * u, y = p.fy + (p.ty - p.fy) * u;
    const moved = Math.hypot(x - p.x, y - p.y), ms = now - p.last;
    p.x = x; p.y = y; p.last = now;
    if (moved > 1e-5 && moved < 2) {
      p.step += moved / (2 * Fur.FORAGER_REACH * px / z * (p.jog ? Fur.FORAGER_JOG_STRIDE : 1));
      p.stillMs = 0;
    } else p.stillMs += ms;
    p.wet = !world.frozen && world.water[(y | 0) * S.W + (x | 0)] > 0;
    const cold = p.stage >= FORAGER_SAD, k = (now - p.pickAt) / (p.pickK || 1), half = Math.floor(p.step * 2);
    let pose;
    if (k < PICK_MS[2]) {                                 // picking (peerPicked), even while it glides the last bit to where it stood
      pose = k < PICK_MS[0] || k > PICK_MS[1] ? 3 : 4;
      p.stillMs = Math.max(p.stillMs, PEER_STILL_MS);
      idleStop(p);
    } else if (p.kneel >= 0) {                            // kneeling at a fire (its pose as it said: fur.js FORAGER_KNEEL)
      pose = p.kneel;
      p.stillMs = Math.max(p.stillMs, PEER_STILL_MS);
      idleStop(p);
    } else if (p.stillMs < PEER_STILL_MS) {
      const sy = Math.sin(p.heading), sx = Math.cos(p.heading), v = p.view;
      p.view = sy > (v === 1 ? 0.45 : 0.62) ? 1 : sy < (v === 2 ? -0.45 : -0.62) ? 2 : 0;
      if (sx > 0.18) p.flip = true; else if (sx < -0.18) p.flip = false;
      pose = (p.jog ? 16 : cold ? 24 : 8) + Math.floor(p.step % 1 * 8);
      idleStop(p);
      if (half !== p.lastHalf && ui.speed > 0) {            // a foot down: a ring in the shallows, else a footprint (as foragerFrame)
        if (p.wet) p.rings.push({ x, y, t: now }); else footprint(x, y, p.heading, half & 1);
      }
    } else {
      p.step = Math.round(p.step * 2) / 2;
      if (p.stillMs > FORAGER_TURN_MS && p.view !== 1) { p.view = 1; p.blinkAt = now; }
      if (now - p.blinkAt > 4000) p.blinkAt = now - Math.random() * 1500;
      pose = cold ? (now - p.blinkAt < 150 ? 6 : 5) : idleOf(p, now, now - p.blinkAt < 150 ? 2 : 0);
      if (cold) idleStop(p);
    }
    p.lastHalf = half;
    if (p.rings.length && now - p.rings[0].t > 900) p.rings.shift();
    if (p.stage === 4) { pose = 7; idleStop(p); }
    p.fall = p.downAt ? clamp((now - p.downAt) / FALL_MS, 0, 1) : 0;
    const set = p.stage >= 1 ? 2 : 1, at = p.snowArt * Fur.FORAGER_SNOW_ARTS + (p.outfit << 7);   // (its paintings asked for ahead, as foragerAhead does the player's)
    if (furWorker && (p.sized !== P || p.sizedSet !== set || p.sizedSnow !== p.snowArt)) {
      p.sized = P; p.sizedSet = set; p.sizedSnow = p.snowArt;
      for (let v = 0; v < 3; v++) for (const q of set === 2 ? FORAGER_CHILLY : FORAGER_POSES) furReady(FORAGER_ARTS[at + (v << 5) + q], P);
      for (const q of Fur.FORAGER_IDLES) furReady(FORAGER_ARTS[at + 96 + q], P);
    }
    p.art = shownPose(p, FORAGER_ARTS[at + (p.kneel >= 0 && p.stage < 4 ? KNEEL_AT + pose : poseKey(p.view, pose))], px);
    const sx = (x - cam.x) * z + vw / 2, sy = (y - cam.y) * z + vh / 2;
    p.shown = visible(sx, sy, 2 * px); p.sx = sx; p.sy = sy;
    if (p.shown) itemOf(items, y, sx, sy, 1).q = p;
  }
}
// Each friend's name over it, and over that what it said (and over this forager what it said), on top of everything (as
// the pop-ups). The bubbles are laid out together after (layChats).
function drawPeerNames(now) {
  const px = forPx();
  chats.n = 0; chats.nn = 0;
  for (const p of peers.values()) {
    if (!p.shown) continue;
    const fall = p.downAt ? p.fall * 0.6 : 0;
    let top = p.sy - px * NAME_UP * (1 - fall) - 3;
    if (p.nameArt) {
      const a = p.nameArt, x = Math.round(p.sx - a.w / 2), y = Math.round(top - a.h), r = chats.names, m = chats.nn;
      ctx.drawImage(a.img, x, y, a.w, a.h);
      r[m] = x; r[m + 1] = y; r[m + 2] = a.w; r[m + 3] = a.h; chats.nn = m + 4;
      top -= a.h + 1;
    }
    if (p.chat) { if (now > p.chat.until) p.chat = null; else saidAt(p.chat, p.sx, top); }
  }
  if (myChat) {
    if (now > myChat.until) myChat = null;
    else if (fgBody.on) saidAt(myChat, fgBody.x, fgBody.y + forPx() * 0.3 - px * NAME_UP - 3);
  }
  if (chats.n) layChats(now);
}
// Where each friend is: one off screen has the same parchment disc as home's at the screen's edge where the way from this
// forager to it leaves, its point turned that way, its forager's face in it (its cloak, sad when it's cold, its eyes shut
// when it's down: its standing painting from the front at one size, FRIEND_FACE, so only one or two a friend are painted)
// and its name under it (over it on the foot, by the satchel). Calm like home's; it fades in as the friend goes off screen.
const FRIEND_FACE = 4.4;                   // the painting's size in the disc's radius (so its hood and face fill the disc)
const FRIEND_FACE_UP = 0.46;               // what's in the middle of the disc: this many of the painting's size over its feet
const friendMarks = { at: 0 };
function drawFriendMarks(now) {
  const dt = Math.min(100, now - friendMarks.at), down = world.forager.down >= 0, m = 2 * forPx(), r = narrow() ? 18 : 19;
  friendMarks.at = now;
  keepClear(now);
  for (const p of peers.values()) {
    const want = !down && !(p.sx > -m && p.sx < vw + m && p.sy > -m && p.sy < vh + m) ? 1 : 0;
    p.mark += (want - p.mark) * Math.min(1, dt / (want ? 500 : 250));
    if (p.mark < 0.02 || !edgeAt(p.x, p.y, r)) continue;
    const name = p.nameArt, foot = edge.cy > 0 && Math.abs(edge.cx * vw) <= Math.abs(edge.cy * vh);   // (on the foot: its name goes over it)
    edgeApart(r, Math.max(r * 1.15, name ? name.w / 2 : 0), name && !foot ? r + name.h + 2 : r);
    const { x, y, cx, cy } = edge, size = r / ARROW_DISC;
    ctx.globalAlpha = 0.96 * p.mark;
    ctx.setTransform(cx * dpr, cy * dpr, -cy * dpr, cx * dpr, x * dpr + shakeX, y * dpr + shakeY);
    ctx.drawImage((ARROW_ART || arrowArt()).img, -size / 2, -size / 2, size, size);
    ctx.setTransform(dpr, 0, 0, dpr, shakeX, shakeY);
    const pose = p.stage === 4 ? 7 : p.stage >= FORAGER_SAD ? 5 : 0, px = r * FRIEND_FACE;
    const s = sprite(FORAGER_ARTS[p.snowArt * Fur.FORAGER_SNOW_ARTS + (p.outfit << 7) + poseKey(1, pose)], px);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, TAU); ctx.clip();
    ctx.drawImage(s.canvas, x - s.size / 2, y + px * (FRIEND_FACE_UP - 0.36) - s.size / 2, s.size, s.size);
    ctx.restore();
    if (name) {
      const nx = clamp(Math.round(x - name.w / 2), 4, vw - name.w - 4), ny = Math.round(foot ? y - r - 2 - name.h : y + r + 2);
      ctx.drawImage(name.img, nx, ny, name.w, name.h);
    }
  }
  ctx.globalAlpha = 1;
}
function drawPeer(p, sx, sy, now) {
  const px = forPx();
  drawRings(p.rings, now, px);
  if (zoomedOut()) { drawSmall(p.art, sx, sy - px * 0.36, px, p.flip); return; }
  if (p.stage === 4) { drawFallen(p.art, sx, sy, px, p.flip, p.fall); return; }
  drawFigure(p, p.art, sx, sy, px, now, p.stage, 0, p.stillMs >= PEER_STILL_MS, false);
  drawBody(p, p.x, p.y, p.soak, p.stillMs < PEER_STILL_MS, p.jog, p.stage, px, now, false);
}

// The chat. A line said, painted once: a parchment bubble, its words wrapped to CHAT_WIDE. Its tail is painted apart
// (tailArt), so it can come down from wherever under the bubble its forager is.
const CHAT_ARTS = new Map();
function chatArt(text, thought) {
  const key = thought ? '~' + text : text;
  let a = CHAT_ARTS.get(key);
  if (a) return a;
  if (CHAT_ARTS.size > 32) CHAT_ARTS.clear();
  const k = Math.max(1, dpr), F = 13 * k, c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${thought ? 'italic ' : ''}700 ${F}px Nunito, ui-rounded, system-ui, sans-serif`, most = CHAT_WIDE * k;
  g.font = font;
  const lines = [];
  for (const said of text.split('\n')) {                   // (a line of its own where the game's own words break)
    let line = '';
    for (let word of said.split(' ')) {
      while (g.measureText(word).width > most) {            // (a word too long for a line: broken where it runs out)
        let n = word.length - 1;
        while (n > 1 && g.measureText(word.slice(0, n)).width > most) n--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, n)); word = word.slice(n);
      }
      const next = line ? line + ' ' + word : word;
      if (line && g.measureText(next).width > most) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
  }
  let wide = 0;
  for (const l of lines) wide = Math.max(wide, g.measureText(l).width);
  const lh = Math.round(F * 1.3), padX = Math.round(F * 0.75), padY = Math.round(F * 0.4), sh = Math.round(1.5 * k);
  const w = Math.max(Math.ceil(wide) + 2 * padX, Math.round((2 * CHAT_TAIL_IN + 4) * k)), h = lines.length * lh + 2 * padY, r = Math.min(Math.round(11 * k), h / 2);
  c.width = w + 2; c.height = h + sh + 2;
  const bubble = y => { g.beginPath(); g.roundRect(1, 1 + y, w, h, r); };
  g.fillStyle = 'rgba(60, 40, 10, 0.25)'; bubble(sh); g.fill();
  g.fillStyle = 'rgba(253, 248, 234, 0.97)'; bubble(0); g.fill();
  g.strokeStyle = 'rgba(176, 132, 58, 0.8)'; g.lineWidth = k; g.stroke();
  g.font = font; g.fillStyle = '#4a3920'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, 1 + w / 2, 1 + padY + lh * (i + 0.5) + k * 0.5));
  a = { img: c, w: c.width / k, h: c.height / k, foot: (1 + h) / k };   // (foot: from its top down to the bubble's lower edge)
  asBitmap(c, b => { a.img = b; });
  CHAT_ARTS.set(key, a);
  return a;
}
// A bubble's tail, painted once: a little point down, its top over the bubble's edge so the line there is hidden under it.
let TAIL_ART = null;
function tailArt() {
  const k = Math.max(1, dpr);
  if (TAIL_ART && TAIL_ART.k === k) return TAIL_ART;
  const t = Math.round(CHAT_TAIL * k), w = Math.round(1.6 * t), lap = Math.ceil(2 * k), sh = Math.round(1.5 * k), tip = 0.42;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = w + 2; c.height = lap + t + sh + 2;
  const point = y => { g.beginPath(); g.moveTo(1, 1 + y); g.lineTo(1 + w * tip, 1 + y + lap + t); g.lineTo(1 + w, 1 + y); g.closePath(); };
  g.fillStyle = 'rgba(60, 40, 10, 0.25)'; point(sh); g.fill();
  g.fillStyle = 'rgb(253, 248, 234)'; point(0); g.fill();
  const u = lap / (lap + t);                                // (its sides, from the bubble's edge down)
  g.beginPath(); g.moveTo(1 + w * tip * u, 1 + lap); g.lineTo(1 + w * tip, 1 + lap + t); g.lineTo(1 + w - w * (1 - tip) * u, 1 + lap);
  g.strokeStyle = 'rgba(176, 132, 58, 0.8)'; g.lineWidth = k; g.lineJoin = 'round'; g.stroke();
  TAIL_ART = { img: c, w: c.width / k, h: c.height / k, top: (1 + lap) / k, tip: (1 + w * tip) / k, k };
  asBitmap(c, b => { TAIL_ART.img = b; });
  return TAIL_ART;
}
const cleanChat = s => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MOST);
const chatFor = (text, now, thought) => ({ art: chatArt(text, thought), at: now, until: now + Math.min(CHAT_LONGEST, CHAT_MS + CHAT_PER * text.length),
  x: -0, y: -0, bx: -0, by: -0, ox: -0, oy: -0, laid: false });

// This frame's bubbles (x, y where each one's tail points), and the names over friends (x, y, w, h each), reused.
const chats = { said: [], n: 0, names: [], nn: 0, at: 0 };
function saidAt(s, x, y) { s.x = x; s.y = y; chats.said[chats.n++] = s; }
// Each bubble goes over who said it, on the screen; two in each other's way, or one on a friend's name, are slid apart
// sideways as far as each one's tail still comes down from it (partChats), and if that isn't far enough the one further back
// goes up over the other. Each slides to where it's laid over CHAT_SLIDE (as an offset from its forager, so it never
// trails behind it).
function layChats(now) {
  const said = chats.said, n = chats.n;
  for (let i = 0; i < n; i++) {
    const s = said[i], hw = s.art.w / 2;
    s.bx = clamp(s.x, hw + 8, vw - hw - 8); s.by = s.y - CHAT_TAIL;
  }
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) partChats(said[i], said[j]);
    for (let m = 0; m < chats.nn; m += 4) offName(said[i], m);
  }
  const e = 1 - Math.exp(-Math.min(500, now - chats.at) / CHAT_SLIDE);
  chats.at = now;
  for (let i = 0; i < n; i++) {
    const s = said[i], ox = s.bx - s.x, oy = s.by - (s.y - CHAT_TAIL);
    if (s.laid) { s.ox += (ox - s.ox) * e; s.oy += (oy - s.oy) * e; } else { s.ox = ox; s.oy = oy; s.laid = true; }
    drawChat(s, now);
  }
}
// How far a bubble can go left or right and still have its tail under it (and stay on the screen).
const roomLeft = s => Math.max(0, Math.min(s.bx - (s.x - s.art.w / 2 + CHAT_TAIL_IN), s.bx - s.art.w / 2 - 8));
const roomRight = s => Math.max(0, Math.min(s.x + s.art.w / 2 - CHAT_TAIL_IN - s.bx, vw - 8 - s.art.w / 2 - s.bx));
function partChats(A, B) {
  const over = (A.art.w + B.art.w) / 2 + CHAT_GAP - Math.abs(A.bx - B.bx);
  if (over <= 0 || Math.min(A.by, B.by) - Math.max(A.by - A.art.foot, B.by - B.art.foot) + CHAT_GAP <= 0) return;
  const ab = A.x < B.x || A.x === B.x && A.at < B.at, L = ab ? A : B, R = ab ? B : A, lr = roomLeft(L), rr = roomRight(R);
  if (lr + rr >= over) {
    const dl = Math.min(lr, Math.max(over / 2, over - rr));
    L.bx -= dl; R.bx += over - dl;
    return;
  }
  const up = A.y < B.y || A.y === B.y && A.at > B.at ? A : B, down = up === A ? B : A;   // (further back, or said later)
  up.by = Math.min(up.by, down.by - down.art.foot - CHAT_TAIL - 3);
}
function offName(s, m) {
  const r = chats.names, x = r[m], y = r[m + 1], w = r[m + 2], h = r[m + 3], hw = s.art.w / 2;
  if (s.bx + hw <= x || s.bx - hw >= x + w || s.by <= y || s.by - s.art.foot >= y + h) return;
  const left = s.bx + hw - x + 2, right = x + w + 2 - (s.bx - hw), l = left <= roomLeft(s), r2 = right <= roomRight(s);   // (how far it'd go either way)
  if (l && (!r2 || left <= right)) s.bx -= left;
  else if (r2) s.bx += right;
  else s.by = y - CHAT_TAIL - 2;
}
function drawChat(s, now) {
  const a = s.art, t = tailArt(), k = now - s.at, alpha = Math.min(1, k / 150, (s.until - now) / 600);
  const left = Math.round(s.x + s.ox - a.w / 2), edge = Math.round(s.y - CHAT_TAIL + s.oy + 4 * (1 - Math.min(1, k / 150)));
  const tx = Math.round(clamp(s.x, left + CHAT_TAIL_IN, left + a.w - CHAT_TAIL_IN) - t.tip);
  ctx.globalAlpha = alpha;
  ctx.drawImage(a.img, left, edge - a.foot, a.w, a.h);
  ctx.drawImage(t.img, tx, edge - t.top, t.w, t.h);
  ctx.globalAlpha = 1;
}

// The card to say something on: a few things to say with a tap, and the line to type on.
const TOUCH = matchMedia('(pointer: coarse)');
const chatOpen = () => $('#chat').classList.contains('open');
function openChat(open) {
  const box = $('#chat');
  if (open) {
    if (!(Net && Net.on)) return;
    keysHeld.clear();                                     // (the forager stops: the keys are for the words now)
    box.classList.add('open');
    $('#chat-log').scrollTop = 1e6;
    $('#chat-quick').scrollLeft = 0;
    if (!TOUCH.matches) $('#chat-text').focus({ preventScroll: true });   // (with a finger the keyboard waits for a tap on the line)
    keyboardUp();
    return;
  }
  if (!chatOpen()) return;
  box.classList.remove('open');
  $('#chat-text').blur();
  keyboardUp();
}
// On a touch screen the card opens up top, out of the keyboard's way (index.html): under the pill, or beside it, put here
// as --pill-foot and --pill-side. And while the keyboard's up (.kb: the foot fixed things stand on, as the pill's column
// has it, well below the foot of what shows, the visual viewport) the meadow's forager is kept between the two
// (measureSheet).
function keyboardUp() {
  const v = window.visualViewport, box = $('#chat'), open = chatOpen();
  let kb = 0;
  if (open) {
    const pill = $('#hud-right .hud-top').getBoundingClientRect(), col = $('#hud-right');
    box.style.setProperty('--pill-foot', Math.round(pill.bottom + 8) + 'px');
    box.style.setProperty('--pill-side', Math.round(vw - pill.left + 8) + 'px');
    if (v && v.scale < 1.05) kb = col.getBoundingClientRect().bottom + parseFloat(getComputedStyle(col).bottom) - v.offsetTop - v.height;
  }
  if (kb > 80 !== box.classList.contains('kb')) { box.classList.toggle('kb', kb > 80); $('#chat-log').scrollTop = 1e6; }
  measureSheet();
}
if (window.visualViewport) for (const type of ['resize', 'scroll']) visualViewport.addEventListener(type, keyboardUp);
// A tap on the meadow while the card is open: it shuts if nothing's typed, else the keyboard goes down. With a finger,
// a tap that only put the keyboard away goes no further (true).
function chatAway(e) {
  const t = $('#chat-text'), typing = document.activeElement === t;
  if (t.value.trim()) t.blur(); else openChat(false);
  return typing && e.pointerType === 'touch';
}
function chatLine(who, text, me) {
  const log = $('#chat-log'), el = document.createElement('div'), b = document.createElement('b');
  el.className = me ? 'chat-line me' : 'chat-line';
  b.textContent = who + ' ';
  el.append(b, text);
  log.append(el);
  while (log.childElementCount > CHAT_KEEP) log.firstElementChild.remove();
  log.scrollTop = 1e6;
  setTimeout(() => el.classList.add('old'), CHAT_LOG_MS);
}
function sayLine(text) {
  text = cleanChat(text);
  if (!text || !(Net && Net.on)) return;
  Net.send({ t: 'say', text, n: myName });
  myChat = chatFor(text, performance.now());
  chatLine(myName || 'You', text, true);
}
$('#chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#chat-text').value;
  $('#chat-text').value = '';
  openChat(false);
  sayLine(text);
});
for (const text of CHAT_QUICK) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = text;
  $('#chat-quick').append(b);
}
$('#chat-quick').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  openChat(false);
  sayLine(b.textContent);
});
// (the line keeps its focus: so 💬 shuts the card rather than the line's blur, and a quick one isn't lost to it)
for (const el of [$('#chat-btn'), $('#chat-quick')]) el.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
$('#chat-text').addEventListener('blur', () => { if (!TOUCH.matches && !$('#chat-text').value.trim()) openChat(false); });   // (clicked away from with nothing said)
$('#chat-form').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); openChat(false); } });
function heardChat(m, now) {
  const text = cleanChat(m.text), p = peers.get(m.from);
  if (!text) return;
  if (p) p.chat = chatFor(text, now);
  chatLine((p && p.name) || cleanName(m.n) || 'A friend', text, false);
  chime('click');
}

// A few times a second: how many are here, on the pill (shown only while together).
function netCard(now) {
  const on = !!(Net && Net.on), n = on ? peers.size + 1 : 0;
  let names = '';
  if (on) for (const p of peers.values()) names += (names ? ', ' : '') + (p.name || 'a friend');
  const key = on ? n + ':' + names : '';
  if (key === net.shown) return;
  net.shown = key;
  const b = $('#friends-btn');
  b.classList.toggle('hidden', !on);
  $('#chat-btn').classList.toggle('hidden', !on);
  $('#chat').classList.toggle('hidden', !on);
  if (!on) { openChat(false); myChat = null; }
  $('#name-item').classList.toggle('hidden', !on);
  $('#leave-item').classList.toggle('hidden', !on);
  b.textContent = '🧺 ' + n;
  b.title = n > 1 ? `Foraging together with ${names}` : 'Open to friends: waiting for someone to come';
}

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
  if (t.dataset.action === 'new') {
    if (Net && Net.guest) toast('🧺 Only the one who asked you over can start a new meadow');
    else if (confirm('Start a brand-new meadow? This one will be gone.')) { newWorld(randomSeed()); if (Net && Net.host) Net.send(worldMsg('')); }
  }
  else if (t.dataset.act === 'pause') setSpeed(ui.speed ? 0 : 1);
  else if (t.dataset.act === 'build') buildPressed();       // (the fire button by the satchel)
  else if (t.dataset.act === 'close') select(0);
  else if (t.dataset.act === 'sheet-up' || t.dataset.act === 'sheet-down') {
    ui.sheetUp = t.dataset.act === 'sheet-up';
    $('#inspector').scrollTop = 0;
    renderInspector();
  }
  else if (t.dataset.act === 'more') toggleMore();
  else if (t.dataset.act === 'copy-link') copyLink();
  else if (t.dataset.act === 'together') together();
  else if (t.dataset.act === 'outfit') wearOutfit(+t.dataset.o);
  else if (t.dataset.act === 'pick-outfit') pickOutfit(true);
  else if (t.dataset.act === 'pick-name') askName(true);
  else if (t.dataset.act === 'leave') leaveTogether();
  else if (t.dataset.act === 'chat') openChat(!chatOpen());
  else if (t.dataset.act === 'ideas') { played = -Infinity; askIdeas(true); }   // found it themselves: no need to ask
  else if (t.dataset.act === 'ask-later') askIdeas(false);
  else if (t.dataset.act === 'ask-send') sendIdea();
  else if (t.dataset.act === 'sound') toggleSound();
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
  if (kind === 'visitor' && it) select(0);
  if (it) pick(kind, it);
}

// Shift held: the forager runs, and lets go to walk again (sent while it's held, it runs there: walkTo).
let shiftHeld = false;
function holdShift(on) {
  shiftHeld = on;
  if (world?.forager.walking) world.forager.running = on && !world.forager.winded;
}
// WASD or the arrows held: it walks that way (runs with Shift), sent KEY_AHEAD tiles on every frame (keyWalk), and
// let go it stops a step on. By e.code, so Shift+W is still W wherever the keyboard puts it.
const KEY_DIRS = { KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0] };
const KEY_AHEAD = 4;                    // (far enough that it never starts braking for it, even at a run)
const keysHeld = new Set();
let keyWalking = false;
function keyWalk() {
  if (!keysHeld.size && !keyWalking) return;
  const f = world.forager;
  let dx = 0, dy = 0;
  for (const k of keysHeld) { dx += KEY_DIRS[k][0]; dy += KEY_DIRS[k][1]; }
  const d = Math.hypot(dx, dy);
  if (!d) {                             // (let go, or two that cancel: it stops a step on)
    if (keyWalking && f.walking) S.foragerTo(world, f.x + Math.cos(f.heading) * 0.4, f.y + Math.sin(f.heading) * 0.4);
    keyWalking = false;
    return;
  }
  if (!keyWalking) {                    // (taking over: whatever it was off to or going to pick, or doing at a fire, it isn't)
    ui.gather = null; ui.queue.length = 0; ui.mark = null; ui.fire = null;
    if (ui.selectedId || ui.picked) select(0);
  }
  keyWalking = true;
  if (S.foragerTo(world, f.x + dx / d * KEY_AHEAD, f.y + dy / d * KEY_AHEAD)) f.running = shiftHeld && !f.winded;
}
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') holdShift(false);
  keysHeld.delete(e.code);
  if (e.code === 'KeyF' && fireKey) { fireKey = false; blowOn(false); }   // (let go of F: it stops blowing)
});
addEventListener('blur', () => { holdShift(false); keysHeld.clear(); if (fireKey) { fireKey = false; blowOn(false); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Shift' && !e.repeat) holdShift(true);
  if (e.key === 'Meta') keysHeld.clear();               // (a Mac doesn't send the keyup of a key let go while ⌘ is down)
  if (e.target.closest('input,textarea') || !world) return;
  if ((e.metaKey || e.ctrlKey || e.altKey) && /^[a-z]$/i.test(e.key)) return;   // ⌘C, Ctrl+Z…: the browser's
  if (KEY_DIRS[e.code]) { e.preventDefault(); keysHeld.add(e.code); return; }
  if (e.key === ' ') { e.preventDefault(); setSpeed(ui.speed ? 0 : 1); }
  else if (e.key === 'Escape') stepOut();
  else if (e.key === 'Enter' && ui.place) { e.preventDefault(); placeHere(); }   // (picking a spot for a fire: where the faint one is)
  else if ((e.key === 'Enter' || e.key === 't') && Net && Net.on) { e.preventDefault(); openChat(true); }
  else if (e.code === 'KeyE' && !e.repeat) pickNear();
  else if (e.code === 'KeyF' && !e.repeat) { if (atFire()) { fireKey = true; blowOn(true); } else buildPressed(); }   // (at a fire, held: blowing; else the fire button)
  else if (e.key === 'm') toggleSound();
  else if (e.key === '+' || e.key === '=') zoomOn(cam.zoom * 1.25);
  else if (e.key === '-') zoomOn(cam.zoom / 1.25);
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
  return [askOpen(), moreOpen(), !!ui.place, outfitOpen(), nameOpen(), chatOpen(), ins.contains('open'), sheetUp].filter(Boolean).length;
}
// The one on top shuts (Esc, and Back once for each step it takes).
function stepOut() {
  const ins = $('#inspector').classList;
  if (askOpen()) askIdeas(false);
  else if (moreOpen()) toggleMore(false);
  else if (ui.place) placeFire(false);                     // (picking a spot for a fire: not now)
  else if (nameOpen()) askName(false);
  else if (chatOpen()) openChat(false);
  else if (outfitOpen()) pickOutfit(false);
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
  if (location.search !== pageLink(world.seed)) history.replaceState(history.state, '', pageLink(world.seed));   // (a step taken before a new meadow)
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

// iOS drops the page's connection to IndexedDB while it's in the background ("Connection to Indexed Database server
// lost"), and every keep through it after fails: so the connection is opened afresh each time the page comes back
// (freshDb, below), and a keep that fails tries once more on a new one.
function keepDb() {
  if (keepOpen) return keepOpen;
  const p = keepOpen = new Promise((ok, fail) => {
    const r = indexedDB.open('aeon-garden', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('meadows');
    r.onsuccess = () => { r.result.onclose = () => { if (keepOpen === p) keepOpen = null; }; ok(r.result); };
    r.onerror = () => fail(r.error);
  });
  p.catch(() => { if (keepOpen === p) keepOpen = null; });
  return p;
}
function freshDb() {
  const old = keepOpen;
  keepOpen = null;
  old?.then(db => db.close(), () => {});               // (a keep still on its way through it finishes first)
  return keepDb();
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
  if (!world || world.tick === keptTick || Net && Net.guest) return;   // (a guest's meadow is the host's)
  let kept;
  try { kept = S.packWorld(world); } catch (e) { console.warn('Could not keep the meadow', e); return; }
  const tick = keptTick = world.tick;
  const link = meadowLink(world.seed), at = Date.now();
  const list = [{ link, at }, ...keptList().filter(k => k.link !== link)];
  if (!setKept(list.slice(0, KEEP_MEADOWS))) return;
  const rec = { link, at, kept, paused: ui.speed === 0,
    cam: { x: cam.x, y: cam.y, zoom: cam.zoom }, selectedId: ui.selectedId };
  const put = db => new Promise((ok, fail) => {
    const tx = db.transaction('meadows', 'readwrite'), store = tx.objectStore('meadows');
    store.put(rec, link);
    for (const k of list.slice(KEEP_MEADOWS)) store.delete(k.link);
    tx.oncomplete = ok;
    tx.onerror = tx.onabort = () => fail(tx.error);
    tx.commit?.();                                     // now, not when the page gets round to it
  });
  keepDb().then(put).catch(() => freshDb().then(put)).catch(e => {
    if (keptTick === tick) keptTick = -1;     // (so the next time it's hidden tries again)
    console.warn('Could not keep the meadow', e);
  });
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
    for (const id of w.forager.bag) if (id) firsts.add(id);   // (found already: see firstTime)
    S.step(world);                                    // a meadow that can't take a step is no good
    flushEvents();
  } catch (e) {
    console.warn('The kept meadow would not open', e);
    forgetMeadow(rec.link);
    return false;
  }
  opening = 1;
  const c = world.byId.get(rec.selectedId);
  if (c) select(c.id);
  cam.zoom = clamp(rec.cam?.zoom || homeZoom(), fitZoom, 64);
  cam.x = world.forager.x; cam.y = world.forager.y - CAM_FEET * forPx() / cam.zoom; clampCam();   // (on the forager, at the kept zoom)
  history.replaceState(history.state, '', pageLink(world.seed));
  return true;
}

document.addEventListener('visibilitychange', () => { if (document.hidden) keepMeadow(); else freshDb().catch(() => {}); });
addEventListener('beforeunload', keepMeadow);         // (while the page still has a moment: by pagehide it's often too late)
addEventListener('pagehide', keepMeadow);

// A keep as the page goes doesn't land on a reload in Chrome: the page is gone before IndexedDB has written it (a put,
// then neither complete nor abort), and the reload opened a new meadow. So while it's played the meadow is also kept
// every KEEP_EVERY, in a quiet moment between frames (requestIdleCallback with KEEP_IDLE ms to spare, or after
// KEEP_WAIT anyway): a keep is about 8 ms on a laptop (packWorld and IndexedDB's copy of it), none during the intro.
const KEEP_EVERY = 30000, KEEP_IDLE = 12, KEEP_WAIT = 5000;
const keepSoon = { due: 0, asked: false };
const whenIdle = window.requestIdleCallback || ((f, o) => setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), 0));
function keepTick(now) {
  if (!keepSoon.due) keepSoon.due = now + KEEP_EVERY;
  if (keepSoon.asked || now < keepSoon.due || intro.on) return;
  keepSoon.asked = true;
  const until = now + KEEP_WAIT;
  const quiet = d => {
    if (!d.didTimeout && d.timeRemaining() < KEEP_IDLE && performance.now() < until) { whenIdle(quiet, { timeout: KEEP_WAIT }); return; }
    keepSoon.asked = false; keepSoon.due = performance.now() + KEEP_EVERY;
    keepMeadow();
  };
  whenIdle(quiet, { timeout: KEEP_WAIT });
}

// ------------------------------------------------------------------ the loop

function flushEvents() {
  for (const e of world.events) handleEvent(e);
  world.events.length = 0;
}

function randomSeed() { return Math.floor(Math.random() * 1e6); }

function newWorld(seed) {
  showWorld(S.createWorld(seed));
  pr.n = 0; pr.next = 0;                   // (no footprints from the last meadow)
  history.replaceState(history.state, '', pageLink(seed));   // (the state: Back's step, if one's open)
  homeView();
  startIntro();                                 // (the cloak's card, if it's wanted, comes as the intro ends)
}

// A new meadow's opening, like the start of a film: black bars come in top and bottom, everything else on the page goes,
// the name fades in in the lower bar, and the camera cranes down out of the storm onto the forager (INTRO_CRANE: from
// INTRO_WIDE of its zoom and INTRO_RISE tiles up, eased in leadCam). The forager says its line (openingLine), and the
// bars slide off (INTRO_MS), the page coming back. A click, a tap or a key cuts it short (and does nothing else).
const INTRO_MS = 7000, INTRO_NAME = [700, 4600], INTRO_CRANE = 5500, INTRO_WIDE = 0.55, INTRO_RISE = 5, INTRO_LINE = 3600;
const intro = { on: false, t0: 0, z: 0, timers: [] };
function startIntro() {
  endIntro(true);
  const box = $('#intro');
  intro.on = true; intro.t0 = performance.now(); intro.z = cam.zoom;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) intro.t0 -= INTRO_CRANE;   // (no crane)
  document.body.classList.add('intro');
  box.classList.add('on');
  const later = (ms, f) => intro.timers.push(setTimeout(f, ms));
  later(INTRO_NAME[0], () => box.classList.add('named'));
  later(INTRO_NAME[1], () => box.classList.remove('named'));
  later(INTRO_MS, () => endIntro());
  openingLine(INTRO_LINE);
}
function endIntro(quiet) {
  for (const t of intro.timers) clearTimeout(t);
  intro.timers.length = 0;
  if (!intro.on) return;
  intro.on = false;
  cam.zoom = intro.z; clampCam();
  $('#intro').classList.remove('on', 'named');
  document.body.classList.remove('intro');
  if (!quiet && !fg.picked) pickOutfit(true);   // (only till one has been picked: after that it's in •••)
  if (announcing.openAt) announcing.openAt = Math.max(announcing.openAt, performance.now() + 1200);   // (where we are, a moment after)
}
// The crane, in leadCam: how far up and how much wider the camera still is, 1 at the start to 0.
const introLeft = now => intro.on ? 1 - smooth(0, INTRO_CRANE, now - intro.t0) : 0;
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, e => {
  if (!intro.on || e.target.closest?.('input,textarea')) return;
  e.preventDefault(); e.stopPropagation();
  if (ui.sound) Sound.start();
  endIntro();
}, { capture: true });

// A new meadow opens in a storm late in the afternoon (sim.js START_PHASE), the forager cold and wet: a moment after it's on
// screen, it says to itself what it needs (in a bubble over it, as a line of chat, in italics), and so does a friend's
// forager coming in during the storm.
const OPENING_LINE = 'It’s freezing.\nI need a fire before dark.';
const OPENING_MS = 1600;
function openingLine(ms = OPENING_MS) {
  const w = world;
  setTimeout(() => { if (world === w && S.openingStorm(w) && w.forager.down < 0) myChat = chatFor(OPENING_LINE, performance.now(), true); }, ms);
}

// A new meadow opens close enough to see who lives there, HOME_TILES across the screen, over where most of them are:
// the square a screen across with the most animals in the open (under the trees they'd be hidden), counted on a coarse
// grid, once. All of it is a pinch away.
const HOME_TILES = [30, 14];              // tiles across: a computer, a phone
const FAR_TILES = [75, 36];               // zoomed right out, at most this many
const homeZoom = () => Math.max(minZoom, fitZoom, vw / HOME_TILES[narrow() ? 1 : 0]);
const HOME_CELL = 8;                      // tiles a cell of the count
function homeView() {
  const zoom = homeZoom();
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
  const f = world.forager;                                 // (with the forager, it opens on it)
  if (f) Object.assign(cam, { x: f.x, y: f.y - CAM_FEET * forPx() / zoom });
  clampCam();
}

// Everything a meadow needs to be the one on screen, a new one or a kept one (resumeWorld).
function showWorld(w) {
  world = w;
  const seed = w.seed;
  groundSeed = [(seed % 97) * 3.7, (seed % 89) * 4.3];
  Object.assign(ui, { selectedId: 0, picked: null, hoverId: 0, mark: null, trail: [], effects: [], gather: null, queue: [], fire: null, place: null });
  fg.at = -1; fg.rings.length = 0; fg.sized = 0; fg.pick = -1e9; pickFloats.length = 0; aim.t = null; aim.fire = null;
  fireLay.clear(); fireFlare.clear(); sparks.length = 0; fireSit.F = null; fg.kneel = -1;   // (the last meadow's fires)
  fg.puffs.length = 0; fg.drips.length = 0; fg.downAt = 0; fg.dark = false; $('#veil').classList.remove('dark');
  vit.warm = vit.stam = vit.frost = -1;
  pollen.until = 0; pollen.t0.fill(-1e9);
  const mix = Object.fromEntries(Object.keys(S.WEATHER).map(k => [k, k === world.weather.kind ? 1 : 0]));
  Object.assign(ui.sky, { mix, tick: world.tick, bolts: [], rainbow: -1e9, bowEnd: -1e9 });
  $('#news').innerHTML = '';
  announcing.day = -1; announcing.wait.length = 0; announcing.openAt = performance.now() + 1500;
  cam.zoom = minZoom; cam.x = S.W / 2; cam.y = S.H / 2; cam.goal = null;
  clampCam();
  paintTerrain();
  renderInspector();
  updateClock();
  renderSatchel();
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

  if (bodyFrame(now)) {                    // (collapsed, in the dark: the night runs by till it wakes)
    const t0 = performance.now();
    while (world.forager.down >= 0 && performance.now() - t0 < SKIP_MS && !(Net && Net.guest && guestBehind(now) < 1)) {
      keepLast();
      S.step(world);
      if (world.events.length) flushEvents();
      if (Net && Net.on) netTick();
    }
    acc = 0;
  } else if (Net && Net.guest ? net.tick >= 0 : ui.speed > 0) {
    if (Net && Net.guest) acc = guestBehind(now);       // (a guest keeps to the host's clock)
    else acc += dt * TICKS_PER_SECOND * ui.speed;
    const want = Math.min(Math.floor(acc), 2000), n = Math.min(want, simFit), t0 = performance.now();
    acc -= want;
    let ran = 0, days = 0, dayMs = 0;
    while (ran < n) {
      keepLast();
      const day = (world.tick + 1) % S.TPD === 0, t1 = day ? performance.now() : 0;   // (a new day's tick is the heaviest by far)
      S.step(world);
      if (world.events.length) flushEvents();
      if (Net && Net.on) netTick();
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

  const sel = world.byId.get(ui.selectedId);
  if (sel && sel.alive && !sel.hidden) {
    const lastPt = ui.trail[ui.trail.length - 1];
    if (!lastPt || Math.hypot(lastPt.x - sel.x, lastPt.y - sel.y) > 0.5) {
      ui.trail.push({ x: sel.x, y: sel.y });
      if (ui.trail.length > 160) ui.trail.shift();
    }
  }
  leadCam(dt);
  if (drag?.steer && now - drag.at > STEER_MS) { drag.at = now; walkTo(drag.px, drag.py, true); }
  keyWalk();
  gatherFrame(now);
  fireFrame(now, dt);                     // (laying, lighting and tending a fire, or warming its hands by one)
  netFrame(now);
  if (cam.goal) {
    const k = 1 - Math.pow(0.01, dt);
    cam.zoom += (cam.goal - cam.zoom) * k;
    if (Math.abs(cam.goal - cam.zoom) < 0.05) cam.goal = null;
    cam.zoom = Math.max(cam.zoom, fitZoom);
  }
  if (zoomTo) {                           // a double tap's zoom (or two fingers'), eased in or out on its spot
    const goal = clamp(zoomTo.z, fitZoom, 64), z = cam.zoom + (goal - cam.zoom) * (1 - Math.pow(0.0002, dt));
    zoomOn(Math.abs(goal - z) < goal * 0.01 ? goal : z);
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
    daybreakTick(now);
    askTick(Math.min(now - lastCard, 1000));
    furAhead(now);
    lastCard = now;
    updateClock();
    renderVitals();
    netCard(now);
    if (ui.sound) {
      const ck = S.clock(world);
      const life = world.count.rabbit / (S.SPECIES.rabbit.cap * world.room);   // a meadow full of rabbits
      Sound.update({ phase: ck.phase, season: ck.season, speed: ui.speed, sky: ui.sky.mix, bees: beesOnScreen(), trees: leavesOnScreen(), life,
        frogs: world.spawnCount > 0 && ck.season === 0 ? Math.min(1, world.spawnCount / 300) : 0, fire: fireSound() });
    }
    // Not under the mouse or a finger: a rebuilt button would swallow the click. (A finger leaves :hover stuck.)
    if ((ui.selectedId || ui.picked) && !pressing && !(canHover.matches && $('#inspector').matches(':hover'))) renderInspector();
  }
  if (opening > 1 && ++opening > 4) cleared();       // a kept meadow that opened fine
  keepTick(now);
  requestAnimationFrame(frame);
}

// The camera goes with the forager: a little ahead of it the way it's walking (CAM_AHEAD seconds of its pace, eased in
// and out over CAM_LEAD_S), easing after it (CAM_FOLLOW a second), so setting off, stopping and turning are all soft.
// Its feet sit a little below the middle of the screen (CAM_FEET), the rest of it above them.
const CAM_FOLLOW = 3.2, CAM_AHEAD = 0.55, CAM_LEAD_S = 0.9, CAM_FEET = 0.25;
function leadCam(dt) {
  const f = world.forager, p = drawnAt(f), v = f.walking ? f.speed * TICKS_PER_SECOND * ui.speed : 0;
  const a = 1 - Math.exp(-dt / CAM_LEAD_S);
  fg.lx += (Math.cos(f.heading) * v * CAM_AHEAD - fg.lx) * a; fg.ly += (Math.sin(f.heading) * v * CAM_AHEAD - fg.ly) * a;
  const k = 1 - Math.exp(-dt * CAM_FOLLOW);
  const sx = sheet ? (sheet.right - sheet.left) / 2 / cam.zoom : 0, sy = sheet ? (sheet.bottom - sheet.top) / 2 / cam.zoom : 0;   // (clear of the inspector)
  const up = intro.on ? introLeft(performance.now()) : 0;      // (a new meadow's crane down onto it: startIntro)
  if (intro.on) cam.zoom = Math.max(fitZoom, intro.z * (1 - (1 - INTRO_WIDE) * up));
  const c = campCam(performance.now()), C = campShow.F, cx = c ? (C.x - p.x) * CAMP_LEAN * c : 0, cy = c ? (C.y - p.y) * CAMP_LEAN * c : 0;   // (making camp)
  cam.x += (p.x + fg.lx + sx + cx - cam.x) * k;
  cam.y += (p.y - CAM_FEET * forPx() / cam.zoom + fg.ly + sy + cy - INTRO_RISE * up - cam.y) * (intro.on ? 1 : k);
}

// ------------------------------------------------------------------ start

window.addEventListener('resize', resize);
// Turning a phone, iOS fires 'resize' before the page is laid out again, so the canvas still has its
// old size and would be stretched to the new one. Watch the canvas itself for when it really changes.
new ResizeObserver(() => { if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) resize(); }).observe(canvas);
resize();
setupSatchel();
const seedParam = +params.get('seed');
// The kept meadow if there is one (keeping the meadow, above), else a new one.
function begin(rec) {
  if (!(rec && resumeWorld(rec))) newWorld(seedParam || randomSeed());
  requestAnimationFrame(frame);
  if (ROOM) startTogether();
}
keptMeadow(seedParam).then(begin);
keepDb().catch(() => { /* not kept, then */ });   // opened now, so keeping at the last moment needn't wait for it
if (canShare) $('[data-act="copy-link"] .l').innerHTML = 'Share<span class="x"> this meadow</span>';
if (!IDEAS_KEY) $('[data-act="ideas"]').remove();

// Sound stays off until you turn it on, and remembers your choice. Browsers only let a page
// make sound after a click or key press, so a remembered "on" waits for the first one.
try { if (localStorage.getItem('aeon-garden-sound') === '1') toggleSound(true); } catch (e) { /* fine */ }

for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (ui.sound) Sound.start(); }, { once: true });

window.garden = { get world() { return world; }, ui, cam, forager: fg, prints: pr, peers,   // handy in the console
  get trees() { return { worker: !!treeWorker, workers: treeWorkers.length, art: treeArt, bytes: treeBytes, asked: treeAsked.size, busy: treeBusy }; } };
})();
