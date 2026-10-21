/* Nobody's Meadow — the painted foxes and rabbits: their rigs and poses, painted as one animal (paintFur), and the few
 * drawing helpers every painting in game.js uses. The page loads it before game.js, which takes these from Fur, and
 * fur-worker.js loads it to paint them off the main thread. It knows nothing of the meadow or the screen: each of
 * painters (paintFox, paintRabbit, and the visitors' paintDragonfly, paintKingfisher, paintSkylark) paints one into a
 * canvas size pixels square, U pixels to the animal's size, n as in game.js's names for them ('fox:' + n, 'dfly:' + n).
 */
(root => {
'use strict';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
// A scratch canvas: the page's, or in the worker an OffscreenCanvas (a new one is 300 by 150 either way), painted on the
// CPU there (fur-worker.js says why).
const newCanvas = typeof document !== 'undefined' ? () => document.createElement('canvas')
  : () => { const c = new OffscreenCanvas(300, 150); c.getContext('2d', { willReadFrequently: true }); return c; };

// ------------------------------------------------------------------ drawing helpers (game.js paints with them too)

const tone = (c, k, add = 0) => [c[0] * k + add, c[1] * k + add, c[2] * k + add];
const rockRGB = (c, a = 1) => `rgba(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')},${a})`;
// Paths in a painting's own box: filled or stroked in a colour, and a disc or an oval added to the path.
const fillIn = (g, colour, path) => { g.fillStyle = colour; g.beginPath(); path(); g.fill(); };
const strokeIn = (g, colour, w, path) => { g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); path(); g.stroke(); };
const discAt = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
const ovalAt = (g, x, y, rx, ry, a = 0) => { g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx); g.ellipse(x, y, rx, ry, a, 0, TAU); };
// A part, shaded soft from its lit top to its dark underside (painted once, so a gradient is fine).
function softIn(g, rgb, y0, y1, path, lit = 1.18, dim = 0.68) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, rockRGB(tone(rgb, lit, 12)));
  gr.addColorStop(0.5, rockRGB(rgb));
  gr.addColorStop(1, rockRGB(tone(rgb, dim)));
  g.fillStyle = gr; g.beginPath(); path(); g.fill();
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

// Fox fur: one sliding shade that families share. The grey is warm, so the shades between stay fox-coloured.
const FOX_FUR = [[245, 150, 60], [214, 92, 42], [176, 98, 62], [186, 176, 162], [250, 248, 244]];
function foxRGB(f) {
  const p = clamp(f, 0, 0.999) * (FOX_FUR.length - 1);
  const i = Math.floor(p), t = p - i, a = FOX_FUR[i], b = FOX_FUR[i + 1];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
}
// The fox's white and its dark socks (the dead fox's too, in game.js).
const FOX_WHITE = [240, 234, 222], FOX_SOCK = [74, 54, 46];

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
// A trot, a quarter stride a frame: the diagonal pairs (the near fore with the far hind) half a stride apart, each paw
// drawn back along the ground under the fox, then lifted and swung forward, TROT_REACH either side of where it stands.
const TROT_REACH = 0.13, TROT_LIFT = 0.1;
function foxTrot(k) {
  const paw = (x, half) => {
    const a = (k / 4 + 1 / 8 + half / 2) * TAU, up = a % TAU > Math.PI ? -Math.sin(a) : 0;
    return [x - TROT_REACH * Math.cos(a), 0.71 - TROT_LIFT * up];
  };
  return { ...FOX_STAND, chest: [-0.22, 0.21], hip: [0.27, 0.2], head: [-0.52, 0.02, -0.05], tail: FOX_TROT_TAIL,
    fore: { near: paw(-0.25, 0), far: paw(-0.2, 1) }, hind: { near: paw(0.3, 1), far: paw(0.35, 0) } };
}
const FOX_RUN_TAIL = { base: [0.44, 0.08], c1: [0.64, 0.07], c2: [0.84, 0.1], tip: [1.06, 0.14], w: 1 };
const FOX_POSES = {
  stand: FOX_STAND,
  trot1: foxTrot(0), trot2: foxTrot(1), trot3: foxTrot(2), trot4: foxTrot(3),
  // A gallop: stretched out in the air, down on the forepaws, gathered in the air, then the hind paws push it off again.
  run1: { ...FOX_STAND, chest: [-0.27, 0.17], hip: [0.3, 0.16], head: [-0.62, 0.05, -0.1], ear: 0.35, tail: FOX_RUN_TAIL,
    fore: { near: [-0.62, 0.52], far: [-0.54, 0.57] }, hind: { near: [0.5, 0.6], far: [0.56, 0.6] } },
  run2: { ...FOX_STAND, chest: [-0.24, 0.22], hip: [0.25, 0.16], head: [-0.58, 0.1, -0.14], ear: 0.35, tail: FOX_RUN_TAIL,
    fore: { near: [-0.42, 0.71], far: [-0.2, 0.69] }, hind: { near: [0.32, 0.55], far: [0.38, 0.53] } },
  run3: { ...FOX_STAND, chest: [-0.18, 0.2], hip: [0.17, 0.17], arch: 0.05, head: [-0.5, 0.07, -0.12], ear: 0.35,
    tail: { base: [0.32, 0.08], c1: [0.52, 0.04], c2: [0.72, 0.1], tip: [0.92, 0.18], w: 1 },
    fore: { near: [-0.07, 0.7], far: [-0.01, 0.62] }, hind: { near: [0.09, 0.66], far: [0.15, 0.68] } },
  run4: { ...FOX_STAND, chest: [-0.24, 0.18], hip: [0.24, 0.22], arch: 0.02, head: [-0.58, 0.03, -0.08], ear: 0.35, tail: FOX_RUN_TAIL,
    fore: { near: [-0.64, 0.5], far: [-0.56, 0.55] }, hind: { near: [0.38, 0.71], far: [0.27, 0.7] } },
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
  const c = foxLayers[i] || (foxLayers[i] = newCanvas());
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

const FOX_GRAIN = [['rgba(60,25,10,0.035)', 1, 6], ['rgba(255,240,215,0.035)', 1, 6]];
function paintFox(g, size, U, n) {
  const P = FOX_POSES[FOX_POSE_NAMES[n & 15]] || FOX_STAND, coat = foxRGB((n >> 4) / 10), { parts, inHead } = foxParts(P);
  paintFur(g, size, U, parts, { coat, top: P.sleep ? 0.26 : Math.min(P.chest[1], P.hip[1]) - 0.2, shade: FOX_SHADE, light: FOX_LIGHT, grain: FOX_GRAIN,
    face: inHead(g => {                                                         // the face, crisp
      fillIn(g, '#2a211d', () => discAt(g, -0.34, 0.045, 0.03));
      fillIn(g, 'rgba(255,255,255,0.35)', () => ovalAt(g, -0.345, 0.033, 0.012, 0.007));
      if (P.eye === 'shut') strokeIn(g, '#3a2a22', 0.03, () => { g.moveTo(-0.15, -0.02); g.quadraticCurveTo(-0.1, 0.015, -0.04, -0.015); });
      else {
        fillIn(g, '#241a16', () => ovalAt(g, -0.1, -0.025, 0.036, 0.03, -0.2));
        fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, -0.112, -0.038, 0.011));
      }
      strokeIn(g, rockRGB(tone(coat, 0.55), 0.6), 0.016, () => { g.moveTo(-0.32, 0.075); g.quadraticCurveTo(-0.25, 0.085, -0.19, 0.07); });   // the mouth
    }) });
}

// Paints an animal's parts (foxParts, rabbitParts) as one animal. look: its coat, where the fur's light starts (top),
// the colours of its shade and light, its grain ([ink, how thick, stroke length]), its face, painted crisp at the end,
// and flat: if given, the parts behind are only that much in the shade, with no form of their own. Each pass through
// the scratch layer (a part's shadow, its shade, its light) is most of what a painting costs (it's flushed), so a part
// can be joined to the next one: the two get their form as one shape.
function paintFur(g, size, U, parts, look) {
  const k = look.scale || 1, m = new DOMMatrix([U / 2 * k, 0, 0, U / 2 * k, size / 2, size / 2 + U / 2 * 0.72 * (1 - k)]), { coat, shade, light } = look;
  const L = foxLayer(0, size, m), T = foxLayer(1, size, m);
  const onto = (from, to) => { to.save(); to.setTransform(1, 0, 0, 1, 0, 0); to.drawImage(from.canvas, 0, 0); to.restore(); };
  const fresh = () => { T.setTransform(1, 0, 0, 1, 0, 0); T.globalCompositeOperation = 'source-over'; T.clearRect(0, 0, size, size); T.setTransform(m); };
  const fur = L.createLinearGradient(0, look.top, 0, 0.74);                     // one shading, over the whole animal
  fur.addColorStop(0, rockRGB(tone(coat, 1.16, 12))); fur.addColorStop(0.5, rockRGB(coat)); fur.addColorStop(1, rockRGB(tone(coat, 0.72)));
  let joined = null;                                                            // parts waiting for the next one's form
  for (const p of parts) {
    if (p.casts) {                                                              // its soft shadow on what's behind
      fresh();
      softFill(T, shade, 0.32, 0.07, p.path, 0.025, 0.02);
      if (p.leg !== undefined) foxFade(T, 'destination-out', [0, p.leg + 0.12, 0, p.leg - 0.02]);   // a leg's only below the body: above, it rings the leg's top
      if (p.fade) foxFade(T, 'destination-in', p.fade);
      L.save(); L.globalCompositeOperation = 'source-atop'; onto(T, L); L.restore();
    }
    const D = p.fade ? foxLayer(2, size, m) : L;                                 // one that's faded in is painted apart first
    D.fillStyle = fur; D.beginPath(); p.path(D); D.fill();
    D.save(); D.beginPath(); p.path(D); D.clip();
    for (const [rgb, a, b, path] of p.marks || []) softFill(D, rgb, 1 - (1 - a) ** 2, b * 0.35, path);   // solid, soft only at the rim
    D.restore();
    if (p.far && look.flat) { D.fillStyle = rockRGB(shade, look.flat); D.beginPath(); p.path(D); D.fill(); }
    else if (p.joined) { const before = joined; joined = before ? g => { before(g); p.path(g); } : p.path; }
    else if (!p.plain) {                                                        // its form (and any joined to it), inside its outline: shade along the underside...
      const before = joined, path = before ? g => { before(g); p.path(g); } : p.path;
      joined = null;
      fresh();
      T.fillStyle = rockRGB(shade, p.far ? 0.55 : 0.32); T.beginPath(); path(T); T.fill();
      T.globalCompositeOperation = 'destination-out';
      softFill(T, [0, 0, 0], 1, 0.09, path, -0.015, -0.05);
      if (p.leg !== undefined) foxFade(T, 'destination-out', [0, p.leg + 0.14, 0, p.leg - 0.04]);   // (a leg's top melts into the body)
      onto(T, D);
      if (!p.far && p.leg === undefined) {                                      // ...and light along the top
        fresh();
        T.fillStyle = rockRGB(light, 0.32); T.beginPath(); path(T); T.fill();
        T.globalCompositeOperation = 'destination-out';
        softFill(T, [0, 0, 0], 1, 0.08, path, 0.01, 0.045);
        onto(T, D);
      }
    }
    if (p.fade) { foxFade(D, 'destination-in', p.fade); onto(D, L); }
  }
  look.face(L);
  L.save(); L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-atop';   // a faint grain of fur
  const r = Math.max(0.7, size / 220);
  let seed = 12345;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (const [ink, thick, long] of look.grain) {
    L.strokeStyle = ink; L.lineWidth = r; L.beginPath();
    for (let i = size * size / 180 * thick; i > 0; i--) { const x = rnd() * size, y = rnd() * size; L.moveTo(x, y); L.lineTo(x + r * long, y + r * long * 0.2); }
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

// ------------------------------------------------------------------ the rabbit
//
// Painted like the fox (paintFur), not the 🐇 emoji: one rig posed for what it's doing (RABBIT_POSES). The big round
// haunch, the long hind foot flat on the ground, short forelegs, a round head with a big dark eye, the long ears, the
// scut. Its coat is painted in its own colours (no reading back): a pale belly, chin and eye ring on the wild and sandy
// ones, black ear tips and a rusty nape on a wild one, and agouti ticking in the grain. In winter it pales by steps:
// only brown and white are painted, the steps between are the two mixed.
// Facing left, box -1 to 1, feet on the ground at 0.72. 'rabbit:' + (look << 4) + pose; look = coat * 5 + white step.
const RABBIT_SCALE = 1.3;            // painted this much bigger, about its feet (so it's the emoji's size)
const RABBIT_CREAM = [240, 230, 210], RABBIT_PINK = [222, 160, 156], RABBIT_SUN = [255, 240, 210];
const RABBIT_EYE = { x: -0.065, y: -0.015, rx: 0.07, ry: 0.078 };   // in the head's space: big and round
const RABBIT_SIT = {
  chest: [-0.2, 0.42], hip: [0.22, 0.38], arch: 0.04, rump: 0.3,   // rump: the haunch's size
  head: [-0.44, 0.1, 0], ear: 0.3, eye: 'open',                    // ear: laid back (+), 0 straight up
  fore: { near: [-0.32, 0.71], far: [-0.24, 0.71] }, foreBend: 1,
  hind: { near: [0.44, 0.68, -0.02, 0.71], far: [0.5, 0.67, 0.04, 0.7] },   // the hock (heel), then the toes
  scut: [0.52, 0.22, 0],                                            // where, and flicked up how far
};
const RABBIT_POSES = {
  sit: RABBIT_SIT,
  hop1: { ...RABBIT_SIT, chest: [-0.22, 0.36], hip: [0.16, 0.3], arch: 0.05, head: [-0.46, 0.06, 0.05], ear: 0.45,   // landed, the hind feet coming through
    fore: { near: [-0.3, 0.71], far: [-0.22, 0.7] }, hind: { near: [0.3, 0.6, -0.02, 0.66], far: [0.36, 0.58, 0.04, 0.64] }, scut: [0.46, 0.18, 0.4] },
  hop2: { ...RABBIT_SIT, chest: [-0.26, 0.32], hip: [0.22, 0.24], head: [-0.54, 0.06, -0.1], ear: 0.7,   // in the air, stretched
    fore: { near: [-0.56, 0.64], far: [-0.48, 0.67] }, hind: { near: [0.46, 0.5, 0.72, 0.62], far: [0.42, 0.52, 0.68, 0.65] }, scut: [0.5, 0.12, 0.6] },
  run1: { ...RABBIT_SIT, chest: [-0.3, 0.3], hip: [0.24, 0.22], head: [-0.6, 0.14, -0.2], ear: 1.15,   // flat out, the ears laid back
    fore: { near: [-0.68, 0.6], far: [-0.6, 0.64] }, hind: { near: [0.52, 0.46, 0.8, 0.54], far: [0.48, 0.48, 0.76, 0.58] }, scut: [0.52, 0.1, 0.9] },
  run2: { ...RABBIT_SIT, chest: [-0.16, 0.36], hip: [0.12, 0.26], arch: 0.07, head: [-0.46, 0.16, -0.15], ear: 1.15,   // and bunched
    fore: { near: [0.0, 0.68], far: [0.06, 0.66] }, hind: { near: [0.06, 0.56, -0.3, 0.64], far: [0.12, 0.54, -0.24, 0.62] }, scut: [0.42, 0.12, 0.9] },
  push: { ...RABBIT_SIT, chest: [-0.26, 0.28], hip: [0.2, 0.34], arch: 0.03, head: [-0.52, -0.02, 0.05], ear: 0.55,   // off the hind feet
    fore: { near: [-0.38, 0.52], far: [-0.31, 0.54] }, hind: { near: [0.44, 0.58, 0.7, 0.71], far: [0.49, 0.57, 0.74, 0.7] }, scut: [0.44, 0.22, 0.5] },
  land: { ...RABBIT_SIT, chest: [-0.24, 0.36], hip: [0.2, 0.24], arch: 0.05, head: [-0.5, 0.14, -0.15], ear: 0.6,   // down on the forefeet
    fore: { near: [-0.46, 0.71], far: [-0.36, 0.7] }, hind: { near: [0.38, 0.46, 0.6, 0.52], far: [0.42, 0.46, 0.64, 0.53] }, scut: [0.46, 0.12, 0.5] },
  rpush: { ...RABBIT_SIT, chest: [-0.3, 0.27], hip: [0.2, 0.32], arch: 0.02, head: [-0.6, 0.06, -0.12], ear: 1.15,
    fore: { near: [-0.46, 0.46], far: [-0.4, 0.5] }, hind: { near: [0.48, 0.56, 0.78, 0.71], far: [0.53, 0.55, 0.82, 0.7] }, scut: [0.44, 0.16, 0.9] },
  rland: { ...RABBIT_SIT, chest: [-0.28, 0.35], hip: [0.22, 0.2], arch: 0.04, head: [-0.58, 0.18, -0.25], ear: 1.15,
    fore: { near: [-0.52, 0.71], far: [-0.4, 0.7] }, hind: { near: [0.42, 0.4, 0.66, 0.46], far: [0.46, 0.41, 0.7, 0.48] }, scut: [0.48, 0.08, 0.9] },
  graze: { ...RABBIT_SIT, chest: [-0.2, 0.46], hip: [0.24, 0.36], head: [-0.48, 0.44, -0.55], ear: 0.75 },
  alarm: { ...RABBIT_SIT, chest: [-0.12, 0.06], hip: [0.14, 0.4], rump: 0.28, head: [-0.24, -0.24, 0.08], ear: -0.08,   // sat up tall
    fore: { near: [-0.24, 0.26], far: [-0.18, 0.28] }, foreBend: -1, hind: { near: [0.38, 0.68, -0.04, 0.71], far: [0.44, 0.67, 0.02, 0.7] }, scut: [0.42, 0.5, 0], top: -0.4 },
  loaf: { ...RABBIT_SIT, chest: [-0.18, 0.5], hip: [0.2, 0.46], rump: 0.27, head: [-0.42, 0.3, 0.05], ear: 1.25,   // lying low, the paws tucked in
    fore: { near: [-0.32, 0.72], far: [-0.26, 0.72] }, hind: { near: [0.4, 0.7, 0.0, 0.72], far: [0.46, 0.7, 0.06, 0.72] }, scut: [0.46, 0.36, 0] },
  sleep: { ...RABBIT_SIT, chest: [-0.18, 0.5], hip: [0.2, 0.46], rump: 0.27, head: [-0.4, 0.36, -0.12], ear: 1.35, eye: 'shut',
    fore: { near: [-0.32, 0.72], far: [-0.26, 0.72] }, hind: { near: [0.4, 0.7, 0.0, 0.72], far: [0.46, 0.7, 0.06, 0.72] }, scut: [0.46, 0.36, 0] },
  dig: { ...RABBIT_SIT, chest: [-0.24, 0.48], hip: [0.2, 0.3], head: [-0.5, 0.46, -0.6], ear: 0.8,   // scrabbling, the rump up
    fore: { near: [-0.52, 0.68], far: [-0.4, 0.6] }, scut: [0.5, 0.14, 0.3] },
  hang: { ...RABBIT_SIT, chest: [-0.02, -0.1], hip: [0.04, 0.32], rump: 0.26, head: [-0.2, -0.34, -0.4], ear: 2.3,   // by the scruff, which is at 0, -0.4
    fore: { near: [-0.16, 0.2], far: [-0.1, 0.22] }, hind: { near: [0.12, 0.6, 0.0, 0.8], far: [0.18, 0.58, 0.06, 0.78] }, scut: [0.2, 0.54, 0.6], top: -0.6 },
};
const RABBIT_POSE_NAMES = Object.keys(RABBIT_POSES), RABBIT_POSE = Object.fromEntries(RABBIT_POSE_NAMES.map((p, i) => [p, i]));
const RABBIT_KINDS = ['wild', 'sand', 'black', 'blue'];            // (BODY_COAT_OF's order)

// The rabbits' coats from the sim, in RABBIT_KINDS' order ({ rgb, speckle }), and the white of winter: game.js hands
// them over once (setCoats), and so does the worker's first message.
let coats = null, winterCoat = null;
const setCoats = (c, w) => { coats = c; winterCoat = w; };
// Its colours, for a coat and how far it's gone white (0 to 1).
function rabbitColours(kind, q) {
  const rgb = coats[kind].rgb.map((v, i) => lerp(v, winterCoat[i], q)), pale = kind < 2;
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  return {
    rgb, speckle: coats[kind].speckle * (1 - q),
    shade: tone(rgb, 0.3), light: mix(rgb, RABBIT_SUN, 0.7),                 // its own colour, darker and lit, so it stays warm
    cream: mix(rgb, RABBIT_CREAM, [0.85, 0.7, 0.14, 0.26][kind]),
    scut: pale ? [248, 245, 238] : mix(rgb, RABBIT_CREAM, 0.3),
    tip: kind === 0 ? [48, 38, 34] : kind === 1 ? tone(rgb, 0.72) : null,    // a wild one keeps its black ear tips in winter, as hares do
    nape: kind === 0 && q < 1 ? mix([178, 108, 58], rgb, q) : null,
    ring: pale ? mix(rgb, RABBIT_CREAM, 0.9) : null,
  };
}

// The rabbit's parts for a pose, back to front (as foxParts).
function rabbitParts(P, C) {
  const parts = [], add = (path, o = {}) => parts.push({ path, ...o });
  const [hdx, hdy, hda] = P.head, hc = Math.cos(hda), hn = Math.sin(hda);
  const onHead = (x, y) => [hdx + x * hc - y * hn, hdy + x * hn + y * hc];
  const inHead = draw => g => { g.save(); g.translate(hdx, hdy); g.rotate(hda); draw(g); g.restore(); };
  const ear = (dx, dy, a, far) => {                  // grown from behind the crown, so the head covers its root
    const at = draw => inHead(g => { g.translate(dx, dy); g.rotate(a); draw(g); });
    const marks = [];
    if (!far) marks.push([RABBIT_PINK, 0.55, 0.03, at(g => { g.moveTo(-0.045, -0.05); g.bezierCurveTo(-0.075, -0.17, -0.055, -0.34, -0.02, -0.42); g.quadraticCurveTo(-0.005, -0.28, 0.0, -0.05); g.closePath(); })]);
    if (C.tip) marks.push([C.tip, 0.9, 0.05, at(g => { g.moveTo(-0.2, -0.41); g.quadraticCurveTo(0, -0.45, 0.2, -0.39); g.lineTo(0.2, -0.6); g.lineTo(-0.2, -0.6); g.closePath(); })]);
    add(at(g => {
      g.moveTo(-0.05, 0.02);
      g.bezierCurveTo(-0.1, -0.15, -0.085, -0.38, -0.025, -0.46);    // the front edge, up to the tip
      g.quadraticCurveTo(0.03, -0.5, 0.06, -0.43);
      g.bezierCurveTo(0.095, -0.32, 0.09, -0.12, 0.065, 0.02);       // and down the back
      g.closePath();
    }), { far, joined: !far, marks });
  };
  const ears = () => { ear(0.1, -0.1, P.ear + 0.14, true); ear(0.04, -0.12, P.ear, false); };   // (the near one's form is the head's)
  const head = () => add(inHead(g => {
    ovalAt(g, 0.02, 0, 0.19, 0.165);                                 // the skull
    ovalAt(g, -0.15, 0.065, 0.13, 0.105, 0.15);                      // the muzzle
    ovalAt(g, 0.04, 0.08, 0.15, 0.12, 0.1);                          // the cheek
  }), { casts: true, marks: [
    [C.cream, 1, 0.05, inHead(g => { g.moveTo(-0.32, 0.1); g.quadraticCurveTo(-0.2, 0.085, -0.08, 0.13); g.quadraticCurveTo(0.08, 0.16, 0.22, 0.12); g.lineTo(0.22, 0.4); g.lineTo(-0.32, 0.4); g.closePath(); })],   // the chin
    [C.cream, 0.7, 0.05, inHead(g => ovalAt(g, -0.2, 0.06, 0.07, 0.045, 0.2))],   // the whisker pad
    ...C.ring ? [[C.ring, 0.6, 0.04, inHead(g => { const { x, y, rx, ry } = RABBIT_EYE; ovalAt(g, x, y, rx + 0.03, ry + 0.021, -0.1); })]] : [],   // round the eye
  ] });
  const [cx, cy] = P.chest, [hx, hy] = P.hip, R = P.rump, len = Math.hypot(hx - cx, hy - cy);
  const ux = (hx - cx) / len, uy = (hy - cy) / len, ang = Math.atan2(uy, ux);   // along the body; (-uy, ux) is down
  const fore = (paw, far) => {
    const sx = cx - 0.04 + (far ? 0.05 : 0), sy = cy + 0.06, [kx, ky] = jointAt(sx, sy, paw[0], paw[1], 0.17, 0.15, P.foreBend);
    add(g => { limbAt(g, sx, sy, 0.07, kx, ky, 0.04); limbAt(g, kx, ky, 0.04, paw[0], paw[1] - 0.02, 0.034); ovalAt(g, paw[0] - 0.025, paw[1] - 0.016, 0.05, 0.026); },
      { far, casts: !far, leg: sy + 0.05, marks: [[C.cream, 0.5, 0.03, g => ovalAt(g, paw[0] - 0.025, paw[1] - 0.016, 0.05, 0.026)]] });
  };
  const hind = ([kx, ky, tx, ty], far) => {
    const ox = hx + (far ? 0.05 : 0), oy = hy;
    add(g => {
      ovalAt(g, ox + 0.02, oy + 0.08, R * 0.68, R * 0.76, -0.5);    // the thigh
      limbAt(g, ox + 0.1, oy + 0.18, 0.12, kx, ky, 0.068);           // down to the hock
      limbAt(g, kx, ky, 0.064, tx, ty - 0.026, 0.04);                // and the long foot
    }, { far, leg: oy + 0.06, marks: [[C.cream, 0.55, 0.03, g => limbAt(g, kx, ky + 0.02, 0.035, tx, ty - 0.005, 0.025)]] });
  };
  const [sx, sy, flick] = P.scut;
  fore(P.fore.far, true); hind(P.hind.far, true);
  add(g => ovalAt(g, sx, sy, 0.1, 0.085, flick), { joined: true, marks: [[C.scut, 1, 0.04, g => ovalAt(g, sx + 0.02 + flick * 0.03, sy + 0.05 - flick * 0.06, 0.085, 0.065 + flick * 0.025)]] });   // the scut, white under
  add(g => {
    ovalAt(g, cx, cy, 0.19, 0.2, ang);
    limbAt(g, cx + ux * 0.04, cy + uy * 0.04, 0.18, hx - ux * 0.04, hy - uy * 0.04, R * 0.92);
    discAt(g, hx, hy, R);
    if (P.arch) discAt(g, (cx + hx) / 2 + uy * P.arch, (cy + hy) / 2 - ux * P.arch, 0.2);
  }, { casts: true, marks: [
    [C.cream, 1, 0.07, g => ovalAt(g, lerp(cx, hx, 0.4) - uy * 0.17, lerp(cy, hy, 0.4) + ux * 0.17, 0.22, 0.06, ang)],   // the belly
    [C.cream, 0.9, 0.06, g => ovalAt(g, cx - ux * 0.1 - uy * 0.08, cy - uy * 0.1 + ux * 0.08, 0.08, 0.11, ang + 0.3)],   // and chest
  ] });
  hind(P.hind.near, false); fore(P.fore.near, false);
  const [ax, ay] = onHead(0.08, 0.06), [wx, wy] = onHead(0.0, 0.14), [nx, ny] = onHead(0.2, -0.02);
  add(g => limbAt(g, cx - 0.02, cy - 0.04, 0.16, ax, ay, 0.13),      // the neck, and its pale throat
    { plain: true, marks: [[C.cream, 0.9, 0.05, g => limbAt(g, wx, wy, 0.07, lerp(wx, cx - 0.14, 0.7), lerp(wy, cy + 0.04, 0.7), 0.06)],
      ...C.nape ? [[C.nape, 0.4, 0.09, g => ovalAt(g, nx, ny, 0.08, 0.1)]] : []] });
  ears(); head();
  return { parts, inHead };
}

function paintRabbit(g, size, U, n) {
  const look = n >> 4, step = look % 5;
  const P = RABBIT_POSES[RABBIT_POSE_NAMES[n & 15]] || RABBIT_SIT, C = rabbitColours(Math.floor(look / 5), step / 4);
  const { parts, inHead } = rabbitParts(P, C), tick = 0.09 * C.speckle;
  const grain = [['rgba(60,40,25,0.02)', 1, 5], ['rgba(255,245,225,0.02)', 1, 5]];
  if (tick) grain.push([`rgba(25,15,8,${tick})`, 1.2, 2.5], [`rgba(255,240,210,${tick})`, 0.9, 2.5]);   // agouti: each hair banded
  paintFur(g, size, U, parts, { coat: C.rgb, scale: RABBIT_SCALE, top: P.top ?? Math.min(P.chest[1], P.hip[1]) - P.rump - 0.05, shade: C.shade, light: C.light, grain, flat: 0.22,
    face: inHead(g => {
      const { x, y, rx, ry } = RABBIT_EYE;
      if (P.eye === 'shut') strokeIn(g, '#3a2a22', 0.03, () => { g.moveTo(x - 0.065, y + 0.005); g.quadraticCurveTo(x, y + 0.05, x + 0.07, y + 0.01); });
      else {                                                                    // dark, a warm brown glow low in it, two catchlights
        const ink = g.createLinearGradient(0, y - ry, 0, y + ry);
        ink.addColorStop(0.3, '#150e0b'); ink.addColorStop(1, '#7a4a28');
        fillIn(g, ink, () => ovalAt(g, x, y, rx, ry, -0.1));
        fillIn(g, 'rgba(255,255,255,0.9)', () => ovalAt(g, x - rx * 0.36, y - ry * 0.4, 0.028, 0.031, -0.4));
        fillIn(g, 'rgba(255,255,255,0.85)', () => discAt(g, x + rx * 0.4, y + ry * 0.45, 0.013));
      }
      fillIn(g, '#8a5a54', () => ovalAt(g, -0.272, 0.038, 0.022, 0.016, 0.3));   // the nose
      strokeIn(g, rockRGB(tone(C.rgb, 0.5), 0.6), 0.014, () => { g.moveTo(-0.268, 0.052); g.quadraticCurveTo(-0.262, 0.085, -0.235, 0.098); });   // the mouth
    }) });
}

// ------------------------------------------------------------------ visitors: dragonflies, a kingfisher, a skylark
//
// Visitors the keeper's places draw in (game.js VISITORS), soft-shaded like the hedgehog and the heron, and painted in
// the worker as the foxes and the rabbits are. Each faces left, its box -1 to 1 the size asked for.

// A dragonfly seen from above, its four wings out to the sides: 'dfly:' + (look << 4) + pose. Look 0 a broad-bodied
// chaser (a broad powder-blue body, yellow spots down its sides, dark at the wings' roots), 1 a common darter (slim and
// red). Pose 0 and 1 the wings swept forward and back (in flight it beats between them), 2 settled, the wings still.
const DRAGON_LOOKS = [
  { body: [128, 172, 214], side: [228, 200, 86], thorax: [106, 94, 64], eye: [64, 100, 118], root: [62, 42, 26], slim: 1 },
  { body: [198, 66, 42], side: null, thorax: [142, 84, 50], eye: [146, 68, 48], root: [190, 130, 46], slim: 0.6 },
];
function dragonWing(g, x, y, len, wid, a, look, alpha) {
  g.save(); g.translate(x, y); g.rotate(a);
  const shape = () => { g.moveTo(0, 0); g.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 0.8, len, -wid * 0.1); g.bezierCurveTo(len * 0.9, wid * 0.5, len * 0.3, wid * 0.6, 0, 0); };
  fillIn(g, `rgba(234, 242, 250, ${alpha})`, shape);
  strokeIn(g, `rgba(80, 92, 104, ${alpha})`, 0.014, shape);
  strokeIn(g, `rgba(80, 92, 104, ${alpha * 0.6})`, 0.009, () => { g.moveTo(0.02, 0); g.quadraticCurveTo(len * 0.5, -wid * 0.35, len * 0.96, -wid * 0.12); });
  fillIn(g, rockRGB(look.root, alpha * 1.3), () => ovalAt(g, len * 0.12, 0, len * 0.13, wid * 0.34));
  fillIn(g, `rgba(44, 32, 26, ${Math.min(1, alpha * 1.6)})`, () => ovalAt(g, len * 0.84, -wid * 0.2, len * 0.05, wid * 0.13));   // the spot near its tip
  g.restore();
}
function paintDragonfly(g, size, U, n) {
  const look = DRAGON_LOOKS[(n >> 4) % DRAGON_LOOKS.length], pose = n & 15, still = pose === 2;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const b = still ? 0 : pose === 0 ? 0.2 : -0.16, alpha = still ? 0.6 : 0.45, h = Math.PI / 2;
  for (const side of [-1, 1]) {                               // the far pair (up the picture, a little shorter), then the near
    const k = side < 0 ? 0.84 : 1;
    dragonWing(g, -0.3, 0, 0.8 * k, 0.17, side * (h + 0.14 + b), look, alpha);          // the forewing, swept forward
    dragonWing(g, -0.2, 0, 0.76 * k, 0.22, side * (h - 0.26 + b * 0.7), look, alpha);   // the hindwing, back
  }
  const w = 0.1 * look.slim;
  softIn(g, look.body, -w, w, () => {                       // its long body, tapering to the tip
    g.moveTo(-0.26, -w * 0.8); g.quadraticCurveTo(0.1, -w * 1.2, 0.5, -w * 0.72); g.lineTo(0.86, -w * 0.28);
    g.quadraticCurveTo(0.9, 0, 0.86, w * 0.28); g.lineTo(0.5, w * 0.72); g.quadraticCurveTo(0.1, w * 1.2, -0.26, w * 0.8); g.closePath();
  }, 1.25, 0.66);
  for (const x of [0.02, 0.18, 0.34, 0.5, 0.65]) strokeIn(g, rockRGB(tone(look.body, 0.5), 0.6), 0.014, () => { g.moveTo(x, -w * 0.95); g.lineTo(x, w * 0.95); });
  if (look.side) for (const x of [0.1, 0.26, 0.42]) fillIn(g, rockRGB(look.side, 0.9), () => { ovalAt(g, x, -w * 0.72, 0.05, w * 0.2); ovalAt(g, x, w * 0.72, 0.05, w * 0.2); });
  softIn(g, look.thorax, -0.12, 0.12, () => ovalAt(g, -0.37, 0, 0.15, 0.115), 1.25, 0.68);
  furGlow(g, [255, 255, 255], 0.3, -0.4, -0.04, 0.08, 0.04);
  softIn(g, look.eye, -0.15, 0.15, () => { discAt(g, -0.58, -0.07, 0.08); discAt(g, -0.58, 0.07, 0.08); }, 1.3, 0.7);   // the eyes, meeting on top
  fillIn(g, 'rgba(255,255,255,0.75)', () => { discAt(g, -0.61, -0.1, 0.022); discAt(g, -0.61, 0.045, 0.022); });
}

// A kingfisher, side on: brilliant blue-green above with a turquoise streak down its back, orange below, a white throat
// and a white patch on its neck, an orange cheek, a long black dagger of a bill, tiny red feet. 'kfisher:' + pose:
// 0 perched upright on a twig, 1 perched peering down into the water, 2 diving headlong, 3 and 4 flying (the wings up and
// down: in flight it whirrs between them), 5 perched with a fish across its bill, 6 asleep on its twig, fluffed up.
// Its feet (on the twig) are at 0.42; it turns about them, so a perched pose sits on its twig whatever its tilt.
const KF_BLUE = [36, 128, 178], KF_BACK = [70, 204, 220], KF_ORANGE = [224, 116, 42], KF_PALE = [246, 240, 226], KF_INK = [26, 24, 26];
const KF_POSES = [                                         // tilt: up at the front (+), look: the head down (-)
  { tilt: 0.5, look: -0.32, twig: true }, { tilt: 0.3, look: -0.8, twig: true }, { tilt: -1.15, look: 0, dive: true },
  { tilt: 0.05, look: 0, wing: -1 }, { tilt: 0.05, look: 0, wing: 1 }, { tilt: 0.5, look: -0.32, twig: true, fish: true },
  { tilt: 0.2, look: -0.1, twig: true, sleep: true },
];
function kfWing(g, up) {                                    // a wing spread, from the shoulder, up or down: blue, darker to the tip
  softIn(g, KF_BLUE, up ? -0.7 : -0.05, up ? 0.05 : 0.6, () => {
    g.moveTo(-0.12, -0.04);
    if (up) { g.quadraticCurveTo(-0.08, -0.5, 0.18, -0.66); g.quadraticCurveTo(0.22, -0.3, 0.26, -0.02); }
    else { g.quadraticCurveTo(-0.06, 0.36, 0.2, 0.52); g.quadraticCurveTo(0.24, 0.24, 0.26, 0.06); }
    g.closePath();
  }, 1.15, 0.6);
}
function paintKingfisher(g, size, U, n) {
  const P = KF_POSES[n] || KF_POSES[0];
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  if (P.twig) {                                             // the twig it sits on, level whatever its tilt
    strokeIn(g, rockRGB([96, 72, 50]), 0.07, () => { g.moveTo(-0.62, 0.47); g.quadraticCurveTo(0, 0.42, 0.66, 0.46); });
    strokeIn(g, rockRGB([96, 72, 50]), 0.04, () => { g.moveTo(0.3, 0.44); g.quadraticCurveTo(0.42, 0.34, 0.5, 0.28); });
    strokeIn(g, rockRGB([150, 120, 88], 0.6), 0.02, () => { g.moveTo(-0.6, 0.45); g.quadraticCurveTo(0, 0.4, 0.64, 0.44); });
  }
  const fx = 0, fy = P.twig ? 0.42 : 0.1;                   // about its feet on the twig, or its middle in the air
  g.translate(fx, fy); g.rotate(P.tilt); g.translate(-fx, -fy);
  if (P.wing === -1) kfWing(g, true);                       // the far wing, up behind it
  const by = P.twig ? 0.18 : -0.12, fluff = P.sleep ? 1.18 : 1;
  softIn(g, KF_BLUE, by - 0.04, by + 0.12, () => { g.moveTo(0.3, by - 0.02); g.lineTo(0.72, by + 0.06); g.lineTo(0.7, by + 0.13); g.lineTo(0.3, by + 0.1); g.closePath(); }, 1.1, 0.6);   // the short tail
  const body = () => ovalAt(g, 0.04, by, 0.36 * fluff, 0.2 * fluff, 0.06);
  softIn(g, KF_ORANGE, by - 0.2, by + 0.22, body, 1.15, 0.7);
  g.save(); g.beginPath(); body(); g.clip();
  softIn(g, KF_BLUE, by - 0.24, by + 0.04, () => ovalAt(g, 0.08, by - 0.1, 0.42 * fluff, 0.15 * fluff, 0.06), 1.2, 0.7);   // blue above
  g.restore();
  if (!P.wing) {                                            // the folded wing, scaled with paler spots, and the bright streak down its back
    softIn(g, KF_BLUE, by - 0.16, by + 0.08, () => ovalAt(g, 0.14, by - 0.04, 0.26 * fluff, 0.12 * fluff, 0.12), 1.2, 0.62);
    for (const [x, y] of [[0.02, -0.08], [0.1, -0.07], [0.06, -0.02], [0.16, -0.03]]) fillIn(g, rockRGB(KF_BACK, 0.7), () => discAt(g, x, by + y, 0.016));
    strokeIn(g, rockRGB(KF_BACK), P.dive ? 0.035 : 0.045, () => { g.moveTo(-0.1, by - 0.15 * fluff); g.quadraticCurveTo(0.14, by - 0.2 * fluff, 0.36, by - 0.06); });
  }
  // The head, big for it: a blue cap, the orange cheek, the white throat and neck patch, a black eye; the long bill.
  const hx = P.sleep ? -0.22 : -0.28, hy = by - (P.sleep ? 0.06 : 0.12);
  g.save(); g.translate(hx, hy); g.rotate(P.look);
  if (!P.sleep) {
    fillIn(g, rockRGB(KF_INK), () => { g.moveTo(-0.12, -0.02); g.quadraticCurveTo(-0.38, -0.01, -0.6, 0.04); g.quadraticCurveTo(-0.38, 0.05, -0.12, 0.06); g.closePath(); });
    strokeIn(g, rockRGB([90, 80, 76], 0.7), 0.01, () => { g.moveTo(-0.14, 0.02); g.lineTo(-0.52, 0.035); });
  } else fillIn(g, rockRGB(KF_INK), () => { g.moveTo(-0.12, 0.0); g.lineTo(-0.3, 0.05); g.lineTo(-0.12, 0.07); g.closePath(); });   // tucked in
  softIn(g, KF_BLUE, -0.17, 0.15, () => discAt(g, 0, 0, 0.16), 1.25, 0.7);
  g.save(); g.beginPath(); discAt(g, 0, 0, 0.16); g.clip();
  fillIn(g, rockRGB(KF_ORANGE), () => ovalAt(g, -0.01, 0.03, 0.12, 0.05, -0.15));      // the cheek, through the eye
  fillIn(g, rockRGB(KF_PALE), () => ovalAt(g, -0.08, 0.14, 0.1, 0.06));                 // the throat
  fillIn(g, rockRGB(KF_PALE), () => ovalAt(g, 0.12, 0.06, 0.05, 0.035, 0.4));           // the patch on its neck
  g.restore();
  for (const x of [-0.08, -0.02, 0.04]) fillIn(g, rockRGB(KF_BACK, 0.6), () => discAt(g, x, -0.1, 0.014));   // its barred cap
  if (P.sleep) strokeIn(g, rockRGB(KF_INK), 0.022, () => { g.moveTo(-0.08, 0.0); g.quadraticCurveTo(-0.05, 0.02, -0.02, 0.0); });
  else { fillIn(g, rockRGB(KF_INK), () => discAt(g, -0.05, 0.0, 0.032)); fillIn(g, 'rgba(255,255,255,0.85)', () => discAt(g, -0.06, -0.012, 0.011)); }
  if (P.fish) {                                            // a little fish crosswise in its bill
    g.save(); g.translate(-0.46, 0.04); g.rotate(1.35);
    softIn(g, [192, 202, 204], -0.04, 0.04, () => { g.moveTo(-0.13, 0); g.quadraticCurveTo(0, -0.055, 0.1, 0); g.quadraticCurveTo(0, 0.055, -0.13, 0); }, 1.25, 0.65);
    fillIn(g, rockRGB([150, 160, 160]), () => { g.moveTo(0.08, 0); g.lineTo(0.17, -0.04); g.lineTo(0.16, 0.04); g.closePath(); });
    g.restore();
  }
  g.restore();
  if (P.wing === 1) kfWing(g, false);                       // the near wing, down
  else if (P.wing === -1) kfWing(g, true);
  if (P.dive) strokeIn(g, rockRGB(KF_BLUE), 0.09, () => { g.moveTo(0.02, by - 0.04); g.quadraticCurveTo(0.24, by - 0.02, 0.42, by + 0.05); });   // the wings swept back tight
  if (P.twig) fillIn(g, rockRGB([212, 84, 62]), () => { ovalAt(g, -0.02, 0.4, 0.035, 0.02); ovalAt(g, 0.06, 0.41, 0.035, 0.02); });   // its feet
  furGlow(g, [255, 255, 255], 0.18, 0.02, by - 0.12, 0.2, 0.06, 0.06);
}

// A skylark, side on: streaky brown above, buff below with a streaked breast, a pale stripe over its eye, a short crest,
// a stout little bill, white edges to its tail. 'lark:' + pose: 0 and 1 the two steps of a walk, 2 pecking, 3 singing on
// the ground (crest up, bill open), 4 and 5 singing in the air (the wings up and down: it flutters between them, hanging
// high over its strip), 6 asleep, crouched in the grass. Feet on the ground at 0.72.
const LARK_BACK = [150, 114, 74], LARK_DARK = [78, 58, 38], LARK_PALE = [236, 222, 192], LARK_BILL = [120, 98, 76], LARK_LEG = [206, 166, 134];
function larkStreaks(g, x0, y0, x1, y1, n, seed, len, a = 0.4) {
  for (let k = 0; k < n; k++) {
    seed = seed * 16807 % 2147483647; const u = seed / 2147483647;
    seed = seed * 16807 % 2147483647; const v = seed / 2147483647;
    const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * v;
    strokeIn(g, rockRGB(LARK_DARK, 0.75), 0.018, () => { g.moveTo(x, y); g.lineTo(x + len, y + len * a); });
  }
}
function paintSkylark(g, size, U, n) {
  const pose = n, fly = pose === 4 || pose === 5, peck = pose === 2, sing = pose === 3, sleep = pose === 6;
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  const by = fly ? 0.1 : sleep ? 0.5 : 0.4, tilt = fly ? 0.35 : peck ? -0.15 : 0;   // (up at the front: +)
  g.save(); g.translate(0, by); g.rotate(tilt); g.translate(0, -by);
  if (fly) {                                                // the far wing, and the tail fanned, its white edges showing
    softIn(g, LARK_BACK, -0.6, 0.1, () => { g.moveTo(-0.1, by - 0.06); g.quadraticCurveTo(-0.02, by - (pose === 4 ? 0.62 : -0.5), 0.3, by - (pose === 4 ? 0.7 : -0.56)); g.quadraticCurveTo(0.26, by - 0.2, 0.22, by); g.closePath(); }, 1.1, 0.7);
    fillIn(g, rockRGB(LARK_PALE), () => { g.moveTo(0.3, by); g.lineTo(0.68, by - 0.1); g.lineTo(0.7, by + 0.1); g.closePath(); });
  } else {
    strokeIn(g, rockRGB(LARK_LEG), 0.03, () => {             // its legs, a step apart or together
      const s = pose === 0 ? 0.08 : pose === 1 ? -0.02 : 0.03;
      if (!sleep) { g.moveTo(-0.02, by + 0.12); g.lineTo(-0.02 - s, 0.72); g.moveTo(0.06, by + 0.12); g.lineTo(0.06 + s, 0.72); }
    });
  }
  softIn(g, LARK_BACK, by - 0.08, by + 0.06, () => { g.moveTo(0.26, by - 0.06); g.lineTo(0.66, by - (fly ? 0.04 : 0.12)); g.lineTo(0.68, by - (fly ? -0.06 : 0.02)); g.lineTo(0.26, by + 0.06); g.closePath(); }, 1.1, 0.65);
  fillIn(g, rockRGB(LARK_PALE, 0.9), () => { g.moveTo(0.32, by + 0.04); g.lineTo(0.68, by - (fly ? -0.06 : 0.02)); g.lineTo(0.66, by + (fly ? 0.0 : -0.04)); g.closePath(); });   // the white edge of its tail
  const body = () => ovalAt(g, 0.02, by, sleep ? 0.38 : 0.34, sleep ? 0.2 : 0.18, -0.06);
  softIn(g, LARK_PALE, by - 0.18, by + 0.2, body, 1.08, 0.78);
  g.save(); g.beginPath(); body(); g.clip();
  softIn(g, LARK_BACK, by - 0.24, by + 0.04, () => ovalAt(g, 0.06, by - 0.08, 0.4, 0.15, -0.06), 1.2, 0.72);   // brown above
  larkStreaks(g, -0.24, by - 0.2, 0.32, by - 0.04, 14, 7, 0.08);
  larkStreaks(g, -0.3, by - 0.02, -0.08, by + 0.12, 7, 11, 0.04, 1.4);                    // its streaked breast
  g.restore();
  if (!fly) {                                               // the folded wing, its feathers edged pale
    softIn(g, LARK_BACK, by - 0.12, by + 0.08, () => ovalAt(g, 0.1, by - 0.02, 0.24, 0.1, -0.08), 1.2, 0.66);
    strokeIn(g, rockRGB(LARK_PALE, 0.7), 0.014, () => { for (const x of [0.0, 0.1, 0.2]) { g.moveTo(x, by - 0.07); g.quadraticCurveTo(x + 0.06, by + 0.0, x + 0.08, by + 0.07); } });
  }
  // The head: brown with a pale stripe over the eye and a short crest; a stout bill.
  const hx = peck ? -0.36 : sleep ? -0.24 : -0.3, hy = by - (peck ? -0.08 : sleep ? 0.04 : 0.15) - (sing ? 0.05 : 0);
  g.save(); g.translate(hx, hy); g.rotate(sing ? -0.45 : peck ? 0.5 : 0);
  if (!sleep) {
    fillIn(g, rockRGB(LARK_BILL), () => { g.moveTo(-0.08, -0.03); g.lineTo(-0.22, sing ? -0.03 : 0.0); g.lineTo(-0.08, 0.02); g.closePath(); });
    if (sing) fillIn(g, rockRGB(LARK_BILL), () => { g.moveTo(-0.08, 0.02); g.lineTo(-0.2, 0.06); g.lineTo(-0.08, 0.04); g.closePath(); });   // its bill open in song
  }
  softIn(g, LARK_BACK, -0.13, 0.12, () => discAt(g, 0, 0, 0.12), 1.2, 0.72);
  g.save(); g.beginPath(); discAt(g, 0, 0, 0.12); g.clip();
  fillIn(g, rockRGB(LARK_PALE), () => ovalAt(g, -0.03, 0.08, 0.1, 0.05));             // its pale chin
  strokeIn(g, rockRGB(LARK_PALE, 0.9), 0.026, () => { g.moveTo(-0.09, -0.04); g.quadraticCurveTo(0.0, -0.06, 0.08, -0.02); });   // the stripe over its eye
  larkStreaks(g, -0.06, -0.11, 0.08, -0.06, 4, 3, 0.04);
  g.restore();
  softIn(g, LARK_BACK, -0.2, -0.06, () => { g.moveTo(0.02, -0.1); g.lineTo(0.13, sing ? -0.24 : -0.17); g.lineTo(0.1, -0.06); g.closePath(); }, 1.1, 0.7);   // the crest
  if (sleep) strokeIn(g, rockRGB(LARK_DARK), 0.02, () => { g.moveTo(-0.06, 0.0); g.quadraticCurveTo(-0.03, 0.02, 0.0, 0.0); });
  else { fillIn(g, '#1c1612', () => discAt(g, -0.04, 0.0, 0.026)); fillIn(g, 'rgba(255,255,255,0.8)', () => discAt(g, -0.048, -0.01, 0.009)); }
  g.restore();
  if (fly) softIn(g, LARK_BACK, -0.1, 0.6, () => {          // the near wing, its trailing edge white
    g.moveTo(-0.14, by - 0.02); g.quadraticCurveTo(-0.08, by + (pose === 4 ? -0.6 : 0.52), 0.24, by + (pose === 4 ? -0.66 : 0.6)); g.quadraticCurveTo(0.22, by + 0.2, 0.2, by + 0.04); g.closePath();
  }, 1.15, 0.66);
  if (fly) strokeIn(g, rockRGB(LARK_PALE, 0.85), 0.03, () => { g.moveTo(0.24, by + (pose === 4 ? -0.64 : 0.58)); g.quadraticCurveTo(0.22, by + (pose === 4 ? -0.24 : 0.22), 0.2, by + 0.04); });
  g.restore();
  furGlow(g, [255, 246, 222], 0.2, 0.0, by - 0.12, 0.22, 0.07);
}

// ------------------------------------------------------------------ the forager
//
// The player: a little hooded forager, painted as the fox and the rabbit are (paintFur: one shading over it all, each
// part's form soft, a part in front casting a soft shadow, a soft outline and a faint grain, here of cloth). A rust hood
// with a point that flops behind, a round face with rosy cheeks and a fringe of hair, a moss-green cloak, knitted mittens,
// a leather satchel on a strap, short legs in brown boots. Three views (FORAGER_VIEWS): side on, three-quarters from the
// front and from the back, each facing left (game.js mirrors it for the right). Poses: 0 standing, 1 a fidget (looking
// up, a hand on the strap), 2 a blink, 3 and 4 picking (stooping, then reaching down with both hands: STOOP), 5 cold (hugging
// itself, its head sunk, the brows up in the middle and a frown, its nose red), 6 its blink, 7 down in the cold (the same, eyes
// shut), 24 to 31 the walk hugging itself (FORAGER_COLD), 8 to 15 a stride of the walk in eighths: each foot on the ground slides back
// FORAGER_REACH either side of the hips through half the stride, so game.js turns the stride over with the ground covered
// (2 * FORAGER_REACH * 2 of its half-size a stride) and the feet don't slide. 16 to 23 a stride of the jog, for the
// sprint: FORAGER_JOG_STRIDE times as long, each foot down only JOG_DOWN of it, so there's a moment with both off the
// ground; the heel kicks up behind, the arms bend and pump, it leans in and bobs more. Three outfits the player picks
// from (FORAGER_OUTFITS: the cloak, the hood and its rim). Out in the snow it gathers some (FORAGER_SNOWS: none, a
// dusting, covered) on the hood, the shoulders, the hood's point and the satchel's flap.
// At a fire it kneels, side on (view 3, KNEEL_VIEW: poses 16 to 22, FORAGER_KNEEL): down on its near knee, the far one up
// and the cloak spread on the ground about it; resting, reaching down to lay a stone or a stick, striking its flint and
// steel (up, then down), blowing on the spark (bent right down, cheeks puffed and lips pursed, then a breath in), and
// holding its mittens out to the flames, eyes shut and smiling.
// 'forager:' + snow * FORAGER_SNOW_ARTS + (outfit << 7) + (view << 5) + pose; the emotes after all those (emoteArt).
// Box -1 to 1, feet on the ground at 0.72.
const FORAGER_REACH = 0.18, FORAGER_LIFT = 0.075, FORAGER_BOB = 0.016;
const STOOP = [0, 0, 0, 0.55, 1];       // how far down it's bent, picking (poses 3 and 4)
const FORAGER_COLD = [5, 6, 7, 24, 25, 26, 27, 28, 29, 30, 31];   // (the cold poses; game.js asks for them only once it's chilly)
const FORAGER_JOG_STRIDE = 1.75, JOG_DOWN = 0.32, JOG_LIFT = 0.13, JOG_BOB = 0.03, JOG_LEAN = 0.08;
const JOG_REACH = 2 * FORAGER_REACH * FORAGER_JOG_STRIDE * JOG_DOWN;   // (the planted foot keeps pace with the ground)
const FORAGER_VIEWS = ['side', 'front', 'back', 'kneel'];
// Kneeling at a fire (view 3): the pose, and how it's held: how far it's bent over (stoop), how far forward each arm
// reaches (far, near: 0 hanging, 1.57 straight out), the head's lift (look), and the face (blow, warm).
const KNEEL_VIEW = 3;
const FORAGER_KNEEL = { rest: 16, lay: 17, strikeUp: 18, strikeDown: 19, blow: 20, breathe: 21, warm: 22, sit: 23, sitWarm: 24 };
const KNEELS = [
  { stoop: 0.3, lean: 0.02, far: 0.55, near: 0.7, look: 0 },              // resting, a mitten on its knee
  { stoop: 1, lean: 0.09, far: 1.0, near: 1.1, look: 0.02 },              // reaching down in front, laying a stone or a stick
  { stoop: 0.55, lean: 0.04, far: 1.45, near: 1.55, look: 0.01 },         // the flint and steel up, before its chest
  { stoop: 0.8, lean: 0.07, far: 0.95, near: 1.05, look: 0.025 },         // struck down, over the tinder
  { stoop: 1.35, lean: 0.13, far: 0.7, near: 0.8, look: 0.03, blow: 1 },  // blowing: right down, its mittens cupped round the spark
  { stoop: 1.15, lean: 0.1, far: 0.7, near: 0.8, look: 0.01 },            // a breath in between
  { stoop: 0.3, lean: 0, far: 1.35, near: 1.48, look: -0.02, warm: 1 },   // mittens out to the flames
];
function kneelPose(pose) {
  if (pose >= FORAGER_SIT_EAT.bite) return sitEatPose(pose);
  if (pose >= FORAGER_KNEEL.sit) return sitPose(pose === FORAGER_KNEEL.sitWarm);
  const k = KNEELS[pose - 16] || KNEELS[0];
  return {
    view: 0, kneel: true, walk: false, jog: false, u: 0, fwd: [-1, 0], stoop: k.stoop, swing: 0,
    feet: [[0.25, 0.715], [-0.19, 0.72]],                          // the near foot back, toe down; the far one planted ahead
    knees: [[0.02, 0.69], [-0.17, 0.49 + 0.02 * k.stoop]],         // the near knee on the ground, the far one up
    bob: 0.19 + 0.02 * k.stoop, lean: k.lean, bend: 0, tip: 0.05 + 0.03 * k.stoop, sway: -0.02,
    arms: [k.far, k.near], look: k.look, tilt: 0, hand: false, blink: !!k.warm, hug: false, sad: false, blow: !!k.blow, warm: !!k.warm,
    turn: 0, hands: null, happy: false, yawn: false, flap: 0,
  };
}
// Sitting on the camp's seat log (game.js sitFrame), facing you (poses 23 and 24 of view 3): its hips down by the log's top,
// the cloak spread over the log and draped over its knees (P.sit), the knees peeping out toward you under it, the shins
// hanging down in front of the log, the boots dangling with their toes to you; the elbows bent and its mittens together in
// its lap; by a lit fire, eyes shut and smiling. game.js lifts the painting onto the log (seatLift: its hips SIT_HIPS over
// its feet's line). (The arms are short: a mitten held further than about 0.25 from its shoulder stretches them.)
function sitPose(warm) {
  const P = foragerPose(1, 0);
  P.sit = true; P.bob = 0.14; P.tip = 0.04;
  P.knees = [[-0.09, 0.625], [0.09, 0.63]];
  P.feet = [[-0.1, 0.785], [0.105, 0.77]];   // (dangling, one a little swung up)
  P.hands = [[0.1, 0.235, -0.015, 0.13], [-0.1, 0.235, 0.015, 0.13]];   // (mitten, elbow: each from its shoulder)
  if (warm) { P.warm = true; P.blink = true; }
  return P;
}
// An outfit is a cloak (with its hood's colours) and a hat (foragerParts: hat), picked apart (game.js wardrobe) and painted
// as one: outfit = hat * FORAGER_CLOAKS.length + cloak (outfitOf), so the first few are the pointed hood in each cloak. A
// new cloak or hat goes at the end of its list (the player's are kept apart in localStorage, by their place in it).
const FORAGER_CLOAKS = [
  { name: 'Moss', cloak: [100, 124, 68], hood: [178, 88, 52], rim: [140, 62, 38] },     // moss green, a rust hood
  { name: 'Plum', cloak: [124, 72, 98], hood: [214, 162, 66], rim: [168, 120, 44] },    // plum, a mustard hood
  { name: 'Lake', cloak: [70, 104, 140], hood: [190, 66, 70], rim: [144, 46, 52] },     // lake blue, a berry hood
  { name: 'Honey', cloak: [178, 128, 58], hood: [96, 118, 70], rim: [70, 90, 50] },     // honey, a moss hood
  { name: 'Ash', cloak: [112, 108, 104], hood: [226, 214, 190], rim: [176, 160, 132] }, // ash grey, an oatmeal hood
];
const FORAGER_HATS = [
  { name: 'Hood', id: 'hood' },                  // the hood's own point, flopping behind
  { name: 'Bobble', id: 'bobble' },              // a woolly pompom on top
  { name: 'Fox ears', id: 'ears' },              // two pointed ears on the hood, dark at the tips
  { name: 'Toadstool', id: 'toadstool' },        // a red cap, white-spotted
  { name: 'Wanderer', id: 'wanderer' },          // a wide felt hat with a feather in its band
  { name: 'Flowers', id: 'flowers' },            // a crown of little blossoms
  { name: 'Melted cheese', id: 'cheese' },       // a golden cap slumped over the hood, its drips running down the sides
];
const FORAGER_OUTFITS = FORAGER_HATS.flatMap(h => FORAGER_CLOAKS.map(c => ({ ...c, hat: h.id, name: c.name + ', ' + h.name })));
const outfitOf = (cloak, hat) => hat * FORAGER_CLOAKS.length + cloak;
const FORAGER_SNOWS = 3, FORAGER_SNOW_ARTS = FORAGER_OUTFITS.length << 7;   // (how much snow, and the paintings to each: every outfit's 128)
const SNOW_ON = [246, 248, 252];
let SNOWED = 0;                                  // the snow being painted (paintForager), 0 to 2
let CLOAK, HOOD, HOOD_RIM, HAT;                  // the outfit being painted (paintForager: wear)
const wear = o => { ({ cloak: CLOAK, hood: HOOD, rim: HOOD_RIM, hat: HAT } = FORAGER_OUTFITS[o] || FORAGER_OUTFITS[0]); };
wear(0);
const SKIN = [246, 210, 180], CHEEK = [236, 136, 116], COLD_NOSE = [236, 158, 138];
const HAIR = [118, 74, 44], TROUSER = [116, 94, 76], BOOT = [76, 54, 42], SATCHEL = [150, 100, 58], FLAP = [126, 82, 46], STRAP = [112, 74, 44];
const MITTEN = [224, 204, 166];
const FORAGER_SHADE = [34, 30, 26], FORAGER_LIGHT = [255, 240, 214];
const smoothstep = t => t * t * (3 - 2 * t);

// Where things are in a pose: the feet (x, y, and which is in front), the hips' bob, the arms' swing, the hood's point.
// short: the step's length against its own (carrying a dish, CARRY_STRIDE).
function foragerPose(view, pose, short = 1) {
  if (view === KNEEL_VIEW) return kneelPose(pose);
  const walk = pose >= 8, jog = pose >= 16 && pose < 24, cold = pose >= 24 || pose >= 5 && pose <= 7, u = walk ? (pose & 7) / 8 : 0;
  const down = jog ? JOG_DOWN : 0.5, reach = (jog ? JOG_REACH : FORAGER_REACH) * short;
  // A foot: how far ahead of the hips it is (+: forward) and how high off the ground, at phase v of the stride.
  // (Jogging, it's highest early in the swing: the heel kicks up behind before the knee brings it through.)
  const foot = v => {
    v = ((v % 1) + 1) % 1;
    if (!walk) return [0, 0];
    if (v < down) return [reach - 2 * reach * v / down, 0];
    const s = (v - down) / (1 - down);
    return [-reach + 2 * reach * smoothstep(s), (jog ? JOG_LIFT * Math.sin(Math.PI * s ** 0.7) : FORAGER_LIFT * Math.sin(Math.PI * s)) * short];
  };
  const fwd = view === 0 ? [-1, 0] : view === 1 ? [-0.62, 0.4] : [-0.62, -0.4];   // forward, on the picture
  const base = view === 0 ? [[-0.035, 0.72], [0.045, 0.72]] : view === 1 ? [[-0.1, 0.71], [0.07, 0.735]] : [[-0.09, 0.735], [0.08, 0.71]];
  const feet = [0, 0.5].map((off, i) => {
    const [a, up] = foot(u + off);
    return [base[i][0] + fwd[0] * a, base[i][1] + fwd[1] * a - up];
  });
  const stoop = walk || jog ? 0 : STOOP[pose] || 0;                // (picking: knees bent, the head and the hands forward and down)
  // (Walking it's lowest with the feet apart; jogging, as the planted foot passes under it, and highest in the air.)
  const bob = jog ? JOG_BOB * Math.cos(4 * Math.PI * (u - down / 2)) : walk ? FORAGER_BOB * Math.cos(4 * Math.PI * u) : 0.16 * stoop;
  const swing = (jog ? 0.6 : walk && !cold ? 0.42 : 0) * Math.cos(2 * Math.PI * u);   // the near arm back as the near foot is ahead
  return {
    view, walk, jog, u, feet, bob, swing, fwd, stoop,
    lean: jog ? JOG_LEAN : 0, bend: jog ? 1.1 : 0,                 // jogging, it leans in and its elbows bend
    tip: jog ? 0.09 * Math.cos(4 * Math.PI * u + 1.6) + 0.04 : walk ? 0.05 * Math.cos(4 * Math.PI * u + 1.2) : 0,   // the hood's point flops with the step
    sway: jog ? 0.03 * Math.sin(2 * Math.PI * u) - 0.035 * fwd[0] : walk ? 0.018 * Math.sin(2 * Math.PI * u) : 0,   // and the cloak's hem swings (and trails)
    look: pose === 1 ? -0.07 : cold ? 0.025 : 0, tilt: pose === 1 ? 0.12 : 0, hand: pose === 1, blink: pose === 2 || pose === 6 || pose === 7,
    hug: cold, sad: cold,                                          // cold: its arms round itself, the head sunk into its shoulders
    turn: 0, hands: null, happy: false, yawn: false, flap: 0,     // (standing a while: idlePose)
  };
}
// Standing a while, now and then it does something (game.js IDLES), painted from the front only: 'view' 3 of the key.
// It glances to either side, stretches (arms out, then up with a yawn, its body up off its heels), hums with its eyes
// shut happy, peeks into its satchel with the flap up, taps a foot, waves at you. hands: where each mitten goes, from
// its shoulder (null: hanging); turn: the face round in the hood, -1 to your left, 1 to your right.
const FORAGER_IDLE = { lookL: 0, lookR: 1, reach: 2, stretch: 3, hum: 4, peek: 5, tap: 6, waveA: 7, waveB: 8 };
const FORAGER_IDLES = Object.values(FORAGER_IDLE);
function idlePose(i) {
  const P = foragerPose(1, 0), I = FORAGER_IDLE;
  if (i === I.lookL || i === I.lookR) { P.turn = i === I.lookL ? -1 : 1; P.tip = 0.03 * P.turn; }
  else if (i === I.reach) { P.hands = [[-0.17, -0.07], [0.17, -0.07]]; P.bob = -0.01; P.blink = true; }
  else if (i === I.stretch) { P.hands = [[-0.16, -0.25], [0.16, -0.25]]; P.bob = -0.03; P.look = -0.03; P.blink = true; P.yawn = true; P.tip = 0.05; }
  else if (i === I.hum) { P.happy = true; P.tip = 0.02; }
  else if (i === I.peek) { P.turn = 0.7; P.look = 0.045; P.hands = [null, [0.04, 0.17]]; P.flap = 0.045; }
  else if (i === I.tap) { P.feet[1][1] -= 0.065; P.feet[1][0] -= 0.015; P.bob = -0.01; }
  else if (i === I.waveA || i === I.waveB) { P.happy = true; P.hands = [null, i === I.waveA ? [0.25, -0.15] : [0.19, -0.26]]; }
  else if (i === FORAGER_EAT.bite) { P.hands = [EAT_HOLD, [-0.19, -0.1, 0.03, 0.11]]; P.eat = 1; P.look = 0.03; P.tip = 0.02; }
  else if (i === FORAGER_EAT.chewA || i === FORAGER_EAT.chewB) {
    P.hands = [EAT_HOLD, [-0.14, -0.03, 0.04, 0.12]]; P.eat = i === FORAGER_EAT.chewA ? 2 : 3; P.happy = true;
    P.bob = i === FORAGER_EAT.chewA ? 0.006 : -0.004; P.tip = i === FORAGER_EAT.chewA ? 0.035 : 0.01;
  }
  else if (i === FORAGER_EAT.dip) { P.hands = [EAT_HOLD, [-0.16, 0.17, 0.02, 0.14]]; P.look = 0.05; P.tip = 0.03; }
  else if (i === FORAGER_EAT.tug) { P.hands = [EAT_HOLD, [-0.1, -0.09, 0.07, 0.1]]; P.eat = 1; P.turn = 0.55; P.look = 0.02; P.tip = 0.05; P.bob = -0.006; }
  else if (i === FORAGER_EAT.sip) { P.hands = [[0.12, -0.03, -0.04, 0.12], [-0.12, -0.03, 0.04, 0.12]]; P.up = true; P.look = -0.035; P.blink = true; P.tip = -0.02; }
  else if (i === FORAGER_EAT.blow) { P.hands = [[0.1, 0.09, -0.05, 0.13], [-0.1, 0.09, 0.05, 0.13]]; P.blow = true; P.look = 0.03; P.tip = 0.02; }
  return P;
}
// Eating sitting on the seat log (kneel view, poses 25 to 31: FORAGER_SIT_EAT): sitting as sitPose, the arms and face of
// the standing eat painting it stands for.
function sitEatPose(i) {
  const P = sitPose(false), E = idlePose(FORAGER_EATS[i - FORAGER_SIT_EAT.bite]);
  P.hands = E.hands; P.eat = E.eat; P.up = E.up; P.happy = E.happy; P.blink = E.blink; P.blow = E.blow;
  P.look = E.look; P.turn = E.turn; P.tip = E.tip; P.bob += E.bob;
  return P;
}
// Eating (game.js EAT_WAYS), from the front as the idles, after them in 'view' 3: a mitten up to its mouth with a bite in
// it, the mouth open, then munching, eyes shut happy and a cheek full, one side and the other. The mitten comes in front
// of the face (drawn after the head) and lies under its chin; the bite itself is painted with the face (P.eat 1). The
// other mitten holds the rest before its chest (EAT_HOLD: game.js lays the dish there). And: a spoon dipped into it, the
// head down (dip); a bite pulled off a stick to the side, the face turned (tug); the bowl to its lips in both hands, eyes
// shut, the head back (sip: both mittens over the face, P.up); and blown on, held low, lips pursed and cheeks puffed (blow).
const FORAGER_EAT = { bite: 9, chewA: 10, chewB: 11, sip: 12, blow: 13, dip: 14, tug: 15 };
const FORAGER_EATS = Object.values(FORAGER_EAT);
const EAT_HOLD = [0.1, 0.2, -0.05, 0.13];
const FORAGER_SIT_EAT = { bite: 25, chewA: 26, chewB: 27, sip: 28, blow: 29, dip: 30, tug: 31 };   // (in the order of FORAGER_EAT)
const FORAGER_SIT_EATS = Object.values(FORAGER_SIT_EAT);

// Emotes (game.js EMOTES), kept after all the rest of its paintings: 'forager:' + emoteArt(snow, outfit, pose).
// The dance (NLE Choppa's, the first one: the easter egg's, game.js partyTap), from the front: a crouch, then a hop on one
// foot with the other knee up, that leg kicked straight out to the side, back in, and the same the other way, the fists up
// and swinging across against the kick (the hop itself is game.js's, lifting the painting). hands: [mitten, elbow], each
// from its shoulder.
// The sneak, side on: a devious tiptoe, crouched and hunched, its head poked forward, the knees lifted high and each
// foot set down toe first, the mittens up before its chest like little claws, rubbing, a sly look and a smirk; eight
// paintings a stride (as the walk), and two lurking on the spot.
const FORAGER_EMOTE = { down: 0, hopR: 1, kickR: 2, backR: 3, hopL: 4, kickL: 5, backL: 6, sneak: 8, lurkA: 16, lurkB: 17, hugA: 18, hugB: 19 };
const FORAGER_EMOTES = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const EMOTE_AT = FORAGER_SNOWS * FORAGER_SNOW_ARTS, FORAGER_EMOTE_ARTS = FORAGER_SNOWS * FORAGER_OUTFITS.length << 5;
const emoteArt = (snow, outfit, pose) => EMOTE_AT + ((snow * FORAGER_OUTFITS.length + outfit) << 5) + pose;
const SNEAK_STRIDE = 1.15, SNEAK_DOWN = 0.6, SNEAK_LIFT = 0.2, SNEAK_BOB = 0.05;
const SNEAK_REACH = 2 * FORAGER_REACH * SNEAK_STRIDE * SNEAK_DOWN;   // (the planted foot keeps pace with the ground, as the jog's)
const DANCE = [   // feet, knees (front view: leg 0 on your left), mittens and elbows, the hips' bob, the hem's swing, the hood's point
  { feet: [[-0.13, 0.72], [0.11, 0.73]], knees: [[-0.16, 0.57], [0.15, 0.58]], hands: [[0.07, 0.07, -0.09, 0.11], [-0.06, 0.06, 0.09, 0.11]], bob: 0.045, sway: 0, tip: 0.03, grin: true },
  { feet: [[-0.08, 0.72], [0.21, 0.6]], knees: [[-0.09, 0.56], [0.22, 0.46]], hands: [[-0.1, 0.05, -0.06, 0.12], [-0.16, 0.07, 0.01, 0.13]], bob: 0, sway: -0.02, tip: 0.05, grin: true },
  { feet: [[-0.06, 0.72], [0.41, 0.53]], knees: [[-0.08, 0.56], [0.25, 0.46]], hands: [[-0.17, -0.01, -0.09, 0.1], [-0.21, 0.04, -0.01, 0.12]], bob: 0.01, sway: -0.04, tip: 0.08, happy: true },
  { feet: [[-0.08, 0.72], [0.16, 0.68]], knees: [[-0.09, 0.56], [0.18, 0.53]], hands: [[-0.06, 0.06, -0.09, 0.12], [-0.11, 0.06, 0.05, 0.12]], bob: 0.02, sway: -0.02, tip: 0.04, grin: true },
  { feet: [[-0.23, 0.6], [0.07, 0.73]], knees: [[-0.23, 0.46], [0.09, 0.57]], hands: [[0.17, 0.07, -0.01, 0.13], [0.1, 0.04, 0.06, 0.12]], bob: 0, sway: 0.02, tip: 0, grin: true },
  { feet: [[-0.43, 0.53], [0.05, 0.73]], knees: [[-0.26, 0.46], [0.08, 0.57]], hands: [[0.22, 0.04, 0.02, 0.12], [0.17, -0.01, 0.09, 0.1]], bob: 0.01, sway: 0.04, tip: -0.03, happy: true },
  { feet: [[-0.18, 0.68], [0.07, 0.73]], knees: [[-0.19, 0.53], [0.09, 0.57]], hands: [[0.11, 0.06, -0.05, 0.12], [0.06, 0.06, 0.09, 0.12]], bob: 0.02, sway: 0.02, tip: 0.01, grin: true },
];
function emotePose(i) {
  if (i >= FORAGER_EMOTE.hugA) return hugPose(i);
  if (i >= FORAGER_EMOTE.sneak) return sneakPose(i);
  const P = foragerPose(1, 0), D = DANCE[i] || DANCE[0];
  P.feet = D.feet.map(f => f.slice()); P.knees = D.knees.map(k => k.slice());
  P.hands = D.hands; P.bob = D.bob; P.sway = D.sway; P.tip = D.tip; P.happy = !!D.happy; P.grin = !!D.grin;
  P.legLine = 0.32;                                             // (a leg kicked out shows up to the hip)
  return P;
}
// A hug, side on and turned toward the friend it hugs (game.js hug): arms out and up, its eyes shut happy, then a
// squeeze in closer, its head against them. Two paintings, taken in turn for as long as the hug lasts.
function hugPose(i) {
  const P = foragerPose(0, 0), B = i === FORAGER_EMOTE.hugB;
  P.arms = B ? [1.54, 1.62] : [0.92, 1.0];
  P.lean = B ? 0.1 : 0.025;
  P.bob = B ? -0.008 : 0.014;
  P.look = 0.02; P.tip = B ? 0.055 : 0.02; P.sway = 0;
  P.warm = true; P.happy = true;
  return P;
}
function sneakPose(i) {
  const P = foragerPose(0, 0), lurk = i >= FORAGER_EMOTE.lurkA, u = lurk ? 0 : (i - FORAGER_EMOTE.sneak) / 8;
  // A foot: how far ahead of the hips it is, how high, and how far up on its toes (stepping off, in the air, setting down).
  const foot = v => {
    v = ((v % 1) + 1) % 1;
    if (v < SNEAK_DOWN) return [SNEAK_REACH - 2 * SNEAK_REACH * v / SNEAK_DOWN, 0, v < 0.15 * SNEAK_DOWN ? 1 - v / (0.15 * SNEAK_DOWN) : v > 0.7 * SNEAK_DOWN ? (v / SNEAK_DOWN - 0.7) / 0.3 : 0];
    const s = (v - SNEAK_DOWN) / (1 - SNEAK_DOWN);
    return [-SNEAK_REACH + 2 * SNEAK_REACH * smoothstep(s), SNEAK_LIFT * Math.sin(Math.PI * s ** 0.8), 1];
  };
  const base = [[-0.035, 0.72], [0.045, 0.72]];
  const steps = lurk ? [[-0.1, 0, 1], [0.08, 0, 0]] : [foot(u), foot(u + 0.5)];
  P.feet = steps.map(([a, up], k) => [base[k][0] - a, base[k][1] - up]);
  P.toes = steps.map(s => s[2]);
  const rub = lurk ? (i === FORAGER_EMOTE.lurkA ? 0.07 : -0.07) : 0.05 * Math.sin(4 * Math.PI * u);
  P.walk = !lurk; P.u = u;
  P.bob = SNEAK_BOB + (lurk ? (i === FORAGER_EMOTE.lurkA ? 0 : 0.008) : -0.02 * Math.sin(4 * Math.PI * u + 1.2));   // (rising onto its toes as each foot passes)
  P.stoop = 0.45; P.lean = 0.08; P.bend = 0.55; P.arms = [1.0 + rub, 0.94 - rub];   // (the forearms out before its chest, little claws)
  P.kneeOver = !lurk && steps[0][1] > 0.05; P.hemUp = 0.05;        // (the cloak hitched up, tiptoeing)
  P.tip = 0.06 * Math.cos(4 * Math.PI * u + 1.2) + 0.03; P.sway = lurk ? 0.01 : 0.02 * Math.sin(2 * Math.PI * u);
  P.look = lurk && i === FORAGER_EMOTE.lurkB ? 0.03 : 0.015; P.sly = true; P.legLine = 0.44;
  return P;
}

// Carrying a dish (game.js drawHeldDish), kept after the emotes: the same standing, walking and jogging paintings in each
// view, but held carefully: both mittens out before its middle with the forearms level, where the dish sits on them (side
// on, the elbows bent and the hands ahead; from the front, the mittens at the dish's either side; from behind, both arms
// out ahead, hidden by the cloak). Its steps a little shorter (CARRY_STRIDE: game.js turns the stride over sooner), the
// body upright and its bob halved, so the dish rides steady. Cold, it no longer hugs itself (its hands are full), but its
// face stays cold. 'forager:' + carryArt(snow, outfit, (view << 5) + pose), views 0 to 2 only.
const CARRY_STRIDE = 0.8, CARRY_HANDS = [[-0.05, 0.22, -0.09, 0.12], [0.05, 0.22, 0.09, 0.12]];   // (from the front: each mitten and elbow, from its shoulder)
const CARRY_AT = EMOTE_AT + FORAGER_EMOTE_ARTS, FORAGER_CARRY_ARTS = FORAGER_SNOWS * FORAGER_SNOW_ARTS;
const carryArt = (snow, outfit, vp) => CARRY_AT + snow * FORAGER_SNOW_ARTS + (outfit << 7) + vp;
function carryPose(view, pose) {
  const P = foragerPose(view, pose, CARRY_STRIDE);
  P.carry = true; P.hug = false; P.hand = false; P.swing = 0;
  P.bob *= P.stoop ? 1 : 0.5; P.tip *= 0.6; P.sway *= 0.6; P.lean *= 0.4;
  if (view === 0) { P.arms = [0.5, 0.42]; P.bend = 1.25; }      // (side on: the upper arms down a little forward, the forearms level ahead)
  else if (view === 1) P.hands = CARRY_HANDS;
  return P;
}

// Snow lying on a part: a soft white mark, none when there's no snow (thicker and brighter the more, SNOWED).
const snowOn = (path, blur) => (SNOWED ? [[SNOW_ON, SNOWED === 1 ? 0.75 : 0.95, blur, path]] : []);
function foragerParts(P) {
  const parts = [], add = (path, o = {}) => parts.push({ path, ...o });
  const side = P.view === 0, front = P.view === 1, back = P.view === 2;
  const hx = 0, hy = 0.4 + P.bob;                                  // the hips
  const lx = P.fwd[0] * P.lean, ly = P.fwd[1] * P.lean * 0.5;     // leaning in: the head and the shoulders forward
  const cx = (side ? 0.0 : front ? -0.01 : 0.01) + lx + P.fwd[0] * 0.1 * P.stoop, cy = -0.2 + P.bob + P.look + ly + P.lean * 0.3 + 0.05 * P.stoop;   // the head (the hood's middle)
  // Bent over (P.stoop): the shoulders go forward and down with the head, so the neck stays on the body; the hips and the hem stay.
  // Side on, the back rounds out behind them (hunch) and the hood's point flops forward.
  const sh = P.fwd[0] * 0.12 * P.stoop, sd = 0.05 * P.stoop, hunch = side ? 0.13 * P.stoop : 0;
  const R = 0.26;
  // Legs: from the hips to the feet, the knee bent forward, in a boot. (Mostly under the cloak.)
  const leg = (i, far, part) => {
    const [fx, fy] = P.feet[i], sx = hx + (side ? (i ? 0.03 : -0.02) : (i ? 0.075 : -0.075)), sy = hy;
    const knee = P.knees ? P.knees[i].slice() : jointAt(sx, sy, fx, fy - 0.03, 0.17, 0.17, side ? -1 : 1);
    if (!side && !P.knees) { knee[0] += ((sx + fx) / 2 - knee[0]) * 0.5; knee[1] += ((sy + fy - 0.03) / 2 - knee[1]) * 0.2; }   // (a knee bent toward you or away is foreshortened, not out to the side)
    const down = P.kneel && i === 0, toe = down ? 1 : side ? -1 : P.sit ? (i ? 0.3 : -0.3) : P.fwd[0] < 0 ? -0.8 : 0.8;   // (kneeling, the near boot lies behind, toe down; sitting, toes to you, splayed)
    const tt = P.toes ? P.toes[i] : 0;                                // (up on its toes: the boot tipped, narrower and taller, toe forward)
    const bh = (down ? 0.05 : P.sit ? 0.048 : 0.04) + 0.012 * tt, by = fy - (down ? 0.035 : 0.025) + 0.004 * tt, bx = fx + (down ? 0.012 : toe * (0.025 + 0.012 * tt)), bw = down ? 0.045 : (side ? 0.07 : 0.055) - 0.02 * tt;   // (kneeling, the back boot is a short round sole, its toe tucked under)
    if (part === 'thigh') {                                        // (a lifted knee: the thigh goes in under the cloak, it's drawn first)
      add(g => limbAt(g, sx, sy, 0.065, knee[0], knee[1], 0.05), { far, leg: P.legLine, marks: [[TROUSER, 1, 0.02, g => limbAt(g, sx, sy, 0.065, knee[0], knee[1], 0.05)]] });
      return;
    }
    if (part === 'shin') {                                         // ...and the shin and boot below it (the cloak itself is draped over the knee, `cloak`)
      const [kx, ky] = knee;
      add(g => { limbAt(g, kx, ky, 0.05, fx, fy - 0.03, 0.045); ovalAt(g, bx, by, bw, bh); },
        { far, leg: P.legLine, marks: [[TROUSER, 1, 0.02, g => limbAt(g, kx, ky, 0.05, fx, fy - 0.03, 0.045)],
          [BOOT, 1, 0.02, g => { ovalAt(g, bx, by, bw + 0.005, bh + 0.005); g.rect(fx - 0.06, fy - 0.11, 0.12, 0.09); }]] });
      return;
    }
    add(g => {
      limbAt(g, sx, sy, 0.065, knee[0], knee[1], 0.05);
      limbAt(g, knee[0], knee[1], 0.05, fx, fy - 0.03, 0.045);
      ovalAt(g, bx, by, bw, bh);                                   // the boot
    }, { far, leg: P.legLine || (P.kneel ? 0.62 : 0.5), marks: [[TROUSER, 1, 0.02, g => { limbAt(g, sx, sy, 0.065, knee[0], knee[1], 0.05); limbAt(g, knee[0], knee[1], 0.05, fx, fy - 0.03, 0.045); }],
      [BOOT, 1, 0.02, g => { ovalAt(g, bx, by, bw + 0.005, bh + 0.005); g.rect(fx - 0.06, fy - (down ? 0.09 : 0.11), 0.12, down ? 0.07 : 0.09); }]] });
  };
  // An arm: a sleeve from the shoulder, swung a forward (+), and a knitted mitten. Bent (jogging), the forearm comes up
  // forward from the elbow, level at the top of the swing (not up at the chin).
  const arm = (x, a, far, casts, hand) => {
    const sx = x + lx * 0.7 + sh * 0.8, sy = 0.06 + P.bob + ly * 0.7 + sd;
    if (P.bend) a -= 0.15;                                         // (pumping, the arm swings a little more back than up)
    const to = (x, y, t, L) => [x + (side ? -Math.sin(t) : P.fwd[0] * Math.sin(t) * 0.9) * L, y + Math.cos(t) * L + (side ? 0 : P.fwd[1] * Math.sin(t) * 0.12)];
    const [kx, ky] = P.bend ? to(sx, sy, a, 0.12) : [sx, sy];
    const [ex, ey] = hand ? [sx + hand[0], sy + hand[1]] : P.bend ? to(kx, ky, a + P.bend, 0.11) : to(sx, sy, a, 0.2 + 0.07 * P.stoop);
    if (hand && hand.length > 2) {                                 // (an elbow given: the mitten up, the cuff toward the elbow)
      const ox = sx + hand[2], oy = sy + hand[3];
      add(g => { limbAt(g, sx, sy, 0.06, ox, oy, 0.055); limbAt(g, ox, oy, 0.055, ex, ey, 0.05); discAt(g, ex, ey, 0.048); },
        { far, casts, marks: [[MITTEN, 1, 0.02, g => discAt(g, ex, ey + 0.004, 0.05)], [tone(CLOAK, 0.8), 0.6, 0.03, g => ovalAt(g, ex + (ox - ex) * 0.32, ey + (oy - ey) * 0.32, 0.04, 0.04)]] });
      return;
    }
    add(g => { if (P.bend) limbAt(g, kx, ky, 0.055, ex, ey, 0.05); limbAt(g, sx, sy, 0.06, P.bend ? kx : ex, P.bend ? ky : ey, P.bend ? 0.055 : 0.05); discAt(g, ex, ey + 0.02, 0.048); },
      { far, casts, marks: [[MITTEN, 1, 0.02, g => discAt(g, ex, ey + 0.025, 0.05)], [tone(CLOAK, 0.8), 0.6, 0.03, g => ovalAt(g, ex, ey - 0.02, 0.055, 0.02)]] });
  };
  // Cold, it hugs itself: the elbows in at its sides, the forearms across its chest, each mitten on the other arm. From
  // the back only the elbows show past the cloak (drawn before it); side on, the near arm.
  const hug = (x, k) => {
    const sx = x + lx * 0.7, sy = 0.06 + P.bob + ly * 0.7;
    const [kx, ky, ex, ey] = side ? [sx + 0.035, 0.22 + P.bob, -0.135, 0.12 + P.bob]
      : back ? [x * 1.6, 0.21 + P.bob, x * 0.3, 0.13 + P.bob] : [x * 1.2, 0.22 + P.bob, -x * 0.8, (k ? 0.15 : 0.11) + P.bob];
    const cuff = g => ovalAt(g, ex + (kx - ex) * 0.3, ey + (ky - ey) * 0.3, 0.04, 0.04);
    add(g => { limbAt(g, sx, sy, 0.06, kx, ky, 0.055); limbAt(g, kx, ky, 0.055, ex, ey, 0.05); discAt(g, ex, ey, 0.046); },
      { casts: !back, marks: [[MITTEN, 1, 0.02, g => discAt(g, ex, ey + 0.004, 0.048)], [tone(CLOAK, 0.8), 0.6, 0.03, cuff]] });
  };
  // The cloak: a bell from the shoulders to the hem, the strap across it.
  const hem = 0.47 + P.bob - (P.hemUp || 0), sw = P.sway;
  // Sitting (P.sit): spread out to either side over the log, its front over the knees in two humps, d lower.
  const lapEdge = (g, d) => {
    const [l, r] = P.knees, y = hy + 0.02 + d;
    g.quadraticCurveTo(-0.22, y + 0.06, l[0], l[1] + 0.005 + d);
    g.quadraticCurveTo(0, l[1] - 0.045 + d, r[0], r[1] + 0.005 + d);
    g.quadraticCurveTo(0.22, y + 0.06, 0.29, y);
  };
  const kneeUp = P.kneeOver ? jointAt(0 - 0.02, hy, P.feet[0][0], P.feet[0][1] - 0.03, 0.17, 0.17, -1) : null;   // (the lifted near knee, as `leg` finds it)
  const cloak = () => add(g => {
    g.moveTo(-0.11 + lx + sh, -0.02 + P.bob + ly + sd);
    if (P.kneel) {                                                   // draped over the far knee (its shin showing under it), lying on the ground behind
      const kx = P.knees[1][0], ky = P.knees[1][1];
      g.quadraticCurveTo(-0.19 + lx * 0.6 + sh * 0.4, 0.12 + P.bob + sd * 0.5, kx - 0.07, ky - 0.035);
      g.quadraticCurveTo(kx - 0.09, ky + 0.04, kx + 0.03, ky + 0.06);
      g.quadraticCurveTo(-0.07, 0.62, -0.06, 0.7);
      g.quadraticCurveTo(0.0, 0.745, 0.1, 0.73);               // (the hem rounds over the ground, then humps over the kneeling shin)
      g.quadraticCurveTo(0.22, 0.735, 0.255, 0.69);
      g.quadraticCurveTo(0.27, 0.62, 0.2, 0.55);
      g.quadraticCurveTo(0.17 + hunch * 0.3, 0.4, 0.15 + lx * 0.5 + sh * 0.2 + hunch * 0.6, 0.26 + P.bob - hunch * 0.2);   // (bent over: the back rounds up to the shoulders, forward)
      g.quadraticCurveTo(0.14 + lx * 0.5 + sh * 0.3 + hunch, 0.13 + P.bob - hunch * 0.5, 0.11 + lx + sh, -0.02 + P.bob + ly + sd);
    } else if (P.sit) {
      g.quadraticCurveTo(-0.25, 0.16 + P.bob, -0.29, hy + 0.02);
      lapEdge(g, 0);
      g.quadraticCurveTo(0.25, 0.16 + P.bob, 0.11, -0.02 + P.bob);
    } else {
      g.quadraticCurveTo(-0.2 + lx * 0.5 + sh * 0.4, 0.18 + P.bob + sd * 0.5, -0.25 + sw, hem);
      if (P.kneeOver) {                                              // (sneaking: the hem draped over the lifted knee, its round shape in the cloak's own edge)
        const [kx, ky] = kneeUp;
        g.quadraticCurveTo(kx - 0.14, hem + 0.05, kx - 0.075, ky + 0.01);
        g.quadraticCurveTo(kx, ky + 0.085, kx + 0.075, ky + 0.01);
        g.quadraticCurveTo(kx + 0.11, ky + 0.07, 0.25 + sw, hem);
      } else g.quadraticCurveTo(0, hem + 0.06, 0.25 + sw, hem);
      g.quadraticCurveTo(0.2 + lx * 0.5 + sh * 0.3 + hunch, 0.18 + P.bob - hunch * 0.5, 0.11 + lx + sh, -0.02 + P.bob + ly + sd);
    }
    g.closePath();
  }, { casts: true, marks: [
    ...snowOn(g => { const d = 0.03 * SNOWED; const o = lx + sh, e = ly + sd; g.moveTo(-0.3 + o, -0.1 + P.bob + e); g.lineTo(0.3 + o, -0.1 + P.bob + e); g.lineTo(0.3 + o, 0.05 + d + P.bob + e);
      g.quadraticCurveTo(0.15 + o, 0.02 + d + P.bob + e, sh, 0.04 + d + P.bob + e); g.quadraticCurveTo(-0.15 + o, 0.02 + d + P.bob + e, -0.3 + o, 0.05 + d + P.bob + e); g.closePath(); }, 0.03),   // on the shoulders
    ...P.kneeOver ? [[tone(CLOAK, 0.7), 0.7, 0.03, g => { const [kx, ky] = kneeUp; g.moveTo(kx - 0.1, ky - 0.01); g.quadraticCurveTo(kx, ky + 0.045, kx + 0.1, ky - 0.01); g.lineTo(kx + 0.1, ky + 0.15); g.lineTo(kx - 0.1, ky + 0.15); g.closePath(); }]] : [],   // (a darker fold under the knee)
    [tone(CLOAK, 0.82), 0.7, 0.04, P.kneel ? g => { g.moveTo(-0.35, 0.66); g.quadraticCurveTo(-0.1, 0.62, 0.08, 0.68); g.quadraticCurveTo(0.2, 0.7, 0.35, 0.6); g.lineTo(0.35, 0.8); g.lineTo(-0.35, 0.8); g.closePath(); }
      : P.sit ? g => { g.moveTo(-0.29, hy - 0.02); lapEdge(g, -0.04); g.lineTo(0.35, 0.9); g.lineTo(-0.35, 0.9); g.closePath(); }
      : g => { g.moveTo(-0.3 + sw, hem - 0.04); g.quadraticCurveTo(0, hem + 0.02, 0.3 + sw, hem - 0.04); g.lineTo(0.3, hem + 0.1); g.lineTo(-0.3, hem + 0.1); g.closePath(); }],   // a darker hem
    ...side ? [[STRAP, 1, 0.012, g => { g.moveTo(-0.04 + sh, -0.04 + P.bob + sd); g.lineTo(0.03 + sh, -0.04 + P.bob + sd); g.lineTo(0.13, 0.27 + P.bob); g.lineTo(0.08, 0.28 + P.bob); g.closePath(); }]]
      : [[STRAP, 1, 0.012, g => { const s = front ? 1 : -1; g.moveTo(-0.12 * s + sh, -0.02 + P.bob + sd); g.lineTo(-0.06 * s + sh, -0.04 + P.bob + sd); g.lineTo(0.2 * s, 0.25 + P.bob); g.lineTo(0.15 * s, 0.28 + P.bob); g.closePath(); }]],
  ] });
  const satchel = () => {
    const x = (side ? 0.12 : front ? 0.19 : -0.19) + sh * 0.4, y = 0.3 + P.bob + sd * 0.4 + (P.walk ? (P.jog ? 0.025 : 0.012) * Math.sin(4 * Math.PI * P.u + 0.6) : 0), w = side ? 0.085 : 0.075, yf = y - P.flap;
    add(g => { g.moveTo(x - w, y - 0.06); g.lineTo(x + w, y - 0.06); g.quadraticCurveTo(x + w + 0.01, y + 0.08, x, y + 0.09); g.quadraticCurveTo(x - w - 0.01, y + 0.08, x - w, y - 0.06); g.closePath(); },
      { casts: true, marks: [[SATCHEL, 1, 0.015, g => g.rect(x - 0.2, y - 0.2, 0.4, 0.4)],
        ...P.flap ? [[tone(SATCHEL, 0.45), 1, 0.012, g => ovalAt(g, x, y - 0.05, w * 0.9, 0.025)]] : [],   // (the flap up: the dark inside)
        [FLAP, 1, 0.012, g => { const y = yf; g.moveTo(x - w - 0.01, y - 0.065); g.lineTo(x + w + 0.01, y - 0.065); g.quadraticCurveTo(x + w, y + 0.03, x, y + 0.035); g.quadraticCurveTo(x - w, y + 0.03, x - w - 0.01, y - 0.065); g.closePath(); }],
        ...snowOn(g => ovalAt(g, x, yf - 0.075, w + 0.02, 0.012 + 0.01 * SNOWED), 0.012),   // on the flap
        [[214, 178, 96], 1, 0.008, g => discAt(g, x, yf + 0.02, 0.013)]] });   // its brass button
  };
  // The hood's point: out behind the head, flopping.
  const tip = () => {
    const t = P.tip + 0.05 * P.stoop;
    if (HAT !== 'hood') return;                                   // (a hat instead: hat)
    if (side) add(g => { g.moveTo(cx + 0.12, cy - 0.22); g.quadraticCurveTo(cx + 0.36, cy - 0.24 + t, cx + 0.42, cy - 0.06 + t * 1.6); g.quadraticCurveTo(cx + 0.3, cy - 0.05 + t, cx + 0.2, cy + 0.02); g.closePath(); },
      { marks: [[HOOD, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)], ...snowOn(g => ovalAt(g, cx + 0.3, cy - 0.24 + t, 0.16, 0.025 + 0.025 * SNOWED), 0.02)] });
    else if (front) add(g => { g.moveTo(cx + 0.06, cy - 0.24); g.quadraticCurveTo(cx + 0.24, cy - 0.34 + t, cx + 0.33, cy - 0.22 + t * 1.6); g.quadraticCurveTo(cx + 0.22, cy - 0.16, cx + 0.17, cy - 0.12); g.closePath(); },
      { marks: [[HOOD, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)], ...snowOn(g => ovalAt(g, cx + 0.2, cy - 0.31 + t, 0.14, 0.025 + 0.025 * SNOWED), 0.02)] });
    else add(g => {                                             // from the back: hanging down between the shoulders
      g.moveTo(cx - 0.09, cy - 0.04);                           // a short, slim point that curls to the right at its end
      g.bezierCurveTo(cx - 0.08, cy + 0.1, cx - 0.06 + t, cy + 0.2, cx + 0.03 + t * 1.5, cy + 0.27);
      g.bezierCurveTo(cx + 0.02 + t, cy + 0.18, cx + 0.09, cy + 0.12, cx + 0.09, cy - 0.05);
      g.quadraticCurveTo(cx, cy - 0.1, cx - 0.09, cy - 0.04);
      g.closePath();
    },
      { casts: true, marks: [[HOOD, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)]] });
  };
  // The head: the hood round it, the face in its opening (none from the back), a fringe of hair under the hood.
  const fx = cx + (side ? -0.085 : -0.05 + 0.055 * P.turn), fy = cy + 0.035;
  const frx = side ? 0.155 : 0.165, fry = 0.165;
  const cap = snowOn(g => ovalAt(g, cx + 0.01, cy - R * 0.98, R * 0.95, 0.05 + 0.045 * SNOWED), 0.025);   // a cap of snow on the hood
  const head = () => add(g => { ovalAt(g, cx, cy, R, R * 0.97); ovalAt(g, cx + 0.02, cy + 0.17, 0.17, 0.09); },   // and a little cowl at the neck
    { casts: true, marks: back ? [[HOOD, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)], [HOOD_RIM, 0.55, 0.04, g => ovalAt(g, cx, cy + 0.17, 0.17, 0.06)], ...cap]   // (no cheek from behind)
      : [[HOOD, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)],
        [HOOD_RIM, 1, 0.03, g => ovalAt(g, fx, fy, frx + 0.04, fry + 0.04)], ...cap,
        [SKIN, 1, 0.015, g => ovalAt(g, fx, fy, frx, fry)],
        [HAIR, 1, 0.02, g => {                                   // the fringe: the top of the face, a wavy edge across the brow
          g.moveTo(fx - frx, fy - 0.01);
          g.ellipse(fx, fy, frx, fry, 0, Math.PI, 2 * Math.PI);
          g.quadraticCurveTo(fx + frx * 0.6, fy - 0.06, fx + frx * 0.25, fy - 0.075);
          g.quadraticCurveTo(fx + frx * 0.1, fy - 0.045, fx - frx * 0.15, fy - 0.08);
          g.quadraticCurveTo(fx - frx * 0.55, fy - 0.07, fx - frx, fy - 0.01);
          g.closePath();
        }]] });
  // The hat over the hood (FORAGER_HATS; the pointed hood is tip's), sat back a little from the face. Each fills itself
  // with its own colour (the parts are filled with the cloak's first) and catches snow on top.
  const full = rgb => [rgb, 1, 0.01, g => g.rect(cx - 1, cy - 1, 2, 2)];
  const hat = () => {
    const t = P.tip, top = cy - R * 0.97, bx = cx + (side ? 0.035 : front ? 0.02 : 0);
    if (HAT === 'bobble') {                                         // a woolly pompom, nodding with the hood
      const px = bx + t * 0.25, py = top - 0.045 + Math.abs(t) * 0.2;
      add(g => { for (let k = 0; k < 7; k++) { const a = k * TAU / 7; discAt(g, px + Math.cos(a) * 0.055, py + Math.sin(a) * 0.05, 0.056); } },
        { casts: true, marks: [full([238, 228, 208]), [[214, 200, 176], 0.8, 0.03, g => ovalAt(g, px + 0.02, py + 0.045, 0.07, 0.04)],
          ...snowOn(g => ovalAt(g, px, py - 0.06, 0.07, 0.02 + 0.02 * SNOWED), 0.02)] });
    } else if (HAT === 'ears') {                                    // a fox's ears, leaning out, cream inside, dark at the tips
      const ear = (x, y, lean, far) => {
        const h = 0.17, w = 0.13, s = Math.sin(lean), c = Math.cos(lean);
        const tx = x + s * h, ty = y - c * h, ax = x - c * w / 2, ay = y - s * w / 2, bx2 = x + c * w / 2, by2 = y + s * w / 2;
        const path = g => { g.moveTo(ax, ay); g.quadraticCurveTo(ax + s * h * 0.7 - c * 0.02, ay - c * h * 0.75, tx, ty); g.quadraticCurveTo(bx2 + s * h * 0.6 + c * 0.01, by2 - c * h * 0.6, bx2, by2); g.closePath(); };
        add(path, { far, casts: !far, marks: [full(HOOD), [tone(HOOD, 0.45), 1, 0.03, g => discAt(g, tx, ty + 0.01, 0.045)],
          ...back || far ? [] : [[[240, 226, 204], 0.95, 0.04, g => { g.moveTo(x - c * 0.035, y - s * 0.035); g.lineTo(x + s * h * 0.62, y - c * h * 0.62); g.lineTo(x + c * 0.035, y + s * 0.035); g.closePath(); }]]] });
      };
      if (side) { ear(cx + 0.15, cy - 0.18, 0.5, true); ear(cx + 0.03, cy - 0.22, 0.12, false); }
      else { const d = front ? -0.02 : 0; ear(cx - 0.13 + d, cy - 0.18, -0.42, false); ear(cx + 0.13 + d, cy - 0.18, 0.42, false); }
    } else if (HAT === 'toadstool') {                               // a red cap, a cream rim under it, white spots
      const y0 = cy - 0.15, W = 0.34, H = 0.25, x0 = bx;
      add(g => { g.moveTo(x0 - W, y0); g.bezierCurveTo(x0 - W * 1.02, y0 - H * 1.3, x0 + W * 1.02, y0 - H * 1.3, x0 + W, y0); g.quadraticCurveTo(x0, y0 + 0.08, x0 - W, y0); g.closePath(); },
        { casts: true, marks: [full([196, 58, 46]), [[238, 224, 198], 1, 0.02, g => ovalAt(g, x0, y0 + 0.03, W * 0.92, 0.035)],
          ...[[-0.2, -0.07, 0.048], [-0.04, -0.17, 0.056], [0.17, -0.1, 0.05], [0.06, -0.05, 0.032], [-0.13, -0.15, 0.03], [0.24, -0.03, 0.03]].map(([dx, dy, r]) =>
            [[246, 238, 222], 1, 0.012, g => ovalAt(g, x0 + dx, y0 + dy, r, r * 0.8)]),
          ...snowOn(g => ovalAt(g, x0, y0 - H * 0.96, W * 0.75, 0.04 + 0.04 * SNOWED), 0.025)] });
    } else if (HAT === 'wanderer') {                                // a wide felt hat, a band in the hood's colour, a feather in it
      const FELT = [112, 84, 62], yb = cy - 0.19, x0 = bx, tilt = side ? -0.06 : 0;
      add(g => ovalAt(g, x0, yb, 0.42, side ? 0.06 : 0.085, tilt), { casts: true, marks: [full(FELT), [tone(FELT, 0.7), 0.7, 0.04, g => ovalAt(g, x0, yb - 0.02, 0.2, 0.05)],
        ...snowOn(g => ovalAt(g, x0 - 0.02, yb - 0.035, 0.38, 0.02 + 0.015 * SNOWED), 0.02)] });
      const ct = yb - 0.25, cw = 0.19;
      add(g => { g.moveTo(x0 - cw, yb); g.bezierCurveTo(x0 - cw * 0.95, ct - 0.02, x0 - 0.05, ct + 0.03, x0, ct + 0.025); g.bezierCurveTo(x0 + 0.05, ct + 0.03, x0 + cw * 0.95, ct - 0.02, x0 + cw, yb); g.quadraticCurveTo(x0, yb + 0.05, x0 - cw, yb); g.closePath(); },
        { casts: true, marks: [full(FELT), [HOOD, 1, 0.012, g => { g.moveTo(x0 - cw * 1.05, yb - 0.07); g.quadraticCurveTo(x0, yb - 0.035, x0 + cw * 1.05, yb - 0.07); g.lineTo(x0 + cw * 1.05, yb + 0.06); g.lineTo(x0 - cw * 1.05, yb + 0.06); g.closePath(); }],
          ...snowOn(g => ovalAt(g, x0, ct + 0.03, 0.12, 0.02 + 0.02 * SNOWED), 0.02)] });
      const fx0 = x0 + (side ? 0.15 : 0.13), fy0 = yb - 0.04, fs = t * 0.4;   // the feather, out of the band and back, swaying a little
      add(g => { g.moveTo(fx0, fy0); g.bezierCurveTo(fx0 + 0.02, fy0 - 0.12, fx0 + 0.1 + fs, fy0 - 0.2, fx0 + 0.16 + fs, fy0 - 0.27); g.bezierCurveTo(fx0 + 0.13 + fs, fy0 - 0.15, fx0 + 0.07, fy0 - 0.06, fx0 + 0.025, fy0 + 0.01); g.closePath(); },
        { marks: [full([236, 228, 212]), [[70, 64, 60], 0.9, 0.02, g => ovalAt(g, fx0 + 0.15 + fs, fy0 - 0.25, 0.035, 0.035)]] });
    } else if (HAT === 'flowers') {                                 // a ring of blossoms round the hood's crown, leaves between
      const y0 = cy - 0.175, rx = 0.25, ry = side ? 0.05 : 0.075, pts = [];
      for (let k = 0; k < 6; k++) { const a = Math.PI * (0.05 + 0.9 * k / 5); pts.push([bx - 0.01 + Math.cos(a) * rx, y0 + Math.sin(a) * ry]); }
      add(g => { for (let k = 0; k < 5; k++) { const [x1, y1] = pts[k], [x2, y2] = pts[k + 1], mx = (x1 + x2) / 2, my = (y1 + y2) / 2; ovalAt(g, mx, my + 0.008, 0.05, 0.024, Math.atan2(y2 - y1, x2 - x1) + 0.4); } },
        { plain: true, marks: [full([108, 140, 72])] });
      const PETALS = [[248, 244, 236], [238, 168, 182], [246, 210, 96], [190, 160, 220], [248, 244, 236], [238, 168, 182]];
      add(g => { for (const [x, y] of pts) for (let p = 0; p < 5; p++) { const a = p * TAU / 5 - 0.3; discAt(g, x + Math.cos(a) * 0.034, y + Math.sin(a) * 0.03, 0.032); } },
        { casts: true, marks: [...pts.map(([x, y], k) => [PETALS[k], 1, 0.008, g => discAt(g, x, y, 0.075)]),
          ...pts.map(([x, y]) => [[232, 170, 60], 1, 0.006, g => discAt(g, x, y, 0.02)])] });
    } else if (HAT === 'cheese') {                                  // melted cheese: a golden cap sliding down over the hood, drips hanging off its edge
      const CHEESE = [246, 188, 62], x0 = bx, yc = cy - 0.19, W = side ? 0.24 : 0.28;
      add(g => {
        ovalAt(g, x0, yc, W, 0.135);                                // the cap, domed over the crown
        ovalAt(g, x0 - W * 0.8, yc + 0.1, 0.11, 0.1);               // its edges slumped down over the hood
        ovalAt(g, x0 + W * 0.8, yc + 0.09, 0.11, 0.11);
        for (const [dx, len, w] of [[W * 0.7, 0.26, 0.042], [W * 0.3, 0.14, 0.036], [-W * 0.62, 0.2, 0.04]]) {
          const y0 = yc + 0.04, y1 = y0 + len;
          limbAt(g, x0 + dx, y0, w, x0 + dx, y1, w * 0.7); discAt(g, x0 + dx, y1, w * 0.85);
        }
      }, { casts: true, marks: [full(CHEESE),
        [[255, 240, 168], 0.9, 0.03, g => ovalAt(g, x0 - W * 0.4, yc - 0.075, 0.12, 0.034, -0.2)],   // a glossy sheen on the top
        [[204, 124, 40], 0.75, 0.02, g => { discAt(g, x0 + W * 0.45, yc + 0.03, 0.022); discAt(g, x0 - W * 0.2, yc + 0.07, 0.018); discAt(g, x0 + W * 0.9, yc + 0.02, 0.016); }],   // browned bubbles
        ...snowOn(g => ovalAt(g, x0, yc - 0.11, W * 0.8, 0.02 + 0.02 * SNOWED), 0.02)] });
    }
  };
  const shoulder = side ? 0.0 : 0.15;
  if (side) {
    leg(1, true); if (P.kneeOver) leg(0, false, 'thigh'); else leg(0, false);
    arm(0.03, P.arms ? P.arms[0] : P.stoop ? 0.75 * P.stoop : -P.swing, true, false);
    cloak(); satchel(); if (P.kneeOver) leg(0, false, 'shin');   // (sneaking, the near knee lifted high under the cloak's front)
    tip(); head(); hat();
    if (P.hug) hug(-0.01, 0);
    else arm(-0.01, P.arms ? P.arms[1] : P.hand ? 0.9 : P.stoop ? 0.95 * P.stoop : P.swing, false, true);
  } else {
    const [a, b] = P.feet[0][1] > P.feet[1][1] ? [1, 0] : [0, 1];
    leg(a, false); leg(b, false);
    if (front) {
      tip();
      cloak(); satchel();
      if (P.sit) add(g => { for (const [x, y] of P.knees) ovalAt(g, x, y, 0.072, 0.06); },   // (sitting: its knees out toward you from under the cloak)
        { casts: true, marks: [[TROUSER, 1, 0.012, g => g.rect(-1, -1, 2, 2)], [tone(TROUSER, 1.18), 0.7, 0.03, g => { for (const [x, y] of P.knees) ovalAt(g, x - 0.01, y - 0.025, 0.04, 0.02); }]] });
      const reach = 1.1 * P.stoop;
      if (P.hug) { hug(-shoulder, 0); hug(shoulder, 1); }
      else {
        const [hl, hr] = P.hands || [];
        if (!P.up) arm(-shoulder, P.stoop ? reach : P.swing, false, true, hl); if (!P.eat && !P.up) arm(shoulder, P.hand ? 2.4 : P.stoop ? reach : -P.swing, false, true, hr);
      }
      head(); hat();
      if (P.up) arm(-shoulder, 0, false, true, P.hands[0]);       // (sipping: both mittens up over its face)
      if (P.eat || P.up) arm(shoulder, 0, false, true, P.hands[1]);   // (eating: the mitten up in front of its chin)
    } else {
      // (An arm swung forward is ahead of it, behind the cloak from here: only the one swung back shows over it.)
      const al = P.carry ? 1.2 : P.stoop ? 1.1 * P.stoop : P.swing, ar = P.carry ? 1.2 : P.stoop ? 1.1 * P.stoop : -P.swing;   // (carrying: both out ahead)
      if (P.hug) { hug(-shoulder, 0); hug(shoulder, 1); }
      else { if (al > 0) arm(-shoulder, al, true, false); if (ar > 0) arm(shoulder, ar, true, false); }
      cloak(); satchel();
      if (!P.hug) { if (al <= 0) arm(-shoulder, al, false, true); if (ar <= 0) arm(shoulder, ar, false, true); }
      head(); tip(); hat();
    }
  }
  return { parts, fx, fy, frx, fry };
}

function paintForager(g, size, U, n) {
  let P;
  if (n >= CARRY_AT) {                                           // (carrying a dish: carryArt)
    n -= CARRY_AT;
    SNOWED = Math.floor(n / FORAGER_SNOW_ARTS); n %= FORAGER_SNOW_ARTS;
    wear(n >> 7);
    P = carryPose((n >> 5) & 3, n & 31);
  } else if (n >= EMOTE_AT) {                                           // (an emote: emoteArt)
    const e = n - EMOTE_AT, k = e >> 5;
    SNOWED = Math.floor(k / FORAGER_OUTFITS.length); wear(k % FORAGER_OUTFITS.length);
    P = emotePose(e & 31);
  } else {
    SNOWED = Math.floor(n / FORAGER_SNOW_ARTS); n %= FORAGER_SNOW_ARTS;
    wear(n >> 7);
    P = ((n >> 5) & 3) === 3 && (n & 31) < 16 ? idlePose(n & 31) : foragerPose((n >> 5) & 3, n & 31);   // ('view' 3: standing a while, poses 0 to 15; kneeling side on, 16 up)
  }
  paintPose(g, size, U, P);
}
// The face in the corner (game.js renderVitals): standing from the front in outfit o, with snow s on it, looking mood.
const FACE_MOODS = {
  well: {}, cosy: { warm: true }, happy: { happy: true }, cold: { sad: true, look: 0.025 },
  hungry: { sad: true, yawn: true }, hurt: { sad: true, blink: true }, winded: { blow: true, blink: true },
};
function paintForagerFace(g, size, U, o, s, mood) {
  SNOWED = s; wear(o);
  paintPose(g, size, U, Object.assign(foragerPose(1, 0), FACE_MOODS[mood]));
}
function paintPose(g, size, U, P) {
  const view = P.view, { parts, fx, fy } = foragerParts(P);
  paintFur(g, size, U, parts, { coat: CLOAK, top: -0.5, shade: FORAGER_SHADE, light: FORAGER_LIGHT, flat: 0.25,
    grain: [['rgba(40,30,20,0.03)', 1, 3], ['rgba(255,245,225,0.03)', 1, 3]],
    face: g => {
      if (view === 2) return;
      const eyes = view === 0 ? [[fx - 0.075, fy + 0.0]] : [[fx - 0.085, fy + 0.0], [fx + 0.06, fy + 0.005]];
      const mid = view === 0 ? fx : fx - 0.012;                  // (between the eyes: their inner sides face it)
      for (const [x, y] of eyes) {
        if (P.warm) strokeIn(g, '#3a2a22', 0.016, () => { g.moveTo(x - 0.024, y + 0.006); g.quadraticCurveTo(x, y - 0.016, x + 0.024, y + 0.006); });   // (shut, smiling)
        else if (P.blink) strokeIn(g, '#3a2a22', 0.016, () => { g.moveTo(x - 0.024, y); g.quadraticCurveTo(x, y + 0.018, x + 0.024, y); });
        else if (P.happy) strokeIn(g, '#3a2a22', 0.016, () => { g.moveTo(x - 0.024, y + 0.008); g.quadraticCurveTo(x, y - 0.018, x + 0.024, y + 0.008); });   // shut, smiling
        else if (P.sly) {                                        // narrowed under a heavy lid, the brow down toward the nose: up to something
          const s = view === 0 ? -1 : x < mid ? 1 : -1;          // (s: the side the nose is on)
          fillIn(g, '#2a1d17', () => { g.moveTo(x - 0.024, y + 0.002); g.quadraticCurveTo(x, y + 0.034, x + 0.024, y + 0.002); g.quadraticCurveTo(x, y - 0.002 + s * 0.006, x - 0.024, y + 0.002); g.closePath(); });
          fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, x + s * 0.006, y + 0.012, 0.006));
          strokeIn(g, '#3a2a22', 0.013, () => { g.moveTo(x - s * 0.03, y - 0.004 - 0.008); g.lineTo(x + s * 0.026, y + 0.006); });   // the lid
          strokeIn(g, rockRGB(tone(HAIR, 0.8), 0.95), 0.016, () => { g.moveTo(x - s * 0.032, y - 0.058); g.quadraticCurveTo(x, y - 0.05, x + s * 0.03, y - 0.03); });   // the brow
        } else {
          const dx = P.turn * 0.012, dy = P.look * 0.2;
          fillIn(g, '#2a1d17', () => ovalAt(g, x + dx, y + dy, 0.022, P.sad ? 0.026 : 0.03));
          fillIn(g, 'rgba(255,255,255,0.9)', () => discAt(g, x - 0.008 + dx, y - 0.01 + dy, 0.008));
        }
        if (P.sad) {                                             // worried: the brows up where they meet
          const s = x < mid ? 1 : -1;
          strokeIn(g, rockRGB(tone(HAIR, 0.8), 0.9), 0.013, () => { g.moveTo(x - s * 0.028, y - 0.04); g.quadraticCurveTo(x, y - 0.05, x + s * 0.022, y - 0.062); });
        }
      }
      const cheeks = view === 0 ? [[fx - 0.04, fy + 0.07]] : [[fx - 0.105, fy + 0.07], [fx + 0.085, fy + 0.07]];
      for (const [x, y] of cheeks) furGlow(g, CHEEK, P.sad ? 0.3 : P.blow ? 0.8 : P.warm ? 0.7 : 0.55, x, y, P.blow ? 0.052 : 0.04, P.blow ? 0.036 : 0.026);   // (cold, paler; blowing, puffed out)
      const mx = view === 0 ? fx - 0.115 : fx - 0.015, my = fy + 0.085;
      if (P.eat === 1) {                                        // a bite on its way in: the mouth open, a crumb of something held to it
        fillIn(g, 'rgba(110,52,44,0.9)', () => ovalAt(g, mx, my + 0.008, 0.019, 0.022));
        softIn(g, [196, 132, 70], my - 0.005, my + 0.05, () => ovalAt(g, mx + 0.012, my + 0.03, 0.034, 0.026, 0.3), 1.2, 0.7);
        fillIn(g, 'rgba(255,236,200,0.6)', () => ovalAt(g, mx + 0.002, my + 0.02, 0.012, 0.007, 0.3));
      } else if (P.eat) {                                       // munching: lips pressed in a wobbly line, a cheek puffed out
        const s = P.eat === 2 ? 1 : -1, cx = view === 0 ? fx - 0.05 : s > 0 ? fx + 0.085 : fx - 0.105;
        furGlow(g, CHEEK, 0.9, cx, fy + 0.075, 0.062, 0.045);
        strokeIn(g, 'rgba(120,64,50,0.85)', 0.013, () => { g.moveTo(mx - 0.018, my + 0.004 * s); g.quadraticCurveTo(mx - 0.006, my + 0.012, mx, my + 0.004); g.quadraticCurveTo(mx + 0.008, my - 0.004, mx + 0.018, my + 0.006 - 0.004 * s); });
      } else if (P.yawn) fillIn(g, 'rgba(110,52,44,0.9)', () => ovalAt(g, mx, my + 0.012, 0.02, 0.028));   // a yawn
      else if (P.blow) fillIn(g, 'rgba(110,52,42,0.85)', () => ovalAt(g, mx - 0.006, my + 0.004, 0.012, 0.015));   // lips pursed, blowing
      else if (P.goof) {                                         // goofy: a big open grin, the tongue lolling out of it
        fillIn(g, 'rgba(110,50,42,0.92)', () => { g.moveTo(mx - 0.04, my - 0.01); g.quadraticCurveTo(mx, my + 0.075, mx + 0.04, my - 0.01); g.quadraticCurveTo(mx, my + 0.002, mx - 0.04, my - 0.01); g.closePath(); });
        fillIn(g, 'rgba(250,244,236,0.95)', () => ovalAt(g, mx, my + 0.001, 0.028, 0.008));
        fillIn(g, 'rgb(230,118,128)', () => ovalAt(g, mx + 0.012, my + 0.05, 0.02, 0.025));
      } else if (P.happy || P.grin) fillIn(g, 'rgba(120,64,50,0.85)', () => { g.moveTo(mx - 0.022, my - 0.002); g.quadraticCurveTo(mx, my + 0.034, mx + 0.022, my - 0.002); g.closePath(); });   // a wide smile
      else if (P.sly) fillIn(g, 'rgba(120,64,50,0.85)', () => { const s = view === 0 ? 1 : -1; g.moveTo(mx - s * 0.026, my - 0.014); g.quadraticCurveTo(mx - s * 0.004, my + 0.026, mx + s * 0.02, my + 0.004); g.quadraticCurveTo(mx, my + 0.008, mx - s * 0.026, my - 0.014); g.closePath(); });   // a smirk, up at one corner
      else if (P.sad) strokeIn(g, 'rgba(120,64,50,0.8)', 0.012, () => { g.moveTo(mx - 0.015, my + 0.01); g.quadraticCurveTo(mx, my - 0.006, mx + 0.015, my + 0.01); });   // a little frown
      else if (P.warm) strokeIn(g, 'rgba(120,64,50,0.8)', 0.013, () => { g.moveTo(mx - 0.02, my - 0.003); g.quadraticCurveTo(mx, my + 0.02, mx + 0.02, my - 0.003); });   // a bigger smile
      else strokeIn(g, 'rgba(120,64,50,0.8)', 0.012, () => { g.moveTo(mx - 0.016, my); g.quadraticCurveTo(mx, my + 0.014, mx + 0.016, my); });
      if (view === 0) fillIn(g, P.sad ? rockRGB(COLD_NOSE) : rockRGB(tone(SKIN, 0.92)), () => ovalAt(g, fx - 0.155, fy + 0.035, 0.022, 0.018));   // the nose, just past the cheek
      else if (P.sad) furGlow(g, CHEEK, 0.7, fx - 0.012, fy + 0.045, 0.022, 0.016);   // cold, a red nose
    } });
}

const painters = { fox: paintFox, rabbit: paintRabbit, dfly: paintDragonfly, kfisher: paintKingfisher, lark: paintSkylark, forager: paintForager };

root.Fur = { tone, rockRGB, fillIn, strokeIn, discAt, ovalAt, blurIn, softIn, furGlow, foxRGB, FOX_WHITE, FOX_SOCK,
  FOX_POSE, RABBIT_POSE, RABBIT_KINDS, setCoats, paintFox, paintRabbit, paintForager, paintForagerFace, FACE_MOODS, FORAGER_REACH, FORAGER_JOG_STRIDE, FORAGER_OUTFITS, FORAGER_CLOAKS, FORAGER_HATS, outfitOf, FORAGER_COLD, FORAGER_IDLE, FORAGER_IDLES, FORAGER_SNOWS, FORAGER_SNOW_ARTS, KNEEL_VIEW, FORAGER_KNEEL,
  FORAGER_EMOTE, FORAGER_EMOTES, FORAGER_EMOTE_ARTS, FORAGER_EAT, FORAGER_EATS, FORAGER_SIT_EAT, FORAGER_SIT_EATS, EMOTE_AT, emoteArt, CARRY_AT, FORAGER_CARRY_ARTS, CARRY_STRIDE, carryArt, SNEAK_STRIDE, painters };
})(typeof window !== 'undefined' ? window : globalThis);
