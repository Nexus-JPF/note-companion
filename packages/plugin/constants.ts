import { Notice } from "obsidian";

/** Free tier token limit (matches web DEFAULT_LEGACY_PLAN_TOKENS). Upgrade CTA only for this tier. */
export const FREE_TIER_TOKEN_LIMIT = 100000;

export const VALID_IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];

export const VALID_AUDIO_EXTENSIONS = [
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
];

export const VALID_MEDIA_EXTENSIONS = [
  ...VALID_IMAGE_EXTENSIONS,
  ...VALID_AUDIO_EXTENSIONS,
  "pdf",
];

export const VALID_TEXT_EXTENSIONS = ["md", "txt"];

export const VALID_EXTENSIONS = [
  ...VALID_MEDIA_EXTENSIONS,
  ...VALID_TEXT_EXTENSIONS,
  "pdf",
];

/**
 * Validates if a given file extension is supported by FileOrganizer
 * @param extension - The file extension to validate (without the dot)
 * @returns boolean indicating if the extension is supported
 */
export const isValidExtension = (extension: string): boolean => {
  const isSupported = VALID_EXTENSIONS.includes(extension);
  if (!isSupported) {
    new Notice("Sorry, note companion does not support this file type.");
  }
  return isSupported;
};
