// The new drying rack: two crossed-pole A-frames, one at each end, a long bar laid in their crotches, and six hooks on cords
// along it that the rack's six slots hang from (RACK_HOOKS, where each hangs, in its box from the ground under its middle).
// The frame is painted once; game.js draws each slot's item under its hook as it's put there (drawRack).
const RACK_HB = 1.02;                     // the bar's height
const RACK_HOOKS = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].map((x, i) => [x, -RACK_HB + (i % 2 ? 0.2 : 0.1)]);   // (staggered, so they lap less)
const RACK_ITEM = 0.32;                   // an item hung there, across (of its half-size)
function paintRackHang(g, size, U) {
  g.setTransform(U / 2, 0, 0, U / 2, size / 2, size / 2);
  g.lineCap = g.lineJoin = 'round';
  g.translate(0, RACK_FOOT);
  const P = campAt3, wood = RACK_WOOD, HB = RACK_HB, XE = 0.8, DL = 0.3;   // its ends, and how far its legs splay front and back
  // Its shadow: soft under it all, and the bar's a faint line on the ground behind, out of the light.
  furGlow(g, [40, 30, 16], 0.3, 0.06, -0.01, 1.05, 0.2, 0, 0.3);
  furGlow(g, [40, 30, 16], 0.22, ...P(0.08, 0.2, 0), 0.9, 0.035, Math.atan2(-CAMP_KY, 1) * 0.1);
  // An A-frame at x: a leg from the front and one from the back, crossing at the bar and running on a little past it.
  const leg = (x, d, s, dx) => { const [fx, fy] = P(x + dx, d, 0), [tx, ty] = P(x - dx * 0.25, -d * 0.28, HB + 0.2); campPole(g, fx, fy, tx, ty, 0.05, wood, s, false); };
  const ends = [[-XE, 0, 0.04], [XE, 1, -0.04]];
  for (const [x, i] of ends) { const [fx, fy] = P(x, DL, 0); campFoot(g, fx + (i ? -0.01 : 0.01), fy, 0.045, 40 + i); }
  for (const [x, i, dx] of ends) leg(x, DL, 10 + i, dx);   // the back legs
  // The left frame's brace: a stick lashed low across its legs, as one is to stop it spreading.
  { const [x0, y0] = P(-XE + 0.06, -DL * 0.62, 0.32), [x1, y1] = P(-XE + 0.02, DL * 0.62, 0.32); campPole(g, x0, y0, x1, y1, 0.032, tone(wood, 1.06), 24, true); }
  // The bar, resting in the crossings, its ends cut and past them a little.
  { const [x0, y0] = P(-XE - 0.16, 0, HB), [x1, y1] = P(XE + 0.16, 0, HB); campPole(g, x0, y0, x1, y1, 0.048, tone(wood, 0.96), 20, true); }
  // The hooks: a loop of cord over the bar, down to a little forked peg, staggered.
  for (let i = 0; i < RACK_HOOKS.length; i++) {
    const [hx, hy] = RACK_HOOKS[i], [bx, by] = P(hx, 0, HB);
    const cord = () => { g.moveTo(bx - 0.012, by - 0.02); g.lineTo(hx, hy - 0.04); };
    strokeIn(g, rockRGB(RACK_INK, 0.8), 0.018, cord);
    strokeIn(g, rockRGB([190, 152, 98]), 0.009, cord);
    strokeIn(g, rockRGB(RACK_INK, 0.85), 0.03, () => { g.moveTo(bx - 0.03, by - 0.03); g.lineTo(bx + 0.03, by + 0.004); });   // (its turn round the bar)
    strokeIn(g, rockRGB([190, 152, 98]), 0.014, () => { g.moveTo(bx - 0.026, by - 0.026); g.lineTo(bx + 0.026, by + 0.002); });
    const peg = () => { g.moveTo(hx, hy - 0.05); g.lineTo(hx, hy); g.quadraticCurveTo(hx + 0.002, hy + 0.03, hx + 0.03, hy + 0.012); };
    strokeIn(g, rockRGB(RACK_INK, 0.85), 0.03, peg);
    strokeIn(g, rockRGB(tone(wood, 1.15, 10)), 0.014, peg);
  }
  // The front legs, over the bar, and a lashing where each frame crosses it.
  for (const [x, i] of ends) { const [fx, fy] = P(x, -DL, 0); campFoot(g, fx, fy, 0.05, 42 + i); }
  for (const [x, i, dx] of ends) leg(x, -DL, 12 + i, -dx);
  { const [x, y] = P(-XE + 0.04, -DL * 0.62, 0.32); campLash(g, x, y, 0.03); }
  for (const [x] of ends) { const [lx, ly] = P(x, 0, HB); campLash(g, lx, ly, 0.045, 1.2); }
  // A tuft at the feet, and a chip of bark.
  strokeIn(g, rockRGB([96, 146, 60]), 0.014, () => { for (const [x, d, a, h] of [[-XE - 0.12, -DL, -0.4, 0.1], [-XE - 0.08, -DL - 0.02, 0.1, 0.13], [XE + 0.06, -DL, 0.3, 0.11], [XE + 0.1, -DL + 0.02, 0.7, 0.08]]) { const [cx, cy] = P(x, d, 0); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * h, cy - Math.cos(a) * h); } });
  { const [cx, cy] = P(0.2, -0.36, 0); fillIn(g, rockRGB(tone(RACK_BARK, 0.9)), () => ovalAt(g, cx, cy, 0.04, 0.016, -0.4)); fillIn(g, rockRGB([196, 130, 80], 0.9), () => ovalAt(g, cx + 0.004, cy + 0.008, 0.032, 0.007, -0.4)); }
}
