import { NextRequest } from 'next/server';

const mockStreamText = jest.fn();
jest.mock('ai', () => ({ streamText: (args: unknown) => mockStreamText(args) }));
jest.mock('@ai-sdk/openai', () => ({ openai: jest.fn() }));
jest.mock('@/lib/incrementAndLogTokenUsage', () => ({ incrementAndLogTokenUsage: jest.fn() }));
jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: jest.fn(async () => ({ userId: 'user-1' })),
}));

const defaultModel = { id: 'default-model' };
const studyModel = { id: 'study-model' };
jest.mock('@/lib/models', () => ({
  getModel: () => defaultModel,
  getStudyModel: () => studyModel,
}));

import { POST } from './route';

const request = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/format-stream', {
    method: 'POST',
    body: JSON.stringify({ content: 'Some lecture text', formattingInstruction: 'Make notes', ...body }),
  });

describe('POST /api/format-stream model choice', () => {
  beforeEach(() => {
    mockStreamText.mockReset();
    mockStreamText.mockReturnValue({ toTextStreamResponse: () => new Response('ok') });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the study (reasoning) model for purpose "study-note"', async () => {
    await POST(request({ purpose: 'study-note' }));
    expect(mockStreamText.mock.calls[0][0].model).toBe(studyModel);
  });

  it('uses the default model when no purpose is sent (older plugins)', async () => {
    await POST(request({}));
    expect(mockStreamText.mock.calls[0][0].model).toBe(defaultModel);
  });

  it('uses the default model for any other purpose', async () => {
    await POST(request({ purpose: 'something-else' }));
    expect(mockStreamText.mock.calls[0][0].model).toBe(defaultModel);
  });
});
