# The forager: body, face, vitals, the opening

## game.js

Its body (sim.js `bodyTick`) shows on it first (`drawBody`, `shiverOf`, `drawFallen`): a shiver is a short sway of
its body about its planted feet, eased in and out, with a soft chatter (sound.js `shiver`): now and then chilly, more often
the colder (`SHIVER_EVERY`), freezing a faint tremble between (`SHIVER_STEADY`). From cold (`FORAGER_SAD`) it hugs itself,
standing and walking, sad (worried brows, a frown, a red nose: fur.js `FORAGER_COLD`, poses 5 to 7 and 24 to 31, asked for
ahead once it's chilly; the sprite cache keeps only the set in use, `keptForager`), and hunched (`HUNCH`); standing it sighs
now and then (sound.js `breath`). Freezing, frost at the screen's corners and edges (`#frost`,
CSS gradients only, shown only then) and a soft heartbeat (sound.js `heart`, `HEART_MS`); a stumble pitches it forward. In air under
`BREATH_AIR` its breath puffs from its mouth (`BREATH_AT`, by view, drifting the way it faces; `PUFF_ART`, painted once), soaked it drips off its hem, now and then a drop you hear (sound.js `hemdrip`). Out of breath it pants (`pantFrame`, sound.js `pant`, one a breath every `PANT_MS`: quick and hard when spent, slower and softer as it comes back, from `PANT_LOW` already while sprinting) till it has `PANT_DONE` back, then a phew (sound.js `phew`). Its face is top left
(`#me`, `renderVitals`, in the 250 ms block, rewritten only on a change; 2026-10-17): its head painted from the front in its outfit and snow,
in a mood (`faceMood`, held `MOOD_HOLD` before it changes; fur.js `FACE_MOODS`, `paintForagerFace`: well, cosy by a fire, happy after eating or
a level up, cold, hungry, hurt or down, winded), each painted once and kept (`faces`); frost round it while freezing. Health is a ring round
it, warmth (amber to ice blue, a drop while wet) and the tummy two small dials under it, dimmed while full; low (cold, hungry) a dial blinks red and swells a little (`.dial.low`), quicker freezing or starving (`.dire`; 2026-10-21). Hungry, its tummy growls now and then (sound.js `growl`, `GROWL_MS`, in `bodyFrame`), more often and louder the emptier. No browser tooltips on them:
a parchment tag slides out beside the one hovered, or for a moment after a tap (`#me-tip`, `showTip`, `tipSaid`: what it is, how it is,
and what helps). Stamina is a slim bar centered over the
satchel (`#vitals`, `#v-stam`, in `renderVitals`) shown while it isn't full, ember-red pulsing while winded. A tap on
the face or I opens the book at You (the book's third part, `openYou`, `youSheetHTML`, `skillPageHTML`: level, a bar to the
next, what it gives, what practises it, and the road to opal); its brass badge is the levels added up, and a level up glows the
book button and puts the You tab's dot there till the book is opened on You.
The air's temperature (sim.js `airTemp`, the weather's, not what the forager feels) is a small parchment pill top middle (`#thermo`,
`renderThermo`, in the 250 ms block, rewritten only when the whole degree changes; 2026-10-18): a thermometer whose mercury rises over
`THERMO_RANGE` and goes ice blue to amber to hot red (`THERMO_INK`), the degrees and a word (`THERMO_WORDS`). Cold it ices over (`--ice`, 0 at `THERMO_ICE`'s first degree to 1 at its second; 2026-10-19):
frost ferns in from its ends, a pale glaze and rime under the words, and icicles hanging from its foot that grow longer the colder (index.html
`#thermo::before`, `::after`: CSS and small inline SVGs only). The toast and the headlines
sit under it. On an upright phone it's just the degrees, and while playing together (the pill then reaching past the middle) it sits beside the face.
Practice earned floats up over its head as in Project Zomboid (`xpFrame`, `drawXpFloats`, 2026-10-17): "+4 Gathering" in the
skill's ink (`SKILL_INK`, lightened) as plain words with a faint dark edge, no pill, painted once (`xpFloatOf`), gathered till it stops
gaining for `XP_QUIET_MS` (a pick, a dish) or `XP_MOST`; stamina only now and then, every `XP_EVERY` seconds of sprinting gathered over
sprints. Shown as practice times `XP_SHOWN`, a newer one pushing the older up. A new skill shows at 1x.
Collapsed it tips over (`FALL_MS`) with its eyes shut (pose 7), the screen goes dark
(`#veil`, `DARK_AFTER`), and `bodyFrame` runs the sim `SKIP_MS` a frame till it wakes at home (`bodyWoke`: the camera there at
once, a toast, three soft notes: sound.js `wake`). Out of breath (`f.winded`) a press, Shift or a held run only walks it.
A new meadow opens like a film (`startIntro`, `#intro`): black bars top and bottom from the first frame, the rest of the page
away (`body.intro`), "Nobody's Meadow" and "Spring · late afternoon" fading in and out in the lower bar (`INTRO_NAME`), the
camera craning down onto the forager from `INTRO_WIDE` of its zoom and `INTRO_RISE` tiles up over `INTRO_CRANE` (`introLeft`,
in `leadCam`), then the bars slide off at `INTRO_MS` and the page fades back, the cloak's card after it if one's still to pick.
A key cuts it short and does nothing else (a capturing listener); a click or a tap does nothing at all, the bars go on their own clock; a kept meadow and a friend's (`heardWorld`)
open without it. The zoom moves through it, so the ground repaints those few seconds, with nothing else going on.
A new meadow opens in a storm late in the afternoon (sim.js `START_PHASE`) that holds till the first fire is lit, drawn
heavier than other storms (`GALE_LOOK`: the storm's share of the sky's mix goes over 1): a moment after it's on screen (`OPENING_MS`) the
forager says to itself what it needs, "It's freezing. I need a fire before dark." (`openingLine`, `OPENING_LINE`; in the intro at `INTRO_LINE`), in a bubble over
it as a line of chat is (`myChat`), in italics (`chatArt`'s `thought`; a `\n` in the game's own words breaks the line there). A
friend joining during the opening storm hears it too (`heardWorld`), and the storm blowing over brings the rainbow as any rain does.

## sim.js

Its body (`bodyTick`, every tick, before it walks): the air's temperature (`airTemp`, degrees: the year's, `AIR_YEAR`, about
19 at midsummer and -1 at midwinter; the day's, `AIR_DAY`, coldest at sunrise, warmest at `AIR_WARMEST`; the weather's,
`AIR_WEATHER`; snow lying, `AIR_SNOW`). What it feels (`f.feel`) is that plus the sun out of the shade (`SUN`, `sunUp`), less
the wind (`WIND`) and being wet (`WET_CHILL`), plus moving (`ACTIVE`); the woods (`SHELTER_WOOD`) keep off wind, rain and sun.
Over `COMFY` its warmth (`f.warmth`, 1 cosy to 0) comes back at `WARM_K` a degree a day, under it goes at `COOL_K` (`WET_COLD`
times faster again soaked). Rain soaks it (`WET_RAIN`, less under trees), wading at once (`WET_WADE`), and it dries out of the
rain (`DRY`, faster warm, in sun, moving). Sprinting spends stamina (`SPRINT_TICKS`), walking and standing bring it back
(`REST_TICKS`, slower cold); spent it's `winded` till `WINDED_BACK`. Stages (`warmthStage`, `WARMTH_STAGES`): cosy, chilly, cold
(slower, `COLD_PACE`, `bodyPace`), freezing (slower, stumbles, `STUMBLE_*`, hashed from the tick, no random numbers), and at 0
it collapses (`f.down`, event 'collapse'), waking at `f.homeX`, `f.homeY` (where it started; the camp later) the next morning
(`WAKE_PHASE`, at least `DOWN_TICKS` on: `wakeForager`, event 'woke') chilly, dry, rested, the satchel empty. Standing still
from full warmth at dusk (4 seeds): a summer night ends cosy or chilly, a spring or autumn one anywhere from chilly to
collapsed (rain makes it worse), a winter one kills.
The opening (PLAN.md stage 3): a new meadow opens on day 4 of spring (`START_DAY`) late in the afternoon (`START_PHASE`, just
before the golden hour), in a storm that holds till the first fire is lit (its `until` is `OPENING_HOLD`, which `openingStorm`
looks for; a collapse doesn't end it, the forager wakes into it), then blows over (`lightFire`: `STORM_EASE`) into a clear spell
(`CLEAR_AFTER`, and at least till `CLEAR_END`, the morning after; `weatherTick`), then the season's odds again. It's a gale,
harsher than other storms (`GALE_*`: colder in `airTemp`, windier and wetter in `bodyTick`, twice the lightning, and a strike in the open round the forager about every 5 s at 1x, `GALE_NEAR`; game.js shows
it as more than a storm, `GALE_LOOK`). The forager arrives cold and wet (`foragerArrives`: `ARRIVE_WARMTH`, `ARRIVE_WET`), and so
does a friend's forager coming in while it lasts. In the open, walking about it collapses about dusk (0.71 of the day, about
3 min at 1x after it opens), standing still at 0.62 (4 seeds); under trees it lasts longer. A meadow kept from before the
storm held keeps its old end. No new fields, no `KEEP_VERSION` bump.

Its tummy (`f.tummy`, 1 full to 0; the comment over `TUMMY`): `TUMMY` of recipes.js's fill, emptying in about a day walking
(`TUMMY_BURN`), `TUMMY_STILL` of that standing, `TUMMY_RUN` sprinting, up to `TUMMY_COLD` more in the cold. Under `HUNGRY`
(`hungerOf`) stamina comes back slower (`HUNGRY_REST`) and the cold bites harder (`HUNGRY_COLD`), most of all empty; it never
collapses it on its own. `feedForager` (game.js, with the fill it reads from recipes.js: an apple 1, a dish 3 to 7) fills it, and a
warm dish puts `WARM_DISH` back and keeps it warm inside for `WARM_IN` (`f.warmIn`: cooling `WARM_IN_COOL` as fast). A new
forager starts at `START_TUMMY` (0.85: by the first fire it's still fed at dawn, hungry by mid-morning), wakes at least
`WAKE_TUMMY`. Events 'hungry', 'starving', 'ate'. A kept forager from before starts full; no `KEEP_VERSION` bump. (The rabbits
have an `eat` of their own: a second `function eat` in sim.js would take its place.)

Curling up (2026-10-21): still under the lean-to at night (no walking, nothing in its hands, no stumble) `f.rest` counts the
ticks (a field in its blank; kept from before, 0), and at `CURL_TICKS` (six seconds at 1x) it's curled up (`curledUp`, event 'curl', the
deed 'lean-rest'): `CURL_FEEL` degrees warmer and it mends twice as fast. Any step, or the dawn, sets it back to 0. Drawn in
game.js `drawCurled` (fire-camp.md).
