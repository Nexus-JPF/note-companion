jest.mock("obsidian", () => ({
  normalizePath: (p: string) => p,
  TFile: class {},
  TFolder: class {},
}));

import {
  AUDIO_TEMPLATE_OFF,
  filterTemplatesForAudio,
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
