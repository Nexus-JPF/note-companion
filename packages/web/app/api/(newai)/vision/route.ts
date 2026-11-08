import { NextResponse, NextRequest } from "next/server";
import {
  handleAuthorizationV2,
  AuthorizationError,
} from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { extractTextFromVisionImage } from "@/lib/ocr-extract";
import {
  normalizeVisionImage,
  validateVisionImageInput,
} from "@/lib/vision-image";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const payload = await request.json();

    const validation = validateVisionImageInput(payload?.image);
    if (validation.ok === false) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const dataUrl = normalizeVisionImage(
      validation.base64,
      validation.mediaType
    );

    const result = await extractTextFromVisionImage({
      image: { kind: "dataUrl", dataUrl },
      customInstructions: payload?.instructions,
      retryOnEmpty: true,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    try {
      await incrementAndLogTokenUsage(userId, result.tokensUsed);
    } catch (error) {
      console.error("Failed to increment token usage for vision:", error);
    }

    return NextResponse.json({ text: result.text });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      "message" in error
    ) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status?: number }).status || 500 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
