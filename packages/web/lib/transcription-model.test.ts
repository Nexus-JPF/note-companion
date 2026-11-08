describe('getTranscriptionModel', () => {
  const envKeys = [
    'TRANSCRIPTION_MODEL',
    'OPENAI_API_BASE',
    'OPENAI_WHISPER_BASE_URL',
  ] as const;
  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    jest.resetModules();
  });

  async function load() {
    return import('./transcription-model');
  }

  it('defaults to gpt-transcribe on the official OpenAI API', async () => {
    delete process.env.TRANSCRIPTION_MODEL;
    delete process.env.OPENAI_API_BASE;
    delete process.env.OPENAI_WHISPER_BASE_URL;
    const { getTranscriptionModel } = await load();
    expect(getTranscriptionModel()).toBe('gpt-transcribe');
  });

  it('defaults to gpt-transcribe when OPENAI_API_BASE is the official OpenAI URL', async () => {
    delete process.env.TRANSCRIPTION_MODEL;
    process.env.OPENAI_API_BASE = 'https://api.openai.com/v1';
    delete process.env.OPENAI_WHISPER_BASE_URL;
    const { getTranscriptionModel } = await load();
    expect(getTranscriptionModel()).toBe('gpt-transcribe');
  });

  it('defaults to whisper-1 when OPENAI_API_BASE is set', async () => {
    delete process.env.TRANSCRIPTION_MODEL;
    process.env.OPENAI_API_BASE = 'http://localhost:11434/v1';
    delete process.env.OPENAI_WHISPER_BASE_URL;
    const { getTranscriptionModel } = await load();
    expect(getTranscriptionModel()).toBe('whisper-1');
  });

  it('defaults to whisper-1 when OPENAI_WHISPER_BASE_URL is set', async () => {
    delete process.env.TRANSCRIPTION_MODEL;
    delete process.env.OPENAI_API_BASE;
    process.env.OPENAI_WHISPER_BASE_URL = 'http://localhost:9000/v1';
    const { getTranscriptionModel } = await load();
    expect(getTranscriptionModel()).toBe('whisper-1');
  });

  it('uses TRANSCRIPTION_MODEL when set', async () => {
    process.env.TRANSCRIPTION_MODEL = 'whisper-1';
    process.env.OPENAI_API_BASE = 'http://localhost:11434/v1';
    const { getTranscriptionModel } = await load();
    expect(getTranscriptionModel()).toBe('whisper-1');
  });
});
