import {
  voiceDiagnosticProperties,
  VoiceDiagnostic,
} from '../assets/scripts/services/VoiceDiagnostics';

describe('voice diagnostics privacy boundary', () => {
  it('keeps only approved operational fields', () => {
    const record: VoiceDiagnostic = {
      attemptId: 'voice-123',
      phase: 'asr_response',
      elapsedMs: 456,
      audioBytes: 2048,
      mimeType: 'audio/webm',
      httpStatus: 200,
      requestId: 'tencent-request-id',
      transcriptPresent: true,
      transcriptLength: 6,
      matchIndex: 1,
      optionCount: 3,
    };

    expect(voiceDiagnosticProperties(record)).toEqual(record);
  });

  it('never emits audio, transcript, options, or question content', () => {
    const malicious = {
      attemptId: 'voice-456',
      phase: 'match_failed',
      transcript: '答案是火焰山',
      options: ['流沙河', '火焰山', '景阳冈'],
      audio: 'base64-secret',
      question: '下列哪一项……',
      errorMessage: 'raw provider message',
      transcriptLength: 6,
    } as unknown as VoiceDiagnostic;

    const properties = voiceDiagnosticProperties(malicious);
    expect(properties).toEqual({
      attemptId: 'voice-456',
      phase: 'match_failed',
      transcriptLength: 6,
    });
    expect(JSON.stringify(properties)).not.toContain('火焰山');
    expect(JSON.stringify(properties)).not.toContain('base64');
  });

  it('bounds string fields before persistence', () => {
    const properties = voiceDiagnosticProperties({
      attemptId: 'x'.repeat(300),
      phase: 'asr_error',
      errorName: 'NotAllowedError'.repeat(30),
      mimeType: 'audio/webm'.repeat(30),
      requestId: 'r'.repeat(300),
    });
    expect(String(properties.attemptId)).toHaveLength(80);
    expect(String(properties.errorName).length).toBeLessThanOrEqual(64);
    expect(String(properties.mimeType).length).toBeLessThanOrEqual(64);
    expect(String(properties.requestId)).toHaveLength(100);
  });
});
