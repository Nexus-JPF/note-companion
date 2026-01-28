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

export const maxDuration = 300; // Allow for complex multi-step tool calls and long conversations

export async function POST(req: NextRequest) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        // Handle authorization - catch AuthorizationError to return proper status codes
        let userId: string;
        try {
          const authResult = await handleAuthorizationV2(req);
          userId = authResult.userId;
        } catch (authError: unknown) {
          // Import AuthorizationError dynamically
          const { AuthorizationError } = await import(
            '@/lib/handleAuthorization'
          );

          if (authError instanceof AuthorizationError) {
            console.error('[Chat API] Authorization error:', {
              message: authError.message,
              status: authError.status,
              timestamp: new Date().toISOString(),
            });
            // Write error to stream and throw to stop execution
            dataStream.writeData(
              JSON.stringify({
                error: authError.message,
                status: authError.status,
              })
            );
            throw authError;
          }
          // Re-throw if it's not an AuthorizationError
          throw authError;
        }
        const {
          messages,
          newUnifiedContext,
          currentDatetime,
          unifiedContext: oldUnifiedContext,
          enableSearchGrounding = false,
          deepSearch = false,
        } = await req.json();

        // CRITICAL: Strip unmatched tool calls - every tool call must have a corresponding tool result
        // This prevents "ToolInvocation must have a result" errors from convertToCoreMessages
        const stripUnmatchedToolCalls = (msgs: any[]) => {
          // Collect all tool result IDs from role:"tool" messages
          const toolResultIds = new Set(
            msgs
              .filter((m) => m.role === 'tool' && m.toolCallId)
              .map((m) => m.toolCallId)
          );

          console.log(
            `[Chat API] Found ${toolResultIds.size} tool results in message history`
          );

          return msgs.map((message: any) => {
            // CRITICAL: Handle tool invocations in message.parts array (most common format)
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

            // 1) Handle toolInvocations array (standard path)
            if (message.role === 'assistant' && Array.isArray(message.toolInvocations)) {
              const kept = message.toolInvocations.filter((inv: any) => {
                // Keep only tool calls that have a matching tool result
                const hasMatchingResult = toolResultIds.has(inv.toolCallId);
                // Also keep if it already has a result embedded
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

            // 2) Handle tool calls embedded in content parts (AI SDK sometimes stores them here)
            if (message.role === 'assistant' && Array.isArray(message.content)) {
              const filteredParts = message.content.filter((part: any) => {
                // Remove ALL tool-call parts that don't have matching results
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
                    // If no toolCallId, remove it to be safe
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
            
            // 3) Also handle string content that might contain tool call references
            // (Some SDK versions embed tool calls differently)
            if (message.role === 'assistant' && typeof message.content === 'string') {
              // Content is a string, no tool calls to filter here
              return message;
            }

            return message;
          });
        };

        // Apply filtering immediately after parsing messages
        console.log(`[Chat API] Filtering messages: ${messages.length} total`);
        const filteredMessages = stripUnmatchedToolCalls(messages);

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
                  contextItems.youtubeVideos != null
                    ? JSON.stringify(
                        contextItems.youtubeVideos,
                        null,
                        2
                      ).substring(0, 1000)
                    : '(no videos)'
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

              // Format YouTube videos - Limit to prevent timeout
              if (
                contextItems.youtubeVideos &&
                Object.keys(contextItems.youtubeVideos).length > 0
              ) {
                const MAX_YOUTUBE_TRANSCRIPTS = 10; // Limit to prevent timeout
                const MAX_TRANSCRIPT_LENGTH = 8000; // Truncate very long transcripts
                const youtubeVideos = Object.values(contextItems.youtubeVideos);
                const videosToProcess = youtubeVideos.slice(
                  0,
                  MAX_YOUTUBE_TRANSCRIPTS
                );
                const skippedCount =
                  youtubeVideos.length - videosToProcess.length;

                videosToProcess.forEach((video: any) => {
                  let transcript = video.transcript || '';

                  // Truncate very long transcripts
                  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
                    transcript =
                      transcript.substring(0, MAX_TRANSCRIPT_LENGTH) +
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

                if (skippedCount > 0) {
                  console.warn(
                    `[Chat API] WARNING: ${youtubeVideos.length} YouTube videos in context, but only ${MAX_YOUTUBE_TRANSCRIPTS} processed to prevent timeout. ${skippedCount} video(s) skipped.`
                  );

                  // Send user-facing notification via data stream
                  dataStream.writeData(
                    JSON.stringify({
                      type: 'notification',
                      message: `⚠️ Processing limit: Only the first ${MAX_YOUTUBE_TRANSCRIPTS} YouTube videos will be processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.`,
                    })
                  );

                  // Add notice to context so AI can inform user
                  parts.push(
                    `\n\n[IMPORTANT NOTICE: Due to processing limits, only the first ${MAX_YOUTUBE_TRANSCRIPTS} YouTube video transcripts were processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.]`
                  );
                }
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

        // Use filtered messages for all processing
        const messagesToProcess = filteredMessages;

        // Debug: Log tool invocations in messages
        const toolInvocations = messagesToProcess.filter((m) => m.role === 'tool');
        const assistantMessages = messagesToProcess.filter(
          (m) => m.role === 'assistant'
        );
        const userMessages = messagesToProcess.filter((m) => m.role === 'user');

        console.log(`[Chat API] Messages breakdown:`, {
          total: messagesToProcess.length,
          originalTotal: messages.length,
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
                : tool.content != null
                ? JSON.stringify(tool.content).substring(0, 500)
                : '(no content)';
            console.log(`[Chat API] Tool result ${idx + 1}:`, {
              toolCallId: tool.toolCallId,
              toolName: tool.toolName,
              contentLength:
                typeof tool.content === 'string'
                  ? tool.content.length
                  : tool.content != null
                  ? JSON.stringify(tool.content).length
                  : 0,
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
                const logData: any = {
                  toolName: invocation.toolName,
                  toolCallId: invocation.toolCallId,
                  hasResult: 'result' in invocation,
                  resultType: typeof invocation.result,
                  resultLength:
                    typeof invocation.result === 'string'
                      ? invocation.result.length
                      : invocation.result != null
                      ? JSON.stringify(invocation.result).length
                      : 0,
                  resultPreview:
                    typeof invocation.result === 'string'
                      ? invocation.result.substring(0, 500)
                      : invocation.result != null
                      ? JSON.stringify(invocation.result).substring(0, 500)
                      : '(no result)',
                  hasYouTubeTranscript:
                    typeof invocation.result === 'string' &&
                    invocation.result.includes('FULL TRANSCRIPT'),
                };
                
                // For ScreenPipe searches, log the search parameters and result summary
                if (invocation.toolName === 'searchScreenpipe' && invocation.args) {
                  logData.searchParams = {
                    app_name: invocation.args.app_name || '(empty)',
                    window_name: invocation.args.window_name || '(empty)',
                    limit: invocation.args.limit,
                    content_type: invocation.args.content_type,
                    q: invocation.args.q || '(empty)',
                    start_time: invocation.args.start_time || '(empty)',
                    end_time: invocation.args.end_time || '(empty)',
                  };
                  
                  // Parse result to show how many results were found
                  if (invocation.result && typeof invocation.result === 'string') {
                    try {
                      const parsed = JSON.parse(invocation.result);
                      if (Array.isArray(parsed)) {
                        logData.resultCount = parsed.length;
                        logData.resultApps = [...new Set(parsed.map((r: any) => r.app))].slice(0, 5);
                        logData.resultWindows = [...new Set(parsed.map((r: any) => r.window))].slice(0, 5);
                      } else if (parsed.message) {
                        logData.resultMessage = parsed.message;
                      }
                    } catch (e) {
                      // Not JSON, ignore
                    }
                  }
                }
                
                console.log(`[Chat API] Tool invocation ${idx + 1}:`, logData);

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

          // Messages are already filtered above, but double-check before converting
          // Final safety check - strip any unmatched tool calls
          const finalFilteredMessages = stripUnmatchedToolCalls(messagesToProcess);
          
          // Debug: Log any remaining tool invocations without results
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
          
          // Convert messages to core format to ensure tool results are properly included
          let coreMessages;
          try {
            coreMessages = convertToCoreMessages(finalFilteredMessages);
          } catch (error: any) {
            // If conversion fails, log the problematic messages and apply even more aggressive filtering
            console.error('[Chat API] convertToCoreMessages failed (search mode):', error.message);
            console.error('[Chat API] Problematic messages:', JSON.stringify(finalFilteredMessages, null, 2));
            
            // Apply ultra-aggressive filter: remove ALL tool invocations that don't have explicit results
            const ultraFiltered = finalFilteredMessages.map((msg: any) => {
              if (msg.role === 'assistant') {
                // Remove toolInvocations entirely if any don't have results
                if (Array.isArray(msg.toolInvocations)) {
                  const safeInvocations = msg.toolInvocations.filter((inv: any) => {
                    return inv.result != null || inv.state === 'result';
                  });
                  if (safeInvocations.length < msg.toolInvocations.length) {
                    const { toolInvocations, ...rest } = msg;
                    return safeInvocations.length > 0 ? { ...rest, toolInvocations: safeInvocations } : rest;
                  }
                }
                // Also filter content parts
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
            
            coreMessages = convertToCoreMessages(ultraFiltered);
          }
          console.log(
            `[Chat API] Converted ${messages.length} messages to ${coreMessages.length} core messages (search mode)`
          );

          // Reduce maxSteps when context is very large to prevent timeout
          const contextSize = contextString.length;
          const isLargeContext = contextSize > 100000; // > 100KB
          const adaptiveMaxSteps = isLargeContext ? 3 : 5;

          if (isLargeContext) {
            console.log(
              `[Chat API] Large context detected (${contextSize} chars) - reducing maxSteps to ${adaptiveMaxSteps} to prevent timeout`
            );
          }

          const result = await streamText({
            model: getResponsesModel() as any,
            system: getChatSystemPrompt(contextString, currentDatetime),
            maxSteps: adaptiveMaxSteps,
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

          // Messages are already filtered above, but double-check before converting
          // Final safety check - strip any unmatched tool calls
          const finalFilteredMessages = stripUnmatchedToolCalls(messagesToProcess);
          
          // Debug: Log any remaining tool invocations without results
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
          
          // Convert messages to core format - convertToCoreMessages handles tool invocations correctly
          // Tool results should already be in the correct format (plain strings, not JSON-encoded)
          let coreMessages;
          try {
            coreMessages = convertToCoreMessages(finalFilteredMessages);
          } catch (error: any) {
            // If conversion fails, log the problematic messages and apply even more aggressive filtering
            console.error('[Chat API] convertToCoreMessages failed:', error.message);
            console.error('[Chat API] Problematic messages:', JSON.stringify(finalFilteredMessages, null, 2));
            
            // Apply ultra-aggressive filter: remove ALL tool invocations that don't have explicit results
            const ultraFiltered = finalFilteredMessages.map((msg: any) => {
              if (msg.role === 'assistant') {
                // Remove toolInvocations entirely if any don't have results
                if (Array.isArray(msg.toolInvocations)) {
                  const safeInvocations = msg.toolInvocations.filter((inv: any) => {
                    return inv.result != null || inv.state === 'result';
                  });
                  if (safeInvocations.length < msg.toolInvocations.length) {
                    const { toolInvocations, ...rest } = msg;
                    return safeInvocations.length > 0 ? { ...rest, toolInvocations: safeInvocations } : rest;
                  }
                }
                // Also filter content parts
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
            
            coreMessages = convertToCoreMessages(ultraFiltered);
          }
          console.log(
            `[Chat API] Converted ${messages.length} messages to ${coreMessages.length} core messages`
          );

          // Extract toolCallId/toolName and YouTube transcripts from tool messages
          // Also add YouTube transcripts to contextString so model can definitely see them
          let youtubeTranscriptsInContext = '';
          let youtubeTranscriptCount = 0;
          const MAX_YOUTUBE_TRANSCRIPTS = 10; // Limit to prevent timeout
          const MAX_TRANSCRIPT_LENGTH = 8000; // Truncate very long transcripts

          const finalCoreMessages = coreMessages
            .map((message) => {
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
                    youtubeTranscriptCount++;

                    // Limit number of transcripts to prevent timeout
                    if (youtubeTranscriptCount <= MAX_YOUTUBE_TRANSCRIPTS) {
                      let transcript = firstItem.result;

                      // Truncate very long transcripts
                      if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
                        transcript =
                          transcript.substring(0, MAX_TRANSCRIPT_LENGTH) +
                          `\n\n[Transcript truncated - original length: ${firstItem.result.length} chars]`;
                        console.log(
                          `[Chat API] Truncated YouTube transcript from ${firstItem.result.length} to ${transcript.length} chars`
                        );
                      }

                      console.log(
                        `[Chat API] Extracting YouTube transcript ${youtubeTranscriptCount} from tool result to add to context (${transcript.length} chars)`
                      );
                      youtubeTranscriptsInContext += `\n\nYouTube Video Transcript ${youtubeTranscriptCount}:\n${transcript}\n`;

                      // Return the message (include it in finalCoreMessages)
                      return {
                        ...message,
                        toolCallId: firstItem.toolCallId,
                        toolName: firstItem.toolName,
                      } as any;
                    } else {
                      console.log(
                        `[Chat API] Skipping YouTube transcript ${youtubeTranscriptCount} - exceeded limit of ${MAX_YOUTUBE_TRANSCRIPTS} transcripts. Filtering out tool message.`
                      );
                      // Return null to filter out this message
                      return null as any;
                    }
                  }
                }

                return {
                  ...message,
                  toolCallId: firstItem.toolCallId,
                  toolName: firstItem.toolName,
                } as any;
              }

              return message;
            })
            .filter(
              (message): message is NonNullable<typeof message> =>
                message !== null
            ); // Filter out null messages (exceeded limit)

          // Add YouTube transcripts to context string if found
          if (youtubeTranscriptsInContext) {
            contextString += youtubeTranscriptsInContext;
            console.log(
              `[Chat API] Added ${Math.min(
                youtubeTranscriptCount,
                MAX_YOUTUBE_TRANSCRIPTS
              )} YouTube transcript(s) to context string (${
                youtubeTranscriptsInContext.length
              } chars)`
            );

            if (youtubeTranscriptCount > MAX_YOUTUBE_TRANSCRIPTS) {
              const skippedCount =
                youtubeTranscriptCount - MAX_YOUTUBE_TRANSCRIPTS;
              console.warn(
                `[Chat API] WARNING: ${youtubeTranscriptCount} YouTube transcripts found, but only ${MAX_YOUTUBE_TRANSCRIPTS} added to context to prevent timeout`
              );

              // Send user-facing notification via data stream
              dataStream.writeData(
                JSON.stringify({
                  type: 'notification',
                  message: `⚠️ Processing limit: Only the first ${MAX_YOUTUBE_TRANSCRIPTS} YouTube videos will be processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.`,
                })
              );

              // Add notice to context so AI can also mention it naturally
              contextString += `\n\n[IMPORTANT NOTICE: Due to processing limits, only the first ${MAX_YOUTUBE_TRANSCRIPTS} YouTube video transcripts were processed in this request. ${skippedCount} additional video(s) were skipped to prevent timeout. Please make a separate request to process the remaining videos.]`;
            }
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

          // Reduce maxSteps when context is very large to prevent timeout
          const contextSize = contextString.length;
          const isLargeContext = contextSize > 100000; // > 100KB
          const adaptiveMaxSteps = isLargeContext ? 3 : 5;

          if (isLargeContext) {
            console.log(
              `[Chat API] Large context detected (${contextSize} chars) - reducing maxSteps to ${adaptiveMaxSteps} to prevent timeout`
            );
          }

          const result = await streamText({
            model: getModel() as any,
            system: getChatSystemPrompt(contextString, currentDatetime),
            maxSteps: adaptiveMaxSteps,
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
