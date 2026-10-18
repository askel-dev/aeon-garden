# Visuals — what to take from them

Notes from the screenshots, aimed at the meadow's look. Every pointer is a real file in a
folder next to this one. Rule of thumb from studying them: **the games that look best on a
phone are the ones that commit to one strong idea (a palette, a light source, a material) and
keep the screen mostly empty.**

## 1. One light source owns the frame

- **Don't Starve** (`dont-starve-pocket/phone-04.jpg`, `phone-06.jpg`): the whole screen is a
  dim sepia-navy, and the fire/camp is the only warm, bright thing on it. You always know where
  home is without a marker.
- **Tsuki's Odyssey** (`tsukis-odyssey/phone-03.jpg`): one muted green world, and the lanterns'
  amber is the only saturated colour — same trick, gentle edition.
- We already have this (PLAN stage 4: the fire pool cut from the navy dark, `lightsFrame`) —
  the note is **don't dilute it**: no other strong light or saturated UI colour at night. Our
  amber rings, honey stamina bar and gold announcements all read as "fire colours" — keep them
  from competing with actual firelight by staying small.

## 2. Colour holds through weather and night

- **Stardew** (`stardew-valley/phone-03.jpg`): it rains and the greys come down a notch, but
  the greens stay green and the sprites stay readable. Games that grey everything out for
  weather feel broken on a small screen.
- For us: rain/snow/night are a **wash over an already-good palette** (our `skyWash` already
  works this way) — check after any weather change that grass still reads green and mushrooms
  still read red, not that everything reads slate.

## 3. Readability at slot and screen size

- **Don't Starve's** characters are pale, high-contrast silhouettes on dark ground — at phone
  size you track Wilson without looking for him.
- Our forager's **red mushroom cap** does the same job on green grass (visible in our own
  screenshots; also the game's marketing shots). It's the best asset we have: nothing else in
  the world should be allowed that exact red — berries and rosehips should sit a step darker or
  smaller so the player's eye stays on themselves at a glance.
- Pickables glint already (`drawGlints`), and the edge marker points to the nearest
  (`drawPickArrow`). In every screenshot set here, nothing else in the genre does this well —
  it's worth more than extra UI.

## 4. UI as a material, not as software

- **Cozy Grove** (`cozy-grove-camp-spirit/phone-03.jpg`, `phone-05.jpg`): headers are a wooden
  sign, cards are paper with grain, buttons are painted blobs. Nothing is a flat grey rectangle.
- **Wylde Flowers** (`wylde-flowers/phone-03.jpg`): the info card is cream parchment with the
  illustration and text *inside* the material, and the ✕ is a red seal in the card's corner.
- **Animal Crossing** (`animal-crossing-pocket-camp/phone-03.jpg`): chips are warm cream, always
  rounded, level/currency values inside the chip — no bare numbers floating on the world.
- We already chose parchment with grain (`--paper`), brass rings, a round brass ✕ — we are
  *on the same shelf as these games*. The gap: our **announce headlines** (day/season/firsts)
  could borrow Cozy Grove's wooden-sign or Stardew's banner treatment for the same moments, so
  announcements feel like an object in the world rather than a caption over it.

## 5. The HUD silhouette everyone converges on

From the screenshots, the shared layout on a phone:

| Zone | What lives there | Seen in |
| --- | --- | --- |
| Top-left | Identity/vitals or minimap | AC chips, DS clock, HKIA minimap, our portrait `#me` |
| Top-right | Rare/system controls (pause, map, settings) | DS pause, HKIA round buttons, our pause pill |
| Bottom corners | Movement + primary action | HKIA joystick + big action button, DS hotbar, AC tray |
| Bottom-center | Inventory row | DS hotbar, AC tool tray, our satchel |
| Center | **Nothing, ever** | all of them |

Two things stand out:
- **Everyone puts the primary action in a bottom corner** (HKIA's net button, our fire button).
  Ours sits bottom-center-right by the satchel, which is right — but it should be *the* biggest
  round target on screen when its time comes (it already pulses).
- **Nobody puts inventory on the sides in their good screenshots.** Don't Starve's side columns
  appear only in busy mid-game shots; the clean marketing shots use the bottom edge. Our satchel
  row at the bottom is the stronger pattern — keep it there as slots grow.

## 6. Objects that glow, not effects that sparkle

- Tsuki's lanterns and Don't Starve's fire do it with **a soft warm blob plus a few drifting
  particles** — no lens flares, no star fields.
- Our glint, ember drift and camp bloom already match this language. When tempted to add a new
  effect, add light instead: it costs less (CLAUDE.md's perf rules) and reads better at 60 fps
  on a phone.

## 7. Anti-patterns to keep on the wall

- **Terraria** (`terraria/phone-04.jpg`): left column, right column, top bars, two thumb pads,
  a hotbar and chat — the game is a small strip in the middle. It works; it also looks like
  work. Our "Axel wants to see the meadow, not big cards" rule is the correct read of this.
- **Forager** (`forager/phone-03.jpg`): a full-screen map card over the world at all times, plus
  hearts, a tool bar and a progress card. Every element is friendly; together they bury the art.
- **Stardew** (`stardew-valley/phone-05.jpg`): the left hotbar is *good* (compact, thumb-side)
  — but note it's a permanent extra column on the world. Ours keeps the satchel as one row that
  already collapses; that's the better version of the same idea.

## 8. Concrete list

1. Keep the fire the only strong warm light at night; no saturated UI competing with it.
2. Protect the forager's exact red; keep berries/rosehips a step off it.
3. Weather = a wash, never a desaturation (check grass + mushrooms after any weather change).
4. Consider a material (wooden sign/banner) for the `announce` headlines, Cozy Grove style.
5. Keep the center of the screen empty; new UI goes to a corner or the bottom edge.
6. Prefer adding light over adding particles for any new effect.
7. Print `terraria/phone-04.jpg` and `forager/phone-03.jpg` before agreeing to any new panel.
