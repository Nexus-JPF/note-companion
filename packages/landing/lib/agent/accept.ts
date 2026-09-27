/**
 * Returns true when the client prefers Markdown over HTML for this request.
 * Matches acceptmarkdown.com / Ora audit expectations (Accept: text/markdown).
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) {
    return false;
  }

  const accepts = acceptHeader
    .split(',')
    .map((part) => part.trim().split(';')[0]?.trim().toLowerCase())
    .filter(Boolean);

  const markdownIndex = accepts.indexOf('text/markdown');
  if (markdownIndex === -1) {
    return false;
  }

  const htmlIndex = accepts.indexOf('text/html');
  if (htmlIndex === -1) {
    return true;
  }

  return markdownIndex < htmlIndex;
}
