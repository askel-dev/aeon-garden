/* Nobody's Meadow — the things the meadow gives, painted for the satchel. The meadow paints its mushrooms and greens as they
 * grow, in clumps on the ground with the ground's shade under them, which looked muddy blown up in a slot. These are the same
 * things picked and held up to look at: whole, on nothing, a little more detail than the meadow gives them (a cep's netted
 * stem, a chanterelle's forking ridges, a nettle's teeth), lit from the top left and readable at 48 px. Like dishes.js it
 * knows nothing of the meadow: game.js puts these into the satchel's sheet (itemSheet, as 'ingr:' + n, n an index into
 * NAMES, an ingredient's id): every ingredient so far, fruit, honeycomb, nuts and what lies about for a fire too. Loaded after
 * fur.js, whose drawing helpers it paints with. A painter paints one into a canvas size pixels square, U pixels to the box
 * -1 to 1. A new ingredient with no painting here keeps the meadow's painting, or its recipes.js emoji.
 */
(root => {
'use strict';
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, softIn, furGlow } = root.Fur;
const TAU = Math.PI * 2;
const rgba = (c, a = 1) => rockRGB(c, a);
// A fixed little scatter, so a painting is the same every time it's painted.
const jit = (n, k) => { const s = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

// Where it touches whatever it's laid on: small, warm and faint, tight under it (not the meadow's wide grey smudge).
const touch = (g, x, y, rx, a = 0.16) => furGlow(g, [96, 66, 36], a, x, y, rx, rx * 0.22, 0, 0.3);

// A leaf along its own y, base at 0 and tip at -len: half its width at t along it is w(t), its edge toothed (teeth, depth
// as a share of the width), bent sideways by bend at the tip. Paints the blade shaded along it, a midrib and a few veins.
function leafPath(g, len, w, teeth = 0, depth = 0, bend = 0, back = false, round = false) {
  const N = teeth > 6 ? 72 : 48, side = s => {
    for (let i = 0; i <= N; i++) {
      const t = s > 0 ? i / N : 1 - i / N, saw = !teeth ? 0 : round ? Math.sqrt(Math.abs(Math.sin(t * teeth * Math.PI))) : back ? 1 - (t * teeth) % 1 : (t * teeth) % 1;
      const half = w(t) * (1 + depth * (saw - 0.5) * (t < 0.96 ? 1 : 0));
      const x = s * half + bend * t * t, y = -len * t;
      i || s < 0 ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  };
  side(1); side(-1); g.closePath();
}
function leaf(g, x, y, ang, len, w, rgb, o = {}) {
  const { teeth = 0, depth = 0, bend = 0, back = false, round = false, vein = 0.5, veins = 4, lit = 1.22, dim = 0.62, sheen = 0.32 } = o;
  g.save(); g.translate(x, y); g.rotate(ang);
  const path = () => leafPath(g, len, w, teeth, depth, bend, back, round);
  softIn(g, rgb, -len, 0, path, lit, dim);
  g.save(); g.beginPath(); path(); g.clip();
  furGlow(g, tone(rgb, 0.55), 0.45, bend * 0.4 + w(0.5) * 0.9, -len * 0.45, w(0.5) * 0.7, len * 0.55);   // the far half in shade
  furGlow(g, [255, 255, 230], sheen, -w(0.5) * 0.35 + bend * 0.3, -len * 0.55, w(0.5) * 0.35, len * 0.3);  // a gleam on the near half
  const mid = t => [bend * t * t, -len * t];
  strokeIn(g, rgba(tone(rgb, 1.35, 30), vein), len * 0.022, () => { g.moveTo(0, 0); for (let i = 1; i <= 10; i++) g.lineTo(...mid(i / 10 * 0.94)); });
  strokeIn(g, rgba(tone(rgb, 1.3, 24), vein * 0.6), len * 0.012, () => {
    for (let k = 1; k <= veins; k++) {
      const t = k / (veins + 1), [mx, my] = mid(t), wv = w(Math.min(1, t + 0.12)) * 0.85;
      for (const s of [1, -1]) { g.moveTo(mx, my); g.quadraticCurveTo(mx + s * wv * 0.5, my - len * 0.04, mx + s * wv + bend * 0.1, my - len * 0.12); }
    }
  });
  g.restore();
  strokeIn(g, rgba(tone(rgb, 0.55), 0.35), len * 0.01, path);
  g.restore();
}
// A stalk from (x0, y0) bending through (cx, cy) to (x1, y1), lit along its left side.
function stalk(g, x0, y0, cx, cy, x1, y1, w, rgb) {
  const p = () => { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); };
  strokeIn(g, rgba(tone(rgb, 0.68)), w * 1.25, p);
  strokeIn(g, rgba(rgb), w, p);
  g.save(); g.translate(-w * 0.22, 0); strokeIn(g, rgba(tone(rgb, 1.25, 26), 0.7), w * 0.32, p); g.restore();
}

// ------------------------------------------------------------------ the mushrooms

// A cep: a fat bun of a cap, chestnut and a little sticky-shiny, paler at the rim, the cream sponge of its pores showing
// under it; the stem a swollen barrel, pale and netted near the top, earth still on its foot. A little button one leans on it.
const CEP_CAP = [136, 82, 44], CEP_RIM = [184, 132, 80], CEP_PORE = [226, 208, 146], CEP_STEM = [236, 224, 200];
function cep(g, x, y, s, k) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const stem = () => { g.moveTo(-0.24, -0.12); g.bezierCurveTo(-0.34, 0.08, -0.48, 0.34, -0.42, 0.54); g.quadraticCurveTo(-0.36, 0.72, 0, 0.72); g.quadraticCurveTo(0.36, 0.72, 0.42, 0.54); g.bezierCurveTo(0.48, 0.34, 0.34, 0.08, 0.24, -0.12); g.closePath(); };
  softIn(g, CEP_STEM, -0.1, 0.72, stem, 1.06, 0.82);
  g.save(); g.beginPath(); stem(); g.clip();
  furGlow(g, [170, 140, 104], 0.55, 0.34, 0.34, 0.22, 0.5);                                  // round: its shade side
  furGlow(g, [255, 252, 244], 0.7, -0.16, 0.3, 0.1, 0.32);                                    // and its lit side
  strokeIn(g, 'rgba(176, 146, 104, 0.5)', 0.012, () => {                                      // the net, fine near the top
    for (let r = 0; r < 4; r++) for (let c = -3; c <= 3; c++) {
      const cx = c * 0.09 + (r % 2) * 0.045, cy = -0.06 + r * 0.075, rr = 0.032 - r * 0.004;
      g.moveTo(cx + rr, cy); g.ellipse(cx, cy, rr, rr * 0.75, 0, 0, TAU);
    }
  });
  furGlow(g, [122, 92, 60], 0.5, 0.04, 0.72, 0.42, 0.1);                                      // earth on its foot
  g.restore();
  fillIn(g, 'rgba(110, 80, 50, 0.6)', () => { for (let i = 0; i < 5; i++) ovalAt(g, -0.3 + jit(k, i) * 0.6, 0.66 + jit(k, i + 9) * 0.05, 0.02, 0.012); });
  // The pores under the rim.
  softIn(g, CEP_PORE, -0.2, -0.04, () => ovalAt(g, 0, -0.12, 0.6, 0.11), 1.0, 0.8);
  // The cap.
  const cap = () => { g.moveTo(-0.64, -0.12); g.bezierCurveTo(-0.72, -0.48, -0.4, -0.74, 0, -0.74); g.bezierCurveTo(0.4, -0.74, 0.72, -0.48, 0.64, -0.12); g.bezierCurveTo(0.4, -0.04, -0.4, -0.04, -0.64, -0.12); g.closePath(); };
  softIn(g, CEP_CAP, -0.74, -0.06, cap, 1.28, 0.7);
  g.save(); g.beginPath(); cap(); g.clip();
  furGlow(g, CEP_RIM, 0.75, 0, -0.07, 0.72, 0.13);                                            // paler at the rim
  furGlow(g, [84, 46, 22], 0.5, 0.42, -0.3, 0.32, 0.36);                                      // the shade side
  furGlow(g, [255, 236, 206], 0.42, -0.26, -0.52, 0.26, 0.12, -0.35);                         // the sticky shine
  g.restore();
  fillIn(g, 'rgba(255, 250, 238, 0.9)', () => { ovalAt(g, -0.3, -0.56, 0.07, 0.025, -0.45); ovalAt(g, -0.12, -0.66, 0.025, 0.014); });
  strokeIn(g, 'rgba(96, 58, 30, 0.45)', 0.016, () => { g.moveTo(-0.64, -0.12); g.bezierCurveTo(-0.4, -0.04, 0.4, -0.04, 0.64, -0.12); });
  g.restore();
}
function paintCep(g) {
  touch(g, 0.0, 0.76, 0.6);
  cep(g, 0.46, 0.38, 0.5, 1);
  cep(g, -0.12, 0.02, 1.02, 0);
}

// Chanterelles: golden funnels with a wavy, rolled rim, the hollow of the cap a deeper gold, false gills running in forking
// ridges down onto the stem, which tapers to where it was pinched off.
const CHANT = [238, 172, 46], CHANT_DEEP = [214, 138, 28];
function chanterelle(g, x, y, s, tilt, k) {
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  const R = 0.42, wave = a => 1 + 0.07 * Math.sin(a * 5 + k * 2) + 0.04 * Math.sin(a * 9 + k);
  const rim = (y0, ry, back) => {                                       // the rim, an ellipse with a wavy edge
    for (let i = 0; i <= 40; i++) {
      const a = (back ? Math.PI : 0) + i / 40 * Math.PI, w = wave(a);
      const px = Math.cos(a) * R * w, py = y0 + Math.sin(a) * ry * w;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
  };
  const body = () => { rim(-0.34, 0.1, false); g.bezierCurveTo(-0.3, -0.12, -0.1, 0.12, -0.07, 0.5); g.quadraticCurveTo(0, 0.56, 0.07, 0.5); g.bezierCurveTo(0.1, 0.12, 0.3, -0.12, R * wave(0), -0.34); g.closePath(); };
  // The funnel's outside, with its ridges.
  softIn(g, CHANT, -0.36, 0.56, body, 1.18, 0.74);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [176, 104, 20], 0.5, 0.26, -0.06, 0.24, 0.42);
  furGlow(g, [255, 236, 170], 0.45, -0.16, -0.12, 0.1, 0.3);
  strokeIn(g, rgba(CHANT_DEEP, 0.75), 0.016, () => {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.05 + i / 10 * 0.9), w = wave(a), sx = Math.cos(a) * R * w * 0.98, sy = -0.34 + Math.sin(a) * 0.1 * w;
      const ex = Math.cos(a) * 0.06, ey = 0.36;
      g.moveTo(sx, sy); g.quadraticCurveTo(sx * 0.5, sy + 0.2, ex, ey);
      if (i % 3 === 1) { g.moveTo(sx * 0.72, sy + 0.08); g.lineTo(sx * 0.85 + 0.03, sy + 0.02); }    // where a ridge forks
    }
  });
  g.restore();
  // The top: the cap's hollow, deeper gold, its far rim rolled over.
  const top = () => { rim(-0.34, 0.1, true); rim(-0.34, 0.1, false); g.closePath(); };
  softIn(g, CHANT_DEEP, -0.46, -0.22, top, 1.05, 1.15);
  furGlow(g, [170, 96, 14], 0.5, 0.04, -0.33, 0.24, 0.05);
  strokeIn(g, rgba(tone(CHANT, 1.15, 20)), 0.03, () => rim(-0.34, 0.1, false));          // the near rim, catching the light
  strokeIn(g, rgba(tone(CHANT, 1.05, 10), 0.8), 0.02, () => rim(-0.34, 0.1, true));
  g.restore();
}
function paintChanterelle(g) {
  touch(g, 0, 0.74, 0.5);
  chanterelle(g, 0.4, -0.04, 0.9, 0.22, 2);
  chanterelle(g, -0.4, 0.0, 0.92, -0.24, 1);
  chanterelle(g, 0.0, 0.16, 1.12, 0.02, 0);
}

// Field mushrooms: a white dome on a short white stem with a ring, the pink-brown gills showing under its edge; and one
// lying tipped back, its gills turned up to look at, fanning out round the stem.
const FIELD = [244, 238, 228], FIELD_GILL = [184, 116, 104];
function paintField(g) {
  touch(g, 0.04, 0.72, 0.62);
  // The one lying tipped back: the cap's white rim round its gills, the stem stub in the middle.
  g.save(); g.translate(0.42, 0.42); g.rotate(-0.35);
  softIn(g, FIELD, -0.12, 0.3, () => ovalAt(g, 0, 0.06, 0.44, 0.24), 1.0, 0.72);
  softIn(g, FIELD_GILL, -0.1, 0.2, () => ovalAt(g, 0, 0.02, 0.38, 0.18), 1.16, 0.7);
  strokeIn(g, rgba(tone(FIELD_GILL, 0.6), 0.6), 0.008, () => { for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; g.moveTo(Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.035); g.lineTo(Math.cos(a) * 0.37, 0.02 + Math.sin(a) * 0.17); } });
  furGlow(g, [90, 50, 44], 0.35, 0.1, 0.06, 0.26, 0.12);
  softIn(g, FIELD, -0.04, 0.08, () => ovalAt(g, 0, 0.02, 0.08, 0.05), 1.1, 0.8);
  g.restore();
  // The one standing.
  g.save(); g.translate(-0.18, 0.02);
  const stem = () => { g.moveTo(-0.14, -0.1); g.bezierCurveTo(-0.15, 0.2, -0.2, 0.5, -0.14, 0.62); g.quadraticCurveTo(0, 0.68, 0.14, 0.62); g.bezierCurveTo(0.2, 0.5, 0.15, 0.2, 0.14, -0.1); g.closePath(); };
  softIn(g, FIELD, -0.1, 0.66, stem, 1.04, 0.78);
  furGlow(g, [160, 146, 130], 0.5, 0.12, 0.3, 0.08, 0.36);
  softIn(g, FIELD, 0.08, 0.2, () => { g.moveTo(-0.2, 0.12); g.quadraticCurveTo(0, 0.08, 0.2, 0.12); g.quadraticCurveTo(0.22, 0.2, 0.16, 0.22); g.quadraticCurveTo(0, 0.18, -0.16, 0.22); g.quadraticCurveTo(-0.22, 0.2, -0.2, 0.12); }, 1.1, 0.7);   // its ring
  softIn(g, FIELD_GILL, -0.2, -0.02, () => ovalAt(g, 0, -0.11, 0.5, 0.09), 0.9, 0.65);
  const cap = () => { g.moveTo(-0.56, -0.1); g.bezierCurveTo(-0.62, -0.42, -0.34, -0.66, 0, -0.66); g.bezierCurveTo(0.34, -0.66, 0.62, -0.42, 0.56, -0.1); g.bezierCurveTo(0.3, -0.04, -0.3, -0.04, -0.56, -0.1); g.closePath(); };
  softIn(g, FIELD, -0.66, -0.06, cap, 1.04, 0.8);
  g.save(); g.beginPath(); cap(); g.clip();
  furGlow(g, [176, 160, 140], 0.55, 0.38, -0.24, 0.3, 0.34);
  furGlow(g, [255, 255, 255], 0.9, -0.22, -0.46, 0.22, 0.12, -0.3);
  fillIn(g, 'rgba(196, 176, 150, 0.4)', () => { for (let i = 0; i < 6; i++) ovalAt(g, -0.3 + jit(3, i) * 0.6, -0.5 + jit(4, i) * 0.3, 0.03, 0.015); });   // a few fine scales
  g.restore();
  strokeIn(g, 'rgba(150, 132, 112, 0.4)', 0.014, () => { g.moveTo(-0.56, -0.1); g.bezierCurveTo(-0.3, -0.04, 0.3, -0.04, 0.56, -0.1); });
  g.restore();
}

// Oyster mushrooms: smooth shell-shaped caps from one short pale stem, blue-grey and darker where they're joined, paling
// to a wavy cream rim; the one in front turned up to show its cream gills running down to the stem.
const OYSTER_TOP = [124, 126, 138], OYSTER_RIM = [222, 216, 202], OYSTER_GILL = [238, 230, 208];
// A shell along its own y: joined at (0, 0), its round wavy edge out toward -y.
function shellPath(g, k) {
  const cy = -0.6, r = 0.46, N = 40, pt = i => { const a = -0.45 + i / N * (Math.PI + 0.9), w = 1 + 0.045 * Math.sin(a * 6 + k) - 0.03 * Math.abs(Math.sin(a * 11 + k)); return [Math.cos(a) * r * w, cy - Math.sin(a) * r * 0.92 * w]; };
  const [x0, y0] = pt(0), [x1, y1] = pt(N);
  g.moveTo(0.05, 0); g.bezierCurveTo(0.2, -0.06, x0 + 0.02, y0 + 0.2, x0, y0);
  for (let i = 1; i <= N; i++) g.lineTo(...pt(i));
  g.bezierCurveTo(x1 - 0.02, y1 + 0.2, -0.2, -0.06, -0.05, 0); g.closePath();
}
function shell(g, x, y, ang, s, k, gills) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const path = () => shellPath(g, k);
  if (gills) {
    softIn(g, OYSTER_GILL, -1.05, 0, path, 1.04, 0.84);
    g.save(); g.beginPath(); path(); g.clip();
    strokeIn(g, 'rgba(176, 160, 128, 0.32)', 0.008, () => { for (let i = 0; i <= 44; i++) { const a = -0.5 + i / 44 * (Math.PI + 1.0), bow = 0.06 * Math.sin(i * 1.7); g.moveTo(0, 0.02); g.quadraticCurveTo(Math.cos(a) * 0.18 + bow, -0.34, Math.cos(a) * 0.52, -0.6 - Math.sin(a) * 0.5); } });
    furGlow(g, [160, 140, 104], 0.4, 0, -0.08, 0.16, 0.24);
    furGlow(g, [255, 252, 240], 0.45, -0.12, -0.7, 0.24, 0.18);
    g.restore();
    strokeIn(g, rgba(OYSTER_RIM, 0.9), 0.04, path);                          // the cap's rolled edge round it
    strokeIn(g, rgba(OYSTER_TOP, 0.35), 0.012, path);
  } else {
    softIn(g, OYSTER_TOP, -1.05, 0, path, 1.3, 0.62);
    g.save(); g.beginPath(); path(); g.clip();
    const gr = g.createRadialGradient(0, -0.6, 0.22, 0, -0.6, 0.5);         // paling to the rim
    gr.addColorStop(0, rgba(OYSTER_RIM, 0)); gr.addColorStop(1, rgba(OYSTER_RIM, 0.9));
    g.fillStyle = gr; g.fillRect(-0.6, -1.2, 1.2, 1.2);
    furGlow(g, [70, 72, 86], 0.6, 0, -0.05, 0.22, 0.32);                     // dark where it's joined
    furGlow(g, [90, 92, 106], 0.35, 0.22, -0.55, 0.25, 0.35);               // its shade side
    strokeIn(g, 'rgba(84, 86, 100, 0.16)', 0.012, () => { for (let i = 1; i < 12; i++) { const a = -0.3 + i / 12 * (Math.PI + 0.6); g.moveTo(0, -0.12); g.lineTo(Math.cos(a) * 0.4, -0.6 - Math.sin(a) * 0.38); } });
    furGlow(g, [255, 252, 244], 0.45, -0.16, -0.78, 0.18, 0.08, -0.3);       // a soft sheen
    g.restore();
    strokeIn(g, 'rgba(70, 72, 86, 0.3)', 0.014, path);
  }
  g.restore();
}
function paintOyster(g) {
  touch(g, -0.04, 0.78, 0.42);
  const bx = -0.06, by = 0.66;
  shell(g, bx - 0.04, by - 0.06, -0.6, 1.08, 2, false);
  shell(g, bx + 0.06, by - 0.04, 0.55, 1.0, 4, false);
  shell(g, bx, by - 0.02, -0.05, 1.12, 1, false);
  stalk(g, bx, by + 0.08, bx + 0.02, by, bx + 0.02, by - 0.12, 0.13, OYSTER_GILL);
  shell(g, bx + 0.1, by + 0.02, 0.95, 0.62, 3, true);
}

// Chicken of the woods: thick fleshy shelves in tiers, each a few rounded overlapping lobes, flame orange where they're
// joined and sulphur yellow out to the rim, soft and suede-like, the pale yellow pores under each front edge. Drawn from the
// bottom tier up: each tier's front edge lies over the back of the one under it.
const SULPH = [236, 118, 34], SULPH_RIM = [252, 208, 66], SULPH_PORE = [252, 234, 136];
function lobe(g, x, y, rx, ry, thick, k) {
  const N = 36, edge = i => { const a = i / N * Math.PI, w = 1 + 0.05 * Math.sin(a * 7 + k) - 0.03 * Math.abs(Math.sin(a * 4 + k * 2)); return [x - Math.cos(a) * rx * w, y + Math.sin(a) * ry * w]; };
  const front = (dy) => { for (let i = 0; i <= N; i++) { const [px, py] = edge(i); i ? g.lineTo(px, py + dy) : g.moveTo(px, py + dy); } };
  // Its thickness: the pores under the front edge.
  softIn(g, SULPH_PORE, y, y + ry + thick, () => { front(0); front(thick); g.closePath(); g.moveTo(x - rx, y); for (let i = N; i >= 0; i--) { const [px, py] = edge(i); g.lineTo(px, py + thick); } g.closePath(); }, 1.0, 0.82);
  const top = () => { g.moveTo(x - rx, y); g.bezierCurveTo(x - rx * 0.7, y - ry * 0.3, x + rx * 0.7, y - ry * 0.3, x + rx, y); for (let i = N; i >= 0; i--) g.lineTo(...edge(i)); g.closePath(); };
  softIn(g, SULPH, y - ry * 0.3, y + ry, top, 1.08, 1.0);
  g.save(); g.beginPath(); top(); g.clip();
  g.save(); g.translate(x, y - ry * 0.25); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * 0.35, 0, 0, rx * 1.18);        // orange in, sulphur yellow out to the rim
  gr.addColorStop(0, rgba(SULPH_RIM, 0)); gr.addColorStop(0.55, rgba(SULPH_RIM, 0.5)); gr.addColorStop(1, rgba(SULPH_RIM, 1));
  g.fillStyle = gr; g.fillRect(-rx * 1.3, -rx * 1.3, rx * 2.6, rx * 2.6);
  g.restore();
  furGlow(g, [176, 70, 20], 0.5, x, y - ry * 0.25, rx * 0.5, ry * 0.45);       // deep where it's joined
  strokeIn(g, 'rgba(206, 110, 30, 0.35)', 0.014, () => { for (const t of [0.5, 0.72]) { g.moveTo(x - rx * t, y); g.ellipse(x, y, rx * t, ry * t, 0, Math.PI, 0, true); } });   // its growth bands
  furGlow(g, [255, 240, 196], 0.5, x - rx * 0.35, y + ry * 0.25, rx * 0.3, ry * 0.25);
  g.restore();
  strokeIn(g, 'rgba(255, 236, 150, 0.9)', 0.02, () => { for (let i = 4; i <= 26; i++) { const [px, py] = edge(i); i === 4 ? g.moveTo(px, py - 0.01) : g.lineTo(px, py - 0.01); } });
}
function paintSulphur(g) {
  touch(g, 0, 0.84, 0.62);
  lobe(g, -0.3, 0.3, 0.46, 0.36, 0.12, 1);                // the bottom tier, widest
  lobe(g, 0.32, 0.3, 0.46, 0.38, 0.12, 2);
  lobe(g, 0.0, 0.36, 0.52, 0.4, 0.13, 0);
  lobe(g, -0.22, -0.12, 0.4, 0.32, 0.11, 4);              // the middle
  lobe(g, 0.24, -0.1, 0.42, 0.33, 0.11, 5);
  lobe(g, 0.04, -0.52, 0.42, 0.3, 0.1, 6);                // and the top
}

// ------------------------------------------------------------------ the greens

// Wild garlic: a little bunch of its broad, shiny leaves, their stalks pale where they were pulled, tied with a stem, and
// one starry white head of flowers on its own stalk.
const GARLIC = [82, 150, 58], GARLIC_STALK = [214, 226, 176];
const blade = t => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.02)), 0.75);
function paintGarlic(g) {
  touch(g, 0.04, 0.78, 0.36);
  const bx = 0.02, by = 0.76;
  // The flower stalk and its head, behind the leaves.
  stalk(g, bx + 0.02, by - 0.1, bx + 0.12, by - 0.7, bx + 0.22, by - 1.3, 0.04, [150, 186, 98]);
  const hx = bx + 0.24, hy = -0.6;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.9 + i / 8 * Math.PI * 0.8, r = 0.17 + jit(5, i) * 0.06;
    strokeIn(g, 'rgba(150, 186, 98, 0.9)', 0.014, () => { g.moveTo(hx, hy + 0.06); g.lineTo(hx + Math.cos(a) * r, hy + 0.06 + Math.sin(a) * r * 0.9); });
  }
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.95 + i / 10 * Math.PI * 0.9 + jit(6, i) * 0.2, r = 0.15 + jit(7, i) * 0.08;
    const fx = hx + Math.cos(a) * r, fy = hy + 0.04 + Math.sin(a) * r * 0.85, fr = 0.05 + jit(8, i) * 0.015;
    fillIn(g, 'rgba(250, 250, 244, 1)', () => { for (let p = 0; p < 6; p++) { const pa = p / 6 * TAU + i; g.moveTo(fx, fy); g.ellipse(fx + Math.cos(pa) * fr * 0.55, fy + Math.sin(pa) * fr * 0.55, fr * 0.55, fr * 0.24, pa, 0, TAU); } });
    furGlow(g, [176, 196, 120], 0.8, fx, fy, fr * 0.25, fr * 0.25);
  }
  // The leaves, fanned from the tie.
  for (const [ang, len, wid, bend, k] of [[-0.62, 1.15, 0.2, -0.12, 0], [0.55, 1.12, 0.21, 0.14, 1], [-0.24, 1.3, 0.23, -0.06, 2], [0.22, 1.24, 0.22, 0.1, 3], [-0.02, 1.36, 0.24, 0.02, 4]]) {
    g.save(); g.translate(bx, by); g.rotate(ang);
    strokeIn(g, rgba(GARLIC_STALK), 0.06, () => { g.moveTo(0, 0); g.lineTo(0, -len * 0.3); });
    leaf(g, 0, -len * 0.26, 0, len * 0.74, t => wid * blade(t), tone(GARLIC, 0.92 + jit(9, k) * 0.16), { bend, veins: 0, vein: 0.55, sheen: 0.45 });
    g.restore();
  }
  // The tie: a twist of grass round the stalks.
  strokeIn(g, 'rgb(152, 134, 72)', 0.035, () => { g.moveTo(bx - 0.1, by - 0.08); g.quadraticCurveTo(bx, by - 0.02, bx + 0.1, by - 0.1); g.moveTo(bx - 0.1, by - 0.14); g.quadraticCurveTo(bx, by - 0.08, bx + 0.1, by - 0.15); });
  strokeIn(g, 'rgb(152, 134, 72)', 0.025, () => { g.moveTo(bx + 0.08, by - 0.12); g.quadraticCurveTo(bx + 0.2, by - 0.04, bx + 0.22, by + 0.06); });
}

// Nettles: a pinched-off top, a square hairy stem with its leaves in pairs, each a heart drawn out to a point with coarse
// teeth, the young ones at the top folded up and fresher, a string of tiny green flowers hanging from one pair.
const NETTLE = [64, 120, 48], NETTLE_STEM = [112, 132, 70];
const heart = t => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.8) * (1 - t * 0.25);
function paintNettle(g) {
  touch(g, -0.04, 0.82, 0.3);
  stalk(g, -0.04, 0.8, 0.04, 0.1, -0.02, -0.66, 0.055, NETTLE_STEM);
  const pairs = [[0.5, 0.62, 0.3, 0.95], [0.08, 0.52, 0.26, 0.75], [-0.3, 0.4, 0.2, 0.5]];
  for (let p = 0; p < pairs.length; p++) {
    const [y, len, wid, spread] = pairs[p], x = 0.02 - (y + 0.3) * 0.03;
    if (p === 1) for (const s of [1, -1]) {                                   // the flowers hanging on threads
      strokeIn(g, 'rgba(120, 148, 70, 0.9)', 0.014, () => { g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.2, y + 0.06, x + s * 0.24, y + 0.32); });
      fillIn(g, 'rgb(150, 170, 92)', () => { for (let i = 0; i < 7; i++) { const t = 0.3 + i / 7 * 0.7; ovalAt(g, x + s * (0.2 * t + 0.04 * t * t), y + 0.06 * t + 0.26 * t * t, 0.022, 0.018); } });
    }
    for (const s of [-1, 1]) leaf(g, x, y, s * (1.1 - spread * 0.35), len, t => wid * heart(t), tone(NETTLE, 0.9 + p * 0.08), { teeth: 9, depth: 0.32, bend: s * 0.06, veins: 4, vein: 0.4, sheen: 0.2 });
  }
  leaf(g, -0.02, -0.6, -0.3, 0.32, t => 0.1 * heart(t), tone(NETTLE, 1.18), { teeth: 6, depth: 0.3, veins: 2, vein: 0.3 });   // the folded top
  leaf(g, -0.02, -0.6, 0.35, 0.3, t => 0.09 * heart(t), tone(NETTLE, 1.12), { teeth: 6, depth: 0.3, veins: 2, vein: 0.3 });
  leaf(g, -0.02, -0.62, 0.0, 0.26, t => 0.06 * heart(t), tone(NETTLE, 1.25), { teeth: 5, depth: 0.25, veins: 1, vein: 0.3 });
  strokeIn(g, 'rgba(240, 250, 230, 0.7)', 0.008, () => { for (let i = 0; i < 16; i++) { const y = -0.5 + i * 0.085, x = 0.02 - (y + 0.3) * 0.03, s = i % 2 ? 1 : -1; g.moveTo(x + s * 0.03, y); g.lineTo(x + s * 0.075, y - 0.03); } });   // its stinging hairs
}

// Sorrel: a handful of its arrow-shaped leaves, lime and fresh, the two little barbs at their base pointing back, on stalks
// going red toward where they were picked.
const SORREL = [126, 176, 60], SORREL_STALK = [176, 70, 60];
function arrowLeaf(g, x, y, ang, len, wid, rgb) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const path = () => {
    g.moveTo(0, 0);
    g.quadraticCurveTo(wid * 0.5, len * 0.06, wid * 0.85, len * 0.16);               // the right barb, pointing back and out
    g.quadraticCurveTo(wid * 0.7, -len * 0.04, wid * 0.62, -len * 0.12);
    g.bezierCurveTo(wid * 1.05, -len * 0.4, wid * 0.6, -len * 0.82, 0, -len);           // up to the tip
    g.bezierCurveTo(-wid * 0.6, -len * 0.82, -wid * 1.05, -len * 0.4, -wid * 0.62, -len * 0.12);
    g.quadraticCurveTo(-wid * 0.7, -len * 0.04, -wid * 0.85, len * 0.16);
    g.quadraticCurveTo(-wid * 0.5, len * 0.06, 0, 0);
    g.closePath();
  };
  softIn(g, rgb, -len, len * 0.16, path, 1.24, 0.66);
  g.save(); g.beginPath(); path(); g.clip();
  furGlow(g, tone(rgb, 0.55), 0.45, wid * 0.55, -len * 0.45, wid * 0.45, len * 0.5);
  furGlow(g, [255, 255, 220], 0.35, -wid * 0.3, -len * 0.6, wid * 0.25, len * 0.22);
  strokeIn(g, rgba(tone(rgb, 1.35, 30), 0.6), len * 0.022, () => { g.moveTo(0, 0); g.lineTo(0, -len * 0.92); });
  strokeIn(g, rgba(tone(rgb, 1.3, 24), 0.35), len * 0.012, () => { for (let k = 1; k <= 4; k++) { const t = k / 5; for (const s of [1, -1]) { g.moveTo(0, -len * t); g.quadraticCurveTo(s * wid * 0.3, -len * (t + 0.03), s * wid * 0.6, -len * (t + 0.12)); } } });
  g.restore();
  strokeIn(g, rgba(tone(rgb, 0.55), 0.35), len * 0.01, path);
  g.restore();
}
function paintSorrel(g) {
  touch(g, 0.02, 0.8, 0.3);
  const bx = 0.02, by = 0.8;
  for (const [ang, sl, len, wid, k] of [[-0.62, 0.42, 0.66, 0.26, 0], [0.6, 0.4, 0.64, 0.25, 1], [-0.22, 0.5, 0.74, 0.28, 2], [0.22, 0.48, 0.72, 0.28, 3]]) {
    const ex = bx + Math.sin(ang) * sl, ey = by - Math.cos(ang) * sl;
    // The stalk, red low down, greening up toward the leaf.
    stalk(g, bx, by, bx + Math.sin(ang) * sl * 0.4, by - sl * 0.6, ex, ey, 0.036, SORREL_STALK);
    g.save(); g.globalAlpha = 0.85; stalk(g, bx + Math.sin(ang) * sl * 0.6, by - Math.cos(ang) * sl * 0.6, bx + Math.sin(ang) * sl * 0.8, by - Math.cos(ang) * sl * 0.8, ex, ey, 0.032, [126, 150, 64]); g.restore();
    arrowLeaf(g, ex, ey, ang * 0.9, len, wid, tone(SORREL, 0.92 + jit(11, k) * 0.16));
  }
}

// Dandelions: two golden heads on their hollow stalks, the many ray petals in rings round a deeper middle, the green bracts
// curled back under them, and one of its deep-toothed leaves behind.
const DAND = [250, 206, 40], DAND_LEAF = [92, 146, 56];
function dandHead(g, x, y, r, tilt) {
  g.save(); g.translate(x, y); g.rotate(tilt);
  // The bracts under it.
  fillIn(g, 'rgb(96, 136, 52)', () => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i / 6 * 0.7); g.moveTo(Math.cos(a) * r * 0.2, r * 0.2); g.quadraticCurveTo(Math.cos(a) * r * 0.5, r * 0.5, Math.cos(a) * r * 0.62, r * 0.64 + Math.sin(a) * r * 0.1); g.quadraticCurveTo(Math.cos(a) * r * 0.3, r * 0.42, Math.cos(a) * r * 0.1 + 0.01, r * 0.2); } });
  softIn(g, [110, 150, 60], r * 0.05, r * 0.5, () => ovalAt(g, 0, r * 0.28, r * 0.28, r * 0.22), 1.1, 0.7);
  // The petals: rings of thin rays, the outer ones long and flat, the inner short and deeper gold.
  for (const [rr, n, c, wdt] of [[1, 30, tone(DAND, 0.95), 0.1], [0.78, 26, DAND, 0.1], [0.56, 22, tone(DAND, 1.02, 6), 0.12], [0.34, 16, [244, 172, 24], 0.14]]) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rr * 3, ex = Math.cos(a) * r * rr, ey = Math.sin(a) * r * rr * 0.62 - r * 0.06;
      const shade = Math.sin(a) > 0 ? 1 : 0.9 + 0.1 * (1 + Math.cos(a + 0.8)) / 2;
      fillIn(g, rgba(tone(c, Math.sin(a) > 0.3 ? 0.88 : 1.04 * shade)), () => { g.moveTo(0, -r * 0.06); g.ellipse(ex * 0.55, ey * 0.55 - r * 0.03, r * rr * 0.5, r * wdt, a * 0.62 + Math.atan2(ey, ex) * 0.38, 0, TAU); });
    }
  }
  furGlow(g, [255, 248, 200], 0.45, -r * 0.25, -r * 0.2, r * 0.4, r * 0.25);
  furGlow(g, [200, 120, 10], 0.4, 0, -r * 0.04, r * 0.16, r * 0.1);
  g.restore();
}
function paintDandelion(g) {
  touch(g, 0.04, 0.8, 0.3);
  // Two leaves behind, deeply toothed, their lobes pointing back down to the root.
  const lw = W => t => W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.6);
  leaf(g, 0.08, 0.82, 0.62, 0.98, lw(0.17), DAND_LEAF, { teeth: 5, depth: 1.1, back: true, veins: 0, vein: 0.55, sheen: 0.25 });
  leaf(g, -0.04, 0.82, -0.66, 0.86, lw(0.15), tone(DAND_LEAF, 1.1), { teeth: 4, depth: 1.1, back: true, bend: -0.04, veins: 0, vein: 0.55, sheen: 0.25 });
  // Their hollow stalks, pale and a little pink at the foot.
  stalk(g, 0.0, 0.82, -0.06, 0.1, -0.3, -0.38, 0.045, [168, 196, 110]);
  stalk(g, 0.04, 0.82, 0.2, 0.3, 0.32, -0.06, 0.045, [168, 196, 110]);
  dandHead(g, 0.33, -0.12, 0.36, 0.25);
  dandHead(g, -0.3, -0.46, 0.42, -0.2);
}

// Watercress: a few sprigs of it pulled from the shallows, fleshy pale stems with white rootlets at the foot, and its
// leaves in pairs of round leaflets, dark and glossy, the end one biggest.
const CRESS = [62, 128, 56], CRESS_STEM = [176, 200, 136];
function cressLeaflet(g, x, y, r, a, rgb) {
  g.save(); g.translate(x, y); g.rotate(a);
  softIn(g, rgb, -r, r, () => ovalAt(g, 0, 0, r, r * 0.84), 1.28, 0.6);
  g.save(); g.beginPath(); ovalAt(g, 0, 0, r, r * 0.84); g.clip();
  furGlow(g, tone(rgb, 0.5), 0.5, r * 0.45, r * 0.35, r * 0.7, r * 0.6);
  g.restore();
  strokeIn(g, rgba(tone(rgb, 1.4, 30), 0.45), r * 0.07, () => { g.moveTo(0, r * 0.8); g.lineTo(0, -r * 0.5); });
  fillIn(g, 'rgba(250, 255, 244, 0.8)', () => ovalAt(g, -r * 0.38, -r * 0.42, r * 0.22, r * 0.09, -0.6));
  strokeIn(g, rgba(tone(rgb, 0.5), 0.3), r * 0.04, () => ovalAt(g, 0, 0, r, r * 0.84));
  g.restore();
}
function cressLeaf(g, x, y, ang, len, k) {
  g.save(); g.translate(x, y); g.rotate(ang);
  strokeIn(g, rgba(CRESS_STEM), len * 0.045, () => { g.moveTo(0, 0); g.lineTo(0, -len * 0.75); });
  const pairs = 1 + (k % 2);
  for (let p = 0; p < pairs; p++) {                                          // the leaflets down its sides in pairs
    const t = 0.36 + p * 0.2, r = len * (0.19 + p * 0.03);
    for (const s of [-1, 1]) cressLeaflet(g, s * r * 0.85, -len * t, r, s * 0.5, tone(CRESS, 0.94 + jit(k, p * 2 + s) * 0.16));
  }
  cressLeaflet(g, 0, -len * 0.84, len * 0.3, 0, CRESS);                    // the end one, biggest
  g.restore();
}
function paintWatercress(g) {
  touch(g, 0.0, 0.8, 0.34);
  // Rootlets, white and fine, at the foot.
  strokeIn(g, 'rgba(242, 238, 224, 0.9)', 0.012, () => { for (let k = 0; k < 9; k++) { const x = -0.06 + jit(12, k) * 0.12, a = 0.3 + k / 8 * 2.5; g.moveTo(x, 0.7); g.quadraticCurveTo(x + Math.cos(a) * 0.1, 0.76, x + Math.cos(a) * 0.2, 0.78 + Math.sin(a) * 0.08); } });
  for (const [x1, y1, k] of [[-0.34, -0.12, 0], [0.34, -0.06, 1], [0.0, -0.36, 2]]) {
    stalk(g, 0, 0.72, x1 * 0.3, 0.1, x1, y1, 0.05, CRESS_STEM);
    const at = t => [(1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * x1 * 0.3 + t * t * x1, (1 - t) * (1 - t) * 0.72 + 2 * (1 - t) * t * 0.1 + t * t * y1];
    const dir = Math.atan2(x1 - x1 * 0.3, -(y1 - 0.1));
    cressLeaf(g, ...at(0.5), dir - 1.15, 0.42, k * 3);
    cressLeaf(g, ...at(0.68), dir + 1.15, 0.4, k * 3 + 1);
    cressLeaf(g, x1, y1, dir, 0.46, k * 3 + 2);
  }
}

// ------------------------------------------------------------------ round things

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Something round and smooth (a cherry, a drupelet, a pebble): lit from the top left where it gleams, darker round the far
// side, and a little light thrown back up into its lower right edge. rx by ry, turned by rot.
function ball(g, x, y, rx, ry, rgb, o = {}) {
  const { lit = 1.4, dim = 0.45, gleam = 0.85, back = 0.3, rot = 0 } = o;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(-rx * 0.38, -rx * 0.42, rx * 0.04, 0, 0, rx * 1.02);
  gr.addColorStop(0, rgba(tone(rgb, lit, 26))); gr.addColorStop(0.5, rgba(rgb)); gr.addColorStop(1, rgba(tone(rgb, dim)));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  if (back) { g.save(); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.clip(); furGlow(g, tone(rgb, 1.2, 24), back, rx * 0.5, rx * 0.66, rx * 0.42, rx * 0.16, -0.7); g.restore(); }
  if (gleam) {
    furGlow(g, [255, 255, 255], gleam * 0.45, -rx * 0.36, -rx * 0.4, rx * 0.3, rx * 0.2, -0.7);
    fillIn(g, `rgba(255, 255, 255, ${gleam})`, () => ovalAt(g, -rx * 0.36, -rx * 0.42, rx * 0.17, rx * 0.09, -0.7));
  }
  g.restore();
}

// ------------------------------------------------------------------ the fruit

// An apple: a round windfall, red streaked over a yellow-green it shows where the sun didn't reach, pale freckles, a dent
// of a bruise, its stalk in the dimple at the top with a leaf still on.
function paintApple(g) {
  touch(g, 0, 0.78, 0.62, 0.2);
  const body = () => {
    g.moveTo(0, -0.5);
    g.bezierCurveTo(0.18, -0.7, 0.68, -0.72, 0.76, -0.2);
    g.bezierCurveTo(0.84, 0.3, 0.52, 0.72, 0.2, 0.72);
    g.bezierCurveTo(0.1, 0.72, 0.06, 0.66, 0, 0.66);
    g.bezierCurveTo(-0.06, 0.66, -0.1, 0.72, -0.2, 0.72);
    g.bezierCurveTo(-0.52, 0.72, -0.84, 0.3, -0.76, -0.2);
    g.bezierCurveTo(-0.68, -0.72, -0.18, -0.7, 0, -0.5); g.closePath();
  };
  const gr = g.createRadialGradient(-0.3, -0.3, 0.04, 0, 0.04, 0.92);
  gr.addColorStop(0, 'rgb(244, 104, 76)'); gr.addColorStop(0.45, 'rgb(204, 38, 32)'); gr.addColorStop(1, 'rgb(118, 16, 22)');
  g.fillStyle = gr; g.beginPath(); body(); g.fill();
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [214, 190, 70], 0.6, -0.5, 0.38, 0.3, 0.26, 0.4);                                // the side the sun missed
  for (let i = 0; i < 9; i++) {                                                               // soft streaks down from the stalk
    const x = (i - 4) * 0.15 + (jit(1, i) - 0.5) * 0.08, dark = i % 2;
    furGlow(g, dark ? [126, 12, 22] : [250, 130, 96], dark ? 0.2 + jit(2, i) * 0.15 : 0.12, x, 0.08, 0.03 + jit(3, i) * 0.03, 0.56, x * 0.35);
  }
  furGlow(g, [80, 8, 16], 0.5, 0.48, 0.28, 0.38, 0.5);                                        // its shade side
  furGlow(g, [96, 18, 18], 0.6, 0, -0.5, 0.26, 0.1);                                          // the dimple round the stalk
  furGlow(g, [96, 18, 18], 0.4, 0, 0.67, 0.14, 0.05);                                         // and the one underneath
  furGlow(g, [126, 70, 34], 0.38, 0.4, 0.32, 0.12, 0.1, 0, 0.3);                              // a bruise
  furGlow(g, [255, 176, 150], 0.3, 0.66, 0.34, 0.08, 0.3, -0.3);                              // light thrown back up
  fillIn(g, 'rgba(255, 228, 176, 0.5)', () => { for (let i = 0; i < 30; i++) { const a = jit(2, i) * TAU, r = Math.sqrt(jit(3, i)) * 0.66; ovalAt(g, Math.cos(a) * r, 0.06 + Math.sin(a) * r * 0.9, 0.012, 0.009); } });
  g.restore();
  furGlow(g, [255, 255, 255], 0.5, -0.4, -0.3, 0.22, 0.14, -0.6);                             // the shine
  fillIn(g, 'rgba(255, 255, 255, 0.9)', () => { ovalAt(g, -0.44, -0.34, 0.08, 0.035, -0.7); ovalAt(g, -0.6, -0.12, 0.025, 0.014, -1.2); });
  stalk(g, 0, -0.5, 0.02, -0.72, 0.12, -0.88, 0.05, [104, 72, 40]);
  leaf(g, 0.05, -0.68, 1.15, 0.52, t => 0.16 * blade(t), [98, 150, 52], { veins: 4, bend: -0.06, sheen: 0.35 });
}

// Cherries: a pair on their stalks joined at the top, dark glossy red with the faint crease down one side, two leaves
// with fine teeth where they were picked.
const CHERRY = [152, 10, 32];
function paintCherry(g) {
  touch(g, 0, 0.8, 0.62);
  const jx = 0.1, jy = -0.76, C = [[-0.34, 0.36, 0.33], [0.32, 0.44, 0.31]];
  leaf(g, jx, jy, -1.05, 0.44, t => 0.13 * blade(t), tone([86, 146, 54], 1.1), { teeth: 12, depth: 0.12, bend: 0.04, veins: 4 });
  leaf(g, jx, jy, 1.2, 0.64, t => 0.18 * blade(t), [86, 146, 54], { teeth: 16, depth: 0.1, bend: 0.06, veins: 5 });
  stalk(g, C[0][0] + 0.01, C[0][1] - C[0][2] * 0.84, C[0][0] + 0.06, -0.4, jx, jy, 0.038, [126, 152, 64]);
  stalk(g, C[1][0] + 0.01, C[1][1] - C[1][2] * 0.84, C[1][0] + 0.02, -0.36, jx, jy, 0.038, [126, 152, 64]);
  for (const [x, y, r] of C) {
    ball(g, x, y, r, r * 0.95, CHERRY, { lit: 1.8, dim: 0.42, gleam: 0.9, back: 0.4 });
    strokeIn(g, 'rgba(70, 0, 14, 0.3)', 0.022, () => { g.moveTo(x + 0.02, y - r * 0.84); g.quadraticCurveTo(x + r * 0.4, y, x + r * 0.12, y + r * 0.86); });   // its crease
    furGlow(g, [56, 0, 10], 0.6, x + 0.01, y - r * 0.82, r * 0.26, r * 0.1);                 // where the stalk goes in
  }
  fillIn(g, 'rgb(96, 70, 40)', () => ovalAt(g, jx, jy, 0.035, 0.03));
}

// Blackberries: each a cluster of round shiny drupelets, inky purple and catching the light one by one, the green
// calyx folded back at the top; an unripe red one beside them, and a bramble leaf with its teeth.
function berry(g, x, y, rx, ry, base, k) {
  ball(g, x, y, rx * 0.94, ry * 0.94, tone(base, 0.6), { gleam: 0, back: 0 });
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const ph = -1.2 + i / 6 * 2.45, n = Math.max(4, Math.round(Math.cos(ph) * 12));
    for (let j = 0; j < n; j++) {
      const th = (j + (i % 2) * 0.5) / n * TAU + jit(k, i) * 0.5, z = Math.cos(ph) * Math.cos(th);
      if (z > -0.15) pts.push([rx * Math.cos(ph) * Math.sin(th), ry * Math.sin(ph), z]);
    }
  }
  pts.sort((a, b) => a[2] - b[2]);
  const dr = rx * 0.3;
  for (const [px, py, z] of pts) {
    const l = clamp(0.8 + 0.3 * z - 0.22 * px / rx - 0.2 * py / ry, 0.45, 1.25), r = dr * (0.78 + 0.26 * z);
    ball(g, x + px, y + py, r, r * 0.96, tone(base, l), { lit: 1.7, dim: 0.42, gleam: clamp(0.15 + 0.7 * z - 0.3 * (px + py) / rx, 0.1, 0.9), back: 0.25 });
  }
}
function calyx(g, x, y, r, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    leaf(g, 0, 0, a + Math.PI / 2 + (a + Math.PI / 2) * 0.6, r, t => r * 0.22 * blade(t), tone([104, 140, 56], 0.9 + i * 0.05), { veins: 0, vein: 0.3, sheen: 0.2, bend: (i - 2) * 0.02 });
  }
  g.restore();
}
function paintBlackberry(g) {
  touch(g, -0.02, 0.8, 0.6);
  // The leaf behind, three leaflets with teeth, and the thorny stalk the berries hang from.
  for (const [a, len, w] of [[-0.9, 0.62, 0.2], [0.2, 0.74, 0.24], [1.2, 0.6, 0.2]]) leaf(g, 0.3, -0.5, a, len, t => w * heart(t), [62, 112, 48], { teeth: 14, depth: 0.14, veins: 5, vein: 0.4 });
  stalk(g, -0.62, -0.7, -0.2, -0.76, 0.3, -0.5, 0.05, [116, 96, 56]);
  stalk(g, -0.08, -0.72, -0.12, -0.42, -0.12, -0.2, 0.04, [120, 120, 60]);
  stalk(g, 0.2, -0.56, 0.36, -0.46, 0.4, -0.28, 0.035, [120, 120, 60]);
  stalk(g, -0.46, -0.72, -0.5, -0.6, -0.5, -0.48, 0.03, [120, 120, 60]);
  fillIn(g, 'rgb(176, 120, 90)', () => { for (const [x, y, a] of [[-0.42, -0.72, -1.4], [-0.02, -0.74, -1.2], [-0.12, -0.36, 2.6]]) { g.moveTo(x - 0.025, y); g.lineTo(x + Math.cos(a) * 0.06, y + Math.sin(a) * 0.06); g.lineTo(x + 0.025, y); } });   // thorns
  berry(g, -0.5, -0.32, 0.15, 0.18, [184, 38, 42], 3);                                     // not ripe yet
  calyx(g, -0.5, -0.47, 0.13, 0);
  berry(g, 0.4, -0.06, 0.25, 0.3, [44, 22, 50], 1);
  calyx(g, 0.4, -0.32, 0.17, 0.2);
  berry(g, -0.12, 0.26, 0.33, 0.4, [42, 20, 48], 2);
  calyx(g, -0.12, -0.12, 0.2, 0);
}

// Wild strawberries: small and red, their seeds sitting in little dimples, the green ruff of sepals at the top, hanging
// from thin stalks; a leaf of three toothed leaflets behind, and one white flower.
const STRAW = [222, 34, 42];
function strawb(g, x, y, s, ang, k) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const path = () => { g.moveTo(0, -0.28); g.bezierCurveTo(0.26, -0.32, 0.32, -0.06, 0.24, 0.1); g.bezierCurveTo(0.16, 0.28, 0.06, 0.36, 0, 0.37); g.bezierCurveTo(-0.06, 0.36, -0.16, 0.28, -0.24, 0.1); g.bezierCurveTo(-0.32, -0.06, -0.26, -0.32, 0, -0.28); g.closePath(); };
  const gr = g.createRadialGradient(-0.1, -0.12, 0.02, 0, 0.02, 0.38);
  gr.addColorStop(0, 'rgb(255, 110, 96)'); gr.addColorStop(0.45, rgba(STRAW)); gr.addColorStop(1, 'rgb(130, 8, 24)');
  g.fillStyle = gr; g.beginPath(); path(); g.fill();
  g.save(); g.beginPath(); path(); g.clip();
  furGlow(g, [255, 200, 120], 0.25, 0.0, 0.3, 0.1, 0.08);                                     // paler at the tip
  for (let r = 0; r < 6; r++) {
    const yy = -0.2 + r * 0.1, half = r < 3 ? 0.26 : 0.26 - (r - 2) * 0.06, n = Math.max(2, Math.round(half * 16));
    for (let c = 0; c < n; c++) {
      const xx = -half + (c + 0.5 + (r % 2) * 0.3) / n * half * 2, edge = 1 - Math.abs(xx) / (half + 0.02);
      fillIn(g, `rgba(110, 0, 12, ${0.35 * edge})`, () => ovalAt(g, xx, yy, 0.028 * (0.5 + edge * 0.5), 0.02));
      fillIn(g, `rgba(252, 220, 110, ${0.4 + edge * 0.5})`, () => ovalAt(g, xx, yy - 0.006, 0.014 * (0.5 + edge * 0.5), 0.011));
    }
  }
  furGlow(g, [96, 0, 16], 0.5, 0.18, 0.06, 0.12, 0.3);
  g.restore();
  fillIn(g, 'rgba(255, 255, 255, 0.85)', () => ovalAt(g, -0.13, -0.14, 0.05, 0.024, -0.9));
  for (let i = 0; i < 7; i++) {                                                               // the sepals, spread round the top
    const a = Math.PI + (i + 0.5) / 7 * Math.PI, len = 0.18 + jit(k, i) * 0.06;
    g.save(); g.translate(0, -0.27); g.scale(1, 0.55);
    leaf(g, 0, 0, a - Math.PI / 2 + Math.PI, len, t => 0.05 * blade(t), tone([96, 150, 52], 0.85 + jit(k, i + 7) * 0.3), { veins: 0, vein: 0.3, sheen: 0.25 });
    g.restore();
  }
  g.restore();
}
function paintStrawberry(g) {
  touch(g, 0.04, 0.8, 0.6);
  for (const a of [-0.5, 0.15, 0.8]) leaf(g, -0.3, -0.12, a, 0.56, t => 0.2 * heart(t), [64, 124, 48], { teeth: 11, depth: 0.2, veins: 5, vein: 0.45 });
  stalk(g, -0.3, 0.3, -0.32, 0.1, -0.3, -0.12, 0.035, [130, 150, 70]);
  // The flower, five round white petals and a yellow eye.
  const fx = 0.5, fy = -0.56;
  stalk(g, 0.2, -0.24, 0.42, -0.4, fx, fy, 0.025, [140, 160, 76]);
  for (let p = 0; p < 5; p++) { const a = p / 5 * TAU - 0.3; softIn(g, [252, 250, 240], fy - 0.2, fy + 0.2, () => ovalAt(g, fx + Math.cos(a) * 0.1, fy + Math.sin(a) * 0.09, 0.1, 0.09, a), 1.04, 0.84); }
  ball(g, fx, fy, 0.065, 0.06, [236, 200, 60], { lit: 1.2, dim: 0.7, gleam: 0, back: 0 });
  // The stalks, and the berries hanging from them.
  const top = [0.12, -0.6];
  for (const [x, y, s, a, k] of [[0.46, 0.04, 0.9, -0.3, 2], [-0.34, 0.32, 1.05, 0.25, 0], [0.1, 0.42, 1.25, -0.05, 1]]) {
    stalk(g, ...top, (top[0] + x) / 2 + (x - top[0]) * 0.2, top[1] + 0.05, x, y - 0.28 * s, 0.026, [140, 156, 72]);
    strawb(g, x, y, s, a, k);
  }
}

// Rosehips: a thorny sprig of wild rose with three glossy hips, scarlet going to orange, each with the dry dark sepals
// still on its end, and a leaf of small toothed leaflets.
const HIP = [220, 56, 26];
function hip(g, x, y, s, ang, k) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  stalk(g, 0, 0.34, 0.0, 0.42, 0, 0.5, 0.04, [120, 70, 40]);
  ball(g, 0, 0, 0.2, 0.29, HIP, { lit: 1.5, dim: 0.5, gleam: 0.9, back: 0.35 });
  furGlow(g, [255, 150, 40], 0.35, -0.05, 0.12, 0.12, 0.16);                                 // orange where the sun was less
  // The sepals at its end: a dark little crown, curling.
  strokeIn(g, 'rgb(74, 36, 24)', 0.04, () => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; g.moveTo(0, -0.29); g.quadraticCurveTo(Math.cos(a) * 0.07, -0.34 + Math.sin(a) * 0.05, Math.cos(a) * 0.1 + (jit(k, i) - 0.5) * 0.04, -0.37 + Math.sin(a) * 0.03); } });
  fillIn(g, 'rgb(90, 40, 24)', () => ovalAt(g, 0, -0.3, 0.05, 0.025));
  g.restore();
}
function paintRosehip(g) {
  touch(g, 0, 0.8, 0.6);
  stalk(g, -0.66, 0.74, -0.2, 0.1, 0.42, -0.72, 0.055, [122, 58, 42]);
  fillIn(g, 'rgb(170, 96, 70)', () => { for (const t of [0.18, 0.4, 0.62, 0.84]) {           // hooked thorns
    const x = -0.66 + t * 1.08 + Math.sin(t * Math.PI) * 0.12, y = 0.74 - t * 1.46, s = t * 7 % 2 > 1 ? 1 : -1;
    g.moveTo(x - 0.03, y + 0.02); g.quadraticCurveTo(x + s * 0.04, y - 0.02, x + s * 0.08, y + 0.06); g.lineTo(x + 0.03, y - 0.02);
  } });
  for (const [a, len] of [[-0.4, 0.3], [0.5, 0.32], [0.05, 0.36]]) leaf(g, 0.3, -0.5, a + 0.9, len, t => 0.11 * heart(t), [96, 126, 50], { teeth: 10, depth: 0.16, veins: 3, vein: 0.4 });
  hip(g, 0.08, -0.4, 0.9, 0.3, 0);
  hip(g, 0.36, 0.02, 0.9, 1.3, 1);
  hip(g, -0.32, 0.06, 0.95, -0.95, 2);
}

// Elderflower: a flat head of tiny creamy flowers, five petals and a yellow eye each, held up in little bunches on fine
// branching stalks; a pair of toothed leaflets below it.
function paintElderflower(g) {
  touch(g, 0, 0.82, 0.44);
  for (const s of [-1, 1]) leaf(g, 0, 0.5, s * 1.25, 0.64, t => 0.17 * blade(t), tone([78, 128, 52], s > 0 ? 1 : 1.1), { teeth: 14, depth: 0.12, bend: s * -0.06, veins: 5 });
  stalk(g, 0.02, 0.86, 0.0, 0.5, 0, 0.18, 0.05, [140, 162, 92]);
  // The bunches, round a dome seen a little from the side; the stalks out to them.
  const hubs = [[0, -0.24]];
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; hubs.push([Math.cos(a) * 0.48, -0.24 + Math.sin(a) * 0.24]); }
  strokeIn(g, 'rgb(118, 146, 70)', 0.03, () => { for (const [hx, hy] of hubs) { g.moveTo(0, 0.18); g.quadraticCurveTo(hx * 0.5, 0.06 + hy * 0.2, hx, hy + 0.08); } });
  furGlow(g, [80, 90, 50], 0.35, 0, -0.1, 0.6, 0.22);                                         // the shade under the head
  const fl = [];
  hubs.forEach(([hx, hy], h) => { for (let i = 0; i < 17; i++) { const a = jit(h + 20, i) * TAU, r = Math.sqrt(jit(h + 40, i)) * 0.22; fl.push([hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.6 - (0.21 - r) * 0.25, jit(h + 60, i)]); } });
  fl.sort((a, b) => a[1] - b[1]);
  for (const [x, y, q] of fl) {
    const depth = clamp((y + 0.5) / 0.6, 0, 1), c = tone([250, 244, 214], 0.92 + depth * 0.1 - Math.max(0, x) * 0.06);
    if (q < 0.12) { ball(g, x, y, 0.026, 0.024, [218, 224, 166], { gleam: 0, back: 0 }); continue; }   // a bud still shut
    fillIn(g, 'rgba(150, 140, 90, 0.3)', () => discAt(g, x + 0.008, y + 0.01, 0.05));
    fillIn(g, rgba(c), () => { for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + q * 2; ovalAt(g, x + Math.cos(a) * 0.027, y + Math.sin(a) * 0.022, 0.026, 0.021, a); } });
    fillIn(g, 'rgb(230, 196, 74)', () => discAt(g, x, y, 0.012));
  }
  furGlow(g, [255, 255, 240], 0.35, -0.2, -0.4, 0.3, 0.12);
}

// ------------------------------------------------------------------ honey and nuts

// Honey: a broken piece of comb, its six-sided cells brimming with amber and gleaming, a few still capped with pale wax,
// its broken edge showing how thick it is, and a drip running off the bottom.
function paintHoney(g) {
  touch(g, 0, 0.76, 0.7, 0.2);
  const P = [[-0.78, -0.34], [-0.52, -0.5], [-0.22, -0.44], [0.06, -0.56], [0.36, -0.48], [0.62, -0.54], [0.8, -0.3], [0.74, 0.02], [0.8, 0.3], [0.6, 0.46], [0.2, 0.4], [-0.1, 0.48], [-0.46, 0.42], [-0.76, 0.36], [-0.7, 0.02]];
  const slab = dy => () => { const m = i => [(P[i][0] + P[(i + 1) % P.length][0]) / 2, (P[i][1] + P[(i + 1) % P.length][1]) / 2 + dy]; g.moveTo(...m(P.length - 1)); for (let i = 0; i < P.length; i++) g.quadraticCurveTo(P[i][0], P[i][1] + dy, ...m(i)); g.closePath(); };
  softIn(g, [198, 118, 18], -0.4, 0.6, slab(0.13), 1.0, 0.6);                                // its thickness, under the face
  strokeIn(g, 'rgba(240, 190, 90, 0.5)', 0.012, () => { for (let i = 0; i < 9; i++) { const x = -0.7 + i * 0.17; g.moveTo(x, 0.36 + jit(5, i) * 0.06); g.lineTo(x + 0.01, 0.5 + jit(5, i) * 0.06); } });   // the cell walls down its edge
  const face = slab(0);
  softIn(g, [236, 184, 80], -0.56, 0.48, face, 1.08, 0.8);                                    // the wax
  g.save(); g.beginPath(); face(); g.clip();
  const R = 0.13, hex = (x, y, r) => { for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; k ? g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); } };
  for (let row = -1; row < 9; row++) for (let col = -1; col < 9; col++) {
    const x = -0.86 + col * R * Math.sqrt(3) + (row % 2) * R * Math.sqrt(3) / 2, y = -0.62 + row * R * 1.5;
    const capped = jit(row + 9, col + 3) > 0.55 && x + y < -0.35;
    if (capped) {
      softIn(g, [246, 222, 150], y - R, y + R, () => hex(x, y, R * 0.84), 1.08, 0.8);
      furGlow(g, [255, 248, 220], 0.6, x - R * 0.25, y - R * 0.25, R * 0.4, R * 0.3);
    } else {
      const gr = g.createRadialGradient(x - R * 0.2, y - R * 0.3, R * 0.05, x, y, R * 0.9);
      gr.addColorStop(0, 'rgb(254, 206, 80)'); gr.addColorStop(0.55, 'rgb(214, 124, 14)'); gr.addColorStop(1, 'rgb(150, 70, 6)');
      g.fillStyle = gr; g.beginPath(); hex(x, y, R * 0.8); g.fill();
      fillIn(g, 'rgba(255, 250, 220, 0.75)', () => ovalAt(g, x - R * 0.3, y - R * 0.34, R * 0.2, R * 0.08, -0.5));
    }
    strokeIn(g, 'rgba(160, 96, 20, 0.45)', 0.01, () => hex(x, y, R * 0.84));
  }
  furGlow(g, [140, 70, 4], 0.4, 0.5, 0.2, 0.5, 0.4);
  furGlow(g, [255, 236, 170], 0.3, -0.4, -0.3, 0.4, 0.2);
  g.restore();
  strokeIn(g, 'rgba(255, 236, 170, 0.7)', 0.024, () => { g.moveTo(-0.7, -0.38); g.quadraticCurveTo(-0.52, -0.5, -0.36, -0.47); g.quadraticCurveTo(-0.08, -0.5, 0.06, -0.53); });
  // The drip.
  const dx = 0.16, dy = 0.46, drip = () => { g.moveTo(dx - 0.07, dy); g.quadraticCurveTo(dx - 0.02, dy + 0.08, dx - 0.045, dy + 0.18); g.arc(dx, dy + 0.21, 0.055, Math.PI * 1.15, -Math.PI * 0.15, true); g.quadraticCurveTo(dx + 0.02, dy + 0.08, dx + 0.07, dy); g.closePath(); };
  softIn(g, [226, 140, 20], dy, dy + 0.28, drip, 1.2, 0.72);
  fillIn(g, 'rgba(255, 246, 210, 0.85)', () => ovalAt(g, dx - 0.02, dy + 0.2, 0.014, 0.03));
}

// Acorns: two in their cups, the cups knobbly with little scales and a stub of stalk, the nuts smooth and faintly striped,
// shining, with a point at the end; an oak leaf with its round lobes behind.
function acorn(g, x, y, s, ang, k) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const nut = () => { g.moveTo(-0.24, -0.06); g.bezierCurveTo(-0.27, 0.28, -0.1, 0.46, 0, 0.5); g.bezierCurveTo(0.1, 0.46, 0.27, 0.28, 0.24, -0.06); g.closePath(); };
  softIn(g, [178, 124, 58], -0.06, 0.5, nut, 1.24, 0.6);
  g.save(); g.beginPath(); nut(); g.clip();
  strokeIn(g, 'rgba(120, 76, 30, 0.28)', 0.014, () => { for (let i = -3; i <= 3; i++) { g.moveTo(i * 0.07, -0.06); g.quadraticCurveTo(i * 0.09, 0.24, i * 0.02, 0.5); } });
  furGlow(g, [96, 56, 20], 0.5, 0.2, 0.2, 0.14, 0.34);
  furGlow(g, [255, 236, 200], 0.55, -0.12, 0.16, 0.05, 0.18, 0.1);                          // its shine
  g.restore();
  fillIn(g, 'rgb(96, 64, 30)', () => ovalAt(g, 0, 0.5, 0.025, 0.03));
  stalk(g, 0, -0.32, 0.02, -0.42, 0.06, -0.48, 0.04, [116, 88, 52]);
  const cup = () => { g.moveTo(-0.3, -0.02); g.quadraticCurveTo(-0.32, -0.36, 0, -0.37); g.quadraticCurveTo(0.32, -0.36, 0.3, -0.02); g.quadraticCurveTo(0, 0.07, -0.3, -0.02); g.closePath(); };
  softIn(g, [146, 118, 72], -0.37, 0.05, cup, 1.2, 0.66);
  g.save(); g.beginPath(); cup(); g.clip();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) {                                // the scales, row on row
    const sx = -0.32 + c * 0.08 + (r % 2) * 0.04, sy = -0.32 + r * 0.075 + Math.abs(sx) * 0.12;
    fillIn(g, rgba(tone([150, 124, 78], 0.85 + jit(k + r, c) * 0.3 - Math.max(0, sx) * 0.4)), () => ovalAt(g, sx, sy, 0.045, 0.034));
    strokeIn(g, 'rgba(80, 60, 30, 0.4)', 0.01, () => { g.moveTo(sx - 0.04, sy + 0.01); g.quadraticCurveTo(sx, sy + 0.05, sx + 0.04, sy + 0.01); });
  }
  furGlow(g, [70, 50, 24], 0.5, 0.24, -0.1, 0.16, 0.24);
  g.restore();
  strokeIn(g, 'rgba(200, 176, 124, 0.8)', 0.02, () => { g.moveTo(-0.29, -0.02); g.quadraticCurveTo(0, 0.06, 0.29, -0.02); });
  g.restore();
}
function paintAcorns(g) {
  touch(g, 0, 0.8, 0.6);
  leaf(g, 0.18, 0.6, 0.7, 1.04, t => 0.26 * blade(t), [126, 140, 56], { teeth: 5, depth: 0.85, round: true, veins: 5, vein: 0.5 });
  acorn(g, 0.34, 0.06, 1.1, 0.42, 3);
  acorn(g, -0.26, 0.0, 1.32, -0.22, 0);
}

// Beechnuts: an opened husk, its four woody valves spread like a star, bristly outside and pale and velvety in, the two
// three-sided nuts still sitting in it, glossy chestnut; and one loose.
function triNut(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const path = () => { g.moveTo(0, -0.36); g.quadraticCurveTo(0.2, -0.12, 0.2, 0.18); g.quadraticCurveTo(0, 0.26, -0.2, 0.18); g.quadraticCurveTo(-0.2, -0.12, 0, -0.36); g.closePath(); };
  softIn(g, [156, 92, 48], -0.36, 0.24, path, 1.4, 0.56);
  g.save(); g.beginPath(); path(); g.clip();
  fillIn(g, 'rgba(70, 34, 14, 0.45)', () => { g.moveTo(0, -0.36); g.quadraticCurveTo(0.04, -0.05, 0.05, 0.24); g.lineTo(0.3, 0.3); g.lineTo(0.3, -0.36); g.closePath(); });   // the far face, in shade
  furGlow(g, [255, 220, 180], 0.5, -0.08, -0.08, 0.05, 0.16, 0.25);
  furGlow(g, [220, 196, 150], 0.6, 0, 0.2, 0.16, 0.05);                                       // pale where it sat in the husk
  g.restore();
  strokeIn(g, 'rgba(236, 180, 130, 0.55)', 0.018, () => { g.moveTo(0, -0.33); g.quadraticCurveTo(0.03, -0.05, 0.045, 0.2); });   // the ridge
  fillIn(g, 'rgba(240, 230, 200, 0.8)', () => ovalAt(g, 0, -0.36, 0.02, 0.03));                // the tuft at its tip
  g.restore();
}
function paintBeechnuts(g) {
  touch(g, 0.04, 0.72, 0.62);
  const cx = 0.0, cy = 0.22;
  for (const a of [-2.25, 2.35, -0.75, 0.8]) {                                               // the valves, back ones first
    g.save(); g.translate(cx, cy); g.scale(1, 0.72); g.rotate(a);
    const v = () => { g.moveTo(-0.08, 0); g.bezierCurveTo(-0.26, -0.2, -0.2, -0.56, 0, -0.66); g.bezierCurveTo(0.2, -0.56, 0.26, -0.2, 0.08, 0); g.closePath(); };
    strokeIn(g, 'rgba(110, 80, 44, 0.85)', 0.02, () => { for (let i = 0; i < 26; i++) { const t = i / 25, sx = (t < 0.5 ? -1 : 1), u = t < 0.5 ? t * 2 : (1 - t) * 2, px = sx * 0.2 * Math.sin(u * Math.PI * 0.9 + 0.2), py = -0.06 - u * 0.58; g.moveTo(px, py); g.lineTo(px * 1.4, py - 0.05); } });   // bristles round its edge
    softIn(g, [128, 94, 52], -0.66, 0, v, 1.2, 0.7);
    const inner = () => { g.moveTo(-0.05, -0.04); g.bezierCurveTo(-0.19, -0.2, -0.15, -0.5, 0, -0.58); g.bezierCurveTo(0.15, -0.5, 0.19, -0.2, 0.05, -0.04); g.closePath(); };
    softIn(g, [200, 172, 122], -0.58, 0, inner, 1.08, 0.74);
    furGlow(g, [150, 120, 80], 0.35, 0, -0.08, 0.1, 0.14);
    g.restore();
  }
  triNut(g, -0.12, 0.04, 1.08, -0.3);
  triNut(g, 0.16, 0.08, 1.02, 0.34);
  triNut(g, 0.52, 0.56, 0.86, 1.35);
}

// Hazelnuts: two still in their frilly husks, green going brown at the ragged tips, and one out of it lying in front: round
// and pointed, the shell glossy and finely streaked, the rough pale scar where it sat.
function hazelNut(g, s) {
  const nut = () => { g.moveTo(0, -0.36); g.bezierCurveTo(0.2, -0.34, 0.31, -0.08, 0.3, 0.1); g.bezierCurveTo(0.29, 0.3, 0.14, 0.36, 0, 0.36); g.bezierCurveTo(-0.14, 0.36, -0.29, 0.3, -0.3, 0.1); g.bezierCurveTo(-0.31, -0.08, -0.2, -0.34, 0, -0.36); g.closePath(); };
  softIn(g, [184, 116, 56], -0.36, 0.36, nut, 1.3, 0.56);
  g.save(); g.beginPath(); nut(); g.clip();
  strokeIn(g, 'rgba(110, 60, 24, 0.32)', 0.012, () => { for (let i = -5; i <= 5; i++) { g.moveTo(i * 0.012, -0.36); g.quadraticCurveTo(i * 0.07, -0.05, i * 0.05, 0.36); } });
  furGlow(g, [90, 44, 16], 0.5, 0.22, 0.12, 0.16, 0.3);
  softIn(g, [214, 196, 158], 0.2, 0.4, () => ovalAt(g, 0, 0.32, 0.28, 0.12), 1.05, 0.8);     // the scar
  fillIn(g, 'rgba(150, 126, 90, 0.55)', () => { for (let i = 0; i < 18; i++) ovalAt(g, (jit(s, i) - 0.5) * 0.44, 0.27 + jit(s, i + 30) * 0.08, 0.012, 0.009); });
  g.restore();
  furGlow(g, [255, 236, 210], 0.6, -0.13, -0.12, 0.05, 0.14, 0.3);
  fillIn(g, 'rgba(240, 226, 196, 0.8)', () => ovalAt(g, 0, -0.36, 0.022, 0.03));
}
function hazelHusk(g, x, y, s, ang, k) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  hazelNut(g, k);
  const husk = () => {
    g.moveTo(-0.33, 0.2);
    for (let i = 0; i <= 12; i++) { const t = i / 12, px = -0.36 + t * 0.72, up = i % 2 ? -0.06 - jit(k, i) * 0.12 : 0.06; g.lineTo(px, up + Math.abs(px) * 0.2); }
    g.bezierCurveTo(0.38, 0.32, 0.22, 0.5, 0, 0.52); g.bezierCurveTo(-0.22, 0.5, -0.38, 0.32, -0.33, 0.2); g.closePath();
  };
  softIn(g, [176, 186, 98], -0.2, 0.52, husk, 1.18, 0.66);
  g.save(); g.beginPath(); husk(); g.clip();
  furGlow(g, [168, 120, 58], 0.75, 0, -0.12, 0.4, 0.1);                                      // browned at the tips
  strokeIn(g, 'rgba(110, 120, 50, 0.4)', 0.012, () => { for (let i = -4; i <= 4; i++) { g.moveTo(i * 0.04, 0.5); g.quadraticCurveTo(i * 0.08, 0.2, i * 0.09, -0.1); } });
  furGlow(g, [80, 90, 30], 0.45, 0.22, 0.3, 0.16, 0.22);
  g.restore();
  g.restore();
}
function paintHazelnut(g) {
  touch(g, 0, 0.78, 0.6);
  stalk(g, -0.22, -0.02, -0.02, -0.5, 0.24, -0.06, 0.04, [130, 110, 60]);
  hazelHusk(g, 0.26, -0.24, 1.0, 0.35, 2);
  hazelHusk(g, -0.26, -0.18, 1.08, -0.3, 1);
  g.save(); g.translate(0.08, 0.42); g.rotate(1.2); g.scale(1.05, 1.05); hazelNut(g, 4); g.restore();
}

// ------------------------------------------------------------------ for the fire

// Sticks: three thin dry ones crossed, bark grey-brown with fine cracks along it, a stub where a twig came off, pale
// where one was snapped, a fleck of lichen.
function stick(g, x0, y0, x1, y1, w, rgb, k) {
  const N = 4, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const pt = i => { const t = i / N, off = i && i < N ? (jit(k, i) - 0.5) * 0.06 : 0; return [x0 + dx * t + nx * off, y0 + dy * t + ny * off]; };
  const path = () => { g.moveTo(...pt(0)); for (let i = 1; i <= N; i++) g.lineTo(...pt(i)); };
  // A twig off it, where it kinks.
  const [bx, by] = pt(2), ta = Math.atan2(dy, dx) - 0.7 * (k % 2 ? 1 : -1), tx = bx + Math.cos(ta) * 0.16, ty = by + Math.sin(ta) * 0.16;
  for (const [p, ww] of [[() => { g.moveTo(bx, by); g.lineTo(tx, ty); }, w * 0.45], [path, w]]) {
    strokeIn(g, rgba(tone(rgb, 0.55)), ww * 1.3, p);
    strokeIn(g, rgba(rgb), ww, p);
    g.save(); g.translate(-ww * 0.2, -ww * 0.24); strokeIn(g, rgba(tone(rgb, 1.32, 22), 0.75), ww * 0.32, p); g.restore();
  }
  strokeIn(g, rgba(tone(rgb, 0.5), 0.5), w * 0.12, () => { for (let i = 0; i < 9; i++) { const t = 0.06 + i / 9 * 0.88, o = (jit(k + 5, i) - 0.4) * w * 0.5, cx = x0 + dx * t + nx * o, cy = y0 + dy * t + ny * o; g.moveTo(cx, cy); g.lineTo(cx + dx / L * 0.07, cy + dy / L * 0.07); } });
  fillIn(g, 'rgb(226, 196, 148)', () => ovalAt(g, tx, ty, w * 0.22, w * 0.2));             // the twig's broken end
  softIn(g, [228, 198, 150], y1 - w, y1 + w, () => ovalAt(g, x1, y1, w * 0.55, w * 0.5, Math.atan2(dy, dx)), 1.1, 0.8);   // the snapped end
  strokeIn(g, 'rgba(150, 110, 70, 0.6)', w * 0.08, () => ovalAt(g, x1, y1, w * 0.28, w * 0.25, Math.atan2(dy, dx)));
}
function paintSticks(g) {
  touch(g, 0, 0.66, 0.66, 0.14);
  stick(g, -0.7, 0.42, 0.68, -0.5, 0.1, [118, 92, 66], 1);
  stick(g, -0.66, -0.22, 0.74, 0.34, 0.085, [100, 80, 60], 2);
  stick(g, -0.5, 0.6, 0.62, 0.08, 0.075, [134, 104, 72], 3);
  furGlow(g, [196, 206, 150], 0.85, 0.22, -0.16, 0.06, 0.04, 0, 0.4);                        // lichen
  fillIn(g, 'rgba(210, 220, 170, 0.9)', () => { ovalAt(g, 0.18, -0.15, 0.02, 0.015); ovalAt(g, 0.26, -0.19, 0.016, 0.012); });
}

// Pebbles: four smooth stones from the brook, a blue-grey, a warm sandstone, a dark one with a white band round it and a
// little white quartz, matte, speckled, softly lit.
function pebble(g, x, y, rx, ry, rot, rgb, k, band) {
  furGlow(g, [70, 50, 30], 0.28, x + 0.04, y + ry * 0.75, rx * 1.05, ry * 0.32);
  ball(g, x, y, rx, ry, rgb, { lit: 1.32, dim: 0.58, gleam: 0, back: 0.2, rot });
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); ovalAt(g, 0, 0, rx, ry); g.clip();
  fillIn(g, rgba(tone(rgb, 0.6), 0.5), () => { for (let i = 0; i < 22; i++) ovalAt(g, (jit(k, i) - 0.5) * rx * 1.8, (jit(k, i + 40) - 0.5) * ry * 1.8, 0.01, 0.008); });
  fillIn(g, rgba(tone(rgb, 1.3, 30), 0.5), () => { for (let i = 0; i < 14; i++) ovalAt(g, (jit(k + 1, i) - 0.5) * rx * 1.8, (jit(k + 1, i + 40) - 0.5) * ry * 1.8, 0.009, 0.007); });
  if (band) { strokeIn(g, 'rgba(236, 232, 222, 0.85)', ry * 0.18, () => { g.moveTo(-rx * 0.3, -ry); g.bezierCurveTo(-rx * 0.1, -ry * 0.2, rx * 0.2, ry * 0.2, rx * 0.1, ry); }); furGlow(g, tone(rgb, 0.5), 0.5, rx * 0.4, ry * 0.4, rx * 0.5, ry * 0.5); }
  g.restore();
  furGlow(g, [255, 255, 250], 0.32, x - rx * 0.32, y - ry * 0.42, rx * 0.4, ry * 0.24);       // a matte sheen
}
function paintPebbles(g) {
  touch(g, 0, 0.68, 0.7, 0.12);
  pebble(g, 0.32, -0.12, 0.34, 0.25, 0.35, [196, 164, 122], 2, false);
  pebble(g, -0.3, -0.04, 0.42, 0.29, -0.2, [124, 132, 142], 1, false);
  pebble(g, 0.02, 0.38, 0.33, 0.22, 0.1, [86, 84, 84], 3, true);
  pebble(g, 0.5, 0.36, 0.19, 0.15, -0.4, [234, 230, 220], 4, false);
}

// Dry grass: a twisted bundle of it, stems bleached gold and straw, some bowed over with oat-like seed heads, tied round
// the middle with a few stems of its own.
function paintDryGrass(g) {
  touch(g, 0, 0.8, 0.44);
  const bx = 0, by = 0.38, stems = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 23, a = (t - 0.5) * 2.1 + (jit(20, i) - 0.5) * 0.2, len = 0.95 + jit(21, i) * 0.4 - Math.abs(t - 0.5) * 0.4;
    stems.push([a, len, jit(22, i), (jit(23, i) - 0.5) * 0.14]);
  }
  stems.sort((p, q) => p[2] - q[2]);
  for (const [a, len, q, foot] of stems) {
    const ex = bx + Math.sin(a) * len, ey = by - Math.cos(a) * len * 0.92 + Math.abs(a) * Math.abs(a) * 0.28;
    const cx = bx + Math.sin(a) * len * 0.35, cy = by - len * 0.6;
    const rgb = tone([216, 186, 112], 0.8 + q * 0.35);
    const p = () => { g.moveTo(foot, 0.8); g.lineTo(bx + foot * 0.3, by); g.quadraticCurveTo(cx, cy, ex, ey); };
    strokeIn(g, rgba(tone(rgb, 0.62)), 0.044, p);
    strokeIn(g, rgba(rgb), 0.03, p);
    g.save(); g.translate(-0.008, -0.006); strokeIn(g, rgba(tone(rgb, 1.2, 20), 0.6), 0.01, p); g.restore();
    if (q > 0.55) {                                                                           // a seed head, its spikelets dangling
      for (let s = 0; s < 5; s++) {
        const u = 0.7 + s * 0.06, px = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cx + u * u * ex, py = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy + u * u * ey;
        const sa = a + (s % 2 ? 0.7 : -0.7) + Math.PI;
        softIn(g, tone([232, 206, 136], 0.85 + q * 0.2), py - 0.06, py + 0.06, () => ovalAt(g, px + Math.sin(sa) * -0.035, py + Math.cos(sa) * 0.035, 0.02, 0.045, -sa), 1.15, 0.7);
      }
    }
  }
  fillIn(g, 'rgb(236, 220, 170)', () => { for (const [, , , foot] of stems) ovalAt(g, foot, 0.8, 0.014, 0.008); });   // the cut ends
  for (const dy of [-0.03, 0.04]) {                                                           // the tie
    const p = () => { g.moveTo(-0.14, by + dy - 0.02); g.quadraticCurveTo(0, by + dy + 0.05, 0.14, by + dy - 0.02); };
    strokeIn(g, 'rgb(120, 96, 50)', 0.055, p); strokeIn(g, 'rgb(170, 140, 76)', 0.035, p);
    g.save(); g.translate(-0.01, -0.012); strokeIn(g, 'rgba(230, 210, 150, 0.7)', 0.01, p); g.restore();
  }
  strokeIn(g, 'rgb(160, 130, 70)', 0.026, () => { g.moveTo(0.12, by); g.quadraticCurveTo(0.26, by + 0.06, 0.3, by + 0.2); });
}

// Birch bark: a curl of it rolled up tight, chalk white and lit along the top, the dark lenticel dashes running round
// it, its end showing the coil of the tan inner side; and a smaller loose curl beside.
function scroll(g, x, y, ang, L, r, k) {
  g.save(); g.translate(x, y); g.rotate(ang);
  furGlow(g, [80, 60, 40], 0.25, 0.04, r * 0.95, L * 1.05, r * 0.3);
  const body = () => { g.moveTo(-L, -r); g.lineTo(L, -r); g.ellipse(L, 0, r * 0.34, r, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(-L, r); g.closePath(); };
  softIn(g, [238, 234, 224], -r, r, body, 1.08, 0.66);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [255, 255, 252], 0.8, 0, -r * 0.42, L * 1.1, r * 0.2);                          // lit along the top
  furGlow(g, [150, 140, 128], 0.4, 0, r * 0.75, L * 1.1, r * 0.3);
  furGlow(g, [196, 170, 140], 0.3, L * 0.3, r * 0.1, L * 0.3, r * 0.5);                      // a warm smudge
  strokeIn(g, 'rgba(50, 42, 38, 0.75)', 0.028, () => {                                         // the lenticels, round the roll
    for (let i = 0; i < 9; i++) {
      const lx = -L * 0.85 + i / 8 * L * 1.75 + (jit(k, i) - 0.5) * 0.06, ly = (jit(k, i + 9) - 0.5) * r * 1.3, h = r * (0.18 + jit(k, i + 18) * 0.22);
      g.moveTo(lx + 0.01 * (ly / r), ly - h); g.quadraticCurveTo(lx + 0.02, ly, lx + 0.01 * (ly / r), ly + h);
    }
  });
  strokeIn(g, 'rgba(120, 110, 100, 0.35)', 0.012, () => { g.moveTo(-L, r * 0.35); g.quadraticCurveTo(0, r * 0.25, L * 0.7, r * 0.4); });   // the edge of its outer turn
  g.restore();
  // The open end: the coil, tan and peach inside, white turns between.
  softIn(g, [206, 146, 100], -r, r, () => ovalAt(g, -L, 0, r * 0.34, r), 1.15, 0.72);
  strokeIn(g, 'rgba(250, 244, 232, 0.9)', r * 0.08, () => { for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.6, rr = r * (0.9 - t * 0.75); i ? g.lineTo(-L + Math.cos(a) * rr * 0.34, Math.sin(a) * rr) : g.moveTo(-L + Math.cos(a) * rr * 0.34, Math.sin(a) * rr); } });
  strokeIn(g, 'rgba(250, 248, 240, 1)', r * 0.1, () => ovalAt(g, -L, 0, r * 0.34, r));
  g.restore();
}
function paintBark(g) {
  touch(g, 0, 0.62, 0.64, 0.12);
  scroll(g, 0.28, 0.4, -0.15, 0.3, 0.15, 2);
  scroll(g, -0.06, -0.06, -0.42, 0.5, 0.25, 1);
}

// The painted things by their ids, in the order of their numbers ('ingr:' + n): a new one goes at the end.
const PAINTED = [
  ['cep', paintCep],
  ['chanterelle', paintChanterelle],
  ['field', paintField],
  ['oyster', paintOyster],
  ['sulphur', paintSulphur],
  ['garlic', paintGarlic],
  ['nettle', paintNettle],
  ['sorrel', paintSorrel],
  ['dandelion', paintDandelion],
  ['watercress', paintWatercress],
  ['apple', paintApple],
  ['cherry', paintCherry],
  ['blackberry', paintBlackberry],
  ['honey', paintHoney],
  ['acorns', paintAcorns],
  ['beechnuts', paintBeechnuts],
  ['hazelnut', paintHazelnut],
  ['strawberry', paintStrawberry],
  ['elderflower', paintElderflower],
  ['rosehip', paintRosehip],
  ['stick', paintSticks],
  ['pebble', paintPebbles],
  ['drygrass', paintDryGrass],
  ['birchbark', paintBark],
];
const NAMES = PAINTED.map(p => p[0]);
function paint(g, size, U, n) {
  const p = PAINTED[n];
  if (!p) return;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  p[1](g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

root.Items = { NAMES, paint };
})(typeof window !== 'undefined' ? window : globalThis);
