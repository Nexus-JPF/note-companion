import { TFile, Notice } from "obsidian";
import FileOrganizer from "../index";
import { Queue, type QueueTaskMetadata } from "./services/queue";
import {
  FileRecord,
  RecordManager,
  Action,
  FileStatus,
} from "./services/record-manager";
import { QueueStatus } from "./types";
import { logMessage, sanitizeFileName } from "../someUtils";
import { IdService } from "./services/id-service";
import { logger } from "../services/logger";
import {
  initializeTokenCounter,
  getTokenCount,
  cleanup,
} from "../utils/token-counter";
import {
  isValidExtension,
  VALID_MEDIA_EXTENSIONS,
  VALID_AUDIO_EXTENSIONS,
  VALID_IMAGE_EXTENSIONS,
} from "../constants";
import {
  safeCreate,
  safeRename,
  safeMove,
} from "../fileUtils";
import { getErrorMessage, getErrorStack } from "../lib/api-json";
import { shouldShowInboxNotification } from "./notification-level";
import { sanitizeContent } from "../fileUtils";
import {
  extractYouTubeVideoId,
  getYouTubeContent,
  getOriginalContent,
  YouTubeError,
  isYoutubeTemplate,
  prepareYouTubeFormatContent,
  finalizeYouTubeFormattedNote,
  shouldSkipYoutubeInboxFormatting,
  getYoutubeInboxFormatSkipReasonAfterPrep,
  YOUTUBE_TRANSCRIPT_FETCH_DISABLED_MESSAGE,
  type YouTubeFetchedContent,
} from "./services/youtube-service";

// Move constants to the top level and ensure they're used consistently
const MAX_CONCURRENT_TASKS = 5;
const MAX_CONCURRENT_MEDIA_TASKS = 2;

/** Text-only inbox files: classify, tag, move */
const INBOX_QUEUE_TIMEOUT_MS = 30_000;
/** Images/PDF: vision OCR plus full organize pipeline */
const INBOX_MEDIA_QUEUE_TIMEOUT_MS = 3 * 60_000;
/** Audio: transcription can run for several minutes */
const INBOX_AUDIO_QUEUE_TIMEOUT_MS = 15 * 60_000;

function getInboxQueueTimeoutMs(file: TFile): number {
  const ext = file.extension.toLowerCase();
  if (VALID_AUDIO_EXTENSIONS.includes(ext)) {
    return INBOX_AUDIO_QUEUE_TIMEOUT_MS;
  }
  if (VALID_IMAGE_EXTENSIONS.includes(ext) || ext === "pdf") {
    return INBOX_MEDIA_QUEUE_TIMEOUT_MS;
  }
  return INBOX_QUEUE_TIMEOUT_MS;
}

export interface FolderSuggestion {
  isNewFolder: boolean;
  score: number;
  folder: string;
  reason: string;
}

export interface LogEntry {
  id: string;
  fileName: string;
  timestamp: string;
  status: "queued" | "processing" | "completed" | "error";
  newPath?: string;
  newName?: string;
  classification?: string;
  addedTags?: string[];
  errors?: string[];
  messages: string[];
}

interface EventRecord {
  id: string;
  fileRecordId: string;
  timestamp: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface ProcessingContext {
  inboxFile: TFile;
  containerFile?: TFile;
  attachmentFile?: TFile;
  hash: string;
  content?: string;
  newPath?: string;
  newName?: string;
  tags?: string[];
  plugin: FileOrganizer;
  recordManager: RecordManager;
  idService: IdService;
  queue: Queue<TFile>;
  formattedContent?: string;
  classification?: {
    documentType: string;
    confidence: number;
    reasoning: string;
  };
  suggestedTags?: Array<{
    score: number;
    isNew: boolean;
    tag: string;
    reason: string;
  }>;
  youtubeContent?: YouTubeFetchedContent;
  /** Set when inbox YouTube transcript fetch failed — avoids duplicate fetch. */
  youtubeTranscriptFetchFailed?: boolean;
}

interface StepValidation {
  isValid: boolean;
  reason?: string;
}

function validateContext(
  context: ProcessingContext,
  requiredFields: (keyof ProcessingContext)[]
): StepValidation {
  for (const field of requiredFields) {
    if (!context[field]) {
      return {
        isValid: false,
        reason: `Missing required field: ${field}`,
      };
    }
  }
  return { isValid: true };
}

function assertInvariant(condition: boolean, message: string) {
  if (!condition) {
    logger.error(`Invariant violation: ${message}`);
    throw new Error(`Invariant violation: ${message}`);
  }
}

export class Inbox {
  protected static instance: Inbox;
  private plugin: FileOrganizer;
  private activeMediaTasks = 0;
  private mediaQueue: Array<TFile> = [];

  private queue: Queue<TFile>;
  private recordManager: RecordManager;
  private idService: IdService;

  private constructor(plugin: FileOrganizer) {
    this.plugin = plugin;
    this.recordManager = RecordManager.getInstance(plugin.app);
    this.idService = IdService.getInstance();
    this.initializeQueue();
  }

  public static initialize(plugin: FileOrganizer): Inbox {
    if (!Inbox.instance) {
      Inbox.instance = new Inbox(plugin);
    }
    return Inbox.instance;
  }

  public static getInstance(): Inbox {
    if (!Inbox.instance) {
      throw new Error("Inbox not initialized. Call initialize() first.");
    }
    return Inbox.instance;
  }

  public static cleanup(): void {
    if (Inbox.instance) {
      Inbox.instance.queue.clear();
      cleanup(); // Clean up token counter
      // @ts-ignore - We know what we're doing here
      Inbox.instance = null;
    }
  }

  public enqueueFile(file: TFile): void {
    this.enqueueFiles([file]);
  }

  public enqueueFiles(files: TFile[]): void {
    logMessage(`Enqueuing ${files.length} files`);

    // Separate media and non-media files
    const [mediaFiles, regularFiles] = files.reduce<[TFile[], TFile[]]>(
      (acc, file) => {
        if (this.plugin.shouldCreateMarkdownContainer(file)) {
          acc[0].push(file);
        } else {
          acc[1].push(file);
        }
        return acc;
      },
      [[], []]
    );

    // First enqueue regular files
    for (const file of regularFiles) {
      const hash = this.idService.generateFileHash(file);
      this.recordManager.startTracking(hash, file.basename);
      this.queue.add(file, {
        metadata: { hash, timeoutMs: getInboxQueueTimeoutMs(file) },
      });
    }

    // Then enqueue media files
    for (const file of mediaFiles) {
      const hash = this.idService.generateFileHash(file);
      this.recordManager.startTracking(hash, file.basename);
      this.queue.add(file, {
        metadata: { hash, timeoutMs: getInboxQueueTimeoutMs(file) },
      });
    }

    logMessage(
      `Enqueued ${regularFiles.length} regular files and ${mediaFiles.length} media files`
    );
  }

  private initializeQueue(): void {
    this.queue = new Queue<TFile>({
      concurrency: MAX_CONCURRENT_TASKS,
      timeout: INBOX_QUEUE_TIMEOUT_MS,
      onProcess: async (file: TFile, metadata?: QueueTaskMetadata) => {
        try {
          const isMediaFile = this.plugin.shouldCreateMarkdownContainer(file);

          if (isMediaFile) {
            // Check if we can process more media files
            if (this.activeMediaTasks >= MAX_CONCURRENT_MEDIA_TASKS) {
              // Add to media queue and skip for now
              this.mediaQueue.push(file);
              if (metadata?.hash) {
                this.queue.remove(metadata.hash);
              }
              return;
            }
            this.activeMediaTasks++;
          }

          await this.processInboxFile(file, metadata?.hash);

          if (isMediaFile) {
            this.activeMediaTasks--;
            // Process next media file if available
            void this.processNextMediaFile();
          }
        } finally {
          if (metadata?.hash) {
            this.queue.remove(metadata.hash);
          }
        }
      },
      onComplete: () => {},
      onError: (error: Error, file: TFile) => {
        logger.error("Queue processing error:", error);
        if (
          shouldShowInboxNotification(
            this.plugin.settings.inboxNotificationLevel,
            "error"
          )
        ) {
          new Notice(
            `Note Companion: Processing failed for ${file.basename}. ${error.message}`,
            6000
          );
        }
      },
    });
  }

  private async processNextMediaFile(): Promise<void> {
    if (
      this.mediaQueue.length === 0 ||
      this.activeMediaTasks >= MAX_CONCURRENT_MEDIA_TASKS
    ) {
      return;
    }

    const nextFile = this.mediaQueue.shift();
    if (nextFile) {
      const hash = this.idService.generateFileHash(nextFile);
      this.queue.add(nextFile, {
        metadata: { hash, timeoutMs: getInboxQueueTimeoutMs(nextFile) },
      });
    }
  }

  public getFileStatus(filePath: string): FileRecord | undefined {
    // return this.recordManager.getRecordByPath(filePath);
    return undefined;
  }

  public getFileEvents(fileId: string): EventRecord[] {
    // return this.recordManager.getFileEvents(fileId);
    return [];
  }

  public getAllFiles(): FileRecord[] {
    return this.recordManager.getAllRecords();
  }

  /**
   * Records the user has not cleared. The full log view wants every record
   * (dismissing preserves history); the status tiles want only what is still
   * actionable.
   */
  public getActiveFiles(): FileRecord[] {
    return this.recordManager.getActiveRecords();
  }

  public getQueueStats(): QueueStatus {
    return this.queue.getStats();
  }

  public getMediaProcessingStats(): { active: number; queued: number } {
    return {
      active: this.activeMediaTasks,
      queued: this.mediaQueue.length,
    };
  }

  public getAnalytics(): {
    byStatus: Record<FileStatus, number>;
    totalFiles: number;
    mediaStats: {
      active: number;
      queued: number;
    };
    queueStats: QueueStatus;
  } {
    const records = this.getActiveFiles();
    const byStatus = records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<FileStatus, number>);

    return {
      byStatus,
      totalFiles: records.length,
      mediaStats: this.getMediaProcessingStats(),
      queueStats: this.getQueueStats(),
    };
  }

  // Refactored method using parallel processing where possible
  private async processInboxFile(
    inboxFile: TFile,
    hash?: string
  ): Promise<void> {
    if (!hash) {
      throw new Error("Hash is required for processing");
    }
    this.recordManager.setStatus(hash, "processing");

    const context: ProcessingContext = {
      inboxFile,
      hash,
      plugin: this.plugin,
      recordManager: this.recordManager,
      idService: this.idService,
      queue: this.queue,
    };

    try {
      await executeStep(
        context,
        startProcessing,
        Action.CLEANUP,
        Action.ERROR_CLEANUP
      );
      await executeStep(
        context,
        hasValidFileStep,
        Action.VALIDATE,
        Action.ERROR_VALIDATE
      );
      await executeStep(
        context,
        moveAttachmentFile,
        Action.MOVING_ATTACHMENT,
        Action.ERROR_MOVING_ATTACHMENT
      );
      await executeStep(
        context,
        getContainerFileStep,
        Action.CONTAINER,
        Action.ERROR_CONTAINER
      );
      await executeStep(
        context,
        getContentStep,
        Action.EXTRACT,
        Action.ERROR_EXTRACT
      );
      await executeStep(
        context,
        cleanupStep,
        Action.CLEANUP,
        Action.ERROR_CLEANUP
      );

      await executeStep(
        context,
        recommendClassificationStep,
        Action.CLASSIFY,
        Action.ERROR_CLASSIFY
      );

      // Fetch transcript only after classification as a youtube_* template
      await executeStep(
        context,
        fetchYouTubeTranscriptStep,
        Action.FETCH_YOUTUBE,
        Action.ERROR_FETCH_YOUTUBE
      );

      await executeStep(
        context,
        formatContentStep,
        Action.FORMATTING,
        Action.ERROR_FORMATTING
      );

      await executeStep(
        context,
        recommendFolderStep,
        Action.MOVING,
        Action.ERROR_MOVING
      );
      await executeStep(
        context,
        recommendNameStep,
        Action.RENAME,
        Action.ERROR_RENAME
      );
      await executeStep(
        context,
        appendAttachmentStep,
        Action.APPEND,
        Action.ERROR_APPEND
      );
      await executeStep(
        context,
        recommendTagsStep,
        Action.TAGGING,
        Action.ERROR_TAGGING
      );
      await executeStep(
        context,
        completeProcessing,
        Action.COMPLETED,
        Action.ERROR_COMPLETE
      );
    } catch (error) {
      await handleError(error, context);
      logger.error("Error processing inbox file:", error);
    }
  }
}
async function moveAttachmentFile(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (VALID_MEDIA_EXTENSIONS.includes(context.inboxFile.extension)) {
    context.attachmentFile = context.inboxFile;
    const newPath = await safeMove(
      context.plugin.app,
      context.inboxFile,
      context.plugin.settings.attachmentsPath
    );
    const movedFile = context.plugin.app.vault.getAbstractFileByPath(newPath);
    if (movedFile instanceof TFile) {
      context.attachmentFile = movedFile;
      context.inboxFile = movedFile;
    }
  }
  return context;
}

async function getContainerFileStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  logger.info("Get container file step");
  if (VALID_MEDIA_EXTENSIONS.includes(context.inboxFile?.extension)) {
    const parentFolder =
      context.inboxFile.parent?.path ??
      context.plugin.settings.attachmentsPath;
    const containerPath = `${parentFolder}/${context.inboxFile.basename}.md`;
    const containerFile = await safeCreate(
      context.plugin.app,
      containerPath,
      ""
    );
    context.containerFile = containerFile;
  } else {
    context.containerFile = context.inboxFile;
  }
  context.recordManager.setFile(context.hash, context.containerFile);
  // return the inboxFile if it is not a media file
  return context;
}

async function hasValidFileStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  logger.info("Has valid file step");
  const extension = context.inboxFile?.extension;

  if (
    !context.plugin.settings.enableAttachmentProcessing &&
    extension &&
    VALID_MEDIA_EXTENSIONS.includes(extension)
  ) {
    await handleBypass(context, "Attachment processing disabled");
    throw new Error("Attachment processing disabled");
  }

  if (!isValidExtension(extension)) {
    await handleBypass(context, "Unsupported file type");
    throw new Error("Unsupported file type");
  }
  return context;
}

function isMediaExtractionSkipped(context: ProcessingContext): boolean {
  const extension = context.inboxFile?.extension;
  if (!extension || !VALID_MEDIA_EXTENSIONS.includes(extension)) {
    return false;
  }

  const settings = context.plugin.settings;
  if (VALID_IMAGE_EXTENSIONS.includes(extension)) {
    return !settings.enableImageDescription;
  }
  if (VALID_AUDIO_EXTENSIONS.includes(extension)) {
    return !settings.enableAudioTranscription;
  }
  if (extension === "pdf") {
    return !settings.enablePdfTextExtraction;
  }
  return false;
}

function buildMediaEmbedContent(context: ProcessingContext): string {
  if (!context.attachmentFile) {
    return "";
  }
  return `![[${context.attachmentFile.path}]]`;
}

async function recommendNameStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping name recommendation: missing content or container file"
    );
    return context;
  }

  const documentType = context.classification?.documentType;
  const useYoutubeTitle =
    context.youtubeContent?.title &&
    documentType &&
    isYoutubeTemplate(documentType);

  const newName = useYoutubeTitle
    ? [{ title: context.youtubeContent.title }]
    : await context.plugin.recommendName(
        getOriginalContent(context.content),
        context.containerFile.basename
      );
  context.newName = newName[0]?.title;

  // if new name is the same as the old name then don't rename
  if (!context.newName || context.newName === context.containerFile.basename) {
    return context;
  }

  // Sanitize the new name to replace invalid characters with dashes
  const sanitizedName = sanitizeFileName(context.newName);
  context.newName = sanitizedName;

  context.recordManager.setNewName(context.hash, context.newName);
  await safeRename(context.plugin.app, context.containerFile, context.newName);
  // Update file reference after rename (TFile path is automatically updated by Obsidian)
  context.recordManager.setFile(context.hash, context.containerFile);
  return context;
}

async function recommendFolderStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  assertInvariant(
    !!context.content,
    "Content must be available before folder recommendation"
  );
  assertInvariant(
    !!context.containerFile,
    "Container file must exist before moving"
  );

  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping folder recommendation: missing content or container file"
    );
    return context;
  }

  // Use post-format content so folder suggestions reflect the note body (especially YouTube).
  const folderContent = context.content;

  const newPath = await context.plugin.recommendFolders(
    folderContent,
    context.containerFile.path
  );

  assertInvariant(
    !!newPath?.[0]?.folder,
    "Folder recommendation must return a valid path"
  );

  context.newPath = newPath[0]?.folder;
  await safeMove(context.plugin.app, context.containerFile, context.newPath);
  context.recordManager.setFolder(context.hash, context.newPath);
  // Update file reference after move (TFile path is automatically updated by Obsidian)
  context.recordManager.setFile(context.hash, context.containerFile);

  return context;
}

async function recommendClassificationStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  // Validate required context
  const validation = validateContext(context, ["content", "containerFile"]);
  if (!validation.isValid) {
    throw new Error(
      `Classification step validation failed: ${validation.reason}`
    );
  }

  const templateNames = await context.plugin.getTemplateNames();
  if (!context.content || !context.containerFile) {
    logger.info("Skipping classification: missing content or container file");
    return context;
  }

  const result = await context.plugin.classifyContentV2(
    `${getOriginalContent(context.content)}, ${context.containerFile.name}`,
    templateNames
  );
  logger.info("Classification result", result);
  if (!result) return context;
  context.classification = {
    documentType: result,
    confidence: 100,
    reasoning: "N/A",
  };

  // Set the classification in the record manager
  context.recordManager.setClassification(context.hash, result);

  // Explicitly log the completion of classification
  context.recordManager.completeAction(context.hash, Action.CLASSIFY_DONE);

  return context;
}

// Pipeline processing steps

async function startProcessing(
  context: ProcessingContext
): Promise<ProcessingContext> {
  return context;
}

async function getContentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  const fileToRead = context.attachmentFile ?? context.inboxFile;
  let content: string;

  if (isMediaExtractionSkipped(context)) {
    content = buildMediaEmbedContent(context);
  } else {
    content = await context.plugin.getTextFromFile(fileToRead);
  }

  // For audio files with transcription, prepend the audio file link and title at the top
  let finalContent = content;
  if (
    !isMediaExtractionSkipped(context) &&
    VALID_AUDIO_EXTENSIONS.includes(context.inboxFile?.extension) &&
    context.attachmentFile &&
    context.containerFile
  ) {
    const audioFileName = context.attachmentFile.name;
    const audioLink = `![[${context.attachmentFile.path}]]\n\n`;
    const transcriptHeader = `## Transcript for ${audioFileName}\n\n`;
    finalContent = audioLink + transcriptHeader + content;
  }

  context.content = finalContent;
  if (context.containerFile) {
    await context.plugin.app.vault.modify(context.containerFile, finalContent);
  }

  context.recordManager.completeAction(context.hash, Action.EXTRACT_DONE);

  return context;
}

async function fetchYouTubeTranscriptStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  try {
    if (!context.content || !context.containerFile) {
      logger.info(
        "Skipping YouTube transcript: missing content or container file"
      );
      return context;
    }

    const videoId = extractYouTubeVideoId(context.content);
    if (!videoId) {
      return context;
    }

    const documentType = context.classification?.documentType;
    if (!documentType || !isYoutubeTemplate(documentType)) {
      logger.info(
        "Skipping YouTube transcript: not classified as a youtube_* template",
        { documentType: documentType ?? "(none)" }
      );
      return context;
    }

    const youtubeContent = await getYouTubeContent(videoId, context.plugin);
    context.youtubeContent = {
      videoId,
      title: youtubeContent.title,
      transcript: youtubeContent.transcript,
      channel: youtubeContent.channel,
      channelUrl: youtubeContent.channelUrl,
      datePublished: youtubeContent.datePublished,
      segments: youtubeContent.segments,
    };

    // Keep transcript in context only — do not persist raw transcript to the vault.
    // formatContentStep passes it to the formatter and strips it from the final note.

    // Explicitly log the completion of YouTube transcript fetching
    context.recordManager.completeAction(
      context.hash,
      Action.FETCH_YOUTUBE_DONE
    );

    return context;
  } catch (error) {
    if (error instanceof YouTubeError) {
      context.youtubeTranscriptFetchFailed = true;
      context.recordManager.addError(context.hash, {
        action: Action.ERROR_FETCH_YOUTUBE,
        message: error.message,
        stack: error.stack,
      });

      // For any YouTube error, log it but continue processing
      logger.warn(
        "YouTube transcript error, continuing with processing:",
        error.message
      );
      return context;
    }
    // For other errors, use default error handling
    throw error;
  }
}

async function cleanupStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  try {
    const extractionSkipped = isMediaExtractionSkipped(context);

    if (!context.content && !extractionSkipped) {
      await handleBypass(context, "No content available");
    }

    if (!context.content && extractionSkipped) {
      context.content = buildMediaEmbedContent(context);
    }

    if (!context.content) {
      throw new Error("Content is required for cleanup step");
    }

    const sanitizedContent = await sanitizeContent(context.content);

    const contentWithoutFrontmatter = sanitizedContent
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim();
    if (!extractionSkipped && contentWithoutFrontmatter.length < 5) {
      await handleBypass(context, "Content too short (less than 5 characters)");
    }

    context.content = sanitizedContent;
    return context;
  } catch (error) {
    logger.error("Error in preprocessContentStep:", error);
    throw error;
  }
}

// New helper function to handle bypassing
async function handleBypass(
  context: ProcessingContext,
  reason: string
): Promise<void> {
  try {
    logger.info("Bypassing file", context.inboxFile);

    // Show user notification
    const fileName = context.inboxFile.basename;
    const bypassedFolderPath = context.plugin.settings.bypassedFilePath;

    if (
      shouldShowInboxNotification(
        context.plugin.settings.inboxNotificationLevel,
        "warning"
      )
    ) {
      new Notice(
        `⚠️ Bypassed: ${fileName}\nReason: ${reason}\nLocation: ${bypassedFolderPath}`,
        5000
      );
    }

    // Then move the file
    await safeMove(context.plugin.app, context.inboxFile, bypassedFolderPath);

    if (
      context.containerFile &&
      context.attachmentFile &&
      context.containerFile.path !== context.inboxFile.path
    ) {
      try {
        const containerContent = await context.plugin.app.vault.read(
          context.containerFile
        );
        if (!containerContent.trim()) {
          await context.plugin.app.vault.delete(context.containerFile);
        }
      } catch (deleteError) {
        logger.warn("Could not remove empty container after bypass", deleteError);
      }
    }

    context.queue.bypass(context.hash);
    context.recordManager.setStatus(context.hash, "bypassed");
    throw new Error("Bypassed due to " + reason);
  } catch (error) {
    logger.error("Error in handleBypass:", error);
    throw error;
  }
}

async function formatContentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (!context.classification) {
    logger.info("Skipping formatting: no classification available");
    return context;
  }

  // Early return if no classification
  if (!context.classification.documentType) {
    logger.info("Skipping formatting: no classification available");
    return context;
  }

  // Early return if classification confidence is too low
  if (context.classification.confidence < 80) {
    logger.info("Skipping formatting: classification confidence too low", {
      confidence: context.classification.confidence,
    });
    return context;
  }

  // Early return if no content
  if (!context.content) {
    logger.info("Skipping formatting: no content available");
    return context;
  }

  logger.info("Formatting content step", context.classification);

  const documentType = context.classification.documentType;

  if (
    shouldSkipYoutubeInboxFormatting(
      documentType,
      context.plugin.settings.enableYouTubeTranscriptFetching
    )
  ) {
    logger.info(
      "Skipping youtube formatting: YouTube transcript fetching is disabled"
    );
    if (
      shouldShowInboxNotification(
        context.plugin.settings.inboxNotificationLevel,
        "warning"
      )
    ) {
      new Notice(
        `${YOUTUBE_TRANSCRIPT_FETCH_DISABLED_MESSAGE} Leaving the note unchanged.`,
        6000
      );
    }
    return context;
  }

  const prep = await prepareYouTubeFormatContent(context.plugin, {
    baseContent: context.content,
    templateName: documentType,
    existingYoutubeContent: context.youtubeContent,
    enableTranscriptFetching:
      context.plugin.settings.enableYouTubeTranscriptFetching,
    transcriptFetchAlreadyFailed: context.youtubeTranscriptFetchFailed,
  });

  const isYouTubeFormat =
    isYoutubeTemplate(documentType) && !!prep.youtubeContent;

  const skipReasonAfterPrep = getYoutubeInboxFormatSkipReasonAfterPrep(
    documentType,
    prep
  );
  if (skipReasonAfterPrep) {
    logger.info("Skipping youtube formatting:", skipReasonAfterPrep);
    if (
      shouldShowInboxNotification(
        context.plugin.settings.inboxNotificationLevel,
        "warning"
      )
    ) {
      new Notice(
        `${skipReasonAfterPrep}. Leaving the note unchanged.`,
        5000
      );
    }
    return context;
  }

  const formatContent = prep.formatContent;

  if (prep.transcriptTruncated) {
    logger.info("YouTube transcript was sampled to fit formatting token budget");
    if (
      shouldShowInboxNotification(
        context.plugin.settings.inboxNotificationLevel,
        "info"
      )
    ) {
      new Notice(
        "Long video: transcript was sampled to fit formatting limits.",
        5000
      );
    }
  }

  // get token amount from token counter
  await initializeTokenCounter();
  const tokenAmount = getTokenCount(formatContent);
  cleanup();
  if (tokenAmount > context.plugin.settings.maxFormattingTokens) {
    logger.info("Skipping formatting: content too large", {
      tokenAmount,
      maxFormattingTokens: context.plugin.settings.maxFormattingTokens,
    });
    if (
      isYoutubeTemplate(documentType) &&
      shouldShowInboxNotification(
        context.plugin.settings.inboxNotificationLevel,
        "warning"
      )
    ) {
      new Notice(
        `YouTube note is too large to format (${tokenAmount} tokens). Try a shorter video or increase the formatting token limit in settings.`,
        6000
      );
    }
    return context;
  }

  try {
    const instructions = await context.plugin.getTemplateInstructions(
      context.classification.documentType
    );

    if (!instructions) {
      logger.info("Skipping formatting: no instructions available");
      return context;
    }

    // Use the Organizer's streamFormatInCurrentNote method for consistent behavior
    if (!context.containerFile || !context.content) {
      logger.info("Skipping formatting: missing container file or content");
      return context;
    }

    await context.plugin.streamFormatInCurrentNote({
      file: context.containerFile,
      content: formatContent,
      formattingInstruction: instructions,
    });

    if (isYouTubeFormat && context.containerFile) {
      context.content = await finalizeYouTubeFormattedNote(
        context.plugin.app,
        context.containerFile,
        documentType,
        context.youtubeContent ?? undefined
      );
    } else if (context.containerFile) {
      context.content = await context.plugin.app.vault.read(
        context.containerFile
      );
    }

    // Explicitly log the completion of formatting
    context.recordManager.completeAction(context.hash, Action.FORMATTING_DONE);
    context.recordManager.setFormatted(context.hash, true);

    return context;
  } catch (error) {
    logger.error("Error in formatContentStep:", error);
    throw error;
  }
}
async function recommendTagsStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  const documentType = context.classification?.documentType;
  if (documentType && isYoutubeTemplate(documentType)) {
    logger.info(
      "Skipping tag recommendation: youtube_* templates add tags during formatting"
    );
    return context;
  }

  const existingTags = await context.plugin.getAllVaultTags();
  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping tag recommendation: missing content or container file"
    );
    return context;
  }

  const tags = await context.plugin.recommendTags(
    context.content,
    context.containerFile.path,
    existingTags
  );
  context.tags = tags?.map(t => t.tag);
  // for each tag, append it to the file
  if (context.tags && context.containerFile) {
    for (const tag of context.tags) {
      await context.plugin.appendTag(context.containerFile, tag);
    }
  }
  context.recordManager.setTags(context.hash, context.tags);
  return context;
}
async function appendAttachmentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (context.attachmentFile && context.containerFile) {
    if (isMediaExtractionSkipped(context)) {
      return context;
    }

    // Skip audio files - they're already added at the top in getContentStep
    if (VALID_AUDIO_EXTENSIONS.includes(context.attachmentFile.extension)) {
      return context;
    }

    const link = context.plugin.app.fileManager.generateMarkdownLink(
      context.attachmentFile,
      context.containerFile.parent?.path ?? ""
    );
    await context.plugin.app.vault.append(context.containerFile, `\n\n${link}`);
  }
  return context;
}

async function completeProcessing(
  context: ProcessingContext
): Promise<ProcessingContext> {
  context.recordManager.setStatus(context.hash, "completed");

  if (
    shouldShowInboxNotification(
      context.plugin.settings.inboxNotificationLevel,
      "info"
    )
  ) {
    const fileName =
      context.containerFile?.basename || context.inboxFile.basename;
    const record = context.recordManager.getRecord(context.hash);
    const stepsCompleted = record
      ? Object.values(record.logs).filter((entry) => entry.completed).length
      : 0;
    new Notice(`✅ ${fileName}: Done (${stepsCompleted} steps)`, 3000);
  }

  return context;
}

// Error handling

async function handleError(
  error: unknown,
  context: ProcessingContext
): Promise<void> {
  const lastError = context.recordManager.getLastError(context.hash);

  const errorMessageText = getErrorMessage(error);

  logger.error(`Error in step ${lastError?.action}:`, {
    error: errorMessageText,
    step: lastError?.action,
    file: context.inboxFile.path,
  });

  context.recordManager.setStatus(context.hash, "error");

  const fileName = context.inboxFile.basename;
  const errorMessage =
    lastError?.error?.message || errorMessageText || "Unknown error";
  const errorAction = lastError?.action;

  // Determine destination folder and error type
  let destinationFolder: string;
  let errorType: string;

  // Different handling based on error type
  switch (errorAction) {
    case Action.ERROR_MOVING_ATTACHMENT:
    case Action.ERROR_MOVING:
      destinationFolder = context.plugin.settings.errorFilePath;
      errorType = "File system error";
      await moveFileToErrorFolder(context);
      break;
    case Action.ERROR_CLASSIFY:
    case Action.ERROR_TAGGING:
      destinationFolder = context.plugin.settings.backupFolderPath;
      errorType = "AI processing error";
      await moveToBackupFolder(context);
      break;
    case Action.ERROR_FETCH_YOUTUBE:
      destinationFolder = context.plugin.settings.backupFolderPath;
      errorType = "YouTube transcript error";
      await moveToBackupFolder(context);
      break;
    default:
      destinationFolder = context.plugin.settings.errorFilePath;
      errorType = "Processing error";
      await moveFileToErrorFolder(context);
  }

  // Show user notification
  if (
    shouldShowInboxNotification(
      context.plugin.settings.inboxNotificationLevel,
      "error"
    ) &&
    errorAction
  ) {
    const formattedMessage = formatErrorMessage(errorAction, errorMessage);
    new Notice(
      `❌ Error: ${fileName}\n${errorType}: ${formattedMessage}\nLocation: ${destinationFolder}`,
      6000
    );
  }
}

// moveToBackupFolder
async function moveToBackupFolder(context: ProcessingContext): Promise<void> {
  await safeMove(
    context.plugin.app,
    context.inboxFile,
    context.plugin.settings.backupFolderPath
  );
}

// Helper functions for file operations
async function moveFileToErrorFolder(
  context: ProcessingContext
): Promise<void> {
  await safeMove(
    context.plugin.app,
    context.inboxFile,
    context.plugin.settings.errorFilePath
  );
}

// Helper functions for initialization and usage
export function initializeInboxQueue(plugin: FileOrganizer): void {
  Inbox.cleanup();
  Inbox.initialize(plugin);
}

export function enqueueFiles(files: TFile[]): void {
  Inbox.getInstance().enqueueFiles(files);
}

export function getInboxStatus(): QueueStatus {
  return Inbox.getInstance().getQueueStats();
}
// skip actions when settings below are false
function shouldSkipAction(context: ProcessingContext, action: Action): boolean {
  switch (action) {
    case Action.CLASSIFY:
      return !context.plugin.settings.enableDocumentClassification;
    case Action.FORMATTING:
      return !context.plugin.settings.enableDocumentClassification;
    case Action.RENAME:
      return !context.plugin.settings.enableFileRenaming;
    case Action.TAGGING:
      return !context.plugin.settings.useSimilarTags;
    case Action.MOVING:
      return !context.plugin.settings.enableFolderRecommendation;
    case Action.FETCH_YOUTUBE:
      return !context.plugin.settings.enableYouTubeTranscriptFetching;
    default:
      return false;
  }
}

export function getActionDisplayName(action: Action): string {
  const actionMap: Record<string, string> = {
    [Action.EXTRACT]: "Extracting content",
    [Action.CLASSIFY]: "Classifying document",
    [Action.MOVING]: "Finding destination folder",
    [Action.RENAME]: "Generating title",
    [Action.TAGGING]: "Adding tags",
    [Action.FORMATTING]: "Formatting content",
  };
  return actionMap[action] || action.toString();
}

function formatErrorMessage(
  action: Action,
  errorMessage: string
): string {
  // Map technical error actions to user-friendly descriptions
  const actionMap: Record<string, string> = {
    [Action.ERROR_MOVING]: "Failed to move file",
    [Action.ERROR_MOVING_ATTACHMENT]: "Failed to move attachment",
    [Action.ERROR_CLASSIFY]: "Failed to classify document",
    [Action.ERROR_TAGGING]: "Failed to generate tags",
    [Action.ERROR_FETCH_YOUTUBE]: "Failed to fetch YouTube transcript",
    [Action.ERROR_EXTRACT]: "Failed to extract content",
    [Action.ERROR_RENAME]: "Failed to rename file",
    [Action.ERROR_FORMATTING]: "Failed to format content",
    [Action.ERROR_CLEANUP]: "Failed to clean up file",
    [Action.ERROR_VALIDATE]: "Failed to validate file",
    [Action.ERROR_CONTAINER]: "Failed to create container",
    [Action.ERROR_APPEND]: "Failed to append attachment",
    [Action.ERROR_COMPLETE]: "Failed to complete processing",
  };

  const userFriendlyAction = actionMap[action] || action.toString();

  // Truncate long error messages
  const maxLength = 100;
  const truncatedMessage = errorMessage.length > maxLength
    ? errorMessage.substring(0, maxLength) + "..."
    : errorMessage;

  return `${userFriendlyAction}: ${truncatedMessage}`;
}

function calculateProgress(record: FileRecord): number {
  // Define total pipeline steps (excluding optional ones)
  const totalSteps = [
    Action.CLEANUP,
    Action.VALIDATE,
    Action.CONTAINER,
    Action.MOVING_ATTACHMENT,
    Action.EXTRACT,
    Action.CLASSIFY,
    Action.MOVING,
    Action.RENAME,
    Action.FORMATTING,
    Action.APPEND,
    Action.TAGGING,
    Action.COMPLETED,
  ].length;

  // Count completed steps (excluding skipped)
  const completedSteps = Object.values(record.logs).filter(
    (log) => log.completed && !log.skipped
  ).length;

  return Math.round((completedSteps / totalSteps) * 100);
}

async function executeStep(
  context: ProcessingContext,
  step: (context: ProcessingContext) => Promise<ProcessingContext>,
  action: Action,
  errorAction: Action
): Promise<ProcessingContext> {
  try {
    if (shouldSkipAction(context, action)) {
      context.recordManager.skipAction(context.hash, action);
      return context;
    }

    // Log the start of the action
    context.recordManager.addAction(context.hash, action);

    // Progress updates for key actions (workspace event always; toast at debug only)
    const notifLevel = context.plugin.settings.inboxNotificationLevel;
    const isKeyProgressAction = [
      Action.EXTRACT,
      Action.CLASSIFY,
      Action.MOVING,
      Action.RENAME,
      Action.TAGGING,
      Action.FORMATTING,
    ].includes(action);

    if (isKeyProgressAction) {
      const fileName =
        context.containerFile?.basename || context.inboxFile.basename;
      const actionName = getActionDisplayName(action);

      const allRecords = context.recordManager.getAllRecords();
      const processingFiles = allRecords.filter((r) => r.status === "processing");
      const queuedFiles = allRecords.filter((r) => r.status === "queued");

      const currentFileIndex = processingFiles.findIndex(
        (r) => r.id === context.hash
      );
      const queuePosition =
        currentFileIndex >= 0
          ? queuedFiles.length + currentFileIndex + 1
          : queuedFiles.length + processingFiles.length + 1;
      const totalInQueue = queuedFiles.length + processingFiles.length;

      const record = context.recordManager.getRecord(context.hash);
      const progress = record ? calculateProgress(record) : 0;

      if (shouldShowInboxNotification(notifLevel, "debug")) {
        const queueInfo =
          totalInQueue > 1 ? ` (${queuePosition}/${totalInQueue})` : "";
        const progressInfo = progress > 0 ? ` - ${progress}%` : "";
        new Notice(
          `📄 ${fileName}: ${actionName}${queueInfo}${progressInfo}`,
          3000
        );
      }

      context.plugin.app.workspace.trigger("file-organizer:processing-step", {
        fileName,
        action: actionName,
        hash: context.hash,
        queuePosition: totalInQueue > 1 ? queuePosition : undefined,
        totalInQueue: totalInQueue > 1 ? totalInQueue : undefined,
        progress,
      });
    }

    // Execute the step
    const result = await step(context);

    // Log the completion of the action
    // Check if this is a "DONE" action or needs the corresponding "DONE" action
    const isDoneAction = action.toString().includes("_DONE");
    if (!isDoneAction) {
      // Find the corresponding "DONE" action if it exists
      const doneActionKey = `${action.toString()}_DONE`;
      const doneAction = Object.values(Action).find(
        a => a.toString() === doneActionKey
      );

      if (doneAction) {
        // Log the completion with the corresponding "DONE" action
        context.recordManager.addAction(context.hash, doneAction, true);
      } else {
        // If no corresponding "DONE" action exists, mark the current action as completed
        context.recordManager.completeAction(context.hash, action);
      }
    } else {
      // If this is already a "DONE" action, mark it as completed
      context.recordManager.completeAction(context.hash, action);
    }

    return result;
  } catch (error) {
    context.recordManager.addAction(context.hash, errorAction);
    context.recordManager.addError(context.hash, {
      action: errorAction,
      message: getErrorMessage(error),
      stack: getErrorStack(error),
    });
    throw error;
  }
}
