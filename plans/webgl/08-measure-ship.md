# Stage 8: measure, decide, ship (Opus; the docs part to Sonnet)

## 1. Energy, the real meadow, both backends
The same protocol as the gate (stage 2's section 3), but now on the whole meadow with paths. Scenes on the phone, 60 s
each, alternating backends, 3 runs each:
- **walk:** default zoom, midday, walking (`?walk`).
- **idle:** standing at 1x. This is calm mode, 30 fps.
- **far:** zoomed right out, walking.
- **night-storm:** night by a lit fire in a storm, at 60x: the `?bench` worst case.

Record Power Profiler traces as in stage 2. Also record the Mac's `energy.mjs` table for Chrome and Safari. Put it all
in `plans/webgl/RESULTS.md`: medians, % saved, and render JS ms.

## 2. Memory and uploads
- On the phone, in Safari's Web Inspector (Develop menu, over the cable) → Timelines → Memory: the page's memory after
  5 minutes of play in a wood at 3x, both backends.
- From `?perf`: atlas pages and MB at the busiest moment, uploads per second at 1x and at 60x, and the uploads in the 10
  frames after a zoom settles.
- **If uploads after a zoom make a visible hitch on the phone**, cap them per frame:
  - set `UPLOAD_PX` in gl2d-atlas.js, ~2 Mpx a frame;
  - past the cap, draw the image's older stand-in if the sprite cache gave one, or skip it this frame. The sprite cache
    already has stand-ins, so prefer letting it show the stretched old one.
  - Measure before and after.
- If the page's memory grew by more than 150 MB with gl, lower `ATLAS_PAGES` and see what thrash costs (uploads per
  second).

## 3. Decide the default
- If gl saves energy on the phone and nothing looks worse:
  - `useGl(GL_ASK !== '0' && !!window.Gl2d)`, so gl is on by default and `?gl=0` turns it off;
  - and keep the 2D fallback after a context loss.
- If it saves only on some scenes, say so in RESULTS.md and ask Axel. Don't decide it alone.

## 4. Docs (Sonnet, from the RESULTS)
- **CLAUDE.md:** in the `ground.js` paragraph and "Keep it smooth", say what's true now:
  - The meadow is drawn by `gl2d.js` (WebGL2, batched, an atlas) through the Canvas 2D API subset. `?gl=0` is the old
    2D canvas.
  - The rules about `drawImage` counts and Safari's per-canvas copies apply to the 2D fallback only.
  - Still true for both:
    - paint once, copy after;
    - sprite keys take few values;
    - no per-frame allocation.
  - New: a canvas repainted in place needs `ctx.touched?.(c)`, and a freed one goes through `freeImage`.
  - New: what gl2d can't draw: clips other than axis-aligned rects, `shadowBlur`, gradients and patterns as fills,
    per-frame text. Paint those into a picture once.
- **`.claude/docs/files.md`:** a short section on gl2d (the files, the stats in `?perf`, `touched`/`forget`, the scenes
  and pixdiff tools).
- The memory file of the session that runs this (not the repo): what was learnt about measuring power on the iPhone.

## Acceptance
- RESULTS.md with real numbers from the phone.
- The default decided, with Axel if it's not clear-cut.
- Docs updated.
- The `webgl` branch reviewed by the overseer and merged into `main`, then deployed (`main` is the live site), only
  after Axel says so.
