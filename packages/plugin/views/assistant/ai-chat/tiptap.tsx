import { useEditor, EditorContent, Editor, Range } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect, useCallback } from "react";
import { Mention } from "@tiptap/extension-mention";
import suggestion from "./suggestion";
import SlashCommand from "./slash-command";
import {
  addFileContext,
  addTagContext,
  addFolderContext,
} from "./use-context-items";
import { useVaultItems } from "./use-vault-items";
import { usePlugin } from "../provider";

interface TiptapProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  editorRef?: React.RefObject<Editor | null>;
}

interface MentionNodeAttrs {
  id: string;
  label: string;
  title: string;
  content: string;
  type: "file" | "tag" | "folder";
  path?: string;
}

const Tiptap: React.FC<TiptapProps> = ({
  value,
  onChange,
  onKeyDown,
  editorRef,
}) => {
  const plugin = usePlugin();
  const { files, folders, tags, loadFileContent } = useVaultItems();
  const [isEmpty, setIsEmpty] = React.useState(!value || value.trim() === "");

  const handleUpdate = useCallback(
    ({ editor }: { editor: any }) => {
      const content = editor.getText();
      setIsEmpty(!content || content.trim() === "");
      onChange(content);
    },
    [onChange]
  );

  const handleMentionCommand = async ({
    editor,
    range,
    props,
  }: {
    editor: Editor;
    range: Range;
    props: MentionNodeAttrs;
  }) => {
    // Load file content if it's a file mention
    if (props.type === "file") {
      const content = await loadFileContent(props.path);
      props.content = content || "";
    }

    // Insert mention in editor
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        {
          type: "mention",
          attrs: props,
        },
        {
          type: "text",
          text: " ",
        },
      ])
      .run();

    // Add to context based on type
    switch (props.type) {
      case "file":
        addFileContext({
          path: props.path,
          title: props.title,
          content: props.content,
        });
        break;

      case "tag":
        addTagContext(props.title, plugin.app);
        break;

      case "folder":
        addFolderContext(props.path, plugin.app);
        break;
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class:
            "bg-[--background-modifier-active-hover] text-[--text-accent]  px-1 py-0.5",
        },
        suggestion: {
          ...suggestion,
          decorationClass:
            "bg-[--background-modifier-active-hover] text-[--text-accent]  px-1 py-0.5",
          items: ({ query, editor }) => suggestion.items({ query, editor }),
          command: handleMentionCommand,
        },
      }),
      SlashCommand.configure({
        HTMLAttributes: {
          class: "slash-command",
        },
      }),
    ],
    content: value,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none",
        "data-placeholder":
          "Type @ to mention files, folders, or tags, or / for commands...",
      },
    },
  });

  // Update editor storage with available mentions
  useEffect(() => {
    if (editor) {
      editor.storage.mention = {
        files,
        folders,
        tags,
      };
    }
  }, [editor, files, folders, tags]);

  // Load template names and store in editor storage
  useEffect(() => {
    const loadTemplates = async () => {
      if (editor && plugin) {
        try {
          const templateNames = await plugin.getTemplateNames();
          editor.storage.templates = templateNames;
        } catch (error) {
          console.error("Error loading template names:", error);
          editor.storage.templates = [];
        }
      }
    };

    loadTemplates();
  }, [editor, plugin]);

  // Sync editor content with value prop
  useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(value);
      setIsEmpty(!value || value.trim() === "");
    }
  }, [value, editor]);

  // Expose editor via ref
  useEffect(() => {
    if (editor && editorRef) {
      (editorRef as React.MutableRefObject<Editor | null>).current = editor;
    }
  }, [editor, editorRef]);

  // Update isEmpty when editor content changes
  useEffect(() => {
    if (editor) {
      const updateIsEmpty = () => {
        const content = editor.getText();
        setIsEmpty(!content || content.trim() === "");
      };

      editor.on("update", updateIsEmpty);
      editor.on("selectionUpdate", updateIsEmpty);

      return () => {
        editor.off("update", updateIsEmpty);
        editor.off("selectionUpdate", updateIsEmpty);
      };
    }
  }, [editor]);

  return (
    <div className="tiptap-editor relative" onKeyDown={onKeyDown}>
      <EditorContent editor={editor} />
      {isEmpty && editor && (
        <div className="absolute left-[10px] top-[10px] pointer-events-none text-[--text-muted] text-sm select-none">
          Type @ to mention files, folders, or tags, or / for commands...
        </div>
      )}
    </div>
  );
};

export default Tiptap;
