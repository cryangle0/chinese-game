import fs from 'node:fs';
import path from 'node:path';

interface BankQuestion {
  readonly stem: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly scenes: readonly string[];
  readonly enabled: boolean;
}

const bank = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../config/question-bank.json'),
  'utf8',
)) as { readonly questions: readonly BankQuestion[] };

function question(stem: string): BankQuestion {
  const found = bank.questions.find((item) => item.stem === stem);
  if (!found) throw new Error(`missing question: ${stem}`);
  return found;
}

function expectQuestion(
  stem: string,
  options: readonly [string, string, string],
  correctIndex: number,
  scene: string,
): void {
  expect(question(stem)).toMatchObject({
    options,
    correctIndex,
    scenes: [scene],
    enabled: true,
  });
}

describe('customer question corrections 0729', () => {
  it('keeps both reading replacements from the 0729 workbook', () => {
    expectQuestion(
      '猫国王照镜子告诉了我们什么道理？',
      ['不要照镜子', '外表最重要', '要认清自己'],
      2,
      'space',
    );
    expectQuestion(
      '胖胖最后吃掉了苹果吗？',
      ['没吃到', '吃掉了', '不确定'],
      1,
      'space',
    );
  });

  it('keeps the corrected Tom Sawyer option text', () => {
    expectQuestion(
      '英琼·乔杀死医生后，把罪行嫁祸给了谁？',
      ['莫夫·波特', '哈克贝利', '席德'],
      0,
      'space',
    );
  });
});
