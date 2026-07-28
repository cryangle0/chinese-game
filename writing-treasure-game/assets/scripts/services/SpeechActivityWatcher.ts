export interface SpeechActivityWatcher {
  stop(): void;
}

const sampleIntervalMs = 80;
const minimumRecordingMs = 520;
const requiredSilenceMs = 780;
const minimumSpeechFrames = 2;
/** Lower floor so quiet phone mics still count as speech. */
const minimumSpeechRms = 0.011;

export function watchSpeechActivity(
  stream: MediaStream,
  onSpeechEnded: () => void,
): SpeechActivityWatcher | null {
  const AudioContextClass = audioContextClass();
  if (!AudioContextClass) return null;
  let context: AudioContext;
  try {
    context = new AudioContextClass({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.25;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  const startedAt = performance.now();
  let noiseFloor = 0.006;
  let speechFrames = 0;
  let heardSpeech = false;
  let quietSince = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const sample = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(samples);
    const rms = calculateRms(samples);
    const now = performance.now();
    if (!heardSpeech) {
      noiseFloor = noiseFloor * 0.9 + Math.min(rms, 0.03) * 0.1;
      const threshold = Math.max(minimumSpeechRms, noiseFloor * 2.6);
      speechFrames = rms >= threshold ? speechFrames + 1 : 0;
      heardSpeech = speechFrames >= minimumSpeechFrames;
    } else {
      const quietThreshold = Math.max(minimumSpeechRms * 0.75, noiseFloor * 1.8);
      if (rms <= quietThreshold) {
        if (!quietSince) quietSince = now;
        if (now - startedAt >= minimumRecordingMs && now - quietSince >= requiredSilenceMs) {
          onSpeechEnded();
          return;
        }
      } else {
        quietSince = 0;
      }
    }
    timer = setTimeout(sample, sampleIntervalMs);
  };

  void context.resume().catch(() => undefined);
  timer = setTimeout(sample, sampleIntervalMs);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      source.disconnect();
      void context.close().catch(() => undefined);
    },
  };
}

export function calculateRms(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length);
}

function audioContextClass(): typeof AudioContext | null {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}
