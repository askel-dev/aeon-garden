# Inspiration

Reference material for Nobody's Meadow — the mobile games we're studying to sharpen
**our visuals** and **our mobile QoL**. Collected 2026-10-18.

- **[`visuals.md`](visuals.md)** — what these games do with colour, light, readability and UI
  materials, and what we should take from it.
- **[`mobile-qol.md`](mobile-qol.md)** — how they lay out thumbs, targets, hints and menus on a
  phone, scored against what our game already does.

## What's in each folder

| File | What it is |
| --- | --- |
| `phone-NN.jpg` | Official App Store screenshots, in store order (phone-shaped — the layout that matters for us) |
| `steam-NN.jpg` | Official Steam screenshots where the game has a PC version (HUD at desktop size) |
| `icon.jpg` | The app icon (512 px) |
| `store.md` | The listing's own words: developer, price, rating, description excerpt, links |

Screenshots are compressed to a longest side of 1600 px to keep the repo light, so they are
snapshots: stores reshuffle them, and a re-run (`python3 inspiration/build.py`) fills gaps but
doesn't touch what's already here.

## The games

| Folder | Access | Why it's here |
| --- | --- | --- |
| [`dont-starve-pocket/`](dont-starve-pocket/) | Paid, one-time | The survival half of us: fire, cold, hunger, foraging — death that isn't game over. Best-in-class compact HUD for a survival game on a phone |
| [`cozy-grove-camp-spirit/`](cozy-grove-camp-spirit/) | Netflix membership | Our closest art cousin: hand-drawn storybook world, campsite life, small wooden/paper UI. Also the masterclass in gentle guidance |
| [`wylde-flowers/`](wylde-flowers/) | Apple Arcade | Cooking as the point: recipe lists, ingredient checkmarks, "you can't do this yet — here's why, tap to go" |
| [`stardew-valley/`](stardew-valley/) | Paid, one-time | Seasons, foraging, rhythm of a short day; left-edge hotbar and top-right date/weather chips |
| [`animal-crossing-pocket-camp/`](animal-crossing-pocket-camp/) | Paid, one-time | Cozy camp on a phone done at scale: cream chip HUD, bottom tool tray, NPC speech that never covers the action |
| [`hello-kitty-island-adventure/`](hello-kitty-island-adventure/) | Apple Arcade | Corner-clamped HUD: minimap top-left, joystick bottom-left, one big action button bottom-right, middle always clear |
| [`alba-wildlife-adventure/`](alba-wildlife-adventure/) | Apple Arcade | Almost no UI at all — the world *is* the interface. Our "show the meadow, not big cards" instinct, validated |
| [`minecraft/`](minecraft/) | Paid, one-time | Survival on touch controls that everyone copied; how little HUD a survival game can get away with |
| [`terraria/`](terraria/) | Paid, one-time | The cautionary tale: every button they could fit. Keep its screenshots next to ours when tempted to add a panel |
| [`tsukis-odyssey/`](tsukis-odyssey/) | Free, IAP | Painted calm: one muted palette, warm accents, **zero visible UI** while exploring |
| [`forager/`](forager/) | Paid, one-time | The literal forage loop — and how a screen full of maps, bars and cards buries the game |

Access options are listed because we can't assume anyone has every subscription: the two most
valuable references for us (**Don't Starve** and **Stardew**) are paid one-time purchases.

## Refreshing / adding a game

```bash
python3 inspiration/build.py            # fills in anything missing (needs Pillow: pip3 install pillow)
```

To add a game: append a `dict(slug=…, search=…, expect=…, access=…, steam=…)` to `GAMES` at the
top of `build.py`, run it, then write a line about it in the table above.
