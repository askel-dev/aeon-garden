/* Nobody's Meadow — playing together (a prototype). No server of our own: friends meet through PeerJS's free broker
   (0.peerjs.com) and then talk browser to browser (WebRTC). A room is a word in the address (?room=..): the first one in
   claims it and is the host, whose meadow everyone plays in; the others join it. Only the host's meadow runs the clock: a
   guest gets the host's meadow as it is (Sim.packWorld), and from then on runs the same sim at the host's tick, so the
   animals and the weather come out the same without being sent (sim.js draws no Math.random). What does get sent: where
   each forager is (a few times a second), what each picks and drops (so it's gone for everyone), and the host's tick.
   ?room=..&local plays across tabs of one browser instead (BroadcastChannel), with no network, for trying it out.

   game.js uses it as Net: Net.start(room, handlers), Net.send(msg), Net.host, Net.guest, Net.me. Guests talk only to the
   host; the host passes on what each says to the others. */
(() => {
'use strict';
const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
const PREFIX = 'nobodys-meadow-';         // a room's host is the peer PREFIX + room on the broker
const LOCAL_WAIT = 500;                   // ms a tab listens for a host before it hosts itself (local)

const Net = { on: false, host: false, guest: false, me: '', room: '', peers: 0 };
let handlers = null, bc = null, peer = null, toHost = null;
const conns = new Map();                  // the host's guests, by id (PeerJS)

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
  if (msg.to && msg.to !== Net.me) return;
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
  addEventListener('pagehide', () => bc.postMessage({ t: 'bye', from: Net.me }));
}

// Over the internet: claim the room's name on the broker; taken, join whoever has it.
function startPeer() {
  const P = window.Peer;
  const host = new P(PREFIX + Net.room);
  host.on('open', id => {
    peer = host; Net.me = id; becomeHost();
    host.on('connection', c => {
      c.on('open', () => { conns.set(c.peer, c); Net.peers = conns.size; handlers.joined(c.peer); });
      c.on('data', m => heard(m, c));
      c.on('close', () => { conns.delete(c.peer); Net.peers = conns.size; heard({ t: 'bye', from: c.peer }, c); });
    });
  });
  host.on('error', e => {
    if (e.type !== 'unavailable-id') { if (!Net.on) handlers.failed(e.type || String(e)); else console.warn('Net', e); return; }
    host.destroy();
    const me = new P();
    me.on('open', id => {
      peer = me; Net.me = id;
      const c = me.connect(PREFIX + Net.room, { reliable: true });
      toHost = c;
      c.on('open', () => { Net.guest = true; Net.on = true; Net.peers = 1; handlers.ready('guest'); });
      c.on('data', m => heard(m, c));
      c.on('close', () => { Net.on = false; Net.peers = 0; handlers.lost(); });
    });
    me.on('error', e2 => { if (!Net.on) handlers.failed(e2.type || String(e2)); else console.warn('Net', e2); });
  });
  addEventListener('pagehide', () => peer && peer.destroy());
}

// handlers: ready(role), joined(id) (host: a guest came), message(msg), lost() (guest: the host went), failed(why).
Net.start = (room, local, h) => {
  handlers = h;
  Net.room = String(room).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'meadow';
  if (local || !window.RTCPeerConnection) { startLocal(); return; }
  if (window.Peer) { startPeer(); return; }
  const js = document.createElement('script');
  js.src = PEERJS;
  js.onload = startPeer;
  js.onerror = () => h.failed('could not load PeerJS');
  document.head.append(js);
};

window.Net = Net;
})();
