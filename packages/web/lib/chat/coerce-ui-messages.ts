type LoosePart = {
  type?: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
  result?: unknown;
  toolInvocation?: {
    toolCallId?: string;
    toolName?: string;
    state?: string;
    input?: unknown;
    args?: unknown;
    output?: unknown;
    result?: unknown;
  };
};

function hasToolOutput(inv: {
  result?: unknown;
  output?: unknown;
  state?: string;
}): boolean {
  return (
    inv.result != null ||
    inv.output != null ||
    inv.state === 'result' ||
    inv.state === 'output-available'
  );
}

function toolPartFromLegacy(inv: {
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
  result?: unknown;
}) {
  const name = inv.toolName || 'unknown';
  const done = hasToolOutput(inv);
  const error = inv.state === 'output-error' || inv.state === 'error';
  return {
    type: `tool-${name}`,
    toolCallId: inv.toolCallId,
    toolName: name,
    state: error ? 'output-error' : done ? 'output-available' : 'input-available',
    input: inv.input ?? inv.args,
    ...(done || error ? { output: inv.output ?? inv.result } : {}),
  };
}

/** v4 UI parts used `tool-invocation`; AI SDK 5 `convertToModelMessages` needs `tool-${name}`. */
export function rewriteLegacyToolParts(parts: unknown[]): unknown[] {
  return parts.map((raw) => {
    const part = raw as LoosePart;
    if (!part || typeof part !== 'object') return raw;
    if (part.type !== 'tool-invocation') return raw;
    const inv = part.toolInvocation ?? part;
    return toolPartFromLegacy({
      toolCallId: inv.toolCallId ?? part.toolCallId,
      toolName: inv.toolName ?? part.toolName,
      state: inv.state ?? part.state,
      input: inv.input ?? part.input,
      args: inv.args ?? part.args,
      output: inv.output ?? part.output,
      result: inv.result ?? part.result,
    });
  });
}

/**
 * Accept UIMessage parts, or v4-shaped { content, toolInvocations }.
 * Always rewrite `tool-invocation` parts even when `parts` is already present.
 */
export function coerceToUiMessages(messages: unknown[]): any[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((raw) => {
    const m = raw as any;
    if (!m || typeof m !== 'object') return m;

    if (Array.isArray(m.parts) && m.parts.length > 0) {
      return { ...m, parts: rewriteLegacyToolParts(m.parts) };
    }

    const parts: any[] = [];
    if (typeof m.content === 'string' && m.content.length > 0) {
      parts.push({ type: 'text', text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === 'text' && typeof part.text === 'string') {
          parts.push({ type: 'text', text: part.text });
        }
      }
    }
    if (Array.isArray(m.toolInvocations)) {
      for (const inv of m.toolInvocations) {
        parts.push(toolPartFromLegacy(inv));
      }
    }
    return { ...m, parts };
  });
}
