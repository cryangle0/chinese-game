import { createHostBridge, HostBridge, SharePayload } from './HostBridge';
import {
  detectHost,
  parseLaunchContext,
  readLaunchQuery,
} from './LaunchContext';
import { HostAdapter, HostKind, LaunchContext } from './HostTypes';

export class WebHostAdapter implements HostAdapter {
  readonly bridge: HostBridge;
  readonly kind: HostKind;
  private readonly query: URLSearchParams;

  constructor(query = readLaunchQuery()) {
    this.query = query;
    this.kind = detectHost(query);
    this.bridge = createHostBridge(this.kind);
  }

  launchContext(): LaunchContext {
    return parseLaunchContext(this.query, this.kind);
  }

  async lockLandscape(): Promise<void> {
    if (await this.bridge.requestLandscape()) return;
    try {
      if (typeof screen === 'undefined') return;
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: string) => Promise<void>;
      };
      await orientation?.lock?.('landscape');
    } catch {
      // Fullscreen or a native host bridge is required by many browsers.
    }
  }

  postToHost(message: unknown): void {
    this.bridge.postMessage(message);
  }

  share(payload: SharePayload): Promise<boolean> {
    return this.bridge.share(payload);
  }

  close(): void {
    if (this.bridge.close()) return;
    if (typeof history !== 'undefined' && history.length > 1) history.back();
  }
}
