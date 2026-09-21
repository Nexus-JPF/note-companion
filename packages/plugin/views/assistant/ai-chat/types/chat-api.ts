import {
  isToolOrDynamicToolUIPart,
  getToolOrDynamicToolName,
  type JSONValue,
  type UIMessage,
} from "ai";
import { DataChunk } from "./grounding";
import type { ToolInvocation } from "../tool-handlers/types";
import { getMessageText } from "../lib/ui-message";

export interface ChatRequestBody {
  messages: UIMessage[];
  currentDatetime: string;
  newUnifiedContext: string;
  model: string;
  requestedMaxSteps?: number;
  enableChatWebSearch?: boolean;
}

export interface YouTubeVideoSummary {
  id: string;
  title: string;
  transcript?: string;
  videoId: string;
}

export interface ResolvedToolInvocation {
  toolCallId: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  state?: string;
}

type LegacyToolInvocations = {
  toolInvocations?: Array<{
    toolCallId: string;
    toolName?: string;
    args?: unknown;
    input?: unknown;
    result?: unknown;
    output?: unknown;
    state?: string;
  }>;
};

export function getMessageToolSummary(message: UIMessage): {
  role: UIMessage["role"];
  toolInvocations: number;
  toolParts: number;
  hasResults: number;
} {
  const invocations = extractToolInvocationsFromMessage(message);
  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter(part => {
        const type = (part as { type?: string }).type;
        return (
          type === "tool-invocation" ||
          type === "dynamic-tool" ||
          (typeof type === "string" && type.startsWith("tool-"))
        );
      }).length
    : 0;

  return {
    role: message.role,
    toolInvocations: invocations.length,
    toolParts,
    hasResults: invocations.filter(tool => tool.result != null).length,
  };
}

export function extractToolInvocationsFromMessage(
  message: UIMessage
): ResolvedToolInvocation[] {
  const invocations: ResolvedToolInvocation[] = [];
  const parts = message.parts ?? [];

  for (const part of parts) {
    const typed = part as {
      type?: string;
      toolCallId?: string;
      toolName?: string;
      toolInvocation?: {
        toolCallId: string;
        toolName: string;
        args?: unknown;
        result?: unknown;
        state?: string;
      };
      input?: unknown;
      args?: unknown;
      output?: unknown;
      result?: unknown;
      state?: string;
    };

    if (isToolOrDynamicToolUIPart(part)) {
      const hasOut =
        part.state === "output-available" ||
        part.state === "output-error" ||
        ("output" in part && part.output != null);
      invocations.push({
        toolCallId: part.toolCallId,
        toolName: getToolOrDynamicToolName(part),
        args: "input" in part ? part.input : undefined,
        result: hasOut && "output" in part ? part.output : undefined,
        state: hasOut ? "result" : "call",
      });
      continue;
    }

    if (typed.type === "tool-invocation" && typed.toolInvocation) {
      invocations.push({
        toolCallId: typed.toolInvocation.toolCallId,
        toolName: typed.toolInvocation.toolName,
        args: typed.toolInvocation.args,
        result: typed.toolInvocation.result,
        state: typed.toolInvocation.state ?? "call",
      });
      continue;
    }

    if (typed.type === "tool-call" && typed.toolCallId) {
      invocations.push({
        toolCallId: typed.toolCallId,
        toolName: typed.toolName,
        args: typed.args ?? typed.input,
        state: "call",
      });
      continue;
    }

    if (typed.type === "tool-result" && typed.toolCallId) {
      const existing = invocations.find(
        invocation => invocation.toolCallId === typed.toolCallId
      );
      if (existing) {
        existing.result = typed.result ?? typed.output;
        existing.state = "result";
      }
    }
  }

  if (invocations.length === 0) {
    const legacyInvocations = (message as UIMessage & LegacyToolInvocations)
      .toolInvocations;
    if (legacyInvocations && legacyInvocations.length > 0) {
      return legacyInvocations
        .filter(tool => typeof tool.toolCallId === "string")
        .map(tool => ({
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          args: tool.input ?? tool.args,
          result: tool.output ?? tool.result,
          state: tool.state,
        }));
    }
  }

  return invocations.filter(
    invocation => invocation.toolCallId.trim() !== ""
  );
}

/** Hide in-progress assistant text until the stream finishes (avoids draft-then-revise flash). */
export function shouldDeferAssistantContent(params: {
  message: UIMessage;
  toolInvocations: ResolvedToolInvocation[];
  isLastMessage: boolean;
  isGenerating: boolean;
}): boolean {
  const { message, toolInvocations, isLastMessage, isGenerating } = params;
  if (message.role !== "assistant" || !isLastMessage || !isGenerating) {
    return false;
  }

  const text = getMessageText(message);

  if (toolInvocations.length > 0) {
    const hasCompletedTools = toolInvocations.some(
      tool => tool.result != null || tool.state === "result"
    );
    if (hasCompletedTools) return true;

    const hasPendingTools = toolInvocations.some(
      tool => tool.result == null && tool.state !== "result"
    );
    if (hasPendingTools && text.length > 0) return true;
  }

  return true;
}

export function toToolInvocation(
  invocation: ResolvedToolInvocation
): ToolInvocation {
  const base: ToolInvocation = {
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName ?? "",
    args: (invocation.args && typeof invocation.args === "object"
      ? invocation.args
      : {}) as Record<string, unknown>,
  };

  if (invocation.result != null || invocation.state === "result") {
    return { ...base, result: invocation.result };
  }

  return base;
}

export type NoteCompanionUseChatOptions = {
  onDataChunk?: (chunk: DataChunk) => void;
  experimental_prepareRequestBody?: (options: {
    id: string;
    messages: UIMessage[];
    requestData?: JSONValue;
    requestBody?: object;
  }) => ChatRequestBody;
};
