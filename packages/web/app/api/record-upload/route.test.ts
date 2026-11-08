import { NextRequest } from 'next/server';
import { POST } from './route';

const mockAuth = jest.fn();
const mockInsertValues = jest.fn();

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: (...a: any[]) => mockAuth(...a),
}));
jest.mock('@/drizzle/schema', () => ({
  uploadedFiles: {},
  db: {
    insert: () => ({
      values: (...a: any[]) => {
        mockInsertValues(...a);
        return { returning: async () => [{ id: 42 }] };
      },
    }),
  },
}));

const req = (body: any) =>
  new NextRequest('http://localhost/api/record-upload', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('POST /api/record-upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_PUBLIC_URL = 'https://pub.example.dev/';
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('records the caller\'s own upload and builds the URL from the key', async () => {
    const res = await POST(
      req({
        key: 'uploads/user_1/abc-note.pdf',
        publicUrl: 'https://evil.example/anything',
        originalName: 'note.pdf',
        fileType: 'application/pdf',
      })
    );
    expect(res.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        r2Key: 'uploads/user_1/abc-note.pdf',
        blobUrl: 'https://pub.example.dev/uploads/user_1/abc-note.pdf',
      })
    );
  });

  it('still works for older clients that send publicUrl', async () => {
    const res = await POST(
      req({
        key: 'uploads/user_1/abc-note.pdf',
        publicUrl: 'https://pub.example.dev/uploads/user_1/abc-note.pdf',
        originalName: 'n.pdf',
        fileType: 'application/pdf',
      })
    );
    expect(res.status).toBe(201);
  });

  it('refuses another user\'s key without touching the database', async () => {
    const res = await POST(
      req({
        key: 'uploads/user_2/abc-note.pdf',
        publicUrl: 'https://pub.example.dev/uploads/user_2/abc-note.pdf',
        originalName: 'n.pdf',
        fileType: 'application/pdf',
      })
    );
    expect(res.status).toBe(403);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('requires key, originalName and fileType', async () => {
    const res = await POST(req({ key: 'uploads/user_1/a.pdf' }));
    expect(res.status).toBe(400);
  });
});
