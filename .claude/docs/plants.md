# Mushrooms, greens, wild finds, brambles, rocks and flowers

## game.js

Wild finds (sim.js `w.finds`) are painted once a look and size (`paintFind`, `FIND_ARTS`: 'find:' + kind * 4 + stage * 2 + look):
dandelions (`paintDandelion`: a toothed rosette, bright heads, now and then a clock), sorrel (a rosette of broad lime arrow-leaves
on red stalks, the front ones leaning out so it doesn't read as grass; rusty seed spikes), wild strawberries (trefoils, scarlet
berries), elderflower (one round shrub: a dome of leafy clumps, a few leaves at its rim, flat lacy plates of flowers on top),
hazelnuts (round nuts in frilly husks on yellow leaves), rosehips (an arching rose with scarlet hips, bare in winter: stage 1) and
watercress (sprigs of flat round glossy leaflets standing in the shallows, a pale ring of water round its foot, a rim of snowy ice while the water is frozen, stage 1: `cressSprig`, `findStage`). A
bit bigger and brighter than the meadow's own flowers and tufts (`FIND_PX`). What lies about for a fire is painted plainer
(Axel wants the sticks thin): a few thin crossed sticks (`paintSticks`, `twig`), rounded pebbles (`paintPebbles`), a pale gold
tuft of dry grass arching over (`paintDryGrass`) and thin rolled curls of white birch bark with dark dashes (`paintBark`). They
don't glint (sim.js `eachPickable` leaves them out), but a hover names them and a click picks them as any find. Drawn with the trees and animals (a frame item's `s`,
`drawFind`), they come up over `FIND_GROW` and fade over their last `FIND_OVER`. The satchel shows the same paintings.

Mushrooms (sim.js `w.shrooms`) are painted once a look and size (`paintShroom`, `SHROOM_ARTS`: five kinds, three looks each,
a look being how many caps): ceps, chanterelles and field mushrooms in a clump on the ground, oyster mushrooms and chicken of the
woods as lobed brackets in tiers (`paintShelves`), out of a log's side and up a snag's trunk (`placeShroom`, `SHROOM_LOG`,
`SHROOM_SNAG`). They're drawn with the trees and animals, back to front (a frame item's `s`), come up in three steps over
`SHROOM_GROW` of a day and fade as they go over (`SHROOM_OVER`). Their panel (`THINGS.shroom`, before the trees so one at a
tree's foot is picked first) has the painting for a portrait (`shroomFace`: the 🍄 emoji is a fly agaric), where it grows and
why (`richWhy`: remains, a warren, a holt), what the cook would make of it (`SHROOM_COOK`) and how fresh it is; a tree's panel says
when there are mushrooms under it or on it.

Spring greens (sim.js `w.greens`) are painted once a look and size too (`paintGreen`, `GREEN_ARTS`: kind, stage from sim.js
`greenStage`, and two looks): wild garlic a carpet of broad leaves (`paintGarlic`), white starry heads in flower, yellowing as it
dies back, drawn flat under all that stands (`drawGarlic`, after the remains); nettles a stand of stems with toothed leaves
(`paintNettles`), young tops reaching up, drooping and strung with flowers in summer, brown in autumn, drawn with the trees and
animals (a frame item's `s`, like the mushrooms). They fade in as they come up and out as they go (`greenFade`), and a patch
grows with `g.size`. Their panel (`THINGS.green`, after the trees and rocks, since the garlic lies under them) has the painting
for a portrait (`greenFace`), when to pick them, why they grow there and what the cook would make of them.

Brambles (sim.js `w.brambles`) are painted once a look and size too (`paintBramble`, `BRAMBLE_ARTS`: eight stages and two
looks): a low mound of leaves of three or five toothed leaflets (`brambleLeaf`) over the shade inside it, with purple canes
arching out of it to the ground at its sides and a couple over the top; in winter only the tangle of canes and a few dark
leaves. Pale flowers early in summer, then berries (`brambleBerry`): green and red, ripe and black in three paintings by what's
left on it (`brambleArt`: more than 0.6 of its crop, more than a quarter, fewer), and shrivelled among red leaves as it goes over.
Drawn with the trees and animals (a frame item's `s`), bigger each spring (`b.size`). A crow eating from one is in `CROW_PECKS`.
Its panel (`THINGS.bramble`, before the trees) has the painting for a portrait (`brambleFace`), the stage, a berries meter while
they're ripe, how it came there (a crow's pips, a cane rooted, the wood's edge), what the cook would make of them, the crows
and foxes eating off it, a rabbit hiding in it, and the bees at its flowers. A bee on its blossom sits on the mound (`liftOf`,
`bramblePx` times the spot's `up`); a fox at the berries has its 'feed' pose, a rabbit in the thorns its 'alarm' one.

## sim.js

Rocks are painted (`rockInfo`, `rockSprite` in game.js): pebbles, stones and boulders by
size (`TERRAIN.rockSize`), flat stones at the fords, and two or three great rocks per meadow
(`TERRAIN.bigRocks`, `big: true`) that burrows keep clear of. Like a tree's, a rock's snow is a layer of its
own, painted once and faded in as thick as the snow lying, so the snow never repaints the rock.
Flowers are painted too (`flowerSprite`, one painter per kind in `FLOWER_ARTS`): a clump on stems in
one of `FLOWER_VARIANTS` looks, painted once per half-octave size. Which painting a flower gets comes from
the sim's flower and the season (`flowerArt`). Thought bubbles are painted too: the bubble and an icon for the
mood (`BUBBLE_ICONS`), one sprite. Trees are painted by trees.js (above). The rest of the ground cover is more
`FLOWER_ARTS`: green tufts, tawny ones in autumn, sprouts, fallen leaves, nodding seed heads and winter's frosted
tufts (`paintTuft` … `paintTuftFrost`); the windfalls under a tree are `paintFall`.

Mushrooms come up for a few days after rain (`shroomsTick`, once an hour; `w.rainAt`, the last hour it rained: full odds for
the first day after, none by `SHROOM_AFTER[1]`), mostly in autumn (`SHROOM_SEASON`), none under snow: oyster mushrooms on a log,
chicken of the woods (a sulphur shelf) up a broadleaf snag (`shroomOnWood`, `SHROOM_WOOD` an hour each), ceps round a grown oak
or pine and chanterelles round a birch or beech (`shroomUnderTree`, `SHROOMS[k].trees`, `SHROOM_REACH` from the trunk, in front of
it or to a side), and field mushrooms on rich ground (`shroomOnRich`, `SHROOM_RICH`: a kill site, a warren's latrines, an otters'
spraint, where a log rotted away; not in a burrow's mouth), so they chain on from the remains and the rabbits. Each clump is one
object of one layout (`shroomOf`: kind, place, its tree, born and until, caps and look), in a short list (`w.shrooms`, at most
`SHROOM_MOST` times `w.room`), lasting `SHROOM_DAYS`; it goes early if its log rots away, its snag falls, the water rises over
it or snow lies. They come up only where the player can see them: not behind a tree, a log or a rock drawn in front (`inSight`,
`SHROOM_HIDE`, by how game.js draws them), which keeps most of them to the woods' edges and the open. They have random numbers of
their own (`w.shroomRng`), so the meadow plays out the same with them. An autumn has 10 to 20 clumps about on average, 15 to 30 at the
height of a flush and next to none in a dry spell; a summer a few after a storm. Nothing eats them yet: they're for the cook. game.js paints them (the game.js part above).

Spring greens (`greensTick`, once a day): wild garlic and nettles, so spring has something to pick. They're patches that live for
years (`w.greens`, one layout, `greenOf`), underground most of the year and coming up in the same spots each spring, a little
bigger each time (`g.size`, 0 to 2). What a patch shows comes from the season (`greenStage`, `GREEN_SEASONS`): garlic's leaves
from the start of spring, white flowers from its middle, dying back in the first fifth of summer; nettles' young tops in spring,
tall and flowering in summer, brown till the middle of autumn. Garlic grows in damp wood (`GARLIC_WOOD`, within `GARLIC_DAMP` tiles
of the water, `w.damp`, above the spring flood; `garlicAt`): a meadow starts with some (`startGreens`, `GARLIC_START`), a few more
come up each spring and patches seed one next door now and then (`GARLIC_SPREAD`); it doesn't come up a spring with the wood gone
over it. Nettles come up on rich ground (`NETTLE_RICH`, `nettleAt`), spring and summer, so they gather round the busy warrens and
kill sites, and die out a year after the ground stopped being rich (`g.fed`, `NETTLE_FED`). Both only where the player can see
them (`inSight`, as the mushrooms), at most `GREENS_MOST` of each times `w.room`, with random numbers of their own
(`w.greenRng`). A meadow has about 5 to 13 garlic carpets, and nettles build up to 10 to 25 patches over three years. Nothing eats
them: they're for the cook.

Wild finds (`findsTick`, every two hours): little things to pick in every season, so a view has a few most of the time.
Dandelions out in the open and sorrel in the damp grass in spring, wild strawberries at the woods' edges and elderflower by the
water or a wood's edge in summer, hazelnuts at the edges in autumn, rosehips in the scrub (by the thorns or a wood's edge) from
late autumn through the winter, and watercress in the shallows by the bank from the end of autumn into spring (`FINDS`: when,
`from`/`to` in seasons into the year; where, `findPlace`; how many at most, `most` times `w.room`; what a pick gives, `n`; `wet`:
watercress goes only when the water there turns deep). Each is a short-lived thing of one layout (`w.finds`, `findOf`), coming up
where it suits, in sight (`inSight`), mostly near another of its kind (`FIND_PATCHY` of the time, `FIND_PATCH` off one picked at
random, `oneFind`) till that patch has `FIND_CLUMP` (`clumpAt`), so they come in small patches with open meadow between, not an
even sprinkle or a long row; it lasts `FIND_DAYS`, never past its season, and the low ones go under snow (`FIND_SNOW`). A look
brings up a fifth of what's missing (`FIND_FILL`), so a season fills in a day or so and a picked one is soon made up somewhere. A
new meadow starts with most of what's in season, of all ages, `CAMP_FINDS` round the forager's camp within `CAMP_REACH` (the kinds
in season in turn, two of a kind, so one that won't grow there leaves room for the others) and a garlic carpet there if there's
damp wood thin enough for one (`startFinds`, `garlicAt`'s camp). Random numbers of their own (`w.findRng`). In a 45 by 28 tile
view anywhere in the meadow (8 seeds, a year) there are about 5 things to pick in spring, 5.5 in summer, 4.5 in autumn and in
winter, none in about one view in ten; round the camp a few more. A meadow kept before them gets them when it opens
(`unpackWorld`), no `KEEP_VERSION` bump. Nothing eats them: they're for the cook.
What lies on the ground for a fire is four more kinds in `FINDS`, marked `ground` (not food, so `eachPickable` leaves them out
and they never glint), there all year (`from: 0, to: 4`: no end of season, `addFind`), each lying its own `days`: sticks
under a crown or by a log (`inCrown`) or in the woods, the commonest, more in rain and a lot more in a storm (`STICK_WIND`, and a
storm brings them down faster); pebbles by the water's edge, at the fords and round the rocks (`stonyAt`); dry grass in long
open grass (`DRY_GRASS`), mostly in summer and autumn (`more`, its most by season), standing up out of the snow; birch bark
under a birch or a little way out from one (`inCrown`, `birchNear`), standing or fallen. Their most go through `findsMost`. A
new meadow lays `CAMP_GROUND` of each round the camp,
looking further out till it's found, so a first fire can always be made (4 to 6 seeds: sticks within about 5 to 19 tiles,
tinder within about 20). In a meadow over a year: about 25 to 50 sticks (50 in a storm), 14 pebbles, 14 dry grass in summer and
autumn and 4 to 7 in winter and spring, 5 to 8 birch bark (a pick gives two).

Brambles (`bramblesTick`, once an hour for the berries and once a day for the rest): thorny mounds that live for years and
show all year (`w.brambles`, one layout, `brambleOf`). What a patch shows comes from the season (`brambleStage`): bare canes in
winter and early spring, leaves, flowers till `FLOWER_TO` into summer, berries ripening, then ripe from `RIPE_FROM` into summer
to `RIPE_TO` into autumn, and going over after that. A patch grows each spring (`b.size`, 0 to 2) and fruits from its second
summer: the hour its berries ripen it gets a crop (`b.crop`, `BERRY_CROP`, half on a patch a year old, less in the shade), and
what's left (`b.berries`) is gone when they go over. A meadow starts with some along the woods' edges (`BRAMBLE_EDGE`) and by
the thorn bushes (`startBrambles`, `BRAMBLE_START`, a few years old). A grown patch roots a cane tip next door now and then in
autumn (`BRAMBLE_ROOT`, `by: 'tip'`), a first-year one on grass grazed short is a rabbit's mouthful (`BRAMBLE_GRAZED`,
`BRAMBLE_NIBBLE`), so the warrens keep them back, and one dies the spring the wood over it is thicker than `BRAMBLE_SHADE`. New
ones come from the crows (`brambleAt`: dry ground above the spring flood, not a flower field or a burrow's mouth, in sight,
`BRAMBLE_GAP` from the others, at most `BRAMBLE_MOST` times `w.room`). Random numbers of their own (`w.brambleRng`). A meadow has
about 12 to 16, 20 to 30 by year three.
In flower a patch (size 1 or more) is `BRAMBLE_BLOOMS` spots of blossom for the bees (`brambleBlossoms`, in `w.blossoms` like a
tree's, `p.tree` the bramble, `b.blooms`; `isFlower` asks `brambleStage`), and its crop is `BRAMBLE_SELF` plus the rest by the
bees' visits (`b.visits`, `BRAMBLE_VISITS`), so a bramble by a hive bears best. A grown patch is a rabbit's refuge: `pickRefuge`
weighs it with the burrows, and a rabbit that reaches it sits tight in the thorns, visible, at its foot (`enterThicket`, mode
'thicket', `thicket`: `THICKET_TICKS`, longer while an awake fox is within `THICKET_FOX`, never past `THICKET_MOST` or once
hungry). No fox follows it in: `hunt` drops it and doesn't pick it (an escape, how 'bramble'). In the ripe weeks a fox fuller
than a hunt but under `FOX_BERRY_FED`, not a cub, goes to the nearest ripe bramble it smells (`foxBerries`, `FOX_BERRY_SIGHT`,
modes 'bramble' and 'berries'), eats `FOX_BITE` a tick for `FOX_BERRY_TICKS` (about a day's keep a trip) and drops the pips
like a crow (`dropPips`). The crows and the foxes share the berries; the rest are the cook's.
