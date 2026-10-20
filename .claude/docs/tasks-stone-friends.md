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
Words from stone.js (`stoneAsk`, `stoneCtx` tells it the season, time, weather and how the forager is). Walking off `STONE_NEAR`, a click on the meadow, ✕,
Esc or Back shut it (`stoneFrame`, `cardAway`, `stepOut`).
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

The meadow card, playing together (2026-10-20): the 🧺 pill opens a small parchment card (`#meadow-card`, `openMeadow`) rather
than sharing the link at once. It lists who's here (the host first with 🧺, then the guests with 🌿, `you` on your own row),
says whose meadow it is (the host's name from `net.hostId` and its peer) and how many are foraging. Share (`shareMeadowLink`,
which ••• › Play together uses too) sends the room in the address; Leave calls `leaveTogether` (`Close the meadow` for the
host). It's rewritten only when its content key changes, and Back, Esc and Done shut it.
A host leaving, playing together (2026-10-20): a host with friends here is asked first (`leaveTogether`, from ••• › Leave or the
card's Leave), naming what happens: one friend keeps a copy of the meadow, or each of several does, and the party is no longer
together. Cancelling changes nothing. Alone, a host still closes the meadow without a word; a guest's leave is asked as before.
The guest's `hostGone` toast says each keeps its own copy when others were here too.
A host's page asleep, playing together (2026-10-20): while its tab is hidden the host sends no positions, and a guest can't
run past `AHEAD_MS` of its last tick, so the guest's meadow simply stops. After `HOST_WAIT_MS` (1.5 s: ten missed words) a
small pill (`#host-wait`, the `#reconnect` one's look and place) says `Waiting for <name>…`, the name from the host's peer,
or `your friend` if it isn't known yet (`hostWaitShow`, written only when it changes). The host's next `pos` (`net.hostAt`) clears
it, with no toast; it stays away while the line is reconnecting, before the host's meadow has landed, and for a paused host,
which keeps sending.

Unread chat, playing together (2026-10-20): a line heard while the chat's card is shut is held (`chatLine`, `.held`), not
timed to fade, so it waits in the log instead of going after `CHAT_LOG_MS` unseen, and 💬 gets a small green dot
(`chatUi.unread`, `chatNew`, as the friends dot). Only the last `CHAT_HELD` (3) stay showing over the meadow; older ones go quiet in the log, the dot still up. Opening the card reads them (`openChat`: `.held` off, their `CHAT_LOG_MS`
started, the dot cleared); leaving the session clears it too (`netCard`). Your own lines never wait.

Bops, playing together (2026-10-20): X, or the round button while a friend stands near (`#swing-btn`, `swingFrame`), swings
at the nearest friend in `SWING_REACH` (`shove`). It costs `SWING_COST` of stamina, `SWING_MISS_COST` more for a swing that lands
on no one (and then it rests `SWING_WHIFF` longer), and the strike comes `SWING_WINDUP` after the press: the arc (`drawSwat`) runs
from the press, and everyone sees it start at once (`'swing'`), so it's a warning; the one swung at has to still be in reach when it
lands (`swatFrame`), so moving in that breath is the dodge. The
one hit (`'swat'`) judders, is knocked back a step and loses `SWAT_HURT` of its health (sim.js hurt); its own client takes that
hurt, as before. Everyone sends its health in `pos` (`hp`), so a friend under its best has a small bar over its head
(`drawPeerHp`), and its name goes up a little to clear it. The first bop that lands with something to throw hints at the hold.
Throwing, playing together (2026-10-20): X held past `THROW_HOLD`, or the round button held, aims instead (`drawTossAim`: a dotted
arc from the forager to a ring where it will land); let go and it throws what the satchel offers (`tossWhat`): a snowball first
while it has snow on its shoulders (`fg.snow`, so winter refills it), else `TOSSES` in their order (a pebble, a stick, a nut, a
berry, honey), else a dish. A pebble hurts a little and pushes; a berry splats and wets; honey splats gold; a dish is caught and
eaten (`tummy`), so a pudding down a friend's front still feeds them. It flies for `TOSS_MS` (`drawTosses`, a turning painting and
its shadow), leaves a stain where it lands (`splats`, `drawSplats`) with `tock` or `splat` (sound.js), and is sent to everyone
(`'toss'`); the one it's for takes it as it lands (`tossHurt`), so the hurt comes with the picture. The thrower sees the hit
judder on the friend and its health bar dip.
The one hit has the last word, since the swinger's picture of a friend is a few hundred ms old (`POS_MS`, the glide): a swat
takes only if it's still within `SWING_REACH + SWAT_SLACK` of where the swing came from (`heardSwat`), a throw only if it's
within `TOSS_CATCH` of where it lands (`tossLand`), so stepping away really is the dodge. And neither takes unless it was sent
from within `HIT_FROM` of where that friend is, or comes sooner after its last than a friend can swing or throw (`hitFrom`):
one broken or cheating client can't knock you down from across the meadow.

A friend's ask, playing together (2026-10-20): an invite or a knock waits up top until it's answered (`askOver`,
`fr.asks`, `#friend-ask`), where it used to go after 45 s, and several queue (four; the newest past that is dropped, its
invite left for a later visit). Answering or waving one away (`Not now`, Esc, Back: `friendAsk(false)`; a tap on the meadow walks on and leaves it up, since waving it off is for good)
clears its row (`Friends.done`), and a yes waits for that (`ASK_DONE_MS` at most) before it walks you over, or the navigation would cut the delete off. An invite to the room already in the address is cleared unseen. A reload
within `INVITE_FRESH` (10 min) brings an unanswered one back; older ones are cleared unseen (`friends.js` `heard`).

Camp builds, playing together (2026-10-20): a guest in a friend's meadow can't make what goes at camp (the basket, the
seat log: recipes.js `where: 'camp'`), which used to vanish from the make strip with no word. It now says whose they
are: a small muted line under the tiles (`#make .mk-note`, `guestCamp`), `Only Ana builds at camp: basket and seat log.`
with the host's name from its peer, or `the meadow's keeper` till it's known. The Craft button shows while the guest
has the makings of one, without glowing ready. It goes as the keeper makes them, or when the guest leaves.
