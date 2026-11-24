import { backupFooter, inlineTagAppendix } from "../lib/note-footer";
import {
  buildStudySource,
  linksToStudyNote,
  stripStudyNoteLinks,
  withStudyNoteLink,
  findStudyNoteLinkTarget,
  hasEnoughToStudy,
  keepsAudioSourceInNewFile,
  maxFlashcards,
  resolveStudyTemplate,
  studyNoteSource,
  studyNoteBasename,
  studyNoteLabel,
  studyNoteLink,
  withSourceProperty,
  withStudyLimits,
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

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("maxFlashcards", () => {
  it("is about one card per 45 words", () => {
    expect(maxFlashcards(words(590))).toBe(13);
  });

  it("never goes below 5 or above 30", () => {
    expect(maxFlashcards(words(30))).toBe(5);
    expect(maxFlashcards("")).toBe(5);
    expect(maxFlashcards(words(20000))).toBe(30);
  });
});

describe("withStudyLimits", () => {
  it("appends the hard limit for the flashcards template, with or without .md", () => {
    for (const template of ["flash_cards", "flash_cards.md", "Flash_Cards", "Templates/flash_cards.md"]) {
      const out = withStudyLimits("make cards", template, words(590));
      expect(out.startsWith("make cards")).toBe(true);
      expect(out).toContain("at most 13 cards");
    }
  });

  it("leaves every other template untouched", () => {
    expect(withStudyLimits("make a quiz", "practice_quiz", words(590))).toBe("make a quiz");
  });
});

describe("findStudyNoteLinkTarget", () => {
  const note = (tail: string) => {
    const withFooter = `# Lecture\n\nBody.\n\n${tail}${backupFooter("Backup")}`;
    return withFooter + inlineTagAppendix(withFooter, "#tag");
  };

  it("reads the target of the link line the pipeline writes", () => {
    const line = studyNoteLink("flash_cards", "Lecture - Flashcards");
    expect(findStudyNoteLinkTarget(note(line), "flash_cards")).toBe("Lecture - Flashcards");
    expect(findStudyNoteLinkTarget(note(line), "flash_cards.md")).toBe("Lecture - Flashcards");
  });

  it("ignores other formats, other lines and notes without a link", () => {
    const quiz = studyNoteLink("quiz", "Lecture - Quiz");
    expect(findStudyNoteLinkTarget(note(quiz), "flash_cards")).toBeNull();
    expect(findStudyNoteLinkTarget(note("Flashcards: [[x]]"), "flash_cards")).toBeNull();
    expect(findStudyNoteLinkTarget("# Lecture", "flash_cards")).toBeNull();
  });

  it("finds each format when a note carries both", () => {
    const both = note(`${studyNoteLink("flash_cards", "L - Flashcards")}\n${studyNoteLink("quiz", "L - Quiz")}`);
    expect(findStudyNoteLinkTarget(both, "flash_cards")).toBe("L - Flashcards");
    expect(findStudyNoteLinkTarget(both, "quiz")).toBe("L - Quiz");
  });

  it("drops an alias from the target", () => {
    expect(findStudyNoteLinkTarget(note("**Flashcards:** [[L - Flashcards|cards]]"), "flash_cards")).toBe("L - Flashcards");
  });
});

describe("findStudyNoteLinkTarget with subpaths", () => {
  it("drops a heading or block subpath", () => {
    expect(findStudyNoteLinkTarget("**Flashcards:** [[L - Flashcards#Part 1]]", "flash_cards")).toBe("L - Flashcards");
    expect(findStudyNoteLinkTarget("**Flashcards:** [[L - Flashcards#^abc|cards]]", "flash_cards")).toBe("L - Flashcards");
  });
});

describe("studyNoteSource", () => {
  it("reads the property withSourceProperty writes", () => {
    expect(studyNoteSource(withSourceProperty("---\ntotal: 3\n---\n\nCards", "Immunity"))).toBe("Immunity");
  });

  it("is null for a note without a wikilink source", () => {
    expect(studyNoteSource("# Lecture\n\nBody")).toBeNull();
    expect(studyNoteSource('---\nsource: "https://example.com/a"\n---\n\nClip')).toBeNull();
    expect(studyNoteSource('---\ntotal: 3\n---\n\nsource: "[[In body]]"')).toBeNull();
  });
});

describe("withStudyNoteLink", () => {
  const lecture = (middle = "") => {
    const body = `# Lecture\n\nBody.${middle}${backupFooter("Backup")}`;
    return body + inlineTagAppendix(body, "#tag");
  };

  it("adds the link above the footer and tags", () => {
    const out = withStudyNoteLink(lecture(), "flash_cards", "L - Flashcards");
    expect(out.indexOf("**Flashcards:** [[L - Flashcards]]")).toBeGreaterThan(-1);
    expect(out.indexOf("**Flashcards:**")).toBeLessThan(out.indexOf("---\n[["));
    expect(out.endsWith("#tag")).toBe(true);
  });

  it("is a no-op when the line already points at the study note", () => {
    const once = withStudyNoteLink(lecture(), "flash_cards", "L - Flashcards");
    expect(withStudyNoteLink(once, "flash_cards", "L - Flashcards")).toBe(once);
  });

  it("replaces a stale line instead of adding a second one", () => {
    const stale = lecture("\n\n**Flashcards:** [[Old name]]");
    const out = withStudyNoteLink(stale, "flash_cards", "L - Flashcards");
    expect(out.match(/\*\*Flashcards:\*\*/g)).toHaveLength(1);
    expect(out).toContain("**Flashcards:** [[L - Flashcards]]");
    expect(out).not.toContain("Old name");
  });

  it("keeps a line for another format", () => {
    const withQuiz = lecture("\n\n**Quiz:** [[L - Quiz]]");
    const out = withStudyNoteLink(withQuiz, "flash_cards", "L - Flashcards");
    expect(out).toContain("**Quiz:** [[L - Quiz]]");
    expect(out).toContain("**Flashcards:** [[L - Flashcards]]");
  });
});

describe("stripStudyNoteLinks and buildStudySource", () => {
  it("removes the link lines and nothing else", () => {
    const text = "# Lecture\n\nBody.\n\n**Flashcards:** [[L - Flashcards]]\n\nMore.";
    expect(stripStudyNoteLinks(text)).toBe("# Lecture\n\nBody.\n\nMore.");
  });

  it("keeps the link line out of the text sent to the model", () => {
    const note = `${LONG_NOTES}\n\n**Flashcards:** [[L - Flashcards]]`;
    expect(buildStudySource(note)).not.toContain("Flashcards");
  });
});

describe("linksToStudyNote", () => {
  it("is true only for the file the lecture links to", () => {
    const note = "Body\n\n**Flashcards:** [[L - Flashcards]]";
    expect(linksToStudyNote(note, "L - Flashcards")).toBe(true);
    expect(linksToStudyNote(note, "Other")).toBe(false);
    expect(linksToStudyNote("Body", "L - Flashcards")).toBe(false);
  });
});
