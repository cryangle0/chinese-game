export interface ReadingRect {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

export interface ReadingSceneLayout {
  readonly question: ReadingRect;
  /**
   * Extra top inset inside the question board PNG (decorative crown / gem).
   * Keeps stem vertically centered in the painted face, not the full texture.
   */
  readonly questionPadTopExtra?: number;
  /**
   * Side inset for themed chrome (chocolate bars / mech ears / brick pillars).
   * Overrides READING_TEXT.questionPadX when set.
   */
  readonly questionPadX?: number;
  readonly option: {
    readonly width: number;
    readonly height: number;
    readonly y: number;
    readonly columns: readonly [number, number, number];
    /** Extra inset past READING_TEXT.optionPadX when chrome eats the face. */
    readonly padX?: number;
    /** Shift option label right inside the brick (positive = toward right). */
    readonly textOffsetX?: number;
  };
  /** Positive/negative feedback motion box — HTML prototype coords, feet on ground. */
  readonly feedback: ReadingRect;
  readonly deer: ReadingRect;
  readonly timer: ReadingRect;
  readonly timerText: ReadingRect & { readonly fontSize: number; readonly lineHeight: number };
  readonly score: ReadingRect;
  readonly scoreIcon: ReadingRect;
  readonly text: {
    readonly questionOutline: string;
    readonly optionOutline: string;
    readonly hudOutline: string;
  };
}

/** HTML `feedback-motion` box → cocos center (x filled by answered column at runtime). */
function feedbackFromHtml(left: number, top: number, width: number, height: number): ReadingRect {
  return {
    width: Math.round(width),
    height: Math.round(height),
    x: 0,
    y: Math.round(405 - (top + height / 2)),
  };
}

/**
 * Enlarge feedback deer vs HTML for stronger on-screen impact.
 * Keeps the HTML sole line (bottom) fixed so feet stay grounded; scale is
 * reduced only when the taller box would clip past the top safe margin.
 */
function feedbackImpactFromHtml(
  left: number,
  top: number,
  width: number,
  height: number,
  scale = 1.38,
): ReadingRect {
  // Keep sole on-screen so enlarged deer is not clipped under the bottom edge.
  const bottom = Math.min(top + height, 798);
  const cx = left + width / 2;
  const maxHeight = Math.max(height * 0.85, bottom - 28);
  const maxWidth = Math.max(width, Math.min(cx - 16, 1424 - cx) * 2);
  let used = scale;
  let nw = width * used;
  let nh = height * used;
  if (nh > maxHeight) {
    used = maxHeight / height;
    nw = width * used;
    nh = maxHeight;
  }
  if (nw > maxWidth) {
    used = Math.min(used, maxWidth / width);
    nw = width * used;
    nh = height * used;
  }
  const nt = bottom - nh;
  const nl = cx - nw / 2;
  return feedbackFromHtml(nl, nt, nw, nh);
}

/**
 * Option / feedback / deer boxes from `独立HTML像素级UI原型/reading/config.js` + pages.
 * Deer sizes are per-theme (not a uniform 152×266) so non-mario skins stay stable.
 * Column gap ≥ option.width + 16.
 */
/**
 * Option boxes sized for ~30px type (near stem 32).
 * Constraints (design 1440×810, origin center):
 * - column gap ≥ width + 16
 * - |column| + width/2 ≤ 720 (screen edge)
 */
const layouts: Readonly<Record<string, ReadingSceneLayout>> = {
  mario: {
    question: { width: 860, height: 214, x: 0, y: 172 },
    // Side brick pillars ~90–106px on 860 board.
    questionPadX: 118,
    option: { width: 400, height: 122, y: -10, columns: [-440, 0, 440], padX: 64 },
    // ~1.38× HTML feedback box (feet pinned) — customer: 正负反馈小鹿太小/冲击弱.
    // Visible deer is further zoomed via DomMotionSprite.fillOpaque (webp has ~50% pad).
    feedback: feedbackImpactFromHtml(163.81, 401.81, 353.59, 424.31),
    deer: { width: 136, height: 236, x: 5, y: -226 },
    timer: { width: 264, height: 79, x: -563, y: 350 },
    timerText: { width: 191, height: 39, x: 21, y: -3, fontSize: 25, lineHeight: 31 },
    score: { width: 263, height: 64, x: -562, y: 278 },
    scoreIcon: { width: 64, height: 68, x: -668, y: 278 },
    text: { questionOutline: '#542C78', optionOutline: '#713413', hudOutline: '#8C3A12' },
  },
  'deep-sea': {
    question: { width: 860, height: 220, x: 0, y: 198 },
    // Crown ~51px of 220 board — balance stem between top chrome and bottom face.
    questionPadTopExtra: 64,
    option: { width: 410, height: 124, y: -18, columns: [-450, 0, 450], padX: 50 },
    feedback: feedbackImpactFromHtml(134.03, 218.36, 402.59, 483.11),
    deer: { width: 163, height: 231, x: 0, y: -236 },
    timer: { width: 273, height: 77, x: -559, y: 338 },
    timerText: { width: 177, height: 38, x: 19, y: -8, fontSize: 24, lineHeight: 30 },
    score: { width: 267, height: 62, x: -558, y: 258 },
    scoreIcon: { width: 66, height: 70, x: -661, y: 258 },
    text: { questionOutline: '#17639B', optionOutline: '#17639B', hudOutline: '#275493' },
  },
  space: {
    question: { width: 860, height: 214, x: 0, y: 174 },
    // Left mech ear ~131px; keep stem inside yellow/blue face.
    questionPadX: 150,
    // The yellow face is ~242px wide after scaling; keep text and outline inside it.
    option: { width: 450, height: 126, y: -24, columns: [-495, 0, 495], padX: 110 },
    feedback: feedbackImpactFromHtml(134.14, 314.15, 429, 514.8),
    deer: { width: 165, height: 226, x: 0, y: -219 },
    // 加宽容纳「倒计时：xxx秒」；整体略下移；文字避开左侧机甲头
    timer: { width: 292, height: 86, x: -546, y: 326 },
    timerText: { width: 172, height: 37, x: 42, y: -7, fontSize: 24, lineHeight: 30 },
    score: { width: 252, height: 72, x: -563, y: 249 },
    scoreIcon: { width: 68, height: 68, x: -660, y: 249 },
    text: { questionOutline: '#172B72', optionOutline: '#9A5A00', hudOutline: '#172B72' },
  },
  food: {
    question: { width: 860, height: 214, x: 0, y: 182 },
    // Chocolate side bars ~150–156px — global 120 lets glyphs kiss / cross the bars.
    questionPadX: 172,
    // Wider so long options (e.g. C.巫婆拿到了打火匣 ≈10字@32px) stay in biscuit face.
    option: { width: 450, height: 140, y: -22, columns: [-495, 0, 495], padX: 50 },
    // HTML food box was the smallest (~307×368); push harder for impact.
    feedback: feedbackImpactFromHtml(170.19, 432.81, 306.78, 368.14, 1.48),
    deer: { width: 118, height: 224, x: 0, y: -225 },
    timer: { width: 263, height: 78, x: -565, y: 345 },
    timerText: { width: 175, height: 38, x: 31, y: -7, fontSize: 24, lineHeight: 30 },
    score: { width: 256, height: 64, x: -565, y: 270 },
    scoreIcon: { width: 64, height: 64, x: -664, y: 270 },
    text: { questionOutline: '#A55431', optionOutline: '#A55431', hudOutline: '#A5546B' },
  },
  poetry: {
    question: { width: 860, height: 214, x: 0, y: 186 },
    questionPadTopExtra: 18,
    option: { width: 360, height: 128, y: -14, columns: [-400, 0, 400], padX: 42 },
    feedback: feedbackImpactFromHtml(221.59, 471.96, 318.23, 381.88, 1.45),
    deer: { width: 136, height: 214, x: 0, y: -254 },
    timer: { width: 253, height: 63, x: -570, y: 340 },
    timerText: { width: 167, height: 39, x: 34, y: -1, fontSize: 23, lineHeight: 29 },
    score: { width: 256, height: 64, x: -570, y: 275 },
    scoreIcon: { width: 64, height: 64, x: -665, y: 275 },
    text: { questionOutline: '#315E43', optionOutline: '#7D6835', hudOutline: '#80622E' },
  },
};

export function readingLayout(id: string): ReadingSceneLayout {
  return layouts[id] ?? layouts.mario;
}

export function readingLayoutIds(): string[] {
  return Object.keys(layouts);
}
