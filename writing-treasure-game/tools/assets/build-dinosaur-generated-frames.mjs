import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const generatedRoot = path.join(
  projectRoot,
  'tools',
  'assets',
  'sources',
  'generated',
  'dinosaur-20260805',
  'transparent',
);
const correctSourcePath = path.resolve(
  process.env.DINOSAUR_CORRECT_SMOOTH_SOURCE
    ?? path.join(generatedRoot, 'correct-24-white_transparent_0.png'),
);
const wrongSourcePath = path.resolve(
  process.env.DINOSAUR_WRONG_SMOOTH_SOURCE
    ?? path.join(generatedRoot, 'wrong-16-white_transparent_0.png'),
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
const correctOutputRoot = path.join(
  projectRoot,
  'customer-media',
  'dinosaur',
  'correct-hatch-frames',
);
const wrongOutputRoot = path.join(
  projectRoot,
  'customer-media',
  'dinosaur',
  'wrong-hatch-frames',
);

const checkOnly = process.argv.includes('--check');
const requestedMode = valueAfter('--mode') ?? 'all';
if (!['all', 'correct', 'wrong'].includes(requestedMode)) {
  throw new Error(`Unsupported dinosaur build mode: ${requestedMode}`);
}

if (requestedMode === 'all' || requestedMode === 'correct') {
  await buildCorrect();
}
if (requestedMode === 'all' || requestedMode === 'wrong') {
  await buildWrong();
}

async function buildCorrect() {
  const sourceBytes = await fs.readFile(correctSourcePath);
  const source = PNG.sync.read(sourceBytes);
  normalizeAlpha(source);
  const columns = 6;
  const rows = 4;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const sourceCell = proportionalCell(
        source.width,
        source.height,
        columns,
        rows,
        column,
        row,
      );
      const sourceBounds = alphaBounds(source, sourceCell);
      const components = connectedComponents(
        source,
        sourceCell,
        (red, green, blue, alpha) => alpha >= 24,
      ).filter((component) => component.pixelCount >= 300);
      const main = components.sort(
        (left, right) => right.pixelCount - left.pixelCount,
      )[0];
      if (!main) {
        throw new Error(`Missing subject in correct frame ${cells.length}`);
      }
      cells.push({
        index: cells.length,
        sourceCell,
        sourceBounds,
        sourceBaselineY: main.bounds.y + main.bounds.height - 1,
      });
    }
  }
  if (cells.length !== 24) {
    throw new Error(`Expected 24 correct frames, got ${cells.length}`);
  }

  const padding = 10;
  const minTop = Math.min(...cells.map(
    (frame) => frame.sourceBounds.y - frame.sourceBaselineY,
  ));
  const maxBottom = Math.max(...cells.map(
    (frame) => frame.sourceBounds.y + frame.sourceBounds.height - 1
      - frame.sourceBaselineY,
  ));
  const frameWidth = Math.max(...cells.map(
    (frame) => frame.sourceCell.width,
  ));
  const frameHeight = maxBottom - minTop + 1 + padding * 2;
  const outputBaselineY = padding - minTop;
  const outputAnchorX = Math.floor(frameWidth / 2);

  const frames = cells.map((frame) => {
    const image = new PNG({ width: frameWidth, height: frameHeight });
    const offsetX = Math.floor((frameWidth - frame.sourceCell.width) / 2);
    const offsetY = outputBaselineY - frame.sourceBaselineY;
    copyRectangle(
      source,
      image,
      frame.sourceCell,
      offsetX - frame.sourceCell.x,
      offsetY,
    );
    return {
      ...frame,
      image,
      outputBounds: alphaBounds(
        image,
        rectangle(0, 0, frameWidth, frameHeight),
      ),
    };
  });
  const encodedFrames = frames.map((frame) => PNG.sync.write(frame.image));
  const hatchFrame = 12;
  const hatch = frames[hatchFrame];
  const greenComponents = connectedComponents(
    hatch.image,
    rectangle(0, 0, frameWidth, frameHeight),
    isGreenDinosaurPixel,
  ).filter((component) => component.pixelCount >= 100);
  const dinosaur = greenComponents.sort(
    (left, right) => right.pixelCount - left.pixelCount,
  )[0];
  if (!dinosaur) throw new Error('Unable to locate the green hatchling');
  const babyHead = {
    frame: hatchFrame,
    x: Math.round(
      dinosaur.bounds.x + (dinosaur.bounds.width - 1) / 2,
    ),
    y: Math.max(0, dinosaur.bounds.y - 12),
  };
  const placementAnchor = {
    x: hatch.outputBounds.x
      + Math.floor((hatch.outputBounds.width - 1) / 2),
    baselineY: outputBaselineY,
  };
  const manifest = {
    version: 'dinosaur-correct-hatch-20260805-gpt2-smooth-v1',
    generation: {
      provider: 'RunningHub',
      model: 'gpt-image-2',
      quality: 'high',
      sourceFile: path.basename(correctSourcePath),
    },
    source: {
      file: path.basename(correctSourcePath),
      width: source.width,
      height: source.height,
      sha256: digest(sourceBytes),
      columns,
      rows,
    },
    frameWidth,
    frameHeight,
    fps: 12,
    hatchFrame,
    finalHoldMs: 700,
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
        sourceBaselineY: frame.sourceBaselineY,
        outputX: outputAnchorX,
        outputBaselineY,
      },
      alphaPixels: frame.outputBounds.alphaPixels,
      bytes: encodedFrames[index].length,
      sha256: digest(encodedFrames[index]),
    })),
  };
  await writeOrVerify(
    correctOutputRoot,
    encodedFrames,
    manifest,
    'Dinosaur correct smooth frames',
  );
}

async function buildWrong() {
  const sourceBytes = await fs.readFile(wrongSourcePath);
  const source = PNG.sync.read(sourceBytes);
  normalizeAlpha(source);
  const components = connectedComponents(
    source,
    rectangle(0, 0, source.width, source.height),
    (red, green, blue, alpha) => alpha >= 24,
  ).filter((component) => component.pixelCount >= 12000);
  if (components.length !== 16) {
    throw new Error(
      `Expected 16 orange dinosaur components, got ${components.length}`,
    );
  }
  const ordered = sortIntoRows(components, 4).map((component, index) => ({
    index,
    sourceBounds: component.bounds,
    sourceAnchorX: footAnchorX(source, component.bounds),
    sourceBaselineY:
      component.bounds.y + component.bounds.height - 1,
  }));
  const relativeExtents = ordered.map((frame) => ({
    left: frame.sourceBounds.x - frame.sourceAnchorX,
    right: frame.sourceBounds.x + frame.sourceBounds.width - 1
      - frame.sourceAnchorX,
    top: frame.sourceBounds.y - frame.sourceBaselineY,
    bottom: frame.sourceBounds.y + frame.sourceBounds.height - 1
      - frame.sourceBaselineY,
  }));
  const padding = 16;
  const minLeft = Math.min(...relativeExtents.map((value) => value.left));
  const maxRight = Math.max(...relativeExtents.map((value) => value.right));
  const minTop = Math.min(...relativeExtents.map((value) => value.top));
  const maxBottom = Math.max(...relativeExtents.map((value) => value.bottom));
  const frameWidth = maxRight - minLeft + 1 + padding * 2;
  const frameHeight = maxBottom - minTop + 1 + padding * 2;
  const outputAnchorX = padding - minLeft;
  const outputBaselineY = padding - minTop;

  const frames = ordered.map((frame) => {
    const image = new PNG({ width: frameWidth, height: frameHeight });
    copyRectangle(
      source,
      image,
      frame.sourceBounds,
      outputAnchorX - frame.sourceAnchorX,
      outputBaselineY - frame.sourceBaselineY,
    );
    return {
      ...frame,
      image,
      outputBounds: alphaBounds(
        image,
        rectangle(0, 0, frameWidth, frameHeight),
      ),
    };
  });
  const encodedFrames = frames.map((frame) => PNG.sync.write(frame.image));

  const shellSourceBytes = await fs.readFile(shellSourcePath);
  const shellSource = PNG.sync.read(shellSourceBytes);
  const shellBounds = alphaBounds(
    shellSource,
    rectangle(0, 0, shellSource.width, shellSource.height),
  );
  const shell = new PNG({
    width: shellBounds.width,
    height: shellBounds.height,
  });
  copyRectangle(
    shellSource,
    shell,
    shellBounds,
    -shellBounds.x,
    -shellBounds.y,
  );
  const shellBytes = PNG.sync.write(shell);
  const manifest = {
    version: 'dinosaur-wrong-hatch-20260805-gpt2-smooth-v1',
    generation: {
      provider: 'RunningHub',
      model: 'gpt-image-2',
      quality: 'high',
      sourceFile: path.basename(wrongSourcePath),
    },
    source: {
      file: path.basename(wrongSourcePath),
      width: source.width,
      height: source.height,
      sha256: digest(sourceBytes),
      detectedComponents: components.length,
    },
    frameWidth,
    frameHeight,
    fps: 12,
    phases: {
      emerge: { start: 0, end: 3, fps: 10, loop: false },
      jump: { start: 4, end: 7, fps: 10, loop: false },
      run: { start: 8, end: 15, fps: 12, loop: true },
    },
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
  await writeOrVerify(
    wrongOutputRoot,
    encodedFrames,
    manifest,
    'Dinosaur wrong smooth frames',
    { 'shell.png': shellBytes },
  );
}

async function writeOrVerify(
  outputRoot,
  encodedFrames,
  manifest,
  label,
  extraFiles = {},
) {
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  if (checkOnly) {
    const actualManifest = await fs.readFile(
      path.join(outputRoot, 'manifest.json'),
    );
    if (!actualManifest.equals(manifestBytes)) {
      throw new Error(`${label} manifest is stale`);
    }
    await Promise.all(encodedFrames.map(async (bytes, index) => {
      const actual = await fs.readFile(
        path.join(outputRoot, frameName(index)),
      );
      if (!actual.equals(bytes)) {
        throw new Error(`${label} frame ${index} is stale`);
      }
    }));
    await Promise.all(Object.entries(extraFiles).map(async ([name, bytes]) => {
      const actual = await fs.readFile(path.join(outputRoot, name));
      if (!actual.equals(bytes)) {
        throw new Error(`${label} ${name} is stale`);
      }
    }));
    console.log(
      `${label} verified: ${encodedFrames.length} `
        + `(${manifest.frameWidth}x${manifest.frameHeight})`,
    );
    return;
  }
  await fs.mkdir(outputRoot, { recursive: true });
  const existing = await fs.readdir(outputRoot).catch(() => []);
  await Promise.all(existing
    .filter((name) => /^frame-\d+\.png$/i.test(name))
    .map((name) => fs.rm(path.join(outputRoot, name), { force: true })));
  await Promise.all(encodedFrames.map((bytes, index) =>
    fs.writeFile(path.join(outputRoot, frameName(index)), bytes)));
  await Promise.all(Object.entries(extraFiles).map(([name, bytes]) =>
    fs.writeFile(path.join(outputRoot, name), bytes)));
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBytes);
  console.log(
    `${label} built: ${encodedFrames.length} `
      + `(${manifest.frameWidth}x${manifest.frameHeight}) -> ${outputRoot}`,
  );
}

function connectedComponents(image, bounds, matches) {
  const width = bounds.width;
  const height = bounds.height;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((bounds.y + y) * image.width + bounds.x + x) * 4;
      if (matches(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
        image.data[offset + 3],
      )) {
        mask[y * width + x] = 1;
      }
    }
  }

  const components = [];
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) continue;
    const stack = [index];
    visited[index] = 1;
    let pixelCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    while (stack.length > 0) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      pixelCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
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
    components.push({
      pixelCount,
      centerX: bounds.x + sumX / pixelCount,
      centerY: bounds.y + sumY / pixelCount,
      bounds: {
        x: bounds.x + minX,
        y: bounds.y + minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    });
  }
  return components;
}

function sortIntoRows(components, rowCount) {
  const sorted = [...components].sort(
    (left, right) => left.centerY - right.centerY,
  );
  const columns = sorted.length / rowCount;
  if (!Number.isInteger(columns)) {
    throw new Error('Dinosaur component count does not form equal rows');
  }
  return Array.from({ length: rowCount }, (_, row) => sorted
    .slice(row * columns, (row + 1) * columns)
    .sort((left, right) => left.centerX - right.centerX))
    .flat();
}

function copyRectangle(source, target, sourceBounds, offsetX, offsetY) {
  for (let y = 0; y < sourceBounds.height; y += 1) {
    for (let x = 0; x < sourceBounds.width; x += 1) {
      const sourceX = sourceBounds.x + x;
      const sourceY = sourceBounds.y + y;
      const targetX = sourceX + offsetX;
      const targetY = sourceY + offsetY;
      if (
        targetX < 0
        || targetY < 0
        || targetX >= target.width
        || targetY >= target.height
      ) continue;
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (targetY * target.width + targetX) * 4;
      target.data[targetOffset] = source.data[sourceOffset];
      target.data[targetOffset + 1] = source.data[sourceOffset + 1];
      target.data[targetOffset + 2] = source.data[sourceOffset + 2];
      target.data[targetOffset + 3] = source.data[sourceOffset + 3];
    }
  }
}

function normalizeAlpha(image) {
  for (let offset = 3; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset];
    if (alpha <= 3) image.data[offset] = 0;
    else if (alpha >= 250) image.data[offset] = 255;
  }
}

function alphaBounds(image, sourceCell) {
  let minX = sourceCell.x + sourceCell.width;
  let minY = sourceCell.y + sourceCell.height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
  for (let y = sourceCell.y; y < sourceCell.y + sourceCell.height; y += 1) {
    for (let x = sourceCell.x; x < sourceCell.x + sourceCell.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha < 8) continue;
      alphaPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (alphaPixels === 0) {
    throw new Error(
      `Transparent cell at ${sourceCell.x},${sourceCell.y}`,
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
  const bandTop = bounds.y + Math.floor(bounds.height * 0.78);
  let weightedX = 0;
  let weight = 0;
  for (let y = bandTop; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha < 32) continue;
      weightedX += x * alpha;
      weight += alpha;
    }
  }
  return weight > 0
    ? Math.round(weightedX / weight)
    : Math.round(bounds.x + bounds.width / 2);
}

function isGreenDinosaurPixel(red, green, blue, alpha) {
  return alpha >= 24
    && green >= 70
    && green > red * 1.08
    && green > blue * 1.02;
}

function proportionalCell(
  width,
  height,
  columns,
  rows,
  column,
  row,
) {
  const left = Math.round(column * width / columns);
  const right = Math.round((column + 1) * width / columns);
  const top = Math.round(row * height / rows);
  const bottom = Math.round((row + 1) * height / rows);
  return rectangle(left, top, right - left, bottom - top);
}

function rectangle(x, y, width, height) {
  return { x, y, width, height };
}

function frameName(index) {
  return `frame-${String(index).padStart(2, '0')}.png`;
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function valueAfter(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
