export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

export const handleAuthorizationV2 = jest.fn().mockResolvedValue({
  userId: 'test-user',
  isAuthorized: true,
});

