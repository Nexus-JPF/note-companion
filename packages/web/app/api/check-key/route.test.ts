import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock @unkey/api - v2 uses Unkey class with keys.verifyKey method
const mockVerifyKey = jest.fn();
const mockVerify = jest.fn();

jest.mock('@unkey/api', () => ({
  Unkey: jest.fn().mockImplementation(() => ({
    keys: {
      verifyKey: mockVerifyKey,
      verify: mockVerify,
    },
  })),
}));

// Mock getToken
jest.mock('@/lib/handleAuthorization', () => ({
  getToken: jest.fn((req: NextRequest) => {
    const header = req.headers.get('authorization');
    return header?.replace('Bearer ', '') || null;
  }),
}));

describe('POST /api/check-key - Unkey API v2 Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
    process.env.UNKEY_ROOT_KEY = 'test-root-key';
    process.env.UNKEY_API_ID = 'test-api-id';
    // Suppress console.log for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
    delete process.env.UNKEY_ROOT_KEY;
    delete process.env.UNKEY_API_ID;
    jest.restoreAllMocks();
  });

  describe('v2 Response Format (identity.externalId)', () => {
    it('should return valid key with userId from identity.externalId', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            externalId: 'user_363zVO0eSCbNwbir44tl1IwE4iz',
          },
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Valid key',
        userId: 'user_363zVO0eSCbNwbir44tl1IwE4iz',
      });
      expect(mockVerifyKey).toHaveBeenCalled();
    });

    it('should fallback to identity.id if externalId is not available', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            // No externalId
          },
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Valid key',
        userId: 'id_123',
      });
    });
  });

  describe('v1 Response Format (backward compatibility)', () => {
    it('should handle v1 format with ownerId', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        result: {
          valid: true,
          ownerId: 'test-user-id-v1',
          keyId: 'key_456',
        },
        error: null,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-key-v1',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Valid key',
        userId: 'test-user-id-v1',
      });
    });
  });

  describe('Invalid Key Handling', () => {
    it('should return 401 for invalid key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_invalid123',
        },
        data: {
          valid: false,
          code: 'NOT_FOUND',
        },
        error: {
          code: 'NOT_FOUND',
          message: 'Key not found',
        },
      });

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer invalid-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should return 401 when verification throws an error', async () => {
      mockVerifyKey.mockRejectedValueOnce(new Error('Network error'));

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer error-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe('Missing Token', () => {
    it('should return 400 when no token is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {},
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No token provided');
    });

    it('should return 400 when authorization header is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No token provided');
    });
  });

  describe('ENABLE_USER_MANAGEMENT bypass', () => {
    it('should bypass verification when ENABLE_USER_MANAGEMENT is false', async () => {
      process.env.ENABLE_USER_MANAGEMENT = 'false';

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer any-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Valid key',
        userId: 'user',
      });
      expect(mockVerifyKey).not.toHaveBeenCalled();
    });

    it('should bypass verification when ENABLE_USER_MANAGEMENT is not set', async () => {
      delete process.env.ENABLE_USER_MANAGEMENT;

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer any-key',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Valid key',
        userId: 'user',
      });
      expect(mockVerifyKey).not.toHaveBeenCalled();
    });
  });


  describe('apiId inclusion', () => {
    it('should include apiId in verification when UNKEY_API_ID is set', async () => {
      process.env.UNKEY_API_ID = 'api_test123';
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            externalId: 'test-user-id',
          },
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      await POST(req);

      // Check that verifyKey was called with apiId
      expect(mockVerifyKey).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'valid-key',
          apiId: 'api_test123',
        })
      );
    });

    it('should not include apiId when UNKEY_API_ID is not set', async () => {
      delete process.env.UNKEY_API_ID;
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            externalId: 'test-user-id',
          },
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/check-key', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      await POST(req);

      // Check that verifyKey was called without apiId
      expect(mockVerifyKey).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'valid-key',
        })
      );
      expect(mockVerifyKey).toHaveBeenCalledWith(
        expect.not.objectContaining({
          apiId: expect.anything(),
        })
      );
    });
  });
});

