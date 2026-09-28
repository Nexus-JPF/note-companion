import {
  buildOcrPrompt,
  DEFAULT_IMAGE_OCR_INSTRUCTIONS,
  LEGACY_IMAGE_DESCRIPTION_INSTRUCTION,
} from "./ocr-prompt";

describe("buildOcrPrompt", () => {
  it("uses OCR-only prompt when instructions are empty", () => {
    const prompt = buildOcrPrompt("");
    expect(prompt).toContain("Extract all text from the image");
    expect(prompt).toContain("Respond with only the extracted text");
    expect(prompt).not.toContain("detailed description");
  });

  it("ignores legacy description instructions", () => {
    const prompt = buildOcrPrompt(LEGACY_IMAGE_DESCRIPTION_INSTRUCTION);
    expect(prompt).not.toContain("detailed description");
  });

  it("appends custom OCR hints", () => {
    const prompt = buildOcrPrompt(DEFAULT_IMAGE_OCR_INSTRUCTIONS);
    expect(prompt).toContain("handwriting");
  });
});
