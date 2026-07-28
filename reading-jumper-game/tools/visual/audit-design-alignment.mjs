import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const referenceDir = path.join(root, 'tests', 'design-references');
const actualDir = path.join(root, 'test-results', 'e2e');
const outputDir = path.join(root, 'test-results', 'design-audit');
const enforce = process.argv.includes('--enforce');

const gameplayMasks = [
  [0, 0, 300, 185],
  [1200, 0, 1440, 190],
  [380, 110, 1060, 275],
  [200, 370, 480, 450],
  [580, 370, 860, 450],
  [960, 370, 1240, 450],
  [540, 500, 900, 810],
];

const resultMasks = [
  [100, 45, 500, 230],
  [50, 170, 550, 690],
  [130, 690, 500, 800],
  [520, 145, 990, 650],
  [960, 145, 1400, 660],
  [330, 630, 1110, 750],
];

const introMasks = [
  [640, 430, 800, 670],
];

const cases = [
  ['intro', 'desktop-reading-intro', introMasks, 6.3, 22.2, 0.115],
  ['gameplay-mario', 'desktop-reading-theme-mario', gameplayMasks, 5, 22, 0.075],
  ['gameplay-deep-sea', 'desktop-reading-theme-deep-sea', gameplayMasks, 5, 18, 0.085],
  ['gameplay-space', 'desktop-reading-theme-space', gameplayMasks, 4.5, 16, 0.075],
  ['gameplay-poetry', 'desktop-reading-theme-poetry', gameplayMasks, 5.5, 22, 0.09],
  ['result-mario', 'desktop-reading-stage-result-mario', resultMasks, 3.5, 5.5, 0.045],
  ['result-deep-sea', 'desktop-reading-stage-result-deep-sea', resultMasks, 3.5, 5.5, 0.045],
  ['result-space', 'desktop-reading-stage-result-space', resultMasks, 3.5, 5.5, 0.045],
  ['result-food', 'desktop-reading-stage-result-food', resultMasks, 3.5, 5.5, 0.045],
  ['result-poetry', 'desktop-reading-result', resultMasks, 3.5, 5.5, 0.045],
];

function isMasked(x, y, masks) {
  return masks.some(([left, top, right, bottom]) => (
    x >= left && x < right && y >= top && y < bottom
  ));
}

async function readPng(file) {
  return PNG.sync.read(await fs.readFile(file));
}

function compare(reference, actual, masks) {
  if (reference.width !== actual.width || reference.height !== actual.height) {
    throw new Error(
      `dimension mismatch: ${reference.width}x${reference.height} `
      + `!= ${actual.width}x${actual.height}`,
    );
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  let pixels = 0;
  let absoluteSum = 0;
  let squaredSum = 0;
  let over16 = 0;
  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const offset = (y * reference.width + x) * 4;
      if (isMasked(x, y, masks)) continue;
      pixels += 1;
      let pixelMax = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(reference.data[offset + channel] - actual.data[offset + channel]);
        absoluteSum += delta;
        squaredSum += delta * delta;
        pixelMax = Math.max(pixelMax, delta);
      }
      if (pixelMax > 16) over16 += 1;
      diff.data[offset] = pixelMax;
      diff.data[offset + 1] = 0;
      diff.data[offset + 2] = 0;
      diff.data[offset + 3] = pixelMax ? 255 : 0;
    }
  }
  return {
    diff,
    metrics: {
      compared_pixels: pixels,
      mae: absoluteSum / (pixels * 3),
      rmse: Math.sqrt(squaredSum / (pixels * 3)),
      pixels_over_16_ratio: over16 / pixels,
    },
  };
}

await fs.mkdir(outputDir, { recursive: true });
const report = [];
let failed = false;
for (const [
  name, actualName, masks, maxMae, maxRmse, maxOver16,
] of cases) {
  try {
    const reference = await readPng(path.join(referenceDir, `${name}.png`));
    const actual = await readPng(path.join(actualDir, `${actualName}.png`));
    const { diff, metrics } = compare(reference, actual, masks);
    const passed = metrics.mae <= maxMae
      && metrics.rmse <= maxRmse
      && metrics.pixels_over_16_ratio <= maxOver16;
    failed ||= !passed;
    report.push({
      name, passed, ...metrics,
      limits: { mae: maxMae, rmse: maxRmse, pixels_over_16_ratio: maxOver16 },
    });
    await fs.writeFile(path.join(outputDir, `${name}-diff.png`), PNG.sync.write(diff));
  } catch (error) {
    failed = true;
    report.push({
      name, passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await fs.writeFile(
  path.join(outputDir, 'masked-metrics.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
for (const result of report) {
  if (result.error) {
    console.error(`FAIL ${result.name}: ${result.error}`);
    continue;
  }
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.name}: `
    + `MAE=${result.mae.toFixed(2)} RMSE=${result.rmse.toFixed(2)} `
    + `pixels>16=${(result.pixels_over_16_ratio * 100).toFixed(2)}%`,
  );
}
if (enforce && failed) process.exitCode = 1;
