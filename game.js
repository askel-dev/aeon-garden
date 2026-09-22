/* AEON Garden — everything you see and click. The simulation lives in sim.js. */
(() => {
'use strict';
const S = window.Sim;
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const TICKS_PER_SECOND = 30;           // at 1x

// ------------------------------------------------------------------ state

let world;
const ui = {
  speed: 1, tool: 'look', selectedId: 0, hoverId: 0, follow: false,
  trail: [], effects: [], diary: new Map(),
  lastNews: {}, records: { rabbit: 0, fox: 0 }, crashSaid: { rabbit: -1, fox: -1 }, seenHistory: 0,
  releaseSex: { rabbit: 'F', fox: 'F' },
};
const cam = { x: S.W / 2, y: S.H / 2, zoom: 10, goal: null };

// ------------------------------------------------------------------ canvas and camera

const canvas = $('#world');
const ctx = canvas.getContext('2d');
let vw = 0, vh = 0, dpr = 1, minZoom = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  minZoom = Math.max(vw / S.W, vh / S.H);        // the meadow always fills the window
  cam.zoom = Math.max(cam.zoom, minZoom);
  clampCam();
  for (const s of ['rabbit', 'fox']) {
    const c = $('#spark-' + s);
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
  }
}

function clampCam() {
  const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
  cam.x = hw * 2 >= S.W ? S.W / 2 : clamp(cam.x, hw, S.W - hw);
  cam.y = hh * 2 >= S.H ? S.H / 2 : clamp(cam.y, hh, S.H - hh);
}

const toScreen = (x, y) => [(x - cam.x) * cam.zoom + vw / 2, (y - cam.y) * cam.zoom + vh / 2];
const toWorld = (sx, sy) => [(sx - vw / 2) / cam.zoom + cam.x, (sy - vh / 2) / cam.zoom + cam.y];

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

function sprite(emoji, px, tint) {
  px = Math.max(4, Math.round(px));
  const key = emoji + '|' + px + '|' + (tint || '');
  let s = spriteCache.get(key);
  if (s) return s;
  if (spriteCache.size > 2000) spriteCache.clear();
  const size = Math.ceil(px * 1.3 * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${px * dpr}px ${EMOJI_FONT}`;
  g.fillText(emoji, size / 2, size / 2 + px * dpr * 0.06);
  if (tint) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = tint;
    g.fillRect(0, 0, size, size);
  }
  s = { canvas: c, size: size / dpr };
  spriteCache.set(key, s);
  return s;
}

function drawEmoji(emoji, x, y, px, opts = {}) {
  const s = sprite(emoji, px, opts.tint);
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

// Fur colour: families share a coat, so you can spot a lineage across the meadow.
const FUR = {
  rabbit: [[255, 246, 230], [214, 178, 130], [156, 112, 78], [128, 128, 134], [78, 66, 60]],
  fox: [[245, 150, 60], [214, 92, 42], [150, 80, 52], [205, 205, 212], [255, 255, 255]],
};
function furRGB(species, f) {
  const stops = FUR[species], p = clamp(f, 0, 0.999) * (stops.length - 1);
  const i = Math.floor(p), t = p - i, a = stops[i], b = stops[i + 1];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
}
function furTint(c) {
  const q = Math.round(c.genes.fur * 10) / 10;           // a few shades keep the sprite cache small
  const [r, g, b] = furRGB(c.species, q);
  return `rgba(${r},${g},${b},0.38)`;
}
const furCss = c => `rgb(${furRGB(c.species, c.genes.fur).join(',')})`;

// ------------------------------------------------------------------ terrain

const PALETTE = [   // [bare ground, lush grass] per season
  [[214, 197, 150], [118, 196, 92]],
  [[226, 206, 142], [104, 178, 70]],
  [[216, 182, 128], [184, 170, 82]],
  [[228, 226, 218], [178, 200, 180]],
];
const terr = document.createElement('canvas');
terr.width = S.W; terr.height = S.H;
const tctx = terr.getContext('2d');
const timg = tctx.createImageData(S.W, S.H);
let jitter = new Float32Array(S.W * S.H);
let terrainTick = -1;

function paintTerrain() {
  const ck = S.clock(world);
  const sp = (ck.dayInSeason - 1 + ck.phase) / S.SEASON_DAYS;
  const t = sp > 0.8 ? (sp - 0.8) / 0.2 : 0;
  const a = PALETTE[ck.season], b = PALETTE[(ck.season + 1) % 4];
  const low = a[0].map((v, i) => lerp(v, b[0][i], t));
  const high = a[1].map((v, i) => lerp(v, b[1][i], t));
  const d = timg.data, g = world.grass, water = world.water;
  for (let i = 0; i < g.length; i++) {
    const j = jitter[i], o = i * 4;
    if (water[i]) {
      d[o] = 116 + 8 * j; d[o + 1] = 190 + 8 * j; d[o + 2] = 230 + 5 * j; d[o + 3] = 255;
      continue;
    }
    let v = clamp(g[i] / 0.85, 0, 1);
    v = v * (2 - v);
    const k = 1 + 0.035 * j;
    d[o] = lerp(low[0], high[0], v) * k;
    d[o + 1] = lerp(low[1], high[1], v) * k;
    d[o + 2] = lerp(low[2], high[2], v) * k;
    d[o + 3] = 255;
  }
  tctx.putImageData(timg, 0, 0);
  terrainTick = world.tick;
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

// ------------------------------------------------------------------ drawing

const MOVING = new Set(['wander', 'food', 'flee', 'chase', 'stalk', 'home', 'love', 'follow', 'friends']);
const ALWAYS_BUBBLE = new Set(['flee', 'chase', 'love']);

function visible(sx, sy, pad) { return sx > -pad && sy > -pad && sx < vw + pad && sy < vh + pad; }

function darkness(phase) {
  if (phase >= 0.72 || phase < 0.02) return 0.45;
  if (phase >= 0.6) return 0.45 * (phase - 0.6) / 0.12;
  if (phase < 0.1) return 0.45 * (1 - (phase - 0.02) / 0.08);
  return 0;
}

function render(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const [ox, oy] = toScreen(0, 0);
  ctx.drawImage(terr, ox, oy, S.W * cam.zoom, S.H * cam.zoom);

  const z = cam.zoom, ck = S.clock(world);

  // Flowers and tufts.
  const plantPx = z * 0.95;
  if (plantPx >= 7) {
    for (const p of world.plants) {
      const g = world.grass[p.i];
      const e = plantEmoji(ck.season, p.kind, g);
      if (!e) continue;
      const [sx, sy] = toScreen(p.x, p.y);
      if (!visible(sx, sy, plantPx)) continue;
      drawEmoji(e, sx, sy, plantPx * (0.55 + 0.45 * Math.min(1, g)), { alpha: 0.9 });
    }
  }

  // Burrows.
  for (const b of world.burrows) {
    const [sx, sy] = toScreen(b.x, b.y);
    if (!visible(sx, sy, 40)) continue;
    ctx.fillStyle = 'rgba(90, 70, 40, 0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy + z * 0.2, z * 1.1, z * 0.55, 0, 0, TAU); ctx.fill();
    drawEmoji('🕳️', sx, sy, Math.max(10, z * 1.5));
  }

  const sel = world.byId.get(ui.selectedId);
  if (sel) drawSelectionUnder(sel, now);

  // Trees, rocks and animals, back to front.
  const items = [];
  for (const d of world.decor) {
    const [sx, sy] = toScreen(d.x, d.y);
    if (visible(sx, sy, d.size * z)) items.push({ y: d.y, d, sx, sy });
  }
  const shown = [];
  for (const c of world.creatures) {
    if (c.hidden) continue;
    const [sx, sy] = toScreen(c.x, c.y);
    if (!visible(sx, sy, 60)) continue;
    const it = { y: c.y, c, sx, sy };
    items.push(it); shown.push(it);
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.d) drawEmoji(it.d.emoji, it.sx, it.sy - it.d.size * z * 0.35, it.d.size * z);
    else drawCreature(it.c, it.sx, it.sy, now);
  }

  // Dusk and night.
  const dark = darkness(ck.phase);
  if (dark > 0) {
    ctx.fillStyle = `rgba(22, 30, 78, ${dark})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (ck.phase > 0.58 && ck.phase < 0.74) {
    const a = 0.10 * Math.sin(Math.PI * (ck.phase - 0.58) / 0.16);
    ctx.fillStyle = `rgba(255, 140, 60, ${a})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (world.rain > 0) drawRain(now);

  // Burrow snores at night.
  if (ck.night && z >= 8) {
    for (const b of world.burrows) {
      if (b.count <= 0) continue;
      const [sx, sy] = toScreen(b.x, b.y);
      if (!visible(sx, sy, 40)) continue;
      const bob = Math.sin(now / 600 + b.id) * 3;
      drawEmoji('💤', sx + z * 0.8, sy - z * 1.1 + bob, Math.max(11, z * 0.8), { alpha: 0.85 });
    }
  }

  // Thought bubbles above the dark.
  for (const it of shown) {
    const c = it.c;
    const important = ALWAYS_BUBBLE.has(c.mode);
    if (!(important || c.id === ui.selectedId || c.id === ui.hoverId || z >= 20)) continue;
    const m = S.mood(world, c);
    if (m.emoji) drawBubble(m.emoji, it.sx, it.sy, creaturePx(c), important);
  }

  drawEffects(now);
  if (sel) drawSelectionOver(sel, now);
  const hov = world.byId.get(ui.hoverId);
  if (hov && hov.alive && !hov.hidden && hov.id !== ui.selectedId) {
    const [sx, sy] = toScreen(hov.x, hov.y);
    drawLabel(`${hov.name} · ${S.mood(world, hov).text}`, sx, sy + creaturePx(hov) * 0.55 + 6);
  }
}

// Grows with zoom, but never shrinks to a speck when you look at the whole meadow.
const creaturePx = c => (10 + cam.zoom * 1.4) * c.scale * (0.55 + 0.45 * S.growth(world, c));

function drawCreature(c, sx, sy, now) {
  const px = creaturePx(c);
  const fast = c.mode === 'flee' || c.mode === 'chase';
  const hop = MOVING.has(c.mode) && ui.speed > 0
    ? Math.abs(Math.sin(now / (fast ? 55 : 120) + c.id)) * px * (fast ? 0.16 : 0.1) : 0;
  ctx.fillStyle = 'rgba(40, 50, 20, 0.22)';
  ctx.beginPath(); ctx.ellipse(sx, sy + px * 0.34, px * 0.32 * (1 - hop / px), px * 0.09, 0, 0, TAU); ctx.fill();
  // The rabbit glyph faces left; the fox glyph is a face and does not care.
  drawEmoji(c.sp.emoji, sx, sy - hop, px, {
    tint: furTint(c), flip: c.species === 'rabbit' && c.facing > 0, squash: c.sleeping ? 0.82 : 1,
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
  drawEmoji(emoji, bx, by, r * 1.3);
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
  const other = world.byId.get(c.mode === 'flee' ? c.threatId : c.targetId);
  if (other && other.alive && ['flee', 'chase', 'stalk', 'love'].includes(c.mode)) {
    const [ox, oy] = toScreen(other.x, other.y);
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = c.mode === 'love' ? '#ff7aa8' : c.mode === 'flee' ? '#ff5a4a' : '#ffb13b';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.restore();
  }
  const label = c.hidden ? `${c.name} is inside the burrow` : c.name;
  drawLabel(label, sx, sy + (c.hidden ? cam.zoom : creaturePx(c) * 0.55) + 6);
}

const rainDrops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
function drawRain(now) {
  ctx.save();
  ctx.strokeStyle = 'rgba(210, 230, 255, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const d of rainDrops) {
    const y = ((d.y + now / 1400 * d.s) % 1) * vh, x = ((d.x - now / 9000) % 1 + 1) % 1 * vw;
    ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12 * d.s);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(60, 80, 120, 0.08)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.restore();
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

const NEWS_MAX = 6;
function addNews(html, category, minGapMs = 0) {
  const now = performance.now();
  if (category && minGapMs && ui.lastNews[category] && now - ui.lastNews[category] < minGapMs) return;
  if (category) ui.lastNews[category] = now;
  const box = $('#news');
  const el = document.createElement('div');
  el.className = 'news-item';
  el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > NEWS_MAX) box.lastChild.remove();
  setTimeout(() => el.classList.add('old'), 15000);
}

const link = c => c ? `<a data-id="${c.id}">${esc(c.name)}</a>` : 'someone';
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const SEASON_NEWS = [
  '🌸 <b>Spring!</b> The grass is growing and love is in the air.',
  '☀️ <b>Summer.</b> Long days and plenty to eat.',
  '🍂 <b>Autumn.</b> Grass is slowing down. Time to fatten up.',
  '❄️ <b>Winter.</b> The grass has stopped growing. Lean times ahead.',
];

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
      break;
    case 'rain':
      addNews('🌧️ <b>Rain!</b> The grass will grow three times as fast today.');
      break;
    case 'love':
      addEffect('💕', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2);
      if (mine) addNews(`💕 ${link(e.a)} and ${link(e.b)} fell in love.`);
      break;
    case 'birth': {
      addEffect('✨', e.mum.x, e.mum.y, 0.8);
      const n = e.kids.length, fox = e.mum.species === 'fox';
      const what = fox ? (n === 1 ? 'cub' : 'cubs') : (n === 1 ? 'baby' : 'babies');
      const text = `${fox ? '🦊' : '🍼'} ${link(e.mum)} had ${n} ${what}` + (e.dad ? ` with ${link(e.dad)}.` : '.');
      if (mine || fox) addNews(text);
      else addNews(text, 'birth', 9000);
      break;
    }
    case 'death': {
      const c = e.c;
      if (e.cause === 'fox') addEffect('🦴', c.x, c.y, 0.3, 1800);
      else addEffect('👻', c.x, c.y, 1.6, 2000);
      if (e.cause === 'fox') {
        const t = `🦊 ${link(e.killer)} caught ${link(c)}.`;
        if (mine) addNews(t); else addNews(t, 'catch', 7000);
      } else if (e.cause === 'hunger') {
        const t = c.species === 'fox' ? `🥀 ${link(c)} the fox starved. There weren't enough rabbits.`
          : `🥀 ${link(c)} starved.`;
        if (mine || c.species === 'fox') addNews(t); else addNews(t, 'starve', 12000);
      } else {
        const age = Math.floor(S.ageDays(world, c));
        const fam = c.kids ? `, leaving ${c.kids} ${c.kids === 1 ? 'child' : 'children'}` : '';
        const t = `🌙 Old ${link(c)} died peacefully at ${age} days${fam}.`;
        if (mine || c.kids >= 10) addNews(t); else addNews(t, 'old', 15000);
      }
      break;
    }
    case 'escape': {
      const t = e.how === 'burrow' ? `💨 ${link(e.rabbit)} dived into a burrow just before ${link(e.fox)} could pounce!`
        : `💨 ${link(e.rabbit)} outran ${link(e.fox)}!`;
      if (mine) addNews(t); else addNews(t, 'escape', 11000);
      break;
    }
    case 'extinct':
      addNews(e.species === 'rabbit' ? '😢 <b>The last rabbit is gone.</b>'
        : '😢 <b>The last fox is gone.</b> The rabbits can relax, for now.');
      break;
    case 'arrive': {
      const names = e.who.map(link).join(', ');
      addNews(e.species === 'rabbit' ? `🧳 A family of rabbits hopped in from the next valley: ${names}.`
        : `🧳 Foxes have wandered in, drawn by all the rabbits: ${names}.`);
      for (const c of e.who) addEffect('✨', c.x, c.y);
      break;
    }
  }
}

function checkPopulationNews() {
  const h = world.history, n = h.rabbit.length;
  const from = Math.max(0, Math.min(ui.seenHistory, n - 1));   // every sample since last look, even at 60x
  ui.seenHistory = n;
  for (const s of ['rabbit', 'fox']) {
    const now = world.count[s], name = s === 'rabbit' ? 'rabbits' : 'foxes';
    const fresh = Math.max(...h[s].slice(from));
    if (world.tick < S.TPD * S.SEASON_DAYS) {                 // the first spring is not news
      ui.records[s] = Math.max(ui.records[s], fresh);
    } else if (fresh > ui.records[s]) {
      if (fresh >= Math.max(s === 'rabbit' ? 20 : 8, Math.ceil(ui.records[s] * 1.12))) {
        addNews(`📈 <b>${fresh} ${name}</b>, the most this meadow has ever had!`, 'record-' + s, 20000);
      }
      ui.records[s] = fresh;
    }
    const recent = h[s].slice(Math.max(0, n - 200));            // about the last year
    const peak = Math.max(...recent);
    const season = S.seasonOf(world.tick) + 4 * S.clock(world).year;
    if (peak >= (s === 'rabbit' ? 80 : 10) && now <= peak * 0.3 && ui.crashSaid[s] !== season && now > 0) {
      ui.crashSaid[s] = season;
      addNews(`📉 <b>The ${name} are crashing</b>: ${now} left, down from ${peak}.`);
    }
  }
}

// ------------------------------------------------------------------ the meadow card

function sparkline(canvas, data, color) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const pts = data.slice(-400);
  if (pts.length < 2) return;
  const max = Math.max(4, ...pts) * 1.1;
  const x = i => (i / (pts.length - 1)) * w, y = v => h - 2 * dpr - (v / max) * (h - 4 * dpr);
  g.beginPath();
  g.moveTo(0, h);
  pts.forEach((v, i) => g.lineTo(x(i), y(v)));
  g.lineTo(w, h);
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
];
const word = (t, v) => t.words[v < 0.3 ? 0 : v < 0.45 ? 1 : v < 0.55 ? 2 : v < 0.7 ? 3 : 4];

function evolutionLine(species) {
  const base = world.founderMeans[species], now = S.traitMeans(world, species);
  const icon = species === 'rabbit' ? '🐇' : '🦊';
  if (!base || !now) return `${icon} <span style="color:var(--muted)">none alive</span>`;
  // In the first year the averages wobble with every litter: that is luck, not evolution.
  if (world.tick < S.YEAR_DAYS * S.TPD) return `${icon} <span style="color:var(--muted)">give it a year or two…</span>`;
  const shifts = TRAITS.map(t => ({ t, d: (now[t.k] - base[t.k]) / base[t.k] }))
    .filter(s => Math.abs(s.d) >= 0.05)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2);
  if (!shifts.length) return `${icon} <span style="color:var(--muted)">no big changes yet</span>`;
  return icon + ' ' + shifts.map(s => {
    const up = s.d > 0;
    return `${s.t.e} ${up ? s.t.up : s.t.down} <span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.round(Math.abs(s.d) * 100)}%</span>`;
  }).join(' · ');
}

function updateMeadowCard() {
  const ck = S.clock(world);
  $('#season-emoji').textContent = S.SEASONS[ck.season].emoji;
  $('#season-name').textContent = S.SEASONS[ck.season].name;
  $('#clock-rest').textContent = `day ${ck.dayInSeason} · year ${ck.year}`;
  $('#sun').textContent = ck.night ? '🌙' : ck.phase > 0.6 ? '🌇' : ck.phase < 0.1 ? '🌅' : '☀️';
  $('#n-rabbit').textContent = world.count.rabbit;
  $('#n-fox').textContent = world.count.fox;
  sparkline($('#spark-rabbit'), world.history.rabbit, '#a07850');
  sparkline($('#spark-fox'), world.history.fox, '#e2702f');
  $('#evo-rabbit').innerHTML = evolutionLine('rabbit');
  $('#evo-fox').innerHTML = evolutionLine('fox');
}

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
  if (!c) { box.classList.remove('open'); box.innerHTML = ''; return; }
  box.classList.add('open');
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
  if (c.gen > 1) chips.push(`🌳 Generation ${c.gen}`);
  const story = c.story.slice().reverse().slice(0, 10).map(s =>
    `<li><span>${s.emoji}</span><span>${esc(s.text)}<div class="when">${when(s.t)}</div></span></li>`).join('');
  const diary = ui.diary.get(c.id);
  const diaryHtml = diary ? (diary.loading
    ? `<div class="diary"><span class="dots">✍️ ${esc(c.name)} is writing</span></div>`
    : `<div class="diary ${diary.error ? 'err' : ''}">${esc(diary.text)}</div>`) : '';
  const living = c.alive ? '' : world.creatures.find(k => k.mumId === c.id || k.dadId === c.id);

  box.innerHTML = `
    <div class="ins-head">
      <div class="portrait" style="background:${furCss(c)}33">${c.alive ? c.sp.emoji : '👻'}</div>
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
    ${TRAITS.map(t => `<div class="trait" title="${t.tip}"><span>${t.e}</span><span>${t.name}</span>
      <div class="meter"><span style="width:${Math.round(c.genes[t.k] * 100)}%"></span></div>
      <span class="word">${word(t, c.genes[t.k])}</span></div>`).join('')}
    <h4>Family</h4>
    <div class="family">
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
    </div>`;
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
    `Personality: ${TRAITS.map(t => word(t, c.genes[t.k])).join(', ')}.`,
    `Right now: ${S.mood(world, c).text}. Tummy ${Math.round(100 * c.energy / c.maxEnergy)}% full. It is ${S.SEASONS[ck.season].name.toLowerCase()}, ${ck.night ? 'night' : 'daytime'}.`,
    `Family: mum ${mum ? mum.name + (mum.alive ? '' : ' (died)') : 'unknown'}, dad ${dad ? dad.name + (dad.alive ? '' : ' (died)') : 'unknown'}, ${c.kids} children.`,
    c.species === 'fox' ? `Rabbits caught so far: ${c.kills}.` : `Narrow escapes from foxes: ${c.escapes}.`,
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
  if (id && zoomIn && cam.zoom < 20) cam.goal = 22;
  renderInspector();
}

function creatureAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const reach = Math.max(1.4, 20 / cam.zoom);
  let best = null, bd = reach * reach;
  for (const c of world.creatures) {
    if (c.hidden) continue;
    const d = (c.x - wx) ** 2 + (c.y - (wy + 0.2)) ** 2;
    if (d < bd) { best = c; bd = d; }
  }
  return best;
}

function setTool(tool) {
  ui.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  canvas.className = 'tool-' + tool;
}

function setSpeed(s) {
  ui.speed = s;
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
}

let drag = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, paint: ui.tool === 'grass' && e.button === 0 };
  if (drag.paint) paintAt(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) {
    const c = creatureAt(e.clientX, e.clientY);
    ui.hoverId = c ? c.id : 0;
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.paint) { paintAt(e.clientX, e.clientY); return; }
  if (drag.moved) {
    canvas.classList.add('dragging');
    ui.follow = false;
    cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom;
    clampCam();
  }
});
canvas.addEventListener('pointerup', e => {
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) click(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('pointerleave', () => { ui.hoverId = 0; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const pixelPan = !e.ctrlKey && e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40);
  if (pixelPan) {                     // trackpad two-finger scroll: look around
    cam.x += e.deltaX / cam.zoom; cam.y += e.deltaY / cam.zoom;
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
  } else if (ui.tool === 'rabbit' || ui.tool === 'fox') {
    const sex = ui.releaseSex[ui.tool];
    ui.releaseSex[ui.tool] = sex === 'F' ? 'M' : 'F';
    const c = S.addCreature(world, ui.tool, wx, wy, { sex, age: world.rng.range(5, 9) });
    if (c) {
      addEffect('✨', wx, wy);
      addNews(`👋 You released ${link(c)}, a ${c.sex === 'F' ? 'female' : 'male'} ${c.sp.name.toLowerCase()}.`);
    }
  }
}

function paintAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  S.paintGrass(world, wx, wy, 3.5);
  if (Math.random() < 0.3) addEffect('🌱', wx + (Math.random() - 0.5) * 3, wy + (Math.random() - 0.5) * 3, 0.6, 900);
  terrainTick = -1;
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tool],[data-speed],[data-action],[data-act],a[data-id]');
  if (!t) return;
  if (t.dataset.tool) setTool(t.dataset.tool);
  else if (t.dataset.speed !== undefined) setSpeed(+t.dataset.speed);
  else if (t.dataset.action === 'rain') { S.startRain(world); }
  else if (t.dataset.action === 'new') { if (confirm('Start a brand-new meadow? This one will be gone.')) newWorld(randomSeed()); }
  else if (t.dataset.act === 'close') select(0);
  else if (t.dataset.act === 'follow') { ui.follow = !ui.follow; renderInspector(); }
  else if (t.dataset.act === 'diary') { const c = world.byId.get(ui.selectedId); if (c) writeDiary(c); }
  else if (t.dataset.id) {
    const c = world.byId.get(+t.dataset.id);
    if (c) select(c.id);
  }
});

let lastSpeed = 1;
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (ui.speed) { lastSpeed = ui.speed; setSpeed(0); } else setSpeed(lastSpeed);
  } else if ('1234'.includes(e.key) && e.key.length === 1) setSpeed([1, 4, 15, 60][+e.key - 1]);
  else if (e.key === 'Escape') select(0);
  else if (e.key === 'f' && ui.selectedId) { ui.follow = !ui.follow; renderInspector(); }
  else if (e.key === 'l') setTool('look');
  else if (e.key === '+' || e.key === '=') zoomAt(vw / 2, vh / 2, cam.zoom * 1.25);
  else if (e.key === '-') zoomAt(vw / 2, vh / 2, cam.zoom / 1.25);
});

// ------------------------------------------------------------------ the loop

function randomSeed() { return Math.floor(Math.random() * 1e6); }

function newWorld(seed) {
  world = S.createWorld(seed);
  jitter = Float32Array.from({ length: S.W * S.H }, () => Math.random() * 2 - 1);
  Object.assign(ui, { selectedId: 0, hoverId: 0, follow: false, trail: [], effects: [], lastNews: {} });
  ui.records = { rabbit: world.count.rabbit, fox: world.count.fox };
  ui.crashSaid = { rabbit: -1, fox: -1 };
  ui.seenHistory = 0;
  $('#news').innerHTML = '';
  cam.zoom = minZoom; cam.x = S.W / 2; cam.y = S.H / 2; cam.goal = null;
  clampCam();
  paintTerrain();
  renderInspector();
  updateMeadowCard();
  addNews(`🌱 A new meadow. <b>${world.count.rabbit} rabbits</b> and <b>${world.count.fox} foxes</b> have just moved in.`);
  history.replaceState(null, '', '?seed=' + seed);
}

let last = performance.now(), acc = 0, lastCard = 0, lastRecord = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (ui.speed > 0) {
    acc += dt * TICKS_PER_SECOND * ui.speed;
    const n = Math.min(Math.floor(acc), 2000);
    acc -= n;
    for (let i = 0; i < n; i++) {
      S.step(world);
      if (world.events.length) { for (const e of world.events) handleEvent(e); world.events.length = 0; }
    }
  }

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
    cam.x += (sel.x - cam.x) * k; cam.y += (sel.y - cam.y) * k;
  }
  if (cam.goal) {
    const k = 1 - Math.pow(0.01, dt);
    cam.zoom += (cam.goal - cam.zoom) * k;
    if (Math.abs(cam.goal - cam.zoom) < 0.05) cam.goal = null;
    cam.zoom = Math.max(cam.zoom, minZoom);
  }
  clampCam();

  if (world.tick - terrainTick >= 12 || terrainTick < 0) paintTerrain();
  render(now);

  if (now - lastCard > 250) {
    lastCard = now;
    updateMeadowCard();
    if (ui.selectedId && !$('#inspector').matches(':hover')) renderInspector();
  }
  if (world.history.t.length !== lastRecord) { lastRecord = world.history.t.length; checkPopulationNews(); }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start

window.addEventListener('resize', resize);
resize();
const seedParam = +new URLSearchParams(location.search).get('seed');
newWorld(seedParam || randomSeed());

let seen = false;
try { seen = localStorage.getItem('aeon-garden-welcomed') === '1'; } catch (e) { /* private window */ }
if (!seen) {
  $('#welcome').classList.remove('hidden');
  setSpeed(0);
}
$('#go').addEventListener('click', () => {
  $('#welcome').classList.add('hidden');
  try { localStorage.setItem('aeon-garden-welcomed', '1'); } catch (e) { /* fine */ }
  setSpeed(1);
  setTimeout(() => addNews('👋 <b>Tip:</b> click any animal to follow its life.'), 2500);
  setTimeout(() => addNews('🌧️ <b>Tip:</b> the tools at the bottom let you add animals, grow grass or make it rain.'), 25000);
});

requestAnimationFrame(frame);
window.garden = { get world() { return world; }, ui, cam };   // handy in the console
})();
