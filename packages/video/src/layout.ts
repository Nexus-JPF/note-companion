import { FORMATS, safeArea, type FormatName } from './tokens';

export type Layout = {
  width: number;
  height: number;
  /** Multiply every px value in tokens.ts by this. */
  scale: number;
  /** Inset in px on each edge. Nothing readable should sit outside it. */
  safe: { top: number; bottom: number; left: number; right: number };
};

/**
 * Vertical is not just a narrower crop. Text has to hold up at phone size in a
 * scrolling feed, so type runs larger relative to the frame than it does on a
 * 16:9 canvas someone is actually watching.
 */
const TYPE_BOOST: Record<FormatName, number> = {
  episode: 1,
  clip: 1.55,
};

export const getLayout = (format: FormatName): Layout => {
  const { width, height } = FORMATS[format];
  const inset = safeArea[format];
  return {
    width,
    height,
    scale: (width / FORMATS.episode.width) * TYPE_BOOST[format],
    safe: {
      top: Math.round(height * inset.top),
      bottom: Math.round(height * inset.bottom),
      left: Math.round(width * inset.left),
      right: Math.round(width * inset.right),
    },
  };
};
