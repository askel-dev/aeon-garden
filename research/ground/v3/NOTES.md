# The ground, third round (v3): B with D's surface

Two mixes of v2's B (`?gv=5`) and D (`?gv=4`), added to `ground-gv.js` as `?gv=6` and `?gv=7`. Same seed (9091),
camera and frame per row as v2; only the ground differs.

- **6 · B+D grain.** B as it was (tufts, clover, the lit long-grass edge, the three states of grass), its swells of
  light at about half the contrast (`0.4 * l` to `0.22 * l`), and D's paper grain over everything (two noises, a little
  darker in the hollows and lighter on the tops). D's dark pooled edge is left out.
- **7 · B+D grain + dabs.** As 6, with D's dry-brush dabs, faint, in the long grass, more where the tufts' drift is thin.

Sheets: `1-seasons-opening-zoom.jpg`, `2-detail-full-res.jpg` (warren crops, open grass, close), `3-far.jpg`.

Rough cost (30 repaints + readPixels, visible Chrome, 4.13 Mpx, summer opening zoom, median of the last runs):
B 0.27 ms, D 0.25, **6: 0.28 (about +4% on B)**, 7: 0.335 (about +24% on B). This is the noisy method; v2's GPU-timer
tool (`tools/time.mjs`) would give firmer numbers before adopting.
