import type { EpisodeProps } from '../types';

/**
 * Episode 1. Chosen because it is the one demo where the product's own subject
 * matter and the platform match: a video about turning YouTube videos into
 * notes, published on YouTube, aimed at people already searching for exactly
 * that.
 *
 * Timed against the real capture (public/ep01.mp4, 60.8s), not the other way
 * round. Two things the first draft of this script got wrong, both corrected
 * here after watching the footage:
 *
 * - The chat takes an instruction, not a bare URL: "summarize
 *   https://youtube.com/watch?v=..." rather than the link on its own.
 * - The Organizer suggests tags and folders. It does not suggest titles, so
 *   nothing here promises one.
 */
export const ep01: Omit<EpisodeProps, 'format'> = {
  title: 'Any YouTube video,\nstraight into your notes',
  subtitle: 'Note Companion for Obsidian',

  footage: 'ep01.mp4',
  footageDurationInSeconds: 60.8,

  lowerThirds: [
    { at: 3, duration: 5, title: 'Ask for a summary', detail: 'Note Companion Chat' },
    { at: 25.5, duration: 5, title: 'Straight into a note', detail: 'One click from the chat' },
    { at: 37, duration: 6, title: 'Filed automatically', detail: 'Tags and folder suggested' },
  ],

  captions: [
    { from: 0.5, to: 4.0, text: 'You found a video worth keeping.' },
    { from: 4.2, to: 8.0, text: 'Normally that means watching it twice and taking notes by hand.' },
    { from: 8.5, to: 13.0, text: 'Instead, drop the link in chat and ask for a summary.' },
    { from: 13.5, to: 19.5, text: 'It pulls the transcript and writes the summary for you.' },
    { from: 20.0, to: 24.5, text: 'The numbers, the names, the points that actually mattered.' },
    { from: 25.5, to: 31.0, text: 'One click puts it into a real note in your vault.' },
    { from: 31.5, to: 36.0, text: 'Markdown. Local. Yours.' },
    { from: 37.0, to: 42.5, text: 'Then it reads the note and works out where it belongs.' },
    { from: 43.0, to: 48.5, text: 'Tags, and the folder it should live in.' },
    { from: 49.0, to: 54.5, text: 'Pick them, and the note files itself.' },
    { from: 55.0, to: 60.5, text: 'Note Companion is an Obsidian plugin.' },
  ],

  endCard: {
    headline: 'Turn what you watch\ninto what you know',
    url: 'notecompanion.ai',
  },
};
