export type OpenAiOrganizerReasoningEffort = 'low' | 'medium' | 'high';

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

export function getOpenAiOrganizerChatSettings(modelId: string):
  | { reasoningEffort: OpenAiOrganizerReasoningEffort }
  | undefined {
  if (!isOpenAiReasoningModel(modelId)) {
    return undefined;
  }
  return { reasoningEffort: getOrganizerReasoningEffort() };
}
