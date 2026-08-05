import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.resolve(
  process.env.CLASSIC_REWARD_SOURCE
    ?? path.join(
      projectRoot,
      'assets',
      'theme-bundles',
      'treasure',
      'feedbackCorrect.png',
    ),
);
const outputRoot = path.resolve(
  process.env.CLASSIC_REWARD_OUTPUT
    ?? path.join(
      projectRoot,
      'customer-media',
      'treasure',
      'classic-reward-gems',
    ),
);
const checkOnly = process.argv.includes('--check');

const ALPHA_THRESHOLD = 8;
const MIN_GEM_PIXELS = 2500;
const MAX_GEM_PIXELS = 5000;
const MAX_GEM_SIZE = 90;
const OUTPUT_SIZE = 96;
const EXPECTED_GEMS = 7;

const sourceBytes = await fs.readFile(sourcePath);
const source = PNG.sync.read(sourceBytes);
const components = findComponents(source)
  .filter((component) =>
    component.pixels >= MIN_GEM_PIXELS
    && component.pixels <= MAX_GEM_PIXELS
    && component.width <= MAX_GEM_SIZE
    && component.height <= MAX_GEM_SIZE)
  .sort((left, right) =>
    left.top - right.top || left.left - right.left);

if (components.length !== EXPECTED_GEMS) {
  throw new Error(
    `Expected ${EXPECTED_GEMS} reward gems, got ${components.length}`,
  );
}

const gems = components.map((component) => normalizeGem(source, component));
const encodedGems = gems.map((gem) => PNG.sync.write(gem.image));
const manifest = {
  version: 'classic-reward-gems-20260805',
  source: {
    file: path.basename(sourcePath),
    width: source.width,
    height: source.height,
    sha256: digest(sourceBytes),
  },
  outputSize: OUTPUT_SIZE,
  gems: gems.map((gem, index) => ({
    index,
    file: gemName(index),
    sourceBounds: gem.sourceBounds,
    outputBounds: gem.outputBounds,
    alphaPixels: gem.alphaPixels,
    bytes: encodedGems[index].length,
    sha256: digest(encodedGems[index]),
  })),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (checkOnly) {
  await verifyOutputs(encodedGems, manifestBytes);
  console.log(`Classic treasure reward gems verified: ${gems.length}`);
} else {
  await fs.mkdir(outputRoot, { recursive: true });
  const existing = await fs.readdir(outputRoot).catch(() => []);
  await Promise.all(existing
    .filter((name) => /^gem-\d+\.png$/i.test(name))
    .map((name) => fs.rm(path.join(outputRoot, name), { force: true })));
  await Promise.all(encodedGems.map((bytes, index) =>
    fs.writeFile(path.join(outputRoot, gemName(index)), bytes)));
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBytes);
  console.log(
    `Classic treasure reward gems built: ${gems.length} -> ${outputRoot}`,
  );
}

function findComponents(image) {
  const visited = new Uint8Array(image.width * image.height);
  const components = [];
  const indexOf = (x, y) => y * image.width + x;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const start = indexOf(x, y);
      if (
        visited[start]
        || image.data[start * 4 + 3] <= ALPHA_THRESHOLD
      ) continue;
      visited[start] = 1;
      const stack = [start];
      let left = x;
      let right = x;
      let top = y;
      let bottom = y;
      let pixels = 0;
      while (stack.length > 0) {
        const current = stack.pop();
        const currentX = current % image.width;
        const currentY = Math.floor(current / image.width);
        pixels += 1;
        left = Math.min(left, currentX);
        right = Math.max(right, currentX);
        top = Math.min(top, currentY);
        bottom = Math.max(bottom, currentY);
        [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ].forEach(([nextX, nextY]) => {
          if (
            nextX < 0
            || nextY < 0
            || nextX >= image.width
            || nextY >= image.height
          ) return;
          const next = indexOf(nextX, nextY);
          if (
            visited[next]
            || image.data[next * 4 + 3] <= ALPHA_THRESHOLD
          ) return;
          visited[next] = 1;
          stack.push(next);
        });
      }
      components.push({
        left,
        top,
        right,
        bottom,
        width: right - left + 1,
        height: bottom - top + 1,
        pixels,
      });
    }
  }
  return components;
}

function normalizeGem(source, component) {
  const image = new PNG({ width: OUTPUT_SIZE, height: OUTPUT_SIZE });
  const outputLeft = Math.floor((OUTPUT_SIZE - component.width) / 2);
  const outputTop = Math.floor((OUTPUT_SIZE - component.height) / 2);
  let alphaPixels = 0;
  for (let y = 0; y < component.height; y += 1) {
    for (let x = 0; x < component.width; x += 1) {
      const sourceOffset = (
        (component.top + y) * source.width + component.left + x
      ) * 4;
      const targetOffset = (
        (outputTop + y) * OUTPUT_SIZE + outputLeft + x
      ) * 4;
      image.data[targetOffset] = source.data[sourceOffset];
      image.data[targetOffset + 1] = source.data[sourceOffset + 1];
      image.data[targetOffset + 2] = source.data[sourceOffset + 2];
      image.data[targetOffset + 3] = source.data[sourceOffset + 3];
      if (source.data[sourceOffset + 3] > 0) alphaPixels += 1;
    }
  }
  return {
    image,
    sourceBounds: {
      x: component.left,
      y: component.top,
      width: component.width,
      height: component.height,
    },
    outputBounds: {
      x: outputLeft,
      y: outputTop,
      width: component.width,
      height: component.height,
    },
    alphaPixels,
  };
}

async function verifyOutputs(expectedGems, expectedManifest) {
  const actualManifest = await fs.readFile(path.join(outputRoot, 'manifest.json'));
  if (!actualManifest.equals(expectedManifest)) {
    throw new Error('Classic reward gem manifest is stale');
  }
  await Promise.all(expectedGems.map(async (bytes, index) => {
    const actual = await fs.readFile(path.join(outputRoot, gemName(index)));
    if (!actual.equals(bytes)) {
      throw new Error(`Classic reward gem ${index} is stale`);
    }
  }));
}

function gemName(index) {
  return `gem-${String(index).padStart(2, '0')}.png`;
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
