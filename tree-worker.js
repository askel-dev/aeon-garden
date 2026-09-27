/* Nobody's Meadow — paints trees (trees.js) off the main thread, so a paint never holds up a frame.
 * game.js posts { key, kind, seed, season, scale, ss, snow } and gets back { key, bx, by, image,
 * snow? } with the pictures as ImageBitmaps.
 */
importScripts('trees.js');
onmessage = e => {
  const { key, kind, seed, season, scale, ss, snow } = e.data;
  const cv = Trees.paint(kind, { seed, season, scale, ss, snowLayer: snow });
  const out = { key, bx: cv.bx, by: cv.by, image: cv.transferToImageBitmap() };
  if (cv.snow) out.snow = cv.snow.transferToImageBitmap();
  postMessage(out, out.snow ? [out.image, out.snow] : [out.image]);
};
