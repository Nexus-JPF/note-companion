import { logger } from "../../services/logger";
import FileOrganizer from "../../index";
import { fetchTranscript } from "youtube-transcript-plus";
import { requestUrl } from "obsidian";

// Regex patterns for both YouTube URL formats
const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
];

export function extractYouTubeVideoId(
  content: string
): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Wraps Obsidian's requestUrl to match the fetch API signature
 * This allows youtube-transcript-plus to work in Obsidian's Electron environment
 */
function createObsidianFetch() {
  return async (
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<Response> => {
    const response = await requestUrl({
      url,
      method:
        (options?.method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH") ||
        "GET",
      headers: options?.headers || {},
      body: options?.body,
    });

    // Convert Obsidian's RequestUrlResponse to a fetch-like Response
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: "", // RequestUrlResponse doesn't have statusText
      text: async () => response.text,
      json: async () => {
        try {
          return typeof response.json === "string"
            ? JSON.parse(response.json)
            : response.json;
        } catch {
          throw new Error("Invalid JSON response");
        }
      },
      headers: new Headers(response.headers || {}),
    } as Response;
  };
}

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
      .replace(/&#(\d+);/g, (match, dec) =>
        String.fromCharCode(parseInt(dec, 10))
      )
      .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) =>
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

  // Try DOM API as additional pass (works in browser/Electron)
  if (typeof document !== "undefined" && decoded !== text) {
    try {
      const div = document.createElement("div");
      div.innerHTML = decoded; // Use innerHTML to let browser decode any remaining entities
      const domDecoded = div.textContent || div.innerText || decoded;
      return domDecoded;
    } catch (e) {
      // Return regex-decoded version
    }
  }

  return decoded;
}

export interface YouTubeMetadata {
  title: string;
  channel?: string;
  datePublished?: string;
}

/**
 * Parses JSON-LD script tags from YouTube watch page HTML to extract
 * channel name and upload date (VideoObject schema).
 */
function parseJsonLdFromHtml(html: string): {
  channel?: string;
  datePublished?: string;
} {
  const result: { channel?: string; datePublished?: string } = {};
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
        if (item && typeof item === "object") {
          // VideoObject: uploadDate, author.name or publisher.name
          if (item["@type"] === "VideoObject") {
            if (item.uploadDate && typeof item.uploadDate === "string") {
              result.datePublished = item.uploadDate;
            }
            const author = item.author;
            if (author && typeof author === "object" && author.name) {
              result.channel = String(author.name).trim();
            }
            if (!result.channel) {
              const publisher = item.publisher;
              if (publisher && typeof publisher === "object" && publisher.name) {
                result.channel = String(publisher.name).trim();
              }
            }
            if (result.channel && result.datePublished) return result;
          }
          // BreadcrumbList may contain channel in itemListElement
          if (item["@type"] === "BreadcrumbList" && Array.isArray(item.itemListElement)) {
            const last = item.itemListElement[item.itemListElement.length - 1];
            if (last?.name && !result.channel) {
              result.channel = String(last.name).trim();
            }
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
 * Extracts the channel name from YouTube's ytInitialData (embedded in watch page).
 * YouTube often omits author from JSON-LD; ytInitialData has the owner in
 * videoSecondaryInfoRenderer.owner.videoOwnerRenderer.title (runs[0].text or simpleText).
 */
function parseYtInitialDataChannel(html: string): string | undefined {
  const match = html.match(
    /(?:var\s+)?(?:window\s*\[\s*["']ytInitialData["']\s*\]|ytInitialData)\s*=\s*(\{)/
  );
  if (!match || !match[1]) return undefined;

  const startIndex = match.index! + match[0].length - 1; // index of first `{`
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
          const channel = getChannelFromYtInitialData(data);
          if (channel) return channel;
        } catch {
          // ignore parse errors
        }
        return undefined;
      }
      i++;
      continue;
    }
    i++;
  }
  return undefined;
}

function getChannelFromYtInitialData(data: unknown): string | undefined {
  const extractChannelFromOwner = (owner: unknown): string | undefined => {
    const videoOwner = (owner as Record<string, unknown>)?.videoOwnerRenderer as Record<string, unknown> | undefined;
    const title = videoOwner?.title as Record<string, unknown> | undefined;
    if (!title) return undefined;
    const runs = title.runs as Array<{ text?: string }> | undefined;
    if (Array.isArray(runs) && runs[0]?.text) return String(runs[0].text).trim();
    const simpleText = title.simpleText;
    if (typeof simpleText === "string") return simpleText.trim();
    return undefined;
  };

  const searchVideoSecondaryInfo = (items: unknown): string | undefined => {
    if (!Array.isArray(items)) return undefined;
    for (const item of items) {
      const section = (item as Record<string, unknown>).itemSectionRenderer as Record<string, unknown> | undefined;
      const sectionContents = section?.contents as Array<Record<string, unknown>> | undefined;
      const direct = (item as Record<string, unknown>).videoSecondaryInfoRenderer as Record<string, unknown> | undefined;
      if (direct?.owner) {
        const ch = extractChannelFromOwner(direct.owner);
        if (ch) return ch;
      }
      if (!Array.isArray(sectionContents)) continue;
      for (const sec of sectionContents) {
        const videoSecondary = sec.videoSecondaryInfoRenderer as Record<string, unknown> | undefined;
        const owner = videoSecondary?.owner;
        if (owner) {
          const ch = extractChannelFromOwner(owner);
          if (ch) return ch;
        }
      }
    }
    return undefined;
  };

  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const contents = d.contents as Record<string, unknown> | undefined;
  const twoCol = contents?.twoColumnWatchNextResults as Record<string, unknown> | undefined;
  if (!twoCol) return undefined;

  // Primary: results.results.contents
  const results = twoCol.results as Record<string, unknown> | undefined;
  const resultsInner = results?.results as Record<string, unknown> | undefined;
  const resultsContents = resultsInner?.contents as unknown;
  const ch1 = searchVideoSecondaryInfo(resultsContents);
  if (ch1) return ch1;

  // Fallback: secondaryResults.contents or secondaryResults.secondaryResults.contents
  const secondaryResults = twoCol.secondaryResults as Record<string, unknown> | undefined;
  const secondaryContents = Array.isArray(secondaryResults?.contents)
    ? secondaryResults.contents
    : (secondaryResults?.secondaryResults as Record<string, unknown> | undefined)?.contents;
  return searchVideoSecondaryInfo(secondaryContents);
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
    console.log("[YouTube Service] Fetching metadata from:", url);

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
    const ytChannel = parseYtInitialDataChannel(html);
    if (ytChannel) {
      metadata.channel = ytChannel;
    }
    // Date and optional channel fallback from JSON-LD
    const jsonLd = parseJsonLdFromHtml(html);
    if (!metadata.channel && jsonLd.channel) metadata.channel = jsonLd.channel;
    if (jsonLd.datePublished) {
      metadata.datePublished = formatDatePublished(jsonLd.datePublished);
    }

    if (!metadata.title) {
      throw new Error("Could not extract title from YouTube page");
    }

    console.log("[YouTube Service] Extracted metadata:", {
      title: metadata.title,
      channel: metadata.channel ?? "(none)",
      datePublished: metadata.datePublished ?? "(none)",
    });
    return metadata;
  } catch (error) {
    console.error("[YouTube Service] Error fetching metadata:", error);
    throw new YouTubeError(
      `Failed to fetch YouTube video metadata: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Fetches YouTube content (title, transcript, channel, date published) directly from the client
 * Uses youtube-transcript-plus for reliable transcript fetching
 * Uses Obsidian's requestUrl to bypass CORS restrictions
 */
export async function getYouTubeContent(
  videoId: string,
  _plugin?: FileOrganizer
): Promise<{
  title: string;
  transcript: string;
  channel?: string;
  datePublished?: string;
}> {
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

  console.log(
    "[YouTube Service] Fetching YouTube content directly (client-side):",
    finalVideoId,
    `(original: ${typeof videoId === 'string' ? videoId : JSON.stringify(videoId)})`
  );

  try {
    // Create Obsidian-compatible fetch function
    const obsidianFetch = createObsidianFetch();

    // Fetch transcript and metadata (title, channel, date) in parallel
    console.log(
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
        console.error("[YouTube Service] Transcript fetch error:", error);
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
        console.warn(
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

    // Combine transcript items into a single string
    const rawTranscript = transcriptItems
      .map((item: { text: string }) => item.text)
      .join(" ");

    // Decode HTML entities in transcript (handles cases like &amp;#39;)
    const decodedTranscript = decodeHtmlEntities(rawTranscript);

    // Ensure title is properly decoded (double-check)
    const decodedTitle = decodeHtmlEntities(metadata.title);

    console.log("[YouTube Service] Successfully fetched:", {
      title: decodedTitle,
      channel: metadata.channel ?? "(none)",
      datePublished: metadata.datePublished ?? "(none)",
      transcriptLength: decodedTranscript.length,
    });

    return {
      title: decodedTitle,
      transcript: decodedTranscript,
      channel: metadata.channel,
      datePublished: metadata.datePublished,
    };
  } catch (error) {
    if (error instanceof YouTubeError) {
      throw error; // Re-throw YouTubeError as-is
    }
    console.error("[YouTube Service] Error fetching YouTube content:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching YouTube content:", error);
    throw new YouTubeError(`Failed to fetch YouTube content: ${message}`);
  }
}

export function getOriginalContent(content: string): string {
  let original = content;

  // Remove YouTube section if present
  original = original.split("\n\n## YouTube Video:")[0];

  // Remove audio file link and transcript header if present
  // Format: ![[audioFileName]]\n\n## Transcript for audioFileName\n\n[transcript]
  const audioLinkPattern = /^!\[\[[^\]]+\]\]\s*\n\n/;
  const transcriptHeaderPattern = /^## Transcript for [^\n]+\n\n/;

  // Remove audio link at the start
  original = original.replace(audioLinkPattern, '');

  // Remove transcript header at the start
  original = original.replace(transcriptHeaderPattern, '');

  return original;
}

export class YouTubeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "YouTubeError";
  }
}
