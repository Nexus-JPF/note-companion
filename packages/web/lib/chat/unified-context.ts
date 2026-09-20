export type SplitUnifiedContext = {
  jsonText: string | null;
  prefix: string;
  suffix: string;
};

/**
 * Plugin chat sends JSON contextItems, optionally wrapped with a file-path
 * preamble and/or editor context. Extract the first top-level JSON object
 * instead of assuming the string starts with `{`.
 */
export function splitUnifiedContextString(raw: string): SplitUnifiedContext {
  const text = raw.trim();
  const start = text.indexOf('{');
  if (start < 0) {
    return { jsonText: null, prefix: text, suffix: '' };
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          jsonText: text.slice(start, i + 1),
          prefix: text.slice(0, start).trim(),
          suffix: text.slice(i + 1).trim(),
        };
      }
    }
  }

  return { jsonText: null, prefix: text, suffix: '' };
}

export function parseUnifiedContextJson(raw: string): {
  contextItems: Record<string, unknown> | null;
  extraText: string;
} {
  const { jsonText, prefix, suffix } = splitUnifiedContextString(raw);
  const extraText = [prefix, suffix].filter(Boolean).join('\n\n');
  if (!jsonText) {
    return { contextItems: null, extraText: extraText || raw };
  }
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { contextItems: null, extraText: extraText || raw };
    }
    return {
      contextItems: parsed as Record<string, unknown>,
      extraText,
    };
  } catch {
    return { contextItems: null, extraText: extraText || raw };
  }
}
