import type { HostKind } from './HostTypes';

export interface SharePayload {
  title: string;
  url?: string;
  imageUrl?: string;
}

export interface HostBridge {
  close(): boolean;
  postMessage(message: unknown): void;
  requestLandscape(): Promise<boolean>;
  share(payload: SharePayload): Promise<boolean>;
}

interface ZybBridgeApi {
  close?: () => void;
  invoke?: (method: string, payload?: unknown) => unknown;
  postMessage?: (message: unknown) => void;
  requestLandscape?: () => boolean | Promise<boolean> | void;
  share?: (payload: SharePayload) => boolean | Promise<boolean> | void;
}

interface MiniProgramApi {
  navigateBack?: (options: { delta: number }) => void;
  navigateTo?: (options: { url: string }) => void;
  postMessage?: (options: { data: unknown }) => void;
}

/** Native page owning the `open-type="share"` button. */
const SHARE_PAGE = '/pages/share/index';

function sharePageUrl(payload: SharePayload): string {
  const params = [`title=${encodeURIComponent(payload.title)}`];
  if (payload.url) params.push(`link=${encodeURIComponent(payload.url)}`);
  return `${SHARE_PAGE}?${params.join('&')}`;
}

function zybApi(): ZybBridgeApi | null {
  return (globalThis as { ZybBridge?: ZybBridgeApi }).ZybBridge ?? null;
}

function miniProgramApi(): MiniProgramApi | null {
  const wx = (globalThis as { wx?: { miniProgram?: MiniProgramApi } }).wx;
  return wx?.miniProgram ?? null;
}

async function accepted(value: unknown): Promise<boolean> {
  return await value !== false;
}

export function createHostBridge(kind: HostKind = 'browser'): HostBridge {
  return {
    close(): boolean {
      const miniProgram = miniProgramApi();
      if (kind === 'wechat-mp' && miniProgram?.navigateBack) {
        miniProgram.navigateBack({ delta: 1 });
        return true;
      }
      const bridge = zybApi();
      if (bridge?.close) bridge.close();
      else if (bridge?.invoke) bridge.invoke('close');
      else return false;
      return true;
    },
    postMessage(message: unknown): void {
      const miniProgram = miniProgramApi();
      if (kind === 'wechat-mp' && miniProgram?.postMessage) {
        miniProgram.postMessage({ data: message });
        return;
      }
      const bridge = zybApi();
      if (bridge?.postMessage) bridge.postMessage(message);
      else if (bridge?.invoke) bridge.invoke('postMessage', message);
      else if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
    },
    async requestLandscape(): Promise<boolean> {
      if (kind === 'wechat-mp') return true;
      const bridge = zybApi();
      if (bridge?.requestLandscape) return accepted(bridge.requestLandscape());
      if (bridge?.invoke) return accepted(bridge.invoke('requestLandscape'));
      return false;
    },
    async share(payload: SharePayload): Promise<boolean> {
      const miniProgram = miniProgramApi();
      if (kind === 'wechat-mp' && miniProgram) {
        miniProgram.postMessage?.({
          data: { source: 'h5-game', type: 'share-config', payload },
        });
        miniProgram.navigateTo?.({ url: sharePageUrl(payload) });
        return Boolean(miniProgram.postMessage || miniProgram.navigateTo);
      }
      const bridge = zybApi();
      if (bridge?.share) return accepted(bridge.share(payload));
      if (bridge?.invoke) return accepted(bridge.invoke('share', payload));
      if (typeof navigator === 'undefined' || !navigator.share) return false;
      try {
        await navigator.share(payload);
        return true;
      } catch {
        return false;
      }
    },
  };
}
