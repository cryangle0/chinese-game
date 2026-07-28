import fs from 'fs';
import { PNG } from 'pngjs';

function load(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function soleY(png, x0, x1) {
  for (let y = 650; y >= 450; y -= 1) {
    let hits = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (r > 180 && g > 90 && g < 170 && b < 100) hits += 1;
    }
    if (hits > 25) return y;
  }
  return null;
}

/** First wide elliptical stone/wood band below character mid. */
function platformTop(png, x0, x1, yStart) {
  for (let y = yStart; y < Math.min(750, yStart + 120); y += 1) {
    let stone = 0;
    let minX = 1e9;
    let maxX = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = (r + g + b) / 3;
      // stone / wood pedestal tones
      if (lum > 85 && lum < 175 && r >= g - 10 && g >= b - 5 && Math.abs(r - b) < 70) {
        stone += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    if (stone > 55 && maxX - minX > 110) return { y, w: maxX - minX, stone };
  }
  return null;
}

const base = 'test-results/settlement-fix';
const cases = [
  ['treasure', 120, 280],
  ['desert', 100, 320],
  ['dinosaur', 70, 270],
  ['dunhuang', 100, 320],
  ['magic', 70, 280],
];

for (const [scene, x0, x1] of cases) {
  const png = load(`${base}/${scene}-1440x810.png`);
  const sole = soleY(png, x0, x1);
  const plat = sole ? platformTop(png, x0, x1, sole - 5) : null;
  const gap = sole != null && plat ? plat.y - sole : null;
  console.log(JSON.stringify({ scene, sole, plat, gap, needNudgeDown: gap != null && gap > 8 }));
}

const proto = load(`${base}/proto-treasure.png`);
const sole = soleY(proto, 120, 280);
const plat = platformTop(proto, 120, 280, sole - 5);
console.log(JSON.stringify({
  scene: 'proto-treasure', sole, plat, gap: plat && sole != null ? plat.y - sole : null,
}));
