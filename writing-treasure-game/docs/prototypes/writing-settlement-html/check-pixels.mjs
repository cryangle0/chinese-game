import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(path.resolve('package.json'));
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const root = path.resolve(import.meta.dirname);
const expectedPath = path.join(root, 'assets', 'writing-treasure-result.png');
const actualPath = path.join(root, 'actual-treasure.png');
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  const actualBuffer = await page.screenshot();
  fs.writeFileSync(actualPath, actualBuffer);
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(fs.readFileSync(expectedPath));
  let changed = 0;
  let totalDelta = 0;
  for (let offset = 0; offset < actual.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(actual.data[offset] - expected.data[offset]),
      Math.abs(actual.data[offset + 1] - expected.data[offset + 1]),
      Math.abs(actual.data[offset + 2] - expected.data[offset + 2]),
    );
    totalDelta += delta;
    if (delta > 0) changed += 1;
  }
  const pixels = actual.width * actual.height;
  console.log(JSON.stringify({
    actual: actualPath,
    expected: expectedPath,
    mae: totalDelta / (pixels * 3),
    changedRatio: changed / pixels,
  }, null, 2));
} finally {
  await browser.close();
}
