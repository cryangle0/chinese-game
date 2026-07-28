import {
  Button, Graphics, HorizontalTextAlignment, Label, Node, UITransform,
  VerticalTextAlignment, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import {
  createLabel, createUiNode, drawPanel, setLabelColor, setLabelOutline,
} from '../../../core/ui/UiFactory';
import { ReadingSceneLayout } from '../config/ReadingLayout';
import {
  READING_TEXT, readingOptionFontSize, readingOptionLabelBox,
} from '../../../shared/config/ReadingTextLayout';
import { normalizeChineseTypography } from '../../../shared/config/ChineseTextWrap';

const COLUMN_X = [-400, 0, 400] as const;

interface BrickItem {
  root: Node;
  label: Label;
  button: Button;
}

export class BrickGroupView {
  private readonly items: BrickItem[];
  private optionAsset: string;
  private optionWrongAsset: string;
  private selected = -1;
  private poseActive = false;
  private optionTextBoxWidth = readingOptionLabelBox({ width: 380, height: 108 }).width;

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
      item.label.string = stem
        ? `${String.fromCharCode(65 + index)}.${stem}`
        : '';
      this.fitOptionLabel(item.label);
      setLabelColor(item.label, '#FFFFFF');
      item.root.setScale(Vec3.ONE);
    });
    this.selected = -1;
    if (typeof document !== 'undefined') {
      document.body.dataset.optionLabels = this.items.map((i) => i.label.string).join('|');
      document.body.dataset.optionEffectiveFontSizes =
        this.items.map((i) => i.label.fontSize).join(',');
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
    this.items.forEach((item, index) => {
      item.root.setPosition(layout.columns[index], layout.y);
      item.root.getComponent(UITransform)?.setContentSize(layout.width, layout.height);
      item.label.horizontalAlign = HorizontalTextAlignment.CENTER;
      item.label.verticalAlign = VerticalTextAlignment.CENTER;
      // Match stem size; wrap inside face. Avoid SHRINK — it crushed short options.
      item.label.overflow = Label.Overflow.SHRINK;
      item.label.enableWrapText = false;
      item.label.node.setPosition(textOffsetX, 0);
      item.label.node.getComponent(UITransform)?.setContentSize(box.width, box.height);
      this.fitOptionLabel(item.label);
    });
    if (typeof document !== 'undefined') {
      document.body.dataset.optionPadX = String(padX);
      document.body.dataset.optionTextOffsetX = String(textOffsetX);
      document.body.dataset.optionBox = `${layout.width}x${layout.height}`;
      document.body.dataset.optionContentBox = `${box.width}x${box.height}`;
      document.body.dataset.optionFontSize = String(READING_TEXT.optionFontSize);
      document.body.dataset.optionEffectiveFontSizes =
        this.items.map((i) => i.label.fontSize).join(',');
      document.body.dataset.optionAlign = 'center';
      document.body.dataset.optionLineMode = 'single-line-shrink';
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
    if (!correct && this.optionWrongAsset) {
      spriteLoader.apply(item.root, this.optionWrongAsset, 'stretch');
    }
    setLabelColor(item.label, correct ? '#B9FFE4' : '#FFD2D7');
    item.root.setScale(1.06, 1.06, 1);
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
    return { root, label, button };
  }

  private fitOptionLabel(label: Label): void {
    const fontSize = readingOptionFontSize(label.string, this.optionTextBoxWidth);
    label.fontSize = fontSize;
    label.lineHeight = Math.max(fontSize + 4, Math.round(fontSize * 1.125));
  }
}
