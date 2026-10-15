# Plan: the first fire

Agreed with Axel on 2026-10-15. Build prompts for other sessions point here; each stage is its own branch and its own
commits, played and checked before the next. Read CLAUDE.md first (its perf rules are hard rules).

## Where we are
A cozy cooking game: a little hooded forager walks a painted meadow (click or tap to walk, hold to sprint), gathers
what the meadow gives into a satchel (mushrooms, greens, brambles, fruit and mast trees, hives, and the wild finds:
dandelion, sorrel, strawberry, elder, hazel, rosehip, watercress), and will cook with `recipes.js`. Pickables glint, the
forager's sense makes them glint when it stands still, and an edge marker points to the nearest. The pocket watch is gone.

## The feeling we want
A balance of cozy and survival, like Raft: you can die fairly easily, but it's still cozy. Cold nights are the reason
for a fire; the fire is the safest, warmest place in the world. The UI stays small: Axel wants to see the meadow, not
big cards.

## Stage 1: things on the ground (built 2026-10-15)
Sticks, pebbles, dry grass and birch bark lie about to pick up, like the finds (same walk-over-and-pick, into the
satchel), but they don't glint like food. Sticks are the commonest, and more fall in wind and storms (sim has both).
Pebbles on shores and fords and by the painted rocks; dry grass on long ungrazed grass in summer and autumn (some all
year, so the first fire is always possible); birch bark under birches and on fallen birch logs. Each goes into
`recipes.js` as an ingredient with a tag (`'tinder'` for dry grass and birch bark, `'fuel'` for sticks), painted in the
meadow's soft style, with a small satchel icon. Later, not now: clay, reeds, flint, logs and firewood, feathers, pine
cones, tinder fungus.

## Stage 2: warmth (world and body), wet, and stamina (built 2026-10-15, branch `warmth`)
No fire yet, so until stage 4 every winter night kills and a wet spring night often does. Warm dishes, shelter and
clothes are still to come; the fire goes into `bodyTick`'s feel (and dries you).
- **World temperature** from the season, the time of day (nights cold, coldest just before dawn), the weather (rain and
  wind chill you) and snow lying. Mostly reading what the sim already has.
- **Body warmth** (`w.forager.warmth`), cosy to freezing. Cools: night, winter, wind, rain, being wet, standing still in
  the cold. Warms: near a fire (strongest close up), daytime sun, warm dishes (`warm: true` in recipes.js, later), and
  later shelter, a bedroll, clothes.
- **Wet** (`w.forager.wet`): rain and wading wet you, a fire dries you; wet loses warmth much faster.
- **Stamina** (`w.forager.stamina`): sprinting uses it, walking and resting bring it back; cold lowers how fast it comes
  back. Out of stamina, no sprint.
- **Stages, shown on the forager first:** cosy (nothing); chilly (breath puffs at night, a shiver now and then); cold
  (walks slower, hunched, shivering); freezing (stumbles, frost creeping in at the screen edges, a slow soft heartbeat);
  hypothermia (collapses).
- **UI:** the forager's look carries most of it, plus a minimal bar or two at the bottom by the satchel (warmth,
  stamina), slim, and shown only when not full. No big gauge.
- **Death:** the forager collapses and wakes at camp (or where it started, before there's a camp) having lost what was
  in the satchel. No game over.
- **Balance aim:** a normal night by a fed fire is fine; a night away from one is dangerous; a winter night without one
  kills you. Hunger comes later, after warmth.

### Stage 2 polish (2026-10-15, after Axel played it)
- **Shiver calmer:** smaller, eased in and out, a sway of the upper body about its planted feet rather than the whole
  forager jittering side to side. Chilly a short "brr" now and then, cold more often, freezing a faint steady tremble.
- **Sad when cold:** new paintings (fur.js `FORAGER_COLD`: poses 5, 6, 7 and 24 to 31) from cold down: brows up in the
  middle, a little frown, paler cheeks, a red nose, the head sunk into its shoulders.
- **Hugging itself:** in those paintings its arms wrap round it, standing and walking (the sprint still pumps its arms).
- **No blinking once down:** collapsed it lies with its eyes shut (pose 7), not its standing blink.
- **Breath from the mouth:** the puffs started half a body too high (over the hood); start them at the mouth, drifting
  the way it faces (three-quarter views too) and rising a little.
- **Sounds:** a soft "brr" with each shiver, a shaky cold sigh now and then with the breath when cold, and a gentle
  waking tune at home after a collapse. All in sound-lab.html.
- Keep the sprite cache in check: the cold paintings are asked for only once it's chilly, and the sprite cache keeps
  only the set in use (warm or cold) at the forager's size.

## Stage 3: the storm opening
A new meadow opens in a storm, late in the afternoon. The forager arrives cold and wet, the light is going, and a
short line says something like "It's freezing. I need a fire before dark." Warmth is already dropping, slowly enough to
gather, not to sightsee. The storm blows over in the first evening; the first night is clear and cold, spent by the
fire you made. (Today a new meadow opens on day 4 of spring: keep the season, change the hour and the weather.)

## Stage 4: the campfire
- **Building:** about 6 pebbles, 5 sticks and a handful of tinder. Choose a spot near the forager; it kneels and lays
  the ring and the sticks. (What builds cost goes in data, recipes.js-style, so Axel can add builds by hand later.)
- **Lighting:** the forager always has a flint and steel (never shown as an item). It strikes: a soft "chk chk" and
  little sparks. Then hold (finger or mouse) to blow: the ember glows brighter while you hold, smoke curls up; let go
  when it catches and the flame takes. Let go too soon and it only smokes: try again. Rain makes it take longer. Never
  a hard fail. Keep it simple, don't overthink it.
- **Fuel:** sticks feed it. A fed fire burns a good while, burning low shows as smaller flames and a dimmer glow; out,
  it leaves embers for a while (a quick blow relights them), then goes cold (strike again). Some pressure, balanced later.
- **Light:** the visual heart. At night the meadow is a cold navy; the fire makes a warm, flickering pool of light, the
  forager and nearby trees lit warm on the fire's side, embers drifting up. One cached light, cut through the night's
  wash (`skyWash`/`laySky`), repainted only on a flicker step.
- **Warmth:** the fire is stage 2's strongest warmth, and dries you.
- **The first one** gets a gold headline (game.js `firstTime('fire', 'your first', 'Fire')`), as the first dish will.

## Stage 5: making camp
Lighting the first fire makes camp (`w.camp`: where, and the fire), and it's a big moment: the flame flares, warm light
blooms out over the clearing, a burst of sparks and embers, a short warm flourish in the felt-piano scale, the camera
eases in a little, and a few elegant words fade in and out ("Your camp") in the style of the old season and year
announcements (the daybreak lines: `showBreak`, `#daybreak` in main at 1d79f03: italic serif heading, small caption, a
soft fade and rise). The phone vibrates (`navigator.vibrate`: Android only; iPhone web can't, so sound and light there).
From then on a soft camp ring around the fire, inside which later builds are arranged (a seat log, a spit, a drying
rack, the pot, a basket, a lantern, a bedroll).

## After that (roughly in this order)
1. **Cooking at the fire.** Click the fire: a small card opens beside it (not a full-screen panel). Put up to 3 things
   in from the satchel, cook (a short cook with steam and a sizzle), and the dish lands in the satchel. It reads
   recipes.js; anything else makes a forager's mess; a dish never made before gets a small warm "New recipe!" moment and
   is remembered.
2. **Hunger and eating.** A gentle tummy that empties over a day; dishes fill far more than raw things, and warm dishes
   warm you. Goes in with the other slim bars.
3. **Camp builds.** Arranged inside the camp ring: a seat log, a spit, a drying rack (keeping food for winter), a basket
   for storage, a lantern, a bedroll or lean-to. What each costs is data, recipes.js-style, so Axel can add builds by
   hand. More ground items come in as builds need them (clay, reeds, flint, logs, pine cones, tinder fungus, feathers).
4. **Fishing and hunting.** Fish from the water the sim already stocks (`w.fish`), and hunting the rabbits and the game
   (the gentle respawn keeps them from running out). Visitor NPCs are never hunted.
5. **The visitors come back as NPCs.** The hedgehog, heron, kingfisher, dragonflies and skylark (their lives and
   paintings are still in the code, dormant: they only ever came to the keeper's places). They need a new way in, e.g.
   drawn by food left out at camp. You feed them, and they thank you with recipes in cute little dialogues (the hedgehog
   trades its nettle soup for a bowl of something; recipes.js `from`).
6. **The kitchen ladder.** Stations beyond the fire: the clay pot (stews and soups, 4 slots), the drying rack, a stone
   hearth (two things at once), a skep for your own bees (the sim's swarm hook in `hangOut`), the clay oven (bread, pies,
   honey cakes), a smokehouse or cellar for winter. recipes.js `STATIONS` already has fire, pot and oven.
7. **Cooking levels.** Cooking raises your level; a level raises quality (stars, less burning, bigger servings) and
   opens new stations, rather than handing out recipes one by one (recipes.js `level`). Recipes are still mostly found by
   trying, and some are taught by visitors.
8. **Winter as the gentle pressure.** Cold, short days, little to forage: what you dried and kept carries you through.

## Open notes from the last pass
- Crows were wiped out once (seed 2, year 3: foxes killed 14 in a day); they come back, but worth a look.
- Spring honey keep is 24; 30 would be safer with a greedy forager.
- The start spot can put the forager behind a tree crown (trees in front now fade, which may cover it); camp makes the
  start spot matter more, so pick an open one.
- Satchel icons for elder and strawberries are the whole plant; small item paintings would read better.
