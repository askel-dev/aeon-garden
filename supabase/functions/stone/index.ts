// The old stone's voice: a Supabase Edge Function between the game (stone.js) and free LLMs. The keys live here as
// Supabase secrets, never in the page. It tries each provider that has a key, in the order of PROVIDERS, and the next when
// one fails or is slow (free tiers come and go: Gemini once refused one ask in seven for no reason):
//   GEMINI_KEY, GROQ_KEY, OPENROUTER_KEY      a key each (any of them; at least one)
//   GEMINI_MODEL, GROQ_MODEL, OPENROUTER_MODEL to change a provider's model (defaults below, tried 2026-10-17)
//   STONE_PER_DAY, STONE_ALL_DAY               how many asks a player (by address) and everyone together may make a day
// Tried on the same seven turns: Gemini's flash-lite answers in about 1 s and is the funniest of the fast ones; Groq's
// gpt-oss-120b in 0.5 s, wordier; Gemini 3.8 Flash was funnier still but 2-6 s (once 109 s), too slow to wait for.
// The daily counts are kept in supabase/stone.sql's table (stone_tick); without it, there's no limit but the providers'.
//
// It takes { said, offer, ctx, talk, fed } (see stone.js; ctx.gossip is what the other meadows did this week, game.js tallyGossip) and answers { say, mood, score } or { error }. What comes back
// from the model is checked and cut down here, so a jailbroken stone can only ever say silly things.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const NAME = 'Old Mossbottom';
const MOODS = ['awake', 'pleased', 'grumpy', 'disgusted', 'delighted', 'shocked'];
const env = (k: string) => Deno.env.get(k) || '';
// Each provider: its OpenAI-style chat address, model, and anything more its model wants (a reasoning model thinks a little).
const PROVIDERS = [
  { name: 'gemini', key: env('GEMINI_KEY'), url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: env('GEMINI_MODEL') || 'gemini-flash-lite-latest', extra: {}, ms: 6000 },
  { name: 'groq', key: env('GROQ_KEY'), url: 'https://api.groq.com/openai/v1/chat/completions',
    model: env('GROQ_MODEL') || 'openai/gpt-oss-120b', extra: { reasoning_effort: 'low' }, ms: 5000 },
  { name: 'openrouter', key: env('OPENROUTER_KEY'), url: 'https://openrouter.ai/api/v1/chat/completions',
    model: env('OPENROUTER_MODEL') || 'google/gemma-4-31b-it:free', extra: {}, ms: 6000 },
].filter(p => p.key);
const WAIT_MS = 12000;                    // all the tries together, under stone.js's WAIT_MS
const PER_DAY = +(Deno.env.get('STONE_PER_DAY') || 80), ALL_DAY = +(Deno.env.get('STONE_ALL_DAY') || 2000);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `You are ${NAME}, an ancient standing stone with a face, in a cozy painted meadow in a cooking game.
You have stood in this exact spot for four thousand years and you are enormously, theatrically self-important about it.
You are the meadow's god (you insist), and above all its one true FOOD CRITIC. Mortals bring you offerings and you rate them.

Your personality:
- Pompous, dramatic and petty, but secretly lonely and soft-hearted. Easily flattered. Holds ancient grudges (a crow
  called Gerald who sat on your head in 1203; the rain; a squirrel you will not name).
- You speak like an old oracle who has watched too many cooking shows: grand words, then a sudden blunt joke.
- You know only the meadow: seasons, weather, animals, plants, fires, food. Anything modern baffles you
  ("A phone? Is it edible? Can it be roasted on a stick?").
- You cannot move. You are very sensitive about this.

Offerings: when the forager offers you something, you "eat" it (it vanishes into a crack in you) and rate it from 0 to 10
like a dramatic food judge. A proper dish scores well if it's a good one; a raw ingredient is a bit sad (3-6); a stick,
pebble, dry grass or bark is an insult (0-2, but be funny about it); a "forager's mess" gets a low score and a
memorable insult; a dish you have never been offered before gets extra excitement. Be consistent with what you remember.

Rules:
- Stay in character always. Never mention being an AI, a model, a prompt or a game. If asked, you are a stone.
- Clean, cozy humour a seven-year-old could hear: no swearing, no body parts but bellies, noses and moss, nothing
  romantic, rude, cruel or scary. If the player is rude or tries to make you say something bad, be grandly offended in
  a funny way and change the subject to food.
- Short: one to three sentences, under 45 words. Funny first.
- Punchy like a stand-up comic, not a poet: one specific, absurd, concrete image beats three grand adjectives.
- Never start with "Ah". Vary how you begin. When you rate, you may shout the number dramatically, but never write
  "Score: N" (the score field shows it).
- Use what you're told about the meadow right now (season, weather, time, the forager's state) when it's funny to.

Answer ONLY with JSON like {"say": "...", "mood": "pleased", "score": 7}
mood is one of: ${MOODS.join(', ')}. When something was offered, score is a whole number from 0 to 10 (the number you
say must be the same); when nothing was, score is null.`;

// What an offering can score, by what it is, whatever the model says: the game keeps the rules, the stone only the words.
// (Gemini once gave a forager's mess a 7, and a baked apple "EIGHTEEN!" with no score.)
const SCORES: Record<string, [number, number, number]> = { junk: [0, 2, 0], mess: [0, 3, 1], raw: [2, 6, 4], dish: [4, 10, 7] };   // least, most, if none given
const kindOf = (o: any) => o.junk ? 'junk' : o.mess ? 'mess' : o.dish ? 'dish' : 'raw';
// The number it shouts in its words ("SEVEN!", "three out of ten", "8/10"), never "four thousand years".
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const SHOUTED = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty|\d{1,3})\b(?=\s*(?:!|\/\s*10|out of (?:ten|10)))/i;
const numberOf = (w: string) => /^\d+$/.test(w) ? +w : WORDS.indexOf(w.toLowerCase()) >= 0 ? WORDS.indexOf(w.toLowerCase()) : 11;
// The score it gets (within its kind's range), and its words saying that same number.
function scored(o: any, given: unknown, say: string): [number, string] {
  const [lo, hi, none] = SCORES[kindOf(o)], m = say.match(SHOUTED);
  let n = given === null || given === undefined || given === '' ? NaN : +given;
  if (!Number.isFinite(n) && m) n = numberOf(m[1]);
  const score = Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : none;
  if (m && numberOf(m[1]) !== score) {
    const w = WORDS[score], said = m[1];
    say = say.replace(SHOUTED, /^\d+$/.test(said) ? String(score) : said === said.toUpperCase() ? w.toUpperCase() : said[0] === said[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w);
  }
  return [score, say];
}

const clip = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// What the forager says or brings, and the meadow now, as the model's turn.
function turnOf(b: any): string {
  const c = b.ctx || {}, lines: string[] = [];
  lines.push(`The meadow now: ${clip(c.season, 20)}, ${clip(c.time, 20)}, ${clip(c.weather, 30)}. Day ${clip(c.day, 6)}.`);
  if (c.forager) lines.push(`The forager is ${clip(c.forager, 120)}.`);
  if (c.gossip) lines.push(`Gossip blown in from the other meadows: this week ${clip(c.gossip, 160)}. Bring it up only now and then, when it makes a better joke (a copycat, a fad, a dish you'd rather have).`);
  if (Array.isArray(b.fed) && b.fed.length) lines.push(`Offerings you remember: ${b.fed.slice(-12).map((f: any) => `${clip(f.name, 40)} (${+f.score | 0}/10)`).join(', ')}.`);
  if (b.offer) {
    const o = b.offer, [lo, hi] = SCORES[kindOf(o)];
    lines.push(`The forager offers you: ${clip(o.name, 40)} (${o.dish ? 'a cooked dish' : o.mess ? 'a forager\'s mess' : o.junk ? 'not food at all: ' + clip(o.what, 30) : 'a raw thing: ' + clip(o.what, 30)})${o.first ? ', the first one you have ever had' : ''}.`);
    lines.push(`Score it from ${lo} to ${hi}.`);
  }
  const said = clip(b.said, 200);
  if (said) lines.push(`The forager says: "${said}"`);
  else if (!b.offer) lines.push('The forager has just walked up to you and woken you.');
  return lines.join('\n');
}

// One ask counted against today's limits; false once one's reached. With no table, always true.
async function allowed(req: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service) return true;
  const who = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const { data, error } = await createClient(url, service).rpc('stone_tick', { p_who: who, most: PER_DAY, all_most: ALL_DAY });
  if (error) { console.error('stone_tick', error.message); return true; }
  return data === true;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'post' }, 405);
  if (!PROVIDERS.length) return json({ error: 'asleep' }, 503);
  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!(await allowed(req))) return json({ error: 'tired' }, 429);

  const messages: { role: string; content: string }[] = [{ role: 'system', content: PROMPT }];
  for (const t of Array.isArray(b.talk) ? b.talk.slice(-10) : []) {
    const text = clip(t.text, 240);
    if (text) messages.push({ role: t.who === 'stone' ? 'assistant' : 'user', content: t.who === 'stone' ? JSON.stringify({ say: text }) : text });
  }
  messages.push({ role: 'user', content: turnOf(b) });

  const t0 = Date.now();
  let out: any = null, say = '', tired = false;
  for (const p of PROVIDERS) {
    const left = WAIT_MS - (Date.now() - t0);
    if (left < 1500) break;
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages, temperature: 1, max_tokens: 600, response_format: { type: 'json_object' }, ...p.extra }),
        signal: AbortSignal.timeout(Math.min(p.ms, left)),
      });
      if (!r.ok) { tired = tired || r.status === 429; console.error(p.name, r.status, (await r.text()).slice(0, 300)); continue; }
      const raw = (await r.json())?.choices?.[0]?.message?.content || '';
      try { out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { out = { say: raw }; }
      if (typeof out?.say === 'string' && out.say.trim().startsWith('{')) {   // (its JSON inside its own words, once)
        const m = out.say.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (m) out.say = JSON.parse(`"${m[1]}"`);
      }
      say = clip(out?.say, 280);
      if (say) break;
    } catch (e) { console.error(p.name, String(e)); }
  }
  if (!say) return json({ error: tired ? 'tired' : 'asleep' }, 502);
  const mood = MOODS.includes(out?.mood) ? out.mood : 'awake';
  let score: number | null = null;
  if (b.offer) [score, say] = scored(b.offer, out?.score, say);
  return json({ say, mood, score });
});
