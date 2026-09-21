import {
  applyYoutubeToolDedupToModelMessages,
  buildYoutubeToolStubFromResult,
} from './youtube-tool-dedup';

const FULL =
  'YouTube Video Transcript Retrieved\n\nTitle: Test Video\n\nVideo ID: test123\n\nFULL TRANSCRIPT:\nThis is a test transcript with content.';

describe('applyYoutubeToolDedupToModelMessages', () => {
  it('stubs a v4 tool-result.result string', () => {
    const { finalCoreMessages } = applyYoutubeToolDedupToModelMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'getYoutubeVideoId',
              result: FULL,
            },
          ],
        },
      ],
      new Set(['test123'])
    );

    expect(finalCoreMessages[0].content[0].result).toBe(
      buildYoutubeToolStubFromResult(FULL)
    );
    expect(finalCoreMessages[0].content[0].result).not.toContain(
      'FULL TRANSCRIPT'
    );
  });

  it('stubs a v5 tool-result.output.value string', () => {
    const { finalCoreMessages, state } = applyYoutubeToolDedupToModelMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'getYoutubeVideoId',
              output: { type: 'text', value: FULL },
            },
          ],
        },
      ],
      new Set()
    );

    expect(state.hoistedLabelCount).toBe(1);
    expect(finalCoreMessages[0].content[0].output.value).toBe(
      buildYoutubeToolStubFromResult(FULL)
    );
    expect(finalCoreMessages[0].content[0].output.value).not.toContain(
      'FULL TRANSCRIPT'
    );
  });
});
