/* Nobody's Meadow — paints the foxes and rabbits, and the visitors fur.js paints, off the main thread, so a new pose
 * never holds up a frame. game.js posts { coats, winter } first (for Fur.setCoats), then { key, kind (a name in
 * Fur.painters: 'fox', 'rabbit', 'dfly', ...), n, px, dpr } and gets
 * back { key, image }: the painting as an ImageBitmap ceil(px * 1.3 * dpr) square, as the page paints it. Where it
 * can't paint (no 2D OffscreenCanvas in a worker), it answers { key } alone, and the page paints them itself.
 * It paints on the CPU (willReadFrequently, here and for fur.js's scratch canvases): in Safari a worker's canvas on the
 * GPU is painted in the same GPU process the page's frames are, and a painting's soft shadows and scratch layers held
 * them up there. Zooming in, which asks for new sizes, dropped a frame in fifteen; this way, one in a hundred.
 */
importScripts('fur.js');
onmessage = e => {
  const { coats, winter, key, kind, n, px, dpr } = e.data;
  if (coats) { Fur.setCoats(coats, winter); return; }
  try {
    const size = Math.ceil(px * 1.3 * dpr), c = new OffscreenCanvas(size, size);
    Fur.painters[kind](c.getContext('2d', { willReadFrequently: true }), size, px * dpr, n);
    const image = c.transferToImageBitmap();
    postMessage({ key, image }, [image]);
  } catch (err) { postMessage({ key }); }
};
