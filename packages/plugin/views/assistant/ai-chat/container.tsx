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
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]); // Store all sessions

  const MAX_TABS = 10; // Maximum number of tabs to display

  const chatHistoryManager = useMemo(
    () => ChatHistoryManager.getInstance(plugin.app),
    [plugin.app]
  );

  // Function to get visible sessions based on active chat
  const getVisibleSessions = useCallback((all: ChatSession[], activeId: string | null): ChatSession[] => {
    if (all.length === 0) return [];

    // If no active chat, return most recent N sessions
    if (!activeId) {
      return all.slice(0, MAX_TABS);
    }

    // Find the index of the active chat
    const activeIndex = all.findIndex(s => s.id === activeId);

    if (activeIndex === -1) {
      // Active chat not found in all sessions - refresh and try again
      // This can happen if sessions were updated but allSessions wasn't refreshed
      console.warn("[ChatTabs] Active chat not found in allSessions, refreshing...");
      return all.slice(0, MAX_TABS);
    }

    // Calculate how many tabs to show before and after active
    // Try to center the active tab, but adjust if near edges
    const halfTabs = Math.floor(MAX_TABS / 2);
    let startIndex = Math.max(0, activeIndex - halfTabs);
    let endIndex = Math.min(all.length, startIndex + MAX_TABS);

    // Adjust if we're near the end
    if (endIndex - startIndex < MAX_TABS) {
      startIndex = Math.max(0, endIndex - MAX_TABS);
    }

    const visible = all.slice(startIndex, endIndex);

    // Ensure active chat is always included (safety check)
    if (!visible.find(s => s.id === activeId) && activeIndex >= 0) {
      console.warn("[ChatTabs] Active chat not in visible tabs, adding it");
      const activeSession = all[activeIndex];
      // Replace the last tab with the active one if needed
      if (visible.length >= MAX_TABS) {
        visible[visible.length - 1] = activeSession;
      } else {
        visible.push(activeSession);
      }
    }

    return visible;
  }, [MAX_TABS]);

  // Load all sessions on mount (wait for history manager to finish loading)
  useEffect(() => {
    const loadSessions = async () => {
      // Wait for the history manager to finish loading
      await chatHistoryManager.waitForLoad();

      const sessions = chatHistoryManager.getAllSessions();
      console.log("[ChatTabs] Initial load - sessions from manager:", sessions.length);
      setAllSessions(sessions);

      // Auto-create first session if none exist
      if (sessions.length === 0) {
        const newSession = chatHistoryManager.createSession();
        setActiveChatId(newSession.id);
        setAllSessions([newSession]);
        setChatSessions([newSession]);
      } else {
        // Load most recent session
        const activeId = sessions[0].id;
        console.log("[ChatTabs] Setting active chat:", activeId, "from", sessions.length, "sessions");
        setActiveChatId(activeId);
        const visible = getVisibleSessions(sessions, activeId);
        console.log("[ChatTabs] Initial visible sessions:", visible.length, "ids:", visible.map(s => s.id));
        setChatSessions(visible);
      }
    };

    loadSessions();
  }, [chatHistoryManager, getVisibleSessions]);

  // Update visible sessions when active chat changes
  useEffect(() => {
    if (allSessions.length > 0) {
      const visible = getVisibleSessions(allSessions, activeChatId);
      console.log("[ChatTabs] Updating visible sessions:", {
        allSessionsCount: allSessions.length,
        activeChatId,
        visibleCount: visible.length,
        visibleIds: visible.map(s => s.id),
      });
      setChatSessions(visible);
    } else if (activeChatId) {
      // If we have an active chat but no allSessions, refresh
      console.log("[ChatTabs] Active chat but no allSessions, refreshing...");
      const refreshed = chatHistoryManager.getAllSessions();
      setAllSessions(refreshed);
      setChatSessions(getVisibleSessions(refreshed, activeChatId));
    }
  }, [activeChatId, allSessions, getVisibleSessions, chatHistoryManager]);

  const handleNewChat = () => {
    const newSession = chatHistoryManager.createSession();
    const updated = chatHistoryManager.getAllSessions();
    setAllSessions(updated);
    setActiveChatId(newSession.id);
    setChatSessions(getVisibleSessions(updated, newSession.id));
  };

  const handleSelectChat = (id: string) => {
    // Refresh all sessions to ensure we have the latest data
    const updated = chatHistoryManager.getAllSessions();
    setAllSessions(updated);
    setActiveChatId(id);
    // Visible sessions will update via useEffect
  };

  const handleDeleteChat = (id: string) => {
    chatHistoryManager.deleteSession(id);
    const remaining = chatHistoryManager.getAllSessions();
    setAllSessions(remaining);

    // Switch to another chat if deleting active one
    if (activeChatId === id) {
      const newActiveId = remaining[0]?.id || null;
      setActiveChatId(newActiveId);
      setChatSessions(getVisibleSessions(remaining, newActiveId));
    } else {
      // Just update visible sessions
      setChatSessions(getVisibleSessions(remaining, activeChatId));
    }
  };

  const handleSessionUpdate = useCallback((session: ChatSession) => {
    // Refresh session list when a session is updated
    const updated = chatHistoryManager.getAllSessions();
    setAllSessions(updated);
    setChatSessions(getVisibleSessions(updated, activeChatId));
  }, [chatHistoryManager, activeChatId, getVisibleSessions]);

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
