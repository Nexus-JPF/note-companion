import { NextRequest } from 'next/server';
import { POST } from './route';
import { resetRateLimitsForTests } from '@/lib/auth-rate-limit';

const mockGetUserList = jest.fn();
const mockVerifyPassword = jest.fn();
const mockCreateKey = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({ userId: null }),
  clerkClient: jest.fn(async () => ({
    users: {
      getUserList: (...a: any[]) => mockGetUserList(...a),
      verifyPassword: (...a: any[]) => mockVerifyPassword(...a),
    },
  })),
}));
jest.mock('@/lib/account-server', () => ({
  createLicenseKeyFromUserId: (...a: any[]) => mockCreateKey(...a),
}));

const req = (body: any, ip = '1.1.1.1') =>
  new NextRequest('http://localhost/api/sign-in', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

describe('POST /api/sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitsForTests();
    mockCreateKey.mockResolvedValue({ key: { key: 'lic_123' } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns a license key for the correct password', async () => {
    mockGetUserList.mockResolvedValue({ data: [{ id: 'user_1', passwordEnabled: true }] });
    mockVerifyPassword.mockResolvedValue({ verified: true });
    const res = await POST(req({ email: 'a@b.com', password: 'pw-correct' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, licenseKey: 'lic_123', userId: 'user_1' });
    expect(mockVerifyPassword).toHaveBeenCalledWith({ userId: 'user_1', password: 'pw-correct' });
  });

  it('rejects a wrong password without issuing a key', async () => {
    mockGetUserList.mockResolvedValue({ data: [{ id: 'user_1', passwordEnabled: true }] });
    mockVerifyPassword.mockRejectedValue({ status: 422 });
    const res = await POST(req({ email: 'a@b.com', password: 'nope' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.licenseKey).toBeUndefined();
    expect(mockCreateKey).not.toHaveBeenCalled();
  });

  it('rejects when verifyPassword resolves without verified: true', async () => {
    mockGetUserList.mockResolvedValue({ data: [{ id: 'user_1', passwordEnabled: true }] });
    mockVerifyPassword.mockResolvedValue({ verified: false });
    const res = await POST(req({ email: 'a@b.com', password: 'pw' }));
    expect(res.status).toBe(400);
    expect((await res.json()).licenseKey).toBeUndefined();
    expect(mockCreateKey).not.toHaveBeenCalled();
  });

  it('gives the same response for unknown email, wrong password and social accounts', async () => {
    mockGetUserList.mockResolvedValueOnce({ data: [] });
    const unknown = await (await POST(req({ email: 'x@b.com', password: 'pw' }))).json();

    mockGetUserList.mockResolvedValueOnce({ data: [{ id: 'u', passwordEnabled: true }] });
    mockVerifyPassword.mockRejectedValueOnce({ status: 422 });
    const wrong = await (await POST(req({ email: 'a@b.com', password: 'pw' }))).json();

    mockGetUserList.mockResolvedValueOnce({ data: [{ id: 'g', passwordEnabled: false }] });
    const social = await (await POST(req({ email: 'g@b.com', password: 'pw' }))).json();

    expect(unknown).toEqual(wrong);
    expect(wrong).toEqual(social);
    expect(mockVerifyPassword).toHaveBeenCalledTimes(1); // never called for social
    expect(mockCreateKey).not.toHaveBeenCalled();
  });

  it('returns 500 (not a key) when Clerk fails unexpectedly', async () => {
    mockGetUserList.mockResolvedValue({ data: [{ id: 'user_1', passwordEnabled: true }] });
    mockVerifyPassword.mockRejectedValue(new Error('boom'));
    const res = await POST(req({ email: 'a@b.com', password: 'pw' }));
    expect(res.status).toBe(500);
    expect(mockCreateKey).not.toHaveBeenCalled();
  });

  it('requires email and password', async () => {
    const res = await POST(req({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
    expect(mockGetUserList).not.toHaveBeenCalled();
  });

  it('rate limits repeated attempts per email', async () => {
    mockGetUserList.mockResolvedValue({ data: [] });
    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await POST(req({ email: 'a@b.com', password: 'pw' }, `9.9.9.${i}`))).status;
    }
    expect(last).toBe(429);
  });
});
