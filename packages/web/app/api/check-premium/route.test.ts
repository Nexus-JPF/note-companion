import { NextRequest } from 'next/server';
import { GET } from './route';
import { AuthorizationError, authenticateRequest } from '@/lib/handleAuthorization';

const mockLimit = jest.fn();

jest.mock('@/drizzle/schema', () => ({
  UserUsageTable: { userId: 'userId', hasCatalystAccess: 'hasCatalystAccess' },
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: (...a: any[]) => mockLimit(...a) })),
      })),
    })),
  },
}));

const mockAuth = authenticateRequest as jest.Mock;
const req = () => new NextRequest('http://localhost/api/check-premium');

describe('GET /api/check-premium', () => {
  const originalEnv = process.env.ENABLE_USER_MANAGEMENT;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
    mockAuth.mockResolvedValue('user_1');
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env.ENABLE_USER_MANAGEMENT = originalEnv;
  });

  it('returns true for a user whose record has catalyst access', async () => {
    mockLimit.mockResolvedValue([{ hasCatalystAccess: true }]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasCatalystAccess: true });
  });

  it('returns false for a user whose record has no catalyst access', async () => {
    mockLimit.mockResolvedValue([{ hasCatalystAccess: false }]);
    const res = await GET(req());
    expect(await res.json()).toEqual({ hasCatalystAccess: false });
  });

  it('returns false when the user has no usage record yet', async () => {
    mockLimit.mockResolvedValue([]);
    const res = await GET(req());
    expect(await res.json()).toEqual({ hasCatalystAccess: false });
  });

  it('returns true without a database lookup when user management is off', async () => {
    process.env.ENABLE_USER_MANAGEMENT = 'false';
    const res = await GET(req());
    expect(await res.json()).toEqual({ hasCatalystAccess: true });
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('passes through the status of an authorization failure', async () => {
    mockAuth.mockRejectedValue(new AuthorizationError('Unauthorized', 401));
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when the lookup fails, so clients keep their last known value', async () => {
    mockLimit.mockRejectedValue(new Error('db down'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to check premium status' });
  });
});
