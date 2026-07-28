import crypto from 'node:crypto';
import process from 'node:process';

const baseUrl = (process.env.DEPLOY_BASE_URL ?? '').replace(/\/$/, '');
const expectedIndexHash = process.env.DEPLOY_EXPECTED_INDEX_SHA256?.toLowerCase();
const expectedBankHash = process.env.DEPLOY_EXPECTED_BANK_SHA256?.toLowerCase();
const expectedRuntimeConfigHash =
  process.env.DEPLOY_EXPECTED_RUNTIME_CONFIG_SHA256?.toLowerCase();
if (!baseUrl) throw new Error('Set DEPLOY_BASE_URL before verification');

const nonce = Date.now();
const index = await fetchBytes(`${baseUrl}/index.html?verify=${nonce}`, 'text/html');
const bankFile = await fetchBytes(
  `${baseUrl}/question-bank.json?verify=${nonce}`,
  'application/json',
);
const runtimeConfigFile = await fetchBytes(
  `${baseUrl}/runtime-config.json?verify=${nonce}`,
  'application/json',
);
const modelFile = await fetchBytes(
  `${baseUrl}/models/movenet/singlepose-lightning-v4/model.json?verify=${nonce}`,
  'application/json',
);
await fetchRange(
  `${baseUrl}/models/movenet/singlepose-lightning-v4/group1-shard1of2.bin?verify=${nonce}`,
  'application/octet-stream',
);
await fetchRange(`${baseUrl}/vendor/pose-detection.js?verify=${nonce}`, 'javascript');
const bank = JSON.parse(bankFile.bytes.toString('utf8'));
const runtimeConfig = JSON.parse(runtimeConfigFile.bytes.toString('utf8'));
const model = JSON.parse(modelFile.bytes.toString('utf8'));
if (!Array.isArray(bank.questions) || bank.questions.length < 250) {
  throw new Error(`Question bank contains only ${bank.questions?.length ?? 0} questions`);
}
if (!Array.isArray(model.weightsManifest) || !model.weightsManifest.length) {
  throw new Error('MoveNet model manifest is invalid');
}
const movementSensitivity = runtimeConfig?.pose?.movementSensitivity;
if (!Number.isFinite(movementSensitivity)
  || movementSensitivity < 0.5 || movementSensitivity > 2) {
  throw new Error('Runtime pose movement sensitivity is invalid');
}

const indexText = index.bytes.toString('utf8');
if (/jweixin/i.test(indexText) && !/<script[^>]*\basync\b[^>]*jweixin|<script[^>]*jweixin[^>]*\basync\b/i.test(indexText)) {
  throw new Error('WeChat JSSDK script is not asynchronous');
}
verifyHash('index.html', index.sha256, expectedIndexHash);
verifyHash('question-bank.json', bankFile.sha256, expectedBankHash);
verifyHash('runtime-config.json', runtimeConfigFile.sha256, expectedRuntimeConfigHash);

console.log(JSON.stringify({
  baseUrl,
  indexSha256: index.sha256,
  bankSha256: bankFile.sha256,
  bankVersion: bank.version,
  contentStatus: bank.contentStatus,
  questions: bank.questions.length,
  runtimeConfigSha256: runtimeConfigFile.sha256,
  movementSensitivity,
  poseModelSha256: modelFile.sha256,
}, null, 2));

async function fetchBytes(url, expectedType) {
  const response = await fetch(url, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'follow',
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.toLowerCase().includes(expectedType)) {
    throw new Error(`${url} returned HTTP ${response.status} ${contentType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function verifyHash(name, actual, expected) {
  if (expected && actual !== expected) {
    throw new Error(`${name} hash mismatch: expected ${expected}, got ${actual}`);
  }
}

async function fetchRange(url, expectedType) {
  const response = await fetch(url, {
    headers: { range: 'bytes=0-31', 'cache-control': 'no-cache' },
  });
  const type = response.headers.get('content-type') ?? '';
  if (![200, 206].includes(response.status) || !type.toLowerCase().includes(expectedType)) {
    throw new Error(`${url} returned HTTP ${response.status} ${type}`);
  }
  if ((await response.arrayBuffer()).byteLength < 1) throw new Error(`${url} is empty`);
}
