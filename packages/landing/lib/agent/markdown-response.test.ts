import { getSiteBaseUrl } from './markdown-response';

describe('getSiteBaseUrl', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it('strips www from configured site URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.notecompanion.ai/';
    expect(getSiteBaseUrl()).toBe('https://notecompanion.ai');
  });
});
