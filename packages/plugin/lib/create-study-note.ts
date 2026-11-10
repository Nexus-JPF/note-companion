import { normalizePath, TFile } from "obsidian";
import type FileOrganizer from "../index";
import { logger } from "../services/logger";
import { appendBeforeBackupFooter } from "./audio-source";
import {
  buildStudySource,
  hasEnoughToStudy,
  studyNoteBasename,
  studyNoteLink,
  withSourceProperty,
} from "../inbox/study-note";
import { measureFormatContentTokens } from "../inbox/services/youtube-service";

/**
 * Generates a study note (flashcards, quiz...) from a lecture note and links
 * the two. Writes the new note next to the lecture, with no split view and no
 * audio embed or transcript. Returns null when there is too little to study
 * from; throws with a user-readable message when generation fails.
 */
export async function createStudyNote(
  plugin: FileOrganizer,
  sourceFile: TFile,
  template: string
): Promise<TFile | null> {
  const { app, settings } = plugin;

  const source = buildStudySource(await app.vault.read(sourceFile));
  if (!hasEnoughToStudy(source)) {
    logger.info("Skipping study note: not enough content", { file: sourceFile.path });
    return null;
  }

  const tokens = await measureFormatContentTokens(source);
  if (tokens > settings.maxFormattingTokens) {
    throw new Error(
      `the content is too large (${tokens} tokens). Increase the formatting token limit in settings`
    );
  }

  const instructions = await plugin.getTemplateInstructions(template);
  if (!instructions) {
    throw new Error(`the template "${template}" was not found`);
  }

  const generated = await plugin.formatStream(
    source,
    instructions,
    plugin.getServerUrl(),
    settings.API_KEY,
    () => {}
  );
  const content = plugin.cleanupTagsInContent(generated).trim();
  if (!content) throw new Error("the AI returned an empty note");

  const basename = studyNoteBasename(sourceFile.basename, template);
  const folder = sourceFile.parent?.path ?? "";
  const pathFor = (suffix: string) =>
    normalizePath(`${folder === "/" ? "" : folder}/${basename}${suffix}.md`);
  let path = pathFor("");
  for (let n = 2; await app.vault.adapter.exists(path); n++) {
    if (n > 100) throw new Error("could not find a free file name");
    path = pathFor(` ${n}`);
  }

  const created = await app.vault.create(
    path,
    withSourceProperty(content, sourceFile.basename)
  );

  const link = studyNoteLink(template, created.basename);
  await app.vault.process(sourceFile, data =>
    data.includes(`[[${created.basename}]]`) ? data : appendBeforeBackupFooter(data, link)
  );

  return created;
}
