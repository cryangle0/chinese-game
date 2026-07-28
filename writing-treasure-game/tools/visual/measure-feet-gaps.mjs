import fs from 'fs';
import { PNG } from 'pngjs';

function load(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function charSole(png, x0, x1) {
  for (let y = 700; y >= 420; y -= 1) {
    let hits = 0;
    let sumX = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      // warm character pixels (deer/orange/costume)
      if (r > 160 && g > 70 && g < 200 && b < 140 && r > b + 30) {
        hits += 1;
        sumX += x;
      }
    }
    if (hits > 20) return { y, cx: +(sumX / hits).toFixed(1), hits };
  }
  return null;
}

function platformBand(png, x0, x1, y0, y1) {
  let best = null;
  for (let y = y0; y < y1; y += 1) {
    let count = 0;
    let sumX = 0;
    let minX = 1e9;
    let maxX = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = (r + g + b) / 3;
      if (lum > 60 && lum < 160 && Math.abs(r - g) < 50) {
        count += 1;
        sumX += x;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    if (count > 70 && maxX - minX > 90) {
      if (!best || count > best.count) {
        best = { y, cx: +(sumX / count).toFixed(1), w: maxX - minX, count };
      }
    }
  }
  return best;
}

const base = 'test-results/settlement-fix';
const scenes = {
  treasure: { x0: 80, x1: 300 },
  desert: { x0: 60, x1: 320 },
  dinosaur: { x0: 40, x1: 280 },
  dunhuang: { x0: 60, x1: 320 },
  magic: { x0: 40, x1: 300 },
};

for (const [scene, box] of Object.entries(scenes)) {
  const file = `${base}/${scene}-1440x810.png`;
  if (!fs.existsSync(file)) {
    console.log(scene, 'missing shot');
    continue;
  }
  const png = load(file);
  const sole = charSole(png, box.x0, box.x1);
  const plat = platformBand(png, box.x0, box.x1, 520, 720);
  const gap = sole && plat ? plat.y - sole.y : null;
  console.log(scene, { sole, plat, gapPx: gap, nudgeTop: gap });
}
