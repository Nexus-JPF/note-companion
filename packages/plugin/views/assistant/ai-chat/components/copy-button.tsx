import React from "react";
import { Copy } from "lucide-react";
import { Notice } from "obsidian";

interface CopyButtonProps {
  content: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      new Notice("Copied to clipboard", 2000);
    } catch (error) {
      new Notice(`Failed to copy: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-[--background-modifier-hover] rounded"
      title="Copy to clipboard"
    >
      <Copy size={16} className="text-[--text-muted]" />
    </button>
  );
};
