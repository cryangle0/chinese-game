import { Node, tween } from 'cc';
import {
  preloadPlayableTheme, retainIntroAndThemes,
} from '../../../core/assets/ThemePreloader';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameServices } from '../../../services/GameServices';
import { resolveBookOption } from '../../../shared/config/BookCatalog';
import { GameLaunchOptions } from '../../../ui/GameController';
import { GameIntroView } from '../../../ui/GameIntroView';
import { readingIntro, readingThemes } from '../config/ReadingTheme';
import { ReadingMotionController } from './ReadingMotionController';

interface ReadingIntroOptions {
  readonly root: Node;
  readonly scope: TaskScope;
  readonly campaign: CampaignProgress<(typeof readingThemes)[number]>;
  readonly services: GameServices;
  readonly launch: GameLaunchOptions;
  readonly motion: ReadingMotionController;
  readonly start: () => void;
}

export function mountReadingIntro(options: ReadingIntroOptions): Promise<unknown | null> {
  const {
    root, scope, campaign, services, launch, motion, start,
  } = options;
  retainIntroAndThemes(readingIntro, [campaign.current()]);
  const preload = preloadPlayableTheme(campaign.current())
    .then(() => null, (error: unknown) => error);
  if (typeof document !== 'undefined') document.body.dataset.gameView = 'intro';
  tween(root).delay(0.35).call(scope.guard(() => motion.start())).start();

  let introStarted = false;
  const enterPlay = scope.guard((book: string) => {
    const selected = resolveBookOption(
      book || (typeof document !== 'undefined' ? document.body.dataset.bookSelect : undefined),
    );
    launch.knowledgePoint = selected;
    markSelectedBook(selected);
    start();
  });
  const intro = new GameIntroView(root, readingIntro, enterPlay, {
    initialBook: launch.knowledgePoint,
    onBeginFx: scope.guard(() => {
      if (introStarted) return;
      introStarted = true;
      motion.setMode('off');
      services.audio.play('button');
      services.audio.play('transition');
    }),
  });
  motion.setMode('intro', () => intro.triggerStart());
  services.audio.play('introTitle');
  tween(root).delay(0.7)
    .call(scope.guard(() => services.audio.play('startAppear'))).start();
  return preload;
}

function markSelectedBook(selected: string): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.bookSelect = selected;
  document.body.dataset.filterBook = selected;
}
