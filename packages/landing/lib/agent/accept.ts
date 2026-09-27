type AcceptEntry = {
  type: string;
  q: number;
};

function parseAcceptEntries(acceptHeader: string): AcceptEntry[] {
  return acceptHeader.split(',').map((part) => {
    const segments = part.trim().split(';').map((s) => s.trim());
    const type = segments[0]?.toLowerCase() ?? '';
    let q = 1;
    for (const segment of segments.slice(1)) {
      const [key, value] = segment.split('=').map((s) => s.trim());
      if (key === 'q' && value !== undefined) {
        const parsed = Number.parseFloat(value);
        q = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    return { type, q };
  });
}

function bestQ(entries: AcceptEntry[], type: string): number {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((max, entry) => Math.max(max, entry.q), 0);
}

/**
 * Returns true when the client prefers Markdown over HTML for this request.
 * Uses q-values when present; breaks ties by header order (first wins).
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) {
    return false;
  }

  const entries = parseAcceptEntries(acceptHeader).filter((entry) => entry.type);
  const markdownIndex = entries.findIndex((entry) => entry.type === 'text/markdown');
  if (markdownIndex === -1) {
    return false;
  }

  const markdownQ = entries[markdownIndex].q;
  if (markdownQ <= 0) {
    return false;
  }

  const htmlQ = bestQ(entries, 'text/html');
  const wildcardQ = bestQ(entries, '*/*');

  if (markdownQ > htmlQ && markdownQ > wildcardQ) {
    return true;
  }
  if (markdownQ < htmlQ || markdownQ < wildcardQ) {
    return false;
  }

  const htmlIndex = entries.findIndex((entry) => entry.type === 'text/html');
  const wildcardIndex = entries.findIndex((entry) => entry.type === '*/*');
  const firstHtmlLike = Math.min(
    htmlIndex === -1 ? Number.POSITIVE_INFINITY : htmlIndex,
    wildcardIndex === -1 ? Number.POSITIVE_INFINITY : wildcardIndex
  );

  return markdownIndex < firstHtmlLike;
}
