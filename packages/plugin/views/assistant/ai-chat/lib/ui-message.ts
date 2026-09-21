import { generateId, isFileUIPart, type FileUIPart, type UIMessage } from "ai";

type LegacyAttachment = {
  name?: string;
  contentType?: string;
  mediaType?: string;
  url?: string;
};

type LegacyToolInvocation = {
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
  result?: unknown;
  output?: unknown;
  state?: string;
};

type LegacyMessage = {
  id?: string;
  role?: string;
  content?: unknown;
  parts?: UIMessage["parts"];
  metadata?: unknown;
  toolInvocations?: LegacyToolInvocation[];
  experimental_attachments?: LegacyAttachment[];
};

export function getMessageText(message: {
  content?: unknown;
  parts?: Array<{ type?: string; text?: string }>;
}): string {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts
      .filter(part => part.type === "text" && typeof part.text === "string")
      .map(part => part.text as string)
      .join("");
  }

  if (typeof message.content === "string") return message.content;

  if (Array.isArray(message.content)) {
    return (message.content as Array<{ type?: string; text?: string }>)
      .map(part =>
        part && typeof part === "object" && typeof part.text === "string"
          ? part.text
          : ""
      )
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export function getFileParts(message: {
  parts?: UIMessage["parts"];
  experimental_attachments?: LegacyAttachment[];
}): FileUIPart[] {
  const fromParts = Array.isArray(message.parts)
    ? message.parts.filter(isFileUIPart)
    : [];
  if (fromParts.length > 0) return fromParts;

  return (message.experimental_attachments ?? [])
    .filter(attachment => typeof attachment?.url === "string")
    .map(attachment => ({
      type: "file" as const,
      url: attachment.url as string,
      mediaType:
        attachment.mediaType ||
        attachment.contentType ||
        "application/octet-stream",
      filename: attachment.name,
    }));
}

function rewriteLegacyParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  return parts.map(part => {
    const typed = part as {
      type?: string;
      toolCallId?: string;
      toolName?: string;
      state?: string;
      input?: unknown;
      args?: unknown;
      output?: unknown;
      result?: unknown;
      toolInvocation?: LegacyToolInvocation;
    };
    if (typed.type !== "tool-invocation") return part;
    return toolPartFromLegacy({
      toolCallId: typed.toolInvocation?.toolCallId ?? typed.toolCallId,
      toolName: typed.toolInvocation?.toolName ?? typed.toolName,
      state: typed.toolInvocation?.state ?? typed.state,
      input: typed.toolInvocation?.input ?? typed.input,
      args: typed.toolInvocation?.args ?? typed.args,
      output: typed.toolInvocation?.output ?? typed.output,
      result: typed.toolInvocation?.result ?? typed.result,
    });
  });
}

function toolPartFromLegacy(inv: LegacyToolInvocation): UIMessage["parts"][number] {
  const name = inv.toolName || "unknown";
  const hasOut =
    inv.result != null ||
    inv.output != null ||
    inv.state === "result" ||
    inv.state === "output-available";

  return {
    type: `tool-${name}`,
    toolCallId: inv.toolCallId || generateId(),
    state: hasOut ? "output-available" : "input-available",
    input: inv.input ?? inv.args,
    ...(hasOut ? { output: inv.output ?? inv.result } : {}),
  } as UIMessage["parts"][number];
}

/**
 * Vault history is v4 `Message[]` (content / toolInvocations). Convert once on load.
 */
export function convertLegacyToUIMessage(raw: unknown): UIMessage {
  const message = (raw ?? {}) as LegacyMessage;
  const role =
    message.role === "assistant" || message.role === "system"
      ? message.role
      : "user";

  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return {
      id: typeof message.id === "string" && message.id.length > 0
        ? message.id
        : generateId(),
      role,
      parts: rewriteLegacyParts(message.parts),
      ...(message.metadata != null ? { metadata: message.metadata } : {}),
    };
  }

  const parts: UIMessage["parts"] = [];
  const text = getMessageText(message);
  if (text.length > 0) {
    parts.push({ type: "text", text });
  }

  for (const file of getFileParts(message)) {
    parts.push(file);
  }

  if (Array.isArray(message.toolInvocations)) {
    for (const invocation of message.toolInvocations) {
      parts.push(toolPartFromLegacy(invocation));
    }
  }

  return {
    id: typeof message.id === "string" && message.id.length > 0
      ? message.id
      : generateId(),
    role,
    parts,
  };
}

export function convertLegacyMessagesToUIMessages(
  messages: unknown[] | undefined
): UIMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map(convertLegacyToUIMessage);
}
