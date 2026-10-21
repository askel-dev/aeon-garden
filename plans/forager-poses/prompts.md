# Forager pose fixes: prompts

These come from a look through every forager painting on 2026-10-21, after the sitting pose was fixed (616154f; look at
that commit for the way it was done). Each prompt below works on its own. They all touch `fur.js` (`foragerPose`,
`foragerParts` and the pose functions near them), so run them **one at a time** or in separate worktrees. Two writers
in the same checkout would overwrite each other.

The common part goes in front of every prompt:

> Nobody's Meadow, `fur.js`: the forager's paintings. Read `CLAUDE.md` and `.claude/docs/forager-look.md` first. The
> box runs -1 to 1, with the feet on the ground at y 0.72 and the hips at `0.4 + P.bob`. The arms are short: a mitten
> more than about 0.25 from its shoulder stretches the sleeve. The front view draws the legs, then the cloak, then the
> arms (`foragerParts`, near its end), and anything that must show over the cloak has to be added after `cloak()`.
> To look at your work, start a server from your checkout (`python3 -m http.server <port> --bind 127.0.0.1`), then run
> `node plans/forager-poses/allposes.mjs <dir> <port>`. It writes every painting large, one labelled PNG per group (`side-stand`,
> `front-walk`, `kneel-sit`, `emotes`...). Also look at the forager at play size in the game (`forager-lab.html` has a
> small row), because a fix has to read at about 34 px. Show the old and new side by side before you call it done.
> These are paintings made once and cached, so perf isn't a concern, but keep sprite keys and pose numbers unchanged.
> Other sessions edit this checkout: never stash, and commit only your own hunks.

---

## 1. Bending to pick, and blowing on the fire (do this first)

> Fix the forager's bending poses so the body bends with the head. Today, picking (views 0–2, poses 3 and 4: `STOOP`,
> `P.stoop` in `foragerPose`) moves the head forward and down (`cx`/`cy` in `foragerParts` take `P.stoop`) and reaches
> the arm out, but the cloak stays an upright bell. The head looks like it's sliding off the body. The same happens
> kneeling at a fire, worst when blowing on the spark (view 3, poses 20–21, `KNEELS` with stoop 1.15–1.35).
>
> Make the cloak's top (the shoulders) and the satchel follow the stoop: lean the upper body over from the hips so the
> neck stays attached. The hem stays roughly where it is, the back curves, and seen side on the hood's point flops
> forward a little. From the front and back, a stoop mostly shortens the body and drops the shoulders. Keep pose 4
> (the deepest pick) readable as reaching to the ground. Check side-stand 0:3/0:4, front-stand 1:3/1:4, back-stand
> 2:3/2:4 and kneel-sit 3:16–3:22 before and after.

## 2. Walking toward and away from you

> Fix the walk seen from the front and back (views 1 and 2, poses 8–15, and the jog 16–23). Mid-stride the two feet
> line up one behind the other (front-walk 1:11–1:13, back-walk 2:11–2:13), so it looks like a hop on one leg. The
> feet move along `fwd` (`[-0.62, ±0.4]`) from `base` in `foragerPose`, and the diagonal carries one foot over the
> other.
>
> Keep the two feet apart sideways through the whole stride (each in its own lane, crossing at most a little), with the
> foot that's forward lower on the picture. Then give the arms a visible swing from the front: right now `P.swing` hardly
> moves a front-view arm (`arm` in `foragerParts`, its `to` for the non-side views). The carried-dish walk
> (`carryPose`, views 1–2) shares the feet, so check it too.

## 3. The sneak's lifted knee

> Fix the sneak emote's high-stepping knee (`sneakPose`, emotes e13–e15 in `emotes.png`). When `P.kneeOver` is set,
> the side view draws the near leg after the cloak (`foragerParts`, side branch), and it shows as a flat brown block
> laid on the cloak. Make it read as a knee lifted under the cloak's front: let the cloak's hem ride up over the thigh
> (it already hitches up with `P.hemUp`), round off and shade the knee, and keep the shin and the toe-down boot below.
> The other sneak frames and the two lurks shouldn't change.

## 4. Kneeling: the back boot and the boxy cloak

> Fix the kneel at a fire (view 3, poses 16–22, `kneelPose`, the `P.kneel` branches of `leg` and `cloak` in
> `foragerParts`). The near leg's boot lies behind as a long dark slab (the `down` boot), and the cloak's outline is a
> stiff box. Make the back boot a short, rounded sole with its toe tucked under, and give the cloak a softer drape over
> the knee and onto the ground behind. If fix 1 is in, keep its bend. Check kneel-sit 3:16–3:22.

## 5. A livelier side-on walk

> Make the side-on walk (view 0, poses 8–15) less stiff. The arm swing (`swing`, 0.42 in `foragerPose`) barely shows,
> so raise it, add a small counter-swing of the far arm if it shows, and let the body bob a little (`FORAGER_BOB`). Keep
> the planted foot from sliding: it has to keep pace with the ground (`FORAGER_REACH`). The cold walk (24–31) hugs
> itself and shouldn't swing. Compare side-walk before and after, and watch it moving in the game.

## 6. From the back: the hood and the cheek (a matter of taste: show Axel first)

> From behind (view 2), the hood's point is a big orange wedge hanging down the back (`tip` in `foragerParts`, the
> back branch), and a sliver of cheek (`head`, the `back` marks: an oval at `cx - 0.28`) shows on one side as a white
> blob. Try a slimmer, shorter point that curls a little, and either drop the cheek or make it a soft skin-coloured edge.
> Make two or three versions side by side for Axel to pick from before committing any.
