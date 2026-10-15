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
  fire: { name: 'Campfire', slots: 3 },
  pot:  { name: 'Clay pot', slots: 4 },
  oven: { name: 'Clay oven', slots: 4 },
};

// What the meadow gives. The ids of the ones the sim grows are the sim's own (SHROOMS, the greens, a tree's fruit or
// mast). fill: how much it fills the tummy eaten raw. raw: false if it can't be eaten as it is. icon: an emoji to stand
// in until it has a painted one.
const INGREDIENTS = {
  apple:       { name: 'Apple',               tags: ['fruit'],          fill: 1,   icon: '🍎' },
  cherry:      { name: 'Cherries',            tags: ['fruit', 'berry'], fill: 1,   icon: '🍒' },
  blackberry:  { name: 'Blackberries',        tags: ['fruit', 'berry'], fill: 1,   icon: '🫐' },
  honey:       { name: 'Honey',               tags: ['sweet'],          fill: 2,   icon: '🍯' },
  cep:         { name: 'Cep',                 tags: ['mushroom'],       fill: 1.5, icon: '🍄' },
  chanterelle: { name: 'Chanterelles',        tags: ['mushroom'],       fill: 1,   icon: '🍄' },
  field:       { name: 'Field mushroom',      tags: ['mushroom'],       fill: 1,   icon: '🍄' },
  oyster:      { name: 'Oyster mushroom',     tags: ['mushroom'],       fill: 1,   icon: '🍄' },
  sulphur:     { name: 'Chicken of the woods', tags: ['mushroom'],      fill: 2,   icon: '🍄', raw: false },
  garlic:      { name: 'Wild garlic',         tags: ['greens'],         fill: 0.5, icon: '🌿' },
  nettle:      { name: 'Nettles',             tags: ['greens'],         fill: 0.5, icon: '🌿', raw: false },
  acorns:      { name: 'Acorns',              tags: ['nut'],            fill: 1,   icon: '🌰', raw: false },
  beechnuts:   { name: 'Beechnuts',           tags: ['nut'],            fill: 1,   icon: '🌰' },
  hazelnut:    { name: 'Hazelnuts',           tags: ['nut'],            fill: 1,   icon: '🌰' },
  dandelion:   { name: 'Dandelions',          tags: ['greens', 'flower'], fill: 0.5, icon: '🌼' },
  sorrel:      { name: 'Sorrel',              tags: ['greens'],         fill: 0.5, icon: '🌿' },
  watercress:  { name: 'Watercress',          tags: ['greens'],         fill: 0.5, icon: '🥬' },
  strawberry:  { name: 'Wild strawberries',   tags: ['fruit', 'berry'], fill: 1,   icon: '🍓' },
  elderflower: { name: 'Elderflower',         tags: ['flower'],         fill: 0.5, icon: '💮' },
  rosehip:     { name: 'Rosehips',            tags: ['fruit'],          fill: 0.5, icon: '🌹', raw: false },
  // What lies on the ground for a fire: not food. 'tinder' catches the spark, 'fuel' keeps it going.
  stick:       { name: 'Sticks',              tags: ['fuel'],           fill: 0,   icon: '🪵', raw: false },
  pebble:      { name: 'Pebbles',             tags: ['stone'],          fill: 0,   icon: '🪨', raw: false },
  drygrass:    { name: 'Dry grass',           tags: ['tinder'],         fill: 0,   icon: '🌾', raw: false },
  birchbark:   { name: 'Birch bark',          tags: ['tinder'],         fill: 0,   icon: '📜', raw: false },
};

// The dishes. Only name and needs are a must. The rest, when left out:
//   at: 'fire'      the station it's cooked at
//   fill            how much it fills the tummy (a guess from what goes in)
//   level: 0        the cooking level it needs before it can be found
//   from            a visitor who teaches it, for a dish ('hedgehog', 'heron', 'kingfisher', 'skylark', 'dragonfly')
//   warm: false     it warms you on a cold day
//   text            a line for its card
const RECIPES = [
  {
    name: 'Roast mushrooms',
    needs: ['mushroom', 'mushroom'],
    text: 'Charred at the edges on a green stick, and the juice runs down your wrist.',
  },
  {
    name: 'Garlic mushrooms',
    needs: ['mushroom', 'mushroom', 'garlic'],
    text: 'The garlic wilts into the mushrooms and the whole camp smells of it.',
  },
  {
    name: 'Baked apple with honey',
    needs: ['apple', 'honey'],
    text: 'Soft and sticky, the honey gone to caramel in the cracks.',
  },
  {
    name: 'Honeyed cherries',
    needs: ['cherry', 'cherry', 'honey'],
  },
  {
    name: 'Warm bramble compote',
    needs: ['blackberry', 'blackberry', 'honey'],
    text: 'Purple fingers, purple chin.',
  },
  {
    name: 'Wilted greens',
    needs: ['nettle', 'garlic'],
    text: 'The sting goes out of the nettles in the heat.',
  },
  {
    name: 'Toasted beechnuts',
    needs: ['beechnuts', 'beechnuts'],
  },
  {
    name: 'Toasted hazelnuts',
    needs: ['hazelnut', 'hazelnut'],
    text: 'Rolled in the embers till the skins crackle and rub off.',
  },
  {
    name: 'Mushrooms with hazelnuts',
    needs: ['mushroom', 'mushroom', 'hazelnut'],
    text: 'The nuts crushed over the top at the last moment.',
  },
  {
    name: 'Dandelion fritters',
    needs: ['dandelion', 'dandelion', 'honey'],
    text: 'Dipped by the stalk and fried, a drizzle of honey over.',
  },
  {
    name: 'Spring salad',
    needs: ['dandelion', 'sorrel', 'garlic'],
    text: 'Bitter, sour and sharp: the meadow waking up.',
  },
  {
    name: 'Sorrel and mushrooms',
    needs: ['sorrel', 'mushroom'],
    text: 'The sorrel melts into a sour little sauce.',
  },
  {
    name: 'Strawberries and honey',
    needs: ['strawberry', 'strawberry', 'honey'],
    text: 'Tiny, warm from the sun, and gone in a moment.',
  },
  {
    name: 'Elderflower fritters',
    needs: ['elderflower', 'honey'],
    text: 'Whole plates of flowers in batter, crisp as lace.',
  },
  {
    name: 'Elderflower cordial',
    needs: ['elderflower', 'elderflower', 'honey', 'fruit'],
    at: 'pot',
    text: 'Steeped a night, sweet and floral. Tastes of early summer.',
  },
  {
    name: 'Rosehip tea',
    needs: ['rosehip', 'rosehip'],
    warm: true,
    text: 'Steeped on the embers, tart and red. You hold the cup for the warmth.',
  },
  {
    name: 'Rosehip syrup',
    needs: ['rosehip', 'rosehip', 'honey'],
    at: 'pot',
    warm: true,
    text: 'Simmered and strained through a cloth for the hairs. A spoonful keeps the winter off.',
  },
  {
    name: 'Watercress soup',
    needs: ['watercress', 'watercress', 'greens'],
    at: 'pot',
    warm: true,
    text: 'Peppery and green, the colour of the stream it came out of.',
  },
  {
    name: 'Nettle soup',
    needs: ['nettle', 'nettle', 'greens', 'mushroom'],
    at: 'pot',
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
    needs: { pebble: 6, stick: 5, tinder: 2 },
    text: 'A ring of stones, a little tepee of sticks, and tinder in the middle for the spark.',
  },
};

// The rest is the machinery: you shouldn't need to touch it to add a dish.

const TEACHERS = ['hedgehog', 'heron', 'kingfisher', 'skylark', 'dragonfly'];
const MESS = { name: "A forager's mess", fill: 1, text: "It's... food. Mostly." };
const RECIPE_KEYS = ['name', 'needs', 'at', 'fill', 'level', 'from', 'warm', 'text'];

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

// What comes out of a station with these things in it: a recipe, or the mess.
function cook(things, at = 'fire') {
  return RECIPES.find(r => (r.at || 'fire') === at && fits(things, r.needs)) || MESS;
}

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
    const at = r.at || 'fire', st = STATIONS[at];
    if (!st) problems.push(`${who} is cooked at '${at}', which is no station (${Object.keys(STATIONS).join(', ')}).`);
    else if (r.needs.length > st.slots) problems.push(`${who} needs ${r.needs.length} things, but the ${st.name.toLowerCase()} holds ${st.slots}.`);
    if (r.from && !TEACHERS.includes(r.from)) problems.push(`${who} is taught by '${r.from}', who isn't a visitor (${TEACHERS.join(', ')}).`);
    if (r.fill != null && typeof r.fill !== 'number') problems.push(`${who} has a fill that isn't a number.`);
    if (r.level != null && typeof r.level !== 'number') problems.push(`${who} has a level that isn't a number.`);
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
  // Two dishes at one station that the same things could make: the first in the list would always win.
  for (let i = 0; i < RECIPES.length; i++) for (let j = i + 1; j < RECIPES.length; j++) {
    const a = RECIPES[i], b = RECIPES[j];
    if (!a.needs || !b.needs || (a.at || 'fire') !== (b.at || 'fire') || a.needs.length !== b.needs.length) continue;
    const plain = a.needs.map(w => INGREDIENTS[w] ? w : Object.keys(INGREDIENTS).find(id => answers(id, w)) || w);
    if (fits(plain, b.needs)) problems.push(`'${a.name}' and '${b.name}' can be made from the same things; the first one listed always wins.`);
  }
  return problems;
}

// The ingredients a word in a build's needs takes: itself, or every ingredient with that tag.
const takes = word => (INGREDIENTS[word] ? [word] : Object.keys(INGREDIENTS).filter(id => INGREDIENTS[id].tags.includes(word)));

const Recipes = { STATIONS, INGREDIENTS, RECIPES, BUILDS, MESS, cook, fits, fillOf, recipeOf, takes, checkRecipes };
if (typeof module !== 'undefined') module.exports = Recipes;
else {
  window.Recipes = Recipes;
  for (const p of checkRecipes()) console.warn('recipes.js: ' + p);
}
}
