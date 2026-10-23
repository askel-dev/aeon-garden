'use strict';
{ // (one block, so none of its names clash with the game's: the game reads it as Updates)
// The meadow's version, and what each update brought, as plain data. game.js shows the card once after an update
// (What's new: the updates since the one last seen), and ••• › What's new brings it back.
//
// One block an update, and an update is a push to main: Axel makes many changes, big and small, and commits them together.
// So while the top block isn't in the last commit (`git show HEAD:updates.js` hasn't its `v`), it's the update still being
// made: a change adds its notes to that block, and doesn't start another. Once it's committed, the next change starts a new
// block at the top.
//
// The version is MAJOR.MINOR.PATCH, one step an update (not one a change):
//   - MINOR, the update brings a new thing to do (fishing, cooking at the fire); the block's title names it;
//   - PATCH, the same things made better or fixed. A patch block that a new thing joins becomes the next MINOR;
//   - MAJOR stays 0 until the meadow is the game it means to be.
// A fix nobody would notice needs no note (and no block of its own: an update of only those shows no card).
// The card comes only for a block whose `v` is newer than the one last seen. Notes say plainly what changed, one short
// sentence each, the biggest first: the card shows the first three, and the rest under "Show more" (a note added to a
// block goes where it ranks, not at the end).

const UPDATES = [
  {
    v: '0.12.4', date: '2026-10-23', title: 'Fixes',
    notes: [
      'On an iPhone home screen, the strip at the foot of the screen now takes the colour of the meadow just above it.',
    ],
  },
  {
    v: '0.12.3', date: '2026-10-23', title: 'Fixes',
    notes: [
      'A dish in your hands now says so over the satchel: tap yourself to eat it or put it away.',
      'Picking a satchel slot while you hold a dish puts the dish away, so you hold what you picked.',
      'Put all in at the basket takes the dish in your hands too.',
    ],
  },
  {
    v: '0.12.2', date: '2026-10-23', title: 'Fixes',
    notes: [
      'Your forager kneels and stirs as soon as it starts cooking, and walks properly afterwards, instead of freezing in one pose.',
    ],
  },
  {
    v: '0.12.1', date: '2026-10-23', title: 'Fixes',
    notes: [
      'Your forager, and friends, no longer get stuck in one pose while walking.',
    ],
  },
  {
    v: '0.12.0', date: '2026-10-23', title: 'All the meadows together',
    notes: [
      'A new Everyone page in the book shows what all the meadows did together this week.',
      'Every autumn foragers everywhere catch fish toward a feast, and when enough are caught, every meadow learns a new recipe.',
      'Each find and recipe in the book says how many foragers have found it.',
      'Some mornings tell you how many foragers walked a meadow today.',
    ],
  },
  {
    v: '0.11.0', date: '2026-10-23', title: 'Treasures from the water',
    notes: [
      'A good angler sometimes fishes up treasures: bottles with secret recipes, a copper pot, a fisher\'s cap and an oilskin cloak.',
      'From fishing level 3, mussels, crayfish and water mint come up on the hook, with dishes of their own.',
      'Mussels now and then hide a pearl.',
      'The fishing skill\'s page in the book is a fishing guide: everything that bites, how rare it is, and where and when.',
      'The fishing rod wears out as you use it, and a bar under it shows how much is left.',
      'A worn-out rod snaps. Mend it with a rope at the Craft strip before it does.',
      'Fish have sizes. The book shows the biggest of each kind you have caught.',
      'A caught fish pops up over your head with its name and weight.',
      'Now and then a stick, pebbles, dry grass, clay or birch bark comes up on the hook instead of a fish.',
      'Fish tire while you reel them in and make one last run before they give up.',
      'Keeping the fish in the bar the whole time gives a perfect catch.',
      'Fishing is slower: fish take longer to bite and longer to reel in.',
      'A trail of bubbles shows a fish swimming up to the float before it bites, and the water splashes when it does.',
      'You can sit on the bank while waiting for a bite.',
      'You can fish sitting on a seat log by the water.',
      'A seat log can face you, away from you, left or right, and you sit on it facing the same way.',
    ],
  },
  {
    v: '0.10.0', date: '2026-10-22', title: 'Fishing',
    notes: [
      'Craft a fishing rod from sticks and rope.',
      'Four fish: roach, perch, trout and eel.',
      'Six new fish dishes.',
      'Fishing works when playing with friends.',
      "Friends' pictures show on the friends list when they are offline.",
    ],
  },
  {
    v: '0.9.0', date: '2026-10-21', title: 'Cooking at the fire',
    notes: [
      'The pot cooks over the campfire, with a timer next to it.',
      'You can build more than one drying rack.',
      'Rain makes a sound on the lean-to roof, and you can sleep under it at night.',
      'Honey is easier to get.',
    ],
  },
];

const VERSION = UPDATES[0].v;

// -1, 0 or 1, as a is older than, the same as, or newer than b ('0.10.1' is newer than '0.9.3').
function compare(a, b) {
  const x = String(a).split('.'), y = String(b).split('.');
  for (let i = 0; i < 3; i++) {
    const d = (+x[i] || 0) - (+y[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// The updates newer than the version last seen, newest first (all of them for null).
const since = seen => UPDATES.filter(u => seen == null || compare(u.v, seen) > 0);

// The newest new thing to do and what came after it (the updates back to the last x.y.0): what someone who played before
// there were versions is shown, so a small fix on top doesn't hide the update it came with.
const lately = () => UPDATES.slice(0, UPDATES.findIndex(u => /\.0$/.test(u.v)) + 1 || 1);

const Updates = { VERSION, UPDATES, compare, since, lately };
if (typeof window !== 'undefined') window.Updates = Updates;
if (typeof module !== 'undefined') module.exports = Updates;
}
