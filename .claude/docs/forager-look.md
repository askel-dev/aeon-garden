# The forager: painting, outfits, emotes

The forager (sim.js `w.forager`; how it walks is in walking-camera.md) is painted in fur.js like a fox (`paintForager`,
`foragerPose`, `foragerParts`: a rust hood with a flopping point, a round face, a moss cloak, mittens, a satchel, boots), in
three views (side on, three-quarters from the front and the back, all facing left and mirrored going right) and eight
paintings a stride, eight more jogging for the sprint, plus standing, a fidget and a blink: 'forager:' + (outfit << 7) + (view << 5) + pose, painted by the worker
(`foragerAhead` asks for every one at the size it's drawn, so a walk never waits). Its feet are where it is. game.js
(`foragerFrame`, once a frame) turns the stride over with the ground it covers (a stride every `2 * FORAGER_REACH * 2` of its
half-size, so the planted foot doesn't slide; fur.js `FORAGER_REACH`), picks the view from the sim's heading with a margin
either side so it doesn't flicker, and standing lets it breathe, blink, turn to face you after `FORAGER_TURN_MS` and now
and then do something (`IDLES`, `idleOf`; the player's and each friend's): look up, glance to either side, peek in its satchel,
tap a foot, hum swaying with its eyes shut (`HUM_SWAY`, in `drawFigure`), and after `IDLE_LONG` stretch with a yawn or wave
at you. Those are fur.js `FORAGER_IDLE`, painted from the front only and kept as 'view' 3 of the key (`poseKey`). In the shallows it's cut off at its shins with a ring round its legs, and each step sends out
a ring (`fg.rings`). Out of the water each foot down leaves a footprint (`footprint`, `drawPrints`: a ring of `PRINTS` in typed
arrays, one soft sole painting turned along its way and laid flat, under everything that stands) that fades by the ground under it
(`PRINT_GROUND`: soon in grass, slowest in snow, blue there; none on ice), on a clock that stops while paused. Its shadow goes in with the animals' (`foragerShadow`). A tree standing in front of it (drawn after it, its painting's box over its body) fades to `SEE_A`, as in Project Zomboid, eased over `SEE_MS` (`seeThrough`, `fgBody`). What's drawn after all the trees (the fireflies, the leaves
coming down, pollen, butterflies, splashes, the effects, the burrows' 💤) hides behind a leafy crown standing in front of it
(`coverAt`): each crown drawn is kept as its kind's outline (`CROWNS`, `addCover`) in a coarse grid of the screen made once a
frame (`buildCover`), soft at the edge (`COVER_EDGE`), half for first leaves or half fallen, nothing bare, and as little as
it shows when faded (mist, the forager behind it). Pop-ups, labels and the selection stay on top. `forager-lab.html` paints them all side by side (`?o=` an outfit). Its outfit is a cloak and a hat
(fur.js `FORAGER_CLOAKS`: cloak, hood, rim; `FORAGER_HATS`: the hood's own point, a bobble, fox ears, a toadstool cap, a wanderer's
felt hat with a feather, a crown of flowers, melted cheese sliding down over the hood, painted in `foragerParts`' `hat`), painted as one outfit
(`FORAGER_OUTFITS`, `outfitOf`: hat * cloaks + cloak, so the key and what goes over the net are one number). Picked on the
wardrobe card (`wardrobe`, `#wardrobe`: the forager painted as it'll look, a row of painted heads in each hat, cloak swatches, a
die, and the name while playing together), tried on there and worn only on its button: before going into a friend's meadow
(`begin`: 'join', in the middle over a dimmed meadow, it takes a name and can't be put away; nothing's said to the room till
Set off), as you first open yours to friends ('host', from `together`), as a new meadow opens till one's been picked, and from
••• ('dress'). Up top on a touch screen, out of the keyboard's way. Kept in localStorage apart (`aeon-garden-outfit` the cloak,
`aeon-garden-hat`, `aeon-garden-name`), so a new cloak or hat goes at the end of its list.
Carrying a dish (cooking.md, the hands) it has paintings of its own, kept after the emotes (fur.js `carryPose`, `carryArt`): the standing, walking and jogging ones in every view with both mittens holding it out, shorter steps (`CARRY_STRIDE`), a gentler bob; friends' too.
Emotes (`emote`, the comment over `EMOTE`): the dance and the sneak. (They used to be asked for by 1 and 2 or the round button on
the satchel's other side from the fire's: `#emote`, `emoteMenu`, `emoteIcons`, `emoteShown`; button, keys and fan are gone, and
`emote` is left as the workings behind them.) Painted in fur.js (`FORAGER_EMOTE`, `emotePose`, kept after all its other paintings:
`emoteArt`), asked of the worker only while one is on, and kept in the cache only while one is on (`keptForager`). The dance is
NLE Choppa's as the Roblox emote does it (Axel's reference was a screen recording of it; two tries at his real-life dances,
front-on kicks and then a noodle bounce, didn't read): it turns on the spot a sixth of a turn a step (`DANCE_TURN`, through the
views and mirrored, so `b.view` and `b.flip` move while it dances), each beat a head-bang down into a deep hunch, eyes squeezed
shut, and a spring up onto one foot with the other heel kicked up behind, tongue out, the feet taking turns (`DANCE_SEQ`; fur.js
`dancePose`, painted from all three views). The spring hops (`b.lift`, `DANCE_HOP`, in `drawFigure`), a stomp sound at each hunch; it dances till it's sent somewhere. It keeps to the song's beat (132 bpm, one move a beat, `DANCE_BEAT`): while the song plays its clock is eased toward the song's (`PARTY_BEAT0`, the first beat; a new song needs its bpm and first beat measured, e.g. folding the low band's onsets over the beat with ffmpeg and numpy). The
sneak is a devious walk side on (`sneakPose`): crouched, the cloak hitched up, tiptoeing with the near knee lifted over the cloak,
mittens out like little claws, a sly lid and brow and a smirk; slower (sim.js `f.sneaking`, `FORAGER_SNEAK`, stride
`SNEAK_STRIDE`); asked for standing it creeps `SNEAK_GO` tiles the way it faces, every walk after is a sneak till it sprints,
stands still `SNEAK_REST` or you ask again, and standing it lurks rubbing its mittens. Both on the page's clock (not faster at
speed), stopped while paused; a friend sees them (`sendPos`'s `em`, `et`).
