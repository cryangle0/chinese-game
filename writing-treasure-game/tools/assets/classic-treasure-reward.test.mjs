import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const gemRoot = path.join(
  root,
  'customer-media',
  'treasure',
  'classic-reward-gems',
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(gemRoot, 'manifest.json'),
  'utf8',
));

test('extracts every supplied reward gem into an independent transparent image', () => {
  assert.equal(manifest.gems.length, 7);
  assert.equal(manifest.outputSize, 96);
  manifest.gems.forEach((gem, index) => {
    assert.equal(gem.index, index);
    assert.ok(gem.alphaPixels > 2500);
    assert.ok(gem.outputBounds.x >= 0);
    assert.ok(gem.outputBounds.y >= 0);
    assert.ok(
      gem.outputBounds.x + gem.outputBounds.width <= manifest.outputSize,
    );
    assert.ok(
      gem.outputBounds.y + gem.outputBounds.height <= manifest.outputSize,
    );
    const image = PNG.sync.read(fs.readFileSync(path.join(gemRoot, gem.file)));
    assert.equal(image.width, manifest.outputSize);
    assert.equal(image.height, manifest.outputSize);
  });
});

test('keeps gem source crops distinct and excludes the character artwork', () => {
  const sourceBounds = new Set(manifest.gems.map((gem) =>
    JSON.stringify(gem.sourceBounds)));
  assert.equal(sourceBounds.size, manifest.gems.length);
  manifest.gems.forEach((gem) => {
    assert.ok(gem.sourceBounds.width < 90);
    assert.ok(gem.sourceBounds.height < 90);
  });
});
