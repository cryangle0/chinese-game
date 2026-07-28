import { matchSpokenOption } from '../assets/scripts/services/SpeechSelectionService';
import { encodeSpeechHints } from '../assets/scripts/services/SpeechRecordingSupport';

describe('user voice modes: ABC / answer text / ABC+text', () => {
  const opts = ['画眉鸟', '百灵鸟', '公鸡'];

  it.each([
    // 1) 念 ABC
    ['A', 0], ['B', 1], ['C', 2],
    ['a', 0], ['选A', 0], ['选项B', 1], ['选C', 2],
    ['诶', 0], ['必', 1], ['西', 2],
    ['Ａ', 0],
    // 2) 念答案文本
    ['画眉鸟', 0], ['百灵鸟', 1], ['公鸡', 2],
    ['答案是画眉鸟', 0], ['我选百灵鸟', 1],
    // 3) 念 ABC + 答案文本
    ['A画眉鸟', 0], ['B百灵鸟', 1], ['C公鸡', 2],
    ['选A画眉鸟', 0], ['A.画眉鸟', 0],
    ['诶画眉鸟', 0], ['必百灵鸟', 1], ['西公鸡', 2],
  ] as const)('%s -> option %s', (spoken, index) => {
    expect(matchSpokenOption(spoken, opts)).toBe(index);
  });

  it('packs letter + option hotword hints for ASR', () => {
    const raw = decodeURIComponent(encodeSpeechHints(opts));
    const hints = JSON.parse(raw) as string[];
    expect(hints).toEqual(expect.arrayContaining([
      '画眉鸟', 'A', '选项A', '选A', 'A画眉鸟',
      '百灵鸟', 'B', '选项B', '选B',
      '公鸡', 'C', '选项C', '选C',
    ]));
    expect(hints.indexOf('C')).toBeLessThan(16);
  });
});
