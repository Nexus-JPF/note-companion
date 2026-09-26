import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { POST } from './route';

// Mock the AI SDK
/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('ai', () => {
  return {
    streamText: jest.fn().mockImplementation((options: any) => {
      const mockResult = {
        mergeIntoDataStream: jest.fn(async (dataStream: any) => {
          // Simulate streaming some data
          dataStream.writeData('test response');

          // If onFinish callback exists, call it synchronously (it will be awaited)
          if (options?.onFinish) {
            // Simulate sources for search mode
            if (options?.tools?.web_search_preview) {
              // Call onFinish with sources for search mode
              await options.onFinish({
                usage: { totalTokens: 100 },
                sources: [
                  { url: 'https://example.com', title: 'Example Website' },
                ],
              });
            } else {
              // For non-search mode, still call onFinish but without sources
              await options.onFinish({
                usage: { totalTokens: 100 },
              });
            }
          }
        }),
        toDataStreamResponse: jest.fn(() => new Response()),
      };
      return mockResult;
    }),
    convertToCoreMessages: jest.fn(
      (
        messages: Array<{
          role: string;
          content: string;
          toolInvocations?: Array<{
            toolCallId: string;
            toolName: string;
            result: string;
          }>;
        }>
      ) => {
        // Simulate conversion - if message has toolInvocations, create tool messages
        // Tool messages should NOT have toolCallId/toolName at top level (so code can extract from content)
        const coreMessages: Array<{
          role: string;
          content:
            | string
            | Array<{
                type: string;
                toolCallId: string;
                toolName: string;
                result: string;
              }>;
        }> = [];
        messages.forEach((msg) => {
          // Add the original message (user/assistant)
          const { toolInvocations, ...messageWithoutToolInvocations } = msg;
          coreMessages.push(messageWithoutToolInvocations as any);

          // Create tool messages from toolInvocations
          if (msg.toolInvocations) {
            msg.toolInvocations.forEach((tool) => {
              coreMessages.push({
                role: 'tool',
                // Don't include toolCallId/toolName at top level - code extracts from content
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: tool.toolCallId,
                    toolName: tool.toolName,
                    result: tool.result,
                  },
                ],
              } as any);
            });
          }
        });
        return coreMessages;
      }
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createDataStreamResponse: jest.fn((options: any) => {
      const annotations: any[] = [];
      let controllerRef: ReadableStreamDefaultController<any> | null = null;
      const mockStream = new ReadableStream({
        start(controller) {
          controllerRef = controller;
          // Execute the handler asynchronously
          Promise.resolve().then(async () => {
            try {
              await options.execute({
                writeData: (data: any) => {
                  // Write data to stream if controller is still open
                  if (controllerRef && controllerRef.desiredSize !== null) {
                    const encoder = new TextEncoder();
                    controllerRef.enqueue(
                      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                  }
                },
                writeMessageAnnotation: (annotation: any) => {
                  // Store annotation and write to stream if controller is still open
                  if (controllerRef && controllerRef.desiredSize !== null) {
                    annotations.push(annotation);
                    const encoder = new TextEncoder();
                    controllerRef.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'metadata',
                          data: annotation,
                        })}\n\n`
                      )
                    );
                  }
                },
              });
              // Wait a bit for any async onFinish callbacks to complete
              await new Promise((resolve) => setTimeout(resolve, 50));
              if (controllerRef) {
                controllerRef.close();
              }
            } catch (err) {
              if (controllerRef) {
                controllerRef.error(err);
              }
            }
          });
        },
      });
      return new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }),
  };
});
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock the OpenAI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: Object.assign(
    jest.fn(() => ({
      generateText: jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        experimental_providerMetadata: {
          openai: {
            annotations: [
              {
                type: 'url_citation',
                url_citation: {
                  url: 'https://example.com',
                  title: 'Example Website',
                  start_index: 10,
                  end_index: 20,
                },
              },
            ],
          },
        },
      })),
    })),
    {
      tools: {
        webSearchPreview: jest.fn((options: any) => ({
          type: 'web_search_preview',
          searchContextSize: options?.searchContextSize || 'low',
        })),
      },
      responses: jest.fn((model: string) => ({
        generateText: jest.fn(),
        streamText: jest.fn(),
      })),
    }
  ),
}));

describe('Chat API Route', () => {
  const webSearchEnvKey = 'CHAT_WEB_SEARCH';

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env[webSearchEnvKey];
  });

  afterEach(() => {
    delete process.env[webSearchEnvKey];
  });

  it('uses search path by default (CHAT_WEB_SEARCH unset)', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeDefined();
    expect(streamOptions.maxSteps).toBe(3);
  });

  it('uses non-search path when the user pastes a YouTube URL', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize this: https://www.youtube.com/watch?v=1vzes3R8xhA',
          },
        ],
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('uses non-search path when enableChatWebSearch is false', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        enableChatWebSearch: false,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('uses non-search path when CHAT_WEB_SEARCH=false even if client enables search', async () => {
    process.env[webSearchEnvKey] = 'false';

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        enableChatWebSearch: true,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('uses non-search path when CHAT_WEB_SEARCH=false', async () => {
    process.env[webSearchEnvKey] = 'false';

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('should include citation metadata in response', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: "What's the latest news about AI?" },
        ],
        model: 'gpt-4o-search-preview',
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations (onFinish callback)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Read the stream and check for metadata
    const reader = (response as Response).body?.getReader();
    if (!reader) throw new Error('No response body');

    let foundMetadata = false;
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (done) break;
      const { value } = result;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(5));
            if (data.type === 'metadata' && data.data?.citations) {
              foundMetadata = true;
              break;
            }
          } catch (e) {
            // Ignore parse errors for non-JSON data
          }
        }
      }
      if (foundMetadata) break;
    }

    expect(foundMetadata).toBe(true);
  });

  it('should extract YouTube transcript from tool message and add to context', async () => {
    process.env[webSearchEnvKey] = 'false';

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize this video: https://www.youtube.com/watch?v=test123',
          },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_test123',
                toolName: 'getYoutubeVideoId',
                state: 'result',
                args: { videoId: 'test123' },
                result:
                  'YouTube Video Transcript Retrieved\n\nTitle: Test Video\n\nFULL TRANSCRIPT:\nThis is a test transcript with content.',
              },
            ],
          },
        ],
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    // Mock console.log to capture the transcript extraction
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Hoisting YouTube transcript from tool')
    );
    expect(extractionLog).toBeDefined();

    // Check that transcript was added to context
    const contextLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('YouTube transcript(s) to context string')
    );
    expect(contextLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });

  it('should extract toolCallId and toolName from tool message array content', async () => {
    process.env[webSearchEnvKey] = 'false';

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test message' },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_test456',
                toolName: 'getSearchQuery',
                state: 'result',
                args: { query: 'notes' },
                result: '[]',
              },
            ],
          },
        ],
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    // Mock console.log to capture the extraction
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that toolCallId/toolName extraction was logged
    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Extracting toolCallId/toolName from content array')
    );
    expect(extractionLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });

  it('should not duplicate hoisted YouTube block when transcript is already in client context', async () => {
    process.env[webSearchEnvKey] = 'false';

    const unifiedContext = {
      files: {},
      youtubeVideos: {
        'youtube-test123': {
          id: 'youtube-test123',
          videoId: 'test123',
          title: 'Test Video',
          transcript: 'This is a test transcript with content.',
          reference: 'YouTube Video: Test Video',
        },
      },
    };

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize this video: https://www.youtube.com/watch?v=test123',
          },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_test123',
                toolName: 'getYoutubeVideoId',
                state: 'result',
                args: { videoId: 'test123' },
                result:
                  'YouTube Video Transcript Retrieved\n\nTitle: Test Video\n\nVideo ID: test123\n\nFULL TRANSCRIPT:\nThis is a test transcript with content.',
              },
            ],
          },
        ],
        newUnifiedContext: JSON.stringify(unifiedContext),
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const skipLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Skipping redundant YouTube hoist')
    );
    expect(skipLog).toBeDefined();

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.system).not.toContain('YouTube Video Transcript 1:');
    expect(streamOptions.system).toContain('Full Transcript:');
    const toolMessage = streamOptions.messages.find(
      (m: { role: string }) => m.role === 'tool'
    );
    expect(toolMessage).toBeDefined();
    const firstPart = toolMessage.content[0];
    expect(firstPart.result).not.toContain('FULL TRANSCRIPT');
    expect(firstPart.result).toContain('test123');

    consoleLogSpy.mockRestore();
  });

  it('parses unified context when the plugin prepends attached file paths', async () => {
    process.env[webSearchEnvKey] = 'false';

    const unifiedContext = {
      files: {},
      youtubeVideos: {
        'youtube-1vzes3R8xhA': {
          id: 'youtube-1vzes3R8xhA',
          videoId: '1vzes3R8xhA',
          title: "Inside Arsenal's summer transfer window",
          transcript: 'Arteta laid out his manifesto',
          reference: "YouTube Video: Inside Arsenal's summer transfer window",
        },
      },
    };
    const newUnifiedContext = `Attached file paths — use these exact strings for mergeFiles sourceFiles, getFileMetadata filePaths, deleteFiles filePaths, or extractHighlights filePath/filePaths (do not modify):
Untitled.md

${JSON.stringify(unifiedContext)}`;

    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize https://www.youtube.com/watch?v=1vzes3R8xhA',
          },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_okzw',
                toolName: 'getYoutubeVideoId',
                state: 'result',
                args: { videoId: '1vzes3R8xhA' },
                result:
                  "YouTube Video Transcript Retrieved\n\nTitle: Inside Arsenal's summer transfer window\n\nVideo ID: 1vzes3R8xhA\n\nFULL TRANSCRIPT:\nArteta laid out his manifesto",
              },
            ],
          },
        ],
        newUnifiedContext,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const parseError = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes('Failed to parse context JSON')
    );
    expect(parseError).toBeUndefined();

    const parsedLog = consoleLogSpy.mock.calls.find((call) =>
      String(call[0]).includes('Parsed context items:')
    );
    expect(parsedLog).toBeDefined();

    const skipLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Skipping redundant YouTube hoist')
    );
    expect(skipLog).toBeDefined();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
