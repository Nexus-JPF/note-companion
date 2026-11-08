import { NextRequest } from 'next/server';
import { GET } from './route';

const mockAuthorize = jest.fn();
const queue: unknown[] = [];

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuthorize(...a),
}));
jest.mock('@/lib/r2-client', () => ({
  signR2Url: async (url: string, owner: string) => `signed:${owner}:${url}`,
}));
jest.mock('drizzle-orm', () => ({ eq: () => 'eq', desc: () => 'desc' }));
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

describe('GET /api/files/recent', () => {
  beforeEach(() => {
    queue.length = 0;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('signs each file link and leaves empty paths empty', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    queue.push([
      { id: 1, name: 'a.png', type: 'image', date: new Date(0), path: 'https://pub.example/uploads/user_1/x-a.png' },
      { id: 2, name: 'b.md', type: 'markdown', date: new Date(0), path: '' },
    ]);
    const res = await GET(new NextRequest('http://localhost/api/files/recent'));
    const files = await res.json();
    expect(res.status).toBe(200);
    expect(files[0].path).toBe('signed:user_1:https://pub.example/uploads/user_1/x-a.png');
    expect(files[1].path).toBe('');
  });
});
