import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourceRoot = path.join(
  path.dirname(projectRoot),
  '\u5ba2\u6237\u63d0\u4f9b\u7d20\u6750',
  '\u52a8\u6548\u97f3\u4e50\u7d20\u6750',
  '\u9605\u8bfb\u8df3\u8df3\u4e50-\u52a8\u6548\u6587\u4ef6',
);
const outputRoot = path.join(projectRoot, 'assets', 'theme-bundles');
const columns = 4;
const alphaThreshold = 8;
const cropPadding = 4;

const sceneMarkers = new Map([
  ['mario', '\u9a6c\u91cc\u5965'],
  ['deep-sea', '\u6df1\u6d77\u9f99\u5bab'],
  ['space', '\u661f\u9645\u7a7f\u8d8a'],
  ['food', '\u7f8e\u98df\u5927\u5192\u9669'],
  ['poetry', '\u8bd7\u8bcd\u5c71\u6c34'],
]);

const actionMarkers = new Map([
  ['idle', ['\u5f85\u673a', '\u6b63\u9762\u8dd1']],
  ['run-left', ['\u8dd1-\u5de6', '\u5de6\u4fa7\u8dd1']],
  ['run-right', ['\u8dd1-\u53f3', '\u53f3\u4fa7\u8dd1']],
]);

const sceneDirectories = (await fs.readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory());
const manifest = [];

for (const [scene, marker] of sceneMarkers) {
  const sceneEntry = sceneDirectories.find((entry) => entry.name.includes(marker));
  if (!sceneEntry) throw new Error(`Missing reading scene source: ${scene}`);
  const sceneDirectory = path.join(sourceRoot, sceneEntry.name);
  const actionDirectories = (await fs.readdir(sceneDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory());

  const sequences = [];
  for (const [action, markers] of actionMarkers) {
    const actionEntry = actionDirectories.find((entry) =>
      markers.some((actionMarker) => entry.name === actionMarker));
    if (!actionEntry) throw new Error(`Missing locomotion source: ${scene}/${action}`);
    const sourceDirectory = path.join(sceneDirectory, actionEntry.name);
    const files = (await fs.readdir(sourceDirectory))
      .filter((file) => file.toLowerCase().endsWith('.png'))
      .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
    if (!files.length) throw new Error(`Empty locomotion sequence: ${sourceDirectory}`);

    const frames = await Promise.all(files.map(async (file) => ({
      file,
      image: PNG.sync.read(await fs.readFile(path.join(sourceDirectory, file))),
    })));
    const sourceWidth = frames[0].image.width;
    const sourceHeight = frames[0].image.height;
    for (const frame of frames) {
      if (frame.image.width !== sourceWidth || frame.image.height !== sourceHeight) {
        throw new Error(`Mixed frame dimensions: ${sourceDirectory}/${frame.file}`);
      }
    }
    sequences.push({
      scene,
      action,
      frames,
      sourceDirectory,
      sourceWidth,
      sourceHeight,
    });
  }

  const sourceWidth = sequences[0].sourceWidth;
  const sourceHeight = sequences[0].sourceHeight;
  if (sequences.some((sequence) =>
    sequence.sourceWidth !== sourceWidth || sequence.sourceHeight !== sourceHeight)) {
    throw new Error(`Locomotion actions use mixed dimensions: ${scene}`);
  }
  const crop = opaqueBounds(
    sequences.flatMap((sequence) => sequence.frames.map((frame) => frame.image)),
    sourceWidth,
    sourceHeight,
  );
  const frameWidth = crop.right - crop.left + 1;
  const frameHeight = crop.bottom - crop.top + 1;

  for (const { action, frames } of sequences) {
    const rows = Math.ceil(frames.length / columns);
    const sheet = new PNG({
      width: frameWidth * columns,
      height: frameHeight * rows,
      colorType: 6,
    });
    frames.forEach(({ image }, index) => {
      const targetX = index % columns * frameWidth;
      const targetY = Math.floor(index / columns) * frameHeight;
      PNG.bitblt(
        image,
        sheet,
        crop.left,
        crop.top,
        frameWidth,
        frameHeight,
        targetX,
        targetY,
      );
    });

    const outputDirectory = path.join(outputRoot, scene);
    const output = path.join(outputDirectory, `locomotion-${action}.png`);
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(output, PNG.sync.write(sheet, {
      colorType: 6,
      inputColorType: 6,
      inputHasAlpha: true,
      deflateLevel: 9,
      deflateStrategy: 3,
    }));
    manifest.push({
      scene,
      action,
      frames: frames.length,
      columns,
      frameWidth,
      frameHeight,
      sourceWidth,
      sourceHeight,
      crop,
      sheetWidth: sheet.width,
      sheetHeight: sheet.height,
      output: path.relative(projectRoot, output).replaceAll('\\', '/'),
    });
    console.log(
      `Built ${scene}/${action}: ${frames.length} frames, `
      + `${sheet.width}x${sheet.height}`,
    );
  }
}

function opaqueBounds(images, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (const image of images) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (image.data[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) throw new Error('Locomotion frames contain no opaque pixels');
  return {
    left: Math.max(0, left - cropPadding),
    top: Math.max(0, top - cropPadding),
    right: Math.min(width - 1, right + cropPadding),
    bottom: Math.min(height - 1, bottom + cropPadding),
  };
}

const manifestDirectory = path.join(projectRoot, 'artifacts', 'locomotion-sheets');
const manifestPath = path.join(manifestDirectory, 'manifest.json');
await fs.mkdir(manifestDirectory, { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  fps: 15,
  columns,
  items: manifest,
}, null, 2)}\n`);

console.log(`Built ${manifest.length} deterministic locomotion sprite sheets.`);
process.exit(0);
