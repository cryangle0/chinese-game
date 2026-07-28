import fs from 'node:fs';
import path from 'node:path';

const jpegFrames = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (jpegFrames.has(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += length + 2;
  }
  throw new Error('JPEG dimensions unavailable');
}

function dimensions(file) {
  const buffer = fs.readFileSync(file);
  if (path.extname(file).toLowerCase() === '.png') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return jpegSize(buffer);
}

export function imageMetrics(files) {
  return files
    .filter((file) => ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()))
    .map((file) => {
      const size = dimensions(file);
      return { file, ...size, decodedBytes: size.width * size.height * 4 };
    });
}
