import { backupFooter, inlineTagAppendix } from "../lib/note-footer";
import {
  buildStudySource,
  linksToStudyNote,
  stripStudyNoteLinks,
  withStudyNoteLink,
  findStudyNoteLinkTarget,
  hasEnoughToStudy,
  keepsAudioSourceInNewFile,
  countSkippedQuizQuestions,
  finishStudyContent,
  maxFlashcards,
  maxQuizQuestions,
  STUDY_FORMATS,
  resolveStudyTemplate,
  shuffleQuizOptions,
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
  it("keeps audio in a new file for every template except the study formats", () => {
    expect(keepsAudioSourceInNewFile("lecture_notes")).toBe(true);
    expect(keepsAudioSourceInNewFile("flash_cards")).toBe(false);
    expect(keepsAudioSourceInNewFile("flash_cards.md")).toBe(false);
    expect(keepsAudioSourceInNewFile("quiz")).toBe(false);
    expect(keepsAudioSourceInNewFile("Quiz.md")).toBe(false);
  });
  it("links a quiz by its label", () => {
    expect(studyNoteLink("quiz", "L - Quiz")).toBe("**Quiz:** [[L - Quiz]]");
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

describe("maxQuizQuestions", () => {
  it("is about one question per 90 words, between 3 and 15", () => {
    expect(maxQuizQuestions(words(673))).toBe(7);
    expect(maxQuizQuestions(words(20))).toBe(3);
    expect(maxQuizQuestions("")).toBe(3);
    expect(maxQuizQuestions(words(20000))).toBe(15);
  });
});

describe("withStudyLimits for the quiz", () => {
  it("appends a question limit, with or without .md and a folder", () => {
    for (const template of ["quiz", "quiz.md", "Templates/Quiz.md"]) {
      const out = withStudyLimits("make a quiz", template, words(673));
      expect(out.startsWith("make a quiz")).toBe(true);
      expect(out).toContain("at most 7 questions");
      expect(out).not.toContain("cards");
    }
  });
});

describe("STUDY_FORMATS", () => {
  it("offers flashcards and quiz with their labels", () => {
    expect(STUDY_FORMATS).toEqual([
      { template: "flash_cards", label: "Flashcards" },
      { template: "quiz", label: "Quiz" },
    ]);
  });
});

// Output of a real run on the French vaccine lecture (3.6.47): the correct answer is B or C in every question.
const REAL_QUIZ = `---
total: 3
topics: ["Vaccination", "Immunité innée et adaptative"]
created: "2026-11-24"
---

**1. Quelle branche de l’immunité les vaccins entraînent-ils principalement ?**

- A. L’immunité innée
- B. L’immunité adaptative
- C. L’immunité générale
- D. L’immunité sans mémoire

<details class="quiz-answer">
<summary>Show answer</summary>

**B.** Les vaccins entraînent principalement l’immunité adaptative, qui est spécifique et possède une mémoire.

</details>

**2. Qu’est-ce qu’un vaccin ?**

- A. Une préparation qui détruit directement toutes les cellules infectées
- B. Une préparation qui présente un aperçu inoffensif d’un agent pathogène
- C. Une réponse rapide et générale du système immunitaire
- D. Une protéine qui se lie à un antigène précis

<details class="quiz-answer">
<summary>Show answer</summary>

**B.** Un vaccin présente au corps un aperçu inoffensif d’un agent pathogène afin de préparer le système immunitaire.

</details>

**3. Quel est le rôle des lymphocytes B ?**

- A. Ils présentent les antigènes aux lymphocytes auxiliaires
- B. Ils détruisent les cellules infectées
- C. Ils produisent des anticorps liés à des antigènes précis
- D. Ils coordonnent toute la réponse immunitaire

<details class="quiz-answer">
<summary>Show answer</summary>

**C.** Les lymphocytes B fabriquent des anticorps qui se lient à un antigène précis de l’agent pathogène.

</details>
`;

/** Each question as { options by letter, correct letter, correct text }, read from the note the way a student would. */
function readQuiz(content: string) {
  return [...content.matchAll(/((?:- [A-D]\. [^\n]*\n){3}- [A-D]\. [^\n]*)[\s\S]*?\n\*\*([A-D])\./g)].map(m => {
    const options = m[1].split("\n").map(line => line.replace(/^- [A-D]\. /, ""));
    return { options, letter: m[2], correct: options["ABCD".indexOf(m[2])] };
  });
}

/** Deterministic, well-mixed random numbers for the tests (mulberry32). */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("shuffleQuizOptions", () => {
  const before = readQuiz(REAL_QUIZ);

  it("keeps every option and the correct answer, and leaves the rest of the note alone", () => {
    const after = readQuiz(shuffleQuizOptions(REAL_QUIZ, seeded(1)));
    expect(after).toHaveLength(before.length);
    after.forEach((q, i) => {
      expect([...q.options].sort()).toEqual([...before[i].options].sort());
      expect(q.correct).toBe(before[i].correct);
    });

    const text = shuffleQuizOptions(REAL_QUIZ, seeded(1));
    expect(text.split("\n").filter(l => !/^- [A-D]\. /.test(l) && !/^\*\*[A-D]\./.test(l)))
      .toEqual(REAL_QUIZ.split("\n").filter(l => !/^- [A-D]\. /.test(l) && !/^\*\*[A-D]\./.test(l)));
    expect(text).toContain("<summary>Show answer</summary>");
  });

  it("keeps the explanation text after the letter", () => {
    const text = shuffleQuizOptions(REAL_QUIZ, seeded(7));
    expect(text).toContain("Les vaccins entraînent principalement l’immunité adaptative, qui est spécifique");
    expect(text).toMatch(/\*\*[A-D]\.\*\* Les lymphocytes B fabriquent/);
  });

  it("spreads the correct letter over A-D instead of leaving it on B and C", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      REAL_QUIZ.split("**1.")[1].split("**2.")[0].replace(/^/, `**${i + 1}.`)
    ).join("\n");
    const letters = readQuiz(shuffleQuizOptions(many, seeded(3))).map(q => q.letter);
    for (const letter of ["A", "B", "C", "D"]) {
      expect(letters.filter(l => l === letter)).toHaveLength(2);
    }
  });

  it("uses all four letters across a real 3-question quiz at least twice over many seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      readQuiz(shuffleQuizOptions(REAL_QUIZ, seeded(seed))).forEach(q => seen.add(q.letter));
    }
    expect([...seen].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("leaves a question that does not match the template shape untouched, and still shuffles the rest", () => {
    const broken = REAL_QUIZ.replace("- D. L’immunité sans mémoire\n", "");
    const after = shuffleQuizOptions(broken, seeded(5));
    expect(after).toContain("- A. L’immunité innée\n- B. L’immunité adaptative\n- C. L’immunité générale\n");
    expect(readQuiz(after).slice(-2).map(q => q.correct)).toEqual(before.slice(-2).map(q => q.correct));
  });

  it("is a no-op for content that is not a quiz", () => {
    expect(shuffleQuizOptions("# Notes\n\n- A. not a quiz")).toBe("# Notes\n\n- A. not a quiz");
  });

  it("is applied to the quiz template only", () => {
    const cards = '<details class="flashcard"><summary>Q</summary>A</details>';
    expect(finishStudyContent(cards, "flash_cards")).toBe(cards);
    const out = finishStudyContent(REAL_QUIZ, "Templates/quiz.md", seeded(2));
    expect(readQuiz(out).map(q => q.correct)).toEqual(before.map(q => q.correct));
  });
});

describe("countSkippedQuizQuestions", () => {
  it("is zero when every question matches the template shape or the content is not a quiz", () => {
    expect(countSkippedQuizQuestions(REAL_QUIZ)).toBe(0);
    expect(countSkippedQuizQuestions('<details class="flashcard"><summary>Q</summary>A</details>')).toBe(0);
  });

  it("counts the questions the shuffle cannot read", () => {
    const broken = REAL_QUIZ.replace("- D. L’immunité sans mémoire\n", "").replace("- B. Ils détruisent", "- B Ils détruisent");
    expect(countSkippedQuizQuestions(broken)).toBe(2);
  });
});
