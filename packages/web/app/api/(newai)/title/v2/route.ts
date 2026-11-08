import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { getModel } from "@/lib/models";
import { z } from "zod";
import { generateObject } from "ai";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const {
      content,
      fileName,
      customInstructions,
      count = 3,
    } = await request.json();
    const model = getModel();
    const shouldRename = await generateObject({
      model: model as any, // Type cast for AI SDK v2 compatibility
      schema: z.object({
        score: z.number().min(0).max(100),
        shouldRename: z.boolean(),
        reason: z.string(),
      }),
      prompt: `Given the content and file name: "${fileName}", should we rename the file? Content: "${content}", based on ${customInstructions}. Additional context:
      Time: ${new Date().toISOString()}`,
    });

    if (!shouldRename.object.shouldRename) {
      // remove extension from fileName if it exists
      return NextResponse.json({
        titles: [
          {
            score: shouldRename.object.score,
            title: fileName,
            reason: shouldRename.object.reason,
          },
        ],
      });
    }

    const response = await generateObject({
      model: model as any, // Type cast for AI SDK v2 compatibility
      schema: z.object({
        suggestedTitles: z
          .array(
            z.object({
              score: z.number().min(0).max(100),
              title: z.string(),
              reason: z.string(),
            })
          )
          .min(1)
          .max(count),
      }),
      system: `Given the content and file name: "${fileName}", suggest exactly ${count} clear titles. Avoid special characters. ${
        customInstructions ? `Instructions: "${customInstructions}"` : ""
      }`,
      prompt: `Content: "${content}"`,
    });

    // increment tokenUsage
    const tokens = response.usage.totalTokens;
    console.log("incrementing token usage titles", userId, tokens);
    await incrementAndLogTokenUsage(userId, tokens);
    const safeTitles = response.object.suggestedTitles.map((title) => {
      return { ...title, title: title.title };
    });

    return NextResponse.json({
      titles: safeTitles.sort((a, b) => b.score - a.score),
    });
  } catch (error) {
    console.error("title/v2 failed:", {
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
