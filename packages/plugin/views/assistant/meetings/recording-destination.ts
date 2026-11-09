export interface RecordingDestinationInput {
  sendToInbox: boolean;
  useInbox: boolean;
  enableAttachmentProcessing: boolean;
  enableAudioTranscription: boolean;
  pathToWatch: string;
  recordingsFolderPath: string;
}

export interface RecordingDestination {
  folder: string;
  /** True when the inbox pipeline (transcribe, format, name, file) will handle the recording. */
  processedByInbox: boolean;
  /** File name stem: inbox recordings aren't necessarily meetings. */
  label: "Recording" | "Meeting";
  /** Set when the user asked for the inbox but the recording is saved elsewhere; explains why. */
  fallbackReason?: string;
}

function getInboxBlocker(input: RecordingDestinationInput): string | null {
  if (!input.useInbox) return "the inbox is turned off";
  if (!input.enableAttachmentProcessing) {
    return "attachment processing is turned off";
  }
  if (!input.enableAudioTranscription) {
    return "audio transcription is turned off";
  }
  if (input.pathToWatch.trim() === "") return "no inbox folder is set";
  return null;
}

/**
 * Where a finished recording is saved. Recordings only go to the inbox when
 * the inbox can actually transcribe them; otherwise they would sit there as a
 * bare audio embed, so we keep the Recordings-folder flow.
 */
export function getRecordingDestination(
  input: RecordingDestinationInput
): RecordingDestination {
  const blocker = getInboxBlocker(input);

  if (input.sendToInbox && !blocker) {
    return {
      folder: input.pathToWatch.trim(),
      processedByInbox: true,
      label: "Recording",
    };
  }
  return {
    folder: input.recordingsFolderPath,
    processedByInbox: false,
    label: "Meeting",
    ...(input.sendToInbox && blocker
      ? {
          fallbackReason: `Saved to ${input.recordingsFolderPath} instead of the inbox because ${blocker}.`,
        }
      : {}),
  };
}
