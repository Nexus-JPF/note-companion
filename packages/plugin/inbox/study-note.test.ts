import {
  buildStudySource,
  hasEnoughToStudy,
  keepsAudioSourceInNewFile,
  resolveStudyTemplate,
  studyNoteBasename,
  studyNoteLabel,
  studyNoteLink,
  withSourceProperty,
} from "./study-note";

const LONG_NOTES = `# Vaccines\n\n## Summary\n${"Vaccines train the adaptive immune system. ".repeat(20)}`;
const TRANSCRIPT = "Good morning everyone. Today we talk about how vaccines work. ".repeat(10).trim();

describe("resolveStudyTemplate", () => {
  it("is off for none, empty and unset", () => {
    expect(resolveStudyTemplate("none")).toBeNull();
    expect(resolveStudyTemplate("")).toBeNull();
    expect(resolveStudyTemplate(undefined)).toBeNull();
  });
  it("returns the template name and ignores .md", () => {
    expect(resolveStudyTemplate("flash_cards")).toBe("flash_cards");
    expect(resolveStudyTemplate("flash_cards.md")).toBe("flash_cards");
  });
  it("refuses youtube templates, which cannot run on audio", () => {
    expect(resolveStudyTemplate("youtube_qa")).toBeNull();
  });
});

describe("studyNoteLabel and studyNoteBasename", () => {
  it("names known and custom templates", () => {
    expect(studyNoteLabel("flash_cards")).toBe("Flashcards");
    expect(studyNoteLabel("practice_quiz.md")).toBe("Practice quiz");
    expect(studyNoteLabel("")).toBe("Study note");
  });
  it("builds a file-safe, link-safe basename", () => {
    expect(studyNoteBasename("Immunity: how it [works]?", "flash_cards")).toBe(
      "Immunity how it works - Flashcards"
    );
    expect(studyNoteBasename("???", "flash_cards")).toBe("Recording - Flashcards");
  });
  it("shortens very long titles", () => {
    expect(studyNoteBasename("a".repeat(300), "flash_cards").length).toBeLessThan(140);
  });
});

describe("buildStudySource", () => {
  it("uses the formatted notes without the audio, transcript or footer", () => {
    const note = `---\ntags: [a]\n---\n![[lecture.m4a]]\n\n${LONG_NOTES}\n\n> [!note]- Transcript for lecture\n> ${TRANSCRIPT}\n\n---\n[[Backup Link to original file]]`;
    const source = buildStudySource(note);
    expect(source).toContain("Vaccines train the adaptive immune system.");
    expect(source).not.toContain("![[lecture.m4a]]");
    expect(source).not.toContain("Good morning everyone");
    expect(source).not.toContain("Link to original file");
    expect(source).not.toContain("tags: [a]");
  });
  it("falls back to the transcript when the note is only a stub", () => {
    const note = `![[lecture.m4a]]\n\n## Transcript for lecture\n\n${TRANSCRIPT}`;
    expect(buildStudySource(note)).toBe(TRANSCRIPT);
  });
  it("is empty for a note with nothing in it", () => {
    expect(hasEnoughToStudy(buildStudySource("![[lecture.m4a]]"))).toBe(false);
  });
  it("accepts a normal-sized source", () => {
    expect(hasEnoughToStudy(LONG_NOTES)).toBe(true);
  });
});

describe("withSourceProperty", () => {
  it("adds the property to existing frontmatter", () => {
    const out = withSourceProperty("---\ntotal: 12\n---\n\nCards", "Lecture");
    expect(out).toBe('---\ntotal: 12\nsource: "[[Lecture]]"\n---\n\nCards');
  });
  it("creates frontmatter when there is none", () => {
    expect(withSourceProperty("Cards", "Lecture")).toBe(
      '---\nsource: "[[Lecture]]"\n---\n\nCards'
    );
  });
  it("does not overwrite an existing source", () => {
    const note = '---\nsource: "elsewhere"\n---\nCards';
    expect(withSourceProperty(note, "Lecture")).toBe(note);
  });
});

describe("studyNoteLink and keepsAudioSourceInNewFile", () => {
  it("links the study note by label", () => {
    expect(studyNoteLink("flash_cards", "L - Flashcards")).toBe(
      "**Flashcards:** [[L - Flashcards]]"
    );
  });
  it("keeps audio in a new file for every template except flash_cards", () => {
    expect(keepsAudioSourceInNewFile("lecture_notes")).toBe(true);
    expect(keepsAudioSourceInNewFile("flash_cards")).toBe(false);
    expect(keepsAudioSourceInNewFile("flash_cards.md")).toBe(false);
  });
});
