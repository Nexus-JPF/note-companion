import { logger } from "../../services/logger";
import FileOrganizer from "../../index";

// Regex patterns for both YouTube URL formats
const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
];

export async function extractYouTubeVideoId(
  content: string
): Promise<string | null> {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Fetches YouTube content (title and transcript) via backend API
 * Uses YouTube.js on the backend for reliable transcript fetching
 */
export async function getYouTubeContent(
  videoId: string,
  plugin?: FileOrganizer
): Promise<{ title: string; transcript: string }> {
  // Use backend API if plugin is available
  if (plugin) {
    try {
      const serverUrl = plugin.getServerUrl();
      const apiKey = plugin.getApiKey();

      if (serverUrl && apiKey) {
        console.log("[YouTube Service] Fetching via backend API:", videoId);
        const response = await fetch(`${serverUrl}/api/youtube-transcript`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ videoId }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("[YouTube Service] Successfully fetched via backend API");
          return { title: data.title, transcript: data.transcript };
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn(
            "[YouTube Service] Backend API failed:",
            response.status,
            errorData.error
          );
          throw new YouTubeError(
            errorData.error ||
              `Backend API failed with status ${response.status}`
          );
        }
      }
    } catch (error) {
      console.error("[YouTube Service] Backend API error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error fetching YouTube content from backend:", error);
      throw new YouTubeError(message);
    }
  }

  throw new YouTubeError("Plugin instance required to fetch YouTube content");
}

export function getOriginalContent(content: string): string {
  // Split on YouTube section and take first part
  return content.split("\n\n## YouTube Video:")[0];
}

export class YouTubeError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "YouTubeError";
  }
}
