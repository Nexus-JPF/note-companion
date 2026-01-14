import React from "react";
import { X } from "lucide-react";
import { ChatSession } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import { StyledContainer } from "../../../../components/ui/utils";
import { moment } from "obsidian";

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ChatHistorySidebar({
  sessions,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  isOpen = true,
  onToggle,
}: ChatHistorySidebarProps) {
  if (!isOpen) {
    return null;
  }

  const getMessageCount = (session: ChatSession): number => {
    return session.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
  };

  return (
    <StyledContainer>
      <div className={tw("w-64 border-r border-[--background-modifier-border] p-2 flex flex-col h-full")}>
        <div className={tw("text-xs font-semibold text-[--text-muted] uppercase mb-2")}>
          Chat History
        </div>
        <div className={tw("flex-1 overflow-y-auto space-y-1")}>
          {sessions.length === 0 ? (
            <div className={tw("text-xs text-[--text-muted] py-4 text-center")}>
              No chat history
            </div>
          ) : (
            sessions.map((session) => {
              const messageCount = getMessageCount(session);
              const relativeTime = moment(session.updatedAt).fromNow();

              return (
                <div
                  key={session.id}
                  className={tw(
                    "group p-2 rounded cursor-pointer text-sm transition-colors",
                    activeChatId === session.id
                      ? "bg-[--background-modifier-active-hover]"
                      : "hover:bg-[--background-modifier-hover]"
                  )}
                  onClick={() => onSelectChat(session.id)}
                >
                  <div className={tw("flex items-start justify-between gap-2")}>
                    <div className={tw("flex-1 min-w-0")}>
                      <div className={tw(
                        "font-medium text-[--text-normal] truncate",
                        activeChatId === session.id && "font-semibold"
                      )}>
                        {session.title}
                      </div>
                      <div className={tw("text-xs text-[--text-muted] mt-0.5 flex items-center gap-2")}>
                        <span>{relativeTime}</span>
                        {messageCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{messageCount} messages</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(session.id);
                      }}
                      className={tw(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "hover:text-[--text-error] flex-shrink-0",
                        "p-1 rounded hover:bg-[--background-modifier-hover]"
                      )}
                      aria-label="Delete chat"
                      title="Delete chat"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </StyledContainer>
  );
}

