// Concepts for the camp's basket and fire pit, painted to the rack and lean-to's level (2026-10-21). Same signature and
// box as game.js paintBasket / paintFire (g, size, U, n), so either could be dropped in: the basket's foot at 0.6, the
// fire's ground at 0.25, its ring 0.6 by 0.26. Uses only fur.js's helpers and a few copied from game.js.
(root => {
'use strict';
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, softIn, furGlow } = root.Fur;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
const INK = [74, 50, 30];                 // the rack's ink, for the same soft edge

// ------------------------------------------------------------------ the basket
//
// A round-bellied willow basket in the camp's three-quarter view: upright stakes, the weavers going over one and under the
// next so each row is a string of little lit bulges, a thick plaited border, a darker foot, two twisted handles. Shut, a
// low domed lid woven round from its middle and a loop to lift it by; open, the lid leans on its back and the food is
// heaped in it.
const WILLOW = [190, 138, 78], WILLOW_PALE = [222, 182, 120];
const FOOT = 0.6;
function paintBasket(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const top = -0.12, rx = 0.62, ry = 0.2, bot = FOOT - 0.07, bx = 0.48, by = 0.12, open = n === 1;
  // A point on the basket's wall: a its angle round (0 its right, PI/2 straight at us, PI its left), v from the rim (0) to the foot (1).
  const wall = (a, v) => {
    const belly = Math.sin(v * Math.PI) * 0.06, r = lerp(rx, bx, v * v) + belly;
    const cy = lerp(top, bot, v), ery = lerp(ry, by, v);
    return [Math.cos(a) * r, cy + Math.sin(a) * ery];
  };
  const body = () => {
    g.moveTo(...wall(0, 0));
    for (let i = 1; i <= 16; i++) g.lineTo(...wall(0, i / 16));
    for (let i = 1; i <= 24; i++) g.lineTo(...wall(i / 24 * Math.PI, 1));
    for (let i = 15; i >= 0; i--) g.lineTo(...wall(Math.PI, i / 16));
    for (let i = 23; i >= 1; i--) g.lineTo(...wall(i / 24 * Math.PI, 0));
    g.closePath();
  };
  // Its shadow, soft under it and leaning off to the right, out of the light.
  furGlow(g, [40, 28, 14], 0.42, 0.08, bot + 0.04, 0.78, 0.16, 0, 0.3);
  if (open) {
    // The lid stood on its edge behind it, leaning on the back of the rim.
    g.save(); g.translate(0.2, top - 0.3); g.rotate(-0.12);
    const lr = 0.52, lry = 0.4;
    fillIn(g, rockRGB(INK, 0.5), () => ovalAt(g, 0.02, 0.02, lr + 0.035, lry + 0.035));
    softIn(g, tone(WILLOW, 0.92), -lry, lry, () => ovalAt(g, 0, 0, lr, lry), 1.12, 0.7);
    lidWeave(g, 0, 0, lr, lry, 0.85);
    strokeIn(g, rockRGB(tone(WILLOW_PALE, 0.95)), 0.05, () => ovalAt(g, 0, 0, lr - 0.01, lry - 0.01));
    plait(g, (t) => [Math.cos(t * TAU) * (lr - 0.01), Math.sin(t * TAU) * (lry - 0.01)], 26, 0.022, 0.9);
    furGlow(g, [40, 26, 12], 0.4, 0.15, 0.25, lr * 0.8, lry * 0.6);
    g.restore();
    // The dark inside and the back of its wall, the inside of the far wall lit a little.
    fillIn(g, rockRGB(tone(WILLOW, 0.3)), () => ovalAt(g, 0, top, rx, ry));
    g.save(); g.beginPath(); ovalAt(g, 0, top, rx, ry); g.clip();
    furGlow(g, tone(WILLOW, 0.75), 0.6, -0.1, top - ry * 0.7, rx * 0.8, ry * 0.5);
    g.restore();
    heap(g, top, rx, ry);
  }
  // The wall: shaded round from the light on its left to the shade on its right, then woven.
  { const gr = g.createLinearGradient(-rx, 0, rx, 0);
    gr.addColorStop(0, rockRGB(tone(WILLOW, 0.86))); gr.addColorStop(0.28, rockRGB(tone(WILLOW, 1.16, 10))); gr.addColorStop(0.62, rockRGB(WILLOW)); gr.addColorStop(1, rockRGB(tone(WILLOW, 0.5)));
    fillIn(g, rockRGB(INK, 0.8), () => { g.save(); g.translate(0, 0.012); g.scale(1.02, 1); body(); g.restore(); });
    g.fillStyle = gr; g.beginPath(); body(); g.fill(); }
  g.save(); g.beginPath(); body(); g.clip();
  const STAKES = 15, ROWS = 9;
  for (let r = 0; r < ROWS; r++) {                          // the weavers, row by row: in front of a stake, behind the next
    const v0 = 0.08 + r / ROWS * 0.82, v1 = v0 + 0.82 / ROWS;
    for (let i = 0; i < STAKES; i++) {
      if ((i + r) % 2) continue;
      const a0 = (i + 0.08) / STAKES * Math.PI, a1 = (i + 1.92) / STAKES * Math.PI, side = Math.cos((a0 + a1) / 2);
      const lit = 1.08 - 0.42 * Math.max(0, side) + 0.12 * Math.max(0, -side) - 0.05 * hash2(r, i, 401);
      const rgb = tone(WILLOW, lit * (0.92 + 0.14 * hash2(i, r, 403)));
      const band = (va, vb) => { for (let k = 0; k <= 6; k++) { const a = lerp(a0, a1, k / 6); g.lineTo(...wall(a, lerp(va, vb, Math.sin(k / 6 * Math.PI) * 0.12 + 0.0))); } };
      const path = () => {
        g.moveTo(...wall(a0, (v0 + v1) / 2));
        for (let k = 0; k <= 8; k++) { const t = k / 8, a = lerp(a0, a1, t), bulge = Math.sin(t * Math.PI); g.lineTo(...wall(a, lerp(v0 + 0.02, (v0 + v1) / 2, 1 - bulge))); }
        for (let k = 8; k >= 0; k--) { const t = k / 8, a = lerp(a0, a1, t), bulge = Math.sin(t * Math.PI); g.lineTo(...wall(a, lerp(v1 - 0.01, (v0 + v1) / 2, 1 - bulge))); }
        g.closePath();
      };
      const [, ya] = wall((a0 + a1) / 2, v0), [, yb] = wall((a0 + a1) / 2, v1);
      softIn(g, rgb, ya, yb, path, 1.3, 0.62);
      strokeIn(g, rockRGB(tone(WILLOW_PALE, 1.1, 20), 0.55 * (1 - 0.7 * Math.max(0, side))), 0.012, () => {   // the light along its top
        g.moveTo(...wall(lerp(a0, a1, 0.2), lerp(v0, v1, 0.32)));
        for (let k = 1; k <= 6; k++) g.lineTo(...wall(lerp(a0, a1, 0.2 + 0.6 * k / 6), lerp(v0, v1, 0.32 - 0.12 * Math.sin(k / 6 * Math.PI))));
      });
      void band;
    }
    // where the row goes behind the stakes: a thin dark gap under it
    strokeIn(g, rockRGB(tone(WILLOW, 0.35), 0.45), 0.01, () => { g.moveTo(...wall(0, v1)); for (let k = 1; k <= 24; k++) g.lineTo(...wall(k / 24 * Math.PI, v1)); });
  }
  for (let i = 0; i <= STAKES; i++) {                       // the stakes, where they show between the weavers
    const a = i / STAKES * Math.PI;
    strokeIn(g, rockRGB(tone(WILLOW, 0.6), 0.5), 0.016, () => { g.moveTo(...wall(a, 0)); for (let k = 1; k <= 10; k++) g.lineTo(...wall(a, k / 10)); });
  }
  furGlow(g, [60, 36, 16], 0.5, 0, top + ry * 0.9, rx * 1.1, 0.07);    // the rim's shadow on the wall under it
  furGlow(g, [70, 42, 18], 0.4, 0, bot + 0.02, bx * 1.1, 0.09);        // the shade low down where it turns under
  furGlow(g, [255, 238, 200], 0.22, -rx * 0.42, (top + bot) / 2, 0.14, 0.3);
  g.restore();
  // The foot: a darker border of rods twisted round its base.
  plait(g, t => wall(Math.PI * (1 - t), 0.97), 22, 0.024, 0.7);
  // The border: a thick plait round the rim, its back half too when it's open.
  const rim = (a0, a1, many) => plait(g, t => { const a = lerp(a0, a1, t); return [Math.cos(a) * (rx + 0.01), top + Math.sin(a) * (ry + 0.005)]; }, many, 0.05, 1);
  if (open) rim(TAU, Math.PI, 26);
  // The handles: two rods twisted together, looped from the border.
  for (const s of [-1, 1]) {
    const x0 = s * (rx - 0.04), y0 = top + 0.07, loop = t => { const a = lerp(-0.3, Math.PI + 0.3, t); return [x0 + s * Math.sin(a) * 0.11, y0 - 0.02 + Math.cos(a) * -0.09 + 0.09]; };
    plait(g, loop, 9, 0.022, s < 0 ? 1.05 : 0.75);
  }
  if (!open) {
    // The lid: a low dome over the rim, its edge's thickness showing at the front, woven round from the middle.
    const ly = top - 0.05, lr = rx + 0.04, lry = ry + 0.04, dome = 0.09;
    const lid = () => { g.moveTo(-lr, ly); g.ellipse(0, ly, lr, lry, 0, Math.PI, 0, true); g.ellipse(0, ly - dome * 0.4, lr, lry + dome, 0, 0, Math.PI, true); g.closePath(); };
    fillIn(g, rockRGB(INK, 0.8), () => { g.save(); g.translate(0, 0.014); lid(); g.restore(); });
    { const gr = g.createLinearGradient(-lr, ly - lry - dome, lr, ly + lry);
      gr.addColorStop(0, rockRGB(tone(WILLOW, 1.18, 12))); gr.addColorStop(0.5, rockRGB(WILLOW)); gr.addColorStop(1, rockRGB(tone(WILLOW, 0.55)));
      g.fillStyle = gr; g.beginPath(); lid(); g.fill(); }
    g.save(); g.beginPath(); lid(); g.clip();
    lidWeave(g, 0, ly - dome * 0.55, lr, lry + dome * 0.5, 1);
    furGlow(g, [60, 36, 16], 0.38, lr * 0.4, ly + 0.02, lr * 0.7, lry * 0.8);
    furGlow(g, [255, 240, 210], 0.3, -lr * 0.35, ly - lry - dome * 0.2, lr * 0.4, lry * 0.4, -0.2);
    g.restore();
    plait(g, t => { const a = lerp(0, Math.PI, t); return [Math.cos(a) * lr, ly + Math.sin(a) * lry]; }, 24, 0.045, 1);
    // The loop to lift it by, standing up from its middle, and its shadow on the lid.
    const kx = 0, ky = ly - dome * 0.6;
    furGlow(g, [50, 30, 12], 0.45, kx + 0.05, ky + 0.02, 0.1, 0.035);
    plait(g, t => { const a = lerp(Math.PI * 0.95, Math.PI * 0.05, t); return [kx + Math.cos(a) * 0.08, ky + 0.01 - Math.sin(a) * 0.1]; }, 7, 0.024, 1);
  } else rim(0, Math.PI, 26);
}
// A plaited rod along a path (at(t), t 0 to 1): many short slanted lit bumps, inked under, as the rack's lashings are.
function plait(g, at, many, w, lit) {
  const pts = []; for (let i = 0; i <= 40; i++) pts.push(at(i / 40));
  const line = () => { g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); };
  strokeIn(g, rockRGB(INK, 0.45), w * 2 + 0.014, line);
  strokeIn(g, rockRGB(tone(WILLOW, 0.82 * lit)), w * 2, line);
  for (let i = 0; i < many; i++) {
    const t = (i + 0.5) / many, [x, y] = at(t), [x1, y1] = at(Math.min(1, t + 0.01)), a = Math.atan2(y1 - y, x1 - x) + 0.8;
    const c = Math.cos(a) * w * 1.05, s = Math.sin(a) * w * 1.05;
    strokeIn(g, rockRGB(tone(WILLOW, 0.66 * lit), 0.55), w * 0.8, () => { g.moveTo(x - c, y - s + w * 0.12); g.lineTo(x + c, y + s + w * 0.12); });
    strokeIn(g, rockRGB(tone(WILLOW_PALE, 1.02 * lit, 6)), w * 0.62, () => { g.moveTo(x - c * 0.85, y - s * 0.85); g.lineTo(x + c * 0.85, y + s * 0.85); });
    strokeIn(g, 'rgba(255, 244, 214, 0.55)', w * 0.2, () => { g.moveTo(x - c * 0.6 - w * 0.12, y - s * 0.6 - w * 0.2); g.lineTo(x + c * 0.3 - w * 0.12, y + s * 0.3 - w * 0.2); });
  }
}
// The lid's weave: spokes out from its middle, rings of weavers round them in front of one spoke and behind the next.
function lidWeave(g, cx, cy, rx, ry, k) {
  const SPOKES = 16, RINGS = 6;
  strokeIn(g, rockRGB(tone(WILLOW, 0.55), 0.35), 0.01, () => { for (let i = 0; i < SPOKES; i++) { const a = i / SPOKES * TAU; g.moveTo(cx + Math.cos(a) * rx * 0.14, cy + Math.sin(a) * ry * 0.14); g.lineTo(cx + Math.cos(a) * rx * 0.98, cy + Math.sin(a) * ry * 0.98); } });
  for (let r = 0; r < RINGS; r++) {
    const f0 = 0.16 + r / RINGS * 0.82, f1 = f0 + 0.82 / RINGS;
    for (let i = 0; i < SPOKES; i++) {
      if ((i + r) % 2) continue;
      const a0 = (i + 0.1) / SPOKES * TAU, a1 = (i + 1.9) / SPOKES * TAU;
      const P = (a, f) => [cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f];
      const path = () => {
        g.moveTo(...P(a0, (f0 + f1) / 2));
        for (let j = 0; j <= 8; j++) { const t = j / 8, b = Math.sin(t * Math.PI); g.lineTo(...P(lerp(a0, a1, t), lerp((f0 + f1) / 2, f0 + 0.01, b))); }
        for (let j = 8; j >= 0; j--) { const t = j / 8, b = Math.sin(t * Math.PI); g.lineTo(...P(lerp(a0, a1, t), lerp((f0 + f1) / 2, f1 - 0.01, b))); }
        g.closePath();
      };
      const m = (a0 + a1) / 2, lit = (1.05 - 0.3 * Math.cos(m - 0.8) * 0.5 + 0.1 * hash2(i, r, 409)) * k;   // (lit from the top left)
      const [, y0] = P(m, f0), [, y1] = P(m, f1);
      softIn(g, tone(WILLOW, lit), Math.min(y0, y1) - 0.02, Math.max(y0, y1) + 0.02, path, 1.25, 0.7);
    }
  }
  fillIn(g, rockRGB(tone(WILLOW, 0.8 * k)), () => ovalAt(g, cx, cy, rx * 0.15, ry * 0.15));
}
// What's heaped in the open basket: leaves under, apples, ceps, a bunch of blackberries, hazelnuts, back to front.
function heap(g, top, rx, ry) {
  const leaf = (x, y, r, a, rgb) => {
    const path = () => { g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.quadraticCurveTo(x - Math.sin(a) * r * 0.45, y + Math.cos(a) * r * 0.45, x + Math.cos(a) * r, y + Math.sin(a) * r); g.quadraticCurveTo(x + Math.sin(a) * r * 0.45, y - Math.cos(a) * r * 0.45, x - Math.cos(a) * r, y - Math.sin(a) * r); };
    softIn(g, rgb, y - r * 0.5, y + r * 0.5, path, 1.25, 0.7);
    strokeIn(g, rockRGB(tone(rgb, 1.35, 20), 0.6), 0.008, () => { g.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); });
  };
  const apple = (x, y, r) => {
    furGlow(g, [30, 14, 8], 0.5, x + r * 0.2, y + r * 0.6, r * 1.1, r * 0.4);
    fillIn(g, rockRGB([110, 20, 20], 0.9), () => discAt(g, x, y + 0.006, r + 0.008));
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05);
    gr.addColorStop(0, 'rgb(246, 116, 84)'); gr.addColorStop(0.5, 'rgb(204, 40, 32)'); gr.addColorStop(1, 'rgb(118, 16, 22)');
    g.fillStyle = gr; g.beginPath(); discAt(g, x, y, r); g.fill();
    furGlow(g, [214, 190, 70], 0.45, x - r * 0.5, y + r * 0.4, r * 0.4, r * 0.3);
    fillIn(g, 'rgba(255, 255, 255, 0.85)', () => ovalAt(g, x - r * 0.4, y - r * 0.42, r * 0.16, r * 0.08, -0.7));
    strokeIn(g, 'rgb(96, 64, 36)', 0.014, () => { g.moveTo(x + 0.005, y - r * 0.8); g.lineTo(x + 0.025, y - r * 1.15); });
  };
  const cep = (x, y, r) => {
    furGlow(g, [30, 14, 8], 0.45, x + r * 0.2, y + r * 0.5, r * 1.1, r * 0.35);
    softIn(g, [236, 224, 200], y - r * 0.2, y + r * 0.6, () => ovalAt(g, x + r * 0.15, y + r * 0.25, r * 0.42, r * 0.4), 1.1, 0.75);
    fillIn(g, rockRGB([210, 192, 130]), () => ovalAt(g, x, y + r * 0.02, r * 0.92, r * 0.3));
    fillIn(g, rockRGB([84, 50, 26]), () => { g.moveTo(-r + x - 0.008, y); g.ellipse(x, y, r + 0.008, r * 0.72 + 0.008, 0, Math.PI, 0); g.closePath(); });
    softIn(g, [150, 92, 48], y - r * 0.72, y, () => { g.moveTo(x - r, y); g.ellipse(x, y, r, r * 0.72, 0, Math.PI, 0); g.closePath(); }, 1.3, 0.66);
    furGlow(g, [255, 236, 204], 0.55, x - r * 0.3, y - r * 0.45, r * 0.38, r * 0.2, -0.3);
  };
  const berries = (x, y, r) => {
    furGlow(g, [20, 8, 14], 0.5, x + r * 0.2, y + r * 0.6, r * 1.2, r * 0.4);
    for (let i = 0; i < 9; i++) {
      const a = hash2(i, 1, 413) * TAU, d = Math.sqrt(hash2(i, 2, 417)) * r * 0.7, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d * 0.7, br = r * 0.36;
      softIn(g, [52, 24, 56], by - br, by + br, () => discAt(g, bx, by, br), 1.6, 0.5);
      fillIn(g, 'rgba(255, 255, 255, 0.7)', () => discAt(g, bx - br * 0.35, by - br * 0.35, br * 0.22));
    }
  };
  const nut = (x, y, r) => {
    softIn(g, [176, 120, 64], y - r, y + r, () => ovalAt(g, x, y, r, r * 0.86), 1.3, 0.6);
    fillIn(g, rockRGB([226, 196, 150]), () => ovalAt(g, x, y + r * 0.55, r * 0.6, r * 0.3));
    fillIn(g, 'rgba(255, 248, 230, 0.7)', () => ovalAt(g, x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.13, -0.5));
  };
  g.save(); g.beginPath(); g.rect(-1, -1, 2, top + ry * 0.7 + 1); g.clip();
  leaf(-0.4, top - 0.06, 0.15, -0.5, [104, 146, 58]); leaf(0.42, top - 0.08, 0.14, 0.7, [190, 128, 50]); leaf(0.05, top - 0.14, 0.13, 0.2, [118, 150, 60]);
  cep(-0.3, top - 0.03, 0.15);
  apple(0.18, top - 0.1, 0.14);
  berries(0.42, top - 0.02, 0.1);
  apple(-0.06, top - 0.02, 0.15);
  cep(0.3, top + 0.06, 0.11);
  nut(-0.45, top + 0.07, 0.05); nut(-0.37, top + 0.1, 0.045); nut(0.1, top + 0.12, 0.045);
  g.restore();
}

// ------------------------------------------------------------------ the fire pit
//
// A shallow pit scraped in the earth, ringed with nine fat stones sunk into it, and a tepee of split sticks with their bark
// on round a nest of dry grass and a curl of birch bark. Burning, the sticks char and crack with glowing seams over a bed of
// coals; embers, two charred stubs in a glowing bed; cold, soft grey ash with black bits and the stubs.
// n under 32: bed * 8 + pile * 2 + tinder (bed 0 new, 1 burning, 2 embers, 3 cold; pile 0 to 3), as game.js's.
const F0 = 0.25, RX = 0.6, RY = 0.26;
const STONES = [[-2.9, 0.12], [-2.25, 0.13], [-1.6, 0.12], [-0.95, 0.125], [-0.3, 0.12], [0.35, 0.135], [1.0, 0.145], [1.65, 0.15], [2.3, 0.14]];
const ROCKS = [[150, 146, 138], [172, 162, 146], [132, 130, 126], [186, 176, 158], [144, 140, 132], [164, 156, 144], [126, 124, 120], [178, 170, 154], [156, 150, 140]];
const STICKS = [[-2.4, 1, 0.07], [-0.7, 0.92, 0.064], [0.5, 1.04, 0.072], [2.1, 0.9, 0.062], [-1.5, 0.86, 0.06]];
const BARK = [112, 80, 52];
function paintFire(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const laying = n >= 32, step = n - 32;
  const bed = laying ? 0 : n >> 3, pile = laying ? 0 : (n >> 1) & 3, tinder = laying ? step >= 12 : !!(n & 1);
  const stones = laying ? Math.round(Math.min(6, step) / 6 * STONES.length) : STONES.length, sticks = laying ? clamp(step - 6, 0, 5) : [0, 2, 3, 5][pile];
  const h = k => hash2(n & 7, k, 919), burning = bed === 1, glowing = bed === 1 || bed === 2;
  // The trodden ground round it, its shadow, a few chips and pebbles kicked out.
  softSpot(g, 0.03, F0 + 0.04, RX + 0.3, RY + 0.16, '40, 30, 18', 0.32);
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 3, 421) * TAU, d = 1.15 + 0.25 * hash2(i, 4, 423), x = Math.cos(a) * RX * d, y = F0 + Math.sin(a) * RY * d + 0.03;
    softIn(g, tone([150, 140, 126], 0.8 + 0.3 * hash2(i, 5, 427)), y - 0.02, y + 0.02, () => ovalAt(g, x, y, 0.022, 0.014), 1.3, 0.6);
  }
  // The pit: a hollow, its far wall lit and its floor darker, inked faintly round its lip.
  const pr = RX * 0.8, pry = RY * 0.76, pit = () => ovalAt(g, 0, F0, pr, pry);
  fillIn(g, rockRGB(INK, 0.25), () => ovalAt(g, 0, F0 - 0.006, pr + 0.014, pry + 0.012));
  softIn(g, bed === 3 ? [128, 120, 112] : [126, 96, 64], F0 - pry, F0 + pry, pit, 1.15, 0.55);
  g.save(); g.beginPath(); pit(); g.clip();
  if (bed === 0) {                                          // scraped earth: a few chips of bark and stalks in it
    furGlow(g, [60, 40, 22], 0.55, 0, F0 + pry * 0.35, pr * 0.9, pry * 0.6);
    for (let i = 0; i < 7; i++) { const x = (h(i) - 0.5) * pr * 1.4, y = F0 + (h(10 + i) - 0.3) * pry * 0.9; fillIn(g, rockRGB(tone([196, 170, 130], 0.8 + 0.3 * h(20 + i))), () => ovalAt(g, x, y, 0.026, 0.009, h(30 + i) * 3)); }
  } else if (bed === 3) {                                   // soft grey ash, banked, black bits in it
    furGlow(g, [96, 90, 86], 0.6, 0, F0 + pry * 0.4, pr, pry * 0.6);
    for (let i = 0; i < 5; i++) { const x = (h(40 + i) - 0.5) * pr * 1.2, y = F0 + (h(50 + i) - 0.5) * pry * 0.8; softIn(g, [196, 190, 182], y - 0.05, y + 0.03, () => ovalAt(g, x, y, 0.1 + 0.05 * h(60 + i), 0.04), 1.2, 0.75); }
    for (let i = 0; i < 16; i++) { const x = (h(70 + i) - 0.5) * pr * 1.5, y = F0 + (h(90 + i) - 0.5) * pry * 1.2; softIn(g, [44, 38, 36], y - 0.012, y + 0.012, () => ovalAt(g, x, y, 0.016 + 0.018 * h(110 + i), 0.011, h(130 + i)), 1.6, 0.7); }
  } else {                                                  // coals: black lumps rimmed with the glow, brightest in its heart
    fillIn(g, 'rgb(54, 30, 22)', pit);
    furGlow(g, burning ? [255, 140, 50] : [232, 92, 36], burning ? 1 : 0.85, 0, F0, pr * 0.72, pry * 0.66, 0, 0.2);
    furGlow(g, [255, 220, 140], burning ? 0.7 : 0.35, 0, F0 - 0.01, pr * 0.32, pry * 0.3);
    for (let i = 0; i < 18; i++) {
      const a = h(140 + i) * TAU, d = Math.sqrt(h(160 + i)), x = Math.cos(a) * pr * 0.92 * d, y = F0 + Math.sin(a) * pry * 0.85 * d, r = 0.03 + 0.03 * h(180 + i);
      const hot = 1 - d * 0.7;
      fillIn(g, rockRGB([255, 150 + 60 * hot, 60 + 40 * hot], 0.9), () => ovalAt(g, x, y + 0.005, r * 1.2, r * 0.75));
      softIn(g, [52, 36, 32], y - r * 0.6, y + r * 0.6, () => ovalAt(g, x, y - 0.006, r, r * 0.58, h(200 + i)), 1.5, 0.6);
      strokeIn(g, rockRGB([255, 170, 80], 0.8 * hot), 0.008, () => { g.moveTo(x - r * 0.5, y - 0.004); g.lineTo(x + r * 0.3, y + 0.002); });
    }
  }
  furGlow(g, [30, 20, 12], bed === 3 ? 0.35 : 0.5, 0, F0 - pry * 0.95, pr * 1.1, pry * 0.35);   // (the lip's shadow over its far side)
  g.restore();
  // A stone of the ring: fat and rounded, sunk into the earth, lit from the top left, a crack, moss on a few, sooted on its
  // inside once it has burned, lit warm from the fire's side while it glows.
  const stone = k => {
    const [a, r] = STONES[k], x = Math.cos(a) * RX * 1.02, y = F0 + Math.sin(a) * RY * 1.02, sx = r * (0.86 + 0.2 * h(220 + k)), sy = sx * (0.62 + 0.1 * h(230 + k));
    const rgb = ROCKS[k], rot = (h(240 + k) - 0.5) * 0.25, cy = y - sy * 0.42;
    const body = () => ovalAt(g, x, cy, sx, sy, rot);
    softSpot(g, x + sx * 0.28, y + sy * 0.12, sx * 1.3, sy * 0.5, '26, 20, 12', 0.5);
    fillIn(g, rockRGB(INK, 0.22), () => ovalAt(g, x + 0.005, cy + 0.008, sx + 0.006, sy + 0.006, rot));
    { const gr = g.createRadialGradient(x - sx * 0.35, cy - sy * 0.5, sx * 0.05, x, cy, sx * 1.15);
      gr.addColorStop(0, rockRGB(tone(rgb, 1.2, 14))); gr.addColorStop(0.5, rockRGB(rgb)); gr.addColorStop(1, rockRGB(tone(rgb, 0.62)));
      g.fillStyle = gr; g.beginPath(); body(); g.fill(); }
    g.save(); g.beginPath(); body(); g.clip();
    for (let i = 0; i < 4; i++) fillIn(g, rockRGB(tone(rgb, 0.75 + 0.45 * h(250 + k * 7 + i)), 0.4), () => discAt(g, x + (h(300 + k * 7 + i) - 0.5) * sx * 1.6, cy + (h(350 + k * 7 + i) - 0.5) * sy * 1.4, 0.006 + 0.007 * h(400 + i)));   // its grain
    if (bed) furGlow(g, [30, 24, 20], 0.5, lerp(x, 0, 0.25), lerp(cy, F0, 0.3), sx * 0.7, sy * 0.6);   // soot on the fire's side
    if (glowing) furGlow(g, [255, 150, 70], burning ? 0.6 : 0.38, lerp(x, 0, 0.3), lerp(cy, F0, 0.35), sx * 0.6, sy * 0.55);
    furGlow(g, [255, 252, 240], 0.3, x - sx * 0.3, cy - sy * 0.4, sx * 0.5, sy * 0.3, -0.2);
    furGlow(g, [60, 46, 30], 0.3, x, y + sy * 0.1, sx * 1.1, sy * 0.3);   // sunk: dark where it meets the earth
    g.restore();
    if (h(500 + k) > 0.6) strokeIn(g, rockRGB(tone(rgb, 0.5), 0.6), 0.007, () => { const qx = x + (h(510 + k) - 0.4) * sx; g.moveTo(qx, cy - sy * 0.9); g.quadraticCurveTo(qx + 0.02, cy - sy * 0.4, qx + 0.006, cy); });
  };
  // A split stick with its bark on, from its foot (x0, y0) to its top: inked, shaded round, bark streaks along it, the pale
  // split face on one side; charred while it burns, black with glowing seams low down where the coals are.
  const stick = (x0, y0, x1, y1, w, seed, char) => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy); let nx = -dy / len, ny = dx / len;
    if (nx + ny > 0) { nx = -nx; ny = -ny; }
    const rgb = char ? tone([48, 36, 30], 0.9 + 0.25 * hash2(seed, 1, 431)) : tone(BARK, 0.86 + 0.28 * hash2(seed, 1, 431));
    const side = (o, wd, c) => strokeIn(g, c, wd, () => { g.moveTo(x0 + nx * o, y0 + ny * o); g.lineTo(x1 + nx * o * 0.6, y1 + ny * o * 0.6); });
    side(0, w + 0.016, rockRGB(INK, 0.5));
    side(0, w, rockRGB(rgb));
    side(-w * 0.26, w * 0.4, rockRGB(tone(rgb, 0.62)));
    side(w * 0.24, w * 0.3, rockRGB(char ? [96, 80, 72] : tone([214, 176, 126], 1), char ? 0.6 : 0.85));   // the split face, pale (grey once charred)
    strokeIn(g, rockRGB(tone(rgb, char ? 1.6 : 0.6, char ? 20 : 0), 0.6), 0.007, () => {               // bark streaks (char's cracks)
      for (let i = 0; i < 5; i++) { const t = 0.1 + 0.8 * hash2(seed, i, 433), o = (hash2(i, seed, 437) - 0.6) * w * 0.5, l = 0.05 + 0.06 * hash2(seed, i, 439); g.moveTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o); g.lineTo(x0 + dx * (t + l) + nx * o, y0 + dy * (t + l) + ny * o); }
    });
    if (char && glowing) {
      strokeIn(g, 'rgba(255, 140, 50, 0.9)', 0.012, () => {   // glowing seams, crossways, low on it
        for (let i = 0; i < 4; i++) { const t = 0.05 + i * 0.09 + 0.03 * hash2(seed, i, 441), cx = x0 + dx * t, cy = y0 + dy * t; g.moveTo(cx - nx * w * 0.4, cy - ny * w * 0.4); g.lineTo(cx + nx * w * 0.3, cy + ny * w * 0.3); }
      });
      furGlow(g, [255, 120, 40], 0.6, x0 + dx * 0.15, y0 + dy * 0.15, w * 1.4, w * 1.4);
    }
    if (!char) {                                            // its cut top
      fillIn(g, rockRGB([226, 196, 146]), () => ovalAt(g, x1, y1, w * 0.46, w * 0.3, Math.atan2(dy, dx) + Math.PI / 2));
      strokeIn(g, rockRGB([170, 130, 84], 0.7), 0.005, () => ovalAt(g, x1, y1, w * 0.24, w * 0.15, Math.atan2(dy, dx) + Math.PI / 2));
    }
  };
  const top = F0 - 0.56 * (sticks >= 5 ? 1 : sticks >= 3 ? 0.86 : 0.66);
  const tepee = i => {
    const [a, len, w] = STICKS[i], bx = Math.cos(a) * RX * 0.5, by = F0 + Math.sin(a) * RY * 0.48;
    const tx = -bx * 0.14 + 0.01 + Math.cos(a) * 0.035, ty = top + (1 - len) * 0.12 - 0.04;   // (crossing just under the top, ends poking past)
    stick(bx, by, tx, ty, w, 60 + i, burning);
  };
  const stub = (x0, y0, x1, y1, i) => stick(x0, F0 + y0, x1, F0 + y1, 0.05, 80 + i, true);
  const behind = [], before = [];
  for (let k = 0; k < stones; k++) (Math.sin(STONES[k][0]) < 0 ? behind : before).push(k);
  for (const k of behind) stone(k);
  if (!sticks && bed >= 2) { stub(-0.3, -0.02, 0.16, 0.04, 0); stub(0.28, -0.05, -0.1, 0.06, 1); }
  for (let i = 0; i < sticks; i++) if (Math.sin(STICKS[i][0]) < 0) tepee(i);
  if (tinder) {                                             // a nest of dry grass, a curl of birch bark tucked in it
    furGlow(g, [40, 28, 14], 0.4, 0.01, F0 + 0.02, 0.14, 0.04);
    for (let i = 0; i < 22; i++) {
      const t = i / 21, a = Math.PI + t * Math.PI + (h(520 + i) - 0.5) * 0.3, r = 0.08 + 0.04 * h(540 + i);
      const x0 = Math.cos(a) * r * 0.4, x1 = Math.cos(a) * r * 1.2, y1 = F0 - 0.04 - Math.abs(Math.sin(a)) * r * 0.9 - 0.06 * h(560 + i);
      strokeIn(g, rockRGB(tone(i % 3 ? [226, 200, 128] : [192, 152, 90], 0.8 + 0.32 * h(580 + i))), 0.016, () => { g.moveTo(x0, F0 + 0.01); g.quadraticCurveTo((x0 + x1) / 2 - 0.02, (F0 + y1) / 2 - 0.03, x1, y1); });
    }
    const cx = 0.03, cy = F0 - 0.07;                       // the bark's curl
    fillIn(g, rockRGB(INK, 0.6), () => ovalAt(g, cx, cy, 0.07, 0.04, -0.3));
    softIn(g, [238, 230, 212], cy - 0.04, cy + 0.04, () => ovalAt(g, cx, cy, 0.06, 0.032, -0.3), 1.05, 0.75);
    strokeIn(g, rockRGB([204, 138, 86]), 0.012, () => g.ellipse(cx + 0.03, cy - 0.008, 0.022, 0.026, 0, -0.5, Math.PI * 1.4));
    furGlow(g, [255, 246, 210], 0.3, 0, F0 - 0.1, 0.14, 0.08);
  }
  for (let i = 0; i < sticks; i++) if (Math.sin(STICKS[i][0]) >= 0) tepee(i);
  for (const k of before) stone(k);
}

root.CampLooks = { paintBasket, paintFire };
})(window);
