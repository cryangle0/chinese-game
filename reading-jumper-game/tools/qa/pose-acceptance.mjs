/**
 * Verify production pose behavior against wxgame-jumper-new commit a2677a2.
 * Run: node tools/qa/pose-acceptance.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'test-results', 'pose-reference-parity');
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(import.meta.url);
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', esModuleInterop: true },
});
const { PoseInputMapper } = require(
  path.join(root, 'assets/scripts/platform/pose/PoseInputMapper.ts'),
);

const pose = JSON.parse(
  fs.readFileSync(path.join(root, 'config/runtime-config.json'), 'utf8'),
).pose;
const expectedConfig = {
  movementSensitivity: 1,
  moveDebounceMs: 150,
  jumpCooldownMs: 700,
  enterThreshold: 0.1,
  returnThreshold: 0.04,
  smoothingAlpha: 0.35,
  jumpThreshold: 0.045,
};

function capture(samples) {
  const mapper = new PoseInputMapper(pose);
  return samples.map((sample) => ({
    at: sample.t,
    ...mapper.push(
      { x: sample.x, y: sample.y, score: sample.score ?? 0.9 },
      sample.t,
      sample.actionsEnabled ?? true,
    ),
  }));
}

const movement = capture([
  { x: 0.2, y: 0.5, t: 0 },
  { x: 0.2, y: 0.5, t: 83 },
  { x: 0.2, y: 0.5, t: 166 },
]);
const jump = capture([
  { x: 0.5, y: 0.5, t: 0 },
  { x: 0.5, y: 0.35, t: 83 },
  { x: 0.5, y: 0.5, t: 166 },
  { x: 0.5, y: 0.5, t: 249 },
  { x: 0.5, y: 0.35, t: 664 },
  { x: 0.5, y: 0.5, t: 747 },
  { x: 0.5, y: 0.35, t: 830 },
]);
const disabled = capture([
  { x: 0.5, y: 0.5, t: 0 },
  { x: 0.5, y: 0.35, t: 83, actionsEnabled: false },
  { x: 0.5, y: 0.35, t: 100, actionsEnabled: true },
]);

const checks = [
  {
    name: '生产参数与参考提交 a2677a2 一致',
    pass: JSON.stringify(pose) === JSON.stringify(expectedConfig),
    actual: pose,
    expected: expectedConfig,
  },
  {
    name: '横向进入侧区持续 150ms 后切换到左列',
    pass: movement.at(-1)?.column === 0,
    actual: movement,
    expected: '最后一帧 column=0',
  },
  {
    name: '跳跃阈值 0.045 可触发，700ms 冷却内不重复触发',
    pass: jump[1]?.jump === true
      && jump.slice(2, 6).every((item) => item.jump !== true)
      && jump[6]?.jump === true,
    actual: jump,
    expected: '83ms 与 830ms 触发，其间不触发',
  },
  {
    name: '答题禁用期间不消耗下一次跳跃冷却',
    pass: disabled[1]?.jump !== true && disabled[2]?.jump === true,
    actual: disabled,
    expected: '禁用帧不触发，恢复后立即可触发',
  },
];

const report = {
  title: '阅读跳跳乐体感参考项目一致性验收',
  generatedAt: new Date().toISOString(),
  referenceProject: 'E:\\angsa\\wxgame-jumper-new',
  referenceCommit: 'a2677a2',
  allPass: checks.every((check) => check.pass),
  checks,
};

fs.writeFileSync(
  path.join(outDir, 'pose-reference-parity.json'),
  JSON.stringify(report, null, 2),
);
fs.writeFileSync(path.join(outDir, 'pose-reference-parity.html'), renderHtml(report));
console.log(JSON.stringify({
  allPass: report.allPass,
  outDir,
  checks: checks.map(({ name, pass }) => ({ name, pass })),
}, null, 2));
process.exit(report.allPass ? 0 : 1);

function renderHtml(value) {
  const rows = value.checks.map((check) => `
    <tr class="${check.pass ? 'pass' : 'fail'}">
      <td>${check.pass ? 'PASS' : 'FAIL'}</td>
      <td>${escapeHtml(check.name)}</td>
      <td><pre>${escapeHtml(JSON.stringify(check.actual, null, 2))}</pre></td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(value.title)}</title>
<style>
body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;margin:24px;color:#17202a}
h1{font-size:24px}.meta{line-height:1.7;color:#52616b}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:10px;border:1px solid #d7dde3;text-align:left;vertical-align:top}
th{background:#f4f6f8}.pass td:first-child{color:#067647;font-weight:700}
.fail td:first-child{color:#b42318;font-weight:700}
pre{margin:0;white-space:pre-wrap;font-size:12px}
</style>
</head>
<body>
<h1>${escapeHtml(value.title)}</h1>
<div class="meta">参考提交：${value.referenceCommit}<br>生成时间：${value.generatedAt}</div>
<table><thead><tr><th>结果</th><th>验收项</th><th>实际数据</th></tr></thead>
<tbody>${rows}</tbody></table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
