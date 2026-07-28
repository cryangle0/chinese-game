/** Normalize + spoken variant expansion for ASR option matching. */

export function normalize(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase()
    .replace(/[\uFF21-\uFF3A]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[\uFF41-\uFF5A]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    // Incl. 、顿号 so "A、流沙河" still matches option text.
    .replace(/[\s\u3001\uFF0C\u3002\uFF01\uFF1F\uFF1A\uFF1B.,!?;:\u201C\u201D'"'\uFF08\uFF09()[\]、·•\-_/\\|…⋯]+/g, '');
}

/** Latin + Chinese ASR homophones for spoken A/B/C/D. */
export const ordinalAliases = [
  ['a', '选a', 'a选项', '选项a', '第a', '第一个', '第一个选项', '第一项', '一号', '1', '1号',
    '诶', '欸', '哎'],
  ['b', '选b', 'b选项', '选项b', '第b', '第二个', '第二个选项', '第二项', '二号', '2', '2号',
    '必', '逼'],
  ['c', '选c', 'c选项', '选项c', '第c', '第三个', '第三个选项', '第三项', '三号', '3', '3号',
    '西', '赛', '惜'],
  ['d', '选d', 'd选项', '选项d', '第d', '第四个', '第四个选项', '第四项', '四号', '4', '4号'],
];

export const chineseLetterExact = new Set([
  '诶', '欸', '哎', '必', '逼', '西', '赛', '惜',
]);

const commandPrefixes = [
  '我觉得答案是', '我觉得是', '我的答案是', '答案应该是', '应该选择', '我要选择',
  '答案是', '答案选', '我选择', '我要选', '我选', '请选择', '请选', '选择',
  '选项是', '选项',
];

function expandLetterHomophones(spoken: string): string[] {
  const heads: Array<[string, string]> = [
    ['诶', 'a'], ['欸', 'a'], ['哎', 'a'],
    ['必', 'b'], ['逼', 'b'],
    ['西', 'c'], ['赛', 'c'], ['惜', 'c'],
  ];
  const out: string[] = [];
  for (const [cn, lat] of heads) {
    if (spoken === cn) out.push(lat);
    else if (spoken.startsWith(cn) && spoken.length > cn.length) {
      out.push(lat + spoken.slice(cn.length));
    }
  }
  return out;
}

export function spokenVariants(transcript: string): string[] {
  const spoken = normalize(transcript);
  if (!spoken) return [];
  const variants = new Set([spoken, ...expandLetterHomophones(spoken)]);
  for (const prefix of commandPrefixes) {
    const normalizedPrefix = normalize(prefix);
    if (spoken.startsWith(normalizedPrefix) && spoken.length > normalizedPrefix.length) {
      const rest = spoken.slice(normalizedPrefix.length);
      variants.add(rest);
      expandLetterHomophones(rest).forEach((v) => variants.add(v));
    }
  }
  for (const variant of Array.from(variants)) {
    const stripped = variant.replace(/^[abcd]/, '');
    if (stripped && stripped !== variant) variants.add(stripped);
  }
  return Array.from(variants);
}

export function uniqueIndex(indices: readonly number[]): number | null {
  const unique = Array.from(new Set(indices));
  return unique.length === 1 ? unique[0] : null;
}

export function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}
