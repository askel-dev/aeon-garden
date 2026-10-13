---
paths:
  - game.js
  - index.html
---

# game.js

Drawing, UI, news feed, the inspector. The inspector shows
animals and every other thing you click (hives, trees, rocks, remains, burrows, flowers, fields, water): each
kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows.
The animal you follow has its news always come, and first on the away card (`involvesSelected`). Animals can't be
named by the player (naming and the ••• Yours card were taken out on 2026-10-12: they gave the player no reason to care).
With Look in hand, a press on an animal dragged (or a finger held on it) picks it up by the scruff (`pickUp`,
`grabAt`: on its body as drawn, so a pan from near one stays a pan): it dangles from the hand as a pendulum the
hand's speeding up swings (`heldFrame`, `drawHeld`), kicks in fits, and drops with a hop where you let go
(`letGo`, `drawFalling`). In the sim (`lift`, `putDown`) a held one (`c.held`) skips its turn and is out of the
grid, so nothing hunts it; its place is the ground under the hand, and it lands on the nearest dry footing.
Foxes and rabbits are painted (`paintFox`, `paintRabbit`, styled on the carcasses): one rig posed for
what each is doing (`FOX_POSES`, `RABBIT_POSES`, picked by `foxArt`, `rabbitArt`), painted as one animal by `paintFur`
(one shading over it all, each part's form and the markings soft, a part in front casting a soft shadow, a softened
outline and a faint grain), so its parts don't read as separate shapes. A rabbit's coat is painted in its own colours;
in winter it whitens in 5 steps, only the brown and the white painted and the steps between the two mixed. A painting
is costly (each pass through the scratch layer is a flush), so parts can share one (`joined`) and the parts behind are
just shaded (`flat`). It's painted only at doublings of its size (`FUR_PAINTED`) and shrunk for the sizes between,
which keeps a dozen poses, growing young and zooming cheap.
On the move their legs go round with the ground they cover (`gaitOf`: a fox trots and gallops four paintings a stride,
its back level at a trot), a rabbit hops in bursts, drawn a little ahead of or behind the sim along its way and
stopping between hops (`hopSurge`), and up to 2x everything is drawn between the sim's last two ticks (`drawnAt`,
`keepLast`). No bubbles stay over the animals: when one starts something worth seeing (spots a fox, runs, chases,
courts) a little bubble pops up and fades (`drawPops`, `POPS`), at most 3 at once, love only for the one followed.
Something worth seeing (cubs, a swarm, frogs in your pond: `spotOf`) leaves a marker over the spot till you've looked,
or at the screen's edge pointing the way; a tap on it or "Go see" on its news line glides there (`spots`, `drawSpots`,
`goSpot`). Once you've looked, the marker gives way to a caption saying what it was (`say`, `sayArt`), with a sparkle
and a soft chime (`seeSpot`, sound.js `seen`). A visitor (sim.js `w.visitors`: the hedgehog at a hedge, the heron at a pond) is drawn in with the trees and animals, painted like them
(`paintHedgehog`: walking, snuffling, curled up asleep; `visitorArt`, `drawVisitor`), fading in and out at the ends of its way
(`visitorFade`). The heron (`paintHeron`, `HERON_POSES`: upright, poised, two stalking steps, the stab, a frog or a fish held up,
two wingbeats, asleep on one leg; `heronArt`, `drawHeron`) flies in high and glides down (`heronLift`), wades to its shins with rings
round its legs, and splashes where it stabs. It has no emoji: its marker and caption show its painting (`badge`, `paintedBig`), and
a line of news its portrait as a CSS background (`visitorGlyph`, `--glyph-heron`, `.visitor-glyph`). The pond's panel says when one is there. Its marker waits as long as it's here (`stay`), and a tap on it sees it too (`tapVisitor`). Seen, it goes in the
player's field journal (`sightVisitor`, `JOURNAL` in the browser, not with the meadow): the first of a kind ever gets "First
sighting" for its caption, a 📖 and the `named` chime. The inspector has it (`THINGS.visitor`, `hogPanel`, `heronPanel`).
A visitor of a kind never seen comes as a mystery: "Something…" in the news (`visitorGlyph`'s `sil`, its shadow), a gold
marker with its shadow (`spotBadge`'s `mystery`) that is never pushed out by newer ones, and it waits till you've seen it
(sim.js `v.wait`, never into winter); "Go see" slows time to 1x. Its first sighting is a moment of its own (`startReveal`,
`revealFrame`, `endReveal`): time eases down to 1x, the camera leans in, the cards step away and the intro's bars come in
with "First sighting" and its name, the meadow hushes for the `found` bells, then its stamp flies to the book and its panel
opens. Any input ends it; a kind that lives here gets only the caption and the stamp. At `REVEAL_SNAP` it takes a picture round
the visitor, the ground drawn in as for P (`snapReveal`, kept under `aeon-garden-journal-photos`, `photos`), and its journal page
shows it pasted in, the painting stuck on its corner. Once a kind is in the journal, its visitors have moments to be caught in
(`MOMENTS`, `momentOf`, `watchVisitor`: asleep, on its way or on the wing for `MOMENT_MS`, a catch or a find as it happens, a 🪲
popping up over a hedgehog's finds); the first time each is a caption, the seen chime and its emoji's stamp into the book, and a
chip on the page. A day or two before a visit, its sign (sim.js `w.signs`): 🐾 tracks along the way it'll come in to the hedge,
or a 🪶 on the bank (`drawSigns`), with a line of news and a marker. The journal's card and more visitors
are still to come (`research/visitors-and-journal.md`). A new meadow opens close, over the open ground with the most animals (`homeView`, `HOME_TILES`).
The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second), and
the news log dates each line with a season chip (`seasonChip`).
The rivers run (`drawFlow`, worked out once a meadow by `flowOf` from the sim's `w.current`): streaks of current, quicker
down the middle, white water at the fords and where the brook comes in or the river leaves the lake, and things floating by,
all placed by the flow's clock alone (`flowTick`: the sim's `riverPace`, faster in the spring flood and at speed, slower at
the summer low). A frame only looks at the stretches of river on screen (`R.box`). What floats comes mostly from the trees
on the bank (`floatSources`, once a day: blossom off one in flower, its leaves as `treeLook` draws them while they come
down), and a little from upstream; a tree you plant by the river drops its leaves in.
A first visit (or `?intro`) gets a short welcome card, then the intro (`startIntro`, `introFrame`): an
empty meadow (createWorld's `arrival` option, `planArrivals` in sim.js) where a family hops in at dawn,
digs its burrow and turns in for the night, while the camera, the clock's pace and a caption at a time
follow along in letterbox bars. It never steers the animals, it waits for them. Any key, click or scroll skips it.
Then the guide (`startGuide`, `guideTick`, a card bottom left with the news above it): three steps one at a time
(follow an animal, run time faster, open the ring), each waiting till it's done, then a notebook of things to try
(`TRIES`: lightning, fire, a fox, the weather, a tree, a year at 60×, the graphs) that tick off whenever they're done
(`tried`), a tap on one putting its tool in hand. It keeps what's done under `aeon-garden-tried`, comes back on later
visits till it's done or closed, and ••• "Things to try" opens it again.
Left alone for a minute while it runs, with no card open (or on V, or ••• "Sit back and watch"), the meadow films
itself (`startIdle`, `pickShot`, `idleFrame`): the intro's bars and lines, the cards faded away, shots that follow an
animal or drift past a place, what just happened first (`idleNews`). A shot keeps one zoom and only pans, and the next
comes after a dip to dark or a glide. Any key, click, scroll or mouse move hands it back, the camera staying put.
The meadow is kept in the browser when the page is hidden or closed, and while it films itself (`keepMeadow`:
IndexedDB, under its link, the last `KEEP_MEADOWS`), never on a timer while someone watches (a save is a few frames).
The next visit opens it where it was (`resumeWorld`): the bare address the one watched last, a `?seed=` link its
own. Back after `AWAY_MIN` it runs on a season, drawing nothing (days would flicker), behind a card that then says
what happened (`startAway`, `awayFrame`). The ••• menu shares the link (a phone's share sheet) and takes ideas
(the `#ask` card). The ••• menu and the stats page also open "Who ate whom" (`#web`, `toggleWeb`, `updateWeb`): the food
web as an SVG made once (`WEB_NODES`, `WEB_LINKS`, placed by hand), each arrow from the eaten to the eater as thick as
the log of what went along it, a thing gone now faded with its arrows, a sentence on a tap or hover. Its counts are
sim.js `webCounts` (the old `w.stats` counters plus plain increments: `grazed`, `sips`, `blossomSips`, `grubs`, `apples`,
`nuts`, `bodies`, `remains.crows`), minus the snapshot the sim keeps each season (`w.stats.web`, the last `WEB_KEEP`)
for "this season" and "last year". Open, it updates once a second, writing only what changed; closed, nothing.
A meadow kept before them gets the new counters at 0 (`unpackWorld`), no `KEEP_VERSION` bump. Visits are counted by GoatCounter (`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the
page `/meadow` whatever the seed, and a link posted with `?ref=reddit` says where they came from.

On a phone (and Back anywhere): Back steps out of what's open as Esc does (`stepOut`: a card or menu shuts, the inspector's
open sheet folds and then shuts, a tool goes back to Look). Each thing open holds a step in the history, counted, not
named (`opened`), and `syncBack` levels the history with what's open after every tap or key: pushed only inside a tap,
as Safari skips a step a page adds outside one. The journal keeps steps of its own on top (`journalTo`). The inspector's
sheet follows the finger and settles open, folded or away by where and how fast it's let go (`sheetLetGo`); Who ate whom
is a sheet the same way on an upright phone (`dragShut`, a scrim, ✕ at its foot). With Look in hand a double tap zooms in
on the spot, a double tap held and dragged zooms as it goes, and two fingers tapped zoom out (`zoomTo`, `zoomDrag`, as
Google's and Apple's maps do); a tap that would only put the inspector away waits `DOUBLE_MS` in case it's the first of
two (`tapAway`). A held finger grows a ring under it till the ring of tools opens (`holdShow`), Android buzzes where a hold
lands and for a first sighting (`buzz`; iPhones give a page no vibration), and on a touch screen the screen stays awake
while time runs, till nobody has touched it for `WAKE_MS` (`wakeTick`, the Screen Wake Lock API). Headless Chrome's
emulated touches stick after a tap on a button that hides itself in that tap (a ••• item): test those with a mouse click.
