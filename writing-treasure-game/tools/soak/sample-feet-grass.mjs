/**
 * Sample screenshot pixels directly: find shoe sole Y and grass top Y in deer column.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-ground');

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'px-sample', hypothesisId: 'PX',
      location: 'sample-feet-grass.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function sample(file, game) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const w = png.width; const h = png.height;
  const sx = w / 1440; const sy = h / 810;
  const cx = Math.round(720 * sx);

  // Scan center±40 for brown shoe sole (lowest brown cluster)
  let shoeY = null;
  for (let y = h - 1; y > h * 0.4; y -= 1) {
    let brown = 0;
    for (let x = cx - Math.round(50 * sx); x < cx + Math.round(50 * sx); x += 1) {
      const i = (y * w + x) * 4;
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      // brown shoes
      if (r > 90 && r < 170 && g > 45 && g < 110 && b < 80 && r > g && g > b) brown += 1;
    }
    if (brown >= 8) { shoeY = y; break; }
  }

  // Grass top: leftmost/rightmost of deer, find first green scallop from bottom in side columns
  function grassAt(x0, x1) {
    let gy = null;
    for (let y = h - 1; y > h * 0.5; y -= 1) {
      let green = 0; let n = 0;
      for (let x = x0; x < x1; x += 1) {
        n += 1;
        const i = (y * w + x) * 4;
        const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
        if (g > 110 && g > r + 30 && g > b + 25 && r < 120) green += 1;
      }
      if (n && green / n > 0.15) gy = y;
      else if (gy != null && green / n < 0.05) break;
    }
    return gy;
  }

  const grassL = grassAt(Math.round(80 * sx), Math.round(400 * sx));
  const grassR = grassAt(Math.round(1040 * sx), Math.round(1360 * sx));
  const grassY = grassL != null && grassR != null
    ? Math.round((grassL + grassR) / 2)
    : (grassL ?? grassR);

  // Also: in deer column, find topmost green BELOW shoes (grass under character)
  let grassUnder = null;
  if (shoeY != null) {
    for (let y = shoeY; y < h; y += 1) {
      let green = 0;
      for (let x = cx - 40; x < cx + 40; x += 1) {
        const i = (y * w + x) * 4;
        const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
        if (g > 110 && g > r + 30 && g > b + 25 && r < 120) green += 1;
      }
      if (green >= 10) { grassUnder = y; break; }
    }
  }

  const shoeDesign = shoeY != null ? +(shoeY / sy).toFixed(1) : null;
  const grassDesign = grassY != null ? +(grassY / sy).toFixed(1) : null;
  const grassUnderDesign = grassUnder != null ? +(grassUnder / sy).toFixed(1) : null;
  const gap = shoeDesign != null && grassDesign != null
    ? +(grassDesign - shoeDesign).toFixed(1)
    : null;

  return {
    game,
    shoeDesign,
    grassDesign,
    grassUnderDesign,
    gap,
    // positive gap => shoe above grass => move deer DOWN by gap (cocosY -= gap)
    moveCocosY: gap != null ? +(-gap).toFixed(1) : null,
    px: { shoeY, grassY, grassL, grassR, grassUnder, w, h },
  };
}

const reading = sample(path.join(outDir, 'v2-reading.png'), 'reading');
const writing = sample(path.join(outDir, 'v2-writing.png'), 'writing');
const evidence = { reading, writing };
fs.writeFileSync(path.join(outDir, 'PX-SAMPLE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await post('pixel sample feet vs grass', evidence);
