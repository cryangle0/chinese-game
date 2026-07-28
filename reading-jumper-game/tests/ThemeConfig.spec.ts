import { readingThemes } from '../assets/scripts/games/reading-jumper/config/ReadingTheme';

describe('reading campaign themes', () => {
  it('contains the five production stages in client order', () => {
    expect(readingThemes.map((theme) => theme.id)).toEqual([
      'mario', 'deep-sea', 'space', 'food', 'poetry',
    ]);
    expect(readingThemes.map((theme) => theme.name)).toEqual([
      '超级玛丽', '深海龙宫', '星际穿越', '美食大冒险', '诗词山水',
    ]);
    expect(readingThemes.every((theme) =>
      theme.available && Boolean(theme.assets.background))).toBe(true);
    expect(readingThemes.map((theme) => theme.materialStatus)).toEqual([
      'complete', 'complete', 'complete', 'complete', 'complete',
    ]);
    expect(readingThemes.map((theme) => theme.assetSource)).toEqual([
      'mario', 'deep-sea', 'space', 'food', 'poetry',
    ]);
    expect(new Set(readingThemes.map((theme) => theme.assets.background)).size).toBe(5);
    expect(readingThemes.every((theme) => Boolean(theme.assets.resultBackground))).toBe(true);
  });
});
