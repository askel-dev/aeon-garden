// The drying rack as it is now, copied unchanged from game.js (2026-10-21).
const RACK_SIZE = 1.6, RACK_FOOT = 0.6;
function paintRack(g, size, U, n) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  g.translate(0, RACK_FOOT);
  const P = campAt3, wood = RACK_WOOD, grass = RACK_GRASS, food = n === 1;
  const XL = -0.72, XR = 0.72, DF = -0.26, DB = 0.26, H = 0.46, HB = 0.92;   // its posts' feet, its bed's height, and the back posts' (the roof's)
  // Its shadow: soft under it all, and the mat's darker on the ground a little to the right, out of the light.
  furGlow(g, [40, 30, 16], 0.34, 0.06, -0.01, 1.02, 0.26, 0, 0.3);
  fillIn(g, 'rgba(36, 26, 14, 0.1)', () => { const a = P(XL + 0.08, DF, 0), b = P(XR + 0.14, DF, 0), c = P(XR + 0.14, DB, 0), d = P(XL + 0.08, DB, 0); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); });
  for (const [x, d, i] of [[XL, DB, 0], [XR, DB, 1], [XL, DF, 2], [XR, DF, 3]]) { const [fx, fy] = P(x, d, 0); campFoot(g, fx, fy, 0.05, 40 + i); }
  // The back posts, tall to hold the roof, and the bar across them the mat's back rests on.
  for (const [x, i] of [[XL, 0], [XR, 1]]) { const [fx, fy] = P(x, DB, 0); campFork(g, fx, fy, HB, 0.05, wood, 10 + i); }
  { const [x0, y0] = P(XL - 0.13, DB, H), [x1, y1] = P(XR + 0.12, DB, H); campPole(g, x0, y0, x1, y1, 0.046, tone(wood, 0.92), 20, true); }
  // The bark roof: a bar across the back posts' forks, and two strips of birch bark laid from it forward and down, overlapping.
  { const [x0, y0] = P(XL - 0.12, DB, HB), [x1, y1] = P(XR + 0.14, DB, HB); campPole(g, x0, y0, x1, y1, 0.044, wood, 21, true); }
  const sheet = (xa, xb, s) => birchSheet(g, [...P(xa, DB + 0.04, HB + 0.04), ...P(xb, DB + 0.04, HB + 0.04), ...P(xb + 0.02, DB - 0.12, HB - 0.1), ...P(xa - 0.02, DB - 0.12, HB - 0.1)], s, true, 0.035, 0.03);
  sheet(-0.86, 0.08, 31); sheet(-0.06, 0.88, 32);
  for (const x of [XL, XR]) { const [lx, ly] = P(x, DB, HB); campLash(g, lx, ly - 0.01, 0.045); }
  // Hung from the roof's front edge: with food on it, a string of rosehips and a bunch of herbs drying; empty, a bare loop of cord.
  const hang = (x, drop) => { const [hx, hy] = P(x, DB - 0.12, HB - 0.1); return [hx, hy, hy + drop]; };
  if (food) {
    const [x0, y0] = P(-0.5, DB - 0.12, HB - 0.1), [x1, y1] = P(0.0, DB - 0.12, HB - 0.1), mx = (x0 + x1) / 2, my = Math.max(y0, y1) + 0.2;
    strokeIn(g, rockRGB(RACK_INK, 0.9), 0.012, () => { g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); });
    for (let i = 1; i < 10; i++) {                         // the rosehips threaded along it
      const t = i / 10, u = 1 - t, x = u * u * x0 + 2 * u * t * mx + t * t * x1, y = u * u * y0 + 2 * u * t * my + t * t * y1 + 0.012;
      const rgb = i % 3 === 1 ? [168, 36, 50] : [214, 66, 42];
      fillIn(g, rockRGB(tone(rgb, 0.5)), () => ovalAt(g, x, y, 0.036, 0.042));
      softIn(g, rgb, y - 0.035, y + 0.035, () => ovalAt(g, x, y, 0.03, 0.036), 1.3, 0.7);
      fillIn(g, 'rgba(255, 236, 220, 0.8)', () => discAt(g, x - 0.01, y - 0.014, 0.008));
    }
    const [bx, by, bt] = hang(0.42, 0.24);                 // the herbs, hung head down by their stalks
    strokeIn(g, rockRGB(RACK_INK, 0.9), 0.012, () => { g.moveTo(bx, by); g.lineTo(bx + 0.005, by + 0.05); });
    strokeIn(g, rockRGB([92, 120, 52]), 0.014, () => { for (let i = -2; i <= 2; i++) { g.moveTo(bx + i * 0.008, by + 0.05); g.quadraticCurveTo(bx + i * 0.03, by + 0.14, bx + i * 0.045, bt); } });
    for (let i = 0; i < 9; i++) {
      const t = 0.3 + 0.7 * hash2(i, 1, 801), s = (hash2(i, 2, 803) - 0.5) * 2, x = bx + s * 0.05 * t, y = by + 0.05 + (bt - by - 0.05) * t;
      fillIn(g, rockRGB(tone([110, 146, 64], 0.75 + 0.4 * hash2(i, 3, 807))), () => ovalAt(g, x + s * 0.02, y, 0.03, 0.013, 1.2 + s * 0.6));
    }
    strokeIn(g, rockRGB([200, 162, 104]), 0.016, () => { g.moveTo(bx - 0.03, by + 0.05); g.lineTo(bx + 0.035, by + 0.055); });
  } else {
    const [bx, by] = hang(-0.24, 0);
    strokeIn(g, rockRGB(RACK_INK, 0.85), 0.012, () => { g.moveTo(bx - 0.04, by); g.quadraticCurveTo(bx - 0.03, by + 0.14, bx + 0.02, by + 0.1); g.quadraticCurveTo(bx + 0.05, by + 0.06, bx + 0.04, by); });
  }
  // The front bar the mat's front edge lies on.
  { const [x0, y0] = P(XL - 0.14, DF, H), [x1, y1] = P(XR + 0.13, DF, H); campPole(g, x0, y0, x1, y1, 0.05, wood, 22, true); }
  // Slats laid from bar to bar under the mat, their ends showing past the front bar.
  for (let i = 0; i < 6; i++) {
    const x = lerp(XL + 0.1, XR - 0.1, i / 5) + (hash2(i, 4, 809) - 0.5) * 0.04, [x0, y0] = P(x, DF - 0.03, H + 0.035), [x1, y1] = P(x + 0.02, DB + 0.04, H + 0.035);
    campPole(g, x0, y0, x1, y1, 0.026, tone(wood, 1.1), 50 + i, false);
  }
  // The mat of dry grass over them: its stalks running front to back, a fringe of their ends over the front, two cords across.
  const M = [...P(XL - 0.04, DF + 0.02, H + 0.05), ...P(XR + 0.04, DF + 0.02, H + 0.05), ...P(XR + 0.04, DB - 0.02, H + 0.05), ...P(XL - 0.04, DB - 0.02, H + 0.05)];
  const mat = () => { g.moveTo(M[0], M[1]); g.lineTo(M[2], M[3]); g.lineTo(M[4], M[5]); g.lineTo(M[6], M[7]); g.closePath(); };
  strokeIn(g, rockRGB(tone(grass, 0.45), 0.9), 0.03, mat);
  softIn(g, grass, M[5], M[1], mat, 1.08, 0.8);
  g.save(); g.beginPath(); mat(); g.clip();
  for (let i = 0; i < 64; i++) {
    const x = lerp(XL - 0.06, XR + 0.06, (i + hash2(i, n + 7, 811)) / 64), w0 = (hash2(i, 5, 813) - 0.5) * 0.06;
    const [x0, y0] = P(x + w0, DF - 0.02, H + 0.05), [x1, y1] = P(x - w0 + (hash2(i, 6, 817) - 0.5) * 0.05, DB + 0.02, H + 0.05);
    strokeIn(g, rockRGB(tone(grass, 0.7 + 0.55 * hash2(i, 7, 819), hash2(i, 8, 821) > 0.8 ? 16 : 0), 0.9), 0.012 + 0.008 * hash2(i, 9, 823), () => { g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + w0 * 0.3, (y0 + y1) / 2, x1, y1); });
  }
  furGlow(g, tone(grass, 0.45), 0.4, M[4] - 0.1, (M[5] + M[7]) / 2 + 0.02, 0.9, 0.05);   // (shaded under the roof at the back)
  g.restore();
  for (const d of [DF + 0.08, DB - 0.09]) {                // the cords lashing it down
    const [x0, y0] = P(XL - 0.02, d, H + 0.055), [x1, y1] = P(XR + 0.02, d, H + 0.055);
    strokeIn(g, rockRGB(RACK_INK, 0.75), 0.022, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
    strokeIn(g, rockRGB([170, 130, 80]), 0.011, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
  }
  strokeIn(g, rockRGB(tone(grass, 0.62), 0.95), 0.012, () => {   // the fringe of stalk ends over the front bar, and a few loose
    for (let i = 0; i < 30; i++) {
      const [x, y] = P(lerp(XL - 0.04, XR + 0.04, (i + 0.5) / 30) + (hash2(i, 10, 827) - 0.5) * 0.03, DF + 0.02, H + 0.05), l = 0.04 + 0.06 * hash2(i, 11, 829), a = (hash2(i, 12, 831) - 0.5) * 0.5;
      g.moveTo(x, y - 0.01); g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l);
    }
  });
  strokeIn(g, rockRGB(tone(grass, 1.12, 10), 0.95), 0.01, () => {
    for (let i = 0; i < 18; i++) {
      const [x, y] = P(lerp(XL, XR, (i + 0.3) / 18), DF + 0.02, H + 0.05), l = 0.03 + 0.05 * hash2(i, 13, 833), a = (hash2(i, 14, 837) - 0.5) * 0.6;
      g.moveTo(x, y - 0.012); g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l);
    }
  });
  // Food laid on it to dry: cep caps, apple rings, and slices of root, each with its soft shadow on the mat, laid back to front
  // so the nearer ones lap over.
  if (food) {
    const lay = (x, d) => P(x, d, H + 0.05);
    const shade = (cx, cy, rx, ry) => furGlow(g, [70, 46, 20], 0.5, cx + rx * 0.22, cy + ry * 0.55, rx * 1.15, ry * 0.9, 0, 0.35);
    const ring = (cx, cy, k, s) => {                         // an apple ring, curling as it dries: red skin, pale flesh, browning in, the hole
      const rx = 0.078 * k, ry = 0.045 * k;
      shade(cx, cy, rx, ry);
      fillIn(g, rockRGB([112, 30, 26]), () => ovalAt(g, cx, cy + 0.006 * k, rx + 0.006, ry + 0.006, s));   // (its rim's thickness)
      softIn(g, [186, 48, 38], cy - ry, cy + ry, () => ovalAt(g, cx, cy, rx, ry, s), 1.3, 0.75);
      softIn(g, [244, 228, 184], cy - ry, cy + ry, () => ovalAt(g, cx, cy - 0.003, rx * 0.82, ry * 0.8, s), 1.08, 0.82);
      strokeIn(g, 'rgba(196, 150, 90, 0.55)', 0.008 * k, () => ovalAt(g, cx, cy - 0.003, rx * 0.5, ry * 0.48, s));   // (browning round the core)
      fillIn(g, rockRGB(tone(grass, 0.62)), () => ovalAt(g, cx, cy - 0.002, rx * 0.26, ry * 0.26, s));
      fillIn(g, rockRGB([96, 58, 30]), () => { ovalAt(g, cx - rx * 0.4, cy - 0.004, 0.008 * k, 0.005 * k, s); ovalAt(g, cx + rx * 0.4, cy, 0.008 * k, 0.005 * k, s); });
      furGlow(g, [255, 252, 240], 0.6, cx - rx * 0.4, cy - ry * 0.45, rx * 0.3, ry * 0.18, -0.2);
    };
    const cap = (cx, cy, r, s) => {                          // a cep's cap, domed: its pale rim of pores under, the light on its crown
      const ry = r * 0.62;
      shade(cx, cy, r, ry);
      fillIn(g, rockRGB([214, 196, 128]), () => ovalAt(g, cx + 0.004, cy + ry * 0.3, r * 0.96, ry * 0.8, s));   // (the pores, peeping out under)
      fillIn(g, rockRGB(tone([120, 74, 38], 0.62)), () => ovalAt(g, cx, cy, r + 0.008, ry + 0.008, s));
      softIn(g, [154, 98, 52], cy - ry, cy + ry, () => ovalAt(g, cx, cy, r, ry, s), 1.3, 0.66);
      furGlow(g, [255, 238, 210], 0.55, cx - r * 0.3, cy - ry * 0.4, r * 0.42, ry * 0.32, -0.3);
      fillIn(g, 'rgba(255, 246, 228, 0.85)', () => ovalAt(g, cx - r * 0.38, cy - ry * 0.45, r * 0.12, ry * 0.08, -0.3));
    };
    const root = (cx, cy, k, s) => {                         // a slice of root: its rind round the side, the cut face with its rings and pale heart
      const rx = 0.05 * k, ry = 0.03 * k;
      shade(cx, cy, rx, ry);
      fillIn(g, rockRGB([118, 72, 36]), () => ovalAt(g, cx, cy + 0.008 * k, rx, ry, s));
      softIn(g, [226, 156, 84], cy - ry, cy + ry, () => ovalAt(g, cx, cy, rx * 0.94, ry * 0.92, s), 1.2, 0.8);
      strokeIn(g, 'rgba(176, 102, 46, 0.7)', 0.006 * k, () => ovalAt(g, cx, cy, rx * 0.6, ry * 0.58, s));
      fillIn(g, rockRGB([248, 214, 156]), () => ovalAt(g, cx, cy, rx * 0.3, ry * 0.3, s));
      furGlow(g, [255, 248, 230], 0.5, cx - rx * 0.4, cy - ry * 0.4, rx * 0.3, ry * 0.2);
    };
    const FOOD = [[cap, -0.6, 0.1, 0.105, 0.1], [cap, -0.4, 0.0, 0.08, -0.2], [cap, -0.54, -0.14, 0.07, 0.3], [cap, -0.27, -0.17, 0.055, 0],
      [ring, -0.12, 0.1, 1, 0], [ring, -0.02, -0.02, 0.9, 0.12], [ring, 0.12, 0.12, 1.05, -0.1], [ring, -0.14, -0.15, 0.85, 0.05], [ring, 0.14, -0.16, 0.95, -0.08],
      [root, 0.36, 0.06, 1.1, 0.2], [root, 0.44, -0.06, 0.9, -0.2], [root, 0.58, 0.12, 1, 0.1], [root, 0.38, -0.18, 0.8, 0.3], [root, 0.62, -0.08, 1.15, -0.1], [root, 0.52, 0.02, 0.75, 0.4]];
    FOOD.sort((p, q) => q[2] - p[2]);
    for (const [paint, x, d, k, a] of FOOD) { const [cx, cy] = lay(x, d); paint(cx, cy, k, a); }
  }
  // The front posts, their forks holding the front bar, a lashing on each.
  for (const [x, i] of [[XL, 0], [XR, 1]]) { const [fx, fy] = P(x, DF, 0); campFork(g, fx, fy, H, 0.054, wood, 12 + i); const [lx, ly] = P(x, DF, H); campLash(g, lx, ly, 0.045); }
  // A few chips of bark and a stalk or two dropped on the ground, a tuft at its feet.
  for (const [x, d, a] of [[-0.4, -0.42, 0.4], [0.3, -0.4, -0.6], [0.92, 0.0, 0.2]]) { const [cx, cy] = P(x, d, 0); fillIn(g, rockRGB(tone(RACK_BARK, 0.9)), () => ovalAt(g, cx, cy, 0.04, 0.016, a)); fillIn(g, rockRGB([196, 130, 80], 0.9), () => ovalAt(g, cx + 0.004, cy + 0.008, 0.032, 0.007, a)); }
  strokeIn(g, rockRGB(tone(grass, 0.9)), 0.012, () => { for (const [x, d, a] of [[-0.1, -0.4, 0.3], [0.1, -0.44, -1.2], [-0.86, -0.3, 1.0]]) { const [cx, cy] = P(x, d, 0); g.moveTo(cx - Math.cos(a) * 0.07, cy - Math.sin(a) * 0.02); g.lineTo(cx + Math.cos(a) * 0.07, cy + Math.sin(a) * 0.02); } });
  strokeIn(g, rockRGB([96, 146, 60]), 0.014, () => { for (const [x, d, a, h] of [[XL - 0.1, DF, -0.4, 0.1], [XL - 0.06, DF - 0.02, 0.1, 0.13], [XR + 0.08, DF, 0.3, 0.11], [XR + 0.12, DF + 0.02, 0.7, 0.08]]) { const [cx, cy] = P(x, d, 0); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * h, cy - Math.cos(a) * h); } });
}
