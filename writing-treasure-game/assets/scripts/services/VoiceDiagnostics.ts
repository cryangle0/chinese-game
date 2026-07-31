export type VoiceDiagnosticPhase =
  | 'started'
  | 'microphone_ready'
  | 'recorder_ready'
  | 'release_requested'
  | 'released_before_ready'
  | 'short_press'
  | 'capture_empty'
  | 'capture_ready'
  | 'asr_response'
  | 'asr_error'
  | 'match_success'
  | 'match_failed'
  | 'accepted'
  | 'guard_rejected';

export interface VoiceDiagnostic {
  readonly attemptId: string;
  readonly phase: VoiceDiagnosticPhase;
  readonly elapsedMs?: number;
  readonly pressMs?: number;
  readonly recordingMs?: number;
  readonly chunkCount?: number;
  readonly audioBytes?: number;
  readonly mimeType?: string;
  readonly httpStatus?: number;
  readonly requestId?: string;
  readonly transcriptPresent?: boolean;
  readonly transcriptLength?: number;
  readonly matchIndex?: number;
  readonly optionCount?: number;
  readonly errorName?: string;
  readonly sameQuestion?: boolean;
  readonly awaitingAnswer?: boolean;
  readonly roundState?: string;
}

export type VoiceDiagnosticSink = (record: VoiceDiagnostic) => void;

type DiagnosticProperties = Readonly<Record<string, string | number | boolean>>;

const STRING_LIMITS = {
  attemptId: 80,
  mimeType: 64,
  requestId: 100,
  errorName: 64,
  roundState: 40,
} as const;

const NUMBER_FIELDS = [
  'elapsedMs',
  'pressMs',
  'recordingMs',
  'chunkCount',
  'audioBytes',
  'httpStatus',
  'transcriptLength',
  'matchIndex',
  'optionCount',
] as const;

const BOOLEAN_FIELDS = [
  'transcriptPresent',
  'sameQuestion',
  'awaitingAnswer',
] as const;

/**
 * Explicit privacy boundary. New fields are dropped until added to this whitelist.
 * Never pass raw audio, transcript text, options, or question content here.
 */
export function voiceDiagnosticProperties(record: VoiceDiagnostic): DiagnosticProperties {
  const output: Record<string, string | number | boolean> = {
    attemptId: bounded(record.attemptId, STRING_LIMITS.attemptId),
    phase: record.phase,
  };
  for (const field of Object.keys(STRING_LIMITS) as Array<keyof typeof STRING_LIMITS>) {
    if (field === 'attemptId') continue;
    const value = record[field];
    if (typeof value === 'string' && value) {
      output[field] = bounded(value, STRING_LIMITS[field]);
    }
  }
  for (const field of NUMBER_FIELDS) {
    const value = record[field];
    if (typeof value === 'number' && Number.isFinite(value)) output[field] = value;
  }
  for (const field of BOOLEAN_FIELDS) {
    const value = record[field];
    if (typeof value === 'boolean') output[field] = value;
  }
  return output;
}

export class VoiceAttemptDiagnostics {
  readonly attemptId: string;
  private readonly startedAt = Date.now();

  constructor(
    private readonly sink: VoiceDiagnosticSink | undefined,
    optionCount: number,
  ) {
    this.attemptId = createAttemptId();
    this.emit('started', { optionCount });
  }

  emit(
    phase: VoiceDiagnosticPhase,
    fields: Omit<VoiceDiagnostic, 'attemptId' | 'phase'> = {},
  ): void {
    try {
      this.sink?.({
        attemptId: this.attemptId,
        phase,
        elapsedMs: Math.max(0, Date.now() - this.startedAt),
        ...fields,
      });
    } catch {
      // Diagnostics must never block voice input.
    }
  }
}

function bounded(value: string, limit: number): string {
  return String(value ?? '').slice(0, limit);
}

function createAttemptId(): string {
  const uuid = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
  return uuid ? `voice-${uuid}` : `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
