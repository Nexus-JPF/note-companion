export type OpenAiOrganizerReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high';

export type OpenAiOrganizerChatSettings = {
  reasoningEffort: OpenAiOrganizerReasoningEffort;
  /** gpt-5* defaults to strict JSON schema; our Zod schemas use optional/default fields. */
  structuredOutputs: false;
};

/** OpenAI reasoning models in @ai-sdk/openai@1.x (gpt-5* and o*). */
export function isOpenAiReasoningModel(modelId: string): boolean {
  return modelId.startsWith('o') || modelId.startsWith('gpt-5');
}

/**
 * gpt-5.1+ (e.g. gpt-5.4-nano, gpt-5.6-luna) reject function tools combined with
 * reasoning_effort on /v1/chat/completions, and our structuredOutputs:false
 * generateObject calls use a function tool. They accept 'none' instead.
 */
function acceptsNoneEffort(modelId: string): boolean {
  return /^gpt-5\.\d/.test(modelId);
}

export function getOrganizerReasoningEffort(
  modelId?: string
): OpenAiOrganizerReasoningEffort {
  const raw = process.env.ORGANIZER_REASONING_EFFORT?.toLowerCase();
  if (raw === 'none' || raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return modelId && acceptsNoneEffort(modelId) ? 'none' : 'low';
}

export function getOpenAiOrganizerChatSettings(
  modelId: string
): OpenAiOrganizerChatSettings | undefined {
  if (!isOpenAiReasoningModel(modelId)) {
    return undefined;
  }
  return {
    reasoningEffort: getOrganizerReasoningEffort(modelId),
    structuredOutputs: false,
  };
}
