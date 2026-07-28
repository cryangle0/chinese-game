import { spriteLoader } from './SpriteLoader';
import { preloadMotion } from '../media/DomMotionPrefetch';
import { GameTheme, IntroTheme } from '../../shared/types/Theme';

function values(source: unknown): string[] {
  if (typeof source === 'string') return [source];
  if (!source || typeof source !== 'object') return [];
  return Object.values(source).flatMap(values);
}

export function introAssetPaths(theme: IntroTheme): string[] {
  return values(theme).filter(Boolean);
}

export function themeAssetPaths(theme: GameTheme): string[] {
  const { motion: _motion, ...spriteAssets } = theme.assets;
  return values(spriteAssets).filter(Boolean);
}

function resultAssetPaths(theme: GameTheme): string[] {
  return Object.entries(theme.assets)
    .filter(([key]) => key.startsWith('result'))
    .flatMap(([, value]) => values(value))
    .filter(Boolean);
}

export function preloadTheme(theme?: GameTheme): Promise<void> {
  return theme ? spriteLoader.preload(themeAssetPaths(theme)) : Promise.resolve();
}

export function preloadIntro(theme: IntroTheme): Promise<void> {
  // The DOM startup cover stays visible until every intro request settles.
  // SpriteLoader is non-strict here so a failed optional texture still reaches
  // the in-game error/fallback path instead of leaving the cover up forever.
  return spriteLoader.preload(introAssetPaths(theme), false);
}

export function preloadCriticalTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  const deferred = new Set([
    theme.assets.feedbackCorrect,
    theme.assets.feedbackWrong,
    theme.assets.successState,
    theme.assets.failState,
    ...resultAssetPaths(theme),
  ]);
  return spriteLoader.preload(
    themeAssetPaths(theme).filter((path) => !deferred.has(path)),
    true,
  );
}

export function preloadPlayableTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  const motion = theme.assets.motion;
  return Promise.all([
    preloadCriticalTheme(theme),
    preloadMotion(
      motion?.idle,
      motion?.action,
      motion?.runLeft,
      motion?.runRight,
      motion?.correct,
      motion?.wrong,
    ),
  ]).then(() => undefined);
}

export function preloadPlayableThemeWhenIdle(theme?: GameTheme): void {
  if (!theme) return;
  const preload = () => { void preloadPlayableTheme(theme); };
  if (typeof window === 'undefined') {
    preload();
    return;
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preload, { timeout: 1500 });
    return;
  }
  setTimeout(preload, 500);
}

export function retainThemes(themes: readonly (GameTheme | undefined)[]): void {
  spriteLoader.retainOnly(themes.flatMap((theme) => theme ? themeAssetPaths(theme) : []));
}

export function retainIntro(theme: IntroTheme): void {
  spriteLoader.retainOnly(introAssetPaths(theme));
}

export function retainIntroAndThemes(
  intro: IntroTheme,
  themes: readonly (GameTheme | undefined)[],
): void {
  spriteLoader.retainOnly([
    ...introAssetPaths(intro),
    ...themes.flatMap((theme) => theme ? themeAssetPaths(theme) : []),
  ]);
}
