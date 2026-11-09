import React, { useRef, useState, useEffect } from "react";
import { Button } from "../ai-chat/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { logger } from "../../../services/logger";
import FileOrganizer from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { MeetingMetadataManager } from "./meeting-metadata";
import { getAvailablePath } from "../../../fileUtils";
import { getRecordingDestination } from "./recording-destination";

interface MeetingRecorderProps {
  plugin: FileOrganizer;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ plugin }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const metadataManager = React.useRef(
    new MeetingMetadataManager(plugin)
  ).current;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /** Prefer MP4/AAC for local playback; WebM Opus as fallback. */
  const createMediaRecorder = (stream: MediaStream): MediaRecorder => {
    const audioBitsPerSecond = 128000;
    const mimeCandidates = [
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
    ];

    for (const mimeType of mimeCandidates) {
      if (!MediaRecorder.isTypeSupported(mimeType)) continue;
      try {
        return new MediaRecorder(stream, { mimeType, audioBitsPerSecond });
      } catch (e) {
        logger.warn(`MediaRecorder init failed for ${mimeType}`, e);
      }
    }

    return new MediaRecorder(stream, { audioBitsPerSecond });
  };

  const fileExtensionForRecorder = (recorder: MediaRecorder): "m4a" | "webm" => {
    const mime = recorder.mimeType.toLowerCase();
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("webm")) return "webm";
    return "m4a";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mediaRecorder = createMediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      startTimeRef.current = new Date();

      // Update duration every second
      intervalRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed =
            (new Date().getTime() - startTimeRef.current.getTime()) / 1000;
          setDuration(elapsed);
        }
      }, 1000);
    } catch (error) {
      logger.error("Error accessing microphone:", error);
      new Notice("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    try {
      setIsRecording(false);

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await new Promise<void>(resolve => {
        const mimeType = recorder.mimeType;

        recorder.onstop = async () => {
          mediaRecorderRef.current = null;

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          try {
            if (audioChunks.current.length === 0) {
              throw new Error("No audio data recorded");
            }

            setIsSaving(true);

            const blob = new Blob(audioChunks.current, {
              type: mimeType || "audio/webm",
            });

            const arrayBuffer = await blob.arrayBuffer();

            const now = new Date();
            const dateStr = now.toISOString().split("T")[0];
            const extension = fileExtensionForRecorder(recorder);
            const destination = getRecordingDestination({
              sendToInbox: plugin.settings.sendRecordingsToInbox,
              useInbox: plugin.settings.useInbox,
              enableAttachmentProcessing:
                plugin.settings.enableAttachmentProcessing,
              enableAudioTranscription: plugin.settings.enableAudioTranscription,
              pathToWatch: plugin.settings.pathToWatch,
              recordingsFolderPath: plugin.settings.recordingsFolderPath,
            });
            const baseFileName = `${dateStr} ${destination.label}.${extension}`;
            const desiredPath = `${destination.folder}/${baseFileName}`;

            await plugin.app.vault.adapter.mkdir(destination.folder);

            const filePath = await getAvailablePath(plugin.app, desiredPath);

            await plugin.app.vault.createBinary(filePath, arrayBuffer);

            if (destination.processedByInbox) {
              // The inbox picks the file up, then moves, transcribes and formats it,
              // so there is no Recordings-list entry to track.
              new Notice(
                "Recording saved to the inbox. It will be transcribed and turned into a note automatically."
              );
              setDuration(0);
              audioChunks.current = [];
              return;
            }

            await metadataManager.loadMetadata();

            const elapsedSeconds = startTimeRef.current
              ? (Date.now() - startTimeRef.current.getTime()) / 1000
              : duration;
            const recordingDurationInMinutes = elapsedSeconds / 60;

            await metadataManager.updateMetadata({
              filePath,
              createdAt: now.toISOString(),
              duration: recordingDurationInMinutes,
              transcribed: false,
              discovered: false,
            });

            const savedFileName = filePath.split("/").pop() || baseFileName;
            new Notice(`Recording saved: ${savedFileName}`);
            setDuration(0);
            audioChunks.current = [];

            window.dispatchEvent(new CustomEvent("meeting-recorded"));
          } catch (error) {
            logger.error("Error saving recording:", error);
            new Notice(
              `Failed to save recording: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          } finally {
            startTimeRef.current = null;
            setIsSaving(false);
            resolve();
          }
        };

        try {
          if (recorder.state === "recording") {
            recorder.requestData();
          }
        } catch (e) {
          logger.warn("requestData before stop failed", e);
        }

        recorder.stop();
      });
    } catch (error) {
      logger.error("Error stopping recording:", error);
      setIsRecording(false);
      setIsSaving(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className={tw("border-b border-[--background-modifier-border] p-4")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <div className={tw("flex items-center gap-3")}>
          <div
            className={tw(
              "h-3 w-3 rounded-full transition-all",
              isRecording ? "bg-red-500 animate-pulse" : "bg-[--text-muted]"
            )}
          />
          <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
            Meeting Recorder
          </h3>
        </div>
        <Button
          onClick={() => { void (isRecording ? stopRecording() : startRecording()); }}
          disabled={isSaving}
          className={tw(
            "flex items-center gap-2",
            isRecording && "bg-red-500 hover:bg-red-600"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : isRecording ? (
            <>
              <Square className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Start Recording
            </>
          )}
        </Button>
      </div>
      {isRecording && (
        <div
          className={tw("flex items-center gap-2 text-sm text-[--text-muted]")}
        >
          <span>Recording: {formatDuration(duration)}</span>
        </div>
      )}
    </div>
  );
};
