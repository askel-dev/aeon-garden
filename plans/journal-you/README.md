# The book's You part: levels in the journal, as The Forest does it

**Built (first slice).** The mockup is `mockup.html` next to this (open it through the dev server so the fonts load:
http://localhost:8765/plans/journal-you/mockup.html). Its buttons along the top switch between the concepts. The game
has the sheet, the three real skills, the skill pages and the freshness dot; the ribbons and the later parts are still
only in the mockup (see "What's next").

## Why

The skills live in `#me-card` today (a tap on the face, or I): a small floating card with three bars. It works, but it's
one more card of its own, it's easy to miss, and there's no room in it for what a level gives or opens. The recipe book
(`#book`, B) is already the game's journal: two pages, tiles on the left, the thing picked on the right, a ✕ in brass, a
phone sheet. In The Forest your stats are just one more tab of the survival book. Same here: the book gets a third part,
**You**, next to Recipes and Finds, and `#me-card` goes away.

## What the You part shows (mockup 1 and 2)

Left page, "the sheet", filled in by the forager's pencil (Fraunces italic in a pencil blue, the one new colour):

- the face (the HUD's painted portrait, `#me canvas`), the name, **days in the meadow**, and **feeling** in one word
  underlined, as The Forest's "Currently feeling GOOD" (from warmth, tummy, wet and health: cosy, chilly, hungry,
  soaked, worn out…; the words already exist in the `#me` tips, game.js ~2725)
- the four vitals as small bars with a pencilled word (warmth, tummy, stamina, health), the same numbers as the face's ring
- **Right now**: chips for what's on the forager (a warm dish inside and how long, damp, soaked, winded, rested by the fire)
- **Skills**: a row each, its level coin in its `LEVEL_COIN` metal, its `SKILL_INK` bar, and how much is left in the
  skill's own unit ("7 dishes to 5", "70 things picked to 7", "2 minutes of sprinting to 4"), worked out from
  `skillNeed` and the practice per thing (`GATHER_PRACTICE`, a dish = 1, a minute of sprinting = 60). Skills not in the
  game yet are hidden: only `S.SKILL_NAMES` gets a row and a page, so a new one appears when sim.js has it. (The
  mockup's dashed "later" rows are not in the game.)

Right page, the skill picked, laid out as a recipe page is:

- its coin big on the plate where a dish's painting sits, name and level, its `line` in italic
- the bar and "n more … to level n+1"
- **What it gives you now**: each perk as a row, now and at the next level (from `SKILLS[s].perks`, as `SKILL_SAYS` does)
- **The road to opal**: ten pips, each in its level's metal, the ones reached filled. Cooking's vessels are listed under
  the road (from recipes.js `CRAFTS` `level`, as `opensAt` finds them), each beside its level's little coin; a level 1–3
  pip is where they come. This is the part the card never had room for, and it makes the next level something to look
  forward to.
- at the top (mockup 2) the opal coin, every pip filled.

A level up's headline could later end with "see it in the book", but the dot is wired now: the You tab gets the red
"new" dot (and the shut book's button its glow), as a new recipe does (`bookFresh` / `bookNews`), till the book's opened
on You.

A level up's headline could end with "see it in the book" and the You ribbon gets the red "new" dot, as a new recipe
does (`bookFresh` / `bookNews`), till the book's opened on it.

## The ribbons (new navigation): later

Not built. With three parts the titles-as-tabs (`#book .tab`) still fit — Recipes, Finds and You — so the first slice
keeps them, as three titles, not ribbons. Ribbons are worth doing when a fourth part exists and the titles would get
crowded: cloth ribbons over the book's top edge, like The Forest's coloured tabs, a mark and a word each, the open one
taller and joining the page, a red dot for something new. On an upright phone they'd be a row of 44 px tabs across the
top of the sheet, only the open one with its word (mockup 6).

## Built (first slice)

1. `BOOK_PARTS.you` is `{ name: 'You', pages: YOU_PAGES, sections: [] }`; `YOU_PAGES` is made from `S.SKILL_NAMES`
   (`{ skill, key: 'skill:' + s, part: 'you', no, i }`), and `ALL_PAGES` / `BOOK_PAGE` take it in. `levelOf(p)` returns
   the skill's level for one, so the existing `bookFresh`, `pageFresh` and `bookNews` work with no special case.
2. The book's static markup builds the two tile parts as before and adds `<div class="part" data-part="you"><div
   data-you></div></div>`; `renderBook` writes `youSheetHTML()` there instead of the sections, and `skillPageHTML(p, f)`
   into the right page. `paintYouFace()` copies the HUD's painted `#me-face` over; nothing new is painted per frame.
   `youKey()` adds the sheet's vitals (rounded to 5%), wet (10%), warm food (hours), mood, outfit and whether it's by a
   fire, and the skill levels/rounded progress/left units, to `bookUi.key` **only while You is the part shown**, so it's
   still written as it opens, as a page turns, and when what it shows changes.
3. `openYou()` calls `openBook(true, 'you')`: `openBook` takes an optional part so it doesn't flash the newest dish (and
   mark it seen) on the way past. The face's `data-act="me"` and `I` call it. `openMe`, `renderMe`, `#me-card`, its CSS
   and its phone sheet are gone. The face's touch `pointerdown` no longer shows the tip (the book covers it); mouse hover
   still does, and the help now says "Tap to open the book at You".
4. The titles stay titles. The ribbons are for when a fourth part exists.
5. Level 0 gets `BARE_COIN` (a blank worn coin) and "What level 1 gives". The road's cooking vessels are listed under
   the pips, each with its level's little coin, from `opensAt`; the pips themselves stay numbers (long vessel names under
   a 39 px pip wrapped to five lines). No sim or kept-meadow change: days are `Math.floor(world.tick / S.TPD) + 1`, and
   the page's title is the forager's name (no Name row).

Checked at 1400×1000, 390×844 and 844×390: no console errors, the sheet and page fit without clipping (the landscape
page scrolls, as any book page does there), the face and I open on You, level 0 and level 10 are handled, and a skill
level up while the book is shut puts the dot on the You tab.

## What's next

- The ribbons, when a fourth part (Almanac, Diary, Bestiary) is real.
- The level-up headline's "see it in the book" line, if it's worth saying (the dot already points there).
- More skills and levels that open things, not only percentages (the mockup's faint road labels are ideas, not built).

## Decided

- Skills not in the game yet: hidden, not dashed "later" rows.
- The face always opens the book on You (and so does I). The hover tip stays; a touch on the face doesn't flash it.
- Keep the titles-as-tabs for the first slice; ribbons wait for a fourth part.
- The pencil blue is one new value, `--hand: #3d5570`, only for written values (days, feeling, the vitals' words).
- The sheet's title is the forager's name; "Your forager" is the fallback when none is set.
- No later parts, no speculative road labels, no per-frame drawing, no sim behavior changes.

## Later: other parts the ribbons make room for (mockup 3–5)

None of these are in the game; they're here so the design leaves room for them.

- **Almanac**: records pencilled in as they happen (dishes cooked, burnt, the favourite, the stone's best verdict, the
  coldest night lived through, things gathered, finds n of N, fires lit, gifts and hugs), and **ribbons**: small stamps
  thumped in like "Learned!" for things done (first frost, forty dishes, a whole year, a skill at opal, every find, a
  perfect 10 from the stone, a feast of five dishes in one night). Per player, in localStorage.
- **Diary**: a line or two a day the game writes for you from what happened (weather, firsts, level ups, a friend
  visiting, a dish burnt), in the pencil hand on ruled lines with a doodle now and then; and pressed between the pages
  the first of each flower picked, taped in with the day. Cheap: the events are already there (`firstTime`, `levelup`,
  `daybreakTick`, net arrivals); it's a few hand-written templates each.
- **Bestiary**: a tile a creature (`KINDS`), its notes filled in by watching (seen, where it sleeps, what it gives, when,
  a sketch after watching one a whole minute), dots for how much is known. The inspector already knows all of it.
- More skills for the road, each a block in `SKILLS` and a `gainSkill` where it's practised: **Fishing** (when there's
  a rod), **Tracking** (prints, finding burrows and holts), **Fire-craft** (fires that last longer, light in rain,
  less bark for a torch). And levels that open things, not only percentages: a smoking rack at cooking 5, a second
  satchel row at gathering 8, wading deeper at stamina 5, a signature dish at cooking 10 (faint on the mockup's road).
- Smaller: the map folded into the back cover (the minimap, big), letters from friends tucked in, the stone's verdicts
  kept on a page of their own, a wardrobe page of outfits found.
