export interface ResultViewOptions {
  readonly title?: string;
  readonly primaryLabel?: string;
  readonly homeLabel?: string;
  readonly primaryOnly?: boolean;
  /** Stage settlement uses 100; the five-scene campaign result uses 500. */
  readonly rankingMaxScore?: number;
}
