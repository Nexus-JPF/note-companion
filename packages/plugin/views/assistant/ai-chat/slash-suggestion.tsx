import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import CommandList from "./command-list";
import {
  Trash2,
  Sparkles,
  Search,
  FileText,
  Zap,
  Video,
  Wand2,
  BookOpen,
  FileCode,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: "format" | "action" | "ai";
  command?: string;
  args?: any;
  action?: string;
  templateName?: string;
}

// Helper function to get icon for template name
const getTemplateIcon = (templateName: string): React.ReactNode => {
  const lowerName = templateName.toLowerCase();
  if (lowerName.includes("youtube") || lowerName.includes("video")) {
    return <Video className="w-4 h-4" />;
  }
  if (lowerName.includes("enhance")) {
    return <Wand2 className="w-4 h-4" />;
  }
  if (lowerName.includes("meeting")) {
    return <FileText className="w-4 h-4" />;
  }
  if (lowerName.includes("research") || lowerName.includes("paper")) {
    return <BookOpen className="w-4 h-4" />;
  }
  // Default icon for other templates
  return <FileCode className="w-4 h-4" />;
};

// Base commands (action and AI commands)
const baseCommands: CommandItem[] = [
  // Action commands
  {
    id: "clear",
    label: "Clear Chat",
    description: "Clear chat history",
    icon: <Trash2 className="w-4 h-4" />,
    category: "action",
    action: "clear",
  },
  {
    id: "new",
    label: "New Chat",
    description: "Start a new conversation",
    icon: <Sparkles className="w-4 h-4" />,
    category: "action",
    action: "newChat",
  },
  {
    id: "search",
    label: "Search Vault",
    description: "Search your vault",
    icon: <Search className="w-4 h-4" />,
    category: "action",
    action: "search",
  },
  // AI commands
  {
    id: "summarize",
    label: "Summarize",
    description: "Summarize current context",
    icon: <Zap className="w-4 h-4" />,
    category: "ai",
    action: "summarize",
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain selected text",
    icon: <Zap className="w-4 h-4" />,
    category: "ai",
    action: "explain",
  },
];

const suggestion = {
  items: ({ query, editor }: { query?: string; editor?: any } = {}) => {
    const searchQuery = query || "";
    console.log("Slash command items requested, query:", searchQuery);

    // Get template names from editor storage, with fallback to empty array
    let templateNames: string[] = [];
    try {
      if (editor && editor.storage && editor.storage.templates) {
        templateNames = editor.storage.templates;
      }
    } catch (error) {
      console.warn("Error accessing editor storage for templates:", error);
      templateNames = [];
    }

    // Create format commands from template names
    const formatCommands: CommandItem[] = templateNames.map((templateName) => ({
      id: `format-${templateName}`,
      label: `Format as ${templateName}`,
      icon: getTemplateIcon(templateName),
      category: "format",
      action: "format",
      templateName: templateName,
    }));

    // Combine all commands
    const allCommands = [...formatCommands, ...baseCommands];

    if (!searchQuery || searchQuery.length === 0) {
      return allCommands;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allCommands.filter(
      cmd =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.id.toLowerCase().includes(lowerQuery)
    );
    console.log("Filtered commands:", filtered.length);
    return filtered;
  },

  render: () => {
    let reactRenderer: ReactRenderer;
    let popup: any[];

    return {
      onStart: (props: any) => {
        console.log("Slash command menu started", props);
        if (!props.clientRect) {
          console.warn("No clientRect provided for slash command");
          return;
        }

        // Create command handler that will be called when item is selected
        const commandHandler = (item: CommandItem) => {
          console.log("Slash command executed:", item, props);
          const { editor, range } = props;

          // Handle format commands - trigger actual formatting (not just insert text)
          if (item.action === "format" && item.templateName) {
            // Delete the slash command text
            if (editor && range) {
              try {
                editor.chain().focus().deleteRange(range).run();
              } catch (error) {
                console.error("Error deleting range:", error);
              }
            }
            // Dispatch format event to be handled by chat component
            setTimeout(() => {
              const event = new CustomEvent("slashCommand", {
                detail: { action: "format", templateName: item.templateName, item },
                bubbles: true,
                cancelable: true,
              });
              document.dispatchEvent(event);
              console.log("Dispatched format command event:", item.templateName);
            }, 0);
            return true;
          }

          // Handle action commands (these will be handled by the parent component via events)
          if (item.action) {
            console.log("Dispatching action command:", item.action);
            // Trigger a custom event that the parent can listen to
            // Use a small delay to ensure the DOM is ready
            setTimeout(() => {
              const event = new CustomEvent("slashCommand", {
                detail: { action: item.action, item },
                bubbles: true,
                cancelable: true,
              });
              document.dispatchEvent(event);
              console.log("Dispatched slashCommand event:", item.action);
            }, 0);
          }

          return true;
        };

        reactRenderer = new ReactRenderer(CommandList, {
          props: {
            items: props.items,
            command: commandHandler,
          },
          editor: props.editor,
        });

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
        console.log("Slash command popup created");
      },

      onUpdate(props: any) {
        if (reactRenderer) {
          reactRenderer.updateProps(props);
        }

        if (!props.clientRect || !popup || !popup[0]) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          if (popup && popup[0]) {
            popup[0].hide();
          }
          return true;
        }

        return reactRenderer?.ref?.onKeyDown(props);
      },

      onExit() {
        if (popup && popup[0]) {
          popup[0].destroy();
        }
        if (reactRenderer) {
          reactRenderer.destroy();
        }
      },

      command: (props: any) => {
        // This function is called by Tiptap to get the command handler
        // We'll create the handler in onStart where we have access to props
        // For now, return a no-op function - the real handler is set in onStart
        return () => {};
      },
    };
  },
};

export default suggestion;
