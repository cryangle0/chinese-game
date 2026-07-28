/**
 * Apply customer full-question replacements from 整题修改内容-0727.xlsx
 * into reading-jumper + writing-treasure banks.
 *
 * Usage:
 *   node tools/bank/apply-full-replace-0727.mjs [xlsx]
 *   node tools/bank/apply-full-replace-0727.mjs --dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../../..');
const dryRun = process.argv.includes('--dry-run');
const xlsx = path.resolve(
  process.argv.find((arg) => arg.endsWith('.xlsx'))
  ?? path.join(workspace, '客户提供的题库', '整题修改内容-0727.xlsx'),
);

const gradeMap = new Map([
  ['一年级', 'L1'], ['二年级', 'L2'], ['三年级', 'L3'],
  ['四年级', 'L4'], ['五年级', 'L5'], ['六年级', 'L6'],
]);
const answerMap = new Map([['A', 0], ['B', 1], ['C', 2]]);
const banks = {
  跳跳乐: {
    game: 'reading-jumper',
    file: path.join(workspace, 'reading-jumper-game', 'config', 'question-bank.json'),
    scenes: new Map([
      ['马里奥', 'mario'], ['深海龙宫', 'deep-sea'], ['星际穿越', 'space'],
      ['美食大冒险', 'food'], ['诗词山水', 'poetry'],
    ]),
  },
  挖宝: {
    game: 'writing-treasure',
    file: path.join(workspace, 'writing-treasure-game', 'config', 'question-bank.json'),
    scenes: new Map([
      ['经典挖宝', 'treasure'], ['沙漠探险', 'desert'], ['恐龙世界', 'dinosaur'],
      ['敦煌壁画', 'dunhuang'], ['魔法学院', 'magic'],
    ]),
  },
};

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

function stripOptionPrefix(value) {
  return value.replace(/^[ABCＡＢＣ][.．、:：]\s*/u, '').trim();
}

function normalizeStem(stem) {
  return stem
    .replace(/[（(]\s*[）)]/g, '____')
    .replace(/_{2,}/g, '____')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function stemTokens(stem) {
  const quoted = [...stem.matchAll(/[“"]([^”"]+)[”"]|《([^》]+)》/g)]
    .map((match) => match[1] || match[2])
    .filter(Boolean);
  const chunks = stem
    .replace(/[“”"《》？?，,。.!！：:；;（）()_—\-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return [...new Set([...quoted, ...chunks])];
}

function optionsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function optionOverlap(left, right) {
  const set = new Set(left);
  return right.filter((option) => set.has(option)).length;
}

function scoreCandidate(question, replacement) {
  let score = 0;
  if (question.stem === replacement.stem) score += 100;
  const left = normalizeStem(question.stem);
  const right = normalizeStem(replacement.stem);
  if (left === right) score += 80;
  if (left.includes(right) || right.includes(left)) score += 35;
  for (const token of stemTokens(replacement.stem)) {
    if (question.stem.includes(token)) score += Math.min(12, token.length * 2);
  }
  if (optionsEqual(question.options, replacement.options)) score += 60;
  else score += optionOverlap(question.options, replacement.options) * 12;
  if (question.correctIndex === replacement.correctIndex) score += 4;
  // Prefer blanks / measure-word style continuity when both contain blanks.
  if (/_{2,}|\( {0,2}\)|（ {0,2}）/.test(question.stem)
    && /_{2,}|\( {0,2}\)|（ {0,2}）|____/.test(replacement.stem)) {
    score += 18;
  }
  // Word-meaning pattern: “xxx”中，“yyy”意思/形容
  if (/[“"].+[”"].*(意思|形容|可以用来)/.test(question.stem)
    && /[“"].+[”"].*(意思|形容|可以用来)/.test(replacement.stem)) {
    score += 25;
  }
  // Rhetorical / sentence-effect pattern.
  if (/(反问|修辞|作用|好处|效果|句式)/.test(question.stem)
    && /(反问|修辞|作用|好处|效果|句式)/.test(replacement.stem)) {
    score += 20;
  }
  // Explanation-method pattern.
  if (/(说明方法|列数字|打比方|举例子)/.test(`${question.stem}${question.options.join('')}`)
    && /(说明方法|列数字|打比方|举例子)/.test(`${replacement.stem}${replacement.options.join('')}`)) {
    score += 25;
  }
  return score;
}

async function loadReplacements() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsx);
  const sheet = workbook.worksheets[0];
  const columns = new Map();
  sheet.getRow(1).eachCell((cell, column) => columns.set(text(cell.value), column));
  const required = [
    '适用游戏', '适用场景', '年级', '书目', '题干',
    '选项A', '选项B', '选项C', '正确答案',
  ];
  const missing = required.filter((name) => !columns.has(name));
  if (missing.length) throw new Error(`Excel missing columns: ${missing.join(', ')}`);
  const value = (row, name) => text(row.getCell(columns.get(name)).value);
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !row.hasValues || !value(row, '题干')) return;
    const gameLabel = value(row, '适用游戏');
    const bank = banks[gameLabel];
    if (!bank) throw new Error(`row ${rowNumber}: unknown game ${gameLabel}`);
    const sceneLabel = value(row, '适用场景');
    const sceneId = bank.scenes.get(sceneLabel);
    const grade = gradeMap.get(value(row, '年级'));
    const answer = answerMap.get(value(row, '正确答案').toUpperCase());
    const options = ['选项A', '选项B', '选项C'].map((name) => stripOptionPrefix(value(row, name)));
    if (!sceneId || !grade || answer == null || options.some((option) => !option)) {
      throw new Error(`row ${rowNumber}: invalid scene/grade/answer/options`);
    }
    rows.push({
      rowNumber,
      gameLabel,
      bank,
      sceneId,
      grade,
      book: value(row, '书目'),
      type: value(row, '题型') || undefined,
      stemType: value(row, '题干类型') === '图片+文字' ? 'image-text' : 'text',
      stem: value(row, '题干'),
      options,
      correctIndex: answer,
      enabled: value(row, '启用状态') !== '停用',
      weight: Number(value(row, '排序权重')) || 10,
      note: value(row, '备注（截图替换的题目）'),
    });
  });
  return rows;
}

const replacements = await loadReplacements();
const report = [];
const touchedFiles = new Map();

for (const replacement of replacements) {
  let bank = touchedFiles.get(replacement.bank.file);
  if (!bank) {
    bank = JSON.parse(await fs.readFile(replacement.bank.file, 'utf8'));
  }
  const pool = bank.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) =>
      question.knowledgePoint === replacement.book
      && question.grade === replacement.grade
      && question.scenes?.includes(replacement.sceneId));
  if (!pool.length) {
    throw new Error(
      `row ${replacement.rowNumber}: no pool for `
      + `${replacement.gameLabel}/${replacement.book}/${replacement.grade}/${replacement.sceneId}`,
    );
  }
  const ranked = pool
    .map(({ question, index }) => ({
      question,
      index,
      score: scoreCandidate(question, replacement),
    }))
    .sort((left, right) => right.score - left.score);
  if (!ranked.length || ranked[0].score < 20) {
    throw new Error(
      `row ${replacement.rowNumber}: no match for ${replacement.gameLabel}/${replacement.book}/${replacement.stem}`,
    );
  }
  const best = ranked[0];
  const second = ranked[1];
  if (second && best.score - second.score < 12 && best.question.id !== second.question.id) {
    throw new Error(
      `row ${replacement.rowNumber}: ambiguous match `
      + `${best.question.id}(${best.score}) vs ${second.question.id}(${second.score})`,
    );
  }
  const before = {
    id: best.question.id,
    stem: best.question.stem,
    options: [...best.question.options],
    correctIndex: best.question.correctIndex,
  };
  const next = {
    ...best.question,
    stem: replacement.stem,
    options: replacement.options,
    correctIndex: replacement.correctIndex,
    stemType: replacement.stemType,
    explain: `正确答案是“${replacement.options[replacement.correctIndex]}”。`,
    enabled: replacement.enabled,
    weight: replacement.weight,
    source: `${String(best.question.source ?? 'customer').split('|')[0]}|full-replace-0727`,
  };
  if (replacement.type) next.type = replacement.type;
  bank.questions[best.index] = next;
  bank.version = `${String(bank.version ?? 'customer').replace(/-full-replace-0727$/, '')}-full-replace-0727`;
  bank.generatedAt = new Date().toISOString();
  bank.importNotes = {
    ...(bank.importNotes ?? {}),
    fullReplace0727: {
      xlsx,
      appliedAt: bank.generatedAt,
      count: replacements.filter((row) => row.bank.file === replacement.bank.file).length,
    },
  };
  touchedFiles.set(replacement.bank.file, bank);
  report.push({
    row: replacement.rowNumber,
    game: replacement.bank.game,
    matchedId: before.id,
    score: best.score,
    before,
    after: {
      stem: next.stem,
      options: next.options,
      correctIndex: next.correctIndex,
    },
  });
}

if (!dryRun) {
  for (const [file, bank] of touchedFiles) {
    await fs.writeFile(file, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  }
}

console.log(JSON.stringify({
  dryRun,
  xlsx,
  replaced: report.length,
  files: [...touchedFiles.keys()],
  report,
}, null, 2));
