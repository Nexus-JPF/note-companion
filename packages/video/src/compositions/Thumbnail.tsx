import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { color, type } from '../tokens';

/** How far into the shot to zoom. Above 100 so `shotFocus` has room to move. */
const ZOOM = 155;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * A YouTube thumbnail, rendered with `remotion still` so it uses the same
 * accent, type and radii as the video itself.
 *
 * Designed for the size it is actually seen at. In search and suggested
 * feeds a thumbnail is roughly 210px wide -- a sixth of its 1280px canvas --
 * so the headline is deliberately three or four words at a size that looks
 * absurd full-size and is merely legible small. Anything smaller than
 * `type.display` here disappears.
 *
 * The screenshot is a supporting texture, not the subject: cropped to one
 * recognisable region and dimmed, because a full window at 210px is noise.
 */
export type ThumbnailProps = {
  /** Three or four words. Line breaks are respected. */
  headline: string;
  /** One short line under the rule. Optional. */
  kicker?: string;
  /** A file in public/. Cropped by `shotFocus`. */
  shot?: string;
  /** 0..1 -- which part of the screenshot to show. */
  shotFocusX?: number;
  shotFocusY?: number;
  /** Swap the ink/paper relationship. */
  dark?: boolean;
};

export const Thumbnail: React.FC<ThumbnailProps> = ({
  headline,
  kicker,
  shot,
  shotFocusX = 0.5,
  shotFocusY = 0.5,
  dark = false,
}) => {
  const bg = dark ? color.ink : color.paper;
  const fg = dark ? color.paper : color.ink;
  const muted = dark ? 'rgba(255,255,255,0.62)' : color.inkMuted;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: type.fontFamily }}>
      {shot ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={staticFile(shot)}
            style={{
              position: 'absolute',
              width: `${ZOOM}%`,
              // Centre `shotFocusX` of the shot in the frame, but never past
              // the point where the zoomed image stops covering it -- focusing
              // near an edge would otherwise leave background showing.
              left: `${clamp(50 - shotFocusX * ZOOM, 100 - ZOOM, 0)}%`,
              top: `${clamp(50 - shotFocusY * 100, -40, 0)}%`,
              opacity: dark ? 0.3 : 0.42,
            }}
          />
          {/* Fade the shot out under the text so the headline never fights it. */}
          <AbsoluteFill
            style={{
              background: dark
                ? `linear-gradient(100deg, ${color.ink} 30%, rgba(13,13,18,0.92) 55%, rgba(13,13,18,0.66) 100%)`
                : `linear-gradient(100deg, ${color.paper} 30%, rgba(255,255,255,0.93) 55%, rgba(255,255,255,0.7) 100%)`,
            }}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill
        style={{ justifyContent: 'center', paddingLeft: 88, paddingRight: 88 }}
      >
        <div
          style={{
            width: 148,
            height: 14,
            borderRadius: 7,
            backgroundColor: color.accent,
            marginBottom: 40,
          }}
        />
        <div
          style={{
            fontSize: 136,
            lineHeight: 1.02,
            fontWeight: type.weightBold,
            letterSpacing: '-0.035em',
            color: fg,
            whiteSpace: 'pre-line',
            maxWidth: '78%',
          }}
        >
          {headline}
        </div>
        {kicker ? (
          <div
            style={{
              marginTop: 34,
              fontSize: 46,
              fontWeight: type.weightBold,
              color: muted,
              letterSpacing: '-0.01em',
            }}
          >
            {kicker}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
