import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { color, motion, type } from '../tokens';
import type { Layout } from '../layout';

const ease = Easing.bezier(...motion.ease);

/**
 * Sits inside the safe area, bottom-left. Wipes in from the accent bar rather
 * than sliding the whole block, so it reads as an annotation on the footage
 * instead of a card floating over it.
 */
export const LowerThird: React.FC<{
  title: string;
  detail?: string;
  layout: Layout;
  durationInFrames: number;
}> = ({ title, detail, layout, durationInFrames }) => {
  const frame = useCurrentFrame();

  const inProgress = interpolate(frame, [0, motion.enter], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });
  const outProgress = interpolate(
    frame,
    [durationInFrames - motion.exit, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease },
  );
  const visible = Math.min(inProgress, outProgress);

  return (
    <div
      style={{
        position: 'absolute',
        left: layout.safe.left,
        bottom: layout.safe.bottom,
        display: 'flex',
        alignItems: 'stretch',
        gap: 20 * layout.scale,
        opacity: visible,
        transform: `translateY(${(1 - visible) * 16 * layout.scale}px)`,
        fontFamily: type.fontFamily,
      }}
    >
      <div
        style={{
          width: 8 * layout.scale,
          borderRadius: 4 * layout.scale,
          backgroundColor: color.accent,
          transformOrigin: 'bottom',
          transform: `scaleY(${inProgress})`,
        }}
      />
      <div
        style={{
          backgroundColor: color.paper,
          borderRadius: 14 * layout.scale,
          padding: `${20 * layout.scale}px ${28 * layout.scale}px`,
          boxShadow: `0 ${10 * layout.scale}px ${40 * layout.scale}px rgba(13,13,18,0.18)`,
        }}
      >
        <div
          style={{
            fontSize: type.body * layout.scale,
            fontWeight: type.weightBold,
            letterSpacing: type.letterSpacingTight,
            color: color.ink,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {detail ? (
          <div
            style={{
              marginTop: 8 * layout.scale,
              fontSize: type.body * 0.72 * layout.scale,
              fontWeight: type.weightRegular,
              color: color.inkMuted,
              lineHeight: 1.3,
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
};
