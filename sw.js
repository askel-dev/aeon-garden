/* Nobody's Meadow — the offline shell.
 *
 * The meadow should open with the door shut: from the home screen on a plane, or in a dead spot, with no signal at
 * all. This keeps the page and everything it needs to run — the scripts, the painters the workers pull in, the
 * icons and the fonts — on the device, and serves it all from there. A meadow already visited then opens again with no
 * network.
 *
 * Playing with someone (PeerJS) and the friends list (Supabase) are left alone: they are only wanted while there is a
 * network, and a stale copy would be worse than none. The old stone's function is left to itself too (stone.js falls
 * back to its hand-written lines when it can't be reached).
 *
 * The shell is served cache-first and refreshed behind it, so an update lands on the next visit without anyone bumping a
 * number by hand. It's refreshed whole, never a file at a time: a page from one update with a game.js from the one
 * before breaks the meadow (10-20: the new page had lost #me-card, the old script still asked for it, and playing
 * together fell over). So each opening of the page fetches the whole shell past the browser's own cache (Pages lets it
 * keep a file 10 minutes) into a cache of its own, and only once every file is in does that become the one served.
 * VERSION is only for a forced clean start.
 *
 * index.html registers this ('serviceWorker' in navigator). Its fetch handler is also what Android Chrome wants
 * before it offers to install the meadow: without it there is only the manual "Add to Home screen". */

const VERSION = 7;
const CACHE = `meadow-${VERSION}`;

// The page, everything it loads to run (the thirteen scripts in index.html: sim, fur, dishes, items, sound, ground,
// recipes, board, net, friends, stone, updates, game), the painters the workers pull in (fur.js is above; trees.js is not, and
// fur-worker.js / tree-worker.js are loaded by game.js), the icons the home screen and the manifest ask for, the
// fonts index.html lays out, and the manifest itself. Paths are relative to this file, at the meadow's root.
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'sim.js', 'fur.js', 'dishes.js', 'items.js', 'sound.js', 'ground.js',
  'recipes.js', 'board.js', 'net.js', 'friends.js', 'stone.js', 'updates.js', 'game.js',
  'trees.js', 'fur-worker.js', 'tree-worker.js',
  'assets/favicon.ico', 'assets/favicon.svg', 'assets/icon-192.png',
  'assets/apple-touch-icon.png', 'assets/logo.png',
  'assets/fonts/fraunces-normal-latin.woff2', 'assets/fonts/fraunces-normal-latin-ext.woff2',
  'assets/fonts/fraunces-italic-latin.woff2', 'assets/fonts/fraunces-italic-latin-ext.woff2',
  'assets/fonts/nunito-normal-latin.woff2', 'assets/fonts/nunito-normal-latin-ext.woff2',
];

const HAVE = `meadow-${VERSION}-`;                      // a whole shell: HAVE + the time it was fetched
const WHOLE = './.whole';                                // put in last, once every file of the shell is in

// The whole shell, fresh (asked of the server, not the browser's cache), into a new cache; on any miss it's thrown
// away and the one before stays. One at a time.
let filling = null;
function fill() {
  return filling || (filling = (async () => {
    const name = HAVE + Date.now(), cache = await caches.open(name);
    try {
      await Promise.all(SHELL.map(async (path) => {
        const res = await fetch(new Request(path, { cache: 'no-cache' }));
        if (!res.ok) throw new Error(`${path}: ${res.status}`);
        await cache.put(path, res);
      }));
      await cache.put(WHOLE, new Response(''));
      served = name;
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== name).map((k) => caches.delete(k)));
    } catch (e) {
      await caches.delete(name);
    }
  })().finally(() => { filling = null; }));
}

// The cache served from: the newest whole one (the worker may have been stopped and started since it was filled).
let served = null;
async function shell() {
  if (served) return caches.open(served);
  const keys = (await caches.keys()).filter((k) => k.startsWith(HAVE)).sort().reverse();
  for (const k of keys) {
    const cache = await caches.open(k);
    if (await cache.match(WHOLE)) { served = k; return cache; }
  }
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(fill().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== served).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // PeerJS, Supabase, the stone's function: network only
  if (req.headers.has('range')) return;                  // (a seek: leave it to the network)

  const nav = req.mode === 'navigate';                   // a seed or a room rides in the query (?seed=.., ?room=..)
  const key = nav ? new Request(url.origin + url.pathname) : req;   // the shell, kept under its own address
  if (nav) event.waitUntil(fill());                      // the page opening: the whole shell fetched again for next time
  event.respondWith((async () => {
    const cache = await shell();
    const hit = cache && await cache.match(key);
    if (hit) return hit;
    const res = await fetch(req).catch(() => null);      // not in the shell (or no shell yet): the network is the answer
    return res || Response.error();
  })());
});
