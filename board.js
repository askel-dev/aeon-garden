'use strict';
// The chopping board (PLAN.md stage 12, cooking by hand): things cut by a swipe, as in Fruit Ninja, and swept off the edge
// into the pot. Played and tuned in cooking-lab.html, and the same code is the board at the fire in the game (game.js, the
// board), so the feel is tuned in one place. No page here: it's given a 2D context to draw into and where the board lies on
// it, in CSS px, and hears the pointer from whoever owns the canvas.
//
// A thing is painted once big (its painting, by the caller's paint), and its outline found once (a convex hull of its painted
// pixels). A piece is a convex polygon of that painting, painted once into a small canvas of its own as it's cut, its cut
// edges in the thing's inside colour, with a soft shadow made with it. A swipe walks the drag in small steps: a piece is cut
// along the line from where the swipe came into it to where it came out, and the halves fly apart spinning, juice splashing
// and spotting the board. A drag that starts on a piece cuts if its first move is quick (SWIPE), else sweeps it with the
// flat of the hand; only a sweep takes a piece off the open (right) edge, where the owner takes it (off). A slow drag from
// the back (left) edge scrapes the whole board, as with a knife's flat: everything in front of it is pushed along and, if it
// gets most of the way, off into the pot at once (SCRAPE). Nothing here reads
// pixels back after a thing's first painting, and nothing is blurred: a shadow is the piece painted small and stretched.
const Board = (() => {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const S = 360, U = 300;              // a thing is painted once into S px square, its box U px across
  const SMALLEST = 260;                // px² of painting: a piece this small can't be cut again
  const BLADE = 30;                    // CSS px: half the width a sweep pushes
  const TRAIL = 0.2;                   // s: how long the swipe's trail glows
  const SWIPE = 900;                   // px/s: a drag starting on a piece quicker than this cuts it, slower sweeps it
  const SCRAPE = 0.14;                 // of the board's width: a slow drag starting this near its back edge (or past it) scrapes
  const SHADE = 4;                     // a shadow is painted this many times smaller than its piece, and stretched (its blur)
  const STAINS = 160;                  // juice spots on the board at most (the oldest go)

  // Each thing's inside, shown along a cut, its juice and its crumbs, by id, else by its first tag that has one.
  const FLESH = { watercress: [196, 226, 150], nettle: [178, 214, 132], sorrel: [206, 230, 160], garlic: [250, 246, 232], cep: [246, 238, 220],
    chanterelle: [252, 226, 160], apple: [250, 240, 206], strawberry: [246, 150, 140], trout: [246, 170, 140], perch: [244, 226, 210],
    greens: [196, 226, 150], mushroom: [244, 234, 214], fruit: [250, 236, 200], berry: [236, 120, 130], fish: [246, 190, 170], nut: [236, 212, 170],
    flower: [250, 240, 200], root: [244, 230, 196] };
  const JUICE = { apple: [236, 222, 168], strawberry: [196, 30, 52], watercress: [96, 156, 64], nettle: [80, 140, 56], sorrel: [120, 170, 60],
    garlic: [242, 236, 212], cep: [214, 196, 156], chanterelle: [240, 170, 50], trout: [206, 110, 100], perch: [210, 140, 120],
    greens: [96, 156, 64], mushroom: [214, 196, 156], fruit: [226, 200, 140], berry: [170, 30, 60], fish: [206, 120, 110], nut: [200, 170, 120],
    flower: [240, 220, 150], root: [226, 210, 170] };
  const TINT = { watercress: [70, 130, 56], nettle: [64, 120, 48], sorrel: [126, 176, 60], strawberry: [200, 40, 50], apple: [190, 60, 40], trout: [120, 110, 90],
    perch: [110, 120, 70], greens: [70, 130, 56], berry: [150, 30, 60], fish: [120, 110, 90], fruit: [190, 90, 50] };
  let tagsOf = () => [];               // (the caller's: what tags a thing has, for the tables above)
  const byThing = (T, id, or) => T[id] || tagsOf(id).map(t => T[t]).find(Boolean) || or;
  const fleshOf = id => byThing(FLESH, id, [240, 230, 210]);
  const juiceOf = id => byThing(JUICE, id, fleshOf(id));
  const tintOf = id => byThing(TINT, id, [150, 110, 70]);

  // ---------------------------------------------------------------- the things
  const kinds = new Map();             // id -> { src, hull }
  let paintThing = null;               // (the caller's: paint(g, size, U, id))
  function kindOf(id) {
    let k = kinds.get(id);
    if (k) return k;
    const src = document.createElement('canvas'); src.width = src.height = S;
    const g = src.getContext('2d', { willReadFrequently: true });
    paintThing(g, S, U, id);
    // Its outline as a convex hull of the painted pixels (each row's first and last), relative to the middle. (The one read
    // of pixels, once a thing.)
    const px = g.getImageData(0, 0, S, S).data, pts = [];
    for (let y = 0; y < S; y += 2) {
      let a = -1, b = -1;
      for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 30) { if (a < 0) a = x; b = x; }
      if (a >= 0) { pts.push([a - S / 2, y - S / 2]); if (b !== a) pts.push([b + 1 - S / 2, y - S / 2]); }
    }
    if (pts.length < 3) pts.push([-U / 3, -U / 3], [U / 3, -U / 3], [U / 3, U / 3], [-U / 3, U / 3]);
    kinds.set(id, k = { src, hull: hullOf(pts) });
    return k;
  }
  function hullOf(pts) {
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }
  const areaOf = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; s += ax * by - bx * ay; } return Math.abs(s) / 2; };
  // Where a polygon's weight sits.
  function centroidOf(poly) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], c = ax * by - bx * ay;
      a += c; x += (ax + bx) * c; y += (ay + by) * c;
    }
    if (Math.abs(a) < 1e-6) { let sx = 0, sy = 0; for (const [px, py] of poly) { sx += px; sy += py; } return [sx / poly.length, sy / poly.length]; }
    return [x / (3 * a), y / (3 * a)];
  }
  function inside(poly, x, y) {
    let sgn = 0;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (c !== 0) { if (sgn === 0) sgn = Math.sign(c); else if (Math.sign(c) !== sgn) return false; }
    }
    return true;
  }
  // Split a convex polygon by the line through a and b: the two sides, each edge marked whether it lies along a cut.
  function split(poly, cut, ax, ay, bx, by) {
    const side = (x, y) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const halves = [];
    for (const sg of [1, -1]) {
      const P = [], C = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p[0], p[1]) * sg, sq = side(q[0], q[1]) * sg;
        const pin = sp >= 0, qin = sq >= 0;
        if (pin) { P.push(p); C.push(cut[i]); }
        if (pin !== qin) {
          const t = sp / (sp - sq), I = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
          P.push(I); C.push(pin ? true : cut[i]);
        }
      }
      halves.push([P, C]);
    }
    return halves;
  }

  // ---------------------------------------------------------------- pieces
  // A piece of thing id: poly in the painting's own pixels (from its middle), cut marking which edges are cuts, lying at
  // x, y (where its weight sits) turned a, drawn k CSS px a painting px. whole: the caller's, carried on to its halves.
  let nextId = 1;
  function pieceOf(id, poly, cut, x, y, a, k, whole) {
    const K = kindOf(id);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [px, py] of poly) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const path = () => { g.beginPath(); poly.forEach(([px, py], i) => i ? g.lineTo(px - x0, py - y0) : g.moveTo(px - x0, py - y0)); g.closePath(); };
    g.save(); path(); g.clip(); g.drawImage(K.src, -S / 2 - x0, -S / 2 - y0); g.restore();
    if (cut.some(Boolean)) {
      // The cut faces: the inside colour along each cut edge, only over the painted pixels, darker at the very edge.
      g.globalCompositeOperation = 'source-atop';
      const f = fleshOf(id), edges = (wd, col) => {
        g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath();
        poly.forEach(([px, py], i) => { if (!cut[i]) return; const [qx, qy] = poly[(i + 1) % poly.length]; g.moveTo(px - x0, py - y0); g.lineTo(qx - x0, qy - y0); });
        g.stroke();
      };
      edges(10, `rgba(${f[0]}, ${f[1]}, ${f[2]}, 0.95)`);
      edges(3, `rgba(${f[0] * 0.55 | 0}, ${f[1] * 0.5 | 0}, ${f[2] * 0.45 | 0}, 0.35)`);
      g.globalCompositeOperation = 'source-over';
    }
    const area = areaOf(poly), [cx, cy] = centroidOf(poly);
    // Its shadow: the piece painted SHADE times smaller and darkened, stretched back up as it's drawn (soft for nothing).
    const pad = 3, sh = document.createElement('canvas');
    sh.width = Math.ceil(w / SHADE) + pad * 2; sh.height = Math.ceil(h / SHADE) + pad * 2;
    const s = sh.getContext('2d');
    s.drawImage(c, pad, pad, w / SHADE, h / SHADE);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(40, 24, 8, 0.42)'; s.fillRect(0, 0, sh.width, sh.height);
    return { uid: nextId++, id, poly, cut, c, sh, x0, y0, cx, cy, area, r: Math.sqrt(area / Math.PI), k, whole: whole === undefined ? null : whole,
             x, y, a, vx: 0, vy: 0, va: 0, enter: null, stroke: -1, pt: 0, swept: -9, scraped: -1,
             place: '', pr: 0, pa: 0, to: 0, bob: 0, drop: 0 };   // (place .. drop: the lab's, for the fire and the pot)
  }
  // The world point (wx, wy) in the piece's own pixels, and back.
  function toLocal(p, wx, wy, out) {
    const dx = (wx - p.x) / p.k, dy = (wy - p.y) / p.k, c = Math.cos(p.a), s = Math.sin(p.a);
    out[0] = dx * c + dy * s + p.cx; out[1] = -dx * s + dy * c + p.cy;
    return out;
  }
  function toWorld(p, lx, ly) {
    const dx = (lx - p.cx) * p.k, dy = (ly - p.cy) * p.k, c = Math.cos(p.a), s = Math.sin(p.a);
    return [p.x + dx * c - dy * s, p.y + dx * s + dy * c];
  }
  // A piece drawn at its place (ox across), lifted (its shadow left behind on the board), scaled by bob.
  function drawPiece(ctx, p, ox = 0, lift = 0, bob = 1) {
    const k = p.k * bob;
    ctx.save(); ctx.translate(p.x + ox, p.y - lift); ctx.rotate(p.a); ctx.scale(k, k);
    const pad = 3 * SHADE;
    ctx.drawImage(p.sh, p.x0 - p.cx - pad + 3 + lift * 0.5 / k, p.y0 - p.cy - pad + 5 + lift / k, p.sh.width * SHADE, p.sh.height * SHADE);
    ctx.drawImage(p.c, p.x0 - p.cx, p.y0 - p.cy);
    ctx.restore();
  }
  // A sweep from a to b through the pieces in list: whatever it passes over moves with it (dt the frame's, for its speed).
  function sweep(list, ax, ay, bx, by, dt, now) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    for (const p of list) {
      const t = clamp(((p.x - ax) * dx + (p.y - ay) * dy) / (len * len), 0, 1), qx = ax + dx * t, qy = ay + dy * t;
      if (Math.hypot(p.x - qx, p.y - qy) > BLADE + p.r * p.k * 0.55) continue;
      // carried along to just ahead of the hand
      const ahead = ((p.x - bx) * dx + (p.y - by) * dy) / len, need = p.r * p.k * 0.4;
      if (ahead < need) { p.x += dx / len * (need - ahead); p.y += dy / len * (need - ahead); }
      p.vx = dx / Math.max(0.016, dt); p.vy = dy / Math.max(0.016, dt);
      p.va += ((p.x - bx) * dy - (p.y - by) * dx) / len * 0.0006 * len;
      p.swept = now;
      if (p.pt <= 0) p.pt = 0.4;
    }
  }
  // A picture of a whole thing's pieces lying together, size px square (a few pieces in the pot, painted once): each where
  // it lay against the others, drawn to fit.
  function picture(list, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    if (!list.length) return c;
    const g = c.getContext('2d');
    let mx = 0, my = 0, A = 0;
    for (const p of list) { mx += p.x * p.area; my += p.y * p.area; A += p.area; }
    mx /= A; my /= A;
    // gathered in toward the middle (they were flung apart), each turned as it lay
    let R = 1;
    const at = list.map(p => { const x = (p.x - mx) * 0.45, y = (p.y - my) * 0.45; R = Math.max(R, Math.hypot(x, y) + p.r * p.k); return [x, y]; });
    const fit = size * 0.48 / R;
    list.forEach((p, i) => {
      g.save(); g.translate(size / 2 + at[i][0] * fit, size / 2 + at[i][1] * fit); g.rotate(p.a); g.scale(p.k * fit, p.k * fit);
      g.drawImage(p.c, p.x0 - p.cx, p.y0 - p.cy);
      g.restore();
    });
    return c;
  }
  // The grass at camp the board lies on, from above: soft patches, blades of grass, darker toward the edges. Painted once into
  // g (scaled to CSS px), w by h. (The lab's scenes and the game's board at the fire stand on it.)
  function paintGround(g, w, h, base = '#56733a', seed = 7) {
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90, l = rnd() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, l ? 'rgba(170, 190, 100, 0.10)' : 'rgba(30, 50, 20, 0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {                                                        // blades of grass
      const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(120, 160, 70, 0.35)' : 'rgba(40, 70, 25, 0.3)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20, 30, 10, 0.35)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }
  // The board itself, from above: a thick board of split wood, the grain running across, knots and old knife marks, its open
  // (right) edge worn. Painted once into g (scaled to CSS px) at x, y, w by h.
  function paintBoard(g, x, y, w, h, seed = 7) {
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const r = Math.min(w, h) * 0.08, rr = (x, y, w, h) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    g.save();
    g.fillStyle = 'rgba(25, 30, 10, 0.16)';                                                 // its shadow, soft: a few spread fills
    for (let i = 4; i > 0; i--) { rr(x + 6 - i * 2, y + 14 - i, w + i * 4, h + i * 3); g.fill(); }
    g.fillStyle = '#8a5a30'; rr(x, y + 7, w, h); g.fill();                                   // its thickness
    const wood = g.createLinearGradient(x, y, x + w * 0.3, y + h);
    wood.addColorStop(0, '#d9ab72'); wood.addColorStop(1, '#c08e56');
    g.fillStyle = wood; rr(x, y, w, h); g.fill();
    rr(x, y, w, h); g.clip();
    for (let i = 0; i < 46; i++) {                                                         // the grain
      const yy = y + rnd() * h, a = 1.5 + rnd() * 4, ph = rnd() * TAU;
      g.strokeStyle = `rgba(${120 + rnd() * 30 | 0}, ${70 + rnd() * 20 | 0}, 30, ${0.08 + rnd() * 0.14})`; g.lineWidth = 0.8 + rnd() * 1.8;
      g.beginPath();
      for (let xx = x - 10; xx <= x + w + 10; xx += 12) g.lineTo(xx, yy + Math.sin(xx / (60 + i * 3) + ph) * a);
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {                                                          // a knot or two
      const kx = x + w * (0.2 + rnd() * 0.6), ky = y + h * (0.15 + rnd() * 0.7);
      for (let j = 4; j > 0; j--) { g.strokeStyle = `rgba(110, 60, 25, ${0.12 + j * 0.03})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, 4 + j * 5, 2 + j * 2.4, 0, 0, TAU); g.stroke(); }
    }
    for (let i = 0; i < 26; i++) {                                                         // old knife marks
      const mx = x + w * (0.12 + rnd() * 0.76), my = y + h * (0.12 + rnd() * 0.76), ml = 10 + rnd() * 30, ma = rnd() * TAU;
      g.strokeStyle = 'rgba(110, 70, 35, 0.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(ma) * ml, my + Math.sin(ma) * ml); g.stroke();
    }
    const lit = g.createLinearGradient(x, y, x + w, y + h);
    lit.addColorStop(0, 'rgba(255, 240, 200, 0.22)'); lit.addColorStop(0.5, 'rgba(255, 240, 200, 0)'); lit.addColorStop(1, 'rgba(80, 40, 10, 0.16)');
    g.fillStyle = lit; g.fillRect(x, y, w, h);
    g.restore();
    g.strokeStyle = 'rgba(255, 235, 190, 0.5)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x + 1, y + 1, w - 2, h - 2, r); g.stroke();
    g.fillStyle = 'rgba(255, 230, 180, 0.25)'; g.fillRect(x + w - 5, y + r, 3, h - r * 2);   // the open edge: a worn lip
  }

  const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // A path through pts, closed, its corners rounded by going through the middles of its sides.
  function smooth(g, pts) {
    g.beginPath();
    const n = pts.length, mid = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    const m0 = mid(n - 1); g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    g.closePath();
  }

  // From above: a log split down its length lies flat face up. The face is x..x+w, y..y+h (where things are cut); its bark
  // rounds away under it along both long sides, a band past the face; the ends are chopped at a slant. The face is split wood,
  // not sawn: torn along the fibre in long ridges, a check or two running in from the ends, greyer at the ends, worn darker
  // and stained in the middle where things are cut. Two stones under it peek out below, the knife lies in the grass by it
  // (the right end is the open edge, toward the pot), chips in the grass.
  function paintLog(g, x, y, w, h, seed = 7) {
    const rnd = seeded(seed), bark = Math.min(h * 0.13, 16 + h * 0.07), N = 14;
    const u = Math.sqrt(Math.max(1, h / 200)), m = Math.max(1, w / 420);   // (painted bigger than the lab's: lines a little thicker, more of them)
    // the face's outline: long sides a little wavy, the log thicker at its left (butt) end, the ends chopped at a slant
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, xx = x + w * u, taper = (u - 0.5) * h * 0.06;
      top.push([xx, y + taper + (rnd() - 0.5) * h * 0.025]);
      bot.push([xx, y + h - taper + (rnd() - 0.5) * h * 0.025]);
    }
    const lean = h * 0.07;                                            // the chopped ends' slant
    top[0][0] -= lean; bot[0][0] += lean * 0.4; top[N][0] += lean * 0.5; bot[N][0] -= lean * 0.6;
    const face = [...top, [x + w + lean * 0.15, y + h * 0.42], ...bot.reverse(), [x - lean * 1.2, y + h * 0.58]];   // (each end chopped to a blunt point)
    const out = (pts, d) => pts.map(([px, py]) => [px + Math.sign(px - (x + w / 2)) * d * 0.12, py + (py < y + h / 2 ? -d * 0.45 : d * 1.4)]);   // (its near flank shows more: the meadow's slant)
    // the stones under it, at a quarter in from each end
    for (const u of [0.2, 0.8]) {
      const sx = x + w * u, sy = y + h * 0.78;
      g.fillStyle = 'rgba(25, 30, 10, 0.25)'; g.beginPath(); g.ellipse(sx + 6, sy + 12, h * 0.42, h * 0.5, 0, 0, TAU); g.fill();
      const sg = g.createLinearGradient(sx, sy - h * 0.6, sx, sy + h * 0.6);
      sg.addColorStop(0, '#a9a493'); sg.addColorStop(1, '#6f6b5e');
      g.fillStyle = sg; g.beginPath(); g.ellipse(sx + (rnd() - 0.5) * 8, sy + h * 0.06, h * 0.34, h * 0.45, (rnd() - 0.5) * 0.4, 0, TAU); g.fill();
    }
    // its shadow, soft: a few spread fills
    g.fillStyle = 'rgba(25, 30, 10, 0.16)';
    for (let i = 4; i > 0; i--) { smooth(g, out(face, bark + i * 3).map(([a, b]) => [a + 5, b + 10])); g.fill(); }
    // the bark: dark, furrowed along the log's length, lit along its top
    const barkPts = out(face, bark);
    const bg = g.createLinearGradient(0, y - bark * 0.45, 0, y + h + bark * 1.4), ub = (h + bark * 0.45) / (h + bark * 1.85);
    bg.addColorStop(0, '#4a3320'); bg.addColorStop(ub * 0.98, '#5a3f28'); bg.addColorStop(ub + (1 - ub) * 0.25, '#80603f'); bg.addColorStop(1, '#2c1d10');
    g.fillStyle = bg; smooth(g, barkPts); g.fill();
    g.save(); smooth(g, barkPts); g.clip();
    g.lineCap = 'round';
    for (let i = 0, n = 70 * m; i < n; i++) {                                    // the furrows, short and along the log
      const side = rnd() < 0.25, by = side ? y - bark * (0.1 + rnd() * 0.3) : y + h + bark * (0.1 + rnd() * 1.25);
      const bx = x + rnd() * w, l = 10 + rnd() * 34;
      g.strokeStyle = rnd() < 0.6 ? 'rgba(30, 18, 8, 0.55)' : 'rgba(150, 120, 90, 0.35)'; g.lineWidth = (1 + rnd() * 1.6) * u;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + l, by + (rnd() - 0.5) * 3); g.stroke();
    }
    for (let i = 0; i < 6; i++) {                                     // moss and lichen on the bark
      const side = rnd() < 0.3, by = side ? y - bark * 0.25 : y + h + bark * (0.4 + rnd() * 0.8), bx = x + w * (0.1 + rnd() * 0.8);
      g.fillStyle = rnd() < 0.6 ? 'rgba(120, 150, 60, 0.6)' : 'rgba(200, 200, 150, 0.55)';
      for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(bx + (rnd() - 0.5) * 14, by + (rnd() - 0.5) * bark * 0.6, 1.5 + rnd() * 3, 0, TAU); g.fill(); }
    }
    for (const end of [0, 1]) {                                      // the chopped ends of the round: end grain, a ring or two
      const ex = end ? x + w + lean * 0.3 : x - lean * 0.6, d = end ? -1 : 1, ew = bark * 0.9;
      const eg = g.createLinearGradient(ex, 0, ex + d * ew, 0);
      eg.addColorStop(0, '#b08a5c'); eg.addColorStop(0.7, '#9a7448'); eg.addColorStop(1, 'rgba(90, 60, 30, 0)');
      g.fillStyle = eg; g.fillRect(Math.min(ex, ex + d * ew), y + h * 0.2, ew, h + bark * 1.6);
      g.strokeStyle = 'rgba(90, 55, 25, 0.45)'; g.lineWidth = (1) * u;
      for (let r = 1; r <= 3; r++) { g.beginPath(); g.ellipse(ex, y + h, ew * 0.22 * r, bark * 0.38 * r, 0, end ? Math.PI * 0.5 : -Math.PI * 0.5, end ? Math.PI * 1.5 : Math.PI * 0.5); g.stroke(); }
    }
    g.restore();
    // the face: pale split wood, a little warmer in the middle
    const fg = g.createLinearGradient(x, 0, x + w, 0);
    fg.addColorStop(0, '#bfa47c'); fg.addColorStop(0.15, '#dcc095'); fg.addColorStop(0.55, '#e2c69a'); fg.addColorStop(0.9, '#d6b98c'); fg.addColorStop(1, '#bea27a');
    g.fillStyle = fg; smooth(g, face); g.fill();
    g.save(); smooth(g, face); g.clip();
    // the fibre: long broken ridges along the length, each a dark tear with a lit lip beside it
    for (let i = 0, n = 120 * m; i < n; i++) {
      const ry = y + rnd() * h, x0 = x - 20 + rnd() * w, l = 40 + rnd() * w * 0.5, a = 0.6 + rnd() * 1.5, ph = rnd() * TAU;
      const dark = rnd() < 0.55;
      g.strokeStyle = dark ? `rgba(120, 80, 40, ${0.08 + rnd() * 0.16})` : `rgba(255, 240, 210, ${0.1 + rnd() * 0.2})`;
      g.lineWidth = (dark ? 0.7 + rnd() * 1.4 : 0.6 + rnd()) * u;
      g.beginPath();
      for (let xx = x0; xx <= x0 + l; xx += 10) g.lineTo(xx, ry + Math.sin(xx / 50 + ph) * a);
      g.stroke();
    }
    for (let i = 0, n = 9 * m; i < n; i++) {                                     // splinters lifted where the split tore: a sliver and its shade
      const sx = x + w * (0.05 + rnd() * 0.9), sy = y + h * (0.08 + rnd() * 0.84), l = 14 + rnd() * 26;
      g.fillStyle = 'rgba(100, 65, 30, 0.22)'; g.beginPath(); g.moveTo(sx, sy + 1.5); g.lineTo(sx + l, sy + 2.5); g.lineTo(sx + l * 0.3, sy + 3.5); g.fill();
      g.fillStyle = 'rgba(250, 235, 205, 0.5)'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + l, sy + 1); g.lineTo(sx + l * 0.3, sy - 1.5); g.fill();
    }
    // checks: cracks running in from the ends, thin dark wedges
    for (const end of [0, 1]) for (let i = 0; i < 2; i++) {
      const cy = y + h * (0.25 + rnd() * 0.5), cx = end ? x + w + lean * 0.5 : x - lean * 0.5, l = w * (0.08 + rnd() * 0.14), d = end ? -1 : 1;
      g.fillStyle = 'rgba(60, 35, 15, 0.55)';
      g.beginPath(); g.moveTo(cx, cy - 1.8); g.quadraticCurveTo(cx + d * l * 0.5, cy + (rnd() - 0.5) * 6, cx + d * l, cy); g.lineTo(cx, cy + 1.8); g.fill();
    }
    // the ends: greyed and darker, chopped in a facet or two
    for (const end of [0, 1]) {
      const eg = g.createLinearGradient(end ? x + w - w * 0.1 : x + w * 0.1, 0, end ? x + w + lean : x - lean, 0);
      eg.addColorStop(0, 'rgba(90, 80, 60, 0)'); eg.addColorStop(1, 'rgba(90, 80, 60, 0.35)');
      g.fillStyle = eg; g.fillRect(x - lean - 4, y - 4, w + lean * 2 + 8, h + 8);
    }
    // where things are cut: worn darker, knife nicks across the fibre
    const wg = g.createRadialGradient(x + w * 0.5, y + h * 0.5, 0, x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.55);
    wg.addColorStop(0, 'rgba(120, 90, 50, 0.16)'); wg.addColorStop(1, 'rgba(120, 90, 50, 0)');
    g.fillStyle = wg; g.fillRect(x, y, w, h);
    for (let i = 0, n = 30 * m; i < n; i++) {
      const mx = x + w * (0.25 + rnd() * 0.5), my = y + h * (0.2 + rnd() * 0.6), ml = 6 + rnd() * 18, ma = Math.PI / 2 + (rnd() - 0.5) * 1.2;
      g.strokeStyle = 'rgba(100, 60, 30, 0.2)'; g.lineWidth = (1) * u; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(ma) * ml, my + Math.sin(ma) * ml); g.stroke();
    }
    g.restore();
    // the split's edge, where the face meets the bark: a lit line on the near (top) side, shade on the far
    g.lineWidth = (1.5) * u; g.strokeStyle = 'rgba(255, 240, 210, 0.45)';
    g.beginPath(); top.slice(1, -1).forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke();
    g.strokeStyle = 'rgba(40, 25, 10, 0.4)'; g.lineWidth = (2) * u;
    g.beginPath(); bot.slice(1, -1).forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke();
    knife(g, x + w * 0.06, y + h + bark * 1.4 + h * 0.12, h * 0.42, -0.12);   // the knife, laid in the grass by it
    // chips and a curl of bark in the grass below it
    for (let i = 0, n = 12 * m; i < n; i++) {
      const cx = x + w * (0.05 + rnd() * 0.9), cy = rnd() < 0.7 ? y + h + bark * 1.4 + 6 + rnd() * h * 0.3 : y - bark - 4 - rnd() * h * 0.2, s = 3 + rnd() * 6, a = rnd() * TAU;
      g.save(); g.translate(cx, cy); g.rotate(a);
      g.fillStyle = rnd() < 0.75 ? '#dcc297' : '#5a3d25'; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, -s * 0.3); g.lineTo(s * 0.6, s * 0.4); g.closePath(); g.fill();
      g.restore();
    }
  }

  // The knife: a flint blade bound into a stick with cord, lying at x, y (its butt), len long, turned a.
  function knife(g, x, y, len, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    const t = Math.max(3, len * 0.07);
    g.fillStyle = 'rgba(20, 20, 10, 0.3)'; g.beginPath(); g.ellipse(len * 0.5 + 3, t + 2, len * 0.55, t * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a5532'; g.beginPath(); g.roundRect(0, -t, len * 0.5, t * 2, t); g.fill();
    g.fillStyle = 'rgba(255, 230, 190, 0.3)'; g.fillRect(t * 0.5, -t * 0.7, len * 0.45, t * 0.4);
    g.strokeStyle = '#d9c9a0'; g.lineWidth = Math.max(1.4, len * 0.012); for (let i = 0; i < 4; i++) { const cx = len * 0.5 - t * 0.8 - i * t * 0.8; g.beginPath(); g.moveTo(cx, -t); g.lineTo(cx + 1, t); g.stroke(); }
    g.fillStyle = '#3d3a3f'; g.beginPath(); g.moveTo(len * 0.48, -t * 1.1); g.quadraticCurveTo(len * 0.85, -t * 1.1, len, 0); g.quadraticCurveTo(len * 0.8, t * 1.1, len * 0.48, t * 1.1); g.fill();
    g.fillStyle = 'rgba(200, 200, 220, 0.4)'; g.beginPath(); g.moveTo(len * 0.5, -t * 0.8); g.quadraticCurveTo(len * 0.82, -t * 0.8, len * 0.97, 0); g.lineTo(len * 0.5, -t * 0.2); g.fill();
    g.restore();
  }

  // From above: a slab carried up from the river and laid by the fire ring. Its top x..x+w, y..y+h, roughly; the outline an
  // uneven round, its near side a lip of its thickness in shade. Grey-brown, faintly in layers, a crack across a corner, lichen
  // at the rim (pale green-grey and orange), moss in a hollow, darker with soot on its right (the fire's side, the open edge
  // toward the pot), and worn smooth and lighter in the middle where things are cut.
  function paintStone(g, x, y, w, h, seed = 7) {
    const u = Math.sqrt(Math.max(1, h / 300)), m = Math.max(1, w / 420);   // (bigger: lines a little thicker, more of them)
    const rnd = seeded(seed), cx = x + w / 2, cy = y + h / 2, N = 22, pts = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, r = 1.03 + Math.sin(a * 3 + 0.7) * 0.06 + Math.sin(a * 5 + 2.1) * 0.035 + (rnd() - 0.5) * 0.05;
      const sq = Math.pow(Math.abs(Math.cos(a)), 0.55) * Math.sign(Math.cos(a)), sy = Math.pow(Math.abs(Math.sin(a)), 0.55) * Math.sign(Math.sin(a));
      pts.push([cx + sq * w / 2 * r, cy + sy * h / 2 * r]);           // (a squarish round: a slab, not a pebble)
    }
    const lip = h * 0.06;
    g.fillStyle = 'rgba(25, 30, 10, 0.17)';                            // its shadow
    for (let i = 4; i > 0; i--) { smooth(g, pts.map(([a, b]) => [cx + (a - cx) * (1 + i * 0.02) + 6, cy + (b - cy) * (1 + i * 0.02) + lip + 10])); g.fill(); }
    g.fillStyle = '#4f4b42'; smooth(g, pts.map(([a, b]) => [a, b + lip])); g.fill();   // its thickness, the near side in shade
    const sg = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    sg.addColorStop(0, '#aea594'); sg.addColorStop(1, '#8b8270');
    g.fillStyle = sg; smooth(g, pts); g.fill();
    g.save(); smooth(g, pts); g.clip();
    for (let i = 0, n = 220 * m; i < n; i++) {                                   // mottling
      const mx = x + rnd() * w, my = y + rnd() * h, r = 2 + rnd() * 7;
      g.fillStyle = rnd() < 0.5 ? 'rgba(70, 66, 56, 0.06)' : 'rgba(225, 218, 200, 0.06)'; g.beginPath(); g.ellipse(mx, my, r * 1.3, r, rnd() * 3, 0, TAU); g.fill();
    }
    for (let i = 0; i < 5; i++) {                                     // the layers it split along, faint and wavy
      const ly = y + h * (0.1 + i * 0.2) + (rnd() - 0.5) * 8, ph = rnd() * TAU;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '70, 64, 54' : '210, 204, 186'}, ${0.06 + rnd() * 0.08})`; g.lineWidth = (1 + rnd() * 2) * u;
      g.beginPath(); for (let xx = x - 10; xx <= x + w + 10; xx += 14) g.lineTo(xx, ly + Math.sin(xx / 90 + ph) * 5 + (xx - x) * 0.05); g.stroke();
    }
    for (let i = 0, n = 400 * m; i < n; i++) {                                   // grit
      g.fillStyle = rnd() < 0.5 ? 'rgba(50, 46, 40, 0.25)' : 'rgba(235, 230, 215, 0.25)';
      g.fillRect(x + rnd() * w, y + rnd() * h, 1.2 * u, 1.2 * u);
    }
    // worn smooth where things are cut: lighter, a few stains
    const wg = g.createRadialGradient(cx - w * 0.06, cy, 0, cx - w * 0.06, cy, Math.min(w, h) * 0.5);
    wg.addColorStop(0, 'rgba(225, 220, 200, 0.22)'); wg.addColorStop(1, 'rgba(225, 220, 200, 0)');
    g.fillStyle = wg; g.fillRect(x, y, w, h);
    for (let i = 0; i < 4; i++) {
      const sx = x + w * (0.3 + rnd() * 0.35), sy = y + h * (0.3 + rnd() * 0.4), r = 10 + rnd() * 20;
      g.fillStyle = rnd() < 0.5 ? 'rgba(70, 90, 40, 0.07)' : 'rgba(90, 50, 40, 0.07)'; g.beginPath(); g.ellipse(sx, sy, r * 1.3, r, rnd(), 0, TAU); g.fill();
    }
    // soot on the fire's side
    const so = g.createLinearGradient(x + w * 0.6, 0, x + w * 1.06, 0);
    so.addColorStop(0, 'rgba(30, 26, 22, 0)'); so.addColorStop(0.6, 'rgba(30, 26, 22, 0.3)'); so.addColorStop(1, 'rgba(25, 22, 18, 0.7)');
    g.fillStyle = so; g.fillRect(x - w, y - h, w * 3, h * 3);
    // a crack across the far left corner
    g.strokeStyle = 'rgba(40, 36, 30, 0.6)'; g.lineWidth = (1.6) * u;
    g.beginPath(); let kx = x - 4, ky = y + h * 0.22; g.moveTo(kx, ky);
    for (let i = 0; i < 6; i++) { kx += w * 0.04 + rnd() * w * 0.03; ky -= h * 0.04 + (rnd() - 0.3) * h * 0.04; g.lineTo(kx, ky); }
    g.stroke();
    g.strokeStyle = 'rgba(230, 225, 210, 0.35)'; g.lineWidth = (1) * u; g.translate(0, 1.5); g.stroke(); g.translate(0, -1.5);
    // lichen and moss at the rim, away from the fire
    const rim = (u, v) => [cx + (u - 0.5) * w * 0.98, cy + (v - 0.5) * h * 0.98];
    for (let i = 0, n = 9 * m; i < n; i++) {
      const a = (0.35 + rnd() * 0.9) * Math.PI, [lx, ly] = rim(0.5 + Math.cos(a) * 0.47, 0.5 + Math.sin(a) * 0.45);
      const col = rnd() < 0.35 ? [222, 150, 60] : rnd() < 0.6 ? [190, 200, 160] : [160, 180, 110];
      for (let j = 0; j < 4; j++) {                                   // rosettes: a crusty ring, paler at its edge
        const rx = lx + (rnd() - 0.5) * 26, ry = ly + (rnd() - 0.5) * 18, r = (3 + rnd() * 7) * u;
        g.fillStyle = `rgba(${col}, 0.75)`; g.beginPath(); g.ellipse(rx, ry, r, r * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(${col.map(c => c * 0.75 | 0)}, 0.8)`; g.beginPath(); g.ellipse(rx, ry, r * 0.55, r * 0.45, 0, 0, TAU); g.fill();
        for (let q = 0; q < 6; q++) { const qa = rnd() * TAU; g.fillStyle = `rgba(${col.map(c => Math.min(255, c + 30))}, 0.8)`; g.beginPath(); g.arc(rx + Math.cos(qa) * r, ry + Math.sin(qa) * r * 0.8, 1 + rnd() * 1.5, 0, TAU); g.fill(); }
      }
    }
    const [mx, my] = rim(0.12, 0.85);                                  // moss in a hollow at the near left
    for (let j = 0; j < 40; j++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '90, 130, 50' : '120, 160, 70'}, 0.7)`;
      g.beginPath(); g.arc(mx + (rnd() - 0.5) * 34, my + (rnd() - 0.5) * 16, 1.5 + rnd() * 3, 0, TAU); g.fill();
    }
    g.restore();
    // its edge worn round: a lit band inside the rim on the far side, a shaded one on the near
    g.save(); smooth(g, pts); g.clip();
    g.lineWidth = (h * 0.05) * u;
    g.strokeStyle = 'rgba(60, 55, 45, 0.25)'; smooth(g, pts.map(([a, b]) => [a, b - 2])); g.stroke();
    g.restore();
    // a lit line on its far side
    g.strokeStyle = 'rgba(235, 230, 215, 0.4)'; g.lineWidth = (2) * u;
    g.save(); g.beginPath(); g.rect(x - w, y - h, w * 3, h * 0.9); g.clip(); smooth(g, pts); g.stroke(); g.restore();
    // a couple of pebbles in the grass by it, the knife laid by
    for (let i = 0; i < 4; i++) {
      const px = x + w * (rnd() < 0.5 ? -0.12 : 1.13) + (rnd() - 0.5) * 20, py = y + h * (0.2 + rnd() * 0.8), r = 4 + rnd() * 6;
      g.fillStyle = '#7d786b'; g.beginPath(); g.ellipse(px, py + 2, r, r * 0.75, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8a292'; g.beginPath(); g.ellipse(px - 1, py, r * 0.85, r * 0.6, 0, 0, TAU); g.fill();
    }
    knife(g, x + w * 0.06, y + h * 0.92, h * 0.36, -0.25);            // the knife, on the stone's near edge
  }

  // ---------------------------------------------------------------- a board
  // o: { sound(name, opts), off(piece): a piece swept off the open edge (the owner takes it; false and it bounces back),
  //      cut(piece, halves): a piece cut in two }.
  function make(o) {
    const B = { x: 0, y: 0, w: 0, h: 0 }, pieces = [], slashes = [], bits = [], stains = [], pops = [];
    const hand = { on: false, mode: '', back: false, x: -99, y: -99, seen: false, mouse: false, trail: [], stroke: 0, cuts: 0, x0: 0, y0: 0, t0: 0, lastX: 0, lastY: 0, lastT: 0, swish: 0 };
    const L = [0, 0], L2 = [0, 0];
    let now = 0, dtLast = 1 / 60, item = 160;
    const sound = (n, a) => { try { o.sound && o.sound(n, a || {}); } catch (e) { } };
    const k = () => item / U;
    const me = { pieces, hand, rect: B, bump: 0, SWIPE, TRAIL };

    // Where the board is (CSS px), and so how big a whole thing on it is. The pieces keep their place on it.
    me.layout = (x, y, w, h) => {
      const ow = B.w, oh = B.h, ox = B.x, oy = B.y, ok = k();
      B.x = x; B.y = y; B.w = w; B.h = h;
      item = Math.min(w, h) * 0.46;
      if (ow && oh) for (const p of pieces) { p.x = x + (p.x - ox) / ow * w; p.y = y + (p.y - oy) / oh * h; p.k *= k() / ok; }
    };
    // A whole thing laid on the board somewhere free-ish, dropped in from a little above. whole: the caller's tag for it.
    me.lay = (id, whole) => {
      let best = [B.x + B.w / 2, B.y + B.h / 2], bd = -1;
      for (let i = 0; i < 12; i++) {
        const x = B.x + B.w * rand(0.28, 0.72), y = B.y + B.h * rand(0.3, 0.7);
        let d = 1e9; for (const p of pieces) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
        if (d > bd) { bd = d; best = [x, y]; }
      }
      const K = kindOf(id), p = pieceOf(id, K.hull.map(q => q.slice()), K.hull.map(() => false), best[0], best[1], rand(-0.5, 0.5), k(), whole);
      p.pt = 1.6;
      pieces.push(p);
      return p;
    };
    me.clear = () => { pieces.length = slashes.length = bits.length = stains.length = pops.length = hand.trail.length = 0; };
    me.take = p => { const i = pieces.indexOf(p); if (i >= 0) pieces.splice(i, 1); };

    const pieceAt = (x, y) => {
      for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; toLocal(p, x, y, L); if (inside(p.poly, L[0], L[1])) return p; }
      return null;
    };
    const nearPiece = (x, y, reach) => {
      let best = null, bd = reach;
      for (const p of pieces) { const d = Math.hypot(p.x - x, p.y - y) - p.r * p.k * 0.6; if (d < bd) { bd = d; best = p; } }
      return best;
    };
    // The pointer: down, moved (each of the coalesced moves), up. t in s (performance.now() / 1000).
    me.down = (x, y, t) => {
      Object.assign(hand, { on: true, x, y, seen: true, cuts: 0, x0: x, y0: y, t0: t, lastX: x, lastY: y, lastT: t });
      hand.back = x < B.x + Math.max(40, B.w * SCRAPE) && y > B.y - 30 && y < B.y + B.h + 30;
      hand.mode = hand.back || pieceAt(x, y) || nearPiece(x, y, 6) ? 'maybe' : 'cut';   // (on a piece or at the back: told by the first move)
      hand.stroke++;
      if (hand.mode === 'cut') hand.trail.push([x, y, now]);
    };
    me.move = (x, y, t) => {
      let ox = hand.x, oy = hand.y;
      hand.x = x; hand.y = y; hand.seen = true;
      if (!hand.on) return;
      if (hand.mode === 'maybe') {
        const d = Math.hypot(x - hand.x0, y - hand.y0);
        if (d < 14) return;
        if (d / Math.max(0.008, t - hand.t0) > SWIPE) {
          // a swipe that started on a piece: cut from well behind where it started, so the piece is cut through
          hand.mode = 'cut';
          const ux = (x - hand.x0) / d, uy = (y - hand.y0) / d;
          hand.trail.push([hand.x0, hand.y0, now]);
          cutAlong(hand.x0 - ux * 300, hand.y0 - uy * 300, hand.x0, hand.y0);
        } else if (hand.back && x - hand.x0 > Math.abs(y - hand.y0) * 0.6) { hand.mode = 'scrape'; sound('swish', { v: 0.2 }); }
        else if (pieceAt(hand.x0, hand.y0) || nearPiece(hand.x0, hand.y0, 6)) hand.mode = 'push';
        else { hand.mode = 'cut'; hand.trail.push([hand.x0, hand.y0, now]); }
        ox = hand.x0; oy = hand.y0;
      }
      if (hand.mode === 'cut') {
        hand.trail.push([x, y, now]);
        cutAlong(ox, oy, x, y);
        const sp = Math.hypot(x - hand.lastX, y - hand.lastY) / Math.max(0.004, t - hand.lastT);
        if (sp > 1100 && t - hand.swish > 0.2) { hand.swish = t; sound('swish', { v: clamp((sp - 1100) / 2600, 0, 1) }); }
      } else if (hand.mode === 'push') sweep(pieces, ox, oy, x, y, dtLast, now);
      else if (hand.mode === 'scrape') scrape(Math.max(ox, B.x), Math.min(x, B.x + B.w));
      hand.lastX = x; hand.lastY = y; hand.lastT = t;
    };
    // The knife's flat across the whole board at x, come from ox: what's in front of it is pushed on ahead of it.
    const scrape = (ox, x) => {
      if (x <= ox) return;
      const v = (x - ox) / Math.max(0.016, dtLast);
      for (const p of pieces) {
        const need = p.r * p.k * 0.4;
        if (p.x + need < ox || p.x - need > x) continue;
        p.x = x + need; p.vx = Math.max(p.vx, v); p.vy *= 0.5; p.va += (Math.random() - 0.5) * 0.4;
        p.swept = now; p.scraped = hand.stroke;
        if (p.pt <= 0) p.pt = 0.4;
      }
    };
    me.up = () => {
      // a scrape that got most of the way: all it pushed goes on off the edge
      if (hand.mode === 'scrape' && hand.x > B.x + B.w * 0.7)
        for (const p of pieces) if (p.scraped === hand.stroke) { p.vx = Math.max(p.vx, (B.x + B.w + p.r * p.k - p.x) * 5.5 + 60); p.swept = now; }
      if (hand.cuts >= 3) { pops.push({ x: hand.x, y: hand.y, text: hand.cuts + ' cuts!', t: 0 }); sound('pick', { n: hand.cuts }); }
      hand.on = false; hand.mode = ''; hand.cuts = 0;
      for (const p of pieces) p.enter = null;
    };
    me.leave = () => { hand.seen = false; };

    // Walk the drag in small steps; a piece is cut where the swipe came in to where it came out again.
    function cutAlong(ax, ay, bx, by) {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
      for (let i = 1; i <= n; i++) {
        const t0 = (i - 1) / n, t1 = i / n, x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
        for (let j = pieces.length - 1; j >= 0; j--) {
          const p = pieces[j];
          if (!p) continue;
          toLocal(p, x1, y1, L);
          const isIn = inside(p.poly, L[0], L[1]);
          if (isIn && p.stroke !== hand.stroke) {
            toLocal(p, x0, y0, L2);                        // (came in: where the step started, just outside)
            if (!inside(p.poly, L2[0], L2[1])) { p.enter = [L2[0], L2[1]]; p.stroke = hand.stroke; }
          } else if (!isIn && p.stroke === hand.stroke && p.enter) {
            const [ex, ey] = p.enter;
            p.enter = null;
            if (p.area < SMALLEST) { p.va += rand(-2, 2); continue; }          // too small to cut: it skitters
            if (Math.hypot(L[0] - ex, L[1] - ey) < 6) continue;
            cutPiece(p, ex, ey, L[0], L[1], bx - ax, by - ay);
          }
        }
      }
    }
    function cutPiece(p, ax, ay, bx, by, wdx, wdy) {
      const halves = split(p.poly, p.cut, ax, ay, bx, by);
      if (halves.some(([P]) => P.length < 3 || areaOf(P) < 40)) return false;
      const made = [];
      for (const [P, C] of halves) {
        const q = pieceOf(p.id, P, C, 0, 0, p.a, p.k, p.whole);
        [q.x, q.y] = toWorld(p, q.cx, q.cy);
        made.push(q);
      }
      pieces.splice(pieces.indexOf(p), 1, ...made);
      // the halves fly apart across the cut, carried on a little the way the swipe went, spinning
      const len = Math.hypot(wdx, wdy) || 1, nx = -wdy / len, ny = wdx / len;
      for (const q of made) {
        const sd = Math.sign((q.x - p.x) * nx + (q.y - p.y) * ny) || 1, push = rand(170, 300) * (0.6 + 0.4 * Math.min(1, 900 / q.area));
        q.vx = nx * sd * push + wdx / len * 90; q.vy = ny * sd * push + wdy / len * 90; q.va = sd * rand(2, 5);
        q.pt = 1.8;
      }
      // a quick slash, and crumbs of its inside
      const [cx, cy] = toWorld(p, (ax + bx) / 2, (ay + by) / 2), f = fleshOf(p.id), big = p.r * p.k;
      slashes.push({ x: cx, y: cy, dx: wdx / len, dy: wdy / len, len: big * 2.2, t: 0 });
      for (let i = 0; i < 7; i++) {
        const s = Math.random() < 0.5 ? 1 : -1, sp = rand(60, 220);
        bits.push({ x: cx + rand(-8, 8), y: cy + rand(-8, 8), vx: nx * s * sp + rand(-40, 40), vy: ny * s * sp + rand(-40, 40),
                    r: rand(1.2, 3), col: Math.random() < 0.6 ? f : tintOf(p.id), t: 0, life: rand(0.35, 0.7), spot: false });
      }
      // juice: a splash where it was cut, and drops thrown on along the swipe that land as spots on the board
      const j = juiceOf(p.id);
      for (let i = 0; i < 6; i++) stains.push({ x: cx + rand(-0.3, 0.3) * big, y: cy + rand(-0.3, 0.3) * big, r: big * rand(0.08, 0.22), col: j, t: 0 });
      for (let i = 0; i < 9; i++) {
        const sp = rand(200, 520), a = Math.atan2(wdy, wdx) + rand(-0.6, 0.6);
        bits.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.5, 4), col: j, t: 0, life: rand(0.2, 0.4), spot: true });
      }
      while (stains.length > STAINS) stains.shift();
      hand.cuts++;
      sound('chop', { way: 'chopped', last: made.some(q => q.area < SMALLEST) });
      me.bump = Math.min(1, me.bump + 0.5);
      if (o.cut) o.cut(p, made);
      return true;
    }

    // The board moving on by dt (s); t the time (s).
    me.tick = (dt, t) => {
      now = t; dtLast = dt;
      me.bump = Math.max(0, me.bump - dt * 5);
      const fric = hand.on && (hand.mode === 'push' || hand.mode === 'scrape') ? 9 : 4.2;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        const f = Math.exp(-dt * fric); p.vx *= f; p.vy *= f; p.va *= Math.exp(-dt * 6);
        p.pt = Math.max(0, p.pt - dt * 3);
        // three sides have a lip; off the right edge it goes, but only by a sweep (a piece flung by a cut bounces off it)
        const e = p.r * p.k * 0.45;
        if (p.x < B.x + e) { p.x = B.x + e; p.vx = Math.abs(p.vx) * 0.3; }
        if (p.y < B.y + e) { p.y = B.y + e; p.vy = Math.abs(p.vy) * 0.3; }
        if (p.y > B.y + B.h - e) { p.y = B.y + B.h - e; p.vy = -Math.abs(p.vy) * 0.3; }
        const swept = now - p.swept < 0.5;
        if (!swept && p.x > B.x + B.w - e) { p.x = B.x + B.w - e; p.vx = -Math.abs(p.vx) * 0.3; }
        else if (p.x > B.x + B.w + p.r * p.k * 0.2) {
          if (o.off && o.off(p) !== false) { const at = pieces.indexOf(p); if (at >= 0) pieces.splice(at, 1); }
          else { p.x = B.x + B.w - e; p.vx = -Math.abs(p.vx) * 0.5; p.swept = -9; }
        }
      }
      for (let i = slashes.length - 1; i >= 0; i--) if ((slashes[i].t += dt) > 0.16) slashes.splice(i, 1);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.exp(-dt * 5); b.vy *= Math.exp(-dt * 5);
        if (b.t > b.life) { if (b.spot) stains.push({ x: b.x, y: b.y, r: b.r * 1.3, col: b.col, t: 0 }); bits.splice(i, 1); }
      }
      for (let i = stains.length - 1; i >= 0; i--) if ((stains[i].t += dt) > 7) stains.splice(i, 1);
      for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].t += dt) > 1.1) pops.splice(i, 1);
      while (hand.trail.length && now - hand.trail[0][2] > TRAIL) hand.trail.shift();
    };

    // On the board (drawn after it): the juice, the pieces, the slashes and crumbs, the swipe's trail, the words.
    me.draw = (ctx, ox = 0) => {
      for (const s of stains) {
        ctx.fillStyle = `rgba(${s.col[0]}, ${s.col[1]}, ${s.col[2]}, ${0.42 * Math.min(1, (7 - s.t) / 2)})`;
        ctx.beginPath(); ctx.arc(s.x + ox, s.y, s.r, 0, TAU); ctx.fill();
      }
      for (const p of pieces) drawPiece(ctx, p, ox, p.pt * 3);
      me.drawOver(ctx, ox);
    };
    // (What goes over everything, on the board's scene or not: the cut's flash, its crumbs, the trail, the words.)
    me.drawOver = (ctx, ox = 0) => {
      for (const s of slashes) {
        const q = s.t / 0.16;
        ctx.strokeStyle = `rgba(255, 252, 235, ${0.85 * (1 - q)})`; ctx.lineWidth = 3 * (1 - q) + 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x + ox - s.dx * s.len / 2, s.y - s.dy * s.len / 2); ctx.lineTo(s.x + ox + s.dx * s.len / 2, s.y + s.dy * s.len / 2); ctx.stroke();
      }
      for (const b of bits) {
        const q = b.t / b.life;
        ctx.fillStyle = `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, ${1 - q * q})`;
        ctx.beginPath(); ctx.arc(b.x + ox, b.y, b.r, 0, TAU); ctx.fill();
      }
      if (hand.on && hand.mode === 'scrape') {
        // the knife's flat: a pale edge across the board where the hand is
        const x = clamp(hand.x, B.x, B.x + B.w) + ox;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 214, 130, 0.3)'; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(x, B.y + 8); ctx.lineTo(x, B.y + B.h - 8); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 250, 232, 0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, B.y + 8); ctx.lineTo(x, B.y + B.h - 8); ctx.stroke();
      }
      const T = hand.trail, n = T.length;
      if (n > 1) {
        // the swipe's trail: a ribbon thick at the finger and thin at its tail, a warm glow round a white core
        const left = [], right = [];
        for (let i = 0; i < n; i++) {
          const [x, y, t] = T[i], [xa, ya] = T[Math.max(0, i - 1)], [xb, yb] = T[Math.min(n - 1, i + 1)];
          const dl = Math.hypot(xb - xa, yb - ya) || 1, q = clamp(1 - (now - t) / TRAIL, 0, 1) * (i / (n - 1));
          left.push([x - (yb - ya) / dl * q, y + (xb - xa) / dl * q]); right.push([x + (yb - ya) / dl * q, y - (xb - xa) / dl * q]);
        }
        const ribbon = (w, col) => {
          ctx.fillStyle = col; ctx.beginPath();
          for (let i = 0; i < n; i++) { const [x, y] = T[i]; ctx.lineTo(x + ox + (left[i][0] - x) * w, y + (left[i][1] - y) * w); }
          for (let i = n - 1; i >= 0; i--) { const [x, y] = T[i]; ctx.lineTo(x + ox + (right[i][0] - x) * w, y + (right[i][1] - y) * w); }
          ctx.closePath(); ctx.fill();
        };
        ribbon(16, 'rgba(255, 214, 130, 0.28)');
        ribbon(9, 'rgba(255, 244, 210, 0.6)');
        ribbon(3.6, 'rgba(255, 255, 255, 0.95)');
      }
      for (const p of pops) {
        // a few cuts in one swipe: a word that rises and fades (the right way round on a board drawn mirrored)
        const q = p.t / 1.1;
        ctx.save(); ctx.translate(p.x + ox, p.y - 30 - q * 40); if (ctx.getTransform().a < 0) ctx.scale(-1, 1);
        ctx.globalAlpha = 1 - q * q; ctx.font = '650 26px Fraunces, Georgia, serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = '#f8f0de'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = '#9e4a17'; ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }
    };
    // No knife: with a mouse, only a small glow where it is.
    me.drawHand = (ctx) => {
      if (hand.on || !hand.mouse || !hand.seen) return;
      ctx.fillStyle = 'rgba(255, 250, 230, 0.55)'; ctx.beginPath(); ctx.arc(hand.x, hand.y, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 250, 230, 0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hand.x, hand.y, 9, 0, TAU); ctx.stroke();
    };
    return me;
  }

  return {
    make, pieceOf, kindOf, drawPiece, sweep, picture, paintBoard, paintLog, paintStone, paintGround, areaOf, inside, toLocal, toWorld, fleshOf, juiceOf, tintOf, S, U, SMALLEST, BLADE,
    paintWith(fn) { paintThing = fn; },
    tagsWith(fn) { tagsOf = fn; },
  };
})();
