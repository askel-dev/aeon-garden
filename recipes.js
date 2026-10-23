'use strict';
{ // (the whole file is one block, so none of its names clash with the game's: the game reads it as Recipes)
// Every ingredient, station and dish in the game, as plain data. To add a dish, copy a block in RECIPES and change
// the words; to add an ingredient, copy a line in INGREDIENTS. Then open recipes.html: it lists everything and says
// what's wrong (a word it doesn't know, two dishes made the same way, too many things for the station). The game
// says the same in the console when it loads.
//
// A word in `needs` is one of:
//   - an ingredient ('apple'),
//   - a tag, any ingredient that has it ('mushroom' takes a cep, a chanterelle, a field mushroom...),
//   - a dish, by its name ('Wilted greens'), so dishes can go into other dishes.
// Write a word twice to need two. The order doesn't matter, and what goes in has to match exactly: an apple and honey
// make the baked apple, but an apple, honey and a blackberry don't (that's another dish, or a forager's mess).

// Where you cook, and how many things go in at once.
const STATIONS = {
  fire: { name: 'Campfire', slots: 4 },
  oven: { name: 'Clay oven', slots: 4 },
};

// What a dish is cooked in at the fire, and how many things it holds. Each is made by the forager first (CRAFTS): a stick, a
// stone and a bark bowl at once, the clay pot and the clay griddle (the pan) shaped and fired. The oven is a station of its
// own, not a vessel.
const VESSELS = {
  pot:   { name: 'Pot',    slots: 4, icon: '🍲', word: 'boiled in the pot' },
  pan:   { name: 'Pan',    slots: 3, icon: '🍳', word: 'fried on the griddle' },
  stick: { name: 'Stick',  stack: 20, slots: 2, icon: '🍢', word: 'roasted on a stick' },
  stone: { name: 'Stone',  slots: 2, icon: '🪨', word: 'baked on a hot stone' },
  bowl:  { name: 'Bowl',   slots: 3, icon: '🥗', word: 'mixed in a bowl, no heat' },
};

// What the meadow gives. The ids of the ones the sim grows are the sim's own (SHROOMS, the greens, a tree's fruit or
// mast). fill: how much it fills the tummy eaten raw. raw: false if it can't be eaten as it is. icon: an emoji to stand
// in until it has a painted one. text: a line said under its name the first time it goes in the satchel.
// stack: how many one satchel slot holds (default 10, sim.js STACK).
// keep: how many one slot of a set-down store holds, the camp's basket and the keeps to come (default: its stack).
// where: when and where to look for it, for its page in the book (shown before it's found, as the hint).
// uses, mend: a tool's (tagged 'tool'): how many uses it has new (sim.js wear: what a thing costs is the tool's own code's),
// and what puts it back to new at the make strip, { word: how many } as a build's needs. A tool is one to a slot.
// dries: what it turns into hung on the camp's drying rack a day or two in dry weather (sim.js rackTick); the dried one
// has dried: true (it isn't a kind of food the basket wants one of).
const INGREDIENTS = {
  apple:       { name: 'Apple',               tags: ['fruit'],          fill: 1,   dries: 'applering', icon: '🍎', text: 'Windfalls in the grass under the tree, sweet with a bruise.', where: 'Autumn: windfalls in the grass under the apple trees.' },
  cherry:      { name: 'Cherries',            stack: 20, tags: ['fruit', 'berry'], fill: 1,   dries: 'driedberry', icon: '🍒', text: 'Dark and warm from the sun, picked in pairs by the stalk.', where: 'Early summer, on the cherry trees out in the open.' },
  blackberry:  { name: 'Blackberries',        stack: 20, tags: ['fruit', 'berry'], fill: 1,   dries: 'driedberry', icon: '🫐', text: 'Off the brambles, mind the thorns. One for the satchel, one for you.', where: 'Late summer into autumn, on the brambles at the edges of the woods.' },
  honey:       { name: 'Honey',               stack: 5, tags: ['sweet'],          fill: 2,   icon: '🍯', text: 'Taken gently, leaving the bees what they need.', where: 'From the bees in the hollow old oaks, when they have some to spare.' },
  cep:         { name: 'Cep',                 tags: ['mushroom'],       fill: 1.5, dries: 'driedshroom', icon: '🍄', text: 'A fat brown cap on a white stem: the cook\'s favourite.', where: 'Under oaks and pines a day or two after rain, mostly in autumn.' },
  chanterelle: { name: 'Chanterelles',        tags: ['mushroom'],       fill: 1,   dries: 'driedshroom', icon: '🍄', text: 'Golden, smelling faintly of apricots.', where: 'Under birches and beeches after rain, mostly in autumn.' },
  field:       { name: 'Field mushroom',      tags: ['mushroom'],       fill: 1,   dries: 'driedshroom', icon: '🍄', text: 'Pink gills under a white cap, up after the rain.', where: 'Out in the grass where the ground is rich, after rain.' },
  oyster:      { name: 'Oyster mushroom',     tags: ['mushroom'],       fill: 1,   dries: 'driedshroom', icon: '🍄', text: 'Soft grey shelves on a fallen log.', where: 'On fallen logs, after rain.' },
  sulphur:     { name: 'Chicken of the woods', tags: ['mushroom'],      fill: 2,   icon: '🍄', raw: false, text: 'Orange shelves on a dead tree. Never raw: it wants cooking.', where: 'On dead trees still standing, after rain.' },
  garlic:      { name: 'Wild garlic',         keep: 20, tags: ['greens'],         fill: 0.5, icon: '🌿', text: 'You smell it before you see it.', where: 'In spring, carpeting the damp woods near the water.' },
  nettle:      { name: 'Nettles',             keep: 20, tags: ['greens'],         fill: 0.5, icon: '🌿', raw: false, text: 'Pinched by the tops. They sting raw, but not once cooked.', where: 'Spring to autumn, wherever the ground is rich.' },
  acorns:      { name: 'Acorns',              tags: ['nut'],            fill: 1,   icon: '🌰', raw: false, text: 'Bitter raw. They need soaking and roasting.', where: 'Autumn, under the oaks. Plenty in a mast year.' },
  beechnuts:   { name: 'Beechnuts',           tags: ['nut'],            fill: 1,   icon: '🌰', text: 'Little three-sided nuts from under the beeches.', where: 'Autumn, under the beeches. Plenty in a mast year.' },
  hazelnut:    { name: 'Hazelnuts',           tags: ['nut'],            fill: 1,   icon: '🌰', text: 'Cracked between two stones, sweet and milky.', where: 'Autumn, along the edges of the woods.' },
  dandelion:   { name: 'Dandelions',          keep: 20, tags: ['greens', 'flower'], fill: 0.5, icon: '🌼', text: 'Every bit of it is good to eat, flower to root.', where: 'All through spring, out in the open grass.' },
  sorrel:      { name: 'Sorrel',              keep: 20, tags: ['greens'],         fill: 0.5, icon: '🌿', text: 'Sharp and lemony. A leaf to wake a dish up.', where: 'Spring and summer, in the damp grass near the water.' },
  watercress:  { name: 'Watercress',          keep: 20, tags: ['greens'],         fill: 0.5, icon: '🥬', text: 'Peppery, from the cold shallows.', where: 'Late autumn through winter, in the shallows by the bank.' },
  strawberry:  { name: 'Wild strawberries',   stack: 20, tags: ['fruit', 'berry'], fill: 1,   dries: 'driedberry', icon: '🍓', text: 'Tiny, and sweeter than any from a garden.', where: 'Summer, along the edges of the woods.' },
  elderflower: { name: 'Elderflower',         tags: ['flower'],         fill: 0.5, icon: '💮', text: 'Creamy flat heads that smell of summer.', where: 'Late spring into summer, on the elders by the water and at the woods\' edge.' },
  rosehip:     { name: 'Rosehips',            tags: ['fruit'],          fill: 0.5, icon: '🌹', raw: false, text: 'Red and bright in the cold. Full of hairs: cook them first.', where: 'Late autumn and winter, on the wild roses in the scrub.' },
  // Caught with the rod, from the bank (game.js fishing; FISH below: where and when each bites, and how it moves on the line).
  roach:       { name: 'Roach',               tags: ['fish'],           fill: 1.5, icon: '🐟', raw: false, text: 'Small and silver, with red eyes: the everyday fish.', where: 'Any water that lasts the year, all year. Cast from the bank with a rod.' },
  perch:       { name: 'Perch',               tags: ['fish'],           fill: 2,   dries: 'driedfish', icon: '🐠', raw: false, text: 'Striped green and gold, with a spiny fin up its back.', where: 'Deep still water, spring to autumn.' },
  trout:       { name: 'Brown trout',         tags: ['fish'],           fill: 2.5, dries: 'driedfish', icon: '🐡', raw: false, text: 'Speckled red and black, and strong in the current. The prize.', where: 'Where the water runs, in spring and summer, best at dawn.' },
  eel:         { name: 'Eel',                 tags: ['fish'],           fill: 3,   icon: '🐍', raw: false, text: 'Long, dark and slippery, and it pulls like a rope.', where: 'Deep still water, on summer nights.' },
  // Water food: not fish, but on the hook now and then for a fair angler (HAUL below, PLAN.md stage 14).
  mussel:      { name: 'Freshwater mussels',  stack: 20, tags: ['shellfish'], fill: 1,   icon: '🦪', raw: false, text: 'Blue-black shells off the muddy bottom, shut tight. They open in the heat.', where: 'On the hook from deep still water, spring to autumn, for a fair angler (fishing 3).' },
  crayfish:    { name: 'Crayfish',            tags: ['shellfish'],      fill: 1.5, icon: '🦞', raw: false, text: 'A little lobster of the brook, all claws and temper. It goes red in the pot.', where: 'On the hook where the water runs, on summer evenings and nights (fishing 3).' },
  watermint:   { name: 'Water mint',          keep: 20, tags: ['greens'],         fill: 0.5, icon: '🌿', text: 'A wet green tangle off the hook that smells sweetly of mint.', where: 'Caught on the hook in spring and summer, where it grows along the bank (fishing 3).' },
  // A keepsake from the water (TREASURES below): not food.
  pearl:       { name: 'Pearl',               stack: 5, tags: ['keepsake'],      fill: 0,   icon: '⚪', raw: false, text: 'A little moon from inside a mussel. Something to keep, not to eat.', where: 'Once in a long while inside a mussel, for a good angler (fishing 5).' },
  // Dried on the camp's rack (`dries` above): lighter, so a slot holds more, and sweeter or deeper than fresh.
  driedshroom: { name: 'Dried mushrooms',     stack: 30, tags: ['mushroom'],       fill: 1,   icon: '🍄', dried: true, text: 'Shrivelled dark and leathery, and they smell twice as much of mushroom as they did.', where: 'Hang ceps, chanterelles, field or oyster mushrooms on the drying rack, in dry weather.' },
  applering:   { name: 'Dried apple rings',   stack: 30, tags: ['fruit'],          fill: 1,   icon: '🍎', dried: true, text: 'Chewy and sweet, curling at the edges like old leather.', where: 'Hang apples on the drying rack, in dry weather.' },
  driedfish:   { name: 'Dried fish',          stack: 30, tags: ['fish'],           fill: 1.5, icon: '🐟', dried: true, text: 'Split, salted with ash and dried stiff in the wind. Winter\'s fish.', where: 'Hang perch or trout on the drying rack, in dry weather.' },
  driedberry:  { name: 'Dried berries',       stack: 40, tags: ['fruit', 'berry'], fill: 1,   icon: '🫐', dried: true, text: 'Wrinkled, dark and tart-sweet: summer kept for the cold.', where: 'Hang cherries, blackberries or wild strawberries on the drying rack, in dry weather.' },
  // What lies on the ground for a fire: not food. 'tinder' catches the spark, 'fuel' keeps it going.
  stick:       { name: 'Sticks',              stack: 20, tags: ['fuel'],           fill: 0,   icon: '🪵', raw: false, text: 'Something to keep a fire going.', where: 'Under the trees, all year. More come down in a storm.' },
  pebble:      { name: 'Pebbles',             stack: 20, tags: ['stone'],          fill: 0,   icon: '🪨', raw: false, text: 'Smooth stones, to ring a fire.', where: 'On the shore, at the fords and round the rocks.' },
  slab:        { name: 'Flat stone',          stack: 4, tags: ['stone'],           fill: 0,   icon: '🪨', raw: false, text: 'A slab of river stone, flat and broad as two hands spread. Heavy.', where: 'Now and then on the shore, at the fords and round the rocks.' },
  drygrass:    { name: 'Dry grass',           stack: 20, tags: ['tinder'],         fill: 0,   icon: '🌾', raw: false, text: 'Dry stems from the long grass, to catch a spark.', where: 'In the long grass out in the open, most in summer and autumn.' },
  clay:        { name: 'Clay',                tags: ['earth'],          fill: 0,   icon: '🟤', raw: false, text: 'Cool, heavy and red-grey. It holds the shape of your thumb.', where: 'On the muddy banks, right by the water.' },
  birchbark:   { name: 'Birch bark',          stack: 20, tags: ['tinder'],         fill: 0,   icon: '📜', raw: false, text: 'Papery curls that catch even when damp.', where: 'Under the birches, and a little way out from them.' },
  // Made, not found (made: true keeps it out of the book's Finds): BUILDS.rope twists it at the Craft strip, BUILDS.rod lashes it.
  rope:        { name: 'Rope',                stack: 5, tags: ['cord'],           fill: 0,   icon: '🪢', raw: false, made: true, text: 'Dry grass twisted into a rope. Tie it to a friend (L) and lead them about.', where: 'Twisted from dry grass at the Craft strip.' },
  rod:         { name: 'Fishing rod',         stack: 1, tags: ['tool'],           fill: 0,   uses: 60, mend: { rope: 1 },   icon: '🎣', raw: false, made: true, text: 'Two sticks lashed end to end, with a line and a thorn hook. Tap the water from the bank to cast.', where: 'Made from sticks and a rope at the Craft strip.' },
};

// The dishes. Only name and needs are a must. The rest, when left out:
//   at: 'fire'      the station it's cooked at
//   vessel: 'pot'   what it's cooked in at the fire (VESSELS): 'pot' boiled or simmered, 'pan' fried or toasted on the clay
//                   griddle, 'stick', 'stone' (a hot hearth stone), 'bowl' (no heat). The same things in another vessel
//                   don't make it. Left out: 'pot'.
//   fill            how much it fills the tummy (a guess from what goes in)
//   level: 0        the cooking level it needs before it can be found
//   from            a visitor who teaches it, for a dish ('hedgehog', 'heron', 'kingfisher', 'skylark', 'dragonfly')
//   warm: true      true if it warms you on a cold day (left out: it doesn't)
//   time: 30        how long it cooks, in seconds at 1x (the pot keeps cooking while you're off, only while the fire's lit)
//   known: false    true: a new player knows it from the start (it's in their recipe book), not only once they've made it
//   icon: '🥣'      an emoji to stand in until it has a painted one
//   eats            how it's eaten (game.js EAT_WAYS): 'spoon' (from the bowl), 'hand' (bitten), 'skewer' (pulled off the
//                   stick), 'sip' (the bowl to its lips). Left out: by the vessel (EATS_BY_VESSEL)
//   crisp: false    true: it crunches as it's eaten, and drops crumbs
//   bottle          1, 2, 3...: a secret dish, taught only by a bottle fished out of the water (TREASURES); till then the
//                   things in it cook into whatever else they'd make, or a mess (cook)
//   text            a line for its card
const RECIPES = [
  {
    name: 'Chicken of the woods steak',
    vessel: 'pan',
    time: 35,
    icon: '🍄',
    needs: ['sulphur', 'garlic'],
    warm: true,
    text: 'A thick orange shelf fried like meat. It gives the “never raw” mushroom a dish of its own.',
  },
  {
    name: 'Roast mushrooms',
    vessel: 'stick',
    time: 30,
    icon: '🍢',
    needs: ['mushroom', 'mushroom'],
    known: true,
    text: 'Charred at the edges on a green stick, and the juice runs down your wrist.',
  },
  {
    name: 'Roast wild garlic',
    vessel: 'stick',
    time: 20,
    icon: '🍢',
    crisp: true,
    needs: ['garlic', 'garlic'],
    known: true,
    text: 'The leaves wound round the stick and held over the flames till they crisp and go sweet.',
  },
  {
    name: 'Roast dandelion roots',
    vessel: 'stick',
    time: 30,
    icon: '🍢',
    crisp: true,
    needs: ['dandelion', 'dandelion'],
    known: true,
    text: 'Dug up, threaded on and roasted brown. Bitter, nutty, and filling enough.',
  },
  {
    name: 'Mushroom and garlic skewer',
    vessel: 'stick',
    time: 30,
    icon: '🍢',
    needs: ['mushroom', 'garlic'],
    text: 'One cap, wrapped in a garlic leaf, turned slowly over the coals.',
  },
  {
    name: 'Garlic mushrooms',
    vessel: 'pan',
    time: 40,
    icon: '🍳',
    needs: ['mushroom', 'mushroom', 'garlic'],
    text: 'The garlic wilts into the mushrooms and the whole camp smells of it.',
  },
  {
    name: 'Baked apple with honey',
    vessel: 'stone',
    time: 75,
    icon: '🥧',
    eats: 'spoon',
    needs: ['apple', 'honey'],
    text: 'Soft and sticky, the honey gone to caramel in the cracks.',
  },
  {
    name: 'Honeyed cherries',
    vessel: 'pot',
    time: 45,
    icon: '🍧',
    needs: ['cherry', 'cherry', 'honey'],
  },
  {
    name: 'Warm bramble compote',
    vessel: 'pot',
    time: 60,
    icon: '🥣',
    needs: ['blackberry', 'blackberry', 'honey'],
    text: 'Purple fingers, purple chin.',
  },
  {
    name: 'Wilted greens',
    vessel: 'pot',
    time: 20,
    icon: '🍲',
    needs: ['nettle', 'garlic'],
    known: true,
    text: 'The sting goes out of the nettles in the heat.',
  },
  {
    name: 'Toasted beechnuts',
    vessel: 'pan',
    time: 25,
    icon: '🥜',
    crisp: true,
    needs: ['beechnuts', 'beechnuts'],
  },
  {
    name: 'Toasted hazelnuts',
    vessel: 'pan',
    time: 25,
    icon: '🥜',
    crisp: true,
    needs: ['hazelnut', 'hazelnut'],
    text: 'Rolled in the embers till the skins crackle and rub off.',
  },
  {
    name: 'Hazelnut brittle',
    vessel: 'stone',
    time: 40,
    level: 2,
    icon: '🍬',
    crisp: true,
    needs: ['hazelnut', 'honey'],
    text: 'Honey boiled till it snaps, poured over the nuts and broken up. A shard of it lasts a whole walk.',
  },
  {
    name: 'Mushrooms with hazelnuts',
    vessel: 'pan',
    time: 50,
    icon: '🥘',
    eats: 'spoon',
    needs: ['mushroom', 'mushroom', 'hazelnut'],
    text: 'The nuts crushed over the top at the last moment.',
  },
  {
    name: 'Dandelion fritters',
    vessel: 'pan',
    time: 35,
    icon: '🥞',
    crisp: true,
    needs: ['dandelion', 'dandelion', 'honey'],
    text: 'Dipped by the stalk and fried, a drizzle of honey over.',
  },
  {
    name: 'Spring salad',
    vessel: 'bowl',
    time: 15,
    icon: '🥗',
    needs: ['dandelion', 'sorrel', 'garlic'],
    known: true,
    text: 'Bitter, sour and sharp: the meadow waking up.',
  },
  {
    name: 'Sorrel and mushrooms',
    vessel: 'pan',
    time: 40,
    icon: '🍛',
    eats: 'spoon',
    needs: ['sorrel', 'mushroom'],
    text: 'The sorrel melts into a sour little sauce.',
  },
  {
    name: 'Strawberries and honey',
    vessel: 'bowl',
    time: 15,
    icon: '🍨',
    needs: ['strawberry', 'strawberry', 'honey'],
    text: 'Tiny, warm from the sun, and gone in a moment.',
  },
  {
    name: 'Elderflower fritters',
    vessel: 'pan',
    time: 40,
    icon: '🥞',
    crisp: true,
    needs: ['elderflower', 'honey'],
    text: 'Whole plates of flowers in batter, crisp as lace.',
  },
  {
    name: 'Elderflower cordial',
    vessel: 'pot',
    time: 90,
    icon: '🧃',
    eats: 'sip',
    needs: ['elderflower', 'elderflower', 'honey', 'fruit'],
    text: 'Steeped a night, sweet and floral. Tastes of early summer.',
  },
  {
    name: 'Rosehip tea',
    vessel: 'pot',
    time: 60,
    icon: '🍵',
    eats: 'sip',
    needs: ['rosehip', 'rosehip'],
    warm: true,
    text: 'Steeped on the embers, tart and red. You hold the cup for the warmth.',
  },
  {
    name: 'Rosehip syrup',
    vessel: 'pot',
    time: 90,
    icon: '🫙',
    eats: 'sip',
    needs: ['rosehip', 'rosehip', 'honey'],
    warm: true,
    text: 'Simmered and strained through a cloth for the hairs. A spoonful keeps the winter off.',
  },
  {
    name: 'Watercress soup',
    vessel: 'pot',
    time: 70,
    icon: '🥣',
    needs: ['watercress', 'watercress', 'greens'],
    warm: true,
    text: 'Peppery and green, the colour of the stream it came out of.',
  },
  {
    name: 'Nettle soup',
    vessel: 'pot',
    time: 80,
    icon: '🍲',
    needs: ['nettle', 'nettle', 'greens', 'mushroom'],
    warm: true,
    from: 'hedgehog',
    text: "The hedgehog's own: \"Pick the tops, never the stalks.\"",
  },
  {
    name: 'Forest stew',
    vessel: 'pot',
    time: 100,
    level: 2,
    icon: '🍲',
    needs: ['cep', 'chanterelle', 'hazelnut', 'garlic'],
    warm: true,
    text: "Autumn after rain: a filling, warm main course built around the cook's favourite mushroom.",
  },
  // The fish (PLAN.md stage 10): caught with the rod, any of them where a dish says 'fish'.
  {
    name: 'Roast fish on a stick',
    vessel: 'stick',
    time: 35,
    icon: '🍢',
    needs: ['fish'],
    known: true,
    warm: true,
    text: 'Threaded through from the mouth and turned over the coals till the skin blisters and crackles.',
  },
  {
    name: 'Trout with wild garlic',
    vessel: 'pan',
    time: 40,
    icon: '🍳',
    needs: ['trout', 'garlic'],
    warm: true,
    text: 'The prize of the brook, fried whole with the leaves wilting round it.',
  },
  {
    name: 'Fish and sorrel on a hot stone',
    vessel: 'stone',
    time: 45,
    icon: '🐟',
    needs: ['fish', 'sorrel'],
    warm: true,
    text: 'Laid on the stone in a bed of sorrel, which melts into a sharp green sauce.',
  },
  {
    name: 'Fish soup',
    vessel: 'pot',
    time: 80,
    icon: '🥣',
    needs: ['fish', 'fish', 'nettle', 'greens'],
    warm: true,
    text: 'Two fish and a fistful of green, simmered till it all falls off the bone.',
  },
  {
    name: 'Eel and mushroom stew',
    vessel: 'pot',
    time: 100,
    icon: '🍲',
    needs: ['eel', 'mushroom', 'mushroom', 'greens'],
    warm: true,
    text: 'Dark, rich and slow: the best thing to come out of the pond on a summer night.',
  },
  {
    name: 'Dried fish and hazelnuts',
    vessel: 'bowl',
    time: 15,
    icon: '🥜',
    eats: 'hand',
    needs: ['driedfish', 'hazelnut'],
    text: 'Cold trail food: chewy, salty and sweet. A pocketful lasts a long walk.',
  },
  // Water food (PLAN.md stage 14): what comes up on the hook that isn't a fish.
  {
    name: 'Mussels with wild garlic',
    vessel: 'pan',
    time: 35,
    icon: '🦪',
    needs: ['mussel', 'mussel', 'garlic'],
    warm: true,
    text: 'Tipped onto the hot griddle till the shells spring open, the garlic wilting into their juice.',
  },
  {
    name: 'Crayfish boil',
    vessel: 'pot',
    time: 70,
    icon: '🦞',
    needs: ['crayfish', 'crayfish', 'watermint', 'greens'],
    warm: true,
    text: 'Into the rolling pot they go, and out they come bright red, with mint and greens to pick through.',
  },
  {
    name: 'Trout with water mint',
    vessel: 'stick',
    time: 40,
    icon: '🍢',
    needs: ['trout', 'watermint'],
    warm: true,
    text: 'A trout stuffed with mint from the same brook and turned over the coals.',
  },
  // From a bottle fished out of the water (TREASURES): found no other way, whatever goes in the pot (cook: bottle).
  {
    name: 'Honeyed eel',
    vessel: 'stick',
    time: 45,
    icon: '🍢',
    needs: ['eel', 'honey'],
    warm: true,
    bottle: 1,
    text: 'An old fisher\'s trick, written small on a scrap of birch bark: eel glazed with honey till it\'s sticky and black at the edges.',
  },
  {
    name: 'Fisher\'s mussel broth',
    vessel: 'pot',
    time: 80,
    icon: '🥣',
    needs: ['mussel', 'mussel', 'mushroom', 'nettle'],
    warm: true,
    bottle: 2,
    text: 'From a bottle\'s note: mussels, a mushroom and nettle tops, simmered into a broth that tastes of the river.',
  },
  {
    name: 'Mint tea with honey',
    vessel: 'pot',
    time: 30,
    icon: '🍵',
    eats: 'sip',
    needs: ['watermint', 'watermint', 'honey'],
    warm: true,
    bottle: 3,
    text: 'Water mint steeped till the pot smells of summer, sweetened with honey. The note said: for a cold evening by the water.',
  },
];

// What the forager builds, from the make button by the satchel (game.js renderBuild), and what each takes out of the
// satchel. In `needs`, each word is an ingredient or a tag (any ingredient that has it: 'tinder' takes dry grass or birch
// bark), with how many. To add a build, copy a block; the game only knows how to build the ones it paints and places (the
// campfire, the basket, the torch and the seat log, the drying rack, the lean-to and the cutting log or stone at camp), or the ones that make a thing for
// the satchel (`makes`).
//   name            what it's called
//   needs           what it takes, { word: how many }
//   where           where it may go: 'anywhere' (left out), or 'camp' (inside the camp's ring)
//   after           when it's on offer: left out at once, 'camp' once there's a camp, 'together' while friends are
//                   here, or a Cooking level (2)
//   makes           an ingredient's id: made at once into the satchel, nothing placed (the rope, the rod)
//   text            a line for when you look at it
const BUILDS = {
  campfire: {
    name: 'Campfire',
    needs: { pebble: 6, stick: 5, tinder: 2 },
    where: 'anywhere',
    text: 'A ring of stones, a little tepee of sticks, and tinder in the middle for the spark.',
  },
  basket: {
    name: 'Basket',
    needs: { stick: 8, drygrass: 4 },
    where: 'camp',
    after: 'camp',
    text: 'A big lidded basket of sticks woven through with grass, set down at camp, for what the satchel can\'t carry.',
  },
  torch: {
    name: 'Torch',
    needs: { stick: 1, birchbark: 1 },
    text: 'A stick wrapped with birch bark and set in the ground, a flame at its head to keep the dark off.',
  },
  seat: {
    name: 'Seat log',
    needs: { stick: 5 },
    text: 'A felled log rolled onto two sawn rounds, to sit on, wherever you like and as many as you like.',
  },
  rope: {
    name: 'Rope',
    needs: { drygrass: 5 },
    makes: 'rope',
    text: 'Dry grass twisted and plied into a rope, to tie to a friend and lead them about.',
  },
  rod: {
    name: 'Fishing rod',
    needs: { stick: 2, rope: 1 },
    makes: 'rod',
    text: 'Two sticks lashed end to end, a line of the rope\'s grass, and a bramble thorn for the hook.',
  },
  rack: {
    name: 'Drying rack',
    needs: { stick: 8, drygrass: 3, birchbark: 1 },
    after: 'camp',
    text: 'Four forked sticks and two crossbars, with a mat of dry grass lashed across them for things to dry on.',
  },
  lean: {
    name: 'Lean-to',
    needs: { stick: 10, drygrass: 5, birchbark: 2 },
    where: 'camp',
    after: 'camp',
    text: 'A sloping roof of poles, thatch and birch bark, with a bed of dry grass under it, out of the rain.',
  },
  // What things are cut on at the fire (game.js, the board at the fire): one of the two, at camp close by the fire. Until there
  // are logs and an axe, the log is split from sticks.
  cutlog: {
    name: 'Cutting log',
    needs: { stick: 6 },
    where: 'camp',
    after: 'camp',
    text: 'A log split down its length with the knife and a stick, laid flat face up on two stones by the fire, to cut things on.',
  },
  cutstone: {
    name: 'Cutting stone',
    needs: { slab: 1 },
    where: 'camp',
    after: 'camp',
    text: 'A flat slab carried up from the river and laid by the fire ring, to cut things on.',
  },
  block: {
    name: 'Chopping block',
    needs: { stick: 4, pebble: 1 },
    where: 'camp',
    after: 'camp',
    gone: true,                          // (no longer made: things are cut on the cutting log or stone at the fire now, game.js; one made is a log)
    text: 'A sawn round stood on end with a board on it and a flint knife, to get things ready for the pot.',
  },
};

// How a thing is got ready on the chopping block (game.js chopping, PLAN.md stage 12): by its own id first (garlic is
// crushed, nettles chopped, not torn like the other greens), else by the first of its tags that has a way here. The word
// for it done, and the taps it takes. A thing with no way (a fish, honey) goes in the pot whole.
const PREP = {
  garlic: { word: 'crushed', cuts: 2 },
  nettle: { word: 'chopped', cuts: 4 },
  greens: { word: 'torn', cuts: 3 },
  mushroom: { word: 'sliced', cuts: 4 },
  fruit: { word: 'halved', cuts: 2 },
  nut: { word: 'cracked', cuts: 3 },
  flower: { word: 'picked over', cuts: 2 },
};
const prepOf = id => PREP[id] || (INGREDIENTS[id] ? INGREDIENTS[id].tags.map(t => PREP[t]).find(Boolean) : null) || null;


// The fish that bite on the rod (game.js fishing). They aren't kinds in the sim: sim.js keeps one w.fish, how many are in
// each tile of water, and which bites is picked at the bite, by where the float lies and when (game.js fishKind). Each is
// an ingredient above, tagged 'fish'. To add one, copy a block.
//   water           where it bites: 'still' (no current), 'current' (where the water runs), or 'any'
//   deep            true: only over deep water
//   seasons         the seasons it bites in: 0 spring, 1 summer, 2 autumn, 3 winter
//   night           true: only at night; left out, by day and night
//   dawn            how much likelier it is at dawn and dusk (left out: 1, no likelier)
//   odds            how often it's the one, next to the others that could bite there (1 the usual)
//   prize           true: a good angler catches it more often (game.js PRIZE_FROM: the fishing level it starts at)
// and how it moves in the bar while it's brought in (the bar 1 tall, 0 at its foot):
//   dart            how far one dart takes it, at most
//   pull            how quickly it gets there (1 a slow drift, 4 a flash)
//   idle            seconds it rests between darts, [least, most]
//   low             the lowest it goes in the bar (above the zone lying at the foot: one left alone never catches it)
//   sink            how hard it pulls the zone down while it's on the line (bars a second²; 0 none): a long hold
//   wriggle         how often a sudden wriggle comes (a second; 0 none)
//   run             the odds (0 to 1) it makes one last hard run for it once it's nearly in (game.js REEL_RUN_AT; 0 never)
// A fresh fish fights harder than a tired one (game.js REEL_FRESH, REEL_TIRED), and a big one harder than a small one:
//   grams           how big it comes, [least, most] (most are small: a big one is rare, and the book keeps your biggest)
const FISH = {
  roach: { water: 'any', seasons: [0, 1, 2, 3], odds: 3, prize: false, dart: 0.3, pull: 1.3, idle: [1.2, 2.6], low: 0.4, sink: 0, wriggle: 0, run: 0, grams: [40, 320] },
  perch: { water: 'still', deep: true, seasons: [0, 1, 2], odds: 2, prize: true, dart: 0.45, pull: 2.8, idle: [0.35, 0.9], low: 0.35, sink: 0, wriggle: 0, run: 0.5, grams: [90, 950] },
  trout: { water: 'current', seasons: [0, 1], dawn: 2.5, odds: 3, prize: true, dart: 0.85, pull: 3.8, idle: [0.6, 1.5], low: 0.35, sink: 0, wriggle: 0, run: 1, grams: [180, 2200] },
  eel:   { water: 'still', deep: true, seasons: [1], night: true, odds: 6, prize: false, dart: 0.25, pull: 1.5, idle: [0.5, 1.1], low: 0.45, sink: 1.35, wriggle: 0.5, run: 0.6, grams: [250, 2600] },
};
const FISH_KEYS = ['water', 'deep', 'seasons', 'night', 'dawn', 'odds', 'prize', 'dart', 'pull', 'idle', 'low', 'sink', 'wriggle', 'run', 'grams'];

// What comes up on the hook that isn't a fish (PLAN.md stage 14, the haul). At each bite these are rolled first, each by its
// own chance (game.js fishKind), and only if none comes up is it a fish. It takes nothing from the sim's fish. Each is an
// ingredient above. To add one, copy a block.
//   from            the fishing level it first comes up at (sim.js SKILLS fishing)
//   odds            its chance at a bite (0 to 1) where it can come up
//   water           'still', 'current' or 'any', as FISH
//   current         how many times likelier where the water runs (things wash down; left out: 1)
//   trees           and with a tree standing near the float (bark and twigs fall in; left out: 1)
//   deep            true: only over deep water
//   dark            how many times likelier at dusk and at night (left out: 1)
//   seasons         as FISH
//   n               how many come up at once, [least, most]
//   drag            how it fights in the bar (game.js HAUL_FIGHT): 'dead', a dead weight that sinks slowly and evenly;
//                   'scrabble', small quick wriggles and no runs
//   prize           true: a good angler gets it more often, as FISH's prize (game.js PRIZE_MORE)
const HAUL = {
  stick:     { from: 0, odds: 0.015, water: 'any', current: 1.6, trees: 1.5, seasons: [0, 1, 2, 3], n: [1, 2], drag: 'dead' },
  drygrass:  { from: 0, odds: 0.012, water: 'any', current: 1.3, seasons: [0, 1, 2, 3], n: [1, 3], drag: 'dead' },
  clay:      { from: 0, odds: 0.01, water: 'still', seasons: [0, 1, 2, 3], n: [1, 2], drag: 'dead' },
  pebble:    { from: 0, odds: 0.012, water: 'any', current: 1.6, seasons: [0, 1, 2, 3], n: [1, 3], drag: 'dead' },
  birchbark: { from: 0, odds: 0.008, water: 'any', current: 1.3, trees: 3, seasons: [0, 1, 2, 3], n: [1, 2], drag: 'dead' },
  // Water food, from level 3 (about 8% of bites where each can come up).
  mussel:    { from: 3, odds: 0.035, water: 'still', deep: true, seasons: [0, 1, 2], n: [2, 4], drag: 'dead', prize: true },
  crayfish:  { from: 3, odds: 0.02, water: 'current', dark: 4, seasons: [1], n: [1, 2], drag: 'scrabble', prize: true },
  watermint: { from: 3, odds: 0.035, water: 'any', seasons: [0, 1], n: [1, 3], drag: 'dead', prize: true },
};
const HAUL_KEYS = ['from', 'odds', 'water', 'deep', 'dark', 'current', 'trees', 'seasons', 'n', 'drag', 'prize'], HAUL_DRAGS = ['dead', 'scrabble'];

// The treasures (PLAN.md stage 14): from fishing level 5 now and then (game.js TREASURE_*), each once a meadow (sim.js
// w.hauled), none twice. They come up heavy (game.js HAUL_FIGHT heavy), and one lost in the bar can bite again. The book's
// Finds has a page for each ("From the water"), the ones not found a faint outline and no name. To add one, copy a block.
//   name            what it's called
//   kind            what it does landed (game.js landTreasure): 'bottle' teaches its dish (a RECIPES block with bottle:
//                   its number), 'pot' leaves a copper pot on the bank, 'hat' and 'cloak' are for the wardrobe (fur.js
//                   FORAGER_HATS, FORAGER_CLOAKS find: this id), 'pearl' goes in the satchel as the ingredient
//   dish            a bottle's: the dish's name
//   rolled          false: never rolled on its own (the pearl comes in a mussel haul)
//   text            a line said as it lands, and on its page
const TREASURES = {
  bottle1:   { name: 'A bottle with a note', kind: 'bottle', dish: 'Honeyed eel', text: 'Corked tight, a curl of birch bark inside, written small.' },
  bottle2:   { name: 'A green bottle', kind: 'bottle', dish: 'Fisher\'s mussel broth', text: 'Thick old glass gone cloudy, a note rolled up inside.' },
  bottle3:   { name: 'A little blue bottle', kind: 'bottle', dish: 'Mint tea with honey', text: 'No bigger than a thumb, and a recipe folded in it.' },
  copperpot: { name: 'Sunken copper pot', kind: 'pot', text: 'Green with age and dented, but sound. Copper heats quick.' },
  cap:       { name: 'Old fisher\'s cap', kind: 'hat', text: 'A felt cap gone soft with years of river weather. It fits.' },
  oilskin:   { name: 'Oilskin cloak', kind: 'cloak', text: 'Waxed yellow and stiff with the cold, a fisher\'s cloak.' },
  pearl:     { name: 'Pearl', kind: 'pearl', rolled: false, text: 'A little moon from inside a mussel.' },
};
const TREASURE_KEYS = ['name', 'kind', 'dish', 'rolled', 'text'], TREASURE_KINDS = ['bottle', 'pot', 'hat', 'cloak', 'pearl'];

// The camp's cosy (PLAN.md stage 8): every point is a deed, earned once and never lost. `w.camp.deeds` keeps their ids in the
// order they were earned and `w.camp.cosy` is their points summed (sim.js countCosy). `from` is the camp level at which a deed
// first becomes possible. One for a build names it in `build` (only the ones listed below are written yet); the friend deeds
// are never needed to raise the camp.
//   name            what the deed is called on the camp's card
//   points          what it's worth (whole, 1 or more)
//   from            the camp's level when it first becomes possible (1 to 5)
//   build           the BUILDS id it's for, if it's for a build
//   friend          a deed of playing together (left out of every gate's slack)
const DEEDS = {
  camp: { name: 'Made camp', points: 2, from: 1 },
  basket: { name: 'Wove the basket', points: 3, from: 1, build: 'basket' },
  seat: { name: 'Set the seat log', points: 2, from: 1, build: 'seat' },
  torch: { name: 'Set a torch in the ground', points: 1, from: 1, build: 'torch' },
  hearth: { name: 'Laid the hearthstones', points: 2, from: 2, build: 'hearth' },
  rack: { name: 'Built the drying rack', points: 2, from: 2, build: 'rack' },
  lean: { name: 'Raised the lean-to', points: 2, from: 2, build: 'lean' },
  oven: { name: 'Built the clay oven', points: 2, from: 3, build: 'oven' },
  spit: { name: 'Built the spit', points: 2, from: 3, build: 'spit' },
  herbs: { name: 'Planted the herb pots', points: 1, from: 3, build: 'herbs' },
  arch: { name: 'Raised the lantern arch', points: 2, from: 4, build: 'arch' },
  feeder: { name: 'Hung the bird feeder', points: 1, from: 4, build: 'feeder' },
  board: { name: 'Put up the notice board', points: 1, from: 4, build: 'board' },
  cabin: { name: 'Built the cabin', points: 3, from: 5, build: 'cabin' },
  hammock: { name: 'Hung the hammock', points: 1, from: 5, build: 'hammock' },

  'dish-1': { name: 'Cooked the first dish at camp', points: 2, from: 1 },
  'dish-5': { name: 'Five different dishes at camp', points: 3, from: 1 },
  'dish-12': { name: 'Twelve different dishes at camp', points: 4, from: 1 },
  'seat-meal': { name: 'Ate a meal sitting on the seat log', points: 1, from: 1 },
  dried: { name: 'Dried something on the rack', points: 1, from: 2 },
  'lean-rest': { name: 'Curled up under the lean-to for the night', points: 1, from: 2 },

  'night-fire': { name: 'Kept the fire lit from dusk to dawn', points: 2, from: 1 },
  'storm-fire': { name: 'Kept the fire lit through a storm', points: 3, from: 1 },
  'fire-spring': { name: 'The first fire of spring', points: 2, from: 1 },
  'fire-summer': { name: 'The first fire of summer', points: 2, from: 1 },
  'fire-autumn': { name: 'The first fire of autumn', points: 2, from: 1 },
  'fire-winter': { name: 'The first fire of winter', points: 2, from: 1 },

  'basket-half': { name: 'Filled half the basket', points: 2, from: 1 },
  'basket-all': { name: 'One of every kind of food in it', points: 4, from: 1 },
  pearl: { name: 'Found a pearl', points: 2, from: 1 },

  'friend-fire': { name: 'A friend sat by your fire', points: 2, from: 1, friend: true },
  'friend-dish': { name: 'A friend ate your dish', points: 2, from: 1, friend: true },
};

// The camp's five levels: the name the card shows, the cosy it takes to raise it, and the build that is its keystone (left
// out for the first fire). Raising the camp widens its ring (sim.js campR): CAMP_R + 0.5 a level.
const CAMP_LEVELS = [
  { name: 'Campfire', at: 0, keystone: null },
  { name: 'Hearth', at: 8, keystone: 'hearth' },
  { name: 'Homestead', at: 18, keystone: 'oven' },
  { name: 'Hollow', at: 28, keystone: 'arch' },
  { name: 'Meadow Home', at: 40, keystone: 'cabin' },
];

// What the forager makes by hand, at a lit fire: each vessel (VESSELS), made by dragging what it takes out of the satchel
// onto the fire in the cooking window, a piece at a time. One with a `fire` time is clay: shaped, it then hardens in that
// fire for `fire` seconds (at 1x) while it stays lit. Made, it's yours for good, kept at camp (never in the satchel) and
// used at any fire. To add one, copy a block; its id is a vessel's (VESSELS).
//   name            what it's called
//   needs           what it takes, { word: how many } (as BUILDS)
//   fire            seconds at 1x it hardens in a lit fire (0: ready at once)
//   level: 0        the cooking level it needs before it can be made (sim.js SKILLS: level n takes 3·n(n+1)/2 practice, a
//                   dish 1, a fire laid or a vessel made 1, a mess a quarter: level 1 is the first dish or so, 2 about six,
//                   3 a dozen or more, about the first spring; the pot is last, as it makes every warm dish for winter).
//                   One already made, at any fire, can be made again at any level.
//   text            a line for when you look at it
const CRAFTS = {
  stick: {
    name: 'Roasting stick',
    needs: { stick: 1 },
    fire: 0,
    text: 'A green stick across the flames on two forked ones. Things roasted on it.',
  },
  stone: {
    name: 'Hearth stone',
    needs: { pebble: 1 },
    fire: 0,
    level: 1,
    text: 'A flat stone set in the coals till it\'s hot right through. Things baked on it.',
  },
  bowl: {
    name: 'Bark bowl',
    needs: { birchbark: 2 },
    fire: 0,
    level: 1,
    text: 'Birch bark folded at the corners and laced up, off the heat. Things mixed in it.',
  },
  pan: {
    name: 'Clay griddle',
    needs: { clay: 2 },
    fire: 60,
    level: 2,
    text: 'A flat clay griddle that sits on the stones. Things fried and toasted.',
  },
  pot: {
    name: 'Clay pot',
    needs: { clay: 3 },
    fire: 90,
    level: 3,
    text: 'A round-bellied pot, pinched up out of bank clay and hardened in the fire. Soups and stews.',
  },
};

// The rest is the machinery: you shouldn't need to touch it to add a dish.

const TEACHERS = ['hedgehog', 'heron', 'kingfisher', 'skylark', 'dragonfly'];
const MESS = { name: "A forager's mess", fill: 1, time: 15, icon: '🫠', text: "It's... food. Mostly." };
const COOK_TIME = 30;                   // seconds a dish takes if it doesn't say
const DISH_ICON = '🥣';
const RECIPE_KEYS = ['name', 'needs', 'at', 'vessel', 'fill', 'level', 'from', 'warm', 'known', 'time', 'icon', 'text', 'eats', 'crisp', 'bottle'];
const BUILD_KEYS = ['name', 'needs', 'where', 'after', 'makes', 'gone', 'text'];

const recipeOf = name => RECIPES.find(r => r.name.toLowerCase() === String(name).toLowerCase());
const isTag = word => Object.values(INGREDIENTS).some(g => g.tags.includes(word));

// Does one thing in the pot (an ingredient id, or a dish's name) answer a word in a recipe's needs?
function answers(thing, word) {
  if (thing === word) return true;
  const g = INGREDIENTS[thing];
  if (g) return g.tags.includes(word);
  return String(thing).toLowerCase() === String(word).toLowerCase();
}

// Each thing in the pot answers one word of the needs and every word is answered (tried every way: a pot holds four
// at most, so it's quick).
function fits(things, needs) {
  if (things.length !== needs.length) return false;
  const used = new Array(needs.length).fill(false);
  const place = i => {
    if (i === things.length) return true;
    for (let j = 0; j < needs.length; j++) {
      if (used[j] || !answers(things[i], needs[j])) continue;
      used[j] = true;
      if (place(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return place(0);
}

// The cooking level it takes to make vessel id (CRAFTS: 0 for one that needs none, or isn't made).
const craftLevel = id => (CRAFTS[id] && CRAFTS[id].level) || 0;
// Where a build may go (BUILDS: 'anywhere' when it doesn't say).
const whereOf = b => b.where || 'anywhere';
// The vessel a dish is cooked in (left out: the pot).
const vesselOf = r => r.vessel || 'pot';

// What comes out of a station with these things in it, cooked in a vessel: a recipe, or the mess. With no vessel (null) any
// vessel does (game.js potWord asks it whether the things make a dish in another vessel). A bottle's dish only once its
// bottle has taught it (knowSecrets: the game says which it knows; recipes.html knows them all).
let secretKnown = () => true;
const knowSecrets = fn => { secretKnown = fn; };
function cook(things, at = 'fire', vessel = null) {
  return RECIPES.find(r => (r.at || 'fire') === at && (!vessel || vesselOf(r) === vessel) && (!r.bottle || secretKnown(r)) && fits(things, r.needs)) || MESS;
}

// How long a dish cooks, in seconds at 1x.
const timeOf = r => (r && r.time > 0 ? r.time : COOK_TIME);

// How much a dish fills the tummy, if it doesn't say: a bit more than its ingredients raw.
function fillOf(r) {
  if (r.fill != null) return r.fill;
  let sum = 0;
  for (const word of r.needs) {
    const g = INGREDIENTS[word], d = recipeOf(word);
    if (g) sum += g.fill;
    else if (d) sum += fillOf(d);
    else {   // a tag: the least filling thing that has it
      const fills = Object.values(INGREDIENTS).filter(x => x.tags.includes(word)).map(x => x.fill);
      sum += fills.length ? Math.min(...fills) : 1;
    }
  }
  return Math.round(sum * 1.5 + 1);
}

// Everything that's wrong with the data, as plain sentences.
function checkRecipes() {
  const problems = [], names = new Set();
  for (const [id, g] of Object.entries(INGREDIENTS)) {
    if (!g.name) problems.push(`Ingredient '${id}' has no name.`);
    if (!Array.isArray(g.tags)) problems.push(`Ingredient '${id}' needs tags: [...] (it can be empty).`);
    if (typeof g.fill !== 'number') problems.push(`Ingredient '${id}' needs a fill (a number).`);
    if (g.tags && g.tags.includes(id)) problems.push(`Ingredient '${id}' has itself as a tag.`);
    if (g.dries != null && !(INGREDIENTS[g.dries] && INGREDIENTS[g.dries].dried)) problems.push(`Ingredient '${id}' dries into '${g.dries}', which is no ingredient with dried: true.`);
    const tool = !!g.tags && g.tags.includes('tool');
    if (tool && !(g.uses >= 1 && g.uses === Math.floor(g.uses))) problems.push(`The tool '${id}' wants uses: how many it has new, a whole number (uses: 60).`);
    if (tool && (!g.mend || typeof g.mend !== 'object' || Array.isArray(g.mend) || !Object.keys(g.mend).length)) problems.push(`The tool '${id}' wants mend: what puts it back to new, as a build's needs (mend: { rope: 1 }).`);
    if (!tool && (g.uses != null || g.mend != null)) problems.push(`Ingredient '${id}' has uses or mend, but only a tool (tagged 'tool') wears.`);
    if (tool && g.mend && typeof g.mend === 'object') for (const [word, n] of Object.entries(g.mend)) {
      if (!INGREDIENTS[word] && !isTag(word)) problems.push(`The tool '${id}' is mended with '${word}', which is no ingredient or tag.`);
      if (!(n >= 1) || n !== Math.floor(n)) problems.push(`The tool '${id}' is mended with ${n} of '${word}': it wants a whole number, 1 or more.`);
    }
  }
  RECIPES.forEach((r, i) => {
    const who = r.name ? `'${r.name}'` : `Recipe number ${i + 1}`;
    if (!r.name) problems.push(`${who} has no name.`);
    else if (names.has(r.name.toLowerCase())) problems.push(`Two dishes are called ${who}.`);
    else names.add(r.name.toLowerCase());
    for (const k of Object.keys(r)) if (!RECIPE_KEYS.includes(k)) problems.push(`${who} has '${k}', which nothing reads (a typo?).`);
    if (!Array.isArray(r.needs) || !r.needs.length) { problems.push(`${who} needs a list of what goes in: needs: ['apple', 'honey'].`); return; }
    for (const word of r.needs) {
      if (INGREDIENTS[word] || isTag(word)) continue;
      const d = recipeOf(word);
      if (!d) problems.push(`${who} needs '${word}', which is no ingredient, tag or dish.`);
      else if (d === r) problems.push(`${who} needs itself.`);
    }
    const vs = vesselOf(r);
    if (r.eats != null && !EAT_WAYS.includes(r.eats)) problems.push(`${who} is eaten '${r.eats}', which is no way of eating (${EAT_WAYS.join(', ')}).`);
    if (!VESSELS[vs]) problems.push(`${who} is cooked in '${vs}', which is no vessel (${Object.keys(VESSELS).join(', ')}).`);
    else if (r.needs.length > VESSELS[vs].slots) problems.push(`${who} needs ${r.needs.length} things, but the ${VESSELS[vs].name.toLowerCase()} holds ${VESSELS[vs].slots}.`);
    for (let j = 0; j < i; j++) {
      const o = RECIPES[j];
      if (o.name && (o.at || 'fire') === (r.at || 'fire') && vesselOf(o) === vs && Array.isArray(o.needs) && fits(r.needs, o.needs)) problems.push(`${who} and '${o.name}' are made of the same things in the same ${vs}.`);
    }
    const at = r.at || 'fire', st = STATIONS[at];
    if (!st) problems.push(`${who} is cooked at '${at}', which is no station (${Object.keys(STATIONS).join(', ')}).`);
    else if (r.needs.length > st.slots) problems.push(`${who} needs ${r.needs.length} things, but the ${st.name.toLowerCase()} holds ${st.slots}.`);
    if (r.from && !TEACHERS.includes(r.from)) problems.push(`${who} is taught by '${r.from}', who isn't a visitor (${TEACHERS.join(', ')}).`);
    if (r.fill != null && typeof r.fill !== 'number') problems.push(`${who} has a fill that isn't a number.`);
    if (r.level != null && typeof r.level !== 'number') problems.push(`${who} has a level that isn't a number.`);
    if (r.known != null && typeof r.known !== 'boolean') problems.push(`${who} has known: ${JSON.stringify(r.known)}, but it wants true or false.`);
    if (r.known && r.from) problems.push(`${who} is known from the start, so the ${r.from} has nothing to teach: leave one of them out.`);
    if (r.bottle != null && !Object.values(TREASURES).some(t => t.kind === 'bottle' && t.dish === r.name)) problems.push(`${who} has bottle: ${r.bottle}, but no bottle in TREASURES teaches it.`);
    if (r.bottle && (r.known || r.from)) problems.push(`${who} comes in a bottle, so it isn't known from the start or taught by a visitor.`);
  });
  for (const [id, b] of Object.entries(BUILDS)) {
    const who = `The build '${id}'`;
    if (!b.name) problems.push(`${who} has no name.`);
    for (const k of Object.keys(b)) if (!BUILD_KEYS.includes(k)) problems.push(`${who} has '${k}', which nothing reads (a typo?).`);
    if (b.where != null && b.where !== 'camp' && b.where !== 'anywhere') problems.push(`${who} has where: '${b.where}', but it's 'camp' or 'anywhere'.`);
    if (b.after != null && b.after !== 'camp' && b.after !== 'together' && !(typeof b.after === 'number' && b.after >= 0 && b.after === Math.floor(b.after))) problems.push(`${who} has after: ${JSON.stringify(b.after)}, but it's 'camp', 'together' or a Cooking level (2).`);
    if (b.makes != null && !INGREDIENTS[b.makes]) problems.push(`${who} makes '${b.makes}', which is no ingredient.`);
    if (!b.needs || typeof b.needs !== 'object' || Array.isArray(b.needs)) { problems.push(`${who} needs what it takes: needs: { pebble: 6, stick: 5 }.`); continue; }
    for (const [word, n] of Object.entries(b.needs)) {
      if (!INGREDIENTS[word] && !isTag(word)) problems.push(`${who} needs '${word}', which is no ingredient or tag.`);
      if (!(n >= 1) || n !== Math.floor(n)) problems.push(`${who} needs ${n} of '${word}': it wants a whole number, 1 or more.`);
    }
  }
  for (const [id, k] of Object.entries(FISH)) {
    const who = `The fish '${id}'`;
    if (!INGREDIENTS[id] || !INGREDIENTS[id].tags.includes('fish')) problems.push(`${who} is no ingredient tagged 'fish'.`);
    for (const key of Object.keys(k)) if (!FISH_KEYS.includes(key)) problems.push(`${who} has '${key}', which nothing reads (a typo?).`);
    if (!['still', 'current', 'any'].includes(k.water)) problems.push(`${who} has water: '${k.water}', but it's 'still', 'current' or 'any'.`);
    if (!Array.isArray(k.seasons) || !k.seasons.length || k.seasons.some(n => ![0, 1, 2, 3].includes(n))) problems.push(`${who} wants seasons: a list of 0 to 3.`);
    if (!Array.isArray(k.idle) || k.idle.length !== 2 || !(k.idle[0] <= k.idle[1])) problems.push(`${who} wants idle: [least, most] seconds.`);
    for (const key of ['odds', 'dart', 'pull']) if (!(k[key] > 0)) problems.push(`${who} wants ${key}: a number over 0.`);
    if (!(k.low >= 0 && k.low < 0.9)) problems.push(`${who} wants low: the lowest it goes in the bar, 0 to 0.9.`);
    if (!(k.sink >= 0)) problems.push(`${who} wants sink: 0 or more.`);
    if (!(k.run >= 0 && k.run <= 1)) problems.push(`${who} wants run: the odds of a last run, 0 to 1.`);
    if (!Array.isArray(k.grams) || k.grams.length !== 2 || !(k.grams[0] > 0 && k.grams[0] < k.grams[1])) problems.push(`${who} wants grams: [least, most], the least over 0.`);
  }
  for (const [id, k] of Object.entries(HAUL)) {
    const who = `The haul '${id}'`;
    if (!INGREDIENTS[id]) problems.push(`${who} is no ingredient.`);
    if (FISH[id]) problems.push(`${who} is a fish too: it goes in one table.`);
    for (const key of Object.keys(k)) if (!HAUL_KEYS.includes(key)) problems.push(`${who} has '${key}', which nothing reads (a typo?).`);
    if (!(k.from >= 0) || k.from !== Math.floor(k.from)) problems.push(`${who} wants from: a fishing level, 0 or more.`);
    if (!(k.odds > 0 && k.odds < 0.2)) problems.push(`${who} wants odds: its chance at a bite, over 0 and well under 1 (0.01).`);
    if (!['still', 'current', 'any'].includes(k.water)) problems.push(`${who} has water: '${k.water}', but it's 'still', 'current' or 'any'.`);
    for (const key of ['current', 'trees', 'dark']) if (k[key] != null && !(k[key] > 0)) problems.push(`${who} wants ${key}: a number over 0, or left out.`);
    if (!Array.isArray(k.seasons) || !k.seasons.length || k.seasons.some(n => ![0, 1, 2, 3].includes(n))) problems.push(`${who} wants seasons: a list of 0 to 3.`);
    if (!Array.isArray(k.n) || k.n.length !== 2 || !(k.n[0] >= 1 && k.n[0] <= k.n[1]) || k.n.some(n => n !== Math.floor(n))) problems.push(`${who} wants n: [least, most], whole, 1 or more.`);
    if (!HAUL_DRAGS.includes(k.drag)) problems.push(`${who} has drag: '${k.drag}', but it's ${HAUL_DRAGS.map(d => `'${d}'`).join(' or ')}.`);
  }
  for (const [id, g] of Object.entries(INGREDIENTS)) if (g.tags.includes('fish') && !g.dried && !FISH[id]) problems.push(`The fish '${id}' has no block in FISH, so nothing bites as one.`);
  for (const [id, t] of Object.entries(TREASURES)) {
    const who = `The treasure '${id}'`;
    if (!t.name) problems.push(`${who} has no name.`);
    for (const key of Object.keys(t)) if (!TREASURE_KEYS.includes(key)) problems.push(`${who} has '${key}', which nothing reads (a typo?).`);
    if (!TREASURE_KINDS.includes(t.kind)) problems.push(`${who} has kind: '${t.kind}', but it's ${TREASURE_KINDS.map(d => `'${d}'`).join(', ')}.`);
    if (t.kind === 'bottle' && !(recipeOf(t.dish) && recipeOf(t.dish).bottle)) problems.push(`${who} teaches '${t.dish}', which is no dish with bottle: set.`);
    if (t.kind === 'pearl' && !INGREDIENTS[id]) problems.push(`${who} goes in the satchel, so it wants an ingredient '${id}'.`);
    if (HAUL[id] || FISH[id]) problems.push(`${who} is in HAUL or FISH too: it goes in one table.`);
  }
  for (const [id, c] of Object.entries(CRAFTS)) {
    const who = `The craft '${id}'`;
    if (!VESSELS[id]) problems.push(`${who} isn't a vessel (${Object.keys(VESSELS).join(', ')}).`);
    if (!c.name) problems.push(`${who} has no name.`);
    if (!(c.fire >= 0)) problems.push(`${who} wants a firing time in seconds: fire: 60 (or 0, ready at once).`);
    if (c.level != null && !(c.level >= 0 && c.level === Math.floor(c.level))) problems.push(`${who} has a level that isn't a whole number, 0 or more: level: 2.`);
    if (!c.needs || typeof c.needs !== 'object' || Array.isArray(c.needs)) { problems.push(`${who} needs what it takes: needs: { clay: 3 }.`); continue; }
    for (const [word, n] of Object.entries(c.needs)) {
      if (!INGREDIENTS[word] && !isTag(word)) problems.push(`${who} needs '${word}', which is no ingredient or tag.`);
      if (!(n >= 1) || n !== Math.floor(n)) problems.push(`${who} needs ${n} of '${word}': it wants a whole number, 1 or more.`);
    }
  }
  // Two dishes in one vessel at one station that the same things could make: the first in the list would always win.
  for (let i = 0; i < RECIPES.length; i++) for (let j = i + 1; j < RECIPES.length; j++) {
    const a = RECIPES[i], b = RECIPES[j];
    if (!a.needs || !b.needs || (a.at || 'fire') !== (b.at || 'fire') || vesselOf(a) !== vesselOf(b) || a.needs.length !== b.needs.length) continue;
    const plain = a.needs.map(w => INGREDIENTS[w] ? w : Object.keys(INGREDIENTS).find(id => answers(id, w)) || w);
    if (fits(plain, b.needs)) problems.push(`'${a.name}' and '${b.name}' can be made from the same things; the first one listed always wins.`);
  }
  return problems;
}

// The builds the deeds speak of, whether written yet or not (the later levels' keystones and their own opens).
const DEED_BUILDS = ['basket', 'seat', 'torch', 'hearth', 'rack', 'lean', 'oven', 'spit', 'herbs', 'arch', 'feeder', 'board', 'cabin', 'hammock'];

// Everything that's wrong with the deed table, as plain sentences: the names, the points, when each first becomes possible,
// and that every gate (II, III, IV) has at least 8 points of slack from the deeds open below it whose build is written or
// absent. V waits for its builds (the cabin and the hammock), so it isn't gated yet.
function checkDeeds() {
  const problems = [];
  for (const [id, d] of Object.entries(DEEDS)) {
    const who = `The deed '${id}'`;
    if (!d.name) problems.push(`${who} has no name.`);
    if (!(d.points > 0) || d.points !== Math.floor(d.points)) problems.push(`${who} has ${d.points} points: it wants a whole number, 1 or more.`);
    if (!(d.from >= 1 && d.from <= 5 && d.from === Math.floor(d.from))) problems.push(`${who} has from: ${JSON.stringify(d.from)}, but a deed first comes at a camp level, 1 to 5.`);
    if (d.build != null && !BUILDS[d.build] && !DEED_BUILDS.includes(d.build)) problems.push(`${who} is for '${d.build}', which is no build (${DEED_BUILDS.join(', ')}).`);
  }
  for (let lv = 2; lv <= 4; lv++) {                    // (the gates: Hearth, Homestead, Hollow)
    const level = CAMP_LEVELS[lv - 1];
    let slack = 0;
    for (const d of Object.values(DEEDS)) if (!d.friend && d.from < lv && (!d.build || BUILDS[d.build])) slack += d.points;
    if (slack < level.at + 8) problems.push(`The ${level.name} gate has only ${slack} cosy of deeds open below it: it wants ${level.at + 8} (its ${level.at}, and 8 spare).`);
  }
  return problems;
}

// What a thing in the satchel (an ingredient's id, or a dish's name) is as food: { name, fill, warm, raw, icon, dish }, raw
// false for what can't be eaten as it is; null for what isn't known.
function foodOf(id) {
  const g = INGREDIENTS[id];
  if (g) return { name: g.name, fill: g.fill, warm: false, raw: g.raw !== false && g.fill > 0, icon: g.icon, dish: false };
  const r = id === MESS.name ? MESS : recipeOf(id);
  if (!r) return null;
  return { name: r.name, fill: r === MESS ? MESS.fill : fillOf(r), warm: !!r.warm, raw: true, icon: r.icon || DISH_ICON, dish: true };
}

// How a thing in the satchel is eaten (game.js EAT_WAYS): { eats, crisp, liked }. A dish by its own eats or its vessel,
// crisp 0.6 if it says so; what's picked: fruit, berries and nuts in small bites ('fruit'), the rest bitten ('hand'), an
// apple or a nut crunching. Liked: every dish but the mess, and what's sweet (fruit, berries, nuts, honey); greens and
// mushrooms raw, only so-so.
const EATS_BY_VESSEL = { pot: 'spoon', pan: 'hand', stick: 'skewer', stone: 'hand', bowl: 'spoon' };
const EAT_WAYS = ['spoon', 'hand', 'skewer', 'sip', 'fruit'];
function eatsOf(id) {
  const g = INGREDIENTS[id];
  if (g) {
    const sweet = g.tags.some(t => t === 'fruit' || t === 'berry' || t === 'nut' || t === 'sweet');
    return { eats: g.tags.some(t => t === 'fruit' || t === 'berry' || t === 'nut') ? 'fruit' : 'hand', crisp: id === 'apple' || g.tags.includes('nut') ? 0.8 : 0, liked: sweet };
  }
  if (id === MESS.name) return { eats: 'spoon', crisp: 0, liked: false };
  const r = recipeOf(id);
  return { eats: (r && r.eats) || EATS_BY_VESSEL[r ? vesselOf(r) : 'pot'], crisp: r && r.crisp ? 0.6 : 0, liked: true };
}

// Things out of `have` ({ id: how many }) that make a dish with these needs, each word answered by one: a list of ids, or
// null if they don't (tried every way, as fits does).
function thingsFor(needs, have) {
  const left = { ...have }, got = [];
  const place = i => {
    if (i === needs.length) return true;
    for (const id in left) {
      if (!(left[id] > 0) || !answers(id, needs[i])) continue;
      left[id]--; got.push(id);
      if (place(i + 1)) return true;
      left[id]++; got.pop();
    }
    return false;
  };
  return place(0) ? got : null;
}

// The ingredients a word in a build's needs takes: itself, or every ingredient with that tag.
const takes = word => (INGREDIENTS[word] ? [word] : Object.keys(INGREDIENTS).filter(id => INGREDIENTS[id].tags.includes(word)));

function stackOf(id) { const i = INGREDIENTS[id]; return (i && i.stack) || 0; }
function keepOf(id) { const i = INGREDIENTS[id]; return (i && i.keep) || 0; }
function usesOf(id) { const i = INGREDIENTS[id]; return (i && i.uses) || 0; }
const Recipes = { stackOf, keepOf, usesOf, PREP, prepOf, STATIONS, VESSELS, vesselOf, craftLevel, whereOf, INGREDIENTS, RECIPES, BUILDS, FISH, HAUL, TREASURES, knowSecrets, CRAFTS, DEEDS, CAMP_LEVELS, MESS, cook, fits, fillOf, timeOf, recipeOf, takes, foodOf, eatsOf, EAT_WAYS, thingsFor, answers, checkRecipes, checkDeeds };
if (typeof module !== 'undefined') module.exports = Recipes;
else {
  window.Recipes = Recipes;
  for (const p of checkRecipes()) console.warn('recipes.js: ' + p);
  for (const p of checkDeeds()) console.warn('recipes.js: ' + p);
}
}
