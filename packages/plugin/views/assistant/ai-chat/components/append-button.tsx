import React from "react";
import { FileText } from "lucide-react";
import { Notice } from "obsidian";
import { usePlugin } from "../../provider";

interface AppendButtonProps {
  content: string;
}

export const AppendButton: React.FC<AppendButtonProps> = ({ content }) => {
  const plugin = usePlugin();

  const handleAppend = async () => {
    try {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice("No active note to append to", 3000);
        return;
      }

      const fileContent = await plugin.app.vault.read(activeFile);
      await plugin.app.vault.modify(activeFile, fileContent + "\n\n" + content);
      new Notice(`Appended to ${activeFile.basename}`, 3000);
    } catch (error) {
      new Notice(`Failed to append: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    }
  };

  return (
    <button
      onClick={handleAppend}
      className="p-1 hover:bg-[--background-modifier-hover] rounded"
      title="Append to current note"
    >
      <FileText size={16} className="text-[--text-muted]" />
    </button>
  );
};
