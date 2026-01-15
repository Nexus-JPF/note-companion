import React from "react";
import { ChatSession } from "../services/chat-history-manager";
import { ChatTabItem } from "./chat-tab-item";
import { NewChatButton } from "./new-chat-button";
import { tw } from "../../../../lib/utils";

interface ChatTabsProps {
  sessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export function ChatTabs({
  sessions,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatTabsProps) {
  // Debug: Log to verify component is rendering
  React.useEffect(() => {
    console.log('[ChatTabs] Rendering with sessions:', sessions.length, 'activeChatId:', activeChatId);
  }, [sessions.length, activeChatId]);

  // Always show tabs, even if no sessions (will show New button)
  return (
    <div
      className={tw(
        "flex-none flex items-center gap-0.5 border-b border-[--background-modifier-border]",
        "px-1.5 py-1 bg-[--background-primary] min-h-[32px]",
        "relative z-10 w-full"
      )}
    >
      {/* Scrollable tabs container */}
      <div className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {sessions.map((session) => (
          <ChatTabItem
            key={session.id}
            session={session}
            isActive={activeChatId === session.id}
            onSelect={() => onSelectChat(session.id)}
            onDelete={() => onDeleteChat(session.id)}
          />
        ))}
      </div>

      {/* New Chat button - always visible, not scrollable */}
      <div className="flex-shrink-0 ml-1">
        <NewChatButton onClick={onNewChat} />
      </div>
    </div>
  );
}

