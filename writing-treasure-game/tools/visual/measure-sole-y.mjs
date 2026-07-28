import fs from 'fs';
import { PNG } from 'pngjs';

function load(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

/** Lowest row with enough orange/costume pixels in band. */
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

const base = 'test-results/settlement-fix';
const cases = [
  ['treasure', 120, 280],
  ['desert', 100, 300],
  ['dinosaur', 80, 260],
  ['dunhuang', 100, 300],
  ['magic', 80, 280],
];

for (const [scene, x0, x1] of cases) {
  const game = load(`${base}/${scene}-1440x810.png`);
  const sole = soleY(game, x0, x1);
  console.log(scene, 'soleY', sole);
}

const proto = load(`${base}/proto-treasure.png`);
console.log('proto-treasure soleY', soleY(proto, 120, 280));
