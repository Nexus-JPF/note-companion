import { FOCUS } from '../tokens';
import type { EpisodeProps } from '../types';

/**
 * Episode 3. A rambling voice memo goes into the inbox folder and comes out as
 * a titled, tagged, filed note with the transcript under an embedded player.
 *
 * The memo itself: a ~100s ramble about an onboarding redesign with one
 * decision and four to-dos, recorded as .m4a under 4MB so it takes the
 * direct-upload path.
 *
 * TIMED AGAINST THE REAL CAPTURE (2026-11-01, 31.42s, 1536x864). Read off the
 * frames at 0.5s steps:
 *
 *   0.0 -  3.3   empty tab, Organizer panel
 *   3.5 -  7.0   voice-memo-demo.wav dragged onto _NoteCompanion/Inbox
 *   7.5          panel flips to Inbox, processing starts
 *   8   - 13     Cleaning up / validating
 *  13   - 20     Extract (transcription)
 *  20   - 23     Generating title
 *  23   - 25.5   summary card: renamed, moved to Projects/Onboarding redesign,
 *                "Added tags: #meeting, #notes, #onboarding-design"
 *  26   - 31.4   the note opens, scrolls down to the tag pills (~29), back to the top
 *
 * WHAT THIS FOOTAGE DOES AND DOES NOT SHOW. The tags show twice: in the summary
 * card (23-25.5) and as pills at the bottom of the note (~29-30), which the
 * scroll reaches before jumping back to the top by ~31. The scroll also passes
 * the transcript line where Whisper wrote "unretained notes" for "handwritten"
 * (~27-28.5). That error is on screen for a second or two. Re-shoot, or say
 * "handwritten" more clearly in the memo, if it matters.
 *
 * The source is a WAV: the production transcribe route 400s on this machine's
 * m4a ("corrupted or unsupported M4A", from the ffmpeg re-encode step). No
 * caption mentions the format.
 *
 * AUDIO. The sfx and music files are not committed. Drop royalty-free files
 * into public/sfx/ and public/music/ (names below), or delete the `music` and
 * `sfx` fields to render silent. A missing file fails the render.
 */
export const ep03: Omit<EpisodeProps, 'format'> = {
  title: 'Talk it out.\nGet the note.',
  subtitle: 'Note Companion for Obsidian',

  footage: 'ep03.mp4',
  footageDurationInSeconds: 31.42,

  music: { file: 'music/bed.mp3', volume: 0.12 },

  sfx: [
    { at: -2.0, file: 'sfx/whoosh.mp3', volume: 0.35 }, // title card in
    { at: 6.8, file: 'sfx/click.mp3' },                 // memo dropped on the Inbox
    { at: 23.0, file: 'sfx/chime.mp3', volume: 0.3 },   // summary card: renamed, moved, tagged
    { at: 26.0, file: 'sfx/pop.mp3', volume: 0.25 },    // the note opens
    { at: 31.6, file: 'sfx/whoosh.mp3', volume: 0.35 }, // end card in
  ],

  lowerThirds: [
    { at: 3.6, duration: 3.8, title: 'Drop it in the Inbox', detail: 'The plugin watches the folder' },
    { at: 13.6, duration: 5.0, title: 'Transcribing', detail: 'Speech to text' },
    { at: 23.2, duration: 4.0, title: 'Titled, tagged, filed', detail: 'No clicks required' },
  ],

  captions: [
    { from: 0.3, to: 3.2, text: 'Your best ideas come out as a ramble.' },
    { from: 3.6, to: 7.2, text: 'Drop the voice memo into your inbox.' },
    { from: 7.8, to: 13.0, text: 'The plugin picks it up.' },
    { from: 13.4, to: 19.6, text: 'It transcribes what you said.' },
    { from: 20.0, to: 22.8, text: 'Writes a title. Works out where it belongs.' },
    { from: 23.2, to: 25.8, text: 'Adds tags.' },
    { from: 26.2, to: 30.8, text: 'The audio and the words, together in one note.' },
  ],

  // The drag lands on the file tree at the far left, so the vertical crop starts
  // there (0.15 is the leftmost the 486px window can sit), then follows the
  // product to the panel and back to the note.
  focus: [
    { at: 0, x: FOCUS.editor },
    { at: 3.0, x: 0.15 },
    { at: 7.0, x: 0.15 },
    { at: 8.0, x: FOCUS.panel },
    { at: 25.0, x: FOCUS.panel },
    { at: 26.5, x: FOCUS.editor },
    { at: 31.42, x: FOCUS.editor },
  ],

  endCard: {
    headline: 'Everything you capture,\nsomewhere you can find it',
    url: 'notecompanion.ai',
  },
};
