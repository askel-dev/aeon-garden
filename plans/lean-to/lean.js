// A simpler lean-to: the same box, frame and slope as game.js paintLean (so it drops in for it: LEAN_SIZE, LEAN_FOOT, its
// mouth opening left), but painted in a few big shapes. One plane of thatch in three courses in place of six rows and the
// birch shingles, three poles, the dark under it, a little straw spilt at its mouth, one stone and some grass at its foot.
// Lit from the top left as the trees are: the ridge catches the light, the foot sinks into its own shade, and the lines
// are soft, the courses lapping in bundles.
function paintLeanSimple(g, size, U) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  g.translate(0, LEAN_FOOT);
  const P = campAt3, wood = LEAN_WOOD, straw = LEAN_THATCH, h = (i, k) => hash2(i, k, 853);
  const XM = -0.8, XF = 0.88, DN = -0.36, DB = 0.36, HR = 1.0;   // its mouth (the ridge's line), its roof's foot, near and far, the ridge's height
  const R = (u, v, lift = 0) => P(lerp(XM - 0.05, XF + 0.08, u), lerp(DN - 0.07, DB + 0.07, v), lerp(HR + 0.04, 0.02, u) + lift);
  const COURSES = [0.34, 0.67];              // where each course of thatch laps over the one below
  const GRASS = [96, 146, 60];
  const quad = (a, b, c, d) => { g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); };
  const tuft = (x, y, n, l, s) => { for (let i = 0; i < n; i++) { const a = (i / (n - 1 || 1) - 0.5) * 1.3 + (h(s, 60 + i) - 0.5) * 0.3, k = l * (0.7 + 0.5 * h(s, 70 + i)); g.moveTo(x + (i - n / 2) * 0.012, y); g.quadraticCurveTo(x + Math.sin(a) * k * 0.4, y - k * 0.6, x + Math.sin(a) * k, y - Math.cos(a) * k); } };
  // Its shadow on the ground: a wide soft one under it all, falling a little right as the trees' do, and darker close in.
  furGlow(g, [40, 30, 16], 0.32, ...P(0.02, 0.04, 0), 1.08, 0.4, 0, 0.25);
  furGlow(g, [40, 30, 16], 0.3, ...P(0.0, 0.0, 0), 0.95, 0.24, 0, 0.4);
  // Trodden ground at its mouth, catching the light.
  furGlow(g, tone(straw, 0.75), 0.45, ...P(XM - 0.05, (DN + DB) / 2 - 0.05, 0), 0.42, 0.14, -0.1, 0.25);
  // The dark under its roof, and deepest at the back.
  { const [, y0] = P(XM, DB, HR), gr = g.createLinearGradient(0, y0, 0, 0.1);
    gr.addColorStop(0, 'rgb(34, 25, 16)'); gr.addColorStop(1, 'rgb(78, 57, 36)');
    g.fillStyle = gr; g.beginPath(); quad(P(XM, DN, 0), P(XM, DN, HR), P(XM, DB, HR), P(XF, DB, 0)); g.lineTo(...P(XF, DN, 0)); g.closePath(); g.fill(); }
  { const [fx, fy] = P(XM, DB, 0); campFork(g, fx, fy, HR, 0.05, tone(wood, 0.6), 70); }   // (the back upright, in the dark)
  furGlow(g, [26, 18, 10], 0.6, ...P(XM + 0.7, DB * 0.4, 0), 0.6, 0.18, 0.1, 0.35);
  furGlow(g, tone(straw, 0.6), 0.35, ...P(XM + 0.22, DN + 0.2, 0), 0.3, 0.07, -0.1, 0.2);   // (the light reaching in at the mouth)
  // A little straw spilt from the thatch about its mouth, lying every way: some under the roof, some out on the ground.
  for (const [k, col] of [[0, tone(straw, 0.7)], [1, tone(straw, 1.05, 6)]]) strokeIn(g, rockRGB(col, 0.9), 0.011, () => {
    for (let i = 0; i < 9; i++) {
      const s = i * 2 + k, [x, y] = P(lerp(XM - 0.42, XM + 0.32, h(s, 20)), lerp(DN - 0.06, DB - 0.05, h(s, 21)), 0), a = (h(s, 22) - 0.5) * 2.4, l = 0.035 + 0.035 * h(s, 23);
      g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l * 0.4); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4);
    }
  });
  // Three poles leaning from the ridge to the ground, their tops poking out over it.
  for (const v of [0.08, 0.5, 0.92]) { const [x0, y0] = R(0.96, v, 0.015), [x1, y1] = R(-0.08, v, 0.03); campPole(g, x1, y1, x0, y0, 0.044, tone(wood, 0.85), 80 + v * 10 | 0, true); }
  // The thatch: one plane down the slope, lit at the ridge and darker to its foot, under a thin soft edge.
  const roof = () => quad(R(0.02, -0.02, 0.05), R(0.02, 1.02, 0.05), R(1.02, 1.02, 0.05), R(1.02, -0.02, 0.05));
  const slope = Math.atan2(R(0, 1)[1] - R(0, 0)[1], R(0, 1)[0] - R(0, 0)[0]);
  { const [, ya] = R(0, 1, 0.05), [, yb] = R(1, 0, 0.05);
    strokeIn(g, rockRGB(tone(straw, 0.5), 0.6), 0.016, roof);
    softIn(g, straw, ya, yb, roof, 1.22, 0.66); }
  g.save(); g.beginPath(); roof(); g.clip();
  furGlow(g, tone(straw, 1.3, 18), 0.55, ...R(0.12, 0.55, 0.05), 1.0, 0.12, slope, 0.2);   // (the sun along the ridge)
  furGlow(g, tone(straw, 0.5), 0.4, ...R(0.95, 0.35, 0.05), 0.9, 0.16, slope, 0.1);         // (the foot, in its own shade)
  // Its straws, long and few, of a softer light and dark than before.
  for (let i = 0; i < 50; i++) {
    const v = (i + h(i, 4)) / 50, u0 = 0.03 + 0.6 * h(i, 5), [x0, y0] = R(u0, v, 0.05), [x1, y1] = R(Math.min(1.02, u0 + 0.3 + 0.3 * h(i, 6)), v + (h(i, 7) - 0.5) * 0.03, 0.05);
    strokeIn(g, rockRGB(tone(straw, h(i, 8) > 0.5 ? 1.14 : 0.82, h(i, 8) > 0.5 ? 10 : 0), 0.6), 0.013, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
  }
  for (const u of COURSES) furGlow(g, tone(straw, 0.45), 0.5, ...R(u + 0.035, 0.5, 0.05), 1.3, 0.05, slope);   // (in the shade of the course over it)
  g.restore();
  // Each course's lower edge: a row of bundles, each a soft bulge down the slope with a few straw ends poking out under it.
  for (const [c, u] of COURSES.entries()) {
    const n = 7, bulge = (j, du) => R(u + du + 0.026 * (0.7 + 0.6 * h(c * 20 + j, 30)), (j + 0.5) / n * 1.02 - 0.01, 0.05);
    const lip = du => { for (let j = 0; j < n; j++) { const [ax, ay] = R(u + du, j / n * 1.02 - 0.01, 0.05), [bx, by] = bulge(j, du), [ex, ey] = R(u + du, (j + 1) / n * 1.02 - 0.01, 0.05); j ? g.lineTo(ax, ay) : g.moveTo(ax, ay); g.quadraticCurveTo(bx, by, ex, ey); } };
    strokeIn(g, rockRGB(tone(straw, 0.45), 0.35), 0.016, () => lip(0.012));
    strokeIn(g, rockRGB(tone(straw, 1.2, 10), 0.8), 0.01, () => lip(0));
    strokeIn(g, rockRGB(tone(straw, 0.95), 0.7), 0.008, () => {
      for (let j = 0; j < n * 2; j++) { const s = c * 40 + j, [x, y] = R(u + 0.02, (j + h(s, 33)) / (n * 2) * 1.02, 0.05), l = 0.025 + 0.03 * h(s, 34), a = slope - Math.PI / 2 + (h(s, 35) - 0.5) * 0.5;
        g.moveTo(x, y); g.lineTo(x - Math.cos(a) * l, y - Math.sin(a) * l); }
    });
  }
  // Its near edge, the thatch's thickness, and the ridge pole along the top, tied at each end.
  { const edge = () => quad(R(0.02, -0.02, 0.07), R(1.02, -0.02, 0.05), R(1.02, -0.02, -0.02), R(0.02, -0.02, -0.02));
    const [, ea] = R(0.02, -0.02, 0.07), [, eb] = R(1.02, -0.02, -0.02);
    strokeIn(g, rockRGB(tone(straw, 0.45), 0.55), 0.014, edge);
    softIn(g, tone(straw, 0.7), ea, eb, edge, 1.15, 0.7); }
  { const [x0, y0] = R(0.02, -0.12, 0.1), [x1, y1] = R(0.02, 1.1, 0.1); campPole(g, x0, y0, x1, y1, 0.05, wood, 100, true);
    for (const v of [0.1, 0.9]) { const [lx, ly] = R(0.02, v, 0.1); campLash(g, lx, ly, 0.04, 0.3); } }
  // Its foot sunk in its own shade, the straw ends frayed onto the ground, one stone holding it down, grass up round it.
  { const [x0, y0] = R(1, -0.05), [x1, y1] = R(1, 1.05); furGlow(g, [40, 30, 16], 0.5, (x0 + x1) / 2 + 0.03, (y0 + y1) / 2 + 0.04, 0.4, 0.08, Math.atan2(y1 - y0, x1 - x0), 0.25); }
  strokeIn(g, rockRGB(tone(straw, 0.85), 0.85), 0.012, () => {
    for (let i = 0; i < 18; i++) {
      const v = (i + h(i, 11)) / 18 * 1.06 - 0.03, [x, y] = R(1.0, v, 0.03), l = 0.05 + 0.06 * h(i, 12), a = 0.42 + (h(i, 13) - 0.5) * 0.8;
      g.moveTo(x - 0.02, y - 0.012); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.8);
    }
  });
  { const [x, y] = P(XF + 0.14, lerp(DN, DB, 0.15), 0); campStone(g, x, y + 0.02, 0.075, 110); }
  for (const [k, col] of [[0, tone(GRASS, 0.8)], [1, tone(GRASS, 1.12, 8)]]) strokeIn(g, rockRGB(col), 0.013, () => {
    for (const [s, x, d, n, l] of [[1, XF + 0.12, DN - 0.02, 4, 0.1], [2, XF + 0.17, 0.0, 3, 0.08], [3, XF + 0.16, DB + 0.04, 4, 0.09], [4, XF + 0.22, DN + 0.12, 3, 0.07], [5, XM - 0.14, DN - 0.05, 4, 0.11], [6, XM + 0.2, DN - 0.1, 3, 0.07]]) {
      const [cx, cy] = P(x + k * 0.02, d, 0); tuft(cx, cy, n - k, l * (1 - k * 0.2), s * 3 + k);
    }
  });
  // The front upright at its mouth's near corner, the ridge on its fork.
  { const [fx, fy] = P(XM, DN, 0); campFoot(g, fx, fy, 0.05, 120); campFork(g, fx, fy, HR + 0.02, 0.056, wood, 121); const [lx, ly] = P(XM, DN, HR + 0.02); campLash(g, lx, ly, 0.045); }
}
