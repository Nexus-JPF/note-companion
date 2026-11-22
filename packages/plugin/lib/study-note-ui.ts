import { FuzzySuggestModal, Modal, Notice, type App, type TFile } from "obsidian";
import { STUDY_FORMATS } from "../inbox/study-note";
import type { ExistingChoice, StudyNoteUi } from "./study-note-command";

type Format = (typeof STUDY_FORMATS)[number];

class FormatPicker extends FuzzySuggestModal<Format> {
  private chosen = false;

  constructor(app: App, private readonly onDone: (template: string | null) => void) {
    super(app);
    this.setPlaceholder("Create a study note…");
  }

  getItems(): Format[] {
    return [...STUDY_FORMATS];
  }

  getItemText(format: Format): string {
    return format.label;
  }

  onChooseItem(format: Format): void {
    this.chosen = true;
    this.onDone(format.template);
  }

  onClose(): void {
    // onChooseItem runs after close, so defer the "dismissed" answer.
    window.setTimeout(() => {
      if (!this.chosen) this.onDone(null);
    }, 0);
  }
}

class ExistingModal extends Modal {
  private answered = false;

  constructor(
    app: App,
    private readonly label: string,
    private readonly existing: TFile,
    private readonly onDone: (choice: ExistingChoice | null) => void
  ) {
    super(app);
  }

  private answer(choice: ExistingChoice | null) {
    if (this.answered) return;
    this.answered = true;
    this.onDone(choice);
    this.close();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(`${this.label} already exist`);
    contentEl.createEl("p", { text: `This note already has ${this.existing.basename}.` });
    contentEl.createEl("p", {
      text: "Regenerating replaces that note and discards any changes you made to it.",
      cls: "setting-item-description",
    });
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: "Open it", cls: "mod-cta" }).addEventListener("click", () => this.answer("open"));
    buttons.createEl("button", { text: "Regenerate", cls: "mod-warning" }).addEventListener("click", () => this.answer("regenerate"));
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.answer(null));
  }

  onClose(): void {
    this.answer(null);
    this.contentEl.empty();
  }
}

/** Obsidian-backed implementation of the command's UI. */
export function createStudyNoteUi(app: App): StudyNoteUi {
  return {
    pickFormat: () => new Promise(resolve => new FormatPicker(app, resolve).open()),
    askExisting: (label, existing) =>
      new Promise(resolve => new ExistingModal(app, label, existing, resolve).open()),
    notice: (message, durationMs) => void new Notice(message, durationMs),
    progress: message => {
      const notice = new Notice(message, 0);
      return () => notice.hide();
    },
    open: async file => {
      await app.workspace.getLeaf(false).openFile(file);
    },
  };
}
