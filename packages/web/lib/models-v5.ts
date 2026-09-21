import { openai, createOpenAI } from '@ai-sdk/openai-v5';

const MODEL_PROVIDER = (process.env.MODEL_PROVIDER || 'openai').toLowerCase();
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4.1-mini';
const RESPONSES_MODEL_NAME = process.env.RESPONSES_MODEL_NAME || MODEL_NAME;

/**
 * LanguageModelV2 instances for `ai@5` / `POST /api/chat/v5` only.
 * Catalog `@ai-sdk/openai@1` stays on `/api/chat` (v4). Do not import this from v4 routes.
 *
 * Cloud chat is OpenAI. Other MODEL_PROVIDER values still go through the OpenAI-compatible
 * v2 client (custom baseURL / OpenAI). Do not wire catalog v1 providers here.
 */
function createModelV5(modelName: string) {
  if (process.env.OPENAI_API_BASE) {
    const customProvider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_API_BASE,
    });
    return customProvider(modelName);
  }
  return openai(modelName);
}

const DEFAULT_MODEL = createModelV5(MODEL_NAME);

const DEFAULT_RESPONSES_MODEL =
  MODEL_PROVIDER === 'openai' && typeof openai.responses === 'function'
    ? openai.responses(RESPONSES_MODEL_NAME)
    : createModelV5(RESPONSES_MODEL_NAME);

export const getModelV5 = (_name?: string) => DEFAULT_MODEL;

export const getResponsesModelV5 = () => DEFAULT_RESPONSES_MODEL;

export { openai as openaiV5 };
