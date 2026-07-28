import fs from 'node:fs';
import path from 'node:path';

const intake = 'E:/angsa/angsa_data/项目/作业帮游戏/_asset-intake/writing-treasure-20260716-unique';
const project = path.resolve(import.meta.dirname, '../..');
const output = path.join(project, 'assets/resources/themes/writing');

const themes = {
  treasure: {
    background: 64, characterIdle: 54, characterAction: 62,
    hudTimer: 59, hudScore: 60, scoreIcon: 67, option: 65,
    feedbackCorrect: 63, feedbackWrong: 61,
    choices: [53, 70, 51], successState: 68, failState: 56,
    resultBackground: 94, resultReference: 83,
    resultReview: 93, resultCorrect: 95, resultRank: 96, resultWrong: 97,
    resultRankBase: 82, resultDecoration: 84, resultStars: [85, 88, 90, 91, 92],
  },
  desert: {
    background: 220, characterIdle: 207, characterAction: 217,
    hudTimer: 209, hudScore: 211, scoreIcon: 221, option: 218,
    feedbackCorrect: 204, feedbackWrong: 216,
    choices: [219, 210, 214], successState: 213, failState: 215,
    resultBackground: 194, resultReference: 188,
  },
  dinosaur: {
    background: 122, characterIdle: 121, characterAction: 130,
    hudTimer: 125, hudScore: 126, scoreIcon: 125, option: 135,
    feedbackCorrect: 139, feedbackWrong: 120,
    choices: [127, 128, 132], successState: 137, failState: 134,
    resultBackground: 113, resultReference: 103,
  },
  dunhuang: {
    background: 39, characterIdle: 31, characterAction: 41,
    hudTimer: 25, hudScore: 36, scoreIcon: 36, option: 37,
    feedbackCorrect: 29, feedbackWrong: 32,
    choices: [40, 23, 42], successState: 38, failState: 28,
    resultBackground: 13, resultReference: 7,
  },
  magic: {
    background: 153, characterIdle: 150, characterAction: 147,
    hudTimer: 159, hudScore: 160, scoreIcon: 168, option: 165,
    feedbackCorrect: 149, feedbackWrong: 148,
    choices: [158, 166, 162], successState: 163, failState: 154,
    resultBackground: 180, resultReference: 172,
    resultReview: 179, resultCorrect: 181, resultRank: 182, resultWrong: 183,
    resultRankBase: 170, resultStars: [178],
  },
};

const manifestText = fs.readFileSync(path.join(intake, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '');
const manifest = JSON.parse(manifestText);
const byIndex = new Map(manifest.map((entry) => [entry.index, entry]));
const audit = {};

function extension(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer.subarray(0, 3).toString('hex') === 'ffd8ff') return '.jpg';
  throw new Error('Unsupported image signature');
}

function importAsset(theme, name, index) {
  const entry = byIndex.get(index);
  if (!entry) throw new Error(`ZIP entry ${index} is missing`);
  const source = path.join(intake, entry.safe);
  const data = fs.readFileSync(source);
  const ext = extension(data);
  const directory = path.join(output, theme);
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, `${name}${ext}`);
  fs.writeFileSync(destination, data);
  audit[theme][name] = {
    zipIndex: index,
    original: entry.original,
    bytes: data.length,
    resource: path.relative(project, destination).replaceAll('\\', '/'),
  };
}

for (const [theme, mapping] of Object.entries(themes)) {
  audit[theme] = {};
  for (const [name, value] of Object.entries(mapping)) {
    if (Array.isArray(value)) {
      value.forEach((index, itemIndex) => importAsset(theme, `${name}-${itemIndex + 1}`, index));
    } else {
      importAsset(theme, name, value);
    }
  }
}

const intro = {
  background: 79,
  title: 76,
  guide: 77,
  start: 78,
  deer: 81,
};
audit.intro = {};
for (const [name, index] of Object.entries(intro)) importAsset('intro', name, index);

const auditPath = path.join(project, 'docs/writing-client-asset-map.json');
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Imported ${Object.values(audit).reduce((sum, item) => sum + Object.keys(item).length, 0)} assets`);
console.log(`Audit: ${auditPath}`);
