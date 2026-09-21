import {
  buildChatSystemPrompt,
  CHAT_PROMPT_HINTS_FULL,
  lastUserMessageHasYoutubeUrl,
} from './chat-prompt';

describe('lastUserMessageHasYoutubeUrl', () => {
  it('detects youtube.com and youtu.be URLs in the last user message', () => {
    expect(
      lastUserMessageHasYoutubeUrl([
        {
          role: 'user',
          content: 'Summarize https://www.youtube.com/watch?v=1vzes3R8xhA',
        },
      ])
    ).toBe(true);
    expect(
      lastUserMessageHasYoutubeUrl([
        { role: 'user', content: 'https://youtu.be/1vzes3R8xhA' },
      ])
    ).toBe(true);
  });

  it('detects a YouTube URL in UIMessage text parts', () => {
    expect(
      lastUserMessageHasYoutubeUrl([
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Summarize https://www.youtube.com/watch?v=1vzes3R8xhA',
            },
          ],
        },
      ])
    ).toBe(true);
  });

  it('ignores messages that only mention YouTube without a URL', () => {
    expect(
      lastUserMessageHasYoutubeUrl([
        { role: 'user', content: 'How does YouTube transcription work?' },
      ])
    ).toBe(false);
  });
});

describe('buildChatSystemPrompt temporal guidance', () => {
  it('includes temporal guidance when includeTemporalGuidance is true', () => {
    const prompt = buildChatSystemPrompt('{}', '2025-06-20T12:00:00+00:00', {
      ...CHAT_PROMPT_HINTS_FULL,
      includeTemporalGuidance: true,
    });
    expect(prompt).toContain('### Time, facts, and web search');
    expect(prompt).toContain(
      'use web search before saying information is missing or unknown'
    );
  });

  it('tells the model to call getYoutubeVideoId for YouTube URLs', () => {
    const prompt = buildChatSystemPrompt(
      '{}',
      '2025-06-20T12:00:00+00:00',
      CHAT_PROMPT_HINTS_FULL
    );
    expect(prompt).toContain('you MUST call `getYoutubeVideoId`');
    expect(prompt).toContain('Do not use web search or `fetchUrlContent`');
  });

  it('omits temporal guidance by default', () => {
    const prompt = buildChatSystemPrompt(
      '{}',
      '2025-06-20T12:00:00+00:00',
      CHAT_PROMPT_HINTS_FULL
    );
    expect(prompt).not.toContain('### Time, facts, and web search');
  });
});
