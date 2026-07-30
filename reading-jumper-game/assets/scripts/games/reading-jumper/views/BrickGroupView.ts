import {
  Button, Graphics, HorizontalTextAlignment, Label, Node, tween, Tween, UITransform,
  VerticalTextAlignment, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import {
  createLabel, createUiNode, drawPanel, setLabelColor, setLabelOutline,
} from '../../../core/ui/UiFactory';
import { ReadingSceneLayout } from '../config/ReadingLayout';
import {
  READING_TEXT, readingOptionLabelBox, readingOptionTextLayout,
} from '../../../shared/config/ReadingTextLayout';
import { normalizeChineseTypography } from '../../../shared/config/ChineseTextWrap';
import { READING_BRICK_IMPACT_LIFT } from '../config/ReadingLayout';

const COLUMN_X = [-400, 0, 400] as const;

interface BrickItem {
  root: Node;
  label: Label;
  button: Button;
  sourceText: string;
}

export class BrickGroupView {
  private readonly items: BrickItem[];
  private optionAsset: string;
  private optionWrongAsset: string;
  private selected = -1;
  private poseActive = false;
  private optionTextBoxWidth = readingOptionLabelBox({ width: 380, height: 108 }).width;
  private optionTextBoxHeight = readingOptionLabelBox({ width: 380, height: 108 }).height;

  constructor(
    parent: Node,
    optionAsset: string,
    optionWrongAsset: string,
    private readonly onChoose: (index: number) => void,
  ) {
    this.optionAsset = optionAsset;
    this.optionWrongAsset = optionWrongAsset;
    this.items = COLUMN_X.map((x, index) => this.createBrick(parent, optionAsset, x, index));
  }

  setOptions(options: readonly string[]): void {
    this.items.forEach((item, index) => {
      spriteLoader.apply(item.root, this.optionAsset, 'stretch');
      const raw = options[index] ?? '';
      const stem = normalizeChineseTypography(raw.replace(/^[A-Ca-c][.、．]\s*/, ''));
      item.sourceText = stem
        ? `${String.fromCharCode(65 + index)}.${stem}`
        : '';
      this.fitOptionLabel(item);
      setLabelColor(item.label, '#FFFFFF');
      item.root.setScale(Vec3.ONE);
    });
    this.selected = -1;
    if (typeof document !== 'undefined') {
      document.body.dataset.optionLabels = this.items.map((i) => i.sourceText).join('|');
      document.body.dataset.optionRenderedLabels =
        this.items.map((i) => i.label.string.replace(/\n/g, '\\n')).join('|');
      document.body.dataset.optionEffectiveFontSizes =
        this.items.map((i) => i.label.fontSize).join(',');
      document.body.dataset.optionLineCounts =
        this.items.map((i) => i.label.string.split('\n').length).join(',');
    }
  }

  setTheme(optionAsset: string, optionWrongAsset = ''): void {
    this.optionAsset = optionAsset;
    this.optionWrongAsset = optionWrongAsset;
    this.items.forEach((item) => {
      if (optionAsset) {
        item.root.getComponent(Graphics)?.clear();
        spriteLoader.apply(item.root, optionAsset, 'stretch');
      } else drawPanel(item.root, '#075A91', 18, 220);
    });
  }

  setTextStyle(outlineColor: string): void {
    this.items.forEach((item) => setLabelOutline(item.label, outlineColor, 2));
  }

  setLayout(layout: ReadingSceneLayout['option']): void {
    const padX = layout.padX ?? READING_TEXT.optionPadX;
    const textOffsetX = layout.textOffsetX ?? 0;
    const box = readingOptionLabelBox(
      { width: layout.width, height: layout.height },
      padX,
    );
    this.optionTextBoxWidth = box.width;
    this.optionTextBoxHeight = box.height;
    this.items.forEach((item, index) => {
      item.root.setPosition(layout.columns[index], layout.y);
      item.root.getComponent(UITransform)?.setContentSize(layout.width, layout.height);
      item.label.horizontalAlign = HorizontalTextAlignment.CENTER;
      item.label.verticalAlign = VerticalTextAlignment.CENTER;
      // Manual line breaks keep normal-size text readable. SHRINK remains only
      // as a final fallback for platform-specific font metric differences.
      item.label.overflow = Label.Overflow.SHRINK;
      item.label.enableWrapText = false;
      item.label.node.setPosition(textOffsetX, 0);
      item.label.node.getComponent(UITransform)?.setContentSize(box.width, box.height);
      this.fitOptionLabel(item);
    });
    if (typeof document !== 'undefined') {
      document.body.dataset.optionPadX = String(padX);
      document.body.dataset.optionTextOffsetX = String(textOffsetX);
      document.body.dataset.optionBox = `${layout.width}x${layout.height}`;
      document.body.dataset.optionContentBox = `${box.width}x${box.height}`;
      document.body.dataset.optionFontSize = String(READING_TEXT.optionFontSize);
      document.body.dataset.optionEffectiveFontSizes =
        this.items.map((i) => i.label.fontSize).join(',');
      document.body.dataset.optionLineCounts =
        this.items.map((i) => i.label.string.split('\n').length).join(',');
      document.body.dataset.optionAlign = 'center';
      document.body.dataset.optionLineMode = 'wrap-first-max-2';
    }
  }

  setEnabled(enabled: boolean): void {
    this.items.forEach((item) => {
      item.button.interactable = enabled;
    });
    if (!enabled) this.setPoseSelection(null);
  }

  setPoseActive(active: boolean): void {
    this.poseActive = active;
    if (!active) this.setPoseSelection(null);
  }

  setPoseSelection(index: number | null): void {
    this.selected = this.poseActive && index !== null ? index : -1;
    this.items.forEach((item, itemIndex) => {
      item.root.setScale(itemIndex === this.selected ? 1.045 : 1, itemIndex === this.selected ? 1.045 : 1, 1);
      setLabelColor(item.label, itemIndex === this.selected ? '#FFE082' : '#FFFFFF');
    });
  }

  showResult(selected: number, correct: boolean): void {
    const item = this.items[selected];
    if (!item) return;
    Tween.stopAllByTarget(item.root);
    if (!correct && this.optionWrongAsset) {
      spriteLoader.apply(item.root, this.optionWrongAsset, 'stretch');
    }
    setLabelColor(item.label, correct ? '#B9FFE4' : '#FFD2D7');
    const base = item.root.position.clone();
    const resultScale = new Vec3(1.06, 1.06, 1);
    tween(item.root)
      .to(
        0.07,
        {
          position: new Vec3(base.x, base.y + READING_BRICK_IMPACT_LIFT, base.z),
          scale: new Vec3(1.045, 0.98, 1),
        },
        { easing: 'quadOut' },
      )
      .to(
        0.13,
        { position: base, scale: resultScale },
        { easing: 'backOut' },
      )
      .call(() => {
        if (typeof document !== 'undefined') {
          document.body.dataset.brickImpact =
            `${selected}:${READING_BRICK_IMPACT_LIFT}`;
        }
      })
      .start();
  }

  scoreRewardOrigin(index: number): { readonly node: Node; readonly localPoint: Vec3 } | null {
    const item = this.items[index];
    const transform = item?.root.getComponent(UITransform);
    if (!item || !transform) return null;
    return { node: item.root, localPoint: new Vec3(0, transform.contentSize.height / 2 + 8) };
  }

  private createBrick(parent: Node, assetPath: string, x: number, index: number): BrickItem {
    const root = createUiNode(parent, `Brick${index}`, 380, 108, new Vec3(x, -25));
    if (assetPath) spriteLoader.apply(root, assetPath, 'stretch');
    else drawPanel(root, '#075A91', 18, 220);
    const box = readingOptionLabelBox({ width: 380, height: 108 });
    const label = createLabel(root, '', {
      size: READING_TEXT.optionFontSize,
      width: box.width,
      height: box.height,
      bold: true,
      outlineColor: '#075A91',
      outlineWidth: 2,
    });
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = false;
    label.lineHeight = READING_TEXT.optionLineHeight;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.node.setPosition(0, 0);
    const button = root.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    root.on(Button.EventType.CLICK, () => this.onChoose(index));
    return { root, label, button, sourceText: '' };
  }

  private fitOptionLabel(item: BrickItem): void {
    const layout = readingOptionTextLayout(
      item.sourceText,
      this.optionTextBoxWidth,
      this.optionTextBoxHeight,
    );
    item.label.string = layout.text;
    item.label.fontSize = layout.fontSize;
    item.label.lineHeight = layout.lineHeight;
  }
}
