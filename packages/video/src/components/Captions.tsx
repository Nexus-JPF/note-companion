import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTION_LIFT, color, type } from '../tokens';
import type { Layout } from '../layout';
import type { Cue } from '../types';

/**
 * Burned in, because most feed views are muted. Positioned above the bottom
 * safe inset rather than at the very bottom -- on vertical that inset is where
 * platform chrome lives.
 */
export const Captions: React.FC<{
  cues: Cue[];
  layout: Layout;
}> = ({ cues, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const active = cues.find((c) => seconds >= c.from && seconds < c.to);
  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: layout.safe.left,
        right: layout.safe.right,
        bottom: layout.safe.bottom + CAPTION_LIFT * layout.scale,
        display: 'flex',
        justifyContent: 'center',
        fontFamily: type.fontFamily,
      }}
    >
      <span
        style={{
          backgroundColor: color.captionBg,
          color: color.captionText,
          fontSize: type.body * layout.scale,
          fontWeight: type.weightBold,
          lineHeight: 1.3,
          letterSpacing: type.letterSpacingTight,
          padding: `${14 * layout.scale}px ${24 * layout.scale}px`,
          borderRadius: 12 * layout.scale,
          textAlign: 'center',
          textWrap: 'balance',
        }}
      >
        {active.text}
      </span>
    </div>
  );
};
