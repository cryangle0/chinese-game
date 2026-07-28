import { DifficultyTier, Grade } from '../../shared/types/GameTypes';
import { ChineseQuestion } from '../../shared/types/Question';
import type { HostBridge, SharePayload } from './HostBridge';

export type HostKind = 'browser' | 'wechat' | 'wechat-mp' | 'zybang';

export interface LaunchContext {
  activityId: string;
  bankUrl: string;
  channel: string;
  difficulties: readonly DifficultyTier[];
  grade: Grade;
  host: HostKind;
  scene: string;
  sessionId: string;
  skipIntro: boolean;
  /** Cover book → question knowledgePoint (`?book=`). */
  book: string;
  term: ChineseQuestion['term'];
  trackEndpoint: string;
}

export interface HostAdapter {
  readonly bridge: HostBridge;
  readonly kind: HostKind;
  close(): void;
  launchContext(): LaunchContext;
  lockLandscape(): Promise<void>;
  postToHost(message: unknown): void;
  share(payload: SharePayload): Promise<boolean>;
}

export type HostEventType =
  | 'game-ready'
  | 'game-result'
  | 'game-exit'
  | 'game-error';

export interface HostEvent<T = unknown> {
  activityId: string;
  game: string;
  payload: T;
  sessionId: string;
  source: 'h5-game';
  timestamp: number;
  type: HostEventType;
  version: 1;
}
