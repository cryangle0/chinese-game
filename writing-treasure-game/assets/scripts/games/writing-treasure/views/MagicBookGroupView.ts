import {
  Graphics, Node, UITransform, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { drawPanel, setLabelColor } from '../../../core/ui/UiFactory';
import { ThemeAssets } from '../../../shared/types/Theme';
import { WritingPlayLayout as L } from '../../../shared/config/WritingPlayLayout';
import { scaledWritingChoiceColumns, writingPlaySceneLayout } from '../../../shared/config/WritingPlaySceneLayout';
import {
  formatWritingOption, hideChoiceDuringFeedback, revealChoiceAsset, revealChoiceGeometry,
} from '../../../shared/config/WritingFeedbackPolicy';
import {
  applyMagicBookLayout, BookItem, createMagicBookItem,
} from './MagicBookLayout';
export class MagicBookGroupView {
  private readonly items: BookItem[];
  private assets?: ThemeAssets;
  private backgroundScaleX = 1;
  constructor(
    parent: Node,
    assets: ThemeAssets | undefined,
    private sceneId: string,
    private readonly onChoose: (index: number) => void,
  ) {
    this.assets = assets;
    this.items = [0, 1, 2].map((index) =>
      createMagicBookItem(parent, index, assets, sceneId, this.onChoose));
  }

  setOptions(options: readonly string[]): void {
    if (!this.assets) return;
    this.setVisible(true);
    this.items.forEach((item, index) => {
      item.root.active = true;
      item.option.active = true;
      item.chest.active = true;
      // Re-apply stone every round — eviction / feedback can leave A without a frame.
      this.applyOptionStone(item);
      this.resetChoiceFrame(item);
      spriteLoader.apply(item.chest, this.assets!.choices![index], 'contain');
      item.label.string = formatWritingOption(index, options[index] ?? '');
      setLabelColor(item.label, '#3A170E');
      item.label.node.active = true;
      // Keep label above __sprite (assign inserts sprite at child index 0).
      item.label.node.setSiblingIndex(Math.max(0, item.option.children.length - 1));
      item.root.setScale(Vec3.ONE);
    });
    if (typeof document !== 'undefined') {
      document.body.dataset.optionLabels = this.items.map((i) => i.label.string).join('|');
    }
  }

  setTheme(assets: ThemeAssets, sceneId: string): void {
    this.assets = assets;
    this.sceneId = sceneId;
    this.applyLayout();
    this.items.forEach((item, index) => {
      this.resetChoiceFrame(item);
      item.chest.active = true;
      item.option.active = true;
      spriteLoader.apply(item.chest, assets.choices![index], 'contain');
      this.applyOptionStone(item);
      item.label.node.setSiblingIndex(Math.max(0, item.option.children.length - 1));
    });
  }

  setEnabled(enabled: boolean): void {
    this.items.forEach((item) => { item.button.interactable = enabled; });
  }

  setVisible(visible: boolean): void {
    this.items.forEach((item) => { item.root.active = visible; });
  }

  setActionTarget(selected: number): void {
    this.items.forEach((item, index) => {
      item.button.interactable = index === selected;
      const scale = index === selected ? L.choiceSelectedScale : L.choiceMutedScale;
      item.root.setScale(scale, scale, 1);
    });
  }

  pulse(index: number, scale: number): void {
    this.items[index]?.root.setScale(scale, scale, 1);
  }

  setBackdropScale(scaleX: number): void {
    this.backgroundScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
    this.applyLayout();
  }

  reveal(
    index: number,
    correct: boolean,
    successAsset?: string,
    failAsset?: string,
    _hideSelectedChest = false,
    choiceAssets?: readonly string[],
    sceneId = '',
  ): void {
    this.setVisible(true);
    this.items.forEach((item, itemIndex) => {
      if (itemIndex === index) return;
      item.root.setScale(Vec3.ONE);
      this.applyOptionStone(item);
    });
    const item = this.items[index];
    if (!item) return;
    this.applyOptionStone(item);
    if (hideChoiceDuringFeedback(sceneId, correct)) {
      item.chest.active = false;
      item.option.active = false;
      return;
    }
    item.chest.active = true;
    const stateAsset = correct ? successAsset : failAsset;
    const selectedAsset = revealChoiceAsset(
      sceneId, index, stateAsset, choiceAssets ?? this.assets?.choices,
    );
    const geometry = revealChoiceGeometry(sceneId, correct);
    if (stateAsset && geometry) {
      item.chest.getComponent(UITransform)?.setContentSize(geometry.width, geometry.height);
      item.chest.setPosition(0, geometry.localY);
    } else {
      this.resetChoiceFrame(item);
    }
    if (selectedAsset) spriteLoader.apply(item.chest, selectedAsset, 'contain');
    setLabelColor(item.label, correct ? '#176B3B' : '#9B2135');
    item.label.node.setSiblingIndex(Math.max(0, item.option.children.length - 1));
    item.root.setScale(L.choiceSelectedScale, L.choiceSelectedScale, 1);
  }

  columnX(index: number): number {
    return this.columns()[index] ?? 0;
  }

  scoreRewardOrigin(index: number): { readonly node: Node; readonly localPoint: Vec3 } | null {
    const item = this.items[index];
    if (!item) return null;
    return {
      node: item.chest,
      localPoint: Vec3.ZERO.clone(),
    };
  }

  columns(): readonly [number, number, number] {
    return scaledWritingChoiceColumns(this.sceneId, this.backgroundScaleX);
  }

  private applyOptionStone(item: BookItem): void {
    const path = this.assets?.option ?? '';
    if (path) {
      item.option.getComponent(Graphics)?.clear();
      spriteLoader.apply(item.option, path, 'contain');
      if (typeof document !== 'undefined') {
        document.body.dataset.choiceOptionFallbackCleared = '1';
      }
    } else {
      drawPanel(item.option, '#E8D4B0', 16, 255);
    }
  }

  private resetChoiceFrame(item: BookItem): void {
    const { chest } = writingPlaySceneLayout(this.sceneId);
    item.chest.getComponent(UITransform)?.setContentSize(chest.width, chest.height);
    item.chest.setPosition(0, chest.localY);
  }

  private applyLayout(): void {
    applyMagicBookLayout(this.items, this.sceneId, this.backgroundScaleX);
  }
}
