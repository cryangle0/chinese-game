import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { RoundTimer } from '../../../services/RoundTimer';
import { readingThemes } from '../config/ReadingTheme';
import { ReadingGameView } from '../views/ReadingGameView';

export class ReadingHudController {
  private renderedSecond = -1;

  constructor(
    private readonly view: ReadingGameView,
    private readonly timer: RoundTimer,
    private readonly session: GameSession,
    private readonly services: GameServices,
    private readonly campaign: CampaignProgress<(typeof readingThemes)[number]>,
  ) {}

  render(force = true): void {
    const remaining = this.timer.remaining();
    const second = Math.ceil(remaining);
    if (!force && second === this.renderedSecond) return;
    if (second === 10 && this.renderedSecond !== 10) this.services.audio.play('timer');
    this.renderedSecond = second;
    if (typeof document !== 'undefined') {
      document.body.dataset.gameScore = String(this.session.score());
    }
    this.view.renderHud(
      remaining,
      this.session.score(),
      this.session.lives(),
      this.campaign.index(),
      this.campaign.total(),
      this.campaign.current().name,
      this.session.combo(),
    );
  }
}
