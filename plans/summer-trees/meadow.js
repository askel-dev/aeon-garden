/* Nobody's Meadow — the meadow's rocks and flowers, lifted out of game.js as they are there (only the bits that read the live
 * world are cut: a rock is told how wooded its spot is instead of looking it up, and nothing counts painting time).
 * Loaded after fur.js, whose drawing helpers it paints with.
 *
 * Meadow.rock(d, U): a rock's sprite, d = { x, y, size, big?, stone?, wood? } (where it lies picks its stones, colour
 * and moss), U px to a rock unit. Its foot is at ROCK_FOOT of the way down, in the middle.
 * Meadow.flower(art, v, U): one clump of flowers or ground cover, art an index into FLOWER_ARTS, v its variant 0..4,
 * U px a plant. Its foot is at FLOWER_FOOT of the way down, in the middle.
 * Meadow.paintOldStone(g, size, U, n): the old stone that tastes your cooking, in mood n >> 1 (STONE_MOODS), talking if n & 1.
 */
(root => {
'use strict';
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, softIn, furGlow } = root.Fur;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const SNOW_RGB = [244, 248, 252];
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function softSpot(g, x, y, rx, ry, rgb, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb}, ${a})`); r.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ flowers (game.js)

const FLOWER_ARTS = [paintTulips, paintBlossom, paintButtercups, paintSunflowers, paintBluebells, paintHeather, paintAsters,
  paintTuft, paintTuftAutumn, paintSprout, paintFallenLeaves, paintSeedHeads, paintTuftFrost];   // (7 to 12: the ground cover)
const FLOWER_VARIANTS = 5;
const FLOWER_BOX = [1.6, 1.8], FLOWER_FOOT = 0.82;   // a sprite in plant sizes, and where the ground is in it, from the top
const FLOWER_MAX_K = 15;                            // painted at most 2^7.5 = 181 px a plant, stretched past that


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


// ------------------------------------------------------------------ rocks (game.js; rockKind is sim.js's)

// alike (see blankCreature), with room for the fish about it should otters make their holt under it (holtFish).
const rockOf = (x, y, size, big = false, stone = false) => ({ x, y, emoji: '🪨', size, big, stone, holtFish: NaN });
// What a rock is, from where it lies and its size alone (game.js paints it so): a ford's flat stone, a great rock, or, the
// bigger the likelier the later, a few pebbles, a stone or a boulder.
function rockKind(d) {
  if (d.stone) return 'ford';
  if (d.big) return 'great';
  const h = hash2(Math.floor(d.x * 100), Math.floor(d.y * 100), 60), grown = clamp((d.size - 0.7) / 1.6, 0, 1);
  return h < 0.45 - 0.3 * grown ? 'pebbles' : h < 0.85 - 0.35 * grown ? 'stone' : 'boulder';
}

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
  const wood = d.wood || 0;                                 // (the game reads how wooded the spot is from the world)
  const kind = rockKind(d);                              // (the sim knows too: the forager walks round all but pebbles)
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
  const c = t.sprite || document.createElement('canvas');
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
  return c;
}

// While the zoom moves, a rock painted at about this size is stretched rather than painted again;
// it's painted sharp once the zoom comes to rest (groundStill). Its snow is painted once, the first

// ------------------------------------------------------------------ the old stone (game.js): paintOldStone(g, size, U, n), n = mood * 2 + talking

const STONE_MOODS = ['asleep', 'awake', 'pleased', 'grumpy', 'disgusted', 'delighted', 'shocked'];
const STONE_FOOT = 0.92;                 // where its foot is in its painting (of its half-size, down from the middle)
const STONE_RGB = [152, 147, 136], MOSS = [104, 138, 62];
function paintOldStone(g, size, U, n) {
  const mood = STONE_MOODS[n >> 1], talk = n & 1;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const foot = STONE_FOOT, top = -1.12;
  const body = () => {
    g.moveTo(-0.52, foot);
    g.bezierCurveTo(-0.64, 0.3, -0.58, -0.62, -0.36, -0.98);
    g.quadraticCurveTo(-0.06, top - 0.1, 0.3, -1.02);
    g.bezierCurveTo(0.56, -0.66, 0.64, 0.2, 0.54, foot);
    g.quadraticCurveTo(0.01, foot + 0.07, -0.52, foot);
  };
  furGlow(g, [40, 34, 26], 0.5, 0.06, foot + 0.02, 0.8, 0.16);                                      // its shadow on the ground
  softIn(g, STONE_RGB, top, foot, body, 1.22, 0.62);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, tone(STONE_RGB, 0.45), 0.6, 0.55, 0.1, 0.35, 1.3);                                     // round: its shade side
  furGlow(g, [255, 246, 222], 0.28, -0.32, -0.5, 0.2, 0.6);                                         // and the light on the other
  for (const [x, y, r, c] of [[-0.34, 0.5, 0.07, [214, 176, 70]], [-0.26, 0.6, 0.045, [214, 176, 70]], [0.3, 0.38, 0.06, [168, 186, 120]],
    [0.36, -0.62, 0.05, [214, 176, 70]], [-0.4, -0.2, 0.04, [168, 186, 120]], [0.1, 0.72, 0.08, [168, 186, 120]]])   // lichen
    fillIn(g, rockRGB(c, 0.7), () => { ovalAt(g, x, y, r, r * 0.8); ovalAt(g, x + r * 0.9, y + r * 0.4, r * 0.6, r * 0.5); });
  strokeIn(g, rockRGB(tone(STONE_RGB, 0.42), 0.6), 0.02, () => {                                    // cracks
    g.moveTo(0.22, 0.95); g.lineTo(0.18, 0.7); g.lineTo(0.26, 0.55);
    g.moveTo(-0.5, -0.5); g.lineTo(-0.38, -0.56);
  });
  fillIn(g, rockRGB(tone(MOSS, 0.7), 0.85), () => { ovalAt(g, -0.3, foot - 0.02, 0.26, 0.1); ovalAt(g, 0.32, foot, 0.2, 0.08); });   // moss round its foot
  g.restore();
  // its moss: a comb-over on top, a strand flopping down one side
  const tuft = () => { ovalAt(g, -0.2, -1.0, 0.24, 0.13, -0.3); ovalAt(g, 0.06, -1.08, 0.26, 0.13); ovalAt(g, 0.3, -0.98, 0.18, 0.11, 0.4); ovalAt(g, 0.42, -0.84, 0.1, 0.16, 0.3); };
  softIn(g, MOSS, -1.2, -0.75, tuft, 1.3, 0.7);
  strokeIn(g, rockRGB(tone(MOSS, 0.85)), 0.07, () => { g.moveTo(0.4, -0.86); g.quadraticCurveTo(0.6, -0.7, 0.55, -0.48); });
  fillIn(g, rockRGB(tone(MOSS, 1.35, 16), 0.7), () => { ovalAt(g, -0.12, -1.07, 0.08, 0.035, -0.3); ovalAt(g, 0.12, -1.13, 0.07, 0.03); });
  // the face
  const ey = -0.36, ex = 0.2, dark = 'rgba(40, 32, 26, 1)';
  if (mood === 'pleased' || mood === 'delighted') for (const s of [-1, 1]) furGlow(g, [230, 120, 110], 0.4, s * 0.32, 0.0, 0.12, 0.07);   // blushing
  softIn(g, tone(STONE_RGB, 1.08), -0.3, 0.05, () => ovalAt(g, 0.0, -0.1, 0.13, 0.17), 1.25, 0.75);   // its nose, a big potato of a knob
  furGlow(g, tone(STONE_RGB, 0.4), 0.5, 0.02, 0.07, 0.14, 0.04);
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (mood === 'asleep') { strokeIn(g, dark, 0.035, () => g.ellipse(x, ey - 0.02, 0.08, 0.05, 0, 0.15, Math.PI - 0.15)); continue; }
    if (mood === 'delighted') { strokeIn(g, dark, 0.04, () => g.ellipse(x, ey + 0.03, 0.08, 0.07, 0, Math.PI + 0.2, -0.2)); continue; }
    const big = mood === 'shocked' ? 1.3 : 1, look = mood === 'disgusted' ? -0.025 : 0;
    fillIn(g, 'rgba(250, 246, 234, 1)', () => ovalAt(g, x, ey, 0.085 * big, 0.075 * big));
    fillIn(g, dark, () => discAt(g, x + look, ey + 0.008, mood === 'shocked' ? 0.03 : 0.042));
    fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, x + look - 0.014, ey - 0.012, 0.012));
    if (mood === 'grumpy' || mood === 'disgusted') {          // heavy lids
      const lid = mood === 'grumpy' ? 0.03 : s < 0 ? 0.035 : -0.01;
      fillIn(g, rockRGB(tone(STONE_RGB, 0.95)), () => { g.moveTo(x - 0.1, ey - 0.09); g.lineTo(x + 0.1, ey - 0.09); g.lineTo(x + 0.1, ey + lid); g.quadraticCurveTo(x, ey + lid + 0.02, x - 0.1, ey + lid); });
      strokeIn(g, dark, 0.02, () => { g.moveTo(x - 0.09, ey + lid); g.quadraticCurveTo(x, ey + lid + 0.02, x + 0.09, ey + lid); });
    }
  }
  // the brows, bushy moss, set by the mood (inner end's height, outer end's)
  const BROWS = { asleep: [0.0, 0.0], awake: [-0.02, 0.0], pleased: [-0.06, -0.02], grumpy: [0.06, -0.06], disgusted: [0.02, -0.08], delighted: [-0.08, -0.03], shocked: [-0.12, -0.12] };
  const [bin, bout] = BROWS[mood];
  for (const s of [-1, 1]) {
    const yIn = ey - 0.15 + (mood === 'disgusted' && s > 0 ? -0.08 : bin), yOut = ey - 0.16 + bout;
    strokeIn(g, rockRGB(tone(MOSS, 0.75)), 0.075, () => { g.moveTo(s * 0.07, yIn); g.quadraticCurveTo(s * 0.18, Math.min(yIn, yOut) - 0.04, s * 0.31, yOut); });
    strokeIn(g, rockRGB(tone(MOSS, 1.3, 14), 0.7), 0.025, () => { g.moveTo(s * 0.1, yIn - 0.02); g.quadraticCurveTo(s * 0.18, Math.min(yIn, yOut) - 0.05, s * 0.28, yOut - 0.02); });
  }
  // the mouth
  const my = 0.2;
  if (talk || mood === 'shocked') {
    const h = mood === 'shocked' ? 0.1 : mood === 'delighted' ? 0.09 : 0.065, w = mood === 'shocked' ? 0.07 : 0.11;
    fillIn(g, 'rgba(58, 30, 26, 1)', () => ovalAt(g, 0, my, w, h));
    fillIn(g, 'rgba(196, 96, 92, 1)', () => ovalAt(g, 0, my + h * 0.5, w * 0.6, h * 0.35));
    strokeIn(g, rockRGB(tone(STONE_RGB, 0.5)), 0.018, () => ovalAt(g, 0, my, w, h));
  } else if (mood === 'asleep') {
    strokeIn(g, dark, 0.03, () => { g.moveTo(-0.07, my); g.quadraticCurveTo(0, my + 0.03, 0.07, my); });
    fillIn(g, 'rgba(160, 200, 230, 0.8)', () => ovalAt(g, 0.06, my + 0.05, 0.018, 0.03));       // a little drool
  } else {
    const curve = { awake: 0.02, pleased: 0.08, delighted: 0.12, grumpy: -0.07, disgusted: -0.04 }[mood];
    strokeIn(g, dark, 0.035, () => {
      if (mood === 'disgusted') { g.moveTo(-0.13, my + 0.02); g.quadraticCurveTo(-0.05, my - 0.04, 0, my + 0.01); g.quadraticCurveTo(0.06, my + 0.05, 0.13, my - 0.03); return; }
      g.moveTo(-0.14, my); g.quadraticCurveTo(0, my + curve * 1.6, 0.14, my);
    });
    if (mood === 'delighted') fillIn(g, 'rgba(58, 30, 26, 1)', () => { g.moveTo(-0.12, my + 0.01); g.quadraticCurveTo(0, my + 0.2, 0.12, my + 0.01); g.closePath(); });
  }
}

function flower(art, v, U) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(U * FLOWER_BOX[0]); c.height = Math.ceil(U * FLOWER_BOX[1]);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height * FLOWER_FOOT); g.scale(U, U);
  g.lineCap = 'round'; g.lineJoin = 'round';
  softSpot(g, 0, 0.02, 0.34, 0.11, '34, 44, 14', 0.35);
  const r = n => hash2(art * 8 + v, 29, n), bold = 1 + 0.4 * clamp((36 - U) / 28, 0, 1);
  FLOWER_ARTS[art](g, r, v, bold, Math.max(0.022, 1 / U));
  return c;
}
const rock = (d, U) => rockSprite(rockInfo(d), U, false);

root.Meadow = { rock, flower, paintOldStone, STONE_MOODS, rockKind, FLOWER_ARTS, FLOWER_BOX, FLOWER_FOOT, ROCK_FOOT };
})(typeof window !== 'undefined' ? window : globalThis);
