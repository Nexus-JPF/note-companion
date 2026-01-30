import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useChat, UseChatOptions } from "@ai-sdk/react";
import { moment, Notice, MarkdownView } from "obsidian";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Send, Square, Bot } from "lucide-react";
import { StyledContainer } from "@/components/ui/utils";
import { Editor } from "@tiptap/react";

import FileOrganizer from "../../..";
import { GroundingMetadata, DataChunk } from "./types/grounding";
import Tiptap from "./tiptap";
import { usePlugin } from "../provider";

import { logMessage } from "../../../someUtils";
import { MessageRenderer } from "./message-renderer";
import ToolInvocationHandler from "./tool-handlers/tool-invocation-handler";
import { convertToCoreMessages, streamText, ToolInvocation, Message } from "ai";
import { ollama } from "ollama-ai-provider";
import { SourcesSection } from "./components/SourcesSection";
import { ContextLimitIndicator } from "./context-limit-indicator";
import { ModelSelector } from "./model-selector";
import { ModelType } from "./types";
import { AudioRecorder } from "./audio-recorder";
import { logger } from "../../../services/logger";
import { SubmitButton } from "./submit-button";
import {
  getUniqueReferences,
  useContextItems,
  clearEphemeralContext,
} from "./use-context-items";
import { ContextItems } from "./components/context-items";
import { useCurrentFile } from "./hooks/use-current-file";
import { SearchAnnotationHandler } from "./tool-handlers/search-annotation-handler";
import {
  isSearchResultsAnnotation,
  SearchResultsAnnotation,
} from "./types/annotations";
import { ExamplePrompts } from "./components/example-prompts";
import { AttachmentHandler } from "./components/attachment-handler";
import { LocalAttachment } from "./types/attachments";
import {
  useEditorSelection,
  formatEditorContextForAI,
  EditorSelectionContext,
} from "./use-editor-selection";
import { EditorContextBadge } from "./components/editor-context-badge";
import {
  ChatHistoryManager,
  ChatSession,
} from "./services/chat-history-manager";
import { ChatHistoryCombobox } from "./components/chat-history-combobox";

interface ChatComponentProps {
  plugin: FileOrganizer;
  apiKey: string;
  inputRef: React.RefObject<HTMLDivElement>;
  onTokenLimitError?: (error: string) => void;
  activeChatId: string | null;
  onSessionUpdate?: (session: ChatSession) => void;
  chatSessions?: ChatSession[];
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  apiKey,
  inputRef,
  onTokenLimitError,
  activeChatId,
  onSessionUpdate,
  chatSessions = [],
  onSelectChat,
  onDeleteChat,
}) => {
  const plugin = usePlugin();
  const app = plugin.app;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat history manager instance
  const chatHistoryManager = useMemo(
    () => ChatHistoryManager.getInstance(plugin.app),
    [plugin.app]
  );

  // Ref to access Tiptap editor
  const tiptapEditorRef = useRef<Editor | null>(null);

  // Exact context used when generating each assistant message
  // Keyed by message ID (from onFinish) for reliable lookup
  const contextByAssistantIdRef = useRef<Record<string, string>>({});

  // Context used by the most recent request (so onFinish can store it)
  const lastContextSentRef = useRef<string>("");

  // If reload({ body }) is supported, this stages the exact body to use for reload
  interface ReloadBody {
    currentDatetime: string;
    model: string;
    enableSearchGrounding: boolean;
    deepSearch: boolean;
    newUnifiedContext: string;
  }
  const forcedReloadBodyRef = useRef<ReloadBody | null>(null);

  // Ref to track latest messages for onFinish (to avoid stale closure)
  const messagesRef = useRef<Message[]>([]);

  // Ref to track if we're currently loading a session (to prevent save on load)
  const isLoadingSessionRef = useRef<boolean>(false);

  // Ref to store onSessionUpdate callback to avoid dependency issues
  const onSessionUpdateRef = useRef(onSessionUpdate);
  onSessionUpdateRef.current = onSessionUpdate;

  // Ref to store activeChatId to access it in callbacks
  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const {
    setCurrentFile,
    files,
    folders,
    tags,
    searchResults,
    currentFile,
    youtubeVideos,
    textSelections,
    isLightweightMode,
  } = useContextItems();

  const uniqueReferences = getUniqueReferences();
  logger.debug("uniqueReferences", uniqueReferences);

  // Track editor selection for contextual understanding
  // Uses frozen context to preserve selection even when chat input gets focus
  const {
    current: currentEditorContext,
    frozen: frozenEditorContext,
    clearFrozen,
  } = useEditorSelection(app);

  const editorContext = frozenEditorContext;

  const contextItems = {
    files,
    folders,
    tags,
    currentFile,
    youtubeVideos,
    searchResults,
    textSelections,
  };

  // Track if chat has started (will be computed after useChat hook)
  const [chatHasStarted, setChatHasStarted] = useState(false);

  const contextString = React.useMemo(() => {
    if (isLightweightMode) {
      // In lightweight mode, only include metadata
      const lightweightContext = {
        files: Object.fromEntries(
          Object.entries(files).map(([id, file]) => [
            id,
            { ...file, content: "" },
          ])
        ),
        folders: Object.fromEntries(
          Object.entries(folders).map(([id, folder]) => [
            id,
            {
              ...folder,
              files: folder.files.map(f => ({ ...f, content: "" })),
            },
          ])
        ),
        tags: Object.fromEntries(
          Object.entries(tags).map(([id, tag]) => [
            id,
            { ...tag, files: tag.files.map(f => ({ ...f, content: "" })) },
          ])
        ),
        searchResults: Object.fromEntries(
          Object.entries(searchResults).map(([id, search]) => [
            id,
            {
              ...search,
              results: search.results.map(r => ({ ...r, content: "" })),
            },
          ])
        ),
        youtubeVideos: Object.fromEntries(
          Object.entries(youtubeVideos).map(([id, video]) => [
            id,
            { ...video, transcript: "" }, // Remove transcript in lightweight mode
          ])
        ),
        // Keep these as is
        currentFile: currentFile ? { ...currentFile, content: "" } : null,

        textSelections,
      };
      return JSON.stringify(lightweightContext);
    }
    return JSON.stringify(contextItems);
  }, [contextItems, isLightweightMode]);
  logger.debug("contextString", contextString);

  const [selectedModel, setSelectedModel] = useState<ModelType>(
    plugin.settings.selectedModel
  );

  // Format editor context for AI - MEMOIZED to prevent infinite loop
  const editorContextString = React.useMemo(
    () => formatEditorContextForAI(editorContext),
    [editorContext.selectedText, editorContext.filePath] // Only recalc when selection or file changes
  );

  // Combine vault context with editor context - MEMOIZED
  const fullContext = React.useMemo(
    () =>
      editorContextString
        ? `${contextString}\n\n${editorContextString}`
        : contextString,
    [contextString, editorContextString]
  );

  // Calculate datetime ONCE per component mount, not on every render
  const currentDatetime = React.useMemo(
    () => window.moment().format("YYYY-MM-DDTHH:mm:ssZ"),
    [] // Empty deps = only calculate once
  );

  // MEMOIZE chatBody to prevent infinite loop from RAF updates
  const chatBody = React.useMemo(
    () => ({
      currentDatetime,
      newUnifiedContext: fullContext,
      model: plugin.settings.selectedModel,
      enableSearchGrounding:
        plugin.settings.enableSearchGrounding ||
        selectedModel === "gpt-4o-search-preview" ||
        selectedModel === "gpt-4o-mini-search-preview",
      deepSearch: plugin.settings.enableDeepSearch,
    }),
    [
      currentDatetime,
      fullContext,
      plugin.settings.selectedModel,
      plugin.settings.enableSearchGrounding,
      plugin.settings.enableDeepSearch,
      selectedModel,
    ]
  );

  const [groundingMetadata, setGroundingMetadata] =
    useState<GroundingMetadata | null>(null);

  const {
    status,
    messages,
    input,
    handleInputChange,
    handleSubmit,
    stop,
    addToolResult,
    error,
    reload,
    setMessages,
  } = useChat({
    // Use prepareRequestBody to ensure context is always included, even after tool results
    // Read context fresh from Zustand store each time to ensure it's up-to-date after tool results
    prepareRequestBody: ({ messages }) => {
      console.log(
        "[Chat] prepareRequestBody called with messages:",
        messages.length,
        "message roles:",
        messages.map(m => m.role),
        "last message content preview:",
        messages.length > 0
          ? messages[messages.length - 1].content.substring(0, 100)
          : "none",
        "prepareRequestBody called"
      );
      // Read directly from Zustand store to get latest values (not from closure)
      const store = useContextItems.getState();
      const freshContextItems = {
        files: store.files || {},
        folders: store.folders || {},
        tags: store.tags || {},
        currentFile: store.currentFile || null,
        youtubeVideos: store.youtubeVideos || {}, // CRITICAL: Ensure youtubeVideos is always an object
        searchResults: store.searchResults || {},
        textSelections: store.textSelections || {},
      };

      // Debug: Log store state
      console.log("[Chat] prepareRequestBody - Store state:", {
        hasYoutubeVideos: !!store.youtubeVideos,
        youtubeVideosType: typeof store.youtubeVideos,
        youtubeVideosKeys: store.youtubeVideos
          ? Object.keys(store.youtubeVideos)
          : [],
        allStoreKeys: Object.keys(store),
      });

      // Ensure youtubeVideos is always an object (defensive)
      if (
        !freshContextItems.youtubeVideos ||
        typeof freshContextItems.youtubeVideos !== "object"
      ) {
        console.warn(
          "[Chat] prepareRequestBody: youtubeVideos is not an object, fixing it:",
          {
            type: typeof freshContextItems.youtubeVideos,
            value: freshContextItems.youtubeVideos,
          }
        );
        freshContextItems.youtubeVideos = {};
      }

      const freshContextString = store.isLightweightMode
        ? JSON.stringify({
            files: Object.fromEntries(
              Object.entries(freshContextItems.files).map(([id, file]) => [
                id,
                { ...file, content: "" },
              ])
            ),
            folders: Object.fromEntries(
              Object.entries(freshContextItems.folders).map(([id, folder]) => [
                id,
                {
                  ...folder,
                  files: folder.files.map(f => ({ ...f, content: "" })),
                },
              ])
            ),
            tags: Object.fromEntries(
              Object.entries(freshContextItems.tags).map(([id, tag]) => [
                id,
                { ...tag, files: tag.files.map(f => ({ ...f, content: "" })) },
              ])
            ),
            searchResults: Object.fromEntries(
              Object.entries(freshContextItems.searchResults).map(
                ([id, search]) => [
                  id,
                  {
                    ...search,
                    results: search.results.map(r => ({ ...r, content: "" })),
                  },
                ]
              )
            ),
            youtubeVideos: Object.fromEntries(
              Object.entries(freshContextItems.youtubeVideos).map(
                ([id, video]) => [id, { ...video, transcript: "" }]
              )
            ),
            currentFile: freshContextItems.currentFile
              ? { ...freshContextItems.currentFile, content: "" }
              : null,
            textSelections: freshContextItems.textSelections,
          })
        : JSON.stringify(freshContextItems);

      // Get fresh editor context directly from app (not from closure)
      // This ensures we get the latest editor selection even after refresh
      let freshEditorContext: string = "";
      try {
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          const editor = view.editor;
          const file = view.file;
          const selectedText = editor.getSelection();
          const hasSelection = selectedText.length > 0;
          const cursorPosition = editor.getCursor();
          const lineNumber = cursorPosition.line;
          const currentLine = editor.getLine(lineNumber);
          const selection = hasSelection
            ? {
                anchor: editor.getCursor("from"),
                head: editor.getCursor("to"),
              }
            : null;

          const editorContextForAI: EditorSelectionContext = {
            selectedText,
            cursorPosition,
            currentLine,
            lineNumber,
            hasSelection,
            filePath: file?.path || null,
            fileName: file?.basename || null,
            selection,
          };

          freshEditorContext = formatEditorContextForAI(editorContextForAI);
        }
      } catch (error) {
        console.warn("[Chat] Failed to get fresh editor context:", error);
        // Fallback to frozen context if reading fresh fails
        freshEditorContext = formatEditorContextForAI(editorContext);
      }

      const freshFullContext = freshEditorContext
        ? `${freshContextString}\n\n${freshEditorContext}`
        : freshContextString;

      // prepareRequestBody is only called for normal requests, not reload({ body })
      // So we just use fresh context here
      const contextToSend = freshFullContext;

      // Save for onFinish snapshotting
      lastContextSentRef.current = contextToSend;

      console.log(
        "[Chat] prepareRequestBody: Saved context for snapshotting, length:",
        contextToSend.length
      );
      const hasYouTube =
        Object.keys(freshContextItems.youtubeVideos).length > 0;
      const contextStringLength = freshContextString.length;
      console.log("[Chat] prepareRequestBody - Context summary:", {
        messagesCount: messages.length,
        hasYouTube,
        youtubeVideoCount: Object.keys(freshContextItems.youtubeVideos).length,
        youtubeVideoIds: Object.keys(freshContextItems.youtubeVideos),
        contextStringLength,
        isLightweightMode: store.isLightweightMode,
        hasEditorContext: !!freshEditorContext,
        hasFiles: Object.keys(freshContextItems.files).length > 0,
        filesCount: Object.keys(freshContextItems.files).length,
        hasFolders: Object.keys(freshContextItems.folders).length > 0,
        foldersCount: Object.keys(freshContextItems.folders).length,
        hasTags: Object.keys(freshContextItems.tags).length > 0,
        tagsCount: Object.keys(freshContextItems.tags).length,
        hasSearchResults:
          Object.keys(freshContextItems.searchResults).length > 0,
        searchResultsCount: Object.keys(freshContextItems.searchResults).length,
        hasCurrentFile: !!freshContextItems.currentFile,
        contextPreview: freshContextString.substring(0, 200),
      });

      if (hasYouTube) {
        // Log first video details
        const firstVideo = Object.values(
          freshContextItems.youtubeVideos
        )[0] as any;
        console.log("[Chat] First YouTube video:", {
          id: firstVideo?.id,
          title: firstVideo?.title,
          transcriptLength: firstVideo?.transcript?.length || 0,
          videoId: firstVideo?.videoId,
        });
      } else {
        // Log when YouTube videos are missing
        console.warn(
          "[Chat] prepareRequestBody: No YouTube videos in context!",
          {
            storeYoutubeVideos: Object.keys(store.youtubeVideos),
            freshContextItemsYoutubeVideos: Object.keys(
              freshContextItems.youtubeVideos
            ),
            allStoreKeys: Object.keys(store),
          }
        );
      }

      // Log the actual JSON being sent (first 500 chars of context)
      const requestBody = {
        messages,
        currentDatetime,
        newUnifiedContext: contextToSend,
        model: plugin.settings.selectedModel,
        enableSearchGrounding:
          plugin.settings.enableSearchGrounding ||
          selectedModel === "gpt-4o-search-preview" ||
          selectedModel === "gpt-4o-mini-search-preview",
        deepSearch: plugin.settings.enableDeepSearch,
      };

      // Parse the newUnifiedContext to verify YouTube videos are included
      try {
        const contextJson = JSON.parse(freshContextString);
        console.log("[Chat] Context JSON being sent:", {
          hasYoutubeVideos: !!(
            contextJson.youtubeVideos &&
            Object.keys(contextJson.youtubeVideos).length > 0
          ),
          youtubeVideoCount: contextJson.youtubeVideos
            ? Object.keys(contextJson.youtubeVideos).length
            : 0,
          allKeys: Object.keys(contextJson),
        });
      } catch (e) {
        console.error("[Chat] Failed to parse context JSON:", e);
      }

      return JSON.stringify(requestBody);
    },
    onDataChunk: (chunk: DataChunk) => {
      if (chunk.type === "metadata" && chunk.data?.groundingMetadata) {
        setGroundingMetadata(chunk.data.groundingMetadata);
      }
    },
    maxSteps: 5,
    api: `${plugin.getServerUrl()}/api/chat`,
    experimental_throttle: 100,
    headers: (() => {
      const apiKey = plugin.getApiKey()?.trim();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Only include Authorization header if API key is valid
      if (apiKey && apiKey.length > 0) {
        headers.Authorization = `Bearer ${apiKey}`;
      } else {
        console.warn(
          "[Chat] API key is missing or empty, requests will fail authentication"
        );
      }

      return headers;
    })(),
    fetch: async (url, options) => {
      logMessage(plugin.settings.showLocalLLMInChat, "showLocalLLMInChat");
      logMessage(selectedModel, "selectedModel");

      // Handle different model types
      if (!plugin.settings.showLocalLLMInChat || selectedModel === "gpt-4o") {
        // Use server fetch for non-local models
        return fetch(url, options);
      }

      // Handle local models (llama3.2 or custom)
      const { messages, newUnifiedContext, currentDatetime } = JSON.parse(
        options.body as string
      );
      logger.debug("local model context", {
        model: selectedModel,
        contextLength: newUnifiedContext.length,
        contextPreview: newUnifiedContext.slice(0, 200),
        messageCount: messages.length,
      });
      const result = await streamText({
        model: ollama(selectedModel),
        system: `
          ${newUnifiedContext},
          currentDatetime: ${currentDatetime},
          `,
        messages: convertToCoreMessages(messages),
      });

      return result.toDataStreamResponse();
    },
    onToolCall({ toolCall }) {
      logMessage("toolCall", toolCall);
    },
    keepLastMessageOnError: true,
    onError: error => {
      logger.error("Chat error:", error);
      logger.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });

      // Check for authentication errors
      if (
        error.message?.includes("Unauthorized") ||
        error.message?.includes("401") ||
        error.message?.includes("Authorization")
      ) {
        const apiKey = plugin.getApiKey()?.trim();
        if (!apiKey || apiKey.length === 0) {
          new Notice(
            "Authentication failed: API key is missing. Please set your API key in plugin settings.",
            5000
          );
        } else {
          new Notice(
            "Authentication failed: Invalid API key. Please check your API key in plugin settings.",
            5000
          );
        }
        return;
      }

      // Check if this is a tool invocation error (non-fatal)
      const isToolError = error.message?.includes(
        "ToolInvocation must have a result"
      );

      if (isToolError) {
        // Don't suppress tool errors - let them appear as messages
        // Just log it and continue without blocking the UI
        logger.warn("Tool invocation error detected, displaying as message...");
        return;
      }

      let userFriendlyMessage = "Something went wrong. Please try again.";

      // Check error type first (more reliable than message content)
      if (error.name === "TypeError" && error.message?.includes("fetch")) {
        // This is a real network/fetch error
        userFriendlyMessage =
          "Connection failed. Please check your internet connection.";
      } else if (error.message?.toLowerCase().includes("api key")) {
        userFriendlyMessage =
          "API key issue detected. Please check your settings.";
      } else if (
        error.message?.toLowerCase().includes("unauthorized") ||
        error.message?.toLowerCase().includes("401")
      ) {
        userFriendlyMessage =
          "Authentication failed. Please check your API key in settings.";
      } else if (
        error.message?.toLowerCase().includes("forbidden") ||
        error.message?.toLowerCase().includes("403")
      ) {
        userFriendlyMessage =
          "Access denied. Please check your subscription status.";
      } else if (
        error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("fetch")
      ) {
        userFriendlyMessage =
          "Connection failed. Please check your internet connection.";
      } else if (
        error.message?.toLowerCase().includes("token limit exceeded") ||
        error.message?.toLowerCase().includes("credits limit exceeded")
      ) {
        // Show the full error message for token limit - it includes usage details
        userFriendlyMessage = error.message;
        // Notify parent component to show upgrade button
        onTokenLimitError?.(error.message);
      } else if (
        error.message?.toLowerCase().includes("rate limit") ||
        error.message?.toLowerCase().includes("429")
      ) {
        userFriendlyMessage =
          "Rate limit reached. Please wait a moment and try again.";
      } else if (
        error.message?.toLowerCase().includes("timeout") ||
        error.message?.toLowerCase().includes("timed out")
      ) {
        userFriendlyMessage = "Request timed out. Please try again.";
      } else if (
        error.message?.toLowerCase().includes("500") ||
        error.message?.toLowerCase().includes("internal server error")
      ) {
        userFriendlyMessage =
          "Server error occurred. Please try again in a moment.";
      } else if (error.message?.toLowerCase().includes("cors")) {
        userFriendlyMessage =
          "CORS error. Please check your server URL configuration.";
      } else if (error.message) {
        // If we have a specific error message, show it fully (don't truncate)
        userFriendlyMessage = error.message;
      }

      setErrorMessage(userFriendlyMessage);
    },
    onFinish: message => {
      // Store the exact context that produced THIS assistant message
      // Store by message ID directly (we have it in onFinish, no need to find index)
      console.log("[Chat] onFinish called:", {
        messageId: message?.id,
        messageRole: message?.role,
        lastContextLength: lastContextSentRef.current?.length ?? 0,
        lastContextIsEmpty:
          !lastContextSentRef.current ||
          lastContextSentRef.current.length === 0,
        hasLastContext: !!lastContextSentRef.current,
      });

      if (message?.id && message.role === "assistant") {
        // If lastContextSentRef is empty, try to get context from the store as fallback
        // This handles the case where prepareRequestBody wasn't called or ref was cleared
        let contextToStore = lastContextSentRef.current;

        if (!contextToStore || contextToStore.length === 0) {
          console.warn(
            "[Chat] ⚠️ onFinish: lastContextSentRef is empty, trying to get fresh context from store"
          );
          // Fallback: get fresh context from store
          const store = useContextItems.getState();
          const freshContextItems = {
            files: store.files || {},
            folders: store.folders || {},
            tags: store.tags || {},
            currentFile: store.currentFile || null,
            youtubeVideos: store.youtubeVideos || {},
            searchResults: store.searchResults || {},
            textSelections: store.textSelections || {},
          };
          const freshContextString = store.isLightweightMode
            ? JSON.stringify({
                files: Object.fromEntries(
                  Object.entries(freshContextItems.files).map(([id, file]) => [
                    id,
                    { ...file, content: "" },
                  ])
                ),
                folders: Object.fromEntries(
                  Object.entries(freshContextItems.folders).map(
                    ([id, folder]) => [
                      id,
                      {
                        ...folder,
                        files: folder.files.map(f => ({ ...f, content: "" })),
                      },
                    ]
                  )
                ),
                tags: Object.fromEntries(
                  Object.entries(freshContextItems.tags).map(([id, tag]) => [
                    id,
                    {
                      ...tag,
                      files: tag.files.map(f => ({ ...f, content: "" })),
                    },
                  ])
                ),
                searchResults: Object.fromEntries(
                  Object.entries(freshContextItems.searchResults).map(
                    ([id, search]) => [
                      id,
                      {
                        ...search,
                        results: search.results.map(r => ({
                          ...r,
                          content: "",
                        })),
                      },
                    ]
                  )
                ),
                youtubeVideos: Object.fromEntries(
                  Object.entries(freshContextItems.youtubeVideos).map(
                    ([id, video]) => [id, { ...video, transcript: "" }]
                  )
                ),
                currentFile: freshContextItems.currentFile
                  ? { ...freshContextItems.currentFile, content: "" }
                  : null,
                textSelections: freshContextItems.textSelections,
              })
            : JSON.stringify(freshContextItems);

          // Get editor context
          let freshEditorContext = "";
          try {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view && view.editor) {
              const editor = view.editor;
              const file = view.file;
              const selectedText = editor.getSelection();
              const hasSelection = selectedText.length > 0;
              const cursorPosition = editor.getCursor();
              const lineNumber = cursorPosition.line;
              const currentLine = editor.getLine(lineNumber);
              const selection = hasSelection
                ? {
                    anchor: editor.getCursor("from"),
                    head: editor.getCursor("to"),
                  }
                : null;

              const editorContextForAI: EditorSelectionContext = {
                selectedText,
                cursorPosition,
                currentLine,
                lineNumber,
                hasSelection,
                filePath: file?.path || null,
                fileName: file?.basename || null,
                selection,
              };

              freshEditorContext = formatEditorContextForAI(editorContextForAI);
            }
          } catch (error) {
            console.warn(
              "[Chat] Failed to get editor context in onFinish:",
              error
            );
          }

          contextToStore = freshEditorContext
            ? `${freshContextString}\n\n${freshEditorContext}`
            : freshContextString;
        }

        if (contextToStore && contextToStore.length > 0) {
          // Store by message ID - this is the most reliable way
          contextByAssistantIdRef.current[message.id] = contextToStore;
          console.log(
            "[Chat] ✅ Stored context snapshot for assistant message:",
            message.id,
            "context length:",
            contextToStore.length
          );
        } else {
          console.error("[Chat] ❌ onFinish: Could not get context to store!", {
            messageId: message.id,
            lastContextLength: lastContextSentRef.current?.length ?? 0,
            fallbackContextLength: contextToStore?.length ?? 0,
          });
        }

        // After storing context, ensure messages are saved
        // Use a longer delay to ensure messages are fully added to the array
        setTimeout(() => {
          const currentActiveChatId = activeChatIdRef.current;

          // Ensure we have an active chat session
          if (!currentActiveChatId) {
            console.warn(
              "[Chat] onFinish: No activeChatId, cannot save messages"
            );
            return;
          }

          // Get the latest messages from ref (should be updated by now)
          const currentMessages = messagesRef.current;

          console.log("[Chat] onFinish: Attempting to save", {
            activeChatId: currentActiveChatId,
            messagesCount: currentMessages.length,
            messageIds: currentMessages.map(m => m.id),
          });

          if (currentMessages.length > 0) {
            let session = chatHistoryManager.getSession(currentActiveChatId);
            let sessionId = currentActiveChatId;

            // If session doesn't exist, try to find the most recent session or create a new one
            if (!session) {
              console.warn(
                "[Chat] onFinish: Session not found for activeChatId:",
                currentActiveChatId,
                "- checking for existing sessions"
              );

              // Try to get the most recent session
              const allSessions = chatHistoryManager.getAllSessions();
              if (allSessions.length > 0) {
                // Use the most recent session
                session = allSessions[0];
                sessionId = session.id;
                activeChatIdRef.current = sessionId;
                console.log(
                  "[Chat] onFinish: Using most recent session:",
                  sessionId
                );
              } else {
                // Create a new session if none exist
                console.warn(
                  "[Chat] onFinish: No sessions found, creating new session"
                );
                session = chatHistoryManager.createSession();
                sessionId = session.id;
                activeChatIdRef.current = sessionId;
                console.log("[Chat] onFinish: Created new session:", sessionId);
              }
            }

            if (session) {
              // Store context snapshots
              const messageContextSnapshots: Record<string, string> = {};
              currentMessages.forEach(msg => {
                if (
                  msg.role === "assistant" &&
                  msg.id &&
                  contextByAssistantIdRef.current[msg.id]
                ) {
                  messageContextSnapshots[msg.id] =
                    contextByAssistantIdRef.current[msg.id];
                }
              });

              // Auto-generate title if needed
              let title = session.title;
              if (title === "New Chat") {
                title =
                  ChatHistoryManager.generateTitleFromMessages(currentMessages);
              }

              // Store context items to restore when switching chats
              const store = useContextItems.getState();
              const contextItemsToStore = {
                files: { ...store.files },
                folders: { ...store.folders },
                tags: { ...store.tags },
                youtubeVideos: { ...store.youtubeVideos },
                searchResults: { ...store.searchResults },
                textSelections: { ...store.textSelections },
                currentFile: store.currentFile
                  ? { ...store.currentFile }
                  : null,
              };

              chatHistoryManager.updateSession(sessionId, {
                messages: currentMessages,
                messageContextSnapshots,
                title,
                contextItems: contextItemsToStore,
              });

              // Reset saved state so the save effect will also trigger
              lastSavedMessagesRef.current = "";

              console.log("[Chat] ✅ Force saved messages in onFinish:", {
                sessionId,
                messagesCount: currentMessages.length,
                title,
                contextSnapshotsCount: Object.keys(messageContextSnapshots)
                  .length,
              });

              // Notify parent of update
              if (onSessionUpdateRef.current) {
                const updatedSession = chatHistoryManager.getSession(sessionId);
                if (updatedSession) {
                  setTimeout(() => {
                    onSessionUpdateRef.current?.(updatedSession);
                  }, 0);
                }
              }
            } else {
              console.error(
                "[Chat] ❌ onFinish: Failed to create or get session"
              );
            }
          } else {
            console.warn("[Chat] ⚠️ onFinish: No messages to save");
          }
        }, 500);
      } else {
        console.warn(
          "[Chat] ❌ onFinish: message missing id or not assistant:",
          {
            hasId: !!message?.id,
            messageId: message?.id,
            role: message?.role,
          }
        );
      }

      // Optional: now it's safe to clear ephemeral context here if you want
      // because refresh won't depend on Zustand store anymore.
      // clearEphemeralContext();
    },
  } as UseChatOptions);

  // Update messagesRef and chatHasStarted when messages change (must be after useChat)
  useEffect(() => {
    messagesRef.current = messages;
    setChatHasStarted(messages.length > 0);
  }, [messages]);

  // skip the use context items entirely (chatHasStarted is now available)
  useCurrentFile({
    app,
    setCurrentFile,
    chatHasStarted,
  });

  // Derive isGenerating from status (replacement for deprecated isLoading)
  const isGenerating = status === "streaming" || status === "submitted";
  
  // Check if there are tool invocations (executing or waiting for AI response)
  const hasToolActivity = React.useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    
    // Extract tool invocations from parts (new format) or fallback to deprecated toolInvocations
    interface ToolPart {
      type?: string;
      toolCallId?: string;
      toolInvocation?: {
        toolCallId: string;
        toolName: string;
        result?: unknown;
        state?: string;
      };
      output?: unknown;
      state?: string;
    }
    
    const messageWithParts = lastMessage as Message & {
      parts?: ToolPart[];
      toolInvocations?: ToolInvocation[];
    };
    
    // Extract tool invocations from parts (preferred) or fallback to deprecated property
    let toolInvocations: any[] = [];
    
    if (messageWithParts.parts) {
      toolInvocations = messageWithParts.parts
        .filter((part: ToolPart) => part.type?.startsWith("tool-") || part.toolInvocation)
        .map((part: ToolPart) => {
          if (part.toolInvocation) {
            return {
              toolCallId: part.toolInvocation.toolCallId,
              result: part.toolInvocation.result,
              state: part.toolInvocation.state || part.state,
            };
          }
          return {
            toolCallId: part.toolCallId,
            result: part.output,
            state: part.state,
          };
        })
        .filter((tool: any) => tool.toolCallId); // Filter out invalid entries
    }
    
    // Fallback to deprecated toolInvocations if parts extraction yielded nothing
    if (toolInvocations.length === 0 && messageWithParts.toolInvocations) {
      toolInvocations = messageWithParts.toolInvocations as any[];
    }
    
    if (toolInvocations.length === 0) return false;
    
    // Check if any tools are still executing (no result yet)
    const hasExecutingTools = toolInvocations.some(
      (tool: any) => !("result" in tool) && tool.state !== "result"
    );
    
    // Check if all tools are complete but AI hasn't started streaming yet
    const allToolsComplete = toolInvocations.every(
      (tool: any) => "result" in tool || tool.state === "result"
    );
    const waitingForAI = allToolsComplete && (!lastMessage.content || lastMessage.content.length === 0);
    
    return hasExecutingTools || waitingForAI;
  }, [messages]);
  
  // Show loading indicator when:
  // 1. Status is "submitted" (initial request)
  // 2. Tools are executing (before results appear)
  // 3. Tools are complete but AI hasn't started streaming yet
  const showLoadingIndicator = status === "submitted" || (hasToolActivity && status !== "streaming");

  // Helper to normalize message with timestamp
  const normalizeMessage = (
    msg: Message,
    existingTimestamp?: number
  ): Message & { createdAt?: number } => {
    const normalized = { ...msg } as any;
    if (existingTimestamp) {
      normalized.createdAt = existingTimestamp;
    } else if (msg.createdAt instanceof Date) {
      normalized.createdAt = msg.createdAt.getTime();
    } else if (typeof msg.createdAt === "number") {
      normalized.createdAt = msg.createdAt;
    } else {
      // New message, add timestamp
      normalized.createdAt = Date.now();
    }
    return normalized as Message & { createdAt?: number };
  };

  // Track messages with timestamps (convert Date to number for consistency)
  const [messagesWithTimestamps, setMessagesWithTimestamps] = useState<
    Array<Message & { createdAt?: number }>
  >([]);

  // Sync messages with timestamps
  useEffect(() => {
    setMessagesWithTimestamps(prev => {
      return messages.map(msg => {
        // Find existing message to preserve timestamp
        const existing = prev.find(m => m.id === msg.id);
        return normalizeMessage(msg, existing?.createdAt);
      });
    });
  }, [messages]);

  // Load messages when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      isLoadingSessionRef.current = true;
      const session = chatHistoryManager.getSession(activeChatId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);

        // Restore context snapshots from saved session
        if (session.messageContextSnapshots) {
          Object.entries(session.messageContextSnapshots).forEach(
            ([messageId, context]) => {
              contextByAssistantIdRef.current[messageId] = context;
            }
          );
        }

        // Restore context items from saved session
        if (session.contextItems) {
          const store = useContextItems.getState();

          // Clear current context items
          store.clearAll();

          // Restore saved context items
          if (session.contextItems.files) {
            Object.values(session.contextItems.files).forEach(file => {
              store.addFile(file);
            });
          }
          if (session.contextItems.folders) {
            Object.values(session.contextItems.folders).forEach(folder => {
              store.addFolder(folder);
            });
          }
          if (session.contextItems.tags) {
            Object.values(session.contextItems.tags).forEach(tag => {
              store.addTag(tag);
            });
          }
          if (session.contextItems.youtubeVideos) {
            Object.values(session.contextItems.youtubeVideos).forEach(video => {
              store.addYouTubeVideo(video);
            });
          }
          if (session.contextItems.searchResults) {
            Object.values(session.contextItems.searchResults).forEach(
              search => {
                store.addSearchResults(search);
              }
            );
          }
          if (session.contextItems.textSelections) {
            Object.values(session.contextItems.textSelections).forEach(
              selection => {
                store.addTextSelection(selection);
              }
            );
          }
          if (session.contextItems.currentFile) {
            // Set current file and enable display (includeCurrentFile must be true to show it)
            useContextItems.setState({
              currentFile: session.contextItems.currentFile,
              includeCurrentFile: true, // Enable display of restored current file
            });
            console.log(
              "[Chat] ✅ Restored current file:",
              session.contextItems.currentFile.title
            );
          }

          console.log(
            "[Chat] ✅ Restored context items for session:",
            activeChatId,
            {
              filesCount: Object.keys(session.contextItems.files || {}).length,
              foldersCount: Object.keys(session.contextItems.folders || {})
                .length,
              tagsCount: Object.keys(session.contextItems.tags || {}).length,
              hasCurrentFile: !!session.contextItems.currentFile,
              includeCurrentFile: useContextItems.getState().includeCurrentFile,
            }
          );
        }
      } else {
        // New or empty session
        const store = useContextItems.getState();
        store.clearAll();
        setMessages([]);

        // Add current file to context for new chats (only if session has no saved context items)
        // This ensures we only add current file for brand new chats, not when loading existing empty sessions
        if (!session || !session.contextItems) {
          const activeFile = app.workspace.getActiveFile();
          if (activeFile && activeFile.extension === "md") {
            // Only add markdown files (skip media files)
            app.vault
              .cachedRead(activeFile)
              .then(content => {
                const fileContextItem = {
                  id: activeFile.path,
                  type: "file" as const,
                  path: activeFile.path,
                  title: activeFile.basename,
                  content,
                  reference: "Current File",
                  createdAt: activeFile.stat.ctime,
                };

                // Set as current file and ensure includeCurrentFile is enabled
                // clearAll() sets includeCurrentFile to false, so we need to enable it
                // Use setState to update both currentFile and includeCurrentFile at once
                useContextItems.setState({
                  currentFile: fileContextItem,
                  includeCurrentFile: true, // Enable display of current file
                });

                console.log(
                  "[Chat] ✅ Added current file to new chat context:",
                  {
                    filename: activeFile.basename,
                    includeCurrentFile:
                      useContextItems.getState().includeCurrentFile,
                    currentFile: useContextItems.getState().currentFile?.title,
                  }
                );
              })
              .catch(error => {
                console.warn(
                  "[Chat] Failed to read current file for new chat:",
                  error
                );
              });
          }
        }
      }
      // Reset loading flag after a brief delay to allow state to update
      setTimeout(() => {
        isLoadingSessionRef.current = false;
      }, 100);
    } else {
      // No active chat - clear context items
      const store = useContextItems.getState();
      store.clearAll();
      setMessages([]);
      isLoadingSessionRef.current = false;
    }
  }, [activeChatId, chatHistoryManager]);

  // Track last saved message state to prevent unnecessary saves
  const lastSavedMessagesRef = useRef<string>("");

  // Save messages when they change (debounced via manager)
  useEffect(() => {
    // Don't save if we're currently loading a session
    if (isLoadingSessionRef.current) {
      return;
    }

    if (activeChatId && messages.length > 0) {
      // Create a stable key from messages to detect actual changes
      const messagesKey = `${activeChatId}-${messages.length}-${messages
        .map(m => m.id)
        .join(",")}`;

      // Skip if we've already saved this exact state
      if (lastSavedMessagesRef.current === messagesKey) {
        return;
      }

      const session = chatHistoryManager.getSession(activeChatId);
      if (session) {
        // Auto-generate title from first user message if title is still "New Chat"
        let title = session.title;
        if (title === "New Chat") {
          const generatedTitle =
            ChatHistoryManager.generateTitleFromMessages(messages);
          title = generatedTitle;
        }

        // Store lightweight context snapshot (metadata only, not full content)
        // Context is always built fresh from current vault state when sending messages,
        // but we store a snapshot for reference
        // Note: We read files/folders/tags/currentFile from closure, but don't include them in deps
        // to avoid infinite loops - context metadata is just for reference
        const contextMetadata = {
          filesCount: Object.keys(files).length,
          foldersCount: Object.keys(folders).length,
          tagsCount: Object.keys(tags).length,
          hasCurrentFile: !!currentFile,
          currentFile: currentFile?.basename || null,
          timestamp: Date.now(),
        };

        // Store context snapshots for assistant messages (for refresh functionality)
        const messageContextSnapshots: Record<string, string> = {};
        messages.forEach(msg => {
          if (
            msg.role === "assistant" &&
            msg.id &&
            contextByAssistantIdRef.current[msg.id]
          ) {
            messageContextSnapshots[msg.id] =
              contextByAssistantIdRef.current[msg.id];
          }
        });

        // Store context items to restore when switching chats
        const contextItemsToStore = {
          files: { ...files },
          folders: { ...folders },
          tags: { ...tags },
          youtubeVideos: { ...youtubeVideos },
          searchResults: { ...searchResults },
          textSelections: { ...textSelections },
          currentFile: currentFile ? { ...currentFile } : null,
        };

        chatHistoryManager.updateSession(activeChatId, {
          messages,
          title,
          contextSnapshot: JSON.stringify(contextMetadata),
          messageContextSnapshots,
          contextItems: contextItemsToStore,
        });

        // Mark as saved
        lastSavedMessagesRef.current = messagesKey;

        // Notify parent of update - use ref to avoid dependency issues
        if (onSessionUpdateRef.current) {
          const updatedSession = chatHistoryManager.getSession(activeChatId);
          if (updatedSession) {
            // Use setTimeout to defer callback to next tick, preventing render loops
            setTimeout(() => {
              onSessionUpdateRef.current?.(updatedSession);
            }, 0);
          }
        }
      }
    }
  }, [messages, activeChatId, chatHistoryManager]);

  // Save context items when they change (independent of messages)
  useEffect(() => {
    // Don't save if we're currently loading a session
    if (isLoadingSessionRef.current) {
      return;
    }

    if (activeChatId) {
      const session = chatHistoryManager.getSession(activeChatId);
      if (session) {
        // Store context items to restore when switching chats
        const contextItemsToStore = {
          files: { ...files },
          folders: { ...folders },
          tags: { ...tags },
          youtubeVideos: { ...youtubeVideos },
          searchResults: { ...searchResults },
          textSelections: { ...textSelections },
          currentFile: currentFile ? { ...currentFile } : null,
        };

        // Only update if context items actually changed
        const currentContextKey = JSON.stringify(contextItemsToStore);
        const savedContextKey = session.contextItems
          ? JSON.stringify(session.contextItems)
          : "";

        if (currentContextKey !== savedContextKey) {
          chatHistoryManager.updateSession(activeChatId, {
            contextItems: contextItemsToStore,
          });

          console.log(
            "[Chat] ✅ Saved context items for session:",
            activeChatId
          );
        }
      }
    }
  }, [
    files,
    folders,
    tags,
    youtubeVideos,
    searchResults,
    textSelections,
    currentFile,
    activeChatId,
    chatHistoryManager,
  ]);

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  const handleAttachmentsChange = useCallback(
    (newAttachments: LocalAttachment[]) => {
      setAttachments(newAttachments);
    },
    []
  );

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isGenerating) {
      handleCancelGeneration();
      return;
    }

    // Extract content directly from Tiptap editor to ensure we have the latest content
    // This fixes the issue where input state might not be synced with editor content
    const editor = tiptapEditorRef.current;
    const editorContent = editor?.getText() || "";

    // Only log safe properties to avoid circular reference errors
    logger.debug("handleSendMessage", {
      input,
      editorContent,
      type: e.type,
      timeStamp: e.timeStamp,
    });

    // If there's no content, don't send
    if (!editorContent || editorContent.trim() === "") {
      return;
    }

    // Validate API key before sending
    const apiKey = plugin.getApiKey()?.trim();
    if (!apiKey || apiKey.length === 0) {
      new Notice(
        "API key is missing. Please set your API key in plugin settings.",
        5000
      );
      return;
    }

    // Update input state if it's different from editor content
    // This ensures useChat's handleSubmit will use the correct content
    if (editorContent !== input) {
      handleInputChange({
        target: { value: editorContent },
      } as React.ChangeEvent<HTMLInputElement>);
    }

    const messageBody = {
      ...chatBody,
      experimental_attachments: attachments.map(
        ({ id, size, ...attachment }) => ({
          name: attachment.name,
          contentType: attachment.contentType,
          url: attachment.url,
        })
      ),
    };

    // Use setTimeout to ensure the input state update is processed before handleSubmit
    // React batches state updates, so we need to wait for the next tick
    // This ensures useChat's handleSubmit will read the updated input value
    setTimeout(() => {
      handleSubmit(e, { body: messageBody });
      // Don't clear ephemeral context here - it's now handled in onFinish after snapshotting
    }, 0);

    // Clear attachments after sending
    setAttachments([]);
  };

  const handleCancelGeneration = () => {
    stop();
  };

  const handleTiptapChange = async (newContent: string) => {
    handleInputChange({
      target: { value: newContent },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, history]);

  const [maxContextSize] = useState(80 * 1000); // Keep this one

  useEffect(() => {
    // Update selectedModel when plugin settings change
    setSelectedModel(plugin.settings.selectedModel);
  }, [plugin.settings.selectedModel]);

  const handleTranscriptionComplete = (text: string) => {
    handleInputChange({
      target: { value: text },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleExampleClick = (prompt: string) => {
    handleInputChange({
      target: { value: prompt },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    reload();
  };

  const handleDismissError = () => {
    setErrorMessage(null);
  };

  const handleNewChat = () => {
    // Note: New chat creation is now handled by container
    // This is kept for backward compatibility but may not be used
    setMessages([]);
    setMessagesWithTimestamps([]);
    setErrorMessage(null);
  };

  // Ref to track the target message count after refresh (to detect when state has updated)
  const pendingReloadRef = useRef<number | null>(null);

  // Effect to trigger reload when messages match the expected count after refresh
  useEffect(() => {
    if (pendingReloadRef.current === null) return;
    if (messages.length !== pendingReloadRef.current) return;

    const targetCount = pendingReloadRef.current;
    pendingReloadRef.current = null;

    const body = forcedReloadBodyRef.current;
    forcedReloadBodyRef.current = null;

    console.log(
      "[Chat] Triggering reload after message refresh, messages count:",
      targetCount,
      "has forced body:",
      !!body
    );

    if (!body) {
      console.warn(
        "[Chat] Missing forced reload body, calling reload() without body"
      );
      reload();
      return;
    }

    // Use reload({ body }) to pass the exact body we want
    // This is the cleanest approach - reload accepts the same options as handleSubmit
    reload({ body });

    // Save the context from the body for onFinish snapshotting
    if (body.newUnifiedContext) {
      lastContextSentRef.current = body.newUnifiedContext;
    }

    // Reset saved state after reload is triggered so new messages from reload will be saved
    // The reload will add new messages, and we want to ensure they get saved when they arrive
    lastSavedMessagesRef.current = "";
  }, [messages.length, reload]);

  const handleMessageRefresh = useCallback(
    (messageId: string) => {
      // Find the message index
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      // Only allow refreshing assistant messages
      const messageToRefresh = messages[messageIndex];
      if (messageToRefresh.role !== "assistant") return;

      // Look up context snapshot by message ID
      // First try in-memory ref (for newly generated messages)
      let snapshot = contextByAssistantIdRef.current[messageId];

      // If not in memory, try to load from saved session
      if (!snapshot && activeChatId) {
        const session = chatHistoryManager.getSession(activeChatId);
        if (session?.messageContextSnapshots?.[messageId]) {
          snapshot = session.messageContextSnapshots[messageId];
          // Restore to memory for future use
          contextByAssistantIdRef.current[messageId] = snapshot;
        }
      }

      // If still no snapshot, use current context as fallback
      if (!snapshot) {
        console.warn(
          "[Chat] No snapshot for message:",
          messageId,
          "- using current context as fallback"
        );
        snapshot = fullContext; // Use current full context as fallback
      }

      console.log("[Chat] refresh debug", {
        messageId,
        messageIndex,
        hasSnapshot: true,
        snapshotLength: snapshot.length,
        knownSnapshotKeys: Object.keys(contextByAssistantIdRef.current).slice(
          -5
        ),
      });

      // Remove the message and all subsequent messages
      const trimmed = messages.slice(0, messageIndex);
      setMessages(trimmed);
      setMessagesWithTimestamps(messagesWithTimestamps.slice(0, messageIndex));

      // Reset saved state so the trimmed messages get saved immediately
      // This ensures the state before reload is saved
      lastSavedMessagesRef.current = "";

      // Force save the trimmed messages immediately (before reload)
      if (activeChatId && trimmed.length > 0) {
        const session = chatHistoryManager.getSession(activeChatId);
        if (session) {
          chatHistoryManager.updateSession(activeChatId, {
            messages: trimmed,
          });
        }
      }

      // Stage the exact body we want reload to use
      const currentDatetime = window.moment().format("YYYY-MM-DDTHH:mm:ssZ");
      forcedReloadBodyRef.current = {
        currentDatetime,
        model: plugin.settings.selectedModel,
        enableSearchGrounding:
          plugin.settings.enableSearchGrounding ||
          selectedModel === "gpt-4o-search-preview" ||
          selectedModel === "gpt-4o-mini-search-preview",
        deepSearch: plugin.settings.enableDeepSearch,
        newUnifiedContext: snapshot, // ✅ the important part
      };

      console.log(
        "[Chat] handleMessageRefresh: Staged reload body with context length:",
        snapshot.length
      );

      // Set target count to trigger reload when messages state updates
      pendingReloadRef.current = trimmed.length;
    },
    [
      messages,
      messagesWithTimestamps,
      setMessages,
      selectedModel,
      plugin.settings,
    ]
  );

  // Handle slash command actions
  useEffect(() => {
    const handleSlashCommand = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, item } = customEvent.detail;
      const editor = tiptapEditorRef.current;

      console.log("Slash command received:", action, item);

      switch (action) {
        case "format": {
          // Handle format command - trigger actual formatting like organizer does
          const { templateName } = customEvent.detail;
          if (!templateName) {
            console.warn("Format command missing templateName");
            break;
          }

          // Get current file from editor context or active file
          const activeFile = app.workspace.getActiveFile();
          if (!activeFile) {
            new Notice(
              "No file is currently open. Please open a file to format.",
              4000
            );
            break;
          }

          // Add user message to chat showing the format request
          setMessages([
            ...messages,
            {
              id: `format-${Date.now()}`,
              role: "user",
              content: `Format as ${templateName}`,
            },
          ]);

          // Execute formatting asynchronously
          (async () => {
            try {
              let fileContent = await app.vault.read(activeFile);
              if (typeof fileContent !== "string") {
                throw new Error("File content is not a string");
              }

              // Handle YouTube video special case
              if (
                templateName === "youtube_video" ||
                templateName === "youtube_video.md"
              ) {
                const { extractYouTubeVideoId, getYouTubeContent } =
                  await import("../../../inbox/services/youtube-service");
                const videoId = extractYouTubeVideoId(fileContent);
                if (videoId) {
                  try {
                    new Notice("Fetching YouTube transcript...", 2000);
                    const { title, transcript } = await getYouTubeContent(
                      videoId,
                      plugin
                    );
                    const videoInfo = `\n\n## YouTube Video Information\n\nTitle: ${title}\nVideo ID: ${videoId}\n\n## Full Transcript\n\n${transcript}`;
                    fileContent = fileContent + videoInfo;
                    new Notice("Transcript fetched, formatting...", 2000);
                  } catch (error) {
                    logger.warn(
                      "Failed to fetch YouTube transcript, formatting without it:",
                      error
                    );
                    new Notice(
                      `Could not fetch transcript: ${
                        error instanceof Error ? error.message : String(error)
                      }. Formatting with available content.`,
                      5000
                    );
                  }
                }
              }

              // Get template instructions and format
              const formattingInstruction =
                await plugin.getTemplateInstructions(templateName);
              await plugin.streamFormatInCurrentNote({
                file: activeFile,
                content: fileContent,
                formattingInstruction: formattingInstruction,
              });
            } catch (error) {
              logger.error("Error formatting file:", error);
              new Notice(
                `Error formatting file: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                6000
              );
            }
          })();
          break;
        }
        case "clear":
          handleNewChat();
          if (editor) {
            editor.commands.clearContent();
          }
          break;
        case "newChat":
          handleNewChat();
          if (editor) {
            editor.commands.clearContent();
          }
          break;
        case "search":
          // Insert search prompt into editor
          if (editor) {
            editor.chain().focus().insertContent("Search my vault for: ").run();
          } else {
            handleInputChange({
              target: { value: "Search my vault for: " },
            } as React.ChangeEvent<HTMLInputElement>);
          }
          break;
        case "summarize":
          if (editor) {
            editor
              .chain()
              .focus()
              .insertContent("Summarize the current context")
              .run();
          } else {
            handleInputChange({
              target: { value: "Summarize the current context" },
            } as React.ChangeEvent<HTMLInputElement>);
          }
          break;
        case "explain":
          if (editor) {
            editor.chain().focus().insertContent("Explain: ").run();
          } else {
            handleInputChange({
              target: { value: "Explain: " },
            } as React.ChangeEvent<HTMLInputElement>);
          }
          break;
        default:
          console.warn("Unknown slash command action:", action);
          break;
      }
    };

    document.addEventListener("slashCommand", handleSlashCommand);

    return () => {
      document.removeEventListener("slashCommand", handleSlashCommand);
    };
  }, [
    input,
    handleNewChat,
    handleInputChange,
    messages,
    setMessages,
    app,
    plugin,
  ]);

  return (
    <StyledContainer className="flex flex-col h-full w-full max-h-full overflow-hidden">
      {/* Chat Header - minimal */}
      <div className="flex-none border-b border-[--background-modifier-border] px-3 py-1.5 bg-[--background-primary]">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            {/* Chat History Combobox - Always show if we have callbacks */}
            {onSelectChat && onDeleteChat && (
              <ChatHistoryCombobox
                sessions={chatSessions || []}
                activeChatId={activeChatId}
                onSelectChat={onSelectChat}
                onDeleteChat={onDeleteChat}
                app={app}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages - compressed spacing */}
      <div className="flex-1 overflow-y-auto px-3 py-2 bg-[--background-primary]">
        <div className="flex flex-col space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12"></div>
          ) : (
            messages.map(message => {
              // Extract tool invocations from new format (parts) or fall back to deprecated format
              // Type guard for parts format (AI SDK v5+)
              interface ToolPart {
                type: string;
                toolCallId?: string;
                toolInvocation?: {
                  toolCallId: string;
                  toolName: string;
                  args?: unknown;
                  result?: unknown;
                  state?: string;
                };
                input?: unknown;
                output?: unknown;
                state?: string;
              }
              const messageWithParts = message as Message & {
                parts?: ToolPart[];
                toolInvocations?: ToolInvocation[];
              };
              
              // First, try to use message.toolInvocations directly (most reliable)
              let toolInvocations: any[] = (messageWithParts.toolInvocations || []) as any[];
              
              // If not available, extract from parts
              if (toolInvocations.length === 0 && messageWithParts.parts) {
                toolInvocations = messageWithParts.parts
                  .filter((part: ToolPart) => {
                    // Match parts that are tool-related
                    return part.type?.startsWith("tool-") || part.toolInvocation;
                  })
                  .map((part: ToolPart) => {
                    // If part has nested toolInvocation, use that
                    if (part.toolInvocation) {
                      console.log("[Chat] Using nested toolInvocation:", part.toolInvocation);
                      return {
                        toolCallId: part.toolInvocation.toolCallId,
                        toolName: part.toolInvocation.toolName,
                        args: part.toolInvocation.args || part.input,
                        result: part.toolInvocation.result || part.output,
                        state: part.toolInvocation.state || part.state || "call",
                      };
                    }
                    
                    // Otherwise, extract from part.type
                    const toolName = part.type.replace("tool-", "");
                    console.log("[Chat] Extracting from part.type:", {
                      partType: part.type,
                      extractedToolName: toolName,
                      toolCallId: part.toolCallId,
                    });
                    
                    // If type is just "tool-invocation", we can't extract the name - skip it
                    if (toolName === "invocation") {
                      console.warn("[Chat] Cannot extract tool name from part.type 'tool-invocation', skipping");
                      return null;
                    }
                    
                    // Require valid toolCallId so addToolResult can match results on the server
                    if (!part.toolCallId || String(part.toolCallId).trim() === "") {
                      console.warn("[Chat] Part missing toolCallId, skipping to avoid broken tool result matching");
                      return null;
                    }
                    
                    return {
                      toolCallId: part.toolCallId,
                      toolName: toolName,
                      args: part.input,
                      result: part.output,
                      state:
                        part.state === "output-available"
                          ? "result"
                          : part.state === "input-available"
                          ? "call"
                          : "partial-call",
                    };
                  })
                  .filter((inv) => inv !== null);
              }
              
              // Never pass invocations without a valid toolCallId (server matches results by it)
              toolInvocations = toolInvocations.filter(
                (inv: { toolCallId?: string }) =>
                  inv?.toolCallId != null && String(inv.toolCallId).trim() !== ""
              );
              
              console.log("[Chat] Final tool invocations:", toolInvocations);

              return (
                <React.Fragment key={message.id}>
                  {/* Render tool invocations FIRST so they appear above the message content */}
                  {toolInvocations.map((toolInvocation: any) => {
                    return (
                      <ToolInvocationHandler
                        key={toolInvocation.toolCallId}
                        toolInvocation={toolInvocation as ToolInvocation}
                        addToolResult={addToolResult}
                        app={app}
                      />
                    );
                  })}
                  {/* Then render annotations */}
                  {message.annotations?.map((annotation, index) => {
                    if (isSearchResultsAnnotation(annotation)) {
                      return (
                        <SearchAnnotationHandler
                          key={`${message.id}-annotation-${index}`}
                          annotation={annotation}
                        />
                      );
                    }
                    return null;
                  })}
                  {/* Finally render the message content (summary) so it appears below tool invocations */}
                  <MessageRenderer
                    message={
                      messagesWithTimestamps.find(m => m.id === message.id) ||
                      normalizeMessage(message)
                    }
                    onMessageRefresh={handleMessageRefresh}
                  />
                </React.Fragment>
              );
            })
          )}

          {showLoadingIndicator && (
            <div className="flex items-center gap-3 py-2.5">
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                <Bot size={16} className="text-[--interactive-accent]" />
              </div>

              {/* Dots */}
              <div className="h-8 flex items-center gap-0.5">
                <span
                  className="w-1 h-1 bg-[--text-accent] rounded-full animate-bounce"
                  style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
                />
                <span
                  className="w-1 h-1 bg-[--text-accent] rounded-full animate-bounce"
                  style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
                />
                <span
                  className="w-1 h-1 bg-[--text-accent] rounded-full animate-bounce"
                  style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
                />
              </div>
            </div>
          )}

          {/* Error message - renders as normal message in chat flow */}
          {errorMessage && (
            <div className="flex items-start gap-2 py-1.5 border-b border-[--background-modifier-border] pb-2">
              <div className="w-4 text-xs text-[--text-error]">⚠</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[--text-error] font-medium">
                    Error
                  </div>
                  <button
                    onClick={handleDismissError}
                    className="text-[--text-muted] hover:text-[--text-normal] text-xs"
                    title="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm text-[--text-normal] whitespace-pre-wrap select-text">
                  {errorMessage}
                </div>
                <Button
                  onClick={handleRetry}
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-1 hover:bg-[--background-modifier-hover]"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          {groundingMetadata && (
            <SourcesSection groundingMetadata={groundingMetadata} />
          )}
        </div>
      </div>

      {/* Unified Command Center Footer */}
      <div className="flex-none border-t border-[--background-modifier-border] bg-[--background-primary]">
        <form onSubmit={handleSendMessage} className="p-3">
          {/* Row 1: Context attachments - compact chips */}
          <div className="mb-2">
            <ContextItems />
          </div>

          {/* Row 2: Input area with embedded send button */}
          <div className="relative" ref={inputRef}>
            {/* Show editor context badge if we have selection */}
            <EditorContextBadge context={editorContext} onClear={clearFrozen} />
            <Tiptap
              value={input}
              onChange={handleTiptapChange}
              onKeyDown={handleKeyDown}
              editorRef={tiptapEditorRef}
            />
            {/* Embedded controls - bottom right corner of input */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <AudioRecorder
                onTranscriptionComplete={handleTranscriptionComplete}
              />
              <button
                type="submit"
                disabled={isGenerating || !input.trim()}
                className={`flex items-center justify-center transition-all rounded-md w-8 h-8 ${
                  isGenerating || !input.trim()
                    ? "text-[--text-muted] cursor-not-allowed opacity-50"
                    : "text-[--text-on-accent] bg-[--interactive-accent] hover:bg-[--interactive-accent-hover] shadow-sm hover:shadow"
                }`}
                title={isGenerating ? "Stop generating" : "Send message"}
              >
                {isGenerating ? (
                  <Square className="w-4 h-4" fill="currentColor" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Row 3: Modifier bar - subtle toggles and status */}
          <div className="flex items-center justify-between mt-1.5 text-xs text-[--text-muted]">
            <div className="flex items-center gap-3">
              <ContextLimitIndicator
                unifiedContext={contextString}
                maxContextSize={maxContextSize}
              />
              {/* Removed SearchToggle - search grounding now auto-triggered by tools */}
            </div>
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
            />
          </div>
        </form>
      </div>
    </StyledContainer>
  );
};
