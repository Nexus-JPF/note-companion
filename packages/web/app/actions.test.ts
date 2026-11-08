import { createLicenseKeyFromUserId } from '@/lib/account-server';

// lib/account-server is server-only; the marker module only exists under Next
jest.mock('server-only', () => ({}), { virtual: true });

// Create a mock for the keys.createKey method
const mockCreateKey = jest.fn();

// Mock @unkey/api
jest.mock('@unkey/api', () => ({
  Unkey: jest.fn().mockImplementation(() => ({
    keys: {
      createKey: mockCreateKey,
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
    mockCreateKey.mockResolvedValueOnce({
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
    expect(mockCreateKey).toHaveBeenCalledWith({
      name: 'my api key',
      externalId: 'test-user-id',
      apiId: 'test-api-id',
    });
  });

  it('should handle v2 response format (data wrapper without meta)', async () => {
    // v2 format without meta (simpler version)
    mockCreateKey.mockResolvedValueOnce({
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
    // Note: The implementation now only supports v2 format with 'data' property
    // This test verifies that responses without 'data' are handled gracefully
    mockCreateKey.mockResolvedValueOnce({
      result: {
        key: 'unkey_test_key_v1',
        keyId: 'key_789',
      },
    } as any);

    const result = await createLicenseKeyFromUserId('test-user-id');

    // Implementation expects 'data' property, so v1 format will return an error
    expect(result).toEqual({
      error: 'Failed to create license key: No data in response',
    });
  });

  it('should handle errors in v2 format', async () => {
    // Suppress console.error for this test since we're testing error handling
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockCreateKey.mockResolvedValueOnce({
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

    expect(result).toEqual({
      error: expect.stringContaining('Failed to create license key'),
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unkey API returned an error:',
      expect.objectContaining({
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
      })
    );

    consoleSpy.mockRestore();
  });

  it('should return null when Unkey is not configured', async () => {
    // Suppress console.log for this test
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    delete process.env.UNKEY_ROOT_KEY;

    const result = await createLicenseKeyFromUserId('test-user-id');

    expect(result).toEqual({
      error: 'Unkey configuration is missing. Please contact support.',
    });
    expect(mockCreateKey).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
  it('never writes the license key (or part of it) to the logs', async () => {
    const secret = 'unkey_SECRET_license_key_do_not_log_0123456789';
    mockCreateKey.mockResolvedValueOnce({
      meta: { requestId: 'req_log' },
      data: { key: secret, keyId: 'key_log' },
      error: null,
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await createLicenseKeyFromUserId('test-user-id');
    expect(result).toEqual({ key: { key: secret } });

    const logged = JSON.stringify([
      ...logSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...warnSpy.mock.calls,
    ]);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain(secret.substring(0, 10));

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
