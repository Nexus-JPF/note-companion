import {
  getOpenAiOrganizerChatSettings,
  getOrganizerReasoningEffort,
  isOpenAiReasoningModel,
} from './openai-reasoning';

describe('openai-reasoning', () => {
  const savedEffort = process.env.ORGANIZER_REASONING_EFFORT;

  afterEach(() => {
    if (savedEffort === undefined) {
      delete process.env.ORGANIZER_REASONING_EFFORT;
    } else {
      process.env.ORGANIZER_REASONING_EFFORT = savedEffort;
    }
  });

  it('detects gpt-5 and o-series reasoning models', () => {
    expect(isOpenAiReasoningModel('gpt-5.6-luna')).toBe(true);
    expect(isOpenAiReasoningModel('o3-mini')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-4.1-mini')).toBe(false);
  });

  it('defaults organizer reasoning effort to low', () => {
    delete process.env.ORGANIZER_REASONING_EFFORT;
    expect(getOrganizerReasoningEffort()).toBe('low');
  });

  it('returns chat settings only for reasoning models', () => {
    expect(getOpenAiOrganizerChatSettings('gpt-5.6-luna')).toEqual({
      reasoningEffort: 'low',
    });
    expect(getOpenAiOrganizerChatSettings('gpt-4.1-mini')).toBeUndefined();
  });
});
