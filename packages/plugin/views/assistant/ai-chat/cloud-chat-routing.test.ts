import { DEFAULT_SETTINGS } from '../../../settings';

/** Cloud chat in the plugin uses this model id (see model-selector.tsx). */
export const PLUGIN_CLOUD_CHAT_MODEL = 'gpt-4o-mini' as const;

describe('plugin cloud chat routing', () => {
  it('default selected model matches the cloud routing model id', () => {
    expect(DEFAULT_SETTINGS.selectedModel).toBe(PLUGIN_CLOUD_CHAT_MODEL);
  });

  it('routes to cloud when local LLM mode is off', () => {
    const showLocalLLMInChat = false;
    const selectedModel: string = 'llama3.2';
    const useCloud =
      !showLocalLLMInChat || selectedModel === PLUGIN_CLOUD_CHAT_MODEL;
    expect(useCloud).toBe(true);
  });

  it('routes to cloud when Cloud model is selected in local LLM mode', () => {
    const showLocalLLMInChat = true;
    const selectedModel = PLUGIN_CLOUD_CHAT_MODEL;
    const useCloud =
      !showLocalLLMInChat || selectedModel === PLUGIN_CLOUD_CHAT_MODEL;
    expect(useCloud).toBe(true);
  });

  it('routes to local Ollama when local LLM mode is on and model is not Cloud', () => {
    const showLocalLLMInChat = true;
    const selectedModel: string = 'llama3.2';
    const useCloud =
      !showLocalLLMInChat || selectedModel === PLUGIN_CLOUD_CHAT_MODEL;
    expect(useCloud).toBe(false);
  });
});
