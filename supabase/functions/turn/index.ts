// A TURN relay for playing together (net.js): a Supabase Edge Function that asks Cloudflare's Realtime TURN for a day's
// credentials and hands the page its iceServers. Some phones can't reach a friend directly (an mDNS address the other
// side can't resolve, a router that won't hairpin), and PeerJS's free TURN often doesn't answer; then the line goes
// through Cloudflare's relay. The key lives here as Supabase secrets, never in the page:
//   TURN_KEY_ID, TURN_KEY_TOKEN     the TURN key's id and API token (Cloudflare dashboard › Realtime › TURN)
// One set of credentials is kept a while (KEEP_MS) and given to everyone who asks, so a busy evening asks Cloudflare
// a few times, not once a player. It answers { iceServers } or { error }.

const env = (k: string) => Deno.env.get(k) || '';
const KEY_ID = env('TURN_KEY_ID'), TOKEN = env('TURN_KEY_TOKEN');
const TTL = 86400;                        // s a set of credentials lasts (Cloudflare's)
const KEEP_MS = 3600 * 1000;              // ms one set is handed out for (well inside TTL, so a game started late still has hours)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

let kept: unknown[] | null = null, keptAt = 0;

// (Cloudflare may list addresses on port 53, which browsers block: they'd only time out, so they're left out.)
const usable = (s: any) => {
  const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u: string) => typeof u === 'string' && !/:53(\?|$)/.test(u));
  return urls.length ? { ...s, urls } : null;
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!KEY_ID || !TOKEN) return json({ error: 'asleep' }, 503);
  if (kept && Date.now() - keptAt < KEEP_MS) return json({ iceServers: kept });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ ttl: TTL }),
      signal: AbortSignal.timeout(4000),
    });
    const j = await r.json().catch(() => ({}));
    const servers = Array.isArray(j?.iceServers) ? j.iceServers.map(usable).filter(Boolean) : [];
    if (!r.ok || !servers.length) return json({ error: 'cloudflare ' + r.status }, 502);
    kept = servers; keptAt = Date.now();
    return json({ iceServers: servers });
  } catch {
    return json({ error: 'unreachable' }, 502);
  }
});
