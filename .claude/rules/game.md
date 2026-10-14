---
paths:
  - game.js
  - index.html
  - fur.js
  - fur-worker.js
---

# game.js

Drawing, the camera, the inspector. The world fills the screen; over it only the watch, a small pill top right
(pause, sound, •••), a toast line (`toast`, for a copied link or an idea that couldn't go) and the inspector. The old
watching game's cards, news feed, stats, journal, tools, intro and idle camera were cut on the `cooking` branch
(main at 1d79f03 has them).

The inspector shows animals and every other thing you click (hives, trees, rocks, burrows, flowers, fields, water,
visitors): each kind is an entry in `THINGS`, saying how to find one on screen and what its panel shows. A tap
on an animal follows it (`select`, `ui.follow`). Animals can't be named by the player. Every animal of a kind is alike
(sim.js has no genes, only a rabbit's winter coat), so an animal's panel is its mood, tummy, family and life story (a rabbit's
with its coat and how well it hides where it sits, `coatLine`), and a hive's its honey (`honeyWord`)
and the fields in reach; a hive goes by the field nearest it (`hiveName`).

Foxes and rabbits are painted (fur.js: `paintFox`, `paintRabbit`): one rig posed for
what each is doing (`FOX_POSES`, `RABBIT_POSES`, picked by `foxArt`, `rabbitArt`), painted as one animal by `paintFur`
(one shading over it all, each part's form and the markings soft, a part in front casting a soft shadow, a softened
outline and a faint grain), so its parts don't read as separate shapes. Every rabbit wears the wild coat (`COAT`; fur.js can
still paint the sandy, black and blue-grey ones), and in winter whitens as far as its moult takes it (sim.js `whiteness`) in 5
steps (`whiteStep`): only the brown and the white are painted, the steps between are the two mixed (`paintRabbit`, `furReady`).
A fox wears its own shade (`c.fur`). A dead rabbit white for winter lies white (`remainsLook`, `BODY_COATS`). A painting
is costly (each pass through the scratch layer is a flush), so parts can share one (`joined`) and the parts behind are
just shaded (`flat`). It's painted only at doublings of its size (`FUR_PAINTED`) and shrunk for the sizes between,
which keeps a dozen poses, growing young and zooming cheap. In the meadow the paintings are made off the main thread
(fur-worker.js, which loads fur.js; game.js `furReady` asks for them, and shrinking is done on the page once what it's
made from has come). Till a pose comes the animal holds the one it was last drawn in (`shownPose`,
as a tree's new colours do), or the same at another size or one of its kin stands in (`furKin`), and each look about the
screen is asked for ahead (`furAhead`), so only the first of a look is painted on the page. Without a worker (no
OffscreenCanvas) they're painted on the page, a new pose waiting a frame once the frame has done its painting. The
inspector's portrait is always painted on the page.
On the move their legs go round with the ground they cover (`gaitOf`: a fox trots and gallops four paintings a stride,
its back level at a trot), a rabbit hops in bursts, drawn a little ahead of or behind the sim along its way and
stopping between hops (`hopSurge`), and up to 2x everything is drawn between the sim's last two ticks (`drawnAt`,
`keepLast`). No bubbles stay over the animals: when one starts something worth seeing (spots a fox, runs, chases,
courts) a little bubble pops up and fades (`drawPops`, `POPS`), at most 3 at once, love only for the one followed.

Visitors (sim.js `w.visitors`: a hedgehog, a heron, dragonflies, a kingfisher, a skylark) are drawn in with the trees and
animals, painted like them, and the inspector has them (`THINGS.visitor`, `VISITOR_PANELS`). None arrives now: they only
came to the keeper's places, and they'll come back as the cooking game's NPCs. The hedgehog (`paintHedgehog`: walking,
snuffling, curled up asleep; `visitorArt`, `drawVisitor`) fades in and out at the ends of its way (`visitorFade`). The
heron (`paintHeron`, `HERON_POSES`; `heronArt`, `drawHeron`) flies in high and glides down (`heronLift`), wades with rings
round its legs, and splashes where it stabs. Dragonflies, the kingfisher and the skylark are painted in fur.js
(`Fur.painters`: `paintDragonfly`, `paintKingfisher`, `paintSkylark`), at doublings of their size and shrunk between
(`furPaint`, `shrunk`), and in the meadow by the worker as a fox is (`isFur`, `furReady`, `furKin`, `furAhead`). How high
each is drawn is `visitorUp`.

A new meadow opens close, over the open ground with the most animals (`homeView`, `HOME_TILES`).
The tab's icon follows the season and the part of day (`updateFavicon`, at most once a second).
The rivers run (`drawFlow`, worked out once a meadow by `flowOf` from the sim's `w.current`): streaks of current, quicker
down the middle, white water at the fords and where the brook comes in or the river leaves the lake, and things floating by,
all placed by the flow's clock alone (`flowTick`: the sim's `riverPace`, faster in the spring flood and at speed, slower at
the summer low). A frame only looks at the stretches of river on screen (`R.box`). What floats comes mostly from the trees
on the bank (`floatSources`, once a day: blossom off one in flower, its leaves as `treeLook` draws them while they come
down), and a little from upstream.
In autumn a painted tree's leaves come down as its kind's own leaf, in its crown's colours (trees.js `leafSheet`, a sheet
a size from the tree workers, `LEAF_TIERS`): green ones only now and then from a crown still turning (`LEAF_GREEN`),
then its own autumn colour (an oak's last ones dry), a few in its kind's others (`LEAF_OTHER`). Each glides down swinging
from side to side and tipping into each swing, turns over now and then (the paler back), drifts on the wind, and lands
round the foot, where it lies flat a moment and fades. Nothing is kept: a leaf goes round its life on the clock (where it
is comes from the time and hash numbers). The trees dropping leaves are listed as the shadows go down (`treeLeaves`), and
drawn twice by `drawLeaves`: those lying then, under all that stands, those in the air at the end. Each leaf is a
transform and a draw of its own, so they're thinned on trees drawn small (`LEAF_MIN`, `LEAF_FULL`: zoomed out, a wood had
nearly 2000). An emoji tree keeps the old tumbling ovals (`drawFallingLeaves`).

The meadow is kept in the browser when the page is hidden or closed (`keepMeadow`: IndexedDB, under its link, the last
`KEEP_MEADOWS`), never on a timer while someone watches (a save is a few frames). The next visit opens it where it was
(`resumeWorld`): the bare address the one watched last, a `?seed=` link its own. A kept meadow that won't open, or broke
the page the last time it opened (`OPENING`), is let go. The ••• menu shares the link (a phone's share sheet) and takes
ideas (the `#ask` card, also once by itself after two minutes of play: `askTick`). Visits are counted by GoatCounter
(`COUNTER`: cryptoler.goatcounter.com, no cookies), all as the page `/meadow` whatever the seed, and a link posted with
`?ref=reddit` says where they came from.

On a phone (and Back anywhere): Back steps out of what's open as Esc does (`stepOut`: a card or menu shuts, the inspector's
open sheet folds and then shuts). Each thing open holds a step in the history, counted, not named (`opened`), and
`syncBack` levels the history with what's open after every tap or key: pushed only inside a tap, as Safari skips a step a
page adds outside one. The inspector's sheet follows the finger and settles open, folded or away by where and how fast
it's let go (`sheetLetGo`). A double tap zooms in on the spot, a double tap held and dragged zooms as it goes, and two
fingers tapped zoom out (`zoomTo`, `zoomDrag`, as Google's and Apple's maps do); a tap that would only put the inspector
away waits `DOUBLE_MS` in case it's the first of two (`tapAway`). On a touch screen the screen stays awake while time
runs, till nobody has touched it for `WAKE_MS` (`wakeTick`, the Screen Wake Lock API).
