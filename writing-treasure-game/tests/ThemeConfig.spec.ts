import { writingThemes } from '../assets/scripts/games/writing-treasure/config/WritingTheme';

describe('writing campaign themes', () => {
  it('contains the five production stages in client order', () => {
    expect(writingThemes.map((theme) => theme.id)).toEqual([
      'treasure', 'desert', 'dinosaur', 'dunhuang', 'magic',
    ]);
    expect(writingThemes.map((theme) => theme.name)).toEqual([
      '经典挖宝', '沙漠探险', '恐龙世界', '敦煌壁画', '魔法学院',
    ]);
    expect(writingThemes.every((theme) =>
      theme.available && Boolean(theme.assets.background) && Boolean(theme.tool))).toBe(true);
    expect(writingThemes.every((theme) => theme.materialStatus === 'complete')).toBe(true);
    expect(writingThemes.every((theme) =>
      theme.assetSource === 'customer-zip-20260716')).toBe(true);
    expect(new Set(writingThemes.map((theme) => theme.assets.background)).size).toBe(5);
  });

  it('ships choice-state art only for scenes the customer cut actually covers', () => {
    const availability: Record<string, { success: boolean; fail: boolean }> = {
      treasure: { success: true, fail: true },
      desert: { success: true, fail: false },
      dinosaur: { success: false, fail: false },
      dunhuang: { success: true, fail: true },
      magic: { success: true, fail: true },
    };
    writingThemes.forEach((theme) => {
      const expected = availability[theme.id];
      expect(Boolean(theme.assets.successState)).toBe(expected.success);
      expect(Boolean(theme.assets.failState)).toBe(expected.fail);
    });
    expect(writingThemes
      .filter((theme) => ['treasure', 'desert', 'dunhuang'].includes(theme.id))
      .every((theme) => theme.assets.successStates?.length === 3)).toBe(true);
    expect(writingThemes.find((theme) => theme.id === 'treasure')?.assets.failStates).toEqual([
      'themes/writing/treasure/failState',
      'themes/writing/treasure/failState-purple',
      'themes/writing/treasure/failState-green',
    ]);
    expect(writingThemes.find((theme) => theme.id === 'dunhuang')?.assets.failStates).toEqual([
      'themes/writing/dunhuang/failState',
      'themes/writing/dunhuang/failState-white',
      'themes/writing/dunhuang/failState-green',
    ]);
  });

  it('wires the packaged feedback effect for every scene', () => {
    writingThemes.forEach((theme) => {
      expect(theme.assets.motion?.correct).toBe(`./media/${theme.id}/correct.webp`);
      expect(theme.assets.motion?.wrong).toBe(`./media/${theme.id}/wrong.webp`);
    });
  });
});
