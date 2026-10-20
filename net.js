/* Nobody's Meadow — playing together (a prototype). No server of our own: friends meet through PeerJS's free broker
   (0.peerjs.com) and then talk browser to browser (WebRTC). A room is a word in the address (?room=..): the first one in
   claims it and is the host, whose meadow everyone plays in; the others join it. Only the host's meadow runs the clock: a
   guest gets the host's meadow as it is (Sim.packWorld), and from then on runs the same sim at the host's tick, so the
   animals and the weather come out the same without being sent (sim.js draws no Math.random). What does get sent: where
   each forager is (a few times a second), what each picks and drops (so it's gone for everyone), and the host's tick.
   ?room=..&local plays across tabs of one browser instead (BroadcastChannel), with no network, for trying it out.
   Some phones can't reach a friend straight (an mDNS address the other side can't resolve, a router that won't hairpin),
   so the line may go through a TURN relay: ours is Cloudflare's, its credentials from supabase/functions/turn (iceServers).
   ?netdebug logs PeerJS's chatter and each ICE candidate and state, to see why a line won't come up.

   game.js uses it as Net: Net.start(room, handlers), Net.send(msg), Net.leave(), Net.host, Net.guest, Net.me. Guests talk only to the
   host; the host passes on what each says to the others. */
(() => {
'use strict';
const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
const PREFIX = 'nobodys-meadow-';         // a room's host is the peer PREFIX + room on the broker
const LOCAL_WAIT = 500;                   // ms a tab listens for a host before it hosts itself (local)
const TURN_FN = 'https://cecvgnhqavygiqkbpkuz.supabase.co/functions/v1/turn';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3ZnbmhxYXZ5Z2lxa2Jwa3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzY4NDQsImV4cCI6MjEwNzc1Mjg0NH0.55flj4Nr9KumknbpSKj3Lt63QMTonIcwkwQ_M5fQrPQ';
const TURN_WAIT = 3000;                   // ms to wait for the relay's credentials before going on without them
const DEBUG = /[?&]netdebug\b/.test(location.search);

const Net = { on: false, host: false, guest: false, me: '', room: '', peers: 0 };
let handlers = null, bc = null, peer = null, toHost = null;
const conns = new Map();                  // the host's guests, by id (PeerJS)

// PeerJS's options for every Peer: our relay's iceServers (and Google's STUN), asked for once a page. When the function
// can't be reached or isn't set up, PeerJS's own (its free STUN and TURN), so joining never waits on it for long.
let options = null;
function peerOptions() {
  if (!options) options = fetch(TURN_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: '{}', signal: AbortSignal.timeout(TURN_WAIT) })
    .then(r => r.json())
    .then(j => {
      if (!Array.isArray(j.iceServers) || !j.iceServers.length) throw new Error(j.error || 'no iceServers');
      return { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...j.iceServers] } };
    })
    .catch(e => { if (DEBUG) console.warn('Net: no relay of our own, PeerJS defaults', e); return {}; })
    .then(o => DEBUG ? { ...o, debug: 3 } : o);
  return options;
}

// A line's ICE as it goes (?netdebug), and, on a guest's line not yet open, ICE giving up fails the try at once (PeerJS
// would close it without a word: a DataConnection never opened says no close).
function watchIce(c, g) {
  const pc = c.peerConnection;
  if (!pc) return;
  if (DEBUG) pc.addEventListener('icecandidate', e => e.candidate && console.log('Net candidate', c.peer, e.candidate.type || '', e.candidate.candidate));
  pc.addEventListener('iceconnectionstatechange', () => {
    if (DEBUG) console.log('Net ice', c.peer, pc.iceConnectionState);
    if (g && pc.iceConnectionState === 'failed' && g === gen && !c.open) lineDown('no way through');
  });
}

// A packed world over PeerJS: as JSON, its typed arrays sent alongside as ArrayBuffers (BinaryPack would hand them back
// as plain ArrayBuffers), and -0, Infinity and NaN kept as words (BinaryPack and JSON would make -0 a 0, and the sim's
// objects need their -0: sim.js blankCreature). Over a BroadcastChannel nothing needs doing: it clones them as they are.
const VIEWS = { Float32Array, Float64Array, Int32Array, Uint32Array, Int16Array, Uint16Array, Int8Array, Uint8Array, Uint8ClampedArray };
function wrap(msg) {
  if (msg.t !== 'world' || bc) return msg;
  const bufs = [];
  const json = JSON.stringify(msg.kept, (k, v) => {
    if (ArrayBuffer.isView(v)) return { $ta: v.constructor.name, i: bufs.push(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) - 1 };
    if (typeof v === 'number' && (Object.is(v, -0) || !isFinite(v))) return { $n: Object.is(v, -0) ? '-0' : String(v) };
    return v;
  });
  return { ...msg, kept: null, json, bufs };
}
// (Over the DataChannel each buffer comes back as a Uint8Array over it, not the ArrayBuffer itself.)
const bytesOf = b => b instanceof ArrayBuffer ? b : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
function unwrap(msg) {
  if (msg.t !== 'world' || bc) return msg;
  msg.kept = JSON.parse(msg.json, (k, v) => v && v.$ta ? new VIEWS[v.$ta](bytesOf(msg.bufs[v.i])) : v && v.$n !== undefined ? Number(v.$n) : v);
  msg.json = msg.bufs = null;
  return msg;
}

function heard(msg, conn) {
  if (!msg || msg.from === Net.me) return;
  if (msg.to && msg.to !== Net.me) {                     // (one guest's word to another goes through the host)
    const c = Net.host && conn && conns.get(msg.to);
    if (c && c.open) c.send(msg);
    return;
  }
  if (Net.host && conn && !msg.to) for (const [id, c] of conns) if (c !== conn && c.open) c.send(msg);   // passed on to the other guests
  handlers.message(unwrap(msg));
}

Net.send = msg => {
  if (!Net.on) return;
  msg.from = Net.me;
  if (bc) { bc.postMessage(msg); return; }
  const m = wrap(msg);
  if (Net.guest) { if (toHost && toHost.open) toHost.send(m); return; }
  for (const [id, c] of conns) if (c.open && (!msg.to || msg.to === id)) c.send(m);
};

function becomeHost() {
  Net.host = true; Net.guest = false; Net.on = true;
  handlers.ready('host');
}

// ?room=..&local: tabs of one browser. A new tab asks who's hosting; nobody answers in LOCAL_WAIT, it hosts.
function startLocal() {
  Net.me = 'tab-' + Math.random().toString(36).slice(2, 8);
  bc = new BroadcastChannel(PREFIX + Net.room);
  let decided = false;
  bc.onmessage = e => {
    const m = e.data;
    if (m.t === 'who' && Net.host) { bc.postMessage({ t: 'here', from: Net.me, to: m.from }); handlers.joined(m.from); return; }
    if (m.t === 'here' && m.to === Net.me && !decided) { decided = true; Net.guest = true; Net.on = true; handlers.ready('guest'); return; }
    if (m.t === 'who' || m.t === 'here') return;
    heard(m, null);
  };
  bc.postMessage({ t: 'who', from: Net.me });
  setTimeout(() => { if (!decided) { decided = true; becomeHost(); } }, LOCAL_WAIT);
  addEventListener('pagehide', () => bc && bc.postMessage({ t: 'bye', from: Net.me }));
}

// A guest's line to the host. When it drops (cell to Wi-Fi, a tunnel, a tab put to sleep) the guest doesn't give up at once:
// it tries again with a new peer, after RETRY_MS in turn, and only when they've all failed is the host gone (lost()). Each
// try is a generation (gen), so a late word from an old one is ignored. Offline waits without counting; Net.recheck() (game.js
// calls it when the network comes back or the page does) tries at once. The first join (joining) goes the same way but
// quietly and with fewer tries (JOIN_RETRY_MS, all of them in about 40 s), and when they've all failed says so (failed()).
const RETRY_MS = [1000, 2000, 4000, 8000, 8000, 8000], JOIN_RETRY_MS = [1000, 2000, 4000], TRY_MS = 8000;
let gen = 0, tries = 0, retryTimer = 0, tryTimer = 0, joining = false, why = '';
Net.reconnecting = false;

function guestLine() {
  const g = ++gen;
  peerOptions().then(o => {
    if (g !== gen) return;
    const me = new window.Peer(o);
    me.on('open', id => {
      if (g !== gen) { me.destroy(); return; }
      peer = me; Net.me = id;
      const c = me.connect(PREFIX + Net.room, { reliable: true });
      toHost = c;
      watchIce(c, g);
      c.on('open', () => {
        if (g !== gen) return;
        clearTimeout(tryTimer);
        const back = Net.reconnecting;
        Net.reconnecting = joining = false; tries = 0;
        Net.guest = true; Net.on = true; Net.peers = 1;
        if (back) { if (handlers.back) handlers.back(); } else handlers.ready('guest');
      });
      c.on('data', m => heard(m, c));
      c.on('close', () => { if (g === gen) lineDown('the line closed'); });
      c.on('error', e => { if (g === gen && !c.open) lineDown(e.type || String(e)); });
    });
    me.on('error', e => {
      if (g !== gen) { me.destroy(); return; }
      if (Net.reconnecting || joining) lineDown(e.type || String(e));
      else console.warn('Net', e);
    });
  });
}

function lineDown(reason) {
  clearTimeout(tryTimer); clearTimeout(retryTimer);
  gen++;                                               // (whatever the last try was, it's over)
  Net.on = false; Net.peers = 0;
  if (reason) why = reason;
  const online = navigator.onLine !== false, wait = joining ? JOIN_RETRY_MS : RETRY_MS;
  if (online && tries >= wait.length) {
    Net.reconnecting = false;
    if (joining) { joining = false; dropLine(); handlers.failed(why || 'no answer', 'guest'); } else handlers.lost();
    return;
  }
  if (!joining && !Net.reconnecting) { Net.reconnecting = true; if (handlers.reconnecting) handlers.reconnecting(); }
  retryTimer = setTimeout(attempt, online ? wait[tries++] : RETRY_MS[2]);
}

// The last try's line and peer let go of, quietly.
function dropLine() {
  for (const c of [toHost]) if (c) { c.removeAllListeners(); try { c.close(); } catch (e) { /* gone already */ } }
  if (peer) { peer.removeAllListeners(); try { peer.destroy(); } catch (e) { /* gone already */ } }
  peer = toHost = null;
}

function attempt() {
  if (!(Net.reconnecting || joining) || bc) return;
  clearTimeout(tryTimer); clearTimeout(retryTimer);
  dropLine();
  guestLine();
  const g = gen;
  tryTimer = setTimeout(() => { if (g === gen) lineDown('no answer'); }, TRY_MS);   // (a try that hangs counts as failed)
}

// The network came back, or the page did: a guest whose line is down tries now; a host whose broker line dropped takes it up
// again (so friends can find the room), and a guest whose line looks shut at once goes the same way.
Net.recheck = () => {
  if (bc || !peer) return;
  if (Net.host) { if (peer.disconnected && !peer.destroyed) peer.reconnect(); return; }
  if (Net.reconnecting) { attempt(); return; }
  if (Net.guest && (!toHost || !toHost.open)) { Net.reconnecting = true; if (handlers.reconnecting) handlers.reconnecting(); attempt(); }
};

// Over the internet: claim the room's name on the broker; taken, join whoever has it.
function startPeer() {
  const g = gen;
  peerOptions().then(o => {
    if (g === gen && !bc) claim(o);
  });
  addEventListener('pagehide', () => peer && peer.destroy());
}

function claim(o) {
  const host = new window.Peer(PREFIX + Net.room, o);
  host.on('open', id => {
    peer = host; Net.me = id; becomeHost();
    host.on('connection', c => {
      watchIce(c, 0);
      c.on('open', () => { conns.set(c.peer, c); Net.peers = conns.size; handlers.joined(c.peer); });
      c.on('data', m => heard(m, c));
      c.on('close', () => { conns.delete(c.peer); Net.peers = conns.size; heard({ t: 'bye', from: c.peer }, c); });
    });
  });
  host.on('error', e => {
    if (e.type !== 'unavailable-id') { if (!Net.on) handlers.failed(e.type || String(e), 'host'); else console.warn('Net', e); return; }
    host.destroy();
    joining = true; tries = 0; why = '';
    attempt();
  });
}

// Leaving: a bye to the others (a guest's host, or a host's guests, who then keep the meadow as their own), and the line
// closed, quietly (no lost() or bye heard back). Net.start can open another after.
Net.leave = () => {
  if (Net.on) Net.send({ t: 'bye' });
  gen++; Net.reconnecting = joining = false; tries = 0; clearTimeout(tryTimer); clearTimeout(retryTimer);
  if (bc) { bc.onmessage = null; bc.close(); bc = null; }
  for (const c of [toHost, ...conns.values()]) if (c) c.removeAllListeners();
  if (peer) { peer.removeAllListeners(); setTimeout(peer.destroy.bind(peer), 200); }   // (a moment for the bye to go)
  peer = toHost = null; conns.clear();
  Net.on = Net.host = Net.guest = false; Net.peers = 0;
};

// handlers: ready(role), joined(id) (host: a guest came), message(msg), lost() (guest: the host went), failed(why, role)
// (the room couldn't be opened, as 'host', or the friend's meadow reached, as 'guest'),
// reconnecting() and back() (guest: the line dropped and is being taken up again, and was).
Net.start = (room, local, h) => {
  handlers = h;
  Net.room = String(room).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'meadow';
  if (local || !window.RTCPeerConnection) { startLocal(); return; }
  peerOptions();                                       // (asked for while PeerJS loads)
  if (window.Peer) { startPeer(); return; }
  const js = document.createElement('script');
  js.src = PEERJS;
  js.onload = startPeer;
  js.onerror = () => h.failed('could not load PeerJS', 'host');
  document.head.append(js);
};

window.Net = Net;
})();
