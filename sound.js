/* Nobody's Meadow — sound. Everything is made on the fly with Web Audio: no sound files.
 *
 * Three ideas keep it cozy:
 *  1. One scale. Every pitched sound comes from D major pentatonic, so nothing can clash.
 *     Only the birds sing free: they're the meadow's nature, not its music.
 *  2. One instrument per species. Rabbits are a high kalimba, foxes a low felt marimba, bees
 *     a buzz that hums in tune, the meadow itself (seasons, old age) a soft glass bell.
 *     Rising = life, falling = loss. Lightning is the one loud thing, on purpose.
 *  3. The meadow is the music. Wind, birds, crickets and rain follow the clock and the
 *     sky, and events are rare, quiet and rate-limited so a busy meadow never turns into noise.
 *     Every few minutes a short felt-piano piece drifts over it, like the music in Minecraft
 *     (see "music" below), in keys that hold the pentatonic so it still fits.
 *     Over it all hangs a wind chime that rings more the more rabbits there are.
 *
 * Use: Sound.start() from a click, then Sound.update({ phase, season, sky, bees, life, frogs, trees, fire, pot }) a
 * few times a second (sky: how much of each weather is showing, 0..1; bees: how many are flying
 * on screen; life: how full the meadow is of rabbits, 0..1; frogs: 0..1,
 * the spring's spawn, for a croak now and then at night; trees: 0..1, how much of the screen is under
 * leafy crowns, for the leaves' rustle in the wind; fire: 0..1, how near and well a campfire burns, for its crackle; torch:
 * 0..1, the same for the nearest lit torch, a quieter crackle with no roar under it; pot:
 * 0..1, the cooking pot on the fire, simmering at 0.3 and bubbling hard at 1) and
 * Sound.play('birth', { species, pan, near, seen }) on events.
 */
(() => {
'use strict';

const SCALE = [0, 2, 4, 7, 9];                     // major pentatonic
const ROOT = 62;                                   // D4
const note = (deg, oct = 0) => {
  const n = SCALE.length, o = Math.floor(deg / n) + oct, d = ((deg % n) + n) % n;
  return 440 * Math.pow(2, (ROOT + SCALE[d] + 12 * o - 69) / 12);
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

let ac = null, master, ducker, loud, fxBus, ambBus, musicBus, hush, reverb, noiseBuf, brownBuf, leafBuf, gravelBuf, crackBuf;
let enabled = true, volume = 0.6;
const amb = {};                                    // ambient layers
const LOUD = 0.7;                                  // thunder's level against the rest
const BIRDS = 0.85;                                // birds, 15% under the rest of the meadow
const state = { phase: 0.3, season: 0, sky: { clear: 1 }, bees: 0, life: 0.3, frogs: 0, trees: 0.5, fire: 0, torch: 0, torchPan: 0, pot: 0, roof: 0, lull: 0 };
const last = {};                                   // per-sound cooldowns
const picking = { n: 0, at: -1e9, base: 0 };       // the picks in a row (SOUNDS.pick)
const PICK_CHAIN = 2.5;                            // s: a pick within this of the last climbs on
let recent = 0, recentAt = 0;                      // global voice budget

// ------------------------------------------------------------------ setup

function start() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
  master = ac.createGain(); master.gain.value = enabled ? volume : 0;
  ducker = ac.createGain();                        // dips the meadow under a close strike
  master.connect(ducker).connect(comp).connect(ac.destination);

  // Thunder's own way out, past the compressor so it can be truly loud, with a hard limiter.
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.2;
  loud = ac.createGain(); loud.gain.value = enabled ? volume * LOUD : 0;
  loud.connect(lim).connect(ac.destination);

  reverb = ac.createConvolver(); reverb.buffer = impulse(1.6, 2.4);   // (half the old 3.2 s tail: the convolver costs by its length)
  const wet = ac.createGain(); wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);

  fxBus = ac.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
  // Fog and snow muffle the meadow: the whole background goes through one low-pass.
  hush = ac.createBiquadFilter(); hush.type = 'lowpass'; hush.frequency.value = 12000; hush.connect(master);
  ambBus = ac.createGain(); ambBus.gain.value = 0.8; ambBus.connect(hush);

  // The music: dry into the mix, with more reverb than the meadow, and not muffled by fog.
  musicBus = ac.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
  const musicVerb = ac.createGain(); musicVerb.gain.value = 0.45; musicBus.connect(musicVerb).connect(reverb);

  noiseBuf = pinkNoise(4); brownBuf = brownNoise(4); leafBuf = leafNoise(6); gravelBuf = gravelNoise(2); crackBuf = crackleNoise(2);
  buildAmbience();
  setInterval(tickAmbience, 200);
}

// A soft, dark room: decaying noise, low-passed a little more each second.
function impulse(sec, decay = 2.4) {
  const len = Math.floor(ac.sampleRate * sec), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, k = 0.35 - 0.3 * t;
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function pinkNoise(sec) {
  const len = Math.floor(ac.sampleRate * sec), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return buf;
}

// Deeper than pink: the body of an explosion.
function brownNoise(sec) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return buf;
}

// Leaves: noise cut into thousands of tiny ticks (one leaf brushing another), mostly soft with
// now and then a crisp one, bunched into flurries that come and go, over a faint hiss. The
// flurries go round a whole number of times, and a tick past the end comes in at the start, so it loops.
function leafNoise(sec) {
  const sr = ac.sampleRate, len = Math.floor(sr * sec), buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const env = new Float32Array(len).fill(0.08), ph = Math.random() * 6;
  const busy = t => 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 5 * t / sec + ph) * Math.sin(2 * Math.PI * 2 * t / sec)) ** 2;
  for (let n = 0, want = Math.floor(sec * 260); n < want;) {
    const t = Math.random() * sec;
    if (Math.random() > busy(t)) continue;
    n++;
    const at = Math.floor(t * sr), grain = Math.floor(sr * rand(0.003, 0.025)), amp = Math.random() ** 4;
    for (let i = 0; i < grain * 3; i++) env[(at + i) % len] += amp * Math.min(1, i / (sr * 0.0008)) * Math.exp(-i / grain);
  }
  let top = 0;
  for (let i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * env[i]; top = Math.max(top, Math.abs(d[i])); }
  for (let i = 0; i < len; i++) d[i] /= top;
  return buf;
}

// Gravel: sparse little clicks of uneven size, each dying in a few ms (grains of grit rubbing), for the old stone's voice.
function gravelNoise(sec) {
  const sr = ac.sampleRate, buf = ac.createBuffer(1, Math.floor(sr * sec), sr), d = buf.getChannelData(0);
  for (let n = Math.floor(sec * 900); n-- > 0;) {
    const at = Math.floor(Math.random() * d.length), len = Math.floor(sr * rand(0.0005, 0.004)), amp = 0.2 + Math.random() ** 2;
    for (let i = 0; i < len * 3 && at + i < d.length; i++) d[at + i] += amp * (Math.random() * 2 - 1) * Math.exp(-i / len);
  }
  let top = 0;
  for (let i = 0; i < d.length; i++) top = Math.max(top, Math.abs(d[i]));
  for (let i = 0; i < d.length; i++) d[i] /= top;
  return buf;
}

// Crackle: thousands of single sharp ticks, most tiny and a few loud, each ringing a fraction of a ms (a crisp thing
// breaking, a bubble of spit popping): the grit of the eating sounds (ticks).
function crackleNoise(sec) {
  const sr = ac.sampleRate, buf = ac.createBuffer(1, Math.floor(sr * sec), sr), d = buf.getChannelData(0);
  for (let n = Math.floor(sec * 2600); n-- > 0;) {
    const at = Math.floor(Math.random() * d.length), len = sr * rand(0.00005, 0.0004), amp = (Math.random() ** 3) * (Math.random() < 0.5 ? -1 : 1);
    for (let i = 0; i < len * 4 && at + i < d.length; i++) d[at + i] += amp * Math.exp(-i / len) * (i & 1 ? -0.6 : 1);
  }
  let top = 0;
  for (let i = 0; i < d.length; i++) top = Math.max(top, Math.abs(d[i]));
  for (let i = 0; i < d.length; i++) d[i] /= top;
  return buf;
}

// ------------------------------------------------------------------ small building blocks

// out(pan, verb): a panner feeding the fx bus (or thunder's loud bus) plus a reverb send.
function out(pan = 0, verb = 0.3, gain = 1, bus = fxBus) {
  const g = ac.createGain(); g.gain.value = gain;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  const s = ac.createGain(); s.gain.value = verb;
  g.connect(p); p.connect(bus); p.connect(s); s.connect(reverb);
  return g;
}

// A sine partial with a soft attack and exponential tail.
function partial(dest, freq, t, peak, attack, decay, type = 'sine') {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + attack + decay + 0.05);
  return o;
}

const kalimba = (dest, f, t, v = 1) => {            // rabbits: bright tine, quick body
  partial(dest, f, t, 0.30 * v, 0.004, 0.9);
  partial(dest, f * 5.4, t, 0.05 * v, 0.002, 0.12);
  partial(dest, f * 2, t, 0.04 * v, 0.004, 0.35);
};
const marimba = (dest, f, t, v = 1) => {            // foxes: felt mallet on wood, lower
  partial(dest, f, t, 0.34 * v, 0.008, 0.7);
  partial(dest, f * 4, t, 0.06 * v, 0.004, 0.09);
  partial(dest, f * 10, t, 0.012 * v, 0.002, 0.03);
};
const bell = (dest, f, t, v = 1) => {               // the meadow: glass bell, long tail
  [[1, 0.22, 3.2], [2.76, 0.06, 1.6], [5.4, 0.03, 0.8], [8.93, 0.012, 0.4]]
    .forEach(([r, a, d]) => partial(dest, f * r, t, a * v, 0.006, d));
};
// Bees: a soft sawtooth buzz on a note, with the flutter of wings and a little lift at the start.
const buzz = (dest, f, t, v = 1, len = 0.35) => {
  const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  const wing = ac.createOscillator(), depth = ac.createGain(), am = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 0.96, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  lp.type = 'lowpass'; lp.frequency.value = f * 3; lp.Q.value = 0.7;
  wing.frequency.value = rand(20, 26); depth.gain.value = 0.35; am.gain.value = 0.65;
  wing.connect(depth).connect(am.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.65 * v, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(am).connect(g).connect(dest);
  o.start(t); wing.start(t); o.stop(t + len + 0.05); wing.stop(t + len + 0.05);
};
const voiceOf = species => species === 'fox' ? marimba : species === 'bee' ? buzz : kalimba;
const octOf = species => species === 'fox' ? -1 : species === 'bee' ? 0 : 1;

// A soft clip, for grit: harmonics let a laptop speaker "hear" a boom it can't play.
function grit(dest, amount) {
  const ws = ac.createWaveShaper(), n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(amount * x) / Math.tanh(amount); }
  ws.curve = curve; ws.connect(dest);
  return ws;
}

// Thunder is built the way Minecraft builds it: an explosion slowed down to about 0.6x, and a
// long roll. boom: deep noise that hits, loses its top fast and dies slowly, shaken by quick
// uneven bumps, with a sub drop under it. A bigger attack smears it, for echoes.
function boom(dest, t, { sec = 2.4, bright = 3000, peak = 1, attack = 0.004, heat = 2.5 } = {}) {
  const o = grit(dest, heat);
  const src = ac.createBufferSource(); src.buffer = brownBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(400, t + attack + sec * 0.3);
  f.frequency.exponentialRampToValueAtTime(150, t + sec);
  const N = Math.ceil(sec * 40), bumps = new Float32Array(N); let v = 1;   // ~40 bumps a second
  for (let j = 0; j < N; j++) { v += (rand(0.3, 1.7) - v) * 0.5; bumps[j] = v; }
  const r = ac.createGain(); r.gain.setValueCurveAtTime(bumps, t, sec);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack + 0.1, sec / 5);
  src.connect(f).connect(r).connect(g).connect(o); src.start(t, rand(0, 2)); src.stop(t + sec + 0.1);
  const sub = ac.createOscillator(), sg = ac.createGain();
  sub.frequency.setValueAtTime(75, t); sub.frequency.exponentialRampToValueAtTime(30, t + sec * 0.4);
  sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.8 * peak, t + attack);
  sg.gain.setTargetAtTime(0.0001, t + attack + 0.05, sec / 8);
  sub.connect(sg).connect(o); sub.start(t); sub.stop(t + sec + 0.1);
}

// A roll: noise that swells in uneven lumps as it dies away, instead of one smooth fade. A low
// body for headphones and a band around 300-700 Hz so laptop speakers hear it too.
function roll(dest, t, sec, { cut = 500, lumps = 6, peak = 0.5, mid = 0.35, heat = 1.3 } = {}) {
  const N = 512, c = new Float32Array(N), at = [[0.02, 0.05, 1]];   // one lump right at the start
  for (let i = 0; i < lumps; i++) at.push([Math.pow(Math.random(), 1.6) * 0.75, rand(0.03, 0.1), rand(0.4, 1)]);
  let top = 0;
  for (let j = 0; j < N; j++) {
    const x = j / N; let v = 0.12;
    for (const [x0, w, h] of at) v += h * Math.exp(-(((x - x0) / w) ** 2));
    c[j] = v * Math.pow(1 - x, 1.6); top = Math.max(top, c[j]);
  }
  for (let j = 0; j < N; j++) c[j] = Math.max(0.0001, c[j] / top * peak);
  c[0] = c[N - 1] = 0.0001;
  const g = ac.createGain(); g.gain.setValueCurveAtTime(c, t, sec);
  g.connect(grit(dest, heat));
  for (const [type, from, to, q, v] of [['lowpass', cut, cut * 0.4, 0.5, 1], ['bandpass', 700, 300, 0.8, mid]]) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + sec);
    const vg = ac.createGain(); vg.gain.value = v * 2.2;
    src.connect(f).connect(vg).connect(g); src.start(t, rand(0, 3)); src.stop(t + sec + 0.05);
  }
}

// The rest of the meadow dips under a close strike, then comes back.
function duck(t, depth, back) {
  ducker.gain.cancelScheduledValues(t);
  ducker.gain.setValueAtTime(ducker.gain.value, t);
  ducker.gain.linearRampToValueAtTime(depth, t + 0.02);
  ducker.gain.setTargetAtTime(1, t + 0.3, back / 3);
}
let farAt = -1e9;                                  // when the last distant roll started

// Filtered noise with a moving band: whooshes, rustles, gusts. attack: seconds to full volume
// (by default a third of the sound, so it swells; a crack wants a couple of milliseconds).
function noise(dest, t, dur, { from = 800, to = 2400, q = 1.2, peak = 0.3, type = 'bandpass', attack = dur * 0.35 } = {}) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, rand(0, 3)); src.stop(t + dur + 0.05);
}

// A breath through the mouth: noise through a band that slides from one place to another (the mouth's shape), swelling
// in over swell of it and dying away.
function breathe(dest, t, dur, from, to, peak, swell) {
  noise(dest, t, dur, { from, to, q: 1.1, peak, attack: dur * swell });
  noise(dest, t, dur, { from: from * 0.45, to: to * 0.45, q: 0.8, peak: peak * 0.6, attack: dur * swell });   // (its body)
}

// A warm swell under a moment: soft detuned triangles on the notes fs, through a low-pass that opens as it swells and
// closes as it goes, in and out over len seconds.
function pad(dest, fs, t, len, v = 1) {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(450, t); lp.frequency.linearRampToValueAtTime(1500, t + len * 0.35); lp.frequency.linearRampToValueAtTime(500, t + len);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * v, t + len * 0.3);
  g.gain.setTargetAtTime(0.0001, t + len * 0.5, len * 0.12);
  lp.connect(g).connect(dest);
  for (const f of fs) for (const c of [-5, 5]) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = c + rand(-2, 2);
    o.connect(lp); o.start(t); o.stop(t + len + 0.2);
  }
}
// The glitter on a moment: n tiny high notes from the degrees degs, scattered over a while and across the stereo, thinning out.
function twinkle(t, degs, n, over, v = 1) {
  for (let i = 0; i < n; i++)
    celesta(out(rand(-0.8, 0.8), 0.6), note(pick(degs), 2), t + over * Math.pow(i / n, 1.4) + rand(0, 0.06), 0.22 * v * (1 - 0.6 * i / n));
}
// A sparkle rushing up into a moment: bright noise that swells and lifts, peaking at t + len.
const whoosh = (dest, t, len, v = 1) => noise(dest, t, len + 0.15, { from: 1400, to: 7000, q: 0.7, peak: 0.05 * v, attack: len });
const CHORDS = { D: [0, 2, 3], Bm: [-1, 0, 2], DA: [3, 5, 7], A: [1, 3, 5], Em: [1, 4, 6] };   // (in the pentatonic's degrees)

// ------------------------------------------------------------------ events

// How long each sound waits before it may play again; free: it doesn't count against the creature sounds' budget.
// lift: how much louder than the rest of the meadow it plays (1 the default): the campfire's small sounds get a boost.
const RULES = {
  love:    { gap: 0.35 },
  birth:   { gap: 0.25 },
  catch:   { gap: 0.8 },
  starve:  { gap: 1.2 },
  old:     { gap: 1.5 },
  escape:  { gap: 0.6 },
  thump:   { gap: 0.5 },
  queen:   { gap: 4 },
  queenlost: { gap: 4 },
  arrive:  { gap: 2,    free: true },
  thunder: { gap: 0.3, always: true },   // a strike you see is always heard
  rainbow: { gap: 20 },
  season:  { gap: 4,    free: true },
  extinct: { gap: 4,    free: true },
  rain:    { gap: 3,    free: true },
  leaves:  { gap: 1,    free: true },
  click:   { gap: 0.04, free: true },
  hoot:    { gap: 0.6, always: true },
  swat:    { gap: 0.15, always: true },
  toss:    { gap: 0.12, always: true },              // something thrown at a friend
  tock:    { gap: 0.08, always: true },              // and down on the grass (a pebble, a stick, a nut)
  splat:   { gap: 0.08, always: true },              // a berry or a snowball bursting
  hug:     { gap: 0.8,  always: true, lift: 1.6 },   // two foragers hug
  rope:    { gap: 0.12, always: true },              // a rope tied on, let go or wriggled against
  step:    { gap: 0.1, always: true },   // (a foot down is cheap and rhythmic: it never counts against the budget)
  jump:    { gap: 0.15, always: true },  // (off its feet: the push and the whoosh)
  land:    { gap: 0.12, always: true },  // and down again
  hopcue:  { gap: 0.05, always: true },  // the moment to press again (a chained dash)
  pick:    { gap: 0.08, always: true },
  pluck:   { gap: 0.08, always: true },
  dawn:    { gap: 4,    free: true },
  found:   { gap: 1.5,  free: true },
  welcome: { gap: 4,    free: true },
  heart:   { gap: 0.6,  always: true },
  collapse: { gap: 2,   always: true },
  shiver:  { gap: 1.5,  always: true },
  growl:   { gap: 3,    always: true },
  breath:  { gap: 5,    always: true },
  wake:    { gap: 5,    always: true },
  pant:    { gap: 0.25, always: true },
  phew:    { gap: 4,    always: true },
  hemdrip: { gap: 0.25, always: true },
  slosh:   { gap: 0.4,  always: true },   // a dish in its hands, slopping at a run
  spill:   { gap: 0.5,  always: true },   // and dropped
  strike:  { gap: 0.15, always: true, lift: 2 },   // the campfire: the flint and steel,
  blow:    { gap: 0.3,  always: true, lift: 2 },   // a breath blown on the spark,
  kindle:  { gap: 0.5,  always: true, lift: 2 },   // the tinder catching and the flame taking,
  stick:   { gap: 0.08, always: true, lift: 2 },   // a stick laid on,
  clack:   { gap: 0.06, always: true, lift: 2 },   // a stone set in the ring,
  chop:    { gap: 0.08, always: true, lift: 1.8 }, // the knife on the chopping block,
  swish:   { gap: 0.12, always: true, lift: 1.6 }, // a quick swipe through the air (cooking-lab.html),
  tinder:  { gap: 0.1,  always: true, lift: 2 },   // the tinder tucked in,
  fizzle:  { gap: 0.8,  always: true, lift: 2 },   // and only smoke, or a fire gone out
  camp:    { gap: 4,    always: true, lift: 2 },   // the first fire making camp
  level:   { gap: 3,    always: true, lift: 1.6 }, // a skill up a level
  plop:    { gap: 0.05, always: true, lift: 2 },   // cooking: a thing into the pot's water (or lifted out),
  stir:    { gap: 0.4,  always: true, lift: 1.6 }, // the spoon going round,
  blup:    { gap: 0.3,  always: true, lift: 1.8 }, // the pot asking for a stir, the stir met, or missed,
  simmer:  { gap: 1,    always: true, lift: 2 },   // a stretch of the pot bubbling (the lab's: the game's comes with the ambience, state.pot),
  dish:    { gap: 1,    always: true, lift: 2 },   // a dish done,
  mess:    { gap: 1,    always: true, lift: 2 },   // and a forager's mess,
  pages:   { gap: 0.3,  always: true, lift: 2 },   // the recipe book opening,
  hearth:  { gap: 0.5,  always: true, lift: 2 },   // and the cooking window (the pot settling on the fire)
  stone:   { gap: 0.3,  always: true, lift: 1.6 }, // the old stone answering
  munch:   { gap: 0.25, always: true, lift: 1.6, verb: 0.06 }, // the forager eating (a mouthful each: small bites come 0.5 s apart)
  angle:   { gap: 0.03, always: true, lift: 1.8 }, // fishing (game.js): the cast, the float, nibbles, the bite, the reel, landed or got away
};

const STEP_SOFT = 0.6;          // the footsteps' level against the meadow's sounds: soft, they come a few times a second
const STEP_TOP = 2200;          // Hz: the felt every footstep goes through (a sprint opens it a little)
let stepWas = 1;                // the last footstep's pitch (SOUNDS.step keeps the next one away from it)

const SOUNDS = {
  // Two notes a third apart, one from each of the pair.
  love(t, o, { species }) {
    const v = voiceOf(species), k = octOf(species), d = pick([0, 1, 2]);
    v(o, note(d, k), t, 0.8);
    v(o, note(d + 2, k), t + 0.16, 0.9);
  },
  // A little rising sparkle, one plink per baby.
  birth(t, o, { species, kids = 3 }) {
    const v = voiceOf(species), k = octOf(species), d = pick([2, 3, 4]);
    for (let i = 0; i < Math.min(kids, 5); i++) v(o, note(d + i, k + 1), t + i * 0.075, 0.55);
  },
  // Not a scream: a muted low knock and one falling note. It happens, the meadow moves on.
  catch(t, o) {
    partial(o, 110, t, 0.25, 0.004, 0.18, 'triangle');
    marimba(o, note(1, -1), t + 0.05, 0.45);
    marimba(o, note(-1, -1), t + 0.2, 0.35);
  },
  starve(t, o, { species }) {
    voiceOf(species)(o, note(2, octOf(species) - 1), t, 0.4);
    voiceOf(species)(o, note(0, octOf(species) - 1), t + 0.35, 0.3);
  },
  // A long life: one soft bell, like a lantern going out.
  old(t, o) { bell(o, note(pick([0, 3]), 0), t, 0.5); },
  // Got away: a whoosh, or a splash when the water saved it. Then relief.
  escape(t, o, { how }) {
    if (how === 'pond') {
      noise(o, t, 0.4, { from: 2200, to: 500, q: 0.7, peak: 0.55, attack: 0.008 });
      [0.12, 0.2, 0.31].forEach(d => partial(o, rand(900, 1500), t + d, 0.04, 0.003, 0.08));
    } else noise(o, t, 0.35, { from: 600, to: 3200, q: 0.8, peak: 0.18 });
    kalimba(o, note(4, 1), t + 0.25, 0.35);
  },
  // A rabbit saw the fox first: two thumps of a hind foot on the ground.
  thump(t, o) {
    for (const d of [0, 0.14]) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.frequency.setValueAtTime(140, t + d); osc.frequency.exponentialRampToValueAtTime(55, t + d + 0.1);
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.28, t + d + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      osc.connect(g).connect(o); osc.start(t + d); osc.stop(t + d + 0.2);
      noise(o, t + d, 0.05, { from: 700, to: 300, q: 0.8, peak: 0.2, type: 'lowpass', attack: 0.002 });
    }
  },
  // A forager swings at a friend (game.js swing): a quick whoosh, and a soft bonk if it lands.
  swat(t, o, { hit = false }) {
    whoosh(o, t, 0.08, 1.4);
    if (!hit) return;
    const osc = ac.createOscillator(), g = ac.createGain(), at = t + 0.09;
    osc.frequency.setValueAtTime(320, at); osc.frequency.exponentialRampToValueAtTime(90, at + 0.12);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.22);
    noise(o, at, 0.06, { from: 900, to: 400, q: 0.8, peak: 0.18, type: 'lowpass', attack: 0.002 });
  },
  // A forager throws something (game.js toss): the arm's whoosh. What it was sounds where it lands.
  toss(t, o) {
    whoosh(o, t, 0.11, 1.2);
  },
  // A pebble or a stick down on the grass: a short woody knock, and the grass taking it.
  tock(t, o) {
    const osc = ac.createOscillator(), g = ac.createGain(), at = t + 0.01;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, at); osc.frequency.exponentialRampToValueAtTime(180, at + 0.07);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.12);
    noise(o, at, 0.05, { from: 2200, to: 900, q: 0.8, peak: 0.06, attack: 0.002 });   // (the grass)
  },
  // A berry or a snowball: a soft splat, wet and brief.
  splat(t, o) {
    const at = t + 0.01;
    noise(o, at, 0.1, { from: 1500, to: 420, q: 0.5, peak: 0.14, type: 'lowpass', attack: 0.003 });
    noise(o, at + 0.02, 0.09, { from: 900, to: 260, q: 0.6, peak: 0.07, type: 'lowpass', attack: 0.004 });
  },
  // Two foragers hug (game.js hug): a warm low hum, two soft notes settling into it.
  hug(t, o) {
    pad(o, [note(0, 0), note(2, 0), note(4, 0)], t, 1.5, 0.5);
    kalimba(o, note(4, 0), t + 0.06, 0.26);
    kalimba(o, note(2, 0), t + 0.26, 0.2);
  },
  // A rope (game.js ropePressed): a creak of twisted grass pulled tight, and tied on (tie), the knot's soft pull.
  rope(t, o, { tie } = {}) {
    noise(o, t, 0.16, { from: 700, to: 1600, q: 3.5, peak: 0.07, attack: 0.03 });
    noise(o, t + 0.05, 0.1, { from: 2600, to: 1800, q: 1.2, peak: 0.035, attack: 0.01 });
    if (!tie) return;
    const osc = ac.createOscillator(), g = ac.createGain(), at = t + 0.17;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, at); osc.frequency.exponentialRampToValueAtTime(130, at + 0.08);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.12, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.14);
  },
  // A swarm moved into its new home: a bell, and the hive buzzing up to meet the queen.
  queen(t, o) {
    bell(o, note(4, -1), t, 0.45);
    [0, 2, 4].forEach((d, i) => buzz(o, note(d, 0), t + 0.3 + i * 0.16, 0.8));
  },
  queenlost(t, o) { buzz(o, note(2, 0), t, 0.7, 0.5); buzz(o, note(0, 0), t + 0.4, 0.6, 0.7); },
  // Newcomers: a hopping arpeggio walking in.
  arrive(t, o, { species }) {
    const v = voiceOf(species), k = octOf(species);
    [0, 2, 1, 3, 4].forEach((d, i) => v(o, note(d, k), t + i * 0.13, 0.5));
  },
  // Each season has its own four-bell phrase, over a low piano note and a swell of the season's chord, with glitter
  // falling as the last bell rings.
  season(t, o, { season = 0 }) {
    const phrases = [[0, 2, 4, 7], [4, 5, 7, 9], [7, 5, 4, 2], [4, 2, 1, 0]];
    const chord = [CHORDS.D, CHORDS.DA, CHORDS.Bm, CHORDS.Em][season];
    piano(o, note(chord[0], -2), t, 0.45, 4, 0.6);
    pad(o, chord.map(d => note(d, -1)), t, 6, 1);
    phrases[season].forEach((d, i) => bell(o, note(d, -1), t + 0.12 + i * 0.42, i === 3 ? 0.7 : 0.55));
    twinkle(t + 1.4, chord, 8, 2.2, season === 3 ? 0.6 : 0.9);
  },
  // A new day's line: a soft "good morning", two piano notes up, a little swell and one glint. Quiet (one comes every
  // twelve minutes), and never quite the same twice.
  dawn(t, o) {
    const chord = pick([CHORDS.D, CHORDS.D, CHORDS.Bm, CHORDS.DA]), a = chord[0], b = pick(chord.slice(1)) + pick([0, 5]);
    piano(o, note(a, 0), t, 0.3, 1.6, 0.8);
    piano(o, note(b, 0), t + rand(0.2, 0.28), 0.28, 2.4, 0.8);
    pad(o, chord.map(d => note(d, -1)), t, 3.2, 0.55);
    celesta(out(rand(-0.6, 0.6), 0.6), note(b, 2), t + 0.6, 0.14);
  },
  // The first of anything: a sparkle rushing up a quick run into a warm chord of bells, a low piano note under it, and
  // glitter that hangs. Made afresh each time (which chord, which run, how the glitter falls), so a run of firsts never
  // sounds the same twice.
  found(t, o) {
    const chord = pick([CHORDS.D, CHORDS.D, CHORDS.DA, CHORDS.A]), land = 0.36, from = chord[0] - pick([3, 4, 5]);
    whoosh(o, t, land);
    const run = [0, 1, 2, 3, 4].map(i => from + i + (i > 1 && Math.random() < 0.3 ? 1 : 0));
    run.forEach((d, i) => kalimba(o, note(d, 1), t + i * land / run.length, 0.18 + i * 0.04));
    chord.forEach((d, i) => bell(out([-0.45, 0.45, 0][i], 0.5), note(d, 0), t + land + i * 0.025, 0.5));
    celesta(o, note(chord[0], 2), t + land, 0.3);
    piano(o, note(chord[0], -2), t + land, 0.45, 3.5, 0.6);
    pad(o, chord.map(d => note(d, -1)), t + land - 0.2, 4.5, 1);
    twinkle(t + land + 0.25, chord, 10, 2.4);
  },
  // Coming into a friend's meadow: a warm rolled piano chord, a bell on top, a swell and glitter. Hello!
  welcome(t, o) {
    const chord = pick([CHORDS.D, CHORDS.DA]);
    whoosh(o, t, 0.3, 0.7);
    [chord[0] - 5, ...chord, chord[0] + 5].forEach((d, i) => piano(o, note(d, -1), t + 0.3 + i * 0.07, 0.32, 3, 0.8));
    bell(o, note(chord[2], 0), t + 0.75, 0.45);
    pad(o, chord.map(d => note(d, -1)), t + 0.2, 5, 1);
    twinkle(t + 0.9, chord, 8, 2);
  },
  extinct(t, o) {
    bell(o, note(2, -1), t, 0.6);
    bell(o, note(-1, -1) * Math.pow(2, 1 / 12), t + 0.8, 0.5);   // a flat sixth: the one sad note
  },
  rain(t, o) { noise(o, t, 2.2, { from: 300, to: 1600, q: 0.6, peak: 0.12, type: 'lowpass' }); },
  // The one loud sound. A strike you can see: the slowed explosion and the roll together, then
  // the sky settling: echoes off the far hills, a gust through the grass, a long grumble.
  // Off screen only the roll and the grumble, late and dark, at most one every few seconds:
  // a storm strikes every ~3 s and these tails are long.
  thunder(t, o, { seen = true, pan = 0 }) {
    if (seen) {
      const hit = out(pan, 0.4, 1, loud);
      duck(t, 0.5, 6);
      boom(hit, t);
      roll(hit, t + 0.1, rand(5, 7), { cut: 500, lumps: 7, peak: 0.5 });
      let at = 0, side = Math.random() < 0.5 ? -1 : 1;
      for (const [v, bright] of [[0.4, 900], [0.25, 650], [0.15, 450]].slice(0, Math.random() < 0.5 ? 2 : 3)) {
        at += rand(0.9, 1.4); side = -side;
        boom(out(side * rand(0.6, 0.9), 0.8, 1, loud), t + at, { sec: 2.2, bright, peak: v, attack: rand(0.04, 0.1), heat: 1.5 });
      }
      const gust = out(-pan, 0.3, 1, loud);
      noise(gust, t + 0.25, 3.2, { from: 900, to: 2600, q: 0.5, peak: 0.09, attack: 0.6 });
      noise(gust, t + 0.6, 2.4, { from: 3000, to: 5500, q: 0.9, peak: 0.035, attack: 0.5 });
      roll(out(pan, 0.7, 1, loud), t + rand(2.5, 3.5), rand(7, 9), { cut: 230, lumps: 6, peak: 0.28, mid: 0.2, heat: 1.1 });
    } else {
      if (t - farAt < 4) return;
      farAt = t;
      const d = rand(0.6, 1.4);
      roll(out(pan, 0.6, 0.7, loud), t + d, rand(4.5, 6), { cut: 300, lumps: 6, peak: 0.45, mid: 0.2 });
      roll(out(pan, 0.8, 0.7, loud), t + d + rand(2.5, 3.5), rand(6, 8), { cut: 200, lumps: 5, peak: 0.22, mid: 0.12, heat: 1.1 });
    }
  },
  rainbow(t, o) { for (let i = 0; i < 8; i++) kalimba(o, note(i, 1), t + i * 0.09, 0.28 - i * 0.02); },
  // Off its feet, and down again (game.js jumpNow, foragerFrame): a soft push off the ground and a whoosh up, then the
  // ground taking it. pace is how fast it went against a walk, hop how much momentum it carries (a chained dash: quicker,
  // brighter, and a little note on top), ground what's underfoot (as step).
  jump(t, o, { pace = 1, ground = 'grass', hop = 0 }) {
    const k = Math.max(0.7, Math.min(2, pace)), up = 1 + hop * 0.5;
    partial(o, (130 + 35 * k) * up, t, 0.05 + hop * 0.02, 0.004, 0.15, 'triangle');
    noise(o, t, 0.2 - hop * 0.04, { from: 480 * up, to: (1600 + 900 * k) * up, q: 0.8, peak: (0.06 + hop * 0.03) * k, attack: 0.13 - hop * 0.04 });
    if (ground === 'water') noise(o, t, 0.22, { from: 2600, to: 900, q: 0.7, peak: 0.12, attack: 0.01 });
    if (hop > 0.01) kalimba(o, note(2 + Math.round(hop * 4), 1), t + 0.03, 0.08 + hop * 0.08);
  },
  land(t, o, { pace = 1, ground = 'grass', hop = 0 }) {
    const soft = ground === 'grass' || ground === 'snow' || ground === 'woods' || ground === 'earth';
    const wet = ground === 'water';
    partial(o, (wet ? 190 : soft ? 108 : 140) * (1 + hop * 0.25), t, wet ? 0.12 : 0.09, 0.003, wet ? 0.28 : 0.18, 'sine');
    noise(o, t, wet ? 0.26 : 0.16, { from: wet ? 3200 : soft ? 700 : 1200, to: wet ? 800 : soft ? 250 : 420, q: 0.7, peak: (wet ? 0.2 : 0.15) + hop * 0.04, type: 'lowpass', attack: 0.002 });
    if (ground === 'snow') noise(o, t + 0.02, 0.12, { from: 2400, to: 5000, q: 1.4, peak: 0.05, attack: 0.01 });
  },
  // The moment to press again: a tiny bright tick, a note higher with each dash the chain keeps.
  hopcue(t, o, { hop = 0 }) {
    celesta(o, note(5 + Math.round(hop * 2), 1), t, 0.04 + hop * 0.03);
  },
  // A foot comes down. pace is how fast the walker goes against a walk (1 = a walk, 2 = a sprint): the quicker, the
  // shorter, brighter, harder and higher it sounds, so it needs no change of its own to run. ground is what's underfoot
  // (game.js groundUnder), each its own sound: 'grass' (a brush of blades on a soft pad), 'earth' (a dull dry tap),
  // 'shore' (damp sand: a squelch), 'woods' (leaf litter and twigs: a crackle), 'snow' (a squeak and crunch), 'ice' (a
  // hard glassy knock) or 'water' (a wade: a slosh and a drip). Their body sits in the middle, 300 Hz to 3 kHz, where a
  // phone's speaker and a car still carry it. No two steps are alike: foot (0 or 1) alternates the pitch a little, and
  // each step comes down a touch early or late, harder or softer, longer or shorter, its pitch never the last one's
  // (`stepWas`), every layer of it a little off the others, and now and then the ground gives something of its own (a
  // seed head, a pebble, a twig, a drip, a creak).
  step(t, o0, { pace = 1, ground = 'grass', foot = 0 }) {
    const p = Math.max(0.3, Math.min(3, Number.isFinite(pace) ? pace : 1)), k = Math.sqrt(p);
    let r = rand(0.9, 1.1);
    if (Math.abs(r - stepWas) < 0.035) r += r < 1 ? -0.035 : 0.035;  // never the same pitch twice running
    stepWas = r; r *= foot ? 0.93 : 1;
    const j = () => rand(0.88, 1.12);                                  // each layer a little off the others
    const s = rand(0.85, 1.2) / k;                                     // this step's length
    t += rand(0, 0.014);                                               // a touch early or late against the stride
    const h = STEP_SOFT * Math.min(1.3, 0.75 + 0.25 * p) * (Math.random() < 0.12 ? rand(1.15, 1.3) : rand(0.78, 1.05));   // how hard it lands (now and then a firmer one)
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = STEP_TOP * Math.min(1.25, k) * rand(0.82, 1.1); o.Q.value = 0.5;
    o.connect(o0);                                                     // (all of it through a felt: soft, never a click)
    const pad = (f, v, len = 0.07) => partial(o, f * k * r * j(), t, v * h * j(), 0.012, len * s);   // the foot's own knock
    const odd = Math.random();                                         // now and then something of the ground's own
    if (ground === 'water') {
      noise(o, t, 0.26 * s, { from: 1800 * k * r * j(), to: 500 * j(), q: 0.7, peak: 0.55 * h * j(), attack: 0.015 });
      noise(o, t + 0.05 * s * j(), 0.14 * s, { from: 700 * j(), to: 1600 * r, q: 1.2, peak: 0.22 * h * j(), attack: 0.03 });   // the water falling back
      for (let i = 0, n = odd < 0.3 ? 2 : 1; i < n; i++)                                                         // a drip or two
        partial(o, rand(650, 1100) * k, t + (0.09 + i * rand(0.05, 0.1)) * s, rand(0.025, 0.05) * h, 0.01, 0.08);
    } else if (ground === 'ice') {
      pad(420, 0.16, 0.05);
      partial(o, 1750 * k * r * j(), t, 0.035 * h * j(), 0.006, 0.1 * j());   // the glassy ring
      noise(o, t, 0.05 * j(), { from: 2600 * j(), to: 1800, q: 1, peak: 0.12 * h * j(), attack: 0.012 });   // the scuff
      if (odd < 0.15) partial(o, rand(210, 280), t + rand(0.03, 0.08), 0.05 * h, 0.02, 0.3, 'triangle');   // the ice creaking under it
    } else if (ground === 'snow') {
      noise(o, t, 0.12 * s, { from: 1900 * k * r * j(), to: 900 * j(), q: 0.8, peak: 0.36 * h * j(), attack: 0.012 });
      noise(o, t + 0.03 * s * j(), 0.08 * s, { from: 2400 * r * j(), to: 1800, q: 1.4, peak: 0.12 * h * j(), attack: 0.012 });   // the squeak
      for (let i = 0, n = Math.random() * 3 | 0; i < n; i++)          // the crust breaking in grains
        noise(o, t + rand(0.01, 0.07) * s, 0.025, { from: rand(1400, 2400), to: 1200, q: 1.3, peak: rand(0.06, 0.12) * h, attack: 0.005 });
      pad(300, 0.1);
    } else if (ground === 'woods') {
      pad(260, 0.16);
      noise(o, t, 0.09 * s, { from: 1400 * k * r * j(), to: 600 * j(), q: 0.8, peak: 0.2 * h * j(), attack: 0.01 });
      for (let i = 0, n = 2 + (Math.random() * 4 | 0); i < n; i++)      // the litter crackling: a few tiny snaps
        noise(o, t + rand(0, 0.09) * s, 0.03, { from: rand(1700, 3300), to: 1400, q: 1.5, peak: rand(0.12, 0.24) * h, attack: 0.004 });
      if (odd < 0.12) partial(o, rand(900, 1300), t + rand(0.01, 0.04), 0.06 * h, 0.002, 0.04, 'triangle');   // a twig snapping
    } else if (ground === 'shore') {
      noise(o, t, 0.16 * s, { from: 350 * j(), to: 1300 * k * r * j(), q: 1.6 * j(), peak: 0.34 * h * j(), attack: 0.01, type: 'lowpass' });   // the suck of the damp
      pad(240, 0.12, 0.06);
      if (odd < 0.2) partial(o, rand(800, 1100), t + rand(0.1, 0.16) * s, 0.025 * h, 0.01, 0.07);   // the wet sand giving a drip
    } else if (ground === 'earth') {
      pad(320, 0.22, 0.06);
      noise(o, t, 0.07 * s, { from: 1000 * k * r * j(), to: 450 * j(), q: 0.8, peak: 0.3 * h * j(), attack: 0.01 });
      if (odd < 0.25) noise(o, t + rand(0.01, 0.05) * s, 0.03, { from: rand(1500, 2400), to: 1300, q: 1.4, peak: 0.12 * h, attack: 0.004 });   // a pebble under the foot
    } else {                                                           // grass: soft, a cushion and a rustle
      pad(190, 0.07, 0.09);                                            // hardly a knock: the turf takes it
      noise(o, t, 0.14 * s, { from: 650 * k * r * j(), to: 280 * j(), q: 0.5, peak: 0.34 * h * j(), attack: 0.025 * j(), type: 'lowpass' });   // the soft press
      noise(o, t + 0.02 * j(), 0.22 * s, { from: 1300 * k * r * j(), to: 1900 * j(), q: 0.6, peak: 0.2 * h * j(), attack: 0.07 * j() });   // the blades rustling
      if (odd < 0.15) noise(o, t + rand(0.04, 0.1) * s, 0.06, { from: rand(2200, 2900), to: 1800, q: 1.2, peak: 0.06 * h, attack: 0.01 });   // a seed head brushed
    }
  },
  // One gust through the leaves, as the meadow's ambience plays them (the game never calls it: the lab's button).
  leaves(t, o, { season = 2 }) {
    const src = ac.createBufferSource(); src.buffer = leafBuf; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    const hi = [4000, 3200, 5000, 3800][season], g = ac.createGain(), len = 4.5;
    lp.frequency.setValueAtTime(hi * 0.8, t); lp.frequency.linearRampToValueAtTime(hi * 1.05, t + 1.8); lp.frequency.linearRampToValueAtTime(hi * 0.8, t + len);
    src.playbackRate.setValueAtTime(0.9, t); src.playbackRate.linearRampToValueAtTime(1.1, t + 1.8); src.playbackRate.linearRampToValueAtTime(0.9, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(2 * LEAVES, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(hp).connect(lp).connect(g).connect(o); src.start(t, rand(0, 5)); src.stop(t + len + 0.05);
  },
  // A friend calls (H): two soft hoots, cupped hands blown like an owl, the second lower and longer.
  hoot(t, o) {
    for (const [dt, f, len] of [[0, 392, 0.28], [0.36, 330, 0.5]]) {
      partial(o, f, t + dt, 0.22, 0.05, len);
      partial(o, f * 2, t + dt, 0.025, 0.05, len * 0.6);
      noise(o, t + dt, len * 0.8, { from: f * 2, to: f * 1.5, q: 2, peak: 0.05, attack: 0.05 });   // (the breath in it)
    }
  },
  click(t, o) { partial(o, 1320, t, 0.06, 0.002, 0.05, 'triangle'); partial(o, 660, t, 0.05, 0.002, 0.08); },
  // Freezing, the forager's heart: a slow soft lub-dub, felt more than heard (v: louder the colder).
  heart(t, o, { v = 1 }) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.Q.value = 0.5; lp.connect(o);
    for (const [dt, a] of [[0, 1], [0.26, 0.65]]) {
      partial(lp, 56, t + dt, 0.55 * v * a, 0.014, 0.18);
      partial(lp, 112, t + dt, 0.2 * v * a, 0.01, 0.1);            // (what a phone's speaker can play of it)
      noise(lp, t + dt, 0.09, { from: 220, to: 90, q: 0.7, peak: 0.25 * v * a, attack: 0.01, type: 'lowpass' });
    }
  },
  // It collapses in the cold: a soft fall into the grass, and two low notes stepping down.
  collapse(t, o) {
    noise(o, t, 0.4, { from: 600, to: 140, q: 0.6, peak: 0.45, attack: 0.02, type: 'lowpass' });
    piano(o, note(2, -1), t + 0.15, 0.5, 1.6, 0.6);
    piano(o, note(0, -1), t + 0.55, 0.45, 2.2, 0.5);
  },
  // A shiver: teeth chattering a moment, soft and quick, with a breath through them (v: harder the colder).
  shiver(t, o, { v = 1 }) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.5; lp.connect(o);
    const n = 5 + (Math.random() * 3 | 0), gap = rand(0.055, 0.07);
    for (let i = 0; i < n; i++) {
      const a = Math.sin(Math.PI * (i + 0.5) / n) * (0.5 + 0.5 * v);
      noise(lp, t + i * gap, 0.025, { from: rand(1500, 2100), to: 1200, q: 2, peak: 0.12 * a, attack: 0.003 });
      partial(lp, rand(700, 820), t + i * gap, 0.02 * a, 0.002, 0.03);
    }
    noise(lp, t, n * gap + 0.1, { from: 320, to: 220, q: 0.8, peak: 0.08 * (0.5 + 0.5 * v), attack: 0.1, type: 'lowpass' });
  },
  // Hungry, its tummy growls: a few low gurgles, each a wobbling rumble that bubbles as it goes (v: louder and longer the emptier).
  growl(t, o, { v = 1 }) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7; lp.connect(o);
    const n = 2 + (Math.random() * (1 + 2 * v) | 0), a = 0.45 + 0.55 * v;
    let at = t;
    for (let i = 0; i < n; i++) {
      const len = rand(0.25, 0.5) * (0.8 + 0.5 * v), f0 = rand(70, 110), osc = ac.createOscillator(), g = ac.createGain();
      const lfo = ac.createOscillator(), depth = ac.createGain(), bub = ac.createOscillator(), bubD = ac.createGain(), amp = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, at); osc.frequency.linearRampToValueAtTime(f0 * rand(1.3, 1.8), at + len * 0.6); osc.frequency.linearRampToValueAtTime(f0 * rand(0.8, 1.1), at + len);
      lfo.frequency.value = rand(9, 16); depth.gain.value = f0 * 0.25; lfo.connect(depth).connect(osc.frequency);   // (the wobble)
      bub.frequency.value = rand(18, 30); bubD.gain.value = 0.5; amp.gain.value = 0.5; bub.connect(bubD).connect(amp.gain);   // (the bubbling)
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16 * a, at + len * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(amp).connect(g).connect(lp);
      for (const x of [osc, lfo, bub]) { x.start(at); x.stop(at + len + 0.05); }
      noise(lp, at + len * 0.2, len * 0.6, { from: 260, to: 140, q: 2, peak: 0.1 * a, attack: len * 0.2 });   // (a gurgle of water in it)
      at += len + rand(0.04, 0.2);
    }
  },
  // Cold, a shaky sigh: a breath out in a few faltering puffs.
  breath(t, o) {
    for (let i = 0; i < 4; i++) noise(o, t + i * rand(0.14, 0.18), 0.26, { from: 1000 - i * 90, to: 700 - i * 60, q: 0.9, peak: 0.11 * (1 - i * 0.18), attack: 0.08 });
  },
  // Out of breath: one pant, a quick breath in and a longer one out, through the mouth (v: how hard, 0..1). The game plays
  // one a breath, quicker the more spent (game.js PANT_MS), so the rhythm is its own.
  pant(t, o, { v = 1 }) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + 900 * v; lp.Q.value = 0.5; lp.connect(o);
    const a = 0.35 + 0.65 * v, r = rand(0.92, 1.08), inn = rand(0.1, 0.13) * (1.3 - 0.3 * v);
    breathe(lp, t, inn, 1900 * r, 2600 * r, 0.035 * a, 0.5);                        // in: short and thin
    breathe(lp, t + inn + 0.02, rand(0.17, 0.22) * (1.4 - 0.4 * v), 1150 * r, 820 * r, 0.075 * a, 0.25);   // out: a soft "hah"
  },
  // Its breath back: a deep breath in and a long "phew" out.
  phew(t, o) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5; lp.connect(o);
    breathe(lp, t, 0.38, 1500, 2200, 0.03, 0.6);
    breathe(lp, t + 0.45, 0.85, 1300, 650, 0.08, 0.18);
  },
  // Soaked, a drop off its hem onto the ground: a tiny soft pat, lower and duller than the rain's off a leaf.
  hemdrip(t, o, { v = 1 }) {
    const f = note(Math.floor(rand(3, 8)), 1), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.setValueAtTime(f * 1.25, t); osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.1);
    noise(o, t, 0.03, { from: 1400, to: 700, q: 1, peak: 0.03 * v, attack: 0.003 });
  },
  // A dish slopping in its hands at a run (game.js slop): the broth slapping the bowl's side, a soft low swash rising and
  // falling back, and a drop or two off the rim. v: how full it still is (fuller, a touch louder).
  slosh(t, o, { v = 1 }) {
    const at = t + 0.005, k = 0.6 + 0.4 * v;
    noise(o, at, 0.12, { from: 380, to: 900, q: 0.9, peak: 0.07 * k, type: 'lowpass', attack: 0.02 });
    noise(o, at + 0.09, 0.14, { from: 760, to: 300, q: 0.8, peak: 0.05 * k, type: 'lowpass', attack: 0.015 });
    for (let i = 0, n = Math.random() < 0.5 ? 1 : 2; i < n; i++) {   // (a drop off the rim, pitched like a bubble)
      const ft = at + 0.16 + i * rand(0.05, 0.09), f = rand(700, 1000), osc = ac.createOscillator(), g = ac.createGain();
      osc.frequency.setValueAtTime(f, ft); osc.frequency.exponentialRampToValueAtTime(f * 1.6, ft + 0.04);
      g.gain.setValueAtTime(0.0001, ft); g.gain.exponentialRampToValueAtTime(0.025 * k, ft + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ft + 0.06);
      osc.connect(g).connect(o); osc.start(ft); osc.stop(ft + 0.08);
    }
  },
  // A dish dropped (game.js drawSpills): the bowl landing with a hollow wooden knock and a smaller bounce, and what was in
  // it splashing out over the grass, wet and heavy.
  spill(t, o) {
    const knock = (at, f, peak) => {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, at); osc.frequency.exponentialRampToValueAtTime(f * 0.45, at + 0.08);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
      osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.15);
    };
    const at = t + 0.01;
    knock(at, 340, 0.16); knock(at + 0.14, 420, 0.07);
    noise(o, at + 0.01, 0.22, { from: 1300, to: 260, q: 0.5, peak: 0.16, type: 'lowpass', attack: 0.004 });
    noise(o, at + 0.05, 0.3, { from: 700, to: 180, q: 0.6, peak: 0.09, type: 'lowpass', attack: 0.01 });
    noise(o, at + 0.02, 0.08, { from: 2600, to: 1400, q: 1, peak: 0.03, attack: 0.003 });   // (the grass taking it)
  },
  // Waking at home after a collapse: three soft notes stepping up, a new morning.
  wake(t, o) {
    piano(o, note(0, 0), t, 0.32, 1.2, 0.7);
    piano(o, note(2, 0), t + 0.32, 0.3, 1.2, 0.7);
    piano(o, note(4, 0), t + 0.64, 0.3, 2.2, 0.7);
  },
  // The forager's hand takes something (what: the ingredient's first tag, recipes.js), each its own sound and none the
  // same twice: berries and fruit a stalk's snap and a leafy rustle, greens a tear, a mushroom a soft twist and pop, nuts
  // clicking in the palm, honey a sticky gloop, sticks a crack, pebbles a clack, tinder a dry crackle. They come often,
  // so they're small and soft.
  pluck(t, o0, { what = '' }) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 5000; o.Q.value = 0.5; o.connect(o0);
    const r = rand(0.85, 1.15), snap = (dt, f, v) => noise(o, t + dt, 0.025, { from: f * r, to: f * 0.6 * r, q: 1.4, peak: v, attack: 0.002 });
    const knock = (dt, f, v, len = 0.05, type = 'triangle') => partial(o, f * r, t + dt, v, 0.002, len, type);
    const rustle = (dt, len, v) => noise(o, t + dt, len, { from: rand(1500, 2200), to: rand(3000, 4200), q: 0.8, peak: v, attack: len * 0.3 });
    if (what === 'fruit' || what === 'berry') {
      rustle(0, rand(0.12, 0.2), 0.06);
      snap(rand(0.03, 0.06), 3200, 0.14);
      const f = rand(700, 1000) * r, p = ac.createOscillator(), g = ac.createGain();   // the pop as it comes away
      p.frequency.setValueAtTime(f, t + 0.06); p.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.12);
      g.gain.setValueAtTime(0.0001, t + 0.06); g.gain.exponentialRampToValueAtTime(0.07, t + 0.065); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      p.connect(g).connect(o); p.start(t + 0.06); p.stop(t + 0.15);
    } else if (what === 'greens' || what === 'flower') {
      rustle(0, rand(0.15, 0.22), 0.07);
      for (let i = 0, n = 2 + (Math.random() * 2 | 0); i < n; i++) snap(0.04 + i * rand(0.025, 0.04), rand(2200, 3400), rand(0.06, 0.1));   // the stems tearing
    } else if (what === 'mushroom') {
      const f = rand(260, 360), p = ac.createOscillator(), g = ac.createGain();         // a twist and a soft pop out of the ground
      p.frequency.setValueAtTime(f, t); p.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.08);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      p.connect(g).connect(o); p.start(t); p.stop(t + 0.14);
      noise(o, t, 0.1, { from: 900, to: 300, q: 0.7, peak: 0.12, attack: 0.01, type: 'lowpass' });
    } else if (what === 'nut') {
      for (let i = 0, n = 2 + (Math.random() * 3 | 0); i < n; i++) knock(i * rand(0.04, 0.07), rand(1100, 1800), rand(0.04, 0.07), 0.04);
    } else if (what === 'sweet') {
      const f = ac.createBiquadFilter(), src = ac.createBufferSource(), g = ac.createGain();   // honey: a sticky gloop
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(rand(250, 320), t); f.frequency.exponentialRampToValueAtTime(rand(800, 1000), t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      src.connect(f).connect(g).connect(o); src.start(t, rand(0, 3)); src.stop(t + 0.3);
      partial(o, rand(180, 220), t + 0.02, 0.06, 0.03, 0.15);
    } else if (what === 'fuel') {
      snap(0, 2600, 0.22); knock(0, 420, 0.1, 0.06);
      for (let i = 0, n = 1 + (Math.random() * 2 | 0); i < n; i++) snap(rand(0.02, 0.07), rand(2000, 3200), rand(0.08, 0.14));
    } else if (what === 'stone') {
      const f = rand(2300, 3000);
      knock(0, f, 0.08, 0.06, 'sine'); knock(0, f * 1.47, 0.03, 0.04, 'sine');
      knock(rand(0.06, 0.09), f * rand(0.85, 1.1), 0.05, 0.05, 'sine');
      snap(0, 3500, 0.06);
    } else if (what === 'tinder') {
      rustle(0, 0.18, 0.05);
      for (let i = 0, n = 4 + (Math.random() * 3 | 0); i < n; i++) snap(rand(0, 0.16), rand(2800, 4200), rand(0.04, 0.08));
    } else rustle(0, 0.15, 0.06);
  },
  // It lands in the satchel: a soft plop into the cloth and a bright little "ding-ding" from the scale. Picks in a row
  // climb the scale one step each (like coins), so a run of picking rises; after a pause it starts again somewhere low.
  // Which instrument, which interval and the timing vary a little every time. own: false for a friend's pick (it
  // doesn't climb). n: how many came, a third sparkle note for a handful.
  pick(t, o, { n = 1, own = true }) {
    const c = picking;
    if (own) { if (t - c.at < PICK_CHAIN) c.n = Math.min(c.n + 1, 6); else { c.n = 0; c.base = pick([0, 1, 2]); } c.at = t; }
    const d = own ? c.base + c.n : Math.floor(rand(0, 4)), v = rand(0.9, 1.1), voice = Math.random() < 0.6 ? kalimba : celesta;
    noise(o, t, 0.08, { from: 500, to: 150, q: 0.6, peak: 0.12, attack: 0.006, type: 'lowpass' });   // the plop
    partial(o, rand(120, 150), t, 0.08, 0.004, 0.08);
    voice(o, note(d, 1), t, 0.4 * v);
    const gap = rand(0.06, 0.09);
    voice(o, note(d + pick([2, 2, 3]), 1), t + gap, 0.34 * v);
    if (n >= 3) celesta(o, note(d + 5, 1), t + gap * 2, 0.2 * v);
  },
  // The campfire. Kept close and gentle, lifted over the meadow (RULES' lift): no note of it is loud, and the scale only comes in when it takes.
  // The flint struck on the steel: a short bright "chk", a tiny ring of the steel, and a softer scrape after it (n: which
  // strike, so two in a row aren't the same).
  strike(t, o, { n = 0 }) {
    const r = 1 + 0.06 * (n % 3 - 1) + rand(-0.03, 0.03);
    noise(o, t, 0.035, { from: 4200 * r, to: 2600, q: 1.4, peak: 0.22, attack: 0.002 });
    partial(o, 3150 * r, t, 0.025, 0.002, 0.07, 'triangle');
    noise(o, t + 0.03, 0.07, { from: 2400 * r, to: 1500, q: 1, peak: 0.07, attack: 0.01 });
  },
  // A breath blown on the spark: air through pursed lips, soft and low, a little stronger as it glows (v: 0.5 to 1).
  blow(t, o, { v = 1 }) {
    noise(o, t, 0.62, { from: 900, to: 520, q: 0.7, peak: 0.07 + 0.06 * v, attack: 0.16, type: 'lowpass' });
    noise(o, t + 0.04, 0.5, { from: 1900, to: 1300, q: 1.1, peak: 0.025 * v, attack: 0.14 });
  },
  // It catches (v small: the tinder flaring as it's blown on) or the flame takes (v 1): a soft whoomph of air drawn into it,
  // a few crackles, and taken, two warm notes stepping up.
  kindle(t, o, { v = 1 }) {
    noise(o, t, 0.5 + 0.4 * v, { from: 180, to: 900, q: 0.6, peak: 0.12 + 0.2 * v, attack: 0.08, type: 'lowpass' });
    for (let i = 0, n = 2 + Math.round(3 * v); i < n; i++) noise(o, t + 0.1 + rand(0, 0.5), 0.02, { from: rand(1800, 3400), to: 1500, q: 1.5, peak: rand(0.06, 0.12) * (0.5 + 0.5 * v), attack: 0.002 });
    if (v > 0.6) { piano(o, note(0, 0), t + 0.25, 0.28 * v, 1.2, 0.6); piano(o, note(2, 0), t + 0.5, 0.26 * v, 1.8, 0.6); }
  },
  // A stick laid on: a soft knock of dry wood, and a little crackle.
  stick(t, o) {
    partial(o, rand(220, 260), t, 0.11, 0.004, 0.08, 'triangle');
    partial(o, rand(620, 700), t, 0.03, 0.002, 0.04);
    noise(o, t + 0.02, 0.05, { from: 2600, to: 1600, q: 1.2, peak: 0.06, attack: 0.004 });
  },
  // A stone set down in the ring: a dull click of stone on stone.
  clack(t, o) {
    partial(o, rand(820, 960), t, 0.07, 0.002, 0.05, 'triangle');
    noise(o, t, 0.04, { from: 1500, to: 900, q: 1.2, peak: 0.1, attack: 0.002 });
  },
  // A knock of the flint knife on the chopping block (game.js chopTap), by how the thing is got ready (recipes.js PREP's
  // word): torn greens a leafy rip and a soft pat; sliced, chopped, halved a crisp cut and the knock of the board under it;
  // crushed a dull thump and a crunch; cracked a sharp crack. The last of a thing knocks a little rounder.
  chop(t, o, { way = 'chopped', last = false }) {
    const knock = (f, v) => { partial(o, f * rand(0.94, 1.06), t + 0.03, 0.1 * v, 0.003, 0.09, 'triangle'); partial(o, f * 2.7 * rand(0.95, 1.05), t + 0.03, 0.03 * v, 0.002, 0.04); };
    if (way === 'torn') {
      noise(o, t, 0.12, { from: 3200, to: 1800, q: 0.7, peak: 0.07, attack: 0.01 });
      noise(o, t + 0.05, 0.08, { from: 2400, to: 1400, q: 0.9, peak: 0.05, attack: 0.008 });
      knock(190, 0.45);
    } else if (way === 'crushed') {
      partial(o, rand(110, 130), t, 0.16, 0.004, 0.12, 'triangle');
      noise(o, t + 0.01, 0.09, { from: 1800, to: 700, q: 1, peak: 0.08, attack: 0.004 });
    } else if (way === 'cracked') {
      noise(o, t, 0.035, { from: 4200, to: 2600, q: 1.4, peak: 0.12, attack: 0.001 });
      knock(240, 0.8);
    } else {
      noise(o, t, 0.045, { from: 5200, to: 3400, q: 1.1, peak: 0.07, attack: 0.002 });   // (the blade through it)
      knock(220, 1);
    }
    if (last) partial(o, rand(300, 340), t + 0.09, 0.05, 0.004, 0.12, 'triangle');
  },
  // A swipe of the blade through the air: a short band of noise falling, quicker and brighter the faster the swipe (v 0..1).
  swish(t, o, { v = 1 }) {
    const len = 0.16 - v * 0.06;
    noise(o, t, len, { from: 5200 + v * 2400, to: 1800, q: 1.1, peak: 0.04 + v * 0.04, attack: len * 0.35 });
    noise(o, t, len * 0.8, { from: 9000, to: 4200, q: 2.2, peak: 0.015 + v * 0.02, attack: len * 0.3 });
  },
  // The tinder tucked in: a dry rustle.
  tinder(t, o) { noise(o, t, 0.18, { from: 2400, to: 3600, q: 0.9, peak: 0.08, attack: 0.05 }); },
  // Only smoke, or a fire gone out: a soft hiss, falling away.
  fizzle(t, o) { noise(o, t, 0.6, { from: 3000, to: 1100, q: 0.8, peak: 0.06, attack: 0.05 }); },
  // Making camp (the meadow's first fire lit): a warm flourish on the felt piano after the flame's whoomph, a run rising up
  // the scale, easing as it goes, into a soft rolled chord over a low note, a bell on top and a swell under it all.
  camp(t, o) {
    const chord = pick([CHORDS.D, CHORDS.D, CHORDS.DA]), t0 = t + 0.35;
    let at = t0;
    const run = [0, 1, 2, 3, 4, 5, 7].map(d => chord[0] - 5 + d + (d > 2 && d < 7 && Math.random() < 0.25 ? 1 : 0));
    run.forEach((d, i) => { piano(o, note(d, 0), at, 0.17 + i * 0.022, 1.6, 0.75); at += 0.08 + i * 0.012; });
    piano(o, note(chord[0], -2), at, 0.4, 4.5, 0.55);
    chord.forEach((d, i) => piano(out([-0.3, 0.3, 0][i], 0.5), note(d, -1), at + 0.05 + i * 0.06, 0.24, 4, 0.7));
    bell(o, note(chord[2], 1), at + 0.2, 0.3);
    pad(o, chord.map(d => note(d, -1)), t0, 5.5, 0.9);
    twinkle(at + 0.3, chord, 6, 2, 0.7);
  },
  // A skill up a level: the one sound that steps outside the pentatonic for a real cadence. A wind-up rushing in, a quick
  // climb up an A7 (the dominant, C# and G pulling home) on kalimba and celesta across the stereo, a hush of the meadow, then
  // it lands on D: a soft deep thump for weight, a rolled piano chord over a low octave, bells, a swell, and two bright tings
  // a beat apart, like a coin into a jar. lv: the new level; each one lands a step higher up the chord.
  level(t, o, { lv = 1 }) {
    const hz = m => 440 * Math.pow(2, (m - 69) / 12), lift = [0, 4, 7][(lv - 1) % 3];   // (D, F# or A on top)
    whoosh(o, t, 0.5, 1.2);
    noise(o, t, 0.55, { from: 180, to: 520, q: 0.6, peak: 0.05, attack: 0.5, type: 'lowpass' });   // (its low rumble)
    let at = t;
    [57, 61, 64, 67, 69, 73, 76, 79].forEach((m, i, a) => {
      const side = out(-0.6 + 1.2 * i / (a.length - 1), 0.45);
      kalimba(side, hz(m), at, 0.16 + i * 0.022);
      if (i > 3) celesta(side, hz(m + 12), at, 0.1);
      at += 0.07 - i * 0.004;
    });
    const land = at + 0.06;
    duck(land - 0.02, 0.55, 2.5);
    const thump = ac.createOscillator(), tg = ac.createGain();                           // the weight under it
    thump.frequency.setValueAtTime(110, land); thump.frequency.exponentialRampToValueAtTime(42, land + 0.35);
    tg.gain.setValueAtTime(0.0001, land); tg.gain.exponentialRampToValueAtTime(0.32, land + 0.008);
    tg.gain.exponentialRampToValueAtTime(0.0001, land + 0.5);
    thump.connect(tg).connect(o); thump.start(land); thump.stop(land + 0.55);
    piano(o, hz(38), land, 0.5, 5, 0.55);
    piano(o, hz(50), land, 0.42, 5, 0.6);
    [62, 66, 69, 74].forEach((m, i) => piano(out([-0.35, -0.12, 0.12, 0.35][i], 0.5), hz(m), land + 0.012 + i * 0.03, 0.3, 4.5, 0.8));
    [74, 78, 81].forEach((m, i) => bell(out([-0.4, 0.4, 0][i], 0.55), hz(m), land + 0.02, 0.42));
    glass(o, hz(86 + lift), land + 0.05, 0.5, 3.5);
    pad(o, [hz(50), hz(57), hz(62), hz(66)], land - 0.15, 6, 1.2);
    celesta(out(0.3, 0.6), hz(93), land + 0.42, 0.42);                                    // ting
    celesta(out(-0.3, 0.6), hz(98 + lift), land + 0.68, 0.5);                             // ting!
    bell(o, hz(86 + lift), land + 0.68, 0.18);
    twinkle(land + 0.85, CHORDS.D, 12, 2.6, 0.9);
  },
  // Cooking at the fire. Water, wood and a warm little tune, kept soft: everything goes through a felt (a low-pass) and the
  // water's pitched sounds come from the scale (bubble, drop), so the pot sings along with the meadow.
  // A thing into the pot's water: the "bloop" of the hole it makes closing over it (a sine sweeping up), the splash's hiss,
  // and a few droplets falling back, each a note of the scale. what: its first tag (recipes.js), w: how heavy (game.js
  // PLOP_W): a fish or game a deep heavy gloop, a mushroom or an apple a round plop, a leaf or a berry a light plip,
  // honey a slow sticky gloop. what 'out': one lifted back out, dripping.
  plop(t, o0, { what = '', w = 1 }) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 3800; o.Q.value = 0.5; o.connect(o0);
    const k = Math.max(0.4, Math.min(1.8, w)), r = rand(0.9, 1.1);
    if (what === 'out') {
      noise(o, t, 0.16, { from: 700, to: 1500, q: 0.8, peak: 0.05, attack: 0.05 });   // the water letting go of it
      const d0 = Math.floor(rand(4, 8));
      for (let i = 0; i < 3; i++) waterDrop(o, t + 0.12 + i * rand(0.09, 0.15), d0 - i * pick([1, 2]), 0.05 - i * 0.012);
      return;
    }
    if (what === 'sweet') {                                // honey: a slow gloop, sticky, then a soft bloop
      const f = ac.createBiquadFilter(), src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 7;
      f.frequency.setValueAtTime(rand(220, 260), t); f.frequency.exponentialRampToValueAtTime(rand(700, 820), t + 0.26);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      src.connect(f).connect(g).connect(o); src.start(t, rand(0, 3)); src.stop(t + 0.4);
    }
    bloop(o, t, 230 / k * r, 0.075 * k, 0.14 * Math.min(1.3, k));
    if (k > 1.3) partial(o, rand(70, 85), t, 0.14, 0.006, 0.18);   // (something heavy: a thump under it)
    noise(o, t, 0.1 + 0.12 * k, { from: 2600 * r, to: 600, q: 0.6, peak: 0.05 + 0.05 * k, attack: 0.004, type: 'lowpass' });   // the splash
    noise(o, t + 0.01, 0.08 + 0.06 * k, { from: 3200, to: 1800, q: 1, peak: 0.025 * k, attack: 0.006 });   // its spray
    const d0 = Math.floor(rand(3, 9)), n = 2 + Math.round(k * 1.5);
    for (let i = 0; i < n; i++) waterDrop(o, t + 0.12 + i * rand(0.05, 0.11) * (0.8 + 0.2 * k), d0 + pick([-2, -1, 1, 2, 3]), (0.045 - i * 0.006) * (0.7 + 0.3 * k));
  },
  // Fishing (game.js), by what: the rod swung and the line whirring out (cast); the float landing light on the water (float);
  // a nibble at the bait, a tick and a plip (nibble); the bite, the float pulled under with a deep gloop and two bright notes
  // (bite); the reel's wooden click, a few to a second while it's wound in (click, v: how hard); the line creaking taut as
  // the fish pulls (creak, v); landed, a slap on the bank, the fish flopping and a happy run up (land); and got away, a
  // splash and two soft notes falling (away); the rod worn out, a dry crack of wood, the line twanging slack, a little creak
  // and two notes falling low (snap).
  angle(t, o0, { what = '', v = 1 }) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 5200; o.Q.value = 0.5; o.connect(o0);
    if (what === 'cast') {                                 // (v: how far it was charged; a tap's cast is 0.6)
      const k = 0.55 + 0.45 * v, len = 0.3 + 0.24 * v;
      whoosh(o, t, 0.12 + 0.06 * v, 1.1 + 0.7 * v);
      noise(o, t + 0.1, len, { from: 1600 + 400 * v, to: 3400 + 1600 * v, q: 7, peak: 0.05 * k, attack: 0.04 });   // the line paying out, zinging
      noise(o, t + 0.1, len, { from: 900, to: 1800 + 600 * v, q: 5, peak: 0.03 * k, attack: 0.04 });
    } else if (what === 'charge') {                        // the cast winding up (v, 0 to 1): the reel's ratchet clicking back, higher and
      const f = 700 + 900 * v;                             // harder as it's drawn, and the rod creaking as it bends
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * rand(0.97, 1.03), t); osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.022);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035 + 0.035 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.05);
      noise(o, t, 0.018, { from: 3600 + 1400 * v, to: 2600, q: 2.2, peak: 0.02 + 0.02 * v, attack: 0.001 });
      noise(o, t + 0.01, 0.1, { from: 280 + 420 * v, to: 340 + 520 * v, q: 10, peak: 0.008 + 0.03 * v * v, attack: 0.04 });   // (the bend)
    } else if (what === 'full') {                          // drawn back as far as it goes: the line pulled taut, a twang, and two bright notes
      const osc = ac.createOscillator(), g = ac.createGain(), f = note(4, 0);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * 1.04, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.5);
      noise(o, t, 0.22, { from: 520, to: 880, q: 9, peak: 0.05, attack: 0.05 });
      kalimba(o, note(4, 1), t + 0.03, 0.26); kalimba(o, note(7, 1), t + 0.1, 0.3);
    } else if (what === 'strain') {                        // held at full: the rod quivering, a low creak now and then
      noise(o, t, 0.28, { from: rand(420, 480), to: rand(380, 440), q: 11, peak: 0.03, attack: 0.1 });
      noise(o, t + 0.06, 0.16, { from: 1100, to: 1300, q: 7, peak: 0.01, attack: 0.06 });
    } else if (what === 'float') {
      bloop(o, t, rand(480, 560), 0.045, 0.07);
      noise(o, t, 0.12, { from: 3000, to: 900, q: 0.7, peak: 0.05, type: 'lowpass', attack: 0.003 });
      const d0 = Math.floor(rand(5, 8));
      for (let i = 0; i < 2; i++) waterDrop(o, t + 0.1 + i * rand(0.07, 0.12), d0 + pick([1, 2]) - i, 0.03 - i * 0.01);
    } else if (what === 'nibble') {
      partial(o, rand(1700, 2000), t, 0.03, 0.002, 0.03, 'triangle');
      waterDrop(o, t + 0.015, Math.floor(rand(6, 9)), 0.028);
    } else if (what === 'bite') {
      bloop(o, t, 150, 0.11, 0.2);
      partial(o, 72, t, 0.14, 0.006, 0.2);
      noise(o, t, 0.24, { from: 2400, to: 500, q: 0.6, peak: 0.12, type: 'lowpass', attack: 0.004 });
      noise(o, t + 0.01, 0.16, { from: 3400, to: 1800, q: 1, peak: 0.04, attack: 0.006 });
      kalimba(o, note(2, 1), t + 0.06, 0.3); kalimba(o, note(4, 1), t + 0.14, 0.34);   // (!)
    } else if (what === 'click') {
      const osc = ac.createOscillator(), g = ac.createGain(), f = rand(1150, 1300);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.025);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.06);
      noise(o, t, 0.02, { from: 4200, to: 2600, q: 2, peak: 0.03 * v, attack: 0.001 });
    } else if (what === 'creak') {
      noise(o, t, 0.34, { from: rand(420, 520), to: rand(760, 900), q: 9, peak: 0.07 * v, attack: 0.12 });
      noise(o, t + 0.05, 0.26, { from: 1300, to: 1700, q: 6, peak: 0.025 * v, attack: 0.08 });
    } else if (what === 'land') {
      noise(o, t, 0.2, { from: 2200, to: 420, q: 0.6, peak: 0.14, type: 'lowpass', attack: 0.003 });   // the slap of it out of the water
      for (const [d, k] of [[0.16, 1], [0.34, 0.75], [0.5, 0.5]]) {                       // flopping on the bank
        const osc = ac.createOscillator(), g = ac.createGain(), at = t + d;
        osc.frequency.setValueAtTime(190, at); osc.frequency.exponentialRampToValueAtTime(90, at + 0.06);
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.12 * k, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.11);
        noise(o, at, 0.06, { from: 1600, to: 600, q: 0.7, peak: 0.05 * k, type: 'lowpass', attack: 0.002 });
      }
      [0, 2, 4].forEach((d, i) => kalimba(o, note(d, 1), t + 0.12 + i * 0.1, 0.3 - i * 0.03));
      bell(o, note(0, 1), t + 0.42, 0.25);
    } else if (what === 'away') {
      noise(o, t, 0.36, { from: 1800, to: 400, q: 0.7, peak: 0.12, type: 'lowpass', attack: 0.006 });
      [0.1, 0.2].forEach(d => waterDrop(o, t + d, Math.floor(rand(4, 7)), 0.03));
      marimba(o, note(2, 0), t + 0.18, 0.4); marimba(o, note(0, 0), t + 0.38, 0.36);
    } else if (what === 'snap') {
      noise(o, t, 0.05, { from: 2600, to: 1200, q: 1.4, peak: 0.16, attack: 0.002 });   // the crack of the stick
      partial(o, rand(820, 900), t, 0.09, 0.002, 0.05, 'triangle'); partial(o, rand(1700, 1900), t + 0.012, 0.04, 0.002, 0.03);
      const osc = ac.createOscillator(), g = ac.createGain();   // the line twanging slack
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note(4, 0), t + 0.03); osc.frequency.exponentialRampToValueAtTime(note(4, 0) * 0.6, t + 0.35);
      g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.exponentialRampToValueAtTime(0.05, t + 0.035); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g).connect(o); osc.start(t + 0.03); osc.stop(t + 0.45);
      noise(o, t + 0.12, 0.22, { from: rand(380, 440), to: rand(300, 340), q: 10, peak: 0.035, attack: 0.08 });   // and a little creak
      marimba(o, note(4, 0), t + 0.32, 0.3); marimba(o, note(1, 0), t + 0.52, 0.34);
    }
  },
  // The spoon going round the pot: the water swished round (a band of noise swelling and moving), now and then the wood
  // knocking softly on the iron.
  stir(t, o0) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 2400; o.Q.value = 0.5; o.connect(o0);
    const len = rand(0.75, 0.95), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(rand(820, 980), t + len * 0.5); f.frequency.linearRampToValueAtTime(420, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + len * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(o); src.start(t, rand(0, 3)); src.stop(t + len + 0.05);
    if (Math.random() < 0.6) { const at = t + rand(0.2, 0.6); partial(o, rand(560, 640), at, 0.05, 0.003, 0.06, 'triangle'); partial(o, rand(1500, 1700), at, 0.012, 0.002, 0.03); }
  },
  // The pot and its stirs (game.js stirBy, PLAN.md stage 12), by what: it wants a stir, a big slow bubble welling up off the
  // bottom and breaking, "blup", with a lower one under it (ask); stirred in time, the water settling and two bright notes up
  // (met); not, a short sizzle of the bottom catching and one low note (caught).
  blup(t, o0, { what = 'ask' }) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 3000; o.Q.value = 0.5; o.connect(o0);
    if (what === 'met') {
      noise(o, t, 0.3, { from: 900, to: 400, q: 0.8, peak: 0.04, attack: 0.03, type: 'lowpass' });
      kalimba(o, note(2, 1), t + 0.02, 0.3); kalimba(o, note(4, 1), t + 0.11, 0.34);
      return;
    }
    if (what === 'caught') {
      noise(o, t, 0.42, { from: 3800, to: 2600, q: 1.2, peak: 0.045, attack: 0.01 });   // the sizzle
      noise(o, t, 0.3, { from: 700, to: 300, q: 0.7, peak: 0.05, attack: 0.02, type: 'lowpass' });
      marimba(o, note(0, -1), t + 0.12, 0.3);
      return;
    }
    bloop(o, t, rand(105, 120), 0.16, 0.16);
    bloop(o, t + rand(0.14, 0.2), rand(150, 170), 0.11, 0.1);
    noise(o, t + 0.1, 0.12, { from: 900, to: 500, q: 0.8, peak: 0.03, attack: 0.01, type: 'lowpass' });
    waterDrop(o, t + 0.24, Math.floor(rand(3, 6)), 0.025);
  },
  // A stretch of the pot simmering (sec seconds; v 0.3 a simmer, 1 a boil): what the ambience plays from state.pot, for the lab.
  simmer(t, o, { sec = 3, v = 1 }) {
    noise(o, t, sec, { from: 240, to: 300, q: 0.7, peak: 0.05 * v, attack: sec * 0.3, type: 'lowpass' });
    for (let at = t + rand(0, 0.1); at < t + sec; at += rand(0.05, 0.3) / v) bubble(o, at, v);
  },
  // A dish done: the steam whooshing up off it as it comes out of the pot, and a warm little run on the kalimba up into a
  // chord over a low felt-piano note, a bell on top and a few sparkles; a perfect one (grade, sim.js potGrade) two bells more
  // climbing over it.
  dish(t, o, { grade = '' } = {}) {
    const chord = pick([CHORDS.D, CHORDS.DA, CHORDS.D]);
    noise(o, t, 0.6, { from: 300, to: 1400, q: 0.6, peak: 0.07, attack: 0.25, type: 'lowpass' });
    bloop(o, t, 200, 0.09, 0.1);
    piano(o, note(chord[0], -1), t + 0.18, 0.32, 2.4, 0.6);
    [chord[0], chord[1], chord[2], chord[0] + 5].forEach((d, i) => kalimba(o, note(d, 1), t + 0.2 + i * 0.1, 0.34 - i * 0.03));
    bell(o, note(chord[2], 1), t + 0.62, 0.22);
    twinkle(t + 0.7, chord, 4, 0.9, 0.5);
    if (grade === 'perfect') { bell(o, note(chord[0] + 7, 1), t + 0.86, 0.2); bell(o, note(chord[2] + 7, 1), t + 1.02, 0.22); }
  },
  // The recipe book opening: the cover lifting (a low soft thump and a creak of paper), then a few pages riffling over, each
  // a quick swish of band-passed noise a little higher and lighter than the last, and a faint note of the scale as it settles.
  pages(t, o0) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 3200; o.Q.value = 0.5; o.connect(o0);
    partial(o, rand(95, 110), t, 0.12, 0.006, 0.16);
    noise(o, t, 0.14, { from: 500, to: 900, q: 0.8, peak: 0.07, attack: 0.04, type: 'lowpass' });
    const n = 4 + Math.floor(rand(0, 2));
    for (let i = 0; i < n; i++) {
      const at = t + 0.14 + i * rand(0.07, 0.11);
      noise(o, at, 0.09, { from: 1500 + i * 220, to: 3200, q: 1.1, peak: 0.07 - i * 0.008, attack: 0.02 });
    }
    piano(o, note(pick([2, 4]), 0), t + 0.12 + n * 0.09, 0.2, 2, 0.6);
  },
  // The cooking window opening: the iron pot set down on the stones (a dull clonk and a short ring), the fire's soft whoomf
  // catching under it, and two low warm notes.
  hearth(t, o0) {
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = 2800; o.Q.value = 0.5; o.connect(o0);
    partial(o, rand(150, 170), t, 0.16, 0.003, 0.14, 'triangle');
    partial(o, rand(430, 470), t, 0.05, 0.002, 0.28);
    partial(o, rand(1180, 1260), t, 0.02, 0.002, 0.18);
    noise(o, t + 0.05, 0.5, { from: 200, to: 700, q: 0.6, peak: 0.09, attack: 0.18, type: 'lowpass' });
    marimba(o, note(0, -1), t + 0.16, 0.3);
    marimba(o, note(4, -1), t + 0.3, 0.26);
  },
  // A forager's mess: a soft puff of dark smoke, a pot-lid rattle, and two low notes stepping down: a shrug, not a fail.
  mess(t, o) {
    noise(o, t, 0.55, { from: 900, to: 180, q: 0.6, peak: 0.12, attack: 0.03, type: 'lowpass' });
    for (let i = 0; i < 3; i++) partial(o, rand(700, 900), t + 0.08 + i * 0.06, 0.03, 0.003, 0.05, 'triangle');
    marimba(o, note(2, -1), t + 0.3, 0.4);
    marimba(o, note(0, -1), t + 0.55, 0.35);
  },
  // Eating (game.js mealTick, a mouthful at a time in time with its munching: EAT_WAYS). Each mouthful: a bite as the mouth
  // shuts on it (first s in), then n chews gap s apart, each a little softer, and a gulp; after the last mouthful (last) a
  // pleased "mm" by its mood ('love', 'like', 'meh'), and a satisfied sigh if that filled the tummy (full). How it's eaten
  // (group: 'spoon', 'hand', 'skewer', 'sip', 'fruit'; left out, by crisp alone) and crisp 0 to 1 pick the mouthfeel
  // (MOUTHFEEL): an apple crunches, bread and meat tear, soup slurps off the spoon, a drink slurps and bubbles. hot: a hot
  // dish blown on first, that many s before the bite (true: 0.7). under: under the lean-to's roof, close and a little
  // dull; friend: a friend eating (game.js heardMunch), softer. seed: the same mouthful every time (the lab's tests).
  munch(t, o0, { group, crisp = 0.5, first = 0.3, gap = 0.17, n = 4, last = true, hot = 0, mood = 'like', full = false, under = false, friend = false, seed }) {
    const r = seeded(seed), feel = MOUTHFEEL[group] || (crisp > 0.4 ? MOUTHFEEL.hand : MOUTHFEEL.spoon);
    const o = ac.createBiquadFilter(); o.type = 'lowpass'; o.frequency.value = under ? 4500 : friend ? 5000 : 14000; o.Q.value = 0.5;
    const g = ac.createGain(); g.gain.value = (friend ? 0.55 : 1) * (hushed() ? 0.6 : 1);   // (under the stone's voice or the music: softer)
    o.connect(g).connect(o0);
    if (under) {                                                                                      // (the roof: one close echo off it)
      const d = ac.createDelay(0.05), dg = ac.createGain(); d.delayTime.value = 0.013; dg.gain.value = 0.28;
      g.connect(d).connect(dg).connect(o0);
    }
    if (hot) { cool(o, t, r); t += hot === true ? 0.7 : hot; }
    for (let i = 0; i <= n; i++) {
      const at = t + first + (i ? i * gap + r(-0.015, 0.015) : 0), v = (i ? 0.75 - 0.08 * i : 1) * r(0.85, 1.1);
      (i ? feel.chew : feel.bite)(o, at, v, r, crisp, i);
          }
    const end = t + first + n * gap + (n ? 0.16 : 0.12);
    gulp(o, end, feel.gulp * 5 * r(0.8, 1.1), r);                                                      // a gulp
    if (!last) return;
    mm(o, end + 0.14, mood, r);
    if (full) sigh(o, end + (mood === 'love' ? 1.05 : 0.7), r);
  },
  // The old stone answering (game.js stoneAsk): a soft knock of rock, then it babbles what it says the way Animal
  // Crossing's villagers do, one quick blip a letter (babble), low and gravelly; the mood sets its tune (STONE_TUNES).
  // With no words (the lab's), a pompous "hm-hm-HMM" on low wood instead.
  stone(t, o, { mood = 'awake', text = '' }) {
    noise(o, t, 0.14, { from: 420, to: 110, q: 0.7, peak: 0.09, attack: 0.004, type: 'lowpass' });
    if (text) return babble(o, t + 0.08, text, STONE_TUNES[mood] || STONE_TUNES.awake);
    const hum = STONE_HUMS[mood] || STONE_HUMS.awake;
    hum.forEach((d, i) => marimba(o, note(d, -1) * rand(0.995, 1.005), t + 0.07 + i * 0.15, i === hum.length - 1 ? 0.75 : 0.5));
  },
};
// The mouthfeels (SOUNDS.munch), each a bite, a chew (i: which, from 1: the food breaking down, a crunch softens) and how
// loud the gulp. c: how crisp.
const CRISP = 0.3;                                 // (crisper than this, it crunches)
const MOUTHFEEL = {
  spoon: { gulp: 0.08,                             // off the spoon: a little slurp, wet soft chews
    bite(o, at, v, r, c) { slurp(o, at, v * 0.6, r, 0.22, 1); chewSoft(o, at, v, r, 1); if (c > CRISP) crunch(o, at, v * 0.6, r, c); },
    chew(o, at, v, r, c, i) { chewSoft(o, at, v, r, 1); if (c > CRISP) crunch(o, at, v * 0.5, r, c * (0.8 - 0.15 * i)); } },
  sip: { gulp: 0.1,                                // the bowl to its lips: a long slurp, bubbling
    bite(o, at, v, r) { slurp(o, at, v, r, 0.45, 3); },
    chew(o, at, v, r) { chewSoft(o, at, v * 0.6, r, 0.6); } },
  hand: { gulp: 0.06,                              // bitten: a crisp thing crunches, bread and meat tear
    bite(o, at, v, r, c) { if (c > CRISP) crunch(o, at, v, r, c); else tear(o, at, v, r); },
    chew(o, at, v, r, c, i) { chewSoft(o, at, v, r, 0.3); if (c > CRISP) crunch(o, at, v * 0.7, r, c * (0.8 - 0.15 * i)); } },
  skewer: { gulp: 0.06,                            // pulled off the stick: a tear, and a char that crunches a little
    bite(o, at, v, r, c) { tear(o, at, v * 1.1, r); if (c > CRISP) crunch(o, at + 0.03, v * 0.6, r, c); },
    chew(o, at, v, r, c, i) { chewSoft(o, at, v, r, 0.4); if (c > CRISP) crunch(o, at, v * 0.5, r, c * (0.7 - 0.15 * i)); } },
  fruit: { gulp: 0.05,                             // small bites: an apple or a nut crunches, a berry squishes, juicy
    bite(o, at, v, r, c) { if (c > CRISP) { crunch(o, at, v, r, c); chewSoft(o, at + 0.02, v * 0.5, r, 0.8); } else chewSoft(o, at, v * 1.1, r, 1); },
    chew(o, at, v, r, c, i) { if (c > CRISP) crunch(o, at, v * 0.7, r, c * (0.85 - 0.2 * i)); chewSoft(o, at, v * 0.8, r, 0.7); } },
};
// A crunch: a sharp crack, a quick run of fractures in the crackle (more and brighter the crisper), the crushed body of
// it, and the thud of the bite felt through the jaw.
function crunch(o, at, v, r, c) {
  ticks(o, at, 0.03, 0.55 * v * c, r, 2800, r(4500, 6000), 1);
  const k = 3 + Math.round(3 * c);
  for (let j = 0, x = at + r(0.006, 0.014); j < k; j++, x += r(0.01, 0.026))
    ticks(o, x, r(0.03, 0.06), 0.38 * v * c * (1 - 0.11 * j), r, 1100, r(2200, 4200), 0.004);
  noise(o, at, 0.11, { from: r(2200, 2800), to: 380, q: 0.6, peak: 0.13 * v, type: 'lowpass', attack: 0.002 });
  thud(o, at, r(130, 160), 0.16 * v, 0.07);
}
// A soft chew: the squelch of it moving (a wet band sliding down), its body, the jaw's thud, and (wet 0 to 1) the lips
// parting with a smack and a fizz of spit.
function chewSoft(o, at, v, r, wet) {
  noise(o, at, 0.07, { from: r(1700, 2200), to: r(550, 750), q: 4.5, peak: 0.1 * v, attack: 0.005 });
  noise(o, at, 0.1, { from: r(1100, 1500), to: 260, q: 0.7, peak: 0.1 * v, type: 'lowpass', attack: 0.006 });
  thud(o, at, r(100, 125), 0.08 * v, 0.06);
  if (wet <= 0) return;
  ticks(o, at + r(0.03, 0.055), 0.014, 0.3 * v * wet, r, 1600, r(2600, 3400), 0.001);
  ticks(o, at, 0.13, 0.09 * v * wet, r, 3500, 6500, 0.03);
}
// A slurp, ending at (the mouth shuts on it): air drawn in over the lips, a narrow band sliding up like a vowel going
// from "oo" to "ee" with a hiss over it, over len s; the liquid churning in it, a fizz and a scatter of bubbles (k: how
// many handfuls).
function slurp(o, at, v, r, len, k) {
  const t0 = at - len * 0.75;
  noise(o, t0, len, { from: r(380, 480), to: r(1700, 2300), q: 5, peak: 0.1 * v, attack: len * 0.65 });
  noise(o, t0, len, { from: r(2800, 3300), to: r(5000, 6000), q: 1.5, peak: 0.045 * v, attack: len * 0.7 });
  ticks(o, t0 + len * 0.3, len * 0.75, 0.14 * v, r, 2200, r(3500, 4500), len * 0.4);
  for (let j = 0, m = 3 + 4 * k; j < m; j++)
    bloop(o, t0 + len * r(0.35, 0.95), r(700, 1900), r(0.012, 0.03), r(0.02, 0.05) * v);
}
// A tear: a soft thing pulled apart in the teeth, fibres stretching (the crackle swelling) and a ragged run of bursts
// each a little higher, then a snap as it gives, over a squish.
function tear(o, at, v, r) {
  const k = 5 + Math.floor(r(0, 3));
  ticks(o, at, k * 0.016 + 0.04, 0.24 * v, r, 900, r(1800, 2600), k * 0.012);
  for (let j = 0, x = at; j < k; j++, x += r(0.011, 0.02))
    noise(o, x, 0.02, { from: r(850, 1000) + j * 140, to: r(1350, 1500) + j * 160, q: 2.2, peak: 0.08 * v * (1 - 0.08 * j), attack: 0.002 });
  ticks(o, at + k * 0.016, 0.025, 0.4 * v, r, 1800, r(3500, 4500), 0.001);
  noise(o, at, 0.12, { from: 1500, to: 320, q: 0.7, peak: 0.09 * v, type: 'lowpass', attack: 0.008 });
  thud(o, at, r(115, 140), 0.1 * v, 0.07);
}
// The swallow, "glk": a click in the throat, a low knock dropping as it goes down, and a small wet bloop after.
function gulp(o, at, v, r) {
  ticks(o, at, 0.012, 0.3 * v, r, 700, r(1300, 1700), 0.001);
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(r(230, 270), at); osc.frequency.exponentialRampToValueAtTime(r(85, 100), at + 0.07);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3 * v, at + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  osc.connect(g).connect(o); osc.start(at); osc.stop(at + 0.15);
  noise(o, at, 0.11, { from: 650, to: 180, q: 0.8, peak: 0.08 * v, type: 'lowpass', attack: 0.004 });
  bloop(o, at + r(0.05, 0.07), r(170, 210), 0.05, 0.12 * v);
}
// A bite felt through the jaw and skull: a low sine knocked in and dropping, dying in len s.
function thud(o, at, f, peak, len) {
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(f * 1.6, at); osc.frequency.exponentialRampToValueAtTime(f * 0.6, at + len);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(g).connect(o); osc.start(at); osc.stop(at + len + 0.02);
}
// A run of ticks (crackBuf, the tiny sharp breaks every crisp or wet sound is made of): above hp Hz, lifted around
// band, swelling in over attack s and gone in dur.
function ticks(o, at, dur, peak, r, hp, band, attack) {
  const src = ac.createBufferSource(), h = ac.createBiquadFilter(), b = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = crackBuf; h.type = 'highpass'; h.frequency.value = hp; h.Q.value = 0.6;
  b.type = 'peaking'; b.frequency.value = band; b.Q.value = 0.9; b.gain.value = 8;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, attack + 0.005));
  src.connect(h).connect(b).connect(g).connect(o);
  src.start(at, r(0, 1.7)); src.stop(at + dur + 0.03);
}
// Blowing on a hot spoonful: two soft puffs, "fff, fffff".
function cool(o, t, r) {
  breathe(o, t + 0.05, 0.22, r(1500, 1700), 1100, 0.035, 0.3);
  breathe(o, t + 0.34, 0.36, r(1400, 1600), 950, 0.045, 0.35);
}
// The "mm" after the last mouthful: a hum through closed lips, by how it liked it. love: three notes up and held; like:
// two up; meh: a short "hm", dropping.
const MM = { love: [[2, 0, 0.035, 0.24], [4, 0.12, 0.033, 0.28], [5, 0.26, 0.03, 0.5]], like: [[2, 0, 0.035, 0.26], [4, 0.12, 0.03, 0.3]],
  meh: [[0, 0, 0.028, 0.16], [-1, 0.13, 0.02, 0.2]] };
function mm(o, at, mood, r) {
  const steps = MM[mood] || MM.like, [, dtEnd, , tail] = steps[steps.length - 1], end = at + dtEnd + tail;
  const osc = ac.createOscillator(), vib = ac.createOscillator(), depth = ac.createGain();
  const lp = ac.createBiquadFilter(), nasal = ac.createBiquadFilter(), g = ac.createGain();
  osc.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.8;
  nasal.type = 'peaking'; nasal.frequency.value = 260; nasal.Q.value = 1.4; nasal.gain.value = 9;
  const f0 = note(steps[0][0], 0) / 2;
  osc.frequency.setValueAtTime(f0 * 0.96, at); depth.gain.setValueAtTime(0, at); g.gain.setValueAtTime(0.0001, at);
  steps.forEach(([d, dt, v]) => {                  // (each note glides in from the last, swells, and wavers as it's held)
    const f = note(d, 0) / 2 * r(0.995, 1.005);
    osc.frequency.setTargetAtTime(f, at + dt, 0.025);
    depth.gain.setTargetAtTime(f * 0.012, at + dt + 0.08, 0.1);
    g.gain.setTargetAtTime(v * 0.55, at + dt, 0.02);
  });
  g.gain.setTargetAtTime(0.0001, end - tail * 0.5, tail * 0.2);
  vib.frequency.value = r(5, 6); vib.connect(depth).connect(osc.frequency);
  osc.connect(lp).connect(nasal).connect(g).connect(o);
  noise(o, at, end - at, { from: 320, to: 280, q: 1.2, peak: 0.012, attack: 0.05 });   // (the breath through the nose)
  for (const x of [osc, vib]) { x.start(at); x.stop(end + 0.1); }
}
// Full: a breath in, a long contented one out, sliding down, and a low warm hum under it.
function sigh(o, at, r) {
  breathe(o, at, 0.32, 700, 1300, 0.016, 0.7);
  breathe(o, at + 0.36, 0.95, r(1150, 1250), 450, 0.04, 0.15);
  partial(o, note(0, -1) * r(0.995, 1.005), at + 0.4, 0.022, 0.1, 0.6, 'triangle');
}
// The stone talking or a piece playing: the small close sounds (the eating) keep under them.
const hushed = () => !!music.piece || ac.currentTime - (last.stone ?? -1e9) < BABBLE_MAX;
// A random number source, from seed if given (the same every time), else Math.random's: r(a, b) a number between.
function seeded(seed) {
  if (seed == null) return rand;
  let s = seed >>> 0 || 1;
  return (a, b) => { s = s + 0x6D2B79F5 >>> 0; let x = Math.imul(s ^ s >>> 15, s | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return a + ((x ^ x >>> 14) >>> 0) / 4294967296 * (b - a); };
}
const STONE_HUMS = { awake: [2, 4, 3], pleased: [2, 3, 5], delighted: [3, 5, 7, 9], grumpy: [3, 2, 1],
  disgusted: [3, 1, -1], shocked: [5, 8] };
// The stone's babble by mood: f its voice (Hz), slide how far it drifts over a sentence (semitones), wobble how much each
// blip strays, pace s a letter.
const STONE_TUNES = {
  awake:     { f: 150, slide: -2, wobble: 2.5, pace: 0.058 },
  pleased:   { f: 165, slide: 1,  wobble: 3,   pace: 0.055 },
  delighted: { f: 185, slide: 4,  wobble: 4,   pace: 0.05 },
  grumpy:    { f: 125, slide: -3, wobble: 1.5, pace: 0.064 },
  disgusted: { f: 115, slide: -5, wobble: 2,   pace: 0.068 },
  shocked:   { f: 210, slide: 3,  wobble: 5,   pace: 0.046 },
};
const BABBLE_MAX = 3.6;                            // s: a long answer babbles its start and stops (the words are in its bubble)
// Each vowel's mouth (two formants, Hz, a stone's: a bit lower than a person's); a consonant is a shorter blip, half shut.
const VOWELS = { a: [700, 1150], e: [430, 1700], i: [300, 2000], o: [480, 800], u: [340, 680], y: [320, 1900] };

// Animalese: every letter a short blip. A sawtooth on the voice's pitch through the letter's two formants, shaken
// on and off by a slow flutter (vocal fry: the gravel in it), and a crunch of grit on each consonant. A space is a
// breath, a comma a pause, an end of sentence a longer one; a question goes up at the end.
function babble(o, t, text, { f, slide, wobble, pace }) {
  const chars = text.toLowerCase().replace(/[^a-z ,.!?;:…-]/g, '');
  const until = t + BABBLE_MAX, ask = /\?\s*$/.test(text);
  let at = t, n = 0;
  for (let i = 0; i < chars.length && at < until; i++) {
    const c = chars[i];
    if (c === ' ') { at += pace * 0.6; continue; }
    if (',;:-'.includes(c)) { at += pace * 2.5; continue; }
    if ('.!?…'.includes(c)) { at += pace * 4; continue; }
    const k = (at - t) / BABBLE_MAX, vowel = VOWELS[c], len = pace * (vowel ? 1.15 : 0.8);
    let semi = slide * k + rand(-wobble, wobble) + (c.charCodeAt(0) % 5 - 2) * 0.6;
    if (ask && chars.length - i < 6) semi += 4;
    const hz = f * Math.pow(2, semi / 12), [f1, f2] = vowel || [520, 1350];
    blip(o, at, len, hz, f1, f2, vowel ? 0.5 : 0.32, n++ % 2);
    if (!vowel) grains(o, at, 0.035, 0.11);
    at += pace;
  }
}

// One blip of the stone's voice (blip: sawtooth, two formants, a fry flutter; grains: the gravel).
function blip(o, t, len, hz, f1, f2, v, alt) {
  const src = ac.createOscillator(), fry = ac.createOscillator(), depth = ac.createGain(), am = ac.createGain(), g = ac.createGain();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(hz * 1.04, t); src.frequency.exponentialRampToValueAtTime(hz, t + len * 0.5);
  fry.type = 'square'; fry.frequency.value = rand(26, 38) * (alt ? 1.1 : 1);
  depth.gain.value = 0.4; am.gain.value = 0.6;
  fry.connect(depth).connect(am.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.setValueAtTime(v, t + len * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  for (const [ff, q, lv] of [[f1, 6, 1], [f2, 8, 0.45]]) {
    const bp = ac.createBiquadFilter(), lg = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; lg.gain.value = lv;
    src.connect(bp).connect(lg).connect(am);
  }
  am.connect(g).connect(o);
  src.start(t); fry.start(t); src.stop(t + len + 0.02); fry.stop(t + len + 0.02);
}
function grains(o, t, dur, peak) {
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = gravelBuf; bp.type = 'bandpass'; bp.frequency.value = rand(1400, 2600); bp.Q.value = 0.9;
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(o);
  src.start(t, rand(0, 1.8)); src.stop(t + dur + 0.02);
}

// A bubble of air coming up through the water and the hole closing behind it: a sine sweeping up fast and dying (f its
// pitch at the start, len how long it rings, v how loud). The heart of every water sound in the pot.
function bloop(o, t, f, len, v) {
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * 3.2, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.4);
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + len * 1.4 + 0.05);
}
// A droplet falling back into the water: a tiny bloop on a note of the scale (deg, high up).
function waterDrop(o, t, deg, v) {
  const f = note(deg, 1), osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(f * 0.7, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.025);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.002, v), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.12);
}
// One bubble breaking on the pot's surface (v: how hard it boils): small and low, on a note of the scale.
function bubble(o, t, v = 1) {
  const f = note(Math.floor(rand(-2, 5)), 0) * rand(0.98, 1.02), len = rand(0.03, 0.07);
  bloop(o, t, f * 0.55, len, rand(0.025, 0.05) * (0.5 + 0.5 * v));
}

// opts: { species, pan (-1..1), near (0..1, how close to the camera), ...sound-specific }
// (Cooking's sounds are in SOUNDS too, after the campfire's: plop, stir, simmer, dish, mess; then pages, hearth for opening the book and the window.)
function play(name, opts = {}) {
  if (!ac || !enabled || !SOUNDS[name]) return false;
  const r = RULES[name], now = ac.currentTime;
  if (now - (last[name] ?? -1e9) < r.gap) return false;
  if (now - recentAt > 1) { recent = 0; recentAt = now; }
  if (!r.always && !r.free && ++recent > 6) return false;    // at most ~6 creature sounds a second
  last[name] = now;
  const ok = v => Number.isFinite(v) ? v : undefined;      // a NaN would throw inside Web Audio
  const near = ok(opts.near) ?? 1;
  const pan = ok(opts.pan) ?? 0;
  SOUNDS[name](now + 0.02, out(pan, (r.verb ?? 0.25) + 0.35 * (1 - near), (r.lift ?? 1) * (0.35 + 0.65 * near)), { ...opts, near, pan });
  return true;
}

// ------------------------------------------------------------------ ambience

// A bed that's been silent a while is cut out of the graph (its sources then aren't rendered at all: a rain on a clear
// day, a fire nobody's lit, bees at night were each a few filters running for nothing) and plugged back in when it
// should sound again: its gain is still ~0 then, and ramps up on its own. gateOf(from, to) is the one wire to pull.
const GATE_QUIET = 0.0008, GATE_AFTER = 10;       // a target under this for this many seconds
function gateOf(from, to) { return { from, to, on: true, quiet: 0 }; }
function gateTick(gt, target, dt) {
  if (target > GATE_QUIET) {
    gt.quiet = 0;
    if (!gt.on) { gt.from.connect(gt.to); gt.on = true; }
  } else if (gt.on && (gt.quiet += dt) > GATE_AFTER) { gt.from.disconnect(gt.to); gt.on = false; }
}

// Rain comes as two bands, panned apart and from different places in the noise, so it sounds
// wide instead of one flat hiss in the middle.
function rainSide(pan, freq) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.4;
  const soft = ac.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 6500; soft.Q.value = 0.5;
  const g = ac.createGain(); g.gain.value = 0;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  src.connect(f).connect(soft).connect(g).connect(p).connect(ambBus); src.start(0, rand(0, 3.5));
  return { f, g, gate: gateOf(g, p) };
}

function loopNoise(filterType, freq, q) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(ambBus); src.start();
  return { f, g, gate: gateOf(g, ambBus) };
}

// The wind: a band of noise that slides up as it blows harder, panned where the gust is, plus a
// thin whistle in the same noise, tuned to the scale, that only shows in a strong gust.
function windVoice() {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.9;
  const g = ac.createGain(); g.gain.value = 0;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = note(8); wf.Q.value = 30;
  const wg = ac.createGain(); wg.gain.value = 0;
  const p = ac.createStereoPanner();
  src.connect(f).connect(g).connect(p).connect(ambBus);
  src.connect(wf).connect(wg).connect(p);
  src.start(0, rand(0, 3.5));
  return { f, g, wf, wg, p };
}

// The leaves of the trees on screen: two loops of leafNoise panned apart, a little out of step,
// that flutter faster and brighter as a gust goes through them.
function leafSide(pan, rate) {
  const src = ac.createBufferSource(); src.buffer = leafBuf; src.loop = true; src.playbackRate.value = rate;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.5;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; lp.Q.value = 0.5;
  const g = ac.createGain(); g.gain.value = 0;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  src.connect(hp).connect(lp).connect(g).connect(p).connect(ambBus); src.start(0, rand(0, 5.5));
  return { src, lp, g, rate, gate: gateOf(p, ambBus) };
}

function buildAmbience() {
  amb.wind = windVoice();
  amb.leavesL = leafSide(-0.55, 0.97); amb.leavesR = leafSide(0.55, 1.04);
  amb.rainL = rainSide(-0.7, 2300); amb.rainR = rainSide(0.7, 2600);
  amb.rainLow = loopNoise('lowpass', 350, 0.5);
  amb.fire = loopNoise('lowpass', 420, 0.6);              // a campfire's soft roar (state.fire), crackling over it (crackle)
  amb.pot = loopNoise('lowpass', 260, 0.7);               // the pot on it, simmering (state.pot), bubbles breaking over it (bubble)
  amb.roof = loopNoise('bandpass', 850, 1.1);             // rain on the lean-to's thatch over its head (state.roof): a soft close patter
  amb.under = 0;                                          // (how far under it, eased: the rain outside muffles as it goes in)
  amb.hum = hiveHum();
  amb.lap = loopNoise('lowpass', 520, 0.8);              // the water lapping at the bank by you, fishing (state.lull)
  amb.calm = 0.5; amb.blow = null; amb.gust = 0; amb.swell = 0.5; amb.tube = 2;
}

// What the meadow should sound like right now.
function mix() {
  const p = state.phase, s = state.season;
  const sky = k => state.sky[k] || 0;
  const dayness = p < 0.05 ? p / 0.05 : p > 0.72 ? 0 : p > 0.64 ? (0.72 - p) / 0.08 : 1;
  const wet = Math.min(1, sky('rain') + sky('storm')), L = state.lull;   // (L: fishing, the wait settling, the meadow hushed round you)
  const grey = Math.max(0, 1 - 0.8 * wet - 0.6 * sky('fog') - 0.3 * sky('cloudy') - 0.5 * sky('snow'));
  return {
    day: dayness,
    birds: dayness * [1, 0.7, 0.4, 0.15][s] * (p < 0.2 ? 1.6 : 1) * grey,   // dawn chorus
    crickets: (1 - dayness) * [0.5, 1, 0.6, 0][s] * (1 - wet) * (1 - sky('snow')),
wind: (1 - 0.35 * L) * [0.5, 0.35, 0.7, 0.85][s] * (1 + 0.3 * sky('cloudy') + 0.8 * sky('storm') - 0.5 * sky('fog') - 0.4 * sky('heat')),
    windHi: [700, 600, 900, 1300][s],
    rain: wet, storm: sky('storm'),
    cicadas: dayness * sky('heat'),
    snow: Math.max(sky('snow'), s === 3 ? 0.3 * dayness : 0),
    hush: Math.max(sky('fog'), 0.7 * sky('snow'), 0.3 * L),
    bees: (1 - 0.6 * L) * Math.min(1, state.bees / 12),
    chimes: (1 - 0.7 * L) * Math.min(1, state.life) ** 1.5 * (0.5 + 0.5 * dayness),
    lull: L,    // a busy meadow, a busy chime
    leaves: Math.min(1, state.trees) * [0.6, 0.75, 1, 0.12][s] * (1 - 0.8 * sky('snow')),   // fresh, full, dry, bare
    leafHi: [4000, 3200, 5000, 3800][s],          // summer's full crowns are a soft shh, autumn's dry ones crisp
  };
}

function tickAmbience() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime, m = mix();

  windTick(now, m);

  // Rain breathes slowly, and in a storm leans into the gusts.
  amb.swell = Math.max(0, Math.min(1, amb.swell + (Math.random() - 0.5) * 0.05));
  const gust = amb.gust * m.storm, rainLvl = 0.85 + 0.3 * amb.swell + 0.5 * gust;
  // Under the lean-to the rain outside is muffled (its hiss down, its low rush a little up: through the roof) and the thatch
  // patters close overhead, breathing with the rain.
  amb.under += ((state.roof || 0) - amb.under) * 0.25;
  const muff = 1 - 0.65 * amb.under, roofLvl = 0.07 * Math.min(1, m.rain + m.storm) * amb.under * (0.8 + 0.4 * amb.swell + 0.4 * gust);
  amb.rainL.g.gain.setTargetAtTime((0.055 * m.rain + 0.025 * m.storm) * rainLvl * (1 + 0.2 * gust) * muff, now, 1.5);
  amb.rainR.g.gain.setTargetAtTime((0.055 * m.rain + 0.025 * m.storm) * rainLvl * (1 - 0.1 * gust) * muff, now, 1.5);
  amb.rainLow.g.gain.setTargetAtTime((0.10 * m.rain + 0.06 * m.storm) * rainLvl * (1 + 0.3 * amb.under), now, 2);
  amb.roof.g.gain.setTargetAtTime(roofLvl, now, 0.8);
  amb.hum.gain.setTargetAtTime(0.03 * m.bees, now, 1.5);
  const rl = (0.055 * m.rain + 0.025 * m.storm) * rainLvl * muff, rlow = (0.10 * m.rain + 0.06 * m.storm) * rainLvl * (1 + 0.3 * amb.under);
  gateTick(amb.rainL.gate, rl, 0.2); gateTick(amb.rainR.gate, rl, 0.2); gateTick(amb.rainLow.gate, rlow, 0.2); gateTick(amb.roof.gate, roofLvl, 0.2);
  gateTick(amb.hum.gate, 0.03 * m.bees, 0.2); gateTick(amb.fire.gate, 0.06 * state.fire, 0.2); gateTick(amb.pot.gate, 0.05 * state.pot, 0.2);
  amb.fire.g.gain.setTargetAtTime(0.06 * state.fire, now, 0.6);
  amb.pot.g.gain.setTargetAtTime(0.05 * state.pot, now, 0.5);
  hush.frequency.setTargetAtTime(12000 - 9500 * m.hush, now, 2);
  // Fishing, the wait settling (state.lull): the water laps close, slow swells of it; the music and the meadow's own sounds
  // step back a little.
  const lap = 0.045 * m.lull * (0.65 + 0.35 * Math.sin(now * 0.9) * Math.sin(now * 0.37));
  amb.lap.g.gain.setTargetAtTime(lap, now, 0.8); gateTick(amb.lap.gate, lap, 0.2);
  musicBus.gain.setTargetAtTime(0.45 * (1 - 0.35 * m.lull), now, 3);
  fxBus.gain.setTargetAtTime(0.9 * (1 - 0.3 * m.lull), now, 3);

  // Scattered one-shots, each rolled a few times a second.
  const dt = 0.2;
  birdTick(now, m.birds);
  if (Math.random() < m.crickets * 2.2 * dt) cricket(now + rand(0, 0.2));
  if (Math.random() < (1 - m.day) * state.frogs * 0.5 * dt) croak(now + rand(0, 0.2));   // spring nights, while there's spawn about
  if (Math.random() < m.rain * 4 * amb.under * dt) SOUNDS.hemdrip(now + rand(0, 0.2), out(rand(-0.5, 0.5), 0.3, 0.5), { v: rand(0.6, 1.2) });   // (off the eave, by your ear)
  if (Math.random() < m.rain * 3 * (1 - 0.6 * amb.under) * dt) {
    const deg = drip(now + rand(0, 0.2), rand(0.5, 1.3));
    if (Math.random() < 0.2) drip(now + rand(0.25, 0.4), 0.5, deg + pick([-1, 1]));   // then a smaller one off the leaf
  }
  if (Math.random() < m.snow * 0.15 * dt) snowChime(now);
  if (Math.random() < state.fire * 5 * dt) crackle(now + rand(0, 0.2), state.fire);   // a campfire crackling
  if (Math.random() < state.torch * 3 * dt) crackle(now + rand(0, 0.2), 0.55 * state.torch, state.torchPan);   // a torch: the same snaps, quieter, from where it stands
  if (state.pot > 0) for (let i = 0, n = Math.round(state.pot * state.pot * 7 * Math.random() + (Math.random() < state.pot * 2.5 * dt ? 1 : 0)); i < n; i++)
    bubble(out(rand(-0.15, 0.15), 0.2, 0.9), now + rand(0, 0.2), state.pot);                // the pot bubbling: now and then a bubble, a boil a stream of them
  if (Math.random() < m.lull * 0.5 * dt) bubble(out(rand(-0.4, 0.4), 0.35, 0.4), now + rand(0, 0.2), 0.4);   // (fishing: now and then a plip by the bank)
  if (Math.random() < m.cicadas * 0.12 * dt) cicada(now);
  if (Math.random() < (0.08 + 1.4 * m.chimes) * (0.5 + amb.gust) * dt) chime(now + rand(0, 0.2));
  musicTick(now, m);
}

// Wind comes in gusts: each one swells for a couple of seconds, holds, dies away and crosses the
// meadow from one side to the other as it goes. Between gusts the air drifts low, sometimes
// nearly still. The grass rustles as a gust peaks (dry leaves in autumn), and a strong one whistles.
const smooth = x => x * x * (3 - 2 * x);
function windTick(now, m) {
  amb.calm = Math.max(0, Math.min(1, amb.calm + (Math.random() - 0.5) * 0.04));
  if (!amb.blow && Math.random() < 0.012 * (0.5 + m.wind) + 0.03 * m.storm) {
    const side = pick([-1, 1]) * rand(0.2, 0.6);
    amb.blow = { t0: now, rise: rand(1.2, 3), hold: rand(0.3, 1.5), fall: rand(2.5, 5), peak: rand(0.4, 1),
                 from: side, to: -side, deg: Math.floor(rand(7, 11)), rustled: false };
  }
  let env = 0, pan = 0;
  const b = amb.blow;
  if (b) {
    const age = now - b.t0, len = b.rise + b.hold + b.fall;
    env = age < b.rise ? smooth(age / b.rise) : age < b.rise + b.hold ? 1 : 1 - smooth(Math.min(1, (age - b.rise - b.hold) / b.fall));
    pan = b.from + (b.to - b.from) * Math.min(1, age / len);
    if (!b.rustled && age >= b.rise) {
      b.rustled = true;
      if (b.peak * m.wind > 0.3 && m.snow < 0.5) rustle(now, pan, state.season === 2 ? 1 : 0.4 * b.peak);
    }
    if (age >= len) amb.blow = null;
  }
  amb.gust = env * (b ? b.peak : 0);
  const w = m.wind * (0.12 + 0.25 * amb.calm + 0.9 * amb.gust) * (1 - 0.4 * m.rain + 0.6 * m.storm);
  amb.wind.g.gain.setTargetAtTime(0.25 * w, now, 0.5);
  amb.wind.f.frequency.setTargetAtTime(m.windHi * (0.35 + 0.15 * amb.calm + 0.7 * amb.gust), now, 0.6);
  amb.wind.p.pan.setTargetAtTime(pan, now, 0.8);
  // The whistle: only in a hard gust (winter, a storm, a strong autumn one), bending up into its note.
  const hard = Math.max(0, m.wind * amb.gust - 0.4);
  if (b) amb.wind.wf.frequency.setTargetAtTime(note(b.deg) * (0.96 + 0.04 * env), now, 0.4);
  amb.wind.wg.gain.setTargetAtTime(WHISTLE * hard, now, 0.5);
  // The leaves stir in the drift between gusts and rush as one goes through, louder on its side.
  const l = LEAVES * m.leaves * Math.min(1.3, m.wind) * (0.1 + 0.2 * amb.calm + 0.8 * amb.gust) * (1 - 0.4 * m.rain);
  for (const [side, v] of [[amb.leavesL, 1 - 0.6 * pan], [amb.leavesR, 1 + 0.6 * pan]]) {
    side.g.gain.setTargetAtTime(l * v, now, 0.4);
    gateTick(side.gate, l * v, 0.2);
    side.src.playbackRate.setTargetAtTime(side.rate * (0.9 + 0.2 * amb.gust), now, 0.5);
    side.lp.frequency.setTargetAtTime(m.leafHi * (0.8 + 0.25 * amb.gust), now, 0.5);
  }
}
const WHISTLE = 1;                                 // kept well under the gust: a hint of a tone, not a note
const LEAVES = 0.03;                               // the leaves at full rush: a soft shh well under the wind

// Bees at work on screen: a faint drone in tune (D and A), with wings fluttering and a slow wobble.
function hiveHum() {
  const g = ac.createGain(); g.gain.value = 0;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
  const am = ac.createGain(); am.gain.value = 0.7;
  const wing = ac.createOscillator(), depth = ac.createGain();
  wing.frequency.value = 23; depth.gain.value = 0.3; wing.connect(depth).connect(am.gain); wing.start();
  const wobble = ac.createOscillator(), cents = ac.createGain();
  wobble.frequency.value = 0.3; cents.gain.value = 6; wobble.connect(cents); wobble.start();
  for (const [f, v] of [[note(0, -1), 1], [note(0, -1) * 1.004, 0.7], [note(3, -1), 0.5]]) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; og.gain.value = v;
    cents.connect(o.detune); o.connect(og).connect(lp); o.start();
  }
  lp.connect(am).connect(g).connect(ambBus);
  g.gate = gateOf(g, ambBus);
  return g;
}

// Birds. They sing almost pure tones; what makes them sound alive is that pitch and loudness
// move along smooth curves, never straight lines. They're nature, not music, so they're not tied
// to the scale. voice(): fx and ax give pitch (Hz) and loudness (0..1) for x from 0 to 1,
// sampled every 2 ms, with a hair of drift so no two notes are the same.
const ease = x => x * x * (3 - 2 * x);
const arch = (x, p = 0.7) => Math.pow(Math.sin(Math.PI * x), p);
const early = x => Math.pow(Math.sin(Math.PI * Math.pow(x, 0.55)), 0.8);   // quick rise, longer fall
function voice(o, t, len, fx, ax, amp, k = 1) {
  const N = Math.max(8, Math.round(len * 500)), fc = new Float32Array(N), gc = new Float32Array(N);
  let drift = 0;
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    drift = 0.9 * drift + (Math.random() - 0.5) * 0.003;
    fc[i] = k * fx(x) * (1 + drift); gc[i] = amp * ax(x);
  }
  gc[0] = gc[N - 1] = 0;
  const g = ac.createGain(); g.gain.value = 0; g.gain.setValueCurveAtTime(gc, t, len); g.connect(o);
  for (const [mul, a] of [[1, 1], [2, 0.05]]) {
    const osc = ac.createOscillator(), og = ac.createGain(); og.gain.value = a;
    osc.frequency.setValueCurveAtTime(mul === 1 ? fc : fc.map(v => v * 2), t, len);
    osc.connect(og).connect(g); osc.start(t); osc.stop(t + len + 0.01);
  }
  return len;
}
// Syllables. Each returns a singer (o, t, amp, k) that sings it and says how long it took.
const SYL = {
  // A clear whistle from f1 to f2, bowed up or down in the middle by `bend`.
  whistle: (f1, f2, len, bend = 0) => (o, t, a, k) => voice(o, t, len, x => f1 + (f2 - f1) * ease(x) + f1 * bend * Math.sin(Math.PI * x), early, a, k),
  // A quick drop from high to low, the building block of trills.
  chip: (hi, lo, len = 0.03) => (o, t, a, k) => voice(o, t, len, x => lo + (hi - lo) * (1 - x) * (1 - x), x => arch(x, 0.5), a, k),
  // A note that wobbles fast in pitch, and a little in loudness with it.
  warble: (f, rate, depth, len) => (o, t, a, k) => voice(o, t, len,
    x => f * (1 + depth * Math.sin(2 * Math.PI * rate * len * x)) * (1 - 0.06 * x),
    x => early(x) * (0.75 + 0.25 * Math.sin(2 * Math.PI * rate * len * x)), a, k),
  // A thin, high, held "tseee".
  tsee: (f, len) => (o, t, a, k) => voice(o, t, len, x => f * (1 + 0.05 * x), x => arch(x, 1), a, k),
};

// Four kinds of songbird. make() gives a bird its own version of its kind's song, so each one
// is recognisable; sing() sings it with small changes each time.
const SONGS = {
  // Chaffinch: a trill that speeds up as it falls, a few slower notes, and a flourish at the end.
  chaffinch: {
    make: () => ({ top: rand(4300, 5200), fall: rand(0.15, 0.3), n1: Math.floor(rand(5, 8)), n2: Math.floor(rand(2, 4)), end: rand(2900, 3500) }),
    sing(o, t, p, k) {
      let s = t;
      for (let i = 0; i < p.n1; i++) {
        const f = p.top * (1 - p.fall * 0.5 * i / p.n1);
        SYL.chip(f * 1.12, f * 0.82, 0.035)(o, s, 0.05, k);
        s += 0.11 - 0.035 * i / p.n1;
      }
      const f2 = p.top * (1 - p.fall);
      for (let i = 0; i < p.n2; i++) { SYL.chip(f2 * 1.08, f2 * 0.78, 0.05)(o, s, 0.055, k); s += 0.1; }
      SYL.chip(p.end * 1.5, p.end * 1.1, 0.03)(o, s + 0.02, 0.04, k);
      SYL.whistle(p.end * 1.25, p.end * 0.75, 0.2, 0.08)(o, s + 0.08, 0.06, k);
    },
  },
  // Great tit: "tea-cher, tea-cher, tea-cher", a high note and a lower one, three to five times.
  greatTit: {
    make: () => ({ hi: rand(4800, 6000), lo: rand(0.6, 0.72), reps: Math.floor(rand(3, 6)), pace: rand(0.26, 0.34) }),
    sing(o, t, p, k) {
      for (let r = 0, reps = p.reps + pick([-1, 0, 0, 1]); r < reps; r++) {
        const s = t + r * p.pace * rand(0.96, 1.04);
        SYL.whistle(p.hi, p.hi * 0.96, 0.08, 0.03)(o, s, 0.05, k);
        SYL.whistle(p.hi * p.lo * 1.06, p.hi * p.lo * 0.9, 0.07)(o, s + 0.12, 0.045, k);
      }
    },
  },
  // Robin: a wistful, wandering phrase, put together each time from the bird's own few syllables.
  robin: {
    make: () => ({ vocab: Array.from({ length: 7 }, () => pick([
      () => SYL.tsee(rand(6000, 7500), rand(0.08, 0.16)),
      () => SYL.whistle(rand(2500, 4500), rand(2500, 5500), rand(0.1, 0.25), rand(-0.1, 0.15)),
      () => SYL.warble(rand(3000, 5000), rand(14, 26), rand(0.05, 0.12), rand(0.12, 0.25)),
      () => SYL.chip(rand(5000, 7000), rand(2500, 3500), rand(0.03, 0.05)),
    ])()) }),
    sing(o, t, p, k) {
      let s = t;
      for (let i = 0, n = Math.floor(rand(4, 8)); i < n; i++) s += pick(p.vocab)(o, s, rand(0.035, 0.055), k) + rand(0.04, 0.12);
    },
  },
  // Blackbird: low, fluty, unhurried notes, often ending in a quiet squeaky twitter.
  blackbird: {
    make: () => ({ vocab: Array.from({ length: 5 }, () => Math.random() < 0.6
      ? SYL.whistle(rand(1500, 2600), rand(1400, 2800), rand(0.15, 0.3), rand(-0.08, 0.12))
      : SYL.warble(rand(1700, 2500), rand(8, 14), rand(0.04, 0.08), rand(0.2, 0.35))) }),
    sing(o, t, p, k) {
      let s = t;
      for (let i = 0, n = Math.floor(rand(3, 6)); i < n; i++) s += pick(p.vocab)(o, s, rand(0.06, 0.08), k) + rand(0.03, 0.09);
      if (Math.random() < 0.6) for (let i = 0, n = Math.floor(rand(3, 6)); i < n; i++) {
        const f = rand(5000, 7000);
        s += SYL.chip(f, f * 0.7, 0.03)(o, s + 0.05, 0.025, k) + 0.04;
      }
    },
  },
};

// The birds that live around the meadow. Each keeps to its spot, sings every few seconds for a
// while, then goes quiet for a while. Far ones are softer, duller and more echoey. How much the
// meadow sings (time of day, season, weather) stretches the gaps between songs.
const residents = Object.keys(SONGS).map((kind, i, all) => ({
  kind, p: SONGS[kind].make(), pan: -0.75 + 1.5 * ((i * 3) % all.length) / (all.length - 1) + rand(-0.1, 0.1),
  dist: rand(0.1, 0.8), every: rand(5, 9), next: 0, awake: true, boutEnd: 0,
}));
function birdOut(b) {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000 - 7000 * b.dist;
  lp.connect(out(b.pan, 0.2 + 0.45 * b.dist, (0.6 - 0.35 * b.dist) * BIRDS));
  return lp;
}
function birdTick(now, activity) {
  for (const b of residents) {
    if (!b.boutEnd) { b.boutEnd = now + rand(10, 60); b.next = now + rand(0.5, b.every); }
    if (now > b.boutEnd) { b.awake = !b.awake; b.boutEnd = now + (b.awake ? rand(40, 90) : rand(20, 50)); b.next = now + rand(1, 3); }
    if (!b.awake || now < b.next) continue;
    if (Math.random() < activity) SONGS[b.kind].sing(birdOut(b), now + rand(0.05, 0.2), b.p, rand(0.97, 1.03));
    b.next = now + b.every * rand(0.75, 1.3) / Math.max(1, activity);         // the dawn chorus sings faster
  }
}

// A cricket: three quick pulses of a high tone.
function cricket(t) {
  const o = out(rand(-1, 1), 0.2, rand(0.2, 0.45)), f = rand(4200, 5200);
  for (let i = 0; i < 3; i++) partial(o, f, t + i * 0.045, 0.03, 0.005, 0.025);
}

// A common frog by the water: a soft low purr, two to four times, on the scale's root or its third.
function croak(t) {
  const o = out(rand(-0.9, 0.9), 0.35, rand(0.2, 0.45)), f = note(pick([0, 2]), -1) * rand(0.99, 1.01);
  for (let k = 0, n = 2 + Math.floor(rand(0, 3)); k < n; k++) {
    const s = t + k * rand(0.3, 0.42), len = rand(0.16, 0.26);
    const osc = ac.createOscillator(), lfo = ac.createOscillator(), depth = ac.createGain(), am = ac.createGain(), lp = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = f; lfo.frequency.value = rand(18, 26); depth.gain.value = 0.5; am.gain.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 650;
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    lfo.connect(depth).connect(am.gain);
    osc.connect(lp).connect(am).connect(g).connect(o);
    osc.start(s); lfo.start(s); osc.stop(s + len + 0.05); lfo.stop(s + len + 0.05);
  }
}

// Rain on the pond: tiny tuned plinks.
function drip(t, v = 1, deg = Math.floor(rand(0, 10))) {
  const o = out(rand(-1, 1), 0.4, rand(0.15, 0.4) * v), f = note(deg, 2);
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(f * 0.8, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.15);
  return deg;
}

// A cicada in the heat: a buzz that swells and fades.
function cicada(t) {
  const o = out(rand(-1, 1), 0.3, rand(0.3, 0.6)), len = rand(2, 4);
  const osc = ac.createOscillator(), lfo = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
  osc.frequency.value = rand(4400, 5600); lfo.frequency.value = rand(35, 55); depth.gain.value = 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + len * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const am = ac.createGain(); am.gain.value = 0.5;
  lfo.connect(depth).connect(am.gain);
  osc.connect(am).connect(g).connect(o);
  osc.start(t); lfo.start(t); osc.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
}

const rustle = (t, pan = rand(-1, 1), v = 1) => noise(out(pan, 0.2, 0.8 * v), t, rand(0.6, 1.2), { from: 1800, to: 4200, q: 0.9, peak: 0.08 });
// The wind chime: six tubes from the scale. The clapper swings to a tube beside the last one,
// so the notes wander up and down like a slow tune instead of jumping about.
function chime(t) {
  amb.tube = Math.max(0, Math.min(5, amb.tube + pick([-1, -1, 1, 1, 2, -2])));
  bell(out(rand(0.2, 0.45), 0.7, 0.35), note(amb.tube + 4, 0), t, rand(0.35, 0.6));
}

const snowChime = t => kalimba(out(rand(-1, 1), 0.7, 0.3), note(Math.floor(rand(5, 10)), 1), t, 0.4);

// A campfire crackling: a pop or a few, tiny dry snaps of wood in the heat, in the middle (v: how near and well it burns).
// A torch's crackle is the same, quieter and from where it stands (pan), with no roar under it.
function crackle(t, v = 1, pan = rand(-0.25, 0.25)) {
  const o = out(pan, 0.2, 0.5 + 0.5 * v);
  for (let i = 0, n = 1 + Math.floor(rand(0, 3.5)); i < n; i++) {
    const at = t + i * rand(0.03, 0.11);
    noise(o, at, 0.018, { from: rand(1600, 3600), to: 1200, q: 1.6, peak: rand(0.05, 0.13), attack: 0.002 });
    if (Math.random() < 0.3) partial(o, rand(900, 1400), at, 0.012, 0.002, 0.03);
  }
}

// ------------------------------------------------------------------ music

// Now and then, like in Minecraft, a short piano piece drifts over the meadow, then several minutes
// of just the meadow again: the silence is what makes a piece feel like an event. The pieces are
// written out below and played a little differently each time: loose timing, a softer or firmer
// touch, sometimes another form. Their keys (D, G, B minor, E minor) all hold the D pentatonic, so
// they sit with the rest; most borrow one chord from outside the key, once, for their one moment.
// A day is 20 seconds and a piece a minute and a half, so no piece is about the time of day: the
// piano just plays softer and darker at night, while it plays.

// A felt piano: a few harmonics stretched a hair sharp like real strings, a hammer's quick drop
// into a long tail, and a low-pass that closes as the note fades, so it goes soft and round.
// Low notes ring longer. len: when the key lets go and the damper falls. bright < 1 is more muffled.
function piano(dest, f, t, v = 1, len = 1, bright = 1) {
  const ring = 1.5 + 3 * Math.min(1, 220 / f), end = t + Math.min(len, ring * 1.5);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
  lp.frequency.setValueAtTime(Math.min(10000, f * (2.5 + 5 * v) * bright), t);
  lp.frequency.setTargetAtTime(f * 2, t + 0.01, ring / 3);
  const g = ac.createGain(), peak = 0.2 * v;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.setTargetAtTime(peak * 0.35, t + 0.005, 0.15);
  g.gain.setTargetAtTime(0, t + 0.3, ring / 3);
  g.gain.setTargetAtTime(0, end, 0.1);
  lp.connect(g).connect(dest);
  for (const [n, a] of [[1, 1], [1.0012, 0.4], [2, 0.5], [3, 0.22], [4, 0.12], [5, 0.05]]) {
    const o = ac.createOscillator(), og = ac.createGain();
    const h = Math.round(n);
    o.frequency.value = f * n * Math.sqrt(1 + 0.0003 * h * h); og.gain.value = a;
    o.connect(og).connect(lp); o.start(t); o.stop(end + 0.6);
  }
  noise(dest, t, 0.03, { from: f * 3, to: f, type: 'lowpass', q: 0.5, peak: 0.02 * v, attack: 0.002 });
}

// Glass: a wet finger round a wine glass. A pure tone that swells in, shimmers a little and
// fades, with no strike at all.
function glass(dest, f, t, v = 1, len = 1) {
  const dur = Math.max(1.8, Math.min(len, 3.5)), g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);
  const lfo = ac.createOscillator(), depth = ac.createGain();
  lfo.frequency.value = rand(4, 5.5); depth.gain.value = f * 0.002; lfo.connect(depth);
  for (const [n, a] of [[1, 1], [2, 0.06]]) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.value = f * n; og.gain.value = a; depth.connect(o.frequency);
    o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  lfo.start(t); lfo.stop(t + dur + 0.05);
}
// Celesta: a soft hammer on a small steel bar. In tune (whole-number overtones), unlike the bell.
function celesta(dest, f, t, v = 1) {
  partial(dest, f, t, 0.22 * v, 0.003, 1.4);
  partial(dest, f * 2, t, 0.05 * v, 0.002, 0.5);
  partial(dest, f * 4, t, 0.025 * v, 0.002, 0.15);
}
// The voices a piece can play in. echo: the piano again, muffled, as if from far off.
const VOICES = { piano, glass, celesta, echo: (dest, f, t, v, len) => piano(dest, f, t, v, len, 0.5) };

// The pieces. A step is an eighth note; bars are split by |.
//  steps:  steps to a bar: 8 (four beats, the default) or 6 (a waltz).
//  key:    D (the default), G, Bm or Em: a key that holds the D pentatonic. Melody and chords
//          count from its first note.
//  tone:   how bright the piano is (1 the default, lower is more muffled).
//  octave: moves the whole tune up (1) or down (-1) an octave.
//  echo:   each tune note comes back this many steps later, an octave up, in echoVoice (a VOICES name).
//  melody: degrees of the key (in D: 1 = D5 ... 7 = C#6; in G: 1 = G4; in B minor: 1 = B4),
//          ' an octave up, , an octave down,
//          - holds the note before, . is a rest.
//          A b or # before a degree lowers or raises it a semitone (in D: b7, = C4).
//  chords: the degree each chord stands on (in D: 1 = D, 4 = G, 5 = A, 6 = Bm ...), one or two a bar,
//          major or minor as the key makes it. A borrowed chord from outside the key: b or # moves
//          the root a semitone and makes it major, m or M after it makes it minor or major
//          (in D: b7 = C, 4m = Gm; in B minor: 1M = B major).
//  left:   the left hand over each chord, in scale steps above its root (0 root, 4 fifth,
//          7 octave, 9 tenth ...), starting again at every chord; 7+9 plays both together.
//          A part can have its own.
//  slow:   how much the part slows towards its end (0.4: the last step is 40% longer).
//  forms:  the order of the parts; one is picked each time. a^ plays a's tune an octave up.
//  fit:    how much the piece suits the season (state: season, sky). Only asked at 1x: faster, a
//          season is gone before the piece ends, so every piece is as likely.
//  trial:  a version to try in the lab; the game never picks it.
const TUNES = {
  // Clover: spring. An easy walk up the tune and back, over a rippling left hand. Late in the
  // middle part a C major, from outside D, clouds it for one bar before G and A bring it home.
  clover: {
    title: 'Clover', bpm: 72, left: '0 4 7 9 11 9 7 4',
    fit: s => [3, 2, 0.7, 0.3][s.season],
    parts: {
      intro: { chords: '1 | 4' },
      a:  { chords: '1 | 4 | 1 | 5',
            melody: "5, - 1 2 3 - 5 - | 4 - 3 2 1 - 2 - | 3 - - 5 3 2 1 - | 2 - - - . . . ." },
      a2: { chords: '1 | 4 | 6 5 | 1',
            melody: "5, - 1 2 3 - 5 - | 6 - 5 4 3 - 2 - | 3 - 2 - 1 - 7, - | 1 - - - - - . ." },
      b:  { chords: '4 | 1 | 4 | 5 | 6 | b7 | 4 | 5',
            melody: "1' - 7 6 5 - - - | 3 - 5 - 1' - - - | 6 - 5 4 6 - 5 - | 5 - - - 7 - - - | " +
                    "6 - 5 - 3 - - - | 5 - 2 - b7, - - - | 4 - 3 - 2 - 1 - | 2 - - - 5, - 7, -" },
      end: { chords: '4 | 1', left: '0 4 7 9 11 14 . .', slow: 0.5,
            melody: "6 - 5 - 3 - 2 - | 1 - - - - - - -" },
    },
    forms: ['intro a a2 b a a2 end', 'intro a a2 b a^ a2 end'],
  },
  // Lanterns: autumn, a slow waltz in B minor, lower and more muffled than Clover. Each bar
  // lilts long-short-long, and the chords fall round the circle (Bm Em A D G ...). The middle
  // part lifts into D major before it sinks back, and the last chord turns to B major: the
  // lanterns coming on.
  lanterns: {
    title: 'Lanterns', bpm: 76, steps: 6, key: 'Bm', tone: 0.65, left: '0 4 7+9 . 7+9 .',
    fit: s => [0.6, 1, 3, 0.6][s.season],
    parts: {
      intro: { chords: '1 | 6' },
      a:  { chords: '1 | 4 | 7 | 3 | 6 | 4 | 5 | 5',
            melody: "5 - - 4 3 - | 3 - - 2 1 - | 2 - - 1 7, - | 7, - - - - - | " +
                    "3 - - 4 5 - | 6 - - 5 4 - | 5 - - 4 3 - | 2 - - - - -" },
      a2: { chords: '1 | 4 | 7 | 3 | 6 | 5 | 1 | 1',
            melody: "5 - - 4 3 - | 3 - - 2 1 - | 2 - - 1 7, - | 7, - - - - - | " +
                    "3 - - 4 5 - | 7 - - 6 5 - | 4 - - 2 1 - | 1 - - - . ." },
      b:  { chords: '3 | 7 | 6 | 3 | 3 | 7 | 4 | 5',
            melody: "7 - - 1' 3' - | 2' - - - 1' 7 | 1' - - - 6 - | 7 - - - - - | " +
                    "7 - - 1' 3' - | 2' - - 3' 4' - | 4' - - 3' 2' - | 2' - - - 7 -" },
      end: { chords: '6 | 5 | 1M', left: '0 4 7 9 11 14', slow: 0.6,
            melody: "3 - - 2 1 - | 2 - - - 7, - | 1 - - - - -" },
    },
    forms: ['intro a a2 b a2 end', 'intro a a2 b a^ a2 end'],
  },
  // Burrow: a lullaby, in G, for any season. Slow, and far apart like a music box: a small tune
  // up high on the lullaby's falling third (D-B, D-D-B), over a low note rocking like a cradle.
  // At the end it stops rocking: C, then C minor from outside the key, as the tune slips down
  // by half steps (B, B flat, A) onto G.
  burrow: {
    title: 'Burrow', bpm: 58, key: 'G', octave: 1, tone: 0.85, left: '0 . 7 . 4 . 7 .',
    fit: () => 1,
    parts: {
      intro: { chords: '1 | 4' },
      a:  { chords: '1 | 4 | 1 | 5',
            melody: "5 - 3 - 5 5 3 - | 6 - 5 - 3 - - - | 5 - 3 - 2 - 1 - | 2 - - - - - . ." },
      a2: { chords: '1 | 4 | 5 | 1',
            melody: "5 - 3 - 5 5 3 - | 6 - 5 - 3 - 1 - | 2 - 3 - 2 - 7, - | 1 - - - - - . ." },
      b:  { chords: '6 | 3 | 4 | 5',
            melody: "5 - - 6 5 - 3 - | 2 - - 3 2 - 7, - | 1 - - 2 3 - 5 - | 6 - - - 5 - 4 -" },
      end: { chords: '4 4m | 1', left: '0+4+9 . . . . . . .', slow: 0.6,
            melody: "3 - - - b3 - - - | 2 - 1 - - - - -" },
    },
    forms: ['intro a a2 b a2 end', 'intro a a2 b a a2 end'],
  },
  // Frost: winter, snow falling. Plain E minor, rocking between E minor and A minor. Under the
  // tune an open fifth, then two notes drifting down on a slow 3+3+2. The tune is one small
  // motif, a falling B-G-E that comes in after a rest like a flake, said again and again with a
  // little changed. It ends A minor, C, E minor. Sometimes it's just the motif, with no middle part.
  frost: {
    title: 'Frost', bpm: 66, key: 'Em', tone: 0.9, left: '0+4 . . 9 . . 7 .',
    fit: s => (s.season === 3 ? 4 : 0.3) * (1 + (s.sky.snow || 0)),
    parts: {
      intro: { chords: '1 | 4' },
      a:  { chords: '1 | 4 | 1 | 7',
            melody: ". . 5 - 3 - 1 - | 6 - - - 5 - - - | . . 5 - 3 - 2 - | 1 - - - - - . ." },
      a2: { chords: '1 | 4 | 7 | 1',
            melody: ". . 5 - 3 - 1 - | 6 - - - 1' - - - | 7 - 5 - 4 - 2 - | 1 - - - - - . ." },
      b:  { chords: '3 | 7 | 4 | 1 | 3 | 7 | 5 | 5',
            melody: "7 - - - 5 - 3 - | 4 - - - 2 - - - | 5 - - - 6 - 1' - | 1' - - - 7 - 5 - | " +
                    "7 - - - 5 - 3 - | 4 - - - 2 - - - | 4 - - 5 2 - - - | 2 - - - - - . ." },
      end: { chords: '4 | 6 | 1', left: '0+4 . . 9 . . 11 .', slow: 0.5,
            melody: "6 - - - 5 - - - | 5 - - - 3 - - - | 1 - - - - - - -" },
    },
    forms: ['intro a a2 b a a2 end', 'intro a a2 end'],
  },
};

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
const KEYS = { D: [2, 'major'], G: [7, 'major'], Bm: [11, 'minor'], Em: [4, 'minor'] };   // first note (C = 0), scale
// Degree d of a key (1-based, may run past 7 or below 1) as a MIDI note, from its lowest octave.
const degree = (key, d) => { const [pc, sc] = KEYS[key], i = d - 1; return pc + SCALES[sc][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7); };
const lift = (m, lo) => 12 * Math.ceil((lo - m) / 12);   // octaves to move m up to lo or just above
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const bars = s => !s ? [] : s.split('|').map(b => b.trim().split(/\s+/).filter(Boolean));
const shift = a => a === 'b' ? -1 : a === '#' ? 1 : 0;
// A chord mark (1, b7, 4m ...): its root as a MIDI note, and at(k), the note k scale steps above
// the root. A chord of the key takes its notes from the key; a borrowed one is built on its own
// root, major (with a flat seventh, the way borrowed chords usually come) or minor.
function chord(key, c) {
  const [, acc, d, q] = c.match(/^([b#]?)(\d)([mM]?)$/), root = degree(key, +d) + shift(acc);
  if (!acc && !q) return { root, at: k => degree(key, +d + k) };
  const sc = SCALES[q === 'm' ? 'minor' : 'mixolydian'];
  return { root, at: k => root + sc[((k % 7) + 7) % 7] + 12 * Math.floor(k / 7) };
}

// Writes out one playing of a piece: every note with its time, pitch, touch, length and hand.
function score(tune) {
  const step = 30 / tune.bpm, per = tune.steps || 8, key = tune.key || 'D', notes = [];
  let t0 = 0;
  for (const name of pick(tune.forms).split(' ')) {
    const up = name.endsWith('^'), part = tune.parts[name.replace('^', '')];
    const chords = bars(part.chords), n = chords.length * per;
    const mel = bars(part.melody), left = (part.left || tune.left).split(' ');
    mel.forEach((b, i) => { if (b.length !== per) console.warn(`${tune.title} ${name}: bar ${i + 1} has ${b.length} steps`); });
    const at = [0];                                  // when each step starts, slowing towards the end
    for (let i = 0; i < n; i++) at.push(at[i] + step * (1 + (part.slow || 0) * (i / n) ** 2));
    // The left hand: each chord's pattern, held down (pedalled) until the next chord.
    chords.forEach((cs, b) => cs.forEach((c, j) => {
      const ch = chord(key, c), low = lift(ch.root, 45), from = b * per + j * per / cs.length, to = from + per / cs.length;
      for (let i = from; i < to; i++) {
        const ks = left[(i - from) % left.length];
        if (ks === '.') continue;
        for (const k of ks.split('+'))
          notes.push({ t: t0 + at[i] + rand(0, 0.012), f: hz(ch.at(+k) + low), hand: 0,
                       v: (i === from ? 0.55 : ks.includes('+') ? 0.32 : 0.42) + rand(-0.04, 0.04), len: at[to] - at[i] + 0.3 });
      }
    }));
    // The right hand: the tune, each note held through its dashes, its 1 between F#4 and F5.
    const steps = mel.flat(), high = lift(degree(key, 1), 66) + 12 * (tune.octave || 0);
    const line = [];
    steps.forEach((s, i) => {
      const m = s.match(/^([b#]?)(\d)([',]*)$/);
      if (!m) return;
      let j = i + 1; while (steps[j] === '-') j++;
      const oct = (up ? 1 : 0) + (m[3].split("'").length - 1) - (m[3].split(',').length - 1);
      line.push({ t: t0 + at[i] + rand(-0.01, 0.01), m: degree(key, +m[2]) + shift(m[1]) + high + 12 * oct,
                  v: (up ? 0.6 : 0.75) + rand(-0.06, 0.06), len: at[Math.min(j, n)] - at[i] + 0.15 });
    });
    // Phrasing: the higher a note climbs above the middle of the part, the firmer it's played,
    // and the part's last note is let go softly.
    const mid = line.reduce((a, l) => a + l.m, 0) / line.length;
    line.forEach((l, i) => {
      const note = { t: l.t, f: hz(l.m), hand: 1, len: l.len,
                     v: l.v * (1 + 0.25 * Math.max(-1, Math.min(1, (l.m - mid) / 8))) * (i === line.length - 1 ? 0.8 : 1) };
      notes.push(note);
      if (tune.echo) notes.push({ ...note, t: note.t + tune.echo * step * rand(0.95, 1.08), f: note.f * 2, hand: 2, v: note.v * 0.6, voice: tune.echoVoice });
    });
    t0 += at[n];
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, length: t0 };
}

const music = { next: 0, piece: null, last: null };
const GAP = [300, 600];                              // seconds of just the meadow between pieces
const MUSIC = false;                                 // off for now: the meadow plays no pieces (the lab still does)

function playTune(name) {
  if (!ac || !enabled || !TUNES[name]) return false;
  stopTune();
  const now = ac.currentTime, { notes, length } = score(TUNES[name]);
  const out = ac.createGain(); out.connect(musicBus);
  const hands = [-0.2, 0.2, -0.5].map(p => { const pn = ac.createStereoPanner(); pn.pan.value = p; pn.connect(out); return pn; });
  music.last = name;
  music.piece = { name, notes, tone: TUNES[name].tone || 1, i: 0, t0: now + 0.1, end: now + 0.1 + length + 4, length, out, hands };
  return true;
}
function stopTune() {
  const p = music.piece;
  if (!p) return;
  p.out.gain.setTargetAtTime(0, ac.currentTime, 0.4);
  setTimeout(() => p.out.disconnect(), 3000);
  music.piece = null;
  music.next = ac.currentTime + rand(...GAP);
}

// A few times a second: hand the next notes to Web Audio, or wait for the next piece. The
// piano follows the light as it plays, softer and darker at night (m.day, from mix()). A storm
// has the stage to itself, and each piece is chosen by how well it suits the season (at 1x),
// and rarely the one that played last.
function musicTick(now, m) {
  const p = music.piece;
  if (p) {
    const soft = 0.85 + 0.15 * m.day, bright = p.tone * (0.75 + 0.25 * m.day);
    while (p.i < p.notes.length && p.t0 + p.notes[p.i].t < now + 1.5) {
      const n = p.notes[p.i++], t = p.t0 + n.t;
      if (t > now - 0.05) VOICES[n.voice || 'piano'](p.hands[n.hand], n.f, Math.max(t, now), n.v * soft, n.len, bright);
    }
    if (now > p.end) { music.piece = null; music.next = now + rand(...GAP); }
    return;
  }
  if (!MUSIC) return;
  if (!music.next) music.next = now + rand(60, 120);
  if (now < music.next) return;
  if ((state.sky.storm || 0) > 0.3) { music.next = now + 30; return; }
  const names = Object.keys(TUNES);
  const w = names.map(k => TUNES[k].trial ? 0 : TUNES[k].fit(state) * (k === music.last ? 0.2 : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (r > w[i] && i < names.length - 1) r -= w[i++];
  playTune(names[i]);
}

// ------------------------------------------------------------------ public

function update(s) { Object.assign(state, s); }

// Silence isn't free: the reverb and the ambient loops keep running at zero volume. So once
// the fade-out is done, the whole sound engine pauses, and picks up where it was when turned on.
let sleepTimer = 0;
function setEnabled(on) {
  enabled = on;
  if (!master) return;
  clearTimeout(sleepTimer);
  if (on) ac.resume();
  master.gain.setTargetAtTime(on ? volume : 0, ac.currentTime, 0.3);
  loud.gain.setTargetAtTime(on ? volume * LOUD : 0, ac.currentTime, 0.3);
  if (!on) sleepTimer = setTimeout(() => { if (!enabled) ac.suspend(); }, 2000);
}
function setVolume(v) {
  volume = v;
  if (!master || !enabled) return;
  master.gain.setTargetAtTime(v, ac.currentTime, 0.1);
  loud.gain.setTargetAtTime(v * LOUD, ac.currentTime, 0.1);
}

// Hidden, the meadow keeps silent and the audio thread stands down; back and wanted, it wakes.
const suspend = () => { if (ac && ac.state === 'running') ac.suspend(); };
const wakeUp = () => { if (ac && enabled && ac.state === 'suspended') ac.resume(); };

window.Sound = {
  start, play, update, setEnabled, suspend, wakeUp, setVolume, get enabled() { return enabled; }, names: Object.keys(SOUNDS),
  playTune, stopTune, tunes: Object.fromEntries(Object.entries(TUNES).map(([k, t]) => [k, t.title])),
  // What's playing: { name, at, length } in seconds, or null.
  get tune() { const p = music.piece; return p && ac ? { name: p.name, at: Math.max(0, ac.currentTime - p.t0), length: p.length } : null; },
};
})();
