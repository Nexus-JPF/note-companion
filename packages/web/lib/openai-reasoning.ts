export type OpenAiOrganizerReasoningEffort = 'low' | 'medium' | 'high';

export type OpenAiOrganizerChatSettings = {
  reasoningEffort: OpenAiOrganizerReasoningEffort;
  /** gpt-5* defaults to strict JSON schema; our Zod schemas use optional/default fields. */
  structuredOutputs: false;
};

/** OpenAI reasoning models in @ai-sdk/openai@1.x (gpt-5* and o*). */
export function isOpenAiReasoningModel(modelId: string): boolean {
  return modelId.startsWith('o') || modelId.startsWith('gpt-5');
}

export function getOrganizerReasoningEffort(): OpenAiOrganizerReasoningEffort {
  const raw = (process.env.ORGANIZER_REASONING_EFFORT || 'low').toLowerCase();
  if (raw === 'medium' || raw === 'high') {
    return raw;
  }
  return 'low';
}

export function getOpenAiOrganizerChatSettings(
  modelId: string
): OpenAiOrganizerChatSettings | undefined {
  if (!isOpenAiReasoningModel(modelId)) {
    return undefined;
  }
  return {
    reasoningEffort: getOrganizerReasoningEffort(),
    structuredOutputs: false,
  };
}
