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
  it('keeps the screenshot-requested writing questions and answers', () => {
    expectQuestion(
      '“照看着自己那六个可爱的小孙女——海公主”中破折号的作用是什么？',
      ['解释说明', '表示转折', '表示声音延长'],
      0,
      'magic',
    );
    expectQuestion(
      '“面临绝境，我总会想起城楼上抚琴的________。”应该写谁？',
      ['司马懿', '诸葛亮', '马谡'],
      1,
      'magic',
    );
    expectQuestion(
      '“大圣被魔使法压在山根之下，珠泪如雨”，作者把眼泪比作什么？',
      ['珍珠和雨', '珍珠', '雨'],
      0,
      'dunhuang',
    );
    expectQuestion(
      '“等她们散了，咱们有多少诗不能作呢？”这句话运用了什么修辞？',
      ['比喻', '夸张', '反问'],
      2,
      'dinosaur',
    );
  });

  it('keeps all five writing replacements from the 0729 workbook', () => {
    expectQuestion(
      '“风婆婆热情地牵着小树叶的手走了”运用了什么修辞手法？',
      ['比喻', '排比', '拟人'],
      2,
      'treasure',
    );
    expectQuestion(
      '仿写“香喷喷”，正确的是什么？',
      ['皱皱巴巴', '花花绿绿', '圆滚滚'],
      2,
      'treasure',
    );
    expectQuestion(
      '“第二天早上”写出了事情发生的什么？',
      ['地点', '时间', '人物'],
      1,
      'treasure',
    );
    expectQuestion(
      '“浊水还可以改造为清水，人呢？”作为文章结尾有何好处？',
      ['总结前文', '引发读者思考', '点明文章主旨'],
      1,
      'dunhuang',
    );
    expectQuestion(
      '“细胞大小肥瘦的相差，总算差强人意吧”中“差强人意”意思是？',
      ['完全不能让人满意', '大体上使人满意', '非常令人满意'],
      1,
      'magic',
    );
  });
});
