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
by the water. game.js: `anglePose`, `drawRod` (whipped forward on the cast, bent by the fish, foreshortened from the front and
behind, drawn behind it facing away; painted by `paintRod`, see "The rod's look" below), `quillArt` / `drawFloat` (a red-tipped quill
painted once, under what stands), `drawFishing` (the line, the float flying out), `landing` / `drawLanding` (the fish flies
onto the bank and flops before it goes into the satchel), `riseFrame` / `drawRises` (rings where the water's thick, only
with a rod). sound.js `angle` (cast, float, nibble, bite, click, creak, land, away; in sound-lab). index.html `#reel`
painted: brass-rimmed water gauge, glassy zone, brass meter, a reel knob that turns with the zone.
forager-lab.html has a row of the fishing poses (hold, wind, reel, blink in each view), with a plain stroke from the grip
(`fishHold`) standing in for game.js's rod. The bar was looked at on a phone upright (375x812: beside the forager, clear of
the HUD and the satchel) and on its side (844x390: `REEL` clamps it to 150 px tall, between the HUD and the satchel).
The sit on the bank and the camera came later (see "Refined" below).

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

## Refined, for fun (2026-10-22)

Played with a model of the bar (`reelFrame` copied into node, bots with a reaction lag, thinking now and then, aiming
off where they saw the fish). Before: every kind landed in 3.5 to 6 s, the meter hardly dipped below where it starts, and
a trout fought like a roach. So the fight got a shape and each catch a size:
- **It tires.** A fresh fish darts further, quicker and with shorter rests than one nearly in (`REEL_FRESH` to
  `REEL_TIRED`, by the meter).
- **A last run.** Once the meter's past `REEL_RUN_AT`, a fish with a FISH `run` (trout always, perch and eel sometimes)
  makes one hard run away from the zone (`REEL_RUN_DASH`): a splash, the line creaks, a buzz, the gauge jolts (index.html
  `#reel.run`). It drops an ok player's meter by about 0.1 and almost never loses the fish: a scare, not a fail.
- **Sizes.** At the strike a fish gets a size, 0 to 1, a random number to `FISH_SKEW` (most are small), "A big one!" from
  `FISH_BIG` (about one in six). A big one fights harder (`REEL_SMALL` to `REEL_BIG`), looks bigger in the bar and glints
  (`#reel.big`). Landed, it's weighed by FISH `grams` ("Roach, 150 g", `fishGrams`, `gramsSaid`), and the biggest of each
  kind is kept in sim.js `f.fishBest` (in the forager's blank: a kept meadow from before gets `{}`) and shown on its Finds
  page ("Biggest 1.2 kg"); a new biggest says so.
- **A perfect catch.** In the zone from its first touch to landed (`reel.touched`, `slipped`): "Perfect catch!" and
  `FISH_PERFECT_PRACTICE` more practice.
- **Worried.** The meter under `REEL_LOW` with the fish out goes ember-red and pulses (`#reel.low`).
- **Buzzes** on a bite, a last run and a landing (`BUZZ_BITE`, `BUZZ_RUN`, `BUZZ_LAND`: Android; an iPhone only from a tap).

The bots now, at level 0 (sharp / ok / sloppy / first try): roach 3.5 / 5 / 12 / 16 s, landing 100 / 100 / 100 / 88%;
trout 6 / 8 / 15 / 20 s, 100 / 100 / 94 / 78%. Level 5 lands everything for all of them. The eel's character is its sink
(a long hold) and wriggles more than its time.

**The sit.** After `SIT_S` of waiting on dry ground (not wading: `angle.dry`) it sits down on the bank, side on whichever
way the water is (fur.js `FISH_SIT`, view 3 of the fishing paintings: `FORAGER_FISH_SIT` sit, a blink, a doze, a start),
the knees drawn up and the rod across them. After `DOZE_S` it nods off (eyes shut, head down, smiling); a nibble rouses it,
a bite jolts it awake ("!" lower, as it sits) and a fish on stands it up. `anglePose` gives `SAT_POSE` + its pose and
`fishVp` turns that into the painting's place (16 now: `FISH_VPS`). A friend's line sits too (`lineOf` calm, from its
'wait').

**The camera.** While the line's out it leans `FISH_CAM_LEAN` of the way to the float, and eases in `FISH_CAM_IN` while a
fish is brought in (`fishCam` in leadCam, by its share of the zoom, as cookCam).

The eel stew's eel is short thick rounds now, their pale cut faces showing (dishes.js `eelPieceAt` takes a `flip`).
Testing it by hand in Chrome over CDP: a key sent to `document` throws in the keydown handler (it reads `e.target.closest`);
send it to `document.body`.

## The rod's look (2026-10-22)

The first rod (two even strokes in flat brown and a tan band for the lashing) read as a pool cue beside the painted
forager: Axel said it didn't fit. Now it's a hazel switch cut from the hedge (game.js `paintRod`): one crooked stick
(`rodCrook`, the same every frame) tapering from a thick butt to a fine tip (`rodThick`, swelling at a knot), filled down
both sides of the bend (`ROD_N` points from its butt behind the mittens, `ROD_BUTT`), shaded under and lit along its top
in the trunks' browns, a knot, a twig cut short with a pale end, a sprig of yellow-green leaves near the tip (`rodLeaf`,
yellower than the bushes so it reads against them) and the grip wrapped in twine. Plain fills, no gradients: about a
dozen calls a frame for the one rod; small (the forager's `px` 70 or less) it's the stick and the leaves alone. The recipe is still
2 sticks and a rope (the twine). The satchel and make strip still show 🎣.
Sat on the bank with the float straight ahead or behind, `drawRod` used to point it straight up; now a sat forager holds
it out the way it faces. Looked at from the side, the front and behind, standing, sat and with a fish on.

**In its hands (2026-10-22).** The rod was as thick as the forager's fist and its twine thicker, drawn over both mittens,
so nothing seemed to hold it. Now it's a little over half a mitten thick (`W0`, `px * 0.014`), and `drawRod` lays the
near mittens over it after it's painted (fur.js `MITT_ART`, the one a carried dish uses; `FISH_HOLD` keeps where each is,
from fur.js `fishHold`), so the rod runs through its fists: side on the near one (the far one, painted, is behind the rod,
as a far hand would be), the twine and the butt showing below it against its tummy. From the front its two mittens are one
above the other along the rod (`FISH_HANDS`), the lower by the butt, and the rod runs through both (`fishHold` gives that
way; it no longer follows the float, which only bends the tip), up and out to the side it faces; wound up, over its other
shoulder. From behind it leans further to that side and comes out by its shoulder, not straight up behind its hood. Side
on, wound up, its mittens are at its shoulder, not its chin, so the butt crosses its chest and not its face.
