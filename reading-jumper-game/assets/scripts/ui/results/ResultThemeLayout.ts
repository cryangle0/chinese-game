import { ResultThemeLayout } from './ResultThemeLayoutTypes';

export type { ResultThemeLayout } from './ResultThemeLayoutTypes';

/**
 * Pixel layouts converted from `独立HTML像素级UI原型/reading/pages/*-settlement.html`
 * data-qa-box (left,top,w,h) → cocos center: x=left+w/2-720, y=405-(top+h/2).
 */
const layouts: Readonly<Record<string, ResultThemeLayout>> = {
  mario: {
    motion: { width: 320, height: 440, x: -443.07, y: 20 },
    text: {
      heading: '#5A321F', headingOutline: '#F7D78B',
      rank: '#34283A', rankOutline: '#FFFFFF',
      reviewCorrect: '#55331F', reviewWrong: '#B42318', scoreOutline: '#7A3A15',
    },
    score: { x: -430, y: -220 },
    headingSize: { width: 306.56, height: 77.06 },
    stars: [
      { x: -545.07, y: -287.44, w: 41.62, h: 40.5 },
      { x: -493.88, y: -288.84, w: 42.75, h: 41.06 },
      { x: -441.28, y: -288.84, w: 42.19, h: 41.06 },
      { x: -389.53, y: -288.85, w: 41.06, h: 39.94 },
      { x: -337.78, y: -288.85, w: 41.06, h: 39.94 },
    ],
    rank: {
      titleX: -44.16, x: -48.94, titleY: 76.78,
      rows: [-26.72, -102.65, -181.12],
      width: 367.69, rowHeight: 67.87,
      nameX: -21.94, scoreX: 120.65,
    },
    // 回顾行：与当前 ThemedResultReview 统一坐标对齐（玛丽已验收）
    review: {
      x: 420.47, titleY: 82.13, subtitleY: 9.81,
      textX: 386.5, iconX: 591, iconSize: 34,
      rows: [9, -47, -103, -159, -215],
      width: 409, textHeight: 46,
    },
  },
  'deep-sea': {
    motion: { width: 310, height: 380, x: -403.14, y: 13.14 },
    text: {
      heading: '#E8FBFF', headingOutline: '#075A91',
      rank: '#FFFFFF', rankOutline: '#143A7A',
      reviewCorrect: '#FFFFFF', reviewWrong: '#FFD3D8', scoreOutline: '#075A91',
    },
    summary: {
      x: -420, captionY: 275, scoreY: 225,
      captionColor: '#FFFFFF', scoreColor: '#FFE447',
    },
    headingSize: { width: 330, height: 60 },
    stars: [
      { x: -514.13, y: -254.82, w: 46.12, h: 47.25 },
      { x: -457.88, y: -254.82, w: 46.12, h: 47.25 },
      { x: -405.56, y: -254.82, w: 46.12, h: 47.25 },
      { x: -354.94, y: -254.82, w: 46.12, h: 47.25 },
      { x: -303.31, y: -254.82, w: 46.12, h: 47.25 },
    ],
    rank: {
      titleX: 30, x: 21.1, titleY: 170,
      rows: [86.34, 3.37, -78.47],
      width: 314.62, rowHeight: 71.25,
      nameX: -18.8, scoreX: 103.39,
    },
    // 贴合深海背景右侧水晶框：收窄 + 上移，避免左侧溢出到排行榜
    review: {
      x: 458, titleY: 195, subtitleY: 142,
      textX: 440, iconX: 575, iconSize: 34,
      rows: [105, 45, -15, -75, -135],
      width: 286, textHeight: 44,
    },
  },
  space: {
    motion: { width: 280, height: 370, x: -425.71, y: -13.29 },
    text: {
      heading: '#E8F6FF', headingOutline: '#172B72',
      rank: '#FFFFFF', rankOutline: '#172B72',
      reviewCorrect: '#FFFFFF', reviewWrong: '#FFD3D8', scoreOutline: '#172B72',
    },
    summary: {
      x: -420, captionY: 280, scoreY: 235,
      captionColor: '#DDF8FF', scoreColor: '#FFB23E',
    },
    headingSize: { width: 330, height: 60 },
    stars: [
      { x: -513, y: -258.19, w: 33.75, h: 32.62 },
      { x: -468.56, y: -258.19, w: 33.75, h: 32.62 },
      { x: -424.13, y: -258.19, w: 33.75, h: 32.62 },
      { x: -380.25, y: -258.19, w: 33.75, h: 32.62 },
      { x: -336.37, y: -258.19, w: 33.75, h: 32.62 },
    ],
    // 背景已画金/银/铜奖牌（x≈587–633）；白条只盖文字区，勿盖住奖牌
    rank: {
      titleX: 54, x: 70.5, titleY: 195,
      rows: [84, -14.5, -113],
      width: 299, rowHeight: 50,
      nameX: -42, scoreX: 98,
    },
    // 右框内区 ≈ html left1032–1367
    review: {
      x: 480, titleY: 195, subtitleY: 130,
      textX: 458, iconX: 612, iconSize: 34,
      rows: [84, 28, -28, -84, -140],
      width: 336, textHeight: 44,
    },
  },
  food: {
    motion: { width: 405, height: 570, x: -398.71, y: 28.36 },
    text: {
      heading: '#FFFFFF', headingOutline: '#A5546B',
      rank: '#34283A', rankOutline: '#FFFFFF',
      reviewCorrect: '#55331F', reviewWrong: '#B42318', scoreOutline: '#A55431',
    },
    summary: {
      x: -420, captionY: 300, scoreY: 255,
      captionColor: '#7A3A2A', scoreColor: '#FFE6A8',
    },
    headingSize: { width: 340, height: 56 },
    stars: [
      { x: -543.93, y: -264.94, w: 57.38, h: 54 },
      { x: -479.81, y: -264.94, w: 57.38, h: 54 },
      { x: -415.69, y: -263.25, w: 57.38, h: 54 },
      { x: -351.56, y: -263.25, w: 57.38, h: 54 },
      { x: -287.43, y: -263.25, w: 57.38, h: 54 },
    ],
    rank: {
      // 微调：标题略上；记录上移 + 右移
      titleX: -5, x: -18, titleY: 100,
      rows: [-8, -96, -184],
      width: 308.25, rowHeight: 81.56,
      nameX: -18.49, scoreX: 101.71,
    },
    review: {
      // 微调：再加宽、拉开行距、整体上移
      x: 410, titleY: 100, subtitleY: 40,
      textX: 392, iconX: 558, iconSize: 34,
      rows: [22, -34, -90, -146, -202],
      width: 352, textHeight: 44,
    },
  },
  poetry: {
    motion: { width: 400, height: 437.5, x: -333.93, y: -7.5 },
    text: {
      heading: '#315E43', headingOutline: '#F4E7B3',
      rank: '#34283A', rankOutline: '#FFFFFF',
      reviewCorrect: '#55331F', reviewWrong: '#B42318', scoreOutline: '#315E43',
    },
    // 木牌已有「总分…分」；数字居中卡槽（总分↔分 间隙中心，略下作光学对齐）
    score: { x: -330, y: -238, suffix: '' },
    headingSize: { width: 189.56, height: 44.44 },
    stars: [
      { x: -473.06, y: -290.25, w: 56.25, h: 58.5 },
      { x: -406.13, y: -290.53, w: 58.5, h: 59.06 },
      { x: -335.81, y: -289.12, w: 59.62, h: 59.62 },
      { x: -266.91, y: -288.84, w: 57.94, h: 59.06 },
      { x: -198.01, y: -288.84, w: 57.94, h: 59.06 },
    ],
    // 背景已烘焙奖牌+底条；文字对齐 29-poetry-settlement / 奖牌中心
    rank: {
      titleX: 54, x: 58.5, titleY: 79.59,
      rows: [15, -65, -145],
      width: 280, rowHeight: 72,
      nameX: -27, scoreX: 125,
      hidePanel: true,
    },
    // 对齐 HTML 原型：整体下移 + 行距收紧，避免盖住「答题回顾」
    review: {
      x: 441, titleY: 79.59, subtitleY: 44.69,
      textX: 430, iconX: 578, iconSize: 30,
      rows: [-3, -40, -76, -112, -149],
      width: 300, textHeight: 40,
    },
  },
};

export function resultThemeLayout(id: string): ResultThemeLayout {
  return layouts[id] ?? layouts.mario;
}
