import * as React from "react";
import { TFile, Notice } from "obsidian";
import FileOrganizer from "../../../index";
import { logger } from "../../../services/logger";

interface TranscriptionButtonProps {
  plugin: FileOrganizer;
  file: TFile;
  content: string;
}

export const TranscriptionButton: React.FC<TranscriptionButtonProps> = ({
  plugin,
  file,
  content,
}) => {
  const [transcribing, setTranscribing] = React.useState<boolean>(false);
  const MAX_FILE_SIZE_MB = 25;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Check if any audio files exceed the size limit
  const checkAudioFiles = () => {
    const audioRegex = /!\[\[(.*?\.(mp3|wav|m4a|ogg|webm))]]/gi;
    const matches = Array.from(content.matchAll(audioRegex));

    if (matches.length === 0) {
      return { valid: false, error: "No audio files found" };
    }

    const oversizedFiles: string[] = [];

    for (const match of matches) {
      const audioFileName = match[1];
      const audioFile = plugin.app.metadataCache.getFirstLinkpathDest(
        audioFileName,
        "."
      );

      if (!(audioFile instanceof TFile)) {
        continue; // Skip files that aren't found
      }

      const fileSizeInBytes = audioFile.stat.size;
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

      if (fileSizeInBytes > MAX_FILE_SIZE_BYTES) {
        oversizedFiles.push(`${audioFileName} (${fileSizeInMB.toFixed(2)}MB)`);
      }
    }

    if (oversizedFiles.length > 0) {
      return {
        valid: false,
        error: `File(s) too large (>${MAX_FILE_SIZE_MB}MB): ${oversizedFiles.join(
          ", "
        )}. Please compress or split the audio file.`,
      };
    }

    return { valid: true };
  };

  const handleTranscribe = async () => {
    // Check file sizes before starting
    const validation = checkAudioFiles();
    if (!validation.valid) {
      new Notice(validation.error || "Cannot transcribe audio files", 8000);
      return;
    }

    setTranscribing(true);
    try {
      const audioRegex = /!\[\[(.*?\.(mp3|wav|m4a|ogg|webm))]]/gi;
      const matches = Array.from(content.matchAll(audioRegex));

      if (matches.length === 0) {
        new Notice("No audio files found");
        return;
      }

      for (const match of matches) {
        const audioFileName = match[1];
        const audioFile = plugin.app.metadataCache.getFirstLinkpathDest(
          audioFileName,
          "."
        );

        if (!(audioFile instanceof TFile)) {
          logger.error(`Audio file not found: ${audioFileName}`);
          new Notice(`Audio file not found: ${audioFileName}`);
          continue;
        }

        const transcript = await plugin.generateTranscriptFromAudio(audioFile);
        await plugin.appendTranscriptToActiveFile(
          file,
          audioFileName,
          transcript
        );
        new Notice(`Transcript added for: ${audioFileName}`);
      }

      new Notice(`Completed transcribing ${matches.length} audio files`);
    } catch (error) {
      logger.error("Error transcribing audio:", error);
      new Notice("Error transcribing audio");
    } finally {
      setTranscribing(false);
    }
  };

  const validation = checkAudioFiles();
  const hasOversizedFiles =
    !validation.valid && validation.error?.includes("too large");

  return (
    <div className="flex flex-col gap-2">
      <button
        className="flex items-center gap-2 bg-[--interactive-accent] text-[--text-on-accent] px-4 py-2 hover:bg-[--interactive-accent-hover] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleTranscribe}
        disabled={transcribing || hasOversizedFiles}
        title={hasOversizedFiles ? validation.error : undefined}
      >
        {transcribing ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>Transcribing...</span>
          </>
        ) : (
          "Transcribe Audio"
        )}
      </button>
      {hasOversizedFiles && (
        <div className="text-xs text-[--text-error] px-2">
          {validation.error}
        </div>
      )}
    </div>
  );
};
