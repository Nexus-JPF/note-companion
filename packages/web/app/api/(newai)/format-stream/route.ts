import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse, NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { getModel } from '@/lib/models';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, formattingInstruction } = await request.json();
    const model = getModel();

    // Check if content contains YouTube transcript
    const hasYouTubeTranscript =
      content.includes('## Full Transcript') ||
      content.includes('## YouTube Video Information');

    if (hasYouTubeTranscript) {
      const transcriptMatch = content.match(
        /## Full Transcript\n\n(.+?)(?=\n\n##|$)/s
      );
      const transcriptLength = transcriptMatch ? transcriptMatch[1].length : 0;
      console.log(
        `[Format Stream] YouTube transcript detected: ${transcriptLength} characters`
      );
    }

    const result = await streamText({
      model,
      system: 'Answer directly in markdown',
      messages: [
        {
          role: 'user',
          content: hasYouTubeTranscript
            ? `Format the following content according to the given instruction. IMPORTANT: The content includes a YouTube video transcript in the "Full Transcript" section - you MUST use this transcript to create a comprehensive, detailed summary as instructed.

Context:
  Time: ${new Date().toISOString()}

Content:
"${content}"

Formatting Instruction:
"${formattingInstruction}"`
            : `Format the following content according to the given instruction:
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
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
  }
}
