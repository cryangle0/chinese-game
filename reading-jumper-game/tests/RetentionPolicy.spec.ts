import { RetentionPolicy } from '../assets/scripts/core/assets/RetentionPolicy';

const entries = [
  { key: 'old', lastUsed: 1 },
  { key: 'current', lastUsed: 2 },
  { key: 'busy', lastUsed: 3 },
];

describe('RetentionPolicy', () => {
  it('keeps entries before a retention set is supplied', () => {
    const policy = new RetentionPolicy();
    expect(policy.evictions(entries, () => false, 10)).toEqual([]);
  });

  it('evicts unretained entries without consumers', () => {
    const policy = new RetentionPolicy();
    policy.retainOnly(['current']);
    expect(policy.evictions(entries, (key) => key === 'busy', 10)).toEqual(['old']);
  });

  it('never evicts a retained entry to satisfy the size limit', () => {
    const policy = new RetentionPolicy();
    policy.retainOnly(['current']);
    expect(policy.evictions(entries, (key) => key === 'busy', 1)).toEqual(['old']);
  });

  it('uses least-recently-used order when no retention set exists', () => {
    const policy = new RetentionPolicy();
    expect(policy.evictions(entries, () => false, 2)).toEqual(['old']);
  });
});
