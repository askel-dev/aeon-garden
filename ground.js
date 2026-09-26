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
 *   - big soft patches of lighter and deeper grass, a faint painterly mottle and, up close, a fine
 *     grain and the odd pebble;
 *   - a soft earthy bank round the water, melting into the grass, damp at the lip;
 *   - the sun on the slopes, wet moss at the water's edge, then the water in soft layers,
 *     deepest well out from the shore, with long brushed strokes on its surface.
 *
 * Use: Ground.set(name, data) with a Float32Array of 4 values a tile: 'tile' (grass, water,
 * ash, wood), 'bloom' (a field's tint times how much it shows, then how much), 'shape' (height,
 * tiles to the water, tiles to the woods) and 'water' (the water softened by 1, 2 and 4 blurs,
 * and the deep water by 2). Then Ground.draw(uniforms) paints Ground.canvas if it has to, and
 * Ground.view says where in it the screen's corner is, to be copied from there onto the screen.
 * Ground.ok is false where there is no WebGL2.
 */
(() => {
'use strict';

const S = window.Sim;
const canvas = document.createElement('canvas');
// preserveDrawingBuffer: the picture stays put between draws, to be copied again while nothing changed.
const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });

const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0., 1.); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D tile, bloom, shape, water;
uniform vec2 size, off, seed;
uniform float top, past, zoom, dpr, snow, damp, lx, ly, ice, cold;
uniform vec3 low, high, sand;
out vec4 o;

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

void main() {
  vec2 p = ((vec2(gl_FragCoord.x, top - gl_FragCoord.y) / dpr) - off) / zoom;     // in tiles (top: the canvas's height)
  // Past the bottom edge the meadow goes on in a mirror, fading darker (you may look a little past it).
  float below = max(0., p.y - size.y) * zoom;
  if (below > 0.) p.y = 2. * size.y - p.y;
  if (p.x < 0. || p.x > size.x || p.y < 0.) { o = vec4(0.); return; }
  float px = 1. / (zoom * dpr);
  vec2 q = p + seed;                                              // the same noise, moved for each meadow

  vec4 T = smooth4(tile, p), B = texture(bloom, p / size), H = smooth4(shape, p), F = smooth4(water, p);
  float g = clamp(T.r, 0., 1.), wet = clamp(T.g * 2., 0., 1.), height = clamp(H.r, 0., 1.);
  float n1 = fbm(q * 0.35), n2 = fbm(q * 1.7 + 31.);
  float toWater = H.g + 0.9 * (n2 - 0.5) + 0.8 * (n1 - 0.5);     // a wobbly shore

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
  float clover = 0.4 * smoothstep(0.55, 0.75, fbm(q * 0.28 + 90.)) * clamp(0.4 + moist - dry, 0., 1.);
  grass = mix(grass, grass * vec3(0.8, 0.9, 0.86), 0.8 * clover);
  vec3 earth = mix(low * vec3(0.95, 0.93, 0.9), low * vec3(0.66, 0.6, 0.55), moist);

  // The grass itself, over the earth, with a nibbled edge.
  vec3 col = mix(earth, grass, smoothstep(0., 1., clamp(g + 0.15 * (n2 - 0.5), 0., 1.))) * (0.97 + 0.06 * n1);
  float detail = clamp((zoom - 12.) / 6., 0., 1.);               // further out the tufts would only read as speckle

  // A thin edge of wet moss along the water, fuller here and there. Not tan: tan is grazed ground.
  float cove = smoothstep(0.4, 0.65, fbm(q * 0.5 + 70.));
  col = mix(col, grass * vec3(0.62, 0.72, 0.64), 0.7 * (1. - smoothstep(0.1, 0.8, toWater)) * mix(0.35, 1., cove));
  col *= 0.95 + 0.1 * height;
  // A painterly surface: every tile a touch lighter or darker, warm and cool patches, a fine grain up close.
  col *= 1. + 0.07 * (noise(q * 1.1 + 200.) - 0.5) + 0.035 * (noise(q * 3.1 + 250.) - 0.5);
  col += vec3(1., 0.33, -1.) * 0.035 * (fbm(q * 0.22 + 300.) - 0.5);
  // Big soft patches laid in like a painter would: some lighter and sunnier, some deeper and cooler.
  float patches = smoothstep(0.3, 0.7, fbm(q * 0.1 + 800.));
  col *= mix(vec3(0.9, 0.93, 0.95), vec3(1.06, 1.05, 0.97), patches);
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
  // The bank: a soft rim of earth round the water, wider here and there, melting into the grass
  // and a little darker at the lip. (F.r is 0.47 at the water's edge.)
  float rim = 0.08 + 0.14 * smoothstep(0.3, 0.7, fbm(q * 0.3 + 900.)) + 0.03 * (n2 - 0.5);
  float rimAa = max(fwidth(F.r), 1e-4);
  float onBank = smoothstep(0.47 - rim - 0.06, 0.47 - rim + 0.05, F.r) * (1. - smoothstep(0.47 - rimAa, 0.47 + rimAa, F.r));
  if (onBank > 0.) {
    float down = clamp((F.r - 0.47 + rim) / rim, 0., 1.);        // 0 at the grass, 1 at the water
    vec3 soil = mix(low * vec3(1.06, 1.03, 0.94) + 0.06, low * vec3(0.86, 0.8, 0.72), smoothstep(0.2, 0.8, down));
    soil = mix(soil, low * vec3(0.7, 0.66, 0.6), smoothstep(0.6, 1., down));   // damp at the lip
    soil = mix(soil, grass, 0.2);                                // in the meadow's own colours
    soil *= 0.97 + 0.06 * n1 + 0.05 * detail * (noise(q * 9. + 950.) - 0.5);
    col = mix(col, soil, onBank * 0.8);
  }
  col = mix(col, vec3(74., 66., 60.) / 255., T.b * (1. - g) * 0.85);   // burnt, until the grass returns
  float s = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.9) : 0.;
  col = mix(col, vec3(246., 248., 252.) / 255., s);             // snow settles in patches first
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
  col = mix(col, sandC, layers(F.b, 0.03, 0.42, 9., 0.035));
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

  if (below > 0.) {
    // darker the further, all the way at the furthest the camera may look (past: CSS pixels)
    col = mix(col, vec3(40., 50., 20.) / 255., mix(0.12, 0.4, clamp(below / max(past + 8., 40.), 0., 1.)));
  }
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
    ['tile', 'bloom', 'shape', 'water'].forEach((name, unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, S.W, S.H, 0, gl.RGBA, gl.FLOAT, null);
      gl.uniform1i(U[name], unit);
      textures[name] = { unit, t };
    });
    gl.uniform2f(U.size, S.W, S.H);
  } catch (e) {
    console.warn('The ground shader would not start:', e);
    ok = false;
  }
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
const NEAR = { snow: 0.004, damp: 0.002, ice: 0.004, cold: 0.004, lx: 0.08, ly: 0.08 };
const EXACT = ['width', 'height', 'zoom', 'dpr', 'past'];
const was = { ox: 0, oy: 0 }, view = { x: 0, y: 0 };
function steady(u) {                                    // all but where the camera is
  if (stale || !last || u.seed[0] !== last.seed[0] || u.seed[1] !== last.seed[1]) return false;
  for (const k of EXACT) if (u[k] !== last[k]) return false;
  for (const k in NEAR) if (Math.abs(u[k] - last[k]) > NEAR[k]) return false;
  for (const k of ['low', 'high', 'sand']) for (let i = 0; i < 3; i++) if (Math.abs(u[k][i] - last[k][i]) > 0.5) return false;
  return true;
}
const within = (d, pad, dpr) => d === 0 || Math.abs(d) <= pad - 1 / dpr;

//   width, height   the screen, in the canvas's pixels
//   zoom, ox, oy    CSS pixels a tile, and where the meadow's corner lands
//   past            how far past the meadow's bottom edge the camera may look, in CSS pixels
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
  for (const k of ['past', 'zoom', 'dpr', 'snow', 'damp', 'lx', 'ly', 'ice', 'cold']) gl.uniform1f(U[k], u[k]);
  for (const k of ['low', 'high', 'sand']) gl.uniform3fv(U[k], u[k].map(v => v / 255));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  last = { ...u, pad }; stale = false; view.x = view.y = m;
  return true;
}

// A lost context (the GPU reset) takes the shader with it: from then on game.js draws plain colours.
canvas.addEventListener('webglcontextlost', () => { ok = false; });

window.Ground = { get ok() { return ok; }, canvas, set, draw, view };
})();
