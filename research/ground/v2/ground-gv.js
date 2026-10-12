// research/ground/v2: today's ground.js with the ground variants behind ?gv=N (0 today, 1 A tussocks, 2 B first go,
// 3 C combed, 4 D watercolour, 5 B the meadow = ground-variant.js). Copy over ground.js in a scratch checkout to try
// them live; Ground._gv(n) switches the shader in place (dev only). Not for main.
/* Nobody's Meadow — the ground: grass, earth, shores and water, painted by a small WebGL shader.
 *
 * game.js hands over the meadow as a few tiny textures, one texel a tile, and the shader works
 * out every pixel on the screen. It paints again only when something it shows has moved (the
 * camera, a texture, the light), so the grass changes the moment it grows and the ground is sharp
 * at any zoom, but a still camera costs the GPU next to nothing. The look, from big to small:
 *   - where it is: a cooler, deeper green by the water and the woods, golden up high and in big
 *     drifts (the hue shifts, the grass stays bright);
 *   - the grass itself (what the rabbits eat): lush grass, or the bare earth where it is grazed;
 *   - where the grass is thick: soft brush dabs from afar, crisp filled tufts once you're close;
 *   - a faint painterly mottle and, up close, a fine grain and the odd pebble;
 *   - the sun on the slopes, wet moss at the water's edge, then the water in soft layers,
 *     deepest well out from the shore, with long brushed strokes on its surface.
 *
 * Use: Ground.set(name, data) with a Float32Array of 4 values a tile: 'tile' (grass, water,
 * ash, wood), 'bloom' (a field's tint times how much it shows, then how much), 'shape' (height,
 * tiles to the water, tiles to the woods, mud the Dry Year's water left), 'water' (the water
 * softened by 1, 2 and 4 blurs, and the deep water by 2) and 'parched' (?keep, the Dry Year: how
 * parched, the first of the four), and once Ground.mist(...) with how thick the mist is near the
 * edges. Then Ground.draw(uniforms) paints Ground.canvas if it has to, and
 * Ground.view says where in it the screen's corner is. game.js shows the canvas as a layer of its own
 * under the meadow, slid so that corner is on the screen's.
 * Ground.ok is false where there is no WebGL2.
 */
(() => {
'use strict';

const S = window.Sim;
const canvas = document.createElement('canvas');
// preserveDrawingBuffer: the picture stays put between draws, as it is while nothing changed.
const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });

const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0., 1.); }`;

const GV0 = +(new URLSearchParams(location.search).get('gv') || 0);
const FRAG = GV => `#version 300 es
precision highp float;
#define GV ${GV}
uniform sampler2D tile, bloom, shape, water, mist, parched;
uniform vec2 size, off, seed;
uniform float top, zoom, dpr, snow, damp, lx, ly, ice, cold, mistOut, drought;
uniform vec3 low, high, sand, fog;
out vec4 o;

// The Dry Year (?keep): drought is how hard it bites, 0 to 1 (game.js, in steps of 1/16), and the parched texture's red how
// parched each tile is, as the sim has it (sim.js parch: away from the water and a hedge's lane, less under the trees).
#define DRY_WOBBLE 0.25                   // how much the edge between the green and the straw wanders, finer than a tile
#define DRY_STRAW vec3(0.86, 0.78, 0.50)
#define DRY_OLIVE vec3(0.70, 0.69, 0.44)  // here and there, through the straw
#define DRY_EARTH vec3(0.74, 0.64, 0.49)  // baked earth
#define DRY_MUD vec3(0.50, 0.43, 0.34)    // wet mud where the water has drawn back past any summer's line (the shape's 4th)
#define DRY_LUSH 0.6                      // how much lusher the ring by the water goes
#define DRY_GREEN 0.75                    // and how thick its grass shows at least, whatever the sim's (a pond just dug)
#define DRY_THIN 0.7                      // the straw this much thinner where the bare earth shows

// Hashes the float's own bits, so it stays exact at any coordinate: a float trick like
// fract(p * 123.34) runs out of digits in the fine grain and paints it in streaks.
uint hashu(vec2 p) {
  uvec2 u = floatBitsToUint(p);
  uint h = u.x * 0x8da6b343u ^ u.y * 0xd8163841u;
  h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
  return h;
}
float hash(vec2 p) { return float(hashu(p)) * (1. / 4294967296.); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.3 * noise(p * 2.03 + 7.) + 0.2 * noise(p * 4.1 + 13.); }

// A texture read smoothly between the tiles (a cubic B-spline, from four plain reads), so
// shapes cut out of it come out round instead of in steps.
vec4 smooth4(sampler2D t, vec2 p) {
  vec2 q = p - 0.5, i = floor(q), f = q - i;
  vec2 w0 = (1. - f) * (1. - f) * (1. - f) / 6., w1 = (4. - 6. * f * f + 3. * f * f * f) / 6.;
  vec2 w2 = (1. + 3. * f + 3. * f * f - 3. * f * f * f) / 6., w3 = f * f * f / 6.;
  vec2 s0 = w0 + w1, s1 = w2 + w3;
  vec2 c0 = (i - 0.5 + w1 / s0) / size, c1 = (i + 1.5 + w3 / s1) / size;
  return mix(mix(texture(t, c1), texture(t, vec2(c0.x, c1.y)), s0.x),
             mix(texture(t, vec2(c1.x, c0.y)), texture(t, c0), s0.x), s0.y);
}

float segment(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * t);
}

// Tufts: a small fan of five filled blades, a few to a tile, only where the grass is thick.
// Gives how much of this pixel they cover, and whether it is a blade's sunny side. px: tiles a screen pixel.
vec2 tufts(vec2 p, float px) {
  const float CELL = 0.9, LEN = 0.34, WIDTH = 0.05;
  float cover = 0., lit = 0.;
  vec2 c = floor(p / CELL);
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy), r = vec2(hash(id + seed), hash(id + seed + 17.1));
    vec2 base = (id + 0.2 + 0.6 * r) * CELL;
    float g = texture(tile, base / size).r;
    if (hash(id + seed + 41.7) > 0.55 * smoothstep(0.45, 0.9, g)) continue;
    float len = LEN * (0.75 + 0.5 * hash(id + 3.3)) * (0.6 + 0.4 * g);
    if (length(p - base + vec2(0., 0.5 * len)) > 0.7 * len + WIDTH + px) continue;   // too far to reach this pixel
    for (int k = -2; k <= 2; k++) {
      float fk = float(k), t;
      vec2 foot = base + vec2(fk * 0.025, 0.);
      vec2 tip = base + vec2(fk * len * 0.3 + (hash(id + fk) - 0.5) * 0.06, -len * (1. - 0.2 * abs(fk)));
      float d = segment(p, foot, tip, t);
      float w = max(WIDTH, 0.7 * px) * (1. - t * t);             // wide at the foot, a point at the tip
      float a = 1. - smoothstep(w - px, w + px, d);
      if (a > cover) { cover = a; lit = step(0., dot(p - foot, vec2(foot.y - tip.y, tip.x - foot.x))); }
    }
  }
  return vec2(cover, lit);
}

// Four values from one hash, a byte each: cheaper than four hashes. (From the uint itself: a float
// keeps only 24 bits, and the lowest byte would come out 0.)
vec4 hash4(vec2 p) {
  uint h = hashu(p);
  return vec4(uvec4(h, h >> 8, h >> 16, h >> 24) & 255u) * (1. / 255.);
}

// Soft upright brush dabs, one to a cell, each a touch lighter or darker. Gives that shade
// (-0.5 to 0.5) where a dab covers the pixel. Seen from afar, where the tufts are gone.
float dabs(vec2 p, float px) {
  const float CELL = 0.8;
  vec2 s = p / CELL, c = floor(s);
  float shade = 0.;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy);
    vec4 a = hash4(id + seed);                                     // where, lean, length
    vec2 d = s - id - a.xy;
    if (dot(d, d) > 1.1) continue;                                 // too far to reach this pixel
    vec4 b = hash4(id + seed + 7.7);                               // width, shade
    vec2 dir = normalize(vec2(0.9 * (a.z - 0.5), -1.));
    float u = dot(d, dir), v = dot(d, vec2(-dir.y, dir.x));
    float len = 0.55 + 0.35 * a.w, w = (0.2 + 0.1 * b.x) * (1. - 0.5 * clamp(u / len * 0.5 + 0.5, 0., 1.));
    float f = length(vec2(u / len, v / w)), aa = px / CELL / w * 1.5 + 0.15;
    shade = mix(shade, b.y - 0.5, 1. - smoothstep(1. - aa, 1. + aa, f));
  }
  return shade;
}

// n layers of a colour at alpha a each, stacked from level t0 to t1 of field f, as how much of
// the colour shows. Counted smoothly, so they make a gradient instead of steps.
float layers(float f, float t0, float t1, float n, float a) {
  return 1. - pow(1. - a, clamp((f - t0) / (t1 - t0) * (n - 1.) + 1., 0., n));
}

#if GV >= 1
// ---------------------------------------------------------------- the new grass (GV 1 to 4)

// Value noise with its slope: (value, d/dx, d/dy). The light on a soft field without working it out again nearby.
vec3 noised(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.), du = 30. * f * f * (f * (f - 2.) + 1.);   // quintic: no creases in the light
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * (vec2(k1, k2) + k4 * u.yx));
}

// The season's grass in the light (l > 0, toward a near-pure lime) or the shade (l < 0, a deep emerald, bluer).
// Winter's grey-green only gets lighter and darker: no lime in the frost. Set once a pixel, from the season (main).
vec3 LIT, LIT_ADD, DEEP;
vec3 tone(vec3 c, float l) {
  return l > 0. ? mix(c, c * LIT + LIT_ADD, min(l, 1.)) : mix(c, c * DEEP, min(-l, 1.));
}

// The light comes from the top left, a little in front, as on the trees (trees.js L).
const vec3 SUN = vec3(-0.55, -0.75, 0.55) / 1.0817;

// Soft swells, a few tiles across and smaller ones on them, turned against each other so no grid shows. Gives
// (height 0 to 1, its slope per tile). k: how many to a tile.
const mat2 TURN = mat2(0.8, -0.6, 0.6, 0.8);
vec3 swells(vec2 q, float k) {
  vec3 a = noised(q * k + 700.), b = noised(TURN * q * (k * 2.3) + 720.);
  return vec3(0.62 * a.x + 0.38 * b.x, 0.62 * k * a.yz + 0.38 * k * 2.3 * (b.yz * TURN));
}
// How a surface with this slope (and this height, higher catches more light) is lit: -1 to 1, 0 flat.
float lightOf(vec3 s, float relief) {
  vec3 n = normalize(vec3(-s.yz * relief, 1.));
  return (dot(n, SUN) - SUN.z) * 2.4 + (s.x - 0.5) * 0.9 * min(relief, 1.);
}
#endif

#if GV == 1 || GV == 4
// Brush dabs: one to a cell, a short pointed blade of paint standing up out of the grass and leaning with its
// neighbours, each a touch lighter or darker than the light where it sits. Where two overlap the lighter is on top,
// as a painter works from shade to light. Gives (how much of the pixel the top dab covers, its shade -1 to 1).
vec2 dabs2(vec2 p, float px, float cell, float len, float wid, float lean, float thick) {
  vec2 c = floor(p / cell);
  float cover = 0., top = -9.;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy);
    vec4 a = hash4(id + seed + 11.);
    if (a.w > thick) continue;                                     // thin grass: fewer dabs
    vec2 foot = (id + 0.1 + 0.8 * a.xy) * cell;
    vec2 dir = normalize(vec2(lean + 0.7 * (a.z - 0.5), -1.));
    vec2 d = p - foot;
    float L = len * (0.75 + 0.5 * a.x);
    float t = dot(d, dir) / L, v = abs(dot(d, vec2(-dir.y, dir.x)));
    if (t < -0.2 || t > 1.) continue;
    // a leaf of paint: round at its foot, widest a third of the way up, a point at the tip
    float w = wid * 2.6 * sqrt(max(t + 0.08, 0.)) * (1. - t);
    float cov = 1. - smoothstep(w - px, w + px, v);
    float sh = 2. * fract(a.z * 7.31 + a.y * 3.17) - 1.;            // its own touch lighter or darker
    if (cov > 0.02 && sh > top) { top = sh; cover = cov; }
  }
  return vec2(cover, top);
}
#endif

#if GV == 2
// Cartoon tufts: a fan of broad curved blades from one foot, soft-shaded from a mid green at the foot to lime at the
// tip, the blades on the sun's side lighter, standing on a soft shadow. One to a cell at most, thick and big in
// drifts, few and small between. Gives (cover, shade -1 to 1, shadow).
vec3 tufts2(vec2 p, float px, float driftAt) {
  const float CELL = 0.85;
  vec2 c = floor(p / CELL);
  float cover = 0., shade = 0., shadow = 0., front = -1e9;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy);
    vec4 a = hash4(id + seed + 21.);
    vec2 base = (id + 0.15 + 0.7 * a.xy) * CELL;
    float g = texture(tile, base / size).r;
    float dn = smoothstep(0.5, 0.75, g) * (0.12 + 0.88 * smoothstep(0.35, 0.65, fbm((base + seed) * 0.3 + 760.)));
    if (a.w > dn) continue;
    float big = (0.42 + 0.3 * a.z) * (0.75 + 0.45 * dn);             // tiles tall: bigger in the thick of a drift
    vec2 d0 = p - base;
    vec2 sd = (d0 - vec2(0.1, 0.02) * big) / (vec2(0.5, 0.17) * big);
    shadow = max(shadow, 1. - smoothstep(0.2, 1.1, length(sd)));
    if (d0.y > 0.06 || d0.y < -big * 1.1 || abs(d0.x) > big * 0.9) continue;
    for (int k = 0; k < 5; k++) {
      float fk = float(k) - 2., r = fract(a.z * 13.7 + fk * 0.37);
      vec2 foot = base + vec2(fk * 0.045 * big, 0.);
      float ang = fk * 0.38 + (r - 0.5) * 0.3 + 0.2 * (a.x - 0.5);
      float L = big * (1. - 0.14 * abs(fk)) * (0.85 + 0.3 * r);
      vec2 dir = vec2(sin(ang), -cos(ang));
      vec2 d = p - foot;
      float t = dot(d, dir) / L;
      if (t < -0.1 || t > 1.) continue;
      float v = dot(d, vec2(-dir.y, dir.x)) - sign(fk + 0.01) * 0.12 * L * t * t;   // the blade curving out
      float w = 0.1 * big * 2.6 * sqrt(max(t + 0.05, 0.)) * (1. - t);
      float cov = 1. - smoothstep(w - px, w + px, abs(v));
      if (cov <= 0.) continue;
      float key = base.y + 0.001 * (2. - abs(fk)) - (cov < 0.5 ? 100. : 0.);
      cover = max(cover, cov);
      if (key > front) {
        front = key;
        shade = -0.55 + 1.45 * t + 0.3 * clamp(-v / max(w, 1e-4), -1., 1.) - 0.12 * fk;
      }
    }
  }
  return vec3(cover, clamp(shade, -1., 1.), shadow);
}
#endif

#if GV == 3
// Long grass combed by the wind: strands lying along a slow flow, a few tiles long rows broken into strokes, each
// darker at its root and lighter at its tip. Gives (cover, shade -1 to 1). s, t: across and along the flow, in tiles.
vec2 strands(float s, float t, float px) {
  const float ROW = 0.16, LEN = 1.1;
  float row = floor(s / ROW), cover = 0., shade = 0.;
  for (int k = -1; k <= 1; k++) {
    float r = row + float(k);
    vec4 a = hash4(vec2(r, 3.7) + seed);
    float along = t + a.x * LEN * 3.;
    float seg = floor(along / LEN), u = fract(along / LEN);
    vec4 b = hash4(vec2(r, seg) + seed + 5.);
    float L = 0.55 + 0.4 * b.x;                                     // of the segment
    if (u > L) continue;
    float tt = u / L;
    float mid = (r + 0.5 + 0.6 * (b.y - 0.5)) * ROW + 0.05 * sin(tt * 3.1 + b.z * 6.);
    float w = ROW * 0.55 * (1. - tt * tt) * (0.7 + 0.5 * b.w);
    float cov = 1. - smoothstep(w - px, w + px, abs(s - mid));
    if (cov > cover) { cover = cov; shade = -0.7 + 1.3 * tt + 0.5 * (b.z - 0.5); }
  }
  return vec2(cover, clamp(shade, -1., 1.));
}
#endif

#if GV == 5
// The meadow's tufts, one to a cell at most. In the long grass a fan of broad curved blades, in the longest now and
// then gone to seed (a few thin stalks with a head each); on the short grass a sprig of clover. Each soft-shaded like
// an emoji: deep at the foot, lime at the tips, the sun's side lighter, standing on a soft shadow. Whether a cell has
// one is the cell's own (its grass and a roll); how big it is comes from the drift here (0 to 1, one look a pixel),
// so they grow big in the drifts and shrink away between, and a tuft never gets cut where the drift changes.
// seedy: how much the grass goes to seed this season, clovery how much clover shows. Gives (cover, shade -1 to 1,
// shadow, kind: 0 a blade, 1 a seed head, 2 clover, plus 0.9 times the tuft's own roll, 0 to 1).
const vec2 TUFT_CELL = vec2(0.85, 1.);    // tiles; a tuft is at most 1.15 cells tall, or the cell below would cut it
vec4 tufts3(vec2 p, float px, float drift, float seedy, float clovery) {
  vec2 c = floor(p / TUFT_CELL);
  float cover = 0., shade = 0., shadow = 0., kind = 0., roll = 0., front = -1e9;
  float grow = smoothstep(0.1, 0.7, drift);
  if (grow <= 0.) return vec4(0.);
  // A tuft stands up from its foot, so only those in this row and the one below reach up to here; the row above only
  // with its feet and its shadow, near the top of this one.
  int y0 = fract(p.y / TUFT_CELL.y) < 0.25 ? -1 : 0;
  for (int dy = y0; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy);
    vec4 a = hash4(id + seed + 21.);
    vec2 base = (id + 0.1 + 0.8 * a.xy) * TUFT_CELL, d0 = p - base;
    float big = (0.35 + 0.3 * a.z) * (0.55 + 0.7 * grow);            // tiles tall
    if (a.w > 0.75 || d0.y > 0.25 * big || d0.y < -big * 1.3 || abs(d0.x) > big) continue;   // (out of reach: no need to look)
    float g = texture(tile, base / size).r;
    float isLong = smoothstep(0.52, 0.72, g), isShort = clovery * smoothstep(0.2, 0.3, g) * (1. - smoothstep(0.4, 0.5, g));
    if (a.w > max(0.75 * isLong, 0.4 * isShort)) continue;
    bool clover = isShort > isLong;
    bool seeds = !clover && a.z > 1. - 0.28 * seedy * smoothstep(0.8, 0.97, g);   // gone to seed: only in the longest grass
    if (seeds) big *= 0.8;
    vec2 sd = (d0 - vec2(0.1, 0.02) * big) / (vec2(0.5, clover ? 0.3 : 0.17) * big);
    shadow = max(shadow, (clover ? 0.5 : 1.) * (1. - smoothstep(0.2, 1.1, length(sd))));
    if (clover) {
      // two little trefoils, three round leaves each, lying flat (squashed by the view), lit from the top left
      vec2 leaf = vec2(cos(6.283 * a.z), sin(6.283 * a.z));
      for (int k = 0; k < 6; k++) {
        float j = float(k / 3);
        if (k == 3) leaf = vec2(leaf.y, -leaf.x);                      // the second sprig turned a quarter
        vec2 ctr = base + j * vec2(0.22, -0.07) * big;
        float r = 0.15 * big * (1. - 0.25 * j);
        vec2 lc = ctr + vec2(leaf.x, 0.75 * leaf.y) * r * 0.95;
        leaf = vec2(-0.5 * leaf.x - 0.866 * leaf.y, 0.866 * leaf.x - 0.5 * leaf.y);   // a third of a turn to the next leaf
        vec2 d = (p - lc) / (vec2(1., 0.75) * r);
        float f = length(d), aa = px / r;
        float cov = 1. - smoothstep(1. - aa, 1. + aa, f);
        if (cov <= 0.) continue;
        float key = lc.y - (cov < 0.5 ? 100. : 0.);
        cover = max(cover, cov);
        if (key > front) { front = key; kind = 2.; roll = a.y; shade = clamp(0.15 - 0.55 * dot(d, vec2(0.55, 0.75)) - 0.35 * f * f, -1., 1.); }
      }
      continue;
    }
    if (dot(d0, d0) > big * big * (seeds ? 2.6 : 1.5)) continue;   // past its longest blade
    // the blades fan out from the first, each turned a step further (a turn, not a sine, each)
    float lean = 0.2 * (a.x - 0.5) - (seeds ? 0.44 : 0.76);
    vec2 dir = vec2(sin(lean), -cos(lean)), turn = seeds ? vec2(0.9759, 0.2182) : vec2(0.9287, 0.3709);
    for (int k = 0; k < 5; k++) {
      float fk = float(k) - 2., r = fract(a.z * 13.7 + fk * 0.37);
      if (k > 0) dir = vec2(dir.x * turn.x - dir.y * turn.y, dir.x * turn.y + dir.y * turn.x);
      if (seeds && abs(fk) > 1.5) continue;                          // three stalks
      vec2 foot = base + vec2(fk * 0.045 * big, 0.);
      float L = big * (1. - 0.14 * abs(fk)) * (0.85 + 0.3 * r) * (seeds ? 1.35 : 1.);
      vec2 d = p - foot;
      float t = dot(d, dir) / L;
      if (t < -0.1 || t > 1.) continue;
      float v = dot(d, vec2(-dir.y, dir.x)) - sign(fk + 0.01) * 0.12 * L * t * t;   // the blade curving out
      float w = seeds ? (t < 0.68 ? 0.022 * big : 0.075 * big * sin(3.1416 * (t - 0.68) / 0.32 * 0.97 + 0.05))
                      : 0.1 * big * 2.6 * sqrt(max(t + 0.05, 0.)) * (1. - t);
      w = max(w, 0.6 * px);
      float cov = 1. - smoothstep(w - px, w + px, abs(v));
      if (cov <= 0.) continue;
      float key = base.y + 0.001 * (2. - abs(fk)) - (cov < 0.5 ? 100. : 0.);
      cover = max(cover, cov);
      if (key > front) {
        front = key;
        bool head = seeds && t > 0.68;
        kind = head ? 1. : 0.; roll = a.y;
        shade = head ? 0.4 * clamp(-v / max(w, 1e-4), -1., 1.) + 0.3 * (t - 0.84) / 0.16
                     : -0.55 + 1.45 * t + 0.3 * clamp(-v / max(w, 1e-4), -1., 1.) - 0.12 * fk;
      }
    }
  }
  return vec4(cover, clamp(shade, -1., 1.), shadow, kind + 0.9 * roll);
}
#endif

void main() {
  vec2 at = ((vec2(gl_FragCoord.x, top - gl_FragCoord.y) / dpr) - off) / zoom;    // in tiles (top: the canvas's height)
  // Near the edges the meadow fades into the mist, in big pale clouds; past them (zoomed right out, or looking a
  // little past the bottom) it goes on, mirrored, until the mist is thick. How thick it is is game.js's mistField.
  float m = texture(mist, (at + mistOut) / (size + 2. * mistOut)).r;
  vec3 fogC = fog;
  if (m > 0.) fogC = mix(fog, min(fog * 1.04 + 0.04, 1.), smoothstep(0.4, 0.8, fbm(at * 0.03 + 950.)));
  if (m > 0.996) { o = vec4(fogC, 1.); return; }
  vec2 p = size - abs(size - abs(at));                           // the meadow, mirrored back in from past its edges
  float px = 1. / (zoom * dpr);
  vec2 q = p + seed;                                              // the same noise, moved for each meadow

  vec4 T = smooth4(tile, p), B = texture(bloom, p / size), H = smooth4(shape, p), F = smooth4(water, p);
  float g = clamp(T.r, 0., 1.), wet = clamp(T.g * 2., 0., 1.), height = clamp(H.r, 0., 1.);
  float n1 = fbm(q * 0.35), n2 = fbm(q * 1.7 + 31.);
  float toWater = H.g + 0.9 * (n2 - 0.5) + 0.8 * (n1 - 0.5);     // a wobbly shore

#if GV == 0
  // Where it is: damp by the water, dry up high and in big drifts, shaded by the woods.
  float moist = exp(-max(toWater, 0.) / 4.);
  float dry = clamp(0.4 * height + 0.75 * (fbm(q * 0.03 + 5.) - 0.5) - 0.6 * moist + 0.2, 0., 1.);
  // Golden only as far as the season's grass is green: winter's grey-green would turn sickly yellow.
  float hue = clamp((max(high.r, max(high.g, high.b)) - min(high.r, min(high.g, high.b))) / 0.35, 0., 1.);
  vec3 green = high, lush = green * vec3(0.84, 0.95, 0.9), golden = green * mix(vec3(1.), vec3(1.16, 1.07, 0.62), hue);
  vec3 grass = mix(lush, green, smoothstep(0.05, 0.45, dry));
  grass = mix(grass, golden, smoothstep(0.45, 0.85, dry));
  grass = mix(grass, grass * vec3(0.82, 0.94, 0.98), 0.45 * exp(-H.b / 3.));   // cool shade by the woods
  grass *= 1. - 0.08 * exp(-max(toWater, 0.) / 1.4);             // wet grass along the water
  // The Dry Year: straw where the sim says it's parched (away from the water, and from a hedge's lane), its edge wobbling a
  // little finer than the tiles, bare baked earth in patches, and a lush ring where it's spared. The ring reads green at once
  // round a pond just dug or along a hedge just planted, however short the sim's grass is there (it grows back after).
  float parch = 0.;
  if (drought > 0.) {
    float raw = smooth4(parched, p).r;
    parch = clamp(raw + DRY_WOBBLE * (fbm(q * 0.3 + 520.) - 0.5) * smoothstep(0., 0.15, raw), 0., 1.);
    float ring = drought * (1. - smoothstep(0.03, 0.3, parch / drought)) * (1. - smoothstep(0.2, 0.7, H.a));
    float bald = smoothstep(0.42, 0.72, fbm(q * 0.45 + 600.));             // where the bare earth shows first
    vec3 straw = mix(DRY_STRAW, DRY_OLIVE, smoothstep(0.35, 0.75, fbm(q * 0.25 + 640.)) * 0.55);
    grass = mix(mix(grass, straw, parch), lush * vec3(0.92, 1.04, 0.9), DRY_LUSH * ring);
    g = mix(g * (1. - DRY_THIN * parch * bald), max(g, DRY_GREEN), ring);
  }
  float clover = 0.4 * smoothstep(0.55, 0.75, fbm(q * 0.28 + 90.)) * clamp(0.4 + moist - dry, 0., 1.) * (1. - parch);
  grass = mix(grass, grass * vec3(0.8, 0.9, 0.86), 0.8 * clover);
  vec3 earth = mix(low * vec3(0.95, 0.93, 0.9), low * vec3(0.66, 0.6, 0.55), moist);
  if (parch > 0.) earth = mix(earth, DRY_EARTH, parch);

  // The grass itself, over the earth, with a nibbled edge.
  vec3 col = mix(earth, grass, smoothstep(0., 1., clamp(g + 0.15 * (n2 - 0.5), 0., 1.))) * (0.97 + 0.06 * n1);
  if (drought > 0.) col = mix(col, mix(DRY_MUD, DRY_EARTH, smoothstep(0.5, 3., toWater)) * (0.92 + 0.16 * n2), drought * smoothstep(0.2, 0.7, H.a));
  float detail = clamp((zoom - 12.) / 6., 0., 1.);               // further out the tufts would only read as speckle

  // A thin edge of wet moss along the water, fuller here and there. Not tan: tan is grazed ground.
  float cove = smoothstep(0.4, 0.65, fbm(q * 0.5 + 70.));
  col = mix(col, grass * vec3(0.62, 0.72, 0.64), 0.7 * (1. - smoothstep(0.1, 0.8, toWater)) * mix(0.35, 1., cove));
  col *= 0.95 + 0.1 * height;
  // A painterly surface: every tile a touch lighter or darker, warm and cool patches, a fine grain up close.
  col *= 1. + 0.07 * (noise(q * 1.1 + 200.) - 0.5) + 0.035 * (noise(q * 3.1 + 250.) - 0.5);
  col += vec3(1., 0.33, -1.) * 0.035 * (fbm(q * 0.22 + 300.) - 0.5);
  // Zoomed out, brush dabs where the grass is thick; zoomed in, the tufts take over.
  float brush = clamp((zoom - 4.) / 4., 0., 1.) * (1. - clamp((zoom - 11.) / 3., 0., 1.)) * smoothstep(0.3, 0.9, g);
  if (brush > 0.) col *= 1. + 0.12 * brush * dabs(q, px);
  if (detail > 0.) {
    col *= 1. + 0.06 * detail * (noise(q * 13. + 400.) - 0.5 + 0.6 * (noise(q * 29. + 500.) - 0.5));
    vec2 tf = tufts(p, px);
    col = mix(col, grass * mix(vec3(0.7, 0.82, 0.68), vec3(0.86, 0.94, 0.82), tf.y), 0.85 * detail * tf.x);
    // A pebble here and there, more on bare earth: one to a cell at most, lit from the top left.
    vec2 pc = floor(p / 0.7);
    vec4 ph = hash4(pc + seed + 13.3);
    if (ph.x < 0.03 + 0.1 * (1. - g) * (1. - g)) {
      vec2 c = (pc + 0.2 + 0.6 * ph.yz) * 0.7, rr = vec2(0.05 + 0.06 * ph.w) * vec2(1., 0.7);
      vec2 d = (p - c) / rr;
      float f = length(d), aa = px / rr.x * 1.5;
      col *= 1. - 0.25 * detail * (1. - smoothstep(0.8, 1.3, length((p - c - vec2(0.012, 0.018)) / rr)));   // its shadow
      vec3 stone = mix(vec3(0.6, 0.58, 0.54), vec3(0.74, 0.69, 0.6), ph.w) * (0.9 - 0.18 * clamp(d.x + d.y, -1., 1.));
      col = mix(col, stone, detail * (1. - smoothstep(1. - aa, 1. + aa, f)));
    }
  }
  col = col * (1. - B.a) + B.rgb;                                // a flower field in bloom
  col = mix(col, vec3(74., 66., 60.) / 255., T.b * (1. - g) * 0.85);   // burnt, until the grass returns
  float s = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.9) : 0.;
  col = mix(col, vec3(246., 248., 252.) / 255., s);             // snow settles in patches first
  col *= damp * (1. - 0.3 * T.a) * (1. - 0.1 * wet);

  // The sun on the slopes: lighter where the ground falls toward it, gently. Water lies flat.
  vec2 e = vec2(1., 0.);
  float east = texture(shape, (p + e.xy) / size).r - texture(shape, (p - e.xy) / size).r;
  float south = texture(shape, (p + e.yx) / size).r - texture(shape, (p - e.yx) / size).r;
  col *= 1. + (1. - wet) * clamp((east * lx + south * ly) * 0.4, -0.1, 0.1);

#else
  // ---- The new grass (GV 1 to 4). Same inputs as today's; the water after it is today's.
  float hue = clamp((max(high.r, max(high.g, high.b)) - min(high.r, min(high.g, high.b))) / 0.35, 0., 1.);
  LIT = mix(vec3(1.07, 1.07, 1.05), vec3(1.17, 1.16, 0.62), hue); LIT_ADD = vec3(0.035, 0.055, 0.) * hue;
  DEEP = mix(vec3(0.76, 0.82, 0.88), vec3(0.42, 0.64, 0.68), hue);

  // Where it is: deeper and cooler by the water and the woods, golden up high and in big drifts, and broad warm and
  // cool washes over it all, like watercolour laid wet: the hue moves, the grass stays saturated.
  float moist = exp(-max(toWater, 0.) / 4.);
  float dry = clamp(0.45 * height + 0.8 * (fbm(q * 0.03 + 5.) - 0.5) - 0.6 * moist + 0.2, 0., 1.);
  vec3 grass = high, golden = high * mix(vec3(1.), vec3(1.2, 1.06, 0.5), hue);
  grass = mix(grass, golden, smoothstep(0.4, 0.85, dry));
  float cool = max(0.85 * moist, 0.75 * exp(-H.b / 3.));
  grass = mix(grass, grass * mix(vec3(0.94), vec3(0.8, 0.93, 0.96), hue), cool);
  float wash = 0.65 * noise(q * 0.07 + 300.) + 0.35 * noise(q * 0.16 + 310.) - 0.5;
  grass *= 1. + vec3(0.16, 0.06, -0.16) * wash * hue;
  grass = max(mix(vec3(dot(grass, vec3(0.3, 0.59, 0.11))), grass, 1. + 0.3 * hue), 0.);   // more colour, never greyer
  vec3 lush = grass * vec3(0.84, 0.95, 0.9);
  vec3 longC = lush;                                             // the long grass's own colour, before its light

  // The Dry Year, as today: straw where the sim says it's parched, a lush ring where it's spared.
  float parch = 0.;
  if (drought > 0.) {
    float raw = smooth4(parched, p).r;
    parch = clamp(raw + DRY_WOBBLE * (fbm(q * 0.3 + 520.) - 0.5) * smoothstep(0., 0.15, raw), 0., 1.);
    float ring = drought * (1. - smoothstep(0.03, 0.3, parch / drought)) * (1. - smoothstep(0.2, 0.7, H.a));
    float bald = smoothstep(0.42, 0.72, fbm(q * 0.45 + 600.));
    vec3 straw = mix(DRY_STRAW, DRY_OLIVE, smoothstep(0.35, 0.75, fbm(q * 0.25 + 640.)) * 0.55);
    grass = mix(mix(grass, straw, parch), lush * vec3(0.92, 1.04, 0.9), DRY_LUSH * ring);
    g = mix(g * (1. - DRY_THIN * parch * bald), max(g, DRY_GREEN), ring);
    longC = mix(lush, grass * vec3(0.94, 0.95, 0.9), clamp(parch + DRY_LUSH * ring, 0., 1.));
  }

  // How long the grass is (what the rabbits eat): long meadow grass; short grass where it's grazed, paler and sunnier,
  // straw-coloured as it gets shorter; bare earth only where it's bitten right down. The edges ragged, finer than a tile.
  float ragC = 0.15 * (noise(q * 0.9 + 40.) - 0.5) + 0.1 * (noise(q * 2.1 + 43.) - 0.5), rag = ragC + 0.05 * (noise(q * 4.7 + 45.) - 0.5);
  float gw = clamp(g + rag, 0., 1.);
  float fine = clamp((zoom - 10.) / 6., 0., 1.);                 // up close: brushwork; further out it'd only read as speckle
  float far = 1. - clamp((zoom - 8.) / 6., 0., 1.);
  float tall = smoothstep(0.46, 0.64, gw), turf = smoothstep(0.06, 0.2, gw);
  vec3 earth = low * mix(vec3(0.97, 0.97, 0.98), vec3(0.93, 0.85, 0.72), hue) * (1. - 0.3 * moist);
  if (parch > 0.) earth = mix(earth, DRY_EARTH, parch);
  vec3 lawn = mix(tone(grass, 0.3), low * mix(vec3(1.), vec3(1.02, 1.0, 0.9), hue), 0.22 + 0.15 * far + 0.45 * (1. - smoothstep(0.16, 0.48, gw)));   // (paler from afar, so it reads)
  if (parch > 0.) {
    lawn = mix(lawn, grass, parch);
    turf = mix(turf, smoothstep(-0.2, 0.5, gw), parch);
  }
  // The long grass's edge, toward the sun: where it stands higher than the short grass by it, a light along its top
  // and a soft shadow falling on the lawn below. (One more look at the grass a little way toward the sun.)
  // (Its slope from the pixels about it: dFdx and dFdy, in tiles, and toward the sun.)
  // (Only the coarser wobble: the finest would make the light along it jagged.)
  float tallC = smoothstep(0.46, 0.64, clamp(g + ragC, 0., 1.));
  float rise = dot(vec2(dFdx(tallC), -dFdy(tallC)) / px, normalize(vec2(-0.55, -0.75)));   // (screen y runs up)
  float castOn = clamp(-0.45 * rise, 0., 1.), rimOf = clamp(0.45 * rise, 0., 1.);

  vec3 col;
#if GV == 1
  // A: TUSSOCKS, PAINTED. The long grass sculpted into soft mounds a tile or two across, in drifts with smoother meadow
  // between, lit like the trees' leaf clumps (the top left in the light, a deep green low down), then painted over
  // in dabs from shade to light.
  float tus = smoothstep(0.3, 0.7, fbm(q * 0.13 + 690.));
  float relief = tall * (0.45 + 0.55 * smoothstep(0.64, 1., gw)) * (0.35 + 0.65 * tus) * (0.4 + 0.6 * clamp((zoom - 6.) / 12., 0., 1.));
  vec3 sw = swells(q, 0.5);
  float l = clamp(lightOf(sw, 2.2 * relief) + 0.12, -0.7, 1.);
  vec3 meadow = tone(longC, l);
  if (fine > 0.) {
    float lean = 0.8 * (noise(q * 0.25 + 90.) - 0.5);
    vec2 db = dabs2(p, px, 0.34, 0.5, 0.09, lean, 0.35 + 0.65 * tall);
    meadow = mix(tone(longC, l - 0.1 * fine), tone(longC, l + 0.22 * db.y), db.x * fine);
  }
  col = mix(lawn, meadow, tall);
#elif GV == 2
  // B: CARTOON TUFTS. A soft meadow of colour with big gentle swells of light; on it, cartoon tufts in drifts, each
  // shaded like an emoji and standing on its own soft shadow. Calm between, busy only where the drifts are.
  float l = clamp(lightOf(swells(q, 0.2), 1.6), -1., 1.);
  vec3 meadow = tone(longC, 0.12 + 0.55 * l);
  col = mix(lawn, meadow, tall);
  if (fine > 0.) {
    vec3 tf = tufts2(p, px, 0.);
    col *= 1. - 0.22 * fine * tf.z * (1. - tf.x);
    col = mix(col, tone(longC, tf.y), tf.x * fine);
  }
#elif GV == 3
  // C: COMBED BY THE WIND. The long grass lies in strands along a slow flow, with broad bands of sheen across it
  // where the wind has laid it over; moss by the water, short bright lawn where it's grazed.
  float ang = 0.55 + 1.1 * (fbm(q * 0.045 + 800.) - 0.5);
  vec2 fdir = vec2(cos(ang), sin(ang));
  float warp = 2.2 * (fbm(q * 0.12 + 820.) - 0.5);
  float s = dot(p, vec2(-fdir.y, fdir.x)) + warp, t = dot(p, fdir);
  float sheen = sin(s * 1.6 + 3. * fbm(q * 0.18 + 840.)) * 0.5 + 0.5;
  sheen = smoothstep(0.25, 0.95, sheen) * (0.6 + 0.4 * smoothstep(0.64, 1., gw));
  vec3 meadow = tone(longC, -0.25 + 0.75 * sheen);
  if (fine > 0.) {
    vec2 st = strands(s, t, px);
    meadow = mix(meadow, tone(longC, -0.3 + 0.75 * sheen + 0.35 * st.y), st.x * fine * 0.85);
  }
  col = mix(lawn, meadow, tall);
#elif GV == 5
  // B+: THE MEADOW. As B, with more in it: the swells move the hue too (the hollows a deeper, cooler green, the
  // rises sunnier), drifts of tufts with clover on the short grass and seed heads in the longest, and further out,
  // where the tufts are too small to draw, the long grass's texture as soft tussocks.
  // The longer the grass, the deeper and richer its green (it shades itself); shorter, it's lighter and sunnier.
  // That is the sim's grass, so the meadow's light and dark tell where the rabbits have been at it.
  vec3 sw = swells(q, 0.2);
  float l = clamp(lightOf(sw, 1.1), -1., 1.), longer = smoothstep(0.62, 1., gw);
  vec3 meadow = tone(longC * mix(vec3(0.96, 1.0, 1.03), vec3(1.04, 1.01, 0.95), sw.x), 0.35 + 0.4 * l - 0.35 * longer);
  if (far > 0.) meadow = tone(meadow, 0.5 * lightOf(swells(q, 0.75), 1.2) * far * smoothstep(0.64, 0.9, gw));
  // A faint mottle in it, a tile or so across and finer, so it never looks like plastic: lime and emerald, not grey.
  // (The same noise that rags the grass's edge: it costs nothing more.)
  meadow = tone(meadow, 1.1 * rag);
  col = mix(lawn, meadow, tall);
#else
  // D: WATERCOLOUR. Washes laid wet, the long grass a deeper wash than the lawn with the pigment pooled dark along
  // its edge, granulation in the hollows of the paper, and a few dry-brush dabs where it's longest.
  float pool = smoothstep(0.08, 0.5, tall) * (1. - smoothstep(0.5, 0.95, tall));
  float gran = noise(q * 4.5 + 870.) * 0.6 + noise(q * 11. + 880.) * 0.4;
  float bloomW = fbm(q * 0.5 + 860.);
  vec3 meadow = tone(longC, 0.25 * (bloomW - 0.5) * 2. - 0.05);
  col = mix(lawn, meadow, tall);
  col = mix(col, tone(longC, -0.75), 0.4 * pool);
  col *= 1. - 0.07 * smoothstep(0.45, 0.8, gran) * (0.4 + 0.6 * tall);
  if (fine > 0.) {
    vec2 db = dabs2(p, px, 0.5, 0.55, 0.1, 0.25, 0.55 * smoothstep(0.7, 1., gw));
    col = mix(col, tone(longC, -0.35 + 0.25 * db.y), 0.5 * db.x * fine);
  }
#endif
  // The light along the long grass's sunny edge, and its shadow on the short grass below.
  col = mix(col, tone(longC, 0.8), 0.2 * rimOf);
  col = mix(col, col * DEEP, 0.3 * castOn);
  col = mix(earth, col, turf);
  if (turf < 1.) col *= 1. - 0.05 * (1. - turf) * noise(q * 2.2 + 900.);   // the earth a little uneven
  // Wet mud where the Dry Year's water has drawn back past any summer's line (the shape's 4th).
  if (drought > 0.) col = mix(col, mix(DRY_MUD, DRY_EARTH, smoothstep(0.5, 3., toWater)) * (0.92 + 0.16 * n2), drought * smoothstep(0.2, 0.7, H.a));

  // A thin edge of wet moss along the water, fuller here and there: a deep cool green, never tan.
  float cove = smoothstep(0.4, 0.65, 0.62 * noise(q * 0.5 + 70.) + 0.38 * noise(q * 1.1 + 75.));
  col = mix(col, tone(grass * vec3(0.78, 0.92, 0.9), -0.5), 0.65 * (1. - smoothstep(0.1, 0.8, toWater)) * mix(0.35, 1., cove));
  col *= 0.96 + 0.08 * height;

  col = col * (1. - B.a) + B.rgb;                                // a flower field in bloom
  col = mix(col, vec3(74., 66., 60.) / 255., T.b * (1. - g) * 0.85);   // burnt, until the grass returns
  // Snow settles in patches first, on the long grass's sunny tops before its hollows; blue in the shade.
  float s0 = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.92) : 0.;
  col = mix(col, mix(vec3(0.8, 0.86, 0.96), vec3(246., 248., 252.) / 255., 0.6 + 0.4 * (1. - castOn)), s0);
#if GV == 5
  // The tufts go on last, over the snow: frosted, they stand out of it till it's deep.
  if (fine > 0.) {
    // seed heads while the grass is green or golden; clover only while it's green (spring and summer)
    float drift = smoothstep(0.3, 0.7, noise(q * 0.3 + 760.));
    vec4 tf = tufts3(p, px, drift, hue, hue * smoothstep(1.2, 1.5, high.g / max(high.r, 0.01)));
    float stand = fine * (1. - smoothstep(0.45, 0.85, s0));
    // Each tuft a touch of its own: warmer or cooler, and in autumn some gone russet.
    float kind = floor(tf.w), own = fract(tf.w) / 0.9;
    vec3 tint = mix(vec3(0.94, 1.0, 1.05), vec3(1.06, 1.0, 0.92), own);
    float autumn = hue * smoothstep(0.9, 1.2, high.r / max(high.g, 0.01));
    if (autumn > 0. && tf.x > 0.) tint = mix(tint, vec3(1.2, 0.86, 0.66), autumn * smoothstep(0.55, 0.7, noise(q * 0.18 + 790.)) * step(0.35, own));   // russet in patches
    vec3 tc = tone(longC * tint, tf.y);
    if (kind > 1.5) tc = tone(longC * vec3(0.84, 0.97, 1.0), tf.y - 0.1);            // clover: a cooler, bluer green
    else if (kind > 0.5) tc = tone(mix(longC, golden * mix(vec3(1.1, 1.0, 0.8), vec3(1.15, 0.75, 0.5), autumn), 0.7), tf.y);   // a seed head: straw gold, russet in autumn
    tc = mix(tc, mix(vec3(0.84, 0.9, 0.97), vec3(0.97), 0.5 + 0.5 * tf.y), 0.75 * s0);
    col *= 1. - 0.22 * stand * tf.z * (1. - tf.x);
    col = mix(col, tc, tf.x * stand);
  }
#endif
  col *= damp * (1. - 0.3 * T.a) * (1. - 0.1 * wet);

  // The sun on the slopes: lighter where the ground falls toward it, gently. Water lies flat.
  vec2 e = vec2(1., 0.);
  float east = texture(shape, (p + e.xy) / size).r - texture(shape, (p - e.xy) / size).r;
  float south = texture(shape, (p + e.yx) / size).r - texture(shape, (p - e.yx) / size).r;
  col *= 1. + (1. - wet) * clamp((east * lx + south * ly) * 0.4, -0.1, 0.1);
#endif

  // The water, in soft layers: damp sand fading into the grass, a little shade under the
  // bank, shallows, and a darker blue where it gets too deep to wade. Slate in the cold
  // months, and snow freezes it over.
  vec3 frozen = vec3(214., 232., 242.) / 255.;
  vec3 bank = mix(vec3(104., 170., 208.), vec3(100., 135., 160.), cold) / 255.;
  vec3 shallow = mix(vec3(130., 200., 235.), vec3(142., 172., 188.), cold) / 255.;
  vec3 deep = mix(vec3(84., 156., 214.), vec3(82., 114., 138.), cold) / 255.;
  vec3 sandC = mix(sand, frozen, ice), bankC = mix(bank, frozen, ice);
  vec3 shallowC = mix(shallow, frozen, ice), deepC = mix(deep, frozen, ice);
  float edge = max(fwidth(F.r) * 0.7, 1e-4);
  col = mix(col, sandC, layers(F.b, 0.03, 0.42, 9., 0.07));
  col = mix(col, bankC, smoothstep(0.47 - edge, 0.47 + edge, F.r));   // the water's edge stays crisp
  col = mix(col, shallowC, layers(F.g, 0.54, 0.8, 7., 0.2));
  col = mix(col, deepC, layers(F.a, 0.3, 1., 9., 0.07));
  // A touch deeper well out from the shore, where the deep water is wide: gently, or from afar
  // it reads as a dark hole in the lake.
  vec3 abyss = mix(mix(vec3(60., 124., 188.), vec3(70., 100., 126.), cold) / 255., frozen, ice);
  col = mix(col, abyss, 0.25 * smoothstep(0.5, 1., F.a * F.b));
  // A pale line just in from the edge, where the water laps the bank.
  col = mix(col, vec3(226., 244., 250.) / 255., 0.45 * (1. - ice) * (smoothstep(0.47 - edge, 0.47 + edge, F.r) - smoothstep(0.49, 0.53, F.r)));
  // A painted surface: long soft strokes across open water, a touch lighter or darker, and the sun
  // lighter on the shallows just in from the edge. Ice stills it.
  float open = smoothstep(0.47, 0.6, F.r) * (1. - ice);
  if (open > 0.) {
    float stroke = noise(vec2(q.x * 0.8, q.y * 3.6) + 600.) - 0.5, mottle = fbm(q * 0.45 + 650.) - 0.5;
    col *= 1. + open * (0.08 * stroke + 0.05 * mottle);
    col = mix(col, min(shallowC * 1.1 + 0.04, 1.), open * 0.3 * (1. - smoothstep(0.5, 0.72, F.g)));
  }

  col = mix(col, fogC, m);
  o = vec4(col, 1.);
}`;

let ok = !!gl, U = {}, textures = {}, shader, mistOut = 0;
if (gl) {
  shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG(GV0)));
    gl.bindAttribLocation(prog, 0, 'a');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over the screen
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog, i).name; U[name] = gl.getUniformLocation(prog, name); }
    [['tile', 0], ['bloom', 1], ['shape', 2], ['water', 3], ['parched', 5]].forEach(([name, unit]) => {   // (4: the mist)
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, S.W, S.H, 0, gl.RGBA, gl.FLOAT, null);
      gl.uniform1i(U[name], unit);
      textures[name] = { unit, t };
    });
    gl.uniform2f(U.size, S.W, S.H); gl.uniform1i(U.mist, 4);   // (no mist until Ground.mist: unit 4 reads 0)
  } catch (e) {
    console.warn('The ground shader would not start:', e);
    ok = false;
  }
}

// How thick the mist is (a byte a texel, w by h over the meadow and out past its edges, out tiles all round).
// Once: it never changes.
function mist(data, w, h, out) {
  stale = true;
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.uniform1f(U.mistOut, out); mistOut = out;
}

function set(name, data) {
  stale = true;
  const { unit, t } = textures[name];
  gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S.W, S.H, gl.RGBA, gl.FLOAT, data);
}

// What the last draw painted. The camera must match exactly; the light and the season only
// nearly, so the sun going over paints a few times a second instead of every frame. (A step of 0.08
// in lx or ly moves the slopes' light by well under one colour level.)
//
// Following an animal moves the camera every frame. Then the ground is painted with a margin of PAD
// CSS pixels all round, and while the screen stays inside it, it is only copied from further along,
// in whole pixels. Not while something else makes it paint often anyway (the light at 15x or 60x, a
// zoom): the margin would only make every paint bigger.
const PAD = 64;
let last = null, stale = true, busy = 0, panned = -1e9;   // busy: how often lately more than the camera moved
const NEAR = { drought: 0.004, snow: 0.004, damp: 0.002, ice: 0.004, cold: 0.004, lx: 0.08, ly: 0.08 };
const EXACT = ['width', 'height', 'zoom', 'dpr'];
const was = { ox: 0, oy: 0 }, view = { x: 0, y: 0 };
function steady(u) {                                    // all but where the camera is
  if (stale || !last || u.seed[0] !== last.seed[0] || u.seed[1] !== last.seed[1]) return false;
  for (const k of EXACT) if (u[k] !== last[k]) return false;
  for (const k in NEAR) if (Math.abs(u[k] - last[k]) > NEAR[k]) return false;
  for (const k of ['low', 'high', 'sand', 'fog']) for (let i = 0; i < 3; i++) if (Math.abs(u[k][i] - last[k][i]) > 0.5) return false;
  return true;
}
const within = (d, pad, dpr) => d === 0 || Math.abs(d) <= pad - 1 / dpr;

//   width, height   the screen, in the canvas's pixels
//   zoom, ox, oy    CSS pixels a tile, and where the meadow's corner lands
//   the rest        see the uniforms in the shader
function draw(u) {
  const now = performance.now();
  if (u.ox !== was.ox || u.oy !== was.oy) panned = now;
  was.ox = u.ox; was.oy = u.oy;
  const still = steady(u);
  busy = busy * 0.95 + (last && !still ? 0.05 : 0);
  if (still && within(last.ox - u.ox, last.pad, u.dpr) && within(last.oy - u.oy, last.pad, u.dpr)) {
    view.x = Math.round((last.pad + last.ox - u.ox) * u.dpr); view.y = Math.round((last.pad + last.oy - u.oy) * u.dpr);
    return false;
  }
  const most = Math.round(PAD * u.dpr), cw = u.width + 2 * most, ch = u.height + 2 * most;
  const m = now - panned < 1000 && busy < 0.5 ? most : 0, pad = m / u.dpr;
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  gl.viewport(0, ch - u.height - 2 * m, u.width + 2 * m, u.height + 2 * m);   // the canvas's top left
  gl.uniform1f(U.top, ch);
  gl.uniform2f(U.off, u.ox + pad, u.oy + pad); gl.uniform2fv(U.seed, u.seed);
  for (const k of ['zoom', 'dpr', 'snow', 'damp', 'lx', 'ly', 'ice', 'cold', 'drought']) gl.uniform1f(U[k], u[k]);
  for (const k of ['low', 'high', 'sand', 'fog']) gl.uniform3fv(U[k], u[k].map(v => v / 255));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  last = { ...u, pad }; stale = false; view.x = view.y = m;
  return true;
}

// A lost context (the GPU reset) takes the shader with it: from then on game.js draws plain colours.
canvas.addEventListener('webglcontextlost', () => { ok = false; });

// Scratch: another variant of the shader, painting the same textures.
const progs = {};
function useGV(n) {
  let prog = progs[n];
  if (!prog) {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG(n)));
    gl.bindAttribLocation(prog, 0, 'a');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    progs[n] = prog;
  }
  gl.useProgram(prog);
  U = {};
  const k = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < k; i++) { const name = gl.getActiveUniform(prog, i).name; U[name] = gl.getUniformLocation(prog, name); }
  for (const name in textures) gl.uniform1i(U[name], textures[name].unit);
  gl.uniform2f(U.size, S.W, S.H); gl.uniform1i(U.mist, 4); gl.uniform1f(U.mistOut, mistOut);
  stale = true;
  return n;
}

window.Ground = { _gv: useGV, get _last() { return last; }, get ok() { return ok; }, canvas, set, mist, draw, view };
})();
