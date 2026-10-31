const DIAGRAM_LINK = /(?<!!)\[Generated Diagram Image\]\((\S+?)\)/g;

/**
 * Magic Diagram notes link to the generated image as a plain markdown link.
 * Render it as an inline image (plus a tappable link to the full size) so the
 * diagram is visible and usable in the note view.
 */
export function withInlineDiagramImages(markdown: string): string {
  return markdown.replace(
    DIAGRAM_LINK,
    (_m, url) => `![Generated Diagram Image](${url})\n\n[Open full size](${url})`
  );
}
