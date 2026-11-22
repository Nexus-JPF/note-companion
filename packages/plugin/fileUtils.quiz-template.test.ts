jest.mock("obsidian", () => ({
  App: class {},
  TFolder: class {},
  TFile: class {},
  normalizePath: (p: string) => p,
  parseYaml: () => ({}),
}));
jest.mock("./services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { checkAndCreateTemplates, DEFAULT_TEMPLATE_NAMES } from "./fileUtils";

function fakeApp(existing: string[] = []) {
  const files = new Map<string, string>(existing.map(p => [p, "user copy"]));
  const app = {
    vault: {
      adapter: { exists: async (p: string) => files.has(p) },
      create: async (p: string, data: string) => void files.set(p, data),
    },
  };
  return { app: app as never, files };
}

const settings = { templatePaths: "Templates" } as never;

describe("bundled quiz template", () => {
  it("is listed as a default template and created when missing", async () => {
    expect(DEFAULT_TEMPLATE_NAMES).toContain("quiz.md");
    const { app, files } = fakeApp();
    await checkAndCreateTemplates(app, settings);
    expect(files.has("Templates/quiz.md")).toBe(true);
  });

  it("never overwrites a quiz template the user already has", async () => {
    const { app, files } = fakeApp(["Templates/quiz.md"]);
    await checkAndCreateTemplates(app, settings);
    expect(files.get("Templates/quiz.md")).toBe("user copy");
  });

  it("asks for the agreed shape: four options, one answer, click-to-reveal, content only", async () => {
    const { app, files } = fakeApp();
    await checkAndCreateTemplates(app, settings);
    const template = files.get("Templates/quiz.md")!;

    expect(template).toContain("exactly four options, A to D");
    expect(template).toContain("exactly one of them is correct");
    expect(template).toContain("Never use \"all of the above\"");
    expect(template).toContain("Vary which letter is correct");
    expect(template).toContain("Use only facts stated in the content");
    expect(template).toContain("in the language of the content");
    expect(template).toContain('<details class="quiz-answer">');
    expect(template).toContain("<summary>Show answer</summary>");
    expect(template).toContain("never print that list");
    expect(template).not.toContain("flashcard");
  });
});
