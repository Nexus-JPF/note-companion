import { readFileSync } from "fs";
import { join } from "path";
import { classifyDefaultTemplate, fingerprintText, normalizeTemplateText } from "./template-fingerprints";
import { KNOWN_DEFAULT_FINGERPRINTS } from "./default-template-fingerprints";

jest.mock("obsidian", () => ({
  App: class {},
  TFolder: class {},
  TFile: class {},
  normalizePath: (p: string) => p,
  parseYaml: () => ({}),
}));
jest.mock("../services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { DEFAULT_TEMPLATES } from "../fileUtils";

/** Real texts of older releases' defaults, taken from git history by scripts/generate-template-fingerprints.mjs. */
const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__/default-templates", name), "utf8");
const current = (name: string) => DEFAULT_TEMPLATES.find(t => t.name === name)!.content();

describe("normalizeTemplateText", () => {
  it("ignores line endings and trailing whitespace on every line, nothing else", () => {
    expect(normalizeTemplateText("a  \r\nb\t\r\n\r\nc")).toBe("a\nb\n\nc");
    expect(normalizeTemplateText("a b")).not.toBe(normalizeTemplateText("a  b"));
    expect(normalizeTemplateText("  a")).toBe("  a");
  });
});

describe("fingerprintText", () => {
  it("is the same for texts that differ only in what is ignored, and different otherwise", () => {
    expect(fingerprintText("one  \ntwo\n")).toBe(fingerprintText("one\r\ntwo\r\n"));
    expect(fingerprintText("one\ntwo")).not.toBe(fingerprintText("one\ntwo."));
    expect(fingerprintText("one\ntwo")).not.toBe(fingerprintText("two\none"));
  });

  it("is a fixed-width hex string", () => {
    expect(fingerprintText("x")).toMatch(/^[0-9a-f]{14}$/);
    expect(fingerprintText("")).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe("known default fingerprints", () => {
  // Counts at the time the list was generated. The list is append-only: it may grow, never shrink.
  const MIN_KNOWN: Record<string, number> = {
    "meeting_note.md": 1,
    "research_paper.md": 1,
    "enhance.md": 1,
    "youtube_video.md": 10,
    "youtube_summary.md": 1,
    "youtube_key_concepts.md": 1,
    "youtube_qa.md": 1,
    "youtube_timestamped_outline.md": 1,
    "flash_cards.md": 4,
    "lecture_notes.md": 3,
    "quiz.md": 2,
  };

  it("covers every default template, with the current text last", () => {
    for (const { name, content } of DEFAULT_TEMPLATES) {
      const list = KNOWN_DEFAULT_FINGERPRINTS[name];
      expect(list).toBeDefined();
      // Fails after a default changes until scripts/generate-template-fingerprints.mjs is run and its result committed.
      expect(list[list.length - 1]).toBe(fingerprintText(content()));
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("never loses a fingerprint", () => {
    for (const [name, min] of Object.entries(MIN_KNOWN)) {
      expect(KNOWN_DEFAULT_FINGERPRINTS[name].length).toBeGreaterThanOrEqual(min);
    }
    expect(Object.keys(MIN_KNOWN).sort()).toEqual(DEFAULT_TEMPLATES.map(t => t.name).sort());
  });

  it("has no entry for a template that is not a default", () => {
    expect(Object.keys(KNOWN_DEFAULT_FINGERPRINTS).sort()).toEqual(DEFAULT_TEMPLATES.map(t => t.name).sort());
  });
});

describe("classifyDefaultTemplate on real old defaults", () => {
  it("calls the first lecture_notes (#557) outdated, and still outdated with CRLF line endings", () => {
    const old = fixture("lecture_notes.v1.txt");
    expect(old).not.toBe(current("lecture_notes.md"));
    expect(classifyDefaultTemplate("lecture_notes.md", old, current("lecture_notes.md"))).toBe("outdated");
    expect(classifyDefaultTemplate("lecture_notes.md", old.replace(/\n/g, "\r\n"), current("lecture_notes.md"))).toBe("outdated");
  });

  it("calls the first youtube_video outdated", () => {
    expect(classifyDefaultTemplate("youtube_video.md", fixture("youtube_video.v1.txt"), current("youtube_video.md"))).toBe("outdated");
  });

  it("calls meeting_note from before #420 (trailing markdown spaces, since stripped) current, not edited", () => {
    const old = fixture("meeting_note.before-420.txt");
    expect(old).not.toBe(current("meeting_note.md"));
    expect(/ $/m.test(old)).toBe(true);
    expect(classifyDefaultTemplate("meeting_note.md", old, current("meeting_note.md"))).toBe("current");
  });

  it("calls the current default current", () => {
    for (const { name, content } of DEFAULT_TEMPLATES) {
      expect(classifyDefaultTemplate(name, content(), content())).toBe("current");
    }
  });

  it("calls any change to a default edited, even one added to an old version", () => {
    const edited = (text: string) => classifyDefaultTemplate("lecture_notes.md", text, current("lecture_notes.md"));
    expect(edited(current("lecture_notes.md") + "\n- Always answer in French.")).toBe("edited");
    expect(edited(fixture("lecture_notes.v1.txt") + "\n- Always answer in French.")).toBe("edited");
    expect(edited(current("lecture_notes.md").replace("Summary", "Overview"))).toBe("edited");
    expect(edited("")).toBe("edited");
  });

  it("calls a file under a name that is not a default edited, never outdated", () => {
    expect(classifyDefaultTemplate("my_template.md", fixture("lecture_notes.v1.txt"), "whatever")).toBe("edited");
  });
});
