/** 100+ common given-style names for settlement leaderboard NPCs. */
export const RANK_NAME_POOL = [
  '宋宋', '佳佳', '乐乐', '朵朵', '阳阳', '彤彤', '果果', '皮皮', '贝贝', '叮叮',
  '泡泡', '豆豆', '糖糖', '星星', '月月', '晨晨', '安安', '宁宁', '悠悠', '圆圆',
  '点点', '毛毛', '球球', '虎虎', '牛牛', '羊羊', '猫猫', '兔兔', '鹿鹿', '鱼鱼',
  '明明', '华华', '强强', '丽丽', '芳芳', '娟娟', '超超', '军军', '伟伟', '静静',
  '婷婷', '浩浩', '宇宇', '轩轩', '涵涵', '欣欣', '悦悦', '思思', '雨雨', '雪雪',
  '冰冰', '暖暖', '夏夏', '秋秋', '冬冬', '春春', '青青', '红红', '蓝蓝', '紫紫',
  '小可', '小米', '小满', '小宇', '小希', '小白', '小黑', '小灰', '小橙', '小绿',
  '阿哲', '阿飞', '阿诚', '阿诺', '阿杰', '阿狸', '阿明', '阿强', '阿丽', '阿芳',
  '可可', '米米', '希希', '西西', '七七', '八八', '九九', '丁丁', '当当', '咚咚',
  '咯咯', '哈哈', '嘻嘻', '哇哇', '咩咩', '汪汪', '喵喵', '咕咕', '啾啾', '叽叽',
  '小棠', '小荷', '小竹', '小松', '小梅', '小兰', '小菊', '小莲', '小蓉', '小薇',
] as const;

export interface RankRow {
  readonly rank: number;
  readonly name: string;
  readonly score: number;
  readonly isPlayer: boolean;
}

/** Build three distinct legal score tiers; only NPC names remain random. */
export function buildRankRows(
  playerScore: number,
  maxScore = 100,
): readonly RankRow[] {
  const pool = RANK_NAME_POOL;
  const pick = (): string => pool[Math.floor(Math.random() * pool.length)] ?? '同学';
  const nameA = pick();
  let nameB = pick();
  while (nameB === nameA) nameB = pick();
  const limit = Math.max(20, Math.round(maxScore / 20) * 20);
  const score = Math.max(0, Math.min(limit, Math.round(playerScore)));
  const lowerTier = Math.max(0, score - 20);
  const player = { rank: 1, name: '我', score, isPlayer: true };
  if (score === limit) {
    return [
      player,
      { rank: 2, name: nameA, score: Math.round(limit * 0.8), isPlayer: false },
      { rank: 3, name: nameB, score: Math.round(limit * 0.6), isPlayer: false },
    ];
  }
  if (score === 0) {
    return [
      { rank: 1, name: nameA, score: limit, isPlayer: false },
      { rank: 2, name: nameB, score: Math.round(limit * 0.2), isPlayer: false },
      { ...player, rank: 3 },
    ];
  }
  return [
    { rank: 1, name: nameA, score: limit, isPlayer: false },
    { ...player, rank: 2 },
    { rank: 3, name: nameB, score: lowerTier, isPlayer: false },
  ];
}
