import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const xlsx = path.resolve(
  process.argv[2]
  ?? 'E:/angsa/angsa_data/项目/作业帮游戏/客户反馈的问题/语文游戏-反馈0727.xlsx',
);
const out = path.resolve(
  process.argv[3]
  ?? 'E:/angsa/angsa_data/项目/作业帮游戏/customer-feedback-0727',
);
fs.mkdirSync(out, { recursive: true });

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => text(part?.text)).join('').trim();
    }
    if ('text' in value) return text(value.text);
    if ('result' in value) return text(value.result);
  }
  return String(value).trim();
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(xlsx);
const summary = [];

for (const sheet of workbook.worksheets) {
  const images = sheet.getImages?.() || [];
  console.log(
    'SHEET',
    sheet.name,
    'rows',
    sheet.rowCount,
    'cols',
    sheet.columnCount,
    'images',
    images.length,
  );
  const header = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    header[index] = text(cell.value);
  });
  console.log('HEADER', JSON.stringify(header));

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      values[index] = text(cell.value);
    });
    if (!values.some(Boolean)) return;
    const item = { sheet: sheet.name, row: rowNumber, fields: {} };
    console.log('--- row', rowNumber);
    for (let index = 1; index < header.length; index += 1) {
      const key = header[index] || `col${index}`;
      const value = values[index] || '';
      if (!key && !value) continue;
      item.fields[key] = value;
      console.log(`${key}:`, value.slice(0, 400));
    }
    summary.push(item);
  });

  for (const [index, image] of images.entries()) {
    const media = workbook.model.media.find((entry) => entry.index === image.imageId)
      || workbook.model.media[image.imageId];
    if (!media) {
      console.log('missing media', image.imageId);
      continue;
    }
    const extension = media.extension || 'png';
    const row = Math.floor(image.range?.tl?.nativeRow ?? image.range?.tl?.row ?? 0) + 1;
    const safeSheet = sheet.name.replace(/[^\w\u4e00-\u9fff-]+/g, '_');
    const fileName = `${safeSheet}_img${index + 1}_r${row}.${extension}`;
    fs.writeFileSync(path.join(out, fileName), media.buffer);
    console.log('IMAGE', fileName, 'tl', image.range?.tl, 'br', image.range?.br, 'bytes', media.buffer.length);
    summary.push({
      sheet: sheet.name,
      row,
      image: fileName,
      tl: image.range?.tl,
      br: image.range?.br,
    });
  }
}

fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log('OUT', out);
