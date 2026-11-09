import { normalizePath, TFile, TFolder, type App } from "obsidian";

/** Settings value meaning "don't force a template for audio". */
export const AUDIO_TEMPLATE_OFF = "none";

/** Template chosen for audio files, or null when the setting is off/empty. */
export function resolveAudioDefaultTemplate(
  setting: string | undefined | null
): string | null {
  const name = (setting ?? "").replace(/\.md$/i, "").trim();
  if (!name || name.toLowerCase() === AUDIO_TEMPLATE_OFF) return null;
  return name;
}

/**
 * youtube_* templates need a video link and skip formatting without one, so
 * they are never valid for an audio recording.
 */
export function isAudioCompatibleTemplate(templateName: string): boolean {
  return !templateName.replace(/\.md$/i, "").toLowerCase().startsWith("youtube_");
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
      .filter((file): file is TFile => file instanceof TFile)
      .map(file => file.basename)
  ).sort();
}
