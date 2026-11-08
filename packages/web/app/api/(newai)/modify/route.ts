import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { getModel } from "@/lib/models";
import { z } from "zod";
import { generateObject } from "ai";
import { diffLines } from "diff";

const modifySchema = z.object({
  content: z.string().describe("The modified content"),
  diff: z.array(z.object({
    value: z.string(),
    added: z.boolean().optional(),
    removed: z.boolean().optional()
  })).describe("The diff between original and modified content"),
  explanation: z.string().describe("Explanation of changes made")
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, originalContent, instructions } = await request.json();
    const model = getModel();

    const response = await generateObject({
      model: model as any, // Type cast for AI SDK v2 compatibility
      schema: modifySchema,
      system: `You are a precise code and text modification assistant. Follow these guidelines:
- Make minimal necessary changes to achieve the goal
- Preserve important formatting and structure
- Provide clear explanations for changes`,
      prompt: `Modify the following content according to these instructions: ${instructions}

Original content:
"""
${originalContent}
"""

Modified content with the text "${content}" applied according to the instructions.`,
    });

    // Generate diff
    const diff = diffLines(originalContent, response.object.content);

    // Log token usage
    await incrementAndLogTokenUsage(userId, response.usage.totalTokens);

    return NextResponse.json({
      content: response.object.content,
      diff,
      explanation: response.object.explanation
    });
  } catch (error) {
    console.error("Error in modify route:", {
      message: error instanceof Error ? error.message : String(error),
      status: error?.status,
    });
    return NextResponse.json(
      { error: error.message || "Failed to modify content" },
      { status: error.status || 500 }
    );
  }
}