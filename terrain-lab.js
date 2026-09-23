/* AEON Garden terrain lab: index.html?lab
 *
 * A slider for every number in Sim.TERRAIN, and the meadow is remade as you drag, drawn by the
 * game itself. You can draw water, rivers and woods on it too, on top of what the meadow makes
 * or on an empty one; the drawing travels in the link (?drawn=, see readDrawn in sim.js). Under it lie the hidden layers (height, water, soil, distance to water), and
 * along the bottom the same settings on eight other seeds. Nothing here makes terrain: sim.js
 * does, so what you see is what the game gets. "Copy as code" hands back sim.js's TERRAIN block
 * with your changes, ready to paste over the old one.
 */
(() => {
'use strict';
const S = window.Sim, G = window.garden, lab = G.lab;
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = v => JSON.parse(JSON.stringify(v));
const DEF = S.TERRAIN;

// ------------------------------------------------------------------ the controls
//
// [key, label, min, max, step] for a slider; a pair (a range in TERRAIN) gets two. Choices are
// buttons. The hints come from the comments in sim.js, so they can't drift apart.

const FOREST_NAMES = { hills: 'hilltops', edge: 'one side', bank: 'by the water' };
const GROUPS = [
  ['⛰️', 'Hills', [
    ['hillSize', 'Hill size', 8, 90, 1],
    ['hillDetail', 'Bumpiness', 0, 1.2, 0.05],
    ['hillFloor', 'Low ground', 0, 0.7, 0.01],
    ['hillRise', 'Steepness', 0.2, 3, 0.05],
    ['bank', 'Bank slope', 0.005, 0.2, 0.005],
  ]],
  ['💧', 'Water', [
    ['layouts', 'Layout', [['Random', DEF.layouts], ['River + lake', { valley: 1, river: 0, lake: 0 }],
      ['River', { valley: 0, river: 1, lake: 0 }], ['Lake', { valley: 0, river: 0, lake: 1 }]]],
    ['level', 'Water level', -0.3, 0.4, 0.01],
    ['deepAt', 'Wading depth', 0.02, 1, 0.01],
  ]],
  ['🏞️', 'Lake', [
    ['lakeBlobs', 'Circles', 1, 16, 1],
    ['lakeSpread', 'Spread', 0, 35, 0.5],
    ['lakeSize', 'Circle size', 1, 25, 0.5],
    ['lakeDepth', 'Depth', 0.1, 2.5, 0.05],
  ]],
  ['〰️', 'River', [
    ['riverBends', 'Between bends', 5, 60, 1],
    ['riverSway', 'Bend swing', 0, 30, 0.5],
    ['meander', 'Wiggles', 0, 24, 0.5],
    ['meanderLength', 'Wiggle length', 5, 150, 1],
    ['riverWidth', 'Half width', 0.3, 8, 0.1],
    ['riverDepth', 'Depth', 0.1, 2.5, 0.05],
    ['fords', 'Fords', 0, 8, 1],
    ['fordDepth', 'Ford depth', 0, 0.9, 0.01],
    ['fordLength', 'Ford length', 2, 50, 1],
  ]],
  ['🫧', 'Ponds', [
    ['ponds', 'Ponds', 0, 16, 1],
    ['pondSize', 'Size', 0.5, 10, 0.5],
    ['pondDepth', 'Depth', 0.02, 2, 0.01],
  ]],
  ['🌱', 'Soil', [
    ['patches', 'Patches', 0, 120, 1],
    ['patchSize', 'Patch size', 1, 50, 0.5],
    ['patchRichness', 'Poor … rich', -1.5, 1.5, 0.05],
    ['wetBanks', 'Rich banks', 0, 1.5, 0.05],
  ]],
  ['🌳', 'Forest', [
    ['forests', 'Kind', [['Random', DEF.forests],
      ...DEF.forests.map(f => [f.map(k => FOREST_NAMES[k] || k).join(' + '), [f]])]],
    ['hillWoods', 'Wooded hilltops', 0, 0.6, 0.01],
    ['edgeWoods', 'Side wood depth', 0, 50, 0.5],
    ['bankWoods', 'Wet wood reach', 0, 70, 0.5],
    ['treeSpacing', 'Tree spacing', 1, 7, 0.1],
    ['treeSize', 'Tree size', 0.8, 7, 0.1],
    ['groves', 'Groves', 0, 25, 1],
  ]],
  ['🪨', 'Scatter', [
    ['rocks', 'Rocks', 0, 150, 1],
    ['flowers', 'Flowers', 0, 0.4, 0.01],
  ]],
];

// ------------------------------------------------------------------ state

const params = new URLSearchParams(location.search);
let urlTerrain = {};
try { urlTerrain = JSON.parse(params.get('terrain') || '{}'); } catch (e) { /* the defaults, then */ }
const t = { ...clone(DEF), ...urlTerrain };
let seed = G.world.seed;
let view = params.get('view') || 'meadow';
let season = +(params.get('season') || 0);
let base = seed;                          // the strip shows seeds base .. base + 7
let peek = false, overlay = null, near = null, madeMs = 0;
let source = null;                        // sim.js's TERRAIN block as written, for the hints and the copy

// What you drew, as createWorld's `drawn` option: numbers in tiles, rounded so the link stays short.
let urlDrawn = {};
try { urlDrawn = JSON.parse(params.get('drawn') || '{}'); } catch (e) { /* nothing drawn, then */ }
let drawn = { empty: false, water: [], rivers: [], woods: [], ...urlDrawn };
let pen = 'look', brush = 5, depth = 0.8, stroke = null, cursor = null, panning = null;
const undo = [];
const hasDrawing = () => drawn.empty || drawn.water.length || drawn.rivers.length || drawn.woods.length;
const drawnOut = () => hasDrawing() ? drawn : {};
const r1 = v => Math.round(v * 10) / 10;

const changes = () => Object.keys(DEF).filter(k => !same(t[k], DEF[k]));
const diff = () => Object.fromEntries(changes().map(k => [k, t[k]]));

// ------------------------------------------------------------------ the panel

const style = document.createElement('style');
style.textContent = `
  #lab-panel { top: var(--top); left: var(--left); bottom: var(--bottom); width: 300px; display: flex; flex-direction: column; z-index: 3; }
  #lab-panel header { padding: 12px 14px 8px; border-bottom: 1px dashed var(--line); }
  #lab-panel h1 { font-size: 17px; font-weight: 900; margin: 0 0 8px; }
  #lab-panel h1 small { font-weight: 700; color: var(--muted); font-size: 12px; margin-left: 6px; }
  .lab-seed { display: flex; gap: 6px; align-items: center; }
  .lab-seed input { width: 0; flex: 1; font: inherit; font-weight: 800; border: 1px solid var(--line); border-radius: 10px; padding: 5px 8px; background: #fff; color: var(--ink); }
  .lab-btn { border: 1px solid var(--line); background: #fff; border-radius: 10px; padding: 5px 9px; font-weight: 800; font-size: 13px; }
  .lab-btn:hover { background: var(--accent-soft); }
  .lab-btn.on { background: var(--accent-soft); border-color: var(--accent); color: #9a5024; }
  .lab-info { color: var(--muted); font-size: 12px; margin-top: 8px; line-height: 1.4; }
  .lab-info b { color: var(--ink); }
  .lab-draw { margin-top: 10px; padding: 9px 10px; background: rgba(0,0,0,0.035); border-radius: 12px; }
  .lab-draw .pens, .lab-draw .pen-row { display: flex; gap: 4px; flex-wrap: wrap; }
  .lab-draw .pens .lab-btn { font-size: 12px; padding: 4px 8px; }
  .lab-draw .pen-row { margin-top: 7px; }
  .lab-draw .pen-row .lab-btn { font-size: 11.5px; padding: 3px 8px; }
  .lab-draw .pen-row .lab-btn:first-child { margin-right: auto; }
  .lab-draw label { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; margin-top: 6px; }
  .lab-draw label input { flex: 1; accent-color: var(--accent); }
  .lab-draw label b { min-width: 74px; text-align: right; font-variant-numeric: tabular-nums; }
  .lab-draw label[hidden] { display: none; }
  .lab-draw .hint { font-size: 11.5px; color: var(--muted); margin-top: 6px; line-height: 1.35; }
  #lab-groups { overflow-y: auto; flex: 1; padding: 4px 14px 10px; overscroll-behavior: contain; }
  #lab-groups details { border-bottom: 1px dashed var(--line); padding: 6px 0; }
  #lab-groups summary { cursor: pointer; font-weight: 900; font-size: 13.5px; padding: 3px 0; list-style: none; display: flex; align-items: center; gap: 6px; }
  #lab-groups summary::-webkit-details-marker { display: none; }
  #lab-groups summary::after { content: '▸'; margin-left: auto; color: var(--muted); transition: transform 0.15s; }
  #lab-groups details[open] summary::after { transform: rotate(90deg); }
  #lab-groups summary .n { background: var(--accent); color: #fff; border-radius: 9px; font-size: 11px; padding: 0 6px; }
  .lab-row { padding: 5px 0 3px; }
  .lab-row .top { display: flex; align-items: baseline; gap: 6px; font-weight: 700; font-size: 12.5px; }
  .lab-row .top .v { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 800; }
  .lab-row .reset { visibility: hidden; border: none; background: none; padding: 0 2px; color: var(--accent); font-weight: 900; }
  .lab-row.changed .top .l::after { content: ' •'; color: var(--accent); }
  .lab-row.changed .v { color: #b35d25; }
  .lab-row.changed .reset { visibility: visible; }
  .lab-row .ranges { display: flex; gap: 8px; }
  .lab-row input[type=range] { width: 100%; accent-color: var(--accent); margin: 3px 0 0; }
  .lab-row .choices { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .lab-row .choices .lab-btn { font-size: 11.5px; padding: 3px 7px; }
  #lab-panel footer { border-top: 1px dashed var(--line); padding: 10px 14px 12px; }
  #lab-changes { font-size: 11.5px; color: var(--muted); max-height: 76px; overflow-y: auto; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
  #lab-changes b { color: var(--ink); }
  .lab-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .lab-actions .main { grid-column: 1 / -1; background: var(--accent); color: #fff; border-color: var(--accent); }
  .lab-actions .main:hover { background: #d9783a; }

  #lab-view { top: var(--top); right: var(--right); width: 270px; padding: 10px 12px; z-index: 3; }
  #lab-view .seg { display: flex; flex-wrap: wrap; gap: 4px; }
  #lab-view .seg + .seg { margin-top: 6px; }
  #lab-view .seg .lab-btn { font-size: 12px; padding: 4px 8px; }
  #lab-legend { margin-top: 9px; font-size: 11.5px; color: var(--muted); }
  #lab-legend .bar { height: 10px; border-radius: 5px; margin: 3px 0 2px; }
  #lab-legend .ends { display: flex; justify-content: space-between; }
  #lab-hover { margin-top: 8px; font-size: 12px; min-height: 2.8em; line-height: 1.4; border-top: 1px dashed var(--line); padding-top: 6px; }
  #lab-keys { font-size: 11px; color: var(--muted); margin-top: 6px; }

  #lab-strip { left: calc(var(--left) + 312px); right: var(--right); bottom: var(--bottom); padding: 8px; display: flex; gap: 8px; align-items: stretch; z-index: 3; overflow-x: auto; }
  #lab-strip .thumb { flex: 1 1 0; min-width: 88px; max-width: 176px; border: 2px solid transparent; background: none; border-radius: 12px; padding: 3px; text-align: left; }
  #lab-strip .thumb:hover { background: rgba(0,0,0,0.05); }
  #lab-strip .thumb.on { border-color: var(--accent); }
  #lab-strip canvas { width: 100%; aspect-ratio: 3 / 2; display: block; border-radius: 8px; background: #cfe0b8; }
  #lab-strip .cap { font-size: 10.5px; color: var(--muted); line-height: 1.25; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #lab-strip .cap b { color: var(--ink); }
  #lab-strip .more { flex: 0 0 auto; align-self: center; font-size: 18px; }

  body.lab-hide #lab-panel, body.lab-hide #lab-view, body.lab-hide #lab-strip { display: none; }
  #lab-code { position: fixed; inset: 0; background: rgba(60, 80, 40, 0.3); display: grid; place-items: center; z-index: 10; }
  #lab-code .card { position: static; width: min(640px, calc(100% - 32px)); max-height: calc(100% - 64px); display: flex; flex-direction: column; padding: 16px 18px; }
  #lab-code h2 { margin: 0 0 4px; font-size: 17px; font-weight: 900; }
  #lab-code p { margin: 0 0 10px; color: var(--muted); font-size: 13px; }
  #lab-code pre { margin: 0; overflow: auto; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 12px; line-height: 1.45; }
  #lab-code mark { background: var(--accent-soft); color: #9a5024; border-radius: 3px; }
  #lab-code .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
  @media (max-width: 760px) {
    #lab-panel { bottom: auto; max-height: 55vh; width: calc(100% - var(--left) - var(--right)); }
    #lab-view, #lab-strip { display: none; }
  }
`;
document.head.append(style);

const panel = document.createElement('section');
panel.id = 'lab-panel'; panel.className = 'card';
panel.innerHTML = `
  <header>
    <h1>🗺️ Terrain lab <small><a href="./" style="color:inherit">back to the game</a></small></h1>
    <div class="lab-seed">
      <button class="lab-btn" data-seed="-1" title="Previous seed (←)">←</button>
      <input id="lab-seed" type="number" title="Seed: the same seed and settings always make the same meadow">
      <button class="lab-btn" data-seed="1" title="Next seed (→)">→</button>
      <button class="lab-btn" data-seed="random" title="A random seed (R)">🎲</button>
    </div>
    <div class="lab-info" id="lab-info"></div>
    <div class="lab-draw">
      <div class="pens">
        <button class="lab-btn" data-pen="look" title="Look around: drag to move the map (L)">🔍 Look</button>
        <button class="lab-btn" data-pen="water" title="Paint ponds and lakes (W)">💧 Water</button>
        <button class="lab-btn" data-pen="river" title="Draw a river (V)">〰️ River</button>
        <button class="lab-btn" data-pen="woods" title="Paint woods (F)">🌳 Woods</button>
        <button class="lab-btn" data-pen="erase" title="Rub out what you drew (E)">🧽</button>
      </div>
      <label id="lab-brush-row">Size <input id="lab-brush" type="range" min="1" max="15" step="0.5"><b id="lab-brush-v"></b></label>
      <label id="lab-depth-row">Depth <input id="lab-depth" type="range" min="0.05" max="1.5" step="0.05"><b id="lab-depth-v"></b></label>
      <div class="hint" id="lab-pen-hint"></div>
      <div class="pen-row">
        <button class="lab-btn" data-draw="empty" title="Leave out the meadow's own river, lake, ponds and woods: just its hills and grass"></button>
        <button class="lab-btn" data-draw="undo" title="Undo (⌘Z)">↶ Undo</button>
        <button class="lab-btn" data-draw="clear" title="Rub out everything you drew">Clear</button>
      </div>
    </div>
  </header>
  <div id="lab-groups"></div>
  <footer>
    <div id="lab-changes"></div>
    <div class="lab-actions">
      <button class="lab-btn main" data-do="code" title="The TERRAIN block from sim.js with your changes, to paste over it">📋 Copy as code</button>
      <button class="lab-btn" data-do="play" title="A normal game with animals, on this meadow">▶ Open in game</button>
      <button class="lab-btn" data-do="reset" title="Back to the numbers in sim.js">↺ Reset all</button>
    </div>
  </footer>`;
document.body.append(panel);

const VIEWS = [['meadow', '🌼 Meadow'], ['height', '⛰️ Height'], ['water', '💧 Water'], ['soil', '🌱 Soil'], ['near', '📏 To water']];
const viewCard = document.createElement('section');
viewCard.id = 'lab-view'; viewCard.className = 'card';
viewCard.innerHTML = `
  <div class="seg">${VIEWS.map(([k, l], i) => `<button class="lab-btn" data-view="${k}" title="${l.slice(2)} (${i + 1})">${l}</button>`).join('')}</div>
  <div class="seg">${S.SEASONS.map((s, i) => `<button class="lab-btn" data-season="${i}" title="${s.name}">${s.emoji}</button>`).join('')}</div>
  <div id="lab-legend"></div>
  <div id="lab-hover"></div>
  <div id="lab-keys">Hold <b>space</b> to peek at the meadow · <b>H</b> hides all this</div>`;
document.body.append(viewCard);

const strip = document.createElement('section');
strip.id = 'lab-strip'; strip.className = 'card';
document.body.append(strip);

const fmt = (v, step) => {
  const d = step < 1 ? String(step).split('.')[1].length : 0;
  return (+v).toFixed(d);
};

function buildGroups() {
  let open = ['Hills', 'Water'];
  try { open = JSON.parse(localStorage.getItem('aeon-garden-lab-open')) || open; } catch (e) { /* fine */ }
  $('#lab-groups').innerHTML = GROUPS.map(([emoji, name, rows]) => `
    <details data-group="${name}" ${open.includes(name) ? 'open' : ''}>
      <summary>${emoji} ${name} <span class="n" hidden></span></summary>
      ${rows.map(([k, label, ...spec]) => {
        const pair = Array.isArray(DEF[k]) && typeof DEF[k][0] === 'number';
        const inputs = Array.isArray(spec[0])
          ? `<div class="choices">${spec[0].map(([l], i) => `<button class="lab-btn" data-choice="${i}">${l}</button>`).join('')}</div>`
          : `<div class="ranges">${(pair ? [0, 1] : [null]).map(j =>
              `<input type="range" min="${spec[0]}" max="${spec[1]}" step="${spec[2]}" ${j !== null ? `data-end="${j}"` : ''}>`).join('')}</div>`;
        return `<div class="lab-row" data-k="${k}">
          <div class="top"><span class="l">${label}</span><span class="v"></span><button class="reset" title="Back to ${esc(show(DEF[k]))}">↺</button></div>
          ${inputs}</div>`;
      }).join('')}
    </details>`).join('');
  $('#lab-groups').addEventListener('toggle', () => {
    const now = [...document.querySelectorAll('#lab-groups details[open]')].map(d => d.dataset.group);
    try { localStorage.setItem('aeon-garden-lab-open', JSON.stringify(now)); } catch (e) { /* fine */ }
  }, true);
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function show(v) {                         // a value as it reads in the panel
  if (Array.isArray(v) && typeof v[0] === 'number') return v.join(' – ');
  const row = GROUPS.flatMap(g => g[2]).find(r => Array.isArray(r[2]) && r[2].some(([, o]) => same(o, v)));
  if (row) return row[2].find(([, o]) => same(o, v))[0];
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// Puts the settings into the controls and marks what's changed.
function syncControls() {
  for (const row of document.querySelectorAll('.lab-row')) {
    const k = row.dataset.k, spec = GROUPS.flatMap(g => g[2]).find(r => r[0] === k), v = t[k];
    row.classList.toggle('changed', !same(v, DEF[k]));
    if (Array.isArray(spec[2])) {
      row.querySelectorAll('[data-choice]').forEach(b => b.classList.toggle('on', same(spec[2][+b.dataset.choice][1], v)));
      row.querySelector('.v').textContent = '';
      continue;
    }
    const step = spec[4];
    row.querySelectorAll('input').forEach(inp => { inp.value = inp.dataset.end !== undefined ? v[+inp.dataset.end] : v; });
    row.querySelector('.v').textContent = Array.isArray(v) ? v.map(x => fmt(x, step)).join(' – ') : fmt(v, step);
    if (source?.hints[k]) row.title = source.hints[k];
  }
  for (const d of document.querySelectorAll('#lab-groups details')) {
    const n = d.querySelectorAll('.lab-row.changed').length, badge = d.querySelector('.n');
    badge.hidden = !n; badge.textContent = n;
  }
  const ch = changes();
  $('#lab-changes').innerHTML = ch.length
    ? ch.map(k => `<div><b>${k}</b> ${esc(show(DEF[k]))} → <b>${esc(show(t[k]))}</b></div>`).join('')
    : 'The numbers in sim.js, unchanged.';
  $('#lab-seed').value = seed;
  syncPens();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  document.querySelectorAll('[data-season]').forEach(b => b.classList.toggle('on', +b.dataset.season === season));
}

const PEN_HINTS = {
  look: 'Drag to move the map, scroll to zoom. Pick a pen to draw.',
  water: 'Drag to paint water. Small patches become ponds, big ones lakes.',
  river: 'Drag along where the river should run. Let go near the edge and it flows off the map.',
  woods: 'Drag to paint woods: pines up on the hills, broadleaf lower down.',
  erase: 'Drag over anything you drew to rub it out.',
};
function syncPens() {
  document.querySelectorAll('[data-pen]').forEach(b => b.classList.toggle('on', b.dataset.pen === pen));
  $('#lab-brush-row').hidden = !['water', 'woods', 'erase'].includes(pen);
  $('#lab-depth-row').hidden = pen !== 'water';
  $('#lab-brush').value = brush; $('#lab-brush-v').textContent = `${brush} tiles`;
  $('#lab-depth').value = depth; $('#lab-depth-v').textContent = depth < t.deepAt ? `${depth} · wading` : `${depth}`;
  $('#lab-pen-hint').textContent = PEN_HINTS[pen] + (pen === 'look' ? '' : ' Right-drag moves the map.');
  const e = $('[data-draw="empty"]');
  e.textContent = (drawn.empty ? '☑' : '☐') + ' Start empty';
  e.classList.toggle('on', drawn.empty);
  $('#world').style.cursor = pen === 'look' ? '' : pen === 'river' ? 'crosshair' : 'none';
}
$('#lab-brush').addEventListener('input', e => { brush = +e.target.value; syncPens(); });
$('#lab-depth').addEventListener('input', e => { depth = +e.target.value; syncPens(); });

$('#lab-groups').addEventListener('input', e => {
  const inp = e.target, row = inp.closest('.lab-row'), k = row.dataset.k;
  const step = +inp.step, v = +fmt(+inp.value, step);
  if (inp.dataset.end === undefined) t[k] = v;
  else {                                   // a pair: pushing one end past the other drags it along
    const j = +inp.dataset.end, pair = t[k].slice();
    pair[j] = v;
    if (pair[0] > pair[1]) pair[1 - j] = v;
    t[k] = pair;
  }
  changed();
});
$('#lab-groups').addEventListener('click', e => {
  const row = e.target.closest('.lab-row');
  if (!row) return;
  const k = row.dataset.k;
  if (e.target.closest('.reset')) { t[k] = clone(DEF[k]); changed(); }
  const b = e.target.closest('[data-choice]');
  if (b) { t[k] = clone(GROUPS.flatMap(g => g[2]).find(r => r[0] === k)[2][+b.dataset.choice][1]); changed(); }
});

// ------------------------------------------------------------------ making the meadow

let pending = false, thumbsTimer = 0;
function changed(stripToo = true) {
  syncControls();
  if (!pending) { pending = true; requestAnimationFrame(remake); }
  if (stripToo) { clearTimeout(thumbsTimer); thumbsTimer = setTimeout(drawStrip, 180); }
}

function remake() {
  pending = false;
  const t0 = performance.now();
  lab.meadow(seed, diff(), drawnOut());
  madeMs = performance.now() - t0;
  lab.season(season);
  near = S.distanceToWater(G.world);
  overlay = view === 'meadow' ? null : paintLayer(G.world, view, 4, near);
  info();
  const q = new URLSearchParams({ lab: '', seed });
  if (changes().length) q.set('terrain', JSON.stringify(diff()));
  if (hasDrawing()) q.set('drawn', JSON.stringify(drawn));
  if (view !== 'meadow') q.set('view', view);
  if (season) q.set('season', season);
  if (!stroke) history.replaceState(null, '', '?' + q.toString().replace('lab=', 'lab'));   // not mid-stroke: Safari allows only so many
  document.querySelectorAll('#lab-strip .thumb').forEach(b => b.classList.toggle('on', +b.dataset.pick === seed));
}

// Each river's name: the water it runs in, a little way along.
function riverName(w, rv) {
  for (let k = Math.floor(rv.pts.length * 0.2); k < rv.pts.length; k++) {
    const p = rv.pts[k], b = p.x >= 0 && p.y >= 0 && p.x < S.W && p.y < S.H ? w.body[(p.y | 0) * S.W + (p.x | 0)] : -1;
    if (b >= 0) return { name: w.waters[b].name, p };
  }
  return null;
}
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const lakesOf = w => w.waters.filter(v => v.kind === 'lake').length || (w.lake ? 1 : 0);
const woodsOf = w => [...w.forest.map(k => FOREST_NAMES[k] || k), ...(w.drawn.woods.length ? ['drawn'] : [])].join(' and ') || 'none';

function info() {
  const w = G.world, land = w.land / (S.W * S.H);
  const names = [...new Set([...w.rivers.map(rv => riverName(w, rv)?.name), w.lake?.name].filter(Boolean))];
  $('#lab-info').innerHTML = `
    <b>${Math.round(land * 100)}%</b> dry land · ${count(w.rivers.length, 'river', 'rivers')}, ${count(lakesOf(w), 'lake', 'lakes')},
    ${count(w.waters.filter(v => v.kind === 'pond').length, 'pond', 'ponds')}${names.length ? ` (${names.join(', ')})` : ''} · woods: ${woodsOf(w)}<br>
    A game here starts with <b>🐇 ${Math.round(30 * w.room)}</b> and <b>🦊 ${Math.round(4 * w.room)}</b>
    <span title="Population caps and starting numbers grow with dry land. A lot more or less than usual? Run balance.js">(room ${w.room.toFixed(2)})</span>
    · made in ${Math.round(madeMs)} ms`;
}

function setSeed(s) {
  seed = clamp(Math.round(s) || 1, 1, 2 ** 31);
  if (seed < base || seed > base + 7) { base = seed; drawStrip(); }
  changed(false);
}

// ------------------------------------------------------------------ the layers
//
// Each is painted `scale` pixels per tile. Height and distance are sampled between the tiles,
// so their contour lines run smooth when the view is zoomed in.

const RAMPS = {
  height: [[0, [92, 150, 84]], [0.25, [152, 188, 98]], [0.5, [214, 196, 128]], [0.75, [168, 126, 90]], [1, [246, 242, 236]]],
  depth: [[0, [168, 220, 240]], [0.3, [96, 166, 216]], [1, [28, 64, 138]]],
  soil: [[0, [214, 180, 124]], [0.45, [186, 196, 104]], [1, [38, 124, 54]]],
  near: [[0, [86, 176, 196]], [3, [132, 204, 150]], [9, [204, 212, 142]], [24, [232, 212, 168]]],
};
function ramp(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let k = 1; k < stops.length; k++) {
    const [b, cb] = stops[k], [a, ca] = stops[k - 1];
    if (v <= b) return ca.map((c, i) => lerp(c, cb[i], (v - a) / (b - a)));
  }
  return stops[stops.length - 1][1];
}
const hue = id => 165 + (id * 61.8) % 110;   // each its own, but all of them watery
function hsl(h, s, l) {                    // 0..360, 0..1, 0..1 to rgb
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

function paintLayer(w, kind, scale, dist) {
  const cw = S.W * scale, chh = S.H * scale, c = document.createElement('canvas');
  c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  if (kind === 'meadow') { paintMeadow(w, g, scale); return c; }
  const img = g.createImageData(cw, chh), d = img.data, T = w.terrain, ground = w.ground;
  const fert = kind === 'soil' ? landOnly(w, w.fert) : null;
  const at = (arr, fx, fy) => {           // between tile centres
    const x = clamp(fx - 0.5, 0, S.W - 1.001), y = clamp(fy - 0.5, 0, S.H - 1.001);
    const x0 = x | 0, y0 = y | 0, u = x - x0, v = y - y0, i = y0 * S.W + x0;
    return lerp(lerp(arr[i], arr[i + 1], u), lerp(arr[i + S.W], arr[i + S.W + 1], u), v);
  };
  const field = new Float32Array(cw * chh), band = new Int32Array(cw * chh), wet = new Uint8Array(cw * chh);
  for (let py = 0; py < chh; py++) for (let px = 0; px < cw; px++) {
    const fx = (px + 0.5) / scale, fy = (py + 0.5) / scale, j = py * cw + px;
    const h = at(ground, fx, fy), depth = w.level - h;
    wet[j] = depth > 0;
    if (kind === 'height') { field[j] = wet[j] ? depth : h - w.level; band[j] = wet[j] ? -1 - Math.floor(depth / T.deepAt) : Math.floor(field[j] / 0.05); }
    else if (kind === 'near') { field[j] = at(dist, fx, fy); band[j] = wet[j] ? -1 : Math.floor(field[j] / 3); }
    else if (kind === 'soil') { field[j] = at(fert, fx, fy); band[j] = 0; }
    else { field[j] = depth; band[j] = 0; }
  }
  for (let py = 0; py < chh; py++) for (let px = 0; px < cw; px++) {
    const j = py * cw + px, f = field[j];
    let rgb;
    if (kind === 'height') rgb = wet[j] ? ramp(RAMPS.depth, f) : ramp(RAMPS.height, f);
    else if (kind === 'near') rgb = wet[j] ? [60, 120, 190] : ramp(RAMPS.near, f);
    else if (kind === 'soil') rgb = wet[j] ? [110, 140, 170] : ramp(RAMPS.soil, (f - 0.12) / 0.88);
    else {                                  // water: each body its own colour, darker where it's too deep to wade
      const tx = clamp(Math.floor((px + 0.5) / scale), 0, S.W - 1), ty = clamp(Math.floor((py + 0.5) / scale), 0, S.H - 1);
      let body = w.body[ty * S.W + tx];
      for (let k = 0; body < 0 && k < 9; k++) {
        const nx = tx + (k % 3) - 1, ny = ty + ((k / 3) | 0) - 1;
        if (nx >= 0 && ny >= 0 && nx < S.W && ny < S.H) body = w.body[ny * S.W + nx];
      }
      if (!wet[j] || body < 0) { const h = -f; rgb = [226, 221, 206].map(v => v - 60 * clamp(h, 0, 1)); }
      else rgb = hsl(hue(body), 0.62, f >= T.deepAt ? 0.42 : 0.68);
    }
    // A contour line wherever the band changes toward the right or below. Too busy in a thumbnail.
    const edge = scale > 2 && ((px + 1 < cw && band[j + 1] !== band[j]) || (py + 1 < chh && band[j + cw] !== band[j]));
    const k = edge ? 0.72 : 1, o = j * 4;
    d[o] = rgb[0] * k; d[o + 1] = rgb[1] * k; d[o + 2] = rgb[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Water tiles take their neighbours' values, so blending across the shore doesn't dip toward 0.
function landOnly(w, src) {
  const out = Float32Array.from(src);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      if (!w.water[i]) continue;
      const x = i % S.W, y = (i / S.W) | 0;
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * S.W + nx;
        if (nx >= 0 && ny >= 0 && nx < S.W && ny < S.H && out[k] > 0) { sum += out[k]; n++; }
      }
      if (n) out[i] = sum / n;
    }
  }
  return out;
}

// The meadow roughly as the game paints it, small enough for a thumbnail.
function paintMeadow(w, g, scale) {
  const img = g.createImageData(S.W, S.H), d = img.data;
  const [bare, lush] = S.GROUND.seasons[season], snow = season === 3 ? 0.6 : 0;
  for (let i = 0; i < S.W * S.H; i++) {
    let rgb;
    if (w.water[i]) rgb = (w.water[i] === S.DEEP ? [72, 142, 202] : [130, 200, 235]).map((v, k) => lerp(v, [214, 232, 242][k], snow * 0.8));
    else {
      let v = clamp(w.grass[i] / 0.85, 0, 1);
      v = v * (2 - v);
      rgb = bare.map((b, k) => lerp(lerp(b, lush[k], v), S.GROUND.snow[k], snow) * (1 - 0.3 * w.wood[i]));
    }
    d.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  const small = document.createElement('canvas');
  small.width = S.W; small.height = S.H;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(small, 0, 0, S.W * scale, S.H * scale);
  const leaf = [['#5a9a4a', '#4f8f4c'], ['#3f8a3c', '#2f6e3e'], ['#c8843a', '#3f7048'], ['#8a7a66', '#355e44']][season];
  for (const t of w.decor) {
    if (!t.tree && t.emoji !== '🪨') continue;
    g.fillStyle = t.tree ? leaf[t.emoji === '🌲' ? 1 : 0] : '#9a968c';
    g.beginPath();
    g.arc(t.x * scale, t.y * scale, (t.tree ? t.size * 0.3 : 0.4) * scale, 0, Math.PI * 2);
    g.fill();
  }
}

const LEGENDS = {
  meadow: () => 'The meadow as the game draws it.',
  height: () => legend(RAMPS.height.map(s => s[1]), 'water line', 'high', 'Lines every 0.05 of height. Under water: bands every wading depth, so the first line is where wading stops.'),
  water: () => `Each body of water has its own colour, darker where it's too deep to wade. The river's line and its <b>fords</b> are drawn on top, and the circles that make the lake.`,
  soil: () => legend(RAMPS.soil.map(s => s[1]), 'poor', 'rich', 'How much grass the ground can grow. Every meadow is scaled to the same average.'),
  near: () => legend(RAMPS.near.map(s => s[1]), 'at the water', '24+ tiles', 'Lines every 3 tiles. Banks are richer, and the wet wood grows here.'),
};
function legend(cols, a, b, note) {
  return `<div class="bar" style="background:linear-gradient(90deg,${cols.map(c => `rgb(${c.map(Math.round)})`).join(',')})"></div>
    <div class="ends"><span>${a}</span><span>${b}</span></div><div style="margin-top:4px">${note}</div>`;
}

// Drawn over the meadow every frame: the layer, if one is showing, and the pen.
lab.draw = g => {
  const k = g.canvas.width / g.canvas.clientWidth, z = G.cam.zoom, [ox, oy] = lab.toScreen(0, 0);
  g.save();
  g.setTransform(k, 0, 0, k, 0, 0);
  if (overlay && !peek) {
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.94;
    g.drawImage(overlay, ox, oy, S.W * z, S.H * z);
    g.globalAlpha = 1;
    if (view === 'water') drawWaterMarks(g, z);
  }
  drawPen(g, z);
  g.restore();
};

// The river being drawn, and the brush under the mouse.
function drawPen(g, z) {
  g.lineCap = g.lineJoin = 'round';
  if (stroke && pen === 'river') {
    const pts = [...stroke.pts, stroke.tip].filter(Boolean).map(([x, y]) => lab.toScreen(x, y));
    for (const [c, wd] of [['rgba(255,255,255,0.9)', 7], ['#4a93d0', 4]]) {
      g.strokeStyle = c; g.lineWidth = wd;
      g.beginPath(); for (const p of pts) g.lineTo(...p); g.stroke();
    }
  }
  if (!cursor || pen === 'look' || pen === 'river') return;
  const [x, y] = lab.toScreen(...cursor), col = { water: '#2f7fc0', woods: '#2f7a3a', erase: '#d0503a' }[pen];
  g.lineWidth = 2; g.setLineDash([5, 4]);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, brush * z, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = col; g.lineDashOffset = 4.5; g.beginPath(); g.arc(x, y, brush * z, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
}

function drawWaterMarks(g, z) {
  const w = G.world, P = (x, y) => lab.toScreen(x, y);
  g.lineCap = 'round';
  if (w.lake?.shape) {
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.2; g.setLineDash([4, 4]);
    for (const c of w.lake.shape) { const [x, y] = P(c.x, c.y); g.beginPath(); g.arc(x, y, c.r * z, 0, Math.PI * 2); g.stroke(); }
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.setLineDash([6, 5]);
  for (const rv of w.rivers) {
    g.beginPath();
    for (const p of rv.pts) g.lineTo(...P(p.x, p.y));
    g.stroke();
  }
  g.setLineDash([]);
  g.font = '800 12px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = (text, x, y, bg) => {
    const wd = g.measureText(text).width + 10;
    g.fillStyle = bg; g.beginPath(); g.roundRect(x - wd / 2, y - 9, wd, 18, 9); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, x, y + 0.5);
  };
  for (const f of w.fords) { const [x, y] = P(f.x, f.y); label('ford', x, y, 'rgba(214,120,50,0.92)'); }
  for (const v of w.waters) {
    if (v === w.lake || v.kind === 'river') continue;
    const [x, y] = P(v.x, v.y);
    label(v.name, x, y, 'rgba(40,60,90,0.72)');
  }
  if (w.lake) { const [x, y] = P(w.lake.x, w.lake.y); label(w.lake.name, x, y, 'rgba(40,60,90,0.72)'); }
  const named = new Set();
  for (const rv of w.rivers) {
    const at = riverName(w, rv);
    if (!at || named.has(at.name)) continue;
    named.add(at.name);
    const [x, y] = P(at.p.x, at.p.y);
    label(at.name, x, y - 16, 'rgba(40,60,90,0.72)');
  }
}

function setView(v) {
  view = v;
  $('#lab-legend').innerHTML = LEGENDS[view]();
  changed();
}

// What's under the mouse.
const HOVER_HINT = '<span style="color:var(--muted)">Point at the meadow to read a tile.</span>';
$('#world').addEventListener('mousemove', e => {
  const [x, y] = lab.toWorld(e.clientX, e.clientY), w = G.world;
  if (x < 0 || y < 0 || x >= S.W || y >= S.H) { $('#lab-hover').innerHTML = HOVER_HINT; return; }
  const i = (y | 0) * S.W + (x | 0), h = w.ground[i], body = w.body[i] >= 0 ? w.waters[w.body[i]] : null;
  const where = `<b>${x | 0}, ${y | 0}</b>`;
  $('#lab-hover').innerHTML = w.water[i]
    ? `${where} · ${esc(body?.name ?? 'water')} (${body?.kind}, ${body?.size} tiles)<br>${(w.level - h).toFixed(2)} deep · ${w.water[i] === S.DEEP ? 'too deep to wade' : 'can be waded'}`
    : `${where} · height <b>${(h - w.level).toFixed(2)}</b> above the water<br>soil <b>${w.fert[i].toFixed(2)}</b> · ${near ? near[i].toFixed(1) : '?'} tiles to water${w.wood[i] > 0.05 ? ` · shade ${w.wood[i].toFixed(2)}` : ''}`;
});

// ------------------------------------------------------------------ drawing
//
// These listen before the game does: with a pen, a left-drag draws instead of moving the map,
// and a right-drag moves the map whatever the pen.

const canvas = $('#world');
addEventListener('pointerdown', e => {
  if (e.target !== canvas) return;
  if (e.button === 2) { e.stopPropagation(); panning = { x: e.clientX, y: e.clientY, cx: G.cam.x, cy: G.cam.y }; return; }
  if (pen === 'look' || e.button !== 0) return;
  e.stopPropagation();
  canvas.setPointerCapture(e.pointerId);
  undo.push(JSON.stringify(drawn));
  if (undo.length > 200) undo.shift();
  stroke = { pts: [], last: null, tip: null };
  strokeTo(...lab.toWorld(e.clientX, e.clientY));
}, true);
addEventListener('pointermove', e => {
  cursor = e.target === canvas || stroke ? lab.toWorld(e.clientX, e.clientY) : null;
  if (panning) {
    e.stopPropagation();
    G.cam.x = panning.cx - (e.clientX - panning.x) / G.cam.zoom; G.cam.y = panning.cy - (e.clientY - panning.y) / G.cam.zoom;
    return;
  }
  if (!stroke) return;
  e.stopPropagation();
  strokeTo(...cursor);
}, true);
for (const type of ['pointerup', 'pointercancel']) {
  addEventListener(type, e => {
    if (panning) { e.stopPropagation(); panning = null; return; }
    if (!stroke) return;
    e.stopPropagation();
    endStroke();
  }, true);
}

// A brush leaves a circle every so often along the way; a river keeps a bend every 3 tiles.
function strokeTo(x, y) {
  const s = stroke;
  if (pen === 'river') {
    if (!s.last || Math.hypot(x - s.last.x, y - s.last.y) >= 3) { s.pts.push([r1(x), r1(y)]); s.last = { x, y }; }
    s.tip = [x, y];
    return;
  }
  const step = Math.max(0.5, brush * 0.4), from = s.last, d = from ? Math.hypot(x - from.x, y - from.y) : 0;
  if (from && d < step) return;
  const n = from ? Math.floor(d / step) : 1;
  let hit = false;
  for (let k = 1; k <= n; k++) {
    const px = from ? lerp(from.x, x, k * step / d) : x, py = from ? lerp(from.y, y, k * step / d) : y;
    hit = stamp(px, py) || hit;
    s.last = { x: px, y: py };
  }
  if (hit) changed(false);                 // remade as you paint; the strip waits for you to let go
}

function stamp(x, y) {
  if (pen === 'water') drawn.water.push([r1(x), r1(y), brush, depth]);
  else if (pen === 'woods') drawn.woods.push([r1(x), r1(y), brush]);
  else {
    const before = drawn.water.length + drawn.woods.length + drawn.rivers.length;
    const keep = ([cx, cy, cr]) => Math.hypot(cx - x, cy - y) > brush + cr * 0.5;
    drawn.water = drawn.water.filter(keep);
    drawn.woods = drawn.woods.filter(keep);
    drawn.rivers = drawn.rivers.filter(pts => pts.every(([px, py]) => Math.hypot(px - x, py - y) > brush + 2));
    return drawn.water.length + drawn.woods.length + drawn.rivers.length !== before;
  }
  return true;
}

function endStroke() {
  const s = stroke;
  stroke = null;
  if (pen === 'river') {
    const [tx, ty] = s.tip, last = s.pts[s.pts.length - 1];
    if (Math.hypot(tx - last[0], ty - last[1]) >= 1) s.pts.push([r1(tx), r1(ty)]);
    if (s.pts.length > 1) drawn.rivers.push(s.pts);
  }
  if (undo[undo.length - 1] === JSON.stringify(drawn)) undo.pop();   // nothing happened
  changed();
}

function setDrawn(d) { drawn = d; changed(); }

// ------------------------------------------------------------------ the strip: same settings, other seeds

async function drawStrip() {
  const seeds = Array.from({ length: 8 }, (_, k) => base + k);
  strip.innerHTML = seeds.map(s => `<button class="thumb${s === seed ? ' on' : ''}" data-pick="${s}"><canvas width="${S.W * 2}" height="${S.H * 2}"></canvas><div class="cap"><b>${s}</b></div></button>`).join('')
    + `<button class="lab-btn more" data-seed="batch" title="Eight other seeds">🎲</button>`;
  const job = drawStrip.job = {};
  for (const s of seeds) {
    await new Promise(r => setTimeout(r, 0));   // one at a time, so dragging stays smooth
    if (drawStrip.job !== job) return;
    const w = S.createWorld(s, { terrain: diff(), drawn: drawnOut(), rabbits: 0, foxes: 0, bees: 0 });
    const c = paintLayer(w, view === 'meadow' ? 'meadow' : view, 2, view === 'near' ? S.distanceToWater(w) : null);
    const b = strip.querySelector(`[data-pick="${s}"]`);
    b.querySelector('canvas').getContext('2d').drawImage(c, 0, 0);
    const layout = [w.rivers.length && 'river', lakesOf(w) && 'lake'].filter(Boolean).join(' + ') || 'ponds';
    b.querySelector('.cap').innerHTML = `<b>${s}</b> · ${Math.round(w.land / (S.W * S.H) * 100)}% dry · ${layout}`;
    b.title = `Seed ${s}: ${layout}, woods: ${woodsOf(w)}`;
  }
}

// ------------------------------------------------------------------ copy as code
//
// sim.js's own TERRAIN block, with each changed line's value swapped and its comment kept.

async function loadSource() {
  try {
    const text = await (await fetch('sim.js', { cache: 'no-store' })).text();
    const block = text.match(/const TERRAIN = \{[\s\S]*?\n\};/)[0];
    const hints = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*(\w+):.*?\/\/\s*(.*)$/);
      if (m) hints[m[1]] = m[2];
    }
    source = { block, hints };
    syncControls();
  } catch (e) { source = null; }
}

function js(v) {
  if (Array.isArray(v)) return '[' + v.map(js).join(', ') + ']';
  if (v && typeof v === 'object') return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${js(x)}`).join(', ') + ' }';
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
}

function code() {
  const ch = changes(), marks = new Set();
  if (!source) {                            // no sim.js to read (opened from a file?): the plain values
    const lines = Object.keys(DEF).map(k => { if (ch.includes(k)) marks.add(k); return `  ${k}: ${js(t[k])},`; });
    return { text: `const TERRAIN = {\n${lines.join('\n')}\n};`, marks };
  }
  const lines = source.block.split('\n').map(line => {
    const m = line.match(/^(\s*)(\w+):\s*(.+?),(\s*)(\/\/.*)?$/);
    if (!m || !ch.includes(m[2])) return line;
    marks.add(m[2]);
    const head = `${m[1]}${m[2]}: ${js(t[m[2]])},`;
    if (!m[5]) return head;
    const col = line.indexOf(m[5]);
    return head + ' '.repeat(Math.max(1, col - head.length)) + m[5];
  });
  return { text: lines.join('\n'), marks };
}

function showCode() {
  const { text, marks } = code(), n = marks.size;
  const html = text.split('\n').map(line => {
    const k = (line.match(/^\s*(\w+):/) || [])[1];
    return marks.has(k) ? `<mark>${esc(line)}</mark>` : esc(line);
  }).join('\n');
  const box = document.createElement('div');
  box.id = 'lab-code';
  box.innerHTML = `<div class="card">
    <h2>📋 TERRAIN, ${n ? `with ${n} ${n === 1 ? 'change' : 'changes'}` : 'unchanged'}</h2>
    <p>Paste it over <code>const TERRAIN = {…};</code> in <code>sim.js</code>, or hand it to Claude. <span id="lab-copied"></span></p>
    <pre>${html}</pre>
    <div class="row"><button class="lab-btn" data-do="copy">Copy again</button><button class="lab-btn main" data-do="close" style="background:var(--accent);color:#fff;border-color:var(--accent)">Done</button></div>
  </div>`;
  document.body.append(box);
  const copy = () => navigator.clipboard?.writeText(text).then(
    () => { $('#lab-copied').textContent = '✓ Copied to the clipboard.'; },
    () => { $('#lab-copied').textContent = 'Couldn\'t copy: select it below.'; });
  copy();
  box.addEventListener('click', e => {
    if (e.target === box || e.target.closest('[data-do="close"]')) box.remove();
    if (e.target.closest('[data-do="copy"]')) copy();
  });
}

// ------------------------------------------------------------------ buttons and keys

document.addEventListener('click', e => {
  const b = e.target.closest('[data-seed],[data-view],[data-season],[data-do],[data-pick],[data-pen],[data-draw]');
  if (!b || b.closest('#lab-code')) return;
  if (b.dataset.pen) { pen = b.dataset.pen; syncPens(); return; }
  if (b.dataset.draw === 'undo') { if (undo.length) setDrawn(JSON.parse(undo.pop())); return; }
  if (b.dataset.draw) {
    undo.push(JSON.stringify(drawn));
    setDrawn(b.dataset.draw === 'empty' ? { ...drawn, empty: !drawn.empty } : { empty: drawn.empty, water: [], rivers: [], woods: [] });
    return;
  }
  if (b.dataset.seed === 'random') setSeed(Math.floor(Math.random() * 1e6));
  else if (b.dataset.seed === 'batch') { base = Math.floor(Math.random() * 1e6); drawStrip(); }
  else if (b.dataset.seed) setSeed(seed + +b.dataset.seed);
  else if (b.dataset.pick) setSeed(+b.dataset.pick);
  else if (b.dataset.view) setView(b.dataset.view);
  else if (b.dataset.season) { season = +b.dataset.season; changed(view === 'meadow'); }
  else if (b.dataset.do === 'code') showCode();
  else if (b.dataset.do === 'reset') { Object.assign(t, clone(DEF)); changed(); }
  else if (b.dataset.do === 'play') {
    const q = (changes().length ? '&terrain=' + encodeURIComponent(JSON.stringify(diff())) : '')
      + (hasDrawing() ? '&drawn=' + encodeURIComponent(JSON.stringify(drawn)) : '');
    open(`./?seed=${seed}${q}`, '_blank');
  }
});
$('#lab-seed').addEventListener('change', e => setSeed(+e.target.value));

const PEN_KEYS = { l: 'look', w: 'water', v: 'river', f: 'woods', e: 'erase' };
addEventListener('keydown', e => {
  if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.target.closest('input[type=number],textarea')) {
    e.preventDefault();
    if (undo.length) setDrawn(JSON.parse(undo.pop()));
    return;
  }
  if (e.target.closest('input[type=number],textarea') || e.metaKey || e.ctrlKey) return;
  if (e.target.matches('input[type=range]') && e.key.startsWith('Arrow')) return;   // those move the slider
  if (e.key === 'Escape') { if ($('#lab-code')) $('#lab-code').remove(); else { pen = 'look'; syncPens(); } }
  else if (PEN_KEYS[e.key]) { pen = PEN_KEYS[e.key]; syncPens(); }
  else if (e.key === '[' || e.key === ']') { brush = clamp(brush + (e.key === ']' ? 1 : -1), 1, 15); syncPens(); }
  else if (e.key === ' ') { e.preventDefault(); peek = true; }
  else if (e.key === 'ArrowLeft') setSeed(seed - 1);
  else if (e.key === 'ArrowRight') setSeed(seed + 1);
  else if (e.key === 'r') setSeed(Math.floor(Math.random() * 1e6));
  else if (e.key === 'h') document.body.classList.toggle('lab-hide');
  else if (/^[1-5]$/.test(e.key)) setView(VIEWS[+e.key - 1][0]);
});
addEventListener('keyup', e => { if (e.key === ' ') peek = false; });
addEventListener('blur', () => { peek = false; });

// ------------------------------------------------------------------ start

buildGroups();
$('#lab-hover').innerHTML = HOVER_HINT;
setView(VIEWS.some(v => v[0] === view) ? view : 'meadow');
drawStrip();
loadSource();
})();
