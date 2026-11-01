import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2, AuthorizationError } from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { getModel } from "@/lib/models";
import { z } from "zod";
import { generateObject } from "ai";

const tagsSchema = z.object({
  suggestedTags: z.array(z.object({
    score: z.number().min(0).max(100),
    isNew: z.boolean(),
    tag: z.string(),
    reason: z.string().min(1), // Ensure reason is not empty
  }))
});

const MAX_CONTENT_CHARS = 20000;
const HEAD_CHARS = Math.floor(MAX_CONTENT_CHARS * 0.7);
const TAIL_CHARS = MAX_CONTENT_CHARS - HEAD_CHARS;

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) {
    return content;
  }
  const head = content.slice(0, HEAD_CHARS);
  const tail = content.slice(-TAIL_CHARS);
  const truncatedChars = content.length - MAX_CONTENT_CHARS;
  return `${head}\n\n...[truncated ${truncatedChars} chars]...\n\n${tail}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const {
      content,
      fileName,
      existingTags = [],
      customInstructions = "",
      count = 3
    } = await request.json();

    const safeContent =
      typeof content === "string" ? truncateContent(content) : "";

    const response = await generateObject({
      model: getModel() as any,
      schema: tagsSchema,
      system: `You are a precise tag generator. Analyze content and suggest ${count} relevant tags.
              ${existingTags.length ? `Consider existing tags: ${existingTags.join(", ")}` : 'Create new tags if needed.'}
              ${customInstructions ? `Follow these custom instructions: ${customInstructions}` : ''}

              Guidelines:
              - Prefer existing tags when appropriate (score them higher)
              - Create specific, meaningful new tags when needed
              - Score based on relevance (0-100)
              - REQUIRED: Each tag MUST include a "reason" field explaining why it's relevant
              - The reason should be a brief sentence (1-2 sentences) explaining the tag's relevance
              - Focus on key themes, topics, and document type

              Response format: Each tag object must have: score (number), isNew (boolean), tag (string), and reason (string).`,
      prompt: `File: "${fileName}"

              Content: """
              ${safeContent}
              """`,
    });

    await incrementAndLogTokenUsage(userId, response.usage.totalTokens);

    // Sort tags by score and format response
    // Add fallback reason if missing (defensive programming)
    const sortedTags = response.object.suggestedTags
      .sort((a, b) => b.score - a.score)
      .map(tag => ({
        ...tag,
        tag: tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`,
        reason: tag.reason || `Relevant to content theme`, // Fallback if reason is missing
      }));

    return NextResponse.json({ tags: sortedTags });
  } catch (error) {
    console.error('Tag generation error:', {
      message: error instanceof Error ? error.message : String(error),
      status: (error as { status?: number } | null)?.status,
    });

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
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate tags';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}