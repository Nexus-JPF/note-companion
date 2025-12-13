import {
  convertToCoreMessages,
  streamText,
  createDataStreamResponse,
  generateId,
} from 'ai';
import { NextResponse, NextRequest } from 'next/server';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { openai } from '@ai-sdk/openai';
import { getModel, getResponsesModel } from '@/lib/models';
import { getChatSystemPrompt } from '@/lib/prompts/chat-prompt';
import { chatTools } from './tools';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        const { userId } = await handleAuthorizationV2(req);
        const {
          messages,
          newUnifiedContext,
          currentDatetime,
          unifiedContext: oldUnifiedContext,
          enableSearchGrounding = false,
          deepSearch = false,
        } = await req.json();

        // Handle both formats: array of files (old) or JSON stringified contextItems (new)
        // newUnifiedContext may be a JSON string, or a string containing JSON + editor context
        let contextString = '';

        if (newUnifiedContext) {
          // Check if it's a string (new format with contextItems)
          if (typeof newUnifiedContext === 'string') {
            console.log(
              `[Chat API] Received context string, length: ${newUnifiedContext.length}`
            );
            console.log(
              `[Chat API] First 500 chars:`,
              newUnifiedContext.substring(0, 500)
            );

            // Try to extract JSON from the string (may have editor context appended)
            // Look for JSON object at the start
            let jsonStr = newUnifiedContext.trim();
            let editorContext = '';

            // Check if there's editor context after the JSON
            const editorContextMatch = jsonStr.match(/^(\{.*?\})\s*\n\n(.*)$/s);
            if (editorContextMatch) {
              jsonStr = editorContextMatch[1];
              editorContext = editorContextMatch[2];
              console.log(
                `[Chat API] Extracted JSON (${jsonStr.length} chars) and editor context (${editorContext.length} chars)`
              );
            } else {
              console.log(
                `[Chat API] No editor context found, treating entire string as JSON`
              );
            }

            try {
              const contextItems = JSON.parse(jsonStr);
              console.log(`[Chat API] Parsed context items:`, {
                hasFiles: !!(
                  contextItems.files &&
                  Object.keys(contextItems.files).length > 0
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

              // Debug: Log the actual structure
              if (contextItems.youtubeVideos) {
                console.log(
                  `[Chat API] YouTube videos object:`,
                  JSON.stringify(contextItems.youtubeVideos, null, 2).substring(
                    0,
                    1000
                  )
                );
                const firstVideoId = Object.keys(contextItems.youtubeVideos)[0];
                if (firstVideoId) {
                  const firstVideo = contextItems.youtubeVideos[firstVideoId];
                  console.log(`[Chat API] First video details:`, {
                    id: firstVideo?.id,
                    videoId: firstVideo?.videoId,
                    title: firstVideo?.title,
                    hasTranscript: !!firstVideo?.transcript,
                    transcriptLength: firstVideo?.transcript?.length || 0,
                    transcriptPreview: firstVideo?.transcript?.substring(
                      0,
                      100
                    ),
                  });
                }
              }
              const parts: string[] = [];

              // Format files
              if (
                contextItems.files &&
                Object.keys(contextItems.files).length > 0
              ) {
                Object.values(contextItems.files).forEach((file: any) => {
                  parts.push(
                    `File: ${file.title || file.path}\n\nContent:\n${
                      file.content || ''
                    }\nPath: ${file.path || ''} Reference: ${
                      file.reference || ''
                    }`
                  );
                });
              }

              // Format YouTube videos - IMPORTANT: Include full transcript
              if (
                contextItems.youtubeVideos &&
                Object.keys(contextItems.youtubeVideos).length > 0
              ) {
                Object.values(contextItems.youtubeVideos).forEach(
                  (video: any) => {
                    const transcript = video.transcript || '';
                    // Include full transcript (AI models can handle large contexts)
                    parts.push(
                      `YouTube Video: ${
                        video.title || 'Untitled'
                      }\n\nVideo ID: ${
                        video.videoId || ''
                      }\n\nFull Transcript:\n${transcript}\nReference: ${
                        video.reference || ''
                      }`
                    );
                  }
                );
              }

              // Format folders
              if (
                contextItems.folders &&
                Object.keys(contextItems.folders).length > 0
              ) {
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

              // Format tags
              if (
                contextItems.tags &&
                Object.keys(contextItems.tags).length > 0
              ) {
                Object.values(contextItems.tags).forEach((tag: any) => {
                  parts.push(
                    `Tag: ${tag.name || ''}\n\nFiles: ${
                      tag.files?.length || 0
                    } files\nReference: ${tag.reference || ''}`
                  );
                });
              }

              // Format search results
              if (
                contextItems.searchResults &&
                Object.keys(contextItems.searchResults).length > 0
              ) {
                Object.values(contextItems.searchResults).forEach(
                  (search: any) => {
                    const resultsText =
                      search.results
                        ?.map((r: any) => `- ${r.title || r.path}`)
                        .join('\n') || '';
                    parts.push(
                      `Search Results: "${
                        search.query || ''
                      }"\n\n${resultsText}\nReference: ${
                        search.reference || ''
                      }`
                    );
                  }
                );
              }

              // Format current file
              if (contextItems.currentFile) {
                const file = contextItems.currentFile;
                parts.push(
                  `Current File: ${file.title || file.path}\n\nContent:\n${
                    file.content || ''
                  }\nPath: ${file.path || ''} Reference: ${
                    file.reference || ''
                  }`
                );
              }

              // Format text selections
              if (
                contextItems.textSelections &&
                Object.keys(contextItems.textSelections).length > 0
              ) {
                Object.values(contextItems.textSelections).forEach(
                  (selection: any) => {
                    parts.push(
                      `Text Selection: ${
                        selection.reference || ''
                      }\n\nSelected Text:\n${selection.selectedText || ''}`
                    );
                  }
                );
              }

              // Add editor context if present
              if (editorContext) {
                parts.push(editorContext);
              }

              contextString = parts.join('\n\n');
              console.log(
                `[Chat API] Built context string, length: ${contextString.length}, parts: ${parts.length}`
              );
            } catch (e) {
              console.error(`[Chat API] Failed to parse context JSON:`, e);
              console.error(
                `[Chat API] JSON string was:`,
                jsonStr.substring(0, 500)
              );
              // If parsing fails, treat as plain text or old format
              if (Array.isArray(newUnifiedContext)) {
                contextString = newUnifiedContext
                  .map((file: any) => {
                    return `File: ${file.title}\n\nContent:\n${file.content}\nPath: ${file.path} Reference: ${file.reference}`;
                  })
                  .join('\n\n');
              } else {
                // Fallback: use as-is (might be plain text)
                contextString = newUnifiedContext;
              }
            }
          } else if (Array.isArray(newUnifiedContext)) {
            // Old format: array of files
            contextString = newUnifiedContext
              .map((file: any) => {
                return `File: ${file.title}\n\nContent:\n${file.content}\nPath: ${file.path} Reference: ${file.reference}`;
              })
              .join('\n\n');
          }
        } else if (oldUnifiedContext) {
          // Fallback to old format
          contextString =
            oldUnifiedContext
              ?.map((file: any) => {
                return `File: ${file.title}\n\nContent:\n${file.content}\nPath: ${file.path} Reference: ${file.reference}`;
              })
              .join('\n\n') || '';
        }

        dataStream.writeData('initialized call');

        // Use search-enabled models when requested or when deep search is enabled
        const shouldUseSearch = enableSearchGrounding || deepSearch;

        // Debug: Log tool invocations in messages
        const toolInvocations = messages.filter((m) => m.role === 'tool');
        const assistantMessages = messages.filter(
          (m) => m.role === 'assistant'
        );
        const userMessages = messages.filter((m) => m.role === 'user');

        console.log(`[Chat API] Messages breakdown:`, {
          total: messages.length,
          user: userMessages.length,
          assistant: assistantMessages.length,
          tool: toolInvocations.length,
        });

        if (toolInvocations.length > 0) {
          console.log(
            `[Chat API] Found ${toolInvocations.length} tool results in messages`
          );
          toolInvocations.forEach((tool, idx) => {
            const resultPreview =
              typeof tool.content === 'string'
                ? tool.content.substring(0, 500)
                : JSON.stringify(tool.content).substring(0, 500);
            console.log(`[Chat API] Tool result ${idx + 1}:`, {
              toolCallId: tool.toolCallId,
              toolName: tool.toolName,
              contentLength:
                typeof tool.content === 'string'
                  ? tool.content.length
                  : JSON.stringify(tool.content).length,
              contentPreview: resultPreview,
              hasYouTubeTranscript:
                typeof tool.content === 'string' &&
                tool.content.includes('FULL TRANSCRIPT'),
            });
          });
        } else {
          console.log(
            `[Chat API] No tool results found in messages - checking last assistant message for tool calls`
          );
          const lastAssistant = assistantMessages[assistantMessages.length - 1];
          if (lastAssistant?.toolInvocations) {
            console.log(
              `[Chat API] Last assistant message has ${lastAssistant.toolInvocations.length} tool invocations`
            );
            lastAssistant.toolInvocations.forEach(
              (invocation: any, idx: number) => {
                console.log(`[Chat API] Tool invocation ${idx + 1}:`, {
                  toolName: invocation.toolName,
                  toolCallId: invocation.toolCallId,
                  hasResult: 'result' in invocation,
                  resultType: typeof invocation.result,
                  resultLength:
                    typeof invocation.result === 'string'
                      ? invocation.result.length
                      : JSON.stringify(invocation.result).length,
                  resultPreview:
                    typeof invocation.result === 'string'
                      ? invocation.result.substring(0, 500)
                      : JSON.stringify(invocation.result).substring(0, 500),
                  hasYouTubeTranscript:
                    typeof invocation.result === 'string' &&
                    invocation.result.includes('FULL TRANSCRIPT'),
                });

                // CRITICAL: If this is a YouTube tool with a result, ensure it's accessible to the AI
                // The result should be in the tool invocation, and convertToCoreMessages should extract it
                if (
                  invocation.toolName === 'getYoutubeVideoId' &&
                  invocation.result
                ) {
                  console.log(
                    `[Chat API] YouTube tool result detected - will be included in core messages`
                  );
                }
              }
            );
          }
        }

        if (shouldUseSearch) {
          console.log(`Search grounding enabled (deep: ${deepSearch})`);

          // Convert messages to core format to ensure tool results are properly included
          const coreMessages = convertToCoreMessages(messages);
          console.log(
            `[Chat API] Converted ${messages.length} messages to ${coreMessages.length} core messages (search mode)`
          );

          const result = await streamText({
            model: getResponsesModel(),
            system: getChatSystemPrompt(contextString, currentDatetime),
            maxSteps: 5,
            messages: coreMessages, // Use converted messages
            tools: {
              ...chatTools,
              web_search_preview: openai.tools.webSearchPreview({
                searchContextSize: deepSearch ? 'high' : 'medium',
              }) as any, // Type cast for AI SDK v2 compatibility
            },
            onFinish: async ({ usage, sources }) => {
              console.log('Token usage:', usage);
              console.log('Search sources:', sources);

              if (sources && sources.length > 0) {
                // Map the sources to our expected citation format
                const citations = sources.map((source) => ({
                  url: source.url,
                  title: source.title || source.url,
                  // Default to 0 for indices if not provided
                  startIndex: 0,
                  endIndex: 0,
                }));

                if (citations.length > 0) {
                  dataStream.writeMessageAnnotation({
                    type: 'search-results',
                    citations,
                  });
                }
              }

              await incrementAndLogTokenUsage(userId, usage.totalTokens);
              dataStream.writeData('call completed');
            },
          });

          result.mergeIntoDataStream(dataStream);
        } else {
          console.log('Chat using default model (no search)');

          // Log context for debugging
          const hasYouTubeVideos = contextString.includes('YouTube Video:');
          console.log(
            `[Chat API] Context length: ${contextString.length}, Has YouTube videos: ${hasYouTubeVideos}`
          );
          if (hasYouTubeVideos) {
            const videoMatch = contextString.match(/YouTube Video: ([^\n]+)/);
            console.log(
              `[Chat API] YouTube video in context: ${
                videoMatch ? videoMatch[1] : 'found but title not extracted'
              }`
            );
          }

          // Convert messages to core format - convertToCoreMessages handles tool invocations correctly
          // Tool results should already be in the correct format (plain strings, not JSON-encoded)
          const coreMessages = convertToCoreMessages(messages);
          console.log(
            `[Chat API] Converted ${messages.length} messages to ${coreMessages.length} core messages`
          );

          // Extract toolCallId/toolName and YouTube transcripts from tool messages
          // Also add YouTube transcripts to contextString so model can definitely see them
          let youtubeTranscriptsInContext = '';
          const finalCoreMessages = coreMessages.map((message) => {
            if (message.role !== 'tool') {
              return message;
            }

            const tool = message as any;

            // If toolCallId/toolName are missing but content is an array with tool-result objects
            if (
              (!tool.toolCallId || !tool.toolName) &&
              Array.isArray(tool.content) &&
              tool.content.length > 0
            ) {
              const firstItem = tool.content[0];
              if (
                firstItem &&
                typeof firstItem === 'object' &&
                firstItem.type === 'tool-result' &&
                firstItem.toolCallId &&
                firstItem.toolName
              ) {
                console.log(
                  `[Chat API] Extracting toolCallId/toolName from content array: ${firstItem.toolCallId}, ${firstItem.toolName}`
                );

                // If this is a YouTube video tool result, extract the transcript and add to context
                if (
                  firstItem.toolName === 'getYoutubeVideoId' &&
                  firstItem.result &&
                  typeof firstItem.result === 'string' &&
                  firstItem.result.includes('FULL TRANSCRIPT')
                ) {
                  console.log(
                    `[Chat API] Extracting YouTube transcript from tool result to add to context (${firstItem.result.length} chars)`
                  );
                  youtubeTranscriptsInContext += `\n\nYouTube Video Transcript:\n${firstItem.result}\n`;
                }

                return {
                  ...message,
                  toolCallId: firstItem.toolCallId,
                  toolName: firstItem.toolName,
                } as any;
              }
            }

            return message;
          });

          // Add YouTube transcripts to context string if found
          if (youtubeTranscriptsInContext) {
            contextString += youtubeTranscriptsInContext;
            console.log(
              `[Chat API] Added YouTube transcript(s) to context string (${youtubeTranscriptsInContext.length} chars)`
            );
          }

          // Log tool messages to verify format
          const toolMessages = finalCoreMessages.filter(
            (m) => m.role === 'tool'
          );
          if (toolMessages.length > 0) {
            toolMessages.forEach((tool, idx) => {
              const toolAny = tool as any;
              const contentStr =
                typeof toolAny.content === 'string'
                  ? toolAny.content
                  : Array.isArray(toolAny.content)
                  ? JSON.stringify(toolAny.content)
                  : JSON.stringify(toolAny.content);
              const contentPreview = contentStr.substring(0, 200);
              console.log(
                `[Chat API] Tool message ${idx + 1} after extraction:`,
                {
                  toolCallId: toolAny.toolCallId,
                  toolName: toolAny.toolName,
                  contentType: typeof toolAny.content,
                  contentIsArray: Array.isArray(toolAny.content),
                  contentLength: contentStr.length,
                  contentPreview,
                  hasYouTubeTranscript: contentStr.includes('FULL TRANSCRIPT'),
                }
              );
            });
          }

          // Log the actual content that will be sent to the model for tool messages
          const toolMessagesForModel = finalCoreMessages.filter(
            (m) => m.role === 'tool'
          );
          if (toolMessagesForModel.length > 0) {
            toolMessagesForModel.forEach((tool, idx) => {
              const toolAny = tool as any;
              if (
                Array.isArray(toolAny.content) &&
                toolAny.content.length > 0
              ) {
                const firstItem = toolAny.content[0];
                if (firstItem?.result && typeof firstItem.result === 'string') {
                  const transcriptPreview = firstItem.result.substring(0, 300);
                  console.log(
                    `[Chat API] Tool message ${
                      idx + 1
                    } content that model will see:`,
                    {
                      toolCallId: toolAny.toolCallId,
                      toolName: toolAny.toolName,
                      resultLength: firstItem.result.length,
                      resultPreview: transcriptPreview,
                      hasFullTranscript:
                        firstItem.result.includes('FULL TRANSCRIPT'),
                    }
                  );
                }
              }
            });
          }

          const result = await streamText({
            model: getModel(),
            system: getChatSystemPrompt(contextString, currentDatetime),
            maxSteps: 5,
            messages: finalCoreMessages, // Use messages with extracted toolCallId/toolName
            tools: chatTools, // Regular tools, no web search
            onFinish: async ({ usage, sources }) => {
              console.log('Token usage:', usage);
              console.log('Sources:', sources);
              const citations = sources?.map((source) => ({
                url: source.url,
                title: source.title || source.url,
                // Default to 0 for indices if not provided
                startIndex: 0,
                endIndex: 0,
              }));
              console.log('Citations:', citations);

              if (citations?.length > 0) {
                dataStream.writeMessageAnnotation({
                  type: 'search-results',
                  citations,
                });
              }

              await incrementAndLogTokenUsage(userId, usage.totalTokens);
              dataStream.writeData('call completed');
            },
          });

          result.mergeIntoDataStream(dataStream);
        }
      } catch (error) {
        console.error('Error in POST request:', error);
        throw error;
      }
    },
    onError: (error) => {
      console.error('Error in stream:', error);
      return error instanceof Error ? error.message : String(error);
    },
  });
}
