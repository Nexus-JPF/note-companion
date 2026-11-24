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

const LABELS: Record<string, string> = { flash_cards: "Flashcards", quiz: "Quiz" };

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

/** One quiz question carries four options and an explanation, so roughly half as many as flashcards. */
const WORDS_PER_QUESTION = 90;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 15;

/** Upper bound on quiz questions for a source; see maxFlashcards for why the plugin states it. */
export function maxQuizQuestions(source: string): number {
  const words = source.split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(words / WORDS_PER_QUESTION)));
}

const templateKey = (template: string) =>
  (template.split("/").pop() ?? "").replace(/\.md$/i, "").trim().toLowerCase();

/**
 * Template instructions plus, for the flashcards and quiz templates, a hard
 * limit computed from the source. Done here rather than in the template file
 * so vaults that still hold an older copy of the template get it too.
 */
export function withStudyLimits(instructions: string, template: string, source: string): string {
  const name = templateKey(template);
  if (name === "flash_cards") {
    return `${instructions}\n\nHARD LIMIT for this content: write at most ${maxFlashcards(
      source
    )} cards, and fewer if the content has fewer distinct facts. Before you finish, drop any card that repeats a fact another card already tests, then set total to the number of cards you wrote.`;
  }
  if (name === "quiz") {
    return `${instructions}\n\nHARD LIMIT for this content: write at most ${maxQuizQuestions(
      source
    )} questions, and fewer if the content has fewer distinct facts. Before you finish, drop any question that tests a fact another question already tests, then set total to the number of questions you wrote.`;
  }
  return instructions;
}

const LETTERS = ["A", "B", "C", "D"] as const;

/**
 * One quiz question as the quiz template writes it: heading, four options
 * A to D, then the answer block whose first line starts with the correct
 * letter. Anything that does not match this shape exactly is left alone.
 */
const QUIZ_QUESTION =
  /(^\*\*\d+\.[^\n]*\*\*\n\n)((?:- [A-D]\. [^\n]*\n){3}- [A-D]\. [^\n]*)(\n\n<details[^\n]*>\n<summary>[^\n]*<\/summary>\n\n)\*\*([A-D])\./gm;

const shuffled = <T>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Reorders the options of every quiz question so the correct answer is spread
 * evenly over A to D. The model puts the right answer on B or C almost every
 * time and ignores being told not to, so the plugin does it: it relabels the
 * options and the letter that opens the explanation. Questions that do not
 * match the template's shape are untouched, so the worst case is the model's
 * own order.
 */
export function shuffleQuizOptions(content: string, random: () => number = Math.random): string {
  const count = [...content.matchAll(QUIZ_QUESTION)].length;
  if (count === 0) return content;

  // One target slot per question: whole rounds of A-D in a random order each, so the
  // spread is even and no letter is favoured when the count is not a multiple of four.
  const targets: number[] = [];
  while (targets.length < count) targets.push(...shuffled([0, 1, 2, 3], random));
  targets.length = count;
  let question = 0;

  return content.replace(QUIZ_QUESTION, (_whole, heading: string, options: string, details: string, correct: string) => {
    const texts = options.split("\n").map(line => line.replace(/^- [A-D]\. /, ""));
    const letters = options.split("\n").map(line => line[2]);
    if (letters.join("") !== "ABCD") return _whole;

    const correctText = texts[LETTERS.indexOf(correct as (typeof LETTERS)[number])];
    const wrong = shuffled(texts.filter((_, i) => LETTERS[i] !== correct), random);
    const slot = targets[question++];
    const reordered = [...wrong.slice(0, slot), correctText, ...wrong.slice(slot)];

    const rebuilt = reordered.map((text, i) => `- ${LETTERS[i]}. ${text}`).join("\n");
    return `${heading}${rebuilt}${details}**${LETTERS[slot]}.`;
  });
}

/** Template-specific tidy-up of generated study content. Only the quiz needs one today. */
export function finishStudyContent(
  content: string,
  template: string,
  random: () => number = Math.random
): string {
  return templateKey(template) === "quiz" ? shuffleQuizOptions(content, random) : content;
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
  { template: "quiz", label: studyNoteLabel("quiz") },
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
  return !["flash_cards", "quiz"].includes(templateKey(templateName));
}
