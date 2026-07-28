import crypto from 'node:crypto';

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function questionBankContentSha256(bank) {
  const approvedContent = {
    version: bank.version,
    questions: bank.questions,
  };
  return crypto.createHash('sha256')
    .update(stableJson(approvedContent))
    .digest('hex');
}

export function validateQuestionBankApproval(bank, now = new Date()) {
  const errors = [];
  const approval = bank.approval;
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
    return ['release question bank requires traceable approval metadata'];
  }
  if (typeof approval.approvedBy !== 'string' || !approval.approvedBy.trim()) {
    errors.push('release question bank approval requires approvedBy');
  }
  if (typeof approval.reference !== 'string' || !approval.reference.trim()) {
    errors.push('release question bank approval requires reference');
  }
  const approvedAtMs = Date.parse(approval.approvedAt);
  if (!Number.isFinite(approvedAtMs)) {
    errors.push('release question bank approval requires a valid approvedAt timestamp');
  } else if (approvedAtMs > now.getTime() + 5 * 60 * 1000) {
    errors.push('release question bank approval timestamp cannot be in the future');
  }
  const expectedSha256 = questionBankContentSha256(bank);
  if (approval.contentSha256 !== expectedSha256) {
    errors.push(
      `release question bank approval fingerprint mismatch: expected ${expectedSha256}`,
    );
  }
  return errors;
}
