import { jsonApiError } from './api-error-response';

describe('jsonApiError', () => {
  it('returns structured JSON with code, message, and resolution', async () => {
    const response = jsonApiError(
      'not_found',
      'Missing route',
      'Check OpenAPI at notecompanion.ai/openapi.json',
      404
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'not_found',
        message: 'Missing route',
        resolution: 'Check OpenAPI at notecompanion.ai/openapi.json',
      },
    });
  });
});
