import { ChineseQuestion } from '../types/Question';
import { BOOK_OPTIONS } from './BookCatalog';

const shared: Omit<ChineseQuestion, 'id' | 'stem' | 'options' | 'correctIndex' | 'knowledgePoint'> = {
  packId: 'builtin_v2',
  games: ['reading-jumper'],
  scenes: ['*'],
  grade: 'ALL',
  term: 'ALL',
  difficulty: 'basic',
  stemType: 'text',
  type: '语文基础',
  enabled: true,
  weight: 1,
};

const stems: readonly {
  id: string;
  stem: string;
  options: ChineseQuestion['options'];
  correctIndex: ChineseQuestion['correctIndex'];
  difficulty?: ChineseQuestion['difficulty'];
}[] = [
  { id: 'RJ_BUILTIN_001', stem: '“春风”的“春”读音是？', options: ['chūn', 'cūn', 'chōng'], correctIndex: 0 },
  { id: 'RJ_BUILTIN_002', stem: '“安静”的近义词是？', options: ['宁静', '热闹', '急忙'], correctIndex: 0 },
  { id: 'RJ_BUILTIN_003', stem: '“床前明月光”的下一句是？', options: ['疑是地上霜', '低头思故乡', '举头望明月'], correctIndex: 0 },
  { id: 'RJ_BUILTIN_004', stem: '下列词语书写正确的是？', options: ['已经', '以经', '己经'], correctIndex: 0 },
  { id: 'RJ_BUILTIN_005', stem: '“小鸟在枝头唱歌”使用了什么修辞？', options: ['比喻', '拟人', '排比'], correctIndex: 1 },
  { id: 'RJ_BUILTIN_006', stem: '“守株待兔”告诉我们什么？', options: ['不能心存侥幸', '要跑得更快', '要保护树木'], correctIndex: 0, difficulty: 'advanced' },
];

/** Builtin fallback: cycle cover books so `knowledgePoint` filter never empties. */
export const sampleQuestions: readonly ChineseQuestion[] = stems.map((item, index) => ({
  ...shared,
  ...item,
  knowledgePoint: BOOK_OPTIONS[index % BOOK_OPTIONS.length],
}));
