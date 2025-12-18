import { useEffect, useState, useRef } from "react";
import { App, MarkdownView, EditorPosition, EditorSelection } from "obsidian";

export interface EditorSelectionContext {
  selectedText: string;
  cursorPosition: EditorPosition | null;
  currentLine: string;
  lineNumber: number;
  hasSelection: boolean;
  filePath: string | null;
  fileName: string | null;
  selection: EditorSelection | null;
}

const EMPTY_CONTEXT: EditorSelectionContext = {
  selectedText: "",
  cursorPosition: null,
  currentLine: "",
  lineNumber: 0,
  hasSelection: false,
  filePath: null,
  fileName: null,
  selection: null,
};

export interface EditorSelectionResult {
  current: EditorSelectionContext;
  frozen: EditorSelectionContext;
  clearFrozen: () => void;
}

/**
 * Hook to track the current editor selection and context
 *
 * This hook listens to editor changes and keeps track of:
 * - Selected text
 * - Cursor position
 * - Current line content
 * - File information
 *
 * Returns two contexts:
 * - `current`: Real-time context (clears when editor loses focus)
 * - `frozen`: Snapshot of last selection (persists even after blur)
 *
 * The frozen context solves the problem where clicking the chat input
 * clears the editor selection before the AI can use it.
 *
 * This enables the AI to understand what "this" refers to when users say:
 * - "make this more concise"
 * - "fix grammar in this"
 * - "rewrite this paragraph"
 */
export function useEditorSelection(app: App): EditorSelectionResult {
  const [currentContext, setCurrentContext] = useState<EditorSelectionContext>(EMPTY_CONTEXT);
  const [frozenContext, setFrozenContext] = useState<EditorSelectionContext>(EMPTY_CONTEXT);
  const [isManuallyCleared, setIsManuallyCleared] = useState(false);

  const clearFrozen = () => {
    setFrozenContext(EMPTY_CONTEXT);
    setIsManuallyCleared(true);
  };

  useEffect(() => {
    const updateContext = () => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);

      if (!view || !view.editor) {
        setCurrentContext(EMPTY_CONTEXT);
        return;
      }

      const editor = view.editor;
      const file = view.file;

      try {
        // Get selection
        const selectedText = editor.getSelection();
        const hasSelection = selectedText.length > 0;

        // Get cursor position
        const cursorPosition = editor.getCursor();
        const lineNumber = cursorPosition.line;
        const currentLine = editor.getLine(lineNumber);

        // Get selection range
        const selection = hasSelection
          ? {
              anchor: editor.getCursor("from"),
              head: editor.getCursor("to"),
            }
          : null;

        const newContext: EditorSelectionContext = {
          selectedText,
          cursorPosition,
          currentLine,
          lineNumber,
          hasSelection,
          filePath: file?.path || null,
          fileName: file?.basename || null,
          selection,
        };

        setCurrentContext(newContext);

        // Freeze snapshot when there's a selection
        // This preserves the selection even when editor loses focus
        // Clear frozen context when there's no selection (user moved cursor)
        // Reset manual clear flag when user makes a NEW selection (different from cleared one)
        if (hasSelection) {
          // Check if this is a different selection than what was frozen
          const isDifferentSelection =
            !frozenContext.hasSelection ||
            frozenContext.selectedText !== newContext.selectedText ||
            frozenContext.filePath !== newContext.filePath ||
            (frozenContext.selection?.anchor.line !== newContext.selection?.anchor.line) ||
            (frozenContext.selection?.anchor.ch !== newContext.selection?.anchor.ch) ||
            (frozenContext.selection?.head.line !== newContext.selection?.head.line) ||
            (frozenContext.selection?.head.ch !== newContext.selection?.head.ch);

          if (isManuallyCleared) {
            // Only re-freeze if this is a NEW selection (different from what was cleared)
            if (isDifferentSelection) {
              setIsManuallyCleared(false);
              setFrozenContext(newContext);
            }
            // If it's the same selection, keep it cleared (don't re-freeze)
          } else {
            // Normal case: update frozen context with new selection
            setFrozenContext(newContext);
          }
        } else {
          setFrozenContext(EMPTY_CONTEXT);
          setIsManuallyCleared(false);
        }
      } catch (error) {
        console.error("Error getting editor context:", error);
        setCurrentContext(EMPTY_CONTEXT);
      }
    };

    // Update immediately on mount
    updateContext();

    // Use requestAnimationFrame for real-time selection tracking
    // This polls the editor selection continuously while component is mounted
    let rafId: number;
    const pollSelection = () => {
      updateContext();
      rafId = requestAnimationFrame(pollSelection);
    };

    // Start polling
    rafId = requestAnimationFrame(pollSelection);

    // Listen to editor changes (for document content)
    const editorChangeRef = app.workspace.on("editor-change", () => {
      updateContext();
    });

    // Listen to active leaf changes (when switching files/panes)
    const activeLeafChangeRef = app.workspace.on("active-leaf-change", () => {
      updateContext();
    });

    // Listen to file opens
    const fileOpenRef = app.workspace.on("file-open", () => {
      updateContext();
    });

    // Cleanup
    return () => {
      // Cancel animation frame polling
      cancelAnimationFrame(rafId);

      app.workspace.offref(editorChangeRef);
      app.workspace.offref(activeLeafChangeRef);
      app.workspace.offref(fileOpenRef);
    };
  }, [app, isManuallyCleared]);

  return {
    current: currentContext,
    frozen: frozenContext,
    clearFrozen,
  };
}

/**
 * Format the editor context for inclusion in AI chat messages
 * This creates a structured representation that the AI can understand
 */
export function formatEditorContextForAI(context: EditorSelectionContext): string {
  // Only return empty if there's no selection AND no file
  if (!context.hasSelection && !context.filePath) {
    return "";
  }

  const parts: string[] = [];

  // Add file context
  parts.push(`<editor_context>`);
  if (context.fileName) {
    parts.push(`<file>${context.fileName}</file>`);
  }
  if (context.filePath) {
    parts.push(`<path>${context.filePath}</path>`);
  }

  // Add selection or cursor context
  if (context.hasSelection && context.selectedText) {
    const lineRange =
      context.selection?.anchor && context.selection?.head
        ? `lines ${context.selection.anchor.line + 1}-${context.selection.head.line + 1}`
        : `line ${context.lineNumber + 1}`;

    parts.push(`<selection>`);
    parts.push(`<range>${lineRange}</range>`);
    parts.push(`<text>`);
    parts.push(context.selectedText);
    parts.push(`</text>`);
    parts.push(`</selection>`);
  } else if (context.currentLine) {
    parts.push(`<cursor>`);
    parts.push(`<line_number>${context.lineNumber + 1}</line_number>`);
    parts.push(`<line_content>${context.currentLine}</line_content>`);
    parts.push(`</cursor>`);
  }

  parts.push(`</editor_context>`);

  return parts.join("\n");
}
