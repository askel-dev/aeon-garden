# Stage 5: the call sites (Sonnet)

Small, separate changes in game.js. They let the WebGL context draw everything, and they look the same on the 2D
canvas. Each one stands alone. Do them in order, check `?gl=0` after each (it must look unchanged), and keep every diff
minimal. This stage can run before stage 6 wires anything up, since the hooks are written with `?.`
(`ctx.touched?.(c)`), which is a no-op on the 2D context.

## 1. Pictures repainted in place: `ctx.touched?.(canvas)`

The WebGL context keeps a copy of each picture on the GPU, so when the game repaints a canvas it already drew, the
copy has to be refreshed. After each repaint of these canvases, add `ctx.touched?.(c)` with the canvas that was
repainted:

- **The sky picture**, `laySky` (~12300): `sky.canvas` is repainted when its signature changes. Add it after the
  repaint, once per repaint, not per frame.
- **The rainbow**, ~12400: `bow.c` is reused (`bow.c || document.createElement('canvas')`). Add it after it's painted.
- **Rocks**, `rockSprite` (~11510): `t.sprite` and `t.snow` are reused and repainted on zoom. Add it for both, after the
  paint.
- **Then search for any other canvas that is kept and painted again.**
  - The pattern is a canvas stored on an object, in a Map or in a module variable, whose `getContext('2d')` is drawn
    into in more than one place or more than once, and which is also drawn onto `ctx` in the render path.
  - Grep `document.createElement('canvas')` (55 matches) and check each.
  - Burrows (`paintBurrow`) make a fresh canvas on each repaint and free the old one, so they need nothing. Check that's
    still true.
  - The sprite cache's canvases become ImageBitmaps and are never repainted.
  - Labels, chat bubbles and name arts: check whether a kept canvas is repainted when the text changes, or a new one is
    made.
  - List every place you checked in your report, whether it needed the call or not.

## 2. Freed pictures: `ctx.forget?.(img)`

- `freeImage` (~191): add `ctx.forget?.(img);` as its first line.
- `dropTreeArt` (~11125) calls `image.close()` straight. Add `ctx.forget?.(image)` before it, and the same for its snow
  image if it closes one.
- Grep for any other `.close()` on an ImageBitmap, and for `width = 0` used to free a canvas outside `freeImage`. Do
  the same there.

## 3. The two circle clips

- `drawPickArrow` (~7913): `ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.clip();` then a sub-rect
  of `itemSheet` is drawn inside the disc.
- `drawFriendMarks` (~14930): a friend's face is clipped to a circle the same way.

The WebGL context doesn't support circle clips. Replace each with **a cached disc picture**:
- When the content changes (which item, which friend's face, the disc's size in device pixels), paint once into a small
  canvas: the disc's background, then the clipped item or face (the clip is fine on a 2D canvas). Turn it into a bitmap
  with `asBitmap`, like the other paintings.
- Draw that with one `drawImage` each frame, under the same transform the disc used.
- Key it by item id / friend id plus size step (`spriteStep`), and keep at most a few (a `Map` with 16 entries, cleared
  past that), freeing the old one with `freeImage`.

Compare before and after at 3x in the browser. It must look the same, including the rotation of the disc if it
rotates: draw the painted disc with the rotation, not the rotation inside the painting.

## 4. Lightning's `shadowBlur`

`drawLightning` (~12476) sets `ctx.shadowColor = '#bcd4ff'; ctx.shadowBlur = 14;` for the bolt. Replace the blur with
two strokes of the same path, both in the same colour:
- first a wide, faint one: `lineWidth` × 6, alpha 0.18;
- then a mid one: `lineWidth` × 3, alpha 0.3;
- then the bolt as it is, with no `shadowBlur`.

It flashes for a fraction of a second, so close is good enough. Show the before and after side by side in your report
(two screenshots from `garden.still` with a bolt forced on: find how `drawLightning` is triggered and set its state
from the console).

## 5. The mist fade's alpha wrapper reads the prototype

At ~555:
```js
const ALPHA = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
```
Leave the behaviour exactly as it is, but put the wrapper in a function, `wrapAlpha(c)`, that reads the descriptor from
`Object.getPrototypeOf(c)` and installs the accessor and the `restore` patch on `c`. Call it once for `ctx` where it's
done now. (Stage 2 may already have done this; if `wrapAlpha` exists, skip this item.)

## 6. Rect clips stay

`drawVisitor` (~1773), `drawCreature` (~1914) and `drawFigure` (~2281) clip to an axis-aligned rect for wading. The
WebGL context handles those as a scissor, as long as the transform when `clip()` is called has no rotation. Check each:
- read the code around the clip;
- note in your report whether a flip (`scale(-1, 1)`) or a rotation can be in effect at that point.

A flip is fine; a rotation is not. If a rotation can be in effect, say where. Don't change it.

## Acceptance

- `?gl=0`:
  - `plans/webgl/tools/scenes.mjs` into `shots/stage5` vs `shots/base`, through `pixdiff.mjs`: 0% on every scene, except
    where a disc (item 3) or lightning (item 4) is in view. Those must be under 1% and look the same by eye.
  - Make a scene for each changed site if `scenes.mjs` doesn't show it:
    - the pick arrow: something to pick off screen;
    - a friend mark: fake a peer if needed, or skip it and say so.
- `grep -n "shadowBlur" game.js` shows none in the render path; the one in a paint-once function at ~6688 stays.
- The report lists every canvas checked for item 1.
