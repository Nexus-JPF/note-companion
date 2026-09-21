import { streamText } from 'ai-v5';
import { getModel } from './models';
import { getModelV5, getResponsesModelV5 } from './models-v5';

/**
 * Unmocked smoke: `ai-v5` streamText must see LanguageModelV2.
 * Catalog getModel() stays V1 for `/api/chat`. Relative imports bypass the
 * `@/lib/models` Jest mock.
 */
describe('chat v5 model specification', () => {
  it('getModelV5 and getResponsesModelV5 are LanguageModelV2', () => {
    expect(getModelV5().specificationVersion).toBe('v2');
    expect(getResponsesModelV5().specificationVersion).toBe('v2');
  });

  it('catalog getModel stays LanguageModelV1 for /api/chat', () => {
    expect(getModel().specificationVersion).toBe('v1');
  });

  it('ai-v5 streamText rejects catalog V1 models', () => {
    expect(() =>
      streamText({
        model: getModel() as never,
        prompt: 'hi',
      })
    ).toThrow(/Unsupported model version/);
  });

  it('ai-v5 streamText accepts V2 models past the version check', async () => {
    const controller = new AbortController();
    const result = streamText({
      model: getModelV5(),
      prompt: 'hi',
      abortSignal: controller.signal,
    });
    controller.abort();
    try {
      await result.text;
      throw new Error('expected streamText to reject after abort');
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : String(error);
      expect(name).not.toBe('AI_UnsupportedModelVersionError');
      expect(message).not.toContain('Unsupported model version');
    }
  });
});
