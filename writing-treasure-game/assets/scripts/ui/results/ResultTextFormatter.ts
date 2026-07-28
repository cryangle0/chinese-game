export function formatResultReviewLine(
  stem: string,
  answer: string | undefined,
  _maxUnits?: number,
): string {
  const normalizedStem = stem.replace(/\s+/g, ' ').trim();
  const normalizedAnswer = answer?.replace(/\s+/g, ' ').trim() ?? '';
  const suffix = normalizedAnswer ? `  正确答案：${normalizedAnswer}` : '';
  return `${normalizedStem}${suffix}`;
}

export function resultBookTitle(
  answers: readonly { readonly knowledgePoint?: string }[],
): string {
  const counts = new Map<string, number>();
  answers.forEach((answer) => {
    const title = answer.knowledgePoint?.trim();
    if (title) counts.set(title, (counts.get(title) ?? 0) + 1);
  });
  let selected = '';
  let selectedCount = 0;
  counts.forEach((count, title) => {
    if (count > selectedCount) {
      selected = title;
      selectedCount = count;
    }
  });
  return selected;
}
