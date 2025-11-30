import { requestUrl } from "obsidian";
import { logger } from "../../../services/logger";

/**
 * These functions are kept for backwards compatibility but are deprecated.
 * YouTube transcript fetching should now go through the backend API via youtube-service.ts
 */
export async function getYouTubeTranscript(videoId: string): Promise<string> {
  console.warn(
    "[YouTube Transcript] Direct transcript fetching is deprecated. Use backend API via youtube-service.ts"
  );
  throw new Error(
    "Direct transcript fetching is not supported. Please use the backend API."
  );
}

export async function getYouTubeVideoTitle(videoId: string): Promise<string> {
  try {
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoPageResponse = await requestUrl(videoPageUrl);
    const videoPageBody = videoPageResponse.text;

    const titleMatch = videoPageBody.match(/<title>(.+?)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].replace(" - YouTube", "").trim();
    } else {
      return "Untitled YouTube Video";
    }
  } catch (error) {
    logger.error("Error fetching YouTube video title:", error);
    return "Untitled YouTube Video";
  }
}
