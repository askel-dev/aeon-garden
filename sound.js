/* AEON Garden — sound. Everything is made on the fly with Web Audio: no sound files.
 *
 * Three ideas keep it cozy:
 *  1. One scale. Every pitched sound comes from D major pentatonic, so nothing can clash.
 *  2. One instrument per species. Rabbits are a high kalimba, foxes a low felt marimba,
 *     the meadow itself (seasons, old age) is a soft glass bell. Rising = life, falling = loss.
 *  3. The meadow is the music. Wind, birds, crickets, rain and fire follow the clock and the
 *     sky, and events are rare, quiet and rate-limited so fast-forward never turns into noise.
 *
 * Use: Sound.start() from a click, then Sound.update({ phase, season, speed, sky, fire }) a few
 * times a second (sky: how much of each weather is showing, 0..1) and
 * Sound.play('birth', { species, pan, near }) on events.
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

let ac = null, master, fxBus, ambBus, hush, reverb, noiseBuf;
let enabled = true, volume = 0.6;
const amb = {};                                    // ambient layers
const state = { phase: 0.3, season: 0, speed: 1, sky: { clear: 1 }, fire: 0 };
const last = {};                                   // per-sound cooldowns
let recent = 0, recentAt = 0;                      // global voice budget

// ------------------------------------------------------------------ setup

function start() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
  master = ac.createGain(); master.gain.value = enabled ? volume : 0;
  master.connect(comp).connect(ac.destination);

  reverb = ac.createConvolver(); reverb.buffer = impulse(3.2);
  const wet = ac.createGain(); wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);

  fxBus = ac.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
  // Fog and snow muffle the meadow: the whole background goes through one low-pass.
  hush = ac.createBiquadFilter(); hush.type = 'lowpass'; hush.frequency.value = 12000; hush.connect(master);
  ambBus = ac.createGain(); ambBus.gain.value = 0.8; ambBus.connect(hush);

  noiseBuf = pinkNoise(4);
  buildAmbience();
  setInterval(tickAmbience, 200);
}

// A soft, dark room: decaying noise, low-passed a little more each second.
function impulse(sec) {
  const len = Math.floor(ac.sampleRate * sec), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, k = 0.35 - 0.3 * t;
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 2.4);
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

// ------------------------------------------------------------------ small building blocks

// out(pan, verb): a panner feeding the fx bus plus a reverb send.
function out(pan = 0, verb = 0.3, gain = 1) {
  const g = ac.createGain(); g.gain.value = gain;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  const s = ac.createGain(); s.gain.value = verb;
  g.connect(p); p.connect(fxBus); p.connect(s); s.connect(reverb);
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
const voiceOf = species => species === 'fox' ? marimba : kalimba;
const octOf = species => species === 'fox' ? -1 : 1;

// Filtered noise with a moving band: whooshes, rustles, gusts.
function noise(dest, t, dur, { from = 800, to = 2400, q = 1.2, peak = 0.3, type = 'bandpass' } = {}) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, rand(0, 3)); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ events

// How long each sound waits before it may play again, and whether it survives fast-forward.
const RULES = {
  love:    { gap: 0.35, maxSpeed: 4 },
  birth:   { gap: 0.25, maxSpeed: 4 },
  catch:   { gap: 0.8,  maxSpeed: 4 },
  starve:  { gap: 1.2,  maxSpeed: 4 },
  old:     { gap: 1.5,  maxSpeed: 4 },
  escape:  { gap: 0.6,  maxSpeed: 4 },
  arrive:  { gap: 2,    maxSpeed: 60 },
  thunder: { gap: 1.2,  maxSpeed: 15 },
  fire:    { gap: 4,    maxSpeed: 60 },
  fireout: { gap: 4,    maxSpeed: 60 },
  rainbow: { gap: 20,   maxSpeed: 4 },
  season:  { gap: 4,    maxSpeed: 60 },
  extinct: { gap: 4,    maxSpeed: 60 },
  rain:    { gap: 3,    maxSpeed: 60 },
  release: { gap: 0.08, maxSpeed: 60 },
  grass:   { gap: 0.09, maxSpeed: 60 },
  click:   { gap: 0.04, maxSpeed: 60 },
};

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
  escape(t, o) {
    noise(o, t, 0.35, { from: 600, to: 3200, q: 0.8, peak: 0.18 });
    kalimba(o, note(4, 1), t + 0.2, 0.35);
  },
  // Newcomers: a hopping arpeggio walking in.
  arrive(t, o, { species }) {
    const v = voiceOf(species), k = octOf(species);
    [0, 2, 1, 3, 4].forEach((d, i) => v(o, note(d, k), t + i * 0.13, 0.5));
  },
  // Each season has its own four-bell phrase.
  season(t, o, { season = 0 }) {
    const phrases = [[0, 2, 4, 7], [4, 5, 7, 9], [7, 5, 4, 2], [4, 2, 1, 0]];
    phrases[season].forEach((d, i) => bell(o, note(d, -1), t + i * 0.42, 0.55));
  },
  extinct(t, o) {
    bell(o, note(2, -1), t, 0.6);
    bell(o, note(-1, -1) * Math.pow(2, 1 / 12), t + 0.8, 0.5);   // a flat sixth: the one sad note
  },
  rain(t, o) { noise(o, t, 2.2, { from: 300, to: 1600, q: 0.6, peak: 0.12, type: 'lowpass' }); },
  // A crack, then a rolling rumble that arrives later the farther away it is. The rumble
  // starts around 1 kHz so laptop speakers can play it; the deep layer is for headphones.
  thunder(t, o, { near = 1 }) {
    const d = 0.1 + 0.7 * (1 - near);
    noise(o, t, 0.2, { from: 3500, to: 700, q: 0.6, peak: 0.08 + 0.14 * near });
    for (let i = 0; i < 3; i++) {
      noise(o, t + d + i * rand(0.3, 0.6), rand(1.4, 2.4), { from: rand(900, 1400) - 300 * (1 - near), to: 140, q: 0.4, peak: 0.35, type: 'lowpass' });
    }
    noise(o, t + d, rand(2.8, 3.6), { from: 300, to: 50, q: 0.5, peak: 0.3, type: 'lowpass' });
  },
  // Dry grass catching: a soft whoomph.
  fire(t, o) { noise(o, t, 1.4, { from: 200, to: 1400, q: 0.5, peak: 0.16, type: 'lowpass' }); },
  // The fire is out and the ash will feed fresh shoots: a bell and a hopeful note above it.
  fireout(t, o) { bell(o, note(0, -1), t, 0.5); kalimba(o, note(4, 1), t + 0.5, 0.35); kalimba(o, note(7, 1), t + 0.7, 0.3); },
  rainbow(t, o) { for (let i = 0; i < 8; i++) kalimba(o, note(i, 1), t + i * 0.09, 0.28 - i * 0.02); },
  // Dropping an animal in: a tiny pop in its own voice.
  release(t, o, { species }) { voiceOf(species)(o, note(pick([0, 2, 4]), octOf(species) + 1), t, 0.45); },
  grass(t, o) { noise(o, t, 0.18, { from: 2500, to: 5000, q: 2, peak: 0.05 }); },
  click(t, o) { partial(o, 1320, t, 0.06, 0.002, 0.05, 'triangle'); partial(o, 660, t, 0.05, 0.002, 0.08); },
};

// opts: { species, pan (-1..1), near (0..1, how close to the camera), ...sound-specific }
function play(name, opts = {}) {
  if (!ac || !enabled || !SOUNDS[name]) return false;
  const r = RULES[name], now = ac.currentTime;
  if (state.speed > r.maxSpeed) return false;
  if (now - (last[name] ?? -1e9) < r.gap * Math.max(1, state.speed / 2)) return false;
  if (now - recentAt > 1) { recent = 0; recentAt = now; }
  if (++recent > 6 && r.maxSpeed < 60) return false;    // at most ~6 creature sounds a second
  last[name] = now;
  const ok = v => Number.isFinite(v) ? v : undefined;      // a NaN would throw inside Web Audio
  const near = ok(opts.near) ?? 1;
  SOUNDS[name](now + 0.02, out(ok(opts.pan) ?? 0, 0.25 + 0.35 * (1 - near), 0.35 + 0.65 * near), { ...opts, near });
  return true;
}

// ------------------------------------------------------------------ ambience

function loopNoise(filterType, freq, q) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(ambBus); src.start();
  return { f, g };
}

function buildAmbience() {
  amb.wind = loopNoise('lowpass', 500, 0.7);
  amb.rain = loopNoise('bandpass', 2400, 0.4);
  amb.rainLow = loopNoise('lowpass', 350, 0.5);
  amb.fire = loopNoise('lowpass', 220, 0.6);
  amb.windTarget = 0; amb.gust = 0;
}

// What the meadow should sound like right now, smoothed so fast-forward blurs into an average.
function mix() {
  const fast = state.speed >= 15, p = state.phase, s = state.season;
  const sky = k => state.sky[k] || 0;
  const dayness = fast ? 0.65 : p < 0.05 ? p / 0.05 : p > 0.72 ? 0 : p > 0.64 ? (0.72 - p) / 0.08 : 1;
  const wet = Math.min(1, sky('rain') + sky('storm'));
  const grey = Math.max(0, 1 - 0.8 * wet - 0.6 * sky('fog') - 0.3 * sky('cloudy') - 0.5 * sky('snow'));
  return {
    day: dayness,
    birds: dayness * [1, 0.7, 0.4, 0.15][s] * (p < 0.2 && !fast ? 1.6 : 1) * grey,   // dawn chorus
    crickets: (1 - dayness) * [0.5, 1, 0.6, 0][s] * (1 - wet) * (1 - sky('snow')),
    wind: [0.5, 0.35, 0.7, 0.85][s] * (1 + 0.3 * sky('cloudy') + 0.8 * sky('storm') - 0.5 * sky('fog') - 0.4 * sky('heat')),
    windHi: [700, 600, 900, 1300][s],
    rain: wet, storm: sky('storm'),
    cicadas: dayness * sky('heat'),
    snow: Math.max(sky('snow'), s === 3 ? 0.3 * dayness : 0),
    hush: Math.max(sky('fog'), 0.7 * sky('snow')),
    fire: Math.min(1, state.fire / 30),
  };
}

function tickAmbience() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime, m = mix(), fastFactor = state.speed >= 15 ? 0.4 : 1;

  // Wind wanders: a slow random walk, now and then a gust.
  amb.gust *= 0.96;
  if (Math.random() < 0.012) amb.gust = rand(0.4, 1);
  amb.windTarget += (Math.random() - 0.5) * 0.15;
  amb.windTarget = Math.max(0, Math.min(1, amb.windTarget));
  const w = m.wind * (0.35 + 0.4 * amb.windTarget + 0.5 * amb.gust) * (1 - 0.4 * m.rain + 0.6 * m.storm);
  amb.wind.g.gain.setTargetAtTime(0.16 * w, now, 1.2);
  amb.wind.f.frequency.setTargetAtTime(m.windHi * (0.5 + 0.5 * amb.windTarget + 0.6 * amb.gust), now, 1.5);

  amb.rain.g.gain.setTargetAtTime(0.07 * m.rain + 0.03 * m.storm, now, 2.5);
  amb.rainLow.g.gain.setTargetAtTime(0.10 * m.rain + 0.06 * m.storm, now, 3);
  amb.fire.g.gain.setTargetAtTime(0.12 * m.fire, now, 1.5);
  hush.frequency.setTargetAtTime(12000 - 9500 * m.hush, now, 2);

  // Scattered one-shots, each rolled a few times a second.
  const dt = 0.2 * fastFactor;
  if (Math.random() < m.birds * 0.35 * dt) bird(now + rand(0, 0.2));
  if (Math.random() < m.crickets * 2.2 * dt) cricket(now + rand(0, 0.2));
  if (Math.random() < (1 - m.day) * (state.season === 3 ? 0.02 : 0.05) * dt) owl(now);
  if (Math.random() < m.rain * 3 * dt) drip(now + rand(0, 0.2));
  if (state.season === 2 && Math.random() < 0.08 * dt) rustle(now);
  if (Math.random() < m.snow * 0.15 * dt) snowChime(now);
  if (Math.random() < m.cicadas * 0.12 * dt) cicada(now);
  for (let i = 0; i < 3; i++) if (Math.random() < m.fire * 4 * dt) crackle(now + rand(0, 0.2));
}

// A songbird: fast sine glides, a few syllables.
function bird(t) {
  const o = out(rand(-0.9, 0.9), 0.35, rand(0.25, 0.55)), base = rand(2600, 4200), n = Math.floor(rand(2, 6));
  const shape = pick(['up', 'down', 'trill']);
  for (let i = 0; i < n; i++) {
    const s = t + i * rand(0.07, 0.14), osc = ac.createOscillator(), g = ac.createGain(), len = rand(0.04, 0.09);
    const a = shape === 'down' ? base * 1.3 : base, b = shape === 'up' ? base * 1.35 : shape === 'down' ? base * 0.85 : base * 1.1;
    osc.frequency.setValueAtTime(a, s); osc.frequency.exponentialRampToValueAtTime(b, s + len);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    osc.connect(g).connect(o); osc.start(s); osc.stop(s + len + 0.02);
  }
}

// A cricket: three quick pulses of a high tone.
function cricket(t) {
  const o = out(rand(-1, 1), 0.2, rand(0.2, 0.45)), f = rand(4200, 5200);
  for (let i = 0; i < 3; i++) partial(o, f, t + i * 0.045, 0.03, 0.005, 0.025);
}

function owl(t) {
  const o = out(rand(-0.8, 0.8), 0.6, 0.6);
  [[0, 0.35], [0.55, 0.25], [0.85, 0.7]].forEach(([dt, len]) => {
    const s = t + dt, osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.setValueAtTime(390, s); osc.frequency.linearRampToValueAtTime(350, s + len);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.09, s + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    osc.connect(g).connect(o); osc.start(s); osc.stop(s + len + 0.05);
  });
}

// Rain on the pond: tiny tuned plinks.
function drip(t) {
  const o = out(rand(-1, 1), 0.4, rand(0.15, 0.4)), f = note(Math.floor(rand(0, 10)), 2);
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.frequency.setValueAtTime(f * 0.8, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.15);
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

// A crackle of burning grass: a tiny click of noise.
const crackle = t => noise(out(rand(-0.8, 0.8), 0.15, rand(0.3, 1)), t, rand(0.015, 0.04), { from: rand(900, 3500), to: rand(600, 2500), q: 1.5, peak: 0.25 });

const rustle = t => noise(out(rand(-1, 1), 0.2, 0.8), t, rand(0.6, 1.2), { from: 1800, to: 4200, q: 0.9, peak: 0.08 });
const snowChime = t => kalimba(out(rand(-1, 1), 0.7, 0.3), note(Math.floor(rand(5, 10)), 1), t, 0.4);

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
  if (!on) sleepTimer = setTimeout(() => { if (!enabled) ac.suspend(); }, 2000);
}
function setVolume(v) {
  volume = v;
  if (master && enabled) master.gain.setTargetAtTime(v, ac.currentTime, 0.1);
}

window.Sound = { start, play, update, setEnabled, setVolume, get enabled() { return enabled; }, names: Object.keys(SOUNDS) };
})();
