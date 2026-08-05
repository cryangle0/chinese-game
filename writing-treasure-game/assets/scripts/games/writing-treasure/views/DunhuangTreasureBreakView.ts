import {
  Graphics, Node, Tween, tween, UIOpacity, Vec3,
} from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { createUiNode } from '../../../core/ui/UiFactory';
import { color } from '../../../core/ui/colors';
import {
  DUNHUANG_STONE_COLORS,
  DUNHUANG_TREASURE_FEEDBACK,
} from '../../../shared/config/DunhuangTreasureFeedback';

type Point = readonly [number, number];

interface FragmentVisual {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly start: Vec3;
  readonly burst: Vec3;
  readonly landing: Vec3;
}

export class DunhuangTreasureBreakView {
  private readonly underlayRoot: Node;
  private readonly openTopPatch: Node;
  private readonly openTopOpacity: UIOpacity;
  private overlayRoot?: Node;
  private readonly fragments: FragmentVisual[] = [];
  private selectedIndex = -1;

  constructor(private readonly parent: Node) {
    this.underlayRoot = createUiNode(
      parent,
      'DunhuangTreasureBreakUnderlay',
      520,
      460,
      Vec3.ZERO,
    );
    this.openTopPatch = createUiNode(
      this.underlayRoot,
      'DunhuangTreasureOpenTopPatch',
      400,
      130,
      new Vec3(12, -10),
    );
    this.openTopOpacity = this.openTopPatch.addComponent(UIOpacity);
    this.underlayRoot.active = false;
  }

  setOpenTopAsset(path: string): void {
    if (path) spriteLoader.apply(this.openTopPatch, path, 'contain');
  }

  mountOverlay(): void {
    if (this.overlayRoot) return;
    this.overlayRoot = createUiNode(
      this.parent,
      'DunhuangTreasureBreakOverlay',
      520,
      460,
      Vec3.ZERO,
    );
    for (let index = 0; index < DUNHUANG_TREASURE_FEEDBACK.fragmentCount; index += 1) {
      this.fragments.push(this.createFragment(index));
    }
    this.overlayRoot.active = false;
  }

  prepare(
    index: number,
    columnX: number,
    _impactAtMs: readonly number[],
  ): void {
    this.mountOverlay();
    this.stopTweens();
    this.selectedIndex = index;
    this.underlayRoot.active = true;
    this.overlayRoot!.active = true;
    this.repositionAt(columnX);
    this.resetVisuals();
    this.mark('cast-targeted-no-top-effect');
  }

  breakOpen(index: number, columnX: number): Promise<void> {
    this.mountOverlay();
    if (this.selectedIndex !== index || !this.overlayRoot?.active) {
      this.prepare(index, columnX, []);
    }
    Tween.stopAllByTarget(this.overlayRoot!);
    this.repositionAt(columnX);
    this.openTopPatch.active = true;
    this.openTopOpacity.opacity = 0;
    tween(this.openTopOpacity)
      .to(0.1, { opacity: 255 })
      .start();
    this.burstFragments();
    this.mark('wall-open-rubble-falling');

    const totalMs = DUNHUANG_TREASURE_FEEDBACK.breakBurstMs
      + DUNHUANG_TREASURE_FEEDBACK.rubbleFallMs
      + DUNHUANG_TREASURE_FEEDBACK.rubbleSettleMs;
    return new Promise((resolve) => {
      tween(this.overlayRoot!)
        .delay(totalMs / 1000)
        .call(() => {
          this.mark('rubble-settled-at-bottom');
          resolve();
        })
        .start();
    });
  }

  openWrongCavity(index: number, columnX: number): Promise<void> {
    this.mountOverlay();
    if (this.selectedIndex !== index || !this.overlayRoot?.active) {
      this.prepare(index, columnX, []);
    }
    this.stopTweens();
    this.repositionAt(columnX);
    this.resetVisuals();
    this.underlayRoot.active = true;
    this.overlayRoot!.active = true;
    this.openTopPatch.active = true;
    this.openTopOpacity.opacity = 0;
    this.mark('wrong-cavity-opening');
    return new Promise((resolve) => {
      tween(this.openTopOpacity)
        .to(DUNHUANG_TREASURE_FEEDBACK.wrongCavityOpenMs / 1000, {
          opacity: 255,
        }, { easing: 'quadOut' })
        .call(() => {
          this.mark('wrong-cavity-open');
          resolve();
        })
        .start();
    });
  }

  reposition(columns: readonly number[]): void {
    if (this.selectedIndex < 0) return;
    this.repositionAt(columns[this.selectedIndex] ?? 0);
  }

  hide(): void {
    this.stopTweens();
    this.selectedIndex = -1;
    this.underlayRoot.active = false;
    if (this.overlayRoot) this.overlayRoot.active = false;
    this.resetVisuals();
    if (typeof document !== 'undefined') {
      delete document.body.dataset.dunhuangTreasureBreakPhase;
      delete document.body.dataset.dunhuangTreasureBreakIndex;
      delete document.body.dataset.dunhuangTreasureBreakX;
      delete document.body.dataset.dunhuangTreasureFragmentCount;
    }
  }

  private repositionAt(columnX: number): void {
    this.underlayRoot.setPosition(columnX, 0, 0);
    this.overlayRoot?.setPosition(columnX, 0, 0);
  }

  private burstFragments(): void {
    this.fragments.forEach((fragment, index) => {
      const {
        node, opacity, start, burst, landing,
      } = fragment;
      const delaySeconds = (index % 4) * 0.018;
      const burstSeconds = 0.11 + (index % 3) * 0.018;
      const fallSeconds = 0.47 + (index % 5) * 0.034;
      const direction = index % 2 === 0 ? 1 : -1;
      node.active = true;
      node.setPosition(start);
      node.setScale(0.58, 0.58, 1);
      node.angle = -18 + ((index * 47) % 42);
      opacity.opacity = 255;
      tween(node)
        .delay(delaySeconds)
        .to(burstSeconds, {
          position: burst,
          scale: new Vec3(1.08, 1.08, 1),
          angle: node.angle + direction * (64 + (index % 4) * 22),
        }, { easing: 'quadOut' })
        .to(fallSeconds, {
          position: new Vec3(landing.x, landing.y + 7, 0),
          scale: Vec3.ONE,
          angle: node.angle + direction * (185 + (index % 5) * 34),
        }, { easing: 'quadIn' })
        .to(0.055, {
          position: new Vec3(landing.x, landing.y - 3, 0),
        }, { easing: 'quadIn' })
        .to(0.075, {
          position: landing,
        }, { easing: 'quadOut' })
        .start();
    });
  }

  private createFragment(index: number): FragmentVisual {
    const large = index < 5;
    const width = (large ? 52 : 31) + ((index * 17) % (large ? 25 : 24));
    const height = (large ? 43 : 27) + ((index * 13) % (large ? 23 : 19));
    const node = createUiNode(
      this.overlayRoot!,
      `DunhuangTreasureStoneFragment-${index}`,
      width,
      height,
    );
    const graphics = node.addComponent(Graphics);
    const points: readonly Point[] = [
      [-width * 0.48, height * 0.08],
      [-width * 0.28, height * 0.5],
      [width * 0.22, height * 0.44],
      [width * 0.5, height * 0.08],
      [width * 0.32, -height * 0.45],
      [-width * 0.2, -height * 0.5],
      [-width * 0.5, -height * 0.16],
    ];
    fillAndStrokeShape(
      graphics,
      DUNHUANG_STONE_COLORS[index % DUNHUANG_STONE_COLORS.length]!,
      '#A85B26',
      points,
    );
    graphics.strokeColor = color('#C57432', 185);
    graphics.lineWidth = 2;
    graphics.moveTo(-width * 0.2, height * 0.3);
    graphics.lineTo(width * 0.04, height * 0.04);
    graphics.lineTo(width * 0.25, -height * 0.24);
    graphics.stroke();
    const opacity = node.addComponent(UIOpacity);
    const lane = index - (DUNHUANG_TREASURE_FEEDBACK.fragmentCount - 1) / 2;
    const start = new Vec3(
      lane * 10 + Math.sin((index + 1) * 1.37) * 24,
      DUNHUANG_TREASURE_FEEDBACK.impactY - 8 - (index % 4) * 9,
      0,
    );
    const burst = new Vec3(
      start.x + lane * 7 + Math.sin((index + 2) * 1.71) * 34,
      start.y
        - DUNHUANG_TREASURE_FEEDBACK.rubbleFirstDropY
        - (index % 5) * 9,
      0,
    );
    const landing = new Vec3(
      -132 + index * (264 / (DUNHUANG_TREASURE_FEEDBACK.fragmentCount - 1))
        + Math.sin((index + 3) * 1.49) * 11,
      DUNHUANG_TREASURE_FEEDBACK.rubbleFloorY + (index % 4) * 7,
      0,
    );
    node.active = false;
    return {
      node, opacity, start, burst, landing,
    };
  }

  private resetVisuals(): void {
    this.openTopPatch.active = false;
    this.openTopOpacity.opacity = 0;
    this.fragments.forEach(({ node, opacity }) => {
      node.active = false;
      node.setPosition(Vec3.ZERO);
      node.setScale(Vec3.ONE);
      node.angle = 0;
      opacity.opacity = 0;
    });
  }

  private stopTweens(): void {
    Tween.stopAllByTarget(this.underlayRoot);
    Tween.stopAllByTarget(this.openTopPatch);
    Tween.stopAllByTarget(this.openTopOpacity);
    if (this.overlayRoot) Tween.stopAllByTarget(this.overlayRoot);
    this.fragments.forEach(({ node, opacity }) => {
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
    });
  }

  private mark(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.dunhuangTreasureBreakPhase = phase;
    document.body.dataset.dunhuangTreasureBreakIndex = String(this.selectedIndex);
    document.body.dataset.dunhuangTreasureBreakX =
      this.underlayRoot.position.x.toFixed(2);
    document.body.dataset.dunhuangTreasureFragmentCount =
      String(this.fragments.length);
  }
}

function fillShape(graphics: Graphics, fill: string, points: readonly Point[]): void {
  const first = points[0];
  if (!first) return;
  graphics.fillColor = color(fill);
  graphics.moveTo(first[0], first[1]);
  points.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
  graphics.close();
  graphics.fill();
}

function fillAndStrokeShape(
  graphics: Graphics,
  fill: string,
  stroke: string,
  points: readonly Point[],
): void {
  fillShape(graphics, fill, points);
  const first = points[0];
  if (!first) return;
  graphics.strokeColor = color(stroke);
  graphics.lineWidth = 3;
  graphics.moveTo(first[0], first[1]);
  points.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
  graphics.close();
  graphics.stroke();
}
