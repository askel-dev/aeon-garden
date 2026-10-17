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
  stick: { name: 'Stick',  slots: 2, icon: '🍢', word: 'roasted on a stick' },
  stone: { name: 'Stone',  slots: 2, icon: '🪨', word: 'baked on a hot stone' },
  bowl:  { name: 'Bowl',   slots: 3, icon: '🥗', word: 'mixed in a bowl, no heat' },
};

// What the meadow gives. The ids of the ones the sim grows are the sim's own (SHROOMS, the greens, a tree's fruit or
// mast). fill: how much it fills the tummy eaten raw. raw: false if it can't be eaten as it is. icon: an emoji to stand
// in until it has a painted one. text: a line said under its name the first time it goes in the satchel.
// where: when and where to look for it, for its page in the book (shown before it's found, as the hint).
const INGREDIENTS = {
  apple:       { name: 'Apple',               tags: ['fruit'],          fill: 1,   icon: '🍎', text: 'Windfalls in the grass under the tree, sweet with a bruise.', where: 'Autumn: windfalls in the grass under the apple trees.' },
  cherry:      { name: 'Cherries',            tags: ['fruit', 'berry'], fill: 1,   icon: '🍒', text: 'Dark and warm from the sun, picked in pairs by the stalk.', where: 'Early summer, on the cherry trees out in the open.' },
  blackberry:  { name: 'Blackberries',        tags: ['fruit', 'berry'], fill: 1,   icon: '🫐', text: 'Off the brambles, mind the thorns. One for the satchel, one for you.', where: 'Late summer into autumn, on the brambles at the edges of the woods.' },
  honey:       { name: 'Honey',               tags: ['sweet'],          fill: 2,   icon: '🍯', text: 'Taken gently, leaving the bees what they need.', where: 'From the bees in the hollow old oaks, when they have some to spare.' },
  cep:         { name: 'Cep',                 tags: ['mushroom'],       fill: 1.5, icon: '🍄', text: 'A fat brown cap on a white stem: the cook\'s favourite.', where: 'Under oaks and pines a day or two after rain, mostly in autumn.' },
  chanterelle: { name: 'Chanterelles',        tags: ['mushroom'],       fill: 1,   icon: '🍄', text: 'Golden, smelling faintly of apricots.', where: 'Under birches and beeches after rain, mostly in autumn.' },
  field:       { name: 'Field mushroom',      tags: ['mushroom'],       fill: 1,   icon: '🍄', text: 'Pink gills under a white cap, up after the rain.', where: 'Out in the grass where the ground is rich, after rain.' },
  oyster:      { name: 'Oyster mushroom',     tags: ['mushroom'],       fill: 1,   icon: '🍄', text: 'Soft grey shelves on a fallen log.', where: 'On fallen logs, after rain.' },
  sulphur:     { name: 'Chicken of the woods', tags: ['mushroom'],      fill: 2,   icon: '🍄', raw: false, text: 'Orange shelves on a dead tree. Never raw: it wants cooking.', where: 'On dead trees still standing, after rain.' },
  garlic:      { name: 'Wild garlic',         tags: ['greens'],         fill: 0.5, icon: '🌿', text: 'You smell it before you see it.', where: 'In spring, carpeting the damp woods near the water.' },
  nettle:      { name: 'Nettles',             tags: ['greens'],         fill: 0.5, icon: '🌿', raw: false, text: 'Pinched by the tops. They sting raw, but not once cooked.', where: 'Spring to autumn, wherever the ground is rich.' },
  acorns:      { name: 'Acorns',              tags: ['nut'],            fill: 1,   icon: '🌰', raw: false, text: 'Bitter raw. They need soaking and roasting.', where: 'Autumn, under the oaks. Plenty in a mast year.' },
  beechnuts:   { name: 'Beechnuts',           tags: ['nut'],            fill: 1,   icon: '🌰', text: 'Little three-sided nuts from under the beeches.', where: 'Autumn, under the beeches. Plenty in a mast year.' },
  hazelnut:    { name: 'Hazelnuts',           tags: ['nut'],            fill: 1,   icon: '🌰', text: 'Cracked between two stones, sweet and milky.', where: 'Autumn, along the edges of the woods.' },
  dandelion:   { name: 'Dandelions',          tags: ['greens', 'flower'], fill: 0.5, icon: '🌼', text: 'Every bit of it is good to eat, flower to root.', where: 'All through spring, out in the open grass.' },
  sorrel:      { name: 'Sorrel',              tags: ['greens'],         fill: 0.5, icon: '🌿', text: 'Sharp and lemony. A leaf to wake a dish up.', where: 'Spring and summer, in the damp grass near the water.' },
  watercress:  { name: 'Watercress',          tags: ['greens'],         fill: 0.5, icon: '🥬', text: 'Peppery, from the cold shallows.', where: 'Late autumn through winter, in the shallows by the bank.' },
  strawberry:  { name: 'Wild strawberries',   tags: ['fruit', 'berry'], fill: 1,   icon: '🍓', text: 'Tiny, and sweeter than any from a garden.', where: 'Summer, along the edges of the woods.' },
  elderflower: { name: 'Elderflower',         tags: ['flower'],         fill: 0.5, icon: '💮', text: 'Creamy flat heads that smell of summer.', where: 'Late spring into summer, on the elders by the water and at the woods\' edge.' },
  rosehip:     { name: 'Rosehips',            tags: ['fruit'],          fill: 0.5, icon: '🌹', raw: false, text: 'Red and bright in the cold. Full of hairs: cook them first.', where: 'Late autumn and winter, on the wild roses in the scrub.' },
  // What lies on the ground for a fire: not food. 'tinder' catches the spark, 'fuel' keeps it going.
  stick:       { name: 'Sticks',              tags: ['fuel'],           fill: 0,   icon: '🪵', raw: false, text: 'Something to keep a fire going.', where: 'Under the trees, all year. More come down in a storm.' },
  pebble:      { name: 'Pebbles',             tags: ['stone'],          fill: 0,   icon: '🪨', raw: false, text: 'Smooth stones, to ring a fire.', where: 'On the shore, at the fords and round the rocks.' },
  drygrass:    { name: 'Dry grass',           tags: ['tinder'],         fill: 0,   icon: '🌾', raw: false, text: 'Dry stems from the long grass, to catch a spark.', where: 'In the long grass out in the open, most in summer and autumn.' },
  clay:        { name: 'Clay',                tags: ['earth'],          fill: 0,   icon: '🟤', raw: false, text: 'Cool, heavy and red-grey. It holds the shape of your thumb.', where: 'On the muddy banks, right by the water.' },
  birchbark:   { name: 'Birch bark',          tags: ['tinder'],         fill: 0,   icon: '📜', raw: false, text: 'Papery curls that catch even when damp.', where: 'Under the birches, and by a fallen one.' },
};

// The dishes. Only name and needs are a must. The rest, when left out:
//   at: 'fire'      the station it's cooked at
//   vessel: 'pot'   what it's cooked in at the fire (VESSELS): 'pot' boiled or simmered, 'pan' fried or toasted on the clay
//                   griddle, 'stick', 'stone' (a hot hearth stone), 'bowl' (no heat). The same things in another vessel
//                   don't make it. Left out: 'pot'.
//   fill            how much it fills the tummy (a guess from what goes in)
//   level: 0        the cooking level it needs before it can be found
//   from            a visitor who teaches it, for a dish ('hedgehog', 'heron', 'kingfisher', 'skylark', 'dragonfly')
//   warm: false     it warms you on a cold day
//   time: 30        how long it cooks, in seconds at 1x (the pot keeps cooking while you're off, only while the fire's lit)
//   known: false    true: a new player knows it from the start (it's in their recipe book), not only once they've made it
//   icon: '🥣'      an emoji to stand in until it has a painted one
//   text            a line for its card
const RECIPES = [
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
    needs: ['beechnuts', 'beechnuts'],
  },
  {
    name: 'Toasted hazelnuts',
    vessel: 'pan',
    time: 25,
    icon: '🥜',
    needs: ['hazelnut', 'hazelnut'],
    text: 'Rolled in the embers till the skins crackle and rub off.',
  },
  {
    name: 'Mushrooms with hazelnuts',
    vessel: 'pan',
    time: 50,
    icon: '🥘',
    needs: ['mushroom', 'mushroom', 'hazelnut'],
    text: 'The nuts crushed over the top at the last moment.',
  },
  {
    name: 'Dandelion fritters',
    vessel: 'pan',
    time: 35,
    icon: '🥞',
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
    needs: ['elderflower', 'honey'],
    text: 'Whole plates of flowers in batter, crisp as lace.',
  },
  {
    name: 'Elderflower cordial',
    vessel: 'pot',
    time: 90,
    icon: '🧃',
    needs: ['elderflower', 'elderflower', 'honey', 'fruit'],
    text: 'Steeped a night, sweet and floral. Tastes of early summer.',
  },
  {
    name: 'Rosehip tea',
    vessel: 'pot',
    time: 60,
    icon: '🍵',
    needs: ['rosehip', 'rosehip'],
    warm: true,
    text: 'Steeped on the embers, tart and red. You hold the cup for the warmth.',
  },
  {
    name: 'Rosehip syrup',
    vessel: 'pot',
    time: 90,
    icon: '🫙',
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
];

// What the forager builds, and what each takes out of the satchel. In `needs`, each word is an ingredient or a tag (any
// ingredient that has it: 'tinder' takes dry grass or birch bark), with how many. To add a build, copy a block; the game
// only knows how to build the ones it draws (the campfire, for now).
//   name            what it's called
//   needs           what it takes, { word: how many }
//   text            a line for when you look at it
const BUILDS = {
  campfire: {
    name: 'Campfire',
    vessel: 'pot',
    needs: { pebble: 6, stick: 5, tinder: 2 },
    text: 'A ring of stones, a little tepee of sticks, and tinder in the middle for the spark.',
  },
};

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
const RECIPE_KEYS = ['name', 'needs', 'at', 'vessel', 'fill', 'level', 'from', 'warm', 'known', 'time', 'icon', 'text'];

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
// The vessel a dish is cooked in (left out: the pot).
const vesselOf = r => r.vessel || 'pot';

// What comes out of a station with these things in it, cooked in a vessel: a recipe, or the mess. With no vessel (null) any
// vessel does (game.js potWord asks it whether the things make a dish in another vessel).
function cook(things, at = 'fire', vessel = null) {
  return RECIPES.find(r => (r.at || 'fire') === at && (!vessel || vesselOf(r) === vessel) && fits(things, r.needs)) || MESS;
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
  });
  for (const [id, b] of Object.entries(BUILDS)) {
    const who = `The build '${id}'`;
    if (!b.name) problems.push(`${who} has no name.`);
    if (!b.needs || typeof b.needs !== 'object' || Array.isArray(b.needs)) { problems.push(`${who} needs what it takes: needs: { pebble: 6, stick: 5 }.`); continue; }
    for (const [word, n] of Object.entries(b.needs)) {
      if (!INGREDIENTS[word] && !isTag(word)) problems.push(`${who} needs '${word}', which is no ingredient or tag.`);
      if (!(n >= 1) || n !== Math.floor(n)) problems.push(`${who} needs ${n} of '${word}': it wants a whole number, 1 or more.`);
    }
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
  // Two dishes at one station that the same things could make: the first in the list would always win.
  for (let i = 0; i < RECIPES.length; i++) for (let j = i + 1; j < RECIPES.length; j++) {
    const a = RECIPES[i], b = RECIPES[j];
    if (!a.needs || !b.needs || (a.at || 'fire') !== (b.at || 'fire') || a.needs.length !== b.needs.length) continue;
    const plain = a.needs.map(w => INGREDIENTS[w] ? w : Object.keys(INGREDIENTS).find(id => answers(id, w)) || w);
    if (fits(plain, b.needs)) problems.push(`'${a.name}' and '${b.name}' can be made from the same things; the first one listed always wins.`);
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

const Recipes = { STATIONS, VESSELS, vesselOf, craftLevel, INGREDIENTS, RECIPES, BUILDS, CRAFTS, MESS, cook, fits, fillOf, timeOf, recipeOf, takes, foodOf, thingsFor, answers, checkRecipes };
if (typeof module !== 'undefined') module.exports = Recipes;
else {
  window.Recipes = Recipes;
  for (const p of checkRecipes()) console.warn('recipes.js: ' + p);
}
}
