import crypto from 'node:crypto';
import process from 'node:process';

const baseUrl = (process.env.DEPLOY_BASE_URL ?? '').replace(/\/$/, '');
const expectedIndexHash = process.env.DEPLOY_EXPECTED_INDEX_SHA256?.toLowerCase();
const expectedBankHash = process.env.DEPLOY_EXPECTED_BANK_SHA256?.toLowerCase();
if (!baseUrl) throw new Error('Set DEPLOY_BASE_URL before verification');

const nonce = Date.now();
const index = await fetchBytes(`${baseUrl}/index.html?verify=${nonce}`, 'text/html');
const bankFile = await fetchBytes(
  `${baseUrl}/question-bank.json?verify=${nonce}`,
  'application/json',
);
const bank = JSON.parse(bankFile.bytes.toString('utf8'));
if (!Array.isArray(bank.questions) || bank.questions.length < 250) {
  throw new Error(`Question bank contains only ${bank.questions?.length ?? 0} questions`);
}

const indexText = index.bytes.toString('utf8');
if (/jweixin/i.test(indexText) && !/<script[^>]*\basync\b[^>]*jweixin|<script[^>]*jweixin[^>]*\basync\b/i.test(indexText)) {
  throw new Error('WeChat JSSDK script is not asynchronous');
}
verifyHash('index.html', index.sha256, expectedIndexHash);
verifyHash('question-bank.json', bankFile.sha256, expectedBankHash);

console.log(JSON.stringify({
  baseUrl,
  indexSha256: index.sha256,
  bankSha256: bankFile.sha256,
  bankVersion: bank.version,
  contentStatus: bank.contentStatus,
  questions: bank.questions.length,
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
