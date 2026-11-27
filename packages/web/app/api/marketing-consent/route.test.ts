import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mockAuthenticate = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/authenticate-user', () => ({
  authenticateUser: (...a: any[]) => mockAuthenticate(...a),
}));
jest.mock('@/lib/marketing-consent-server', () => ({
  getMarketingConsentForUser: (...a: any[]) => mockGet(...a),
  setMarketingConsentForUser: (...a: any[]) => mockSet(...a),
}));

const url = 'http://localhost/api/marketing-consent';
const post = (body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('/api/marketing-consent', () => {
  const originalEnv = process.env.ENABLE_USER_MANAGEMENT;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
    mockAuthenticate.mockResolvedValue('user_1');
  });

  afterAll(() => {
    process.env.ENABLE_USER_MANAGEMENT = originalEnv;
  });

  it('GET rejects an unauthenticated caller', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(401);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('GET returns the state for the authenticated user', async () => {
    mockGet.mockResolvedValue({ decided: false, optedIn: false });
    const res = await GET(new NextRequest(url));
    expect(await res.json()).toEqual({
      available: true,
      decided: false,
      optedIn: false,
    });
    expect(mockGet).toHaveBeenCalledWith('user_1');
  });

  it('GET reports unavailable when the state cannot be read', async () => {
    mockGet.mockResolvedValue(null);
    const res = await GET(new NextRequest(url));
    expect(await res.json()).toEqual({ available: false });
  });

  it('GET reports unavailable on a self-hosted server', async () => {
    process.env.ENABLE_USER_MANAGEMENT = 'false';
    const res = await GET(new NextRequest(url));
    expect(await res.json()).toEqual({ available: false });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('POST saves the choice for the authenticated user', async () => {
    mockSet.mockResolvedValue(true);
    const res = await POST(post({ optIn: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith('user_1', true);
  });

  it('POST rejects a body without a boolean optIn', async () => {
    for (const body of [{ optIn: 'yes' }, {}, 'not json']) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
    }
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('POST reports a failed save', async () => {
    mockSet.mockResolvedValue(false);
    const res = await POST(post({ optIn: false }));
    expect(res.status).toBe(502);
  });
});
