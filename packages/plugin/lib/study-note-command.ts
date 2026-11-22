import type { TFile } from "obsidian";
import type FileOrganizer from "../index";
import { logger } from "../services/logger";
import { getErrorMessage } from "./api-json";
import { buildStudySource, hasEnoughToStudy, studyNoteLabel } from "../inbox/study-note";
import { createStudyNote, findExistingStudyNote } from "./create-study-note";

/** What the user can do when a study note of the chosen format already exists. */
export type ExistingChoice = "open" | "regenerate";

/** The parts of the command that touch Obsidian's UI, so the flow can be tested without it. */
export interface StudyNoteUi {
  /** Template chosen from the format picker, or null if dismissed. */
  pickFormat(): Promise<string | null>;
  /** Open the existing study note, regenerate it, or null to cancel. */
  askExisting(label: string, existing: TFile): Promise<ExistingChoice | null>;
  notice(message: string, durationMs?: number): void;
  /** A notice that stays until the returned function is called. */
  progress(message: string): () => void;
  open(file: TFile): Promise<void>;
}

const running = new Set<string>();

export const NOT_ENOUGH_TO_STUDY = "Not enough text in this note to make a study note.";

/**
 * "Create study note from this note": pick a format, then create the study
 * note, or open / regenerate the existing one. Never throws; every outcome is
 * reported through a notice.
 */
export async function runStudyNoteCommand(
  plugin: FileOrganizer,
  file: TFile,
  ui: StudyNoteUi
): Promise<void> {
  if (running.has(file.path)) {
    ui.notice(`A study note is already being created for ${file.basename}.`);
    return;
  }
  running.add(file.path);
  try {
    if (!hasEnoughToStudy(buildStudySource(await plugin.app.vault.read(file)))) {
      ui.notice(NOT_ENOUGH_TO_STUDY);
      return;
    }

    const template = await ui.pickFormat();
    if (!template) return;
    const label = studyNoteLabel(template);

    const existing = await findExistingStudyNote(plugin, file, template);
    if (existing) {
      const choice = await ui.askExisting(label, existing);
      if (choice === "open") await ui.open(existing);
      if (choice !== "regenerate") return;
    }

    const done = ui.progress(`Creating ${label.toLowerCase()} for ${file.basename}…`);
    try {
      const note = await createStudyNote(plugin, file, template, {
        replace: existing ?? undefined,
      });
      if (!note) ui.notice(NOT_ENOUGH_TO_STUDY);
      else ui.notice(`${existing ? "Regenerated" : "Created"} ${note.basename}`);
    } finally {
      done();
    }
  } catch (error) {
    const reason = getErrorMessage(error);
    logger.warn("Could not create study note", { file: file.path, reason });
    ui.notice(`Could not create the study note for ${file.basename}: ${reason}`, 8000);
  } finally {
    running.delete(file.path);
  }
}
