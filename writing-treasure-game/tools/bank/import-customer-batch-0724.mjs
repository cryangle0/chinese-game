/**
 * Merge customer batch 0724 into existing question-bank.json (batch1+2+3).
 * Usage:
 *   node tools/bank/import-customer-batch-0724.mjs <xlsx-dir> [out.json] [reading-jumper|writing-treasure]
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const input = path.resolve(process.argv[2] ?? '');
const output = path.resolve(process.argv[3] ?? 'config/question-bank.json');
const targetGame = process.argv[4] ?? 'reading-jumper';
const gradeMap = new Map([
  ['一年级', 'L1'], ['二年级', 'L2'], ['三年级', 'L3'],
  ['四年级', 'L4'], ['五年级', 'L5'], ['六年级', 'L6'],
]);
const answerMap = new Map([['A', 0], ['B', 1], ['C', 2]]);
const target = targetGame === 'writing-treasure' ? {
  sourceGame: '挖宝',
  version: 'customer-writing-20260724-batch1+2+3',
  scenes: new Map([
    ['经典挖宝', 'treasure'], ['沙漠探险', 'desert'], ['恐龙世界', 'dinosaur'],
    ['敦煌壁画', 'dunhuang'], ['魔法学院', 'magic'],
  ]),
} : {
  sourceGame: '跳跳乐',
  version: 'customer-reading-20260724-batch1+2+3',
  scenes: new Map([
    ['马里奥', 'mario'], ['深海龙宫', 'deep-sea'], ['星际穿越', 'space'],
    ['美食大冒险', 'food'], ['诗词山水', 'poetry'],
  ]),
};
const difficulties = ['basic', 'advanced', 'challenge'];
const errors = [];
const imported = [];
const contentKeys = new Set();
const booksSeen = new Set();

if (!process.argv[2]) {
  throw new Error('Usage: node import-customer-batch-0724.mjs <xlsx-directory> [out] [game]');
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => text(part?.text)).join('').trim();
    }
    if ('text' in value) return text(value.text);
    if ('result' in value) return text(value.result);
  }
  return String(value).trim();
}

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const targetPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(targetPath) : [targetPath];
  }));
  return nested.flat();
}

function stableId(grade, book, stem, options) {
  const digest = crypto.createHash('sha1')
    .update(JSON.stringify([grade, book, stem, options, '0724']))
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `CB0724_${targetGame === 'writing-treasure' ? 'WT' : 'RJ'}_${grade}_${digest}`;
}

function stripOptionPrefix(value) {
  return value.replace(/^[ABCＡＢＣ][.．、:：]\s*/u, '').trim();
}

function contentKeyOf(stem, options, answer) {
  return JSON.stringify([stem, options, answer]);
}

let existing = { questions: [] };
try {
  existing = JSON.parse(await fs.readFile(output, 'utf8'));
} catch {
  existing = { questions: [] };
}
const kept = Array.isArray(existing.questions) ? existing.questions : [];
for (const q of kept) {
  contentKeys.add(contentKeyOf(q.stem, q.options, q.correctIndex));
}

const files = (await filesBelow(input)).filter((file) => file.toLowerCase().endsWith('.xlsx')).sort();
for (const file of files) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet('终')
    ?? workbook.getWorksheet('下载版')
    ?? workbook.getWorksheet('Sheet1')
    ?? workbook.worksheets[0];
  if (!sheet) {
    errors.push(`${path.basename(file)}: no worksheet`);
    continue;
  }
  const columns = new Map();
  sheet.getRow(1).eachCell((cell, column) => columns.set(text(cell.value), column));
  if (!columns.has('年级')) columns.set('年级', 5);
  const required = [
    '适用游戏', '适用场景', '年级', '书目', '题型', '题干类型',
    '题干', '选项A', '选项B', '选项C', '正确答案', '启用状态',
  ];
  const missing = required.filter((name) => !columns.has(name));
  if (missing.length) {
    errors.push(`${path.basename(file)}: missing ${missing.join(', ')}`);
    continue;
  }
  const value = (row, name) => text(row.getCell(columns.get(name)).value);
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !row.hasValues || !value(row, '题干')) return;
    const game = value(row, '适用游戏');
    const scene = value(row, '适用场景');
    if (game !== target.sourceGame) return;
    const sceneId = target.scenes.get(scene);
    const gradeLabel = value(row, '年级');
    const grade = gradeMap.get(gradeLabel);
    const answer = answerMap.get(value(row, '正确答案').toUpperCase());
    const options = ['选项A', '选项B', '选项C'].map((name) => stripOptionPrefix(value(row, name)));
    const stem = value(row, '题干');
    const book = value(row, '书目');
    if (!sceneId) {
      errors.push(`${path.basename(file)}:${rowNumber}: unsupported ${game}/${scene}`);
      return;
    }
    if (!grade || answer == null || options.some((option) => !option)) {
      errors.push(`${path.basename(file)}:${rowNumber}: invalid grade, answer, or option`);
      return;
    }
    const key = contentKeyOf(stem, options, answer);
    if (contentKeys.has(key)) return;
    contentKeys.add(key);
    if (value(row, '启用状态') !== '启用') return;
    booksSeen.add(book);
    const difficulty = difficulties[imported.length % difficulties.length];
    imported.push({
      id: stableId(grade, book, stem, options),
      packId: 'customer-20260724-batch3',
      games: [targetGame],
      scenes: [sceneId],
      grade,
      term: 'ALL',
      difficulty,
      type: value(row, '题型') || '阅读',
      knowledgePoint: book,
      stemType: value(row, '题干类型') === '图片+文字' ? 'image-text' : 'text',
      stem,
      options,
      correctIndex: answer,
      explain: `正确答案是“${options[answer]}”。`,
      correctFeedback: '答对了，继续向下一关前进！',
      wrongFeedback: '别着急，看看正确答案再继续。',
      source: `客户题库0724/${gradeLabel}/${book}`,
      enabled: true,
      weight: Number(value(row, '排序权重')) || 10,
    });
  });
}

if (errors.length) throw new Error(`Customer bank import failed:\n${errors.join('\n')}`);
if (imported.length < 200) {
  throw new Error(`Only ${imported.length} new customer questions were imported from batch 0724`);
}
if (booksSeen.size !== 10) {
  throw new Error(`Expected 10 new books, got ${booksSeen.size}: ${[...booksSeen].join(', ')}`);
}

const ids = new Set(kept.map((q) => q.id));
for (const question of imported) {
  if (ids.has(question.id)) throw new Error(`Generated duplicate id: ${question.id}`);
  ids.add(question.id);
}

const questions = [...kept, ...imported];
const allBooks = new Set(questions.filter((q) => q.enabled).map((q) => q.knowledgePoint));
const bank = {
  version: target.version,
  contentStatus: 'customer-provided',
  generatedAt: new Date().toISOString(),
  importNotes: {
    source: input,
    previousVersion: existing.version ?? null,
    previousCount: kept.length,
    batch3Added: imported.length,
    batch3Books: [...booksSeen].sort(),
    totalBooks: allBooks.size,
    customerScenes: [...target.scenes.values()],
    inferredField: 'difficulty assigned round-robin because customer files do not provide it',
  },
  questions,
};
await fs.writeFile(output, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  game: targetGame,
  previous: kept.length,
  added: imported.length,
  total: questions.length,
  batch3Books: [...booksSeen].sort(),
  totalBooks: allBooks.size,
  workbooks: files.length,
  version: target.version,
  out: output,
}, null, 2));
