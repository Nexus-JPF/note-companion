import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the AI SDK
/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('ai', () => {
  return {
    streamText: jest.fn().mockImplementation(async () => ({
      mergeIntoDataStream: jest.fn(),
      toDataStreamResponse: jest.fn(() => new Response()),
    })),
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
          coreMessages.push(msg);
          if (msg.toolInvocations) {
            msg.toolInvocations.forEach((tool) => {
              coreMessages.push({
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: tool.toolCallId,
                    toolName: tool.toolName,
                    result: tool.result,
                  },
                ],
              });
            });
          }
        });
        return coreMessages;
      }
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createDataStreamResponse: jest.fn((options: any) => {
      const mockStream = new ReadableStream({
        start(controller) {
          // Execute the handler asynchronously
          Promise.resolve().then(() => {
            options
              .execute({
                writeData: () => {
                  // Mock implementation
                },
                writeMessageAnnotation: () => {
                  // Mock implementation
                },
              })
              .then(() => {
                controller.close();
              })
              .catch((err) => {
                controller.error(err);
              });
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
  openai: jest.fn(() => ({
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
}));

describe('Chat API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include citation metadata in response', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: "What's the latest news about AI?" },
        ],
        model: 'gpt-4o-search-preview',
        enableSearchGrounding: true,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

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
          const data = JSON.parse(line.slice(5));
          if (data.type === 'metadata' && data.data?.citations) {
            foundMetadata = true;
            break;
          }
        }
      }
    }

    expect(foundMetadata).toBe(true);
  });

  it('should extract YouTube transcript from tool message and add to context', async () => {
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

    // Check that transcript extraction was logged
    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Extracting YouTube transcript from tool result')
    );
    expect(extractionLog).toBeDefined();

    // Check that transcript was added to context
    const contextLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Added YouTube transcript(s) to context string')
    );
    expect(contextLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });

  it('should extract toolCallId and toolName from tool message array content', async () => {
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
                toolName: 'getYoutubeVideoId',
                state: 'result',
                args: { videoId: 'test456' },
                result:
                  'YouTube Video Transcript Retrieved\n\nFULL TRANSCRIPT:\nTest content',
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

    // Check that toolCallId/toolName extraction was logged
    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Extracting toolCallId/toolName from content array')
    );
    expect(extractionLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});
