/* Nobody's Meadow — what all the meadows did together. The Supabase Edge Function supabase/functions/tally reads it out of
   our Umami (the events game.js `track` sends) once an hour and hands back only totals: foragers today and their countries,
   how many found each thing, the week's most-cooked dishes and most-caught fish, and the season's count toward the meadows'
   goal (recipes.js `festival`). Kept in localStorage an hour (KEEP), so a page opened again doesn't ask; when it can't be
   reached there's simply nothing to show, and the game shows nothing of it.

   game.js uses it as Tally: Tally.now (the last tally or null), Tally.on(fn) (called when a new one comes), Tally.share(key)
   (the part of foragers who found a first: 'honey', 'dish:Fish soup'; null while too few have played to say).
   ?tally=fake makes one up to look at (?tally=done: the goal reached). */
(() => {
'use strict';
const FN = 'https://cecvgnhqavygiqkbpkuz.supabase.co/functions/v1/tally';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3ZnbmhxYXZ5Z2lxa2Jwa3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzY4NDQsImV4cCI6MjEwNzc1Mjg0NH0.55flj4Nr9KumknbpSKj3Lt63QMTonIcwkwQ_M5fQrPQ';
const KEPT = 'aeon-garden-tally';
const KEEP = 3600 * 1000;                  // ms a tally is good for
const FEW = 20;                            // fewer foragers than this have found anything: no "found by n%" yet
const FAKE = new URLSearchParams(location.search).get('tally');

let now = null;
const heard = [];
const take = t => { if (!t || typeof t !== 'object' || !t.day) return; now = t; for (const fn of heard) try { fn(t); } catch (e) { console.error(e); } };

// Made up, to look at the pages with no function behind them: a fixed share for each key, from its letters.
function fake(done) {
  const n = {}, of = 480;
  const share = k => { let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return [0.92, 0.6, 0.35, 0.18, 0.07, 0.02][h % 6]; };
  return { at: new Date().toISOString(), fake: true, day: { foragers: 214, countries: 19 },
    found: { of, n: new Proxy(n, { get: (o, k) => typeof k === 'string' ? Math.round(share(k) * of) : undefined, has: () => true }) },
    week: { dishes: [['Fish soup', 412], ['Baked apple with honey', 377], ['Roast fish on a stick', 290], ['Nettle soup', 188], ['Roast mushrooms', 160]],
      fish: [['roach', 1210], ['perch', 640], ['trout', 233], ['eel', 41]] },
    season: { name: 'autumn', from: '2026-09-01T00:00:00Z', till: '2026-12-01T00:00:00Z', fish: done ? 2104 : 1284, dishes: 5210 } };
}

if (FAKE) setTimeout(() => take(fake(FAKE === 'done')), 0);
else {
  let old = null;
  try { old = JSON.parse(localStorage.getItem(KEPT) || 'null'); } catch {}
  if (old && old.t) take(old.t);
  if (!old || !(Date.now() - old.got < KEEP)) {
    fetch(FN, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: AbortSignal.timeout(10000) })
      .then(r => r.ok ? r.json() : null)
      .then(t => { if (!t || !t.day) return; take(t); try { localStorage.setItem(KEPT, JSON.stringify({ got: Date.now(), t })); } catch {} })
      .catch(() => {});
  }
}

const share = key => {
  const f = now && now.found;
  if (!f || !(f.of >= FEW)) return null;
  return Math.min(1, (f.n[key] || 0) / f.of);
};

window.Tally = { get now() { return now; }, on: fn => { heard.push(fn); }, share, FEW };
})();
