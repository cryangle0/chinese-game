import {
  Node, resources, SpriteFrame, Texture2D, UITransform,
} from 'cc';

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface CachedFrame {
  readonly frame: SpriteFrame;
  readonly width: number;
  readonly height: number;
  readonly release: () => void;
  lastUsed: number;
}

export function createCachedFrame(
  key: string,
  texture: Texture2D,
  ownedTexture: boolean,
  releaseTexture?: () => void,
): CachedFrame {
  const frame = new SpriteFrame();
  frame.texture = texture;
  return {
    frame,
    width: texture.width,
    height: texture.height,
    lastUsed: Date.now(),
    release: () => {
      frame.destroy();
      if (releaseTexture) releaseTexture();
      else if (ownedTexture) texture.destroy();
      else resources.release(`${key}/texture`, Texture2D);
    },
  };
}

export function fitSprite(
  host: Node,
  image: Node,
  source: CachedFrame,
  mode: FitMode,
): void {
  const hostTransform = host.getComponent(UITransform);
  const imageTransform = image.getComponent(UITransform);
  if (!hostTransform || !imageTransform) return;
  const target = hostTransform.contentSize;
  image.setScale(1, 1, 1);
  if (mode === 'stretch') {
    imageTransform.setContentSize(target);
    return;
  }
  imageTransform.setContentSize(source.width, source.height);
  const scale = mode === 'cover'
    ? Math.max(target.width / source.width, target.height / source.height)
    : Math.min(target.width / source.width, target.height / source.height);
  image.setScale(scale, scale, 1);
}
