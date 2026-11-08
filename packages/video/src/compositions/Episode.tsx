import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { color, FOCUS, motion } from '../tokens';
import { getLayout } from '../layout';
import { TitleCard } from '../components/TitleCard';
import { LowerThird } from '../components/LowerThird';
import { Captions } from '../components/Captions';
import { EndCard } from '../components/EndCard';
import { Screen } from '../components/Screen';
import type { EpisodeProps } from '../types';

/**
 * One composition drives both formats. Everything format-specific lives in
 * `getLayout`, so a vertical cut is the same episode with a different `format`
 * prop -- never a second edit to keep in sync.
 */
export const Episode: React.FC<EpisodeProps> = ({
  format,
  title,
  subtitle,
  footage,
  footageDurationInSeconds,
  captions,
  lowerThirds,
  focus,
  music,
  sfx,
  endCard,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const layout = getLayout(format);

  const titleFrames = motion.titleHold;
  const footageFrames = Math.round(footageDurationInSeconds * fps);
  const endFrames = motion.endCardHold;

  return (
    <AbsoluteFill style={{ backgroundColor: color.paper }}>
      {music ? (
        <Audio
          src={staticFile(music.file)}
          loop
          volume={(f) =>
            // One second in, two seconds out, so the bed never starts or stops
            // with a click.
            interpolate(
              f,
              [0, fps, durationInFrames - 2 * fps, durationInFrames],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            ) * (music.volume ?? 0.12)
          }
        />
      ) : null}

      {(sfx ?? []).map((cue, i) => (
        <Sequence
          key={`${cue.file}-${i}`}
          from={Math.max(0, titleFrames + Math.round(cue.at * fps))}
        >
          <Audio src={staticFile(cue.file)} volume={cue.volume ?? 0.4} />
        </Sequence>
      ))}

      <Sequence durationInFrames={titleFrames}>
        <TitleCard
          title={title}
          subtitle={subtitle}
          layout={layout}
          durationInFrames={titleFrames}
        />
      </Sequence>

      <Sequence from={titleFrames} durationInFrames={footageFrames}>
        <Screen
          src={footage}
          layout={layout}
          // 16:9 shows the whole frame, so a camera move would be a no-op.
          focus={format === 'clip' ? focus ?? FOCUS.panel : 0.5}
        />

        {lowerThirds.map((cue, i) => {
          const hold = Math.round((cue.duration ?? motion.lowerThirdHold / fps) * fps);
          return (
            <Sequence
              key={`${cue.title}-${i}`}
              from={Math.round(cue.at * fps)}
              durationInFrames={hold}
            >
              <LowerThird
                title={cue.title}
                detail={cue.detail}
                layout={layout}
                durationInFrames={hold}
              />
            </Sequence>
          );
        })}

        <Captions cues={captions} layout={layout} />
      </Sequence>

      <Sequence from={titleFrames + footageFrames} durationInFrames={endFrames}>
        <EndCard headline={endCard.headline} url={endCard.url} layout={layout} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Total length of an episode, so Root can size the composition. */
export const episodeDurationInFrames = (
  footageDurationInSeconds: number,
  fps: number,
): number =>
  motion.titleHold +
  Math.round(footageDurationInSeconds * fps) +
  motion.endCardHold;
