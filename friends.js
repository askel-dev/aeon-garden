/* Nobody's Meadow — friends. Who you are, who your friends are, whether they're about, and asking each other over, kept
   in Supabase (the tables and their rules: supabase/friends.sql). Playing together itself still goes browser to browser
   (net.js); this only finds the others and says which room they're in.

   You're an anonymous Supabase user, made the first time Friends is opened and kept in localStorage (KEY), so there's no
   signing up: a friend adds you by your code. While the game is in view it says it's here every BEAT_MS, 1 min, inside the 75 s online window (every OFTEN_MS, 30 s, while the friends card is open; here(), with the
   name and the room you're playing together in), and that same call brings the friends list back. A friend seen in the
   last 75 s (by the server's clock) is online. Invites and knocks come at once over Realtime and wait in the table until
   they're answered (Friends.done) or stale, so an unanswered one comes back on a reload.
   game.js hands over your headshot when it changes (.snap(url)): the next beat takes it along, and the list
   says when each friend's was taken, so theirs are fetched (friend_snaps) only when new and only while the card is open.

   The key below is the public (anon) one, made to be in a web page: what it may do is only what the rules in the SQL
   allow. Never the service_role key here.

   game.js uses it as Friends: Friends.start(handlers), .add(code), .accept(id), .drop(id), .invite(id, room),
   .knock(id), .done(id), .beat(), .often(on), .snap(url), .pic(id), and reads .on, .me ({ id, name, code }) and .list. */
(() => {
'use strict';
const BASE = 'https://cecvgnhqavygiqkbpkuz.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3ZnbmhxYXZ5Z2lxa2Jwa3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzY4NDQsImV4cCI6MjEwNzc1Mjg0NH0.55flj4Nr9KumknbpSKj3Lt63QMTonIcwkwQ_M5fQrPQ';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
const KEY = 'aeon-garden-friend';         // in localStorage: who you are (supabase-js keeps its session here)
const BEAT_MS = 60000;                    // ms between "I'm here"s while the game is in view (invites and knocks come over Realtime)
const OFTEN_MS = 30000;                   // ...and while the friends card is open (so a yes shows soon)
const INVITE_FRESH = 10 * 60000;          // an invite older than this when it's read is stale: cleared unheard

const Friends = { on: false, me: null, list: [] };
let db = null, h = null, timer = 0, often = false, starting = null, channel = null;
let mySnap = null, oldSql = false;        // a picture of my meadow for the next beat; the SQL from before pictures
const SNAP_OK = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
const pics = new Map();                   // friends' meadow pictures by id: { at (their snap_at), url }
const told = new Set();                   // invites heard (Realtime and the catch-up read may both bring one)

const load = () => new Promise((ok, no) => {
  if (window.supabase) { ok(); return; }
  const js = document.createElement('script');
  js.src = LIB; js.onload = ok; js.onerror = () => no(new Error('could not load Supabase'));
  document.head.append(js);
});
const must = ({ data, error }) => { if (error) throw new Error(error.message || String(error)); return data; };

// handlers: name() and room() (what to say about you), changed(list) (the list came back), invited({ from, kind, room })
// (kind 'invite': come to room; 'knock': can I come to yours?), failed(why). who: a second you in the same browser
// (for trying it out: ?as=..).
Friends.start = (handlers, who) => {
  h = handlers;
  if (starting) return starting;
  starting = (async () => {
    await load();
    db = db || window.supabase.createClient(BASE, ANON, {
      auth: { storageKey: KEY + (who ? '-' + who : ''), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    let { data: { session } } = await db.auth.getSession();
    if (!session) session = must(await db.auth.signInAnonymously()).session;
    Friends.me = must(await db.rpc('me', { new_name: h.name() }));
    Friends.on = true;
    await Friends.beat();                              // (the list first: an invite is told by who sent it)
    listen();
    await heardInvites();
  })().catch(e => { starting = null; Friends.on = false; h.failed(e.message); });
  return starting;
};

function tick() {
  clearTimeout(timer);
  if (Friends.on && document.visibilityState === 'visible') timer = setTimeout(Friends.beat, often ? OFTEN_MS : BEAT_MS);
}
// I'm here (now: a name or a room changed): and the friends list back.
Friends.beat = async () => {
  if (!Friends.on) return;
  clearTimeout(timer);
  try {
    const args = { new_name: h.name(), new_room: h.room() }, snap = mySnap;
    if (snap && !oldSql) args.new_snap = snap;
    let r = await db.rpc('here', args);
    if (r.error && r.error.code === 'PGRST202' && args.new_snap) {   // (no here() that takes a picture yet: on without)
      oldSql = true; delete args.new_snap; r = await db.rpc('here', args);
    }
    Friends.list = must(r) || [];
    if (mySnap === snap) mySnap = null;
    if (often) await fetchPics().catch(() => {});      // (the pictures can wait for the next beat)
    h.changed(Friends.list);
  } catch (e) { /* the network: next beat */ }
  tick();
};
// Friends' pictures that are new since last fetched.
async function fetchPics() {
  const ids = Friends.list.filter(f => f.snap_at && pics.get(f.id)?.at !== f.snap_at).map(f => f.id);
  if (!ids.length) return;
  for (const row of must(await db.rpc('friend_snaps', { ids })) || []) {
    const f = Friends.list.find(x => x.id === row.id);
    if (!f || !SNAP_OK.test(row.snap || '')) continue;
    const bytes = atob(row.snap.slice(row.snap.indexOf(',') + 1)), b = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) b[i] = bytes.charCodeAt(i);
    const was = pics.get(row.id);
    if (was) URL.revokeObjectURL(was.url);
    pics.set(row.id, { at: f.snap_at, url: URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })) });   // (a blob's address: nothing of theirs goes into the page as text)
  }
}
Friends.snap = url => { mySnap = url; };
Friends.pic = id => pics.get(id)?.url || '';
Friends.often = on => { if (often !== on) { often = on; if (on) Friends.beat(); else tick(); } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Friends.beat(); else clearTimeout(timer); });

// By their code: 'asked', 'friends' (they'd asked you), 'self' or 'unknown'.
Friends.add = async code => { const r = must(await db.rpc('add_friend', { friend_code: code })); Friends.beat(); return r; };
Friends.accept = async id => { must(await db.rpc('accept_friend', { other: id })); Friends.beat(); };
Friends.drop = async id => {
  const me = Friends.me.id;
  must(await db.from('friendships').delete().or(`and(a.eq.${me},b.eq.${id}),and(a.eq.${id},b.eq.${me})`));
  Friends.beat();
};
const send = (to, kind, room) => db.from('invites').insert({ from_id: Friends.me.id, to_id: to, kind, room: room || '' }).then(must);
Friends.invite = (id, room) => send(id, 'invite', room);
Friends.knock = id => send(id, 'knock', '');

// Invites to you: each heard once, and left in the table until answered (Friends.done) or
// stale, so a reload within INVITE_FRESH brings an unanswered one back.
function heard(row) {
  if (told.has(row.id)) return;
  told.add(row.id);
  if (Date.now() - Date.parse(row.created_at) > INVITE_FRESH) {
    db.from('invites').delete().eq('id', row.id).then(() => {}, () => {});
    return;
  }
  h.invited({ from: row.from_id, kind: row.kind, room: row.room, id: row.id });
}
// An invite answered (or waved away): gone for good.
Friends.done = id => id ? db.from('invites').delete().eq('id', id).then(() => {}, () => {}) : Promise.resolve();
async function heardInvites() {
  const rows = must(await db.from('invites').select('*').eq('to_id', Friends.me.id).order('id'));
  for (const r of rows || []) heard(r);
}
function listen() {
  if (channel) return;
  channel = db.channel('invites-' + Friends.me.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invites', filter: `to_id=eq.${Friends.me.id}` }, p => heard(p.new))
    .subscribe(status => { if (status === 'SUBSCRIBED') heardInvites().catch(() => {}); });   // (any sent while it wasn't listening)
}

window.Friends = Friends;
})();
