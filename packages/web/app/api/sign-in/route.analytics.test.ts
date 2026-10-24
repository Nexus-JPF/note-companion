import { NextRequest } from 'next/server';
import { POST } from './route';
import { resetRateLimitsForTests } from '@/lib/auth-rate-limit';

const mockGetUserList = jest.fn();
const mockVerifyPassword = jest.fn();
const mockCapture = jest.fn().mockResolvedValue(undefined);

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({ userId: null }),
  clerkClient: jest.fn(async () => ({
    users: {
      getUserList: (...a: any[]) => mockGetUserList(...a),
      verifyPassword: (...a: any[]) => mockVerifyPassword(...a),
    },
  })),
}));
jest.mock('@/app/actions', () => ({
  createLicenseKeyFromUserId: jest.fn().mockResolvedValue({ key: { key: 'lic_123' } }),
}));
jest.mock('@/lib/server-analytics', () => ({
  captureServerEvent: (...a: any[]) => mockCapture(...a),
}));

const req = (body: any, ip = '1.1.1.1') =>
  new NextRequest('http://localhost/api/sign-in', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

describe('POST /api/sign-in funnel events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitsForTests();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('records a successful sign-in against the user id', async () => {
    mockGetUserList.mockResolvedValue({ data: [{ id: 'user_1', passwordEnabled: true }] });
    mockVerifyPassword.mockResolvedValue({ verified: true });
    await POST(req({ email: 'a@b.com', password: 'pw' }));
    expect(mockCapture).toHaveBeenCalledWith('plugin_signin_succeeded', {}, 'user_1');
  });

  it('records failures anonymously with an internal reason and no email', async () => {
    mockGetUserList.mockResolvedValueOnce({ data: [] });
    await POST(req({ email: 'x@b.com', password: 'pw' }));

    mockGetUserList.mockResolvedValueOnce({ data: [{ id: 'g', passwordEnabled: false }] });
    await POST(req({ email: 'g@b.com', password: 'pw' }));

    mockGetUserList.mockResolvedValueOnce({ data: [{ id: 'u', passwordEnabled: true }] });
    mockVerifyPassword.mockRejectedValueOnce({ status: 422 });
    await POST(req({ email: 'a@b.com', password: 'pw' }));

    expect(mockCapture.mock.calls).toEqual([
      ['plugin_signin_failed', { reason: 'no_account' }],
      ['plugin_signin_failed', { reason: 'social_account' }],
      ['plugin_signin_failed', { reason: 'wrong_password' }],
    ]);
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('@');
  });

  it('records rate limiting', async () => {
    mockGetUserList.mockResolvedValue({ data: [] });
    for (let i = 0; i < 6; i++) {
      await POST(req({ email: 'a@b.com', password: 'pw' }, `9.9.9.${i}`));
    }
    expect(mockCapture).toHaveBeenCalledWith('plugin_signin_failed', { reason: 'rate_limited' });
  });
});
