# The trees' lives (sim.js)

Every meadow has trees along its lasting water, as along any river or lake left to itself (`TERRAIN.fringe`, `fringeGaps`,
`fringeSpacing`, the end of `plantTrees`, with random numbers of their own): one here and there on the bank above the spring flood,
in stretches with open bank between. And a tree within `FLOAT_REACH` of lasting water drops some of its seed in it (`ON_WATER`,
`floatSeed`): it floats down the current (`w.current`) or about still water and comes up where it washes ashore above the flood
line (`by: 'water'`), so the bank trees seed the banks downstream; some float out of the meadow or sink in a lake. An alder drops
most of its seed in (`float`), and its seedlings come up only within `wet` tiles of the water (`w.damp`), so alders keep to the banks.

Every tree has a kind (`d.kind`: oak, beech, maple, birch, alder, hawthorn, apple, cherry, pine), from where it stands
(`treeKind`, `TREE_MIX` in sim.js): mostly alders by the water (dark green, still green in autumn when the rest turn), hawthorn scrub and old oaks out in the open, birches at the
wood's edge, beech, oak and maple deep in. The drawing, its autumn colour and the inspector all follow it.

Trees live slow lives of their own, loosely like real ones (`treesTick`, once a day; `TREES` in sim.js gives
each kind its pace, seed and hardiness). The pace is quick for a game: a birch comes and goes in about 10
years, an oak in about 24 (`life`). Early in autumn a tree old enough sheds its seed (`seedFall`): on the wind
(birch, pine, maple), left for the crows to bury out in the open (oak, beech: `d.nuts`, see the crows), dropped by birds under a perch, a thorn bush
likeliest (hawthorn, cherry), or fallen and carried a little way (apple). Oaks and beeches fruit together,
heavily in a mast year (`w.mast`) and little between, and the nuts are a windfall for the rabbits. In spring the
seed comes up where there's light enough for its kind (`sprout`, `shadeOver`; pines only in pine country,
`w.pineLand`), less often as the woods fill their room (`TREE_ROOM`). A seedling is a mouthful for a rabbit
unless a thorn bush guards it (`THORNS`), so grazing keeps the meadow open, and after the rabbits crash the
woods creep out. A tree grows through seedling, sapling, young, grown and old (`treeStage`, from `d.size`
and its age), a young one waiting in the shade if its kind bears shade. It dies (`treeDies`) of shade,
grazing, flood, a storm or age, stands a while as a grey snag, falls as a log (`treeFalls`) and rots
away; a broadleaf struck by lightning grows again from its stump. Apple, cherry and hawthorn blossom for
the bees in spring (`w.blossoms`) and bear as much fruit as the bees visited (`setFruit`). A tree takes its
parent's tone (`d.tone`: which of its kind's colours; now and then a beech is a copper beech, `RARE_TONE`),
and a tree that grows old may get a name (`oldName`), which the inspector uses.

Apple trees (`w.orchard`) drop windfalls early in autumn (`windfallTick`, `d.windfall`), a big meal that hungry rabbits
walk a way for (`windfall`), so the apple trees are where they gather in autumn, and where the foxes find them.
