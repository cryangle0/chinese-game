import { SpeechSelectionService } from '../../../services/SpeechSelectionService';
import { matchSpokenOption, matchSpokenTranscripts } from '../../../services/SpeechOptionMatcher';
import { GameServices } from '../../../services/GameServices';
import { ChineseQuestion } from '../../../shared/types/Question';
import { TreasureRound } from '../model/TreasureRound';
import { WritingGameView } from '../views/WritingGameView';
import {
  trackVoiceDiagnostic,
  trackVoiceGuard,
} from './VoiceAnswerDiagnostics';

export class VoiceAnswerController {
  private readonly speech: SpeechSelectionService;

  constructor(
    private readonly view: WritingGameView,
    private readonly round: TreasureRound,
    private readonly services: GameServices,
    private readonly question: () => ChineseQuestion | null,
    private readonly choose: (index: number) => void,
  ) {
    this.speech = new SpeechSelectionService(
      (record) => {
        trackVoiceDiagnostic(this.services.analytics, record);
      },
      this.services.speechStreams,
      (active) => this.services.audio.setVoiceCaptureActive(active),
    );
  }

  initialize(): void {
    this.view.voice.setSupported(this.speech.supported());
    if (typeof window !== 'undefined') {
      const bridge = window as Window & {
        __matchSpokenOption?: typeof matchSpokenOption;
        __matchSpokenTranscripts?: typeof matchSpokenTranscripts;
      };
      bridge.__matchSpokenOption = matchSpokenOption;
      bridge.__matchSpokenTranscripts = matchSpokenTranscripts;
    }
  }

  reset(): void {
    this.speech.stop();
    if (typeof document !== 'undefined') {
      delete document.body.dataset.voiceMatchIndex;
      delete document.body.dataset.voiceMatchGuard;
      delete document.body.dataset.voiceMatchAccepted;
    }
    this.initialize();
    this.view.voice.setEnabled(true);
  }

  disable(): void {
    this.speech.stop();
    this.view.voice.setEnabled(false);
  }

  pressStart(): void {
    this.listen();
  }

  pressEnd(): void {
    this.speech.finish();
  }

  pressCancel(): void {
    this.speech.stop();
  }

  listen(): void {
    const question = this.question();
    if (!question || this.round.state.current() !== 'awaiting-answer') {
      return;
    }
    const questionId = question.id;
    let recorderStarted = false;
    let completionPlayed = false;
    this.speech.listen(
      question.options,
      (index, attemptId) => {
        if (typeof document !== 'undefined') {
          document.body.dataset.voiceMatchIndex = String(index);
        }
        const sameQuestion = this.question()?.id === questionId;
        const roundState = this.round.state.current();
        const awaitingAnswer = roundState === 'awaiting-answer';
        const accepted = trackVoiceGuard(this.services.analytics, {
          attemptId,
          matchIndex: index,
          sameQuestion,
          awaitingAnswer,
          roundState,
        });
        if (typeof document !== 'undefined') {
          document.body.dataset.voiceMatchGuard = accepted
            ? 'accepted'
            : `${sameQuestion ? 'same' : 'changed'}-${roundState}`;
        }
        if (!accepted) return;
        if (typeof document !== 'undefined') {
          document.body.dataset.voiceMatchAccepted = 'true';
        }
        this.choose(index);
      },
      (state) => {
        if (state === 'listening' && !recorderStarted) {
          recorderStarted = true;
          this.services.audio.play('voiceStart');
        } else if (recorderStarted && !completionPlayed && state === 'processing') {
          completionPlayed = true;
          this.services.audio.play('voiceComplete');
        }
        this.view.voice.render(state);
      },
    );
  }

  dispose(): void {
    this.speech.dispose();
  }
}
