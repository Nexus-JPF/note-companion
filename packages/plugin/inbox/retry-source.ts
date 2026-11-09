import { VALID_MEDIA_EXTENSIONS } from "../constants";

/**
 * Media files (audio, images, PDFs) are processed through a markdown
 * "container" note that the pipeline creates next to the moved attachment. When
 * extraction fails (e.g. transcription returns AUDIO_SPLIT_FAILED) that
 * container is empty, so retrying it can only ever bypass with "No content
 * available". The thing worth retrying is the attachment.
 */

export interface RetrySourceInput {
  /** Path of the media file the pipeline tracked for this record, if any. */
  attachmentPath?: string | null;
  /** Basename the record was tracked under (the media file's basename). */
  originalName: string;
  attachmentsPath: string;
  /** True when the record's container note is missing or has no content. */
  containerEmpty: boolean;
}

/**
 * True when `container` is an empty note that only exists to hold the
 * extraction of a distinct attachment — safe to delete, and never worth
 * retrying on its own.
 */
export function isStaleContainer({
  containerPath,
  attachmentPath,
  content,
}: {
  containerPath: string;
  attachmentPath?: string | null;
  content: string;
}): boolean {
  if (!attachmentPath || attachmentPath === containerPath) return false;
  if (!containerPath.toLowerCase().endsWith(".md")) return false;
  return content.trim().length === 0;
}

/**
 * Ordered vault paths to look for the media file to re-run, or [] when Retry
 * should process the record's note as before (the note has content, so the
 * failure was after extraction and re-transcribing would only burn quota).
 *
 * Records written before attachment tracking existed have no path, so fall
 * back to `<attachments>/<originalName>.<ext>`, where the pipeline moves media.
 */
export function getAttachmentRetryCandidates({
  attachmentPath,
  originalName,
  attachmentsPath,
  containerEmpty,
}: RetrySourceInput): string[] {
  if (!containerEmpty) return [];
  if (attachmentPath) return [attachmentPath];
  if (!attachmentsPath || !originalName) return [];
  return VALID_MEDIA_EXTENSIONS.map(
    (ext) => `${attachmentsPath}/${originalName}.${ext}`
  );
}
