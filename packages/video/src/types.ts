import type { FormatName } from './tokens';

/** A burned-in caption. Times are seconds from the start of the composition. */
export type Cue = {
  from: number;
  to: number;
  text: string;
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
  endCard: {
    headline: string;
    url: string;
  };
};
