import { requestUrl } from "obsidian";
import { logger } from "../../services/logger";
import FileOrganizer from "../../index";
import { fetchTranscript } from "youtube-transcript-plus";
import { obsidianFetch } from "../../lib/obsidian-fetch";
import { readResponseJson } from "../../lib/api-json";
import {
  extractYouTubeVideoId,
  formatTimedTranscript,
  getAdaptiveTranscriptGroupInterval,
  getVideoDurationFromSegments,
  normalizeTranscriptOffsetSeconds,
  type TranscriptSegment,
  type YouTubeFetchedContent,
} from "./youtube-context";

export {
  appendYouTubeContextBlock,
  buildYouTubeContextBlock,
  buildYouTubeWatchUrlWithTimestamp,
  ensureYouTubeFrontmatterFields,
  enhanceYouTubeFormattedNote,
  extractYouTubeVideoId,
  getOriginalContent,
  isPendingYouTubeFormat,
  isYoutubeTemplate,
  formatTimedTranscript,
  formatTranscriptTimestamp,
  linkifyYouTubeChannelSection,
  linkifyYouTubeTimestamps,
  normalizeTranscriptOffsetSeconds,
  parseBracketTimestampToSeconds,
  stripYouTubeContextBlock,
  stripYouTubeContextFromFormattedNote,
  YOUTUBE_FULL_TRANSCRIPT_HEADER,
  YOUTUBE_VIDEO_INFORMATION_HEADER,
  type TranscriptSegment,
  type YouTubeFetchedContent,
} from "./youtube-context";

/**
 * Decodes HTML entities in a string
 * Works in both browser and Node.js environments
 * Handles double-encoded entities like &amp;#39; by doing multiple passes
 */
function decodeHtmlEntities(text: string): string {
  let decoded = text;
  let previousDecoded = "";

  // Keep decoding until no more changes occur (handles double-encoded entities)
  while (decoded !== previousDecoded) {
    previousDecoded = decoded;

    // Decode numeric entities (&#39;, &#x27;, etc.) - must come before &amp; decoding
    decoded = decoded
      .replace(/&#(\d+);/g, (_match: string, dec: string) =>
        String.fromCharCode(parseInt(dec, 10))
      )
      .replace(/&#x([0-9a-fA-F]+);/gi, (_match: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      );

    // Decode named entities (decode &amp; last to avoid double-decoding issues)
    decoded = decoded
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"); // Decode &amp; last so it doesn't interfere with numeric entities
  }

  return decoded;
}

export interface YouTubeMetadata {
  title: string;
  channel?: string;
  channelUrl?: string;
  datePublished?: string;
}

/**
 * Parses JSON-LD script tags from YouTube watch page HTML to extract
 * channel name and upload date (VideoObject schema).
 */
function parseJsonLdFromHtml(html: string): {
  channel?: string;
  channelUrl?: string;
  datePublished?: string;
} {
  const result: {
    channel?: string;
    channelUrl?: string;
    datePublished?: string;
  } = {};
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw) as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;

        // VideoObject: uploadDate, author.name or publisher.name
        if (record["@type"] === "VideoObject") {
          if (typeof record.uploadDate === "string") {
            result.datePublished = record.uploadDate;
          }
          const author = record.author;
          if (author && typeof author === "object") {
            const authorRecord = author as Record<string, unknown>;
            const authorName = authorRecord.name;
            if (typeof authorName === "string") {
              result.channel = authorName.trim();
            }
            const authorUrl = authorRecord.url;
            if (typeof authorUrl === "string") {
              result.channelUrl = authorUrl.trim();
            }
          }
          if (!result.channel) {
            const publisher = record.publisher;
            if (publisher && typeof publisher === "object") {
              const publisherName = (publisher as Record<string, unknown>).name;
              if (typeof publisherName === "string") {
                result.channel = publisherName.trim();
              }
            }
          }
          if (result.channel && result.datePublished) return result;
        }

        // BreadcrumbList may contain channel in itemListElement
        if (
          record["@type"] === "BreadcrumbList" &&
          Array.isArray(record.itemListElement)
        ) {
          const elements = record.itemListElement as Record<string, unknown>[];
          const last = elements[elements.length - 1];
          const lastName = last?.name;
          if (typeof lastName === "string" && !result.channel) {
            result.channel = lastName.trim();
          }
        }
      }
    } catch {
      // Skip invalid JSON-LD blocks
    }
  }
  return result;
}

/**
 * Extracts channel name and URL from YouTube's ytInitialData (embedded in watch page).
 */
function parseYtInitialDataChannelInfo(html: string): {
  channel?: string;
  channelUrl?: string;
} {
  const match = html.match(
    /(?:var\s+)?(?:window\s*\[\s*["']ytInitialData["']\s*\]|ytInitialData)\s*=\s*(\{)/
  );
  if (!match || !match[1]) return {};

  const startIndex = match.index + match[0].length - 1; // index of first `{`
  let depth = 0;
  let inString: "'" | '"' | null = null;
  let i = startIndex;
  const len = html.length;

  while (i < len) {
    const c = html[i];
    if (inString) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === inString) {
        inString = null;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      i++;
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          const jsonStr = html.slice(startIndex, i + 1);
          const data = JSON.parse(jsonStr) as unknown;
          return getChannelInfoFromYtInitialData(data);
        } catch {
          // ignore parse errors
        }
        return {};
      }
      i++;
      continue;
    }
    i++;
  }
  return {};
}

function buildYouTubeChannelUrl(
  browseEndpoint: Record<string, unknown> | undefined
): string | undefined {
  if (!browseEndpoint) {
    return undefined;
  }

  const canonicalBaseUrl = browseEndpoint.canonicalBaseUrl;
  if (typeof canonicalBaseUrl === "string" && canonicalBaseUrl.startsWith("/")) {
    return `https://www.youtube.com${canonicalBaseUrl}`;
  }

  const browseId = browseEndpoint.browseId;
  if (typeof browseId === "string" && browseId.startsWith("UC")) {
    return `https://www.youtube.com/channel/${browseId}`;
  }

  return undefined;
}

function getBrowseEndpointFromNavigationEndpoint(
  navigationEndpoint: unknown
): Record<string, unknown> | undefined {
  if (!navigationEndpoint || typeof navigationEndpoint !== "object") {
    return undefined;
  }
  const browseEndpoint = (navigationEndpoint as Record<string, unknown>)
    .browseEndpoint;
  if (!browseEndpoint || typeof browseEndpoint !== "object") {
    return undefined;
  }
  return browseEndpoint as Record<string, unknown>;
}

function getChannelInfoFromYtInitialData(data: unknown): {
  channel?: string;
  channelUrl?: string;
} {
  const extractChannelFromOwner = (
    owner: unknown
  ): { channel?: string; channelUrl?: string } => {
    const videoOwner = (owner as Record<string, unknown>)
      ?.videoOwnerRenderer as Record<string, unknown> | undefined;
    const title = videoOwner?.title as Record<string, unknown> | undefined;
    if (!title) return {};

    const runs = title.runs as Array<{
      text?: string;
      navigationEndpoint?: unknown;
    }> | undefined;
    if (Array.isArray(runs) && runs[0]?.text) {
      const channel = String(runs[0].text).trim();
      const channelUrl = buildYouTubeChannelUrl(
        getBrowseEndpointFromNavigationEndpoint(runs[0].navigationEndpoint)
      );
      return { channel, channelUrl };
    }

    const simpleText = title.simpleText;
    if (typeof simpleText === "string") {
      const channel = simpleText.trim();
      const channelUrl = buildYouTubeChannelUrl(
        getBrowseEndpointFromNavigationEndpoint(
          videoOwner?.navigationEndpoint ?? title.navigationEndpoint
        )
      );
      return { channel, channelUrl };
    }

    return {};
  };

  const searchVideoSecondaryInfo = (
    items: unknown
  ): { channel?: string; channelUrl?: string } | undefined => {
    if (!Array.isArray(items)) return undefined;
    for (const item of items) {
      const section = (item as Record<string, unknown>).itemSectionRenderer as
        | Record<string, unknown>
        | undefined;
      const sectionContents = section?.contents as
        | Array<Record<string, unknown>>
        | undefined;
      const direct = (item as Record<string, unknown>)
        .videoSecondaryInfoRenderer as Record<string, unknown> | undefined;
      if (direct?.owner) {
        const info = extractChannelFromOwner(direct.owner);
        if (info.channel) return info;
      }
      if (!Array.isArray(sectionContents)) continue;
      for (const sec of sectionContents) {
        const videoSecondary = sec.videoSecondaryInfoRenderer as
          | Record<string, unknown>
          | undefined;
        const owner = videoSecondary?.owner;
        if (owner) {
          const info = extractChannelFromOwner(owner);
          if (info.channel) return info;
        }
      }
    }
    return undefined;
  };

  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const contents = d.contents as Record<string, unknown> | undefined;
  const twoCol = contents?.twoColumnWatchNextResults as
    | Record<string, unknown>
    | undefined;
  if (!twoCol) return {};

  const results = twoCol.results as Record<string, unknown> | undefined;
  const resultsInner = results?.results as Record<string, unknown> | undefined;
  const resultsContents = resultsInner?.contents;
  const primary = searchVideoSecondaryInfo(resultsContents);
  if (primary?.channel) return primary;

  const secondaryResults = twoCol.secondaryResults as
    | Record<string, unknown>
    | undefined;
  const secondaryContents = Array.isArray(secondaryResults?.contents)
    ? secondaryResults.contents
    : (secondaryResults?.secondaryResults as Record<string, unknown> | undefined)
        ?.contents;
  return searchVideoSecondaryInfo(secondaryContents) ?? {};
}

/**
 * Converts an ISO 8601 date string (e.g. 2026-02-01T05:29:52-08:00) to a
 * user-friendly date-only format YYYY-MM-DD for frontmatter and display.
 */
function formatDatePublished(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  } catch {
    return isoDate;
  }
}

/**
 * Fetches YouTube video metadata (title, channel, date published) from the
 * video page using Obsidian's requestUrl. Parses title tag and JSON-LD.
 */
async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    logger.debug("[YouTube Service] Fetching metadata from:", url);

    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch YouTube page: ${response.status}`);
    }

    const html = response.text;
    const metadata: YouTubeMetadata = { title: "" };

    // Title: <title> or og:title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      let title = decodeHtmlEntities(titleMatch[1]);
      title = title.replace(/\s*-\s*YouTube\s*$/, "").trim();
      if (title) metadata.title = title;
    }
    if (!metadata.title) {
      const ogTitleMatch = html.match(
        /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
      );
      if (ogTitleMatch?.[1]) {
        metadata.title = decodeHtmlEntities(ogTitleMatch[1]).trim();
      }
    }

    // Channel: prefer ytInitialData (YouTube often omits author from JSON-LD)
    const ytChannelInfo = parseYtInitialDataChannelInfo(html);
    if (ytChannelInfo.channel) {
      metadata.channel = ytChannelInfo.channel;
    }
    if (ytChannelInfo.channelUrl) {
      metadata.channelUrl = ytChannelInfo.channelUrl;
    }
    // Date and optional channel fallback from JSON-LD
    const jsonLd = parseJsonLdFromHtml(html);
    if (!metadata.channel && jsonLd.channel) metadata.channel = jsonLd.channel;
    if (!metadata.channelUrl && jsonLd.channelUrl) {
      metadata.channelUrl = jsonLd.channelUrl;
    }
    if (jsonLd.datePublished) {
      metadata.datePublished = formatDatePublished(jsonLd.datePublished);
    }

    if (!metadata.title) {
      throw new Error("Could not extract title from YouTube page");
    }

    logger.debug("[YouTube Service] Extracted metadata:", {
      title: metadata.title,
      channel: metadata.channel ?? "(none)",
      channelUrl: metadata.channelUrl ?? "(none)",
      datePublished: metadata.datePublished ?? "(none)",
    });
    return metadata;
  } catch (error) {
    logger.error("[YouTube Service] Error fetching metadata:", error);
    throw new YouTubeError(
      `Failed to fetch YouTube video metadata: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function fetchYouTubeContentFromBackend(
  videoId: string,
  plugin: FileOrganizer
): Promise<Omit<YouTubeFetchedContent, "videoId">> {
  const apiKey = plugin.getApiKey()?.trim();
  if (!apiKey) {
    throw new YouTubeError(
      "API key is missing; cannot fetch transcript from server"
    );
  }

  const response = await obsidianFetch(
    `${plugin.getServerUrl()}/api/youtube-transcript`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ videoId }),
    }
  );

  const data = await readResponseJson<{
    title?: string;
    transcript?: string;
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new YouTubeError(
      data.error || `Server transcript fetch failed (${response.status})`
    );
  }

  if (!data.transcript || typeof data.transcript !== "string") {
    throw new YouTubeError("Server returned no transcript");
  }

  return {
    title: data.title || "Untitled YouTube Video",
    transcript: data.transcript,
  };
}

/**
 * Fetches YouTube content (title, transcript, channel, date published) directly from the client
 * Uses youtube-transcript-plus for reliable transcript fetching
 * Uses Obsidian's requestUrl to bypass CORS restrictions
 */
export async function getYouTubeContent(
  videoId: string,
  plugin?: FileOrganizer
): Promise<Omit<YouTubeFetchedContent, "videoId">> {
  // Validate and normalize videoId to ensure it's a string
  if (!videoId) {
    throw new YouTubeError("videoId is required");
  }

  // Convert to string if it's not already
  const normalizedVideoId = String(videoId).trim();

  if (!normalizedVideoId) {
    throw new YouTubeError("videoId cannot be empty");
  }

  // Extract videoId if a full URL was passed
  const extractedId = extractYouTubeVideoId(normalizedVideoId);
  const finalVideoId = extractedId || normalizedVideoId;

  // Final validation: ensure it's a valid videoId format
  if (!/^[a-zA-Z0-9_-]+$/.test(finalVideoId)) {
    throw new YouTubeError(
      `Invalid videoId format: "${finalVideoId}". Expected YouTube video ID (alphanumeric, dashes, underscores only)`
    );
  }

  logger.debug(
    "[YouTube Service] Fetching YouTube content directly (client-side):",
    finalVideoId,
    `(original: ${typeof videoId === "string" ? videoId : JSON.stringify(videoId)})`
  );

  try {
    // Fetch transcript and metadata (title, channel, date) in parallel
    logger.debug(
      "[YouTube Service] Starting parallel fetch of transcript and metadata..."
    );

    const [transcriptItems, metadata] = await Promise.all([
      fetchTranscript(finalVideoId, {
        // Provide custom fetch functions that use Obsidian's requestUrl
        videoFetch: async ({ url, lang, userAgent }) => {
          return obsidianFetch(url, {
            method: "GET",
            headers: {
              ...(lang && { "Accept-Language": lang }),
              "User-Agent": userAgent,
            },
          });
        },
        playerFetch: async ({
          url,
          method,
          body,
          headers,
          lang,
          userAgent,
        }) => {
          return obsidianFetch(url, {
            method: method || "POST",
            headers: {
              ...(lang && { "Accept-Language": lang }),
              "User-Agent": userAgent,
              ...headers,
            },
            body,
          });
        },
        transcriptFetch: async ({ url, lang, userAgent }) => {
          return obsidianFetch(url, {
            method: "GET",
            headers: {
              ...(lang && { "Accept-Language": lang }),
              "User-Agent": userAgent,
            },
          });
        },
      }).catch(error => {
        logger.error("[YouTube Service] Transcript fetch error:", error);
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);

        // Check if the error is about videoId.match not being a function
        if (errorMessage.includes("match is not a function")) {
          throw new YouTubeError(
            `Invalid videoId type. Received: ${typeof finalVideoId}, value: ${JSON.stringify(finalVideoId)}. ${errorMessage}`
          );
        }

        throw new YouTubeError(
          `Failed to fetch transcript: ${errorMessage}`
        );
      }),
      fetchYouTubeMetadata(finalVideoId).catch(error => {
        logger.warn(
          "[YouTube Service] Metadata fetch failed, using fallback:",
          error
        );
        const fallback: YouTubeMetadata = { title: "Untitled YouTube Video" };
        return fallback;
      }),
    ]);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new YouTubeError("No transcript items returned from YouTube");
    }

    const segments: TranscriptSegment[] = transcriptItems.map(
      (item: { text: string; offset?: number }) => ({
        text: decodeHtmlEntities(item.text),
        offset: normalizeTranscriptOffsetSeconds(item.offset ?? 0),
      })
    );

    const duration = getVideoDurationFromSegments(segments);
    const groupInterval = getAdaptiveTranscriptGroupInterval(duration);
    const timedTranscript = formatTimedTranscript(segments, groupInterval);
    const decodedTranscript =
      timedTranscript ||
      segments
        .map(s => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    // Ensure title is properly decoded (double-check)
    const decodedTitle = decodeHtmlEntities(metadata.title);

    logger.debug("[YouTube Service] Successfully fetched:", {
      title: decodedTitle,
      channel: metadata.channel ?? "(none)",
      channelUrl: metadata.channelUrl ?? "(none)",
      datePublished: metadata.datePublished ?? "(none)",
      transcriptLength: decodedTranscript.length,
      segmentCount: segments.length,
    });

    return {
      title: decodedTitle,
      transcript: decodedTranscript,
      channel: metadata.channel,
      channelUrl: metadata.channelUrl,
      datePublished: metadata.datePublished,
      segments,
    };
  } catch (error) {
    const clientError =
      error instanceof YouTubeError
        ? error
        : new YouTubeError(
            `Failed to fetch YouTube content: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );

    if (plugin) {
      logger.warn(
        "[YouTube Service] Client transcript fetch failed, trying backend API:",
        clientError.message
      );
      try {
        return await fetchYouTubeContentFromBackend(finalVideoId, plugin);
      } catch (backendError) {
        logger.error(
          "[YouTube Service] Backend transcript fallback failed:",
          backendError
        );
      }
    }

    logger.error("[YouTube Service] Error fetching YouTube content:", error);
    throw clientError;
  }
}

export {
  finalizeYouTubeFormattedNote,
  getYoutubeInboxFormatSkipReasonAfterPrep,
  measureFormatContentTokens,
  prepareYouTubeFormatContent,
  shouldSkipYoutubeInboxFormatting,
  YOUTUBE_TRANSCRIPT_FETCH_DISABLED_MESSAGE,
  type PrepareYouTubeFormatContentResult,
} from "./youtube-format";

export class YouTubeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "YouTubeError";
  }
}
