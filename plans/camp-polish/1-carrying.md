# 1. Carrying a dish: hands, walk, run, spill

Read `.claude/docs/forager-look.md`, `cooking.md`, `walking-camera.md`, `forager-body.md`.

Today a held dish (`f.hand`, `handArtOf`, `drawHeldDish` in game.js, shown in `drawForager`) is a tiny speck at the hip;
the arms don't change, so it reads as floating. Make carrying a thing you can see and feel:

1. **A carry pose.** With a dish in hand the forager holds it in front with both hands (a pose set in `fur.js`'s forager
   painting, like the other poses/outfits; keep sprite keys few: one carry look per facing, not per dish). Dish drawn
   at the hands, sized so a bowl reads as a bowl at normal zoom (check by eye, zoomed in and out).
2. **A carry walk.** Slightly shorter, steadier steps, body a touch upright, a gentle bob that doesn't shake the dish.
   Sprinting while carrying is allowed but costs: the dish slops (a small spring in the hand art, a few drops flying)
   and each sprint second lowers a `held.warm`-style freshness or spills a fraction (decide: simplest is a spill that
   turns the dish into "a bit less" nothing mechanical but a visual + sound, unless you find a cheap, fun rule; say which).
3. **Stumble, drop, mess.** A stumble (`f.stumble`) with a hot dish drops it: it falls, splashes, leaves a stain
   (a cheap decal, painted once, fades) the crows or bees can visit if that is cheap; otherwise only the stain.
4. **Steam** stays (`handsteam`), scaled to how hot it still is; a cold dish steams no more.
5. Put it away / eat / give keep working (H, click the forager). Friends see the carry pose (the net state already
   sends `hd`).

Done = a clip's worth of screenshots (standing, walking, sprinting, stumbling, with a bowl, a plate, a skewer) and no
frame-time change you can notice (time `render` before/after; carry paints through the sprite cache).
