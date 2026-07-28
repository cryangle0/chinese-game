import {
  Button, HorizontalTextAlignment, Label, Node, UITransform, VerticalTextAlignment, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { createLabel, createUiNode, drawPanel } from '../../../core/ui/UiFactory';
import {
  scaledWritingChoiceColumns, writingPlaySceneLayout,
} from '../../../shared/config/WritingPlaySceneLayout';
import { WRITING_TEXT, writingOptionLabelBox } from '../../../shared/config/WritingTextLayout';
import { ThemeAssets } from '../../../shared/types/Theme';

export interface BookItem {
  root: Node;
  chest: Node;
  option: Node;
  label: Label;
  button: Button;
}

export function createMagicBookItem(
  parent: Node,
  index: number,
  assets: ThemeAssets | undefined,
  sceneId: string,
  onChoose: (index: number) => void,
): BookItem {
  const layout = writingPlaySceneLayout(sceneId);
  const labelBox = writingOptionLabelBox(
    layout.option, layout.option.padX, layout.option.padY,
  );
  const x = scaledWritingChoiceColumns(sceneId, 1)[index] ?? 0;
  const root = createUiNode(
    parent, `MagicBook${index}`, layout.choice.width, layout.choice.height,
    new Vec3(x, layout.choice.y),
  );
  const option = createUiNode(
    root, 'OptionStone', layout.option.width, layout.option.height,
    new Vec3(0, layout.option.localY),
  );
  if (assets?.option) spriteLoader.apply(option, assets.option, 'contain');
  else drawPanel(option, '#E8D4B0', 16, 255);
  const label = createLabel(option, '', {
    size: WRITING_TEXT.optionFontSize,
    width: labelBox.width,
    height: labelBox.height,
    bold: true,
    color: '#3A170E',
  });
  label.overflow = Label.Overflow.SHRINK;
  label.enableWrapText = false;
  label.lineHeight = WRITING_TEXT.optionLineHeight;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  const chest = createUiNode(
    root, 'ChoiceAsset', layout.chest.width, layout.chest.height,
    new Vec3(0, layout.chest.localY),
  );
  spriteLoader.apply(chest, assets?.choices?.[index] ?? '', 'contain');
  const button = root.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.95;
  root.on(Button.EventType.CLICK, () => onChoose(index));
  return { root, chest, option, label, button };
}

export function applyMagicBookLayout(
  items: readonly BookItem[],
  sceneId: string,
  backgroundScaleX: number,
): readonly [number, number, number] {
  const layout = writingPlaySceneLayout(sceneId);
  const columns = scaledWritingChoiceColumns(sceneId, backgroundScaleX);
  const labelBox = writingOptionLabelBox(
    layout.option, layout.option.padX, layout.option.padY,
  );
  items.forEach((item, index) => {
    item.root.getComponent(UITransform)?.setContentSize(
      layout.choice.width, layout.choice.height,
    );
    item.root.setPosition(columns[index] ?? 0, layout.choice.y);
    item.option.getComponent(UITransform)?.setContentSize(
      layout.option.width, layout.option.height,
    );
    item.option.setPosition(0, layout.option.localY);
    item.label.node.getComponent(UITransform)?.setContentSize(labelBox.width, labelBox.height);
    item.label.fontSize = WRITING_TEXT.optionFontSize;
    item.label.lineHeight = WRITING_TEXT.optionLineHeight;
    item.label.overflow = Label.Overflow.SHRINK;
    item.label.enableWrapText = false;
    item.label.horizontalAlign = HorizontalTextAlignment.CENTER;
    item.label.verticalAlign = VerticalTextAlignment.CENTER;
    item.label.node.setPosition(0, 0);
    item.chest.getComponent(UITransform)?.setContentSize(
      layout.chest.width, layout.chest.height,
    );
    item.chest.setPosition(0, layout.chest.localY);
  });
  if (typeof document !== 'undefined') {
    document.body.dataset.choiceScene = sceneId;
    document.body.dataset.choiceColumns = columns.map((value) => value.toFixed(2)).join(',');
    document.body.dataset.choiceOptionFrame =
      `${layout.option.width}x${layout.option.height}@${layout.option.localY}`;
    document.body.dataset.choiceOptionContentBox = `${labelBox.width}x${labelBox.height}`;
    document.body.dataset.choiceOptionPadX = String(layout.option.padX);
    document.body.dataset.choiceOptionAlign = 'center';
    document.body.dataset.choiceOptionLineMode = 'single-line-shrink';
  }
  return columns;
}
