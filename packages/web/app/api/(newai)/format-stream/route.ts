import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse, NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { getModel } from '@/lib/models';

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, formattingInstruction } = await request.json();
    const model = getModel();

    // Check if content contains YouTube transcript
    const hasYouTubeTranscript =
      content.includes('## Full Transcript') ||
      content.includes('## YouTube Video Information');

    // Check if this is a flash_cards template
    const isFlashCardsTemplate = formattingInstruction.includes('flash_cards') ||
      formattingInstruction.includes('Flash Card Generation') ||
      formattingInstruction.includes('flashcard');

    if (hasYouTubeTranscript) {
      const transcriptMatch = content.match(
        /## Full Transcript\n\n(.+?)(?=\n\n##|$)/s
      );
      const transcriptLength = transcriptMatch ? transcriptMatch[1].length : 0;
      console.log(
        `[Format Stream] YouTube transcript detected: ${transcriptLength} characters`
      );
    }

    // Add YAML frontmatter reminder for flash_cards template
    const yamlReminder = isFlashCardsTemplate
      ? `\n\nIMPORTANT: When generating frontmatter, use flat YAML format with each property on its own line (no nesting). Example:\n---\ntotal: 15\ntopics: ["Topic 1", "Topic 2", "Topic 3"]\ncreated: "2025-01-09"\n---`
      : '';

    const result = streamText({
      model: model as any,
      system: 'Answer directly in markdown',
      messages: [
        {
          role: 'user',
          content: hasYouTubeTranscript
            ? `Format the following content according to the given instruction. IMPORTANT: The content includes a YouTube video transcript in the "Full Transcript" section - you MUST use this transcript to create a comprehensive, detailed summary as instructed.${yamlReminder}

Context:
  Time: ${new Date().toISOString()}

Content:
"${content}"

Formatting Instruction:
"${formattingInstruction}"`
            : `Format the following content according to the given instruction.${yamlReminder}

Context:
  Time: ${new Date().toISOString()}

Content:
"${content}"

Formatting Instruction:
"${formattingInstruction}"`,
        },
      ],
      onFinish: async ({ usage }) => {
        console.log('Token usage:', usage);
        await incrementAndLogTokenUsage(userId, usage.totalTokens);
      },
    });

    const response = result.toTextStreamResponse();

    return response;
  } catch (error) {
    console.error("format-stream failed:", {
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
