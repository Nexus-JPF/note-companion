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

  it("uses the click-to-reveal layout the quiz note relies on", async () => {
    const { app, files } = fakeApp();
    await checkAndCreateTemplates(app, settings);
    const template = files.get("Templates/quiz.md")!;

    expect(template).toContain('<details class="quiz-answer">');
    expect(template).toContain("<summary>Show answer</summary>");
    expect(template).toContain("- A. ");
    expect(template).toContain("- D. ");
  });
});
