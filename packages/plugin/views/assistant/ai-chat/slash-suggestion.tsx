import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import CommandList from "./command-list";
import {
  Bold,
  Italic,
  Code,
  Quote,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link,
  Trash2,
  Sparkles,
  Search,
  FileText,
  Settings,
  Zap,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: "formatting" | "action" | "ai";
  command?: string;
  args?: any;
  action?: string;
}

const allCommands: CommandItem[] = [
  // Formatting commands
  {
    id: "bold",
    label: "Bold",
    description: "Make text bold",
    icon: <Bold className="w-4 h-4" />,
    category: "formatting",
    command: "toggleBold",
  },
  {
    id: "italic",
    label: "Italic",
    description: "Make text italic",
    icon: <Italic className="w-4 h-4" />,
    category: "formatting",
    command: "toggleItalic",
  },
  {
    id: "code",
    label: "Inline Code",
    description: "Add inline code",
    icon: <Code className="w-4 h-4" />,
    category: "formatting",
    command: "toggleCode",
  },
  {
    id: "codeblock",
    label: "Code Block",
    description: "Add a code block",
    icon: <Code className="w-4 h-4" />,
    category: "formatting",
    command: "toggleCodeBlock",
  },
  {
    id: "quote",
    label: "Quote",
    description: "Add a blockquote",
    icon: <Quote className="w-4 h-4" />,
    category: "formatting",
    command: "toggleBlockquote",
  },
  {
    id: "heading1",
    label: "Heading 1",
    description: "Large heading",
    icon: <Heading1 className="w-4 h-4" />,
    category: "formatting",
    command: "toggleHeading",
    args: { level: 1 },
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Medium heading",
    icon: <Heading2 className="w-4 h-4" />,
    category: "formatting",
    command: "toggleHeading",
    args: { level: 2 },
  },
  {
    id: "list",
    label: "Bullet List",
    description: "Create a bullet list",
    icon: <List className="w-4 h-4" />,
    category: "formatting",
    command: "toggleBulletList",
  },
  {
    id: "numbered",
    label: "Numbered List",
    description: "Create a numbered list",
    icon: <ListOrdered className="w-4 h-4" />,
    category: "formatting",
    command: "toggleOrderedList",
  },
  {
    id: "link",
    label: "Link",
    description: "Add a link",
    icon: <Link className="w-4 h-4" />,
    category: "formatting",
    command: "setLink",
  },
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
  {
    id: "attach",
    label: "Attach File",
    description: "Attach a file to context",
    icon: <FileText className="w-4 h-4" />,
    category: "action",
    action: "attach",
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
  items: ({ query }: { query: string; editor?: any }) => {
    console.log("Slash command items requested, query:", query);
    if (!query || query.length === 0) {
      return allCommands;
    }

    const lowerQuery = query.toLowerCase();
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

          // Handle formatting commands
          if (item.command) {
            try {
              // Delete the slash command text first, then apply formatting
              if (item.command === "toggleHeading") {
                // For headings, delete slash, then set heading
                if (item.args?.level) {
                  editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setHeading({ level: item.args.level })
                    .insertContent(" ")
                    .run();
                }
              } else if (item.command === "toggleCodeBlock") {
                // For code blocks, delete slash, then toggle code block
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleCodeBlock()
                  .run();
              } else if (item.command === "toggleBlockquote") {
                // For blockquotes, delete slash, then toggle blockquote
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBlockquote()
                  .run();
              } else if (item.command === "toggleBulletList") {
                // For lists, delete slash, then toggle list
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBulletList()
                  .run();
              } else if (item.command === "toggleOrderedList") {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleOrderedList()
                  .run();
              } else if (item.command === "setLink") {
                // For links, delete slash, insert placeholder
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent("[link text](url)")
                  .run();
                // Select "link text" for easy editing
                const pos = editor.state.selection.from;
                editor.commands.setTextSelection({
                  from: pos - 9,
                  to: pos - 1,
                });
              } else {
                // For inline formatting (bold, italic, code)
                // Delete the slash command, toggle the format, and insert placeholder text
                const chain = editor.chain().focus().deleteRange(range);

                // Apply the formatting command
                if (item.args) {
                  chain[item.command](item.args);
                } else {
                  chain[item.command]();
                }

                // Insert placeholder text that will be formatted
                // The user can immediately start typing to replace it
                const placeholder =
                  item.command === "toggleBold"
                    ? "bold text"
                    : item.command === "toggleItalic"
                    ? "italic text"
                    : item.command === "toggleCode"
                    ? "code"
                    : "text";

                chain.insertContent(placeholder).run();

                // Select the placeholder so user can immediately type to replace it
                const pos = editor.state.selection.from;
                const start = pos - placeholder.length;
                editor.commands.setTextSelection({ from: start, to: pos });
              }
            } catch (error) {
              console.error("Error executing formatting command:", error, item);
            }
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
        reactRenderer.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }

        return reactRenderer.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        reactRenderer.destroy();
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
