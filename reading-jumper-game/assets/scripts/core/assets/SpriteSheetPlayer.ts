import {
  Node, Rect, Sprite, SpriteFrame, UITransform,
} from 'cc';
import { SpriteSheetAnimation } from '../../shared/types/Theme';
import { CachedFrame, fitSprite } from './SpriteAsset';
import { spriteLoader } from './SpriteLoader';

interface SheetFrames {
  readonly spec: SpriteSheetAnimation;
  readonly frames: readonly SpriteFrame[];
}

export class SpriteSheetPlayer {
  private readonly sheets = new Map<string, SheetFrames>();
  private active: SheetFrames | null = null;
  private elapsed = 0;
  private index = 0;
  private loop = true;
  private generation = 0;

  constructor(private readonly host: Node) {
    host.once(Node.EventType.NODE_DESTROYED, () => this.clear());
  }

  play(spec: SpriteSheetAnimation, loop = true): void {
    const generation = ++this.generation;
    spriteLoader.loadBound(this.host, spec.path, (cached) => {
      if (generation !== this.generation || !this.host.isValid) return;
      const sheet = this.sheets.get(spec.path) ?? this.createSheet(cached, spec);
      this.sheets.set(spec.path, sheet);
      this.active = sheet;
      this.elapsed = 0;
      this.index = 0;
      this.loop = loop;
      this.render(0);
    });
  }

  update(deltaSeconds: number): void {
    const active = this.active;
    if (!active || !this.host.activeInHierarchy || active.frames.length < 2) return;
    const frameSeconds = 1 / active.spec.fps;
    this.elapsed += Math.min(deltaSeconds, frameSeconds * 2);
    while (this.elapsed >= frameSeconds) {
      this.elapsed -= frameSeconds;
      const next = this.index + 1;
      this.index = next < active.frames.length ? next : this.loop ? 0 : this.index;
      this.render(this.index);
      if (!this.loop && next >= active.frames.length) break;
    }
  }

  clear(): void {
    this.generation += 1;
    this.active = null;
    const sprite = this.host.getChildByName('__sprite')?.getComponent(Sprite);
    if (sprite) sprite.spriteFrame = null;
    this.sheets.forEach(({ frames }) => frames.forEach((frame) => frame.destroy()));
    this.sheets.clear();
  }

  private createSheet(cached: CachedFrame, spec: SpriteSheetAnimation): SheetFrames {
    const cellWidth = spec.frameWidth + spec.padding * 2;
    const cellHeight = spec.frameHeight + spec.padding * 2;
    const frames = Array.from({ length: spec.frames }, (_, index) => {
      const frame = new SpriteFrame();
      frame.texture = cached.frame.texture;
      frame.rect = new Rect(
        index % spec.columns * cellWidth + spec.padding,
        Math.floor(index / spec.columns) * cellHeight + spec.padding,
        spec.frameWidth,
        spec.frameHeight,
      );
      return frame;
    });
    return { spec, frames };
  }

  private render(index: number): void {
    const active = this.active;
    if (!active) return;
    const image = this.host.getChildByName('__sprite') ?? this.createImage();
    const sprite = image.getComponent(Sprite) ?? image.addComponent(Sprite);
    sprite.spriteFrame = active.frames[index];
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    fitSprite(this.host, image, {
      frame: active.frames[index],
      width: active.spec.frameWidth,
      height: active.spec.frameHeight,
      lastUsed: Date.now(),
      release: () => undefined,
    }, 'contain');
  }

  private createImage(): Node {
    const image = new Node('__sprite');
    image.layer = this.host.layer;
    image.addComponent(UITransform);
    this.host.insertChild(image, 0);
    return image;
  }
}
