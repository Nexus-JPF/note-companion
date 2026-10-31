const mockSign = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockSign(...args),
}));

// r2-client reads its settings when it is first loaded, so set them first
process.env.R2_BUCKET = 'test-bucket';
process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
process.env.R2_ACCESS_KEY_ID = 'test-key-id';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
process.env.R2_PUBLIC_URL = 'https://pub.example.dev/';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const r2 = require('./r2-client') as typeof import('./r2-client');

const BASE = 'https://pub.example.dev';

describe('R2 link signing', () => {
  beforeEach(() => {
    mockSign.mockReset();
    mockSign.mockImplementation(async (_client: unknown, command: any, options: any) =>
      `https://signed.example/${command.input.Key}?ttl=${options.expiresIn}`
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('r2KeyFromPublicUrl', () => {
    it('returns the key behind one of our links', () => {
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/user_1/abc-note.pdf`, 'user_1')).toBe('uploads/user_1/abc-note.pdf');
      expect(r2.r2KeyFromPublicUrl(`${BASE}/generated/user_1/1-ab-Diagram name.png`, 'user_1')).toBe(
        'generated/user_1/1-ab-Diagram name.png'
      );
    });

    it('returns null for other hosts, other prefixes, path tricks and non-strings', () => {
      expect(r2.r2KeyFromPublicUrl('https://abc.public.blob.vercel-storage.com/x.png', 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/private/user_1/x.pdf`, 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/user_1/../user_2/x.pdf`, 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl('https://pub.example.dev.evil.example/uploads/user_1/x', 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(null, 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(42, 'user_1')).toBeNull();
    });
  });

  describe('signR2Url', () => {
    it('signs our links for an hour by default', async () => {
      const url = await r2.signR2Url(`${BASE}/uploads/user_1/abc-note.pdf`, 'user_1');
      expect(url).toBe('https://signed.example/uploads/user_1/abc-note.pdf?ttl=3600');
      expect(mockSign.mock.calls[0][1].input).toEqual({ Bucket: 'test-bucket', Key: 'uploads/user_1/abc-note.pdf' });
    });

    it('leaves any other URL unchanged without signing', async () => {
      const other = 'https://abc.public.blob.vercel-storage.com/x.png';
      expect(await r2.signR2Url(other, 'user_1')).toBe(other);
      expect(mockSign).not.toHaveBeenCalled();
    });

    it('never throws: a signing failure returns the original link', async () => {
      mockSign.mockRejectedValueOnce(new Error('boom'));
      const original = `${BASE}/uploads/user_1/abc-note.pdf`;
      expect(await r2.signR2Url(original, 'user_1')).toBe(original);
    });
  });

  describe('signR2UrlsInText', () => {
    it('signs a markdown image link whose file name has spaces', async () => {
      const text = `[Generated Diagram Image](${BASE}/generated/user_1/1-ab-My diagram.png)`;
      expect(await r2.signR2UrlsInText(text, 'user_1')).toBe(
        '[Generated Diagram Image](https://signed.example/generated/user_1/1-ab-My diagram.png?ttl=3600)'
      );
    });

    it('signs bare links, several links, and repeated links once', async () => {
      const a = `${BASE}/uploads/user_1/a.png`;
      const b = `${BASE}/uploads/user_1/b.png`;
      const out = await r2.signR2UrlsInText(`see ${a} and ${b}, then ${a} again.`, 'user_1');
      expect(out).toBe(
        'see https://signed.example/uploads/user_1/a.png?ttl=3600 and https://signed.example/uploads/user_1/b.png?ttl=3600, then https://signed.example/uploads/user_1/a.png?ttl=3600 again.'
      );
      expect(mockSign).toHaveBeenCalledTimes(2);
    });

    it('leaves text without our links, other links, null and empty text alone', async () => {
      expect(await r2.signR2UrlsInText('plain OCR text', 'user_1')).toBe('plain OCR text');
      expect(await r2.signR2UrlsInText('see https://example.com/uploads/x.png', 'user_1')).toBe('see https://example.com/uploads/x.png');
      expect(await r2.signR2UrlsInText(null, 'user_1')).toBeNull();
      expect(await r2.signR2UrlsInText('', 'user_1')).toBe('');
      expect(mockSign).not.toHaveBeenCalled();
    });
  });

  describe('signing is scoped to the record owner', () => {
    const theirs = `${BASE}/uploads/someone_else/abc-secret.pdf`;

    it("does not return a key outside the owner's folders", () => {
      expect(r2.r2KeyFromPublicUrl(theirs, 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/user_10/x.pdf`, 'user_1')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/user_1/x.pdf`, '')).toBeNull();
    });

    it("leaves another user's link unsigned (and never calls the signer)", async () => {
      expect(await r2.signR2Url(theirs, 'user_1')).toBe(theirs);
      expect(mockSign).not.toHaveBeenCalled();
    });

    it("signs the owner's links inside text but leaves another user's link as it was", async () => {
      const mine = `${BASE}/generated/user_1/1-ab-d.png`;
      const out = await r2.signR2UrlsInText(`mine ${mine} theirs ${theirs}`, 'user_1');
      expect(out).toBe(`mine https://signed.example/generated/user_1/1-ab-d.png?ttl=3600 theirs ${theirs}`);
      expect(mockSign).toHaveBeenCalledTimes(1);
    });
  });

  describe('signedOrPublicR2Url', () => {
    it('returns a signed link for a key we just created', async () => {
      expect(await r2.signedOrPublicR2Url('uploads/user_1/new-a.png')).toBe(
        'https://signed.example/uploads/user_1/new-a.png?ttl=3600'
      );
    });

    it('never throws: falls back to the plain public link if signing fails', async () => {
      mockSign.mockRejectedValueOnce(new Error('boom'));
      expect(await r2.signedOrPublicR2Url('uploads/user_1/new-a.png')).toBe(`${BASE}/uploads/user_1/new-a.png`);
    });
  });
});
