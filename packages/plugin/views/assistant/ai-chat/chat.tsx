import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useChat, UseChatOptions } from "@ai-sdk/react";
import { moment, Notice } from "obsidian";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Send, Square } from "lucide-react";
import { StyledContainer } from "@/components/ui/utils";
import { Editor } from "@tiptap/react";

import FileOrganizer from "../../..";
import { GroundingMetadata, DataChunk } from "./types/grounding";
import Tiptap from "./tiptap";
import { usePlugin } from "../provider";

import { logMessage } from "../../../someUtils";
import { MessageRenderer } from "./message-renderer";
import ToolInvocationHandler from "./tool-handlers/tool-invocation-handler";
import { convertToCoreMessages, streamText, ToolInvocation } from "ai";
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
import { ClearAllButton } from "./components/clear-all-button";
import { NewChatButton } from "./components/new-chat-button";
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
} from "./use-editor-selection";
import { EditorContextBadge } from "./components/editor-context-badge";

interface ChatComponentProps {
  plugin: FileOrganizer;
  apiKey: string;
  inputRef: React.RefObject<HTMLDivElement>;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  apiKey,
  inputRef,
}) => {
  const plugin = usePlugin();
  const app = plugin.app;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // skip the use context items entirely
  useCurrentFile({
    app,
    setCurrentFile,
  });

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
    isLoading: isGenerating,
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

      // Get fresh editor context
      const freshEditorContext = formatEditorContextForAI(editorContext);
      const freshFullContext = freshEditorContext
        ? `${freshContextString}\n\n${freshEditorContext}`
        : freshContextString;

      // Log for debugging
      const hasYouTube =
        Object.keys(freshContextItems.youtubeVideos).length > 0;
      const contextStringLength = freshContextString.length;
      console.log("[Chat] prepareRequestBody:", {
        hasYouTube,
        youtubeVideoCount: Object.keys(freshContextItems.youtubeVideos).length,
        youtubeVideoIds: Object.keys(freshContextItems.youtubeVideos),
        contextStringLength,
        isLightweightMode: store.isLightweightMode,
        hasEditorContext: !!freshEditorContext,
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
        newUnifiedContext: freshFullContext,
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${plugin.getApiKey()}`,
    },
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
      logger.error(error.message);

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

      if (error.message?.toLowerCase().includes("api key")) {
        userFriendlyMessage =
          "API key issue detected. Please check your settings.";
      } else if (
        error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("fetch")
      ) {
        userFriendlyMessage =
          "Connection failed. Please check your internet connection.";
      } else if (error.message?.toLowerCase().includes("rate limit")) {
        userFriendlyMessage =
          "Rate limit reached. Please wait a moment and try again.";
      } else if (error.message?.toLowerCase().includes("timeout")) {
        userFriendlyMessage = "Request timed out. Please try again.";
      } else if (error.message) {
        // If we have a specific error message, show it fully (don't truncate)
        userFriendlyMessage = error.message;
      }

      setErrorMessage(userFriendlyMessage);
    },
    onFinish: () => {
      // Don't clear error message on finish - let user dismiss it manually
      // Clear ephemeral context after AI response
      clearEphemeralContext();
    },
  } as UseChatOptions);

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  const handleAttachmentsChange = useCallback(
    (newAttachments: LocalAttachment[]) => {
      setAttachments(newAttachments);
    },
    []
  );

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    // Only log safe properties to avoid circular reference errors
    logger.debug("handleSendMessage", {
      input,
      type: e.type,
      timeStamp: e.timeStamp,
    });
    e.preventDefault();
    if (isGenerating) {
      handleCancelGeneration();
      return;
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

    handleSubmit(e, { body: messageBody });
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
    setMessages([]);
    setErrorMessage(null);
  };

  // Ref to access Tiptap editor
  const tiptapEditorRef = useRef<Editor | null>(null);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-[--text-normal]">Chat</h2>
            {isGenerating && (
              <div className="flex items-center gap-1.5 text-xs text-[--text-muted]">
                <span className="inline-block w-1.5 h-1.5 bg-[--text-accent] rounded-full animate-pulse"></span>
                <span>Thinking</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* New Chat */}
            <NewChatButton onClick={handleNewChat} />

            {/* Clear All - icon only */}
            <ClearAllButton />
          </div>
        </div>
      </div>

      {/* Chat Messages - compressed spacing */}
      <div className="flex-1 overflow-y-auto px-3 py-2 bg-[--background-primary]">
        <div className="flex flex-col space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12"></div>
          ) : (
            messages.map(message => (
              <React.Fragment key={message.id}>
                {/* Render tool invocations FIRST so they appear above the message content */}
                {message.toolInvocations?.map(
                  (toolInvocation: ToolInvocation) => {
                    return (
                      <ToolInvocationHandler
                        key={toolInvocation.toolCallId}
                        toolInvocation={toolInvocation}
                        addToolResult={addToolResult}
                        app={app}
                      />
                    );
                  }
                )}
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
                <MessageRenderer message={message} />
              </React.Fragment>
            ))
          )}

          {isGenerating && (
            <div className="flex items-start gap-2 py-1.5">
              <div className="w-4 text-xs text-[--text-faint]">AI</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-[--text-muted]">
                  <div className="w-1.5 h-1.5 bg-[--text-accent] rounded-full animate-pulse"></div>
                  <span>Thinking...</span>
                </div>
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
