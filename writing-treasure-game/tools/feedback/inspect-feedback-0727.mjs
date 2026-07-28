import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const input = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] ?? 'test-results/customer-feedback-0727');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(input);
await fs.mkdir(output, { recursive: true });

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => text(part?.text)).join('').trim();
    }
    if ('text' in value) return text(value.text);
    if ('result' in value) return text(value.result);
    if ('formula' in value) return text(value.result);
  }
  return String(value).trim();
}

function safe(value) {
  return value.replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^_+|_+$/g, '') || 'sheet';
}

const report = { input, sheets: [] };
for (const sheet of workbook.worksheets) {
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const value = text(cell.value);
      if (value) cells.push({ column: columnNumber, address: cell.address, value });
    });
    if (cells.length) rows.push({ row: rowNumber, height: row.height ?? null, cells });
  });

  const images = [];
  for (const [index, image] of (sheet.getImages?.() ?? []).entries()) {
    const media = workbook.model.media.find((item) => item.index === image.imageId)
      ?? workbook.model.media[image.imageId];
    if (!media?.buffer) continue;
    const extension = media.extension || 'png';
    const topRow = Math.floor(image.range?.tl?.nativeRow ?? image.range?.tl?.row ?? 0) + 1;
    const leftColumn = Math.floor(image.range?.tl?.nativeCol ?? image.range?.tl?.col ?? 0) + 1;
    const file = `${safe(sheet.name)}-${index + 1}-r${topRow}c${leftColumn}.${extension}`;
    await fs.writeFile(path.join(output, file), media.buffer);
    images.push({
      index: index + 1,
      imageId: image.imageId,
      file,
      topRow,
      leftColumn,
      bottomRow: Math.ceil(image.range?.br?.nativeRow ?? image.range?.br?.row ?? topRow),
      rightColumn: Math.ceil(image.range?.br?.nativeCol ?? image.range?.br?.col ?? leftColumn),
      width: media.buffer.length,
    });
  }
  report.sheets.push({
    name: sheet.name,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    rows,
    images,
  });
}

await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  output,
  sheets: report.sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows.length,
    images: sheet.images.length,
  })),
}, null, 2));
