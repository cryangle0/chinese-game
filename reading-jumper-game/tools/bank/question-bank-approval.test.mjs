import assert from 'node:assert/strict';
import test from 'node:test';
import {
  questionBankContentSha256,
  validateQuestionBankApproval,
} from './question-bank-approval.mjs';

function bankFixture() {
  return {
    version: 'customer-reading-test',
    contentStatus: 'approved',
    questions: [{
      id: 'Q1',
      stem: 'Question',
      options: ['A', 'B', 'C'],
      correctIndex: 0,
    }],
  };
}

function approve(bank) {
  bank.approval = {
    approvedBy: 'Customer reviewer',
    approvedAt: '2026-07-18T10:00:00.000Z',
    reference: 'Written approval record',
    contentSha256: questionBankContentSha256(bank),
  };
  return bank;
}

test('content fingerprint is stable across object key order', () => {
  const first = bankFixture();
  const second = {
    questions: [{
      correctIndex: 0,
      options: ['A', 'B', 'C'],
      stem: 'Question',
      id: 'Q1',
    }],
    contentStatus: 'approved',
    version: 'customer-reading-test',
  };
  assert.equal(questionBankContentSha256(first), questionBankContentSha256(second));
});

test('approval metadata is required for release', () => {
  assert.deepEqual(
    validateQuestionBankApproval(bankFixture()),
    ['release question bank requires traceable approval metadata'],
  );
});

test('approval fingerprint rejects content changed after approval', () => {
  const bank = approve(bankFixture());
  bank.questions[0].stem = 'Changed question';
  assert.match(
    validateQuestionBankApproval(bank, new Date('2026-07-18T12:00:00.000Z')).join('\n'),
    /fingerprint mismatch/,
  );
});

test('traceable approval for unchanged content passes', () => {
  const bank = approve(bankFixture());
  assert.deepEqual(
    validateQuestionBankApproval(bank, new Date('2026-07-18T12:00:00.000Z')),
    [],
  );
});
