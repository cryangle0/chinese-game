/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tests/tsconfig.json' }],
  },
  collectCoverageFrom: [
    'assets/scripts/services/{Analytics,CampaignProgress,GameSession,MediaAudioPlayer,QuestionBank,QuestionCursor,QuestionSchema,QuestionService,RoundTimer,SpeechSelectionService}.ts',
    'assets/scripts/core/{lifecycle/TaskScope,state/StateMachine}.ts',
    'assets/scripts/platform/host/{HostBridge,HostMessenger,LaunchContext}.ts',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 85, lines: 85, statements: 82 },
  },
};
