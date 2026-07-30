import { Node } from 'cc';
import {
  preloadCriticalTheme, retainThemes,
} from '../../../core/assets/ThemePreloader';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameServices } from '../../../services/GameServices';
import { QuestionCursor } from '../../../services/QuestionCursor';
import { RoundTimer } from '../../../services/RoundTimer';
import { AppConfig } from '../../../shared/config/AppConfig';
import { GameTheme } from '../../../shared/types/Theme';
import { TreasureRound } from '../model/TreasureRound';
import { WritingGameView } from '../views/WritingGameView';
import { VoiceAnswerController } from './VoiceAnswerController';
import { WritingStageCoordinator } from './WritingStageCoordinator';

export class WritingStartCoordinator {
  constructor(
    private readonly root: Node,
    private readonly scope: TaskScope,
    private readonly campaign: CampaignProgress<GameTheme>,
    private readonly view: WritingGameView,
    private readonly voice: VoiceAnswerController,
    private readonly round: TreasureRound,
    private readonly timer: RoundTimer,
    private readonly services: GameServices,
    private readonly stages: WritingStageCoordinator,
    private readonly playInitialEntry = true,
  ) {}

  async start(): Promise<QuestionCursor | null> {
    this.services.audio.unlock();
    retainThemes([this.campaign.current(), this.campaign.peek()]);
    await Promise.all([
      preloadCriticalTheme(this.campaign.current()),
      this.services.questions.whenRefreshed(),
    ]);
    if (!this.scope.isActive()) return null;
    this.root.getChildByName('GameIntro')?.destroy();
    this.view.setActive(true);
    this.view.setPlayUiVisible(!this.playInitialEntry);
    this.round.begin();
    this.services.audio.playMusic();
    this.services.analytics.track({ name: 'game_start', game: 'writing-treasure' });
    const cursor = this.stages.mount();
    if (this.playInitialEntry) {
      if (typeof document !== 'undefined') document.body.dataset.gameView = 'stage-entry';
      this.services.audio.play('walk');
      await this.view.deer.enterFromLeft();
      if (!this.scope.isActive()) return null;
      this.view.setPlayUiVisible(true);
    }
    this.voice.initialize();
    this.timer.start(AppConfig.roundSeconds);
    if (typeof document !== 'undefined') document.body.dataset.gameView = 'play';
    return cursor;
  }
}
