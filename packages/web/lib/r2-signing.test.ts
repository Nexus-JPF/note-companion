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
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/user_1/abc-note.pdf`)).toBe('uploads/user_1/abc-note.pdf');
      expect(r2.r2KeyFromPublicUrl(`${BASE}/generated/user_1/1-ab-Diagram name.png`)).toBe(
        'generated/user_1/1-ab-Diagram name.png'
      );
    });

    it('returns null for other hosts, other prefixes, path tricks and non-strings', () => {
      expect(r2.r2KeyFromPublicUrl('https://abc.public.blob.vercel-storage.com/x.png')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/private/user_1/x.pdf`)).toBeNull();
      expect(r2.r2KeyFromPublicUrl(`${BASE}/uploads/../private/x.pdf`)).toBeNull();
      expect(r2.r2KeyFromPublicUrl('https://pub.example.dev.evil.example/uploads/user_1/x')).toBeNull();
      expect(r2.r2KeyFromPublicUrl(null)).toBeNull();
      expect(r2.r2KeyFromPublicUrl(42)).toBeNull();
    });
  });

  describe('signR2Url', () => {
    it('signs our links for an hour by default', async () => {
      const url = await r2.signR2Url(`${BASE}/uploads/user_1/abc-note.pdf`);
      expect(url).toBe('https://signed.example/uploads/user_1/abc-note.pdf?ttl=3600');
      expect(mockSign.mock.calls[0][1].input).toEqual({ Bucket: 'test-bucket', Key: 'uploads/user_1/abc-note.pdf' });
    });

    it('leaves any other URL unchanged without signing', async () => {
      const other = 'https://abc.public.blob.vercel-storage.com/x.png';
      expect(await r2.signR2Url(other)).toBe(other);
      expect(mockSign).not.toHaveBeenCalled();
    });

    it('never throws: a signing failure returns the original link', async () => {
      mockSign.mockRejectedValueOnce(new Error('boom'));
      const original = `${BASE}/uploads/user_1/abc-note.pdf`;
      expect(await r2.signR2Url(original)).toBe(original);
    });
  });

  describe('signR2UrlsInText', () => {
    it('signs a markdown image link whose file name has spaces', async () => {
      const text = `[Generated Diagram Image](${BASE}/generated/user_1/1-ab-My diagram.png)`;
      expect(await r2.signR2UrlsInText(text)).toBe(
        '[Generated Diagram Image](https://signed.example/generated/user_1/1-ab-My diagram.png?ttl=3600)'
      );
    });

    it('signs bare links, several links, and repeated links once', async () => {
      const a = `${BASE}/uploads/user_1/a.png`;
      const b = `${BASE}/uploads/user_1/b.png`;
      const out = await r2.signR2UrlsInText(`see ${a} and ${b}, then ${a} again.`);
      expect(out).toBe(
        'see https://signed.example/uploads/user_1/a.png?ttl=3600 and https://signed.example/uploads/user_1/b.png?ttl=3600, then https://signed.example/uploads/user_1/a.png?ttl=3600 again.'
      );
      expect(mockSign).toHaveBeenCalledTimes(2);
    });

    it('leaves text without our links, other links, null and empty text alone', async () => {
      expect(await r2.signR2UrlsInText('plain OCR text')).toBe('plain OCR text');
      expect(await r2.signR2UrlsInText('see https://example.com/uploads/x.png')).toBe('see https://example.com/uploads/x.png');
      expect(await r2.signR2UrlsInText(null)).toBeNull();
      expect(await r2.signR2UrlsInText('')).toBe('');
      expect(mockSign).not.toHaveBeenCalled();
    });
  });
});
