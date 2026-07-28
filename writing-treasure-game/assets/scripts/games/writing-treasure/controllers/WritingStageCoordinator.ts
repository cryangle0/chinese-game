import {
  preloadCriticalTheme, preloadTheme, retainThemes,
} from '../../../core/assets/ThemePreloader';
import { prefetchMotion } from '../../../core/media/DomMotionSprite';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameServices } from '../../../services/GameServices';
import { QuestionCursor } from '../../../services/QuestionCursor';
import { GameTheme } from '../../../shared/types/Theme';
import { GameLaunchOptions } from '../../../ui/GameController';
import { writingAudio } from '../config/WritingTheme';
import { WritingGameView } from '../views/WritingGameView';

export class WritingStageCoordinator {
  constructor(
    private readonly campaign: CampaignProgress<GameTheme>,
    private readonly view: WritingGameView,
    private readonly services: GameServices,
    private readonly options: GameLaunchOptions,
    private readonly usedQuestionIds: Set<string>,
  ) {}

  mount(): QuestionCursor {
    const theme = this.campaign.current();
    this.services.audio.setTheme(writingAudio(theme.id));
    if (typeof document !== 'undefined') document.body.dataset.gameStage = theme.id;
    const nextTheme = this.campaign.peek();
    retainThemes([theme, nextTheme]);
    prefetchMotion(
      theme.assets.motion?.idle,
      theme.assets.motion?.action,
      theme.assets.motion?.runLeft,
      theme.assets.motion?.runRight,
      theme.assets.motion?.correct,
      theme.assets.motion?.wrong,
      theme.assets.motion?.result,
      theme.assets.motion?.transition,
      nextTheme?.assets.motion?.transition,
    );
    if (this.campaign.index() > 0) this.view.playTransition(theme.assets.motion?.transition);
    if (nextTheme) this.services.audio.preload(writingAudio(nextTheme.id));
    void preloadCriticalTheme(nextTheme);
    this.view.mount(theme);
    const cursor = this.services.questions.createCursor({
      game: 'writing-treasure',
      scene: theme.id,
      grade: this.options.grade,
      term: this.options.term,
      difficulties: this.options.difficulties,
      knowledgePoint: this.options.knowledgePoint,
    }, undefined, this.usedQuestionIds);
    if (typeof document !== 'undefined') {
      document.body.dataset.filterBook = this.options.knowledgePoint ?? '';
    }
    this.services.analytics.track({
      name: 'scene_enter',
      game: 'writing-treasure',
      properties: {
        scene: theme.id,
        stage: this.campaign.index() + 1,
        materialStatus: theme.materialStatus,
        assetSource: theme.assetSource,
      },
    });
    void preloadTheme(theme);
    return cursor;
  }
}
