import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ChatComponent } from "./chat";
import FileOrganizer from "../../..";
import { Card } from "./card";
import { Button } from "./button";
import { ChatTabs } from "./components/chat-tabs";
import { ChatHistoryManager, ChatSession } from "./services/chat-history-manager";

interface AIChatSidebarProps {
  plugin: FileOrganizer;
  apiKey: string;
  onTokenLimitError?: (error: string) => void;
}

const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
  plugin,
  apiKey,
  onTokenLimitError
}) => {
  const inputRef = useRef<HTMLDivElement>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  const chatHistoryManager = useMemo(
    () => ChatHistoryManager.getInstance(plugin.app),
    [plugin.app]
  );

  // Load sessions on mount
  useEffect(() => {
    const sessions = chatHistoryManager.getAllSessions();
    setChatSessions(sessions);

    // Auto-create first session if none exist
    if (sessions.length === 0) {
      const newSession = chatHistoryManager.createSession();
      setActiveChatId(newSession.id);
      setChatSessions([newSession]);
    } else {
      // Load most recent session
      setActiveChatId(sessions[0].id);
    }
  }, [chatHistoryManager]);

  const handleNewChat = () => {
    const newSession = chatHistoryManager.createSession();
    setActiveChatId(newSession.id);
    setChatSessions(chatHistoryManager.getAllSessions());
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
  };

  const handleDeleteChat = (id: string) => {
    chatHistoryManager.deleteSession(id);
    const remaining = chatHistoryManager.getAllSessions();
    setChatSessions(remaining);

    // Switch to another chat if deleting active one
    if (activeChatId === id) {
      setActiveChatId(remaining[0]?.id || null);
    }
  };

  const handleSessionUpdate = useCallback((session: ChatSession) => {
    // Refresh session list when a session is updated
    // Use a ref to debounce updates and prevent infinite loops
    const updated = chatHistoryManager.getAllSessions();
    setChatSessions(updated);
  }, [chatHistoryManager]);

  return (
    <div className="flex flex-col h-full w-full bg-[--background-primary]">
      <ChatTabs
        sessions={chatSessions}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex-1 min-h-0 w-full">
        <ChatComponent
          plugin={plugin}
          apiKey={apiKey}
          inputRef={inputRef}
          onTokenLimitError={onTokenLimitError}
          activeChatId={activeChatId}
          onSessionUpdate={handleSessionUpdate}
          chatSessions={chatSessions}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
        />
      </div>
    </div>
  );
};

export default AIChatSidebar;
