import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { getVisionModel } from "@/lib/models";
import { buildOcrPrompt } from "@/lib/ocr-prompt";
import {
  detectImageMediaTypeFromBase64,
  normalizeVisionImage,
} from "@/lib/vision-image";

export type OcrExtractResult = {
  text: string;
  tokensUsed: number;
  error?: string;
};

export type OcrImageInput =
  | { kind: "dataUrl"; dataUrl: string }
  | { kind: "base64"; base64: string; mediaType: string }
  | { kind: "buffer"; buffer: Buffer };

const REFUSAL_MAX_LENGTH = 300;

const REFUSAL_PATTERNS: RegExp[] = [
  /^(i['’]m|i am) (sorry|unable|not able)\b/i,
  /^(sorry|apologies)[,.! ]/i,
  /^i (can['’]?t|cannot|can not|won['’]?t|am unable to|am not able to) (assist|help|comply|process|transcribe|read|extract|identify|provide)/i,
  /^unfortunately,? i (can['’]?t|cannot|am unable)/i,
  /^as an ai\b/i,
];

/**
 * Detects a model refusal returned in place of OCR text (e.g. "I'm sorry, I can't
 * assist with that."). Only short outputs that open with a refusal phrase count,
 * so genuine notes that happen to contain such a sentence are not rejected.
 */
export function isRefusalText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > REFUSAL_MAX_LENGTH) {
    return false;
  }
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export const REFUSAL_RETRY_HINT =
  "This is the user's own image of their personal handwritten notes or documents. Transcribe all legible text exactly as written; do not refuse, and do not add commentary.";

export const REFUSAL_ERROR_MESSAGE =
  "The AI could not read text from this image. Try retaking the photo with better lighting, or upload a clearer image.";

function toDataUrl(input: OcrImageInput): string | null {
  if (input.kind === "dataUrl") {
    return input.dataUrl;
  }
  if (input.kind === "base64") {
    return normalizeVisionImage(input.base64, input.mediaType);
  }
  const base64 = input.buffer.toString("base64");
  const mediaType = detectImageMediaTypeFromBase64(base64);
  if (!mediaType) {
    return null;
  }
  return normalizeVisionImage(base64, mediaType);
}

export async function extractTextFromVisionImage(options: {
  image: OcrImageInput;
  customInstructions?: string | null;
  model?: LanguageModel;
  /** One retry when the model returns empty text (handwriting / low contrast). */
  retryOnEmpty?: boolean;
}): Promise<OcrExtractResult> {
  const dataUrl = toDataUrl(options.image);
  if (!dataUrl) {
    return {
      text: "",
      tokensUsed: 0,
      error: "Unrecognized or unsupported image format for OCR",
    };
  }

  const model = options.model ?? getVisionModel();
  const promptText = buildOcrPrompt(options.customInstructions);

  const runOnce = async (extraHint?: string) => {
    const textPrompt = extraHint
      ? `${promptText} ${extraHint}`
      : promptText;
    const response = await generateText({
      model: model as any,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: textPrompt },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });
    const text = (response.text ?? "").trim();
    const tokensUsed =
      response.usage?.totalTokens ?? Math.ceil(text.length / 4);
    return { text, tokensUsed };
  };

  try {
    let { text, tokensUsed } = await runOnce();
    if (!text && options.retryOnEmpty !== false) {
      const retry = await runOnce(
        "If text is faint or handwritten, transcribe every legible character."
      );
      text = retry.text;
      tokensUsed += retry.tokensUsed;
    }

    if (isRefusalText(text)) {
      const retry = await runOnce(REFUSAL_RETRY_HINT);
      tokensUsed += retry.tokensUsed;
      if (isRefusalText(retry.text)) {
        return { text: "", tokensUsed, error: REFUSAL_ERROR_MESSAGE };
      }
      text = retry.text;
    }

    return { text, tokensUsed };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vision OCR failed";
    return { text: "", tokensUsed: 0, error: message };
  }
}
