import fs from 'node:fs';
import path from 'node:path';
import { wrapChineseText } from '../assets/scripts/shared/config/ChineseTextWrap';
import {
  feedbackPresentation,
  feedbackUsesStageMotion,
  formatWritingOption,
  revealChoiceAsset,
} from '../assets/scripts/shared/config/WritingFeedbackPolicy';
import * as FeedbackPolicy from '../assets/scripts/shared/config/WritingFeedbackPolicy';
import { resolveStaticFeedback } from '../assets/scripts/shared/config/WritingStaticFeedback';
import * as StaticFeedback from '../assets/scripts/shared/config/WritingStaticFeedback';

interface BankQuestion {
  id: string;
  knowledgePoint: string;
  scenes: string[];
  stem: string;
  options: string[];
  correctIndex: number;
  enabled: boolean;
}

const bank = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../config/question-bank.json'),
  'utf8',
)) as { questions: BankQuestion[] };

function question(id: string): BankQuestion {
  const found = bank.questions.find((item) => item.id === id);
  if (!found) throw new Error(`missing question ${id}`);
  return found;
}

describe('customer feedback 0727', () => {
  it.each([
    ['“白天鹅助跑飞奔，像一架起航的飞机”运用了什么修辞手法？', 16],
    ['“小象红着脸说：对……对不起……”体现了怎样的心情？', 16],
    ['“顷刻之间满街的人就都知道了？”中“顷刻”的近义词是什么？', 16],
  ])('keeps closing punctuation off the next line: %s', (value, perLine) => {
    const lines = wrapChineseText(value, perLine);
    expect(lines.some((line) => /^[，。！？；：、）》】」』”’…]/u.test(line))).toBe(false);
    expect(lines.some((line) => /[（《【「『“‘]$/u.test(line))).toBe(false);
  });

  it('formats option labels as A. B. C. and strips legacy prefixes', () => {
    expect(formatWritingOption(0, 'A神采奕奕')).toBe('A. 神采奕奕');
    expect(formatWritingOption(1, 'B、光彩照人')).toBe('B. 光彩照人');
    expect(formatWritingOption(2, '垂头丧气')).toBe('C. 垂头丧气');
  });

  it('uses layered artwork for both dinosaur outcomes', () => {
    expect(feedbackPresentation('treasure')).toBe('motion');
    expect(feedbackPresentation('desert')).toBe('motion');
    expect(feedbackPresentation('desert', false)).toBe('hybrid');
    expect(feedbackPresentation('dinosaur', true)).toBe('hybrid');
    expect(feedbackPresentation('dinosaur', false)).toBe('hybrid');
    expect(feedbackPresentation('dunhuang')).toBe('motion');
    expect(feedbackPresentation('magic')).toBe('motion');
    expect(feedbackUsesStageMotion('dinosaur', false)).toBe(true);
    expect(feedbackUsesStageMotion('dinosaur', true)).toBe(false);
  });

  it('uses the original desert wrong layer at the selected pit', () => {
    const wrong = resolveStaticFeedback('desert', false);
    expect(wrong?.background).toBeUndefined();
    expect(wrong?.layers).toEqual([expect.objectContaining({
      path: './media/static-feedback/desert/wrong-layer-1.png',
      left: 225.75,
      top: 469.5,
      width: 258.75,
      height: 222,
      selectedAnchor: 0,
    })]);
  });

  it('keeps dinosaur final artwork anchored to the selected egg column', () => {
    const correct = resolveStaticFeedback('dinosaur', true);
    const wrong = resolveStaticFeedback('dinosaur', false);
    expect(correct?.layers[0]?.selectedAnchor).toBe(1);
    expect(wrong?.layers[0]?.selectedAnchor).toBe(0);
    expect(correct?.background).toBeUndefined();
    expect(wrong?.background).toBeUndefined();
  });

  it('selects blue, purple, and orange feedback art from the chosen egg', () => {
    type ChoiceLayer = {
      readonly path: string;
      readonly choicePaths?: readonly [string, string, string];
    };
    const resolveLayerPath = (
      StaticFeedback as unknown as {
        resolveFeedbackLayerPath?: (layer: ChoiceLayer, selectedIndex: number) => string;
      }
    ).resolveFeedbackLayerPath;
    expect(resolveLayerPath).toBeDefined();
    if (!resolveLayerPath) return;
    const correct = resolveStaticFeedback('dinosaur', true);
    const wrong = resolveStaticFeedback('dinosaur', false);
    const expectedColors = ['blue', 'purple', 'orange'];
    expectedColors.forEach((color, index) => {
      expect(resolveLayerPath(correct!.layers[0]!, index)).toContain(`-${color}.png`);
      expect(resolveLayerPath(wrong!.layers[0]!, index)).toContain(`-${color}.png`);
    });
  });

  it('ships both dinosaur feedback outcomes in all three egg colors', () => {
    const directory = path.resolve(
      __dirname, '../customer-media/static-feedback/dinosaur',
    );
    ['correct-layer-1', 'wrong-layer-2'].forEach((prefix) => {
      ['blue', 'purple', 'orange'].forEach((color) => {
        expect(fs.existsSync(path.join(directory, `${prefix}-${color}.png`))).toBe(true);
      });
    });
  });

  it('keeps the dinosaur wrong chase in the full-stage motion asset', () => {
    const sequencePlan = (
      FeedbackPolicy as unknown as {
        feedbackSequencePlan?: (sceneId: string, correct: boolean) => unknown;
      }
    ).feedbackSequencePlan;
    expect(sequencePlan?.('dinosaur', true)).toEqual({
      revealAfterMs: 1800,
    });
    expect(sequencePlan?.('dinosaur', false)).toBeUndefined();
    expect(sequencePlan?.('treasure', true)).toBeUndefined();
  });

  it('uses a supplied scene state image before the original choice artwork', () => {
    const choices = ['red-egg', 'purple-egg', 'blue-egg'];
    expect(revealChoiceAsset('dinosaur', 1, 'generic-red-open', choices)).toBe('generic-red-open');
    expect(revealChoiceAsset('treasure', 1, 'open-chest', choices)).toBe('open-chest');
    expect(revealChoiceAsset('desert', 2, undefined, choices)).toBe('blue-egg');
  });

  it('contains the five customer-specified question corrections', () => {
    expect(question('CB0716_WT_L3_2EA3303E2DB8').options).toEqual([
      '神采奕奕', '光彩照人', '垂头丧气',
    ]);
    expect(question('CB0716_WT_L4_02584E1B185A').stem).toBe(
      '“我是苍蝇眼睛体积的千分之一”用了什么手法来说明细菌体积小？',
    );
    expect(question('CB0716_WT_L6_BFB98DD26AA3').options).toEqual([
      '突出外祖母眼睛小', '突出外祖母有活力', '突出外祖母嘴巴大',
    ]);
    expect(question('CB0716_WT_L6_56CE253A2FF3').stem).toBe(
      '“街上人不多，像在炉台上沉思的蟑螂”写出了街上人们什么特点？',
    );
  });

  it('has at least five distinct questions for every book and scene', () => {
    const books = new Set(bank.questions.filter((item) => item.enabled)
      .map((item) => item.knowledgePoint));
    const scenes = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];
    books.forEach((book) => {
      scenes.forEach((scene) => {
        const matching = bank.questions.filter((item) =>
          item.enabled && item.knowledgePoint === book && item.scenes.includes(scene));
        expect(new Set(matching.map((item) => item.id)).size)
          .toBeGreaterThanOrEqual(5);
        expect(new Set(matching.map((item) =>
          `${item.stem}\u0000${item.options.join('\u0000')}`)).size)
          .toBeGreaterThanOrEqual(5);
      });
    });
  });
});
