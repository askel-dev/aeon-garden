# Plan: the first fire

Agreed with Axel on 2026-10-15. Build prompts for other sessions point here; each stage is its own branch and its own
commits, played and checked before the next. Read CLAUDE.md first (its perf rules are hard rules).

## Where we are
A cozy cooking game: a little hooded forager walks a painted meadow (click or tap to walk, hold to sprint), gathers
what the meadow gives into a satchel (mushrooms, greens, brambles, fruit and mast trees, hives, and the wild finds:
dandelion, sorrel, strawberry, elder, hazel, rosehip, watercress), and cooks with `recipes.js` (stage 6; stage 9 gives
the dishes a table). Pickables glint, the forager's sense makes them glint when it stands still, and an edge marker points
to the nearest. The pocket watch is gone.

## The feeling we want
A balance of cozy and survival, like Raft: you can die fairly easily, but it's still cozy. Cold nights are the reason
for a fire; the fire is the safest, warmest place in the world. The UI stays small: Axel wants to see the meadow, not
big cards.

### The dishes
The dishes are the best thing the game paints and the least seen: 128 px of painting shown at 48 in the satchel, and the
second and a half it takes to rise out of the pot. A bigger inventory only hides them better. A dish needs a **place** and
an **audience**: ingredients are what you carry; a dish is something you made, and it should leave the bag the moment it's
finished. Stage 9 gives every dish three homes — the hands, the table, the pot — and never a slot. It is the floor under
the three directions Axel liked: the table is the still life a season collects on, the surface a meal is laid on, and the
place a visitor is fed.

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
- 5 sticks burn about a game day dry (17 game hours in rain), then embers about 2.4 hours, then cold. By a fed fire every night
  ends cosy; by 5 sticks alone a winter night ends at 0.1 to 0.75 warmth; with none, winter and rainy spring nights kill.
- Nights made much darker (game.js `DARK` 0.55 to 0.88, a deeper navy) after Axel looked, so the fire's pool is the cosy
  place; its light reaches further (`LIGHT_TILES` 6 to 8, a gentler falloff), and its warm light on the forager is softer
  (it washed it out).
- Played in a browser and timed (no measurable cost). Left for a refinement pass: the look of the pool and flames, the
  sounds. A stick burns twice as long since 2026-10-19 (`FIRE_STICK`, `TPD / 10` to `TPD / 5`): five sticks carry a fire
  from dusk to the next dusk.

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
- The ring: `CAMP_R` 5 tiles about the fire (3.2 till 2026-10-17), `CAMP_FLAT` 0.8 as deep as wide (`inCamp`, for the builds to come), drawn as a soft
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
- **In the satchel:** a dish is kept by its name, and shows its painting (below). This is the fallback: stage 9 makes
  the hands and the table a dish's home, and the satchel what carries one.

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
   then it arcs down into its satchel slot, which bounces as the count ticks up. (Stage 9: into the hands, or onto the
   table; the satchel only when neither can take it.)
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

### Vessels, clay and crafting (planned 2026-10-17, Axel's ideas; his answers settled below)
Not every dish boils: today all the fire's dishes cook in the one iron pot (a fritter "boils"), and the `at: 'pot'` dishes
can't be cooked at all. So each dish says what it's cooked in, the pot and a pan are made of clay by the forager, and you
switch between what you have at the fire.
- **Settled:** a stick and a hot stone are free from the start (the first fire still gets its first cook: roast mushrooms,
  baked apple); the clay pot and a clay griddle (the pan) are what you work toward. Made vessels live at camp, painted
  sitting by the fire, yours for good, usable at any fire; never in the satchel. A clay vessel is shaped from clay (a raw
  one), then left in a lit fire a while to harden, with a small moment when it's done.
- Pieces, each its own branch (1 and 2 can go side by side; 3 before 6, 4 before 5):
  1. **The spoon in the water, the things swirling** (game.js `drawCookView` only): the spoon's bowl drawn inside the water's
     clip under the broth's tint, the handle over it with a ripple where it goes in; while cooking the things circle with
     the spoon, in front or behind it by depth, dragged along in its wake. (Opus)
  2. **The pot made of clay:** `kw.back`/`kw.front` repainted handmade earthenware (a wobbly rim, coil lines, thumb marks,
     soot up the belly, no iron legs, sat on the stones). Old against new to Axel first. (Opus)
  3. **What each dish is cooked in:** a vessel per recipe in recipes.js (pot: soups, teas, compote, syrup, wilted greens;
     pan: fritters, toasted nuts, garlic mushrooms; stick or stone: roast mushrooms, baked apple; maybe a bowl, no heat, for
     the salad), checked by `checkRecipes`, a small vessel mark in the book. Fits with `STATIONS` (the oven stays a station
     of its own). (Sonnet)
  4. **Clay:** a `ground` find on muddy banks and shores like pebbles (sim.js `FINDS`, a tag `clay`), an items.js painting,
     its Finds page; a few years headless and a `packWorld` round-trip. (Sonnet)
  5. **Crafting:** `CRAFTS` beside `BUILDS`, a "Make" side to the build button (`renderBuild`), the raw vessel fired in a
     lit fire, what's made kept on the forager (`f.kit`, in its blank layout; `KEEP_VERSION` if a kept meadow can't take it),
     a guest crafting through the host like `sendFire`. (Opus)
  6. **Switching vessels:** a small row of what you have in the cooking window; a dish picked in the book takes the right
     one; the pot line says when a dish wants another vessel; the pan its own close-up (shallow, sizzling, a toss) and the
     stick its own (turning over the flames). Maybe two branches: the pan, then the stick and stone. (Opus)

### Vessels, clay and crafting: pieces 3 and 4 built (2026-10-17, branch `claude/vessels-clay-f8287b`)

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
- **Left:** the barebones list is done by the two polish passes below.
- **Cooking close-up polish (2026-10-17, branch `claude/cook-polish-390dff`).** Only the cooking window's canvas (game.js
  `drawCookView`). The pot is handmade earthenware now (`paintCookPot`: terracotta, a wobbly rim `wobble`, coil lines, two thumb
  marks, soot up the belly, two lugs, no iron legs, sat on the stones). The spoon's bowl is drawn dim under the water and broth
  (`spoonPart`), its handle out of it with a ripple where it goes in; while cooking the things go round with it (`kw.sa`, `kw.sr`,
  `kw.mix`: pushed on as it comes by, spreading evenly) and are drawn back to front with the handle among them (`kw.ord`); a tap
  still takes one out (`kw.hx`/`kw.hy` are where it's drawn). Each vessel has a place (`kw.at`: where its things sit, `potX`/`potY`
  follow it, its hover ring, glow and steam) and a painting made once a size when first wanted (`vesselArt`, `VESSEL_PAINT`): the
  clay griddle (things hop as they sizzle, spits of fat: `spit`, `kw.dK`), the hearth stone (heat wisps), the stick on two forked
  sticks (things threaded on it, turning: squashed, knots going round), the carved bowl set down in front of the fire (no steam).
  Things brown as they cook on all but the bowl (drawn again over themselves, 'multiply'). `vesselFlat` is gone. A frame is a few
  more strokes and one more draw a thing than before; not timed (the window's own small canvas).
- **Meadow polish and guest crafting (2026-10-17, branch `claude/meadow-vessel-polish-7729eb`).** The vessels are painted in game.js
  `paintVessel` ('vsl:' + n, `VSL_PARTS`/`VSL_ARTS`, sprite cache): a handmade terracotta clay pot (back and front, finger
  grooves, soot), the clay griddle, a hot stone, a spit on two forked sticks, a wooden bowl, and the pot and griddle whole in
  `VSL_STEPS` (4) steps from pale raw clay to fired. Over a fire (`drawPot`, `drawAwayPots`) the vessel in use shows (`VSL_LOOK`:
  back, front, where things stand; a pot left cooking goes by its dish, `DISH_VESSEL`; a mess is the pot), and the bobbing
  prompt shows the vessel the window would open with (`openVessel`) or a done dish's. A vessel firing sits in the front coals
  of its fire with an ember glow, a painting a step (`drawFiring`), and comes out with a bloom, a puff and sparkles
  (`firedUi`, `FIRED_MS`). Made vessels sit by the camp's fire, the pot right, the griddle left, not the one cooking
  (`drawKitAt`). Clay is an items.js painting (a wet lump with a thumb dent); the clay button is the fired pot (`makeIcon`).
  `paintPot` (the iron pot) is now used by nothing in the meadow. Guests shape clay: a guest's kit is its own, emptied as it
  arrives (`arrive`) and kept with its satchel through a reload (`keepAwayBag`, `awayBack`); the fire is the meadow's, run the
  same on every side, so it hardens exactly as the host's fire burns. A `fire` message 'shape' lets friends see it in the fire
  (`netFiring`; drawn by ticks gone by, not counting a spell with the fire out). A guest's vessels go when the visit ends.
  Not tried live with two players (only checked by reading); the paintings checked in Chrome. sim.js untouched.
## Stage 7: making things (one make button), and torches (planned 2026-10-19)

The fire button and the basket button each build one thing; a button a build would fill the satchel's sides. So the
builds go behind **one make button**, and the first new build is a **torch** you stick in the ground anywhere.

### The make button
- One round button where the fire's is now (`#build`). Its painting and its filling ring are the build most worth doing
  now: the campfire until the first fire is lit, then the basket (in camp, until it's made), then whichever is most nearly
  ready. So the storm opening looks and plays exactly as it does today: one button, a campfire in it, filling up.
- A tap, with only one thing it could make (before camp): what the fire button does now. Otherwise it opens a small
  **make strip** just over the satchel, like the basket's card (`#larder`): one tile a build, its painting, its name, and
  what it takes as little item chips with have/need (`2/5` sticks); ready ones bright, the rest faded with the ring.
  A tap on a ready one shuts the strip and starts placing it (`ui.place`, as the fire and basket do now); on one not
  ready it says what's missing (`missingWords`). ✕, Esc, Back or walking off shut it. A row of tiles wraps, so ten
  builds still fit in a small card.
- Keys: **C** opens the strip, **F** stays the quick campfire (and blowing at a fire). The basket's button stays, but only
  as "open the basket" once it's made; making it moves into the strip.
- Data: `BUILDS` gains a few optional fields so a new build is a block and a painter: `where` (`'camp'` or anywhere),
  `after` (`'camp'`, or a skill level like CRAFTS `level`), and the painting by id (like `Items.paint`). `checkRecipes`
  checks them. The game still needs code for how each build is placed and what it does; a generic "set it down"
  (kneel, `LAY_MS`-ish, done) covers small things like the torch, and the fire and basket keep their own.

### Torches
- **Takes** 1 stick and 1 birch bark (bark torches are a real thing, and it gives bark a use beyond tinder). Cheap on
  purpose: you make several.
- **Placed** anywhere within `PLACE_REACH`, not in deep water, on a tree or a rock (a `torchSpot` like `fireSpot`, but
  closer spacing is fine). The forager kneels, pushes it into the ground, one strike, and it's lit. No blowing.
- **Burns** about a night (half a day, 6 min at 1x), shorter in rain (`BLOW_WET`-like table), then gutters to a charred
  stub that's gone by the next evening. At most `TORCH_MAX` (12) at once: a 13th, the oldest gutters out.
- **Gives** light, no warmth (the fire stays the warmth). A small pool cut out of the night (a lantern's, not a fire's:
  radius ~40% of `LIGHT_TILES`), so you can mark the path home, the hive, a good mushroom patch. The forager's rim
  light already follows any pool (`fireReach`).
- **Sim**: `w.torches` (in `LATER`, one layout each: `torchOf` { x, y, born, burn, wet }), `torchTick` run every few
  ticks, never a scan of creatures. `unpackWorld` gives an old meadow `[]`: no `KEEP_VERSION` bump. Packs as plain data.
- **Drawn**: a painted torch (stick, wrapped bark, a charred tip) in the sprite cache, a small flame from `FLAME_ART`
  scaled down, its glow with the fire's (`drawFireGlows`). `lights` grows from 4 to ~16 slots, nearest on screen first;
  the pools are already one picture (`SKY_FIRE`) repainted only on a flicker step, so more of them costs a few draws in
  that picture, not a new pass. A faint crackle only when standing close (sound.js, reuse the fire's at low gain).
- **Playing together**: a `fire` message `'torch'` like the basket's, so friends see it set down; the host's sim burns it.
- **Not now** (later, if it's fun): carrying a lit torch in hand, relighting a burnt one, torches scaring foxes off.

### Building it
1. The make button and strip, with only the campfire and basket in it (no new content). Check the storm opening still
   reads the same, and the phone layout (44 px tiles, a sheet on an upright phone).
2. Torches in the sim (`w.torches`, place, burn, pack/unpack round-trip) and a few headless years.
3. Torch painting, flame, light, sound, net. Measure a night at speed with 12 torches lit (a new thing drawn a frame).
4. After that a new build is data plus a painting: the seat log, the drying rack, the lean-to (After that, 3).

### The make button and strip built (2026-10-19)
- recipes.js `BUILDS` has `where` (left out: 'anywhere'; 'camp') and `after` (left out: at once; 'camp'; or a Cooking
  level), checked by `checkRecipes` (`BUILD_KEYS`, `whereOf`). The campfire is `where: 'anywhere'`, the basket
  `where: 'camp', after: 'camp'`.
- game.js: `#build` is the make button (`renderBuild`, `buildFocus`): the campfire in its painting and ring till the first
  fire, the basket till it's made, then whichever is most nearly ready (`buildHave`'s share). `makeList` leaves out what
  `after` holds back, the basket once made, and a guest's basket. Before a camp there's only the campfire, so a tap does
  what the fire button did (C still opens the strip, a tile); with more it opens `#make` (`openMake`, `renderMakeStrip`,
  `stripUi`), a tile a build with `BUILD_ART`'s painting (painted once and kept as a blob's address, `buildIconURL`), its
  name and what it takes as item chips, have/need (`2/5`), ready or faded with a ring. `startBuild` shuts it and places a
  ready one (`placeFire`, or `placeBasket`, now its own) or says what's missing (the strip staying open); ✕, Esc, Back, C,
  a tap elsewhere or walking off shut it (`makeFrame`). `ui.place.build` and `ui.fire.build` carry what's being made. F is
  `campfirePressed` (the campfire, and blowing at a fire).
- The basket's button (`#basket-btn`) only opens the basket once it's made; its making ring and `.making` CSS are gone, and
  its painting is the strip's.
- index.html: `#make`'s markup and CSS (a sheet just over the satchel, `width: max-content` with a `100vw` cap so it
  centres rather than taking only half the screen's width and wrapping; a 44 px ✕ and tiles well over a fingertip). The
  phone's rules sit beside the basket card's.
- Checked in Chrome: before camp the make button is the old fire button (painting, ring, words, F), no strip; after camp
  the strip's two tiles, chips, ready and faded states, the camp gate, ✕/Esc/Back/walk-off/C; the basket made, its button
  then only opening it, and the make button back to the campfire. At 386 px wide (an iframe) two tiles sit in one row with
  no overflow; the pointer-coarse tile and ✕ rules checked by reading. No console errors. (Not tried with two players;
  sim.js untouched.)

### Torches in the sim built (2026-10-19)
- sim.js: `w.torches` (in `LATER` as null, a new world gets `[]`), one layout each (`torchOf`: `x`, `y`, `born`, `burn`,
  `wet`), `torchSpot` (not the deep water; clear of a trunk, a rock, a burrow, a fire, the basket or another torch),
  `placeTorch` (lit at once, `burn` `TORCH_BURN` = half a day) and `torchTick` every `TORCH_EVERY` (15) ticks: quicker in
  the wet (`TORCH_WET`: rain 1.5, storm 2, snow 1.3), a negative `burn` is the charred stub, gone after `TORCH_STUB` (a
  day); a 13th lit torch gutters the oldest (`TORCH_MAX` 12). Events 'torchlit' and 'torchout'. It gives no warmth and
  draws no random numbers.
- Keeping a meadow: a torch packs as plain data and comes back with its fields (the `made` chain's `e.torch`); a meadow
  kept before them gets `[]` in `unpackWorld`. `KEEP_VERSION` stays 10.
- Checked headless (node): 15 laid in a row → 12 lit and the 3 oldest stubs, dry and rain burns, stubs gone after their
  day, pack/unpack through `structuredClone` with each field equal, an old kept meadow (torches deleted) opening with `[]`,
  and three years over seeds 1–3 with a torch laid each day: nothing the cooking needs died out (hives with queens, fish,
  frogs, rabbits), at most 2 torches kept at once and at most 1 lit, round-trip after the years. No drawing or game.js
  change yet.

### Torch painting (2026-10-19)
- game.js `paintTorch`, in `PAINTERS` as `torch:` so the sprite cache makes it once a size: a cut hazel shaft pushed into
  the earth, bowed and tapered, a roll of birch bark lashed to its head, the bark torn and blackened at the crown with
  embers still in it, and its brown inner edge and a chip or two. Three looks (`TORCH_ARTS`): 'torch:0' burning (the full
  head), 'torch:1' guttering (burnt lower, the flame smaller), 'torch:2' the charred stub (a short split, ashen end).
  `TORCH_SIZE` 2.0 next to a rabbit, `TORCH_FOOT` 0.72 in its box. Its sheet (large, at play size 20 to 48 px, guttering
  and stub) went to Axel to rate.
- The flame is drawn over it from a sharper set of the same three tongues (`TORCH_FLAME_ART`: 0.7 px blur against the
  fire's 2 px, brighter edges, so it keeps an edge at torch size), scaled down and centred on the charred crown, not on
  the leaning stick (`garden.torch.flame` in the console). Then still to come, in step 3: the crackle and the 'torch' net
  message (its glow and pool are built; see the note below).

### Torch placement (2026-10-19)
- game.js: `placeTorch(open)` beside `placeFire` and `placeBasket` (`ui.place.torch`, `build: TORCH_BUILD`); `placeAt`
  takes `S.torchSpot`'s word ("Another torch is here", "Too close to the tree", ...), and `startBuild('torch')` opens it
  from the make strip. `BUILD_ART.torch` is the painted torch (`paintTorch`), so the strip's tile and the make button
  have its picture.
- The ghost is `drawTorch`'s faint branch (the burning look at 0.6/0.3, no flame of its own); its reason is the label
  `drawFireHint` already lays by a faint one, and a torch's click doesn't say it a second time. `drawTorch` also draws the
  real ones with the trees and animals, sorted by y: the painting by what's left of its night (burning, guttering over
  its last fifth, then the stub) and the sharper flame over its crown.
- Setting it down is the generic one: the forager walks to its side and kneels (`fireFrame` 'torch' → 'set',
  `TORCH_SET_MS` 900), spends 1 stick and 1 birch bark (`spendBuild`), pushes it in with a stick sound, one strike
  (one, whatever the wet), and `S.placeTorch` lights it at that strike; then it watches it take (`lit`). `kneelNow` has
  its 'set' pose, and `atFire` counts it, so a press while setting it down doesn't walk away.
- Checked in Chrome (headless, CDP, a new meadow with the opening storm): the make strip's Torch tile, the faint ghost,
  its "Too close to the tree" and "Another torch is here" reasons, then a clear spot: the forager knelt, one stick and
  one birch bark went, the strike lit it, `world.torches` had it (`burn` 10590, `wet` 2 in the storm), the satchel went
  from 3 to 2 of each, no JS errors. Still to come: the crackle and the 'torch' message to friends (its light pool is
  built; see the note below).

### Torch light (2026-10-19)
- game.js: a lit torch is now a lantern in the dark. `lightsFrame` gathers the fires as before, and every `world.torches`
  entry with `burn > 0`: a burning torch glows 0.55, a guttering one (its last fifth, `TORCH_BURN * 0.2`) 0.30, and the
  charred stub none. Its pool is `LIGHT_TILES * TORCH_LIGHT`, with `TORCH_LIGHT` 0.4 of a fire's, times
  `(0.85 + 0.15 * glow)` — no camp bloom, no sqrt — laid on the ground at its foot (`sy - torchPx(z) * TORCH_FOOT *
  0.5`); its alpha is 0.62 burning and 0.42 guttering. Each torch flickers on its own phase from `T.born`, faster and
  smaller than a fire's (`0.85 + 0.1 * sin(step / 3 + born) + 0.05 * sin(step / 1.3 + 2 * born)`, the same `step` as the
  fires, so the cached sky still repaints only on a step), so twelve torches don't pulse together. It gives no warmth:
  `snowMelt` still takes fires only, and sim.js didn't change.
- `lights` grew to `LIGHT_MAX` (16) in every array (it was a literal 4 in three places). `lightsFrame` now keeps the
  nearest lights to the middle of the screen, fires ahead of torches at the same distance, in a bounded insertion over
  the reused arrays, so a frame allocates nothing; both kinds are `visible`-culled first, so a row of twelve torches off
  screen can't eat the slots. `fireReach`, `fireLight`, `paintFireLights` and `lightForager` read the arrays as they are,
  so the forager's rim and the warm cast follow a torch automatically — at its lantern alpha, dimmer than a hearth's.
- `laySky`'s cached-picture snapshots (`sky.was` / `sky.now`) went from 96 to 160 numbers: a night lays 10 + 5 * 10 layers
  + (1 + 3 * `LIFT_MAX`) lifts + (1 + 4 * `LIGHT_MAX`) lights = 144 at most. At 96 the far lights were silently dropped
  from the compare, so the sky would have repainted every frame at night. The weather clock is left out of the snapshot
  when there is no cloud or fog layer for it to move, so a clear night repaints on the flicker step, not every 50 ms.
- Measured in headless Chrome (M5, 30 fps calm, night, camera still): 12 torches on screen repainted the sky 56 times in
  152 drawn frames over 5 s — the 5000 / `FLICKER_MS` flicker steps (55) and no camera moves, not one a frame. Render
  time over 300 frames was 1.62 ms with 12 torches against 1.44 ms with none (+0.17 ms a frame, +12%; medians 1.6 and
  1.4; a second pair read 1.75 against 1.47). A 5 s heap sample showed no allocation in `lightsFrame` or `lightAdd`
  (the top was `updateWater`). By eye and in Chrome: one torch with no fire cut a pool out of the night, the forager's
  rim faint at 2 tiles and dark at 6, guttering dimmer and the stub none; 12 torches and 2 fires all lit, 12 off-screen
  torches and 1 fire left the fire lit, 18 candidates capped at the nearest 16; `?split` lit the close-up on the torch's
  side and stayed on it after the camera moved; 386 px wide with 12 torches had no overflow and no console errors.
- Playing together: the host's world snapshot already carries `world.torches` (`S.packWorld`), and a guest runs the same
  sim at the host's tick, so a torch that was there is lit on both sides. The light is render-only and sends nothing.
  Still step 3: the crackle (sound.js) and the 'torch' net message, so a torch set down after the snapshot reaches friends
  without waiting for another world.

### Birch bark a little commoner (2026-10-19)
- It was the rarest thing on the ground and the one thing a torch needs one of: at most 5 about (`most`, times `w.room`), but
  only ever under a birch's crown (`findPlace` 'birch', `inCrown`), which is a small target for `findSpot`'s few random tries,
  so most meadows sat at 3 to 5, and a pick gave 1.
- sim.js: a bark lies under a birch or within `BIRCH_NEAR` (2.6 tiles) of its trunk, standing or fallen (`birchNear`, the
  same ellipse as `inCrown`), so the birches a meadow does have actually fill up; and `FINDS.birchbark.n` is 2, as sticks,
  pebbles, dry grass and clay already were. `most` stays 5: it's still the rarest ground find, but a stop is worth a torch.
- Six seeds, a year: 5.8 to 7.8 bark about at a time (was 3.5 to 6.3), 25 to 35 sheets coming up a year, 50 to 70 if all
  picked (was 15 to 29). From the camp the nearest is as near as it was where birches grow near it; where it isn't (one seed
  in four), the walk now buys two sheets, not one, and the camp's own bark covers a campfire's tinder (2) on its own.
- Three seeds, two years: nothing the cooking needs died out (hives with queens, fish, frogs, rabbits), the other ground finds
  stand as they did (sticks 29 to 46, pebbles 13 to 14, dry grass 7, clay 7 to 8), pack/unpack round-trips. No `KEEP_VERSION`
  bump: a kept meadow's finds are plain data. recipes.js's birch bark `where` and `.claude/docs/plants.md` say the new place.

### A torch's crackle, and a torch to friends (2026-10-19)
- sound.js: `state.torch` and `state.torchPan`, fed beside `fire` and `pot` in `Sound.update`. `tickAmbience` rolls
  `crackle` at `3 * state.torch` a second at `0.55` of its gain, from the torch's side of the screen, and `crackle` grew
  a `pan` (the fire's own still comes from the middle). It's the same dry snaps with no roar under them, so a torch
  reads as a lantern while a campfire still owns the low bed of noise.
- game.js `torchSound()` (beside `fireSound`): the nearest lit torch to the middle of the screen, quieter as it gutters
  (`TORCH_BURN * 0.2`, the same fifth `drawTorch` uses) and with zoom clamped as a fire's, returning its level and pan.
  The charred stub is silent.
- Playing together: the strike now sends the torch (`sendFire('torch', j, 0, 0)`), and `fireNet` takes `m.a === 'torch'`
  by `S.placeTorch`-ing it where it stands with the night it has left (`TORCH_BURN - (world.tick - m.tick)`), unless one
  is already there. `meadowSum` now counts the torches too, so a side that misses one is caught at the next check and
  asks for the meadow again, rather than the two quietly differing. (Before this, torches were left out of the sum, so
  nothing would have noticed.)
- Checked: two tabs of one headless Chrome (`?room=..&local`, BroadcastChannel, the wardrobe set off in each): host
  placed one, the guest had it at the same spot and the same burn; the guest placed one, the host had it; both ended
  with both, no console errors, and both burns drained together. The real strike path (kneel, one stick and one bark,
  strike) was driven in Chrome and lit its torch as before. The crackle: 3 s with a torch two tiles off made 10
  crackles (the stacks through `crackle` and `out`), and none with no torch. Not tried over PeerJS with two machines.
- That closes step 3 of stage 7. Step 4, the camp builds, is the note below.
- Step 4's seat log was done on its own branch (the bench, its turns, and sitting on it: see the fire-camp notes).

### The camp builds (2026-10-20)
- **The drying rack** (recipes.js `BUILDS.rack`: 8 sticks, 3 dry grass, 1 birch bark, `where: 'camp'`) and **the lean-to**
  (`BUILDS.lean`: 10 sticks, 5 dry grass, 2 birch bark) join the seat log in the make strip, one each. Both are placed the
  basket's way, inside the camp ring, and both are scenery you walk through: sim.js `campSpot` is the basket's spot
  generalised (its messages unchanged), and `makeRack`/`makeLean` are what game.js spends for and calls.
- **The rack is a second store** (12 slots in `worldStores` after the basket). `stackOf` now scales a store's keep by its
  `kept`, so the rack's `kept: 2` means a slot holds twice a basket slot's stack; the basket's `kept: 1` is exactly what it
  was. It opens the basket's card (`larderUi.store`, `larderStore`), which names itself "Drying rack" and fills from the
  rack; `putAway` takes the store it fills. Its food look (`rack:1`) is chosen once it holds anything.
- **The lean-to shelters**: `underLean` is an ellipse under its roof, and `bodyTick`'s shelter is all of it there (no rain
  soak, little wind; `LEAN_SHELTER` is the soak's own 1 - 0.7·shelter at nought). Building it moves the forager's home
  under the roof, so a collapse wakes there.
- **Friends**: both go over `sendFire` as `'rack'`/`'lean'` (fireNet makes them), and the camp's stores are shared as a
  snapshot: `storesWas` before a move and `sendStores` after diff each store's slots into `'bk'` messages with a `w` field
  (`'basket'`/`'rack'`), so two people moving different things both land. `meadowSum` counts both builds and the rack's
  slots, as it does the basket's.
- Not in this step: the cooking window's camp row still shows only the basket's things (the rack's tiles there are a later
  refinement), and the spit, lantern and bedroll stay later.

## Stage 8: the camp grows (planned and the deeds settled 2026-10-20; mockup `camp-level-lab.html`)

The camp becoming a home is the heart of the game, so the camp should visibly grow. It has five levels, and a level is
**a place you build** (its keystone), not a number you reach. The mockup has two views: your camp as you built it, and
the plan of what each level opens.

### The rules
- **Levels unlock things; they don't hand them out.** Raising the camp widens the ring, lays the keystone, does one
  real thing, and may bring a small gift that is only scenery (season dressing, a robin, wind chimes). Everything that
  does something is opened by the level and then made by you, from the make strip. A level V camp where only a basket was
  made shows a basket.
- **Cosy is a list of deeds, each earned once** (`w.camp.cosy`: the set of deeds done; the count is their sum). Every
  point has a name the camp's card can show, nothing repeats, and cosy never goes down. Raising the camp takes
  **8 · 18 · 28 · 40**, then its keystone. The deeds are data (recipes.js-style; Axel tunes these) and the table below
  is all of them: **60 points** with every build in, **56 alone** (the friend deeds are never needed), and **52 alone
  before V**.
- **The ring only grows.** `CAMP_R` is 5 and stays the floor: 5 → 5.5 → 6 → 6.5 → 7 (`campR(w)` in place of the
  constant, `inCamp` and the ground shader's `camp` ellipse following it). A kept meadow opens at level I with the deeds it
  has already done counted (camp, basket, seat, torches); nothing placed today ends up outside the ring.

### The deeds, exactly
A deed is earned once and never lost. The level in the table is when it first becomes possible, not when it's awarded,
and a build worth points is worth them once however many you make (torches included).

| Deed | Points | From |
|---|---|---|
| **Making the camp** | | |
| Made camp (the first fire) | 2 | I |
| Wove the basket | 3 | I |
| Set the seat log | 2 | I |
| Set a torch in the ground | 1 | I |
| Laid the hearthstones *(keystone)* | 2 | II |
| Built the drying rack | 2 | II |
| Raised the lean-to | 2 | II |
| Built the clay oven *(keystone)* | 2 | III |
| Built the spit | 2 | III |
| Planted the herb pots | 1 | III |
| Raised the lantern arch *(keystone)* | 2 | IV |
| Hung the bird feeder | 1 | IV |
| Put up the notice board | 1 | IV |
| Built the cabin *(keystone)* | 3 | V |
| Hung the hammock | 1 | V |
| **Cooking** | | |
| Cooked the first dish at camp | 2 | I |
| Five different dishes at camp | 3 | I |
| Twelve different dishes at camp | 4 | I |
| Ate a meal sitting on the seat log | 1 | I |
| **The fire** | | |
| Kept the fire lit from dusk to dawn | 2 | I |
| Kept the fire lit through a storm | 3 | I |
| The first fire of each season (four deeds) | 2 each · 8 | I |
| **The basket** | | |
| Filled half the basket | 2 | I |
| One of every kind of food in it | 4 | I |
| **Friends** (never needed) | | |
| A friend sat by your fire | 2 | I |
| A friend ate your dish | 2 | I |

**Totals:** making camp 27 (the camp 2, the builds 25), cooking 10, the fire 13, the basket 6, friends 4: **60 all in,
56 alone**, and 52 alone before V (the cabin and the hammock are V's own opens).

**The cheapest routes.** Everything before V is cleared by what's in front of you, with no storm and no season but the
one you're in: II is 2 + 3 + 2 + 1 (camp, basket, seat, torch); III is that 8 + the hearthstones 2 + the first dish 2 +
five dishes 3 + eating on the seat 1 + one season's fire 2 (18); IV is 18 + the oven 2 + the rack 2 + the lean-to 2 +
dusk to dawn 2 + half the basket 2 (28). V is 28 + the arch 2 + the spit 2 + the herbs 1 + the feeder 1 + the board 1 +
twelve dishes 4 (39), and one more thing to live through: a storm (3), another season's fire (2) or the basket kept
through a year (4). That's the last level's point, and any of the three will come.

**What the gates leave.** Before each gate, the most cosy there is to be had:

| Gate | Needs | slice one as planned | + rack and lean-to | + every build |
|---|---|---|---|---|
| II | 8 | 37 (22%) | 37 | 37 |
| III | 18 | 39 (46%) | 43 (42%) | 43 (42%) |
| IV | 28 | 41 (68%) | 45 (62%) | 48 (58%) |
| V | 40 | 43 (93%) | 47 (85%) | 52 (77%) |

The old 30 for IV was 73% of slice one's 41: a wall, because the builds that should carry the ladder don't exist yet.
With the rack and the lean-to in slice one it's 62%, and a player can skip a whole category (the storm, or the twelve
dishes, or the basket's year) and still raise the camp. V is 93% in slice one alone, which is why it waits for its own
builds (and why the card says "to come" until it has them).

**What a deed means.**
- **The first fire of each season** is earned when the camp's fire burns at any point in that season, not only when it's
  lit: a fire kept over a season's turn earns the next one, 2 each, four times.
- **Through a storm** is the camp's fire lit at the storm's start and its end with no gap. `WEATHER_ODDS` brings them
  often enough that it's "be at camp when it blows", not a rare event.
- **Different dishes** are distinct dish names cooked at a fire inside the ring, a set on the world (not in
  localStorage, or a friend's visit wouldn't count); the mess isn't one.
- **Half the basket** is 16 of its 32 slots. **One of every kind of food** is one of each of the 20 `INGREDIENTS` with
  `fill > 0` at once: a year's deed (cherry in summer, apple and acorns in autumn, watercress in winter, garlic in
  spring), so it's worth 4 and never needed.
- **Whose cosy** is the meadow's: the camp is shared, so both players see one level and the friend deeds only mean
  "someone else sat by the fire" and "someone else ate your dish".
- **The hearthstones** should read as a flagged hearth (flat stones laid round the fire), not another ring of stones:
  the fire already has one (`fireOf`).

### The keystones and what they open
The keystones are builds with `where: 'camp'` and a new `raises: n` in recipes.js `BUILDS`, offered once the cosy is
there. II–IV cost only things that lie about already:

| Level | Name        | Keystone        | At | Costs                                | Its one real payoff                                   |
|-------|-------------|-----------------|----|--------------------------------------|-------------------------------------------------------|
| I     | Campfire    | the first fire  | —  | as now                               | home: you wake here after a collapse (already true)   |
| II    | Hearth      | hearthstones    | 8  | 12 pebbles, 2 clay                   | a stick burns a third longer at the camp's fire       |
| III   | Homestead   | the clay oven   | 18 | 8 clay, 10 pebbles, 4 sticks         | baking (see below)                                    |
| IV    | Hollow      | the lantern arch| 28 | 12 sticks, 4 birch bark, 2 clay      | the ring keeps a steady light at night                |
| V     | Meadow Home | the cabin       | 40 | logs (a new item), pebbles, clay     | dry and warm inside, and where you wake               |

The costs are near the top of what a meadow holds (`FINDS`: pebbles `most` 9 and clay 5, 2 a pick, 12–24 days for one
to come back; II and III together want 22 pebbles and 10 clay), so check them before slice one and lean on sticks, grass
and bark if the walks get long. III's baking is a `STATIONS` entry only: nothing is cooked `at: 'oven'` yet, so its
recipes come with the oven. II's longer burn is a per-fire rate (`FIRE_STICK` is read in 16 places; the fuel pips and
the painting's sticks follow it).

- **What each level opens to make** (one or two each): I basket, seat, torch (built), the table (stage 9); II drying rack,
  lean-to (in slice one too: `plans/camp-builds`); III spit, herb pots; IV bird feeder, notice board (the first-things
  notes pinned up); V hammock.
- **Gifts** (scenery only, painted once, no store): III season dressing (a pumpkin by the seat in autumn, snow lanterns in
  winter, a jar of flowers in spring); IV a robin hopping round the camp; V wind chimes on the eaves (a few notes in
  sound.js when the wind turns), a pennant in the season's colour. A path worn to where you go most waits: it's a
  footfall map in the sim and a ground repaint, not scenery.

### How it shows
- **The line over the satchel** stays one thin pill: hovering the ring, away from the fire, says "Your camp · Hearth ·
  14 / 18 cosy". A tap on the line opens the camp's card. The fire stays "see to it": no second click target beside it.
  A touch screen has no hover, so there the line sits in the satchel's sheet and while the forager is in camp, and it
  gives way to whatever is under the hand (the fire, the basket, a torch).
- **The camp's card** (small, over the satchel, ✕ at the foot on a phone): the level's seal and name, the bar with its
  number (no pips), "4 more, then build the clay oven", the deeds done with their points, and the next two not done
  shown faintly, so the bar says what to go and do.
- **The make strip** stays "what you can make now", plus one faded tile: the next keystone ("raises the camp · 14/18
  cosy"). The levels after that live in the card.
- **The moment**, when a keystone is finished, is the "Your camp" one grown a step: flare, the ring of earth spreading
  out half a tile with a wave of light, the felt piano, "Your camp grew ✦ Homestead ✦", and chips saying only what
  happened ("the ring widens · the oven is fired · 2 new things to make").

### Slice one
Cosy and its deeds, the five levels, the ring growing, the keystones II–IV, the moment and the card. The drying rack and
lean-to come with it: they are level II's own opens, already specified (`plans/camp-builds`), and without them II opens
nothing and IV would be 73% of everything slice one holds. V waits for logs, and until its keystone exists the card says
"the meadow home · to come" with no bar (a camp at 43 shouldn't be told to build a door that isn't there). The payoffs
for II–IV come in slice one too (each is one small change to a system that exists). The builds the later levels open
come after it, one at a time, as "data plus a painting" (stage 7).

The sim keeps one layout: `w.camp` gets `level`, `cosy` and the keystones' fields in its blank from the start, and a
kept camp gets them in `unpackWorld`. Cosy and the level are **derived** from the deed set and the keystones built
(stored as data, summed in one place), so a tuning pass can't leave the three disagreeing. A kept camp counts only what
it can see it did (camp, basket, seat, torches); the rest is earned again.

**The ring.** `campR(w)` reaches further than `inCamp`: the ground shader's `camp` uniform (`campGround`), the ring art
painted once at `CAMP_R` (`campArt`), the ring's drawing and its `visible` test, and the ring/motes/bits animation. A
level's spread gets its own state (`campShow` keys on the camp's creation, not on a level).

**Checked by:** `checkDeeds()` beside `checkRecipes` (every deed names a thing that exists, the points are whole numbers,
and each gate is cleared by ≥ 8 points of slack from the deeds open at that level), a kept-meadow round-trip with the
deed set in it, and `garden.cosy(n)` in the dev panel so the card and the moment can be seen at every level. The
cheapest routes above are the test: every gate before V is cleared without a storm and without a season but the one it's
played in.

### Later, not in this stage
Each of these touches another system and waits for its own stage: the table (stage 9), sleeping through a night (the
forager has no sleep), a cellar where nothing spoils (nothing spoils), visitors stopping by a free seat at the table
(stage 9, "After that" 5), foxes going round the ring and a scarecrow for the crows, the camp on friends' minimaps, the
notice board's requests and a bell, a garden bed, a rain tarp, morning gifts, naming the camp, the path worn to where you
go most (a footfall map in the sim, and a ground repaint).

## Stage 9: the table (planned 2026-10-20)

A dish is the best thing the game paints and the least seen: 128 px of painting shown at 48 in the satchel, and the
second and a half it takes to rise out of the pot. The fix is not a bigger inventory; it is a place and an audience. This
stage gives every dish three homes — **the hands, the table, the pot** — and never a slot. It is the floor under the three
directions Axel liked: the table is the still life a season collects on, the surface a meal is laid on, and the place a
visitor is fed. Build it first; each of those is then a small layer. Axel couldn't choose between them, and doesn't have
to: the table is the common floor. The first slice is the hands and the table; the still life, the shared meal and the
visitor come after it in whatever order the play asks for.

### The rule
- **Out of the pot, in this order:** the forager's empty hands, else a free place on the table, else the satchel (for
  carrying; a dish can still travel), else it waits in the pot. A done dish never flies to a tile unless there is nowhere
  better: the satchel is the fallback, not the home.
- **One dish in hand.** The forager carries it where you can see it (a new `f.hand`, `FORAGER_HOLD` in fur.js, a curl of
  steam), and a second dish cannot be held: it waits in the pot or goes on the table. Walking, sitting, eating, offering
  and giving all use it. If the hand, the table and the satchel are all full, the pot keeps it.
- **A dish on the table is a thing in the world.** It is painted, it stays (nothing spoils), it can be picked up, eaten,
  given, or taken by a friend. It is not a storage row: it is the dish's place.
- **The pot keeps a done dish** as it does now (`drawAwayPots`), so there is always somewhere for one to wait.

### The table
A new `BUILDS.table` (`where: 'camp'`, `after: 'camp'`): a low table of split sticks lashed with dry grass on two stumps,
a flat stone or a board on top. **8 sticks, 2 pebbles, 4 dry grass**, early enough to come right after the basket and the
seat; it earns no cosy for now. A `TABLE_SIZE` of about 2.6 x 1.5 tiles, solid like the seat, placed with `ui.place` and
turned in its steps as the seat is (`TABLE_TURNS`; `TABLE_ARTS` painted once). It has **6 places** on top, in the table's
three-quarter view (two rows of three), each a fixed point in the painting.
- **Setting a dish down:** with a dish in hand, a tap on the table sets it on the nearest free place (a drag from the
  satchel can aim one), with a small clink and a puff of steam. A tap on a dish lifts it back into the hand; the line's
  Eat (the satchel's `eatAsk`) or a second tap on it in the hand eats it. A tap on the table with an empty hand and no
  dish does nothing.
- **The table view:** a click or tap on the table walks there and eases the camera in (`tableCam` in `leadCam`, about
  `TABLE_TILES` 4.5 across, 3.2 on an upright phone, at most `TABLE_MOST` 220: the same easing as `cookCam`, no window,
  no scrim, the meadow still behind). The dishes are then 90-130 px on a computer, 60-75 on a phone, sizes the paintings
  were made for. A tap elsewhere, ✕, E, Esc or Back steps back out. The line over the satchel names the dish under the
  hand ("Warm bramble compote · Eat · Take") and the meal, if there is one.
- **Sitting:** the seat log is the chair. Placed within `TABLE_SIT` (2.2 tiles) of the table, sitting at it faces the
  table and the table view eases in (the existing `sit`, `SEAT_*` poses). Without a seat you stand and eat; the table
  works the same, it is just less of a moment.
- **Far away:** zoomed out the dishes are too small to paint, so the table is one painted table (`TABLE_ARTS`) and the
  dishes and their steam show only when `z * 0.55 >= 3` px (as other details). Nothing is painted per frame; the table and
  its dishes are 7 cached draws at most, and the steam is one shared curl a warm dish.

### The meal
The reason to cook variety rather than the one most filling thing, and the reason a table is a *cooking* surface and not
a shelf. `MEALS` in recipes.js, a new table beside `RECIPES`: each a set of 2-4 dishes by name. (Tags can come later if
dishes grow them; names keep it copy-a-block.) 3-6 at first, one for each season and one for the first night; Axel's to
tune:
- *A forager's supper*: Roast mushrooms, Wilted greens, Rosehip tea.
- *A summer picnic*: Spring salad, Strawberries and honey, Elderflower cordial.
- *A winter warmer*: Watercress soup, Baked apple with honey, Rosehip tea.
- *A sweet finish*: Warm bramble compote, Toasted hazelnuts, Rosehip tea.

A meal is **laid** when the table holds dishes that answer every need, each dish answering one (as `Recipes.answers` does
for a recipe). It is not an item and never enters the bag: it is a state of the table (`table.meal`), worked out when the
dishes change, not per frame. Laid, the table says its name in the meadow's handwriting over it (a small float, a chime;
the first time a `firstTime('meal:' + name)` headline), and the line over the satchel names it while you are at the table.
Eating any dish of a laid meal gives the warm dish's lift a little longer (`warmIn` by `MEAL_WARM`, about a game hour) and
a contented "mm"; not more fill, because you cannot overeat. The point is the moment and the collection, not a stat.
- **The book:** a **Meals** section at the end of the recipe book's sections (not a fourth part: the three tabs are full),
  a page each (`MEAL_PAGES`, as `FIND_PAGES`): its name, its `text`, its dishes' small paintings (not a new composite
  painting: cheap and clear), which of them you have cooked, and "Laid once" once it has been (`firsts`, 'meal:' + name).
  The first laying tags the book button "New", as a new dish does.
- **The deed already on the board,** "Ate a meal sitting on the seat log" (stage 8), is earned as stage 8 has it, by
  eating any dish while sitting. The laid meal gives it its picture, not a new gate. If it should *mean* a laid meal, that
  is a cosy pass with the numbers redone, not a quiet change.

### Who sees it
- **The old stone** is already an audience: a dish offered to it (`offerSlot`) flies to the stone and **rests on it**
  while it rates it (its mouth going, the rating pill over it), then goes with a puff: the stone has eaten it. One small
  change to the offer's arc and the painting; the critic gets a visible plate.
- **Friends:** the table is the meadow's, like the basket and the fire. A dish set down or taken goes to everyone
  (`'table'`, a small message with the place and the dish, at the tick, as the basket's slots are); a guest can take and
  eat one, and the host sees it go. A guest's dish set on the table stays with the meadow (a gift). A friend sitting at
  your table is the deed already there ("A friend ate your dish"), now with a place to sit.
- **The first visitor (later, with 'After that' 5):** a dish left on the table at dawn is the trigger: the hedgehog comes,
  eats it, and leaves a recipe. The table is the landing place the visitor system was missing; a stump works the same if
  there is no table. Not in this stage's first slice.

### The dish's finish (later, with the cooking levels)
The last beat of a cook is plating, not a pop-out: the vessel comes off the heat, the dish is set on its plate or board in
front of you, and a **finish** can be added from the satchel (a leaf, a berry, a drizzle of honey): one tap, optional,
never a fail. It changes the painting by a small overlay (a `finish` on the dish, painted once per dish and finish), gives
the dish a little authored name ("with sorrel"), and later feeds the cooking levels' stars (golden, charred, perfect) and
portions (a pot of soup serving three). This is the cooking-depth thread; it follows the table, not the other way round.

### Building it
Each its own branch, played and looked at before the next:
1. **The hands.** A done dish comes out into the hands; the forager carries it (the one new painting, `FORAGER_HOLD`, in
   fur.js); eating it is the existing bite; the satchel is the fallback. No new build: the smallest change that fixes
   "hidden", and playable at once.
2. **The table.** `BUILDS.table`, `paintTable` and `TABLE_ARTS`, placing and turning, six places, set down/take/eat,
   `tableCam`, the warm steam, the kept table. No meals yet.
3. **The meal.** `MEALS`, `mealOf`, `checkRecipes`, the name over the table, the warm lift, the book's Meals section and
   pages, the "New" tag.
4. **The stone and friends.** The offer rests on the stone; `'table'` messages; a guest taking a dish; the meadow sum.
5. **The first visitor.** The hedgehog at a dish at dawn; a recipe; the dialogue. (Ties into 'After that' 5.)
6. **The finish and portions,** with the cooking levels.

### The sim and the keep
- `w.camp.table: null` in the camp's blank, made when the table is built: `{ x: -0, y: -0, turn: 0, dishes: [] }`; a
  dish is `{ id: '', at: 0, warmAt: 0 }` made in one shape (`id` a string; `at` and `warmAt` whole numbers; no fractions,
  nothing deleted: take one and it is set back to the blank). A kept camp from before gets `table: null` in
  `unpackWorld`; a kept forager gets `hand: ''`; no `KEEP_VERSION` bump if unpack fills both (a dish in hand at the keep
  is kept with it).
- The table is solid (`tableSpot`, as `seatSpot`); a dish on it is not a `world.dropped` thing and never fades: it is the
  table's.
- A guest's table is the host's; a dish left on it stays with the meadow, as the basket's things do. The host keeps them.

### Checked by
- `checkRecipes` checks `MEALS` (every name is a dish, every set 2-4, no two meals the same set); a kept-meadow
  round-trip with a table, three dishes and one in hand; `garden.table()` in the dev panel fills it with a dish of each
  (and clears it) so the meals and the table view can be seen; the table view at 1400x900, 390x844 and 844x390; a guest
  putting a dish on and taking it off; the meal name on the table and in the book; no console errors. Cost: a table and
  six dishes is seven cached draws (the dishes skipped far out) and one shared steam curl a warm dish; the table view is
  a camera move, no canvas of its own. Time `render` before and after over a few seconds in a camp with a full table,
  zoomed out and in, per CLAUDE.md only if the draws show up.

### Settled / open
- **Settled:** a dish leaves the satchel for the hands and the table; one in hand; the table is a camp build with six
  places; the table view is the camera, not a card; a meal is a set of dishes and never an item; nothing spoils; the
  satchel still carries a dish for travel; the stone's offer becomes visible; the table is the meadow's (shared).
- **Open:** the table's cost and place on the ladder (I have it after the basket, a level I open with no cosy for now; a
  table deed would mean redoing the gates' slack); whether it includes a bench or leans on the seat log; whether a meal
  gives a small stat or only the moment (I would keep it the moment plus the warm lift); whether a guest can eat from your
  table while you are away (yes, it is cosy); the first visitor's trigger (a dish on the table at dawn, or any dish left
  out); and whether the finish belongs to this stage or waits for the cooking levels (I would wait).

## Stage 10: fishing (planned 2026-10-21)

The meadow has been keeping fish for weeks with nobody to catch them: `w.fish`, a field over the lasting water, about
400 in a meadow, deep water best, breeding spring into summer, thinned a little by winter and by the otters
(`takeFish`). The game says the meadow gives "fish and game"; this stage gives the first of them. It's also the most cozy
cooking thing still missing: sitting on a bank at dusk with a line in, the float bobbing. Two things it has to be:
**calm** (no failing hard, nothing lost but the fish) and **readable on a phone** (one thumb, big targets, no fiddly bar).

### The rod
A make at the make strip, as the rope is (`BUILDS.rod` with `makes: 'rod'`, anywhere, no camp needed): **Fishing rod,
2 sticks + 1 rope** (the rope is already a make: 5 dry grass). The hook is a bramble thorn, implied, as the flint is for the fire. It's carried, like the vessels: one rod, kept
with the forager (`f.rod`, a 0/1), never in a satchel slot. A friend makes their own. Early in the game on purpose: the
first fish should come on the first or second day, so it's a way to eat, not a late reward.

### Where and when
- **From the bank.** Standing on land within `CAST_REACH` (about 3 tiles) of water that lasts (not a flood pool: no fish
  there), a tap or click on the water casts there; on a computer `R` casts the way the forager faces (R only turns a thing
  while placing it, so it's free otherwise). The line over the satchel says "Fish here" when the forager stands at a good bank (as the cook prompt does at a fire).
- **The bite comes from `w.fish` where the float lands** (the 5x5 sum `takeFish` already reads): thick water bites in a
  few seconds, thin water slowly or not at all, so where you fish matters and the otters' favourite pools are yours too.
  Dawn and dusk bite best (`BITE_HOUR`), rain a little better, the middle of a hot day worst, night slow but it's eel time.
- **Seeing the fish.** Where the water's thick, a rise now and then: a ring spreading on the surface, a small plop
  (`drawRises`: a few at most on screen, one cached ring painting stretched, only near the forager and only when the rod
  is made). It's the fishing's glint: it tells you where to cast without an arrow.
- **Winter, under the ice:** later. Ice fishing (a hole knocked in it with a stone, a stool of a log) is a lovely second
  slice, not the first.

### The catch
Cast → wait → bite → strike → bring it in, with a Stardew-style bar for the bringing in (Axel's pick, 2026-10-21):
1. **Cast:** the forager swings the rod, the line arcs out and the float plops where you tapped (a short throw, no aim
   game; a tap past `CAST_REACH` casts as far as it goes that way).
2. **Wait:** the float rides the water, drifting a little in the current (the sim's current already moves otters). Nibbles
   come first: two or three small dips with a tick sound, which are not the bite.
3. **The bite:** the float goes under with a plop and a ring, and a "!" pops over the forager. **Tap within the strike
   window** (`STRIKE_MS`, about 900 ms: generous, the bar is where the skill is). Too early on a nibble or too late: "It
   got away", the float comes back up, cast again. Nothing is lost.
4. **The bar** (`#reel`, `renderReel`): a slim upright brass-and-parchment gauge beside the forager on the water's side
   (about 44 px wide, a third of the screen's height; on an upright phone over the satchel's corner, never under the thumb).
   In it the fish (its small painting, side on) darts up and down, and a pale catch zone you move: **hold to lift it,
   let go and it sinks**, with a little weight and bounce, as Stardew's. Beside it a catch meter fills while the fish is in
   the zone and drains while it's out. Full: landed. Empty: the line goes slack, "It got away". Hold is anywhere on the
   screen (a phone's whole screen is the button, the meadow's taps paused while it's up), the mouse or Space on a computer.
   Calm by the numbers, not by the idea: the meter starts a third full and drains slower than it fills (`REEL_FILL`,
   `REEL_DRAIN`), the zone starts wide (`REEL_ZONE`), and a roach barely moves. A treasure-style extra is left out.
   The meadow goes on behind it: the camera eases in a little on the forager and the float (as `tendCam`), the rod bends
   with the fish's pull, the float's water splashes as it darts, and the line goes taut and slack with the meter.
   It's drawn by the page, not the canvas: one small element whose fish and zone move by a `transform` each frame (no
   layout), so it costs nothing in the meadow's frame.
5. **Landed:** the fish flips on the bank by the forager, a splash, then it hops into the satchel (as a pick does), with a
   float of its name the first time. The sim takes it (`takeFish(w, x, y, 1)`), so the forager and the otters share one
   stock, and a pool fished out bites slowly till it breeds back.

### The fish
Not species in the sim: one `w.fish` field stays, and *what* bites is decided at the bite, by the water and the season
(`fishKind`: no random numbers of the meadow's, the forager's own). Each kind is a block in a `FISH` table (recipes.js,
copy-a-block like the rest): where and when it bites, and how it moves in the bar (`dart`: how far and how often it
jumps, `pull`: how fast, `idle`: how long it rests). The first four, Axel's to tune:
- **Roach**: small and silver, any still water, all year. The everyday fish: drifts slowly, rests a lot.
- **Perch**: striped, deep still water, spring to autumn. Short darts, often.
- **Brown trout**: in the current (the brooks and rivers), spring and summer, best at dawn. Long leaps, the prize.
- **Eel**: at night in summer, deep water. Slow to bite, then a steady sinking pull that wants a long hold, with sudden
  wriggles; the best stew in the book.
Later, with more water life: crayfish in the shallows (a trap at camp, not a rod), pike in winter.

Ingredients in recipes.js with the tag `fish`, `raw: false`, fill as meat; each with `where` for the book's Finds page
and a painting in items.js. A trout and a perch also **dry** on the rack into **Dried fish** (stack 30): the winter food
the rack was always for. (Smoked fish waits for a smokehouse.)

### The dishes
Six to start, each painted to the dish bar (dish-painting.md; a sheet to Axel first):
- **Roast fish on a stick** (stick: any fish): the first one, `known: true`.
- **Trout with wild garlic** (pan: trout, garlic).
- **Fish and sorrel on a hot stone** (stone: fish, sorrel).
- **Fish soup** (pot: fish, fish, nettles, watercress).
- **Eel and mushroom stew** (pot: eel, mushroom, mushroom, garlic): warm, fills the most.
- **Dried fish and hazelnuts** (bowl: dried fish, hazelnuts): cold trail food for a long walk.

### The skill
`SKILLS.fishing` (practice: fish landed; one that got away counts a little): each level the catch zone grows
(`zone: 0.04`, not 0.06: at 0.06 just holding lands everything at the top) and the meter drains slower (`calm: 0.05`), and from level 3 a perch or trout comes a little more often.
The "You" tab shows it with the others.

### How it looks and sounds
- **The forager:** a casting pose and a holding pose in fur.js (the rod held out over the water, two views: side and
  three-quarter from behind, the forager faces the water), and a sit on the bank if it waits long (`SIT_FISH`, the existing
  sit). The rod is part of the painting; the **line** is one thin stroke a frame from the rod's tip to the float (a single
  path, no sprite), sagging, taut when reeling.
- **The float:** a small red-and-white quill painted once (sprite cache), bobbing by a sine, with a ring at each dip.
- **The fish in hand:** each kind painted once in items.js; landed, it's that painting flipping on the bank.
- **Sounds** in sound.js (and sound-lab): a swish of the cast, the float's plop, nibble ticks, the bite's deeper plop, a
  reel's wooden click, the line's creak, the splash of landing, a little "got away" sigh of water. All synthesized, as the rest.
- **Friends** see your line and float and your catch (`'fish'` messages: cast at, bite, landed), and two can fish one pool.

### Building it
Each its own branch, played before the next:
1. **The rod and the catch, plain** (built 2026-10-21; .claude/docs/fishing.md). The make strip's rod, `f.rod`, cast/wait/bite/strike, the bar with `FISH`'s four
   ways of moving, land, a placeholder float and the line, `fishKind`, `takeFish`, the four fish as ingredients (emoji
   for now), "Fish here", the dev panel's `garden.give('rod')`. Playable: can you catch one, does the bar feel good on a
   phone and a trackpad? (The bar's feel is the whole stage; tune it here, with Axel, before anything is painted.)
2. **The look and sound** (built 2026-10-22; the sit on the bank with the refining). The poses, the float, the bar painted properly, the fish paintings, the rises, every sound.
   The polish bar is the cooking's.
3. **The skill** (built 2026-10-22; .claude/docs/fishing.md), and the bar's numbers once it has been played a while (still to do, by hand).
4. **The dishes** (built 2026-10-22; the soup and stew take any greens): the six recipes and their paintings, dried fish on the rack.
5. **Friends** fishing together (built 2026-10-22).
   Then refined for fun (2026-10-22, .claude/docs/fishing.md "Refined"): the fish tires, a last run, sizes and the biggest
   kept, a perfect catch, the sit and the doze on the bank, the camera leaning to the float.
6. Later: ice fishing, crayfish traps, pike.

### The sim and the keep
- `f.rod: 0` in the forager's blank (`foragerOf`), and its fishing state in the blank too, one shape for life:
  `f.cast: { x: -0, y: -0, at: 0, bite: 0, kind: '' }`, set back to the blank when the line's in. A kept forager from
  before gets them in `unpackWorld`; `SKILLS.fishing` starts at nothing there already (bySkill). No `KEEP_VERSION` bump.
- The bite is the forager's own timing (game.js, like gathering's), the take is the sim's (`takeFish`), so fishing at 60x
  still takes from the stock it should. A friend's catch is taken from the host's water.
- Headless, over three seeds, two years with a forager taking 10 fish a day from the thickest water: the fish and the
  otters don't die out (`w.fishCount`, otters in `w.count`).

### Checked by
Catching each of the four in their water and season (the dev panel's `garden.fishNow(kind)` to skip the wait), a miss,
one that got away in the bar, at 1400x900, 390x844 and 844x390 by touch (the hold reaching the bar under a thumb, the
bar clear of the satchel and the notch); a friend watching a cast; the round-trip; no console errors.
Cost: one line stroke and one float sprite a frame while fishing, a few rise rings near the forager, the bar's two
transforms; nothing new when not fishing. No timing needed unless the rises show up.

### Settled / open
- **Settled (Axel, 2026-10-21):** a Stardew-style bar to bring a fish in, after a tap on the bite; the rod is made
  (2 sticks + rope) at the make strip; no bait for now; four fish in the first slice, the eel at night included.
- **Open:** whether a fish can be eaten raw (I'd say no: it wants the fire, which is the point); how hard the bar should
  be at level 0 (to find by playing step 1); whether the camera eases in while reeling or stays put.

## After that (roughly in this order)
1. **Cooking at the fire** and 2. **hunger and eating**: stage 6 above.
3. **Camp builds.** Arranged inside the camp ring: a seat log, a spit, a drying rack (keeping food for winter), a basket
   for storage (built 2026-10-17: `w.camp.basket`, the ring went from 3.2 to 5 tiles; 2026-10-19: it grew to 32 slots,
   tinder stacks 20, its card got a Tidy that folds piles of a kind, and set-down stores learned to keep bigger stacks
   than the satchel carries (a `keep` in recipes.js: greens lie 20 to a basket slot, still 10 to a satchel one), a lantern,
   a bedroll or lean-to. What each costs is data, recipes.js-style, so Axel can add builds by
   hand. More ground items come in as builds need them (clay, reeds, flint, logs, pine cones, tinder fungus, feathers).
   The table comes next among these (stage 9): it is the one build that changes what cooking is for, and the visitor
   stage below lands on it.
4. **Fishing and hunting.** Fishing is stage 10 above. Fish from the water the sim already stocks (`w.fish`), and hunting the rabbits and the game
   (the gentle respawn keeps them from running out). Visitor NPCs are never hunted.
5. **The visitors come back as NPCs.** The hedgehog, heron, kingfisher, dragonflies and skylark (their lives and
   paintings are still in the code, dormant: they only ever came to the keeper's places). They need a new way in, e.g.
   drawn by food left out at camp (a dish on the table, stage 9). You feed them, and they thank you with recipes in cute
   little dialogues (the hedgehog trades its nettle soup for a bowl of something; recipes.js `from`).
6. **The kitchen ladder.** Stations beyond the fire: the clay pot (stews and soups, 4 slots), the drying rack, a stone
   hearth (two things at once), a skep for your own bees (the sim's swarm hook in `hangOut`), the clay oven (bread, pies,
   honey cakes), a smokehouse or cellar for winter. recipes.js `STATIONS` already has fire, pot and oven.
7. **Cooking levels.** Cooking raises your level; a level raises quality (stars, less burning, bigger servings, and the
   finish a dish can take: stage 9's leaf, berry or honey) and opens new stations, rather than handing out recipes one by
   one (recipes.js `level`). Recipes are still mostly found by trying, and some are taught by visitors.
8. **Winter as the gentle pressure.** Cold, short days, little to forage: what you dried and kept carries you through.

## Open notes from the last pass
- Crows were wiped out once (seed 2, year 3: foxes killed 14 in a day); they come back, but worth a look.
- Spring honey keep is 24; 30 would be safer with a greedy forager.
- The start spot can put the forager behind a tree crown (trees in front now fade, which may cover it); camp makes the
  start spot matter more, so pick an open one.
- Satchel icons for elder and strawberries are the whole plant; small item paintings would read better.
