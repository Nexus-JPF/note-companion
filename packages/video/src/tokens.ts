/**
 * The video kit's entire design system. Ten decisions, made once.
 *
 * These are deliberately copied rather than imported from the landing package.
 * A video render should not break because a CSS variable moved. If these drift
 * from `packages/landing/app/globals.css`, that is a signal worth acting on,
 * not a bug to paper over with a shared package.
 */

export const color = {
  /**
   * Tailwind violet-600. Already the most-used accent in the web dashboard
   * (50 usages) and 7 degrees from the #7852ee declared on the landing page --
   * visually identical, and a stock value rather than a bespoke one.
   *
   * demo-vault/.obsidian/appearance.json pins Obsidian's accent to this same
   * value, so the captured footage and the wrapper around it match.
   */
  accent: '#7c3aed',
  accentSoft: '#ede9fe',
  accentDeep: '#5b21b6',

  ink: '#0d0d12',
  inkMuted: '#5c5c6b',
  paper: '#ffffff',
  paperWarm: '#faf9fb',

  /** Captions burn in over footage, so they carry their own contrast. */
  captionBg: 'rgba(13, 13, 18, 0.88)',
  captionText: '#ffffff',
} as const;

/**
 * Three sizes, not a scale. Screen-reading type scales are useless here --
 * what matters is legibility at phone size after a downscale to 1080p.
 * Values are px at 1920x1080 and scale linearly with the canvas.
 */
export const type = {
  display: 96,
  heading: 56,
  body: 34,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif',
  weightBold: 700,
  weightRegular: 450,
  letterSpacingTight: '-0.02em',
} as const;

/**
 * One easing curve for everything, lifted from the landing page's
 * `hero-fade-up` (packages/landing/tailwind.config.ts). Reusing it is why the
 * videos feel like the site rather than merely sharing its colour.
 */
export const motion = {
  ease: [0.22, 1, 0.36, 1] as const,
  /** Frames at 30fps. Named by intent so episode props never hardcode numbers. */
  enter: 11,
  exit: 9,
  titleHold: 60,
  endCardHold: 90,
  lowerThirdHold: 120,
} as const;

/**
 * Height reserved above the bottom safe inset for a lower third, in px at
 * 1920x1080. Captions always clear it, whether or not one is on screen --
 * a caption that jumps position between lines is harder to read than one
 * sitting slightly higher than it strictly needs to.
 */
export const CAPTION_LIFT = 152;

export const FPS = 30;

/**
 * Both share the 16:9 shape of the 1536x864 window that
 * scripts/demo-recording/set-window.sh pins, so footage never letterboxes.
 *
 * Capture at Retina: 1536x864 records at 3072x1728, which downsamples into
 * 1080p. Capturing at 1x instead would mean upscaling by 1.25x, which is
 * pixel-aligned but visibly softer.
 */
export const FORMATS = {
  episode: { width: 1920, height: 1080 },
  clip: { width: 1080, height: 1920 },
} as const;

/**
 * Where text is allowed to live. The vertical format's generous bottom inset
 * keeps captions clear of platform UI -- LinkedIn, Reels and Shorts all
 * overlay the lower ~14% with controls and author chrome.
 */
export const safeArea = {
  episode: { top: 0.06, bottom: 0.08, left: 0.06, right: 0.06 },
  clip: { top: 0.12, bottom: 0.16, left: 0.07, right: 0.07 },
} as const;

/**
 * Horizontal focus positions for the vertical crop, as a fraction of the
 * 1536px-wide capture. Both measured off public/ep01.mp4; see Screen.tsx for
 * the method and re-measure if the window or sidebar width changes.
 *
 * A 1080x1920 frame shows 486px of source width.
 *
 * - panel  0.80 -> shows 986..1472. The Note Companion panel's content runs
 *   996..1457, so it fits with ~12px each side.
 * - editor 0.40 -> shows 371..857. The note text runs 376..929, wider than
 *   the frame, so this is biased left: line starts and the heading stay
 *   readable and the ragged right edge is what gets clipped. The viewer needs
 *   to see that a note filled with structured markdown exists, not to read it.
 */
export const FOCUS = {
  panel: 0.8,
  editor: 0.4,
} as const;

export type FormatName = keyof typeof FORMATS;
