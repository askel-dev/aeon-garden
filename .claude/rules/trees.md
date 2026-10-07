---
paths:
  - trees.js
  - tree-worker.js
  - tree-lab.html
---

# Trees (trees.js)

- `trees.js`: the trees, painted in code. Each kind
  (`KINDS`: oak, hive oak, beech, maple, birch, alder, apple, cherry, pine, hawthorn) is sculpted as a little 3D
  model of spheres for the light (a skeleton swept in bark, leaf clumps at the twig ends), then painted over:
  leaves as flat leaf-shaped dabs from shade to light, bark as strokes along each branch. The 3D gives the volume, the
  brushwork keeps it from looking 3D (plain 3D leaflets looked like broccoli). The seed fixes a tree's shape and the
  season only its leaves. The hive oak carries the hive: a dome of straw rings in a split in its trunk.
  Painting is slow (a few hundredths of a second a tree, more on a phone), so the game has it done in two workers
  (`tree-worker.js`, `TREE_WORKERS`) and never on a frame; the painter's loop over every pixel makes no arrays, which Safari is slow at: each kind in 4 shapes (`TREE_SHAPES`, a tree picks one from where it stands), each shape in its
  season's looks, each look at a few sizes (`TREE_TIERS`), asked for only when on screen and kept within
  `TREE_BYTES` (game.js, `treePainting`). A tree turning crossfades between two looks (`treeStage`), with looks
  in between so the two are alike (`LOOKS` in trees.js: an oak bare in early spring, first leaves, half fallen);
  a bare crown shows only its branches, about half of the finest left out (`PRUNE`), so it stays simple. Each kind is drawn at its own height (`TREE_SCALE` in game.js, times
  the sim's `d.size`, which only says how grown a tree is): oaks and beeches big, apples smaller, the hive oak
  a giant, and a tree four to seven rabbits tall (`creaturePx`). The look is cartoonish:
  big leaflets (`LOOK.leaflet`), their greens, one colour for a whole tree (from its seed, a few clumps another,
  so autumn is a patchwork of trees and not of leaves), the crown up off the trunk (`LOOK.lift`) and the
  branches not too wide (`LOOK.spread`), so you see trunks and ground between the trees. The alder (by the water) is a narrow cone of climbing branches, the darkest green, olive in autumn, hung with catkins and
  cones when bare (purple-brown in winter, gold in the `bud` look); about half part into two stems at the foot. Axel tried a
  willow and didn't like it: it's gone, don't bring it back unasked. Snow is a layer of its own, laid on as thick as the snow lying. A painting is
  also of a tone (the sim's `d.tone`: one of three colours of its kind, or a copper beech), and of the grown or the
  young form (slimmer, its branches more upright; a seedling is one, small); a dead tree is the grey `dead` look (one a fire killed, `d.burnt`, the charred `burnt` look) with
  limbs broken off, a fallen one the `log` kind, and one lightning took the `stump` kind. The paintings go by number
  (`treeKey`), so a frame builds no names. Until its painting comes the same look at another size stands in, or a
  small painting of its kind in that look (`treeKin`: one of each, painted ahead at the start by `kinAhead` and kept
  for good, outside `TREE_BYTES`), or another look of itself (`treeAny`). With none of those yet (the first moment
  after the page loads) a tree isn't drawn, and fades in when its painting comes (`treeWaits`).
  Small paintings are sculpted coarser (`ss`), which is most of the saving.
  `tree-lab.html` shows every kind in every season, close and far, in any tone, young or grown, dead, as a log and
  as a stump, with sliders for `LOOK` and a "Copy as code".
