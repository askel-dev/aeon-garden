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

## Stage 3: the storm opening (built 2026-10-15, branch `storm`)
A new meadow opens in a storm, late in the afternoon. The forager arrives cold and wet, the light is going, and a
short line says something like "It's freezing. I need a fire before dark." Warmth is already dropping, slowly enough to
gather, not to sightsee. The storm blows over in the first evening; the first night is clear and cold, spent by the
fire you made. (Today a new meadow opens on day 4 of spring: keep the season, change the hour and the weather.)
Built as: day 4 of spring at 0.44 of the day (just before the golden hour), a storm till 0.555 (about 80 s at 1x), then clear
till the next morning; the forager arrives at 0.78 warmth (it slips into chilly within seconds) and 0.75 wet, and says the line
in an italic bubble over it. Playing together: a friend joining during the opening storm arrives cold and wet too and hears the
line; the weather needs nothing sent (guests run the host's sim). Without a fire the first night kills towards dawn unless the
forager keeps walking and keeps dry, which is the point of stage 4.
Then (Axel) made more cinematic: it opens letterboxed, the name in the lower bar, the camera craning down out of the storm onto
the forager, and the bars slide off after 7 s (a click, a tap or a key cuts it short).

## Stage 4: the campfire (built 2026-10-15, branch `campfire`)
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

### As built
- 6 pebbles, 5 sticks, 2 tinder (recipes.js `BUILDS.campfire`); camp lays 3 pebbles now (so 3 more to find).
- A round fire button by the satchel (F too), its ring filling as you gather; pick a spot, the forager kneels, lays it,
  strikes, and you hold to blow. Clicking a fire feeds it a stick or relights it; by a lit one it kneels to warm its hands.
- 5 sticks burn about 8.5 game hours dry (7 in rain), then embers about 2.4 hours, then cold. By a fed fire every night
  ends cosy; by 5 sticks alone a winter night ends at 0.1 to 0.75 warmth; with none, winter and rainy spring nights kill.
- Nights made much darker (game.js `DARK` 0.55 to 0.88, a deeper navy) after Axel looked, so the fire's pool is the cosy
  place; its light reaches further (`LIGHT_TILES` 6 to 8, a gentler falloff), and its warm light on the forager is softer
  (it washed it out).
- Played in a browser and timed (no measurable cost). Left for a refinement pass: the look of the pool and flames, the
  balance of how long a stick burns, the sounds.

## Stage 5: making camp
Lighting the first fire makes camp (`w.camp`: where, and the fire), and it's a big moment: the flame flares, warm light
blooms out over the clearing, a burst of sparks and embers, a short warm flourish in the felt-piano scale, the camera
eases in a little, and a few elegant words fade in and out ("Your camp") in the style of the old season and year
announcements (the daybreak lines: `showBreak`, `#daybreak` in main at 1d79f03: italic serif heading, small caption, a
soft fade and rise). The phone vibrates (`navigator.vibrate`: Android only; iPhone web can't, so sound and light there).
From then on a soft camp ring around the fire, inside which later builds are arranged (a seat log, a spit, a drying
rack, the pot, a basket, a lantern, a bedroll).

### As built (2026-10-16, branch `camp`)
- sim.js `w.camp` (in `LATER`: `{ x, y, fire, made }`), made by the meadow's first fire lit (`lightFire` → `campAt`, event
  'camp'). The forager's home moves there: it wakes after a collapse where it knelt to light it (or at the fire's side for a
  friend's fire). Playing together, a friend's first fire makes the camp everyone's. A meadow kept with a fire lit before this
  makes camp at it as it opens. No `KEEP_VERSION` bump.
- The ring: `CAMP_R` 3.2 tiles about the fire, `CAMP_FLAT` 0.8 as deep as wide (`inCamp`, for the builds to come), drawn as a soft
  band of trodden earth with a few small stones along it (game.js `drawCampRing`, painted once), coming in a moment after.
- The moment (game.js `campMoment`): the flames flare (`CAMP_FLARE`), the light blooms out (`CAMP_BLOOM`) with a warm glow and
  a burst of sparks and embers (`campBurst`), a felt-piano flourish (sound.js `camp`, in sound-lab), the camera eases in a little
  and leans to the fire, then back (`campCam`), "Your camp" in big warm italics with "the first fire" over it and "You'll wake
  here, by the fire." under it (announce 'camp', cutting in ahead of any other headline), and a buzz on Android (`CAMP_BUZZ`).
  The fire's hover says "Your camp". It replaces the first fire's gold headline stage 4 planned (never wired).
- Played in headless Chrome at dusk (the moment frame by frame); no cost to measure outside the moment's few seconds (the ring
  is one draw a frame).

## Stage 6: cooking at the fire, and a tummy (planned and settled 2026-10-16; step 1 and a redesign built, below)
Built together: with nothing to eat for, a dish is only something to collect, and with nothing to cook a tummy is only
a timer. The cold is already there, so a warm dish by the fire on a cold night is the point. The data is ready
(recipes.js: 18 dishes, `cook`, `fillOf`, `warm`, `MESS`); the game reads none of it yet but the ingredients.

### Cooking
- **Opening it:** a click or a tap on a *lit* fire walks the forager there; it kneels, and a small parchment card opens
  beside the fire (not a panel, not over the forager): 3 slots (`STATIONS.fire.slots`), a Cook button, and a small
  stick button that feeds the fire (what a click on a lit fire did before). Embers and
  cold fires keep today's click (blow, feed, relight: game.js `clickFire`). Walking away shuts it, so does ✕ or Back.
- **Filling it:** tap a satchel slot and one of it goes into the next empty slot on the card; tap a card slot to take
  it back out. Nothing says what a new dish will be (those are found by trying); a known dish is named on the card as its
  things go in, and the card lists the known dishes you have the things for, a tap filling the slots.
- **Cooking:** a few seconds at the fire (the whole look and sound of it is the next section), then the dish goes into
  the satchel (`stow`, stacking like anything else). What matches no recipe is a forager's mess (`MESS`): still food,
  just not much.
- **A new dish:** the first time a dish is made, a small warm moment: its name in gold over the fire with "New recipe!"
  and its `text` under it (the `firstTime` style, much smaller than "Your camp"), a little chime. Known dishes are
  remembered for good, per player (localStorage), whatever meadow they're in.
- **Playing together:** a guest cooks at any fire; it goes through the host's sim like feeding a fire (`sendFire`).
- **In the satchel:** a dish is kept by its name, and shows its painting (below).

### The look and sound of cooking (the heart of the game: take the time to make it lovely)
Cooking is what the game is about, so this part gets the most care of anything so far: it should feel like the best
moment in a cosy cooking game every time, the hundredth time too. Built in steps Axel looks at and plays (see "Building
it"), with a polish pass after each.

**The dishes, painted.** Every dish gets its own painting in the meadow's storybook style (soft-rendered, not flat
vector; readable at a glance in a 48 px slot, not too detailed), painted in code like the satchel's items (game.js
`paintItem`, `itemSheet`) and added to the same sheet.
- Each dish sits in a vessel that says how it was made: a carved wooden bowl (soups, salads, compote), a birch-bark cup
  (teas, cordial, syrup), a flat leaf or a hot stone (fritters, roasts, baked apple), a stick skewer (roast mushrooms),
  with the food in it built from its ingredients' own colours and shapes, cooked: browned edges, a glaze on the honeyed
  ones, a sheen on the soups, herbs scattered on top.
- The 18 dishes in recipes.js are each painted by hand. A dish Axel adds later with no painting yet still gets a good
  one, put together from its vessel and its ingredients (a new optional `look` in recipes.js: 'bowl', 'cup', 'leaf',
  'skewer', with a sensible guess when it's left out), so the data stays copy-a-block easy.
- The mess has a painting too, comic and loveable: a lumpy, slightly charred heap with a wisp of smoke.
- Warm dishes show it: a curl or two of steam rising off them in the slot (a small CSS animation over the painting,
  only on warm ones, nothing per frame on the canvas).
- Each is painted twice: for the slot (96 px) and big for its "New recipe!" moment (about 240 px).
- `recipes.html` shows every dish's painting by its recipe, small and big, so Axel can look at them all at once and
  see a new dish's painting the moment he adds it. Before they go into the game, a sheet of all of them goes to Axel
  to look at (and old against new when one is redone).

**The cook, animated.** A little scene at the fire, about 5 to 6 seconds, every beat with its own small motion:
1. *Into the card:* tapping a satchel slot sends the thing in an arc into a card slot, where it lands with a bounce.
2. *Into the pan:* on Cook the card folds away, and the things hop one after another from the card into a little pan
   (fry, roast) or a small hanging billy can (soups, teas) that the forager sets over the flames. Each lands with a
   squash and a puff.
3. *Cooking:* the food changes as it cooks, raw to warm to golden (a few painted steps, not a fade every frame); steam
   wisps rise, fat spits a spark or two, the flames lick up round the pan, a soup bubbles. The forager stirs with a
   stick, gives the pan a toss halfway (the food flips in the air and lands back), and leans in to sniff it, with a
   happy wiggle.
4. *Done:* the dish rises out of the pan in a puff of steam, the forager holds it up to look (a warm glow behind it),
   then it arcs down into its satchel slot, which bounces as the count ticks up.
5. *A new dish:* at "done", the big painting rises over the fire with its name in gold, "New recipe!", its `text`
   under it and a ring of sparkles; it fades after a few seconds or a tap.
6. *A mess:* a dark puff of smoke instead, the forager coughs, fans it with a hand and looks at you sheepishly. Funny,
   never a punishment.
7. *Eating:* the forager sits, eats with little bites (a spoon for soups, sips from a cup), cheeks round, a happy
   sway; a warm dish sends a soft warm glow up through it and a contented sigh. Raw things are a quick munch.
- New forager paintings in fur.js for it (kneel and stir, the toss, sniff, hold up, cough, sit and eat, sip), each in
  `forager-lab.html`; the pan, the billy can, the steam and the sparks as cached paintings (the sprite cache), so the
  scene costs next to nothing (one cook at a time, the camera close).

**The sounds.** Made in sound.js like the rest (Web Audio, soft, through the felt), every one in sound-lab, plus a
button there that plays a whole cook from start to end.
- Things going in: each sounds of what it is (as `pluck` does: mushrooms a soft thump, berries little plops, honey a
  sticky gloop, greens a rustle, nuts a rattle), climbing the scale as they land one after another.
- The cooking itself, by how it's made: a frying sizzle that swells as the pan heats and softens as it's done (noise
  shaped like real fat, with little pops); a simmer of low bubbles for soups and teas; a dry hiss and popping for
  roasting nuts. The fire's crackle (`crackle`, `amb.fire`) comes up a little under it.
- The stir (a wooden scrape), the toss (a whoosh and a soft landing), the forager humming a few notes while it cooks.
- Done: a warm little flourish in the felt-piano's scale; a new dish a longer one with a twinkle; a mess a deflating
  comic "pfft" and a low note.
- Eating: crunchy bites, a slurp for soup, a sip for tea, a contented "mm", and a warm swell for a warm dish.
- A dish's sounds and its vessel come from its `look`, so a dish Axel adds sounds right with no code.

### The tummy
- `w.forager.tummy`, 1 full to 0 empty, made in `foragerOf` (as a fraction, `-0` then set: the layout rule). It
  empties over about a day (12 min at 1x), a bit faster when cold (the body burns to keep warm), sprinting a bit more.
- **Eating:** anywhere, from the satchel: a tap on a slot shows its name with a small "eat" under it. An ingredient fills its `fill`, a dish `fillOf`; `raw: false` things
  can't be eaten as they are ("It wants cooking"). Eating with a full tummy isn't possible ("I'm full").
- **What a full tummy means:** `fill` counts against a tummy of about 10: a day's food is three cooked dishes, or a dozen
  raw things (which also means a lot of picking). Raw is a stopgap; cooked is how you live.
- **Hungry** (below a third): the forager rubs its tummy now and then, a soft growl; stamina comes back slower and
  warmth drops faster (nothing to burn). **Starving** (empty): stamina comes back very slowly and the cold hits much
  harder. Hunger alone never collapses it: the cold does that, and hunger helps it along.
- **Warm dishes** (`warm: true`): a lift in warmth when eaten, and "warm inside" for a game hour or two (cools much more
  slowly), shown as a faint glow on the forager.
- **UI:** a third slim bar with warmth and stamina over the satchel, in a honey colour, shown only once hungry.
- **After a collapse** it wakes at camp half full (it was a long night, but no double punishment).
- **The opening:** a new meadow starts at about two thirds full, so the first night by the first fire is fine, and the
  first morning's hunger is what sends you out to forage and cook.

### Settled (2026-10-16: Axel took every suggestion)
1. **A click on a lit fire:** today it feeds a stick. Should it open the cooking card instead, with feeding as a small
   stick button on the card? **Settled:** Yes: card first, a stick button on it, and F / the fire button still for building.
2. **Does cooking cost the fire anything?** Burn some of its fuel, or only need it lit? **Settled:** Only lit: fuel is already
   the fire's pressure.
3. **Showing what it'll make:** once a dish is known, should the card name it as you fill the slots ("Baked apple with
   honey"), and maybe list known dishes you have the things for, tap to fill? **Settled:** Yes for known dishes only: trying stays
   the way to find new ones, the known ones don't become a chore.
4. **Remembered where?** Known dishes per meadow (kept with it, lost with a new meadow) or per player (localStorage,
   for good)? **Settled:** Per player: a recipe you found is yours, and a new meadow then plays faster.
5. **How to eat:** today a tap on a satchel slot shows its name. A second tap eats? Or the name with a small "eat"
   under it? Or eating only by the fire? **Settled:** The name with a small "eat" button under it, anywhere.
6. **How fast hunger comes:** empty in about one day (12 min), or slower, about two days? **Settled:** One day: a meal in the
   morning and one at dusk feels right with a 12-minute day. Easy to change.
7. **How hard hunger bites:** as above (slower stamina, colder), or also walking slower, or able to collapse on its
   own? **Settled:** As above: gentle, the cold stays the killer.
8. **Dishes go off?** **Settled:** Not now: keeping food is the drying rack's and the cellar's job, later.
9. **A kept meadow** from before has a forager with no tummy: start it full, or bump `KEEP_VERSION` and start over?
   **Settled:** Start it full, no bump.
10. **What's next to it:** should this stage also add a few more warm or filling dishes, so a day's food is easy to
    reach in every season? **Settled:** Yes, a small pass over recipes.js once the tummy's pace is set, checking each season has
    two or three dishes from what grows then.
11. **Do you do anything while it cooks**, or only watch? E.g. a gentle tap when it smells ready for a "just right"
    sparkle (never a fail), which later feeds the cooking levels' quality. **Settled:** Watch for now, but leave the toss as the
    place a tap could go later: the quality comes with the levels.
12. **How long a cook takes:** real seconds (about 5 to 6, the same at any speed), or game time? **Settled:** Real seconds: it's a
    moment you watch, and the meadow keeps going around it.
13. **Vessels at the fire:** a pan and a billy can as above, or one pan for everything until the pot station? **Settled:** Pan and
    billy can: soups and teas are fire dishes already, and the bubbling is half their charm.

### Building it
Each its own branch, played and looked at by Axel before the next:
1. **The workings:** the card, `cook`, the dish in the satchel, the tummy and eating, the hungry and warm effects,
   remembering dishes. Plain looks (the dishes' emoji), so the feel and the pace can be tried first.
2. **The dish paintings:** all 18 and the mess, the made-up ones for dishes without a painting, `look` in recipes.js,
   in `recipes.html`. A sheet goes to Axel first.
3. **The cook, animated:** the forager's new paintings, the pan and billy can, the beats above, the "New recipe!" moment,
   eating.
4. **The sounds:** all of the above in sound-lab, then in the game.
5. **A polish pass** after Axel plays it: timing, easing, how often the little touches come, so it never wears thin.

### As built: step 1, the workings (2026-10-16, branch `cook`)
- All as above, with plain looks: the dishes are their recipes.js emoji (a new optional `icon`), the cook is the forager
  stirring (its kneeling poses) and the Cook button filling over `COOK_MS` (5.5 s), with the pot's things jiggling.
- A new forager starts at 0.85, not two thirds: at two thirds it was starving by the first dawn. Tummy 10, a dish fills 3 to
  7 (recipes.js `fillOf`), so two or three dishes a day.
- Only rosehip tea is warm at the fire (the other warm ones are pot dishes): the recipes pass (question 10) is still to do.
- A stick tapped in the satchel while the card is up goes on the fire. With the satchel full, a dish lands on the ground.
- A clarity pass on the card (2026-10-16): the stick button wears the fire's fuel as a ring (amber and pulsing when low); the
  satchel rings what will go in the pot or on the fire and dims the rest while the card is up; the pot is named for a known
  dish it's a thing or two short of, and told when nothing but a mess could come of it, before the five seconds are spent; the
  last dish cooked comes back as a one-tap "cook again"; and the first card ever opened nudges what to do.
- Not yet: the hungry look and growl (step 3/4); for now the forager says "I'm getting hungry" and "I'm starving".

### The cooking redesign (2026-10-16, after Axel's first play)
What he found: it wasn't plain a fire could be cooked at; the card was detached from the fire with a tiny ✕; working out
what goes together was hard, and "Something new: cherries, cherries" promised a dish that cooked into a mess.
- **Honest pot line** (game.js `potWord`): a known dish's name; "Something new!" only for an exact dish never made; a pot on
  its way to one says it's not a dish yet and that as it is it's a forager's mess (and what a known dish it's near still
  wants, `potToward`); nothing possible, "Only a forager's mess can come of this".
- **Known from the start** (recipes.js `known: true`, which `checkRecipes` checks): roast mushrooms, wilted greens and
  spring salad, all from a first spring camp. Players' known dishes stay in `aeon-garden-firsts`; no `KEEP_VERSION` bump.
- **The recipe book** (`#book`, `renderBook`, B or the little book by the satchel; the cooking bar has it too): known dishes
  with their painting and what goes in, what the satchel has lit; half-known ones from hints ("Something with honey…", a ? for
  each thing still missing); the rest a row of blank plates. A known one tapped fills the pot from the satchel (`fillPot`), or
  walks to a lit fire within `BOOK_REACH` and fills it there.
- **Cooking in the meadow**: the card is gone. The camera eases in and leans to the fire (`cookCam`), a painted iron pot sits
  over the flames (`drawPot`, drawn over all that stands), things fly from the satchel (tap, or drag onto the pot) and drop in
  with a bounce and a puff, bob and steam while it cooks, a mess goes up in dark smoke; a tap on one in the pot takes it out.
  Under the fire a small bar: the line, the stick (F too), the book, Cook, and a 44 px brass ✕. Esc, Back or walking off leave.
- **Finding it**: by a lit fire with something to cook, a small painted pot (and an E key on a keyboard) bobs over it
  (`drawCookPrompt`); making camp, the forager thinks "I could cook something on this fire."
- **Hints** (`hintTick`): at most every `HINT_EVERY` of a day and `HINT_GAP` real time, never in the intro or the opening storm
  or over another thought, the forager muses on an unknown dish from what's in the satchel ("Cherries and honey… that could cook
  into something") and the book is told that much of it (never all: `hintMost`), per player (`aeon-garden-hints`).
- Left for Axel: the pot is the one vessel for now (the pan and the billy can of step 3 can replace it); E at a lit fire comes
  from the keydown branch merged alongside; only the fire's dishes are in the book (the pot's and the oven's wait for them).

### Step 2, the dish paintings: begun (2026-10-16)
- dishes.js paints them (only fur.js's helpers, so recipes.html shows each by its recipe, big and at the satchel's size). Two so
  far: roast mushrooms (three roasted caps threaded on a green stick, bark where it's held, the tip charred, a drop of juice) and
  baked apple with honey (a baked red apple on a flat hearth stone, split down one side, cored and full of caramel, honey glazed
  down its shoulders and pooled round its foot, its stalk and a soft leaf). In the satchel, the cooking tiles and the book.
- Still to do: the other 16 and the mess, `look` and the made-up ones, the steam on warm ones, the big "New recipe!" painting.

## Vessels, clay and crafting (stage 6): pieces 3 and 4 built (2026-10-17, branch `claude/vessels-clay-f8287b`)

- **Piece 3, what each dish is cooked in.** recipes.js has `VESSELS` (pot 4 slots, pan 3, stick 2, stone 2, bowl 3) and an optional
  `vessel` on each dish (left out: 'pot'; `vesselOf`). The old `at: 'pot'` dishes are now plain fire dishes in the pot (the `pot`
  station is gone; the fire holds 4, so the cooking window's pot is 4 wide). `cook(things, at, vessel)`: with a vessel only
  dishes made in it match; null means any, which is what the window uses now (game.js `COOK_VESSEL`, the one place piece 6
  replaces with the forager's pick and `VESSELS[v].slots`). `checkRecipes` checks an unknown vessel, too many things for it, and two dishes
  of the same things in the same vessel. The book shows a vessel chip on each dish page.
- **Piece 4, clay.** Ingredient `clay` (tag 'earth', since a tag can't be its own id), a `ground` find in sim.js `FINDS` ('muddy':
  bare ground within a tile of water), a plain painting `paintClay` in game.js. No `KEEP_VERSION` bump: finds are plain data.
  Three seeds, two years: clay about 8 about at all times, nothing died out, pack/unpack round-trips.
- **Left for piece 5:** shaping clay and firing it in a lit fire; `f.kit` on the forager (pot, pan; never the satchel; a field in `blankForager`
  or the world's LATER, and a keep bump if needed); an items.js painting for clay if wanted.
- **Left for piece 6:** the vessel switch in the cooking window (stick and stone free from the start, pot and pan from the kit),
  per-vessel slots in the window, and the pot/pan/stick/stone paintings in the cooking view.
- **Pieces 5 and 6 built, barebones (2026-10-17, branch `claude/vessels-crafting`).** recipes.js `CRAFTS` (pot: 3 clay, 90 s;
  pan, the clay griddle: 2 clay, 60 s; checked by `checkRecipes`). sim.js `f.kit` (`kitOf`: `own`, `firing`, `left`, `total`,
  `x`, `y`) in the blank forager, so a kept meadow gets an empty one: no `KEEP_VERSION` bump. `shapeVessel` puts the raw vessel in
  a fire, `kitTick` hardens it only while that fire is lit and emits `'fired'` (a toast, "Your clay pot is ready"). game.js: a
  clay button 🏺 left of the fire button (`#make`, shown with clay in the satchel or something firing; C) opens a tiny menu
  (`makeMenu`: what each takes, what's firing and how far); shaping takes the clay and needs a lit fire within `MAKE_NEAR`, else
  the camp's lit fire. The cooking window has a row of vessels (`#cook-vessels`, `pickVessel`, `cookVessel`; stick, stone, bowl
  always, pot and pan once owned; extras beyond the slots go back), the book's dish button switches to its vessel or says "Make a
  clay pot first", `potWord` says "Boiled in the pot, this is …" for a known dish in another vessel, and `potToward`/`potPossible`
  keep to the vessel. Looks: the pot keeps its close-up; the others are plain shapes over the fire (`vesselFlat`: a clay disc,
  a grey stone, a wooden bowl, a stick across), no water, splash or spoon. Played through in the browser: shaped and fired a pot,
  cooked Wilted greens in it, Roast mushrooms on the stick. Two seeds, two years headless: nothing died out, pack/unpack round-trips.
- **Left:** guests can't shape clay (they're told to in their own meadow; a guest crafting through the host like `sendFire`
  isn't built, and a guest's kit is whatever the world's forager has); the raw vessel isn't drawn at the fire; proper
  paintings of the pan, stone, stick and bowl in the cooking view, and of the clay button; the meadow's little pot over a fire
  (`drawPot`) is still a pot whatever is cooking.

## After that (roughly in this order)
1. **Cooking at the fire** and 2. **hunger and eating**: stage 6 above.
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
