import {
  Graphics, Node, Tween, tween, UIOpacity, Vec3,
} from 'cc';
import { createUiNode } from '../../../core/ui/UiFactory';
import { color } from '../../../core/ui/colors';
import {
  MAGIC_ACADEMY_FEEDBACK,
  MAGIC_ACADEMY_STONE_COLORS,
} from '../../../shared/config/MagicAcademyFeedback';

type Point = readonly [number, number];

interface FragmentVisual {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly start: Vec3;
  readonly burst: Vec3;
  readonly landing: Vec3;
}

export class MagicAcademyBreakView {
  private readonly underlayRoot: Node;
  private readonly cavity: Node;
  private readonly cavityOpacity: UIOpacity;
  private overlayRoot?: Node;
  private readonly fragments: FragmentVisual[] = [];
  private selectedIndex = -1;

  constructor(private readonly parent: Node) {
    this.underlayRoot = createUiNode(
      parent,
      'MagicAcademyBreakUnderlay',
      480,
      430,
      Vec3.ZERO,
    );
    this.cavity = createUiNode(
      this.underlayRoot,
      'MagicAcademyOpenCavity',
      MAGIC_ACADEMY_FEEDBACK.cavityWidth,
      MAGIC_ACADEMY_FEEDBACK.cavityHeight,
      new Vec3(0, MAGIC_ACADEMY_FEEDBACK.cavityCenterY),
    );
    this.drawCavity(this.cavity.addComponent(Graphics));
    this.cavityOpacity = this.cavity.addComponent(UIOpacity);
    this.underlayRoot.active = false;
  }

  mountOverlay(): void {
    if (this.overlayRoot) return;
    this.overlayRoot = createUiNode(
      this.parent,
      'MagicAcademyBreakOverlay',
      480,
      430,
      Vec3.ZERO,
    );
    for (let index = 0; index < MAGIC_ACADEMY_FEEDBACK.fragmentCount; index += 1) {
      this.fragments.push(this.createFragment(index));
    }
    this.overlayRoot.active = false;
  }

  prepare(index: number, columnX: number): void {
    this.mountOverlay();
    this.stopTweens();
    this.selectedIndex = index;
    this.repositionAt(columnX);
    this.resetVisuals();
    this.mark('cast-targeted');
  }

  breakOpen(index: number, columnX: number): Promise<void> {
    this.mountOverlay();
    if (this.selectedIndex !== index) this.prepare(index, columnX);
    this.stopTweens();
    this.repositionAt(columnX);
    this.underlayRoot.active = true;
    this.overlayRoot!.active = true;
    this.cavity.active = true;
    this.cavityOpacity.opacity = 0;
    tween(this.cavityOpacity)
      .to(0.12, { opacity: 255 }, { easing: 'quadOut' })
      .start();
    this.burstFragments();
    this.mark('top-open-rubble-falling');
    const totalMs = MAGIC_ACADEMY_FEEDBACK.breakBurstMs
      + MAGIC_ACADEMY_FEEDBACK.rubbleFallMs
      + MAGIC_ACADEMY_FEEDBACK.rubbleSettleMs;
    return this.wait(totalMs, () => this.mark('rubble-settled-at-bottom'));
  }

  async playUnlock(
    index: number,
    columnX: number,
    openBook: () => Promise<void>,
  ): Promise<void> {
    this.mountOverlay();
    if (this.selectedIndex !== index) this.prepare(index, columnX);
    this.repositionAt(columnX);
    this.overlayRoot!.active = true;
    this.mark('book-unlock-leading');
    await this.wait(MAGIC_ACADEMY_FEEDBACK.unlockLeadMs);
    await openBook();
    this.mark('book-opened-without-chain-scatter');
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
      delete document.body.dataset.magicAcademyBreakPhase;
      delete document.body.dataset.magicAcademyBreakIndex;
      delete document.body.dataset.magicAcademyBreakX;
      delete document.body.dataset.magicAcademyFragmentCount;
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
      const delaySeconds = (index % 5) * 0.016;
      const burstSeconds = 0.1 + (index % 3) * 0.018;
      const fallSeconds = 0.46 + (index % 5) * 0.032;
      const direction = index % 2 === 0 ? 1 : -1;
      node.active = true;
      node.setPosition(start);
      node.setScale(0.62, 0.62, 1);
      node.angle = -20 + ((index * 43) % 45);
      opacity.opacity = 255;
      tween(node)
        .delay(delaySeconds)
        .to(burstSeconds, {
          position: burst,
          scale: new Vec3(1.06, 1.06, 1),
          angle: node.angle + direction * (55 + (index % 4) * 18),
        }, { easing: 'quadOut' })
        .to(fallSeconds, {
          position: new Vec3(landing.x, landing.y + 6, 0),
          scale: Vec3.ONE,
          angle: node.angle + direction * (175 + (index % 5) * 30),
        }, { easing: 'quadIn' })
        .to(0.06, {
          position: new Vec3(landing.x, landing.y - 3, 0),
        }, { easing: 'quadIn' })
        .to(0.075, { position: landing }, { easing: 'quadOut' })
        .start();
    });
  }

  private createFragment(index: number): FragmentVisual {
    const large = index < 6;
    const width = (large ? 48 : 29) + ((index * 17) % (large ? 27 : 20));
    const height = (large ? 40 : 25) + ((index * 13) % (large ? 23 : 18));
    const node = createUiNode(
      this.overlayRoot!,
      `MagicAcademyStoneFragment-${index}`,
      width,
      height,
    );
    const graphics = node.addComponent(Graphics);
    const points: readonly Point[] = [
      [-width * 0.48, height * 0.08],
      [-width * 0.26, height * 0.5],
      [width * 0.25, height * 0.44],
      [width * 0.5, height * 0.06],
      [width * 0.3, -height * 0.46],
      [-width * 0.22, -height * 0.5],
      [-width * 0.5, -height * 0.14],
    ];
    fillAndStrokeShape(
      graphics,
      MAGIC_ACADEMY_STONE_COLORS[index % MAGIC_ACADEMY_STONE_COLORS.length]!,
      '#37305F',
      points,
    );
    graphics.strokeColor = color('#AAA0D5', 175);
    graphics.lineWidth = 2;
    graphics.moveTo(-width * 0.2, height * 0.3);
    graphics.lineTo(width * 0.04, height * 0.04);
    graphics.lineTo(width * 0.24, -height * 0.24);
    graphics.stroke();
    const opacity = node.addComponent(UIOpacity);
    const lane = index - (MAGIC_ACADEMY_FEEDBACK.fragmentCount - 1) / 2;
    const start = new Vec3(
      lane * 10 + Math.sin((index + 1) * 1.37) * 22,
      MAGIC_ACADEMY_FEEDBACK.impactY - (index % 4) * 8,
      0,
    );
    const burst = new Vec3(
      start.x + lane * 6 + Math.sin((index + 2) * 1.71) * 31,
      start.y - 42 - (index % 5) * 8,
      0,
    );
    const landing = new Vec3(
      -126 + index * (252 / (MAGIC_ACADEMY_FEEDBACK.fragmentCount - 1))
        + Math.sin((index + 3) * 1.49) * 10,
      MAGIC_ACADEMY_FEEDBACK.rubbleFloorY + (index % 4) * 7,
      0,
    );
    node.active = false;
    return {
      node, opacity, start, burst, landing,
    };
  }

  private drawCavity(graphics: Graphics): void {
    const width = MAGIC_ACADEMY_FEEDBACK.cavityWidth;
    const height = MAGIC_ACADEMY_FEEDBACK.cavityHeight;
    graphics.fillColor = color('#28244E', 255);
    graphics.strokeColor = color('#5D5791', 240);
    graphics.lineWidth = 8;
    graphics.roundRect(-width / 2, -height / 2, width, height, 38);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = color('#17152F', 145);
    graphics.roundRect(
      -width * 0.39,
      -height * 0.39,
      width * 0.78,
      height * 0.74,
      31,
    );
    graphics.fill();
  }

  private resetVisuals(): void {
    this.cavity.active = false;
    this.cavityOpacity.opacity = 0;
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
    Tween.stopAllByTarget(this.cavity);
    Tween.stopAllByTarget(this.cavityOpacity);
    if (this.overlayRoot) Tween.stopAllByTarget(this.overlayRoot);
    this.fragments.forEach(({ node, opacity }) => {
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
    });
  }

  private wait(durationMs: number, onDone?: () => void): Promise<void> {
    if (!this.overlayRoot) return Promise.resolve();
    return new Promise((resolve) => {
      tween(this.overlayRoot!)
        .delay(durationMs / 1000)
        .call(() => {
          onDone?.();
          resolve();
        })
        .start();
    });
  }

  private mark(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.magicAcademyBreakPhase = phase;
    document.body.dataset.magicAcademyBreakIndex = String(this.selectedIndex);
    document.body.dataset.magicAcademyBreakX =
      this.underlayRoot.position.x.toFixed(2);
    document.body.dataset.magicAcademyFragmentCount =
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
