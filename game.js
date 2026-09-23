/* AEON Garden — everything you see and click. The simulation lives in sim.js. */
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

// ?terrain={...} overrides some of the meadow's settings (Sim.TERRAIN) and ?drawn={...} adds
// what was drawn on it, as the terrain lab hands them over. ?lab opens that lab: the meadow
// without animals, and terrain-lab.js on top.
const params = new URLSearchParams(location.search), LAB = params.has('lab');
const fromUrl = key => { try { return JSON.parse(params.get(key) || '{}'); } catch (e) { return {}; } };   // a broken link: the usual meadow
let terrain = fromUrl('terrain'), drawn = fromUrl('drawn');
const terrainQuery = () => ['terrain', 'drawn'].map(k => [k, { terrain, drawn }[k]])
  .filter(([, v]) => Object.keys(v).length).map(([k, v]) => `&${k}=` + encodeURIComponent(JSON.stringify(v))).join('');

let world;
const ui = {
  speed: 1, sound: false, tool: 'look', selectedId: 0, hoverId: 0, follow: false,
  trail: [], effects: [], diary: new Map(),
  lastNews: {}, newsLog: [], newsOpen: false, records: perKind(() => 0), crashSaid: perKind(() => -1), seenHistory: 0,
  releaseSex: perKind(() => 'F'), mini: false, ring: null, sheetUp: false,
  stats: { open: false, show: 'rabbit', range: 'five', hover: null },
  sky: { mix: {}, tick: 0, bolt: null, boom: -1e9, rainbow: 0, menu: false },
};
const cam = { x: S.W / 2, y: S.H / 2, zoom: 10, goal: null };

// ------------------------------------------------------------------ canvas and camera

const canvas = $('#world');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0, dpr = 1, minZoom = 1;
let barPad = 0;                                   // screen pixels the toolbar covers at the bottom
let sheet = null;                                 // on a phone: the rows the top bar and the inspector sheet hide
const narrow = () => matchMedia('(max-width: 760px)').matches;

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

function resize() {
  dpr = pixelRatio();
  // The CSS sizes the canvas: on a phone it reaches under the clock and Safari's bar, past innerHeight.
  vw = canvas.clientWidth || innerWidth; vh = canvas.clientHeight || innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  minZoom = Math.max(vw / S.W, vh / S.H);        // the meadow always fills the window
  cam.zoom = Math.max(cam.zoom, minZoom);
  clampCam();
  for (const s of S.KINDS) {
    const c = $('#spark-' + s);
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
  }
  measureSheet();
}

// On a phone the inspector is a sheet over the bottom of the meadow. The one you follow is kept in
// the middle of what's still showing, between the top bar and the sheet, instead of under the sheet.
function measureSheet() {
  const ins = $('#inspector').getBoundingClientRect();
  if (!ins.height || ins.width < vw * 0.8) { sheet = null; return; }
  const top = Math.max($('#meadow').getBoundingClientRect().bottom, $('#hud-right .hud-top').getBoundingClientRect().bottom);
  sheet = { top, bottom: vh - ins.top };
}

function clampCam() {
  const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
  cam.x = hw * 2 >= S.W ? S.W / 2 : clamp(cam.x, hw, S.W - hw);
  // You may look a little past the bottom edge, so nothing is ever stuck under the toolbar.
  cam.y = clamp(cam.y, Math.min(hh, S.H / 2), Math.max(S.H - hh, S.H / 2) + Math.max(barPad, sheet ? sheet.bottom : 0) / cam.zoom);
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
  cam.zoom = clamp(z, minZoom, 64);
  const [nx, ny] = toWorld(sx, sy);
  cam.x += wx - nx; cam.y += wy - ny;
  clampCam();
}

// ------------------------------------------------------------------ emoji sprites

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const spriteCache = new Map();
let spriteBytes = 0;
const SPRITE_BYTES = 96e6;          // phones cap canvas memory in total, so mind the pixels, not the count

function sprite(emoji, px, tint, leaf, center, coat) {
  px = Math.max(4, Math.round(px));
  const key = emoji + '|' + px + '|' + (tint || '') + '|' + (leaf ? leaf.key : '') + (center ? '|c' : '') + (coat ? '|' + coat.key : '');
  let s = spriteCache.get(key);
  if (s) return s;
  const size = Math.ceil(px * 1.3 * dpr);
  if (spriteCache.size > 2000 || spriteBytes + size * size * 4 > SPRITE_BYTES) {
    for (const old of spriteCache.values()) old.canvas.width = 0;   // hands the memory back right away
    spriteCache.clear(); spriteBytes = 0;
  }
  spriteBytes += size * size * 4;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', (leaf || coat) && { willReadFrequently: true });   // repainting reads pixels back
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
  s = { canvas: c, size: size / dpr };
  spriteCache.set(key, s);
  return s;
}

// Trees wear the seasons by repainting their emoji (once per look; the sprite cache keeps it).
// Leaf pixels are the ones clearly greener than they are red or blue. They take the new colour
// but keep their shading, so the canopy keeps its light and shadow and the trunk stays brown.
//   rgb, m   the new leaf colour, and how much of it
//   where    'dark': only the shaded leaves (a pine's old inner needles), 'light': only the
//            lit ones (fresh tips), otherwise all of them
//   fall     how many leaves have dropped, in soft blotches; the trunk fades with them
//   snow     how much snow lies along the tops
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

// Fox fur: one sliding shade that families share, laid lightly over the emoji.
const FOX_FUR = [[245, 150, 60], [214, 92, 42], [176, 98, 62], [205, 205, 212], [255, 255, 255]];
function foxRGB(f) {
  const p = clamp(f, 0, 0.999) * (FOX_FUR.length - 1);
  const i = Math.floor(p), t = p - i, a = FOX_FUR[i], b = FOX_FUR[i + 1];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
}
function furTint(c) {
  if (c.species !== 'fox') return undefined;
  const [r, g, b] = foxRGB(Math.round(c.genes.fur * 10) / 10);   // a few shades keep the sprite cache small
  return `rgba(${r},${g},${b},0.22)`;
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
  if (!c.alive || !c.genes.coat) return c.alive ? c.sp.emoji : '👻';
  const look = coatLook(c);
  if (!portraits.has(look.key)) portraits.set(look.key, sprite(c.sp.emoji, 38, undefined, null, true, look).canvas.toDataURL());
  return `<img src="${portraits.get(look.key)}" alt="${c.sp.emoji}">`;
}

// ------------------------------------------------------------------ terrain

const PALETTE = S.GROUND.seasons;   // [bare ground, lush grass] per season; camouflage uses it too
const terr = document.createElement('canvas');
terr.width = S.W; terr.height = S.H;
const tctx = terr.getContext('2d');
const timg = tctx.createImageData(S.W, S.H);
// Where the grass is thick, and where the ground is bare, as alpha: masks for the detail.
const mask = () => { const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; return c; };
const lush = mask(), bare = mask();
const limg = new ImageData(S.W, S.H), bimg = new ImageData(S.W, S.H);
let jitter = new Float32Array(S.W * S.H);
let patches = new Float32Array(S.W * S.H);              // soft warm (+) and cool (-) patches, a few tiles across
let terrainTick = -1, terrainVersion = 0;
let shoreSand = [200, 180, 130];
// Most repaints change only a few tiles (a rabbit's bite), so the ground layer repaints just
// those. Tiles changed since the layer was painted are marked here. When too many have changed,
// or it's a new meadow, terrainVersion goes up instead and the whole ground is repainted.
const terrDirty = new Uint8Array(S.W * S.H);
let terrDirtyCount = 0;

function paintTerrain(fresh) {
  const ck = S.clock(world);
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS;
  const t = sp > 0.8 ? (sp - 0.8) / 0.2 : 0;
  const a = PALETTE[ck.season], b = PALETTE[(ck.season + 1) % 4];
  const low = a[0].map((v, i) => lerp(v, b[0][i], t));
  const high = a[1].map((v, i) => lerp(v, b[1][i], t));
  const d = timg.data, g = world.grass, water = world.water, ash = world.ash;
  const snow = world.snow, damp = 1 - 0.12 * world.wet;            // wet ground reads darker
  shoreSand = low.map(v => v * 0.9 * damp);
  const ld = limg.data, bd = bimg.data;
  let sr = 0, sg = 0, sb = 0, changed = false;
  for (let i = 0; i < g.length; i++) {
    const j = jitter[i], o = i * 4;
    const r0 = d[o], g0 = d[o + 1], b0 = d[o + 2], l0 = ld[o + 3], k0 = bd[o + 3];
    // Snow settles in patches first, then covers everything.
    const s = snow > 0 ? clamp(snow * 1.4 - 0.2 - 0.2 * j, 0, 0.9) : 0;
    // Under the ponds (drawn on top by drawPonds) lies damp sand, which blurs into a shore.
    let v = water[i] ? 0 : clamp(g[i] / 0.85, 0, 1);
    v = v * (2 - v);
    const k = (1 + 0.035 * j) * damp * (water[i] ? 0.9 : 1) * (1 - 0.3 * world.wood[i]), p = patches[i];
    let r = lerp(low[0], high[0], v) + 6 * p, gr = lerp(low[1], high[1], v) + 2 * p, b = lerp(low[2], high[2], v) - 6 * p;
    if (ash[i] > 0) {                                                // burnt ground, until the grass returns
      const a = ash[i] * (1 - v) * 0.85;
      r = lerp(r, S.GROUND.ash[0], a); gr = lerp(gr, S.GROUND.ash[1], a); b = lerp(b, S.GROUND.ash[2], a);
    }
    if (s > 0) { r = lerp(r, S.GROUND.snow[0], s); gr = lerp(gr, S.GROUND.snow[1], s); b = lerp(b, S.GROUND.snow[2], s); }
    d[o] = r * k; d[o + 1] = gr * k; d[o + 2] = b * k;
    sr += d[o]; sg += d[o + 1]; sb += d[o + 2];
    d[o + 3] = 255;
    ld[o + 3] = 255 * v * (1 - s);
    bd[o + 3] = 255 * (1 - v) * (1 - s);
    if (d[o] !== r0 || d[o + 1] !== g0 || d[o + 2] !== b0 || ld[o + 3] !== l0 || bd[o + 3] !== k0) {
      changed = true;
      if (!terrDirty[i]) { terrDirty[i] = 1; terrDirtyCount++; }
    }
  }
  terrainTick = world.tick;
  edgeColour(sr / g.length, sg / g.length, sb / g.length);
  if (!changed && !fresh) return;
  tctx.putImageData(timg, 0, 0);
  lush.getContext('2d').putImageData(limg, 0, 0);
  bare.getContext('2d').putImageData(bimg, 0, 0);
  if (fresh || terrDirtyCount > g.length / 6) { terrainVersion++; terrDirty.fill(0); terrDirtyCount = 0; }
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

// The ground colours are one pixel per tile, so up close they go soft. On top goes crisp
// detail that pans and zooms with the meadow: fine grain everywhere, and little grass
// blades wherever the grass is thick. Both are small textures that repeat.
const DETAIL_PX = 32, DETAIL = DETAIL_PX * 16;          // pixels per tile, texture size

function detailTexture(count, item) {
  const c = document.createElement('canvas');
  c.width = c.height = DETAIL;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = Math.random() * DETAIL, y = Math.random() * DETAIL, r = Math.random();
    // Drawn nine times, shifted by the texture size, so the edges tile without seams.
    for (let dx = -DETAIL; dx <= DETAIL; dx += DETAIL) for (let dy = -DETAIL; dy <= DETAIL; dy += DETAIL) item(g, x + dx, y + dy, r);
  }
  return ctx.createPattern(c, 'repeat');
}

const grain = detailTexture(3200, (g, x, y, r) => {
  g.fillStyle = r < 0.55 ? 'rgba(60, 45, 20, 0.12)' : 'rgba(255, 250, 225, 0.11)';
  g.beginPath(); g.arc(x, y, 0.8 + 1.2 * ((r * 7.3) % 1), 0, TAU); g.fill();
});

// Tufts of two to four blades, some in shade and some catching the light.
const blades = detailTexture(700, (g, x, y, r) => {
  const n = 2 + Math.floor(r * 3);
  g.lineWidth = 1.8;
  g.strokeStyle = r < 0.6 ? 'rgba(40, 90, 20, 0.21)' : 'rgba(235, 255, 175, 0.19)';
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const u = (r * 13.7 * (k + 1)) % 1, len = 6 + 6 * ((r * 31.3 * (k + 1)) % 1);
    const bx = x + (k - (n - 1) / 2) * 2.5;
    g.moveTo(bx, y); g.quadraticCurveTo(bx, y - len * 0.6, bx + (u - 0.5) * len * 0.9, y - len);
  }
  g.stroke();
});

// Pebbles, alone or in little groups, for bare and grazed ground.
const pebbles = detailTexture(140, (g, x, y, r) => {
  const n = 1 + Math.floor(r * r * 4);
  for (let k = 0; k < n; k++) {
    const u = (r * 17.3 * (k + 1)) % 1, w = 1.6 + 2.2 * ((r * 29.1 * (k + 1)) % 1);
    const px = x + (u - 0.5) * 14, py = y + (((r * 41.7 * (k + 1)) % 1) - 0.5) * 10;
    g.fillStyle = 'rgba(40, 30, 20, 0.22)';
    g.beginPath(); g.ellipse(px + 0.6, py + w * 0.45, w, w * 0.6, 0, 0, TAU); g.fill();
    g.fillStyle = u < 0.5 ? 'rgba(150, 138, 120, 0.8)' : 'rgba(176, 160, 136, 0.8)';
    g.beginPath(); g.ellipse(px, py, w, w * 0.72, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255, 250, 235, 0.45)';
    g.beginPath(); g.ellipse(px - w * 0.3, py - w * 0.3, w * 0.38, w * 0.26, 0, 0, TAU); g.fill();
  }
});

// Scratch layers to cut the blades and the pebbles out on. One each: reusing a layer in the same
// frame, while the screen still holds on to what was drawn from it, makes the browser copy it all.
const bladeLayers = [[blades, lush], [pebbles, bare]].map(([pattern, where]) => ({ pattern, where, g: document.createElement('canvas').getContext('2d') }));

const clipTo = (g, parts) => { g.beginPath(); for (const p of parts) g.rect(...p); g.clip(); };

//   view   the box around what's being painted, [x, y, w, h] in screen pixels
//   clip   the parts g is clipped to, if it is, so the blade layer can be too
function drawGroundDetail(g, z, ox, oy, view, clip) {
  const a = clamp((z - 7) / 9, 0, 1);                   // zoomed far out it would only shimmer
  if (a <= 0) return;
  // Draw in texture space, pinned to the meadow's corner, so the texture moves with the ground.
  const k = z / DETAIL_PX, W = S.W * DETAIL_PX, H = S.H * DETAIL_PX, [vx, vy, w, h] = view;
  const x0 = Math.max(0, (vx - ox) / k), y0 = Math.max(0, (vy - oy) / k);
  const x1 = Math.min(W, (vx + w - ox) / k), y1 = Math.min(H, (vy + h - oy) / k);
  if (x1 <= x0 || y1 <= y0) return;
  const inTexture = t => { t.translate(ox, oy); t.scale(k, k); };
  g.save();
  g.globalAlpha = a;
  inTexture(g);
  g.fillStyle = grain; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  // Blades and pebbles each go on a layer of their own, then everything outside their mask
  // (thick grass for blades, bare ground for pebbles) is cut away.
  for (const { pattern, where, g: bctx } of bladeLayers) {
    const bladeLayer = bctx.canvas;
    if (bladeLayer.width !== canvas.width || bladeLayer.height !== canvas.height) {
      bladeLayer.width = canvas.width; bladeLayer.height = canvas.height;
    }
    bctx.save();
    if (clip) { bctx.setTransform(dpr, 0, 0, dpr, 0, 0); clipTo(bctx, clip); }
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bladeLayer.width, bladeLayer.height);
    bctx.setTransform(g.getTransform());
    inTexture(bctx);
    bctx.fillStyle = pattern; bctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(where, 0, 0, W, H);
    bctx.restore();
    g.save();
    g.globalAlpha = a;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bladeLayer, 0, 0);
    g.restore();
  }
}

// The ground (colours, grain, blades, pebbles, ponds) is by far the priciest part of a frame:
// a dozen passes over every pixel. So it is kept in a layer of its own and copied in one pass.
// Panning slides the layer along and paints only the strips that come into view, and when the
// terrain changes only the changed tiles are repainted. The layer is drawn exactly as the
// screen would be, so it looks the same. It can only slide by whole pixels, so the ground is
// placed on whole screen pixels: a camera that follows an animal moves it by at most half a
// pixel from where the rest is drawn. While zooming the ground is drawn directly.
const groundLayers = [document.createElement('canvas'), document.createElement('canvas')];   // shown, spare
let groundView = '', groundLook = '', groundStill = 0, groundAt = null;   // the pixel the layer's meadow starts in

//   parts   the parts to paint, [x, y, w, h] each, in screen pixels; all of it if left out
function paintGround(g, z, ox, oy, fills, season, parts) {
  let view = [0, 0, vw, vh];
  if (parts) {
    const x0 = Math.min(...parts.map(p => p[0])), y0 = Math.min(...parts.map(p => p[1]));
    view = [x0, y0, Math.max(...parts.map(p => p[0] + p[2])) - x0, Math.max(...parts.map(p => p[1] + p[3])) - y0];
    g.save(); clipTo(g, parts);
  }
  g.drawImage(terr, ox, oy, S.W * z, S.H * z);
  drawGroundDetail(g, z, ox, oy, view, parts);
  drawPonds(g, z, ox, oy, fills, view);
  drawPlants(g, z, ox, oy, view, season, false);
  if (parts) g.restore();
}

function groundContext(c) {
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  return g;
}

// The changed tiles as a few rectangles in screen pixels, [x, y, w, h] each. A tile's colour
// blurs into its neighbours when scaled up (and a flower reaches into them), so each takes two
// tiles around it along. They are
// gathered in blocks of 8 tiles, and a row of blocks makes one rectangle.
const BLOCK = 8, BLOCK_COLS = Math.ceil(S.W / BLOCK), BLOCK_ROWS = Math.ceil(S.H / BLOCK);
function dirtyParts(z, bx, by, W, H) {
  if (!terrDirtyCount) return [];
  const blocks = new Uint8Array(BLOCK_COLS * BLOCK_ROWS), parts = [];
  for (let i = 0; i < terrDirty.length; i++) {
    if (!terrDirty[i]) continue;
    const x = i % S.W, y = (i / S.W) | 0;
    const c0 = Math.floor(Math.max(0, x - 2) / BLOCK), c1 = Math.floor(Math.min(S.W - 1, x + 2) / BLOCK);
    const r0 = Math.floor(Math.max(0, y - 2) / BLOCK), r1 = Math.floor(Math.min(S.H - 1, y + 2) / BLOCK);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocks[r * BLOCK_COLS + c] = 1;
  }
  terrDirty.fill(0); terrDirtyCount = 0;
  const k = z * dpr;
  for (let r = 0; r < BLOCK_ROWS; r++) {
    for (let c = 0; c < BLOCK_COLS; c++) {
      if (!blocks[r * BLOCK_COLS + c]) continue;
      const c0 = c;
      while (c + 1 < BLOCK_COLS && blocks[r * BLOCK_COLS + c + 1]) c++;
      // Blocks on the meadow's edge reach a tile past it, for the flowers that hang over.
      const x0 = Math.max(0, Math.floor(bx + (c0 ? c0 * BLOCK : -1) * k)), x1 = Math.min(W, Math.ceil(bx + ((c + 1) * BLOCK >= S.W ? S.W + 1 : (c + 1) * BLOCK) * k));
      const y0 = Math.max(0, Math.floor(by + (r ? r * BLOCK : -1) * k)), y1 = Math.min(H, Math.ceil(by + ((r + 1) * BLOCK >= S.H ? S.H + 1 : (r + 1) * BLOCK) * k));
      if (x1 > x0 && y1 > y0) parts.push([x0, y0, x1 - x0, y1 - y0]);
    }
  }
  return parts;
}

function drawGround(z, ox, oy, shaking) {
  const fills = pondFills(), season = S.clock(world).season;
  updatePlantLooks(z, season);
  // The whole screen pixel the meadow's corner lands on.
  const bx = Math.round(ox * dpr), by = Math.round(oy * dpr);
  ox = bx / dpr; oy = by / dpr;
  const view = [z, vw, vh, dpr].join('|'), look = terrainVersion + '|' + fills.join();
  groundStill = view === groundView ? groundStill + 1 : 0;
  if (view !== groundView || look !== groundLook) { groundView = view; groundLook = look; groundAt = null; }
  if (shaking || groundStill < 2) { paintGround(ctx, z, ox, oy, fills, season); return; }   // zooming: draw it directly
  const W = canvas.width, H = canvas.height;
  if (groundLayers[0].width !== W || groundLayers[0].height !== H) {
    for (const c of groundLayers) { c.width = W; c.height = H; }
    groundAt = null;
  }
  // How far the view has slid since, in screen pixels. When much of the ground has changed
  // (at high speed, say), painting it all in one go is cheaper than in pieces.
  const dx = groundAt ? bx - groundAt[0] : 0, dy = groundAt ? by - groundAt[1] : 0;
  const dirty = groundAt ? dirtyParts(z, bx, by, W, H) : [];
  if (!groundAt || Math.abs(dx) >= W || Math.abs(dy) >= H || dirty.reduce((a, p) => a + p[2] * p[3], 0) > W * H / 3) {
    const g = groundLayers[0].getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    paintGround(groundContext(groundLayers[0]), z, ox, oy, fills, season);
    terrDirty.fill(0); terrDirtyCount = 0;
  } else {
    // Everything to paint goes in one pass: a scratch layer used twice in a frame gets copied whole.
    const parts = [];
    if (dx || dy) {
      // Copy what's still in view onto the spare layer, then paint the strips that came in.
      const [shown, spare] = groundLayers, g = spare.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.imageSmoothingEnabled = false;
      g.drawImage(shown, dx, dy);
      const sx = dx > 0 ? 0 : W + dx, restX = dx > 0 ? dx : 0;                          // the side strip, and what's left beside it
      if (dx) parts.push([sx, 0, Math.abs(dx), H]);
      if (dy) parts.push([restX, dy > 0 ? 0 : H + dy, W - Math.abs(dx), Math.abs(dy)]);  // top or bottom, less the corner
      groundLayers.reverse();
    }
    parts.push(...dirty);
    if (parts.length) {
      const g = groundLayers[0].getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (const p of parts) g.clearRect(...p);
      paintGround(groundContext(groundLayers[0]), z, ox, oy, fills, season, parts.map(p => p.map(v => v / dpr)));
    }
  }
  groundAt = [bx, by];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;                     // a pixel-for-pixel copy
  ctx.drawImage(groundLayers[0], 0, 0);
  ctx.restore();
}

function plantEmoji(season, kind, g) {
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

// Flowers and tufts only change with the grass and the season, so they are painted into the
// ground layer. They are looked at whenever the ground's colours are (every 12 ticks), so a
// flower changes along with the ground under it, and one that changed repaints just its patch.
// Anything that changes how one looks belongs in plantLook. The few that little waves could
// pass over are drawn every frame instead, on top of the waves, and so would any that moved.
const PLANT_EMOJI = ['🌷', '🌼', '🌸', '🌿', '🌱', '🌻', '🍂', '🌾', '❄️'];
function plantLook(p, season, z) {
  const plantPx = z * 0.95;
  if (plantPx < 7) return null;
  const g = world.grass[p.i], e = plantEmoji(season, p.kind, g);
  return e && { e, px: Math.max(4, Math.round(plantPx * (0.55 + 0.45 * Math.min(1, g)))) };   // as the sprite rounds it
}

// How each plant in the layer looks, as px * 16 + which emoji (0: nothing), and when that was.
let plantKeys = null, plantKeysWorld = null, plantKeysTick = -1, plantKeysZoom = 0;
function updatePlantLooks(z, season) {
  if (plantKeysWorld !== world) { plantKeys = new Int32Array(world.plants.length).fill(-1); plantKeysWorld = world; plantKeysTick = -1; }
  if (plantKeysTick === terrainTick && plantKeysZoom === z) return;
  plantKeysTick = terrainTick; plantKeysZoom = z;
  const near = pond.nearWave;
  for (let i = 0; i < world.plants.length; i++) {
    if (near[i]) continue;
    const p = world.plants[i], l = plantLook(p, season, z);
    const key = l ? l.px * 16 + PLANT_EMOJI.indexOf(l.e) + 1 : 0;
    if (key === plantKeys[i]) continue;
    plantKeys[i] = key;
    if (!terrDirty[p.i]) { terrDirty[p.i] = 1; terrDirtyCount++; }
  }
}

//   live   the plants drawn every frame, as they are now, or the ones in the ground layer
function drawPlants(g, z, ox, oy, [vx, vy, w, h], season, live) {
  if (z * 0.95 < 7) return;
  const near = pond.nearWave;
  g.save();
  g.globalAlpha = 0.9;
  for (let i = 0; i < world.plants.length; i++) {
    if (!!near[i] !== live) continue;
    const p = world.plants[i], l = live ? plantLook(p, season, z) : plantKeys[i] > 0 && { e: PLANT_EMOJI[(plantKeys[i] & 15) - 1], px: plantKeys[i] >> 4 };
    if (!l) continue;
    const s = sprite(l.e, l.px), x = ox + p.x * z - s.size / 2, y = oy + p.y * z - s.size / 2;
    if (x + s.size < vx || y + s.size < vy || x > vx + w || y > vy + h) continue;
    g.drawImage(s.canvas, x, y, s.size, s.size);
  }
  g.restore();
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

const MOVING = new Set(['wander', 'food', 'flee', 'chase', 'stalk', 'prowl', 'home', 'love', 'follow', 'friends', 'dig']);
const ALWAYS_BUBBLE = new Set(['flee', 'alarm', 'chase', 'love']);

function visible(sx, sy, pad) { return sx > -pad && sy > -pad && sx < vw + pad && sy < vh + pad; }

function darkness(phase) {
  if (phase >= 0.72 || phase < 0.02) return 0.45;
  if (phase >= 0.6) return 0.45 * (phase - 0.6) / 0.12;
  if (phase < 0.1) return 0.45 * (1 - (phase - 0.02) / 0.08);
  return 0;
}

// The view may reach a little past the bottom edge (see clampCam). There the ground goes on as
// the meadow's last rows seen in a mirror, fading darker, so it reads as the edge of the meadow.
function drawEdge(z, ox, oy) {
  const y0 = oy + S.H * z, h = vh + 8 - y0;
  if (h <= 0) return;
  const k = Math.min(h / z, S.H);                     // in tiles
  ctx.save();
  ctx.translate(0, y0); ctx.scale(1, -1);
  ctx.drawImage(terr, 0, S.H - k, S.W, k, ox, -k * z, S.W * z, k * z);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, y0, 0, y0 + Math.max(h, 40));
  shade.addColorStop(0, 'rgba(40, 50, 20, 0.12)'); shade.addColorStop(1, 'rgba(40, 50, 20, 0.4)');
  ctx.fillStyle = shade;
  ctx.fillRect(ox, y0, S.W * z, h);
}

function render(now) {
  // Thunder rumbles the whole screen a little.
  const q = now - ui.sky.boom < 350 && ui.speed <= 4 ? 3 * (1 - (now - ui.sky.boom) / 350) : 0;
  ctx.setTransform(dpr, 0, 0, dpr, q * Math.sin(now / 17) * dpr, q * Math.cos(now / 23) * dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(-8, -8, vw + 16, vh + 16);          // past the meadow's edge the page shows through
  const [ox, oy] = toScreen(0, 0);
  const z = cam.zoom, ck = S.clock(world);
  drawGround(z, ox, oy, q !== 0);
  drawEdge(z, ox, oy);
  drawWaves(now);

  drawPlants(ctx, z, ox, oy, [0, 0, vw, vh], ck.season, true);   // the rest are in the ground

  // Burrows, drawn by hand: some browsers clip the 🕳️ glyph in half.
  const residents = new Map();
  for (const c of world.creatures) if (c.alive && c.home) residents.set(c.home, (residents.get(c.home) || 0) + 1);
  for (const b of world.burrows) {
    const [sx, sy] = toScreen(b.x, b.y);
    if (visible(sx, sy, z * 5)) drawBurrow(b, sx, sy, z, ck.season, residents.get(b) || 0);
  }

  const sel = world.byId.get(ui.selectedId);
  if (sel) drawSelectionUnder(sel, now);

  // Trees, rocks and animals, back to front.
  const items = [];
  for (const d of world.decor) {
    const [sx, sy] = toScreen(d.x, d.y);
    if (visible(sx, sy, d.size * z)) items.push({ y: d.y, d, sx, sy });
  }
  for (const h of world.hives) {
    const [sx, sy] = toScreen(h.x, h.y);
    if (visible(sx, sy, 3 * z)) items.push({ y: h.y, h, sx, sy });
  }
  const shown = [];
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const [sx, sy] = toScreen(c.x, c.y);
    if (!visible(sx, sy, 60)) continue;
    const it = { y: c.y, c, sx, sy };
    items.push(it); shown.push(it);
  }
  items.sort((a, b) => a.y - b.y);
  // Shadows first, all together, so a tree's shadow never lands on a rabbit behind it.
  const sn = sun(ck);
  for (const it of items) {
    if (it.d) drawDecorShadow(it.d, it.sx, it.sy, sn);
    else if (it.h) drawHiveShadow(it.sx, it.sy, sn);
    else drawCreatureShadow(it.c, it.sx, it.sy, now, sn);
  }
  for (const it of items) {
    if (it.d) drawDecor(it.d, it.sx, it.sy, now, ck);
    else if (it.h) drawHive(it.h, it.sx, it.sy);
    else drawCreature(it.c, it.sx, it.sy, now);
  }
  drawFallingLeaves(now);

  // Dusk and night.
  const dark = darkness(ck.phase);
  if (dark > 0) wash(`rgba(22, 30, 78, ${dark})`);
  if (ck.phase > 0.58 && ck.phase < 0.74) {
    const a = 0.10 * Math.sin(Math.PI * (ck.phase - 0.58) / 0.16);
    wash(`rgba(255, 140, 60, ${a})`);
  }
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
      if (!h.bees) continue;
      const [sx, sy] = toScreen(h.x, h.y);
      if (visible(sx, sy, 40)) drawEmoji('💤', sx + z * 0.9, sy - z * 1.9 + Math.sin(now / 600 + h.id) * 3, Math.max(11, z * 0.8), { alpha: 0.85 });
    }
  }

  // Thought bubbles above the dark.
  for (const it of shown) {
    const c = it.c;
    const important = ALWAYS_BUBBLE.has(c.mode);
    if (!(important || c.id === ui.selectedId || c.id === ui.hoverId || z >= 20)) continue;
    const m = S.mood(world, c);
    const px = creaturePx(c), up = c.sp.flies ? liftOf(c, px, now) : 0;
    if (m.emoji) drawBubble(m.emoji, it.sx, it.sy - up, px, important);
  }

  drawEffects(now);
  if (sel) drawSelectionOver(sel, now);
  const hov = world.byId.get(ui.hoverId);
  if (hov && hov.alive && !hov.hidden && hov.id !== ui.selectedId) {
    const [sx, sy] = toScreen(hov.x, hov.y);
    drawLabel(`${hov.name} · ${S.mood(world, hov).text}`, sx, sy + creaturePx(hov) * 0.55 + 6);
  } else if (ui.hoverHive) {
    const h = ui.hoverHive, [sx, sy] = toScreen(h.x, h.y);
    drawLabel(`🐝 Hive · ${h.bees} ${h.bees === 1 ? 'bee' : 'bees'} · ${Math.round(h.honey)} honey`, sx, sy + z * 0.5 + 6);
  }
}

// How each kind is drawn: its size next to a rabbit, and whether its emoji faces left (then it
// is mirrored to face where it's going). Animals that fly (c.sp.flies) hover above their shadow.
const LOOKS = {
  rabbit: { size: 1, facesLeft: true },
  fox: { size: 1, facesLeft: false },          // a face: it does not care
  bee: { size: 0.38, facesLeft: true, swatch: '#e8b83a' },
};

// Grows with zoom, but never shrinks to a speck when you look at the whole meadow.
const creaturePx = c => (10 + cam.zoom * 1.4) * LOOKS[c.species].size * c.scale * (0.55 + 0.45 * S.growth(world, c));
const flipOf = c => LOOKS[c.species].facesLeft && c.facing > 0;

// How high off the ground it is drawn: a hop, or a flier's hover. A sipping bee sits on the flower.
function liftOf(c, px, now) {
  if (!c.sp.flies) return hopOf(c, px, now);
  const bob = ui.speed > 0 ? Math.sin(now / 90 + c.id) * px * 0.08 : 0;
  return (c.mode === 'sip' ? px * 0.15 : px * 0.9) + bob;
}

// How high off the ground a hop has lifted it, in screen pixels.
function hopOf(c, px, now) {
  const fast = c.mode === 'flee' || c.mode === 'chase';
  return MOVING.has(c.mode) && ui.speed > 0
    ? Math.abs(Math.sin(now / (fast ? 55 : 120) + c.id)) * px * (fast ? 0.16 : 0.1) : 0;
}

// In shallow water an animal sits lower, its legs hidden below a little ring of ripples.
const wading = c => !c.hidden && world.water[(c.y | 0) * S.W + (c.x | 0)] > 0;

function drawCreature(c, sx, sy, now) {
  const px = creaturePx(c);
  if (wading(c)) {
    const line = sy + px * 0.3, rip = 1 + 0.12 * Math.sin(now / 260 + c.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx - px, line - px * 2, px * 2, px * 2); ctx.clip();
    drawEmoji(c.sp.emoji, sx, sy + px * 0.1, px, { tint: furTint(c), coat: coatLook(c), flip: flipOf(c) });
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
  const squash = (c.sleeping ? 0.82 : 1) + breathe;
  drawEmoji(c.sp.emoji, sx, sy - hop + px * 0.4 * (1 - squash), px, {   // feet stay on the ground
    tint: furTint(c), coat: coatLook(c), flip: flipOf(c), squash,
  });
}

function drawBubble(emoji, sx, sy, px, important) {
  const r = Math.max(9, px * 0.3);
  const bx = sx + px * 0.38, by = sy - px * 0.62 - r * 0.4;
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

function drawLabel(text, x, y) {
  ctx.font = '800 12px Nunito, ui-rounded, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(255, 250, 240, 0.95)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 22, 11); ctx.fill();
  ctx.fillStyle = '#3b372f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 11.5);
}

function drawSelectionUnder(c, now) {
  if (!c.alive) return;
  const [sx, sy] = toScreen(c.x, c.y);
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
  const [sx, sy] = toScreen(c.x, c.y);
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
  const label = c.hidden ? `${c.name} is inside the burrow` : c.name;
  drawLabel(label, sx, sy + (c.hidden ? cam.zoom : creaturePx(c) * 0.55) + 6);
}

// Where the sun is: shadows lean west in the morning and east in the evening,
// and fade at night and under cloud.
function sun(ck) {
  const m = ui.sky.mix;
  const cover = clamp(0.5 * m.cloudy + 0.7 * m.rain + 0.9 * m.storm + 0.8 * m.fog + 0.5 * m.snow, 0, 0.85);
  return { lean: clamp((ck.phase - 0.36) / 0.34, -1, 1), a: (1 - 1.6 * darkness(ck.phase)) * (1 - cover) };
}

function drawDecorShadow(d, sx, sy, sn) {
  if (sn.a <= 0.02) return;
  const s = d.size * cam.zoom * (d.stump ? 0.45 : 1);
  const w = s * (d.tree ? 0.34 : 0.42), h = s * 0.12, off = sn.lean * s * 0.22;
  ctx.fillStyle = `rgba(40, 50, 20, ${0.24 * sn.a})`;
  ctx.beginPath(); ctx.ellipse(sx + off, sy + h * 0.4, w + Math.abs(off) * 0.6, h, 0, 0, TAU); ctx.fill();
}

// Animals lean their shadow with the sun like the trees do, and keep a faint one at their feet
// at night and under cloud so they never float. A hop lifts them off it and it shrinks.
function drawCreatureShadow(c, sx, sy, now, sn) {
  if (wading(c)) return;
  const px = creaturePx(c), lift = 1 - Math.min(0.8, liftOf(c, px, now) / px);
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
// tree shows its own colour, gold (birch, beech), orange (maple), red (red maple) or russet
// (oak). Then the leaves drop and it stands bare, except the oaks, which hold on to their dry
// brown leaves all winter. In spring they leaf out lime green. Pines 🌲 stay green, but not
// quite the same green: old inner needles yellow in autumn, the whole tree bronzes a little in
// the cold, and new tips come in light at the end of spring. Snow settles on top of them all.
const AUTUMN = [[238, 192, 56], [238, 192, 56], [240, 130, 40], [240, 130, 40], [200, 50, 42], [176, 100, 52]];
const OAK = 5, DRY = [160, 120, 80], SPRING = [156, 214, 84];
const OLD_NEEDLES = [214, 180, 64], BRONZE = [128, 118, 62], CANDLES = [176, 226, 100];
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

function treeLook(d, ck) {
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS, s = ck.season;
  const h = Math.abs(Math.floor(d.x * 7.3 + d.y * 13.1)), lag = (h % 5) * 0.04;
  let rgb = SPRING, m = 0, where = '', fall = 0, drop = 0;
  if (d.emoji === '🌲') {
    const a = 0.6 + 0.2 * (h % 3);                       // some pines turn more than others
    if (s === 2) { rgb = OLD_NEEDLES; m = 0.7 * a * Math.sin(Math.PI * sp); where = 'dark'; }
    else if (s === 3 || (s === 0 && sp < 0.4)) { rgb = BRONZE; m = 0.45 * a * (s === 3 ? clamp(sp / 0.25, 0, 1) : 1 - sp / 0.4); }
    else { rgb = CANDLES; m = 0.6 * (s === 0 ? clamp((sp - 0.4) / 0.4, 0, 1) : 1 - clamp(sp / 0.5, 0, 1)); where = 'light'; }
  } else {
    const hue = AUTUMN[h % AUTUMN.length], oak = h % AUTUMN.length === OAK || !HAS_BARE;
    if (s === 2) {
      const turn = clamp((sp - 0.05 - lag) / 0.4, 0, 1);
      rgb = mix(hue, DRY, clamp((sp - 0.65 - lag) / 0.35, 0, 1) * (oak ? 1 : 0.5)); m = turn;
      fall = oak ? 0 : clamp((sp - 0.6 - lag) / 0.35, 0, 1);
      drop = clamp(turn * 1.5 - 0.4, 0, 1) * (1 - fall * fall) * (oak ? 0.3 : 1);
    } else if (s === 3) { rgb = DRY; m = 1; fall = oak ? 0 : 1; }
    else if (s === 0) {
      rgb = oak ? mix(DRY, SPRING, clamp(sp / 0.3, 0, 1)) : SPRING;
      m = 1 - clamp((sp - 0.35) / 0.45, 0, 1);
      fall = oak ? 0 : 1 - clamp((sp - lag) / 0.35, 0, 1);
    }
  }
  rgb = rgb.map(v => Math.round(v / 8) * 8);
  m = step(m, 8); fall = step(fall, 10);
  const snow = step(world.snow * 1.6 - 0.1, 4), seed = h % 3;
  const look = m || fall || snow
    ? { rgb, m, where, fall, snow, seed, key: [rgb, m, where, fall, snow, seed].join('|') } : undefined;
  const bare = fall && { snow, seed, m: 0, fall: 0, key: `bare|${snow}` };
  return { look, fall, bare, drop, rgb, h };
}

// Leaves let go in autumn and tumble down, drifting east with the wind. Trees queue them up
// as they are drawn, and they are drawn on top of everything once the trees are done.
const leafFall = [];
function drawFallingLeaves(now) {
  const m = ui.sky.mix, wind = 0.4 + 0.6 * m.cloudy + 1.5 * m.rain + 3 * m.storm;
  ctx.save();
  for (const f of leafFall) {
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
  ctx.restore();
  leafFall.length = 0;
}

function drawDecor(d, sx, sy, now, ck) {
  const z = cam.zoom, px = d.size * z;
  if (!d.stump && !d.tree) { drawEmoji(d.emoji, sx, sy - px * 0.35, px); return; }
  if (!d.stump) {
    const t = treeLook(d, ck);
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(treeSway(d, now));
    if (t.bare) drawEmoji('🪾', 0, -px * 0.42, px * 1.15, { alpha: t.fall, leaf: t.bare });   // it draws small
    if (t.fall < 1) drawEmoji(d.emoji, 0, -px * 0.35, px, { leaf: t.look });
    ctx.restore();
    if (t.drop && px >= 22) leafFall.push({ sx, sy, px, drop: t.drop, rgb: t.rgb, h: t.h });
    return;
  }
  // Struck by lightning: a stump, then a sapling, then (in sim.js) a tree again.
  const sapling = world.tick - d.stump > S.YEAR_DAYS * S.TPD / 2;
  drawEmoji(sapling ? '🌱' : '🪵', sx, sy - d.size * z * 0.12, d.size * z * (sapling ? 0.55 : 0.45));
}

// ------------------------------------------------------------------ hives
//
// A wild colony lives in an old dead tree whose top has snapped off: the bare 🪾 cut short, with
// comb glinting in its hollow and bees on the doorstep, more of them the bigger the colony.
// Light comes from the top left, like on the emoji. The tree's still parts are painted once per
// size into a sprite, in emoji units (0,0 the 🪾's centre, 1 its size), so bark and shading land
// on the wood alone; the bees, honey and snow are drawn over it each frame.

const SNAG = 2.6;                                          // the 🪾's size, in tiles
const SNAG_BREAK = -0.2;                                   // where the top snapped off
const SNAG_JAG = [[-0.072, 0.024], [-0.058, 0.012], [-0.045, 0.024], [-0.028, 0], [-0.012, 0.018], [0.004, -0.04],
  [0.018, 0.004], [0.04, 0.016], [0.06, -0.018], [0.078, 0.014], [0.098, 0.002], [0.122, 0.026]];
const SNAG_TRUNK = [[-0.2, -0.073, 0.125], [-0.1, -0.053, 0.112], [0, -0.045, 0.116], [0.1, -0.062, 0.125],
  [0.2, -0.073, 0.14], [0.3, -0.073, 0.168], [0.4, -0.1, 0.18]];   // y, then the trunk's left and right edge
const SNAG_HOLE = { x: 0.085, y: 0.005, rx: 0.042, ry: 0.064 };    // over the emoji's own knot hole, a bit bigger
const snagSprites = new Map();

function trunkAt(y) {
  const T = SNAG_TRUNK;
  let i = 0;
  while (i < T.length - 2 && y > T[i + 1][0]) i++;
  const t = clamp((y - T[i][0]) / (T[i + 1][0] - T[i][0]), 0, 1);
  return [lerp(T[i][1], T[i + 1][1], t), lerp(T[i][2], T[i + 1][2], t)];
}

function softSpot(g, x, y, rx, ry, rgb, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb}, ${a})`); r.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
}

function holePath(g, k) {                                  // the hollow's ragged outline, k times its size
  const { x, y, rx, ry } = SNAG_HOLE;
  g.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * TAU, w = k * (1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.cos(a * 5));
    g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rx * w, y + Math.sin(a) * ry * w);
  }
  g.closePath();
}

function snagSprite(P) {
  P = Math.round(P);
  let s = snagSprites.get(P);
  if (s) return s;
  if (snagSprites.size > 40) snagSprites.clear();
  const W = P * 0.85, H = P * 0.72, ox = P * 0.45, oy = P * 0.27;
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
  const g = c.getContext('2d'), px = 1 / P;               // px: one screen pixel, in emoji units
  g.setTransform(dpr * P, 0, 0, dpr * P, ox * dpr, oy * dpr);
  g.lineCap = 'round';

  // The dead tree, cut off along a splintered line.
  g.save();
  g.beginPath(); g.moveTo(-0.5, 0.5); g.lineTo(-0.5, SNAG_BREAK + 0.02);
  for (const [x, y] of SNAG_JAG) g.lineTo(x, SNAG_BREAK + y);
  g.lineTo(0.5, SNAG_BREAK + 0.02); g.lineTo(0.5, 0.5); g.closePath(); g.clip();
  const e = sprite('🪾', P);
  g.drawImage(e.canvas, -e.size / 2 / P, -e.size / 2 / P, e.size / P, e.size / P);
  g.restore();

  // Bark, laid onto the wood only: a round trunk, ridges running up it, patches of older bark,
  // and a soft crease where each branch leaves the trunk.
  g.globalCompositeOperation = 'source-atop';
  const round = g.createLinearGradient(-0.09, 0, 0.2, 0);
  round.addColorStop(0, 'rgba(255, 232, 190, 0.2)'); round.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
  round.addColorStop(1, 'rgba(35, 18, 5, 0.34)');
  g.fillStyle = round; g.fillRect(-0.5, -0.5, 1, 1);
  if (P > 40) {
    for (let k = 0; k < 7; k++) {
      const f = (k + 0.5) / 7 + (hash2(k, 1, 7) - 0.5) * 0.1;
      g.beginPath();
      for (let n = 0, y = SNAG_BREAK + 0.02; y <= 0.43; n++, y += 0.025) {
        const [l, r] = trunkAt(y);
        g[n ? 'lineTo' : 'moveTo'](l + f * (r - l) + (hash2(k, n, 3) - 0.5) * 0.012, y);
      }
      g.lineWidth = Math.max(px, 0.009); g.strokeStyle = 'rgba(45, 24, 8, 0.16)'; g.stroke();
      g.lineWidth = Math.max(px, 0.0035); g.strokeStyle = 'rgba(40, 20, 6, 0.22)'; g.stroke();
      g.translate(-0.005, 0); g.strokeStyle = 'rgba(255, 225, 185, 0.1)'; g.stroke(); g.translate(0.005, 0);
    }
    for (let i = 0; i < 7; i++) {
      const y = SNAG_BREAK + 0.06 + hash2(i, 4, 7) * 0.5, [l, r] = trunkAt(y);
      softSpot(g, lerp(l, r, hash2(i, 5, 7)), y, 0.02 + hash2(i, 6, 7) * 0.02, 0.04, i % 2 ? '120, 105, 90' : '40, 22, 8', 0.18);
    }
  }
  for (const [x, y, rx, ry, a] of [[0.12, -0.028, 0.028, 0.012, 0.55], [0.112, -0.086, 0.012, 0.008, 0.45],
                                    [-0.056, 0.088, 0.03, 0.013, 0.55], [-0.048, 0.034, 0.012, 0.008, 0.45]])
    softSpot(g, x, y, rx, ry, '30, 15, 4', a);
  // A rougher outline: nicks in the trunk's edges, away from where the branches join.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    const y = SNAG_BREAK + 0.05 + hash2(i, 2, 9) * 0.34, right = i % 2;
    if (right ? y > -0.1 && y < 0.02 : y > 0 && y < 0.12) continue;
    const [l, r] = trunkAt(y);
    g.beginPath();
    g.ellipse(right ? r + 0.004 : l - 0.004, y, 0.005 + hash2(i, 3, 9) * 0.006, 0.01 + hash2(i, 4, 9) * 0.015, 0, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // The break: bare wood, its splinters lit where they face the sky, a shaded lip below.
  const face = g.createLinearGradient(-0.09, 0, 0.13, 0);
  face.addColorStop(0, '#c9ab80'); face.addColorStop(0.6, '#9a7650'); face.addColorStop(1, '#654426');
  g.fillStyle = face;
  g.beginPath(); g.moveTo(-0.072, SNAG_BREAK + 0.026);
  for (const [x, y] of SNAG_JAG) g.lineTo(x, SNAG_BREAK + y);
  g.quadraticCurveTo(0.025, SNAG_BREAK + 0.046, -0.072, SNAG_BREAK + 0.026); g.fill();
  g.strokeStyle = 'rgba(55, 30, 10, 0.55)'; g.lineWidth = Math.max(px, 0.005);
  g.beginPath(); g.moveTo(-0.07, SNAG_BREAK + 0.03); g.quadraticCurveTo(0.025, SNAG_BREAK + 0.05, 0.12, SNAG_BREAK + 0.03); g.stroke();
  g.lineWidth = Math.max(px, 0.0045);
  for (let i = 0; i + 1 < SNAG_JAG.length; i++) {
    const [x0, y0] = SNAG_JAG[i], [x1, y1] = SNAG_JAG[i + 1];
    g.strokeStyle = y1 < y0 ? 'rgba(248, 230, 196, 0.8)' : 'rgba(248, 230, 196, 0.25)';
    g.beginPath(); g.moveTo(x0, SNAG_BREAK + y0); g.lineTo(x1, SNAG_BREAK + y1); g.stroke();
  }

  // The hollow. A honey stain runs down from it.
  const { x, y, rx, ry } = SNAG_HOLE;
  const stain = g.createLinearGradient(0, y + ry, 0, y + ry + 0.2);
  stain.addColorStop(0, 'rgba(80, 45, 12, 0.5)'); stain.addColorStop(1, 'rgba(80, 45, 12, 0)');
  g.fillStyle = stain;
  g.beginPath(); g.moveTo(x - 0.03, y + ry * 0.8); g.quadraticCurveTo(x - 0.02, y + ry + 0.14, x - 0.004, y + ry + 0.2);
  g.quadraticCurveTo(x + 0.016, y + ry + 0.1, x + 0.028, y + ry * 0.8); g.fill();
  // A lip of bark around it, lit top left and shaded bottom right.
  holePath(g, 1.32);
  const lip = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  lip.addColorStop(0, '#c49466'); lip.addColorStop(0.45, '#7d5331'); lip.addColorStop(1, '#3f2612');
  g.fillStyle = lip; g.fill();
  // Inside: brown at the mouth, black deep in.
  holePath(g, 1);
  const deep = g.createRadialGradient(x - rx * 0.15, y - ry * 0.2, 0, x, y, ry * 1.05);
  deep.addColorStop(0, '#040201'); deep.addColorStop(0.55, '#140a04'); deep.addColorStop(1, '#4d2e15');
  g.fillStyle = deep; g.fill();
  g.save(); g.clip();
  // The comb, bulging towards us, with its cells when there's room for them.
  const cx = x + rx * 0.1, cy = y + ry * 0.62, crx = rx * 1.05, cry = ry * 0.6;
  const comb = g.createRadialGradient(cx - crx * 0.25, cy - cry * 0.1, 0, cx, cy, crx * 1.2);
  comb.addColorStop(0, '#e9c070'); comb.addColorStop(0.5, '#c4862c'); comb.addColorStop(1, '#4a2806');
  g.fillStyle = comb; g.beginPath(); g.ellipse(cx, cy, crx, cry, 0, 0, TAU); g.fill();
  const cell = rx * 0.22;
  if (cell * P > 2) {
    g.fillStyle = 'rgba(110, 60, 8, 0.4)';
    for (let r = 0, yy = cy - cry; yy < cy + cry; r++, yy += cell * 0.87)
      for (let xx = cx - crx + (r % 2) * cell / 2; xx < cx + crx; xx += cell) { g.beginPath(); g.arc(xx, yy, cell * 0.3, 0, TAU); g.fill(); }
  }
  // The top of the hole shades what's under it, and the far rim catches the light: the bark's thickness.
  const lid = g.createLinearGradient(0, y - ry, 0, y + ry * 0.35);
  lid.addColorStop(0, 'rgba(4, 2, 1, 0.97)'); lid.addColorStop(1, 'rgba(4, 2, 1, 0)');
  g.fillStyle = lid; g.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 2.35);
  const rim = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  rim.addColorStop(0, 'rgba(210, 160, 105, 0)'); rim.addColorStop(0.55, 'rgba(210, 160, 105, 0.15)');
  rim.addColorStop(1, 'rgba(225, 175, 115, 0.9)');
  holePath(g, 1); g.strokeStyle = rim; g.lineWidth = rx * 0.3; g.stroke();
  g.restore();

  s = { canvas: c, W, H, ox, oy };
  snagSprites.set(P, s);
  return s;
}

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

function drawHive(h, sx, sy) {
  const P = cam.zoom * SNAG, top = sy - P * 0.4, s = snagSprite(P);
  ctx.drawImage(s.canvas, sx - s.ox, top - s.oy, s.W, s.H);
  // Bees on the doorstep, a few wandering down the bark; they shuffle while time runs.
  const hx = sx + SNAG_HOLE.x * P, hy = top + (SNAG_HOLE.y + SNAG_HOLE.ry * 1.15) * P;
  const n = Math.min(14, 3 + h.bees), b = cam.zoom * 0.045, t = ui.speed > 0 ? performance.now() / 700 : 0;
  for (let i = 0; i < n; i++) {
    const far = i >= n * 0.7;
    const bx = hx + (hash2(1, i, h.id) - 0.5) * P * (far ? 0.1 : 0.07) + Math.sin(t + i) * b * 0.4;
    const by = hy + (far ? 0.02 + hash2(i, 1, h.id) * 0.14 : hash2(i, 1, h.id) * 0.02) * P + Math.cos(t * 0.8 + i) * b * 0.3;
    barkBee(bx, by, b, Math.PI / 2 + (hash2(i, 2, h.id) - 0.5) * 2.5);
  }
  // A full hive has honey oozing over the sill.
  if (h.honey > 800) {
    const x = hx - P * 0.012, y = hy - P * 0.01, r = P * 0.009;
    const len = r * (0.5 + 0.8 * Math.min(1, (h.honey - 800) / 700));
    const g = ctx.createLinearGradient(x - r, y, x + r, y + len);
    g.addColorStop(0, 'rgba(255, 205, 90, 0.95)'); g.addColorStop(1, 'rgba(205, 125, 15, 0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y);
    ctx.quadraticCurveTo(x - r * 0.5, y + len - r, x - r, y + len); ctx.arc(x, y + len, r, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + r * 0.5, y + len - r, x + r * 0.5, y); ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 225, 0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y + len - r * 0.2, r * 0.3, 0, TAU); ctx.fill();
  }
  // Snow settles on the break.
  if (world.snow > 0.3) {
    ctx.fillStyle = 'rgba(250, 252, 255, 0.95)';
    ctx.beginPath(); ctx.moveTo(sx - 0.1 * P, top + (SNAG_BREAK + 0.03) * P);
    for (const [x, y] of SNAG_JAG) ctx.lineTo(sx + x * P, top + (SNAG_BREAK + Math.max(y, 0) - 0.008) * P);
    ctx.quadraticCurveTo(sx + 0.02 * P, top + (SNAG_BREAK + 0.05) * P, sx - 0.1 * P, top + (SNAG_BREAK + 0.03) * P);
    ctx.fill();
  }
}

function drawHiveShadow(sx, sy, sn) {                      // the same shadow a tree of its height casts
  drawDecorShadow({ size: SNAG * 0.7, tree: true }, sx, sy, sn);
}

function hiveAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  return world.hives.find(h => Math.hypot(h.x - wx, h.y - 0.9 - wy) < Math.max(1, 14 / cam.zoom)) || null;   // the trunk
}

// Ponds are drawn as shapes, so the shore holds up however far you zoom in. The water map
// is softened by a few box blurs and traced with marching squares; each cut-off gives one
// faint ring, and stacked rings make gradients: sand fading into the grass, a little shade
// under the bank, shallows, and a darker blue where it gets too deep to wade (so the fords
// show as pale stretches of river). Traced once per meadow.
let pond = null;
function blurred(src) {
  const out = new Float32Array(S.W * S.H), at = (x, y) => src[clamp(y, 0, S.H - 1) * S.W + clamp(x, 0, S.W - 1)];
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += at(x + dx, y + dy);
    out[y * S.W + x] = n / 9;
  }
  return out;
}

// Also gives the box around the shape, so painting part of the ground can skip the rings that miss it.
function pondShape(f, t) {
  const path = new Path2D(), at = (x, y) => f[clamp(y, 0, S.H - 1) * S.W + clamp(x, 0, S.W - 1)];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = -1; y < S.H; y++) for (let x = -1; x < S.W; x++) {
    const v = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)];
    if (v[0] < t && v[1] < t && v[2] < t && v[3] < t) continue;
    box[0] = Math.min(box[0], x + 0.5); box[1] = Math.min(box[1], y + 0.5);
    box[2] = Math.max(box[2], x + 1.5); box[3] = Math.max(box[3], y + 1.5);
    const px = [x, x + 1, x + 1, x], py = [y, y, y + 1, y + 1];
    let first = true;
    const to = (a, b) => { first ? path.moveTo(a + 0.5, b + 0.5) : path.lineTo(a + 0.5, b + 0.5); first = false; };
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      if (v[k] >= t) to(px[k], py[k]);
      if ((v[k] >= t) !== (v[n] >= t)) {
        const u = (t - v[k]) / (v[n] - v[k]);
        to(lerp(px[k], px[n], u), lerp(py[k], py[n], u));
      }
    }
    path.closePath();
  }
  return { path, box };
}

// Each ring's colour: the sand follows the season, and snow freezes the water over.
function pondFills() {
  if (!pond || pond.world !== world) {
    const wet = Float32Array.from(world.water, v => v ? 1 : 0), deep = Float32Array.from(world.water, v => v === S.DEEP ? 1 : 0);
    const f1 = blurred(wet), f2 = blurred(f1), f4 = blurred(blurred(f2)), d2 = blurred(blurred(deep));
    const ring = (f, t, rgb, a) => ({ ...pondShape(f, t), rgb, a });
    const steps = (a, b, n) => Array.from({ length: n }, (_, i) => lerp(a, b, i / (n - 1)));
    // Where little waves come and go: a scatter of spots well inside the water, fixed per meadow.
    const waves = [];
    for (let i = 0; i < f2.length; i++) {
      const x = i % S.W, y = (i / S.W) | 0, h = hash2(x, y, world.seed);
      if (f2[i] > 0.9 && h < 0.14) waves.push({ x: x + hash2(y, x, 7), y: y + hash2(x, y, 11), ph: h / 0.14 });
    }
    // Plants a wave could pass over: its drift and width, a flower's size, and some spare.
    const nearWave = Uint8Array.from(world.plants, p => waves.some(v => Math.abs(p.x - v.x) < 2 && Math.abs(p.y - v.y) < 1.2));
    pond = { world, waves, nearWave, rings: [
      ...steps(0.03, 0.42, 9).map(t => ring(f4, t, 'sand', 0.12)),                // damp sand
      ring(f1, 0.47, [104, 170, 208], 1),                                          // shade under the bank
      ...steps(0.54, 0.8, 7).map(t => ring(f2, t, [130, 200, 235], 0.2)),          // shallows
      ...steps(0.3, 0.95, 9).map(t => ring(d2, t, [72, 142, 202], 0.12)),          // too deep to wade
    ] };
  }
  const ice = iceOver();
  return pond.rings.map(({ rgb, a }) => {
    const c = (rgb === 'sand' ? shoreSand : rgb).map((v, i) => Math.round(lerp(v, [214, 232, 242][i], ice)));
    return `rgba(${c.join(',')}, ${a})`;
  });
}

const iceOver = () => world.snow > 0 ? clamp(world.snow * 1.4 - 0.3, 0, 0.9) * 0.8 : 0;   // frozen over

// Little waves on open water: a small ~ that rises, drifts downwind and settles again.
// The wind makes more of them show and bigger; ice stills the water.
function drawWaves(now) {
  const m = ui.sky.mix, wind = 0.4 * m.cloudy + 0.7 * m.rain + m.storm;
  const a = (0.45 + 0.3 * Math.min(1, wind)) * (1 - iceOver() / 0.72), z = cam.zoom;
  if (a <= 0.05 || z < 6) return;
  const big = 1 + 0.4 * Math.min(1, wind), w = z * 0.34 * big, h = w * 0.22;
  ctx.save();
  ctx.strokeStyle = '#f4fbff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, z * 0.07);
  for (const p of pond.waves) {
    const life = (now / (5200 - 2000 * Math.min(1, wind)) + p.ph) % 1;
    const b = Math.sin(Math.PI * life);
    if (b < 0.08) continue;
    const [sx, sy] = toScreen(p.x + (life - 0.5) * 0.7, p.y);
    if (!visible(sx, sy, w * 2)) continue;
    const s = 0.6 + 0.4 * b;                                     // rises, then settles
    ctx.globalAlpha = a * b;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {                             // a short ~ of a wave and a half
      const u = k / 12;
      ctx.lineTo(sx + w * s * (2 * u - 1), sy - h * s * Math.sin(u * 3 * Math.PI));
    }
    ctx.stroke();
  }
  ctx.restore();
}

//   view   the part being painted, [x, y, w, h] in screen pixels: rings that miss it are skipped
function drawPonds(g, z, ox, oy, fills, [vx, vy, w, h]) {
  g.save();
  g.translate(ox, oy); g.scale(z, z);
  pond.rings.forEach(({ path, box }, i) => {
    const m = 4;                                     // a few pixels spare, for the thunder shake
    if (ox + box[2] * z < vx - m || oy + box[3] * z < vy - m || ox + box[0] * z > vx + w + m || oy + box[1] * z > vy + h + m) return;
    g.fillStyle = fills[i]; g.fill(path);
  });
  g.restore();
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

function drawWeather(now, ck) {
  const m = ui.sky.mix;
  const shade = 0.12 * m.cloudy + 0.08 * m.rain + 0.10 * m.storm;
  if (shade > 0.01) drawCloudShadows(now, shade);
  const dim = 0.05 * m.cloudy + 0.09 * m.rain + 0.30 * m.storm + 0.04 * m.snow;
  if (dim > 0.005) wash(`rgba(50, 62, 92, ${dim})`);
  if (m.heat > 0.01) wash(`rgba(255, 168, 60, ${0.11 * m.heat})`);
  if (!ck.night) drawRainbow(now);
  if (m.fog > 0.01) drawFog(now, m.fog);
  const rain = m.rain + 1.8 * m.storm;
  if (rain > 0.02) drawRain(now, rain, m.storm);
  if (m.snow > 0.02) drawSnow(now, m.snow);
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
function drawRainbow(now) {
  const age = now - ui.sky.rainbow;
  if (!ui.sky.rainbow || age > 14000) return;
  const a = 0.3 * Math.sin(Math.PI * age / 14000);
  const zoomScale = cam.zoom / minZoom;
  const R = Math.max(vw, vh) * 0.55 * zoomScale, bw = Math.max(3, R * 0.018);
  const [cx, cy] = toScreen(S.W * 0.58, S.H + 6);
  const colors = ['#ff5b5b', '#ff9f43', '#ffe066', '#6bd66b', '#4db8ff', '#6f7bf7', '#b77bf0'];
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = bw;
  colors.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.arc(cx, cy, R - i * bw, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  });
  ctx.restore();
}

// A white flash, and a jagged bolt when the strike is on screen.
function drawLightning(now) {
  const b = ui.sky.bolt;
  if (!b) return;
  const age = now - b.t0;
  if (age > 450) { ui.sky.bolt = null; return; }
  const fade = 1 - age / 450;
  wash(`rgba(255, 255, 255, ${0.45 * fade * fade})`);
  const [sx, sy] = toScreen(b.x, b.y);
  if (!visible(sx, sy, 20) || age > 250) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 240, ${fade})`;
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

function thunder(e) {
  const now = performance.now();
  if (now - ui.sky.boom < 250) return;           // at 60x, one flash at a time is plenty
  const path = [[0, Math.random() - 0.5]];
  for (let f = 0.12; f < 1; f += 0.08 + Math.random() * 0.08) path.push([f, Math.random() - 0.5]);
  path.push([1, 0]);
  ui.sky.bolt = { x: e.x, y: e.y, t0: now, path };
  ui.sky.boom = now;
}

// Flames glow, so they go on top of the night.
function drawFire(now) {
  if (!world.burning.length) return;
  const z = cam.zoom, px = Math.max(8, z * 1.15);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const i of world.burning) {
    const [sx, sy] = toScreen(i % S.W + 0.5, Math.floor(i / S.W) + 0.5);
    if (!visible(sx, sy, px * 2)) continue;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, px * 1.6);
    grad.addColorStop(0, 'rgba(255, 140, 40, 0.2)');
    grad.addColorStop(1, 'rgba(255, 90, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - px * 1.6, sy - px * 1.6, px * 3.2, px * 3.2);
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

// ------------------------------------------------------------------ news

const NEWS_TOASTS = 3, NEWS_TOAST_MS = 7000, NEWS_LOG_MAX = 80;
function addNews(html, category, minGapMs = 0) {
  const now = performance.now();
  if (category && minGapMs && ui.lastNews[category] && now - ui.lastNews[category] < minGapMs) return;
  if (category) ui.lastNews[category] = now;
  ui.newsLog.unshift({ html, tick: world.tick });
  ui.newsLog.length = Math.min(ui.newsLog.length, NEWS_LOG_MAX);
  if (ui.newsOpen) { renderNewsLog(); return; }
  const box = $('#news');
  const el = document.createElement('div');
  el.className = 'news-item';
  el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > (narrow() ? 1 : NEWS_TOASTS)) box.lastChild.remove();   // a phone has room for one
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 800); }, NEWS_TOAST_MS);
}

function renderNewsLog() {
  $('#news-log ol').innerHTML = ui.newsLog.map(n => `<li><span class="when">${when(n.tick)}</span>${n.html}</li>`).join('');
}

function toggleNewsLog() {
  ui.newsOpen = !ui.newsOpen;
  $('#news-log').classList.toggle('hidden', !ui.newsOpen);
  $('.news-toggle').classList.toggle('on', ui.newsOpen);
  $('#news').innerHTML = '';                        // it's all in the log now
  if (ui.newsOpen) renderNewsLog();
}

const link = c => c ? `<a data-id="${c.id}">${esc(c.name)}</a>` : 'someone';
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
  if (!ui.sound) return;
  const [sx, sy] = toScreen(x, y), seen = visible(sx, sy, 40);
  if (!seen && !always) return;
  Sound.play(name, { pan: 0.8 * clamp(sx / vw * 2 - 1, -1, 1), near: seen ? clamp(cam.zoom / (3 * minZoom), 0.4, 1) : 0.2, ...opts });
}
const chime = (name, opts) => { if (ui.sound) Sound.play(name, opts); };

function toggleSound(on = !ui.sound) {
  ui.sound = on;
  if (on && navigator.userActivation?.hasBeenActive !== false) Sound.start();   // else the first click will
  Sound.setEnabled(on);
  $('#sound-btn').textContent = on ? '🔊' : '🔇';
  $('#sound-btn').classList.toggle('on', on);
  $('#sound-item').textContent = on ? '🔊 Sound is on' : '🔇 Sound is off';
  try { localStorage.setItem('aeon-garden-sound', on ? '1' : '0'); } catch (e) { /* fine */ }
}

function involvesSelected(e) {
  const id = ui.selectedId;
  if (!id) return false;
  return [e.c, e.a, e.b, e.mum, e.dad, e.rabbit, e.fox, e.killer].some(x => x && x.id === id);
}

function handleEvent(e) {
  const mine = involvesSelected(e);
  switch (e.type) {
    case 'season':
      addNews(SEASON_NEWS[e.season] + (e.season === 0 ? ` Year ${e.year} begins.` : ''));
      chime('season', { season: e.season });
      break;
    case 'weather': {
      if (WET.has(e.kind) && !WET.has(e.prev)) chime('rain');
      const text = WEATHER_NEWS[e.kind];
      if (e.player) addNews(text);
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
      break;
    case 'fire':
      addNews('🔥 <b>Wildfire!</b> Lightning set the dry grass alight. Everyone is running.');
      hear('fire', e.x, e.y, {}, true);
      break;
    case 'fireout': {
      const pct = e.burned / world.water.reduce((n, v) => n + (v ? 0 : 1), 0) * 100;
      if (e.burned >= 25) chime('fireout');
      if (e.burned >= 25) addNews(`🌱 The fire is out after burning ${pct < 1 ? 'a corner' : Math.round(pct) + '%'} of the meadow. The ash will feed fresh shoots.`);
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
      const what = fox ? (n === 1 ? 'cub' : 'cubs') : e.mum.species === 'bee' ? (n === 1 ? 'young bee' : 'young bees') : (n === 1 ? 'baby' : 'babies');
      const text = `${fox ? '🦊' : '🍼'} ${link(e.mum)} had ${n} ${what}` + (e.dad ? ` with ${link(e.dad)}.` : '.');
      if (mine || fox) addNews(text);
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
      hear(e.cause === 'fox' ? 'catch' : e.cause === 'old' ? 'old' : 'starve', c.x, c.y, { species: c.species }, mine);
      if (e.cause === 'fox') addEffect('🦴', c.x, c.y, 0.3, 1800);
      else addEffect('👻', c.x, c.y, 1.6, 2000);
      if (e.cause === 'fox') {
        const t = `🦊 ${link(e.killer)} caught ${link(c)}.`;
        if (mine) addNews(t); else addNews(t, 'catch', 7000);
      } else if (e.cause === 'hunger') {
        const t = c.species === 'fox' ? `🥀 ${link(c)} the fox starved. There weren't enough rabbits.`
          : c.species === 'bee' ? `🥀 ${link(c)} the bee starved. The hive ran out of honey.`
          : `🥀 ${link(c)} starved.`;
        if (mine || c.species === 'fox') addNews(t); else addNews(t, 'starve', 12000);
      } else if (e.cause === 'lightning') {
        addNews(`⚡ ${link(c)} was struck by lightning.`);
      } else if (e.cause === 'fire') {
        const t = `🔥 ${link(c)} was caught in the wildfire.`;
        if (mine) addNews(t); else addNews(t, 'burn', 6000);
      } else {
        const age = Math.floor(S.ageDays(world, c));
        const fam = c.kids ? `, leaving ${c.kids} ${c.kids === 1 ? 'child' : 'children'}` : '';
        const t = `🌙 Old ${link(c)} died peacefully at ${age} days${fam}.`;
        if (mine || c.kids >= 10) addNews(t); else addNews(t, 'old', 15000);
      }
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
      hear('escape', e.rabbit.x, e.rabbit.y, {}, mine);
      const t = e.how === 'burrow' ? `💨 ${link(e.rabbit)} dived into a burrow just before ${link(e.fox)} could pounce!`
        : e.how === 'pond' ? `🌊 ${link(e.rabbit)} put ${e.water ? e.water.name : 'the water'} between itself and ${link(e.fox)}, and got away!`
        : `💨 ${link(e.rabbit)} outran ${link(e.fox)}!`;
      if (mine) addNews(t); else addNews(t, 'escape', 11000);
      break;
    }
    case 'spotted': {
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
      }[e.species]);
      break;
    case 'arrive': {
      const names = e.who.map(link).join(', ');
      addNews({
        rabbit: `🧳 A family of rabbits hopped in from the next valley: ${names}.`,
        fox: `🧳 Foxes have wandered in, drawn by all the rabbits: ${names}.`,
        bee: `🐝 A swarm has found the empty hive and moved in: ${names}.`,
      }[e.species]);
      for (const c of e.who) addEffect('✨', c.x, c.y);
      hear('arrive', e.who[0].x, e.who[0].y, { species: e.species }, true);
      break;
    }
  }
}

// How many make a record worth telling, and how big a peak has to be before its crash is news.
const NEWSWORTHY = { rabbit: { record: 20, crash: 80 }, fox: { record: 8, crash: 10 }, bee: { record: 20, crash: 40 } };

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
];
const traitsOf = species => TRAITS.filter(t => !t.only || t.only === species);
const word = (t, v) => t.words[v < 0.3 ? 0 : v < 0.45 ? 1 : v < 0.55 ? 2 : v < 0.7 ? 3 : 4];

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
  setText($('#mini-sky'), S.SEASONS[ck.season].emoji + icon);
  for (const s of S.KINDS) {
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
  grass: { emoji: '🌱', name: 'Grass', title: 'How lush the meadow is', color: '#5f9e43', fmt: v => Math.round(v * 100) + '%' },
};
const SEASON_TINT = ['#f6dde5', '#f7ecb8', '#f4d6b6', '#dfe8f0'];
const RANGES = { year: S.YEAR_DAYS * S.TPD, five: 5 * S.YEAR_DAYS * S.TPD, all: Infinity };
const RANGE_WORDS = { year: 'the last year', five: 'the last 5 years', all: 'the whole story' };
const MARK_EMOJI = { extinct: '😢', arrive: '🧳', fire: '🔥' };
const CAUSES = [['fox', '🦊', 'Caught by a fox'], ['hunger', '🥀', 'Starved'], ['age', '🌙', 'Old age'],
  ['lightning', '⚡', 'Lightning'], ['fire', '🔥', 'Wildfire']];
const INK = '#3b372f', MUTED = '#6f6657';

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
  const keys = shownKeys(), animals = keys.filter(k => k !== 'grass'), { i0 } = statsWindow();
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
  $('#stats-title').textContent = keys.length > 1 ? 'Rabbits, foxes, bees and grass' : SERIES[keys[0]].emoji + ' ' + SERIES[keys[0]].title;
  $('#stats-range-note').textContent = 'over ' + RANGE_WORDS[ui.stats.range];
  $('#stats-clock').textContent = `${S.SEASONS[S.seasonOf(world.tick)].emoji} ${when(world.tick)}`;
  document.querySelectorAll('[data-show]').forEach(b => b.classList.toggle('on', b.dataset.show === ui.stats.show));
  document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('on', b.dataset.range === ui.stats.range));
  drawStatsChart();
  renderStatsCards();
}

$('#stats-chart').addEventListener('pointermove', e => { ui.stats.hover = e.offsetX; drawStatsChart(); });
$('#stats-chart').addEventListener('pointerleave', () => { ui.stats.hover = null; drawStatsChart(); });

// ------------------------------------------------------------------ the inspector

function when(t) {
  const s = S.seasonOf(t), day = Math.floor(t / S.TPD);
  return `${S.SEASONS[s].name} ${day % S.SEASON_DAYS + 1}, Y${Math.floor(day / S.YEAR_DAYS) + 1}`;
}

function lifeStage(c) {
  const age = S.ageDays(world, c), g = S.growth(world, c);
  if (g < 0.5) return 'baby';
  if (g < 1) return 'youngster';
  if (age > c.sp.lifeDays * 0.8) return 'elder';
  return 'adult';
}

function renderInspector() {
  const box = $('#inspector');
  const c = world.byId.get(ui.selectedId);
  document.body.classList.toggle('inspecting', !!c);
  if (!c) { box.classList.remove('open'); setHTML(box, ''); return; }
  box.classList.add('open');
  box.classList.toggle('peek', !ui.sheetUp);          // only a phone draws it small
  const age = Math.floor(S.ageDays(world, c));
  const sex = c.sex === 'F' ? '♀' : '♂';
  const mood = S.mood(world, c);
  const e = c.energy / c.maxEnergy;
  const mum = world.byId.get(c.mumId), dad = world.byId.get(c.dadId);
  const parent = (p, label) => p ? `${label} ${link(p)}${p.alive ? '' : ' 🪦'}` : '';
  const kidsAlive = world.creatures.filter(k => k.mumId === c.id || k.dadId === c.id).length;
  const chips = [];
  if (c.alive && c.pregnantUntil) chips.push(c.species === 'fox' ? '🍼 Expecting cubs' : '🍼 Expecting babies');
  if (c.kills) chips.push(`🍖 ${c.kills} ${c.kills === 1 ? 'catch' : 'catches'}`);
  if (c.escapes) chips.push(`💨 ${c.escapes} narrow ${c.escapes === 1 ? 'escape' : 'escapes'}`);
  if (c.visits) chips.push(`🌼 ${c.visits} ${c.visits === 1 ? 'flower' : 'flowers'} visited`);
  const nemesis = world.byId.get(c.nemesisId);
  if (nemesis && nemesis.alive) chips.push(`😨 Afraid of ${link(nemesis)}`);
  if (c.gen > 1) chips.push(`🌳 Generation ${c.gen}`);
  const story = c.story.slice().reverse().slice(0, 10).map(s =>
    `<li><span>${s.emoji}</span><span>${esc(s.text)}<div class="when">${when(s.t)}</div></span></li>`).join('');
  const diary = ui.diary.get(c.id);
  const diaryHtml = diary ? (diary.loading
    ? `<div class="diary"><span class="dots">✍️ ${esc(c.name)} is writing</span></div>`
    : `<div class="diary ${diary.error ? 'err' : ''}">${esc(diary.text)}</div>`) : '';
  const living = c.alive ? '' : world.creatures.find(k => k.mumId === c.id || k.dadId === c.id);

  setHTML(box, `
    <button class="sheet-handle phone-only" aria-label="${ui.sheetUp ? 'Show less' : 'Show more'}"></button>
    <div class="ins-head">
      <div class="portrait" style="background:${furCss(c)}33">${portraitHTML(c)}</div>
      <div>
        <div class="ins-name">${esc(c.name)} <span style="color:var(--muted)">${sex}</span></div>
        <div class="ins-sub">${c.alive ? `${c.sp.name} · ${lifeStage(c)} · ${age} ${age === 1 ? 'day' : 'days'} old`
          : `${c.sp.name} · lived ${age} ${age === 1 ? 'day' : 'days'}`}</div>
      </div>
      <button class="close" data-act="close" title="Close (Esc)">✕</button>
    </div>
    <div class="mood">${mood.emoji || '🙂'} ${esc(mood.text)}</div>
    ${c.alive ? `<div class="meters">
      <div class="meter-row">Tummy <div class="meter ${e < 0.3 ? 'low' : ''}"><span style="width:${Math.round(e * 100)}%"></span></div></div>
      <div class="meter-row">Breath <div class="meter stamina"><span style="width:${Math.round(c.stamina * 100)}%"></span></div></div>
    </div>` : ''}
    ${chips.length ? `<div class="chips">${chips.map(x => `<span class="chip">${x}</span>`).join('')}</div>` : ''}
    <h4>Personality</h4>
    ${traitsOf(c.species).map(t => `<div class="trait" title="${t.tip}"><span>${t.e}</span><span>${t.name}</span>
      <div class="meter"><span style="width:${Math.round(c.genes[t.k] * 100)}%"></span></div>
      <span class="word">${word(t, c.genes[t.k])}</span></div>`).join('')}
    <h4>Family</h4>
    <div class="family">
      ${c.genes.coat ? `${coatLine(c)}<br>` : ''}
      ${c.gen === 1 ? 'One of the first arrivals.' : [parent(mum, 'Mum'), parent(dad, 'Dad')].filter(Boolean).join(' · ')}<br>
      ${c.kids ? `${c.kids} ${c.kids === 1 ? 'child' : 'children'}${kidsAlive ? `, ${kidsAlive} still alive` : ''}` : 'No children yet'}
    </div>
    <h4>Life story</h4>
    <ul class="story">${story}</ul>
    ${diaryHtml}
    <div class="ins-actions">
      ${c.alive ? `<button class="btn ${ui.follow ? 'on' : ''}" data-act="follow">${ui.follow ? '📍 Following' : '📍 Follow'}</button>
        <button class="btn" data-act="diary" title="Uses the local AI on this computer (Ollama)">✍️ Diary</button>`
        : living ? `<button class="btn" data-act="child" data-id="${living.id}">🐣 Follow ${esc(living.name)}</button>` : ''}
    </div>`);
}

// ------------------------------------------------------------------ the diary (local LLM, optional)

const OLLAMA = 'http://localhost:11434';
let ollamaModel = null;

async function pickModel() {
  if (ollamaModel) return ollamaModel;
  const res = await fetch(OLLAMA + '/api/tags');
  const names = (await res.json()).models.map(m => m.name);
  ollamaModel = ['qwen3:8b', 'qwen3:4b'].find(n => names.includes(n)) || names[0];
  if (!ollamaModel) throw new Error('no models');
  return ollamaModel;
}

function diaryFacts(c) {
  const ck = S.clock(world);
  const mum = world.byId.get(c.mumId), dad = world.byId.get(c.dadId);
  const events = c.story.slice(-8).map(s => `- (${when(s.t)}) ${s.text}`).join('\n');
  return [
    `Name: ${c.name}. A ${c.sex === 'F' ? 'female' : 'male'} ${c.sp.name.toLowerCase()}, ${Math.floor(S.ageDays(world, c))} days old (a ${lifeStage(c)}; ${c.sp.plural.toLowerCase()} here live about ${c.sp.lifeDays} days).`,
    `Personality: ${traitsOf(c.species).map(t => word(t, c.genes[t.k])).join(', ')}.` + (c.genes.coat ? ` Fur: ${S.COATS[S.coatOf(c.genes)].name}${S.whiteness(world, c) > 0.5 ? ', turned white for winter' : ''}.` : ''),
    `Right now: ${S.mood(world, c).text}. Tummy ${Math.round(100 * c.energy / c.maxEnergy)}% full. It is ${S.SEASONS[ck.season].name.toLowerCase()}, ${ck.night ? 'night' : 'daytime'}, weather: ${S.WEATHER[world.weather.kind].name.toLowerCase()}${world.burning.length ? ', and there is a wildfire in the meadow' : ''}.`,
    `Family: mum ${mum ? mum.name + (mum.alive ? '' : ' (died)') : 'unknown'}, dad ${dad ? dad.name + (dad.alive ? '' : ' (died)') : 'unknown'}, ${c.kids} children.`,
    c.species === 'fox' ? `Rabbits caught so far: ${c.kills}.`
      : c.species === 'bee' ? `Flowers visited so far: ${c.visits}. Honey in the hive: ${Math.round(c.home.honey)}, shared by ${c.home.bees} bees.`
      : `Narrow escapes from foxes: ${c.escapes}.`
        + (world.byId.get(c.nemesisId) ? ` The fox it fears most: ${world.byId.get(c.nemesisId).name}.` : ''),
    `Recent life events (oldest first):\n${events}`,
    `Write today's diary entry.`,
  ].join('\n');
}

async function writeDiary(c) {
  const entry = { loading: true, text: '' };
  ui.diary.set(c.id, entry);
  renderInspector();
  try {
    const model = await pickModel();
    const res = await fetch(OLLAMA + '/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        model, stream: false, think: false,
        options: { temperature: 0.9, num_predict: 180 },
        messages: [
          { role: 'system', content: 'You write tiny diary entries for animals living in a cozy meadow. ' +
            'Write in first person as the animal, in simple, warm, slightly funny words a child would enjoy. ' +
            'Use only the facts given and do not invent other named animals. 2 or 3 short sentences. At most one emoji.' },
          { role: 'user', content: diaryFacts(c) },
        ],
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    entry.text = '“' + data.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^["“]|["”]$/g, '') + '”';
  } catch (err) {
    entry.error = true;
    entry.text = '✍️ The diary needs the local AI. Start Ollama on this computer (ollama serve) and try again.';
  }
  entry.loading = false;
  if (ui.selectedId === c.id) renderInspector();
}

// ------------------------------------------------------------------ selection and input

function select(id, zoomIn = true) {
  ui.selectedId = id;
  ui.trail = [];
  ui.follow = !!id;
  ui.sheetUp = false;
  const close = narrow() ? 16 : 22;           // a phone keeps a little more of the meadow around it
  if (id && zoomIn && cam.zoom < close - 2) cam.goal = close;
  renderInspector();
}

// The sheet on a phone: tap the handle, or swipe the handle or the name, up for more and down for less.
// Swiping down a small sheet puts it away.
let swipe = null;
$('#inspector').addEventListener('pointerdown', e => {
  if (sheet && e.target.closest('.sheet-handle, .ins-head') && !e.target.closest('button:not(.sheet-handle)')) swipe = { y: e.clientY };
});
$('#inspector').addEventListener('pointerup', e => {
  if (!swipe) return;
  const dy = e.clientY - swipe.y, tap = Math.abs(dy) < 10 && e.target.closest('.sheet-handle');
  swipe = null;
  if (tap || dy < -24) ui.sheetUp = tap ? !ui.sheetUp : true;
  else if (dy > 24) { if (ui.sheetUp) ui.sheetUp = false; else { select(0); return; } }
  else return;
  $('#inspector').scrollTop = 0;
  renderInspector();
});
$('#inspector').addEventListener('pointercancel', () => { swipe = null; });

function creatureAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const reach = Math.max(1.4, 20 / cam.zoom);
  let best = null, bd = reach * reach;
  for (const c of world.creatures) {
    if (c.hidden || !c.alive) continue;
    const d = (c.x - wx) ** 2 + (c.y - (wy + 0.2)) ** 2;
    if (d < bd) { best = c; bd = d; }
  }
  return best;
}

function setTool(tool) {
  ui.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  canvas.className = 'tool-' + tool;
  updateBar();
}

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
const fingers = new Map();

function startPinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const [wx, wy] = toWorld(mx, my);
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: cam.zoom, wx, wy };
  drag = null; cam.goal = null; ui.follow = false;
}

function movePinch() {
  const [a, b] = fingers.values(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  cam.zoom = clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, minZoom, 64);
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
    if (f) drag = { x: f.x, y: f.y, cx: cam.x, cy: cam.y, moved: true, paint: false };
  }
  return true;
}

canvas.addEventListener('pointerdown', e => {
  if (ui.ring) { closeRing(); return; }
  if (e.button === 2 || (e.ctrlKey && e.pointerType === 'mouse')) return;   // that's the ring menu
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch') fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size >= 2) { startPinch(); return; }
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, paint: ui.tool === 'grass' && e.button === 0 };
  if (drag.paint) paintAt(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); return; }
  if (!drag) {
    const c = creatureAt(e.clientX, e.clientY);
    ui.hoverId = c ? c.id : 0;
    ui.hoverHive = c ? null : hiveAt(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.paint) { paintAt(e.clientX, e.clientY); return; }
  if (drag.moved) {
    canvas.classList.add('dragging');
    ui.follow = false;
    cam.x = drag.cx - wholePx(dx) / cam.zoom; cam.y = drag.cy - wholePx(dy) / cam.zoom;
    clampCam();
  }
});
canvas.addEventListener('pointerup', e => {
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) click(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('pointercancel', e => {
  if (liftFinger(e)) return;
  canvas.classList.remove('dragging');
  drag = null;
});
// Safari ignores the viewport's no-zoom, and a zoomed page makes the whole meadow blurry.
document.addEventListener('gesturestart', e => e.preventDefault());
canvas.addEventListener('pointerleave', () => { ui.hoverId = 0; ui.hoverHive = null; });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!LAB) openRing(e.clientX, e.clientY); });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  closeRing();
  const pixelPan = !e.ctrlKey && e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40);
  if (pixelPan) {                     // trackpad two-finger scroll: look around
    const dx = wholePx(scrollRest.x + e.deltaX), dy = wholePx(scrollRest.y + e.deltaY);
    scrollRest = { x: scrollRest.x + e.deltaX - dx, y: scrollRest.y + e.deltaY - dy };   // the rest comes next time
    cam.x += dx / cam.zoom; cam.y += dy / cam.zoom;
    ui.follow = false; clampCam();
  } else {                            // mouse wheel or pinch: zoom
    cam.goal = null;
    zoomAt(e.clientX, e.clientY, cam.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)));
  }
}, { passive: false });

function click(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  if (ui.tool === 'look') {
    const c = creatureAt(sx, sy);
    select(c ? c.id : 0);
  } else if (S.KINDS.includes(ui.tool)) release(ui.tool, wx, wy);
  else if (ui.tool === 'zap') { S.zap(world, wx, wy); flushEvents(); }
}

function release(species, wx, wy) {
  const sex = ui.releaseSex[species];
  ui.releaseSex[species] = sex === 'F' ? 'M' : 'F';
  const c = S.addCreature(world, species, wx, wy, { sex, age: world.rng.range(5, 9) });
  if (c) {
    addEffect('✨', wx, wy);
    hear('release', wx, wy, { species: c.species });
    addNews(`👋 You released ${link(c)}, a ${c.sex === 'F' ? 'female' : 'male'} ${c.sp.name.toLowerCase()}.`);
  }
}

// ------------------------------------------------------------------ the ring: right-click the meadow

const RING_TOOLS = [['rabbit', '🐇', 'Release a rabbit'], ['fox', '🦊', 'Release a fox'], ['bee', '🐝', 'Release a bee'], ['grass', '🌱', 'Grow grass'],
  ['zap', '⚡', 'Strike lightning'], ['sky', '🌦️', 'Weather']];

function openRing(sx, sy, weather = false) {
  const items = weather
    ? [...Object.entries(S.WEATHER).map(([k, wx]) => ['sky:' + k, wx.emoji, wx.name]), ['lock', world.skyLocked ? '🔒' : '🔓', world.skyLocked ? 'Unlock the weather' : 'Keep this weather']]
    : RING_TOOLS;
  if (!ui.ring) { ui.ring = { at: toWorld(sx, sy) }; chime('click'); }
  ui.ring.t0 = performance.now();
  const r = weather ? 80 : 64;           // near an edge the ring moves in, but still acts where you clicked
  sx = clamp(sx, r + 34, vw - r - 34); sy = clamp(sy, r + 34, vh - r - 34);
  const ring = $('#ring');
  ring.style.left = sx + 'px'; ring.style.top = sy + 'px';
  ring.innerHTML = '<div class="ring-hub"></div>' + items.map(([k, e, label], i) => {
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
  if (k === 'sky') { const [sx, sy] = toScreen(wx, wy); openRing(sx, sy, true); return; }
  closeRing();
  if (S.KINDS.includes(k)) release(k, wx, wy);
  else if (k === 'zap') { S.zap(world, wx, wy); flushEvents(); }
  else if (k === 'grass') {
    S.paintGrass(world, wx, wy, 5);
    hear('grass', wx, wy);
    for (let i = 0; i < 6; i++) addEffect('🌱', wx + (Math.random() - 0.5) * 7, wy + (Math.random() - 0.5) * 7, 0.6, 900);
    terrainTick = -1;
  } else if (k === 'lock') toggleSkyLock();
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

function copyLink() {
  navigator.clipboard?.writeText(location.href).then(
    () => addNews('🔗 Link copied. Anyone who opens it gets this same meadow from the start.'),
    () => addNews(`🔗 Couldn't copy. The link is ${esc(location.href)}`));
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
  S.paintGrass(world, wx, wy, 3.5);
  hear('grass', wx, wy);
  if (Math.random() < 0.3) addEffect('🌱', wx + (Math.random() - 0.5) * 3, wy + (Math.random() - 0.5) * 3, 0.6, 900);
  terrainTick = -1;
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tool],[data-speed],[data-action],[data-act],[data-show],[data-range],[data-sky],[data-ring],a[data-id]');
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
  else if (t.dataset.act === 'sky-lock') toggleSkyLock();
  else if (t.dataset.action === 'new') { if (confirm('Start a brand-new meadow? This one will be gone.')) newWorld(randomSeed()); }
  else if (t.dataset.act === 'close') select(0);
  else if (t.dataset.act === 'news') toggleNewsLog();
  else if (t.dataset.act === 'mini') toggleMini();
  else if (t.dataset.act === 'more') toggleMore();
  else if (t.dataset.act === 'copy-link') copyLink();
  else if (t.dataset.act === 'sound') toggleSound();
  else if (t.dataset.act === 'stats') toggleStats();
  else if (t.dataset.show) { ui.stats.show = t.dataset.show; renderStats(); }
  else if (t.dataset.range) { ui.stats.range = t.dataset.range; renderStats(); }
  else if (t.dataset.act === 'follow') { ui.follow = !ui.follow; renderInspector(); }
  else if (t.dataset.act === 'diary') { const c = world.byId.get(ui.selectedId); if (c) writeDiary(c); }
  else if (t.dataset.id) {
    if (ui.stats.open) toggleStats(false);
    const c = world.byId.get(+t.dataset.id);
    if (c) select(c.id);
  }
});

document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (LAB && !'+=-'.includes(e.key)) return;            // the lab has keys of its own
  if (e.key === ' ') {
    e.preventDefault();
    setSpeed(ui.speed ? 0 : lastSpeed);
  } else if ('1234'.includes(e.key) && e.key.length === 1) setSpeed([1, 4, 15, 60][+e.key - 1]);
  else if (e.key === 'Escape') {
    const more = !$('#more-menu').classList.contains('hidden');
    ui.ring ? closeRing() : ui.sky.menu ? toggleSkyMenu(false) : more ? toggleMore(false) : ui.stats.open ? toggleStats(false)
      : ui.tool !== 'look' ? setTool('look') : select(0);
  }
  else if (e.key === 's') toggleStats();
  else if (e.key === 'f' && ui.selectedId) { ui.follow = !ui.follow; renderInspector(); }
  else if (e.key === 'l') setTool('look');
  else if (e.key === 'z') setTool('zap');
  else if (e.key === 'w') toggleSkyMenu();
  else if (e.key === 'k') toggleSkyLock();
  else if (e.key === 'n') toggleNewsLog();
  else if (e.key === 'c') toggleMini();
  else if (e.key === 'm') toggleSound();
  else if (e.key === '+' || e.key === '=') zoomAt(vw / 2, vh / 2, cam.zoom * 1.25);
  else if (e.key === '-') zoomAt(vw / 2, vh / 2, cam.zoom / 1.25);
});

// ------------------------------------------------------------------ the loop

function flushEvents() {
  for (const e of world.events) handleEvent(e);
  world.events.length = 0;
}

function randomSeed() { return Math.floor(Math.random() * 1e6); }

function newWorld(seed) {
  world = S.createWorld(seed, LAB ? { terrain, drawn, rabbits: 0, foxes: 0, bees: 0 } : { terrain, drawn });
  jitter = Float32Array.from({ length: S.W * S.H }, () => Math.random() * 2 - 1);
  patches = blurred(blurred(blurred(blurred(jitter))));
  const spread = Math.sqrt(patches.reduce((m, v) => m + v * v, 0) / patches.length);
  patches = patches.map(v => clamp(v / spread, -2.5, 2.5));      // about -1..1 on a typical tile
  Object.assign(ui, { selectedId: 0, hoverId: 0, follow: false, trail: [], effects: [], lastNews: {}, newsLog: [] });
  ui.records = perKind(s => world.count[s]);
  ui.crashSaid = perKind(() => -1);
  ui.seenHistory = 0;
  const mix = Object.fromEntries(Object.keys(S.WEATHER).map(k => [k, k === world.weather.kind ? 1 : 0]));
  Object.assign(ui.sky, { mix, tick: world.tick, bolt: null, rainbow: 0 });
  showSkyLock();
  $('#news').innerHTML = '';
  renderNewsLog();
  cam.zoom = minZoom; cam.x = S.W / 2; cam.y = S.H / 2; cam.goal = null;
  clampCam();
  paintTerrain(true);
  renderInspector();
  updateMeadowCard();
  if (ui.stats.open) renderStats();
  const big = [world.waters.find(v => v.kind === 'river'), world.lake].filter(Boolean).map(v => `<b>${v.name}</b>`);
  addNews(`🌱 A new meadow${big.length ? ' by ' + big.join(' and ') : ''}. <b>${world.count.rabbit} rabbits</b> and <b>${world.count.fox} foxes</b> have just moved in.`);
  if (!LAB) history.replaceState(null, '', '?seed=' + seed + terrainQuery());
}

let last = performance.now(), acc = 0, lastCard = 0, lastRecord = 0, lastStatsCards = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (ui.speed > 0) {
    acc += dt * TICKS_PER_SECOND * ui.speed;
    const n = Math.min(Math.floor(acc), 2000);
    acc -= n;
    for (let i = 0; i < n; i++) {
      S.step(world);
      if (world.events.length) flushEvents();
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
  if (sel && ui.follow) {
    const k = 1 - Math.pow(0.001, dt);
    const gy = sheet ? sel.y + (vh / 2 - (sheet.top + vh - sheet.bottom) / 2) / cam.zoom : sel.y;
    cam.x += (sel.x - cam.x) * k; cam.y += (gy - cam.y) * k;
  }
  if (cam.goal) {
    const k = 1 - Math.pow(0.01, dt);
    cam.zoom += (cam.goal - cam.zoom) * k;
    if (Math.abs(cam.goal - cam.zoom) < 0.05) cam.goal = null;
    cam.zoom = Math.max(cam.zoom, minZoom);
  }
  clampCam();

  if (!ui.stats.open && canvas.width && canvas.height) {   // the stats page covers the meadow; a hidden tab can have no size
    if (world.tick - terrainTick >= 12 || terrainTick < 0) paintTerrain();
    render(now);
    if (lab?.draw) lab.draw(ctx, now);
  }

  if (now - lastCard > 250) {
    lastCard = now;
    updateMeadowCard();
    if (ui.sound) {
      const ck = S.clock(world);
      Sound.update({ phase: ck.phase, season: ck.season, speed: ui.speed, sky: ui.sky.mix, fire: world.burning.length });
    }
    if (ui.selectedId && !$('#inspector').matches(':hover')) renderInspector();
    if (ui.stats.open) { $('#stats-clock').textContent = `${S.SEASONS[S.seasonOf(world.tick)].emoji} ${when(world.tick)}`; drawStatsChart(); }
  }
  if (ui.stats.open && now - lastStatsCards > 1000 && !$('#stats-cards').matches(':hover')) {
    lastStatsCards = now;                // not while hovering: a rebuilt link would swallow the click
    renderStatsCards();
  }
  if (world.history.t.length !== lastRecord) { lastRecord = world.history.t.length; checkPopulationNews(); }
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
    paintTerrain(true);
  },
  season(s) {                                          // midday, halfway through it; snow in winter
    world.tick = Math.round((s * S.SEASON_DAYS + 2 + 0.3) * S.TPD);
    world.snow = s === 3 ? 0.75 : 0;
    paintTerrain(true);
  },
  toScreen, toWorld,
  draw: null,                                          // (ctx, now): drawn over the meadow
} : null;

// ------------------------------------------------------------------ start

window.addEventListener('resize', () => { resize(); if (ui.stats.open) renderStats(); });
resize();
const seedParam = +new URLSearchParams(location.search).get('seed');
newWorld(seedParam || randomSeed());

let seen = false;
try { seen = localStorage.getItem('aeon-garden-welcomed') === '1'; } catch (e) { /* private window */ }
if (LAB) {
  document.body.classList.add('lab');
  setSpeed(0);
  const js = document.createElement('script');
  js.src = 'terrain-lab.js';
  document.body.append(js);
} else if (!seen) {
  $('#welcome').classList.remove('hidden');
  setSpeed(0);
}
$('#go').addEventListener('click', () => {
  $('#welcome').classList.add('hidden');
  try { localStorage.setItem('aeon-garden-welcomed', '1'); } catch (e) { /* fine */ }
  setSpeed(1);
  setTimeout(() => addNews('👋 <b>Tip:</b> click any animal to follow its life.'), 2500);
  const touch = matchMedia('(pointer: coarse)').matches;
  setTimeout(() => { if (!ui.sound) addNews(narrow() ? '🔊 <b>Tip:</b> the meadow has quiet sounds. Turn them on in ••• at the top.'
    : '🔊 <b>Tip:</b> the meadow has quiet sounds. Turn them on with 🔇 at the top right (M).'); }, 12000);
  setTimeout(() => addNews(touch ? '🌦️ <b>Tip:</b> the toolbar adds animals, grows grass and strikes lightning. The weather waits in •••.'
    : '🌦️ <b>Tip:</b> right-click the meadow to add animals, grow grass, change the weather or strike lightning. The toolbar waits at the bottom edge.'), 25000);
});

// Sound stays off until you turn it on, and remembers your choice. Browsers only let a page
// make sound after a click or key press, so a remembered "on" waits for the first one.
try { if (localStorage.getItem('aeon-garden-sound') === '1') toggleSound(true); } catch (e) { /* fine */ }

// The card remembers being small. A phone starts it small, there's not much room up there.
let mini = matchMedia('(max-width: 760px)').matches;
try { const m = localStorage.getItem('aeon-garden-mini'); if (m) mini = m === '1'; } catch (e) { /* fine */ }
if (mini) toggleMini(true);
setTimeout(() => { barNear = false; updateBar(); }, 4000);   // show the toolbar for a moment, then let the meadow breathe
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (ui.sound) Sound.start(); }, { once: true });

requestAnimationFrame(frame);
window.garden = { get world() { return world; }, ui, cam, lab };   // handy in the console
})();
