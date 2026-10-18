/* Nobody's Meadow — the offline shell.
 *
 * The meadow should open with the door shut: from the home screen on a plane, or in a dead spot, with no signal at
 * all. This keeps the page and everything it needs to run — the eleven scripts, the painters the workers pull in, the
 * icons and the fonts — on the device, and serves it all from there. A meadow already visited then opens again with no
 * network.
 *
 * Playing with someone (PeerJS) and the friends list (Supabase) are left alone: they are only wanted while there is a
 * network, and a stale copy would be worse than none. The old stone's function is left to itself too (stone.js falls
 * back to its hand-written lines when it can't be reached).
 *
 * The shell is served cache-first, then refreshed from the network behind it (stale-while-revalidate), so an updated
 * script lands on the next visit without anyone bumping a number by hand. VERSION is only for a forced clean start.
 *
 * index.html registers this ('serviceWorker' in navigator). Its fetch handler is also what Android Chrome wants
 * before it offers to install the meadow: without it there is only the manual "Add to Home screen". */

const VERSION = 2;
const CACHE = `meadow-${VERSION}`;

// The page, everything it loads to run (the eleven scripts in index.html: sim, fur, dishes, items, sound, ground,
// recipes, net, friends, stone, game), the painters the workers pull in (fur.js is above; trees.js is not, and
// fur-worker.js / tree-worker.js are loaded by game.js), the icons the home screen and the manifest ask for, the
// fonts index.html lays out, and the manifest itself. Paths are relative to this file, at the meadow's root.
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'sim.js', 'fur.js', 'dishes.js', 'items.js', 'sound.js', 'ground.js',
  'recipes.js', 'net.js', 'friends.js', 'stone.js', 'game.js',
  'trees.js', 'fur-worker.js', 'tree-worker.js',
  'assets/favicon.ico', 'assets/favicon.svg', 'assets/icon-192.png',
  'assets/apple-touch-icon.png', 'assets/logo.png',
  'assets/fonts/fraunces-normal-latin.woff2', 'assets/fonts/fraunces-normal-latin-ext.woff2',
  'assets/fonts/fraunces-italic-latin.woff2', 'assets/fonts/fraunces-italic-latin-ext.woff2',
  'assets/fonts/nunito-normal-latin.woff2', 'assets/fonts/nunito-normal-latin-ext.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    // one at a time, and a miss (a file gone, an install with no network) doesn't throw the rest away
    Promise.all(SHELL.map((path) => cache.add(path).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key);
    // behind a hit, take a fresh copy for next time; with no hit, the network is the answer
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
