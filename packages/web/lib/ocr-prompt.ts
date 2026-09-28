export const OCR_BASE_INSTRUCTION =
  "Extract all text from the image comprehensively, preserving formatting. Focus only on extracting readable text, not describing visual elements.";

export const OCR_RESPONSE_INSTRUCTION = "Respond with only the extracted text.";

/** Legacy plugin default — replaced on settings migration. */
export const LEGACY_IMAGE_DESCRIPTION_INSTRUCTION =
  "Analyze the image and provide a clear, detailed description focusing on the main elements, context, and any text visible in the image. Include relevant details that would be useful for searching and organizing the image later.";

export const DEFAULT_IMAGE_OCR_INSTRUCTIONS =
  "For handwriting and whiteboards, preserve line breaks and list structure.";

export function buildOcrPrompt(customInstructions?: string | null): string {
  const trimmed = customInstructions?.trim();
  if (!trimmed || trimmed === LEGACY_IMAGE_DESCRIPTION_INSTRUCTION) {
    return `${OCR_BASE_INSTRUCTION} ${OCR_RESPONSE_INSTRUCTION}`;
  }
  return `${OCR_BASE_INSTRUCTION} ${trimmed} ${OCR_RESPONSE_INSTRUCTION}`;
}
