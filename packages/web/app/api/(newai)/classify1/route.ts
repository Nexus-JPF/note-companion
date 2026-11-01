// app/app/api/(ai)/classify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { classifyDocument } from "../aiService";
import { handleAuthorizationV2, AuthorizationError } from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { getModel } from "@/lib/models";

/**
 * Document classification endpoint.
 *
 * NOTE: Despite the "1" suffix, this is the CURRENT and ONLY classification endpoint.
 * The name is kept as-is for backward compatibility with existing plugin installations.
 *
 * Plugin usage: packages/plugin/index.ts:837 - classifyContentV2() method
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, fileName, templateNames } = await request.json();
    const model = getModel();
    const response = await classifyDocument(
      content,
      fileName,
      templateNames,
      model as any // Type cast for compatibility
    );
    // increment tokenUsage
    const tokens = response.usage.totalTokens;
    console.log("incrementing token usage classify", userId, tokens);
    await incrementAndLogTokenUsage(userId, tokens);
    const documentType = response.object.documentType;
    return NextResponse.json({ documentType });
  } catch (error) {
    console.error("classify1 failed:", error);
    // Properly handle AuthorizationError with status codes
    // Use try-catch for instanceof check in case AuthorizationError is undefined (e.g., in tests)
    try {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
    } catch {
      // AuthorizationError may be undefined in test environment, fall through to property check
    }

    // Handle errors with status property
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }

    // Fallback for other errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to classify document';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
