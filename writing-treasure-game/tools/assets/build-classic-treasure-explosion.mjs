import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const defaultSource = path.resolve(
  projectRoot,
  '..',
  '\u6e38\u620f\u89c6\u9891',
  '\u5f85\u63d0\u4f9b\u7d20\u6750',
  '\u6316\u5b9d',
  '\u7ecf\u5178',
  '\u7206\u70b8\u5e8f\u5217\u5e27.png',
);
const sourcePath = path.resolve(process.env.CLASSIC_EXPLOSION_SOURCE ?? defaultSource);
const outputRoot = path.resolve(
  process.env.CLASSIC_EXPLOSION_OUTPUT
    ?? path.join(projectRoot, 'customer-media', 'treasure', 'classic-explosion-frames'),
);
const checkOnly = process.argv.includes('--check');

const ROW_FRAME_COUNTS = [9, 6, 6, 8];
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 224;
const FRAME_PADDING = 8;
const SEGMENT_ALPHA_THRESHOLD = 8;
const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 1024;

const sourceBytes = await fs.readFile(sourcePath);
const source = PNG.sync.read(sourceBytes);
if (source.width !== SOURCE_WIDTH || source.height !== SOURCE_HEIGHT) {
  throw new Error(
    `Unexpected classic explosion sheet size ${source.width}x${source.height}`,
  );
}

const frames = sliceFrames(source);
if (frames.length !== 29) {
  throw new Error(`Expected 29 classic explosion frames, got ${frames.length}`);
}

const encodedFrames = frames.map((frame) => PNG.sync.write(frame.image));
const manifest = {
  version: 'classic-explosion-20260805',
  source: {
    file: path.basename(sourcePath),
    width: source.width,
    height: source.height,
    sha256: digest(sourceBytes),
  },
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  fps: 24,
  frames: frames.map((frame, index) => ({
    index,
    file: frameName(index),
    sourceBounds: frame.sourceBounds,
    outputBounds: frame.outputBounds,
    alphaPixels: frame.alphaPixels,
    bytes: encodedFrames[index].length,
    sha256: digest(encodedFrames[index]),
  })),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (checkOnly) {
  await verifyOutputs(encodedFrames, manifestBytes);
  console.log(`Classic treasure explosion frames verified: ${frames.length}`);
} else {
  await fs.mkdir(outputRoot, { recursive: true });
  const existing = await fs.readdir(outputRoot).catch(() => []);
  await Promise.all(existing
    .filter((name) => /^frame-\d+\.png$/i.test(name))
    .map((name) => fs.rm(path.join(outputRoot, name), { force: true })));
  await Promise.all(encodedFrames.map((bytes, index) =>
    fs.writeFile(path.join(outputRoot, frameName(index)), bytes)));
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBytes);
  console.log(
    `Classic treasure explosion frames built: ${frames.length} -> ${outputRoot}`,
  );
}

function sliceFrames(sheet) {
  const rowBands = occupiedRuns(
    Array.from({ length: sheet.height }, (_, y) => rowOccupied(sheet, y)),
  );
  if (rowBands.length !== ROW_FRAME_COUNTS.length) {
    throw new Error(`Expected 4 occupied rows, got ${rowBands.length}`);
  }
  return rowBands.flatMap(([top, bottom], rowIndex) =>
    sliceRow(sheet, top, bottom, ROW_FRAME_COUNTS[rowIndex]));
}

function sliceRow(sheet, top, bottom, frameCount) {
  const occupied = Array.from(
    { length: sheet.width },
    (_, x) => columnOccupied(sheet, x, top, bottom),
  );
  const occupiedColumns = occupiedRuns(occupied);
  const first = occupiedColumns[0]?.[0];
  const last = occupiedColumns.at(-1)?.[1];
  if (first === undefined || last === undefined) {
    throw new Error('Classic explosion row is empty');
  }
  const gaps = occupiedRuns(occupied.map((value) => !value))
    .filter(([start, end]) => start > first && end < last)
    .map(([start, end]) => ({ start, end, length: end - start + 1 }))
    .sort((left, right) => right.length - left.length)
    .slice(0, frameCount - 1)
    .sort((left, right) => left.start - right.start);
  if (gaps.length !== frameCount - 1) {
    throw new Error(`Cannot split classic explosion row into ${frameCount} frames`);
  }
  const starts = [first, ...gaps.map((gap) => gap.end + 1)];
  const ends = [...gaps.map((gap) => gap.start - 1), last];
  return starts.map((start, index) =>
    normalizeFrame(sheet, start, top, ends[index], bottom));
}

function normalizeFrame(sheet, left, top, right, bottom) {
  const bounds = alphaBounds(sheet, left, top, right, bottom);
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  if (
    width > FRAME_WIDTH - FRAME_PADDING * 2
    || height > FRAME_HEIGHT - FRAME_PADDING * 2
  ) {
    throw new Error(`Classic explosion frame ${width}x${height} exceeds output canvas`);
  }
  const image = new PNG({ width: FRAME_WIDTH, height: FRAME_HEIGHT });
  const outputLeft = Math.floor((FRAME_WIDTH - width) / 2);
  const outputTop = FRAME_HEIGHT - FRAME_PADDING - height;
  let alphaPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = ((bounds.top + y) * sheet.width + bounds.left + x) * 4;
      const targetOffset = ((outputTop + y) * FRAME_WIDTH + outputLeft + x) * 4;
      image.data[targetOffset] = sheet.data[sourceOffset];
      image.data[targetOffset + 1] = sheet.data[sourceOffset + 1];
      image.data[targetOffset + 2] = sheet.data[sourceOffset + 2];
      image.data[targetOffset + 3] = sheet.data[sourceOffset + 3];
      if (sheet.data[sourceOffset + 3] > 0) alphaPixels += 1;
    }
  }
  return {
    image,
    sourceBounds: {
      x: bounds.left,
      y: bounds.top,
      width,
      height,
    },
    outputBounds: {
      x: outputLeft,
      y: outputTop,
      width,
      height,
    },
    alphaPixels,
  };
}

function alphaBounds(sheet, left, top, right, bottom) {
  let minX = right;
  let minY = bottom;
  let maxX = left;
  let maxY = top;
  let found = false;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (sheet.data[(y * sheet.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      found = true;
    }
  }
  if (!found) throw new Error('Classic explosion frame is fully transparent');
  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

function rowOccupied(sheet, y) {
  for (let x = 0; x < sheet.width; x += 1) {
    if (
      sheet.data[(y * sheet.width + x) * 4 + 3]
      > SEGMENT_ALPHA_THRESHOLD
    ) return true;
  }
  return false;
}

function columnOccupied(sheet, x, top, bottom) {
  for (let y = top; y <= bottom; y += 1) {
    if (
      sheet.data[(y * sheet.width + x) * 4 + 3]
      > SEGMENT_ALPHA_THRESHOLD
    ) return true;
  }
  return false;
}

function occupiedRuns(values) {
  const runs = [];
  let start = -1;
  values.forEach((value, index) => {
    if (value && start < 0) start = index;
    if (!value && start >= 0) {
      runs.push([start, index - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, values.length - 1]);
  return runs;
}

async function verifyOutputs(expectedFrames, expectedManifest) {
  const actualManifest = await fs.readFile(path.join(outputRoot, 'manifest.json'));
  if (!actualManifest.equals(expectedManifest)) {
    throw new Error('Classic explosion manifest is stale');
  }
  await Promise.all(expectedFrames.map(async (bytes, index) => {
    const actual = await fs.readFile(path.join(outputRoot, frameName(index)));
    if (!actual.equals(bytes)) {
      throw new Error(`Classic explosion frame ${index} is stale`);
    }
  }));
}

function frameName(index) {
  return `frame-${String(index).padStart(2, '0')}.png`;
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
