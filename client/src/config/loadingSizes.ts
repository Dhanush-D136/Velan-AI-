export type LeafSizeVariant = 'full' | 'inpage' | 'compact';

export const LEAF_DESIGN = {
  width: 340,
  height: 106,
  spreadWidth: 636, // boxWidth / 636 -> --s scale factor
  availTextWidth: 250,
  baseFontSize: 13.5,
} as const;

export const LOADING_SIZES = {
  full: {
    desktopBoxPx: 290, // leaf ~155px wide
    mobileBoxPx: 230,  // leaf ~123px wide (64% of 360px screen)
  },
  inpage: {
    desktopBoxPx: 200, // leaf ~107px wide
    mobileBoxPx: 170,  // leaf ~91px wide
  },
  compact: {
    desktopBoxPx: 130,
    mobileBoxPx: 130,
  },
  maxViewportFraction: 0.72, // never wider than 72% on 360px phones
} as const;

export const LOADING_TIMING = {
  delayBeforeShowMs: 200,
  topLineThresholdMs: 200,
  fullOrInlineThresholdMs: 1000,
  minDisplayMs: 600,
  fadeOutMs: 250,
  stageCrossFadeMs: 200,
  healthSlowMs: 3000,
  errorTimeoutMs: 30000,
} as const;
