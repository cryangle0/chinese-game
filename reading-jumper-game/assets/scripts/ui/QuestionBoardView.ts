import {
  Graphics, HorizontalTextAlignment, Label, Node, UITransform,
  VerticalTextAlignment, Vec3,
} from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import {
  createLabel, createUiNode, drawPanel, setLabelOutline,
} from '../core/ui/UiFactory';
import { READING_TEXT } from '../shared/config/ReadingTextLayout';
import { wrapChineseText } from '../shared/config/ChineseTextWrap';

interface QuestionBoardLayout {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  /** Extra top inset for decorative crown / gem chrome on the board PNG. */
  readonly padTopExtra?: number;
  /** Side inset override for themed chrome (chocolate / mech / bricks). */
  readonly padX?: number;
}

/** Outline is drawn outside the glyph run, so it eats width at both line ends. */
const STEM_OUTLINE_WIDTH = 2;

/** Hard-wrap CJK stem so each line stays inside the painted face. */
function wrapStemLeft(stem: string, boxWidth: number, fontSize: number): string {
  const usable = Math.max(fontSize, boxWidth - STEM_OUTLINE_WIDTH * 2);
  return wrapChineseText(stem, usable / fontSize).join('\n');
}

export class QuestionBoardView {
  readonly root: Node;
  private readonly label: Label;
  private readonly image: Node;
  private boardW = 860;
  private boardH = 214;
  private padTopExtra = 0;
  private padX: number = READING_TEXT.questionPadX;
  private pendingStem = '';

  constructor(parent: Node, texturePath?: string) {
    this.root = createUiNode(parent, 'QuestionBoard', 860, 214, new Vec3(0, 172));
    if (texturePath) spriteLoader.apply(this.root, texturePath, 'stretch');
    else drawPanel(this.root, '#163D75', 24, 238);
    const initialW = Math.max(200, 860 - READING_TEXT.questionPadX * 2);
    const initialH = Math.max(88, 214 - READING_TEXT.questionPadY * 2);
    this.label = createLabel(this.root, '', {
      size: READING_TEXT.questionFontSize,
      width: initialW,
      height: initialH,
      bold: true,
      outlineColor: '#163D75',
      outlineWidth: 2,
    });
    this.label.lineHeight = READING_TEXT.questionLineHeight;
    this.image = createUiNode(this.root, 'QuestionImage', 180, 120, new Vec3(-270, 0));
    this.image.active = false;
    this.applyLabelFrame(false);
  }

  setQuestion(stem: string, imageUrl?: string): void {
    this.pendingStem = stem;
    this.image.active = Boolean(imageUrl);
    this.applyLabelFrame(Boolean(imageUrl));
    if (imageUrl) spriteLoader.applyRemote(this.image, imageUrl);
  }

  setTexture(texturePath?: string): void {
    if (texturePath) {
      this.root.getComponent(Graphics)?.clear();
      spriteLoader.apply(this.root, texturePath, 'stretch');
    } else drawPanel(this.root, '#163D75', 24, 238);
  }

  setTextStyle(outlineColor: string): void {
    setLabelOutline(this.label, outlineColor, 2);
  }

  setLayout(layout: QuestionBoardLayout): void {
    this.root.setPosition(layout.x, layout.y);
    this.root.getComponent(UITransform)?.setContentSize(layout.width, layout.height);
    this.boardW = layout.width;
    this.boardH = layout.height;
    this.padTopExtra = Math.max(0, layout.padTopExtra ?? 0);
    this.padX = Math.max(
      READING_TEXT.questionPadX,
      layout.padX ?? READING_TEXT.questionPadX,
    );
    this.applyLabelFrame(this.image.active);
  }

  private applyLabelFrame(hasImage: boolean): void {
    const padX = this.padX;
    const padTop = READING_TEXT.questionPadY + this.padTopExtra;
    const padBottom = READING_TEXT.questionPadY;
    const textH = Math.max(88, this.boardH - padTop - padBottom);
    const box = hasImage
      ? {
        width: Math.max(200, this.boardW - 180 - padX * 2),
        height: textH,
      }
      : {
        width: Math.max(200, this.boardW - padX * 2),
        height: textH,
      };

    this.label.fontSize = READING_TEXT.questionFontSize;
    this.label.lineHeight = READING_TEXT.questionLineHeight;
    this.label.overflow = Label.Overflow.CLAMP;
    this.label.enableWrapText = false;
    this.label.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.label.verticalAlign = VerticalTextAlignment.CENTER;
    if (this.pendingStem) {
      this.label.string = wrapStemLeft(
        this.pendingStem, box.width, READING_TEXT.questionFontSize,
      );
    }

    const transform = this.label.node.getComponent(UITransform);
    transform?.setAnchorPoint(0, 0.5);
    transform?.setContentSize(box.width, box.height);
    const faceY = (padBottom - padTop) / 2;
    const leftX = -this.boardW / 2 + padX + (hasImage ? 180 : 0);
    this.label.node.setPosition(leftX, faceY);
    this.label.updateRenderData(true);
    this.label.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.label.verticalAlign = VerticalTextAlignment.CENTER;

    if (typeof document !== 'undefined') {
      document.body.dataset.questionAlign = 'left';
      document.body.dataset.questionVAlign = 'center';
      document.body.dataset.questionHAlign = String(this.label.horizontalAlign);
      document.body.dataset.questionPadX = String(padX);
      document.body.dataset.questionPadY = String(READING_TEXT.questionPadY);
      document.body.dataset.questionPadTopExtra = String(this.padTopExtra);
      document.body.dataset.questionFaceY = String(Math.round(faceY));
      document.body.dataset.questionLineHeight = String(READING_TEXT.questionLineHeight);
      document.body.dataset.questionLabelH = String(Math.round(box.height));
      document.body.dataset.questionLabelW = String(Math.round(box.width));
      document.body.dataset.questionLabelNudge = String(Math.round(faceY));
      document.body.dataset.questionWrapped = this.label.string.includes('\n') ? '1' : '0';
    }
  }
}
