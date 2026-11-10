import { extractAudioSource, stripAudioSource } from "../lib/audio-source";
import { resolveAudioDefaultTemplate } from "./audio-template";

/**
 * Pure helpers for the "study note from recordings" feature: after a recording
 * is transcribed and formatted, a second note (flashcards, a quiz...) is
 * generated from it and linked both ways.
 */

/** Settings value meaning "don't create a study note". Same convention as the audio default template. */
export const STUDY_NOTE_OFF = "none";

/** Template for the study note, or null when the setting is off/empty or holds a template that cannot run on audio. */
export const resolveStudyTemplate = resolveAudioDefaultTemplate;

/** Below this the note has too little to study from; skip rather than invent cards. */
export const MIN_STUDY_SOURCE_CHARS = 200;
/** A formatted note shorter than this is probably just a stub, so the transcript is used instead. */
const THIN_NOTE_CHARS = 600;

const LABELS: Record<string, string> = { flash_cards: "Flashcards" };

/** Human label for a template: `flash_cards` -> "Flashcards", `practice_quiz` -> "Practice quiz". */
export function studyNoteLabel(template: string): string {
  const name = template.replace(/\.md$/i, "").trim();
  const known = LABELS[name.toLowerCase()];
  if (known) return known;
  const spaced = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Study note";
}

/** File basename for the study note: `<lecture> - <label>`, safe to use as a file name and inside [[links]]. */
export function studyNoteBasename(sourceBasename: string, template: string): string {
  const clean = sourceBasename
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .trim();
  return `${clean || "Recording"} - ${studyNoteLabel(template)}`;
}

/**
 * The text the study note is generated from: the formatted note without its
 * audio source. When that is thin (formatting was skipped or produced a stub)
 * the transcript is used. May be empty or short; check with hasEnoughToStudy.
 */
export function buildStudySource(noteContent: string): string {
  const body = stripAudioSource(noteContent);
  if (body.length >= THIN_NOTE_CHARS) return body;
  const transcript = extractAudioSource(noteContent)
    .transcripts.map(({ text }) => text)
    .join("\n\n");
  return transcript.length > body.length ? transcript : body;
}

export const hasEnoughToStudy = (source: string): boolean =>
  source.trim().length >= MIN_STUDY_SOURCE_CHARS;

const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---(\n|$)/;

/** Adds `source: "[[lecture]]"` to the frontmatter (creating it if needed); keeps an existing `source`. */
export function withSourceProperty(content: string, sourceBasename: string): string {
  const line = `source: "[[${sourceBasename}]]"`;
  const match = content.match(FRONTMATTER_BLOCK);
  if (!match) return `---\n${line}\n---\n\n${content.replace(/^\n+/, "")}`;
  if (/^source\s*:/m.test(match[1])) return content;
  return content.replace(FRONTMATTER_BLOCK, `---\n${match[1]}\n${line}\n---${match[2]}`);
}

/** Line added to the lecture note pointing at the study note. */
export function studyNoteLink(template: string, studyBasename: string): string {
  return `**${studyNoteLabel(template)}:** [[${studyBasename}]]`;
}

/**
 * Templates whose output stands alone. When the manual "new file" format
 * creates one, the source audio and transcript must not be copied into it.
 */
export function keepsAudioSourceInNewFile(templateName: string): boolean {
  return templateName.replace(/\.md$/i, "").toLowerCase() !== "flash_cards";
}
