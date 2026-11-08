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
    expect(getOrganizerReasoningEffort('gpt-5')).toBe('low');
    expect(getOrganizerReasoningEffort('o3-mini')).toBe('low');
  });

  it('defaults to none for gpt-5.1+ models, which reject tools with reasoning', () => {
    delete process.env.ORGANIZER_REASONING_EFFORT;
    expect(getOrganizerReasoningEffort('gpt-5.4-nano')).toBe('none');
    expect(getOrganizerReasoningEffort('gpt-5.6-luna')).toBe('none');
  });

  it('lets ORGANIZER_REASONING_EFFORT override the default, including none', () => {
    process.env.ORGANIZER_REASONING_EFFORT = 'medium';
    expect(getOrganizerReasoningEffort('gpt-5.6-luna')).toBe('medium');
    process.env.ORGANIZER_REASONING_EFFORT = 'none';
    expect(getOrganizerReasoningEffort('o3-mini')).toBe('none');
  });

  it('returns chat settings only for reasoning models', () => {
    delete process.env.ORGANIZER_REASONING_EFFORT;
    expect(getOpenAiOrganizerChatSettings('gpt-5')).toEqual({
      reasoningEffort: 'low',
      structuredOutputs: false,
    });
    expect(getOpenAiOrganizerChatSettings('gpt-4.1-mini')).toBeUndefined();
  });

  it('disables strict structured outputs for gpt-5 organizer models', () => {
    expect(getOpenAiOrganizerChatSettings('gpt-5.6-luna')).toMatchObject({
      structuredOutputs: false,
    });
  });
});
