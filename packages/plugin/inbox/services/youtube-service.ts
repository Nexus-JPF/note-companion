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
 */
function decodeHtmlEntities(text: string): string {
  // Use regex-based decoder first (more reliable for numeric entities)
  const decoded = text
    // Decode numeric entities first (&#39;, &#x27;, etc.)
    .replace(/&#(\d+);/g, (match, dec) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    // Then decode named entities
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Try DOM API as additional pass (works in browser/Electron)
  if (typeof document !== "undefined" && decoded !== text) {
    try {
      const div = document.createElement("div");
      div.textContent = decoded; // Set decoded text
      // If DOM can further decode, use it
      const domDecoded = div.textContent || div.innerText || decoded;
      return domDecoded;
    } catch (e) {
      // Return regex-decoded version
    }
  }

  return decoded;
}

/**
 * Fetches YouTube video title from the video page using Obsidian's requestUrl
 */
async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log("[YouTube Service] Fetching title from:", url);

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

    // Try to extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      // Decode HTML entities and remove " - YouTube" suffix
      let title = decodeHtmlEntities(titleMatch[1]);
      title = title.replace(/\s*-\s*YouTube\s*$/, "").trim();
      if (title) {
        console.log("[YouTube Service] Extracted title:", title);
        return title;
      }
    }

    // Fallback: try to find in JSON-LD or og:title
    const ogTitleMatch = html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
    );
    if (ogTitleMatch && ogTitleMatch[1]) {
      // Decode HTML entities from og:title
      let title = decodeHtmlEntities(ogTitleMatch[1]);
      title = title.trim();
      console.log("[YouTube Service] Extracted title from og:title:", title);
      return title;
    }

    throw new Error("Could not extract title from YouTube page");
  } catch (error) {
    console.error("[YouTube Service] Error fetching title:", error);
    throw new YouTubeError(
      `Failed to fetch YouTube video title: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Fetches YouTube content (title and transcript) directly from the client
 * Uses youtube-transcript-plus for reliable transcript fetching
 * Uses Obsidian's requestUrl to bypass CORS restrictions
 */
export async function getYouTubeContent(
  videoId: string,
  _plugin?: FileOrganizer
): Promise<{ title: string; transcript: string }> {
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

    // Fetch transcript and title in parallel
    console.log(
      "[YouTube Service] Starting parallel fetch of transcript and title..."
    );

    const [transcriptItems, title] = await Promise.all([
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
      fetchYouTubeTitle(finalVideoId).catch(error => {
        console.warn(
          "[YouTube Service] Title fetch failed, using fallback:",
          error
        );
        return "Untitled YouTube Video";
      }),
    ]);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new YouTubeError("No transcript items returned from YouTube");
    }

    // Combine transcript items into a single string
    const transcript = transcriptItems
      .map((item: { text: string }) => item.text)
      .join(" ");

    // Ensure title is properly decoded (double-check)
    const decodedTitle = decodeHtmlEntities(title);

    console.log("[YouTube Service] Successfully fetched:", {
      originalTitle: title,
      decodedTitle: decodedTitle,
      transcriptLength: transcript.length,
    });

    return { title: decodedTitle, transcript };
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
  // Split on YouTube section and take first part
  return content.split("\n\n## YouTube Video:")[0];
}

export class YouTubeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "YouTubeError";
  }
}
