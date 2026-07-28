import {
  preloadCriticalTheme, preloadTheme, retainThemes,
} from '../../../core/assets/ThemePreloader';
import { prefetchMotion } from '../../../core/media/DomMotionSprite';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameServices } from '../../../services/GameServices';
import { QuestionCursor } from '../../../services/QuestionCursor';
import { GameTheme } from '../../../shared/types/Theme';
import { GameLaunchOptions } from '../../../ui/GameController';
import { readingAudio } from '../config/ReadingTheme';
import { ReadingGameView } from '../views/ReadingGameView';

export class ReadingStageCoordinator {
  constructor(
    private readonly campaign: CampaignProgress<GameTheme>,
    private readonly view: ReadingGameView,
    private readonly services: GameServices,
    private readonly options: GameLaunchOptions,
    private readonly usedQuestionIds: Set<string>,
  ) {}

  mount(): QuestionCursor {
    const theme = this.campaign.current();
    const nextTheme = this.campaign.peek();
    this.services.audio.setTheme(readingAudio(theme.id));
    if (typeof document !== 'undefined') document.body.dataset.gameStage = theme.id;
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
    if (nextTheme) this.services.audio.preload(readingAudio(nextTheme.id));
    void preloadCriticalTheme(nextTheme);
    this.view.mount(theme);
    const cursor = this.services.questions.createCursor({
      game: 'reading-jumper',
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
      game: 'reading-jumper',
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
