import React, { useRef, useState } from "react";
import { logger } from "../../../../services/logger";
import { addYouTubeContext } from "../use-context-items";
import { getYouTubeContent } from "../../../../inbox/services/youtube-service";
import { usePlugin } from "../../provider";

interface YouTubeHandlerProps {
  toolInvocation: any;
  handleAddResult: (result: string) => void;
}

export function YouTubeHandler({
  toolInvocation,
  handleAddResult,
}: YouTubeHandlerProps) {
  const plugin = usePlugin();
  const hasFetchedRef = useRef(false);
  const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);

  React.useEffect(() => {
    const handleYouTubeTranscript = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { videoId } = toolInvocation.args;
        try {
          // Use the new backend API via youtube-service
          const { title, transcript } = await getYouTubeContent(videoId, plugin);

          // Add full transcript to context for AI to access
          addYouTubeContext({
            videoId,
            title,
            transcript
          });

          const wordCount = transcript.split(/\s+/).length;

          // Return success message without full transcript
          // AI can access full transcript from context if needed
          handleAddResult(JSON.stringify({
            success: true,
            title,
            videoId,
            wordCount,
            message: `Successfully retrieved YouTube transcript for "${title}" (${wordCount} words)`
          }));
          setFetchSuccess(true);
        } catch (error) {
          logger.error("Error fetching YouTube transcript:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          handleAddResult(JSON.stringify({ error: errorMessage }));
          setFetchSuccess(false);
        }
      }
    };

    handleYouTubeTranscript();
  }, [toolInvocation, handleAddResult, plugin]);

  if (fetchSuccess === null) {
    return <div className="text-sm text-[--text-muted]">Fetching the video transcript...</div>;
  }

  if (fetchSuccess) {
    return <div className="text-sm text-[--text-muted]">YouTube transcript successfully retrieved</div>;
  }

  return <div className="text-sm text-[--text-error]">Failed to fetch YouTube transcript</div>;
}