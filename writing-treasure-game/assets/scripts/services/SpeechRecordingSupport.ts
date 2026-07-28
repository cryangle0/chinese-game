export const maxRecordingMs = 4800;
export const requestTimeoutMs = 12000;
export const minimumAudioBytes = 64;

const recordingMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

export const speechAudioConstraints: MediaTrackConstraints = {
  // Browser AGC can alter the OS communications gain and leave playback much louder.
  autoGainControl: false,
  channelCount: { ideal: 1 },
  echoCancellation: true,
  noiseSuppression: true,
  sampleRate: { ideal: 16000 },
};

export interface SpeechRecognitionResponse {
  readonly transcript?: string;
  readonly requestId?: string;
  readonly alternatives?: readonly (string | {
    readonly transcript?: string;
    readonly text?: string;
  })[];
}

export function preferredRecordingMimeType(): string {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return recordingMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function encodeSpeechHints(options: readonly string[]): string {
  const letters = ['A', 'B', 'C', 'D'] as const;
  const hints: string[] = [];
  const texts = options.slice(0, 4).map((option) =>
    Array.from(String(option ?? '').trim()).slice(0, 40).join('')).filter(Boolean);
  // Keep all three supported modes inside the production server's first 16 hints.
  hints.push(...texts);
  hints.push(...letters.slice(0, texts.length));
  texts.forEach((text, index) => hints.push(`${letters[index]}${text}`.slice(0, 40)));
  texts.forEach((_text, index) => hints.push(`选项${letters[index]}`));
  texts.forEach((_text, index) => hints.push(`选${letters[index]}`));
  texts.forEach((text, index) => {
    const letter = letters[index];
    if (!letter) return;
    if (text.length >= 4) hints.push(Array.from(text).slice(0, 3).join(''));
    else if (text.length >= 2) hints.push(Array.from(text).slice(0, 2).join(''));
    hints.push(`${letter}、${text}`.slice(0, 40));
  });
  return encodeURIComponent(JSON.stringify(hints.slice(0, 24)));
}

export function transcriptsFrom(result: SpeechRecognitionResponse): string[] {
  const values = [
    result.transcript,
    ...(result.alternatives ?? []).map((alternative) =>
      typeof alternative === 'string'
        ? alternative
        : alternative.transcript ?? alternative.text),
  ];
  return Array.from(new Set(values.filter((value): value is string =>
    typeof value === 'string' && Boolean(value.trim()))));
}
