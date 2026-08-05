import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const customerSourceRoot = path.join(
  path.dirname(projectRoot),
  '客户提供素材',
  '阅读跳跳乐-完整切图文件',
);
const squidSourcePath = path.join(
  customerSourceRoot,
  '阅读跳跳乐-深海龙宫-切图',
  '深海龙宫-选项触发界面切图',
  '墨鱼喷汁雪碧图.png',
);
const poetrySourcePath = path.join(
  customerSourceRoot,
  '阅读跳跳乐-诗词山水-切图',
  '选项触发界面_道具',
  '负反馈-金币素材.png',
);
const defaultOutputRoot = path.join(projectRoot, 'customer-media', 'reward-props');

const expectedRowFrames = [9, 7, 5, 5];
const alphaThreshold = 8;
const minimumComponentPixels = 8;
const frameWidth = 261;
const frameHeight = 241;
const bodyTop = 0;
const bodyRight = frameWidth - 1;
const squidPlayback = {
  fps: 24,
  popupFrames: Array.from({ length: 9 }, (_, index) => index),
  repositionFrame: 12,
  sprayFrames: Array.from({ length: 13 }, (_, index) => index + 13),
  excludedFrames: [9, 10, 11],
};
const squidFrameDirectoryName = 'ink-squid-frames';
const legacySquidSheetName = 'ink-squid-sheet.png';
const brushMaxSide = 256;
const pngOptions = {
  colorType: 6,
  inputColorType: 6,
  inputHasAlpha: true,
  deflateLevel: 9,
  deflateStrategy: 3,
};

export async function buildReadingNegativeFeedbackAssets({
  outputRoot = defaultOutputRoot,
  check = false,
} = {}) {
  const [squidSourceBytes, poetrySourceBytes] = await Promise.all([
    fs.readFile(squidSourcePath),
    fs.readFile(poetrySourcePath),
  ]);
  const squidSource = PNG.sync.read(squidSourceBytes);
  const poetrySource = PNG.sync.read(poetrySourceBytes);
  const squid = buildSquidFrames(squidSource);
  const poetry = buildPoetryBrush(poetrySource);
  const squidDirectory = path.join(outputRoot, 'deep-sea', squidFrameDirectoryName);
  const squidManifest = {
    version: 1,
    source: {
      name: path.basename(squidSourcePath),
      width: squidSource.width,
      height: squidSource.height,
      sha256: sha256(squidSourceBytes),
    },
    fps: squidPlayback.fps,
    rowFrames: [...expectedRowFrames],
    frameWidth,
    frameHeight,
    anchor: { x: bodyRight, y: bodyTop },
    playback: {
      popupFrames: [...squidPlayback.popupFrames],
      repositionFrame: squidPlayback.repositionFrame,
      sprayFrames: [...squidPlayback.sprayFrames],
      excludedFrames: [...squidPlayback.excludedFrames],
    },
    frames: squid.frames.map((frame, index) => ({
      index,
      file: frameFileName(index),
      width: frame.image.width,
      height: frame.image.height,
      sha256: sha256(frame.bytes),
    })),
  };
  const outputs = [
    ...squid.frames.map((frame, index) => ({
      file: path.join(squidDirectory, frameFileName(index)),
      bytes: frame.bytes,
    })),
    {
      file: path.join(squidDirectory, 'manifest.json'),
      bytes: Buffer.from(`${JSON.stringify(squidManifest, null, 2)}\n`),
    },
    {
      file: path.join(outputRoot, 'poetry', 'penalty.png'),
      bytes: poetry.bytes,
    },
  ];

  if (check) {
    await validateOutputs(outputs);
    await validateLegacySquidSheet(outputRoot);
  } else {
    await fs.rm(squidDirectory, { recursive: true, force: true });
    await Promise.all(outputs.map(async ({ file, bytes }) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes);
    }));
    await fs.rm(
      path.join(outputRoot, 'deep-sea', legacySquidSheetName),
      { force: true },
    );
  }

  return {
    mode: check ? 'check' : 'build',
    squid: {
      source: { width: squidSource.width, height: squidSource.height },
      rowFrames: [...expectedRowFrames],
      frames: expectedRowFrames.reduce((sum, count) => sum + count, 0),
      frameWidth,
      frameHeight,
      playback: {
        fps: squidPlayback.fps,
        popupFrames: [...squidPlayback.popupFrames],
        repositionFrame: squidPlayback.repositionFrame,
        sprayFrames: [...squidPlayback.sprayFrames],
        excludedFrames: [...squidPlayback.excludedFrames],
      },
      directory: squidFrameDirectoryName,
      detachedComponents: squid.detachedComponents,
      lastFrameDetachedComponents: squid.lastFrameDetachedComponents,
      bytes: squid.frames.reduce((sum, frame) => sum + frame.bytes.length, 0),
      manifestSha256: sha256(outputs[expectedRowFrames.reduce(
        (sum, count) => sum + count,
        0,
      )].bytes),
    },
    poetry: {
      sourceName: path.basename(poetrySourcePath),
      source: { width: poetrySource.width, height: poetrySource.height },
      hasSeparateInkTerminal: true,
      encoder: poetry.encoder,
      width: poetry.image.width,
      height: poetry.image.height,
      bytes: poetry.bytes.length,
      sha256: sha256(poetry.bytes),
    },
  };
}

function buildSquidFrames(source) {
  if (source.width !== 1536 || source.height !== 1024) {
    throw new Error(
      `Unexpected squid source dimensions: ${source.width}x${source.height}`,
    );
  }
  const rowBands = findOpaqueRowBands(source);
  if (rowBands.length !== expectedRowFrames.length) {
    throw new Error(`Expected four squid rows, found ${rowBands.length}`);
  }

  const frames = [];
  let detachedComponents = 0;
  for (let rowIndex = 0; rowIndex < rowBands.length; rowIndex += 1) {
    const components = findComponents(source, rowBands[rowIndex])
      .filter((component) => component.pixels.length >= minimumComponentPixels);
    const frameCount = expectedRowFrames[rowIndex];
    if (components.length < frameCount) {
      throw new Error(
        `Squid row ${rowIndex + 1} has ${components.length} components, `
        + `expected at least ${frameCount}`,
      );
    }

    const bodies = [...components]
      .sort((left, right) =>
        right.pixels.length - left.pixels.length || left.left - right.left)
      .slice(0, frameCount)
      .sort((left, right) => left.centerX - right.centerX);
    const bodyIds = new Set(bodies.map((body) => body.id));
    const detached = components.filter((component) => !bodyIds.has(component.id));
    detachedComponents += detached.length;
    const assigned = bodies.map(() => []);
    for (const component of detached) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < bodies.length; index += 1) {
        const body = bodies[index];
        const distance = (
          (component.centerX - body.centerX) ** 2
          + (component.centerY - body.centerY) ** 2
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      assigned[nearestIndex].push(component);
    }
    frames.push(...bodies.map((body, index) => ({
      body,
      detached: assigned[index],
    })));
  }

  const outputFrames = frames.map((frame, frameIndex) =>
    buildSquidFrame(source, frame, frameIndex));
  return {
    frames: outputFrames,
    detachedComponents,
    lastFrameDetachedComponents: frames.at(-1).detached.length,
  };
}

function findOpaqueRowBands(image) {
  const bands = [];
  let top = -1;
  for (let y = 0; y <= image.height; y += 1) {
    let populated = false;
    if (y < image.height) {
      for (let x = 0; x < image.width; x += 1) {
        if (image.data[(y * image.width + x) * 4 + 3] > alphaThreshold) {
          populated = true;
          break;
        }
      }
    }
    if (populated && top < 0) top = y;
    if (!populated && top >= 0) {
      bands.push({ top, bottom: y - 1 });
      top = -1;
    }
  }
  return bands;
}

function findComponents(image, { top, bottom }) {
  const bandHeight = bottom - top + 1;
  const seen = new Uint8Array(image.width * bandHeight);
  const components = [];
  let nextId = 0;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const localIndex = (y - top) * image.width + x;
      if (seen[localIndex] || alphaAt(image, x, y) <= alphaThreshold) continue;

      const pixels = [];
      const queue = [localIndex];
      let left = x;
      let right = x;
      let componentTop = y;
      let componentBottom = y;
      seen[localIndex] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        const pixelX = index % image.width;
        const pixelY = Math.floor(index / image.width) + top;
        pixels.push(pixelY * image.width + pixelX);
        left = Math.min(left, pixelX);
        right = Math.max(right, pixelX);
        componentTop = Math.min(componentTop, pixelY);
        componentBottom = Math.max(componentBottom, pixelY);

        for (const [nextX, nextY] of [
          [pixelX - 1, pixelY],
          [pixelX + 1, pixelY],
          [pixelX, pixelY - 1],
          [pixelX, pixelY + 1],
        ]) {
          if (
            nextX < 0
            || nextX >= image.width
            || nextY < top
            || nextY > bottom
          ) {
            continue;
          }
          const nextIndex = (nextY - top) * image.width + nextX;
          if (seen[nextIndex] || alphaAt(image, nextX, nextY) <= alphaThreshold) {
            continue;
          }
          seen[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }

      components.push({
        id: nextId,
        pixels,
        left,
        right,
        top: componentTop,
        bottom: componentBottom,
        width: right - left + 1,
        height: componentBottom - componentTop + 1,
        centerX: (left + right) / 2,
        centerY: (componentTop + componentBottom) / 2,
      });
      nextId += 1;
    }
  }
  return components;
}

function buildSquidFrame(source, { body, detached }, frameIndex) {
  if (body.width > frameWidth || body.height > frameHeight) {
    throw new Error(
      `Squid frame ${frameIndex} body is too large: ${body.width}x${body.height}`,
    );
  }
  const image = new PNG({ width: frameWidth, height: frameHeight, colorType: 6 });
  image.data.fill(0);
  const bodyLeft = bodyRight - body.width + 1;
  copyComponent(source, image, body, bodyLeft, bodyTop, frameIndex);

  for (const component of detached) {
    const targetLeft = bodyLeft + component.left - body.left;
    const targetTop = bodyTop + component.top - body.top;
    copyComponent(source, image, component, targetLeft, targetTop, frameIndex);
  }
  return {
    image,
    bytes: PNG.sync.write(image, pngOptions),
  };
}

function copyComponent(
  source,
  target,
  component,
  targetLeft,
  targetTop,
  frameIndex,
) {
  if (
    targetLeft < 0
    || targetTop < 0
    || targetLeft + component.width > target.width
    || targetTop + component.height > target.height
  ) {
    throw new Error(
      `Squid frame ${frameIndex} component exceeds ${target.width}x${target.height}: `
      + `${targetLeft},${targetTop},${component.width},${component.height}`,
    );
  }
  for (const sourcePixel of component.pixels) {
    const sourceX = sourcePixel % source.width;
    const sourceY = Math.floor(sourcePixel / source.width);
    const targetX = targetLeft + sourceX - component.left;
    const targetY = targetTop + sourceY - component.top;
    const sourceOffset = sourcePixel * 4;
    const targetOffset = (targetY * target.width + targetX) * 4;
    target.data[targetOffset] = source.data[sourceOffset];
    target.data[targetOffset + 1] = source.data[sourceOffset + 1];
    target.data[targetOffset + 2] = source.data[sourceOffset + 2];
    target.data[targetOffset + 3] = source.data[sourceOffset + 3];
  }
}

function frameFileName(index) {
  return `frame-${String(index).padStart(2, '0')}.png`;
}

function buildPoetryBrush(source) {
  const crop = opaqueBounds(source);
  const scale = Math.min(1, brushMaxSide / Math.max(crop.width, crop.height));
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const image = resizeArea(source, crop, width, height);
  return {
    image,
    bytes: PNG.sync.write(image, pngOptions),
    encoder: 'pngjs-area',
  };
}

function opaqueBounds(image) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (alphaAt(image, x, y) === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    throw new Error('Poetry brush source contains no visible pixels');
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function resizeArea(source, crop, width, height) {
  const output = new PNG({ width, height, colorType: 6 });
  output.data.fill(0);
  const sourcePerTargetX = crop.width / width;
  const sourcePerTargetY = crop.height / height;

  for (let targetY = 0; targetY < height; targetY += 1) {
    const sourceTop = targetY * sourcePerTargetY;
    const sourceBottom = (targetY + 1) * sourcePerTargetY;
    for (let targetX = 0; targetX < width; targetX += 1) {
      const sourceLeft = targetX * sourcePerTargetX;
      const sourceRight = (targetX + 1) * sourcePerTargetX;
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let areaSum = 0;

      for (
        let localY = Math.floor(sourceTop);
        localY < Math.ceil(sourceBottom);
        localY += 1
      ) {
        const overlapY = Math.min(sourceBottom, localY + 1) - Math.max(sourceTop, localY);
        for (
          let localX = Math.floor(sourceLeft);
          localX < Math.ceil(sourceRight);
          localX += 1
        ) {
          const overlapX = Math.min(sourceRight, localX + 1)
            - Math.max(sourceLeft, localX);
          const area = overlapX * overlapY;
          const sourceOffset = (
            (crop.top + localY) * source.width + crop.left + localX
          ) * 4;
          const alpha = source.data[sourceOffset + 3] / 255;
          const alphaArea = alpha * area;
          areaSum += area;
          alphaSum += alphaArea;
          redSum += source.data[sourceOffset] * alphaArea;
          greenSum += source.data[sourceOffset + 1] * alphaArea;
          blueSum += source.data[sourceOffset + 2] * alphaArea;
        }
      }

      const targetOffset = (targetY * width + targetX) * 4;
      if (alphaSum > 0) {
        output.data[targetOffset] = Math.round(redSum / alphaSum);
        output.data[targetOffset + 1] = Math.round(greenSum / alphaSum);
        output.data[targetOffset + 2] = Math.round(blueSum / alphaSum);
        output.data[targetOffset + 3] = Math.round(alphaSum / areaSum * 255);
      }
    }
  }
  return output;
}

async function validateOutputs(outputs) {
  for (const { file, bytes } of outputs) {
    let existing;
    try {
      existing = await fs.readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`${path.basename(file)} is missing`);
      }
      throw error;
    }
    if (!existing.equals(bytes)) {
      throw new Error(`${path.basename(file)} is stale`);
    }
  }
}

async function validateLegacySquidSheet(outputRoot) {
  const legacyFile = path.join(outputRoot, 'deep-sea', legacySquidSheetName);
  try {
    await fs.access(legacyFile);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${legacySquidSheetName} should be removed`);
}

function alphaAt(image, x, y) {
  return image.data[(y * image.width + x) * 4 + 3];
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
  if (unknownArguments.length) {
    console.error(`Unknown argument: ${unknownArguments[0]}`);
    process.exitCode = 1;
  } else {
    try {
      const report = await buildReadingNegativeFeedbackAssets({
        check: process.argv.includes('--check'),
      });
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
