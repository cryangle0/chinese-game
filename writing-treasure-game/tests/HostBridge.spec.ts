import { createHostBridge } from '../assets/scripts/platform/HostBridge';

describe('HostBridge mini-program integration', () => {
  afterEach(() => {
    delete (globalThis as { wx?: unknown }).wx;
    delete (globalThis as { ZybBridge?: unknown }).ZybBridge;
  });

  it('opens the native share page after publishing the card configuration', async () => {
    const postMessage = jest.fn();
    const navigateTo = jest.fn();
    (globalThis as { wx?: unknown }).wx = { miniProgram: { navigateTo, postMessage } };
    const bridge = createHostBridge('wechat-mp');
    await expect(bridge.share({ title: '成绩' })).resolves.toBe(true);
    await expect(bridge.requestLandscape()).resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith({
      data: { source: 'h5-game', type: 'share-config', payload: { title: '成绩' } },
    });
    expect(navigateTo).toHaveBeenCalledWith({
      url: `/pages/share/index?title=${encodeURIComponent('成绩')}`,
    });
  });

  it('uses the native invoke bridge when direct methods are absent', async () => {
    const invoke = jest.fn(() => true);
    (globalThis as { ZybBridge?: unknown }).ZybBridge = { invoke };
    const bridge = createHostBridge('zybang');
    expect(bridge.close()).toBe(true);
    await expect(bridge.requestLandscape()).resolves.toBe(true);
    await expect(bridge.share({ title: '成绩' })).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('close');
  });

  it('uses wx.miniProgram for messages and navigation', () => {
    const postMessage = jest.fn();
    const navigateBack = jest.fn();
    (globalThis as { wx?: unknown }).wx = {
      miniProgram: { navigateBack, postMessage },
    };
    const bridge = createHostBridge('wechat-mp');
    bridge.postMessage({ type: 'game-ready' });
    expect(postMessage).toHaveBeenCalledWith({
      data: { type: 'game-ready' },
    });
    expect(bridge.close()).toBe(true);
    expect(navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });
});
