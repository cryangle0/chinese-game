import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.resolve(
  process.env.DINOSAUR_CORRECT_SOURCE
    ?? path.join(
      projectRoot,
      'tools',
      'assets',
      'sources',
      'dinosaur-correct-hd-transparent.png',
    ),
);
const digSourcePath = path.resolve(
  process.env.DINOSAUR_DIG_SOURCE
    ?? path.join(
      projectRoot,
      'tools',
      'assets',
      'sources',
      'dinosaur-dig-state.png',
    ),
);
const digOutputPath = path.resolve(
  process.env.DINOSAUR_DIG_OUTPUT
    ?? path.join(
      projectRoot,
      'customer-media',
      'dinosaur',
      'dig.png',
    ),
);
const outputRoot = path.resolve(
  process.env.DINOSAUR_CORRECT_OUTPUT
    ?? path.join(
      projectRoot,
      'customer-media',
      'dinosaur',
      'correct-hatch-frames',
    ),
);
const checkOnly = process.argv.includes('--check');

const SOURCE_WIDTH = 2048;
const SOURCE_HEIGHT = 2048;
const FRAME_COUNT = 12;
const OUTPUT_PADDING = 24;
const HATCH_FRAME = 7;
const FPS = 6;
const FINAL_HOLD_MS = 900;

// The clean HD sheet is laid out in four visual groups per row. The source
// figures are wider than an even 512px cell, so use the real transparent gaps.
const SOURCE_CELLS = [
  cell(0, 0, 607, 683),
  cell(607, 0, 479, 683),
  cell(1086, 0, 478, 683),
  cell(1564, 0, 484, 683),
  cell(0, 683, 468, 683),
  cell(468, 683, 511, 683),
  cell(979, 683, 514, 683),
  cell(1493, 683, 555, 683),
  cell(0, 1366, 529, 682),
  cell(529, 1366, 515, 682),
  cell(1044, 1366, 472, 682),
  cell(1516, 1366, 532, 682),
];

const sourceBytes = await fs.readFile(sourcePath);
const source = PNG.sync.read(sourceBytes);
if (source.width !== SOURCE_WIDTH || source.height !== SOURCE_HEIGHT) {
  throw new Error(
    `Unexpected dinosaur correct sheet size ${source.width}x${source.height}`,
  );
}
const digSourceBytes = await fs.readFile(digSourcePath);
const digSource = PNG.sync.read(digSourceBytes);
if (digSource.width !== 389 || digSource.height !== 389) {
  throw new Error(
    `Unexpected dinosaur dig state size ${digSource.width}x${digSource.height}`,
  );
}

const frameGeometry = SOURCE_CELLS.map((sourceCell, index) => {
  const sourceBounds = alphaBounds(source, sourceCell);
  const anchorKind = index < HATCH_FRAME ? 'egg' : 'dinosaur';
  const component = largestColorComponent(
    source,
    sourceCell,
    anchorKind === 'egg' ? isPurpleEggPixel : isGreenDinosaurPixel,
  );
  if (!component || component.pixelCount < 1000) {
    throw new Error(`Missing ${anchorKind} anchor in dinosaur frame ${index}`);
  }
  return {
    index,
    sourceCell,
    sourceBounds,
    sourceAnchorX: Math.round(component.centerX),
    sourceBaselineY: sourceBounds.y + sourceBounds.height - 1,
    anchorKind,
    component,
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
    outputBounds: alphaBounds(
      image,
      cell(0, 0, frameWidth, frameHeight),
    ),
  };
});
const encodedFrames = frames.map((frame) => PNG.sync.write(frame.image));

const hatchGeometry = frameGeometry[HATCH_FRAME];
if (!hatchGeometry) throw new Error('Missing dinosaur hatch frame geometry');
const hatchFrame = frames[HATCH_FRAME];
if (!hatchFrame) throw new Error('Missing dinosaur hatch output frame');
const babyHeadSource = dinosaurHeadPoint(hatchGeometry.component);
const babyHead = {
  frame: HATCH_FRAME,
  x: outputAnchorX + babyHeadSource.x - hatchGeometry.sourceAnchorX,
  y: outputBaselineY + babyHeadSource.y - hatchGeometry.sourceBaselineY,
};
const placementAnchor = {
  x: hatchFrame.outputBounds.x
    + Math.floor((hatchFrame.outputBounds.width - 1) / 2),
  baselineY: outputBaselineY,
};

const manifest = {
  version: 'dinosaur-correct-hatch-20260805-hd-clean-v3-position',
  source: {
    file: path.basename(sourcePath),
    width: source.width,
    height: source.height,
    sha256: digest(sourceBytes),
  },
  frameWidth,
  frameHeight,
  fps: FPS,
  hatchFrame: HATCH_FRAME,
  finalHoldMs: FINAL_HOLD_MS,
  anchor: {
    x: outputAnchorX,
    baselineY: outputBaselineY,
  },
  placementAnchor,
  babyHead,
  frames: frames.map((frame, index) => ({
    index,
    file: frameName(index),
    sourceCell: frame.sourceCell,
    sourceBounds: frame.sourceBounds,
    outputBounds: frame.outputBounds,
    anchor: {
      kind: frame.anchorKind,
      sourceX: frame.sourceAnchorX,
      sourceBaselineY: frame.sourceBaselineY,
      outputX: outputAnchorX,
      outputBaselineY,
    },
    anchorComponent: {
      bounds: frame.component.bounds,
      pixelCount: frame.component.pixelCount,
    },
    alphaPixels: frame.outputBounds.alphaPixels,
    bytes: encodedFrames[index].length,
    sha256: digest(encodedFrames[index]),
  })),
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

if (checkOnly) {
  await verifyOutputs(encodedFrames, manifestBytes, digSourceBytes);
  console.log(
    `Dinosaur correct HD frames verified: ${frames.length} `
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
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBytes);
  await fs.mkdir(path.dirname(digOutputPath), { recursive: true });
  await fs.writeFile(digOutputPath, digSourceBytes);
  console.log(
    `Dinosaur correct HD frames built: ${frames.length} `
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
  const sourceRight = bounds.x + bounds.width;
  const sourceBottom = bounds.y + bounds.height;
  for (let y = bounds.y; y < sourceBottom; y += 1) {
    for (let x = bounds.x; x < sourceRight; x += 1) {
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
        throw new Error(`Dinosaur frame ${frame.index} escaped output canvas`);
      }
      const targetOffset = (targetY * width + targetX) * 4;
      image.data[targetOffset] = sheet.data[sourceOffset];
      image.data[targetOffset + 1] = sheet.data[sourceOffset + 1];
      image.data[targetOffset + 2] = sheet.data[sourceOffset + 2];
      image.data[targetOffset + 3] = sheet.data[sourceOffset + 3];
    }
  }
  return image;
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

function largestColorComponent(image, sourceCell, matches) {
  const { x: left, y: top, width, height } = sourceCell;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = ((top + y) * image.width + left + x) * 4;
      if (matches(
        image.data[sourceOffset],
        image.data[sourceOffset + 1],
        image.data[sourceOffset + 2],
        image.data[sourceOffset + 3],
      )) {
        mask[y * width + x] = 1;
      }
    }
  }

  let largest = null;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) continue;
    const stack = [index];
    const pixels = [];
    visited[index] = 1;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    while (stack.length > 0) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      const globalX = left + x;
      const globalY = top + y;
      pixels.push([globalX, globalY]);
      minX = Math.min(minX, globalX);
      minY = Math.min(minY, globalY);
      maxX = Math.max(maxX, globalX);
      maxY = Math.max(maxY, globalY);
      sumX += globalX;
      sumY += globalY;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (
            nextX < 0
            || nextY < 0
            || nextX >= width
            || nextY >= height
          ) continue;
          const next = nextY * width + nextX;
          if (!mask[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
    const pixelCount = pixels.length;
    if (largest && largest.pixelCount >= pixelCount) continue;
    largest = {
      pixelCount,
      centerX: sumX / pixelCount,
      centerY: sumY / pixelCount,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      pixels,
    };
  }
  return largest;
}

function dinosaurHeadPoint(component) {
  const topLimit = component.bounds.y + component.bounds.height * 0.35;
  const topPixels = component.pixels.filter(([, y]) => y <= topLimit);
  const x = Math.round(
    topPixels.reduce((sum, [pixelX]) => sum + pixelX, 0)
      / topPixels.length,
  );
  return {
    x,
    y: Math.max(0, component.bounds.y - 18),
  };
}

function isPurpleEggPixel(red, green, blue, alpha) {
  return alpha >= 64
    && blue > 115
    && red > 95
    && blue > green * 1.08
    && red > green * 1.03;
}

function isGreenDinosaurPixel(red, green, blue, alpha) {
  return alpha >= 64
    && green > 75
    && green > red * 1.08
    && green > blue * 1.04;
}

async function verifyOutputs(expectedFrames, expectedManifest, expectedDig) {
  const actualManifest = await fs.readFile(path.join(outputRoot, 'manifest.json'));
  if (!actualManifest.equals(expectedManifest)) {
    throw new Error('Dinosaur correct HD frame manifest is stale');
  }
  await Promise.all(expectedFrames.map(async (bytes, index) => {
    const actual = await fs.readFile(path.join(outputRoot, frameName(index)));
    if (!actual.equals(bytes)) {
      throw new Error(`Dinosaur correct HD frame ${index} is stale`);
    }
  }));
  const actualDig = await fs.readFile(digOutputPath);
  if (!actualDig.equals(expectedDig)) {
    throw new Error('Dinosaur dig state asset is stale');
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
