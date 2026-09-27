import { prefersMarkdown } from './accept';

describe('prefersMarkdown', () => {
  it('returns true when text/markdown is listed before text/html', () => {
    expect(
      prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8')
    ).toBe(true);
  });

  it('returns false when only text/html is accepted', () => {
    expect(prefersMarkdown('text/html,application/xhtml+xml')).toBe(false);
  });

  it('returns false when text/html is preferred over markdown by q-value', () => {
    expect(prefersMarkdown('text/html, text/markdown;q=0.8')).toBe(false);
  });

  it('returns false when markdown q-value is lower than default html q', () => {
    expect(prefersMarkdown('text/markdown;q=0.1, text/html')).toBe(false);
  });

  it('returns true when markdown q-value beats html q-value', () => {
    expect(prefersMarkdown('text/markdown;q=0.9, text/html;q=0.8')).toBe(
      true
    );
  });

  it('returns false for null accept header', () => {
    expect(prefersMarkdown(null)).toBe(false);
  });
});
