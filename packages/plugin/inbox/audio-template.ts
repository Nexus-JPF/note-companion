import { normalizePath, TFile, TFolder, type App } from "obsidian";

/** Settings value meaning "don't force a template for audio". */
export const AUDIO_TEMPLATE_OFF = "none";

/**
 * youtube_* templates need a video link and skip formatting without one, so
 * they are never valid for an audio recording.
 */
export function isAudioCompatibleTemplate(templateName: string): boolean {
  return !templateName.replace(/\.md$/i, "").toLowerCase().startsWith("youtube_");
}

/**
 * Template forced for audio files by the setting, or null when the setting is
 * off/empty or holds a template that cannot format audio (e.g. a saved or
 * hand-edited youtube_* value).
 */
export function resolveAudioDefaultTemplate(
  setting: string | undefined | null
): string | null {
  const name = (setting ?? "").replace(/\.md$/i, "").trim();
  if (!name || name.toLowerCase() === AUDIO_TEMPLATE_OFF) return null;
  return isAudioCompatibleTemplate(name) ? name : null;
}

export interface ForcedAudioTemplateInput {
  isAudioFile: boolean;
  /** True when transcription/extraction is off: the note is only an embed. */
  mediaExtractionSkipped: boolean;
  setting: string | undefined | null;
}

/** The template to force for this inbox file, or null to follow the normal rules. */
export function getForcedAudioTemplate({
  isAudioFile,
  mediaExtractionSkipped,
  setting,
}: ForcedAudioTemplateInput): string | null {
  if (!isAudioFile || mediaExtractionSkipped) return null;
  return resolveAudioDefaultTemplate(setting);
}

export type AudioTemplateDecision =
  | { kind: "use"; template: string }
  | { kind: "classify" }
  | { kind: "skip" };

/**
 * How the classify step treats a file: use the forced template when it exists,
 * otherwise classify if auto-formatting is on, otherwise leave the note alone.
 */
export function decideTemplate(input: {
  forcedTemplate: string | null;
  templateNames: string[];
  autoFormattingEnabled: boolean;
}): AudioTemplateDecision {
  const { forcedTemplate, templateNames, autoFormattingEnabled } = input;
  if (forcedTemplate && templateNames.includes(forcedTemplate)) {
    return { kind: "use", template: forcedTemplate };
  }
  return autoFormattingEnabled ? { kind: "classify" } : { kind: "skip" };
}

export function filterTemplatesForAudio(templateNames: string[]): string[] {
  return templateNames.filter(isAudioCompatibleTemplate);
}

/** Template basenames in the template folder that can format audio (sync, for settings UIs). */
export function listAudioTemplateNames(
  app: App,
  templateFolderPath: string
): string[] {
  const folder = app.vault.getAbstractFileByPath(normalizePath(templateFolderPath));
  if (!(folder instanceof TFolder)) return [];
  return filterTemplatesForAudio(
    folder.children
      .filter(
        (file): file is TFile => file instanceof TFile && file.extension === "md"
      )
      .map(file => file.basename)
  ).sort();
}
