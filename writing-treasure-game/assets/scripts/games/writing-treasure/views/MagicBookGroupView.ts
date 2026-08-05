import {
  Graphics, Node, Tween, tween, UITransform, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { drawPanel, setLabelColor } from '../../../core/ui/UiFactory';
import { CLASSIC_TREASURE_FEEDBACK } from '../../../shared/config/ClassicTreasureFeedback';
import { DESERT_TREASURE_FEEDBACK } from '../../../shared/config/DesertTreasureFeedback';
import { DINOSAUR_TREASURE_FEEDBACK } from '../../../shared/config/DinosaurTreasureFeedback';
import { MAGIC_ACADEMY_FEEDBACK } from '../../../shared/config/MagicAcademyFeedback';
import { ThemeAssets } from '../../../shared/types/Theme';
import { WritingPlayLayout as L } from '../../../shared/config/WritingPlayLayout';
import { scaledWritingChoiceColumns, writingPlaySceneLayout } from '../../../shared/config/WritingPlaySceneLayout';
import {
  formatWritingOption, hideChoiceDuringFeedback, revealChoiceAsset, revealChoiceGeometry,
} from '../../../shared/config/WritingFeedbackPolicy';
import {
  applyMagicBookLayout, BookItem, createMagicBookItem,
} from './MagicBookLayout';
import { ClassicTreasureHoleView } from './ClassicTreasureHoleView';
import { DesertTreasureHoleView } from './DesertTreasureHoleView';
import { DunhuangTreasureBreakView } from './DunhuangTreasureBreakView';
import { MagicAcademyBreakView } from './MagicAcademyBreakView';

function waitForVisualCommit(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export class MagicBookGroupView {
  private readonly items: BookItem[];
  private readonly classicHole: ClassicTreasureHoleView;
  private readonly desertHole: DesertTreasureHoleView;
  private readonly dunhuangBreak: DunhuangTreasureBreakView;
  private readonly magicAcademyBreak: MagicAcademyBreakView;
  private assets?: ThemeAssets;
  private backgroundScaleX = 1;
  private dinosaurWrongActorLayer: {
    readonly actor: Node;
    readonly siblingIndex: number;
  } | null = null;
  private magicAcademyWrongActorLayer: {
    readonly actor: Node;
    readonly siblingIndex: number;
  } | null = null;

  constructor(
    parent: Node,
    assets: ThemeAssets | undefined,
    private sceneId: string,
    private readonly onChoose: (index: number) => void,
  ) {
    this.assets = assets;
    this.classicHole = new ClassicTreasureHoleView(parent);
    this.desertHole = new DesertTreasureHoleView(parent);
    this.dunhuangBreak = new DunhuangTreasureBreakView(parent);
    this.magicAcademyBreak = new MagicAcademyBreakView(parent);
    this.dunhuangBreak.setOpenTopAsset(assets?.dunhuangOpenTop ?? '');
    this.items = [0, 1, 2].map((index) =>
      createMagicBookItem(parent, index, assets, sceneId, this.onChoose));
    this.dunhuangBreak.mountOverlay();
    this.magicAcademyBreak.mountOverlay();
  }

  setOptions(options: readonly string[]): void {
    if (!this.assets) return;
    this.restoreDinosaurWrongActorLayer();
    this.restoreMagicAcademyWrongActorLayer();
    this.classicHole.hide();
    this.desertHole.hide();
    this.dunhuangBreak.hide();
    this.magicAcademyBreak.hide();
    this.setVisible(true);
    this.items.forEach((item, index) => {
      item.root.active = true;
      item.option.active = true;
      item.chest.active = true;
      this.resetOptionMotion(item);
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
    this.restoreDinosaurWrongActorLayer();
    this.restoreMagicAcademyWrongActorLayer();
    this.assets = assets;
    this.sceneId = sceneId;
    this.dunhuangBreak.setOpenTopAsset(assets.dunhuangOpenTop ?? '');
    this.classicHole.hide();
    this.desertHole.hide();
    this.dunhuangBreak.hide();
    this.magicAcademyBreak.hide();
    this.applyLayout();
    this.items.forEach((item, index) => {
      this.resetOptionMotion(item);
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

  playClassicTreasureDig(
    index: number,
    holdMs: number,
    impactAtMs: readonly number[],
    bobOption = true,
  ): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'treasure') return;
    this.classicHole.play(index, this.columnX(index), impactAtMs);
    if (!bobOption) return;
    const baseY = writingPlaySceneLayout(this.sceneId).option.localY;
    const bounceMs = 180;
    const upMs = 55;
    const downMs = 70;
    const settleMs = bounceMs - upMs - downMs;
    const lastStartMs = Math.max(0, holdMs - bounceMs);
    const impacts = impactAtMs
      .map((value) => Math.min(lastStartMs, Math.max(0, value)))
      .filter((value, impactIndex, values) =>
        impactIndex === 0 || value > values[impactIndex - 1]!);
    Tween.stopAllByTarget(item.option);
    item.option.setPosition(0, baseY, 0);
    const sequence = tween(item.option);
    let cursorMs = 0;
    impacts.forEach((impactMs) => {
      sequence
        .delay(Math.max(0, impactMs - cursorMs) / 1000)
        .call(() => this.markClassicOption(index, 'bob-up', baseY))
        .to(upMs / 1000, {
          position: new Vec3(0, baseY + CLASSIC_TREASURE_FEEDBACK.optionBobLift, 0),
        }, { easing: 'quadOut' })
        .call(() => this.markClassicOption(index, 'bob-down', baseY))
        .to(downMs / 1000, {
          position: new Vec3(0, baseY - CLASSIC_TREASURE_FEEDBACK.optionBobDip, 0),
        }, { easing: 'quadInOut' })
        .call(() => this.markClassicOption(index, 'bob-settle', baseY))
        .to(settleMs / 1000, {
          position: new Vec3(0, baseY, 0),
        }, { easing: 'quadOut' });
      cursorMs = impactMs + bounceMs;
    });
    if (cursorMs < holdMs) sequence.delay((holdMs - cursorMs) / 1000);
    sequence
      .call(() => this.markClassicOption(index, 'dig-complete', baseY))
      .start();
  }

  sinkClassicTreasureOption(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'treasure') return Promise.resolve();
    Tween.stopAllByTarget(item.option);
    item.label.node.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.classicTreasureOptionLabel = 'hidden-before-sink';
    }
    this.markClassicOption(index, 'sinking', item.option.position.y);
    return new Promise((resolve) => {
      tween(item.option)
        .to(CLASSIC_TREASURE_FEEDBACK.optionSinkMs / 1000, {
          position: new Vec3(0, CLASSIC_TREASURE_FEEDBACK.optionSinkY, 0),
        }, { easing: 'quadIn' })
        .call(() => {
          item.option.active = false;
          this.markClassicOption(
            index,
            'hidden-at-hole-bottom',
            CLASSIC_TREASURE_FEEDBACK.optionSinkY,
          );
          resolve();
        })
        .start();
    });
  }

  playDesertTreasureDig(
    index: number,
    impactAtMs: readonly number[],
  ): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'desert') return;
    this.desertHole.play(index, this.columnX(index), impactAtMs);
    this.markDesertOption(index, 'digging', item.option.position.y);
  }

  playDunhuangTreasureCast(
    index: number,
    impactAtMs: readonly number[],
  ): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dunhuang') return;
    this.dunhuangBreak.prepare(index, this.columnX(index), impactAtMs);
  }

  breakDunhuangTreasureWall(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dunhuang') return Promise.resolve();
    Tween.stopAllByTarget(item.option);
    item.option.setPosition(
      0,
      writingPlaySceneLayout(this.sceneId).option.localY,
      0,
    );
    item.option.angle = 0;
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = true;
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureOptionLabel = 'hidden-before-break';
      document.body.dataset.dunhuangTreasureOptionPhase = 'wall-broken';
    }
    return this.dunhuangBreak.breakOpen(index, this.columnX(index));
  }

  openDunhuangTreasureWrongCavity(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dunhuang') return Promise.resolve();
    Tween.stopAllByTarget(item.option);
    item.option.setPosition(
      0,
      writingPlaySceneLayout(this.sceneId).option.localY,
      0,
    );
    item.option.angle = 0;
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureOptionLabel =
        'hidden-before-wrong-drop';
      document.body.dataset.dunhuangTreasureOptionPhase =
        'wrong-cavity-open';
    }
    return this.dunhuangBreak.openWrongCavity(index, this.columnX(index));
  }

  playMagicAcademyCast(index: number): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'magic') return;
    this.magicAcademyBreak.prepare(index, this.columnX(index));
  }

  openMagicAcademyCavity(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'magic') return Promise.resolve();
    Tween.stopAllByTarget(item.option);
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = true;
    item.root.setScale(Vec3.ONE);
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyOptionIndex = String(index);
      document.body.dataset.magicAcademyOptionLabel = 'hidden-before-break';
      document.body.dataset.magicAcademyOptionPhase = 'top-open';
    }
    return this.magicAcademyBreak.breakOpen(index, this.columnX(index));
  }

  unlockMagicAcademyBook(
    index: number,
    onOpen?: () => void,
  ): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'magic') return Promise.resolve();
    return this.magicAcademyBreak.playUnlock(
      index,
      this.columnX(index),
      async () => {
        await this.showMagicAcademyBookState(index, true);
        Tween.stopAllByTarget(item.chest);
        item.chest.setScale(0.92, 0.92, 1);
        tween(item.chest)
          .to(MAGIC_ACADEMY_FEEDBACK.bookPulseMs / 1000 * 0.42, {
            scale: new Vec3(1.08, 1.08, 1),
          }, { easing: 'backOut' })
          .to(MAGIC_ACADEMY_FEEDBACK.bookPulseMs / 1000 * 0.58, {
            scale: Vec3.ONE,
          }, { easing: 'quadOut' })
          .start();
        onOpen?.();
      },
    );
  }

  showMagicAcademyWrongBook(index: number): Promise<void> {
    return this.showMagicAcademyBookState(index, false);
  }

  placeMagicAcademyActorBehindBook(index: number, actor: Node): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'magic') return;
    this.restoreMagicAcademyWrongActorLayer();
    if (!item.root.parent || item.root.parent !== actor.parent) return;
    const actorSiblingIndex = actor.getSiblingIndex();
    const bookSiblingIndex = item.root.getSiblingIndex();
    this.magicAcademyWrongActorLayer = {
      actor,
      siblingIndex: actorSiblingIndex,
    };
    if (actorSiblingIndex > bookSiblingIndex) {
      actor.setSiblingIndex(bookSiblingIndex);
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyActorLayer = 'behind-selected-book';
      document.body.dataset.magicAcademyActorLayerIndex =
        actor.getSiblingIndex().toFixed(0);
      document.body.dataset.magicAcademyBookLayerIndex =
        item.root.getSiblingIndex().toFixed(0);
    }
  }

  restoreMagicAcademyActorLayer(): void {
    this.restoreMagicAcademyWrongActorLayer();
  }

  dropDesertTreasureOption(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'desert') return Promise.resolve();
    Tween.stopAllByTarget(item.option);
    item.label.node.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.desertTreasureOptionLabel = 'hidden-before-drop';
    }
    this.markDesertOption(index, 'dropping', item.option.position.y);
    return new Promise((resolve) => {
      tween(item.option)
        .to(DESERT_TREASURE_FEEDBACK.optionDropMs / 1000, {
          position: new Vec3(0, DESERT_TREASURE_FEEDBACK.optionDropY, 0),
          angle: index === 1 ? 0 : index === 0 ? -3 : 3,
        }, { easing: 'quadIn' })
        .call(() => {
          item.option.active = false;
          this.markDesertOption(
            index,
            'hidden-at-pit-bottom',
            DESERT_TREASURE_FEEDBACK.optionDropY,
          );
          resolve();
        })
        .start();
    });
  }

  prepareDinosaurCorrect(index: number): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dinosaur') return;
    Tween.stopAllByTarget(item.option);
    Tween.stopAllByTarget(item.chest);
    item.root.setScale(Vec3.ONE);
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureOptionIndex = String(index);
      document.body.dataset.dinosaurTreasureOptionPhase =
        'hidden-before-actor-drop';
      document.body.dataset.dinosaurTreasureOptionLabel = 'hidden';
      document.body.dataset.dinosaurTreasureEgg = 'hidden';
    }
  }

  prepareDinosaurWrong(index: number): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dinosaur') return;
    Tween.stopAllByTarget(item.option);
    Tween.stopAllByTarget(item.chest);
    const layout = writingPlaySceneLayout(this.sceneId);
    item.root.setScale(Vec3.ONE);
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = true;
    item.chest.setPosition(0, layout.chest.localY, 0);
    item.chest.setScale(
      DINOSAUR_TREASURE_FEEDBACK.wrongWatchEggScale,
      DINOSAUR_TREASURE_FEEDBACK.wrongWatchEggScale,
      1,
    );
    item.chest.angle = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureOptionIndex = String(index);
      document.body.dataset.dinosaurTreasureOptionPhase =
        'hidden-before-wrong-actor-drop';
      document.body.dataset.dinosaurTreasureOptionLabel = 'hidden';
      document.body.dataset.dinosaurTreasureEgg = 'visible-for-actor-watch';
    }
  }

  placeDinosaurWrongEggInFront(index: number, actor: Node): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dinosaur') return;
    this.restoreDinosaurWrongActorLayer();
    if (!item.root.parent || item.root.parent !== actor.parent) return;
    const actorSiblingIndex = actor.getSiblingIndex();
    const eggSiblingIndex = item.root.getSiblingIndex();
    this.dinosaurWrongActorLayer = {
      actor,
      siblingIndex: actorSiblingIndex,
    };
    if (actorSiblingIndex > eggSiblingIndex) {
      actor.setSiblingIndex(eggSiblingIndex);
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureEggLayer =
        'in-front-of-watching-actor';
      document.body.dataset.dinosaurTreasureActorLayerIndex =
        actor.getSiblingIndex().toFixed(0);
      document.body.dataset.dinosaurTreasureEggLayerIndex =
        item.root.getSiblingIndex().toFixed(0);
    }
  }

  shakeDinosaurWrongEgg(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dinosaur') return Promise.resolve();
    Tween.stopAllByTarget(item.chest);
    item.chest.active = true;
    const baseScale = DINOSAUR_TREASURE_FEEDBACK.wrongWatchEggScale;
    item.chest.setScale(baseScale, baseScale, 1);
    item.chest.angle = 0;
    const segmentSeconds =
      DINOSAUR_TREASURE_FEEDBACK.wrongEggWatchMs / 8 / 1000;
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureEgg = 'rocking-before-hatch';
    }
    return new Promise((resolve) => {
      const sequence = tween(item.chest);
      for (let cycle = 0; cycle < 4; cycle += 1) {
        sequence
          .to(segmentSeconds, {
            angle: -4,
            scale: new Vec3(
              baseScale * 1.025,
              baseScale * 0.985,
              1,
            ),
          }, { easing: 'quadInOut' })
          .to(segmentSeconds, {
            angle: 4,
            scale: new Vec3(
              baseScale * 0.985,
              baseScale * 1.025,
              1,
            ),
          }, { easing: 'quadInOut' });
      }
      sequence
        .call(() => {
          item.chest.angle = 0;
          item.chest.setScale(baseScale, baseScale, 1);
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureEgg =
              'ready-to-break-open';
          }
          resolve();
        })
        .start();
    });
  }

  hideDinosaurWrongEgg(index: number): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'dinosaur') return;
    Tween.stopAllByTarget(item.chest);
    item.chest.angle = 0;
    item.chest.setScale(Vec3.ONE);
    item.chest.active = false;
    this.restoreDinosaurWrongActorLayer();
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureEgg = 'hidden-at-hatch';
    }
  }

  showDesertTreasureCavity(index: number): void {
    if (this.sceneId !== 'desert') return;
    this.desertHole.showCavity(index, this.columnX(index));
  }

  async prepareDesertWrongSarcophagus(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'desert') return;
    Tween.stopAllByTarget(item.chest);
    item.chest.active = true;
    item.chest.getComponent(UITransform)?.setContentSize(
      DESERT_TREASURE_FEEDBACK.wrongSarcophagusWidth,
      DESERT_TREASURE_FEEDBACK.wrongSarcophagusHeight,
    );
    item.chest.setPosition(
      0,
      DESERT_TREASURE_FEEDBACK.wrongSarcophagusStartY,
      0,
    );
    item.chest.setScale(Vec3.ONE);
    item.chest.angle = 0;
    const selectedAsset = this.assets?.choices?.[index] ?? '';
    const applied = await spriteLoader.applyReady(
      item.chest,
      selectedAsset,
      'contain',
    );
    await waitForVisualCommit();
    this.markDesertSarcophagus(
      index,
      applied ? 'ready-at-hole' : 'asset-load-failed',
      item.chest.position.y,
    );
  }

  dropDesertWrongSarcophagus(index: number): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'desert') return Promise.resolve();
    Tween.stopAllByTarget(item.chest);
    this.markDesertSarcophagus(index, 'dropping-to-pit-bottom', item.chest.position.y);
    return new Promise((resolve) => {
      tween(item.chest)
        .to(DESERT_TREASURE_FEEDBACK.wrongSarcophagusDropMs / 1000, {
          position: new Vec3(
            0,
            DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY,
            0,
          ),
          scale: Vec3.ONE,
          angle: 0,
        }, { easing: 'quadIn' })
        .call(() => {
          this.markDesertSarcophagus(
            index,
            'at-pit-bottom',
            DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY,
          );
          resolve();
        })
        .start();
    });
  }

  setBackdropScale(scaleX: number): void {
    this.backgroundScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
    this.applyLayout();
  }

  hideClassicTreasureHole(): void {
    this.classicHole.hide();
  }

  hideDesertTreasureHole(): void {
    this.desertHole.hide();
  }

  hideDunhuangTreasureBreak(): void {
    this.dunhuangBreak.hide();
  }

  hideMagicAcademyBreak(): void {
    this.magicAcademyBreak.hide();
    this.restoreMagicAcademyWrongActorLayer();
  }

  hideDesertTreasureChoice(index: number): void {
    const item = this.items[index];
    if (!item || this.sceneId !== 'desert') return;
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.desertTreasureChoice = 'hidden-under-sand';
    }
  }

  async reveal(
    index: number,
    correct: boolean,
    successAsset?: string,
    failAsset?: string,
    _hideSelectedChest = false,
    choiceAssets?: readonly string[],
    sceneId = '',
    successAssets?: readonly string[],
    failAssets?: readonly string[],
  ): Promise<void> {
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
      if (typeof document !== 'undefined') {
        document.body.dataset.choiceRevealReady = 'hidden';
      }
      return;
    }
    item.chest.active = true;
    const stateAsset = correct ? successAsset : failAsset;
    const stateAssets = correct ? successAssets : failAssets;
    const selectedAsset = revealChoiceAsset(
      sceneId, index, stateAsset, choiceAssets ?? this.assets?.choices, stateAssets,
    );
    const geometry = revealChoiceGeometry(sceneId, correct);
    if (selectedAsset && geometry && (stateAsset || stateAssets?.[index])) {
      item.chest.getComponent(UITransform)?.setContentSize(geometry.width, geometry.height);
      item.chest.setPosition(0, geometry.localY);
    } else {
      this.resetChoiceFrame(item);
    }
    const applied = selectedAsset
      ? await spriteLoader.applyReady(item.chest, selectedAsset, 'contain')
      : false;
    await waitForVisualCommit();
    if (typeof document !== 'undefined') {
      document.body.dataset.choiceRevealAsset = selectedAsset ?? '';
      document.body.dataset.choiceRevealIndex = String(index);
      document.body.dataset.choiceRevealScene = sceneId;
      document.body.dataset.choiceRevealReady = applied ? 'true' : 'fallback';
      document.body.dataset.choiceRevealReadyAt = (
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      ).toFixed(3);
    }
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

  private resetOptionMotion(item: BookItem): void {
    Tween.stopAllByTarget(item.option);
    const { option } = writingPlaySceneLayout(this.sceneId);
    item.option.setPosition(0, option.localY, 0);
    item.option.setScale(Vec3.ONE);
    item.option.angle = 0;
  }

  private restoreDinosaurWrongActorLayer(): void {
    const layer = this.dinosaurWrongActorLayer;
    this.dinosaurWrongActorLayer = null;
    if (layer?.actor.isValid && layer.actor.parent) {
      layer.actor.setSiblingIndex(Math.min(
        layer.siblingIndex,
        Math.max(0, layer.actor.parent.children.length - 1),
      ));
    }
    if (typeof document !== 'undefined') {
      delete document.body.dataset.dinosaurTreasureEggLayer;
      delete document.body.dataset.dinosaurTreasureActorLayerIndex;
      delete document.body.dataset.dinosaurTreasureEggLayerIndex;
    }
  }

  private restoreMagicAcademyWrongActorLayer(): void {
    const layer = this.magicAcademyWrongActorLayer;
    this.magicAcademyWrongActorLayer = null;
    if (layer?.actor.isValid && layer.actor.parent) {
      layer.actor.setSiblingIndex(Math.min(
        layer.siblingIndex,
        Math.max(0, layer.actor.parent.children.length - 1),
      ));
    }
    if (typeof document !== 'undefined') {
      delete document.body.dataset.magicAcademyActorLayer;
      delete document.body.dataset.magicAcademyActorLayerIndex;
      delete document.body.dataset.magicAcademyBookLayerIndex;
    }
  }

  private async showMagicAcademyBookState(
    index: number,
    correct: boolean,
  ): Promise<void> {
    const item = this.items[index];
    if (!item || this.sceneId !== 'magic') return;
    const asset = correct ? this.assets?.successState : this.assets?.failState;
    const geometry = revealChoiceGeometry('magic', correct);
    item.label.node.active = false;
    item.option.active = false;
    item.chest.active = true;
    item.root.setScale(Vec3.ONE);
    item.chest.angle = 0;
    item.chest.setScale(Vec3.ONE);
    if (geometry) {
      item.chest.getComponent(UITransform)?.setContentSize(
        geometry.width,
        geometry.height,
      );
      item.chest.setPosition(0, geometry.localY, 0);
    }
    const applied = asset
      ? await spriteLoader.applyReady(item.chest, asset, 'contain')
      : false;
    await waitForVisualCommit();
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyBookState =
        correct ? 'open-glowing' : 'exploded-charred';
      document.body.dataset.magicAcademyBookAsset = asset ?? '';
      document.body.dataset.magicAcademyBookReady =
        applied ? 'true' : 'fallback';
    }
  }

  private markClassicOption(index: number, phase: string, y: number): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.classicTreasureOptionIndex = String(index);
    document.body.dataset.classicTreasureOptionPhase = phase;
    document.body.dataset.classicTreasureOptionY = y.toFixed(2);
  }

  private markDesertOption(index: number, phase: string, y: number): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.desertTreasureOptionIndex = String(index);
    document.body.dataset.desertTreasureOptionPhase = phase;
    document.body.dataset.desertTreasureOptionY = y.toFixed(2);
  }

  private markDesertSarcophagus(index: number, phase: string, y: number): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.desertTreasureSarcophagusAsset =
      this.assets?.choices?.[index] ?? '';
    document.body.dataset.desertTreasureSarcophagusIndex = String(index);
    document.body.dataset.desertTreasureSarcophagusPhase = phase;
    document.body.dataset.desertTreasureSarcophagusY = y.toFixed(2);
  }

  private applyLayout(): void {
    applyMagicBookLayout(this.items, this.sceneId, this.backgroundScaleX);
    this.classicHole.reposition(this.columns());
    this.desertHole.reposition(this.columns());
    this.dunhuangBreak.reposition(this.columns());
    this.magicAcademyBreak.reposition(this.columns());
  }
}
