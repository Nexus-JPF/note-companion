/**
 * The text the inbox pipeline appends to a note after formatting. The writers
 * (index.ts) and the readers (audio-source.ts) both use these, so a change to
 * what is written cannot silently stop the readers from recognising it. The
 * pipeline-shape test builds notes with these same functions.
 */

/** Label of the link to the pre-format backup. */
export const BACKUP_LINK_LABEL = "Link to original file";

/** Appended by the formatting backup step: a separator and a link to the backup. */
export function backupFooter(backupPathWithoutExtension: string): string {
  return `\n\n---\n[[${backupPathWithoutExtension} | ${BACKUP_LINK_LABEL}]]`;
}

/**
 * Appended by the tagging step for an inline tag: a blank line before the
 * first '#' in the note, a plain newline after that.
 */
export function inlineTagAppendix(existingContent: string, formattedTag: string): string {
  return existingContent.includes("#") ? `\n${formattedTag}` : `\n\n${formattedTag}`;
}
