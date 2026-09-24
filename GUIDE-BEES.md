# Bees 🐝: how they work, and where to go deeper

## Where everything lives

**sim.js**, section `// ---- bees`. Everything a bee does is in there:

| What | Where |
| --- | --- |
| The numbers to tune | the constants at the top (`NECTAR`, `HONEY`, `WINTER_HONEY`, `FORAGE_RANGE`, ...) |
| The body (energy, speed, sight, lifespan, litters) | `SPECIES.bee` near the top of sim.js |
| The brain | `beeTick`: one line per rung of the ladder (danger > home > love > food > wander) |
| Each rung | `beeHome`, `beeForage`, `beeWander` (love is shared with everyone: `seekLove`) |
| Flying | `fly`, and `go` (walks or flies, depending on `flies: true` in SPECIES) |
| Hives | `makeHive`, `placeHive`, `nearestHive`. A hive is `{ id, x, y, honey, bees }` in `w.hives` |
| Colony-level things | `hivesTick`, runs every 60 ticks: counts open flowers and each hive's bees |
| When young are raised | `broodTime`: only with `WINTER_HONEY` honey put by for every bee |
| What the inspector says | `beeMood` |
| Swarms moving into an empty hive | `migrate` (bottom of sim.js) |

**game.js**:

| What | Where |
| --- | --- |
| Bee size, facing | `LOOKS` (search for `const LOOKS`) |
| Hovering and bobbing | `liftOf` |
| The hive (a hollow in a giant old tree) | `drawBeeTree`, `trunkSprite` (section `// ---- hives`) |
| News about bees | search `bee:` in `handleEvent`, and `NEWSWORTHY` |

## Rules of thumb

- A new behaviour is a new rung in `beeTick`, or a line in one rung. If it needs a paragraph to explain, split it.
- Something the whole colony does (not one bee) goes in `hivesTick`.
- A new thing a hive knows (pollen, wax, a queen) goes in the object in `makeHive`.
- After any change: `node balance.js 6 4`. Rows read `rabbits/foxes/bees`. You want bees that rise and
  crash and come back, in most meadows, without swarms having to rescue them every year.
- Hover the hive in the game to see its bees and honey.

## Ideas for going deep (roughly easiest first)

1. **Waggle dance**: a bee that found a good flower patch remembers it (`c.patch = { x, y }`), and bees
   leaving the hive go to a patch a sister found instead of searching at random.
2. **Pollen and nectar**: flowers give both; honey feeds adults, pollen is what young need (brood).
3. **A queen**: only she lays eggs, from honey and pollen, in `hivesTick`. Workers stop using `seekLove`.
   Without a queen the hive slowly dies out. This is the big one: it turns bees into a colony.
4. **Swarming**: a crowded hive with lots of honey splits in late spring. Half the bees fly off with the old
   queen and `makeHive` a new one by another tree.
5. **Enemies**: a honey badger or bear that raids full hives, or birds that snap bees mid-air.
6. **Bees vs foxes**: bees sting a fox that comes too close to the hive, and it runs (`frighten`).
7. **Flower colours**: bees prefer one colour, and the flowers they visit spread more (evolution!).

## When you're stuck

Paste into Gemini: the red error from the browser console (Cmd+Option+J), the function it points at,
and one sentence about what you wanted. Ask it to keep the change small and match the existing style.
