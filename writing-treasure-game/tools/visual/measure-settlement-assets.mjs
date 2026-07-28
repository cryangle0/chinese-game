import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

function centroid(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let wx = 0;
  let wy = 0;
  let aSum = 0;
  let minX = 1e9;
  let minY = 1e9;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const a = png.data[(y * png.width + x) * 4 + 3];
      if (a < 16) continue;
      wx += x * a;
      wy += y * a;
      aSum += a;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!aSum) return null;
  return {
    file: path.basename(file),
    size: [png.width, png.height],
    bbox: [minX, minY, maxX, maxY],
    cx: +(wx / aSum).toFixed(2),
    cy: +(wy / aSum).toFixed(2),
    dx: +((wx / aSum) - png.width / 2).toFixed(2),
    dy: +((wy / aSum) - png.height / 2).toFixed(2),
    bottomPad: png.height - 1 - maxY,
    topPad: minY,
  };
}

const root = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/assets/theme-bundles';
for (const scene of ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic']) {
  const dir = path.join(root, scene);
  const files = fs.readdirSync(dir);
  const review = files.find((f) => /^resultReview\./i.test(f));
  const deco = files.find((f) => /^resultDecoration\./i.test(f));
  console.log(`\n${scene}`);
  if (review) console.log(' review', centroid(path.join(dir, review)));
  if (deco) console.log(' deco', centroid(path.join(dir, deco)));
  if (review && deco) {
    const r = centroid(path.join(dir, review));
    const d = centroid(path.join(dir, deco));
    // When boxes share center X, visual centers differ by scaled dx
    console.log(' visualCenterDeltaPx (deco.dx - review.dx):', +(d.dx - r.dx).toFixed(2));
  }
}

function soleY(png, x0, x1, y0, y1) {
  for (let y = y1; y >= y0; y -= 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (r > 140 && g > 80 && g < 200 && b < 120) return y;
    }
  }
  return null;
}

function platformTop(png) {
  for (let y = 500; y < 700; y += 1) {
    let hits = 0;
    for (let x = 140; x < 260; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = (r + g + b) / 3;
      if (lum > 90 && lum < 170 && Math.abs(r - g) < 40) hits += 1;
    }
    if (hits > 40) return y;
  }
  return null;
}

const base = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/settlement-fix';
const g = PNG.sync.read(fs.readFileSync(`${base}/treasure-1440x810.png`));
const p = PNG.sync.read(fs.readFileSync(`${base}/proto-treasure.png`));
console.log('\nsole game', soleY(g, 120, 280, 480, 650), 'proto', soleY(p, 120, 280, 480, 650));
console.log('platformTop game', platformTop(g), 'proto', platformTop(p));
