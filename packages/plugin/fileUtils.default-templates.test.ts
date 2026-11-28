import { readFileSync } from "fs";
import { join } from "path";

jest.mock("obsidian", () => ({
  App: class {},
  TFolder: class {},
  TFile: class {
    path = "";
  },
  normalizePath: (p: string) => p,
  parseYaml: () => ({}),
}));
jest.mock("./services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { TFile } from "obsidian";
import {
  backupTemplate,
  checkAndCreateTemplates,
  DEFAULT_TEMPLATE_NAMES,
  DEFAULT_TEMPLATES,
  reconcileDefaultTemplates,
  restoreDefaultTemplates,
} from "./fileUtils";

const fixture = (name: string) => readFileSync(join(__dirname, "lib/__fixtures__/default-templates", name), "utf8");
const current = (name: string) => DEFAULT_TEMPLATES.find(t => t.name === name)!.content();
const settings = { templatePaths: "Templates" } as never;
const path = (name: string) => `Templates/${name}`;

/** A vault with just enough API for the template code. */
function fakeVault(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const trashed: string[] = [];
  const folders = new Set<string>(["Templates"]);
  const fileAt = (p: string) => Object.assign(new TFile(), { path: p });
  const app = {
    vault: {
      adapter: { exists: async (p: string) => files.has(p) || folders.has(p) },
      createFolder: async (p: string) => void folders.add(p),
      create: async (p: string, data: string) => {
        if (files.has(p)) throw new Error(`exists: ${p}`);
        files.set(p, data);
      },
      read: async (f: { path: string }) => files.get(f.path)!,
      modify: async (f: { path: string }, data: string) => void files.set(f.path, data),
      getAbstractFileByPath: (p: string) => (files.has(p) ? fileAt(p) : null),
    },
    fileManager: {
      trashFile: async (f: { path: string }) => {
        trashed.push(f.path);
        files.delete(f.path);
      },
    },
  };
  return { app: app as never, files, trashed, folders };
}

describe("DEFAULT_TEMPLATES", () => {
  it("is the one list: names derive from it and it includes lecture_notes", () => {
    expect(DEFAULT_TEMPLATE_NAMES).toEqual(DEFAULT_TEMPLATES.map(t => t.name));
    expect(DEFAULT_TEMPLATE_NAMES).toContain("lecture_notes.md");
    expect(DEFAULT_TEMPLATE_NAMES).toHaveLength(11);
  });

  it("creates every default template when missing and leaves existing files alone", async () => {
    const { app, files } = fakeVault({ [path("quiz.md")]: "my own quiz" });
    await checkAndCreateTemplates(app, settings);
    for (const name of DEFAULT_TEMPLATE_NAMES) expect(files.has(path(name))).toBe(true);
    expect(files.get(path("quiz.md"))).toBe("my own quiz");
    expect(files.get(path("lecture_notes.md"))).toBe(current("lecture_notes.md"));
  });
});

describe("reconcileDefaultTemplates", () => {
  it("replaces an unedited older default with the current one", async () => {
    const { app, files } = fakeVault({ [path("lecture_notes.md")]: fixture("lecture_notes.v1.txt") });
    const result = await reconcileDefaultTemplates(app, settings);

    expect(result).toEqual({ updated: ["lecture_notes.md"], edited: [] });
    expect(files.get(path("lecture_notes.md"))).toBe(current("lecture_notes.md"));
  });

  it("still recognises an older default whose line endings were changed", async () => {
    const crlf = fixture("lecture_notes.v1.txt").replace(/\n/g, "\r\n");
    const { app, files } = fakeVault({ [path("lecture_notes.md")]: crlf });
    expect((await reconcileDefaultTemplates(app, settings)).updated).toEqual(["lecture_notes.md"]);
    expect(files.get(path("lecture_notes.md"))).toBe(current("lecture_notes.md"));
  });

  it("never touches an edited template, old or current, and reports it", async () => {
    const editedOld = fixture("lecture_notes.v1.txt") + "\n- Always answer in French.";
    const editedCurrent = current("flash_cards.md") + "\nMy extra rule.";
    const { app, files } = fakeVault({
      [path("lecture_notes.md")]: editedOld,
      [path("flash_cards.md")]: editedCurrent,
    });
    const result = await reconcileDefaultTemplates(app, settings);

    expect(result.updated).toEqual([]);
    expect([...result.edited].sort()).toEqual(["flash_cards.md", "lecture_notes.md"]);
    expect(files.get(path("lecture_notes.md"))).toBe(editedOld);
    expect(files.get(path("flash_cards.md"))).toBe(editedCurrent);
  });

  it("leaves current templates alone, including one that only differs in trailing whitespace", async () => {
    const { app, files } = fakeVault({
      [path("quiz.md")]: current("quiz.md"),
      [path("meeting_note.md")]: fixture("meeting_note.before-420.txt"),
    });
    const result = await reconcileDefaultTemplates(app, settings);

    expect(result).toEqual({ updated: [], edited: [] });
    expect(files.get(path("quiz.md"))).toBe(current("quiz.md"));
    expect(files.get(path("meeting_note.md"))).toBe(fixture("meeting_note.before-420.txt"));
  });

  it("does not create a missing default and ignores custom templates", async () => {
    const { app, files } = fakeVault({ [path("my_template.md")]: fixture("lecture_notes.v1.txt") });
    const result = await reconcileDefaultTemplates(app, settings);

    expect(result).toEqual({ updated: [], edited: [] });
    expect([...files.keys()]).toEqual([path("my_template.md")]);
  });

  it("keeps going when one file cannot be read", async () => {
    const { app, files } = fakeVault({
      [path("lecture_notes.md")]: fixture("lecture_notes.v1.txt"),
      [path("youtube_video.md")]: fixture("youtube_video.v1.txt"),
    });
    const read = (app as never as { vault: { read: (f: { path: string }) => Promise<string> } }).vault.read;
    (app as never as { vault: { read: unknown } }).vault.read = async (f: { path: string }) => {
      if (f.path === path("lecture_notes.md")) throw new Error("locked");
      return read(f);
    };
    const result = await reconcileDefaultTemplates(app, settings);

    expect(result.updated).toEqual(["youtube_video.md"]);
    expect(files.get(path("lecture_notes.md"))).toBe(fixture("lecture_notes.v1.txt"));
  });
});

describe("backupTemplate", () => {
  it("saves to _previous with the date, and never overwrites an earlier backup", async () => {
    const { app, files, folders } = fakeVault();
    const day = new Date("2026-11-30T10:00:00Z");
    const first = await backupTemplate(app, settings, "quiz.md", "v1", day);
    const second = await backupTemplate(app, settings, "quiz.md", "v2", day);

    expect(first).toBe("Templates/_previous/quiz (2026-11-30).md");
    expect(second).toBe("Templates/_previous/quiz (2026-11-30) 1.md");
    expect(files.get(first)).toBe("v1");
    expect(files.get(second)).toBe("v2");
    expect(folders.has("Templates/_previous")).toBe(true);
  });
});

describe("restoreDefaultTemplates", () => {
  it("saves an edited template to _previous before replacing it", async () => {
    const edited = current("lecture_notes.md") + "\n- Always answer in French.";
    const { app, files, trashed } = fakeVault({ [path("lecture_notes.md")]: edited });
    await restoreDefaultTemplates(app, settings);

    const backups = [...files.keys()].filter(p => p.startsWith("Templates/_previous/"));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^Templates\/_previous\/lecture_notes \(\d{4}-\d{2}-\d{2}\)\.md$/);
    expect(files.get(backups[0])).toBe(edited);
    expect(files.get(path("lecture_notes.md"))).toBe(current("lecture_notes.md"));
    expect(trashed).toContain(path("lecture_notes.md"));
  });

  it("replaces unedited and outdated templates without a backup, and restores all 11", async () => {
    const { app, files } = fakeVault({
      [path("quiz.md")]: current("quiz.md"),
      [path("lecture_notes.md")]: fixture("lecture_notes.v1.txt"),
    });
    await restoreDefaultTemplates(app, settings);

    expect([...files.keys()].some(p => p.includes("_previous"))).toBe(false);
    for (const { name, content } of DEFAULT_TEMPLATES) expect(files.get(path(name))).toBe(content());
  });

  it("leaves custom templates alone", async () => {
    const { app, files } = fakeVault({ [path("my_template.md")]: "mine" });
    await restoreDefaultTemplates(app, settings);
    expect(files.get(path("my_template.md"))).toBe("mine");
  });
});
