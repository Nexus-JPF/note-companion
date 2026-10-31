import type { UploadedFile } from '@/drizzle/schema';

/** A finished Magic Diagram: has a generated image to show instead of the original sketch. */
export function isMagicDiagram(
  file: UploadedFile
): file is UploadedFile & { generatedImageUrl: string } {
  return file.processType === 'magic-diagram' && !!file.generatedImageUrl;
}

export function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
