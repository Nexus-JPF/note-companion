import { FOCUS } from '../tokens';
import type { EpisodeProps } from '../types';

/**
 * Episode 2. A photograph of a handwritten page goes into the inbox folder and
 * comes out as a titled, tagged, filed markdown note.
 *
 * Chosen over the mobile OCR app because it runs on the desktop plugin, so the
 * whole capture setup still applies -- demo-vault, set-window.sh, 1536x864,
 * the focus track. `getTextFromFile` (packages/plugin/index.ts:1054) routes
 * images to `generateImageAnnotation`, which is the same path md, pdf and
 * audio take, so OCR feeds the ordinary organiser machinery.
 *
 * The captions deliberately mirror the inbox pipeline's own on-screen labels
 * (packages/plugin/inbox/index.ts:1207) so narration and screen agree:
 *
 *   Extracting content -> Classifying document -> Finding destination folder
 *   -> Generating title -> Adding tags -> Formatting content
 *
 * Note this flow DOES generate a title (Action.RENAME). Episode 1 could not
 * promise one because the Organizer panel has no title section; the inbox
 * does. The README was right about the inbox, and ep01 was using the wrong
 * surface.
 *
 * TIMINGS BELOW ARE PROVISIONAL. Episode 1's first draft was written against
 * an imagined flow and was wrong in three ways; the fix was retiming against
 * the real capture. Shoot roughly to this, then retime. Do not treat these
 * numbers as a spec to hit.
 */
export const ep02: Omit<EpisodeProps, 'format'> = {
  title: 'Handwriting in.\nSearchable notes out.',
  subtitle: 'Note Companion for Obsidian',

  footage: undefined,
  footageDurationInSeconds: 70,

  lowerThirds: [
    { at: 9, duration: 5, title: 'Drop it in the Inbox', detail: 'Any image, PDF or recording' },
    { at: 21, duration: 5, title: 'Reading the page', detail: 'Extracting content' },
    { at: 40, duration: 6, title: 'Titled, tagged, filed', detail: 'No clicks required' },
  ],

  captions: [
    { from: 0.5, to: 4.5, text: 'Handwritten notes are the hardest kind to keep.' },
    { from: 5.0, to: 9.5, text: 'You photograph the page, and that is where it dies.' },
    { from: 10.0, to: 14.5, text: 'A picture your vault cannot search.' },
    { from: 15.5, to: 20.0, text: 'So drop the photo into your inbox folder.' },
    { from: 21.0, to: 26.5, text: 'It reads the handwriting.' },
    { from: 27.0, to: 33.0, text: 'Works out what the document is, and where it belongs.' },
    { from: 34.0, to: 39.5, text: 'Writes a title. Adds tags. Formats it as markdown.' },
    { from: 41.0, to: 46.5, text: 'You did not click anything.' },
    { from: 48.0, to: 54.0, text: 'A photo went in. A note you can search came out.' },
    { from: 55.0, to: 61.0, text: 'Same for PDFs and voice recordings.' },
    { from: 63.0, to: 69.0, text: 'Note Companion is an Obsidian plugin.' },
  ],

  /**
   * Vertical cut. Retime once the capture exists -- the pane the action sits
   * in changes when the processing log appears, and that timing is unknown
   * until it is shot.
   */
  focus: [
    { at: 0, x: FOCUS.editor },
    { at: 14, x: FOCUS.editor },
    { at: 18, x: FOCUS.panel },
    { at: 46, x: FOCUS.panel },
    { at: 50, x: FOCUS.editor },
    { at: 70, x: FOCUS.editor },
  ],

  endCard: {
    headline: 'Everything you capture,\nsomewhere you can find it',
    url: 'notecompanion.ai',
  },
};
