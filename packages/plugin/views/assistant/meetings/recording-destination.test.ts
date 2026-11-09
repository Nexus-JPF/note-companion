import { getRecordingDestination } from "./recording-destination";

const base = {
  sendToInbox: true,
  useInbox: true,
  enableAttachmentProcessing: true,
  enableAudioTranscription: true,
  pathToWatch: "_NoteCompanion/Inbox",
  recordingsFolderPath: "Recordings",
};

describe("getRecordingDestination", () => {
  it("saves to the inbox when enabled and the inbox can transcribe", () => {
    expect(getRecordingDestination(base)).toEqual({
      folder: "_NoteCompanion/Inbox",
      processedByInbox: true,
      label: "Recording",
    });
  });

  it("keeps the Recordings folder when the setting is off", () => {
    expect(getRecordingDestination({ ...base, sendToInbox: false })).toEqual({
      folder: "Recordings",
      processedByInbox: false,
      label: "Meeting",
    });
  });

  it.each([
    ["inbox disabled", { useInbox: false }],
    ["attachment processing off", { enableAttachmentProcessing: false }],
    ["audio transcription off", { enableAudioTranscription: false }],
    ["no inbox folder", { pathToWatch: "  " }],
  ])("falls back to Recordings when the inbox cannot transcribe (%s)", (_n, patch) => {
    const result = getRecordingDestination({ ...base, ...patch });
    expect(result.processedByInbox).toBe(false);
    expect(result.folder).toBe("Recordings");
  });
});
