---
name: playtest
description: Play Nobody's Meadow in a real Chrome window, the way a player would, with tools/play.mjs, and report what's wrong or awkward. Use it when asked to playtest, play through, try a feature, check how something plays or looks in the game (desktop or phone), or before saying a change to play or the page works.
---

# Playtesting the meadow

`tools/play.mjs` keeps a Chrome of its own open between commands: a window Axel can watch it play in (drawn on the GPU,
like his own browser), on a server of its own that serves this checkout uncached and with no service worker. Each command
is one Bash call. `node tools/play.mjs help` lists them all.

```bash
node tools/play.mjs start --out <scratchpad>/play     # a new meadow (--seed N, --phone, --query 'keep', --headless)
node tools/play.mjs status                            # the clock, the forager, the satchel, what's open, fps
node tools/play.mjs seen                              # what there is to tap, nearest first, and where the water is
node tools/play.mjs use dandelion                     # tap the nearest one (off to pick it, as a player's tap)
node tools/play.mjs shot after-pick                   # a screenshot; Read the path it prints
node tools/play.mjs stop
```

- Put `--out` in your scratchpad, so Axel can open the shots. Each command prints the page's new errors after its answer.
- Another session may be playing too: `--as NAME` on every command runs a second one beside it.
- `--headless` when nobody needs to watch (a long scripted run). It paints the canvas in software: fine for screenshots
  and flows, no measure of speed.
- It shuts itself after 30 min with no command (`--idle`). Stop it when done anyway.
- A change to `game.js` and the rest: `reload` (keeps the query; `reload --fresh` forgets the kept meadow and settings
  too). A change to `tools/play.mjs` itself: `stop` and `start`.

## Moving like a player

Prefer the player's way in: real taps, clicks and keys (`tap`, `use`, `go`, `hold`, `drag`, `circle`, `key`), which run
the game's own input code. `garden.click`, `garden.give` and setting fields by `eval` skip the part a player touches, so
use them only to get to the moment under test, and play the moment itself by hand at least once.

- `use WORD` taps the nearest seen thing whose kind or name has WORD in it (`use fire`, `use stick`, `use rabbit`).
- `go X Y`, `go camp` and `go water` walk there by tapping the meadow, toward the screen's edge while it's off it.
- `tap TEXT` and `tap '#css'` click a button or field (with the mouse, even on a phone size: see the traps below). `ui`
  lists them with their centres and sizes; satchel slots show as `slot 1: rod (held)`.
- `circle X Y R TURNS MS` stirs; `hold X Y MS` charges a cast; `key 1` takes up slot 1; `key e` uses what's near.
- `film 6 250` takes six frames 250 ms apart onto one sheet, for anything that moves (a pick, a cast, a fade).

To skip to a moment: `scene day` (intro cut, outfit card shut, storm cleared, forager made well), `scene camp` (and a
lit campfire), `scene pot` (and the clay pot in hand, watercress and sorrel), `scene fishing` (on a bank with a rod).
Then `time noon|dusk|night|season`, `weather rain|fog|snow...`, `speed 0|1|10|60`, `give ID N`, `look X Y ZOOM`,
`wheel -300` (zoom in), `size phone`, `media reduce`. A new scene goes in `SCENES` in tools/play.mjs; keep each one
safe to run twice.

`run FILE.mjs` plays a script, `export default async p => { ... }`, with every command as `p.<name>(...)` plus `p.ev`
(an expression in the page) and `p.say`. Use it for something to run again after a fix.

## A playtest pass

1. **Open it as a new player would.** `start` (and again with `--phone`), and look at the first shot: is there something
   to do straight away, and is it plain what? Note anything you had to work out.
2. **Play the verbs the change touches, then the loop around them**: gather, make camp, fill and set the pot, cook, eat,
   fish. Play it by tapping, not by setup. Note every tap that did nothing, did something else, or needed a second try.
3. **Shoot the moments that matter**: before, during and after, plus night, rain, zoomed out, at speed. Use the window
   size the change is most at risk in, and the phone size (`size phone` then `reload`) whenever there's page UI.
4. **Check the page apart from the meadow**: `ui` (sizes, covered buttons), `shot --meadow` beside `shot`, Back, Esc.
5. **Report** (below).

## What to check here

- **The meadow, not cards.** Axel wants to see the meadow: new UI small, temporary and near the action, opaque parchment,
  no `backdrop-filter`. Judge from the shot how much of the play area a card covers, and for how long.
- **Touch.** Targets 44 px or more (`ui` marks smaller ones SMALL at a touch size); a ✕ is a round brass button at the
  foot on an upright phone; `back` shuts what's open; nothing important under the notch (`size phone --notch`).
- **Every input answers**: a ring, a word in the line over the satchel, a walk, a sound. A tap that does nothing is a finding.
- **Sprites sit on the ground** and line up, and the forager never sticks in a pose (0.12.1 and 0.12.2 fixed two of those).
- **It reads in every light**: night, rain, fog, snow, zoomed far out, at speed 10 or 60.
- **It keeps.** `reload` brings the same meadow back with what was made; What's new shows once after an update, not again.
- **Reduced motion** (`media reduce`, then `reload`): no crane in the intro, nothing that only moves to say something.
- **No errors**: every command prints new ones; `errors` lists them all, `log` the console.

## Traps (each cost a session time before)

- Screen positions go stale while the camera eases after a walk. `seen`, `use` and `go` wait for it to rest; a position
  read earlier may not hold any more, so read `seen` again before tapping by numbers.
- A finger snaps to things up to 48 px off (a mouse 14), so at phone zoom a tap near the bank can pick up what lies there
  instead of reaching the water. That's the game, not the driver: if it happens to a player too, it's a finding.
- Headless Chrome moves a touch onto a button up to ~8 px past its edge, so "tap just outside" proves nothing. Judge
  sizes from `ui`'s numbers.
- A finger tap on a button that hides itself can stick headless touch for good, so buttons are clicked with the mouse
  (`--touch` forces a finger).
- A `confirm()` would hang every command; the driver says no to it and prints that it did.
- Everything off this machine is blocked: the tally, the visit counter, Supabase (friends, playing together), the old
  stone's critic, Web3Forms (the ideas card emails Axel). Those parts can't be tested here. Never `start --net` to send
  an idea, make a friend or ask the stone without asking Axel first.
- Not for speed. Frame numbers are only worth anything in the window with the Mac's screen awake (it caps at 30 fps
  asleep); real measuring is CLAUDE.md's "Measure it" rule.
- The in-app browser pane slows to a few frames a second while hidden. Use this window instead.

## What it can't tell

It sees the game a few frames at a time. Whether a timing, a bar or a stir *feels* right is Axel's call: say so in the
report rather than judge it, and give numbers he can react to (how long it took, how many tries, a `film` sheet).

## Reporting

Lead with the findings, the worst first. Each one:

- **What you see**, with the shot's path (or the film's).
- **How to get there**: the seed, the size and the commands, so it can be seen again.
- **Why it matters** to a player.
- **Where it lives**: the file and the part (game.js's cooking window, sim.js's fire, index.html's styles).

Then, in a line or two, what you played that was fine, and what you couldn't check (feel, the network, Safari).
