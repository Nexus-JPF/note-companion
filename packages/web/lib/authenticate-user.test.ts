import { NextRequest } from 'next/server';
import { authenticateUser } from './authenticate-user';

const mockVerify = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/unkey-client', () => ({
  verifyUnkeyApiKey: (...a: any[]) => mockVerify(...a),
  extractUserId: (result: any) => result?.identity?.externalId,
}));
jest.mock('@clerk/nextjs/server', () => ({ auth: (...a: any[]) => mockAuth(...a) }));

const req = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/files/1', { headers });

describe('authenticateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
  });
  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
  });

  it('returns the owner of a valid API key', async () => {
    mockVerify.mockResolvedValue({ result: { valid: true, identity: { externalId: 'user_1' } }, error: null });
    expect(await authenticateUser(req({ authorization: 'Bearer good-key' }))).toBe('user_1');
    expect(mockVerify).toHaveBeenCalledWith('good-key');
  });

  it('accepts a Clerk session token (mobile) when it is not an API key', async () => {
    mockVerify.mockResolvedValue({ result: { valid: false }, error: null });
    mockAuth.mockResolvedValue({ userId: 'user_3' });
    expect(await authenticateUser(req({ authorization: 'Bearer clerk-jwt' }))).toBe('user_3');
  });

  it('falls through to Clerk when the key service errors', async () => {
    mockVerify.mockResolvedValue({ result: null, error: new Error('unkey down') });
    mockAuth.mockResolvedValue({ userId: 'user_4' });
    expect(await authenticateUser(req({ authorization: 'Bearer clerk-jwt' }))).toBe('user_4');
  });

  it('returns null instead of throwing when Clerk is not available', async () => {
    mockAuth.mockRejectedValue(new Error('clerkMiddleware not detected'));
    expect(await authenticateUser(req())).toBeNull();
  });

  it('rejects a made-up token that Clerk does not recognise either', async () => {
    mockVerify.mockResolvedValue({ result: { valid: false }, error: null });
    mockAuth.mockResolvedValue({ userId: null });
    expect(await authenticateUser(req({ authorization: 'Bearer made-up' }))).toBeNull();
  });

  it('uses the Clerk session when there is no Authorization header', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' });
    expect(await authenticateUser(req())).toBe('user_2');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns null when nobody is signed in', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect(await authenticateUser(req())).toBeNull();
  });

  it('uses the shared default user when user management is off (self-hosting)', async () => {
    delete process.env.ENABLE_USER_MANAGEMENT;
    expect(await authenticateUser(req())).toBe('user');
  });
});
