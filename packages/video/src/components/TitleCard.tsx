import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { color, motion, type } from '../tokens';
import type { Layout } from '../layout';

const ease = Easing.bezier(...motion.ease);

export const TitleCard: React.FC<{
  title: string;
  subtitle?: string;
  layout: Layout;
  durationInFrames: number;
}> = ({ title, subtitle, layout, durationInFrames }) => {
  const frame = useCurrentFrame();

  const rise = (delay: number) =>
    interpolate(frame - delay, [0, motion.enter], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: ease,
    });

  const out = interpolate(
    frame,
    [durationInFrames - motion.exit, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease },
  );

  const titleIn = rise(0);
  const subIn = rise(5);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.paper,
        justifyContent: 'center',
        paddingLeft: layout.safe.left,
        paddingRight: layout.safe.right,
        opacity: out,
        fontFamily: type.fontFamily,
      }}
    >
      {/* Accent rule, drawn rather than faded, so the eye has something to follow in. */}
      <div
        style={{
          width: 120 * layout.scale * titleIn,
          height: 8 * layout.scale,
          borderRadius: 4 * layout.scale,
          backgroundColor: color.accent,
          marginBottom: 40 * layout.scale,
        }}
      />
      <h1
        style={{
          margin: 0,
          fontSize: type.display * layout.scale,
          lineHeight: 1.05,
          fontWeight: type.weightBold,
          letterSpacing: type.letterSpacingTight,
          color: color.ink,
          whiteSpace: 'pre-line',
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 24 * layout.scale}px)`,
        }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          style={{
            margin: `${28 * layout.scale}px 0 0`,
            fontSize: type.body * layout.scale,
            lineHeight: 1.35,
            fontWeight: type.weightRegular,
            color: color.inkMuted,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 24 * layout.scale}px)`,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </AbsoluteFill>
  );
};
