import { AudioDefinition } from './AudioCatalog';

export function playTone(context: AudioContext, definition: AudioDefinition): void {
  const tone = definition.tone;
  if (!tone) return;
  const { from, to, duration, wave = 'sine' } = tone;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(from, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.12 * (definition.volume ?? 1),
    context.currentTime + 0.015,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}
