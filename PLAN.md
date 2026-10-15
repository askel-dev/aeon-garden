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

## Stage 1: things on the ground
Sticks, pebbles, dry grass and birch bark lie about to pick up, like the finds (same walk-over-and-pick, into the
satchel), but they don't glint like food. Sticks are the commonest, and more fall in wind and storms (sim has both).
Pebbles on shores and fords and by the painted rocks; dry grass on long ungrazed grass in summer and autumn (some all
year, so the first fire is always possible); birch bark under birches and on fallen birch logs. Each goes into
`recipes.js` as an ingredient with a tag (`'tinder'` for dry grass and birch bark, `'fuel'` for sticks), painted in the
meadow's soft style, with a small satchel icon. Later, not now: clay, reeds, flint, logs and firewood, feathers, pine
cones, tinder fungus.

## Stage 2: warmth (world and body), wet, and stamina
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

## Stage 5: making camp
Lighting the first fire makes camp (`w.camp`: where, and the fire), and it's a big moment: the flame flares, warm light
blooms out over the clearing, a burst of sparks and embers, a short warm flourish in the felt-piano scale, the camera
eases in a little, and a few elegant words fade in and out ("Your camp") in the style of the old season and year
announcements (the daybreak lines: `showBreak`, `#daybreak` in main at 1d79f03: italic serif heading, small caption, a
soft fade and rise). The phone vibrates (`navigator.vibrate`: Android only; iPhone web can't, so sound and light there).
From then on a soft camp ring around the fire, inside which later builds are arranged (a seat log, a spit, a drying
rack, the pot, a basket, a lantern, a bedroll).

## After that
Cooking at the fire (a small card by it, reading recipes.js, "New recipe!"), hunger and eating, camp builds, fishing and
hunting, the visitors as NPCs who trade recipes for food, cooking levels.

## Open notes from the last pass
- Crows were wiped out once (seed 2, year 3: foxes killed 14 in a day); they come back, but worth a look.
- Spring honey keep is 24; 30 would be safer with a greedy forager.
- The start spot can put the forager behind a tree crown (trees in front now fade, which may cover it); camp makes the
  start spot matter more, so pick an open one.
- Satchel icons for elder and strawberries are the whole plant; small item paintings would read better.
