/** A finished Magic Diagram: has a generated image to show instead of the original sketch. */
export function getMagicDiagramImageUrl(file: {
  processType?: string | null;
  generatedImageUrl?: string | null;
}): string | null {
  return file.processType === 'magic-diagram' && file.generatedImageUrl
    ? file.generatedImageUrl
    : null;
}

export function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
