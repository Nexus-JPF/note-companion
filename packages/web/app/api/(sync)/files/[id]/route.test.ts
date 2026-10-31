import { NextRequest } from 'next/server';
import { GET } from './route';

const mockAuthorize = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuthorize(...a),
}));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/app/dashboard/sync/actions', () => ({ deleteFile: jest.fn() }));
jest.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
jest.mock('@/drizzle/schema', () => ({
  uploadedFiles: { id: 'id', userId: 'userId' },
  db: {
    select: () => ({
      from: () => ({
        where: (...a: any[]) => {
          mockWhere(...a);
          return { limit: (...b: any[]) => mockLimit(...b) };
        },
      }),
    }),
  },
}));

const call = (id: string, headers: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost/api/files/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

describe('GET /api/files/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a request that fails authorization without reading the database', async () => {
    mockAuthorize.mockRejectedValue(Object.assign(new Error('Invalid key'), { status: 401 }));
    // A made-up bearer token used to be enough to read any file
    const res = await call('7', { authorization: 'Bearer anything-at-all' });
    expect(res.status).toBe(401);
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('passes other client errors such as 429 through instead of a generic 500', async () => {
    mockAuthorize.mockRejectedValue(Object.assign(new Error('Token limit reached'), { status: 429 }));
    const res = await call('7');
    expect(res.status).toBe(429);
  });

  it('returns 401 when no user is identified', async () => {
    mockAuthorize.mockResolvedValue({ userId: null });
    const res = await call('7');
    expect(res.status).toBe(401);
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('only looks up files that belong to the caller', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    mockLimit.mockResolvedValue([
      { id: 7, status: 'completed', blobUrl: 'https://x/y', textContent: 'hello', error: null },
    ]);
    const res = await call('7');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'completed',
      fileId: 7,
      url: 'https://x/y',
      text: 'hello',
    });
    expect(mockWhere).toHaveBeenCalledWith({
      and: [
        { column: 'id', value: 7 },
        { column: 'userId', value: 'user_1' },
      ],
    });
  });

  it("answers 404, with no data, for someone else's file", async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    mockLimit.mockResolvedValue([]); // the owner filter matches nothing
    const res = await call('7');
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain('hello');
  });

  it('rejects a non-numeric id', async () => {
    mockAuthorize.mockResolvedValue({ userId: 'user_1' });
    const res = await call('abc');
    expect(res.status).toBe(400);
  });
});
