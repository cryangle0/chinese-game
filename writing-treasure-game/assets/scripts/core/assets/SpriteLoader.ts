import {
  assetManager, ImageAsset, Node, Rect, Sprite, SpriteFrame, Texture2D, UITransform,
} from 'cc';
import { RetentionPolicy } from './RetentionPolicy';
import {
  CachedFrame, createCachedFrame, fitSprite, FitMode,
} from './SpriteAsset';
import { SpriteBindings } from './SpriteBindings';
import { ThemeBundleLoader, TextureLoadResult as LoadResult } from './ThemeBundleLoader';

export class SpriteLoader {
  private readonly frames = new Map<string, CachedFrame>();
  private readonly pending = new Map<string, LoadResult[]>();
  private readonly requestedPaths = new WeakMap<Node, string>();
  private readonly reportedErrors = new Set<string>();
  private readonly themeBundles = new ThemeBundleLoader();
  private readonly retention = new RetentionPolicy();
  private readonly bindings = new SpriteBindings(() => this.trim());
  constructor(private readonly maxFrames = 64) {}
  apply(node: Node, path: string, mode: FitMode = 'contain'): void {
    if (!path) return;
    this.request(node, path, mode, (done) => {
      this.themeBundles.loadTexture(path, done);
    });
  }

  applyRemote(node: Node, url: string, mode: FitMode = 'contain'): void {
    if (!url) return;
    const key = `remote:${url}`;
    this.request(node, key, mode, (done) => {
      if (!/^https?:\/\//i.test(url)) {
        done(new Error('remote image URL must use HTTP(S)'));
        return;
      }
      assetManager.loadRemote<ImageAsset>(url, (error, image) => {
        if (error || !image) {
          done(error ? new Error(error.message) : new Error('empty remote image'));
          return;
        }
        const texture = new Texture2D();
        texture.image = image;
        done(null, texture, true);
      });
    });
  }

  applyEdgeStretch(node: Node, path: string, edge: 'left' | 'right'): void {
    if (!path) return;
    this.requestedPaths.set(node, path);
    this.load(path, (done) => {
      this.themeBundles.loadTexture(path, done);
    }, (cached) => {
      if (!cached || !node.isValid || this.requestedPaths.get(node) !== path) return;
      this.bindings.bind(node, path);
      cached.lastUsed = Date.now();
      const image = node.getChildByName('__sprite') ?? this.createImageNode(node);
      const sprite = image.getComponent(Sprite) ?? image.addComponent(Sprite);
      const frame = new SpriteFrame();
      const stripWidth = Math.min(24, cached.width);
      frame.texture = cached.frame.texture;
      frame.rect = new Rect(
        edge === 'left' ? 0 : cached.width - stripWidth,
        0,
        stripWidth,
        cached.height,
      );
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      image.setScale(-1, 1, 1);
      const target = node.getComponent(UITransform)?.contentSize;
      if (target) image.getComponent(UITransform)?.setContentSize(target);
      node.once(Node.EventType.NODE_DESTROYED, () => frame.destroy());
    });
  }

  preload(paths: readonly string[], strict = false): Promise<void> {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    return Promise.all(unique.map((path) => new Promise<void>((resolve, reject) => {
      this.load(path, (done) => {
        this.themeBundles.loadTexture(path, done);
      }, (cached) => {
        if (cached || !strict) resolve();
        else reject(new Error(`required sprite unavailable: ${path}`));
      });
    }))).then(() => undefined);
  }

  retainOnly(paths: readonly string[]): void {
    this.retention.retainOnly(paths);
    this.themeBundles.retainOnly(paths);
    this.trim();
  }

  stats(): Readonly<{ cached: number; pending: number }> {
    return { cached: this.frames.size, pending: this.pending.size };
  }

  private request(node: Node, key: string, mode: FitMode, source: (done: LoadResult) => void): void {
    this.requestedPaths.set(node, key);
    this.load(key, source, (cached) => {
      if (cached && node.isValid && this.requestedPaths.get(node) === key) {
        this.assign(node, key, cached, mode);
      }
    });
  }

  private load(
    key: string,
    source: (done: LoadResult) => void,
    complete: (cached?: CachedFrame) => void,
  ): void {
    const cached = this.frames.get(key);
    if (cached) {
      cached.lastUsed = Date.now();
      complete(cached);
      return;
    }
    const waiting = this.pending.get(key);
    if (waiting) {
      waiting.push((error) => complete(error ? undefined : this.frames.get(key)));
      return;
    }
    this.pending.set(key, [(error) => complete(error ? undefined : this.frames.get(key))]);
    source((error, texture, owned, releaseTexture) =>
      this.finishLoad(key, error, texture, owned, releaseTexture));
  }

  private finishLoad(
    key: string,
    error: Error | null,
    texture?: Texture2D,
    ownedTexture = false,
    releaseTexture?: () => void,
  ): void {
    if (!error && texture) {
      this.frames.set(key, createCachedFrame(key, texture, ownedTexture, releaseTexture));
    } else if (!this.reportedErrors.has(key)) {
      this.reportedErrors.add(key);
      console.warn(`[SpriteLoader] failed to load ${key}`, error);
    }
    const callbacks = this.pending.get(key) ?? [];
    this.pending.delete(key);
    callbacks.forEach((callback) => callback(error));
    this.trim();
  }

  private trim(): void {
    const entries = Array.from(this.frames.entries())
      .map(([key, frame]) => ({ key, lastUsed: frame.lastUsed }));
    this.retention.evictions(
      entries,
      (key) => this.bindings.hasConsumers(key),
      this.maxFrames,
    ).forEach((key) => this.evict(key));
    this.themeBundles.releaseUnused(this.frames.keys(), this.pending.keys());
  }

  private evict(key: string): void {
    const cached = this.frames.get(key);
    if (!cached) return;
    this.frames.delete(key);
    cached.release();
  }

  private assign(node: Node, key: string, cached: CachedFrame, mode: FitMode): void {
    cached.lastUsed = Date.now();
    this.bindings.bind(node, key);
    const image = node.getChildByName('__sprite') ?? this.createImageNode(node);
    const sprite = image.getComponent(Sprite) ?? image.addComponent(Sprite);
    sprite.spriteFrame = cached.frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    fitSprite(node, image, cached, mode);
  }

  private createImageNode(parent: Node): Node {
    const image = new Node('__sprite');
    image.layer = parent.layer;
    image.addComponent(UITransform);
    parent.insertChild(image, 0);
    return image;
  }

}

export const spriteLoader = new SpriteLoader();
