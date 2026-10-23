# Fishing (PLAN.md stage 10)

Step 1, the plain catch and the bar, built 2026-10-21. The look and the sounds are placeholders till step 2.

## game.js

The rod is a make at the make strip (recipes.js `BUILDS.rod`: 2 sticks and a rope, `makes: 'rod'`) and an item in the
satchel like the rope (`INGREDIENTS.rod`, stack 1, tag `tool`, painted in items.js `paintRodItem`, which is also its tile's
picture in the strip). It fishes while the rod is in the slot in its hands (`holdsRod`, `ui.held`: the satchel's hotbar, in
`gathering.md`; made, it goes straight into its hands); another slot picked, or the rod put in the basket, given away or let
go, it doesn't, and a line out is pulled in. In the satchel but not held, the line over the satchel by a bank says to take it
out ("take the rod out: 1"), and R takes it out and casts. Held, it's shown: standing, held out the way it faces in the
fishing hold pose (`rest` in the pose, `restLine` standing in for the float), and walking, over its shoulder
(`drawRodWalk`, `ROD_WALK` by view: behind it side on and from the front, across its back from behind). Not while it's
picking, cold and hugging itself, eating, kneeling or carrying a dish. Friends don't see a held rod yet, only a cast one.
The rising rings show while there's a rod in the satchel (`hasRod`), held or not. `rodMade` keeps its tile off the strip while the satchel has one. A guest's comes and
goes with its satchel. Till 2026-10-22 the rod was carried out of a slot (sim.js `f.rod`): `unpackWorld` puts such a meadow's
rod in the satchel (or the basket) and sets `f.rod` to 0. `garden.give('rod')` hands one over in dev.

The comment over `CAST_REACH` tells the whole catch. In short: a press held on water that lasts (sim.js `fishRoom`, not a flood
pool), from the bank (water within `CAST_BANK`) or wading in the shallows (`canFish`, `bankNear`). On a shore the spring flood or the rain has spread over, the water at its feet has no fish (`fishRoom`), so with
flood water within `CAST_BANK` the water that lasts may be up to `CAST_FLOOD` off, and it casts over the flood (before 2026-10-23
a wide, reedy bank in the flood said there was no water to fish in), charges a cast (see "Charging a cast" below);
let go, it's thrown. R pulls the line in again when it's out (`castKey`). The float drifts a little down the current. `biteWait` is the fish in the 5x5 about the float
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

`f.rod` stays in the forager's blank (`foragerOf`) only for meadows kept when the rod was carried (see above). No `KEEP_VERSION` bump. `takeFish`
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
- **The pop over its head** (PLAN.md stage 14 step 2, 2026-10-23). Landed, the catch floats up over the forager's head as
  gathering's pill with its icon, "+1 Perch · 420 g" (`headPop`, painted once by `floatOf`, `HEAD_MS`). It goes in the
  practice floats' stack (`xpFloats`, `drawXpFloats`), so the "+10 Fishing" that comes a moment after rises under it and
  pushes it up; "Perfect catch!" and a new biggest follow as plain pills in the same stack. A gold one (`headPop(id, text,
  true)`: gilt edge, `HEAD_GOLD_MS`) is ready for the treasures.
- **Worried.** The meter under `REEL_LOW` with the fish out goes ember-red and pulses (`#reel.low`).
- **Buzzes** on a bite, a last run and a landing (`BUZZ_BITE`, `BUZZ_RUN`, `BUZZ_LAND`: Android; an iPhone only from a tap).

The bots now, at level 0 (sharp / ok / sloppy / first try): roach 3.5 / 5 / 12 / 16 s, landing 100 / 100 / 100 / 88%;
trout 6 / 8 / 15 / 20 s, 100 / 100 / 94 / 78%. Level 5 lands everything for all of them. (Those times are from before 2026-10-23, when Axel found fishing too fast: `BITE_S` 5 → 12 s,
`BITE_SOONEST` 2.5 → 5, `BITE_MOST` 60 → 90, and the meter `REEL_FILL` 0.24 → 0.15, `REEL_DRAIN` 0.15 → 0.1, the same
fight about 1.6 times as long.) The eel's character is its sink
(a long hold) and wriggles more than its time.

**The sit.** After `SIT_S` of waiting on dry ground (not wading: `angle.dry`) it sits down on the bank, side on whichever
way the water is (fur.js `FISH_SIT`, view 3 of the fishing paintings: `FORAGER_FISH_SIT` sit, a blink, a doze, a start),
the knees drawn up and the rod across them. After `DOZE_S` it nods off (eyes shut, head down, smiling); a nibble rouses it,
a bite jolts it awake ("!" lower, as it sits) and a fish on stands it up. `anglePose` gives `SAT_POSE` + its pose and
`fishVp` turns that into the painting's place (16 now: `FISH_VPS`). A friend's line sits too (`lineOf` calm, from its
'wait').

**The camera.** While the line's out it leans `FISH_CAM_LEAN` of the way to the float (`fishCam` in leadCam).

**Settling in (2026-10-23), to make the wait restful.** `fishStill()` says how far the wait has settled: 1 the line out, 2
sat, 3 dozing (`fishDoze`), 0 for a bite or a fish on. Three things follow it:
- The camera settles in by `FISH_CAM_IN` (+6%, +14%, +24%) over about `FISH_SETTLE_S`, holds on a bite, is `FISH_CAM_REEL`
  in while a fish is brought in, and comes back out quicker than it went. By its share of the zoom (`fishShow.z`), as
  cookCam, so a zoom of your own meanwhile is kept, and never past `nearMost`.
- In fishing mode, from the first float settling till it's left (walking off, Esc, the ✕), the HUD fades out over 2.5 s
  (`fishHud`, index.html `body.still`: the sky, vitals, thermometer, satchel, map, tasks, the line over the satchel). A fish
  landed fades the satchel alone back in for `HUD_SHOW_MS` (`body.caught`, set in `landFish`) so you see it go in. The
  forager cold or hurt, or fishing mode left, brings the whole HUD back (fading in over `HUD_BACK_MS`, `body.unstill`). The
  ✕ over its head stays: it's the way out. Headlines and chat stay too.
- sound.js `lull` (0.5, 0.8, 1 by `fishStill`): water lapping at the bank swells in (`amb.lap`, slow swells) with a plip
  now and then, while the wind, the hive hum and the chimes drop and the music and the fx bus step back a little. The lowpass
  closes a touch (`hush`).

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

## Charging a cast (2026-10-22)

The cast used to be a tap that threw to the tapped spot. Now you hold (in fishing mode since the same day, see below): a press on water in reach (`chargeStart`, from the
canvas's pointerdown, after `fishPress` and before the fire/walk code; it claims the press as `drag.cast`) starts
`charge` (`chargeBegin`): the forager stops and turns to the water, draws the rod back (the wind pose, `chargeLine()` as
`drawRod`'s line) and the power rises from 0 to 1 over `CHARGE_MS`. The pointer sets the aim (direction only, from the forager
to the pointer, so moving it turns the cast); the power sets the distance, from the near edge of the water that way
(`CHARGE_IN` into it) out to `CAST_REACH` (8), and never past the far edge of that water (`chargeAim` looks along the aim every
`CHARGE_STEP`), so a charge never begins on the bank and a full one over a brook still lands in it. Let go (`chargeRelease`) and it's `cast(x, y, true)`; the rod's already back, so the wind-up is `CHARGED_WIND`
(`angle.wind`, which `lineOf` has too) instead of `CAST_WIND`. Let go within `CHARGE_MIN_MS` it's a tap: no cast, a hint
("Hold to charge the cast"). Aimed where there's no water that lasts (`charge.ok`), it casts nothing ("No water that way") and
the landing is marked with a cross. R does the same from the keyboard (hold, let go: keyup in the keyup handler), aimed at the
mouse if it's over the canvas, else the way it faces. Escape, a second finger (pinch), blur, the rod put away or anything that
stops `canFish` cancels (`chargeCancel`).

Before a press, with the rod in its hands and no line out, the mouse over water that lasts gets a thin white ring on the
surface under it, breathing, with a ripple spreading off it (`drawFishAim`, on the ground after `drawRises`): bright where a
press would charge (from a bank, within reach), faint where it wouldn't, none over something to pick (its glow says so) or for
a finger. Two strokes a frame.

`drawChargeDown` (render, on the ground after the shadows, so it stands in it) and `drawCharge` (after what stands), only while
charging, all in the thin white of the mouse's ring (`castRing`, which `drawFishAim` draws too; made plainer 2026-10-22):
a faint ring about its feet that a brighter one fills clockwise, a ripple swelling off it when full, and the ring on the water
where it would come down (its ripple quicker when full, a white cross when there's no water that way); over them small dots march
out along the float's arc (`castLift`, the same arc `drawFishing` flies the float on), from where the rod's tip whips out to
(`CHARGE_OUT`, kept by `drawRod`), not the wound-back tip behind its head. It all fades in over `CHARGE_MIN_MS`, so a tap doesn't
flash it. The camera leans toward the landing while it charges (`fishCam`), as it does to the float, so a long cast's ring
stays on a phone's screen and the cast goes on with no jump. A few paths a frame. sound.js `angle` has `charge` (the reel's ratchet and the rod's creak, higher and harder with `v`, the ticks quickening from
1.5 to 0.7 of `CHARGE_TICK`), `full` (a taut twang and two bright notes, once; `BUZZ_FULL`) and `strain` (a low creak every
`CHARGE_STRAIN` while it's held at full); the cast's whoosh and zing grow with the power it was let go at (`v`; a friend's
cast is heard full). All are in sound-lab (Drawing back). `garden.angle` and `garden.charge` are in the console.
Friends don't see the charge, only the cast (their cast winds up for `CAST_WIND` as before).

Testing it in a hidden Browser pane: the page's frames only run while something forces them (a screenshot), so a timed
hold through `javascript_tool` shows power 0; send `PointerEvent`s to `#world` (`pointerdown`, then screenshots, then
`pointerup`), or hold a few seconds of screenshots in a batch. In headless Chrome over CDP, `Input.dispatchMouseEvent` works, but a card left open
(hidden by the panels-off CSS) swallows the first press (`cardsOpen`): press Escape a few times first.

## Fishing mode (2026-10-22)

A press on the water used to start a charge, and any other tap walked it off, so a tap meant for the line could walk it
away. Now casting is a mode (game.js `fishMode`, the comment over it). Still by water it can fish in, with a rod in the
satchel (`fishCould`), a parchment disc bobs over its head: a red-tipped quill standing in its rings, R beside it on a
keyboard (`fishBadgeArt`, painted once; `drawFishBadge`, after the stone's disc; above a thought bubble if one's up). A tap
on it (`fishBadgeAt`, `fishBadgeTap`) or R enters (`fishEnter`: the rod into its hands, it turns to the water). In the
mode no press walks: held anywhere (the mouse, a finger, Space) it charges (`chargeStart` only in the mode; Space through
`fishKey`, which never jumps there), aimed at the pointer, or at the water it's by if there's none that way (`chargeAim`'s
second pass, toward `bank`), so "No water that way" hardly comes up now; a tap with the line out strikes or pulls it in
from anywhere (`fishPress`). While nothing's on the go (no charge, the line in or waiting) the disc is a small round
brass ✕ (Esc beside it) that leaves (`fishLeave`, pulling the line in); Escape and phone Back do too (`stepOut`,
`opened`), and anything that stops it fishing (walking off with the keys, a fire, the rod put away: `fishModeFrame`).
The aim ring under the mouse (`drawFishAim`) shows only in the mode. Checked over CDP at 1200x800 and on a phone
(390x844, touch): enter, a tap on land doesn't walk, a hold on land charges toward the pond and casts, Space charges,
the ✕ and Escape leave.

## From a seat log (2026-10-23)

Sat on a seat log by the water (`sitFrame`), fishing mode, a charge or a line out keeps it sat: `fireSit.fish` and
`angle.log` are set, `kneelNow` gives -1 so the fishing poses are used, and `anglePose` gives the bank sit
(`FORAGER_FISH_SIT`) from the first: `start` (up and ready) while it casts, has a bite or brings one in, else sat, a blink, or
dozing after `DOZE_S`. `fishSat` is true at once on a log (no `SIT_S` to wait), so the camera, HUD and lull settle in as on
the bank. It's lifted onto the log with `FISH_SIT_HIPS` in place of `SIT_HIPS`, with no shadow. A friend's sits too: its
`p.line.log` from `seatUnder` while its line is out or its rod held. The pose is the bank one (knees drawn up), perched on top
of the log; one with the legs hanging over its front could come later.

## Seeing the fish come (2026-10-23)

As in Minecraft, you see the fish that will bite coming. `waitAgain` sets it off (`comeFrom`): `COME_MS` before the first
nibble (or just before the bite), from up to `COME_FROM` tiles off in water that lasts (nearer when the wait is short; with no
water round the float to come through, none comes). `comerAt` gives where it is: swimming in with a wiggle, slowing as it
nears, then nosing round the float `COME_NEAR` off, closing in on each nibble. `drawComer` (from `drawFloat`, our own line
only: a friend's line has no bite times) draws only the trail of bubbles it leaves on the water (`comer`, typed arrays, one
fill); a dark fish shape under the surface was tried and taken out. A nibble splashes a little
and the bite splashes big, twice. Friends see the splashes but not the fish yet.

## The rod wears (PLAN.md stage 14 step 1, built 2026-10-23)

A tool has uses now: recipes.js `uses` and `mend` on an ingredient tagged `tool` (the rod: 60, mended with 1 rope), checked by
`checkRecipes` (both on every tool, on nothing else). sim.js `stackOf` gives a tool 1 a slot everywhere (in dev's 999 too),
so tools never pile. Every store has a third row, `bagUse` (uses taken, 0 new), made in the blanks (`foragerOf`, `basketOf`,
`rackOf`, `blockOf`) and filled with 0 for a kept meadow from before (`unpackWorld`, no `KEEP_VERSION` bump). The movers carry
it (`moveBetween`, `moveInto`, `moveSlot`: two rods swap, never merge; `storePut`/`stow` take a `use`; `storeTake`/`takeOne`
clear it with the slot), a dropped thing has `use` (`dropOf`; `dropSlot` and `dropAt` never pile a tool) and `gather` gives it
back. `wear(w, f, k, n, skill)` takes n uses off slot k, fewer by the skill's `care` perk (fishing: 4% a level; the part of one
rounded on `hash2` of the tick), and returns what's left; `snapTool` empties the slot and drops a stick at its feet;
`mendTool` puts it back to new.

game.js: the rod's code says the cost (`ROD_LAND` 1 a catch landed, in `landFish`; `ROD_LOST` 2 lost in the bar, in
`reelFrame`), through `rodWear`. At a fifth left (`WEAR_FRAY`) "The line's fraying", once, and the bar pulses (`.fray`).
Worn out it snaps `ROD_SNAP_MS` after (the catch in first): `snapRod` leaves fishing mode, the line in, sound.js `angle`
`snap`, "The rod snapped", and the stick is sent to friends as a `'drop'`. The bar under a worn tool's tile (`wearTile`,
index.html `.wear`, green over half, amber, red under a fifth) is in the satchel and the basket's card, rewritten only when
the tile's `data-wear` changes; the tile's name says "41 of 60 left" (`wearWords`). At the make strip a build that makes a
tool, with one in the satchel, is a **Mend** tile (`MENDS`, `mendSlot`: the most worn one, `stripHave`, `mendThing`), greyed
(`.new`) while it's as good as new. Friends: a gift carries `use` (`'give'`, and its drop), the camp stores' sync sends
`[slot, id, n, wear]`, the away bag keeps `bagUse`. `garden.wear(n)` in dev wears the rod in hand.

## Bits from the water (PLAN.md stage 14 step 3, built 2026-10-23)

Not every bite is a fish. recipes.js `HAUL` (beside `FISH`, copy a block; `checkRecipes` checks it) holds what else comes up:
a stick, dry grass (reeds), clay (still water only), pebbles and birch bark, each with its own chance a bite (`odds`), the
level it comes from (`from`, all 0 for now), how many at once (`n`), and how much likelier where the water runs (`current`)
or with a tree standing within `HAUL_TREE` of the float (`trees`, looked at once a bite through `forEachDecorNear`). In still
water they're about 6% of bites, in running water under trees about 10%. game.js `haulKind` rolls them first in `fishKind`,
on the page's random numbers, and only if none comes up is it a fish.

A haul fights by its `drag` (game.js `HAUL_FIGHT`, in FISH's words). `'dead'`: it's struck high in the bar (`top`), sinks
slowly and evenly (`fall`, bars a second) to its floor and stays there, never darting or running, and pulls the zone down a
little (`sink`). It has no size (no "A big one", not weighed, no biggest kept, no perfect catch). Landed (`landFish`) it takes
no fish from the sim, is `HAUL_PRACTICE` (0.4) practice and the rod's usual wear, comes up `n` at once ("+2 Pebbles", the
`headPop` pill), arcs onto the bank and lies there with one little bounce (`landing.dead`) before it goes in (`landed`
stows as many as there's room for). Lost in the bar it "slipped off the hook" and costs the rod as a fish does. Friends see it
land on its bank (`heardLine`), and `applyNet` takes no fish for it. `garden.fishNow('pebble')` brings one up in dev.

## Water food (PLAN.md stage 14 step 4, built 2026-10-23)

Three new ingredients in recipes.js, each a `HAUL` block from level 3 (`from: 3`) with `prize: true`, so the level's
`PRIZE_MORE` lifts them as it does perch and trout: **mussels** (`mussel`, tagged `shellfish`: deep still water, spring to
autumn, 2 to 4 at once), **crayfish** (`crayfish`, `shellfish`: running water in summer, `dark: 4`, four times likelier at
dusk and night) and **water mint** (`watermint`, tagged `greens` so the any-greens dishes take it: any water, spring and
summer). `HAUL` learned `deep` and `dark` for them (`haulKind` takes the float's depth and whether it's dusk or night). In
deep still water from level 3 they're about 9% of bites where they can come up. A crayfish fights `'scrabble'` (game.js
`HAUL_FIGHT`: small quick darts and wriggles, no run); mussels and mint come up as dead weights. Painted in items.js. The
book's fish section is "Fish & shellfish" now. Their dishes: Mussels with wild garlic (pan), Crayfish boil (pot: crayfish,
crayfish, water mint, any greens), Trout with water mint (stick), painted in dishes.js.

## Treasures (PLAN.md stage 14 step 5, built 2026-10-23)

recipes.js `TREASURES` (copy a block): three bottles, the sunken copper pot, the old fisher's cap, the oilskin cloak and the
pearl. game.js `treasureKind` rolls first in `fishKind`, from `TREASURE_FROM` (5): `TREASURE_ODDS` (1%) of bites rising to
`TREASURE_TOP` (2.5%) at the top level, ×`TREASURE_PERFECT` if the last catch was perfect (`angle.perfectLast`),
×`TREASURE_WEATHER` in rain or at dawn and dusk, never past `TREASURE_MOST` (4%). Each comes once a meadow: sim.js
`w.hauled` (in `LATER`; an old meadow gets `[]`, no `KEEP_VERSION` bump) holds those come up, and the roll picks evenly from
the rest. `haulOf(id)` is what isn't a fish as the line has it (a `HAUL` block, or `TREASURE_HAUL` for a treasure). A treasure
fights `'heavy'`: slow, the zone pulled down hard (`sink`), one long run near the end, and it glints as the biggest fish
does ("Something heavy…"). Lost in the bar it isn't used up (it's only put in `w.hauled` landed). Landed (`landFish`) it's
`TREASURE_PRACTICE` and `ROD_TREASURE` (3) wear, pops up gold over its head, and once it's flown onto the bank
`landTreasure` gives a headline ("from the water") and does what its `kind` says:
- **bottle**: teaches its dish (recipes.js `bottle: n` on the dish), as cooking it the first time would (`firstOnce('dish:' +
  name)`: per player, for good). A bottle's dish is found no other way: recipes.js `cook` skips it till `knowSecrets` (game.js:
  `knownDish`) says it's known, the forager's hints pass it by, and its page says it's in a bottle at the bottom of the water;
  known, it has a "From a bottle" chip (`BOTTLE_MARK`). The three: Honeyed eel (stick: eel, honey), Fisher's mussel broth
  (pot: mussel, mussel, mushroom, nettle), Mint tea with honey (pot: water mint, water mint, honey; sipped).
- **pot**: sim.js `copperPot` leaves a pot on the bank where it would have landed (no picture flies), a pot as the clay ones
  with `copper: true` (in `potOf`'s blank), not owed to any fire (`potsOwed` counts only the clay ones), heating
  `COPPER_WARM` (2) times as quick. Painted green-patched copper with a dent and a shine off a fire and in its hands
  (game.js `POT_COPPER`, VSL parts `potC0`..`potC3`); over a fire it's the cooking's own pot for now. It doesn't hold a thing
  more than the clay one (the plan's idea): the pot's four slots run through the whole cooking window.
- **hat** and **cloak**: fur.js `FORAGER_HATS` "Fisher's cap" (`find: 'cap'`) and `FORAGER_CLOAKS` "Oilskin" (`find: 'oilskin'`)
  are locked in the wardrobe till fished up in this meadow (`wdLocked`, `wdLock`: greyed with a lock, the die never picks
  them). The plan's long scarf became the oilskin cloak (a cloak is colours alone; a scarf would be a new part in every pose).
  Adding a sixth cloak changes `outfitOf`'s numbers, so a friend on the version before sees the wrong hat or cloak till both
  have updated.
- **pearl**: not rolled (`rolled: false`). A mussel haul landed from level 5 has it one time in `PEARL_ODDS` (40) while
  it isn't in `w.hauled`; it goes in the satchel after the mussels (an ingredient, tagged `keepsake`, fill 0) and earns the
  deed `pearl` ("Found a pearl", 2 cosy).

The book's Finds has "From the water" last, a page each (`find:` + its id; `foundIt` reads `w.hauled` for these), the ones
not found a shadow and no name; a bottle's page links to its dish. The treasures are on the satchel's sheet too (`ITEM_IDS`).
Friends: the `'land'` message carries the kind and `pl` (a pearl); `applyNet` puts a treasure (and the pearl) in the
other side's `w.hauled` on its tick, and leaves the copper pot on its bank there too, so two friends can't both fish one up.
`garden.fishNow('bottle1')` (or any treasure's id) brings one up in dev; `garden.fishKind(x, y)` rolls a bite there (it
counted the shares above). Not built: the shiny lure (no bait yet), old fish (tier 4).

## The fishing guide (2026-10-23)

Axel wanted a guide to how rare things are. The fishing skill's page in the book (You) has "What bites, and how rare" under
the road (game.js `fishGuideHTML`, from `skillPageHTML`): everything on the line, the commonest first, each a row with its
picture (a shadow and "? ? ?" till it's found, as in Finds), where and when said short from recipes.js (`catchWhen`: "Deep
still water · summer nights · up to 1 bite in 2") and a rarity word in its own colour (`RARITY`: Common, Fairly common,
Uncommon, Rare, Very rare; index.html `.rare.r0`..`r4`). A row opens its find page. `CATCHES` works the numbers out once at
load from `FISH` and `HAUL` as `fishKind` and `haulKind` roll them, over every season, shallow still, deep still and running
water, and day (60%), dawn and dusk (15%) and night (25%), a tree by the float half the time, as if the level let each come
up: `share` of all those bites picks the word, `best` (its share where it does best) the "up to 1 bite in N". So a retuned
`odds` retells itself. The treasures and the pearl are Very rare with no number. Each catch's find page has the word as a chip
(`rareChip`, found or not) and a link back to the guide (`guideLink`). At the time: roach 73% (Common), perch 8% and trout 8%
(Fairly common), eel 1% but half the bites on a summer night (Rare), crayfish 0.4% (Very rare).
