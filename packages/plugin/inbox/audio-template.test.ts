jest.mock("obsidian", () => ({
  normalizePath: (p: string) => p,
  TFile: class {},
  TFolder: class {},
}));

import {
  AUDIO_TEMPLATE_OFF,
  decideTemplate,
  filterTemplatesForAudio,
  getForcedAudioTemplate,
  isAudioCompatibleTemplate,
  resolveAudioDefaultTemplate,
} from "./audio-template";

describe("resolveAudioDefaultTemplate", () => {
  it("is off for empty, missing, and the off sentinel", () => {
    expect(resolveAudioDefaultTemplate(undefined)).toBeNull();
    expect(resolveAudioDefaultTemplate(null)).toBeNull();
    expect(resolveAudioDefaultTemplate("")).toBeNull();
    expect(resolveAudioDefaultTemplate("  ")).toBeNull();
    expect(resolveAudioDefaultTemplate(AUDIO_TEMPLATE_OFF)).toBeNull();
    expect(resolveAudioDefaultTemplate("None")).toBeNull();
  });

  it("treats a saved youtube_* value as off", () => {
    expect(resolveAudioDefaultTemplate("youtube_qa")).toBeNull();
    expect(resolveAudioDefaultTemplate("YouTube_Summary.md")).toBeNull();
  });

  it("returns the template name, without a .md extension", () => {
    expect(resolveAudioDefaultTemplate("lecture_notes")).toBe("lecture_notes");
    expect(resolveAudioDefaultTemplate("flash_cards.md")).toBe("flash_cards");
  });
});

describe("audio template compatibility", () => {
  it("rejects youtube_* templates (any case, with or without .md)", () => {
    expect(isAudioCompatibleTemplate("youtube_qa")).toBe(false);
    expect(isAudioCompatibleTemplate("YouTube_Summary.md")).toBe(false);
  });

  it("keeps everything else", () => {
    expect(isAudioCompatibleTemplate("lecture_notes")).toBe(true);
    expect(isAudioCompatibleTemplate("my_youtube_style")).toBe(true);
  });

  it("filters a template list", () => {
    expect(
      filterTemplatesForAudio(["flash_cards", "youtube_qa", "meeting_note"])
    ).toEqual(["flash_cards", "meeting_note"]);
  });
});

describe("getForcedAudioTemplate", () => {
  const base = {
    isAudioFile: true,
    mediaExtractionSkipped: false,
    setting: "lecture_notes",
  };

  it("forces the template for transcribed audio", () => {
    expect(getForcedAudioTemplate(base)).toBe("lecture_notes");
  });

  it("does nothing when transcription is disabled (note is only an embed)", () => {
    expect(
      getForcedAudioTemplate({ ...base, mediaExtractionSkipped: true })
    ).toBeNull();
  });

  it("does nothing for non-audio files", () => {
    expect(getForcedAudioTemplate({ ...base, isAudioFile: false })).toBeNull();
  });

  it("does nothing when the setting is off", () => {
    expect(
      getForcedAudioTemplate({ ...base, setting: AUDIO_TEMPLATE_OFF })
    ).toBeNull();
  });
});

describe("decideTemplate", () => {
  const names = ["lecture_notes", "flash_cards"];

  it("uses a valid audio default even when auto-formatting is off", () => {
    expect(
      decideTemplate({
        forcedTemplate: "lecture_notes",
        templateNames: names,
        autoFormattingEnabled: false,
      })
    ).toEqual({ kind: "use", template: "lecture_notes" });
  });

  it("skips (leaves the note unformatted) when the template is missing and auto-formatting is off", () => {
    expect(
      decideTemplate({
        forcedTemplate: "deleted_template",
        templateNames: names,
        autoFormattingEnabled: false,
      })
    ).toEqual({ kind: "skip" });
  });

  it("falls back to the classifier when the template is missing and auto-formatting is on", () => {
    expect(
      decideTemplate({
        forcedTemplate: "deleted_template",
        templateNames: names,
        autoFormattingEnabled: true,
      })
    ).toEqual({ kind: "classify" });
  });

  it("classifies as before when nothing is forced and auto-formatting is on", () => {
    expect(
      decideTemplate({
        forcedTemplate: null,
        templateNames: names,
        autoFormattingEnabled: true,
      })
    ).toEqual({ kind: "classify" });
  });
});
