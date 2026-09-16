import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { color, motion, type } from '../tokens';
import type { Layout } from '../layout';

const ease = Easing.bezier(...motion.ease);

export const EndCard: React.FC<{
  headline: string;
  url: string;
  layout: Layout;
}> = ({ headline, url, layout }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, motion.enter], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.ink,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: layout.safe.left,
        paddingRight: layout.safe.right,
        textAlign: 'center',
        fontFamily: type.fontFamily,
      }}
    >
      <div
        style={{
          opacity: appear,
          transform: `translateY(${(1 - appear) * 20 * layout.scale}px)`,
        }}
      >
        <div
          style={{
            fontSize: type.heading * layout.scale,
            fontWeight: type.weightBold,
            letterSpacing: type.letterSpacingTight,
            color: color.paper,
            lineHeight: 1.15,
            whiteSpace: 'pre-line',
          }}
        >
          {headline}
        </div>
        <div
          style={{
            marginTop: 36 * layout.scale,
            display: 'inline-block',
            fontSize: type.body * layout.scale,
            fontWeight: type.weightBold,
            color: color.paper,
            backgroundColor: color.accent,
            padding: `${18 * layout.scale}px ${40 * layout.scale}px`,
            borderRadius: 999,
          }}
        >
          {url}
        </div>
      </div>
    </AbsoluteFill>
  );
};
