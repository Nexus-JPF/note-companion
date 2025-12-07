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
    // Clear UNKEY_API_ID so tests can control whether apiId is included
    delete process.env.UNKEY_API_ID;
  });

  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
    delete process.env.UNKEY_API_ID;
  });

  describe('v2 Response Format (data wrapper)', () => {
    it('should handle verifyKey with v2 response format (data wrapper with meta)', async () => {
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

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      const result = await handleAuthorizationV2(req);

      expect(result).toEqual({ userId: 'test-user-id' });
      // When UNKEY_API_ID is not set, only key should be passed
      expect(mockVerifyKey).toHaveBeenCalledWith({ key: 'valid-key' });
    });

    it('should handle verifyKey with v1 response format (backward compatibility)', async () => {
      // Simulate v1 format (direct result, no data wrapper, with ownerId)
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

      // Mock Clerk auth to also fail so we get the Unauthorized error
      const { auth } = require('@clerk/nextjs/server');
      auth.mockResolvedValueOnce({ userId: null });

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-key',
        },
      });

      await expect(handleAuthorizationV2(req)).rejects.toThrow('Unauthorized');
      // verifyKey may be called with apiId if UNKEY_API_ID is set, so just check it was called
      expect(mockVerifyKey).toHaveBeenCalled();
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
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            externalId: 'test-user-id',
          },
        },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key',
        },
      });

      // Set up environment for legacy function
      process.env.UNKEY_ROOT_KEY = 'test-root-key';
      // Don't set UNKEY_API_ID so apiId won't be included

      const result = await handleAuthorization(req);

      // handleAuthorization extracts userId from identity.externalId or ownerId
      expect(result).toEqual({ userId: 'test-user-id' });
      // The legacy function calls verifyKey - check it was called (may include apiId if env var is set)
      expect(mockVerifyKey).toHaveBeenCalled();
    });
  });
});
