import { NextRequest } from 'next/server';
import { POST } from './route';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { extractTextFromVisionImage } from '@/lib/ocr-extract';

jest.mock('@/lib/incrementAndLogTokenUsage', () => ({
  incrementAndLogTokenUsage: jest.fn(),
}));

jest.mock('@/lib/ocr-extract', () => ({
  extractTextFromVisionImage: jest.fn(),
}));

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
  AuthorizationError: class AuthorizationError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const VALID_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('POST /api/(newai)/vision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (extractTextFromVisionImage as jest.Mock).mockResolvedValue({
      text: 'Extracted text from image',
      tokensUsed: 200,
    });
    (incrementAndLogTokenUsage as jest.Mock).mockResolvedValue({
      remaining: 1000,
      usageError: false,
    });
  });

  describe('Happy Path', () => {
    it('should extract text from image and return text', async () => {
      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text from image',
        tokensUsed: 200,
      });

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Extracted text from image');
      expect(extractTextFromVisionImage).toHaveBeenCalled();
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        200
      );
    });

    it('should pass custom instructions to OCR helper', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
          instructions: 'Focus on handwritten text only',
        }),
      });

      await POST(request);

      expect(extractTextFromVisionImage).toHaveBeenCalledWith(
        expect.objectContaining({
          customInstructions: 'Focus on handwritten text only',
          retryOnEmpty: true,
        })
      );
    });

    it('should pass a normalized data URL image to OCR helper', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      await POST(request);

      expect(extractTextFromVisionImage).toHaveBeenCalledWith(
        expect.objectContaining({
          image: {
            kind: 'dataUrl',
            dataUrl: `data:image/png;base64,${VALID_IMAGE}`,
          },
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2, AuthorizationError } =
        require('@/lib/handleAuthorization');
      handleAuthorizationV2.mockRejectedValueOnce(
        new AuthorizationError('Unauthorized', 401)
      );

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(extractTextFromVisionImage).not.toHaveBeenCalled();
    });

    it('should reject missing image data with 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid image data');
      expect(extractTextFromVisionImage).not.toHaveBeenCalled();
    });

    it('should reject empty image data with 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({ image: '   ' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid image data');
      expect(extractTextFromVisionImage).not.toHaveBeenCalled();
    });

    it('should reject invalid base64 image data with 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({ image: 'not!!!base64' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Image data is not valid base64');
      expect(extractTextFromVisionImage).not.toHaveBeenCalled();
    });

    it('should authenticate before validating the image payload', async () => {
      const { handleAuthorizationV2, AuthorizationError } =
        require('@/lib/handleAuthorization');
      handleAuthorizationV2.mockRejectedValueOnce(
        new AuthorizationError('Unauthorized', 401)
      );

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({ image: 'not!!!base64' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(extractTextFromVisionImage).not.toHaveBeenCalled();
    });

    it('should handle AI service errors with 500', async () => {
      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: '',
        tokensUsed: 0,
        error: 'AI service unavailable',
      });

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should still return text when token increment fails', async () => {
      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text',
        tokensUsed: 150,
      });
      (incrementAndLogTokenUsage as jest.Mock).mockRejectedValueOnce(
        new Error('Token increment failed')
      );

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Extracted text');
    });
  });

  describe('Edge Cases', () => {
    it('should forward empty instructions to OCR helper', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
          instructions: '',
        }),
      });

      await POST(request);

      expect(extractTextFromVisionImage).toHaveBeenCalledWith(
        expect.objectContaining({ customInstructions: '' })
      );
    });

    it('should handle missing request body with 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid image data');
    });

    it('should handle invalid JSON in request body with an error response', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle zero tokens', async () => {
      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text',
        tokensUsed: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        0
      );
    });

    it('should bill tokens returned by OCR helper', async () => {
      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text',
        tokensUsed: Math.ceil('Extracted text'.length / 4),
      });

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: VALID_IMAGE,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Extracted text');
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        Math.ceil('Extracted text'.length / 4)
      );
    });
  });
});
