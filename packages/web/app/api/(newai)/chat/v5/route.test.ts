import { NextRequest } from 'next/server';
import { streamText, stepCountIs, convertToModelMessages } from 'ai-v5';
import { POST } from './route';
import { buildV5ChatTools, chatTools } from '../tools';

jest.mock('ai-v5', () => {
  return {
    streamText: jest.fn().mockImplementation((options: any) => {
      const mockResult = {
        toUIMessageStream: jest.fn(() => new ReadableStream()),
        toUIMessageStreamResponse: jest.fn(() => new Response()),
      };
      if (options?.onFinish) {
        const sources = options?.tools?.web_search_preview
          ? [{ url: 'https://example.com', title: 'Example Website' }]
          : [];
        void Promise.resolve(
          options.onFinish({
            usage: { totalTokens: 100 },
            totalUsage: { totalTokens: 100 },
            sources,
          })
        );
      }
      return mockResult;
    }),
    convertToModelMessages: jest.fn((messages: any[]) => {
      const coreMessages: any[] = [];
      messages.forEach((msg) => {
        const { toolInvocations, parts, ...rest } = msg;
        coreMessages.push(rest);
        const invocations = toolInvocations ?? [];
        const toolParts = Array.isArray(parts)
          ? parts.filter(
              (p: any) =>
                typeof p?.type === 'string' && p.type.startsWith('tool-')
            )
          : [];
        invocations.forEach((tool: any) => {
          coreMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: tool.toolCallId,
                toolName: tool.toolName,
                result: tool.result,
                output: {
                  type: 'text',
                  value: tool.result ?? tool.output,
                },
              },
            ],
          });
        });
        toolParts.forEach((part: any) => {
          coreMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName || String(part.type).slice(5),
                result: part.output,
                output:
                  typeof part.output === 'string'
                    ? { type: 'text', value: part.output }
                    : part.output,
              },
            ],
          });
        });
      });
      return coreMessages;
    }),
    createUIMessageStream: jest.fn((options: any) => {
      let controllerRef: ReadableStreamDefaultController<any> | null = null;
      const mockStream = new ReadableStream({
        start(controller) {
          controllerRef = controller;
          Promise.resolve().then(async () => {
            try {
              await options.execute({
                writer: {
                  write: (part: any) => {
                    if (controllerRef && controllerRef.desiredSize !== null) {
                      const encoder = new TextEncoder();
                      controllerRef.enqueue(
                        encoder.encode(`data: ${JSON.stringify(part)}\n\n`)
                      );
                    }
                  },
                  merge: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                  },
                },
              });
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
      return mockStream;
    }),
    createUIMessageStreamResponse: jest.fn((options: any) => {
      return new Response(options.stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
      });
    }),
    stepCountIs: jest.fn((n: number) => ({ type: 'stepCountIs', count: n })),
    tool: jest.fn((def: any) => ({
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  };
});

jest.mock('@ai-sdk/openai-v5', () => ({
  openai: Object.assign(
    jest.fn(() => ({
      specificationVersion: 'v2',
      generateText: jest.fn(),
    })),
    {
      tools: {
        webSearchPreview: jest.fn((options: any) => ({
          type: 'web_search_preview',
          searchContextSize: options?.searchContextSize || 'low',
        })),
      },
      responses: jest.fn(() => ({ specificationVersion: 'v2' })),
    }
  ),
  createOpenAI: jest.fn(() =>
    jest.fn(() => ({ specificationVersion: 'v2' }))
  ),
}));

describe('Chat API v5 route', () => {
  const webSearchEnvKey = 'CHAT_WEB_SEARCH';

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env[webSearchEnvKey];
  });

  afterEach(() => {
    delete process.env[webSearchEnvKey];
  });

  it('responds with a UIMessage stream header', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    const response = await POST(mockRequest);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
  });

  it('uses search path by default and stopWhen instead of maxSteps', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(convertToModelMessages).toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeDefined();
    expect(streamOptions.maxSteps).toBeUndefined();
    expect(streamOptions.stopWhen).toEqual({ type: 'stepCountIs', count: 3 });
    expect(stepCountIs).toHaveBeenCalledWith(3);
  });

  it('uses non-search path when the user pastes a YouTube URL', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize this: https://www.youtube.com/watch?v=1vzes3R8xhA',
            parts: [
              {
                type: 'text',
                text: 'Summarize this: https://www.youtube.com/watch?v=1vzes3R8xhA',
              },
            ],
          },
        ],
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('uses non-search path when enableChatWebSearch is false', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
        enableChatWebSearch: false,
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(streamText).toHaveBeenCalled();
    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    expect(streamOptions.tools?.web_search_preview).toBeUndefined();
  });

  it('does not attach execute on client tools', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
        enableChatWebSearch: false,
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    await POST(mockRequest);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const streamOptions = (streamText as jest.Mock).mock.calls[0][0];
    for (const name of Object.keys(chatTools)) {
      expect(streamOptions.tools[name].execute).toBeUndefined();
      expect(streamOptions.tools[name].inputSchema).toBeDefined();
    }
  });

  it('hoists a YouTube transcript from a v5 tool output part', async () => {
    process.env[webSearchEnvKey] = 'false';

    const mockRequest = new NextRequest('http://localhost:3000/api/chat/v5', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Summarize this video: https://www.youtube.com/watch?v=test123',
            parts: [
              {
                type: 'text',
                text: 'Summarize this video: https://www.youtube.com/watch?v=test123',
              },
            ],
          },
          {
            role: 'assistant',
            parts: [
              {
                type: 'tool-getYoutubeVideoId',
                toolCallId: 'call_test123',
                toolName: 'getYoutubeVideoId',
                state: 'output-available',
                input: { videoId: 'test123' },
                output:
                  'YouTube Video Transcript Retrieved\n\nTitle: Test Video\n\nVideo ID: test123\n\nFULL TRANSCRIPT:\nThis is a test transcript with content.',
              },
            ],
          },
        ],
      }),
      headers: { 'x-user-id': 'test-user' },
    });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Hoisting YouTube transcript from tool')
    );
    expect(extractionLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});

describe('buildV5ChatTools', () => {
  it('maps parameters to inputSchema and never sets execute', () => {
    const mapped = buildV5ChatTools((def) => ({ ...def }));
    expect(Object.keys(mapped).sort()).toEqual(Object.keys(chatTools).sort());
    expect((mapped.getSearchQuery as any).execute).toBeUndefined();
    expect((mapped.getSearchQuery as any).inputSchema).toBe(
      chatTools.getSearchQuery.parameters
    );
  });
});
