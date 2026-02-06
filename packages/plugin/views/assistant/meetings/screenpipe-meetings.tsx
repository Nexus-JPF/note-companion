import React, { useState, useEffect, useCallback } from "react";
import { TFile } from "obsidian";
import { Button } from "../ai-chat/button";
import { FileText, FilePlus, RefreshCw } from "lucide-react";
import FileOrganizer from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { logger } from "../../../services/logger";
import {
  parseScreenpipeTimestamp,
  ScreenpipeClient,
  ScreenpipeResult,
} from "../../../services/screenpipe-client";
import { getAvailablePath } from "../../../fileUtils";
import { isMeetingLike } from "./meeting-predicate";

interface ScreenpipeMeetingsProps {
  plugin: FileOrganizer;
}

export const ScreenpipeMeetings: React.FC<ScreenpipeMeetingsProps> = ({
  plugin,
}) => {
  const [results, setResults] = useState<ScreenpipeResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const fetchMeetings = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setUnavailable(false);

      try {
        const client = new ScreenpipeClient(plugin.settings.screenpipeApiUrl);
        const available = await client.isAvailable();
        if (!available) {
          setUnavailable(true);
          setResults([]);
          return;
        }

        const hours = plugin.settings.screenpipeTimeRange || 2;
        const end = new Date();
        const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
        const searchResults = await client.search({
          content_type: "audio",
          limit: plugin.settings.queryScreenpipeLimit || 10,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });

        const meetingOnly = searchResults.filter(r =>
          isMeetingLike(r.content ?? {})
        );
        setResults(meetingOnly);
      } catch (error) {
        logger.error("ScreenPipe meetings fetch failed", error);
        setResults([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      plugin.settings.screenpipeApiUrl,
      plugin.settings.screenpipeTimeRange,
      plugin.settings.queryScreenpipeLimit,
    ]
  );

  useEffect(() => {
    if (!plugin.settings.enableScreenpipe) return;
    fetchMeetings();
  }, [plugin.settings.enableScreenpipe, fetchMeetings]);

  if (!plugin.settings.enableScreenpipe) return null;

  if (isLoading) {
    return (
      <div className={tw("p-4 text-center text-[--text-muted]")}>
        Loading from ScreenPipe...
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className={tw("p-4")}>
        <div className={tw("flex items-center justify-between mb-2")}>
          <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
            From ScreenPipe
          </h3>
          <button
            onClick={() => fetchMeetings(true)}
            disabled={isRefreshing}
            className={tw(
              "flex items-center gap-1.5 px-2 py-1 text-xs",
              "bg-[--background-modifier-form-field] hover:bg-[--background-modifier-hover]",
              "border border-[--background-modifier-border] rounded",
              "text-[--text-normal]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
            title="Retry after starting ScreenPipe"
          >
            {isRefreshing ? (
              <RefreshCw className={tw("w-3.5 h-3.5 animate-spin")} />
            ) : (
              <>
                <RefreshCw className={tw("w-3.5 h-3.5")} />
                <span>Retry</span>
              </>
            )}
          </button>
        </div>
        <p className={tw("text-sm text-[--text-muted]")}>
          ScreenPipe unavailable. Start ScreenPipe (e.g. localhost:3030), then
          click Retry to load meetings—no need to reload Obsidian.
        </p>
      </div>
    );
  }

  /** Format ScreenPipe timestamp in user's local time (handles ISO, Unix s/ms). */
  const formatDate = (timestamp: string): string => {
    try {
      const d = parseScreenpipeTimestamp(timestamp);
      const t = d.getTime();
      if (Number.isNaN(t)) return timestamp;
      return (
        d.toLocaleDateString() +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return timestamp;
    }
  };

  const formatRecordingLabel = (result: ScreenpipeResult): string => {
    const c = result.content ?? {};
    const app = c.app_name ?? "Meeting";
    const window = c.window_name ? ` - ${c.window_name}` : "";
    const ts = c.timestamp ? formatDate(c.timestamp).split(" ")[0] : "";
    return `ScreenPipe - ${app}${window} - ${ts}`.slice(0, 80);
  };

  const enhanceFromScreenPipe = async (
    result: ScreenpipeResult,
    currentNoteContent: string,
    activeFile: TFile,
    recordingDate: string | null,
    recordingFileName: string
  ) => {
    const transcript = (result.content?.transcription ?? "").trim();
    if (!transcript) {
      new Notice("No transcript for this item");
      return;
    }

    const originalRecordingSectionPattern = /^(Recording[s]?:.*?)\n\n---\n\n/s;
    const cleanedNoteContent = currentNoteContent.replace(
      originalRecordingSectionPattern,
      ""
    );

    const response = await fetch(
      `${plugin.getServerUrl()}/api/enhance-meeting-note`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
        body: JSON.stringify({
          transcript,
          currentNoteContent: cleanedNoteContent,
          fileName: activeFile.basename,
          recordingDate,
          recordingFileName,
          recordingFilePath: "",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error ?? "Enhancement failed");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let enhancedContent = "";
    if (!reader) throw new Error("No response body");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      enhancedContent += decoder.decode(value, { stream: true });
    }

    enhancedContent = enhancedContent.replace(
      /^Recording[s]?:.*?\n\n---\n\n/s,
      ""
    );
    enhancedContent = enhancedContent.replace(
      /\n\nRecording[s]?:.*?\n\n---\n\n/g,
      "\n\n"
    );
    enhancedContent = enhancedContent.replace(
      /^Recording[s]?:.*?(!?\[\[.*?\]\]).*?\n\n---\n\n/s,
      ""
    );

    await plugin.app.vault.modify(activeFile, enhancedContent);
    new Notice("Note enhanced successfully!");
  };

  const handleEnhanceNote = async (result: ScreenpipeResult) => {
    const activeFile = plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Please open a note to enhance");
      return;
    }
    const transcript = (result.content?.transcription ?? "").trim();
    if (!transcript) {
      new Notice("No transcript for this item");
      return;
    }

    try {
      const currentNoteContent = await plugin.app.vault.read(activeFile);
      const recordingDate = result.content?.timestamp
        ? parseScreenpipeTimestamp(result.content.timestamp).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )
        : null;
      const recordingFileName = formatRecordingLabel(result);
      await enhanceFromScreenPipe(
        result,
        currentNoteContent,
        activeFile,
        recordingDate,
        recordingFileName
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Enhance failed";
      logger.error("Enhance from ScreenPipe failed", error);
      new Notice(msg);
    }
  };

  const handleCreateNote = async (result: ScreenpipeResult) => {
    const transcript = (result.content?.transcription ?? "").trim();
    if (!transcript) {
      new Notice("No transcript for this item");
      return;
    }

    try {
      const folder = plugin.settings.recordingsFolderPath || "Recordings";
      await plugin.app.vault.adapter.mkdir(folder);
      const c = result.content ?? {};
      const dateStr = c.timestamp
        ? parseScreenpipeTimestamp(c.timestamp).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const appName =
        (c.app_name ?? "Meeting").replace(/[^\w\s-]/g, "").slice(0, 30) ||
        "Meeting";
      const baseFileName = `Meeting ${dateStr} ${appName}.md`;
      const desiredPath = `${folder}/${baseFileName}`;
      const filePath = await getAvailablePath(plugin.app, desiredPath);
      await plugin.app.vault.create(filePath, "");
      const newFile = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!newFile || !(newFile instanceof TFile))
        throw new Error("Failed to create file");

      const recordingDate = c.timestamp
        ? parseScreenpipeTimestamp(c.timestamp).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;
      const recordingFileName = formatRecordingLabel(result);
      await enhanceFromScreenPipe(
        result,
        "",
        newFile,
        recordingDate,
        recordingFileName
      );
      plugin.app.workspace.openLinkText(filePath, "", true);
      new Notice("Note created and enhanced.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Create note failed";
      logger.error("Create note from ScreenPipe failed", error);
      new Notice(msg);
    }
  };

  return (
    <div className={tw("p-4 flex-1 overflow-y-auto")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
          From ScreenPipe
        </h3>
        <button
          onClick={() => fetchMeetings(true)}
          disabled={isRefreshing}
          className={tw(
            "flex items-center gap-1.5 px-2 py-1 text-xs",
            "bg-[--background-modifier-form-field] hover:bg-[--background-modifier-hover]",
            "border border-[--background-modifier-border] rounded",
            "text-[--text-normal]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
          title="Refresh ScreenPipe meetings"
        >
          {isRefreshing ? (
            <RefreshCw className={tw("w-3.5 h-3.5 animate-spin")} />
          ) : (
            <>
              <RefreshCw className={tw("w-3.5 h-3.5")} />
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {results.length === 0 ? (
        <p className={tw("text-sm text-[--text-muted]")}>
          No meeting audio in the last{" "}
          {plugin.settings.screenpipeTimeRange ?? 2} hours.
        </p>
      ) : (
        <div className={tw("space-y-2")}>
          {results.map((result, index) => {
            const c = result.content ?? {};
            const transcript = (c.transcription ?? "").trim();
            const preview = transcript
              ? transcript.slice(0, 80) + (transcript.length > 80 ? "…" : "")
              : "No transcript";
            const hasTranscript = transcript.length > 0;

            return (
              <div
                key={`${c.timestamp ?? index}-${c.app_name ?? ""}`}
                className={tw(
                  "border border-[--background-modifier-border] rounded p-3 hover:bg-[--background-modifier-hover]"
                )}
              >
                <div
                  className={tw("flex items-start justify-between mb-2 gap-2")}
                >
                  <div className={tw("flex-1 min-w-0 pr-2")}>
                    <div
                      className={tw("flex items-start gap-2 mb-1 flex-wrap")}
                    >
                      <span
                        className={tw(
                          "text-sm font-medium text-[--text-normal]"
                        )}
                      >
                        {c.app_name ?? "Meeting"}
                        {c.window_name ? ` — ${c.window_name}` : ""}
                      </span>
                    </div>
                    <div
                      className={tw("text-xs text-[--text-muted] space-x-3")}
                    >
                      <span title="Time in your local timezone (from ScreenPipe)">
                        {c.timestamp ? formatDate(c.timestamp) : "—"}
                      </span>
                    </div>
                    <p
                      className={tw(
                        "text-xs text-[--text-muted] mt-1 truncate"
                      )}
                      title={transcript || undefined}
                    >
                      {preview}
                    </p>
                  </div>
                </div>
                <div className={tw("flex items-center gap-2 mt-2")}>
                  <Button
                    onClick={() => handleEnhanceNote(result)}
                    disabled={!hasTranscript}
                    className={tw("flex items-center gap-2 text-xs")}
                    title={
                      hasTranscript
                        ? "Enhance active note with this transcript"
                        : "No transcript"
                    }
                  >
                    <FileText className={tw("w-3 h-3")} />
                    Enhance note
                  </Button>
                  <Button
                    onClick={() => handleCreateNote(result)}
                    disabled={!hasTranscript}
                    className={tw("flex items-center gap-2 text-xs")}
                    title={
                      hasTranscript
                        ? "Create new note from this transcript"
                        : "No transcript"
                    }
                  >
                    <FilePlus className={tw("w-3 h-3")} />
                    Create note
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
