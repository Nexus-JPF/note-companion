import React from "react";
import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { AIMarkdown } from "./ai-message-renderer";
import { UserMarkdown } from "./user-message-renderer";
import { type UIMessage } from "ai";
import { usePlugin } from "../provider";
import { AppendButton } from "./components/append-button";
import { CopyButton } from "./components/copy-button";
import { RefreshButton } from "./components/refresh-button";
import { getFileParts, getMessageText } from "./lib/ui-message";

/** Message for UI rendering; timestamps are stored as ms, not SDK `Date`. */
export type RenderableChatMessage = UIMessage & {
  createdAt?: number;
};

export function toRenderableChatMessage(
  msg: UIMessage,
  existingTimestamp?: number
): RenderableChatMessage {
  const createdAt =
    existingTimestamp ??
    (msg as RenderableChatMessage).createdAt ??
    Date.now();

  return { ...msg, createdAt };
}

interface MessageRendererProps {
  message: RenderableChatMessage;
  onMessageRefresh?: (messageId: string) => void;
}

function hasPendingToolCalls(message: RenderableChatMessage): boolean {
  if (!message.parts?.length) return false;

  const toolParts = message.parts.filter((p) => {
    const part = p as {
      type?: string;
      output?: unknown;
      toolInvocation?: { result?: unknown };
    };
    return part.type?.startsWith("tool-") || part.toolInvocation;
  });
  if (toolParts.length === 0) return false;

  return toolParts.some((p) => {
    const part = p as {
      state?: string;
      output?: unknown;
      toolInvocation?: { result?: unknown; state?: string };
    };
    if (part.state === "output-available" || part.state === "output-error") {
      return false;
    }
    if (part.output !== undefined) return false;
    if (part.toolInvocation?.state === "result") return false;
    return part.toolInvocation?.result === undefined;
  });
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  onMessageRefresh,
}) => {
  const plugin = usePlugin();
  const content = getMessageText(message);
  const fileParts = getFileParts(message);

  // Format timestamp - use createdAt if available, otherwise fallback to message ID timestamp or current time
  const getTimestamp = () => {
    if (message.createdAt) {
      return window.moment(message.createdAt).format("MMM D, YYYY h:mm A");
    }
    // Try to extract timestamp from message ID if it contains one
    const idMatch = message.id.match(/\d+/);
    if (idMatch) {
      const timestamp = parseInt(idMatch[0]);
      if (timestamp > 1000000000000) {
        // Looks like a timestamp (milliseconds)
        return window.moment(timestamp).format("MMM D, YYYY h:mm A");
      }
    }
    // Fallback to relative time or current time
    return window.moment().format("MMM D, YYYY h:mm A");
  };

  const timestamp = getTimestamp();

  // Only hide message if tool calls are still executing (no results yet)
  if (hasPendingToolCalls(message)) {
    return null;
  }
  if (content.length === 0 && fileParts.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="flex items-start gap-3 py-2.5"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Icon on the left - top-aligned with small padding to match text baseline */}
      <div className="flex-shrink-0 w-8 h-8 flex items-start justify-center pt-[2px]">
        {message.role === "user" ? (
          <User size={16} className="text-[--interactive-accent]" />
        ) : (
          <Bot size={16} className="text-[--interactive-accent]" />
        )}
      </div>

      {/* Message content - top-aligned, consistent line height */}
      <div className="flex-1 min-w-0 flex flex-col leading-snug">
        <div
          className={`text-sm leading-snug m-0 ${
            message.role === "assistant"
              ? "text-[--text-normal]"
              : "text-[--text-normal]"
          }`}
          style={{ marginTop: 0, paddingTop: 0, marginLeft: 0, paddingLeft: 0 }}
        >
          {message.role === "user" ? (
            <UserMarkdown content={content} />
          ) : (
            <AIMarkdown content={content} app={plugin.app} />
          )}
        </div>

        {/* Timestamp and buttons row - perfectly aligned */}
        <div className="flex items-baseline justify-between mt-1 gap-2">
          <div className="text-xs text-[--text-muted] flex-shrink-0">
            {timestamp}
          </div>
          {/* Action buttons on the right - at same baseline as timestamp */}
          {message.role === "assistant" && (
            <div className="flex-shrink-0 flex flex-row gap-0.5 items-center">
              {onMessageRefresh && (
                <RefreshButton
                  messageId={message.id}
                  onRefresh={onMessageRefresh}
                />
              )}
              <AppendButton content={content} />
              <CopyButton content={content} />
            </div>
          )}
        </div>

        {fileParts.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {fileParts.map((attachment, index) => (
              <div
                key={`${attachment.filename || index}`}
                className="relative group"
              >
                  {attachment.mediaType?.startsWith("image/") ? (
                    <img
                      src={attachment.url}
                      alt={attachment.filename}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-[--background-secondary]">
                      <svg
                        className="h-8 w-8 text-[--text-muted]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {attachment.url && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <a
                        href={attachment.url}
                        download={attachment.filename}
                        className="text-white text-sm bg-black bg-opacity-75 px-3 py-1 rounded-full"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </motion.div>
  );
};
