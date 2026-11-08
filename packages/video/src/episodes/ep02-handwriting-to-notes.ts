import { FOCUS } from '../tokens';
import type { EpisodeProps } from '../types';

/**
 * Episode 2. A photograph of a handwritten page goes into the inbox folder and
 * comes out as a titled, tagged, filed markdown note.
 *
 * Chosen over the mobile OCR app because it runs on the desktop plugin, so the
 * whole capture setup still applies -- demo-vault, set-window.sh, 1536x864,
 * the focus track. `getTextFromFile` (packages/plugin/index.ts) routes images
 * to the vision path, which is the same route md, pdf and audio take, so OCR
 * feeds the ordinary organiser machinery.
 *
 * TIMED AGAINST THE REAL CAPTURE (2026-10-16, 29.59s). Read off the status
 * bar frame by frame:
 *
 *   0.0 - 2.5   empty tab
 *   2.5 - 7.0   the photo is open in the main pane
 *   ~7.0        dragged into _NoteCompanion/Inbox/
 *   8  - 16     Extract / cleaning up
 *   16 - 21     Finding destination folder
 *   21 - 23     Generating title
 *   ~23         the note opens (565 characters)
 *   ~25         tags applied (602 characters), held to the end
 *
 * WHAT THIS FOOTAGE DOES AND DOES NOT SHOW. Two earlier takes extracted at
 * roughly 35% accuracy and were unusable; this one is verbatim, because it was
 * shot against the unified OCR pipeline. See docs/ep02-handwriting-page.md --
 * OCR runs server-side, so this cut must not ship before that fix is deployed.
 *
 * Two things the captions deliberately do not claim:
 *
 *  - The body lands inside a fenced ```plaintext block, not as rendered
 *    markdown. "Formats it as markdown" would be wrong. The exactness of the
 *    transcription is the better claim anyway, and it is the one the footage
 *    actually proves.
 *  - The folder it chose was `Recordings/`, not `Research/` next to the two
 *    sibling interviews. So no caption names the destination or calls it
 *    right; "where it belongs" is as far as this take earns.
 */
export const ep02: Omit<EpisodeProps, 'format'> = {
  title: 'Handwriting in.\nSearchable notes out.',
  subtitle: 'Note Companion for Obsidian',

  footage: 'ep02.mp4',
  footageDurationInSeconds: 29.59,

  lowerThirds: [
    { at: 7.4, duration: 4.0, title: 'Drop it in the Inbox', detail: 'The plugin watches the folder' },
    { at: 12.4, duration: 4.5, title: 'Reading the page', detail: 'Extracting content' },
    { at: 25.2, duration: 4.0, title: 'Titled, tagged, filed', detail: 'No clicks required' },
  ],

  captions: [
    { from: 0.4, to: 2.4, text: 'Handwritten notes are the hardest kind to keep.' },
    { from: 2.9, to: 6.8, text: 'You photograph the page, and it becomes something your vault cannot search.' },
    { from: 7.3, to: 11.5, text: 'So drop the photo into your inbox.' },
    { from: 12.0, to: 16.2, text: 'It reads the handwriting.' },
    { from: 16.6, to: 20.9, text: 'Works out what the document is, and where it belongs.' },
    { from: 21.3, to: 24.6, text: 'Writes a title. Adds tags.' },
    { from: 25.1, to: 27.6, text: 'Every line, exactly as you wrote it.' },
  ],

  /**
   * Vertical cut. The subject moves centre -> right -> centre: the photo is in
   * the editor, the pipeline runs in the panel, the finished note is back in
   * the editor. Pans land just before each handover so the move is finished
   * when the thing arrives.
   */
  focus: [
    { at: 0, x: FOCUS.editor },
    { at: 6.8, x: FOCUS.editor },
    { at: 8.5, x: FOCUS.panel },
    { at: 22.0, x: FOCUS.panel },
    // FOCUS.editor (0.4), not wider. The note's longest line is ~600px and the
    // vertical window is 486px, so something is always cut. Tried 0.46 to
    // recover the right-hand words; it clipped every line start instead, which
    // reads far worse. Favour the left edge.
    { at: 24.0, x: FOCUS.editor },
    { at: 29.59, x: FOCUS.editor },
  ],

  endCard: {
    headline: 'Everything you capture,\nsomewhere you can find it',
    url: 'notecompanion.ai',
  },
};
