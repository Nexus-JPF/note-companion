const VIDEO_ID_LINE = /Video ID:\s*(\S+)/im;
const TITLE_LINE = /^Title:\s*(.+)$/im;

export function parseYoutubeToolVideoId(result: string): string | null {
  const m = result.match(VIDEO_ID_LINE);
  const id = m?.[1]?.trim();
  return id && id.length > 0 ? id : null;
}

export function parseYoutubeToolTitle(result: string): string | undefined {
  const m = result.match(TITLE_LINE);
  const t = m?.[1]?.trim();
  return t && t.length > 0 ? t : undefined;
}

export function buildYoutubeToolStub(
  videoId: string,
  title?: string
): string {
  const titlePart = title ? ` (“${title}”)` : '';
  return `YouTube transcript for video ${videoId}${titlePart} is included in the “YouTube Video” section of this system prompt (under Full Transcript). Use that text to answer the user. Do not ask for the transcript again.`;
}

export function buildYoutubeToolStubFromResult(fullResult: string): string {
  const videoId = parseYoutubeToolVideoId(fullResult);
  const title = parseYoutubeToolTitle(fullResult);
  if (videoId) {
    return buildYoutubeToolStub(videoId, title);
  }
  return `The full YouTube transcript is included in the “YouTube Video” section of this system prompt. Use that text to answer the user.`;
}

export const YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS = 10;
export const YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH = 8000;

/** Tool results use "FULL TRANSCRIPT:"; be tolerant of other casings. */
function resultLooksLikeFullYoutubeTranscript(result: string): boolean {
  return /\bfull transcript\b/i.test(result);
}

export function buildYoutubeTranscriptOverLimitStub(fullResult: string): string {
  const videoId = parseYoutubeToolVideoId(fullResult);
  const title = parseYoutubeToolTitle(fullResult);
  const ref = videoId
    ? `Video ${videoId}${title ? ` (“${title}”)` : ''}`
    : 'This video';
  return `${ref} is not included in full here: only the first ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} YouTube tool transcripts are processed per request. Use any transcript already in the “YouTube Video” section of this system prompt, or the user can ask again in a new message with fewer videos.`;
}

export type YoutubeToolDedupState = {
  youtubeTranscriptsInContext: string;
  youtubeTranscriptCount: number;
  hoistedLabelCount: number;
  idsWithTranscript: Set<string>;
};

export function createYoutubeToolDedupState(
  clientIdsWithTranscript: Set<string>
): YoutubeToolDedupState {
  return {
    youtubeTranscriptsInContext: '',
    youtubeTranscriptCount: 0,
    hoistedLabelCount: 0,
    idsWithTranscript: new Set(clientIdsWithTranscript),
  };
}

function readToolResultText(item: any): string | null {
  if (typeof item?.result === 'string') {
    return item.result;
  }
  const output = item?.output;
  if (typeof output === 'string') {
    return output;
  }
  if (output && typeof output === 'object') {
    if (typeof output.value === 'string') {
      return output.value;
    }
    if (output.value != null) {
      try {
        return JSON.stringify(output.value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function writeToolResultText(item: any, text: string): any {
  if (item && typeof item === 'object' && 'output' in item) {
    const output = item.output;
    if (output && typeof output === 'object') {
      return { ...item, output: { ...output, value: text } };
    }
    return { ...item, output: { type: 'text', value: text } };
  }
  return { ...item, result: text };
}

function getFirstToolResultContent(tool: any): {
  firstItem: any;
  rest: any[];
} | null {
  if (!Array.isArray(tool.content) || tool.content.length === 0) {
    return null;
  }
  const firstItem = tool.content[0];
  if (
    firstItem &&
    typeof firstItem === 'object' &&
    firstItem.type === 'tool-result' &&
    firstItem.toolCallId &&
    firstItem.toolName
  ) {
    return { firstItem, rest: tool.content.slice(1) };
  }
  return null;
}

/**
 * Hoists transcript into context only when missing from client JSON (e.g. lightweight mode),
 * and replaces the tool result with a short stub so the transcript is not duplicated in messages.
 */
export function applyYoutubeToolDedupToMessage(
  message: any,
  state: YoutubeToolDedupState
): any {
  if (message.role !== 'tool') {
    return message;
  }

  const tool = message;
  const extracted = getFirstToolResultContent(tool);
  const toolName =
    extracted?.firstItem.toolName ?? tool.toolName;

  if (toolName !== 'getYoutubeVideoId') {
    if (extracted && (!tool.toolCallId || !tool.toolName)) {
      console.log(
        `[Chat API] Extracting toolCallId/toolName from content array: ${extracted.firstItem.toolCallId}, ${extracted.firstItem.toolName}`
      );
      return {
        ...message,
        toolCallId: extracted.firstItem.toolCallId,
        toolName: extracted.firstItem.toolName,
      };
    }
    return message;
  }

  const fullResult =
    extracted != null
      ? readToolResultText(extracted.firstItem)
      : typeof tool.content === 'string'
        ? tool.content
        : null;

  if (!fullResult || !resultLooksLikeFullYoutubeTranscript(fullResult)) {
    if (extracted && (!tool.toolCallId || !tool.toolName)) {
      return {
        ...message,
        toolCallId: extracted.firstItem.toolCallId,
        toolName: extracted.firstItem.toolName,
      };
    }
    return message;
  }

  state.youtubeTranscriptCount += 1;

  if (state.youtubeTranscriptCount > YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS) {
    const stub = buildYoutubeTranscriptOverLimitStub(fullResult);
    console.warn(
      `[Chat API] YouTube tool transcript over per-request limit (${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS}) — replacing with stub, tool message kept for pairing`
    );
    if (extracted) {
      return {
        ...message,
        toolCallId: extracted.firstItem.toolCallId,
        toolName: extracted.firstItem.toolName,
        content: [
          writeToolResultText(extracted.firstItem, stub),
          ...extracted.rest,
        ],
      };
    }
    return {
      ...message,
      content: stub,
    };
  }

  const videoId = parseYoutubeToolVideoId(fullResult);
  // If we cannot parse a video id, always hoist so lightweight / odd payloads still get a system copy
  const needsHoist =
    videoId == null || !state.idsWithTranscript.has(videoId);

  let textForHoist = fullResult;
  if (textForHoist.length > YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH) {
    textForHoist =
      textForHoist.substring(0, YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH) +
      `\n\n[Transcript truncated - original length: ${fullResult.length} chars]`;
  }

  if (needsHoist) {
    state.hoistedLabelCount += 1;
    state.youtubeTranscriptsInContext += `\n\nYouTube Video Transcript ${state.hoistedLabelCount}:\n${textForHoist}\n`;
    if (videoId) {
      state.idsWithTranscript.add(videoId);
    }
    console.log(
      `[Chat API] Hoisting YouTube transcript from tool (${textForHoist.length} chars) for video ${videoId ?? '(unknown)'} — not already in client context`
    );
  } else {
    console.log(
      `[Chat API] Skipping redundant YouTube hoist for video ${videoId ?? '(unknown)'} — transcript already in system context`
    );
  }

  const stub = buildYoutubeToolStubFromResult(fullResult);

  if (extracted) {
    return {
      ...message,
      toolCallId: extracted.firstItem.toolCallId,
      toolName: extracted.firstItem.toolName,
      content: [
        writeToolResultText(extracted.firstItem, stub),
        ...extracted.rest,
      ],
    };
  }

  return {
    ...message,
    content: stub,
  };
}

/**
 * Applies YouTube tool dedup to already-converted core / model messages
 * (v4 CoreMessage and v5 ModelMessage both use role:"tool" content arrays).
 */
export function applyYoutubeToolDedupToCoreMessages(
  coreMessages: any[],
  clientIdsWithTranscript: Set<string>
): { finalCoreMessages: any[]; state: YoutubeToolDedupState } {
  const state = createYoutubeToolDedupState(clientIdsWithTranscript);
  const finalCoreMessages = coreMessages.map((message) =>
    applyYoutubeToolDedupToMessage(message, state)
  );
  return { finalCoreMessages, state };
}

export const applyYoutubeToolDedupToModelMessages =
  applyYoutubeToolDedupToCoreMessages;
