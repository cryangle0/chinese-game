import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createButton, createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { ResultReviewView } from './ResultReviewView';
import { ResultSummaryView } from './ResultSummaryView';

export interface StandardResultOptions {
  readonly title?: string;
  readonly primaryLabel?: string;
  readonly homeLabel?: string;
  readonly primaryOnly?: boolean;
}

export function buildStandardResult(
  root: Node,
  result: GameResult,
  theme: GameTheme,
  replay: () => void,
  home: (() => void) | null,
  share: (() => boolean | Promise<boolean>) | undefined,
  options: StandardResultOptions,
  title: string,
): void {
  const panel = createUiNode(root, 'ResultPanel', 1050, 620, new Vec3(115, 0));
  if (!theme.assets.resultBackground) drawPanel(panel, theme.palette.panel, 24, 224);
  const resultTitle = createLabel(root, options.title ?? title, {
    size: 44, color: '#FFFFFF', width: 520, height: 64, bold: true,
  });
  resultTitle.node.setPosition(115, 320);
  const character = createUiNode(root, 'ResultCharacter', 300, 420, new Vec3(-565, -65));
  spriteLoader.apply(character, theme.assets.characterIdle, 'contain');
  new ResultSummaryView(panel, result, theme.palette, theme.assets);
  new ResultReviewView(panel, result, theme.palette, theme.assets);

  const replayButton = createButton(
    root, options.primaryLabel ?? '再玩一次', 230, replay, '#16845B',
  );
  replayButton.setPosition(options.primaryOnly ? 0 : -260, -280);
  if (home && !options.primaryOnly) {
    const homeButton = createButton(root, options.homeLabel ?? '返回首页', 230, home, '#285B92');
    homeButton.setPosition(260, -280);
  }
  if (share && !options.primaryOnly) {
    const shareButton = createButton(root, '分享成绩', 230, share, '#B45A18');
    shareButton.setPosition(0, -280);
  }
}
