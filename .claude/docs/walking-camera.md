# Walking, input and the camera

## game.js

A click or a tap on an animal (on its body as drawn: `animalAt`, a little wider for a finger) opens its panel;
anywhere else walks the forager there (`walkTo`, sim.js `foragerTo`) and shuts the panel, with a
soft ring where it was sent (`drawMark`, `MARK_ART` painted once) that fades once it's there, and a faint dashed line to it
along what's left of its way (`drawTrail`: one stroke a frame, the dashes counted from the ring so they keep still on the ground,
fading in just after the ring pops up, `TRAIL_IN`, and marching on toward it while it sprints, `TRAIL_MARCH`); held
and steering, the ring glides after where it was sent (`MARK_GLIDE`) rather than jumping each `STEER_MS`. A press held still for
`HOLD_MS`, or dragged, runs toward the pointer while it's down (sim.js `f.running`, `FORAGER_RUN`; Shift held runs too, `holdShift`), the
way found again every `STEER_MS` (in `frame`), and on to where it's let go. WASD or the arrows (`keyWalk`) take over from a walk or a held press: the ring, the trail and the press itself are dropped, so letting go walks nowhere. Running, once up past `FORAGER_JOG` it jogs (`fg.jog`, fur.js poses 16 to 23: both feet off the ground a moment, heels
kicking up, elbows bent and pumping, leaning in) with a stride `FORAGER_JOG_STRIDE` longer. On the ice it can't dig in (sim.js `onIce`, `FORAGER_ICE_*`): it gets going slowly, turns in long wide arcs, and isn't stopped where it was sent but carries on past, gliding (no stride, standing) till it comes to rest or reaches dry ground. The camera always goes with it (`leadCam`): eased after it (`CAM_FOLLOW`), a little ahead the way it walks
(`CAM_AHEAD`, itself eased so setting off and stopping are soft), its feet a little below the middle (`CAM_FEET`). Nothing pans it:
the wheel, a pinch, a double tap and + - zoom about the forager (`zoomOn`), and a kept meadow opens on it at its kept zoom (`resumeWorld`: `showWorld` leaves the wide shot, so it's set back there).

On a phone (and Back anywhere): Back steps out of what's open as Esc does (`stepOut`: a card or menu shuts, the inspector's
open sheet folds and then shuts). Each thing open holds a step in the history, counted, not named (`opened`), and
`syncBack` levels the history with what's open after every tap or key: pushed only inside a tap, as Safari skips a step a
page adds outside one. The inspector's sheet follows the finger and settles open, folded or away by where and how fast
it's let go (`sheetLetGo`). A double tap zooms in, a double tap held and dragged zooms as it goes, and two
fingers tapped zoom out (`zoomTo`, `zoomDrag`, as Google's and Apple's maps do); a tap that would only put the inspector
away waits `DOUBLE_MS` in case it's the first of two (`tapAway`). On a touch screen the screen stays awake while time
runs, till nobody has touched it for `WAKE_MS` (`wakeTick`, the Screen Wake Lock API).

## sim.js

The forager (`w.forager`, `foragerOf`: one layout, kept with the meadow; a meadow kept before it gets one when it opens,
no `KEEP_VERSION` bump) is the player: not a creature, so nothing hunts it and nothing it does touches the meadow's random
numbers. It starts at a pleasant dry spot near the water and the woods, above the spring flood, nothing standing on it, near
the middle (`startForager`). `foragerTo` finds its way: A* over the tiles (`tilePath`, its arrays made once; deep water
blocks unless frozen, the shallows cost `SHALLOW_COST`, ground by the deep `BRINK_COST` more, no squeezing past the deep's
corners), to the tile it can stand on nearest a click on the deep, or the nearest it can reach; then pulled tight into a few
straight legs (`taut`: `TAUT_CLEAR` off the deep, and no wading where the tiles' way didn't). Rocks are in its way, all but
pebbles and a ford's stones (`rockKind`, which game.js paints by too; `ROCK_SOLID` of its size, plus `FORAGER_GIRTH`): worked
out once a meadow (`rocksFor`: their circles, and the tiles whose middle is in one, which A* won't step on), a leg keeps out
of them (`pastRocks`), a click on one goes to its edge, and a step into one is put back at its edge, so it slides round
(`outOfRocks`; one it's already in, it can only leave). Trees and brambles are half in its way, as in Project Zomboid:
it pushes through, slowed and eased round the trunk. Each is a circle about its foot (`brushOf`: `BRUSH_TREE`, a hawthorn
`BRUSH_THORN`, a grown bramble `BRUSH_BRAMBLE`, by size, a sapling barely, a stump, log or seedling not at all) that slows it
by up to its `slow` (`brushAt`) and pushes it out by up to `BRUSH_PUSH` of its step (fading as it nears where it was sent,
so it can be sent into one). The way keeps out of them: A* pays `BRUSH_COST` more a tile by how much its middle slows it
(`brushTile`, `brushGrid`), and a leg isn't pulled tight through brush thicker than the tiles' way went through (`taut`'s
`thick`). Both are gathered at most once a game hour (`brushGrid` when a way is wanted, `brushAbout` the few near it once
it's gone a tile), so a tick looks at a handful. Through a wood it weaves and takes about a tenth longer. `foragerTick` walks them by
steering: it heads for a point `FORAGER_LOOK` along the way, turning at most `FORAGER_TURN` a tick (three times that from
standing), speeds up by `FORAGER_ACCEL`, slows to stop where it was sent (`FORAGER_BRAKE`) and into a sharp turn, wades at
`FORAGER_WADE` of `FORAGER_WALK`, and slides along the deep if a corner clips it. Sneaking (`f.sneaking`, game.js's sneak emote, in the blank: no `KEEP_VERSION` bump) it creeps at `FORAGER_SNEAK`; a sprint wins.
Playing together, friends' foragers are in each other's way (`friendsAt`: game.js `friendsFrame` hands over where each is
drawn and whether it's standing still (`PEER_STILL_MS`), every frame; one collapsed isn't): a circle of `ELBOW_ROOM` about each it can't step into (`outOfFriends`), sliding round
it, met about head on (`FRIEND_HEAD_ON`) stepping to its right (`FRIEND_SIDESTEP`) so two walkers pass, and a way that ends in one ends at
its edge. Walking into one that's standing it doesn't step aside: it presses on, and the one standing is pushed (`makeRoom`) up to
`PUSH_STEP` a tick while the walker is within `PUSH_ROOM` (0.05 a tick against a walk's 0.085), so a friend can be pressed along out of
the way. A friend is shown a moment late, so the walker's stopped at `ELBOW_ROOM` and the standing one's screen sees it come near;
a walker already inside a circle is moved out of it by `ELBOW_SHUFFLE` a tick (`outOfFriends`). Two standing side by side settle
`PUSH_ROOM` apart on both screens; two on one spot (woken by the camp's fire) step off the
ways `friendSide` says, hashed from who each is. Not the sim's: nothing the meadow counts follows from it.
