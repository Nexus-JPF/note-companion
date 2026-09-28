import { openai, createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { mistral } from '@ai-sdk/mistral';
import { deepseek } from '@ai-sdk/deepseek';
import { LanguageModel } from 'ai';

// Get model configuration from environment variables
// Defaults to OpenAI for backward compatibility with cloud environment
const MODEL_PROVIDER = (process.env.MODEL_PROVIDER || 'openai').toLowerCase();
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4.1-mini';
const VISION_MODEL_NAME =
  process.env.VISION_MODEL || process.env.VISION_MODEL_NAME || 'gpt-4o';
const RESPONSES_MODEL_NAME = process.env.RESPONSES_MODEL_NAME || MODEL_NAME;

/**
 * Get the model instance based on environment configuration
 */
function createModel(provider: string, modelName: string): LanguageModel {
  switch (provider) {
    case 'google':
      return google(modelName);

    case 'anthropic':
      return anthropic(modelName) as LanguageModel;

    case 'groq':
      return groq(modelName);

    case 'mistral':
      return mistral(modelName);

    case 'deepseek':
      return deepseek(modelName);

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
const DEFAULT_VISION_MODEL = createModel(MODEL_PROVIDER, VISION_MODEL_NAME);

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

/** Vision / OCR model (defaults to gpt-4o; override with VISION_MODEL). */
export const getVisionModel = (): LanguageModel => {
  return DEFAULT_VISION_MODEL;
};

/**
 * Get the default model with Responses API (supports web search)
 * Note: Responses API is only available for OpenAI models
 */
export const getResponsesModel = (): LanguageModel => {
  return DEFAULT_RESPONSES_MODEL;
};
