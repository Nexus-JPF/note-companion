import { NextResponse, NextRequest } from "next/server";
import {
  handleAuthorizationV2,
  AuthorizationError,
} from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { ocrPdfFromBuffer, PDF_OCR_PAGE_LIMIT } from "@/lib/ocr-pdf";
import { validatePdfOcrInput } from "@/lib/pdf-ocr-input";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const payload = await request.json();

    const validation = validatePdfOcrInput(payload?.pdf);
    if (validation.ok === false) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const pageLimitRaw = payload?.pageLimit;
    const pageLimit =
      typeof pageLimitRaw === "number" &&
      Number.isFinite(pageLimitRaw) &&
      pageLimitRaw > 0
        ? Math.min(Math.floor(pageLimitRaw), PDF_OCR_PAGE_LIMIT)
        : PDF_OCR_PAGE_LIMIT;

    const result = await ocrPdfFromBuffer(validation.buffer, {
      pageLimit,
      customInstructions: payload?.instructions,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    try {
      await incrementAndLogTokenUsage(userId, result.tokensUsed);
    } catch (error) {
      console.error("Failed to increment token usage for pdf-ocr:", error);
    }

    return NextResponse.json({ text: result.textContent });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
