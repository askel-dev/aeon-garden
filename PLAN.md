# Plan: The Field, a keeper game for two

Agreed 2026-10-08. Replaces M1 of "make a home, see who moves in" (2026-10-05, git 7013883). Its worn field, pouch,
planting, sowing, spade and guestbook live on here, and the challenge, the second player and the sim changes are new.

You and someone else take over a worn-out field together. The sheep have gone, the turf is grazed to the
soil, a brook runs along one side, there's one old oak and a stub of hedge, and nobody lives here but a few
crows. Every spring the Surveyor walks the field and counts who has made a home in it. Each year he wants
more. Miss his count and the field goes under the plough.

You never place an animal. You mend the land, and each species decides for itself whether to come, stay
or leave. The meadow fights back: what you invite eats what you planted, the Almanac warns of a drought or a
hard winter a season ahead, and a meadow that does well draws more trouble. It should be hard to win,
easy to understand why you lost, and make you want to play again.

## What the research said, and what we take

From the games looked at on 2026-10-08 (sources at the end):

- **Stability is the enemy** (Against the Storm). City builders aim for balance, and once it's reached
  the game is over unless something knocks it out of balance. Our sim balances itself, so the game has to supply
  the pressure. → the Surveyor, the Almanac, a run that ends.
- **A judge with a face** (Against the Storm's Queen, Frostpunk's storm, Eco's meteor). A timer reads as
  someone's demand, not a balance knob. → the Surveyor and his rising count.
- **Warn before you strike** (Into the Breach, Spirit Island, Timberborn). Showing what's coming, and where,
  makes a loss feel like your own call. → the Almanac, a season ahead.
- **Success draws trouble** (RimWorld's wealth-scaled raids, Pandemic's Intensify). But a loop that runs
  against the player becomes a death spiral (LeBlanc), so a struggling player gets a lifeline. → troubles sized by
  how well the meadow does; a gentle year and a gift seed when it's down.
- **Every fix has a cost** (Oxygen Not Included, Reus, Viva Piñata, Terra Nil). → every species is a goal and
  a problem; every tool does two things.
- **The economy is the meadow's health** (Dorfromantik, Equilinox, Terra Nil). → seeds come only from what grows.
- **A ladder of species** (Viva Piñata: visitor, resident, breeding; early ones unlock later ones). → the needs check.
- **Few lives, each one counts** (Frostpunk: "empathize with numbers"). → dozens of rabbits, not hundreds.
- **Hard but readable** (Oxygen Not Included's overlays; Sylvester: the least model that tells the stories).
  → lenses, and a reason every time something dies, frets or leaves. No hints, no rescues.
- **Co-op works through need** (Keep Talking: split information; Eco: no one masters every trade; Don't Starve
  Together: shared consequences). Turn-based co-op breeds one player running the other's turns; real time
  and private information don't. → two keepers, each with their own hands and half the lenses.

## The rules, in short

1. **Animals arrive, settle and leave on their own.** Each species has a short list of needs the player can
   make. Met for a few days, a few come. Bred here and lasted a year, they've settled. Unmet too long, they
   leave, and coming back takes longer each time.
2. **The land is the player's to mend.** The soil starts worn out and only heals where something is done
   (cover, flowers, leaf fall, droppings). Bare ground overgrazed for too long wears down again.
3. **Seeds come from the meadow, hours from the keepers.** The pouch fills each autumn from what grows. Each
   keeper has so many hours of work a season.
4. **The Surveyor counts each spring.** Settled species against a rising target. Miss it and the run ends.
5. **The Almanac warns a season ahead.** At most one trouble a year, sized to how well the meadow is doing.

A run is 6 years, about 20 minutes at 2x. Played well, every run ends with a story you tell the other
player afterwards: "the foxes came in year 3 and we nearly lost the rabbits".

## Calls (defaults; easy to flip after playtests)

- **Losing:** the hard spring count. A run can also wind down by itself (pouch empty, nothing growing).
- **Roles:** the lens split (Gardener and Warden, below), not just a split by tools.
- **The spring pick** (1 of 3 boons or laws): not in the first playable. It's in Later.
- **Where it lives:** `?field` until it tests well. The bare address stays the meadow you watch.
- **Foxes count for the Surveyor.** You need predators, which you can't control. That's the point.
- **Owls stay off** (`OWLS = false`). Crows don't count (they're there from the start).
- **Time:** the slower of the two players' speeds. Either player can pause.

---

## Milestone A: playable alone (is the loop fun and hard?)

Each step is its own commit. After every sim step, run `balance.js` in keeper mode (step A3) as well as the
usual check, so the meadow you watch stays as it was.

### A1. The keeper mode and one way in for the player (sim.js, game.js)

Everything the player does goes through one door, so the two-player version can send it over the wire and
the balance bots can play by the same rules.

- `createWorld(seed, { keeper: true })` sets `w.options.keeper`. A keeper world has no `migrate`, no
  `planArrivals`, and its own start (A4).
- `act(w, cmd)`: `cmd = { t, by, kind, x, y, ... }` goes into `w.orders` (sorted by `t`, then `by`). `step`
  applies the orders due before `buildGrid`. Each kind of order checks its own cost (A5) and emits an event
  with the result (`acted`, or `refused` and why), so both screens show the same thing.
- game.js tools in keeper mode call `S.act(world, { t: world.tick + 1, by: me, ... })` instead of
  `plantTree` and the rest directly. In the meadow you watch, they stay as they are.
- Off in keeper mode: release tools, ⚡ Zap, 🔥 Fire, 🌱 Grass, picking the weather, picking animals up
  (`lift` is an input every frame, which the second player can't share), and running on while away (`startAway`).
- Naming goes through `act` too (it's cosmetic, but both screens should agree on names).
- Kept: Look, the inspector, news, graphs, the food web, the sound.

Done when: the planting tool works through `act` in keeper mode, and `balance.js` can plant through it.

### A2. The living soil (sim.js)

Today `w.fert` is fixed when the meadow is made (`makeTerrain`, flower fields add to it), and the grass
grows back to it everywhere (`growGrass` reads `w.shadedFert`). So the meadow fills itself. In keeper mode the
soil moves:

- `w.potential`: what each tile's soil could be (today's `fert` as made: the valley, the damp, the hills).
- `w.fert` starts at `WORN` (about 0.3) × potential, a little more along the brook.
- `soilTick`, once a day (with `groundTick`, which already recomputes `w.shadedFert` daily), moves each tile
  towards its potential by `MEND` a day for what's on it, and wears it down when it's bare:
  - under cover (A3's `w.cover`): + `MEND_COVER`
  - in a flower patch: + `MEND_FLOWERS`
  - under a tree's crown (the leaf fall), autumn and winter: + `MEND_LEAVES`
  - rich ground (`w.rich`: droppings, remains, a rotting log): + `MEND_RICH`
  - grass below `BARE` for more than `WEAR_DAYS` days (`w.bare[i]` counts the days): − `WEAR`
- Start numbers: about a year of cover to heal a tile, about a season of bare ground to lose a tenth.
  Tuned with the bots.
- No new drawing: the ground already colours by `w.grass`, so mended land greens up as the grass follows it.
- `w.potential` and `w.bare` are new grids, kept by `packWorld` as it keeps everything. A keeper meadow is new,
  so it needs no `KEEP_VERSION` bump. The meadow you watch never runs `soilTick`.

Why it matters: the room for animals becomes what the keepers have mended. Too many rabbits wear the field back
down. That's a way to lose that you manage, not one the sim fixes for you. The foxes and the sickness still hold
the rabbits, as now.

Perf: one pass over 15,000 tiles a day, like `groundTick`.

### A3. Cover (sim.js)

The sim has no cover today (`grep cover` finds nothing). A rabbit is safe only in a burrow, and a fox spots
it by distance and by how its coat stands out (`visibility`). The keeper's main lever ("you can't stop the
foxes, but you can give the rabbits somewhere to hide") needs it.

- `w.cover`, 0 to 1 per tile, rebuilt once a day and whenever a hedge is planted, burns or is cut:
  - a hawthorn (a hedge is a row of them): by its stage, full once young (`treeStage`)
  - scrub and the edge of a wood: from `w.wood`
  - long grass: a little (grass above `LONG`), so a scythe takes cover away
- **Hidden:** in `visibility`, a still rabbit on cover is seen at `1 − HIDE × cover` of the distance
  (`HIDE` about 0.7). It's read once per sighting, so no new scans.
- **A place to run:** in `flee`, a rabbit with no burrow within reach runs for the nearest good cover
  (`coverNear`, looked up on the cover grid within a few tiles). A fox that loses sight of a rabbit in cover
  gives up as it does at a burrow (`escaped`, cause `'cover'`, so the news and the stats can tell of it).
- **Quick hedges in keeper mode:** a planted hawthorn reaches young (`HEDGE_YEARS`, about 1) much faster than a
  wild one, so a hedge planted in spring gives some cover that summer and full cover the next. Other trees
  grow at their own pace.
- The meadow you watch gets cover too (it already has hawthorn scrub and wood edges). That's a balance change
  for it, so check `balance.js` without keeper mode as well: the foxes will catch fewer.

### A4. The needs check (sim.js)

One small table, one check a day per species, used to arrive, settle, fret and leave. It replaces `migrate`
in keeper mode.

```js
const WANTS = {
  vole:   w => ...,   // { met, why, where }
  rabbit: w => ...,
  ...
};
```

Each check returns whether its needs are met, a short reason (`why`, shown in the guestbook and the news)
and the best place (`where`, which the newcomers head for). `w.guests[s]` keeps
`{ state, firstCame, settledAt, leftAt, metDays, unmetDays, left }`, where state is `none`, `visiting`,
`settled` or `left`.

| Who | Needs (all things the keepers can make) | Arrives as |
| --- | --- | --- |
| Crows | a tall tree to roost in, short grass with grubs | here at the start; don't count |
| Voles | long grass over an area (`LONG`, at least `VOLE_PATCH` tiles together) | spill in from the edge where it's long (a field, as now) |
| Rabbits | cover by dry ground they can dig, and grass enough for a family within reach | the family walk-in (`familyArrives`), heading for `where` |
| Bees | flowers open within reach of a free hollow in spring and summer | a swarm to the old oak (`placeHive`'s hollow) |
| Frogs | still shallow water in spring, damp long grass by it | a few come up the brook to it, then spawn |
| Foxes | prey enough (rabbits, or voles in a vole year), and cover to den in | a pair from the edge nearest the cover |
| Otters | fish in lasting water and a holt (a big bank tree or a boulder) | a pair up the brook (`otterWay`), as now |

- **Arrive:** met for `ARRIVE_DAYS` (about 3) days in a row → a few come in from the nearest edge to `where`.
- **Settle:** a young one was born here and the species has been here a year (`YEAR_DAYS`).
- **Fret:** unmet for `FRET_DAYS` → news: "The rabbits are restless: nowhere to hide near the warren." Shown
  in the guestbook too. A warning, with a reason, before anything is lost.
- **Leave:** unmet for `LEAVE_DAYS` (about a season) → the grown ones walk off the nearest edge (mode `'leave'`,
  as a young otter leaves down the water; cause `'left'`, no remains). The voles and frogs, being fields,
  just thin out.
- **Come back:** after leaving, they need `ARRIVE_DAYS × (1 + left)` days in a row. The meadow has to
  win them back.
- Events: `arrive` (exists), `settle`, `fret`, `leave`. The news and the guestbook read them.

Perf: seven small checks a day. Where a check needs an area sum (grass in reach, flowers in reach), it uses
the grids the sim already keeps, over a box, once a day.

### A5. The worn field (sim.js, terrain-lab.js)

A new start, `createWorld(seed, { keeper: true })`, its numbers in `TERRAIN` with sliders in the lab:

- Keep the hills. No lake. One brook along one side, running off the map at both ends, with a few boulders on
  its bank (an otter holt one day).
- No generated woods or flower fields. One old oak with a hollow (the bees' and the crows') and a short stub of
  hawthorn hedge by it, along with a few lone hawthorns.
- Soil worn (A2), turf short. No burrows. A few crows, and nobody else. Voles 0, frogs 0, fish in the brook.
- With the room coming from the soil, the numbers come out small by themselves. The aim is dozens of rabbits
  at most, one or two fox pairs and one hive. If they don't, scale the caps (`SPECIES[s].cap × w.room`) down in
  keeper mode.

### A6. The keepers' hands: pouch, hours, tools (sim.js, game.js, index.html)

**The pouch** (`w.pouch`, shared): seeds by kind.
- Start: 6 hawthorn, 1 oak, 2 birch, 1 apple, a packet of a spring flower and one of a summer flower.
- Income (`pouchSeason`): in autumn each tree old enough gives one of its kind (more in a mast year). Each flower
  patch that bloomed gives a packet as its season ends. Each kind has a cap of 9.
- Built: a packet sows about 22 flowers (`SOW_FLOWERS`), not a made field's thinner 8, since the bees want 60. The
  spade's emoji is ⛏️ (🪏 is too new for most devices).
- Gifts: now and then a bird brings a kind you have none of. The Almanac's lifeline (A8) gives one too.

**Hours** (`w.hours[by]`): each keeper has `HOURS` (about 12) a season, reset on the season's first day. They're
shown as pips by the tools. Alone, you have one keeper's hours. That's part of why two is easier.

| Tool | Does | Costs |
| --- | --- | --- |
| Plant | one tree of a kind from the ring (`plantTree`) | 1 seed, 1 hour |
| Hedge | drag a row of hawthorn, one every 1.5 tiles | 1 seed each, 1 hour per 3 |
| Sow | a flower patch about 3 tiles across; a tap beside one grows it. Comes up when its season next comes round | 1 packet, 1 hour |
| Spade | lower the ground in a soft round brush; below the water line, water stands (`refreshWater`) | 2 hours a stroke |
| Scythe | mow a patch short: food for rabbits and crows, no cover, bad for voles and frogs | 1 hour a patch |
| Look | the inspector, as now | free |

Every tool has a cost in the meadow too:
- Digging kills the grass and any burrow under it.
- Mowing takes cover away.
- A hedge shades the grass it stands on.
- A flower patch is food for the rabbits before the bees.

Sowing is from the old M1: a sown patch is a field like the generated ones (`w.fields`, `fieldAt`, the soil
boost), so `paintTerrain` shows the bloom with no new drawing. The spade is from the old M1 too: a new body of
water gets a name (`nameWaters` for that one body), and `nearBody` is worked out again round it. Water is
refreshed once a stroke, not every frame.

### A7. The Surveyor (sim.js, game.js)

- On the last day of each spring (`surveyDay`, after that day's settling), he counts the settled species that are
  still here against `SURVEY = [0, 0, 1, 2, 4, 5, 6]`, by the year that spring begins. Built so: a kind settles only
  after a year here, so in year 2 he only looks the field over, and the first count is in year 3. On the first day
  of spring, kinds that came the spring before settled a few days too late.
- A season ahead (the first day of winter), the news and a card say: "In spring I'll want to see 4."
- Passed: a short card with his line and next year's number.
- Missed: `w.over = { year, had, wanted }`. The sim stops taking orders, and the end card shows:
  - how many years you lasted, and who came, settled and left (from `w.guests`)
  - the named animals (Yours)
  - three or four lines from the year's news
  - "Again on this field" (same seed) / "A new field" (new seed)
- Passing the last count (year 7's spring, after six full years) wins: the same card, with "Nobody's Meadow is
  somebody's now."

### A8. The Almanac (sim.js, game.js)

Today the weather is rolled one spell at a time (`pickWeather`, as each spell ends), so there's nothing to forecast.

- **A season ahead:** in keeper mode, on each season's first day, the next season is rolled into `w.almanac`
  (its spells of weather, and its trouble if it has one). `weatherTick` takes the next spell from it, not from
  `pickWeather`. It's the same random numbers, just drawn earlier.
- **One trouble a year** at most, none in year 1 (`CALM_YEARS`). Each has real teeth:
  - **Drought** (summer): the water line held low (`waterTick`), heat spells, the grass cap down to
    `DROUGHT_GRASS` (today a heatwave is only ×0.8), flood pools gone early. Dig deeper or lose the frogs.
  - **Flood** (spring): the water line high. Burrows near the brook drown (`floodBurrows`). Don't let them dig there.
  - **Storms** (summer, autumn): storm spells with lightning, fire in long grass (`strike`, `fireTick`). Mow a break.
  - **Hard winter**: more and longer snow, the brook frozen, grass gone. Anything without stores or shelter dies.
  - **Sickness**: a first case at the biggest warren, in a named place. Spread them out, or thin them out.
  - **Fox scouts**: a fox pair comes to a named place whatever the needs say ("scouting the east hedge").
- **Sized to the meadow** (RimWorld): the pick is weighted by a trouble budget from the settled species and the
  soil mended. A meadow doing well gets the hard ones, and a sickness hits where the warren is biggest
  (Pandemic's Intensify).
- **The lifeline:** with the pouch near empty and fewer guests than last year, the next year is gentle (no trouble),
  and a gift seed comes. Never a rescue, just a way back.
- **In the game:** a small almanac card by the clock shows next season's line ("A dry summer is coming") and
  points at the place if there is one. The news repeats it on the season's first day.

### A9. Readable, not helped (game.js, index.html)

- **Lenses:** Soil (mended against potential), Cover, Food (grass and flowers in bloom), Danger (where
  foxes have hunted lately: `w.danger`, a fading grid of kills and chases), Water (damp, spawn). Each is one
  small canvas stretched over the meadow, like `drawHillLight`, rebuilt when its day changes. One at a time, with a
  key or button for each. Skipped entirely when off.
- **The guestbook** (from the old M1): a row per species, here / visiting / not yet / left. Each row shows the
  needs check's `why` and a silhouette with a vague hint for those not yet come ("Something that likes still water
  with long grass by it"). Its headline is the Surveyor's count.
- **Reasons:** every death already has a cause, and frets and leavings bring theirs. The away card is off in
  keeper mode.
- **The guide:** three steps (lay a hedge, sow flowers, open the guestbook), then nothing. `TRIES` is off in keeper mode.

### A10. balance.js: keeper bots

`node balance.js 6 8 keeper [none|lazy|good]` plays through `act` (A1), with the same pouch and hours. It
comes in with A1 and grows with each step, so every sim change is checked against these targets:

- **none** (does nothing): ploughed at the spring of year 2 or 3 on every seed. The field must not fill itself.
- **lazy** (spends its seeds and hours anywhere): ploughed by year 3–4 on most seeds.
- **good** (a script: a hedge by the oak in year 1, flowers of each season near it, a pond by the brook in
  year 2, trees from the pouch, mowing a firebreak before a storm summer, a second hedge before the fox scouts):
  passes year 4 on most seeds and year 6 on a third to a half.
- Boom-and-bust that recovers, as before. On some seeds a species leaves and comes back.
- It prints, per year: soil mended (%), who came, settled, fretted and left, the pouch, hours spent, the trouble,
  and the Surveyor's count.

Done with Milestone A when: the bots hit those targets, and it feels hard but fair to us after five runs each.

---

## Milestone B: two players

### B1. Connecting (game.js, index.html)

- PeerJS (WebRTC, pinned version from cdnjs or jsDelivr), with its free broker. No server of our own, so it
  works from GitHub Pages.
- "Play together" in the ••• menu makes a link, `?field&seed=…#join=<id>`, shared like the meadow's link (a phone's
  share sheet). The one who made it is the host.
- If the connection can't be made (some strict networks), say so plainly. Same room, same Wi-Fi almost always works.
- On join, the host sends `packWorld` (gzipped with `CompressionStream`) and the guest opens it with `unpackWorld`.
  The same path rejoins after a drop.

### B2. Lockstep (sim.js, game.js)

Both screens run the same sim. Only orders and the clock go over the wire.

- **The host keeps the clock.** Every frame it steps as now and sends `{ upTo: tick }`. The guest steps up to
  `upTo` and never past it. It runs a few ticks behind, which nobody sees.
- **Orders:** the guest sends its order to the host. The host stamps it `t = its tick + LEAD` (about 6 ticks)
  and sends it to both. The host's own orders go out the same way. Both apply it at `t` through `act`.
  Nothing else touches the world.
- **Speed:** each player picks one, and the game runs at the slower (the host's sim honours it). Either can pause.
- **Checking:** every day (600 ticks) each side hashes the world (the counts, the creatures' rounded positions,
  a sample of the grids, the pouch) and the guest sends its hash. If they differ, the host sends `packWorld`
  and the guest takes it. Log each one: if it happens often, find out why.
- **Known risk:** the sim never calls `Math.random`, but `Math.sin`, `Math.exp` and `Math.hypot` may differ in the
  last digit between Chrome and Safari, and over thousands of ticks two meadows can drift apart. The check above
  catches it. Test on the same browser first.
- The host keeps the meadow (`keepMeadow`). The guest doesn't.

### B3. Two keepers (sim.js, game.js)

- **The Gardener** plants, sows and lays hedges, and sees the Soil and Food lenses.
- **The Warden** digs, mows and lays hedges, and sees the Cover, Danger and Water lenses.
- Hedges belong to both: the place where the two of you meet.
- The pouch is shared. Hours are each keeper's own (`w.hours[by]`).
- Each picks a role on joining (the host first). Alone, you're both, with one keeper's hours.
- A lens the other has can't be opened. To know where the foxes hunt, ask.

### B4. Presence (game.js)

- The other's hand: their cursor (or finger), sent about 10 times a second, eased between, with their name
  in a small label and their tool in hand. Not part of the sim.
- A ping: hold a key (or a long press with Look) to drop a ring on the meadow that both see for a few seconds,
  with a soft sound. That's how you say "here" without a chat box.
- The news shows who did what: "Axel laid a hedge by the old oak."

Done with Milestone B when: two laptops can play a whole run without a resync that anyone notices.

---

## The test with Dad

- Two runs on the same evening, one laptop each, sitting together the first time, in different rooms the second.
- Watch for:
  - Do you talk? About what? (Silence means the roles aren't needed.)
  - When something left or died, could you both say why?
  - Did the Almanac change what you did?
  - Did one of you run the other's moves?
  - At the end: "again?"
- Note every "I wish I could…".
- It's working if the story you tell afterwards is about the meadow ("the foxes came and we lost the warren"),
  not about the tools.

## Perf

Everything new in the sim is daily (soil, cover, needs, the almanac) or per order. The lenses are a cached canvas
each, like the hill light. The second player costs a few small messages a second. A keeper meadow has far fewer
animals than the meadow you watch, so it should run cheaper. Measure `render` and `step` before and after A2, A3
and B2, as CLAUDE.md asks.

## Later

- **The spring pick:** each spring, choose 1 of 3: a new seed kind, a tool (the log pile, a hive box, a
  controlled burn), or a law with a cost ("Let the hedges grow wild": more cover, but no more mowing).
- **More species**, each with needs the keepers can make and a cost: a heron at the pond (eats frogs), a
  hedgehog (log piles, hedges), deer (eat your saplings), the owls back (a hollow oak and voles), songbirds in
  the hedges, a butterfly per flower kind.
- **Fields to choose:** a wetter one, a stony one, one with an old wood. Different troubles weighted for each.
- **Between runs:** something kept (a seed kind, a named place) as Against the Storm keeps upgrades.
- **Neighbours:** two fields joined by the brook, each played on its own time.
- When Milestone A has tested well: CLAUDE.md, the README and the bare address describe the game as it is.

## Sources

Against the Storm: [Game Developer, Road to IGF 2023](https://www.gamedeveloper.com/road-to-igf-2023/how-against-the-storm-managed-to-mix-city-building-and-roguelite-play).
Frostpunk: [Inven Global, IGC 2018](https://www.invenglobal.com/articles/6528/igc-2018-empathize-with-numbers-the-process-of-frostpunk-scenario-writing),
[DevGAMM](https://devgamm.com/vilnius2022/frostpunk-scenario-process/).
Terra Nil: [Destructoid](https://www.destructoid.com/terra-nil-interview-release-date-trailer/).
Spirit Island: [Wikipedia](https://en.wikipedia.org/wiki/Spirit_Island_(board_game)).
RimWorld: [raid points](https://rimworldwiki.com/wiki/Raid_point).
Viva Piñata: [Wikipedia](https://en.wikipedia.org/wiki/Viva_Pi%C3%B1ata_(video_game)).
Timberborn: [drought](https://timberborn.wiki.gg/wiki/Drought).
Eco: [Wikipedia](https://en.wikipedia.org/wiki/Eco_(2018_video_game)).
Reus: [Abbey Games](https://abbeygames.com/blog/2012/07/04/putting-god-back-into-god-games/).
Pandemic: [Wikipedia](https://en.wikipedia.org/wiki/Pandemic_(board_game)), [the alpha player](https://coopgestalt.com/2016/06/07/the-alpha-player-problem/).
Into the Breach: [Giant Bomb](https://www.giantbomb.com/into-the-breach/3030-58234/user-reviews/2200-31048/).
LeBlanc: [workshop handout](https://www.8kindsoffun.com/algorithmancy/Workshop/2009/Handout.pdf).
Sylvester: [Stanford GDT](https://gdt.stanford.edu/how-do-you-create-apophenia/).
Mini Metro: [Game Developer](https://www.gamedeveloper.com/design/let-s-talk-about-mini-metro).
Oxygen Not Included: [Game Developer](https://gamedeveloper.com/design/behind-the-design-of-hit-sim-game-i-oxygen-not-included-i-).
Dorfromantik: [Wikipedia](https://en.wikipedia.org/wiki/Dorfromantik).
Equilinox: [press kit](https://www.indiedb.com/games/equilinox/presskit).
Keep Talking: [GDC Vault](https://gdcvault.com/play/1023113/Designing-Asymmetric-Gameplay-For-Keep).
Asymmetric co-op: [Waterloo Touchlab](https://uwaterloo.ca/touchlab/references/leveraging-asymmetries-multiplayer-games-investigating).
