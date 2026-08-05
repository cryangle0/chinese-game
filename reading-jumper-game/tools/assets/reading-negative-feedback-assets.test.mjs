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

function populatedPixels(
  image,
  frameIndex = 0,
  frameWidth = image.width,
  frameHeight = image.height,
  columns = 1,
) {
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

function sizableComponents(
  image,
  frameIndex = 0,
  frameWidth = image.width,
  frameHeight = image.height,
  columns = 1,
) {
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

test('cuts 26 lossless standalone squid frames from the 9/7/5/5 source', async (t) => {
  const outputRoot = await temporaryOutputRoot(t);
  const deepSeaRoot = path.join(outputRoot, 'deep-sea');
  await fs.mkdir(deepSeaRoot, { recursive: true });
  await fs.writeFile(path.join(deepSeaRoot, 'ink-squid-sheet.png'), 'legacy');
  const report = await buildReadingNegativeFeedbackAssets({ outputRoot });

  assert.deepEqual(report.squid.source, { width: 1536, height: 1024 });
  assert.deepEqual(report.squid.rowFrames, [9, 7, 5, 5]);
  assert.equal(report.squid.frames, 26);
  assert.equal(report.squid.frameWidth, 261);
  assert.equal(report.squid.frameHeight, 241);
  assert.deepEqual(report.squid.playback, {
    fps: 24,
    popupFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    repositionFrame: 12,
    sprayFrames: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
    excludedFrames: [9, 10, 11],
  });
  assert.equal(report.squid.directory, 'ink-squid-frames');
  const frameRoot = path.join(deepSeaRoot, report.squid.directory);
  const manifest = JSON.parse(await fs.readFile(
    path.join(frameRoot, 'manifest.json'),
    'utf8',
  ));
  assert.equal(manifest.source.name, '墨鱼喷汁雪碧图.png');
  assert.equal(manifest.frames.length, 26);
  assert.equal(manifest.fps, 24);
  assert.deepEqual(manifest.anchor, { x: 260, y: 0 });
  assert.deepEqual(manifest.playback, {
    popupFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    repositionFrame: 12,
    sprayFrames: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
    excludedFrames: [9, 10, 11],
  });

  const frames = [];
  for (let frameIndex = 0; frameIndex < 26; frameIndex += 1) {
    const frame = PNG.sync.read(await fs.readFile(path.join(
      frameRoot,
      `frame-${String(frameIndex).padStart(2, '0')}.png`,
    )));
    frames.push(frame);
    assert.deepEqual(
      { width: frame.width, height: frame.height },
      { width: 261, height: 241 },
    );
    assert.ok(
      populatedPixels(frame) > 0,
      `squid frame ${frameIndex} should contain source pixels`,
    );
  }
  assert.equal(
    sizableComponents(frames[25]).length,
    8,
    'last spray frame should preserve the body and all seven detached ink droplets',
  );
  const popupAreas = manifest.playback.popupFrames.map(
    (frameIndex) => populatedPixels(frames[frameIndex]),
  );
  assert.ok(
    popupAreas.every((area, index) => index === 0 || area > popupAreas[index - 1]),
    'popup playback should grow continuously without a shrinking restart frame',
  );
  assert.ok(
    populatedPixels(frames[9]) < populatedPixels(frames[8]) * 0.6,
    'excluded frame 9 should document the source size reset after popup frame 8',
  );
  assert.ok(
    Array.from({ length: frames[25].height }, (_, y) =>
      frames[25].data[(y * frames[25].width) * 4 + 3])
      .some((alpha) => alpha > alphaThreshold),
    'last spray frame should preserve the source pixel at the far-left edge',
  );
  await assert.rejects(
    fs.access(path.join(deepSeaRoot, 'ink-squid-sheet.png')),
    { code: 'ENOENT' },
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
  const squidPath = path.join(
    outputRoot,
    'deep-sea',
    'ink-squid-frames',
    'frame-00.png',
  );
  const staleBytes = Buffer.from(await fs.readFile(squidPath));
  staleBytes[staleBytes.length - 1] ^= 0xff;
  await fs.writeFile(squidPath, staleBytes);

  await assert.rejects(
    buildReadingNegativeFeedbackAssets({ outputRoot, check: true }),
    /frame-00\.png is stale/,
  );
  assert.deepEqual(await fs.readFile(squidPath), staleBytes);
});
