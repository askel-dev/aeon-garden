/* Nobody's Meadow — the dishes, painted. Each dish recipes.js lists that has a painting here is painted by hand in the
 * meadow's storybook style (soft-rendered, a few big shapes, readable in a 48 px slot), in a vessel that says how it was
 * made: a stick skewer, a hot stone, a carved bowl, a birch-bark cup, a flat leaf (PLAN.md stage 6, "The dishes, painted").
 * It knows nothing of the meadow: game.js puts these into the satchel's sheet (itemSheet, as 'dish:' + n, n an index into
 * NAMES) and the recipe book, and recipes.html shows them by their recipes. Loaded after fur.js, whose drawing helpers it
 * paints with. A painter paints one into a canvas size pixels square, U pixels to the box -1 to 1 (as game.js's paintItem),
 * lit from the top left. A dish with no painting here keeps its recipes.js emoji for now.
 * Painting a new one: .claude/docs/dish-painting.md (the helpers, the vessels, the steps), and dish-lab.html to look at it.
 */
(root => {
'use strict';
const { tone, rockRGB, fillIn, strokeIn, ovalAt, softIn, furGlow } = root.Fur;
const TAU = Math.PI * 2;
const rgba = (c, a = 1) => rockRGB(c, a);

// The shadow a dish sits in, soft under its middle.
const sitShadow = (g, x, y, rx, ry, a = 0.32) => furGlow(g, [60, 40, 20], a, x, y, rx, ry, 0, 0.35);

// ------------------------------------------------------------------ roast mushrooms
//
// Three mushrooms on a green stick held up slantwise: the bark left on where it's held, peeled pale along the rest, the tip
// charred. Each is upright on it, threaded through its stem: a roasted brown cap gone dark at the rim, two scorch marks across
// it where it lay in the flames, the juice glistening on top, toasted gills under the rim, and a drop of juice running off the
// lowest one.
const ROAST_CAP = [[166, 102, 54], [150, 90, 48], [176, 112, 60]], ROAST_RIM = [84, 46, 24], ROAST_STEM = [226, 192, 140], ROAST_GILL = [146, 98, 66];
const STICK_GREEN = [198, 186, 128], STICK_BARK = [112, 88, 60];
// A green stick from the hand (ax, ay) to its tip (bx, by): bark where it's held, peeled along the rest, charred at the tip.
function greenStick(g, ax, ay, bx, by) {
  const at = t => [ax + (bx - ax) * t, ay + (by - ay) * t];
  const stick = (t0, t1, rgb, w) => {
    const [x0, y0] = at(t0), [x1, y1] = at(t1);
    strokeIn(g, rgba(tone(rgb, 0.7)), w + 0.03, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
    strokeIn(g, rgba(rgb), w, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); });
    strokeIn(g, rgba(tone(rgb, 1.15, 28), 0.8), w * 0.32, () => { g.moveTo(x0 - 0.014, y0 - 0.016); g.lineTo(x1 - 0.014, y1 - 0.016); });
  };
  stick(0, 1, STICK_GREEN, 0.085);
  stick(0, 0.17, STICK_BARK, 0.095);
  strokeIn(g, rgba(tone(STICK_BARK, 0.7), 0.8), 0.018, () => { for (const t of [0.05, 0.11]) { const [x, y] = at(t); g.moveTo(x - 0.04, y - 0.04); g.lineTo(x + 0.035, y + 0.03); } });   // its knots
  const [tx, ty] = at(0.92);
  strokeIn(g, 'rgba(44, 30, 22, 0.92)', 0.09, () => { g.moveTo(tx, ty); g.lineTo(bx, by); });   // the charred tip
  furGlow(g, [255, 120, 40], 0.55, bx - 0.01, by + 0.01, 0.05, 0.05);                            // still glowing a little
}
// A roast mushroom upright on the stick at (x, y), threaded through its stem, size s, tilted, its cap's colour CAP.
function roastShroomAt(g, x, y, s, tilt, CAP) {
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  // The stem, round the stick (the stick comes out of either side of it), toasted gold, browned at its foot.
  softIn(g, ROAST_STEM, -0.12, 0.2, () => { g.moveTo(-0.11, -0.12); g.bezierCurveTo(-0.15, 0.04, -0.13, 0.16, -0.08, 0.2); g.quadraticCurveTo(0, 0.24, 0.08, 0.2); g.bezierCurveTo(0.13, 0.16, 0.15, 0.04, 0.11, -0.12); g.closePath(); }, 1.1, 0.7);
  furGlow(g, [150, 92, 44], 0.55, 0.03, 0.17, 0.1, 0.06);
  furGlow(g, [255, 246, 220], 0.4, -0.06, 0.0, 0.03, 0.1);
  // The gills under the cap's rim.
  fillIn(g, rgba(ROAST_GILL), () => ovalAt(g, 0, -0.12, 0.33, 0.07));
  strokeIn(g, rgba(tone(ROAST_GILL, 0.7), 0.6), 0.012, () => { for (let j = -3; j <= 3; j++) { g.moveTo(j * 0.04, -0.13); g.lineTo(j * 0.08, -0.07); } });
  // The cap: a round dome, roasted brown, charred at the rim and in patches where it lay in the flames.
  const cap = () => { g.moveTo(-0.36, -0.12); g.bezierCurveTo(-0.4, -0.38, -0.2, -0.54, 0.01, -0.53); g.bezierCurveTo(0.22, -0.52, 0.4, -0.38, 0.36, -0.12); g.quadraticCurveTo(0, -0.06, -0.36, -0.12); g.closePath(); };
  softIn(g, CAP, -0.53, -0.1, cap, 1.3, 0.64);
  g.save(); g.beginPath(); cap(); g.clip();
  furGlow(g, ROAST_RIM, 0.7, 0.22, -0.12, 0.3, 0.13);                                         // dark toward the rim and the shade side
  furGlow(g, ROAST_RIM, 0.5, -0.28, -0.13, 0.14, 0.08);
  furGlow(g, [60, 32, 16], 0.5, 0.1, -0.36, 0.1, 0.06, -0.5);                                 // scorched patches
  furGlow(g, [60, 32, 16], 0.38, -0.2, -0.26, 0.07, 0.045, 0.4);
  g.restore();
  strokeIn(g, rgba(tone(ROAST_RIM, 0.85), 0.9), 0.024, () => { g.moveTo(-0.36, -0.12); g.quadraticCurveTo(0, -0.06, 0.36, -0.12); });
  // Juicy: a glisten on top, and a few points of light.
  furGlow(g, [255, 226, 186], 0.5, -0.14, -0.41, 0.13, 0.055, -0.4);
  fillIn(g, 'rgba(255, 250, 238, 0.9)', () => { ovalAt(g, -0.17, -0.42, 0.04, 0.018, -0.5); ovalAt(g, -0.05, -0.48, 0.016, 0.011); ovalAt(g, 0.16, -0.4, 0.012, 0.009); });
  g.restore();
}
function paintRoastMushrooms(g) {
  const ax = -0.84, ay = 0.8, bx = 0.86, by = -0.72;           // the stick, from the hand to the tip
  const at = t => [ax + (bx - ax) * t, ay + (by - ay) * t];
  sitShadow(g, 0.04, 0.72, 0.62, 0.11, 0.22);
  greenStick(g, ax, ay, bx, by);
  // The mushrooms, the one furthest up first (it's behind).
  for (const [t, s, tilt, k] of [[0.76, 0.84, 0.16, 2], [0.5, 0.94, -0.08, 1], [0.24, 1, 0.1, 0]]) roastShroomAt(g, ...at(t), s, tilt, ROAST_CAP[k]);
  // A drop of juice running off the lowest.
  const [jx, jy] = at(0.24);
  fillIn(g, 'rgba(170, 104, 40, 0.9)', () => { g.moveTo(jx + 0.22, jy - 0.11); g.quadraticCurveTo(jx + 0.25, jy - 0.0, jx + 0.255, jy + 0.05); g.arc(jx + 0.225, jy + 0.055, 0.032, 0, Math.PI); g.quadraticCurveTo(jx + 0.21, jy - 0.0, jx + 0.19, jy - 0.11); g.closePath(); });
  fillIn(g, 'rgba(255, 236, 200, 0.9)', () => ovalAt(g, jx + 0.215, jy + 0.045, 0.01, 0.014));
}

// ------------------------------------------------------------------ baked apple with honey
//
// An apple baked on a flat stone from the fire's edge: the stone grey and warm, a few flecks of ash on it; the apple a deep
// baked red, its skin a little wrinkled and split down one side where the soft gold flesh shows; cored, the hole full of honey
// gone to caramel, running over the top and down its shoulders in a glaze, and pooled round its foot on the stone.
const STONE = [138, 128, 116], APPLE = [168, 46, 34], FLESH = [234, 180, 100], HONEY = [222, 140, 30], CARAMEL = [164, 84, 22];
const STONE_LUMPS = [1, 0.97, 1.02, 0.95, 1, 1.03, 0.96, 1.01, 0.98, 1.04, 0.97, 0.99];
// A closed lumpy round through points about an oval, smoothed through their midpoints (a stone's outline).
function lumpy(g, cx, cy, rx, ry, R) {
  const n = R.length, pt = i => { const a = (i % n) / n * TAU; return [cx + Math.cos(a) * rx * R[i % n], cy + Math.sin(a) * ry * R[i % n]]; };
  const mid = i => { const [x0, y0] = pt(i), [x1, y1] = pt(i + 1); return [(x0 + x1) / 2, (y0 + y1) / 2]; };
  g.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) { const [x, y] = pt(i), [mx, my] = mid(i); g.quadraticCurveTo(x, y, mx, my); }
  g.closePath();
}
function paintBakedApple(g) {
  const sy = 0.5;                                              // the stone's top, across the middle
  sitShadow(g, 0, sy + 0.22, 0.88, 0.14, 0.3);
  // The stone: its side, then its flat top, lit from the left, a few flecks of ash, warm from the fire on its far side.
  softIn(g, tone(STONE, 0.72), sy, sy + 0.32, () => lumpy(g, 0, sy + 0.09, 0.86, 0.25, STONE_LUMPS), 1.0, 0.6);
  softIn(g, STONE, sy - 0.24, sy + 0.24, () => lumpy(g, 0, sy, 0.86, 0.25, STONE_LUMPS), 1.2, 0.86);
  furGlow(g, [255, 250, 240], 0.22, -0.46, sy - 0.1, 0.3, 0.07);
  for (const [x, y, r] of [[-0.64, 0.06, 0.05], [0.64, -0.06, 0.045], [-0.38, 0.17, 0.035]]) furGlow(g, [214, 208, 200], 0.55, x, sy + y, r * 1.6, r * 0.8);
  fillIn(g, 'rgba(52, 44, 40, 0.6)', () => { ovalAt(g, -0.6, sy + 0.08, 0.016, 0.01); ovalAt(g, 0.68, sy - 0.04, 0.012, 0.008); });
  furGlow(g, [255, 130, 50], 0.28, 0.62, sy + 0.08, 0.3, 0.1);
  // The honey pooled round its foot.
  softIn(g, HONEY, sy - 0.12, sy + 0.12, () => { g.moveTo(-0.5, sy); g.bezierCurveTo(-0.52, sy - 0.08, -0.2, sy - 0.12, 0.06, sy - 0.11); g.bezierCurveTo(0.4, sy - 0.12, 0.6, sy - 0.06, 0.58, sy + 0.01); g.bezierCurveTo(0.56, sy + 0.08, 0.44, sy + 0.1, 0.36, sy + 0.08); g.quadraticCurveTo(0.3, sy + 0.14, 0.18, sy + 0.12); g.bezierCurveTo(-0.1, sy + 0.12, -0.48, sy + 0.1, -0.5, sy); g.closePath(); }, 1.1, 0.72);
  strokeIn(g, 'rgba(255, 236, 170, 0.75)', 0.02, () => { g.moveTo(-0.38, sy + 0.05); g.quadraticCurveTo(-0.2, sy + 0.09, 0.02, sy + 0.085); });
  // The apple: round at the shoulders, narrowing to its foot, a dimple at the top.
  const ay = -0.08;
  const apple = () => {
    g.moveTo(0, ay - 0.38);
    g.bezierCurveTo(0.16, ay - 0.52, 0.5, ay - 0.5, 0.52, ay - 0.12);
    g.bezierCurveTo(0.54, ay + 0.2, 0.36, ay + 0.46, 0.12, ay + 0.47);
    g.quadraticCurveTo(0, ay + 0.44, -0.12, ay + 0.47);
    g.bezierCurveTo(-0.36, ay + 0.46, -0.54, ay + 0.2, -0.52, ay - 0.12);
    g.bezierCurveTo(-0.5, ay - 0.5, -0.16, ay - 0.52, 0, ay - 0.38);
    g.closePath();
  };
  furGlow(g, [70, 30, 14], 0.45, 0.02, ay + 0.46, 0.4, 0.07);                                   // where it sits
  softIn(g, APPLE, ay - 0.5, ay + 0.47, apple, 1.22, 0.55);
  g.save(); g.beginPath(); apple(); g.clip();
  furGlow(g, [76, 16, 16], 0.6, 0.32, ay + 0.2, 0.36, 0.38);                                    // round: the shade side
  furGlow(g, [224, 112, 56], 0.32, -0.3, ay - 0.14, 0.24, 0.3);                                // baked soft and warm where the light is
  furGlow(g, [118, 52, 24], 0.32, -0.2, ay + 0.3, 0.16, 0.1);                                  // browned in patches
  furGlow(g, [118, 52, 24], 0.26, 0.16, ay - 0.06, 0.12, 0.09);
  // The split down its side, the gold flesh showing, caramel in it.
  const split = () => { g.moveTo(0.3, ay - 0.32); g.bezierCurveTo(0.37, ay - 0.18, 0.34, ay - 0.02, 0.39, ay + 0.12); g.bezierCurveTo(0.42, ay + 0.02, 0.44, ay - 0.16, 0.36, ay - 0.33); g.closePath(); };
  softIn(g, FLESH, ay - 0.32, ay + 0.12, split, 1.05, 0.8);
  strokeIn(g, rgba(CARAMEL, 0.75), 0.016, () => { g.moveTo(0.33, ay - 0.28); g.bezierCurveTo(0.38, ay - 0.15, 0.36, ay - 0.02, 0.39, ay + 0.08); });
  strokeIn(g, rgba(tone(APPLE, 0.5), 0.85), 0.018, split);
  // The skin wrinkled a little as it baked, down its sides.
  strokeIn(g, rgba(tone(APPLE, 0.5), 0.32), 0.014, () => {
    g.moveTo(-0.46, ay - 0.06); g.quadraticCurveTo(-0.44, ay + 0.1, -0.36, ay + 0.24);
    g.moveTo(-0.38, ay - 0.1); g.quadraticCurveTo(-0.36, ay + 0.02, -0.3, ay + 0.12);
    g.moveTo(0.18, ay + 0.24); g.quadraticCurveTo(0.24, ay + 0.32, 0.26, ay + 0.38);
  });
  // The honey: glazed over the top and down its shoulders in drips.
  const glaze = () => {
    g.moveTo(-0.5, ay - 0.5);
    g.lineTo(0.5, ay - 0.5);
    g.lineTo(0.5, ay - 0.3);
    g.quadraticCurveTo(0.38, ay - 0.25, 0.32, ay - 0.27);
    g.quadraticCurveTo(0.26, ay - 0.16, 0.22, ay - 0.08); g.arc(0.19, ay - 0.08, 0.035, 0, Math.PI); g.quadraticCurveTo(0.17, ay - 0.2, 0.12, ay - 0.25);
    g.quadraticCurveTo(0.02, ay - 0.22, -0.06, ay - 0.25);
    g.quadraticCurveTo(-0.1, ay - 0.1, -0.12, ay + 0.02); g.arc(-0.155, ay + 0.02, 0.035, 0, Math.PI); g.quadraticCurveTo(-0.19, ay - 0.14, -0.22, ay - 0.27);
    g.quadraticCurveTo(-0.34, ay - 0.24, -0.5, ay - 0.32);
    g.closePath();
  };
  g.globalAlpha = 0.8; softIn(g, HONEY, ay - 0.48, ay + 0.0, glaze, 1.22, 0.8); g.globalAlpha = 1;
  g.restore();
  softIn(g, CARAMEL, ay - 0.42, ay - 0.34, () => ovalAt(g, 0, ay - 0.39, 0.15, 0.05), 0.7, 1.15);   // the cored hole, deep in caramel
  furGlow(g, [255, 210, 110], 0.6, -0.02, ay - 0.395, 0.09, 0.025);                                    // the honey shining in it
  // Its stalk, standing out of the honey, and a leaf gone soft in the heat.
  strokeIn(g, 'rgb(92, 62, 36)', 0.05, () => { g.moveTo(0.0, ay - 0.39); g.quadraticCurveTo(0.0, ay - 0.52, 0.07, ay - 0.6); });
  strokeIn(g, 'rgba(176, 130, 80, 0.7)', 0.016, () => { g.moveTo(-0.012, ay - 0.42); g.quadraticCurveTo(-0.012, ay - 0.52, 0.05, ay - 0.59); });
  softIn(g, [128, 128, 56], ay - 0.68, ay - 0.5, () => { g.moveTo(0.05, ay - 0.55); g.bezierCurveTo(0.12, ay - 0.7, 0.32, ay - 0.7, 0.38, ay - 0.6); g.bezierCurveTo(0.3, ay - 0.5, 0.12, ay - 0.5, 0.05, ay - 0.55); g.closePath(); }, 1.25, 0.7);
  strokeIn(g, 'rgba(84, 84, 34, 0.7)', 0.012, () => { g.moveTo(0.07, ay - 0.56); g.quadraticCurveTo(0.2, ay - 0.62, 0.35, ay - 0.6); });
  strokeIn(g, 'rgba(255, 246, 210, 0.8)', 0.022, () => { g.moveTo(-0.3, ay - 0.36); g.quadraticCurveTo(-0.22, ay - 0.43, -0.1, ay - 0.45); });   // the glaze's gleam
  fillIn(g, 'rgba(255, 250, 236, 0.85)', () => { ovalAt(g, -0.155, ay + 0.005, 0.01, 0.014); ovalAt(g, 0.19, ay - 0.095, 0.01, 0.014); });   // on the drips
  furGlow(g, [255, 240, 228], 0.3, -0.36, ay - 0.06, 0.08, 0.14, -0.4);                         // a soft sheen on the skin
}

// ------------------------------------------------------------------ spring salad
//
// A heap of fresh leaves in a carved wooden bowl: the bowl round and warm, its grain following the curve, a knot on its
// side, the rim worn pale where hands hold it, its hollow dark at the back. In it, tumbled: arrow-headed sorrel, a bright
// green; dandelion leaves, toothed and darker; broad glossy wild garlic. Over the top, two dandelion heads and their loose
// yellow petals, the garlic's little white stars, a glint of wet; and one sorrel leaf hanging out over the front of the rim.
const WOOD = [170, 114, 66], WOOD_RIM = [210, 162, 106], WOOD_HOLLOW = [96, 58, 30];
const SORREL = [124, 172, 66], DANDELION = [84, 138, 56], GARLIC = [60, 124, 52], PETAL = [250, 202, 46];
// A leaf along +x from its foot (0, 0) to its tip (len, 0), w at its widest, bent a little to one side (bend).
function leafPath(g, kind, len, w, bend) {
  const b = bend * w;
  if (kind === 's') {                                          // sorrel: a spearhead, two lobes pointing back at the foot
    g.moveTo(len * 0.08, 0);
    g.lineTo(-len * 0.1, -w * 0.85); g.quadraticCurveTo(len * 0.12, -w * 1.05, len * 0.3, -w * 0.9 + b);
    g.bezierCurveTo(len * 0.6, -w * 0.6 + b, len * 0.85, -w * 0.25 + b, len, b);
    g.bezierCurveTo(len * 0.85, w * 0.25 + b, len * 0.6, w * 0.6 + b, len * 0.3, w * 0.9 + b);
    g.quadraticCurveTo(len * 0.12, w * 1.05, -len * 0.1, w * 0.85);
    g.closePath();
  } else if (kind === 'd') {                                   // dandelion: long, toothed, the teeth hooked back to the foot
    const n = 5, side = s => {
      for (let i = s > 0 ? 1 : n; s > 0 ? i <= n : i >= 1; i += s) {
        const t = i / (n + 0.6), h = w * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.7 + 0.01;
        const y = sgn => sgn * h + b * t;
        if (s > 0) { g.lineTo(len * (t - 0.09), y(-0.45)); g.lineTo(len * (t - 0.05), y(-1)); g.lineTo(len * t, y(-0.42)); }
        else { g.lineTo(len * t, y(0.42)); g.lineTo(len * (t - 0.05), y(1)); g.lineTo(len * (t - 0.09), y(0.45)); }
      }
    };
    g.moveTo(0, 0); side(1); g.lineTo(len, b); side(-1); g.closePath();
  } else {                                                      // wild garlic: broad, smooth, pointed
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -w * 1.1 + b, len * 0.75, -w * 0.8 + b, len, b);
    g.bezierCurveTo(len * 0.75, w * 0.8 + b, len * 0.3, w * 1.1 + b, 0, 0);
    g.closePath();
  }
}
const LEAF_RGB = { s: SORREL, d: DANDELION, g: GARLIC };
function leafAt(g, kind, x, y, len, w, rot, bend = 0, k = 1) {
  const rgb = tone(LEAF_RGB[kind], k);
  g.save(); g.translate(x, y); g.rotate(rot);
  softIn(g, rgb, -w, w, () => leafPath(g, kind, len, w, bend), 1.22, 0.72);
  strokeIn(g, rgba(tone(rgb, 0.55), 0.55), 0.012, () => leafPath(g, kind, len, w, bend));   // its edge, against the leaves under it
  strokeIn(g, rgba(tone(rgb, 1.35, 30), 0.75), w * 0.14, () => { g.moveTo(len * 0.02, 0); g.quadraticCurveTo(len * 0.5, bend * w * 0.6, len * 0.9, bend * w * 0.92); });   // the midrib
  if (kind === 'g') furGlow(g, [255, 255, 240], 0.32, len * 0.42, -w * 0.38 + bend * w * 0.4, len * 0.22, w * 0.22);   // garlic's gloss
  else strokeIn(g, rgba(tone(rgb, 1.25, 20), 0.35), w * 0.06, () => { for (const t of [0.3, 0.5, 0.7]) { g.moveTo(len * t, bend * w * t); g.lineTo(len * (t + 0.12), -w * 0.5 + bend * w * t); g.moveTo(len * t, bend * w * t); g.lineTo(len * (t + 0.12), w * 0.5 + bend * w * t); } });   // veins
  g.restore();
}
// [kind, x, y, len, w, rot, bend, shade], back to front.
const SALAD_LEAVES = [
  ['d', -0.3, -0.06, 0.5, 0.12, -2.3, 0.4, 0.85], ['g', 0.25, -0.06, 0.52, 0.14, -0.9, -0.3, 0.9],
  ['g', -0.2, -0.02, 0.5, 0.14, -2.0, 0.3, 0.92], ['s', -0.05, -0.08, 0.5, 0.13, -1.75, 0.3, 0.95],
  ['d', 0.12, -0.04, 0.5, 0.11, -1.25, -0.4, 1.0], ['g', -0.12, 0.04, 0.62, 0.15, -2.95, -0.3, 1],
  ['s', 0.14, 0.02, 0.62, 0.15, -0.25, 0.4, 1.02], ['d', -0.4, 0.02, 0.45, 0.11, -0.55, 0.3, 1.05],
  ['g', 0.42, 0.04, 0.42, 0.13, -2.5, 0.3, 1.05], ['s', 0.02, 0.06, 0.46, 0.13, -1.5, -0.3, 1.1],
  ['s', -0.14, 0.12, 0.5, 0.13, 2.85, 0.3, 1.05], ['g', 0.18, 0.12, 0.48, 0.13, 0.25, -0.4, 1.1],
  ['d', -0.05, 0.13, 0.5, 0.11, -0.6, 0.3, 1.12], ['g', 0.05, 0.13, 0.44, 0.13, -2.6, -0.3, 1.12],
];
// The carved wooden bowl, with what's in it painted by inside() held in its hollow (only what's above the front of the rim
// shows). Its rim: centred at (0, cy), IX by IY on the inside.
const BOWL = { cy: 0.02, IX: 0.79, IY: 0.24 };
function woodBowl(g, inside) {
  const cy = BOWL.cy, RX = 0.88, RY = 0.3, IX = BOWL.IX, IY = BOWL.IY;   // the rim: outside and in
  sitShadow(g, 0, 0.64, 0.74, 0.13, 0.32);
  // The bowl: its foot, its round body under the rim, lit from the left.
  softIn(g, tone(WOOD, 0.8), 0.56, 0.7, () => ovalAt(g, 0, 0.63, 0.3, 0.07), 1.0, 0.7);
  const body = () => {
    g.moveTo(-RX, cy);
    g.bezierCurveTo(-RX + 0.02, cy + 0.38, -0.5, 0.6, -0.26, 0.62);
    g.lineTo(0.26, 0.62);
    g.bezierCurveTo(0.5, 0.6, RX - 0.02, cy + 0.38, RX, cy);
    g.ellipse(0, cy, RX, RY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, WOOD, cy - RY, 0.62, body, 1.15, 0.62);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [70, 38, 18], 0.5, 0.56, 0.36, 0.5, 0.36);                                     // round: the shade side
  furGlow(g, [255, 220, 170], 0.3, -0.5, 0.24, 0.24, 0.16, -0.3);                           // the light on its belly
  // The grain, following the curve of the bowl, and a knot.
  strokeIn(g, rgba(tone(WOOD, 0.62), 0.42), 0.014, () => {
    for (const [d, s] of [[0.1, 0.96], [0.19, 0.88], [0.28, 0.74], [0.37, 0.56], [0.45, 0.4]]) {
      g.moveTo(-RX * s, cy + d * 0.6); g.bezierCurveTo(-RX * s * 0.7, cy + d + 0.12, RX * s * 0.7, cy + d + 0.12, RX * s, cy + d * 0.6);
    }
  });
  fillIn(g, rgba(tone(WOOD, 0.5), 0.75), () => ovalAt(g, -0.36, 0.38, 0.05, 0.03, 0.2));
  strokeIn(g, rgba(tone(WOOD, 0.62), 0.5), 0.012, () => ovalAt(g, -0.36, 0.38, 0.085, 0.052, 0.2));
  g.restore();
  // The rim's top, worn pale, and the hollow: dark at the front where the rim shades it, lit on the back wall.
  fillIn(g, rgba(WOOD_RIM), () => ovalAt(g, 0, cy, RX, RY));
  furGlow(g, [255, 240, 210], 0.45, -0.6, cy + 0.08, 0.24, 0.1, 0.35);                      // worn where it's held
  softIn(g, WOOD_HOLLOW, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.01, IX, IY), 1.55, 0.6);
  // The leaves, held in the hollow: only what's above the front of the rim shows.
  const held = () => { g.moveTo(-IX, cy); g.lineTo(-IX - 0.2, -1.3); g.lineTo(IX + 0.2, -1.3); g.lineTo(IX, cy); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); };
  g.save(); g.beginPath(); held(); g.clip();
  inside();
  g.restore();
  // The front of the rim: its carved edge catching the light, and a soft shade it casts in.
  strokeIn(g, rgba(tone(WOOD_RIM, 1.12, 14), 0.9), 0.022, () => g.ellipse(0, cy + 0.01, IX, IY, 0, 0.12, Math.PI - 0.12));
  strokeIn(g, rgba(tone(WOOD, 0.6), 0.6), 0.014, () => g.ellipse(0, cy, RX, RY, 0, 0.05, Math.PI - 0.05));
}
// A dandelion head from above, radius r.
function dandelionAt(g, x, y, r) {
  furGlow(g, [40, 50, 20], 0.35, x + 0.02, y + 0.04, r * 1.1, r * 0.8);
  softIn(g, PETAL, y - r, y + r, () => ovalAt(g, x, y, r, r * 0.86), 1.15, 0.75);
  strokeIn(g, rgba(tone(PETAL, 0.82)), r * 0.16, () => { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4); g.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.84); } });
  strokeIn(g, rgba(tone(PETAL, 1.08, 16)), r * 0.12, () => { for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * TAU; g.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.18); g.lineTo(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.57); } });
  furGlow(g, [226, 140, 20], 0.7, x + r * 0.05, y + r * 0.05, r * 0.26, r * 0.22);
  furGlow(g, [255, 250, 220], 0.5, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2, -0.6);
}
function paintSpringSalad(g) {
  const { cy, IX, IY } = BOWL;
  woodBowl(g, () => {
    softIn(g, [56, 100, 42], -0.3, cy + IY, () => { g.moveTo(-IX, cy + 0.02); g.bezierCurveTo(-0.7, -0.3, 0.7, -0.3, IX, cy + 0.02); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); }, 1.1, 0.5);   // the leaves deeper down
    furGlow(g, [20, 36, 14], 0.5, 0.1, cy + 0.12, IX * 0.8, IY * 0.6);
    for (const [kind, x, y, len, w, rot, bend, k] of SALAD_LEAVES) leafAt(g, kind, x, y, len, w, rot, bend, k);
  });
  // A sorrel leaf hanging out over the rim.
  leafAt(g, 's', 0.3, 0.14, 0.42, 0.11, 0.62, -0.5, 1.12);
  // The flowers: two dandelion heads, the garlic's white stars, loose petals.
  dandelionAt(g, -0.22, -0.2, 0.13);
  dandelionAt(g, 0.34, -0.06, 0.1);
  const star = (x, y, r, rot) => {
    fillIn(g, 'rgba(40, 60, 24, 0.3)', () => ovalAt(g, x + 0.012, y + 0.02, r, r * 0.8));
    fillIn(g, 'rgb(250, 248, 238)', () => {
      for (let i = 0; i < 6; i++) { const a = rot + i / 6 * TAU; ovalAt(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.5, r * 0.5, r * 0.2, a); }
    });
    fillIn(g, 'rgb(236, 226, 150)', () => ovalAt(g, x, y, r * 0.22, r * 0.2));
  };
  for (const [x, y, r, a] of [[0.06, -0.32, 0.06, 0.2], [-0.48, -0.08, 0.055, 0.6], [0.52, -0.24, 0.05, 0], [0.1, -0.04, 0.055, 0.4], [-0.08, 0.06, 0.045, 0.1]]) star(x, y, r, a);
  fillIn(g, rgba(PETAL), () => {
    for (const [x, y, a] of [[0.24, -0.36, 0.5], [-0.38, -0.32, -0.4], [-0.02, -0.12, 1.2], [0.42, 0.06, 0.2], [-0.34, 0.06, -1], [0.2, 0.04, 2], [-0.56, -0.2, 0.8]]) ovalAt(g, x, y, 0.035, 0.012, a);
  });
  fillIn(g, 'rgba(255, 255, 248, 0.85)', () => { ovalAt(g, -0.3, -0.36, 0.014, 0.01); ovalAt(g, 0.2, -0.26, 0.012, 0.009); ovalAt(g, -0.56, -0.02, 0.01, 0.008); });   // wet glints
}

// ------------------------------------------------------------------ rosehip tea
//
// A cup folded from birch bark, a little wider at the mouth: the bark chalk-white, flecked with its dark dashes and a
// peeled patch where it shows tan, its seam down the front sewn with a split root, a root binding round the rim, a bark
// strip for a handle. In it, the tea deep red, lighter at the edge, the sky in it, two hips floating; and two more lying at
// its foot, glossy orange-red, each with its dark little crown.
const BARK = [236, 230, 214], BARK_IN = [204, 140, 100], ROOT = [124, 86, 50], TEA = [196, 50, 34], HIP = [218, 72, 36];
// A rosehip lying along +x, length l: a glossy oval, its stalk end at the foot, a dark crown of sepals at the tip.
function hipAt(g, x, y, l, rot, shadow = true) {
  g.save(); g.translate(x, y); g.rotate(rot);
  if (shadow) furGlow(g, [60, 30, 16], 0.4, 0.02, l * 0.3, l * 0.55, l * 0.16);
  const hip = () => { g.moveTo(-l * 0.5, 0); g.bezierCurveTo(-l * 0.5, -l * 0.34, l * 0.3, -l * 0.36, l * 0.46, -l * 0.06); g.lineTo(l * 0.46, l * 0.06); g.bezierCurveTo(l * 0.3, l * 0.36, -l * 0.5, l * 0.34, -l * 0.5, 0); g.closePath(); };
  softIn(g, HIP, -l * 0.32, l * 0.32, hip, 1.2, 0.6);
  furGlow(g, [255, 236, 220], 0.7, -l * 0.12, -l * 0.15, l * 0.18, l * 0.06, -0.1);      // the gloss
  strokeIn(g, 'rgb(64, 36, 24)', l * 0.07, () => { for (const a of [-0.7, -0.25, 0.25, 0.7]) { g.moveTo(l * 0.44, 0); g.lineTo(l * 0.44 + Math.cos(a) * l * 0.2, Math.sin(a) * l * 0.2); } });   // its crown
  strokeIn(g, 'rgb(96, 70, 40)', l * 0.06, () => { g.moveTo(-l * 0.5, 0); g.lineTo(-l * 0.64, -l * 0.04); });   // the stalk
  g.restore();
}
// The lenticels: [height down the cup 0..1, from x, to x, how thick], each following the round of the cup.
const LENTICELS = [[0.1, -0.44, -0.3, 0.016], [0.13, 0.04, 0.12, 0.012], [0.14, 0.16, 0.3, 0.018], [0.25, 0.26, 0.44, 0.014],
  [0.3, -0.14, -0.04, 0.012], [0.33, -0.44, -0.4, 0.01], [0.41, -0.46, -0.3, 0.02], [0.47, 0.06, 0.16, 0.012], [0.49, 0.2, 0.34, 0.016],
  [0.57, -0.32, -0.24, 0.012], [0.63, 0.32, 0.42, 0.014], [0.66, -0.12, -0.02, 0.01], [0.74, -0.04, 0.16, 0.018],
  [0.82, -0.42, -0.26, 0.016], [0.88, 0.14, 0.26, 0.012], [0.9, 0.3, 0.38, 0.01]];
function paintRosehipTea(g) {
  const ty = -0.3, by = 0.6, TX = 0.52, BX = 0.44, TRY = 0.15, BRY = 0.12;   // the cup: its mouth and its foot
  const wAt = t => TX + (BX - TX) * t, yAt = t => ty + (by - ty) * t, ryAt = t => TRY + (BRY - TRY) * t;
  sitShadow(g, 0.06, by + 0.06, 0.66, 0.13, 0.32);
  // The handle: a strip of bark looped out on the right (behind the cup where it's tucked in).
  const handle = () => { g.moveTo(0.44, -0.14); g.bezierCurveTo(0.84, -0.2, 0.9, 0.24, 0.42, 0.3); };
  strokeIn(g, rgba([150, 128, 104]), 0.14, handle);
  strokeIn(g, rgba(tone(BARK, 0.93)), 0.115, handle);
  strokeIn(g, rgba(BARK_IN, 0.9), 0.03, () => { g.moveTo(0.72, 0.16); g.bezierCurveTo(0.66, 0.24, 0.56, 0.27, 0.46, 0.28); });   // its tan underside, curling round
  strokeIn(g, 'rgba(255, 255, 255, 0.75)', 0.022, () => { g.moveTo(0.58, -0.17); g.bezierCurveTo(0.72, -0.13, 0.77, -0.04, 0.77, 0.04); });
  strokeIn(g, 'rgba(58, 48, 42, 0.8)', 0.014, () => { g.moveTo(0.73, 0.12); g.lineTo(0.77, 0.08); g.moveTo(0.76, -0.06); g.lineTo(0.77, -0.11); g.moveTo(0.6, -0.12); g.lineTo(0.66, -0.11); });
  // The cup's side: chalk-white bark, round (lit left, shaded right).
  const side = () => {
    g.moveTo(-TX, ty);
    g.quadraticCurveTo(-(TX + BX) / 2 - 0.02, (ty + by) / 2, -BX, by);
    g.ellipse(0, by, BX, BRY, 0, Math.PI, 0, true);
    g.quadraticCurveTo((TX + BX) / 2 + 0.02, (ty + by) / 2, TX, ty);
    g.ellipse(0, ty, TX, TRY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, BARK, ty - TRY, by + BRY, side, 1.05, 0.82);
  g.save(); g.beginPath(); side(); g.clip();
  furGlow(g, [120, 106, 88], 0.55, 0.42, 0.2, 0.3, 0.7);                                    // round: the shade side
  furGlow(g, [255, 255, 250], 0.7, -0.28, 0.1, 0.12, 0.6);                                  // the light down the left
  furGlow(g, [150, 120, 90], 0.35, 0, by + 0.06, 0.5, 0.14);                                // grubby at the foot
  // A patch where the white has peeled and the tan shows.
  softIn(g, [212, 160, 110], 0.22, 0.36, () => { g.moveTo(0.14, 0.24); g.bezierCurveTo(0.22, 0.2, 0.34, 0.22, 0.36, 0.28); g.bezierCurveTo(0.34, 0.34, 0.24, 0.36, 0.16, 0.34); g.quadraticCurveTo(0.1, 0.3, 0.14, 0.24); g.closePath(); }, 1.1, 0.8);
  strokeIn(g, 'rgba(250, 246, 236, 0.9)', 0.012, () => { g.moveTo(0.14, 0.24); g.bezierCurveTo(0.22, 0.2, 0.34, 0.22, 0.36, 0.28); });
  // The dark dashes across the bark.
  for (const [t, x0, x1, th] of LENTICELS) {
    const w = wAt(t), y = yAt(t), ry = ryAt(t), on = x => y + ry * Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
    strokeIn(g, 'rgba(58, 48, 42, 0.78)', th, () => { g.moveTo(x0, on(x0)); g.quadraticCurveTo((x0 + x1) / 2, on((x0 + x1) / 2) + 0.004, x1, on(x1)); });
  }
  g.restore();
  // The seam: the bark's edge folded over down the front, sewn with a split root.
  const sx = -0.2;
  strokeIn(g, 'rgba(110, 96, 80, 0.5)', 0.03, () => { g.moveTo(sx + 0.02, ty + 0.13); g.quadraticCurveTo(sx + 0.01, 0.2, sx + 0.04, by + 0.1); });   // its shadow
  strokeIn(g, 'rgba(255, 255, 250, 0.95)', 0.016, () => { g.moveTo(sx, ty + 0.13); g.quadraticCurveTo(sx - 0.01, 0.2, sx + 0.02, by + 0.1); });
  strokeIn(g, rgba(ROOT), 0.022, () => {
    for (let i = 0; i < 5; i++) { const y = ty + 0.24 + i * 0.16, x = sx + 0.005 * i; g.moveTo(x - 0.05, y - 0.03); g.lineTo(x + 0.05, y + 0.03); g.moveTo(x - 0.05, y + 0.03); g.lineTo(x + 0.05, y - 0.03); }
  });
  // The handle lashed on with root where it meets the cup.
  strokeIn(g, rgba(ROOT), 0.02, () => { for (const [x, y] of [[0.47, -0.13], [0.45, 0.29]]) for (let i = -1; i <= 1; i++) { g.moveTo(x - 0.02 + i * 0.026, y - 0.07); g.lineTo(x + 0.03 + i * 0.026, y + 0.07); } });
  // In the mouth: the inside of the bark, tan, and the tea, down a little from the rim.
  const mouth = () => ovalAt(g, 0, ty, TX, TRY);
  softIn(g, BARK_IN, ty - TRY, ty + TRY, mouth, 1.05, 0.7);
  g.save(); g.beginPath(); mouth(); g.clip();
  const tea = () => ovalAt(g, 0, ty + 0.045, TX - 0.04, TRY - 0.025);
  fillIn(g, rgba(tone(TEA, 0.74)), tea);
  furGlow(g, [236, 104, 60], 0.8, -0.08, ty + 0.055, 0.42, 0.085, 0, 0.2);                   // ruby, lighter where it's shallow
  strokeIn(g, 'rgba(240, 150, 100, 0.65)', 0.016, () => g.ellipse(0, ty + 0.045, TX - 0.05, TRY - 0.032, 0, Math.PI + 0.2, TAU - 0.2));   // its edge against the cup
  furGlow(g, [255, 236, 220], 0.55, -0.22, ty + 0.02, 0.16, 0.03, -0.08);                    // the sky in it
  hipAt(g, 0.2, ty + 0.06, 0.13, 0.5, false);
  hipAt(g, 0.02, ty + 0.09, 0.11, -2.6, false);
  strokeIn(g, 'rgba(255, 190, 160, 0.5)', 0.008, () => { ovalAt(g, 0.2, ty + 0.075, 0.09, 0.022); ovalAt(g, 0.02, ty + 0.1, 0.075, 0.018); });   // the ripples round them
  furGlow(g, [60, 20, 12], 0.4, 0, ty + 0.13, TX * 0.9, 0.04);                                // shaded under the front of the rim
  g.restore();
  // The rim: rolled bark, bound round with a root.
  strokeIn(g, rgba(BARK), 0.05, () => g.ellipse(0, ty, TX, TRY, 0, 0, TAU));
  strokeIn(g, 'rgba(255, 255, 255, 0.8)', 0.014, () => g.ellipse(0, ty - 0.012, TX - 0.01, TRY - 0.004, 0, Math.PI + 0.3, TAU - 0.4));
  strokeIn(g, rgba(ROOT), 0.03, () => g.ellipse(0, ty + 0.05, TX - 0.005, TRY, 0, 0.04, Math.PI - 0.04));
  strokeIn(g, rgba(tone(ROOT, 0.6)), 0.016, () => {
    for (let i = 1; i < 10; i++) { const a = i / 10 * Math.PI, x = Math.cos(a) * (TX - 0.005), y = ty + 0.05 + Math.sin(a) * TRY; g.moveTo(x - 0.02, y - 0.02); g.lineTo(x + 0.02, y + 0.024); }
  });
  strokeIn(g, 'rgba(220, 180, 130, 0.7)', 0.008, () => g.ellipse(0, ty + 0.042, TX - 0.01, TRY, 0, 0.5, 1.6));
  // Two more hips lying at its foot.
  hipAt(g, -0.6, by + 0.04, 0.24, -0.3);
  hipAt(g, -0.32, by + 0.14, 0.26, 0.2);
}

// ------------------------------------------------------------------ garlic mushrooms
//
// Mushrooms fried on a hot slate pulled from the fire: the slate dark blue-grey, an ember glowing under its far edge, a
// slick of golden juice across it. On it, mushrooms halved down the stem, cut side up, the pale flesh seared gold at the
// edges and the brown skin of the cap round the top, and a whole cap or two between them; wild garlic leaves wilted dark
// and glossy through it all, flecks of chopped garlic, and two of its white star flowers on top.
const SLATE = [92, 96, 106], FRY = [214, 150, 50], SHROOM_SKIN = [150, 96, 52], SHROOM_CUT = [238, 214, 172], WILT = [52, 104, 44];
const SLATE_LUMPS = [1, 0.96, 1.03, 0.98, 1.02, 0.95, 1, 1.04, 0.97, 1.01, 0.96, 1.02];
// A mushroom cut in half down its stem, lying cut side up: the cap's dome above, the stem below, size s, its flesh cut.
function halfShroomAt(g, x, y, s, rot, cut = SHROOM_CUT) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  furGlow(g, [30, 24, 20], 0.45, 0.03, 0.06, 0.38, 0.3);                                      // where it sits
  const half = () => {
    g.moveTo(-0.34, -0.02);
    g.bezierCurveTo(-0.38, -0.3, -0.2, -0.42, 0, -0.42); g.bezierCurveTo(0.2, -0.42, 0.38, -0.3, 0.34, -0.02);
    g.quadraticCurveTo(0.2, 0.02, 0.12, 0.0);
    g.bezierCurveTo(0.14, 0.12, 0.14, 0.22, 0.1, 0.28); g.quadraticCurveTo(0, 0.32, -0.1, 0.28);
    g.bezierCurveTo(-0.14, 0.22, -0.14, 0.12, -0.12, 0.0);
    g.quadraticCurveTo(-0.2, 0.02, -0.34, -0.02);
    g.closePath();
  };
  softIn(g, cut, -0.42, 0.3, half, 1.06, 0.84);
  g.save(); g.beginPath(); half(); g.clip();
  strokeIn(g, rgba(SHROOM_SKIN), 0.1, () => { g.moveTo(-0.34, -0.02); g.bezierCurveTo(-0.38, -0.3, -0.2, -0.42, 0, -0.42); g.bezierCurveTo(0.2, -0.42, 0.38, -0.3, 0.34, -0.02); });   // the cap's skin
  furGlow(g, [176, 108, 36], 0.6, 0.26, -0.04, 0.16, 0.12);                                   // seared gold at the edges
  furGlow(g, [176, 108, 36], 0.5, -0.27, -0.06, 0.12, 0.1);
  furGlow(g, [176, 108, 36], 0.45, 0, 0.3, 0.14, 0.08);
  strokeIn(g, rgba([196, 160, 120], 0.8), 0.022, () => { g.moveTo(-0.3, -0.03); g.quadraticCurveTo(-0.2, 0.0, -0.12, -0.01); g.moveTo(0.3, -0.03); g.quadraticCurveTo(0.2, 0.0, 0.12, -0.01); });   // the gills, a darker line under the cap
  g.restore();
  strokeIn(g, rgba(tone(SHROOM_SKIN, 0.6), 0.85), 0.03, half);
  furGlow(g, [255, 250, 236], 0.5, -0.1, -0.2, 0.12, 0.06, -0.3);                             // juicy
  fillIn(g, 'rgba(255, 252, 240, 0.9)', () => { ovalAt(g, -0.13, -0.22, 0.03, 0.016, -0.4); ovalAt(g, 0.06, 0.12, 0.014, 0.01); });
  g.restore();
}
// A whole cap lying top up, browned, size s.
function capAt(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  furGlow(g, [30, 24, 20], 0.45, 0.03, 0.08, 0.36, 0.22);
  softIn(g, SHROOM_SKIN, -0.24, 0.2, () => ovalAt(g, 0, 0, 0.32, 0.22), 1.25, 0.6);
  furGlow(g, [84, 46, 24], 0.55, 0.12, 0.08, 0.2, 0.12);
  fillIn(g, rgba(tone(SHROOM_CUT, 0.92)), () => ovalAt(g, 0.12, 0.13, 0.12, 0.05, -0.1));   // a bit of the pale underside showing
  furGlow(g, [255, 236, 200], 0.6, -0.1, -0.08, 0.12, 0.05, -0.3);
  fillIn(g, 'rgba(255, 250, 238, 0.9)', () => ovalAt(g, -0.12, -0.09, 0.03, 0.014, -0.3));
  g.restore();
}
function paintGarlicMushrooms(g) {
  const sy = 0.24;                                             // the slate's middle
  sitShadow(g, 0, sy + 0.4, 0.92, 0.16, 0.32);
  // The slate: its edge, then its flat top, lit from the left; an ember under the far side.
  furGlow(g, [255, 110, 30], 0.5, 0.62, sy + 0.3, 0.32, 0.12);
  softIn(g, tone(SLATE, 0.66), sy, sy + 0.5, () => lumpy(g, 0, sy + 0.1, 0.94, 0.38, SLATE_LUMPS), 1.0, 0.6);
  softIn(g, SLATE, sy - 0.38, sy + 0.38, () => lumpy(g, 0, sy, 0.94, 0.38, SLATE_LUMPS), 1.25, 0.8);
  furGlow(g, [255, 255, 255], 0.16, -0.5, sy - 0.16, 0.3, 0.1, -0.2);
  strokeIn(g, rgba(tone(SLATE, 0.78), 0.6), 0.014, () => { g.moveTo(-0.7, sy + 0.12); g.quadraticCurveTo(-0.4, sy + 0.18, -0.16, sy + 0.3); g.moveTo(0.5, sy - 0.26); g.quadraticCurveTo(0.66, sy - 0.18, 0.78, sy - 0.04); });   // its layers
  furGlow(g, [255, 120, 40], 0.3, 0.7, sy + 0.12, 0.2, 0.1);                                 // hot at the far edge
  // The juice, a golden slick under it all.
  g.globalAlpha = 0.85;
  softIn(g, FRY, sy - 0.3, sy + 0.3, () => lumpy(g, 0.02, sy, 0.7, 0.26, STONE_LUMPS), 1.15, 0.7);
  g.globalAlpha = 1;
  strokeIn(g, 'rgba(255, 232, 160, 0.7)', 0.018, () => { g.moveTo(-0.6, sy + 0.06); g.quadraticCurveTo(-0.4, sy + 0.2, -0.1, sy + 0.24); });
  // Garlic leaves wilted under and between, back ones first.
  for (const [x, y, len, w, rot, bend, k] of [[-0.1, sy - 0.14, 0.74, 0.15, -2.75, 0.4, 0.8], [0.14, sy - 0.14, 0.72, 0.15, -0.4, -0.5, 0.85], [-0.04, sy + 0.1, 0.7, 0.14, 0.12, 0.6, 0.95], [0.06, sy + 0.06, 0.66, 0.14, 2.9, -0.4, 0.9]]) {
    g.save(); g.translate(x, y); g.rotate(rot);
    softIn(g, tone(WILT, k), -w, w, () => leafPath(g, 'g', len, w, bend), 1.35, 0.7);
    strokeIn(g, rgba(tone(WILT, 1.5, 30), 0.6), w * 0.12, () => { g.moveTo(len * 0.04, 0); g.quadraticCurveTo(len * 0.5, bend * w * 0.6, len * 0.9, bend * w * 0.92); });
    furGlow(g, [255, 255, 230], 0.4, len * 0.45, -w * 0.3 + bend * w * 0.4, len * 0.2, w * 0.2);   // glossy with the juice
    g.restore();
  }
  // The mushrooms.
  capAt(g, 0.52, sy - 0.14, 0.78, 0.2);
  halfShroomAt(g, -0.44, sy - 0.1, 1.0, -0.35);
  halfShroomAt(g, 0.1, sy - 0.22, 0.94, 0.25);
  capAt(g, -0.2, sy + 0.18, 0.76, -0.15);
  halfShroomAt(g, 0.36, sy + 0.12, 1.02, 0.1);
  // A leaf laid over the top, the chopped garlic, two white stars.
  for (const [x, y, rot, len] of [[-0.06, sy + 0.02, -0.6, 0.5], [0.6, sy + 0.1, -2.4, 0.4], [-0.62, sy + 0.16, -0.3, 0.38]]) {
    g.save(); g.translate(x, y); g.rotate(rot);
    softIn(g, WILT, -0.11, 0.11, () => leafPath(g, 'g', len, 0.11, -0.5), 1.45, 0.7);
    strokeIn(g, rgba(tone(WILT, 0.6), 0.6), 0.01, () => leafPath(g, 'g', len, 0.11, -0.5));
    strokeIn(g, rgba(tone(WILT, 1.5, 30), 0.6), 0.012, () => { g.moveTo(len * 0.04, 0); g.quadraticCurveTo(len * 0.5, -0.033, len * 0.9, -0.05); });
    furGlow(g, [255, 255, 230], 0.45, len * 0.42, -0.04, len * 0.2, 0.03);
    g.restore();
  }
  fillIn(g, rgba([96, 156, 62]), () => { for (const [x, y, a] of [[-0.56, sy + 0.1, 0.4], [-0.3, sy - 0.32, 1.1], [0.08, sy + 0.02, -0.5], [0.24, sy - 0.0, 0.8], [0.58, sy + 0.08, 0.2], [-0.02, sy - 0.36, -1], [0.46, sy - 0.3, 0.6], [-0.4, sy + 0.24, -0.3]]) ovalAt(g, x, y, 0.024, 0.012, a); });
  fillIn(g, 'rgba(250, 244, 220, 0.95)', () => { for (const [x, y] of [[-0.24, sy + 0.04], [0.2, sy + 0.28], [0.62, sy - 0.02], [-0.6, sy - 0.08]]) ovalAt(g, x, y, 0.018, 0.013); });   // garlic, chopped
  const star = (x, y, r, rot) => {
    fillIn(g, 'rgba(30, 30, 20, 0.3)', () => ovalAt(g, x + 0.012, y + 0.02, r, r * 0.8));
    fillIn(g, 'rgb(250, 248, 238)', () => { for (let i = 0; i < 6; i++) { const a = rot + i / 6 * TAU; ovalAt(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.5, r * 0.5, r * 0.2, a); } });
    fillIn(g, 'rgb(236, 226, 150)', () => ovalAt(g, x, y, r * 0.22, r * 0.2));
  };
  star(-0.16, sy - 0.34, 0.08, 0.3);
  star(0.24, sy + 0.0, 0.07, 0.1);
}

// ------------------------------------------------------------------ honeyed cherries
//
// A heap of cherries on a broad leaf, its edges curled up to hold the honey: the leaf a fresh green with its veins and a
// lighter curl along the front, its stalk out to the left. In the hollow, honey pooled amber; on it the cherries, a deep
// glossy red, each with a window of light and a gold sheen where the honey glazes it, a drip hanging off one; their stalks
// up in pairs, one pair stood up on top.
const LEAF = [104, 150, 58], CHERRY = [164, 22, 36];
// A cherry, radius r: round, deep red, its little dimple, lit top left, glazed gold underneath.
function cherryAt(g, x, y, r) {
  furGlow(g, [70, 30, 10], 0.45, x + r * 0.15, y + r * 0.7, r * 1.05, r * 0.45);
  softIn(g, CHERRY, y - r, y + r, () => { g.moveTo(x, y - r * 0.82); g.bezierCurveTo(x + r * 0.7, y - r * 1.12, x + r * 1.08, y - r * 0.4, x + r, y + r * 0.1); g.bezierCurveTo(x + r * 0.9, y + r * 0.8, x + r * 0.4, y + r, x, y + r); g.bezierCurveTo(x - r * 0.4, y + r, x - r * 0.9, y + r * 0.8, x - r, y + r * 0.1); g.bezierCurveTo(x - r * 1.08, y - r * 0.4, x - r * 0.7, y - r * 1.12, x, y - r * 0.82); g.closePath(); }, 1.45, 0.5);
  furGlow(g, [60, 6, 14], 0.5, x + r * 0.4, y + r * 0.3, r * 0.6, r * 0.6);                  // round: the shade side
  furGlow(g, [240, 150, 40], 0.5, x - r * 0.05, y + r * 0.72, r * 0.62, r * 0.22);           // the honey's glaze
  fillIn(g, 'rgba(255, 246, 240, 0.92)', () => ovalAt(g, x - r * 0.42, y - r * 0.38, r * 0.2, r * 0.12, -0.7));   // a window of light
  fillIn(g, 'rgba(255, 246, 240, 0.7)', () => ovalAt(g, x - r * 0.1, y - r * 0.6, r * 0.06, r * 0.05));
}
function paintHoneyedCherries(g) {
  const ly = 0.3;                                              // the leaf's middle
  sitShadow(g, 0.04, ly + 0.34, 0.9, 0.15, 0.3);
  // The leaf: broad, pointed off to the right, its stalk to the left, curled up round the edges.
  const leaf = () => {
    g.moveTo(-0.84, ly);
    g.bezierCurveTo(-0.88, ly - 0.36, -0.3, ly - 0.42, 0.12, ly - 0.36);
    g.bezierCurveTo(0.54, ly - 0.3, 0.86, ly - 0.18, 1.02, ly - 0.06);
    g.bezierCurveTo(0.84, ly + 0.18, 0.52, ly + 0.36, 0.06, ly + 0.38);
    g.bezierCurveTo(-0.4, ly + 0.4, -0.82, ly + 0.3, -0.84, ly);
    g.closePath();
  };
  strokeIn(g, rgba([92, 92, 40]), 0.05, () => { g.moveTo(-0.82, ly + 0.02); g.quadraticCurveTo(-0.98, ly + 0.04, -1.06, ly + 0.16); });   // its stalk
  softIn(g, LEAF, ly - 0.4, ly + 0.4, leaf, 1.2, 0.62);
  g.save(); g.beginPath(); leaf(); g.clip();
  softIn(g, tone(LEAF, 0.76), ly - 0.3, ly + 0.24, () => ovalAt(g, 0.02, ly - 0.02, 0.76, 0.24), 0.8, 1.1);   // the hollow, a little darker
  strokeIn(g, rgba(tone(LEAF, 1.35, 24), 0.7), 0.024, () => { g.moveTo(-0.82, ly + 0.01); g.quadraticCurveTo(0.1, ly - 0.02, 1.0, ly - 0.06); });   // the midrib
  strokeIn(g, rgba(tone(LEAF, 1.3, 20), 0.45), 0.014, () => {
    for (const x of [-0.56, -0.28, 0.0, 0.28, 0.56]) { const y = ly - 0.01 - (x + 0.82) * 0.03; g.moveTo(x, y); g.quadraticCurveTo(x + 0.12, y - 0.12, x + 0.24, y - 0.28); g.moveTo(x, y); g.quadraticCurveTo(x + 0.12, y + 0.12, x + 0.22, y + 0.3); }
  });
  g.restore();
  // The curled front edge, catching the light; the back edge's lip.
  strokeIn(g, rgba(tone(LEAF, 0.6), 0.7), 0.018, () => { g.moveTo(-0.74, ly + 0.22); g.bezierCurveTo(-0.4, ly + 0.42, 0.44, ly + 0.42, 0.94, ly + 0.05); });
  strokeIn(g, rgba(tone(LEAF, 1.32, 26)), 0.055, () => { g.moveTo(-0.78, ly + 0.15); g.bezierCurveTo(-0.44, ly + 0.36, 0.42, ly + 0.36, 0.92, ly + 0.02); });
  strokeIn(g, 'rgba(255, 255, 230, 0.5)', 0.014, () => { g.moveTo(-0.6, ly + 0.25); g.bezierCurveTo(-0.36, ly + 0.33, -0.1, ly + 0.34, 0.1, ly + 0.33); });
  strokeIn(g, rgba(tone(LEAF, 1.15, 14), 0.8), 0.03, () => { g.moveTo(-0.78, ly - 0.18); g.bezierCurveTo(-0.44, ly - 0.4, 0.42, ly - 0.36, 0.94, ly - 0.1); });
  // The honey pooled in the hollow, running out in front of the cherries.
  softIn(g, HONEY, ly - 0.16, ly + 0.32, () => { g.moveTo(-0.66, ly + 0.04); g.bezierCurveTo(-0.66, ly - 0.14, -0.1, ly - 0.2, 0.3, ly - 0.16); g.bezierCurveTo(0.66, ly - 0.12, 0.8, ly - 0.02, 0.74, ly + 0.08); g.bezierCurveTo(0.64, ly + 0.26, 0.12, ly + 0.33, -0.22, ly + 0.31); g.bezierCurveTo(-0.5, ly + 0.29, -0.66, ly + 0.2, -0.66, ly + 0.04); g.closePath(); }, 1.25, 0.72);
  strokeIn(g, rgba(CARAMEL, 0.5), 0.014, () => { g.moveTo(-0.6, ly + 0.18); g.bezierCurveTo(-0.4, ly + 0.3, 0.3, ly + 0.31, 0.68, ly + 0.13); });
  strokeIn(g, 'rgba(255, 244, 200, 0.85)', 0.022, () => { g.moveTo(-0.54, ly + 0.17); g.quadraticCurveTo(-0.36, ly + 0.25, -0.12, ly + 0.27); });
  furGlow(g, [255, 226, 140], 0.6, 0.38, ly + 0.26, 0.16, 0.035);
  // The cherries: two at the back, three in front, and a pair on top still joined by their stalks.
  const R = 0.21, stalk = (x0, y0, cx, cy, x1, y1) => {
    strokeIn(g, 'rgb(96, 84, 38)', 0.038, () => { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); });
    strokeIn(g, 'rgba(196, 200, 116, 0.6)', 0.012, () => { g.moveTo(x0 - 0.01, y0); g.quadraticCurveTo(cx - 0.01, cy, x1 - 0.01, y1); });
  };
  stalk(-0.28, ly - 0.28, -0.36, ly - 0.5, -0.52, ly - 0.58);   // a back one's, bent over
  cherryAt(g, -0.28, ly - 0.1, R * 0.95);
  cherryAt(g, 0.3, ly - 0.12, R * 0.95);
  stalk(0.56, ly - 0.14, 0.62, ly - 0.36, 0.78, ly - 0.42);     // and a front one's
  cherryAt(g, -0.46, ly + 0.02, R);
  cherryAt(g, 0.02, ly + 0.02, R * 1.04);
  cherryAt(g, 0.5, ly + 0.0, R * 0.96);
  const px = 0.06, py = ly - 0.8;
  stalk(-0.1, ly - 0.36, -0.06, ly - 0.62, px, py); stalk(0.22, ly - 0.32, 0.2, ly - 0.6, px, py);
  strokeIn(g, 'rgb(96, 84, 38)', 0.05, () => { g.moveTo(px, py); g.lineTo(px + 0.05, py - 0.05); });
  cherryAt(g, -0.1, ly - 0.2, R * 0.88);
  cherryAt(g, 0.22, ly - 0.15, R * 0.88);
  // Honey drizzled over the top, and a drip hanging off the front one.
  g.globalAlpha = 0.6;
  strokeIn(g, rgba(HONEY), 0.03, () => { g.moveTo(-0.56, ly - 0.06); g.bezierCurveTo(-0.46, ly - 0.14, -0.34, ly - 0.06, -0.3, ly - 0.1); g.moveTo(-0.06, ly - 0.12); g.bezierCurveTo(0.04, ly - 0.2, 0.12, ly - 0.08, 0.2, ly - 0.12); g.moveTo(0.4, ly - 0.12); g.quadraticCurveTo(0.5, ly - 0.18, 0.6, ly - 0.1); });
  g.globalAlpha = 1;
  strokeIn(g, 'rgba(255, 240, 190, 0.8)', 0.01, () => { g.moveTo(-0.5, ly - 0.11); g.quadraticCurveTo(-0.44, ly - 0.13, -0.38, ly - 0.1); g.moveTo(0.0, ly - 0.16); g.quadraticCurveTo(0.06, ly - 0.17, 0.11, ly - 0.13); });
  const dx = 0.06, dy = ly + 0.02 + R * 0.96;
  fillIn(g, rgba(HONEY, 0.95), () => { g.moveTo(dx - 0.05, dy - 0.05); g.quadraticCurveTo(dx - 0.02, dy + 0.04, dx - 0.026, dy + 0.08); g.arc(dx, dy + 0.085, 0.028, Math.PI, 0, true); g.quadraticCurveTo(dx + 0.02, dy + 0.04, dx + 0.05, dy - 0.05); g.closePath(); });
  fillIn(g, 'rgba(255, 240, 200, 0.9)', () => ovalAt(g, dx - 0.008, dy + 0.08, 0.009, 0.013));
}

// ------------------------------------------------------------------ warm bramble compote
//
// Blackberries stewed down in honey, in the carved wooden bowl: the compote a deep glossy purple, lighter where the light
// falls on it, a swirl of honey through it, whole berries sitting up in it, each a cluster of shining drupelets. A carved
// spoon left in it, its handle up over the rim to the right; and a purple drip run down the front of the bowl.
const COMPOTE = [70, 16, 48], BERRY = [52, 18, 46], DRUPE = [74, 24, 64];
// Where a blackberry's drupelets sit, in its own radius.
const DRUPES = [[-0.42, -0.58], [0.06, -0.66], [0.5, -0.46], [-0.66, -0.12], [-0.18, -0.18], [0.3, -0.12], [0.7, 0.1],
  [-0.48, 0.34], [0.04, 0.3], [0.5, 0.42], [-0.16, 0.72], [0.28, 0.76]];
function berryAt(g, x, y, r) {
  furGlow(g, [24, 4, 16], 0.5, x + r * 0.1, y + r * 0.62, r * 1.1, r * 0.42);
  softIn(g, BERRY, y - r, y + r, () => ovalAt(g, x, y, r * 0.92, r), 1.3, 0.55);
  const d = r * 0.3;
  fillIn(g, rgba(DRUPE), () => { for (const [u, v] of DRUPES) ovalAt(g, x + u * r * 0.92, y + v * r, d, d * 0.94); });
  strokeIn(g, 'rgba(26, 4, 20, 0.7)', d * 0.22, () => { for (const [u, v] of DRUPES) ovalAt(g, x + u * r * 0.92, y + v * r, d, d * 0.94); });
  furGlow(g, [20, 2, 14], 0.45, x + r * 0.4, y + r * 0.4, r * 0.6, r * 0.6);                    // round: the shade side
  fillIn(g, 'rgba(255, 236, 250, 0.85)', () => { for (const [u, v] of DRUPES) if (u + v < 0.4) ovalAt(g, x + (u * 0.92 - 0.1) * r, y + (v - 0.1) * r, d * 0.28, d * 0.2, -0.6); });   // each drupelet's point of light
  furGlow(g, [220, 120, 40], 0.3, x, y + r * 0.8, r * 0.6, r * 0.18);                           // the honey on it
}
function paintBrambleCompote(g) {
  const { cy, IX, IY } = BOWL, sy = cy + 0.05;                // the compote, a little down from the rim
  woodBowl(g, () => {
    const top = () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.04);
    fillIn(g, rgba(COMPOTE), top);
    furGlow(g, [156, 42, 100], 0.75, -0.14, sy - 0.02, 0.5, 0.12);                             // lighter where the light falls
    furGlow(g, [24, 4, 16], 0.6, 0.1, sy + 0.15, IX * 0.8, 0.06);                               // shaded under the front of the rim
    strokeIn(g, rgba(HONEY, 0.8), 0.024, () => { g.moveTo(-0.5, sy + 0.04); g.bezierCurveTo(-0.44, sy - 0.1, 0.04, sy - 0.12, 0.08, sy - 0.02); g.bezierCurveTo(0.1, sy + 0.07, -0.16, sy + 0.08, -0.18, sy + 0.0); g.quadraticCurveTo(-0.17, sy - 0.05, -0.08, sy - 0.04); });   // the honey's swirl
    strokeIn(g, 'rgba(255, 230, 160, 0.6)', 0.008, () => { g.moveTo(-0.46, sy + 0.02); g.bezierCurveTo(-0.4, sy - 0.09, 0.0, sy - 0.11, 0.05, sy - 0.04); });
    furGlow(g, [255, 236, 250], 0.4, -0.34, sy - 0.07, 0.16, 0.03, -0.05);                     // the sky in it
    for (const [x, y, r] of [[-0.2, sy - 0.14, 0.16], [0.28, sy - 0.15, 0.15], [-0.5, sy - 0.04, 0.15], [0.04, sy - 0.04, 0.18], [0.5, sy - 0.02, 0.14], [-0.22, sy + 0.06, 0.15]]) berryAt(g, x, y, r);
  });
  // The spoon left in it, its handle up over the rim, the compote round where it goes in and smeared up it.
  const handle = () => { g.moveTo(0.3, sy - 0.04); g.quadraticCurveTo(0.6, -0.34, 0.92, -0.68); };
  strokeIn(g, rgba(tone(WOOD, 0.62)), 0.085, handle);
  strokeIn(g, rgba(WOOD_RIM), 0.06, handle);
  strokeIn(g, 'rgba(255, 240, 210, 0.7)', 0.016, () => { g.moveTo(0.42, sy - 0.15); g.quadraticCurveTo(0.62, -0.38, 0.88, -0.68); });
  strokeIn(g, rgba(COMPOTE, 0.85), 0.064, () => { g.moveTo(0.3, sy - 0.04); g.lineTo(0.4, sy - 0.15); });
  strokeIn(g, rgba(tone(COMPOTE, 1.6), 0.8), 0.014, () => ovalAt(g, 0.31, sy - 0.03, 0.07, 0.022));
  // A drip run down the front of the bowl.
  const dx = -0.34, dy = cy + 0.27;
  fillIn(g, rgba(COMPOTE, 0.95), () => { g.moveTo(dx - 0.05, dy - 0.03); g.quadraticCurveTo(dx - 0.02, dy + 0.06, dx - 0.022, dy + 0.1); g.arc(dx, dy + 0.105, 0.024, Math.PI, 0, true); g.quadraticCurveTo(dx + 0.02, dy + 0.06, dx + 0.05, dy - 0.03); g.closePath(); });
  fillIn(g, 'rgba(255, 220, 240, 0.85)', () => ovalAt(g, dx - 0.007, dy + 0.1, 0.007, 0.011));
}

// ------------------------------------------------------------------ wilted greens
//
// Nettles wilted down with garlic in a clay bowl from the pot: the bowl a warm terracotta, round-bellied, its rim rolled
// thick, a band of thumb-pressed dots round its shoulder and soot on its foot where it sat in the embers. In it, a heap of
// nettle leaves gone dark and soft and glossy, their teeth still on them, a few bits of stalk, slivers of garlic gone gold.
const CLAY = [178, 100, 64], CLAY_RIM = [206, 136, 92], CLAY_IN = [100, 50, 30], WILTED = [52, 92, 38];
// A nettle leaf along +x from its foot (0, 0) to its tip (len, 0), w at its widest, its teeth pointing to the tip, gone
// limp and curling to one side (bend).
function nettlePath(g, len, w, bend, n = 6) {
  const h = t => w * Math.sin(Math.PI * Math.min(1, t ** 0.8)) ** 0.6, b = t => bend * w * t * t * 1.6;
  g.moveTo(0, 0);
  for (let i = 0; i < n; i++) { const t0 = (i + 0.7) / n, t1 = (i + 1) / n; g.lineTo(len * t0, -h(t0) + b(t0)); g.lineTo(len * t1, -h(t1) * 0.86 + b(t1)); }
  for (let i = n - 1; i >= 0; i--) { const t0 = (i + 0.7) / n, t1 = i / n; g.lineTo(len * t0, h(t0) + b(t0)); g.lineTo(len * t1, h(t1) * 0.86 + b(t1)); }
  g.closePath();
}
// [x, y, len, w, rot, bend, shade], back to front.
const WILT_LEAVES = [
  [-0.12, 0.0, 0.46, 0.17, -2.7, 0.6, 0.78], [0.12, -0.02, 0.48, 0.17, -0.45, -0.6, 0.8], [0.0, -0.04, 0.4, 0.16, -1.7, 0.5, 0.86],
  [-0.22, 0.08, 0.52, 0.18, -3.0, -0.6, 0.9], [0.2, 0.06, 0.52, 0.18, -0.1, 0.6, 0.93], [0.02, 0.02, 0.4, 0.16, -1.1, -0.6, 0.98],
  [-0.08, 0.04, 0.4, 0.16, -2.2, 0.6, 1.0], [-0.12, 0.15, 0.48, 0.17, 2.85, 0.6, 1.04], [0.12, 0.15, 0.48, 0.17, 0.3, -0.6, 1.07],
  [0.0, 0.13, 0.36, 0.15, -1.9, 0.5, 1.12],
];
// The clay bowl from the pot, with what's in it painted by inside() held in its hollow (only what's above the front of the
// rim shows). Its rim: centred at (0, cy), IX by IY on the inside.
const CLAY_BOWL = { cy: 0.1, IX: 0.66, IY: 0.17 };
function clayBowl(g, inside) {
  const cy = CLAY_BOWL.cy, RX = 0.78, RY = 0.24, IX = CLAY_BOWL.IX, IY = CLAY_BOWL.IY;  // the rim: outside and in
  sitShadow(g, 0, 0.68, 0.78, 0.13, 0.34);
  // The bowl: round-bellied, lit from the left, soot on its foot, dots pressed round its shoulder.
  const body = () => {
    g.moveTo(-RX, cy);
    g.bezierCurveTo(-0.98, cy + 0.26, -0.74, 0.66, -0.3, 0.68);
    g.lineTo(0.3, 0.68);
    g.bezierCurveTo(0.74, 0.66, 0.98, cy + 0.26, RX, cy);
    g.ellipse(0, cy, RX, RY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, CLAY, cy - RY, 0.68, body, 1.15, 0.6);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [80, 34, 20], 0.55, 0.56, 0.42, 0.5, 0.36);                                       // round: the shade side
  furGlow(g, [255, 214, 176], 0.34, -0.54, 0.3, 0.22, 0.18, -0.3);                             // the light on its belly
  furGlow(g, [44, 30, 26], 0.5, 0.3, 0.66, 0.56, 0.14);                                        // sooty where it sat in the embers
  const shoulder = x => cy + 0.17 + RY * Math.sqrt(Math.max(0, 1 - (x / 0.84) ** 2));
  fillIn(g, rgba(tone(CLAY, 0.64), 0.75), () => { for (let i = -6; i <= 6; i++) { const x = i * 0.11, k = Math.sqrt(Math.max(0, 1 - (x / 0.84) ** 2)); ovalAt(g, x, shoulder(x), 0.026 * k + 0.004, 0.02); } });
  strokeIn(g, rgba(tone(CLAY, 0.7), 0.5), 0.012, () => { g.moveTo(-0.78, shoulder(-0.78) + 0.04); for (let x = -0.78; x <= 0.78; x += 0.04) g.lineTo(x, shoulder(x) + 0.05); });
  g.restore();
  // The rim rolled thick, and the hollow.
  fillIn(g, rgba(CLAY_RIM), () => ovalAt(g, 0, cy, RX, RY));
  furGlow(g, [255, 236, 210], 0.4, -0.54, cy + 0.1, 0.22, 0.08, 0.35);
  softIn(g, CLAY_IN, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.01, IX, IY), 1.55, 0.6);
  // What's in it, held in the hollow: only what's above the front of the rim shows.
  const held = () => { g.moveTo(-IX, cy); g.lineTo(-IX - 0.2, -1.3); g.lineTo(IX + 0.2, -1.3); g.lineTo(IX, cy); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); };
  g.save(); g.beginPath(); held(); g.clip();
  inside();
  g.restore();
  // The front of the rim: rolled, catching the light; its outer edge.
  strokeIn(g, rgba(tone(CLAY_RIM, 1.12, 14), 0.9), 0.024, () => g.ellipse(0, cy + 0.01, IX, IY, 0, 0.12, Math.PI - 0.12));
  strokeIn(g, rgba(tone(CLAY, 0.6), 0.6), 0.016, () => g.ellipse(0, cy, RX, RY, 0, 0.05, Math.PI - 0.05));
}
function paintWiltedGreens(g) {
  const { cy, IX, IY } = CLAY_BOWL;
  clayBowl(g, () => {
    softIn(g, [34, 66, 28], -0.34, cy + IY, () => { g.moveTo(-IX, cy + 0.02); g.bezierCurveTo(-0.62, -0.38, 0.62, -0.38, IX, cy + 0.02); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); }, 1.1, 0.5);   // the greens deeper down
    furGlow(g, [14, 30, 10], 0.5, 0.1, cy + 0.12, IX * 0.8, IY * 0.6);
    for (const [x, y, len, w, rot, bend, k] of WILT_LEAVES) {
      const rgb = tone(WILTED, k);
      g.save(); g.translate(x, y - 0.02); g.rotate(rot);
      softIn(g, rgb, -w, w, () => nettlePath(g, len, w, bend), 1.3, 0.66);
      strokeIn(g, rgba(tone(rgb, 0.55), 0.55), 0.012, () => nettlePath(g, len, w, bend));
      strokeIn(g, rgba(tone(rgb, 1.45, 26), 0.6), w * 0.12, () => { g.moveTo(len * 0.02, 0); g.quadraticCurveTo(len * 0.5, bend * w * 0.3, len * 0.92, bend * w * 1.1); });   // the midrib
      strokeIn(g, rgba(tone(rgb, 1.35, 20), 0.35), w * 0.06, () => { for (const t of [0.28, 0.5]) { const m = bend * w * 1.2 * t * t; g.moveTo(len * t, m); g.lineTo(len * (t + 0.14), m - w * 0.55); g.moveTo(len * t, m); g.lineTo(len * (t + 0.14), m + w * 0.55); } });   // veins
      furGlow(g, [255, 255, 236], 0.32, len * 0.42, -w * 0.3 + bend * w * 0.3, len * 0.22, w * 0.22);   // glossy, wilted soft
      g.restore();
    }
    strokeIn(g, 'rgb(96, 116, 58)', 0.03, () => { g.moveTo(-0.34, -0.06); g.quadraticCurveTo(-0.24, -0.14, -0.14, -0.12); g.moveTo(0.26, 0.08); g.quadraticCurveTo(0.36, 0.0, 0.46, 0.02); g.moveTo(0.04, -0.24); g.lineTo(0.12, -0.32); });   // bits of stalk
    for (const [x, y, a] of [[-0.3, 0.04, 0.4], [0.06, -0.14, -0.6], [0.34, -0.06, 1.1], [-0.12, 0.18, -0.2], [0.24, 0.2, 0.3], [-0.42, -0.14, 1.4], [0.12, 0.06, 2.2]]) {
      fillIn(g, 'rgb(214, 168, 90)', () => ovalAt(g, x, y, 0.05, 0.026, a));                     // garlic, sliced and gone gold
      fillIn(g, 'rgb(246, 232, 196)', () => ovalAt(g, x - 0.006, y - 0.005, 0.038, 0.016, a));
    }
    fillIn(g, 'rgba(255, 255, 240, 0.85)', () => { ovalAt(g, -0.22, -0.18, 0.014, 0.01); ovalAt(g, 0.2, -0.1, 0.012, 0.009); ovalAt(g, -0.04, 0.1, 0.01, 0.008); ovalAt(g, 0.42, 0.1, 0.01, 0.008); });   // wet glints
  });
}

// ------------------------------------------------------------------ toasted beechnuts
//
// A little heap of beechnuts toasted in the embers, on a dry beech leaf gone copper: the leaf oval and pointed, its straight
// veins running out side by side from the midrib, its front edge curled up. On it the nuts, three-sided and pointed, a glossy
// chestnut brown with one face lit and one in shade, darkened here and there in the heat, the pale downy patch at the foot of
// each; two split open on the gold kernel. One of the spiny husks they fell in lies open at the back, its four valves splayed.
const BEECH_LEAF = [206, 128, 58], BEECHNUT = [150, 76, 40], KERNEL = [232, 186, 104], HUSK = [128, 92, 54];
// A beechnut along +x, length l: its rounded foot at -x, its point at +x, the ridge between two faces along its middle.
function beechnutAt(g, x, y, l, rot, split = false) {
  const w = l * 0.74;
  furGlow(g, [50, 22, 8], 0.45, x + 0.01, y + l * 0.2, l * 0.58, l * 0.22);                     // where it sits
  g.save(); g.translate(x, y); g.rotate(rot);
  const nut = () => {
    g.moveTo(-l * 0.4, -w * 0.62);
    g.bezierCurveTo(-l * 0.56, -w * 0.4, -l * 0.56, w * 0.4, -l * 0.4, w * 0.62);
    g.bezierCurveTo(-l * 0.1, w * 0.72, l * 0.3, w * 0.32, l * 0.56, 0);
    g.bezierCurveTo(l * 0.3, -w * 0.32, -l * 0.1, -w * 0.72, -l * 0.4, -w * 0.62);
    g.closePath();
  };
  softIn(g, BEECHNUT, -w * 0.7, w * 0.7, nut, 1.32, 0.62);
  g.save(); g.beginPath(); nut(); g.clip();
  fillIn(g, rgba(tone(BEECHNUT, 0.66), 0.8), () => { g.moveTo(-l * 0.6, w * 0.1); g.quadraticCurveTo(0, w * 0.18, l * 0.6, 0); g.lineTo(l * 0.6, w); g.lineTo(-l * 0.6, w); g.closePath(); });   // the face in shade
  furGlow(g, [56, 26, 10], 0.5, l * 0.28, -w * 0.12, l * 0.16, w * 0.2);                        // darkened in the heat
  furGlow(g, [56, 26, 10], 0.35, -l * 0.12, w * 0.32, l * 0.14, w * 0.16);
  g.restore();
  strokeIn(g, rgba(tone(BEECHNUT, 1.4, 30), 0.75), l * 0.035, () => { g.moveTo(-l * 0.42, w * 0.08); g.quadraticCurveTo(0, w * 0.16, l * 0.52, 0.0); });   // the ridge
  furGlow(g, [206, 168, 120], 0.7, -l * 0.42, 0, l * 0.07, w * 0.3);                            // the downy foot
  strokeIn(g, rgba(tone(BEECHNUT, 0.45), 0.7), l * 0.025, nut);                                  // its edge, against the others
  if (split) {                                                                                   // split along a face, the kernel showing
    const crack = () => { g.moveTo(-l * 0.3, -w * 0.26); g.quadraticCurveTo(l * 0.06, -w * 0.56, l * 0.44, -w * 0.08); g.quadraticCurveTo(l * 0.06, -w * 0.26, -l * 0.3, -w * 0.26); g.closePath(); };
    softIn(g, KERNEL, -w * 0.5, -w * 0.1, crack, 1.15, 0.8);
    strokeIn(g, rgba(tone(BEECHNUT, 0.45), 0.9), l * 0.022, crack);
  } else {
    furGlow(g, [255, 236, 214], 0.6, -l * 0.06, -w * 0.3, l * 0.22, w * 0.1, -0.08);             // glossy
    fillIn(g, 'rgba(255, 248, 238, 0.85)', () => ovalAt(g, -l * 0.12, -w * 0.32, l * 0.06, w * 0.04, -0.1));
  }
  g.restore();
}
// The husk they fell in, opened: four woody valves splayed out from where the nuts sat, pale and smooth inside, bristly outside.
function beechHuskAt(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  furGlow(g, [50, 26, 10], 0.4, 0.02, 0.08, 0.36, 0.2);
  for (const [a, k] of [[-2.2, 0.82], [-0.85, 0.9], [0.6, 1.0], [2.25, 0.95]]) {
    g.save(); g.rotate(a);
    const valve = () => { g.moveTo(0.02, -0.06); g.bezierCurveTo(0.16, -0.12, 0.3, -0.08, 0.36, 0); g.bezierCurveTo(0.3, 0.08, 0.16, 0.12, 0.02, 0.06); g.closePath(); };
    softIn(g, tone(HUSK, k), -0.1, 0.1, valve, 1.15, 0.7);
    strokeIn(g, rgba(tone(HUSK, 0.6 * k), 0.8), 0.016, () => { for (let i = 1; i <= 5; i++) { const t = i / 6, px = 0.02 + 0.32 * t, h = 0.11 * Math.sin(Math.PI * t) + 0.01; g.moveTo(px, -h); g.lineTo(px + 0.03, -h - 0.04); g.moveTo(px, h); g.lineTo(px + 0.03, h + 0.04); } });   // its bristles
    fillIn(g, rgba(tone([214, 176, 122], k)), () => ovalAt(g, 0.17, 0, 0.12, 0.04));             // smooth inside
    g.restore();
  }
  fillIn(g, rgba([70, 44, 24]), () => ovalAt(g, 0, 0, 0.06, 0.05));                             // where the nuts sat
  g.restore();
}
// [x, y, length, turn, split], back to front.
const BEECHNUTS = [[-0.34, 0.08, 0.32, -0.6, false], [0.06, 0.02, 0.32, 0.5, false], [0.4, 0.1, 0.3, -0.3, true],
  [-0.5, 0.28, 0.32, 0.2, true], [-0.1, 0.26, 0.34, 2.8, false], [0.26, 0.3, 0.34, -0.1, false], [0.6, 0.34, 0.28, 2.5, false]];
function paintToastedBeechnuts(g) {
  const ly = 0.3;                                              // the leaf's middle
  sitShadow(g, 0.04, ly + 0.32, 0.9, 0.14, 0.28);
  // The leaf: oval and pointed off to the right, its stalk to the left.
  const leaf = () => {
    g.moveTo(-0.84, ly);
    g.bezierCurveTo(-0.84, ly - 0.32, -0.3, ly - 0.38, 0.14, ly - 0.32);
    g.bezierCurveTo(0.56, ly - 0.26, 0.86, ly - 0.14, 1.0, ly - 0.04);
    g.bezierCurveTo(0.84, ly + 0.16, 0.52, ly + 0.32, 0.08, ly + 0.34);
    g.bezierCurveTo(-0.38, ly + 0.36, -0.82, ly + 0.28, -0.84, ly);
    g.closePath();
  };
  strokeIn(g, rgba([110, 70, 36]), 0.04, () => { g.moveTo(-0.82, ly + 0.02); g.quadraticCurveTo(-0.96, ly + 0.02, -1.04, ly + 0.12); });   // its stalk
  softIn(g, BEECH_LEAF, ly - 0.36, ly + 0.36, leaf, 1.2, 0.66);
  g.save(); g.beginPath(); leaf(); g.clip();
  furGlow(g, [140, 60, 24], 0.5, 0.5, ly + 0.08, 0.4, 0.24);                                    // gone browner toward the tip
  furGlow(g, [236, 170, 80], 0.4, -0.4, ly - 0.08, 0.3, 0.14);
  strokeIn(g, rgba(tone(BEECH_LEAF, 0.74), 0.4), 0.011, () => {                                 // the straight veins, side by side
    for (let i = 0; i < 8; i++) { const x = -0.66 + i * 0.2, y = ly - 0.01 - (x + 0.82) * 0.025; g.moveTo(x, y); g.lineTo(x + 0.2, y - 0.3 + i * 0.012); g.moveTo(x, y); g.lineTo(x + 0.2, y + 0.32 - i * 0.02); }
  });
  strokeIn(g, rgba(tone(BEECH_LEAF, 1.3, 20), 0.75), 0.022, () => { g.moveTo(-0.82, ly + 0.01); g.quadraticCurveTo(0.1, ly - 0.02, 0.98, ly - 0.04); });   // the midrib
  g.restore();
  // The curled front edge, catching the light; the back edge's lip.
  strokeIn(g, rgba(tone(BEECH_LEAF, 0.6), 0.7), 0.018, () => { g.moveTo(-0.74, ly + 0.2); g.bezierCurveTo(-0.4, ly + 0.38, 0.44, ly + 0.38, 0.94, ly + 0.04); });
  strokeIn(g, rgba(tone(BEECH_LEAF, 1.3, 24)), 0.05, () => { g.moveTo(-0.78, ly + 0.14); g.bezierCurveTo(-0.44, ly + 0.33, 0.42, ly + 0.33, 0.92, ly + 0.01); });
  strokeIn(g, rgba(tone(BEECH_LEAF, 1.12, 12), 0.8), 0.028, () => { g.moveTo(-0.78, ly - 0.16); g.bezierCurveTo(-0.44, ly - 0.36, 0.42, ly - 0.32, 0.94, ly - 0.08); });
  // The husk at the back, and the nuts heaped in front of it.
  beechHuskAt(g, 0.5, ly - 0.2, 0.9, 0.3);
  for (const [x, y, l, rot, split] of BEECHNUTS) beechnutAt(g, x, y - 0.1, l, rot, split);
  beechnutAt(g, -0.12, ly - 0.2, 0.32, 1.0, false);                                               // one on top of the heap
  fillIn(g, rgba([76, 40, 18], 0.85), () => { for (const [x, y, a] of [[-0.62, ly + 0.1, 0.4], [0.68, ly + 0.08, -0.6], [0.34, ly + 0.3, 1.2], [-0.56, ly - 0.08, 2]]) ovalAt(g, x, y, 0.026, 0.012, a); });   // bits of shell
  // Still warm: a wisp of heat off the heap.
  strokeIn(g, 'rgba(255, 250, 240, 0.28)', 0.035, () => { g.moveTo(-0.1, -0.12); g.bezierCurveTo(-0.18, -0.3, 0.0, -0.4, -0.08, -0.6); g.moveTo(0.18, -0.08); g.bezierCurveTo(0.12, -0.24, 0.28, -0.32, 0.22, -0.5); });
}

// ------------------------------------------------------------------ toasted hazelnuts
//
// Hazelnuts rolled in the embers till their skins crackled, heaped in the carved wooden bowl: the kernels round and pointed,
// toasted gold and darker where they lay on the coals, the papery brown skin still on them in patches and flaking off. In
// front of the bowl, one still whole in its glossy striped shell with its pale scar at the foot, the half of a cracked shell,
// and a few curls of rubbed-off skin.
const HAZEL = [204, 142, 72], HAZEL_SKIN = [118, 60, 30], HAZEL_SHELL = [160, 98, 48], HAZEL_SCAR = [214, 186, 140];
const hazelPath = (g, r) => {
  g.moveTo(0, -r * 1.08);
  g.bezierCurveTo(r * 0.45, -r * 1.02, r * 1.0, -r * 0.5, r * 0.98, r * 0.1);
  g.bezierCurveTo(r * 0.95, r * 0.72, r * 0.5, r, 0, r);
  g.bezierCurveTo(-r * 0.5, r, -r * 0.95, r * 0.72, -r * 0.98, r * 0.1);
  g.bezierCurveTo(-r * 1.0, -r * 0.5, -r * 0.45, -r * 1.02, 0, -r * 1.08);
  g.closePath();
};
// Where the skin's still on a kernel: torn patches as point lists in its radius, a few to pick from.
const HAZEL_SKINS = [
  [[0.1, -0.2, 0.6, -0.5, 1.1, -0.1, 1.1, 0.8, 0.3, 1.1, 0.2, 0.7, 0.4, 0.4, 0.05, 0.2], [-1.1, -0.6, -0.6, -0.9, -0.5, -0.6, -0.8, -0.4, -1.1, -0.1]],
  [[-1.1, -0.2, -0.5, -0.4, -0.2, 0.0, -0.4, 0.3, -0.1, 0.6, -0.3, 1.1, -1.1, 0.8], [0.3, -1.1, 0.7, -0.8, 0.5, -0.5, 0.2, -0.6]],
  [[-0.9, 0.4, -0.4, 0.3, -0.1, 0.5, 0.3, 0.3, 0.6, 0.5, 1.0, 0.2, 1.1, 1.1, -1.1, 1.1], [0.4, -0.7, 0.9, -0.6, 1.1, -0.2, 0.7, -0.1, 0.6, -0.4]],
];
// A toasted kernel, radius r, its point turned by rot; k picks where the skin's left on it.
function hazelKernelAt(g, x, y, r, rot, k = 0) {
  furGlow(g, [60, 30, 12], 0.4, x + r * 0.12, y + r * 0.72, r * 1.0, r * 0.38);
  g.save(); g.translate(x, y); g.rotate(rot);
  softIn(g, HAZEL, -r, r, () => hazelPath(g, r), 1.25, 0.62);
  g.save(); g.beginPath(); hazelPath(g, r); g.clip();
  furGlow(g, [120, 62, 22], 0.55, r * 0.42, r * 0.46, r * 0.62, r * 0.58);                    // round: the shade side
  furGlow(g, [150, 80, 28], 0.5, r * (k % 2 ? -0.3 : 0.3), -r * 0.1, r * 0.34, r * 0.3);       // toasted darker where it lay on the coals
  const skin = HAZEL_SKINS[k % HAZEL_SKINS.length];                                            // what's left of the skin, torn papery
  const torn = () => { for (const P of skin) { g.moveTo(P[0] * r, P[1] * r); for (let i = 2; i < P.length; i += 2) g.lineTo(P[i] * r, P[i + 1] * r); g.closePath(); } };
  fillIn(g, rgba(HAZEL_SKIN, 0.94), torn);
  strokeIn(g, rgba(tone(HAZEL_SKIN, 1.6, 30), 0.6), r * 0.05, torn);                             // its curling edge, catching the light
  strokeIn(g, rgba(tone(HAZEL_SKIN, 0.7), 0.6), r * 0.035, () => { for (const P of skin) { g.moveTo(P[0] * r * 0.7, P[1] * r * 0.7 + P[3] * r * 0.3); g.lineTo(P[2] * r * 0.8 + P[4] * r * 0.2, P[3] * r * 0.8 + P[5] * r * 0.2); } });   // a vein in it
  g.restore();
  furGlow(g, [255, 246, 226], 0.5, -r * 0.36, -r * 0.42, r * 0.26, r * 0.14, -0.6);            // a sheen of its oil
  g.restore();
}
// A hazelnut still whole in its shell, glossy and striped, its pale scar across the foot.
function hazelShellAt(g, x, y, r, rot) {
  furGlow(g, [50, 26, 10], 0.45, x + r * 0.15, y + r * 0.8, r * 1.1, r * 0.36);
  g.save(); g.translate(x, y); g.rotate(rot);
  softIn(g, HAZEL_SHELL, -r, r, () => hazelPath(g, r), 1.3, 0.6);
  g.save(); g.beginPath(); hazelPath(g, r); g.clip();
  furGlow(g, [70, 34, 14], 0.55, r * 0.46, r * 0.3, r * 0.6, r * 0.7);
  strokeIn(g, rgba(tone(HAZEL_SHELL, 0.7), 0.5), r * 0.04, () => { for (const s of [-0.6, -0.3, 0, 0.3, 0.6]) { g.moveTo(s * r * 1.2, r); g.quadraticCurveTo(s * r * 1.1, -r * 0.2, 0, -r * 1.08); } });   // its stripes
  softIn(g, HAZEL_SCAR, r * 0.5, r, () => ovalAt(g, 0, r * 0.86, r * 0.82, r * 0.3), 1.05, 0.8);   // the pale scar at its foot
  fillIn(g, rgba(tone(HAZEL_SCAR, 0.8), 0.7), () => { for (const [u, v] of [[-0.3, 0.8], [0.1, 0.9], [0.4, 0.78], [-0.05, 0.72]]) ovalAt(g, u * r, v * r, r * 0.04, r * 0.03); });
  g.restore();
  furGlow(g, [255, 240, 220], 0.7, -r * 0.34, -r * 0.4, r * 0.24, r * 0.12, -0.7);              // glossy
  g.restore();
}
function paintToastedHazelnuts(g) {
  const { cy, IX, IY } = BOWL;
  woodBowl(g, () => {
    softIn(g, [140, 86, 40], -0.24, cy + IY, () => { g.moveTo(-IX, cy + 0.02); g.bezierCurveTo(-0.7, -0.26, 0.7, -0.26, IX, cy + 0.02); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); }, 1.1, 0.5);   // the nuts deeper down
    furGlow(g, [40, 20, 8], 0.55, 0.1, cy + 0.12, IX * 0.8, IY * 0.6);
    for (const [x, y, r, rot, k] of [[-0.46, -0.04, 0.17, -0.5, 0], [-0.12, -0.12, 0.17, 0.2, 1], [0.22, -0.1, 0.17, -0.3, 2], [0.52, -0.02, 0.16, 0.6, 0],
      [-0.6, 0.1, 0.16, -0.9, 1], [-0.28, 0.08, 0.18, 0.4, 2], [0.06, 0.06, 0.18, -0.1, 0], [0.38, 0.1, 0.17, 0.8, 1], [0.64, 0.12, 0.15, 0.3, 2],
      [-0.06, -0.26, 0.16, -0.6, 2], [0.28, -0.24, 0.15, 0.5, 0]]) hazelKernelAt(g, x, y, r, rot, k);
    fillIn(g, rgba(HAZEL_SKIN, 0.9), () => { for (const [x, y, a] of [[-0.36, -0.2, 0.5], [0.12, -0.32, -0.6], [0.46, -0.16, 1.2], [-0.04, 0.18, 0.2]]) ovalAt(g, x, y, 0.03, 0.014, a); });   // flakes of skin
  });
  // In front: one still in its shell, a cracked half, curls of skin.
  g.save(); g.translate(0.62, 0.62); g.rotate(0.5);                                              // the cracked half, its hollow up
  furGlow(g, [50, 26, 10], 0.4, 0.02, 0.06, 0.2, 0.08);
  softIn(g, HAZEL_SHELL, -0.08, 0.1, () => { g.moveTo(-0.15, -0.02); g.quadraticCurveTo(0, 0.18, 0.15, -0.02); g.closePath(); }, 1.2, 0.6);
  fillIn(g, rgba([226, 196, 150]), () => { g.moveTo(-0.15, -0.02); g.lineTo(-0.1, -0.05); g.lineTo(-0.05, -0.02); g.lineTo(0, -0.06); g.lineTo(0.06, -0.03); g.lineTo(0.15, -0.02); g.quadraticCurveTo(0, 0.08, -0.15, -0.02); g.closePath(); });
  g.restore();
  hazelShellAt(g, -0.62, 0.56, 0.15, -0.35);
  strokeIn(g, rgba(HAZEL_SKIN, 0.9), 0.018, () => { g.moveTo(-0.3, 0.74); g.quadraticCurveTo(-0.26, 0.7, -0.22, 0.74); g.moveTo(0.3, 0.76); g.quadraticCurveTo(0.34, 0.72, 0.38, 0.75); });
}

// ------------------------------------------------------------------ hazelnut brittle
//
// Honey boiled down and poured over chopped toasted hazelnuts, set hard on the hot stone and broken up into the carved
// bowl: shards the colour of dark amber, their broken edges lit where the light comes thin through them, the nuts set in
// them like flies in resin and drawn over with a skin of candy. Bubbles caught in it, crumbs, a whole kernel or two on
// top, and a shell and a hazel leaf at its foot.
const BRITTLE = [176, 92, 22], BRITTLE_LIGHT = [255, 200, 110], BRITTLE_DEEP = [96, 38, 6];
// A chopped hazelnut set in the candy: a pale angular shard of kernel with a strip of its brown skin, r across, under amber.
const NUT_SHARDS = [
  [[1, -0.5], [0.3, -0.9], [-0.8, -0.4], [-0.9, 0.5], [0.2, 0.9], [0.9, 0.4]],
  [[0.9, -0.3], [0.1, -1], [-0.9, -0.2], [-0.4, 0.8], [0.6, 0.9]],
  [[0.8, -0.6], [-0.4, -0.9], [-1, 0.1], [-0.2, 0.9], [0.9, 0.5]],
];
function brittleNutAt(g, x, y, r, rot, k = 0) {
  const P = NUT_SHARDS[k % NUT_SHARDS.length];
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(r, r);
  const path = () => { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); };
  fillIn(g, 'rgba(46, 22, 6, 0.35)', () => { g.save(); g.translate(0.16, 0.3); path(); g.restore(); });   // where it lies in the candy
  fillIn(g, rgba([202, 152, 82]), path);                                                      // the kernel
  fillIn(g, rgba([230, 186, 116], 0.9), () => { g.moveTo(P[0][0], P[0][1]); g.lineTo(P[1][0], P[1][1]); g.lineTo(P[2][0], P[2][1]); g.lineTo(0, 0); g.closePath(); });   // its lit face
  strokeIn(g, rgba([100, 50, 22], 0.9), 0.28, () => { g.moveTo(P[2][0], P[2][1]); g.lineTo(P[3][0], P[3][1]); });   // a strip of skin
  strokeIn(g, rgba([150, 96, 48], 0.7), 0.12, path);                                          // its edge in the amber
  g.restore();
  g.save(); g.translate(x, y); g.rotate(rot);
  fillIn(g, 'rgba(190, 100, 24, 0.16)', () => { g.moveTo(P[0][0] * r, P[0][1] * r); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0] * r, P[i][1] * r); g.closePath(); });   // the candy drawn thin over it
  strokeIn(g, 'rgba(255, 240, 198, 0.5)', r * 0.07, () => { g.moveTo(P[0][0] * r * 0.8, P[0][1] * r * 0.8); g.lineTo(P[1][0] * r * 0.8, P[1][1] * r * 0.8); });
  g.restore();
}
// A shard of the brittle: its outline (in the painting's box, before sy is added), where its nuts and bubbles are, its shade,
// how thick the edge of the slab is, and the cracks run through it.
function brittleShardAt(g, sy, pts, k, nuts, bubbles, thick = 0.014, cracks = []) {
  const path = () => { g.moveTo(pts[0][0], sy + pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], sy + pts[i][1]); g.closePath(); };
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1] + sy);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  furGlow(g, [50, 28, 10], 0.24, (x0 + x1) / 2 + 0.03, y1 + 0.05, (x1 - x0) * 0.46, (y1 - y0) * 0.38);   // where it sits
  g.save(); g.translate(0.006, thick); fillIn(g, rgba(tone(BRITTLE, 1.12, 16)), path); g.restore();  // light through the thin edge of the break
  softIn(g, tone(BRITTLE, k), y0, y1, path, 0.9, 0.5);
  g.save(); g.beginPath(); path(); g.clip();
  furGlow(g, BRITTLE_LIGHT, 0.3, x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.28, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  furGlow(g, BRITTLE_DEEP, 0.42, (x0 + x1) / 2, (y0 + y1) / 2 + (y1 - y0) * 0.16, (x1 - x0) * 0.3, (y1 - y0) * 0.24);
  furGlow(g, BRITTLE_DEEP, 0.55, x1 - (x1 - x0) * 0.18, y1 - (y1 - y0) * 0.18, (x1 - x0) * 0.42, (y1 - y0) * 0.34);
  strokeIn(g, rgba(tone(BRITTLE, 1.42, 30), 0.4), 0.07, path);                                  // light coming through the thin edge
  strokeIn(g, 'rgba(255, 238, 190, 0.45)', 0.015, path);
  // A long window of light across the face, and a couple of hard glints on it.
  furGlow(g, [255, 250, 236], 0.5, x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.34, (x1 - x0) * 0.24, (y1 - y0) * 0.08, -0.35);
  fillIn(g, 'rgba(255, 252, 242, 0.72)', () => { ovalAt(g, x0 + (x1 - x0) * 0.26, y0 + (y1 - y0) * 0.28, (x1 - x0) * 0.09, 0.016, -0.35); ovalAt(g, x0 + (x1 - x0) * 0.52, y0 + (y1 - y0) * 0.2, (x1 - x0) * 0.045, 0.01, -0.35); ovalAt(g, x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.34, (x1 - x0) * 0.03, 0.008, -0.35); });
  strokeIn(g, rgba(tone(BRITTLE, 0.66), 0.25), 0.01, () => {                                     // the pour's streaks, deeper amber
    g.moveTo(x0 + (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.52); g.bezierCurveTo(x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4, x0 + (x1 - x0) * 0.62, y0 + (y1 - y0) * 0.6, x1 - (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.5);
  });
  // Cracks run through the slab: a dark fracture with a thread of light along one side.
  for (const line of cracks) {
    const crack = () => { g.moveTo(line[0][0], sy + line[0][1]); for (let i = 1; i < line.length; i++) { const [px, py] = line[i]; g.lineTo(px, sy + py); } };
    strokeIn(g, 'rgba(112, 48, 8, 0.5)', 0.014, crack);
    strokeIn(g, 'rgba(255, 232, 180, 0.4)', 0.006, () => { g.save(); g.translate(-0.004, -0.006); crack(); g.restore(); });
  }
  for (const [x, y, r, rot, kk] of nuts) brittleNutAt(g, x, sy + y, r, rot, kk || 0);
  fillIn(g, 'rgba(255, 240, 190, 0.55)', () => { for (const [x, y, r] of bubbles) ovalAt(g, x, sy + y, r, r * 0.72); });   // bubbles caught in it
  fillIn(g, 'rgba(255, 255, 250, 0.8)', () => { for (const [x, y, r] of bubbles) ovalAt(g, x - r * 0.25, sy + y - r * 0.25, r * 0.3, r * 0.22); });
  strokeIn(g, 'rgba(120, 54, 10, 0.4)', 0.005, () => { for (const [x, y, r] of bubbles) g.ellipse(x, sy + y, r, r * 0.72, 0, -0.4, Math.PI - 0.2); });
  g.restore();
  strokeIn(g, rgba(tone(BRITTLE, 0.5), 0.5), 0.014, path);                                      // its edge, dark against the bowl
  const edge = g.createLinearGradient(x0, y0, x1, y1);                                           // lit only where the light falls on it
  edge.addColorStop(0, 'rgba(255, 240, 196, 0.7)'); edge.addColorStop(0.45, 'rgba(255, 216, 140, 0.25)'); edge.addColorStop(0.75, 'rgba(255, 216, 140, 0)');
  strokeIn(g, edge, 0.012, () => { g.save(); g.translate(-0.003, -0.008); path(); g.restore(); });
}
function paintHazelnutBrittle(g) {
  const { cy, IX, IY } = BOWL;
  woodBowl(g, () => {
    furGlow(g, [46, 24, 8], 0.4, 0.06, cy + 0.12, IX * 0.9, IY * 0.7);                          // the shadow in the hollow
    // A thin sheet of it set in the bottom, so the bowl is full, then the broken shards heaped over it.
    softIn(g, tone(BRITTLE, 0.82), cy - 0.08, cy + 0.16, () => ovalAt(g, 0, cy + 0.02, IX * 0.92, IY * 0.84), 1.15, 0.6);
    furGlow(g, BRITTLE_LIGHT, 0.3, -0.2, cy - 0.04, 0.4, 0.08);
    strokeIn(g, 'rgba(255, 232, 176, 0.3)', 0.01, () => ovalAt(g, 0, cy + 0.02, IX * 0.72, IY * 0.6));
    brittleShardAt(g, cy, [[-0.72, -0.04], [-0.62, -0.32], [-0.3, -0.38], [-0.08, -0.22], [-0.14, 0.04], [-0.4, 0.12], [-0.62, 0.1]], 1.0,
      [[-0.54, -0.16, 0.06, -0.4, 0], [-0.34, -0.06, 0.055, 0.7, 1], [-0.5, 0.04, 0.045, 0.2, 2]], [[-0.62, -0.02, 0.012], [-0.4, -0.28, 0.009], [-0.2, -0.12, 0.011], [-0.58, -0.2, 0.007], [-0.48, 0.02, 0.006], [-0.3, -0.18, 0.005], [-0.24, 0.0, 0.007], [-0.66, 0.04, 0.005]], 0.014, [[[-0.4, -0.36], [-0.36, -0.12], [-0.44, 0.02]]]);
    brittleShardAt(g, cy, [[-0.02, -0.4], [0.28, -0.44], [0.58, -0.3], [0.7, -0.08], [0.54, 0.1], [0.24, 0.06], [0.04, -0.16]], 1.05,
      [[0.2, -0.24, 0.06, 0.2, 2], [0.46, -0.12, 0.055, -0.7, 0], [0.32, 0.0, 0.045, 0.5, 1]], [[0.5, -0.28, 0.011], [0.12, -0.3, 0.009], [0.4, -0.36, 0.006], [0.56, -0.16, 0.007], [0.3, -0.08, 0.005], [0.16, -0.18, 0.006], [0.58, -0.04, 0.005]], 0.014, [[[0.34, -0.42], [0.3, -0.14], [0.42, 0.0]]]);
    brittleShardAt(g, cy, [[-0.56, 0.18], [-0.36, 0.02], [-0.06, 0.08], [0.2, 0.0], [0.46, 0.1], [0.38, 0.28], [0.08, 0.34], [-0.24, 0.32], [-0.48, 0.3]], 1.02,
      [[-0.3, 0.14, 0.06, 0.4, 1], [0.0, 0.16, 0.055, -0.2, 2], [0.26, 0.14, 0.05, 0.9, 0]], [[-0.4, 0.1, 0.011], [0.12, 0.24, 0.009], [0.4, 0.2, 0.008], [-0.44, 0.2, 0.006], [-0.1, 0.24, 0.005], [0.26, 0.26, 0.006], [0.44, 0.24, 0.005]], 0.014, [[[-0.2, 0.02], [-0.14, 0.16], [-0.24, 0.3]]]);
    // A thin sliver come away and lying across the front.
    g.save(); g.translate(0.24, cy + 0.14); g.rotate(-0.3); g.translate(-0.24, -cy - 0.14);
    brittleShardAt(g, cy, [[-0.34, 0.16], [-0.16, 0.06], [0.06, 0.1], [0.12, 0.18], [-0.08, 0.26], [-0.3, 0.26]], 1.12,
      [[-0.1, 0.16, 0.035, 0.4, 0]], [[0.0, 0.12, 0.007]], 0.012);
    g.restore();
    // Three whole kernels on top, glossy from the candy, and a scatter of chopped nuts and crumbs.
    hazelKernelAt(g, 0.46, cy + 0.2, 0.095, 0.5, 0);
    hazelKernelAt(g, -0.5, cy + 0.24, 0.085, -0.6, 2);
    hazelKernelAt(g, 0.06, cy + 0.3, 0.08, 0.2, 1);
    for (const [x, y, r, rot, k] of [[-0.16, 0.22, 0.04, 0.4, 2], [0.18, 0.28, 0.035, -0.5, 0], [0.56, 0.26, 0.035, 1.1, 1], [-0.36, 0.28, 0.03, 0.3, 2], [0.04, -0.02, 0.04, -0.8, 0]]) brittleNutAt(g, x, cy + y, r, rot, k);
    fillIn(g, rgba(tone(BRITTLE, 0.92), 0.95), () => { for (const [x, y, a] of [[-0.44, 0.2, 0.4], [-0.08, 0.26, -0.6], [0.36, 0.2, 1.1], [0.62, 0.24, 0.2], [0.24, 0.3, -0.3]]) ovalAt(g, x, cy + y * 0.6, 0.024, 0.011, a); });
  });
  // A hazelnut shell at its foot, a leaf under it, and a crumb or two on the ground.
  g.save(); g.translate(-0.52, 0.62); g.rotate(0.4);
  softIn(g, [108, 138, 58], -0.14, 0.12, () => { g.moveTo(0, 0); g.bezierCurveTo(-0.08, -0.14, -0.2, -0.14, -0.26, -0.02); g.bezierCurveTo(-0.2, 0.12, -0.06, 0.14, 0, 0); g.closePath(); }, 1.2, 0.66);
  strokeIn(g, 'rgba(78, 100, 40, 0.7)', 0.01, () => { g.moveTo(0, 0); g.quadraticCurveTo(-0.12, -0.02, -0.24, -0.01); });
  fillIn(g, rgba([130, 160, 76]), () => { for (let i = 0; i < 7; i++) { const t = i / 7, x = -0.22 * t, y = -0.02 * t; ovalAt(g, x, y - 0.05, 0.03, 0.012, -0.6); ovalAt(g, x, y + 0.05, 0.03, 0.012, 0.6); } });
  g.restore();
  g.save(); g.translate(-0.62, 0.7); g.rotate(-0.5);
  softIn(g, [96, 126, 52], -0.12, 0.1, () => { g.moveTo(0, 0); g.bezierCurveTo(-0.06, -0.12, -0.18, -0.12, -0.24, 0); g.bezierCurveTo(-0.18, 0.1, -0.05, 0.12, 0, 0); g.closePath(); }, 1.2, 0.66);
  strokeIn(g, 'rgba(70, 92, 36, 0.7)', 0.008, () => { g.moveTo(0, 0); g.quadraticCurveTo(-0.1, 0.0, -0.22, 0.0); });
  g.restore();
  hazelShellAt(g, -0.76, 0.6, 0.13, -0.4);
  fillIn(g, rgba(tone(BRITTLE, 0.9), 0.9), () => { for (const [x, y, a] of [[0.44, 0.66, 0.3], [0.56, 0.62, -0.4], [0.3, 0.7, 1.0]]) ovalAt(g, x, y, 0.026, 0.012, a); });
}

// ------------------------------------------------------------------ mushrooms with hazelnuts
//
// Mushrooms fried soft in a shallow clay pan, two little lugs on its sides to lift it off the fire by: the pan wide and low,
// sooty underneath, its rim rolled. In it a slick of brown buttery juice, the mushrooms halved and whole, golden and glossy,
// and over the top at the last moment the hazelnuts, crushed: crumbs and shards of gold kernel with their torn brown skin,
// a few halves among them, and a pinch of green.
const PAN = [170, 96, 60], PAN_RIM = [200, 130, 88], PAN_IN = [96, 50, 30], JUS = [150, 86, 36], FRIED = [226, 176, 112];
// A shard of crushed hazelnut, about s across: a few corners, a lit face and a shaded one, brown skin along one edge.
const SHARDS = [[1, -0.6, 0.3, -1, -0.8, -0.5, -0.9, 0.6, 0.4, 0.9], [0.9, -0.2, -0.1, -0.9, -1, 0.1, -0.3, 0.9, 0.8, 0.7], [0.7, -0.8, -0.6, -0.7, -0.9, 0.4, 0.2, 1, 1, 0.3]];
function shardAt(g, x, y, s, rot, k) {
  const P = SHARDS[k % SHARDS.length];
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const path = () => { g.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]); g.closePath(); };
  fillIn(g, 'rgba(40, 20, 8, 0.35)', () => { g.save(); g.translate(0.15, 0.3); path(); g.restore(); });   // where it lies
  fillIn(g, rgba(HAZEL), path);
  fillIn(g, rgba(tone(HAZEL, 1.18, 16)), () => { g.moveTo(P[0], P[1]); g.lineTo(P[2], P[3]); g.lineTo(P[4], P[5]); g.lineTo(0, 0); g.closePath(); });   // the face toward the light
  strokeIn(g, rgba(HAZEL_SKIN, 0.9), 0.32, () => { g.moveTo(P[6], P[7]); g.lineTo(P[8], P[9]); });                  // a strip of skin
  g.restore();
}
// The clay pan, with what's in it painted by inside() held in its hollow (only what's above the front of the rim shows).
const CLAY_PAN = { cy: 0.08, IX: 0.76, IY: 0.24 };
function clayPan(g, inside) {
  const { cy, IX, IY } = CLAY_PAN, RX = 0.86, RY = 0.3, D = 0.2;   // the rim, outside and in, and how deep the pan stands
  sitShadow(g, 0, cy + D + 0.3, 0.86, 0.14, 0.34);
  // The lugs, then the pan's low wall under the rim, lit from the left, sooty underneath.
  for (const s of [-1, 1]) {
    const lug = () => { g.moveTo(s * (RX - 0.04), cy - 0.06); g.quadraticCurveTo(s * (RX + 0.14), cy - 0.04, s * (RX + 0.12), cy + 0.06); g.quadraticCurveTo(s * (RX + 0.08), cy + 0.14, s * (RX - 0.04), cy + 0.12); g.closePath(); };
    softIn(g, s < 0 ? PAN : tone(PAN, 0.8), cy - 0.06, cy + 0.14, lug, 1.2, 0.6);
    strokeIn(g, rgba(tone(PAN, 0.55), 0.6), 0.014, lug);
  }
  const wall = () => {
    g.moveTo(-RX, cy);
    g.bezierCurveTo(-RX, cy + D * 0.8, -RX + 0.08, cy + RY + D, -0.3, cy + RY + D);
    g.lineTo(0.3, cy + RY + D);
    g.bezierCurveTo(RX - 0.08, cy + RY + D, RX, cy + D * 0.8, RX, cy);
    g.ellipse(0, cy, RX, RY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, PAN, cy, cy + RY + D, wall, 1.15, 0.6);
  g.save(); g.beginPath(); wall(); g.clip();
  furGlow(g, [80, 34, 20], 0.55, 0.58, cy + RY, 0.5, 0.26);                                    // round: the shade side
  furGlow(g, [255, 214, 176], 0.3, -0.56, cy + RY * 0.8, 0.2, 0.08, -0.2);                     // the light on its side
  furGlow(g, [40, 28, 24], 0.55, 0.2, cy + RY + D, 0.8, 0.1);                                  // soot along its foot
  g.restore();
  // The rim rolled thick, and the hollow.
  fillIn(g, rgba(PAN_RIM), () => ovalAt(g, 0, cy, RX, RY));
  furGlow(g, [255, 236, 210], 0.4, -0.56, cy + 0.12, 0.22, 0.08, 0.35);
  softIn(g, PAN_IN, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.01, IX, IY), 1.55, 0.6);
  const held = () => { g.moveTo(-IX, cy); g.lineTo(-IX - 0.2, -1.3); g.lineTo(IX + 0.2, -1.3); g.lineTo(IX, cy); g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI); g.closePath(); };
  g.save(); g.beginPath(); held(); g.clip();
  inside();
  g.restore();
  // The front of the rim: rolled, catching the light; its outer edge.
  strokeIn(g, rgba(tone(PAN_RIM, 1.12, 14), 0.9), 0.024, () => g.ellipse(0, cy + 0.01, IX, IY, 0, 0.12, Math.PI - 0.12));
  strokeIn(g, rgba(tone(PAN, 0.6), 0.6), 0.016, () => g.ellipse(0, cy, RX, RY, 0, 0.05, Math.PI - 0.05));
}
function paintMushroomsHazelnuts(g) {
  const { cy, IX, IY } = CLAY_PAN;
  clayPan(g, () => {
    // The juice, buttery brown, a line of light along its far edge.
    softIn(g, JUS, cy - IY * 0.8, cy + IY, () => ovalAt(g, 0, cy + 0.03, IX * 0.96, IY * 0.86), 1.2, 0.7);
    strokeIn(g, 'rgba(255, 220, 150, 0.55)', 0.016, () => g.ellipse(0, cy + 0.03, IX * 0.9, IY * 0.8, 0, Math.PI + 0.5, TAU - 0.4));
    // The mushrooms, back ones first.
    capAt(g, -0.42, cy - 0.12, 0.7, -0.3);
    halfShroomAt(g, 0.04, cy - 0.16, 0.84, 0.15, FRIED);
    capAt(g, 0.46, cy - 0.1, 0.72, 0.35);
    halfShroomAt(g, -0.3, cy + 0.06, 0.86, -0.4, FRIED);
    halfShroomAt(g, 0.32, cy + 0.08, 0.84, 0.3, FRIED);
    capAt(g, 0.02, cy + 0.12, 0.62, 0.05);
    // The hazelnuts crushed over: halves, shards and crumbs.
    for (const [x, y, r, rot, k] of [[-0.12, cy - 0.06, 0.09, 0.6, 1], [0.24, cy - 0.02, 0.085, -0.8, 2], [-0.5, cy + 0.04, 0.08, 1.4, 0]]) hazelKernelAt(g, x, y, r, rot, k);
    for (const [x, y, s, rot, k] of [[-0.24, cy - 0.16, 0.045, 0.3, 0], [0.12, cy - 0.28, 0.04, 1.2, 1], [0.44, cy - 0.2, 0.042, -0.6, 2], [-0.04, cy + 0.02, 0.05, 2.2, 1],
      [0.4, cy + 0.04, 0.04, 0.9, 0], [-0.38, cy - 0.04, 0.042, -1.1, 2], [0.12, cy + 0.14, 0.046, 0.4, 0], [-0.18, cy + 0.12, 0.038, 1.8, 1], [0.58, cy - 0.04, 0.036, 0.2, 1], [-0.58, cy - 0.12, 0.036, -0.4, 0]]) shardAt(g, x, y, s, rot, k);
    fillIn(g, rgba(tone(HAZEL, 1.1, 10)), () => { for (const [x, y] of [[-0.3, cy - 0.24], [0.02, cy - 0.12], [0.3, cy - 0.12], [-0.08, cy + 0.08], [0.22, cy + 0.12], [-0.44, cy + 0.12], [0.5, cy + 0.12], [0.06, cy - 0.32], [-0.2, cy + 0.0]]) ovalAt(g, x, y, 0.018, 0.013); });   // crumbs
    fillIn(g, rgba([92, 150, 60]), () => { for (const [x, y, a] of [[-0.16, cy - 0.22, 0.5], [0.34, cy - 0.06, -0.8], [-0.4, cy + 0.08, 1.2], [0.08, cy + 0.04, -0.2], [0.52, cy - 0.16, 0.3]]) ovalAt(g, x, y, 0.024, 0.011, a); });   // a pinch of green
    fillIn(g, 'rgba(255, 252, 236, 0.85)', () => { ovalAt(g, -0.34, cy + 0.14, 0.014, 0.009); ovalAt(g, 0.42, cy + 0.16, 0.012, 0.008); });   // the juice glinting
  });
}

// ------------------------------------------------------------------ dandelion fritters
//
// Dandelion heads dipped by the stalk in batter and fried, laid out on a round slice of log: its end grain pale, the rings
// running round, a crack in from the edge, the bark left on round its side. The fritters are crisp golden rounds with lacy
// edges, the yellow of the petals showing through the batter round the rim, browned in spots, each with its green stalk
// left on to hold it by. Honey drizzled over them in a line, a drop of it on the board, and one fresh flower beside.
const LOG = [214, 172, 116], LOG_BARK = [100, 72, 50], BATTER = [232, 170, 70];
// A fritter, radius r, its stalk out at angle a; k varies its lacy edge.
function fritterAt(g, x, y, r, a, k) {
  const ox = Math.cos(a), oy = Math.sin(a) * 0.6;
  // The stalk, out from under it, a little batter on its foot.
  strokeIn(g, rgba([70, 110, 46]), r * 0.16, () => { g.moveTo(x + ox * r * 0.5, y + oy * r * 0.5); g.quadraticCurveTo(x + ox * r * 1.3, y + oy * r * 1.3 - r * 0.1, x + ox * r * 1.75, y + oy * r * 1.6); });
  strokeIn(g, rgba([150, 196, 96], 0.6), r * 0.05, () => { g.moveTo(x + ox * r * 0.9, y + oy * r * 0.9 - r * 0.04); g.quadraticCurveTo(x + ox * r * 1.3, y + oy * r * 1.3 - r * 0.14, x + ox * r * 1.7, y + oy * r * 1.56 - r * 0.04); });
  furGlow(g, [70, 40, 16], 0.5, x + r * 0.1, y + r * 0.5, r * 1.15, r * 0.5);                  // where it sits
  const n = 36, edge = (dy = 0) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n * TAU, R = r * (1 + 0.07 * Math.sin(t * 5 + k * 1.7) + 0.04 * Math.sin(t * 11 + k * 2.9));
      const px = x + Math.cos(t) * R, py = y + dy + Math.sin(t) * R * 0.66;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };
  // The petals' tips peeking out from under the batter, here and there round its edge.
  fillIn(g, rgba([246, 196, 30]), () => { for (let i = 0; i < 9; i++) { const t = (i + (k % 3) * 0.3) / 9 * TAU; if ((i + k) % 3 === 1) continue; ovalAt(g, x + Math.cos(t) * r * 1.02, y + Math.sin(t) * r * 0.7, r * 0.2, r * 0.07, Math.atan2(Math.sin(t) * 0.66, Math.cos(t))); } });
  softIn(g, tone(BATTER, 0.62), y, y + r * 0.8, () => edge(r * 0.12), 1.0, 0.7);                // its fried underside
  softIn(g, tone(BATTER, 0.92), y - r * 0.6, y + r * 0.7, () => edge(), 1.15, 0.66);
  g.save(); g.beginPath(); edge(); g.clip();
  furGlow(g, [252, 206, 40], 0.75, x + r * 0.05, y + r * 0.04, r * 0.55, r * 0.34);             // the flower's yellow through the batter
  fillIn(g, rgba([250, 200, 36], 0.6), () => { for (let i = 0; i < 5; i++) { const t = i / 7 * TAU + k; ovalAt(g, x + Math.cos(t) * r * 0.62, y + Math.sin(t) * r * 0.4, r * 0.13, r * 0.045, Math.atan2(Math.sin(t) * 0.66, Math.cos(t))); } });
  softIn(g, BATTER, y - r * 0.5, y + r * 0.3, () => ovalAt(g, x - r * 0.12, y - r * 0.14, r * 0.42, r * 0.24, -0.2), 1.3, 0.85);   // puffed up in a crisp blob
  furGlow(g, [150, 80, 24], 0.6, x + r * 0.55, y + r * 0.32, r * 0.5, r * 0.3);                // round: browned on the shade side
  furGlow(g, [150, 80, 24], 0.45, x + (k % 2 ? -r * 0.4 : r * 0.3), y + r * 0.1, r * 0.2, r * 0.12);   // a browner spot
  fillIn(g, rgba([255, 230, 150], 0.8), () => { for (const [u, v] of [[-0.3, -0.24], [0.06, -0.3], [-0.14, 0.02], [0.34, -0.1], [-0.5, 0.06]]) ovalAt(g, x + u * r, y + v * r, r * 0.07, r * 0.045); });   // crisp bubbles
  g.restore();
  strokeIn(g, rgba([150, 86, 30], 0.55), r * 0.04, edge);
  furGlow(g, [255, 246, 220], 0.5, x - r * 0.3, y - r * 0.28, r * 0.24, r * 0.1, -0.3);       // fried glossy
}
function paintDandelionFritters(g) {
  const cy = 0.18, RX = 0.9, RY = 0.36, T = 0.16;              // the log slice's top, and how thick it is
  sitShadow(g, 0, cy + T + 0.26, 0.9, 0.14, 0.34);
  // Its side: the bark, ridged, lit from the left.
  const side = () => { g.moveTo(-RX, cy); g.lineTo(-RX, cy + T); g.ellipse(0, cy + T, RX, RY, 0, Math.PI, 0, true); g.lineTo(RX, cy); g.ellipse(0, cy, RX, RY, 0, 0, Math.PI); g.closePath(); };
  softIn(g, LOG_BARK, cy, cy + RY + T, side, 1.2, 0.6);
  g.save(); g.beginPath(); side(); g.clip();
  furGlow(g, [40, 26, 18], 0.5, 0.6, cy + RY + T * 0.5, 0.5, 0.2);
  strokeIn(g, rgba(tone(LOG_BARK, 0.6), 0.8), 0.016, () => { for (let i = -8; i <= 8; i++) { const x = i * 0.1, k = Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)); g.moveTo(x, cy + RY * k); g.lineTo(x + 0.01, cy + RY * k + T); } });   // its ridges
  g.restore();
  // The end grain: pale, the bark's edge round it, the rings, a crack.
  softIn(g, LOG, cy - RY, cy + RY, () => ovalAt(g, 0, cy, RX, RY), 1.12, 0.84);
  strokeIn(g, rgba(tone(LOG_BARK, 0.9)), 0.04, () => ovalAt(g, 0, cy, RX - 0.02, RY - 0.01));
  strokeIn(g, rgba(tone(LOG, 0.78), 0.55), 0.012, () => { for (const s of [0.18, 0.36, 0.54, 0.7, 0.84]) ovalAt(g, 0.04 * (1 - s), cy + 0.01 * (1 - s), RX * s, RY * s); });
  strokeIn(g, rgba(tone(LOG, 0.6), 0.75), 0.016, () => { g.moveTo(RX - 0.04, cy + 0.06); g.lineTo(0.62, cy + 0.08); g.lineTo(0.48, cy + 0.05); });   // a crack in from the edge
  furGlow(g, [255, 250, 236], 0.26, -0.42, cy - 0.12, 0.34, 0.1, -0.1);
  // A fresh flower at the back, then the fritters, back to front.
  const flower = (x, y, r) => {
    furGlow(g, [70, 50, 16], 0.35, x + 0.02, y + r * 0.4, r * 1.1, r * 0.4);
    fillIn(g, rgba([228, 168, 20]), () => { for (let i = 0; i < 16; i++) { const t = i / 16 * TAU; ovalAt(g, x + Math.cos(t) * r * 0.6, y + Math.sin(t) * r * 0.4, r * 0.42, r * 0.12, Math.atan2(Math.sin(t) * 0.66, Math.cos(t))); } });
    fillIn(g, rgba([252, 214, 52]), () => { for (let i = 0; i < 14; i++) { const t = (i + 0.5) / 14 * TAU; ovalAt(g, x + Math.cos(t) * r * 0.4, y + Math.sin(t) * r * 0.26 - r * 0.04, r * 0.32, r * 0.1, Math.atan2(Math.sin(t) * 0.66, Math.cos(t))); } });
    furGlow(g, [255, 246, 160], 0.8, x - r * 0.06, y - r * 0.08, r * 0.26, r * 0.18);
  };
  strokeIn(g, rgba([70, 110, 46]), 0.026, () => { g.moveTo(0.5, cy - 0.2); g.quadraticCurveTo(0.7, cy - 0.12, 0.8, cy - 0.24); });
  flower(0.48, cy - 0.2, 0.13);
  for (const [x, y, r, a, k] of [[-0.44, cy - 0.12, 0.3, -2.6, 0], [0.08, cy - 0.18, 0.29, -1.9, 1], [-0.2, cy + 0.08, 0.31, 2.7, 2], [0.36, cy + 0.04, 0.3, 0.5, 4]]) fritterAt(g, x, y, r, a, k);
  // The honey drizzled over in a line, and a drop on the board.
  const drizzle = () => { g.moveTo(-0.64, cy - 0.14); g.bezierCurveTo(-0.4, cy - 0.28, -0.3, cy + 0.04, -0.06, cy - 0.12); g.bezierCurveTo(0.14, cy - 0.26, 0.04, cy + 0.12, 0.26, cy + 0.0); g.bezierCurveTo(0.42, cy - 0.08, 0.44, cy + 0.14, 0.6, cy + 0.1); };
  strokeIn(g, rgba(tone(HONEY, 0.8), 0.9), 0.04, drizzle);
  strokeIn(g, rgba(HONEY), 0.028, drizzle);
  strokeIn(g, 'rgba(255, 238, 170, 0.8)', 0.009, () => { g.save(); g.translate(-0.006, -0.008); drizzle(); g.restore(); });
  softIn(g, HONEY, cy + 0.24, cy + 0.32, () => ovalAt(g, 0.12, cy + 0.28, 0.07, 0.035), 1.2, 0.7);
  fillIn(g, 'rgba(255, 244, 200, 0.9)', () => ovalAt(g, 0.1, cy + 0.27, 0.018, 0.009));
}

// ------------------------------------------------------------------ a forager's mess
//
// What comes of a pot that wasn't a dish: the clay bowl again, but chipped at the rim and sooted up its side, heaped over with
// a murky olive-brown sludge, lumpy, slopping over the front and running down the bowl in a thick drip. A wooden spoon stands
// up in it on its own (it's that thick). Bits poke out: a charred black lump, a cherry half sunk, a pale bit of mushroom, a
// limp stalk; a bubble sits on top about to pop, and a glisten or two says it's at least wet.
const SLUDGE = [124, 110, 64], SPOON = [196, 150, 96];
function paintForagersMess(g) {
  const cy = 0.16, RX = 0.74, RY = 0.22, IX = 0.62, IY = 0.16;
  sitShadow(g, 0, 0.7, 0.76, 0.13, 0.34);
  // The bowl, a little lopsided, sooty up the shade side.
  const body = () => {
    g.moveTo(-RX, cy);
    g.bezierCurveTo(-0.94, cy + 0.28, -0.7, 0.7, -0.26, 0.7);
    g.lineTo(0.3, 0.69);
    g.bezierCurveTo(0.76, 0.66, 0.94, cy + 0.24, RX, cy);
    g.ellipse(0, cy, RX, RY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, CLAY, cy - RY, 0.7, body, 1.1, 0.58);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [80, 34, 20], 0.55, 0.56, 0.44, 0.5, 0.36);
  furGlow(g, [255, 214, 176], 0.28, -0.54, 0.32, 0.2, 0.16, -0.3);
  furGlow(g, [40, 28, 24], 0.62, 0.36, 0.62, 0.62, 0.22);                                      // soot, well up its side
  furGlow(g, [40, 28, 24], 0.4, 0.62, 0.34, 0.2, 0.3);
  g.restore();
  // The rim, with a chip out of it at the back left, and the hollow.
  fillIn(g, rgba(CLAY_RIM), () => ovalAt(g, 0, cy, RX, RY));
  fillIn(g, rgba(tone(CLAY, 0.8)), () => { g.moveTo(-0.5, cy - 0.15); g.lineTo(-0.42, cy - 0.11); g.lineTo(-0.34, cy - 0.19); g.closePath(); });
  softIn(g, CLAY_IN, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.01, IX, IY), 1.55, 0.6);
  // The sludge, heaped up lumpy over the rim (it shows above the front of the rim, and slops over it after).
  const heap = () => {
    g.moveTo(-IX, cy + 0.01);
    g.bezierCurveTo(-0.66, -0.12, -0.5, -0.2, -0.36, -0.16);
    g.bezierCurveTo(-0.26, -0.3, -0.06, -0.3, 0.02, -0.22);
    g.bezierCurveTo(0.14, -0.34, 0.38, -0.28, 0.42, -0.14);
    g.bezierCurveTo(0.58, -0.14, 0.68, -0.04, IX, cy + 0.01);
    g.ellipse(0, cy + 0.01, IX, IY, 0, 0, Math.PI);
    g.closePath();
  };
  softIn(g, SLUDGE, -0.32, cy + IY, heap, 1.15, 0.55);
  g.save(); g.beginPath(); heap(); g.clip();
  furGlow(g, [60, 52, 30], 0.6, 0.34, cy + 0.04, 0.4, 0.2);                                    // round: the shade side
  furGlow(g, [92, 112, 52], 0.5, -0.3, -0.04, 0.22, 0.12);                                     // greenish swirls in it
  furGlow(g, [150, 90, 60], 0.4, 0.2, -0.12, 0.18, 0.1, 0.4);                                  // and a ruddy one
  strokeIn(g, rgba(tone(SLUDGE, 0.68), 0.6), 0.016, () => { g.moveTo(-0.5, -0.04); g.quadraticCurveTo(-0.3, -0.14, -0.12, -0.06); g.moveTo(0.1, -0.12); g.quadraticCurveTo(0.26, -0.2, 0.44, -0.08); g.moveTo(-0.2, 0.1); g.quadraticCurveTo(0, 0.02, 0.24, 0.12); });   // its folds
  furGlow(g, [255, 240, 200], 0.3, -0.3, -0.18, 0.12, 0.05, -0.2);                             // lumps catching the light
  furGlow(g, [255, 240, 200], 0.24, 0.24, -0.24, 0.1, 0.04, 0.3);
  furGlow(g, [255, 240, 200], 0.2, -0.04, 0.02, 0.12, 0.04);
  g.restore();
  // Bits poking out of it: a limp stalk, a pale bit of mushroom, a cherry half sunk, a charred lump.
  strokeIn(g, 'rgb(84, 104, 46)', 0.034, () => { g.moveTo(-0.46, -0.08); g.quadraticCurveTo(-0.56, -0.3, -0.42, -0.4); });
  fillIn(g, 'rgb(102, 128, 54)', () => ovalAt(g, -0.4, -0.42, 0.07, 0.035, -0.6));
  softIn(g, [226, 206, 166], -0.2, -0.06, () => ovalAt(g, 0.42, -0.13, 0.09, 0.05, 0.3), 1.15, 0.7);
  fillIn(g, rgba(CHERRY), () => ovalAt(g, -0.16, 0.04, 0.08, 0.06));
  fillIn(g, 'rgba(255, 220, 220, 0.8)', () => ovalAt(g, -0.18, 0.02, 0.022, 0.014));
  softIn(g, [52, 40, 34], -0.32, -0.12, () => { g.moveTo(-0.2, -0.16); g.lineTo(-0.16, -0.28); g.lineTo(-0.04, -0.31); g.lineTo(0.02, -0.22); g.lineTo(-0.04, -0.14); g.closePath(); }, 1.4, 0.6);   // charred
  // The spoon, stood up in it on its own, leaning a little: its handle, and the sludge gathered round its foot.
  const handle = () => { g.moveTo(0.12, -0.16); g.lineTo(0.36, -0.9); };
  strokeIn(g, rgba(tone(SPOON, 0.62)), 0.1, handle);
  strokeIn(g, rgba(SPOON), 0.075, handle);
  strokeIn(g, rgba(tone(SPOON, 1.2, 30), 0.8), 0.022, () => { g.moveTo(0.11, -0.22); g.lineTo(0.33, -0.88); });
  fillIn(g, rgba(tone(SPOON, 0.62)), () => ovalAt(g, 0.36, -0.9, 0.05, 0.04, -1.25));
  softIn(g, SLUDGE, -0.26, -0.1, () => ovalAt(g, 0.13, -0.16, 0.12, 0.06, -0.2), 1.2, 0.7);
  strokeIn(g, rgba(tone(SLUDGE, 0.7), 0.6), 0.014, () => { g.moveTo(0.04, -0.16); g.quadraticCurveTo(0.13, -0.2, 0.22, -0.16); });
  // A bubble sitting on top, about to pop, and a glisten or two.
  softIn(g, tone(SLUDGE, 1.25, 30), -0.0, 0.12, () => ovalAt(g, -0.38, 0.06, 0.07, 0.055), 1.3, 0.8);
  strokeIn(g, rgba(tone(SLUDGE, 0.6), 0.7), 0.012, () => ovalAt(g, -0.38, 0.06, 0.07, 0.055));
  fillIn(g, 'rgba(255, 252, 230, 0.9)', () => { ovalAt(g, -0.4, 0.035, 0.018, 0.011, -0.4); ovalAt(g, -0.3, -0.18, 0.02, 0.012); ovalAt(g, 0.26, -0.22, 0.014, 0.01); ovalAt(g, 0.04, 0.08, 0.012, 0.008); });
  // The front of the rim, with the sludge slopping over it at the left and running down the bowl in a thick drip.
  strokeIn(g, rgba(tone(CLAY_RIM, 1.12, 14), 0.9), 0.024, () => g.ellipse(0, cy + 0.01, IX, IY, 0, 0.12, Math.PI - 0.12));
  strokeIn(g, rgba(tone(CLAY, 0.6), 0.6), 0.016, () => g.ellipse(0, cy, RX, RY, 0, 0.05, Math.PI - 0.05));
  const slop = () => {
    g.moveTo(-0.6, cy + 0.06);
    g.bezierCurveTo(-0.6, cy + 0.2, -0.4, cy + 0.22, -0.36, cy + 0.3);
    g.bezierCurveTo(-0.33, cy + 0.38, -0.34, cy + 0.44, -0.3, cy + 0.46);
    g.arc(-0.27, cy + 0.46, 0.045, Math.PI, 0, true);
    g.bezierCurveTo(-0.22, cy + 0.38, -0.24, cy + 0.3, -0.16, cy + 0.26);
    g.bezierCurveTo(-0.06, cy + 0.22, 0.0, cy + 0.2, 0.02, cy + 0.15);
    g.closePath();
  };
  softIn(g, SLUDGE, cy + 0.08, cy + 0.52, slop, 1.18, 0.6);
  fillIn(g, 'rgba(255, 250, 226, 0.75)', () => { ovalAt(g, -0.33, cy + 0.2, 0.03, 0.012, 0.4); ovalAt(g, -0.29, cy + 0.44, 0.012, 0.016); });
}

// ------------------------------------------------------------------ roast wild garlic
//
// Wild garlic leaves wound round a green stick in a fat spiral and held over the flames: the stick as the roast mushrooms'
// (bark where it's held, peeled pale, charred at the tip), lying flatter. The leaves gone a deep glossy green, each turn of
// them crisped brown along its edge where it lay over the last, blistered black here and there, a loose leaf's tip curling
// off either end; two of the white star flowers, wilted, riding on top, and a few crisp flakes fallen under it.
const ROAST_LEAF = [50, 104, 40], CRISP = [158, 112, 40];
function paintRoastGarlic(g) {
  const ax = -0.9, ay = 0.56, bx = 0.9, by = -0.44, len = Math.hypot(bx - ax, by - ay);
  sitShadow(g, 0.02, 0.64, 0.7, 0.11, 0.24);
  greenStick(g, ax, ay, bx, by);
  // The bundle, along the stick: a fat spindle of leaves from x0 to x1.
  const x0 = len * 0.28, x1 = len * 0.86, H = 0.2;
  const h = x => H * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))) ** 0.55 * (1 + 0.07 * Math.sin(x * 19));
  const spindle = () => {
    g.moveTo(x0, 0);
    for (let i = 1; i <= 24; i++) { const x = x0 + (x1 - x0) * i / 24; g.lineTo(x, -h(x)); }
    for (let i = 23; i >= 1; i--) { const x = x0 + (x1 - x0) * i / 24; g.lineTo(x, h(x) * 0.9); }
    g.closePath();
  };
  g.save(); g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax));
  // A loose leaf's tip off the back end, under the bundle.
  const looseLeaf = (x, y, l, w, rot, bend) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    softIn(g, ROAST_LEAF, -w, w, () => leafPath(g, 'g', l, w, bend), 1.35, 0.7);
    strokeIn(g, rgba(CRISP, 0.95), 0.022, () => leafPath(g, 'g', l, w, bend));                // crisped round its edge
    strokeIn(g, rgba(tone(ROAST_LEAF, 1.5, 30), 0.6), w * 0.14, () => { g.moveTo(l * 0.04, 0); g.quadraticCurveTo(l * 0.5, bend * w * 0.6, l * 0.9, bend * w * 0.92); });
    furGlow(g, [40, 24, 10], 0.7, l * 0.86, bend * w * 0.9, l * 0.14, w * 0.6);              // its tip burnt
    g.restore();
  };
  looseLeaf(x0 + 0.12, 0.06, 0.36, 0.09, Math.PI + 0.55, 0.5);
  furGlow(g, [20, 30, 10], 0.4, (x0 + x1) / 2 + 0.02, H * 0.7, (x1 - x0) * 0.5, H * 0.35);   // its shade on the stick
  softIn(g, tone(ROAST_LEAF, 0.72), -H, H, spindle, 1.2, 0.6);
  g.save(); g.beginPath(); spindle(); g.clip();
  // The turns of leaf, wound left to right, each lying over the last: its leading edge crisped brown.
  const n = 7, slant = 0.2, step = (x1 - x0 + slant) / n;
  for (let i = 0; i < n; i++) {
    const xt = x0 - slant + i * step, bw = step * 1.2, k = [0.96, 1.04, 0.9, 1.08, 0.98, 1.02, 0.92][i];
    // Each edge bows round the bundle (it's round), a little ragged where it crisped.
    const curve = (x, d = 0) => { g.quadraticCurveTo(x + slant * 0.5 + 0.07 + d, 0, x + slant + d, H + 0.04); };
    const ragged = (x, d = 0) => { for (let j = 1; j <= 6; j++) { const t = j / 6, u = 1 - t; g.lineTo(u * u * x + 2 * u * t * (x + slant * 0.5 + 0.07) + t * t * (x + slant) + d + (j % 2 ? 0.014 : -0.008), -H - 0.04 + t * (2 * H + 0.08)); } };
    const band = () => { g.moveTo(xt, -H - 0.04); g.lineTo(xt + bw, -H - 0.04); curve(xt + bw); g.lineTo(xt + slant, H + 0.04); g.quadraticCurveTo(xt + slant * 0.5 + 0.07, 0, xt, -H - 0.04); g.closePath(); };
    if (i) strokeIn(g, 'rgba(14, 26, 8, 0.45)', 0.05, () => { g.moveTo(xt - 0.03, -H - 0.04); curve(xt, -0.03); });   // its shade on the turn under it
    softIn(g, tone(ROAST_LEAF, k), -H, H, band, 1.3, 0.62);
    strokeIn(g, rgba(tone(ROAST_LEAF, 1.5, 30), 0.5), 0.016, () => { g.moveTo(xt + bw * 0.5, -H - 0.04); curve(xt + bw * 0.5); });   // its midrib
    if (i) { strokeIn(g, rgba(CRISP), 0.034, () => { g.moveTo(xt, -H - 0.04); ragged(xt); }); strokeIn(g, rgba(tone(CRISP, 1.3, 30), 0.8), 0.01, () => { g.moveTo(xt + 0.008, -H - 0.04); ragged(xt, 0.008); }); }
  }
  // Blistered black in spots where it touched the flames, shaded underneath, glossy along the top.
  for (const [x, y, r] of [[0.32, -0.08, 0.05], [0.56, 0.06, 0.04], [0.72, -0.1, 0.035], [0.44, 0.12, 0.03], [0.18, 0.04, 0.03]]) furGlow(g, [34, 22, 10], 0.75, x0 + (x1 - x0) * x, y, r * 1.4, r, 0, 0.3);
  furGlow(g, [10, 22, 6], 0.55, (x0 + x1) / 2, H * 0.8, (x1 - x0) * 0.6, H * 0.5);
  furGlow(g, [255, 255, 230], 0.42, (x0 + x1) / 2 - 0.06, -H * 0.55, (x1 - x0) * 0.36, H * 0.16);
  g.restore();
  strokeIn(g, 'rgba(26, 36, 14, 0.6)', 0.014, spindle);
  // A loose leaf's tip curling off the front end, and the wilted stars on top.
  looseLeaf(x1 - 0.14, -0.04, 0.34, 0.085, -0.6, -0.5);
  g.restore();
  const star = (x, y, r, rot) => {
    fillIn(g, 'rgba(20, 30, 10, 0.3)', () => ovalAt(g, x + 0.012, y + 0.02, r, r * 0.8));
    fillIn(g, 'rgb(244, 238, 214)', () => { for (let i = 0; i < 6; i++) { const a = rot + i / 6 * TAU; ovalAt(g, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.45, r * 0.46, r * 0.17, a + 0.4); } });
    fillIn(g, 'rgb(214, 196, 110)', () => ovalAt(g, x, y, r * 0.22, r * 0.2));
  };
  star(-0.12, -0.04, 0.085, 0.2);
  star(0.34, -0.22, 0.075, 0.6);
  // Crisp flakes fallen under it.
  fillIn(g, rgba(tone(CRISP, 0.75), 0.9), () => { for (const [x, y, a] of [[-0.2, 0.62, 0.4], [0.3, 0.66, -0.6], [0.5, 0.6, 1.1]]) ovalAt(g, x, y, 0.04, 0.018, a); });
  fillIn(g, rgba([40, 70, 28], 0.9), () => { for (const [x, y, a] of [[0.06, 0.64, -0.3], [0.62, 0.66, 0.6]]) ovalAt(g, x, y, 0.036, 0.016, a); });
}

// ------------------------------------------------------------------ strawberries and honey
//
// Wild strawberries heaped in a bowl folded from birch bark: the bark chalk-white with its dark dashes, its tan inside, the
// ends pinched up to a point and lashed with root, its rim rolled. The berries small and bright red, pointed, freckled with
// their gold seeds, each with its green ruff of sepals; honey poured over them in a glossy run, pooled under them. In front,
// one fallen out, a strawberry flower and a three-toothed leaf.
const STRAWBERRY = [212, 40, 44], SEED = [252, 216, 120], SEPAL = [72, 134, 48];
// A strawberry, radius r, its point down along +y before it's turned (rot).
function strawberryAt(g, x, y, r, rot) {
  furGlow(g, [70, 16, 10], 0.42, x + r * 0.1, y + r * 0.7, r * 1.0, r * 0.38);                 // where it sits
  g.save(); g.translate(x, y); g.rotate(rot);
  const body = () => { g.moveTo(0, r * 1.05); g.bezierCurveTo(-r * 0.5, r * 0.82, -r * 0.96, r * 0.1, -r * 0.86, -r * 0.42); g.bezierCurveTo(-r * 0.74, -r * 0.86, r * 0.74, -r * 0.86, r * 0.86, -r * 0.42); g.bezierCurveTo(r * 0.96, r * 0.1, r * 0.5, r * 0.82, 0, r * 1.05); g.closePath(); };
  softIn(g, STRAWBERRY, -r * 0.8, r * 1.05, body, 1.3, 0.55);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [96, 6, 14], 0.55, r * 0.5, r * 0.3, r * 0.6, r * 0.9);                          // round: the shade side
  furGlow(g, [240, 150, 40], 0.4, 0, r * 0.95, r * 0.6, r * 0.22);                             // the honey's glaze
  g.restore();
  // The seeds, each in its little dimple, in staggered rows narrowing to the point.
  const seeds = [];
  for (let j = 0; j < 5; j++) { const v = -0.42 + j * 0.3, w = 0.68 * (1 - Math.max(0, v) * 0.75); for (let u = -w + (j % 2) * 0.15; u <= w + 0.01; u += 0.3) seeds.push([u * r, v * r]); }
  fillIn(g, 'rgba(110, 10, 18, 0.6)', () => { for (const [u, v] of seeds) ovalAt(g, u, v, r * 0.08, r * 0.065); });
  fillIn(g, rgba(SEED), () => { for (const [u, v] of seeds) ovalAt(g, u - r * 0.015, v - r * 0.02, r * 0.042, r * 0.05); });
  fillIn(g, 'rgba(255, 244, 240, 0.85)', () => ovalAt(g, -r * 0.42, -r * 0.3, r * 0.16, r * 0.09, -0.9));   // a window of light
  // Its ruff of sepals, and the stalk's stub.
  g.save(); g.translate(0, -r * 0.66);
  softIn(g, SEPAL, -r * 0.3, r * 0.2, () => { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.62; ovalAt(g, Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.16 + r * 0.04, r * 0.3, r * 0.09, a); } }, 1.3, 0.7);
  strokeIn(g, rgba([96, 120, 52]), r * 0.12, () => { g.moveTo(0, 0); g.quadraticCurveTo(r * 0.04, -r * 0.2, r * 0.14, -r * 0.3); });
  g.restore();
  g.restore();
}
function paintStrawberriesHoney(g) {
  const L = [-0.92, -0.18], R = [0.92, -0.18];                 // the bowl's pinched ends
  const front = () => { g.bezierCurveTo(0.6, 0.2, -0.6, 0.2, L[0], L[1]); };   // its front rim, from R to L
  sitShadow(g, 0, 0.62, 0.76, 0.13, 0.32);
  // The hollow: the bark's tan inside, deeper toward the front.
  softIn(g, BARK_IN, -0.36, 0.14, () => { g.moveTo(...L); g.bezierCurveTo(-0.6, -0.4, 0.6, -0.4, ...R); front(); g.closePath(); }, 1.1, 0.62);
  furGlow(g, [80, 40, 20], 0.45, 0.1, 0.0, 0.6, 0.12);
  // The honey pooled in it, and the berries heaped, back ones first.
  softIn(g, HONEY, -0.16, 0.12, () => ovalAt(g, 0.02, -0.02, 0.56, 0.12), 1.25, 0.72);
  for (const [x, y, r, rot] of [[-0.42, -0.2, 0.16, 0.5], [0.0, -0.26, 0.16, -0.2], [0.4, -0.2, 0.16, -0.6], [-0.6, -0.06, 0.15, 0.9],
    [-0.22, -0.08, 0.17, 0.2], [0.2, -0.08, 0.17, -0.4], [0.58, -0.04, 0.15, -1.0], [-0.04, -0.34, 0.15, 0.1], [0.0, 0.0, 0.17, 0.05], [-0.38, 0.02, 0.16, 0.6], [0.38, 0.02, 0.16, -0.5]]) strawberryAt(g, x, y, r, rot);
  // Honey poured over them in a glossy run.
  const run = () => { g.moveTo(-0.5, -0.2); g.bezierCurveTo(-0.3, -0.34, -0.1, -0.12, 0.06, -0.24); g.bezierCurveTo(0.2, -0.32, 0.26, -0.1, 0.46, -0.16); };
  g.globalAlpha = 0.75; strokeIn(g, rgba(HONEY), 0.045, run); g.globalAlpha = 1;
  strokeIn(g, 'rgba(255, 240, 190, 0.85)', 0.012, () => { g.save(); g.translate(-0.008, -0.012); run(); g.restore(); });
  // The bark's side, over the front of it all: chalk-white, round, its dark dashes, grubby at the foot.
  const side = () => { g.moveTo(...R); front(); g.bezierCurveTo(-0.86, 0.22, -0.5, 0.6, 0, 0.6); g.bezierCurveTo(0.5, 0.6, 0.86, 0.22, ...R); g.closePath(); };
  softIn(g, BARK, -0.18, 0.6, side, 1.05, 0.8);
  g.save(); g.beginPath(); side(); g.clip();
  furGlow(g, [120, 106, 88], 0.55, 0.5, 0.36, 0.4, 0.3);                                      // round: the shade side
  furGlow(g, [255, 255, 250], 0.6, -0.42, 0.24, 0.24, 0.1, 0.3);                              // the light on its left
  furGlow(g, [150, 120, 90], 0.35, 0, 0.6, 0.5, 0.1);                                         // grubby at the foot
  strokeIn(g, 'rgba(58, 48, 42, 0.78)', 0.016, () => {
    for (const [x, y, w] of [[-0.62, 0.18, 0.1], [-0.3, 0.3, 0.08], [0.06, 0.24, 0.12], [0.36, 0.34, 0.1], [0.6, 0.2, 0.08], [-0.46, 0.42, 0.08], [-0.08, 0.48, 0.1], [0.24, 0.5, 0.08], [0.5, 0.42, 0.06]]) { g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + 0.008, x + w, y); }
  });
  softIn(g, [212, 160, 110], 0.32, 0.44, () => ovalAt(g, -0.16, 0.38, 0.1, 0.045, -0.1), 1.1, 0.8);   // a peeled patch, tan
  g.restore();
  // The rim rolled over, and the ends pinched up and lashed with root.
  strokeIn(g, rgba(tone(BARK, 0.86)), 0.05, () => { g.moveTo(...R); front(); });
  strokeIn(g, 'rgba(255, 255, 255, 0.9)', 0.016, () => { g.moveTo(R[0] - 0.12, R[1] + 0.06); g.bezierCurveTo(0.5, 0.17, -0.5, 0.17, L[0] + 0.12, L[1] + 0.06); });
  strokeIn(g, rgba(tone(BARK, 0.8)), 0.022, () => { g.moveTo(...L); g.bezierCurveTo(-0.6, -0.4, 0.6, -0.4, ...R); });   // the back rim's edge
  for (const s of [-1, 1]) {
    const x = s * 0.78, y = -0.1;
    strokeIn(g, rgba(tone(BARK, 0.7), 0.7), 0.012, () => { g.moveTo(s * 0.92, -0.18); g.quadraticCurveTo(s * 0.84, 0.04, s * 0.7, 0.18); });   // the fold
    strokeIn(g, rgba(ROOT), 0.026, () => { for (let i = -1; i <= 1; i++) { g.moveTo(x + i * 0.035 - s * 0.03, y - 0.1); g.lineTo(x + i * 0.035 + s * 0.03, y + 0.1); } });
    strokeIn(g, rgba(tone(ROOT, 1.3, 20), 0.6), 0.008, () => { for (let i = -1; i <= 1; i++) { g.moveTo(x + i * 0.035 - s * 0.03 - 0.006, y - 0.08); g.lineTo(x + i * 0.035 - 0.006, y + 0.0); } });
  }
  // In front: a leaf, a flower and one fallen out.
  g.save(); g.translate(-0.5, 0.66);
  for (const a of [-2.3, -1.57, -0.84]) {
    g.save(); g.rotate(a + Math.PI / 2 - 0.3); g.scale(0.9, 0.9);
    const leaflet = () => { g.moveTo(0, 0); g.bezierCurveTo(-0.1, -0.06, -0.12, -0.2, 0, -0.24); g.bezierCurveTo(0.12, -0.2, 0.1, -0.06, 0, 0); g.closePath(); };
    softIn(g, LEAF, -0.24, 0, leaflet, 1.25, 0.66);
    strokeIn(g, rgba(tone(LEAF, 0.6), 0.7), 0.01, () => { for (let i = 1; i <= 3; i++) { const v = -0.04 - i * 0.05; g.moveTo(-0.09 + i * 0.006, v); g.lineTo(-0.05, v + 0.012); g.moveTo(0.09 - i * 0.006, v); g.lineTo(0.05, v + 0.012); } });   // its teeth
    strokeIn(g, rgba(tone(LEAF, 1.35, 24), 0.7), 0.012, () => { g.moveTo(0, -0.02); g.lineTo(0, -0.2); });
    g.restore();
  }
  g.restore();
  strawberryAt(g, 0.56, 0.66, 0.15, -1.3);
  const fx = -0.24, fy = 0.72, fr = 0.1;
  furGlow(g, [60, 50, 20], 0.3, fx + 0.02, fy + 0.04, fr * 1.2, fr * 0.6);
  softIn(g, [252, 250, 240], fy - fr, fy + fr, () => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU; ovalAt(g, fx + Math.cos(a) * fr * 0.55, fy + Math.sin(a) * fr * 0.44, fr * 0.5, fr * 0.4, a); } }, 1.05, 0.85);
  fillIn(g, rgba([236, 196, 60]), () => ovalAt(g, fx, fy, fr * 0.3, fr * 0.24));
  fillIn(g, rgba([200, 150, 30], 0.8), () => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ovalAt(g, fx + Math.cos(a) * fr * 0.26, fy + Math.sin(a) * fr * 0.2, fr * 0.05, fr * 0.05); } });
}

// ------------------------------------------------------------------ elderflower cordial
//
// Cordial in a round-bellied jug of pale fired clay: a little pinched lip to pour from, a looped handle, a band of brown slip
// waved round its shoulder, a gold drip run down from the lip. In its mouth the cordial, pale gold and clear, with the tiny
// cream florets floating in it. At its foot a whole flower head lying on its side, a lacy plate of florets on fine green
// stalks, and the half of an apple it was steeped with.
const JUG = [214, 178, 130], SLIP = [132, 78, 44], CORDIAL = [238, 204, 100], FLORET = [250, 244, 216];
// An elderflower head lying tipped toward us: a flat dome of florets, rx by ry, its stalks under it.
function elderAt(g, x, y, rx, ry) {
  furGlow(g, [60, 50, 20], 0.35, x + 0.02, y + ry * 0.7, rx * 1.05, ry * 0.6);
  strokeIn(g, rgba([96, 132, 56]), 0.014, () => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i * 0.126); g.moveTo(x + rx * 0.1, y + ry * 1.2); g.lineTo(x + Math.cos(a) * rx * 0.9, y + Math.sin(a) * ry * 0.6); } });
  softIn(g, [212, 210, 168], y - ry, y + ry, () => ovalAt(g, x, y, rx, ry), 1.1, 0.75);
  const pts = [];
  for (let i = 0; i < 42; i++) { const t = Math.sqrt((i + 0.5) / 42), a = i * 2.39996; pts.push([x + Math.cos(a) * t * rx * 0.92, y + Math.sin(a) * t * ry * 0.88]); }
  fillIn(g, 'rgba(120, 120, 80, 0.4)', () => { for (const [px, py] of pts) ovalAt(g, px + 0.006, py + 0.008, rx * 0.11, rx * 0.09); });
  fillIn(g, rgba(FLORET), () => { for (const [px, py] of pts) ovalAt(g, px, py, rx * 0.1, rx * 0.085); });
  fillIn(g, rgba([228, 210, 120]), () => { for (const [px, py] of pts) ovalAt(g, px, py, rx * 0.03, rx * 0.028); });
  furGlow(g, [90, 90, 50], 0.35, x + rx * 0.3, y + ry * 0.4, rx * 0.6, ry * 0.5);                 // round: the shade side
}
function paintElderflowerCordial(g) {
  const my = -0.42, MX = 0.3, MRY = 0.09, fy = 0.62, FX = 0.3, FRY = 0.07;   // its mouth and its foot
  sitShadow(g, 0.04, fy + 0.06, 0.8, 0.13, 0.32);
  // The handle, looped out on the right.
  const handle = () => { g.moveTo(0.26, -0.28); g.bezierCurveTo(0.72, -0.38, 0.88, 0.12, 0.48, 0.32); };
  strokeIn(g, rgba(tone(JUG, 0.62)), 0.13, handle);
  strokeIn(g, rgba(tone(JUG, 0.9)), 0.095, handle);
  strokeIn(g, 'rgba(255, 246, 226, 0.7)', 0.024, () => { g.moveTo(0.4, -0.33); g.bezierCurveTo(0.66, -0.36, 0.78, -0.14, 0.76, 0.0); });
  // The body: round-bellied, narrowing up to the mouth and down to its foot.
  const body = () => {
    g.moveTo(-MX, my);
    g.bezierCurveTo(-MX, my + 0.16, -0.64, -0.12, -0.64, 0.16);
    g.bezierCurveTo(-0.64, 0.44, -0.44, fy - 0.02, -FX, fy);
    g.ellipse(0, fy, FX, FRY, 0, Math.PI, 0, true);
    g.bezierCurveTo(0.44, fy - 0.02, 0.64, 0.44, 0.64, 0.16);
    g.bezierCurveTo(0.64, -0.12, MX, my + 0.16, MX, my);
    g.ellipse(0, my, MX, MRY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, JUG, my, fy + FRY, body, 1.1, 0.7);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [110, 70, 40], 0.55, 0.42, 0.24, 0.36, 0.56);                                    // round: the shade side
  furGlow(g, [255, 246, 226], 0.55, -0.36, 0.06, 0.12, 0.3, 0.2);                             // the light down its belly
  furGlow(g, [120, 80, 50], 0.3, 0, fy, 0.4, 0.1);
  // The band of slip round its shoulder, waved, and two plain lines either side of it.
  const ring = (y, ry) => g.ellipse(0, y, 0.7, ry, 0, 0.05, Math.PI - 0.05);
  strokeIn(g, rgba(SLIP, 0.8), 0.014, () => { ring(-0.2, 0.12); ring(0.02, 0.14); });
  strokeIn(g, rgba(SLIP, 0.85), 0.03, () => { for (let i = 0; i <= 40; i++) { const t = 0.08 + i / 40 * (Math.PI - 0.16), px = Math.cos(t) * 0.64, py = -0.09 + Math.sin(t) * 0.13 + Math.sin(i * 0.9) * 0.025; i ? g.lineTo(px, py) : g.moveTo(px, py); } });
  // A gold drip run down from the lip.
  fillIn(g, rgba(tone(CORDIAL, 0.9), 0.9), () => { g.moveTo(-MX - 0.02, my + 0.02); g.quadraticCurveTo(-0.4, -0.2, -0.44, -0.04); g.arc(-0.415, -0.04, 0.026, Math.PI, 0, true); g.quadraticCurveTo(-0.37, -0.22, -MX + 0.04, my + 0.04); g.closePath(); });
  fillIn(g, 'rgba(255, 250, 220, 0.85)', () => ovalAt(g, -0.42, -0.045, 0.008, 0.012));
  g.restore();
  // The lip, pinched out on the left, then the mouth: its rim, and the cordial in it with florets floating.
  softIn(g, tone(JUG, 1.06), my - 0.1, my + 0.06, () => { g.moveTo(-MX + 0.06, my - 0.08); g.quadraticCurveTo(-MX - 0.1, my - 0.1, -MX - 0.13, my - 0.03); g.quadraticCurveTo(-MX - 0.06, my + 0.05, -MX + 0.06, my + 0.06); g.closePath(); }, 1.1, 0.8);
  fillIn(g, rgba(tone(JUG, 1.1, 10)), () => ovalAt(g, 0, my, MX, MRY));
  const mouth = () => ovalAt(g, 0, my + 0.006, MX - 0.045, MRY - 0.022);
  fillIn(g, rgba([96, 62, 34]), mouth);
  g.save(); g.beginPath(); mouth(); g.clip();
  softIn(g, CORDIAL, my - 0.02, my + 0.08, () => ovalAt(g, 0, my + 0.024, MX - 0.05, MRY - 0.026), 1.15, 0.8);
  furGlow(g, [255, 250, 230], 0.6, -0.08, my + 0.02, 0.14, 0.02);                             // the sky in it
  fillIn(g, rgba(FLORET), () => { for (const [x, y] of [[0.08, 0.03], [0.14, 0.04], [-0.12, 0.04], [0.02, 0.05], [0.18, 0.02]]) ovalAt(g, x, my + y, 0.016, 0.01); });
  furGlow(g, [60, 30, 10], 0.4, 0, my + 0.07, MX, 0.02);                                      // shaded under the front of the rim
  g.restore();
  strokeIn(g, 'rgba(255, 250, 236, 0.8)', 0.012, () => g.ellipse(0, my - 0.006, MX - 0.01, MRY - 0.006, 0, Math.PI + 0.3, TAU - 0.4));
  strokeIn(g, rgba(tone(JUG, 0.7), 0.6), 0.012, () => g.ellipse(0, my, MX, MRY, 0, 0.1, Math.PI - 0.1));
  // At its foot: the flower head on its side, and the half apple.
  elderAt(g, -0.6, fy - 0.02, 0.26, 0.15);
  strokeIn(g, rgba([96, 132, 56]), 0.026, () => { g.moveTo(-0.56, fy + 0.16); g.quadraticCurveTo(-0.4, fy + 0.2, -0.26, fy + 0.16); });   // its stalk
  const ax = 0.56, ay = fy + 0.06;
  furGlow(g, [70, 30, 14], 0.4, ax + 0.02, ay + 0.08, 0.2, 0.06);
  softIn(g, APPLE, ay - 0.06, ay + 0.11, () => ovalAt(g, ax, ay + 0.02, 0.19, 0.09), 1.2, 0.6);   // its skin, under
  softIn(g, FLESH, ay - 0.08, ay + 0.06, () => ovalAt(g, ax, ay - 0.012, 0.175, 0.075), 1.12, 0.86);   // the cut face
  fillIn(g, rgba([246, 226, 170]), () => ovalAt(g, ax - 0.01, ay - 0.016, 0.13, 0.05));
  fillIn(g, rgba([110, 64, 30]), () => { for (const a of [0.4, 2.0, 3.6, 5.2]) ovalAt(g, ax + Math.cos(a) * 0.04, ay - 0.014 + Math.sin(a) * 0.018, 0.014, 0.008, a); });   // its pips
}

// ------------------------------------------------------------------ watercress soup
//
// Watercress soup in the carved wooden bowl: smooth and green as the stream, lighter where the light falls on it and turning
// in a pale swirl from the stirring, a sheen and a few small bubbles on it; sprigs of fresh cress laid on top, their round
// leaflets glossy and dark, and one hanging out over the rim. A wisp of steam off it.
const SOUP = [92, 146, 52], CRESS = [44, 110, 40];
// A sprig of watercress along +x, length l: a pale stem, round leaflets in pairs, a bigger one at its tip.
function cressAt(g, x, y, l, rot, k = 1) {
  const rgb = tone(CRESS, k);
  g.save(); g.translate(x, y); g.rotate(rot);
  furGlow(g, [20, 40, 10], 0.35, l * 0.5, l * 0.1, l * 0.6, l * 0.2);
  strokeIn(g, rgba([150, 176, 96]), l * 0.05, () => { g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -l * 0.04, l * 0.86, 0); });
  const leaflets = [];
  for (const [t, f] of [[0.34, 0.8], [0.62, 1]]) for (const s of [-1, 1]) leaflets.push([l * t + l * 0.06, s * l * 0.15 * f, l * 0.15 * f, l * 0.1 * f, s * 0.6]);
  leaflets.push([l * 0.96, 0, l * 0.21, l * 0.16, 0]);
  for (const [lx, ly, rx, ry, a] of leaflets) {
    softIn(g, rgb, ly - ry, ly + ry, () => ovalAt(g, lx, ly, rx, ry, a), 1.3, 0.62);
    strokeIn(g, rgba(tone(rgb, 0.55), 0.6), l * 0.012, () => ovalAt(g, lx, ly, rx, ry, a));
    furGlow(g, [255, 255, 236], 0.5, lx - rx * 0.25, ly - ry * 0.35, rx * 0.4, ry * 0.25, a);   // glossy
  }
  g.restore();
}
function paintWatercressSoup(g) {
  const { cy, IX, IY } = BOWL, sy = cy + 0.05;
  woodBowl(g, () => {
    const top = () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.04);
    fillIn(g, rgba(SOUP), top);
    furGlow(g, [60, 110, 36], 0.5, 0.3, sy, 0.3, 0.1);                                         // darker where it's deep
    furGlow(g, [170, 210, 110], 0.7, -0.16, sy - 0.03, 0.46, 0.11);                           // lighter where the light falls
    furGlow(g, [28, 60, 18], 0.55, 0.12, sy + 0.15, IX * 0.8, 0.06);                          // shaded under the front of the rim
    strokeIn(g, 'rgba(206, 232, 160, 0.7)', 0.02, () => { g.moveTo(-0.44, sy + 0.02); g.bezierCurveTo(-0.4, sy - 0.1, 0.1, sy - 0.12, 0.16, sy - 0.03); g.bezierCurveTo(0.2, sy + 0.05, -0.14, sy + 0.08, -0.16, sy + 0.0); g.quadraticCurveTo(-0.15, sy - 0.05, -0.04, sy - 0.04); });   // the swirl from the stirring
    furGlow(g, [255, 255, 240], 0.45, -0.36, sy - 0.08, 0.16, 0.03, -0.05);                   // the sky in it
    strokeIn(g, 'rgba(230, 246, 200, 0.75)', 0.008, () => { for (const [x, y, r] of [[0.36, sy - 0.08, 0.022], [0.44, sy - 0.03, 0.014], [-0.5, sy + 0.06, 0.016], [0.28, sy + 0.08, 0.012]]) ovalAt(g, x, y, r, r * 0.6); });   // small bubbles
    cressAt(g, -0.5, sy - 0.04, 0.4, -0.35, 0.92);
    cressAt(g, 0.46, sy - 0.1, 0.36, Math.PI + 0.4, 0.96);
    cressAt(g, -0.16, sy + 0.04, 0.44, -0.15, 1.05);
  });
  // A sprig hanging out over the rim at the right.
  cressAt(g, 0.4, cy + 0.12, 0.4, 0.5, 1.1);
  // A wisp of steam off it.
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.16, -0.12); g.bezierCurveTo(-0.26, -0.32, -0.06, -0.42, -0.14, -0.64); g.moveTo(0.16, -0.1); g.bezierCurveTo(0.1, -0.26, 0.28, -0.34, 0.2, -0.54); });
}

// ------------------------------------------------------------------ sorrel and mushrooms
//
// Mushrooms fried in the clay pan with sorrel melted down into a sour little sauce: the sauce a soft olive-gold, buttery at
// the edges; the mushrooms halved and seared gold, a whole cap or two; the sorrel leaves gone khaki and limp where they
// melted in, lying among them, and one fresh arrow-headed leaf laid bright on top at the last.
const SAUCE = [176, 160, 78], MELTED = [132, 128, 50];
function paintSorrelMushrooms(g) {
  const { cy, IX, IY } = CLAY_PAN;
  const melted = (x, y, len, w, rot, bend, k = 1) => {
    const rgb = tone(MELTED, k);
    g.save(); g.translate(x, y); g.rotate(rot);
    softIn(g, rgb, -w, w, () => leafPath(g, 's', len, w, bend), 1.3, 0.7);
    strokeIn(g, rgba(tone(rgb, 1.4, 24), 0.5), w * 0.12, () => { g.moveTo(len * 0.04, 0); g.quadraticCurveTo(len * 0.5, bend * w * 0.6, len * 0.9, bend * w * 0.92); });
    furGlow(g, [255, 250, 210], 0.35, len * 0.45, -w * 0.3, len * 0.2, w * 0.2);               // glossy with the sauce
    g.restore();
  };
  clayPan(g, () => {
    softIn(g, SAUCE, cy - IY * 0.8, cy + IY, () => ovalAt(g, 0, cy + 0.03, IX * 0.96, IY * 0.86), 1.2, 0.72);
    furGlow(g, [130, 100, 40], 0.45, 0, cy + 0.03, IX * 0.9, IY * 0.8, 0, 0.6);                 // the sauce browned at its edge
    strokeIn(g, 'rgba(255, 236, 160, 0.55)', 0.016, () => g.ellipse(0, cy + 0.03, IX * 0.9, IY * 0.8, 0, Math.PI + 0.5, TAU - 0.4));
    melted(-0.1, cy - 0.12, 0.5, 0.13, -2.8, 0.4, 0.86);
    melted(0.12, cy - 0.1, 0.5, 0.13, -0.3, -0.4, 0.9);
    capAt(g, -0.5, cy - 0.06, 0.56, -0.25);
    halfShroomAt(g, -0.06, cy - 0.12, 0.64, 0.1, FRIED);
    halfShroomAt(g, 0.44, cy - 0.04, 0.6, 0.4, FRIED);
    melted(-0.3, cy + 0.08, 0.4, 0.11, 2.9, -0.4, 1.0);
    melted(0.5, cy + 0.06, 0.36, 0.1, -2.6, 0.4, 0.96);
    halfShroomAt(g, -0.22, cy + 0.08, 0.6, -0.35, FRIED);
    capAt(g, 0.22, cy + 0.12, 0.5, 0.2);
    melted(0.04, cy + 0.12, 0.36, 0.1, -0.5, 0.4, 1.06);
    fillIn(g, 'rgba(255, 252, 230, 0.85)', () => { ovalAt(g, -0.4, cy + 0.14, 0.014, 0.009); ovalAt(g, 0.52, cy + 0.12, 0.012, 0.008); ovalAt(g, 0.08, cy - 0.02, 0.012, 0.008); });   // the sauce glinting
  });
  // The fresh leaf laid on top at the last, its point over the rim.
  leafAt(g, 's', 0.06, cy - 0.04, 0.44, 0.12, -0.6, 0.3, 1.08);
}

// ------------------------------------------------------------------ roast dandelion roots
//
// Three lengths of dandelion root threaded on the green stick (as the roast mushrooms'), lying along it: each thick where it
// was cut and tapering off, its brown skin ringed and wrinkled across, roasted dark in patches and lit along the top, a few
// root hairs left on underneath; the cut end shows its pale flesh toasted round the edge, the ring of its core, and the stick
// going in. Under it, a dandelion head and a toothed leaf, so you know what root it was, and a few flakes of char.
const ROOT_SKIN = [146, 96, 56], ROOT_CUT = [240, 220, 176], ROOT_CORE = [206, 164, 100];
// A length of root on the stick, in the stick's own frame (+x along it): cut at u0, where it's r across, thinner toward u1.
function rootPieceAt(g, u0, u1, r, k) {
  const L = u1 - u0, rr = t => r * (1 - 0.32 * t) * (1 + 0.05 * Math.sin(t * 13 + k * 2.1));
  const piece = () => {
    g.moveTo(u0, -rr(0));
    for (let i = 1; i <= 12; i++) { const t = i / 12; g.lineTo(u0 + L * t, -rr(t)); }
    g.quadraticCurveTo(u1 + r * 0.4, 0, u1, rr(1) * 0.95);
    for (let i = 11; i >= 0; i--) { const t = i / 12; g.lineTo(u0 + L * t, rr(t) * 0.95); }
    g.closePath();
  };
  furGlow(g, [40, 24, 12], 0.4, u0 + L * 0.5, r * 0.9, L * 0.55, r * 0.35);                   // its shade on the stick
  softIn(g, tone(ROOT_SKIN, [1, 0.92, 1.06][k % 3]), -r, r, piece, 1.3, 0.55);
  g.save(); g.beginPath(); piece(); g.clip();
  // Ringed and wrinkled across, as a root is; roasted dark in patches, lit along the top.
  strokeIn(g, rgba(tone(ROOT_SKIN, 0.55), 0.55), 0.012, () => { for (let j = 1; j < 6; j++) { const x = u0 + L * (j + (k % 2) * 0.4) / 6.2, h = rr((x - u0) / L); g.moveTo(x - h * 0.15, -h); g.quadraticCurveTo(x + h * 0.25, 0, x - h * 0.05, h); } });
  furGlow(g, [44, 26, 14], 0.6, u0 + L * (0.3 + 0.3 * (k % 2)), r * 0.2, L * 0.16, r * 0.5, 0, 0.3);   // charred where it lay in the flames
  furGlow(g, [44, 26, 14], 0.45, u1 - L * 0.08, 0, L * 0.12, r * 0.8);
  furGlow(g, [255, 226, 180], 0.45, u0 + L * 0.45, -r * 0.5, L * 0.38, r * 0.14);
  g.restore();
  strokeIn(g, rgba(tone(ROOT_SKIN, 0.45), 0.7), 0.012, piece);
  strokeIn(g, rgba(tone(ROOT_SKIN, 0.75), 0.8), 0.008, () => { for (const t of [0.35, 0.7]) { const x = u0 + L * t, h = rr(t) * 0.92; g.moveTo(x, h); g.quadraticCurveTo(x + 0.01, h + 0.05, x + 0.05, h + 0.07); } });   // root hairs
  // The cut end: pale flesh toasted round the edge, the ring of its core, and the stick going in.
  const fx = r * 0.4, fy = rr(0);
  softIn(g, ROOT_CUT, -fy, fy, () => ovalAt(g, u0, 0, fx, fy), 1.05, 0.82);
  strokeIn(g, rgba([196, 140, 72], 0.8), 0.016, () => ovalAt(g, u0, 0, fx * 0.86, fy * 0.88));
  strokeIn(g, rgba(ROOT_CORE, 0.9), 0.01, () => ovalAt(g, u0, 0, fx * 0.5, fy * 0.5));
  strokeIn(g, rgba(tone(ROOT_SKIN, 0.6)), 0.014, () => ovalAt(g, u0, 0, fx, fy));
  strokeIn(g, 'rgba(60, 40, 24, 0.6)', 0.07, () => { g.moveTo(u0 - fx * 0.9, 0.004); g.lineTo(u0 - 0.004, 0.004); });
  strokeIn(g, rgba(STICK_GREEN), 0.056, () => { g.moveTo(u0 - fx * 0.9, 0); g.lineTo(u0 - 0.01, 0); });
}
function paintRoastRoots(g) {
  const ax = -0.88, ay = 0.6, bx = 0.88, by = -0.5, len = Math.hypot(bx - ax, by - ay);
  sitShadow(g, 0.02, 0.66, 0.7, 0.11, 0.24);
  // Under it, the leaf and the flower, and flakes of char.
  leafAt(g, 'd', -0.2, 0.72, 0.62, 0.13, -0.12, 0.3, 0.95);
  dandelionAt(g, 0.52, 0.66, 0.15);
  fillIn(g, 'rgba(48, 32, 20, 0.85)', () => { for (const [x, y, a] of [[-0.42, 0.64, 0.4], [0.2, 0.62, -0.6], [0.76, 0.76, 1.1]]) ovalAt(g, x, y, 0.036, 0.016, a); });
  greenStick(g, ax, ay, bx, by);
  // The roots, the one furthest up first; each one's thin end tucks behind the cut end of the one below.
  g.save(); g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax));
  for (const [u0, u1, r, k] of [[1.32, 1.8, 0.16, 2], [0.86, 1.3, 0.18, 1], [0.42, 0.84, 0.17, 0]]) rootPieceAt(g, u0, Math.min(u1, len * 0.9), r, k);
  g.restore();
}

// ------------------------------------------------------------------ mushroom and garlic skewer
//
// One fat mushroom on the green stick, roasted as the roast mushrooms are, with a wild garlic leaf wound round its cap: the
// leaf gone deep glossy green and crisped brown along its edges, blistered here and there, its tip curling off over the
// rim and its stalk end tucked under on the other side; one of its white star flowers wilted on top.
function paintShroomGarlicSkewer(g) {
  const ax = -0.84, ay = 0.8, bx = 0.86, by = -0.72;
  const at = t => [ax + (bx - ax) * t, ay + (by - ay) * t];
  sitShadow(g, 0.04, 0.72, 0.62, 0.11, 0.22);
  greenStick(g, ax, ay, bx, by);
  const [x, y] = at(0.5), s = 1.35, tilt = -0.06;
  roastShroomAt(g, x, y, s, tilt, ROAST_CAP[0]);
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  // The leaf wound across the cap, following its dome (held to its outline), crisped along both edges.
  const cap = () => { g.moveTo(-0.37, -0.12); g.bezierCurveTo(-0.41, -0.39, -0.2, -0.55, 0.01, -0.54); g.bezierCurveTo(0.22, -0.53, 0.41, -0.39, 0.37, -0.12); g.quadraticCurveTo(0, -0.05, -0.37, -0.12); g.closePath(); };
  const top = () => { g.moveTo(-0.46, -0.22); g.bezierCurveTo(-0.24, -0.34, 0.1, -0.38, 0.46, -0.5); };
  const bottom = () => { g.moveTo(-0.46, -0.08); g.bezierCurveTo(-0.16, -0.18, 0.2, -0.22, 0.46, -0.32); };
  const band = () => { top(); g.lineTo(0.46, -0.32); g.bezierCurveTo(0.2, -0.22, -0.16, -0.18, -0.46, -0.08); g.closePath(); };
  g.save(); g.beginPath(); cap(); g.clip();
  strokeIn(g, 'rgba(30, 16, 8, 0.4)', 0.05, () => { g.save(); g.translate(0.01, 0.03); bottom(); g.restore(); });   // its shade on the cap
  softIn(g, ROAST_LEAF, -0.5, -0.1, band, 1.35, 0.62);
  strokeIn(g, rgba(tone(ROAST_LEAF, 1.5, 30), 0.6), 0.018, () => { g.moveTo(-0.46, -0.15); g.bezierCurveTo(-0.2, -0.26, 0.15, -0.3, 0.46, -0.41); });   // its midrib
  strokeIn(g, rgba(tone(ROAST_LEAF, 1.35, 20), 0.35), 0.008, () => { for (const t of [-0.28, -0.08, 0.12, 0.3]) { const m = -0.2 - (t + 0.3) * 0.15; g.moveTo(t, m); g.lineTo(t + 0.06, m - 0.05); g.moveTo(t, m); g.lineTo(t + 0.06, m + 0.05); } });   // veins
  for (const [bx0, by0, r] of [[-0.18, -0.22, 0.035], [0.2, -0.32, 0.03], [0.02, -0.25, 0.022]]) furGlow(g, [30, 20, 8], 0.7, bx0, by0, r * 1.4, r, 0, 0.3);   // blistered black
  furGlow(g, [255, 255, 230], 0.42, -0.1, -0.27, 0.2, 0.03, -0.3);                             // glossy
  strokeIn(g, rgba(CRISP), 0.03, () => { top(); bottom(); });
  strokeIn(g, rgba(tone(CRISP, 1.3, 30), 0.7), 0.01, () => { g.save(); g.translate(-0.004, -0.008); top(); g.restore(); });
  g.restore();
  // Its tip curling off over the rim on the right, its stalk end tucked under on the left.
  g.save(); g.translate(0.3, -0.34); g.rotate(0.7);
  softIn(g, ROAST_LEAF, -0.07, 0.07, () => leafPath(g, 'g', 0.3, 0.07, 0.6), 1.35, 0.7);
  strokeIn(g, rgba(CRISP, 0.95), 0.02, () => leafPath(g, 'g', 0.3, 0.07, 0.6));
  furGlow(g, [40, 24, 10], 0.7, 0.26, 0.04, 0.05, 0.05);
  g.restore();
  strokeIn(g, rgba(tone(ROAST_LEAF, 0.8)), 0.03, () => { g.moveTo(-0.38, -0.12); g.quadraticCurveTo(-0.43, -0.08, -0.42, -0.02); });
  // The wilted star on top.
  const sx = 0.04, sy = -0.3, r = 0.075;
  fillIn(g, 'rgba(20, 30, 10, 0.3)', () => ovalAt(g, sx + 0.012, sy + 0.02, r, r * 0.8));
  fillIn(g, 'rgb(244, 238, 214)', () => { for (let i = 0; i < 6; i++) { const a = 0.3 + i / 6 * TAU; ovalAt(g, sx + Math.cos(a) * r * 0.5, sy + Math.sin(a) * r * 0.45, r * 0.46, r * 0.17, a + 0.4); } });
  fillIn(g, 'rgb(214, 196, 110)', () => ovalAt(g, sx, sy, r * 0.22, r * 0.2));
  g.restore();
}

// ------------------------------------------------------------------ elderflower fritters
//
// Whole elderflower heads dipped in batter and fried in the clay pan: each a lacy plate, the batter set in a golden bead
// round every little floret, gaps between them at the edge where the oil shows through, a cream floret or two peeking out,
// browned on the shade side; their stalks left on and bunched up out of the back to hold them by. The oil a thin gold slick
// round them, a few bubbles in it; honey drizzled over in a line; and a fresh flower head lying at the pan's foot.
const FRITTER = [228, 168, 70];
// An elderflower fritter, rx by ry: its beads of batter in a sunflower's spiral, the stalks up out of the back; k turns it.
function elderFritterAt(g, x, y, rx, ry, k) {
  furGlow(g, [60, 34, 14], 0.45, x + rx * 0.08, y + ry * 0.55, rx * 1.05, ry * 0.6);          // where it sits
  const sx = x + rx * 0.1, sy = y - ry * 0.1, d = k % 2 ? -1 : 1;
  const stalks = () => { g.moveTo(sx, sy); g.quadraticCurveTo(sx + d * 0.03, sy - 0.14, sx + d * 0.1, sy - 0.26); g.moveTo(sx + d * 0.02, sy - 0.08); g.quadraticCurveTo(sx + d * 0.08, sy - 0.12, sx + d * 0.16, sy - 0.12); g.moveTo(sx + d * 0.02, sy - 0.12); g.lineTo(sx - d * 0.04, sy - 0.2); };
  strokeIn(g, rgba([92, 96, 44]), 0.032, stalks);
  strokeIn(g, rgba([170, 160, 90], 0.6), 0.01, stalks);
  const pts = [];
  for (let i = 0; i < 40; i++) { const t = Math.sqrt((i + 0.5) / 40), a = i * 2.39996 + k; pts.push([x + Math.cos(a) * t * rx * 0.88, y + Math.sin(a) * t * ry * 0.84, t]); }
  const beads = (dx, dy, f) => { for (const [px, py] of pts) ovalAt(g, px + dx, py + dy, rx * 0.15 * f, rx * 0.12 * f); };
  softIn(g, tone(FRITTER, 0.62), y - ry * 0.7, y + ry * 0.8, () => ovalAt(g, x, y + ry * 0.06, rx * 0.78, ry * 0.74), 1.1, 0.7);
  fillIn(g, rgba(tone(FRITTER, 0.58)), () => beads(0.008, 0.014, 1));                          // each bead's shade
  softIn(g, FRITTER, y - ry, y + ry, () => beads(0, 0, 0.92), 1.15, 0.72);
  g.save(); g.beginPath(); beads(0.008, 0.014, 1); g.clip();
  furGlow(g, [150, 76, 22], 0.55, x + rx * 0.4, y + ry * 0.4, rx * 0.6, ry * 0.5);              // round: browned on the shade side
  furGlow(g, [255, 236, 170], 0.35, x - rx * 0.3, y - ry * 0.3, rx * 0.4, ry * 0.3);
  g.restore();
  fillIn(g, 'rgba(255, 238, 180, 0.85)', () => { for (const [px, py, t] of pts) if (t < 0.85) ovalAt(g, px - rx * 0.04, py - rx * 0.035, rx * 0.045, rx * 0.03); });   // crisp
  fillIn(g, rgba(FLORET), () => { for (let i = 3; i < pts.length; i += 7) ovalAt(g, pts[i][0], pts[i][1], rx * 0.04, rx * 0.034); });   // a floret peeking out
  furGlow(g, [255, 246, 220], 0.45, x - rx * 0.3, y - ry * 0.32, rx * 0.26, ry * 0.12, -0.2);   // fried glossy
}
function paintElderflowerFritters(g) {
  const { cy, IX, IY } = CLAY_PAN;
  clayPan(g, () => {
    // The oil, a thin gold slick, a few bubbles in it.
    softIn(g, [206, 160, 70], cy - IY * 0.8, cy + IY, () => ovalAt(g, 0, cy + 0.03, IX * 0.96, IY * 0.86), 1.2, 0.7);
    strokeIn(g, 'rgba(255, 236, 160, 0.6)', 0.016, () => g.ellipse(0, cy + 0.03, IX * 0.9, IY * 0.8, 0, Math.PI + 0.5, TAU - 0.4));
    strokeIn(g, 'rgba(255, 244, 200, 0.7)', 0.008, () => { for (const [x, y, r] of [[-0.62, cy + 0.04, 0.02], [0.6, cy + 0.06, 0.016], [-0.52, cy + 0.14, 0.014], [0.5, cy + 0.16, 0.018], [-0.14, cy + 0.2, 0.012]]) ovalAt(g, x, y, r, r * 0.6); });
    elderFritterAt(g, -0.3, cy - 0.1, 0.36, 0.2, 0);
    elderFritterAt(g, 0.32, cy - 0.12, 0.34, 0.19, 1);
    elderFritterAt(g, 0.02, cy + 0.06, 0.38, 0.21, 2);
  });
  // Honey drizzled over in a line.
  const drizzle = () => { g.moveTo(-0.6, cy - 0.16); g.bezierCurveTo(-0.4, cy - 0.3, -0.26, cy - 0.02, -0.06, cy - 0.12); g.bezierCurveTo(0.12, cy - 0.22, 0.14, cy + 0.06, 0.32, cy - 0.06); g.quadraticCurveTo(0.46, cy - 0.14, 0.58, cy - 0.08); };
  strokeIn(g, rgba(tone(HONEY, 0.8), 0.85), 0.036, drizzle);
  strokeIn(g, rgba(HONEY, 0.95), 0.024, drizzle);
  strokeIn(g, 'rgba(255, 238, 170, 0.8)', 0.008, () => { g.save(); g.translate(-0.006, -0.008); drizzle(); g.restore(); });
  // A fresh head at the pan's foot.
  strokeIn(g, rgba([96, 132, 56]), 0.026, () => { g.moveTo(0.5, 0.78); g.quadraticCurveTo(0.34, 0.82, 0.2, 0.78); });
  elderAt(g, 0.66, 0.7, 0.24, 0.13);
}

// ------------------------------------------------------------------ rosehip syrup
//
// The syrup in a squat stoneware crock: buff clay, the top half dipped in a dark brown glaze that ran in drips down its belly,
// glossy where the light falls; its rim rolled, and in its mouth the syrup, a deep glossy red, ruby where it's lit. At its
// foot the muslin it was strained through, bunched up and stained pink, two hips beside it, and a wooden spoon lying with a
// spoonful in its bowl and a drop run off onto the ground.
const STONEWARE = [214, 184, 140], GLAZE = [98, 58, 34], SYRUP = [150, 22, 22], MUSLIN = [242, 234, 218];
function paintRosehipSyrup(g) {
  const my = -0.26, MX = 0.4, MRY = 0.11, fy = 0.56, FX = 0.4, FRY = 0.1;   // its mouth and its foot
  sitShadow(g, 0.04, fy + 0.08, 0.84, 0.14, 0.32);
  const body = () => {
    g.moveTo(-MX, my);
    g.bezierCurveTo(-MX - 0.04, my + 0.12, -0.56, -0.04, -0.56, 0.18);
    g.bezierCurveTo(-0.56, 0.4, -0.48, fy - 0.02, -FX, fy);
    g.ellipse(0, fy, FX, FRY, 0, Math.PI, 0, true);
    g.bezierCurveTo(0.48, fy - 0.02, 0.56, 0.4, 0.56, 0.18);
    g.bezierCurveTo(0.56, -0.04, MX + 0.04, my + 0.12, MX, my);
    g.ellipse(0, my, MX, MRY, 0, 0, Math.PI, true);
    g.closePath();
  };
  softIn(g, STONEWARE, my, fy + FRY, body, 1.1, 0.72);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, [150, 110, 70], 0.5, 0.1, fy, 0.5, 0.12);                                          // grubby at the foot
  // The glaze it was dipped in, run down in drips.
  const edge = x => 0.12 + Math.sqrt(Math.max(0, 1 - (x / 0.6) ** 2)) * 0.1 + 0.012 * Math.sin(x * 23);
  const dip = () => {
    g.moveTo(-0.7, my - 0.2); g.lineTo(0.7, my - 0.2); g.lineTo(0.7, edge(0.7));
    for (const [x, l] of [[0.44, 0.1], [0.18, 0.06], [-0.08, 0.14], [-0.38, 0.08]]) {   // a drip: down and round and back up
      g.lineTo(x + 0.05, edge(x + 0.05));
      g.quadraticCurveTo(x + 0.03, edge(x) + l * 0.5, x + 0.028, edge(x) + l); g.arc(x, edge(x) + l, 0.028, 0, Math.PI); g.quadraticCurveTo(x - 0.03, edge(x) + l * 0.5, x - 0.05, edge(x - 0.05));
    }
    g.lineTo(-0.7, edge(-0.7));
    g.closePath();
  };
  softIn(g, GLAZE, my, 0.34, dip, 1.4, 0.7);
  furGlow(g, [70, 44, 26], 0.55, 0.42, 0.22, 0.3, 0.5);                                         // round: the shade side
  furGlow(g, [255, 240, 220], 0.4, -0.38, 0.22, 0.08, 0.18, 0.1);                               // the light down its belly
  g.save(); g.beginPath(); dip(); g.clip();
  furGlow(g, [255, 236, 210], 0.6, -0.36, -0.02, 0.06, 0.13, 0.15);                             // the glaze glossy
  fillIn(g, 'rgba(255, 250, 240, 0.85)', () => ovalAt(g, -0.38, -0.04, 0.018, 0.05, 0.15));
  g.restore();
  g.restore();
  // The rim, and the syrup in the mouth.
  fillIn(g, rgba(tone(GLAZE, 1.25, 10)), () => ovalAt(g, 0, my, MX, MRY));
  const mouth = () => ovalAt(g, 0, my + 0.006, MX - 0.05, MRY - 0.026);
  fillIn(g, rgba([40, 16, 10]), mouth);
  g.save(); g.beginPath(); mouth(); g.clip();
  softIn(g, SYRUP, my - 0.03, my + 0.08, () => ovalAt(g, 0, my + 0.02, MX - 0.06, MRY - 0.03), 1.25, 0.6);
  furGlow(g, [236, 80, 50], 0.6, -0.06, my + 0.03, 0.22, 0.04);                                 // ruby where it's lit
  furGlow(g, [255, 240, 230], 0.65, -0.14, my, 0.1, 0.016);                                     // the sky in it
  furGlow(g, [30, 6, 6], 0.5, 0, my + 0.08, MX, 0.025);                                         // shaded under the front of the rim
  g.restore();
  strokeIn(g, 'rgba(255, 236, 214, 0.6)', 0.012, () => g.ellipse(0, my - 0.006, MX - 0.01, MRY - 0.006, 0, Math.PI + 0.3, TAU - 0.4));
  strokeIn(g, rgba(tone(GLAZE, 0.6), 0.7), 0.014, () => g.ellipse(0, my, MX, MRY, 0, 0.1, Math.PI - 0.1));
  // The muslin at its foot, bunched and stained, and two hips.
  const cloth = () => lumpy(g, -0.62, fy + 0.02, 0.26, 0.13, STONE_LUMPS);
  softIn(g, MUSLIN, fy - 0.12, fy + 0.15, cloth, 1.05, 0.78);
  g.save(); g.beginPath(); cloth(); g.clip();
  furGlow(g, [214, 90, 90], 0.55, -0.56, fy + 0.04, 0.14, 0.07, 0.3);                           // stained pink
  furGlow(g, [120, 100, 80], 0.35, -0.5, fy + 0.12, 0.2, 0.05);
  g.restore();
  strokeIn(g, 'rgba(160, 140, 116, 0.6)', 0.012, () => { g.moveTo(-0.8, fy - 0.02); g.quadraticCurveTo(-0.68, fy + 0.04, -0.58, fy - 0.04); g.moveTo(-0.7, fy + 0.1); g.quadraticCurveTo(-0.6, fy + 0.06, -0.44, fy + 0.1); });   // its folds
  hipAt(g, -0.54, fy + 0.2, 0.22, 0.25);
  hipAt(g, -0.28, fy + 0.24, 0.2, -0.4);
  // The spoon, lying with a spoonful in it, and a drop run off onto the ground.
  const handle = () => { g.moveTo(0.3, fy + 0.18); g.quadraticCurveTo(0.6, fy + 0.12, 0.92, fy - 0.02); };
  strokeIn(g, rgba(tone(WOOD, 0.62)), 0.07, handle);
  strokeIn(g, rgba(WOOD_RIM), 0.048, handle);
  strokeIn(g, 'rgba(255, 240, 210, 0.7)', 0.012, () => { g.moveTo(0.4, fy + 0.14); g.quadraticCurveTo(0.6, fy + 0.1, 0.88, fy - 0.03); });
  furGlow(g, [60, 30, 16], 0.4, 0.16, fy + 0.26, 0.2, 0.06);
  softIn(g, WOOD_RIM, fy + 0.12, fy + 0.3, () => ovalAt(g, 0.16, fy + 0.21, 0.17, 0.085, -0.12), 1.1, 0.7);
  strokeIn(g, rgba(tone(WOOD, 0.6), 0.7), 0.012, () => ovalAt(g, 0.16, fy + 0.21, 0.17, 0.085, -0.12));
  softIn(g, SYRUP, fy + 0.15, fy + 0.27, () => ovalAt(g, 0.16, fy + 0.215, 0.13, 0.058, -0.12), 1.3, 0.6);
  furGlow(g, [255, 236, 226], 0.7, 0.12, fy + 0.2, 0.06, 0.014, -0.12);
  softIn(g, SYRUP, fy + 0.3, fy + 0.36, () => ovalAt(g, 0.02, fy + 0.33, 0.05, 0.022), 1.3, 0.6);
  fillIn(g, 'rgba(255, 236, 226, 0.85)', () => ovalAt(g, 0.006, fy + 0.322, 0.012, 0.006));
}

// ------------------------------------------------------------------ nettle soup
//
// The hedgehog's soup, in the clay bowl from the pot (as the wilted greens'): deep dark green, lighter where the light falls,
// flecked with chopped leaf, beads of gold from the mushrooms on it; slices of mushroom floating, and fresh nettle tops laid
// on, the young leaves bright, toothed and in pairs. A wisp of steam off it.
const NETTLE_SOUP = [56, 100, 40], NETTLE = [76, 134, 48];
// A nettle top along +x, size s: a short stem, two pairs of toothed leaves and the young tip.
function nettleTopAt(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  furGlow(g, [14, 30, 10], 0.4, 0.14, 0.05, 0.22, 0.1);
  strokeIn(g, rgba([112, 146, 72]), 0.026, () => { g.moveTo(-0.04, 0); g.lineTo(0.22, 0); });
  for (const [ux, a, l, w, k] of [[0.0, -1.0, 0.22, 0.075, 0.9], [0.0, 1.0, 0.22, 0.075, 0.86], [0.1, -0.6, 0.18, 0.065, 1], [0.1, 0.6, 0.18, 0.065, 0.96], [0.2, 0, 0.16, 0.06, 1.1]]) {
    const rgb = tone(NETTLE, k);
    g.save(); g.translate(ux, 0); g.rotate(a);
    softIn(g, rgb, -w, w, () => nettlePath(g, l, w, 0, 5), 1.3, 0.66);
    strokeIn(g, rgba(tone(rgb, 0.55), 0.6), 0.008, () => nettlePath(g, l, w, 0, 5));
    strokeIn(g, rgba(tone(rgb, 1.4, 26), 0.6), w * 0.14, () => { g.moveTo(l * 0.04, 0); g.lineTo(l * 0.86, 0); });
    g.restore();
  }
  g.restore();
}
function paintNettleSoup(g) {
  const { cy, IX, IY } = CLAY_BOWL, sy = cy + 0.04;
  clayBowl(g, () => {
    fillIn(g, rgba(NETTLE_SOUP), () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.03));
    furGlow(g, [30, 60, 20], 0.5, 0.26, sy, 0.3, 0.1);                                         // darker where it's deep
    furGlow(g, [124, 168, 80], 0.6, -0.16, sy - 0.03, 0.4, 0.1);                              // lighter where the light falls
    furGlow(g, [14, 34, 8], 0.55, 0.1, sy + 0.12, IX * 0.8, 0.05);                            // shaded under the front of the rim
    fillIn(g, rgba([30, 66, 22], 0.8), () => { for (const [x, y, a] of [[-0.42, sy + 0.02, 0.4], [0.36, sy - 0.06, -0.6], [0.12, sy + 0.08, 1.1], [-0.2, sy - 0.08, -0.2], [0.48, sy + 0.04, 0.3], [-0.04, sy + 0.0, 2]]) ovalAt(g, x, y, 0.026, 0.012, a); });   // chopped leaf
    strokeIn(g, 'rgba(236, 196, 90, 0.7)', 0.008, () => { for (const [x, y, r] of [[0.26, sy - 0.08, 0.02], [0.34, sy - 0.03, 0.013], [-0.5, sy + 0.05, 0.016], [-0.28, sy + 0.08, 0.012], [0.46, sy + 0.08, 0.014]]) ovalAt(g, x, y, r, r * 0.6); });   // beads of gold
    furGlow(g, [255, 255, 240], 0.4, -0.34, sy - 0.07, 0.14, 0.025, -0.05);                   // the sky in it
    halfShroomAt(g, -0.34, sy - 0.02, 0.36, -0.5, FRIED);
    halfShroomAt(g, 0.36, sy + 0.0, 0.34, 0.45, FRIED);
    halfShroomAt(g, 0.08, sy + 0.08, 0.3, 0.15, FRIED);
    nettleTopAt(g, -0.14, sy - 0.02, 0.95, -0.3);
    nettleTopAt(g, 0.12, sy - 0.08, 0.85, -2.7);
  });
  // A wisp of steam off it.
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.14, -0.1); g.bezierCurveTo(-0.24, -0.3, -0.04, -0.4, -0.12, -0.62); g.moveTo(0.18, -0.08); g.bezierCurveTo(0.12, -0.24, 0.3, -0.32, 0.22, -0.52); });
}

// ------------------------------------------------------------------ chicken of the woods steak
//
// A thick slab of chicken of the woods seared in the clay pan like a steak: deep orange and lobed, sulphur yellow out at
// its rim, the cut edge showing pale pores underneath. Burnt brown where it caught the pan, glossy with butter, dark sear
// lines across it, a few garlic cloves gone golden and a garlic leaf laid over the edge, and steam coming off it.
const CHICKEN_STEAK = [226, 92, 18], CHICKEN_STEAK_LIT = [252, 166, 40], CHICKEN_STEAK_RIM = [252, 206, 58],
  CHICKEN_PORE = [246, 212, 118], CHICKEN_CHAR = [100, 42, 18], CHICKEN_CLOVE = [214, 172, 104], CHICKEN_CLOVE_GOLD = [172, 104, 34];
// The shelf's outline: a lobed slab, wider at its front, wobbling with k.
function chickenSteakPoint(a, rx, ry, k) {
  const w = 1 + 0.075 * Math.sin(a * 3 + k) + 0.03 * Math.sin(a * 7 - k * 2);
  return [Math.cos(a) * rx * w * (0.8 + 0.22 * Math.sin(a)), Math.sin(a) * ry * w];
}
function chickenSteakPath(g, rx, ry, k) {
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const [px, py] = chickenSteakPoint(i / N * TAU, rx, ry, k);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
// One thick fried shelf, its pale pore edge under the front, sear lines on top.
function chickenSteakAt(g, x, y, rx, ry, rot, k, shade) {
  const base = tone(CHICKEN_STEAK, shade), rim = tone(CHICKEN_STEAK_RIM, shade), pore = tone(CHICKEN_PORE, shade), char = tone(CHICKEN_CHAR, shade);
  g.save(); g.translate(x, y); g.rotate(rot);
  const top = () => chickenSteakPath(g, rx, ry, k);
  const under = () => { g.save(); g.translate(0, 0.02); chickenSteakPath(g, rx * 1.01, ry + 0.03, k); g.restore(); };
  fillIn(g, rgba(char, 0.35), () => { g.save(); g.translate(0.05, 0.1); chickenSteakPath(g, rx, ry, k); g.restore(); });   // where it sits
  // Its thickness, the pale pores showing under the front edge.
  fillIn(g, rgba(pore), under);
  softIn(g, tone(pore, 0.8), ry * 0.4, ry + 0.06, under, 1.0, 0.72);
  strokeIn(g, rgba(tone(pore, 0.66), 0.5), 0.006, () => {
    for (let i = 0; i <= 12; i++) {
      const [px, py] = chickenSteakPoint((0.12 + i * 0.76 / 12) * Math.PI, rx, ry, k);
      g.moveTo(px, py + 0.008); g.lineTo(px, py + 0.055);
    }
  });
  // The fried top: deep orange, going golden out to its rim.
  softIn(g, base, -ry, ry, top, 1.16, 0.78);
  g.save(); g.beginPath(); top(); g.clip();
  g.save(); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * 0.18, 0, 0, rx * 1.14);
  gr.addColorStop(0, rgba(rim, 0)); gr.addColorStop(0.7, rgba(rim, 0.15)); gr.addColorStop(1, rgba(rim, 0.9));
  g.fillStyle = gr; g.fillRect(-rx * 1.3, -rx * 1.3, rx * 2.6, rx * 2.6);
  g.restore();
  furGlow(g, CHICKEN_STEAK_LIT, 0.42, -rx * 0.3, -ry * 0.38, rx * 0.5, ry * 0.36);              // the light on it
  furGlow(g, char, 0.5, rx * 0.5, ry * 0.45, rx * 0.6, ry * 0.55);                              // round: browned on the shade side
  furGlow(g, [70, 26, 10], 0.55, -rx * 0.64, ry * 0.34, rx * 0.22, ry * 0.16, 0.3);              // a charred spot
  furGlow(g, [70, 26, 10], 0.45, rx * 0.55, -ry * 0.36, rx * 0.2, ry * 0.12, -0.2);
  furGlow(g, [150, 56, 14], 0.3, -rx * 0.05, ry * 0.18, rx * 0.42, ry * 0.22, 0.2);              // a browner patch, unevenly fried
  strokeIn(g, rgba(char, 0.5), 0.085, top);                                                       // the seared crust round its rim
  strokeIn(g, rgba(rim, 0.9), 0.03, top);                                                         // the bright sulphur rim, inside the crust
  strokeIn(g, rgba(char, 0.6), 0.03, () => {                                                      // sear lines, like a steak's
    for (const d of [-0.12, 0.12, 0.36]) {
      g.moveTo(-rx * 0.7, ry * (d + 0.16));
      g.quadraticCurveTo(0, ry * (d + 0.01), rx * 0.7, ry * (d - 0.18));
    }
  });
  strokeIn(g, 'rgba(255, 214, 130, 0.4)', 0.012, () => {                                          // the light along the sear ridges
    for (const d of [-0.12, 0.12, 0.36]) {
      g.moveTo(-rx * 0.66, ry * (d + 0.14));
      g.quadraticCurveTo(0, ry * (d - 0.01), rx * 0.66, ry * (d - 0.2));
    }
  });
  strokeIn(g, 'rgba(255, 244, 206, 0.68)', 0.022, () => {                                          // butter-sheen on the lit edge
    g.moveTo(-rx * 0.52, -ry * 0.3); g.bezierCurveTo(-rx * 0.3, -ry * 0.76, rx * 0.14, -ry * 0.84, rx * 0.42, -ry * 0.48);
  });
  fillIn(g, 'rgba(255, 252, 232, 0.9)', () => { ovalAt(g, -rx * 0.3, -ry * 0.34, 0.018, 0.011, -0.3); ovalAt(g, 0.02, -ry * 0.52, 0.012, 0.008); });
  g.restore();
  strokeIn(g, rgba(tone(base, 0.52), 0.65), 0.014, top);
  g.restore();
}
// A clove of garlic, fried gold at its edge.
function chickenCloveAt(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const clove = () => {
    g.moveTo(-r * 1.1, 0);
    g.bezierCurveTo(-r * 0.7, -r * 0.5, 0, -r * 0.64, r * 0.55, -r * 0.4);
    g.bezierCurveTo(r * 1.0, -r * 0.2, r * 0.94, r * 0.4, r * 0.34, r * 0.56);
    g.bezierCurveTo(-r * 0.24, r * 0.72, -r * 0.76, r * 0.44, -r * 1.1, 0);
    g.closePath();
  };
  fillIn(g, 'rgba(70, 38, 10, 0.3)', () => { g.save(); g.translate(0.018, 0.03); clove(); g.restore(); });
  softIn(g, CHICKEN_CLOVE, -r * 0.7, r * 0.7, clove, 1.06, 0.7);
  strokeIn(g, rgba(CHICKEN_CLOVE_GOLD, 0.9), 0.012, clove);
  furGlow(g, [255, 244, 206], 0.5, -r * 0.28, -r * 0.26, r * 0.3, r * 0.16, -0.3);
  strokeIn(g, 'rgba(255, 246, 214, 0.45)', 0.008, () => { g.moveTo(-r * 0.7, -r * 0.05); g.quadraticCurveTo(0, -r * 0.32, r * 0.6, -r * 0.18); });
  g.restore();
}
function paintChickenSteak(g) {
  const { cy, IX, IY } = CLAY_PAN;
  clayPan(g, () => {
    // Butter and juices in the pan, a line of light along its far edge.
    softIn(g, JUS, cy - IY * 0.8, cy + IY, () => ovalAt(g, 0, cy + 0.03, IX * 0.96, IY * 0.86), 1.2, 0.7);
    strokeIn(g, 'rgba(255, 220, 150, 0.55)', 0.016, () => g.ellipse(0, cy + 0.03, IX * 0.9, IY * 0.8, 0, Math.PI + 0.5, TAU - 0.4));
    // The steak, long and thick, filling the pan.
    chickenSteakAt(g, -0.03, cy - 0.02, 0.8, 0.2, -0.1, 1, 1);
    // Garlic, fried golden, scattered over it and a leaf laid across.
    chickenCloveAt(g, -0.36, cy - 0.02, 0.078, -0.5);
    chickenCloveAt(g, -0.06, cy + 0.1, 0.072, 0.3);
    chickenCloveAt(g, 0.26, cy - 0.02, 0.075, -0.2);
    leafAt(g, 'g', 0.1, cy - 0.16, 0.4, 0.105, -0.42, -0.3, 1.05);
    // Butter bubbling round the edge and glinting in the pan.
    fillIn(g, rgba([255, 226, 146], 0.7), () => { for (const [x, y, r] of [[-0.62, cy + 0.12, 0.022], [0.62, cy + 0.14, 0.018], [0.5, cy + 0.21, 0.014], [-0.48, cy + 0.21, 0.016]]) ovalAt(g, x, y, r, r * 0.55); });
    fillIn(g, 'rgba(255, 252, 236, 0.85)', () => { ovalAt(g, -0.35, cy + 0.23, 0.014, 0.008); ovalAt(g, 0.38, cy + 0.24, 0.011, 0.007); });
  });
  // Steam off the steak.
  strokeIn(g, 'rgba(255, 255, 250, 0.32)', 0.033, () => {
    g.moveTo(-0.16, -0.14); g.bezierCurveTo(-0.26, -0.34, -0.06, -0.44, -0.14, -0.66);
    g.moveTo(0.2, -0.12); g.bezierCurveTo(0.14, -0.3, 0.32, -0.38, 0.24, -0.58);
  });
}

// ------------------------------------------------------------------ forest stew
//
// A thick autumn stew in the clay bowl from the pot: a glossy brown gravy with big halved ceps in it, the cut stems pale and
// the seared caps chestnut, golden chanterelles curled like little trumpets, whole toasted hazelnuts, slivers of garlic gone
// gold and flecks of green on top. A wisp of steam off it.
const FSTEW_GRAVY = [112, 66, 34], FSTEW_CHANT = [236, 164, 36], FSTEW_CUT = [222, 182, 128];
// A chanterelle seen from above, wavy-edged and dipped in the middle, size s: gold, ridges running out from the centre.
function fstewChanterelleAt(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  furGlow(g, [40, 20, 8], 0.45, 0.03, 0.08, 0.34, 0.2);
  const frill = () => {
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * TAU, w = 1 + 0.14 * Math.sin(a * 5) + 0.05 * Math.sin(a * 9 + 1);
      const px = Math.cos(a) * 0.3 * w, py = Math.sin(a) * 0.21 * w;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };
  softIn(g, FSTEW_CHANT, -0.24, 0.24, frill, 1.25, 0.68);
  g.save(); g.beginPath(); frill(); g.clip();
  furGlow(g, [150, 80, 16], 0.6, 0.02, 0.02, 0.12, 0.08);                                    // the dip in the middle
  furGlow(g, [150, 80, 16], 0.5, 0.2, 0.1, 0.18, 0.12);
  strokeIn(g, rgba([176, 104, 22], 0.6), 0.016, () => { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.moveTo(Math.cos(a) * 0.1, Math.sin(a) * 0.07); g.lineTo(Math.cos(a) * 0.34, Math.sin(a) * 0.24); } });
  furGlow(g, [255, 236, 150], 0.6, -0.12, -0.1, 0.12, 0.06, -0.4);
  g.restore();
  strokeIn(g, rgba([140, 74, 14], 0.8), 0.018, frill);
  fillIn(g, 'rgba(255, 250, 220, 0.9)', () => ovalAt(g, -0.14, -0.1, 0.03, 0.014, -0.4));
  g.restore();
}
function paintForestStew(g) {
  const { cy, IX, IY } = CLAY_BOWL, sy = cy + 0.04;
  clayBowl(g, () => {
    fillIn(g, rgba(FSTEW_GRAVY), () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.03));
    furGlow(g, [60, 30, 12], 0.55, 0.28, sy, 0.32, 0.1);                                      // darker where it's deep
    furGlow(g, [188, 120, 60], 0.55, -0.18, sy - 0.03, 0.42, 0.1);                            // lighter where the light falls
    furGlow(g, [30, 14, 6], 0.55, 0.1, sy + 0.12, IX * 0.8, 0.05);                            // shaded under the front of the rim
    // Everything heaps up above the rim, back to front.
    halfShroomAt(g, -0.3, sy - 0.1, 0.6, -0.3, FSTEW_CUT);
    halfShroomAt(g, 0.28, sy - 0.1, 0.58, 0.3, FSTEW_CUT);
    fstewChanterelleAt(g, -0.5, sy + 0.02, 0.7, 0.2);
    fstewChanterelleAt(g, 0.52, sy + 0.02, 0.68, -0.3);
    fstewChanterelleAt(g, 0.0, sy - 0.02, 0.66, 0.5);
    hazelKernelAt(g, -0.3, sy + 0.1, 0.07, 0.4, 1);
    hazelKernelAt(g, 0.34, sy + 0.1, 0.07, -0.5, 2);
    hazelKernelAt(g, -0.58, sy + 0.1, 0.065, 1.2, 0);
    hazelKernelAt(g, 0.6, sy + 0.1, 0.065, 2.4, 1);
    fillIn(g, 'rgb(240, 214, 150)', () => { for (const [x, y, a] of [[-0.32, sy + 0.02, 0.4], [0.06, sy - 0.14, -0.6], [0.36, sy + 0.04, 1.1], [-0.04, sy + 0.1, -0.2]]) ovalAt(g, x, y, 0.05, 0.022, a); });   // garlic slivers
    fillIn(g, 'rgb(250, 238, 196)', () => { for (const [x, y, a] of [[-0.33, sy + 0.01, 0.4], [0.05, sy - 0.15, -0.6], [0.35, sy + 0.03, 1.1], [-0.05, sy + 0.09, -0.2]]) ovalAt(g, x, y, 0.036, 0.013, a); });
    fillIn(g, rgba([74, 124, 44], 0.9), () => { for (const [x, y, a] of [[-0.26, sy - 0.12, 0.4], [0.18, sy - 0.16, -0.6], [0.5, sy - 0.04, 0.3], [-0.52, sy - 0.02, 1.4], [0.0, sy + 0.14, 0.2], [0.14, sy + 0.04, 2]]) ovalAt(g, x, y, 0.03, 0.013, a); });   // green flecks
    strokeIn(g, 'rgba(255, 224, 150, 0.6)', 0.01, () => { ovalAt(g, -0.6, sy + 0.05, 0.03, 0.014); ovalAt(g, 0.6, sy + 0.04, 0.03, 0.014); ovalAt(g, 0.1, sy + 0.15, 0.03, 0.012); });   // gleams on the gravy
  });
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.14, -0.2); g.bezierCurveTo(-0.24, -0.4, -0.04, -0.5, -0.12, -0.7); g.moveTo(0.18, -0.18); g.bezierCurveTo(0.12, -0.34, 0.3, -0.42, 0.22, -0.62); });
}

// The painted dishes by name, in the order of their numbers ('dish:' + n): a new one goes at the end.
// ------------------------------------------------------------------ toasted beechnuts, in the pan
//
// The beechnuts toasted in the clay pan over the embers: a dark scorched floor with a few drifting bits of shell, and a
// round heap of nuts piled up over the rim, glossy chestnut brown, the back ones highest, three or four split open on their
// gold kernels, and a thin curl of heat off the top.
const BEECHPAN_FLOOR = [58, 32, 20];
// [x, y, length, turn, split], back to front.
const BEECHPAN_NUTS = [
  [-0.5, -0.02, 0.27, 0.4, true], [-0.22, -0.08, 0.27, -0.5, false], [0.08, -0.1, 0.27, 0.6, true], [0.38, -0.04, 0.26, -0.2, false],
  [0.62, 0.08, 0.25, 2.6, true], [-0.62, 0.14, 0.26, -0.6, false], [-0.34, 0.12, 0.28, 2.7, false], [-0.04, 0.1, 0.28, 0.3, true],
  [0.26, 0.12, 0.28, -0.6, false], [-0.5, 0.28, 0.27, -0.2, false], [-0.16, 0.26, 0.28, 0.9, true], [0.18, 0.28, 0.27, 2.9, false],
  [0.5, 0.26, 0.26, 0.5, false], [-0.1, -0.22, 0.26, 1.1, false], [0.22, -0.24, 0.25, 2.0, true]];
function paintToastedBeechnutsPan(g) {
  const { cy, IX, IY } = CLAY_PAN;
  clayPan(g, () => {
    softIn(g, BEECHPAN_FLOOR, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.03, IX * 0.97, IY * 0.9), 1.25, 0.6);
    furGlow(g, [20, 10, 6], 0.6, 0.3, cy + 0.14, 0.4, 0.12);                                  // scorched where the heat was
    furGlow(g, [255, 190, 90], 0.3, 0, cy - 0.02, 0.6, 0.2);                                  // warm off the embers
    for (const [x, y, l, rot, split] of BEECHPAN_NUTS) beechnutAt(g, x, y, l, rot, split);
    fillIn(g, rgba([60, 32, 16], 0.85), () => { for (const [x, y, a] of [[-0.66, cy + 0.12, 0.4], [0.62, cy + 0.2, -0.5], [0.2, cy + 0.27, 1.2]]) ovalAt(g, x, y, 0.03, 0.014, a); });   // bits of shell
  });
  strokeIn(g, 'rgba(255, 250, 240, 0.3)', 0.04, () => { g.moveTo(-0.12, -0.36); g.bezierCurveTo(-0.2, -0.52, 0.0, -0.6, -0.08, -0.76); g.moveTo(0.2, -0.34); g.bezierCurveTo(0.14, -0.48, 0.3, -0.56, 0.24, -0.7); });
}

// ------------------------------------------------------------------ baked apple with honey, third painting
//
// The apple whole on the hot stone, its top sliced off as a lid and set back on askew, the stalk still in it. The apple
// slumped soft in the heat, deep glossy red and wrinkled; honey wells up from under the lid in a bright amber collar and runs
// down the shoulders in three fat drips, gone dark as caramel at the edges, and pools on the stone. A curl of steam.
const BAKED3_SKIN = [160, 40, 30], BAKED3_FLESH = [244, 200, 112], BAKED3_LID = [176, 48, 34];
// The drips down the front: [x at the collar, length, width], left to right.
const BAKED3_DRIPS = [[-0.36, 0.14, 0.045], [-0.02, 0.3, 0.06], [0.34, 0.2, 0.05]];
function paintBakedApple3(g) {
  const sy = 0.52;
  sitShadow(g, 0, sy + 0.2, 0.88, 0.14, 0.3);
  // The stone, as in the first painting.
  softIn(g, tone(STONE, 0.72), sy, sy + 0.32, () => lumpy(g, 0, sy + 0.09, 0.86, 0.25, STONE_LUMPS), 1.0, 0.6);
  softIn(g, STONE, sy - 0.24, sy + 0.24, () => lumpy(g, 0, sy, 0.86, 0.25, STONE_LUMPS), 1.2, 0.86);
  furGlow(g, [255, 250, 240], 0.22, -0.46, sy - 0.1, 0.3, 0.07);
  fillIn(g, 'rgba(52, 44, 40, 0.6)', () => { ovalAt(g, -0.66, sy + 0.08, 0.016, 0.01); ovalAt(g, 0.7, sy - 0.04, 0.012, 0.008); });
  furGlow(g, [255, 130, 50], 0.26, 0.62, sy + 0.08, 0.3, 0.1);
  // Honey pooled round its foot.
  softIn(g, HONEY, sy - 0.1, sy + 0.14, () => { g.moveTo(-0.56, sy + 0.01); g.bezierCurveTo(-0.56, sy - 0.09, 0.4, sy - 0.11, 0.6, sy - 0.02); g.bezierCurveTo(0.66, sy + 0.07, 0.46, sy + 0.14, 0.12, sy + 0.14); g.bezierCurveTo(-0.3, sy + 0.15, -0.56, sy + 0.1, -0.56, sy + 0.01); g.closePath(); }, 1.1, 0.72);
  strokeIn(g, 'rgba(255, 236, 170, 0.75)', 0.02, () => { g.moveTo(-0.42, sy + 0.05); g.quadraticCurveTo(-0.22, sy + 0.1, 0.02, sy + 0.1); });
  // The apple, slumped: broad and low, flat on top where the lid came off.
  const ty = -0.2, by = sy + 0.02;                              // its cut top and its foot
  const apple = () => {
    g.moveTo(-0.34, ty);
    g.bezierCurveTo(-0.6, ty - 0.02, -0.7, ty + 0.3, -0.6, by - 0.18);
    g.bezierCurveTo(-0.5, by - 0.02, -0.24, by + 0.02, 0, by - 0.02);
    g.bezierCurveTo(0.24, by + 0.02, 0.5, by - 0.02, 0.6, by - 0.18);
    g.bezierCurveTo(0.7, ty + 0.3, 0.6, ty - 0.02, 0.34, ty);
    g.closePath();
  };
  furGlow(g, [60, 26, 12], 0.5, 0.02, by - 0.01, 0.48, 0.07);
  softIn(g, BAKED3_SKIN, ty, by, apple, 1.2, 0.5);
  g.save(); g.beginPath(); apple(); g.clip();
  furGlow(g, [72, 14, 14], 0.6, 0.36, by - 0.2, 0.36, 0.34);                                   // round: the shade side
  furGlow(g, [232, 120, 64], 0.4, -0.36, ty + 0.24, 0.2, 0.24);                                // baked warm where the light is
  furGlow(g, [110, 46, 20], 0.35, -0.2, by - 0.1, 0.18, 0.08);                                 // browned where it sat
  strokeIn(g, rgba(tone(BAKED3_SKIN, 0.5), 0.4), 0.016, () => {                               // wrinkled as it slumped
    g.moveTo(-0.52, ty + 0.2); g.quadraticCurveTo(-0.5, ty + 0.4, -0.4, by - 0.1);
    g.moveTo(-0.3, ty + 0.3); g.quadraticCurveTo(-0.3, ty + 0.46, -0.22, by - 0.1);
    g.moveTo(0.22, ty + 0.36); g.quadraticCurveTo(0.26, ty + 0.48, 0.2, by - 0.08);
    g.moveTo(0.44, ty + 0.34); g.quadraticCurveTo(0.48, ty + 0.46, 0.4, by - 0.08);
  });
  g.restore();
  // Honey welling up over the cut top: an amber collar, and drips down the shoulders.
  const collar = () => {
    g.moveTo(-0.48, ty + 0.04);
    g.bezierCurveTo(-0.48, ty - 0.12, 0.48, ty - 0.12, 0.48, ty + 0.04);
    g.bezierCurveTo(0.48, ty + 0.1, 0.44, ty + 0.12, 0.4, ty + 0.11);
    for (let i = BAKED3_DRIPS.length - 1; i >= 0; i--) {
      const [x, l, w] = BAKED3_DRIPS[i];
      g.lineTo(x + w, ty + 0.12);
      g.lineTo(x + w * 0.9, ty + 0.1 + l);
      g.arc(x, ty + 0.1 + l, w * 0.9, 0, Math.PI);
      g.lineTo(x - w, ty + 0.12);
    }
    g.bezierCurveTo(-0.44, ty + 0.12, -0.48, ty + 0.1, -0.48, ty + 0.04);
    g.closePath();
  };
  softIn(g, HONEY, ty - 0.1, ty + 0.44, collar, 1.3, 0.75);
  g.save(); g.beginPath(); collar(); g.clip();
  furGlow(g, [140, 66, 14], 0.5, 0.3, ty + 0.14, 0.3, 0.12);
  furGlow(g, [255, 220, 120], 0.6, -0.24, ty - 0.02, 0.22, 0.06);
  g.restore();
  strokeIn(g, rgba(CARAMEL, 0.7), 0.014, collar);
  strokeIn(g, 'rgba(255, 246, 204, 0.85)', 0.02, () => { g.moveTo(-0.42, ty + 0.03); g.quadraticCurveTo(-0.4, ty - 0.05, -0.26, ty - 0.07); });
  for (const [x, l, w] of BAKED3_DRIPS) {
    strokeIn(g, 'rgba(255, 246, 204, 0.8)', 0.016, () => { g.moveTo(x - w * 0.4, ty + 0.16); g.lineTo(x - w * 0.4, ty + 0.04 + l); });
    fillIn(g, 'rgba(255, 250, 236, 0.9)', () => ovalAt(g, x - w * 0.35, ty + 0.1 + l, 0.012, 0.016));
  }
  // The lid, set back on askew: a red cap with its gold cut edge showing, the stalk and a soft leaf.
  const lx = 0.05, ly = ty - 0.05;
  g.save(); g.translate(lx, ly); g.rotate(-0.12);
  const cut = () => ovalAt(g, 0, 0.02, 0.34, 0.08);
  softIn(g, BAKED3_FLESH, -0.06, 0.1, cut, 1.0, 0.75);
  strokeIn(g, rgba(CARAMEL, 0.6), 0.02, cut);
  const cap = () => { g.moveTo(-0.34, 0); g.bezierCurveTo(-0.34, -0.2, -0.12, -0.26, 0, -0.24); g.bezierCurveTo(0.12, -0.26, 0.34, -0.2, 0.34, 0); g.bezierCurveTo(0.2, 0.05, -0.2, 0.05, -0.34, 0); g.closePath(); };
  softIn(g, BAKED3_LID, -0.26, 0.04, cap, 1.3, 0.6);
  g.save(); g.beginPath(); cap(); g.clip();
  furGlow(g, [80, 16, 14], 0.5, 0.22, 0, 0.2, 0.12);
  furGlow(g, [240, 140, 80], 0.45, -0.16, -0.14, 0.12, 0.07);
  g.restore();
  strokeIn(g, rgba(tone(BAKED3_LID, 0.5), 0.7), 0.014, cap);
  strokeIn(g, 'rgba(255, 240, 220, 0.85)', 0.022, () => { g.moveTo(-0.24, -0.1); g.quadraticCurveTo(-0.18, -0.19, -0.06, -0.2); });
  strokeIn(g, 'rgb(92, 62, 36)', 0.05, () => { g.moveTo(0, -0.23); g.quadraticCurveTo(0.0, -0.36, 0.07, -0.43); });
  strokeIn(g, 'rgba(176, 130, 80, 0.7)', 0.016, () => { g.moveTo(-0.012, -0.26); g.quadraticCurveTo(-0.012, -0.36, 0.05, -0.42); });
  softIn(g, [124, 128, 54], -0.52, -0.34, () => { g.moveTo(0.05, -0.38); g.bezierCurveTo(0.12, -0.53, 0.32, -0.53, 0.38, -0.43); g.bezierCurveTo(0.3, -0.33, 0.12, -0.33, 0.05, -0.38); g.closePath(); }, 1.25, 0.7);
  strokeIn(g, 'rgba(84, 84, 34, 0.7)', 0.012, () => { g.moveTo(0.07, -0.39); g.quadraticCurveTo(0.2, -0.45, 0.35, -0.43); });
  g.restore();
  // Gleams on the skin, and steam.
  strokeIn(g, 'rgba(255, 236, 226, 0.6)', 0.024, () => { g.moveTo(-0.55, ty + 0.26); g.quadraticCurveTo(-0.56, ty + 0.4, -0.5, ty + 0.5); });
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.3, ty - 0.2); g.bezierCurveTo(-0.38, ty - 0.32, -0.22, ty - 0.4, -0.3, ty - 0.52); });
}

// ------------------------------------------------------------------ the fish, cooked
//
// A fish cooked whole (PLAN.md stage 10), as the fish dishes all have one: lying on its side, head to the left, back up, s its
// size (snout to tail tip about 1.2 s), turned by rot about its middle. The skin browned and blistered, darker along the back,
// gold on the belly, scorched across in bars where it lay over the coals, the fins crisp and dark at their edges, the eye gone
// white. C is how it looks: skin, belly, H (half its depth), bars (scorch marks), spots (a trout's), dried (split and dried
// stiff: no eye, wrinkled, no gleam of juice).
const FISHC_ROACH = { skin: [200, 150, 82], belly: [242, 214, 154], H: 0.18, bars: 3, spots: false, dried: false };
const FISHC_TROUT = { skin: [186, 124, 62], belly: [244, 208, 148], H: 0.15, bars: 3, spots: true, dried: false };
const FISHC_DRIED = { skin: [156, 98, 44], belly: [208, 150, 78], H: 0.13, bars: 0, spots: false, dried: true };
const FISHC_EYE = [246, 240, 226];
// Blisters on its skin, [x, y as a share of H, size], and a trout's spots, [x, y as a share of H].
const FISHC_BLISTERS = [[-0.18, -0.3, 0.022], [0.0, 0.1, 0.018], [0.16, -0.36, 0.02], [-0.06, -0.62, 0.014], [0.28, 0.0, 0.016], [-0.24, 0.36, 0.014]];
const FISHC_SPOTS = [[-0.2, -0.55], [-0.08, -0.7], [0.06, -0.5], [0.2, -0.6], [0.32, -0.3], [-0.1, -0.2], [0.12, -0.15], [0.26, 0.1], [-0.02, 0.2]];
function cookedFishPath(g, H) {
  g.moveTo(-0.5, 0.01);
  g.bezierCurveTo(-0.47, -H * 0.85, -0.2, -H * 1.08, 0.04, -H * 0.92);
  g.quadraticCurveTo(0.3, -H * 0.62, 0.44, -H * 0.24);
  g.lineTo(0.44, H * 0.24);
  g.quadraticCurveTo(0.3, H * 0.62, 0.04, H * 0.9);
  g.bezierCurveTo(-0.2, H * 1.04, -0.46, H * 0.78, -0.5, 0.01);
  g.closePath();
}
function cookedFishAt(g, x, y, s, rot, C) {
  const H = C.H, FIN = tone(C.skin, 0.66);
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  // The tail, crisp and dark at its tips, and the fin along the back.
  const tail = () => { g.moveTo(0.4, -H * 0.22); g.quadraticCurveTo(0.52, -H * 0.5, 0.68, -H * 1.2); g.quadraticCurveTo(0.6, -H * 0.4, 0.61, 0); g.quadraticCurveTo(0.6, H * 0.4, 0.68, H * 1.2); g.quadraticCurveTo(0.52, H * 0.5, 0.4, H * 0.22); g.closePath(); };
  softIn(g, FIN, -H * 1.2, H * 1.2, tail, 1.25, 0.6);
  g.save(); g.beginPath(); tail(); g.clip();
  furGlow(g, [44, 24, 12], 0.75, 0.68, -H * 1.1, 0.08, H * 0.5);
  furGlow(g, [44, 24, 12], 0.75, 0.68, H * 1.1, 0.08, H * 0.5);
  strokeIn(g, rgba(tone(FIN, 0.55), 0.55), 0.012, () => { for (let k = -3; k <= 3; k++) { g.moveTo(0.44, k * H * 0.06); g.lineTo(0.66, k * H * 0.36); } });
  g.restore();
  const dorsal = () => { g.moveTo(-0.12, -H * 0.96); g.quadraticCurveTo(-0.05, -H * 1.38, 0.06, -H * 1.36); g.quadraticCurveTo(0.14, -H * 1.12, 0.18, -H * 0.8); g.closePath(); };
  softIn(g, FIN, -H * 1.38, -H * 0.8, dorsal, 1.2, 0.7);
  strokeIn(g, rgba(tone(FIN, 0.5), 0.6), 0.01, () => { for (let k = 0; k < 4; k++) { const bx = -0.09 + k * 0.07; g.moveTo(bx + 0.02, -H * 0.92); g.lineTo(bx - 0.01 + k * 0.01, -H * (1.34 - k * 0.1)); } });
  furGlow(g, [44, 24, 12], 0.45, 0.0, -H * 1.34, 0.08, H * 0.14);
  // The body: browned, the back darker, the belly gold, round on the shade side, scorched in bars, blistered.
  const body = () => cookedFishPath(g, H);
  softIn(g, C.skin, -H, H, body, 1.2, 0.62);
  g.save(); g.beginPath(); body(); g.clip();
  furGlow(g, C.belly, 0.8, -0.06, H * 0.66, 0.44, H * 0.44);
  furGlow(g, tone(C.skin, 0.5), 0.55, 0, -H * 1.0, 0.52, H * 0.4);
  furGlow(g, [60, 30, 14], 0.45, 0.24, H * 0.62, 0.32, H * 0.5);
  furGlow(g, [255, 236, 196], 0.3, -0.36, -H * 0.3, 0.14, H * 0.5);                          // lit about the head
  if (C.spots) fillIn(g, rgba([60, 30, 18], 0.75), () => { for (const [sx, sy] of FISHC_SPOTS) ovalAt(g, sx, sy * H, 0.018, 0.016); });
  for (let i = 0; i < C.bars; i++) {                                                         // scorched where it lay on the coals
    const bx = -0.16 + i * 0.19;
    furGlow(g, [40, 20, 10], 0.28, bx, 0, 0.06, H * 1.2, 0.3);
    strokeIn(g, rgba([46, 24, 12], 0.32), 0.026, () => { g.moveTo(bx + 0.05, -H * 1.1); g.lineTo(bx - 0.05, H * 1.1); });
  }
  if (C.dried) strokeIn(g, rgba(tone(C.skin, 0.55), 0.55), 0.014, () => {                   // dried: wrinkled along its length, the ribs showing
    for (let k = -2; k <= 2; k++) { g.moveTo(-0.26, k * H * 0.3); g.quadraticCurveTo(0.05, k * H * 0.3 + 0.02, 0.38, k * H * 0.2); }
    for (let k = 0; k < 6; k++) { const bx = -0.18 + k * 0.09; g.moveTo(bx, -H * 0.7); g.quadraticCurveTo(bx + 0.03, 0, bx, H * 0.7); }
  });
  else fillIn(g, rgba(tone(C.skin, 1.35, 30), 0.6), () => { for (const [bx, by, r] of FISHC_BLISTERS) ovalAt(g, bx, by * H, r, r * 0.7); });
  strokeIn(g, rgba(tone(C.skin, 0.5), 0.75), 0.022, () => { g.moveTo(-0.3, -H * 0.8); g.quadraticCurveTo(-0.21, 0, -0.3, H * 0.8); });   // the gill cover
  g.restore();
  strokeIn(g, rgba(tone(C.skin, 0.42), 0.65), 0.016, body);                                   // its browned edge
  softIn(g, FIN, -0.02, H * 0.5, () => { g.moveTo(-0.24, H * 0.1); g.quadraticCurveTo(-0.08, H * 0.2, -0.06, H * 0.55); g.quadraticCurveTo(-0.18, H * 0.5, -0.24, H * 0.1); g.closePath(); }, 1.2, 0.7);   // the side fin
  if (!C.dried) {                                                                            // glossy, juicy skin
    strokeIn(g, 'rgba(255, 246, 220, 0.75)', 0.024, () => { g.moveTo(-0.36, -H * 0.62); g.quadraticCurveTo(-0.1, -H * 0.98, 0.18, -H * 0.72); });
    fillIn(g, 'rgba(255, 252, 240, 0.9)', () => { ovalAt(g, -0.04, -H * 0.5, 0.02, 0.012); ovalAt(g, 0.22, -H * 0.36, 0.014, 0.01); ovalAt(g, 0.1, H * 0.3, 0.012, 0.009); });
  } else strokeIn(g, 'rgba(255, 236, 196, 0.45)', 0.02, () => { g.moveTo(-0.36, -H * 0.6); g.quadraticCurveTo(-0.1, -H * 0.92, 0.18, -H * 0.7); });
  if (C.dried) fillIn(g, rgba(tone(C.skin, 0.4)), () => ovalAt(g, -0.4, -H * 0.28, 0.035, 0.03));   // the eye, sunk
  else {                                                                                       // the eye, gone white in the cooking
    fillIn(g, rgba(FISHC_EYE), () => ovalAt(g, -0.4, -H * 0.28, 0.048, 0.048));
    fillIn(g, rgba([126, 114, 98]), () => ovalAt(g, -0.394, -H * 0.27, 0.022, 0.022));
    strokeIn(g, rgba(tone(C.skin, 0.45), 0.7), 0.012, () => ovalAt(g, -0.4, -H * 0.28, 0.048, 0.048));
  }
  strokeIn(g, rgba(tone(C.skin, 0.4), 0.7), 0.016, () => { g.moveTo(-0.5, 0.01 + H * 0.06); g.quadraticCurveTo(-0.45, H * 0.2, -0.39, H * 0.13); });   // the mouth
  g.restore();
}

// ------------------------------------------------------------------ roast fish on a stick
//
// A whole roach threaded on a green stick from its mouth, held up slantwise over the fire: the stick's bark where it's held,
// its charred tip out past the tail. The fish browned and blistered, scorched across where it lay over the coals, the belly
// gold, the eye gone white; a drop of juice running off its belly, and a curl of steam.
function paintRoastFish(g) {
  const ax = -0.86, ay = 0.74, bx = 0.86, by = -0.64, rot = Math.atan2(by - ay, bx - ax);
  sitShadow(g, 0.04, 0.72, 0.62, 0.11, 0.22);
  greenStick(g, ax, ay, bx, by);
  const cx = -0.02, cy = 0.04;
  cookedFishAt(g, cx, cy, 1.3, rot, FISHC_ROACH);
  const jx = cx + 0.1, jy = cy + 0.24;                                                         // juice off its belly
  fillIn(g, 'rgba(176, 116, 46, 0.9)', () => { g.moveTo(jx - 0.025, jy - 0.04); g.quadraticCurveTo(jx - 0.03, jy + 0.06, jx, jy + 0.1); g.arc(jx, jy + 0.1, 0.03, 0, Math.PI); g.closePath(); g.moveTo(jx - 0.025, jy - 0.04); g.lineTo(jx + 0.025, jy - 0.04); g.quadraticCurveTo(jx + 0.03, jy + 0.06, jx + 0.03, jy + 0.1); });
  fillIn(g, 'rgba(255, 236, 200, 0.9)', () => ovalAt(g, jx - 0.008, jy + 0.09, 0.009, 0.013));
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.2, -0.24); g.bezierCurveTo(-0.3, -0.42, -0.1, -0.52, -0.18, -0.72); g.moveTo(0.12, -0.36); g.bezierCurveTo(0.06, -0.5, 0.24, -0.58, 0.16, -0.76); });
}

// ------------------------------------------------------------------ trout with wild garlic
//
// A whole brown trout fried in the clay pan: browned and speckled, its tail curling up over the rim, lying in a golden jus
// on a bed of wild garlic leaves gone dark and glossy in the heat, two more laid over it, slivers of garlic stalk gone gold.
// A curl of steam.
// [x, y, len, w, rot, bend, shade]: the leaves under it, then over it.
const TROUTG_UNDER = [[-0.62, 0.02, 0.5, 0.14, -0.3, 0.3, 0.72], [0.18, -0.06, 0.52, 0.14, -0.2, -0.3, 0.74], [-0.2, 0.16, 0.5, 0.14, 0.15, 0.4, 0.8], [0.26, 0.2, 0.42, 0.13, -2.9, 0.3, 0.78]];
const TROUTG_OVER = [[-0.56, 0.1, 0.4, 0.12, 0.25, -0.4, 0.92], [0.34, 0.12, 0.4, 0.11, -0.2, 0.4, 0.96]];
function paintTroutGarlic(g) {
  const { cy, IX, IY } = CLAY_PAN;
  clayPan(g, () => {
    softIn(g, JUS, cy - IY, cy + IY, () => ovalAt(g, 0, cy + 0.02, IX * 0.97, IY * 0.9), 1.3, 0.6);
    furGlow(g, [255, 214, 120], 0.35, -0.2, cy - 0.02, 0.5, 0.14);
    furGlow(g, [60, 30, 12], 0.5, 0.3, cy + 0.15, 0.5, 0.1);
    for (const [x, y, len, w, rot, bend, k] of TROUTG_UNDER) leafAt(g, 'g', x, cy + y, len, w, rot, bend, k);
    cookedFishAt(g, -0.1, cy - 0.1, 1.3, -0.08, FISHC_TROUT);
    for (const [x, y, len, w, rot, bend, k] of TROUTG_OVER) leafAt(g, 'g', x, cy + y, len, w, rot, bend, k);
    for (const [x, y, a] of [[-0.46, cy + 0.14, 0.4], [0.42, cy + 0.12, -0.6], [0.0, cy + 0.2, 1.1], [0.56, cy - 0.02, 0.2]]) {
      fillIn(g, 'rgb(214, 168, 90)', () => ovalAt(g, x, y, 0.045, 0.022, a));                 // garlic stalk, sliced and gone gold
      fillIn(g, 'rgb(246, 232, 196)', () => ovalAt(g, x - 0.005, y - 0.004, 0.032, 0.013, a));
    }
    fillIn(g, 'rgba(255, 240, 190, 0.8)', () => { ovalAt(g, -0.6, cy + 0.12, 0.02, 0.01); ovalAt(g, 0.56, cy + 0.12, 0.018, 0.009); });   // gleams on the jus
  });
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.16, -0.22); g.bezierCurveTo(-0.26, -0.4, -0.06, -0.5, -0.14, -0.7); g.moveTo(0.2, -0.2); g.bezierCurveTo(0.14, -0.36, 0.32, -0.44, 0.24, -0.64); });
}

// ------------------------------------------------------------------ fish and sorrel on a hot stone
//
// A roach baked on a flat stone from the fire's edge, as the baked apple's, on a bed of sorrel leaves gone dark and soft, the
// sorrel melted into a bright green sauce pooled round it; two fresh spearhead leaves laid by its head. A curl of steam.
const SORRELS_SAUCE = [112, 150, 54];
// [x, y, len, w, rot, bend, shade], back to front.
const SORRELS_BED = [[-0.72, -0.04, 0.46, 0.14, -0.4, 0.3, 0.6], [0.06, -0.1, 0.5, 0.14, -0.1, -0.3, 0.6], [0.62, 0.04, 0.36, 0.12, 2.9, -0.3, 0.62]];
function paintFishSorrelStone(g) {
  const sy = 0.44;
  sitShadow(g, 0, sy + 0.24, 0.88, 0.14, 0.3);
  softIn(g, tone(STONE, 0.72), sy, sy + 0.32, () => lumpy(g, 0, sy + 0.09, 0.86, 0.25, STONE_LUMPS), 1.0, 0.6);
  softIn(g, STONE, sy - 0.24, sy + 0.24, () => lumpy(g, 0, sy, 0.86, 0.25, STONE_LUMPS), 1.2, 0.86);
  furGlow(g, [255, 250, 240], 0.22, -0.46, sy - 0.1, 0.3, 0.07);
  furGlow(g, [255, 130, 50], 0.28, 0.62, sy + 0.08, 0.3, 0.1);
  fillIn(g, 'rgba(52, 44, 40, 0.6)', () => { ovalAt(g, -0.66, sy + 0.1, 0.016, 0.01); ovalAt(g, 0.7, sy - 0.02, 0.012, 0.008); });
  // The sauce pooled on the stone, the wilted sorrel under the fish.
  softIn(g, SORRELS_SAUCE, sy - 0.14, sy + 0.12, () => { g.moveTo(-0.66, sy); g.bezierCurveTo(-0.66, sy - 0.12, -0.2, sy - 0.15, 0.1, sy - 0.13); g.bezierCurveTo(0.5, sy - 0.14, 0.7, sy - 0.06, 0.66, sy + 0.02); g.bezierCurveTo(0.62, sy + 0.1, 0.3, sy + 0.12, 0.0, sy + 0.12); g.bezierCurveTo(-0.36, sy + 0.12, -0.66, sy + 0.1, -0.66, sy); g.closePath(); }, 1.25, 0.7);
  strokeIn(g, 'rgba(236, 250, 190, 0.6)', 0.02, () => { g.moveTo(-0.5, sy + 0.06); g.quadraticCurveTo(-0.3, sy + 0.1, -0.06, sy + 0.095); });
  for (const [x, y, len, w, rot, bend, k] of SORRELS_BED) leafAt(g, 's', x, sy - 0.08 + y, len, w, rot, bend, k);
  cookedFishAt(g, -0.04, sy - 0.2, 1.28, -0.06, FISHC_ROACH);
  leafAt(g, 's', 0.16, sy + 0.04, 0.36, 0.1, 0.25, 0.3, 0.95);                               // fresh ones laid at its side
  leafAt(g, 's', 0.34, sy + 0.02, 0.32, 0.09, -0.35, -0.3, 1.0);
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.14, -0.34); g.bezierCurveTo(-0.24, -0.5, -0.04, -0.6, -0.12, -0.78); g.moveTo(0.22, -0.32); g.bezierCurveTo(0.16, -0.46, 0.34, -0.54, 0.26, -0.72); });
}

// ------------------------------------------------------------------ fish soup
//
// In the clay bowl from the pot (as the nettle soup's): a pale golden broth with beads of fat on it, big white flakes of fish
// with a strip of browned skin along each, nettle tops and torn green leaves, and a fish's tail standing up out of it at the
// back, so it reads as fish at a glance. A wisp of steam.
const FSOUP_BROTH = [210, 178, 112], FSOUP_FLAKE = [244, 236, 214], FSOUP_SKIN = [176, 126, 70];
// A flake of fish at (x, y), size s, turned by rot: white, lit on top, the grain across it, a browned edge of skin.
function fsoupFlakeAt(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const flake = () => { g.moveTo(-0.12, 0.02); g.bezierCurveTo(-0.13, -0.07, -0.04, -0.1, 0.04, -0.09); g.bezierCurveTo(0.12, -0.08, 0.14, -0.01, 0.12, 0.04); g.bezierCurveTo(0.06, 0.08, -0.06, 0.08, -0.12, 0.02); g.closePath(); };
  furGlow(g, [80, 60, 30], 0.35, 0.02, 0.06, 0.13, 0.04);
  softIn(g, FSOUP_FLAKE, -0.1, 0.07, flake, 1.08, 0.78);
  strokeIn(g, rgba(FSOUP_SKIN, 0.95), 0.03, () => { g.moveTo(-0.1, 0.04); g.quadraticCurveTo(0, 0.08, 0.11, 0.04); });
  strokeIn(g, rgba([206, 190, 160], 0.7), 0.008, () => { for (let k = -2; k <= 2; k++) { g.moveTo(k * 0.04 - 0.01, -0.07); g.quadraticCurveTo(k * 0.04 + 0.01, -0.01, k * 0.04 - 0.005, 0.05); } });
  g.restore();
}
function paintFishSoup(g) {
  const { cy, IX, IY } = CLAY_BOWL, sy = cy + 0.04;
  clayBowl(g, () => {
    fillIn(g, rgba(FSOUP_BROTH), () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.03));
    furGlow(g, [120, 90, 44], 0.5, 0.26, sy, 0.3, 0.1);
    furGlow(g, [250, 226, 160], 0.6, -0.16, sy - 0.03, 0.4, 0.1);
    furGlow(g, [70, 50, 24], 0.55, 0.1, sy + 0.12, IX * 0.8, 0.05);
    // The tail standing up out of it at the back, browned, its tips crisp.
    g.save(); g.translate(0.3, sy - 0.08); g.rotate(-1.25);
    const tail = () => { g.moveTo(0, -0.06); g.quadraticCurveTo(0.14, -0.1, 0.3, -0.24); g.quadraticCurveTo(0.24, -0.06, 0.26, 0); g.quadraticCurveTo(0.24, 0.06, 0.3, 0.24); g.quadraticCurveTo(0.14, 0.1, 0, 0.06); g.closePath(); };
    softIn(g, [176, 120, 62], -0.24, 0.24, tail, 1.3, 0.62);
    g.save(); g.beginPath(); tail(); g.clip();
    furGlow(g, [44, 24, 12], 0.7, 0.3, -0.22, 0.06, 0.08); furGlow(g, [44, 24, 12], 0.7, 0.3, 0.22, 0.06, 0.08);
    strokeIn(g, rgba([110, 70, 34], 0.55), 0.01, () => { for (let k = -3; k <= 3; k++) { g.moveTo(0.04, k * 0.012); g.lineTo(0.27, k * 0.07); } });
    g.restore();
    strokeIn(g, 'rgba(255, 240, 210, 0.6)', 0.014, () => { g.moveTo(0.04, -0.05); g.quadraticCurveTo(0.14, -0.09, 0.26, -0.2); });
    g.restore();
    fillIn(g, rgba([96, 120, 50], 0.85), () => { for (const [x, y, a] of [[-0.44, sy + 0.02, 0.4], [0.4, sy + 0.04, -0.6], [0.12, sy + 0.1, 1.1], [-0.2, sy - 0.08, -0.2], [0.52, sy - 0.02, 0.3]]) ovalAt(g, x, y, 0.03, 0.013, a); });   // torn green
    strokeIn(g, 'rgba(255, 220, 120, 0.75)', 0.008, () => { for (const [x, y, r] of [[-0.06, sy - 0.1, 0.02], [0.02, sy - 0.06, 0.013], [-0.52, sy + 0.06, 0.016], [-0.3, sy + 0.1, 0.012], [0.46, sy + 0.1, 0.014]]) ovalAt(g, x, y, r, r * 0.6); });   // beads of fat
    furGlow(g, [255, 255, 240], 0.4, -0.34, sy - 0.07, 0.14, 0.025, -0.05);
    fsoupFlakeAt(g, -0.32, sy - 0.02, 1.25, -0.3);
    fsoupFlakeAt(g, 0.06, sy + 0.04, 1.35, 0.2);
    fsoupFlakeAt(g, 0.44, sy + 0.04, 1.1, -0.4);
    fsoupFlakeAt(g, -0.12, sy + 0.12, 1.0, 0.5);
    nettleTopAt(g, -0.5, sy - 0.06, 0.75, -0.4);
    nettleTopAt(g, 0.22, sy - 0.04, 0.7, 2.6);
  });
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.16, -0.12); g.bezierCurveTo(-0.26, -0.32, -0.06, -0.42, -0.14, -0.64); g.moveTo(0.04, -0.14); g.bezierCurveTo(-0.02, -0.3, 0.16, -0.38, 0.08, -0.58); });
}

// ------------------------------------------------------------------ eel and mushroom stew
//
// In the clay bowl from the pot: a dark glossy gravy, thick rounds of eel standing in it, each its dark olive skin round the
// side and the white flesh on top with the backbone's dot in the middle, halved mushrooms between them, flecks of green and
// gleams on the gravy. A wisp of steam.
const EELSTEW_GRAVY = [92, 56, 28], EELSTEW_SKIN = [92, 66, 36], EELSTEW_FLESH = [236, 222, 192];
// A piece of eel at (x, y), lying on its side, len long and r thick, turned by rot: dark glossy skin over a yellow belly,
// the cut end toward the light white with the backbone's dot and a ring of skin.
function eelPieceAt(g, x, y, len, r, rot, flip = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(flip, 1);   // (flip -1: its cut face to the right)
  furGlow(g, [30, 16, 6], 0.5, len * 0.1, r * 0.9, len * 0.7, r * 0.5);
  const side = () => { g.moveTo(-len / 2, -r); g.lineTo(len / 2, -r); g.ellipse(len / 2, 0, r * 0.4, r, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(-len / 2, r); g.closePath(); };
  softIn(g, EELSTEW_SKIN, -r, r, side, 1.35, 0.55);
  g.save(); g.beginPath(); side(); g.clip();
  furGlow(g, [214, 182, 96], 0.7, 0, r * 0.9, len * 0.7, r * 0.4);                           // the yellow belly
  furGlow(g, [20, 18, 8], 0.5, len * 0.3, r * 0.3, len * 0.4, r * 0.8);
  g.restore();
  strokeIn(g, 'rgba(250, 244, 214, 0.7)', r * 0.18, () => { g.moveTo(-len * 0.36, -r * 0.55); g.quadraticCurveTo(0, -r * 0.75, len * 0.36, -r * 0.55); });   // glossy
  softIn(g, EELSTEW_FLESH, -r, r, () => ovalAt(g, -len / 2, 0, r * 0.56, r), 1.1, 0.85);
  strokeIn(g, rgba(EELSTEW_SKIN, 0.95), r * 0.14, () => ovalAt(g, -len / 2, 0, r * 0.54, r * 0.95));
  strokeIn(g, 'rgba(200, 176, 136, 0.7)', r * 0.06, () => { g.moveTo(-len / 2, -r * 0.62); g.lineTo(-len / 2, r * 0.62); });   // (its flakes parting along the spine)
  fillIn(g, rgba([120, 96, 70]), () => ovalAt(g, -len / 2, -r * 0.1, r * 0.1, r * 0.16));
  g.restore();
}
function paintEelStew(g) {
  const { cy, IX, IY } = CLAY_BOWL, sy = cy + 0.04;
  clayBowl(g, () => {
    fillIn(g, rgba(EELSTEW_GRAVY), () => ovalAt(g, 0, sy, IX - 0.03, IY - 0.03));
    furGlow(g, [44, 22, 8], 0.55, 0.28, sy, 0.32, 0.1);
    furGlow(g, [176, 112, 56], 0.55, -0.18, sy - 0.03, 0.42, 0.1);
    furGlow(g, [24, 12, 4], 0.55, 0.1, sy + 0.12, IX * 0.8, 0.05);
    halfShroomAt(g, -0.42, sy - 0.08, 0.5, -0.4, FSTEW_CUT);
    halfShroomAt(g, 0.44, sy - 0.08, 0.48, 0.35, FSTEW_CUT);
    eelPieceAt(g, -0.18, sy - 0.17, 0.19, 0.11, -0.25);              // (short thick rounds, as an eel's cut for the pot)
    eelPieceAt(g, 0.16, sy - 0.18, 0.18, 0.105, 0.2, -1);
    eelPieceAt(g, -0.36, sy + 0.03, 0.2, 0.11, 0.1);
    eelPieceAt(g, 0.02, sy - 0.02, 0.2, 0.115, -0.05, -1);
    eelPieceAt(g, 0.34, sy + 0.04, 0.19, 0.105, -0.15);
    eelPieceAt(g, -0.1, sy + 0.12, 0.18, 0.1, 0.12);
    fillIn(g, rgba([74, 124, 44], 0.9), () => { for (const [x, y, a] of [[-0.26, sy - 0.24, 0.4], [0.3, sy - 0.24, -0.6], [0.54, sy + 0.04, 0.3], [-0.54, sy + 0.04, 1.4], [0.0, sy - 0.26, 0.2], [0.18, sy + 0.12, 2]]) ovalAt(g, x, y, 0.03, 0.013, a); });
    strokeIn(g, 'rgba(255, 224, 150, 0.6)', 0.01, () => { ovalAt(g, -0.6, sy + 0.08, 0.03, 0.014); ovalAt(g, 0.58, sy + 0.08, 0.03, 0.014); ovalAt(g, -0.14, sy + 0.16, 0.03, 0.012); });
  });
  strokeIn(g, 'rgba(255, 255, 250, 0.3)', 0.035, () => { g.moveTo(-0.14, -0.26); g.bezierCurveTo(-0.24, -0.44, -0.04, -0.54, -0.12, -0.74); g.moveTo(0.18, -0.24); g.bezierCurveTo(0.12, -0.38, 0.3, -0.46, 0.22, -0.66); });
}

// ------------------------------------------------------------------ dried fish and hazelnuts
//
// Cold trail food in the carved wooden bowl: a heap of hazelnuts, some still in their glossy shells, some cracked to the
// kernel, and two dried fish standing up out of it, flat, stiff and leathery amber, wrinkled along their length with the
// ribs showing through. No steam: it's eaten cold.
// [x, y, r, rot, shelled (0) or a kernel (k+1)], back to front.
const DFISH_NUTS = [[-0.5, -0.04, 0.11, 0.4, 0], [-0.24, -0.1, 0.1, -0.6, 2], [0.26, -0.1, 0.11, 0.8, 0], [0.52, -0.02, 0.1, -0.3, 1],
  [-0.62, 0.08, 0.1, 1.2, 1], [-0.36, 0.06, 0.11, -0.2, 0], [-0.08, 0.04, 0.1, 0.6, 3], [0.16, 0.06, 0.11, -0.9, 0], [0.42, 0.1, 0.1, 0.3, 2],
  [-0.2, 0.16, 0.1, 2.2, 0], [0.04, 0.17, 0.1, -0.4, 1], [0.3, 0.18, 0.1, 1.6, 0]];
function paintDriedFishHazel(g) {
  const { cy } = BOWL;
  woodBowl(g, () => {
    furGlow(g, [40, 22, 10], 0.6, 0, cy + 0.1, 0.7, 0.18);
    cookedFishAt(g, 0.06, cy - 0.26, 1.05, -0.5, FISHC_DRIED);
    cookedFishAt(g, -0.1, cy - 0.08, 1.0, -0.12, FISHC_DRIED);
    for (const [x, y, r, rot, k] of DFISH_NUTS) k ? hazelKernelAt(g, x, cy + y, r * 0.75, rot, k - 1) : hazelShellAt(g, x, cy + y, r, rot);
  });
}

const PAINTED = [
  ['Roast mushrooms', paintRoastMushrooms],
  ['Baked apple with honey', paintBakedApple],
  ['Spring salad', paintSpringSalad],
  ['Rosehip tea', paintRosehipTea],
  ['Garlic mushrooms', paintGarlicMushrooms],
  ['Honeyed cherries', paintHoneyedCherries],
  ['Warm bramble compote', paintBrambleCompote],
  ['Wilted greens', paintWiltedGreens],
  ['Toasted beechnuts', paintToastedBeechnutsPan],
  ['Toasted hazelnuts', paintToastedHazelnuts],
  ['Mushrooms with hazelnuts', paintMushroomsHazelnuts],
  ['Dandelion fritters', paintDandelionFritters],
  ["A forager's mess", paintForagersMess],
  ['Roast wild garlic', paintRoastGarlic],
  ['Strawberries and honey', paintStrawberriesHoney],
  ['Elderflower cordial', paintElderflowerCordial],
  ['Watercress soup', paintWatercressSoup],
  ['Sorrel and mushrooms', paintSorrelMushrooms],
  ['Roast dandelion roots', paintRoastRoots],
  ['Mushroom and garlic skewer', paintShroomGarlicSkewer],
  ['Elderflower fritters', paintElderflowerFritters],
  ['Rosehip syrup', paintRosehipSyrup],
  ['Nettle soup', paintNettleSoup],
  ['Hazelnut brittle', paintHazelnutBrittle],
  ['Chicken of the woods steak', paintChickenSteak],
  ['Forest stew', paintForestStew],
  ['Baked apple with honey', paintBakedApple3],
  ['Roast fish on a stick', paintRoastFish],
  ['Trout with wild garlic', paintTroutGarlic],
  ['Fish and sorrel on a hot stone', paintFishSorrelStone],
  ['Fish soup', paintFishSoup],
  ['Eel and mushroom stew', paintEelStew],
  ['Dried fish and hazelnuts', paintDriedFishHazel],
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

root.Dishes = { NAMES, paint };
})(typeof window !== 'undefined' ? window : globalThis);
