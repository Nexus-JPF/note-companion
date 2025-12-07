import { NextRequest } from 'next/server';
import {
  handleAuthorizationV2,
  handleAuthorization,
} from './handleAuthorization';

// Mock @unkey/api - v2 uses Unkey class with keys.verifyKey method
const mockVerifyKey = jest.fn();

jest.mock('@unkey/api', () => ({
  Unkey: jest.fn().mockImplementation(() => ({
    keys: {
      verifyKey: mockVerifyKey,
    },
  })),
}));

// Mock Clerk
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: jest.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      }),
    },
  }),
  auth: jest.fn().mockResolvedValue({ userId: 'clerk-user-id' }),
}));

// Mock database and other dependencies
jest.mock('../drizzle/schema', () => ({
  checkTokenUsage: jest
    .fn()
    .mockResolvedValue({ remaining: 1000, usageError: null }),
  checkUserSubscriptionStatus: jest.fn().mockResolvedValue(true),
  createEmptyUserUsage: jest.fn().mockResolvedValue(undefined),
  UserUsageTable: {},
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([
      {
        userId: 'test-user-id',
        tokenUsage: 100,
        maxTokenUsage: 10000,
        subscriptionStatus: 'active',
      },
    ]),
  },
  initializeTierConfig: jest.fn().mockResolvedValue(undefined),
  isSubscriptionActive: jest.fn().mockResolvedValue(true),
  eq: jest.fn(),
}));

// Mock PostHog
jest.mock('./posthog', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    capture: jest.fn(),
  }),
}));

describe('handleAuthorization - Unkey API v2 Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
  });

  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
  });

  describe('v2 Response Format (data wrapper)', () => {
    it('should handle verifyKey with v2 response format (data wrapper with meta)', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          ownerId: 'test-user-id',
          keyId: 'key_123',
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      const result = await handleAuthorizationV2(req);

      expect(result).toEqual({ userId: 'test-user-id' });
      expect(mockVerifyKey).toHaveBeenCalledWith({ key: 'valid-key' });
    });

    it('should handle verifyKey with v1 response format (backward compatibility)', async () => {
      // Simulate v1 format (direct result, no data wrapper)
      mockVerifyKey.mockResolvedValueOnce({
        result: {
          valid: true,
          ownerId: 'test-user-id-v1',
          keyId: 'key_456',
        },
        error: null,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key-v1',
        },
      });

      const result = await handleAuthorizationV2(req);

      expect(result).toEqual({ userId: 'test-user-id-v1' });
      expect(mockVerifyKey).toHaveBeenCalledWith({ key: 'valid-key-v1' });
    });

    it('should handle invalid key with v2 error format', async () => {
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

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-key',
        },
      });

      await expect(handleAuthorizationV2(req)).rejects.toThrow('Unauthorized');
      expect(mockVerifyKey).toHaveBeenCalledWith({ key: 'invalid-key' });
    });
  });

  describe('Legacy handleAuthorization (deprecated)', () => {
    it('should handle v2 response format', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        meta: {
          requestId: 'req_legacy123',
        },
        data: {
          valid: true,
          ownerId: 'test-user-id',
          keyId: 'key_123',
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      const result = await handleAuthorization(req);

      expect(result).toEqual({ userId: 'test-user-id' });
      expect(mockVerifyKey).toHaveBeenCalledWith({ key: 'valid-key' });
    });
  });
});
