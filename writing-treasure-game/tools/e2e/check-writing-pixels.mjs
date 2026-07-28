import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const referenceRoot = path.join(root, 'tests', 'design-references');
const actualRoot = path.join(root, 'test-results', 'e2e');
const themes = ['desert', 'dinosaur', 'dunhuang'];
const maxMeanDelta = 0.16;
const maxChangedRatio = 0.38;
const maxStableMeanDelta = 0.055;
const maxStableChangedRatio = 0.12;
let failed = false;

function sample(image, x, y, channel) {
  const sourceX = Math.min(image.width - 1, Math.floor(x * image.width / 1440));
  const sourceY = Math.min(image.height - 1, Math.floor(y * image.height / 810));
  return image.data[(sourceY * image.width + sourceX) * 4 + channel];
}

for (const theme of themes) {
  const referencePath = path.join(referenceRoot, `writing-${theme}-result.png`);
  const actualPath = path.join(actualRoot, `desktop-writing-${theme}-result.png`);
  if (!fs.existsSync(referencePath) || !fs.existsSync(actualPath)) {
    throw new Error(`pixel comparison input missing for ${theme}`);
  }
  const reference = PNG.sync.read(fs.readFileSync(referencePath));
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  let delta = 0;
  let changed = 0;
  let stableDelta = 0;
  let stableChanged = 0;
  let stablePixels = 0;
  for (let y = 0; y < actual.height; y += 1) {
    for (let x = 0; x < actual.width; x += 1) {
      const offset = (y * actual.width + x) * 4;
      let pixelDelta = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        pixelDelta += Math.abs(actual.data[offset + channel] - sample(reference, x, y, channel));
      }
      delta += pixelDelta;
      if (pixelDelta / 3 > 40) changed += 1;
      const stableRegion = (y < 140 && x > 900)
        || (x > 1380)
        || (y > 760 && x > 900);
      const dynamic = !stableRegion;
      if (!dynamic) {
        stablePixels += 1;
        stableDelta += pixelDelta;
        if (pixelDelta / 3 > 40) stableChanged += 1;
      }
    }
  }
  const pixels = actual.width * actual.height;
  const meanDelta = delta / pixels / 3 / 255;
  const changedRatio = changed / pixels;
  const stableMeanDelta = stableDelta / stablePixels / 3 / 255;
  const stableChangedRatio = stableChanged / stablePixels;
  const passed = stableMeanDelta <= maxStableMeanDelta
    && stableChangedRatio <= maxStableChangedRatio;
  failed ||= !passed;
  console.log(`${theme}: full(mean=${meanDelta.toFixed(4)}, changed=${changedRatio.toFixed(4)}) `
    + `stable(mean=${stableMeanDelta.toFixed(4)}, changed=${stableChangedRatio.toFixed(4)}) `
    + `${passed ? 'PASS' : 'FAIL'}`);
}

if (failed) process.exit(1);
