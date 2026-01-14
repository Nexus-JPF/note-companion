import { normalizePath, App } from "obsidian";
import { Message } from "ai";
import { logger } from "../../../../services/logger";

type TimeoutID = ReturnType<typeof setTimeout>;

export interface ChatSession {
  id: string;
  title: string; // Auto-generated from first user message (max 50 chars)
  messages: Message[];
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  model?: string; // Selected model for this session
  contextSnapshot?: string; // Optional: context used when session was created
  messageContextSnapshots?: Record<string, string>; // Map of message ID to context snapshot for refresh
  contextItems?: {
    files?: Record<string, any>;
    folders?: Record<string, any>;
    tags?: Record<string, any>;
    youtubeVideos?: Record<string, any>;
    searchResults?: Record<string, any>;
    textSelections?: Record<string, any>;
    currentFile?: any | null;
  }; // Store context items to restore when switching chats
}

export class ChatHistoryManager {
  private static instance: ChatHistoryManager;
  private sessions: Map<string, ChatSession> = new Map();
  private app: App;
  private debounceTimeout: TimeoutID | null = null;
  private readonly CHAT_HISTORY_PATH = normalizePath("_NoteCompanion/.chat-history.json");

  private constructor(app: App) {
    this.app = app;
    this.loadSessions();
  }

  public static getInstance(app?: App): ChatHistoryManager {
    if (!ChatHistoryManager.instance) {
      if (!app) {
        throw new Error(
          "ChatHistoryManager needs app for initialization"
        );
      }
      ChatHistoryManager.instance = new ChatHistoryManager(app);
    }
    return ChatHistoryManager.instance;
  }

  private async loadSessions(): Promise<void> {
    try {
      console.log("[ChatHistory] Loading sessions from:", this.CHAT_HISTORY_PATH);
      const chatHistoryFileExists = await this.app.vault.adapter.exists(
        this.CHAT_HISTORY_PATH
      );

      if (!chatHistoryFileExists) {
        console.log("[ChatHistory] File does not exist, starting with empty history");
        this.sessions = new Map();
        return;
      }

      const content = await this.app.vault.adapter.read(
        this.CHAT_HISTORY_PATH
      );

      if (!content || content.trim() === "") {
        console.warn("[ChatHistory] File exists but is empty");
        this.sessions = new Map();
        return;
      }

      const data = JSON.parse(content);
      console.log("[ChatHistory] Parsed data:", {
        hasSessions: !!data.sessions,
        sessionsType: Array.isArray(data.sessions) ? "array" : typeof data.sessions,
        sessionsLength: data.sessions?.length || 0,
        dataKeys: Object.keys(data),
      });

      // Convert array of entries back to Map
      if (data.sessions && Array.isArray(data.sessions)) {
        this.sessions = new Map(data.sessions);
        console.log("[ChatHistory] ✅ Loaded", this.sessions.size, "sessions");
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        // Handle legacy format (object with session IDs as keys)
        this.sessions = new Map(Object.entries(data));
        console.log("[ChatHistory] ✅ Loaded", this.sessions.size, "sessions (legacy format)");
      } else {
        console.warn("[ChatHistory] ⚠️ Unexpected data format:", typeof data);
        this.sessions = new Map();
      }
    } catch (error) {
      console.error("[ChatHistory] ❌ Failed to load chat history:", error);
      logger?.error("Failed to load chat history", error);
      // Initialize with empty Map if loading fails
      this.sessions = new Map();
    }
  }

  private debounceSave(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => this.saveSessions(), 1000);
  }

  private async saveSessions(): Promise<void> {
    try {
      // Convert Map to array of entries for JSON serialization
      const sessionsArray = Array.from(this.sessions.entries());

      const content = JSON.stringify({ sessions: sessionsArray }, null, 2);

      // Ensure parent directory exists
      const dirPath = this.CHAT_HISTORY_PATH
        .split("/")
        .slice(0, -1)
        .join("/");
      if (dirPath) {
        await this.app.vault.adapter.mkdir(dirPath);
      }

      // Write or create the file
      const chatHistoryFileExists = await this.app.vault.adapter.exists(
        this.CHAT_HISTORY_PATH
      );

      if (chatHistoryFileExists) {
        await this.app.vault.adapter.write(
          this.CHAT_HISTORY_PATH,
          content
        );
      } else {
        await this.app.vault.create(this.CHAT_HISTORY_PATH, content);
      }
    } catch (error) {
      console.error("Failed to save chat history:", error);
      logger?.error("Failed to save chat history", error);
    }
  }

  public createSession(title?: string): ChatSession {
    const id = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = Date.now();
    const session: ChatSession = {
      id,
      title: title || "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    this.debounceSave();
    return session;
  }

  public updateSession(id: string, updates: Partial<ChatSession>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates, { updatedAt: Date.now() });
      this.debounceSave();
    }
  }

  public deleteSession(id: string): void {
    this.sessions.delete(id);
    this.debounceSave();
  }

  public getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  public getAllSessions(): ChatSession[] {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
    console.log("[ChatHistory] getAllSessions() returning", sessions.length, "sessions");
    return sessions;
  }

  /**
   * Diagnostic method to check chat history file status
   */
  public async diagnose(): Promise<{
    fileExists: boolean;
    filePath: string;
    fileSize?: number;
    sessionsCount: number;
    error?: string;
  }> {
    try {
      const exists = await this.app.vault.adapter.exists(this.CHAT_HISTORY_PATH);
      let fileSize: number | undefined;

      if (exists) {
        const content = await this.app.vault.adapter.read(this.CHAT_HISTORY_PATH);
        fileSize = content.length;
      }

      return {
        fileExists: exists,
        filePath: this.CHAT_HISTORY_PATH,
        fileSize,
        sessionsCount: this.sessions.size,
      };
    } catch (error) {
      return {
        fileExists: false,
        filePath: this.CHAT_HISTORY_PATH,
        sessionsCount: this.sessions.size,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Manually reload sessions from disk (useful for debugging)
   */
  public async reloadSessions(): Promise<void> {
    console.log("[ChatHistory] Manually reloading sessions...");
    await this.loadSessions();
  }

  /**
   * Auto-generate title from first user message
   * Takes first 50 characters of the first user message
   */
  public static generateTitleFromMessages(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      const title = firstUserMessage.content.trim().substring(0, 50);
      return title || "New Chat";
    }
    return "New Chat";
  }
}

