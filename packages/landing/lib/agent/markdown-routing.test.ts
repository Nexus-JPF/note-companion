import { resolveAgentMarkdownRoute } from './markdown-routing';

describe('resolveAgentMarkdownRoute', () => {
  it('continues for HTML-preferred requests to unknown paths', () => {
    expect(
      resolveAgentMarkdownRoute('/missing', 'text/html,application/json')
    ).toEqual({ action: 'continue' });
  });

  it('returns home markdown when markdown is preferred', () => {
    const result = resolveAgentMarkdownRoute('/', 'text/markdown');
    expect(result.action).toBe('respond');
    if (result.action === 'respond') {
      expect(result.status).toBe(200);
      expect(result.body).toContain('Note Companion');
      expect(result.body.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('returns markdown 404 for unknown paths when markdown is preferred', () => {
    const result = resolveAgentMarkdownRoute(
      '/__ora-404-probe',
      'text/markdown'
    );
    expect(result.action).toBe('respond');
    if (result.action === 'respond') {
      expect(result.status).toBe(404);
      expect(result.body).toContain('Page not found');
      expect(result.body).toContain('/__ora-404-probe');
    }
  });

  it('returns developers markdown when markdown is preferred', () => {
    const result = resolveAgentMarkdownRoute('/developers', 'text/markdown');
    expect(result.action).toBe('respond');
    if (result.action === 'respond') {
      expect(result.status).toBe(200);
      expect(result.body).toContain('developer resources');
      expect(result.body).toContain('openapi.json');
    }
  });

  it('returns markdown 404 for missing blog posts', () => {
    const result = resolveAgentMarkdownRoute(
      '/blog/this-slug-does-not-exist',
      'text/markdown'
    );
    expect(result.action).toBe('respond');
    if (result.action === 'respond') {
      expect(result.status).toBe(404);
    }
  });

  it('continues for known blog posts so Next can render the article', () => {
    expect(
      resolveAgentMarkdownRoute(
        '/blog/how-to-automate-your-second-brain',
        'text/markdown'
      )
    ).toEqual({ action: 'continue' });
  });

  it('continues for /demo so Next can serve the page', () => {
    expect(
      resolveAgentMarkdownRoute('/demo', 'text/markdown')
    ).toEqual({ action: 'continue' });
  });
});
