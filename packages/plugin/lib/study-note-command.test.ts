jest.mock("obsidian", () => ({ normalizePath: (p: string) => p, TFile: class {} }));
jest.mock("../services/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("./create-study-note", () => ({
  createStudyNote: jest.fn(),
  findExistingStudyNote: jest.fn(),
}));

import { createStudyNote, findExistingStudyNote } from "./create-study-note";
import { ALREADY_A_STUDY_NOTE, NOT_ENOUGH_TO_STUDY, runStudyNoteCommand, type StudyNoteUi } from "./study-note-command";

const create = createStudyNote as jest.Mock;
const findExisting = findExistingStudyNote as jest.Mock;

const NOTES = `# Vaccines\n\n${"Vaccines train the adaptive immune system. ".repeat(20)}`;
const file = { path: "L/Immunity.md", basename: "Immunity" } as never;
const study = { path: "L/Immunity - Flashcards.md", basename: "Immunity - Flashcards" } as never;

function setup(opts: { content?: string; template?: string | null; choice?: "open" | "regenerate" | null } = {}) {
  const hide = jest.fn();
  const ui = {
    pickFormat: jest.fn(async () => (opts.template === undefined ? "flash_cards" : opts.template)),
    askExisting: jest.fn(async () => opts.choice ?? null),
    notice: jest.fn(),
    progress: jest.fn(() => hide),
    open: jest.fn(async () => {}),
  } satisfies StudyNoteUi;
  const plugin = { app: { vault: { read: async () => opts.content ?? NOTES } } } as never;
  return { ui, plugin, hide };
}

beforeEach(() => {
  create.mockReset();
  findExisting.mockReset();
  findExisting.mockResolvedValue(null);
  create.mockResolvedValue(study);
});

describe("runStudyNoteCommand", () => {
  it("creates a study note with a progress notice that is always dismissed", async () => {
    const { ui, plugin, hide } = setup();
    await runStudyNoteCommand(plugin, file, ui);

    expect(create).toHaveBeenCalledWith(plugin, file, "flash_cards", { replace: undefined });
    expect(ui.progress).toHaveBeenCalledWith("Creating flashcards for Immunity…");
    expect(hide).toHaveBeenCalledTimes(1);
    expect(ui.notice).toHaveBeenCalledWith("Created Immunity - Flashcards");
  });

  it("tells the user and costs nothing when the note is too short, before showing the picker", async () => {
    const { ui, plugin } = setup({ content: "short" });
    await runStudyNoteCommand(plugin, file, ui);

    expect(ui.notice).toHaveBeenCalledWith(NOT_ENOUGH_TO_STUDY);
    expect(ui.pickFormat).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to run on a study note itself", async () => {
    const { ui, plugin } = setup({ content: `---\nsource: "[[Immunity]]"\n---\n\n${NOTES}` });
    await runStudyNoteCommand(plugin, file, ui);

    expect(ui.notice).toHaveBeenCalledWith(ALREADY_A_STUDY_NOTE);
    expect(ui.pickFormat).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is dismissed", async () => {
    const { ui, plugin } = setup({ template: null });
    await runStudyNoteCommand(plugin, file, ui);
    expect(create).not.toHaveBeenCalled();
    expect(ui.notice).not.toHaveBeenCalled();
  });

  it("opens the existing note without generating", async () => {
    findExisting.mockResolvedValue(study);
    const { ui, plugin } = setup({ choice: "open" });
    await runStudyNoteCommand(plugin, file, ui);

    expect(ui.askExisting).toHaveBeenCalledWith("Flashcards", study);
    expect(ui.open).toHaveBeenCalledWith(study);
    expect(create).not.toHaveBeenCalled();
  });

  it("regenerates the existing note in place", async () => {
    findExisting.mockResolvedValue(study);
    const { ui, plugin } = setup({ choice: "regenerate" });
    await runStudyNoteCommand(plugin, file, ui);

    expect(create).toHaveBeenCalledWith(plugin, file, "flash_cards", { replace: study });
    expect(ui.notice).toHaveBeenCalledWith("Regenerated Immunity - Flashcards");
    expect(ui.open).not.toHaveBeenCalled();
  });

  it("cancelling the existing-note choice changes nothing", async () => {
    findExisting.mockResolvedValue(study);
    const { ui, plugin } = setup({ choice: null });
    await runStudyNoteCommand(plugin, file, ui);
    expect(create).not.toHaveBeenCalled();
    expect(ui.open).not.toHaveBeenCalled();
  });

  it("reports a failure with its reason and still dismisses the progress notice", async () => {
    create.mockRejectedValue(new Error("the content is too large (9 tokens)"));
    const { ui, plugin, hide } = setup();
    await runStudyNoteCommand(plugin, file, ui);

    expect(hide).toHaveBeenCalledTimes(1);
    expect(ui.notice).toHaveBeenCalledWith(
      "Could not create the study note for Immunity: the content is too large (9 tokens)",
      8000
    );
  });

  it("ignores a second run on the same note while the first is going, then allows another", async () => {
    let release!: () => void;
    create.mockImplementationOnce(() => new Promise(resolve => (release = () => resolve(study))));
    const first = setup();
    const running = runStudyNoteCommand(first.plugin, file, first.ui);
    await new Promise(r => setTimeout(r, 0));

    const second = setup();
    await runStudyNoteCommand(second.plugin, file, second.ui);
    expect(second.ui.notice).toHaveBeenCalledWith("A study note is already in progress for Immunity.");
    expect(second.ui.pickFormat).not.toHaveBeenCalled();

    release();
    await running;
    const third = setup();
    await runStudyNoteCommand(third.plugin, file, third.ui);
    expect(third.ui.pickFormat).toHaveBeenCalled();
  });
});
