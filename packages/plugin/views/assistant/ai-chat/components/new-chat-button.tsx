import { Plus } from "lucide-react";
import { tw } from "../../../../lib/utils";

interface NewChatButtonProps {
  onClick: () => void;
}

export function NewChatButton({ onClick }: NewChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "flex items-center justify-center w-6 h-6 rounded",
        "text-[--text-muted] hover:text-[--text-normal]",
        "hover:border hover:border-[--background-modifier-border]",
        "transition-colors"
      )}
      aria-label="Start new chat"
      title="New chat"
    >
      <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
