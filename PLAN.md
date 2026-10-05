# Plan: make a home, see who moves in

Agreed 2026-10-05. Replaces "from watching to keeping" (git da3c9e0), whose naming and planting
are built; its whistle and clap are dropped, and its "no currencies" rule is reversed.

The meadow stops being something you watch and becomes something you make. You inherit a worn-out
field: the sheep have gone, the turf is grazed short, a stream runs along one side, there's one old
oak and a stub of hedge, and nobody lives here but a few crows. You never place an animal. You shape
the land, and each species decides for itself whether to come and whether to stay. The name becomes
the premise: it's nobody's meadow until you make it somebody's.

Three rules, agreed:

- **Animals arrive, never get placed.** Each species has a short list of what it needs. When the
  meadow has it, a few come in from the edge. Whether they stay is up to the sim.
- **A budget, paid by the meadow.** Seeds come from what grows: each autumn your trees and flower
  patches fill your pouch. A livelier meadow lets you do more.
- **It can go wrong.** Species leave when the place stops suiting them. Fire, floods and hungry
  rabbits undo your work. That's why coming back matters.

Played well: every session ends with something half grown, and you come back to see who showed up.

## M1: is it fun?

The smallest version that answers that. Each step below is its own commit. Run `balance.js` after
every sim step.

### 1. The worn field (sim.js)

A new start for createWorld (option `field`), with its numbers in `TERRAIN` and sliders in the lab:

- Keep the hills. No lake. One stream along one side (a brook, running off the map both ends).
- No generated forest or flower fields. One old oak (it has the hive hollow: `placeHive` takes it)
  and a short stub of hawthorn hedge near it.
- Turf grazed short (`w.grass` starts low; the soil is as before, so it grows back).
- No burrows. Animals: a few crows (the oak is their roost), nothing else. Voles 0, frogs 0.
- `KEEP_VERSION` 8: every kept meadow starts over.

The old generated meadow stays reachable at `?wild` (for the terrain lab and balance comparisons),
not in any menu.

### 2. Who comes, and why (sim.js)

`migrate` already brings species back on conditions (foxes need rabbits, bees need flowers). It
becomes the rule for everyone: `WANTS`, one small check per species, run once a day. Met for a few
days running, a few arrive from the nearest edge and head for the spot that suits them.

| Who | Wants | How they come |
| --- | --- | --- |
| Crows | a tall tree to roost in, open ground with grubs | already here at the start |
| Voles | long grass over an area | spill in from the edge where it's long (a field, like now) |
| Rabbits | cover (a hedge or scrub) by dry ground they can dig | the family walk-in (`familyArrives`), heading for the cover |
| Bees | flowers open within reach of a free hollow | a swarm to the old oak (`migrate`'s bee case) |
| Frogs | still shallow water in spring | a few frogs come up the stream to it, then spawn |
| Foxes | enough rabbits | as now (`60 × w.room`) |

Owls stay off (`OWLS = false`) for M1. They come back in M2 as a long goal: a free hollow oak and voles.

New events: `arrive` (exists), `settle` (a species bred here and has lasted a year), `leave`
(the last one gone). `w.guests` keeps, per species, when it first came, when it settled and when it
left. A species can leave and come back, and the guestbook remembers both.

### 3. The pouch (sim.js, game.js)

- `w.pouch`: seeds by kind. Tree kinds as in `TREES`, flower kinds as in `FIELD_KINDS`.
- **Start:** 4 hawthorn, 1 oak, 2 birch, 1 apple, a packet each of a spring and a summer flower.
- **Income:** in autumn (`seedFall`) each tree old enough to seed gives you one of its kind (more in a
  mast year), and each flower patch that bloomed this year gives a packet of its kind. Each kind tops
  out at a cap (around 9) so nothing piles up.
- **Gifts:** now and then a bird or the wind brings a seed of a kind you have none of ("A jay dropped
  a cherry stone by the hedge"). That's how new kinds get in.
- **Costs:** a tree is one seed, a flower patch one packet. The spade is free in M1 (see Calls).
- The harvest is news, and heads the away card in autumn.

### 4. Plant and Sow (game.js, sim.js)

- **Plant** (the tool there is now): a tap plants one tree of the kind picked in the ring, a drag
  plants a row, about one every 1.5 tiles: a row of hawthorn is a hedge. The ring shows how many of
  each kind you have, and an empty kind is greyed out. `plantTree` as now, one seed each.
- **Sow** (new): pick a flower kind, tap to sow a patch (about 3 tiles across). A tap next to a patch
  of the same kind grows that patch. A sown patch is a field like the generated ones (`w.fields`,
  `fieldAt`, its flowers in `w.plants` and `plantCells`, the soil boost), but it comes up only the
  next time its season comes round. Waiting for that is part of the game. `paintTerrain` already
  reads `fieldAt`, so the bloom shows without new drawing.

### 5. The spade (sim.js, game.js)

- Drag to dig: it lowers `w.ground` in a soft round brush. Where the ground drops below the water
  line, water stands (`refreshWater`, `waterVersion`, and the height reaches the shader through
  `updateWater`). So ponds go in the low ground by the stream. Up the slope you have to dig deep,
  which takes many strokes.
- A new body of water gets a name (`nameWaters` for that body only), and `nearBody` is worked out
  again round it.
- Digging kills the grass and any burrow under it. Water refreshes once per stroke, not per frame.

### 6. The guestbook (game.js, index.html)

A card in the ••• menu and next to the tools, like the food web. One row per species:

- **Lives here** (it settled): how many, since when.
- **Visited** (it came but didn't settle, or left): when, and why it went if we know.
- **Not yet:** a silhouette and a hint ("Something that likes still water with reeds round it").

Its headline is the score: "4 species call this meadow home." It updates only when an event
changes it. "Yours" (named animals) stays as it is.

### 7. First arrivals, the guide, the cuts (game.js, index.html)

- **First arrival:** the first time a species comes, the camera glides to it at 1x with the intro's
  letterbox bars and a caption ("Frogs found your pond"), then hands back. Any key, click or scroll
  skips it. Away when it happened? The away card leads with it and offers a "Go see".
- **Intro:** the worn field at dawn, the crows on the old oak, a caption: "Nobody has lived here for
  years." It ends on the guide.
- **Guide:** three steps (plant a hedge, sow flowers, open the guestbook), then the guestbook's hints
  take over. `TRIES` goes.
- **Away card:** arrivals, settlings and leavings first, then the harvest, then the rest.
- **Cut:** the release tools (rabbit, fox, bee, crow, owl), ⚡ Zap, 🔥 Fire, 🌱 Grass, and picking the
  weather (the sky button shows the forecast; storms still bring lightning and fire).
- **Kept:** Look, picking an animal up, naming and Yours, the inspector, news, graphs, the food web,
  filming itself, sound.

### 8. balance.js: a keeper mode

`node balance.js [years] [seeds] keeper` plays a scripted keeper: a hedge in year 1, a flower patch
of each season by the oak, a pond by the stream, then a few trees a year from the pouch. Targets:

- **Untouched**, after 5 years: crows and voles at most. It must not fill itself, or there's no game.
- **Kept**: rabbits, bees, frogs and foxes have all come by the end of year 2, and all but one have
  settled by year 4.
- Boom-and-bust that recovers, as before. On some seeds a species leaves and comes back.
- The pouch lets the keeper do about that much and not much more: running short now and then is right.

## The test

Play it a week as a keeper and note every "I wish I could…". Then three to five people, alone, a
week. Ask: What did you make? Who came? Did you open it unprompted, and why? It's working if
someone tells you who moved in before they tell you what they did.

## Calls made (easy to flip)

- The spade is free in M1. If people dig lakes everywhere, it joins the budget.
- Picking the weather goes: you shape the land, not the sky.
- Picking animals up stays for now, though it bends "never touch the animals". Revisit after playtests.
- The old full meadow lives on at `?wild`, unlisted.

## Later

- **M2, depth:** the scythe (mow short: good for rabbits and crows, bad for voles and frogs), a log
  pile, a stone pile, a hive box and an owl box, a controlled burn, owls back, and the first new
  species: a heron at the pond (eats frogs), a hedgehog (log piles, hedges), deer (eat your saplings).
- **M3, the long arc:** rare visitors, a gift on a species' first arrival, naming the places you made,
  more species (ducks, a kingfisher, songbirds in the hedges, a butterfly per flower kind, dragonflies).
- When M1 lands, CLAUDE.md and the README describe the game as it is now.
