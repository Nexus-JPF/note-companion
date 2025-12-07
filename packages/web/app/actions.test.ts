import { createLicenseKeyFromUserId } from './actions';

// Create a mock for the keys.create method
const mockCreate = jest.fn();

// Mock @unkey/api
jest.mock('@unkey/api', () => ({
  Unkey: jest.fn().mockImplementation(() => ({
    keys: {
      create: mockCreate,
    },
  })),
}));

describe('createLicenseKeyFromUserId - Unkey API v2 Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UNKEY_ROOT_KEY = 'test-root-key';
    process.env.UNKEY_API_ID = 'test-api-id';
  });

  afterEach(() => {
    delete process.env.UNKEY_ROOT_KEY;
    delete process.env.UNKEY_API_ID;
  });

  it('should handle v2 response format (data wrapper with meta)', async () => {
    // v2 format: { meta: { requestId }, data: { ... }, error: null }
    mockCreate.mockResolvedValueOnce({
      meta: {
        requestId: 'req_abc123',
      },
      data: {
        key: 'unkey_test_key_123',
        keyId: 'key_123',
      },
      error: null,
    });

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toEqual({
      key: {
        key: 'unkey_test_key_123',
      },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'my api key',
      ownerId: 'test-user-id',
      apiId: 'test-api-id',
    });
  });

  it('should handle v2 response format (data wrapper without meta)', async () => {
    // v2 format without meta (simpler version)
    mockCreate.mockResolvedValueOnce({
      data: {
        key: 'unkey_test_key_456',
        keyId: 'key_456',
      },
      error: null,
    });

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toEqual({
      key: {
        key: 'unkey_test_key_456',
      },
    });
  });

  it('should handle v1 response format (backward compatibility)', async () => {
    // Simulate v1 format (direct result, no data wrapper)
    mockCreate.mockResolvedValueOnce({
      result: {
        key: 'unkey_test_key_v1',
        keyId: 'key_789',
      },
    } as any);

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toEqual({
      key: {
        key: 'unkey_test_key_v1',
      },
    });
  });

  it('should handle errors in v2 format', async () => {
    // Suppress console.error for this test since we're testing error handling
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockCreate.mockResolvedValueOnce({
      meta: {
        requestId: 'req_error123',
      },
      data: null,
      error: {
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
      },
    });

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to create license key',
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
        }),
      })
    );

    consoleSpy.mockRestore();
  });

  it('should return null when Unkey is not configured', async () => {
    // Suppress console.log for this test
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    delete process.env.UNKEY_ROOT_KEY;

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
