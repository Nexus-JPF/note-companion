export const CHAT_PROMPT_HINTS_FULL = {
  includeYoutube: true,
  includeWebFetch: true,
  includeTags: true,
  includeExtractSelection: true,
  includeFormatTemplate: true,
  includeRename: true,
  includeMerge: true,
};

export const computeChatPromptHints = jest.fn(() => ({ ...CHAT_PROMPT_HINTS_FULL }));

export const buildChatSystemPrompt = jest.fn(
  (contextString: string, currentDatetime: string, _hints?: unknown) => {
    return `You are a helpful assistant. Context: ${contextString}. Current time: ${currentDatetime}`;
  }
);

export const getChatSystemPrompt = jest.fn(
  (contextString: string, currentDatetime: string) => {
    return `You are a helpful assistant. Context: ${contextString}. Current time: ${currentDatetime}`;
  }
);

export const lastUserMessageHasYoutubeUrl = jest.fn((messages: unknown[]) => {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i] as { role?: string; content?: unknown; parts?: unknown };
    if (m?.role !== 'user') continue;
    let text = typeof m.content === 'string' ? m.content : '';
    if (!text && Array.isArray(m.parts)) {
      text = m.parts
        .map((p: { type?: string; text?: string }) =>
          p?.type === 'text' && typeof p.text === 'string' ? p.text : ''
        )
        .join('');
    }
    return /(?:youtube\.com|youtu\.be)\//i.test(text);
  }
  return false;
});
