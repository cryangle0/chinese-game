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
  'wrong-16-white_transparent_0.png',
);
const shellSourcePath = path.join(
  root,
  'tools',
  'assets',
  'sources',
  'dinosaur-wrong-shell.png',
);
const frameRoot = path.join(
  root,
  'customer-media',
  'dinosaur',
  'wrong-hatch-frames',
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(frameRoot, 'manifest.json'),
  'utf8',
));

test('uses the RunningHub GPT Image 2 transparent 16-frame source', () => {
  const sourceBytes = fs.readFileSync(sourcePath);
  const source = PNG.sync.read(sourceBytes);
  assert.equal(source.width, 2810);
  assert.equal(source.height, 2608);
  assert.equal(source.alpha, true);
  assert.equal(manifest.generation.provider, 'RunningHub');
  assert.equal(manifest.generation.model, 'gpt-image-2');
  assert.equal(manifest.generation.quality, 'high');
  assert.equal(manifest.source.file, path.basename(sourcePath));
  assert.equal(manifest.source.sha256, digest(sourceBytes));
  assert.equal(manifest.source.detectedComponents, 16);
});

test('separates emergence, jump, and chase run poses', () => {
  assert.equal(manifest.frames.length, 16);
  assert.equal(manifest.fps, 12);
  assert.deepEqual(manifest.phases, {
    emerge: { start: 0, end: 3, fps: 10, loop: false },
    jump: { start: 4, end: 7, fps: 10, loop: false },
    run: { start: 8, end: 15, fps: 12, loop: true },
  });
});

test('keeps every high-resolution dinosaur on one foot anchor', () => {
  assert.ok(manifest.frameWidth >= 700);
  assert.ok(manifest.frameHeight >= 390);
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
    assert.equal(frame.sha256, digest(bytes));
  });
});

test('exports one clean broken egg shell from the supplied asset', () => {
  const source = PNG.sync.read(fs.readFileSync(shellSourcePath));
  const shellBytes = fs.readFileSync(path.join(frameRoot, manifest.shell.file));
  const shell = PNG.sync.read(shellBytes);
  assert.equal(source.width, manifest.shell.sourceWidth);
  assert.equal(source.height, manifest.shell.sourceHeight);
  assert.equal(shell.width, manifest.shell.width);
  assert.equal(shell.height, manifest.shell.height);
  assert.ok(manifest.shell.sourceBounds.alphaPixels > 30000);
  assert.equal(manifest.shell.sha256, digest(shellBytes));
});

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
