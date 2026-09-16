import React from 'react';
import { Composition } from 'remotion';
import { Episode, episodeDurationInFrames } from './compositions/Episode';
import { FORMATS, FPS } from './tokens';
import { ep01 } from './episodes/ep01-youtube-to-notes';
import type { EpisodeProps } from './types';

/**
 * Two compositions, one episode. `Episode` is the YouTube cut; `Clip` is the
 * same content reframed for LinkedIn. Nothing is edited twice -- change the
 * episode file and both outputs follow.
 */
export const RemotionRoot: React.FC = () => {
  const duration = episodeDurationInFrames(ep01.footageDurationInSeconds, FPS);

  return (
    <>
      <Composition
        id="Episode"
        component={Episode}
        durationInFrames={duration}
        fps={FPS}
        width={FORMATS.episode.width}
        height={FORMATS.episode.height}
        defaultProps={{ ...ep01, format: 'episode' } satisfies EpisodeProps}
      />
      <Composition
        id="Clip"
        component={Episode}
        durationInFrames={duration}
        fps={FPS}
        width={FORMATS.clip.width}
        height={FORMATS.clip.height}
        defaultProps={{ ...ep01, format: 'clip' } satisfies EpisodeProps}
      />
    </>
  );
};
