import fs from 'node:fs';
import path from 'node:path';
import { imageMetrics } from './image-metrics.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const resourceRoots = [
  path.join(root, 'assets/resources'),
  path.join(root, 'assets/theme-bundles'),
];
const maxSourceBytes = 10 * 1024 * 1024;
const maxAssetBytes = 2 * 1024 * 1024;
const maxResidentDecodedBytes = 50 * 1024 * 1024;
const maxTextureBytes = 5 * 1024 * 1024;
const maxResidentBackgroundBytes = 10 * 1024 * 1024;

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

const assets = resourceRoots.flatMap(filesBelow).filter((file) => !file.endsWith('.meta'));
const total = assets.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const oversized = assets.filter((file) => fs.statSync(file).size > maxAssetBytes);
const images = imageMetrics(assets);
const decodedBytes = images.reduce((sum, image) => sum + image.decodedBytes, 0);
const sharedDecodedBytes = images
  .filter((image) => image.file.startsWith(resourceRoots[0]))
  .reduce((sum, image) => sum + image.decodedBytes, 0);
const themeDecodedBytes = fs.readdirSync(resourceRoots[1], { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const directory = path.join(resourceRoots[1], entry.name);
    return images
      .filter((image) => image.file.startsWith(`${directory}${path.sep}`))
      .reduce((sum, image) => sum + image.decodedBytes, 0);
  })
  .sort((left, right) => right - left);
const residentDecodedBytes = sharedDecodedBytes
  + themeDecodedBytes.slice(0, 2).reduce((sum, bytes) => sum + bytes, 0);
const oversizedTextures = images.filter((image) => image.decodedBytes > maxTextureBytes);
const oversizedBackgrounds = images.filter((image) =>
  /background\.(jpg|jpeg|png)$/i.test(image.file) && (image.width > 1440 || image.height > 810));
const residentBackgroundBytes = images
  .filter((image) => /background\.(jpg|jpeg|png)$/i.test(image.file))
  .sort((left, right) => right.decodedBytes - left.decodedBytes)
  .slice(0, 2)
  .reduce((sum, image) => sum + image.decodedBytes, 0);
if (total > maxSourceBytes || oversized.length
  || residentDecodedBytes > maxResidentDecodedBytes
  || oversizedTextures.length || oversizedBackgrounds.length
  || residentBackgroundBytes > maxResidentBackgroundBytes) {
  console.error('Performance budget failed', {
    sourceMB: (total / 1024 / 1024).toFixed(2),
    decodedMB: (decodedBytes / 1024 / 1024).toFixed(2),
    residentDecodedMB: (residentDecodedBytes / 1024 / 1024).toFixed(2),
    residentBackgroundMB: (residentBackgroundBytes / 1024 / 1024).toFixed(2),
    oversized: oversized.map((file) => path.relative(root, file)),
    oversizedTextures: oversizedTextures.map((image) => path.relative(root, image.file)),
    oversizedBackgrounds: oversizedBackgrounds.map((image) => path.relative(root, image.file)),
  });
  process.exit(1);
}
console.log(`performance budget ok: ${assets.length} assets, `
  + `${(total / 1048576).toFixed(2)} MB disk, ${(decodedBytes / 1048576).toFixed(2)} MB RGBA, `
  + `${(residentDecodedBytes / 1048576).toFixed(2)} MB max resident RGBA, `
  + `${(residentBackgroundBytes / 1048576).toFixed(2)} MB max two-background residency`);
