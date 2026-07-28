import { HostMessenger } from '../assets/scripts/platform/host/HostMessenger';
import { HostAdapter, LaunchContext } from '../assets/scripts/platform/host/HostTypes';

describe('HostMessenger', () => {
  it('uses the launch session and includes the finish reason', () => {
    const messages: unknown[] = [];
    const adapter = {
      postToHost: (message: unknown) => { messages.push(message); },
    } as unknown as HostAdapter;
    const launch = {
      activityId: 'activity',
      channel: 'test',
      grade: 'L3',
      host: 'browser',
      sessionId: 'session-host',
    } as LaunchContext;
    const messenger = new HostMessenger('writing-treasure', launch, adapter);
    messenger.result({
      game: 'writing-treasure',
      reason: 'timeout',
      score: 20,
      correct: 1,
      wrong: 0,
      answered: 1,
      bestCombo: 1,
      stars: 3,
      answers: [],
    });
    expect(messages[0]).toMatchObject({
      sessionId: 'session-host',
      payload: { reason: 'timeout' },
      type: 'game-result',
    });
    messenger.ready();
    messenger.error(new Error('failed'));
    expect(messages).toHaveLength(3);
  });

  it('emits exit only once', () => {
    const postToHost = jest.fn();
    const messenger = new HostMessenger(
      'writing-treasure',
      { sessionId: 's' } as LaunchContext,
      { postToHost } as unknown as HostAdapter,
    );
    messenger.exit('pagehide');
    messenger.exit('destroy');
    expect(postToHost).toHaveBeenCalledTimes(1);
  });
});
