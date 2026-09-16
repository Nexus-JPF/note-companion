import type { EpisodeProps } from '../types';

/**
 * Episode 1. Chosen because it is the one demo where the product's own subject
 * matter and the platform match: a video about turning YouTube videos into
 * notes, published on YouTube, aimed at people already searching for exactly
 * that. It is also the fastest thing the product does well on camera.
 *
 * Captions are the narration script. Write them first, time them second, shoot
 * to them third -- the capture is easier when you already know what has to be
 * on screen and when.
 */
export const ep01: Omit<EpisodeProps, 'format'> = {
  title: 'Any YouTube video,\nstraight into your notes',
  subtitle: 'Note Companion for Obsidian',

  // Leave undefined until the capture exists; the composition renders the
  // capture spec in its place so timing can be reviewed before shooting.
  footage: undefined,
  footageDurationInSeconds: 75,

  lowerThirds: [
    { at: 3, title: 'Paste the link', detail: 'Note Companion Chat' },
    { at: 21, title: 'Transcript + summary', detail: 'Generated from the video' },
    { at: 44, title: 'Filed automatically', detail: 'Folder, tags and title suggested' },
  ],

  captions: [
    { from: 0.5, to: 4.0, text: 'You found a video worth keeping.' },
    { from: 4.2, to: 8.5, text: 'Normally that means watching it twice and taking notes by hand.' },
    { from: 9.0, to: 13.0, text: 'Instead, paste the link into Note Companion.' },
    { from: 14.0, to: 18.5, text: 'It pulls the transcript and writes a structured summary.' },
    { from: 19.0, to: 24.0, text: 'Topics, tags, and the points that actually mattered.' },
    { from: 25.0, to: 30.0, text: 'All of it lands as a real note in your vault.' },
    { from: 31.0, to: 36.0, text: 'Markdown. Local. Yours.' },
    { from: 38.0, to: 43.0, text: 'Then it suggests where the note belongs.' },
    { from: 44.0, to: 49.0, text: 'Folder, tags, and a title you did not have to write.' },
    { from: 51.0, to: 56.0, text: 'One paste. One note. Nothing to file.' },
    { from: 58.0, to: 63.0, text: 'That is the whole workflow.' },
    { from: 66.0, to: 72.0, text: 'Note Companion is an Obsidian plugin.' },
  ],

  endCard: {
    headline: 'Turn what you watch\ninto what you know',
    url: 'notecompanion.ai',
  },
};
