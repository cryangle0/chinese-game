import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const frameRoot = path.join(
  root,
  'customer-media',
  'treasure',
  'classic-explosion-frames',
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(frameRoot, 'manifest.json'),
  'utf8',
));

test('cuts the supplied classic explosion into 29 normalized frames', () => {
  assert.equal(manifest.frames.length, 29);
  assert.equal(manifest.frameWidth, 256);
  assert.equal(manifest.frameHeight, 224);
  assert.equal(manifest.fps, 24);
  manifest.frames.forEach((frame, index) => {
    assert.equal(frame.index, index);
    assert.ok(frame.alphaPixels > 0);
    assert.ok(frame.outputBounds.x >= 8);
    assert.ok(frame.outputBounds.y >= 8);
    assert.ok(
      frame.outputBounds.x + frame.outputBounds.width <= manifest.frameWidth - 8,
    );
    assert.ok(
      frame.outputBounds.y + frame.outputBounds.height <= manifest.frameHeight - 8,
    );
  });
});

test('keeps every frame transparent and bottom-center aligned', () => {
  manifest.frames.forEach((frame) => {
    const image = PNG.sync.read(fs.readFileSync(path.join(frameRoot, frame.file)));
    assert.equal(image.width, manifest.frameWidth);
    assert.equal(image.height, manifest.frameHeight);
    assert.equal(
      frame.outputBounds.y + frame.outputBounds.height,
      manifest.frameHeight - 8,
    );
  });
});

test('preserves the grow-peak-dissipate progression', () => {
  const areas = manifest.frames.map((frame) => frame.alphaPixels);
  const peak = Math.max(...areas);
  assert.ok(areas[0] < peak * 0.08);
  assert.ok(areas[12] > areas[0] * 20);
  assert.ok(areas.at(-1) < peak * 0.04);
});
