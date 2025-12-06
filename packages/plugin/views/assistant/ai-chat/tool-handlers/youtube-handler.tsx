import React, { useRef, useState } from "react";
import { logger } from "../../../../services/logger";
import { addYouTubeContext, useContextItems } from "../use-context-items";
import {
  getYouTubeContent,
  extractYouTubeVideoId,
} from "../../../../inbox/services/youtube-service";
import { usePlugin } from "../../provider";
import { ToolInvocation } from "ai";

interface YouTubeHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (_toolResult: string) => void;
}

export function YouTubeHandler({
  toolInvocation,
  handleAddResult,
}: YouTubeHandlerProps) {
  const plugin = usePlugin();
  const hasFetchedRef = useRef(false);
  const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);

  React.useEffect(() => {
    console.log("[YouTube Handler] useEffect triggered", {
      toolName: toolInvocation.toolName,
      hasArgs: !!toolInvocation.args,
      videoId: toolInvocation.args?.videoId,
      hasFetched: hasFetchedRef.current,
      hasResult: "result" in toolInvocation,
    });

    const handleYouTubeTranscript = async () => {
      // Prevent double execution
      if (hasFetchedRef.current || "result" in toolInvocation) {
        console.log(
          "[YouTube Handler] Skipping - already fetched or has result",
          {
            hasFetched: hasFetchedRef.current,
            hasResult: "result" in toolInvocation,
          }
        );
        return;
      }

      console.log("[YouTube Handler] Starting handler execution");
      hasFetchedRef.current = true;

      try {
        let { videoId } = toolInvocation.args || {};

        // Check if videoId is a Promise (shouldn't happen, but handle it gracefully)
        if (videoId && typeof videoId.then === "function") {
          const errorMsg =
            "Invalid videoId: received a Promise instead of a string value";
          logger.error(errorMsg, { args: toolInvocation.args });
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        // Validate videoId exists and is a string
        if (!videoId || typeof videoId !== "string") {
          const errorMsg = `Invalid videoId: videoId is required and must be a string. Received type: ${typeof videoId}, value: ${String(
            videoId
          ).substring(0, 100)}`;
          logger.error(errorMsg, { args: toolInvocation.args });
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        // Extract videoId from URL if full URL was passed (AI might pass full URL)
        const extractedId = extractYouTubeVideoId(videoId);
        if (extractedId) {
          videoId = extractedId;
        } else if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) {
          // If it's not a valid videoId format and not extractable, it's invalid
          const errorMsg = `Invalid videoId format. Expected YouTube video ID or URL, got: ${videoId.substring(
            0,
            50
          )}`;
          logger.error(errorMsg);
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        // Use the new backend API via youtube-service
        console.log(
          "[YouTube Handler] About to fetch content for videoId:",
          videoId
        );

        let title: string;
        let transcript: string;

        try {
          const contentResult = await getYouTubeContent(videoId, plugin);
          title = contentResult.title;
          transcript = contentResult.transcript;

          console.log("[YouTube Handler] Successfully fetched content:", {
            title,
            transcriptLength: transcript.length,
          });
        } catch (error) {
          console.error("[YouTube Handler] Error in getYouTubeContent:", error);
          throw error; // Re-throw to be caught by outer try-catch
        }

        // Add full transcript to context for AI to access
        console.log("[YouTube Handler] About to add to context");
        try {
          addYouTubeContext({
            videoId,
            title,
            transcript,
          });
          console.log("[YouTube Handler] Called addYouTubeContext");
        } catch (error) {
          console.error("[YouTube Handler] Error in addYouTubeContext:", error);
          // Don't throw - continue even if context add fails
        }

        // CRITICAL: Wait a tick to ensure Zustand store update has propagated
        // Then verify it was added before sending tool result
        // Wait longer to ensure store update is fully propagated before triggering AI SDK continuation
        await new Promise(resolve => setTimeout(resolve, 100)); // Increased delay to ensure store update

        const store = useContextItems.getState();

        // Check if youtubeVideos exists in store
        if (!store.youtubeVideos) {
          console.error(
            "[YouTube Handler] ERROR: store.youtubeVideos is undefined!"
          );
          console.error("[YouTube Handler] Full store state:", store);
        }

        const addedVideo = store.youtubeVideos?.[`youtube-${videoId}`];

        if (!addedVideo) {
          console.error(
            "[YouTube Handler] ERROR: Video not found in store after addYouTubeContext!"
          );
          console.error("[YouTube Handler] Store state:", {
            youtubeVideos: store.youtubeVideos,
            youtubeVideosType: typeof store.youtubeVideos,
            allKeys: store.youtubeVideos
              ? Object.keys(store.youtubeVideos)
              : [],
            storeKeys: Object.keys(store),
          });
          // Try adding again
          addYouTubeContext({
            videoId,
            title,
            transcript,
          });
          await new Promise(resolve => setTimeout(resolve, 10));
          const store2 = useContextItems.getState();
          const addedVideo2 = store2.youtubeVideos?.[`youtube-${videoId}`];
          if (!addedVideo2) {
            console.error(
              "[YouTube Handler] ERROR: Video still not in store after retry!"
            );
            console.error("[YouTube Handler] Store2 state:", {
              youtubeVideos: store2.youtubeVideos,
              youtubeVideosType: typeof store2.youtubeVideos,
              allKeys: store2.youtubeVideos
                ? Object.keys(store2.youtubeVideos)
                : [],
            });
          } else {
            console.log("[YouTube Handler] Successfully added on retry!");
          }
        }

        const finalStore = useContextItems.getState();
        console.log("[YouTube Handler] Added to context:", {
          videoId,
          title,
          transcriptLength: transcript.length,
          foundInStore: !!addedVideo,
          allVideos: finalStore.youtubeVideos
            ? Object.keys(finalStore.youtubeVideos)
            : [],
          storeKeys: Object.keys(finalStore),
          youtubeVideosType: typeof finalStore.youtubeVideos,
        });

        const wordCount = transcript.split(/\s+/).length;

        // CRITICAL: Verify video is still in store one more time before sending result
        // This ensures the store update has fully propagated
        const verifyStore = useContextItems.getState();
        const videoStillInStore =
          !!verifyStore.youtubeVideos?.[`youtube-${videoId}`];

        if (!videoStillInStore) {
          console.error(
            "[YouTube Handler] CRITICAL: Video not in store before handleAddResult! Re-adding..."
          );
          addYouTubeContext({ videoId, title, transcript });
          await new Promise(resolve => setTimeout(resolve, 50));
          const verifyStore2 = useContextItems.getState();
          if (!verifyStore2.youtubeVideos?.[`youtube-${videoId}`]) {
            console.error(
              "[YouTube Handler] CRITICAL: Video still not in store after re-add!"
            );
          }
        }

        // Return result with transcript - keep it simple so AI continues
        // The AI SDK will automatically continue after tool results with maxSteps > 1
        const finalVerifyStore = useContextItems.getState();
        console.log(
          "[YouTube Handler] About to call handleAddResult - video is in store:",
          {
            videoId,
            inStore: !!finalVerifyStore.youtubeVideos?.[`youtube-${videoId}`],
            allVideos: finalVerifyStore.youtubeVideos
              ? Object.keys(finalVerifyStore.youtubeVideos)
              : [],
            storeKeys: Object.keys(finalVerifyStore),
          }
        );

        // CRITICAL: Wait one more time before sending result to ensure store is definitely updated
        await new Promise(resolve => setTimeout(resolve, 100));

        // Final store check
        const finalCheckStore = useContextItems.getState();
        const finalCheckVideo =
          !!finalCheckStore.youtubeVideos?.[`youtube-${videoId}`];
        console.log(
          "[YouTube Handler] Final store check before handleAddResult:",
          {
            videoInStore: finalCheckVideo,
            allVideos: finalCheckStore.youtubeVideos
              ? Object.keys(finalCheckStore.youtubeVideos)
              : [],
          }
        );

        // CRITICAL: Include FULL transcript in tool result so AI has it immediately
        // The AI SDK will include this in the conversation, and the AI can use it directly
        // Format the result as a clear message with the transcript
        const toolResultMessage = `YouTube Video Transcript Retrieved

Title: ${title}
Video ID: ${videoId}
Word Count: ${wordCount}

FULL TRANSCRIPT:
${transcript}

Please provide a comprehensive summary of this video, including:
- Main topics and themes
- Key points discussed
- Important information or insights
- Overall takeaway or conclusion

The full transcript is provided above - use it to create a detailed, accurate summary.`;

        console.log(
          "[YouTube Handler] Calling handleAddResult with transcript length:",
          transcript.length
        );
        handleAddResult(toolResultMessage);

        console.log(
          "[YouTube Handler] handleAddResult called - AI SDK should continue now"
        );
        setFetchSuccess(true);
      } catch (error) {
        // Catch all errors to prevent Obsidian crashes
        logger.error("Error fetching YouTube transcript:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        handleAddResult(JSON.stringify({ error: errorMessage }));
        setFetchSuccess(false);
      }
    };

    handleYouTubeTranscript();
  }, [toolInvocation.toolCallId]); // Only re-run if toolCallId changes (prevents excessive re-renders)

  if (fetchSuccess === null) {
    return (
      <div className="text-sm text-[--text-muted]">
        Fetching the video transcript...
      </div>
    );
  }

  if (fetchSuccess) {
    return (
      <div className="text-sm text-[--text-muted]">
        YouTube transcript successfully retrieved
      </div>
    );
  }

  return (
    <div className="text-sm text-[--text-error]">
      Failed to fetch YouTube transcript
    </div>
  );
}
