import {
  buildHomeMarkdown,
  buildNotFoundMarkdown,
} from './markdown-content';

describe('markdown content for agents', () => {
  it('home markdown is long enough and links to docs', () => {
    const body = buildHomeMarkdown();
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain('OpenAPI');
    expect(body).toContain('/developers');
    expect(body).toContain('/llms.txt');
  });

  it('404 markdown explains the error and links to sitemap or llms.txt', () => {
    const body = buildNotFoundMarkdown('/missing-path');
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain('/missing-path');
    expect(body).toMatch(/llms\.txt|sitemap\.xml/);
  });
});
