import {
  detectHost,
  parseLaunchContext,
} from '../assets/scripts/platform/HostAdapter';

describe('HostAdapter launch context', () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');

  afterEach(() => {
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  });

  it('uses the deployed static bank and disables absent analytics by default', () => {
    const context = parseLaunchContext(new URLSearchParams(), 'browser');
    expect(context.bankUrl).toBe('./question-bank.json');
    expect(context.trackEndpoint).toBe('');
    expect(context.sessionId).not.toBe('');
    expect(context.book).toBe('西游记');
  });

  it('accepts same-origin paths and learning filters', () => {
    const query = new URLSearchParams(
      'bankUrl=/api/bank&trackEndpoint=/track'
      + '&grade=5&term=second&difficulty=challenge,basic&book=安徒生童话',
    );
    const context = parseLaunchContext(query, 'wechat');
    expect(context.bankUrl).toBe('/api/bank');
    expect(context.trackEndpoint).toBe('/track');
    expect(context.grade).toBe('L5');
    expect(context.term).toBe('second');
    expect(context.difficulties).toEqual(['challenge', 'basic']);
    expect(context.book).toBe('安徒生童话');
  });

  it('rejects cross-origin runtime endpoints', () => {
    const query = new URLSearchParams(
      'bankUrl=https://attacker.example/bank.json'
      + '&trackEndpoint=//attacker.example/track',
    );
    const context = parseLaunchContext(query, 'browser');
    expect(context.bankUrl).toBe('./question-bank.json');
    expect(context.trackEndpoint).toBe('');
  });

  it('does not send reading diagnostics to the writing service', () => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        origin: 'https://game.xyouxing.com',
        hostname: 'game.xyouxing.com',
        pathname: '/reading-jumper/index.html',
        protocol: 'https:',
      },
    });
    const direct = parseLaunchContext(new URLSearchParams(), 'wechat-mp');
    const injected = parseLaunchContext(new URLSearchParams(
      'trackEndpoint=https://agent.onnsa.cn/writing-treasure/api/track',
    ), 'wechat-mp');
    expect(direct.trackEndpoint).toBe('');
    expect(injected.trackEndpoint).toBe('');
  });

  it('detects the mini program web-view before generic WeChat', () => {
    const query = new URLSearchParams('host=wechat-mp&sessionId=shell-session');
    expect(detectHost(query, 'MicroMessenger')).toBe('wechat-mp');
    expect(parseLaunchContext(query, 'wechat-mp').sessionId).toBe('shell-session');
  });
});
