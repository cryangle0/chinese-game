import {
  formatResultReviewLine,
  resultBookTitle,
} from '../assets/scripts/ui/results/ResultTextFormatter';

describe('formatResultReviewLine', () => {
  it('keeps short review text intact while labeling the answer', () => {
    expect(formatResultReviewLine('四大天王最早源自哪里？', '印度', 20))
      .toBe('四大天王最早源自哪里？  正确答案：印度');
  });

  it('keeps a long stem and its correct answer in full for horizontal review', () => {
    const value = formatResultReviewLine(
      '第九回观音院着火，从“哭哭啼啼，叫冤叫屈”可看出众僧怎样的特点？',
      '贪婪自私',
      18,
    );
    expect(value).not.toContain('…');
    expect(value).toContain('第九回观音院着火');
    expect(value.endsWith('正确答案：贪婪自私')).toBe(true);
  });

  it('normalizes whitespace from imported question banks', () => {
    expect(formatResultReviewLine('  题干\n 内容  ', '  答案  ', 20))
      .toBe('题干 内容  正确答案：答案');
  });

  it('uses the selected book name for the settlement subtitle', () => {
    expect(resultBookTitle([
      { knowledgePoint: '西游记' },
      { knowledgePoint: '西游记' },
      { knowledgePoint: '安徒生童话' },
    ])).toBe('西游记');
  });
});
