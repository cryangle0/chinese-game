import { Node } from 'cc';
import {
  preloadInitialThemeAfterFirstPaint, retainIntro,
} from '../../../core/assets/ThemePreloader';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { prefetchMotion } from '../../../core/media/DomMotionSprite';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameServices } from '../../../services/GameServices';
import { resolveBookOption } from '../../../shared/config/BookCatalog';
import { GameLaunchOptions } from '../../../ui/GameController';
import { GameIntroView } from '../../../ui/GameIntroView';
import { writingIntro, writingThemes } from '../config/WritingTheme';

interface IntroOptions {
  readonly root: Node;
  readonly scope: TaskScope;
  readonly campaign: CampaignProgress<(typeof writingThemes)[number]>;
  readonly services: GameServices;
  readonly launch: GameLaunchOptions;
  readonly start: () => void;
}

export function mountWritingIntro(options: IntroOptions): Promise<unknown | null> {
  const {
    root, scope, campaign, services, launch, start,
  } = options;
  retainIntro(writingIntro);
  const runMotion = campaign.current().assets.motion?.runRight;
  const preload = preloadInitialThemeAfterFirstPaint(campaign.current())
    .then(() => null, (error: unknown) => error);
  scheduleRunMotionPrefetch(runMotion);
  if (typeof document !== 'undefined') document.body.dataset.gameView = 'intro';
  services.audio.play('opening');
  new GameIntroView(
    root,
    writingIntro,
    scope.guard(() => start()),
    {
      initialBook: launch.knowledgePoint,
      runMotion,
      onRunStart: scope.guard((book: string) => {
        const selected = resolveBookOption(
          book || (typeof document !== 'undefined' ? document.body.dataset.bookSelect : undefined),
        );
        launch.knowledgePoint = selected;
        if (typeof document !== 'undefined') {
          document.body.dataset.bookSelect = selected;
          document.body.dataset.filterBook = selected;
        }
        services.audio.play('button');
        services.audio.play('start');
        services.audio.play('walk');
      }),
    },
  );
  return preload;
}

function scheduleRunMotionPrefetch(runMotion: string | undefined): void {
  if (!runMotion || typeof window === 'undefined') return;
  const preload = () => prefetchMotion(runMotion);
  const scheduleIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(preload, { timeout: 1400 });
    } else {
      window.setTimeout(preload, 320);
    }
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(scheduleIdle));
}
