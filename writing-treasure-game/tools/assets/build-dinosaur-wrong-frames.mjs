import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.resolve(
  process.env.DINOSAUR_WRONG_SOURCE
    ?? path.join(
      projectRoot,
      'tools',
      'assets',
      'sources',
      'dinosaur-wrong-sprite.png',
    ),
);
const shellSourcePath = path.resolve(
  process.env.DINOSAUR_WRONG_SHELL_SOURCE
    ?? path.join(
      projectRoot,
      'tools',
      'assets',
      'sources',
      'dinosaur-wrong-shell.png',
    ),
);
const outputRoot = path.resolve(
  process.env.DINOSAUR_WRONG_OUTPUT
    ?? path.join(
      projectRoot,
      'customer-media',
      'dinosaur',
      'wrong-hatch-frames',
    ),
);
const checkOnly = process.argv.includes('--check');

const VERSION = 'dinosaur-wrong-hatch-20260805-v1';
const SOURCE_WIDTH = 617;
const SOURCE_HEIGHT = 404;
const FPS = 8;
const OUTPUT_PADDING = 8;
const SOURCE_CELLS = [
  cell(0, 0, 154, 202),
  cell(154, 0, 155, 202),
  cell(309, 0, 154, 202),
  cell(463, 0, 154, 202),
  cell(0, 202, 154, 202),
  cell(154, 202, 155, 202),
  cell(309, 202, 154, 202),
  cell(463, 202, 154, 202),
];

const sourceBytes = await fs.readFile(sourcePath);
const source = PNG.sync.read(sourceBytes);
if (source.width !== SOURCE_WIDTH || source.height !== SOURCE_HEIGHT) {
  throw new Error(
    `Unexpected dinosaur wrong sheet size ${source.width}x${source.height}`,
  );
}

const frameGeometry = SOURCE_CELLS.map((sourceCell, index) => {
  const sourceBounds = alphaBounds(source, sourceCell);
  return {
    index,
    sourceCell,
    sourceBounds,
    sourceAnchorX: footAnchorX(source, sourceBounds),
    sourceBaselineY: sourceBounds.y + sourceBounds.height - 1,
  };
});
const relativeExtents = frameGeometry.map((frame) => ({
  left: frame.sourceBounds.x - frame.sourceAnchorX,
  right: frame.sourceBounds.x + frame.sourceBounds.width - 1
    - frame.sourceAnchorX,
  top: frame.sourceBounds.y - frame.sourceBaselineY,
  bottom: frame.sourceBounds.y + frame.sourceBounds.height - 1
    - frame.sourceBaselineY,
}));
const minLeft = Math.min(...relativeExtents.map((value) => value.left));
const maxRight = Math.max(...relativeExtents.map((value) => value.right));
const minTop = Math.min(...relativeExtents.map((value) => value.top));
const maxBottom = Math.max(...relativeExtents.map((value) => value.bottom));
const frameWidth = maxRight - minLeft + 1 + OUTPUT_PADDING * 2;
const frameHeight = maxBottom - minTop + 1 + OUTPUT_PADDING * 2;
const outputAnchorX = OUTPUT_PADDING - minLeft;
const outputBaselineY = OUTPUT_PADDING - minTop;

const frames = frameGeometry.map((frame) => {
  const image = renderFrame(
    source,
    frame,
    frameWidth,
    frameHeight,
    outputAnchorX,
    outputBaselineY,
  );
  return {
    ...frame,
    image,
    outputBounds: alphaBounds(image, cell(0, 0, frameWidth, frameHeight)),
  };
});
const encodedFrames = frames.map((frame) => PNG.sync.write(frame.image));

const shellSourceBytes = await fs.readFile(shellSourcePath);
const shellSource = PNG.sync.read(shellSourceBytes);
const shellBounds = alphaBounds(
  shellSource,
  cell(0, 0, shellSource.width, shellSource.height),
);
const shell = cropImage(shellSource, shellBounds);
const shellBytes = PNG.sync.write(shell);

const manifest = {
  version: VERSION,
  source: {
    file: path.basename(sourcePath),
    width: source.width,
    height: source.height,
    sha256: digest(sourceBytes),
  },
  frameWidth,
  frameHeight,
  fps: FPS,
  anchor: {
    x: outputAnchorX,
    baselineY: outputBaselineY,
  },
  shell: {
    file: 'shell.png',
    width: shell.width,
    height: shell.height,
    sourceFile: path.basename(shellSourcePath),
    sourceWidth: shellSource.width,
    sourceHeight: shellSource.height,
    sourceBounds: shellBounds,
    sha256: digest(shellBytes),
  },
  frames: frames.map((frame, index) => ({
    index,
    file: frameName(index),
    sourceCell: frame.sourceCell,
    sourceBounds: frame.sourceBounds,
    outputBounds: frame.outputBounds,
    anchor: {
      sourceX: frame.sourceAnchorX,
      sourceBaselineY: frame.sourceBaselineY,
      outputX: outputAnchorX,
      outputBaselineY,
    },
    alphaPixels: frame.outputBounds.alphaPixels,
    bytes: encodedFrames[index].length,
    sha256: digest(encodedFrames[index]),
  })),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (checkOnly) {
  await verifyOutputs(encodedFrames, shellBytes, manifestBytes);
  console.log(
    `Dinosaur wrong frames verified: ${frames.length} `
      + `(${frameWidth}x${frameHeight})`,
  );
} else {
  await fs.mkdir(outputRoot, { recursive: true });
  const existing = await fs.readdir(outputRoot).catch(() => []);
  await Promise.all(existing
    .filter((name) => /^frame-\d+\.png$/i.test(name))
    .map((name) => fs.rm(path.join(outputRoot, name), { force: true })));
  await Promise.all(encodedFrames.map((bytes, index) =>
    fs.writeFile(path.join(outputRoot, frameName(index)), bytes)));
  await fs.writeFile(path.join(outputRoot, 'shell.png'), shellBytes);
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBytes);
  console.log(
    `Dinosaur wrong frames built: ${frames.length} `
      + `(${frameWidth}x${frameHeight}) -> ${outputRoot}`,
  );
}

function renderFrame(
  sheet,
  frame,
  width,
  height,
  anchorX,
  baselineY,
) {
  const image = new PNG({ width, height });
  const bounds = frame.sourceBounds;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const sourceOffset = (y * sheet.width + x) * 4;
      if (sheet.data[sourceOffset + 3] === 0) continue;
      const targetX = anchorX + x - frame.sourceAnchorX;
      const targetY = baselineY + y - frame.sourceBaselineY;
      if (
        targetX < 0
        || targetY < 0
        || targetX >= width
        || targetY >= height
      ) {
        throw new Error(`Dinosaur wrong frame ${frame.index} escaped output`);
      }
      copyPixel(sheet, sourceOffset, image, (targetY * width + targetX) * 4);
    }
  }
  return image;
}

function cropImage(sourceImage, bounds) {
  const image = new PNG({ width: bounds.width, height: bounds.height });
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceOffset = (
        (bounds.y + y) * sourceImage.width + bounds.x + x
      ) * 4;
      copyPixel(sourceImage, sourceOffset, image, (y * image.width + x) * 4);
    }
  }
  return image;
}

function copyPixel(sourceImage, sourceOffset, targetImage, targetOffset) {
  targetImage.data[targetOffset] = sourceImage.data[sourceOffset];
  targetImage.data[targetOffset + 1] = sourceImage.data[sourceOffset + 1];
  targetImage.data[targetOffset + 2] = sourceImage.data[sourceOffset + 2];
  targetImage.data[targetOffset + 3] = sourceImage.data[sourceOffset + 3];
}

function alphaBounds(image, sourceCell) {
  let minX = sourceCell.x + sourceCell.width;
  let minY = sourceCell.y + sourceCell.height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
  const right = sourceCell.x + sourceCell.width;
  const bottom = sourceCell.y + sourceCell.height;
  for (let y = sourceCell.y; y < bottom; y += 1) {
    for (let x = sourceCell.x; x < right; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha === 0) continue;
      alphaPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (alphaPixels === 0) {
    throw new Error(
      `Dinosaur source cell ${sourceCell.x},${sourceCell.y} is transparent`,
    );
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    alphaPixels,
  };
}

function footAnchorX(image, bounds) {
  const bandTop = bounds.y + Math.floor(bounds.height * 0.82);
  let weightedX = 0;
  let weight = 0;
  for (let y = bandTop; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha < 48) continue;
      weightedX += x * alpha;
      weight += alpha;
    }
  }
  if (weight <= 0) return Math.round(bounds.x + bounds.width / 2);
  return Math.round(weightedX / weight);
}

async function verifyOutputs(expectedFrames, expectedShell, expectedManifest) {
  const actualManifest = await fs.readFile(path.join(outputRoot, 'manifest.json'));
  if (!actualManifest.equals(expectedManifest)) {
    throw new Error('Dinosaur wrong frame manifest is stale');
  }
  await Promise.all(expectedFrames.map(async (bytes, index) => {
    const actual = await fs.readFile(path.join(outputRoot, frameName(index)));
    if (!actual.equals(bytes)) {
      throw new Error(`Dinosaur wrong frame ${index} is stale`);
    }
  }));
  const actualShell = await fs.readFile(path.join(outputRoot, 'shell.png'));
  if (!actualShell.equals(expectedShell)) {
    throw new Error('Dinosaur wrong shell asset is stale');
  }
}

function cell(x, y, width, height) {
  return { x, y, width, height };
}

function frameName(index) {
  return `frame-${String(index).padStart(2, '0')}.png`;
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
