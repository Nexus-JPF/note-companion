import { extractYouTubeVideoId } from "../../../../inbox/services/youtube-context";

/** Standard YouTube watch IDs are 11 characters. */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export type YoutubeToolReady =
  | { status: "wait" }
  | { status: "error"; message: string }
  | { status: "ready"; videoId: string };

function isThenable(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return typeof Reflect.get(value, "then") === "function";
}

function looksLikeStreamingYoutubeArg(videoId: string): boolean {
  if (YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return false;
  }
  const extracted = extractYouTubeVideoId(videoId);
  if (extracted && YOUTUBE_VIDEO_ID_PATTERN.test(extracted)) {
    return false;
  }
  if (/^[a-zA-Z0-9_-]{1,10}$/.test(videoId)) {
    return true;
  }
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/i.test(videoId);
}

/**
 * Chat tool args stream in. Do not fetch (or error) until we have a complete
 * 11-character ID — otherwise a partial "1vze" is treated as a video id.
 */
export function resolveYoutubeToolInvocation(params: {
  args: unknown;
  hasResult: boolean;
}): YoutubeToolReady {
  if (params.hasResult) {
    return { status: "wait" };
  }

  const args =
    params.args && typeof params.args === "object"
      ? (params.args as { videoId?: unknown })
      : {};
  const videoId = args.videoId;

  if (isThenable(videoId)) {
    return {
      status: "error",
      message:
        "Invalid videoId: received a Promise instead of a string value",
    };
  }

  if (videoId == null || videoId === "") {
    return { status: "wait" };
  }

  if (typeof videoId !== "string") {
    return {
      status: "error",
      message: `Invalid videoId: videoId is required and must be a string. Received type: ${typeof videoId}, value: ${String(
        videoId
      ).substring(0, 100)}`,
    };
  }

  if (looksLikeStreamingYoutubeArg(videoId)) {
    return { status: "wait" };
  }

  const extractedId = extractYouTubeVideoId(videoId);
  const finalId = extractedId || videoId;

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(finalId)) {
    return {
      status: "error",
      message: `Invalid videoId format. Expected YouTube video ID or URL, got: ${videoId.substring(
        0,
        50
      )}`,
    };
  }

  return { status: "ready", videoId: finalId };
}
