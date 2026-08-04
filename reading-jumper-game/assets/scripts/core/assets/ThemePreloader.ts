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

function unique(paths: readonly string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

export function startupThemeAssetPaths(theme: GameTheme): string[] {
  const deferredKeys = new Set([
    'motion',
    'characterAction',
    'characterIdleAnimation',
    'characterActionAnimation',
    'characterRunLeftAnimation',
    'characterRunRightAnimation',
    'feedbackCorrect',
    'feedbackWrong',
    'successState',
    'failState',
  ]);
  return unique(
    Object.entries(theme.assets)
      .filter(([key]) => !deferredKeys.has(key) && !key.startsWith('result'))
      .flatMap(([, value]) => values(value)),
  );
}

export function playThemeAssetPaths(theme: GameTheme): string[] {
  return unique(values([
    theme.assets.characterAction,
    theme.assets.characterIdleAnimation,
    theme.assets.characterActionAnimation,
    theme.assets.characterRunLeftAnimation,
    theme.assets.characterRunRightAnimation,
  ]));
}

export function feedbackThemeAssetPaths(theme: GameTheme): string[] {
  return unique([
    ...values([
      theme.assets.feedbackCorrect,
      theme.assets.feedbackWrong,
      theme.assets.successState,
      theme.assets.failState,
    ]),
    ...resultAssetPaths(theme),
  ]);
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
  return preloadStartupTheme(theme);
}

export function preloadStartupTheme(theme?: GameTheme): Promise<void> {
  return theme
    ? spriteLoader.preload(startupThemeAssetPaths(theme), true)
    : Promise.resolve();
}

export function preloadPlayTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  const motion = theme.assets.motion;
  return Promise.all([
    spriteLoader.preload(playThemeAssetPaths(theme), false),
    preloadMotion(motion?.action),
  ]).then(() => undefined);
}

export function preloadFeedbackTheme(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  const motion = theme.assets.motion;
  return Promise.all([
    spriteLoader.preload(feedbackThemeAssetPaths(theme), false),
    preloadMotion(motion?.correct, motion?.wrong, motion?.result, motion?.transition),
  ]).then(() => undefined);
}

export function preloadPlayableTheme(theme?: GameTheme): Promise<void> {
  return Promise.all([
    preloadStartupTheme(theme),
    preloadPlayTheme(theme),
    preloadFeedbackTheme(theme),
  ]).then(() => undefined);
}

function scheduleIdle(preload: () => void, timeout: number): void {
  if (typeof window === 'undefined') {
    preload();
    return;
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preload, { timeout });
    return;
  }
  window.setTimeout(preload, Math.min(timeout, 800));
}

function idleSlice(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 1200 });
    } else {
      window.setTimeout(resolve, 16);
    }
  });
}

async function preloadStartupThemeInIdleSlices(theme: GameTheme): Promise<void> {
  for (const path of startupThemeAssetPaths(theme)) {
    await spriteLoader.preload([path], false);
    await idleSlice();
  }
}

export function preloadStartupThemeWhenIdle(theme?: GameTheme): void {
  if (!theme) return;
  scheduleIdle(() => { void preloadStartupThemeInIdleSlices(theme); }, 6000);
}

export function preloadFeedbackThemeWhenIdle(theme?: GameTheme): void {
  if (!theme) return;
  scheduleIdle(() => { void preloadFeedbackTheme(theme); }, 1800);
}

export function preloadStartupThemeAfterFirstPaint(theme?: GameTheme): Promise<void> {
  if (!theme) return Promise.resolve();
  if (typeof window === 'undefined') return preloadStartupTheme(theme);
  return new Promise((resolve, reject) => {
    const preload = () => {
      void preloadStartupTheme(theme).then(resolve, reject);
    };
    const scheduleIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(preload, { timeout: 1200 });
      } else {
        window.setTimeout(preload, 260);
      }
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(scheduleIdle));
  });
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
