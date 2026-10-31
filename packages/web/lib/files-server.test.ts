const queue: unknown[] = [];

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/r2-client', () => ({
  signR2Url: async (url: string) => `signed:${url}`,
  signR2UrlsInText: async (text: string | null) => (text ? text.replace(/https:\/\/pub\.example\/\S+/g, m => `signed:${m}`) : text),
}));
jest.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  desc: (a: unknown) => ({ desc: a }),
  and: (...a: unknown[]) => ({ and: a }),
  sql: () => 'sql',
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));
jest.mock('@/drizzle/schema', () => {
  // A query builder where every step returns itself and awaiting it yields the next queued result
  const builder = (): any => {
    const result = queue.shift();
    const b: any = new Proxy(
      {},
      {
        get: (_t, prop) => (prop === 'then' ? (resolve: any) => resolve(result) : () => b),
      }
    );
    return b;
  };
  return {
    uploadedFiles: new Proxy({}, { get: (_t, prop) => String(prop) }),
    db: { select: () => builder(), insert: () => builder(), delete: () => builder() },
  };
});

import { getFilesForUser, getFileStatusForUser } from './files-server';

describe('files-server signs stored links on the way out', () => {
  beforeEach(() => {
    queue.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('signs blobUrl and links inside textContent when listing files', async () => {
    queue.push(
      [
        {
          id: 1,
          originalName: 'a.png',
          fileType: 'image',
          status: 'completed',
          createdAt: new Date(),
          tokensUsed: 1,
          error: null,
          textContent: '[Generated Diagram Image](https://pub.example/generated/u/1-a.png)',
          blobUrl: 'https://pub.example/uploads/u/x-a.png',
        },
      ],
      [{ count: 1 }]
    );
    const result = (await getFilesForUser({ page: 1, limit: 10 }, 'user_1')) as any;
    expect(result.files[0].blobUrl).toBe('signed:https://pub.example/uploads/u/x-a.png');
    expect(result.files[0].textContent).toContain('signed:https://pub.example/generated/u/1-a.png');
    expect(result.pagination.total).toBe(1);
  });

  it('signs links inside the text returned for a single file', async () => {
    queue.push([
      {
        userId: 'user_1',
        status: 'completed',
        textContent: 'diagram: https://pub.example/generated/u/1-a.png',
        error: null,
      },
    ]);
    const result = (await getFileStatusForUser(1, 'user_1')) as any;
    expect(result.text).toBe('diagram: signed:https://pub.example/generated/u/1-a.png');
  });

  it('still refuses someone else\'s file', async () => {
    queue.push([{ userId: 'someone_else', status: 'completed', textContent: 'secret', error: null }]);
    const result = (await getFileStatusForUser(1, 'user_1')) as any;
    expect(result).toEqual({ error: 'Unauthorized' });
  });
});
