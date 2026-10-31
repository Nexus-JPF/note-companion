const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'gpt-transcribe';
const SELF_HOSTED_TRANSCRIPTION_MODEL = 'whisper-1';

function isOfficialOpenAiApiBase(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname.toLowerCase() === 'api.openai.com';
  } catch {
    return false;
  }
}

function hasCustomTranscriptionEndpoint(): boolean {
  const whisperBase = process.env.OPENAI_WHISPER_BASE_URL?.trim();
  if (whisperBase && !isOfficialOpenAiApiBase(whisperBase)) {
    return true;
  }
  const openAiBase = process.env.OPENAI_API_BASE?.trim();
  if (openAiBase && !isOfficialOpenAiApiBase(openAiBase)) {
    return true;
  }
  return false;
}

/**
 * Transcription model for OpenAI audio.transcriptions.create.
 * Defaults to gpt-transcribe on the official API; keeps whisper-1 when a custom base URL is set.
 */
export function getTranscriptionModel(): string {
  const explicit = process.env.TRANSCRIPTION_MODEL?.trim();
  if (explicit) {
    return explicit;
  }
  if (hasCustomTranscriptionEndpoint()) {
    return SELF_HOSTED_TRANSCRIPTION_MODEL;
  }
  return DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
}

export {
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  SELF_HOSTED_TRANSCRIPTION_MODEL,
};
