# Fishing (PLAN.md stage 10)

Step 1, the plain catch and the bar, built 2026-10-21. The look and the sounds are placeholders till step 2.

## game.js

The rod is a make at the make strip (recipes.js `BUILDS.rod`: 2 sticks and a rope, `makes: 'rod'`). It isn't an
ingredient but a thing the forager carries (recipes.js `CARRIED`), so `makeThing` sets `f.rod` instead of filling a slot,
and `carriedMade` keeps it off the strip once it's made. A guest makes its own (`arrive` sets it back to 0; `keepAwayBag`
and `awayBack` keep one made on the visit). `garden.give('rod')` hands one over in dev.

The comment over `CAST_REACH` tells the whole catch. In short: a tap on water that lasts (sim.js `fishRoom`, not a flood
pool) within `CAST_FROM`, from the bank or wading in the shallows (`canFish`, `bankNear`), casts as far as `CAST_REACH`
goes that way (`castAt`, `castTo`). R casts the way it faces, or at the nearest water, and pulls the line in again
(`castKey`). The float drifts a little down the current. `biteWait` is the fish in the 5x5 about the float
(`BITE_THICK` of them bite in about `BITE_S` seconds; fewer than `BITE_LEAST`, nothing bites and after `NOTHING_S` it says
so), quicker at dawn and dusk and in rain, slower at night and in the middle of a summer's day (`biteHour`). A nibble or two
come first. Then the bite: the float goes under, a "!", and `HOOK_MS` to strike, by a tap near (`fishPress`), Space or E
(`fishKey`, `strike`). A strike before the bite pulls the line in ("Too soon" if it just nibbled). A bite missed lets the
float back up for the next one.

The bar (index.html `#reel`, `reelShow`, `reelFrame`, `renderReel`) is placed once beside the forager, on the side away
from the float and clear of the satchel. Each frame its fish, zone and meter move by a transform alone. While it's up,
`#reel-hold` covers the screen, so a hold anywhere lifts the zone (or Space; the press that struck counts if it's still
held). The zone has a little weight (`REEL_LIFT`, `REEL_FALL`, `REEL_TOP`, `REEL_BOUNCE`). The meter starts at
`REEL_START`, fills at `REEL_FILL` while the fish is in the zone and drains at `REEL_DRAIN` while it's out. Full, the fish
is landed (`landFish`): `S.takeFish` takes it from the water about the float, and it flies into the satchel, with its
first-find headline the first time. Empty, "It got away". Walking off, a jump, a fire, a collapse or a dish in hand pull
the line in (`fishFrame`), and a fish on the line is lost. Everything runs on `angle.t`, which stops while the meadow is
paused.

Which fish bites is picked at the bite (`fishKind`) from recipes.js `FISH`: the water (`still`, `current`: sim.js
`w.current` moving, `any`), `deep`, the `seasons`, `night`, `dawn` and `odds`. How it moves in the bar is in the same
block: `dart`, `pull`, `idle`, `low` (the lowest it goes, above a zone lying at the foot, so a fish left alone never
lands), `sink` (an eel's pull on the zone: a long hold) and `wriggle`. `garden.fishNow('eel')` makes a bite come now in dev.

The line over the satchel says "Fish here" on a good bank, then what to do (`fishSaid`). The forager faces the float and
doesn't turn to you or idle while the line is out. `drawFishing` draws the rod (one stroke), the line (one stroke, sagging
while it waits, taut while it's brought in), the float (a few fills, bobbing, dipping on a nibble) and rings, and only
while fishing.

The four fish are ingredients tagged `fish` (emoji for now), with their own section in the book's Finds.

## sim.js

`f.rod` is in the forager's blank (`foragerOf`), so a kept meadow from before gets 0. No `KEEP_VERSION` bump. `takeFish`
and `fishRoom` are exported. The forager and the otters share one stock of fish. Over two years and three seeds, a forager
taking 10 fish a day from the thickest water left both the fish and the otters going.

## Step 2, the look and sound (started 2026-10-22, not finished)

Built: the four fish painted in items.js (`paintRoach`, `paintPerch`, `paintTrout`, `paintEel` on `spinePath` / `fishBody`:
a body along a spine, shaded across it so the eel's S bends right). The forager's fishing paintings in fur.js
(`FORAGER_FISH`: hold, wind, reel, blink in each view; `fishArt`, `fishHold`), asked ahead by `foragerAhead` once it has a rod
by the water. game.js: `anglePose`, `drawRod` (two sticks lashed, a few strokes, whipped forward on the cast, bent by the
fish, foreshortened from the front and behind, drawn behind it facing away), `quillArt` / `drawFloat` (a red-tipped quill
painted once, under what stands), `drawFishing` (the line, the float flying out), `landing` / `drawLanding` (the fish flies
onto the bank and flops before it goes into the satchel), `riseFrame` / `drawRises` (rings where the water's thick, only
with a rod). sound.js `angle` (cast, float, nibble, bite, click, creak, land, away; in sound-lab). index.html `#reel`
painted: brass-rimmed water gauge, glassy zone, brass meter, a reel knob that turns with the zone.
forager-lab.html has a row of the fishing poses (hold, wind, reel, blink in each view), with a plain stroke from the grip
(`fishHold`) standing in for game.js's rod. The bar was looked at on a phone upright (375x812: beside the forager, clear of
the HUD and the satchel) and on its side (844x390: `REEL` clamps it to 150 px tall, between the HUD and the satchel).
Left: a sit on the bank after a long wait (`SIT_FISH`: it wants a sitting-with-the-rod painting in fur.js, not the kneel's
sit), the camera easing in while reeling (open), and Axel's look at all of it.

## Step 3, the skill (built 2026-10-22)

`SKILLS.fishing` in sim.js (`per: 3`: level 1 at 3 fish, level 3 at 18, the top at 165). A fish landed is 1 practice
(`landFish`, once it's taken from the water: a full satchel's let-go doesn't count), one that gets away in the bar
`FISH_MISS_PRACTICE` (a missed strike or walking off counts nothing). Its perks: `zone` (the catch zone 4% taller a level,
`reelZone`) and `calm` (the meter drains 5% slower a level, in `reelFrame`). From `PRIZE_FROM` (3) a fish with `prize: true`
in recipes.js `FISH` (perch, trout) has its odds raised by `PRIZE_MORE` a level (`fishKind`). As the zone grows, the fish's
floor rises with it (`REEL_ABOVE` over the zone's top lying at the foot), so a fish left alone still never lands.

Why 4% and not the plan's 6%: with bots over the bar (a lazy one that only holds, keeping the zone pinned at the top), at
6% that lazy hold lands every fish at level 10, as the raised floor puts the whole of the fish's range under the zone;
at 4% it lands 66-97% and steering still pays. A careful player lands every kind at level 0 in 3-4 s already, so the skill
mostly makes it quicker and more forgiving. The bar's own numbers are still to tune by hand with Axel.

The book (You) shows it with the others: `SKILL_SAYS`, `SKILL_HOW`, `SKILL_INK` (teal), `SKILL_UNIT` ("6 fish to 2"),
`PERK_WORDS`, `XP_SHOWN` (+10 a fish), and `SKILL_OPENS`, which marks level 3's "more perch and trout" on the road of coins
(cooking's vessels went through the same table).

## Step 4, the dishes (built 2026-10-22)

Six in recipes.js after the forest stew, each painted in dishes.js: Roast fish on a stick (stick, any fish, `known`), Trout
with wild garlic (pan), Fish and sorrel on a hot stone (stone, any fish), Fish soup (pot: fish, fish, nettle, any greens),
Eel and mushroom stew (pot: eel, mushroom, mushroom, any greens) and Dried fish and hazelnuts (bowl, cold, eaten from the
hand). The soup and the stew take any greens where the plan had watercress and garlic: watercress is late autumn and winter
and garlic spring, while the fish are spring to autumn and the eel summer nights, so the plan's ones could hardly meet. The
dishes all paint their fish with one `cookedFishAt` (browned, blistered, scorched across, the eye gone white; `FISHC_*` are
its looks, `FISHC_DRIED` split and dried stiff). Perch and trout dry on the rack (`dries: 'driedfish'`): Dried fish is tagged
`fish` and `dried`, so any-fish dishes take it too, and `checkRecipes` doesn't want a `FISH` block for it. Its satchel
painting is items.js `paintDriedFish` (two, tied at the tails). A pot with fish in it turns its broth pale gold (game.js
`BROTHS.fish`).

## Step 5, friends (built 2026-10-22)

Each change of the line goes to friends as a `'line'` message (`sendLine`: cast, wait, nib, bite, reel, in, away, land; where
the float is, which way the forager faces). A friend's line is a `lineOf()` on its peer (`p.line`), heard by `heardLine` and
run on our clock by `peerLineFrame`; `drawRod`, `drawFloat`, `drawFishing` and `anglePose` take it in place of `angle`, so it's
drawn just as ours is, its pose from `fishArt`. Its fish's pull isn't sent: its bar is a steady tug. A `'land'` carries the
tick and the tile, and `applyNet` takes the fish out of the water on that tick (through `net.later` as a pick is), so the
otters and both anglers keep sharing one stock (checked with two tabs: the pool's count came out the same on both sides). Its
fish flops on its bank (`peerLandings`, four at most).
