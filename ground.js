/* Nobody's Meadow — the ground: grass, earth, shores and water, painted by a small WebGL shader.
 *
 * game.js hands over the meadow as a few tiny textures, one texel a tile, and the shader works
 * out every pixel on the screen. It paints again only when something it shows has moved (the
 * camera, a texture, the light), so the grass changes the moment it grows and the ground is sharp
 * at any zoom, but a still camera costs the GPU next to nothing. The look, from big to small,
 * in watercolour, saturated: lights toward a near-pure lime, shade toward a deep emerald, never grey:
 *   - where it is: a cooler, deeper green by the water and the woods, golden up high and in big
 *     drifts, and broad warm and cool washes (the hue shifts, the grass stays bright);
 *   - the grass itself (what the rabbits eat): long meadow grass, a deeper wash with the pigment
 *     pooled dark along its edge; short grass where it's grazed, paler, sunnier and more
 *     straw-coloured; bare earth only where it's bitten right down. The long grass's edge is lit on
 *     the sun's side and shades the short below;
 *   - the paper's grain over it all and, up close, a few dry-brush dabs in the longest grass;
 *   - the sun on the slopes, wet moss at the water's edge, then the water in soft layers,
 *     deepest well out from the shore, with long brushed strokes on its surface.
 *
 * Use: Ground.set(name, data) with a Float32Array of 4 values a tile: 'tile' (grass, water,
 * nothing, wood), 'bloom' (a field's tint times how much it shows, then how much), 'shape' (height,
 * tiles to the water, tiles to the woods, nothing) and 'water' (the water softened by 1, 2 and 4
 * blurs, and the deep water by 2), and once Ground.mist(...) with how thick the mist is near the
 * edges. Then Ground.draw(uniforms) paints Ground.canvas if it has to, all of it times its light
 * (white by day), and Ground.view says where in it the screen's corner is. game.js shows the canvas as a layer of its own
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
uniform sampler2D tile, bloom, shape, water, mist;
uniform vec2 size, off, seed;
uniform float top, zoom, dpr, snow, damp, lx, ly, ice, cold, mistOut;
uniform vec3 low, high, sand, fog;
uniform vec3 light;                      // what it's all lit by: white by day, warm in the golden hour (game.js goldLight)
out vec4 o;


// The grass, as the rabbits leave it, and how it's painted.
#define LONG vec2(0.46, 0.64)             // from short grass to long, over this
#define BITTEN vec2(0.06, 0.2)            // from bare earth to short grass, over this
#define EDGE 0.45                         // how strongly the long grass's edge is lit on the sun's side, and shades the other
#define POOL 0.4                          // how dark the pigment pools along the long grass's edge
#define GRAIN 0.07                        // how much the paper's grain darkens its hollows
#define DABS 0.5                          // how strongly the dry-brush dabs show in the longest grass, up close

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

// ---------------------------------------------------------------- the grass, in watercolour

// The season's grass in the light (l > 0, toward a near-pure lime) or the shade (l < 0, a deep emerald, bluer).
// Winter's grey-green only gets lighter and darker: no lime in the frost. Set once a pixel, from the season (main).
#define SATURATE 0.3                      // how much more colour than the season's palette, in the green and golden seasons
#define LIME vec3(1.17, 1.16, 0.62)       // the grass in full sun, times its colour (and LIME_ADD)
#define LIME_ADD vec3(0.035, 0.055, 0.)
#define EMERALD vec3(0.42, 0.64, 0.68)    // in deep shade, times its colour
#define FROST_LIT vec3(1.07, 1.07, 1.05)  // the same two in winter
#define FROST_DEEP vec3(0.76, 0.82, 0.88)
vec3 LIT, LIT_ADD, DEEP;
vec3 tone(vec3 c, float l) {
  return l > 0. ? mix(c, c * LIT + LIT_ADD, min(l, 1.)) : mix(c, c * DEEP, min(-l, 1.));
}

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

void main() {
  vec2 at = ((vec2(gl_FragCoord.x, top - gl_FragCoord.y) / dpr) - off) / zoom;    // in tiles (top: the canvas's height)
  // Near the edges the meadow fades into the mist, in big pale clouds; past them (zoomed right out, or looking a
  // little past the bottom) it goes on, mirrored, until the mist is thick. How thick it is is game.js's mistField.
  float m = texture(mist, (at + mistOut) / (size + 2. * mistOut)).r;
  vec3 fogC = fog;
  if (m > 0.) fogC = mix(fog, min(fog * 1.04 + 0.04, 1.), smoothstep(0.4, 0.8, fbm(at * 0.03 + 950.)));
  if (m > 0.996) { o = vec4(fogC * light, 1.); return; }
  vec2 p = size - abs(size - abs(at));                           // the meadow, mirrored back in from past its edges
  float px = 1. / (zoom * dpr);
  vec2 q = p + seed;                                              // the same noise, moved for each meadow

  vec4 T = smooth4(tile, p), B = texture(bloom, p / size), H = smooth4(shape, p), F = smooth4(water, p);
  float g = clamp(T.r, 0., 1.), wet = clamp(T.g * 2., 0., 1.), height = clamp(H.r, 0., 1.);
  float n1 = fbm(q * 0.35), n2 = fbm(q * 1.7 + 31.);
  float toWater = H.g + 0.9 * (n2 - 0.5) + 0.8 * (n1 - 0.5);     // a wobbly shore

  // ---- The grass.
  float hue = clamp((max(high.r, max(high.g, high.b)) - min(high.r, min(high.g, high.b))) / 0.35, 0., 1.);
  LIT = mix(FROST_LIT, LIME, hue); LIT_ADD = LIME_ADD * hue;
  DEEP = mix(FROST_DEEP, EMERALD, hue);

  // Where it is: deeper and cooler by the water and the woods, golden up high and in big drifts, and broad warm and
  // cool washes over it all, like watercolour laid wet: the hue moves, the grass stays saturated.
  float moist = exp(-max(toWater, 0.) / 4.);
  float dry = clamp(0.45 * height + 0.8 * (fbm(q * 0.03 + 5.) - 0.5) - 0.6 * moist + 0.2, 0., 1.);
  // A green season's drifts dry to straw rather than going lime; autumn's and winter's keep the warm tint.
  vec3 grass = high, golden = mix(high * mix(vec3(1.), vec3(1.2, 1.06, 0.5), hue),
    mix(high, vec3(0.84, 0.77, 0.47), 0.4 * hue), smoothstep(0.12, 0.22, high.g - high.r));
  grass = mix(grass, golden, smoothstep(0.4, 0.85, dry));
  float cool = max(0.85 * moist, 0.75 * exp(-H.b / 3.));
  grass = mix(grass, grass * mix(vec3(0.94), vec3(0.8, 0.93, 0.96), hue), cool);
  float wash = 0.65 * noise(q * 0.07 + 300.) + 0.35 * noise(q * 0.16 + 310.) - 0.5;
  grass *= 1. + vec3(0.16, 0.06, -0.16) * wash * hue;
  grass = max(mix(vec3(dot(grass, vec3(0.3, 0.59, 0.11))), grass, 1. + SATURATE * hue), 0.);   // more colour, never greyer
  vec3 lush = grass * vec3(0.84, 0.95, 0.9);
  vec3 longC = lush;                                             // the long grass's own colour, before its light

  // How long the grass is (what the rabbits eat): long meadow grass; short grass where it's grazed, paler and sunnier,
  // straw-coloured as it gets shorter; bare earth only where it's bitten right down. The edges ragged, finer than a tile.
  float ragC = 0.15 * (noise(q * 0.9 + 40.) - 0.5) + 0.1 * (noise(q * 2.1 + 43.) - 0.5), rag = ragC + 0.05 * (noise(q * 4.7 + 45.) - 0.5);
  float gw = clamp(g + rag, 0., 1.);
  float fine = clamp((zoom - 10.) / 6., 0., 1.);                 // up close: brushwork; further out it'd only read as speckle
  float far = 1. - clamp((zoom - 8.) / 6., 0., 1.);
  float tall = smoothstep(LONG.x, LONG.y, gw), turf = smoothstep(BITTEN.x, BITTEN.y, gw);
  vec3 earth = low * mix(vec3(0.97, 0.97, 0.98), vec3(0.93, 0.85, 0.72), hue) * (1. - 0.3 * moist);
  vec3 lawn = mix(tone(grass, 0.3), low * mix(vec3(1.), vec3(1.02, 1.0, 0.9), hue), 0.22 + 0.15 * far + 0.45 * (1. - smoothstep(0.16, 0.48, gw)));   // (paler from afar, so it reads)
  // The long grass's edge, toward the sun: where it stands higher than the short grass by it, a light along its top
  // and a soft shadow falling on the lawn below. (One more look at the grass a little way toward the sun.)
  // (Its slope from the pixels about it: dFdx and dFdy, in tiles, and toward the sun.)
  // (Only the coarser wobble: the finest would make the light along it jagged.)
  float tallC = smoothstep(LONG.x, LONG.y, clamp(g + ragC, 0., 1.));
  float rise = dot(vec2(dFdx(tallC), -dFdy(tallC)) / px, normalize(vec2(-0.55, -0.75)));   // (screen y runs up)
  float castOn = clamp(-EDGE * rise, 0., 1.), rimOf = clamp(EDGE * rise, 0., 1.);

  // Watercolour: washes laid wet, the long grass a deeper wash than the lawn with the pigment pooled dark along
  // its edge, granulation in the hollows of the paper, and a few dry-brush dabs where it's longest.
  float pool = smoothstep(0.08, 0.5, tall) * (1. - smoothstep(0.5, 0.95, tall));
  float gran = noise(q * 4.5 + 870.) * 0.6 + noise(q * 11. + 880.) * 0.4;
  float bloomW = fbm(q * 0.5 + 860.);
  vec3 meadow = tone(longC, 0.25 * (bloomW - 0.5) * 2. - 0.05);
  vec3 col = mix(lawn, meadow, tall);
  col = mix(col, tone(longC, -0.75), POOL * pool);
  col *= 1. - GRAIN * smoothstep(0.45, 0.8, gran) * (0.4 + 0.6 * tall);
  if (fine > 0.) {
    vec2 db = dabs2(p, px, 0.5, 0.55, 0.1, 0.25, 0.55 * smoothstep(0.7, 1., gw));
    col = mix(col, tone(longC, -0.35 + 0.25 * db.y), DABS * db.x * fine);
  }
  // The light along the long grass's sunny edge, and its shadow on the short grass below.
  col = mix(col, tone(longC, 0.8), 0.2 * rimOf);
  col = mix(col, col * DEEP, 0.3 * castOn);
  col = mix(earth, col, turf);
  if (turf < 1.) col *= 1. - 0.05 * (1. - turf) * noise(q * 2.2 + 900.);   // the earth a little uneven

  // A thin edge of wet moss along the water, fuller here and there: a deep cool green, never tan.
  float cove = smoothstep(0.4, 0.65, 0.62 * noise(q * 0.5 + 70.) + 0.38 * noise(q * 1.1 + 75.));
  col = mix(col, tone(grass * vec3(0.78, 0.92, 0.9), -0.5), 0.65 * (1. - smoothstep(0.1, 0.8, toWater)) * mix(0.35, 1., cove));
  col *= 0.96 + 0.08 * height;

  col = col * (1. - B.a) + B.rgb;                                // a flower field in bloom
  // Snow settles in patches first, on the long grass's sunny tops before its hollows; blue in the shade.
  float s0 = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.92) : 0.;
  col = mix(col, mix(vec3(0.8, 0.86, 0.96), vec3(246., 248., 252.) / 255., 0.6 + 0.4 * (1. - castOn)), s0);
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
  o = vec4(col * mix(light, vec3(1.), 0.6 * open * (1. - m)), 1.);   // open water shows the sky, so it keeps most of its blue
}`;

let ok = !!gl, U = {}, textures = {}, shader, mistOut = 0, mistSum = null;
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
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT));
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
    [['tile', 0], ['bloom', 1], ['shape', 2], ['water', 3]].forEach(([name, unit]) => {   // (4: the mist)
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
  // How many texels have any mist in each rectangle from the corner, so misty() can tell in a few reads.
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0, row = 0; x < w; x++) {
    row += data[y * w + x] > 0 ? 1 : 0;
    sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
  }
  mistSum = { sum, w, h };
}

// Whether a painting (its camera and margin, as draw had them) has any mist in it. Where it has none the shader's
// m is 0 and the mist's colour can't change a pixel, so its creeping through the day needn't paint the ground again.
function misty(u, pad) {
  if (!mistSum) return false;
  const { sum, w, h } = mistSum, tx = w / (S.W + 2 * mistOut), ty = h / (S.H + 2 * mistOut);
  const ax = (-pad - u.ox) / u.zoom, bx = (u.width / u.dpr + pad - u.ox) / u.zoom;   // the tiles it covers
  const ay = (-pad - u.oy) / u.zoom, by = (u.height / u.dpr + pad - u.oy) / u.zoom;
  // the texels the shader's (linear) reads there could touch, a texel to spare; past the edges is all mist
  const x0 = Math.floor((ax + mistOut) * tx) - 2, x1 = Math.ceil((bx + mistOut) * tx) + 2;
  const y0 = Math.floor((ay + mistOut) * ty) - 2, y1 = Math.ceil((by + mistOut) * ty) + 2;
  if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) return true;
  const W1 = w + 1;
  return sum[(y1 + 1) * W1 + x1 + 1] - sum[y0 * W1 + x1 + 1] - sum[(y1 + 1) * W1 + x0] + sum[y0 * W1 + x0] > 0;
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
let last = null, stale = true, busy = 0, panned = -1e9, paintedAt = -1e9;   // busy: how often lately more than the camera moved
const NEAR = { snow: 0.004, damp: 0.002, ice: 0.004, cold: 0.004, lx: 0.08, ly: 0.08 };
const EXACT = ['width', 'height', 'zoom', 'dpr'];
const was = { ox: 0, oy: 0 }, view = { x: 0, y: 0 };
// At speed a day goes by in a blink, and the light, the mist's colour, the wet and the season move a little every frame:
// the ground was painted again in most frames (at 60x two in three). There what only moves with them waits u.hold ms
// (game.js: none at 1x and 4x) and goes on in steps too small to see at that pace; the camera, the size and a texture
// handed over never wait.
function steady(u, now) {                               // all but where the camera is
  if (stale || !last || u.seed[0] !== last.seed[0] || u.seed[1] !== last.seed[1]) return false;
  for (const k of EXACT) if (u[k] !== last[k]) return false;
  if (now - paintedAt < u.hold) return true;
  for (const k in NEAR) if (Math.abs(u[k] - last[k]) > NEAR[k]) return false;
  for (const k of ['low', 'high', 'sand']) for (let i = 0; i < 3; i++) if (Math.abs(u[k][i] - last[k][i]) > 0.5) return false;
  if (last.misty) for (let i = 0; i < 3; i++) if (Math.abs(u.fog[i] - last.fog[i]) > 0.5) return false;   // (none in it: the fog can't show)
  for (let i = 0; i < 3; i++) if (Math.abs(u.light[i] - last.light[i]) > 0.002) return false;   // (game.js moves it in steps)
  return true;
}
const within = (d, pad, dpr) => d === 0 || Math.abs(d) <= pad - 1 / dpr;

//   width, height   the screen, in the canvas's pixels
//   zoom, ox, oy    CSS pixels a tile, and where the meadow's corner lands
//   hold            ms the light, the colours and the weather may wait to be painted (steady)
//   the rest        see the uniforms in the shader
function draw(u) {
  const now = performance.now();
  if (u.ox !== was.ox || u.oy !== was.oy) panned = now;
  was.ox = u.ox; was.oy = u.oy;
  const still = steady(u, now);
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
  for (const k of ['zoom', 'dpr', 'snow', 'damp', 'lx', 'ly', 'ice', 'cold']) gl.uniform1f(U[k], u[k]);
  for (const k of ['low', 'high', 'sand', 'fog']) gl.uniform3fv(U[k], u[k].map(v => v / 255));
  gl.uniform3fv(U.light, u.light);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  last = { ...u, pad, misty: misty(u, pad) }; stale = false; view.x = view.y = m; paintedAt = now;
  return true;
}

// A lost context (the GPU reset) takes the shader with it: from then on game.js draws plain colours.
canvas.addEventListener('webglcontextlost', () => { ok = false; });

window.Ground = { get ok() { return ok; }, canvas, set, mist, draw, view };
})();
