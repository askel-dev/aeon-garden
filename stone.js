/* Nobody's Meadow — the old stone's voice. game.js draws the stone, walks the forager to it and opens the line to talk on;
   this asks the stone what it says back: the Supabase Edge Function supabase/functions/stone (a free LLM behind it, its
   key a secret there), or, when that can't be reached, isn't set up or is tired for the day, the hand-written lines below,
   so the stone always answers something.

   It remembers (localStorage MEMORY, across meadows): the last few lines said each way (talk) and every offering with its
   score (fed), and sends them along so the stone can hold a grudge about that mess you brought it last week.

   game.js uses it as Stone: Stone.ask({ said, offer, ctx }) → Promise of { say, mood, score, live }, and reads Stone.fed,
   Stone.NAME. offer: { id, name, dish, mess, what, first }; ctx: the meadow now, in words. */
(() => {
'use strict';
const NAME = 'Old Mossbottom';             // (the function's PROMPT has its own copy)
const FN = 'https://cecvgnhqavygiqkbpkuz.supabase.co/functions/v1/stone';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3ZnbmhxYXZ5Z2lxa2Jwa3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzY4NDQsImV4cCI6MjEwNzc1Mjg0NH0.55flj4Nr9KumknbpSKj3Lt63QMTonIcwkwQ_M5fQrPQ';
const MEMORY = 'aeon-garden-stone';
const TALK_KEEP = 10, FED_KEEP = 30;       // lines of talk and offerings remembered
const WAIT_MS = 14000;                     // an answer slower than this: the hand-written one
const OFFLINE = new URLSearchParams(location.search).has('stone-offline');   // (for trying the hand-written lines)

let mem = { talk: [], fed: [] };
try { const m = JSON.parse(localStorage.getItem(MEMORY)); if (m && Array.isArray(m.talk) && Array.isArray(m.fed)) mem = m; } catch {}
const keep = () => { try { localStorage.setItem(MEMORY, JSON.stringify(mem)); } catch {} };
let down = 0;                              // after the function failed: when to try it again (ms)

const pick = a => a[Math.floor(Math.random() * a.length)];
// The hand-written stone: a few lines for each thing that can happen, mood and score with them.
const LINES = {
  hello: ['Hm? WHO DARES wake the— oh. A small hooded thing. Carry on.', 'Four thousand years I have stood here. You may admire me briefly.',
    'Ah, a visitor. Have you brought snacks? Gods require snacks.', 'Shh. I was having a lovely dream about soup.'],
  talk: ['Fascinating. Truly. Now, about the snacks.', 'I have heard many things in four thousand years. That was one of them.',
    'Hmm. The crows said something similar in 1203. I did not like it then either.', 'Speak up, little one. I am mostly moss on that side.',
    'I would nod, but I am a stone.', 'A wise question. The answer is: soup.'],
  tired: ['Mmf. The stone is sleepy. Too much talking for one day. Come back tomorrow.', 'Zzz… four thousand years… very tired… snacks tomorrow…'],
  dish: [[8, 'delighted', 'MAGNIFICENT. I taste the meadow itself. Eight out of ten, and I never give eights.'],
    [7, 'pleased', 'Hm. Respectable. My moss approves. Seven.'], [9, 'delighted', 'I have waited four thousand years for this. NINE.'],
    [6, 'pleased', 'Needs salt. Everything needs salt. But warm, and given with love. Six.']],
  mess: [[1, 'disgusted', 'What. Is. THIS. I have been rained on with more flavour. One.'], [0, 'disgusted', 'I am a STONE and even I cannot chew this. Zero.'],
    [2, 'grumpy', 'A forager\'s mess. The crows would refuse it. Two, for the effort of carrying it here.']],
  raw: [[4, 'grumpy', 'Raw? You bring a god a RAW thing? Cook it, little one. Four.'], [5, 'awake', 'Fresh from the meadow. Charming. Uncooked. Five.'],
    [3, 'grumpy', 'I could have picked that myself. If I had arms. Three.']],
  junk: [[0, 'shocked', 'Did you just feed me a STICK? I am a deity, not a beaver. Zero.'], [1, 'shocked', 'A pebble. You fed a stone… a smaller stone. Is this a joke? One, for nerve.'],
    [0, 'disgusted', 'Kindling. You have offered me KINDLING. Zero, and a frown.']],
};
function written(b, tired) {
  if (b.offer) {
    const o = b.offer, [score, mood, say] = pick(o.dish ? LINES.dish : o.mess ? LINES.mess : o.junk ? LINES.junk : LINES.raw);
    return { say, mood, score, live: false };
  }
  return { say: pick(tired ? LINES.tired : b.said ? LINES.talk : LINES.hello), mood: tired ? 'awake' : b.said ? 'awake' : 'pleased', score: null, live: false };
}

async function ask(b) {
  const body = { said: b.said || '', offer: b.offer || null, ctx: b.ctx || {}, talk: mem.talk, fed: mem.fed };
  let out = null, tired = false;
  if (!OFFLINE && Date.now() > down) {
    try {
      const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(WAIT_MS) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.say) out = { say: String(j.say), mood: j.mood || 'awake', score: Number.isFinite(j.score) ? j.score : null, live: true };
      else if (j.error === 'tired') tired = true;
      else down = Date.now() + 60000;                       // (not set up, or broken: the written lines for a minute)
    } catch { down = Date.now() + 60000; }
  }
  if (!out) out = written(b, tired);
  if (b.offer && out.score === null) out.score = written(b).score;
  if (b.said) mem.talk.push({ who: 'me', text: String(b.said).slice(0, 240) });
  else if (b.offer) mem.talk.push({ who: 'me', text: `(offers you ${b.offer.name})` });
  mem.talk.push({ who: 'stone', text: out.say });
  mem.talk = mem.talk.slice(-TALK_KEEP);
  if (b.offer) { mem.fed.push({ name: b.offer.name, score: out.score }); mem.fed = mem.fed.slice(-FED_KEEP); }
  keep();
  return out;
}

window.Stone = { NAME, ask, get fed() { return mem.fed; } };
})();
