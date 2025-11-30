import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { Innertube } from "youtubei.js";
import { fetchTranscript } from "youtube-transcript-plus";

export const maxDuration = 60;

// Cache the Innertube instance
let ytInstance: Innertube | null = null;

async function getYoutubeInstance(): Promise<Innertube> {
  if (!ytInstance) {
    console.log("[YouTube API] Creating Innertube instance...");
    ytInstance = await Innertube.create();
    console.log("[YouTube API] Innertube instance created");
  }
  return ytInstance;
}

/**
 * Fetches YouTube video transcript and title using YouTube.js
 * POST /api/youtube-transcript
 * Body: { videoId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const { userId } = await handleAuthorizationV2(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoId } = await request.json();
    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    console.log(`[YouTube API] Fetching transcript for video: ${videoId}`);

    try {
      // Try youtube-transcript-plus first (more reliable)
      console.log("[YouTube API] Attempting to fetch transcript using youtube-transcript-plus...");
      try {
        const transcriptItems = await fetchTranscript(videoId);

        if (!transcriptItems || transcriptItems.length === 0) {
          throw new Error("No transcript items returned");
        }

        // Combine transcript text
        const transcript = transcriptItems
          .map((item: { text: string }) => item.text)
          .join(" ");

        // Get video title using YouTube.js
        const yt = await getYoutubeInstance();
        const videoInfo = await yt.getBasicInfo(videoId);
        const title = videoInfo.basic_info?.title || "Untitled YouTube Video";

        console.log(
          `[YouTube API] Successfully fetched transcript using youtube-transcript-plus: ${transcript.length} chars`
        );

        return NextResponse.json({
          title,
          transcript,
          videoId,
        });
      } catch (transcriptPlusError: any) {
        console.warn(
          "[YouTube API] youtube-transcript-plus failed, falling back to YouTube.js:",
          transcriptPlusError.message
        );
        // Fall through to YouTube.js method
      }

      // Fallback to YouTube.js method
      const yt = await getYoutubeInstance();

      console.log("[YouTube API] Fetching video info using YouTube.js...");
      const videoInfo = await yt.getBasicInfo(videoId);

      // Get video title
      const title = videoInfo.basic_info?.title || "Untitled YouTube Video";

      console.log("[YouTube API] Getting captions...");
      const captions = videoInfo.captions;

      if (
        !captions ||
        !captions.caption_tracks ||
        captions.caption_tracks.length === 0
      ) {
        return NextResponse.json(
          {
            error: "Transcript not available - video may not have captions enabled",
          },
          { status: 404 }
        );
      }

      // For now, return an error suggesting the video might not have captions
      // since direct fetching is being blocked
      return NextResponse.json(
        {
          error: "Unable to fetch transcript - YouTube may be blocking requests. Please ensure the video has captions enabled.",
        },
        { status: 503 }
      );

      console.log(
        `[YouTube API] Successfully fetched transcript: ${transcript.length} chars, title: ${title}`
      );

      return NextResponse.json({
        title,
        transcript,
        videoId,
      });
    } catch (transcriptError: any) {
      console.error("[YouTube API] Error fetching transcript:", transcriptError);
      const errorMessage =
        transcriptError?.message || "Unknown error";

      if (
        errorMessage.includes("Transcript is disabled") ||
        errorMessage.includes("not available")
      ) {
        return NextResponse.json(
          { error: "Transcript is not available for this video" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch YouTube transcript: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[YouTube API] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch YouTube transcript: ${errorMessage}` },
      { status: 500 }
    );
  }
}

