import { convertToModelMessages } from 'ai-v5';
import { coerceToUiMessages } from './coerce-ui-messages';

describe('coerceToUiMessages', () => {
  it('rewrites v4 tool-invocation parts when parts already exist', () => {
    const [message] = coerceToUiMessages([
      {
        role: 'assistant',
        parts: [
          { type: 'text', text: 'searching' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 't1',
              toolName: 'getSearchQuery',
              args: { query: 'inbox' },
              result: '[]',
              state: 'result',
            },
          },
        ],
      },
    ]);

    expect(message.parts).toEqual([
      { type: 'text', text: 'searching' },
      expect.objectContaining({
        type: 'tool-getSearchQuery',
        toolCallId: 't1',
        state: 'output-available',
        input: { query: 'inbox' },
        output: '[]',
      }),
    ]);
  });

  it('converts v4 content + toolInvocations when parts are missing', () => {
    const [message] = coerceToUiMessages([
      {
        role: 'assistant',
        content: 'Done',
        toolInvocations: [
          {
            toolCallId: 't1',
            toolName: 'getSearchQuery',
            args: { query: 'inbox' },
            result: '[]',
            state: 'result',
          },
        ],
      },
    ]);

    expect(message.parts[0]).toEqual({ type: 'text', text: 'Done' });
    expect(message.parts[1].type).toBe('tool-getSearchQuery');
  });
});

describe('convertToModelMessages (unmocked ai-v5)', () => {
  it('accepts rewritten tool-* parts from v4 tool-invocation history', () => {
    const ui = coerceToUiMessages([
      { role: 'user', parts: [{ type: 'text', text: 'find inbox notes' }] },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_1',
              toolName: 'getSearchQuery',
              args: { query: 'inbox' },
              result: '[]',
              state: 'result',
            },
          },
        ],
      },
    ]);

    expect(() =>
      convertToModelMessages(ui, { ignoreIncompleteToolCalls: true })
    ).not.toThrow();
  });
});
