# Games research for Nobody's Meadow (?keep, the Dry Year)

Status 2026-10-12: **partial.** Cut short by the coordinator. Web-checked so far: Timberborn droughts and
badtides (wiki, guides, Steam/feedback-board complaints) and Frostpunk's telegraphing (reviews, Stokalski's
Xbox Wire post, prototype notes). The Frostpunk wikis refused fetches (402/401). Everything marked
**[unverified]** is from general knowledge of the games, not checked against a source this session. The other
games (Terra Nil onwards) are short notes from general knowledge, marked TODO for a web pass.

---

## Timberborn: droughts and badtides (web-checked)

**What it does**
- A cycle is one temperate season then one hazardous one (drought or badtide). New games always start
  temperate. Droughts and badtides are drawn by weighted odds (default 60/40), with streak rules so a run of
  droughts forces a badtide. ([wiki: Weather](https://timberborn.wiki.gg/wiki/Weather))
- **The first drought is short and each one after is longer.** First drought: Easy 1 day, Normal 2 to 3,
  Hard 3 to 6. A "handicap" starts at 20% of the rolled length on Hard and rises linearly to 100% over 15
  cycles (a rolled 30-day drought plays as 6 days in cycle 1, 7 in cycle 2).
  ([wiki: Drought](https://timberborn.wiki.gg/wiki/Drought))
- In a drought the sources stop. Rivers, lakes and ponds drain and evaporate (about 0.045 m per exposed
  tile per day, so deep narrow reservoirs last, wide shallow ones don't). Tanks and dammed reservoirs are
  what's left. ([first drought guide](https://www.whisperofthehouse.com/timberborn/first-drought-guide))
- **Green by the water, brown elsewhere.** Irrigation spreads from water, deeper water reaching further; in
  a drought it recedes as the level drops, so the crops furthest from the reservoir die first. A guide's
  phrase: water in storage keeps beavers alive, water near soil keeps land green.
  ([irrigation guide](https://www.whisperofthehouse.com/timberborn/irrigation-reservoir-guide),
  [water guide](https://timberborn.org/articles/water-management-guide))
- The forecast in the UI shows the current weather and a countdown to the next hazard. Guides disagree on
  how early (days vs hours); they agree the warning is a **last check, not a time to start**: "prep begins
  before the warning appears". ([drought survival](https://timberborn.org/articles/drought-survival-guide))
- Badtide (Update 5, Jan 2024): the sources run poison instead of water; contamination ramps 50% to 100% over
  12 hours and back, and above 50% it spreads onto the land and kills plants. The design aim (Mechanistry):
  two fluids competing for space make players more creative with the water.
  ([godisageek](https://godisageek.com/2024/01/timberborn-gets-badwater-its-fifth-content-update/))

**What players say**
- Loved: the first drought as a test ("treat the first drought as a diagnostic"), watching the river drop,
  the green-brown map that tells you where life is. Hard-mode players like using every good day to prepare
  ([Steam thread](https://steamcommunity.com/app/1062090/discussions/0/4297068552118034393)).
- Complaints: droughts stop growing past a point, so "the start of the game is half a challenge then it's
  just easy" ([feedback board](https://timberborn.featureupvote.com/suggestions/273245/comment/567233));
  dams by day 3 make droughts irrelevant
  ([challenge thread](https://timberborn.featureupvote.com/suggestions/349984/comment/454667)); a walled-off lake
  evaporating "only a couple months in" felt unfair to one player, answered by "build deeper".

**For the meadow**
1. **The first Dry Year gentle, then harder each time** (already in PLAN's "later"). Timberborn's own late
   game shows the trap: once one answer solves it for good, the pressure is gone. So a later Dry Year
   should ask a different question (longer, or hotter, or one that dries the ponds that saved you last time).
2. **The evaporation lesson is already in D1** (bigger ponds dig deeper, `POND_MIDDLE`). Say it in the
   ghost the way Timberborn's players learn it: "deep middle: lasts the Dry Year" vs "shallow: dries".
3. **The water dropping is the warning.** Timberborn's best tell isn't the UI, it's the river falling. The
   Dry Year's spring flood failing (`DRY_FLOOD`) is that already; make it seen: the shore line from last
   year left as a pale ring of mud on the bank (the shape texture's 4th channel already marks mud).
4. **A badtide-like second pressure, later**: not needed now; noted for step 3 (a hot summer of fires, or a
   sickness year).

## Frostpunk 1 and 2: how the cold is telegraphed (partly web-checked)

**What it does**
- The temperature readout is the biggest thing on the screen, top and centre, always there, with a
  forecast beside it of the changes coming ([checkpoint review](https://checkpointgaming.net/reviews/2018/04/frost-punk-review-not-winter-wonderland/)).
- The map is a crater with the generator at its centre and the heat in rings round it: "heat is life in this
  game" (Kuba Stokalski, lead designer, [Xbox Wire](https://news.xbox.com/en-us/?p=125332)). The heat
  circle tells you where to build without a word.
- Cut in prototype: storms that blocked building. They made no interesting decisions, just an
  inconvenience. The cold had to make choices, not obstruction
  ([TechRaptor](https://techraptor.net/content/how-11-bit-studios-created-society-survival-simulator-frostpunk)).
- "Never a choice without a good way out, or it's cheating" (Stokalski on Frostpunk 2, PC Gamer, via search excerpt).
- Music: the composer put a ticking clock into "The City Must Survive" for the coming storm, and violins
  descending in pitch for a fate locking in ([Laced Records](https://www.lacedrecords.co/blogs/blog/frostlands-revisited-piotr-musial-on-composing-frostpunk-2-original-soundtrack)).
- Frostpunk 2: a weather timeline top right; a whiteout shows as an icon sliding toward the left edge,
  and it starts when it gets there ([dotesports](https://dotesports.com/frostpunk/news/how-to-survive-a-whiteout-in-frostpunk-2)).
- **[unverified]** In Frostpunk 1 the screen's edges frost over as it gets colder, unheated buildings go
  white with frost while heated ones glow amber at the windows, the wind gets louder as the temperature
  falls, and the final storm in A New Home is announced days ahead (refugees bring word; the wiki says the
  cold falls to about -120 C at its eye) with a countdown, and scouts must be called home.

**What players say**
- Praise: atmosphere and dread, the score ("gives chills"), the storm as a climax you prepare for.
- Complaints: tense and punishing rather than free; some find later playthroughs solved.
  ([GameGeeker](https://gamegeeker.com/games/frostpunk-323190/review?market=FR))

**For the meadow**
1. **The countdown as a thing that moves, not a number.** Frostpunk 2's icon sliding along a bar: the U4
   ribbon already does this; let the parched pip slide one notch each season with a soft tick.
2. **The meadow itself telegraphs.** Frostpunk's frost on the buildings, translated: in the Dry Year's
   spring, before any parch, the grass tips go tawny in patches far from water, a step a day (one uniform
   in ground.js, in 16ths as `drought` already is). The player sees where it will hurt before it hurts.
3. **Sound.** A dry wind bed that rises with `dryness` (one noise source, filtered; sound.js), cicadas in the
   Dry summer's heat, the piano playing sparser. And when the rain comes back, the loudest, warmest
   moment of the game (rain on leaves, a felt-piano phrase). Frostpunk's arrival is unmistakable; ours
   should be the relief.
4. **The heat circle = the green ring.** Already built (D1/D2: lush ring within 3 of water). Keep it the one
   picture that says "dig here".
5. **Every pressure must leave a way out** (Stokalski): the alerts' "what helps" line does this.

---

## TODO (not researched this session)

Short notes from general knowledge only, each needing a web pass for reviews and specifics:

- **Terra Nil**: every placement greens a patch at once with its own sound; a number before you commit;
  animals return at the end. Already mined in PLAN.md.
- **Against the Storm**: the Queen's Impatience as a clock with a face; rain cycles (drizzle, clearance,
  storm) with hostility rising in the storm; free building moves.
- **Equilinox, Viva Piñata**: placing a plant or meeting a condition brings a visitor; Viva Piñata's
  "appear / visit / resident" ladder for each species is the clearest "a placed thing has an effect".
- **Islanders, Townscaper, Dorfromantik**: the instant score preview and the juicy "pop" of placing;
  Townscaper has no goal yet every click changes the picture.
- **The Garden Path, Eco, Before We Leave, Banished, Planet Zoo, SimLife/SimEarth, Ecosystem, Rain World,
  Cities: Skylines water**: not started.
- Cozy-game "one placed thing feels impactful": not started beyond the notes above.
- Reddit / Steam review mining for all but Timberborn: not started.

## Top ideas so far (provisional ranking)

1. Gentle first Dry Year, harder or different later ones (Timberborn; the late-game "solved" complaint).
2. The meadow telegraphs: tawny tips in the Dry Year's spring where it will parch (Frostpunk's frost).
3. A dry wind bed rising with `dryness`, and the rain's return as the warmest sound in the game.
4. The ribbon's pip slides a notch each season with a tick (Frostpunk 2's weather timeline).
5. The old shoreline as a pale mud ring in the Dry spring: the water dropping is the warning (Timberborn).
6. The ghost says "deep: lasts" vs "shallow: dries" (Timberborn's evaporation lesson).
7. A visitor ladder per species (Viva Piñata), shown as a line on the tool card: TODO verify.
8. Keep the green ring as the one picture that says "dig here" (Frostpunk's heat circle).
