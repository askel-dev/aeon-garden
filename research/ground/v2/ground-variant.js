/* Nobody's Meadow — the ground: grass, earth, shores and water, painted by a small WebGL shader.
 *
 * game.js hands over the meadow as a few tiny textures, one texel a tile, and the shader works
 * out every pixel on the screen. It paints again only when something it shows has moved (the
 * camera, a texture, the light), so the grass changes the moment it grows and the ground is sharp
 * at any zoom, but a still camera costs the GPU next to nothing. The look, from big to small,
 * saturated throughout: lights toward a near-pure lime, shade toward a deep emerald, never grey:
 *   - where it is: a cooler, deeper green by the water and the woods, golden up high and in big
 *     drifts, and broad warm and cool washes (the hue shifts, the grass stays bright);
 *   - the grass itself (what the rabbits eat): long meadow grass, deeper the longer it is; short
 *     grass where it's grazed, paler, sunnier and more straw-coloured; bare earth only where it's
 *     bitten right down. The long grass's edge is lit on the sun's side and shades the short below;
 *   - big soft swells of light over it, and from afar the long grass's texture as soft tussocks;
 *   - up close, tufts painted like the emoji, big in drifts and few between: fans of blades, some
 *     gone to seed, clover on short grass in spring and summer, frosted ones standing out of snow;
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

const FRAGMENT = `#version 300 es
precision highp float;
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

// How long the grass is, as game.js hands it over (0 to 1, eased up from the sim's: see paintTerrain).
#define LONG vec2(0.46, 0.64)             // from short grass to long, over this
#define BITTEN vec2(0.06, 0.2)            // from bare earth to short grass, over this
#define EDGE 0.45                         // how strongly the long grass's edge is lit on the sun's side, and shades the other
#define TUFT_SHADOW 0.22                  // how dark a tuft's shadow on the ground
#define RUSSET vec3(1.2, 0.86, 0.66)      // an autumn tuft gone russet, times its colour

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

// Four values from one hash, a byte each: cheaper than four hashes. (From the uint itself: a float
// keeps only 24 bits, and the lowest byte would come out 0.)
vec4 hash4(vec2 p) {
  uint h = hashu(p);
  return vec4(uvec4(h, h >> 8, h >> 16, h >> 24) & 255u) * (1. / 255.);
}

// n layers of a colour at alpha a each, stacked from level t0 to t1 of field f, as how much of
// the colour shows. Counted smoothly, so they make a gradient instead of steps.
float layers(float f, float t0, float t1, float n, float a) {
  return 1. - pow(1. - a, clamp((f - t0) / (t1 - t0) * (n - 1.) + 1., 0., n));
}

// The grass's colours: the season's (high) more saturated, then lit toward a near-pure lime or shaded toward a deep
// emerald, bluer. Winter's grey-green only gets lighter and darker: no lime in the frost.
#define SATURATE 0.3                      // how much more colour than the season's palette, in the green and golden seasons
#define LIME vec3(1.17, 1.16, 0.62)       // the grass in full sun, times its colour (and LIME_ADD)
#define LIME_ADD vec3(0.035, 0.055, 0.)
#define EMERALD vec3(0.42, 0.64, 0.68)    // in deep shade, times its colour
#define FROST_LIT vec3(1.07, 1.07, 1.05)  // the same two in winter
#define FROST_DEEP vec3(0.76, 0.82, 0.88)
vec3 LIT, LIT_ADD, DEEP;                  // this season's, set at the start of main from hue (how green the season is)
vec3 tone(vec3 c, float l) {              // l: -1 deep shade, 0 the colour itself, 1 full sun
  return l > 0. ? mix(c, c * LIT + LIT_ADD, min(l, 1.)) : mix(c, c * DEEP, min(-l, 1.));
}

// Value noise with its slope: (value, d/dx, d/dy). The light on a soft field without working it out again nearby.
// Quintic, so the light shows no creases along the noise's grid.
vec3 noised(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.), du = 30. * f * f * (f * (f - 2.) + 1.);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * (vec2(k1, k2) + k4 * u.yx));
}

// Soft swells, about 1/k tiles across, and smaller ones on them, turned against each other so no grid shows.
// Gives (height 0 to 1, its slope per tile).
const mat2 TURN = mat2(0.8, -0.6, 0.6, 0.8);
vec3 swells(vec2 q, float k) {
  vec3 a = noised(q * k + 700.), b = noised(TURN * q * (k * 2.3) + 720.);
  return vec3(0.62 * a.x + 0.38 * b.x, 0.62 * k * a.yz + 0.38 * k * 2.3 * (b.yz * TURN));
}
// The light comes from the top left, a little in front, as on the trees (trees.js L).
const vec3 SUN = vec3(-0.55, -0.75, 0.55) / 1.0817;
// How the swells are lit, relief times as high: -1 to 1, 0 flat. The higher catches more light too.
float lightOf(vec3 s, float relief) {
  vec3 n = normalize(vec3(-s.yz * relief, 1.));
  return (dot(n, SUN) - SUN.z) * 2.4 + (s.x - 0.5) * 0.9 * min(relief, 1.);
}

// Tufts, painted like the emoji: one to a cell at most. In the long grass a fan of five broad curved blades; in the
// longest, now and then, three thin stalks gone to seed, a head on each; on short grass in spring and summer two
// sprigs of clover. Deep at the foot, lime at the tips, the sun's side lighter, each on a soft shadow.
// Whether a cell has one is the cell's own (its grass and a roll). How big it is comes from the drift here (0 to 1, one
// look a pixel): big in the drifts, shrinking away between, and never cut off where the drift changes.
// seedy: how much the grass goes to seed this season, clovery how much clover shows.
// Gives (cover, shade -1 to 1, its shadow, kind: 0 a blade, 1 a seed head, 2 clover, plus 0.9 times the tuft's own roll).
#define TUFT_CELL vec2(0.85, 1.)          // tiles. A tuft stands at most 1.15 rows tall, or the row below would cut it off
#define TUFTS 0.75                        // the most cells that have one, in long grass
#define CLOVER 0.4                        // the same on short grass
#define TUFT_SIZE vec2(0.35, 0.3)         // tiles tall: the least, and how much more at most (times the drift's 0.55 to 1.25)
#define SEEDS 0.28                        // the share of tufts gone to seed in the longest grass
vec4 tufts(vec2 p, float px, float drift, float seedy, float clovery) {
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
    float big = (TUFT_SIZE.x + TUFT_SIZE.y * a.z) * (0.55 + 0.7 * grow);
    if (a.w > TUFTS || d0.y > 0.25 * big || d0.y < -big * 1.3 || abs(d0.x) > big) continue;   // (out of reach: no need to look)
    float g = texture(tile, base / size).r;
    float isLong = smoothstep(0.52, 0.72, g), isShort = clovery * smoothstep(0.2, 0.3, g) * (1. - smoothstep(0.4, 0.5, g));
    if (a.w > max(TUFTS * isLong, CLOVER * isShort)) continue;
    bool clover = isShort > isLong;
    bool seeds = !clover && a.z > 1. - SEEDS * seedy * smoothstep(0.8, 0.97, g);
    if (seeds) big *= 0.8;
    vec2 sd = (d0 - vec2(0.1, 0.02) * big) / (vec2(0.5, clover ? 0.3 : 0.17) * big);
    shadow = max(shadow, (clover ? 0.5 : 1.) * (1. - smoothstep(0.2, 1.1, length(sd))));
    if (clover) {
      // two little sprigs of three round leaves, lying flat (squashed by the view), lit from the top left
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
                      : 0.1 * big * 2.6 * sqrt(max(t + 0.05, 0.)) * (1. - t);   // round at the foot, widest low down, a point
      w = max(w, 0.6 * px);
      float cov = 1. - smoothstep(w - px, w + px, abs(v));
      if (cov <= 0.) continue;
      // the lower tuft in front, the middle blade on top; an edge only where nothing covers the pixel more
      float key = base.y + 0.001 * (2. - abs(fk)) - (cov < 0.5 ? 100. : 0.);
      cover = max(cover, cov);
      if (key > front) {
        front = key;
        bool head = seeds && t > 0.68;
        kind = head ? 1. : 0.; roll = a.y;
        // dark at the foot, light at the tip; the blade's sunny side lighter; the sun's side of the fan lighter
        shade = head ? 0.4 * clamp(-v / max(w, 1e-4), -1., 1.) + 0.3 * (t - 0.84) / 0.16
                     : -0.55 + 1.45 * t + 0.3 * clamp(-v / max(w, 1e-4), -1., 1.) - 0.12 * fk;
      }
    }
  }
  return vec4(cover, clamp(shade, -1., 1.), shadow, kind + 0.9 * roll);
}

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

  // The season's light and shade: lime and emerald while the grass is green or golden, plain lighter and darker in winter.
  float hue = clamp((max(high.r, max(high.g, high.b)) - min(high.r, min(high.g, high.b))) / 0.35, 0., 1.);
  LIT = mix(FROST_LIT, LIME, hue); LIT_ADD = LIME_ADD * hue; DEEP = mix(FROST_DEEP, EMERALD, hue);

  // Where it is: deeper and cooler by the water and the woods, golden up high and in big drifts, and broad warm and
  // cool washes over it all, like watercolour laid wet. The hue moves; the grass stays saturated.
  float moist = exp(-max(toWater, 0.) / 4.);
  float dry = clamp(0.45 * height + 0.8 * (fbm(q * 0.03 + 5.) - 0.5) - 0.6 * moist + 0.2, 0., 1.);
  vec3 grass = high, golden = high * mix(vec3(1.), vec3(1.2, 1.06, 0.5), hue);
  grass = mix(grass, golden, smoothstep(0.4, 0.85, dry));
  float cool = max(0.85 * moist, 0.75 * exp(-H.b / 3.));
  grass = mix(grass, grass * mix(vec3(0.94), vec3(0.8, 0.93, 0.96), hue), cool);
  float wash = 0.65 * noise(q * 0.07 + 300.) + 0.35 * noise(q * 0.16 + 310.) - 0.5;
  grass *= 1. + vec3(0.16, 0.06, -0.16) * wash * hue;
  grass = max(mix(vec3(dot(grass, vec3(0.3, 0.59, 0.11))), grass, 1. + SATURATE * hue), 0.);   // more colour, never greyer
  vec3 lush = grass * vec3(0.84, 0.95, 0.9), longC = lush;      // longC: the long grass's own colour, before its light

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
    longC = mix(lush, grass * vec3(0.94, 0.95, 0.9), clamp(parch + DRY_LUSH * ring, 0., 1.));
  }

  // How long the grass is (what the rabbits eat). Long meadow grass; where it's grazed, short grass, paler and sunnier and
  // more straw-coloured the shorter it is; bare earth only where it's bitten right down. The edges ragged, finer than a tile.
  float ragC = 0.15 * (noise(q * 0.9 + 40.) - 0.5) + 0.1 * (noise(q * 2.1 + 43.) - 0.5), rag = ragC + 0.05 * (noise(q * 4.7 + 45.) - 0.5);
  float gw = clamp(g + rag, 0., 1.);
  float fine = clamp((zoom - 10.) / 6., 0., 1.);                 // up close, the tufts; further out they'd only be speckle
  float far = 1. - clamp((zoom - 8.) / 6., 0., 1.);              // and from afar the tussocks, gone before a phone's opening zoom
  float tall = smoothstep(LONG.x, LONG.y, gw), turf = smoothstep(BITTEN.x, BITTEN.y, gw);
  vec3 earth = low * mix(vec3(0.97, 0.97, 0.98), vec3(0.93, 0.85, 0.72), hue) * (1. - 0.3 * moist);
  vec3 lawn = mix(tone(grass, 0.3), low * mix(vec3(1.), vec3(1.02, 1.0, 0.9), hue), 0.22 + 0.15 * far + 0.45 * (1. - smoothstep(0.16, 0.48, gw)));   // (paler from afar, so it reads)
  if (parch > 0.) {                                              // the straw stays straw, and the earth comes through it softly
    earth = mix(earth, DRY_EARTH, parch);
    lawn = mix(lawn, grass, parch);
    turf = mix(turf, smoothstep(-0.2, 0.5, gw), parch);
  }
  // The long grass's edge: lit along its top on the sun's side, and its shadow on the short grass below on the other.
  // Its slope comes from the pixels about it (dFdx, dFdy), without the finest wobble, or the light along it goes jagged.
  float tallC = smoothstep(LONG.x, LONG.y, clamp(g + ragC, 0., 1.));
  float rise = dot(vec2(dFdx(tallC), -dFdy(tallC)) / px, normalize(SUN.xy));   // (the screen's y runs up)
  float castOn = clamp(-EDGE * rise, 0., 1.), rimOf = clamp(EDGE * rise, 0., 1.);

  // The long grass: the longer, the deeper and richer its green (it shades itself), so its light and dark tell where the
  // rabbits have been at it; big soft swells over it move the light and the hue (the hollows cooler, the rises sunnier);
  // further out, where the tufts are too small to draw, its texture as soft tussocks; and a faint mottle at every zoom,
  // a tile or so across and finer, so it never looks like plastic (the same noise that rags the edge: it costs nothing).
  vec3 sw = swells(q, 0.2);
  float l = clamp(lightOf(sw, 1.1), -1., 1.), longer = smoothstep(0.62, 1., gw);
  vec3 meadow = tone(longC * mix(vec3(0.96, 1.0, 1.03), vec3(1.04, 1.01, 0.95), sw.x), 0.35 + 0.4 * l - 0.35 * longer);
  if (far > 0.) meadow = tone(meadow, 0.5 * lightOf(swells(q, 0.75), 1.2) * far * smoothstep(0.64, 0.9, gw));
  meadow = tone(meadow, 1.1 * rag);
  vec3 col = mix(lawn, meadow, tall);
  col = mix(col, tone(longC, 0.8), 0.2 * rimOf);
  col = mix(col, col * DEEP, 0.3 * castOn);
  col = mix(earth, col, turf);
  if (turf < 1.) col *= 1. - 0.05 * (1. - turf) * noise(q * 2.2 + 900.);   // the earth a little uneven
  // Wet mud where the Dry Year's water has drawn back past any summer's line (the shape's 4th).
  if (drought > 0.) col = mix(col, mix(DRY_MUD, DRY_EARTH, smoothstep(0.5, 3., toWater)) * (0.92 + 0.16 * n2), drought * smoothstep(0.2, 0.7, H.a));

  // A thin edge of wet moss along the water, fuller here and there: a deep cool green. Not tan: tan is grazed ground.
  float cove = smoothstep(0.4, 0.65, 0.62 * noise(q * 0.5 + 70.) + 0.38 * noise(q * 1.1 + 75.));
  col = mix(col, tone(grass * vec3(0.78, 0.92, 0.9), -0.5), 0.65 * (1. - smoothstep(0.1, 0.8, toWater)) * mix(0.35, 1., cove));
  col *= 0.96 + 0.08 * height;

  col = col * (1. - B.a) + B.rgb;                                // a flower field in bloom
  col = mix(col, vec3(74., 66., 60.) / 255., T.b * (1. - g) * 0.85);   // burnt, until the grass returns
  // Snow settles in patches first, a little blue where the long grass shades it.
  float s = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.92) : 0.;
  col = mix(col, mix(vec3(0.8, 0.86, 0.96), vec3(246., 248., 252.) / 255., 0.6 + 0.4 * (1. - castOn)), s);

  // The tufts go on last, over the snow: frosted, they stand out of it till it's deep. Seed heads while the grass is
  // green or golden; clover only while it's green (spring and summer: its green well over its red).
  if (fine > 0.) {
    float drift = smoothstep(0.3, 0.7, noise(q * 0.3 + 760.));
    vec4 tf = tufts(p, px, drift, hue, hue * smoothstep(1.2, 1.5, high.g / max(high.r, 0.01)));
    float stand = fine * (1. - smoothstep(0.45, 0.85, s));
    // Each a touch of its own, warmer or cooler; in autumn, in patches, some gone russet.
    float kind = floor(tf.w), own = fract(tf.w) / 0.9;
    vec3 tint = mix(vec3(0.94, 1.0, 1.05), vec3(1.06, 1.0, 0.92), own);
    float autumn = hue * smoothstep(0.9, 1.2, high.r / max(high.g, 0.01));
    if (autumn > 0. && tf.x > 0.) tint = mix(tint, RUSSET, autumn * smoothstep(0.55, 0.7, noise(q * 0.18 + 790.)) * step(0.35, own));
    vec3 tc = tone(longC * tint, tf.y);
    if (kind > 1.5) tc = tone(longC * vec3(0.84, 0.97, 1.0), tf.y - 0.1);            // clover: a cooler, bluer green
    else if (kind > 0.5) tc = tone(mix(longC, golden * mix(vec3(1.1, 1.0, 0.8), vec3(1.15, 0.75, 0.5), autumn), 0.7), tf.y);   // a seed head: straw gold, russet in autumn
    tc = mix(tc, mix(vec3(0.84, 0.9, 0.97), vec3(0.97), 0.5 + 0.5 * tf.y), 0.75 * s);   // frosted
    col *= 1. - TUFT_SHADOW * stand * tf.z * (1. - tf.x);
    col = mix(col, tc, tf.x * stand);
  }
  col *= damp * (1. - 0.3 * T.a) * (1. - 0.1 * wet);

  // The sun on the slopes: lighter where the ground falls toward it, gently. Water lies flat.
  vec2 e = vec2(1., 0.);
  float east = texture(shape, (p + e.xy) / size).r - texture(shape, (p - e.xy) / size).r;
  float south = texture(shape, (p + e.yx) / size).r - texture(shape, (p - e.yx) / size).r;
  col *= 1. + (1. - wet) * clamp((east * lx + south * ly) * 0.4, -0.1, 0.1);

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

let ok = !!gl, U = {}, textures = {};
if (gl) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT));
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
  gl.uniform1f(U.mistOut, out);
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

window.Ground = { get ok() { return ok; }, canvas, set, mist, draw, view };
})();
