# The HUD: sky dial, headlines, level ups

Drawing, the camera, the inspector. The world fills the screen; over it only a small pill top right
(pause, sound, •••), a toast line (`toast`, for a copied link or an idea that couldn't go) and the inspector. The old
watching game's cards, news feed, stats, journal, tools, intro and idle camera were cut on the `cooking` branch
(main at 1d79f03 has them); the pocket watch that told the day and the year went later (git history before its removal).
The sky dial (2026-10-19; the comment over `DIAL_W`) is what came back in its place, small, left of the pill (`#sky`,
`updateDial`, `dialWords`): an arched window in the pill's parchment like a grandfather clock's moon dial, the sky of the hour in it
(`SKY_KEYS`, dark as `darkness`, grey with the weather's mix), the sun and then the moon with its stars going over on a
wheel (a CSS transform; the sun rises at `DIAL_RISE`, sets at `DIAL_SET`), the season's hills in front with a rabbit's ears
over Nobody's hill (`DIAL_HILLS`, a painting by day and one by night a season, all painted once), and under it a pip a day
of the season. A new season fades its hills in and glints over the brass (`.turn`); a hover or a tap says the day, the
part of it, and the dark, the light or the next season coming. The edge markers keep clear of it (`KEEP_CLEAR`).

Headlines (`announce`, index.html `#announce`): big Fraunces italic words over the meadow with no card, under the toast,
fading in and out, clicks going through. The old watching game's daybreak lines brought back (cut in da8079b): each new
day at sunrise (`daybreakTick`, with `morningWord` when the morning is frosty or wet), a new season bigger with what it
brings (`SEASON_LINES`, hand-written: keep them true to sim.js's seasons), where we are a moment after a meadow opens, a
friend's meadow as you join, and the first of anything in gold between ✦s (`firstTime`, kept across meadows in
`aeon-garden-firsts`; a first find says its recipes.js `text`). One at a time: the rest wait, except a day's line, which
is dropped. None while a card is open or the forager is down. The first fire and the first dish go through `firstTime`.
A skill up a level is one too (`levelUp`, announce 'level', `LEVEL_WAIT` after what did it): it rises from below, a coin
with the level flipping in on a ring of light and rays, the skill's name in its `SKILL_INK` tracking in, its `SKILL_SAYS`
under it and "see it in the book" pencilled after it (`.see`, index.html; the You tab has the dot), and sound.js `level`
(the one sound with a real cadence: up an A7, home on D). The coin's metal is the level's own
(`LEVEL_COIN`: copper, bronze, brass and gold, then jade, verdigris, sapphire, amethyst and rose), and the top one is extra:
a pale opal of every colour (`.max`, index.html) with a turning sheen, sparks and a wider rainbow halo of rays. With a card
open it's a toast.

The minimap (2026-10-20; the comment over `MAP_W`, index.html `#minimap`): the whole meadow, small, bottom right in
the sky dial's parchment. The land (`paintMapLand`: the season's ground colours, water darker the deeper with a pale rim at
the shore, slate in the cold, a dot a standing tree) is painted `MAP_PX` pixels a tile into a canvas of its own, again
only every `MAP_LAND_MS` while time runs; over it (`drawMap`) the night's tint, the view's frame, lit fires' glow, the
hives, friends in blue and the forager in its red, redrawn only when one of them moves a pixel or the dark goes a step.
A click or tap on it walks the forager there (`walkTo`). Hidden on a phone either way up and in a window too narrow to
keep it clear of the satchel and the book (on its side a phone's notch and its book beside the satchel leave no room; the
same query in index.html and `map.on`, so a hidden map costs nothing); faded while the inspector, the cooking window or
the book is open. The sprint button stands just over it.

The line over the satchel (`#what`, `hoverSay`, 2026-10-20): one thin parchment pill in one fixed place, above the vitals and
the satchel, saying what the mouse is on or what a finger has stopped by, in its name and a word of what it wants ("Your
camp", "burning low: it wants sticks", "Basket 3 things in it", "Torch · burning"), and the key that does it (E, where `eTarget` says E would
go; hidden on a touch screen). A thing in the camp never gets a tag of its own; the line is the one place for all of them.
The fire's, the basket's, a torch's, the seat log's and a pick's name and word live here now (the old `fireWord`, `basketWord`, `torchWord`
and `hoverLine` are gone); on a touch screen there is no hover: the line comes after standing still a moment by something (`closeBy`),
with the keys hidden. A fire and the stone have their E disc, so the line is for the basket, a torch, the seat log or the nearest
pick, which the ring alone doesn't name. One at a time: it goes while a card,
the make strip, a place being picked, the wardrobe, the intro or a dish's window is open (`promptsOff`), while a thing is
being dragged, and a mouse's line waits while a "+3" floats up. Above the satchel by 100 px, 164 on a touch screen (over its buttons) and 82 in a short window,
so it never sits on the vitals or the satchel.
