import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { questionBankContentSha256 } from './question-bank-approval.mjs';

const bankPath = path.resolve('config/question-bank.json');
const bank = JSON.parse(await fs.readFile(bankPath, 'utf8'));
const contentSha256 = questionBankContentSha256(bank);

if (process.argv.includes('--fingerprint')) {
  console.log(JSON.stringify({
    version: bank.version,
    contentStatus: bank.contentStatus,
    questions: bank.questions?.length ?? 0,
    contentSha256,
  }, null, 2));
  process.exit(0);
}

const approvedBy = process.env.BANK_APPROVED_BY?.trim();
const approvedAt = process.env.BANK_APPROVED_AT?.trim();
const reference = process.env.BANK_APPROVAL_REFERENCE?.trim();
if (process.env.BANK_APPROVAL_CONFIRM !== 'APPROVED') {
  throw new Error('Set BANK_APPROVAL_CONFIRM=APPROVED after receiving explicit content approval');
}
if (!approvedBy || !approvedAt || !reference) {
  throw new Error(
    'Set BANK_APPROVED_BY, BANK_APPROVED_AT, and BANK_APPROVAL_REFERENCE',
  );
}
const approvedAtMs = Date.parse(approvedAt);
if (!Number.isFinite(approvedAtMs)) throw new Error('BANK_APPROVED_AT must be a valid timestamp');
if (approvedAtMs > Date.now() + 5 * 60 * 1000) {
  throw new Error('BANK_APPROVED_AT cannot be in the future');
}

bank.contentStatus = 'approved';
bank.approval = {
  approvedBy,
  approvedAt: new Date(approvedAtMs).toISOString(),
  reference,
  contentSha256,
};
await fs.writeFile(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  version: bank.version,
  contentStatus: bank.contentStatus,
  questions: bank.questions.length,
  approval: bank.approval,
}, null, 2));
