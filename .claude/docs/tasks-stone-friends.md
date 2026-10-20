# First things, the old stone, gifts and hugs

First things (2026-10-17; the comment over game.js `TASKS`): a new player's guide, a small parchment note under the face
(`#tasks`, `renderTasks`, in the 250 ms block, rewritten only on a change) of what to do first, a chapter at a time: a fire before
dark (sticks, pebbles, tinder with counts from recipes.js `BUILDS.campfire`, build, light), the first night (a stick on, see the sun
come up), something to eat (pick food, the book, a roasting stick, cook, eat it), a home at camp (the basket). Each line ticks itself
off from the meadow and the satchel (`got`/`n`, `done`; a stick fed and a dish eaten are heard as events, `taskUi.fed`, `taskUi.ate`),
and stays ticked per player (`aeon-garden-tasks`), so it's for the first meadow or so; on load what's already true ticks quietly. A
line ticked pops its circle with a click; the line worked on says how (`how`); a chapter done is a toast and `found`, stays ticked
`TASK_TURN_MS`, then the next pops in; the last is a gold headline ("Settled in") and the note is gone for good. A tap on its head
folds it to the one line (`aeon-garden-tasks-fold`). Away while the book, the wardrobe
or the old stone are open or the forager is down. Not shown on a phone at all (index.html's `narrow()` media query hides `#tasks`).
The old stone (2026-10-17; the comment over `STONE_MOODS`): sim.js `w.stone`, painted once a face (`paintOldStone`, `STONE_ARTS`:
seven moods, each with its mouth shut and open; moss hair and brows, asleep and drooling left alone `STONE_DOZE_MS`), drawn with the
trees and animals (`drawStone`), solid in the forager's way like a rock. A click on it walks over (`goStone`, `goFire` 'stone', standing
`STONE_STAND` further out than at a fire) and opens a slim line to talk on over the satchel (`#stone-talk`, `openStone`; up top on a
touch screen, out of the keyboard's way, the face hidden under it and the camera keeping the stone and its bubble below it and above the
satchel or the keyboard: `measureSheet`, `STONE_ROOM`). E when it's the nearest thing to use does the same (`eTarget`), with a little disc of its face and
an E bobbing over it while it would (`drawStonePrompt`; a tap on the disc opens it too). Woken, it says hello. What's typed is the forager's bubble (`myChat`), its answer a bubble
over the stone (`stoneUi.chat`, in `drawPeerNames`) with its mouth going (`STONE_MOUTH_MS`). A tap on anything in the satchel there has
🙏 Offer by Eat (`eatAsk`, `offerSlot`): it flies into the stone, which rates it (a "★★★ 7 / 10" pill over it and a sound by the
score; the pill stays up as long as its bubble's words, `stoneSays`, and goes when the stone is asked or offered something
else, `stoneDropScore`, so the rating and its number are always on screen together).
Words from stone.js (`stoneAsk`, `stoneCtx` tells it the season, time, weather and how the forager is). Walking off `STONE_NEAR`, ✕,
Esc or Back shut it (`stoneFrame`, `stepOut`).
Gifts, playing together: with a friend's forager within `GIVE_REACH` (`giftFriend`), a tap on anything in the satchel offers
it (a green 🎁 button with their name, by Eat in `eatAsk`); `giveSlot` takes one out and flies it over to them, and `heardGive`
puts it in their satchel with a toast, or at their feet as a drop when it's full. Sent `to` that friend alone (net.js passes a
guest's word to another guest through the host).
Hugs, playing together (2026-10-19): G, or the round heart button above the swing's while a friend stands within
`HUG_REACH` (`#hug-btn`, `hugFrame`), stops the forager and turns it to the nearest friend (`hugLocal`): both open
their arms and hug for `HUG_MS`, squeezing every `HUG_SQUEEZE` (fur.js `FORAGER_EMOTE` `hugA`, `hugB`, `hugPose`), with
little hearts (drawEffects) and sound.js `hug`; the first hug ever is a gold headline (`firstTime('hug', …)`). Sent `to`
that friend alone (`'hug'`, as a gift is): they hug back and
send where they stand, so everyone sees both (sendPos's `em`). A friend at a fire, cooking, placing something or on the
ground isn't pulled away: they hear the hug and get a toast, and the hearts still rise over the one who hugged them.
