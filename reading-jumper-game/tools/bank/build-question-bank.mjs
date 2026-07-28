import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const GAME_MAP = {
  跳跳乐: ['reading-jumper'],
  通用: ['reading-jumper'],
};
const EXCLUDED_GAME_LABEL = '挖宝';
const SCENE_MAP = {
  超级玛丽: 'mario',
  深海龙宫: 'deep-sea',
  星际穿越: 'space',
  诗词山水: 'poetry',
  美食大冒险: 'food',
  魔法学院: 'magic',
  沙漠探险: 'desert',
  恐龙世界: 'dinosaur',
  敦煌壁画: 'dunhuang',
  通用: '*',
};
const GRADE_MAP = {
  一年级: 'L1', 二年级: 'L2', 三年级: 'L3',
  四年级: 'L4', 五年级: 'L5', 六年级: 'L6', 通用: 'ALL',
};
const TERM_MAP = { 上学期: 'first', 下学期: 'second', 通用: 'ALL', '': 'ALL' };
const DIFFICULTY_MAP = { 基础: 'basic', 提升: 'advanced', 挑战: 'challenge' };
const STEM_TYPE_MAP = { 纯文字: 'text', '图片+文字': 'image-text' };
const ANSWER_MAP = { A: 0, B: 1, C: 2 };
const SCENES_BY_GAME = {
  'reading-jumper': new Set(['mario', 'deep-sea', 'space', 'food', 'poetry']),
};
const REQUIRED = [
  '题目包ID', '适用游戏', '适用场景', '年级', '题型', '知识点', '难度',
  '题干类型', '题干', '选项A', '选项B', '选项C', '正确答案', '启用状态',
];

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return String(value).trim();
}

function value(row, columns, name) {
  return text(row.getCell(columns.get(name)).value);
}

function buildQuestion(row, columns, rowNumber) {
  const errors = [];
  for (const field of REQUIRED) {
    if (!value(row, columns, field)) errors.push(`${field}不能为空`);
  }
  const gameLabel = value(row, columns, '适用游戏');
  const sceneLabel = value(row, columns, '适用场景');
  const gradeLabel = value(row, columns, '年级');
  const difficultyLabel = value(row, columns, '难度');
  const stemTypeLabel = value(row, columns, '题干类型');
  const answerLabel = value(row, columns, '正确答案').toUpperCase();
  const termLabel = value(row, columns, '学期');
  const weightText = value(row, columns, '排序权重');
  const weight = weightText === '' ? 0 : Number(weightText);
  if (!GAME_MAP[gameLabel]) errors.push(`不支持的适用游戏：${gameLabel}`);
  if (!SCENE_MAP[sceneLabel]) errors.push(`不支持的适用场景：${sceneLabel}`);
  if (!GRADE_MAP[gradeLabel]) errors.push(`不支持的年级：${gradeLabel}`);
  if (!DIFFICULTY_MAP[difficultyLabel]) errors.push(`不支持的难度：${difficultyLabel}`);
  if (!STEM_TYPE_MAP[stemTypeLabel]) errors.push(`不支持的题干类型：${stemTypeLabel}`);
  if (termLabel && !TERM_MAP[termLabel]) errors.push(`不支持的学期：${termLabel}`);
  if (ANSWER_MAP[answerLabel] == null) errors.push(`正确答案必须为 A/B/C`);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    errors.push('排序权重必须是0到100之间的数字');
  }
  const gameIds = GAME_MAP[gameLabel] ?? [];
  const sceneId = SCENE_MAP[sceneLabel];
  if (sceneId && sceneId !== '*' && gameIds.some((game) => !SCENES_BY_GAME[game]?.has(sceneId))) {
    errors.push(`场景「${sceneLabel}」与游戏「${gameLabel}」不匹配`);
  }
  const stem = value(row, columns, '题干');
  if (stem.length > 80) errors.push('题干超过80字');
  for (const option of ['选项A', '选项B', '选项C']) {
    if (value(row, columns, option).length > 20) errors.push(`${option}超过20字`);
  }
  const imageUrl = value(row, columns, '题干配图URL');
  if (STEM_TYPE_MAP[stemTypeLabel] === 'image-text' && !/^https?:\/\//i.test(imageUrl)) {
    errors.push('图片+文字题必须填写HTTP(S)题干配图URL');
  }
  if (value(row, columns, '答案解析').length > 200) errors.push('答案解析超过200字');
  for (const field of ['答对反馈文案', '答错反馈文案']) {
    if (value(row, columns, field).length > 40) errors.push(`${field}超过40字`);
  }
  if (errors.length) return { errors: errors.map((error) => `第${rowNumber}行：${error}`) };
  const packId = value(row, columns, '题目包ID');
  const generatedId = `${gameLabel}_${sceneLabel}_${String(rowNumber - 1).padStart(4, '0')}`;
  const isSample = value(row, columns, '备注').includes('示例行');
  return {
    question: {
      id: value(row, columns, '题目ID') || generatedId,
      packId,
      games: GAME_MAP[gameLabel],
      scenes: [SCENE_MAP[sceneLabel]],
      grade: GRADE_MAP[gradeLabel],
      term: TERM_MAP[termLabel] ?? 'ALL',
      difficulty: DIFFICULTY_MAP[difficultyLabel],
      type: value(row, columns, '题型'),
      knowledgePoint: value(row, columns, '知识点'),
      stemType: STEM_TYPE_MAP[stemTypeLabel],
      stem,
      stemImageUrl: imageUrl || undefined,
      options: ['选项A', '选项B', '选项C'].map((name) => value(row, columns, name)),
      correctIndex: ANSWER_MAP[answerLabel],
      explain: value(row, columns, '答案解析') || undefined,
      correctFeedback: value(row, columns, '答对反馈文案') || undefined,
      wrongFeedback: value(row, columns, '答错反馈文案') || undefined,
      source: value(row, columns, '课文/出处') || undefined,
      enabled: value(row, columns, '启用状态') === '启用' && !isSample,
      weight,
    },
  };
}

async function main() {
  const inputArg = arg('--input') || process.argv[2] || '';
  const outputArg = arg('--out') || process.argv[3] || 'config/question-bank.json';
  const input = path.resolve(inputArg);
  const output = path.resolve(outputArg);
  if (!inputArg) throw new Error('用法：--input 题库.xlsx [--out question-bank.json]');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  const sheet = workbook.getWorksheet('题目生产表');
  if (!sheet) throw new Error('缺少「题目生产表」sheet');
  const columns = new Map();
  sheet.getRow(1).eachCell((cell, column) => columns.set(text(cell.value), column));
  const missing = REQUIRED.filter((name) => !columns.has(name));
  if (missing.length) throw new Error(`缺少字段：${missing.join('、')}`);
  const questions = [];
  const errors = [];
  const ids = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !row.hasValues) return;
    if (value(row, columns, '适用游戏') === EXCLUDED_GAME_LABEL) return;
    const result = buildQuestion(row, columns, rowNumber);
    if (result.errors) errors.push(...result.errors);
    if (result.question) {
      if (ids.has(result.question.id)) errors.push(`第${rowNumber}行：题目ID重复`);
      ids.add(result.question.id);
      questions.push(result.question);
    }
  });
  if (errors.length) throw new Error(`题库校验失败：\n${errors.join('\n')}`);
  const minimum = Math.max(1, Number(arg('--min-enabled', '5')) || 5);
  for (const game of Object.keys(SCENES_BY_GAME)) {
    const count = questions.filter((question) => question.enabled && question.games.includes(game)).length;
    if (count < minimum) {
      throw new Error(`${game} 启用题目仅${count}题，少于最低要求${minimum}题`);
    }
  }
  const version = questions[0]?.packId ?? `bank_${Date.now()}`;
  const pack = { version, generatedAt: new Date().toISOString(), questions };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  const enabled = questions.filter((question) => question.enabled).length;
  console.log(`题库构建成功：${questions.length}题（启用${enabled}题），版本 ${version}，输出 ${output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
