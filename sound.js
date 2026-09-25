/* Nobody's Meadow — sound. Everything is made on the fly with Web Audio: no sound files.
 *
 * Three ideas keep it cozy:
 *  1. One scale. Every pitched sound comes from D major pentatonic, so nothing can clash.
 *     Only the birds sing free: they're the meadow's nature, not its music.
 *  2. One instrument per species. Rabbits are a high kalimba, foxes a low felt marimba, bees
 *     a buzz that hums in tune, the meadow itself (seasons, old age) a soft glass bell.
 *     Rising = life, falling = loss. Lightning is the one loud thing, on purpose.
 *  3. The meadow is the music. Wind, birds, crickets, rain and fire follow the clock and the
 *     sky, and events are rare, quiet and rate-limited so fast-forward never turns into noise.
 *     Every few minutes a short felt-piano piece drifts over it, like the music in Minecraft
 *     (see "music" below), in keys that hold the pentatonic so it still fits.
 *
 * Use: Sound.start() from a click, then Sound.update({ phase, season, speed, sky, fire, bees }) a
 * few times a second (sky: how much of each weather is showing, 0..1; bees: how many are flying
 * on screen) and Sound.play('birth', { species, pan, near, seen }) on events.
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

let ac = null, master, ducker, loud, fxBus, ambBus, musicBus, hush, reverb, noiseBuf, brownBuf;
let enabled = true, volume = 0.6;
const amb = {};                                    // ambient layers
const LOUD = 1.4;                                  // thunder's level against the rest
const state = { phase: 0.3, season: 0, speed: 1, sky: { clear: 1 }, fire: 0, bees: 0 };
const last = {};                                   // per-sound cooldowns
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

  reverb = ac.createConvolver(); reverb.buffer = impulse(3.2);
  const wet = ac.createGain(); wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);

  fxBus = ac.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
  // Fog and snow muffle the meadow: the whole background goes through one low-pass.
  hush = ac.createBiquadFilter(); hush.type = 'lowpass'; hush.frequency.value = 12000; hush.connect(master);
  ambBus = ac.createGain(); ambBus.gain.value = 0.8; ambBus.connect(hush);

  // The music: dry into the mix, with more reverb than the meadow, and not muffled by fog.
  musicBus = ac.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
  const musicVerb = ac.createGain(); musicVerb.gain.value = 0.45; musicBus.connect(musicVerb).connect(reverb);

  noiseBuf = pinkNoise(4); brownBuf = brownNoise(4);
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

// Deeper than pink: the body of an explosion.
function brownNoise(sec) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
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

// ------------------------------------------------------------------ events

// How long each sound waits before it may play again, and whether it survives fast-forward.
const RULES = {
  love:    { gap: 0.35, maxSpeed: 4 },
  birth:   { gap: 0.25, maxSpeed: 4 },
  catch:   { gap: 0.8,  maxSpeed: 4 },
  starve:  { gap: 1.2,  maxSpeed: 4 },
  old:     { gap: 1.5,  maxSpeed: 4 },
  escape:  { gap: 0.6,  maxSpeed: 4 },
  thump:   { gap: 0.5,  maxSpeed: 4 },
  queen:   { gap: 4,    maxSpeed: 15 },
  queenlost: { gap: 4,  maxSpeed: 15 },
  arrive:  { gap: 2,    maxSpeed: 60 },
  thunder: { gap: 0.3,  maxSpeed: 15, always: true },   // a strike you see is always heard
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
  // A new queen for an empty hive: a bell, and the hive buzzing up to meet her.
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
  // The one loud sound. A strike you can see: the slowed explosion and the roll together, then
  // the sky settling: echoes off the far hills, a gust through the grass, a long grumble.
  // Off screen only the roll and the grumble, late and dark, at most one every few seconds:
  // a storm strikes every ~3 s and these tails are long.
  thunder(t, o, { seen = true, pan = 0 }) {
    if (seen) {
      const hit = out(pan, 0.4, 1, loud);
      duck(t, 0.3, 6);
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
      if (t - farAt < 4 * Math.max(1, state.speed / 2)) return;
      farAt = t;
      const d = rand(0.6, 1.4);
      roll(out(pan, 0.6, 0.7, loud), t + d, rand(4.5, 6), { cut: 300, lumps: 6, peak: 0.45, mid: 0.2 });
      roll(out(pan, 0.8, 0.7, loud), t + d + rand(2.5, 3.5), rand(6, 8), { cut: 200, lumps: 5, peak: 0.22, mid: 0.12, heat: 1.1 });
    }
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
  if (!r.always && ++recent > 6 && r.maxSpeed < 60) return false;    // at most ~6 creature sounds a second
  last[name] = now;
  const ok = v => Number.isFinite(v) ? v : undefined;      // a NaN would throw inside Web Audio
  const near = ok(opts.near) ?? 1;
  const pan = ok(opts.pan) ?? 0;
  SOUNDS[name](now + 0.02, out(pan, 0.25 + 0.35 * (1 - near), 0.35 + 0.65 * near), { ...opts, near, pan });
  return true;
}

// ------------------------------------------------------------------ ambience

// Rain comes as two bands, panned apart and from different places in the noise, so it sounds
// wide instead of one flat hiss in the middle.
function rainSide(pan, freq) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.4;
  const soft = ac.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 6500; soft.Q.value = 0.5;
  const g = ac.createGain(); g.gain.value = 0;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  src.connect(f).connect(soft).connect(g).connect(p).connect(ambBus); src.start(0, rand(0, 3.5));
  return { f, g };
}

function loopNoise(filterType, freq, q) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(ambBus); src.start();
  return { f, g };
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

function buildAmbience() {
  amb.wind = windVoice();
  amb.rainL = rainSide(-0.7, 2300); amb.rainR = rainSide(0.7, 2600);
  amb.rainLow = loopNoise('lowpass', 350, 0.5);
  amb.fire = loopNoise('lowpass', 220, 0.6);
  amb.hum = hiveHum();
  amb.calm = 0.5; amb.blow = null; amb.gust = 0; amb.swell = 0.5;
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
    bees: state.speed >= 15 ? 0 : Math.min(1, state.bees / 12),
  };
}

function tickAmbience() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime, m = mix(), fastFactor = state.speed >= 15 ? 0.4 : 1;

  windTick(now, m);

  // Rain breathes slowly, and in a storm leans into the gusts.
  amb.swell = Math.max(0, Math.min(1, amb.swell + (Math.random() - 0.5) * 0.05));
  const gust = amb.gust * m.storm, rainLvl = 0.85 + 0.3 * amb.swell + 0.5 * gust;
  amb.rainL.g.gain.setTargetAtTime((0.055 * m.rain + 0.025 * m.storm) * rainLvl * (1 + 0.2 * gust), now, 1.5);
  amb.rainR.g.gain.setTargetAtTime((0.055 * m.rain + 0.025 * m.storm) * rainLvl * (1 - 0.1 * gust), now, 1.5);
  amb.rainLow.g.gain.setTargetAtTime((0.10 * m.rain + 0.06 * m.storm) * rainLvl, now, 2);
  amb.fire.g.gain.setTargetAtTime(0.12 * m.fire, now, 1.5);
  amb.hum.gain.setTargetAtTime(0.03 * m.bees, now, 1.5);
  hush.frequency.setTargetAtTime(12000 - 9500 * m.hush, now, 2);

  // Scattered one-shots, each rolled a few times a second.
  const dt = 0.2 * fastFactor;
  birdTick(now, m.birds * fastFactor);
  if (Math.random() < m.crickets * 2.2 * dt) cricket(now + rand(0, 0.2));
  if (Math.random() < (1 - m.day) * (state.season === 3 ? 0.02 : 0.05) * dt) owl(now);
  if (Math.random() < m.rain * 3 * dt) {
    const deg = drip(now + rand(0, 0.2), rand(0.5, 1.3));
    if (Math.random() < 0.2) drip(now + rand(0.25, 0.4), 0.5, deg + pick([-1, 1]));   // then a smaller one off the leaf
  }
  if (Math.random() < m.snow * 0.15 * dt) snowChime(now);
  if (Math.random() < m.cicadas * 0.12 * dt) cicada(now);
  for (let i = 0; i < 3; i++) if (Math.random() < m.fire * 4 * dt) crackle(now + rand(0, 0.2));
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
}
const WHISTLE = 1;                                 // kept well under the gust: a hint of a tone, not a note

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
  lp.connect(out(b.pan, 0.2 + 0.45 * b.dist, 0.6 - 0.35 * b.dist));
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

// A crackle of burning grass: a tiny click of noise.
const crackle = t => noise(out(rand(-0.8, 0.8), 0.15, rand(0.3, 1)), t, rand(0.015, 0.04), { from: rand(900, 3500), to: rand(600, 2500), q: 1.5, peak: 0.25 });

const rustle = (t, pan = rand(-1, 1), v = 1) => noise(out(pan, 0.2, 0.8 * v), t, rand(0.6, 1.2), { from: 1800, to: 4200, q: 0.9, peak: 0.08 });
const snowChime = t => kalimba(out(rand(-1, 1), 0.7, 0.3), note(Math.floor(rand(5, 10)), 1), t, 0.4);

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
  if (!music.next) music.next = now + rand(60, 120);
  if (now < music.next) return;
  if ((state.sky.storm || 0) > 0.3) { music.next = now + 30; return; }
  const names = Object.keys(TUNES);
  const w = names.map(k => TUNES[k].trial ? 0 : (state.speed > 1 ? 1 : TUNES[k].fit(state)) * (k === music.last ? 0.2 : 1));
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

window.Sound = {
  start, play, update, setEnabled, setVolume, get enabled() { return enabled; }, names: Object.keys(SOUNDS),
  playTune, stopTune, tunes: Object.fromEntries(Object.entries(TUNES).map(([k, t]) => [k, t.title])),
  // What's playing: { name, at, length } in seconds, or null.
  get tune() { const p = music.piece; return p && ac ? { name: p.name, at: Math.max(0, ac.currentTime - p.t0), length: p.length } : null; },
};
})();
