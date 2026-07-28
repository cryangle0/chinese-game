import { Vec3 } from 'cc';
import {
  WRITING_BOARD,
  WRITING_OPTION_STONE,
  WRITING_TEXT,
  writingOptionLabelBox,
  writingQuestionLabelBox,
} from './WritingTextLayout';
import { WritingPlaySceneLayout } from './WritingPlaySceneLayout';

/** Convert HTML top-left box (1440×810) to Cocos center-origin placement. */
export function box(
  left: number, top: number, width: number, height: number,
): { size: [number, number]; position: Vec3 } {
  return {
    size: [width, height],
    position: new Vec3(left + width / 2 - 720, 405 - (top + height / 2), 0),
  };
}

const QUESTION_BOARD = box(318, 10, WRITING_BOARD.width, WRITING_BOARD.height);
const DEFAULT_CHOICE = WritingPlaySceneLayout.treasure;
const OPTION_STONE = {
  width: WRITING_OPTION_STONE.width,
  height: WRITING_OPTION_STONE.height,
  localY: DEFAULT_CHOICE.option.localY,
} as const;
const QUESTION_LABEL_BOX = writingQuestionLabelBox(WRITING_BOARD, false);
const OPTION_LABEL_BOX = writingOptionLabelBox(WRITING_OPTION_STONE);

/**
 * Shared HUD/text geometry. Cave-bound choices use WritingPlaySceneLayout.
 */
export const WritingPlayLayout = {
  timer: box(4, 10, 265, 80),
  score: box(4, 90, 263, 65),
  scoreIcon: box(4, 90, 56, 56),
  questionBoard: QUESTION_BOARD,
  questionLabel: {
    width: QUESTION_LABEL_BOX.width,
    height: QUESTION_LABEL_BOX.height,
    fontSize: WRITING_TEXT.questionFontSize,
  },
  deer: box(560, -22, 320, 440),
  choiceColumns: DEFAULT_CHOICE.columns,
  choice: DEFAULT_CHOICE.choice,
  option: OPTION_STONE,
  optionLabel: {
    width: OPTION_LABEL_BOX.width,
    height: OPTION_LABEL_BOX.height,
    fontSize: WRITING_TEXT.optionFontSize,
  },
  chest: DEFAULT_CHOICE.chest,
  voice: box(251, 699.5, 920, 129),
  voiceLabel: { width: 620, height: 90, fontSize: 30, offsetY: 14 },
  feedbackMotion: box(520, 80, 400, 560),
  choiceSelectedScale: 1.06,
  choiceMutedScale: 0.92,
} as const;
