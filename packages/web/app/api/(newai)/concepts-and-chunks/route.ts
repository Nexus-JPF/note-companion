import { NextResponse, NextRequest } from 'next/server';
import { getModel } from '@/lib/models';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { generateObject, LanguageModel } from 'ai';
import { z } from 'zod';

export const maxDuration = 300; // Large document analysis can take significant time

// Move the schema definition to the top level for better predictability
const conceptsSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      chunk: z.string(),
    })
  ),
});

async function identifyConceptsAndChunks(
  content: string,
  model: LanguageModel
) {
  return generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: conceptsSchema,
    prompt: `Analyze the following content:

    ${content}

    1. Identify the key concepts in the document.
    2. For each concept, extract the most relevant chunk of information.
    3. Return a list of concepts, each with its name and associated chunk of information.
    4. Preserve all markdown formatting in the extracted chunks.

    Aim to split the document into the fewest atomic chunks possible while capturing all key concepts.`,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content } = await request.json();
    const model = getModel();

    const response = await identifyConceptsAndChunks(content, model as any);

    const tokens = response.usage?.totalTokens || 0;
    console.log(
      'incrementing token usage for concepts-and-chunks',
      userId,
      tokens
    );
    await incrementAndLogTokenUsage(userId, tokens);

    return NextResponse.json({ concepts: response.object.concepts });
  } catch (error) {
    console.error("concepts-and-chunks failed:", {
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
