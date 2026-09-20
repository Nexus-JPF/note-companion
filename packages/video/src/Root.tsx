import React from 'react';
import { Composition } from 'remotion';
import { Episode, episodeDurationInFrames } from './compositions/Episode';
import { Thumbnail } from './compositions/Thumbnail';
import type { ThumbnailProps } from './compositions/Thumbnail';
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
      {/*
        YouTube thumbnails, rendered with `remotion still`. Three variants of
        the same composition so they can be compared at the size they are
        actually seen rather than argued about in the abstract.
      */}
      <Composition
        id="ThumbA"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'Any video.\nOne note.',
          kicker: 'Note Companion for Obsidian',
          shot: 'shot-note.png',
          shotFocusX: 0.42,
          shotFocusY: 0.5,
        } satisfies ThumbnailProps}
      />
      <Composition
        id="ThumbB"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'YouTube\n\u2192 Obsidian',
          kicker: 'Summarised, tagged, filed',
          shot: 'shot-organizer.png',
          shotFocusX: 0.82,
          shotFocusY: 0.45,
        } satisfies ThumbnailProps}
      />
      <Composition
        id="ThumbC"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'Stop taking\nnotes twice.',
          kicker: 'Obsidian + AI',
          shot: 'shot-note.png',
          shotFocusX: 0.42,
          shotFocusY: 0.5,
          dark: true,
        } satisfies ThumbnailProps}
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
