import {
  HorizontalTextAlignment, Label, Node, UIOpacity, UITransform, Vec3,
} from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import {
  createButton, createLabel, createUiNode, drawPanel,
} from '../../core/ui/UiFactory';
import {
  WritingSettlementLayout, settlementBoxNode,
} from '../../shared/config/WritingSettlementLayout';
import { GameResult } from '../../shared/types/GameTypes';
import { ThemeAssets } from '../../shared/types/Theme';
import type { ResultViewOptions } from '../ResultView';
import { addTreasureResultContent } from './TreasureResultContent';

function installCanvasFallback(root: Node, centerX: number, activate: () => void): void {
  if (typeof document !== 'undefined') {
    const canvas = document.getElementById('GameCanvas');
    if (!canvas) return;
    const pointerUp = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const stageScale = Math.min(bounds.width / 1440, bounds.height / 810);
      const offsetX = (bounds.width - 1440 * stageScale) / 2;
      const offsetY = (bounds.height - 810 * stageScale) / 2;
      const x = (event.clientX - bounds.left - offsetX) / stageScale - 720;
      const y = 405 - (event.clientY - bounds.top - offsetY) / stageScale;
      const positionScaleX = Number(document.body.dataset.resultPositionScaleX) || 1;
      if (Math.abs(x - centerX * positionScaleX) <= 90
        && Math.abs(y + 372) <= 28) activate();
    };
    canvas.addEventListener('pointerup', pointerUp);
    root.once(Node.EventType.NODE_DESTROYED, () => {
      canvas.removeEventListener('pointerup', pointerUp);
    });
  }
}

function addScore(root: Node, result: GameResult, assets: ThemeAssets): Node {
  const layout = WritingSettlementLayout.treasure;
  const scoreRoot = createUiNode(root, 'TreasureScoreArtwork', 1440, 810);
  const scoreBox = settlementBoxNode(layout.score);
  // BG score plate already present — "总分 N" text only, no blue drawPanel.
  const label = `总分 ${result.score}`;
  const value = createLabel(scoreRoot, label, {
    size: 34,
    color: '#FFE142',
    width: scoreBox.width,
    height: scoreBox.height,
    bold: true,
    outlineColor: '#3A170E',
    outlineWidth: 3,
  });
  value.horizontalAlign = HorizontalTextAlignment.CENTER;
  value.overflow = Label.Overflow.SHRINK;
  value.node.name = 'TreasureScoreValue';
  value.node.setPosition(scoreBox.position);
  if (typeof document !== 'undefined') {
    document.body.dataset.scoreLabel = label;
    document.body.dataset.scoreMode = 'summary';
    document.body.dataset.scorePanel = '0';
  }

  const earned = Math.max(0, Math.min(5, result.stars));
  const { left, top, width, height, gap } = layout.stars;
  for (let index = 0; index < 5; index += 1) {
    const asset = assets.resultStars?.[index] ?? assets.resultStars?.[0];
    const starLeft = left + index * (width + gap);
    const star = createUiNode(
      scoreRoot,
      `TreasureStar${index + 1}`,
      width,
      height,
      new Vec3(starLeft + width / 2 - 720, 405 - (top + height / 2), 0),
    );
    if (asset) spriteLoader.apply(star, asset, 'contain');
    star.addComponent(UIOpacity).opacity = index < earned ? 255 : 55;
  }
  return scoreRoot;
}

function addActionButton(
  root: Node,
  text: string,
  centerX: number,
  fill: string,
  onClick: () => void,
): void {
  let activated = false;
  const activate = () => {
    if (activated) return;
    activated = true;
    onClick();
  };
  const button = createButton(root, text, 180, activate, fill);
  button.on(Node.EventType.TOUCH_END, activate);
  installCanvasFallback(root, centerX, activate);
  button.getComponent(UITransform)?.setContentSize(180, 54);
  drawPanel(button, fill, 8);
  const label = button.children.find((child) => child.getComponent(Label))?.getComponent(Label);
  if (label) {
    label.fontSize = 22;
    label.lineHeight = 28;
    label.node.getComponent(UITransform)?.setContentSize(160, 45);
  }
  // Below prototype score/stars strip so gameplay CTA does not cover pixel layout.
  button.setPosition(centerX, -372);
}

function addActions(
  root: Node,
  replay: () => void,
  home: (() => void) | null,
  share: (() => boolean | Promise<boolean>) | undefined,
  options: ResultViewOptions,
): void {
  if (options.primaryOnly) {
    addActionButton(root, options.primaryLabel ?? '进入下一场景', 0, '#18965F', replay);
    if (typeof document !== 'undefined') delete document.body.dataset.resultShare;
    return;
  }
  // Stage (no home): share left of primary. Final: primary | share | home.
  if (!home && share) {
    addActionButton(root, '分享成绩', -180, '#CF7A19', share);
    addActionButton(root, options.primaryLabel ?? '再玩一次', 177, '#18965F', replay);
  } else {
    addActionButton(root, options.primaryLabel ?? '再玩一次', -180, '#18965F', replay);
    if (share) addActionButton(root, '分享成绩', -1.5, '#CF7A19', share);
    if (home) addActionButton(root, options.homeLabel ?? '返回首页', 177, '#3474B6', home);
  }
  if (typeof document !== 'undefined') {
    if (share) document.body.dataset.resultShare = '1';
    else delete document.body.dataset.resultShare;
  }
}

export function buildTreasureResult(
  artworkRoot: Node,
  actionRoot: Node,
  result: GameResult,
  assets: ThemeAssets,
  title: string,
  replay: () => void,
  home: (() => void) | null,
  share: (() => boolean | Promise<boolean>) | undefined,
  options: ResultViewOptions,
): Node {
  if (result.reason !== 'completed') {
    const resultTitle = createLabel(artworkRoot, title, {
      size: 32, width: 400, height: 60, bold: true,
    });
    resultTitle.node.name = 'TreasureResultTitle';
    resultTitle.node.setPosition(0, 365);
  }

  addTreasureResultContent(artworkRoot, result, assets, artworkRoot);
  const scoreArtwork = addScore(artworkRoot, result, assets);
  addActions(actionRoot, replay, home, share, options);
  return scoreArtwork;
}
