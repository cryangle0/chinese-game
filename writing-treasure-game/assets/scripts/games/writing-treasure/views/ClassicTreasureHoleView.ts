import {
  Graphics, Node, Tween, tween, UIOpacity, Vec3,
} from 'cc';
import { createUiNode } from '../../../core/ui/UiFactory';
import { color } from '../../../core/ui/colors';
import { CLASSIC_TREASURE_FEEDBACK } from '../../../shared/config/ClassicTreasureFeedback';

type Point = readonly [number, number];

const HOLE_WIDTH = 300;
const HOLE_HEIGHT = 112;
const HOLE_CENTER_COLOR = '#D65905';
const DIRT_LAYER_Y_OFFSET = 14;
const DIRT_CHUNK_COLORS = [
  '#D65905',
  '#EA6F18',
  '#BB4608',
  '#F18A32',
  '#C8510B',
] as const;
const DUST_COLORS = ['#F39A4A', '#E47728', '#C95612'] as const;
const OPENING_SCALES = [
  new Vec3(0.5, 0.46, 1),
  new Vec3(0.78, 0.74, 1),
  Vec3.ONE.clone(),
] as const;

interface DirtVisual {
  readonly node: Node;
  readonly opacity: UIOpacity;
}

interface DirtBurst {
  readonly chunks: readonly DirtVisual[];
  readonly dust: readonly DirtVisual[];
}

export class ClassicTreasureHoleView {
  private readonly root: Node;
  private readonly graphics: Graphics;
  private readonly dirtLayer: Node;
  private readonly dirtBursts: readonly DirtBurst[];
  private selectedIndex = -1;

  constructor(parent: Node) {
    this.root = createUiNode(
      parent,
      'ClassicTreasureSurfaceHole',
      HOLE_WIDTH,
      HOLE_HEIGHT,
      new Vec3(0, CLASSIC_TREASURE_FEEDBACK.holeSurfaceY),
    );
    this.graphics = this.root.addComponent(Graphics);
    this.dirtLayer = createUiNode(
      parent,
      'ClassicTreasureDirtLayer',
      560,
      320,
      new Vec3(
        0,
        CLASSIC_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
      ),
    );
    this.dirtBursts = Array.from(
      { length: OPENING_SCALES.length },
      (_, stage) => this.createDirtBurst(stage),
    );
    this.drawHole();
    this.hide();
  }

  play(index: number, columnX: number, impactAtMs: readonly number[]): void {
    Tween.stopAllByTarget(this.root);
    this.selectedIndex = index;
    this.root.active = true;
    this.root.setPosition(columnX, CLASSIC_TREASURE_FEEDBACK.holeSurfaceY, 0);
    this.root.setScale(0.01, 0.01, 1);
    this.root.angle = 0;
    this.resetDirtParticles();
    this.dirtLayer.active = true;
    this.dirtLayer.setPosition(
      columnX,
      CLASSIC_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
      0,
    );
    const parent = this.dirtLayer.parent;
    if (parent) this.dirtLayer.setSiblingIndex(Math.max(0, parent.children.length - 1));
    this.mark('surface-intact', 0.01);

    const impacts = impactAtMs.slice(0, OPENING_SCALES.length)
      .map((value) => Math.max(0, value));
    const sequence = tween(this.root);
    let cursorMs = 0;
    impacts.forEach((impactMs, stage) => {
      const durationMs = stage === OPENING_SCALES.length - 1 ? 160 : 140;
      sequence
        .delay(Math.max(0, impactMs - cursorMs) / 1000)
        .call(() => {
          this.mark(`surface-break-${stage + 1}`, OPENING_SCALES[stage]!.x);
          this.burstDirt(stage);
        })
        .to(durationMs / 1000, {
          scale: OPENING_SCALES[stage],
          angle: stage % 2 === 0 ? -1.2 : 1.2,
        }, { easing: 'backOut' });
      cursorMs = impactMs + durationMs;
    });
    sequence
      .to(0.08, { scale: Vec3.ONE, angle: 0 }, { easing: 'quadOut' })
      .call(() => this.mark('surface-open', 1))
      .start();
  }

  reposition(columns: readonly number[]): void {
    if (this.selectedIndex < 0) return;
    this.root.setPosition(
      columns[this.selectedIndex] ?? 0,
      CLASSIC_TREASURE_FEEDBACK.holeSurfaceY,
      0,
    );
    this.dirtLayer.setPosition(
      columns[this.selectedIndex] ?? 0,
      CLASSIC_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
      0,
    );
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    this.selectedIndex = -1;
    this.root.active = false;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.resetDirtParticles();
    this.dirtLayer.active = false;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.classicTreasureHolePhase;
      delete document.body.dataset.classicTreasureHoleIndex;
      delete document.body.dataset.classicTreasureHoleX;
      delete document.body.dataset.classicTreasureHoleScale;
      delete document.body.dataset.classicTreasureDirtBurst;
      delete document.body.dataset.classicTreasureDirtParticleCount;
    }
  }

  private drawHole(): void {
    const graphics = this.graphics;
    graphics.clear();
    fillShape(graphics, '#9E3A0A', [
      [-146, -4], [-132, 18], [-98, 31], [-58, 29], [-20, 39],
      [22, 34], [62, 39], [102, 28], [137, 15], [147, -7],
      [128, -32], [94, -45], [50, -45], [7, -55], [-39, -47],
      [-84, -50], [-124, -35],
    ]);
    fillShape(graphics, '#B94A08', [
      [-129, 1], [-108, 20], [-72, 24], [-34, 31], [4, 27],
      [43, 31], [82, 24], [115, 14], [130, -4], [112, -27],
      [76, -37], [35, -38], [-5, -45], [-49, -38], [-89, -39],
      [-119, -24],
    ]);
    fillShape(graphics, HOLE_CENTER_COLOR, [
      [-108, 0], [-87, 14], [-54, 17], [-20, 23], [13, 20],
      [48, 22], [81, 16], [105, 6], [108, -10], [88, -25],
      [50, -31], [10, -34], [-31, -31], [-70, -28], [-99, -17],
    ]);
    fillShape(graphics, '#E96B18', [
      [-138, -19], [-109, -32], [-76, -35], [-40, -47], [-4, -43],
      [33, -51], [69, -40], [105, -39], [136, -21], [113, -46],
      [77, -55], [39, -58], [0, -65], [-42, -58], [-82, -58],
      [-119, -45],
    ]);
    fillShape(graphics, '#F49A42', [
      [-112, -35], [-83, -41], [-58, -49], [-79, -51], [-104, -46],
    ]);
    fillShape(graphics, '#F49A42', [
      [72, -47], [103, -39], [92, -50],
    ]);
    strokeCrack(graphics, [-142, 1], [-164, 10], [-177, 2]);
    strokeCrack(graphics, [137, 3], [160, 13], [176, 5]);
    strokeCrack(graphics, [-103, 25], [-112, 44], [-128, 50]);
    strokeCrack(graphics, [97, 24], [108, 44], [123, 49]);
  }

  private createDirtBurst(stage: number): DirtBurst {
    return {
      chunks: Array.from(
        { length: CLASSIC_TREASURE_FEEDBACK.dirtChunksPerImpact },
        (_, index) => this.createDirtChunk(stage, index),
      ),
      dust: Array.from(
        { length: CLASSIC_TREASURE_FEEDBACK.dirtDustPuffsPerImpact },
        (_, index) => this.createDustPuff(stage, index),
      ),
    };
  }

  private createDirtChunk(stage: number, index: number): DirtVisual {
    const width = 10 + ((index * 5 + stage * 3) % 11);
    const height = 8 + ((index * 7 + stage * 5) % 9);
    const node = createUiNode(
      this.dirtLayer,
      `ClassicTreasureDirtChunk-${stage}-${index}`,
      width,
      height,
    );
    const graphics = node.addComponent(Graphics);
    fillShape(
      graphics,
      DIRT_CHUNK_COLORS[(index + stage * 2) % DIRT_CHUNK_COLORS.length]!,
      [
        [-width * 0.5, -height * 0.08],
        [-width * 0.26, height * 0.5],
        [width * 0.24, height * 0.42],
        [width * 0.5, 0],
        [width * 0.2, -height * 0.48],
        [-width * 0.32, -height * 0.42],
      ],
    );
    const opacity = node.addComponent(UIOpacity);
    node.active = false;
    return { node, opacity };
  }

  private createDustPuff(stage: number, index: number): DirtVisual {
    const size = 30 + ((index * 7 + stage * 5) % 18);
    const node = createUiNode(
      this.dirtLayer,
      `ClassicTreasureDust-${stage}-${index}`,
      size,
      size,
    );
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color(
      DUST_COLORS[(index + stage) % DUST_COLORS.length]!,
      190,
    );
    graphics.circle(-size * 0.17, -size * 0.02, size * 0.27);
    graphics.circle(size * 0.12, size * 0.08, size * 0.33);
    graphics.circle(size * 0.29, -size * 0.08, size * 0.22);
    graphics.fill();
    const opacity = node.addComponent(UIOpacity);
    node.active = false;
    return { node, opacity };
  }

  private burstDirt(stage: number): void {
    const burst = this.dirtBursts[stage];
    if (!burst) return;
    const chunkHalf = Math.max(1, (burst.chunks.length - 1) / 2);
    burst.chunks.forEach(({ node, opacity }, index) => {
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
      const spread = (index - chunkHalf) / chunkHalf;
      const jitter = Math.sin((index + 1) * (stage + 2) * 1.73) * 28;
      const targetX = spread * 225 + jitter;
      const apexY = 92 + ((index * 41 + stage * 29) % 92);
      const endY = -20 - ((index * 13) % 22);
      const launchSeconds = 0.18 + (index % 4) * 0.012;
      const fallSeconds = 0.34 + (index % 5) * 0.018;
      node.active = true;
      node.setPosition(spread * 34, 8 + stage * 2, 0);
      node.setScale(0.42, 0.42, 1);
      node.angle = -22 + ((index * 31) % 44);
      opacity.opacity = 255;
      tween(node)
        .to(launchSeconds, {
          position: new Vec3(targetX * 0.58, apexY, 0),
          scale: new Vec3(1.12, 1.12, 1),
          angle: node.angle + (spread >= 0 ? -95 : 95),
        }, { easing: 'quadOut' })
        .to(fallSeconds, {
          position: new Vec3(targetX, endY, 0),
          scale: new Vec3(0.38, 0.38, 1),
          angle: node.angle + (spread >= 0 ? -210 : 210),
        }, { easing: 'quadIn' })
        .call(() => { node.active = false; })
        .start();
      tween(opacity)
        .delay(launchSeconds + fallSeconds * 0.32)
        .to(fallSeconds * 0.68, { opacity: 0 })
        .start();
    });

    const dustHalf = Math.max(1, (burst.dust.length - 1) / 2);
    burst.dust.forEach(({ node, opacity }, index) => {
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
      const spread = (index - dustHalf) / dustHalf;
      const targetX = spread * 185
        + Math.sin((index + 1) * (stage + 3) * 1.21) * 24;
      const targetY = 52 + ((index * 29 + stage * 17) % 62);
      const durationSeconds = 0.42 + (index % 4) * 0.035;
      node.active = true;
      node.setPosition(spread * 22, 4, 0);
      node.setScale(0.4, 0.4, 1);
      node.angle = 0;
      opacity.opacity = 210;
      tween(node)
        .to(durationSeconds, {
          position: new Vec3(targetX, targetY, 0),
          scale: new Vec3(1.8 + (index % 3) * 0.35, 1.8 + (index % 3) * 0.35, 1),
          angle: spread * 24,
        }, { easing: 'quadOut' })
        .call(() => { node.active = false; })
        .start();
      tween(opacity)
        .delay(0.06)
        .to(durationSeconds - 0.06, { opacity: 0 })
        .start();
    });

    if (typeof document !== 'undefined') {
      document.body.dataset.classicTreasureDirtBurst = String(stage + 1);
      document.body.dataset.classicTreasureDirtParticleCount = String(
        burst.chunks.length + burst.dust.length,
      );
    }
  }

  private resetDirtParticles(): void {
    this.dirtBursts.forEach((burst) => {
      [...burst.chunks, ...burst.dust].forEach(({ node, opacity }) => {
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        node.active = false;
        node.setPosition(Vec3.ZERO);
        node.setScale(Vec3.ONE);
        node.angle = 0;
        opacity.opacity = 0;
      });
    });
  }

  private mark(phase: string, scale: number): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.classicTreasureHolePhase = phase;
    document.body.dataset.classicTreasureHoleIndex = String(this.selectedIndex);
    document.body.dataset.classicTreasureHoleX = this.root.position.x.toFixed(2);
    document.body.dataset.classicTreasureHoleScale = scale.toFixed(2);
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

function strokeCrack(
  graphics: Graphics,
  start: Point,
  middle: Point,
  end: Point,
): void {
  graphics.strokeColor = color('#A63E08');
  graphics.lineWidth = 5;
  graphics.moveTo(start[0], start[1]);
  graphics.lineTo(middle[0], middle[1]);
  graphics.lineTo(end[0], end[1]);
  graphics.stroke();
}
