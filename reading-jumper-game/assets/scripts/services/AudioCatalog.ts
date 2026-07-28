export type SoundName =
  | 'opening'
  | 'introTitle'
  | 'startAppear'
  | 'start'
  | 'question'
  | 'voiceStart'
  | 'voiceComplete'
  | 'correct'
  | 'wrong'
  | 'unlock'
  | 'strike'
  | 'walk'
  | 'run'
  | 'reveal'
  | 'reward'
  | 'danger'
  | 'timer'
  | 'button'
  | 'transition'
  | 'result'
  | 'firework';
export type MusicName = 'bgm' | 'ambient';

export interface ToneDefinition {
  from: number;
  to: number;
  duration: number;
  wave?: OscillatorType;
}

export interface AudioDefinition {
  url?: string;
  volume?: number;
  tone?: ToneDefinition;
}

export type AudioCatalog = Readonly<Record<SoundName | MusicName, AudioDefinition>>;
export type AudioTheme = Readonly<Partial<AudioCatalog>>;

export const defaultAudioCatalog: AudioCatalog = {
  bgm: { url: './audio/bgm.mp3', volume: 0.24 },
  ambient: {},
  opening: {},
  introTitle: {},
  startAppear: {},
  start: {},
  question: {},
  voiceStart: {},
  voiceComplete: {},
  correct: { tone: { from: 660, to: 880, duration: 0.18 }, volume: 0.9 },
  wrong: { tone: { from: 240, to: 170, duration: 0.22 }, volume: 0.85 },
  unlock: { tone: { from: 440, to: 660, duration: 0.14 }, volume: 0.85 },
  strike: { tone: { from: 130, to: 90, duration: 0.08, wave: 'square' }, volume: 0.75 },
  walk: {},
  run: {},
  reveal: {},
  reward: {},
  danger: {},
  timer: {},
  button: { tone: { from: 520, to: 600, duration: 0.08 }, volume: 0.75 },
  transition: { tone: { from: 360, to: 620, duration: 0.18 }, volume: 0.75 },
  result: { tone: { from: 520, to: 820, duration: 0.3 }, volume: 0.8 },
  firework: { tone: { from: 700, to: 980, duration: 0.35 }, volume: 0.8 },
};
