import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.join(
  root,
  'tools',
  'assets',
  'sources',
  'generated',
  'dinosaur-20260805',
  'transparent',
  'correct-24-white_transparent_0.png',
);
const digSourcePath = path.join(
  root,
  'tools',
  'assets',
  'sources',
  'dinosaur-dig-state.png',
);
const digOutputPath = path.join(
  root,
  'customer-media',
  'dinosaur',
  'dig.png',
);
const frameRoot = path.join(
  root,
  'customer-media',
  'dinosaur',
  'correct-hatch-frames',
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(frameRoot, 'manifest.json'),
  'utf8',
));

test('uses the RunningHub GPT Image 2 transparent 24-frame source', () => {
  const sourceBytes = fs.readFileSync(sourcePath);
  const source = PNG.sync.read(sourceBytes);
  assert.equal(source.width, 2880);
  assert.equal(source.height, 2880);
  assert.equal(source.alpha, true);
  assert.equal(manifest.generation.provider, 'RunningHub');
  assert.equal(manifest.generation.model, 'gpt-image-2');
  assert.equal(manifest.generation.quality, 'high');
  assert.equal(manifest.source.file, path.basename(sourcePath));
  assert.equal(manifest.source.sha256, digest(sourceBytes));
  assert.equal(manifest.source.columns, 6);
  assert.equal(manifest.source.rows, 4);
});

test('exports a smooth two-second hatch sequence plus final hold', () => {
  assert.equal(manifest.frames.length, 24);
  assert.equal(manifest.fps, 12);
  assert.equal(manifest.hatchFrame, 12);
  assert.equal(manifest.finalHoldMs, 700);
  assert.equal(manifest.frameWidth, 480);
  assert.equal(manifest.frameHeight, 532);
  assert.equal(manifest.anchor.x, 240);
  assert.equal(manifest.anchor.baselineY, 488);
});

test('keeps all frames nonblank on one stable transparent canvas', () => {
  manifest.frames.forEach((frame, index) => {
    const bytes = fs.readFileSync(path.join(frameRoot, frame.file));
    const image = PNG.sync.read(bytes);
    assert.equal(frame.index, index);
    assert.equal(image.width, manifest.frameWidth);
    assert.equal(image.height, manifest.frameHeight);
    assert.equal(frame.anchor.outputX, manifest.anchor.x);
    assert.equal(
      frame.anchor.outputBaselineY,
      manifest.anchor.baselineY,
    );
    assert.ok(frame.alphaPixels > 70000);
    assert.ok(frame.outputBounds.x >= 0);
    assert.ok(frame.outputBounds.y >= 0);
    assert.ok(
      frame.outputBounds.x + frame.outputBounds.width
        <= manifest.frameWidth,
    );
    assert.ok(
      frame.outputBounds.y + frame.outputBounds.height
        <= manifest.frameHeight,
    );
    assert.equal(frame.sha256, digest(bytes));
  });
});

test('anchors the hatchling head inside the first visible baby frame', () => {
  assert.equal(manifest.babyHead.frame, manifest.hatchFrame);
  assert.ok(manifest.babyHead.x > manifest.placementAnchor.x);
  assert.ok(manifest.babyHead.x < manifest.frameWidth);
  assert.ok(manifest.babyHead.y > 0);
  assert.ok(manifest.babyHead.y < manifest.anchor.baselineY);
  assert.equal(manifest.placementAnchor.x, 240);
  assert.equal(
    manifest.placementAnchor.baselineY,
    manifest.anchor.baselineY,
  );
});

test('keeps the supplied transparent digging state unchanged', () => {
  const sourceBytes = fs.readFileSync(digSourcePath);
  const outputBytes = fs.readFileSync(digOutputPath);
  assert.deepEqual(outputBytes, sourceBytes);
});

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
