import "./styles.css";

// esbuild shims for node globals used at build time
interface ProcessEnv {
  NODE_ENV?: string;
}
declare const process: { env: ProcessEnv };

import {
  Plugin,
  Notice,
  Modal,
  TFolder,
  TFile,
  normalizePath,
  loadPdfJs,
  arrayBufferToBase64,
  LinkCache,
} from "obsidian";
import { logMessage, sanitizeTag } from "./someUtils";
import { FileOrganizerSettingTab } from "./views/settings/view";
import {
  AssistantViewWrapper,
  ORGANIZER_VIEW_TYPE,
} from "./views/assistant/view";
import {
  DashboardView,
  DASHBOARD_VIEW_TYPE,
} from "./views/assistant/dashboard/view";
import { compressImageForVision, isWebP } from "./lib/compress-image";

import { FileOrganizerSettings, DEFAULT_SETTINGS } from "./settings";

import { extractSelectionToNewNote } from "./commands/extract-selection-to-note";
import { registerEventHandlers } from "./handlers/eventHandlers";
import {
  initializeOrganizer,
  initializeFileOrganizationCommands,
} from "./handlers/commandHandlers";
import {
  ensureFolderExists,
  checkAndCreateFolders,
  checkAndCreateTemplates,
  restoreDefaultTemplates,
  DEFAULT_TEMPLATE_NAMES,
} from "./fileUtils";

import { checkLicenseKey } from "./apiUtils";
import { generateObject } from "ai";
import { ollama } from "ollama-ai-provider";
import { z } from "zod";

import {
  VALID_IMAGE_EXTENSIONS,
  VALID_AUDIO_EXTENSIONS,
  VALID_MEDIA_EXTENSIONS,
} from "./constants";
import { initializeInboxQueue, Inbox } from "./inbox";
import { migrateInboxNotificationLevel } from "./inbox/notification-level";
import { migrateUseInbox } from "./inbox/use-inbox-migration";
import { logger } from "./services/logger";
import { layoutPdfTextItems } from "./lib/pdf-text-layout";
import { obsidianFetch } from "./lib/obsidian-fetch";
import {
  readResponseJson,
  getApiError,
  type ApiErrorBody,
} from "./lib/api-json";
import { addTextSelectionContext } from "./views/assistant/ai-chat/use-context-items";
import {
  buildSuggestionCacheKey,
  clearSuggestionCaches,
  getCachedFolderSuggestions,
  getCachedTagSuggestions,
  setCachedFolderSuggestions,
  setCachedTagSuggestions,
} from "./lib/suggestion-cache";
import {
  capTagsForAI,
  prioritizeFoldersForAI,
} from "./lib/organizer-limits";
import { ProcessingStatusBar } from "./components/processing-status-bar";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

type TagCounts = {
  [key: string]: number;
};

export interface FolderSuggestion {
  isNewFolder: boolean;
  score: number;
  folder: string;
  reason: string;
}

type PremiumStatusResponse = { hasCatalystAccess: boolean };
type ConceptChunk = { name: string; chunk: string };
type ConceptsResponse = { concepts: ConceptChunk[] };
type FormatContentResponse = { content: string };
type TranscribeJsonResponse = { text: string; length?: number };
type ClassifyResponse = { documentType?: string };
type VisionResponse = { text: string };
type TagSuggestion = {
  score: number;
  tag: string;
  reason: string;
  isNew: boolean;
};
type TagsResponse = { tags: TagSuggestion[] };
type FoldersResponse = { folders: FolderSuggestion[] };
type TitleSuggestion = { score: number; title: string; reason: string };
type TitlesResponse = { titles: TitleSuggestion[] };
type PresignedUrlResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};
type PresignedUrlErrorBody = ApiErrorBody & { details?: string };

type PdfTextContent = { items: unknown[] };
type PdfPage = {
  getTextContent: () => Promise<PdfTextContent>;
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPage>;
};
type PdfJsLib = {
  getDocument: (opts: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
};

async function parseApiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const errorData = await readResponseJson<ApiErrorBody>(response);
    return getApiError(errorData) ?? fallback;
  } catch {
    return fallback;
  }
}

export interface FileMetadata {
  instructions: {
    shouldClassify: boolean;
    shouldAppendAlias: boolean;
    shouldAppendSimilarTags: boolean;
  };
  classification?: string;
  originalText: string;
  originalPath: string | undefined;
  originalName: string;
  aiFormattedText: string;
  newName: string;
  newPath: string;
  markAsProcessed: boolean;
  shouldCreateMarkdownContainer: boolean;
  aliases: string[];
  similarTags: string[];
}

export interface UsageData {
  tokenUsage: number;
  maxTokenUsage: number;
  audioTranscriptionMinutes: number;
  maxAudioTranscriptionMinutes: number;
  subscriptionStatus: string;
  currentPlan: string;
  isActive?: boolean;
}

export default class FileOrganizer extends Plugin {
  public inbox: Inbox;
  settings: FileOrganizerSettings;
  private statusBarItem: HTMLElement | null = null;
  private statusBarRoot: Root | null = null;
  private vaultTagsCache: string[] | null = null;
  private vaultTagsCacheListenerRegistered = false;
  private userFoldersCache: string[] | null = null;
  private userFoldersCacheListenerRegistered = false;

  async loadSettings() {
    const loaded = (await this.loadData()) as
      | Partial<FileOrganizerSettings>
      | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

    const migratedLevel = migrateInboxNotificationLevel(loaded);
    if (migratedLevel) {
      this.settings.inboxNotificationLevel = migratedLevel;
    }

    const useInboxMigration = migrateUseInbox(this.settings);
    if (useInboxMigration) {
      this.settings.useInbox = useInboxMigration.useInbox;
      this.settings.useInboxMigrated = useInboxMigration.useInboxMigrated;
    }
  }

  async checkCatalystAccess(): Promise<boolean> {
    // fetch the file organizer premium status
    // if process env prod then point to prod server if not to localhost
    const serverUrl =
      process.env.NODE_ENV === "production"
        ? "https://app.notecompanion.ai"
        : this.getServerUrl();
    const premiumStatus = await obsidianFetch(`${serverUrl}/api/check-premium`, {
      headers: {
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
    });
    const { hasCatalystAccess } =
      await readResponseJson<PremiumStatusResponse>(premiumStatus);
    return hasCatalystAccess;
  }

  async isLicenseKeyValid(key: string): Promise<boolean> {
    try {
      const isValid = await checkLicenseKey(this.getServerUrl(), key);

      this.settings.isLicenseValid = isValid;
      this.settings.API_KEY = key;
      await this.saveSettings();
      return isValid;
    } catch (error) {
      logger.error("Error checking API key:", error);
      this.settings.isLicenseValid = false;
      await this.saveSettings();
      return false;
    }
  }
  getServerUrl(): string {
    let serverUrl = this.settings.enableSelfHosting
      ? this.settings.selfHostingURL
      : "https://app.notecompanion.ai";

    // Remove trailing slash (/) at end of url if there is one; prevents errors for /api/chat requests
    serverUrl = serverUrl.replace(/\/$/, "");
    logMessage(`Using server URL: ${serverUrl}`);

    return serverUrl;
  }

  shouldCreateMarkdownContainer(file: TFile): boolean {
    return (
      VALID_MEDIA_EXTENSIONS.includes(file.extension) ||
      file.extension === "pdf"
    );
  }

  async identifyConceptsAndFetchChunks(content: string) {
    try {
      const response = await obsidianFetch(
        `${this.getServerUrl()}/api/concepts-and-chunks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.settings.API_KEY}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const errorMessage = await parseApiErrorMessage(
          response,
          `HTTP error! status: ${response.status}`
        );
        throw new Error(errorMessage);
      }

      const { concepts } =
        await readResponseJson<ConceptsResponse>(response);
      return concepts;
    } catch (error) {
      logger.error("Error in identifyConceptsAndFetchChunks:", error);
      new Notice("An error occurred while processing the document.", 6000);
      throw error;
    }
  }

  async formatContentV2(
    content: string,
    formattingInstruction: string
  ): Promise<string> {
    try {
      const response = await obsidianFetch(`${this.getServerUrl()}/api/format`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.API_KEY}`,
        },
        body: JSON.stringify({
          content,
          formattingInstruction,
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseApiErrorMessage(
          response,
          `HTTP error! status: ${response.status}`
        );
        throw new Error(errorMessage);
      }

      const { content: formattedContent } =
        await readResponseJson<FormatContentResponse>(response);
      return formattedContent;
    } catch (error) {
      logger.error("Error formatting content:", error);
      new Notice("An error occurred while formatting the content.", 6000);
      return "";
    }
  }

  async appendBackupLinkToCurrentFile(currentFile: TFile, backupFile: TFile) {
    // Remove .md extension from path for Obsidian wikilink
    const backupPath = backupFile.path.replace(/\.md$/, "");
    const backupLink = `\n\n---\n[[${backupPath} | Link to original file]]`;

    await this.app.vault.append(currentFile, backupLink);
  }

  async appendFormattedLinkToBackupFile(
    backupFile: TFile,
    formattedFile: TFile
  ) {
    // Remove .md extension from path for Obsidian wikilink
    const formattedPath = formattedFile.path.replace(/\.md$/, "");
    const formattedLink = `\n\n---\n[[${formattedPath} | Link to formatted file]]`;

    await this.app.vault.append(backupFile, formattedLink);
  }

  async getFormatInstruction(classification: string): Promise<string> {
    // get the template file from the classification
    const templateFile = this.app.vault.getAbstractFileByPath(
      `${this.settings.templatePaths}/${classification}`
    );
    if (!templateFile || !(templateFile instanceof TFile)) {
      logger.error("Template file not found or is not a valid file.");
      return "";
    }
    return await this.app.vault.read(templateFile);
  }
  async streamFormatInSplitView({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<TFile | null> {
    try {
      new Notice("Formatting content in split view...", 3000);

      // Create a new file for the formatted content
      const newFileName = `${file.basename}-formatted-${Date.now()}.md`;
      const newFilePath = `${file.parent?.path}/${newFileName}`;
      const newFile = await this.app.vault.create(newFilePath, "");

      // Open the new file in a split view
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.openFile(newFile);

      let formattedContent = "";
      const updateCallback = (partialContent: string) => {
        formattedContent = partialContent;
        void this.app.vault.modify(newFile, formattedContent);
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );

      new Notice("Content formatted in split view successfully", 3000);
      return newFile;
    } catch (error) {
      logger.error("Error formatting content in split view:", error);
      new Notice(
        "An error occurred while formatting the content in split view.",
        6000
      );
      return null;
    }
  }

  /**
   * Cleans up tags in formatted content by removing extra # symbols
   * Fixes cases where AI generates tags with # that then appear as ## in Obsidian
   * Also removes # from tags in frontmatter (frontmatter tags should not have #)
   * Also fixes YouTube embeds to use thumbnail image URLs instead of watch URLs
   */
  private cleanupTagsInContent(content: string): string {
    // Fix YouTube embeds to use Obsidian's embed syntax
    // Convert [![YouTube Video](https://www.youtube.com/watch?v=VIDEO_ID)](https://www.youtube.com/watch?v=VIDEO_ID)
    // Or [![YouTube Video](https://img.youtube.com/vi/VIDEO_ID/...)](https://www.youtube.com/watch?v=VIDEO_ID)
    // To: ![](https://www.youtube.com/watch?v=VIDEO_ID) (Obsidian embed format)
    content = content.replace(
      /\[!\[([^\]]*)\]\(https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\)\]\(https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\)/g,
      (
        _match: string,
        _altText: string,
        videoId1: string,
        videoId2: string
      ) => {
        // Use the first video ID (they should be the same, but handle both)
        const videoId = videoId1 || videoId2;
        return `![](https://www.youtube.com/watch?v=${videoId})`;
      }
    );
    // Also convert thumbnail image links to embeds
    content = content.replace(
      /\[!\[([^\]]*)\]\(https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]+)\/[^)]+\)\]\(https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\)/g,
      (
        _match: string,
        _altText: string,
        videoId1: string,
        videoId2: string
      ) => {
        const videoId = videoId1 || videoId2;
        return `![](https://www.youtube.com/watch?v=${videoId})`;
      }
    );
    // First, handle frontmatter tags
    const frontmatterRegex = /^---\n([\s\S]*?)\n---(\n|$)/;
    const frontmatterMatch = content.match(frontmatterRegex);

    if (frontmatterMatch) {
      let frontmatterContent = frontmatterMatch[1];
      const closingNewline = frontmatterMatch[2] || "\n";

      // Clean up tags in frontmatter YAML
      // Match tags: ["#tag1", "#tag2"] or tags: ["tag1", "#tag2"] patterns
      // Also handles multiline arrays
      frontmatterContent = frontmatterContent.replace(
        /tags:\s*\[([\s\S]*?)\]/g,
        (_match, tagsContent: string) => {
          // Extract all tags (handles both single-line and multiline arrays)
          const tagMatches =
            tagsContent.match(/["']([^"']*)["']/g) ?? [];
          const cleanedTags = tagMatches.map((tagMatch: string) => {
            // Remove quotes and # symbols
            let cleaned = tagMatch
              .replace(/^["']|["']$/g, "")
              .replace(/^#+/, "");

            // Sanitize tag name: replace spaces with underscores (Obsidian requirement)
            // This handles tags like "social media" -> "social_media"
            cleaned = cleaned.replace(/\s+/g, "_");

            // Remove any leading or trailing underscores
            cleaned = cleaned.replace(/^_+|_+$/g, "");

            return `"${cleaned}"`;
          });

          // Preserve original formatting (single-line vs multiline)
          const isMultiline = tagsContent.includes("\n");
          if (isMultiline) {
            return `tags: [\n${cleanedTags
              .map((tag: string) => `  ${tag}`)
              .join(",\n")}\n]`;
          } else {
            return `tags: [${cleanedTags.join(", ")}]`;
          }
        }
      );

      // Replace the frontmatter section with cleaned version
      content = content.replace(
        frontmatterRegex,
        `---\n${frontmatterContent}\n---${closingNewline}`
      );
    }

    // Then, clean up inline tags in the content body
    const lines = content.split("\n");
    let inFrontmatter = false;
    const cleanedLines = lines.map(line => {
      // Track frontmatter boundaries
      if (line.trim() === "---") {
        inFrontmatter = !inFrontmatter;
        return line;
      }

      // Skip processing inside frontmatter (already handled above)
      if (inFrontmatter) {
        return line;
      }

      // Skip markdown headers (lines starting with #)
      if (/^#{1,6}\s/.test(line)) {
        return line;
      }

      // Skip code blocks
      if (line.trim().startsWith("```")) {
        return line;
      }

      // Replace ##tag with #tag (multiple # before a tag word)
      // This handles cases where AI adds # to tags that already get # from Obsidian
      return line.replace(/(\s|^)(#{2,})([a-zA-Z0-9_-]+)/g, "$1#$3");
    });

    return cleanedLines.join("\n");
  }

  async streamFormatInCurrentNote({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<void> {
    try {
      new Notice("Formatting content...", 3000);

      let formattedContent = "";
      const updateCallback = (partialContent: string) => {
        formattedContent = this.cleanupTagsInContent(partialContent);
        void this.app.vault.modify(file, formattedContent);
      };

      if (this.settings.enableBackupCreation) {
        const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
          file
        );
        await this.formatStream(
          content,
          formattingInstruction,
          this.getServerUrl(),
          this.settings.API_KEY,
          updateCallback
        );
        void this.appendBackupLinkToCurrentFile(file, backupFile);
        await this.appendFormattedLinkToBackupFile(backupFile, file);
      } else {
        await this.formatStream(
          content,
          formattingInstruction,
          this.getServerUrl(),
          this.settings.API_KEY,
          updateCallback
        );
      }

      new Notice("Content formatted successfully", 3000);
    } catch (error) {
      logger.error("Error formatting content:", error);
      new Notice("An error occurred while formatting the content.", 6000);
      throw error;
    }
  }

  async streamFormatAppendInCurrentNote({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<void> {
    try {
      new Notice("Appending formatted content...", 3000);

      let formattedContent = "";
      const updateCallback = (partialContent: string) => {
        formattedContent = partialContent;
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );

      await this.app.vault.append(file, "\n\n" + formattedContent);

      new Notice("Content appended successfully", 3000);
    } catch (error) {
      logger.error("Error appending content:", error);
      new Notice("An error occurred while appending content.", 6000);
    }
  }

  async streamFormatInCurrentNoteLineByLine({
    file,
    formattingInstruction,
    content,
    chunkMode = "line",
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
    chunkMode?: "line" | "partial";
  }): Promise<void> {
    try {
      new Notice("Formatting content line by line...", 3000);

      let formattedContent = "";
      let lastLineCount = 0;

      const updateCallback = (chunk: string) => {
        if (chunkMode === "line") {
          const lines = chunk.split("\n");
          const newLines = lines.slice(lastLineCount);
          if (newLines.length > 0) {
            formattedContent = lines.join("\n");
            lastLineCount = lines.length;
            void this.app.vault.modify(file, formattedContent);
          }
        } else {
          formattedContent = chunk;
          void this.app.vault.modify(file, formattedContent);
        }
      };

      if (this.settings.enableBackupCreation) {
        const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
          file
        );
        await this.formatStream(
          content,
          formattingInstruction,
          this.getServerUrl(),
          this.getApiKey(),
          updateCallback
        );
        await this.appendBackupLinkToCurrentFile(file, backupFile);
        await this.appendFormattedLinkToBackupFile(backupFile, file);
      } else {
        await this.formatStream(
          content,
          formattingInstruction,
          this.getServerUrl(),
          this.getApiKey(),
          updateCallback
        );
      }

      new Notice("Line-by-line update done!", 3000);
    } catch (error) {
      logger.error("Error formatting content line by line:", error);
      new Notice("An error occurred while formatting the content.", 6000);
      throw error; // Re-throw to allow component to handle error state
    }
  }

  async createFileInInbox(title: string, content: string): Promise<void> {
    const fileName = `${title}.md`;
    const filePath = `${this.settings.pathToWatch}/${fileName}`;
    await this.app.vault.create(filePath, content);
  }

  async extractTextFromPDF(file: TFile): Promise<string> {
    const pdfjsLib = (await loadPdfJs()) as PdfJsLib;
    try {
      const arrayBuffer = await this.app.vault.readBinary(file);
      const bytes = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pageTexts: string[] = [];

      // Use pdfPageLimit to cap the maximum pages read.
      const pageLimit = Math.min(doc.numPages, this.settings.pdfPageLimit);
      for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        pageTexts.push(layoutPdfTextItems(textContent.items));
      }
      return pageTexts.join("\n\n");
    } catch (error) {
      logger.error(`Error extracting text from PDF: ${error}`);
      return "";
    }
  }
  getApiKey(): string {
    return this.settings.API_KEY;
  }
  async getCurrentFileLinks(file: TFile): Promise<LinkCache[]> {
    // force metadata cache to be loaded
    await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.links || [];
  }

  async formatStream(
    content: string,
    formattingInstruction: string,
    serverUrl: string,
    apiKey: string,
    updateCallback: (partialContent: string) => void
  ): Promise<string> {
    const requestBody: unknown = {
      content,
      formattingInstruction,
    };

    const response = await obsidianFetch(`${serverUrl}/api/format-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorMessage = await parseApiErrorMessage(
        response,
        `Formatting failed: ${response.statusText}`
      );
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let formattedContent = "";

    while (true) {
      const { done, value } = (await reader?.read()) ?? {
        done: true,
        value: undefined,
      };
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      formattedContent += chunk;
      updateCallback(formattedContent);
    }

    return formattedContent;
  }

  /**
   * Direct upload method for audio transcription (used for files < 4MB or as fallback when R2 is not configured)
   */
  async transcribeAudioDirectUpload(
    audioBuffer: ArrayBuffer,
    fileExtension: string
  ): Promise<Response> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: `audio/${fileExtension}` });
    formData.append("audio", blob, `audio.${fileExtension}`);

    const response = await obsidianFetch(`${this.getServerUrl()}/api/transcribe`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await readResponseJson<ApiErrorBody>(response);
      throw new Error(
        `Transcription failed: ${getApiError(errorData) ?? response.statusText}`
      );
    }
    return response;
  }

  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    fileExtension: string
  ): Promise<Response> {
    const fileSizeInMB = audioBuffer.byteLength / (1024 * 1024);
    const PRESIGNED_URL_THRESHOLD_MB = 4; // Use pre-signed URL for files > 4MB to avoid Vercel limits

    // For larger files, use pre-signed URL upload to bypass Vercel body size limit
    if (fileSizeInMB > PRESIGNED_URL_THRESHOLD_MB) {
      return this.transcribeAudioViaPresignedUrl(audioBuffer, fileExtension);
    }

    // For smaller files, use direct form data upload
    return this.transcribeAudioDirectUpload(audioBuffer, fileExtension);
  }

  async transcribeAudioViaPresignedUrl(
    audioBuffer: ArrayBuffer,
    fileExtension: string
  ): Promise<Response> {
    const fileName = `audio-${Date.now()}.${fileExtension}`;
    const mimeType = `audio/${fileExtension}`;

    try {
      // Step 1: Get presigned URL from backend (small JSON request, bypasses Vercel body size limit)
      const presignedUrlResponse = await obsidianFetch(
        `${this.getServerUrl()}/api/create-upload-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.settings.API_KEY}`,
          },
          body: JSON.stringify({
            filename: fileName,
            contentType: mimeType,
          }),
        }
      );

      if (!presignedUrlResponse.ok) {
        const errorData =
          await readResponseJson<PresignedUrlErrorBody>(presignedUrlResponse);
        const errorMessage =
          getApiError(errorData) || errorData.details || "Unknown error";

        // Check if error is due to missing R2 configuration
        if (
          errorMessage.includes("Missing R2 configuration") ||
          errorMessage.includes("R2 storage is not properly configured") ||
          errorMessage.includes("R2_PUBLIC_URL")
        ) {
          // Fall back to direct upload for self-hosted instances without R2
          console.debug(
            "R2 not configured, falling back to direct upload for self-hosted instance"
          );
          return this.transcribeAudioDirectUpload(audioBuffer, fileExtension);
        }

        throw new Error(`Failed to get presigned URL: ${errorMessage}`);
      }

      const { uploadUrl, key, publicUrl } =
        await readResponseJson<PresignedUrlResponse>(presignedUrlResponse);

      if (!uploadUrl || !key || !publicUrl) {
        throw new Error("Invalid response from create-upload-url endpoint");
      }

      // Step 2: Upload directly to R2 using presigned URL (bypasses Vercel completely)
      // This avoids Vercel's 4.5MB body size limit
      // CORS is configured on R2 bucket, so we can use fetch with ArrayBuffer directly
      // This ensures binary data integrity without any string conversion
      const uploadResponse = await obsidianFetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
          // DO NOT include Authorization header - presigned URL handles auth
        },
        body: audioBuffer, // Send ArrayBuffer directly - no conversion needed
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload audio to R2: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      // Step 3: Trigger transcription with the uploaded file URL
      const transcribeResponse = await obsidianFetch(
        `${this.getServerUrl()}/api/transcribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.settings.API_KEY}`,
          },
          body: JSON.stringify({
            fileUrl: publicUrl,
            key: key,
            extension: fileExtension,
          }),
        }
      );

      if (!transcribeResponse.ok) {
        const errorData =
          await readResponseJson<ApiErrorBody>(transcribeResponse);
        throw new Error(
          `Transcription failed: ${getApiError(errorData) ?? transcribeResponse.statusText}`
        );
      }

      return transcribeResponse;
    } catch (error) {
      // If any error related to presigned URL or R2, try direct upload as fallback
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("presigned URL") ||
        errorMessage.includes("R2") ||
        errorMessage.includes("Failed to upload audio to R2")
      ) {
        console.debug(
          "R2 upload failed, falling back to direct upload for self-hosted instance"
        );
        return this.transcribeAudioDirectUpload(audioBuffer, fileExtension);
      }
      // Re-throw other errors (network, auth, etc.)
      throw error;
    }
  }

  async generateTranscriptFromAudio(
    file: TFile
  ): Promise<AsyncIterableIterator<string>> {
    try {
      const fileSizeInMB = file.stat.size / (1024 * 1024);
      const audioBuffer = await this.app.vault.readBinary(file);
      console.debug(
        `[Plugin] Transcribing audio file: ${
          file.name
        }, size: ${fileSizeInMB.toFixed(2)}MB`
      );

      const response = await this.transcribeAudio(audioBuffer, file.extension);

      const data = await readResponseJson<TranscribeJsonResponse>(response);
      const transcript = data.text;
      const transcriptLength = transcript?.length || 0;

      console.debug(
        `[Plugin] Received transcript: ${transcriptLength} characters`
      );

      if (data.length) {
        console.debug(
          `[Plugin] Server reported transcript length: ${data.length} characters`
        );
        if (transcriptLength !== data.length) {
          console.warn(
            `[Plugin] WARNING: Transcript length mismatch! Received ${transcriptLength} but server reported ${data.length}`
          );
        }
      }

      // Convert the single transcript to an async iterator for compatibility
      async function* generateTranscript() {
        yield transcript;
      }

      return generateTranscript();
    } catch (error) {
      console.error("Error generating transcript from audio:", error);
      throw error;
    }
  }

  async classifyContentV2(
    content: string,
    classifications: string[],
    options?: { signal?: AbortSignal }
  ): Promise<string> {
    const cutoff = this.settings.contentCutoffChars;
    const trimmedContent = content.slice(0, cutoff);

    // Check if local LLM should be used (same logic as chat component)
    // Use local LLM if showLocalLLMInChat is enabled and model is not a cloud model
    const isCloudModel = this.settings.selectedModel === "gpt-4o-mini";
    const shouldUseLocalLLM =
      this.settings.showLocalLLMInChat && !isCloudModel;

    if (shouldUseLocalLLM) {
      // Use local Ollama model directly
      const modelName =
        this.settings.selectedModel === "llama3.2"
          ? "llama3.2"
          : this.settings.customModelName || "llama3.2";

      try {
        const response = await generateObject({
          model: ollama(modelName),
          schema: z.object({
            documentType: z.string().optional(),
          }),
          system:
            "Only answer with the name of the document type if it matches one of the template types. Otherwise, answer with an empty string.",
          prompt: `Given the text content:

          "${trimmedContent}"

          Please identify which of the following document types best matches the content:

          Template Types:
          ${classifications.join(", ")}

          If the content clearly matches one of the provided template types, respond with the name of that document type. If the content does not clearly match any of the template types, respond with an empty string.`,
        });

        return response.object.documentType || "";
      } catch (error) {
        logger.error("Error classifying with local LLM:", error);
        // Throw error instead of falling back to server
        // This ensures local-only mode doesn't require external connection
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to classify document with local LLM";
        throw new Error(errorMessage);
      }
    }

    // Use server-based approach (default or fallback)
    const serverUrl = this.getServerUrl();
    const response = await obsidianFetch(`${serverUrl}/api/classify1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      signal: options?.signal,
      body: JSON.stringify({
        content: trimmedContent,
        templateNames: classifications,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        const errorMessage = await parseApiErrorMessage(
          response,
          "Token limit exceeded. Please upgrade your plan for more tokens."
        );
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as Error & {
          status: number;
          isTokenLimitError: boolean;
        };
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      const errorMessage = await parseApiErrorMessage(
        response,
        `HTTP error! status: ${response.status}`
      );
      throw new Error(errorMessage);
    }

    const { documentType } =
      await readResponseJson<ClassifyResponse>(response);
    return documentType ?? "";
  }

  async getTextFromFile(file: TFile): Promise<string> {
    switch (true) {
      case file.extension === "md":
        return await this.app.vault.read(file);
      case file.extension === "pdf": {
        const pdfContent = await this.extractTextFromPDF(file);
        return pdfContent;
      }
      case VALID_IMAGE_EXTENSIONS.includes(file.extension):
        return await this.generateImageAnnotation(file);
      case VALID_AUDIO_EXTENSIONS.includes(file.extension): {
        // Change this part to consume the iterator
        const transcriptIterator = await this.generateTranscriptFromAudio(file);
        let transcriptText = "";
        for await (const chunk of transcriptIterator) {
          transcriptText += chunk;
        }
        return transcriptText;
      }
      default:
        throw new Error(`Unsupported file type: ${file.extension}`);
    }
  }

  // adds an attachment to a file using the ![[attachment]] syntax
  async appendAttachment(markdownFile: TFile, attachmentFile: TFile) {
    await this.app.vault.append(
      markdownFile,
      `\n\n![[${attachmentFile.path}]]`
    );
  }
  async appendToFrontMatter(file: TFile, key: string, value: string) {
    await this.app.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        if (!(key in frontmatter)) {
          frontmatter[key] = [value];
        } else if (!Array.isArray(frontmatter[key])) {
          frontmatter[key] = [frontmatter[key], value];
        } else {
          (frontmatter[key] as string[]).push(value);
        }
      }
    );
  }

  async checkAndCreateFolders() {
    await checkAndCreateFolders(this.app, this.settings);
  }

  async checkAndCreateTemplates() {
    await checkAndCreateTemplates(this.app, this.settings);
  }

  async restoreTemplates() {
    try {
      await restoreDefaultTemplates(this.app, this.settings);
      new Notice("Default templates restored successfully", 3000);
      logger.info("Default templates restored");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to restore templates: ${errorMessage}`, 5000);
      logger.error("Failed to restore templates:", error);
      throw error;
    }
  }

  async ensureFolderExists(folderPath: string) {
    await ensureFolderExists(this.app, folderPath);
  }

  async moveFile(
    file: TFile,
    humanReadableFileName: string,
    destinationFolder = ""
  ): Promise<TFile> {
    const fileExtension = file.extension;
    let targetPath = `${destinationFolder}/${humanReadableFileName}.${fileExtension}`;
    const normalizedTargetPath = normalizePath(targetPath);

    if (await this.app.vault.adapter.exists(normalizedTargetPath)) {
      const timestamp = Date.now();
      const uniqueFileName = `${humanReadableFileName}_${timestamp}`;
      targetPath = `${destinationFolder}/${uniqueFileName}.${fileExtension}`;
    }

    const normalizedFinalPath = normalizePath(targetPath);
    await ensureFolderExists(this.app, destinationFolder);
    await this.app.fileManager.renameFile(file, normalizedFinalPath);

    const movedFile = this.app.vault.getAbstractFileByPath(normalizedFinalPath);
    if (!(movedFile instanceof TFile)) {
      throw new Error(`Failed to move file to ${normalizedFinalPath}`);
    }
    return movedFile;
  }
  // rn used to provide aichat contex
  getAllUserMarkdownFiles(): TFile[] {
    const settingsPaths = [
      this.settings.pathToWatch,
      this.settings.defaultDestinationPath,
      this.settings.attachmentsPath,
      this.settings.backupFolderPath,
    ];
    const allFiles = this.app.vault.getMarkdownFiles();
    // remove any file path that is part of the settingsPath
    const allFilesFiltered = allFiles.filter(
      file => !settingsPaths.some(path => file.path.includes(path))
    );

    return allFilesFiltered;
  }
  getAllIgnoredFolders(): string[] {
    const ignoredFolders = [
      ...this.settings.ignoreFolders,
      this.settings.defaultDestinationPath,
      this.settings.attachmentsPath,
      this.settings.backupFolderPath,
      this.settings.templatePaths,
      this.settings.pathToWatch,
      this.settings.errorFilePath,
      "_NoteCompanion",
      "/",
    ];
    logMessage("ignoredFolders", ignoredFolders);
    // remove empty strings
    return ignoredFolders.filter(folder => folder !== "");
  }
  // this is a list of all the folders that file organizer to use for organization
  getAllUserFolders(): string[] {
    if (this.userFoldersCache) {
      return this.userFoldersCache;
    }

    const allFolders = this.app.vault.getAllFolders();
    const allFoldersPaths = allFolders.map(folder => folder.path);
    const ignoredFolders = this.getAllIgnoredFolders();

    // If ignoreFolders includes "*", return empty array as all folders are ignored
    if (this.settings.ignoreFolders.includes("*")) {
      this.userFoldersCache = [];
      return this.userFoldersCache;
    }

    this.userFoldersCache = allFoldersPaths.filter(folder => {
      // Check if the folder is not in the ignored folders list
      return (
        !ignoredFolders.includes(folder) &&
        !ignoredFolders.some(ignoredFolder =>
          folder.startsWith(ignoredFolder + "/")
        )
      );
    });

    if (!this.userFoldersCacheListenerRegistered) {
      this.userFoldersCacheListenerRegistered = true;
      const invalidateUserFoldersCache = () => {
        this.userFoldersCache = null;
      };
      this.registerEvent(this.app.vault.on("create", invalidateUserFoldersCache));
      this.registerEvent(this.app.vault.on("delete", invalidateUserFoldersCache));
      this.registerEvent(this.app.vault.on("rename", invalidateUserFoldersCache));
    }

    return this.userFoldersCache;
  }

  async compressImage(fileContent: ArrayBuffer): Promise<ArrayBuffer> {
    return compressImageForVision(fileContent);
  }

  isWebP(fileContent: ArrayBuffer | Uint8Array): boolean {
    return isWebP(fileContent);
  }

  async generateImageAnnotation(file: TFile) {
    const arrayBuffer = await this.app.vault.readBinary(file);
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`Could not read image file: ${file.path}`);
    }
    const imageSizeInMB2 = arrayBuffer.byteLength / (1024 * 1024);
    logMessage(`Image size: ${imageSizeInMB2.toFixed(2)} MB`);

    const processedArrayBuffer = await this.compressImage(arrayBuffer);
    return this.extractTextFromImage(processedArrayBuffer);
  }

  async extractTextFromImage(image: ArrayBuffer): Promise<string> {
    if (!image || image.byteLength === 0) {
      throw new Error("Image data is empty");
    }

    const base64Image = arrayBufferToBase64(image);

    const response = await obsidianFetch(`${this.getServerUrl()}/api/vision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        image: base64Image,
        instructions: this.settings.imageInstructions,
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseApiErrorMessage(
        response,
        `HTTP error! status: ${response.status}`
      );
      throw new Error(errorMessage);
    }

    const data = await readResponseJson<VisionResponse & ApiErrorBody>(response);
    const apiError = getApiError(data);
    if (apiError) {
      throw new Error(apiError);
    }
    if (typeof data.text !== "string") {
      throw new Error("Vision API returned no extracted text");
    }
    return data.text;
  }

  async getBacklog() {
    const pathToWatch = this.settings.pathToWatch;
    if (!pathToWatch) return [];
    const allFiles = this.app.vault.getFiles();
    const pendingFiles = allFiles.filter(
      (file) =>
        file.path === pathToWatch || file.path.startsWith(pathToWatch + "/")
    );
    return pendingFiles;
  }
  async processBacklog() {
    const pendingFiles = await this.getBacklog();
    logMessage("Enqueuing files from backlog V3");
    Inbox.getInstance().enqueueFiles(pendingFiles);
    if (pendingFiles.length > 0) {
      new Notice(
        `Note Companion: Processing ${pendingFiles.length} file(s) from inbox`
      );
    }
    return;
  }

  async getAllVaultTags(): Promise<string[]> {
    if (this.vaultTagsCache) {
      return this.vaultTagsCache;
    }

    const tagCounts: TagCounts = {};
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.tags) {
        continue;
      }
      for (const tagRef of cache.tags) {
        tagCounts[tagRef.tag] = (tagCounts[tagRef.tag] ?? 0) + 1;
      }
    }

    // If no tags are found, return an empty array
    if (Object.keys(tagCounts).length === 0) {
      logMessage("No tags found");
      return [];
    }

    // Sort tags by their occurrence count in descending order
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    const tagList = sortedTags.map(tag => tag[0]);
    this.vaultTagsCache = tagList;

    if (!this.vaultTagsCacheListenerRegistered) {
      this.vaultTagsCacheListenerRegistered = true;
      this.registerEvent(
        this.app.metadataCache.on("changed", () => {
          this.vaultTagsCache = null;
        })
      );
    }

    return tagList;
  }

  clearOrganizerSuggestionCaches(): void {
    clearSuggestionCaches();
    this.vaultTagsCache = null;
    this.userFoldersCache = null;
  }

  async recommendTags(
    content: string,
    filePath: string,
    existingTags: string[],
    options?: { forceRefresh?: boolean; signal?: AbortSignal }
  ): Promise<
    Array<{ score: number; tag: string; reason: string; isNew: boolean }>
  > {
    const cutoff = this.settings.contentCutoffChars;
    const cacheKey = buildSuggestionCacheKey(filePath, content, cutoff);

    if (!options?.forceRefresh) {
      const cached = getCachedTagSuggestions(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const trimmedContent = content.slice(0, cutoff);
    const tagsForAI = capTagsForAI(existingTags);

    // Check if local LLM should be used (same logic as chat component)
    const isCloudModel = this.settings.selectedModel === "gpt-4o-mini";
    const shouldUseLocalLLM =
      this.settings.showLocalLLMInChat && !isCloudModel;

    if (shouldUseLocalLLM) {
      // Use local Ollama model directly
      const modelName =
        this.settings.selectedModel === "llama3.2"
          ? "llama3.2"
          : this.settings.customModelName || "llama3.2";

      try {
        const count = 3; // Default count
        const response = await generateObject({
          model: ollama(modelName),
          schema: z.object({
            suggestedTags: z.array(
              z.object({
                score: z.number().min(0).max(100),
                isNew: z.boolean(),
                tag: z.string(),
                reason: z.string().min(1),
              })
            ),
          }),
          system: `You are a precise tag generator. Analyze content and suggest ${count} relevant tags.
              ${tagsForAI.length ? `Consider existing tags: ${tagsForAI.join(", ")}` : "Create new tags if needed."}
              ${this.settings.customTagInstructions ? `Follow these custom instructions: ${this.settings.customTagInstructions}` : ""}

              Guidelines:
              - Prefer existing tags when appropriate (score them higher)
              - Create specific, meaningful new tags when needed
              - Score based on relevance (0-100)
              - REQUIRED: Each tag MUST include a "reason" field explaining why it's relevant
              - The reason should be a brief sentence (1-2 sentences) explaining the tag's relevance
              - Focus on key themes, topics, and document type

              Response format: Each tag object must have: score (number), isNew (boolean), tag (string), and reason (string).`,
          prompt: `File: "${filePath}"

              Content: """
              ${trimmedContent}
              """`,
        });

        // Sort tags by score and format response
        // Ensure all required fields are present (explicit mapping to avoid optional types)
        const sortedTags: Array<{
          score: number;
          tag: string;
          reason: string;
          isNew: boolean;
        }> = response.object.suggestedTags
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((tag) => ({
            score: tag.score ?? 0,
            isNew: tag.isNew ?? false,
            tag: tag.tag.startsWith("#") ? tag.tag : `#${tag.tag}`,
            reason: tag.reason || "Relevant to content theme",
          }));

        setCachedTagSuggestions(cacheKey, sortedTags);
        return sortedTags;
      } catch (error) {
        logger.error("Error recommending tags with local LLM:", error);
        // Throw error instead of falling back to server
        // This ensures local-only mode doesn't require external connection
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to recommend tags with local LLM";
        throw new Error(errorMessage);
      }
    }

    // Use server-based approach (default or fallback)
    const response = await obsidianFetch(`${this.getServerUrl()}/api/tags/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      signal: options?.signal,
      body: JSON.stringify({
        content: trimmedContent,
        fileName: filePath,
        existingTags: tagsForAI,
        customInstructions: this.settings.customTagInstructions,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        const errorMessage = await parseApiErrorMessage(
          response,
          "Token limit exceeded. Please upgrade your plan for more tokens."
        );
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as Error & {
          status: number;
          isTokenLimitError: boolean;
        };
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      const errorMessage = await parseApiErrorMessage(
        response,
        `HTTP error! status: ${response.status}`
      );
      throw new Error(errorMessage);
    }

    const { tags: suggestedTags } =
      await readResponseJson<TagsResponse>(response);
    setCachedTagSuggestions(cacheKey, suggestedTags);
    return suggestedTags;
  }

  async recommendFolders(
    content: string,
    fileName: string,
    options?: { forceRefresh?: boolean; signal?: AbortSignal }
  ): Promise<FolderSuggestion[]> {
    const customInstructions = this.settings.customFolderInstructions;
    const cutoff = this.settings.contentCutoffChars;
    const cacheKey = buildSuggestionCacheKey(fileName, content, cutoff);

    if (!options?.forceRefresh) {
      const cached = getCachedFolderSuggestions(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const trimmedContent = content.slice(0, cutoff);

    const folders = prioritizeFoldersForAI(
      this.getAllUserFolders(),
      fileName
    );

    // Check if local LLM should be used (same logic as chat component)
    const isCloudModel = this.settings.selectedModel === "gpt-4o-mini";
    const shouldUseLocalLLM =
      this.settings.showLocalLLMInChat && !isCloudModel;

    if (shouldUseLocalLLM) {
      // Use local Ollama model directly
      const modelName =
        this.settings.selectedModel === "llama3.2"
          ? "llama3.2"
          : this.settings.customModelName || "llama3.2";

      try {
        const count = 3; // Default count
        const response = await generateObject({
          model: ollama(modelName),
          schema: z.object({
            suggestedFolders: z
              .array(
                z.object({
                  score: z.number().min(0).max(100),
                  isNewFolder: z.boolean(),
                  folder: z.string(),
                  reason: z.string(),
                })
              )
              .min(1)
              .max(count),
          }),
          system: `Given the content and file name: "${fileName}", suggest exactly ${count} folders. You can use: ${folders.join(
            ", "
          )}. If none are relevant, suggest new folders. ${
            customInstructions ? `Instructions: "${customInstructions}"` : ""
          }`,
          prompt: `Content: "${trimmedContent}"`,
        });

        // Ensure all required fields are present and match FolderSuggestion type
        const sortedFolders = response.object.suggestedFolders
          .sort((a, b) => b.score - a.score)
          .map((folder) => ({
            score: folder.score ?? 0,
            isNewFolder: folder.isNewFolder ?? false,
            folder: folder.folder ?? "",
            reason: folder.reason ?? "",
          }));

        setCachedFolderSuggestions(cacheKey, sortedFolders);
        return sortedFolders;
      } catch (error) {
        logger.error("Error recommending folders with local LLM:", error);
        // Throw error instead of falling back to server
        // This ensures local-only mode doesn't require external connection
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to recommend folders with local LLM";
        throw new Error(errorMessage);
      }
    }

    // Use server-based approach (default or fallback)
    const response = await obsidianFetch(`${this.getServerUrl()}/api/folders/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      signal: options?.signal,
      body: JSON.stringify({
        content: trimmedContent,
        fileName: fileName,
        folders,
        customInstructions,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        const errorMessage = await parseApiErrorMessage(
          response,
          "Token limit exceeded. Please upgrade your plan for more tokens."
        );
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as Error & {
          status: number;
          isTokenLimitError: boolean;
        };
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      const errorMessage = await parseApiErrorMessage(
        response,
        `HTTP error! status: ${response.status}`
      );
      throw new Error(errorMessage);
    }

    const data = await readResponseJson<FoldersResponse>(response);
    const suggestedFolders = data.folders || [];

    // Safety check: ensure we return an array
    if (!Array.isArray(suggestedFolders)) {
      logger.error("API returned non-array folders:", suggestedFolders);
      return [];
    }

    setCachedFolderSuggestions(cacheKey, suggestedFolders);
    return suggestedFolders;
  }

  async appendTag(file: TFile, tag: string) {
    // Ensure the tag starts with a hash symbol
    const formattedTag = sanitizeTag(tag);

    // Get the file content and metadata
    const fileContent = await this.app.vault.read(file);
    const metadata = this.app.metadataCache.getFileCache(file);

    // Check if tag exists in frontmatter
    const rawFrontmatterTags: unknown = metadata?.frontmatter?.tags;
    const tagName = formattedTag.replace("#", "");
    const hasFrontmatterTag =
      Array.isArray(rawFrontmatterTags) &&
      rawFrontmatterTags.some(
        (t): t is string => typeof t === "string" && t === tagName
      );

    // Check if tag exists in content (for inline tags)
    const hasInlineTag = fileContent.includes(formattedTag);

    // If tag already exists, skip adding it
    if (hasFrontmatterTag || hasInlineTag) {
      return;
    }

    // Append similar tags
    if (this.settings.useSimilarTagsInFrontmatter) {
      await this.appendToFrontMatter(
        file,
        "tags",
        formattedTag.replace("#", "")
      );
      return;
    }

    // If we find no '#' symbol at all, add a blank line before appending the first tag
    if (!fileContent.includes("#")) {
      await this.app.vault.append(file, `\n\n${formattedTag}`);
    } else {
      await this.app.vault.append(file, `\n${formattedTag}`);
    }
  }

  async ensureAssistantView(): Promise<AssistantViewWrapper | null> {
    // Try to find existing view
    let view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
      ?.view as AssistantViewWrapper;

    // If view doesn't exist, create it
    if (!view) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: ORGANIZER_VIEW_TYPE,
          active: true,
        });

        // Get the newly created view
        view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
          ?.view as AssistantViewWrapper;
      }
    }

    // Reveal and focus the leaf
    if (view) {
      void this.app.workspace.revealLeaf(view.leaf);
    }

    return view;
  }

  async onload() {
    this.inbox = Inbox.initialize(this);
    await this.initializePlugin();
    logger.configure(this.settings.debugMode);

    await this.saveSettings();
    await ensureFolderExists(this.app, this.settings.logFolderPath);

    initializeInboxQueue(this);

    // Initialize different features
    initializeOrganizer(this);
    initializeFileOrganizationCommands(this);

    this.app.workspace.onLayoutReady(() => registerEventHandlers(this));
    if (this.settings.useInbox) {
      void this.processBacklog();
    }

    this.addCommand({
      id: "open-organizer-tab",
      name: "Open organizer tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("organizer");
      },
    });

    this.addCommand({
      id: "open-inbox-tab",
      name: "Open inbox tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("inbox");
      },
    });

    this.addCommand({
      id: "process-inbox-now",
      name: "Process inbox now",
      callback: async () => {
        await this.processBacklog();
      },
    });

    this.addCommand({
      id: "open-chat-tab",
      name: "Open chat tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("chat");
      },
    });
    this.addCommand({
      id: "open-meetings-tab",
      name: "Open meetings tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("meetings");
      },
    });

    this.addCommand({
      id: "restore-default-templates",
      name: "Restore default templates",
      callback: async () => {
        const confirmed = await new Promise<boolean>(resolve => {
          class RestoreTemplatesModal extends Modal {
            onOpen() {
              const { contentEl } = this;
              contentEl.empty();
              contentEl.createEl("h2", { text: "Restore default templates" });
              contentEl.createEl("p", {
                text: "This will restore the following templates to their original plugin versions:",
              });
              const list = contentEl.createEl("ul");
              for (const templateName of DEFAULT_TEMPLATE_NAMES) {
                list.createEl("li", { text: templateName });
              }
              contentEl.createEl("p", {
                text: "Your custom templates will not be affected.",
                attr: { style: "margin-top: 1em; font-weight: bold;" },
              });
              const buttonContainer = contentEl.createDiv({
                attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
              });
              buttonContainer
                .createEl("button", { text: "Cancel" })
                .addEventListener("click", () => {
                  resolve(false);
                  this.close();
                });
              buttonContainer
                .createEl("button", {
                  text: "Restore",
                  attr: { style: "background: var(--interactive-accent);" },
                })
                .addEventListener("click", () => {
                  resolve(true);
                  this.close();
                });
            }
          }
          const modal = new RestoreTemplatesModal(this.app);
          modal.open();
        });

        if (confirmed) {
          await this.restoreTemplates();
        }
      },
    });

    this.addCommand({
      id: "view-meetings-metadata",
      name: "View meetings metadata (debug)",
      callback: async () => {
        const { MeetingMetadataManager } = await import(
          "./views/assistant/meetings/meeting-metadata"
        );
        const manager = new MeetingMetadataManager(this);
        const metadata = await manager.loadMetadata();
        console.debug("Meetings Metadata:", JSON.stringify(metadata, null, 2));
        new Notice(
          "Meetings metadata logged to console. Check Developer Tools (Ctrl+Shift+I)"
        );
      },
    });
    this.addCommand({
      id: "add-selection-to-chat",
      name: "Add selection to chat",
      editorCallback: async editor => {
        const selection = editor.getSelection();
        if (selection) {
          const activeFile = this.app.workspace.getActiveFile();
          const view = await this.ensureAssistantView();

          // Add the selection to context
          addTextSelectionContext({
            content: selection,
            sourceFile: activeFile?.path,
          });

          // Open chat tab
          view?.activateTab("chat");
        } else {
          new Notice("No text selected");
        }
      },
    });

    this.addCommand({
      id: "extract-selection-to-new-note",
      name: "Extract selection to new note",
      editorCallback: async () => {
        const result = await extractSelectionToNewNote(this.app);
        if (result.ok === false) {
          new Notice(result.error, 4000);
          return;
        }
        const name = result.newFilePath.split("/").pop() ?? result.newFilePath;
        new Notice(`Extracted to ${name}`, 3500);
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        if (!editor.getSelection()?.trim()) return;
        const active = this.app.workspace.getActiveFile();
        if (!active || active.extension !== "md") return;
        menu.addItem(item => {
          item
            .setTitle("Extract selection to new note")
            .setIcon("file-plus")
            .onClick(() => {
              void (async () => {
              const result = await extractSelectionToNewNote(this.app);
              if (result.ok === false) {
                new Notice(result.error, 4000);
                return;
              }
              const name =
                result.newFilePath.split("/").pop() ?? result.newFilePath;
              new Notice(`Extracted to ${name}`, 3500);
              })();
            });
        });
      })
    );

    this.addCommand({
      id: "test-screenpipe",
      name: "Test screenpipe connection",
      callback: async () => {
        const { ScreenpipeClient } = await import("./services/screenpipe-client");
        const client = new ScreenpipeClient(this.settings.screenpipeApiUrl);

        const isAvailable = await client.isAvailable();
        if (!isAvailable) {
          new Notice(
            "❌ ScreenPipe not available on " + this.settings.screenpipeApiUrl,
            5000
          );
          return;
        }

        new Notice("✅ Screenpipe connected!", 2000);

        try {
          const results = await client.search({ limit: 5 });
          new Notice(`✅ Found ${results.length} results`, 3000);
          console.debug("ScreenPipe test results:", results);
        } catch (error) {
          new Notice(
            "❌ Search failed: " + (error instanceof Error ? error.message : "Unknown error"),
            5000
          );
        }
      },
    });

    // Add command to test ScreenPipe search
    this.addCommand({
      id: "test-screenpipe-search",
      name: "Test screenpipe search (recent activity)",
      callback: async () => {
        if (!this.settings.enableScreenpipe) {
          new Notice("❌ Screenpipe is disabled. Enable it in settings > experiments > integrations", 5000);
          return;
        }

        const { ScreenpipeClient } = await import("./services/screenpipe-client");
        const client = new ScreenpipeClient(this.settings.screenpipeApiUrl);

        const isAvailable = await client.isAvailable();
        if (!isAvailable) {
          new Notice(
            "❌ ScreenPipe not available on " + this.settings.screenpipeApiUrl,
            5000
          );
          return;
        }

        new Notice("🔍 Searching recent activity...", 2000);

        try {
          // Search for last 30 minutes of activity
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const results = await client.search({
            limit: 10,
            start_time: thirtyMinutesAgo,
            content_type: "all",
          });
          
          if (results.length === 0) {
            new Notice("ℹ️ no recent activity found in last 30 minutes", 3000);
          } else {
            const apps = [
              ...new Set(
                results.map(
                  (r) => r.content?.app_name ?? "Unknown"
                )
              ),
            ];
            new Notice(
              `✅ Found ${results.length} result${results.length > 1 ? 's' : ''} from ${apps.length} app${apps.length > 1 ? 's' : ''}: ${apps.join(", ")}`,
              5000
            );
            console.debug("ScreenPipe search results:", results);
          }
        } catch (error) {
          new Notice(
            "❌ Search failed: " + (error instanceof Error ? error.message : "Unknown error"),
            5000
          );
        }
      },
    });

    // Register the dashboard view
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      leaf => new DashboardView(leaf, this)
    );

    // Add command to open dashboard
    this.addCommand({
      id: "open-fo2k-dashboard",
      name: "Open dashboard",
      callback: () => {
        void this.activateDashboard();
      },
    });

    // Add processing status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarRoot = createRoot(this.statusBarItem);
    this.statusBarRoot.render(
      React.createElement(ProcessingStatusBar, { plugin: this })
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }

  async initializePlugin() {
    await this.loadSettings();
    await this.checkAndCreateFolders();
    await this.checkAndCreateTemplates();
    this.addSettingTab(new FileOrganizerSettingTab(this.app, this));
  }

  /**
   * Checks if a transcript already exists in the note for the given audio file.
   * Looks for the heading pattern: ## Transcript for [filename]
   *
   * @param fileContent - The content of the note file
   * @param audioFileName - The name of the audio file (with or without extension)
   * @returns true if transcript exists, false otherwise
   */
  hasExistingTranscript(fileContent: string, audioFileName: string): boolean {
    // Normalize the filename - remove extension if present for matching
    const nameWithoutExt = audioFileName.replace(
      /\.(mp3|wav|m4a|ogg|webm)$/i,
      ""
    );
    const nameWithExt = audioFileName;

    // Escape special regex characters in filenames
    const escapeRegex = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Check for both patterns: with and without extension
    // Use regex to match the full header line, not just a substring
    // The 'm' flag makes ^ and $ match line boundaries
    const pattern1 = new RegExp(
      `^## Transcript for ${escapeRegex(nameWithExt)}$`,
      "m"
    );
    const pattern2 = new RegExp(
      `^## Transcript for ${escapeRegex(nameWithoutExt)}$`,
      "m"
    );

    return pattern1.test(fileContent) || pattern2.test(fileContent);
  }

  async appendTranscriptToActiveFile(
    parentFile: TFile,
    audioFileName: string,
    transcriptIterator: AsyncIterableIterator<string>
  ) {
    // Check if transcript already exists before appending
    const fileContent = await this.app.vault.read(parentFile);
    if (this.hasExistingTranscript(fileContent, audioFileName)) {
      new Notice(
        `Transcript already exists for ${audioFileName}. Skipping transcription.`,
        5000
      );
      return;
    }

    const transcriptHeader = `\n\n## Transcript for ${audioFileName}\n\n`;
    await this.app.vault.append(parentFile, transcriptHeader);

    let totalAppended = 0;
    let chunkCount = 0;

    for await (const chunk of transcriptIterator) {
      const chunkLength = chunk.length;
      console.debug(
        `[Plugin] Appending transcript chunk ${++chunkCount}: ${chunkLength} characters`
      );
      await this.app.vault.append(parentFile, chunk);
      totalAppended += chunkLength;
    }

    console.debug(
      `[Plugin] Total transcript appended: ${totalAppended} characters in ${chunkCount} chunk(s)`
    );

    // Verify by reading back the file
    const updatedFileContent = await this.app.vault.read(parentFile);
    const transcriptStart = updatedFileContent.indexOf(transcriptHeader);
    if (transcriptStart !== -1) {
      const appendedTranscript = updatedFileContent.substring(
        transcriptStart + transcriptHeader.length
      );
      console.debug(
        `[Plugin] Verified: File contains ${appendedTranscript.length} characters of transcript`
      );
      if (appendedTranscript.length !== totalAppended) {
        console.warn(
          `[Plugin] WARNING: Mismatch! Appended ${totalAppended} but file contains ${appendedTranscript.length}`
        );
      }
    }

    new Notice(
      `Transcription completed for ${audioFileName} (${totalAppended} characters)`,
      5000
    );
  }

  async generateUniqueBackupFileName(originalFile: TFile): Promise<string> {
    const timestamp = window.moment().format("YYYYMMDD_HHmmss");
    const baseFileName = `${originalFile.basename}_backup_${timestamp}`;
    let fileName = `${baseFileName}.${originalFile.extension}`;
    let counter = 1;

    while (
      await this.app.vault.adapter.exists(
        normalizePath(`${this.settings.backupFolderPath}/${fileName}`)
      )
    ) {
      fileName = `${baseFileName}_${counter}.${originalFile.extension}`;
      counter++;
    }

    return fileName;
  }

  async backupTheFileAndAddReferenceToCurrentFile(file: TFile): Promise<TFile> {
    const backupFileName = await this.generateUniqueBackupFileName(file);
    const backupFilePath = normalizePath(
      `${this.settings.backupFolderPath}/${backupFileName}`
    );

    // Create a backup of the file
    const backupFile = await this.app.vault.copy(file, backupFilePath);

    return backupFile;
  }

  async getTemplateInstructions(templateName: string): Promise<string> {
    // Ensure template folder exists before accessing it
    const normalizedPath = normalizePath(this.settings.templatePaths);
    await ensureFolderExists(this.app, normalizedPath);

    // Ensure templates are created
    await this.checkAndCreateTemplates();

    // Small delay to ensure folder is fully created
    await new Promise(resolve => window.setTimeout(resolve, 100));

    const templateFolder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      logger.error(
        `Template folder not found or is not a valid folder. Path: ${normalizedPath}`
      );
      return "";
    }
    // only look at files first
    const templateFile = templateFolder.children.find(
      file => file instanceof TFile && file.basename === templateName
    );
    if (!templateFile || !(templateFile instanceof TFile)) {
      logger.error("Template file not found or is not a valid file.");
      return "";
    }
    return await this.app.vault.read(templateFile);
  }
  // create a getTemplatesV2 that returns a list of template names only
  // and doesn't reuse getTemplates()
  async getTemplateNames(): Promise<string[]> {
    // Ensure template folder exists before accessing it
    const normalizedPath = normalizePath(this.settings.templatePaths);
    await ensureFolderExists(this.app, normalizedPath);

    // Ensure templates are created
    await this.checkAndCreateTemplates();

    // Small delay to ensure folder is fully created
    await new Promise(resolve => window.setTimeout(resolve, 100));

    // get all file names in the template folder
    const templateFolder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      logger.error(
        `Template folder not found or is not a valid folder. Path: ${normalizedPath}`
      );
      return [];
    }
    const templateFiles = templateFolder.children.filter(
      file => file instanceof TFile
    );
    return templateFiles.map(file => file.basename);
  }

  async recommendName(
    content: string,
    fileName: string,
    options?: { signal?: AbortSignal }
  ): Promise<TitleSuggestion[]> {
    // cutoff
    const cutoff = this.settings.contentCutoffChars;
    const trimmedContent = content.slice(0, cutoff);

    const customInstructions = this.settings.renameInstructions;
    const response = await obsidianFetch(`${this.getServerUrl()}/api/title/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      signal: options?.signal,
      body: JSON.stringify({
        content: trimmedContent,
        fileName: fileName,
        customInstructions,
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseApiErrorMessage(
        response,
        `HTTP error! status: ${response.status}`
      );
      throw new Error(errorMessage);
    }

    const { titles } = await readResponseJson<TitlesResponse>(response);
    return titles;
  }

  async activateDashboard(): Promise<DashboardView | null> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: DASHBOARD_VIEW_TYPE,
          active: true,
        });
      } else {
        return null;
      }
    }

    void workspace.revealLeaf(leaf);
    return leaf.view as DashboardView;
  }

  // Create all necessary folders for the plugin to function properly
  public async checkAndCreateRequiredFolders(): Promise<void> {
    try {
      // Ensure all required folders exist - using app instead of app.vault
      const folderPaths = [
        this.settings.pathToWatch,
        this.settings.defaultDestinationPath,
        this.settings.referencePath,
        this.settings.attachmentsPath,
        this.settings.logFolderPath,
        this.settings.backupFolderPath,
        this.settings.templatePaths,
        this.settings.bypassedFilePath,
        this.settings.errorFilePath,
        this.settings.syncFolderPath,
      ];

      // Create each folder individually using ensureFolderExists
      for (const folderPath of folderPaths) {
        await ensureFolderExists(this.app, folderPath);
      }

      // Show success message
      new Notice("All required folders have been created successfully!", 3000);
    } catch (error) {
      console.error("Failed to create required folders:", error);
      new Notice(
        "There was an error creating the required folders. Please check console for details.",
        5000
      );
    }
  }

  async fetchUsageStats(): Promise<UsageData | null> {
    try {
      if (!this.settings.API_KEY) {
        return null;
      }

      // Try the public-usage endpoint first (works even with token limits)
      try {
        const publicResponse = await obsidianFetch(
          `${this.getServerUrl()}/api/public-usage`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.API_KEY}`,
            },
          }
        );

        if (publicResponse.ok) {
          return await readResponseJson<UsageData>(publicResponse);
        }

        logger.debug("Public usage endpoint failed, trying regular endpoint");
      } catch {
        logger.debug(
          "Error fetching from public usage endpoint, trying regular endpoint"
        );
      }

      // Fall back to the regular endpoint
      const response = await obsidianFetch(`${this.getServerUrl()}/api/usage`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorMessage = await parseApiErrorMessage(
          response,
          `Failed to fetch usage stats: ${response.status}`
        );

        // Special handling for token limit errors (429)
        if (response.status === 429) {
          // If we got a token limit error, create a synthetic response
          // with maxed out usage data
          if (errorMessage.includes("Token limit exceeded")) {
            // Try to get basic info from public API
            try {
              const publicResponse = await obsidianFetch(
                `${this.getServerUrl()}/api/public-usage`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.settings.API_KEY}`,
                  },
                }
              );

              if (publicResponse.ok) {
                return await readResponseJson<UsageData>(publicResponse);
              }
            } catch (e) {
              logger.debug(
                "Failed to get public usage after token limit error",
                e
              );
            }

            // Fallback if public API also fails
            return {
              tokenUsage: 100000, // Some large number
              maxTokenUsage: 100000,
              audioTranscriptionMinutes: 0,
              maxAudioTranscriptionMinutes: 0,
              subscriptionStatus: "active",
              currentPlan: "Subscription",
              isActive: true,
            };
          }
        }

        // For subscription inactive (403) or other errors, throw with specific message
        throw new Error(errorMessage);
      }

      return await readResponseJson<UsageData>(response);
    } catch (error) {
      logger.error("Failed to fetch usage statistics", error);
      return null;
    }
  }

  openUpgradePlanModal() {
    // Get the server domain from settings
    const serverUrl = this.getServerUrl();

    // Extract the domain from the full server URL
    // This pattern transforms "https://app.notecompanion.ai/api" into "https://app.notecompanion.ai"
    const serverDomain = serverUrl.replace(/\/api\/?$/, "");

    // Use the server domain for the upgrade URL
    const upgradeUrl = `${serverDomain}/onboarding`;

    // Log the URL being opened (helpful for debugging)
    logger.debug(`Opening upgrade plan URL: ${upgradeUrl}`);

    // Open the URL in a browser
    window.open(upgradeUrl, "_blank");
  }
}
