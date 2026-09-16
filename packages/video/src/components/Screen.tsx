import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { color, type } from '../tokens';
import type { Layout } from '../layout';

/**
 * Wraps the hand-captured screen recording.
 *
 * `set-window.sh` pins Obsidian to 1536x864, which is exactly 16:9, so on the
 * episode format the footage fills the frame with nothing to decide. On the
 * vertical format it has to be cropped, and the crop is the whole game: the
 * Note Companion panel lives in the right ~32% of the Obsidian window, so the
 * default focus is right-biased rather than centred. Centring a 16:9 Obsidian
 * capture in a 9:16 frame shows the file tree and cuts off the product.
 */
export const Screen: React.FC<{
  src?: string;
  layout: Layout;
  /** 0 = crop to left edge, 1 = crop to right edge. */
  focusX?: number;
}> = ({ src, layout, focusX = 0.78 }) => {
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
