import { AudioCatalog, defaultAudioCatalog } from '../assets/scripts/services/AudioCatalog';
import { AudioService } from '../assets/scripts/services/AudioService';

const catalog: AudioCatalog = {
  ...defaultAudioCatalog,
  bgm: {},
  correct: { tone: { from: 440, to: 660, duration: 0.1 } },
};

class FakeAudioParam {
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  readonly connect = jest.fn(() => this);
  readonly disconnect = jest.fn();
}

class FakeOscillator {
  readonly frequency = new FakeAudioParam();
  readonly connect = jest.fn(() => this.gain);
  readonly disconnect = jest.fn();
  readonly start = jest.fn();
  readonly stop = jest.fn();
  onended: (() => void) | null = null;
  type: OscillatorType = 'sine';

  constructor(private readonly gain: FakeGain) {}
}

class FakeAudioContext {
  readonly destination = {};
  readonly gain = new FakeGain();
  readonly oscillator = new FakeOscillator(this.gain);
  readonly resume = jest.fn(() => this.resumePromise);
  readonly suspend = jest.fn(() => this.suspendPromise);
  readonly close = jest.fn(() => Promise.resolve());
  currentTime = 0;
  state: AudioContextState = 'suspended';
  private resolveResume: (() => void) | null = null;
  private resolveSuspend: (() => void) | null = null;
  private readonly resumePromise = new Promise<void>((resolve) => {
    this.resolveResume = resolve;
  });
  private readonly suspendPromise = new Promise<void>((resolve) => {
    this.resolveSuspend = resolve;
  });

  createGain(): GainNode {
    return this.gain as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    return this.oscillator as unknown as OscillatorNode;
  }

  finishResume(): void {
    this.state = 'running';
    this.resolveResume?.();
  }

  finishSuspend(): void {
    this.state = 'suspended';
    this.resolveSuspend?.();
  }
}

describe('AudioService', () => {
  const OriginalAudioContext = global.AudioContext;
  let context: FakeAudioContext;

  beforeEach(() => {
    context = new FakeAudioContext();
    global.AudioContext = jest.fn(() => context) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    global.AudioContext = OriginalAudioContext;
  });

  it('deduplicates resume requests and disconnects completed tone nodes', async () => {
    const audio = new AudioService(catalog);
    audio.play('correct');
    audio.play('correct');
    expect(context.resume).toHaveBeenCalledTimes(1);

    context.finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.oscillator.start).toHaveBeenCalledTimes(1);

    context.oscillator.onended?.();
    expect(context.oscillator.disconnect).toHaveBeenCalledTimes(1);
    expect(context.gain.disconnect).toHaveBeenCalledTimes(1);
    audio.dispose();
  });

  it('does not resume or play after disposal', () => {
    const audio = new AudioService(catalog);
    audio.dispose();
    audio.play('correct');
    audio.unlock();
    audio.setEnabled(true);
    audio.setPaused(false);
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.oscillator.start).not.toHaveBeenCalled();
  });

  it('resumes when visibility returns before suspension finishes', async () => {
    context.state = 'running';
    const audio = new AudioService(catalog);
    audio.unlock();
    audio.setPaused(true);
    audio.setPaused(false);
    expect(context.resume).not.toHaveBeenCalled();

    context.finishSuspend();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.dispose();
  });
});
