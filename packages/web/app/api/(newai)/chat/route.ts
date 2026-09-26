import {
  convertToCoreMessages,
  streamText,
  createDataStreamResponse,
} from 'ai';
import { NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { openai } from '@ai-sdk/openai';
import { getModel, getResponsesModel } from '@/lib/models';
import { LARGE_CONTEXT_CHAR_THRESHOLD } from '@/lib/chat/chat-max-steps';
import { getChatResponsesProviderOptions } from '@/lib/chat/chat-openai-options';
import { buildChatToolsForMode } from './tools';
import {
  AuthorizationError,
  finishChatModelInput,
  prepareChatRequest,
  stripUnmatchedToolCalls,
} from '@/lib/chat/prepare-chat-request';

export const maxDuration = 300;

function convertV4Messages(messagesToProcess: any[]): any[] {
  const finalFilteredMessages = stripUnmatchedToolCalls(messagesToProcess);

  finalFilteredMessages.forEach((msg: any, idx: number) => {
    if (msg.role === 'assistant' && msg.toolInvocations) {
      msg.toolInvocations.forEach((inv: any) => {
        if (!inv.result && inv.state !== 'result') {
          console.error(
            `[Chat API] WARNING: Found tool invocation without result at message ${idx}: ${inv.toolName} (${inv.toolCallId})`
          );
        }
      });
    }
  });

  try {
    return convertToCoreMessages(finalFilteredMessages);
  } catch (error: any) {
    console.error(
      '[Chat API] convertToCoreMessages failed:',
      error.message
    );
    console.error(
      '[Chat API] Problematic messages:',
      JSON.stringify(finalFilteredMessages, null, 2)
    );

    const ultraFiltered = finalFilteredMessages.map((msg: any) => {
      if (msg.role === 'assistant') {
        if (Array.isArray(msg.toolInvocations)) {
          const safeInvocations = msg.toolInvocations.filter((inv: any) => {
            return inv.result != null || inv.state === 'result';
          });
          if (safeInvocations.length < msg.toolInvocations.length) {
            const { toolInvocations, ...rest } = msg;
            return safeInvocations.length > 0
              ? { ...rest, toolInvocations: safeInvocations }
              : rest;
          }
        }
        if (Array.isArray(msg.parts)) {
          const safeParts = msg.parts.filter((part: any) => {
            if (part?.type === 'tool-invocation' && part?.toolInvocation) {
              return (
                part.toolInvocation.result != null ||
                part.toolInvocation.state === 'result'
              );
            }
            return true;
          });
          if (safeParts.length < msg.parts.length) {
            return { ...msg, parts: safeParts };
          }
        }
        if (Array.isArray(msg.content)) {
          const safeContent = msg.content.filter((part: any) => {
            if (part?.type === 'tool-call' || part?.type?.startsWith('tool-')) {
              return part.result != null || part.state === 'result';
            }
            return true;
          });
          if (safeContent.length < msg.content.length) {
            return { ...msg, content: safeContent };
          }
        }
      }
      return msg;
    });

    return convertToCoreMessages(ultraFiltered);
  }
}

function mapCitations(sources: Array<{ url: string; title?: string }> | undefined) {
  return (sources ?? []).map((source) => ({
    url: source.url,
    title: source.title || source.url,
    startIndex: 0,
    endIndex: 0,
  }));
}

export async function POST(req: NextRequest) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        let prepared;
        try {
          prepared = await prepareChatRequest(req);
        } catch (authError: unknown) {
          if (authError instanceof AuthorizationError) {
            dataStream.writeData(
              JSON.stringify({
                error: authError.message,
                status: authError.status,
              })
            );
            throw authError;
          }
          throw authError;
        }

        if (prepared.clientYoutubeSkipNotice) {
          dataStream.writeData(
            JSON.stringify({
              type: 'notification',
              message: prepared.clientYoutubeSkipNotice,
            })
          );
        }

        dataStream.writeData('initialized call');

        const toolInvocations = prepared.messagesToProcess.filter(
          (m) => m.role === 'tool'
        );
        const assistantMessages = prepared.messagesToProcess.filter(
          (m) => m.role === 'assistant'
        );
        const userMessages = prepared.messagesToProcess.filter(
          (m) => m.role === 'user'
        );

        console.log(`[Chat API] Messages breakdown:`, {
          total: prepared.messagesToProcess.length,
          originalTotal: prepared.messages.length,
          user: userMessages.length,
          assistant: assistantMessages.length,
          tool: toolInvocations.length,
        });

        const emitYoutubeOverLimit = (notice: string | null) => {
          if (!notice) return;
          dataStream.writeData(
            JSON.stringify({
              type: 'notification',
              message: notice,
            })
          );
        };

        if (prepared.shouldUseSearch) {
          console.log(`Search grounding enabled (deep: ${prepared.deepSearch})`);

          const coreMessages = convertV4Messages(prepared.messagesToProcess);
          console.log(
            `[Chat API] Converted ${prepared.messagesToProcess.length} messages to ${coreMessages.length} core messages (search mode)`
          );

          const finished = finishChatModelInput(prepared, coreMessages, {
            includeTemporalGuidance: true,
          });
          emitYoutubeOverLimit(finished.youtubeOverLimitNotice);

          if (finished.contextString.length > LARGE_CONTEXT_CHAR_THRESHOLD) {
            console.log(
              `[Chat API] Large context (${finished.contextString.length} chars); effectiveMaxSteps=${finished.effectiveMaxSteps}`
            );
          }
          console.log('[Chat API] effectiveMaxSteps (search)', {
            effectiveMaxSteps: finished.effectiveMaxSteps,
            contextSize: finished.contextString.length,
          });

          const result = streamText({
            model: getResponsesModel() as any,
            providerOptions: getChatResponsesProviderOptions(),
            system: finished.system,
            maxSteps: finished.effectiveMaxSteps,
            messages: finished.messages,
            tools: {
              ...buildChatToolsForMode('full'),
              web_search_preview: openai.tools.webSearchPreview({
                searchContextSize: prepared.deepSearch ? 'medium' : 'low',
              }) as any,
            },
            onFinish: async ({ usage, sources }) => {
              console.log('Token usage:', usage);
              console.log('Search sources:', sources);

              const citations = mapCitations(sources as any);
              if (citations.length > 0) {
                dataStream.writeMessageAnnotation({
                  type: 'search-results',
                  citations,
                });
              }

              await incrementAndLogTokenUsage(prepared.userId, usage.totalTokens);
              dataStream.writeData('call completed');
            },
          });

          result.mergeIntoDataStream(dataStream);
        } else {
          console.log('Chat using default model (no search)');

          const hasYouTubeVideos = prepared.contextString.includes('YouTube Video:');
          console.log(
            `[Chat API] Context length: ${prepared.contextString.length}, Has YouTube videos: ${hasYouTubeVideos}`
          );

          const coreMessages = convertV4Messages(prepared.messagesToProcess);
          console.log(
            `[Chat API] Converted ${prepared.messagesToProcess.length} messages to ${coreMessages.length} core messages`
          );

          const finished = finishChatModelInput(prepared, coreMessages);
          emitYoutubeOverLimit(finished.youtubeOverLimitNotice);

          if (finished.contextString.length > LARGE_CONTEXT_CHAR_THRESHOLD) {
            console.log(
              `[Chat API] Large context (${finished.contextString.length} chars); effectiveMaxSteps=${finished.effectiveMaxSteps}`
            );
          }
          console.log('[Chat API] effectiveMaxSteps (default)', {
            effectiveMaxSteps: finished.effectiveMaxSteps,
            contextSize: finished.contextString.length,
          });

          const result = streamText({
            model: getModel() as any,
            system: finished.system,
            maxSteps: finished.effectiveMaxSteps,
            messages: finished.messages,
            tools: buildChatToolsForMode('full'),
            onFinish: async ({ usage, sources }) => {
              console.log('Token usage:', usage);
              console.log('Sources:', sources);
              const citations = mapCitations(sources as any);
              console.log('Citations:', citations);

              if (citations.length > 0) {
                dataStream.writeMessageAnnotation({
                  type: 'search-results',
                  citations,
                });
              }

              await incrementAndLogTokenUsage(prepared.userId, usage.totalTokens);
              dataStream.writeData('call completed');
            },
          });

          result.mergeIntoDataStream(dataStream);
        }
      } catch (error) {
        console.error('[Chat API] Error in POST request:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : typeof error,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    },
    onError: (error) => {
      console.error('[Chat API] Error in stream:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
        timestamp: new Date().toISOString(),
      });
      return error instanceof Error ? error.message : String(error);
    },
  });
}
