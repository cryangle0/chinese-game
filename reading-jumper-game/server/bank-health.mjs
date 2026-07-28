export function inspectQuestionBank(bank, gameId, sceneIds) {
  if (!bank || typeof bank !== 'object' || typeof bank.version !== 'string'
    || !Array.isArray(bank.questions)) {
    return { ok: false, version: null, enabled: 0, missingScenes: [...sceneIds] };
  }
  const enabledQuestions = bank.questions.filter((question) =>
    question?.enabled === true && Array.isArray(question.games)
    && question.games.includes(gameId) && Array.isArray(question.scenes));
  const missingScenes = sceneIds.filter((scene) => !enabledQuestions.some((question) =>
    question.scenes.includes(scene) || question.scenes.includes('*')));
  return {
    ok: enabledQuestions.length > 0 && missingScenes.length === 0,
    version: bank.version,
    enabled: enabledQuestions.length,
    missingScenes,
  };
}
