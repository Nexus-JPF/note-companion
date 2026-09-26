import type { UIMessage } from "ai";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { safeCreate } from "../../../fileUtils";
import { sanitizeFileName } from "../../../someUtils";
import { ChatHistoryManager } from "./services/chat-history-manager";
import { getMessageText } from "./lib/ui-message";

const CHAT_EXPORT_FOLDER = "Chat exports";
const TOOL_RESULT_MAX_CHARS = 200;

export interface MessagesToMarkdownOptions {
  includeTimestamps?: boolean;
  includeToolCalls?: boolean;
  title?: string;
}

interface ToolInvocationLike {
  toolCallId?: string;
  toolName?: string;
  result?: unknown;
  output?: unknown;
}

/**
 * Normalize message content to string (handles AI SDK parts or legacy content).
 */
function getMessageContentAsString(message: UIMessage): string {
  return getMessageText(message);
}

/**
 * Extract tool invocations from message (parts or deprecated toolInvocations).
 */
function getToolInvocations(message: UIMessage): ToolInvocationLike[] {
  const msg = message as UIMessage & {
    parts?: Array<{
      type?: string;
      toolCallId?: string;
      toolInvocation?: { toolCallId: string; toolName: string; result?: unknown };
      output?: unknown;
    }>;
    toolInvocations?: ToolInvocationLike[];
  };

  if (msg.parts) {
    return msg.parts
      .filter(
        (p) => p.type?.startsWith("tool-") || (p as { toolInvocation?: unknown }).toolInvocation
      )
      .map((p) => {
        const inv = (p as { toolInvocation?: { toolCallId: string; toolName: string; result?: unknown } }).toolInvocation;
        if (inv) {
          return { toolCallId: inv.toolCallId, toolName: inv.toolName, result: inv.result };
        }
        return {
          toolCallId: (p as { toolCallId?: string }).toolCallId,
          toolName: (p as { type?: string }).type?.replace("tool-", ""),
          result: (p as { output?: unknown }).output,
        };
      })
      .filter((t) => t.toolCallId);
  }
  const legacyInvocations = (msg as unknown as Record<string, unknown>)["toolInvocations"];
  if (Array.isArray(legacyInvocations)) {
    return legacyInvocations.map((t) => ({
      toolCallId: (t as ToolInvocationLike).toolCallId,
      toolName: (t as ToolInvocationLike).toolName,
      result: (t as ToolInvocationLike).result ?? (t as ToolInvocationLike).output,
    }));
  }
  return [];
}

/**
 * Format a tool result for inclusion in markdown (short summary).
 */
function formatToolResultSummary(result: unknown): string {
  if (result === undefined || result === null) return "(no result)";
  const str =
    typeof result === "string"
      ? result
      : typeof result === "object"
        ? JSON.stringify(result)
        : JSON.stringify(result);
  if (str.length <= TOOL_RESULT_MAX_CHARS) return str;
  return str.slice(0, TOOL_RESULT_MAX_CHARS).trim() + "…";
}

/**
 * Convert chat messages to markdown string.
 */
export function messagesToMarkdown(
  messages: UIMessage[],
  options: MessagesToMarkdownOptions = {}
): string {
  const {
    includeTimestamps = true,
    includeToolCalls = true,
    title: optionTitle,
  } = options;

  const lines: string[] = [];

  if (optionTitle) {
    lines.push("---");
    lines.push(`title: ${optionTitle}`);
    lines.push(`date: ${typeof window !== "undefined" && window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10)}`);
    lines.push('source: "Note Companion Chat"');
    lines.push("---");
    lines.push("");
    lines.push(`# ${optionTitle}`);
    lines.push("");
  }

  for (const message of messages) {
    const content = getMessageContentAsString(message);
    const roleLabel = message.role === "user" ? "User" : "Assistant";
    const createdAtMs = (() => {
      const createdAt = (message as { createdAt?: unknown }).createdAt;
      if (createdAt == null) return null;
      if (typeof createdAt === "number") return createdAt;
      if (createdAt instanceof Date) return createdAt.getTime();
      if (typeof createdAt === "string") return Date.parse(createdAt);
      return Number.NaN;
    })();
    const timestamp =
      includeTimestamps &&
      createdAtMs != null &&
      !Number.isNaN(createdAtMs) &&
      typeof window !== "undefined" &&
      window.moment
        ? window.moment(createdAtMs).format("YYYY-MM-DD HH:mm")
        : null;

    lines.push(`## ${roleLabel}`);
    if (timestamp) {
      lines.push(`*${timestamp}*`);
      lines.push("");
    }
    if (content.trim()) {
      lines.push(content.trim());
      lines.push("");
    }

    if (includeToolCalls && message.role === "assistant") {
      const tools = getToolInvocations(message);
      for (const tool of tools) {
        const name = tool.toolName || "tool";
        const summary = formatToolResultSummary(tool.result ?? tool.output);
        lines.push(`**Tool (${name}):** ${summary}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n").trimEnd();
}

/**
 * Export current chat to a new note in the vault.
 */
export async function exportChatToVault(
  app: App,
  messages: UIMessage[],
  sessionTitle: string | null
): Promise<void> {
  const title = sessionTitle || ChatHistoryManager.generateTitleFromMessages(messages);
  const sanitized = sanitizeFileName(title).trim() || "Exported Chat";
  const truncated = sanitized.length > 80 ? sanitized.slice(0, 80).trim() : sanitized;
  const date =
    typeof window !== "undefined" && window.moment
      ? window.moment().format("YYYY-MM-DD")
      : new Date().toISOString().slice(0, 10);
  const fileName = `${truncated} ${date}.md`;
  const desiredPath = `${CHAT_EXPORT_FOLDER}/${fileName}`;
  const markdown = messagesToMarkdown(messages, { title, includeTimestamps: true, includeToolCalls: true });

  const file = await safeCreate(app, desiredPath, markdown);
  new Notice(`Chat exported to ${file.path}`);
  void app.workspace.getLeaf().openFile(file);
}

/**
 * Copy current chat as markdown to the clipboard.
 */
export async function copyChatToClipboard(
  messages: UIMessage[],
  sessionTitle: string | null
): Promise<void> {
  const title = sessionTitle || ChatHistoryManager.generateTitleFromMessages(messages);
  const markdown = messagesToMarkdown(messages, { title, includeTimestamps: true, includeToolCalls: true });
  await navigator.clipboard.writeText(markdown);
  new Notice("Chat copied to clipboard.");
}
