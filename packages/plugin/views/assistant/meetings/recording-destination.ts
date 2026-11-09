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
}

/**
 * Where a finished recording is saved. Recordings only go to the inbox when
 * the inbox can actually transcribe them; otherwise they would sit there as a
 * bare audio embed, so we keep the Recordings-folder flow.
 */
export function getRecordingDestination(
  input: RecordingDestinationInput
): RecordingDestination {
  const inboxCanTranscribe =
    input.useInbox &&
    input.enableAttachmentProcessing &&
    input.enableAudioTranscription &&
    input.pathToWatch.trim() !== "";

  if (input.sendToInbox && inboxCanTranscribe) {
    return {
      folder: input.pathToWatch,
      processedByInbox: true,
      label: "Recording",
    };
  }
  return {
    folder: input.recordingsFolderPath,
    processedByInbox: false,
    label: "Meeting",
  };
}
