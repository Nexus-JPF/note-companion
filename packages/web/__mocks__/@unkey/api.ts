// Mock for @unkey/api to test v2 response format
export const verifyKey = jest.fn().mockImplementation(async (key: string) => {
  // v2 response format: { meta: { requestId }, data: { ... }, error: null }
  if (key === 'valid-key') {
    return {
      meta: {
        requestId: 'req_abc123',
      },
      data: {
        valid: true,
        ownerId: 'test-user-id',
        keyId: 'key_123',
      },
      error: null,
    };
  } else if (key === 'invalid-key') {
    return {
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
    };
  } else {
    return {
      meta: {
        requestId: 'req_unauth123',
      },
      data: {
        valid: false,
        code: 'UNAUTHORIZED',
      },
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      },
    };
  }
});

export class Unkey {
  constructor(private config: { rootKey: string }) {}

  keys = {
    create: jest
      .fn()
      .mockImplementation(
        async (params: { name: string; ownerId: string; apiId: string }) => {
          // v2 response format: { meta: { requestId }, data: { ... }, error: null }
          return {
            meta: {
              requestId: 'req_abc123',
            },
            data: {
              key: 'unkey_test_key_123',
              keyId: 'key_123',
            },
            error: null,
          };
        }
      ),
  };
}
