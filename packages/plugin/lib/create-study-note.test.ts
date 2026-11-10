jest.mock("obsidian", () => ({
  normalizePath: (p: string) => p.replace(/\/+/g, "/").replace(/^\//, ""),
  TFile: class {},
}));
jest.mock("../inbox/services/youtube-service", () => ({
  measureFormatContentTokens: jest.fn(async (text: string) => Math.ceil(text.length / 4)),
}));
jest.mock("../services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createStudyNote } from "./create-study-note";

const NOTES = `# Vaccines\n\n${"Vaccines train the adaptive immune system. ".repeat(20)}`;
const LECTURE = `![[lecture.m4a]]\n\n${NOTES}\n\n---\n[[Backup Link to original file]]`;
const CARDS = '---\ntotal: 2\n---\n\n<details class="flashcard"><summary>Q</summary>A</details>';

function setup(opts: { content?: string; existing?: string[]; instructions?: string; generated?: string } = {}) {
  const files = new Map<string, string>([["Lectures/Immunity.md", opts.content ?? LECTURE]]);
  for (const path of opts.existing ?? []) files.set(path, "x");
  const source = { path: "Lectures/Immunity.md", basename: "Immunity", parent: { path: "Lectures" } };
  const formatStream = jest.fn(async () => opts.generated ?? CARDS);
  const plugin = {
    settings: { maxFormattingTokens: 100000, API_KEY: "k" },
    app: {
      vault: {
        read: async (f: { path: string }) => files.get(f.path),
        create: async (path: string, data: string) => {
          files.set(path, data);
          return { path, basename: path.split("/").pop()!.replace(/\.md$/, "") };
        },
        process: async (f: { path: string }, fn: (d: string) => string) => {
          files.set(f.path, fn(files.get(f.path)!));
        },
        adapter: { exists: async (p: string) => files.has(p) },
      },
    },
    getTemplateInstructions: jest.fn(async () => opts.instructions ?? "make cards"),
    getServerUrl: () => "https://server",
    formatStream,
    cleanupTagsInContent: (c: string) => c,
  };
  return { plugin: plugin as never, files, source: source as never, formatStream };
}

describe("createStudyNote", () => {
  it("creates the note next to the lecture, links both ways and sends only the study text", async () => {
    const { plugin, files, source, formatStream } = setup();
    const created = await createStudyNote(plugin, source, "flash_cards");

    expect(created?.path).toBe("Lectures/Immunity - Flashcards.md");
    const note = files.get("Lectures/Immunity - Flashcards.md")!;
    expect(note).toContain('source: "[[Immunity]]"');
    expect(note).toContain("flashcard");
    expect(note).not.toContain("lecture.m4a");

    const sent = (formatStream.mock.calls[0] as unknown[])[0] as string;
    expect(sent).toContain("adaptive immune system");
    expect(sent).not.toContain("lecture.m4a");
    expect(sent).not.toContain("Link to original file");

    const lecture = files.get("Lectures/Immunity.md")!;
    expect(lecture).toContain("**Flashcards:** [[Immunity - Flashcards]]");
    expect(lecture.indexOf("[[Immunity - Flashcards]]")).toBeLessThan(lecture.indexOf("Link to original file"));
  });

  it("does not overwrite an existing note", async () => {
    const { plugin, files, source } = setup({ existing: ["Lectures/Immunity - Flashcards.md"] });
    const created = await createStudyNote(plugin, source, "flash_cards");
    expect(created?.path).toBe("Lectures/Immunity - Flashcards 2.md");
    expect(files.get("Lectures/Immunity - Flashcards.md")).toBe("x");
  });

  it("skips quietly when there is too little to study from", async () => {
    const { plugin, files, source, formatStream } = setup({ content: "![[lecture.m4a]]\n\nshort" });
    expect(await createStudyNote(plugin, source, "flash_cards")).toBeNull();
    expect(formatStream).not.toHaveBeenCalled();
    expect(files.size).toBe(1);
  });

  it("fails with a readable message when the template is missing", async () => {
    const { plugin, source, files } = setup({ instructions: "" });
    await expect(createStudyNote(plugin, source, "flash_cards")).rejects.toThrow(/template "flash_cards" was not found/);
    expect(files.size).toBe(1);
  });

  it("fails and leaves the lecture untouched when the AI returns nothing", async () => {
    const { plugin, source, files } = setup({ generated: "  " });
    await expect(createStudyNote(plugin, source, "flash_cards")).rejects.toThrow(/empty note/);
    expect(files.get("Lectures/Immunity.md")).toBe(LECTURE);
  });

  it("refuses content over the formatting token limit", async () => {
    const { plugin, source } = setup();
    (plugin as { settings: { maxFormattingTokens: number } }).settings.maxFormattingTokens = 10;
    await expect(createStudyNote(plugin, source, "flash_cards")).rejects.toThrow(/too large/);
  });
});
