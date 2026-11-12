import type { App, TFile } from "obsidian";
import { BACKUP_LINK_LABEL } from "./note-footer";

/**
 * Keeps an audio note tied to its source after the AI rewrites it.
 *
 * Formatting replaces the whole note with the model's output, so the
 * `![[audio]]` embed and the `## Transcript for …` section the inbox wrote
 * are dropped unless the model happens to keep them. These helpers put them
 * back deterministically, independent of the template.
 */

const AUDIO_EXTENSIONS = "mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg";
const AUDIO_EMBED = new RegExp(
  `!\\[\\[[^\\]|]+?\\.(?:${AUDIO_EXTENSIONS})(?:\\|[^\\]]*)?\\]\\]`,
  "gi"
);
// `m` makes ^ match per line; the end of the note is matched with (?![\s\S]) because $ would match every line end.
const TRANSCRIPT_SECTION =
  /^## Transcript for (.+)\n+([\s\S]*?)(?=\n## |(?![\s\S]))/gm;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Footer written by appendBackupLinkToCurrentFile, plus any inline #tag lines
 * the tagging step appended after it (appendTag adds them at the end of the note).
 */
const BACKUP_FOOTER = new RegExp(
  `\\n\\n---\\n\\[\\[[^\\]]*${escapeRegExp(BACKUP_LINK_LABEL)}\\]\\](?:\\s+#[^\\s#]+)*\\s*$`
);
/** Collapsed callout written by restoreAudioSource; parsed back so a later format can restore it again. */
const TRANSCRIPT_CALLOUT = /^> \[!note\]-? Transcript for (.+)\n((?:>.*(?:\n|$))*)/gm;
const CALLOUT_MARKER = /^>[ \t]?/gm;

export interface TranscriptSource {
  title: string;
  text: string;
}

export interface AudioSource {
  embeds: string[];
  transcripts: TranscriptSource[];
}

export function extractAudioSource(content: string): AudioSource {
  const embeds = Array.from(new Set(content.match(AUDIO_EMBED) ?? []));
  const transcripts: TranscriptSource[] = [];
  const seen = new Set<string>();
  const add = (title: string, rawText: string) => {
    const text = rawText.trim();
    const key = normalize(text);
    if (!text || seen.has(key)) return;
    seen.add(key);
    transcripts.push({ title: title.trim(), text });
  };
  for (const match of content.matchAll(TRANSCRIPT_SECTION)) {
    add(match[1], match[2]);
  }
  for (const match of content.matchAll(TRANSCRIPT_CALLOUT)) {
    add(match[1], match[2].replace(CALLOUT_MARKER, ""));
  }
  return { embeds, transcripts };
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** `![[path|300]]` -> `path`, so a changed display size is not mistaken for a missing player. */
const embedTarget = (embed: string) =>
  embed.slice(3, -2).split("|")[0].trim().toLowerCase();

function toCollapsedCallout({ title, text }: TranscriptSource): string {
  const body = text
    .split("\n")
    .map(line => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
  return `> [!note]- Transcript for ${title}\n${body}`;
}

/**
 * Returns `formatted` with any audio embeds and transcript sections from
 * `source` that it lacks: embeds go at the top (below frontmatter), missing
 * transcripts go in collapsed callouts at the end (above the backup footer).
 * Returns `formatted` unchanged when nothing is missing.
 */
export function restoreAudioSource(formatted: string, source: string): string {
  const { embeds, transcripts } = extractAudioSource(source);
  if (embeds.length === 0) return formatted;

  let result = formatted;

  const presentTargets = new Set(
    (result.match(AUDIO_EMBED) ?? []).map(embedTarget)
  );
  const missingEmbeds = embeds.filter(
    embed => !presentTargets.has(embedTarget(embed))
  );
  if (missingEmbeds.length > 0) {
    const block = `${missingEmbeds.join("\n")}\n\n`;
    const frontmatter = result.match(FRONTMATTER)?.[0] ?? "";
    result =
      frontmatter +
      (frontmatter && !frontmatter.endsWith("\n\n") ? "\n" : "") +
      block +
      result.slice(frontmatter.length).replace(/^\n+/, "");
  }

  // Ignore callout markers so an already-restored transcript counts as present
  const normalizedResult = normalize(result.replace(CALLOUT_MARKER, ""));
  // Whole-transcript check: keeping only the opening of a transcript is not preservation
  const missingTranscripts = transcripts.filter(
    ({ text }) => !normalizedResult.includes(normalize(text))
  );
  if (missingTranscripts.length > 0) {
    const footer = result.match(BACKUP_FOOTER)?.[0] ?? "";
    const body = footer ? result.slice(0, result.length - footer.length) : result;
    const callouts = missingTranscripts.map(toCollapsedCallout).join("\n\n");
    result = `${body.trimEnd()}\n\n${callouts}${footer}`;
  }

  return result;
}

/**
 * The note's own content without the audio embeds, transcript sections or
 * callouts, backup footer and frontmatter: what a student reads, minus the raw source.
 */
export function stripAudioSource(content: string): string {
  return content
    .replace(FRONTMATTER, "")
    .replace(BACKUP_FOOTER, "")
    .replace(TRANSCRIPT_SECTION, "")
    .replace(TRANSCRIPT_CALLOUT, "")
    .replace(AUDIO_EMBED, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Appends `block` at the end of the note, above the "Link to original file" footer if there is one. */
export function appendBeforeBackupFooter(content: string, block: string): string {
  const footer = content.match(BACKUP_FOOTER)?.[0] ?? "";
  const body = footer ? content.slice(0, content.length - footer.length) : content;
  return `${body.trimEnd()}\n\n${block}${footer}`;
}

/** Atomically restores the audio source in a formatted note (no-op if intact). */
export async function restoreAudioSourceInFile(
  app: App,
  file: TFile,
  sourceContent: string
): Promise<void> {
  await app.vault.process(file, data => restoreAudioSource(data, sourceContent));
}
