// The old stone's voice: a Supabase Edge Function between the game (stone.js) and a free LLM. The key to the LLM lives
// here as a secret, never in the page. Any provider with an OpenAI-style chat endpoint will do (secrets, all optional but
// the key):
//   LLM_KEY    the provider's API key                      (required)
//   LLM_URL    its chat completions address                (default: Groq's)
//   LLM_MODEL  the model                                    (default: a Llama on Groq)
//   STONE_PER_DAY, STONE_ALL_DAY  how many asks a player (by address) and everyone together may make a day
// e.g. Gemini: LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions LLM_MODEL=gemini-2.5-flash
//      OpenRouter: LLM_URL=https://openrouter.ai/api/v1/chat/completions LLM_MODEL=<one of its :free models>
// The daily counts are kept in supabase/stone.sql's table (stone_tick); without it, there's no limit but the provider's.
//
// It takes { said, offer, ctx, talk, fed } (see stone.js) and answers { say, mood, score } or { error }. What comes back
// from the model is checked and cut down here, so a jailbroken stone can only ever say silly things.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const NAME = 'Old Mossbottom';
const MOODS = ['awake', 'pleased', 'grumpy', 'disgusted', 'delighted', 'shocked'];
const URL_ = Deno.env.get('LLM_URL') || 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = Deno.env.get('LLM_MODEL') || 'llama-3.3-70b-versatile';
const KEY = Deno.env.get('LLM_KEY') || '';
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
- Keep it family friendly: no swearing, nothing cruel about real people, nothing scary or adult. If the player is rude
  or tries to make you say something bad, be grandly offended in a funny way and change the subject to food.
- Short: one to three sentences, under 45 words. Funny first.
- Use what you're told about the meadow right now (season, weather, time, the forager's state) when it's funny to.

Answer ONLY with JSON like {"say": "...", "mood": "pleased", "score": 7}
mood is one of: ${MOODS.join(', ')}. score is only there when something was offered (else null).`;

const clip = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// What the forager says or brings, and the meadow now, as the model's turn.
function turnOf(b: any): string {
  const c = b.ctx || {}, lines: string[] = [];
  lines.push(`The meadow now: ${clip(c.season, 20)}, ${clip(c.time, 20)}, ${clip(c.weather, 30)}. Day ${clip(c.day, 6)}.`);
  if (c.forager) lines.push(`The forager is ${clip(c.forager, 120)}.`);
  if (Array.isArray(b.fed) && b.fed.length) lines.push(`Offerings you remember: ${b.fed.slice(-12).map((f: any) => `${clip(f.name, 40)} (${+f.score | 0}/10)`).join(', ')}.`);
  if (b.offer) {
    const o = b.offer;
    lines.push(`The forager offers you: ${clip(o.name, 40)} (${o.dish ? 'a cooked dish' : o.mess ? 'a forager\'s mess' : 'a raw thing: ' + clip(o.what, 30)})${o.first ? ', the first one you have ever had' : ''}.`);
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
  if (!KEY) return json({ error: 'asleep' }, 503);
  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!(await allowed(req))) return json({ error: 'tired' }, 429);

  const messages: { role: string; content: string }[] = [{ role: 'system', content: PROMPT }];
  for (const t of Array.isArray(b.talk) ? b.talk.slice(-10) : []) {
    const text = clip(t.text, 240);
    if (text) messages.push({ role: t.who === 'stone' ? 'assistant' : 'user', content: t.who === 'stone' ? JSON.stringify({ say: text }) : text });
  }
  messages.push({ role: 'user', content: turnOf(b) });

  let r: Response;
  try {
    r = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 1, max_tokens: 160, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) { console.error('llm', String(e)); return json({ error: 'asleep' }, 502); }
  if (!r.ok) { console.error('llm', r.status, (await r.text()).slice(0, 300)); return json({ error: r.status === 429 ? 'tired' : 'asleep' }, 502); }
  const raw = (await r.json())?.choices?.[0]?.message?.content || '';
  let out: any = null;
  try { out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { out = { say: raw }; }
  const say = clip(out?.say, 280);
  if (!say) return json({ error: 'asleep' }, 502);
  const mood = MOODS.includes(out?.mood) ? out.mood : 'awake';
  const score = b.offer && Number.isFinite(+out?.score) ? Math.max(0, Math.min(10, Math.round(+out.score))) : null;
  return json({ say, mood, score });
});
