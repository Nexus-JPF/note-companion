/**
 * Guards the shape of an inbox note as the pipeline really builds it.
 *
 * Steps that run late (the study note) read what earlier steps appended: the
 * backup footer, then inline tags after it. A hand-written fixture ending at the
 * footer once hid a bug (the Flashcards link landed below the tags), so these
 * tests build notes with the same functions the pipeline uses to write them, in
 * pipeline order. If a step starts appending something new, add it to
 * buildNoteLikeThePipeline and the readers below must still cope.
 */
jest.mock("obsidian", () => ({
  normalizePath: (p: string) => p.replace(/\/+/g, "/").replace(/^\//, ""),
  TFile: class {},
}));
jest.mock("../inbox/services/youtube-service", () => ({
  measureFormatContentTokens: jest.fn(async (text: string) => Math.ceil(text.length / 4)),
}));
jest.mock("../services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { appendBeforeBackupFooter, restoreAudioSource, stripAudioSource } from "./audio-source";
import { createStudyNote } from "./create-study-note";
import { backupFooter, inlineTagAppendix } from "./note-footer";

const TRANSCRIPT = "Good morning everyone. Today we talk about how vaccines work. ".repeat(8).trim();
const SOURCE = `![[Attachments/lecture.m4a]]\n\n## Transcript for lecture.m4a\n\n${TRANSCRIPT}`;
const FORMATTED = `# Vaccines\n\n## Summary\n${"Vaccines train the adaptive immune system. ".repeat(20)}\n\n## Assignments\n- [ ] Read chapter 6`;

/** Steps in pipeline order: format (+ audio restore) -> backup footer -> inline tags. */
function buildNoteLikeThePipeline(opts: { formatted?: string; backupPath: string; tags: string[] }): string {
  let note = restoreAudioSource(opts.formatted ?? FORMATTED, SOURCE);
  note += backupFooter(opts.backupPath);
  for (const tag of opts.tags) note += inlineTagAppendix(note, tag);
  return note;
}

const BACKUP_PATHS = ["_NoteCompanion/Backups/lecture", "Backups/Cours d'immunité (1)", "a/b/c/d"];
const TAG_SETS = [[], ["#vaccines"], ["#vaccines", "#adaptive-immunity", "#immunology-notes"]];

describe("the backup footer and tags the pipeline appends", () => {
  it.each(BACKUP_PATHS.flatMap(path => TAG_SETS.map(tags => [path, tags] as const)))(
    "are recognised by the readers (%s, %j)",
    (backupPath, tags) => {
      const note = buildNoteLikeThePipeline({ backupPath, tags: [...tags] });

      // The study source drops the audio, transcript, footer and tags, and keeps the notes
      const source = stripAudioSource(note);
      expect(source).toContain("Vaccines train the adaptive immune system.");
      expect(source).toContain("- [ ] Read chapter 6");
      expect(source).not.toContain("Link to original file");
      expect(source).not.toContain("lecture.m4a");
      for (const tag of tags) expect(source).not.toContain(tag);

      // A block appended by a late step goes above the footer; the footer and tags stay last
      const out = appendBeforeBackupFooter(note, "**Flashcards:** [[X]]");
      expect(out.indexOf("**Flashcards:** [[X]]")).toBeLessThan(out.indexOf("Link to original file"));
      expect(out.endsWith(note.slice(note.indexOf("\n\n---\n[[")))).toBe(true);
    }
  );

  it("also holds for a note with no '#' at all, where the first tag gets a blank line", () => {
    const note = buildNoteLikeThePipeline({
      formatted: "Plain notes without any hash sign. ".repeat(30),
      backupPath: "Backups/plain",
      tags: ["#solo", "#duo"],
    });
    expect(note).toContain("\n\n#solo");
    const out = appendBeforeBackupFooter(note, "LINK");
    expect(out.indexOf("LINK")).toBeLessThan(out.indexOf("Link to original file"));
  });
});

describe("createStudyNote on a note built like the pipeline builds it", () => {
  function setup(note: string) {
    const files = new Map<string, string>([["Research/Immunity.md", note]]);
    const source = { path: "Research/Immunity.md", basename: "Immunity", parent: { path: "Research" } };
    const formatStream = jest.fn(async () => '---\ntotal: 1\n---\n\n<details class="flashcard"><summary>Q</summary>A</details>');
    const plugin = {
      settings: { maxFormattingTokens: 100000, API_KEY: "k" },
      app: {
        vault: {
          read: async (f: { path: string }) => files.get(f.path),
          create: async (path: string, data: string) => (
            files.set(path, data), { path, basename: path.split("/").pop()!.replace(/\.md$/, "") }
          ),
          process: async (f: { path: string }, fn: (d: string) => string) => {
            files.set(f.path, fn(files.get(f.path)!));
          },
          adapter: { exists: async (p: string) => files.has(p) },
        },
      },
      getTemplateInstructions: async () => "make cards",
      getServerUrl: () => "https://server",
      formatStream,
      cleanupTagsInContent: (c: string) => c,
    };
    return { plugin: plugin as never, source: source as never, files, formatStream };
  }

  it("links above the footer, keeps tags last, and sends only the notes to the AI", async () => {
    const note = buildNoteLikeThePipeline({
      backupPath: "_NoteCompanion/Backups/lecture",
      tags: ["#vaccines", "#adaptive-immunity", "#immunology-notes"],
    });
    const { plugin, source, files, formatStream } = setup(note);

    await createStudyNote(plugin, source, "flash_cards");

    const lecture = files.get("Research/Immunity.md")!;
    expect(lecture).toContain("**Flashcards:** [[Immunity - Flashcards]]");
    expect(lecture.indexOf("[[Immunity - Flashcards]]")).toBeLessThan(lecture.indexOf("Link to original file"));
    expect(lecture.trimEnd().endsWith("#immunology-notes")).toBe(true);

    const sent = (formatStream.mock.calls[0] as unknown[])[0] as string;
    expect(sent).toContain("adaptive immune system");
    expect(sent).not.toContain("Link to original file");
    expect(sent).not.toContain("#vaccines");
    expect(sent).not.toContain("lecture.m4a");
  });
});
