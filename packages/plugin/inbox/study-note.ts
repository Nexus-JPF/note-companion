import { appendBeforeBackupFooter, extractAudioSource, stripAudioSource } from "../lib/audio-source";
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
  const body = stripStudyNoteLinks(stripAudioSource(noteContent));
  if (body.length >= THIN_NOTE_CHARS) return body;
  const transcript = extractAudioSource(noteContent)
    .transcripts.map(({ text }) => text)
    .join("\n\n");
  return transcript.length > body.length ? transcript : body;
}

export const hasEnoughToStudy = (source: string): boolean =>
  source.trim().length >= MIN_STUDY_SOURCE_CHARS;

/** The source is a formatted note that already repeats itself (summary, details, review questions), so one card per this many words. */
const WORDS_PER_CARD = 45;
const MIN_CARDS = 5;
const MAX_CARDS = 30;

/**
 * Upper bound on flashcards for a source. The model does not hold itself to a
 * ratio in the template (it padded a 90 s lecture to 20 cards every run), so
 * the plugin works the number out and states it as a hard limit.
 */
export function maxFlashcards(source: string): number {
  const words = source.split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_CARDS, Math.max(MIN_CARDS, Math.round(words / WORDS_PER_CARD)));
}

/**
 * Template instructions plus, for the flashcards template only, a hard card
 * limit computed from the source. Done here rather than in the template file
 * so vaults that still hold an older copy of flash_cards.md get it too.
 */
export function withStudyLimits(instructions: string, template: string, source: string): string {
  const name = (template.split("/").pop() ?? "").replace(/\.md$/i, "").trim().toLowerCase();
  if (name !== "flash_cards") return instructions;
  return `${instructions}\n\nHARD LIMIT for this content: write at most ${maxFlashcards(
    source
  )} cards, and fewer if the content has fewer distinct facts. Before you finish, drop any card that repeats a fact another card already tests, then set total to the number of cards you wrote.`;
}

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

/** Basename in a `source: "[[lecture]]"` frontmatter property: the note this one was generated from. */
export function studyNoteSource(noteContent: string): string | null {
  const block = noteContent.match(FRONTMATTER_BLOCK)?.[1];
  const match = block?.match(/^source\s*:\s*["']?\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]["']?\s*$/m);
  return match ? match[1].trim() : null;
}

/** Formats the on-demand command offers. The label comes from the template name. */
export const STUDY_FORMATS: ReadonlyArray<{ template: string; label: string }> = [
  { template: "flash_cards", label: studyNoteLabel("flash_cards") },
];

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The `**Label:** [[target]]` part of a link line for one label, capturing the target without alias or heading. */
const linkLinePattern = (label: string, flags: string) =>
  new RegExp(`^\\*\\*${escapeForRegExp(label)}:\\*\\* \\[\\[([^\\]|#]+)(?:[#|][^\\]]*)?\\]\\]`, flags);

/**
 * Basename the lecture note links to for this format (from its
 * `**Label:** [[...]]` line, without any alias or heading), or null when it has no such line.
 * The link may be stale: check the file still exists before treating it as present.
 */
export function findStudyNoteLinkTarget(noteContent: string, template: string): string | null {
  const match = noteContent.match(linkLinePattern(studyNoteLabel(template), "m"));
  return match ? match[1].trim() : null;
}

/**
 * The note with its link line for this format pointing at the study note: an
 * existing line (even a stale one) is replaced in place, otherwise a line is
 * added above the backup footer. Never leaves two lines for one format.
 */
export function withStudyNoteLink(noteContent: string, template: string, studyBasename: string): string {
  if (findStudyNoteLinkTarget(noteContent, template) === studyBasename) return noteContent;
  const link = studyNoteLink(template, studyBasename);
  const existing = linkLinePattern(studyNoteLabel(template), "m");
  return existing.test(noteContent)
    ? noteContent.replace(existing, link)
    : appendBeforeBackupFooter(noteContent, link);
}

/** The text with every study-note link line removed: it is navigation, not content to study. */
export function stripStudyNoteLinks(text: string): string {
  return STUDY_FORMATS.reduce(
    (out, { label }) =>
      out.replace(new RegExp(`^\\*\\*${escapeForRegExp(label)}:\\*\\* \\[\\[[^\\n]*$\\n?`, "gm"), ""),
    text
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when `noteContent` links to the study note `basename` for any format. */
export function linksToStudyNote(noteContent: string, studyBasename: string): boolean {
  return STUDY_FORMATS.some(({ template }) => findStudyNoteLinkTarget(noteContent, template) === studyBasename);
}

/**
 * Templates whose output stands alone. When the manual "new file" format
 * creates one, the source audio and transcript must not be copied into it.
 */
export function keepsAudioSourceInNewFile(templateName: string): boolean {
  return templateName.replace(/\.md$/i, "").toLowerCase() !== "flash_cards";
}
