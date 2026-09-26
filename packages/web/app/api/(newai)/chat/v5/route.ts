import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
} from 'ai-v5';
import { NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { LARGE_CONTEXT_CHAR_THRESHOLD } from '@/lib/chat/chat-max-steps';
import { getChatResponsesProviderOptions } from '@/lib/chat/chat-openai-options';
import { coerceToUiMessages } from '@/lib/chat/coerce-ui-messages';
import { getModelV5, getResponsesModelV5, openaiV5 } from '@/lib/models-v5';
import { buildV5ChatTools } from '../tools';
import {
  AuthorizationError,
  finishChatModelInput,
  prepareChatRequest,
} from '@/lib/chat/prepare-chat-request';

export const maxDuration = 300;

function usageTokenCount(usage: {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
} | undefined): number {
  if (!usage) return 0;
  if (typeof usage.totalTokens === 'number') return usage.totalTokens;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function mapCitations(
  sources: Array<{ url: string; title?: string }> | undefined
) {
  return (sources ?? []).map((source) => ({
    url: source.url,
    title: source.title || source.url,
    startIndex: 0,
    endIndex: 0,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const prepared = await prepareChatRequest(req);

    const v5Tools = buildV5ChatTools(tool as any);
    const uiMessages = coerceToUiMessages(prepared.messagesToProcess);

    const stream = createUIMessageStream({
      originalMessages: uiMessages,
      execute: async ({ writer }) => {
        if (prepared.clientYoutubeSkipNotice) {
          writer.write({
            type: 'data-notification',
            data: { message: prepared.clientYoutubeSkipNotice },
            transient: true,
          } as any);
        }

        writer.write({
          type: 'data-status',
          data: { value: 'initialized call' },
        } as any);

        let modelMessages;
        try {
          modelMessages = convertToModelMessages(uiMessages, {
            ignoreIncompleteToolCalls: true,
            tools: v5Tools as any,
          });
        } catch (error: any) {
          console.error(
            '[Chat API v5] convertToModelMessages failed:',
            error?.message ?? error
          );
          throw error;
        }

        const finished = finishChatModelInput(
          prepared,
          modelMessages,
          prepared.shouldUseSearch
            ? { includeTemporalGuidance: true }
            : {}
        );

        if (finished.youtubeOverLimitNotice) {
          writer.write({
            type: 'data-notification',
            data: { message: finished.youtubeOverLimitNotice },
            transient: true,
          } as any);
        }

        if (finished.contextString.length > LARGE_CONTEXT_CHAR_THRESHOLD) {
          console.log(
            `[Chat API v5] Large context (${finished.contextString.length} chars); effectiveMaxSteps=${finished.effectiveMaxSteps}`
          );
        }
        console.log('[Chat API v5] effectiveMaxSteps', {
          effectiveMaxSteps: finished.effectiveMaxSteps,
          contextSize: finished.contextString.length,
          shouldUseSearch: prepared.shouldUseSearch,
        });

        const searchTools = prepared.shouldUseSearch
          ? {
              web_search_preview: openaiV5.tools.webSearchPreview({
                searchContextSize: prepared.deepSearch ? 'medium' : 'low',
              }) as any,
            }
          : {};

        const result = streamText({
          model: prepared.shouldUseSearch
            ? getResponsesModelV5()
            : getModelV5(),
          ...(prepared.shouldUseSearch
            ? { providerOptions: getChatResponsesProviderOptions() }
            : {}),
          system: finished.system,
          stopWhen: stepCountIs(finished.effectiveMaxSteps),
          messages: finished.messages,
          tools: {
            ...v5Tools,
            ...searchTools,
          } as any,
          onFinish: async (event) => {
            const citations = mapCitations(event.sources as any);
            if (citations.length > 0) {
              writer.write({
                type: 'data-search-results',
                data: { citations },
              } as any);
            }
            await incrementAndLogTokenUsage(
              prepared.userId,
              usageTokenCount(event.totalUsage ?? event.usage)
            );
          },
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error('[Chat API v5] Error in stream:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : typeof error,
          timestamp: new Date().toISOString(),
        });
        return error instanceof Error ? error.message : String(error);
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(
        JSON.stringify({ error: error.message, status: error.status }),
        {
          status: error.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    console.error('[Chat API v5] Error in POST request:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
