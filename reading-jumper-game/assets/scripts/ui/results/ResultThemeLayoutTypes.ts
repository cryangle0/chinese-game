export interface ResultThemeLayout {
  readonly motion: {
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
  };
  readonly text: {
    readonly heading: string;
    readonly headingOutline: string;
    readonly rank: string;
    readonly rankOutline: string;
    readonly reviewCorrect: string;
    readonly reviewWrong: string;
    readonly scoreOutline: string;
  };
  readonly score?: {
    readonly x: number;
    readonly y: number;
    /** Appended after score; use '' when plaque already has「分」. Default「分」. */
    readonly suffix?: string;
  };
  readonly summary?: {
    readonly x: number;
    readonly captionY: number;
    readonly scoreY: number;
    readonly captionColor: string;
    readonly scoreColor: string;
  };
  readonly stars: readonly {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
  readonly headingSize: { readonly width: number; readonly height: number };
  readonly rank: {
    readonly titleX: number;
    readonly x: number;
    readonly titleY: number;
    readonly titleSize?: { readonly width: number; readonly height: number };
    readonly rows: readonly [number, number, number];
    readonly width: number;
    readonly rowHeight: number;
    readonly nameX: number;
    readonly scoreX: number;
    /** 背景已烘焙排行条/奖牌时只叠文字，不画白条 */
    readonly hidePanel?: boolean;
  };
  readonly review: {
    readonly x: number;
    readonly titleY: number;
    readonly titleSize?: { readonly width: number; readonly height: number };
    readonly subtitleY: number;
    readonly textX: number;
    readonly iconX: number;
    readonly iconSize: number;
    readonly rows: readonly [number, number, number, number, number];
    readonly width: number;
    readonly textHeight: number;
  };
}
