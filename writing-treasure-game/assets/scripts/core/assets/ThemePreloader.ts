import { spriteLoader } from './SpriteLoader';
import { GameTheme, IntroTheme } from '../../shared/types/Theme';

function values(source: object): string[] {
  return Object.values(source).flatMap((value) =>
    Array.isArray(value) ? value : typeof value === 'string' ? [value] : []);
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
    .flatMap(([, value]) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
    .filter(Boolean);
}

function deferredThemeAssetPaths(theme: GameTheme): Set<string | undefined> {
  return new Set([
    theme.assets.feedbackCorrect,
    theme.assets.feedbackWrong,
    theme.assets.voiceIdle,
    theme.assets.voiceListening,
    theme.assets.successState,
    ...(theme.assets.successStates ?? []),
    theme.assets.failState,
    ...(theme.assets.failStates ?? []),
    ...resultAssetPaths(theme),
  ]);
}

function preloadWithout(
  theme: GameTheme | undefined,
  deferred: ReadonlySet<string | undefined>,
): Promise<void> {
  if (!theme) return Promise.resolve();
  return spriteLoader.preload(
    themeAssetPaths(theme).filter((path) => !deferred.has(path)),
    true,
  );
}

export function preloadTheme(theme?: GameTheme): Promise<void> {
  return theme ? spriteLoader.preload(themeAssetPaths(theme)) : Promise.resolve();
}

export function preloadIntro(theme: IntroTheme): Promise<void> {
  // Non-strict + time budget: never block first paint on a slow CDN texture.
  return Promise.race([
    spriteLoader.preload(introAssetPaths(theme), false),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1800);
    }),
  ]);
}

export function preloadCriticalTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  return preloadWithout(theme, deferredThemeAssetPaths(theme));
}

export function preloadInitialTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  const deferred = deferredThemeAssetPaths(theme);
  theme.assets.choices?.forEach((path) => deferred.add(path));
  return preloadWithout(theme, deferred);
}

export function retainThemes(themes: readonly (GameTheme | undefined)[]): void {
  spriteLoader.retainOnly(themes.flatMap((theme) => theme ? themeAssetPaths(theme) : []));
}

export function retainIntro(theme: IntroTheme): void {
  spriteLoader.retainOnly(introAssetPaths(theme));
}
