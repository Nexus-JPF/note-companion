import "./styles.css";

// Add Node.js type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "production" | "development" | string;
  }
}
declare const process: { env: NodeJS.ProcessEnv };
declare class Buffer {
  constructor(arg: ArrayBuffer | string, encoding?: string);
  toString(encoding?: string): string;
  slice(start?: number, end?: number): Buffer;
  byteLength: number;
  static from(arrayBuffer: ArrayBuffer): Buffer;
}

import {
  Plugin,
  Notice,
  Modal,
  TFolder,
  TFile,
  moment,
  normalizePath,
  loadPdfJs,
  arrayBufferToBase64,
  CachedMetadata,
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
import Jimp from "jimp/es/index";

import { FileOrganizerSettings, DEFAULT_SETTINGS } from "./settings";

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
  moveFile,
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
import { logger } from "./services/logger";
import { addTextSelectionContext } from "./views/assistant/ai-chat/use-context-items";
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

// determine sever url
interface ProcessingResult {
  text: string;
  classification?: string;
  formattedText: string;
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
interface TitleSuggestion {
  score: number;
  title: string;
  reason: string;
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Migration: Fix old gpt-4.1-mini model name to gpt-4o-mini
    if (this.settings.selectedModel === ("gpt-4.1-mini" as any)) {
      this.settings.selectedModel = "gpt-4o-mini";
      await this.saveSettings();
    }
  }

  async checkCatalystAccess(): Promise<boolean> {
    // fetch the file organizer premium status
    // if process env prod then point to prod server if not to localhost
    const serverUrl =
      process.env.NODE_ENV === "production"
        ? "https://app.notecompanion.ai"
        : this.getServerUrl();
    const premiumStatus = await fetch(`${serverUrl}/api/check-premium`, {
      headers: {
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
    });
    const { hasCatalystAccess } = await premiumStatus.json();
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
      const response = await fetch(
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
        // Try to extract error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }
        throw new Error(errorMessage);
      }

      const { concepts } = await response.json();
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
      const response = await fetch(`${this.getServerUrl()}/api/format`, {
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
        // Try to extract error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }
        throw new Error(errorMessage);
      }

      const { content: formattedContent } = await response.json();
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
  }): Promise<void> {
    try {
      new Notice("Formatting content in split view...", 3000);

      // Create a new file for the formatted content
      const newFileName = `${file.basename}-formatted-${Date.now()}.md`;
      const newFilePath = `${file.parent?.path}/${newFileName}`;
      const newFile = await this.app.vault.create(newFilePath, "");

      // Open the new file in a split view
      const leaf = this.app.workspace.splitActiveLeaf();
      await leaf.openFile(newFile);

      let formattedContent = "";
      const updateCallback = async (partialContent: string) => {
        formattedContent = partialContent;
        await this.app.vault.modify(newFile, formattedContent);
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );

      new Notice("Content formatted in split view successfully", 3000);
    } catch (error) {
      logger.error("Error formatting content in split view:", error);
      new Notice(
        "An error occurred while formatting the content in split view.",
        6000
      );
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
      (match, altText, videoId1, videoId2) => {
        // Use the first video ID (they should be the same, but handle both)
        const videoId = videoId1 || videoId2;
        return `![](https://www.youtube.com/watch?v=${videoId})`;
      }
    );
    // Also convert thumbnail image links to embeds
    content = content.replace(
      /\[!\[([^\]]*)\]\(https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]+)\/[^)]+\)\]\(https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\)/g,
      (match, altText, videoId1, videoId2) => {
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
        (match, tagsContent) => {
          // Extract all tags (handles both single-line and multiline arrays)
          const tagMatches = tagsContent.match(/["']([^"']*)["']/g) || [];
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
      return line.replace(/(\s|^)(#{2,})([a-zA-Z0-9_\-]+)/g, "$1#$3");
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

      // Backup the file before formatting and get the backup file
      const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
        file
      );

      let formattedContent = "";
      const updateCallback = async (partialContent: string) => {
        // Clean up tags before saving
        formattedContent = this.cleanupTagsInContent(partialContent);
        await this.app.vault.modify(file, formattedContent);
      };
      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );
      this.appendBackupLinkToCurrentFile(file, backupFile);
      await this.appendFormattedLinkToBackupFile(backupFile, file);

      new Notice("Content formatted successfully", 3000);
    } catch (error) {
      logger.error("Error formatting content:", error);
      new Notice("An error occurred while formatting the content.", 6000);
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
      const updateCallback = async (partialContent: string) => {
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

      // Backup the file before formatting
      const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
        file
      );

      // Prepare streaming
      let formattedContent = "";
      let lastLineCount = 0;

      const updateCallback = async (chunk: string) => {
        if (chunkMode === "line") {
          // Split chunk into lines and only append new lines
          const lines = chunk.split("\n");
          const newLines = lines.slice(lastLineCount);
          if (newLines.length > 0) {
            formattedContent = lines.join("\n");
            lastLineCount = lines.length;
            await this.app.vault.modify(file, formattedContent);
          }
        } else {
          // For partial mode, just append the new chunk
          formattedContent = chunk;
          await this.app.vault.modify(file, formattedContent);
        }
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.getApiKey(),
        updateCallback
      );

      // Insert reference to backup
      await this.appendBackupLinkToCurrentFile(file, backupFile);
      await this.appendFormattedLinkToBackupFile(backupFile, file);
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
    const pdfjsLib = await loadPdfJs(); // Ensure PDF.js is loaded
    try {
      const arrayBuffer = await this.app.vault.readBinary(file);
      const bytes = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      let text = "";

      // Use pdfPageLimit to cap the maximum pages read.
      const pageLimit = Math.min(doc.numPages, this.settings.pdfPageLimit);
      for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        text += textContent.items.map(item => item.str).join(" ");
      }
      return text;
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
    const requestBody: any = {
      content,
      formattingInstruction,
    };

    const response = await fetch(`${serverUrl}/api/format-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `Formatting failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
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

    const response = await fetch(`${this.getServerUrl()}/api/transcribe`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Transcription failed: ${errorData.error}`);
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
      const presignedUrlResponse = await fetch(
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
        const errorData = await presignedUrlResponse.json();
        const errorMessage =
          errorData.error || errorData.details || "Unknown error";

        // Check if error is due to missing R2 configuration
        if (
          errorMessage.includes("Missing R2 configuration") ||
          errorMessage.includes("R2 storage is not properly configured") ||
          errorMessage.includes("R2_PUBLIC_URL")
        ) {
          // Fall back to direct upload for self-hosted instances without R2
          console.log(
            "R2 not configured, falling back to direct upload for self-hosted instance"
          );
          return this.transcribeAudioDirectUpload(audioBuffer, fileExtension);
        }

        throw new Error(`Failed to get presigned URL: ${errorMessage}`);
      }

      const { uploadUrl, key, publicUrl } = await presignedUrlResponse.json();

      if (!uploadUrl || !key || !publicUrl) {
        throw new Error("Invalid response from create-upload-url endpoint");
      }

      // Step 2: Upload directly to R2 using presigned URL (bypasses Vercel completely)
      // This avoids Vercel's 4.5MB body size limit
      // CORS is configured on R2 bucket, so we can use fetch with ArrayBuffer directly
      // This ensures binary data integrity without any string conversion
      const uploadResponse = await fetch(uploadUrl, {
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
      const transcribeResponse = await fetch(
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
        const errorData = await transcribeResponse.json();
        throw new Error(`Transcription failed: ${errorData.error}`);
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
        console.log(
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
      // Check file size before reading (faster check using stat)
      const fileSizeInBytes = file.stat.size;
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
      const MAX_FILE_SIZE_MB = 25;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (fileSizeInBytes > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `Audio file is too large (${fileSizeInMB.toFixed(
            2
          )}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress or split the audio file.`
        );
      }

      const audioBuffer = await this.app.vault.readBinary(file);
      console.log(
        `[Plugin] Transcribing audio file: ${
          file.name
        }, size: ${fileSizeInMB.toFixed(2)}MB`
      );

      const response = await this.transcribeAudio(audioBuffer, file.extension);

      const data = await response.json();
      const transcript = data.text;
      const transcriptLength = transcript?.length || 0;

      console.log(
        `[Plugin] Received transcript: ${transcriptLength} characters`
      );

      if (data.length) {
        console.log(
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
    classifications: string[]
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
    const response = await fetch(`${serverUrl}/api/classify1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        templateNames: classifications,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        let errorMessage =
          "Token limit exceeded. Please upgrade your plan for more tokens.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { documentType } = await response.json();
    return documentType;
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
      `\n\n![[${attachmentFile.name}]]`
    );
  }
  async appendToFrontMatter(file: TFile, key: string, value: string) {
    await this.app.fileManager.processFrontMatter(file, frontmatter => {
      if (!frontmatter.hasOwnProperty(key)) {
        frontmatter[key] = [value];
      } else if (!Array.isArray(frontmatter[key])) {
        frontmatter[key] = [frontmatter[key], value];
      } else {
        frontmatter[key].push(value);
      }
    });
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
  ) {
    return await moveFile(
      this.app,
      file,
      humanReadableFileName,
      destinationFolder
    );
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
    const allFolders = this.app.vault.getAllFolders();
    const allFoldersPaths = allFolders.map(folder => folder.path);
    const ignoredFolders = this.getAllIgnoredFolders();

    // If ignoreFolders includes "*", return empty array as all folders are ignored
    if (this.settings.ignoreFolders.includes("*")) {
      return [];
    }

    return allFoldersPaths.filter(folder => {
      // Check if the folder is not in the ignored folders list
      return (
        !ignoredFolders.includes(folder) &&
        !ignoredFolders.some(ignoredFolder =>
          folder.startsWith(ignoredFolder + "/")
        )
      );
    });
  }

  async compressImage(fileContent: Buffer): Promise<Buffer> {
    const image = await Jimp.read(fileContent);

    // Check if the image is bigger than 1000 pixels in either width or height
    if (image.getWidth() > 1000 || image.getHeight() > 1000) {
      // Resize the image to a maximum of 1000x1000 while preserving aspect ratio
      image.scaleToFit(1000, 1000);
    }

    const resizedImage = await image.getBufferAsync(Jimp.MIME_PNG);
    return resizedImage;
  }

  isWebP(fileContent: Buffer): boolean {
    // Check if the file starts with the WebP signature
    return (
      fileContent.slice(0, 4).toString("hex") === "52494646" &&
      fileContent.slice(8, 12).toString("hex") === "57454250"
    );
  }

  async generateImageAnnotation(file: TFile) {
    const arrayBuffer = await this.app.vault.readBinary(file);
    const fileContent = Buffer.from(arrayBuffer);
    const imageSize = fileContent.byteLength;
    const imageSizeInMB2 = imageSize / (1024 * 1024);
    logMessage(`Image size: ${imageSizeInMB2.toFixed(2)} MB`);

    let processedArrayBuffer: ArrayBuffer;

    if (!this.isWebP(fileContent)) {
      // Compress the image if it's not a WebP
      const resizedImage = await this.compressImage(fileContent);
      // Convert the Buffer to an ArrayBuffer
      const tempArray = new Uint8Array(resizedImage.byteLength);
      for (let i = 0; i < resizedImage.byteLength; i++) {
        tempArray[i] = resizedImage[i];
      }
      processedArrayBuffer = tempArray.buffer;
    } else {
      // If it's a WebP, use the original file content directly
      processedArrayBuffer = arrayBuffer;
    }

    const processedContent = await this.extractTextFromImage(
      processedArrayBuffer
    );

    return processedContent;
  }

  async extractTextFromImage(image: ArrayBuffer): Promise<string> {
    const base64Image = arrayBufferToBase64(image);

    const response = await fetch(`${this.getServerUrl()}/api/vision`, {
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
      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { text } = await response.json();
    return text;
  }

  async getBacklog() {
    const allFiles = this.app.vault.getFiles();
    const pendingFiles = allFiles.filter(file =>
      file.path.includes(this.settings.pathToWatch)
    );
    return pendingFiles;
  }
  async processBacklog() {
    const pendingFiles = await this.getBacklog();
    logMessage("Enqueuing files from backlog V3");
    Inbox.getInstance().enqueueFiles(pendingFiles);
    return;
  }

  async getAllVaultTags(): Promise<string[]> {
    // Fetch all tags from the vault
    // @ts-ignore
    const tags: TagCounts = this.app.metadataCache.getTags();

    // If no tags are found, return an empty array
    if (Object.keys(tags).length === 0) {
      logMessage("No tags found");
      return [];
    }

    // Sort tags by their occurrence count in descending order
    const sortedTags = Object.entries(tags).sort((a, b) => b[1] - a[1]);

    // Return the list of sorted tags
    return sortedTags.map(tag => tag[0]);
  }

  async recommendTags(
    content: string,
    filePath: string,
    existingTags: string[]
  ): Promise<
    Array<{ score: number; tag: string; reason: string; isNew: boolean }>
  > {
    const cutoff = this.settings.contentCutoffChars;
    const trimmedContent = content.slice(0, cutoff);

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
              ${existingTags.length ? `Consider existing tags: ${existingTags.join(", ")}` : "Create new tags if needed."}
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
    const response = await fetch(`${this.getServerUrl()}/api/tags/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        fileName: filePath,
        existingTags,
        customInstructions: this.settings.customTagInstructions,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        let errorMessage =
          "Token limit exceeded. Please upgrade your plan for more tokens.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { tags: suggestedTags } = await response.json();
    return suggestedTags;
  }

  async recommendFolders(
    content: string,
    fileName: string
  ): Promise<FolderSuggestion[]> {
    const customInstructions = this.settings.customFolderInstructions;
    const cutoff = this.settings.contentCutoffChars;
    const trimmedContent = content.slice(0, cutoff);

    const folders = this.getAllUserFolders();

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
    const response = await fetch(`${this.getServerUrl()}/api/folders/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
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
        let errorMessage =
          "Token limit exceeded. Please upgrade your plan for more tokens.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const suggestedFolders = data.folders || [];

    // Safety check: ensure we return an array
    if (!Array.isArray(suggestedFolders)) {
      logger.error("API returned non-array folders:", suggestedFolders);
      return [];
    }

    return suggestedFolders;
  }

  async appendTag(file: TFile, tag: string) {
    // Ensure the tag starts with a hash symbol
    const formattedTag = sanitizeTag(tag);

    // Get the file content and metadata
    const fileContent = await this.app.vault.read(file);
    const metadata = this.app.metadataCache.getFileCache(file);

    // Check if tag exists in frontmatter
    const hasFrontmatterTag = metadata?.frontmatter?.tags?.includes(
      formattedTag.replace("#", "")
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
      this.app.workspace.revealLeaf(view.leaf);
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
    this.processBacklog();

    this.addCommand({
      id: "open-organizer-tab",
      name: "Open Organizer Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("organizer");
      },
    });

    this.addCommand({
      id: "open-inbox-tab",
      name: "Open Inbox Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("inbox");
      },
    });

    this.addCommand({
      id: "open-chat-tab",
      name: "Open Chat Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("chat");
      },
    });
    this.addCommand({
      id: "open-meetings-tab",
      name: "Open Meetings Tab",
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
              contentEl.createEl("h2", { text: "Restore Default Templates" });
              contentEl.createEl("p", {
                text: "This will restore the following templates to their original plugin versions:",
              });
              const list = contentEl.createEl("ul");
              list.createEl("li", { text: "meeting_note.md" });
              list.createEl("li", { text: "youtube_video.md" });
              list.createEl("li", { text: "enhance.md" });
              list.createEl("li", { text: "research_paper.md" });
              list.createEl("li", { text: "flash_cards.md" });
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
      name: "View Meetings Metadata (Debug)",
      callback: async () => {
        const { MeetingMetadataManager } = await import(
          "./views/assistant/meetings/meeting-metadata"
        );
        const manager = new MeetingMetadataManager(this);
        const metadata = await manager.loadMetadata();
        console.log("Meetings Metadata:", JSON.stringify(metadata, null, 2));
        new Notice(
          "Meetings metadata logged to console. Check Developer Tools (Ctrl+Shift+I)"
        );
      },
    });
    this.addCommand({
      id: "add-selection-to-chat",
      name: "Add Selection to Chat",
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
      id: "test-screenpipe",
      name: "Test ScreenPipe Connection",
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

        new Notice("✅ ScreenPipe connected!", 2000);

        try {
          const results = await client.search({ limit: 5 });
          new Notice(`✅ Found ${results.length} results`, 3000);
          console.log("ScreenPipe test results:", results);
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
      name: "Test ScreenPipe Search (Recent Activity)",
      callback: async () => {
        if (!this.settings.enableScreenpipe) {
          new Notice("❌ ScreenPipe is disabled. Enable it in Settings > Experiments > Integrations", 5000);
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
            new Notice("ℹ️ No recent activity found in last 30 minutes", 3000);
          } else {
            const apps = [...new Set(results.map((r: any) => r.content?.app_name || "Unknown"))];
            new Notice(
              `✅ Found ${results.length} result${results.length > 1 ? 's' : ''} from ${apps.length} app${apps.length > 1 ? 's' : ''}: ${apps.join(", ")}`,
              5000
            );
            console.log("ScreenPipe search results:", results);
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
      name: "Open Dashboard",
      callback: () => {
        this.activateDashboard();
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
      console.log(
        `[Plugin] Appending transcript chunk ${++chunkCount}: ${chunkLength} characters`
      );
      await this.app.vault.append(parentFile, chunk);
      totalAppended += chunkLength;
    }

    console.log(
      `[Plugin] Total transcript appended: ${totalAppended} characters in ${chunkCount} chunk(s)`
    );

    // Verify by reading back the file
    const updatedFileContent = await this.app.vault.read(parentFile);
    const transcriptStart = updatedFileContent.indexOf(transcriptHeader);
    if (transcriptStart !== -1) {
      const appendedTranscript = updatedFileContent.substring(
        transcriptStart + transcriptHeader.length
      );
      console.log(
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
    const baseFileName = `${originalFile.basename}_backup_${moment().format(
      "YYYYMMDD_HHmmss"
    )}`;
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
    await new Promise(resolve => setTimeout(resolve, 100));

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
    await new Promise(resolve => setTimeout(resolve, 100));

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
    ) as TFile[];
    return templateFiles.map(file => file.basename);
  }

  async recommendName(
    content: string,
    fileName: string
  ): Promise<TitleSuggestion[]> {
    // cutoff
    const cutoff = this.settings.contentCutoffChars;
    const trimmedContent = content.slice(0, cutoff);

    const customInstructions = this.settings.renameInstructions;
    const response = await fetch(`${this.getServerUrl()}/api/title/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        fileName: fileName,
        customInstructions,
      }),
    });

    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { titles } = await response.json();
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

    workspace.revealLeaf(leaf);
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
        const publicResponse = await fetch(
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
          const data = await publicResponse.json();
          return data;
        }

        logger.debug("Public usage endpoint failed, trying regular endpoint");
      } catch (error) {
        logger.debug(
          "Error fetching from public usage endpoint, trying regular endpoint"
        );
      }

      // Fall back to the regular endpoint
      const response = await fetch(`${this.getServerUrl()}/api/usage`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.API_KEY}`,
        },
      });

      if (!response.ok) {
        // Try to extract error message from response body
        let errorMessage = `Failed to fetch usage stats: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }

        // Special handling for token limit errors (429)
        if (response.status === 429) {
          // If we got a token limit error, create a synthetic response
          // with maxed out usage data
          if (errorMessage.includes("Token limit exceeded")) {
            // Try to get basic info from public API
            try {
              const publicResponse = await fetch(
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
                return await publicResponse.json();
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

      const data = await response.json();
      return data;
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
