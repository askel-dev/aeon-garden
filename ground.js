/* AEON Garden — the ground: grass, earth, shores and water, painted by a small WebGL shader.
 *
 * game.js hands over the meadow as a few tiny textures, one texel a tile, and the shader works
 * out every pixel on the screen, every frame. Nothing is cached, so the grass changes the moment
 * it grows and the ground is sharp at any zoom. The look, from big to small:
 *   - where it is: lush and dark by the water and the woods, drier and yellower up high and in
 *     big drifts, a few bare patches where it is dry;
 *   - the grass itself (what the rabbits eat): lush grass, or the bare earth under it;
 *   - crisp tufts where the grass is thick, once you're close enough to see them;
 *   - the sun on the slopes, mud at the water's edge, then the water in soft layers.
 *
 * Use: Ground.set(name, data) with a Float32Array of 4 values a tile: 'tile' (grass, water,
 * ash, wood), 'bloom' (a field's tint times how much it shows, then how much), 'shape' (height,
 * tiles to the water, tiles to the woods) and 'water' (the water softened by 1, 2 and 4 blurs,
 * and the deep water by 2). Then Ground.draw(uniforms) paints Ground.canvas, to be copied onto
 * the screen.
 * Ground.ok is false where there is no WebGL2.
 */
(() => {
'use strict';

const S = window.Sim;
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });

const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0., 1.); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D tile, bloom, shape, water;
uniform vec2 size, off, res, seed;
uniform float zoom, dpr, snow, damp, lx, ly, ice;
uniform vec3 low, high, sand;
out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
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

// Tufts of three blades, a few to a tile, only where the grass is thick. Gives how much of
// this pixel they cover. px: tiles a screen pixel.
float tufts(vec2 p, float px) {
  const float CELL = 0.9, LEN = 0.3;
  float cover = 0.;
  vec2 c = floor(p / CELL);
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 id = c + vec2(dx, dy), r = vec2(hash(id + seed), hash(id + seed + 17.1));
    vec2 base = (id + 0.2 + 0.6 * r) * CELL;
    float g = texture(tile, base / size).r;
    if (hash(id + seed + 41.7) > 0.55 * smoothstep(0.55, 0.9, g)) continue;
    float len = LEN * (0.7 + 0.5 * hash(id + 3.3)) * (0.6 + 0.4 * g), lean = (hash(id + 9.1) - 0.5) * 0.1;
    float d = 1e9, along = 0.;
    for (int k = -1; k <= 1; k++) {
      float fk = float(k), t;
      vec2 tip = base + vec2(fk * 0.12 + lean + fk * len * 0.35, -len * (1. - 0.25 * abs(fk)));
      float dk = segment(p, base + vec2(fk * 0.05, 0.), tip, t);
      if (dk < d) { d = dk; along = t; }
    }
    float w = max(0.022, 0.6 * px) * (1. - 0.75 * along);       // thinner toward the tip
    cover = max(cover, 1. - smoothstep(w - px, w + px, d));
  }
  return cover;
}

// n layers of a colour at alpha a each, stacked from level t0 to t1 of field f, as how much of
// the colour shows. Counted smoothly, so they make a gradient instead of steps.
float layers(float f, float t0, float t1, float n, float a) {
  return 1. - pow(1. - a, clamp((f - t0) / (t1 - t0) * (n - 1.) + 1., 0., n));
}

void main() {
  vec2 p = ((vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr) - off) / zoom;   // in tiles
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
  float dry = clamp(0.4 * height + 0.8 * (fbm(q * 0.045 + 5.) - 0.5) - 0.6 * moist + 0.2, 0., 1.);
  vec3 green = mix(high, vec3(dot(high, vec3(0.3, 0.59, 0.11))), 0.2);
  vec3 lush = green * vec3(0.8, 0.88, 0.78), parched = mix(green, low, 0.24) * vec3(1.03, 1., 0.88);
  vec3 grass = mix(lush, green, smoothstep(0.05, 0.45, dry));
  grass = mix(grass, parched, smoothstep(0.45, 0.85, dry));
  grass = mix(grass, lush * 0.88, 0.55 * exp(-H.b / 3.));
  grass *= 1. - 0.08 * exp(-max(toWater, 0.) / 1.4);             // wet grass along the water
  float clover = smoothstep(0.64, 0.7, fbm(q * 0.28 + 90.)) * clamp(0.4 + moist - dry, 0., 1.);
  grass = mix(grass, grass * vec3(0.8, 0.9, 0.86), 0.8 * clover);
  float bare = smoothstep(0.7, 0.74, fbm(q * 0.22 + 50.) + 0.15 * dry - 0.3 * moist);
  vec3 earth = mix(low * vec3(0.95, 0.93, 0.9), low * vec3(0.66, 0.6, 0.55), moist);

  // The grass itself, over the earth, and tufts where it is thick.
  vec3 col = mix(earth, grass, smoothstep(0., 1., g * (1. - 0.45 * bare))) * (0.97 + 0.06 * n1);
  float detail = clamp((zoom - 7.) / 9., 0., 1.);                // zoomed far out they would only shimmer
  if (detail > 0.) col = mix(col, grass * vec3(0.72, 0.8, 0.7), 0.85 * detail * (1. - bare) * tufts(p, px));

  col = mix(col, low * vec3(0.55, 0.48, 0.4), 0.75 * (1. - smoothstep(0.4, 1.6, toWater)));   // mud at the edge
  col *= 0.95 + 0.1 * height;
  col = col * (1. - B.a) + B.rgb;                                // a flower field in bloom
  col = mix(col, vec3(74., 66., 60.) / 255., T.b * (1. - g) * 0.85);   // burnt, until the grass returns
  float s = snow > 0. ? clamp(snow * 1.4 - 0.2 - 0.25 * (2. * n1 - 1.) - 0.1 * (2. * n2 - 1.), 0., 0.9) : 0.;
  col = mix(col, vec3(246., 248., 252.) / 255., s);             // snow settles in patches first
  col *= damp * (1. - 0.3 * T.a) * (1. - 0.1 * wet);

  // The sun on the slopes: lighter where the ground falls toward it. Water lies flat.
  vec2 e = vec2(1., 0.);
  float east = texture(shape, (p + e.xy) / size).r - texture(shape, (p - e.xy) / size).r;
  float south = texture(shape, (p + e.yx) / size).r - texture(shape, (p - e.yx) / size).r;
  col *= 1. + (1. - wet) * clamp((east * lx + south * ly) * 0.78, -0.2, 0.2);

  // The water, in soft layers: damp sand fading into the grass, a little shade under the
  // bank, shallows, and a darker blue where it gets too deep to wade. Snow freezes it over.
  vec3 frozen = vec3(214., 232., 242.) / 255.;
  vec3 sandC = mix(sand, frozen, ice), bankC = mix(vec3(104., 170., 208.) / 255., frozen, ice);
  vec3 shallowC = mix(vec3(130., 200., 235.) / 255., frozen, ice), deepC = mix(vec3(72., 142., 202.) / 255., frozen, ice);
  float edge = max(fwidth(F.r) * 0.7, 1e-4);
  col = mix(col, sandC, layers(F.b, 0.03, 0.42, 9., 0.12));
  col = mix(col, bankC, smoothstep(0.47 - edge, 0.47 + edge, F.r));   // the water's edge stays crisp
  col = mix(col, shallowC, layers(F.g, 0.54, 0.8, 7., 0.2));
  col = mix(col, deepC, layers(F.a, 0.3, 0.95, 9., 0.12));

  if (below > 0.) {
    float past = res.y / dpr + 8. - (off.y + size.y * zoom);      // how far the view reaches past the edge
    col = mix(col, vec3(40., 50., 20.) / 255., mix(0.12, 0.4, clamp(below / max(past, 40.), 0., 1.)));
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
  const { unit, t } = textures[name];
  gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S.W, S.H, gl.RGBA, gl.FLOAT, data);
}

//   width, height   the canvas, in its own pixels
//   zoom, ox, oy    CSS pixels a tile, and where the meadow's corner lands
//   the rest        see the uniforms in the shader
function draw(u) {
  if (canvas.width !== u.width || canvas.height !== u.height) { canvas.width = u.width; canvas.height = u.height; }
  gl.viewport(0, 0, u.width, u.height);
  gl.uniform2f(U.res, u.width, u.height); gl.uniform2f(U.off, u.ox, u.oy); gl.uniform2fv(U.seed, u.seed);
  for (const k of ['zoom', 'dpr', 'snow', 'damp', 'lx', 'ly', 'ice']) gl.uniform1f(U[k], u[k]);
  for (const k of ['low', 'high', 'sand']) gl.uniform3fv(U[k], u[k].map(v => v / 255));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// A lost context (the GPU reset) takes the shader with it: from then on game.js draws plain colours.
canvas.addEventListener('webglcontextlost', () => { ok = false; });

window.Ground = { get ok() { return ok; }, canvas, set, draw };
})();
