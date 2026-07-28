import { assetManager, resources, Texture2D } from 'cc';

type Bundle = NonNullable<ReturnType<typeof assetManager.getBundle>>;
type AssetRoute = Readonly<{ bundleName: string; assetPath: string }>;

export type TextureLoadResult = (
  error: Error | null,
  texture?: Texture2D,
  owned?: boolean,
  releaseTexture?: () => void,
) => void;

export class ThemeBundleLoader {
  private readonly bundleLoads = new Map<string, Promise<Bundle>>();
  private retained = new Set<string>();

  loadTexture(path: string, done: TextureLoadResult): void {
    const route = this.route(path);
    if (!route) {
      resources.load(`${path}/texture`, Texture2D, (error, texture) => {
        done(error ? new Error(error.message) : null, texture ?? undefined);
      });
      return;
    }
    void this.loadBundle(route.bundleName).then((bundle) => {
      const assetPath = `${route.assetPath}/texture`;
      bundle.load(assetPath, Texture2D, (error, texture) => {
        done(
          error ? new Error(error.message) : null,
          texture ?? undefined,
          false,
          () => bundle.release(assetPath, Texture2D),
        );
      });
    }).catch((error: Error) => done(error));
  }

  retainOnly(paths: readonly string[]): void {
    this.retained = new Set(paths.flatMap((path) => {
      const route = this.route(path);
      return route ? [route.bundleName] : [];
    }));
  }

  releaseUnused(frameKeys: Iterable<string>, pendingKeys: Iterable<string>): void {
    const frames = Array.from(frameKeys);
    const pending = Array.from(pendingKeys);
    const bundles: Bundle[] = [];
    assetManager.bundles.forEach((bundle) => bundles.push(bundle));
    for (const bundle of bundles) {
      if (!bundle.name.startsWith('theme-') || this.retained.has(bundle.name)) continue;
      const inUse = frames.some((key) => this.route(key)?.bundleName === bundle.name);
      const loading = pending.some((key) => this.route(key)?.bundleName === bundle.name);
      if (!inUse && !loading) {
        bundle.releaseAll();
        assetManager.removeBundle(bundle);
      }
    }
  }

  private loadBundle(name: string): Promise<Bundle> {
    const loaded = assetManager.getBundle(name);
    if (loaded) return Promise.resolve(loaded);
    const pending = this.bundleLoads.get(name);
    if (pending) return pending;
    const request = new Promise<Bundle>((resolve, reject) => {
      assetManager.loadBundle(name, (error, bundle) => {
        this.bundleLoads.delete(name);
        if (error || !bundle) reject(error ? new Error(error.message) : new Error('empty bundle'));
        else resolve(bundle);
      });
    });
    this.bundleLoads.set(name, request);
    return request;
  }

  private route(path: string): AssetRoute | null {
    const match = /^themes\/(reading|writing)\/([^/]+)\/(.+)$/.exec(path);
    if (!match || match[2] === 'intro') return null;
    return {
      bundleName: `theme-${match[1]}-${match[2]}`,
      assetPath: match[3],
    };
  }
}
