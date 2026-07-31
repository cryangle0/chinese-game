/**
 * Verify production pose behavior, including the stable interaction-position gate.
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
  minimumBodyScale: 0.16,
  maximumBodyScale: 0.38,
  interactionStableMs: 700,
  interactionCenterTolerance: 0.22,
  interactionScaleTolerance: 0.025,
  interactionPositionTolerance: 0.055,
};

function capture(samples, overrides = {}) {
  const mapper = new PoseInputMapper({ ...pose, ...overrides });
  return samples.map((item) => ({
    at: item.t,
    ...mapper.push(
      {
        x: item.x,
        y: item.y,
        score: item.score ?? 0.9,
        bodyScale: item.bodyScale ?? 0.25,
        bodyScaleScore: item.bodyScaleScore ?? item.score ?? 0.9,
      },
      item.t,
      item.actionsEnabled ?? true,
    ),
  }));
}

const movement = capture([
  { x: 0.5, y: 0.5, t: 0 },
  { x: 0.5, y: 0.5, t: 700 },
  { x: 0.32, y: 0.5, t: 710 },
  { x: 0.32, y: 0.5, t: 793 },
  { x: 0.32, y: 0.5, t: 876 },
  { x: 0.32, y: 0.5, t: 959 },
  { x: 0.32, y: 0.5, t: 1125 },
]);
const jump = capture([
  { x: 0.5, y: 0.5, t: 0 },
  { x: 0.5, y: 0.5, t: 700 },
  { x: 0.5, y: 0.35, t: 783 },
  { x: 0.5, y: 0.5, t: 866 },
  { x: 0.5, y: 0.35, t: 1200 },
  { x: 0.5, y: 0.5, t: 1400 },
  { x: 0.5, y: 0.35, t: 1490 },
]);
const disabled = capture([
  { x: 0.5, y: 0.5, t: 0 },
  { x: 0.5, y: 0.5, t: 700 },
  { x: 0.5, y: 0.35, t: 783, actionsEnabled: false },
  { x: 0.5, y: 0.35, t: 800, actionsEnabled: true },
]);
const positioning = capture([
  { x: 0.5, y: 0.68, bodyScale: 0.5, t: 0 },
  { x: 0.56, y: 0.62, bodyScale: 0.35, t: 100 },
  { x: 0.54, y: 0.56, bodyScale: 0.31, t: 300 },
  ...Array.from({ length: 17 }, (_, index) => ({
    x: 0.5,
    y: 0.5,
    bodyScale: 0.25,
    t: 500 + index * 100,
  })),
], { smoothingAlpha: 1 });

const checks = [
  {
    name: 'Production config includes the one-meter interaction gate',
    pass: JSON.stringify(pose) === JSON.stringify(expectedConfig),
    actual: pose,
    expected: expectedConfig,
  },
  {
    name: 'Lateral movement is enabled after stable positioning',
    pass: movement.some((item) => item.column === 0),
    actual: movement,
    expected: 'Last sample emits column=0',
  },
  {
    name: 'Jump remains available after positioning and respects cooldown',
    pass: jump[2]?.jump === true
      && jump.slice(3, 6).every((item) => item.jump !== true)
      && jump[6]?.jump === true,
    actual: jump,
    expected: '783ms and 1490ms trigger; intermediate samples do not',
  },
  {
    name: 'Disabled answer input does not consume the next jump',
    pass: disabled[2]?.jump !== true && disabled[3]?.jump === true,
    actual: disabled,
    expected: 'Disabled sample does not trigger; enabled sample triggers',
  },
  {
    name: 'Standing and backing away cannot select or jump before stable',
    pass: positioning.slice(0, 3).every((item) => (
      item.interactionReady === false
      && item.column === undefined
      && item.jump === undefined
    ))
      && positioning.every((item) => item.column === undefined && item.jump === undefined)
      && positioning.at(-1)?.interactionReady === true,
    actual: positioning,
    expected: 'Only the final stable sample arms interaction',
  },
];

const report = {
  title: 'Reading Jumper pose interaction acceptance',
  generatedAt: new Date().toISOString(),
  referenceProject: 'reading-jumper-game',
  referenceCommit: 'one-meter-interaction-gate',
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
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(value.title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#17202a}
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
<div class="meta">Reference: ${value.referenceCommit}<br>Generated: ${value.generatedAt}</div>
<table><thead><tr><th>Result</th><th>Acceptance check</th><th>Actual data</th></tr></thead>
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
