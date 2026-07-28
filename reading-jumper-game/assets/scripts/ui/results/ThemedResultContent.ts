import { Node } from 'cc';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { resultThemeLayout } from './ResultThemeLayout';
import { buildThemedResultRanking } from './ThemedResultRanking';
import { buildThemedResultReview } from './ThemedResultReview';
import { buildThemedResultScore } from './ThemedResultScore';

export class ThemedResultContent {
  constructor(parent: Node, result: GameResult, theme: GameTheme) {
    const layout = resultThemeLayout(theme.id);
    buildThemedResultScore(parent, result, theme, layout);
    buildThemedResultRanking(parent, result, theme, layout);
    buildThemedResultReview(parent, result, theme, layout);
  }
}
