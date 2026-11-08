import { streamText } from 'ai';
import { NextResponse, NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { getModel } from '@/lib/models';

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { transcript, currentNoteContent, fileName, recordingDate, recordingDuration, recordingFileName, recordingFilePath } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    const model = getModel();

    // Determine if note is empty or has content
    const noteIsEmpty = !currentNoteContent || currentNoteContent.trim().length === 0;

    const systemPrompt = `You are a meeting note assistant. Your task is to enhance notes with information from meeting transcripts.

When the note is empty, create a comprehensive structured meeting note.
When the note has content, you MUST preserve the user's existing notes exactly as written. Add transcript information as additional structured sections without modifying or removing the user's original content.

Always extract:
- Discussion points (key topics and ideas)
- Action items (tasks with owners and deadlines if mentioned)
- Decisions made
- Key takeaways

Format the output as clean markdown with proper headings and structure.

IMPORTANT: The Full Transcript section MUST always be wrapped in a markdown code block using triple backticks. The transcript should appear between opening and closing triple backticks.`;

    // Build date context (duration removed since multiple recordings can be used)
    const dateContext = recordingDate
      ? `\n\nMeeting Date: ${recordingDate}`
      : "";

    const userPrompt = noteIsEmpty
      ? `Create a comprehensive meeting note from this transcript:${dateContext}

Transcript from recording: ${recordingFileName || recordingFilePath || 'Unknown'}
${transcript}

Create a structured meeting note with:
- Title (extract from transcript or use the meeting date if provided)
- Date: Use the meeting date provided above, or extract from transcript if not provided
- Discussion Points (numbered list)
- Action Items (with owners and deadlines if mentioned)
- Decisions
- Full Transcript section: The transcript MUST be labeled with the recording file name (e.g., "### Transcript: ${recordingFileName || 'Recording'}") and wrapped in a markdown code block with triple backticks.

Format as clean markdown. Use actual dates - do not use placeholders like "[Insert Date]". Always wrap the transcript in a code block and label it with the recording file name. Do NOT include a "Duration" field since multiple recordings may be used.`
      : `Enhance this existing note with information from the meeting transcript.${dateContext}

Current Note:
${currentNoteContent}

Transcript from recording: ${recordingFileName || recordingFilePath || 'Unknown'}
${transcript}

Instructions:
1. Identify the user's original notes (content that appears BEFORE any "## Discussion Points", "## Action Items", "## Decisions", or "## Full Transcript" sections)
2. PRESERVE the user's original notes exactly as written - do not modify, remove, or restructure them
3. If enhanced sections already exist, MERGE the new content from THIS transcript with the existing content:
   - **Discussion Points**: Combine points from both, removing duplicates and similar items
   - **Action Items**: Merge action items, removing duplicates (same task/person)
   - **Decisions**: Merge decisions, removing duplicates
   - **Full Transcript**: CRITICAL - You MUST preserve ALL existing transcripts. Look for existing "### Transcript:" or "### From:" sections and KEEP THEM ALL. Append this new transcript as a new labeled section. Do NOT replace or remove existing transcripts.
4. If enhanced sections don't exist yet, create them with content from this transcript
5. Add/update the following sections after the user's original notes:
   - ## Discussion Points (merged from all recordings)
   - ## Action Items (merged from all recordings)
   - ## Decisions (merged from all recordings)
   - ## Full Transcript (all transcripts combined, each clearly labeled with its recording file)

CRITICAL:
- The user's original notes must appear first, unchanged
- MERGE content from this transcript with existing enhanced sections (don't replace - merge intelligently)
- Remove duplicates and similar items when merging
- For Full Transcript: Each transcript MUST be labeled with its recording file name (e.g., "### Transcript: ${recordingFileName || 'Recording'}" or "### From: ${recordingFileName || 'Recording'}")
- Append this new transcript as a new labeled section within the Full Transcript section
- Use actual dates and durations if provided above - do not use placeholders like "[Insert Date]"
- Always wrap each transcript in its own code block with triple backticks
- If multiple transcripts exist, each must be clearly labeled with its source recording file name`;

    const result = streamText({
      model: model as any,
      onError: ({ error }) => {
        console.error('enhance-meeting-note stream error:', {
          message: error instanceof Error ? error.message : String(error),
          status: (error as { status?: number } | null)?.status,
        });
      },
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      onFinish: async ({ usage }) => {
        console.log('Token usage for meeting note enhancement:', usage);
        await incrementAndLogTokenUsage(userId, usage.totalTokens);
      },
    });

    const response = result.toTextStreamResponse();

    return response;
  } catch (error) {
    console.error('Meeting note enhancement error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to enhance meeting note',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}

