import {
  getYouTubeTranscript,
  getYouTubeVideoTitle,
} from "../../views/assistant/ai-chat/youtube-transcript";
import { logger } from "../../services/logger";

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

export async function getYouTubeContent(
  videoId: string
): Promise<{ title: string; transcript: string }> {
  try {
    const [title, transcript] = await Promise.all([
      getYouTubeVideoTitle(videoId),
      getYouTubeTranscript(videoId),
    ]);

    if (!title || !transcript) {
      throw new YouTubeError("Failed to fetch YouTube content");
    }

    return { title, transcript };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching YouTube content:", error);
    throw new YouTubeError(message);
  }
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
