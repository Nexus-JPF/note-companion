import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { color, FOCUS, motion, type } from '../tokens';
import type { Layout } from '../layout';
import type { FocusCue } from '../types';

/**
 * Wraps the hand-captured screen recording.
 *
 * `set-window.sh` pins Obsidian to 1536x864, which is exactly 16:9, so on the
 * episode format the footage fills the frame with nothing to decide. On the
 * vertical format it has to be cropped, and the crop is the whole game: the
 * Note Companion panel lives in the right ~32% of the Obsidian window, so the
 * default focus is right-biased rather than centred. Centring a 16:9 Obsidian
 * capture in a 9:16 frame shows the file tree and cuts off the product.
 *
 * 0.80 is measured off the real capture, not guessed. Scaling 1536x864 to
 * fill a 1080x1920 frame shows 486px of source width. The panel's chrome runs
 * x=971..1524, which is wider than that, but its *content* only spans
 * x=996..1457 (461px) -- the tab bar is the widest row. Centring on that
 * content, 1226/1536, leaves roughly 12px of margin each side and clips only
 * the panel's own padding.
 *
 * Measure again if the window size or the sidebar width changes; the number
 * is specific to a 1536x864 capture with the layout committed in
 * demo-vault/.obsidian/workspace.json.
 */
const ease = Easing.bezier(...motion.ease);

export const Screen: React.FC<{
  src?: string;
  layout: Layout;
  /** A fixed position, or a track to pan along. 0 = left edge, 1 = right. */
  focus?: number | FocusCue[];
}> = ({ src, layout, focus = FOCUS.panel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // A single value holds still; a track pans. Two cues sharing an x hold, so
  // a move is just a pair that differ -- no separate "hold" concept needed.
  let focusX: number;
  if (typeof focus === 'number') {
    focusX = focus;
  } else if (focus.length === 0) {
    focusX = FOCUS.panel;
  } else if (focus.length === 1) {
    focusX = focus[0].x;
  } else {
    focusX = interpolate(
      frame / fps,
      focus.map((c) => c.at),
      focus.map((c) => c.x),
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease },
    );
  }

  if (!src) {
    return <CaptureSpec layout={layout} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: color.ink, overflow: 'hidden' }}>
      <OffthreadVideo
        src={src.startsWith('http') ? src : staticFile(src)}
        style={{
          position: 'absolute',
          height: '100%',
          width: 'auto',
          minWidth: '100%',
          left: '50%',
          top: 0,
          // Slide the over-wide footage so `focusX` of it sits at frame centre.
          transform: `translateX(${-focusX * 100}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Stands in for footage that has not been shot yet, so an episode can be built,
 * reviewed and timed before anyone opens a screen recorder. It prints the spec
 * the capture has to meet.
 */
const CaptureSpec: React.FC<{ layout: Layout }> = ({ layout }) => (
  <AbsoluteFill
    style={{
      backgroundColor: color.paperWarm,
      alignItems: 'center',
      justifyContent: 'center',
      padding: layout.safe.left,
      fontFamily: type.fontFamily,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        border: `${3 * layout.scale}px dashed ${color.accent}`,
        borderRadius: 20 * layout.scale,
        padding: `${48 * layout.scale}px ${56 * layout.scale}px`,
        maxWidth: '86%',
      }}
    >
      <div
        style={{
          fontSize: type.heading * layout.scale,
          fontWeight: type.weightBold,
          color: color.accentDeep,
          letterSpacing: type.letterSpacingTight,
        }}
      >
        Footage goes here
      </div>
      <div
        style={{
          marginTop: 24 * layout.scale,
          fontSize: type.body * 0.82 * layout.scale,
          lineHeight: 1.5,
          color: color.inkMuted,
        }}
      >
        Record demo-vault/ at 1536&times;864
        <br />
        ./scripts/demo-recording/set-window.sh
        <br />
        Drop the file in packages/video/public/
      </div>
    </div>
  </AbsoluteFill>
);
