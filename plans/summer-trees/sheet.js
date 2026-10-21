// Packs rows of paintings into one sprite sheet. rows: [[{ name, cv, footX, footY }, ...], ...]. Each row is as tall as its
// tallest painting, every painting stands on its row's ground line (footY), and the cells are as wide as the widest.
// Draws into #sheet, writes the atlas into #atlas, and leaves the PNG as a data URL in #png for a headless run to read.
function packSheet(rows, image, pad = 8) {
  const all = rows.flat();
  const left = Math.max(...all.map(f => f.footX)), right = Math.max(...all.map(f => f.cv.width - f.footX));
  const cellW = Math.ceil(left + right) + pad * 2, cols = Math.max(...rows.map(r => r.length));
  let sheetH = 0;
  const lines = rows.map(row => {
    const above = Math.max(...row.map(f => f.footY)), below = Math.max(...row.map(f => f.cv.height - f.footY)), top = sheetH;
    sheetH += Math.ceil(above + below) + pad * 2;
    return { above, top };
  });
  const sheet = document.getElementById('sheet');
  sheet.width = cellW * cols; sheet.height = sheetH;
  const g = sheet.getContext('2d'), frames = [];
  rows.forEach((row, y) => row.forEach((f, x) => {
    const dx = Math.round(x * cellW + pad + left - f.footX), dy = Math.round(lines[y].top + pad + lines[y].above - f.footY);
    g.drawImage(f.cv, dx, dy);
    frames.push({ name: f.name, x: dx, y: dy, w: f.cv.width, h: f.cv.height, footX: Math.round(f.footX), footY: Math.round(f.footY) });
  }));
  document.getElementById('atlas').textContent = JSON.stringify({ image, frames }, null, 1);
  const out = document.createElement('div');
  out.id = 'png'; out.hidden = true; out.textContent = sheet.toDataURL('image/png');
  document.body.append(out);
}
