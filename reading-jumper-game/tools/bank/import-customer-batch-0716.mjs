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
  version: 'customer-writing-20260716-batch1',
  scenes: new Map([
    ['经典挖宝', 'treasure'], ['沙漠探险', 'desert'], ['恐龙世界', 'dinosaur'],
    ['敦煌壁画', 'dunhuang'], ['魔法学院', 'magic'],
  ]),
} : {
  sourceGame: '跳跳乐',
  version: 'customer-reading-20260716-batch1',
  scenes: new Map([
    ['马里奥', 'mario'], ['深海龙宫', 'deep-sea'], ['星际穿越', 'space'],
    ['美食大冒险', 'food'], ['诗词山水', 'poetry'],
  ]),
};
const difficulties = ['basic', 'advanced', 'challenge'];
const errors = [];
const questions = [];
const contentKeys = new Set();

if (!process.argv[2]) throw new Error('Usage: node import-customer-batch-0716.mjs <xlsx-directory>');

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
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function stableId(grade, book, stem, options) {
  const digest = crypto.createHash('sha1')
    .update(JSON.stringify([grade, book, stem, options]))
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `CB0716_${targetGame === 'writing-treasure' ? 'WT' : 'RJ'}_${grade}_${digest}`;
}

function stripOptionPrefix(value) {
  return value.replace(/^[ABCＡＢＣ][.．、:：]\s*/u, '').trim();
}

const files = (await filesBelow(input)).filter((file) => file.toLowerCase().endsWith('.xlsx')).sort();
for (const file of files) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet('终')
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
    const contentKey = JSON.stringify([stem, options, answer]);
    if (contentKeys.has(contentKey)) return;
    contentKeys.add(contentKey);
    const enabled = value(row, '启用状态') === '启用';
    if (!enabled) return;
    const difficulty = difficulties[questions.length % difficulties.length];
    questions.push({
      id: stableId(grade, book, stem, options),
      packId: target.version,
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
      source: `客户题库0716/${gradeLabel}/${book}`,
      enabled: true,
      weight: Number(value(row, '排序权重')) || 10,
    });
  });
}

if (errors.length) throw new Error(`Customer bank import failed:\n${errors.join('\n')}`);
if (questions.length < 50) throw new Error(`Only ${questions.length} customer questions were imported`);
const ids = new Set();
for (const question of questions) {
  if (ids.has(question.id)) throw new Error(`Generated duplicate id: ${question.id}`);
  ids.add(question.id);
}

const bank = {
  version: target.version,
  contentStatus: 'customer-provided',
  generatedAt: new Date().toISOString(),
  importNotes: {
    source: input,
    customerScenes: [...target.scenes.values()],
    inferredField: 'difficulty assigned round-robin because customer files do not provide it',
  },
  questions,
};
await fs.writeFile(output, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(`Imported ${questions.length} ${targetGame} questions from ${files.length} workbooks.`);
