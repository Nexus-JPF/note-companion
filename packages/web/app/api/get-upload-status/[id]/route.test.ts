import { NextRequest } from 'next/server';
import { GET } from './route';

const mockAuthorize = jest.fn();
const queue: unknown[] = [];

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuthorize(...a),
}));
jest.mock('@/lib/r2-client', () => ({
  signR2Url: async (url: string, owner: string) => `signed:${owner}:${url}`,
  signR2UrlsInText: async (text: string | null, owner: string) => (text ? `signed-text:${owner}:${text}` : text),
}));
jest.mock('drizzle-orm', () => ({ eq: () => 'eq', is: () => 'is' }));
jest.mock('@/drizzle/schema', () => {
  const builder = (): any => {
    const result = queue.shift();
    const b: any = new Proxy({}, { get: (_t, prop) => (prop === 'then' ? (resolve: any) => resolve(result) : () => b) });
    return b;
  };
  return {
    uploadedFiles: new Proxy({}, { get: (_t, prop) => String(prop) }),
    db: { select: () => builder() },
  };
});

const call = (id = '7') =>
  GET(new NextRequest(`http://localhost/api/get-upload-status/${id}`), { params: Promise.resolve({ id }) });

describe('GET /api/get-upload-status/[id]', () => {
  beforeEach(() => {
    queue.length = 0;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns signed links for the owner', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    queue.push([
      {
        id: 7,
        userId: 'user_1',
        status: 'completed',
        textContent: 'hello',
        error: null,
        blobUrl: 'https://pub.example/uploads/user_1/x-a.png',
        fileType: 'image',
        originalName: 'a.png',
        updatedAt: new Date(0),
      },
    ]);
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe('signed:user_1:https://pub.example/uploads/user_1/x-a.png');
    expect(body.text).toBe('signed-text:user_1:hello');
    expect(body.fileId).toBe(7);
  });

  it("refuses someone else's file without returning links or text", async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    queue.push([{ id: 7, userId: 'someone_else', textContent: 'secret', blobUrl: 'https://pub.example/uploads/x' }]);
    const res = await call();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
