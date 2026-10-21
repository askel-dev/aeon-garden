# 5. Placing a build should feel good

Read `.claude/docs/fire-camp.md`, `walking-camera.md`, `hud.md`. Code: `ui.place`, the placement ghost, `campSpot`,
`makeRack`, `makeLean`, the make strip and "You made ..." banner in game.js; `sound.js` for chimes.

Found while playing: the ghost says "Inside the camp" until you click well inside the ring; tapping seems to confirm
it from afar; the Craft strip stays open and hides the fire; a build just pops in.

1. **A clear ghost.** Green/amber/red tint with the reason in one short line (existing text), the camp ring shown
   faintly while placing, and the ghost snaps to the nearest legal spot when the pointer is just outside. Check mobile:
   the confirm/cancel pair sits at the foot, 44 px+, and a tap moves the ghost without placing it.
2. **The strip** closes when a build is chosen and reopens on cancel, so the fire and the spot stay in view.
3. **Raising it.** A short build animation (0.6 to 1.2 s): the forager kneels, pieces arrive in a few steps (sticks
   lash, thatch lays), a puff of dust and wood-and-rope sounds (new `chime` kinds in sound.js: tap, lash, settle,
   with a lab row). Cheap: only a handful of draws, the sprite cache for the finished thing, a progress scale/offset for the
   rising one. Friends see it too (the build message already goes over `sendFire`).
4. The "You made" banner and its "+2 cosy" text keep their size and timing.

Done = screenshots of ghost legal/illegal and mid-raise for the rack, lean-to and seat log, the animation played with the
forager, the cooking window and basket unaffected.
