// What all the meadows did together, read back out of our Umami (stats.cryptoler.net) for the game (tally.js): how many
// foragers walked a meadow today, how many of them found each thing, the week's most-cooked dishes and catches (the
// book's Everyone page, the old stone's gossip) and the season's count toward the meadows' goal (recipes.js `festival`).
// It reads Umami's own Postgres (its Supabase project), with a role that can only read (supabase/tally.sql). Secrets:
//   UMAMI_DB      that role's connection string (the transaction pooler, port 6543)
//   UMAMI_SITE    the meadow's website id in Umami
// The page sees only totals, never a session or a country's name. Worked out once an hour (KEEP_MS) and handed to
// everyone who asks in between, so a busy evening asks the database a few times, not once a player.
// It answers { at, day, found, week, season } (see tally.js) or { error }.
import postgres from 'npm:postgres@3.4.4';

const env = (k: string) => Deno.env.get(k) || '';
const DB = env('UMAMI_DB'), SITE = env('UMAMI_SITE');
const KEEP_MS = 3600 * 1000;
const TOP = 5;                            // dishes and catches kept for the week
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': status === 200 ? 'public, max-age=900' : 'no-store' } });

// The seasons as the calendar has them in the north (where most foragers are): autumn is September to November.
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
function seasonNow(t = new Date()) {
  const m = t.getUTCMonth(), i = Math.floor(((m + 1) % 12) / 3);   // (month -1 is the December before)
  const from = new Date(Date.UTC(t.getUTCFullYear() + (m === 11 ? 1 : 0), i * 3 - 1, 1)), till = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 3, 1));
  return { name: SEASONS[i], from, till };
}

// Umami keeps an event in website_event (event_name, the custom event's name) and what came with it in event_data, a row a
// key (data_key, string_value). $1 is the website, $2 a time to count from.
const Q = {
  // Everyone who opened a meadow in the last day, and in how many countries.
  day: `select count(distinct e.session_id)::int as foragers, count(distinct s.country)::int as countries
    from website_event e join session s on s.session_id = e.session_id
    where e.website_id = $1 and e.created_at > $2`,
  // Each first (a find's id, 'dish:' + a dish's name...) by how many browsers sent it, and how many sent any first at all.
  found: `select d.string_value as what, count(distinct e.session_id)::int as n
    from website_event e join event_data d on d.website_event_id = e.event_id
    where e.website_id = $1 and e.event_name = 'first' and d.data_key = 'what' and e.created_at > $2
    group by 1`,
  finders: `select count(distinct session_id)::int as n from website_event
    where website_id = $1 and event_name = 'first' and created_at > $2`,
  // The week's dishes (a mess isn't one) and catches (landed, perfect: not lost, not a haul of mussels or a treasure).
  dishes: `select d.string_value as name, count(*)::int as n
    from website_event e join event_data d on d.website_event_id = e.event_id
    where e.website_id = $1 and e.event_name = 'cook' and d.data_key = 'dish' and d.string_value <> 'mess' and e.created_at > $2
    group by 1 order by 2 desc, 1 limit ${TOP}`,
  fish: `select k.string_value as kind, count(*)::int as n
    from website_event e join event_data k on k.website_event_id = e.event_id and k.data_key = 'kind'
    join event_data h on h.website_event_id = e.event_id and h.data_key = 'how'
    where e.website_id = $1 and e.event_name = 'fish' and h.string_value in ('landed', 'perfect') and e.created_at > $2
    group by 1 order by 2 desc, 1 limit ${TOP}`,
  // The season's count toward the goal: fish landed and dishes cooked since it began.
  season: `select
      count(*) filter (where e.event_name = 'fish' and h.string_value in ('landed', 'perfect'))::int as fish,
      count(*) filter (where e.event_name = 'cook' and coalesce(c.string_value, '') <> 'mess')::int as dishes
    from website_event e
    left join event_data h on h.website_event_id = e.event_id and h.data_key = 'how'
    left join event_data c on c.website_event_id = e.event_id and c.data_key = 'dish'
    where e.website_id = $1 and e.event_name in ('fish', 'cook') and e.created_at > $2`,
};

let kept: unknown = null, keptAt = 0, asking: Promise<unknown> | null = null;

async function tally() {
  const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 8 });
  try {
    const now = Date.now(), day = new Date(now - 86400e3), week = new Date(now - 7 * 86400e3), ever = new Date(0), S = seasonNow();
    const [d, f, fs, ds, fish, s] = await Promise.all([
      sql.unsafe(Q.day, [SITE, day]), sql.unsafe(Q.found, [SITE, ever]), sql.unsafe(Q.finders, [SITE, ever]),
      sql.unsafe(Q.dishes, [SITE, week]), sql.unsafe(Q.fish, [SITE, week]), sql.unsafe(Q.season, [SITE, S.from]),
    ]);
    const n: Record<string, number> = {};
    for (const r of f) if (r.what) n[String(r.what).slice(0, 60)] = r.n;
    return {
      at: new Date(now).toISOString(),
      day: { foragers: d[0]?.foragers || 0, countries: d[0]?.countries || 0 },
      found: { of: fs[0]?.n || 0, n },
      week: { dishes: ds.map(r => [r.name, r.n]), fish: fish.map(r => [r.kind, r.n]) },
      season: { name: S.name, from: S.from.toISOString(), till: S.till.toISOString(), fish: s[0]?.fish || 0, dishes: s[0]?.dishes || 0 },
    };
  } finally {
    await sql.end({ timeout: 2 });
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!DB || !SITE) return json({ error: 'asleep' }, 503);
  if (kept && Date.now() - keptAt < KEEP_MS) return json(kept);
  try {
    asking = asking || tally().finally(() => { asking = null; });   // (one ask at a time, whoever comes while it's out waits for it)
    kept = await asking; keptAt = Date.now();
    return json(kept);
  } catch (e) {
    console.error('tally', String(e).slice(0, 300));
    return kept ? json(kept) : json({ error: 'unreachable' }, 502);   // (an old tally beats none)
  }
});
