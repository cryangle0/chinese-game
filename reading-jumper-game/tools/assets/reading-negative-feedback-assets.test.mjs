import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';
import { buildReadingNegativeFeedbackAssets } from './build-reading-negative-feedback-assets.mjs';

const alphaThreshold = 8;

async function temporaryOutputRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reading-negative-feedback-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function populatedPixels(image, frameIndex, frameWidth, frameHeight, columns) {
  const startX = frameIndex % columns * frameWidth;
  const startY = Math.floor(frameIndex / columns) * frameHeight;
  let pixels = 0;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      if (image.data[((startY + y) * image.width + startX + x) * 4 + 3] > alphaThreshold) {
        pixels += 1;
      }
    }
  }
  return pixels;
}

function sizableComponents(image, frameIndex, frameWidth, frameHeight, columns) {
  const startX = frameIndex % columns * frameWidth;
  const startY = Math.floor(frameIndex / columns) * frameHeight;
  const seen = new Uint8Array(frameWidth * frameHeight);
  const components = [];

  for (let localY = 0; localY < frameHeight; localY += 1) {
    for (let localX = 0; localX < frameWidth; localX += 1) {
      const localIndex = localY * frameWidth + localX;
      const alpha = image.data[
        ((startY + localY) * image.width + startX + localX) * 4 + 3
      ];
      if (seen[localIndex] || alpha <= alphaThreshold) continue;

      let pixels = 0;
      const queue = [localIndex];
      seen[localIndex] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        const x = index % frameWidth;
        const y = Math.floor(index / frameWidth);
        pixels += 1;
        for (const [nextX, nextY] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]) {
          if (nextX < 0 || nextX >= frameWidth || nextY < 0 || nextY >= frameHeight) {
            continue;
          }
          const nextIndex = nextY * frameWidth + nextX;
          const nextAlpha = image.data[
            ((startY + nextY) * image.width + startX + nextX) * 4 + 3
          ];
          if (seen[nextIndex] || nextAlpha <= alphaThreshold) continue;
          seen[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }
      if (pixels >= 8) components.push(pixels);
    }
  }
  return components;
}

test('builds 26 populated squid frames from the 9/7/5/5 packed source', async (t) => {
  const outputRoot = await temporaryOutputRoot(t);
  const report = await buildReadingNegativeFeedbackAssets({ outputRoot });

  assert.deepEqual(report.squid.source, { width: 1536, height: 1024 });
  assert.deepEqual(report.squid.rowFrames, [9, 7, 5, 5]);
  assert.equal(report.squid.frames, 26);
  assert.equal(report.squid.frameWidth, 256);
  assert.equal(report.squid.frameHeight, 256);
  assert.equal(report.squid.columns, 5);
  assert.equal(report.squid.rows, 6);

  const sheet = PNG.sync.read(
    await fs.readFile(path.join(outputRoot, 'deep-sea', 'ink-squid-sheet.png')),
  );
  assert.deepEqual({ width: sheet.width, height: sheet.height }, {
    width: 1280,
    height: 1536,
  });
  for (let frameIndex = 0; frameIndex < 26; frameIndex += 1) {
    assert.ok(
      populatedPixels(sheet, frameIndex, 256, 256, 5) > 0,
      `squid frame ${frameIndex} should contain source pixels`,
    );
  }
  for (let frameIndex = 26; frameIndex < 30; frameIndex += 1) {
    assert.equal(
      populatedPixels(sheet, frameIndex, 256, 256, 5),
      0,
      `unused squid cell ${frameIndex} should remain transparent`,
    );
  }
  assert.ok(
    sizableComponents(sheet, 25, 256, 256, 5).length >= 2,
    'last spray frame should preserve detached ink droplets',
  );
});

test('builds poetry penalty from the supplied clean brush source', async (t) => {
  const outputRoot = await temporaryOutputRoot(t);
  const report = await buildReadingNegativeFeedbackAssets({ outputRoot });

  assert.equal(report.poetry.sourceName, '负反馈-金币素材.png');
  assert.equal(report.poetry.hasSeparateInkTerminal, true);
  assert.ok(report.poetry.width > 0);
  assert.ok(report.poetry.height > report.poetry.width);
  assert.ok(report.poetry.bytes < 150_000);

  const brush = PNG.sync.read(
    await fs.readFile(path.join(outputRoot, 'poetry', 'penalty.png')),
  );
  assert.deepEqual(
    { width: brush.width, height: brush.height },
    { width: report.poetry.width, height: report.poetry.height },
  );
  assert.ok(populatedPixels(brush, 0, brush.width, brush.height, 1) > 0);
});

test('--check validates outputs without rewriting stale files', async (t) => {
  const outputRoot = await temporaryOutputRoot(t);
  await buildReadingNegativeFeedbackAssets({ outputRoot });
  const squidPath = path.join(outputRoot, 'deep-sea', 'ink-squid-sheet.png');
  const staleBytes = Buffer.from(await fs.readFile(squidPath));
  staleBytes[staleBytes.length - 1] ^= 0xff;
  await fs.writeFile(squidPath, staleBytes);

  await assert.rejects(
    buildReadingNegativeFeedbackAssets({ outputRoot, check: true }),
    /ink-squid-sheet\.png is stale/,
  );
  assert.deepEqual(await fs.readFile(squidPath), staleBytes);
});
