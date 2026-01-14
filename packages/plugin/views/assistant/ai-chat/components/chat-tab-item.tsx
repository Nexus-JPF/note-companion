import React from "react";
import { X } from "lucide-react";
import { ChatSession } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import { moment } from "obsidian";

interface ChatTabItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ChatTabItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: ChatTabItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const relativeTime = moment(session.updatedAt).fromNow();

  return (
    <div
      className={tw(
        "group flex items-center gap-1.5 px-2 py-1 rounded-t cursor-pointer transition-colors",
        "border-b-2",
        isActive
          ? "border-[--interactive-accent] bg-[--background-modifier-active-hover]"
          : "border-transparent hover:bg-[--background-modifier-hover]"
      )}
      onClick={onSelect}
      title={`${session.title} - ${relativeTime}`}
    >
      <span
        className={tw(
          "text-[10px] text-[--text-normal] truncate max-w-[120px]",
          isActive && "font-medium"
        )}
      >
        {session.title}
      </span>
      <button
        onClick={handleDelete}
        className={tw(
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:text-[--text-error] flex-shrink-0",
          "p-0.5 rounded hover:bg-[--background-modifier-hover]"
        )}
        aria-label="Delete chat"
        title="Delete chat"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

