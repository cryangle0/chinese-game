/**
 * Cover book picker → question `knowledgePoint` filter.
 * Labels must match customer question-bank.json (25 Q each, 50 books).
 * Classics first for the default cover list; rest follow bank order.
 */
export const BOOK_OPTIONS = [
  '西游记',
  '三国演义',
  '红楼梦',
  '水浒传',
  '安徒生童话',
  '格林童话',
  '伊索寓言',
  '中国古代寓言',
  '中国民间故事',
  '山海经',
  '世界神话传说',
  '希腊神话与英雄传说',
  '一千零一夜',
  '稻草人',
  '小英雄雨来',
  '骆驼祥子',
  '童年',
  '爱的教育',
  '鲁滨逊漂流记',
  '金银岛',
  '秘密花园',
  '爱丽丝漫游奇境',
  '列那狐的故事',
  '绿野仙踪',
  '绿野仙踪（注音版）',
  '克雷洛夫寓言',
  '灰尘的旅行',
  '看看我们的地球',
  '米·伊林十万个为什么',
  '愿望的实现',
  '和大人一起读1',
  '和大人一起读2',
  '和大人一起读3',
  '和大人一起读4',
  '读读儿童故事1',
  '读读儿童故事2',
  '读读儿童故事3',
  '读读儿童故事4',
  '读读童话故事1',
  '读读童话故事2',
  '读读童话故事3',
  '读读童话故事4',
  '读读童谣和儿歌1',
  '读读童谣和儿歌2',
  '读读童谣和儿歌3',
  '读读童谣和儿歌4',
  '孤独的小螃蟹',
  '神笔马良',
  '尼尔斯骑鹅旅行记',
  '汤姆·索亚历险记',
] as const;

export type BookOption = (typeof BOOK_OPTIONS)[number];

export const DEFAULT_BOOK: BookOption = BOOK_OPTIONS[0];

export function resolveBookOption(value: string | null | undefined): BookOption {
  const raw = (value ?? '').trim();
  const hit = BOOK_OPTIONS.find((book) => book === raw);
  return hit ?? DEFAULT_BOOK;
}
