import * as React from "react";
import { TFile, Notice } from "obsidian";
import FileOrganizer from "../../../../index";
import { UserTemplates } from "./user-templates";
import { DEFAULT_SETTINGS } from "../../../../settings";
import { logger } from "../../../../services/logger";
import {
  extractYouTubeVideoId,
  getYouTubeContent,
} from "../../../inbox/services/youtube-service";

interface ClassificationBoxProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
}

export const ClassificationContainer: React.FC<ClassificationBoxProps> = ({
  plugin,
  file,
  content,
  refreshKey,
}) => {
  const [formatBehavior, setFormatBehavior] = React.useState<
    "override" | "newFile" | "append"
  >(plugin.settings.formatBehavior || DEFAULT_SETTINGS.formatBehavior);
  const [backupFile, setBackupFile] = React.useState<string | null>(null);

  const handleFormat = async (templateName: string) => {
    if (!file) {
      logger.error("No file selected");
      return;
    }
    try {
      let fileContent = await plugin.app.vault.read(file);
      if (typeof fileContent !== "string") {
        throw new Error("File content is not a string");
      }

      // If formatting as youtube_video, fetch transcript first
      if (
        templateName === "youtube_video" ||
        templateName === "youtube_video.md"
      ) {
        const videoId = await extractYouTubeVideoId(fileContent);
        if (videoId) {
          try {
            logger.info("Fetching YouTube transcript for formatting...");
            new Notice("Fetching YouTube transcript...", 2000);
            const { title, transcript } = await getYouTubeContent(videoId);

            // Append transcript and title information so AI can use it
            const videoInfo = `\n\n## YouTube Video Information\n\nTitle: ${title}\nVideo ID: ${videoId}\n\n## Full Transcript\n\n${transcript}`;
            fileContent = fileContent + videoInfo;

            logger.info("YouTube transcript fetched successfully");
            new Notice("Transcript fetched, formatting...", 2000);
          } catch (error) {
            logger.warn(
              "Failed to fetch YouTube transcript, formatting without it:",
              error
            );
            new Notice(
              "Could not fetch transcript, formatting with available content",
              3000
            );
            // Continue formatting even if transcript fetch fails
          }
        } else {
          logger.info(
            "No YouTube URL found in content for youtube_video formatting"
          );
        }
      }

      const formattingInstruction = await plugin.getTemplateInstructions(
        templateName
      );

      if (formatBehavior === "override") {
        await plugin.streamFormatInCurrentNote({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      } else if (formatBehavior === "newFile") {
        await plugin.streamFormatInSplitView({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      } else if (formatBehavior === "append") {
        // Placeholder for append logic:
        // will not create a backup file
        // will append to the end of the current note
        await plugin.streamFormatAppendInCurrentNote({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      }
    } catch (error) {
      logger.error("Error in handleFormat:", error);
    }
  };

  const handleRevert = async () => {
    if (!file || !backupFile) return;

    try {
      const backupTFile = plugin.app.vault.getAbstractFileByPath(
        backupFile
      ) as TFile;
      if (!backupTFile) {
        throw new Error("Backup file not found");
      }

      const backupContent = await plugin.app.vault.read(backupTFile);
      await plugin.app.vault.modify(file, backupContent);
      new Notice("Successfully reverted to backup version", 3000);
    } catch (error) {
      logger.error("Error reverting to backup:", error);
    }
  };

  const extractBackupFile = React.useCallback((content: string) => {
    const match = content.match(/\[\[(.+?)\s*\|\s*Link to original file\]\]/);
    if (match) {
      setBackupFile(match[1]);
    } else {
      setBackupFile(null);
    }
  }, []);

  React.useEffect(() => {
    if (content) {
      extractBackupFile(content);
    }
  }, [content, extractBackupFile]);

  const handleFormatBehaviorChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newBehavior = event.target.value as "override" | "newFile" | "append";
    setFormatBehavior(newBehavior);
    plugin.settings.formatBehavior = newBehavior;
    await plugin.saveSettings();
  };

  return (
    <div>
      <div className="font-semibold my-3">🗳️ AI Templates</div>
      <div className="bg-[--background-primary-alt] text-[--text-normal] p-4 space-y-4 border-b border-[--background-modifier-border]">
        <div className="flex items-center space-x-2">
          <label htmlFor="formatBehavior" className="font-medium">
            Format Behavior:
          </label>
          <select
            id="formatBehavior"
            value={formatBehavior}
            onChange={handleFormatBehaviorChange}
            className="px-2 py-1 border border-[--background-modifier-border]"
          >
            <option value="override">Replace</option>
            <option value="newFile">New File</option>
            <option value="append">Append</option>
          </select>
          <div className="flex justify-between items-center">
            {backupFile && (
              <button
                onClick={handleRevert}
                className="px-3 py-1 text-sm bg-[--background-modifier-error] text-[--text-on-accent] hover:opacity-90 transition-opacity"
              >
                Revert
              </button>
            )}
          </div>
        </div>
        <UserTemplates
          plugin={plugin}
          file={file}
          content={content}
          refreshKey={refreshKey}
          onFormat={handleFormat}
        />
      </div>
    </div>
  );
};
