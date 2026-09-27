import { isKnownPagePath } from './routes';

describe('isKnownPagePath', () => {
  it('includes static marketing routes and /demo', () => {
    expect(isKnownPagePath('/developers')).toBe(true);
    expect(isKnownPagePath('/demo')).toBe(true);
  });

  it('accepts real blog slugs only', () => {
    expect(isKnownPagePath('/blog/how-to-automate-your-second-brain')).toBe(
      true
    );
    expect(isKnownPagePath('/blog/not-a-real-post-slug-xyz')).toBe(false);
  });
});
