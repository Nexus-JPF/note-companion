import { openai, createOpenAI } from '@ai-sdk/openai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { groq, createGroq } from '@ai-sdk/groq';
import { mistral, createMistral } from '@ai-sdk/mistral';
import { deepseek, createDeepSeek } from '@ai-sdk/deepseek';
import { LanguageModel } from 'ai';

// Get model configuration from environment variables
// Defaults to OpenAI for backward compatibility with cloud environment
const MODEL_PROVIDER = (process.env.MODEL_PROVIDER || 'openai').toLowerCase();
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';
const RESPONSES_MODEL_NAME = process.env.RESPONSES_MODEL_NAME || MODEL_NAME;

/**
 * Get the model instance based on environment configuration
 */
function createModel(provider: string, modelName: string): LanguageModel {
  switch (provider) {
    case 'google':
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        const googleProvider = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
          baseURL: process.env.GOOGLE_API_BASE,
        });
        return googleProvider(modelName) as LanguageModel;
      }
      return google(modelName) as LanguageModel;

    case 'anthropic':
      if (process.env.ANTHROPIC_API_KEY) {
        const anthropicProvider = createAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_API_BASE,
        });
        return anthropicProvider(modelName) as LanguageModel;
      }
      return anthropic(modelName) as LanguageModel;

    case 'groq':
      if (process.env.GROQ_API_KEY) {
        const groqProvider = createGroq({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: process.env.GROQ_API_BASE,
        });
        return groqProvider(modelName) as LanguageModel;
      }
      return groq(modelName) as LanguageModel;

    case 'mistral':
      if (process.env.MISTRAL_API_KEY) {
        const mistralProvider = createMistral({
          apiKey: process.env.MISTRAL_API_KEY,
        });
        return mistralProvider(modelName) as LanguageModel;
      }
      return mistral(modelName) as LanguageModel;

    case 'deepseek':
      if (process.env.DEEPSEEK_API_KEY) {
        const deepseekProvider = createDeepSeek({
          apiKey: process.env.DEEPSEEK_API_KEY,
        });
        return deepseekProvider(modelName) as LanguageModel;
      }
      return deepseek(modelName) as LanguageModel;

    case 'openai':
    default:
      // Support custom baseURL for local LLMs (e.g., Ollama)
      if (process.env.OPENAI_API_BASE) {
        const customProvider = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY || '',
          baseURL: process.env.OPENAI_API_BASE,
        });
        return customProvider(modelName) as LanguageModel;
      }
      return openai(modelName) as LanguageModel;
  }
}

// Create model instances based on environment variables
const DEFAULT_MODEL = createModel(MODEL_PROVIDER, MODEL_NAME);

// Responses API is OpenAI-specific, so only use it for OpenAI
// For other providers, fall back to regular model
const DEFAULT_RESPONSES_MODEL =
  MODEL_PROVIDER === 'openai'
    ? ((openai.responses
        ? openai.responses(RESPONSES_MODEL_NAME)
        : openai(RESPONSES_MODEL_NAME)) as LanguageModel)
    : createModel(MODEL_PROVIDER, RESPONSES_MODEL_NAME);

/**
 * Get the default model for chat completion
 * Note: We ignore any model parameter from the client to ensure consistency
 */
export const getModel = (_name?: string): LanguageModel => {
  return DEFAULT_MODEL;
};

/**
 * Get the default model with Responses API (supports web search)
 * Note: Responses API is only available for OpenAI models
 */
export const getResponsesModel = (): LanguageModel => {
  return DEFAULT_RESPONSES_MODEL;
};
