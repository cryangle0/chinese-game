import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ci from 'miniprogram-ci';

const projectPath = path.resolve('mp-shell');
const projectConfigPath = path.join(projectPath, 'project.config.json');
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
const appid = projectConfig.appid;
const checkOnly = process.argv.includes('--check');
const version = process.env.MP_VERSION?.trim();
const desc = process.env.MP_DESC?.trim();
const configuredPrivateKeyPath = process.env.MP_PRIVATE_KEY_PATH?.trim();
const privateKeyPath = configuredPrivateKeyPath
  ? path.resolve(configuredPrivateKeyPath)
  : '';

if (!/^wx[0-9a-f]{16}$/.test(appid)) {
  throw new Error(`Invalid mini-program AppID in ${projectConfigPath}`);
}
if (!checkOnly && (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))) {
  throw new Error('Set MP_VERSION to a semantic version such as 1.0.0');
}
if (!checkOnly && !desc) {
  throw new Error('Set MP_DESC to a short upload description');
}
if (!checkOnly && !privateKeyPath) {
  throw new Error('Set MP_PRIVATE_KEY_PATH to a private key stored outside the project');
}
if (privateKeyPath && !fs.existsSync(privateKeyPath)) {
  throw new Error(`Mini-program private key not found: ${privateKeyPath}`);
}

if (checkOnly) {
  console.log(`Mini-program upload config ok: ${appid}; external key required for upload`);
} else {
  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath,
    privateKeyPath,
    ignores: ['node_modules/**/*'],
  });
  const releaseGate = spawnSync(
    process.execPath,
    ['tools/mp/validate-shell.mjs', '--release'],
    { cwd: process.cwd(), stdio: 'inherit' },
  );
  if (releaseGate.status !== 0) {
    throw new Error('Mini-program release gate failed; upload aborted');
  }

  await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      codeProtect: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: console.log,
  });

  console.log(`Mini-program upload completed: ${appid} ${version}`);
}
