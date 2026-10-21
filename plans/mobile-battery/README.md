# Phone battery — where the rest of it goes

An exploration, not an implementation. `plans/mobile-heat/` already took the obvious wins (30 fps calm,
12 fps resting, a 60 fps cap on touch, `lowFx` governor rungs, battery saver, the wake lock shortened under
saver, audio suspended in a hidden tab). This looks at what is left, after the DPR cap and the 1.5× governor
rungs were taken back out on Axel's iPhone (`plans/mobile-heat/README.md`, last section — **do not retry
those**).

The short version: **the frame loop is no longer the main drain.** Screen-on time, the radio, and audio that
keeps running while the meadow is visible are now bigger. The remaining per-frame work is a handful of
full-screen passes that repaint when nothing has changed.

## The budget it is competing with

On a phone with the screen on, the display is 44–73% of total power (OLED profiler, DAC 2021) and ~62% of
foreground-app energy on average (Purdue 2015). A 60→30 fps cap measures ~33% of *system* power in native
3D games, nearer 16% in the least GPU-bound title tested (HotPower, 2015). So frames matter, but less than
people assume — and a light 2D canvas game sits at the bottom of that range.

Two platform facts worth keeping straight:

- **iOS Safari caps rAF at 60 Hz**, ProMotion or not (WebKit's animation-frame-rate explainer); PWAs and
  WKWebView are hard-capped. So 120 Hz only exists on Android, where `ThrottleMainFrameTo60Hz` is still
  disabled by default in Chromium 140. The 60 fps cap already in `renderGap` matters on Android only.
- **There is no Battery Status API on iOS** (or Firefox). `navigator.getBattery` is Chromium-only, which is
  what `game.js` already guards for. A quality decision on iPhone has to come from a player toggle.

## Ranked levers

Ordered by battery returned per unit of risk. "Free" means no change to how the game looks or plays.

### 1. Stop the background properly — free

| Where | What happens now | Change |
|---|---|---|
| `game.js:19465`, `17081` | `netFrame` streams a forager's position every `POS_MS = 150` ms — ~400 msgs/min each way. The host forwards every guest's to every other guest (`net.js:86`). It sends **while paused**, **while alone** (a host with no guests still builds the message), and **to a hidden tab**. | Don't send `pos` to or from a peer that has been quiet > 3 s (`p.seen` already exists); send a 1 Hz clock while `ui.speed === 0`; skip the message when `Net.host && !Net.peers`. |
| `net.js:202` | The PeerJS broker socket heartbeats every 5 s (`pingInterval` default) — 12 radio wakeups/min for as long as a `?room=` page is open. | Raise `pingInterval` to 20–25 s and `peer.disconnect()` on hidden. |
| `friends.js:135` | The Supabase Realtime channel is subscribed forever. It stops the beat timer when hidden but never unsubscribes, so its 30 s heartbeat and reconnect churn continue. | `removeChannel` on hidden, `listen()` again on visible. |
| `friends.js:24` | A `here` POST every 60 s from page load, solo, no friends, menu open. | 3–5 min when no friend is online; debounce the extra beats from wardrobe/room changes. |
| `sw.js:47`, `97` | Every navigation rebuilds the whole shell cache: 27 requests, ~2.8 MiB written, previous cache deleted. | Fill at most once per 30–60 min, or on a version probe; never in both `install` and the first navigation. |
| `game.js:18986` | `packWorld` (~1.6 MiB) to IndexedDB every 30 s → ~195 MiB/hour of flash writes plus an ~8 ms main-thread pack. | 2–5 min while visible, always on hide/pagehide; don't run `keepSkills`/`keepAwayBag` on the tick. |
| `game.js:19408` | No `document.hidden` early-out; the loop relies on the browser stopping rAF. An open WebSocket can exempt a hidden tab from timer throttling. | One-line guard at the top of `frame`. |

Cellular tail energy makes this the biggest *unseen* cost: LTE's RRC inactivity timer measured 11.6 s on a
large US carrier, so anything faster than ~every 15 s keeps the radio in its high-power state
(Periodic Transfers, WWW'12). A 150 ms position stream holds it there permanently.

### 2. The wake lock — biggest single item, small UX decision

`game.js:19270`: `WAKE_MS = 10 * 60 * 1000`. Any touch buys **ten minutes of screen-on**, including while
reading the recipe book, the friends card or the cooking window — and the screen is the dominant drain.

Proposal, in the code's own spirit ("a meadow is for watching"):

- Keep ~10 min while the player is actually playing (input in the last 60–120 s).
- Drop to ~60–120 s once the meadow has been untouched, and re-take on any input.
- Release when `!document.hasFocus()` for ~30 s; release while a full-screen card is open unless there was
  input in the last minute.
- Under Battery saver, 3 min → 60 s (`WAKE_SAVER_MS`).

This is the one lever where the honest answer is "it changes the product". Ten minutes of screen-on costs
more than every frame saving in this document combined; the question is whether watching hands-off is the
point. If it is, make it a setting ("keep the screen on while I watch") rather than the default.

### 3. Let calm engage in the states it currently refuses — free-ish

`game.js:19293`: `calm()` requires no cooking window, no storm, and 2 s since input. But the **opening storm
is the default new-player state** (`sim.js` `GALE_LOOK` until the first fire), and it is also the heaviest
look (300 rain drops, cloud shadows, lightning, strongest tree sway). So the first minutes render at full
rate, every player, every visit. The cooking window likewise forces full rate while the pot is the only
thing moving.

- A 20–30 fps storm gap, or allow calm in the storm after N seconds hands-off.
- Calm (30 fps, or 20) while the cooking window is open; `drawCookView` is already inside the gated block.
- A long-idle rung: after 5–10 min untouched, 12 fps + release the wake lock, with a "tap to wake" hint.
  Nothing like this exists today; `resting` needs `ui.speed === 0`.

### 4. Per-frame full-screen passes that add nothing — free, no sharpness change

All from `game.js` unless said.

| Pass | Cost | Why it repeats |
|---|---|---|
| `paintTerrain` + two `texSubImage2D` (`448–473`, `19484`) | 1.3–2.0 Mpx ground re-render, 2 uploads, up to 4×/s | `TERRAIN_MS = 250`, even with a motionless camera and no tile changed |
| `skyLayer` repaint (`14427–14473`) | ¼-res picture with 9 cloud + 6 fog gradients and up to 24 light cuts | Key includes exact `cam.x/y/zoom`; repaints every frame while walking at night or in rain |
| Golden-hour fill (`1436–1440`) | full-screen `source-atop` fill every drawn frame | `shownGold` is quantised but the pass ignores it |
| `fireLight` (`4674–4685`) | one 256² `source-atop` quad per light, every frame | Runs even in daylight at ~0.06 alpha; draw skipped only when alpha is 0 |
| Lightning (`14631–14647`) | second full-screen fill + `shadowBlur = 14` on the bolt, every frame of a bolt | Could be painted once per strike |
| Weather thresholds (`14397–14408`) | a 0.001–0.01 alpha flips the sky from one cheap `fillRect` to the picture path | Thresholds too low to see |

Concrete, in order: checksum the grass before `Ground.set` and halve `TERRAIN_MS`; give the sky picture the
ground's treatment (repaint on movement in steps, or at most every `SKY_MS`); paint the golden fill once per
step; skip `fireLight` under ~1/255 and drop `lightArt` 256→128; bake the lightning bolt; raise the weather
thresholds.

**Done 2026-10-20**, five of the six, the picture unchanged (seeded CDP scenes, night + fire, golden hour, fog and storm
day: every one within 5/255 a pixel of before; a bolt differs only in its antialiased edge). In: the grass and bloom are
checksummed, so the two uploads and the ground's repaint happen only on a change, and `TERRAIN_MS` is 500; the sky's
picture follows the camera at `SKY_MS` (its lights and lifts keyed where the camera puts them, so a pan alone doesn't
paint); `fireLight` skips quads under 1/255; a bolt and its glow are painted once a strike and copied. Out: the golden
fill (the meadow canvas is cleared and everything drawn again each frame, so its `source-atop` tint can't be skipped on an
unchanged step without dropping it from those frames) and `lightArt` at 256 (shared with a torch's reach and the camp's
burst, drawn large; the cuts stay 64). Measured on scratch copies with the same 30 s `?bench` (emulated 390×844, DPR 3,
seed 123): render avg 1.1 ms both, p50 1.2 → 1.1, p95 1.4 → 1.5, 60 beats/s, rung 0 — the bench runs at 60x with the
camera racing and at 60x the sky keeps up frame by frame, so it can't show this. Counted directly instead: at 1x, still,
5.0 → 1.0 ground uploads and 2.5 → 0.5 ground shader repaints a second; at 8x, 9.0 → 5.5 and 4.7 → 3.2; sky picture paints
walking at 1x 59.6 → 22.3 a second, 8x 35.0 → 22.5 (still 20 both: the drifting clock's cadence). Real phone not measured.

### 5. Audio, while visible — only for players with sound on

Sound is off by default and no `AudioContext` is made until a gesture, so most players pay nothing. When it
is on:

- `setInterval(tickAmbience, 200)` (`sound.js:80`) is never cleared; it early-returns while suspended but is
  still 5 wakeups/s. Clear it in `suspend()`, restart in `wakeUp()`.
- Wind is the only layer with no `gateOf` (`sound.js:1116`): its buffer source runs forever, and ~21
  `AudioParam` writes happen 5×/s (~105/s) whether or not anything changed.
- Pausing does nothing to audio: `speed` is passed to `Sound.update` but `sound.js` never reads it, so wind,
  birds, rain, fire crackle and pot bubbles carry on while paused.
- At boil the pot averages ~20 bubbles/s, each ~5 nodes; thunder builds a fresh `WaveShaper` curve and two
  long loops per strike; 40 `always` rules bypass the 6/s voice budget.
- A running `AudioContext` holds Android's `AudioMix` partial wakelock even when silent — muting is not
  enough, `suspend()` is (Chromium CL 1166483002). iOS suspends on backgrounding already.

Levers: suspend on pause/long idle with resume on input; gate the wind; only write params when the target
changes; a live-one-shot ceiling (~16–24); shorten the 2 s mute grace; `latencyHint: 'playback'`; send
footsteps and clicks dry instead of through the 1.6 s convolver.

### 6. Cadence of small work — free

- The **250 ms UI block** (`19497–19527`) runs while paused and resting: `renderVitals`, `renderThermo`,
  `renderTasks`, `renderInspector` (which rebuilds a full HTML string and filters all creatures at 4 Hz),
  plus `beesOnScreen`/`leavesOnScreen` scans for sound. Run it at 1–2 Hz when paused/resting or idle.
- `keepSkills()` writes localStorage every 30 s even when the tick guard skips the save (`18872`, `18903`).
- Only the **draw** is gated; `onBeat`, the sim accumulator, `leadCam`, `updateSky`/`updateDial`/`updateMap`
  and the helper frames still run every rAF beat. On a 120 Hz Android at 30 fps that is 90 wasted beats a
  second. Cheap early-outs on the frames that won't draw are safe (do **not** slow the 1× sim: measured
  ~0.15 ms/s — it is not the problem).
- `ledCam` eases asymptotically, delaying the exact `camStill` test, so calm arrives a few seconds after the
  player stops. Snap below 0.01 tile.

### 7. DOM and CSS polish — small but easy

- `#build.ready::after` and `#book-btn.new::after` pulse **infinitely** during normal early play
  (`index.html:918–925`, `1156–1158`). Two or three runs then a static ring.
- `#camptitle` carries `will-change: transform` permanently while parked off-screen (`index.html:185`).
- `drop-shadow` on `#me svg` and `.dial svg` (`1371`, `1388`) re-rasterises a filtered subtree whenever the
  4 Hz vitals/dial writes land. Paint the shadow in.
- `--paper` is a data URL read in every style pass; blob it like `--items` already is.

## What not to do

- **No DPR cap, no 1.5× governor rungs.** Tried, reverted on a real 3× iPhone: soft picture, and sprites
  jitter against the ground at 1.5×. Battery saver's opt-in 2× (`SAVER_DPR`) is the only resolution drop.
  Any future render path must still wrap `render()` in `pixelCam()` or that jitter returns.
- **"Muting saves audio power"** — no, a running context holds the audio device; `suspend()` does.
- **"120 fps on iPhone"** — not possible in Safari or a PWA.
- **"30 fps doubles battery"** — ~33% of system power in the best native 3D cases, ~16% at the low end.
- **"Battery API will adapt on iPhone"** — it does not exist there.
- Don't slow the 1× sim, and don't re-add a blanket `alpha:false`/`desynchronized` cargo cult to WebGL.

## How to measure

There is **no real-phone baseline** yet; `plans/mobile-heat/README.md`'s table is an emulated DPR-2 desktop
pane, and its after-step prose is partly stale (12 fps resting, `gov.top = 2`). `?bench` exists
(`game.js:19226–19265`) and prints avg/p50/p95 render and sim, beats/s, drawn/s, rung history, dpr and canvas
size — run it on the iPhone and an Android before changing anything.

What to use:

- **iPhone:** Xcode Instruments → Power Profiler, or a fixed-brightness %/10 min run (the only route without
  Xcode). Safari's Energy Impact is unitless and wakeup-weighted; useful for relative comparisons, not watts.
- **Android:** Android Studio Power Profiler on the ODPM rails (Pixel 6+), or `adb shell dumpsys batterystats`
  with the device unplugged; Battery Historian is unmaintained.
- **Chrome DevTools** has no energy metric, and its CPU throttling does not throttle the GPU process.
- Method: fixed brightness, same network, unplugged, 10-minute runs, three repeats, A/B the same meadow
  (`?seed=123`). Under ~2% difference per 10 min is noise.

## The short list, if only some of this is done

1. Wake lock idle policy (§2) — biggest single item.
2. Network/radio and hidden-tab trims (§1) — biggest unseen item, all free.
3. Calm in the storm, cooking window and long idle (§3) — free, no sharpness.
4. Ground hand-over and sky-picture repaint limits (§4) — free, measurable in `?bench`.
5. `tickAmbience` cleanup and suspend-on-pause (§5) — for sound-on players.
