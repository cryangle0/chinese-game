import { Graphics, Label, Node, UITransform, Vec3, HorizontalTextAlignment, VerticalTextAlignment } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { createLabel, createUiNode } from '../core/ui/UiFactory';
import { WritingPlayLayout as L } from '../shared/config/WritingPlayLayout';
import {
  WRITING_TEXT,
  writingQuestionLabelBox,
  writingQuestionWrapBudget,
} from '../shared/config/WritingTextLayout';
import { wrapChineseText } from '../shared/config/ChineseTextWrap';

const DEFAULT_QUESTION_BOARD = 'themes/writing/intro/questionBoard';
const FORBIDDEN_LINE_START = /^[，。！？；：、）》】」』”’…⋯]/u;
const MIN_QUESTION_FONT_SIZE = WRITING_TEXT.questionFontSize - 4;

/** Hard-wrap CJK stem so each line is left-aligned (engine wrap+align is unreliable on web). */
function wrapStemLeft(
  stem: string,
  boxWidth: number,
): { readonly text: string; readonly fontSize: number } {
  let fallback: readonly string[] = [stem];
  for (
    let fontSize = WRITING_TEXT.questionFontSize;
    fontSize >= MIN_QUESTION_FONT_SIZE;
    fontSize -= 1
  ) {
    const lines = wrapChineseText(stem, writingQuestionWrapBudget(boxWidth, fontSize));
    fallback = lines;
    if (!lines.some((line) => FORBIDDEN_LINE_START.test(line))) {
      return { text: lines.join('\n'), fontSize };
    }
  }
  return { text: fallback.join('\n'), fontSize: MIN_QUESTION_FONT_SIZE };
}

export class QuestionBoardView {
  readonly root: Node;
  private readonly label: Label;
  private readonly image: Node;
  private pendingStem = '';

  constructor(parent: Node, texturePath?: string) {
    this.root = createUiNode(
      parent, 'QuestionBoard', L.questionBoard.size[0], L.questionBoard.size[1],
      L.questionBoard.position,
    );
    spriteLoader.apply(this.root, texturePath || DEFAULT_QUESTION_BOARD, 'stretch');
    this.label = createLabel(this.root, '', {
      size: L.questionLabel.fontSize,
      width: L.questionLabel.width,
      height: L.questionLabel.height,
      bold: true,
    });
    this.label.lineHeight = WRITING_TEXT.questionLineHeight;
    this.image = createUiNode(this.root, 'QuestionImage', 145, 78, new Vec3(-250, 0));
    this.image.active = false;
    this.applyLabelFrame(false);
  }

  setQuestion(stem: string, imageUrl?: string): void {
    this.pendingStem = stem;
    this.image.active = Boolean(imageUrl);
    this.applyLabelFrame(Boolean(imageUrl));
    if (imageUrl) spriteLoader.applyRemote(this.image, imageUrl);
  }

  private applyLabelFrame(hasImage: boolean): void {
    const board = {
      width: L.questionBoard.size[0], height: L.questionBoard.size[1],
    };
    const box = writingQuestionLabelBox(board, hasImage);
    let renderedFontSize: number = WRITING_TEXT.questionFontSize;
    this.label.lineHeight = WRITING_TEXT.questionLineHeight;
    this.label.overflow = Label.Overflow.CLAMP;
    this.label.enableWrapText = false;
    this.label.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.label.verticalAlign = VerticalTextAlignment.CENTER;
    if (this.pendingStem) {
      const wrapped = wrapStemLeft(this.pendingStem, box.width);
      renderedFontSize = wrapped.fontSize;
      this.label.string = wrapped.text;
    }
    this.label.fontSize = renderedFontSize;
    const transform = this.label.node.getComponent(UITransform);
    transform?.setAnchorPoint(0, 0.5);
    transform?.setContentSize(box.width, box.height);
    const leftX = -board.width / 2 + WRITING_TEXT.questionPadX + (hasImage ? 145 : 0);
    this.label.node.setPosition(leftX, 0);
    this.label.updateRenderData(true);
    this.label.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.label.verticalAlign = VerticalTextAlignment.CENTER;
    if (typeof document !== 'undefined') {
      document.body.dataset.questionAlign = 'left';
      document.body.dataset.questionVAlign = 'center';
      document.body.dataset.questionHAlign = String(this.label.horizontalAlign);
      document.body.dataset.questionFontSize = String(renderedFontSize);
      document.body.dataset.questionLabelH = String(Math.round(box.height));
    }
  }

  setTexture(texturePath?: string): void {
    this.root.getComponent(Graphics)?.clear();
    spriteLoader.apply(this.root, texturePath || DEFAULT_QUESTION_BOARD, 'stretch');
  }
}
