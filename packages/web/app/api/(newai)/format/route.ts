import { formatDocumentContent } from "../aiService";
import { NextResponse, NextRequest } from "next/server";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { getModel } from "@/lib/models";

export const maxDuration = 800; // Maximum allowed for Vercel Pro plan (13.3 minutes) for large content formatting

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, formattingInstruction } = await request.json();
    const model = getModel();
    const response = await formatDocumentContent(
      content,
      formattingInstruction,
      model as any
    );
    const tokens = response.usage.totalTokens;
    console.log("incrementing token usage format", userId, tokens);
    await incrementAndLogTokenUsage(userId, tokens);

    return NextResponse.json({ content: response.object.formattedContent });
  } catch (error) {
    console.error("format failed:", {
      message: error instanceof Error ? error.message : String(error),
      status: (error as { status?: number } | null)?.status,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }
  }
}
