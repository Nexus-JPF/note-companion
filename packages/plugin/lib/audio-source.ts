import type { App, TFile } from "obsidian";

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
/** Footer written by appendBackupLinkToCurrentFile. */
const BACKUP_FOOTER = /\n\n---\n\[\[[^\]]*Link to original file\]\]\s*$/;
const MATCH_PREFIX_LENGTH = 80;

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
  for (const match of content.matchAll(TRANSCRIPT_SECTION)) {
    const text = match[2].trim();
    if (text) transcripts.push({ title: match[1].trim(), text });
  }
  return { embeds, transcripts };
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

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

  const missingEmbeds = embeds.filter(embed => !result.includes(embed));
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
  const normalizedResult = normalize(result.replace(/^>[ \t]?/gm, ""));
  const missingTranscripts = transcripts.filter(
    ({ text }) =>
      !normalizedResult.includes(normalize(text).slice(0, MATCH_PREFIX_LENGTH))
  );
  if (missingTranscripts.length > 0) {
    const footer = result.match(BACKUP_FOOTER)?.[0] ?? "";
    const body = footer ? result.slice(0, result.length - footer.length) : result;
    const callouts = missingTranscripts.map(toCollapsedCallout).join("\n\n");
    result = `${body.trimEnd()}\n\n${callouts}${footer}`;
  }

  return result;
}

/** Atomically restores the audio source in a formatted note (no-op if intact). */
export async function restoreAudioSourceInFile(
  app: App,
  file: TFile,
  sourceContent: string
): Promise<void> {
  await app.vault.process(file, data => restoreAudioSource(data, sourceContent));
}
