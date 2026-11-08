import React from 'react';
import { Composition } from 'remotion';
import { Episode, episodeDurationInFrames } from './compositions/Episode';
import { Thumbnail } from './compositions/Thumbnail';
import type { ThumbnailProps } from './compositions/Thumbnail';
import { FORMATS, FPS } from './tokens';
import { ep01 } from './episodes/ep01-youtube-to-notes';
import { ep02 } from './episodes/ep02-handwriting-to-notes';
import { ep03 } from './episodes/ep03-voice-memo-to-notes';
import type { EpisodeProps } from './types';

/**
 * Two compositions per episode. `Episode*` is the YouTube cut; `Clip*` is the
 * same content reframed for LinkedIn. Nothing is edited twice -- change the
 * episode file and both outputs follow.
 */
export const RemotionRoot: React.FC = () => {
  const duration = episodeDurationInFrames(ep01.footageDurationInSeconds, FPS);
  const duration2 = episodeDurationInFrames(ep02.footageDurationInSeconds, FPS);
  const duration3 = episodeDurationInFrames(ep03.footageDurationInSeconds, FPS);

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
      <Composition
        id="Ep2ThumbA"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'Your handwriting.\nSearchable.',
          kicker: 'Note Companion for Obsidian',
          shot: 'shot-page2.png',
          shotFocusX: 0.53,
          shotFocusY: 0.5,
        } satisfies ThumbnailProps}
      />
      <Composition
        id="Ep2ThumbB"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'Notebook\n\u2192 Obsidian',
          kicker: 'Read, titled, tagged, filed',
          shot: 'shot-note2.png',
          shotFocusX: 0.53,
          // Pushed down past the generated title, which is the clunkiest thing
          // in the capture ("...Vault Organization Pile Precision Over Recall").
          // The monospace body is the part worth showing behind the headline.
          shotFocusY: 0.85,
        } satisfies ThumbnailProps}
      />
      <Composition
        id="Ep2ThumbC"
        component={Thumbnail}
        durationInFrames={1}
        fps={1}
        width={1280}
        height={720}
        defaultProps={{
          headline: 'Stop retyping\nyour notes.',
          kicker: 'Obsidian + AI',
          shot: 'shot-page2.png',
          shotFocusX: 0.53,
          shotFocusY: 0.5,
          dark: true,
        } satisfies ThumbnailProps}
      />
      <Composition
        id="Episode2"
        component={Episode}
        durationInFrames={duration2}
        fps={FPS}
        width={FORMATS.episode.width}
        height={FORMATS.episode.height}
        defaultProps={{ ...ep02, format: 'episode' } satisfies EpisodeProps}
      />
      <Composition
        id="Clip2"
        component={Episode}
        durationInFrames={duration2}
        fps={FPS}
        width={FORMATS.clip.width}
        height={FORMATS.clip.height}
        defaultProps={{ ...ep02, format: 'clip' } satisfies EpisodeProps}
      />
      <Composition
        id="Episode3"
        component={Episode}
        durationInFrames={duration3}
        fps={FPS}
        width={FORMATS.episode.width}
        height={FORMATS.episode.height}
        defaultProps={{ ...ep03, format: 'episode' } satisfies EpisodeProps}
      />
      <Composition
        id="Clip3"
        component={Episode}
        durationInFrames={duration3}
        fps={FPS}
        width={FORMATS.clip.width}
        height={FORMATS.clip.height}
        defaultProps={{ ...ep03, format: 'clip' } satisfies EpisodeProps}
      />
    </>
  );
};
