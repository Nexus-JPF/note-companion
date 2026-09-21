import { NextRequest } from 'next/server';
import {
  handleAuthorizationV2,
  AuthorizationError,
} from '@/lib/handleAuthorization';
import {
  buildChatSystemPrompt,
  computeChatPromptHints,
  lastUserMessageHasYoutubeUrl,
} from '@/lib/prompts/chat-prompt';
import {
  applyYoutubeToolDedupToCoreMessages,
  YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS,
  YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH,
} from '@/lib/chat/youtube-tool-dedup';
import {
  computeEffectiveMaxSteps,
  fetchUserTierForChat,
  getMaxStepsForUserTier,
  parseRequestedMaxSteps,
} from '@/lib/chat/chat-max-steps';
import {
  getChatMaxUserTurnsFromEnv,
  limitMessagesToLastUserTurns,
  summarizeConversationWindow,
} from '@/lib/chat/conversation-window';
import {
  isChatDeepSearchEnabled,
  isChatWebSearchEnabled,
} from '@/lib/chat/chat-web-search';
import { parseUnifiedContextJson } from '@/lib/chat/unified-context';

export type ChatRequestPreparation = {
  userId: string;
  messages: any[];
  messagesToProcess: any[];
  contextString: string;
  currentDatetime: unknown;
  shouldUseSearch: boolean;
  deepSearch: boolean;
  userTier: string | null;
  tierMaxSteps: number;
  requestedMaxStepsParsed: number | undefined;
  youtubeVideoIdsWithClientTranscript: Set<string>;
  parsedContextItemsForHints: Record<string, unknown> | null;
  contextJsonParseFailed: boolean;
  clientYoutubeSkipNotice: string | null;
};

export type FinishedChatModelInput = {
  messages: any[];
  system: string;
  effectiveMaxSteps: number;
  youtubeOverLimitNotice: string | null;
  contextString: string;
};

/**
 * Strip assistant tool calls that have no matching result. v4 convertToCoreMessages
 * throws "ToolInvocation must have a result" otherwise. v5 uses
 * convertToModelMessages({ ignoreIncompleteToolCalls: true }) instead.
 */
export function stripUnmatchedToolCalls(msgs: any[]): any[] {
  const toolResultIds = new Set(
    msgs
      .filter((m) => m.role === 'tool' && m.toolCallId)
      .map((m) => m.toolCallId)
  );

  console.log(
    `[Chat API] Found ${toolResultIds.size} tool results in message history`
  );

  return msgs.map((message: any) => {
    if (message.role === 'assistant' && Array.isArray(message.parts)) {
      const filteredParts = message.parts.filter((part: any) => {
        if (part?.type === 'tool-invocation' && part?.toolInvocation) {
          const toolCallId = part.toolInvocation.toolCallId;
          const hasMatchingResult = toolResultIds.has(toolCallId);
          const hasEmbeddedResult =
            part.toolInvocation.result != null ||
            part.toolInvocation.state === 'result' ||
            part.toolInvocation.state === 'output-available';

          if (!hasMatchingResult && !hasEmbeddedResult) {
            console.log(
              `[Chat API] Filtering out unmatched tool invocation in parts: ${part.toolInvocation.toolName || 'unknown'} (${toolCallId || 'unknown'})`
            );
            return false;
          }
        }
        return true;
      });
      if (filteredParts.length !== message.parts.length) {
        return { ...message, parts: filteredParts };
      }
    }

    if (message.role === 'assistant' && Array.isArray(message.toolInvocations)) {
      const kept = message.toolInvocations.filter((inv: any) => {
        const hasMatchingResult = toolResultIds.has(inv.toolCallId);
        const hasEmbeddedResult =
          (inv.result != null && inv.result !== undefined) ||
          inv.state === 'result' ||
          inv.state === 'output-available';

        if (!hasMatchingResult && !hasEmbeddedResult) {
          console.log(
            `[Chat API] Filtering out unmatched tool invocation: ${inv.toolName || 'unknown'} (${inv.toolCallId || 'unknown'})`
          );
        }
        return hasMatchingResult || hasEmbeddedResult;
      });

      if (kept.length === 0) {
        const { toolInvocations, ...rest } = message;
        return rest;
      }
      return { ...message, toolInvocations: kept };
    }

    if (message.role === 'assistant' && Array.isArray(message.content)) {
      const filteredParts = message.content.filter((part: any) => {
        if (part?.type === 'tool-call' || part?.type?.startsWith('tool-')) {
          const toolCallId = part.toolCallId || part.toolCall?.toolCallId;
          if (toolCallId) {
            const hasMatchingResult = toolResultIds.has(toolCallId);
            if (!hasMatchingResult) {
              console.log(
                `[Chat API] Filtering out unmatched tool call in content parts: ${toolCallId}`
              );
              return false;
            }
          } else {
            console.log(
              `[Chat API] Filtering out tool call part without toolCallId`
            );
            return false;
          }
        }
        return true;
      });
      if (filteredParts.length !== message.content.length) {
        return { ...message, content: filteredParts };
      }
    }

    return message;
  });
}

function formatFilePart(file: any): string {
  return `File: ${file.title || file.path}\n\nContent:\n${
    file.content || ''
  }\nPath: ${file.path || ''} Reference: ${file.reference || ''}`;
}

function buildContextFromItems(
  contextItems: any,
  editorContext: string
): { parts: string[]; skippedYoutubeCount: number } {
  const parts: string[] = [];
  let skippedYoutubeCount = 0;

  if (contextItems.files && Object.keys(contextItems.files).length > 0) {
    Object.values(contextItems.files).forEach((file: any) => {
      parts.push(formatFilePart(file));
    });
  }

  if (
    contextItems.youtubeVideos &&
    Object.keys(contextItems.youtubeVideos).length > 0
  ) {
    const youtubeVideos = Object.values(contextItems.youtubeVideos);
    const videosToProcess = youtubeVideos.slice(
      0,
      YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS
    );
    skippedYoutubeCount = youtubeVideos.length - videosToProcess.length;

    videosToProcess.forEach((video: any) => {
      let transcript = video.transcript || '';

      if (transcript.length > YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH) {
        transcript =
          transcript.substring(0, YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPT_LENGTH) +
          `\n\n[Transcript truncated - original length: ${video.transcript.length} chars]`;
      }

      parts.push(
        `YouTube Video: ${video.title || 'Untitled'}\n\nVideo ID: ${
          video.videoId || ''
        }\n\nFull Transcript:\n${transcript}\nReference: ${
          video.reference || ''
        }`
      );
    });

    if (skippedYoutubeCount > 0) {
      console.warn(
        `[Chat API] WARNING: ${youtubeVideos.length} YouTube videos in context, but only ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} processed to prevent timeout. ${skippedYoutubeCount} video(s) skipped.`
      );
      parts.push(
        `\n\n[IMPORTANT NOTICE: Due to processing limits, only the first ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} YouTube video transcripts were processed in this request. ${skippedYoutubeCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.]`
      );
    }
  }

  if (contextItems.folders && Object.keys(contextItems.folders).length > 0) {
    Object.values(contextItems.folders).forEach((folder: any) => {
      parts.push(
        `Folder: ${folder.name || folder.path}\n\nPath: ${
          folder.path || ''
        }\nFiles: ${folder.files?.length || 0} files\nReference: ${
          folder.reference || ''
        }`
      );
    });
  }

  if (contextItems.tags && Object.keys(contextItems.tags).length > 0) {
    Object.values(contextItems.tags).forEach((tag: any) => {
      parts.push(
        `Tag: ${tag.name || ''}\n\nFiles: ${
          tag.files?.length || 0
        } files\nReference: ${tag.reference || ''}`
      );
    });
  }

  if (
    contextItems.searchResults &&
    Object.keys(contextItems.searchResults).length > 0
  ) {
    Object.values(contextItems.searchResults).forEach((search: any) => {
      const resultsText =
        search.results?.map((r: any) => `- ${r.title || r.path}`).join('\n') ||
        '';
      parts.push(
        `Search Results: "${search.query || ''}"\n\n${resultsText}\nReference: ${
          search.reference || ''
        }`
      );
    });
  }

  if (contextItems.currentFile) {
    parts.push(formatFilePart(contextItems.currentFile).replace(/^File:/, 'Current File:'));
  }

  if (
    contextItems.textSelections &&
    Object.keys(contextItems.textSelections).length > 0
  ) {
    Object.values(contextItems.textSelections).forEach((selection: any) => {
      parts.push(
        `Text Selection: ${selection.reference || ''}\n\nSelected Text:\n${
          selection.selectedText || ''
        }`
      );
    });
  }

  if (editorContext) {
    parts.push(editorContext);
  }

  return { parts, skippedYoutubeCount };
}

function collectYoutubeIdsFromItems(
  contextItems: any,
  youtubeIds: Set<string>
): void {
  if (
    contextItems.youtubeVideos &&
    typeof contextItems.youtubeVideos === 'object'
  ) {
    Object.values(contextItems.youtubeVideos).forEach((video: any) => {
      const vid = video?.videoId;
      if (
        vid != null &&
        String(vid).length > 0 &&
        (video.transcript?.length ?? 0) > 0
      ) {
        youtubeIds.add(String(vid));
      }
    });
  }
}

export function youtubeSkipNotice(skippedCount: number): string {
  return `⚠️ Processing limit: Only the first ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} YouTube videos will be processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.`;
}

async function parseChatBody(req: NextRequest): Promise<{
  messages: any[];
  newUnifiedContext: unknown;
  currentDatetime: unknown;
  unifiedContext: unknown;
  enableChatWebSearch: unknown;
  requestedMaxStepsRaw: unknown;
}> {
  const body = await req.json();
  return {
    messages: body.messages ?? [],
    newUnifiedContext: body.newUnifiedContext,
    currentDatetime: body.currentDatetime,
    unifiedContext: body.unifiedContext,
    enableChatWebSearch: body.enableChatWebSearch,
    requestedMaxStepsRaw: body.requestedMaxSteps,
  };
}

function buildContextString(
  newUnifiedContext: unknown,
  oldUnifiedContext: unknown
): {
  contextString: string;
  parsedContextItemsForHints: Record<string, unknown> | null;
  contextJsonParseFailed: boolean;
  youtubeVideoIdsWithClientTranscript: Set<string>;
  clientYoutubeSkipNotice: string | null;
} {
  const youtubeVideoIdsWithClientTranscript = new Set<string>();
  let contextString = '';
  let parsedContextItemsForHints: Record<string, unknown> | null = null;
  let contextJsonParseFailed = false;
  let clientYoutubeSkipNotice: string | null = null;

  if (newUnifiedContext) {
    if (typeof newUnifiedContext === 'string') {
      console.log(
        `[Chat API] Received context string, length: ${newUnifiedContext.length}`
      );
      console.log(
        `[Chat API] First 500 chars:`,
        newUnifiedContext.substring(0, 500)
      );

      const extracted = parseUnifiedContextJson(newUnifiedContext);
      const jsonStr = extracted.contextItems
        ? JSON.stringify(extracted.contextItems)
        : newUnifiedContext.trim();
      const editorContext = extracted.extraText;

      if (extracted.contextItems) {
        console.log(
          `[Chat API] Extracted context JSON (${jsonStr.length} chars) and extra text (${editorContext.length} chars)`
        );
      } else {
        console.log(
          `[Chat API] No JSON object found in unified context, treating as plain text`
        );
      }

      try {
        if (!extracted.contextItems) {
          throw new Error('No JSON object in unified context');
        }
        const contextItems = extracted.contextItems as any;
        parsedContextItemsForHints = contextItems as Record<string, unknown>;
        collectYoutubeIdsFromItems(
          contextItems,
          youtubeVideoIdsWithClientTranscript
        );
        console.log(`[Chat API] Parsed context items:`, {
          hasFiles: !!(
            contextItems.files && Object.keys(contextItems.files).length > 0
          ),
          hasYouTubeVideos: !!(
            contextItems.youtubeVideos &&
            Object.keys(contextItems.youtubeVideos).length > 0
          ),
          youtubeVideoCount: contextItems.youtubeVideos
            ? Object.keys(contextItems.youtubeVideos).length
            : 0,
          youtubeVideoIds: contextItems.youtubeVideos
            ? Object.keys(contextItems.youtubeVideos)
            : [],
          allKeys: Object.keys(contextItems),
          youtubeVideosType: typeof contextItems.youtubeVideos,
          youtubeVideosValue: contextItems.youtubeVideos,
        });

        const { parts, skippedYoutubeCount } = buildContextFromItems(
          contextItems,
          editorContext
        );
        if (skippedYoutubeCount > 0) {
          clientYoutubeSkipNotice = youtubeSkipNotice(skippedYoutubeCount);
        }
        contextString = parts.join('\n\n');
        console.log(
          `[Chat API] Built context string, length: ${contextString.length}, parts: ${parts.length}`
        );
      } catch (e) {
        contextJsonParseFailed = true;
        parsedContextItemsForHints = null;
        console.error(`[Chat API] Failed to parse context JSON:`, e);
        console.error(
          `[Chat API] JSON string was:`,
          jsonStr.substring(0, 500)
        );
        if (Array.isArray(newUnifiedContext)) {
          contextString = newUnifiedContext
            .map((file: any) => formatFilePart(file))
            .join('\n\n');
        } else {
          contextString = newUnifiedContext;
        }
      }
    } else if (Array.isArray(newUnifiedContext)) {
      contextString = newUnifiedContext
        .map((file: any) => formatFilePart(file))
        .join('\n\n');
    }
  } else if (oldUnifiedContext) {
    contextString =
      (oldUnifiedContext as any[])
        ?.map((file: any) => formatFilePart(file))
        .join('\n\n') || '';
  }

  return {
    contextString,
    parsedContextItemsForHints,
    contextJsonParseFailed,
    youtubeVideoIdsWithClientTranscript,
    clientYoutubeSkipNotice,
  };
}

/**
 * Auth, body parse, context, search flags, conversation window, unmatched-tool strip.
 * Protocol adapters (v4 data-stream vs v5 UIMessage) call this then convert messages.
 */
export async function prepareChatRequest(
  req: NextRequest
): Promise<ChatRequestPreparation> {
  let userId: string;
  try {
    const authResult = await handleAuthorizationV2(req);
    userId = authResult.userId;
  } catch (authError: unknown) {
    if (authError instanceof AuthorizationError) {
      console.error('[Chat API] Authorization error:', {
        message: authError.message,
        status: authError.status,
        timestamp: new Date().toISOString(),
      });
    }
    throw authError;
  }

  const {
    messages,
    newUnifiedContext,
    currentDatetime,
    unifiedContext: oldUnifiedContext,
    enableChatWebSearch,
    requestedMaxStepsRaw,
  } = await parseChatBody(req);

  const shouldUseSearch =
    isChatWebSearchEnabled() &&
    enableChatWebSearch !== false &&
    !lastUserMessageHasYoutubeUrl(messages);
  const deepSearch = isChatDeepSearchEnabled();

  console.log('[Chat API] Web search config', {
    shouldUseSearch,
    deepSearch,
    enableChatWebSearch,
    chatWebSearchEnv: process.env.CHAT_WEB_SEARCH ?? '(unset, default on)',
  });

  const userTier = await fetchUserTierForChat(userId);
  const tierMaxSteps = getMaxStepsForUserTier(userTier);
  const requestedMaxStepsParsed = parseRequestedMaxSteps(requestedMaxStepsRaw);

  console.log('[Chat API] Chat tool steps', {
    userTier,
    tierMaxSteps,
    clientRequested: requestedMaxStepsParsed ?? '(none)',
  });

  console.log(`[Chat API] Filtering messages: ${messages.length} total`);
  const filteredMessages = stripUnmatchedToolCalls(messages);

  const maxUserTurns = getChatMaxUserTurnsFromEnv();
  const messagesToProcess =
    maxUserTurns > 0
      ? limitMessagesToLastUserTurns(filteredMessages, maxUserTurns)
      : filteredMessages;

  if (maxUserTurns > 0) {
    console.log('[Chat API] Conversation window', {
      maxUserTurns,
      ...summarizeConversationWindow(filteredMessages, messagesToProcess),
    });
  }

  const context = buildContextString(newUnifiedContext, oldUnifiedContext);

  return {
    userId,
    messages,
    messagesToProcess,
    currentDatetime,
    shouldUseSearch,
    deepSearch,
    userTier,
    tierMaxSteps,
    requestedMaxStepsParsed,
    ...context,
  };
}

export function finishChatModelInput(
  prepared: ChatRequestPreparation,
  convertedMessages: any[],
  options: { includeTemporalGuidance?: boolean } = {}
): FinishedChatModelInput {
  const { finalCoreMessages, state } = applyYoutubeToolDedupToCoreMessages(
    convertedMessages,
    prepared.youtubeVideoIdsWithClientTranscript
  );

  let contextString = prepared.contextString;
  if (state.youtubeTranscriptsInContext) {
    contextString += state.youtubeTranscriptsInContext;
    console.log(
      `[Chat API] Added ${state.hoistedLabelCount} YouTube transcript(s) to context string (${state.youtubeTranscriptsInContext.length} chars)`
    );
  }

  let youtubeOverLimitNotice: string | null = null;
  if (state.youtubeTranscriptCount > YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS) {
    const skippedCount =
      state.youtubeTranscriptCount - YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS;
    console.warn(
      `[Chat API] WARNING: ${state.youtubeTranscriptCount} YouTube transcripts in tool results, but only ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} were eligible for full hoist; extras stubbed.`
    );
    youtubeOverLimitNotice = youtubeSkipNotice(skippedCount);
    contextString += `\n\n[IMPORTANT NOTICE: Due to processing limits, only the first ${YOUTUBE_TOOL_DEDUP_MAX_TRANSCRIPTS} YouTube video transcripts were processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.]`;
  }

  const effectiveMaxSteps = computeEffectiveMaxSteps({
    tierMaxSteps: prepared.tierMaxSteps,
    requestedMaxSteps: prepared.requestedMaxStepsParsed,
    contextCharLength: contextString.length,
  });

  const hints = {
    ...computeChatPromptHints({
      contextItems: prepared.parsedContextItemsForHints,
      contextParseFailed: prepared.contextJsonParseFailed,
      contextString,
      messages: prepared.messagesToProcess,
    }),
    ...(options.includeTemporalGuidance
      ? { includeTemporalGuidance: true }
      : {}),
  };

  const system = buildChatSystemPrompt(
    contextString,
    prepared.currentDatetime as string,
    hints
  );

  return {
    messages: finalCoreMessages,
    system,
    effectiveMaxSteps,
    youtubeOverLimitNotice,
    contextString,
  };
}

export { AuthorizationError };
