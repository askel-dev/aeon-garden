// The camp builds' drawing helpers and the lean-to as it is now, copied unchanged from game.js (2026-10-21).
const { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, softIn, furGlow } = Fur;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
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
const RACK_WOOD = [150, 108, 66], RACK_GRASS = [212, 184, 112], RACK_BARK = [226, 216, 192], RACK_INK = [74, 50, 30];
const CAMP_KX = 0.35, CAMP_KY = 0.5;
const campAt3 = (x, d, h) => [x + d * CAMP_KX, -d * CAMP_KY - h];   // along it, back, up → its box
// A cut pole from one end to the other, w thick: inked round, round from the light along its upper left and the shade along
// its lower right, a few grain lines and a knot, and its pale cut end at the first end if cut. Painted once.
function campPole(g, x0, y0, x1, y1, w, rgb, seed, cut) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx + ny > 0) { nx = -nx; ny = -ny; }                 // (n: toward the light, up and to the left)
  const line = (o, wd, colour) => strokeIn(g, colour, wd, () => { g.moveTo(x0 + nx * o, y0 + ny * o); g.lineTo(x1 + nx * o, y1 + ny * o); });
  line(0, w + 0.024, rockRGB(RACK_INK, 0.8));
  line(0, w, rockRGB(tone(rgb, 0.92)));
  line(-w * 0.26, w * 0.42, rockRGB(tone(rgb, 0.66)));
  line(w * 0.24, w * 0.26, rockRGB(tone(rgb, 1.22, 14), 0.9));
  strokeIn(g, rockRGB(tone(rgb, 0.5), 0.55), 0.008, () => {
    for (let i = 0; i < Math.max(2, len * 5 | 0); i++) {
      const t = (i + 0.3 + 0.4 * hash2(seed, i, 761)) / Math.max(2, len * 5 | 0), o = (hash2(i, seed, 763) - 0.5) * w * 0.6, l = 0.03 + 0.05 * hash2(seed, i, 767);
      const x = x0 + dx * t + nx * o, y = y0 + dy * t + ny * o; g.moveTo(x, y); g.lineTo(x + dx / len * l, y + dy / len * l);
    }
  });
  const kt = 0.3 + 0.4 * hash2(seed, 9, 769);
  fillIn(g, rockRGB(tone(rgb, 0.45), 0.8), () => ovalAt(g, x0 + dx * kt - nx * w * 0.1, y0 + dy * kt - ny * w * 0.1, w * 0.22, w * 0.15, Math.atan2(dy, dx)));
  if (cut) {
    fillIn(g, rockRGB(RACK_INK, 0.8), () => ovalAt(g, x0, y0, w * 0.62, w * 0.5, Math.atan2(dy, dx)));
    fillIn(g, rockRGB(tone([226, 196, 146], 1)), () => ovalAt(g, x0, y0, w * 0.48, w * 0.36, Math.atan2(dy, dx)));
    fillIn(g, rockRGB(tone([226, 196, 146], 0.78)), () => ovalAt(g, x0, y0, w * 0.15, w * 0.11, Math.atan2(dy, dx)));
  }
}
// A forked stick pushed into the ground at x, y (in its box), standing h tall to its crotch, the fork's two prongs above it.
function campFork(g, x, y, h, w, rgb, seed) {
  const lean = (hash2(seed, 1, 771) - 0.5) * 0.04, tx = x + lean, ty = y - h;
  campPole(g, x, y, tx, ty, w, rgb, seed, false);
  campPole(g, tx - 0.06, ty - 0.1, tx, ty + 0.012, w * 0.66, rgb, seed + 1, true);
  campPole(g, tx + 0.055, ty - 0.085, tx, ty + 0.012, w * 0.6, rgb, seed + 2, true);
}
// A few turns of cord round where two poles cross, at x, y.
function campLash(g, x, y, r, a = 0.6) {
  const c = Math.cos(a), s = Math.sin(a);
  const turns = () => { for (let i = -1; i <= 1; i++) { const o = i * r * 0.62; g.moveTo(x - c * r + s * o, y - s * r - c * o * 0.5); g.lineTo(x + c * r + s * o, y + s * r - c * o * 0.5); } };
  strokeIn(g, rockRGB(RACK_INK, 0.85), 0.022, turns);
  strokeIn(g, rockRGB([190, 152, 98]), 0.011, turns);
}
// Where a stick or a stone meets the earth: a dark press, a few clods turned up round it.
function campFoot(g, x, y, r, seed) {
  softSpot(g, x + r * 0.2, y + 0.01, r * 1.9, r * 0.6, '30, 22, 12', 0.42);
  for (let i = 0; i < 3; i++) {
    const a = hash2(seed, i, 773) * TAU, d = r * (0.6 + 0.6 * hash2(i, seed, 777)), cx = x + Math.cos(a) * d, cy = y + 0.008 + Math.sin(a) * d * 0.3;
    softIn(g, tone([110, 86, 58], 0.8 + 0.3 * hash2(seed, i, 779)), cy - 0.014, cy + 0.012, () => ovalAt(g, cx, cy, 0.026, 0.013, a), 1.15, 0.7);
  }
}
// A grey stone sitting on the ground at x, y, r across: its shadow, its round, the light on its top.
function campStone(g, x, y, r, seed) {
  const sy = r * 0.6, rgb = tone([150, 146, 136], 0.88 + 0.24 * hash2(seed, 0, 781));
  fillIn(g, 'rgba(30, 24, 16, 0.38)', () => ovalAt(g, x + r * 0.12, y + sy * 0.35, r * 1.05, sy * 0.55));
  fillIn(g, rockRGB(tone(rgb, 0.45), 0.85), () => ovalAt(g, x, y - sy * 0.45, r + 0.012, sy + 0.012, (hash2(seed, 1, 783) - 0.5) * 0.4));
  softIn(g, rgb, y - sy * 1.45, y + sy * 0.55, () => ovalAt(g, x, y - sy * 0.45, r, sy, (hash2(seed, 1, 783) - 0.5) * 0.4), 1.3, 0.6);
  furGlow(g, [255, 252, 240], 0.45, x - r * 0.3, y - sy * 0.95, r * 0.42, sy * 0.3, -0.3);
  fillIn(g, 'rgba(118, 140, 82, 0.6)', () => ovalAt(g, x + r * 0.35, y - sy * 0.1, r * 0.25, sy * 0.18, 0.3));   // (a speck of moss)
}
// A sheet of birch bark between four corners (its band running from the first to the second): creamy white shading to warm
// grey, its dark lenticels in short dashes along the band, a pale peeling strip or two, its thickness showing under its lower
// edge (thick), and its tan inside curling up along that edge.
function birchSheet(g, p, seed, curl = true, bow = 0, thick = 0) {
  const [ax, ay, bx, by, cx, cy, dx, dy] = p;
  const at = (u, v) => [lerp(lerp(ax, bx, u), lerp(dx, cx, u), v), lerp(lerp(ay, by, u), lerp(dy, cy, u), v) - bow * 4 * u * (1 - u)];
  const edge = v => { for (let i = 0; i <= 8; i++) g.lineTo(...at(i / 8, v)); }, back = v => { for (let i = 8; i >= 0; i--) g.lineTo(...at(i / 8, v)); };
  const path = () => { g.moveTo(ax, ay); edge(0); back(1); g.closePath(); };
  if (thick) {                                                                // its edge, seen under it: the bark's thickness, darker
    g.save(); g.translate(0, thick);
    strokeIn(g, rockRGB(RACK_INK, 0.9), 0.026, path);
    fillIn(g, rockRGB([128, 100, 74]), path);
    g.restore();
  }
  strokeIn(g, rockRGB(RACK_INK, 0.9), 0.026, path);
  softIn(g, RACK_BARK, Math.min(ay, by) - bow, Math.max(cy, dy), path, 1.03, 0.74);
  g.save(); g.beginPath(); path(); g.clip();
  for (const v of [0.28 + 0.12 * hash2(seed, 2, 787), 0.68]) {               // pale peeling bands, a grey line under each
    strokeIn(g, 'rgba(250, 244, 228, 0.85)', 0.02, () => { g.moveTo(...at(0, v)); edge(v); });
    strokeIn(g, rockRGB(tone(RACK_BARK, 0.74), 0.55), 0.006, () => { g.moveTo(...at(0, v + 0.09)); edge(v + 0.09); });
  }
  strokeIn(g, 'rgba(62, 52, 46, 0.62)', 0.008, () => {                       // its lenticels, short dark dashes along the band
    const len = Math.hypot(bx - ax, by - ay), many = clamp(Math.round(len * 16), 3, 16);
    for (let i = 0; i < many; i++) {
      const u = hash2(seed, i, 789) * 0.92, v = 0.08 + 0.84 * hash2(i, seed, 791), l = (0.03 + 0.05 * hash2(seed, i + 20, 793)) / len;
      g.moveTo(...at(u, v)); g.lineTo(...at(u + l, v));
    }
  });
  { const [x, y] = at(0.25 + 0.5 * hash2(seed, 1, 797), 0.5); fillIn(g, 'rgba(66, 56, 50, 0.6)', () => ovalAt(g, x, y, 0.022, 0.008, Math.atan2(by - ay, bx - ax))); }   // a black scar
  furGlow(g, [118, 104, 86], 0.34, (cx + dx) / 2, (cy + dy) / 2, Math.hypot(cx - dx, cy - dy) * 0.6, 0.07, Math.atan2(cy - dy, cx - dx));   // grey shade along its lower edge
  furGlow(g, [150, 134, 112], 0.28, ax, ay, 0.12, 0.08);                    // and round its ends, as it curves away
  furGlow(g, [150, 134, 112], 0.28, bx, by, 0.12, 0.08);
  g.restore();
  if (curl) {                                                                 // its inside, curling up along the lower edge
    const run = () => { g.moveTo(...at(0.05, 1)); for (let i = 1; i <= 9; i++) g.lineTo(...at(0.05 + 0.9 * i / 9, 1)); };
    strokeIn(g, rockRGB(RACK_INK, 0.6), 0.036, run);
    strokeIn(g, rockRGB([204, 138, 86]), 0.022, run);
    strokeIn(g, rockRGB([238, 190, 134], 0.9), 0.008, run);
  }
}
const LEAN_SIZE = 1.9;                    // its painting's box: about two tiles across, a little under its roof (sim.js LEAN_RX)
const LEAN_FOOT = 0.68;                   // where the ground under it is in its painting (of its half-size, down from the middle)
const LEAN_ART = 'lean:0';                // (made once: a frame builds no names)
const LEAN_WOOD = [140, 100, 60], LEAN_THATCH = [206, 172, 102], LEAN_LEAF = [176, 120, 58];
function paintLean(g, size, U) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  g.translate(0, LEAN_FOOT);
  const P = campAt3, wood = LEAN_WOOD, straw = LEAN_THATCH, h = (i, k) => hash2(i, k, 851);
  const XM = -0.8, XF = 0.88, DN = -0.36, DB = 0.36, HR = 1.0;   // its mouth (the ridge's line), its roof's foot, near and far, the ridge's height
  // The roof as a plane: u from the ridge (0) down to its foot (1), v from its near edge (0) to its far one (1), a little over the poles.
  const R = (u, v, lift = 0) => P(lerp(XM - 0.05, XF + 0.08, u), lerp(DN - 0.07, DB + 0.07, v), lerp(HR + 0.04, 0.02, u) + lift);
  const quad = (a, b, c, d) => { g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); };
  // Its shadow, and the trodden ground of its mouth.
  furGlow(g, [40, 30, 16], 0.4, 0.1, -0.02, 1.1, 0.3, 0, 0.35);
  // The dark under its roof, seen at its mouth and its near side.
  const inside = () => quad(P(XM, DN, 0), P(XM, DN, HR), P(XM, DB, HR), P(XF, DB, 0)), [, iy0] = P(XM, DB, HR);
  { const gr = g.createLinearGradient(0, iy0, 0, 0.2); gr.addColorStop(0, 'rgb(30, 22, 14)'); gr.addColorStop(0.6, 'rgb(58, 40, 26)'); gr.addColorStop(1, 'rgb(92, 68, 42)'); g.fillStyle = gr; g.beginPath(); inside(); g.lineTo(...P(XF, DN, 0)); g.closePath(); g.fill(); }
  // Its far side, laid with brush: a few poles leaning in, dark.
  for (let i = 0; i < 4; i++) { const u = 0.2 + i * 0.2, [x0, y0] = P(lerp(XM, XF, u), DB, 0), [x1, y1] = P(lerp(XM, XF, u) - 0.06, DB, lerp(HR, 0, u) - 0.02); campPole(g, x0, y0, x1, y1, 0.03, tone(wood, 0.5), 60 + i, false); }
  // The back upright, in the dark of its mouth.
  { const [fx, fy] = P(XM, DB, 0); campFork(g, fx, fy, HR, 0.05, tone(wood, 0.72), 70); campStone(g, fx + 0.05, fy + 0.02, 0.07, 71); }
  // A bed of dry grass and leaves under it, spilling out of its mouth.
  const bed = () => { g.moveTo(...P(XM - 0.3, DN + 0.02, 0)); g.quadraticCurveTo(...P(XM - 0.42, 0, 0), ...P(XM - 0.24, DB - 0.06, 0)); g.lineTo(...P(XF - 0.3, DB - 0.06, 0)); g.quadraticCurveTo(...P(XF - 0.08, 0, 0), ...P(XF - 0.34, DN + 0.04, 0)); g.closePath(); };
  { const [, by0] = P(0, DB, 0), [, by1] = P(0, DN, 0); softIn(g, tone(straw, 0.82), by0 - 0.02, by1 + 0.02, bed, 1.05, 0.62); }
  g.save(); g.beginPath(); bed(); g.clip();
  for (let i = 0; i < 70; i++) {                            // straws every way
    const [x, y] = P(lerp(XM - 0.4, XF - 0.1, h(i, 1)), lerp(DN, DB, h(i, 2)), 0), a = h(i, 3) * Math.PI, l = 0.05 + 0.07 * h(i, 4);
    const lit = 0.55 + 0.6 * h(i, 5) * (1 - 0.6 * h(i, 2));
    strokeIn(g, rockRGB(tone(straw, lit)), 0.011, () => { g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l * 0.5); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5); });
  }
  furGlow(g, [255, 240, 200], 0.28, ...P(XM - 0.12, DN + 0.2, 0), 0.4, 0.08);   // (heaped soft: the light on its near side)
  furGlow(g, [26, 18, 10], 0.78, ...P(lerp(XM, XF, 0.42), DB * 0.25, 0), 0.72, 0.2, 0.12, 0.35);   // (under the roof it lies in the shade, deepest at the back)
  furGlow(g, [26, 18, 10], 0.4, ...P(lerp(XM, XF, 0.65), DB * 0.5, 0), 0.4, 0.1, 0.12, 0.2);
  g.restore();
  strokeIn(g, rockRGB(tone(straw, 0.95)), 0.012, () => {    // tufts of it poking out round its edge
    for (let i = 0; i < 30; i++) {
      const t = (i + h(i, 23)) / 30, mouth = t < 0.25, [x, y] = mouth ? P(XM - 0.38 + 0.06 * Math.abs(t * 8 - 1), lerp(DB - 0.08, DN + 0.04, t * 4), 0) : P(lerp(XM - 0.28, XF - 0.3, (t - 0.25) / 0.75), DN + 0.02, 0);
      const a = (mouth ? Math.PI : Math.PI / 2) + (h(i, 24) - 0.5) * 1.4, l = 0.035 + 0.04 * h(i, 25);
      g.moveTo(x - Math.cos(a) * 0.02, y - Math.sin(a) * 0.01); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5);
    }
  });
  const leaf = (x, y, r, a, rgb) => {                       // a fallen leaf: pointed, a vein down it
    fillIn(g, rockRGB(tone(rgb, 0.6)), () => { g.moveTo(x - Math.cos(a) * r * 1.1, y - Math.sin(a) * r * 0.6); g.quadraticCurveTo(x - Math.sin(a) * r * 0.6, y + Math.cos(a) * r * 0.4, x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 0.6); g.quadraticCurveTo(x + Math.sin(a) * r * 0.6, y - Math.cos(a) * r * 0.4, x - Math.cos(a) * r * 1.1, y - Math.sin(a) * r * 0.6); });
    fillIn(g, rockRGB(rgb), () => { g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r * 0.55); g.quadraticCurveTo(x - Math.sin(a) * r * 0.5, y + Math.cos(a) * r * 0.32, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55); g.quadraticCurveTo(x + Math.sin(a) * r * 0.5, y - Math.cos(a) * r * 0.32, x - Math.cos(a) * r, y - Math.sin(a) * r * 0.55); });
    strokeIn(g, rockRGB(tone(rgb, 0.7)), 0.006, () => { g.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.45); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.45); });
  };
  const LEAVES = [[204, 120, 50], [176, 84, 44], [214, 168, 72], [130, 140, 60], [190, 140, 60]];
  for (let i = 0; i < 16; i++) {
    const u = h(i, 6) ** 1.6, [x, y] = P(lerp(XM - 0.34, XF - 0.3, u), lerp(DN + 0.04, DB - 0.1, h(i, 7)), 0);
    leaf(x, y, 0.04 + 0.02 * h(i, 8), h(i, 9) * 3, tone(LEAVES[i % 5], 0.7 + 0.4 * (1 - u)));
  }
  // The poles it's laid on, leaning from the ridge to the ground; their tops poke out over the ridge.
  for (let i = 0; i < 4; i++) {
    const v = 0.06 + i * 0.29, [x0, y0] = R(0.96, v, 0.015), [x1, y1] = R(-0.07, v, 0.03);
    campPole(g, x1, y1, x0, y0, 0.042, tone(wood, 0.8), 80 + i, true);
  }
  // The roof: rows of thatch from the foot up, each lapping over the one below; the top rows birch-bark shingles, overlapping.
  const ROWS = 6;
  for (let r = ROWS - 1; r >= 0; r--) {
    const u0 = r / ROWS - 0.02, u1 = Math.min(1.03, (r + 1.35) / ROWS), bark = r < 2;
    if (bark) {
      for (let k = 0; k < 4; k++) {                         // shingles, their joins staggered row to row
        const v0 = clamp((k - 0.15 + (r % 2) * 0.5) / 3.6, -0.02, 1), v1 = clamp((k + 1.05 + (r % 2) * 0.5) / 3.6, 0, 1.02);
        if (v1 - v0 < 0.08) continue;
        const sk = (h(r * 5 + k, 10) - 0.5) * 0.04;
        birchSheet(g, [...R(u0 + sk, v0, 0.06), ...R(u0 - sk, v1, 0.06), ...R(u1 - sk, v1, 0.06), ...R(u1 + sk, v0, 0.06)], 90 + r * 5 + k, true, 0, 0.014);
      }
      continue;
    }
    const band = () => quad(R(u0, -0.02, 0.05), R(u0, 1.02, 0.05), R(u1, 1.02, 0.05), R(u1, -0.02, 0.05));
    const [, ya] = R(u0, 1, 0.05), [, yb] = R(u1, 0, 0.05);
    strokeIn(g, rockRGB(tone(straw, 0.45), 0.5), 0.02, band);
    softIn(g, tone(straw, 0.96 - r * 0.03), ya, yb, band, 1.1, 0.72);
    g.save(); g.beginPath(); band(); g.clip();
    for (let i = 0; i < 46; i++) {                          // its straws, down the slope
      const v = (i + h(r * 50 + i, 11)) / 46 * 1.06 - 0.03, [x0, y0] = R(u0, v, 0.05), [x1, y1] = R(u1 + 0.02, v + (h(r * 50 + i, 12) - 0.5) * 0.04, 0.05);
      strokeIn(g, rockRGB(tone(straw, 0.68 + 0.55 * h(r * 50 + i, 13), h(r * 50 + i, 14) > 0.85 ? 18 : 0)), 0.013, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
    }
    furGlow(g, tone(straw, 0.4), 0.5, ...R(u0 + 0.02, 0.5, 0.05), 1.2, 0.05, Math.atan2(R(u0, 1)[1] - R(u0, 0)[1], R(u0, 1)[0] - R(u0, 0)[0]));   // (in the shade of the row over it)
    g.restore();
    strokeIn(g, rockRGB(tone(straw, 0.8)), 0.012, () => {   // its ragged lower edge, straw ends hanging over
      for (let i = 0; i < 26; i++) {
        const v = (i + 0.5) / 26, [x, y] = R(u1, v, 0.05), l = 0.03 + 0.05 * h(r * 30 + i, 15), a = 0.55 + (h(r * 30 + i, 16) - 0.5) * 0.5;
        g.moveTo(x - Math.cos(a) * 0.02, y - Math.sin(a) * 0.02); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
    });
    if (r === 3) for (const v of [0.22, 0.6, 0.92]) { const [lx, ly] = R(u0 + 0.06, v, 0.05); campLash(g, lx, ly, 0.035, -0.9); }   // (tied to the poles)
  }
  // Its near edge: the thatch's cut ends, thick, and a few loose straws sticking out.
  {
    const edge = () => { g.moveTo(...R(-0.02, -0.02, 0.07)); g.lineTo(...R(1.03, -0.02, 0.05)); g.lineTo(...R(1.03, -0.02, -0.02)); g.lineTo(...R(-0.02, -0.02, -0.02)); g.closePath(); };
    strokeIn(g, rockRGB(tone(straw, 0.4), 0.85), 0.024, edge);
    fillIn(g, rockRGB(tone(straw, 0.74)), edge);
    for (const [k, c] of [[0, tone(straw, 0.5)], [1, tone(straw, 1.12, 10)]]) fillIn(g, rockRGB(c, 0.9), () => {   // the straws' ends, cut, seen end on
      for (let i = 0; i < 40; i++) { const [x, y] = R((i + h(i, 26 + k)) / 40, -0.02, -0.01 + 0.07 * h(i, 28 + k)); ovalAt(g, x, y, 0.011, 0.008, h(i, 30) * 3); }
    });
    strokeIn(g, rockRGB(tone(straw, 0.62)), 0.01, () => { for (let i = 0; i < 22; i++) { const [x, y] = R((i + h(i, 32)) / 22, -0.02, -0.015), l = 0.02 + 0.04 * h(i, 33); g.moveTo(x, y); g.lineTo(x + (h(i, 34) - 0.5) * 0.03, y + l); } });   // (ragged under)
    strokeIn(g, rockRGB(tone(straw, 1.1, 8)), 0.011, () => { for (let i = 0; i < 9; i++) { const u = 0.08 + 0.85 * h(i, 17), [x, y] = R(u, -0.03, 0.02), a = 1.6 + (h(i, 18) - 0.5) * 1.4, l = 0.06 + 0.05 * h(i, 19); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l); } });
  }
  // The ridge: a pole laid along the top, holding the shingles down, tied at each end.
  { const [x0, y0] = R(0.02, -0.12, 0.1), [x1, y1] = R(0.02, 1.1, 0.1); campPole(g, x0, y0, x1, y1, 0.05, wood, 100, true); for (const v of [0.1, 0.9]) { const [lx, ly] = R(0.02, v, 0.1); campLash(g, lx, ly, 0.04, 0.3); } }
  // Its foot: the thatch's ends splayed out on the ground in their own shade, ragged, no two alike.
  { const [x0, y0] = R(1.0, -0.05), [x1, y1] = R(1.0, 1.05); furGlow(g, [40, 30, 16], 0.42, (x0 + x1) / 2 + 0.06, (y0 + y1) / 2 + 0.03, 0.42, 0.1, Math.atan2(y1 - y0, x1 - x0), 0.2); }
  for (const [k, lit] of [[0, 0.6], [1, 0.85], [2, 1.08]]) strokeIn(g, rockRGB(tone(straw, lit, k === 2 ? 8 : 0)), 0.012, () => {
    for (let i = 0; i < 24; i++) {
      const v = (i + h(i, 40 + k)) / 24 * 1.08 - 0.04, [x, y] = R(0.97, v, 0.03), l = 0.05 + 0.09 * h(i, 43 + k) * (0.6 + 0.6 * Math.sin(v * 9 + k)), a = 0.42 + (h(i, 46 + k) - 0.5) * 0.9;
      g.moveTo(x - 0.02, y - 0.012); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.3, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.8);
    }
  });
  // A few stones about its foot to keep the wind from lifting it, of all sizes, sunk in the grass, and a scatter of loose straw.
  for (const [v, r, dx, s] of [[0.06, 0.085, 0.14, 1], [0.44, 0.05, 0.22, 2], [0.86, 0.068, 0.1, 3]]) {
    const [x, y] = P(XF + dx, lerp(DN, DB, v), 0); campStone(g, x, y + 0.02, r, 110 + s);
    strokeIn(g, rockRGB([92, 140, 58]), 0.012, () => { for (let i = 0; i < 4; i++) { const tx = x + (h(s, 50 + i) - 0.5) * r * 2.2, a = (h(s, 54 + i) - 0.5) * 1.1, l = 0.04 + 0.04 * h(s, 58 + i); g.moveTo(tx, y + 0.03); g.lineTo(tx + Math.sin(a) * l, y + 0.03 - Math.cos(a) * l); } });   // (grass up round it)
  }
  strokeIn(g, rockRGB(tone(straw, 0.95)), 0.011, () => { for (let i = 0; i < 8; i++) { const [x, y] = P(lerp(XM - 0.5, XF + 0.3, h(i, 20)), DN - 0.08 - 0.12 * h(i, 21), 0), a = (h(i, 22) - 0.5) * 2; g.moveTo(x - Math.cos(a) * 0.06, y - Math.sin(a) * 0.02); g.lineTo(x + Math.cos(a) * 0.06, y + Math.sin(a) * 0.02); } });
  // The front upright, at its mouth's near corner, the ridge on its fork; a stone at its foot.
  { const [fx, fy] = P(XM, DN, 0); campFoot(g, fx, fy, 0.05, 120); campFork(g, fx, fy, HR + 0.02, 0.056, wood, 121); const [lx, ly] = P(XM, DN, HR + 0.02); campLash(g, lx, ly, 0.045); campStone(g, fx - 0.07, fy + 0.035, 0.06, 122); }
  // Tufts of grass about its corners.
  strokeIn(g, rockRGB([96, 146, 60]), 0.014, () => { for (const [x, d, a, l] of [[XM - 0.16, DN - 0.04, -0.4, 0.1], [XM - 0.12, DN - 0.06, 0.1, 0.13], [XF + 0.3, DN + 0.06, 0.3, 0.11], [XF + 0.34, DN + 0.1, 0.7, 0.08], [XF + 0.26, DB, -0.2, 0.09]]) { const [cx, cy] = P(x, d, 0); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); } });
}
