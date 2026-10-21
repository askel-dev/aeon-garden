// Run in the game's page (after concepts.js): a sheet over the meadow, the camp's basket and fire pit as they are against the
// concepts, the rack, lean-to and seat log beside them for scale, close up and zoomed out.
(() => {
  const old = window.garden.camp, neu = window.CampLooks, k = 2;
  const W = 1500, H = 980;
  document.getElementById('camp-sheet')?.remove();
  const c = document.createElement('canvas');
  c.id = 'camp-sheet'; c.width = W * k; c.height = H * k;
  c.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:99999`;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#86775b'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#7f9a4c'; g.fillRect(0, 700, W, H - 700);
  const paint = (fn, n, px, x, y, foot) => {
    const size = Math.ceil(px * 1.3 * k), cv = document.createElement('canvas');
    cv.width = cv.height = size;
    fn(cv.getContext('2d'), size, px * k, n);
    g.drawImage(cv, x - size / k / 2, y - foot * px / 2 - size / k / 2, size / k, size / k);
  };
  const flames = (x, y, px) => window.garden.torch.flame(x, y, px, 1, performance.now(), 1, g, k, 0, 0);
  const label = (t, x, y, s = 15, col = '#f6ecd6') => { g.font = `600 ${s}px Nunito, sans-serif`; g.fillStyle = col; g.textAlign = 'center'; g.fillText(t, x, y); };
  const row = (name, P, y, z) => {
    const u = 8 + z, fpx = u * 1.55, bpx = fpx * 0.95;
    g.textAlign = 'left'; g.font = '700 18px Fraunces, serif'; g.fillStyle = '#fff6e2'; g.fillText(name, 24, y - u * 0.9);
    const xs = [200, 400, 600, 830, 1060];
    paint(P.fire, 7, fpx, xs[0], y, 0.25);
    paint(P.fire, 14, fpx, xs[1], y, 0.25); flames(xs[1], y, fpx);
    paint(P.fire, 24, fpx, xs[2], y, 0.25);
    paint(P.basket, 0, bpx, xs[3], y, 0.6);
    paint(P.basket, 1, bpx, xs[4], y, 0.6);
    paint(old.rack, 1, u * 1.6, 1300, y, 0.6);
    if (z > 40) ['laid', 'burning', 'cold', 'basket shut', 'basket open', 'rack (as is)'].forEach((t, i) => label(t, [...xs, 1300][i], y + u * 0.55));
  };
  const big = window.SHEET_BIG;
  if (big) {                             // close up, one look at a time: now on the left, the concept on the right
    g.fillStyle = '#86775b'; g.fillRect(0, 0, W, H);
    const neuP = { fire: neu.paintFire, basket: neu.paintBasket };
    [[old, 380, 'Now'], [neuP, 1120, 'Concept']].forEach(([P, x, name]) => {
      label(name, x, 60, 30, '#fff6e2');
      if (big.kind === 'fire') { const px = 1100; paint(P.fire, big.n, px, x, 640, 0.25); if (big.flames) flames(x, 640, px); }
      else paint(P.basket, big.n, 900, x, 760, 0.6);
    });
    return 'big';
  }
  row('Now', old, 220, 72);
  row('Concept', { fire: neu.paintFire, basket: neu.paintBasket }, 520, 72);
  // Zoomed out, in the grass: the camp as it would stand, now and concept.
  const camp = (P, cx, z, t) => {
    const u = 8 + z, fpx = u * 1.55;
    label(t, cx, 730, 16);
    paint(old.lean, 0, u * 1.9, cx - 120, 830, 0.68);
    paint(old.rack, 1, u * 1.6, cx + 110, 820, 0.6);
    paint(P.basket, 0, fpx * 0.95, cx + 150, 900, 0.6);
    paint(P.fire, 14, fpx, cx, 880, 0.25); flames(cx, 880, fpx);
    paint(old.seat, 3, u * 2, cx - 60, 945, 0.5);
  };
  camp(old, 380, 30, 'Now, zoomed out');
  camp({ fire: neu.paintFire, basket: neu.paintBasket }, 1100, 30, 'Concept, zoomed out');
  return 'ok';
})();
