import type { FileOrganizerSettings } from "../settings";

const LEGACY_IMAGE_DESCRIPTION =
  "Analyze the image and provide a clear, detailed description focusing on the main elements, context, and any text visible in the image. Include relevant details that would be useful for searching and organizing the image later.";

const OCR_DEFAULT =
  "For handwriting and whiteboards, preserve line breaks and list structure.";

export function migrateImageOcrSettings(
  settings: FileOrganizerSettings
): boolean {
  if (settings.imageInstructions?.trim() === LEGACY_IMAGE_DESCRIPTION) {
    settings.imageInstructions = OCR_DEFAULT;
    return true;
  }
  return false;
}
