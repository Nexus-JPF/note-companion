import { NextRequest } from 'next/server';
import { POST } from './route';

const mockAuthorize = jest.fn();
const mockWrite = jest.fn();

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuthorize(...a),
}));
jest.mock('fs/promises', () => ({ mkdir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('fs', () => ({
  __esModule: true,
  default: {
    writeFileSync: (...a: any[]) => mockWrite(...a),
    statSync: () => ({ size: 3 }),
  },
}));

const upload = (name: string) => {
  const form = new FormData();
  form.append('files', new File([new Uint8Array([1, 2, 3])], name));
  return POST(new NextRequest('http://localhost/api/files/upload', { method: 'POST', body: form }));
};

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_DIR = '/srv/uploads';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects unauthenticated uploads and writes nothing', async () => {
    mockAuthorize.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const res = await upload('note.md');
    expect(res.status).toBe(401);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes an authenticated upload inside the upload directory', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    const res = await upload('note.md');
    expect(res.status).toBe(200);
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written.startsWith('/srv/uploads/')).toBe(true);
    expect(written.endsWith('-note.md')).toBe(true);
  });

  it('keeps a traversal-style file name inside the upload directory', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    await upload('../../../../etc/cron.d/evil');
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written.startsWith('/srv/uploads/')).toBe(true);
    expect(written).not.toContain('..');
    expect(written.endsWith('-evil')).toBe(true);
  });
});
