import fs from 'fs';
import { PNG } from 'pngjs';

function load(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function findBlue(png) {
  let minX = 1e9;
  let maxX = 0;
  let minY = 1e9;
  let maxY = 0;
  let n = 0;
  for (let y = 640; y < 720; y += 1) {
    for (let x = 40; x < 400; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (b > 150 && b > r + 40 && b > g + 20) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        n += 1;
      }
    }
  }
  return n ? {
    minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, n,
  } : null;
}

function findPedestal(png) {
  let best = null;
  for (let y = 560; y < 680; y += 1) {
    let count = 0;
    let sumX = 0;
    let minX = 1e9;
    let maxX = 0;
    for (let x = 60; x < 320; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = (r + g + b) / 3;
      if (lum > 70 && lum < 140 && r > g && g > b) {
        count += 1;
        sumX += x;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    if (count > 80 && (maxX - minX) > 100) {
      const cx = sumX / count;
      if (!best || count > best.count) best = { y, cx, w: maxX - minX, count, minX, maxX };
    }
  }
  return best;
}

function charSole(png) {
  for (let y = 620; y >= 480; y -= 1) {
    let hits = 0;
    let sumX = 0;
    for (let x = 80; x < 300; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (r > 180 && g > 90 && g < 170 && b < 100) {
        hits += 1;
        sumX += x;
      }
    }
    if (hits > 25) return { y, cx: sumX / hits, hits };
  }
  return null;
}

const g = load('test-results/settlement-fix/treasure-1440x810.png');
const p = load('test-results/settlement-fix/proto-treasure.png');
console.log('game blue', findBlue(g));
console.log('proto blue', findBlue(p));
console.log('game pedestal', findPedestal(g));
console.log('proto pedestal', findPedestal(p));
console.log('game sole', charSole(g));
console.log('proto sole', charSole(p));
