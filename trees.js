/* Nobody's Meadow — the trees, painted in code: oak, maple, birch, apple, cherry, pine, willow,
 * hawthorn, and the old hive oak with its hive.
 *
 * A tree is sculpted first, then painted. The sculpture is a little 3D model made of spheres: a
 * branching skeleton swept in bark, and clumps of leaflets at the twig ends. It is drawn into a
 * z-buffer and lit per pixel, but only for the big shapes: the light on the whole crown and on each
 * clump, and the shade deep between them. Then it is painted over like an illustration. The leaves
 * go on as small leaf-shaped dabs, from shade to light, each a flat colour taken from the light
 * where it sits (a darker one under each, a few bright ones where the sun hits), and the bark as
 * strokes along each branch. The 3D gives the volume; the brushwork keeps it from looking 3D.
 *
 * One tree keeps one skeleton all year: the seed decides its shape and the season only its
 * leaves. Oaks hold their dry leaves through winter; the others stand bare, and snow settles on
 * whatever faces up.
 *
 * Painting is slow (a tenth of a second or more for a big tree), so it's done once per look and
 * copied after. tree-lab.html shows every kind in every season, and tunes LOOK.
 *
 * Use: Trees.paint(kind, { seed, season, snow, scale, ss, snowLayer }) returns a canvas, with bx, by
 * where the foot of the trunk is. kind is a key of Trees.KINDS, season 'spring' | 'summer' | 'autumn' |
 * 'winter', or one of the looks in between (LOOKS: bare, bud, thin), snow 0..1, scale the size (1: about 250 px tall for a big tree), ss how finely it's sculpted
 * (px per px at scale 1, 3 by default; a small painting needs only about scale × 3, and paints that much faster).
 * With snowLayer the snow isn't painted in but comes apart, as canvas.snow (same size and place), for
 * the game to lay on as thick as the snow lying. It runs in a worker too (tree-worker.js).
 */
(() => {
'use strict';

// How the brush paints. tree-lab.html has a slider for each, and hands the block back as code.
const LOOK = {
  dab: 5,            // leaf dab size, px at scale 1
  dabs: 2.2,         // how thickly the dabs cover the leaves
  under: 0.09,       // how much darker the leaf under each dab is (in full light; less in shade)
  highlights: 0.04,  // share of extra bright dabs on the sunny side
  shine: 0.06,       // how much brighter those are
  crevice: 2,        // how wide the shade between clumps reaches
  stroke: 2.4,       // bark stroke length
  cracks: 0.08,      // share of dark bark strokes
  leaflet: 1.8,      // leaflet size, times each kind's own: bigger is fewer, rounder bumps
  form: 1.15,        // how strongly the light rounds the whole crown
  lift: 0.5,         // how high the crown starts: no leaf clumps low in it, so the trunk shows (1: none left out)
  spread: 0.85,      // how wide the branches reach, times each kind's own: narrower leaves room between trees
};

const L = norm([-0.55, -0.75, 0.55]);          // the light: top left, a little in front
const HV = norm([L[0], L[1], L[2] + 1]);       // half-vector, for the shine on fruit
let SS = 3, OUT = 1;                           // px sculpted, and px painted, per px of the tree at scale 1 (SS may be under 1 for a small painting)
let LEAVES = { keep: 1, size: 1 };             // the share of leaf clumps kept and how big (fewer or smaller, over bare twigs: LOOKS)
let SEASON = 'summer', OWN = null;             // the season painted, and the tree's own random numbers (its colour)

function norm(v) { const l = Math.hypot(...v) || 1; return v.map(x => x / l); }
const add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map(v => v * k);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const canvas = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });

// Colour ramps, dark to light. Shade stays saturated (deep teal-green), light goes to lime.
const RAMPS = {
  summer: [[26, 52, 22], [40, 80, 30], [60, 112, 42], [80, 144, 54], [102, 180, 70], [128, 216, 92]],
  spring: [[36, 70, 26], [56, 104, 34], [82, 144, 46], [110, 180, 60], [140, 210, 80], [178, 234, 116]],
  olive:  [[30, 54, 26], [46, 82, 34], [66, 114, 44], [88, 144, 56], [112, 174, 70], [142, 204, 92]],
  willow: [[14, 50, 36], [34, 90, 42], [82, 140, 44], [140, 188, 66], [190, 222, 106], [226, 244, 164]],
  pine:   [[10, 36, 20], [22, 62, 34], [38, 92, 50], [54, 124, 64], [78, 158, 82], [116, 194, 110]],
  fresh:  [[34, 72, 34], [54, 106, 44], [78, 144, 58], [104, 178, 74], [134, 206, 96], [170, 230, 130]],
  maple:  [[84, 22, 16], [146, 44, 18], [206, 88, 22], [238, 144, 36], [252, 196, 80], [255, 230, 150]],
  scarlet:[[80, 10, 16], [140, 20, 24], [196, 42, 30], [228, 80, 44], [246, 130, 80], [255, 190, 140]],
  gold:   [[84, 62, 16], [140, 104, 20], [190, 150, 30], [222, 186, 52], [240, 212, 90], [250, 232, 150]],
  lemon:  [[84, 78, 20], [134, 126, 30], [184, 172, 40], [214, 204, 62], [234, 226, 106], [246, 240, 160]],
  russet: [[66, 28, 14], [120, 50, 18], [172, 86, 28], [208, 128, 44], [230, 170, 80], [244, 206, 130]],
  copper: [[80, 26, 12], [140, 48, 16], [196, 82, 24], [226, 124, 40], [244, 170, 76], [252, 210, 130]],
  dry:    [[52, 30, 18], [90, 56, 32], [130, 88, 52], [164, 122, 78], [192, 156, 108], [216, 188, 144]],
  withy:  [[70, 62, 20], [120, 106, 30], [168, 150, 48], [204, 188, 80], [228, 216, 120], [244, 236, 170]],
  grey:   [[38, 38, 38], [68, 68, 66], [106, 104, 98], [144, 140, 132], [178, 174, 164], [204, 200, 190]],
  bark:   [[34, 22, 18], [62, 40, 28], [98, 66, 42], [138, 98, 64], [174, 132, 90], [200, 164, 120]],
  twig:   [[40, 26, 28], [72, 48, 50], [106, 78, 78], [140, 110, 104], [172, 144, 132], [198, 174, 160]],   // bare twigs, a little purple
  birchtwig: [[44, 20, 30], [74, 34, 44], [104, 54, 62], [134, 78, 82], [162, 104, 104], [188, 134, 128]],   // a birch's, purple-red, so a bare one is a haze and not a white stick
  twiggy: [[46, 44, 48], [78, 74, 78], [112, 106, 106], [146, 140, 136], [176, 170, 164], [200, 196, 188]],   // a beech's, grey
  birch:  [[96, 92, 88], [160, 156, 146], [208, 204, 192], [236, 232, 222], [250, 248, 242], [255, 255, 252]],
  hollow: [[10, 6, 4], [22, 14, 8], [38, 24, 14], [56, 36, 22], [74, 50, 32], [92, 64, 42]],
  comb:   [[96, 52, 8], [156, 96, 16], [212, 150, 32], [238, 192, 66], [250, 222, 124], [255, 242, 186]],
  pink:   [[168, 80, 118], [214, 124, 158], [240, 168, 196], [252, 204, 222], [255, 228, 238], [255, 246, 250]],
  white:  [[150, 136, 150], [206, 192, 204], [236, 226, 232], [250, 244, 246], [255, 252, 252], [255, 255, 255]],
  apple:  [[90, 8, 14], [150, 16, 22], [206, 36, 32], [236, 80, 52], [252, 150, 110], [255, 210, 180]],
  cherry: [[60, 4, 14], [110, 8, 24], [160, 20, 34], [200, 50, 50], [236, 110, 100], [255, 180, 170]],
  berry:  [[80, 6, 20], [140, 12, 30], [196, 30, 40], [230, 70, 60], [250, 140, 120], [255, 200, 180]],
  snow:   [[140, 164, 200], [186, 204, 230], [222, 232, 246], [244, 248, 254], [255, 255, 255], [255, 255, 255]],
};
function ramp(r, t) {
  t = clamp(t, 0, 1) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(t)), f = t - i, a = r[i], b = r[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// Materials. w weighs the three normals (the sphere's own, its clump's, the whole crown's); leaves
// get only the last two, so the dabs carry the small detail. lobe ruffles a leaflet's edge.
// strokes: painted in strokes along the sphere's dir; shaded: darker under the crown.
const MAT = {
  leaf:   { w: [0, 0.4, 0.6], ao: 1.1, snow: true, lobe: 0.1 },
  needle: { w: [0, 0.4, 0.6], ao: 1.1, snow: true, lobe: 0.16, dab: [1.5, 0.45], snowOn: true },   // snow on each tuft's top
  strand: { w: [0, 0.4, 0.6], ao: 1.1, lobe: 0.14, dab: [2.2, 0.3], small: 0.75 },
  bloom:  { w: [0, 0.4, 0.6], ao: 0.9, lobe: 0.12 },
  bark:   { w: [1, 0, 0], ao: 0.7, snow: true, strokes: 1, shaded: true },
  birch:  { w: [1, 0, 0], ao: 0.5, snow: true, strokes: 0.6, across: true, shaded: true, birch: true },
  straw:  { w: [1, 0, 0], ao: 0.9, snow: true, strokes: 0.8 },
  hollow: { w: [1, 0, 0], ao: 0.3 },
  fruit:  { w: [1, 0, 0], ao: 0.4, shine: 0.9, onTop: true },
};

// ------------------------------------------------------------------ the sculpture and the paint

class Scene {
  constructor(w, h, bx, by) {
    this.w = w; this.h = h; this.W = Math.ceil(w * SS); this.H = Math.ceil(h * SS); this.base = [bx, by];
    this.z = new Float32Array(this.W * this.H).fill(-1e9);
    this.id = new Int32Array(this.W * this.H).fill(-1);
    this.s = []; this.twigs = []; this.hazes = []; this.hazeA = 0.22;
  }
  // p in px at scale 1 (z toward the viewer), r its radius, look { mat, ramp }; clump: the clump's
  // centre; crown: an ellipsoid round the whole crown; tone: lighter or darker; dir: which way
  // strokes run on it, on screen.
  add(p, r, look, clump = null, crown = null, tone = 0, dir = null) {
    this.s.push({ x: p[0] * SS, y: p[1] * SS, z: p[2] * SS, r: r * SS, look, clump, crown, tone, dir });
  }
  // A bare twig, a curve a..c..b of width w, painted under the tree: close up a tangle of twigs,
  // from afar (thinner than a pixel) a haze where the crown would be. And that haze itself, a little.
  twig(a, c, b, w, ramp, t) { this.twigs.push({ a: mul(a, SS), c: mul(c, SS), b: mul(b, SS), w: w * SS, ramp, t }); }
  haze(p, r, ramp) { this.hazes.push({ p: mul(p, SS), r: r * SS, ramp }); }
  raster() {
    const { W, H, z, id } = this, floor = Math.min(H, Math.ceil((this.base[1] + 1.5) * SS));   // cut off flat at the ground, no round foot
    this.s.forEach((s, i) => {
      const r2 = s.r * s.r, lobe = MAT[s.look.mat].lobe || 0, ph = i * 2.39, nl = 3 + (i * 7 % 4);
      for (let py = Math.max(0, Math.floor(s.y - s.r)); py < Math.min(floor, Math.ceil(s.y + s.r)); py++) {
        const dy = py + 0.5 - s.y;
        for (let px = Math.max(0, Math.floor(s.x - s.r)); px < Math.min(W, Math.ceil(s.x + s.r)); px++) {
          const dx = px + 0.5 - s.x;
          let d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          if (lobe) { const f = 1 - lobe * (0.5 + 0.5 * Math.cos(nl * Math.atan2(dy, dx) + ph)); d2 /= f * f; if (d2 > r2) continue; }
          const zz = s.z + Math.sqrt(r2 - d2), k = py * W + px;
          if (zz > z[k]) { z[k] = zz; id[k] = i; }
        }
      }
    });
  }
  // Light every pixel of the sculpture, then paint over it. o: shade [y, fade] darkens bark under
  // the crown, snow 0..1 (or layer: the snow apart, see Use), birchFoot where a birch's trunk turns dark.
  paint(o = {}) {
    this.raster();
    const { W, H, z, id, s: S } = this, img = new ImageData(W, H), d = img.data, top = new ImageData(W, H), snowy = o.layer && new ImageData(W, H);
    const snow = o.layer ? 1 : o.snow;
    const aoR = (o.aoR || 6) * SS * LOOK.crevice, taps = [];
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, rr = aoR * (k % 2 ? 0.5 : 1); taps.push([Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr)]); }
    const T = new Float32Array(W * H), RP = new Array(W * H), SA = new Float32Array(W * H), leaves = [], strokes = [];
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const k = py * W + px, i = id[k];
      if (i < 0) continue;
      const s = S[i], m = MAT[s.look.mat], pz = z[k], w = m.w;
      let n = [(px + 0.5 - s.x) / s.r * w[0], (py + 0.5 - s.y) / s.r * w[0], (pz - s.z) / s.r * w[0]];
      if (s.clump && w[1]) n = add(n, mul(norm([px - s.clump[0] * SS, py - s.clump[1] * SS, pz - s.clump[2] * SS]), w[1]));
      if (s.crown && w[2]) {
        const e = s.crown;
        n = add(n, mul(norm([(px - e.x * SS) / (e.rx * e.rx), (py - e.y * SS) / (e.ry * e.ry), (pz - e.z * SS) / (e.rz * e.rz)]), w[2]));
      }
      n = norm(n);
      let occ = 0;
      for (const [ox, oy] of taps) {
        const qx = px + ox, qy = py + oy;
        if (qx >= 0 && qy >= 0 && qx < W && qy < H) occ += clamp((z[qy * W + qx] - pz) / (aoR * 1.6), 0, 1);
      }
      occ /= taps.length;
      let t = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) * 0.5 + 0.5;
      if (m.lobe) t = 0.47 + (t - 0.5) * LOOK.form;            // leaves: the light rounds the whole crown
      t = t * (1 - occ * m.ao) - occ * m.ao * 0.25 + s.tone;
      if (m.lobe) t = Math.min(t, 0.92);                       // the palest greens are only for the sunlit dabs
      if (m.shaded && o.shade) t -= 0.35 * clamp(1 - (py / SS - o.shade[0]) / o.shade[1], 0, 1);
      let rp = RAMPS[s.look.ramp];
      if (m.birch && (vnoise(px / (5 * SS), py / (1.2 * SS)) > 0.7 || py / SS > o.birchFoot)) { rp = RAMPS.bark; t -= 0.2; }
      let c = ramp(rp, t);
      if (m.shine) { const sp = Math.pow(Math.max(0, n[0] * HV[0] + n[1] * HV[1] + n[2] * HV[2]), 30) * m.shine; c = c.map(v => v + (255 - v) * sp); }
      if (snow && m.snow) {
        const up = -(m.snowOn ? (py + 0.5 - s.y) / s.r : n[1]) - (1 - snow) * 0.5 + (vnoise(px / (2 * SS), py / (2 * SS)) - 0.5) * 0.25 - (m.lobe ? 0.2 : 0);
        const a = clamp((up - 0.35) * 5, 0, 1);
        if (a > 0) {
          const sc = ramp(RAMPS.snow, t + 0.25);
          if (snowy) { snowy.data.set([sc[0], sc[1], sc[2], a * 255], k * 4); }
          else { c = c.map((v, j) => v + (sc[j] - v) * a); SA[k] = a; }
        }
      }
      const out = m.onTop ? top.data : d;
      out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = 255;
      if (m.onTop) { d[k * 4 + 3] = 255; d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; }
      if (m.lobe || m.strokes) { T[k] = t; RP[k] = rp; (m.lobe ? leaves : strokes).push(k); }
    }
    const big = canvas(W, H), bg = big.getContext('2d');
    bg.putImageData(img, 0, 0);
    this.brush(bg, T, RP, SA, leaves, strokes);
    if (this.twigs.length) this.bare(bg);
    const fc = canvas(W, H); fc.getContext('2d').putImageData(top, 0, 0); bg.drawImage(fc, 0, 0);   // fruit and flowers over the leaves
    // Trim to what was painted, and scale down to the size asked for.
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let k = 0; k < W * H; k++) if (id[k] >= 0) { const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (const { b: [x, y] } of this.twigs) { x0 = Math.min(x0, x | 0); x1 = Math.max(x1, Math.ceil(x)); y0 = Math.min(y0, y | 0); y1 = Math.max(y1, Math.ceil(y)); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
    const pad = 6 * SS; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W, x1 + pad); y1 = Math.min(H, y1 + pad);
    x0 -= x0 % SS; y0 -= y0 % SS;
    const shrink = src => {
      const c = canvas(Math.max(1, Math.ceil((x1 - x0) / SS * OUT)), Math.max(1, Math.ceil((y1 - y0) / SS * OUT))), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
      return c;
    };
    const cv = shrink(big);
    if (snowy) { const sc = canvas(W, H); sc.getContext('2d').putImageData(snowy, 0, 0); cv.snow = shrink(sc); }
    cv.bx = (this.base[0] - x0 / SS) * OUT; cv.by = (this.base[1] - y0 / SS) * OUT;
    return cv;
  }
  // The bare twigs and their haze, under what's painted (so behind the branches). Each twig thins
  // in three steps to its tip.
  bare(bg) {
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    bg.save(); bg.globalCompositeOperation = 'destination-over'; bg.lineCap = 'round';
    for (const { a, c, b, w, ramp: r, t } of this.twigs) {
      const at = u => [0, 1].map(j => (1 - u) ** 2 * a[j] + 2 * (1 - u) * u * c[j] + u * u * b[j]);
      bg.strokeStyle = css(ramp(RAMPS[r], t));
      let p = at(0);
      for (let i = 1; i <= 3; i++) {
        const q = at(i / 3);
        bg.lineWidth = w * (1.15 - i * 0.25);
        bg.beginPath(); bg.moveTo(p[0], p[1]); bg.lineTo(q[0], q[1]); bg.stroke();
        p = q;
      }
    }
    // The haze painted small and stretched back up, which blurs it for nothing.
    const { W, H } = this, k = Math.max(1, 4 * SS), hz = canvas(Math.ceil(W / k), Math.ceil(H / k)), hg = hz.getContext('2d');
    for (const { p, r, ramp: rp } of this.hazes) {
      hg.fillStyle = css(ramp(RAMPS[rp], 0.45));
      hg.beginPath(); hg.ellipse(p[0] / k, p[1] / k, r / k, r * 0.85 / k, 0, 0, 7); hg.fill();
    }
    bg.globalAlpha = this.hazeA; bg.imageSmoothingQuality = 'high';
    bg.drawImage(hz, 0, 0, hz.width * k, hz.height * k);
    bg.restore();
  }
  // The brushwork: strokes along bark and straw (kept inside them), then the leaves as dabs from
  // shade to light, each a flat colour from the light where it sits.
  brush(bg, T, RP, SA, leaves, strokes) {
    const { W, H, id, s: S } = this, R = rng(W * 7 + H + leaves.length);
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const col = (k, t) => { const c = ramp(RP[k], t), a = SA[k]; if (!a) return c; const sn = ramp(RAMPS.snow, t + 0.25); return c.map((v, j) => v + (sn[j] - v) * a); };
    if (strokes.length) {
      const layer = canvas(W, H), lg = layer.getContext('2d'), mask = new ImageData(W, H), st = [];
      for (const k of strokes) mask.data[k * 4 + 3] = 255;
      const sr = 1.5 * SS, n = Math.round(strokes.length / (sr * sr * 3) * 1.1);
      for (let j = 0; j < n; j++) { const k = strokes[Math.floor(R() * strokes.length)]; st.push([k, T[k] + (R() - 0.5) * 0.14]); }
      st.sort((a, b) => a[1] - b[1]);
      for (const [k, t] of st) {
        const s = S[id[k]], m = MAT[s.look.mat], ang = (s.dir ?? -Math.PI / 2) + (m.across ? Math.PI / 2 : 0) + (R() - 0.5) * 0.25;
        const dark = R() < LOOK.cracks, len = sr * LOOK.stroke * m.strokes * (0.7 + 0.6 * R()), wd = sr * (dark ? 0.28 : 0.5);
        lg.fillStyle = css(col(k, dark ? t - 0.22 : t));
        lg.beginPath(); lg.ellipse(k % W, (k / W) | 0, len, wd, ang, 0, 7); lg.fill();
      }
      const mc = canvas(W, H); mc.getContext('2d').putImageData(mask, 0, 0);
      lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mc, 0, 0);
      bg.drawImage(layer, 0, 0);
    }
    if (!leaves.length) return;
    const dr = LOOK.dab * SS, dabs = [], n = Math.round(leaves.length / (Math.PI * dr * dr) * LOOK.dabs);
    for (let j = 0; j < n; j++) { const k = leaves[Math.floor(R() * leaves.length)]; dabs.push([k, T[k], 0]); }
    for (let j = 0; j < n * LOOK.highlights; j++) {
      const k = leaves[Math.floor(R() * leaves.length)];
      if (T[k] > 0.6) dabs.push([k, T[k] + LOOK.shine, 1]);
    }
    dabs.sort((a, b) => a[1] - b[1]);
    for (const [k, t, hi] of dabs) {
      const x = k % W, y = (k / W) | 0, s = S[id[k]], m = MAT[s.look.mat], [lx, ly] = m.dab || [1.1, 0.68];
      const r = dr * (hi ? 0.6 : 0.75 + 0.5 * R()) * (m.small || 1);
      const ang = s.dir !== null ? s.dir + (R() - 0.5) * (m.small ? 0.3 : 0.6) : -0.7 + (R() - 0.5) * 1.6;
      if (!hi) {                                           // the leaf's darker underside, softer in the shade
        bg.fillStyle = css(col(k, t - LOOK.under * (0.4 + 0.6 * clamp(t, 0, 1))));
        bg.beginPath(); bg.ellipse(x + r * 0.3, y + r * 0.45, r * (lx + 0.05), r * (ly + 0.04), ang, 0, 7); bg.fill();
      }
      bg.fillStyle = css(col(k, t + (R() - 0.4) * 0.08));
      bg.beginPath(); bg.ellipse(x, y, r * lx, r * ly, ang, 0, 7); bg.fill();
    }
  }
}

// Bark swept along a curve: a row of spheres, each knowing which way the branch runs.
function limb(sc, a, ctrl, b, r0, r1, look) {
  const len = Math.hypot(...b.map((v, i) => v - a[i])), n = Math.ceil(len / (Math.min(r0, r1) * 0.3 + 0.3));
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const p = a.map((v, j) => u * u * v + 2 * u * t * ctrl[j] + t * t * b[j]);
    const dv = a.map((v, j) => 2 * u * (ctrl[j] - v) + 2 * t * (b[j] - ctrl[j]));
    sc.add(p, r0 + (r1 - r0) * t, look, null, null, 0, Math.atan2(dv[1], dv[0]));
  }
}
function basis(d) {
  const u = norm(Math.abs(d[1]) < 0.9 ? [d[2], 0, -d[0]] : [1, 0, 0]);
  return [u, [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]];
}
// A branching skeleton, depth levels down to the twigs (depth 0). Every segment's end goes into
// out, for the leaves. o: kids(depth), spread (radians), shrink, up (a pull upward; below 0 the
// twigs hang), taper, wobble.
function grow(sc, R, p, dir, len, r, depth, o, out, look) {
  const [u, v] = basis(dir), wob = o.wobble ?? 0.15;
  const ctrl = add(add(p, mul(dir, len * 0.5)), add(mul(u, (R() - 0.5) * len * wob * 2), mul(v, (R() - 0.5) * len * wob * 2)));
  const end = add(p, mul(dir, len)), r1 = r * (o.taper ?? 0.7);
  limb(sc, p, ctrl, end, r, r1, look);
  out.push({ p: end, from: p, depth, dir });
  if (depth <= 0) return out;
  const kids = o.kids(depth, R), a0 = R() * 6.28;
  for (let k = 0; k < kids; k++) {
    const a = a0 + k / kids * 6.28 + (R() - 0.5) * 0.8, th = o.spread * LOOK.spread * (0.7 + 0.6 * R());
    const nd = norm(add(add(mul(dir, Math.cos(th)), mul(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), Math.sin(th))), [0, -(o.up ?? 0.2), 0]));
    grow(sc, R, end, nd, len * (o.shrink ?? 0.7) * (0.8 + 0.4 * R()), r1 * 0.85, depth - 1, o, out, look);
  }
  return out;
}
function roots(sc, R, base, r, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + R() * 0.8, d = [Math.cos(a), 0, Math.sin(a) * 0.8];
    limb(sc, add(base, [d[0] * r * 0.3, -r * 1.6, d[2] * r * 0.3]), add(base, [d[0] * r * 0.8, -r * 0.3, d[2] * r * 0.8]), add(base, [d[0] * r * 1.7, 0, d[2] * r * 1.7]), r * 0.5, r * 0.12, BARK);
  }
}
function fitCrown(cs, pad = 0) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const c of cs) { x0 = Math.min(x0, c.p[0] - c.r); x1 = Math.max(x1, c.p[0] + c.r); y0 = Math.min(y0, c.p[1] - c.r); y1 = Math.max(y1, c.p[1] + c.r); z0 = Math.min(z0, c.p[2] - c.r); z1 = Math.max(z1, c.p[2] + c.r); }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + pad, z: (z0 + z1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, rz: (z1 - z0) / 2 };
}
// A clump: a dark core, leaflets over its front and top. With look.mix some leaflets borrow
// another colour, so autumn patches blend.
function clump(sc, R, c, cr, leafR, look, crown, density = 1) {
  sc.add(c, cr * 0.72, look, c, crown, -0.15);
  for (let i = 0, n = Math.round(density * 3.6 * (cr / leafR) ** 2); i < n; i++) {
    let d;
    do d = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; while (Math.hypot(...d) > 1 || Math.hypot(...d) < 0.2);
    d = norm(d);
    if (d[2] < -0.35 && d[1] > -0.3) continue;              // round the back, unseen
    const lk = look.mix && R() < 0.3 ? { ...look, ramp: look.mix[Math.floor(R() * look.mix.length)] } : look;
    sc.add(add(c, mul(d, cr * (0.78 + 0.22 * R()))), leafR * (0.75 + 0.5 * R()), lk, c, crown, (R() - 0.5) * 0.09);
  }
}
// Leaf clumps at the segment ends between depths lo and hi (and halfway along with along).
// ramps: the tree takes one of them (in spring never the yellow), and a few clumps another. bare: no leaves, but a spray of fine twigs where each clump would
// be (twig: their ramp, twigW how thick, haze how strongly they show from afar); twigs: those twigs
// under the leaves too; keep, size: fewer or smaller clumps, as LEAVES.
function leafy(sc, R, tips, o, look) {
  const cs = [], ends = [];
  for (const t of tips) if (t.depth <= o.hi && t.depth >= (o.lo || 0)) {
    const k = o.clumpR * (0.75 + 0.5 * R()) * (t.depth === 0 ? 1 : 1.15);
    cs.push({ p: add(add(t.p, mul(t.dir, k * 0.35)), [0, o.droop || 0, 0]), r: k });
    ends.push([t, k]);
    if (t.depth <= (o.along ?? -1)) cs.push({ p: add(add(t.p, t.from).map(v => v / 2), [0, (o.droop || 0) + k * 0.3, 0]), r: k * 0.85 });
  }
  const low = fitCrown(cs), up = cs.filter(c => c.p[1] < low.y + low.ry * LOOK.lift);   // the crown up off the trunk
  if (up.length >= 3) { cs.length = 0; cs.push(...up); }
  const crown = fitCrown(cs);
  const keep = LEAVES.keep * (o.keep ?? 1), size = LEAVES.size * (o.size ?? 1);
  // One colour for the whole tree, so autumn is a patchwork of trees and not of leaves.
  const mains = o.ramps && SEASON === 'spring' && o.ramps.some(r => r !== 'lemon') ? o.ramps.filter(r => r !== 'lemon') : o.ramps;
  const main = mains && mains[Math.floor(OWN() * mains.length)];
  if (o.bare || o.twigs || LEAVES.size < 1) twigs(sc, ends, cs, crown, o);
  if (!o.bare) for (const c of cs) {
    if (keep < 1 && R() > keep) continue;   // (no draw when all, so the full looks come out as before)
    const pick = o.ramps && o.ramps[Math.floor(R() * o.ramps.length)];
    const lk = o.ramps ? { ...look, ramp: OWN() < 0.12 ? pick : main, mix: [main] } : look;
    clump(sc, R, c.p, c.r * size, o.leafR * LOOK.leaflet, lk, crown, o.density ?? 1);
  }
  return { crown, cs };
}
// A bare crown's fine twigs, from each branch end: a fan of them, each with a side twig or two.
// Lighter towards the sun. Their own random numbers, so the rest of the tree comes out the same.
function twigs(sc, ends, cs, crown, o) {
  const R = rng(ends.length * 131 + 7), rp = o.twig || 'twig', w = o.twigW || 1;
  if (o.haze) sc.hazeA = o.haze;
  const tone = p => 0.42 + 0.2 * clamp((crown.x - p[0]) / crown.rx * 0.55 + (crown.y - p[1]) / crown.ry * 0.75, -1, 1) + (R() - 0.5) * 0.1;
  const spray = (a, dir, len, wd, kids) => {
    const d = norm(add(dir, [(R() - 0.5) * 1.1, (R() - 0.5) * 1.1 - 0.2, (R() - 0.5) * 1.1])), b = add(a, mul(d, len));
    const [u] = basis(d), c = add(add(a, mul(d, len * 0.5)), mul(u, (R() - 0.5) * len * 0.3));
    sc.twig(a, c, b, wd, rp, tone(b));
    for (let i = 0; i < kids; i++) spray(add(a, mul(d, len * (0.35 + 0.35 * R()))), d, len * 0.5, wd * 0.6, 0);
  };
  const fall = [0, o.twigDroop || 0, 0];
  for (const [t, k] of ends) {
    const dir = add(t.dir, fall);
    for (let i = 0, n = 4 + Math.floor(R() * 3); i < n; i++) spray(t.p, dir, k * (0.6 + 0.5 * R()), w * (0.9 + 0.4 * R()), 1 + (R() < 0.5));
    for (let i = 0; i < 3; i++) spray(add(t.from, mul(add(t.p, mul(t.from, -1)), 0.3 + 0.5 * R())), dir, k * (0.5 + 0.4 * R()), w * 0.8, 1);   // and along the branch
  }
  for (const c of cs) sc.haze(c.p, c.r * 0.8, rp);
}
// Things dotted over a crown's clumps: fruit, blossom, berries (painted on top of the leaves).
function dot(sc, R, cs, n, r, ramps, spread = [1.4, -0.2]) {
  for (let i = 0; i < n; i++) {
    const c = cs[Math.floor(R() * cs.length)], d = norm([R() * 2 - 1, R() * spread[0] + spread[1], 0.4 + R()]);
    sc.add(add(c.p, mul(d, c.r * 1.03)), r * (0.85 + 0.3 * R()), { mat: 'fruit', ramp: ramps[Math.floor(R() * ramps.length)] });
  }
}
// Fallen leaves or petals round the foot.
function litter(cv, R, cols, rx, n = 40) {
  const g = cv.getContext('2d');
  g.globalAlpha = 0.9;
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, r = Math.sqrt(R()) * rx;
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.ellipse(cv.bx + Math.cos(a) * r * OUT, cv.by + (-3 + Math.sin(a) * r * 0.1) * OUT, 2.2 * OUT, 1.3 * OUT, R() * 3, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ the kinds
//
// Each paints one kind: (R, season, o) => [scene, paint options, after(canvas)?]. The skeleton
// comes first and is the same in every season, so a tree keeps its shape all year.

const BARK = { mat: 'bark', ramp: 'bark' };

function oak(R, season, o) {
  const old = o.hive, sc = old ? new Scene(390, 345, 195, 318) : new Scene(340, 330, 170, 310), base = [...sc.base, 0], trunkR = old ? 21 : 12;
  roots(sc, R, base, trunkR, old ? 5 : 4);
  const tips = grow(sc, R, base, norm([0.02, -1, 0]), old ? 96 : 50, trunkR, 4,
    { kids: d => d > 3 ? 3 : 2 + (R() < 0.4), spread: old ? 1.05 : 0.95, shrink: 0.74, up: 0.12, taper: 0.64, wobble: 0.22 }, [], BARK);
  // Oaks hold on to their dry leaves all winter: a thin, pale buff over the bare twigs, so it never
  // reads as autumn (a full copper crown in early spring looked like the wrong season).
  const winter = season === 'winter', ramps = { spring: ['spring', 'spring', 'lemon'], summer: ['summer'], autumn: ['russet', 'copper', 'scarlet'], winter: ['dry'] }[season];
  const { crown } = leafy(sc, R, tips, { lo: 1, hi: 2, clumpR: 25, leafR: 6, density: winter ? 0.6 : season === 'spring' ? 0.8 : 1, ramps, bare: o.bare, twigs: winter, keep: winter ? 0.5 : 1, size: winter ? 0.7 : 1 }, { mat: 'leaf', ramp: 'summer' });
  if (old) hive(sc, R, base, trunkR);
  return [sc, { aoR: 7, shade: winter ? null : [crown.y + crown.ry * 0.6, 40] }, cv => season === 'autumn' && litter(cv, R, ['#c0622a', '#d8903a', '#a4481e'], 55, 24)];
}

// The hive: a split in the old oak's trunk, dark inside, and in it a dome of golden straw rings
// nearly as wide as the trunk, a dark door at its foot.
function hive(sc, R, base, trunkR) {
  const cx = base[0] + 1, cy = base[1] - 56, zf = trunkR * 0.9;       // zf: about the front of the trunk
  const HOLLOW = { mat: 'hollow', ramp: 'hollow' }, STRAW = { mat: 'straw', ramp: 'comb' };
  for (const dy of [-26, -14, -2, 10, 20]) sc.add([cx, cy + dy, zf - 10], 15 - Math.abs(dy + 3) * 0.2, HOLLOW);
  for (let i = 0; i < 40; i++) {                              // its lip, bark rolled round the edge
    const a = i / 40 * 6.28, rx = 16 + 2 * Math.cos(a * 2), e = [cx + Math.cos(a) * rx, cy - 3 + Math.sin(a) * 33, zf + 1.5];
    sc.add(e, 3.6 + 0.8 * R(), BARK, null, null, 0.06, a + Math.PI / 2);
  }
  const rings = 9;
  for (let j = 0; j < rings; j++) {                           // tucked in at the foot, round in the middle, domed on top
    const f = j / (rings - 1), ry = cy + 20 - f * 40, tube = 3 - f * 0.8;
    const rr = 12 * Math.sqrt(Math.max(0, 1 - (f * 0.97) ** 2.2)) * (0.86 + 0.14 * Math.min(1, f * 4)) + 1.2;
    for (let a = -Math.PI; a <= 0.01; a += 0.13) {           // only the front half shows
      sc.add([cx + Math.cos(a) * rr, ry, zf + 3 - Math.sin(a) * rr * 0.85], tube, STRAW, null, null, (R() - 0.5) * 0.05 + 0.05 - 0.04 * (j % 2), 0);
    }
  }
  sc.add([cx, cy - 21, zf + 4], 3.6, STRAW, null, null, 0.08, 0);
  for (const [dx, dy, r] of [[0, 14, 3.2], [1.4, 15.4, 3.3], [-1.4, 15.4, 3]]) sc.add([cx + dx, cy + dy, zf + 3 + 11], r, HOLLOW);   // the door
}

function maple(R, season) {
  const sc = new Scene(300, 285, 150, 270), base = [150, 270, 0];
  roots(sc, R, base, 9, 3);
  const tips = grow(sc, R, base, [0, -1, 0], 58, 9, 4, { kids: d => 2 + (R() < 0.5), spread: 0.7, shrink: 0.74, up: 0.25, taper: 0.66 }, [], BARK);
  const ramps = { spring: ['spring', 'spring', 'summer'], summer: ['summer'], autumn: ['maple', 'scarlet', 'scarlet', 'gold'], winter: null }[season];
  const { crown } = leafy(sc, R, tips, { lo: 1, hi: 2, clumpR: 23, leafR: 5.4, ramps, bare: season === 'winter' }, { mat: 'leaf', ramp: 'summer' });
  return [sc, { aoR: 7, shade: season === 'winter' ? null : [crown.y + crown.ry * 0.6, 36] }, cv => season === 'autumn' && litter(cv, R, ['#e07a22', '#c9481c', '#f0a83a'], 55)];
}

// Beech: a broad, round crown on a smooth grey trunk; copper and gold in autumn.
function beech(R, season) {
  const sc = new Scene(320, 285, 160, 270), base = [160, 270, 0], GREY = { mat: 'bark', ramp: 'grey' };
  roots(sc, R, base, 10, 4);
  const tips = grow(sc, R, base, norm([0.03, -1, 0]), 54, 10, 4, { kids: d => d > 3 ? 3 : 2 + (R() < 0.5), spread: 0.85, shrink: 0.74, up: 0.2, taper: 0.66, wobble: 0.14 }, [], GREY);
  const ramps = { spring: ['spring', 'lemon', 'spring'], summer: ['summer', 'olive'], autumn: ['copper', 'gold', 'copper', 'russet'], winter: null }[season];
  const { crown } = leafy(sc, R, tips, { lo: 1, hi: 2, clumpR: 24, leafR: 5.6, ramps, bare: season === 'winter', twig: 'twiggy' }, { mat: 'leaf', ramp: 'summer' });
  return [sc, { aoR: 7, shade: season === 'winter' ? null : [crown.y + crown.ry * 0.6, 36] }, cv => season === 'autumn' && litter(cv, R, ['#c0622a', '#d8a03a', '#a4481e'], 55, 26)];
}

// A birch keeps one leader to the top, with thin darker branches off it whose twigs hang down.
function birch(R, season) {
  const sc = new Scene(270, 332, 130, 320), base = [130, 320, 0], Ht = 250, BIR = { mat: 'birch', ramp: 'birch' };
  const top = [130 + (R() - 0.5) * 24, 320 - Ht, 0], mid = [130 + (R() - 0.5) * 20, 320 - Ht * 0.5, 0];
  limb(sc, base, mid, top, 6.5, 1.4, BIR);
  const on = t => base.map((v, j) => (1 - t) ** 2 * v + 2 * (1 - t) * t * mid[j] + t * t * top[j]);
  const tips = [{ p: top, from: on(0.9), depth: 0, dir: [0, -1, 0] }];
  let a = R() * 6.28;
  for (let h = 0.36; h < 0.95; h += 0.03 + R() * 0.025) {
    a += 2.4 + (R() - 0.5) * 0.6;                                   // round the trunk, like real branches
    const p = on(h), dir = norm([Math.cos(a), -0.75 - 0.3 * h, Math.sin(a) * 0.8]);
    grow(sc, R, p, dir, (42 * Math.sin(Math.PI * Math.min(1, (h - 0.2) * 1.3)) + 12) * (0.75 + 0.4 * R()), 2 * (1 - h * 0.6), 2,
      { kids: () => 2, spread: 0.55, shrink: 0.62, up: -0.35, taper: 0.6, wobble: 0.2 }, tips, BARK);
  }
  const ramps = { spring: ['spring', 'spring', 'lemon'], summer: ['spring', 'spring', 'summer'], autumn: ['gold', 'gold', 'lemon'], winter: null }[season];
  const { crown } = leafy(sc, R, tips, { hi: 2, along: 1, droop: 6, clumpR: 11, leafR: 3.4, density: 0.85, ramps, bare: season === 'winter', twig: 'birchtwig', haze: 0.42, twigDroop: 0.8, twigW: 0.8 }, { mat: 'leaf', ramp: 'spring' });
  return [sc, { aoR: 5, shade: season === 'winter' ? null : [crown.y + crown.ry * 0.8, 30], birchFoot: 306 }];
}

// Apple and cherry: short trunks, wide low crowns. Apples blossom white among the new leaves and
// hang red from summer; cherries are a pink cloud in spring, hang dark red in summer, go red.
function fruitTree(R, season, kind) {
  const sc = new Scene(300, 288, 150, 250), base = [150, 250, 0];
  roots(sc, R, base, 9, 3);
  const tips = grow(sc, R, base, [0, -1, 0], 30, 10, 4, { kids: d => d === 4 ? 4 : 2, spread: 1.0, shrink: 0.9, up: 0.02, taper: 0.66, wobble: 0.3 }, [], BARK);
  const cherry = kind === 'cherry', pinkCloud = cherry && season === 'spring';
  const ramps = { spring: cherry ? ['pink'] : ['olive', 'spring'], summer: ['olive'], autumn: cherry ? ['scarlet', 'copper', 'gold'] : ['olive', 'lemon', 'gold'], winter: null }[season];
  const { crown, cs } = leafy(sc, R, tips, { lo: 1, hi: 2, clumpR: 21, leafR: 5, ramps, bare: season === 'winter' }, { mat: pinkCloud ? 'bloom' : 'leaf', ramp: 'olive' });
  if (season === 'spring' && !cherry) dot(sc, R, cs, 260, 2.6, ['white', 'white', 'pink'], [1.6, -0.9]);
  if (!cherry && (season === 'summer' || season === 'autumn')) dot(sc, R, cs, season === 'summer' ? 22 : 10, 4.6, ['apple']);
  if (cherry && season === 'summer') dot(sc, R, cs, 30, 2.4, ['cherry']);
  const after = cv => pinkCloud ? litter(cv, R, ['#f7b8cf', '#fbd3e1', '#ef9fbd'], 55) : season === 'autumn' && litter(cv, R, cherry ? ['#c9381c', '#e07a22'] : ['#c8b040', '#d89a3a'], 50, 20);
  return [sc, { aoR: 7, shade: season === 'winter' ? null : [crown.y + crown.ry * 0.6, 30] }, after];
}

// Pines: tiers of boughs that fan out and droop, their tips turning up (fresh and light in
// spring), over a dark skirt of needles. The tiers vary and the top leans, so no two are alike.
function pine(R, season) {
  const sc = new Scene(220, 295, 110, 282), bx = 110, lean = (R() - 0.5) * 8;
  const X = y => bx + lean * (1 - y / 282) ** 2;
  limb(sc, [bx, 282, 0], [X(150), 150, 0], [X(40), 40, 0], 8, 2, BARK);
  const tiers = 7, NEED = { mat: 'needle', ramp: 'pine' }, TIPS = season === 'spring' ? { mat: 'needle', ramp: 'fresh' } : NEED;
  for (let k = 0; k < tiers; k++) {
    const f = k / (tiers - 1), y = 230 - f * 184 + (R() - 0.5) * 6, cx = X(y);
    const Rk = (72 * Math.pow(1 - f, 0.85) + 12) * (0.9 + 0.2 * R()), drop = 20 + 24 * (1 - f), lr = 3.4 + 2 * (1 - f);
    const crown = { x: cx, y: y + drop * 0.35, z: 0, rx: Rk, ry: drop * 0.9, rz: Rk };
    for (let i = 0, n = Math.round(1.6 * (Rk / lr) ** 2); i < n; i++) {          // the skirt
      const a = R() * 6.28, q = Math.pow(R(), 0.5) * 0.9, r = q * Rk, yy = y + drop * q * q + 2;
      if (Math.sin(a) < -0.4) continue;
      sc.add([cx + Math.cos(a) * r, yy, Math.sin(a) * r], lr * 1.1, NEED, [cx + Math.cos(a) * r * 0.8, yy - 4, Math.sin(a) * r * 0.8], crown, -0.18 - 0.2 * (1 - q), Math.atan2(drop * 2 * q, Math.cos(a) * Rk));
    }
    const nb = 9 + Math.round(Rk / 6);
    for (let j = 0; j < nb; j++) {                                              // the boughs
      const a = j / nb * 6.28 + k * 1.3 + (R() - 0.5) * 0.5;
      if (Math.sin(a) < -0.5 || R() < 0.12) continue;                          // the back, and the odd gap
      const len = Rk * (0.75 + 0.35 * R()), ca = Math.cos(a), sa = Math.sin(a);
      for (let r = 3; r < len; r += lr * 0.55) {
        const q = r / len, droop = drop * q * q - 5 * Math.sin(q * Math.PI) - (q > 0.85 ? (q - 0.85) * 18 : 0);
        const w = lr * (0.6 + 1.6 * q), along = Math.atan2(drop * 2 * q - 5 * Math.PI * Math.cos(q * Math.PI), ca * len + 0.01);
        for (let m = 0; m < 2; m++) {
          const off = (R() - 0.5) * w, p = [cx + ca * r - sa * off, y + droop + (R() - 0.3) * 3, sa * r + ca * off];
          sc.add(p, lr * (0.8 + 0.4 * R()) * (1.1 - 0.3 * q), q > 0.8 ? TIPS : NEED, [cx + ca * r * 0.85, y + droop - 4, sa * r * 0.85], crown,
            (R() - 0.5) * 0.1 + 0.02 + (q > 0.8 ? 0.1 : 0), along);
        }
      }
    }
  }
  const tip = { x: X(32), y: 32, z: 0, rx: 9, ry: 16, rz: 9 };
  for (let y = 20; y < 46; y += 2.2) { const w = (y - 18) * 0.3; sc.add([X(y) + (R() - 0.5) * w, y, (R() - 0.2) * w], 2.6 + w * 0.5, TIPS, [X(y), y + 2, 0], tip, (R() - 0.5) * 0.1 + 0.05, Math.PI / 2 + (R() - 0.5)); }
  return [sc, { aoR: 6 }];
}

// The willow, by the water: a fountain. A short trunk parts into a few leaders that arch up and
// out, and from them hang long strands, over the top of the dome and down its sides nearly to the
// ground. Inner strands are darker, so the curtain has depth; in front it parts a little over the
// trunk. In winter the strands stay, bare golden withies; in between, some are in leaf (LEAVES).
function willow(R, season) {
  const sc = new Scene(340, 292, 170, 272), base = [170, 272, 0], winter = season === 'winter';
  const cx = 170 + (R() - 0.5) * 10, top = 48 + R() * 10, eq = 128 + R() * 10, Rx = 100 + R() * 10, Rz = Rx * 0.8;
  const dome = { x: cx, y: 214, z: 0, rx: Rx, ry: 214 - top, rz: Rz };   // for the light: lit on top, round at the sides
  // Not a perfect bell: a few cascades, one side fuller, the hem rising and falling round the tree.
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28], lean = (R() - 0.5) * 0.24;
  const lobe = a => 0.5 + 0.3 * Math.sin(3 * a + ph[0]) + 0.2 * Math.sin(5 * a + ph[1]);
  const at = (a, th, k = 1) => {
    const kk = k * (1 + lean * Math.cos(a) + 0.08 * lobe(a)), t = top + 22 * (1 - lobe(a));
    return [cx + Math.cos(a) * Rx * Math.sin(th) * kk, eq - (eq - t) * Math.cos(th) * k, Math.sin(a) * Rz * Math.sin(th) * kk];
  };
  roots(sc, R, base, 13, 5);
  const fork = [cx + (R() - 0.5) * 8, 196, 0];
  limb(sc, base, add(base, [0, -40, 0]), fork, 14, 11, BARK);
  for (let i = 0, n = 4 + Math.floor(R() * 2); i < n; i++) {            // the leaders, arching up and out
    const a = i / n * 6.28 + R() * 0.8, end = at(a, 0.75 + 0.35 * R(), 0.72), mid = add(fork, [0, -60, 0]), m = lerpV(mid, end, 0.3);
    limb(sc, fork, [m[0], mid[1] - 30, m[2]], end, 9, 3.5, BARK);
    const tip = at(a + (R() - 0.5) * 0.6, 1.35, 0.85);
    limb(sc, end, add(lerpV(end, tip, 0.5), [0, -18, 0]), tip, 3.5, 1.5, BARK);
  }
  const ramps = { spring: ['spring', 'willow', 'willow'], summer: ['willow', 'willow', 'willow', 'willow', 'spring'], autumn: ['lemon', 'willow', 'gold', 'lemon'], winter: null }[season];
  for (let i = 0, n = winter ? 130 : 230; i < n; i++) {
    const back = i % 4 === 3, a = back ? Math.PI + R() * Math.PI : -0.35 + R() * (Math.PI + 0.7);   // most in front and round the sides
    const k = back ? 0.82 + 0.1 * R() : 0.86 + 0.16 * R(), th0 = Math.acos(1 - R() * 0.95) * (0.9 + 0.1 * R());   // spread evenly over the dome
    const leafy = ramps && R() < LEAVES.keep * (0.4 + 0.6 * LEAVES.size), w0 = winter || !leafy ? 1.6 : 1.6 + 2.2 * LEAVES.size;
    const STR = { mat: 'strand', ramp: leafy ? ramps[Math.floor(R() * ramps.length)] : 'withy' };
    const front = Math.sin(a) * Math.max(0, 1 - Math.abs(Math.cos(a)) * 2.5);    // over the trunk the curtain parts a little
    const hem = 258 - 34 * (1 - lobe(a * 1.3 + 1)) - 12 * R() ** 2 - 36 * front * R();
    const tone = (k - 0.95) * 0.9 - (back ? 0.12 : 0) + (R() - 0.5) * 0.06;
    const sway = 0.2 + 0.3 * R(), wph = R() * 6.28, fq = 0.03 + 0.03 * R(), out = Math.cos(a) * (0.03 + 0.05 * R());
    let p = at(a, th0, k), th = th0, s = 0, st = leafy ? 3 : 2;   // a bare withy is thin, so closer steps
    while (p[1] < hem) {
      let q;
      if (th < 1.5) { th = Math.min(1.5, th + st / (Rx * k)); q = at(a, th, k); q[1] -= 5 * Math.sin(th * 2) * (1 - th0); }   // over the dome, arching
      else q = [p[0] + out * st + Math.sin(s * fq + wph) * sway, p[1] + st, p[2]];   // then straight down, swaying
      const dir = Math.atan2(q[1] - p[1], q[0] - p[0]), f = clamp((hem - q[1]) / 30, 0, 1), wdt = w0 * (0.45 + 0.55 * f);
      const clump = [cx + (q[0] - cx) * 0.6, q[1] - 6, q[2] * 0.6];          // so the curtain rounds outward
      sc.add(add(q, [(R() - 0.5) * wdt * 0.6, 0, (R() - 0.5) * 2]), wdt * (0.55 + 0.3 * R()), STR, clump, dome, tone + (R() - 0.5) * 0.08, dir);
      if (leafy && R() < 0.35) sc.add(add(q, [(R() - 0.5) * wdt * 1.4, 1.2, 1 + R() * 2]), wdt * 0.4, STR, clump, dome, tone + (R() - 0.5) * 0.1, dir);
      p = q; s += st;
    }
  }
  return [sc, { aoR: 7, shade: [eq + 30, 60] }];
}
const lerpV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Hawthorn: a thicket of stems. White blossom in spring, red haws in autumn that hang on into winter.
function hawthorn(R, season) {
  const sc = new Scene(240, 190, 120, 182), base = [120, 182, 0], tips = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 3.2 - 0.05 + (R() - 0.5) * 0.3, dir = norm([Math.cos(a) * 0.75, -1, Math.sin(a) * 0.5]);
    grow(sc, R, add(base, [(R() - 0.5) * 10, 0, (R() - 0.5) * 6]), dir, 30 + R() * 14, 3.2, 2, { kids: () => 2, spread: 0.7, shrink: 0.7, up: 0.1, taper: 0.7, wobble: 0.3 }, tips, BARK);
  }
  const ramps = { spring: ['summer', 'spring'], summer: ['summer'], autumn: ['russet', 'copper', 'summer'], winter: null }[season];
  const { crown, cs } = leafy(sc, R, tips, { lo: 0, hi: 1, clumpR: 17, leafR: 4.6, ramps, bare: season === 'winter' }, { mat: 'leaf', ramp: 'summer' });
  if (season === 'spring') dot(sc, R, cs, 200, 2.2, ['white', 'white', 'white', 'pink'], [1.6, -0.9]);
  if (season === 'autumn' || season === 'winter') {
    for (let i = 0, n = season === 'autumn' ? 22 : 12; i < n; i++) {           // haws, in bunches
      const c = cs[Math.floor(R() * cs.length)], d = norm([R() * 2 - 1, R() - 0.3, 0.5 + R()]), p = add(c.p, mul(d, c.r * (season === 'winter' ? 0.5 : 0.95)));
      for (let j = 0; j < 3; j++) sc.add(add(p, [(j - 1) * 2.8, (j % 2) * 2.2, 1.5]), 2.4, { mat: 'fruit', ramp: 'berry' });
    }
  }
  return [sc, { aoR: 6, shade: season === 'winter' ? null : [crown.y + crown.ry * 0.7, 30] }];
}

const KINDS = {
  oak:      { name: 'Oak', paint: oak },
  hive:     { name: 'Hive oak', paint: (R, s, o) => oak(R, s, { ...o, hive: true }) },   // its door's sill: 1, -38 from the foot (game.js HIVE_DOOR)
  beech:    { name: 'Beech', paint: beech },
  maple:    { name: 'Maple', paint: maple },
  birch:    { name: 'Birch', paint: birch },
  apple:    { name: 'Apple', paint: (R, s) => fruitTree(R, s, 'apple') },
  cherry:   { name: 'Cherry', paint: (R, s) => fruitTree(R, s, 'cherry') },
  pine:     { name: 'Pine', paint: pine },
  willow:   { name: 'Willow', paint: willow },
  hawthorn: { name: 'Hawthorn', paint: hawthorn },
};
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// The looks between the seasons, so a tree turning fades between two that are alike: an oak without
// its dry leaves (bare, a few days in early spring), a tuft of first leaves at every twig end (bud),
// half of them fallen (thin).
const LOOKS = { bare: ['winter', 'bare'], bud: ['spring', { keep: 1, size: 0.45 }], thin: ['autumn', { keep: 0.45, size: 0.7 }] };

function paint(kind, o = {}) {
  SS = o.ss || 3; OUT = o.scale || 1;
  const [season, how] = LOOKS[o.season] || [o.season || 'summer'], R = rng((o.seed ?? 1) * 7919 + 13);
  SEASON = season; OWN = rng((o.seed ?? 1) * 104729 + 7);
  LEAVES = typeof how === 'object' ? how : { keep: 1, size: 1 };
  const [sc, po, after] = KINDS[kind].paint(R, season, { ...o, bare: how === 'bare' });
  const cv = sc.paint({ ...po, snow: o.snow ?? 0, layer: !!o.snowLayer });
  if (after) after(cv);
  return cv;
}

self.Trees = { paint, KINDS, SEASONS, LOOKS, LOOK, RAMPS };
})();
