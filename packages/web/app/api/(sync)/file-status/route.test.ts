import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mockAuthorize = jest.fn();
const mockGetFileStatus = jest.fn();

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuthorize(...a),
}));
jest.mock('@/app/dashboard/sync/actions', () => ({
  getFileStatus: (...a: any[]) => mockGetFileStatus(...a),
}));

const get = (query = 'fileId=7', headers: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost/api/file-status?${query}`, { headers }));

describe('/api/file-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('rejects a made-up bearer token without looking the file up', async () => {
    mockAuthorize.mockRejectedValue(Object.assign(new Error('Invalid key'), { status: 401 }));
    const res = await get('fileId=7', { authorization: 'Bearer anything-at-all' });
    expect(res.status).toBe(401);
    expect(mockGetFileStatus).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is identified', async () => {
    mockAuthorize.mockResolvedValue({ userId: null });
    const res = await get();
    expect(res.status).toBe(401);
    expect(mockGetFileStatus).not.toHaveBeenCalled();
  });

  it('looks the file up for the authenticated user', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    mockGetFileStatus.mockResolvedValue({ status: 'completed', text: 'hi', error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(mockGetFileStatus).toHaveBeenCalledWith(7, 'user_1');
  });

  it("maps another user's file to the Unauthorized error from getFileStatus", async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    mockGetFileStatus.mockResolvedValue({ error: 'Unauthorized' });
    const res = await get();
    expect(res.status).toBe(401);
  });

  it('POST forwards the same authorization', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    mockGetFileStatus.mockResolvedValue({ status: 'completed', text: 'hi', error: null });
    const res = await POST(
      new NextRequest('http://localhost/api/file-status', {
        method: 'POST',
        body: JSON.stringify({ fileId: 7 }),
      })
    );
    expect(res.status).toBe(200);
    expect(mockGetFileStatus).toHaveBeenCalledWith(7, 'user_1');
  });
});
