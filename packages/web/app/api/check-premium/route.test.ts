import { NextRequest } from 'next/server';
import { GET } from './route';

const mockLimit = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('@/lib/authenticate-user', () => ({
  authenticateUser: (...a: any[]) => mockAuthenticate(...a),
}));

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

const req = () => new NextRequest('http://localhost/api/check-premium');

describe('GET /api/check-premium', () => {
  const originalEnv = process.env.ENABLE_USER_MANAGEMENT;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
    mockAuthenticate.mockResolvedValue('user_1');
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
    mockAuthenticate.mockResolvedValue('user');
    const res = await GET(req());
    expect(await res.json()).toEqual({ hasCatalystAccess: true });
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('returns 401 when the caller cannot be identified', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('returns 500 when the lookup fails, so clients keep their last known value', async () => {
    mockLimit.mockRejectedValue(new Error('db down'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to check premium status' });
  });
});
