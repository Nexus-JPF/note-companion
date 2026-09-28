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

    return { text, tokensUsed };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vision OCR failed";
    return { text: "", tokensUsed: 0, error: message };
  }
}
