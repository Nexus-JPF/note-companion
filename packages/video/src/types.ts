import type { FormatName } from './tokens';

/** A burned-in caption. Times are seconds from the start of the composition. */
export type Cue = {
  from: number;
  to: number;
  text: string;
};

/**
 * Where the vertical crop should be looking, over time. Values between cues
 * are interpolated, so two cues with the same x hold still and a pair with
 * different x pans between them. Ignored by the 16:9 format, which shows the
 * whole frame anyway.
 */
export type FocusCue = {
  /** Seconds from the start of the footage. */
  at: number;
  /** 0 = crop to the left edge of the capture, 1 = the right edge. */
  x: number;
};

/** A labelled moment -- what the viewer is looking at right now. */
export type LowerThirdCue = {
  at: number;
  /** Seconds. Defaults to motion.lowerThirdHold. */
  duration?: number;
  title: string;
  detail?: string;
};

export type EpisodeProps = {
  format: FormatName;
  /** Shown full-frame before the footage. */
  title: string;
  subtitle?: string;
  /**
   * Path to the captured screen recording, relative to public/.
   * Leave undefined to render the wrapper with a capture-spec placeholder --
   * useful for building an episode before it has been shot.
   */
  footage?: string;
  /** Seconds of footage to show. Required when footage is undefined. */
  footageDurationInSeconds: number;
  captions: Cue[];
  lowerThirds: LowerThirdCue[];
  /**
   * Optional camera move for the vertical cut. Omit to hold on FOCUS.panel
   * for the whole episode.
   */
  focus?: FocusCue[];
  endCard: {
    headline: string;
    url: string;
  };
};
