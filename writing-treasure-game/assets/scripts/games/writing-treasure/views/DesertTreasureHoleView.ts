import {
  Graphics, Node, Tween, tween, UIOpacity, UITransform, Vec3,
} from 'cc';
import { createUiNode } from '../../../core/ui/UiFactory';
import { color } from '../../../core/ui/colors';
import { DESERT_TREASURE_FEEDBACK } from '../../../shared/config/DesertTreasureFeedback';

type Point = readonly [number, number];

const HOLE_WIDTH = 310;
const HOLE_HEIGHT = 108;
const CAVITY_WIDTH = 310;
const CAVITY_HEIGHT = 330;
const CAVITY_TOP_Y = DESERT_TREASURE_FEEDBACK.holeSurfaceY + 10;
const CAVITY_BOTTOM_Y = -338;
const CAVITY_CENTER_Y = (CAVITY_TOP_Y + CAVITY_BOTTOM_Y) / 2;
const DIRT_LAYER_Y_OFFSET = 12;
const OPENING_SCALES = [
  new Vec3(0.46, 0.42, 1),
  new Vec3(0.76, 0.72, 1),
  Vec3.ONE.clone(),
] as const;
const DIRT_COLORS = [
  '#F5B84F',
  '#E99A34',
  '#D77C22',
  '#F8C966',
  '#C96B1D',
] as const;
const DUST_COLORS = ['#F7C66B', '#EFA94A', '#DC8730'] as const;

interface DirtVisual {
  readonly node: Node;
  readonly opacity: UIOpacity;
}

interface DirtBurst {
  readonly chunks: readonly DirtVisual[];
  readonly dust: readonly DirtVisual[];
}

export class DesertTreasureHoleView {
  private readonly root: Node;
  private readonly graphics: Graphics;
  private readonly dirtLayer: Node;
  private readonly dirtBursts: readonly DirtBurst[];
  private selectedIndex = -1;
  private cavityOpen = false;

  constructor(parent: Node) {
    this.root = createUiNode(
      parent,
      'DesertTreasureSurfaceHole',
      HOLE_WIDTH,
      HOLE_HEIGHT,
      new Vec3(0, DESERT_TREASURE_FEEDBACK.holeSurfaceY),
    );
    this.graphics = this.root.addComponent(Graphics);
    this.dirtLayer = createUiNode(
      parent,
      'DesertTreasureDirtLayer',
      520,
      280,
      new Vec3(
        0,
        DESERT_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
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
    this.cavityOpen = false;
    this.root.getComponent(UITransform)?.setContentSize(HOLE_WIDTH, HOLE_HEIGHT);
    this.drawHole();
    this.root.active = true;
    this.root.setPosition(columnX, DESERT_TREASURE_FEEDBACK.holeSurfaceY, 0);
    this.root.setScale(0.01, 0.01, 1);
    this.root.angle = 0;
    this.resetDirtParticles();
    this.dirtLayer.active = true;
    this.dirtLayer.setPosition(
      columnX,
      DESERT_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
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
      const durationMs = stage === OPENING_SCALES.length - 1 ? 60 : 100;
      sequence
        .delay(Math.max(0, impactMs - cursorMs) / 1000)
        .call(() => {
          this.mark(`surface-break-${stage + 1}`, OPENING_SCALES[stage]!.x);
          this.burstDirt(stage);
        })
        .to(durationMs / 1000, {
          scale: OPENING_SCALES[stage],
          angle: stage % 2 === 0 ? -1 : 1,
        }, { easing: 'backOut' });
      cursorMs = impactMs + durationMs;
    });
    sequence
      .to(0.02, { scale: Vec3.ONE, angle: 0 }, { easing: 'quadOut' })
      .call(() => this.mark('surface-open', 1))
      .start();
  }

  showCavity(index: number, columnX: number): void {
    Tween.stopAllByTarget(this.root);
    this.selectedIndex = index;
    this.cavityOpen = true;
    this.root.getComponent(UITransform)?.setContentSize(CAVITY_WIDTH, CAVITY_HEIGHT);
    this.root.active = true;
    this.root.setPosition(columnX, CAVITY_CENTER_Y, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.resetDirtParticles();
    this.dirtLayer.active = false;
    this.drawCavity();
    this.mark('cavity-open', 1);
  }

  reposition(columns: readonly number[]): void {
    if (this.selectedIndex < 0) return;
    const x = columns[this.selectedIndex] ?? 0;
    this.root.setPosition(
      x,
      this.cavityOpen ? CAVITY_CENTER_Y : DESERT_TREASURE_FEEDBACK.holeSurfaceY,
      0,
    );
    this.dirtLayer.setPosition(
      x,
      DESERT_TREASURE_FEEDBACK.holeSurfaceY + DIRT_LAYER_Y_OFFSET,
      0,
    );
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    this.selectedIndex = -1;
    this.cavityOpen = false;
    this.root.active = false;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.resetDirtParticles();
    this.dirtLayer.active = false;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.desertTreasureHolePhase;
      delete document.body.dataset.desertTreasureHoleIndex;
      delete document.body.dataset.desertTreasureHoleX;
      delete document.body.dataset.desertTreasureHoleY;
      delete document.body.dataset.desertTreasureHoleScale;
      delete document.body.dataset.desertTreasureDirtBurst;
      delete document.body.dataset.desertTreasureDirtParticleCount;
    }
  }

  private drawHole(): void {
    const graphics = this.graphics;
    graphics.clear();
    fillShape(graphics, '#D78028', [
      [-151, -4], [-135, 18], [-101, 31], [-61, 34], [-24, 39],
      [18, 37], [60, 39], [104, 30], [139, 17], [152, -5],
      [135, -31], [98, -44], [55, -47], [13, -53], [-31, -49],
      [-78, -49], [-121, -36],
    ]);
    fillShape(graphics, '#A7581D', [
      [-132, -1], [-112, 18], [-79, 25], [-41, 29], [-2, 32],
      [37, 30], [76, 25], [112, 15], [132, -3], [112, -26],
      [78, -37], [39, -40], [-4, -44], [-48, -40], [-88, -38],
      [-119, -25],
    ]);
    fillShape(graphics, '#713716', [
      [-110, 0], [-91, 14], [-59, 20], [-22, 23], [14, 22],
      [50, 21], [83, 15], [106, 5], [109, -10], [89, -24],
      [54, -31], [12, -34], [-30, -32], [-70, -28], [-101, -17],
    ]);
    fillShape(graphics, '#E99B39', [
      [-141, -19], [-112, -33], [-79, -38], [-41, -48], [-5, -45],
      [34, -51], [71, -42], [108, -38], [141, -20], [118, -45],
      [80, -55], [40, -59], [0, -64], [-43, -59], [-84, -56],
      [-122, -44],
    ]);
    fillShape(graphics, '#F6C46B', [
      [-116, -34], [-88, -42], [-59, -49], [-82, -51], [-108, -45],
    ]);
    fillShape(graphics, '#F6C46B', [
      [70, -48], [104, -39], [91, -51],
    ]);
    strokeCrack(graphics, [-144, 2], [-166, 11], [-180, 4]);
    strokeCrack(graphics, [140, 3], [163, 12], [179, 4]);
    strokeCrack(graphics, [-104, 26], [-114, 44], [-130, 50]);
    strokeCrack(graphics, [98, 25], [110, 43], [126, 49]);
  }

  private drawCavity(): void {
    const graphics = this.graphics;
    graphics.clear();
    fillShape(graphics, '#D98632', [
      [-155, 142], [-143, 158], [-118, 165], [-76, 162],
      [-34, 166], [12, 163], [58, 165], [108, 158], [145, 145],
      [155, 128], [153, -138], [140, -158], [101, -165],
      [48, -162], [0, -166], [-48, -163], [-101, -165],
      [-140, -157], [-154, -137],
    ]);
    fillShape(graphics, '#8B451A', [
      [-137, 132], [-126, 145], [-92, 151], [-47, 148],
      [-3, 152], [45, 149], [91, 151], [126, 143], [137, 129],
      [136, -128], [124, -143], [83, -150], [38, -147],
      [-7, -151], [-54, -148], [-99, -150], [-126, -142],
      [-137, -127],
    ]);
    fillShape(graphics, '#A95B22', [
      [-117, 118], [-106, 130], [-72, 135], [-31, 132],
      [8, 136], [50, 133], [91, 134], [116, 124],
      [117, -112], [101, -126], [63, -131], [19, -128],
      [-25, -132], [-69, -129], [-105, -124], [-117, -109],
    ]);
    fillShape(graphics, '#713512', [
      [-137, 126], [-117, 117], [-117, -109], [-105, -124],
      [-126, -142], [-137, -127],
    ]);
    fillShape(graphics, '#7C3B15', [
      [137, 127], [117, 118], [117, -111], [101, -126],
      [124, -143], [136, -128],
    ]);
    fillShape(graphics, '#6F3312', [
      [-117, 118], [-106, 130], [-72, 135], [-31, 132],
      [8, 136], [50, 133], [91, 134], [116, 124],
      [105, 105], [68, 111], [24, 108], [-21, 111],
      [-65, 108], [-101, 105],
    ]);
    graphics.fillColor = color('#D58A3B');
    graphics.moveTo(-117, -91);
    graphics.bezierCurveTo(-92, -118, -56, -127, -8, -128);
    graphics.bezierCurveTo(40, -128, 83, -119, 117, -91);
    graphics.lineTo(117, -111);
    graphics.bezierCurveTo(84, -139, 42, -147, -7, -150);
    graphics.bezierCurveTo(-56, -148, -95, -139, -117, -109);
    graphics.close();
    graphics.fill();
    fillShape(graphics, '#E4A14A', [
      [-154, 139], [-143, 158], [-118, 165], [-76, 162],
      [-34, 166], [12, 163], [58, 165], [108, 158], [145, 145],
      [135, 132], [101, 142], [58, 147], [12, 145],
      [-34, 148], [-76, 145], [-116, 149], [-137, 132],
    ]);
  }

  private createDirtBurst(stage: number): DirtBurst {
    return {
      chunks: Array.from(
        { length: DESERT_TREASURE_FEEDBACK.dirtChunksPerImpact },
        (_, index) => this.createDirtChunk(stage, index),
      ),
      dust: Array.from(
        { length: DESERT_TREASURE_FEEDBACK.dirtDustPuffsPerImpact },
        (_, index) => this.createDustPuff(stage, index),
      ),
    };
  }

  private createDirtChunk(stage: number, index: number): DirtVisual {
    const width = 10 + ((index * 5 + stage * 3) % 10);
    const height = 8 + ((index * 7 + stage * 5) % 8);
    const node = createUiNode(
      this.dirtLayer,
      `DesertTreasureDirtChunk-${stage}-${index}`,
      width,
      height,
    );
    const graphics = node.addComponent(Graphics);
    fillShape(
      graphics,
      DIRT_COLORS[(index + stage * 2) % DIRT_COLORS.length]!,
      [
        [-width * 0.5, -height * 0.08],
        [-width * 0.24, height * 0.5],
        [width * 0.26, height * 0.42],
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
    const size = 28 + ((index * 7 + stage * 5) % 16);
    const node = createUiNode(
      this.dirtLayer,
      `DesertTreasureDust-${stage}-${index}`,
      size,
      size,
    );
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color(
      DUST_COLORS[(index + stage) % DUST_COLORS.length]!,
      188,
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
      const jitter = Math.sin((index + 1) * (stage + 2) * 1.67) * 24;
      const targetX = spread * 205 + jitter;
      const apexY = 82 + ((index * 37 + stage * 31) % 78);
      const endY = -18 - ((index * 13) % 20);
      const launchSeconds = 0.17 + (index % 4) * 0.012;
      const fallSeconds = 0.31 + (index % 5) * 0.018;
      node.active = true;
      node.setPosition(spread * 30, 7 + stage * 2, 0);
      node.setScale(0.42, 0.42, 1);
      node.angle = -20 + ((index * 29) % 40);
      opacity.opacity = 255;
      tween(node)
        .to(launchSeconds, {
          position: new Vec3(targetX * 0.58, apexY, 0),
          scale: new Vec3(1.08, 1.08, 1),
          angle: node.angle + (spread >= 0 ? -90 : 90),
        }, { easing: 'quadOut' })
        .to(fallSeconds, {
          position: new Vec3(targetX, endY, 0),
          scale: new Vec3(0.38, 0.38, 1),
          angle: node.angle + (spread >= 0 ? -195 : 195),
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
      const targetX = spread * 168
        + Math.sin((index + 1) * (stage + 3) * 1.19) * 20;
      const targetY = 46 + ((index * 27 + stage * 17) % 55);
      const durationSeconds = 0.38 + (index % 4) * 0.035;
      node.active = true;
      node.setPosition(spread * 20, 4, 0);
      node.setScale(0.4, 0.4, 1);
      node.angle = 0;
      opacity.opacity = 205;
      tween(node)
        .to(durationSeconds, {
          position: new Vec3(targetX, targetY, 0),
          scale: new Vec3(1.65 + (index % 3) * 0.3, 1.65 + (index % 3) * 0.3, 1),
          angle: spread * 22,
        }, { easing: 'quadOut' })
        .call(() => { node.active = false; })
        .start();
      tween(opacity)
        .delay(0.05)
        .to(durationSeconds - 0.05, { opacity: 0 })
        .start();
    });

    if (typeof document !== 'undefined') {
      document.body.dataset.desertTreasureDirtBurst = String(stage + 1);
      document.body.dataset.desertTreasureDirtParticleCount = String(
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
    document.body.dataset.desertTreasureHolePhase = phase;
    document.body.dataset.desertTreasureHoleIndex = String(this.selectedIndex);
    document.body.dataset.desertTreasureHoleX = this.root.position.x.toFixed(2);
    document.body.dataset.desertTreasureHoleY = this.root.position.y.toFixed(2);
    document.body.dataset.desertTreasureHoleScale = scale.toFixed(2);
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
  graphics.strokeColor = color('#B76621');
  graphics.lineWidth = 4;
  graphics.moveTo(start[0], start[1]);
  graphics.lineTo(middle[0], middle[1]);
  graphics.lineTo(end[0], end[1]);
  graphics.stroke();
}
