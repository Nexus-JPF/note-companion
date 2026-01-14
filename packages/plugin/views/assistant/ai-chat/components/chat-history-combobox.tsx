import React, { useState, useRef, useEffect } from "react";
import { Search, Clock, X } from "lucide-react";
import { ChatSession, ChatHistoryManager } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import { moment, App } from "obsidian";
import Fuse from "fuse.js";

interface ChatHistoryComboboxProps {
  sessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  app?: App; // Optional app to load fresh sessions
}

export function ChatHistoryCombobox({
  sessions: sessionsProp,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  app,
}: ChatHistoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load fresh sessions from manager when dropdown opens (to catch any updates)
  const [sessions, setSessions] = React.useState<ChatSession[]>(sessionsProp);

  React.useEffect(() => {
    setSessions(sessionsProp);
  }, [sessionsProp]);

  // When dropdown opens, refresh sessions from manager if app is provided
  React.useEffect(() => {
    if (isOpen && app) {
      const manager = ChatHistoryManager.getInstance(app);
      const freshSessions = manager.getAllSessions();
      setSessions(freshSessions);
    }
  }, [isOpen, app]);

  // Get active session for display
  const activeSession = sessions.find(s => s.id === activeChatId);

  // Setup Fuse.js for fuzzy search
  const fuse = useRef<Fuse<ChatSession> | null>(null);

  // Initialize or update fuse when sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      if (!fuse.current) {
        fuse.current = new Fuse(sessions, {
          keys: ["title"],
          threshold: 0.3,
          includeScore: true,
        });
      } else {
        fuse.current.setCollection(sessions);
      }
    } else {
      fuse.current = null;
    }
  }, [sessions]);

  // Filter sessions based on search query
  const filteredSessions = searchQuery && fuse.current
    ? fuse.current.search(searchQuery).map(result => result.item)
    : sessions;

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, filteredSessions.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredSessions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredSessions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredSessions[selectedIndex]) {
          onSelectChat(filteredSessions[selectedIndex].id);
          setIsOpen(false);
          setSearchQuery("");
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredSessions, onSelectChat]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const getMessageCount = (session: ChatSession): number => {
    return session.messages.filter(
      m => m.role === "user" || m.role === "assistant"
    ).length;
  };

  return (
    <div ref={containerRef} className={tw("relative")}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={tw(
          "flex items-center gap-2 px-3 py-1.5 text-xs rounded",
          "bg-[--background-modifier-form-field] hover:bg-[--background-modifier-hover]",
          "text-[--text-normal] border border-[--background-modifier-border]",
          "min-w-[200px] justify-between"
        )}
        title="Search chat history"
      >
        <div className={tw("flex items-center gap-2 flex-1 min-w-0")}>
          <Search className="w-3 h-3 text-[--text-muted] flex-shrink-0" />
          <span className={tw("truncate")}>
            {activeSession?.title || "Select chat..."}
          </span>
        </div>
        <Clock className="w-3 h-3 text-[--text-muted] flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={tw(
            "absolute top-full right-0 mt-1 w-[300px] max-h-[400px]",
            "bg-[--background-primary] border border-[--background-modifier-border]",
            "rounded shadow-lg z-50 overflow-hidden"
          )}
          style={{
            maxWidth: 'calc(100vw - 2rem)', // Prevent overflow beyond viewport
          }}
        >
          {/* Search Input */}
          <div className={tw("p-2 border-b border-[--background-modifier-border]")}>
            <div className={tw("relative")}>
              <Search className={tw("absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[--text-muted]")} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className={tw(
                  "w-full pl-7 pr-2 py-1.5 text-xs rounded",
                  "bg-[--background-modifier-form-field]",
                  "text-[--text-normal] border border-[--background-modifier-border]",
                  "focus:outline-none focus:ring-1 focus:ring-[--interactive-accent]"
                )}
              />
            </div>
          </div>

          {/* Results List */}
          <div className={tw("overflow-y-auto max-h-[350px]")}>
            {filteredSessions.length === 0 ? (
              <div className={tw("px-4 py-3 text-xs text-[--text-muted] text-center")}>
                No chats found
              </div>
            ) : (
              filteredSessions.map((session, index) => {
                const messageCount = getMessageCount(session);
                const relativeTime = moment(session.updatedAt).fromNow();
                const isActive = activeChatId === session.id;
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={session.id}
                    className={tw(
                      "group px-3 py-2 cursor-pointer transition-colors",
                      "border-b border-[--background-modifier-border] last:border-b-0",
                      isSelected && "bg-[--background-modifier-active-hover]",
                      !isSelected && "hover:bg-[--background-modifier-hover]"
                    )}
                    onClick={() => {
                      onSelectChat(session.id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={tw("flex items-start justify-between gap-2")}>
                      <div className={tw("flex-1 min-w-0")}>
                        <div
                          className={tw(
                            "text-xs font-medium text-[--text-normal] truncate",
                            isActive && "text-[--interactive-accent]"
                          )}
                        >
                          {session.title}
                        </div>
                        <div
                          className={tw(
                            "text-[10px] text-[--text-muted] mt-0.5 flex items-center gap-1.5"
                          )}
                        >
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
                        onClick={e => {
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
      )}
    </div>
  );
}

