import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? path.resolve(root, value.slice(prefix.length)) : fallback;
}

const baselineDir = option(
  'baseline-dir',
  path.join(root, 'tests', 'visual-baselines'),
);
const actualDir = option(
  'actual-dir',
  path.join(root, 'test-results', 'e2e'),
);
const outputDir = option(
  'output-dir',
  path.join(root, 'test-results', 'pixel-gate'),
);
const enforce = process.argv.includes('--enforce');
const selfTest = process.argv.includes('--self-test');

const gameplayMasks = [
  [0, 0, 300, 190],
  [1200, 0, 1440, 190],
  [340, 110, 1100, 275],
  [200, 370, 480, 450],
  [580, 370, 860, 450],
  [960, 370, 1240, 450],
  [500, 460, 940, 810],
];

const mobileGameplayMasks = [
  [0, 0, 200, 95],
  [640, 0, 844, 105],
  [220, 45, 625, 145],
  [85, 165, 300, 235],
  [315, 165, 530, 235],
  [545, 165, 760, 235],
  [300, 210, 545, 390],
];

const cases = [
  { name: 'desktop-reading-intro', masks: [[640, 430, 800, 670], [1090, 0, 1440, 230]] },
  ...['mario', 'deep-sea', 'space', 'food', 'poetry'].map((theme) => ({
    name: `desktop-reading-theme-${theme}`,
    masks: gameplayMasks,
  })),
  {
    name: 'desktop-reading-result',
    masks: [
      [290, 595, 470, 670],
      [50, 170, 560, 690],
      [145, 700, 370, 785],
      [570, 275, 970, 585],
      [1000, 245, 1370, 630],
      [335, 640, 1110, 735],
    ],
  },
  {
    name: 'mobile-reading-result',
    masks: [
      [165, 285, 280, 340],
      [20, 75, 340, 335],
      [90, 345, 220, 385],
      [330, 125, 565, 295],
      [565, 120, 805, 315],
      [235, 310, 610, 355],
    ],
  },
  { name: 'mobile-reading-intro', masks: [[375, 205, 470, 325], [630, 0, 844, 140]] },
  ...['mario', 'deep-sea', 'space', 'food', 'poetry'].map((theme) => ({
    name: `mobile-reading-theme-${theme}`,
    masks: mobileGameplayMasks,
  })),
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
  let comparedPixels = 0;
  let changedPixels = 0;
  let absoluteSum = 0;
  let squaredSum = 0;
  let maxChannelDiff = 0;

  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const offset = (y * reference.width + x) * 4;
      if (isMasked(x, y, masks)) {
        diff.data[offset] = 0;
        diff.data[offset + 1] = 0;
        diff.data[offset + 2] = 0;
        diff.data[offset + 3] = 0;
        continue;
      }
      comparedPixels += 1;
      let pixelMax = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(reference.data[offset + channel] - actual.data[offset + channel]);
        absoluteSum += delta;
        squaredSum += delta * delta;
        pixelMax = Math.max(pixelMax, delta);
        maxChannelDiff = Math.max(maxChannelDiff, delta);
      }
      if (pixelMax > 8) changedPixels += 1;
      diff.data[offset] = pixelMax;
      diff.data[offset + 1] = 0;
      diff.data[offset + 2] = 0;
      diff.data[offset + 3] = pixelMax > 0 ? 255 : 0;
    }
  }

  const channels = comparedPixels * 3;
  return {
    metrics: {
      compared_pixels: comparedPixels,
      mae: absoluteSum / channels,
      rmse: Math.sqrt(squaredSum / channels),
      max_channel_diff: maxChannelDiff,
      pixels_over_8_ratio: changedPixels / comparedPixels,
    },
    diff,
  };
}

function passes(metrics) {
  return metrics.mae <= 0.5
    && metrics.rmse <= 2
    && metrics.max_channel_diff <= 8
    && metrics.pixels_over_8_ratio === 0;
}

await fs.mkdir(outputDir, { recursive: true });
const report = [];
let failed = false;

for (const testCase of cases) {
  const fileName = `${testCase.name}.png`;
  try {
    const reference = await readPng(path.join(baselineDir, fileName));
    const actual = await readPng(path.join(actualDir, fileName));
    const { metrics, diff } = compare(reference, actual, testCase.masks);
    const passed = passes(metrics);
    failed ||= !passed;
    report.push({ name: testCase.name, passed, ...metrics });
    await fs.writeFile(
      path.join(outputDir, `${testCase.name}-diff.png`),
      PNG.sync.write(diff),
    );
  } catch (error) {
    failed = true;
    report.push({
      name: testCase.name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

if (selfTest) {
  const testCase = cases[0];
  const fileName = `${testCase.name}.png`;
  const reference = await readPng(path.join(baselineDir, fileName));
  const mutated = await readPng(path.join(baselineDir, fileName));
  const x = 10;
  const y = Math.floor(mutated.height / 2);
  const offset = (y * mutated.width + x) * 4;
  mutated.data[offset] = mutated.data[offset] === 255 ? 0 : 255;
  const { metrics } = compare(reference, mutated, testCase.masks);
  const mutationDetected = !passes(metrics);
  failed ||= !mutationDetected;
  report.push({
    name: 'self-test-single-pixel-mutation',
    passed: mutationDetected,
    ...metrics,
  });
}

await fs.writeFile(
  path.join(outputDir, 'metrics.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const result of report) {
  if (result.error) {
    console.error(`FAIL ${result.name}: ${result.error}`);
    continue;
  }
  const status = result.passed ? 'PASS' : 'FAIL';
  console.log(
    `${status} ${result.name}: MAE=${result.mae.toFixed(4)} `
    + `RMSE=${result.rmse.toFixed(4)} max=${result.max_channel_diff} `
    + `pixels>8=${(result.pixels_over_8_ratio * 100).toFixed(6)}%`,
  );
}

if (enforce && failed) process.exitCode = 1;
